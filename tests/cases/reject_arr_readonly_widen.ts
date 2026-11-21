// The widening is one-directional: a `T[]` becomes a `readonly T[]` at a
// parameter, and never the other way, because the reverse would launder the
// promise away one call deeper.
const fill = (ys: number[]): number => {
  ys[0] = 1;
  return ys.length;
};
const pass = (xs: readonly number[]): number => {
  return fill(xs);
};
export const main = (): number => {
  const a: number[] = [1];
  return pass(a);
};
