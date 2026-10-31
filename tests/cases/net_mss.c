/* Driver for net_mss: a connection's MSS is positive, and every socket with
   none to read answers -1. The MSS itself depends on the loopback's MTU, so
   only its sign is printed. A connection the case could not take prints its
   failure instead. */
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
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
  /* A TCP socket that was never connected answers Linux's default 536 to
     both options, so its -1 comes from having no peer. Linux is checked
     here, printing only when it disagrees; Darwin's default is its own. */
  int fresh = socket(AF_INET, SOCK_STREAM, 0);
#if defined(__linux__)
  int maxseg = 0;
  socklen_t len = sizeof maxseg;
  if (getsockopt(fresh, IPPROTO_TCP, TCP_MAXSEG, &maxseg, &len) != 0 || maxseg != 536) {
    printf("unconnected TCP_MAXSEG: %d, not 536\n", maxseg);
  }
  struct tcp_info info;
  memset(&info, 0, sizeof info);
  len = sizeof info;
  if (getsockopt(fresh, IPPROTO_TCP, TCP_INFO, &info, &len) != 0 || info.tcpi_snd_mss != 536) {
    printf("unconnected tcpi_snd_mss: %u, not 536\n", info.tcpi_snd_mss);
  }
#endif
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
