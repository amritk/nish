/* C twin of strbuild.ts with the AmritScript memory model: length-prefixed
 * immutable strings, every one a fresh bump-arena allocation (64 KB chunks,
 * never freed), the same 32-way join tree. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define N 131072 /* bench:n */
#define FANOUT 32

typedef struct { uint64_t len; char data[]; } str;

static char *arena_buf;
static size_t arena_off, arena_cap;

static void *arena_alloc(size_t size) {
  size = (size + 7) & ~(size_t)7;
  if (arena_off + size > arena_cap) {
    arena_cap = size > 65536 ? size : 65536;
    arena_buf = malloc(arena_cap); /* old chunks are abandoned, as sts_arena_grow does */
    arena_off = 0;
  }
  void *p = arena_buf + arena_off;
  arena_off += size;
  return p;
}

static str *str_new(const char *bytes, uint64_t len) {
  str *s = arena_alloc(sizeof(uint64_t) + len + 1);
  s->len = len;
  memcpy(s->data, bytes, len);
  s->data[len] = 0;
  return s;
}

static str *str_concat(const str *a, const str *b) {
  str *s = arena_alloc(sizeof(uint64_t) + a->len + b->len + 1);
  s->len = a->len + b->len;
  memcpy(s->data, a->data, a->len);
  memcpy(s->data + a->len, b->data, b->len);
  s->data[s->len] = 0;
  return s;
}

static str *piece(int32_t i) {
  char tmp[16];
  int n = snprintf(tmp, sizeof tmp, "%d,", i);
  return str_new(tmp, (uint64_t)n);
}

static str *join(int32_t lo, int32_t hi) {
  int32_t count = hi - lo;
  if (count <= FANOUT) {
    str *s = str_new("", 0);
    for (int32_t i = lo; i < hi; i++) {
      s = str_concat(s, piece(i));
    }
    return s;
  }
  int32_t step = (count + FANOUT - 1) / FANOUT;
  str *s = str_new("", 0);
  for (int32_t start = lo; start < hi; start += step) {
    int32_t end = start + step < hi ? start + step : hi;
    s = str_concat(s, join(start, end));
  }
  return s;
}

int main(void) {
  str *s = join(0, N);
  printf("%llu\n", (unsigned long long)s->len);
  return 0;
}
