// A default is a value of the parameter's type: `0.5` is no `i32`.
function f(x: i32, y: i32 = 0.5): i32 {
  return x + y
}
export function main(): void {
  console.log(f(1))
}
