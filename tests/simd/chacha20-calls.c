/* The control for tests/run.js's section-GC check on runtime/runtime-chacha20.c:
 * a program that does call the kernel, linked through scripts/build.sh like any
 * other, keeps it, and gives RFC 8439 §2.3.2's block (key 00..1f, nonce
 * 00:00:00:09:00:00:00:4a:00:00:00:00, counter 1) when this machine runs it.
 * Without it, a check that a program which never calls the kernel links none of
 * it would also pass if the file were never linked at all. Under `--profile
 * wasi` it is the check that the unit links there and answers 0.
 *
 * Prints `nish_chacha20_hw: <0 or 1>`, then, when 1, the first 16 bytes of the
 * keystream and the counter the call leaves (four blocks on: 5).
 */
#include <stdio.h>

#include "../../runtime/nish.h"

int main(void) {
  int32_t hw = nish_chacha20_hw();
  printf("nish_chacha20_hw: %d\n", (int)hw);
  if (hw) {
    static uint32_t s[16] = {0x61707865, 0x3320646e, 0x79622d32, 0x6b206574, 0x03020100, 0x07060504,
                             0x0b0a0908, 0x0f0e0d0c, 0x13121110, 0x17161514, 0x1b1a1918, 0x1f1e1d1c,
                             1,          0x09000000, 0x4a000000, 0};
    static unsigned char zeros[256], out[256];
    nish_array sa = {16, 16, (char *)s}, src = {256, 256, (char *)zeros}, dst = {256, 256, (char *)out};
    if (nish_chacha20_xor(&sa, &src, 0, 256, &dst, 0) != 1) return 1;
    for (int i = 0; i < 16; i++) printf("%02x", out[i]);
    printf(" %u\n", (unsigned)s[12]);
  }
  return 0;
}
