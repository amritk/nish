// WP32 (docs/wp32-map.md §6.2): there is no `entries`, because a `[key, value]` pair is a two-type tuple.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.entries();
  return m.size;
};
