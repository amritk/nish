// A default naming an earlier parameter has that parameter's type.
function f(x: i32, y: f64 = x): f64 {
  return y
}
export function main(): void {
  console.log(f(1))
}
