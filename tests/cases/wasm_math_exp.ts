// On a page module `Math.exp` is `std/math.ts`'s `expF64`, copied in as `internal`
// `@nish.expF64` in place of `llvm.exp.f64`, whose libm `exp` freestanding wasm
// does not link. `Math.sin`, `cos`, `log` and `pow` take the same route.
export function grow(x: f64): f64 {
  return Math.exp(x)
}
