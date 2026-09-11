/* Nish runtime for the freestanding wasm profile (WP8): the arena and the
 * array cold paths, without libc. Link it next to the module when a function
 * takes or returns an array:
 *   scripts/build.sh x.ll runtime/runtime_wasm.c -o x.wasm --profile wasm
 *
 * Linear memory past `__heap_base` (the linker's end-of-data symbol) is one
 * arena chunk that grows with `memory.grow`; there is no chunk list because
 * wasm memory never shrinks. Field widths follow the IR contract
 * (`%struct.nish_arena = type { i8*, i64, i64, i8* }`), not size_t: wasm32
 * pointers are 4 bytes, and the inlined fast path in every compiled function
 * bumps the 64-bit `off` field directly. Panics are `unreachable` (a JS
 * RuntimeError); there is no stderr to write a message to. Strings and I/O
 * need a WASI runtime and are not provided here, so `--emit-dts` lists
 * string functions as not exported. */
#include <stddef.h>
#include <stdint.h>

struct nish_arena { char *buf; uint64_t off; uint64_t cap; void *chunks; };
struct nish_arena nish_arena;

_Static_assert(sizeof(struct nish_arena) == 32, "arena layout is ABI: runtime.ts, nish.h");
_Static_assert(offsetof(struct nish_arena, off) == 8, "the inlined allocator bumps field 1");
_Static_assert(offsetof(struct nish_arena, cap) == 16, "the inlined allocator reads field 2");
_Static_assert(offsetof(struct nish_arena, chunks) == 24, "arena layout is ABI");

extern unsigned char __heap_base;
#define NISH_PAGE ((uint64_t)65536)

/* Slow path of the inlined allocator (`size` is already 8-byte rounded). */
void *nish_arena_grow(uint64_t size) {
  if (!nish_arena.buf) {
    uintptr_t base = ((uintptr_t)&__heap_base + 7) & ~(uintptr_t)7;
    nish_arena.buf = (char *)base;
    nish_arena.cap = (uint64_t)__builtin_wasm_memory_size(0) * NISH_PAGE - base;
  }
  uint64_t need = nish_arena.off + size;
  if (need > nish_arena.cap) {
    uint64_t pages = (need - nish_arena.cap + NISH_PAGE - 1) / NISH_PAGE;
    if (__builtin_wasm_memory_grow(0, (uintptr_t)pages) == (uintptr_t)-1) __builtin_trap();
    nish_arena.cap += pages * NISH_PAGE;
  }
  void *p = nish_arena.buf + nish_arena.off;
  nish_arena.off = need;
  return p;
}

void *nish_alloc_struct(uint64_t size) {
  size = (size + 7) & ~(uint64_t)7;
  if (nish_arena.buf && nish_arena.off + size <= nish_arena.cap) {
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

nish_array *nish_alloc_array(uint64_t elem_size, uint64_t len) {
  nish_array *a = (nish_array *)nish_alloc_struct(sizeof *a);
  a->len = a->cap = len;
  a->data = (char *)nish_alloc_struct(len * elem_size);
  return a;
}

void nish_array_grow(nish_array *a, uint64_t elem_size) {
  uint64_t cap = a->cap ? a->cap * 2 : 4;
  char *data = (char *)nish_alloc_struct(cap * elem_size);
  if (a->len) __builtin_memcpy(data, a->data, (uintptr_t)(a->len * elem_size)); /* memory.copy (-mbulk-memory) */
  a->data = data;
  a->cap = cap;
}

/* ---- Panics: `unreachable`, which the host sees as a RuntimeError */
void nish_panic_index(uint64_t idx, uint64_t len) { (void)idx; (void)len; __builtin_trap(); }
void nish_panic_div(_Bool by_zero) { (void)by_zero; __builtin_trap(); }
void nish_exit(int32_t code) { (void)code; __builtin_trap(); }
