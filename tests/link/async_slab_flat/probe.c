/* The executor's node slabs (runtime/runtime-async.c). Each spawned kind has
   a slab whose chunks double, 4 nodes and then 8, so it grows to the most
   tasks of that kind ever in flight and then reuses what it holds: a
   thousand rounds of ten tasks at a time allocate no node past the first
   round's 12. A second kind takes a slab of its own, sized for its frame. */
#include <stdint.h>
#include <stdio.h>

#include "../../../runtime/nish.h"

int main(void) {
  void *one = nish_async_spawn(0, 40);
  nish_async_done(one);
  for (int i = 0; i < 1000; i++) {
    void *t = nish_async_spawn(0, 40);
    if (t != one) {
      printf("round %d: a finished node was not reused\n", i);
      return 1;
    }
    nish_async_done(t);
  }
  printf("one at a time: %d nodes\n", nish_async_stat(0));

  void *live[10];
  int peak = 0;
  for (int round = 0; round < 1000; round++) {
    for (int i = 0; i < 10; i++) live[i] = nish_async_spawn(0, 40);
    if (nish_async_stat(2) > peak) peak = nish_async_stat(2);
    for (int i = 0; i < 10; i++) nish_async_done(live[i]);
    if (round == 0) printf("after the first round of ten: %d nodes\n", nish_async_stat(0));
  }
  printf("after a thousand rounds: %d nodes, peak %d live, %d live now\n", nish_async_stat(0), peak,
         nish_async_stat(2));

  void *other = nish_async_spawn(1, 4000);
  printf("a second kind: %d nodes\n", nish_async_stat(0));
  nish_async_done(other);
  return 0;
}
