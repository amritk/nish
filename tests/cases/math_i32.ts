// Default i32 mode: Math.abs/min/max work on integers (llvm.abs / llvm.smin / llvm.smax),
// and the f64 constants are still available through an explicit f64 type.
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

export function test(): number {
  console.log(Math.abs(-7));
  console.log(Math.abs(3 - 10));
  console.log(clamp(15, 0, 10));
  console.log(clamp(-3, 0, 10));
  console.log(Math.max(3, 9));
  const tau: f64 = Math.PI * 2;
  console.log(tau);
  return clamp(5, 0, 10);
}
