/* Nish runtime, the terminal half: reading stdin without blocking, waiting
 * for it with a timeout, and the three questions a terminal UI asks of a TTY
 * (is it one, how big is it, and raw mode on or off), the `nish:term` builtin
 * module.
 *
 * A translation unit of its own for the reason runtime-net.c is one: each
 * file carries its own measured `.text*` ceiling in tests/runtime-budgets.js,
 * and runtime-os.c, the other half this could have joined, had 177 bytes of
 * its ceiling left. Section GC means a program that calls none of these pays
 * for none of them, and scripts/build.sh pairs this file with runtime.c like
 * the other halves, so a link line still names one runtime.
 *
 * Errors take `nish:net`'s shape: an `int32_t` that is `>= 0` for success and
 * a negated errno for a failure. Two codes a program branches on are spelled
 * as numbers, because WASI numbers its errnos differently: -11 is "nothing is
 * waiting" and -25 is "not a terminal", on every platform. Any other failure
 * is the host's own `-errno`.
 *
 * stdin is never made non-blocking. `O_NONBLOCK` is a property of the open
 * file description, which a shell shares with every program it starts, so
 * setting it would leave the shell's own stdin non-blocking after a crash.
 * `readStdin` asks `select` first instead, with a timeout of 0.
 *
 * Raw mode is cfmakeraw's input side without its output side: no echo, no line
 * editing, no translation of CR or NL and no CR dropped, a break and a parity
 * error read as plain bytes, no flow control, 8-bit bytes, a read that answers
 * as soon as one byte is there. `ISIG` stays on, so Ctrl-C is still
 * SIGINT and Ctrl-Z still stops the program, and `OPOST` stays on, so "\n"
 * still moves to the start of the next line. The termios that was there is
 * saved by each `setRawMode(true)` that enters raw mode and put back by
 * `setRawMode(false)`, by an atexit handler, by every panic (runtime.c's
 * `nish_fatal_hook`, because a failed check ends in `_exit`), and by each of
 * the signals POSIX says end a program, SIGKILL aside: SIGINT, SIGTERM and
 * their kin, SIGPIPE from a reader that went away, and the faults (SIGILL,
 * SIGTRAP, SIGABRT, SIGFPE, SIGBUS, SIGSEGV). A handler is installed for one
 * only when the program left it at its default: it restores the terminal, the
 * default comes back (`SA_RESETHAND`), and the signal is raised again, so the
 * program still dies of it and its parent sees that. The handlers run on an
 * alternate stack of the thread that entered raw mode, so a stack overflow
 * there restores the terminal too; one on another thread has no stack to run
 * it on, and the terminal stays raw. SIGTSTP, Ctrl-Z, is caught the same way,
 * because no shell can be counted on for it: bash puts its own termios back
 * while a job is stopped but does not give the job its raw mode back on `fg`,
 * and a shell without that bookkeeping puts back nothing. Its handler restores
 * the terminal, stops the program, and once a shell continues it puts the
 * handler back and raw mode with it.
 * A stop by SIGSTOP, which no program can catch, leaves the terminal raw at a
 * shell that puts nothing back.
 *
 * WASI has `read` and `poll` on stdin and no terminal interface, so there the
 * first two work (`readStdin` waiting, below) and the TTY questions answer
 * "not a terminal": false, `[-25, 0]`, and -25 for entering raw mode.
 * Otherwise Linux and Darwin only; the file uses nothing else. */
/* `SA_RESETHAND` is XSI, so _POSIX_C_SOURCE alone does not declare it on
   glibc; Darwin hides `TIOCGWINSZ` behind either unless `_DARWIN_C_SOURCE`
   says otherwise. */
#define _XOPEN_SOURCE 700
#if defined(__APPLE__)
#define _DARWIN_C_SOURCE
#endif
#include "nish.h"

#include <errno.h>
#include <unistd.h>
#ifdef __wasi__
#include <poll.h>
#else
#include <signal.h>
#include <stdlib.h>
#include <sys/ioctl.h>
#include <sys/select.h>
#include <termios.h>
#endif

#ifndef __wasi__
/* How many times the SIGTSTP handler has stopped the program, so a wait the
   stop interrupted can tell that from any other signal. Atomic, because the
   handler on one thread counts what a wait on another reads. */
static int nish_term_stops;

static int nish_term_stop_count(void) {
  return __atomic_load_n(&nish_term_stops, __ATOMIC_RELAXED);
}
#endif

/* 1 when stdin is readable within `timeout_ms` (a negative one waits for
   ever), which includes its end and an error, 0 when it is not or a signal
   ends the wait, and the host's `-errno` when the question fails. A Ctrl-Z
   and `fg` do not end it once `setRawMode(true)` has caught SIGTSTP: no
   system restarts a `select` after a handler, `SA_RESTART` or not, so one the
   handler's stop interrupted is asked again, for what Linux left of the
   timeout and Darwin for all of it. Before that, Linux restarts it after the
   default stop and Darwin ends the wait. Outside WASI this asks `select`,
   because Darwin's `poll` does not support devices: it answers POLLNVAL for a
   terminal at once, with no input there. Under WASI a timeout under 10 ms
   asks for 10: Node's WASI (uvwasi) runs a timer that is due before its first
   look at the descriptor, and counts it from before it set the look up, so a
   shorter wait answers "nothing waiting" while bytes are there whenever
   setting up took longer than the wait, as on a busy machine. */
static int nish_stdin_ready(int32_t timeout_ms) {
#ifdef __wasi__
  struct pollfd p = {0, POLLIN, 0};
  int r = poll(&p, 1, timeout_ms < 0 ? -1 : timeout_ms < 10 ? 10 : timeout_ms);
#else
  fd_set in;
  FD_ZERO(&in);
  FD_SET(0, &in);
  struct timeval tv = {timeout_ms / 1000, (timeout_ms % 1000) * 1000};
  int r, stops;
  do {
    stops = nish_term_stop_count();
    r = select(1, &in, 0, 0, timeout_ms < 0 ? 0 : &tv);
  } while (r < 0 && errno == EINTR && stops != nish_term_stop_count());
#endif
  if (r < 0) return errno == EINTR ? 0 : -errno;
  return r;
}

/* `readStdin(buf, off, len)`: at most `len` bytes into `buf` from `off`, the
   count, 0 at the end of the stream and -11 when nothing is waiting. The
   compiled call has already checked `0 <= off <= off + len <= buf.length`,
   unless the program was built with `--unchecked-indexing`. A `read` that a
   signal interrupts is asked again; one that would block (a descriptor some
   other program made non-blocking) is -11 too, and so is a readiness check a
   signal interrupts, which would otherwise fall through to a `read` that
   waits. Under WASI the check is left out and the read waits, so there the
   program asks `waitStdin` first. */
int32_t nish_read_stdin(nish_array *buf, int64_t off, int64_t len) {
#ifndef __wasi__
  int ready = nish_stdin_ready(0);
  if (ready <= 0) return ready == 0 ? -11 : ready;
#endif
  ssize_t n;
  do n = read(0, buf->data + off, (size_t)len);
  while (n < 0 && errno == EINTR);
  if (n >= 0) return (int32_t)n;
  return errno == EAGAIN || errno == EWOULDBLOCK ? -11 : -errno;
}

/* `waitStdin(timeoutMs)`: true once stdin is readable, which includes its end
   and an error, so a read after it answers at once; false when `timeoutMs`
   passes first, or a signal ends the wait early: not a Ctrl-Z once raw mode
   has caught SIGTSTP. A negative timeout waits for ever. */
bool nish_wait_stdin(int32_t timeout_ms) { return nish_stdin_ready(timeout_ms) != 0; }

#ifdef __wasi__
bool nish_is_terminal(int32_t fd) {
  (void)fd;
  return 0;
}
nish_array *nish_terminal_size(void) {
  nish_array *out = nish_alloc_array(sizeof(int32_t), 2);
  int32_t *w = (int32_t *)out->data;
  w[0] = -25;
  w[1] = 0;
  return out;
}
int32_t nish_set_raw_mode(bool on) { return on ? -25 : 0; }
#else
/* `isTerminal(fd)`: `isatty`. */
bool nish_is_terminal(int32_t fd) { return isatty(fd) == 1; }

/* `terminalSize()`: `[columns, rows]` of the terminal on stdout, or on stderr
   when stdout is not one (the two Node keeps a size for), as a fresh
   two-element `i32[]`; `[-errno, 0]` when neither is, -25 for "not a
   terminal" when either answered so. A terminal no one set a size for
   answers `[0, 0]`. */
nish_array *nish_terminal_size(void) {
  nish_array *out = nish_alloc_array(sizeof(int32_t), 2);
  int32_t *w = (int32_t *)out->data;
  struct winsize ws;
  int r = ioctl(1, TIOCGWINSZ, &ws);
  int err = errno;
  if (r != 0) r = ioctl(2, TIOCGWINSZ, &ws);
  if (r == 0) {
    w[0] = ws.ws_col;
    w[1] = ws.ws_row;
  } else {
    w[0] = err == ENOTTY || errno == ENOTTY ? -25 : -errno;
    w[1] = 0;
  }
  return out;
}

/* The termios stdin had before raw mode was entered, the raw one entered,
   whether that is in force now, and whether the exit and signal handlers are
   in place. One terminal per process, so one of each. */
static struct termios nish_term_saved, nish_term_raw_t;
static volatile sig_atomic_t nish_term_raw;
static int nish_term_armed;

/* Held across `setRawMode`, the atexit and panic restores, and the whole
   SIGTSTP handler, stop included, so two threads entering raw mode at once
   save the cooked termios once and arm the handlers once, and no mode is set
   between a Ctrl-Z's restore and its re-entry: the program stops with the
   terminal as it was, and comes back raw. A spin, because the runtime links
   no pthread without `--threads`. A thread holds it only with SIGTSTP blocked,
   so that handler never waits on the thread it interrupted, and every handler
   blocks SIGTSTP too; the other handlers end the program, and never take
   it. */
static int nish_term_lock;

/* Block or unblock SIGTSTP on this thread, `how` as `sigprocmask` takes it.
   `sigprocmask` rather than `pthread_sigmask` for the reason the lock is a
   spin; both Linux and Darwin apply it to the calling thread alone. */
static void nish_term_mask(int how, sigset_t *old) {
  sigset_t s;
  sigemptyset(&s);
  sigaddset(&s, SIGTSTP);
  sigprocmask(how, &s, old);
}

/* Block SIGTSTP and take the lock, the mask before in `old`. */
static void nish_term_hold(sigset_t *old) {
  nish_term_mask(SIG_BLOCK, old);
  while (__atomic_exchange_n(&nish_term_lock, 1, __ATOMIC_ACQUIRE)) {
  }
}

static void nish_term_drop(const sigset_t *old) {
  __atomic_store_n(&nish_term_lock, 0, __ATOMIC_RELEASE);
  sigprocmask(SIG_SETMASK, old, 0);
}

/* Put the saved termios back, once. Called with the lock held, or from a
   handler that ends the program, so it uses only calls that are
   async-signal-safe and needs no Ctrl-Z kept out: SIGTSTP is blocked in both.
   The flag is cleared after the call, so any other signal that lands during it
   restores again, which is harmless, rather than not at all. */
static void nish_term_restore(void) {
  if (nish_term_raw) {
    tcsetattr(0, TCSANOW, &nish_term_saved);
    nish_term_raw = 0;
    __atomic_store_n(&nish_fatal_hook, 0, __ATOMIC_RELEASE);
  }
}

/* The atexit and panic restore: under the lock, so it waits out a Ctrl-Z
   handler on another thread rather than leave the terminal to its re-entry. */
static void nish_term_leave(void) {
  sigset_t old;
  nish_term_hold(&old);
  nish_term_restore();
  nish_term_drop(&old);
}

/* Enter the raw termios, `when` as `tcsetattr` takes it: 0, or the host's
   `-errno`. Raw once the call has switched, not before: a signal that ends the
   program while it drains the output, or while SIGTTOU holds it stopped in the
   background, finds the terminal as it was and leaves it, rather than setting
   it from the background and being stopped again. */
static int32_t nish_term_enter(int when) {
  if (tcsetattr(0, when, &nish_term_raw_t) != 0) return -errno;
  nish_term_raw = 1;
  __atomic_store_n(&nish_fatal_hook, nish_term_leave, __ATOMIC_RELEASE);
  return 0;
}

/* Where a fault's handler runs, so a SIGSEGV from an exhausted stack can:
   64 KiB, past Darwin's MINSIGSTKSZ of 32 KiB and glibc's on any core. */
static char nish_term_alt_stack[65536];

static void nish_term_on_signal(int sig);

/* Catch `sig`: once, `SA_RESETHAND`, on the alternate stack, and with the
   signal left unblocked while the handler runs (`SA_NODEFER`), so the
   handler's own `raise` acts at once rather than after it returns, SIGTSTP
   aside. SIGTSTP is blocked in every handler, so a Ctrl-Z cannot stop one
   between its restore and its `raise`, and re-enter raw mode for the program
   to die in. `SA_RESTART`, so a call that a Ctrl-Z and `fg` interrupt goes on
   where the system restarts it. */
static void nish_term_catch(int sig) {
  struct sigaction sa;
  sa.sa_handler = nish_term_on_signal;
  sa.sa_flags = SA_RESETHAND | SA_ONSTACK | SA_NODEFER | SA_RESTART;
  sigemptyset(&sa.sa_mask);
  sigaddset(&sa.sa_mask, SIGTSTP);
  sigaction(sig, &sa, 0);
}

/* Restore the terminal and raise `sig` again at its default. `SA_RESETHAND`
   put the default back, except that POSIX lets a system keep the handler for
   SIGILL and SIGTRAP, so it is put back here too: `signal` is
   async-signal-safe. Every signal caught but SIGTSTP ends the program in that
   `raise`. SIGTSTP's handler holds the lock throughout and unblocks SIGTSTP
   for the `raise` alone, which stops the program and returns once a shell
   continues it, in the foreground or, after a SIGTTOU stop in the
   `tcsetattr`, once it is brought there. The handler that ends the program
   takes no lock, because the thread it interrupted may hold it. */
static void nish_term_on_signal(int sig) {
  if (sig != SIGTSTP) {
    nish_term_restore();
    signal(sig, SIG_DFL);
    raise(sig);
    return;
  }
  int err = errno;
  sigset_t old;
  nish_term_hold(&old);
  int was = nish_term_raw;
  nish_term_restore();
  signal(sig, SIG_DFL);
  __atomic_fetch_add(&nish_term_stops, 1, __ATOMIC_RELAXED);
  nish_term_mask(SIG_UNBLOCK, 0);
  raise(sig);
  nish_term_mask(SIG_BLOCK, 0);
  nish_term_catch(sig);
  if (was) nish_term_enter(TCSANOW);
  nish_term_drop(&old);
  errno = err;
}

/* `setRawMode(on)`: 0, or -25 when stdin is not a terminal and the host's
   `-errno` when `tcsetattr` refuses. Entering flushes the input a line
   discipline had already buffered; leaving keeps it. Asking for the mode the
   terminal is already in changes nothing. A program its shell runs in the
   background is stopped by SIGTTOU here, as any program that sets the
   terminal is, and goes on into raw mode on `fg`. */
static int32_t nish_term_set(bool on) {
  if (!on) {
    nish_term_restore();
    return 0;
  }
  if (nish_term_raw) return 0;
  if (!isatty(0)) return -25;
  if (tcgetattr(0, &nish_term_saved) != 0) return -errno;
  struct termios *t = &nish_term_raw_t;
  *t = nish_term_saved;
  t->c_iflag &= ~(tcflag_t)(IGNBRK | BRKINT | PARMRK | ISTRIP | INLCR | IGNCR | ICRNL | INPCK | IXON);
  t->c_cflag = (t->c_cflag & ~(tcflag_t)(CSIZE | PARENB)) | CS8;
  t->c_lflag &= ~(tcflag_t)(ECHO | ECHONL | ICANON | IEXTEN);
  t->c_cc[VMIN] = 1;
  t->c_cc[VTIME] = 0;
  if (!nish_term_armed) {
    nish_term_armed = 1;
    atexit(nish_term_leave);
    /* An alternate stack the thread already has, from C code the program
       links, is kept. */
    stack_t alt;
    if (sigaltstack(0, &alt) == 0 && (alt.ss_flags & SS_DISABLE)) {
      alt.ss_sp = nish_term_alt_stack;
      alt.ss_size = sizeof nish_term_alt_stack;
      alt.ss_flags = 0;
      sigaltstack(&alt, 0);
    }
    static const int sigs[] = {
        SIGINT,  SIGTERM, SIGQUIT, SIGHUP,  SIGPIPE, SIGALRM, SIGUSR1,
        SIGUSR2, SIGPROF, SIGVTALRM, SIGXCPU, SIGXFSZ, SIGSYS, SIGILL,
        SIGTRAP, SIGABRT, SIGFPE,  SIGBUS,  SIGSEGV, SIGTSTP};
    for (unsigned i = 0; i < sizeof sigs / sizeof sigs[0]; i++) {
      struct sigaction old;
      if (sigaction(sigs[i], 0, &old) == 0 && old.sa_handler == SIG_DFL) nish_term_catch(sigs[i]);
    }
  }
  return nish_term_enter(TCSAFLUSH);
}

int32_t nish_set_raw_mode(bool on) {
  sigset_t old;
  nish_term_hold(&old);
  int32_t r = nish_term_set(on);
  nish_term_drop(&old);
  return r;
}
#endif
