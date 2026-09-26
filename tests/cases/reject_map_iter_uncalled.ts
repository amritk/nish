// WP32 (docs/wp32-map.md §6.2): `keys` named without a call is no more a value
// than the iterator a call would make.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const f = m.keys;
  return m.size;
};
