// A loop variable named `toU8` gets the module no review edit for a `u8`
// quotient.
const f = (a: u8, b: u8): u8 => a / b

export const main = (): i32 => {
  const xs: u8[] = [1, 2]
  let s: u8 = 0
  for (const toU8 of xs) {
    s = s + toU8
  }
  console.log(`${f(17, 4)} ${s}`)
  return 0
}
