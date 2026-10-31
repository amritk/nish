// The socket half of bench/ring-latency (run.mjs): the same three modes as
// ring.ts, with 16-byte messages over an AF_UNIX SOCK_STREAM socketpair
// between a parent and a forked child, one write and one read per message.
//
//     socketpair <pingpong|stream|idle> <n> <child-cpu>
#define _GNU_SOURCE
#include <sched.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define MSG 16

static int64_t now(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (int64_t)ts.tv_sec * 1000000000 + ts.tv_nsec;
}

static void put(int fd, int64_t v) {
  unsigned char buf[MSG] = {0};
  memcpy(buf, &v, 8);
  for (size_t off = 0; off < MSG;) {
    ssize_t w = write(fd, buf + off, MSG - off);
    if (w <= 0) exit(3);
    off += (size_t)w;
  }
}

static int64_t get(int fd) {
  unsigned char buf[MSG];
  for (size_t off = 0; off < MSG;) {
    ssize_t r = read(fd, buf + off, MSG - off);
    if (r <= 0) exit(4);
    off += (size_t)r;
  }
  int64_t v;
  memcpy(&v, buf, 8);
  return v;
}

static int percentile(const int *hist, int n, int pct) {
  int64_t want = ((int64_t)n * pct + 99) / 100, seen = 0;
  for (int k = 0; k <= 10000; k++) {
    seen += hist[k];
    if (seen >= want) return k * 10;
  }
  return 100000;
}

int main(int argc, char **argv) {
  if (argc < 4) {
    fprintf(stderr, "usage: socketpair <pingpong|stream|idle> <n> <child-cpu>\n");
    return 2;
  }
  const char *mode = argv[1];
  int n = atoi(argv[2]), cpu = atoi(argv[3]);
  int sv[2];
  if (socketpair(AF_UNIX, SOCK_STREAM, 0, sv) != 0) return 1;
  pid_t pid = fork();
  if (pid == 0) {
    if (cpu >= 0) {
      cpu_set_t set;
      CPU_ZERO(&set);
      CPU_SET(cpu, &set);
      sched_setaffinity(0, sizeof set, &set);
    }
    close(sv[0]);
    int64_t count = 0;
    for (;;) {
      int64_t v = get(sv[1]);
      if (strcmp(mode, "pingpong") == 0) put(sv[1], v);
      if (v == -1) break;
      count++;
    }
    if (strcmp(mode, "pingpong") != 0) put(sv[1], count);
    _exit(0);
  }
  close(sv[1]);
  int fd = sv[0];
  if (strcmp(mode, "pingpong") == 0) {
    static int hist[10001];
    int64_t sum = 0;
    int warm = n / 10;
    for (int i = 0; i < n + warm; i++) {
      int64_t t0 = now();
      put(fd, i);
      get(fd);
      if (i >= warm) {
        int64_t d = now() - t0;
        sum += d;
        hist[d >= 100000 ? 10000 : d / 10]++;
      }
    }
    put(fd, -1);
    get(fd);
    printf("pingpong %d p50_ns %d p99_ns %d mean_ns %lld\n", n, percentile(hist, n, 50),
           percentile(hist, n, 99), (long long)(sum / (n > 0 ? n : 1)));
  } else {
    int idle = strcmp(mode, "idle") == 0;
    int64_t t0 = now();
    for (int i = 0; i < n; i++) {
      put(fd, i);
      if (idle) {
        struct timespec ms = {0, 1000000};
        nanosleep(&ms, NULL);
      }
    }
    put(fd, -1);
    int64_t got = get(fd);
    int64_t ns = now() - t0;
    printf("%s %d got %lld msgs_per_s %lld\n", mode, n, (long long)got,
           (long long)((int64_t)n * 1000000000 / (ns > 0 ? ns : 1)));
  }
  waitpid(pid, NULL, 0);
  return 0;
}
