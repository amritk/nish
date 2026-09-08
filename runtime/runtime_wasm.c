/* AmritScript runtime for the freestanding wasm profile (WP8): the arena and the
 * array cold paths, without libc. Link it next to the module when a function
 * takes or returns an array:
 *   scripts/build.sh x.ll runtime/runtime_wasm.c -o x.wasm --profile wasm
 *
 * Linear memory past `__heap_base` (the linker's end-of-data symbol) is one
 * arena chunk that grows with `memory.grow`; there is no chunk list because
 * wasm memory never shrinks. Field widths follow the IR contract
 * (`%struct.sts_arena = type { i8*, i64, i64, i8* }`), not size_t: wasm32
 * pointers are 4 bytes, and the inlined fast path in every compiled function
 * bumps the 64-bit `off` field directly. Panics are `unreachable` (a JS
 * RuntimeError); there is no stderr to write a message to. Strings and I/O
 * need a WASI runtime and are not provided here, so `--emit-dts` lists
 * string functions as not exported. */
#include <stdint.h>

struct sts_arena { char *buf; uint64_t off; uint64_t cap; void *chunks; };
struct sts_arena sts_arena;

extern unsigned char __heap_base;
#define STS_PAGE ((uint64_t)65536)

/* Slow path of the inlined allocator (`size` is already 8-byte rounded). */
void *sts_arena_grow(uint64_t size) {
  if (!sts_arena.buf) {
    uintptr_t base = ((uintptr_t)&__heap_base + 7) & ~(uintptr_t)7;
    sts_arena.buf = (char *)base;
    sts_arena.cap = (uint64_t)__builtin_wasm_memory_size(0) * STS_PAGE - base;
  }
  uint64_t need = sts_arena.off + size;
  if (need > sts_arena.cap) {
    uint64_t pages = (need - sts_arena.cap + STS_PAGE - 1) / STS_PAGE;
    if (__builtin_wasm_memory_grow(0, (uintptr_t)pages) == (uintptr_t)-1) __builtin_trap();
    sts_arena.cap += pages * STS_PAGE;
  }
  void *p = sts_arena.buf + sts_arena.off;
  sts_arena.off = need;
  return p;
}

void *sts_alloc_struct(uint64_t size) {
  size = (size + 7) & ~(uint64_t)7;
  if (sts_arena.buf && sts_arena.off + size <= sts_arena.cap) {
    void *p = sts_arena.buf + sts_arena.off;
    sts_arena.off += size;
    return p;
  }
  return sts_arena_grow(size);
}

void sts_reset_arena(void) { sts_arena.off = 0; }
void sts_free_arena(void) { sts_arena.off = 0; } /* memory cannot be returned */
uint64_t sts_arena_used(void) { return sts_arena.off; }
uint64_t sts_arena_mark(void) { return sts_arena.buf ? (uint64_t)(uintptr_t)(sts_arena.buf + sts_arena.off) : 0; }
void sts_arena_release(uint64_t mark) { sts_arena.off = mark ? mark - (uintptr_t)sts_arena.buf : 0; }

/* ---- Arrays: %struct.sts_array = type { i64, i64, i8* } */
typedef struct sts_array { uint64_t len; uint64_t cap; char *data; } sts_array;

sts_array *sts_alloc_array(uint64_t elem_size, uint64_t len) {
  sts_array *a = (sts_array *)sts_alloc_struct(sizeof *a);
  a->len = a->cap = len;
  a->data = (char *)sts_alloc_struct(len * elem_size);
  return a;
}

void sts_array_grow(sts_array *a, uint64_t elem_size) {
  uint64_t cap = a->cap ? a->cap * 2 : 4;
  char *data = (char *)sts_alloc_struct(cap * elem_size);
  if (a->len) __builtin_memcpy(data, a->data, (uintptr_t)(a->len * elem_size)); /* memory.copy (-mbulk-memory) */
  a->data = data;
  a->cap = cap;
}

/* ---- Panics: `unreachable`, which the host sees as a RuntimeError */
void sts_panic_index(uint64_t idx, uint64_t len) { (void)idx; (void)len; __builtin_trap(); }
void sts_panic_div(_Bool by_zero) { (void)by_zero; __builtin_trap(); }
void sts_exit(int32_t code) { (void)code; __builtin_trap(); }
