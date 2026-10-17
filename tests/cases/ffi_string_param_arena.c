/* Driver for ffi_string_param_arena: `remember` is the C function the Nish
   side declares. It copies the borrowed string, as a C function that keeps
   what it was handed must, and answers its length; `main` prints the copy
   after the Nish arena scope that held the original has been released and
   reused. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>

int32_t run(int32_t n);

static char copy[64];

int32_t remember(const char *s) {
  size_t len = strlen(s);
  if (len >= sizeof copy) {
    len = sizeof copy - 1;
  }
  memcpy(copy, s, len);
  copy[len] = '\0';
  return (int32_t)len;
}

int main(void) {
  int32_t total = run(42);
  printf("%d\n", total);
  printf("%s\n", copy);
  return 0;
}
