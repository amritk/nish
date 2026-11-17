/* The debug arena (runtime/runtime.c, NISH_ARENA_DEBUG), driven from C:
 * `node tests/run.js debug-arena` links this with the whole runtime twice, with
 * and without -DNISH_ARENA_DEBUG.
 *
 * It keeps a pointer to a block across the scope that allocated it, the way an
 * escape-analysis bug would, allocates again, and reads the stale pointer.
 * Under the debug arena the read must fault and print the stale-reference
 * message, and the process must die of SIGSEGV. The normal runtime gives the
 * next allocation the same slot, so the read returns that allocation's 7. The
 * suite checks both, so the debug build's trap is shown to be the only thing
 * that tells the two apart. */

#include <stdint.h>
#include <stdio.h>

#include "../../runtime/nish.h"

int main(void) {
  int64_t *keep = nish_alloc_struct(8);
  *keep = 1;
  uint64_t mark = nish_arena_mark();
  int64_t *stale = nish_alloc_struct(8);
  *stale = 42;
  nish_arena_release(mark);
  int64_t *next = nish_alloc_struct(8);
  *next = 7;
  printf("kept %lld, next %lld\n", (long long)*keep, (long long)*next);
  fflush(stdout);
  /* The stale read: 7 from the normal runtime, a fault under the debug one. */
  printf("stale %lld\n", (long long)*(volatile int64_t *)stale);
  return 0;
}
