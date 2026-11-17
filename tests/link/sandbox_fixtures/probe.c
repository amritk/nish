/* The `--sandbox` section of tests/run.js links this file beside a Nish
 * program that declares `sb_probe` and calls it with its first argument. Each
 * operation tries one thing the sandbox decides and prints one line, `<op>:
 * ok` or `<op>: <errno name>`, so a check reads what the kernel answered
 * rather than a bare -1. An operation the filter kills prints nothing after
 * `<op>: start`, and the process ends by SIGSYS.
 *
 * Its constructor and its own `.preinit_array` entry each open /etc/passwd
 * and keep the errno, which is what the "runs confined" and "runs first"
 * checks read: a program without `fs.read` sees EACCES in both only if the
 * sandbox was applied before either ran.
 *
 * ptrace and the process_vm calls take their target's pid as the second
 * argument: tests/run.js starts a `sleep` for them, so a filter that let one
 * through would reach that child, never the runner. */
#define _GNU_SOURCE
#include <errno.h>
#include <pthread.h>
#include <signal.h>
#include <stdint.h>
#include <stdlib.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/ptrace.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/uio.h>
#include <sys/wait.h>
#include <sys/xattr.h>
#include <termios.h>
#include <unistd.h>

/* The runtime's test-only hooks, there only in a runtime built with
 * -DNISH_URING_TEST_HOOKS (runtime/runtime-uring.c), and its probe:
 * `nish_uring_test_fd(i)` answers premade ring i's descriptor number, and the
 * keeper's for i equal to the ring count. */
extern int32_t nish_uring_test_submit(int32_t i, int32_t op, int32_t flags) __attribute__((weak));
extern int32_t nish_uring_test_submit_fd(int32_t i, int32_t op, int32_t flags, int32_t fd) __attribute__((weak));
extern int32_t nish_uring_test_fd(int32_t i) __attribute__((weak));
extern int32_t nish_uring_probe(void);

static int ctor_errno = -1;
static int preinit_errno = -1;

static int open_errno(void) {
  int fd = open("/etc/passwd", O_RDONLY);
  if (fd < 0) return errno;
  close(fd);
  return 0;
}

__attribute__((constructor)) static void probe_ctor(void) { ctor_errno = open_errno(); }

static void probe_preinit(void) { preinit_errno = open_errno(); }
__attribute__((used, section(".preinit_array"))) static void (*const probe_preinit_entry)(void) = probe_preinit;

static const char *name(int e) {
  switch (e) {
  case EPERM: return "EPERM";
  case EACCES: return "EACCES";
  case ENOENT: return "ENOENT";
  case ENOTTY: return "ENOTTY";
  case ENOSYS: return "ENOSYS";
  case EINVAL: return "EINVAL";
  case ESRCH: return "ESRCH";
  case EOPNOTSUPP: return "EOPNOTSUPP";
  case EBADF: return "EBADF";
  }
  return strerror(e);
}

static void say(const char *op, long r) {
  printf("%s: %s\n", op, r < 0 ? name(errno) : "ok");
  fflush(stdout);
}

static void start(const char *op) {
  printf("%s: start\n", op);
  fflush(stdout);
}

/* Whether descriptors `a` and `b` name the same open file's inode. */
static int same_file(int a, int b) {
  struct stat x, y;
  return fstat(a, &x) == 0 && fstat(b, &y) == 0 && x.st_dev == y.st_dev && x.st_ino == y.st_ino;
}

/* After an operation meant to put the inherited foreign ring `foreign` at
 * premade ring 0's number `at`: prints whether it is there, and what entering
 * that number answers. Reached only where the filter let the operation by. */
static void landed(const char *op, int foreign, int at) {
  printf("%s: the foreign ring is %s ring 0's number\n", op, same_file(foreign, at) ? "at" : "not at");
  fflush(stdout);
  say(op, syscall(426, at, 0, 0, 0, NULL, 0));
}

/* Runs unconfined: makes an unrestricted ring, clears its close-on-exec flag
 * and runs `path <child> <ring>`, which inherits it; prints how that child
 * ended: `<op>: SIGSYS`, or its exit status. (Kernels from 6.7 refuse an
 * io_uring descriptor over SCM_RIGHTS, so inheritance is the route a parent
 * has on every kernel.) */
static int inherit(const char *op, const char *child, const char *path) {
  char params[120];
  memset(params, 0, sizeof params);
  int ring = (int)syscall(425, 1, params);
  if (ring < 0 || fcntl(ring, F_SETFD, 0) != 0) return say(op, -1), 1;
  char at[16];
  snprintf(at, sizeof at, "%d", ring);
  pid_t pid = fork();
  if (pid == 0) {
    char *argv[] = {(char *)path, (char *)child, at, 0};
    execv(path, argv);
    _exit(127);
  }
  if (pid < 0) return say(op, -1), 1;
  close(ring);
  int status = 0;
  waitpid(pid, &status, 0);
  if (WIFSIGNALED(status) && WTERMSIG(status) == SIGSYS)
    printf("%s: SIGSYS\n", op);
  else
    printf("%s: %s %d\n", op, WIFSIGNALED(status) ? "signal" : "exit", WIFSIGNALED(status) ? WTERMSIG(status) : WEXITSTATUS(status));
  fflush(stdout);
  return 0;
}

static void *thread_socket(void *arg) {
  (void)arg;
  say("thread-socket", socket(AF_INET, SOCK_STREAM, 0));
  return 0;
}

int sb_probe(const char *op, const char *path) {
  if (strcmp(op, "fork") == 0) {
    start(op);
    pid_t pid = fork();
    if (pid == 0) _exit(0);
    if (pid > 0) waitpid(pid, 0, 0);
    say(op, pid);
  } else if (strcmp(op, "execve") == 0) {
    start(op);
    char *argv[] = {"/bin/true", 0};
    say(op, execve("/bin/true", argv, 0));
  } else if (strcmp(op, "socket") == 0) {
    start(op);
    say(op, socket(AF_INET, SOCK_STREAM, 0));
  } else if (strcmp(op, "x32-socket") == 0) {
    start(op);
    /* The x32 number of socket is 41 with bit 30 set. */
    say(op, syscall(0x40000000L | 41, AF_INET, SOCK_STREAM, 0));
  } else if (strcmp(op, "io_uring_setup") == 0) {
    start(op);
    /* R_DISABLED, which the premake makes its rings with, and DEFER_TASKRUN
     * with the SINGLE_ISSUER it needs, the probe's floor (flags at offset 8):
     * `ok` unconfined says this kernel takes the rings --sandbox premakes. */
    char params[120];
    memset(params, 0, sizeof params);
    uint32_t flags = (1u << 6) | (1u << 12) | (1u << 13);
    memcpy(params + 8, &flags, sizeof flags);
    say(op, syscall(425, 1, params));
  } else if (strcmp(op, "io_uring_register") == 0) {
    start(op);
    say(op, syscall(427, -1, 0, NULL, 0));
  } else if (strcmp(op, "io_uring_enter") == 0) {
    /* On stderr, an open descriptor that is no ring: unconfined, or with
     * both net and process.spawn, the kernel refuses it; any other sandbox
     * kills it, since 2 is none of the rings made before the filter. */
    start(op);
    say(op, syscall(426, 2, 0, 0, 0, NULL, 0));
  } else if (strcmp(op, "inherit-ring") == 0) {
    /* The foreign ring's child enters it at its own number. */
    return inherit(op, "foreign-enter", path);
  } else if (strncmp(op, "inherit:", 8) == 0) {
    /* `inherit:<child>`: the same, with the child running operation <child>. */
    return inherit(op, op + 8, path);
  } else if (strcmp(op, "foreign-enter") == 0) {
    /* `path` is the number of a ring this process inherited: enters it,
     * submitting nothing, which the kernel answers 0. */
    start(op);
    say(op, syscall(426, atoi(path), 0, 0, 0, NULL, 0));
  } else if (strcmp(op, "dup2-ring") == 0 || strcmp(op, "dup3-ring") == 0 || strcmp(op, "close-dup") == 0) {
    /* NURING-36: `path` is an inherited foreign ring's number, put at premade
     * ring 0's by dup2, by dup3, or by closing ring 0 and duplicating the
     * foreign ring at the lowest free number from there. Under the filter
     * each dies of SIGSYS after `<op>: start`. */
    if (nish_uring_test_fd == NULL) return printf("%s: no hook\n", op), 1;
    int foreign = atoi(path), at = nish_uring_test_fd(0);
    start(op);
    long r;
    if (op[0] == 'c') {
      r = close(at);
      if (r == 0) r = fcntl(foreign, F_DUPFD, at);
    } else if (op[3] == '3') {
      r = dup3(foreign, at, 0);
    } else {
#ifdef SYS_dup2
      r = syscall(SYS_dup2, foreign, at);
#else
      return printf("%s: no dup2 on this architecture\n", op), 1;
#endif
    }
    if (r < 0) return say(op, r), 1;
    landed(op, foreign, at);
  } else if (strcmp(op, "freed-dup") == 0) {
    /* NURING-36: run after a ring listener has been closed, so premade ring
     * 0 is freed. `path` is an inherited foreign ring's number, duplicated at
     * the lowest free number from ring 0's: prints where it landed, whether
     * ring 0's number still names an io_uring file, and what entering it
     * answers. */
    if (nish_uring_test_fd == NULL) return printf("%s: no hook\n", op), 1;
    int foreign = atoi(path), at = nish_uring_test_fd(0);
    int d = fcntl(foreign, F_DUPFD, at);
    char link[64], where[32];
    snprintf(where, sizeof where, "/proc/self/fd/%d", at);
    ssize_t n = readlink(where, link, sizeof link - 1);
    link[n > 0 ? n : 0] = 0;
    printf("%s: the duplicate took %s; the number holds %s\n", op, d == at ? "ring 0's number" : "another number",
           strcmp(link, "anon_inode:[io_uring]") == 0 ? (same_file(foreign, at) ? "the foreign ring" : "another ring") : "no ring");
    fflush(stdout);
    say(op, syscall(426, at, 0, 0, 0, NULL, 0));
  } else if (strcmp(op, "keeper-enter") == 0) {
    /* The keeper, the ring a freed ring's number is pointed at, is on no
     * list io_uring_enter may name. */
    if (nish_uring_test_fd == NULL) return printf("%s: no hook\n", op), 1;
    int keeper = nish_uring_test_fd(1);
    start(op);
    say(op, syscall(426, keeper, 0, 0, 0, NULL, 0));
  } else if (strcmp(op, "close-range") == 0) {
    /* close_range over premade ring 0's number, which the filter answers
     * ENOSYS so that a C library falls back to close. */
    if (nish_uring_test_fd == NULL) return printf("%s: no hook\n", op), 1;
    int at = nish_uring_test_fd(0);
    start(op);
    say(op, syscall(436, at, at, 0));
  } else if (strcmp(op, "uring-close") == 0) {
    /* IORING_OP_CLOSE, which the restriction lets through, submitted to ring
     * 0 on `path`: `ring` (ring 0's own number), `keeper`, or `pipe` (the
     * control, a pipe's read end). */
    if (nish_uring_test_fd == NULL || nish_uring_test_submit_fd == NULL) return printf("%s: no hook\n", op), 1;
    int fd = -1, p[2];
    if (strcmp(path, "ring") == 0) fd = nish_uring_test_fd(0);
    else if (strcmp(path, "keeper") == 0) fd = nish_uring_test_fd(1);
    else if (pipe(p) == 0) fd = p[0];
    start(op);
    int32_t res = nish_uring_test_submit_fd(0, 19, 0, fd);
    if (res < 0) errno = -res;
    say(op, res);
  } else if (strcmp(op, "fd-ops") == 0) {
    /* The control: dup2, dup3, close and F_DUPFD on descriptors that are no
     * ring still work under the filter. */
    int p[2];
    start(op);
    if (pipe(p) != 0) return say(op, -1), 1;
    long r = dup3(p[0], 100, 0);
#ifdef SYS_dup2
    if (r >= 0) r = syscall(SYS_dup2, p[1], 101);
#else
    if (r >= 0) r = dup3(p[1], 101, 0);
#endif
    if (r >= 0) r = close(100);
    if (r >= 0) r = fcntl(p[0], F_DUPFD, 100);
    if (r >= 0) r = close((int)r) | close(101) | close(p[0]) | close(p[1]);
    say(op, r);
  } else if (strcmp(op, "ring-sqe") == 0) {
    /* `path` is `<opcode>:<sqe flags>`, submitted to premade ring 0 through
     * the runtime's test hook; prints the completion's res. */
    start(op);
    int code = atoi(path), flags = 0;
    const char *colon = strchr(path, ':');
    if (colon != NULL) flags = atoi(colon + 1);
    if (nish_uring_test_submit == NULL) {
      printf("%s: no hook\n", op);
      fflush(stdout);
      return 1;
    }
    int32_t res = nish_uring_test_submit(0, code, flags);
    if (res < 0) errno = -res;
    say(op, res);
  } else if (strcmp(op, "ring-count") == 0) {
    /* How many io_uring descriptors the process holds, by their link text. */
    int count = 0;
    char link[64], at[32];
    for (int fd = 0; fd < 1024; fd++) {
      snprintf(at, sizeof at, "/proc/self/fd/%d", fd);
      ssize_t n = readlink(at, link, sizeof link - 1);
      if (n <= 0) continue;
      link[n] = 0;
      if (strcmp(link, "anon_inode:[io_uring]") == 0) count++;
    }
    printf("%s: %d\n", op, count);
    fflush(stdout);
  } else if (strcmp(op, "ring-probe") == 0) {
    start(op);
    printf("%s: %d\n", op, nish_uring_probe());
    fflush(stdout);
  } else if (strcmp(op, "process_vm_writev") == 0 || strcmp(op, "process_vm_readv") == 0) {
    start(op);
    char byte = 0;
    struct iovec local = {&byte, 1}, remote = {&byte, 1};
    pid_t to = (pid_t)atoi(path);
    say(op, op[11] == 'w' ? process_vm_writev(to, &local, 1, &remote, 1, 0) : process_vm_readv(to, &local, 1, &remote, 1, 0));
  } else if (strcmp(op, "ptrace") == 0) {
    start(op);
    say(op, ptrace(PTRACE_ATTACH, (pid_t)atoi(path), 0, 0));
  } else if (strcmp(op, "pidfd_getfd") == 0) {
    start(op);
    say(op, syscall(438, -1, 0, 0));
  } else if (strcmp(op, "connect") == 0) {
    start(op);
    say(op, syscall(SYS_connect, -1, 0, 0));
  } else if (strcmp(op, "socketpair") == 0) {
    start(op);
    int sv[2];
    say(op, syscall(SYS_socketpair, AF_UNIX, SOCK_STREAM, 0, sv));
  } else if (strcmp(op, "accept4") == 0) {
    start(op);
    say(op, syscall(SYS_accept4, -1, 0, 0, 0));
  } else if (strcmp(op, "execveat") == 0) {
    start(op);
    char *argv[] = {"/bin/true", 0};
    say(op, syscall(SYS_execveat, AT_FDCWD, "/bin/true", argv, 0, 0));
  } else if (strcmp(op, "clone3") == 0) {
    /* No struct: the filter answers ENOSYS before the kernel reads one, and
     * an unconfined call fails on the null pointer instead. */
    say(op, syscall(435, 0, 0));
#if defined(SYS_fork) && defined(SYS_vfork)
  } else if (strcmp(op, "raw-fork") == 0) {
    start(op);
    long pid = syscall(SYS_fork);
    if (pid == 0) _exit(0);
    if (pid > 0) waitpid((pid_t)pid, 0, 0);
    say(op, pid);
  } else if (strcmp(op, "raw-vfork") == 0) {
    /* Only ever run confined, where the call never returns: a raw vfork
     * child would return into this frame and spoil the parent's stack. */
    start(op);
    say(op, syscall(SYS_vfork));
#endif
#if defined(__x86_64__)
  } else if (strcmp(op, "i386") == 0) {
    /* getpid through the 32-bit entry, which seccomp sees as AUDIT_ARCH_I386. */
    start(op);
    long r = 20;
    __asm__ volatile("int $0x80" : "+a"(r) : : "memory");
    printf("%s: %s\n", op, r == (long)getpid() ? "ok" : "failed");
    fflush(stdout);
#endif
  } else if (strcmp(op, "thread-socket") == 0) {
    start(op);
    pthread_t t;
    if (pthread_create(&t, 0, thread_socket, 0) != 0) return 1;
    pthread_join(t, 0);
  } else if (strcmp(op, "tasks") == 0) {
    /* The threads of this process, counted without a file: thread ids follow
     * the process id, and tgkill with signal 0 answers only for this group's. */
    pid_t me = getpid();
    int n = 0;
    for (long t = me; t < (long)me + 65536; t++)
      if (syscall(SYS_tgkill, me, (pid_t)t, 0) == 0) n++;
    printf("tasks: %d\n", n);
    fflush(stdout);
  } else if (strcmp(op, "meta") == 0) {
    say("chmod", chmod(path, 0644));
    say("utimensat", utimensat(AT_FDCWD, path, 0, 0));
    say("setxattr", setxattr(path, "user.nish", "1", 1, 0));
  } else if (strcmp(op, "open") == 0) {
    say(op, open(path, O_RDONLY | O_CLOEXEC));
  } else if (strcmp(op, "create") == 0) {
    say(op, open(path, O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0644));
  } else if (strcmp(op, "ioctl") == 0) {
    int fd = open("/dev/null", O_RDONLY | O_CLOEXEC);
    struct termios t;
    say("open", fd);
    say(op, fd < 0 ? fd : ioctl(fd, TCGETS, &t));
  } else if (strcmp(op, "status") == 0) {
    FILE *f = fopen("/proc/self/status", "r");
    char line[256];
    if (!f) {
      say(op, -1);
      return 0;
    }
    while (fgets(line, sizeof line, f))
      if (strncmp(line, "Cap", 3) == 0 || strncmp(line, "NoNewPrivs", 10) == 0 || strncmp(line, "Seccomp:", 8) == 0 ||
          strncmp(line, "Threads", 7) == 0)
        fputs(line, stdout);
    fclose(f);
    fflush(stdout);
  } else if (strcmp(op, "ctor") == 0) {
    printf("ctor: %s, preinit: %s\n", ctor_errno ? name(ctor_errno) : "ok", preinit_errno ? name(preinit_errno) : "ok");
    fflush(stdout);
  } else {
    printf("%s: no such operation\n", op);
    return 1;
  }
  return 0;
}
