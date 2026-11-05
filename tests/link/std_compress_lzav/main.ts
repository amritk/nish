// `nish/compress/lzav` against upstream LZAV 7.1 and itself: 33 inputs (text,
// noise and runs, 1 byte to 300 KB, either side of the 5-byte/6-byte match
// threshold) compress to the length and CRC-32 that `lzav_compress_default`
// writes; a 120-byte stream byte for byte, and `lzav_compress_hi`'s stream
// for it decoded; the bound; round trips through windows off zero; a reused
// compressor writing what a fresh one does; the no-room answer; every error
// code; every prefix of a stream and random corruption answering a code
// without panicking; and nothing written outside the output window.
import { crc32 } from "nish/compress/checksum"
import {
  LZAV_ERR_DISTANCE,
  LZAV_ERR_FORMAT,
  LZAV_ERR_LENGTH,
  LZAV_ERR_OUTPUT,
  LZAV_ERR_PARAMS,
  LZAV_ERR_TRUNCATED,
  LZAV_NO_ROOM,
  LzavCompressor,
  lzavBound,
  lzavCompress,
  lzavDecompress,
} from "nish/compress/lzav"
import { Rng } from "nish/random"
import { Suite } from "nish/testing"


/** The xorshift32 state the vector generator steps, shared with upstream's side of the vectors. */
class Xorshift {
  private st: u32

  constructor(seed: u32) {
    this.st = seed
  }

  next(): u32 {
    this.st = this.st ^ (this.st << toU32(13))
    this.st = this.st ^ (this.st >> toU32(17))
    this.st = this.st ^ (this.st << toU32(5))
    return this.st
  }
}

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const n: i32 = toI32(text.length)
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < n && i < toI32(out.length); i++) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/**
 * Input `kind` (0 text, 1 noise, 2 runs) of `n` bytes, as the C generator the
 * vectors came from builds it: xorshift32 seeded with `2463534242 + 7 kind + n`.
 */
const vector = (kind: i32, n: i32): u8[] => {
  const seed: i64 = 2463534242
  const x = new Xorshift(toU32(seed + toI64(kind) * 7 + toI64(n)))
  const words: string[] = [
    "the", "of", "and", "a", "to", "in", "is", "you", "that", "it", "he", "was",
    "for", "on", "are", "as", "with", "his", "they", "at", "be", "this", "have", "from",
  ]
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < toI32(out.length)) {
    if (kind === 0) {
      const w: u8[] = ascii(words[toI32(x.next() % toU32(24))])
      for (let k: i32 = 0; k < toI32(w.length) && i < toI32(out.length); k++) {
        out[i] = w[k]
        i++
      }
      if (i < toI32(out.length)) {
        out[i] = x.next() % toU32(10) === toU32(0) ? 46 : 32
        i++
      }
    } else if (kind === 1) {
      out[i] = toU8(x.next() & toU32(255))
      i++
    } else {
      const v: u8 = toU8(x.next() & toU32(255))
      const len: i32 = toI32(x.next() % toU32(600)) + 1
      for (let k: i32 = 0; k < len && i < toI32(out.length); k++) {
        out[i] = v
        i++
      }
    }
  }
  return out
}

/** The value of one lowercase hex digit. */
const nibble = (c: i32): i32 => (c >= 97 ? c - 87 : c - 48)

/** The bytes a lowercase hex string spells. */
const unhex = (hex: string): u8[] => {
  const n: i32 = toI32(hex.length) / 2
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < n && i < toI32(out.length); i++) {
    out[i] = toU8((nibble(toI32(hex.charCodeAt(i * 2))) << 4) | nibble(toI32(hex.charCodeAt(i * 2 + 1))))
  }
  return out
}

/** Whether `a[0 .. n)` and `b[off .. off + n)` hold the same bytes. */
const same = (a: u8[], b: u8[], off: i32, n: i32): boolean => {
  if (toI32(a.length) < n || off < 0 || toI32(b.length) - off < n) {
    return false
  }
  for (let i: i32 = 0; i < n; i++) {
    if (a[i] !== b[off + i]) {
      return false
    }
  }
  return true
}

/** Whether every byte of `a` outside `[from, to)` is `fill`. */
const untouched = (a: u8[], from: i32, to: i32, fill: u8): boolean => {
  for (let i: i32 = 0; i < toI32(a.length); i++) {
    if ((i < from || i >= to) && a[i] !== fill) {
      return false
    }
  }
  return true
}

/** `n` random bytes from a small alphabet, with copies of earlier stretches: matches at every distance. */
const stitched = (rng: Rng, n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < toI32(out.length)) {
    if (i < 16 || rng.nextInt(0, 3) === 0) {
      out[i] = toU8(rng.nextInt(0, 255))
      i++
    } else {
      const far: i32 = rng.nextInt(1, i < 300000 ? i : 300000)
      const len: i32 = rng.nextInt(1, 400)
      for (let k: i32 = 0; k < len && i < toI32(out.length); k++) {
        out[i] = out[i - far]
        i++
      }
    }
  }
  return out
}

/** The 120-byte text vector as `lzav_compress_default` writes it. */
const DEFAULT_120: string =
  "45000e746865206172652077617320796f7520612077697468206973207468652ed1418f746f20617420746865206120666f725120c008697320746861742e6f6e2068652069742068617665206f66d26084742e62655101000a686520746869732e617420746865792066726f6d206f6620696e"

/** The same vector as `lzav_compress_hi` writes it. */
const HI_120: string =
  "45000e746865206172652077617320796f7520612077697468206973207468652ed1418f746f20617420746865206120666f7251005122c00361742e6f6e2068652069742068617665206f66d26084742e62655101000a686520746869732e617420746865792066726f6d206f6620696e"

export const main = (): number => {
  const t = new Suite("lzav")
  const rng = new Rng(20261105)
  const lzav = new LzavCompressor()

  {
    // [kind, n, compressed length, CRC-32 of the stream], from upstream LZAV 7.1.
    const vectors: i64[] = [
      0, 1, 27, 0xfe816a1e, 0, 5, 27, 0x2717c4f0, 0, 31, 34, 0x5b02508b, 0, 32, 35, 0xc12cd5d4,
      0, 33, 36, 0x8debfcb4, 0, 100, 102, 0xcb82032a, 0, 5000, 2420, 0x76456e71, 0, 70000, 26912, 0xd3fff638,
      0, 262143, 98769, 0x61aec8ba, 0, 262144, 91991, 0x2c29c298, 0, 300000, 105089, 0xf170de4d,
      1, 1, 27, 0x42ecdff4, 1, 5, 27, 0x05dfd234, 1, 31, 34, 0x022e4767, 1, 32, 35, 0xa0df40f6,
      1, 33, 36, 0x2c76b5d6, 1, 100, 103, 0xc5828159, 1, 5000, 5005, 0xaa866d7d, 1, 70000, 70007, 0xb2c98077,
      1, 262143, 262150, 0xc9bddc73, 1, 262144, 262151, 0xdffcbf45, 1, 300000, 300007, 0xd1c26df9,
      2, 1, 27, 0x1dbbd689, 2, 5, 27, 0x90030486, 2, 31, 34, 0x51dcbc9a, 2, 32, 32, 0x57f9b100,
      2, 33, 32, 0xd20636fb, 2, 100, 33, 0x16d2ff73, 2, 5000, 117, 0x5f56ec22, 2, 70000, 1391, 0x7ce9f168,
      2, 262143, 5459, 0x3d9d7cb1, 2, 262144, 5544, 0xe594d72e, 2, 300000, 6350, 0xe0744e71,
    ]
    const wrong: string[] = []
    const lost: string[] = []
    for (let v: i32 = 0; v + 3 < toI32(vectors.length); v += 4) {
      const kind: i32 = toI32(vectors[v])
      const n: i32 = toI32(vectors[v + 1])
      const src: u8[] = vector(kind, n)
      const out: u8[] = new Array<u8>(lzavBound(n))
      const end: i32 = lzav.compress(src, 0, n, out, 0)
      if (end !== toI32(vectors[v + 2]) || end < 0 || crc32(out, 0, end) !== toU32(vectors[v + 3])) {
        wrong.push(`${kind}/${n}`)
      }
      const back: u8[] = new Array<u8>(n)
      if (end < 0 || lzavDecompress(out, 0, end, back, 0, n) !== n || !same(src, back, 0, n)) {
        lost.push(`${kind}/${n}`)
      }
    }
    t.eqStr("upstream: 33 vectors compress to LZAV 7.1's length and CRC-32", wrong.join(" "), "")
    t.eqStr("upstream: and decompress to their input", lost.join(" "), "")
  }

  {
    const src: u8[] = vector(0, 120)
    const want: u8[] = unhex(DEFAULT_120)
    const out: u8[] = new Array<u8>(lzavBound(120))
    const end: i32 = lzav.compress(src, 0, 120, out, 0)
    t.eqI32("upstream: 120 bytes of text, the default stream's length", end, toI32(want.length))
    t.ok("upstream: and its bytes", end === toI32(want.length) && same(want, out, 0, end))
    const hi: u8[] = unhex(HI_120)
    const back: u8[] = new Array<u8>(120)
    t.eqI32("upstream: lzav_compress_hi's stream for it decodes", lzavDecompress(hi, 0, toI32(hi.length), back, 0, 120), 120)
    t.ok("upstream: to the same input", same(src, back, 0, 120))
  }

  t.eqI32("bound: of 0", lzavBound(0), 32)
  t.eqI32("bound: of 1", lzavBound(1), 35)
  t.eqI32("bound: of 100", lzavBound(100), 138)
  t.eqI32("bound: of 1000", lzavBound(1000), 1081)
  t.eqI32("bound: of 65536", lzavBound(65536), 68690)
  t.eqI32("bound: of 1000000", lzavBound(1000000), 1007255)
  t.eqI32("bound: of 100000000", lzavBound(100000000), 100722055)
  t.eqI32("bound: 0 when it overflows", lzavBound(2147483600), 0)

  {
    // Random lengths and content through windows that start off zero, into
    // output and back with sentinel bytes either side.
    let failed: string = ""
    let spilled: i32 = 0
    for (let round: i32 = 0; round < 120; round++) {
      const n: i32 = round < 40 ? rng.nextInt(0, 64) : rng.nextInt(0, round < 110 ? 20000 : 400000)
      const body: u8[] = round % 3 === 0 ? vector(round % 3, n) : stitched(rng, n)
      const off: i32 = rng.nextInt(0, 9)
      const src: u8[] = new Array<u8>(off + n + 5)
      for (let i: i32 = 0; i < n; i++) {
        src[off + i] = body[i]
      }
      const at: i32 = rng.nextInt(0, 9)
      const out: u8[] = new Array<u8>(at + lzavBound(n))
      const end: i32 = lzav.compress(src, off, n, out, at)
      const fresh: u8[] = new Array<u8>(lzavBound(n))
      const alone: i32 = lzavCompress(body, 0, n, fresh, 0)
      const back: u8[] = new Array<u8>(at + n + 7)
      back.fill(0xa5)
      const got: i32 = end < 0 ? end : lzavDecompress(out, at, end - at, back, at, n)
      if (end < at || alone !== end - at || !same(fresh, out, at, alone) || got !== at + n || !same(body, back, at, n)) {
        failed = `${failed} ${round}:${n}`
      }
      if (!untouched(back, at, at + n, 0xa5)) {
        spilled++
      }
    }
    t.eqStr("round trip: 120 inputs, windows off zero, a reused compressor writing what a fresh one does", failed, "")
    t.eqI32("round trip: nothing written outside the output window", spilled, 0)
  }

  {
    const src: u8[] = vector(0, 5000)
    const need: i32 = lzavBound(5000)
    t.ok("room: the bound is enough", lzav.compress(src, 0, 5000, new Array<u8>(need), 0) > 0)
    t.eqI32("room: one byte less is LZAV_NO_ROOM", lzav.compress(src, 0, 5000, new Array<u8>(need + 2), 3), LZAV_NO_ROOM)
    t.eqI32("room: an empty input writes nothing", lzav.compress(src, 0, 0, new Array<u8>(0), 0), 0)
  }

  {
    const src: u8[] = vector(0, 5000)
    const out: u8[] = new Array<u8>(lzavBound(5000))
    const end: i32 = lzav.compress(src, 0, 5000, out, 0)
    const back: u8[] = new Array<u8>(6000)
    t.eqI32("error: an empty stream for a nonzero length", lzavDecompress(out, 0, 0, back, 0, 10), LZAV_ERR_PARAMS)
    t.eqI32("error: a stream for a zero length", lzavDecompress(out, 0, end, back, 0, 0), LZAV_ERR_PARAMS)
    t.eqI32("error: nothing to nothing is fine", lzavDecompress(out, 0, 0, back, 0, 0), 0)
    t.eqI32("error: one byte longer is LZAV_ERR_LENGTH", lzavDecompress(out, 0, end, back, 0, 5001), LZAV_ERR_LENGTH)
    t.eqI32("error: one byte shorter is LZAV_ERR_OUTPUT", lzavDecompress(out, 0, end, back, 0, 4999), LZAV_ERR_OUTPUT)
    t.eqI32("error: the stream cut short is LZAV_ERR_TRUNCATED", lzavDecompress(out, 0, 20, back, 0, 5000), LZAV_ERR_TRUNCATED)
    const old: u8[] = [0x35, 0, 0, 0]
    t.eqI32("error: format 3 is LZAV_ERR_FORMAT", lzavDecompress(old, 0, 4, back, 0, 10), LZAV_ERR_FORMAT)
    const mref: u8[] = new Array<u8>(32)
    mref[0] = 0x40
    t.eqI32("error: a minimum match length of 0 is LZAV_ERR_FORMAT", lzavDecompress(mref, 0, 32, back, 0, 10), LZAV_ERR_FORMAT)
    // One literal, then a one-byte reference 128 back.
    const far: u8[] = new Array<u8>(32)
    far[0] = 0x45
    far[1] = 0x01
    far[2] = 97
    far[3] = 0x11
    far[4] = 0x10
    t.eqI32("error: a reference before the output's start is LZAV_ERR_DISTANCE", lzavDecompress(far, 0, 32, back, 0, 10), LZAV_ERR_DISTANCE)
    far[4] = 0
    t.eqI32("error: a reference of distance 0 is LZAV_ERR_DISTANCE", lzavDecompress(far, 0, 32, back, 0, 10), LZAV_ERR_DISTANCE)
  }

  {
    // Every prefix of a stream, and random corruption, answers a code or the
    // length; neither panics nor writes outside the window.
    const n: i32 = 3000
    const src: u8[] = stitched(rng, n)
    const out: u8[] = new Array<u8>(lzavBound(n))
    const end: i32 = lzav.compress(src, 0, n, out, 0)
    const back: u8[] = new Array<u8>(n + 8)
    back.fill(0x5a)
    let prefixOk: boolean = true
    for (let cut: i32 = 0; cut < end; cut++) {
      const got: i32 = lzavDecompress(out, 0, cut, back, 4, n)
      if (got >= 0 || !untouched(back, 4, 4 + n, 0x5a)) {
        prefixOk = false
      }
    }
    t.ok("prefix: every proper prefix is an error, nothing outside the window written", prefixOk)
    let corruptOk: boolean = true
    let errors: i32 = 0
    const bad: u8[] = new Array<u8>(end)
    for (let round: i32 = 0; round < 3000; round++) {
      for (let i: i32 = 0; i < end; i++) {
        bad[i] = out[i]
      }
      const flips: i32 = rng.nextInt(1, 4)
      for (let k: i32 = 0; k < flips; k++) {
        bad[rng.nextInt(1, end - 1)] = toU8(rng.nextInt(0, 255))
      }
      const got: i32 = lzavDecompress(bad, 0, end, back, 4, n)
      if (got < 0) {
        errors++
      } else if (got !== 4 + n) {
        corruptOk = false
      }
      if (!untouched(back, 4, 4 + n, 0x5a)) {
        corruptOk = false
      }
    }
    t.ok("corrupt: 3000 corrupted streams answer a code or the length, nothing outside the window written", corruptOk)
    t.ok(`corrupt: most are refused (${errors > 1000 ? "over 1000" : `${errors}`})`, errors > 1000)
  }
  return t.done()
}
