// NL2239: A ternary is a value, so neither arm may be void.
const nothing = (): void => {};

export const main = (): i32 => {
  const flag: boolean = true;
  const x = flag ? nothing() : nothing();
  return 0;
};
