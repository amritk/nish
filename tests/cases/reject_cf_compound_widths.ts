// A compound assignment takes the target's exact type on both sides: an `i32`
// added into an `i64` is still a conversion and has to be written as one
// (`total += toI64(step)`). The message names `+=` and not `+`, which is the
// half of this rule stage1 used to get wrong.
export function main(): i32 {
  let total: i64 = 0;
  const step: i32 = 2;
  total += step;
  return toI32(total);
}
