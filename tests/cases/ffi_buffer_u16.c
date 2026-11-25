/* Driver and callee for ffi_buffer_u16: C sums a prefix of a Nish `u16[]`. */
#include <stdint.h>
#include <stdio.h>
uint32_t sum_u16(const uint16_t *xs, uint64_t n) {
  uint32_t s = 0;
  for (uint64_t i = 0; i < n; i++) {
    s += xs[i];
  }
  return s;
}
int32_t run(int32_t n);
int main(void) {
  int32_t r = run(3);
  fflush(stdout);
  printf("sum: %d\n", r);
  return 0;
}
