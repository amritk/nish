// NL2602: A function parameter names the function a call passes; it has no default.
function twice(x: i32): i32 {
  return x * 2
}
function apply(x: i32, g: (a: i32) => i32 = twice): i32 {
  return g(x)
}
export function main(): void {
  console.log(apply(1, twice))
}
