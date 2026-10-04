// NL7002: an array of class instances is not an array of numbers, which is
// all `uncheckedGet` reads.
class Point {
  x: i32 = 0;
}

export const xOf = (ps: Point[], k: i32): i32 => ps[k].x;
