/* Cancellation in the executor (runtime/runtime-async.c) leaks neither a task
   nor a timer: after each path below the live task count (stat 2) and the
   timer count (stat 3) are back where they started. A cancel fails every wait
   the task has pending and every one it makes later; a deadline armed with
   `cancel_after` cancels the task when it fires and is taken out when the task
   finishes first; a bounded descriptor wait fails when its time is up. A
   handle of a finished task, a stale one and `main`'s (0) are refused, and a
   task that finishes while still queued is taken off the queue. A cancel
   closes the descriptor a wait duplicated, and a handle whose node was
   reused is refused without touching the new task. */
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <unistd.h>

#include "../../../runtime/nish.h"

int64_t nish_async_task_id(void);
int32_t nish_async_cancel(int64_t handle);
int32_t nish_async_cancelled(void);
int32_t nish_async_cancel_after(int64_t handle, int32_t ms);
uint64_t nish_async_wait_fd_within(int32_t fd, int32_t dir, int32_t ms);

static int live0, timers0;

static const char *flat(void) {
  return nish_async_stat(2) == live0 && nish_async_stat(3) == timers0 ? "yes" : "no";
}

/* Spawn a task and answer its handle. */
static void *spawn(int64_t *handle) {
  void *t = nish_async_spawn(0, 16);
  void *prev = nish_async_enter(t);
  *handle = nish_async_task_id();
  nish_async_leave(t, prev);
  return t;
}

/* Drain the ready queue until nothing is ready or waits. */
static int drain(void) {
  int n = 0;
  while (nish_async_next()) n++;
  return n;
}

int main(void) {
  live0 = nish_async_stat(2);
  timers0 = nish_async_stat(3);

  /* 1. A cancel with two sleeps pending fails both at once. */
  int64_t h;
  void *t = spawn(&h);
  void *prev = nish_async_enter(t);
  uint64_t s1 = nish_async_sleep(60000);
  uint64_t s2 = nish_async_sleep(60000);
  nish_async_leave(t, prev);
  printf("pending: %d %d, timers %d\n", nish_async_poll(s1), nish_async_poll(s2), nish_async_stat(3) - timers0);
  printf("cancel a running task: %d, again: %d\n", nish_async_cancel(h), nish_async_cancel(h));
  printf("after the cancel: %d %d\n", nish_async_poll(s1), nish_async_poll(s2));
  prev = nish_async_enter(t);
  uint64_t s3 = nish_async_sleep(60000);
  int later = nish_async_poll(s3);
  int seen = nish_async_cancelled();
  nish_async_leave(t, prev);
  printf("a later sleep: %d, cancelled: %d\n", later, seen);
  drain();
  nish_async_done(t);
  printf("flat after a cancel: %s\n", flat());
  printf("cancel a finished task: %d, its deadline: %d\n", nish_async_cancel(h), nish_async_cancel_after(h, 10));
  printf("cancel main: %d, a stale handle: %d\n", nish_async_cancel(0), nish_async_cancel((int64_t)0x7fffffff00000005));

  /* 2. A deadline fires and fails the sleep the task waits on. */
  t = spawn(&h);
  printf("arm a deadline: %d\n", nish_async_cancel_after(h, 20));
  prev = nish_async_enter(t);
  s1 = nish_async_sleep(60000);
  nish_async_leave(t, prev);
  void *ran = nish_async_next();
  printf("the deadline resumes the task: %s, its sleep answers %d\n", ran == t ? "yes" : "no", nish_async_poll(s1));
  nish_async_done(t);
  printf("flat after a deadline: %s\n", flat());

  /* 3. A bounded wait on a pipe nobody writes times out. */
  int fds[2];
  if (pipe(fds) != 0) return 2;
  t = spawn(&h);
  prev = nish_async_enter(t);
  uint64_t w = nish_async_wait_fd_within(fds[0], 0, 20);
  nish_async_leave(t, prev);
  ran = nish_async_next();
  printf("the bounded wait times out: %s, answers %d\n", ran == t ? "yes" : "no", nish_async_poll(w));
  nish_async_done(t);
  printf("flat after a timeout: %s\n", flat());

  /* 4. A cancel takes out a descriptor wait, its deadline and the task's. */
  t = spawn(&h);
  nish_async_cancel_after(h, 60000);
  prev = nish_async_enter(t);
  w = nish_async_wait_fd_within(fds[0], 0, 60000);
  nish_async_leave(t, prev);
  printf("cancel a waiting reader: %d, it answers %d\n", nish_async_cancel(h), nish_async_poll(w));
  drain();
  nish_async_done(t);
  printf("flat after cancelling a reader: %s\n", flat());

  /* 5. A task that finishes before its deadline takes the deadline out. */
  t = spawn(&h);
  nish_async_cancel_after(h, 60000);
  printf("an armed deadline is a timer: %d\n", nish_async_stat(3) - timers0);
  nish_async_done(t);
  printf("flat after done: %s, nothing left to run: %s\n", flat(), nish_async_next() ? "no" : "yes");

  /* 6. A task that cancels itself with a wait pending is queued by that wait
     and may finish still queued (an awaitAll call): finishing takes it off
     the ready queue, which then holds no node on the free list. */
  t = spawn(&h);
  prev = nish_async_enter(t);
  s1 = nish_async_sleep(60000);
  int self = nish_async_cancel(h);
  int answer = nish_async_poll(s1);
  nish_async_leave(t, prev);
  nish_async_done(t);
  printf("a self-cancel: %d, answers %d, finished queued: flat %s, nothing left to run: %s\n", self, answer, flat(),
         nish_async_next() ? "no" : "yes");
  /* 7. A cancel closes the duplicate a descriptor wait registered, and a
     write that comes after it wakes no task. The duplicate takes the lowest
     free descriptor, so that number is free again once the wait is gone. */
  int lowest = dup(fds[0]);
  close(lowest);
  t = spawn(&h);
  prev = nish_async_enter(t);
  w = nish_async_wait_fd_within(fds[0], 0, -1);
  nish_async_leave(t, prev);
  int held = fcntl(lowest, F_GETFD) != -1;
  printf("cancel a pipe reader: %d, it answers %d\n", nish_async_cancel(h), nish_async_poll(w));
  int closed = fcntl(lowest, F_GETFD) == -1 && errno == EBADF;
  drain();
  nish_async_done(t);
  if (write(fds[1], "x", 1) != 1) return 3;
  printf("the duplicate: held %d, closed after the cancel %d; a later write wakes a task: %s; flat %s\n", held,
         closed, nish_async_next() ? "yes" : "no", flat());

  /* 8. A handle whose task finished and whose node was reused for a new task
     is stale: it names the same node with an older generation, and a cancel
     with it leaves the new task alone. */
  int64_t old;
  t = spawn(&old);
  nish_async_done(t);
  t = spawn(&h);
  printf("the node reused: %s, a new generation: %s\n", (uint32_t)old == (uint32_t)h ? "yes" : "no",
         old != h ? "yes" : "no");
  printf("cancel with the stale handle: %d, the new task cancelled: %d\n", nish_async_cancel(old),
         nish_async_cancel(h));
  drain();
  nish_async_done(t);
  printf("flat after a stale cancel: %s\n", flat());
  printf("main's handle: %lld\n", (long long)nish_async_task_id());
  close(fds[0]);
  close(fds[1]);
  return 0;
}
