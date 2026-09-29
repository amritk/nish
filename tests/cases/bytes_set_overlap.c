/* Driver for bytes_set_overlap: two array headers over one buffer, so the
   `set` inside `copyInto` copies between overlapping ranges. A byte-by-byte
   forward copy would smear the first case into "ababab..."; the source read
   first, as `TypedArray.prototype.set` promises, gives "ababcdgh". */
#include <stdint.h>
#include <stdio.h>
#include <string.h>

/* The array header runtime/nish.h declares, spelled out as the other drivers
   here spell their prototypes. */
typedef struct nish_array { uint64_t len; uint64_t cap; char *data; } nish_array;

void copyInto(nish_array *dst, const nish_array *src, int32_t at);

int main(void) {
  char buf[9];
  memcpy(buf, "abcdefgh", 9);
  nish_array src = {4, 4, buf};
  nish_array dst = {6, 6, buf + 2};
  copyInto(&dst, &src, 0); /* forward: the destination starts after the source */
  printf("%s\n", buf);
  memcpy(buf, "abcdefgh", 9);
  nish_array later = {4, 4, buf + 2};
  nish_array whole = {8, 8, buf};
  copyInto(&whole, &later, 1); /* backward: the destination starts before the source */
  printf("%s\n", buf);
  return 0;
}
