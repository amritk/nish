/* Nish runtime, the copy-at-join half: how a string or an array of scalars
 * crosses from one thread's arena to another's, and how a `Mutex` keeps the
 * strings stored through its guard.
 *
 * A translation unit of its own rather than more of runtime-parallel.c, for
 * the reason that file's header gives for being one: each file carries its own
 * measured `.text*` ceiling in tests/runtime-budgets.js, and this one would not
 * fit in what runtime-parallel.c had left (RUNTIME_CROSS_TEXT_BUDGET says how
 * much it needs). Apart, a program that divides a range of numbers links none
 * of this, and section GC drops what a program that crosses no string calls.
 *
 * A task's or a chunk's arena is rewound once its job is done
 * (`nish_pool_drain`, and the release the compiler emits after a task or a
 * chunk returns), so a string or an array it answers, sends or stores through
 * a guard cannot stay where it was made. `nish_cross_out` runs on the thread
 * that made the value: one that was bumped in its arena since `mark` (0: at
 * any time) is copied into a block of its own, outside every arena, and
 * answered with its low bit set. Any other value -- a literal, or one the
 * parent made, which outlives the join -- is answered as it is, so a task that
 * answers its parent's array answers that array, as it does under Node.
 * `nish_cross_send` is a channel's: it copies every string, which costs the
 * string's length and nothing that grows with the sender's arena.
 * `nish_cross_in` runs on the thread that takes the value: a tagged one is
 * copied into its arena and its block freed, or, when it is large, its block
 * becomes a chunk of that arena, so every block is either freed by the one
 * `cross_in` its value meets or freed with the arena that adopted it. A map's
 * elements do not go one block each: a chunk packs them into blocks of its
 * own (`nish_cross_keep`), which the caller adopts whole, or copies in and
 * frees when they hold little (`nish_cross_adopt`). Arena blocks,
 * literals and the copies here are all 8-aligned, which is what keeps the low
 * bit free for the tag.
 *
 * `esize` is 0 for a string and the element's size for an array of scalars,
 * which holds no pointer, so one flat copy of its header and its elements is
 * the whole value. A panic ends the process, and every block with it.
 *
 * It compiles in both configurations, as runtime-parallel.c does: a task run
 * on the calling thread at the join is rewound all the same, so the copies are
 * needed whether or not there are threads; only the guard set's lock is
 * `-DNISH_THREADS` alone. */
#include "nish.h"

#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#if defined(NISH_THREADS) && !defined(__wasi__) && !defined(__wasm__)
#define NISH_CROSS_LOCKED 1
#include <pthread.h>
#endif

/* runtime.c's `nish_chunk`, which nish.h leaves opaque (`nish_arena.chunks` is
 * a `void *` there). runtime.c asserts the same three facts of its own
 * definition, so a change to either side fails to compile until the other
 * follows. */
typedef struct nish_xchunk { struct nish_xchunk *next; uint64_t cap; } nish_xchunk;
_Static_assert(sizeof(nish_xchunk) == 16, "runtime.c's nish_chunk: { next, cap }, the bytes after it");
_Static_assert(offsetof(nish_xchunk, next) == 0, "runtime.c's nish_chunk: next first");
_Static_assert(offsetof(nish_xchunk, cap) == 8, "runtime.c's nish_chunk: cap second");

/* The end of the program when a copy cannot be allocated: nothing that
 * crosses has a way to go on without the memory. */
static void nish_cross_oom(void) {
  nish_panic_claim();
  (void)!write(2, "nish: out of memory\n", 20);
  nish_fatal_exit();
}

static void *nish_cross_block(uint64_t size) {
  void *b = size <= (uint64_t)SIZE_MAX ? malloc((size_t)size) : 0;
  if (!b) nish_cross_oom();
  return b;
}

/* Whether `p` was bumped since `mark`: one walk of the chunks, for a single
 * value. */
static int nish_since(uint64_t mark, uintptr_t p) {
  for (const nish_xchunk *c = (const nish_xchunk *)nish_arena.chunks; c; c = c->next) {
    uintptr_t base = (uintptr_t)(c + 1), end = base + c->cap;
    int marked = mark >= base && mark <= end;
    if (p >= (marked ? (uintptr_t)mark : base) && p < end) return 1;
    if (marked) return 0;
  }
  return 0;
}

/* The bytes `v` takes, rounded to 8: a string's header, bytes and NUL, or an
 * array's header and elements. */
static uint64_t nish_cross_size(const void *v, uint64_t esize) {
  uint64_t n = esize ? sizeof(nish_array) + ((const nish_array *)v)->len * esize
                     : 8 + ((const nish_str *)v)->len + 1;
  return (n + 7) & ~(uint64_t)7;
}

/* `v` copied to `at`, flat (an array's elements follow its header). */
static void nish_cross_put(char *at, const void *v, uint64_t esize) {
  if (esize == 0) {
    memcpy(at, v, (size_t)(8 + ((const nish_str *)v)->len + 1));
  } else {
    const nish_array *a = (const nish_array *)v;
    nish_array *c = (nish_array *)at;
    c->len = c->cap = a->len;
    c->data = (char *)(c + 1);
    if (a->len) memcpy(c->data, a->data, (size_t)(a->len * esize));
  }
}

/* `n` bytes after a chunk header, so the block can become a chunk of the arena
 * that takes it: runtime.c's `nish_free_until` frees it as it frees one
 * `nish_arena_grow` made. */
static nish_xchunk *nish_cross_chunk(uint64_t n) {
  nish_xchunk *c = (nish_xchunk *)nish_cross_block(sizeof *c + n);
  c->cap = n;
  return c;
}

/* Links the block `c` into this thread's arena as its newest chunk, and bumps
 * from it, full to its `cap`. A chunk grown here would
 * sit in the same place, so a release, a keep and a reset treat these as they
 * treat it: whatever rewinds the arena past this point frees them. */
static void nish_cross_link(nish_xchunk *c) {
  c->next = (nish_xchunk *)nish_arena.chunks;
  nish_arena = (struct nish_arena){(char *)(c + 1), c->cap, c->cap, c};
}

/* `v` in a block of its own, tagged. */
static void *nish_cross_copy(const void *v, uint64_t esize) {
  nish_xchunk *c = nish_cross_chunk(nish_cross_size(v, esize));
  nish_cross_put((char *)(c + 1), v, esize);
  return (void *)((uintptr_t)(c + 1) | 1);
}

void *nish_cross_out(void *v, uint64_t esize, uint64_t mark) {
  return v && nish_since(mark, (uintptr_t)v) ? nish_cross_copy(v, esize) : v;
}

void *nish_cross_send(void *s) { return nish_cross_copy(s, 0); }

/* The transfer state of the chunk this thread is running
 * (`nish_cross_begin`): the list its blocks go on, the block being filled and
 * how much of it is, and the state it hides, which `nish_cross_end` restores
 * -- a map nested in a chunk's body runs its own chunks inside it. A map's
 * sequential path begins with no list, which hides the outer state without
 * pushing one, so its elements are not packed into the outer chunk's block. */
typedef struct nish_xfer {
  void **list;
  nish_xchunk *block;
  uint64_t off;
  struct nish_xfer *prev;
} nish_xfer;
_Static_assert(sizeof(nish_xfer) == (sizeof(void *) == 8 ? 32 : 24),
               "src/emit-parallel.ts allocas the state as { i8*, i8*, i64, i8* }");
static NISH_TLS nish_xfer *nish_xfer_top;

void nish_cross_begin(void *state, void **list) {
  nish_xfer *x = (nish_xfer *)state;
  *x = (nish_xfer){list, 0, 0, nish_xfer_top};
  nish_xfer_top = list ? x : 0;
}

/* The block being filled records how much of it is, as its `cap`, so the
 * join reads what each chunk kept and an adopted block is full where it ends. */
void nish_cross_end(void *state) {
  nish_xfer *x = (nish_xfer *)state;
  if (x->block) x->block->cap = x->off;
  nish_xfer_top = x->prev;
}

/* `nish_arena_release(mark)` for an element's rewind, but keeping the newest
 * chunk when the body grew it past `mark`'s: a mark at the end of a full chunk
 * would otherwise have every element's body malloc a fresh chunk and its
 * release free it again. Only a 64 KB one is kept, emptied, in front of
 * `mark`'s chunk, with those between freed; an older mark still finds its own
 * chunk below it, and what `mark`'s chunk had left is given up once. A mark
 * in no chunk below the newest leaves the arena as it was, as the release
 * does. */
static void nish_rewind(uint64_t mark) {
  struct nish_arena *a = &nish_arena;
  nish_xchunk *top = a->chunks;
  char *buf = (char *)(top + 1);
  if (mark && top && top->cap == 65536 && mark - (uintptr_t)buf > 65536) {
    a->chunks = top->next;
    nish_arena_release(mark);
    if (a->buf != buf) {
      top->next = a->chunks;
      *a = (struct nish_arena){ buf, 0, 65536, top };
    } else
      a->chunks = top;
    return;
  }
  nish_arena_release(mark);
}

/* A map's or a `parallelFrom`'s element, kept as its chunk loop rewinds the
 * arena to `mark`, the bump position before the body was called: everything
 * else the body bumped is dead once it has answered, so a chunk holds one
 * element's temporaries at a time rather than all of its elements'. A value
 * made since `mark` is copied, in a chunk of a divided region, to the end of
 * the chunk's transfer block -- a new one, pushed on the region's list when it
 * does not fit, of 4 KB doubling to 64 KB or of the value's size, so what a
 * chunk leaves unused is bounded by what it keeps -- and is answered there;
 * the caller adopts the blocks at the join (`nish_cross_adopt`). On a map's
 * sequential path, where no state is pushed, it goes out to a block of its own
 * and back in below `mark`. One made before `mark` is answered as it is. */
void *nish_cross_keep(void *v, uint64_t esize, uint64_t mark) {
  nish_xfer *x = nish_xfer_top;
  if (v && nish_since(mark, (uintptr_t)v)) {
    if (!x) {
      v = nish_cross_copy(v, esize);
    } else {
      uint64_t n = nish_cross_size(v, esize);
      if (!x->block || x->block->cap - x->off < n) {
        uint64_t want = x->block && x->block->cap < 32768 ? x->block->cap * 2 : x->block ? 65536 : 4096;
        x->block = nish_cross_chunk(n > want ? n : want);
        x->block->next = __atomic_exchange_n((nish_xchunk **)x->list, x->block, __ATOMIC_RELAXED);
        x->off = 0;
      }
      char *at = (char *)(x->block + 1) + x->off;
      x->off += n;
      nish_cross_put(at, v, esize);
      v = at;
    }
  }
  nish_rewind(mark);
  return nish_cross_in(v, esize);
}

/* A value of 64 KB or more that does not fit what is left of the current
 * chunk is adopted rather than copied: `nish_arena_grow` would have made a
 * chunk of exactly its size for the copy, and the block is that chunk
 * already. A smaller one is copied, so a run of small values never makes a
 * chunk each, which a release would walk. */
void *nish_cross_in(void *p, uint64_t esize) {
  if (!((uintptr_t)p & 1)) return p;
  void *v = (void *)((uintptr_t)p & ~(uintptr_t)1);
  nish_xchunk *c = (nish_xchunk *)v - 1;
  uint64_t n = c->cap;
  if (n >= 65536 && n > nish_arena.cap - nish_arena.off) {
    nish_cross_link(c);
    return v;
  }
  char *r = (char *)nish_alloc_struct(n);
  nish_cross_put(r, v, esize);
  free(c);
  return r;
}

/* Once every chunk is done, on the thread that called the region, with `dst`
 * the array the region wrote. When the blocks the chunks filled hold 64 KB or
 * more, they become the newest chunks of its arena (`nish_cross_link`), so
 * the elements in them stay where they are, and the cost is one link per
 * block rather than a copy per element. Less is copied, element by element,
 * into the arena and the blocks freed, as `nish_cross_in` copies a small
 * value: an adopted block leaves the arena's current chunk behind, and a
 * region run in a loop would leave one per run. */
void nish_cross_adopt(void *list, void *dst, uint64_t esize) {
  nish_xchunk *first = (nish_xchunk *)list, *c, *next;
  uint64_t kept = 0;
  for (c = first; c; c = c->next) kept += c->cap;
  if (kept >= 65536) {
    for (c = first; c; c = next) {
      next = c->next;
      nish_cross_link(c);
    }
    return;
  }
  if (!first) return;
  nish_array *a = (nish_array *)dst;
  void **e = (void **)a->data;
  for (uint64_t i = 0; i < a->len; i++) {
    for (c = first; c; c = c->next) {
      if ((uintptr_t)e[i] - (uintptr_t)(c + 1) < c->cap) {
        char *r = (char *)nish_alloc_struct(nish_cross_size(e[i], esize));
        nish_cross_put(r, e[i], esize);
        e[i] = r;
        break;
      }
    }
  }
  for (c = first; c; c = next) {
    next = c->next;
    free(c);
  }
}

/* ---- A string a guard stores ----
 *
 * `g.value = s` keeps `s` in memory the `Mutex` owns, since the task that
 * stores it may have made it in its arena: `nish_guard_keep` copies it into a
 * block of its own and answers the copy, and frees `old`, the string the slot
 * held, when it is a copy made here; `g.value = null` into a `string | null`
 * slot frees that copy and keeps nothing. A read that keeps the string past the
 * lock's block copies it into the reader's arena (the compiler calls
 * `nish_str_new`), so nothing outside the lock points at a block, and the
 * next store frees it. The copies are recorded in one set, `nish_kept`, which
 * is how `old` is told apart from the string `new Mutex` was given or a
 * literal: those are never freed. A block still held when its `Mutex` is
 * dropped stays allocated until the process ends -- one per string slot of
 * the `Mutex`, not one per store. The set is one for the process, behind one
 * lock of its own, since two `Mutex`es are locked by two tasks at once; it is
 * taken only by a store, so stores through two different guards wait on each
 * other for the moment it is held. The set holds each block's header, the
 * pointer `malloc` answered, so a leak checker counts a block a dropped `Mutex`
 * left as reachable rather than as possibly lost. */
static struct {
#ifdef NISH_CROSS_LOCKED
  pthread_mutex_t mu;
#endif
  uintptr_t *slots; /* open addressing; 0 empty, 1 a removed entry */
  uint64_t cap, used;
} nish_kept = {
#ifdef NISH_CROSS_LOCKED
  PTHREAD_MUTEX_INITIALIZER,
#endif
  0, 0, 0};

static uint64_t nish_kept_at(uintptr_t p) { return (uint64_t)((p >> 3) * 0x9E3779B97F4A7C15ull); }

static void nish_kept_put(uintptr_t p) {
  if ((nish_kept.used + 1) * 2 > nish_kept.cap) {
    uintptr_t *old = nish_kept.slots;
    uint64_t n = nish_kept.cap;
    nish_kept.cap = n ? n * 2 : 64;
    nish_kept.slots = (uintptr_t *)calloc((size_t)nish_kept.cap, sizeof(uintptr_t));
    if (!nish_kept.slots) nish_cross_oom();
    nish_kept.used = 0;
    for (uint64_t i = 0; i < n; i++)
      if (old[i] > 1) nish_kept_put(old[i]);
    free(old);
  }
  uint64_t i = nish_kept_at(p) & (nish_kept.cap - 1);
  while (nish_kept.slots[i] > 1) i = (i + 1) & (nish_kept.cap - 1);
  if (nish_kept.slots[i] == 0) nish_kept.used++;
  nish_kept.slots[i] = p;
}

/* Whether `p` is in the set, taking it out when it is. */
static int nish_kept_take(uintptr_t p) {
  if (!nish_kept.cap) return 0;
  uint64_t i = nish_kept_at(p) & (nish_kept.cap - 1);
  for (; nish_kept.slots[i] != 0; i = (i + 1) & (nish_kept.cap - 1)) {
    if (nish_kept.slots[i] == p) {
      nish_kept.slots[i] = 1;
      return 1;
    }
  }
  return 0;
}

/* `old` is null when the slot is a `string | null` that held none, and `s`
 * is null for a `null` stored into one: the slot's copy is freed and nothing
 * is kept in its place, so the store answers null. */
void *nish_guard_keep(void *old, const void *s) {
  void *b = s ? (void *)((uintptr_t)nish_cross_copy(s, 0) & ~(uintptr_t)1) : 0;
#ifdef NISH_CROSS_LOCKED
  pthread_mutex_lock(&nish_kept.mu);
#endif
  int mine = old && nish_kept_take((uintptr_t)((nish_xchunk *)old - 1));
  if (b) nish_kept_put((uintptr_t)((nish_xchunk *)b - 1));
#ifdef NISH_CROSS_LOCKED
  pthread_mutex_unlock(&nish_kept.mu);
#endif
  if (mine) free((nish_xchunk *)old - 1);
  return b;
}
