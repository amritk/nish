/* The design the benchmark entry runs today: P processes, each with its own
 * SO_REUSEPORT listener and a level-triggered epoll loop, as `nish/net/prefork`
 * and `nish/net/handler` arrange it. Every connection is a descriptor, so each
 * process holds at most RLIMIT_NOFILE of them.
 *
 * Usage: epoll-server <port> <processes>. Prints `listening <port>` once every
 * worker is listening; each worker prints `live <n> fds <m>` once a second on
 * stderr. */
#define _GNU_SOURCE
#include "common.h"

#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdint.h>
#include <sys/epoll.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define EVENTS 1024
#define BATCH 16

static char batch[RESPONSE_LEN * BATCH];

static int listen_on(int port) {
  int fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
  int one = 1;
  setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
  setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &one, sizeof one);
  struct sockaddr_in a;
  memset(&a, 0, sizeof a);
  a.sin_family = AF_INET;
  a.sin_port = htons((uint16_t)port);
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  if (bind(fd, (struct sockaddr *)&a, sizeof a) != 0 || listen(fd, 65535) != 0) {
    perror("listen");
    exit(1);
  }
  return fd;
}

static void worker(int port, int ready) {
  int lfd = listen_on(port);
  int ep = epoll_create1(EPOLL_CLOEXEC);
  struct epoll_event ev = {.events = EPOLLIN, .data.fd = lfd};
  epoll_ctl(ep, EPOLL_CTL_ADD, lfd, &ev);
  (void)!write(ready, "r", 1);
  close(ready);
  long live = 0;
  char buf[4096];
  struct epoll_event evs[EVENTS];
  struct timespec last;
  clock_gettime(CLOCK_MONOTONIC, &last);
  for (;;) {
    int n = epoll_wait(ep, evs, EVENTS, 1000);
    for (int i = 0; i < n; i++) {
      int fd = evs[i].data.fd;
      if (fd == lfd) {
        for (;;) {
          int c = accept4(lfd, NULL, NULL, SOCK_NONBLOCK | SOCK_CLOEXEC);
          if (c < 0) {
            if (errno != EAGAIN && errno != EINTR && errno != ECONNABORTED && errno != EMFILE)
              perror("accept4");
            break;
          }
          struct epoll_event ce = {.events = EPOLLIN, .data.fd = c};
          epoll_ctl(ep, EPOLL_CTL_ADD, c, &ce);
          live++;
        }
        continue;
      }
      ssize_t r = read(fd, buf, sizeof buf);
      if (r > 0) {
        int k = count_requests(buf, r);
        while (k > 0) {
          int m = k > BATCH ? BATCH : k;
          (void)!send(fd, batch, RESPONSE_LEN * (size_t)m, MSG_NOSIGNAL);
          k -= m;
        }
      } else if (r == 0 || (errno != EAGAIN && errno != EINTR)) {
        close(fd);
        live--;
      }
    }
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    if (t.tv_sec > last.tv_sec) {
      fprintf(stderr, "[%d] live %ld fds %ld\n", (int)getpid(), live, count_fds());
      last = t;
    }
  }
}

int main(int argc, char **argv) {
  int port = argc > 1 ? atoi(argv[1]) : 8080;
  int procs = argc > 2 ? atoi(argv[2]) : 5;
  signal(SIGPIPE, SIG_IGN);
  long limit = raise_nofile();
  for (int i = 0; i < BATCH; i++) memcpy(batch + (size_t)i * RESPONSE_LEN, RESPONSE, RESPONSE_LEN);
  fprintf(stderr, "limit %ld per process, %d processes\n", limit, procs);
  int p[2];
  if (pipe(p) != 0) return 1;
  for (int i = 0; i < procs; i++) {
    pid_t pid = fork();
    if (pid == 0) {
      close(p[0]);
      worker(port, p[1]);
      _exit(0);
    }
  }
  close(p[1]);
  char c;
  for (int i = 0; i < procs; i++) {
    if (read(p[0], &c, 1) != 1) return 1;
  }
  printf("listening %d\n", port);
  fflush(stdout);
  /* The workers die with the process group; the parent only waits. */
  while (wait(NULL) > 0) {
  }
  return 0;
}
