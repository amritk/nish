// NL2604: `f(...xs)` is refused: pass the array to a parameter of array type.
function total(...xs: i32[]): i32 {
  return xs.length
}
export function main(): void {
  const a = [1, 2]
  console.log(total(...a))
}
