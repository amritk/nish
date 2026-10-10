// --deny-panics refuses a `number` index under `--number-mode f64`, and names
// no guard: a float index is never proven in range.
export const at = (xs: number[], i: number): number => xs[i];
