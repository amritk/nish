/* The TCP segment sampler for bench/handler-ring/run.sh: every 10 ms until it
 * is killed, it prints one line, `<CLOCK_MONOTONIC s> <OutSegs> <InSegs>`,
 * read from the `Tcp:` rows of /proc/net/snmp. Those counters are the
 * network namespace's, so they count every TCP segment on the box: the
 * server's and the load generator's, data and pure ACKs alike. run.sh reads
 * the counters at loadgen's window edges (win_lo, win_hi, on the same clock)
 * by linear interpolation between the two samples around each edge.
 *
 *   segs > samples.txt
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

/* OutSegs and InSegs from /proc/net/snmp: the first `Tcp:` line names the
 * columns, the second holds the values. Returns 0 on success. */
static int read_segs(long long *out, long long *in) {
  FILE *f = fopen("/proc/net/snmp", "r");
  if (!f) return -1;
  char names[1024], line[1024];
  int found = -1;
  names[0] = 0;
  while (fgets(line, sizeof line, f)) {
    if (strncmp(line, "Tcp:", 4) != 0) continue;
    if (!names[0]) {
      memcpy(names, line, sizeof names);
      continue;
    }
    /* Walk the names and the values together. */
    char *ns = NULL, *vs = NULL;
    char *n = strtok_r(names, " \n", &ns), *v = strtok_r(line, " \n", &vs);
    int got = 0;
    while (n && v) {
      if (strcmp(n, "OutSegs") == 0) {
        *out = atoll(v);
        got |= 1;
      } else if (strcmp(n, "InSegs") == 0) {
        *in = atoll(v);
        got |= 2;
      }
      n = strtok_r(NULL, " \n", &ns);
      v = strtok_r(NULL, " \n", &vs);
    }
    found = got == 3 ? 0 : -1;
    break;
  }
  fclose(f);
  return found;
}

int main(void) {
  setvbuf(stdout, NULL, _IOLBF, 0);
  const struct timespec tick = {0, 10 * 1000 * 1000};
  for (;;) {
    struct timespec ts;
    long long out = 0, in = 0;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    if (read_segs(&out, &in) != 0) {
      fprintf(stderr, "segs: no Tcp OutSegs/InSegs in /proc/net/snmp\n");
      return 1;
    }
    printf("%.6f %lld %lld\n", (double)ts.tv_sec + (double)ts.tv_nsec / 1e9, out, in);
    nanosleep(&tick, NULL);
  }
}
