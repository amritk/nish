/* Driver and callees for ffi_buffer_f32: C reads and writes a Nish `f32[]`
 * through a `float *`, counted in elements. */
#include <stdint.h>
#include <stdio.h>
void scale_f32(float *xs, uint64_t n, float k) {
  for (uint64_t i = 0; i < n; i++) {
    xs[i] *= k;
  }
}
float sum_f32(const float *xs, uint64_t n) {
  float s = 0;
  for (uint64_t i = 0; i < n; i++) {
    s += xs[i];
  }
  return s;
}
float first_f32(uint32_t n, const float *xs) {
  return n > 0 ? xs[0] : 0;
}
int32_t run(void);
int main(void) {
  int32_t r = run();
  fflush(stdout);
  printf("run: %d\n", r);
  return 0;
}
