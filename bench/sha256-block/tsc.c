/*
 * The TSC's frequency, which bench/sha256-block/run.mjs turns ns into
 * cycles with: rdtsc read around a CLOCK_MONOTONIC interval of `ms`
 * milliseconds (default 500), best of five. Prints `tsc_hz N` on stdout.
 * perf is not on every machine this runs on; rdtsc is on every x86-64.
 * TSC cycles count at the TSC's fixed rate, not the core's: under turbo a
 * core runs more of its own cycles in one TSC cycle.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <x86intrin.h>

static int64_t now_ns(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (int64_t)t.tv_sec * 1000000000 + t.tv_nsec;
}

int main(int argc, char **argv) {
  long ms = argc > 1 ? atol(argv[1]) : 500;
  double best = 0;
  for (int k = 0; k < 5; k++) {
    int64_t t0 = now_ns();
    uint64_t c0 = __rdtsc();
    while (now_ns() - t0 < ms * 1000000) {
    }
    uint64_t c1 = __rdtsc();
    int64_t t1 = now_ns();
    double hz = (double)(c1 - c0) * 1e9 / (double)(t1 - t0);
    if (k == 0 || hz > best) {
      best = hz;
    }
  }
  printf("tsc_hz %.0f\n", best);
  return 0;
}
