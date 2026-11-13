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
 * forgets the freed blocks as it does for the thread's arena.
 *
 * **Adopting** a region gives its chunks to the current arena instead of
 * freeing them, then retires the handle as `free` does: `awaitAll` runs each
 * call that waits in a region of its own, and adopts it when the call
 * finishes, so the answer stays readable and is freed with the caller's
 * memory (docs/security/async.md, ASYNC-14). A child region, or a region with
 * children, is never a lane's, and adopting one panics: its chunks would
 * outlive the tree `free` walks (ASYNC-19).
 *
 * **Children.** `nish_region_child_new` makes a region whose parent is the
 * region entered last on this thread (`child` and `childWith`), and panics
 * when none is. A slot links its parent and its children through slot indices
 * (index + 1, 0 for none): a parent, its first child, and the previous and
 * next sibling, four 32-bit links, so a slot is 96 bytes (80 before
 * children). Making a child, and unlinking one as `free` does, are O(1);
 * `free` of a parent first walks its whole subtree, once, to panic before
 * freeing anything if any region in it is entered, then frees it deepest
 * first -- each region's chunks and then its handle, so every copy of a
 * child's handle is stale afterwards, as the parent's is -- O(1) a region. A
 * child is always on its parent's thread, and the links are only read and
 * written by that thread, so they take no lock. */

#include <stddef.h>
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

/* runtime.c's `nish_chunk`, which `nish_region_adopt` links through and
   carves: the same three facts runtime.c asserts of it. Bit 0 of `cap` marks a
   carved chunk, as runtime.c's NISH_CHUNK_CARVED. */
typedef struct nish_chunk_link { struct nish_chunk_link *next; uint64_t cap; } nish_chunk_link;
_Static_assert(sizeof(nish_chunk_link) == 16, "runtime.c's nish_chunk: { next, cap }, the bytes after it");
_Static_assert(offsetof(nish_chunk_link, next) == 0, "runtime.c's nish_chunk: next first");
_Static_assert(offsetof(nish_chunk_link, cap) == 8, "runtime.c's nish_chunk: cap second");
#define NISH_CHUNK_CARVED 1

/* The least a caller's chunk must have left for `nish_region_adopt` to carve
   it into a chunk of its own: below it the bytes are given up, so an adopt
   leaves at most this much behind. */
#define NISH_ADOPT_CARVE 256

typedef struct nish_region_slot {
  struct nish_arena arena; /* the region's arena, or, while entered, the one it displaced */
  uint64_t gen;            /* the live handle's generation; NISH_REGION_GEN_END once retired */
  uint64_t thread;         /* the thread that made it, 0 while the slot is free */
  uint64_t chunk;          /* the region's next chunk size, or, while entered, the displaced one */
  uint64_t outer;          /* while entered: the handle entered before it; while free: the next free slot + 1 */
  void *root;              /* what `leave` recorded, answered by `enter` */
  uint64_t entered;
  uint32_t parent;         /* the parent's index + 1, or 0: a region `nish_region_new` made */
  uint32_t first_child;    /* the newest child's index + 1, or 0 */
  uint32_t prev_sibling;   /* the parent's next newer child's index + 1, or 0 */
  uint32_t next_sibling;   /* the parent's next older child's index + 1, or 0 */
} nish_region_slot;
_Static_assert(sizeof(nish_region_slot) == 96, "the slot size the header states");

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
  NISH_REGION_NO_PARENT,
  NISH_REGION_ADOPT_TREE,
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
  NISH_REGION_MSG("nish: a child region made with no region entered"),
  NISH_REGION_MSG("nish: adopt of a region with a parent or children"),
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

/* The slot whose index + 1 is `link`, which is not 0. */
static nish_region_slot *nish_region_at(uint32_t link) {
  uint64_t index = (uint64_t)link - 1;
  return &nish_region_pages[index / NISH_REGION_PAGE][index % NISH_REGION_PAGE];
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
    /* Each panic lets go of the lock first: an atexit handler, or another
       thread while the exit is on its way, may still make or free a region
       (docs/security/runtime.md, RT-46). */
    if (nish_region_used == NISH_REGION_SLOTS) {
      nish_region_unlock();
      nish_region_die(NISH_REGION_FULL);
    }
    /* The slot is counted once its page is there: a failed page leaves the
       count as it was (RT-46). */
    index = nish_region_used;
    nish_region_slot **page = &nish_region_pages[index / NISH_REGION_PAGE];
    if (!*page) {
      nish_region_slot *p = calloc(NISH_REGION_PAGE, sizeof *p);
      if (!p) {
        nish_region_unlock();
        nish_region_die(NISH_REGION_OOM);
      }
      __atomic_store_n(page, p, __ATOMIC_RELEASE);
    }
    nish_region_used = index + 1;
    s = &(*page)[index % NISH_REGION_PAGE];
    __atomic_store_n(&s->gen, 1, __ATOMIC_RELAXED);
  }
  s->chunk = 8;
  s->outer = 0;
  s->parent = 0;
  s->first_child = 0;
  s->prev_sibling = 0;
  s->next_sibling = 0;
  __atomic_store_n(&s->thread, me, __ATOMIC_RELAXED);
  uint64_t r = s->gen << NISH_REGION_SLOT_BITS | index;
  nish_region_unlock();
  return r;
}

uint64_t nish_region_child_new(void) {
  uint64_t p = nish_region_current;
  if (!p) nish_region_die(NISH_REGION_NO_PARENT);
  nish_region_slot *parent = nish_region_slot_of(p);
  uint64_t r = nish_region_new();
  nish_region_slot *s = nish_region_slot_of(r);
  uint32_t link = (uint32_t)(r & (NISH_REGION_SLOTS - 1)) + 1;
  s->parent = (uint32_t)(p & (NISH_REGION_SLOTS - 1)) + 1;
  s->next_sibling = parent->first_child;
  if (parent->first_child) nish_region_at(parent->first_child)->prev_sibling = link;
  parent->first_child = link;
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

/* Give the slot back: its generation moves on, so every copy of `r` is
   stale, and the slot joins the free list unless that generation is the last.
   The slot's arena is already empty. */
static void nish_region_retire(nish_region_slot *s, uint64_t index) {
  s->root = 0;
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

/* Take the slot out of its parent's child list. */
static void nish_region_unlink(nish_region_slot *s) {
  if (!s->parent) return;
  if (s->prev_sibling) nish_region_at(s->prev_sibling)->next_sibling = s->next_sibling;
  else nish_region_at(s->parent)->first_child = s->next_sibling;
  if (s->next_sibling) nish_region_at(s->next_sibling)->prev_sibling = s->prev_sibling;
  s->parent = 0;
  s->prev_sibling = 0;
  s->next_sibling = 0;
}

/* The region after `s` in a walk of the subtree under `top` that visits a
   region before its children (first child, else next sibling, else the next
   sibling of the nearest ancestor below `top` that has one), or 0 at the end. */
static nish_region_slot *nish_region_next_in(nish_region_slot *s, nish_region_slot *top) {
  if (s->first_child) return nish_region_at(s->first_child);
  while (s != top) {
    if (s->next_sibling) return nish_region_at(s->next_sibling);
    s = nish_region_at(s->parent);
  }
  return 0;
}

void nish_region_free(uint64_t r) {
  nish_region_slot *top = nish_region_slot_of(r);
  /* Nothing is freed unless nothing in the tree is entered. */
  for (nish_region_slot *s = top; s; s = nish_region_next_in(s, top))
    if (s->entered) nish_region_die(NISH_REGION_FREE_ENTERED);
  nish_region_unlink(top);
  nish_region_slot *s = top;
  for (;;) {
    while (s->first_child) s = nish_region_at(s->first_child);
    /* A leaf: free it, then go on from its parent, which may now be one. */
    nish_region_slot *up = s == top ? 0 : nish_region_at(s->parent);
    uint64_t index = s == top ? (r & (NISH_REGION_SLOTS - 1)) : (uint64_t)up->first_child - 1;
    nish_region_unlink(s);
    nish_region_swap(s);
    nish_free_arena();
    nish_region_swap(s);
    nish_region_retire(s, index);
    if (!up) return;
    s = up;
  }
}

/* The most a recycled region keeps: a bigger chunk is given back, so a task
   that once allocated a lot does not leave its node holding onto it
   (docs/security/async.md, ASYNC-20). */
#define NISH_REGION_KEEP ((uint64_t)16 << 10)

/* A finished task's region, emptied for its node's next task: what
   `nish_region_free` would do, except that the slot and the newest chunk
   malloc made, up to NISH_REGION_KEEP, are kept, so a task that fits in it
   costs no malloc, no free and no trip through the slot free list. The
   generation moves on as at a free, so every copy of `r` is stale; the new
   handle is the answer. The kept chunk's bytes are not cleared: compiled
   code writes every byte it reads (`new` zero-fills, arrays fill to their
   length, strings are written whole), as it does in the chunks malloc hands
   back after a free. A region with a parent or children, or on its last
   generation, is freed instead, and the answer is 0. Panics on an entered
   region, as `free` does. Under ASAN nothing is kept. */
uint64_t nish_region_recycle(uint64_t r) {
  nish_region_slot *s = nish_region_slot_of(r);
  uint64_t gen = s->gen + 1;
  if (s->entered || s->parent || s->first_child || gen >= NISH_REGION_GEN_END) {
    nish_region_free(r);
    return 0;
  }
  nish_region_swap(s);
  nish_reset_arena();
  nish_chunk_link *keep = (nish_chunk_link *)nish_arena.chunks;
  if (keep && keep->cap > NISH_REGION_KEEP) {
    nish_free_arena();
    keep = 0;
  }
  nish_region_swap(s);
  /* The chunks go on doubling from the kept one, as if it had just grown. */
  s->chunk = keep ? keep->cap * 2 : 8;
  s->root = 0;
  __atomic_store_n(&s->gen, gen, __ATOMIC_RELAXED);
  return gen << NISH_REGION_SLOT_BITS | (r & (NISH_REGION_SLOTS - 1));
}

/* An `awaitAll` lane's region, once the lane has finished: its chunks go on
   top of the arena in `nish_arena`, newest first as there, so what the lane
   answered lives on in the arena that awaited it and is given back when that
   arena next releases below them. What the caller's current chunk had left is
   then carved into a chunk of its own, on top of the region's, and bumping
   goes on there: the caller's chunk is not buried under the region's, which
   would leave its rest unused and make the caller's next allocation grow a
   fresh 64 KiB chunk -- a chunk per adopt in a loop that never releases
   (docs/security/async.md, ASYNC-15). The carved chunk has no malloc of its
   own, and bit 0 of its `cap` says so, so `nish_free_until` passes it by; it
   always sits above the chunk it was carved from, so whatever frees that one
   has dropped it first. Less than NISH_ADOPT_CARVE left is given up. The
   next-chunk size (`nish_region_chunk`) is not touched: it is the caller's,
   which a region only swaps while entered. A newest chunk the lane released
   back to empty is freed, not moved, so a lane's temporaries do not outlive
   it. A region that never allocated moves nothing. Like `free`, it panics on
   a region that is entered. */
void nish_region_adopt(uint64_t r) {
  nish_region_slot *s = nish_region_slot_of(r);
  if (s->entered) nish_region_die(NISH_REGION_FREE_ENTERED);
  if (s->parent || s->first_child) nish_region_die(NISH_REGION_ADOPT_TREE);
  nish_chunk_link *head = s->arena.chunks;
  if (head && s->arena.off == 0) {
    /* The lane rewound its newest chunk to empty: a release to the mark it
       took on entry, 0 in an empty region, keeps that chunk for reuse
       (`nish_reset_arena`), but nothing will bump it again once adopted. */
    nish_chunk_link *next = head->next;
    if (!(head->cap & NISH_CHUNK_CARVED)) free(head);
    head = next;
    uint64_t cap = head ? head->cap & ~(uint64_t)NISH_CHUNK_CARVED : 0;
    s->arena = head ? (struct nish_arena){ (char *)(head + 1), cap, cap, (void *)head } : (struct nish_arena){ 0 };
  }
  if (head) {
    nish_chunk_link *last = head;
    while (last->next) last = last->next;
    struct nish_arena caller = nish_arena;
    uint64_t left = caller.buf ? caller.cap - caller.off : 0;
    last->next = caller.chunks;
    nish_arena = s->arena;
    if (left >= NISH_ADOPT_CARVE) {
      nish_chunk_link *c = (nish_chunk_link *)(caller.buf + caller.off);
      uint64_t cap = left - sizeof *c;
      c->next = nish_arena.chunks;
      c->cap = cap | NISH_CHUNK_CARVED;
      nish_arena = (struct nish_arena){ (char *)(c + 1), 0, cap, (void *)c };
    }
  }
  s->arena = (struct nish_arena){ 0 };
  nish_region_retire(s, r & (NISH_REGION_SLOTS - 1));
}
