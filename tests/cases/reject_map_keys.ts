// WP32 (docs/wp32-map.md §6.2): `keys()` is only a `for...of` iterable; an iterator is not a value.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const it = m.keys();
  return m.size;
};
