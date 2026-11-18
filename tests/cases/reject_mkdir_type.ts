// The path is a string; there is no conversion from a number.
export const main = (): number => {
  return mkdirSync(7) ? 0 : 1;
};
