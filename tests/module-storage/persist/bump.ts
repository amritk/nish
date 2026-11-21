// Root storage of a class with one i32 field: no strings and no round_init,
// for the persist section's link of root storage that names no runtime.
class Box {
  n: i32 = 0
}

const box = new Array<Box | null>(1)

export const init = (): void => {
  box[0] = new Box()
}

export const step = (): i32 => {
  const b = box[0]
  if (b === null) return -1
  b.n = b.n + 1
  return b.n
}
