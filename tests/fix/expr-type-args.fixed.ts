// NL2303: type arguments are not written at a call site, and when `T` is
// inferred as the type written, the fix deletes them: the argument is a
// literal of that type, or a local declared with it.
const identity = <T>(x: T): T => x
class Point {
  x: i32 = 1
}
export const test = (): number => {
  const p = new Point()
  const q = identity(p)
  const s = identity("s")
  const n: i32 = q.x
  const a = identity(7)
  const b = identity(n)
  return a + b + s.length
}
