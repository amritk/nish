// WP27 S4.1: A `Result` holding a layout is as undescribable as the layout, so no exported signature names one.
declare class Point {
  x: i32
}

export const get = (): Result<Point, string> => Ok(new Point())

export const main = (): number => {
  return 0
}
