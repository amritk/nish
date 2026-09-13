// `new Array<T>(n)` takes the length and nothing else.
export const run = (): number => {
  const a = new Array<number>(4, 5);
  return a.length;
};
