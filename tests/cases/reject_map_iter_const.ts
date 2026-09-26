// WP32 (docs/wp32-map.md §6.2): an iterator is not a value, so `values()` cannot
// initialise a `const`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const it = m.values();
  return m.size;
};
