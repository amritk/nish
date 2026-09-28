// WP31 §8: a declared range bounds an index. `integer<0, 255>` and `u8` are
// both below 256, and non-negative, read off the type with no fact recorded,
// so an index into an array of at least 256 elements needs no check; `u16`
// is below 65536 the same way. `toI32` of a `u8` keeps the bound in the local
// it is written to. What the range cannot prove keeps its check: a table
// shorter than the range, and a `u32`, whose range runs past every `i32`.
const lookup = (table: i32[], i: integer<0, 255>): i32 => {
  if (table.length < 256) {
    return -1
  }
  return table[i]
}

const byByte = (table: i32[], b: u8): i32 => {
  if (table.length < 256) {
    return -1
  }
  return table[b]
}

const byHalf = (table: i32[], h: u16): i32 => {
  if (table.length < 65536) {
    return -1
  }
  return table[h]
}

const converted = (table: i32[], b: u8): i32 => {
  const k = toI32(b)
  if (table.length < 256) {
    return -1
  }
  return table[k]
}

// Checked: 200 elements do not cover `[0, 255]`.
const short = (table: i32[], i: integer<0, 255>): i32 => {
  if (table.length < 200) {
    return -1
  }
  return table[i]
}

// Checked: a `u32` states no upper bound an index can use.
const wide = (table: i32[], w: u32): i32 => {
  if (table.length < 256) {
    return -1
  }
  return table[w]
}

// The table is built by `push`, so no call site knows its length and each
// function above is proven, or not, by its own guard alone.
export const main = (): number => {
  const table: i32[] = []
  for (let k = 0; k < 65536; k++) {
    table.push(k % 13)
  }
  const b: u8 = 255
  const h: u16 = 300
  const w: u32 = toU32(table.length - 65281)
  console.log(`${lookup(table, 255)} ${byByte(table, b)} ${byHalf(table, h)} ${converted(table, b)}`)
  console.log(`${short(table, 255)} ${wide(table, w)}`)
  return 0
}
