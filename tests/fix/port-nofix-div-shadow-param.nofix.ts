// A parameter named `toU16` gets the module no review edit for a `u16`
// quotient, even in a function that does not declare it.
const scale = (toU16: u16, a: u16): u16 => toU16 * a

const f = (a: u16, b: u16): u16 => a / b

export const main = (): i32 => {
  console.log(`${f(17, 4)} ${scale(2, 3)}`)
  return 0
}
