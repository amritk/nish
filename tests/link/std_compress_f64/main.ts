// `nish/compress/*` and `nish/net/http-compress` under `--number-mode f64`,
// where a bare literal is an `f64`: the modules compile there (a program that
// imports `nish/net/http1-server` brings them in), and a JSON body
// round-trips through raw DEFLATE, gzip and zlib at every level, through
// `GzipWriter` and `GzipReader`, and `Accept-Encoding` is read the same.
import { compressBound, Deflater, Inflater } from "nish/compress/deflate"
import { GZIP_END, GZIP_NEED_INPUT, GzipCompressor, GzipDecompressor, GzipReader, GzipWriter } from "nish/compress/gzip"
import { ZlibCompressor, ZlibDecompressor } from "nish/compress/zlib"
import { HTTP_CODING_GZIP, HTTP_OFFER_GZIP, httpAcceptEncoding } from "nish/net/http-compress"
import { Suite } from "nish/testing"

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/** Whether `a` and `b[0 .. a.length)` hold the same bytes. */
const same = (a: u8[], b: u8[]): boolean => {
  if (toI32(b.length) < toI32(a.length)) {
    return false
  }
  for (let i: i32 = 0; i < toI32(a.length); i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

export const main = (): i32 => {
  const t = new Suite("compress-f64")
  const parts: string[] = []
  for (let i: i32 = 0; i < 300; i++) {
    parts.push(`{"id":${i},"name":"item ${(i * 37) % 101}","ok":true},`)
  }
  const body: u8[] = ascii(parts.join(""))
  const n: i32 = toI32(body.length)
  const zero: i32 = 0
  const out: u8[] = new Array<u8>(compressBound(n))
  const back: u8[] = new Array<u8>(n)
  const inflater = new Inflater()
  const gunzip = new GzipDecompressor()
  const unzlib = new ZlibDecompressor()
  let failures: string = ""
  for (let level: i32 = 0; level <= 9; level++) {
    const raw: i32 = new Deflater(level).compress(body, zero, n, out, zero)
    if (inflater.decompress(out, zero, raw, back, zero, n) !== n || !same(body, back)) {
      failures = `${failures} raw ${level}`
    }
    const gz: i32 = new GzipCompressor(level).compress(body, zero, n, out, zero)
    if (gunzip.decompress(out, zero, gz, back, zero, n) !== n || !same(body, back)) {
      failures = `${failures} gzip ${level}`
    }
    const z: i32 = new ZlibCompressor(level).compress(body, zero, n, out, zero)
    if (unzlib.decompress(out, zero, z, back, zero, n) !== n || !same(body, back)) {
      failures = `${failures} zlib ${level}`
    }
  }
  t.eqStr(`round trip: ${n} bytes, every level and format`, failures, "")

  const w = new GzipWriter(toI32(6))
  const stream: u8[] = new Array<u8>(w.bound(n) * 2)
  let end: i32 = w.write(body, zero, n >> 1, stream, zero)
  end = w.flush(stream, end)
  end = w.write(body, n >> 1, n - (n >> 1), stream, end)
  end = w.finish(stream, end)
  t.eqI32("writer: one gzip member", gunzip.decompress(stream, zero, end, back, zero, n), n)
  const r = new GzipReader(toI64(n))
  const into: u8[] = new Array<u8>(1000)
  const got: u8[] = []
  let fed: i32 = 0
  let last: i32 = 0
  while (true) {
    const m: i32 = r.read(into, zero, toI32(1000))
    if (m > 0) {
      for (let i: i32 = 0; i < m && i < toI32(into.length); i++) {
        got.push(into[i])
      }
    } else if (m === GZIP_NEED_INPUT && fed < end) {
      fed += r.feed(stream, fed, Math.min(toI32(400), end - fed))
    } else if (m === GZIP_NEED_INPUT) {
      r.endInput()
    } else {
      last = m
      break
    }
  }
  t.eqI32("reader: the stream ends", last, GZIP_END)
  t.ok("reader: every byte back", toI32(got.length) === n && same(body, got))

  const accept: u8[] = ascii("deflate;q=0.5, gzip")
  t.eqI32("accept: gzip", httpAcceptEncoding(accept, zero, toI32(accept.length), HTTP_OFFER_GZIP), HTTP_CODING_GZIP)
  return t.done()
}
