/* Driver and callee for ffi_buffer_u32: C fills a Nish `u32[]`. */
#include <stdint.h>
#include <stdio.h>
void fill_u32(uint32_t *xs, uint64_t n, uint32_t step) {
  for (uint64_t i = 0; i < n; i++) {
    xs[i] = step + (uint32_t)i;
  }
}
int32_t run(void);
int main(void) {
  int32_t r = run();
  fflush(stdout);
  printf("run: %d\n", r);
  return 0;
}
