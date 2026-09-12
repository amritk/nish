// NL2238: A template hole is formatted, so its type is one of the three the formatter has.
export const main = (): i32 => {
  const xs: i32[] = [1];
  const s: string = `${xs}`;
  return 0;
};
