// WP27 S4.1: Holding is transitive, through records declared further down: `Wrap` holds `Holder`,
// which holds the layout, so no exported signature names `Wrap`.
declare class Point {
  x: i32
}

export const take = (w: Wrap): i32 => w.h.p.x

class Wrap {
  h: Holder
  constructor() {
    this.h = new Holder()
  }
}

class Holder {
  p: Point
  constructor() {
    this.p = new Point()
  }
}

export const main = (): number => {
  return 0
}
