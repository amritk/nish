// WP32 (docs/wp32-map.md §6.2): there is no `forEach`, because a method cannot take a function.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.forEach(1);
  return m.size;
};
