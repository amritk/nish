// NL2605: A default is a number, a boolean, a string or an enum member.
function f(x: i32, ys: i32[] = []): i32 {
  return x + ys.length
}
export function main(): void {
  console.log(f(1))
}
