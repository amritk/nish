// toI32 / toI64 / toF64 between every numeric type (default i32 mode):
// sext, trunc, sitofp, and the saturating llvm.fptosi.sat.* for f64 -> integer.
export function test(): number {
  const f: f64 = 2.75;
  const big: i64 = 5000000000;
  console.log(toI32(f));
  console.log(toI64(f));
  console.log(toF64(big) / 2);
  console.log(toI32(big));
  console.log(toI64(7) * 1000000000);
  console.log(toI32(toF64(big) * 10));
  const zero: f64 = 0;
  console.log(toI32(zero / zero));
  console.log(toF64(3) / 2);
  console.log(toF64(2.75) === f);
  return toI32(f * 4);
}
