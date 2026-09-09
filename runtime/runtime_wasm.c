/* AmritScript runtime for the freestanding wasm profile (WP8): the arena and the
 * array cold paths, without libc. Link it next to the module when a function
 * takes or returns an array:
 *   scripts/build.sh x.ll runtime/runtime_wasm.c -o x.wasm --profile wasm
 *
 * Linear memory past `__heap_base` (the linker's end-of-data symbol) is one
 * arena chunk that grows with `memory.grow`; there is no chunk list because
 * wasm memory never shrinks. Field widths follow the IR contract
 * (`%struct.amrit_arena = type { i8*, i64, i64, i8* }`), not size_t: wasm32
 * pointers are 4 bytes, and the inlined fast path in every compiled function
 * bumps the 64-bit `off` field directly. Panics are `unreachable` (a JS
 * RuntimeError); there is no stderr to write a message to. Strings and I/O
 * need a WASI runtime and are not provided here, so `--emit-dts` lists
 * string functions as not exported. */
#include <stddef.h>
#include <stdint.h>

struct amrit_arena { char *buf; uint64_t off; uint64_t cap; void *chunks; };
struct amrit_arena amrit_arena;

_Static_assert(sizeof(struct amrit_arena) == 32, "arena layout is ABI: runtime.ts, amritc.h");
_Static_assert(offsetof(struct amrit_arena, off) == 8, "the inlined allocator bumps field 1");
_Static_assert(offsetof(struct amrit_arena, cap) == 16, "the inlined allocator reads field 2");
_Static_assert(offsetof(struct amrit_arena, chunks) == 24, "arena layout is ABI");

extern unsigned char __heap_base;
#define AMRIT_PAGE ((uint64_t)65536)

/* Slow path of the inlined allocator (`size` is already 8-byte rounded). */
void *amrit_arena_grow(uint64_t size) {
  if (!amrit_arena.buf) {
    uintptr_t base = ((uintptr_t)&__heap_base + 7) & ~(uintptr_t)7;
    amrit_arena.buf = (char *)base;
    amrit_arena.cap = (uint64_t)__builtin_wasm_memory_size(0) * AMRIT_PAGE - base;
  }
  uint64_t need = amrit_arena.off + size;
  if (need > amrit_arena.cap) {
    uint64_t pages = (need - amrit_arena.cap + AMRIT_PAGE - 1) / AMRIT_PAGE;
    if (__builtin_wasm_memory_grow(0, (uintptr_t)pages) == (uintptr_t)-1) __builtin_trap();
    amrit_arena.cap += pages * AMRIT_PAGE;
  }
  void *p = amrit_arena.buf + amrit_arena.off;
  amrit_arena.off = need;
  return p;
}

void *amrit_alloc_struct(uint64_t size) {
  size = (size + 7) & ~(uint64_t)7;
  if (amrit_arena.buf && amrit_arena.off + size <= amrit_arena.cap) {
    void *p = amrit_arena.buf + amrit_arena.off;
    amrit_arena.off += size;
    return p;
  }
  return amrit_arena_grow(size);
}

void amrit_reset_arena(void) { amrit_arena.off = 0; }
void amrit_free_arena(void) { amrit_arena.off = 0; } /* memory cannot be returned */
uint64_t amrit_arena_used(void) { return amrit_arena.off; }
uint64_t amrit_arena_mark(void) { return amrit_arena.buf ? (uint64_t)(uintptr_t)(amrit_arena.buf + amrit_arena.off) : 0; }
void amrit_arena_release(uint64_t mark) { amrit_arena.off = mark ? mark - (uintptr_t)amrit_arena.buf : 0; }

/* ---- Arrays: %struct.amrit_array = type { i64, i64, i8* } */
typedef struct amrit_array { uint64_t len; uint64_t cap; char *data; } amrit_array;

amrit_array *amrit_alloc_array(uint64_t elem_size, uint64_t len) {
  amrit_array *a = (amrit_array *)amrit_alloc_struct(sizeof *a);
  a->len = a->cap = len;
  a->data = (char *)amrit_alloc_struct(len * elem_size);
  return a;
}

void amrit_array_grow(amrit_array *a, uint64_t elem_size) {
  uint64_t cap = a->cap ? a->cap * 2 : 4;
  char *data = (char *)amrit_alloc_struct(cap * elem_size);
  if (a->len) __builtin_memcpy(data, a->data, (uintptr_t)(a->len * elem_size)); /* memory.copy (-mbulk-memory) */
  a->data = data;
  a->cap = cap;
}

/* ---- Panics: `unreachable`, which the host sees as a RuntimeError */
void amrit_panic_index(uint64_t idx, uint64_t len) { (void)idx; (void)len; __builtin_trap(); }
void amrit_panic_div(_Bool by_zero) { (void)by_zero; __builtin_trap(); }
void amrit_exit(int32_t code) { (void)code; __builtin_trap(); }
