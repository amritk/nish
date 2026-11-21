/* Driver for ffi_narrow_zeroext. The callees read their narrow argument as
 * clang compiles it, trusting the caller to have widened it; `tests/ffi-abi.js`
 * also builds them into a shared object (-DNARROW_CALLEES_ONLY) and links
 * `main` alone (-DNARROW_MAIN_ONLY), so no inlining can hide the ABI. */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#ifndef NARROW_MAIN_ONLY
__attribute__((noinline)) int64_t ident(int64_t x) { return x; }
__attribute__((noinline)) uint32_t widen_u8(unsigned char x) { return x; }
__attribute__((noinline)) uint32_t widen_u16(unsigned short x) { return x; }
__attribute__((noinline)) int32_t pick(bool b) { return b ? 7 : 3; }
__attribute__((noinline)) unsigned char low_byte(uint32_t x) { return (unsigned char)x; }
__attribute__((noinline)) bool is_odd(uint32_t x) { return (x & 1) != 0; }
#endif
#ifndef NARROW_CALLEES_ONLY
int32_t run(void);
int main(void) {
  int32_t r = run();
  fflush(stdout);
  printf("run: %d\n", r);
  return 0;
}
#endif
