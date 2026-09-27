// NL9013: a value entering a range inside a loop, with nothing that proves it
// already lies there, keeps its check on every pass and names the guard that
// would prove it.
export const total = (xs: i32[]): i32 => {
  let sum = 0
  for (let k = 0; k < xs.length; k++) {
    const slot: integer<0, 63> = k
    sum = sum + slot
  }
  return sum
}
