// WP32 (docs/wp32-map.md §6.2): a `Set` has no `entries` either, because there is no destructuring.
export const main = (): i32 => {
  const s = new Set<i32>();
  s.entries();
  return s.size;
};
