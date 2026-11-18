// `unlinkSync` removes one name: exactly one path.
export const main = (): number => {
  return unlinkSync("build/test/a", "build/test/b");
};
