// The unsigned widths with a conversion of their own: `toU8`, `toU16` and
// `toU32`, each the identity on its type.
const byte = (a: u8, b: u8): u8 => toU8(a / b)
const half = (a: u16, b: u16): u16 => toU16(a / b)
const word = (a: u32, b: u32): u32 => toU32(a / b)

export const main = (): i32 => {
  console.log(`${byte(200, 7)} ${half(60000, 7)} ${word(4000000000, 7)}`)
  return 0
}
