// Root storage keeps only what the runtime can trace: a C struct layout is
// C's to own.
declare class Point {
  x: i32
  y: i32
}

class Path {
  end: Point

  constructor() {
    this.end = new Point()
  }
}

const path = new Array<Path | null>(1)

export const has = (): boolean => path[0] !== null
