// LD_PRELOAD interposer: counts syscall(SYS_futex, ...) by op and sched_yield calls, prints at exit.
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdarg.h>
#include <stdio.h>
#include <sys/syscall.h>
#include <linux/futex.h>
static long waits, wakes, yields;
static long (*real_syscall)(long, ...);
static int (*real_yield)(void);
long syscall(long n, ...) {
  va_list ap; va_start(ap, n);
  long a[6]; for (int i = 0; i < 6; i++) a[i] = va_arg(ap, long);
  va_end(ap);
  if (!real_syscall) real_syscall = dlsym(RTLD_NEXT, "syscall");
  if (n == SYS_futex) {
    if ((a[1] & 127) == FUTEX_WAIT) __atomic_add_fetch(&waits, 1, __ATOMIC_RELAXED);
    if ((a[1] & 127) == FUTEX_WAKE) __atomic_add_fetch(&wakes, 1, __ATOMIC_RELAXED);
  }
  return real_syscall(n, a[0], a[1], a[2], a[3], a[4], a[5]);
}
int sched_yield(void) {
  if (!real_yield) real_yield = dlsym(RTLD_NEXT, "sched_yield");
  __atomic_add_fetch(&yields, 1, __ATOMIC_RELAXED);
  return real_yield();
}
__attribute__((destructor)) static void report(void) {
  fprintf(stderr, "futex_wait=%ld futex_wake=%ld sched_yield=%ld\n", waits, wakes, yields);
}
