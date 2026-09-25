// WP32 (docs/wp32-map.md §7): without an annotation to take them from, `new Map` writes its type arguments.
export const main = (): i32 => {
  new Map();
  return 0;
};
