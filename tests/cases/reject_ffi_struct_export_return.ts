// WP27 S4.1: An exported function cannot give a host a C struct layout.
declare class Point {
  x: i32
}

export const origin = (): Point => new Point()

export const main = (): number => {
  return 0
}
