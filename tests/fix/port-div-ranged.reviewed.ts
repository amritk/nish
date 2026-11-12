// A ranged operand's quotient takes the edit too: `toI32(percent / 3)`
// converts the base value the division already gives, and keeps its range,
// so `+ 1` skips its overflow check either way and the IR is the same.
const third = (percent: integer<0, 100>): i32 => toI32(percent / 3) + 1

export const main = (): i32 => {
  console.log(`${third(100)} ${third(0)} ${third(50)}`)
  return 0
}
