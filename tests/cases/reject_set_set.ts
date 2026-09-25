// WP32 (docs/wp32-map.md §7): a `Set` has `add`, and no `set`.
export const main = (): i32 => {
  const s = new Set<i32>();
  s.set(1, 1);
  return s.size;
};
