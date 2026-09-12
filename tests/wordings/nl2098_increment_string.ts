// NL2098: `++` needs a numeric variable, and the message names the type it found.
export const main = (): i32 => {
  let s: string = "a";
  s++;
  return 0;
};
