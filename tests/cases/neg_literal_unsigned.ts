// A negated literal at an unsigned type (spelled `-(n)`, since `-n` there is
// refused) folds to the constant the old `sub` produced: the negation wraps
// and is written back at the type's width, so `u8` `-(1)` is `i8 -1`, 255.
export function main(): number {
  const a: u8 = -(1);
  const b: u16 = -(2);
  const c: u32 = -(0x80000000);
  const d: u64 = -(1);
  console.log(`${a} ${b} ${c} ${d}`);
  return 0;
}
