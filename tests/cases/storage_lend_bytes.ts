// WP50 stage 4: byte storage may be lent to a `u8[]` or `readonly u8[]`
// parameter, the spelling a byte buffer has (`Uint8Array` is not spelled).
// The callee keeps it in place: it indexes, reads `length`, lends it on, and
// copies it out with `String.fromBytes`.
const BYTES = new Array<u8>(8)

const put = (buf: u8[], at: i32, s: string): i32 => {
  const n: i32 = toI32(s.length)
  if (at < 0 || n > toI32(buf.length) - at) {
    return -1
  }
  for (let i: i32 = 0; i < n; i++) {
    buf[at + i] = toU8(s.charCodeAt(i))
  }
  return at + n
}

const putTwice = (buf: u8[], s: string): i32 => put(buf, put(buf, 0, s), s)

const read = (buf: readonly u8[], n: i32): string => String.fromBytes(buf, 0, n)

export const main = (): void => {
  const n = putTwice(BYTES, "abc")
  console.log(`${n} ${read(BYTES, n)} ${BYTES.length}`)
  console.log(`${put(BYTES, 6, "xyz")}`)
}
