// `process.argv` is read-only, and `pop` would shorten it.
export const main = (): number => {
  const first = process.argv.pop();
  return first.length;
};
