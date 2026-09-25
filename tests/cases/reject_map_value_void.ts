// WP32 (docs/wp32-map.md §5.1): `void` is nothing to store.
export const main = (): i32 => {
  new Map<string, void>();
  return 0;
};
