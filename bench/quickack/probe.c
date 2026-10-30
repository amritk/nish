/* What TCP_QUICKACK costs and what it changes, on one loopback connection.

     cc -O2 -o build/bench/quickack-probe bench/quickack/probe.c
     build/bench/quickack-probe            both parts
     build/bench/quickack-probe calls      the per-call cost only
     build/bench/quickack-probe acks       the per-mode ACK table only

   Part one, `calls`: nanoseconds per call of setsockopt(TCP_QUICKACK, 0),
   setsockopt(TCP_QUICKACK, 1), getsockopt(TCP_QUICKACK), getsockopt(TCP_INFO)
   and getppid() as the floor any system call pays, on an established socket.
   The median of 7 runs of 200,000 calls each. bench/syscall-cost/ is the
   repository's general table; this part exists so the write-up's per-call
   figures do not wait on it, and so they come from the same box as the rest.

   Part two, `acks`: a client and a server socket in one process exchange
   200 requests of 64 bytes and responses of 128, the server answering every
   request at once, under each BENCH_QUICKACK mode of bench/http1-server.ts:

     none    no call
     once0   setsockopt(TCP_QUICKACK, 0) once, after accept
     reset0  setsockopt(TCP_QUICKACK, 0) after each response
     reset1  setsockopt(TCP_QUICKACK, 1) after each response

   and in three patterns: `fast` (every response at once), `slow` (every
   tenth response 250 ms late, past the kernel's longest delayed-ACK timer)
   and `idle` (every tenth request sent after the client sleeps 1.5 s, longer
   than the connection's retransmission timeout, which refills the quick-ACK
   budget). It prints, per mode and pattern, the pure ACKs the server's socket
   sent per request (TCP_INFO's tcpi_segs_out minus tcpi_data_segs_out) and
   how many requests found the socket out of delayed-ACK mode, as
   getsockopt(TCP_QUICKACK) reports it just before the request arrives. */
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <netinet/in.h>
#include <linux/tcp.h> /* glibc's struct tcp_info lacks tcpi_data_segs_out */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

static void die(const char *what) {
  perror(what);
  exit(1);
}

/* A connected pair on 127.0.0.1: *client and *server, both blocking. */
static void pair(int *client, int *server) {
  int l = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in a;
  socklen_t n = sizeof a;
  memset(&a, 0, sizeof a);
  a.sin_family = AF_INET;
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  if (l < 0 || bind(l, (struct sockaddr *)&a, sizeof a) < 0 || listen(l, 1) < 0 ||
      getsockname(l, (struct sockaddr *)&a, &n) < 0)
    die("listen");
  *client = socket(AF_INET, SOCK_STREAM, 0);
  if (*client < 0 || connect(*client, (struct sockaddr *)&a, sizeof a) < 0) die("connect");
  *server = accept(l, NULL, NULL);
  if (*server < 0) die("accept");
  close(l);
  /* Small writes go out at once, as the bench server's do. */
  int one = 1;
  setsockopt(*client, IPPROTO_TCP, TCP_NODELAY, &one, sizeof one);
  setsockopt(*server, IPPROTO_TCP, TCP_NODELAY, &one, sizeof one);
}

static double now_ns(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return t.tv_sec * 1e9 + t.tv_nsec;
}

static int by_value(const void *a, const void *b) {
  double x = *(const double *)a, y = *(const double *)b;
  return x < y ? -1 : x > y;
}

enum { CALLS = 200000, RUNS = 7 };

/* Nanoseconds per call of `which` on `fd`, one run. */
static double time_calls(int which, int fd) {
  int zero = 0, one = 1, v;
  struct tcp_info info;
  socklen_t n;
  double t0 = now_ns();
  for (int k = 0; k < CALLS; k++) {
    switch (which) {
    case 0: setsockopt(fd, IPPROTO_TCP, TCP_QUICKACK, &zero, sizeof zero); break;
    case 1: setsockopt(fd, IPPROTO_TCP, TCP_QUICKACK, &one, sizeof one); break;
    case 2: n = sizeof v; getsockopt(fd, IPPROTO_TCP, TCP_QUICKACK, &v, &n); break;
    case 3: n = sizeof info; getsockopt(fd, IPPROTO_TCP, TCP_INFO, &info, &n); break;
    default: getppid(); break;
    }
  }
  return (now_ns() - t0) / CALLS;
}

static void calls(void) {
  static const char *names[] = {
    "setsockopt(TCP_QUICKACK, 0)", "setsockopt(TCP_QUICKACK, 1)",
    "getsockopt(TCP_QUICKACK)", "getsockopt(TCP_INFO)", "getppid()",
  };
  int client, server;
  pair(&client, &server);
  printf("| call | ns/call (median of %d) | min | max |\n| --- | ---: | ---: | ---: |\n", RUNS);
  for (int which = 0; which < 5; which++) {
    double t[RUNS];
    time_calls(which, server); /* warm-up */
    for (int r = 0; r < RUNS; r++) t[r] = time_calls(which, server);
    qsort(t, RUNS, sizeof t[0], by_value);
    printf("| %s | %.0f | %.0f | %.0f |\n", names[which], t[RUNS / 2], t[0], t[RUNS - 1]);
  }
  close(client);
  close(server);
}

enum { REQUESTS = 200, REQ = 64, RESP = 128 };

static void set_quickack(int fd, int value) {
  setsockopt(fd, IPPROTO_TCP, TCP_QUICKACK, &value, sizeof value);
}

static void exactly(int fd, char *buf, int n, int reading) {
  for (int done = 0; done < n;) {
    ssize_t k = reading ? read(fd, buf + done, n - done) : write(fd, buf + done, n - done);
    if (k <= 0) die(reading ? "read" : "write");
    done += (int)k;
  }
}

static struct tcp_info info_of(int fd) {
  struct tcp_info info;
  socklen_t n = sizeof info;
  memset(&info, 0, sizeof info);
  if (getsockopt(fd, IPPROTO_TCP, TCP_INFO, &info, &n) < 0) die("TCP_INFO");
  return info;
}

/* One connection of REQUESTS exchanges under `mode` and `pattern`. */
static void exchange(const char *mode, const char *pattern) {
  int client, server;
  char req[REQ], resp[RESP];
  memset(req, 'q', sizeof req);
  memset(resp, 'r', sizeof resp);
  pair(&client, &server);
  if (strcmp(mode, "once0") == 0) set_quickack(server, 0);
  struct tcp_info before = info_of(server);
  int quick_seen = 0;
  for (int k = 1; k <= REQUESTS; k++) {
    if (strcmp(pattern, "idle") == 0 && k % 10 == 0) usleep(1500 * 1000);
    int v;
    socklen_t n = sizeof v;
    getsockopt(server, IPPROTO_TCP, TCP_QUICKACK, &v, &n);
    quick_seen += v;
    exactly(client, req, REQ, 0);
    exactly(server, req, REQ, 1);
    if (strcmp(pattern, "slow") == 0 && k % 10 == 0) usleep(250 * 1000);
    exactly(server, resp, RESP, 0);
    if (strcmp(mode, "reset0") == 0) set_quickack(server, 0);
    if (strcmp(mode, "reset1") == 0) set_quickack(server, 1);
    exactly(client, resp, RESP, 1);
  }
  /* Let a pending delayed ACK go out before the count is read. */
  usleep(250 * 1000);
  struct tcp_info after = info_of(server);
  unsigned pure = (after.tcpi_segs_out - after.tcpi_data_segs_out) -
                  (before.tcpi_segs_out - before.tcpi_data_segs_out);
  printf("| %s | %s | %.3f | %d of %d |\n", mode, pattern, (double)pure / REQUESTS, quick_seen,
         REQUESTS);
  close(client);
  close(server);
}

static void acks(void) {
  static const char *modes[] = {"none", "once0", "reset0", "reset1"};
  static const char *patterns[] = {"fast", "slow", "idle"};
  printf("| mode | pattern | server pure ACKs/request | requests met out of delayed-ACK mode |\n");
  printf("| --- | --- | ---: | ---: |\n");
  for (int p = 0; p < 3; p++)
    for (int m = 0; m < 4; m++) exchange(modes[m], patterns[p]);
}

int main(int argc, char **argv) {
  const char *part = argc > 1 ? argv[1] : "both";
  if (strcmp(part, "acks") != 0) calls();
  if (strcmp(part, "both") == 0) printf("\n");
  if (strcmp(part, "calls") != 0) acks();
  return 0;
}
