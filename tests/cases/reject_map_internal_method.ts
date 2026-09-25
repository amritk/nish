// WP32 (docs/wp32-map.md §4.2): the table's own methods are not members a program can call.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.rebuild();
  return m.size;
};
