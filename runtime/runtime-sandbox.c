/* Nish runtime, the sandbox half: `--sandbox` (docs/wp37-os-sandbox.md)
 * confines a native program to the capabilities its `main` reaches, and this
 * file is the part that asks the kernel to.
 *
 * A translation unit of its own for the reason the other halves are one: each
 * file carries its own measured `.text*` ceiling in tests/runtime-budgets.js,
 * and runtime-os.c had 6 bytes of its ceiling left. scripts/build.sh pairs it
 * with runtime.c like the others, and a program built without `--sandbox`
 * calls nothing here, so `--gc-sections` drops all of it.
 *
 * The compiler emits one call, from an entry in `.preinit_array`, so it runs
 * before any constructor in the executable, an `ffi` object or a shared
 * library:
 *
 *   nish_sandbox(caps, mode, read_dirs, write_dirs)
 *
 * `caps` is `main`'s capability mask (src/capabilities.ts numbers the bits),
 * `mode` is 1 for `--sandbox` and 2 for `--sandbox=best-effort`. The two
 * directory lists are the scoped `fs.read=<dir>` and `fs.write=<dir>` of a
 * later stage; this one always passes null and reads neither.
 *
 * What it does, in the order of the note's section 3, each step before the
 * next because each needs the one before it:
 *
 *   1. prime the thread pool's ceiling, which reads /proc and /sys files that
 *      step 4 may close;
 *   2. `PR_SET_NO_NEW_PRIVS`, which Landlock and seccomp need and which keeps
 *      an `exec` from gaining a capability back;
 *   3. drop every capability, and read each set back;
 *   4. Landlock: handle every filesystem right the running ABI knows, then
 *      grant back beneath `/` exactly what the mask grants;
 *   5. the seccomp filter of the note's section 4, a denylist;
 *   6. set the flag `nish_sandbox_check` reads at the top of `main`, so a C
 *      library that never ran `.preinit_array` (musl) refuses to run rather
 *      than running unconfined.
 *
 * A failure prints one line, `nish: --sandbox: <what> (<errno name>)`, and
 * ends the process with `_exit(126)`, the shell's "found but cannot run", in
 * both modes. Best-effort differs only where the kernel lacks a feature: no
 * Landlock, or a Landlock too old to withhold a right; it then says what it
 * could not withhold, once, and runs. No environment variable, file or
 * argument is read that could widen any of it. The one knob,
 * `-DNISH_SANDBOX_SIMULATE_ABI=<n>`, makes the ABI probe answer `n` in a
 * test-only build of this file; scripts/build.sh never passes it.
 *
 * Messages go through write(2) rather than stdio: nothing here may allocate or
 * touch a `FILE` before libc has finished its own start-up. */
#define _GNU_SOURCE
#include "nish.h"

#include <unistd.h>

#ifdef __linux__

#include <errno.h>
#include <fcntl.h>
#include <stddef.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <linux/audit.h>
#include <linux/capability.h>
#include <linux/filter.h>
#include <linux/seccomp.h>

/* The capability bits of src/capabilities.ts this file reads. */
#define CAP_BIT_FS_READ (1 << 5)
#define CAP_BIT_FS_WRITE (1 << 6)
#define CAP_BIT_NET (1 << 7)
#define CAP_BIT_SPAWN (1 << 8)

/* Landlock's numbers, spelled here rather than taken from <linux/landlock.h>,
 * which an older toolchain lacks and whose newest rights it lacks too. */
#define LL_CREATE 444
#define LL_ADD_RULE 445
#define LL_RESTRICT 446
#define LL_CREATE_RULESET_VERSION 1u
#define LL_RULE_PATH_BENEATH 1
#define LL_EXECUTE (1ull << 0)
#define LL_WRITE_FILE (1ull << 1)
#define LL_READ_FILE (1ull << 2)
#define LL_READ_DIR (1ull << 3)
#define LL_REFER (1ull << 13)
#define LL_TRUNCATE (1ull << 14)
#define LL_IOCTL_DEV (1ull << 15)
/* REMOVE_DIR through MAKE_SYM, bits 4 to 12: every right that makes or removes
 * a name. */
#define LL_MAKE_REMOVE (((1ull << 13) - 1) & ~(LL_EXECUTE | LL_WRITE_FILE | LL_READ_FILE | LL_READ_DIR))
#define LL_ABI1 ((1ull << 13) - 1)
#define LL_SCOPE_ALL 3ull /* ABSTRACT_UNIX_SOCKET | SIGNAL, ABI 6 */

struct nish_ll_ruleset {
  uint64_t handled_access_fs;
  uint64_t handled_access_net;
  uint64_t scoped;
};

struct nish_ll_path_beneath {
  uint64_t allowed_access;
  int32_t parent_fd;
} __attribute__((packed));

#ifndef SECCOMP_RET_KILL_PROCESS
#define SECCOMP_RET_KILL_PROCESS 0x80000000u
#endif
#ifndef SECCOMP_GET_ACTION_AVAIL
#define SECCOMP_GET_ACTION_AVAIL 2
#endif
#ifndef SECCOMP_FILTER_FLAG_TSYNC
#define SECCOMP_FILTER_FLAG_TSYNC 1
#endif
#ifndef SYS_seccomp
#if defined(__x86_64__)
#define SYS_seccomp 317
#else
#define SYS_seccomp 277
#endif
#endif
#ifndef PR_CAP_AMBIENT
#define PR_CAP_AMBIENT 47
#define PR_CAP_AMBIENT_IS_SET 1
#define PR_CAP_AMBIENT_CLEAR_ALL 4
#endif

#define KILL SECCOMP_RET_KILL_PROCESS
#define CLONE_THREAD_FLAG 0x00010000u
#define EPERM_RET (SECCOMP_RET_ERRNO | EPERM)
#define ENOSYS_RET (SECCOMP_RET_ERRNO | ENOSYS)

/* The syscall numbers each row of the note's section 4 names, per
 * architecture. A number the running kernel does not have matches nothing.
 * AArch64 has no `fork`, `vfork`, `chmod`, `chown`, `lchown`, `utime`,
 * `utimes` or `futimesat`: only the `*at` and `f` forms. */
#if defined(__x86_64__)
#define NISH_SB_ARCH AUDIT_ARCH_X86_64
static const uint16_t nish_sb_always[] = {101, 310, 311, 438}; /* ptrace, process_vm_readv/writev, pidfd_getfd */
static const uint16_t nish_sb_net[] = {41, 53, 42, 49, 50, 43, 288}; /* socket ... accept4 */
static const uint16_t nish_sb_spawn[] = {59, 322, 57, 58}; /* execve, execveat, fork, vfork */
#define NISH_SB_CLONE 56
static const uint16_t nish_sb_meta[] = {
    90, 91, 268, 452,   /* chmod, fchmod, fchmodat, fchmodat2 */
    92, 93, 94, 260,    /* chown, fchown, lchown, fchownat */
    132, 235, 261, 280, /* utime, utimes, futimesat, utimensat */
    188, 189, 190, 463, /* setxattr, lsetxattr, fsetxattr, setxattrat */
    197, 198, 199, 466, /* removexattr, lremovexattr, fremovexattr, removexattrat */
};
#elif defined(__aarch64__)
#define NISH_SB_ARCH AUDIT_ARCH_AARCH64
static const uint16_t nish_sb_always[] = {117, 270, 271, 438};
static const uint16_t nish_sb_net[] = {198, 199, 203, 200, 201, 202, 242};
static const uint16_t nish_sb_spawn[] = {221, 281};
#define NISH_SB_CLONE 220
static const uint16_t nish_sb_meta[] = {
    52, 53, 452, /* fchmod, fchmodat, fchmodat2 */
    55, 54,      /* fchown, fchownat */
    88,          /* utimensat */
    5, 6, 7, 463,    /* setxattr, lsetxattr, fsetxattr, setxattrat */
    14, 15, 16, 466, /* removexattr, lremovexattr, fremovexattr, removexattrat */
};
#endif
static const uint16_t nish_sb_uring[] = {425, 426, 427}; /* io_uring_setup, _enter, _register */
#define NISH_SB_CLONE3 435

/* Set by step 6 and read by `nish_sandbox_check`. */
static int nish_sb_applied = 0;

/* The errno names a failure prints; a number for any other. */
static const char *nish_sb_errno_name(int e, char *buf) {
  switch (e) {
  case EPERM: return "EPERM";
  case ENOSYS: return "ENOSYS";
  case EOPNOTSUPP: return "EOPNOTSUPP";
  case EINVAL: return "EINVAL";
  case EACCES: return "EACCES";
  case ENOENT: return "ENOENT";
  case EFAULT: return "EFAULT";
  case E2BIG: return "E2BIG";
  case ENOMEM: return "ENOMEM";
  case EBUSY: return "EBUSY";
  }
  char digits[12];
  int n = 0;
  unsigned u = (unsigned)e;
  do digits[n++] = (char)('0' + u % 10); while ((u /= 10) != 0 && n < 11);
  memcpy(buf, "errno ", 6);
  for (int i = 0; i < n; i++) buf[6 + i] = digits[n - 1 - i];
  buf[6 + n] = 0;
  return buf;
}

/* One line on stderr from up to three pieces; a null piece is left out. */
static void nish_sb_say(const char *a, const char *b, const char *c) {
  const char *parts[4] = {"nish: --sandbox: ", a, b, c};
  for (int i = 0; i < 4; i++)
    if (parts[i]) (void)!write(2, parts[i], strlen(parts[i]));
  (void)!write(2, "\n", 1);
}

/* The one way out on a failure, in both modes. */
static void nish_sb_fail(const char *what) {
  char buf[24];
  char tail[40] = " (";
  const char *name = nish_sb_errno_name(errno, buf);
  size_t len = strlen(name);
  memcpy(tail + 2, name, len);
  memcpy(tail + 2 + len, ")", 2);
  nish_sb_say(what, tail, 0);
  _exit(126);
}

/* Step 3. `capset` with every set empty needs no privilege; the bounding set
 * needs CAP_SETPCAP to drop, and need not be dropped without it, because with
 * NO_NEW_PRIVS and an empty permitted set nothing it allows can be gained.
 * Each set is read back rather than trusted, since a call that answered 0
 * and left a capability would otherwise run the program privileged. */
static void nish_sb_drop_capabilities(void) {
  struct __user_cap_header_struct head = {_LINUX_CAPABILITY_VERSION_3, 0};
  struct __user_cap_data_struct data[2];
  if (syscall(SYS_capget, &head, data) != 0) nish_sb_fail("cannot read the capability sets");
  int setpcap = (data[0].effective >> CAP_SETPCAP) & 1;
  if (setpcap)
    for (int cap = 0; cap < 64; cap++)
      if (prctl(PR_CAPBSET_DROP, cap, 0, 0, 0) != 0 && errno != EINVAL) nish_sb_fail("cannot empty the bounding set");
  /* EINVAL is a kernel older than 4.3, which has no ambient set to clear. */
  if (prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_CLEAR_ALL, 0, 0, 0) != 0 && errno != EINVAL)
    nish_sb_fail("cannot clear the ambient set");
  memset(data, 0, sizeof data);
  if (syscall(SYS_capset, &head, data) != 0) nish_sb_fail("cannot drop the capabilities");
  if (syscall(SYS_capget, &head, data) != 0) nish_sb_fail("cannot read the capability sets");
  errno = EPERM;
  for (int i = 0; i < 2; i++)
    if (data[i].effective | data[i].permitted | data[i].inheritable) nish_sb_fail("a capability survived the drop");
  for (int cap = 0; cap < 64; cap++) {
    if (prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_IS_SET, cap, 0, 0) == 1) nish_sb_fail("an ambient capability survived the drop");
    if (setpcap && prctl(PR_CAPBSET_READ, cap, 0, 0, 0) == 1) nish_sb_fail("a bounding capability survived the drop");
  }
}

/* The Landlock ABI the kernel answers, or -1 with errno set. */
static int nish_sb_landlock_abi(void) {
#ifdef NISH_SANDBOX_SIMULATE_ABI
  if (NISH_SANDBOX_SIMULATE_ABI == 0) {
    errno = ENOSYS;
    return -1;
  }
  return NISH_SANDBOX_SIMULATE_ABI;
#else
  return (int)syscall(LL_CREATE, NULL, 0, LL_CREATE_RULESET_VERSION);
#endif
}

/* The rights the mask grants, whatever the ABI knows. `process.spawn` grants
 * EXECUTE and READ_FILE beneath `/` whatever `fs.read` says, since a child
 * must read and execute its binary and libraries wherever PATH finds them,
 * and IOCTL_DEV, since a device's ioctl can act like a spawn (TIOCSTI). */
static uint64_t nish_sb_granted(int32_t caps) {
  uint64_t rights = 0;
  if (caps & CAP_BIT_FS_READ) rights |= LL_READ_FILE | LL_READ_DIR;
  if (caps & CAP_BIT_FS_WRITE) rights |= LL_WRITE_FILE | LL_MAKE_REMOVE | LL_REFER | LL_TRUNCATE;
  if (caps & CAP_BIT_SPAWN) rights |= LL_EXECUTE | LL_READ_FILE | LL_IOCTL_DEV;
  return rights;
}

/* Appends to the best-effort line the name of each right the ABI could not
 * withhold. REFER is never named: below ABI 2 the kernel refuses every
 * rename or link across directories, which is stricter, not weaker. */
static size_t nish_sb_name(char *line, size_t at, const char *name) {
  size_t len = strlen(name);
  if (at) memcpy(line + at, ", ", 2), at += 2;
  memcpy(line + at, name, len);
  return at + len;
}

/* Step 4. Every right the ABI knows is handled, and one path_beneath rule on
 * `/` grants back what the mask grants, so a right is withheld everywhere or
 * nowhere. Returns with nothing done when there is no Landlock and the mode
 * is best-effort. */
static void nish_sb_landlock(int32_t caps, int32_t mode) {
  int abi = nish_sb_landlock_abi();
  if (abi < 0) {
    /* EPERM is a container runtime's own seccomp profile refusing the call;
     * EOPNOTSUPP is Landlock built but not in the lsm= list. */
    if (errno != ENOSYS && errno != EOPNOTSUPP && errno != EPERM) nish_sb_fail("cannot read the Landlock ABI");
    if (mode != 2) {
      nish_sb_say("this kernel has no Landlock; build with --sandbox=best-effort to run with seccomp alone", 0, 0);
      _exit(126);
    }
    nish_sb_say("no Landlock, files are not confined", 0, 0);
    return;
  }
  uint64_t known = LL_ABI1;
  if (abi >= 2) known |= LL_REFER;
  if (abi >= 3) known |= LL_TRUNCATE;
  if (abi >= 5) known |= LL_IOCTL_DEV;
  uint64_t granted = nish_sb_granted(caps);
  uint64_t lost = ~granted & ~known & (LL_TRUNCATE | LL_IOCTL_DEV);
  int unscoped = abi < 6;
  /* Strict runs without IOCTL_DEV and without the ABI 6 scopes: a terminal
   * already on fd 0 gives the first on every ABI, and the second is no Nish
   * builtin's (open questions 8 and 12). Only TRUNCATE refuses it. */
  if (mode != 2 && (lost & LL_TRUNCATE)) {
    nish_sb_say("this kernel's Landlock cannot withhold TRUNCATE; build with --sandbox=best-effort to run without it", 0, 0);
    _exit(126);
  }
  if (mode == 2 && (lost || unscoped)) {
    char line[80];
    size_t at = 0;
    if (lost & LL_TRUNCATE) at = nish_sb_name(line, at, "TRUNCATE");
    if (lost & LL_IOCTL_DEV) at = nish_sb_name(line, at, "IOCTL_DEV");
    if (unscoped) at = nish_sb_name(line, at, "the signal and abstract socket scopes");
    line[at] = 0;
    nish_sb_say("this kernel's Landlock cannot withhold ", line, ", so they are not confined");
  }
  struct nish_ll_ruleset attr = {known, 0, abi >= 6 ? LL_SCOPE_ALL : 0};
  int ruleset = (int)syscall(LL_CREATE, &attr, sizeof attr, 0);
  if (ruleset < 0) nish_sb_fail("cannot create the Landlock ruleset");
  struct nish_ll_path_beneath rule = {granted & known, -1};
  /* A rule granting nothing is refused (ENOMSG), and nothing is what it
   * would add, so it is left out. */
  if (rule.allowed_access) {
    rule.parent_fd = open("/", O_PATH | O_CLOEXEC);
    if (rule.parent_fd < 0) nish_sb_fail("cannot open /");
    if (syscall(LL_ADD_RULE, ruleset, LL_RULE_PATH_BENEATH, &rule, 0) != 0) nish_sb_fail("cannot add the Landlock rule");
    close(rule.parent_fd);
  }
  if (syscall(LL_RESTRICT, ruleset, 0) != 0) nish_sb_fail("cannot apply the Landlock ruleset");
  close(ruleset);
}

/* Appends `JEQ nr; RET action` for each number to the program at `at`. */
static int nish_sb_rows(struct sock_filter *prog, int at, const uint16_t *nrs, int count, uint32_t action) {
  for (int i = 0; i < count; i++) {
    prog[at++] = (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, nrs[i], 0, 1);
    prog[at++] = (struct sock_filter)BPF_STMT(BPF_RET | BPF_K, action);
  }
  return at;
}

#define NISH_SB_ROWS(prog, at, nrs, action) nish_sb_rows(prog, at, nrs, (int)(sizeof nrs / sizeof nrs[0]), action)

/* The low word of `clone`'s flags, where CLONE_THREAD lives. */
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
#define NISH_SB_ARG0_LOW (offsetof(struct seccomp_data, args) + 4)
#else
#define NISH_SB_ARG0_LOW offsetof(struct seccomp_data, args)
#endif

/* Step 5: a denylist (open question 4), each row of the note's section 4.
 * The arch check comes first and kills on a mismatch, so a 32-bit entry
 * cannot step around the 64-bit numbers; on x86-64 the next instruction
 * kills any number with bit 30 set, since an x32 call reports
 * AUDIT_ARCH_X86_64 and would match none of them. */
static void nish_sb_seccomp(int32_t caps) {
  uint32_t action = SECCOMP_RET_KILL_PROCESS;
  if (syscall(SYS_seccomp, SECCOMP_GET_ACTION_AVAIL, 0, &action) != 0)
    nish_sb_fail("this kernel has no seccomp filter that kills the process");
  struct sock_filter prog[96];
  int at = 0;
  prog[at++] = (struct sock_filter)BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch));
  prog[at++] = (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, NISH_SB_ARCH, 1, 0);
  prog[at++] = (struct sock_filter)BPF_STMT(BPF_RET | BPF_K, KILL);
  prog[at++] = (struct sock_filter)BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr));
#if defined(__x86_64__)
  prog[at++] = (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JSET | BPF_K, 0x40000000, 0, 1);
  prog[at++] = (struct sock_filter)BPF_STMT(BPF_RET | BPF_K, KILL);
#endif
  at = NISH_SB_ROWS(prog, at, nish_sb_always, KILL);
  if (!(caps & CAP_BIT_NET)) at = NISH_SB_ROWS(prog, at, nish_sb_net, KILL);
  /* io_uring opens, connects and accepts sockets without those calls. */
  if ((caps & (CAP_BIT_NET | CAP_BIT_SPAWN)) != (CAP_BIT_NET | CAP_BIT_SPAWN))
    at = NISH_SB_ROWS(prog, at, nish_sb_uring, KILL);
  if (!(caps & CAP_BIT_FS_WRITE)) at = NISH_SB_ROWS(prog, at, nish_sb_meta, EPERM_RET);
  if (!(caps & CAP_BIT_SPAWN)) {
    at = NISH_SB_ROWS(prog, at, nish_sb_spawn, KILL);
    /* clone3's flags are in a struct seccomp cannot read, so it answers
     * ENOSYS and glibc falls back to clone, where they are visible. */
    static const uint16_t clone3[] = {NISH_SB_CLONE3};
    at = NISH_SB_ROWS(prog, at, clone3, ENOSYS_RET);
    /* clone is a thread when CLONE_THREAD is set and a process otherwise.
     * The accumulator is overwritten, so this is the last row. */
    prog[at++] = (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, NISH_SB_CLONE, 0, 4);
    prog[at++] = (struct sock_filter)BPF_STMT(BPF_LD | BPF_W | BPF_ABS, NISH_SB_ARG0_LOW);
    prog[at++] = (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JSET | BPF_K, CLONE_THREAD_FLAG, 0, 1);
    prog[at++] = (struct sock_filter)BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW);
    prog[at++] = (struct sock_filter)BPF_STMT(BPF_RET | BPF_K, KILL);
  }
  prog[at++] = (struct sock_filter)BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW);
  struct sock_fprog fprog = {(unsigned short)at, prog};
  if (syscall(SYS_seccomp, SECCOMP_SET_MODE_FILTER, SECCOMP_FILTER_FLAG_TSYNC, &fprog) != 0)
    nish_sb_fail("cannot load the seccomp filter");
}

void nish_sandbox(int32_t caps, int32_t mode, const char *read_dirs, const char *write_dirs) {
  (void)read_dirs;
  (void)write_dirs;
  nish_cpu_prime();
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) nish_sb_fail("cannot set no_new_privs");
  nish_sb_drop_capabilities();
  nish_sb_landlock(caps, mode);
  nish_sb_seccomp(caps);
  __atomic_store_n(&nish_sb_applied, 1, __ATOMIC_RELEASE);
}

void nish_sandbox_check(void) {
  if (__atomic_load_n(&nish_sb_applied, __ATOMIC_ACQUIRE)) return;
  nish_sb_say("the C library did not run .preinit_array, so the program was not confined", 0, 0);
  _exit(126);
}

#else

/* Every other platform: a target-neutral `.ll` built with `--sandbox` and
 * linked by hand here refuses to run rather than running unconfined. Both
 * symbols refuse, because a platform that never runs `.preinit_array` reaches
 * only the check. */
static void nish_sb_none(void) {
  static const char line[] = "nish: --sandbox: this platform has no sandbox\n";
  (void)!write(2, line, sizeof line - 1);
  _exit(126);
}

void nish_sandbox(int32_t caps, int32_t mode, const char *read_dirs, const char *write_dirs) {
  (void)caps;
  (void)mode;
  (void)read_dirs;
  (void)write_dirs;
  nish_sb_none();
}

void nish_sandbox_check(void) { nish_sb_none(); }

#endif
