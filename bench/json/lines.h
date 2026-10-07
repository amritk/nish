/* The part of every C and C++ twin that is not timed: read the whole input and
 * cut it into lines. The buffer keeps `pad` zero bytes past the end because
 * simdjson reads up to SIMDJSON_PADDING bytes beyond a document; the others
 * ignore them. */
#ifndef BENCH_JSON_LINES_H
#define BENCH_JSON_LINES_H
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

typedef struct {
  char *text;
  size_t size;
  size_t count;
  size_t *start;
  size_t *length;
} bench_lines;

static inline bench_lines bench_read_lines(const char *path, size_t pad) {
  bench_lines out = {0};
  FILE *f = fopen(path, "rb");
  if (!f) {
    perror(path);
    exit(1);
  }
  fseek(f, 0, SEEK_END);
  out.size = (size_t)ftell(f);
  fseek(f, 0, SEEK_SET);
  out.text = (char *)calloc(out.size + pad + 1, 1);
  if (fread(out.text, 1, out.size, f) != out.size) {
    perror(path);
    exit(1);
  }
  fclose(f);
  size_t cap = 1024;
  out.start = (size_t *)malloc(cap * sizeof(size_t));
  out.length = (size_t *)malloc(cap * sizeof(size_t));
  size_t at = 0;
  while (at < out.size) {
    const char *nl = (const char *)memchr(out.text + at, '\n', out.size - at);
    size_t end = nl ? (size_t)(nl - out.text) : out.size;
    if (end > at) {
      if (out.count == cap) {
        cap *= 2;
        out.start = (size_t *)realloc(out.start, cap * sizeof(size_t));
        out.length = (size_t *)realloc(out.length, cap * sizeof(size_t));
      }
      out.start[out.count] = at;
      out.length[out.count] = end - at;
      out.count++;
    }
    at = end + 1;
  }
  return out;
}

static inline int64_t bench_nanos(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (int64_t)ts.tv_sec * 1000000000 + ts.tv_nsec;
}

#define BENCH_MASK 1073741823
#endif
