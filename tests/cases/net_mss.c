/* Driver for net_mss: a connection's MSS is positive, and every socket with
   none to read answers -1. The MSS itself depends on the loopback's MTU, so
   only its sign is printed. A connection the case could not take prints its
   failure instead. */
#include <stdint.h>
#include <stdio.h>
#include <sys/socket.h>
#include <unistd.h>

int32_t connected(void);
int32_t listening(void);
int32_t datagram(void);
int32_t closed(void);
int32_t mssOf(int32_t fd);

int main(void) {
  int32_t mss = connected();
  if (mss > 0) {
    printf("connected: positive\n");
  } else {
    printf("connected %d\n", mss);
  }
  printf("listening: %d\n", listening());
  printf("datagram: %d\n", datagram());
  printf("closed: %d\n", closed());
  printf("never open: %d\n", mssOf(-1));
  /* A TCP socket that was never connected answers the kernel's default 536
     to both options, so its -1 comes from having no peer. */
  int fresh = socket(AF_INET, SOCK_STREAM, 0);
  printf("unconnected: %d\n", mssOf(fresh));
  close(fresh);
  int p[2];
  if (pipe(p) == 0) {
    printf("pipe: %d\n", mssOf(p[0]));
    close(p[0]);
    close(p[1]);
  }
  return 0;
}
