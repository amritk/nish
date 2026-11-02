#include <stdio.h>
#include <time.h>
int main(void) {
  unsigned long x = 1, n = 1000000000;
  struct timespec a, b;
  clock_gettime(CLOCK_MONOTONIC, &a);
  for (unsigned long i = 0; i < n; i++)
    __asm__ volatile("add %0, %0\n\tadd %0, %0\n\tadd %0, %0\n\tadd %0, %0" : "+r"(x));
  clock_gettime(CLOCK_MONOTONIC, &b);
  printf("%.2f GHz\n", 4.0 * n / ((b.tv_sec - a.tv_sec) * 1e9 + (b.tv_nsec - a.tv_nsec)));
  return (int)(x & 1);
}
