// WP31 §10 step 3, on §12's program with the index declared `integer<0, 255>`:
// `getByte` indexes through the range behind its length guard, `sumCalled`
// hands it a counter the loop condition places in `[0, 255]`, and `sumInline`
// is the same loop with the access inlined by hand. None of the three keeps a
// bounds check or a range check, so all three are
// `{ nounwind willreturn readonly }`.
const getByte = (buf: u8[], i: integer<0, 255>): u8 => {
  if (buf.length < 256) {
    return 0
  }
  return buf[i]
}

const sumInline = (buf: u8[]): i32 => {
  if (buf.length < 256) {
    return 0
  }
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum = sum + toI32(buf[i])
  }
  return sum
}

const sumCalled = (buf: u8[]): i32 => {
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum = sum + toI32(getByte(buf, i))
  }
  return sum
}

export const main = (): number => {
  const table: u8[] = new Array<u8>(256)
  for (let k = 0; k < 256; k++) {
    table[k] = toU8(k)
  }
  console.log(`${sumInline(table)} ${sumCalled(table)}`)
  return 0
}
