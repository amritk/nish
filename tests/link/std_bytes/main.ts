// `nish/bytes`: every width in both byte orders, written into a buffer, the
// bytes printed in index order, and read back. Values are chosen so that each
// byte differs and the top bit is set, so an order swap or a sign-extended byte
// shows in the output.
import {
  getF64BE,
  getF64LE,
  getI32BE,
  getI32LE,
  getI64BE,
  getI64LE,
  getU16BE,
  getU16LE,
  getU32BE,
  getU32LE,
  getU64BE,
  getU64LE,
  setF64BE,
  setF64LE,
  setI32BE,
  setI32LE,
  setI64BE,
  setI64LE,
  setU16BE,
  setU16LE,
  setU32BE,
  setU32LE,
  setU64BE,
  setU64LE,
} from "nish/bytes"

/** `b[from]` to `b[from + n - 1]` as hex pairs, in index order. */
const hex = (b: u8[], from: i32, n: i32): string => {
  const digits = "0123456789abcdef"
  const pairs: string[] = []
  for (let i: i32 = 0; i < n; i++) {
    const v = toI32(b[from + i])
    pairs.push(digits.substring(v >> 4, (v >> 4) + 1) + digits.substring(v & 15, (v & 15) + 1))
  }
  return pairs.join("")
}

/** A buffer of `n` bytes, each 0xee, so a byte left unwritten shows. */
const filled = (n: i32): u8[] => {
  const b: u8[] = []
  for (let i: i32 = 0; i < n; i++) {
    b.push(toU8(238))
  }
  return b
}

export const main = (): i32 => {
  // An odd offset, so no width is read from the buffer's start.
  const at: i32 = 3
  const b = filled(16)

  setU16LE(b, at, toU16(0xa1b2))
  console.log(`u16 le ${hex(b, 0, 7)} ${getU16LE(b, at)} ${getU16BE(b, at)}`)
  setU16BE(b, at, toU16(0xa1b2))
  console.log(`u16 be ${hex(b, 0, 7)} ${getU16BE(b, at)} ${getU16LE(b, at)}`)

  const word: u32 = 0xa1b2c3d4
  setU32LE(b, at, word)
  console.log(`u32 le ${hex(b, 0, 9)} ${getU32LE(b, at)} ${getU32BE(b, at)}`)
  setU32BE(b, at, word)
  console.log(`u32 be ${hex(b, 0, 9)} ${getU32BE(b, at)} ${getU32LE(b, at)}`)

  const low: u32 = 0xe5f60718
  const wide = (toU64(word) << toU64(32)) | toU64(low)
  setU64LE(b, at, wide)
  console.log(`u64 le ${hex(b, 0, 13)} ${getU64LE(b, at)} ${getU64BE(b, at)}`)
  setU64BE(b, at, wide)
  console.log(`u64 be ${hex(b, 0, 13)} ${getU64BE(b, at)} ${getU64LE(b, at)}`)

  setI32LE(b, at, -2)
  console.log(`i32 le ${hex(b, at, 4)} ${getI32LE(b, at)} ${getI32BE(b, at)}`)
  setI32BE(b, at, -123456789)
  console.log(`i32 be ${hex(b, at, 4)} ${getI32BE(b, at)} ${getI32LE(b, at)}`)

  setI64LE(b, at, toI64(-2))
  console.log(`i64 le ${hex(b, at, 8)} ${getI64LE(b, at)} ${getI64BE(b, at)}`)
  const negative: i64 = -1234567890123
  setI64BE(b, at, negative)
  console.log(`i64 be ${hex(b, at, 8)} ${getI64BE(b, at)}`)

  setF64LE(b, at, -1.5)
  console.log(`f64 le ${hex(b, at, 8)} ${getF64LE(b, at)}`)
  setF64BE(b, at, 3.25)
  console.log(`f64 be ${hex(b, at, 8)} ${getF64BE(b, at)}`)

  // The last byte in range, at both ends of the buffer.
  setU32BE(b, 0, toU32(0x01020304))
  setU32LE(b, 12, toU32(0x01020304))
  console.log(`ends ${hex(b, 0, 16)} ${getU32BE(b, 0)} ${getU32LE(b, 12)}`)
  return 0
}
