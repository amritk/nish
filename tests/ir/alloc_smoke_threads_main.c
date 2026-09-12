/* WP20 T0: the same `alloc_smoke` IR as alloc_smoke_main.c, on two threads.
 *
 * The point is not that the bump still works — alloc_smoke_main.c proves that —
 * but that the bump each thread does is its own. With `--threads` the compiled
 * module reaches `@nish_arena` through the thread pointer and runtime.c gives
 * every thread its own, so the worker's two allocations leave the parent's
 * arena exactly where it was. One shared arena would put the parent at 64. */
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>

int64_t alloc_smoke(void);      /* two 12-byte bumps; answers their distance */
uint64_t nish_arena_used(void); /* bytes bumped in the calling thread's chunk */

static int64_t worker_delta;
static uint64_t worker_used;

static void *worker(void *unused) {
  (void)unused;
  worker_delta = alloc_smoke();
  worker_used = nish_arena_used();
  return NULL;
}

int main(void) {
  pthread_t t;
  if (pthread_create(&t, NULL, worker, NULL) != 0) return 2;
  if (pthread_join(t, NULL) != 0) return 2;
  int64_t delta = alloc_smoke();
  uint64_t used = nish_arena_used();
  printf("worker: delta=%lld used=%llu; main: delta=%lld used=%llu\n", (long long)worker_delta,
         (unsigned long long)worker_used, (long long)delta, (unsigned long long)used);
  return worker_delta == 16 && worker_used == 32 && delta == 16 && used == 32 ? 0 : 1;
}
