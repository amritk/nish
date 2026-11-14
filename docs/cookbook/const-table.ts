const DIGIT: readonly u8[] = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 97, 98, 99, 100, 101, 102]

export const hexDigit = (n: i32): u8 => {
  const k = n & 15
  return DIGIT[k]
}
