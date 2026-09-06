/* C twin of spectral.ts: same loops, same evaluation order, heap vectors. */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define N 3000 /* bench:n */

static double A(int32_t i, int32_t j) {
  int32_t ij = i + j;
  return 1 / (double)(ij * (ij + 1) / 2 + i + 1);
}

static void mulAv(int32_t n, const double *v, double *av) {
  for (int32_t i = 0; i < n; i++) {
    double s = 0;
    for (int32_t j = 0; j < n; j++) {
      s = s + A(i, j) * v[j];
    }
    av[i] = s;
  }
}

static void mulAtv(int32_t n, const double *v, double *atv) {
  for (int32_t i = 0; i < n; i++) {
    double s = 0;
    for (int32_t j = 0; j < n; j++) {
      s = s + A(j, i) * v[j];
    }
    atv[i] = s;
  }
}

static void mulAtAv(int32_t n, const double *v, double *out, double *tmp) {
  mulAv(n, v, tmp);
  mulAtv(n, tmp, out);
}

int main(void) {
  double *u = calloc(N, sizeof(double));
  double *v = calloc(N, sizeof(double));
  double *tmp = calloc(N, sizeof(double));
  for (int32_t i = 0; i < N; i++) {
    u[i] = 1;
  }
  for (int32_t k = 0; k < 10; k++) {
    mulAtAv(N, u, v, tmp);
    mulAtAv(N, v, u, tmp);
  }
  double vBv = 0, vv = 0;
  for (int32_t i = 0; i < N; i++) {
    vBv = vBv + u[i] * v[i];
    vv = vv + v[i] * v[i];
  }
  printf("%.17g\n", sqrt(vBv / vv));
  free(u);
  free(v);
  free(tmp);
  return 0;
}
