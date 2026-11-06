// A `T | null` parameter defaults only to `null`: an object would be built by every call that leaves it out.
class Point {
  x: i32 = 0
}
function f(p: Point | null = new Point()): i32 {
  return p !== null ? p.x : -1
}
export function main(): void {
  console.log(f())
}
