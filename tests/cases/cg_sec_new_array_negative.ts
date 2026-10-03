// A negative `i32` length in `new Array<T>(n)` became a byte count past 2^63,
// and the inline allocator's `off + size` wrapped on it: the bump "fit", moved
// the arena offset backwards, and the memset then wrote until the process
// faulted. The allocator now asks whether the size fits in the room left, so
// the request reaches `nish_arena_grow`, which fails it as out of memory
// before anything is written (docs/security/codegen.md, CG-2).
// `cg_sec_new_array_negative.c` runs each in a child and prints its status.
export const bytes = (): i32 => {
  const n: i32 = parseInt("-1");
  const a: u8[] = new Array<u8>(n);
  return a.length;
};

export const doubles = (): i32 => {
  const n: i32 = parseInt("-3");
  const a: f64[] = new Array<f64>(n);
  return a.length;
};

export const test = (): i32 => {
  const a: u8[] = new Array<u8>(parseInt("5"));
  return a.length;
};
