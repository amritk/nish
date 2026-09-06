/* C twin of fib.ts: same shape, same external linkage, same driver. */
#include <stdint.h>
#include <stdio.h>

int32_t fib(int32_t n) {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

int32_t test(void) { return fib(35); }

int main(void) {
  printf("%d\n", test());
  return 0;
}
