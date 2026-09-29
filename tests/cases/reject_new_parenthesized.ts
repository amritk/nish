// `new` takes a class name, and a parenthesised expression is not one.
class Point {
  x: i32 = 0
}

const make = (): Point => new Point()

export const run = (): i32 => {
  const p = new (make())()
  return 0
}
