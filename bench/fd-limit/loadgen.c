/* The load generator for the descriptor-limit prototypes. It opens C keep-alive
 * connections to 127.0.0.1:<port> from P child processes, each bound to its
 * own loopback source address (127.0.0.10, .11, ...) so that no
 * source/destination pair runs out of ephemeral ports, and each holding fewer
 * descriptors than its own RLIMIT_NOFILE. Once every connection is up it sends
 * requests at a fixed total rate, round-robin over the connections that have
 * no request outstanding: a fixed rate keeps the offered load the same for
 * both designs at every C, so their CPU per request compares like for like.
 *
 * Then it measures the server: the user and system time of the pids it is
 * given (/proc/<pid>/stat), their RSS and PSS, their descriptor tables, and
 * the box's non-idle CPU (/proc/stat), over a window after a warm-up, and
 * prints one `key=value` line.
 *
 * Usage: loadgen -c <conns> -r <req/s> -p <port> -w <warmup s> -d <seconds>
 *                -n <server pid,pid,...> [-P <client processes>] [-l <label>] */
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

struct shared {
  volatile int go, stop;
  volatile long established[MAX_CHILD], failed[MAX_CHILD], ready[MAX_CHILD];
  volatile long responses[MAX_CHILD], sent[MAX_CHILD], starved[MAX_CHILD];
};

static struct shared *sh;

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
};

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

static void child(int k, long n, double rate, int port) {
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
  while (!sh->stop) {
    long due = (long)(rate * (now() - t0)) - sent;
    for (long j = 0; j < due; j++) {
      long scanned = 0;
      while (scanned < n && cs[cursor].state != C_IDLE) {
        cursor = (cursor + 1) % n;
        scanned++;
      }
      if (scanned == n) {
        /* Every connection has a request outstanding: the server is behind. */
        starved += due - j;
        sent += due - j;
        break;
      }
      struct conn *c = &cs[cursor];
      if (send(c->fd, REQUEST, REQUEST_LEN, MSG_NOSIGNAL) == (ssize_t)REQUEST_LEN) c->state = C_BUSY;
      cursor = (cursor + 1) % n;
      sent++;
    }
    int m = epoll_wait(ep, evs, 1024, 1);
    for (int i = 0; i < m; i++) {
      struct conn *c = &cs[evs[i].data.u32];
      ssize_t r = read(c->fd, buf, sizeof buf);
      if (r <= 0) {
        if (r == 0 || (errno != EAGAIN && errno != EINTR)) {
          close(c->fd);
          c->state = C_NONE;
        }
        continue;
      }
      long got = c->got + r;
      while (got >= (long)RESPONSE_LEN) {
        got -= (long)RESPONSE_LEN;
        responses++;
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

static void take(struct sample *s, const int *pids, int npids, int nchild) {
  s->t = now();
  server_ticks(pids, npids, &s->ticks_user, &s->ticks_sys);
  box_ticks(&s->box_busy, &s->box_softirq);
  s->responses = 0;
  for (int k = 0; k < nchild; k++) s->responses += sh->responses[k];
}

int main(int argc, char **argv) {
  long conns = 1000;
  double rate = 20000, warmup = 3, seconds = 10;
  int port = 8080, nchild = 0, npids = 0, opt;
  int pids[MAX_PIDS];
  const char *label = "run";
  while ((opt = getopt(argc, argv, "c:r:p:w:d:n:P:l:")) != -1) {
    switch (opt) {
    case 'c': conns = atol(optarg); break;
    case 'r': rate = atof(optarg); break;
    case 'p': port = atoi(optarg); break;
    case 'w': warmup = atof(optarg); break;
    case 'd': seconds = atof(optarg); break;
    case 'P': nchild = atoi(optarg); break;
    case 'l': label = optarg; break;
    case 'n':
      for (char *t = strtok(optarg, ","); t && npids < MAX_PIDS; t = strtok(NULL, ",")) pids[npids++] = atoi(t);
      break;
    default:
      fprintf(stderr, "usage: loadgen -c conns -r rate -p port -w warmup -d seconds -n pids [-P procs] [-l label]\n");
      return 2;
    }
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
  pid_t kids[MAX_CHILD];
  for (int k = 0; k < nchild; k++) {
    long n = conns / nchild + (k < conns % nchild ? 1 : 0);
    double r = rate * (double)n / (double)conns;
    kids[k] = fork();
    if (kids[k] == 0) child(k, n, r, port);
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
  take(&a, pids, npids, nchild);
  usleep((useconds_t)(seconds * 1e6));
  take(&b, pids, npids, nchild);

  long rss = 0, pss = 0, fds = 0;
  for (int i = 0; i < npids; i++) {
    rss += status_kb(pids[i], "status", "VmRSS:");
    pss += status_kb(pids[i], "smaps_rollup", "Pss:");
    fds += fd_count(pids[i]);
  }
  long used_mb = (meminfo_kb("MemTotal:") - meminfo_kb("MemAvailable:")) / 1024;
  long tcp_mb = tcp_mem_pages() * 4 / 1024;
  sh->stop = 1;
  long sent = 0, starved = 0;
  for (int k = 0; k < nchild; k++) {
    sent += sh->sent[k];
    starved += sh->starved[k];
  }
  for (int k = 0; k < nchild; k++) waitpid(kids[k], NULL, 0);

  double hz = (double)sysconf(_SC_CLK_TCK);
  double dt = b.t - a.t;
  double req = (double)(b.responses - a.responses);
  double us_user = (double)(b.ticks_user - a.ticks_user) / hz * 1e6 / req;
  double us_sys = (double)(b.ticks_sys - a.ticks_sys) / hz * 1e6 / req;
  double box_us = (double)(b.box_busy - a.box_busy) / hz * 1e6 / req;
  double si_us = (double)(b.box_softirq - a.box_softirq) / hz * 1e6 / req;
  printf("label=%s conns=%ld up=%ld failed=%ld clients=%d connect_s=%.1f rps=%.0f srv_us=%.2f srv_user_us=%.2f "
         "srv_sys_us=%.2f box_us=%.2f softirq_us=%.2f srv_rss_mb=%.1f srv_pss_mb=%.1f srv_fds=%ld mem_used_mb=%ld "
         "tcp_mem_mb=%ld starved=%ld sent=%ld\n",
         label, conns, up, failed, nchild, connect_s, req / dt, us_user + us_sys, us_user, us_sys, box_us, si_us,
         (double)rss / 1024, (double)pss / 1024, fds, used_mb, tcp_mb, starved, sent);
  return 0;
}
