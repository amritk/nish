/* The C test of runtime/runtime-uring.c, the io_uring ring layer (WP63 S1),
 * driven by tests/run.js's `uring` section: `uring-test <mode>` answers by
 * exit status alone, 0 for a pass, 77 for a kernel or runner that cannot run
 * the mode (with a `skip:` line on stdout), anything else for a failure with
 * its reason on stderr.
 *
 * The layer is included rather than linked so the test reaches it without a
 * header (S2 adds the declarations to runtime-net.c). Each mode but
 * `fallback`, `move`, `nowake`, `hupheld` and `nomem` forks an echo server that drives one set on
 * a listener the parent made, and the parent plays every client; `move`
 * drives its set and its clients in one process, so it can check the set
 * between waits, as `nomem` does, and `nowake` and `hupheld` fork only their client. The server sets its own
 * RLIMIT_NOFILE, so what the check proves does not depend on the runner's
 * limits, only on the hard limit letting the parent hold its clients.
 *
 *  - `beyond`: 3,000 connections held at once under a soft limit of 1,024,
 *    in three rings, with fewer than 64 descriptors in the server's table.
 *  - `bound`: a set of one ring of 8 slots and 50 clients. Every client is
 *    served and none is dropped by an accept that found the table full.
 *  - `taskrun`: 100 clients on one ring, held until all are accepted, then
 *    sent at once. One wait must take the whole burst: a DEFER_TASKRUN ring
 *    runs at most 20 queued completions per enter (6.13 and later), so the
 *    set enters again while IORING_SQ_TASKRUN is up. On 6.18 and later the
 *    re-entry counter must also move; an older kernel without the cap passes
 *    either way.
 *  - `overflow`: a CQ of 8 entries under 256 clients; FEAT_NODROP keeps what
 *    did not fit and the set drains it.
 *  - `nobufs`: 2 provided buffers under 64 clients; a recv the kernel ends
 *    with -ENOBUFS is re-armed, not closed.
 *  - `short`: one 8 MiB send to a client that is slow to read. The kernel
 *    takes it in pieces, and every byte arrives in order.
 *  - `reset`: one 64 MiB send to a client that resets the connection; the
 *    send fails, the slot closes, and the set lives.
 *  - `move`: rings of two slots. The last accept on ring 1 moves the
 *    accepting job back to ring 0, which that wait had already serviced; the
 *    wait still hands ring 0's new accepts to the kernel before it returns,
 *    no ring holds a submission after any wait, and the next client is
 *    accepted while the caller sleeps on `nish_uring_fd` for as long as
 *    `nish_uring_sleep_ms` answers, as its contract says.
 *  - `nowake`: ring 0's eventfd is unregistered, as a signal the kernel lost
 *    for good would leave it (NURING-8). A client that connects while a wait
 *    of -1 sleeps is still accepted, within a second: the sleep's bound, not
 *    the eventfd, ends it.
 *  - `hupheld`: a client sends a few bytes and resets. Once the set has
 *    reported the reset's hangup (-ECONNRESET), holding the slot's recv and
 *    letting it go must arm nothing: a recv armed again on the reset socket
 *    would end at once with 0, a second hangup that reads as an orderly end
 *    (NURING-27).
 *  - `nomem`: two accepts in a row answer -ENOMEM, as they do while the
 *    kernel is short of memory for a socket. Each pauses accepting and is
 *    reported once, the second with twice the first's back-off; a paused set
 *    does not ask its caller to wake at once, and resumes when the back-off
 *    ends; and a client that connects afterwards is still accepted. The set
 *    does not stop accepting for good (NURING-28).
 *  - `fallback`: io_uring refused or incomplete. A seccomp filter answers
 *    io_uring_setup with EPERM, ENOSYS or EINVAL, or io_uring_register with
 *    EPERM or EINVAL; the UR_SYS_SETUP and UR_SYS_REGISTER hooks answer
 *    -EINVAL to both setup attempts, hide FEAT_NODROP, or hide the SEND
 *    opcode. The probe and the open answer what sends a caller to epoll
 *    (the errno, or -EOPNOTSUPP for a missing feature), with no set, the
 *    process alive and no descriptor leaked. A kernel that wants
 *    COOP_TASKRUN takes the second setup and the set opens on it.
 *  - `coalesce`: 200 head+body responses, each two sends in one pass, as
 *    `netWrite2` makes them, and then three writes in one pass. Each leaves
 *    as one SEND; the mode prints the SENDs per response (NURING-40).
 *  - `inflight`: 16 MB in 1,000-byte writes to a client that does not read
 *    yet, so a SEND stays in the kernel; the writes behind it join one record
 *    rather than the one in flight, and every byte arrives in order once the
 *    client reads (NURING-40).
 *  - `pool`: a response to each of 64 clients in one pass holds 64 pool
 *    buffers; once sent, no slot holds one and at most UR_SENDPOOL_MAX stay
 *    cached, and steady responses after a warm-up allocate none (NURING-41).
 *  `coalesce`, `inflight` and `pool` drive their set and clients in one
 *  process, as `move` does.
 */
#define _GNU_SOURCE
/* The hooks the layer calls in place of io_uring_setup and io_uring_register,
 * so `fallback` can force what a seccomp filter cannot express. */
static long test_setup(unsigned entries, void *p);
static long test_register(int fd, unsigned op, void *arg, unsigned nr);
#define UR_SYS_SETUP(entries, p) test_setup(entries, p)
#define UR_SYS_REGISTER(fd, op, arg, nr) test_register(fd, op, arg, nr)
/* `nomem` turns accept completions into -ENOMEM, which a test cannot make the
 * kernel answer. */
static int test_accept_res(int res);
#define UR_ACCEPT_RES(res) test_accept_res(res)
/* runtime-net.c, linked beside this file for `netwrite`, opens its sets
 * through the wrapper below, which keeps the last one for its stats. */
#define nish_uring_open ut_uring_open_real
#include "../../runtime/runtime-uring.c"
#undef nish_uring_open

#include <dirent.h>
#include <errno.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <poll.h>
#include <signal.h>
#include <stdio.h>
#include <sys/prctl.h>
#include <sys/utsname.h>
#include <sys/wait.h>
#include <time.h>

#define SKIP 77

/* What runtime-net.c's ring listener calls (the program's netListen,
 * netAccept, netRead, netWrite, netWrite2 and netClose). */
#include "nish.h"

static struct nish_uring_set *ut_last_set;
int32_t nish_uring_open(struct nish_uring_set **out, int32_t listener, const struct nish_uring_opts *opts);
int32_t nish_uring_open(struct nish_uring_set **out, int32_t listener, const struct nish_uring_opts *opts) {
  int32_t r = ut_uring_open_real(out, listener, opts);
  if (r >= 0) ut_last_set = *out;
  return r;
}
#define UR_UNREGISTER_EVENTFD 5 /* IORING_UNREGISTER_EVENTFD, which only `nowake` calls */

/* What the hooks force. HOOK_NONE passes every call to the kernel. */
enum hook { HOOK_NONE, HOOK_EINVAL, HOOK_WANT_COOP, HOOK_NO_NODROP, HOOK_NO_SEND };
static enum hook hook;
static int setup_calls;
static uint32_t setup_flags_seen[4];

static long test_setup(unsigned entries, void *p) {
  struct ur_params *pp = p;
  if (setup_calls < 4) setup_flags_seen[setup_calls] = pp->flags;
  setup_calls++;
  if (hook == HOOK_EINVAL || (hook == HOOK_WANT_COOP && !(pp->flags & UR_SETUP_COOP_TASKRUN))) {
    errno = EINVAL;
    return -1;
  }
  long rc = syscall(__NR_io_uring_setup, entries, p);
  if (rc >= 0 && hook == HOOK_NO_NODROP) pp->features &= ~UR_FEAT_NODROP;
  return rc;
}

/* How many accepts that succeeded `nomem` still turns into -ENOMEM. */
static int force_nomem;

static int test_accept_res(int res) {
  if (res >= 0 && force_nomem > 0) {
    force_nomem--;
    return -ENOMEM;
  }
  return res;
}

static long test_register(int fd, unsigned op, void *arg, unsigned nr) {
  long rc = syscall(__NR_io_uring_register, fd, op, arg, nr);
  if (rc >= 0 && hook == HOOK_NO_SEND && op == UR_REGISTER_PROBE)
    ((struct ur_probe *)arg)->ops[UR_OP_SEND].flags &= (uint16_t)~UR_OP_SUPPORTED;
  return rc;
}

#if defined(__x86_64__)
#define NATIVE_ARCH AUDIT_ARCH_X86_64
#elif defined(__aarch64__)
#define NATIVE_ARCH AUDIT_ARCH_AARCH64
#else
#error "uring-test knows the audit arch of x86_64 and aarch64 only"
#endif

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

static int kernel_at_least(int want_major, int want_minor) {
  struct utsname u;
  int major = 0, minor = 0;
  if (uname(&u) == 0) sscanf(u.release, "%d.%d", &major, &minor);
  return major > want_major || (major == want_major && minor >= want_minor);
}

/* Whether a probe's answer is one the fallback stands for, so a mode skips:
 * io_uring absent or disabled, or a kernel older than the layer's floor.
 * Anything else negative is the layer failing on a kernel that has what it
 * needs, and the caller fails on it. */
/* Whether io_uring_setup itself refuses here: a probe's -EPERM or -ENOSYS
 * skips only when it came from setup, not from a register the probe passed
 * through. */
static int setup_refuses(int err) {
  struct ur_params pp;
  memset(&pp, 0, sizeof pp);
  long fd = syscall(__NR_io_uring_setup, 1, &pp);
  if (fd >= 0) {
    close((int)fd);
    return 0;
  }
  return errno == err;
}

static int probe_skips(int p) {
  if (((p == -ENOSYS || p == -EPERM) && setup_refuses(-p)) || (p == -EINVAL && !kernel_at_least(6, 1))) {
    printf("skip: io_uring is unavailable here (the probe answered %d)\n", p);
    return 1;
  }
  if (p < 0) fprintf(stderr, "uring-test: the probe answered %d on a kernel that should take the layer\n", p);
  return 0;
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
  int hold;          /* the burst mode: see `taskrun` above */
};

/* The burst mode's handshake: the server writes a byte on `ready_pipe` once
 * every client is accepted, and the parent reads it before the clients send;
 * the parent writes a byte on `sent_pipe` once every client's write has
 * returned, which on loopback has queued the bytes on the server's sockets. */
static int ready_pipe[2] = {-1, -1};
static int sent_pipe[2] = {-1, -1};

static uint8_t pattern(int client, int i) { return (uint8_t)(client * 31 + i * 7 + 1); }

/* The echo server. Its exit status is the verdict on the set's side. */
static int serve(const struct mode *m, int listener, int base_fds) {
  alarm(60);
  if (m->nofile) {
    struct rlimit rl;
    if (getrlimit(RLIMIT_NOFILE, &rl) != 0) return fail("getrlimit");
    rl.rlim_cur = rl.rlim_max = (rlim_t)m->nofile;
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
  struct nish_uring_event ev[EVENTS_MAX];
  /* The burst mode keeps each connection's bytes until every client's are in,
   * so receiving them makes no submission that would enter the ring. */
  uint8_t *held = m->hold ? calloc((size_t)m->opts.slots, (size_t)m->payload) : NULL;
  int held_bytes = 0, released = 0;
  int burst_due = 0;
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
    if (m->hold && held_bytes == m->clients * m->payload && !released) {
      released = 1;
      for (int slot = 0; slot < m->opts.slots; slot++)
        if (echoed[slot] && nish_uring_send(s, 0, slot, held + (size_t)slot * m->payload, m->payload) != m->payload)
          return fail("a held echo was refused");
    }
    /* The burst is queued on the ring: one wait that need not sleep must
     * take all of it, entering again past the kernel's 20 per enter. */
    int burst = burst_due == 1;
    int n = nish_uring_wait(s, burst ? 0 : 1000, ev, burst ? EVENTS_MAX : 64);
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
        if (live == m->clients) {
          int now = fd_count();
          if (now < 0) return fail("the server could not count its descriptors");
          peak_fds = now - base_fds;
          if (m->hold) {
            /* Let the clients send all at once, and enter the ring again only
             * once every client's bytes are queued. */
            char c;
            if (write(ready_pipe[1], "r", 1) != 1) return fail("the ready byte");
            if (read(sent_pipe[0], &c, 1) != 1) return fail("the clients never said they had sent");
            burst_due = 1;
          }
        }
        break;
      case NISH_URING_DATA:
        if (m->hold) {
          if (e->ring != 0 || *done + e->res > m->payload) return fail("a burst byte landed where none was due");
          memcpy(held + (size_t)e->slot * m->payload + *done, e->data, (size_t)e->res);
          *done += e->res;
          held_bytes += e->res;
          break;
        }
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
    if (burst) {
      burst_due = 2;
      if (held_bytes != m->clients * m->payload) {
        fprintf(stderr, "uring-test: one wait took %d of the burst's %d bytes; the ring kept the rest queued\n",
                held_bytes, m->clients * m->payload);
        return 1;
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
    if (base_fds < 0 || peak_fds >= 64) return fail("the server's descriptor table grew by 64 or more");
  }
  if (strcmp(m->name, "bound") == 0 && peak_live > 8) return fail("the bound let more than 8 in");
  if (m->hold) {
    if (st.rings != 1) return fail("the burst did not stay on one ring");
    /* The cap is measured on v6.18 (docs/wp63-iouring-net.md §2, item 4). */
    if (kernel_at_least(6, 18) && st.taskrun_reentries == 0)
      return fail("a burst of 100 on one ring never needed the TASKRUN re-entry");
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
  if (m->hold) {
    char r;
    if (read(ready_pipe[0], &r, 1) != 1) return fail("the server never accepted every client");
  }
  int len = m->big ? 1 : m->payload;
  uint8_t *buf = malloc(m->big ? (size_t)m->big : (size_t)len);
  for (int c = 0; c < m->clients; c++) {
    uint8_t out[4096];
    for (int i = 0; i < len; i++) out[i] = pattern(c, i);
    if (write(fds[c], out, (size_t)len) != len) return fail("client write");
  }
  if (m->hold && write(sent_pipe[1], "s", 1) != 1) return fail("the sent byte");
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
  int base_fds = fd_count();
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
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
  if (m->hold && (pipe(ready_pipe) != 0 || pipe(sent_pipe) != 0)) return fail("pipe");
  fflush(NULL);
  pid_t pid = fork();
  if (pid < 0) return fail("fork");
  if (pid == 0) _exit(serve(m, l, base_fds));
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

/* A child installs a filter that answers `err` from syscall `nr` (none for
 * nr < 0), sets the hook, then asks the layer for a set. The probe and the
 * open must both answer `want`, the answer that sends a caller to epoll,
 * with no set and no descriptor left open. */
static int fallback_one(int nr, int err, enum hook h, int want) {
  fflush(NULL);
  pid_t pid = fork();
  if (pid < 0) return fail("fork");
  if (pid == 0) {
    if (nr >= 0) {
      struct sock_filter f[] = {
          BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
          BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, NATIVE_ARCH, 1, 0),
          BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
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
    }
    hook = h;
    setup_calls = 0; /* the parent's own probe counted too */
    int before = fd_count();
    int p = nish_uring_probe();
    if (p != want) {
      fprintf(stderr, "uring-test: case (syscall %d errno %d hook %d) wanted %d, but the probe answered %d\n", nr, err,
              (int)h, want, p);
      _exit(1);
    }
    struct nish_uring_set *s = (struct nish_uring_set *)1;
    int o = nish_uring_open(&s, 0, NULL);
    if (o != want || s != NULL) _exit(fail("the open did not answer the probe's refusal with no set"));
    if (fd_count() != before) _exit(fail("a refused probe left a descriptor open"));
    if (h == HOOK_EINVAL &&
        (setup_calls != 2 || (setup_flags_seen[0] & UR_SETUP_COOP_TASKRUN) ||
         !(setup_flags_seen[1] & UR_SETUP_COOP_TASKRUN)))
      _exit(fail("an -EINVAL setup was not tried once more with COOP_TASKRUN, then given up"));
    _exit(0);
  }
  int status;
  if (waitpid(pid, &status, 0) != pid) return fail("waitpid");
  if (!WIFEXITED(status)) return fail("a refused io_uring killed the process");
  return WEXITSTATUS(status);
}

/* A kernel that wants COOP_TASKRUN beside TASKRUN_FLAG: the second setup is
 * taken, and the set opens and works on it. */
static int fallback_coop(void) {
  fflush(NULL);
  pid_t pid = fork();
  if (pid < 0) return fail("fork");
  if (pid == 0) {
    hook = HOOK_WANT_COOP;
    setup_calls = 0;
    int l = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in a = {.sin_family = AF_INET, .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
    if (l < 0 || bind(l, (struct sockaddr *)&a, sizeof a) != 0 || listen(l, 8) != 0) _exit(fail("listener"));
    int p = nish_uring_probe();
    if (p != 1) {
      fprintf(stderr, "uring-test: a kernel that wants COOP_TASKRUN made the probe answer %d\n", p);
      _exit(1);
    }
    struct nish_uring_set *s = NULL;
    struct nish_uring_opts o = {8, 1, 0, 0, 0, 0};
    int rc = nish_uring_open(&s, l, &o);
    if (rc != 0 || s == NULL) {
      fprintf(stderr, "uring-test: a kernel that wants COOP_TASKRUN made the open answer %d\n", rc);
      _exit(1);
    }
    if (setup_calls != 4 || !(setup_flags_seen[3] & UR_SETUP_COOP_TASKRUN))
      _exit(fail("the ring was not made with COOP_TASKRUN"));
    nish_uring_destroy(s);
    close(l);
    _exit(0);
  }
  int status;
  if (waitpid(pid, &status, 0) != pid) return fail("waitpid");
  if (!WIFEXITED(status)) return fail("the COOP_TASKRUN case died of a signal");
  return WEXITSTATUS(status);
}

static int fallback(void) {
  /* The cases a refused setup answers need no io_uring underneath. */
  static const int refused[][4] = {
      {__NR_io_uring_setup, EPERM, HOOK_NONE, -EPERM},
      {__NR_io_uring_setup, ENOSYS, HOOK_NONE, -ENOSYS},
      {__NR_io_uring_setup, EINVAL, HOOK_NONE, -EINVAL},
      {-1, 0, HOOK_EINVAL, -EINVAL},
  };
  /* A runner without seccomp filters skips the filtered cases, and the
   * hook cases, which need none, still run. */
  int no_seccomp = 0;
  for (size_t i = 0; i < sizeof refused / sizeof refused[0]; i++) {
    int rc = fallback_one(refused[i][0], refused[i][1], (enum hook)refused[i][2], refused[i][3]);
    if (rc == SKIP) no_seccomp = 1;
    else if (rc != 0) return rc;
  }
  /* The rest need a setup the kernel takes. The probe's cache is not read:
   * every case forks, and a child would inherit it. */
  int have = ur_probe_once();
  if (probe_skips(have)) return SKIP;
  if (have <= 0) return 1;
  static const int missing[][4] = {
      {__NR_io_uring_register, EPERM, HOOK_NONE, -EPERM},
      {__NR_io_uring_register, EINVAL, HOOK_NONE, -EOPNOTSUPP},
      {-1, 0, HOOK_NO_NODROP, -EOPNOTSUPP},
      {-1, 0, HOOK_NO_SEND, -EOPNOTSUPP},
  };
  for (size_t i = 0; i < sizeof missing / sizeof missing[0]; i++) {
    int rc = fallback_one(missing[i][0], missing[i][1], (enum hook)missing[i][2], missing[i][3]);
    if (rc == SKIP) no_seccomp = 1;
    else if (rc != 0) return rc;
  }
  int rc = fallback_coop();
  if (rc != 0) return rc;
  if (no_seccomp) {
    printf("skip: seccomp filters are unavailable here; the hook cases passed\n");
    return SKIP;
  }
  return 0;
}

/* The `move` mode's wait: one that need not sleep, after which no ring may
 * hold a submission the kernel has not been handed. Records the ring and
 * slot of each accept; any other event but a hang-up is a failure. */
static int move_wait(struct nish_uring_set *s, int *ring, int *slot) {
  struct nish_uring_event ev[EVENTS_MAX];
  int n = nish_uring_wait(s, 0, ev, EVENTS_MAX);
  if (n < 0) {
    fprintf(stderr, "uring-test: wait answered %d\n", n);
    return -1;
  }
  for (int ri = 0; ri < s->nrings; ri++)
    if (s->rings[ri]->to_submit) {
      fprintf(stderr, "uring-test: a wait returned %d events with %u submissions still queued on ring %d\n", n,
              s->rings[ri]->to_submit, ri);
      return -1;
    }
  for (int i = 0; i < n; i++) {
    if (ev[i].kind == NISH_URING_ACCEPTED) {
      *ring = ev[i].ring;
      *slot = ev[i].slot;
    } else if (ev[i].kind != NISH_URING_HUP) {
      fprintf(stderr, "uring-test: an event of kind %d where only accepts were due\n", (int)ev[i].kind);
      return -1;
    }
  }
  return n;
}

/* What `move` prints when a client sat in the backlog: the kernel, the set
 * and every ring as user space sees it, and each ring's fdinfo, whose poll
 * list shows whether the kernel holds an accept. Then a wait of 0 and an
 * entry with GETEVENTS on every ring tell which side lost it: an accept that
 * appears now was armed and its eventfd never woke the sleep; none at all
 * means no accept was armed. */
static void move_dump(struct nish_uring_set *s, int client) {
  struct utsname u;
  if (uname(&u) != 0) strcpy(u.release, "?");
  fprintf(stderr, "uring-test: kernel %s, client %d of 5, acceptor %d, accept_stopped %d, rings %d of %d, sleep %d\n",
          u.release, client + 1, s->acceptor, s->accept_stopped, s->nrings, s->rings_max, nish_uring_sleep_ms(s, -1));
  for (int ri = 0; ri < s->nrings; ri++) {
    struct ur_ring *r = s->rings[ri];
    struct pollfd q = {r->efd, POLLIN, 0};
    fprintf(stderr,
            "uring-test: ring %d: live %ld accepting %ld to_submit %u sq_flags %#x sq head %u tail %u cq head %u tail %u "
            "efd readable %d\n",
            ri, (long)r->live, (long)r->accepting, r->to_submit, __atomic_load_n(r->sq_flags, __ATOMIC_ACQUIRE),
            __atomic_load_n(r->sq_head, __ATOMIC_ACQUIRE), r->sq_local_tail, *r->cq_head,
            __atomic_load_n(r->cq_tail, __ATOMIC_ACQUIRE), poll(&q, 1, 0));
    for (uint32_t sl = 0; sl < s->slots; sl++) fprintf(stderr, "uring-test:   slot %u state %#x\n", sl, r->st[sl]);
    char path[64], buf[4096];
    snprintf(path, sizeof path, "/proc/self/fdinfo/%d", r->fd);
    FILE *f = fopen(path, "r");
    if (!f) continue;
    while (fgets(buf, sizeof buf, f)) fprintf(stderr, "uring-test:   fdinfo %s", buf);
    fclose(f);
  }
  struct nish_uring_event ev[EVENTS_MAX];
  int n = nish_uring_wait(s, 0, ev, EVENTS_MAX);
  for (int i = 0; i < n; i++)
    fprintf(stderr, "uring-test: a wait of 0 after the timeout found kind %d ring %d slot %d res %d\n", (int)ev[i].kind,
            ev[i].ring, ev[i].slot, ev[i].res);
  if (n <= 0) fprintf(stderr, "uring-test: a wait of 0 after the timeout answered %d\n", n);
  for (int ri = 0; ri < s->nrings; ri++) {
    int rc = ur_enter(s->rings[ri], 0, 0, UR_ENTER_GETEVENTS);
    int k = ur_service(s, ri, ev, EVENTS_MAX);
    fprintf(stderr, "uring-test: ring %d entered with GETEVENTS (%d) and gave %d events%s\n", ri, rc, k,
            k > 0 && ev[0].kind == NISH_URING_ACCEPTED ? ", an accept first" : "");
  }
  struct nish_uring_stats st;
  nish_uring_stats(s, &st);
  fprintf(stderr, "uring-test: stats accepting %ld accept_errors %ld bound_violations %ld\n", (long)st.accepting,
          (long)st.accept_errors, (long)st.bound_violations);
}

static long long now_ms(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (long long)t.tv_sec * 1000 + t.tv_nsec / 1000000;
}

/* Connect one client and sleep on the set's descriptor, as a caller's own
 * loop would, until the set accepts it. Each sleep is as long as
 * `nish_uring_sleep_ms` answers, and a wait of 0 follows it whether or not the
 * descriptor became readable, because 7.0 can hold the accept as task work
 * without signalling the eventfd (NURING-8). The set is idle first: a wait
 * found nothing, the descriptor is not readable and the set asks for no wait
 * now, and a set that never gets there in 100 waits fails. A client the set
 * has not accepted within 5 seconds fails as a lost wake. */
static int move_accept(struct nish_uring_set *s, int client, const struct sockaddr_in *a, int *fd, int *ring,
                       int *slot) {
  int r = -1, sl = -1, idle = 0;
  for (int i = 0; i < 100 && !idle; i++) {
    struct pollfd q = {nish_uring_fd(s), POLLIN, 0};
    int n = move_wait(s, &r, &sl);
    if (n < 0) return 1;
    idle = n == 0 && poll(&q, 1, 0) == 0 && nish_uring_sleep_ms(s, -1) > 0;
  }
  if (r >= 0) return fail("an accept arrived with no client connecting");
  if (!idle) return fail("the set asked for a wait after each of 100 waits with no client connecting");
  *fd = socket(AF_INET, SOCK_STREAM, 0);
  if (*fd < 0 || connect(*fd, (const struct sockaddr *)a, sizeof *a) != 0) return fail("client connect");
  long long deadline = now_ms() + 5000;
  while (r < 0) {
    if (now_ms() > deadline) {
      move_dump(s, client);
      return fail("a client waited in the backlog with no accept in the kernel");
    }
    struct pollfd q = {nish_uring_fd(s), POLLIN, 0};
    if (poll(&q, 1, nish_uring_sleep_ms(s, -1)) < 0) return fail("poll on the set's descriptor");
    if (move_wait(s, &r, &sl) < 0) return 1;
  }
  *ring = r;
  *slot = sl;
  return 0;
}

/* Rings of two slots: fill ring 0, which makes ring 1; free a slot on ring 0;
 * fill ring 1. Its last accept moves the accepting job back to ring 0, which
 * that wait serviced before ring 1, and the next client must be accepted
 * there while the caller sleeps on the set's descriptor. */
static int move(void) {
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
  alarm(60);
  int l = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in a = {.sin_family = AF_INET, .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
  socklen_t al = sizeof a;
  if (l < 0 || bind(l, (struct sockaddr *)&a, sizeof a) != 0 || listen(l, 64) != 0 ||
      getsockname(l, (struct sockaddr *)&a, &al) != 0)
    return fail("listener");
  struct nish_uring_set *s;
  struct nish_uring_opts o = {2, 2, 0, 0, 0, 0};
  int rc = nish_uring_open(&s, l, &o);
  if (rc < 0) {
    fprintf(stderr, "uring-test: open answered %d\n", rc);
    return 1;
  }
  static const int want[5] = {0, 0, 1, 1, 0};
  int fds[5], ring[5], slot[5];
  for (int c = 0; c < 5; c++) {
    if (move_accept(s, c, &a, &fds[c], &ring[c], &slot[c]) != 0) return 1;
    if (ring[c] != want[c]) {
      fprintf(stderr, "uring-test: client %d was accepted on ring %d, not %d\n", c + 1, ring[c], want[c]);
      return 1;
    }
    if (c == 1) {
      if (s->nrings != 2) return fail("a full ring 0 did not make ring 1");
      if (nish_uring_close(s, ring[0], slot[0]) != 0) return fail("the close was refused");
      int r = -1, sl = -1;
      if (move_wait(s, &r, &sl) < 0) return 1;
      uint8_t z;
      if (read(fds[0], &z, 1) != 0) return fail("the closed client did not read end of file");
    }
  }
  if (s->acceptor != 0) return fail("the accepting job left ring 0 with a slot free there");
  nish_uring_destroy(s);
  for (int c = 0; c < 5; c++) close(fds[c]);
  close(l);
  return 0;
}

/* A SHUTDOWN runs on io-wq, which looks the slot's file up only when it runs,
 * so a close must not free the slot while one is in flight (NURING-39). A
 * one-slot set accepts client A while client B waits in the backlog, queues
 * A's shutdown and at once closes A, which frees the slot to B. The close
 * answers -EAGAIN until the shutdown has completed; then A reads its byte and
 * the end of the stream, and B, accepted into the same slot, reads nothing:
 * no shutdown reached it. */
static int shutclose(void) {
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
  alarm(60);
  int l = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in a = {.sin_family = AF_INET, .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
  socklen_t al = sizeof a;
  if (l < 0 || bind(l, (struct sockaddr *)&a, sizeof a) != 0 || listen(l, 64) != 0 ||
      getsockname(l, (struct sockaddr *)&a, &al) != 0)
    return fail("listener");
  struct nish_uring_set *s;
  struct nish_uring_opts o = {1, 1, 0, 0, 0, 0};
  int rc = nish_uring_open(&s, l, &o);
  if (rc < 0) {
    fprintf(stderr, "uring-test: open answered %d\n", rc);
    return 1;
  }
  int fa, ra, sa;
  if (move_accept(s, 0, &a, &fa, &ra, &sa) != 0) return 1;
  int fb = socket(AF_INET, SOCK_STREAM, 0);
  if (fb < 0 || connect(fb, (const struct sockaddr *)&a, sizeof a) != 0) return fail("client B connect");
  if (nish_uring_send(s, ra, sa, (const uint8_t *)"x", 1) != 1) return fail("the send was refused");
  if (nish_uring_shutdown(s, ra, sa, 1) != 0) return fail("the shutdown was refused");
  /* Wait for the send, so the shutdown is the slot's head and in flight. */
  long long deadline = now_ms() + 5000;
  struct ur_send *q;
  while ((q = s->rings[ra]->sq_first[sa]) != NULL && q->how < 0) {
    if (now_ms() > deadline) return fail("the send did not complete");
    struct nish_uring_event ev[EVENTS_MAX];
    if (nish_uring_wait(s, 0, ev, EVENTS_MAX) < 0) return fail("wait");
  }
  int refused = 0;
  while ((rc = nish_uring_close(s, ra, sa)) == -EAGAIN) {
    refused = 1;
    if (now_ms() > deadline) return fail("the close was refused past the shutdown");
    struct nish_uring_event ev[EVENTS_MAX];
    if (nish_uring_wait(s, 0, ev, EVENTS_MAX) < 0) return fail("wait");
  }
  if (rc != 0) return fail("the close answered an error");
  if (q != NULL && !refused) return fail("a close with the shutdown in flight was not refused");
  int rb = -1, sb = -1;
  while (rb < 0) {
    if (now_ms() > deadline) return fail("client B was not accepted");
    struct pollfd pq = {nish_uring_fd(s), POLLIN, 0};
    if (poll(&pq, 1, nish_uring_sleep_ms(s, -1)) < 0) return fail("poll on the set's descriptor");
    if (move_wait(s, &rb, &sb) < 0) return 1;
  }
  if (rb != ra || sb != sa) return fail("client B was not accepted into A's slot");
  uint8_t got[2];
  if (read_all(fa, got, 1) != 0 || got[0] != 'x' || read(fa, got, 1) != 0)
    return fail("client A did not read its byte and the end of the stream");
  struct pollfd bq = {fb, POLLIN, 0};
  int ready = poll(&bq, 1, 300);
  if (ready != 0) return fail("client B read the end of the stream: A's shutdown reached the slot's next connection");
  nish_uring_destroy(s);
  close(fa);
  close(fb);
  close(l);
  return 0;
}

/* A ring whose eventfd says nothing: a client that connects while a wait of
 * -1 sleeps must still be accepted, by the wait's own bound. Without it the
 * wait would sleep until the alarm. */
static int nowake(void) {
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
  alarm(10);
  int l = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in a = {.sin_family = AF_INET, .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
  socklen_t al = sizeof a;
  if (l < 0 || bind(l, (struct sockaddr *)&a, sizeof a) != 0 || listen(l, 64) != 0 ||
      getsockname(l, (struct sockaddr *)&a, &al) != 0)
    return fail("listener");
  struct nish_uring_set *s;
  struct nish_uring_opts o = {8, 1, 0, 0, 0, 0};
  int rc = nish_uring_open(&s, l, &o);
  if (rc < 0) {
    fprintf(stderr, "uring-test: open answered %d\n", rc);
    return 1;
  }
  struct nish_uring_event ev[EVENTS_MAX];
  if (nish_uring_wait(s, 0, ev, EVENTS_MAX) != 0) return fail("a wait found events with no client connecting");
  rc = ur_register(s->rings[0]->fd, UR_UNREGISTER_EVENTFD, NULL, 0);
  if (rc < 0) {
    fprintf(stderr, "uring-test: unregistering the eventfd answered %d\n", rc);
    return 1;
  }
  pid_t kid = fork();
  if (kid < 0) return fail("fork");
  if (kid == 0) {
    /* Connect once the parent sleeps, and hold the connection until killed. */
    struct timespec d = {0, 200 * 1000 * 1000};
    nanosleep(&d, NULL);
    int c = socket(AF_INET, SOCK_STREAM, 0);
    if (c < 0 || connect(c, (const struct sockaddr *)&a, sizeof a) != 0) _exit(1);
    pause();
    _exit(0);
  }
  /* A wait of -1 answers 0 when something interrupts its sleep, which here
   * can be task work the kernel queues on this thread with no signal sent:
   * wait again. */
  long long t0 = now_ms(), took = 0;
  int n = 0;
  while (n == 0 && took <= 1200) {
    n = nish_uring_wait(s, -1, ev, EVENTS_MAX);
    took = now_ms() - t0;
  }
  kill(kid, SIGKILL);
  waitpid(kid, NULL, 0);
  if (n != 1 || ev[0].kind != NISH_URING_ACCEPTED) {
    fprintf(stderr, "uring-test: a wait of -1 answered %d (first kind %d), not one accept\n", n, n > 0 ? (int)ev[0].kind : -1);
    return 1;
  }
  if (took > 1200) {
    fprintf(stderr, "uring-test: the accept took %lld ms for a client that connected after 200\n", took);
    return 1;
  }
  nish_uring_destroy(s);
  close(l);
  return 0;
}

/* A slot whose recv the reset ended is held and let go: no event may follow
 * the first hangup, which must carry the reset's errno. */
static int hupheld(void) {
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
  alarm(20);
  int l = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in a = {.sin_family = AF_INET, .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
  socklen_t al = sizeof a;
  if (l < 0 || bind(l, (struct sockaddr *)&a, sizeof a) != 0 || listen(l, 64) != 0 ||
      getsockname(l, (struct sockaddr *)&a, &al) != 0)
    return fail("listener");
  struct nish_uring_set *s;
  struct nish_uring_opts o = {8, 1, 0, 0, 0, 0};
  int rc = nish_uring_open(&s, l, &o);
  if (rc < 0) {
    fprintf(stderr, "uring-test: open answered %d\n", rc);
    return 1;
  }
  pid_t kid = fork();
  if (kid < 0) return fail("fork");
  if (kid == 0) {
    /* Send, give the server time to take the bytes, then reset. */
    int c = socket(AF_INET, SOCK_STREAM, 0);
    if (c < 0 || connect(c, (const struct sockaddr *)&a, sizeof a) != 0) _exit(1);
    if (write(c, "hello", 5) != 5) _exit(1);
    struct timespec d = {0, 200 * 1000 * 1000};
    nanosleep(&d, NULL);
    struct linger lg = {1, 0};
    setsockopt(c, SOL_SOCKET, SO_LINGER, &lg, sizeof lg);
    close(c);
    _exit(0);
  }
  struct nish_uring_event ev[EVENTS_MAX];
  int ring = -1, slot = -1, hup = 0, hup_res = 0, bytes = 0;
  long long deadline = now_ms() + 10000;
  while (!hup && now_ms() < deadline) {
    struct pollfd q = {nish_uring_fd(s), POLLIN, 0};
    (void)poll(&q, 1, 50);
    int n = nish_uring_wait(s, 0, ev, EVENTS_MAX);
    if (n < 0) {
      fprintf(stderr, "uring-test: wait answered %d\n", n);
      return 1;
    }
    for (int i = 0; i < n; i++) {
      if (ev[i].kind == NISH_URING_ACCEPTED) {
        ring = ev[i].ring;
        slot = ev[i].slot;
      } else if (ev[i].kind == NISH_URING_DATA) {
        bytes += ev[i].res;
      } else if (ev[i].kind == NISH_URING_HUP) {
        hup = 1;
        hup_res = ev[i].res;
      }
    }
  }
  waitpid(kid, NULL, 0);
  if (!hup) return fail("the reset's hangup never arrived");
  if (bytes != 5 || hup_res != -ECONNRESET) {
    fprintf(stderr, "uring-test: the reset came as %d bytes and a hangup of %d, not 5 and %d\n", bytes, hup_res,
            -ECONNRESET);
    return 1;
  }
  if (nish_uring_hold(s, ring, slot, 1) != 0 || nish_uring_hold(s, ring, slot, 0) != 0)
    return fail("the hold or its let-go was refused");
  long long until = now_ms() + 500;
  while (now_ms() < until) {
    struct pollfd q = {nish_uring_fd(s), POLLIN, 0};
    (void)poll(&q, 1, 50);
    int n = nish_uring_wait(s, 0, ev, EVENTS_MAX);
    if (n < 0) {
      fprintf(stderr, "uring-test: wait answered %d\n", n);
      return 1;
    }
    if (n > 0) {
      fprintf(stderr, "uring-test: after the hangup and a hold let go, an event of kind %d res %d\n", (int)ev[0].kind,
              ev[0].res);
      return 1;
    }
  }
  nish_uring_destroy(s);
  close(l);
  return 0;
}

/* Waits until an accepted connection or a pause arrives, up to 5 s. Answers
 * the event's kind (0 on timeout) and sets *res to its result. */
static int nomem_next(struct nish_uring_set *s, int *res) {
  struct nish_uring_event ev[EVENTS_MAX];
  long long deadline = now_ms() + 5000;
  while (now_ms() < deadline) {
    struct pollfd q = {nish_uring_fd(s), POLLIN, 0};
    (void)poll(&q, 1, nish_uring_sleep_ms(s, 50));
    int n = nish_uring_wait(s, 0, ev, EVENTS_MAX);
    if (n < 0) {
      *res = n;
      return -1;
    }
    for (int i = 0; i < n; i++) {
      if (ev[i].kind == NISH_URING_DATA) continue;
      *res = ev[i].res;
      return ev[i].kind;
    }
  }
  return 0;
}

static int nomem(void) {
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
  alarm(30);
  int l = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in a = {.sin_family = AF_INET, .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
  socklen_t al = sizeof a;
  if (l < 0 || bind(l, (struct sockaddr *)&a, sizeof a) != 0 || listen(l, 64) != 0 ||
      getsockname(l, (struct sockaddr *)&a, &al) != 0)
    return fail("listener");
  struct nish_uring_set *s;
  struct nish_uring_opts o = {8, 1, 0, 0, 0, 0};
  int rc = nish_uring_open(&s, l, &o);
  if (rc < 0) {
    fprintf(stderr, "uring-test: open answered %d\n", rc);
    return 1;
  }
  /* Accepts already in flight stay with the kernel through a pause, so each
     client below connects only once the set has resumed: a drain of 100 ms
     outlasts the longest back-off this test reaches. */
  int fds[3], want_backoff[2] = {ACCEPT_BACKOFF_MIN_MS, 2 * ACCEPT_BACKOFF_MIN_MS};
  force_nomem = 2;
  for (int c = 0; c < 3; c++) {
    fds[c] = socket(AF_INET, SOCK_STREAM, 0);
    if (fds[c] < 0 || connect(fds[c], (const struct sockaddr *)&a, sizeof a) != 0) return fail("connect");
    int res = 0, kind = nomem_next(s, &res);
    if (kind < 0) {
      fprintf(stderr, "uring-test: wait answered %d\n", res);
      return 1;
    }
    if (c == 2) {
      if (kind != NISH_URING_ACCEPTED) {
        fprintf(stderr, "uring-test: after two pauses client 3 came as kind %d res %d, not an accepted connection\n",
                kind, res);
        return 1;
      }
      break;
    }
    if (kind != NISH_URING_ACCEPT_PAUSED || res != -ENOMEM) {
      fprintf(stderr, "uring-test: client %d's -ENOMEM came as kind %d res %d, not a pause with %d\n", c + 1, kind,
              res, -ENOMEM);
      return 1;
    }
    if (s->backoff_ms != want_backoff[c]) {
      fprintf(stderr, "uring-test: pause %d backs off %d ms, not %d\n", c + 1, (int)s->backoff_ms, want_backoff[c]);
      return 1;
    }
    /* Paused, a set with nothing else to do does not ask its caller to wake at once. */
    if (nish_uring_sleep_ms(s, -1) <= 0) return fail("a paused set asked for a wait at once");
    struct nish_uring_event ev[EVENTS_MAX];
    long long until = now_ms() + 100;
    while (now_ms() < until) {
      struct pollfd q = {nish_uring_fd(s), POLLIN, 0};
      (void)poll(&q, 1, nish_uring_sleep_ms(s, 10));
      int n = nish_uring_wait(s, 0, ev, EVENTS_MAX);
      if (n != 0) {
        fprintf(stderr, "uring-test: a paused set answered %d (kind %d)\n", n, n > 0 ? (int)ev[0].kind : 0);
        return 1;
      }
    }
    if (s->accept_paused) return fail("the pause did not end once its back-off had");
  }
  struct nish_uring_stats st;
  nish_uring_stats(s, &st);
  if (st.accept_pauses != 2 || st.accept_errors != 0) {
    fprintf(stderr, "uring-test: %ld pauses and %ld accept errors, not 2 and 0\n", (long)st.accept_pauses,
            (long)st.accept_errors);
    return 1;
  }
  nish_uring_destroy(s);
  for (int c = 0; c < 3; c++) close(fds[c]);
  close(l);
  return 0;
}

/* An in-process set on a loopback listener, for the modes that drive the set
 * and their clients from one process. */
static int inproc_open(int32_t slots, struct nish_uring_set **s, int *l, struct sockaddr_in *a) {
  *l = socket(AF_INET, SOCK_STREAM, 0);
  *a = (struct sockaddr_in){.sin_family = AF_INET, .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
  socklen_t al = sizeof *a;
  if (*l < 0 || bind(*l, (struct sockaddr *)a, sizeof *a) != 0 || listen(*l, 64) != 0 ||
      getsockname(*l, (struct sockaddr *)a, &al) != 0)
    return fail("listener");
  struct nish_uring_opts o = {slots, 1, 0, 0, 0, 0};
  int rc = nish_uring_open(s, *l, &o);
  if (rc < 0) {
    fprintf(stderr, "uring-test: open answered %d\n", rc);
    return 1;
  }
  return 0;
}

/* Waits of 0 until the slot has nothing queued. Any event but an accept is a
 * failure: these modes' clients send nothing and do not close. */
static int drain_slot(struct nish_uring_set *s, int ring, int slot) {
  long long deadline = now_ms() + 10000;
  while (nish_uring_queued(s, ring, slot) > 0) {
    if (now_ms() > deadline) return fail("the slot's queue did not drain");
    struct nish_uring_event ev[EVENTS_MAX];
    int n = nish_uring_wait(s, 10, ev, EVENTS_MAX);
    if (n < 0) return fail("wait");
    for (int i = 0; i < n; i++)
      if (ev[i].kind != NISH_URING_ACCEPTED) {
        fprintf(stderr, "uring-test: event kind %d res %d while a slot drained\n", (int)ev[i].kind, ev[i].res);
        return 1;
      }
  }
  return 0;
}

#define CO_RESPONSES 200
#define CO_HEAD 96
#define CO_BODY 1200

/* A head+body response is two sends in one pass, as `netWrite2` and two
 * back-to-back `netWrite`s make them. The ring must hand the kernel one SEND
 * for both; the mode prints the SENDs per response and fails above 1. Then
 * three writes in one pass must also leave as one SEND. */
static int coalesce(void) {
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
  alarm(60);
  struct nish_uring_set *s;
  int l, fd, ring, slot;
  struct sockaddr_in a;
  if (inproc_open(4, &s, &l, &a) != 0) return 1;
  if (move_accept(s, 0, &a, &fd, &ring, &slot) != 0) return 1;
  struct nish_uring_stats st;
  nish_uring_stats(s, &st);
  int64_t before = st.sends;
  uint8_t out[CO_HEAD + CO_BODY], in[CO_HEAD + CO_BODY];
  for (int r = 0; r < CO_RESPONSES; r++) {
    for (int i = 0; i < CO_HEAD + CO_BODY; i++) out[i] = pattern(r, i);
    if (nish_uring_send(s, ring, slot, out, CO_HEAD) != CO_HEAD) return fail("the head's send was refused");
    if (nish_uring_send(s, ring, slot, out + CO_HEAD, CO_BODY) != CO_BODY) return fail("the body's send was refused");
    if (drain_slot(s, ring, slot) != 0) return 1;
    if (read_all(fd, in, CO_HEAD + CO_BODY) != 0 || memcmp(in, out, sizeof in) != 0)
      return fail("the client did not read the head and the body in order");
  }
  nish_uring_stats(s, &st);
  double per = (double)(st.sends - before) / CO_RESPONSES;
  printf("sends per response %.2f\n", per);
  if (per > 1.0) return fail("a head+body response took more than one SEND");
  before = st.sends;
  for (int k = 0; k < 3; k++)
    if (nish_uring_send(s, ring, slot, out + k * 100, 100) != 100) return fail("a back-to-back send was refused");
  if (drain_slot(s, ring, slot) != 0) return 1;
  if (read_all(fd, in, 300) != 0 || memcmp(in, out, 300) != 0) return fail("the three writes did not arrive in order");
  nish_uring_stats(s, &st);
  if (st.sends - before != 1) {
    fprintf(stderr, "uring-test: three writes in one pass took %ld SENDs, not 1\n", (long)(st.sends - before));
    return 1;
  }
  nish_uring_destroy(s);
  close(fd);
  close(l);
  return 0;
}

#define IF_WRITE 1000
#define IF_WRITES 16000

/* 16 MB in writes of 1,000 bytes, one a pass, to a client that reads only
 * once the server has queued them all, more than loopback's socket buffers
 * hold: a SEND sits in the kernel, and every write after it must join the
 * record behind it, not the one the kernel holds. The client then reads 4 KiB
 * at a time, the set taking a pass between reads, so the kernel takes records
 * short and the ring sends their rest; every byte must arrive in order, and
 * the writes queued behind the stalled SEND must leave in fewer SENDs than a
 * quarter of them (one a write without the append). */
static int inflight(void) {
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
  alarm(120);
  struct nish_uring_set *s;
  int l, fd, ring, slot;
  struct sockaddr_in a;
  if (inproc_open(4, &s, &l, &a) != 0) return 1;
  if (move_accept(s, 0, &a, &fd, &ring, &slot) != 0) return 1;
  /* A fixed receive buffer turns off autotuning, so the kernel stalls a SEND
   * on hosts whose loopback buffers would take a megabyte. */
  int rcvbuf = 64 << 10;
  if (setsockopt(fd, SOL_SOCKET, SO_RCVBUF, &rcvbuf, sizeof rcvbuf) != 0) return fail("SO_RCVBUF");
  struct nish_uring_stats st;
  nish_uring_stats(s, &st);
  int64_t sends0 = st.sends, requeues0 = st.send_requeues;
  uint8_t out[IF_WRITE];
  struct nish_uring_event ev[EVENTS_MAX];
  int behind = 0;
  for (int w = 0; w < IF_WRITES; w++) {
    for (int i = 0; i < IF_WRITE; i++) out[i] = pattern(w, i);
    if (nish_uring_queued(s, ring, slot) > 1 << 20) behind++;
    if (nish_uring_send(s, ring, slot, out, IF_WRITE) != IF_WRITE) return fail("a write was refused");
    if (nish_uring_wait(s, 0, ev, EVENTS_MAX) < 0) return fail("wait");
  }
  if (behind < IF_WRITES / 4) {
    printf("this host's socket buffers took %d of %d writes as they came, so no SEND stayed in flight\n",
           IF_WRITES - behind, IF_WRITES);
    return SKIP;
  }
  nish_uring_stats(s, &st);
  int64_t stalled = st.sends;
  if (fcntl(fd, F_SETFL, O_NONBLOCK) != 0) return fail("O_NONBLOCK");
  long long deadline = now_ms() + 60000;
  uint8_t in[4096];
  long got = 0, total = (long)IF_WRITE * IF_WRITES;
  while (got < total) {
    if (now_ms() > deadline) {
      nish_uring_stats(s, &st);
      fprintf(stderr, "uring-test: read %ld of %ld, %ld queued, %ld SENDs\n", got, total, (long)nish_uring_queued(s, ring, slot), (long)(st.sends - sends0));
      return fail("the client did not read every byte");
    }
    ssize_t k = read(fd, in, sizeof in);
    if (k == 0) return fail("the server closed the stream early");
    if (k < 0 && errno != EAGAIN) return fail("client read");
    for (ssize_t i = 0; i < k; i++, got++)
      if (in[i] != pattern((int)(got / IF_WRITE), (int)(got % IF_WRITE))) {
        fprintf(stderr, "uring-test: byte %ld arrived out of order\n", got);
        return 1;
      }
    int n = nish_uring_wait(s, k > 0 ? 0 : 1, ev, EVENTS_MAX);
    if (n < 0) return fail("wait");
    for (int i = 0; i < n; i++)
      if (ev[i].kind != NISH_URING_ACCEPTED) {
        fprintf(stderr, "uring-test: event kind %d res %d while the client read\n", (int)ev[i].kind, ev[i].res);
        return 1;
      }
  }
  nish_uring_stats(s, &st);
  printf("%d writes, %d behind a stalled SEND, %ld SENDs, %ld after the stall, %ld requeues\n", IF_WRITES, behind,
         (long)(st.sends - sends0), (long)(st.sends - stalled), (long)(st.send_requeues - requeues0));
  if (st.sends - stalled >= behind / 4) return fail("writes behind a SEND in flight did not join one record");
  if (st.send_requeues == requeues0) return fail("the kernel took no SEND short, so no record's rest was sent");
  if (nish_uring_queued(s, ring, slot) != 0) return fail("bytes stayed queued after the client read them all");
  nish_uring_destroy(s);
  close(fd);
  close(l);
  return 0;
}

#define PL_CLIENTS 64
#define PL_WARM 20
#define PL_ROUNDS 200

/* The send pool. A response to each of 64 clients in one pass takes 64 pool
 * buffers at once; once they are sent, the ring keeps at most
 * UR_SENDPOOL_MAX of them and frees the rest, and no slot holds one. Then
 * rounds of one response to one client, after a warm-up, must take every
 * buffer from the pool: the count of buffers ever allocated does not move. */
static int pool(void) {
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
  alarm(120);
  struct nish_uring_set *s;
  int l, fd[PL_CLIENTS], ring[PL_CLIENTS], slot[PL_CLIENTS];
  struct sockaddr_in a;
  if (inproc_open(PL_CLIENTS, &s, &l, &a) != 0) return 1;
  for (int c = 0; c < PL_CLIENTS; c++)
    if (move_accept(s, c, &a, &fd[c], &ring[c], &slot[c]) != 0) return 1;
  uint8_t out[CO_HEAD + CO_BODY], in[CO_HEAD + CO_BODY];
  for (int c = 0; c < PL_CLIENTS; c++) {
    for (int i = 0; i < CO_HEAD + CO_BODY; i++) out[i] = pattern(c, i);
    if (nish_uring_send(s, ring[c], slot[c], out, CO_HEAD) != CO_HEAD ||
        nish_uring_send(s, ring[c], slot[c], out + CO_HEAD, CO_BODY) != CO_BODY)
      return fail("a burst send was refused");
  }
  struct nish_uring_stats st;
  nish_uring_stats(s, &st);
  printf("burst: %ld buffers held, %ld cached\n", (long)st.pool_held, (long)st.pool_cached);
  if (st.pool_held != PL_CLIENTS) return fail("a burst response did not take one pool buffer");
  for (int c = 0; c < PL_CLIENTS; c++) {
    if (drain_slot(s, ring[c], slot[c]) != 0) return 1;
    for (int i = 0; i < CO_HEAD + CO_BODY; i++) out[i] = pattern(c, i);
    if (read_all(fd[c], in, sizeof in) != 0 || memcmp(in, out, sizeof in) != 0)
      return fail("a burst response did not arrive in order");
  }
  nish_uring_stats(s, &st);
  printf("after the burst: %ld held, %ld cached, %ld allocated\n", (long)st.pool_held, (long)st.pool_cached,
         (long)st.pool_new);
  if (st.pool_held != 0) return fail("an idle slot held a pool buffer after its response");
  if (st.pool_cached != (PL_CLIENTS < UR_SENDPOOL_MAX ? PL_CLIENTS : UR_SENDPOOL_MAX))
    return fail("the ring did not keep exactly UR_SENDPOOL_MAX of the burst's freed buffers");
  int64_t warm = 0;
  for (int r = 0; r < PL_WARM + PL_ROUNDS; r++) {
    if (r == PL_WARM) {
      nish_uring_stats(s, &st);
      warm = st.pool_new;
    }
    int c = r % PL_CLIENTS;
    for (int i = 0; i < CO_HEAD + CO_BODY; i++) out[i] = pattern(r, i);
    if (nish_uring_send(s, ring[c], slot[c], out, CO_HEAD) != CO_HEAD ||
        nish_uring_send(s, ring[c], slot[c], out + CO_HEAD, CO_BODY) != CO_BODY)
      return fail("a steady send was refused");
    if (drain_slot(s, ring[c], slot[c]) != 0) return 1;
    if (read_all(fd[c], in, sizeof in) != 0 || memcmp(in, out, sizeof in) != 0)
      return fail("a steady response did not arrive in order");
  }
  nish_uring_stats(s, &st);
  printf("steady: %ld buffers allocated after the warm-up, %ld held\n", (long)(st.pool_new - warm),
         (long)st.pool_held);
  if (st.pool_new != warm) return fail("a steady response allocated a pool buffer after the warm-up");
  if (st.pool_held != 0) return fail("an idle slot held a pool buffer after a steady response");
  nish_uring_destroy(s);
  for (int c = 0; c < PL_CLIENTS; c++) close(fd[c]);
  close(l);
  return 0;
}

#define SP_PAIRS 500

/* A write of one byte and a shutdown, again and again with no wait between
 * them (NURING-43): each write lands behind a shutdown record, so without the
 * shutdown's dedup each took a pool buffer of its own, 1,000 of them for 500
 * pairs of each side. A side already queued is not queued again, so the slot
 * holds at most three records with bytes in them; the client still reads every
 * byte queued before the write side's shutdown, then the end of the stream. */
static int shutpool(void) {
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
  alarm(60);
  struct nish_uring_set *s;
  int l, fd, ring, slot;
  struct sockaddr_in a;
  if (inproc_open(4, &s, &l, &a) != 0) return 1;
  if (move_accept(s, 0, &a, &fd, &ring, &slot) != 0) return 1;
  uint8_t out[2 * SP_PAIRS], in[2 * SP_PAIRS + 1];
  for (int i = 0; i < 2 * SP_PAIRS; i++) out[i] = pattern(1, i);
  for (int i = 0; i < 2 * SP_PAIRS; i++) {
    if (nish_uring_send(s, ring, slot, out + i, 1) != 1) return fail("a one-byte send was refused");
    if (nish_uring_shutdown(s, ring, slot, i < SP_PAIRS ? 0 : 1) != 0) return fail("a shutdown was refused");
  }
  struct nish_uring_stats st;
  nish_uring_stats(s, &st);
  printf("%d writes, each behind a shutdown: %ld pool buffers held\n", 2 * SP_PAIRS, (long)st.pool_held);
  if (st.pool_held > 3) return fail("writes between repeated shutdowns each held a pool buffer");
  long long deadline = now_ms() + 10000;
  while (nish_uring_queued(s, ring, slot) > 0) {
    if (now_ms() > deadline) return fail("the slot's queue did not drain");
    struct nish_uring_event ev[EVENTS_MAX];
    if (nish_uring_wait(s, 10, ev, EVENTS_MAX) < 0) return fail("wait");
  }
  if (read_all(fd, in, SP_PAIRS + 1) != 0 || memcmp(in, out, SP_PAIRS + 1) != 0)
    return fail("the bytes queued before the write side's shutdown did not arrive in order");
  if (read(fd, in, sizeof in) != 0) return fail("the client read past the write side's shutdown");
  nish_uring_destroy(s);
  close(fd);
  close(l);
  return 0;
}

#define NW_RESPONSES 200

/* NURING-40 through runtime-net.c's ring slots, as a compiled server reaches
 * it: `netWrite2` of a head and a body is two `nr_send`s, and the slot's next
 * read, which finds nothing buffered and pumps the ring, writes them as one
 * SEND; so do three back-to-back `netWrite`s. */
static int netwrite(void) {
  int p = nish_uring_probe();
  if (probe_skips(p)) return SKIP;
  if (p < 0) return 1;
  alarm(60);
  nish_str *host = malloc(sizeof *host + 9);
  if (!host) return fail("malloc");
  host->len = 9;
  memcpy(host->data, "127.0.0.1", 9);
  int32_t l = nish_tcp_listen_flags(host, 0, 64, 8);
  if (l < 0) return fail("a ring listener was refused");
  if (nish_net_ring_state() != 1 || !ut_last_set) {
    printf("runtime-net.c made no ring (state %d)\n", nish_net_ring_state());
    return SKIP;
  }
  struct sockaddr_in a = {.sin_family = AF_INET, .sin_port = htons((uint16_t)nish_net_local_port(l)),
                          .sin_addr.s_addr = htonl(INADDR_LOOPBACK)};
  int fd = socket(AF_INET, SOCK_STREAM, 0);
  if (fd < 0 || connect(fd, (const struct sockaddr *)&a, sizeof a) != 0) return fail("client connect");
  char peer_data[64], scratch[16];
  nish_array peer = {sizeof peer_data, sizeof peer_data, peer_data};
  nish_array rd = {sizeof scratch, sizeof scratch, scratch};
  int32_t h;
  long long deadline = now_ms() + 5000;
  while ((h = nish_tcp_accept(l, &peer)) == -11) {
    if (now_ms() > deadline) return fail("the ring listener accepted no client");
    poll(NULL, 0, 1);
  }
  if (h < 0) return fail("netAccept was refused");
  char out[CO_HEAD + CO_BODY];
  uint8_t in[CO_HEAD + CO_BODY];
  nish_array head = {CO_HEAD, CO_HEAD, out}, body = {CO_BODY, CO_BODY, out + CO_HEAD};
  struct nish_uring_stats st;
  nish_uring_stats(ut_last_set, &st);
  int64_t before = st.sends;
  for (int r = 0; r < NW_RESPONSES; r++) {
    for (int i = 0; i < CO_HEAD + CO_BODY; i++) out[i] = (char)pattern(r, i);
    if (nish_net_write2(h, &head, 0, CO_HEAD, &body, 0, CO_BODY) != CO_HEAD + CO_BODY)
      return fail("netWrite2 was refused");
    if (nish_net_read(h, &rd, 0, sizeof scratch) != -11) return fail("netRead found bytes the client never sent");
    if (read_all(fd, in, sizeof in) != 0 || memcmp(in, out, sizeof in) != 0)
      return fail("the client did not read the head and the body in order");
  }
  nish_uring_stats(ut_last_set, &st);
  double per = (double)(st.sends - before) / NW_RESPONSES;
  printf("netWrite2: sends per response %.2f\n", per);
  if (per > 1.0) return fail("a netWrite2 response took more than one SEND");
  before = st.sends;
  for (int k = 0; k < 3; k++)
    if (nish_net_write(h, &head, k * 30, 30) != 30) return fail("a back-to-back netWrite was refused");
  if (nish_net_read(h, &rd, 0, sizeof scratch) != -11) return fail("netRead found bytes the client never sent");
  if (read_all(fd, in, 90) != 0 || memcmp(in, out, 90) != 0) return fail("the three netWrites did not arrive in order");
  nish_uring_stats(ut_last_set, &st);
  printf("three netWrites: %ld SENDs\n", (long)(st.sends - before));
  if (st.sends - before != 1) return fail("three netWrites in one pass took more than one SEND");
  nish_net_close(h);
  nish_net_close(l);
  close(fd);
  free(host);
  return 0;
}

int main(int argc, char **argv) {
  setvbuf(stdout, NULL, _IONBF, 0);
  signal(SIGPIPE, SIG_IGN);
  if (argc != 2) return fail("usage: uring-test <mode>");
  if (strcmp(argv[1], "fallback") == 0) return fallback();
  if (strcmp(argv[1], "move") == 0) return move();
  if (strcmp(argv[1], "nowake") == 0) return nowake();
  if (strcmp(argv[1], "hupheld") == 0) return hupheld();
  if (strcmp(argv[1], "nomem") == 0) return nomem();
  if (strcmp(argv[1], "shutclose") == 0) return shutclose();
  if (strcmp(argv[1], "coalesce") == 0) return coalesce();
  if (strcmp(argv[1], "inflight") == 0) return inflight();
  if (strcmp(argv[1], "pool") == 0) return pool();
  if (strcmp(argv[1], "shutpool") == 0) return shutpool();
  if (strcmp(argv[1], "netwrite") == 0) return netwrite();
  static const struct mode modes[] = {
      {"beyond", {0, 8, 0, 0, 0, 0}, 3000, 1024, 0, 64, 0, 0, 0},
      {"bound", {8, 1, 0, 0, 0, 0}, 50, 0, 1, 64, 0, 0, 0},
      {"taskrun", {128, 1, 0, 0, 0, 0}, 100, 0, 0, 64, 0, 0, 1},
      {"overflow", {512, 1, 8, 8, 0, 0}, 256, 0, 0, 64, 0, 0, 0},
      {"nobufs", {128, 1, 0, 0, 2, 64}, 64, 0, 0, 1024, 0, 0, 0},
      {"short", {8, 1, 0, 0, 0, 0}, 1, 0, 0, 1, 8 << 20, 0, 0},
      {"reset", {8, 1, 0, 0, 0, 0}, 1, 0, 0, 1, 64 << 20, 1, 0},
  };
  for (size_t i = 0; i < sizeof modes / sizeof modes[0]; i++)
    if (strcmp(argv[1], modes[i].name) == 0) return run_mode(&modes[i]);
  return fail("no such mode");
}
