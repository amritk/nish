// Checked signed arithmetic, the lowering: a sum, a difference, a product and
// a negation nothing bounds each become `llvm.s*.with.overflow` and a branch on
// its flag. Every failed check in a function branches to the one `ovf.fail`
// block at its end, whose `phi` names the operator for the message — one call
// to `nish_panic_overflow` per function rather than one per operation, so a
// small function stays small enough to inline. `u32` arithmetic is defined as
// wrapping and is neither flagged nor checked.
export const mix = (a: i32, b: i32, c: i64): i64 => {
  const sum = a + b;
  const diff = a - b;
  const product = toI64(sum * diff);
  return -(product * c);
};

export const wraps = (a: u32, b: u32): u32 => a * b + a - b;

export const test = (): number => toI32(mix(7, 3, toI64(2))) + toI32(wraps(3, 2));
