// NL2603: `x?: T` stays refused: a parameter a call may leave out has a default.
function f(x: i32, y?: i32): i32 {
  return x
}
export function main(): void {
  console.log(f(1))
}
