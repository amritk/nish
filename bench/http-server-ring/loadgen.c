/* A copy of bench/fd-limit/loadgen.c for bench/http-server-ring (WP71 S3),
 * changed in three places: the request is `GET /baseline11?a=1&b=2`
 * (common.h here), a response is counted at the -b <bytes> run.sh measures
 * instead of a fixed 129, and the line gains `mean_ms`, the mean of the
 * window's latencies, summed exactly rather than read from the histogram.
 * What follows is the original's description.
 *
 * The load generator for the descriptor-limit prototypes. It opens C keep-alive
 * connections to 127.0.0.1:<port> from P child processes, each bound to its
 * own loopback source address (127.0.0.10, .11, ...) so that no
 * source/destination pair runs out of ephemeral ports, and each holding fewer
 * descriptors than its own RLIMIT_NOFILE. Once every connection is up it sends
 * requests at a fixed total rate, round-robin over the connections that have
 * no request outstanding: a fixed rate keeps the offered load the same for
 * both designs at every C, so their CPU per request compares like for like.
 *
 * With -t <think s> it runs closed-loop instead: each connection sends its
 * next request <think s> after its last response, the first requests spread
 * evenly over the first <think s>, so the offered rate is about C / think and
 * a slow server sees fewer requests, as a keep-alive client with think time
 * would send. -r is ignored then.
 *
 * Then it measures the server: the user and system time of the pids it is
 * given (/proc/<pid>/stat), their RSS and PSS, their descriptor tables, and
 * the box's non-idle CPU (/proc/stat), over a window after a warm-up, and
 * prints one `key=value` line. The same window gives the latency
 * percentiles: every request sent inside it is timed from its send to the
 * last byte of its response as this process sees them, so the time includes
 * the client's own scheduling (P children on the load CPUs) and one clock
 * read per epoll_wait batch of up to 1,024 events; it goes into a
 * log-linear histogram (32 buckets an
 * octave, so a percentile reads within about 3%), and the run waits up to
 * 2 s past the window for the window's last answers. `lat_lost` counts the
 * window's requests still unanswered then (the window closes before the
 * last /proc reads, so a request sent during them is outside it); they are not in the histogram, so
 * a nonzero count makes every percentile a lower bound, and with no answer
 * at all they print n/a. win_lo and win_hi bound the window, CLOCK_MONOTONIC
 * seconds. `send_failed` counts sends that
 * failed or went short and `closed` the connections that closed or failed
 * after the load began. A closed connection sends nothing more. With -t a
 * connection whose send failed sends nothing more either, so a nonzero count
 * means the run offered less than C / think; without -t it stays idle and is
 * picked again, and a short send leaves a partial request on it. With -t, -w must be at
 * least the think time, so the window opens after the spread first requests.
 * The connect burst is outside the window: it starts after every connection
 * is up and the warm-up has run.
 *
 * With -i <idle s> the run then holds every connection open and sends nothing
 * more for <idle s>, and reads the servers' RSS and PSS and the box's Slab and
 * TCP buffer pages again, as idle_rss_kb, idle_pss_kb, idle_slab_kb and
 * idle_tcp_pages, beside the same reads taken before the first connect
 * (base_rss_kb, base_pss_kb, base_slab_kb, base_tcp_pages): their difference
 * over C is what an idle keep-alive connection holds once its last answer is
 * out. Slab and TCP pages are the box's, so they count both ends of every
 * loopback connection.
 *
 * Usage: loadgen -c <conns> -r <req/s> -p <port> -w <warmup s> -d <seconds>
 *                -n <server pid,pid,...> [-t <think s>] [-P <client processes>]
 *                [-l <label>] [-i <idle s>] -b <response bytes> */
#define _GNU_SOURCE
#include "common.h"

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdint.h>
#include <sys/epoll.h>
#include <sys/mman.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define MAX_CHILD 256
#define MAX_PIDS 64
#define PER_CHILD_MAX 19000
#define INFLIGHT_CONNECTS 512
/* The latency histogram: microseconds below 64 one bucket each, then 32
 * buckets an octave up to 2^40 µs. */
#define LAT_SUB 32
#define LAT_BUCKETS (64 + (40 - 6) * LAT_SUB)

struct shared {
  volatile int go, stop, pause;
  /* The measured window, CLOCK_MONOTONIC seconds: a request sent in
   * [win_lo, win_hi) is timed. win_hi is 0 while the window is open. */
  volatile double win_lo, win_hi;
  volatile long established[MAX_CHILD], failed[MAX_CHILD], ready[MAX_CHILD];
  volatile long responses[MAX_CHILD], sent[MAX_CHILD], starved[MAX_CHILD];
  volatile long win_sent[MAX_CHILD], win_answered[MAX_CHILD];
  /* Sends that failed or went short, and connections the server closed or
   * that failed, after go: either leaves a connection that sends no more. */
  volatile long send_failed[MAX_CHILD], closed[MAX_CHILD];
  volatile long lat[MAX_CHILD][LAT_BUCKETS];
  /* Each child's window latencies summed, in microseconds: the mean's numerator. */
  volatile double lat_sum[MAX_CHILD];
};

static struct shared *sh;
/* The bytes of one response, from -b. */
static long response_len;

static double now(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec + (double)ts.tv_nsec / 1e9;
}

enum { C_NONE, C_CONNECTING, C_IDLE, C_BUSY };

struct conn {
  int fd;
  uint8_t state;
  uint16_t got;
  uint8_t tries;
  double sent_at;
};

static int lat_bucket(double us) {
  if (us < 64) return us < 0 ? 0 : (int)us;
  uint64_t v = (uint64_t)us;
  int e = 63 - __builtin_clzll(v);
  if (e >= 40) return LAT_BUCKETS - 1;
  return 64 + (e - 6) * LAT_SUB + (int)((v >> (e - 5)) & (LAT_SUB - 1));
}

/* The middle of bucket b, in microseconds. */
static double lat_value(int b) {
  if (b < 64) return b + 0.5;
  int e = 6 + (b - 64) / LAT_SUB, sub = (b - 64) % LAT_SUB;
  double lo = (double)(1ull << e) * (1.0 + (double)sub / LAT_SUB);
  return lo + (double)(1ull << e) / LAT_SUB / 2;
}

static int in_window(double t) { return sh->win_lo > 0 && t >= sh->win_lo && (sh->win_hi == 0 || t < sh->win_hi); }

static int send_request(struct conn *c, int k, double t) {
  if (send(c->fd, REQUEST, REQUEST_LEN, MSG_NOSIGNAL) != (ssize_t)REQUEST_LEN) {
    sh->send_failed[k]++;
    return 0;
  }
  c->state = C_BUSY;
  c->sent_at = t;
  if (in_window(t)) sh->win_sent[k]++;
  return 1;
}

static int start_connect(struct conn *c, int ep, uint32_t idx, struct sockaddr_in *src, struct sockaddr_in *dst) {
  int fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
  if (fd < 0) return -errno;
  int one = 1;
  setsockopt(fd, IPPROTO_IP, IP_BIND_ADDRESS_NO_PORT, &one, sizeof one);
  struct linger lg = {1, 0};
  setsockopt(fd, SOL_SOCKET, SO_LINGER, &lg, sizeof lg);
  if (bind(fd, (struct sockaddr *)src, sizeof *src) != 0) {
    int e = errno;
    close(fd);
    return -e;
  }
  if (connect(fd, (struct sockaddr *)dst, sizeof *dst) != 0 && errno != EINPROGRESS) {
    int e = errno;
    close(fd);
    return -e;
  }
  c->fd = fd;
  c->state = C_CONNECTING;
  c->tries++;
  struct epoll_event ev = {.events = EPOLLOUT, .data.u32 = idx};
  epoll_ctl(ep, EPOLL_CTL_ADD, fd, &ev);
  return 0;
}

static void child(int k, long n, double rate, double think, int port) {
  (void)raise_nofile();
  struct sockaddr_in src, dst;
  memset(&src, 0, sizeof src);
  src.sin_family = AF_INET;
  src.sin_addr.s_addr = htonl((127u << 24) | (uint32_t)(10 + k));
  memset(&dst, 0, sizeof dst);
  dst.sin_family = AF_INET;
  dst.sin_port = htons((uint16_t)port);
  dst.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  struct conn *cs = calloc((size_t)n, sizeof *cs);
  int ep = epoll_create1(EPOLL_CLOEXEC);
  struct epoll_event evs[1024];
  long next = 0, inflight = 0, up = 0, failed = 0;
  char buf[8192];

  /* Connect, at most INFLIGHT_CONNECTS at a time. */
  while (up + failed < n) {
    while (inflight < INFLIGHT_CONNECTS && next < n) {
      int rc = start_connect(&cs[next], ep, (uint32_t)next, &src, &dst);
      if (rc < 0) {
        failed++;
        if (failed < 5) fprintf(stderr, "loadgen[%d]: connect: %s\n", k, strerror(-rc));
      } else {
        inflight++;
      }
      next++;
    }
    int m = epoll_wait(ep, evs, 1024, 100);
    for (int i = 0; i < m; i++) {
      struct conn *c = &cs[evs[i].data.u32];
      if (c->state != C_CONNECTING) continue;
      int err = 0;
      socklen_t len = sizeof err;
      getsockopt(c->fd, SOL_SOCKET, SO_ERROR, &err, &len);
      inflight--;
      if (err == 0) {
        c->state = C_IDLE;
        struct epoll_event ev = {.events = EPOLLIN, .data.u32 = evs[i].data.u32};
        epoll_ctl(ep, EPOLL_CTL_MOD, c->fd, &ev);
        up++;
      } else {
        close(c->fd);
        c->state = C_NONE;
        if (c->tries < 8) {
          if (start_connect(c, ep, evs[i].data.u32, &src, &dst) == 0) {
            inflight++;
            continue;
          }
        }
        failed++;
        if (failed < 5) fprintf(stderr, "loadgen[%d]: connect: %s\n", k, strerror(err));
      }
    }
    sh->established[k] = up;
    sh->failed[k] = failed;
  }
  sh->ready[k] = 1;
  while (!sh->go) usleep(10000);

  double t0 = now();
  long sent = 0, responses = 0, starved = 0, cursor = 0;
  /* Closed-loop: the connections waiting out their think time, in the order
   * they become due. Each connection is in it at most once, so n entries do. */
  struct due {
    uint32_t idx;
    double at;
  } *q = NULL;
  long qh = 0, qn = 0;
  if (think > 0) {
    q = calloc((size_t)n, sizeof *q);
    for (long i = 0; i < n; i++) {
      q[i].idx = (uint32_t)i;
      q[i].at = t0 + think * (double)i / (double)n;
    }
    qn = n;
  }
  while (!sh->stop) {
    double t = now();
    if (sh->pause) {
      /* -i: the connections stay open and send nothing more. */
    } else if (think > 0) {
      while (qn > 0 && q[qh].at <= t) {
        struct conn *c = &cs[q[qh].idx];
        qh = (qh + 1) % n;
        qn--;
        if (c->state == C_IDLE && send_request(c, k, t)) sent++;
      }
    } else {
      long due = (long)(rate * (t - t0)) - sent;
      for (long j = 0; j < due; j++) {
        long scanned = 0;
        while (scanned < n && cs[cursor].state != C_IDLE) {
          cursor = (cursor + 1) % n;
          scanned++;
        }
        if (scanned == n) {
          /* Every connection has a request outstanding: the due requests are
           counted as starved and not sent, so they are never timed. */
          starved += due - j;
          sent += due - j;
          break;
        }
        (void)send_request(&cs[cursor], k, t);
        cursor = (cursor + 1) % n;
        sent++;
      }
    }
    int m = epoll_wait(ep, evs, 1024, 1);
    t = now();
    for (int i = 0; i < m; i++) {
      uint32_t idx = evs[i].data.u32;
      struct conn *c = &cs[idx];
      ssize_t r = read(c->fd, buf, sizeof buf);
      if (r <= 0) {
        if (r == 0 || (errno != EAGAIN && errno != EINTR)) {
          close(c->fd);
          c->state = C_NONE;
          sh->closed[k]++;
        }
        continue;
      }
      long got = c->got + r;
      while (got >= response_len) {
        got -= response_len;
        responses++;
        if (c->state == C_BUSY && in_window(c->sent_at)) {
          sh->lat[k][lat_bucket((t - c->sent_at) * 1e6)]++;
          sh->lat_sum[k] += (t - c->sent_at) * 1e6;
          sh->win_answered[k]++;
        }
        if (c->state == C_BUSY && think > 0) {
          long tail = (qh + qn) % n;
          q[tail].idx = idx;
          q[tail].at = t + think;
          qn++;
        }
        c->state = C_IDLE;
      }
      c->got = (uint16_t)got;
    }
    sh->responses[k] = responses;
    sh->sent[k] = sent;
    sh->starved[k] = starved;
  }
  _exit(0);
}

struct sample {
  double t;
  long ticks_user, ticks_sys, responses;
  long long box_busy, box_softirq;
};

static void server_ticks(const int *pids, int npids, long *user, long *sys) {
  *user = *sys = 0;
  char path[64], line[1024];
  for (int i = 0; i < npids; i++) {
    snprintf(path, sizeof path, "/proc/%d/stat", pids[i]);
    FILE *f = fopen(path, "r");
    if (!f) continue;
    if (fgets(line, sizeof line, f)) {
      char *p = strrchr(line, ')');
      unsigned long ut = 0, st = 0;
      /* Fields 3.. after the name: state ppid pgrp session tty tpgid flags
       * minflt cminflt majflt cmajflt utime stime. */
      if (p && sscanf(p + 2, "%*c %*d %*d %*d %*d %*d %*u %*u %*u %*u %*u %lu %lu", &ut, &st) == 2) {
        *user += (long)ut;
        *sys += (long)st;
      }
    }
    fclose(f);
  }
}

static void box_ticks(long long *busy, long long *softirq) {
  FILE *f = fopen("/proc/stat", "r");
  long long u = 0, ni = 0, sy = 0, id = 0, io = 0, irq = 0, si = 0, stl = 0;
  if (f) {
    if (fscanf(f, "cpu %lld %lld %lld %lld %lld %lld %lld %lld", &u, &ni, &sy, &id, &io, &irq, &si, &stl) != 8) u = 0;
    fclose(f);
  }
  *busy = u + ni + sy + irq + si + stl;
  *softirq = si;
}

static long status_kb(int pid, const char *file, const char *key) {
  char path[64], line[256];
  snprintf(path, sizeof path, "/proc/%d/%s", pid, file);
  FILE *f = fopen(path, "r");
  if (!f) return 0;
  long v = 0;
  size_t kl = strlen(key);
  while (fgets(line, sizeof line, f)) {
    if (strncmp(line, key, kl) == 0) {
      v = atol(line + kl);
      break;
    }
  }
  fclose(f);
  return v;
}

static long fd_count(int pid) {
  char path[64];
  snprintf(path, sizeof path, "/proc/%d/fd", pid);
  DIR *d = opendir(path);
  if (!d) return -1;
  long n = 0;
  struct dirent *e;
  while ((e = readdir(d)) != NULL) {
    if (e->d_name[0] != '.') n++;
  }
  closedir(d);
  return n;
}

static long meminfo_kb(const char *key) {
  FILE *f = fopen("/proc/meminfo", "r");
  char line[256];
  long v = 0;
  size_t kl = strlen(key);
  if (!f) return 0;
  while (fgets(line, sizeof line, f)) {
    if (strncmp(line, key, kl) == 0) {
      v = atol(line + kl);
      break;
    }
  }
  fclose(f);
  return v;
}

static long tcp_mem_pages(void) {
  FILE *f = fopen("/proc/net/sockstat", "r");
  char line[256];
  long mem = 0;
  if (!f) return 0;
  while (fgets(line, sizeof line, f)) {
    char *p = strstr(line, "TCP:");
    if (p && (p = strstr(line, " mem "))) mem = atol(p + 5);
  }
  fclose(f);
  return mem;
}

static void take(struct sample *s, double t, const int *pids, int npids, int nchild) {
  s->t = t;
  server_ticks(pids, npids, &s->ticks_user, &s->ticks_sys);
  box_ticks(&s->box_busy, &s->box_softirq);
  s->responses = 0;
  for (int k = 0; k < nchild; k++) s->responses += sh->responses[k];
}

int main(int argc, char **argv) {
  long conns = 1000;
  double rate = 20000, warmup = 3, seconds = 10, think = 0, idle = 0;
  int port = 8080, nchild = 0, npids = 0, opt;
  int pids[MAX_PIDS];
  const char *label = "run";
  while ((opt = getopt(argc, argv, "c:r:p:w:d:n:P:l:t:i:b:")) != -1) {
    switch (opt) {
    case 'c': conns = atol(optarg); break;
    case 'r': rate = atof(optarg); break;
    case 'p': port = atoi(optarg); break;
    case 'w': warmup = atof(optarg); break;
    case 'd': seconds = atof(optarg); break;
    case 'P': nchild = atoi(optarg); break;
    case 'l': label = optarg; break;
    case 't': think = atof(optarg); break;
    case 'i': idle = atof(optarg); break;
    case 'b': response_len = atol(optarg); break;
    case 'n':
      for (char *t = strtok(optarg, ","); t && npids < MAX_PIDS; t = strtok(NULL, ",")) pids[npids++] = atoi(t);
      break;
    default:
      fprintf(stderr, "usage: loadgen -c conns -r rate -p port -w warmup -d seconds -n pids [-t think] [-P procs] [-l label] [-i idle] -b bytes\n");
      return 2;
    }
  }
  if (response_len <= 0) {
    fprintf(stderr, "loadgen: -b <response bytes> is required\n");
    return 2;
  }
  if (think > 0 && warmup < think) {
    /* The first requests spread over the first think seconds: a window that
     * opens sooner would time a ramp, not the steady load. */
    fprintf(stderr, "loadgen: -w %.2f is shorter than -t %.2f\n", warmup, think);
    return 2;
  }
  long need = (conns + PER_CHILD_MAX - 1) / PER_CHILD_MAX;
  if (nchild < need) nchild = (int)need;
  if (nchild < 1) nchild = 1;
  if (nchild > MAX_CHILD) {
    fprintf(stderr, "too many client processes\n");
    return 2;
  }
  signal(SIGPIPE, SIG_IGN);
  sh = mmap(NULL, sizeof *sh, PROT_READ | PROT_WRITE, MAP_SHARED | MAP_ANONYMOUS, -1, 0);
  memset((void *)sh, 0, sizeof *sh);
  /* Before the first connect: what -i's idle reads are taken against. */
  long base_rss = 0, base_pss = 0;
  for (int i = 0; i < npids; i++) {
    base_rss += status_kb(pids[i], "status", "VmRSS:");
    base_pss += status_kb(pids[i], "smaps_rollup", "Pss:");
  }
  long base_slab = meminfo_kb("Slab:"), base_tcp = tcp_mem_pages();
  pid_t kids[MAX_CHILD];
  for (int k = 0; k < nchild; k++) {
    long n = conns / nchild + (k < conns % nchild ? 1 : 0);
    double r = rate * (double)n / (double)conns;
    kids[k] = fork();
    if (kids[k] == 0) child(k, n, r, think, port);
  }
  double t_conn = now();
  for (;;) {
    int ready = 0;
    long up = 0;
    for (int k = 0; k < nchild; k++) {
      ready += sh->ready[k] ? 1 : 0;
      up += sh->established[k];
    }
    if (ready == nchild) break;
    if (now() - t_conn > 600) {
      fprintf(stderr, "loadgen: only %ld of %ld connected after 600 s\n", up, conns);
      break;
    }
    usleep(100000);
  }
  long up = 0, failed = 0;
  for (int k = 0; k < nchild; k++) {
    up += sh->established[k];
    failed += sh->failed[k];
  }
  double connect_s = now() - t_conn;
  sh->go = 1;
  usleep((useconds_t)(warmup * 1e6));
  struct sample a, b;
  /* Each edge is set before its /proc reads, so the window is exactly
   * [win_lo, win_hi): a request sent while take() reads /proc is either in
   * the window and its count of answers, or in neither. */
  sh->win_lo = now();
  take(&a, sh->win_lo, pids, npids, nchild);
  usleep((useconds_t)(seconds * 1e6));
  sh->win_hi = now();
  take(&b, sh->win_hi, pids, npids, nchild);

  long rss = 0, pss = 0, fds = 0;
  for (int i = 0; i < npids; i++) {
    rss += status_kb(pids[i], "status", "VmRSS:");
    pss += status_kb(pids[i], "smaps_rollup", "Pss:");
    fds += fd_count(pids[i]);
  }
  long used_mb = (meminfo_kb("MemTotal:") - meminfo_kb("MemAvailable:")) / 1024;
  long tcp_mb = tcp_mem_pages() * 4 / 1024;
  /* Wait for the window's last answers, up to 2 s. */
  for (double t_end = now() + 2; now() < t_end;) {
    long ws = 0, wa = 0;
    for (int k = 0; k < nchild; k++) {
      ws += sh->win_sent[k];
      wa += sh->win_answered[k];
    }
    if (wa >= ws) break;
    usleep(10000);
  }
  long idle_rss = 0, idle_pss = 0, idle_slab = 0, idle_tcp = 0;
  if (idle > 0) {
    sh->pause = 1;
    usleep((useconds_t)(idle * 1e6));
    for (int i = 0; i < npids; i++) {
      idle_rss += status_kb(pids[i], "status", "VmRSS:");
      idle_pss += status_kb(pids[i], "smaps_rollup", "Pss:");
    }
    idle_slab = meminfo_kb("Slab:");
    idle_tcp = tcp_mem_pages();
  }
  sh->stop = 1;
  long sent = 0, starved = 0, send_failed = 0, closed = 0;
  for (int k = 0; k < nchild; k++) {
    sent += sh->sent[k];
    starved += sh->starved[k];
    send_failed += sh->send_failed[k];
    closed += sh->closed[k];
  }
  for (int k = 0; k < nchild; k++) waitpid(kids[k], NULL, 0);
  long lat_n = 0, lat_lost = 0;
  double lat_sum = 0;
  static long hist[LAT_BUCKETS];
  for (int k = 0; k < nchild; k++) {
    lat_lost += sh->win_sent[k] - sh->win_answered[k];
    lat_sum += sh->lat_sum[k];
    for (int i = 0; i < LAT_BUCKETS; i++) {
      hist[i] += sh->lat[k][i];
      lat_n += sh->lat[k][i];
    }
  }
  /* p50, p99, p99.9 and the largest, in ms. */
  const double qs[3] = {0.50, 0.99, 0.999};
  double pv[4] = {0, 0, 0, 0};
  for (int j = 0; j < 3; j++) {
    long want = (long)((double)lat_n * qs[j] + 0.999999), acc = 0;
    for (int i = 0; i < LAT_BUCKETS && lat_n > 0; i++) {
      acc += hist[i];
      if (acc >= want) {
        pv[j] = lat_value(i) / 1000;
        break;
      }
    }
  }
  for (int i = LAT_BUCKETS - 1; i >= 0; i--) {
    if (hist[i] > 0) {
      pv[3] = lat_value(i) / 1000;
      break;
    }
  }

  /* With no answer in the window there is no quantile: n/a, not 0. */
  char ps[4][24], mean[24];
  for (int j = 0; j < 4; j++) {
    if (lat_n > 0) snprintf(ps[j], sizeof ps[j], "%.3f", pv[j]);
    else snprintf(ps[j], sizeof ps[j], "n/a");
  }
  if (lat_n > 0) snprintf(mean, sizeof mean, "%.3f", lat_sum / (double)lat_n / 1000);
  else snprintf(mean, sizeof mean, "n/a");
  double hz = (double)sysconf(_SC_CLK_TCK);
  double dt = b.t - a.t;
  double req = (double)(b.responses - a.responses);
  double us_user = (double)(b.ticks_user - a.ticks_user) / hz * 1e6 / req;
  double us_sys = (double)(b.ticks_sys - a.ticks_sys) / hz * 1e6 / req;
  double box_us = (double)(b.box_busy - a.box_busy) / hz * 1e6 / req;
  double si_us = (double)(b.box_softirq - a.box_softirq) / hz * 1e6 / req;
  printf("label=%s conns=%ld up=%ld failed=%ld clients=%d connect_s=%.1f rps=%.0f srv_us=%.2f srv_user_us=%.2f "
         "srv_sys_us=%.2f box_us=%.2f softirq_us=%.2f srv_rss_mb=%.1f srv_pss_mb=%.1f srv_fds=%ld mem_used_mb=%ld "
         "tcp_mem_mb=%ld starved=%ld sent=%ld think_s=%.2f p50_ms=%s mean_ms=%s p99_ms=%s p999_ms=%s max_ms=%s "
         "lat_n=%ld lat_lost=%ld send_failed=%ld closed=%ld win_lo=%.3f win_hi=%.3f\n",
         label, conns, up, failed, nchild, connect_s, req / dt, us_user + us_sys, us_user, us_sys, box_us, si_us,
         (double)rss / 1024, (double)pss / 1024, fds, used_mb, tcp_mb, starved, sent, think, ps[0], mean, ps[1], ps[2], ps[3],
         lat_n, lat_lost, send_failed, closed, sh->win_lo, sh->win_hi);
  if (idle > 0) {
    printf("label=%s conns=%ld up=%ld idle_s=%.1f base_rss_kb=%ld base_pss_kb=%ld base_slab_kb=%ld base_tcp_pages=%ld "
           "idle_rss_kb=%ld idle_pss_kb=%ld idle_slab_kb=%ld idle_tcp_pages=%ld\n",
           label, conns, up, idle, base_rss, base_pss, base_slab, base_tcp, idle_rss, idle_pss, idle_slab, idle_tcp);
  }
  return 0;
}
