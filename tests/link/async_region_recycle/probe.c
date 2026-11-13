/* A finished task's region is emptied, not freed, and the node's next task
   gets it (runtime/runtime-async.c, `nish_region_recycle` in
   runtime/runtime-region.c). The region keeps its newest chunk while that is
   small, so the next task bumps where the last one did, and gives back every
   other chunk, so a task that once allocated a lot leaves nothing behind on
   its node. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "../../../runtime/nish.h"

static char big[1 << 20];

/* runtime.c's chunk header: the next older chunk first. */
typedef struct link { struct link *next; uint64_t cap; } link;

static uint64_t chunks(void) {
  uint64_t n = 0;
  for (link *c = nish_arena.chunks; c; c = c->next) n++;
  return n;
}

/* Runs one task on a fresh spawn of kind 0: it makes `count` strings of
   `len` bytes. Answers the chunks the region held when the task started. */
static uint64_t task(int count, uint64_t len, void **node, char **first) {
  void *t = nish_async_spawn(0, 16);
  *node = t;
  void *prev = nish_async_enter(t);
  uint64_t held = chunks();
  *first = nish_arena.buf;
  memset(big, 'x', len);
  for (int i = 0; i < count; i++) nish_str_new(big, len);
  nish_async_leave(t, prev);
  nish_async_done(t);
  return held;
}

int main(void) {
  void *a, *b;
  char *buf_a, *buf_b;
  uint64_t held = task(40, 100, &a, &buf_a);
  printf("a first task starts with no chunk: %s\n", held == 0 ? "yes" : "no");

  held = task(1, 100, &b, &buf_b);
  printf("the node is reused: %s\n", a == b ? "yes" : "no");
  printf("its next task starts with one chunk, emptied: %s\n", held == 1 ? "yes" : "no");

  /* Steady state: the same small task, over and over, starts in the one
     chunk the region kept, at the same address, and never asks malloc for
     another. */
  char *was = 0;
  int same = 1;
  for (int i = 0; i < 1000; i++) {
    char *buf;
    if (task(4, 100, &a, &buf) != 1 || (i > 0 && buf != was)) same = 0;
    was = buf;
  }
  printf("a thousand small tasks share one chunk: %s\n", same ? "yes" : "no");

  /* A task that allocates far more than the region keeps: its chunks are
     given back, and the next task starts empty. */
  task(1, sizeof big, &a, &buf_a);
  held = task(1, 8, &a, &buf_a);
  printf("after a 1 MiB task, the next starts with no chunk: %s\n", held == 0 ? "yes" : "no");
  printf("live: %d, nodes: %d\n", nish_async_stat(2), nish_async_stat(0));
  return 0;
}
