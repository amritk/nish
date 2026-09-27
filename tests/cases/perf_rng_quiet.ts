// WP31 §8: range entries the bounds proof already places inside their range.
// Each costs nothing -- no `rng.fail` block anywhere in the golden -- and so
// nothing is reported. The one entry left checked is outside every loop,
// where a check that runs once is not a cost anybody is paying.
const getByte = (buf: u8[], i: integer<0, 255>): u8 => {
  if (buf.length < 256) {
    return 0
  }
  return buf[i]
}

// A `return` proven by the two early exits in front of it.
const clampByte = (v: i32): integer<0, 255> => {
  if (v < 0) {
    return 0
  }
  if (v > 255) {
    return 255
  }
  return v
}

export const main = (): number => {
  const table: u8[] = new Array<u8>(256)
  let total = 0
  // §7's advice: the range goes on the value that is used, and the loop
  // condition proves it, here and at the argument to `getByte`.
  for (let i = 0; i < 256; i++) {
    const b: integer<0, 255> = i
    table[b] = toU8(b)
    total = total + toI32(getByte(table, i))
  }
  // A guard that reaches the entry proves both ends.
  const xs = [5, 150, 99, -1]
  for (let k = 0; k < xs.length; k++) {
    const v = xs[k]
    if (v >= 0 && v <= 99) {
      const r: integer<0, 99> = v
      total = total + r
    }
  }
  // `toI32` of a `u8` lands in `[0, 255]`, and a wider range is narrowed by
  // a guard exactly as an `i32` is.
  for (let k = 0; k < table.length; k = k + 16) {
    const byte: integer<0, 255> = toI32(table[k])
    const wide: integer<0, 1000> = byte
    if (wide < 128) {
      const low: integer<0, 127> = wide
      total = total + low
    }
  }
  // A range with no lower end needs only the upper one.
  for (let k = 0; k < xs.length; k++) {
    const v = xs[k]
    if (v <= 9) {
      const top: integer<-2147483648, 9> = v
      total = total + top
    }
  }
  total = total + clampByte(total) + clampByte(-7)
  // Outside any loop: checked, and not reported.
  const once: integer<0, 99999> = total
  console.log(`${once}`)
  return 0
}
