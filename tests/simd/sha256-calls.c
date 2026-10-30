/* The control for tests/run.js's section-GC check on runtime/runtime-sha256.c:
 * a program that does call the kernel, linked through scripts/build.sh like any
 * other, keeps it, and hashes "abc" (FIPS 180-4's first example) when this
 * machine runs it. Without it, a check that a program which never calls the
 * kernel links none of it would also pass if the file were never linked at all.
 * Under `--profile wasi` it is the check that the unit links there and answers 0.
 *
 * Prints `nish_sha256_hw: <0 or 1>`, then, when 1, the digest of "abc".
 */
#include <stdio.h>

#include "../../runtime/nish.h"

int main(void) {
  int32_t hw = nish_sha256_hw();
  printf("nish_sha256_hw: %d\n", (int)hw);
  if (hw) {
    static uint32_t h[8] = {0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};
    static uint32_t w[64];
    static unsigned char block[64] = {'a', 'b', 'c', 0x80};
    block[63] = 24; /* the message's length in bits, big-endian */
    nish_array ha = {8, 8, (char *)h}, wa = {64, 64, (char *)w}, src = {64, 64, (char *)block};
    if (nish_sha256_compress(&ha, &wa, &src, 0) != 1) return 1;
    for (int i = 0; i < 8; i++) printf("%08x", (unsigned)h[i]);
    printf("\n");
  }
  return 0;
}
