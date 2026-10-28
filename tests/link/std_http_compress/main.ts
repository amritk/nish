// `nish/net/http-compress` and `Http1Connection.respondEncoded`: how
// `Accept-Encoding` is negotiated (q-values, `identity`, `*`, `x-gzip`, case,
// malformed elements), and a sans-IO connection answering requests with a
// gzip body (Content-Encoding, Content-Length and Vary set, the body
// gunzipping to what was sent), with identity for a client that takes no
// gzip, a body under the threshold and a HEAD, and `H1_INVALID` / `H1_AGAIN`
// for a response that cannot fit, nothing written.
import { DEFLATE_FAST } from "nish/compress/deflate"
import { GzipDecompressor } from "nish/compress/gzip"
import {
  HTTP_CODING_DEFLATE,
  HTTP_CODING_GZIP,
  HTTP_CODING_IDENTITY,
  HTTP_CODING_NONE,
  HTTP_OFFER_DEFLATE,
  HTTP_OFFER_GZIP,
  HttpCompressor,
  httpAcceptEncoding,
} from "nish/net/http-compress"
import { H1_AGAIN, H1_END, H1_INVALID, H1_REQUEST, Http1Config, Http1Connection } from "nish/net/http1-server"
import { Rng } from "nish/random"
import { Suite } from "nish/testing"

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/** The string of `b[from .. to)`. */
const textOf = (b: u8[], from: i32, to: i32): string => {
  const parts: string[] = []
  for (let i: i32 = from; i < to && i >= 0 && i < toI32(b.length); i++) {
    parts.push(String.fromCharCode(toI32(b[i])))
  }
  return parts.join("")
}

/** The string of `b[from .. to)`, ASCII upper case lowered. */
const lowerOf = (b: u8[], from: i32, to: i32): string => {
  const low: u8[] = []
  for (let i: i32 = from; i < to && i >= 0 && i < toI32(b.length); i++) {
    const c: u8 = b[i]
    low.push(c >= 65 && c <= 90 ? c + 32 : c)
  }
  return textOf(low, 0, toI32(low.length))
}

/** `httpAcceptEncoding` of `value`, gzip and deflate offered. */
const pick = (value: string): i32 => {
  const b: u8[] = ascii(value)
  return httpAcceptEncoding(b, 0, toI32(b.length), HTTP_OFFER_GZIP | HTTP_OFFER_DEFLATE)
}

/** `httpAcceptEncoding` of `value`, gzip alone offered. */
const pickGzip = (value: string): i32 => {
  const b: u8[] = ascii(value)
  return httpAcceptEncoding(b, 0, toI32(b.length), HTTP_OFFER_GZIP)
}

/** About `n` bytes of JSON. */
const json = (n: i32): u8[] => {
  const parts: string[] = ["["]
  let size: i32 = 1
  let i: i32 = 0
  while (size < n) {
    const piece: string = `{"id":${i * 7919 % 100000},"name":"item ${i}","ok":true},`
    parts.push(piece)
    size += toI32(piece.length)
    i += 1
  }
  const all: u8[] = ascii(parts.join(""))
  const out: u8[] = new Array<u8>(n)
  for (let k: i32 = 0; k < n && k < toI32(out.length) && k < toI32(all.length); k++) {
    out[k] = all[k]
  }
  return out
}

/** A response read off the connection's output: its head as lower-case text, and the body's window. */
class Response {
  head: string
  bodyStart: i32
  bodyEnd: i32
  bytes: u8[]

  constructor(bytes: u8[], from: i32, to: i32) {
    this.bytes = bytes
    let split: i32 = -1
    for (let i: i32 = from; i + 3 < to && split < 0; i++) {
      if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) {
        split = i
      }
    }
    this.head = split < 0 ? "" : lowerOf(bytes, from, split + 2)
    this.bodyStart = split < 0 ? to : split + 4
    this.bodyEnd = to
  }

  has(line: string): boolean {
    return this.head.indexOf(`\r\n${line}\r\n`) >= 0
  }
}

/** A connection that has read one request with `fields` (each ending CRLF), its event checked. */
const request = (t: Suite, label: string, config: Http1Config, method: string, fields: string): Http1Connection => {
  const conn = new Http1Connection(config)
  const bytes: u8[] = ascii(`${method} /feed HTTP/1.1\r\nhost: example.com\r\n${fields}\r\n`)
  conn.feed(bytes, 0, toI32(bytes.length))
  t.eqI32(`${label}: the request is read`, conn.next(), H1_REQUEST)
  return conn
}

/** What the connection queued, from its output buffer. */
const queued = (conn: Http1Connection): Response => new Response(conn.output, conn.outputStart, conn.outputEnd)

export const main = (): number => {
  const t = new Suite("http-compress")

  // --- Negotiation ------------------------------------------------------------
  t.eqI32("accept: gzip", pick("gzip"), HTTP_CODING_GZIP)
  t.eqI32("accept: the browsers' gzip, deflate, br, zstd", pick("gzip, deflate, br, zstd"), HTTP_CODING_GZIP)
  t.eqI32("accept: deflate alone", pick("deflate"), HTTP_CODING_DEFLATE)
  t.eqI32("accept: deflate alone, gzip offered alone, is identity", pickGzip("deflate"), HTTP_CODING_IDENTITY)
  t.eqI32("accept: br alone is identity", pick("br"), HTTP_CODING_IDENTITY)
  t.eqI32("accept: an empty field is identity", pick(""), HTTP_CODING_IDENTITY)
  t.eqI32("accept: identity", pick("identity"), HTTP_CODING_IDENTITY)
  t.eqI32("accept: x-gzip is gzip", pick("x-gzip"), HTTP_CODING_GZIP)
  t.eqI32("accept: case is ignored", pick("GZip"), HTTP_CODING_GZIP)
  t.eqI32("accept: * takes gzip", pick("*"), HTTP_CODING_GZIP)
  t.eqI32("accept: gzip;q=0 is refused", pick("gzip;q=0"), HTTP_CODING_IDENTITY)
  t.eqI32("accept: gzip;q=0, * gives deflate", pick("gzip;q=0, *"), HTTP_CODING_DEFLATE)
  t.eqI32("accept: the higher q wins", pick("gzip;q=0.5, deflate;q=0.8"), HTTP_CODING_DEFLATE)
  t.eqI32("accept: a tie goes to gzip", pick("deflate;q=0.5, gzip;q=0.5"), HTTP_CODING_GZIP)
  t.eqI32("accept: identity preferred over gzip", pick("gzip;q=0.5, identity;q=0.9"), HTTP_CODING_IDENTITY)
  t.eqI32("accept: gzip at q 0.1 beats an unmentioned identity", pick("gzip;q=0.1"), HTTP_CODING_GZIP)
  t.eqI32("accept: identity;q=0 with gzip", pick("gzip, identity;q=0"), HTTP_CODING_GZIP)
  t.eqI32("accept: identity;q=0 and nothing offered", pick("br, identity;q=0"), HTTP_CODING_NONE)
  t.eqI32("accept: *;q=0 refuses identity too", pick("br, *;q=0"), HTTP_CODING_NONE)
  t.eqI32("accept: whitespace around q", pick("gzip ; q = 1"), HTTP_CODING_IDENTITY)
  t.eqI32("accept: OWS before the semicolon", pick("gzip ;q=1"), HTTP_CODING_GZIP)
  t.eqI32("accept: q=1.000", pick("gzip;q=1.000"), HTTP_CODING_GZIP)
  t.eqI32("accept: q=1.5 is malformed, the element skipped", pick("gzip;q=1.5"), HTTP_CODING_IDENTITY)
  t.eqI32("accept: q=0.0001 is malformed", pick("gzip;q=0.0001"), HTTP_CODING_IDENTITY)
  t.eqI32("accept: other parameters are ignored", pick("gzip;level=1;q=0.7"), HTTP_CODING_GZIP)
  t.eqI32("accept: empty elements", pick(",, ,gzip,,"), HTTP_CODING_GZIP)
  t.eqI32("accept: junk between elements", pick("gzip @ junk, deflate"), HTTP_CODING_DEFLATE)
  {
    const b: u8[] = ascii("xx deflate, gzip;q=0 yy")
    t.eqI32("accept: a window inside a buffer", httpAcceptEncoding(b, 3, 20, HTTP_OFFER_GZIP | HTTP_OFFER_DEFLATE), HTTP_CODING_DEFLATE)
  }

  // --- The compressor --------------------------------------------------------
  const enc = new HttpCompressor(DEFLATE_FAST, 256, 65536)
  const body: u8[] = json(5221)
  const gunzip = new GzipDecompressor()
  const back: u8[] = new Array<u8>(70000)
  {
    const n: i32 = enc.compress(HTTP_CODING_GZIP, body, 0, 5221)
    t.ok(`compressor: 5221 bytes of JSON become ${n}`, n > 0 && n < 2000)
    t.eqI32("compressor: and gunzip back", gunzip.decompress(enc.output, 0, n, back, 0, 70000), 5221)
    t.eqI32("compressor: identity is not compressed", enc.compress(HTTP_CODING_IDENTITY, body, 0, 5221), -1)
    t.eqI32("compressor: deflate is not produced", enc.compress(HTTP_CODING_DEFLATE, body, 0, 5221), -1)
    t.eqI32("compressor: under minLength is not compressed", enc.compress(HTTP_CODING_GZIP, body, 0, 255), -1)
    t.eqI32("compressor: over maxLength is not compressed", enc.compress(HTTP_CODING_GZIP, new Array<u8>(65537), 0, 65537), -1)
    const rng = new Rng(7)
    const noise: u8[] = new Array<u8>(1000)
    for (let i: i32 = 0; i < 1000; i++) {
      noise[i] = toU8(rng.nextInt(0, 255))
    }
    t.eqI32("compressor: a body gzip would not shrink is sent as it is", enc.compress(HTTP_CODING_GZIP, noise, 0, 1000), -1)
    const names: u8[][] = [ascii("content-type")]
    const values: u8[][] = [ascii("application/json")]
    enc.addFields(names, values)
    t.eqI32("fields: the program's, then two", toI32(enc.names.length), 3)
    t.eqStr("fields: content-encoding: gzip", `${textOf(enc.names[1], 0, 16)}: ${textOf(enc.values[1], 0, 4)}`, "content-encoding: gzip")
    t.eqStr("fields: vary: accept-encoding", `${textOf(enc.names[2], 0, 4)}: ${textOf(enc.values[2], 0, 15)}`, "vary: accept-encoding")
    enc.vary = false
    enc.addFields(names, values)
    t.eqI32("fields: without vary", toI32(enc.names.length), 2)
    enc.identityFields(names, values)
    t.eqI32("fields: identity without vary is the program's", toI32(enc.names.length), 1)
    enc.vary = true
  }

  // --- HTTP/1.1 ----------------------------------------------------------------
  const config = new Http1Config()
  const names: u8[][] = [ascii("content-type")]
  const values: u8[][] = [ascii("application/json")]
  {
    const conn = request(t, "h1 gzip", config, "GET", "accept-encoding: gzip, deflate, br\r\n")
    const coding: i32 = conn.acceptEncoding()
    t.eqI32("h1 gzip: the connection reads gzip", coding, HTTP_CODING_GZIP)
    t.eqI32("h1 gzip: respondEncoded queues it", conn.respondEncoded(200, names, values, body, 0, 5221, enc, coding), 0)
    const r: Response = queued(conn)
    const n: i32 = r.bodyEnd - r.bodyStart
    t.ok("h1 gzip: status 200", r.head.startsWith("http/1.1 200 ok\r\n"))
    t.ok("h1 gzip: content-encoding: gzip", r.has("content-encoding: gzip"))
    t.ok("h1 gzip: vary: accept-encoding", r.has("vary: accept-encoding"))
    t.ok(`h1 gzip: content-length is the compressed length, ${n}`, r.has(`content-length: ${n}`) && n < 2000)
    t.ok("h1 gzip: the program's field", r.has("content-type: application/json"))
    t.eqI32("h1 gzip: the body gunzips to the JSON", gunzip.decompress(r.bytes, r.bodyStart, n, back, 0, 70000), 5221)
    let same: boolean = true
    for (let i: i32 = 0; i < 5221; i++) {
      if (back[i] !== body[i]) {
        same = false
      }
    }
    t.ok("h1 gzip: byte for byte", same)
  }
  {
    const conn = request(t, "h1 none", config, "GET", "")
    const coding: i32 = conn.acceptEncoding()
    t.eqI32("h1 none: no accept-encoding is identity", coding, HTTP_CODING_IDENTITY)
    t.eqI32("h1 none: respondEncoded queues it", conn.respondEncoded(200, names, values, body, 0, 5221, enc, coding), 0)
    const r: Response = queued(conn)
    t.ok("h1 none: no content-encoding", r.head.indexOf("content-encoding") < 0)
    t.ok("h1 none: vary: accept-encoding still", r.has("vary: accept-encoding"))
    t.ok("h1 none: content-length 5221", r.has("content-length: 5221") && r.bodyEnd - r.bodyStart === 5221)
  }
  {
    const conn = request(t, "h1 small", config, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("h1 small: respondEncoded", conn.respondEncoded(200, names, values, body, 0, 100, enc, conn.acceptEncoding()), 0)
    const r: Response = queued(conn)
    t.ok("h1 small: a body under the threshold is sent as it is", r.head.indexOf("content-encoding") < 0 && r.has("content-length: 100"))
  }
  {
    const conn = request(t, "h1 head", config, "HEAD", "accept-encoding: gzip\r\n")
    t.eqI32("h1 head: respondEncoded", conn.respondEncoded(200, names, values, body, 0, 5221, enc, conn.acceptEncoding()), 0)
    const r: Response = queued(conn)
    t.ok("h1 head: the head says gzip", r.has("content-encoding: gzip"))
    t.eqI32("h1 head: and no body is sent", r.bodyEnd - r.bodyStart, 0)
  }
  {
    // A response the output could never hold: refused, nothing queued.
    const small = new Http1Config()
    small.outputSize = 1024
    const wide = new HttpCompressor(DEFLATE_FAST, 0, 65536)
    const rng = new Rng(8)
    const noise: u8[] = new Array<u8>(4000)
    for (let i: i32 = 0; i < 4000; i++) {
      noise[i] = toU8(rng.nextInt(0, 255))
    }
    const conn = request(t, "h1 too big", small, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("h1 too big: H1_INVALID", conn.respondEncoded(200, names, values, noise, 0, 4000, wide, HTTP_CODING_GZIP), H1_INVALID)
    t.eqI32("h1 too big: nothing queued", conn.outputEnd - conn.outputStart, 0)
    t.ok("h1 too big: the request can still be answered", conn.answerable())
    t.eqI32("h1 too big: so is a gzip body still over the room", conn.respondEncoded(200, names, values, body, 0, 5221, wide, HTTP_CODING_GZIP), H1_INVALID)
    t.eqI32("h1 too big: or a smaller one", conn.respondEncoded(200, names, values, body, 0, 300, wide, HTTP_CODING_GZIP), 0)
  }
  {
    // A response that fits once the output drains: H1_AGAIN, nothing queued.
    const small = new Http1Config()
    small.outputSize = 4096
    const conn = request(t, "h1 later", small, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("h1 later: the first answer", conn.respondEncoded(200, names, values, body, 0, 1500, enc, HTTP_CODING_IDENTITY), 0)
    const second: u8[] = ascii("GET /again HTTP/1.1\r\nhost: example.com\r\naccept-encoding: gzip\r\n\r\n")
    conn.feed(second, 0, toI32(second.length))
    t.eqI32("h1 later: the first request ends", conn.next(), H1_END)
    t.eqI32("h1 later: a second request", conn.next(), H1_REQUEST)
    const before: i32 = conn.outputEnd
    t.eqI32("h1 later: a body that does not fit behind the first is H1_AGAIN", conn.respondEncoded(200, names, values, body, 0, 2500, enc, HTTP_CODING_IDENTITY), H1_AGAIN)
    t.eqI32("h1 later: nothing more queued", conn.outputEnd, before)
    conn.consume(conn.outputEnd - conn.outputStart)
    t.eqI32("h1 later: once sent, gzip fits", conn.respondEncoded(200, names, values, body, 0, 5221, enc, HTTP_CODING_GZIP), 0)
  }
  return t.done()
}
