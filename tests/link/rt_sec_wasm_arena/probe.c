/* What runtime/runtime-wasm.c answers when a request cannot fit wasm32's
   address space. Each probe returns 1 when the runtime handed back memory it
   does not have, which on a sound runtime none of them reaches: the call traps
   first. `probe_array_max` is the one that must return: it asks for the
   longest array there may be. docs/security/runtime.md, RT-7;
   docs/security/codegen.md, CG-9. */
#include <stdint.h>

typedef struct nish_array { uint64_t len; uint64_t cap; char *data; } nish_array;
extern struct { char *buf; uint64_t off; uint64_t cap; void *chunks; } nish_arena;
void *nish_alloc_struct(uint64_t size);
nish_array *nish_alloc_array(uint64_t elem_size, uint64_t len);
void nish_array_grow(nish_array *a, uint64_t elem_size);

/* `off + size` wraps 2^64 to 0: the old fast path took that for "fits", moved
   the offset back to 0, and the next block landed on the first. */
int probe_wrap(void) {
  char *first = nish_alloc_struct(8);
  nish_alloc_struct((uint64_t)0 - 8);
  return (char *)nish_alloc_struct(8) == first;
}

/* A request whose page count is exactly 2^32 truncated to the `memory.grow(0)`
   that always succeeds, and the arena claimed 2^48 bytes it never had. */
int probe_truncate(void) {
  nish_alloc_struct(8);
  nish_alloc_struct(((uint64_t)1 << 48) + nish_arena.cap - nish_arena.off);
  return nish_arena.cap > ((uint64_t)1 << 32);
}

/* 2^61 eight-byte elements is 2^64 bytes, which wrapped to an empty block
   behind a header that claimed all of them. */
int probe_array(void) { return nish_alloc_array(8, (uint64_t)1 << 61)->len != 0; }

/* Exactly 2^31 - 1 elements is the longest array there may be, and is handed
   back: 1 here, a trap against a limit one too low. Zero-byte elements, so
   the length is all the probe asks for and it allocates nothing more. */
int probe_array_max(void) { return nish_alloc_array(0, 2147483647u)->len == 2147483647u; }

/* A full array of 2^31 - 1 elements grew past them, so an i32-mode `length`
   read back negative (docs/security/codegen.md, K1-6, which runtime.c had and
   this file did not). Zero-byte elements, so the probe allocates nothing. */
int probe_grow(void) {
  nish_array a = {2147483647u, 2147483647u, 0};
  nish_array_grow(&a, 0);
  return a.cap > 2147483647u;
}
