// WP27 S4.1: An exported class's method cannot take a C struct layout either.
declare class Point {
  x: i32
}

export class Reader {
  n: i32 = 0
  read(p: Point): i32 {
    return p.x + this.n
  }
}

export const main = (): number => {
  return 0
}
