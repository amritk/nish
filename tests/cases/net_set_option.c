/* Driver for net_set_option: each option set through `netSetOption` on an
   accepted connection, and what `getsockopt` reads back; then the answers
   that are failures. A connection the case could not take prints its failure
   instead. `TCP_QUICKACK` is Linux's alone, so elsewhere its line holds when
   the call says -95. */
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/socket.h>
#include <unistd.h>

int32_t accepted(void);
int32_t setNodelay(int32_t fd, int32_t on);
int32_t setQuickack(int32_t fd, int32_t on);
int32_t setKeepalive(int32_t fd, int32_t on);
int32_t setSndbuf(int32_t fd, int32_t bytes);
int32_t setRcvbuf(int32_t fd, int32_t bytes);
int32_t setRaw(int32_t fd, int32_t option);
int32_t closed(void);

static int reads(int fd, int level, int name) {
  int v = -1;
  socklen_t size = sizeof v;
  return getsockopt(fd, level, name, &v, &size) == 0 ? v : -1;
}

int main(void) {
  int32_t fd = accepted();
  if (fd < 0) {
    printf("accepted %d\n", fd);
    return 0;
  }
  printf("nodelay on: %d, reads %d\n", setNodelay(fd, 1), reads(fd, IPPROTO_TCP, TCP_NODELAY) != 0);
  printf("nodelay off: %d, reads %d\n", setNodelay(fd, 0), reads(fd, IPPROTO_TCP, TCP_NODELAY) != 0);
  printf("keepalive on: %d, reads %d\n", setKeepalive(fd, 1), reads(fd, SOL_SOCKET, SO_KEEPALIVE) != 0);
  printf("keepalive off: %d, reads %d\n", setKeepalive(fd, 0), reads(fd, SOL_SOCKET, SO_KEEPALIVE) != 0);
  /* Linux stores twice the size asked for; Darwin stores it as asked. */
  printf("sndbuf 65536: %d, reads at least 65536 %d\n", setSndbuf(fd, 65536),
         reads(fd, SOL_SOCKET, SO_SNDBUF) >= 65536);
  printf("rcvbuf 65536: %d, reads at least 65536 %d\n", setRcvbuf(fd, 65536),
         reads(fd, SOL_SOCKET, SO_RCVBUF) >= 65536);
#if defined(__linux__)
  printf("sndbuf doubled %d\n", reads(fd, SOL_SOCKET, SO_SNDBUF) == 2 * 65536);
  int32_t quick = setQuickack(fd, 1);
  printf("quickack on: %s\n", quick == 0 && reads(fd, IPPROTO_TCP, TCP_QUICKACK) == 1 ? "set" : "not set");
  printf("quickack off: %d\n", setQuickack(fd, 0));
#else
  printf("sndbuf doubled 1\n");
  printf("quickack on: %s\n", setQuickack(fd, 1) == -95 ? "set" : "not set");
  printf("quickack off: %d\n", setQuickack(fd, 0) == -95 ? 0 : -1);
#endif
  printf("option 0: %d\n", setRaw(fd, 0));
  printf("option 6: %d\n", setRaw(fd, 6));
  printf("option -1: %d\n", setRaw(fd, -1));
  close(fd);
  printf("closed: %d\n", closed());
  int p[2];
  if (pipe(p) == 0) {
    printf("pipe: %d\n", setNodelay(p[0], 1));
    close(p[0]);
    close(p[1]);
  }
  return 0;
}
