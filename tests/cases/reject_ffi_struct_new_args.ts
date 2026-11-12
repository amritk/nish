// WP27 S4.1: `new` on a layout takes no arguments: it zero-fills.
declare class Point {
  x: i32
}

export const main = (): number => {
  const p = new Point(1)
  return p.x
}
