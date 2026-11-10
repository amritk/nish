/* A waited descriptor stays registered with the executor
   (runtime/runtime-async.c; docs/security/async.md, ASYNC-4 and ASYNC-9).

   1. Steady state: a task waits for one end of a socket pair to be readable
      a thousand times, a byte written to the other end each turn. Each wait
      costs one kernel call (stat 4): the `epoll_ctl` that re-arms the
      registration on Linux; on Darwin the `fstat` that finds a regular file
      and the `kevent` that re-arms, two. No wait opens a descriptor.
   2. Two tasks reading one descriptor are both woken by one write.
   3. A reader and a writer on one descriptor: the writer is woken at once,
      and the reader, still parked, by the later write.
   4. A bounded wait that times out leaves the registration armed; bytes that
      arrive while nothing waits wake no task, and the next wait sees them.
   5. A bounded write wait on a full socket times out, and one made after
      the peer reads is woken.
   6. A wait whose task finished (an orphan) is answered late (stat 1) when
      its descriptor is ready, and does not resume the task that reuses its
      node. */
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/socket.h>
#include <unistd.h>

#include "../../../runtime/nish.h"

#if defined(__linux__)
#define CALLS_PER_WAIT 1
#else
#define CALLS_PER_WAIT 2
#endif

/* Resume the next task, poll `token` in it, and answer the task. */
static void *resume(uint64_t token, int *answer) {
  void *next = nish_async_next();
  void *prev = nish_async_enter(next);
  *answer = nish_async_poll(token);
  nish_async_leave(next, prev);
  return next;
}

static uint64_t wait_in(void *task, int fd, int dir, int ms) {
  void *prev = nish_async_enter(task);
  uint64_t token = nish_async_wait_fd_within(fd, dir, ms);
  nish_async_leave(task, prev);
  return token;
}

/* The lowest free descriptor number. */
static int lowest(void) {
  int fd = dup(0);
  close(fd);
  return fd;
}

int main(void) {
  int pair[2];
  if (socketpair(AF_UNIX, SOCK_STREAM, 0, pair) < 0) return 1;
  int a = pair[0], b = pair[1];
  char buf[64];
  int answer;

  /* 1. Steady state. */
  void *task = nish_async_spawn(0, 16);
  int free0 = -1;
  int calls0 = nish_async_stat(4);
  int woken = 0;
  int open_while_parked = 0;
  for (int i = 0; i < 1000; i++) {
    uint64_t w = wait_in(task, a, 0, -1);
    if (i == 0) free0 = lowest(); /* the first wait makes the event loop's own descriptor */
    else if (lowest() != free0) open_while_parked++;
    if (write(b, "x", 1) != 1) return 1;
    if (resume(w, &answer) == task && answer == 1) woken++;
    if (read(a, buf, 1) != 1) return 1;
  }
  int calls = nish_async_stat(4) - calls0;
  printf("woken: %d of 1000\n", woken);
  printf("kernel calls per wait: %s (%d)\n", calls == 1000 * CALLS_PER_WAIT ? "as budgeted" : "over", calls / 1000);
  printf("waits that held a descriptor open: %d\n", open_while_parked);

  /* 2. Two readers on one descriptor. */
  void *other = nish_async_spawn(0, 16);
  uint64_t r1 = wait_in(task, a, 0, -1);
  uint64_t r2 = wait_in(other, a, 0, -1);
  if (write(b, "y", 1) != 1) return 1;
  void *first = nish_async_next();
  void *second = nish_async_next();
  int a1 = nish_async_poll(r1), a2 = nish_async_poll(r2);
  printf("two readers woken by one write: %s\n", first == task && second == other && a1 == 1 && a2 == 1 ? "yes" : "no");
  if (read(a, buf, 1) != 1) return 1;

  /* 3. A reader and a writer. */
  uint64_t r = wait_in(task, a, 0, -1);
  uint64_t wr = wait_in(other, a, 1, -1);
  void *next = resume(wr, &answer);
  printf("the writer woken first: %s, the reader still parked: %d\n", next == other && answer == 1 ? "yes" : "no",
         nish_async_poll(r));
  if (write(b, "z", 1) != 1) return 1;
  next = resume(r, &answer);
  printf("the reader woken by the write: %s\n", next == task && answer == 1 ? "yes" : "no");
  if (read(a, buf, 1) != 1) return 1;

  /* 4. A bounded wait times out; bytes arrive while nothing waits. */
  r = wait_in(task, a, 0, 10);
  next = resume(r, &answer);
  printf("the bounded read times out: %d\n", answer);
  int late = nish_async_stat(1);
  if (write(b, "w", 1) != 1) return 1;
  void *prev = nish_async_enter(other);
  uint64_t nap = nish_async_sleep(10);
  nish_async_leave(other, prev);
  next = resume(nap, &answer);
  printf("bytes while nothing waits: woken by %s, dropped %d\n",
         next == other && answer == 1 ? "the timer" : "something else", nish_async_stat(1) - late);
  r = wait_in(task, a, 0, 10);
  next = resume(r, &answer);
  printf("the next wait sees them: %d\n", answer);
  if (read(a, buf, 1) != 1) return 1;

  /* 5. A bounded write wait on a full socket. */
  fcntl(a, F_SETFL, fcntl(a, F_GETFL) | O_NONBLOCK);
  long filled = 0;
  for (;;) {
    ssize_t n = write(a, buf, sizeof buf);
    if (n < 0) break;
    filled += n;
  }
  r = wait_in(task, a, 1, 10);
  next = resume(r, &answer);
  printf("the bounded write on a full socket times out: %d\n", answer);
  fcntl(b, F_SETFL, fcntl(b, F_GETFL) | O_NONBLOCK);
  while (read(b, buf, sizeof buf) > 0) {
  }
  r = wait_in(task, a, 1, 1000);
  next = resume(r, &answer);
  printf("after the peer reads, writable: %d\n", answer);

  /* 6. An orphan wait. */
  nish_async_done(other);
  r = wait_in(task, a, 0, -1);
  nish_async_done(task);
  late = nish_async_stat(1);
  void *reused = nish_async_spawn(0, 16);
  prev = nish_async_enter(reused);
  nap = nish_async_sleep(10);
  nish_async_leave(reused, prev);
  if (write(b, "v", 1) != 1) return 1;
  next = resume(nap, &answer);
  printf("an orphan wait: dropped %d, the reused node woken by its own timer: %s\n", nish_async_stat(1) - late,
         next == reused && answer == 1 ? "yes" : "no");
  nish_async_done(reused);
  printf("then nothing waits: %s\n", nish_async_next() == NULL ? "yes" : "no");
  close(a);
  close(b);
  return filled > 0 ? 0 : 1;
}
