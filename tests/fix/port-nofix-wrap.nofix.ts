// NL8007 has no review edit: `(a + b) & 0xff` adds an `and` to the IR and still
// warns, and `toU8` saturates under Node where the `add` here wraps.
const f = (a: u8, b: u8): u8 => a + b

export const main = (): i32 => {
  console.log(`${f(200, 100)}`)
  return 0
}
