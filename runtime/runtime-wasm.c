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

void nish_reset_arena(void) { nish_arena.off = 0; }
void nish_free_arena(void) { nish_arena.off = 0; } /* memory cannot be returned */
uint64_t nish_arena_used(void) { return nish_arena.off; }
uint64_t nish_arena_mark(void) { return nish_arena.buf ? (uint64_t)(uintptr_t)(nish_arena.buf + nish_arena.off) : 0; }
void nish_arena_release(uint64_t mark) { nish_arena.off = mark ? mark - (uintptr_t)nish_arena.buf : 0; }

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
