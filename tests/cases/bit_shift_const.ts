// A constant count is masked at compile time and emitted as the masked
// literal, so none of these functions contains an `and`: `a << 33` is
// `shl i32 %a, 1` and `a << -1` is `shl i32 %a, 31`, both of which is what
// JavaScript's 5-bit mask computes.
function byThree(a: i32): i32 {
  return a << 3;
}

function byThirtyTwo(a: i32): i32 {
  return a << 32;
}

function byThirtyThree(a: i32): i32 {
  return a << 33;
}

function byMinusOne(a: i32): i32 {
  return a << -1;
}

function test(): number {
  return byThree(1) + byThirtyTwo(7) + byThirtyThree(1) + byMinusOne(1);
}
