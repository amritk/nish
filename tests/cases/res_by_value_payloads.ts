// Every payload shape a by-value `Result` has to carry (WP17). `f32` is a
// `bitcast` in and out, not a conversion, so the bits the callee stored are
// the bits the caller reads; `boolean`, `u8` and `u16` are a `zext` in and a
// `trunc` out, and the two arms narrow separately because their LLVM types
// differ. The two constructions are also the two slots of the private ABI
// (WP15 §7b): the ok arm fills index 1 and the error arm index 2, each leaving
// the other `undef`.
function scale(x: f32): Result<f32, boolean> {
  if (x < 0) {
    return Err(true);
  }
  return Ok(x * toF32(2));
}

function narrow(n: i32): Result<u8, u16> {
  if (n > 255) {
    return Err(toU16(1000));
  }
  return Ok(toU8(n));
}

export function main(): i32 {
  console.log(scale(toF32(1.5)).unwrapOr(toF32(-1)));
  console.log(scale(toF32(-1)).unwrapOr(toF32(-1)));

  const small = narrow(200);
  if (small.isOk()) {
    console.log(small.value);
  }
  const big = narrow(300);
  if (big.isErr()) {
    console.log(big.error);
  }
  return 0;
}
