// Panic sites: an arena allocation can run out of memory. It is listed, as
// `oom` with `"allowed": true`, but it is the one kind no guard removes, so
// it never makes a function one that may panic.
class Point {
  x: i32
  y: i32
  constructor(x: i32, y: i32) {
    this.x = x
    this.y = y
  }
}

const make = (x: i32): Point => new Point(x, x + 1)

const caller = (x: i32): i32 => make(x).y

export const main = (): number => {
  console.log(caller(4))
  return 0
}
