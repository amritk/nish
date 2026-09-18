// The smallest module with a C-ABI surface: `examples/main.c` and the size and
// wasm profile checks in tests/run.js all link against `add`, so it is exported.
export function add(a: number, b: number): number {
  return a + b;
}

// A trailing comment, so that this pull request touches one corpus program and
// the parity-changed job can be measured from a real run of itself. Reverted
// in the next commit; the IR is unaffected, which was checked before pushing.
