// NL2360: `size` of the global `Set` is read-only.
export const main = (): i32 => {
  const s = new Set<i32>();
  s.size = 1;
  return 0;
};
