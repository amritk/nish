// WP27 S4.1: A C struct layout has fields only, so no index signature either.
declare class Point {
  x: i32
  [key: string]: i32
}

export const main = (): number => {
  return 0
}
