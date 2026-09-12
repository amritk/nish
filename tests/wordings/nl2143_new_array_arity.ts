// NL2143: `new Array<T>(n)` takes the length and nothing else.
export const main = (): i32 => {
  const xs = new Array<i32>(1, 2);
  return 0;
};
