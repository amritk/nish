/* The control for tests/run.js's section-GC check on runtime/runtime-aes.c: a
 * program that does call the kernels, linked through scripts/build.sh like any
 * other, keeps them, and encrypts FIPS 197 C.1's block when this machine runs
 * them. Without it, a check that a program which never calls the kernels links
 * none of them would also pass if the file were never linked at all. Under
 * `--profile wasi` it is the check that the unit links there and answers 0.
 *
 * Prints `nish_aes_hw: <0 or 1>`, then, when 1, the block's ciphertext.
 */
#include <stdio.h>

#include "../../runtime/nish.h"

int main(void) {
  int32_t hw = nish_aes_hw();
  printf("nish_aes_hw: %d\n", (int)hw);
  if (hw) {
    static uint64_t rk[88];
    static unsigned char key[16], in[16], out[16];
    for (int i = 0; i < 16; i++) {
      key[i] = (unsigned char)i;
      in[i] = (unsigned char)(i * 0x11);
    }
    nish_array k = {16, 16, (char *)key}, r = {88, 88, (char *)rk}, s = {16, 16, (char *)in}, d = {16, 16, (char *)out};
    nish_aes_schedule(&k, 10, &r);
    nish_aes_block(&r, 10, &s, &d);
    for (int i = 0; i < 16; i++) printf("%02x", out[i]);
    printf("\n");
  }
  return 0;
}
