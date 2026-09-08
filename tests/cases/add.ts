// The smallest module with a C-ABI surface: `examples/main.c` and the size and
// wasm profile checks in tests/run.js all link against `add`, so it is exported.
export function add(a: number, b: number): number {
  return a + b;
}
