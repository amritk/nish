// `nish/compress/*` against itself: CRC-32 and Adler-32 check values; every
// level of raw DEFLATE, gzip and zlib round-tripping empty, one-byte, text,
// JSON, incompressible, run-length and 1 MB inputs, and a fuzz over random
// lengths and content; the bound, the no-room answer and the output limit;
// a reused compressor writing exactly what a fresh one does; malformed
// streams of every kind answering their error code (every prefix of a stream,
// and random corruption, never panicking); and the streaming writer and
// reader across random piece sizes. Node's zlib checks the same modules in
// `tests/link/std_compress_node`.
import { Crc32, adler32, adler32Update, crc32 } from "nish/compress/checksum"
import {
  DEFLATE_ERR_BLOCK_TYPE,
  DEFLATE_ERR_DISTANCE,
  DEFLATE_ERR_HUFFMAN,
  DEFLATE_ERR_OUTPUT_LIMIT,
  DEFLATE_ERR_STORED_LENGTH,
  DEFLATE_ERR_TRAILING,
  DEFLATE_ERR_TRUNCATED,
  DEFLATE_NO_ROOM,
  Deflater,
  Inflater,
  compressBound,
  deflateBound,
  deflateCompress,
  deflateDecompress,
} from "nish/compress/deflate"
import {
  GZIP_END,
  GZIP_ERR_CRC,
  GZIP_ERR_HEADER,
  GZIP_ERR_SIZE,
  GZIP_NEED_INPUT,
  GzipCompressor,
  GzipDecompressor,
  GzipReader,
  GzipWriter,
  gzipCompress,
  gzipDecompress,
} from "nish/compress/gzip"
import {
  ZLIB_ERR_ADLER,
  ZLIB_ERR_DICTIONARY,
  ZLIB_ERR_HEADER,
  ZlibCompressor,
  ZlibDecompressor,
  zlibCompress,
  zlibDecompress,
} from "nish/compress/zlib"
import { Rng } from "nish/random"
import { Suite } from "nish/testing"

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const n: i32 = toI32(text.length)
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < n && i < toI32(out.length); i++) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/** Whether `a[0 .. n)` and `b[off .. off + n)` hold the same bytes. */
const same = (a: u8[], b: u8[], off: i32, n: i32): boolean => {
  if (toI32(a.length) < n || off < 0 || toI32(b.length) - off < n) {
    return false
  }
  for (let i: i32 = 0; i < n && i < toI32(a.length); i++) {
    if (a[i] !== b[off + i]) {
      return false
    }
  }
  return true
}

/** A copy of `a`. */
const copyOf = (a: u8[], n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < n && i < toI32(out.length) && i < toI32(a.length); i++) {
    out[i] = a[i]
  }
  return out
}

/** CRC-32's check value, the CRC of "123456789". */
const CRC_CHECK: i64 = 0xcbf43926

const WORDS: string = "the of and a to in is you that it he was for on are as with his they at be this have from"

/** `n` bytes of English-like text: words of `WORDS` picked by `rng`, with punctuation. */
const text = (rng: Rng, n: i32): u8[] => {
  const words: u8[] = ascii(WORDS)
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < n) {
    // A word starts after a space of `WORDS`, or at its start.
    let w: i32 = rng.nextInt(0, toI32(words.length) - 1)
    while (w > 0 && words[w - 1] !== 32) {
      w -= 1
    }
    while (w < toI32(words.length) && words[w] !== 32 && i < n) {
      out[i] = words[w]
      w += 1
      i += 1
    }
    if (i < n) {
      out[i] = rng.nextInt(0, 9) === 0 ? 46 : 32
      i += 1
    }
  }
  return out
}

/** About `n` bytes of a JSON feed: objects with ids, names, flags and numbers. */
const json = (rng: Rng, n: i32): u8[] => {
  const parts: string[] = ["["]
  let size: i32 = 1
  let k: i32 = 0
  while (size < n) {
    const piece: string = `{"id":${rng.nextInt(0, 999999)},"name":"user${rng.nextInt(0, 500)}","active":${rng.nextInt(0, 1) === 1 ? "true" : "false"},"score":${rng.nextInt(0, 10000)}},`
    parts.push(piece)
    size += toI32(piece.length)
    k += 1
  }
  const all: u8[] = ascii(parts.join(""))
  return copyOf(all, n)
}

/** `n` random bytes: incompressible. */
const noise = (rng: Rng, n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < n && i < toI32(out.length); i++) {
    out[i] = toU8(rng.nextInt(0, 255))
  }
  return out
}

/** `n` bytes in runs of one value, of random lengths up to 600: long matches at distance 1. */
const runs = (rng: Rng, n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < n) {
    const v: u8 = toU8(rng.nextInt(0, 3))
    const len: i32 = rng.nextInt(1, 600)
    for (let k: i32 = 0; k < len && i < n && i < toI32(out.length); k++) {
      out[i] = v
      i += 1
    }
  }
  return out
}

/**
 * `n` bytes stitched from copies of earlier stretches at random distances up
 * to 40 KB, a little noise between: every distance code, matches across a
 * window's edge, and lengths up to 258 and past it.
 */
const stitched = (rng: Rng, n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < n) {
    if (i < 64 || rng.nextInt(0, 3) === 0) {
      out[i] = toU8(rng.nextInt(0, 255))
      i += 1
    } else {
      const far: i32 = rng.nextInt(1, i < 40000 ? i : 40000)
      const len: i32 = rng.nextInt(3, 300)
      for (let k: i32 = 0; k < len && i < n && i < toI32(out.length); k++) {
        out[i] = out[i - far]
        i += 1
      }
    }
  }
  return out
}

/** The three formats a round trip goes through. */
const RAW: i32 = 0
const GZIP: i32 = 1
const ZLIB: i32 = 2

/** Compresses `src[0 .. n)` in `format` at `level` into `out` from `at` with fresh objects. */
const compressIn = (format: i32, src: u8[], n: i32, out: u8[], at: i32, level: i32): i32 => {
  if (format === GZIP) {
    return gzipCompress(src, 0, n, out, at, level)
  }
  if (format === ZLIB) {
    return zlibCompress(src, 0, n, out, at, level)
  }
  return deflateCompress(src, 0, n, out, at, level)
}

/** Decompresses `src[off .. off + len)` in `format`. */
const decompressIn = (format: i32, src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 => {
  if (format === GZIP) {
    return gzipDecompress(src, off, len, out, at, limit)
  }
  if (format === ZLIB) {
    return zlibDecompress(src, off, len, out, at, limit)
  }
  return deflateDecompress(src, off, len, out, at, limit)
}

/** The objects one thread keeps: one compressor per level and format, one decompressor per format. */
class Kit {
  deflaters: Deflater[]
  gzips: GzipCompressor[]
  zlibs: ZlibCompressor[]
  inflater: Inflater
  gunzip: GzipDecompressor
  unzlib: ZlibDecompressor

  constructor() {
    this.deflaters = []
    this.gzips = []
    this.zlibs = []
    for (let level: i32 = 0; level <= 9; level++) {
      this.deflaters.push(new Deflater(level))
      this.gzips.push(new GzipCompressor(level))
      this.zlibs.push(new ZlibCompressor(level))
    }
    this.inflater = new Inflater()
    this.gunzip = new GzipDecompressor()
    this.unzlib = new ZlibDecompressor()
  }

  compress(format: i32, src: u8[], off: i32, n: i32, out: u8[], at: i32, level: i32): i32 {
    if (format === GZIP) {
      return this.gzips[level].compress(src, off, n, out, at)
    }
    if (format === ZLIB) {
      return this.zlibs[level].compress(src, off, n, out, at)
    }
    return this.deflaters[level].compress(src, off, n, out, at)
  }

  decompress(format: i32, src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 {
    if (format === GZIP) {
      return this.gunzip.decompress(src, off, len, out, at, limit)
    }
    if (format === ZLIB) {
      return this.unzlib.decompress(src, off, len, out, at, limit)
    }
    return this.inflater.decompress(src, off, len, out, at, limit)
  }
}

/** The name of a format. */
const formatName = (format: i32): string => (format === GZIP ? "gzip" : format === ZLIB ? "zlib" : "raw")

/**
 * Round-trips `src` through `format` at `level` with the kit's reused objects,
 * the output written from offset 7 of its buffer; answers "" or what went
 * wrong. Checks the bound, the exact limit and one byte under it.
 */
const roundTrip = (kit: Kit, format: i32, src: u8[], level: i32, out: u8[], back: u8[]): string => {
  const n: i32 = toI32(src.length)
  const end: i32 = kit.compress(format, src, 0, n, out, 7, level)
  if (end < 7) {
    return `compress answered ${end}`
  }
  if (end - 7 > compressBound(n)) {
    return `${end - 7} bytes for ${n}, over the bound ${compressBound(n)}`
  }
  const got: i32 = kit.decompress(format, out, 7, end - 7, back, 3, n)
  if (got !== 3 + n) {
    return `decompress answered ${got} for ${n} bytes`
  }
  if (!same(src, back, 3, n)) {
    return "decompressed to other bytes"
  }
  if (n > 0) {
    const short: i32 = kit.decompress(format, out, 7, end - 7, back, 3, n - 1)
    if (short !== DEFLATE_ERR_OUTPUT_LIMIT) {
      return `a limit of n - 1 answered ${short}`
    }
  }
  return ""
}

/** Runs `roundTrip` at every level in every format and reports one line per format. */
const everyLevel = (t: Suite, kit: Kit, name: string, src: u8[], out: u8[], back: u8[], top: i32): void => {
  for (let format: i32 = RAW; format <= ZLIB; format++) {
    let failure: string = ""
    for (let level: i32 = 0; level <= top && failure === ""; level++) {
      const why: string = roundTrip(kit, format, src, level, out, back)
      if (why !== "") {
        failure = `level ${level}: ${why}`
      }
    }
    if (failure === "") {
      t.pass(`round trip ${formatName(format)}: ${name}, levels 0 to ${top}`)
    } else {
      t.fail(`round trip ${formatName(format)}: ${name}, levels 0 to ${top}`, failure)
    }
  }
}

/** Writes `bits` low bits first into `out` as a raw DEFLATE stream, `value` bits at a time from the list. */
class Bits {
  out: u8[]
  acc: i32
  count: i32

  constructor() {
    this.out = []
    this.acc = 0
    this.count = 0
  }

  put(value: i32, n: i32): void {
    for (let i: i32 = 0; i < n; i++) {
      this.acc = this.acc | (((value >> i) & 1) << this.count)
      this.count += 1
      if (this.count === 8) {
        this.out.push(toU8(this.acc))
        this.acc = 0
        this.count = 0
      }
    }
  }

  /** A Huffman code, most significant bit first (RFC 1951 §3.1.1). */
  code(value: i32, n: i32): void {
    for (let i: i32 = n - 1; i >= 0; i--) {
      this.put((value >> i) & 1, 1)
    }
  }

  bytes(): u8[] {
    if (this.count > 0) {
      this.out.push(toU8(this.acc))
      this.acc = 0
      this.count = 0
    }
    return this.out
  }
}

/** The raw DEFLATE decompression of all of `src`, into a buffer of `room`. */
const inflateAll = (src: u8[], room: i32): i32 => {
  const back: u8[] = new Array<u8>(room)
  return deflateDecompress(src, 0, toI32(src.length), back, 0, room)
}

export const main = (): number => {
  const t = new Suite("compress")
  const rng = new Rng(20261028)

  // --- Checksums --------------------------------------------------------------
  const check: u8[] = ascii("123456789")
  t.ok("crc32: the check value of 123456789 is cbf43926", crc32(check, 0, 9) === toU32(CRC_CHECK))
  t.ok("crc32: of nothing is 0", crc32(check, 0, 0) === toU32(0))
  t.ok("adler32: the check value of 123456789 is 091e01de", adler32(check, 0, 9) === toU32(0x091e01de))
  t.ok("adler32: of nothing is 1", adler32(check, 0, 0) === toU32(1))
  t.ok("crc32: of a window", crc32(ascii("xx123456789yy"), 2, 9) === toU32(CRC_CHECK))
  {
    const big: u8[] = noise(rng, 100003)
    const crc = new Crc32()
    const whole: u32 = crc.update(toU32(0), big, 0, 100003)
    let piecewise: u32 = 0
    let adler: u32 = 1
    let at: i32 = 0
    while (at < 100003) {
      let len: i32 = rng.nextInt(0, 9000)
      if (len > 100003 - at) {
        len = 100003 - at
      }
      piecewise = crc.update(piecewise, big, at, len)
      adler = adler32Update(adler, big, at, len)
      at += len
    }
    t.ok("crc32: pieces of random lengths equal the whole", piecewise === whole)
    // Against the definition, one bit at a time, on both sides of the length
    // where an update splits into three streams, and from a running CRC.
    let agree: boolean = true
    const poly: u32 = 0xedb88320
    for (const n of [0, 7, 8, 511, 512, 513, 535, 536, 537, 1000, 5221, 65536, 100003]) {
      for (const from of [0, 3]) {
        const len: i32 = n > 100003 - from ? 100003 - from : n
        let r: u32 = 0xffffffff
        for (let i: i32 = from; i < from + len; i++) {
          r = r ^ toU32(big[i])
          for (let k: i32 = 0; k < 8; k++) {
            r = (r & 1) !== 0 ? (r >>> 1) ^ poly : r >>> 1
          }
        }
        if (crc.update(toU32(0), big, from, len) !== ~r) {
          agree = false
        }
      }
    }
    t.ok("crc32: every length, three streams or one, is the bitwise definition", agree)
    t.ok("adler32: pieces of random lengths equal the whole", adler === adler32(big, 0, 100003))
    // Adler-32's sums wrap past 5552 bytes of 0xff without reduction.
    const ones: u8[] = new Array<u8>(20000)
    ones.fill(255)
    let s1: i64 = 1
    let s2: i64 = 0
    for (let i: i32 = 0; i < 20000; i++) {
      s1 = (s1 + 255) % 65521
      s2 = (s2 + s1) % 65521
    }
    t.ok("adler32: 20000 bytes of ff against the definition", toI64(adler32(ones, 0, 20000)) === s2 * 65536 + s1)
  }

  // --- Round trips ------------------------------------------------------------
  const kit = new Kit()
  const out: u8[] = new Array<u8>(compressBound(1100000) + 16)
  const back: u8[] = new Array<u8>(1100000)
  everyLevel(t, kit, "empty", [], out, back, 9)
  everyLevel(t, kit, "one byte", [toU8(0x41)], out, back, 9)
  everyLevel(t, kit, "two bytes", [toU8(0), toU8(255)], out, back, 9)
  everyLevel(t, kit, "text, 20 KB", text(rng, 20000), out, back, 9)
  everyLevel(t, kit, "JSON, 5 KB", json(rng, 5221), out, back, 9)
  everyLevel(t, kit, "JSON, 200 KB", json(rng, 200000), out, back, 9)
  everyLevel(t, kit, "noise, 70 KB", noise(rng, 70000), out, back, 9)
  everyLevel(t, kit, "runs, 100 KB", runs(rng, 100000), out, back, 9)
  {
    const zeros: u8[] = new Array<u8>(140000)
    zeros.fill(0)
    everyLevel(t, kit, "zeros, 140 KB", zeros, out, back, 9)
  }
  everyLevel(t, kit, "stitched, 1 MB", stitched(rng, 1048576), out, back, 9)
  everyLevel(t, kit, "text, 1 MB", text(rng, 1048576), out, back, 6)

  // A fuzz over lengths 0 to 3000 (most under 300, where fixed blocks win) and every kind of content.
  {
    let failure: string = ""
    for (let i: i32 = 0; i < 1500 && failure === ""; i++) {
      const n: i32 = rng.nextInt(0, i < 1200 ? 300 : 3000)
      const kind: i32 = rng.nextInt(0, 4)
      const src: u8[] =
        kind === 0 ? text(rng, n) : kind === 1 ? json(rng, n) : kind === 2 ? noise(rng, n) : kind === 3 ? runs(rng, n) : stitched(rng, n)
      const level: i32 = rng.nextInt(0, 9)
      const format: i32 = rng.nextInt(0, 2)
      const why: string = roundTrip(kit, format, src, level, out, back)
      if (why !== "") {
        failure = `case ${i} (${formatName(format)}, level ${level}, kind ${kind}, ${n} bytes): ${why}`
      }
    }
    if (failure === "") {
      t.pass("fuzz: 1500 random inputs, random level and format")
    } else {
      t.fail("fuzz: 1500 random inputs, random level and format", failure)
    }
  }

  // --- Reuse, windows, room --------------------------------------------------
  {
    const a: u8[] = json(rng, 9000)
    const b: u8[] = text(rng, 7000)
    let differ: string = ""
    for (let level: i32 = 0; level <= 9; level++) {
      const used = new Deflater(level)
      const scratch: u8[] = new Array<u8>(deflateBound(9000))
      used.compress(a, 0, 9000, scratch, 0)
      used.compress(b, 0, 7000, scratch, 0)
      const reused: u8[] = new Array<u8>(deflateBound(9000))
      const r: i32 = used.compress(a, 0, 9000, reused, 0)
      const fresh: u8[] = new Array<u8>(deflateBound(9000))
      const f: i32 = new Deflater(level).compress(a, 0, 9000, fresh, 0)
      if (r !== f || !same(copyOf(reused, r), fresh, 0, r)) {
        differ = `level ${level}`
      }
    }
    t.eqStr("reuse: a reused Deflater writes what a fresh one does", differ, "")
  }
  {
    // A window in the middle of the input, into the middle of the output.
    const src: u8[] = json(rng, 4000)
    const gz = new GzipCompressor(6)
    const buf: u8[] = new Array<u8>(compressBound(1000) + 50)
    buf.fill(0xaa)
    const end: i32 = gz.compress(src, 1500, 1000, buf, 20)
    let untouched: boolean = true
    for (let i: i32 = 0; i < 20; i++) {
      if (buf[i] !== 0xaa) {
        untouched = false
      }
    }
    for (let i: i32 = end; i < toI32(buf.length); i++) {
      if (buf[i] !== 0xaa) {
        untouched = false
      }
    }
    t.ok("window: nothing outside [at, end) is written", untouched)
    const got: u8[] = new Array<u8>(1000)
    const n: i32 = new GzipDecompressor().decompress(buf, 20, end - 20, got, 0, 1000)
    let match: boolean = n === 1000
    for (let i: i32 = 0; i < 1000 && match; i++) {
      if (got[i] !== src[1500 + i]) {
        match = false
      }
    }
    t.ok("window: the middle 1000 bytes come back", match)
  }
  {
    const src: u8[] = json(rng, 5000)
    for (let format: i32 = RAW; format <= ZLIB; format++) {
      const full: u8[] = new Array<u8>(compressBound(5000))
      const need: i32 = kit.compress(format, src, 0, 5000, full, 0, 1)
      const exact: u8[] = new Array<u8>(need)
      const shortBuf: u8[] = new Array<u8>(need - 1)
      t.eqI32(`room ${formatName(format)}: exactly the size it needs`, kit.compress(format, src, 0, 5000, exact, 0, 1), need)
      t.eqI32(`room ${formatName(format)}: one byte less is -1`, kit.compress(format, src, 0, 5000, shortBuf, 0, 1), DEFLATE_NO_ROOM)
      t.eqI32(`room ${formatName(format)}: no room at all is -1`, kit.compress(format, src, 0, 5000, new Array<u8>(0), 0, 1), DEFLATE_NO_ROOM)
    }
    // Incompressible input at every level stays inside the bound, stored.
    const rough: u8[] = noise(rng, 200000)
    let worst: i32 = 0
    for (let level: i32 = 0; level <= 9; level++) {
      const n: i32 = kit.compress(RAW, rough, 0, 200000, out, 0, level)
      if (n > worst) {
        worst = n
      }
    }
    t.ok(`bound: 200 KB of noise takes at most deflateBound (${worst} <= ${deflateBound(200000)})`, worst <= deflateBound(200000))
    t.ok("bound: noise is stored, so at most 5 bytes per 16 KB block over", worst <= 200000 + 5 * 14 + 8)
  }
  {
    // A small stream that expands far: the limit refuses it.
    const zeros: u8[] = new Array<u8>(1000000)
    zeros.fill(0)
    const end: i32 = kit.compress(GZIP, zeros, 0, 1000000, out, 0, 9)
    t.ok(`limit: a megabyte of zeros is ${end} bytes`, end < 2000)
    const small: u8[] = new Array<u8>(1000000)
    t.eqI32("limit: 64 KB of it is refused", kit.decompress(GZIP, out, 0, end, small, 0, 65536), DEFLATE_ERR_OUTPUT_LIMIT)
    const half: u8[] = new Array<u8>(500000)
    t.eqI32("limit: an output buffer shorter than the limit is the limit", kit.decompress(GZIP, out, 0, end, half, 0, 2000000), DEFLATE_ERR_OUTPUT_LIMIT)
    t.eqI32("limit: all of it fits", kit.decompress(GZIP, out, 0, end, small, 0, 1000000), 1000000)
  }

  // --- Malformed streams ------------------------------------------------------
  {
    const src: u8[] = json(rng, 3000)
    for (let format: i32 = RAW; format <= ZLIB; format++) {
      const end: i32 = kit.compress(format, src, 0, 3000, out, 0, 6)
      let failure: string = ""
      for (let cut: i32 = 0; cut < end && failure === ""; cut++) {
        const r: i32 = kit.decompress(format, out, 0, cut, back, 0, 3000)
        if (r >= 0) {
          failure = `a prefix of ${cut} bytes answered ${r}`
        }
      }
      t.eqStr(`truncated ${formatName(format)}: every prefix is refused`, failure, "")
      t.eqI32(`truncated ${formatName(format)}: the last byte missing`, kit.decompress(format, out, 0, end - 1, back, 0, 3000), format === RAW ? DEFLATE_ERR_TRUNCATED : DEFLATE_ERR_TRUNCATED)
      // Random corruption: one to four bytes changed. Whatever it answers, it
      // answers; a gzip or zlib stream must notice through its checksum.
      let accepted: i32 = 0
      for (let i: i32 = 0; i < 300; i++) {
        const bad: u8[] = copyOf(out, end)
        const flips: i32 = rng.nextInt(1, 4)
        for (let k: i32 = 0; k < flips; k++) {
          const at: i32 = rng.nextInt(0, end - 1)
          bad[at] = toU8(toI32(bad[at]) ^ rng.nextInt(1, 255))
        }
        const r: i32 = kit.decompress(format, bad, 0, end, back, 0, 3000)
        if (r >= 0 && !(r === 3000 && same(src, back, 0, 3000))) {
          accepted += 1
        }
      }
      if (format === RAW) {
        t.pass("corrupted raw: 300 corrupted streams decompressed without a panic")
      } else {
        t.eqI32(`corrupted ${formatName(format)}: no corrupted stream decompresses to other bytes`, accepted, 0)
      }
    }
    const gz: u8[] = new Array<u8>(compressBound(3000))
    const end: i32 = kit.compress(GZIP, src, 0, 3000, gz, 0, 1)
    const wrongCrc: u8[] = copyOf(gz, end)
    wrongCrc[end - 8] = toU8(toI32(wrongCrc[end - 8]) ^ 1)
    t.eqI32("gzip: a wrong CRC-32", kit.decompress(GZIP, wrongCrc, 0, end, back, 0, 3000), GZIP_ERR_CRC)
    const wrongSize: u8[] = copyOf(gz, end)
    wrongSize[end - 4] = toU8(toI32(wrongSize[end - 4]) ^ 1)
    t.eqI32("gzip: a wrong length", kit.decompress(GZIP, wrongSize, 0, end, back, 0, 3000), GZIP_ERR_SIZE)
    const wrongMagic: u8[] = copyOf(gz, end)
    wrongMagic[1] = 0x8c
    t.eqI32("gzip: the wrong magic", kit.decompress(GZIP, wrongMagic, 0, end, back, 0, 3000), GZIP_ERR_HEADER)
    const wrongMethod: u8[] = copyOf(gz, end)
    wrongMethod[2] = 7
    t.eqI32("gzip: a method other than 8", kit.decompress(GZIP, wrongMethod, 0, end, back, 0, 3000), GZIP_ERR_HEADER)
    const reserved: u8[] = copyOf(gz, end)
    reserved[3] = 0x20
    t.eqI32("gzip: a reserved flag", kit.decompress(GZIP, reserved, 0, end, back, 0, 3000), GZIP_ERR_HEADER)
    // Two members, then trailing garbage.
    const two: u8[] = copyOf(gz, end)
    for (let i: i32 = 0; i < end; i++) {
      two.push(gz[i])
    }
    t.eqI32("gzip: two members decompress one after the other", kit.decompress(GZIP, two, 0, 2 * end, back, 0, 6000), 6000)
    t.ok("gzip: the second member's bytes follow the first's", same(src, back, 3000, 3000))
    const tail: u8[] = copyOf(gz, end)
    tail.push(0)
    tail.push(0)
    t.eqI32("gzip: trailing bytes after the member", kit.decompress(GZIP, tail, 0, end + 2, back, 0, 3000), GZIP_ERR_HEADER)
    t.eqI32("gzip: an empty input is truncated", kit.decompress(GZIP, gz, 0, 0, back, 0, 3000), DEFLATE_ERR_TRUNCATED)
    // A header with every optional field: FEXTRA, FNAME, FCOMMENT, FHCRC.
    const full: u8[] = [0x1f, 0x8b, 8, 30, 0, 0, 0, 0, 0, 3, 3, 0, 1, 2, 3]
    for (const c of ascii("name.json")) {
      full.push(c)
    }
    full.push(0)
    for (const c of ascii("a comment")) {
      full.push(c)
    }
    full.push(0)
    const hcrc: u32 = crc32(full, 0, toI32(full.length)) & 0xffff
    full.push(toU8(hcrc & 255))
    full.push(toU8(hcrc >>> 8))
    const headerLength: i32 = toI32(full.length)
    for (let i: i32 = 10; i < end; i++) {
      full.push(gz[i])
    }
    t.eqI32("gzip: FEXTRA, FNAME, FCOMMENT and FHCRC are read", kit.decompress(GZIP, full, 0, toI32(full.length), back, 0, 3000), 3000)
    full[headerLength - 1] = toU8(toI32(full[headerLength - 1]) ^ 1)
    t.eqI32("gzip: a wrong header CRC", kit.decompress(GZIP, full, 0, toI32(full.length), back, 0, 3000), GZIP_ERR_HEADER)

    const z: u8[] = new Array<u8>(compressBound(3000))
    const zend: i32 = kit.compress(ZLIB, src, 0, 3000, z, 0, 6)
    t.ok("zlib: the header is 78 9c at level 6", z[0] === 0x78 && z[1] === 0x9c)
    const wrongAdler: u8[] = copyOf(z, zend)
    wrongAdler[zend - 1] = toU8(toI32(wrongAdler[zend - 1]) ^ 1)
    t.eqI32("zlib: a wrong Adler-32", kit.decompress(ZLIB, wrongAdler, 0, zend, back, 0, 3000), ZLIB_ERR_ADLER)
    const badCheck: u8[] = copyOf(z, zend)
    badCheck[1] = 0x9d
    t.eqI32("zlib: a header whose check fails", kit.decompress(ZLIB, badCheck, 0, zend, back, 0, 3000), ZLIB_ERR_HEADER)
    const dict: u8[] = [0x78, 0xbb, 0, 0, 0, 1]
    t.eqI32("zlib: a preset dictionary is refused", kit.decompress(ZLIB, dict, 0, 6, back, 0, 3000), ZLIB_ERR_DICTIONARY)
    const ztail: u8[] = copyOf(z, zend)
    ztail.push(1)
    t.eqI32("zlib: trailing bytes", kit.decompress(ZLIB, ztail, 0, zend + 1, back, 0, 3000), DEFLATE_ERR_TRAILING)
    const raw: u8[] = new Array<u8>(deflateBound(3000))
    const rend: i32 = kit.compress(RAW, src, 0, 3000, raw, 0, 6)
    const rtail: u8[] = copyOf(raw, rend)
    rtail.push(1)
    t.eqI32("raw: trailing bytes", kit.decompress(RAW, rtail, 0, rend + 1, back, 0, 3000), DEFLATE_ERR_TRAILING)
    t.eqI32("raw: the consumed count says where the stream ended", kit.inflater.consumed, rend)
  }
  {
    // Hand-made streams, each malformed in one way.
    const reservedType = new Bits()
    reservedType.put(1, 1)
    reservedType.put(3, 2)
    t.eqI32("deflate: block type 3 is reserved", inflateAll(reservedType.bytes(), 100), DEFLATE_ERR_BLOCK_TYPE)
    const nlen: u8[] = [1, 5, 0, 0xfa, 0xfe, 1, 2, 3, 4, 5]
    t.eqI32("deflate: a stored block whose NLEN is not ~LEN", inflateAll(nlen, 100), DEFLATE_ERR_STORED_LENGTH)
    const stored: u8[] = [1, 5, 0, 0xfa, 0xff, 1, 2, 3, 4, 5]
    t.eqI32("deflate: the same stored block, well formed", inflateAll(stored, 100), 5)
    const storedShort: u8[] = [1, 5, 0, 0xfa, 0xff, 1, 2, 3]
    t.eqI32("deflate: a stored block cut short", inflateAll(storedShort, 100), DEFLATE_ERR_TRUNCATED)
    // Fixed code: literal 'a' (0x61 -> 0x30 + 0x61 = 0x91, 8 bits), then a
    // match of length 3 at distance 2 with only one byte before it.
    const far = new Bits()
    far.put(1, 1)
    far.put(1, 2)
    far.code(0x30 + 0x61, 8)
    far.code(1, 7)
    far.code(1, 5)
    far.code(0, 7)
    t.eqI32("deflate: a distance before the start of the output", inflateAll(far.bytes(), 100), DEFLATE_ERR_DISTANCE)
    const near = new Bits()
    near.put(1, 1)
    near.put(1, 2)
    near.code(0x30 + 0x61, 8)
    near.code(1, 7)
    near.code(0, 5)
    near.code(0, 7)
    t.eqI32("deflate: the same match at distance 1 is aaaa", inflateAll(near.bytes(), 100), 4)
    // Fixed literal/length 286 (11000110, eight bits) is not a symbol.
    const bad286 = new Bits()
    bad286.put(1, 1)
    bad286.put(1, 2)
    bad286.code(0xc6, 8)
    t.eqI32("deflate: literal/length 286 is refused", inflateAll(bad286.bytes(), 100), -6)
    // Fixed distance 30 (11110) is not a symbol.
    const bad30 = new Bits()
    bad30.put(1, 1)
    bad30.put(1, 2)
    bad30.code(0x30 + 0x61, 8)
    bad30.code(1, 7)
    bad30.code(30, 5)
    bad30.code(0, 7)
    t.eqI32("deflate: distance 30 is refused", inflateAll(bad30.bytes(), 100), -6)
    // A dynamic header whose code-length code is over-subscribed: four
    // lengths of 1.
    const over = new Bits()
    over.put(1, 1)
    over.put(2, 2)
    over.put(0, 5)
    over.put(0, 5)
    over.put(0, 4)
    over.put(1, 3)
    over.put(1, 3)
    over.put(1, 3)
    over.put(1, 3)
    for (let i: i32 = 0; i < 60; i++) {
      over.put(0, 8)
    }
    t.eqI32("deflate: an over-subscribed code is refused", inflateAll(over.bytes(), 100), DEFLATE_ERR_HUFFMAN)
    // A dynamic header that repeats (16) before any length.
    const rep = new Bits()
    rep.put(1, 1)
    rep.put(2, 2)
    rep.put(0, 5)
    rep.put(0, 5)
    rep.put(0, 4)
    // Code lengths for 16, 17, 18, 0: 1, 0, 0, 1 — a complete two-code code.
    rep.put(1, 3)
    rep.put(0, 3)
    rep.put(0, 3)
    rep.put(1, 3)
    // Symbol 16 has code 1 (the second of two one-bit codes, by order 0 < 16).
    rep.code(1, 1)
    rep.put(0, 2)
    for (let i: i32 = 0; i < 60; i++) {
      rep.put(0, 8)
    }
    t.eqI32("deflate: a repeat with no length before it", inflateAll(rep.bytes(), 100), DEFLATE_ERR_HUFFMAN)
    // A dynamic block with no end-of-block code: 257 lengths, all zero, by
    // runs of 18.
    const noEnd = new Bits()
    noEnd.put(1, 1)
    noEnd.put(2, 2)
    noEnd.put(0, 5)
    noEnd.put(0, 5)
    noEnd.put(0, 4)
    // Lengths for 16, 17, 18, 0: 0, 0, 1, 1.
    noEnd.put(0, 3)
    noEnd.put(0, 3)
    noEnd.put(1, 3)
    noEnd.put(1, 3)
    // 18 is the second code (1): 138 zeros, 119 zeros, then one 0 for the distance.
    noEnd.code(1, 1)
    noEnd.put(127, 7)
    noEnd.code(1, 1)
    noEnd.put(108, 7)
    noEnd.code(0, 1)
    for (let i: i32 = 0; i < 10; i++) {
      noEnd.put(0, 8)
    }
    t.eqI32("deflate: a code with no end-of-block", inflateAll(noEnd.bytes(), 100), DEFLATE_ERR_HUFFMAN)
    t.eqI32("deflate: an empty stream is truncated", inflateAll([], 100), DEFLATE_ERR_TRUNCATED)
    t.eqI32("deflate: a lone non-final block runs out", inflateAll([0, 0, 0, 0xff, 0xff], 100), DEFLATE_ERR_TRUNCATED)
  }

  // --- Streaming --------------------------------------------------------------
  {
    const src: u8[] = stitched(rng, 400000)
    const n: i32 = toI32(src.length)
    const w = new GzipWriter(1)
    const piece: u8[] = new Array<u8>(w.bound(20000))
    const stream: u8[] = []
    let at: i32 = 0
    let flushed: boolean = false
    while (at < n) {
      let len: i32 = rng.nextInt(0, 20000)
      if (len > n - at) {
        len = n - at
      }
      const end: i32 = w.write(src, at, len, piece, 0)
      for (let i: i32 = 0; i < end; i++) {
        stream.push(piece[i])
      }
      at += len
      if (!flushed && at > n / 2) {
        flushed = true
        const f: i32 = w.flush(piece, 0)
        for (let i: i32 = 0; i < f; i++) {
          stream.push(piece[i])
        }
        // Everything so far decodes: the stream up to here, read by a
        // GzipReader with no end of input, gives every byte written.
        const half = new GzipReader(toI64(n))
        let fed: i32 = 0
        let got: i32 = 0
        const into: u8[] = new Array<u8>(4096)
        let ok: boolean = true
        while (true) {
          const r: i32 = half.read(into, 0, 4096)
          if (r > 0) {
            for (let i: i32 = 0; i < r; i++) {
              if (into[i] !== src[got + i]) {
                ok = false
              }
            }
            got += r
          } else if (r === GZIP_NEED_INPUT && fed < toI32(stream.length)) {
            fed += half.feed(stream, fed, toI32(stream.length) - fed)
          } else {
            break
          }
        }
        t.ok(`writer: after a flush the reader has every byte written (${got} of ${at})`, ok && got === at)
      }
    }
    const fin: i32 = w.finish(piece, 0)
    for (let i: i32 = 0; i < fin; i++) {
      stream.push(piece[i])
    }
    t.eqI32("writer: the stream is one gzip member", kit.decompress(GZIP, stream, 0, toI32(stream.length), back, 0, n), n)
    t.ok("writer: its bytes are the input", same(src, back, 0, n))
    w.start()
    const again: u8[] = new Array<u8>(w.bound(n))
    let e: i32 = w.write(src, 0, 1000, again, 0)
    e = w.finish(again, e)
    t.eqI32("writer: start begins a new body", kit.decompress(GZIP, again, 0, e, back, 0, n), 1000)
    t.ok("writer: the new body is its own bytes", same(copyOf(src, 1000), back, 0, 1000))

    // Noise into exactly `bound` at every call, the first window too: no
    // write, flush or finish runs out of room, at any level, for pieces
    // small and large.
    for (const level of [0, 1, 6, 9]) {
      const loud: u8[] = noise(rng, 300000)
      const nw = new GzipWriter(level)
      const noisy: u8[] = []
      let pos: i32 = 0
      let k: i32 = 0
      while (pos < 300000) {
        let len: i32 = k % 5 === 4 ? rng.nextInt(60000, 200000) : rng.nextInt(1, 1000)
        if (len > 300000 - pos) {
          len = 300000 - pos
        }
        const room: u8[] = new Array<u8>(nw.bound(len))
        const end: i32 = k % 7 === 6 ? nw.flush(room, 0) : nw.write(loud, pos, len, room, 0)
        for (let i: i32 = 0; i < end; i++) {
          noisy.push(room[i])
        }
        if (k % 7 !== 6) {
          pos += len
        }
        k += 1
      }
      const last: u8[] = new Array<u8>(nw.bound(toI32(0)))
      const fe: i32 = nw.finish(last, 0)
      for (let i: i32 = 0; i < fe; i++) {
        noisy.push(last[i])
      }
      const into: u8[] = new Array<u8>(300000)
      t.eqI32(`writer: noise at level ${level} into exactly bound`, kit.decompress(GZIP, noisy, 0, toI32(noisy.length), into, 0, 300000), 300000)
      t.ok(`writer: noise at level ${level} comes back`, same(loud, into, 0, 300000))
    }

    // The reader across random piece sizes, the input ended by endInput.
    const r = new GzipReader(toI64(n))
    let fed: i32 = 0
    let got: i32 = 0
    let ok: boolean = true
    let last: i32 = 0
    const into: u8[] = new Array<u8>(3000)
    while (true) {
      const m: i32 = r.read(into, 0, rng.nextInt(1, 3000))
      if (m > 0) {
        for (let i: i32 = 0; i < m && got + i < n; i++) {
          if (into[i] !== src[got + i]) {
            ok = false
          }
        }
        got += m
      } else if (m === GZIP_NEED_INPUT) {
        if (fed === toI32(stream.length)) {
          r.endInput()
        } else {
          const room: i32 = r.inputRoom()
          let len: i32 = rng.nextInt(1, 700)
          if (len > room) {
            len = room
          }
          if (len > toI32(stream.length) - fed) {
            len = toI32(stream.length) - fed
          }
          copyIn(r.inputBuffer(), r.inputEnd(), stream, fed, len)
          r.commit(len)
          fed += len
        }
      } else {
        last = m
        break
      }
    }
    t.eqI32("reader: the stream ends", last, GZIP_END)
    t.ok(`reader: every byte comes back in order (${got} of ${n})`, ok && got === n)
    const capped = new GzipReader(toI64(1000))
    capped.feed(stream, 0, toI32(stream.length) < 16384 ? toI32(stream.length) : 16384)
    let answer: i32 = 0
    let total: i32 = 0
    while (true) {
      answer = capped.read(into, 0, 3000)
      if (answer > 0) {
        total += answer
      } else {
        break
      }
    }
    t.eqI32("reader: the limit stops it", answer, DEFLATE_ERR_OUTPUT_LIMIT)
    t.ok(`reader: no more than the limit was handed out (${total})`, total <= 1000)
    t.eqI32("reader: the error is final", capped.read(into, 0, 3000), DEFLATE_ERR_OUTPUT_LIMIT)
    const cut = new GzipReader(toI64(n))
    cut.feed(stream, 0, 5000)
    cut.endInput()
    let cutAnswer: i32 = 0
    while (true) {
      cutAnswer = cut.read(into, 0, 3000)
      if (cutAnswer <= 0) {
        break
      }
    }
    t.eqI32("reader: input that ends inside the stream", cutAnswer, DEFLATE_ERR_TRUNCATED)
    // A header whose FNAME is longer than the reader's input buffer is
    // refused, not buffered without bound.
    const long = new GzipReader(toI64(n))
    const named: u8[] = [0x1f, 0x8b, 8, 8, 0, 0, 0, 0, 0, 255]
    for (let i: i32 = 0; i < 40000; i++) {
      named.push(97)
    }
    let longAnswer: i32 = 0
    let longFed: i32 = 0
    while (true) {
      longAnswer = long.read(into, 0, 3000)
      if (longAnswer === GZIP_NEED_INPUT && longFed < toI32(named.length)) {
        longFed += long.feed(named, longFed, toI32(named.length) - longFed)
      } else {
        break
      }
    }
    t.eqI32("reader: a header longer than the input buffer is refused", longAnswer, GZIP_ERR_HEADER)
    t.ok(`reader: having buffered at most 16 KB of it (${longFed})`, longFed <= 16384)
  }
  return t.done()
}

/** Copies `src[from .. from + n)` into `dst` at `at`. */
const copyIn = (dst: u8[], at: i32, src: u8[], from: i32, n: i32): void => {
  for (let i: i32 = 0; i < n && at + i < toI32(dst.length) && from + i < toI32(src.length); i++) {
    dst[at + i] = src[from + i]
  }
}
