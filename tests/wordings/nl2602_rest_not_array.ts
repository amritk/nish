// NL2602: A rest parameter has an array type.
function f(...xs: i32): i32 {
  return xs
}
export function main(): void {
  console.log(f(1))
}
