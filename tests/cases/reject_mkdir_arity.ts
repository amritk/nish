// `mkdirSync` is not recursive and takes no options: exactly one path.
export const main = (): number => {
  return mkdirSync("build/test", "0755") ? 0 : 1;
};
