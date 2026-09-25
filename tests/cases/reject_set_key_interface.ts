// WP32 (docs/wp32-map.md §6.3): the key rules hold for a `Set` element, written in an annotation.
interface Point {
  x: i32;
}

export const count = (s: Set<Point>): i32 => s.size;
