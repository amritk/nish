/* The C test of runtime/runtime-uring.c, the io_uring ring layer (WP63 S1),
 * driven by tests/run.js's `uring` section: `uring-test <mode>` answers by
 * exit status alone, 0 for a pass, 77 for a kernel or runner that cannot run
 * the mode (with a `skip:` line on stdout), anything else for a failure with
 * its reason on stderr.
 *
 * The layer is included rather than linked so the test reaches it without a
 * header (S2 adds the declarations to runtime-net.c). Each mode but
 * `fallback` forks an echo server that drives one set on a listener the
 * parent made, and the parent plays every client. The server sets its own
 * RLIMIT_NOFILE, so what the check proves does not depend on the runner's
 * limits, only on the hard limit letting the parent hold its clients.
 *
 *  - `beyond`: 3,000 connections held at once under a soft limit of 1,024,
 *    in three rings, with fewer than 64 descriptors in the server's table.
 *  - `bound`: a set of one ring of 8 slots and 50 clients. Every client is
 *    served and none is dropped by an accept that found the table full.
 *  - `taskrun`: 500 clients over four rings send at once. The burst completes
 *    (a ring left with queued work it never ran stalls it), and on a kernel
 *    that caps the work one enter runs the set entered again for the rest.
 *  - `overflow`: a CQ of 8 entries under 256 clients; FEAT_NODROP keeps what
 *    did not fit and the set drains it.
 *  - `nobufs`: 2 provided buffers under 64 clients; a recv the kernel ends
 *    with -ENOBUFS is re-armed, not closed.
 *  - `short`: one 8 MiB send to a client that is slow to read. The kernel
 *    takes it in pieces, and every byte arrives in order.
 *  - `fallback`: a seccomp filter refuses io_uring_setup (EPERM, then ENOSYS)
 *    or io_uring_register (EPERM). The probe and the open answer that errno,
 *    the process lives, and no descriptor leaks.
 */
#define _GNU_SOURCE
#include "../../runtime/runtime-uring.c"

#include <dirent.h>
#include <errno.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <signal.h>
#include <stdio.h>
#include <sys/prctl.h>
#include <sys/utsname.h>
#include <sys/wait.h>
#include <time.h>

#define SKIP 77

static int fd_count(void) {
  DIR *d = opendir("/proc/self/fd");
  if (!d) return -1;
  int n = 0;
  struct dirent *e;
  while ((e = readdir(d)) != NULL)
    if (e->d_name[0] != '.') n++;
  closedir(d);
  return n - 1; /* the directory's own descriptor */
}

static int fail(const char *what) {
  fprintf(stderr, "uring-test: %s\n", what);
  return 1;
}

/* What one mode asks of the server and its clients. */
struct mode {
  const char *name;
  struct nish_uring_opts opts;
  int clients;
  int nofile;        /* the server's soft RLIMIT_NOFILE, 0 to leave it */
  int close_after;   /* the server closes each connection once it has echoed */
  int payload;       /* bytes each client sends and reads back */
  int big;           /* bytes the server sends in one call (the short and reset modes) */
  int reset;         /* the client resets the connection while that send is in flight */
};

static uint8_t pattern(int client, int i) { return (uint8_t)(client * 31 + i * 7 + 1); }

/* The echo server. Its exit status is the verdict on the set's side. */
static int serve(const struct mode *m, int listener) {
  alarm(60);
  if (m->nofile) {
    struct rlimit rl;
    if (getrlimit(RLIMIT_NOFILE, &rl) != 0) return fail("getrlimit");
    rl.rlim_cur = (rlim_t)m->nofile;
    if (setrlimit(RLIMIT_NOFILE, &rl) != 0) return fail("setrlimit");
  }
  struct nish_uring_set *s;
  int rc = nish_uring_open(&s, listener, &m->opts);
  if (rc < 0) {
    fprintf(stderr, "uring-test: open answered %d\n", rc);
    return 1;
  }
  int *echoed = calloc((size_t)m->opts.rings_max * 65536, sizeof *echoed);
  int *pending = malloc((size_t)m->clients * 2 * sizeof *pending);
  int npending = 0;
  int closed = 0, live = 0, peak_live = 0, peak_fds = 0, checked_stale = 0, send_failed = 0;
  struct nish_uring_event ev[64];
  uint8_t *big = NULL;
  if (m->big) {
    big = malloc((size_t)m->big);
    for (int i = 0; i < m->big; i++) big[i] = pattern(0, i);
  }
  while (closed < m->clients) {
    for (int i = 0; i < npending; i += 2) {
      if (nish_uring_close(s, pending[i], pending[i + 1]) == -EAGAIN) continue;
      closed++;
      live--;
      if (!checked_stale) {
        checked_stale = 1;
        if (nish_uring_send(s, pending[i], pending[i + 1], (const uint8_t *)"x", 1) != -EBADF)
          return fail("a send on a closed slot did not answer -EBADF");
        if (nish_uring_close(s, pending[i], pending[i + 1]) != -EBADF)
          return fail("a second close of a slot did not answer -EBADF");
      }
      pending[i] = pending[npending - 2];
      pending[i + 1] = pending[npending - 1];
      npending -= 2;
      i -= 2;
    }
    int n = nish_uring_wait(s, 1000, ev, 64);
    if (n < 0) {
      fprintf(stderr, "uring-test: wait answered %d\n", n);
      return 1;
    }
    for (int i = 0; i < n; i++) {
      struct nish_uring_event *e = &ev[i];
      int *done = &echoed[e->ring * 65536 + e->slot];
      switch (e->kind) {
      case NISH_URING_ACCEPTED:
        *done = 0;
        if (++live > peak_live) peak_live = live;
        if (m->opts.slots && live > m->opts.slots * m->opts.rings_max) return fail("more live connections than slots");
        if (live == m->clients) peak_fds = fd_count();
        break;
      case NISH_URING_DATA:
        if (m->big) {
          if (nish_uring_send(s, e->ring, e->slot, big, m->big) != m->big) return fail("the big send was refused");
          break;
        }
        if (nish_uring_send(s, e->ring, e->slot, e->data, e->res) != e->res) return fail("an echo was refused");
        *done += e->res;
        if (m->close_after && *done == m->payload) {
          pending[npending++] = e->ring;
          pending[npending++] = e->slot;
        }
        break;
      case NISH_URING_HUP:
        /* The reset mode closes on the send's failure, which a close here could race. */
        if (m->reset) break;
        pending[npending++] = e->ring;
        pending[npending++] = e->slot;
        break;
      case NISH_URING_SEND_FAILED:
        if (m->reset) {
          send_failed++;
          pending[npending++] = e->ring;
          pending[npending++] = e->slot;
          break;
        }
        fprintf(stderr, "uring-test: a send failed with %d\n", e->res);
        return 1;
      case NISH_URING_ACCEPT_FAILED:
        fprintf(stderr, "uring-test: accepting failed with %d\n", e->res);
        return 1;
      default:
        return fail("an event of no known kind");
      }
    }
  }
  struct nish_uring_stats st;
  nish_uring_stats(s, &st);
  fprintf(stderr,
          "uring-test %s: rings %lld, peak live %d, peak fds %d, taskrun re-entries %lld, overflow drains %lld, "
          "nobufs re-arms %lld, send requeues %lld\n",
          m->name, (long long)st.rings, peak_live, peak_fds, (long long)st.taskrun_reentries,
          (long long)st.overflow_drains, (long long)st.nobufs_rearms, (long long)st.send_requeues);
  if (st.bound_violations != 0) return fail("an accept landed past the table, or the table was full");
  if (st.accept_errors != 0) return fail("an accept failed");
  if (st.max_accepting_rings > 1) return fail("more than one ring accepted at once");
  if (st.live != 0) return fail("the set still counts live connections");
  if (strcmp(m->name, "beyond") == 0) {
    if (peak_live != m->clients) return fail("the 3,000 connections were not all held at once");
    if (st.rings != 3) return fail("3,000 connections under a limit of 1,024 did not take three rings");
    if (peak_fds < 0 || peak_fds >= 64) return fail("the server's descriptor table held 64 or more");
  }
  if (strcmp(m->name, "bound") == 0 && peak_live > 8) return fail("the bound let more than 8 in");
  if (strcmp(m->name, "taskrun") == 0) {
    struct utsname u;
    int major = 0, minor = 0;
    if (uname(&u) == 0) sscanf(u.release, "%d.%d", &major, &minor);
    /* The cap is measured on v6.18 (docs/wp63-iouring-net.md §2, item 4). */
    if ((major > 6 || (major == 6 && minor >= 18)) && st.taskrun_reentries == 0)
      return fail("a burst of 500 never needed the TASKRUN re-entry");
  }
  if (strcmp(m->name, "overflow") == 0 && st.overflow_drains == 0) return fail("a CQ of 8 never overflowed");
  if (strcmp(m->name, "nobufs") == 0 && st.nobufs_rearms == 0) return fail("two buffers never ran out");
  if (m->reset && send_failed != 1) return fail("the reset send did not fail exactly once");
  int before = fd_count();
  nish_uring_destroy(s);
  if (fd_count() != before - 1 - 2 * (int)st.rings) return fail("destroy left a descriptor open");
  return 0;
}

static int read_all(int fd, uint8_t *p, int n) {
  int got = 0;
  while (got < n) {
    ssize_t k = read(fd, p + got, (size_t)(n - got));
    if (k <= 0) return -1;
    got += (int)k;
  }
  return 0;
}

/* The parent's side: connect every client, send, read every echo back. */
static int run_clients(const struct mode *m, int port) {
  int *fds = malloc((size_t)m->clients * sizeof *fds);
  struct sockaddr_in a;
  memset(&a, 0, sizeof a);
  a.sin_family = AF_INET;
  a.sin_port = htons((uint16_t)port);
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  for (int c = 0; c < m->clients; c++) {
    fds[c] = socket(AF_INET, SOCK_STREAM, 0);
    if (fds[c] < 0) return fail("client socket");
    if (connect(fds[c], (struct sockaddr *)&a, sizeof a) != 0) return fail("client connect");
  }
  int len = m->big ? 1 : m->payload;
  uint8_t *buf = malloc(m->big ? (size_t)m->big : (size_t)len);
  for (int c = 0; c < m->clients; c++) {
    uint8_t out[4096];
    for (int i = 0; i < len; i++) out[i] = pattern(c, i);
    if (write(fds[c], out, (size_t)len) != len) return fail("client write");
  }
  if (m->reset) {
    /* One byte back says the big send is in the kernel; the reset fails it. */
    uint8_t z;
    if (read(fds[0], &z, 1) != 1) return fail("the big send never started");
    struct linger lg = {1, 0};
    if (setsockopt(fds[0], SOL_SOCKET, SO_LINGER, &lg, sizeof lg) != 0) return fail("SO_LINGER");
  } else if (m->big) {
    struct timespec t = {0, 200 * 1000 * 1000};
    nanosleep(&t, NULL);
    if (read_all(fds[0], buf, m->big) != 0) return fail("the big send came back short");
    for (int i = 0; i < m->big; i++)
      if (buf[i] != pattern(0, i)) return fail("the big send came back out of order");
  } else {
    for (int c = 0; c < m->clients; c++) {
      if (read_all(fds[c], buf, len) != 0) return fail("an echo never came back: a connection was dropped");
      for (int i = 0; i < len; i++)
        if (buf[i] != pattern(c, i)) return fail("an echo came back wrong");
      if (m->close_after) {
        uint8_t z;
        if (read(fds[c], &z, 1) != 0) return fail("a served connection was not closed");
      }
    }
  }
  for (int c = 0; c < m->clients; c++) close(fds[c]);
  free(fds);
  free(buf);
  return 0;
}

static int run_mode(const struct mode *m) {
  int p = nish_uring_probe();
  if (p < 0) {
    printf("skip: io_uring is unavailable here (the probe answered %d)\n", p);
    return SKIP;
  }
  struct rlimit rl;
  if (getrlimit(RLIMIT_NOFILE, &rl) != 0) return fail("getrlimit");
  rlim_t want = (rlim_t)m->clients + 64;
  if (rl.rlim_max != RLIM_INFINITY && rl.rlim_max < want) {
    printf("skip: the hard RLIMIT_NOFILE (%llu) is too low for %d clients\n", (unsigned long long)rl.rlim_max,
           m->clients);
    return SKIP;
  }
  if (rl.rlim_cur != RLIM_INFINITY && rl.rlim_cur < want) {
    rl.rlim_cur = want;
    if (setrlimit(RLIMIT_NOFILE, &rl) != 0) return fail("setrlimit");
  }
  int l = socket(AF_INET, SOCK_STREAM, 0);
  int one = 1;
  setsockopt(l, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
  struct sockaddr_in a;
  memset(&a, 0, sizeof a);
  a.sin_family = AF_INET;
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  socklen_t al = sizeof a;
  if (bind(l, (struct sockaddr *)&a, sizeof a) != 0 || listen(l, 4096) != 0 ||
      getsockname(l, (struct sockaddr *)&a, &al) != 0)
    return fail("listener");
  fflush(NULL);
  pid_t pid = fork();
  if (pid < 0) return fail("fork");
  if (pid == 0) _exit(serve(m, l));
  close(l);
  alarm(90);
  int rc = run_clients(m, ntohs(a.sin_port));
  if (rc != 0) {
    kill(pid, SIGKILL);
    waitpid(pid, NULL, 0);
    return rc;
  }
  int status;
  if (waitpid(pid, &status, 0) != pid) return fail("waitpid");
  if (!WIFEXITED(status)) return fail("the server died of a signal");
  return WEXITSTATUS(status);
}

/* A child installs a filter that answers `err` from syscall `nr`, then asks
 * the layer for a set. */
static int fallback_one(int nr, int err) {
  fflush(NULL);
  pid_t pid = fork();
  if (pid < 0) return fail("fork");
  if (pid == 0) {
    struct sock_filter f[] = {
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, (unsigned)nr, 0, 1),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | ((unsigned)err & SECCOMP_RET_DATA)),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    };
    struct sock_fprog prog = {(unsigned short)(sizeof f / sizeof f[0]), f};
    if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 || prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &prog) != 0) {
      printf("skip: seccomp filters are unavailable here\n");
      _exit(SKIP);
    }
    int before = fd_count();
    int p = nish_uring_probe();
    if (p != -err) {
      fprintf(stderr, "uring-test: syscall %d refused with %d, but the probe answered %d\n", nr, err, p);
      _exit(1);
    }
    struct nish_uring_set *s = (struct nish_uring_set *)1;
    int o = nish_uring_open(&s, 0, NULL);
    if (o != -err || s != NULL) _exit(fail("the open did not answer the probe's errno with no set"));
    if (fd_count() != before) _exit(fail("a refused probe left a descriptor open"));
    _exit(0);
  }
  int status;
  if (waitpid(pid, &status, 0) != pid) return fail("waitpid");
  if (!WIFEXITED(status)) return fail("a refused io_uring killed the process");
  return WEXITSTATUS(status);
}

static int fallback(void) {
  int cases[][2] = {{__NR_io_uring_setup, EPERM}, {__NR_io_uring_setup, ENOSYS}, {__NR_io_uring_register, EPERM}};
  for (size_t i = 0; i < sizeof cases / sizeof cases[0]; i++) {
    int rc = fallback_one(cases[i][0], cases[i][1]);
    if (rc != 0) return rc;
  }
  return 0;
}

int main(int argc, char **argv) {
  setvbuf(stdout, NULL, _IONBF, 0);
  signal(SIGPIPE, SIG_IGN);
  if (argc != 2) return fail("usage: uring-test <mode>");
  if (strcmp(argv[1], "fallback") == 0) return fallback();
  static const struct mode modes[] = {
      {"beyond", {0, 8, 0, 0, 0, 0}, 3000, 1024, 0, 64, 0, 0},
      {"bound", {8, 1, 0, 0, 0, 0}, 50, 0, 1, 64, 0, 0},
      {"taskrun", {128, 8, 0, 0, 0, 0}, 500, 0, 0, 512, 0, 0},
      {"overflow", {512, 1, 8, 8, 0, 0}, 256, 0, 0, 64, 0, 0},
      {"nobufs", {128, 1, 0, 0, 2, 64}, 64, 0, 0, 1024, 0, 0},
      {"short", {8, 1, 0, 0, 0, 0}, 1, 0, 0, 1, 8 << 20, 0},
      {"reset", {8, 1, 0, 0, 0, 0}, 1, 0, 0, 1, 64 << 20, 1},
  };
  for (size_t i = 0; i < sizeof modes / sizeof modes[0]; i++)
    if (strcmp(argv[1], modes[i].name) == 0) return run_mode(&modes[i]);
  return fail("no such mode");
}
