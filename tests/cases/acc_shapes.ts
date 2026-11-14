// Two bases and two steps, one of each form (`X + self(...)` and
// `self(...) + Y`), and a conditional whose arms are a step and a base: all
// of it one loop, each step its own edge back to the header.
const shape = (n: i32, k: i32): i32 => {
  if (n <= 0) {
    return k
  }
  if (n === 7) {
    return 100
  }
  if (n > 40) {
    return n % 3 === 0 ? 1000 : 2 * n + shape(n - 3, k)
  }
  if (n % 2 === 0) {
    return n + shape(n - 1, k)
  }
  return shape(n - 2, k + 1) + k
}

export const main = (): i32 => {
  console.log(`${shape(0, 5)} ${shape(7, 0)} ${shape(9, 2)} ${shape(30, 1)} ${shape(50, 3)} ${shape(45, 1)}`)
  return 0
}
