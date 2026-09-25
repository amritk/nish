// NL2356: `forEach` on the global `Map`; a method cannot take a function.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.forEach(0);
  return 0;
};
