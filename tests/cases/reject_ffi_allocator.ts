// Every allocation is the arena's or the runtime's, and the escape
// analysis reasons about both. `arena()` takes no backing store, so memory
// from C cannot be made into an allocator the program then trusts.
declare function malloc(n: u64): CPtr;

export const main = (): i32 => {
  const p = malloc(4096);
  using a = arena(p);
  return 0;
};
