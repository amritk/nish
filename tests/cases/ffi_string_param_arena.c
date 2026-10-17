/* Driver for ffi_string_param_arena: `remember` and `isNull` are the C
   functions the Nish side declares. `remember` first allocates through the
   runtime, as a C function the program calls may, and only then reads the
   borrowed string: had the arena scope that built it been released before the
   call, those allocations would reuse its bytes and the copy would read 'Z's.
   It copies what it read, as a C function that keeps what it was handed must,
   and answers its length; `main` prints the copy after that scope has been
   released and reused. `isNull` reports whether a `string | null` argument
   arrived as NULL. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>

/* The runtime's allocator for a string (`runtime/nish.h`), declared here
   because a case's sidecar is compiled without the runtime's include path. */
typedef struct nish_str nish_str;
nish_str *nish_str_new(const char *bytes, uint64_t len);

int32_t run(int32_t n);

static char copy[64];

int32_t remember(const char *s) {
  char fill[64];
  memset(fill, 'Z', sizeof fill);
  for (int i = 0; i < 8; i++) {
    nish_str_new(fill, sizeof fill);
  }
  size_t len = strlen(s);
  if (len >= sizeof copy) {
    len = sizeof copy - 1;
  }
  memcpy(copy, s, len);
  copy[len] = '\0';
  return (int32_t)len;
}

int32_t isNull(const char *s) {
  printf("%s\n", s == NULL ? "NULL" : s);
  return s == NULL ? 1 : 0;
}

int main(void) {
  int32_t total = run(42);
  printf("%d\n", total);
  printf("%s\n", copy);
  return 0;
}
