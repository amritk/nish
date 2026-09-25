// WP32 (docs/wp32-map.md §6.2): iterating a map with `for...of` is not lowered in this version.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let total: i32 = 0;
  for (const v of m.values()) {
    total = total + v;
  }
  return total;
};
