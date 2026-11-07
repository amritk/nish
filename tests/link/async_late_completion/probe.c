/* The executor's late completions, driven through its C entry points as the
   compiled driver would (runtime/runtime-async.c; docs/security/async.md,
   AS-1). Every wait records the (index, generation) of the task that made it,
   and a completion whose task has finished since is dropped and counted, not
   delivered to whatever task holds the node by then.

   `orphan` makes a 10 ms timer and finishes without polling it, as a task
   that a later stage cancels would. The next spawn of the same kind reuses
   the node a generation on and makes a 30 ms timer of its own. When the
   orphan's timer fires, the loop must not resume the node's new task; the
   new task resumes once, at its own deadline, and reads its own answer. A
   token that names a freed wait answers 0, never another wait's answer. */
#include <stdint.h>
#include <stdio.h>

#include "../../../runtime/nish.h"

int main(void) {
  void *orphan = nish_async_spawn(0, 16);
  void *prev = nish_async_enter(orphan);
  uint64_t lost = nish_async_sleep(10);
  nish_async_leave(orphan, prev);
  nish_async_done(orphan);

  void *task = nish_async_spawn(0, 16);
  printf("node reused: %s\n", task == orphan ? "yes" : "no");
  prev = nish_async_enter(task);
  uint64_t mine = nish_async_sleep(30);
  printf("pending: %d\n", nish_async_poll(mine));
  nish_async_leave(task, prev);

  int resumed = 0;
  for (void *next; (next = nish_async_next()) != NULL;) {
    resumed++;
    printf("resumed the new task: %s, late so far: %d\n", next == task ? "yes" : "no", nish_async_stat(1));
    prev = nish_async_enter(next);
    printf("its own answer: %d\n", nish_async_poll(mine));
    nish_async_leave(next, prev);
    nish_async_done(next);
  }
  printf("resumes: %d, late: %d\n", resumed, nish_async_stat(1));
  printf("the orphan's token: %d, a spent token: %d\n", nish_async_poll(lost), nish_async_poll(mine));
  printf("live tasks: %d\n", nish_async_stat(2));
  return 0;
}
