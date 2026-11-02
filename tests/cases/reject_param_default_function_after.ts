// A function parameter after one with a default is refused like any other:
// a function cannot take a default, so the call could not leave it out.
function apply(n: i32 = 1, f: (x: i32) => i32): i32 {
  return f(n)
}
function id(x: i32): i32 {
  return x
}
export function main(): void {
  console.log(apply(2, id))
}
