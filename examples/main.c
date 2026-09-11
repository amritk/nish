/* Native driver that links against the compiled Nish module. */
#include <stdint.h>
#include <stdio.h>

/* `number` in i32 mode lowers to i32, so the ABI is a plain int32_t. */
int32_t add(int32_t a, int32_t b);

int main(void) {
  printf("add(2, 3) = %d\n", add(2, 3));
  return 0;
}
