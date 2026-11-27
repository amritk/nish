// The smallest module with a C-ABI surface: an exported `add` that answers a bare
// number. `examples/add.ts` answers a `Result` since examples-strict S3 (#2385), so
// this case keeps the plain shape the export and codegen checks pin.
export const add = (a: number, b: number): number => {
  return a + b;
};
