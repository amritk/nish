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
 *  - `fallback`: io_uring refused or incomplete. A seccomp filter answers
 *    io_uring_setup with EPERM, ENOSYS or EINVAL, or io_uring_register with
 *    EPERM or EINVAL; the UR_SYS_SETUP and UR_SYS_REGISTER hooks answer
 *    -EINVAL to both setup attempts, hide FEAT_NODROP, or hide the SEND
 *    opcode. The probe and the open answer what sends a caller to epoll
 *    (the errno, or -EOPNOTSUPP for a missing feature), with no set, the
 *    process alive and no descriptor leaked. A kernel that wants
 *    COOP_TASKRUN takes the second setup and the set opens on it.
 */
#define _GNU_SOURCE
/* The hooks the layer calls in place of io_uring_setup and io_uring_register,
 * so `fallback` can force what a seccomp filter cannot express. */
static long test_setup(unsigned entries, void *p);
static long test_register(int fd, unsigned op, void *arg, unsigned nr);
#define UR_SYS_SETUP(entries, p) test_setup(entries, p)
#define UR_SYS_REGISTER(fd, op, arg, nr) test_register(fd, op, arg, nr)
#include "../../runtime/runtime-uring.c"

#include <dirent.h>
#include <errno.h>
#include <linux/audit.h>
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

/* The burst mode's handshake: the server writes a byte here once every client
 * is accepted, and the parent reads it before the clients send. */
static int ready_pipe[2] = {-1, -1};

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
          peak_fds = fd_count() - base_fds;
          if (m->hold) {
            /* Let the clients send all at once, and give their bytes time to
             * queue on the ring before the next enter. */
            if (write(ready_pipe[1], "r", 1) != 1) return fail("the ready byte");
            struct timespec t = {0, 300 * 1000 * 1000};
            nanosleep(&t, NULL);
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
  /* Only a refusal the fallback stands for is a skip: io_uring absent or
   * disabled, or a kernel older than the layer's floor. Anything else is the
   * layer failing on a kernel that has what it needs. */
  if (p == -ENOSYS || p == -EPERM || (p == -EINVAL && !kernel_at_least(6, 1))) {
    printf("skip: io_uring is unavailable here (the probe answered %d)\n", p);
    return SKIP;
  }
  if (p < 0) {
    fprintf(stderr, "uring-test: the probe answered %d on a kernel that should take the layer\n", p);
    return 1;
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
  if (m->hold && pipe(ready_pipe) != 0) return fail("pipe");
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
  for (size_t i = 0; i < sizeof refused / sizeof refused[0]; i++) {
    int rc = fallback_one(refused[i][0], refused[i][1], (enum hook)refused[i][2], refused[i][3]);
    if (rc != 0) return rc;
  }
  /* The rest need a setup the kernel takes. The probe's cache is not read:
   * every case forks, and a child would inherit it. */
  int have = ur_probe_once();
  if (have <= 0) {
    printf("skip: io_uring answers %d here; the refused-setup cases passed\n", have);
    return SKIP;
  }
  static const int missing[][4] = {
      {__NR_io_uring_register, EPERM, HOOK_NONE, -EPERM},
      {__NR_io_uring_register, EINVAL, HOOK_NONE, -EOPNOTSUPP},
      {-1, 0, HOOK_NO_NODROP, -EOPNOTSUPP},
      {-1, 0, HOOK_NO_SEND, -EOPNOTSUPP},
  };
  for (size_t i = 0; i < sizeof missing / sizeof missing[0]; i++) {
    int rc = fallback_one(missing[i][0], missing[i][1], (enum hook)missing[i][2], missing[i][3]);
    if (rc != 0) return rc;
  }
  return fallback_coop();
}

int main(int argc, char **argv) {
  setvbuf(stdout, NULL, _IONBF, 0);
  signal(SIGPIPE, SIG_IGN);
  if (argc != 2) return fail("usage: uring-test <mode>");
  if (strcmp(argv[1], "fallback") == 0) return fallback();
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
