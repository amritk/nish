// WP27 §7e: a `class CPtr` is legal and simply unreachable by that name, the
// way a `class Int32Array` already was (`CPTR_NAME` in `src/types.ts`) — so one
// program can hold both the declared class and the foreign pointer, and under
// `-g` each has to get its own DWARF.
//
// It did not. Both compilers cache a type's metadata under the name
// `typeToString` / `TypeTable.typeName` gives it, and that name is `CPtr` for
// both, so whichever was described first answered for the other: declared
// first, and `raw` below became a `%struct.CPtr*`, which is a debugger reading
// `n` out of memory `malloc` returned. The foreign pointer is memoised apart
// from the name-keyed cache now, and the golden pins the two apart: `count` is
// a pointer to the composite, `raw` the `void *`.
class CPtr {
  n: i32;

  constructor(n: i32) {
    this.n = n;
  }
}

declare function malloc(size: u64): CPtr | null;
declare function free(block: CPtr): void;

export const test = (): number => {
  const count = new CPtr(7);
  const raw = malloc(16);
  if (raw === null) {
    return 0;
  }
  free(raw);
  return count.n;
};
