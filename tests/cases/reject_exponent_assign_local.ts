// `**=` is refused whatever it assigns, a local as much as a field.
export const run = (n: i32): i32 => {
  let x: i32 = n
  x **= 2
  return x
}
