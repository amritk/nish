/* Nish runtime, the parallel half: how one range of work becomes several
 * threads, and nothing else.
 *
 * A third translation unit rather than a third of `runtime_os.c`, for the
 * reason that file's header gives for being a second one: a budget should mean
 * one thing. `runtime_os.c` is the syscall wrappers and it had 29 bytes of its
 * ceiling left; `pthread_create` plus a partitioner does not fit in 29 bytes,
 * and raising the syscall half's ceiling to make room would move the number a
 * reader sees for "the operating-system surface" for a reason that has nothing
 * to do with the operating-system surface. So this file carries its own
 * measured ceiling in tests/run.js beside the other two, and a program that
 * runs nothing in parallel pays nothing for it: `-ffunction-sections
 * -Wl,--gc-sections` drops every function no program calls, whichever
 * translation unit defined it.
 *
 * It compiles in both configurations on purpose. With `-DNISH_THREADS` it
 * spawns; without it, and on WASI where there are no threads to spawn, the same
 * entry point runs the whole range on the calling thread. That is what keeps it
 * linkable beside a default build and keeps the caller from needing two
 * spellings -- the flag decides whether the work is divided, never whether the
 * function exists. The thread-local arena the divided case needs is WP20 T0 and
 * arrives with the same macro.
 *
 * There is no language surface here and nothing in the language calls this yet:
 * docs/wp29-thread-surface.md is the surface, and this is the stage under it.
 */
#include "nish.h"

#if defined(NISH_THREADS) && !defined(__wasi__) && !defined(__wasm__)
#define NISH_PAR_REAL 1
#include <pthread.h>
#include <unistd.h>
#endif

/* The ceiling on how many threads one region may use. A fixed bound keeps the
 * job and handle arrays on the stack -- 64 jobs is 2 KB and 64 handles 512
 * bytes -- so a region never allocates to divide itself, which matters because
 * the arena it would allocate from is the very thing being made per-thread. */
#define NISH_PAR_MAX 64

/* Cached, because `sysconf(_SC_NPROCESSORS_ONLN)` is not a cheap read: glibc
 * answers it from `sched_getaffinity` or by parsing
 * /sys/devices/system/cpu/online, and measured here it is 3.7 us -- which
 * `nish_parallel_range` would otherwise pay on every region, including the ones
 * too small to divide, where it was the entire cost. The race between two
 * threads filling it is benign (both compute the same number) but it is still a
 * race, so the word is read and written with relaxed atomic builtins (a plain
 * `int64_t`, since `__atomic_*` does not take an `_Atomic`-qualified pointer):
 * on x86-64 that is
 * a plain load and store and costs nothing, and it is defined behaviour.
 *
 * A machine whose online CPU count changes under a running process therefore
 * keeps the count it started with, which is the right trade for a number that
 * decides how many threads a loop is divided into. */
static int64_t nish_cpu_cached = 0;

int64_t nish_cpu_count(void) {
  int64_t n = __atomic_load_n(&nish_cpu_cached, __ATOMIC_RELAXED);
  if (n != 0) return n;
#ifdef NISH_PAR_REAL
  long got = sysconf(_SC_NPROCESSORS_ONLN);
  n = got > 0 ? (int64_t)got : 1;
#else
  n = 1;
#endif
  __atomic_store_n(&nish_cpu_cached, n, __ATOMIC_RELAXED);
  return n;
}

#ifdef NISH_PAR_REAL
/* One chunk of the range, and where to run it. Passed by pointer to the
 * worker, so it lives in the caller's frame until the join. */
typedef struct {
  nish_par_body body;
  void *ctx;
  int64_t lo;
  int64_t hi;
} nish_par_job;

/* Non-zero inside a region, so a body that itself calls `nish_parallel_range`
 * runs its range on one thread instead of multiplying the thread count by the
 * nesting depth. Thread-local, so the guard is per worker rather than a lock.
 * Sequential nesting is the conservative answer and the only one that needs no
 * scheduler: work stealing is what a library would do here and it is not what
 * this file is for. */
static NISH_TLS int nish_par_depth = 0;

static void *nish_par_worker(void *p) {
  nish_par_job *j = (nish_par_job *)p;
  nish_par_depth = 1;
  j->body(j->lo, j->hi, j->ctx);
  /* This thread's arena, not the parent's: the storage class is what makes the
   * two disjoint (WP20 T0), so a worker can release every byte it bumped
   * without the parent losing one. A worker that did not do this would leak its
   * whole arena at thread exit, since nothing else has a pointer to it. */
  nish_free_arena();
  return 0;
}
#endif

void nish_parallel_range(nish_par_body body, void *ctx, int64_t len, int64_t grain) {
  if (len <= 0) return;
#ifdef NISH_PAR_REAL
  if (grain < 1) grain = 1;
  /* Never more threads than there is work for at the requested granularity,
   * and never more than the machine has. */
  int64_t chunks = (len + grain - 1) / grain;
  int64_t n = nish_cpu_count();
  if (n > NISH_PAR_MAX) n = NISH_PAR_MAX;
  if (chunks < n) n = chunks;
  if (n <= 1 || nish_par_depth != 0) {
    body(0, len, ctx);
    return;
  }

  nish_par_job jobs[NISH_PAR_MAX];
  pthread_t th[NISH_PAR_MAX];
  /* Contiguous chunks, the remainder spread one element at a time over the
   * first `len % n` of them, so the longest chunk is never more than one
   * element longer than the shortest. Contiguous rather than strided because
   * two workers then never write the same cache line except at one boundary. */
  int64_t base = len / n;
  int64_t rem = len % n;
  int64_t at = 0;
  for (int64_t i = 0; i < n; i++) {
    int64_t take = base + (i < rem ? 1 : 0);
    jobs[i].body = body;
    jobs[i].ctx = ctx;
    jobs[i].lo = at;
    jobs[i].hi = at + take;
    at += take;
  }

  /* The caller runs chunk 0 itself, so N-way parallelism costs N-1 spawns and
   * the calling thread is not idle while it waits. Its chunk also runs in the
   * caller's arena, which means chunk 0 behaves exactly as a sequential call
   * would -- the asymmetry is deliberate and is why a body whose result is
   * allocated is the surface's error rather than this file's. */
  int started = 0;
  for (int64_t i = 1; i < n; i++) {
    if (pthread_create(&th[started], 0, nish_par_worker, &jobs[i]) != 0) break;
    started++;
  }
  nish_par_depth++;
  jobs[0].body(jobs[0].lo, jobs[0].hi, jobs[0].ctx);
  /* A chunk whose thread could not be created runs here. Running short of
   * threads must cost speed and never correctness, so there is no path on which
   * a range is silently skipped. */
  for (int64_t i = (int64_t)started + 1; i < n; i++) jobs[i].body(jobs[i].lo, jobs[i].hi, jobs[i].ctx);
  nish_par_depth--;
  for (int i = 0; i < started; i++) pthread_join(th[i], 0);
#else
  (void)grain;
  body(0, len, ctx);
#endif
}
