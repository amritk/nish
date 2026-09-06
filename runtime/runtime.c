/* StaticTS runtime: bump/arena allocator + length-prefixed UTF-8 strings.
 * No GC, no stdio on the hot path. Layouts here are ABI: they must match
 * the declarations emitted by src/codegen/runtime.ts. */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/* ---- Arena ------------------------------------------------------------- */
typedef struct sts_chunk { struct sts_chunk *next; size_t cap; } sts_chunk;

/* Must match %struct.sts_arena = type { i8*, i64, i64, i8* } in the IR.
 * The compiler inlines the bump fast path against this global directly. */
struct sts_arena { char *buf; size_t off; size_t cap; sts_chunk *chunks; };
struct sts_arena sts_arena = { 0, 0, 0, 0 };

#define STS_ALIGN(n) (((n) + (size_t)7) & ~(size_t)7)
#define STS_CHUNK_MIN ((size_t)64 * 1024)

static void sts_die(const char *msg) {
  (void)!write(2, msg, strlen(msg));
  _exit(1);
}

/* Slow path, called only when the current chunk cannot satisfy `size`
 * (already 8-byte rounded). Pushes a fresh chunk and bumps from it. */
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

/* Bump allocation: 8-byte aligned, uninitialised, one compare + one add. */
void *sts_alloc_struct(size_t size) {
  size = STS_ALIGN(size);
  if (sts_arena.off + size <= sts_arena.cap) {
    void *p = sts_arena.buf + sts_arena.off;
    sts_arena.off += size;
    return p;
  }
  return sts_arena_grow(size);
}

/* Recycle everything in O(1): keep the newest (largest) chunk, drop the rest.
 * After a few resets the arena stops calling malloc entirely. */
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
  sts_arena.buf = 0; sts_arena.off = 0; sts_arena.cap = 0; sts_arena.chunks = 0;
}

/* ---- Strings ----------------------------------------------------------- */
/* An `i8*` string points at this header: { i64 len, bytes[len], '\0' }.
 * Literals are emitted as constants with the same layout; heap strings live
 * in the arena. Strings are immutable, so sharing is always safe. */
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

/* console.log(s): one write syscall, no stdio buffering to drag in. */
void sts_print(const sts_str *s) {
  (void)!write(1, s->data, s->len);
  (void)!write(1, "\n", 1);
}

sts_str *sts_str_from_i32(int32_t v) {
  char tmp[12]; /* "-2147483648" */
  char *p = tmp + sizeof tmp;
  uint32_t u = v < 0 ? 0u - (uint32_t)v : (uint32_t)v;
  do { *--p = (char)('0' + u % 10); u /= 10; } while (u);
  if (v < 0) *--p = '-';
  return sts_str_new(p, (uint64_t)(tmp + sizeof tmp - p));
}

sts_str *sts_str_from_f64(double v) {
  char tmp[32];
  int n = snprintf(tmp, sizeof tmp, "%.17g", v);
  return sts_str_new(tmp, n > 0 ? (uint64_t)n : 0);
}
