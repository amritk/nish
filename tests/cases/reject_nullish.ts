// `a` is a `number`, never missing, so strict refuses the `??` on it;
// `--compat=nullish` keeps the left operand alone and says so (NL9021).
const f = (a: number): number => {
  return a ?? 1;
};

export const main = (): void => {
  console.log(f(4));
};
