// A negative length is refused before anything is allocated. `n` is an
// `i32`, or a ranged integer whose range reaches below zero, so it
// sign-extends to a byte count past 2^63; the inline allocator's rounding
// wrapped on it, the bump "fit", and the zero fill wrote until the process
// faulted. Now the length check panics with `array length out of range`.
// `cg_sec_new_array_negative.c` runs each refused length in a child process.
// docs/security/codegen.md, CG-2.
const bytes = (n: i32): u8[] => new Array<u8>(n);

const ranged = (n: integer<-4, 4>): u8[] => new Array<u8>(n);

const counts = (n: integer<0, 4>): i32[] => new Array<i32>(n);

export const negativeI32 = (): i32 => toI32(bytes(toI32(parseInt("-1"))).length);

export const negativeRanged = (): i32 => toI32(ranged(-3).length);

export const test = (): i32 => {
  const a = bytes(toI32(parseInt("5")));
  const b = ranged(4);
  const c = counts(3);
  const d = bytes(0);
  return toI32(a.length * 1000 + b.length * 100 + c.length * 10 + d.length);
};
