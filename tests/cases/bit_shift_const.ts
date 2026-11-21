// A constant count is masked at compile time and emitted as the masked
// literal, so none of these functions contains an `and`: `a << 33` is
// `shl i32 %a, 1` and `a << -1` is `shl i32 %a, 31`, both of which is what
// JavaScript's 5-bit mask computes.
const byThree = (a: i32): i32 => {
  return a << 3;
};

const byThirtyTwo = (a: i32): i32 => {
  return a << 32;
};

const byThirtyThree = (a: i32): i32 => {
  return a << 33;
};

const byMinusOne = (a: i32): i32 => {
  return a << -1;
};

export const test = (): number => {
  return byThree(1) + byThirtyTwo(7) + byThirtyThree(1) + byMinusOne(1);
};
