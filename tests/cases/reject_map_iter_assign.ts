// WP32 (docs/wp32-map.md §6.2): an iterator is not a value, so a `Set`'s
// `keys()` cannot be assigned to a `let` either.
export const main = (): i32 => {
  const s = new Set<i32>();
  let n: i32 = 0;
  n = s.keys();
  return n;
};
