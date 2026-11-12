// WP27 S4.1: An object literal cannot build a layout: `new` zero-fills it.
declare class Point {
  x: i32
}

export const main = (): number => {
  const p: Point = { x: 1 }
  return p.x
}
