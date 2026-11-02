/* Nish runtime, the region half: arenas a program makes, enters, leaves and
 * frees one at a time, so a long-running program can give back the memory of
 * one session, one cache entry or one connection without a garbage collector
 * (docs/wp46-long-running-memory.md, section 2.1, "Runtime and ABI").
 *
 * A translation unit of its own, paired with runtime.c in scripts/build.sh's
 * `halves` and src/run-cache.ts's `runtimeUnits()` like the others, so it has
 * its own measured `.text*` ceiling in tests/runtime-budgets.js and a program
 * that never makes a region links none of it. The wasm profile has no malloc
 * to give a region its chunks, so `scripts/build.sh --profile wasm` refuses IR
 * that names `@nish_region_`; the wasi profile links this file.
 *
 * **A handle is a number.** `nish_region_new` answers an `i64`: the slot's
 * index in the low 24 bits and the slot's generation in the 40 above them.
 * Generations start at 1, so 0 -- what a fresh `Region<T>[]` holds -- is never
 * a handle. `nish_region_free` moves the slot's generation on, so a copy of a
 * freed handle is stale; a slot whose generation would pass 40 bits is
 * retired rather than reused, so no handle ever names a slot twice. Every
 * call that takes a handle checks it first and panics on a zero handle, a
 * stale one, and one made on another thread. The 24-bit index caps a process
 * at 16,777,216 live regions; `nish_region_new` past that panics.
 *
 * **The table** is one per process: a directory of pages, each page 1,024
 * slots allocated (zeroed) the first time a slot in it is handed out, so a
 * program that makes ten regions holds one page. Taking a slot and giving one
 * back take the table's lock, once per `new` and once per `free`; `enter` and
 * `leave` take none, because a slot is only ever entered by the thread that
 * made it and the check reads the two fields another thread's `free` could
 * write (generation and thread) with atomic loads. Only a threads build
 * (`-DNISH_THREADS`) has a second thread to lock against, so only it pays for
 * the lock.
 *
 * **Entering swaps arenas.** A slot holds a whole `struct nish_arena`.
 * `nish_region_enter` swaps it with the thread's `nish_arena`, so every
 * allocation the program makes until `nish_region_leave` -- the inlined bump
 * as well as the runtime's own -- lands in the region; `leave` swaps them
 * back. While a region is entered its slot holds the arena it displaced, so
 * entering a second region inside the first nests: each leave restores what
 * its enter took. A slot that is entered cannot be entered again (it would
 * swap its own arena with itself) or freed, and `leave` must name the region
 * entered last on this thread.
 *
 * **Chunk size.** A thread's own arena grows by 64 KiB chunks, which is right
 * for one arena a thread and wrong for a hundred thousand of them. A region's
 * first chunk is the size of its first allocation, and each later chunk
 * doubles, or takes the allocation's own size when that is more. The size of
 * the next chunk is runtime.c's thread-local `nish_region_chunk`, which
 * `nish_arena_grow` reads on its slow path and which `enter` and `leave` swap
 * with the slot's as they swap the arena; 0 there means the thread's own
 * arena and the 64 KiB floor. A region starts it at 8, the smallest block.
 *
 * **The root.** `Region<T>` is only the number, so the slot keeps the root
 * object `region`'s function answered: `nish_region_leave` records it and
 * `nish_region_enter` answers it.
 *
 * Freeing a region frees its chunks through runtime.c's `nish_free_arena`,
 * with the region's arena swapped in for the call, so an `-DNISH_ASAN` build
 * forgets the freed blocks as it does for the thread's arena. */

#include <stdint.h>
#include <stdlib.h>

#include "nish.h"

#define NISH_COLD __attribute__((noreturn, cold, noinline))

/* runtime.c's: the size of the next chunk `nish_arena_grow` makes for the
   arena in `nish_arena`, or 0 for a thread's own, which takes 64 KiB. */
extern NISH_TLS uint64_t nish_region_chunk;

#define NISH_REGION_SLOT_BITS 24
#define NISH_REGION_SLOTS ((uint64_t)1 << NISH_REGION_SLOT_BITS)
#define NISH_REGION_GEN_END ((uint64_t)1 << 40)
#define NISH_REGION_PAGE 1024

typedef struct nish_region_slot {
  struct nish_arena arena; /* the region's arena, or, while entered, the one it displaced */
  uint64_t gen;            /* the live handle's generation; NISH_REGION_GEN_END once retired */
  uint64_t thread;         /* the thread that made it, 0 while the slot is free */
  uint64_t chunk;          /* the region's next chunk size, or, while entered, the displaced one */
  uint64_t outer;          /* while entered: the handle entered before it; while free: the next free slot + 1 */
  void *root;              /* what `leave` recorded, answered by `enter` */
  uint64_t entered;
} nish_region_slot;

static nish_region_slot *nish_region_pages[NISH_REGION_SLOTS / NISH_REGION_PAGE];
static uint64_t nish_region_used; /* slots ever handed out: the next never-used index */
static uint64_t nish_region_free_list; /* a free slot's index + 1, or 0 */
/* The handle entered last on this thread, or 0. */
static NISH_TLS uint64_t nish_region_current;

#ifdef NISH_THREADS
static int nish_region_lock_word;
static uint64_t nish_region_threads;
static NISH_TLS uint64_t nish_region_thread_id;
static void nish_region_lock(void) {
  while (__atomic_exchange_n(&nish_region_lock_word, 1, __ATOMIC_ACQUIRE))
    while (__atomic_load_n(&nish_region_lock_word, __ATOMIC_RELAXED)) {}
}
static void nish_region_unlock(void) { __atomic_store_n(&nish_region_lock_word, 0, __ATOMIC_RELEASE); }
/* A number no other thread of the process has: 64 bits, so it never wraps
   back onto a live thread's. */
static uint64_t nish_region_me(void) {
  if (!nish_region_thread_id) nish_region_thread_id = __atomic_add_fetch(&nish_region_threads, 1, __ATOMIC_RELAXED);
  return nish_region_thread_id;
}
#else
static void nish_region_lock(void) {}
static void nish_region_unlock(void) {}
static uint64_t nish_region_me(void) { return 1; }
#endif

/* The panics, by number: one cold function and one table, rather than a
   message's address loaded at each call site. Each ends in `nish_panic`, so
   only the first panic of a process prints and atexit handlers run. */
enum {
  NISH_REGION_ZERO,
  NISH_REGION_STALE,
  NISH_REGION_THREAD,
  NISH_REGION_ENTERED,
  NISH_REGION_FREE_ENTERED,
  NISH_REGION_LEAVE,
  NISH_REGION_FULL,
  NISH_REGION_OOM,
};
#define NISH_REGION_MSG(text) { sizeof text - 1, text }
static const struct { uint64_t len; char data[72]; } nish_region_messages[] = {
  NISH_REGION_MSG("nish: a zero region handle: no region was made for it"),
  NISH_REGION_MSG("nish: a stale region handle: the region was freed"),
  NISH_REGION_MSG("nish: a region handle made on another thread"),
  NISH_REGION_MSG("nish: enter of a region that is already entered"),
  NISH_REGION_MSG("nish: free of a region that is entered"),
  NISH_REGION_MSG("nish: leave of a region that is not the one entered last"),
  NISH_REGION_MSG("nish: more than 16777216 live regions"),
  NISH_REGION_MSG("nish: out of memory"),
};
static NISH_COLD void nish_region_die(int why) {
  nish_panic((const nish_str *)&nish_region_messages[why]);
}

/* The slot `r` names, or a panic: zero, stale, another thread's. */
static nish_region_slot *nish_region_slot_of(uint64_t r) {
  if (!r) nish_region_die(NISH_REGION_ZERO);
  uint64_t index = r & (NISH_REGION_SLOTS - 1);
  nish_region_slot *page = __atomic_load_n(&nish_region_pages[index / NISH_REGION_PAGE], __ATOMIC_ACQUIRE);
  if (!page) nish_region_die(NISH_REGION_STALE);
  nish_region_slot *s = &page[index % NISH_REGION_PAGE];
  uint64_t thread = __atomic_load_n(&s->thread, __ATOMIC_RELAXED);
  if (!thread || __atomic_load_n(&s->gen, __ATOMIC_RELAXED) != r >> NISH_REGION_SLOT_BITS)
    nish_region_die(NISH_REGION_STALE);
  if (thread != nish_region_me()) nish_region_die(NISH_REGION_THREAD);
  return s;
}

/* Swap the slot's arena and chunk size with the thread's: `enter` and `leave`
   both, and `free` around its `nish_free_arena`. */
static void nish_region_swap(nish_region_slot *s) {
  struct nish_arena a = nish_arena;
  nish_arena = s->arena;
  s->arena = a;
  uint64_t c = nish_region_chunk;
  nish_region_chunk = s->chunk;
  s->chunk = c;
}

uint64_t nish_region_new(void) {
  uint64_t me = nish_region_me();
  nish_region_lock();
  uint64_t index;
  nish_region_slot *s;
  if (nish_region_free_list) {
    index = nish_region_free_list - 1;
    s = &nish_region_pages[index / NISH_REGION_PAGE][index % NISH_REGION_PAGE];
    nish_region_free_list = s->outer;
  } else {
    if (nish_region_used == NISH_REGION_SLOTS) nish_region_die(NISH_REGION_FULL);
    index = nish_region_used++;
    nish_region_slot **page = &nish_region_pages[index / NISH_REGION_PAGE];
    if (!*page) {
      nish_region_slot *p = calloc(NISH_REGION_PAGE, sizeof *p);
      if (!p) nish_region_die(NISH_REGION_OOM);
      __atomic_store_n(page, p, __ATOMIC_RELEASE);
    }
    s = &(*page)[index % NISH_REGION_PAGE];
    __atomic_store_n(&s->gen, 1, __ATOMIC_RELAXED);
  }
  s->chunk = 8;
  s->outer = 0;
  __atomic_store_n(&s->thread, me, __ATOMIC_RELAXED);
  uint64_t r = s->gen << NISH_REGION_SLOT_BITS | index;
  nish_region_unlock();
  return r;
}

void *nish_region_enter(uint64_t r) {
  nish_region_slot *s = nish_region_slot_of(r);
  if (s->entered) nish_region_die(NISH_REGION_ENTERED);
  s->entered = 1;
  s->outer = nish_region_current;
  nish_region_current = r;
  nish_region_swap(s);
  return s->root;
}

void nish_region_leave(uint64_t r, void *root) {
  nish_region_slot *s = nish_region_slot_of(r);
  if (nish_region_current != r) nish_region_die(NISH_REGION_LEAVE);
  nish_region_swap(s);
  nish_region_current = s->outer;
  s->entered = 0;
  s->root = root;
}

void nish_region_free(uint64_t r) {
  nish_region_slot *s = nish_region_slot_of(r);
  if (s->entered) nish_region_die(NISH_REGION_FREE_ENTERED);
  nish_region_swap(s);
  nish_free_arena();
  nish_region_swap(s);
  s->root = 0;
  uint64_t index = r & (NISH_REGION_SLOTS - 1);
  nish_region_lock();
  __atomic_store_n(&s->thread, 0, __ATOMIC_RELAXED);
  uint64_t gen = s->gen + 1;
  __atomic_store_n(&s->gen, gen, __ATOMIC_RELAXED);
  if (gen < NISH_REGION_GEN_END) {
    s->outer = nish_region_free_list;
    nish_region_free_list = index + 1;
  }
  nish_region_unlock();
}
