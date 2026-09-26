// WP32 (docs/wp32-map.md §6.2): an iterator is not a value, so `values()` cannot
// be passed to a function; pass the map and walk it there.
const count = (xs: i32[]): i32 => xs.length;

export const main = (): i32 => {
  const m = new Map<string, i32>();
  return count(m.values());
};
