// `~x` lowers to `xor x, -1` at both widths; LLVM has no `not` instruction and
// the all-ones constant is spelled `-1` for `i32` and `i64` alike.
const invert32 = (a: i32): i32 => {
  return ~a;
};

const invert64 = (a: i64): i64 => {
  return ~a;
};

export const test = (): number => {
  return invert32(0) + invert32(5) + toI32(invert64(-1));
};
