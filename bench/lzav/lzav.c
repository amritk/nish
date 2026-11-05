// The C twin of main.ts: upstream LZAV (`lzav.h`, which run.mjs fetches at a
// pinned commit) and libdeflate's raw DEFLATE at level 1, a reused compressor
// and buffers, each way. Same arguments and row format as main.ts.
// libdeflate's header is not always installed beside its library, so the four
// functions used are declared here; run.mjs links the shared object.
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#include "lzav.h"

struct libdeflate_compressor;
struct libdeflate_decompressor;
struct libdeflate_compressor *libdeflate_alloc_compressor(int level);
size_t libdeflate_deflate_compress(struct libdeflate_compressor *c, const void *in, size_t n, void *out, size_t avail);
struct libdeflate_decompressor *libdeflate_alloc_decompressor(void);
int libdeflate_deflate_decompress(struct libdeflate_decompressor *d, const void *in, size_t n, void *out, size_t avail,
                                  size_t *actual);

static long long now(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (long long)t.tv_sec * 1000000000LL + t.tv_nsec;
}

int main(int argc, char **argv) {
  const char *path = argc > 1 ? argv[1] : "bench/gzip/feed.json";
  int calls = argc > 2 ? atoi(argv[2]) : 20000;
  FILE *f = fopen(path, "rb");
  if (!f) return 1;
  static unsigned char body[1 << 24], out[(1 << 24) + (1 << 20)], back[1 << 24];
  int n = (int)fread(body, 1, sizeof body, f);
  fclose(f);
  int bound = lzav_compress_bound(n);
  int end = 0;
  for (int i = 0; i < 20; i++) end = lzav_compress_default(body, out, n, bound);
  long long t = now();
  for (int i = 0; i < calls; i++) end = lzav_compress_default(body, out, n, bound);
  printf("c lzav compress %d %d %lld %d\n", n, end, now() - t, calls);
  int got = 0;
  t = now();
  for (int i = 0; i < calls; i++) got = lzav_decompress(out, back, end, n);
  if (got != n) return 2;
  printf("c lzav decompress %d %d %lld %d\n", n, end, now() - t, calls);

  struct libdeflate_compressor *c = libdeflate_alloc_compressor(1);
  struct libdeflate_decompressor *d = libdeflate_alloc_decompressor();
  size_t dend = 0;
  for (int i = 0; i < 20; i++) dend = libdeflate_deflate_compress(c, body, n, out, sizeof out);
  t = now();
  for (int i = 0; i < calls; i++) dend = libdeflate_deflate_compress(c, body, n, out, sizeof out);
  printf("libdeflate deflate-1 compress %d %zu %lld %d\n", n, dend, now() - t, calls);
  size_t actual = 0;
  t = now();
  for (int i = 0; i < calls; i++) {
    if (libdeflate_deflate_decompress(d, out, dend, back, n, &actual) != 0) return 3;
  }
  printf("libdeflate deflate-1 decompress %d %zu %lld %d\n", n, dend, now() - t, calls);
  return 0;
}
