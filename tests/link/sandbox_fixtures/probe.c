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
    char params[120];
    memset(params, 0, sizeof params);
    say(op, syscall(425, 1, params));
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
