// `nish/compress/*` against Node's zlib, both ways.
//
// Run plainly, it decompresses every stream fixtures.mjs had Node's zlib write
// (every gzip level, the four strategies, a 512-byte window, sync-flushed
// pieces, two members, raw and zlib framings), one-shot and, for gzip,
// through a `GzipReader` fed in small pieces, and checks each against its
// input; and it checks that each known-bad stream, which Node also refuses,
// answers its error code.
//
// Run with `--emit`, it prints what Nish compresses — every input, every
// format, every level, and a `GzipWriter` stream with a flush in it — one
// `<format> <level> <input> <hex>` line each, which tests/run.js inflates with
// `zlib.gunzipSync`, `inflateSync` and `inflateRawSync` and compares with
// inputs.mjs's bytes.
import {
  DEFLATE_ERR_BLOCK_TYPE,
  DEFLATE_ERR_DISTANCE,
  DEFLATE_ERR_HUFFMAN,
  DEFLATE_ERR_STORED_LENGTH,
  DEFLATE_ERR_TRUNCATED,
  Deflater,
  Inflater,
  compressBound,
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
} from "nish/compress/gzip"
import { ZLIB_ERR_ADLER, ZlibCompressor, ZlibDecompressor } from "nish/compress/zlib"
import { Suite } from "nish/testing"
import { badStreams, goodStreams } from "./fixtures"

const HEX: string = "0123456789abcdef"

/** The bytes a hex string spells. */
const unhex = (text: string): u8[] => {
  const n: i32 = toI32(text.length) >> 1
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < n && i < toI32(out.length); i++) {
    out[i] = toU8((hexDigit(text.charCodeAt(2 * i)) << 4) | hexDigit(text.charCodeAt(2 * i + 1)))
  }
  return out
}

/** The value of one lower-case hex digit. */
const hexDigit = (c: i32): i32 => (c <= 57 ? c - 48 : c - 87)

/** `b[0 .. n)` as lower-case hex. */
const hex = (b: u8[], n: i32): string => {
  const parts: string[] = []
  for (let i: i32 = 0; i < n && i < toI32(b.length); i++) {
    const v: i32 = toI32(b[i])
    parts.push(HEX.substring(v >> 4, (v >> 4) + 1))
    parts.push(HEX.substring(v & 15, (v & 15) + 1))
  }
  return parts.join("")
}

/** inputs.mjs's generator: x' = (x * 1103515245 + 12345) mod 2^31, answering x' >> 16. */
class Lcg {
  x: i64

  constructor(seed: i64) {
    this.x = seed
  }

  next(): i32 {
    this.x = (this.x * 1103515245 + 12345) % 2147483648
    return toI32(this.x >> 16)
  }
}

const WORDS: string =
  "time year people way day man thing woman life child world school state family student group country problem hand part place case week company system program question work government number night point home water room mother area money story fact month lot right study book eye job word business issue side kind head house service friend father power hour game line end member law car city community name president team minute idea kid body information back parent face others level office door health person art war history party result change morning reason research girl guy moment air teacher force education"

/** The space-separated words of `text`. */
const words = (text: string): string[] => {
  const out: string[] = []
  let from: i32 = 0
  while (from <= toI32(text.length)) {
    let space: i32 = text.indexOf(" ", from)
    if (space < 0) {
      space = toI32(text.length)
    }
    out.push(text.substring(from, space))
    from = space + 1
  }
  return out
}

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/** inputs.mjs's `text(n)`. */
const textOf = (n: i32): u8[] => {
  const list: string[] = words(WORDS)
  const next = new Lcg(7)
  const out: u8[] = []
  while (toI32(out.length) < n) {
    const w: string = list[next.next() % toI32(list.length)]
    for (let i: i32 = 0; i < toI32(w.length) && toI32(out.length) < n; i++) {
      out.push(toU8(w.charCodeAt(i)))
    }
    if (toI32(out.length) < n) {
      out.push(next.next() % 11 === 0 ? 10 : 32)
    }
  }
  return out
}

/** inputs.mjs's `json(n)`. */
const jsonOf = (n: i32): u8[] => {
  const next = new Lcg(11)
  const parts: string[] = ["["]
  let size: i32 = 1
  while (size < n) {
    const id: i32 = next.next()
    const user: i32 = next.next() % 400
    const ok: string = next.next() % 2 === 0 ? "true" : "false"
    const k: i32 = next.next() % 1000
    const piece: string = `{"id":${id},"user":"u${user}","ok":${ok},"n":${k}},`
    parts.push(piece)
    size += toI32(piece.length)
  }
  const all: u8[] = ascii(parts.join(""))
  const out: u8[] = []
  for (let i: i32 = 0; i < n; i++) {
    out.push(all[i])
  }
  return out
}

/** inputs.mjs's `noise(n)`. */
const noiseOf = (n: i32): u8[] => {
  const next = new Lcg(13)
  const out: u8[] = []
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(next.next() & 255))
  }
  return out
}

/** Appends all of `b` to `out`. */
const append = (out: u8[], b: u8[], n: i32): void => {
  for (let i: i32 = 0; i < n && i < toI32(b.length); i++) {
    out.push(b[i])
  }
}

/** inputs.mjs's `INPUTS[name]`. */
const inputOf = (name: string): u8[] => {
  if (name === "one") {
    return [toU8(65)]
  }
  if (name === "text") {
    return textOf(12000)
  }
  if (name === "json") {
    return jsonOf(5221)
  }
  if (name === "noise") {
    return noiseOf(2000)
  }
  if (name === "zeros") {
    const z: u8[] = new Array<u8>(70000)
    z.fill(0)
    return z
  }
  if (name === "mixed") {
    const a: u8[] = noiseOf(2000)
    const b: u8[] = textOf(8000)
    const out: u8[] = []
    append(out, a, 2000)
    append(out, b, 8000)
    append(out, b, 4000)
    append(out, a, 2000)
    return out
  }
  const none: u8[] = []
  return none
}

const INPUT_NAMES: string = "empty one text json noise zeros mixed"

/** The code a bad stream's fixture names. */
const codeOf = (name: string): i32 => {
  if (name === "GZIP_ERR_CRC") {
    return GZIP_ERR_CRC
  }
  if (name === "GZIP_ERR_SIZE") {
    return GZIP_ERR_SIZE
  }
  if (name === "GZIP_ERR_HEADER") {
    return GZIP_ERR_HEADER
  }
  if (name === "ZLIB_ERR_ADLER") {
    return ZLIB_ERR_ADLER
  }
  if (name === "DEFLATE_ERR_TRUNCATED") {
    return DEFLATE_ERR_TRUNCATED
  }
  if (name === "DEFLATE_ERR_DISTANCE") {
    return DEFLATE_ERR_DISTANCE
  }
  if (name === "DEFLATE_ERR_HUFFMAN") {
    return DEFLATE_ERR_HUFFMAN
  }
  if (name === "DEFLATE_ERR_BLOCK_TYPE") {
    return DEFLATE_ERR_BLOCK_TYPE
  }
  if (name === "DEFLATE_ERR_STORED_LENGTH") {
    return DEFLATE_ERR_STORED_LENGTH
  }
  return 0
}

/** Whether `a` is `b[0 .. n)`. */
const same = (a: u8[], b: u8[], n: i32): boolean => {
  if (toI32(a.length) !== n || toI32(b.length) < n) {
    return false
  }
  for (let i: i32 = 0; i < n && i < toI32(a.length); i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

/** The decoders one run keeps. */
class Decoders {
  inflater: Inflater
  gunzip: GzipDecompressor
  unzlib: ZlibDecompressor

  constructor() {
    this.inflater = new Inflater()
    this.gunzip = new GzipDecompressor()
    this.unzlib = new ZlibDecompressor()
  }

  decompress(format: string, src: u8[], out: u8[]): i32 {
    const n: i32 = toI32(src.length)
    if (format === "gzip") {
      return this.gunzip.decompress(src, 0, n, out, 0, toI32(out.length))
    }
    if (format === "zlib") {
      return this.unzlib.decompress(src, 0, n, out, 0, toI32(out.length))
    }
    return this.inflater.decompress(src, 0, n, out, 0, toI32(out.length))
  }
}

/** A gzip stream through a `GzipReader`, fed `piece` bytes at a time; answers the bytes, or null on an error. */
const readStream = (src: u8[], piece: i32, limit: i32): u8[] | null => {
  const r = new GzipReader(toI64(limit))
  const out: u8[] = []
  const into: u8[] = new Array<u8>(1000)
  let fed: i32 = 0
  while (true) {
    const m: i32 = r.read(into, 0, 1000)
    if (m > 0) {
      append(out, into, m)
    } else if (m === GZIP_NEED_INPUT) {
      if (fed === toI32(src.length)) {
        r.endInput()
      } else {
        const len: i32 = piece < toI32(src.length) - fed ? piece : toI32(src.length) - fed
        fed += r.feed(src, fed, len)
      }
    } else if (m === GZIP_END) {
      return out
    } else {
      return null
    }
  }
}

/** Prints the `--emit` lines. */
const emit = (): void => {
  const names: string[] = words(INPUT_NAMES)
  const out: u8[] = new Array<u8>(compressBound(80000))
  for (let level: i32 = 0; level <= 9; level++) {
    const raw = new Deflater(level)
    const gz = new GzipCompressor(level)
    const z = new ZlibCompressor(level)
    for (const name of names) {
      const src: u8[] = inputOf(name)
      const n: i32 = toI32(src.length)
      console.log(`raw ${level} ${name} ${hex(out, raw.compress(src, 0, n, out, 0))}`)
      console.log(`gzip ${level} ${name} ${hex(out, gz.compress(src, 0, n, out, 0))}`)
      console.log(`zlib ${level} ${name} ${hex(out, z.compress(src, 0, n, out, 0))}`)
    }
  }
  for (const name of ["text", "mixed", "zeros"]) {
    const src: u8[] = inputOf(name)
    const n: i32 = toI32(src.length)
    const w = new GzipWriter(6)
    const buf: u8[] = new Array<u8>(w.bound(n) * 2)
    let end: i32 = w.write(src, 0, n >> 1, buf, 0)
    end = w.flush(buf, end)
    end = w.write(src, n >> 1, n - (n >> 1), buf, end)
    end = w.finish(buf, end)
    console.log(`gzip writer ${name} ${hex(buf, end)}`)
  }
}

export const main = (): number => {
  if (process.argv.length > 1 && process.argv[1] === "--emit") {
    emit()
    return 0
  }
  const t = new Suite("compress-node")
  const dec = new Decoders()
  const out: u8[] = new Array<u8>(100000)
  const good: string[] = goodStreams()
  for (let i: i32 = 0; i + 3 < toI32(good.length); i += 4) {
    const what: string = good[i]
    const input: string = good[i + 1]
    const format: string = good[i + 2]
    const stream: u8[] = unhex(good[i + 3])
    const want: u8[] = inputOf(input)
    const n: i32 = dec.decompress(format, stream, out)
    t.ok(`node ${what}, ${input}: decompresses to the input (${n} bytes)`, n === toI32(want.length) && same(want, out, n))
    if (format === "gzip") {
      const read: u8[] | null = readStream(stream, 333, 100000)
      t.ok(`node ${what}, ${input}: a GzipReader fed 333 bytes at a time agrees`, read !== null && same(read, want, toI32(want.length)))
    }
  }
  const bad: string[] = badStreams()
  for (let i: i32 = 0; i + 3 < toI32(bad.length); i += 4) {
    const what: string = bad[i]
    const format: string = bad[i + 1]
    const stream: u8[] = unhex(bad[i + 2])
    t.eqI32(`node refuses ${what}, and so does this: ${bad[i + 3]}`, dec.decompress(format, stream, out), codeOf(bad[i + 3]))
  }
  return t.done()
}
