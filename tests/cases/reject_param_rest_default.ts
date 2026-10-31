// A rest parameter has no default: leaving it out passes `[]`.
function f(...xs: i32[] = [1]): i32 {
  return xs.length
}
export function main(): void {
  console.log(f())
}
