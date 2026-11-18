// Both paths are strings; there is no conversion from a number.
export const main = (): number => {
  return renameSync("build/test/a", 7);
};
