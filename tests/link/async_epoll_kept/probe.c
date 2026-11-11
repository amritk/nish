/* A wait on an epoll descriptor keeps its duplicate registered
   (runtime/runtime-async.c; docs/security/async.md, ASYNC-4).

   A task waits on `inner`, an epoll set watching an eventfd, three times.
   After the first wait fires the duplicate stays open, and the second wait
   re-arms it rather than duplicating `inner` again. Then `inner` is closed and
   a new epoll set takes its number: the kept duplicate still names the old
   set, so a wait on the new one must register afresh, and the old set's
   eventfd must not wake it. Last, a wait that is cancelled closes the kept
   duplicate. */
#include <dirent.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/epoll.h>
#include <sys/eventfd.h>
#include <unistd.h>

#include "../../../runtime/nish.h"

static int open_fds(void) {
  DIR *d = opendir("/proc/self/fd");
  if (d == NULL) return -1;
  int n = 0;
  while (readdir(d) != NULL) n++;
  closedir(d);
  return n;
}

static int poller(int ev) {
  int ep = epoll_create1(EPOLL_CLOEXEC);
  struct epoll_event e = {.events = EPOLLIN, .data = {.u64 = 0}};
  if (ep < 0 || epoll_ctl(ep, EPOLL_CTL_ADD, ev, &e) < 0) return -1;
  return ep;
}

static void ring(int ev) {
  uint64_t one = 1;
  if (write(ev, &one, sizeof one) != sizeof one) perror("write");
}

static void hush(int ev) {
  uint64_t got;
  if (read(ev, &got, sizeof got) != sizeof got) perror("read");
}

int main(void) {
  int ev1 = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
  int inner = poller(ev1);
  if (ev1 < 0 || inner < 0) return 1;

  void *task = nish_async_spawn(0, 16);
  void *prev = nish_async_enter(task);
  int64_t id = nish_async_task_id();
  uint64_t wait = nish_async_wait_fd(inner, 0);
  nish_async_leave(task, prev);
  int registered = open_fds();

  ring(ev1);
  void *next = nish_async_next();
  prev = nish_async_enter(next);
  printf("the first wait: %d\n", nish_async_poll(wait));
  printf("its duplicate stays open: %s\n", open_fds() == registered ? "yes" : "no");
  hush(ev1);
  wait = nish_async_wait_fd(inner, 0);
  printf("a second wait duplicates nothing: %s\n", open_fds() == registered ? "yes" : "no");
  nish_async_leave(next, prev);

  ring(ev1);
  next = nish_async_next();
  prev = nish_async_enter(next);
  printf("the second wait: %d\n", nish_async_poll(wait));
  hush(ev1);
  nish_async_leave(next, prev);

  close(inner);
  int ev2 = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
  int fresh = poller(ev2);
  int number = fresh;
  if (fresh != inner) {
    if (dup2(fresh, inner) != inner) return 1;
    close(fresh);
    number = inner;
  }
  printf("the number is reused: %s\n", number == inner ? "yes" : "no");
  prev = nish_async_enter(next);
  wait = nish_async_wait_fd(number, 0);
  uint64_t timer = nish_async_sleep(20);
  nish_async_leave(next, prev);
  ring(ev1);

  next = nish_async_next();
  prev = nish_async_enter(next);
  printf("woken by: %s\n", nish_async_poll(timer) == 1 ? "the timer" : "something else");
  printf("the wait on the new set: %d\n", nish_async_poll(wait));
  nish_async_leave(next, prev);

  ring(ev2);
  next = nish_async_next();
  prev = nish_async_enter(next);
  printf("after the new set's eventfd: %d\n", nish_async_poll(wait));
  hush(ev2);
  wait = nish_async_wait_fd(number, 0);
  nish_async_leave(next, prev);
  int kept = open_fds();

  nish_async_cancel(id);
  next = nish_async_next();
  prev = nish_async_enter(next);
  printf("a cancelled wait: %d\n", nish_async_poll(wait));
  nish_async_leave(next, prev);
  printf("its duplicate is closed: %s\n", open_fds() == kept - 1 ? "yes" : "no");
  nish_async_done(next);
  printf("then nothing waits: %s\n", nish_async_next() == NULL ? "yes" : "no");
  return 0;
}
