// --deny-panics under `--number-mode f64`, in a module that declares its own
// `toI32`: the credited guard would call it rather than the builtin, so the
// error names no guard.
const toI32 = (x: number): number => x

export const at = (xs: number[], i: i32): number => xs[i] + toI32(0);
