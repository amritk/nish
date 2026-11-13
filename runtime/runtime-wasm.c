/* Nish runtime for the freestanding wasm profile (WP8): the arena and the
 * array cold paths, without libc. Link it next to the module when a function
 * takes or returns an array:
 *   scripts/build.sh x.ll runtime/runtime-wasm.c -o x.wasm --profile wasm
 *
 * Linear memory past `__heap_base` (the linker's end-of-data symbol) is one
 * arena chunk that grows with `memory.grow`; there is no chunk list because
 * wasm memory never shrinks. Field widths follow the IR contract
 * (`%struct.nish_arena = type { i8*, i64, i64, i8* }`), not size_t: wasm32
 * pointers are 4 bytes, and the inlined fast path in every compiled function
 * bumps the 64-bit `off` field directly. Panics are `unreachable` (a JS
 * RuntimeError); there is no stderr to write a message to, so under
 * wasm-host the page is told first (NISH_DIE). Strings are
 * runtime-text.c's, which build.sh links beside this file when the IR builds
 * one; I/O needs a WASI runtime and is not provided. */
#include <stddef.h>
#include <stdint.h>

/* Thread-local storage for the arena (WP20 T0), mirroring runtime.c and
 * nish.h so the three definitions of this macro cannot drift. A wasm module
 * built this way still has exactly one thread: wasm threads need shared memory
 * plus the atomics and bulk-memory features and a worker on the host side, and
 * WP20 §6 defers all of that. The macro is here so that `nish --threads`
 * targeting wasm still links — `_Thread_local` in a non-shared memory is one
 * ordinary block of linear memory — rather than failing over a storage class
 * that means nothing here. */
#ifdef NISH_THREADS
#define NISH_TLS _Thread_local
#else
#define NISH_TLS
#endif

struct nish_arena { char *buf; uint64_t off; uint64_t cap; void *chunks; };
NISH_TLS struct nish_arena nish_arena;

_Static_assert(sizeof(struct nish_arena) == 32, "arena layout is ABI: runtime.ts, nish.h");
_Static_assert(offsetof(struct nish_arena, off) == 8, "the inlined allocator bumps field 1");
_Static_assert(offsetof(struct nish_arena, cap) == 16, "the inlined allocator reads field 2");
_Static_assert(offsetof(struct nish_arena, chunks) == 24, "arena layout is ABI");

/* WP50 stage 3: a module for a page (`scripts/build.sh --profile wasm-host`,
 * which compiles this file with -DNISH_WASM_HOST) reports each panic to the
 * page before it traps, through the import `nish.panic`. `kind` is one of the
 * NISH_PANIC_* below; `site` numbers the call in `<out>.sites.json`, or is -1
 * for a panic the compiler did not tag (one this runtime raises itself);
 * `msg`/`len` are a message's bytes in linear memory (kind panic only) and
 * `a`, `b` its numbers: an index and a length, a slice's start and end (its
 * length in `len`), an arithmetic operator, an exit code. The page's loader
 * formats the message, marks the module dead and throws, so the import does
 * not return; the trap after it is for a page that returns anyway. Without
 * NISH_WASM_HOST (`--profile wasm`) each panic is the bare trap it was. */
#define NISH_PANIC_MESSAGE 0
#define NISH_PANIC_INDEX 1
#define NISH_PANIC_SLICE 2
#define NISH_PANIC_ARITH 3
#define NISH_PANIC_MEMORY 4
#define NISH_PANIC_EXIT 5
#ifdef NISH_WASM_HOST
__attribute__((import_module("nish"), import_name("panic"))) void nish_host_panic(
    int32_t kind, int32_t site, const void *msg, uint32_t len, double a, double b);
#define NISH_DIE(kind, site, msg, len, a, b)              \
  do {                                                    \
    nish_host_panic((kind), (site), (msg), (len), (a), (b)); \
    __builtin_trap();                                     \
  } while (0)
#else
#define NISH_DIE(kind, site, msg, len, a, b) __builtin_trap()
#endif

extern unsigned char __heap_base;
#define NISH_PAGE ((uint64_t)65536)

/* Slow path of the inlined allocator (`size` is already 8-byte rounded).
 *
 * `need` has to fit the 32-bit address space, and is checked before anything
 * is grown (docs/security/runtime.md, RT-7). Without that, an `off + size` that
 * wrapped 2^64 looked small and moved the offset backwards, and a page count
 * past 2^32 truncated to the `uintptr_t` `memory.grow` takes: a request of
 * 2^48 bytes grew nothing, claimed 2^48 bytes of capacity, and the next block
 * landed at `buf + off` reduced mod 2^32, on top of live data. */
void *nish_arena_grow(uint64_t size) {
  if (!nish_arena.buf) {
    uintptr_t base = ((uintptr_t)&__heap_base + 7) & ~(uintptr_t)7;
    nish_arena.buf = (char *)base;
    nish_arena.cap = (uint64_t)__builtin_wasm_memory_size(0) * NISH_PAGE - base;
  }
  uint64_t need = nish_arena.off + size;
  /* Under wasm-host both are "out of memory": the address space, or a
     `--memory` the module was built with, is spent. */
  if (need < size || need > (uintptr_t)-1 - (uintptr_t)nish_arena.buf) NISH_DIE(NISH_PANIC_MEMORY, -1, 0, 0, 0, 0);
  if (need > nish_arena.cap) {
    uint64_t pages = (need - nish_arena.cap + NISH_PAGE - 1) / NISH_PAGE;
    if (__builtin_wasm_memory_grow(0, (uintptr_t)pages) == (uintptr_t)-1) NISH_DIE(NISH_PANIC_MEMORY, -1, 0, 0, 0, 0);
    nish_arena.cap += pages * NISH_PAGE;
  }
  void *p = nish_arena.buf + nish_arena.off;
  nish_arena.off = need;
  return p;
}

/* `size <= cap - off` rather than `off + size <= cap`, which a size near 2^64
   wraps into a yes; a size that rounding wraps to 0 is trapped the same way. */
void *nish_alloc_struct(uint64_t size) {
  if (size > (uint64_t)-8) NISH_DIE(NISH_PANIC_MEMORY, -1, 0, 0, 0, 0);
  size = (size + 7) & ~(uint64_t)7;
  if (nish_arena.buf && size <= nish_arena.cap - nish_arena.off) {
    void *p = nish_arena.buf + nish_arena.off;
    nish_arena.off += size;
    return p;
  }
  return nish_arena_grow(size);
}

#ifdef NISH_WASM_HOST
static void nish_roots_clear(void);
#else
#define nish_roots_clear() ((void)0)
#endif
/* Emptying the arena empties every root first (WP55 §4.2): a root left
   pointing at a released block would be traced into whatever lands there. */
void nish_reset_arena(void) { nish_roots_clear(); nish_arena.off = 0; }
void nish_free_arena(void) { nish_roots_clear(); nish_arena.off = 0; } /* memory cannot be returned */
uint64_t nish_arena_used(void) { return nish_arena.off; }
uint64_t nish_arena_mark(void) { return nish_arena.buf ? (uint64_t)(uintptr_t)(nish_arena.buf + nish_arena.off) : 0; }
void nish_arena_release(uint64_t mark) { nish_arena.off = mark ? mark - (uintptr_t)nish_arena.buf : 0; }
/* The call-site reclaim's keep (wp6-memory.md §2a). The native runtime moves
   `p` down onto the mark; here it always refuses, the answer runtime.c gives
   whenever it is uncertain: `p` stays where it is and nothing is released, so
   it reads and writes no memory and only reclaims less. String code reached
   from wasm (nish/term) calls it; without it the link fails. */
void *nish_arena_keep(uint64_t mark, void *p) { (void)mark; return p; }

/* ---- Arrays: %struct.nish_array = type { i64, i64, i8* } */
typedef struct nish_array { uint64_t len; uint64_t cap; char *data; } nish_array;

/* The length limit runtime.c's `nish_array_grow` and `nish_alloc_array` keep:
   2^31 - 1 elements, so an i32-mode `length` is never negative. Past it the
   wasm runtime traps, as it does for every other failure. */
#define NISH_ARRAY_MAX 2147483647u

nish_array *nish_alloc_array(uint64_t elem_size, uint64_t len) {
  /* With `len` in range, `len * elem_size` cannot wrap for any element
     smaller than 8 GiB, and a product past 4 GiB traps in the grow. */
  if (len > NISH_ARRAY_MAX) NISH_DIE(NISH_PANIC_MEMORY, -1, 0, 0, 0, 0);
  nish_array *a = (nish_array *)nish_alloc_struct(sizeof *a);
  a->len = a->cap = len;
  a->data = (char *)nish_alloc_struct(len * elem_size);
  return a;
}

void nish_array_grow(nish_array *a, uint64_t elem_size) {
  uint64_t cap = a->cap ? a->cap * 2 : 4;
  if (cap > NISH_ARRAY_MAX) {
    if (a->len >= NISH_ARRAY_MAX) NISH_DIE(NISH_PANIC_MEMORY, -1, 0, 0, 0, 0);
    cap = NISH_ARRAY_MAX;
  }
  char *data = (char *)nish_alloc_struct(cap * elem_size);
  if (a->len) __builtin_memcpy(data, a->data, (uintptr_t)(a->len * elem_size)); /* memory.copy (-mbulk-memory) */
  a->data = data;
  a->cap = cap;
}

#ifdef NISH_WASM_HOST
/* ---- Root storage (docs/wp55-persistent-root.md §4): keep what the roots
 * reach between export calls, release the rest.
 *
 * The loader of a program with root storage calls `nish_root_keep(mark)`
 * (written by the compiler, src/emit-root.ts) where it would release the
 * call's arena, and that calls `nish_runtime_root_keep` with every root table.
 * The **kept region** is [floor, off): `floor` is the lowest mark a keep has
 * seen, and nothing below it ever moves. While the region is at most
 * `2 * live + 64 KiB` nothing is released. Past that, the graph is traced
 * from the root slots, the blocks it reaches inside the region are slid down
 * to `floor` in address order, every pointer to them is rewritten, and `off`
 * is set past the last; `live` is what was kept. Everything the trace needs
 * is scratch above `off`, which the next allocation reuses.
 *
 * A pointer outside the region (a string constant, memory below `floor`) is
 * followed, so what it reaches is traced too, but it is never moved. The
 * blocks are the compiler's: a string is `8 + len + 1` bytes, an object
 * `sizeof` its struct, an array a 24-byte header and `cap` slots of data,
 * each rounded to 8 as every allocation is. Overlapping and adjacent blocks
 * merge into one extent, so a block reached twice, or through a pointer into
 * its middle, moves once and keeps its shape. Each extent moves down by a
 * multiple of 8, so nothing loses its alignment. */
#define NISH_TRACE_STRUCT 0
#define NISH_TRACE_STRING 1
#define NISH_TRACE_ARRAY 2
#define NISH_TRACE_UNION 3

/* `%nish.trace = type { i32, i32, i32, i32*, i8** }` (src/emit-root.ts). */
typedef struct nish_trace {
  int32_t kind;
  int32_t size;
  int32_t count;
  const int32_t *at;
  const struct nish_trace *const *to;
} nish_trace;

/* `%nish.root = type { i8*, i32, i8* }`: `count` slots, each `desc` or null. */
typedef struct nish_root {
  char **slots;
  int32_t count;
  const nish_trace *desc;
} nish_root;

static const nish_root *const *nish_roots;
static int32_t nish_root_count;
static uint64_t nish_root_floor = (uint64_t)-1;
static uint64_t nish_root_live;

static void nish_roots_clear(void) {
  for (int32_t r = 0; r < nish_root_count; r++) {
    const nish_root *root = nish_roots[r];
    for (int32_t i = 0; i < root->count; i++) root->slots[i] = 0;
  }
  nish_root_floor = (uint64_t)-1;
  nish_root_live = 0;
}

/* Scratch: a bump allocator from the old `off` up, growing memory but never
   `off`, so the call's own blocks below it are untouched. */
static uintptr_t nish_scratch_top;

static void *nish_scratch(uint64_t size) {
  size = (size + 7) & ~(uint64_t)7;
  uint64_t at = nish_scratch_top - (uintptr_t)nish_arena.buf;
  uint64_t need = at + size;
  if (need < size || need > (uintptr_t)-1 - (uintptr_t)nish_arena.buf) NISH_DIE(NISH_PANIC_MEMORY, -1, 0, 0, 0, 0);
  if (need > nish_arena.cap) {
    uint64_t pages = (need - nish_arena.cap + NISH_PAGE - 1) / NISH_PAGE;
    if (__builtin_wasm_memory_grow(0, (uintptr_t)pages) == (uintptr_t)-1) NISH_DIE(NISH_PANIC_MEMORY, -1, 0, 0, 0, 0);
    nish_arena.cap += pages * NISH_PAGE;
  }
  void *p = (void *)nish_scratch_top;
  nish_scratch_top += (uintptr_t)size;
  return p;
}

/* A growable vector of 32-bit words in scratch; a grown vector leaves its
   old copy behind, which costs at most what the vector holds. */
typedef struct { uint32_t *at; uint32_t len; uint32_t cap; } nish_words;

static void nish_words_push(nish_words *v, uint32_t a, uint32_t b) {
  if (v->len + 2 > v->cap) {
    uint32_t cap = v->cap ? v->cap * 2 : 256;
    uint32_t *at = (uint32_t *)nish_scratch((uint64_t)cap * 4);
    if (v->len) __builtin_memcpy(at, v->at, (uintptr_t)v->len * 4);
    v->at = at;
    v->cap = cap;
  }
  v->at[v->len] = a;
  v->at[v->len + 1] = b;
  v->len += 2;
}

/* The trace's state: the region, what it reached and what is left to visit. */
static struct {
  uintptr_t lo, hi;
  nish_words blocks;  /* start, end: a block in the region */
  nish_words slots;   /* address, 0: a slot holding a pointer into the region */
  nish_words work;    /* object, descriptor: left to visit */
  uint32_t *seen;     /* open addressing on (object, descriptor) pairs */
  uint32_t seen_cap, seen_len;
} nish_tr;

static uint32_t nish_seen_hash(uint32_t p, uint32_t d) {
  uint32_t h = (p ^ (d * 0x9e3779b1u)) * 0x85ebca6bu;
  return h ^ (h >> 15);
}

/* Whether (p, d) was new, adding it; the set doubles at half full. */
static int nish_seen_add(uint32_t p, uint32_t d) {
  if (nish_tr.seen_len * 2 >= nish_tr.seen_cap) {
    uint32_t *old = nish_tr.seen;
    uint32_t old_cap = nish_tr.seen_cap;
    nish_tr.seen_cap = old_cap ? old_cap * 2 : 1024;
    nish_tr.seen = (uint32_t *)nish_scratch((uint64_t)nish_tr.seen_cap * 8);
    __builtin_memset(nish_tr.seen, 0, (uintptr_t)nish_tr.seen_cap * 8);
    nish_tr.seen_len = 0;
    for (uint32_t i = 0; i < old_cap; i++)
      if (old[2 * i]) nish_seen_add(old[2 * i], old[2 * i + 1]);
  }
  uint32_t mask = nish_tr.seen_cap - 1;
  for (uint32_t i = nish_seen_hash(p, d) & mask;; i = (i + 1) & mask) {
    if (!nish_tr.seen[2 * i]) {
      nish_tr.seen[2 * i] = p;
      nish_tr.seen[2 * i + 1] = d;
      nish_tr.seen_len++;
      return 1;
    }
    if (nish_tr.seen[2 * i] == p && nish_tr.seen[2 * i + 1] == d) return 0;
  }
}

static int nish_in_region(uintptr_t p) { return p >= nish_tr.lo && p < nish_tr.hi; }

static void nish_block(uintptr_t p, uint64_t size) {
  if (!size || !nish_in_region(p)) return;
  uint64_t end = (uint64_t)p + ((size + 7) & ~(uint64_t)7);
  if (end > nish_tr.hi) end = nish_tr.hi; /* a block is never past `off` */
  nish_words_push(&nish_tr.blocks, (uint32_t)p, (uint32_t)end);
}

/* The pointer slot `s`, which holds an object of descriptor `d` or null. */
static void nish_slot(char **s, const nish_trace *d) {
  uintptr_t p = (uintptr_t)*s;
  if (!p) return;
  if (nish_in_region(p)) nish_words_push(&nish_tr.slots, (uint32_t)(uintptr_t)s, 0);
  if (nish_seen_add((uint32_t)p, (uint32_t)(uintptr_t)d)) nish_words_push(&nish_tr.work, (uint32_t)p, (uint32_t)(uintptr_t)d);
}

static void nish_fields(char *p, const nish_trace *d) {
  for (int32_t i = 0; i < d->count; i++) nish_slot((char **)(p + d->at[i]), d->to[i]);
}

static void nish_visit(char *p, const nish_trace *d) {
  switch (d->kind) {
  case NISH_TRACE_STRING: {
    uint64_t len;
    __builtin_memcpy(&len, p, 8);
    nish_block((uintptr_t)p, 8 + len + 1);
    break;
  }
  case NISH_TRACE_STRUCT:
    nish_block((uintptr_t)p, (uint64_t)d->size);
    nish_fields(p, d);
    break;
  case NISH_TRACE_UNION: {
    int32_t tag;
    __builtin_memcpy(&tag, p, 4);
    for (int32_t i = 0; i < d->count; i++) {
      if (d->at[i] == tag) {
        nish_block((uintptr_t)p, (uint64_t)d->to[i]->size);
        nish_fields(p, d->to[i]);
        break;
      }
    }
    break;
  }
  case NISH_TRACE_ARRAY: {
    nish_array *a = (nish_array *)p;
    nish_block((uintptr_t)p, sizeof *a);
    if (!a->data) break;
    if (nish_in_region((uintptr_t)a->data)) nish_words_push(&nish_tr.slots, (uint32_t)(uintptr_t)&a->data, 0);
    nish_block((uintptr_t)a->data, a->cap * (uint64_t)d->size);
    if (d->count == 1) {
      for (uint64_t i = 0; i < a->len; i++) nish_slot((char **)(a->data + i * (uint64_t)d->size), d->to[0]);
    } else if (d->count == 2) {
      for (uint64_t i = 0; i < a->len; i++) nish_fields(a->data + i * (uint64_t)d->size, d->to[0]);
    }
    break;
  }
  }
}

/* Heapsort of `n` pairs by their first word: no recursion, no scratch. */
static void nish_sift(uint32_t *v, uint32_t at, uint32_t n) {
  for (;;) {
    uint32_t big = at, l = 2 * at + 1, r = l + 1;
    if (l < n && v[2 * l] > v[2 * big]) big = l;
    if (r < n && v[2 * r] > v[2 * big]) big = r;
    if (big == at) return;
    uint32_t a = v[2 * at], b = v[2 * at + 1];
    v[2 * at] = v[2 * big];
    v[2 * at + 1] = v[2 * big + 1];
    v[2 * big] = a;
    v[2 * big + 1] = b;
    at = big;
  }
}

static void nish_sort_pairs(uint32_t *v, uint32_t n) {
  for (uint32_t i = n / 2; i-- > 0;) nish_sift(v, i, n);
  while (n > 1) {
    n--;
    uint32_t a = v[0], b = v[1];
    v[0] = v[2 * n];
    v[1] = v[2 * n + 1];
    v[2 * n] = a;
    v[2 * n + 1] = b;
    nish_sift(v, 0, n);
  }
}

/* Where the region address `p` lands: inside an extent, at its new place;
   in a gap, at the end of the extent before it, which is where the gap's
   bytes went (a pointer past a block's end, as an empty array's data can be). */
static uint32_t nish_moved(const uint32_t *ext, uint32_t n, uint32_t p) {
  uint32_t lo = 0, hi = n; /* the first extent starting after p */
  while (lo < hi) {
    uint32_t mid = (lo + hi) / 2;
    if (ext[3 * mid] <= p) lo = mid + 1;
    else hi = mid;
  }
  if (lo == 0) return (uint32_t)nish_tr.lo;
  const uint32_t *e = ext + 3 * (lo - 1);
  return p < e[1] ? e[2] + (p - e[0]) : e[2] + (e[1] - e[0]);
}

static void nish_root_compact(void) {
  nish_tr.lo = (uintptr_t)nish_arena.buf + (uintptr_t)nish_root_floor;
  nish_tr.hi = (uintptr_t)nish_arena.buf + (uintptr_t)nish_arena.off;
  nish_scratch_top = (nish_tr.hi + 7) & ~(uintptr_t)7;
  nish_tr.blocks.len = nish_tr.blocks.cap = 0;
  nish_tr.slots.len = nish_tr.slots.cap = 0;
  nish_tr.work.len = nish_tr.work.cap = 0;
  nish_tr.seen = 0;
  nish_tr.seen_cap = nish_tr.seen_len = 0;
  for (int32_t r = 0; r < nish_root_count; r++) {
    const nish_root *root = nish_roots[r];
    for (int32_t i = 0; i < root->count; i++) nish_slot(&root->slots[i], root->desc);
  }
  while (nish_tr.work.len) {
    nish_tr.work.len -= 2;
    nish_visit((char *)(uintptr_t)nish_tr.work.at[nish_tr.work.len],
               (const nish_trace *)(uintptr_t)nish_tr.work.at[nish_tr.work.len + 1]);
  }
  /* Blocks into extents (start, end, new start), in place: an extent takes
     three words where its first block took two, so it is written over the
     block list from a copy. */
  uint32_t nb = nish_tr.blocks.len / 2;
  nish_sort_pairs(nish_tr.blocks.at, nb);
  uint32_t *ext = (uint32_t *)nish_scratch((uint64_t)nb * 12 + 12);
  uint32_t ne = 0, to = (uint32_t)nish_tr.lo;
  for (uint32_t i = 0; i < nb; i++) {
    uint32_t start = nish_tr.blocks.at[2 * i], end = nish_tr.blocks.at[2 * i + 1];
    if (ne && start <= ext[3 * (ne - 1) + 1]) {
      uint32_t *e = ext + 3 * (ne - 1);
      if (end > e[1]) {
        to += end - e[1];
        e[1] = end;
      }
      continue;
    }
    ext[3 * ne] = start;
    ext[3 * ne + 1] = end;
    ext[3 * ne + 2] = to;
    to += end - start;
    ne++;
  }
  /* Every slot once: rewriting one twice would move its pointer twice. */
  uint32_t ns = nish_tr.slots.len / 2;
  nish_sort_pairs(nish_tr.slots.at, ns);
  for (uint32_t i = 0; i < ns; i++) {
    uint32_t s = nish_tr.slots.at[2 * i];
    if (i && s == nish_tr.slots.at[2 * (i - 1)]) continue;
    char **slot = (char **)(uintptr_t)s;
    *slot = (char *)(uintptr_t)nish_moved(ext, ne, (uint32_t)(uintptr_t)*slot);
  }
  /* Down, in address order: each extent's new place is at or below its old
     one and above every earlier extent's, so a forward move is safe. */
  for (uint32_t i = 0; i < ne; i++) {
    uint32_t *e = ext + 3 * i;
    if (e[2] != e[0]) __builtin_memmove((char *)(uintptr_t)e[2], (char *)(uintptr_t)e[0], (uintptr_t)(e[1] - e[0]));
  }
  nish_root_live = (uint64_t)(to - (uint32_t)nish_tr.lo);
  nish_arena.off = (uint64_t)((uintptr_t)to - (uintptr_t)nish_arena.buf);
}

/* After an export call that began at `mark`: keep what `roots` reach. */
void nish_runtime_root_keep(uint64_t mark, const nish_root *const *roots, int32_t count) {
  nish_roots = roots;
  nish_root_count = count;
  if (!nish_arena.buf) return;
  uint64_t at = mark ? mark - (uintptr_t)nish_arena.buf : 0;
  if (at < nish_root_floor) nish_root_floor = at;
  if (nish_arena.off - nish_root_floor <= 2 * nish_root_live + NISH_PAGE) return;
  nish_root_compact();
}
#endif

/* ---- Panics: `unreachable`, which the host sees as a RuntimeError; under
 * wasm-host the page hears of each first (NISH_DIE above). */
#ifdef NISH_WASM_HOST
/* The `_at` forms take the site number build.sh rewrote a tagged call to. */
void nish_panic_index_at(int32_t site, uint64_t idx, uint64_t len) {
  NISH_DIE(NISH_PANIC_INDEX, site, 0, 0, (double)idx, (double)len);
}
void nish_panic_slice_at(int32_t site, int64_t s, int64_t e, int64_t len) {
  NISH_DIE(NISH_PANIC_SLICE, site, 0, (uint32_t)len, (double)s, (double)e);
}
void nish_panic_overflow_at(int32_t site, uint32_t op) { NISH_DIE(NISH_PANIC_ARITH, site, 0, 0, (double)op, 0); }
void nish_panic_div_at(int32_t site, _Bool by_zero) { nish_panic_overflow_at(site, 4 + by_zero); }
/* A string is `{ i64 len, bytes[len] }` (runtime.c's nish_str). */
void nish_panic_at(int32_t site, const void *s) {
  const uint64_t *len = (const uint64_t *)s;
  NISH_DIE(NISH_PANIC_MESSAGE, site, (const char *)s + 8, (uint32_t)*len, 0, 0);
}
void nish_panic_index(uint64_t idx, uint64_t len) { nish_panic_index_at(-1, idx, len); }
void nish_panic_slice(int64_t s, int64_t e, int64_t len) { nish_panic_slice_at(-1, s, e, len); }
void nish_panic_div(_Bool by_zero) { nish_panic_div_at(-1, by_zero); }
void nish_panic_overflow(uint32_t op) { nish_panic_overflow_at(-1, op); }
void nish_exit(int32_t code) { NISH_DIE(NISH_PANIC_EXIT, -1, 0, 0, (double)code, 0); }
void nish_panic(const void *s) { nish_panic_at(-1, s); }
#else
void nish_panic_index(uint64_t idx, uint64_t len) { (void)idx; (void)len; __builtin_trap(); }
void nish_panic_slice(int64_t s, int64_t e, int64_t len) { (void)s; (void)e; (void)len; __builtin_trap(); }
void nish_panic_div(_Bool by_zero) { (void)by_zero; __builtin_trap(); }
void nish_panic_overflow(uint32_t op) { (void)op; __builtin_trap(); }
void nish_exit(int32_t code) { (void)code; __builtin_trap(); }
/* A panic's message (`panic`, `expect`, a failed range entry) has no stderr to
 * go to here, so `nish_panic` is the trap. An exported function with a ranged
 * parameter checks it on entry (WP31 §9), so this is what lets such a module
 * link; the loader throws a RangeError before the call reaches it. */
void nish_panic(const void *s) { (void)s; __builtin_trap(); }
#endif
/* ---- Streaming reads (WP44 §9 Q7): the checker refuses `fileOpen`,
 * `fileReadAt`, `fileSize` and `fileClose` on a freestanding wasm32 target
 * (NL2718), but `--profile wasm` links IR compiled for the host, which no
 * check sees. There is no file system to read, so each answers -38 (`ENOSYS`)
 * and the link never fails on their names. The path is `const void *`, as
 * `nish_panic`'s string is: this file has no `nish_str`, and the ABI is the
 * same pointer. tests/run.js's wasm profile section links all four. */
int32_t nish_file_open(const void *path) { (void)path; return -38; }
int32_t nish_file_read_at(int32_t fd, nish_array *buf, int64_t off, int64_t len, int64_t pos) {
  (void)fd; (void)buf; (void)off; (void)len; (void)pos;
  return -38;
}
int64_t nish_file_size(int32_t fd) { (void)fd; return -38; }
int32_t nish_file_close(int32_t fd) { (void)fd; return -38; }

/* Output has nowhere to go either. */
void nish_write(const void *s, int32_t fd, _Bool newline) { (void)s; (void)fd; (void)newline; }

/* ---- Rounding (#943): IR compiled for the host calls these and registers a
 * constructor that passes `nish_round_init` libm's three routines
 * (runtime-simd.c has the native ones). On wasm32 each is the one
 * instruction, f64.floor, f64.ceil or f64.trunc, and there is no CPU to ask.
 * The link is freestanding, so the libm names the constructor takes are
 * defined here too, as the same instructions. */
void nish_round_init(double (*floor_fn)(double), double (*ceil_fn)(double), double (*trunc_fn)(double)) {
  (void)floor_fn;
  (void)ceil_fn;
  (void)trunc_fn;
}
double nish_floor(double x) { return __builtin_floor(x); }
double nish_ceil(double x) { return __builtin_ceil(x); }
double nish_trunc(double x) { return __builtin_trunc(x); }
double floor(double x) { return __builtin_floor(x); }
double ceil(double x) { return __builtin_ceil(x); }
double trunc(double x) { return __builtin_trunc(x); }
