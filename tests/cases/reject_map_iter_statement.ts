// WP32 (docs/wp32-map.md §6.2): `keys()` as a statement of its own is an iterator
// nobody walks; an iterator is only ever the iterable of a `for...of`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.keys();
  return m.size;
};
