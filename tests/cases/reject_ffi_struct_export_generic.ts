// WP27 S4.1: An instance of a generic class holds its type argument, so `Box<Point>` holds a layout.
declare class Point {
  x: i32
}

class Box<T> {
  v: T
  constructor(v: T) {
    this.v = v
  }
}

export const get = (): Box<Point> => new Box<Point>(new Point())

export const main = (): number => {
  return 0
}
