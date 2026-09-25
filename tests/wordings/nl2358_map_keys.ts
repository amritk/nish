// NL2358: `keys()` on the global `Map` outside a `for...of`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.keys();
  return 0;
};
