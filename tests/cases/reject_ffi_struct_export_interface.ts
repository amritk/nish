// WP27 S4.1: an exported interface cannot have a layout field: its declaration is described to the generators.
declare class Point {
  x: i32
}

export interface Placed {
  p: Point
}

export const main = (): number => {
  return 0
}
