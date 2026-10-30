// The C twin of main.ts: one-shot gzip of the same body with zlib (a reused
// z_stream, deflateReset between calls) and libdeflate (a reused compressor),
// at level 1 and level 6, and gunzip back: each library's own output, or the
// gzip -1 and gzip -6 streams argv[3] and argv[4] name. Same arguments and
// row format as main.ts.
// libdeflate's header is not always installed beside its library, so the four
// functions used are declared here; build.mjs links the shared object.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <zlib.h>

struct libdeflate_compressor;
struct libdeflate_decompressor;
struct libdeflate_compressor *libdeflate_alloc_compressor(int level);
size_t libdeflate_gzip_compress(struct libdeflate_compressor *c, const void *in, size_t n, void *out, size_t avail);
struct libdeflate_decompressor *libdeflate_alloc_decompressor(void);
int libdeflate_gzip_decompress(struct libdeflate_decompressor *d, const void *in, size_t n, void *out, size_t avail,
                               size_t *actual);

static long long now(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (long long)t.tv_sec * 1000000000LL + t.tv_nsec;
}

static size_t zlib_gzip(z_stream *s, const unsigned char *in, size_t n, unsigned char *out, size_t avail) {
  deflateReset(s);
  s->next_in = (unsigned char *)in;
  s->avail_in = (uInt)n;
  s->next_out = out;
  s->avail_out = (uInt)avail;
  if (deflate(s, Z_FINISH) != Z_STREAM_END) abort();
  return avail - s->avail_out;
}

static size_t zlib_gunzip(z_stream *s, const unsigned char *in, size_t n, unsigned char *out, size_t avail) {
  inflateReset(s);
  s->next_in = (unsigned char *)in;
  s->avail_in = (uInt)n;
  s->next_out = out;
  s->avail_out = (uInt)avail;
  if (inflate(s, Z_FINISH) != Z_STREAM_END) abort();
  return avail - s->avail_out;
}

int main(int argc, char **argv) {
  const char *path = argc > 1 ? argv[1] : "bench/gzip/feed.json";
  int calls = argc > 2 ? atoi(argv[2]) : 20000;
  FILE *f = fopen(path, "rb");
  if (!f) return 1;
  static unsigned char body[1 << 24], out[1 << 24], back[1 << 24], given[2][1 << 20];
  size_t n = fread(body, 1, sizeof body, f);
  fclose(f);
  size_t givenLen[2] = {0, 0};
  for (int k = 0; argc > 4 && k < 2; k++) {
    FILE *g = fopen(argv[3 + k], "rb");
    if (!g) return 1;
    givenLen[k] = fread(given[k], 1, sizeof given[k], g);
    fclose(g);
  }
  int levels[2] = {1, 6};
  for (int k = 0; k < 2; k++) {
    int level = levels[k];
    z_stream s;
    memset(&s, 0, sizeof s);
    deflateInit2(&s, level, Z_DEFLATED, 31, 8, Z_DEFAULT_STRATEGY);
    size_t end = 0;
    for (int i = 0; i < 200; i++) end = zlib_gzip(&s, body, n, out, sizeof out);
    long long t = now();
    for (int i = 0; i < calls; i++) end = zlib_gzip(&s, body, n, out, sizeof out);
    printf("zlib gzip -%d %zu %zu %lld %d\n", level, n, end, now() - t, calls);
    const unsigned char *stream = givenLen[k] ? given[k] : out;
    size_t streamLen = givenLen[k] ? givenLen[k] : end;
    z_stream d;
    memset(&d, 0, sizeof d);
    inflateInit2(&d, 31);
    t = now();
    for (int i = 0; i < calls; i++) zlib_gunzip(&d, stream, streamLen, back, sizeof back);
    printf("zlib gunzip -%d %zu %zu %lld %d\n", level, n, streamLen, now() - t, calls);
    deflateEnd(&s);
    inflateEnd(&d);

    struct libdeflate_compressor *c = libdeflate_alloc_compressor(level);
    for (int i = 0; i < 200; i++) end = libdeflate_gzip_compress(c, body, n, out, sizeof out);
    t = now();
    for (int i = 0; i < calls; i++) end = libdeflate_gzip_compress(c, body, n, out, sizeof out);
    printf("libdeflate gzip -%d %zu %zu %lld %d\n", level, n, end, now() - t, calls);
    stream = givenLen[k] ? given[k] : out;
    streamLen = givenLen[k] ? givenLen[k] : end;
    struct libdeflate_decompressor *dd = libdeflate_alloc_decompressor();
    size_t got = 0;
    t = now();
    for (int i = 0; i < calls; i++) {
      if (libdeflate_gzip_decompress(dd, stream, streamLen, back, sizeof back, &got) != 0 || got != n) abort();
    }
    printf("libdeflate gunzip -%d %zu %zu %lld %d\n", level, n, streamLen, now() - t, calls);
  }
  return 0;
}
