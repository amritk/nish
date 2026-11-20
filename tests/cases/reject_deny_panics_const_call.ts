// --deny-panics reads a `const` as its value only when its initialiser is a
// literal or a conversion of one: a call it does not fold is unknown.
const pick = (): u64 => toU64(0);
export const rem = (a: u64, b: u64): u64 => {
  const zero = pick();
  return b === zero ? a : a % b;
};
