// NL2262: Unary `-` is numeric; the message names the type it was given.
export const main = (): i32 => {
  const s: string = "a";
  const x: i32 = -s;
  return 0;
};
