// WP32 (docs/wp32-map.md §7): `new Set(array)` is refused; a set starts empty.
export const main = (): i32 => {
  new Set<string>("abc");
  return 0;
};
