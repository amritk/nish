// NL2245: `new X` where no class `X` is declared names the class it looked for.
export const main = (): i32 => {
  const p = new Missing();
  return 0;
};
