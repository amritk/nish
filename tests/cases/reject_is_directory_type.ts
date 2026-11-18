// The path is a string; there is no conversion from a number.
export const main = (): number => {
  return isDirectorySync(7) ? 0 : 1;
};
