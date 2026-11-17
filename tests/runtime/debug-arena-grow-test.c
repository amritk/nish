/* An array grown past 64 KB under the debug arena (runtime/runtime.c,
 * NISH_ARENA_DEBUG): `node tests/run.js debug-arena` links this with the whole
 * runtime under -DNISH_ARENA_DEBUG.
 *
 * A normal build grows a block that fills its own chunk with a `realloc` of
 * that chunk (`nish_array_grow_here`). The debug arena's chunks are cut from
 * its reservation rather than malloc'd, so that `realloc` aborted the process;
 * a grown array there must take the copy, and keep every element. */

#include <stdint.h>
#include <stdio.h>

#include "../../runtime/nish.h"

int main(void) {
  nish_array a = { 0, 0, 0 };
  uint64_t sum = 0;
  for (uint64_t i = 0; i < (1u << 20); i++) {
    if (a.len == a.cap) nish_array_grow(&a, 1);
    a.data[a.len++] = (char)(i & 0x7f);
  }
  for (uint64_t i = 0; i < a.len; i++) sum += (unsigned char)a.data[i];
  printf("len %llu, sum %llu\n", (unsigned long long)a.len, (unsigned long long)sum);
  return 0;
}
