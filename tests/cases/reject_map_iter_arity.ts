// WP32 (docs/wp32-map.md §6.2): `keys()` takes no argument, in a `for...of` as
// anywhere.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let n: i32 = 0;
  for (const k of m.keys(1)) {
    n = n + k.length;
  }
  return n;
};
