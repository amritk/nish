// A top-level `readonly u8[]` written out as a literal is a constant table:
// one read-only data global and a constant header, no initialiser code. The
// class of each byte: 0 other, 1 digit, 2 letter, 3 whitespace.
const CLASS: readonly u8[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 3, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0,
  0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0,
  0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]

const classOf = (c: u8): u8 => CLASS[c]

// A `u8` index proves nothing about a 16-entry table, so this read keeps its
// bounds check: only an index below the length drops it.
const BITS: readonly u8[] = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]
const bitsOf = (c: u8): u8 => BITS[c]

export const main = (): void => {
  const text = "Nish 0.40, tables!\n"
  const counts: i32[] = [0, 0, 0, 0]
  for (let i = 0; i < text.length; i++) {
    const k = toI32(classOf(toU8(text.charCodeAt(i)))) & 3
    counts[k] += 1
  }
  let sum = 0
  for (const v of CLASS) {
    sum += toI32(v)
  }
  console.log(`${CLASS.length} ${counts[0]} ${counts[1]} ${counts[2]} ${counts[3]} ${sum}`)
  console.log(`${bitsOf(toU8(11))} ${bitsOf(toU8(15))}`)
}
