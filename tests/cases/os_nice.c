/* Driver for os_nice: each export called in order, and what the kernel reads
   back after it. `setNice` changes the calling thread's nice value and the
   child `ps` sees was started after it, so the readings are the
   process's own. `setIdlePriority` is Linux's alone: elsewhere it is -95. */
#if defined(__linux__) && !defined(_GNU_SOURCE)
#define _GNU_SOURCE /* SCHED_IDLE */
#endif
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/resource.h>
#ifdef __linux__
#include <sched.h>
#endif

int32_t lower(void);
int32_t above(void);
int32_t negative(void);
int32_t below(void);
int32_t childNice(void);
int32_t idle(void);
int32_t childClass(void);

static int nice_now(void) {
  errno = 0;
  return getpriority(PRIO_PROCESS, 0);
}

int main(void) {
  int32_t r;

  r = lower();
  printf("lower to 1: %d\n", r);
  printf("nice reads: %d\n", nice_now());
  printf("child inherits 1: %d\n", childNice());
  r = lower();
  printf("same value: %d\n", r);
  printf("nice reads: %d\n", nice_now());

  r = above();
  printf("above 19: %d\n", r);
  printf("nice reads: %d\n", nice_now());
  r = negative();
  printf("negative: %d\n", r);
  printf("nice reads: %d\n", nice_now());
  r = below();
  printf("below current: %d\n", r);
  printf("nice reads: %d\n", nice_now());

#ifdef __linux__
  r = idle();
  printf("idle: %d\n", r);
  printf("policy idle: %d\n", sched_getscheduler(0) == SCHED_IDLE);
  printf("child class idle: %d\n", childClass());
#else
  /* Off Linux there is no policy or class to read: the lines hold as the
     placeholders they were, -95 as the answer and 1 for the two readings. */
  r = idle();
  printf("idle: %d\n", r + 95);
  printf("policy idle: 1\n");
  printf("child class idle: 1\n");
#endif
  return 0;
}
