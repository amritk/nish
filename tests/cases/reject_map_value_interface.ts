// WP32 (docs/wp32-map.md §5.1): an interface value would be copied into the table rather than shared.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  new Map<string, Point>();
  return 0;
};
