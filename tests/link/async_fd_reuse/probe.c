/* A descriptor closed and reused while a task waits on it
   (runtime/runtime-async.c; docs/security/async.md, ASYNC-4). A wait
   registers a duplicate of the descriptor, so the registration keeps naming
   the file the task waited on, whatever the number is reused for.

   The task waits for `a`, one end of a socket pair, to be readable, and the
   program closes `a` and opens a pipe that takes its number. Bytes written
   into the pipe must not wake the task: a 20 ms timer resumes it instead, its
   wait still pending. Bytes written to the pair's other end, `b`, do. */
#include <stdint.h>
#include <stdio.h>
#include <sys/socket.h>
#include <unistd.h>

#include "../../../runtime/nish.h"

int main(void) {
  int pair[2];
  if (socketpair(AF_UNIX, SOCK_STREAM, 0, pair) < 0) return 1;
  int a = pair[0], b = pair[1];

  void *task = nish_async_spawn(0, 16);
  void *prev = nish_async_enter(task);
  uint64_t wait = nish_async_wait_fd(a, 0);
  uint64_t timer = nish_async_sleep(20);
  nish_async_leave(task, prev);

  close(a);
  int pipe_fds[2];
  if (pipe(pipe_fds) < 0) return 1;
  int reused = pipe_fds[0] == a ? pipe_fds[0] : pipe_fds[1] == a ? pipe_fds[1] : -1;
  if (reused < 0 && dup2(pipe_fds[0], a) == a) reused = a;
  printf("the number is reused: %s\n", reused == a ? "yes" : "no");
  if (write(pipe_fds[1], "x", 1) != 1) return 1;

  void *next = nish_async_next();
  prev = nish_async_enter(next);
  printf("woken by: %s\n", nish_async_poll(timer) == 1 ? "the timer" : "something else");
  printf("the wait: %d\n", nish_async_poll(wait));
  nish_async_leave(next, prev);

  if (write(b, "y", 1) != 1) return 1;
  next = nish_async_next();
  prev = nish_async_enter(next);
  printf("after a write to the pair: %d\n", nish_async_poll(wait));
  nish_async_leave(next, prev);
  nish_async_done(next);
  printf("then nothing waits: %s\n", nish_async_next() == NULL ? "yes" : "no");
  return 0;
}
