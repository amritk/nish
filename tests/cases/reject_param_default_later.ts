// A default names an earlier parameter only.
function f(x: i32 = y, y: i32 = 2): i32 {
  return x + y
}
export function main(): void {
  console.log(f())
}
