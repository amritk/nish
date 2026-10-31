// NL2593: A default is a constant the call passes, not an expression the callee runs.
function f(x: i32, y: i32 = x + 1): i32 {
  return x + y
}
export function main(): void {
  console.log(f(1))
}
