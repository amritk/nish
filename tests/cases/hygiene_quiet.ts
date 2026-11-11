// src/hygiene.ts refuses only what cannot be meant. Each line here is the
// spelling that says "on purpose", and the program compiles and runs.
export const main = (): i32 => {
  // A name that starts with `_` is never reported unread.
  const _ignored: i32 = 7;
  let turns: i32 = 0;
  for (const _item of [1, 2, 3]) {
    turns++;
  }
  // `x !== x` is the NaN test and `x - x` the finite test on a float.
  const zero: f64 = toF64(0);
  const nan: f64 = zero / zero;
  const isNan = nan !== nan;
  const finite = zero - zero === zero;
  // A copy under a second name is compared on purpose.
  const big: u32 = 4000000000;
  const again: u32 = big;
  // An unsigned value against a bound other than zero, and a signed one against zero.
  const small = big > toU32(1);
  const signed: i32 = -1;
  console.log(`${turns} ${isNan} ${finite} ${big >= again} ${small} ${signed < 0}`);
  return 0;
};
