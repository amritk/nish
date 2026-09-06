/* StaticTS runtime: arena + strings + cold paths. Layouts are ABI (runtime.ts). */
#define _POSIX_C_SOURCE 200809L
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

/* ---- Arena: %struct.sts_arena = type { i8*, i64, i64, i8* } */
typedef struct sts_chunk { struct sts_chunk *next; size_t cap; } sts_chunk;
struct sts_arena { char *buf; size_t off; size_t cap; sts_chunk *chunks; };
struct sts_arena sts_arena = { 0, 0, 0, 0 };

#define STS_ALIGN(n) (((n) + (size_t)7) & ~(size_t)7)
#define STS_CHUNK_MIN ((size_t)64 * 1024)

static void sts_die(const char *msg) {
  (void)!write(2, msg, strlen(msg));
  _exit(1);
}

/* Slow path (size 8-byte rounded): push a fresh chunk, bump from it. */
void *sts_arena_grow(size_t size) {
  size_t cap = size > STS_CHUNK_MIN ? size : STS_CHUNK_MIN;
  sts_chunk *c = (sts_chunk *)malloc(sizeof *c + cap);
  if (!c) sts_die("statictsc: out of memory\n");
  c->next = sts_arena.chunks;
  c->cap = cap;
  sts_arena.chunks = c;
  sts_arena.buf = (char *)(c + 1);
  sts_arena.off = size;
  sts_arena.cap = cap;
  return sts_arena.buf;
}

/* Bump allocation, 8-aligned, uninitialised (the compiler inlines this). */
void *sts_alloc_struct(size_t size) {
  size = STS_ALIGN(size);
  if (sts_arena.off + size <= sts_arena.cap) {
    void *p = sts_arena.buf + sts_arena.off;
    sts_arena.off += size;
    return p;
  }
  return sts_arena_grow(size);
}

/* Recycle everything in O(1): keep the newest chunk, free the rest */
void sts_reset_arena(void) {
  sts_chunk *keep = sts_arena.chunks;
  if (!keep) return;
  sts_chunk *c = keep->next;
  while (c) { sts_chunk *n = c->next; free(c); c = n; }
  keep->next = 0;
  sts_arena.off = 0;
}

void sts_free_arena(void) {
  sts_chunk *c = sts_arena.chunks;
  while (c) { sts_chunk *n = c->next; free(c); c = n; }
  memset(&sts_arena, 0, sizeof sts_arena);
}

/* ---- Scopes: mark = buf + off (0 while empty); release rewinds, freeing newer chunks */
uint64_t sts_arena_mark(void) {
  return sts_arena.buf ? (uint64_t)(uintptr_t)(sts_arena.buf + sts_arena.off) : 0;
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
  while (sts_arena.chunks != c) {
    sts_chunk *n = sts_arena.chunks->next;
    free(sts_arena.chunks);
    sts_arena.chunks = n;
  }
  sts_arena.buf = (char *)(c + 1);
  sts_arena.cap = c->cap;
  sts_arena.off = (size_t)(mark - (uintptr_t)sts_arena.buf);
}

/* ---- Strings: { i64 len, bytes[len], '\0' }, immutable */
typedef struct { uint64_t len; char data[]; } sts_str;

sts_str *sts_str_new(const char *bytes, uint64_t len) {
  sts_str *s = (sts_str *)sts_alloc_struct(sizeof(uint64_t) + len + 1);
  s->len = len;
  if (len) memcpy(s->data, bytes, len);
  s->data[len] = 0;
  return s;
}

sts_str *sts_str_concat(const sts_str *a, const sts_str *b) {
  sts_str *s = (sts_str *)sts_alloc_struct(sizeof(uint64_t) + a->len + b->len + 1);
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

/* console.log(s): one write(2) */
void sts_print(const sts_str *s) {
  (void)!write(1, s->data, s->len);
  (void)!write(1, "\n", 1);
}

sts_str *sts_str_from_i64(int64_t v) {
  char tmp[21];
  char *p = tmp + sizeof tmp;
  uint64_t u = v < 0 ? 0u - (uint64_t)v : (uint64_t)v;
  do { *--p = (char)('0' + u % 10); u /= 10; } while (u);
  if (v < 0) *--p = '-';
  return sts_str_new(p, (uint64_t)(tmp + sizeof tmp - p));
}

sts_str *sts_str_from_i32(int32_t v) { return sts_str_from_i64(v); }

/* JS Number#toString: shortest round-trip digits, e-form outside (-6, 21] */
sts_str *sts_str_from_f64(double v) {
  char buf[32], out[32], dig[18], *o = out;
  int prec, k, n, i;
  if (v != v) return sts_str_new("NaN", 3);
  if (v == 0) return sts_str_new("0", 1); /* -0 prints as 0 */
  if (v < 0) { *o++ = '-'; v = -v; }
  if (v > 1.7976931348623157e308) { memcpy(o, "Infinity", 8); return sts_str_new(out, (uint64_t)(o + 8 - out)); }
  for (prec = 1; prec <= 17; prec++) {
    snprintf(buf, sizeof buf, "%.*e", prec - 1, v);
    if (strtod(buf, 0) == v) break;
  }
  /* k digits, value = 0.dig * 10^n */
  for (k = 0, i = 0; buf[i] != 'e'; i++) if (buf[i] != '.') dig[k++] = buf[i];
  while (k > 1 && dig[k - 1] == '0') k--;
  n = atoi(buf + i + 1) + 1;
  if (k <= n && n <= 21) { memcpy(o, dig, k); o += k; memset(o, '0', n - k); o += n - k; }
  else if (0 < n && n <= 21) { memcpy(o, dig, n); o += n; *o++ = '.'; memcpy(o, dig + n, k - n); o += k - n; }
  else if (-6 < n && n <= 0) { *o++ = '0'; *o++ = '.'; memset(o, '0', -n); o -= n; memcpy(o, dig, k); o += k; }
  else {
    *o++ = dig[0];
    if (k > 1) { *o++ = '.'; memcpy(o, dig + 1, k - 1); o += k - 1; }
    o += snprintf(o, 8, "e%c%d", n > 1 ? '+' : '-', n > 1 ? n - 1 : 1 - n);
  }
  return sts_str_new(out, (uint64_t)(o - out));
}

/* ---- Math.random: xorshift64*, seeded lazily from time and pid */
static uint64_t sts_rng;

double sts_random(void) {
  uint64_t x = sts_rng ? sts_rng : ((uint64_t)time(0) << 32) ^ (uint64_t)getpid() ^ 0x9E3779B97F4A7C15ull;
  x ^= x >> 12; x ^= x << 25; x ^= x >> 27;
  sts_rng = x;
  return (double)((x * 0x2545F4914F6CDD1Dull) >> 11) * (1.0 / 9007199254740992.0);
}

/* ---- Process and files */
void sts_exit(int32_t code) { exit(code); }

static void sts_io_fail(const char *what, const sts_str *path) {
  (void)!write(2, "statictsc: cannot ", 18);
  (void)!write(2, what, strlen(what));
  (void)!write(2, path->data, path->len);
  sts_die("\n");
}

/* readFileSync: the whole file as one arena string */
sts_str *sts_read_file(const sts_str *path) {
  int fd = open(path->data, O_RDONLY);
  off_t len = fd < 0 ? -1 : lseek(fd, 0, SEEK_END);
  if (len < 0) sts_io_fail("read ", path);
  sts_str *s = (sts_str *)sts_alloc_struct(sizeof(uint64_t) + (size_t)len + 1);
  ssize_t n;
  for (s->len = 0; (n = pread(fd, s->data + s->len, (size_t)len - s->len, (off_t)s->len)) > 0;) s->len += (uint64_t)n;
  close(fd);
  s->data[s->len] = 0;
  return s;
}

static void sts_put_file(const sts_str *path, const sts_str *data, int flags) {
  int fd = open(path->data, O_WRONLY | O_CREAT | flags, 0644);
  for (uint64_t done = 0; done < data->len;) {
    ssize_t n = fd < 0 ? -1 : write(fd, data->data + done, data->len - done);
    if (n <= 0) sts_io_fail("write ", path);
    done += (uint64_t)n;
  }
  if (fd < 0) sts_io_fail("write ", path);
  close(fd);
}

void sts_write_file(const sts_str *path, const sts_str *data) { sts_put_file(path, data, O_TRUNC); }
void sts_append_file(const sts_str *path, const sts_str *data) { sts_put_file(path, data, O_APPEND); }

/* ---- Arrays: %struct.sts_array = type { i64, i64, i8* }, cold paths */
typedef struct sts_array { uint64_t len; uint64_t cap; char *data; } sts_array;

/* Host entry (WP8): a fresh array of `len` elements, uninitialised, len == cap. */
sts_array *sts_alloc_array(uint64_t elem_size, uint64_t len) {
  sts_array *a = (sts_array *)sts_alloc_struct(sizeof *a);
  a->len = a->cap = len;
  a->data = (char *)sts_alloc_struct(len * elem_size);
  return a;
}

/* push() when len == cap: double the capacity (4 from empty). */
void sts_array_grow(sts_array *a, uint64_t elem_size) {
  uint64_t cap = a->cap ? a->cap * 2 : 4;
  char *data = (char *)sts_alloc_struct(cap * elem_size);
  if (a->len) memcpy(data, a->data, a->len * elem_size);
  a->data = data;
  a->cap = cap;
}

/* "index out of range: <idx> >= <len>" on stderr, exit 1. */
void sts_panic_index(uint64_t idx, uint64_t len) {
  char tmp[72];
  char *p = tmp + sizeof tmp;
  *--p = '\n';
  do { *--p = (char)('0' + len % 10); len /= 10; } while (len);
  *--p = ' '; *--p = '='; *--p = '>'; *--p = ' ';
  do { *--p = (char)('0' + idx % 10); idx /= 10; } while (idx);
  (void)!write(2, "index out of range: ", 20);
  (void)!write(2, p, (size_t)(tmp + sizeof tmp - p));
  _exit(1);
}

/* ---- Checked integer division: Rust-style panic instead of sdiv/srem poison */
void sts_panic_div(_Bool by_zero) {
  const char *m = by_zero ? "attempt to divide by zero\n" : "attempt to divide with overflow\n";
  (void)!write(2, m, strlen(m));
  _exit(1);
}

