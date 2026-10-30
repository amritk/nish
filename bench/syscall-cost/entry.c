/* What a system call costs on this box, apart from the work it asks for.
 *
 *   entry [--rounds n] [--calls n]
 *
 * Times, in ns per call over a warmed loop of `--calls` calls (10^6 by
 * default), with CLOCK_MONOTONIC around the loop:
 *
 *   getppid      syscall(SYS_getppid): no vDSO and next to no kernel work, so
 *                this is the entry and exit, (a) per syscall
 *   recv EAGAIN  recv on a connected non-blocking loopback TCP socket with
 *                nothing queued: entry, the fd lookup and the socket lock
 *   quickack 0   setsockopt(TCP_QUICKACK, 0) on that socket
 *   tcp_info     getsockopt(TCP_INFO) on that socket
 *   round <name> one request/response on one keep-alive loopback connection,
 *                at the bytes bench/http1-server.ts sends for that route:
 *                client send, server recv, server send, client recv. The
 *                figure is per call, a quarter of the round
 *
 * For each round size it also gives the TCP work per call, the round's
 * median per call less the getppid median. The rounds of every row are
 * interleaved, and each row reports the median and the min and max of its
 * rounds. Both ends of the round run on this one thread, so pin it to one CPU
 * (run.sh does) and the round is the kernel's work for both ends with no
 * wake-up of another CPU in it. */
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

#define MAX_ROUNDS 64

/* The bytes wrk sends for one GET, and what bench/http1-server.ts answers it
 * with (`curl -si` against a running build/bench/h1, Date included): the
 * header block is the same length for both routes, the bodies are 13 bytes
 * and `{"message":"Hello, World!","n":<count>}` at a 6-digit count. */
#define REQ_PLAINTEXT "GET /plaintext HTTP/1.1\r\nHost: 127.0.0.1:8080\r\n\r\n"
#define REQ_JSON "GET /json HTTP/1.1\r\nHost: 127.0.0.1:8080\r\n\r\n"
#define RESP_PLAINTEXT 132
#define RESP_JSON 145

static long long now_ns(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (long long)t.tv_sec * 1000000000LL + t.tv_nsec;
}

static void die(const char *what) {
  perror(what);
  exit(1);
}

/* A connected loopback TCP pair: *client and *server. */
static void tcp_pair(int *client, int *server) {
  int listener = socket(AF_INET, SOCK_STREAM, 0);
  if (listener < 0) die("socket");
  struct sockaddr_in addr = {.sin_family = AF_INET, .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
  socklen_t len = sizeof addr;
  if (bind(listener, (struct sockaddr *)&addr, len) < 0) die("bind");
  if (listen(listener, 1) < 0) die("listen");
  if (getsockname(listener, (struct sockaddr *)&addr, &len) < 0) die("getsockname");
  *client = socket(AF_INET, SOCK_STREAM, 0);
  if (*client < 0) die("socket");
  if (connect(*client, (struct sockaddr *)&addr, len) < 0) die("connect");
  *server = accept(listener, NULL, NULL);
  if (*server < 0) die("accept");
  close(listener);
  int one = 1;
  /* As bench/http1-server.ts's listener and wrk set them: each response is
   * one send, so Nagle would only add a wait. */
  setsockopt(*client, IPPROTO_TCP, TCP_NODELAY, &one, sizeof one);
  setsockopt(*server, IPPROTO_TCP, TCP_NODELAY, &one, sizeof one);
}

static int quiet_fd; /* connected, non-blocking, never sent to */

static void run_getppid(long n) {
  for (long i = 0; i < n; i++) syscall(SYS_getppid);
}

static void run_recv_eagain(long n) {
  char b;
  for (long i = 0; i < n; i++) {
    if (recv(quiet_fd, &b, 1, 0) != -1 || errno != EAGAIN) die("recv EAGAIN");
  }
}

static void run_quickack(long n) {
  int zero = 0;
  for (long i = 0; i < n; i++) {
    if (setsockopt(quiet_fd, IPPROTO_TCP, TCP_QUICKACK, &zero, sizeof zero) < 0) die("TCP_QUICKACK");
  }
}

static void run_tcp_info(long n) {
  struct tcp_info info;
  for (long i = 0; i < n; i++) {
    socklen_t len = sizeof info;
    if (getsockopt(quiet_fd, IPPROTO_TCP, TCP_INFO, &info, &len) < 0) die("TCP_INFO");
  }
}

/* One request/response pair of fds, its request and response bytes. */
struct round {
  int client, server;
  const char *request;
  size_t request_len, response_len;
};

static char response_buf[4096];
static struct round rounds_plain, rounds_json;

/* Reads exactly `len` bytes; a blocking socket on loopback normally hands
 * them over in one recv, since the sender's segment is queued before its
 * send returns. */
static void recv_all(int fd, size_t len) {
  char buf[4096];
  while (len > 0) {
    ssize_t got = recv(fd, buf, len, 0);
    if (got <= 0) die("recv");
    len -= (size_t)got;
  }
}

static void run_round(struct round *r, long calls) {
  for (long i = 0; i < calls / 4; i++) {
    if (send(r->client, r->request, r->request_len, MSG_NOSIGNAL) != (ssize_t)r->request_len) die("send");
    recv_all(r->server, r->request_len);
    if (send(r->server, response_buf, r->response_len, MSG_NOSIGNAL) != (ssize_t)r->response_len) die("send");
    recv_all(r->client, r->response_len);
  }
}

static void run_plain(long n) { run_round(&rounds_plain, n); }
static void run_json(long n) { run_round(&rounds_json, n); }

struct row {
  const char *name;
  void (*run)(long);
  double ns[MAX_ROUNDS];
};

static int cmp_double(const void *a, const void *b) {
  double x = *(const double *)a, y = *(const double *)b;
  return (x > y) - (x < y);
}

static double median_of(const double *xs, int n, double *lo, double *hi) {
  double s[MAX_ROUNDS];
  memcpy(s, xs, sizeof(double) * (size_t)n);
  qsort(s, (size_t)n, sizeof(double), cmp_double);
  *lo = s[0];
  *hi = s[n - 1];
  return n % 2 ? s[n / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

int main(int argc, char **argv) {
  int nrounds = 7;
  long calls = 1000000;
  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--rounds") && i + 1 < argc) {
      nrounds = atoi(argv[++i]);
    } else if (!strcmp(argv[i], "--calls") && i + 1 < argc) {
      calls = atol(argv[++i]);
    } else {
      fprintf(stderr, "usage: entry [--rounds n] [--calls n]\n");
      return 2;
    }
  }
  if (nrounds < 1 || nrounds > MAX_ROUNDS || calls < 4) {
    fprintf(stderr, "entry: --rounds is 1 to %d and --calls at least 4\n", MAX_ROUNDS);
    return 2;
  }

  int peer;
  tcp_pair(&quiet_fd, &peer);
  if (fcntl(quiet_fd, F_SETFL, O_NONBLOCK) < 0) die("fcntl");
  memset(response_buf, 'x', sizeof response_buf);
  rounds_plain.request = REQ_PLAINTEXT;
  rounds_plain.request_len = strlen(REQ_PLAINTEXT);
  rounds_plain.response_len = RESP_PLAINTEXT;
  rounds_json.request = REQ_JSON;
  rounds_json.request_len = strlen(REQ_JSON);
  rounds_json.response_len = RESP_JSON;
  tcp_pair(&rounds_plain.client, &rounds_plain.server);
  tcp_pair(&rounds_json.client, &rounds_json.server);

  struct row rows[] = {
      {"getppid", run_getppid, {0}},
      {"recv EAGAIN", run_recv_eagain, {0}},
      {"setsockopt TCP_QUICKACK 0", run_quickack, {0}},
      {"getsockopt TCP_INFO", run_tcp_info, {0}},
      {"round /plaintext", run_plain, {0}},
      {"round /json", run_json, {0}},
  };
  int nrows = (int)(sizeof rows / sizeof rows[0]);

  /* Warm every path, the TCP connections' windows and the caches. */
  for (int k = 0; k < nrows; k++) rows[k].run(calls / 10 > 4 ? calls / 10 : 4);
  for (int r = 0; r < nrounds; r++) {
    for (int k = 0; k < nrows; k++) {
      long long t0 = now_ns();
      rows[k].run(calls);
      long long t1 = now_ns();
      long done = k >= 4 ? calls / 4 * 4 : calls;
      rows[k].ns[r] = (double)(t1 - t0) / (double)done;
    }
  }

  printf("%d interleaved rounds of %ld calls a row; ns per call\n\n", nrounds, calls);
  printf("| call | median ns | min-max ns |\n| --- | ---: | ---: |\n");
  double med[16], lo, hi;
  for (int k = 0; k < nrows; k++) {
    med[k] = median_of(rows[k].ns, nrounds, &lo, &hi);
    printf("| %s | %.1f | %.1f-%.1f |\n", rows[k].name, med[k], lo, hi);
  }
  /* The TCP work per call: a round's four calls each pay one entry. */
  for (int k = 4; k < nrows; k++) {
    printf("| TCP work per call, %s | %.1f | |\n", rows[k].name + 6, med[k] - med[0]);
  }
  printf("\nrequest bytes: /plaintext %zu, /json %zu; response bytes: /plaintext %d, /json %d\n",
         rounds_plain.request_len, rounds_json.request_len, RESP_PLAINTEXT, RESP_JSON);
  /* Machine-readable, for run.sh. */
  printf("entry_ns=%.1f\n", med[0]);
  return 0;
}
