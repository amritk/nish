/* A descriptor closed and reused while a task waits on it
   (runtime/runtime-async.c; docs/security/async.md, ASYNC-4). The executor
   registers the program's own descriptor and keeps the registration, so the
   next wait on a reused number must find the number naming another file:
   the waits still parked on the old file fail, and an event the old file's
   registration still delivers wakes nothing.

   1. A task waits for `a`, one end of a socket pair, to be readable, and the
      program closes `a` and opens a pipe that takes its number. Bytes written
      into the pipe must not wake the task: a 20 ms timer resumes it instead,
      its wait still pending. A new wait on the number then fails the old one,
      and sees the pipe.
   2. The same, with the old file kept open by a second descriptor, so its
      registration outlives the close: after the new wait, bytes for the old
      file are dropped (stat 1) and wake neither task, and bytes for the pipe
      wake the new wait. */
#include <stdint.h>
#include <stdio.h>
#include <sys/socket.h>
#include <unistd.h>

#include "../../../runtime/nish.h"

/* Close `a` and give its number a fresh pipe; answers the pipe's write end. */
static int reuse(int a) {
  close(a);
  int pipe_fds[2];
  if (pipe(pipe_fds) < 0) return -1;
  if (pipe_fds[0] != a) {
    if (dup2(pipe_fds[0], a) != a) return -1;
    close(pipe_fds[0]);
  }
  return pipe_fds[1];
}

int main(void) {
  int pair[2];
  if (socketpair(AF_UNIX, SOCK_STREAM, 0, pair) < 0) return 1;
  int a = pair[0], b = pair[1];

  void *task = nish_async_spawn(0, 16);
  void *prev = nish_async_enter(task);
  uint64_t wait = nish_async_wait_fd(a, 0);
  uint64_t timer = nish_async_sleep(20);
  nish_async_leave(task, prev);

  int in = reuse(a);
  printf("the number is reused: %s\n", in >= 0 ? "yes" : "no");
  if (write(in, "x", 1) != 1) return 1;

  void *next = nish_async_next();
  prev = nish_async_enter(next);
  printf("woken by: %s\n", nish_async_poll(timer) == 1 ? "the timer" : "something else");
  printf("the wait: %d\n", nish_async_poll(wait));
  uint64_t fresh = nish_async_wait_fd(a, 0);
  printf("a new wait on the number fails the old one: %d\n", nish_async_poll(wait));
  nish_async_leave(next, prev);
  /* The failed wait queued the task once more; the pipe's byte wakes it next. */
  printf("queued by the failed wait: %s\n", nish_async_next() == task ? "yes" : "no");
  next = nish_async_next();
  prev = nish_async_enter(next);
  printf("the new wait sees the pipe: %d\n", nish_async_poll(fresh));
  nish_async_leave(next, prev);
  nish_async_done(next);
  printf("then nothing waits: %s\n", nish_async_next() == NULL ? "yes" : "no");
  close(a);
  close(in);
  close(b);

  /* 2. The old file outlives the close. */
  if (socketpair(AF_UNIX, SOCK_STREAM, 0, pair) < 0) return 1;
  a = pair[0], b = pair[1];
  task = nish_async_spawn(0, 16);
  prev = nish_async_enter(task);
  wait = nish_async_wait_fd(a, 0);
  nish_async_leave(task, prev);
  int keep = dup(a);
  in = reuse(a);
  void *other = nish_async_spawn(0, 16);
  prev = nish_async_enter(other);
  fresh = nish_async_wait_fd(a, 0);
  timer = nish_async_sleep(20);
  nish_async_leave(other, prev);
  int late = nish_async_stat(1);
  if (write(b, "y", 1) != 1) return 1;
  next = nish_async_next();
  printf("the old wait failed: %s\n", next == task && nish_async_poll(wait) == 0 ? "yes" : "no");
  nish_async_done(next);
  next = nish_async_next();
  prev = nish_async_enter(next);
  printf("bytes for the old file: woken by %s, the new wait %d, dropped %d\n",
         nish_async_poll(timer) == 1 ? "the timer" : "something else", nish_async_poll(fresh),
         nish_async_stat(1) - late);
  nish_async_leave(next, prev);
  if (write(in, "z", 1) != 1) return 1;
  next = nish_async_next();
  prev = nish_async_enter(next);
  printf("bytes for the pipe: %d\n", nish_async_poll(fresh));
  nish_async_leave(next, prev);
  nish_async_done(next);
  printf("then nothing waits: %s\n", nish_async_next() == NULL ? "yes" : "no");
  close(keep);
  return 0;
}
