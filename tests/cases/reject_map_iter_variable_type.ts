// WP32 (docs/wp32-map.md §6.2): a walk of `values()` binds the value type, so
// its variable is an `i32` here, not the key's `string`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let n: i32 = 0;
  for (const v of m.values()) {
    n = n + v.length;
  }
  return n;
};
