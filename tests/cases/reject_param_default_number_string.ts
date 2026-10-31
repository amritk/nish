// A numeric default fits only a numeric parameter: a string takes a string.
function label(s: string = 5): i32 {
  return s.length
}
export function main(): void {
  console.log(label("ab"))
}
