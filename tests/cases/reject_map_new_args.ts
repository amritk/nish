// WP32 (docs/wp32-map.md §7): `new Map(entries)` is refused; a map starts empty.
export const main = (): i32 => {
  new Map<string, i32>(3);
  return 0;
};
