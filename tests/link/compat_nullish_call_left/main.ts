// `nullish` keeps the left operand alone only where it can tell from the
// syntax that JavaScript never answers `undefined`. A call and a ternary are
// not on that list yet, so a `??` on either keeps the strict refusal, whatever
// type the call or the branches have.
const twice = (x: number): number => x * 2;

const fromCall = (x: number): number => twice(x) ?? 1;

const fromTernary = (c: boolean, a: number, b: number): number => (c ? a : b) ?? 0;

export const main = (): void => {
  console.log(fromCall(2) + fromTernary(true, 1, 2));
};
