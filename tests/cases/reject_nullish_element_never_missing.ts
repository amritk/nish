// An element read of a `number[]` is never `null`, but past the end of the
// array Node reads `undefined` and answers the default where the bounds check
// panics. Strict refuses the `??` as it refuses any on a value never missing,
// and names no feature: `--compat=nullish` refuses it in the same words.
export const main = (): i32 => {
  const xs: number[] = [1];
  return xs[3] ?? 2;
};
