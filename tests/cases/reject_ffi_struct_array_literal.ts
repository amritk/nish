// WP27 S4.1: An array literal of layouts is refused like the annotation `Point[]`.
declare class Point {
  x: i32
}

export const main = (): number => {
  const points = [new Point(), new Point()]
  return points.length
}
