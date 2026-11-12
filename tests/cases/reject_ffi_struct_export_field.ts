// WP27 S4.1: An exported class cannot hold a C struct layout, which no header or binding describes.
declare class Point {
  x: i32
}

export class Holder {
  p: Point
  constructor() {
    this.p = new Point()
  }
}

export const main = (): number => {
  return 0
}
