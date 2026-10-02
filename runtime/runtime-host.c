/* Nish runtime, the host half: the wall clock, entropy, a file's modification
 * time and a descriptor that becomes readable when SIGTERM or SIGINT arrives
 * (WP34 N3) — the four facts a program that runs for days asks of the machine
 * it runs on — and who owns a path and whether it runs, which a driver asks
 * before it trusts one.
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
 * places: `getrandom` on Linux and `getentropy` elsewhere, `st_mtim`
 * against Darwin's `st_mtimespec`, and `pipe2` against `pipe` for the signal
 * descriptor. A WASI build has none of this
 * (the checker refuses all four under a wasm target), so there the file is
 * empty.
 */
#if defined(__wasi__) || defined(__wasm__)
/* ISO C wants at least one declaration in a translation unit. */
typedef int nish_host_unused;
#else
#if defined(__linux__)
/* glibc declares `clock_gettime`, `sigaction` and `pipe2` under `-std=c11`
   only with a feature macro, and `pipe2` only with this one. Darwin declares
   everything by default and hides `getentropy` and the `st_mtimespec`
   spelling behind a strict feature level, so it gets none. */
#define _GNU_SOURCE
#endif
#include <errno.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/random.h>

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
  if (stat(nish_cpath(path), &st) != 0) return __builtin_nan("");
#if defined(__APPLE__)
  struct timespec t = st.st_mtimespec;
#else
  struct timespec t = st.st_mtim;
#endif
  return (double)t.tv_sec * 1e3 + (double)t.tv_nsec / 1e6;
}

/* ---- Who owns a path, and whether it runs (docs/security/runtime.md, RT-9)
 *
 * The primitives a driver needs before it trusts a directory or a program it
 * found on its own. `nish_lstat_owner_mode` answers for the path itself, a
 * symbolic link included, rather than for what it names: the owner's uid in
 * the high 32 bits and `st_mode` in the low 32, or exactly -1 when the path
 * does not resolve or holds a NUL. `nish_euid` is the user to compare the
 * owner with, and `nish_is_executable` is `access(X_OK)`: whether the real
 * user may run the file, which is what tells an executable `PATH` entry from
 * one that is only readable. Nothing in the language reaches them yet: `src/` may call
 * a runtime function only once the last release declares it, so they are here
 * for the change after the next release (docs/security/cli.md, CLI-7 and
 * CLI-9). */
int64_t nish_lstat_owner_mode(const nish_str *path) {
  struct stat st;
  if (lstat(nish_cpath(path), &st) != 0) return -1;
  return (int64_t)((uint64_t)(uint32_t)st.st_uid << 32 | (uint32_t)st.st_mode);
}

int64_t nish_euid(void) { return (int64_t)geteuid(); }

_Bool nish_is_executable(const nish_str *path) {
  return access(nish_cpath(path), X_OK) == 0;
}

/* ---- Signals: `signalFd()` and `readSignal(fd)`
 *
 * A descriptor rather than a handler in the language, because a handler would
 * be a function value the language does not have, and because a descriptor is
 * what a loop waiting in `epoll` or `poll` can wait on beside its sockets.
 *
 * Underneath it is a C handler writing each signal's number, one byte, to a
 * pipe. It is not a `signalfd` on Linux, deliberately: a `signalfd` only
 * hears a signal that is blocked in **every** thread, and a mask reaches only
 * the calling thread, so a `scope()` task or a parallel worker already
 * running when `signalFd()` was called would take the signal at its default
 * action and end the process. A handler runs in whichever thread the kernel
 * picks, so no thread's mask matters, and nothing is blocked for a child
 * `spawnSync` starts to inherit: `exec` resets a caught signal to its
 * default. Installing the handler also overrides a disposition the process
 * was started with, so a signal its parent ignored is heard, as
 * `process.on('SIGTERM')` hears it under Node.
 *
 * The handler is the whole of what runs in signal context, and `write` is
 * async-signal-safe. The write end is non-blocking, so a thousand unread
 * signals lose the newest rather than wedge the handler, and `errno` is put
 * back for the code the signal interrupted. The descriptor is made once and
 * every later `signalFd()` answers the same one. */
static int nish_signal_read_end = -1;
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
#if defined(__linux__)
  /* Both ends close-on-exec from the moment they exist, so a child a sibling
     thread spawns meanwhile cannot inherit either. */
  if (pipe2(p, O_CLOEXEC) != 0) return -1;
#else
  /* Darwin has no `pipe2`, so there is a window between `pipe` and the two
     `fcntl`s in which a child spawned by another thread inherits the ends. */
  if (pipe(p) != 0) return -1;
  fcntl(p[0], F_SETFD, FD_CLOEXEC);
  fcntl(p[1], F_SETFD, FD_CLOEXEC);
#endif
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

/* Block until a signal's byte arrives and answer it: 15 or 2, or -1 for any
   `fd` that is not the signal descriptor and for a read that fails. */
int32_t nish_read_signal(int32_t fd) {
  if (fd != nish_signal_read_end) return -1;
  unsigned char b;
  ssize_t n;
  do n = read(fd, &b, 1);
  while (n < 0 && errno == EINTR);
  return n == 1 ? (int32_t)b : -1;
}
#endif
