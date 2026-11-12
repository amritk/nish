// WP27 S4.1: A layout is lent to C one at a time; an array of them has no C layout here.
declare class Point {
  x: i32
}

export const main = (): number => {
  const points: Point[] = []
  return points.length
}
