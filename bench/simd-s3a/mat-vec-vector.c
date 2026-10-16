/* Adapted from the Computer Language Benchmarks Game spectral-norm program
   (Node.js #1, contributed by Ian Osgood, modified by Isaac Gouy),
   https://benchmarksgame-team.pages.debian.net/benchmarksgame/.
   Copyright (c) 2004-2008 Brent Fulgham, 2005-2025 Isaac Gouy.
   Revised BSD licence; see bench/LICENSE-benchmarksgame.md. */
/* WP38 S3a, mat-vec form 1: the kernel nish:simd would write, in C's generic
   vectors, which lower to the same LLVM vector IR (docs/wp38-simd.md §2.3).
   Two f64x2 accumulators: lanes 0 and 1 of the first hold j = 0 and 1 mod 4,
   the second's 2 and 3, so the scalar forms' four accumulators add in the
   same order and every form prints one checksum. Only element-wise
   arithmetic, constant shuffles and conversions: no <immintrin.h>, no
   <arm_neon.h>, and bench/simd-s3a.mjs refuses to time this file if its IR
   calls an llvm.x86 or llvm.aarch64 intrinsic. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define N 2000
#define ROUNDS 100

typedef double f64x2 __attribute__((vector_size(16)));
typedef int32_t i32x4 __attribute__((vector_size(16)));
typedef int32_t i32x2 __attribute__((vector_size(8)));

static void mulAv(int32_t n, const double *v, double *av) {
  const i32x4 one = {1, 1, 1, 1};
  const i32x4 two = {2, 2, 2, 2};
  const i32x4 four = {4, 4, 4, 4};
  for (int32_t i = 0; i < n; i++) {
    const i32x4 iv = {i, i, i, i};
    i32x4 jv = {0, 1, 2, 3};
    f64x2 s01 = {0, 0};
    f64x2 s23 = {0, 0};
    for (int32_t j = 0; j + 3 < n; j += 4) {
      /* Vector integer arithmetic wraps, as the scalar forms' wrappingAdd does. */
      i32x4 ij = iv + jv;
      i32x4 d = ij * (ij + one) / two + iv + one;
      f64x2 d01 = __builtin_convertvector(__builtin_shufflevector(d, d, 0, 1), f64x2);
      f64x2 d23 = __builtin_convertvector(__builtin_shufflevector(d, d, 2, 3), f64x2);
      f64x2 v01, v23;
      memcpy(&v01, v + j, sizeof v01);
      memcpy(&v23, v + j + 2, sizeof v23);
      s01 = s01 + 1 / d01 * v01;
      s23 = s23 + 1 / d23 * v23;
      jv = jv + four;
    }
    f64x2 s = s01 + s23;
    av[i] = s[0] + s[1];
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
