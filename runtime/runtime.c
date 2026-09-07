/* StaticTS runtime: arena + strings + cold paths. Layouts are ABI (runtime.ts, statictsc.h). */
#define _POSIX_C_SOURCE 200809L
#include <fcntl.h>
#include <inttypes.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#ifdef __wasi__
/* No pids on WASI: clock nanoseconds salt the RNG seed instead. */
static int sts_wasi_salt(void) { struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts); return ts.tv_nsec; }
#define getpid sts_wasi_salt
/* wasi-libc's `_start` calls `__main_argc_argv` (clang's name for a C `main`); the IR entry is
 * `main`. Weak, so a reactor build without an entry links. */
__attribute__((weak)) int sts_c_main(int, char **) __asm__("main");
int __main_argc_argv(int argc, char **argv) { return sts_c_main(argc, argv); }
#endif

#define STS_COLD __attribute__((noreturn, cold, noinline))

/* ---- Arena: %struct.sts_arena = type { i8*, i64, i64, i8* } */
typedef struct sts_chunk { struct sts_chunk *next; size_t cap; } sts_chunk;
struct sts_arena { char *buf; size_t off; size_t cap; sts_chunk *chunks; };
struct sts_arena sts_arena;

static STS_COLD void sts_die(const char *msg) {
  (void)!write(2, msg, strlen(msg));
  _exit(1);
}
#define sts_oom() sts_die("statictsc: out of memory\n")

/* Slow path (size 8-byte rounded): push a chunk (>= 64 KB), bump from it. */
void *sts_arena_grow(size_t size) {
  size_t cap = size > 65536 ? size : 65536;
  sts_chunk *c = malloc(sizeof *c + cap);
  if (!c) sts_oom();
  c->next = sts_arena.chunks;
  c->cap = cap;
  sts_arena.chunks = c;
  sts_arena.buf = (char *)(c + 1);
  sts_arena.off = size;
  sts_arena.cap = cap;
  return sts_arena.buf;
}

/* Bump allocation, 8-byte rounded/aligned, uninitialised; the compiler inlines it. */
void *sts_alloc_struct(size_t size) {
  size = (size + 7) & ~(size_t)7;
  if (sts_arena.off + size <= sts_arena.cap) {
    void *p = sts_arena.buf + sts_arena.off;
    sts_arena.off += size;
    return p;
  }
  return sts_arena_grow(size);
}

static void sts_free_until(sts_chunk *c, const sts_chunk *end) {
  while (c != end) { sts_chunk *n = c->next; free(c); c = n; }
}

/* O(1) recycle: keep the newest chunk, free the rest. */
void sts_reset_arena(void) {
  sts_chunk *keep = sts_arena.chunks;
  if (!keep) return;
  sts_free_until(keep->next, 0);
  keep->next = 0;
  sts_arena.off = 0;
}

void sts_free_arena(void) {
  sts_free_until(sts_arena.chunks, 0);
  memset(&sts_arena, 0, sizeof sts_arena);
}

/* ---- Scopes: mark = buf + off (0 while empty); release rewinds, freeing newer chunks. */
uint64_t sts_arena_mark(void) {
  return sts_arena.buf ? (uintptr_t)(sts_arena.buf + sts_arena.off) : 0;
}
uint64_t sts_arena_used(void) { return sts_arena.off; }

void sts_arena_release(uint64_t mark) {
  sts_chunk *c = sts_arena.chunks;
  if (!mark) { sts_reset_arena(); return; }
  for (; c; c = c->next) {
    uintptr_t base = (uintptr_t)(c + 1);
    if (mark >= base && mark <= base + c->cap) break;
  }
  if (!c) return;
  sts_free_until(sts_arena.chunks, c);
  sts_arena = (struct sts_arena){ (char *)(c + 1), mark - (uintptr_t)(c + 1), c->cap, c };
}

/* ---- Strings: { i64 len, bytes[len], '\0' }, immutable; 8 = the len header */
typedef struct { uint64_t len; char data[]; } sts_str;

sts_str *sts_str_new(const char *bytes, uint64_t len) {
  sts_str *s = sts_alloc_struct(8 + len + 1);
  s->len = len;
  if (len) memcpy(s->data, bytes, len);
  s->data[len] = 0;
  return s;
}

sts_str *sts_str_concat(const sts_str *a, const sts_str *b) {
  sts_str *s = sts_alloc_struct(8 + a->len + b->len + 1);
  s->len = a->len + b->len;
  memcpy(s->data, a->data, a->len);
  memcpy(s->data + a->len, b->data, b->len);
  s->data[s->len] = 0;
  return s;
}

_Bool sts_str_eq(const sts_str *a, const sts_str *b) {
  return a == b || (a->len == b->len && memcmp(a->data, b->data, a->len) == 0);
}

uint64_t sts_str_len(const sts_str *s) { return s->len; }

/* `s.startsWith(sub)` is at 0, `s.endsWith(sub)` at len - sub->len, which is
   negative when `sub` is the longer string. */
_Bool sts_str_at(const sts_str *s, int64_t at, const sts_str *sub) {
  return at >= 0 && (uint64_t)at + sub->len <= s->len && !memcmp(s->data + at, sub->data, sub->len);
}
/* console.log(s) */
void sts_print(const sts_str *s) {
  (void)!write(1, s->data, s->len);
  (void)!write(1, "\n", 1);
}

/* Decimal digits of `u`, with a '-' in front when `neg`. 20 digits is the
   widest a uint64_t can be, plus the sign. */
static sts_str *str_from_digits(uint64_t u, int neg) {
  char tmp[21], *p = tmp + 21;
  do { *--p = '0' + u % 10; u /= 10; } while (u);
  if (neg) *--p = '-';
  return sts_str_new(p, tmp + 21 - p);
}

sts_str *sts_str_from_i64(int64_t v) {
  return str_from_digits(v < 0 ? -(uint64_t)v : (uint64_t)v, v < 0);
}
sts_str *sts_str_from_i32(int32_t v) { return sts_str_from_i64(v); }
/* The one unsigned formatter (WP15): u8/u16/u32 are zero-extended by the
   caller, so 0xFFFFFFFF prints as 4294967295 rather than -1. */
sts_str *sts_str_from_u64(uint64_t v) { return str_from_digits(v, 0); }

/* JS Number#toString: shortest round-trip digits, e-form outside (-6, 21] */
sts_str *sts_str_from_f64(double v) {
  char buf[32], out[32], *o = out;
  int k, n, i, e = 0;
  if (v != v) { memcpy(o, "NaN", 3); o += 3; }
  else if (v == 0) *o++ = '0'; /* -0 prints as 0 */
  else {
    if (v < 0) { *o++ = '-'; v = -v; }
    if (v == INFINITY) { memcpy(o, "Infinity", 8); o += 8; }
    else {
      /* fewest digits k that round-trip (17 always do); buf = d[.ddd]e[+-]x */
      for (k = 0; snprintf(buf, sizeof buf, "%.*e", k++, v), k < 17 && strtod(buf, 0) != v;) {}
#define DIG(j) buf[(j) ? (j) + 1 : 0]
      while (k > 1 && DIG(k - 1) == '0') k--;
      n = atoi(strchr(buf, 'e') + 1) + 1; /* value = 0.digits * 10^n */
      if (n > 21 || n <= -6) { e = n - 1; n = 1; }
      else if (n <= 0) { *o++ = '0'; *o++ = '.'; for (; n < 0; n++) *o++ = '0'; n = k; }
      for (i = 0; i < k || i < n; i++) { if (i == n) *o++ = '.'; *o++ = i < k ? DIG(i) : '0'; }
      if (e) o += snprintf(o, 8, "e%+d", e);
    }
  }
  return sts_str_new(out, o - out);
}

/* ---- Math.random: xorshift64*, seeded lazily from time and pid */
static uint64_t sts_rng;

double sts_random(void) {
  uint64_t x = sts_rng ? sts_rng : ((uint64_t)time(0) << 32) ^ getpid() ^ 0x9E3779B97F4A7C15ull;
  x ^= x >> 12; x ^= x << 25; x ^= x >> 27;
  sts_rng = x;
  return (double)((x * 0x2545F4914F6CDD1Dull) >> 11) * (1.0 / 9007199254740992.0);
}

/* ---- Process and files */
void sts_exit(int32_t code) { exit(code); }
static STS_COLD void sts_io_fail(const char *what, const sts_str *path) {
  dprintf(2, "statictsc: cannot %s%.*s\n", what, (int)path->len, path->data);
  _exit(1);
}

sts_str *sts_read_file(const sts_str *path) {
  int fd = open(path->data, O_RDONLY);
  off_t len = fd < 0 ? -1 : lseek(fd, 0, SEEK_END);
  if (len < 0) sts_io_fail("read ", path);
  sts_str *s = sts_alloc_struct(8 + len + 1);
  uint64_t got = 0;
  ssize_t n;
  while ((n = pread(fd, s->data + got, len - got, got)) > 0) got += n;
  close(fd);
  s->len = got;
  s->data[got] = 0;
  return s;
}

static void sts_put_file(const sts_str *path, const sts_str *data, int flags) {
  int fd = open(path->data, O_WRONLY | O_CREAT | flags, 0644);
  if (fd < 0) sts_io_fail("write ", path);
  for (uint64_t done = 0; done < data->len;) {
    ssize_t n = write(fd, data->data + done, data->len - done);
    if (n <= 0) sts_io_fail("write ", path);
    done += n;
  }
  close(fd);
}
void sts_write_file(const sts_str *path, const sts_str *data) { sts_put_file(path, data, O_TRUNC); }
void sts_append_file(const sts_str *path, const sts_str *data) { sts_put_file(path, data, O_APPEND); }

/* ---- Arrays: %struct.sts_array = type { i64, i64, i8* }, cold paths */
typedef struct sts_array { uint64_t len; uint64_t cap; char *data; } sts_array;

/* Host entry (WP8): `len` uninitialised elements, len == cap */
sts_array *sts_alloc_array(uint64_t elem_size, uint64_t len) {
  sts_array *a = sts_alloc_struct(sizeof *a);
  *a = (sts_array){ len, len, sts_alloc_struct(len * elem_size) };
  return a;
}

/* process.argv: malloc, not the arena, so Arena.reset() cannot free it. Built once by @main. */
sts_array *sts_argv;

void sts_argv_init(int32_t argc, char **argv) {
  sts_array *a = malloc(sizeof *a + argc * sizeof(sts_str *));
  sts_str **d = (sts_str **)(a + 1);
  if (!a) sts_oom();
  *a = (sts_array){ argc, argc, (char *)d };
  sts_argv = a;
  while (argc-- > 0) {
    size_t len = strlen(*argv);
    sts_str *s = malloc(8 + len + 1);
    if (!s) sts_oom();
    s->len = len;
    strcpy(s->data, *argv++);
    *d++ = s;
  }
}

/* ---- String to number: mode 0 parseFloat, 1 Number, 2 parseInt (contract: statictsc.h). ASCII
 * whitespace only; strtod parses once the inf/nan spellings JS rejects are ruled out, and its `0x`
 * hex stays accepted (documented). */
#define STS_SPACES " \t\n\v\f\r"

double sts_parse_number(const sts_str *s, int32_t mode) {
  const char *p, *q, *stop;
  char *end;
  double v;
  if (mode == 2) return strtoll(s->data, 0, 10);
  p = s->data + strspn(s->data, STS_SPACES);
  q = p + (*p == '+' || *p == '-');
  stop = s->data + s->len;
  if (!((*q >= '0' && *q <= '9') || *q == '.' || strncmp(q, "Infinity", 8) == 0)) return mode && p == stop ? 0 : NAN;
  v = strtod(p, &end);
  if (end == p) return NAN; /* "." alone */
  return mode && end + strspn(end, STS_SPACES) != stop ? NAN : v;
}

/* push() when len == cap: double the capacity (4 from empty). */
void sts_array_grow(sts_array *a, uint64_t elem_size) {
  uint64_t cap = a->cap ? a->cap * 2 : 4;
  char *data = sts_alloc_struct(cap * elem_size);
  if (a->len) memcpy(data, a->data, a->len * elem_size);
  a->data = data;
  a->cap = cap;
}

void sts_panic_index(uint64_t idx, uint64_t len) {
  dprintf(2, "index out of range: %" PRIu64 " >= %" PRIu64 "\n", idx, len);
  _exit(1);
}

/* ---- Checked division (Rust semantics): the failed-check path */
void sts_panic_div(_Bool by_zero) {
  sts_die(by_zero ? "attempt to divide by zero\n" : "attempt to divide with overflow\n");
}
