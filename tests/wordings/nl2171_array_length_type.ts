// NL2171: `new Array<T>(n)` takes a numeric length, and the message names the type it got.
export const main = (): i32 => {
  const xs = new Array<i32>("a");
  return 0;
};
