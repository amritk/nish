// FFI batching benchmark module (bench/ffi.mjs). Built with --number-mode f64
// so that JS numbers cross the boundary unchanged and the 1..1e6 sum does not
// overflow an i32.
//
// `add` is the per-element call: the host crosses into native code once per
// element. `sumTo` is the batched call: the host crosses once and the whole
// sum happens natively.
//
// The batch is written in
// closed form. A `for` loop summing 1..n compiles to this same expression
// anyway: LLVM's scalar evolution folds the induction variable at -O3.
export function add(a: number, b: number): number {
  return a + b;
}

export function sumTo(n: number): number {
  return (n * (n + 1)) / 2;
}
