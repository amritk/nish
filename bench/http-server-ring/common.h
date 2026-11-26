/* The request and descriptor-limit helper for bench/http-server-ring's
 * loadgen.c, a copy of bench/fd-limit/loadgen.c (see its header). The request
 * is HttpArena's latency route, the one its latency-1m and latency-10k
 * profiles send; the response length is not fixed here but given with -b,
 * because the server under test sets its own head (run.sh measures it). */
#ifndef HTTP_SERVER_RING_COMMON_H
#define HTTP_SERVER_RING_COMMON_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/resource.h>

static const char REQUEST[] = "GET /baseline11?a=1&b=2 HTTP/1.1\r\nHost: 127.0.0.1:8080\r\n\r\n";
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

#endif
