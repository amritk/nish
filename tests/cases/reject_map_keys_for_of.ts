// WP32 (docs/wp32-map.md §6.2): iterating a map with `for...of` over `keys()` is not lowered in this version.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let n: i32 = 0;
  for (const k of m.keys()) {
    n = n + k.length;
  }
  return n;
};
