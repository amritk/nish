/* A node keeps its region from one task to the next (runtime/runtime-async.c,
   "Regions"; docs/security/async.md, ASYNC-20): `nish_async_done` recycles
   the region instead of freeing it, so the next task on the node starts in
   an empty arena that already holds the last one's newest chunk. What is
   kept is bounded twice: a chunk past 64 KiB is freed, and once the free
   nodes keep 16 MiB between them a finishing task keeps none. The probe
   reads `nish_arena` as each task is entered, which is where the kept chunk
   shows, and the process's peak resident size, which is what a leak would
   move. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/resource.h>

#include "../../../runtime/nish.h"

#define KEEP ((uint64_t)1 << 16)
#define KEEP_TOTAL ((uint64_t)1 << 24)
#define MANY 600

static char big[1 << 20];
static void *many[MANY];

/* Peak resident size in KiB (Linux) or bytes (macOS): only its movement is read. */
static long peak(void) {
  struct rusage u;
  getrusage(RUSAGE_SELF, &u);
  return u.ru_maxrss;
}

/* Run one task that allocates `n` bytes and ends; answers the arena it was entered with. */
static struct nish_arena task(uint64_t n) {
  void *t = nish_async_spawn(0, 16);
  void *prev = nish_async_enter(t);
  struct nish_arena at = nish_arena;
  memset(big, 'x', n);
  nish_str_new(big, n);
  nish_async_leave(t, prev);
  nish_async_done(t);
  return at;
}

/* Spawn MANY tasks at once, 60000 bytes each, and end them all; answers the
   bytes the nodes' regions held as the tasks were entered. */
static uint64_t burst(int *kept_nodes) {
  uint64_t held = 0;
  *kept_nodes = 0;
  for (int i = 0; i < MANY; i++) many[i] = nish_async_spawn(0, 16);
  for (int i = 0; i < MANY; i++) {
    void *prev = nish_async_enter(many[i]);
    held += nish_arena.cap;
    if (nish_arena.cap) (*kept_nodes)++;
    memset(big, 'y', 60000);
    nish_str_new(big, 60000);
    nish_async_leave(many[i], prev);
  }
  for (int i = 0; i < MANY; i++) nish_async_done(many[i]);
  return held;
}

int main(void) {
  struct nish_arena first = task(4000);
  printf("a node's first task starts with no chunk: %s\n", first.buf == NULL && first.cap == 0 ? "yes" : "no");

  struct nish_arena second = task(4000);
  int reused = 0, empty = 0;
  long settled = 0;
  for (int i = 0; i < 100000; i++) {
    struct nish_arena at = task(4000);
    if (at.buf == second.buf && at.buf != NULL) reused++;
    if (at.off == 0) empty++;
    if (i == 100) settled = peak();
  }
  long grew = peak() - settled;
  printf("of 100000 later tasks, entered with the kept chunk: %d, entered empty: %d\n", reused, empty);
  printf("peak resident size moved after round 100: %s\n", grew == 0 ? "no" : "yes");
  printf("nodes: %d\n", nish_async_stat(0));

  task(sizeof big);
  struct nish_arena after_big = task(4000);
  printf("a chunk past 64 KiB is not kept: %s\n", after_big.buf == NULL && after_big.cap == 0 ? "yes" : "no");
  struct nish_arena after_small = task(4000);
  printf("a small task after it keeps its chunk again: %s\n", after_small.cap >= 4000 && after_small.cap <= KEEP ? "yes" : "no");

  int kept_nodes = 0;
  burst(&kept_nodes);
  uint64_t held = burst(&kept_nodes);
  printf("%d tasks of 60000 bytes at once, then again: fewer than all kept a chunk: %s\n", MANY,
         kept_nodes > 0 && kept_nodes < MANY ? "yes" : "no");
  printf("what they kept is 16 MiB to 16 MiB and one chunk: %s\n",
         held >= KEEP_TOTAL && held <= KEEP_TOTAL + KEEP ? "yes" : "no");
  int again_nodes = 0;
  uint64_t again = burst(&again_nodes);
  printf("a third burst found the same kept: %s\n", again == held && again_nodes == kept_nodes ? "yes" : "no");
  printf("live: %d\n", nish_async_stat(2));
  return 0;
}
