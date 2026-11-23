// Truncated and corrupt zlib and gzip streams answer errors, and a
// `GzipWriter` used after `finish` answers `GZIP_ERR_FINISHED`. Every prefix of a valid stream is
// fed to `ZlibDecompressor`, `GzipDecompressor` and `GzipReader`, each byte
// of the stream is flipped in turn, and every output window shorter than the
// stream is offered to the compressors and the writer.
import { DEFLATE_ERR_TRAILING, DEFLATE_ERR_TRUNCATED, DEFLATE_NO_ROOM } from "nish/compress/deflate"
import {
  GZIP_END,
  GZIP_ERR_CRC,
  GZIP_ERR_FINISHED,
  GZIP_ERR_SIZE,
  GZIP_NEED_INPUT,
  GzipCompressor,
  GzipDecompressor,
  GzipFixedCompressor,
  GzipReader,
  GzipWriter,
  gzipFixedBound,
} from "nish/compress/gzip"
import { ZLIB_ERR_ADLER, ZLIB_ERR_DICTIONARY, ZLIB_ERR_HEADER, ZlibCompressor, ZlibDecompressor } from "nish/compress/zlib"
import { Suite } from "nish/testing"

/** `n` bytes of text-like data that compresses but not to nothing. */
const sample = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  let x: u32 = 2463534242
  for (let i: i32 = 0; i < n; i++) {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    out[i] = toU8(toU32(97) + (x % 8))
  }
  return out
}

/** Whether `a[0 .. n)` equals `b[0 .. n)`. */
const same = (a: u8[], b: u8[], n: i32): boolean => {
  for (let i: i32 = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

/**
 * Reads `stream[0 .. len)` through a `GzipReader`, ending the input, and
 * answers its last non-positive answer; or 1 when it answered `GZIP_END`
 * having handed out other bytes than `want`.
 */
const readAll = (stream: u8[], len: i32, want: u8[]): i32 => {
  const r = new GzipReader(toI64(want.length))
  const into: u8[] = new Array<u8>(4096)
  let fed: i32 = 0
  let got: i32 = 0
  let ok: boolean = true
  let ended: boolean = false
  while (true) {
    const m: i32 = r.read(into, 0, 4096)
    if (m > 0) {
      for (let i: i32 = 0; i < m; i++) {
        if (got + i >= toI32(want.length) || into[i] !== want[got + i]) {
          ok = false
        }
      }
      got += m
      continue
    }
    if (m === GZIP_END && !(ok && got === toI32(want.length))) {
      return 1
    }
    if (m !== GZIP_NEED_INPUT) {
      return m
    }
    if (fed < len) {
      fed += r.feed(stream, fed, len - fed)
    } else if (!ended) {
      ended = true
      r.endInput()
    } else {
      return m
    }
  }
}

export const main = (): number => {
  const t = new Suite("compress errors")
  const n: i32 = 3000
  const src: u8[] = sample(n)
  const back: u8[] = new Array<u8>(n)

  // --- zlib -----------------------------------------------------------------
  {
    const z = new ZlibCompressor(6)
    const d = new ZlibDecompressor()
    const stream: u8[] = new Array<u8>(n + 100)
    const len: i32 = z.compress(src, 0, n, stream, 0)
    t.ok(`zlib: the stream compresses (${len} bytes)`, len > 6)
    t.eqI32("zlib: the whole stream decodes", d.decompress(stream, 0, len, back, 0, n), n)
    let prefixes: i32 = 0
    for (let k: i32 = 0; k < len; k++) {
      if (d.decompress(stream, 0, k, back, 0, n) === DEFLATE_ERR_TRUNCATED) {
        prefixes += 1
      }
    }
    t.eqI32("zlib: every prefix is truncated", prefixes, len)
    let flips: i32 = 0
    for (let k: i32 = 0; k < len; k++) {
      stream[k] = toU8(toI32(stream[k]) ^ 0x10)
      const r: i32 = d.decompress(stream, 0, len, back, 0, n)
      if (r < 0 || r === n) {
        flips += 1
      }
      stream[k] = toU8(toI32(stream[k]) ^ 0x10)
    }
    // Not "the data itself": a flip in the padding after the last block
    // changes nothing, and one here (byte 1044) decodes to bytes that differ
    // by -1, +2 and -1 in a row, which leaves both Adler-32 sums unchanged,
    // a collision RFC 1950's check cannot see. Every answer is an error or
    // a whole decode whose Adler-32 matched.
    t.eqI32("zlib: every flipped byte is an error or a decode whose Adler-32 matched", flips, len)
    stream[len - 1] = toU8(toI32(stream[len - 1]) ^ 1)
    t.eqI32("zlib: a wrong Adler-32", d.decompress(stream, 0, len, back, 0, n), ZLIB_ERR_ADLER)
    stream[len - 1] = toU8(toI32(stream[len - 1]) ^ 1)
    stream[len] = 0
    t.eqI32("zlib: a byte after the trailer", d.decompress(stream, 0, len + 1, back, 0, n), DEFLATE_ERR_TRAILING)
    // CMF 0x78 with FDICT set and FCHECK fixed up: 0x78bb is 31 * 991.
    const dict: u8[] = [0x78, 0xbb, 0, 0, 0, 0]
    t.eqI32("zlib: a preset dictionary", d.decompress(dict, 0, 6, back, 0, n), ZLIB_ERR_DICTIONARY)
    const method: u8[] = [0x77, 0x01, 3, 0, 0, 0, 0, 1]
    t.eqI32("zlib: a method other than 8", d.decompress(method, 0, 8, back, 0, n), ZLIB_ERR_HEADER)
    let small: i32 = 0
    for (let k: i32 = 0; k < len; k++) {
      const out: u8[] = new Array<u8>(k)
      if (z.compress(src, 0, n, out, 0) === DEFLATE_NO_ROOM) {
        small += 1
      }
    }
    t.eqI32("zlib: every window shorter than the stream has no room", small, len)
    const at: u8[] = new Array<u8>(len + 5)
    t.eqI32("zlib: a window that ends short of the trailer", z.compress(src, 0, n, at, 6), DEFLATE_NO_ROOM)
  }

  // --- gzip -----------------------------------------------------------------
  {
    const g = new GzipCompressor(6)
    const d = new GzipDecompressor()
    const stream: u8[] = new Array<u8>(n + 100)
    const len: i32 = g.compress(src, 0, n, stream, 0)
    t.ok(`gzip: the stream compresses (${len} bytes)`, len > 18)
    t.eqI32("gzip: the whole stream decodes", d.decompress(stream, 0, len, back, 0, n), n)
    t.eqI32("gzip: the reader gives the whole stream", readAll(stream, len, src), GZIP_END)
    let prefixes: i32 = 0
    let readerPrefixes: i32 = 0
    for (let k: i32 = 0; k < len; k++) {
      if (d.decompress(stream, 0, k, back, 0, n) < 0) {
        prefixes += 1
      }
      const r: i32 = readAll(stream, k, src)
      if (r < 0 && r !== GZIP_END) {
        readerPrefixes += 1
      }
    }
    t.eqI32("gzip: every prefix is an error", prefixes, len)
    t.eqI32("gzip: every prefix ended by endInput is an error to the reader", readerPrefixes, len)
    let flips: i32 = 0
    let readerFlips: i32 = 0
    for (let k: i32 = 0; k < len; k++) {
      // Bytes 4 to 9 are MTIME, XFL and OS, which RFC 1952 has a reader
      // ignore, so a flip there is not an error and is not counted.
      if (k >= 4 && k < 10) {
        continue
      }
      stream[k] = toU8(toI32(stream[k]) ^ 0x10)
      const got: i32 = d.decompress(stream, 0, len, back, 0, n)
      if (got < 0 || (got === n && same(src, back, n))) {
        flips += 1
      }
      const r: i32 = readAll(stream, len, src)
      if (r < 0) {
        readerFlips += 1
      }
      stream[k] = toU8(toI32(stream[k]) ^ 0x10)
    }
    t.eqI32("gzip: every checked byte flipped is an error or the data itself", flips, len - 6)
    t.eqI32("gzip: every checked byte flipped is an error to the reader or the data itself", readerFlips, len - 6)
    stream[len - 8] = toU8(toI32(stream[len - 8]) ^ 1)
    t.eqI32("gzip: a wrong CRC-32", d.decompress(stream, 0, len, back, 0, n), GZIP_ERR_CRC)
    stream[len - 8] = toU8(toI32(stream[len - 8]) ^ 1)
    stream[len - 4] = toU8(toI32(stream[len - 4]) ^ 1)
    t.eqI32("gzip: a wrong ISIZE", d.decompress(stream, 0, len, back, 0, n), GZIP_ERR_SIZE)
    stream[len - 4] = toU8(toI32(stream[len - 4]) ^ 1)
    let small: i32 = 0
    for (let k: i32 = 0; k < len; k++) {
      const out: u8[] = new Array<u8>(k)
      if (g.compress(src, 0, n, out, 0) === DEFLATE_NO_ROOM) {
        small += 1
      }
    }
    t.eqI32("gzip: every window shorter than the stream has no room", small, len)
    const fixed = new GzipFixedCompressor()
    const room: i32 = gzipFixedBound(n)
    const whole: u8[] = new Array<u8>(room)
    const flen: i32 = fixed.compress(src, 0, n, whole, 0, room)
    t.eqI32("gzip fixed: the stream decodes", d.decompress(whole, 0, flen, back, 0, n), n)
    let fixedSmall: i32 = 0
    for (let k: i32 = 0; k < flen; k++) {
      if (fixed.compress(src, 0, n, whole, 0, k) === DEFLATE_NO_ROOM) {
        fixedSmall += 1
      }
    }
    t.eqI32("gzip fixed: every room shorter than the stream has none", fixedSmall, flen)
    t.eqI32("gzip fixed: a bound past the largest", gzipFixedBound(1908874324), DEFLATE_NO_ROOM)
    t.eqI32("gzip fixed: the largest bound is 2^31 - 1", gzipFixedBound(1908874323), 2147483647)
  }

  // --- GzipWriter -------------------------------------------------------------
  {
    const w = new GzipWriter(6)
    t.eqI32("writer: a bound past the largest", w.bound(2145000001), DEFLATE_NO_ROOM)
    t.ok("writer: the largest bound is a size", w.bound(2145000000) > 0)
    const out: u8[] = new Array<u8>(w.bound(n))
    const short: u8[] = new Array<u8>(w.bound(n) - 1)
    t.eqI32("writer: write into less than bound", w.write(src, 0, n, short, 0), DEFLATE_NO_ROOM)
    t.eqI32("writer: flush into less than bound", w.flush(new Array<u8>(w.bound(0) - 1), 0), DEFLATE_NO_ROOM)
    t.eqI32("writer: finish into less than bound", w.finish(new Array<u8>(w.bound(0) - 1), 0), DEFLATE_NO_ROOM)
    // Nothing was consumed by the refused calls: the body is still whole.
    let end: i32 = w.write(src, 0, n, out, 0)
    t.ok("writer: write after a refusal", end > 0)
    const tail: u8[] = new Array<u8>(w.bound(0))
    const fin: i32 = w.finish(tail, 0)
    t.ok("writer: finish", fin > 0)
    const stream: u8[] = new Array<u8>(end + fin)
    for (let i: i32 = 0; i < end; i++) {
      stream[i] = out[i]
    }
    for (let i: i32 = 0; i < fin; i++) {
      stream[end + i] = tail[i]
    }
    t.eqI32("writer: the body decodes", new GzipDecompressor().decompress(stream, 0, end + fin, back, 0, n), n)
    t.eqI32("writer: write after finish", w.write(src, 0, n, out, 0), GZIP_ERR_FINISHED)
    t.eqI32("writer: flush after finish", w.flush(out, 0), GZIP_ERR_FINISHED)
    t.eqI32("writer: finish after finish", w.finish(out, 0), GZIP_ERR_FINISHED)
    w.start()
    end = w.write(src, 0, 100, out, 0)
    t.ok("writer: start begins a new body", end > 0)
    const end2: i32 = w.finish(out, end)
    t.eqI32("writer: the new body decodes", new GzipDecompressor().decompress(out, 0, end2, back, 0, n), 100)
  }
  return t.done()
}
