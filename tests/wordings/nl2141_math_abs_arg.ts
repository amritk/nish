// NL2141: `Math.abs` is the one `Math` builtin that takes any numeric width, and its message says `a number`.
export const main = (): i32 => {
  const x: i32 = Math.abs("a");
  return 0;
};
