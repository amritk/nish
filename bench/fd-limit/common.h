/* Shared by the descriptor-limit prototypes (bench/README.md, "Descriptor
 * limit"). The response is the one `bench/http1-server.ts` gives
 * `GET /plaintext`: a 116-byte header block and 13 bytes of text, 129 bytes
 * on the wire (`bench/syscall-cost/entry.c` has the same bytes). The date is
 * fixed: a server that formats it once a second does no per-request work for
 * it, so leaving it out of both designs changes neither. */
#ifndef FD_LIMIT_COMMON_H
#define FD_LIMIT_COMMON_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>

static const char RESPONSE[] = "HTTP/1.1 200 OK\r\n"
                               "Server: nish\r\n"
                               "Content-Type: text/plain\r\n"
                               "Content-Length: 13\r\n"
                               "Date: Sun, 15 Nov 2026 12:00:00 GMT\r\n"
                               "\r\n"
                               "Hello, World!";
#define RESPONSE_LEN (sizeof RESPONSE - 1)

static const char REQUEST[] = "GET /plaintext HTTP/1.1\r\nHost: 127.0.0.1:8080\r\n\r\n";
#define REQUEST_LEN (sizeof REQUEST - 1)

/* Raise the soft descriptor limit to the hard one, as the Nish runtime's first
 * nish:net call does (#1548), and return the soft limit in force. */
static inline long raise_nofile(void) {
  struct rlimit rl;
  if (getrlimit(RLIMIT_NOFILE, &rl) != 0) return -1;
  rl.rlim_cur = rl.rlim_max;
  (void)setrlimit(RLIMIT_NOFILE, &rl);
  (void)getrlimit(RLIMIT_NOFILE, &rl);
  return (long)rl.rlim_cur;
}

/* Count the complete requests in a chunk by their blank line. The client sends
 * one request at a time and never splits one, so a chunk holds whole
 * requests. */
static inline int count_requests(const char *p, long n) {
  int k = 0;
  for (long i = 3; i < n; i++) {
    if (p[i] == '\n' && p[i - 1] == '\r' && p[i - 2] == '\n' && p[i - 3] == '\r') k++;
  }
  return k;
}

/* The number of entries in /proc/self/fd, less the descriptor opendir holds:
 * the process's own descriptor table, which direct descriptors never enter. */
#include <dirent.h>
static inline long count_fds(void) {
  DIR *d = opendir("/proc/self/fd");
  if (!d) return -1;
  long n = 0;
  struct dirent *e;
  while ((e = readdir(d)) != NULL) {
    if (e->d_name[0] != '.') n++;
  }
  closedir(d);
  return n - 1;
}

#endif
