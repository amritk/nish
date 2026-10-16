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
 * copied into its arena and its block freed, so every block is freed by the
 * one `cross_in` its value meets. Arena blocks, literals and the copies here
 * are all 8-aligned, which is what keeps the low bit free for the tag.
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
  _exit(1);
}

static void *nish_cross_block(uint64_t size) {
  void *b = size <= (uint64_t)SIZE_MAX ? malloc((size_t)size) : 0;
  if (!b) nish_cross_oom();
  return b;
}

/* What of this thread's arena was bumped since `mark`: the chunks are newest
 * first, so each one before the chunk that holds `mark` is new from its base,
 * and that one from `mark`. The spans go into `out[2i]`, `out[2i+1]` (start,
 * end) and their count is answered; `cap` 0 only counts them. */
static int64_t nish_arena_spans(uint64_t mark, uintptr_t *out, int64_t cap) {
  int64_t n = 0;
  for (const nish_xchunk *c = (const nish_xchunk *)nish_arena.chunks; c; c = c->next, n++) {
    uintptr_t base = (uintptr_t)(c + 1), end = base + c->cap;
    int marked = mark >= base && mark <= end;
    if (n < cap) {
      out[2 * n] = marked ? (uintptr_t)mark : base;
      out[2 * n + 1] = end;
    }
    if (marked) return n + 1;
  }
  return n;
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

/* Whether `p` lies in one of `n` spans sorted by start: a binary search, so a
 * map's range of slots costs one walk of the chunks and a log per slot. A
 * walk per slot was quadratic in the size of a map's result, its chunks being
 * 64 KB. */
static int nish_in_spans(const uintptr_t *sp, int64_t n, uintptr_t p) {
  int64_t lo = 0, hi = n;
  while (lo < hi) {
    int64_t mid = (lo + hi) / 2;
    if (sp[2 * mid] <= p) lo = mid + 1; else hi = mid;
  }
  return lo > 0 && p < sp[2 * lo - 1];
}

static int nish_span_cmp(const void *a, const void *b) {
  uintptr_t x = *(const uintptr_t *)a, y = *(const uintptr_t *)b;
  return (x > y) - (x < y);
}

/* The spans since `mark`, sorted by start, in a block the caller frees. */
static uintptr_t *nish_sorted_spans(uint64_t mark, int64_t *n) {
  *n = nish_arena_spans(mark, 0, 0);
  uintptr_t *sp = (uintptr_t *)nish_cross_block((uint64_t)(*n ? *n : 1) * 2 * sizeof(uintptr_t));
  nish_arena_spans(mark, sp, *n);
  qsort(sp, (size_t)*n, 2 * sizeof(uintptr_t), nish_span_cmp);
  return sp;
}

/* `v` in a block of its own, tagged. */
static void *nish_cross_copy(const void *v, uint64_t esize) {
  void *b;
  if (esize == 0) {
    const nish_str *s = (const nish_str *)v;
    b = nish_cross_block(8 + s->len + 1);
    memcpy(b, s, (size_t)(8 + s->len + 1));
  } else {
    const nish_array *a = (const nish_array *)v;
    nish_array *c = (nish_array *)nish_cross_block(sizeof *c + a->len * esize);
    c->len = c->cap = a->len;
    c->data = (char *)(c + 1);
    if (a->len) memcpy(c->data, a->data, (size_t)(a->len * esize));
    b = c;
  }
  return (void *)((uintptr_t)b | 1);
}

void *nish_cross_out(void *v, uint64_t esize, uint64_t mark) {
  return v && nish_since(mark, (uintptr_t)v) ? nish_cross_copy(v, esize) : v;
}

void *nish_cross_send(void *s) { return nish_cross_copy(s, 0); }

void *nish_cross_in(void *p, uint64_t esize) {
  if (!((uintptr_t)p & 1)) return p;
  void *b = (void *)((uintptr_t)p & ~(uintptr_t)1);
  void *r;
  if (esize == 0) {
    const nish_str *s = (const nish_str *)b;
    r = nish_str_new(s->data, s->len);
  } else {
    const nish_array *a = (const nish_array *)b;
    nish_array *c = nish_alloc_array(esize, a->len);
    if (a->len) memcpy(c->data, a->data, (size_t)(a->len * esize));
    r = c;
  }
  free(b);
  return r;
}

/* A chunk's slots of `dst`, `[lo, hi)`, out; and, once every chunk is done,
 * the first `n` in. Each slot holds a pointer. */
void nish_cross_out_range(nish_array *dst, int64_t lo, int64_t hi, uint64_t esize, uint64_t mark) {
  void **d = (void **)dst->data;
  int64_t n;
  uintptr_t *sp = nish_sorted_spans(mark, &n);
  for (int64_t i = lo; i < hi; i++)
    if (d[i] && nish_in_spans(sp, n, (uintptr_t)d[i])) d[i] = nish_cross_copy(d[i], esize);
  free(sp);
}

void nish_cross_in_range(nish_array *dst, int64_t n, uint64_t esize) {
  void **d = (void **)dst->data;
  for (int64_t i = 0; i < n; i++) d[i] = nish_cross_in(d[i], esize);
}

/* ---- A string a guard stores ----
 *
 * `g.value = s` keeps `s` in memory the `Mutex` owns, since the task that
 * stores it may have made it in its arena: `nish_guard_keep` copies it into a
 * block of its own and answers the copy, and frees `old`, the string the slot
 * held, when it is a copy made here. A read that keeps the string past the
 * lock's block copies it into the reader's arena (the compiler calls
 * `nish_str_new`), so nothing outside the lock points at a block, and the
 * next store frees it. The copies are recorded in one set, `nish_kept`, which
 * is how `old` is told apart from the string `new Mutex` was given or a
 * literal: those are never freed. A block still held when its `Mutex` is
 * dropped stays allocated until the process ends -- one per string slot of
 * the `Mutex`, not one per store. The set is one for the process, behind one
 * lock of its own, since two `Mutex`es are locked by two tasks at once; it is
 * taken only by a store, so stores through two different guards wait on each
 * other for the moment it is held. */
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

/* `old` is null when the slot is a `string | null` that held none. */
void *nish_guard_keep(void *old, const void *s) {
  const nish_str *str = (const nish_str *)s;
  void *b = nish_cross_block(8 + str->len + 1);
  memcpy(b, str, (size_t)(8 + str->len + 1));
#ifdef NISH_CROSS_LOCKED
  pthread_mutex_lock(&nish_kept.mu);
#endif
  int mine = old && nish_kept_take((uintptr_t)old);
  nish_kept_put((uintptr_t)b);
#ifdef NISH_CROSS_LOCKED
  pthread_mutex_unlock(&nish_kept.mu);
#endif
  if (mine) free(old);
  return b;
}
