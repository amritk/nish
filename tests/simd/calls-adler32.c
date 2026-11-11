/* The control for tests/run.js's section-GC check on runtime/runtime-checksum.c's
 * Adler-32 half, as tests/simd/calls-crc32.c is for its CRC-32 half: a program
 * that does call the kernel, linked through scripts/build.sh like any other,
 * keeps it, and gives the check value when this machine runs it. Under
 * `--profile wasi` it is the check that the unit links there and answers 0.
 *
 * Prints `nish_adler32_hw: <0 or 1>`, then, when 1, Adler-32("123456789").
 */
#include <stdio.h>

#include "../../runtime/nish.h"

int main(void) {
  int32_t hw = nish_adler32_hw();
  printf("nish_adler32_hw: %d\n", (int)hw);
  if (hw) {
    static char check[] = "123456789";
    nish_array a = {9, 9, check};
    printf("%08x\n", (unsigned)nish_adler32_update(1, &a, 0, 9));
  }
  return 0;
}
