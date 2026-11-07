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
 * whenever the task runs and freed when it finishes, so whatever a task
 * allocates is given back when it ends. The driver enters and leaves around
 * each resume (`nish_async_enter`, `nish_async_leave`).
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
  uint64_t region;        /* the task's region; 0 for `main` and a free node */
  uint32_t index;         /* the node's place in the task table, for ever */
  uint32_t queued;        /* on the ready queue, so it is queued once */
} nish_task;

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

static int nish_async_poller = -1;
static uint32_t nish_async_fd_waits;

static int32_t nish_async_allocated;
static int32_t nish_async_late;
static int32_t nish_async_live; /* spawned tasks not yet done, each holding a region */

enum { NISH_ASYNC_OOM, NISH_ASYNC_POLLER, NISH_ASYNC_TOO_MANY };
#define NISH_ASYNC_MSG(text) { sizeof text - 1, text }
static const struct { uint64_t len; char data[64]; } nish_async_messages[] = {
  NISH_ASYNC_MSG("nish: out of memory"),
  NISH_ASYNC_MSG("nish: the async event loop could not be made"),
  NISH_ASYNC_MSG("nish: more than 4294967294 async tasks or waits"),
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
  t->index = nish_async_task_count;
  nish_async_tasks[nish_async_task_count++] = t;
}

static int64_t nish_async_now(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (int64_t)ts.tv_sec * 1000000000 + ts.tv_nsec;
}

static void nish_async_enqueue(nish_task *t) {
  if (t->queued) return;
  t->queued = 1;
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
      t->queued = 0;
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
  t->queued = 0;
  t->region = nish_region_new();
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

/* A task finished: free its region and put its node back, a generation on. */
void nish_async_done(void *node) {
  nish_task *t = node;
  if (t->kind < 0) return;
  nish_region_free(t->region);
  t->region = 0;
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

/* The wait in `slot` completed with `answer`: queue its task, or drop it when
   the task it was made for has finished. */
static void nish_async_fire(uint32_t slot, int32_t answer) {
  nish_wait *w = &nish_async_waits[slot];
  if (w->state != NISH_WAIT_PENDING) return;
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
  nish_task *t = w->task == 0 ? &nish_async_main_task
                : w->task < nish_async_task_count ? nish_async_tasks[w->task] : NULL;
  if (!t || t->gen != w->task_gen) {
    nish_async_late++;
    nish_async_wait_free_slot(slot);
    return;
  }
  nish_async_enqueue(t);
}

static int nish_async_timer_before(uint32_t a, uint32_t b) {
  nish_wait *x = &nish_async_waits[a];
  nish_wait *y = &nish_async_waits[b];
  return x->deadline < y->deadline || (x->deadline == y->deadline && x->seq < y->seq);
}

static void nish_async_heap_push(uint32_t slot) {
  if (nish_async_heap_len == nish_async_heap_cap)
    nish_async_heap = nish_async_grow(nish_async_heap, &nish_async_heap_cap, sizeof *nish_async_heap);
  uint32_t at = nish_async_heap_len++;
  while (at > 0) {
    uint32_t up = (at - 1) / 2;
    if (!nish_async_timer_before(slot, nish_async_heap[up])) break;
    nish_async_heap[at] = nish_async_heap[up];
    at = up;
  }
  nish_async_heap[at] = slot;
}

static uint32_t nish_async_heap_pop(void) {
  uint32_t top = nish_async_heap[0];
  uint32_t last = nish_async_heap[--nish_async_heap_len];
  uint32_t at = 0;
  for (;;) {
    uint32_t kid = at * 2 + 1;
    if (kid >= nish_async_heap_len) break;
    if (kid + 1 < nish_async_heap_len && nish_async_timer_before(nish_async_heap[kid + 1], nish_async_heap[kid]))
      kid++;
    if (!nish_async_timer_before(nish_async_heap[kid], last)) break;
    nish_async_heap[at] = nish_async_heap[kid];
    at = kid;
  }
  if (nish_async_heap_len) nish_async_heap[at] = last;
  return top;
}

/* A wait for `fd` to be readable (`dir` 0) or writable (`dir` 1). */
uint64_t nish_async_wait_fd(int32_t fd, int32_t dir) {
  uint32_t slot = nish_async_wait_new();
  if (fd < 0) return nish_async_fired_now(slot, 0);
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

/* A wait for `ms` milliseconds; a negative `ms` answers false at once. */
uint64_t nish_async_sleep(int32_t ms) {
  uint32_t slot = nish_async_wait_new();
  if (ms < 0) return nish_async_fired_now(slot, 0);
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
    nish_async_fire(nish_async_heap_pop(), 1);
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
  t->queued = 0;
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
   had finished; 2: spawned tasks not yet finished, each of which holds a region. */
int32_t nish_async_stat(int32_t which) {
  if (which == 0) return nish_async_allocated;
  if (which == 1) return nish_async_late;
  if (which == 2) return nish_async_live;
  return -1;
}

#endif
