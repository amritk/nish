/* AmritScript runtime: arena + strings + cold paths. Layouts are ABI (runtime.ts, amritc.h). */
#define _POSIX_C_SOURCE 200809L
#include <fcntl.h>
#include <inttypes.h>
#include <math.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#ifndef __wasi__
/* WASI has no processes, so `spawn.h` and `wait.h` do not exist there. */
#include <spawn.h>
#include <sys/wait.h>
extern char **environ;
#endif

#ifdef __wasi__
/* No pids on WASI: clock nanoseconds salt the RNG seed instead. */
static int amrit_wasi_salt(void) { struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts); return ts.tv_nsec; }
#define getpid amrit_wasi_salt
/* wasi-libc's `_start` calls `__main_argc_argv` (clang's name for a C `main`); the IR entry is
 * `main`. Weak, so a reactor build without an entry links. */
__attribute__((weak)) int amrit_c_main(int, char **) __asm__("main");
int __main_argc_argv(int argc, char **argv) { return amrit_c_main(argc, argv); }
#endif

#define AMRIT_COLD __attribute__((noreturn, cold, noinline))

/* ---- Arena: %struct.amrit_arena = type { i8*, i64, i64, i8* }

   The widths are fixed rather than `size_t` for the reason runtime_wasm.c
   gives for its own copy: every compiled function inlines the bump allocator
   and reads these fields directly, so the IR's `i64` is what `off` and `cap`
   have to be on every target, not just the 64-bit ones. With `size_t` they
   were four bytes each under wasm32 and the inlined fast path bumped an
   offset that was really `cap`, then compared it against memory past the end
   of the global — a wild pointer on the wasi profile for any program that
   allocates from compiled code. The asserts below are the contract, checked
   wherever this file is compiled. */
typedef struct amrit_chunk { struct amrit_chunk *next; uint64_t cap; } amrit_chunk;
struct amrit_arena { char *buf; uint64_t off; uint64_t cap; amrit_chunk *chunks; };
struct amrit_arena amrit_arena;

_Static_assert(sizeof(struct amrit_arena) == 32, "arena layout is ABI: runtime.ts, amritc.h");
_Static_assert(offsetof(struct amrit_arena, off) == 8, "the inlined allocator bumps field 1");
_Static_assert(offsetof(struct amrit_arena, cap) == 16, "the inlined allocator reads field 2");
_Static_assert(offsetof(struct amrit_arena, chunks) == 24, "arena layout is ABI");

static AMRIT_COLD void amrit_die(const char *msg) {
  (void)!write(2, msg, strlen(msg));
  _exit(1);
}
#define amrit_oom() amrit_die("amritc: out of memory\n")

/* Slow path (size 8-byte rounded): push a chunk (>= 64 KB), bump from it. */
void *amrit_arena_grow(uint64_t size) {
  uint64_t cap = size > 65536 ? size : 65536;
  /* A 64-bit request cannot always be asked for: wasm32's `size_t` is 32 bits,
     and malloc would silently take the low half of a chunk nobody can address. */
  if (cap > (uint64_t)(SIZE_MAX - sizeof(amrit_chunk))) amrit_oom();
  amrit_chunk *c = malloc(sizeof *c + (size_t)cap);
  if (!c) amrit_oom();
  c->next = amrit_arena.chunks;
  c->cap = cap;
  amrit_arena.chunks = c;
  amrit_arena.buf = (char *)(c + 1);
  amrit_arena.off = size;
  amrit_arena.cap = cap;
  return amrit_arena.buf;
}

/* Bump allocation, 8-byte rounded/aligned, uninitialised; the compiler inlines it. */
void *amrit_alloc_struct(uint64_t size) {
  size = (size + 7) & ~(uint64_t)7;
  if (amrit_arena.off + size <= amrit_arena.cap) {
    void *p = amrit_arena.buf + amrit_arena.off;
    amrit_arena.off += size;
    return p;
  }
  return amrit_arena_grow(size);
}

static void amrit_free_until(amrit_chunk *c, const amrit_chunk *end) {
  while (c != end) { amrit_chunk *n = c->next; free(c); c = n; }
}

/* O(1) recycle: keep the newest chunk, free the rest. */
void amrit_reset_arena(void) {
  amrit_chunk *keep = amrit_arena.chunks;
  if (!keep) return;
  amrit_free_until(keep->next, 0);
  keep->next = 0;
  amrit_arena.off = 0;
}

void amrit_free_arena(void) {
  amrit_free_until(amrit_arena.chunks, 0);
  memset(&amrit_arena, 0, sizeof amrit_arena);
}

/* ---- Scopes: mark = buf + off (0 while empty); release rewinds, freeing newer chunks. */
uint64_t amrit_arena_mark(void) {
  return amrit_arena.buf ? (uintptr_t)(amrit_arena.buf + amrit_arena.off) : 0;
}
uint64_t amrit_arena_used(void) { return amrit_arena.off; }

void amrit_arena_release(uint64_t mark) {
  amrit_chunk *c = amrit_arena.chunks;
  if (!mark) { amrit_reset_arena(); return; }
  for (; c; c = c->next) {
    uintptr_t base = (uintptr_t)(c + 1);
    if (mark >= base && mark <= base + c->cap) break;
  }
  if (!c) return;
  amrit_free_until(amrit_arena.chunks, c);
  amrit_arena = (struct amrit_arena){ (char *)(c + 1), mark - (uintptr_t)(c + 1), c->cap, c };
}

/* Release back to `mark` while keeping the newest allocation; returns where it
   ended up. `p` must be the last block the arena handed out, which is why only
   a *string* may be kept: it is one flat block with no interior pointers, so
   moving its bytes moves the whole value. Two outcomes, both reclaiming only
   memory bumped after `mark` and before `p`:
     - the mark's chunk has room below it: `p` moves down to `mark` and every
       newer chunk is freed;
     - it does not (the mark sat at the end of a full chunk): `p` stays where
       it is and the chunks strictly between the two are freed.
   The guards refuse instead, which only means less is reclaimed: `p` outside
   the current chunk (a literal, or a value older than the mark), a mark in no
   live chunk (a stale one, or 0 for an arena that was empty), or a mark newer
   than `p`. */
void *amrit_arena_keep(uint64_t mark, void *p) {
  uintptr_t base = (uintptr_t)amrit_arena.buf, q = (uintptr_t)p, top = base + amrit_arena.off;
  if (q < base || q >= top || mark == q) return p;
  size_t size = top - q;
  amrit_chunk *pc = amrit_arena.chunks, *c = pc; /* pc holds `p`: it is the current chunk */
  for (; c; c = c->next) {
    uintptr_t cb = (uintptr_t)(c + 1);
    if (mark >= cb && mark <= cb + c->cap) break;
  }
  if (!c || (c == pc && mark > q)) return p;
  /* mark <= q inside one chunk implies mark + size <= q + size <= its end, so
     the second arm is only ever reached with `c` older than `pc`. */
  if (mark + size <= (uintptr_t)(c + 1) + c->cap) {
    memmove((void *)mark, p, size);
    amrit_free_until(pc, c);
    amrit_arena = (struct amrit_arena){ (char *)(c + 1), mark + size - (uintptr_t)(c + 1), c->cap, c };
    return (void *)mark;
  }
  amrit_free_until(pc->next, c);
  pc->next = c;
  return p;
}

/* ---- Strings: { i64 len, bytes[len], '\0' }, immutable; 8 = the len header */
typedef struct { uint64_t len; char data[]; } amrit_str;

amrit_str *amrit_str_new(const char *bytes, uint64_t len) {
  amrit_str *s = amrit_alloc_struct(8 + len + 1);
  s->len = len;
  if (len) memcpy(s->data, bytes, len);
  s->data[len] = 0;
  return s;
}

amrit_str *amrit_str_concat(const amrit_str *a, const amrit_str *b) {
  amrit_str *s = amrit_alloc_struct(8 + a->len + b->len + 1);
  s->len = a->len + b->len;
  memcpy(s->data, a->data, a->len);
  memcpy(s->data + a->len, b->data, b->len);
  s->data[s->len] = 0;
  return s;
}

_Bool amrit_str_eq(const amrit_str *a, const amrit_str *b) {
  return a == b || (a->len == b->len && memcmp(a->data, b->data, a->len) == 0);
}

uint64_t amrit_str_len(const amrit_str *s) { return s->len; }

/* `s.startsWith(sub)` is at 0, `s.endsWith(sub)` at len - sub->len, which is
   negative when `sub` is the longer string. */
_Bool amrit_str_at(const amrit_str *s, int64_t at, const amrit_str *sub) {
  return at >= 0 && (uint64_t)at + sub->len <= s->len && !memcmp(s->data + at, sub->data, sub->len);
}
/* `console.log` / `console.error` / `write` / `writeError` and the message of
   `panic`: fd 1 or 2, with or without the trailing newline. */
void amrit_write(const amrit_str *s, int32_t fd, _Bool newline) {
  (void)!write(fd, s->data, s->len);
  if (newline) (void)!write(fd, "\n", 1);
}
/* console.log(s) */
void amrit_print(const amrit_str *s) { amrit_write(s, 1, 1); }

/* Decimal digits of `u`, with a '-' in front when `neg`. 20 digits is the
   widest a uint64_t can be, plus the sign. */
static amrit_str *str_from_digits(uint64_t u, int neg) {
  char tmp[21], *p = tmp + 21;
  do { *--p = '0' + u % 10; u /= 10; } while (u);
  if (neg) *--p = '-';
  return amrit_str_new(p, tmp + 21 - p);
}

amrit_str *amrit_str_from_i64(int64_t v) {
  return str_from_digits(v < 0 ? -(uint64_t)v : (uint64_t)v, v < 0);
}
amrit_str *amrit_str_from_i32(int32_t v) { return amrit_str_from_i64(v); }
/* The one unsigned formatter (WP15): u8/u16/u32 are zero-extended by the
   caller, so 0xFFFFFFFF prints as 4294967295 rather than -1. */
amrit_str *amrit_str_from_u64(uint64_t v) { return str_from_digits(v, 0); }

/* JS Number#toString: shortest round-trip digits, e-form outside (-6, 21] */
amrit_str *amrit_str_from_f64(double v) {
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
  return amrit_str_new(out, o - out);
}

/* ---- Math.random: xorshift64*, seeded lazily from time and pid */
static uint64_t amrit_rng;

double amrit_random(void) {
  uint64_t x = amrit_rng ? amrit_rng : ((uint64_t)time(0) << 32) ^ getpid() ^ 0x9E3779B97F4A7C15ull;
  x ^= x >> 12; x ^= x << 25; x ^= x >> 27;
  amrit_rng = x;
  return (double)((x * 0x2545F4914F6CDD1Dull) >> 11) * (1.0 / 9007199254740992.0);
}

/* ---- Process and files */
void amrit_exit(int32_t code) { exit(code); }
static AMRIT_COLD void amrit_io_fail(const char *what, const amrit_str *path) {
  dprintf(2, "amritc: cannot %s%.*s\n", what, (int)path->len, path->data);
  _exit(1);
}

/* `readFileSyncOrNull(path)`: null rather than a message, so a program can
   turn a missing file into its own diagnostic and carry on. */
amrit_str *amrit_read_file_or_null(const amrit_str *path) {
  int fd = open(path->data, O_RDONLY);
  off_t len = fd < 0 ? -1 : lseek(fd, 0, SEEK_END);
  if (len < 0) return 0;
  amrit_str *s = amrit_alloc_struct(8 + len + 1);
  uint64_t got = 0;
  ssize_t n;
  while ((n = pread(fd, s->data + got, len - got, got)) > 0) got += n;
  close(fd);
  s->len = got;
  s->data[got] = 0;
  return s;
}

amrit_str *amrit_read_file(const amrit_str *path) {
  amrit_str *s = amrit_read_file_or_null(path);
  if (!s) amrit_io_fail("read ", path);
  return s;
}

static void amrit_put_file(const amrit_str *path, const amrit_str *data, int flags) {
  int fd = open(path->data, O_WRONLY | O_CREAT | flags, 0644);
  if (fd < 0) amrit_io_fail("write ", path);
  for (uint64_t done = 0; done < data->len;) {
    ssize_t n = write(fd, data->data + done, data->len - done);
    if (n <= 0) amrit_io_fail("write ", path);
    done += n;
  }
  close(fd);
}
void amrit_write_file(const amrit_str *path, const amrit_str *data) { amrit_put_file(path, data, O_TRUNC); }
void amrit_append_file(const amrit_str *path, const amrit_str *data) { amrit_put_file(path, data, O_APPEND); }

/* ---- Arrays: %struct.amrit_array = type { i64, i64, i8* }, cold paths */
typedef struct amrit_array { uint64_t len; uint64_t cap; char *data; } amrit_array;

/* Host entry (WP8): `len` uninitialised elements, len == cap */
amrit_array *amrit_alloc_array(uint64_t elem_size, uint64_t len) {
  amrit_array *a = amrit_alloc_struct(sizeof *a);
  *a = (amrit_array){ len, len, amrit_alloc_struct(len * elem_size) };
  return a;
}

/* process.argv: malloc, not the arena, so Arena.reset() cannot free it. Built once by @main. */
amrit_array *amrit_argv;

void amrit_argv_init(int32_t argc, char **argv) {
  amrit_array *a = malloc(sizeof *a + argc * sizeof(amrit_str *));
  amrit_str **d = (amrit_str **)(a + 1);
  if (!a) amrit_oom();
  *a = (amrit_array){ argc, argc, (char *)d };
  amrit_argv = a;
  while (argc-- > 0) {
    size_t len = strlen(*argv);
    amrit_str *s = malloc(8 + len + 1);
    if (!s) amrit_oom();
    s->len = len;
    strcpy(s->data, *argv++);
    *d++ = s;
  }
}

/* ---- Directories and subprocesses (WP14 D4): what a driver needs to create
   its own output directory and shell out for `--link`. Both answer a value
   instead of exiting, as `amrit_read_file_or_null` does — there are no
   exceptions, so the caller owns the diagnostic — and so does the `stat`
   beside them (WP14 §7a), which is what tells `-o <dir>` from `-o <file>`.
   Contracts: amritc.h. */

/* `isDirectorySync(path)` (WP14 §7a): the one question a driver asks of a path
   it was handed — is there a directory here? A missing path, a plain file and
   a parent it cannot search are the same false, because they are the same
   answer to that question. */
_Bool amrit_is_dir(const amrit_str *path) {
  struct stat st;
  return stat(path->data, &st) == 0 && S_ISDIR(st.st_mode);
}

/* One directory, not recursive. The retry is the `stat` above rather than
   `errno == EEXIST` so that a plain file at the path answers false, which is
   what the promise "a directory is there afterwards" means. */
_Bool amrit_mkdir(const amrit_str *path) {
  return mkdir(path->data, 0777) == 0 || amrit_is_dir(path);
}

/* `posix_spawnp` is one libc call where fork/execvp/waitpid would be three,
   it searches PATH, and glibc reports a failed exec through its return
   value rather than through a child that has already run. */
int32_t amrit_spawn(const amrit_array *argv) {
#ifdef __wasi__
  (void)argv;
  return -1;
#else
  if (!argv->len) return -1; /* argv[0] would read past an empty array */
  amrit_str **s = (amrit_str **)argv->data;
  /* NULL-terminated, borrowing each string's bytes; the arena owns it, so no
     path out of here has anything to free. */
  char **v = amrit_alloc_struct((argv->len + 1) * sizeof *v);
  uint64_t i = 0;
  for (; i < argv->len; i++) v[i] = s[i]->data;
  v[i] = 0;
  pid_t pid;
  int status;
  if (posix_spawnp(&pid, v[0], 0, 0, v, environ)) return -1;
  if (waitpid(pid, &status, 0) < 0) return -1;
  return WIFSIGNALED(status) ? 128 + WTERMSIG(status) : WEXITSTATUS(status);
#endif
}

/* ---- The environment (WP19 R1): `getenv(name)`, the one environment read the
   language has. A driver needs it to honour `CC` the way `scripts/build.sh`
   does before it spawns that script, which is the whole reason it exists.

   The bytes are copied into the arena rather than handed back where libc put
   them: `getenv` answers a pointer into `environ`, and a later `setenv` in the
   same process may move or overwrite that block, so a string the program is
   still holding would change under it. Copying makes it an ordinary arena
   string with the lifetime every other one has. NULL for an unset variable,
   which is the language's `string | null`. Contract: amritc.h. */
amrit_str *amrit_getenv(const amrit_str *name) {
  const char *v = getenv(name->data);
  if (!v) return 0;
  uint64_t len = strlen(v);
  amrit_str *s = amrit_alloc_struct(8 + len + 1);
  s->len = len;
  memcpy(s->data, v, len + 1);
  return s;
}

/* ---- What machine this is (WP14 §7a): `process.platform` and `process.arch`,
   the two halves `--target host` composes a triple from. Both are settled when
   this file is compiled — a cross build compiles the runtime for the target,
   so the answer is the target's — which is why each is a string in constant
   data handed back by address: no allocation and no load, and `readnone` on
   the declaration (src/codegen/runtime.ts) is a fact rather than a hope. The
   spellings are Node's, so a program reads the same answer from this runtime
   and from `runtime/shim.mjs`; anything neither branch names is "unknown",
   which is what `--target host` then refuses. Contracts: amritc.h.

   The static object is spelled with a sized array because a flexible array
   member cannot be initialised, and handed out as an `amrit_str *`: the two
   layouts are the same bytes, and nothing anywhere writes through either
   pointer, so there is no aliasing question to answer. */
#define AMRIT_TEXT(name, s) \
  static const struct { uint64_t len; char data[sizeof s]; } name = { sizeof s - 1, s }

#if defined(__APPLE__)
AMRIT_TEXT(amrit_platform_text, "darwin");
#elif defined(__linux__)
AMRIT_TEXT(amrit_platform_text, "linux");
#else
AMRIT_TEXT(amrit_platform_text, "unknown");
#endif

#if defined(__x86_64__)
AMRIT_TEXT(amrit_arch_text, "x64");
#elif defined(__aarch64__)
AMRIT_TEXT(amrit_arch_text, "arm64");
#else
AMRIT_TEXT(amrit_arch_text, "unknown");
#endif

const amrit_str *amrit_platform(void) { return (const amrit_str *)&amrit_platform_text; }
const amrit_str *amrit_arch(void) { return (const amrit_str *)&amrit_arch_text; }

/* ---- String to number: mode 0 parseFloat, 1 Number, 2 parseInt (contract: amritc.h). ASCII
 * whitespace only; strtod parses once the inf/nan spellings JS rejects are ruled out, and its `0x`
 * hex stays accepted (documented). */
#define AMRIT_SPACES " \t\n\v\f\r"

double amrit_parse_number(const amrit_str *s, int32_t mode) {
  const char *p, *q, *stop;
  char *end;
  double v;
  if (mode == 2) return strtoll(s->data, 0, 10);
  p = s->data + strspn(s->data, AMRIT_SPACES);
  q = p + (*p == '+' || *p == '-');
  stop = s->data + s->len;
  if (!((*q >= '0' && *q <= '9') || *q == '.' || strncmp(q, "Infinity", 8) == 0)) return mode && p == stop ? 0 : NAN;
  v = strtod(p, &end);
  if (end == p) return NAN; /* "." alone */
  return mode && end + strspn(end, AMRIT_SPACES) != stop ? NAN : v;
}

/* push() when len == cap: double the capacity (4 from empty). */
void amrit_array_grow(amrit_array *a, uint64_t elem_size) {
  uint64_t cap = a->cap ? a->cap * 2 : 4;
  char *data = amrit_alloc_struct(cap * elem_size);
  if (a->len) memcpy(data, a->data, a->len * elem_size);
  a->data = data;
  a->cap = cap;
}

void amrit_panic_index(uint64_t idx, uint64_t len) {
  dprintf(2, "index out of range: %" PRIu64 " >= %" PRIu64 "\n", idx, len);
  _exit(1);
}

/* ---- Checked division (Rust semantics): the failed-check path */
void amrit_panic_div(_Bool by_zero) {
  amrit_die(by_zero ? "attempt to divide by zero\n" : "attempt to divide with overflow\n");
}
