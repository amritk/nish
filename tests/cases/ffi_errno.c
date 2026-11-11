/* Driver for ffi_errno: `errno_says` sets errno and answers a C string, which
 * the program copies after it saves errno; `main` prints what `run` answers. */
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
int32_t run(void);
const char *errno_says(int32_t e) {
  errno = e;
  return "a string from C";
}
int main(void) {
  int32_t r = run();
  fflush(stdout);
  printf("run: %d\n", r);
  return 0;
}
