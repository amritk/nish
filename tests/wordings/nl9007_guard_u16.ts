// A `u16` index is offered the credited `u32` compare, its type the lower end.
export const sumAt = (xs: i32[], idx: u16[]): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}
