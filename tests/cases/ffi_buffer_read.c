/* Driver for ffi_buffer_read: pipes a message into `run` and prints the count it read. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
int32_t run(int32_t fd);
int main(void) {
  int p[2];
  if (pipe(p) != 0) {
    return 1;
  }
  const char *msg = "read through a buffer\n";
  if (write(p[1], msg, strlen(msg)) < 0) {
    return 1;
  }
  close(p[1]);
  fflush(stdout);
  int32_t n = run(p[0]);
  printf("%d\n", n);
  return 0;
}
