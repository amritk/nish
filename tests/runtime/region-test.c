/* The region half of the runtime (runtime/runtime-region.c), driven from C:
 * `node tests/run.js region` links it with the rest of the runtime, in the
 * default build and with -DNISH_THREADS, and runs it once per mode.
 *
 * With no argument it runs the positive checks and exits 0: a region's
 * allocations land in it and not in the thread's arena, its chunks start at
 * the first allocation's size and double, `enter` answers the root `leave`
 * recorded, nesting restores each arena, a freed slot is reused under a new
 * handle, and making, filling and freeing 100,000 regions ten times over
 * leaves the resident set where the first round put it.
 *
 * With a mode it does one thing the runtime must refuse and should not
 * return: each mode is expected to exit 1 with its panic on stderr, which the
 * suite checks. */

#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "../../runtime/nish.h"

#ifdef __APPLE__
#include <mach/mach.h>
#endif

static int failures;
#define CHECK(cond, ...)                         \
  do {                                           \
    if (!(cond)) {                               \
      failures++;                                \
      fprintf(stderr, "FAIL %s:%d: ", __FILE__, __LINE__); \
      fprintf(stderr, __VA_ARGS__);              \
      fputc('\n', stderr);                       \
    }                                            \
  } while (0)

/* The process's resident set now, in bytes. */
static uint64_t resident(void) {
#ifdef __APPLE__
  struct mach_task_basic_info info;
  mach_msg_type_number_t n = MACH_TASK_BASIC_INFO_COUNT;
  if (task_info(mach_task_self(), MACH_TASK_BASIC_INFO, (task_info_t)&info, &n) != KERN_SUCCESS) return 0;
  return info.resident_size;
#else
  FILE *f = fopen("/proc/self/statm", "r");
  unsigned long size = 0, pages = 0;
  if (!f) return 0;
  if (fscanf(f, "%lu %lu", &size, &pages) != 2) pages = 0;
  fclose(f);
  return (uint64_t)pages * (uint64_t)sysconf(_SC_PAGESIZE);
#endif
}

/* One session of docs/wp46-long-running-memory.md section 1's cache: a 72-byte
   root, then a payload whose length the root's maker did not know. */
static void *fill(uint64_t r, uint64_t payload) {
  void *root = nish_region_enter(r);
  if (!root) {
    root = nish_alloc_struct(72);
    memset(root, 1, 72);
  }
  memset(nish_alloc_struct(payload), 2, payload);
  nish_region_leave(r, root);
  return root;
}

#define REGIONS 100000
#define ROUNDS 10

static void positive(void) {
  /* The thread's own arena, with a chunk in it, and what it looked like. */
  nish_alloc_struct(16);
  struct nish_arena before = nish_arena;
  CHECK(before.cap == 65536, "the thread's first chunk is 64 KiB, got %llu", (unsigned long long)before.cap);

  uint64_t r = nish_region_new();
  CHECK(r != 0, "a handle is never 0");
  CHECK(nish_region_enter(r) == NULL, "a new region's root is null");
  CHECK(nish_arena.buf == NULL && nish_arena.chunks == NULL, "a new region's arena is empty");
  char *root = nish_alloc_struct(72);
  CHECK(nish_arena.cap == 72, "the first chunk is the first allocation's size, got %llu", (unsigned long long)nish_arena.cap);
  nish_alloc_struct(8);
  CHECK(nish_arena.cap == 144, "the second chunk doubles the first, got %llu", (unsigned long long)nish_arena.cap);
  nish_alloc_struct(1000);
  CHECK(nish_arena.cap == 1000, "a chunk takes the allocation's size when that is more, got %llu", (unsigned long long)nish_arena.cap);
  nish_alloc_struct(8);
  CHECK(nish_arena.cap == 2000, "and the next doubles that, got %llu", (unsigned long long)nish_arena.cap);
  CHECK(nish_arena_used() == 8, "the bump is the region's own");

  /* Nested: a second region inside the first puts the first back on leave. */
  uint64_t inner = nish_region_new();
  CHECK(inner != r, "two live regions have two handles");
  nish_region_enter(inner);
  nish_alloc_struct(24);
  CHECK(nish_arena.cap == 24, "the inner region has a chunk size of its own");
  nish_region_leave(inner, NULL);
  CHECK(nish_arena.cap == 2000 && nish_arena_used() == 8, "leaving the inner region restores the outer one");
  nish_region_leave(r, root);

  CHECK(memcmp(&before, &nish_arena, sizeof before) == 0, "leaving restores the thread's arena exactly");
  nish_alloc_struct(70000);
  CHECK(nish_arena.cap == 70000, "the thread's own arena keeps its 64 KiB floor, not a region's doubling");
  nish_alloc_struct(8);
  CHECK(nish_arena.cap == 65536, "and its next chunk is 64 KiB again, got %llu", (unsigned long long)nish_arena.cap);

  CHECK(nish_region_enter(r) == root, "enter answers the root leave recorded");
  nish_region_leave(r, root);

  nish_region_free(inner);
  nish_region_free(r);
  uint64_t again = nish_region_new();
  CHECK(again != r && again != inner, "a reused slot gets a new generation");
  CHECK(((again ^ r) & 0xffffff) == 0 || ((again ^ inner) & 0xffffff) == 0, "a freed slot is reused");
  nish_region_free(again);

  /* A hundred thousand sessions, made, filled and freed, ten times. */
  static uint64_t handles[REGIONS];
  uint64_t first = 0, peak = 0, last = 0;
  for (int round = 0; round < ROUNDS; round++) {
    for (int i = 0; i < REGIONS; i++) {
      handles[i] = nish_region_new();
      fill(handles[i], 64 + (uint64_t)(i % 144));
    }
    uint64_t live = resident();
    if (live > peak) peak = live;
    for (int i = 0; i < REGIONS; i++) nish_region_free(handles[i]);
    last = resident();
    if (round == 0) first = last;
  }
  printf("region: %d regions x %d rounds, resident after the first round %llu KiB, after the last %llu KiB, peak %llu KiB\n",
         REGIONS, ROUNDS, (unsigned long long)(first >> 10), (unsigned long long)(last >> 10),
         (unsigned long long)(peak >> 10));
  CHECK(first > 0, "the resident set can be read");
  /* Flat: later rounds reuse what the first freed, within 4 MiB of noise. */
  CHECK(last <= first + ((uint64_t)4 << 20), "the resident set is flat: %llu KiB after round 1, %llu KiB after round %d",
        (unsigned long long)(first >> 10), (unsigned long long)(last >> 10), ROUNDS);
  /* 64 KiB chunks would keep about 6.5 GB reserved and 450 MB resident here. */
  CHECK(peak < ((uint64_t)128 << 20), "100,000 live sessions stay under 128 MiB resident, peak %llu KiB",
        (unsigned long long)(peak >> 10));
}

#ifdef NISH_THREADS
static void *enter_elsewhere(void *arg) {
  nish_region_enter(*(uint64_t *)arg);
  return NULL;
}
#endif

int main(int argc, char **argv) {
  if (argc < 2) {
    positive();
    if (failures) fprintf(stderr, "%d region check(s) failed\n", failures);
    return failures ? 1 : 0;
  }
  const char *mode = argv[1];
  uint64_t r = nish_region_new();
  if (!strcmp(mode, "zero-enter")) nish_region_enter(0);
  else if (!strcmp(mode, "zero-free")) nish_region_free(0);
  else if (!strcmp(mode, "zero-leave")) nish_region_leave(0, NULL);
  else if (!strcmp(mode, "stale-enter")) { nish_region_free(r); nish_region_new(); nish_region_enter(r); }
  else if (!strcmp(mode, "double-free")) { nish_region_free(r); nish_region_free(r); }
  else if (!strcmp(mode, "forged")) nish_region_enter((uint64_t)1 << 24 | 5000);
  else if (!strcmp(mode, "free-entered")) { nish_region_enter(r); nish_region_free(r); }
  else if (!strcmp(mode, "reenter")) { nish_region_enter(r); nish_region_enter(r); }
  else if (!strcmp(mode, "reenter-nested")) {
    uint64_t other = nish_region_new();
    nish_region_enter(r);
    nish_region_enter(other);
    nish_region_enter(r);
  } else if (!strcmp(mode, "leave-outer")) {
    uint64_t other = nish_region_new();
    nish_region_enter(r);
    nish_region_enter(other);
    nish_region_leave(r, NULL);
  } else if (!strcmp(mode, "leave-unentered")) nish_region_leave(r, NULL);
#ifdef NISH_THREADS
  else if (!strcmp(mode, "thread")) {
    pthread_t t;
    if (pthread_create(&t, NULL, enter_elsewhere, &r) == 0) pthread_join(t, NULL);
  }
#endif
  else {
    fprintf(stderr, "region-test: unknown mode %s\n", mode);
    return 2;
  }
  fprintf(stderr, "region-test: %s returned\n", mode);
  return 3;
}
