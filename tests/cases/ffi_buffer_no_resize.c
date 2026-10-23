/* Driver for ffi_buffer_no_resize: pipes known bytes into each function and prints what it returns. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
int32_t addCount(int32_t fd, int32_t i);
int32_t sumCounted(int32_t fd);
int32_t sumEach(int32_t fd);
int32_t sumRefilled(int32_t fd);
int32_t addDrained(int32_t fd);
int32_t sumDrained(int32_t fd);
int32_t sumEachDrained(int32_t fd);
int main(void) {
  int p[2];
  if (pipe(p) != 0) {
    return 1;
  }
  /* addCount reads up to four bytes; each loop reads one byte per iteration. The
     bytes left at the end are printed: a drain loop that ran on a stale length
     would read more of them. */
  const unsigned char msg[] = {7, 7, 7, 7, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 30, 31, 40, 41, 50, 51, 52, 53};
  if (write(p[1], msg, sizeof msg) < 0) {
    return 1;
  }
  close(p[1]);
  printf("%d\n", addCount(p[0], 9));
  printf("%d\n", addCount(p[0], 2));
  printf("%d\n", sumCounted(p[0]));
  printf("%d\n", sumEach(p[0]));
  printf("%d\n", sumRefilled(p[0]));
  printf("%d\n", addDrained(p[0]));
  printf("%d\n", sumDrained(p[0]));
  printf("%d\n", sumEachDrained(p[0]));
  unsigned char rest[8];
  ssize_t left = read(p[0], rest, sizeof rest);
  printf("left");
  for (ssize_t k = 0; k < left; k++) {
    printf(" %d", rest[k]);
  }
  printf("\n");
  return 0;
}
