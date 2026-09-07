// The f64-only Math functions stay f64-only: there is no `llvm.sqrt.f32`
// behind them, and widening implicitly is not something this language does.
function f(x: f32): f64 {
  return Math.sqrt(x);
}
