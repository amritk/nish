/* Nish runtime, the async half: the executor that resumes `async` tasks when
 * the kernel says a file descriptor is ready or a timer is due
 * (docs/wp49-async-server.md, "Stage 5, part 1"; security record
 * docs/security/async.md).
 *
 * A translation unit of its own, paired with runtime.c in scripts/build.sh's
 * `halves` and src/run-cache.ts's `runtimeUnits()` like the others, and linked
 * only into a program whose IR names `@nish_async_`: one with no `async`
 * function links none of it. The wasm profiles refuse `async` (NL2652), so
 * under wasm this file is empty.
 *
 * **A task is a node.** The compiler sizes each spawned function's frame and
 * hands the size to `nish_async_spawn`, which answers a node: this header,
 * then the frame at `NISH_ASYNC_HEADER` bytes. Nodes come from one slab per
 * task kind: a free list, refilled by chunks of nodes whose count doubles, so
 * a program's slab grows to the most tasks it ever had in flight and is then
 * reused; a node is never given back to `malloc`. The compiled driver
 * (`@nish.async.run`, emitted by src/emit-async.ts) resumes a node through a
 * switch over the kinds, not a function pointer, so nothing here calls into
 * the program.
 *
 * **Every node has a permanent index and a generation.** The index is its
 * place in the task table, given once; the generation moves on each time the
 * node is reused. A wait records the (index, generation) of the task that
 * made it, so a completion that arrives after its task finished -- an orphan
 * wait, or a node already reused by another task -- is dropped and counted
 * (`nish_async_stat(1)`) rather than resuming the wrong task. Index 0 is
 * `main`'s, a static node with kind -1 that is never reused.
 *
 * **A wait is a token.** `nish_async_wait_fd` and `nish_async_sleep` answer
 * `(generation << 32) | (slot + 1)` for a slot of the wait table, and the
 * caller polls it with `nish_async_poll` (-1 pending, else the answer, which
 * frees the slot). A wait that can be answered at once -- a bad descriptor,
 * a regular file, a negative sleep -- is made already fired, so the poll in
 * the same resume reads it and the task never suspends.
 *
 * **The loop.** `nish_async_next` answers the next task to resume: the head
 * of the ready queue, or, when the queue is empty and something waits, the
 * first task a blocking kernel wait wakes. Each wait reports the kernel's
 * ready descriptors in the order the kernel listed them, then the timers that
 * expired, earliest deadline first (a binary heap, ties broken by the order
 * they were made). It answers null when nothing is ready and nothing waits,
 * which ends the loop.
 *
 * **A descriptor wait owns a duplicate.** The descriptor is duplicated
 * (`F_DUPFD_CLOEXEC`) and the duplicate registered one-shot, so two tasks can
 * wait on one descriptor, and a program that closes the descriptor while a
 * task waits on it cannot have the registration answer for whatever the
 * number is reused for. The duplicate is closed when the wait fires.
 *
 * **Regions.** Each spawned task owns a region (runtime-region.c), entered
 * whenever the task runs and emptied when it finishes, so whatever a task
 * allocates is given back when it ends. The driver enters and leaves around
 * each resume (`nish_async_enter`, `nish_async_leave`). A node keeps its
 * region from its first task on: `nish_async_done` enters it once more and
 * rewinds it (`nish_reset_arena`) rather than freeing it, so the node's next
 * task (a later spawn of the same async function: a node never changes
 * kind) makes no region, and bumps from the newest chunk the last one left
 * when that chunk is at most 64 KiB (`NISH_ASYNC_KEEP`), so a task that fits
 * it asks `malloc` for nothing. The region keeps its handle and generation:
 * the handle never leaves this file, and a task's region has no children
 * (NL2351), so no copy of it is made stale by living on. A larger chunk is
 * freed, and once the free nodes keep 16 MiB between them
 * (`NISH_ASYNC_KEEP_TOTAL`) a finishing task keeps none and its region starts
 * again from its first chunk size, so a burst of large tasks does not pin its
 * high-water mark. The kept chunk is not zeroed: arena memory never is, and
 * the compiler initialises what the language promises
 * (docs/security/async.md, ASYNC-20).
 *
 * **Cancellation.** `nish_async_cancel` marks a task cancelled
 * (`NISH_TASK_CANCELLED`, a bit beside the queued bit) and fails each wait it
 * has pending, so every parked await answers false and the task is queued; a
 * wait the task makes afterwards is made already failed. Nothing is unwound:
 * the task runs on from each failed await to its end, its `using` bindings
 * dispose as they do on any return, and `nish_async_done` empties its region.
 * `nish_async_cancel_after` arms a deadline that cancels a task when it
 * passes, a timer in the heap that `done` takes out, and
 * `nish_async_wait_fd_within` a descriptor wait that fails when its own
 * deadline passes first. A timer leaves the heap the moment its wait is
 * answered either way (`heap_at`), so the heap holds only live timers.
 *
 * The executor runs on the thread that runs `main`; its state is not shared
 * with the threads of `nish/threads`. */

#if defined(__wasi__) || defined(__wasm__)
typedef int nish_async_unused_in_wasm;
#else
#if defined(__linux__)
/* glibc declares `clock_gettime`, `nanosleep` and `F_DUPFD_CLOEXEC` under a feature macro. */
#define _GNU_SOURCE
#else
#define _DARWIN_C_SOURCE
#endif

#include <errno.h>
#include <fcntl.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#if defined(__linux__)
#include <sys/epoll.h>
#else
#include <sys/event.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <sys/types.h>
#endif

#include "nish.h"

#define NISH_COLD __attribute__((noreturn, cold, noinline))

/* The bytes ahead of a frame in a node; src/emit-async.ts's NODE_HEADER. */
#define NISH_ASYNC_HEADER 32

typedef struct nish_task {
  struct nish_task *next; /* the ready queue's link, or the free list's */
  int32_t kind;           /* the spawned function's kind; -1 for `main` */
  uint32_t gen;           /* moves on each time the node is reused */
  uint64_t region;        /* the task's region; 0 for `main` and a node never yet used */
  uint32_t index;         /* the node's place in the task table, for ever */
  uint32_t flags;         /* NISH_TASK_QUEUED, NISH_TASK_CANCELLED; on the free list, the kept bytes */
} nish_task;

/* On the ready queue, so it is queued once. */
#define NISH_TASK_QUEUED 1u
/* Cancelled: each wait it has, or makes, answers false at once. */
#define NISH_TASK_CANCELLED 2u

_Static_assert(sizeof(nish_task) <= NISH_ASYNC_HEADER, "a node's header holds a task");
_Static_assert(offsetof(nish_task, kind) == 8, "the driver reads the kind at byte 8");

typedef struct nish_slab {
  nish_task *free;
  uint64_t stride; /* header and frame, rounded to 16 */
  uint64_t chunk;  /* nodes in the next chunk */
} nish_slab;

enum { NISH_WAIT_FREE, NISH_WAIT_PENDING, NISH_WAIT_FIRED };

typedef struct nish_wait {
  uint32_t gen;      /* moves on each time the slot is freed */
  uint32_t task;     /* the waiting task's index ... */
  uint32_t task_gen; /* ... and its generation when it waited */
  int32_t state;
  int32_t answer;
  int32_t fd;        /* the registered duplicate, or -1 for a timer */
  int64_t deadline;  /* a timer's, in CLOCK_MONOTONIC nanoseconds */
  uint64_t seq;      /* a timer's place among equal deadlines */
  int32_t heap_at;   /* its place in the timer heap, or -1 */
  int32_t cancels;   /* a task's deadline: firing cancels the task, waking nothing */
} nish_wait;

static nish_task nish_async_main_task = {NULL, -1, 1, 0, 0, 0};
static nish_task *nish_async_current = &nish_async_main_task;

static nish_task **nish_async_tasks;
static uint32_t nish_async_task_count;
static uint32_t nish_async_task_cap;

static nish_slab *nish_async_slabs;
static uint32_t nish_async_slab_count;

static nish_task *nish_async_head;
static nish_task *nish_async_tail;

static nish_wait *nish_async_waits;
static uint32_t nish_async_wait_count;
static uint32_t nish_async_wait_cap;
static uint32_t *nish_async_wait_free;
static uint32_t nish_async_wait_free_len;

static uint32_t *nish_async_heap;
static uint32_t nish_async_heap_len;
static uint32_t nish_async_heap_cap;
static uint64_t nish_async_seq;

/* Per task index, the slot + 1 of its armed deadline, or 0. */
static uint32_t *nish_async_deadlines;
static uint32_t nish_async_deadline_cap;

static int nish_async_poller = -1;
static uint32_t nish_async_fd_waits;

static int32_t nish_async_allocated;
static int32_t nish_async_late;
static int32_t nish_async_live; /* spawned tasks not yet done, each holding a region */
/* What a finished task's region may keep for the node's next task: its newest
   chunk when that is no larger than NISH_ASYNC_KEEP, and nothing once the
   free nodes together keep NISH_ASYNC_KEEP_TOTAL, so the most the free lists
   hold is that total and one chunk. A free node's `flags` hold what its
   region kept, from bit NISH_TASK_KEPT_SHIFT up. */
#define NISH_ASYNC_KEEP ((uint64_t)1 << 16)
#define NISH_ASYNC_KEEP_TOTAL ((uint64_t)1 << 24)
#define NISH_TASK_KEPT_SHIFT 8
static uint64_t nish_async_kept; /* bytes the free nodes' regions keep */
extern NISH_TLS uint64_t nish_region_chunk; /* runtime.c: the entered region's next chunk size */

enum { NISH_ASYNC_OOM, NISH_ASYNC_POLLER, NISH_ASYNC_TOO_MANY, NISH_ASYNC_WAIT };
#define NISH_ASYNC_MSG(text) { sizeof text - 1, text }
static const struct { uint64_t len; char data[64]; } nish_async_messages[] = {
  NISH_ASYNC_MSG("nish: out of memory"),
  NISH_ASYNC_MSG("nish: the async event loop could not be made"),
  NISH_ASYNC_MSG("nish: more than 4294967294 async tasks or waits"),
  NISH_ASYNC_MSG("nish: the async event loop could not wait"),
};

static NISH_COLD void nish_async_die(int why) {
  nish_panic((const nish_str *)&nish_async_messages[why]);
}

/* Grow `*items` (of `size`-byte entries, `*cap` of them) to hold one more. */
static void *nish_async_grow(void *items, uint32_t *cap, size_t size) {
  if (*cap >= UINT32_MAX / 2) nish_async_die(NISH_ASYNC_TOO_MANY);
  uint32_t want = *cap ? *cap * 2 : 16;
  void *grown = realloc(items, (size_t)want * size);
  if (!grown) nish_async_die(NISH_ASYNC_OOM);
  *cap = want;
  return grown;
}

static void nish_async_table_add(nish_task *t) {
  if (!nish_async_tasks) {
    nish_async_tasks = nish_async_grow(NULL, &nish_async_task_cap, sizeof *nish_async_tasks);
    nish_async_tasks[0] = &nish_async_main_task;
    nish_async_task_count = 1;
  }
  if (nish_async_task_count == nish_async_task_cap)
    nish_async_tasks = nish_async_grow(nish_async_tasks, &nish_async_task_cap, sizeof *nish_async_tasks);
  while (nish_async_task_count >= nish_async_deadline_cap) {
    uint32_t had = nish_async_deadline_cap;
    nish_async_deadlines = nish_async_grow(nish_async_deadlines, &nish_async_deadline_cap, sizeof *nish_async_deadlines);
    memset(nish_async_deadlines + had, 0, (size_t)(nish_async_deadline_cap - had) * sizeof *nish_async_deadlines);
  }
  t->index = nish_async_task_count;
  nish_async_tasks[nish_async_task_count++] = t;
}

static int64_t nish_async_now(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (int64_t)ts.tv_sec * 1000000000 + ts.tv_nsec;
}

static void nish_async_enqueue(nish_task *t) {
  if (t->flags & NISH_TASK_QUEUED) return;
  t->flags |= NISH_TASK_QUEUED;
  t->next = NULL;
  if (nish_async_tail) nish_async_tail->next = t;
  else nish_async_head = t;
  nish_async_tail = t;
}

/* ---- Tasks --------------------------------------------------------------- */

void *nish_async_spawn(int32_t kind, uint64_t bytes) {
  if (kind < 0) nish_async_die(NISH_ASYNC_TOO_MANY);
  if ((uint32_t)kind >= nish_async_slab_count) {
    uint32_t want = (uint32_t)kind + 1;
    nish_slab *grown = realloc(nish_async_slabs, (size_t)want * sizeof *grown);
    if (!grown) nish_async_die(NISH_ASYNC_OOM);
    memset(grown + nish_async_slab_count, 0, (size_t)(want - nish_async_slab_count) * sizeof *grown);
    nish_async_slabs = grown;
    nish_async_slab_count = want;
  }
  nish_slab *slab = &nish_async_slabs[kind];
  if (!slab->free) {
    if (!slab->stride) {
      slab->stride = (NISH_ASYNC_HEADER + bytes + 15) & ~(uint64_t)15;
      slab->chunk = 4;
    }
    uint64_t count = slab->chunk;
    char *chunk = malloc(count * slab->stride);
    if (!chunk) nish_async_die(NISH_ASYNC_OOM);
    slab->chunk = count * 2;
    for (uint64_t i = count; i-- > 0;) {
      nish_task *t = (nish_task *)(chunk + i * slab->stride);
      t->gen = 1;
      t->region = 0;
      t->flags = 0;
      nish_async_table_add(t);
      t->next = slab->free;
      slab->free = t;
      nish_async_allocated++;
    }
  }
  nish_task *t = slab->free;
  slab->free = t->next;
  t->next = NULL;
  t->kind = kind;
  nish_async_kept -= t->flags >> NISH_TASK_KEPT_SHIFT;
  t->flags = 0;
  if (!t->region) t->region = nish_region_new();
  nish_async_live++;
  return t;
}

/* Make `node` the running task and enter its region; answers the task that was running. */
void *nish_async_enter(void *node) {
  nish_task *t = node;
  nish_task *prev = nish_async_current;
  nish_async_current = t;
  if (t->region) nish_region_enter(t->region);
  return prev;
}

/* Leave `node`'s region and make `prev`, what `nish_async_enter` answered, the running task again. */
void nish_async_leave(void *node, void *prev) {
  nish_task *t = node;
  if (t->region) nish_region_leave(t->region, NULL);
  nish_async_current = prev;
}

static void nish_async_disarm(nish_task *t);

/* A task finished: take out its deadline, empty its region for the node's
   next task and put its node back, a generation on. */
void nish_async_done(void *node) {
  nish_task *t = node;
  if (t->kind < 0) return;
  nish_async_disarm(t);
  /* A task that cancelled itself while awaitAll ran its calls was queued by
     its own failed waits and may finish still on the ready queue: take it
     off, so the queue never holds a node on the free list. */
  if (t->flags & NISH_TASK_QUEUED) {
    nish_task **at = &nish_async_head;
    nish_task *before = NULL;
    while (*at && *at != t) {
      before = *at;
      at = &(*at)->next;
    }
    if (*at) {
      *at = t->next;
      if (nish_async_tail == t) nish_async_tail = before;
    }
    t->flags &= ~NISH_TASK_QUEUED;
  }
  nish_region_enter(t->region);
  nish_reset_arena();
  if (nish_arena.cap > (nish_async_kept < NISH_ASYNC_KEEP_TOTAL ? NISH_ASYNC_KEEP : 0)) {
    nish_free_arena();
    nish_region_chunk = 8;
  }
  uint64_t kept = nish_arena.cap;
  nish_region_leave(t->region, NULL);
  nish_async_kept += kept;
  t->flags = (uint32_t)kept << NISH_TASK_KEPT_SHIFT;
  nish_async_live--;
  t->gen = t->gen == UINT32_MAX ? 1 : t->gen + 1;
  nish_slab *slab = &nish_async_slabs[t->kind];
  t->next = slab->free;
  slab->free = t;
}

/* ---- Waits --------------------------------------------------------------- */

static uint64_t nish_async_token(uint32_t slot) {
  return ((uint64_t)nish_async_waits[slot].gen << 32) | ((uint64_t)slot + 1);
}

/* The slot `token` names, or -1 for one that is not a live wait. */
static int64_t nish_async_slot_of(uint64_t token) {
  uint64_t low = token & 0xffffffffu;
  if (low == 0 || low > nish_async_wait_count) return -1;
  uint32_t slot = (uint32_t)(low - 1);
  nish_wait *w = &nish_async_waits[slot];
  if (w->gen != (uint32_t)(token >> 32) || w->state == NISH_WAIT_FREE) return -1;
  return slot;
}

static uint32_t nish_async_wait_new(void) {
  uint32_t slot;
  if (nish_async_wait_free_len) {
    slot = nish_async_wait_free[--nish_async_wait_free_len];
  } else {
    if (nish_async_wait_count == nish_async_wait_cap) {
      uint32_t cap = nish_async_wait_cap;
      nish_async_waits = nish_async_grow(nish_async_waits, &nish_async_wait_cap, sizeof *nish_async_waits);
      nish_async_wait_free = nish_async_grow(nish_async_wait_free, &cap, sizeof *nish_async_wait_free);
    }
    slot = nish_async_wait_count++;
    nish_async_waits[slot].gen = 1;
  }
  nish_wait *w = &nish_async_waits[slot];
  w->task = nish_async_current->index;
  w->task_gen = nish_async_current->gen;
  w->state = NISH_WAIT_PENDING;
  w->answer = 0;
  w->fd = -1;
  w->deadline = 0;
  w->seq = 0;
  w->heap_at = -1;
  w->cancels = 0;
  return slot;
}

static void nish_async_wait_free_slot(uint32_t slot) {
  nish_wait *w = &nish_async_waits[slot];
  w->state = NISH_WAIT_FREE;
  w->gen = w->gen == UINT32_MAX ? 1 : w->gen + 1;
  nish_async_wait_free[nish_async_wait_free_len++] = slot;
}

/* A wait answered before anyone polled it: the poll in the same resume reads it. */
static uint64_t nish_async_fired_now(uint32_t slot, int32_t answer) {
  nish_async_waits[slot].state = NISH_WAIT_FIRED;
  nish_async_waits[slot].answer = answer;
  return nish_async_token(slot);
}

/* ---- The timer heap ---------------------------------------------------- */

static int nish_async_timer_before(uint32_t a, uint32_t b) {
  nish_wait *x = &nish_async_waits[a];
  nish_wait *y = &nish_async_waits[b];
  return x->deadline < y->deadline || (x->deadline == y->deadline && x->seq < y->seq);
}

static void nish_async_heap_set(uint32_t at, uint32_t slot) {
  nish_async_heap[at] = slot;
  nish_async_waits[slot].heap_at = (int32_t)at;
}

static void nish_async_heap_up(uint32_t at) {
  uint32_t slot = nish_async_heap[at];
  while (at > 0) {
    uint32_t up = (at - 1) / 2;
    if (!nish_async_timer_before(slot, nish_async_heap[up])) break;
    nish_async_heap_set(at, nish_async_heap[up]);
    at = up;
  }
  nish_async_heap_set(at, slot);
}

static void nish_async_heap_down(uint32_t at) {
  uint32_t slot = nish_async_heap[at];
  for (;;) {
    uint32_t kid = at * 2 + 1;
    if (kid >= nish_async_heap_len) break;
    if (kid + 1 < nish_async_heap_len && nish_async_timer_before(nish_async_heap[kid + 1], nish_async_heap[kid]))
      kid++;
    if (!nish_async_timer_before(nish_async_heap[kid], slot)) break;
    nish_async_heap_set(at, nish_async_heap[kid]);
    at = kid;
  }
  nish_async_heap_set(at, slot);
}

static void nish_async_heap_push(uint32_t slot) {
  if (nish_async_heap_len == nish_async_heap_cap)
    nish_async_heap = nish_async_grow(nish_async_heap, &nish_async_heap_cap, sizeof *nish_async_heap);
  nish_async_heap_set(nish_async_heap_len++, slot);
  nish_async_heap_up(nish_async_heap_len - 1);
}

/* Take the timer of `slot` out of the heap, wherever it is. */
static void nish_async_heap_remove(uint32_t slot) {
  int32_t at = nish_async_waits[slot].heap_at;
  if (at < 0) return;
  nish_async_waits[slot].heap_at = -1;
  uint32_t last = nish_async_heap[--nish_async_heap_len];
  if ((uint32_t)at == nish_async_heap_len) return;
  nish_async_heap_set((uint32_t)at, last);
  nish_async_heap_up((uint32_t)at);
  nish_async_heap_down((uint32_t)nish_async_waits[last].heap_at);
}

/* ---- Answering a wait ---------------------------------------------------- */

static nish_task *nish_async_task_at(uint32_t index, uint32_t gen) {
  nish_task *t = index == 0 ? &nish_async_main_task
               : index < nish_async_task_count ? nish_async_tasks[index] : NULL;
  return t && t->gen == gen ? t : NULL;
}

static void nish_async_cancel_task(nish_task *t);

/* The wait in `slot` completed with `answer`: queue its task, or drop it when
   the task it was made for has finished. A task's deadline cancels the task
   instead. */
static void nish_async_fire(uint32_t slot, int32_t answer) {
  nish_wait *w = &nish_async_waits[slot];
  if (w->state != NISH_WAIT_PENDING) return;
  nish_async_heap_remove(slot);
  if (w->fd >= 0) {
#if defined(__linux__)
    epoll_ctl(nish_async_poller, EPOLL_CTL_DEL, w->fd, NULL);
#endif
    close(w->fd);
    w->fd = -1;
    nish_async_fd_waits--;
  }
  w->state = NISH_WAIT_FIRED;
  w->answer = answer;
  nish_task *t = nish_async_task_at(w->task, w->task_gen);
  if (w->cancels) {
    if (nish_async_deadlines[w->task] == slot + 1) nish_async_deadlines[w->task] = 0;
    nish_async_wait_free_slot(slot);
    if (t) nish_async_cancel_task(t);
    return;
  }
  if (!t) {
    nish_async_late++;
    nish_async_wait_free_slot(slot);
    return;
  }
  nish_async_enqueue(t);
}

/* A timer came due: a sleep is over (true), a descriptor wait's deadline
   passed first (false), a task's deadline cancels it. */
static void nish_async_expire(uint32_t slot) {
  nish_async_fire(slot, nish_async_waits[slot].fd >= 0 ? 0 : 1);
}

/* ---- Cancellation -------------------------------------------------------- */

/* Mark `t` cancelled and fail each wait it has pending. */
static void nish_async_cancel_task(nish_task *t) {
  if (t->flags & NISH_TASK_CANCELLED) return;
  t->flags |= NISH_TASK_CANCELLED;
  nish_async_disarm(t);
  for (uint32_t slot = 0; slot < nish_async_wait_count; slot++) {
    nish_wait *w = &nish_async_waits[slot];
    if (w->state == NISH_WAIT_PENDING && !w->cancels && w->task == t->index && w->task_gen == t->gen)
      nish_async_fire(slot, 0);
  }
}

/* Take out `t`'s armed deadline, if it has one. */
static void nish_async_disarm(nish_task *t) {
  if (!nish_async_deadlines || t->index >= nish_async_deadline_cap) return;
  uint32_t armed = nish_async_deadlines[t->index];
  if (!armed) return;
  nish_async_deadlines[t->index] = 0;
  nish_async_heap_remove(armed - 1);
  nish_async_wait_free_slot(armed - 1);
}

/* The task `handle` names (`nish_async_task_id`), or null for one that has
   finished, `main`, or no task. */
static nish_task *nish_async_task_of(int64_t handle) {
  uint32_t index = (uint32_t)((uint64_t)handle & 0xffffffffu);
  if (index == 0) return NULL;
  return nish_async_task_at(index, (uint32_t)((uint64_t)handle >> 32));
}

/* The running task's handle: its generation, then its index; 0 for `main`. */
int64_t nish_async_task_id(void) {
  nish_task *t = nish_async_current;
  if (t == &nish_async_main_task) return 0;
  return (int64_t)(((uint64_t)t->gen << 32) | t->index);
}

/* Cancel the task `handle` names: true when it is still running (a second
   cancel too), false for one that has finished, or `main`. */
int32_t nish_async_cancel(int64_t handle) {
  nish_task *t = nish_async_task_of(handle);
  if (!t) return 0;
  nish_async_cancel_task(t);
  return 1;
}

/* Whether the running task is cancelled. */
int32_t nish_async_cancelled(void) {
  return (nish_async_current->flags & NISH_TASK_CANCELLED) != 0;
}

/* Cancel the task `handle` names `ms` milliseconds from now, in place of any
   deadline it had; a negative `ms` only takes the old one out. False for a
   task that has finished, or `main`. */
int32_t nish_async_cancel_after(int64_t handle, int32_t ms) {
  nish_task *t = nish_async_task_of(handle);
  if (!t) return 0;
  nish_async_disarm(t);
  if (ms < 0 || (t->flags & NISH_TASK_CANCELLED)) return 1;
  nish_task *running = nish_async_current;
  nish_async_current = t;
  uint32_t slot = nish_async_wait_new();
  nish_async_current = running;
  nish_wait *w = &nish_async_waits[slot];
  w->cancels = 1;
  w->deadline = nish_async_now() + (int64_t)ms * 1000000;
  w->seq = nish_async_seq++;
  nish_async_heap_push(slot);
  nish_async_deadlines[t->index] = slot + 1;
  return 1;
}

/* A wait for `fd` to be readable (`dir` 0) or writable (`dir` 1). */
uint64_t nish_async_wait_fd(int32_t fd, int32_t dir) {
  uint32_t slot = nish_async_wait_new();
  if (fd < 0 || (nish_async_current->flags & NISH_TASK_CANCELLED)) return nish_async_fired_now(slot, 0);
  if (nish_async_poller < 0) {
#if defined(__linux__)
    nish_async_poller = epoll_create1(EPOLL_CLOEXEC);
#else
    nish_async_poller = kqueue();
    if (nish_async_poller >= 0) fcntl(nish_async_poller, F_SETFD, FD_CLOEXEC);
#endif
    if (nish_async_poller < 0) nish_async_die(NISH_ASYNC_POLLER);
  }
  int dup = fcntl(fd, F_DUPFD_CLOEXEC, 0);
  if (dup < 0) return nish_async_fired_now(slot, 0);
#if !defined(__linux__)
  /* kqueue accepts a regular file and reports it readable only while it has
     bytes left, so one at its end would park the task for ever; epoll refuses
     it below. A regular file never blocks: it is ready, on both kernels. */
  struct stat st;
  if (fstat(dup, &st) == 0 && S_ISREG(st.st_mode)) {
    close(dup);
    return nish_async_fired_now(slot, 1);
  }
#endif
  uint64_t token = nish_async_token(slot);
#if defined(__linux__)
  struct epoll_event ev;
  memset(&ev, 0, sizeof ev);
  ev.events = (dir ? EPOLLOUT : EPOLLIN) | EPOLLONESHOT;
  ev.data.u64 = token;
  int rc = epoll_ctl(nish_async_poller, EPOLL_CTL_ADD, dup, &ev);
#else
  struct kevent ev;
  EV_SET(&ev, (uintptr_t)dup, dir ? EVFILT_WRITE : EVFILT_READ, EV_ADD | EV_ONESHOT, 0, 0,
         (void *)(uintptr_t)token);
  int rc = kevent(nish_async_poller, &ev, 1, NULL, 0, NULL);
#endif
  if (rc < 0) {
    /* epoll refuses a regular file (EPERM), which never blocks: it is ready. */
    int ready = errno == EPERM;
    close(dup);
    return nish_async_fired_now(slot, ready);
  }
  nish_async_waits[slot].fd = dup;
  nish_async_fd_waits++;
  return token;
}

/* A descriptor wait that fails (answers false) when `ms` milliseconds pass
   before `fd` is ready; a negative `ms` waits as long as it takes. */
uint64_t nish_async_wait_fd_within(int32_t fd, int32_t dir, int32_t ms) {
  uint64_t token = nish_async_wait_fd(fd, dir);
  uint32_t slot = (uint32_t)(token & 0xffffffffu) - 1;
  nish_wait *w = &nish_async_waits[slot];
  if (ms < 0 || w->state != NISH_WAIT_PENDING) return token;
  w->deadline = nish_async_now() + (int64_t)ms * 1000000;
  w->seq = nish_async_seq++;
  nish_async_heap_push(slot);
  return token;
}

/* A wait for `ms` milliseconds; a negative `ms`, or a cancelled task, answers false at once. */
uint64_t nish_async_sleep(int32_t ms) {
  uint32_t slot = nish_async_wait_new();
  if (ms < 0 || (nish_async_current->flags & NISH_TASK_CANCELLED)) return nish_async_fired_now(slot, 0);
  nish_async_waits[slot].deadline = nish_async_now() + (int64_t)ms * 1000000;
  nish_async_waits[slot].seq = nish_async_seq++;
  nish_async_heap_push(slot);
  return nish_async_token(slot);
}

/* -1 while the wait is pending; else its answer (1 ready, 0 failed), and the token is spent. */
int32_t nish_async_poll(uint64_t token) {
  int64_t slot = nish_async_slot_of(token);
  if (slot < 0) return 0;
  nish_wait *w = &nish_async_waits[slot];
  if (w->state == NISH_WAIT_PENDING) return -1;
  int32_t answer = w->answer;
  nish_async_wait_free_slot((uint32_t)slot);
  return answer;
}

/* ---- The loop ------------------------------------------------------------ */

/* Block until a descriptor is ready or the first timer is due, then queue
   what woke: the descriptors in the kernel's order, then the expired timers
   by deadline. */
static void nish_async_block(void) {
  int64_t wait_ns = -1;
  if (nish_async_heap_len) {
    wait_ns = nish_async_waits[nish_async_heap[0]].deadline - nish_async_now();
    if (wait_ns < 0) wait_ns = 0;
  }
  if (nish_async_fd_waits) {
#if defined(__linux__)
    struct epoll_event evs[64];
    int timeout = -1;
    if (wait_ns >= 0) {
      int64_t ms = (wait_ns + 999999) / 1000000;
      timeout = ms > 0x7fffffff ? 0x7fffffff : (int)ms;
    }
    int n = epoll_wait(nish_async_poller, evs, 64, timeout);
    /* A signal ends the wait early and the caller waits again; any other
       failure would recur on every call and spin, so it ends the program. */
    if (n < 0 && errno != EINTR) nish_async_die(NISH_ASYNC_WAIT);
    for (int i = 0; i < n; i++) {
      int64_t slot = nish_async_slot_of(evs[i].data.u64);
      if (slot < 0) {
        nish_async_late++;
        continue;
      }
      nish_async_fire((uint32_t)slot, 1);
    }
#else
    struct kevent evs[64];
    struct timespec ts;
    struct timespec *tp = NULL;
    if (wait_ns >= 0) {
      ts.tv_sec = wait_ns / 1000000000;
      ts.tv_nsec = wait_ns % 1000000000;
      tp = &ts;
    }
    int n = kevent(nish_async_poller, NULL, 0, evs, 64, tp);
    if (n < 0 && errno != EINTR) nish_async_die(NISH_ASYNC_WAIT);
    for (int i = 0; i < n; i++) {
      int64_t slot = nish_async_slot_of((uint64_t)(uintptr_t)evs[i].udata);
      if (slot < 0) {
        nish_async_late++;
        continue;
      }
      nish_async_fire((uint32_t)slot, 1);
    }
#endif
  } else if (wait_ns > 0) {
    struct timespec ts;
    ts.tv_sec = wait_ns / 1000000000;
    ts.tv_nsec = wait_ns % 1000000000;
    while (nanosleep(&ts, &ts) < 0 && errno == EINTR) {
    }
  }
  int64_t now = nish_async_now();
  while (nish_async_heap_len && nish_async_waits[nish_async_heap[0]].deadline <= now)
    nish_async_expire(nish_async_heap[0]);
}

/* The next task to resume, waiting on the kernel for one when none is ready;
   null when nothing is ready and nothing waits. */
void *nish_async_next(void) {
  while (!nish_async_head) {
    if (!nish_async_fd_waits && !nish_async_heap_len) return NULL;
    nish_async_block();
  }
  nish_task *t = nish_async_head;
  nish_async_head = t->next;
  if (!nish_async_head) nish_async_tail = NULL;
  t->next = NULL;
  t->flags &= ~NISH_TASK_QUEUED;
  return t;
}

/* A spawned task's string argument, copied into the arena that is current --
 * the task's region, which the spawn has just entered -- so the task never
 * reads memory its spawner's arena owns after the spawner has returned. */
void *nish_async_copy_str(const void *s) {
  const nish_str *from = s;
  return nish_str_new(from->data, from->len);
}

/* 0: nodes the slabs ever allocated; 1: completions dropped because their task
   had finished; 2: spawned tasks not yet finished, each of which holds a region;
   3: timers in the heap (sleeps, bounded waits and armed deadlines). */
int32_t nish_async_stat(int32_t which) {
  if (which == 0) return nish_async_allocated;
  if (which == 1) return nish_async_late;
  if (which == 2) return nish_async_live;
  if (which == 3) return (int32_t)nish_async_heap_len;
  return -1;
}

#endif
