// WP27 S2: the opaque pointer. `calloc`, `realloc` and `free` come from libc,
// so this golden is also a link test.
//
// Four things are pinned here and each is a rule rather than a detail:
//
//   - A `CPtr` comes *out* of a foreign call and goes back *into* one. It is
//     `i8*` in the IR and the compiler makes no other claim about it.
//   - `null` arrives only from C: a foreign function may return `CPtr | null`
//     and may not take one, so a pointer is narrowed with `!== null` before it
//     is handed back.
//   - The declarations carry no attributes at all, and the caller pays: `main`
//     keeps only `nounwind` while `doubled`, which calls no C, keeps
//     `willreturn readnone`.
//   - The arena is untouched by any of it. The `console.log` below allocates
//     and the scope releases as it always did, because nothing this compiler
//     allocated ever crossed the boundary.
declare function calloc(count: u64, size: u64): CPtr | null;
declare function realloc(block: CPtr, size: u64): CPtr | null;
declare function free(block: CPtr): void;

const doubled = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  const first = calloc(4, 16);
  if (first === null) {
    return 1;
  }
  const grown = realloc(first, 256);
  if (grown === null) {
    free(first);
    return 2;
  }
  free(grown);
  console.log(`${doubled(21)}`);
  return 0;
};
