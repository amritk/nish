// NL2303: type arguments are not written at a call site, and when `T` is
// inferred as the type written, the fix deletes them: the argument is a
// literal of that type, or a local declared with it.
const identity = <T>(x: T): T => x
class Point {
  x: i32 = 1
}
export const test = (): number => {
  const p = new Point()
  const q = identity<Point>(p)
  const s = identity<string>("s")
  const n: i32 = q.x
  const a = identity<i32>(7)
  const b = identity<number>(n)
  return a + b + s.length
}
