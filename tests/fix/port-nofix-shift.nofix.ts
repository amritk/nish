// NL8008 has no review edit: `(x >>> k) | 0` adds an `or` to the IR and still
// warns, and `toI32` saturates under Node where the bits here read back signed.
const f = (x: i32, k: i32): i32 => x >>> k

export const main = (): i32 => {
  console.log(`${f(-7, 0)}`)
  return 0
}
