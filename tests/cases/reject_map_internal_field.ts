// WP32 (docs/wp32-map.md §4.2): the table's own fields are not members a program can see.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return m.mask;
};
