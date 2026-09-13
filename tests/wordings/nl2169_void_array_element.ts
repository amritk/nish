// NL2169: An array of void has no element size.
const nothing = (): void => {};

export const main = (): i32 => {
  const xs = [nothing()];
  return 0;
};
