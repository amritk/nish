// NL2594: A parameter of a type parameter's type has no one constant default.
function f<T>(x: T, y: T = 0): T {
  return x
}
export function main(): void {
  console.log(f(1))
}
