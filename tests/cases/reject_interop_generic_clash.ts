// WP18 G8: `cFunctionName` spells a method `Point.shifted` as `Point_shifted`,
// and a program may declare a function by that name too. A header that
// declared both would not compile, so the C sidecars refuse the pair and name
// both. An instantiation cannot be one half of such a pair: its C name starts
// with the reserved `nish_gen_` (tests/cases/interop_generic_collision).
export class Point {
  x: i32 = 0;

  shifted(d: i32): i32 {
    return this.x + d;
  }
}

export const Point_shifted = (p: Point): i32 => p.x;

export const test = (): number => Point_shifted(new Point());
