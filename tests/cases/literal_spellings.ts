// Every numeric-literal spelling is read at the value it spells, in every
// numeric type (#267): decimal, `0x`, `0b`, `0o`, `_` separators and a decimal
// exponent. `1e5` as an i32 was 245 (the `e` was read as the hex digit 14),
// and `0b1010`, `0o17` were refused as not fitting, because the runtime's
// `Number` calls a `0b` or `0o` literal NaN.
type Byte = integer<0, 0b1111_1111>
type Signed = integer<-1e3, 0o1_750>

// A module constant folds through the same reader.
export const KILO: i32 = 1e3
export const MASK: i64 = 0b1_0000

export const main = (): void => {
  const exponent: i32 = 1e5
  const upper: i32 = 1E3
  const exact: i32 = 100e-2
  const binary: i32 = 0b1010
  const octal: i32 = 0o17
  const separated: i32 = 1_000
  const hex: i32 = 0xFF_FF
  const min: i32 = -0b1000_0000_0000_0000_0000_0000_0000_0000
  console.log(exponent)
  console.log(upper)
  console.log(exact)
  console.log(binary)
  console.log(octal)
  console.log(separated)
  console.log(hex)
  console.log(min)

  const wideExponent: i64 = 1e15
  const wideBinary: i64 = 0B1111_1111_1111_1111_1111_1111_1111_1111_1111
  const wideOctal: i64 = 0O777_777_777_777
  console.log(wideExponent)
  console.log(wideBinary)
  console.log(wideOctal)

  const floatBinary: f64 = 0b1010
  const floatOctal: f64 = 0o17
  const floatExponent: f64 = 1.5e3
  const floatSeparated: f64 = 1_234.5_6
  // Past 2^53 a binary literal rounds once, to the double TypeScript reads:
  // 2^53 + 3 is 9007199254740996, not 9007199254740994.
  const rounded: f64 = 0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011
  console.log(floatBinary)
  console.log(floatOctal)
  console.log(floatExponent)
  console.log(floatSeparated)
  console.log(rounded)

  const byte: Byte = 0b1111_1111
  const signed: Signed = -1e3
  console.log(byte)
  console.log(signed)
  console.log(KILO)
  console.log(MASK)
}
