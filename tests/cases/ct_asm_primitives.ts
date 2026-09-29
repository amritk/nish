// WP34 N6: the constant-time builtins alone, one exported function per builtin
// and width so the assembly check in tests/run.js reads each under its own
// symbol. Every argument is secret, and none of them may reach a branch.
// ct-check: selectU32 secret=mask,a,b
// ct-check: selectU64 secret=mask,a,b
// ct-check: eqU32 secret=a,b
// ct-check: eqU64 secret=a,b
// ct-check: pickU32 secret=a,b,x,y
// ct-check: pickU64 secret=a,b,x,y
// ct-check: maxU32 secret=a,b
export const selectU32 = (mask: u32, a: u32, b: u32): u32 => ctSelect(mask, a, b);
export const selectU64 = (mask: u64, a: u64, b: u64): u64 => ctSelect(mask, a, b);
export const eqU32 = (a: u32, b: u32): u32 => ctEq(a, b);
export const eqU64 = (a: u64, b: u64): u64 => ctEq(a, b);

// The shape the barrier exists for: an equality mask straight into a select.
// Without it LLVM folds the pair into one `select` on `a === b`, which it may
// then lower to a branch.
export const pickU32 = (a: u32, b: u32, x: u32, y: u32): u32 => ctSelect(ctEq(a, b), x, y);
export const pickU64 = (a: u64, b: u64, x: u64, y: u64): u64 => ctSelect(ctEq(a, b), x, y);

// A select on a mask the program computes itself: all-ones when `a < b`, from
// the borrow of `a - b`, with no compare the optimiser could branch on.
export const maxU32 = (a: u32, b: u32): u32 => {
  const borrow: u32 = ((a ^ ((a ^ b) | ((a - b) ^ b))) >>> 31);
  return ctSelect(toU32(0) - borrow, b, a);
};
