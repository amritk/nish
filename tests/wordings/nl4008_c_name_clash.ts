// NL4008: a method and a function whose C spellings are one identifier; a
// header that declared both would not compile.
export class Point {
  x: i32 = 0;

  shifted(d: i32): i32 {
    return this.x + d;
  }
}

export const Point_shifted = (p: Point): i32 => p.x;
