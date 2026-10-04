// An array of class instances holds pointers, which `uncheckedGet` does not
// read: reported without a fix.
class Point {
  x: i32 = 0
}

export const xOf = (ps: Point[], k: i32): i32 => ps[k].x
