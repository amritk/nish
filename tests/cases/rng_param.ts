// WP31 §6: an argument entering a ranged parameter is checked where it enters,
// with one `icmp ult` against the width of the range and a cold `rng.fail`
// block. A range that starts below zero subtracts its lower bound first. A
// literal inside the range and a value already in a narrower range cost
// nothing, and the parameter itself is a plain `i32` in the callee. A bound is
// a value, not a spelling: `integer<0, 0xFF>` and `integer<0, 0b11111111>` are
// `integer<0, 255>`, so `echo` is instantiated once, as `@echo$rng.p0.p255`,
// and the values pass between the three spellings with no check.
const getByte = (buf: u8[], i: integer<0, 255>): u8 => buf[i]

const offset = (x: integer<-128, 127>): i32 => x + 128

const echo = <T>(x: T): T => x

export const main = (): number => {
  const table: u8[] = [10, 20, 30, 40]
  const n = 2
  const narrow: integer<0, 3> = 3
  console.log(`${getByte(table, n)} ${getByte(table, narrow)} ${getByte(table, 0)}`)
  console.log(`${offset(-128)} ${offset(n - 5)}`)
  const hex: integer<0, 0xff> = 200
  const bin: integer<0, 0b11111111> = echo(hex)
  const dec: integer<0, 255> = echo(bin)
  console.log(`${getByte(table, dec - 197)}`)
  return 0
}
