// WP27 S4.1: A layout is lent only to a `declare function`, never through an exported signature.
declare class Point {
  x: i32
}

export const readX = (p: Point): i32 => p.x

export const main = (): number => {
  return 0
}
