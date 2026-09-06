/* C twin of sieve.ts: one malloc'd byte array, PASSES passes, no bounds checks. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define N 10000000 /* bench:n */
#define PASSES 20

static int32_t sieve(unsigned char *composite, int32_t n) {
  for (int32_t i = 0; i <= n; i++) {
    composite[i] = 0;
  }
  for (int32_t i = 2; i * i <= n; i++) {
    if (!composite[i]) {
      for (int32_t j = i * i; j <= n; j += i) {
        composite[j] = 1;
      }
    }
  }
  int32_t count = 0;
  for (int32_t i = 2; i <= n; i++) {
    if (!composite[i]) {
      count++;
    }
  }
  return count;
}

int main(void) {
  unsigned char *composite = malloc((size_t)N + 1);
  int32_t total = 0;
  for (int pass = 0; pass < PASSES; pass++) {
    total += sieve(composite, N);
  }
  printf("%d\n", total);
  free(composite);
  return 0;
}
