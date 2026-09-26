/* The "naive" twin of strbuild.ts: the same immutable-string algorithm, but
 * every string is its own malloc and is freed as soon as it has been copied
 * into its successor (what a reference-counted or manually managed string
 * would do). Measures what the arena saves: one malloc/free pair per string. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define N 131072 /* bench:n */
#define FANOUT 32

typedef struct { uint64_t len; char data[]; } str;

static str *str_new(const char *bytes, uint64_t len) {
  str *s = malloc(sizeof(uint64_t) + len + 1);
  s->len = len;
  memcpy(s->data, bytes, len);
  s->data[len] = 0;
  return s;
}

/* Concatenate and release both inputs. */
static str *str_concat(str *a, str *b) {
  str *s = malloc(sizeof(uint64_t) + a->len + b->len + 1);
  s->len = a->len + b->len;
  memcpy(s->data, a->data, a->len);
  memcpy(s->data + a->len, b->data, b->len);
  s->data[s->len] = 0;
  free(a);
  free(b);
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
  free(s);
  return 0;
}
