// LLVM writes a `float` constant with the 64-bit hex of the double it equals,
// and requires that double to be exactly a float. So `0.1` as an `f32` is
// `0x3FB99999A0000000` (the double nearest to the float), not the `f64`
// spelling `0x3FB999999999999A` — the golden is what would break silently.
export function tenth(): f32 {
  return 0.1;
}

export function tenthF64(): f64 {
  return 0.1;
}

export function one(): f32 {
  return 1.0;
}
