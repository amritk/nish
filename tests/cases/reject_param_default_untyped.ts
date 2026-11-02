// A default's parameter is annotated: the type is not inferred from the default.
function f(x: i32, y = 2): i32 {
  return x + y
}
export function main(): void {
  console.log(f(1))
}
