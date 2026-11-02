#include <stdio.h>
#include <time.h>
void aluloop(void *t, long n);
int main(void) { struct timespec a, b; long n = 300000000; clock_gettime(CLOCK_MONOTONIC, &a); aluloop(0, n); clock_gettime(CLOCK_MONOTONIC, &b);
  double ns = (b.tv_sec - a.tv_sec) * 1e9 + (b.tv_nsec - a.tv_nsec); printf("%.2f uops/cycle at 3.15 GHz (24 per iter)\n", 24.0 * n / ns / 3.15); }
