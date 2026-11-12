// WP27 S4.1: `new Array<T>` of a layout is refused like the annotation `Point[]`.
declare class Point {
  x: i32
}

export const main = (): number => {
  const points = new Array<Point>(2)
  return points.length
}
