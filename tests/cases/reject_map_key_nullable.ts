// WP32 (docs/wp32-map.md §5.1): a nullable type is not a key in this version.
export const main = (): i32 => {
  new Set<string | null>();
  return 0;
};
