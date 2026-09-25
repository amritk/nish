// WP32 (docs/wp32-map.md §6.2): there is no `entries`, because there is no destructuring.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.entries();
  return m.size;
};
