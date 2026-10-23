// A proven operation inside an unproven one: `(x & 255) + 1` cannot overflow,
// so it stays a plain `+` wrapped to i32, and only the multiplication around
// it, by a `k` nothing bounds, is checked.
const step = (x: i32, k: i32): i32 => ((x & 255) + 1) * k

export const main = (): i32 => {
  let k: i32 = 1
  for (const factor of [3, 5]) {
    k = k * factor
    console.log(step(1000, k))
  }
  console.log(step(-1, 7))
  return 0
}
