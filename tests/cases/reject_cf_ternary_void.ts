// A ternary is an expression, so its branches carry a value.
const nothing = (): void => {};

export const run = (flag: boolean): number => {
  const x = flag ? nothing() : nothing();
  return 0;
};
