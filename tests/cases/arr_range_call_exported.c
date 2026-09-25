// The host half of arr_range_call_exported: a caller the compiler cannot see.
#include <stdint.h>
#include <stdio.h>

int32_t first(void);
int32_t pick(int32_t i);

int main(void) {
  printf("%d\n", first());
  fflush(stdout);
  printf("%d\n", pick(7));
  return 0;
}
