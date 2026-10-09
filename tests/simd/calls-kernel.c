/* The control for tests/run.js's section-GC check on runtime/runtime-simd.c:
 * a program that does call `nish_str_index_of_any`, linked through
 * scripts/build.sh like any other, keeps the kernel and its paths, and finds
 * the quote at index 2. Without it, a check that a program which never calls
 * the kernel links none of it would also pass if the file were never linked
 * at all. */
#include <stdio.h>

#include "../../runtime/nish.h"

int main(void) {
  static uint64_t hay[2] = {5}, set[2] = {1};
  ((nish_str *)hay)->data[0] = 'a';
  ((nish_str *)hay)->data[1] = 'b';
  ((nish_str *)hay)->data[2] = '"';
  ((nish_str *)hay)->data[3] = 'c';
  ((nish_str *)hay)->data[4] = 'd';
  ((nish_str *)set)->data[0] = '"';
  printf("%lld\n", (long long)nish_str_index_of_any((nish_str *)hay, (nish_str *)set, 0));
  return 0;
}
