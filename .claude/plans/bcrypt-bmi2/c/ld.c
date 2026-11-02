#include <stdio.h>
#include <stdint.h>
#include <time.h>
void ldloop(uint32_t *t, long n);
static uint32_t t[8192];
int main(void) { struct timespec a, b; long n = 500000000; clock_gettime(CLOCK_MONOTONIC, &a); ldloop(t, n); clock_gettime(CLOCK_MONOTONIC, &b);
  double ns = (b.tv_sec - a.tv_sec) * 1e9 + (b.tv_nsec - a.tv_nsec); printf("%.2f loads/ns -> %.2f loads/cycle at 3.15 GHz\n", 12.0 * n / ns, 12.0 * n / ns / 3.15); }
