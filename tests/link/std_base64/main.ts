// `nish/base64` against RFC 4648 §4: the §10 test vectors, every byte value in
// each of the three positions of a group, every length mod 3 on either side of
// the 3072-byte chunk a kitty frame is cut into (checked against a slow
// reference encoder written here), and `base64EncodeInto` writing in the
// middle of a buffer from the middle of another.
import { base64Encode, base64EncodeInto, base64EncodedLength } from "nish/base64"
import { Suite } from "nish/testing"

const ALPHABET: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

/** The bytes of an ASCII string, as the RFC's vectors are written. */
const bytesOfAscii = (text: string): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/**
 * The base64 of `bytes` the slow way, one bit at a time into a sextet, so that
 * it shares nothing with the module's three-byte groups.
 */
const reference = (bytes: u8[]): string => {
  const parts: string[] = []
  const bits: i32 = toI32(bytes.length) * 8
  for (let start: i32 = 0; start < bits; start = start + 6) {
    let v: i32 = 0
    for (let k: i32 = 0; k < 6; k++) {
      const bit: i32 = start + k
      v = v << 1
      if (bit < bits) {
        const byte: i32 = bit >> 3
        v = v | ((toI32(bytes[byte]) >> (7 - (bit & 7))) & 1)
      }
    }
    parts.push(ALPHABET.substring(v, v + 1))
  }
  while (parts.length % 4 !== 0) {
    parts.push("=")
  }
  return parts.join("")
}

/** `n` bytes of a fixed pseudo-random pattern, every value reached. */
const pattern = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < n; i++) {
    out[i] = toU8((i * 167 + 13) & 255)
  }
  return out
}

export const main = (): number => {
  const t = new Suite("base64")

  // --- RFC 4648 §10 ------------------------------------------------------------
  t.eqStr("§10: empty", base64Encode(bytesOfAscii("")), "")
  t.eqStr("§10: f", base64Encode(bytesOfAscii("f")), "Zg==")
  t.eqStr("§10: fo", base64Encode(bytesOfAscii("fo")), "Zm8=")
  t.eqStr("§10: foo", base64Encode(bytesOfAscii("foo")), "Zm9v")
  t.eqStr("§10: foob", base64Encode(bytesOfAscii("foob")), "Zm9vYg==")
  t.eqStr("§10: fooba", base64Encode(bytesOfAscii("fooba")), "Zm9vYmE=")
  t.eqStr("§10: foobar", base64Encode(bytesOfAscii("foobar")), "Zm9vYmFy")

  // --- the two letters of §4's alphabet that §5 replaces --------------------------
  t.eqStr("+ and /", base64Encode([toU8(0xfb), toU8(0xff), toU8(0xbf)]), "+/+/")

  // --- every byte value in each position of a group, and in a short final one ----
  let mismatches: i32 = 0
  for (let v: i32 = 0; v < 256; v++) {
    for (let pos: i32 = 0; pos < 5; pos++) {
      const bytes: u8[] = new Array<u8>(pos + 1)
      bytes.fill(toU8(0x5a))
      bytes[pos] = toU8(v)
      if (base64Encode(bytes) !== reference(bytes)) {
        mismatches = mismatches + 1
      }
    }
  }
  t.eqI32("every byte value, positions 0 to 4", mismatches, 0)

  // --- every length mod 3 around the 3072-byte kitty chunk ------------------------
  for (let n: i32 = 3069; n <= 3076; n++) {
    const bytes: u8[] = pattern(n)
    const text: string = base64Encode(bytes)
    t.eqI32(`length ${n}`, toI32(text.length), base64EncodedLength(n))
    t.eqStr(`bytes ${n}`, text, reference(bytes))
  }
  t.eqI32("3072 bytes are one 4096-character chunk", base64EncodedLength(3072), 4096)
  t.eqI32("length of 0", base64EncodedLength(0), 0)
  t.eqI32("length of 1", base64EncodedLength(1), 4)
  t.eqI32("length of 2", base64EncodedLength(2), 4)
  t.eqI32("length of 3", base64EncodedLength(3), 4)
  t.eqI32("length of 4", base64EncodedLength(4), 8)
  t.eqI32("the longest length", base64EncodedLength(1610612733), 2147483644)

  // --- into the middle of a buffer, from the middle of another --------------------
  const src: u8[] = bytesOfAscii("xxfoobayy")
  const dst: u8[] = new Array<u8>(14)
  dst.fill(toU8(46))
  const end: i32 = base64EncodeInto(src, 2, 5, dst, 3)
  t.eqI32("into: the end it answers", end, 11)
  t.eqStr("into: what it wrote, and nothing around it", String.fromBytes(dst, 0, 14), "...Zm9vYmE=...")
  t.eqI32("into: an empty range writes nothing", base64EncodeInto(src, 9, 0, dst, 14), 14)
  t.eqStr("into: chunked equals whole", chunked(pattern(7000)), reference(pattern(7000)))

  return t.done()
}

/** `bytes` encoded 3072 at a time into one buffer, as `kittyFrame` cuts a frame. */
const chunked = (bytes: u8[]): string => {
  const n: i32 = toI32(bytes.length)
  const out: u8[] = new Array<u8>(base64EncodedLength(n))
  let at: i32 = 0
  for (let off: i32 = 0; off < n; off = off + 3072) {
    const len: i32 = n - off < 3072 ? n - off : 3072
    at = base64EncodeInto(bytes, off, len, out, at)
  }
  return String.fromBytes(out, 0, at)
}
