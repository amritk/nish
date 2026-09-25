// WP32 (docs/wp32-map.md §5.1): an interface is stored inline and has no identity, so it is not a key.
interface Point {
  x: i32;
  y: i32;
}

export const main = (): i32 => {
  new Map<Point, i32>();
  return 0;
};
