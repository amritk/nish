/* Nish runtime, the host half: the wall clock, entropy, a file's modification
 * time and a descriptor that becomes readable when SIGTERM or SIGINT arrives
 * (WP34 N3) — the four facts a program that runs for days asks of the machine
 * it runs on.
 *
 * A translation unit of its own for the reason runtime-os.c is one: each file
 * carries its own measured `.text*` ceiling in tests/run.js. runtime-os.c had
 * 143 bytes of its ceiling left when these arrived, the four measure more than
 * that, and a ceiling is not raised to make room (docs/MASTER_PLAN.md §2 has
 * the numbers). Section GC still means a program that calls none of them pays
 * for none of them, and scripts/build.sh pairs this file with runtime.c like
 * the other two halves, so a link line still names one runtime.
 *
 * Every function here is platform code, and the two platforms differ in three
 * of the four: `getrandom` on Linux and `getentropy` elsewhere, `st_mtim`
 * against Darwin's `st_mtimespec`, and `signalfd` on Linux against a self-pipe
 * written from a `sigaction` handler elsewhere. A WASI build has none of this
 * (the checker refuses all four under a wasm target), so there the file is
 * empty.
 */
#if defined(__wasi__) || defined(__wasm__)
/* ISO C wants at least one declaration in a translation unit. */
typedef int nish_host_unused;
#else
#if !defined(__APPLE__)
/* Darwin declares everything by default and hides `getentropy` and the
   `st_mtimespec` spelling behind a strict feature level, so the macro is for
   glibc alone, which declares `clock_gettime` and `sigaction` under
   `-std=c11` only with it. */
#define _POSIX_C_SOURCE 200809L
#endif
#include <errno.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#include <sys/random.h>
#if defined(__linux__)
#include <sys/signalfd.h>
#else
#include <fcntl.h>
#endif

#include "nish.h"

/* The spelling runtime.c and runtime-os.c use for their cold paths. */
#define NISH_COLD __attribute__((noreturn, cold, noinline))

/* `Date.now()`: `CLOCK_REALTIME` in whole milliseconds since the epoch, as
   JavaScript answers it — the milliseconds are counted in integers and then
   converted, so the answer is exact until the year 287,396 and a negative
   time floors the way `Date.now` does rather than rounding towards zero. */
double nish_date_now(void) {
  struct timespec ts;
  clock_gettime(CLOCK_REALTIME, &ts);
  return (double)((int64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000);
}

static NISH_COLD void nish_entropy_fail(uint64_t asked) {
  if (asked > 65536) {
    dprintf(2, "crypto.getRandomValues: %llu bytes asked for, and one call fills at most 65536\n",
            (unsigned long long)asked);
  } else {
    dprintf(2, "crypto.getRandomValues: the system's entropy source failed\n");
  }
  _exit(1);
}

/* `crypto.getRandomValues(bytes)`: every byte of `bytes` from the kernel's
   CSPRNG, or a panic. There is no fallback to a weaker source, because a
   program handed predictable bytes for a key or a nonce cannot tell. The Web
   API's limit of 65,536 bytes a call is kept, so a program behaves the same
   under Node. `getrandom` without flags blocks only until the pool is first
   initialised at boot and can return short or be interrupted, so it loops;
   `getentropy` fills at most 256 bytes a call and retries nothing itself. */
void nish_random_fill(nish_array *bytes) {
  uint64_t n = bytes->len;
  char *p = bytes->data;
  if (n > 65536) nish_entropy_fail(n);
  while (n > 0) {
#if defined(__linux__)
    ssize_t got = getrandom(p, n, 0);
    if (got < 0) {
      if (errno == EINTR) continue;
      nish_entropy_fail(0);
    }
#else
    size_t got = n < 256 ? n : 256;
    if (getentropy(p, got) != 0) nish_entropy_fail(0);
#endif
    p += got;
    n -= (uint64_t)got;
  }
}

/* `statMtimeSync(path)`: the modification time in milliseconds, with the
   sub-millisecond part the file system keeps, or NaN when `stat` fails. The
   arithmetic is Node's `mtimeMs` operation for operation — seconds times 1e3
   plus nanoseconds over 1e6, in doubles — so the two readings print the same
   digits. `stat` follows a symbolic link, as `fs.statSync` does. */
double nish_stat_mtime(const nish_str *path) {
  struct stat st;
  if (stat(path->data, &st) != 0) return __builtin_nan("");
#if defined(__APPLE__)
  struct timespec t = st.st_mtimespec;
#else
  struct timespec t = st.st_mtim;
#endif
  return (double)t.tv_sec * 1e3 + (double)t.tv_nsec / 1e6;
}

/* ---- Signals: `signalFd()` and `readSignal(fd)`
 *
 * A descriptor rather than a handler, because a handler would be a function
 * value the language does not have, and because a descriptor is what a loop
 * waiting in `epoll` or `poll` can wait on beside its sockets. The descriptor
 * is made once and every later `signalFd()` answers the same one. Call it
 * before any thread starts: the mask it sets is the calling thread's, and a
 * thread started later inherits it. */
static int nish_signal_read_end = -1;

#if defined(__linux__)
/* The two signals go to a `signalfd`, blocked in the process mask so that
   their default action — ending the process — never runs. A signal the
   process was started ignoring is discarded before it could be queued, so the
   disposition goes back to the default first: `process.on('SIGTERM')` hears
   one under Node whatever the parent ignored, and so does this. The fd is made
   before anything is blocked, so a failure leaves the process as it was. */
int32_t nish_signal_fd(void) {
  if (nish_signal_read_end >= 0) return nish_signal_read_end;
  sigset_t set;
  sigemptyset(&set);
  sigaddset(&set, SIGINT);
  sigaddset(&set, SIGTERM);
  int fd = signalfd(-1, &set, SFD_CLOEXEC);
  if (fd < 0) return -1;
  signal(SIGINT, SIG_DFL);
  signal(SIGTERM, SIG_DFL);
  sigprocmask(SIG_BLOCK, &set, 0);
  return nish_signal_read_end = fd;
}

int32_t nish_read_signal(int32_t fd) {
  if (fd != nish_signal_read_end) return -1;
  struct signalfd_siginfo si;
  ssize_t n;
  do n = read(fd, &si, sizeof si);
  while (n < 0 && errno == EINTR);
  return n == (ssize_t)sizeof si ? (int32_t)si.ssi_signo : -1;
}
#else
/* No `signalfd` here, so the handler turns each signal into one byte on a
   pipe: its number. The handler is the whole of what runs in signal context,
   and `write` is async-signal-safe; the write end is non-blocking, so a
   thousand unread signals lose the newest rather than wedge the handler, and
   `errno` is put back for the code the signal interrupted. Both ends are
   close-on-exec, and `exec` resets a caught signal to its default, so a child
   `spawnSync` starts inherits neither. */
static int nish_signal_write_end = -1;

static void nish_on_signal(int sig) {
  int saved = errno;
  unsigned char b = (unsigned char)sig;
  (void)!write(nish_signal_write_end, &b, 1);
  errno = saved;
}

int32_t nish_signal_fd(void) {
  if (nish_signal_read_end >= 0) return nish_signal_read_end;
  int p[2];
  if (pipe(p) != 0) return -1;
  fcntl(p[0], F_SETFD, FD_CLOEXEC);
  fcntl(p[1], F_SETFD, FD_CLOEXEC);
  fcntl(p[1], F_SETFL, O_NONBLOCK);
  nish_signal_write_end = p[1];
  struct sigaction sa;
  sa.sa_handler = nish_on_signal;
  sa.sa_flags = SA_RESTART;
  sigemptyset(&sa.sa_mask);
  sigaction(SIGINT, &sa, 0);
  sigaction(SIGTERM, &sa, 0);
  return nish_signal_read_end = p[0];
}

int32_t nish_read_signal(int32_t fd) {
  if (fd != nish_signal_read_end) return -1;
  unsigned char b;
  ssize_t n;
  do n = read(fd, &b, 1);
  while (n < 0 && errno == EINTR);
  return n == 1 ? (int32_t)b : -1;
}
#endif
#endif
