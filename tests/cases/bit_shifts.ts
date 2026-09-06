// The three shifts with a count the compiler cannot see: `shl`, `ashr`
// (sign-filling) and `lshr` (zero-filling). Each is preceded by the `and` that
// masks the count to 31, so `x << 32` wraps to `x << 0` as it does in
// JavaScript instead of being LLVM poison.
function shiftLeft(a: i32, n: i32): i32 {
  return a << n;
}

function shiftRight(a: i32, n: i32): i32 {
  return a >> n;
}

function shiftRightUnsigned(a: i32, n: i32): i32 {
  return a >>> n;
}

function test(): number {
  return shiftLeft(1, 4) + shiftRight(-16, 2) + shiftRightUnsigned(-1, 28) + shiftLeft(7, 32);
}
