// WP27 S4.1: an alias of a parenthesized `number` is still `number`.
type N = (number)

declare class Point {
  x: N
}

export const main = (): number => {
  return 0
}
