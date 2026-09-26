// NL2372: `keys()` of the global `Map` stored in a variable.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const it = m.keys();
  return 0;
};
