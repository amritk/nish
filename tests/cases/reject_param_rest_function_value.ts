// A function with a rest is no value for a function parameter: a call through
// `f` passes one array where Node would gather every argument into `xs`.
function total(...xs: i32[]): i32 {
  return xs.length
}
function apply(f: (a: i32[]) => i32): i32 {
  return f([1, 2, 3])
}
export function main(): void {
  console.log(apply(total))
}
