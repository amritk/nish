/* The `net_ring` section's wrapper for `batch.ts` (NURING-45): makes every
 * epoll wait answer EPERM, then runs argv[1]. A loop that holds only ring
 * slots sleeps on its ring, so its program never reaches one; a wait that
 * does fails the program. Exits 3 when the kernel takes no filter, and 4 when
 * its io_uring has no IORING_FEAT_EXT_ARG (before 5.11), where such a loop
 * still sleeps on epoll; the section counts both as skips. */
#define _GNU_SOURCE
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/io_uring.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>

#if defined(__x86_64__)
#define NATIVE_ARCH AUDIT_ARCH_X86_64
#elif defined(__aarch64__)
#define NATIVE_ARCH AUDIT_ARCH_AARCH64
#else
#error "noepoll.c knows the audit arch of x86_64 and aarch64 only"
#endif

#ifndef __NR_epoll_pwait2
#define __NR_epoll_pwait2 441
#endif
#ifndef __NR_epoll_wait
#define __NR_epoll_wait __NR_epoll_pwait
#endif

/* Does a ring made here offer IORING_FEAT_EXT_ARG? -1 when none is made. */
static int ext_arg(void) {
  struct io_uring_params p;
  memset(&p, 0, sizeof p);
  long fd = syscall(__NR_io_uring_setup, 2, &p);
  if (fd < 0) return -1;
  close((int)fd);
  return (p.features & (1u << 8)) != 0;
}

int main(int argc, char **argv) {
  if (argc < 2) return 2;
  if (ext_arg() == 0) {
    printf("this kernel's io_uring has no IORING_FEAT_EXT_ARG\n");
    return 4;
  }
  struct sock_filter f[] = {
      BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, NATIVE_ARCH, 1, 0),
      BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
      BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_epoll_wait, 3, 0),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_epoll_pwait, 2, 0),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_epoll_pwait2, 1, 0),
      BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
      BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | 1),
  };
  struct sock_fprog prog = {(unsigned short)(sizeof f / sizeof f[0]), f};
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 || prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &prog) != 0) {
    printf("seccomp filters are unavailable here\n");
    return 3;
  }
  execv(argv[1], argv + 1);
  perror("execv");
  return 2;
}
