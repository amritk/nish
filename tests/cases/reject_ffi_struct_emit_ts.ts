// WP27 S4.1: A module whose only foreign item is a `declare class` is still C's, so --emit-ts refuses it.
declare class Point {
  x: i32
}

export const main = (): number => {
  const p = new Point()
  return p.x
}
