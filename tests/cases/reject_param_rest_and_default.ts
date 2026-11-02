// A default and a rest in one signature are not combined in this version.
function f(x: i32 = 1, ...xs: i32[]): i32 {
  return x + xs.length
}
export function main(): void {
  console.log(f())
}
