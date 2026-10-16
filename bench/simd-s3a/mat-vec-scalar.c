/* Adapted from the Computer Language Benchmarks Game spectral-norm program
   (Node.js #1, contributed by Ian Osgood, modified by Isaac Gouy),
   https://benchmarksgame-team.pages.debian.net/benchmarksgame/.
   Copyright (c) 2004-2008 Brent Fulgham, 2005-2025 Isaac Gouy.
   Revised BSD licence; see bench/LICENSE-benchmarksgame.md. */
/* WP38 S3a, mat-vec form 2: mat-vec-checked.ts in scalar C, the same four
   accumulators in the same order, so a ratio against the vector form is the
   vectors' gain and not C against Nish (docs/wp38-simd.md §2.3). Timed by
   bench/simd-s3a.mjs, built with -ffp-contract=off as Nish never contracts. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define N 2000
#define ROUNDS 100

/* 1 / A's denominator, wrapping as the vector form's i32 lanes do. */
static double a(int32_t i, int32_t j) {
  uint32_t ij = (uint32_t)i + (uint32_t)j;
  int32_t d = (int32_t)(ij * (ij + 1u)) / 2;
  return 1 / (double)(int32_t)((uint32_t)d + (uint32_t)i + 1u);
}

static void mulAv(int32_t n, const double *v, double *av) {
  for (int32_t i = 0; i < n; i++) {
    double s0 = 0, s1 = 0, s2 = 0, s3 = 0;
    for (int32_t j = 0; j + 3 < n; j += 4) {
      s0 = s0 + a(i, j) * v[j];
      s1 = s1 + a(i, j + 1) * v[j + 1];
      s2 = s2 + a(i, j + 2) * v[j + 2];
      s3 = s3 + a(i, j + 3) * v[j + 3];
    }
    av[i] = s0 + s2 + (s1 + s3);
  }
}

int main(void) {
  double *v = malloc(N * sizeof(double));
  double *av = malloc(N * sizeof(double));
  for (int32_t i = 0; i < N; i++) {
    v[i] = 1;
    av[i] = 0;
  }
  int64_t checksum = 0;
  for (int32_t r = 0; r < ROUNDS; r++) {
    v[(r * 7) % N] = v[(r * 7) % N] + 0.5;
    mulAv(N, v, av);
    double total = 0;
    for (int32_t i = 0; i < N; i++) {
      total = total + av[i];
    }
    checksum = (checksum * 31 + (int64_t)(total * 1000)) % 1000003;
  }
  printf("%lld\n", (long long)checksum);
  free(v);
  free(av);
  return 0;
}
