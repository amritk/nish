/* Driver for net_tcp_nodelay: the `TCP_NODELAY` each accepted connection
   reads back, by flags word, then the words that are still refused, then
   the option on the socket `tcpConnect` made. A connection the case could not
   take prints its failure instead. */
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/socket.h>
#include <unistd.h>

int32_t accepted(int32_t flags);
int32_t opened(int32_t flags);
int32_t connecting(void);

static void nodelay(int32_t flags) {
  int32_t fd = accepted(flags);
  int on = -1;
  socklen_t size = sizeof on;
  if (fd < 0) {
    printf("flags %d: accepted %d\n", flags, fd);
  } else if (getsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &on, &size) != 0) {
    printf("flags %d: getsockopt failed\n", flags);
  } else {
    printf("flags %d: TCP_NODELAY %d\n", flags, on != 0);
  }
  if (fd >= 0) close(fd);
}

int main(void) {
  nodelay(0);
  nodelay(1);
  nodelay(2);
  nodelay(3);
  printf("flags 4: %d\n", opened(4));
  printf("flags 6: %d\n", opened(6));
  printf("flags 8: %d\n", opened(8));
  printf("flags -1: %d\n", opened(-1));
  int32_t fd = connecting();
  int on = -1;
  socklen_t size = sizeof on;
  if (fd < 0) {
    printf("tcpConnect: %d\n", fd);
  } else if (getsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &on, &size) != 0) {
    printf("tcpConnect: getsockopt failed\n");
  } else {
    printf("tcpConnect: TCP_NODELAY %d\n", on != 0);
  }
  if (fd >= 0) close(fd);
  return 0;
}
