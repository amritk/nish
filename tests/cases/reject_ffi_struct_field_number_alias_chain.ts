// WP27 S4.1: an alias of an alias of `number` is refused like `number` itself.
type Width = number
type Coord = Width

declare class Point {
  x: Coord
}

export const main = (): number => {
  return 0
}
