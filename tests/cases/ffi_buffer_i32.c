/* Driver and callee for ffi_buffer_i32: C adds one Nish `i32[]` into another. */
#include <stdint.h>
#include <stdio.h>
void add_i32(int32_t *dst, const int32_t *src, uint64_t n) {
  for (uint64_t i = 0; i < n; i++) {
    dst[i] += src[i];
  }
}
int32_t run(void);
int main(void) {
  int32_t r = run();
  fflush(stdout);
  printf("run: %d\n", r);
  return 0;
}
