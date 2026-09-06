/* C twin of fib.ts: same shape, same checksum line. */
#include <stdint.h>
#include <stdio.h>

#define N 40 /* bench:n */

static int32_t fib(int32_t n) {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

int main(void) {
  printf("%d\n", fib(N));
  return 0;
}
