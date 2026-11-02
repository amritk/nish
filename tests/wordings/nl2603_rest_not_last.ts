// NL2603: A rest parameter is the last one.
function f(...xs: i32[], y: i32): i32 {
  return xs.length + y
}
export function main(): void {
  console.log(f(1, 2))
}
