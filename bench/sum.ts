// FFI batching benchmark module (bench/ffi.mjs). Built with --number-mode f64
// so that JS numbers cross the boundary unchanged and the 1..1e6 sum does not
// overflow an i32.
//
// `add` is the per-element call: the host crosses into native code once per
// element. `sumTo` is the batched call: the host crosses once and the whole
// sum happens natively. `sumArray` is the batched call with data: the host
// passes a Float64Array of every element once (borrowed by the N-API addon,
// copied into the arena by the wasm loader) and gets one number back.
//
// The closed-form batch is not a shortcut: a `for` loop summing 1..n compiles
// to this same expression anyway, LLVM's scalar evolution folds the induction
// variable at -O3. `sumArray` has to read every element, so it measures a real
// pass over the buffer on top of the crossing.
export function add(a: number, b: number): number {
  return a + b;
}

export function sumTo(n: number): number {
  return (n * (n + 1)) / 2;
}

export function sumArray(xs: Float64Array): number {
  let total = 0;
  for (const x of xs) {
    total += x;
  }
  return total;
}
