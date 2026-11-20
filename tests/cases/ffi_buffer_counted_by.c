/* Driver and callees for ffi_buffer_counted_by: zlib-shaped functions whose
 * counts are a `uInt`, an `unsigned short` before the buffer, and the
 * in/out `uLongf *destLen` of `compress`. */
#include <stdint.h>
#include <stdio.h>
typedef unsigned int uInt;
typedef unsigned long uLong;
typedef uLong uLongf;
int32_t z_fill(unsigned char *dst, uInt n, unsigned char v) {
  for (uInt i = 0; i < n; i++) {
    dst[i] = v;
  }
  return 0;
}
uint32_t z_sum(unsigned short n, const unsigned char *src) {
  uint32_t s = 0;
  for (unsigned short i = 0; i < n; i++) {
    s += src[i];
  }
  return s;
}
int32_t z_copy(unsigned char *dest, uLongf *destLen, const unsigned char *source, uLong sourceLen) {
  if (sourceLen > *destLen) {
    return -5;
  }
  for (uLong i = 0; i < sourceLen; i++) {
    dest[i] = source[i];
  }
  *destLen = sourceLen;
  return 0;
}
int32_t run(void);
int main(void) {
  int32_t r = run();
  fflush(stdout);
  printf("run: %d\n", r);
  return 0;
}
