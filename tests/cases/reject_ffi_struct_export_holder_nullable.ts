// WP27 S4.1: a class holding a layout is refused in an exported signature behind `| null` too.
declare class Point {
  x: i32
}

class Holder {
  p: Point
  constructor() {
    this.p = new Point()
  }
}

export const take = (h: Holder | null): i32 => (h === null ? 0 : h.p.x)

export const main = (): number => {
  return 0
}
