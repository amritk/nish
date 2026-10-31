// `nish/net/http-compress` and `Http1Connection.respondEncoded`: how
// `Accept-Encoding` is negotiated (q-values, `identity`, `*`, `x-gzip`, case,
// malformed elements), and a sans-IO connection answering requests with a
// gzip body (Content-Encoding, Content-Length and Vary set, the body
// gunzipping to what was sent), with identity for a client that takes no
// gzip, a body under the threshold and a HEAD, and `H1_INVALID` / `H1_AGAIN`
// for a response that cannot fit, nothing written. Then the policy: the
// fixed-Huffman encoder round trip on random and JSON-shaped bodies of every
// size class, each `HTTP_COMPRESS_*` decision, the saving thresholds, segment
// mode (its head arithmetic against the heads written), `Vary` only where the
// request decided, and `identity;q=0` sent gzip below every threshold. Last,
// segment mode's skip: a response that fits one segment as it is goes out
// with no encoder run (`encoderRuns`), at the segment's edge and one byte past,
// and `encoderRuns` wrapping past 2^31 - 1 rather than panicking.
import { DEFLATE_FAST, DEFLATE_NO_ROOM } from "nish/compress/deflate"
import { GzipDecompressor, GzipFixedCompressor } from "nish/compress/gzip"
import {
  HTTP_CODING_DEFLATE,
  HTTP_CODING_GZIP,
  HTTP_CODING_IDENTITY,
  HTTP_CODING_NONE,
  HTTP_COMPRESS_NOT_ACCEPTED,
  HTTP_COMPRESS_NO_FEWER_SEGMENTS,
  HTTP_COMPRESS_SENT,
  HTTP_COMPRESS_TOO_LARGE,
  HTTP_COMPRESS_TOO_LITTLE_SAVED,
  HTTP_COMPRESS_TOO_SMALL,
  HTTP_ENCODER_FIXED,
  HTTP_ENCODER_LEVEL,
  HTTP_OFFER_DEFLATE,
  HTTP_OFFER_GZIP,
  HttpCompressor,
  httpAcceptEncoding,
  httpIdentityRefused,
  httpSegments,
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

/** `n` bytes of JSON-shaped text whose numbers and names `rng` draws. */
const randomJson = (rng: Rng, n: i32): u8[] => {
  const parts: string[] = ["["]
  let size: i32 = 1
  while (size < n) {
    const piece: string = `{"id":${rng.nextInt(0, 1000000)},"user":"u${rng.nextInt(0, 400)}","score":${rng.nextInt(0, 99)}.${rng.nextInt(0, 9)},"tags":["t${rng.nextInt(0, 30)}"]},`
    parts.push(piece)
    size += toI32(piece.length)
  }
  const all: u8[] = ascii(parts.join(""))
  const out: u8[] = new Array<u8>(n)
  for (let k: i32 = 0; k < n && k < toI32(out.length) && k < toI32(all.length); k++) {
    out[k] = all[k]
  }
  return out
}

/** Whether `a[0 .. n)` and `b[from .. from + n)` agree. */
const same = (a: u8[], b: u8[], from: i32, n: i32): boolean => {
  for (let i: i32 = 0; i < n; i++) {
    if (i >= toI32(a.length) || from + i >= toI32(b.length) || a[i] !== b[from + i]) {
      return false
    }
  }
  return true
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
    let alike: boolean = true
    for (let i: i32 = 0; i < 5221; i++) {
      if (back[i] !== body[i]) {
        alike = false
      }
    }
    t.ok("h1 gzip: byte for byte", alike)
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
    t.eqI32("h1 small: the decision says why", enc.decision, HTTP_COMPRESS_TOO_SMALL)
    t.ok("h1 small: and no vary, as every client gets the same", r.head.indexOf("vary") < 0)
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
  {
    // H1_AGAIN behind a response that is half sent: the output was moved up
    // to make room, and what is left queued is exactly the unsent rest.
    const small = new Http1Config()
    small.outputSize = 4096
    const conn = request(t, "h1 half sent", small, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("h1 half sent: the first answer", conn.respondEncoded(200, names, values, body, 0, 1500, enc, HTTP_CODING_IDENTITY), 0)
    const second: u8[] = ascii("GET /again HTTP/1.1\r\nhost: example.com\r\n\r\n")
    conn.feed(second, 0, toI32(second.length))
    t.eqI32("h1 half sent: the first request ends", conn.next(), H1_END)
    t.eqI32("h1 half sent: a second request", conn.next(), H1_REQUEST)
    conn.consume(1000)
    const live: i32 = conn.outputEnd - conn.outputStart
    const unsent: string = textOf(conn.output, conn.outputStart, conn.outputEnd)
    t.eqI32("h1 half sent: a body that does not fit is H1_AGAIN", conn.respondEncoded(200, names, values, body, 0, 3500, enc, HTTP_CODING_IDENTITY), H1_AGAIN)
    t.eqI32("h1 half sent: only the unsent rest is queued", conn.outputEnd - conn.outputStart, live)
    t.ok("h1 half sent: and it is those bytes", textOf(conn.output, conn.outputStart, conn.outputEnd) === unsent)
  }

  // --- The fixed-Huffman encoder ---------------------------------------------
  {
    const fixed = new GzipFixedCompressor()
    const rng = new Rng(21)
    const out: u8[] = new Array<u8>(40000)
    const sizes: i32[] = [0, 1, 2, 3, 7, 8, 9, 63, 255, 512, 700, 1024, 1500, 2048, 4096, 5000, 8192, 12000, 16383, 16384, 16385, 30000]
    let jsonOk: boolean = true
    let noiseOk: boolean = true
    let runsOk: boolean = true
    for (const n of sizes) {
      const doc: u8[] = randomJson(rng, n)
      const m: i32 = fixed.compress(doc, 0, n, out, 0, toI32(out.length))
      if (m < 0 || gunzip.decompress(out, 0, m, back, 0, 70000) !== n || !same(doc, back, 0, n)) {
        jsonOk = false
      }
      const noise: u8[] = new Array<u8>(n)
      for (let i: i32 = 0; i < n; i++) {
        noise[i] = toU8(rng.nextInt(0, 255))
      }
      const k: i32 = fixed.compress(noise, 0, n, out, 0, toI32(out.length))
      if (k < 0 || gunzip.decompress(out, 0, k, back, 0, 70000) !== n || !same(noise, back, 0, n)) {
        noiseOk = false
      }
      // Runs of one byte, so matches of 3 to 258 at distances 1 and more.
      const runs: u8[] = new Array<u8>(n)
      let i: i32 = 0
      while (i < n) {
        const c: u8 = toU8(rng.nextInt(97, 100))
        const len: i32 = rng.nextInt(1, 600)
        for (let j: i32 = 0; j < len && i < n; j++) {
          runs[i] = c
          i += 1
        }
      }
      const r: i32 = fixed.compress(runs, 0, n, out, 0, toI32(out.length))
      if (r < 0 || gunzip.decompress(out, 0, r, back, 0, 70000) !== n || !same(runs, back, 0, n)) {
        runsOk = false
      }
    }
    t.ok("fixed: random JSON of 0 to 30000 bytes gunzips back", jsonOk)
    t.ok("fixed: random bytes gunzip back", noiseOk)
    t.ok("fixed: long runs gunzip back", runsOk)
    // A window inside a larger buffer, written at an offset.
    const m: i32 = fixed.compress(body, 100, 3000, out, 50, 10000)
    t.ok("fixed: a window at an offset", m > 50 && gunzip.decompress(out, 50, m - 50, back, 0, 70000) === 3000 && same(back, body, 100, 3000))
    // The same text twice, 16000 bytes apart: a match near the window's edge.
    const twice: u8[] = new Array<u8>(17000)
    const half: u8[] = randomJson(rng, 1000)
    for (let i: i32 = 0; i < 17000; i++) {
      twice[i] = i < 1000 ? half[i] : i >= 16000 ? half[i - 16000] : toU8(rng.nextInt(0, 255))
    }
    const far: i32 = fixed.compress(twice, 0, 17000, out, 0, toI32(out.length))
    t.ok("fixed: a match 16000 back", far > 0 && gunzip.decompress(out, 0, far, back, 0, 70000) === 17000 && same(twice, back, 0, 17000))
    const whole: i32 = fixed.compress(body, 0, 5221, out, 0, toI32(out.length))
    t.ok(`fixed: 5221 bytes of JSON become ${whole}`, whole > 0 && whole < 2600)
    t.eqI32("fixed: too little room is DEFLATE_NO_ROOM", fixed.compress(body, 0, 5221, out, 0, whole - 1), DEFLATE_NO_ROOM)
    t.eqI32("fixed: room under the gzip framing is DEFLATE_NO_ROOM", fixed.compress(body, 0, 10, out, 0, 17), DEFLATE_NO_ROOM)
    t.eqI32("fixed: exactly the room it needs", fixed.compress(body, 0, 5221, out, 0, whole), whole)
  }

  // --- The policy --------------------------------------------------------------
  {
    const p = new HttpCompressor(DEFLATE_FAST, 256, 65536)
    t.eqI32("policy: no decision yet reads as not accepted", p.decision, HTTP_COMPRESS_NOT_ACCEPTED)
    const auto: i32 = p.compress(HTTP_CODING_GZIP, body, 0, 5221)
    t.eqI32("policy: sent", p.decision, HTTP_COMPRESS_SENT)
    t.ok("policy: and it varies", p.varies())
    p.encoder = HTTP_ENCODER_LEVEL
    const level: i32 = p.compress(HTTP_CODING_GZIP, body, 0, 5221)
    t.ok(`policy: by size the fixed encoder (${auto} bytes), larger than the level's (${level})`, auto > level && level > 0)
    t.eqI32("policy: the level's gunzips", gunzip.decompress(p.output, 0, level, back, 0, 70000), 5221)
    p.encoder = HTTP_ENCODER_FIXED
    t.eqI32("policy: HTTP_ENCODER_FIXED is the fixed encoder's", p.compress(HTTP_CODING_GZIP, body, 0, 5221), auto)
    p.fixedLimit = 4096
    t.eqI32("policy: whatever fixedLimit says", p.compress(HTTP_CODING_GZIP, body, 0, 5221), auto)
    p.encoder = 0
    t.eqI32("policy: auto above fixedLimit is the level's", p.compress(HTTP_CODING_GZIP, body, 0, 5221), level)
    p.fixedLimit = 16384
    t.eqI32("policy: identity", p.compress(HTTP_CODING_IDENTITY, body, 0, 5221), -1)
    t.eqI32("policy: is not accepted", p.decision, HTTP_COMPRESS_NOT_ACCEPTED)
    t.ok("policy: which varies", p.varies())
    t.eqI32("policy: too small", p.compress(HTTP_CODING_GZIP, body, 0, 255), -1)
    t.eqI32("policy: is TOO_SMALL", p.decision, HTTP_COMPRESS_TOO_SMALL)
    t.ok("policy: which does not vary", !p.varies())
    t.eqI32("policy: too small, whatever the coding", p.compress(HTTP_CODING_IDENTITY, body, 0, 255), -1)
    t.eqI32("policy: is TOO_SMALL still", p.decision, HTTP_COMPRESS_TOO_SMALL)
    t.eqI32("policy: too large", p.compress(HTTP_CODING_GZIP, new Array<u8>(65537), 0, 65537), -1)
    t.eqI32("policy: is TOO_LARGE", p.decision, HTTP_COMPRESS_TOO_LARGE)
    const saved: i32 = 5221 - auto
    p.minSaving = saved
    t.eqI32("policy: a saving of exactly minSaving is sent", p.compress(HTTP_CODING_GZIP, body, 0, 5221), auto)
    p.minSaving = saved + 1
    t.eqI32("policy: one byte short is not", p.compress(HTTP_CODING_GZIP, body, 0, 5221), -1)
    t.eqI32("policy: is TOO_LITTLE_SAVED", p.decision, HTTP_COMPRESS_TOO_LITTLE_SAVED)
    t.ok("policy: which does not vary", !p.varies())
    p.minSaving = 0
    p.minSavingPercent = (saved * 100) / 5221
    t.eqI32(`policy: ${p.minSavingPercent}% saved is sent`, p.compress(HTTP_CODING_GZIP, body, 0, 5221), auto)
    p.minSavingPercent += 1
    t.eqI32(`policy: ${p.minSavingPercent}% is not`, p.compress(HTTP_CODING_GZIP, body, 0, 5221), -1)
    p.minSavingPercent = 100
    t.eqI32("policy: 100% never is", p.compress(HTTP_CODING_GZIP, body, 0, 5221), -1)
    p.minSavingPercent = -5
    t.eqI32("policy: below 0% counts as 0", p.compress(HTTP_CODING_GZIP, body, 0, 5221), auto)
    t.eqI32("policy: leastSaving is at least 1", p.leastSaving(5221), 1)
    p.minSavingPercent = 10
    t.eqI32("policy: 10% of 1001 rounds up to 101", p.leastSaving(1001), 101)
    p.minSaving = 200
    t.eqI32("policy: the larger of the two", p.leastSaving(1001), 200)
    p.minSaving = 1
    p.minSavingPercent = 0
    const rng = new Rng(9)
    const noise: u8[] = new Array<u8>(3000)
    for (let i: i32 = 0; i < 3000; i++) {
      noise[i] = toU8(rng.nextInt(0, 255))
    }
    t.eqI32("policy: random bytes save nothing", p.compress(HTTP_CODING_GZIP, noise, 0, 3000), -1)
    t.eqI32("policy: TOO_LITTLE_SAVED", p.decision, HTTP_COMPRESS_TOO_LITTLE_SAVED)
    p.encoder = HTTP_ENCODER_LEVEL
    t.eqI32("policy: by the level's too", p.compress(HTTP_CODING_GZIP, noise, 0, 3000), -1)
    p.encoder = 0
    // Segments.
    t.eqI32("segments: none for nothing", httpSegments(0, 1448), 0)
    t.eqI32("segments: one byte", httpSegments(1, 1448), 1)
    t.eqI32("segments: one full", httpSegments(1448, 1448), 1)
    t.eqI32("segments: one over", httpSegments(1449, 1448), 2)
    t.ok("segments: 1449 to 1448 is fewer", p.fewerSegments(1449, 1448, 1448))
    t.ok("segments: 1448 to 10 is not", !p.fewerSegments(1448, 10, 0))
    t.eqI32("segments: NO_FEWER_SEGMENTS", p.decision, HTTP_COMPRESS_NO_FEWER_SEGMENTS)
    t.ok("segments: which does not vary", !p.varies())
    t.ok("segments: at a 500-byte mss it is", p.fewerSegments(1448, 10, 500))
    // identity;q=0.
    t.ok("refused: identity;q=0", httpIdentityRefused(ascii("gzip, identity;q=0"), 0, 18))
    t.ok("refused: *;q=0", httpIdentityRefused(ascii("gzip, *;q=0"), 0, 11))
    t.ok("refused: not *;q=0 with identity listed", !httpIdentityRefused(ascii("identity, *;q=0"), 0, 15))
    t.ok("refused: not gzip;q=0", !httpIdentityRefused(ascii("gzip;q=0"), 0, 8))
    t.ok("refused: not an empty field", !httpIdentityRefused(ascii(""), 0, 0))
    const tiny: i32 = p.compressAnyway(HTTP_CODING_GZIP, body, 0, 40)
    t.ok(`refused: compressAnyway gzips 40 bytes into ${tiny}`, tiny > 40 && gunzip.decompress(p.output, 0, tiny, back, 0, 70000) === 40)
    t.eqI32("refused: and says sent", p.decision, HTTP_COMPRESS_SENT)
    t.ok("refused: random bytes too", p.compressAnyway(HTTP_CODING_GZIP, noise, 0, 3000) > 3000)
    t.eqI32("refused: but not past maxLength", p.compressAnyway(HTTP_CODING_GZIP, new Array<u8>(65537), 0, 65537), -1)
    t.eqI32("refused: nor a coding not gzip", p.compressAnyway(HTTP_CODING_NONE, body, 0, 40), -1)
  }

  // --- HTTP/1.1 under the policy ----------------------------------------------
  {
    const p = new HttpCompressor(DEFLATE_FAST, 256, 65536)
    p.segmentMode = true
    // 5221 bytes of JSON: four segments as they are, two gzipped.
    const big = request(t, "h1 segments", config, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("h1 segments: respondEncoded", big.respondEncoded(200, names, values, body, 0, 5221, p, big.acceptEncoding()), 0)
    const r: Response = queued(big)
    const gzHead: i32 = r.bodyStart - big.outputStart
    const packed: i32 = r.bodyEnd - r.bodyStart
    t.ok("h1 segments: fewer segments, so gzip", r.has("content-encoding: gzip") && p.decision === HTTP_COMPRESS_SENT)
    t.ok("h1 segments: with vary", r.has("vary: accept-encoding"))
    // The same at an mss nothing outgrows: one segment either way.
    const wide = request(t, "h1 one segment", config, "GET", "accept-encoding: gzip\r\n")
    wide.mss = 100000
    t.eqI32("h1 one segment: respondEncoded", wide.respondEncoded(200, names, values, body, 0, 5221, p, wide.acceptEncoding()), 0)
    const w: Response = queued(wide)
    t.ok("h1 one segment: sent as it is", w.head.indexOf("content-encoding") < 0 && w.has("content-length: 5221"))
    t.eqI32("h1 one segment: NO_FEWER_SEGMENTS", p.decision, HTTP_COMPRESS_NO_FEWER_SEGMENTS)
    t.ok("h1 one segment: no vary", w.head.indexOf("vary") < 0)
    t.ok("h1 one segment: the body", w.bodyEnd - w.bodyStart === 5221 && same(body, w.bytes, w.bodyStart, 5221))
    t.eqI32("h1 one segment: http1IdentityHead is the head written", p.http1IdentityHead(gzHead, packed, 5221), w.bodyStart - wide.outputStart)
    // 1200 bytes: one segment as they are, so gzip cannot be fewer.
    const small = request(t, "h1 small segment", config, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("h1 small segment: respondEncoded", small.respondEncoded(200, names, values, body, 0, 1200, p, small.acceptEncoding()), 0)
    t.ok("h1 small segment: sent as it is", queued(small).has("content-length: 1200") && p.decision === HTTP_COMPRESS_NO_FEWER_SEGMENTS)
    // Without segment mode the same body is gzipped.
    p.segmentMode = false
    const plain = request(t, "h1 no segments", config, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("h1 no segments: respondEncoded", plain.respondEncoded(200, names, values, body, 0, 1200, p, plain.acceptEncoding()), 0)
    t.ok("h1 no segments: gzip", queued(plain).has("content-encoding: gzip"))
    // A gzip head taken back behind an earlier response.
    p.segmentMode = true
    const two = request(t, "h1 behind", config, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("h1 behind: the first answer", two.respondEncoded(200, names, values, body, 0, 300, p, HTTP_CODING_IDENTITY), 0)
    const again: u8[] = ascii("GET /again HTTP/1.1\r\nhost: example.com\r\naccept-encoding: gzip\r\n\r\n")
    two.feed(again, 0, toI32(again.length))
    t.eqI32("h1 behind: the first request ends", two.next(), H1_END)
    t.eqI32("h1 behind: a second request", two.next(), H1_REQUEST)
    const first: i32 = two.outputEnd
    t.eqI32("h1 behind: respondEncoded", two.respondEncoded(200, names, values, body, 0, 1200, p, two.acceptEncoding()), 0)
    const b: Response = new Response(two.output, first, two.outputEnd)
    t.ok("h1 behind: the second is whole, as it is", b.head.startsWith("http/1.1 200 ok\r\n") && b.has("content-length: 1200") && b.bodyEnd - b.bodyStart === 1200)
    // identity;q=0: gzip under minLength and under segment mode alike.
    const refused = request(t, "h1 refused", config, "GET", "accept-encoding: gzip, identity;q=0\r\n")
    t.ok("h1 refused: the connection reads it", refused.identityRefused() && refused.acceptEncoding() === HTTP_CODING_GZIP)
    t.eqI32("h1 refused: respondEncoded", refused.respondEncoded(200, names, values, body, 0, 100, p, refused.acceptEncoding()), 0)
    const f: Response = queued(refused)
    t.ok("h1 refused: 100 bytes gzipped all the same", f.has("content-encoding: gzip") && f.has("vary: accept-encoding"))
    t.eqI32("h1 refused: and they gunzip", gunzip.decompress(f.bytes, f.bodyStart, f.bodyEnd - f.bodyStart, back, 0, 70000), 100)
    // gzip;q=0: identity, and vary, since another client would get gzip.
    const no = request(t, "h1 q0", config, "GET", "accept-encoding: gzip;q=0\r\n")
    t.ok("h1 q0: not refused", !no.identityRefused())
    t.eqI32("h1 q0: respondEncoded", no.respondEncoded(200, names, values, body, 0, 5221, p, no.acceptEncoding()), 0)
    const z: Response = queued(no)
    t.ok("h1 q0: sent as it is, with vary", z.head.indexOf("content-encoding") < 0 && z.has("vary: accept-encoding") && z.has("content-length: 5221"))
    // Nothing acceptable and identity refused: identity anyway (RFC 9110 §12.5.3).
    const none = request(t, "h1 none acceptable", config, "GET", "accept-encoding: br, identity;q=0\r\n")
    t.eqI32("h1 none acceptable: HTTP_CODING_NONE", none.acceptEncoding(), HTTP_CODING_NONE)
    t.eqI32("h1 none acceptable: respondEncoded", none.respondEncoded(200, names, values, body, 0, 5221, p, none.acceptEncoding()), 0)
    const e: Response = queued(none)
    t.ok("h1 none acceptable: identity, with vary", e.has("content-length: 5221") && e.has("vary: accept-encoding"))
  }

  // --- The one-segment skip ---------------------------------------------------
  {
    const p = new HttpCompressor(DEFLATE_FAST, 256, 65536)
    p.segmentMode = true
    t.ok("skip: 1448 bytes fit the default segment", p.oneSegment(HTTP_CODING_GZIP, 1448, 0))
    t.ok("skip: 1449 do not", !p.oneSegment(HTTP_CODING_GZIP, 1449, 0))
    t.ok("skip: the connection's mss wins over the compressor's", p.oneSegment(HTTP_CODING_GZIP, 2000, 2000) && !p.oneSegment(HTTP_CODING_GZIP, 2001, 2000))
    t.ok("skip: not under minLength", !p.oneSegment(HTTP_CODING_GZIP, 255, 0))
    t.ok("skip: not for a client without gzip", !p.oneSegment(HTTP_CODING_IDENTITY, 600, 0))
    // 600 bytes and their head fit the default segment: no encoder runs.
    const one = request(t, "skip one", config, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("skip one: respondEncoded", one.respondEncoded(200, names, values, body, 0, 600, p, one.acceptEncoding()), 0)
    const o: Response = queued(one)
    t.eqI32("skip one: NO_FEWER_SEGMENTS", p.decision, HTTP_COMPRESS_NO_FEWER_SEGMENTS)
    t.ok("skip one: sent as it is", o.head.indexOf("content-encoding") < 0 && o.has("content-length: 600") && same(body, o.bytes, o.bodyStart, 600))
    t.ok("skip one: no vary", o.head.indexOf("vary") < 0)
    t.eqI32("skip one: and no encoder ran", p.encoderRuns, 0)
    // The whole response, head and 600 bytes: the boundary is set from it.
    const whole: i32 = o.bodyEnd - one.outputStart
    const exact = request(t, "skip exact", config, "GET", "accept-encoding: gzip\r\n")
    exact.mss = whole
    t.eqI32("skip exact: respondEncoded", exact.respondEncoded(200, names, values, body, 0, 600, p, exact.acceptEncoding()), 0)
    t.ok(`skip exact: a ${whole}-byte response in a ${whole}-byte segment is sent as it is`, queued(exact).has("content-length: 600") && p.decision === HTTP_COMPRESS_NO_FEWER_SEGMENTS)
    t.eqI32("skip exact: no encoder ran", p.encoderRuns, 0)
    // One byte over the segment: compressed, since gzip then takes one segment, not two.
    const over = request(t, "skip over", config, "GET", "accept-encoding: gzip\r\n")
    over.mss = whole - 1
    t.eqI32("skip over: respondEncoded", over.respondEncoded(200, names, values, body, 0, 600, p, over.acceptEncoding()), 0)
    const v: Response = queued(over)
    t.ok(`skip over: a ${whole}-byte response in a ${whole - 1}-byte segment is gzipped`, v.has("content-encoding: gzip") && v.has("vary: accept-encoding") && p.decision === HTTP_COMPRESS_SENT)
    t.ok("skip over: in one segment", v.bodyEnd - over.outputStart <= whole - 1)
    t.eqI32("skip over: and gunzips", gunzip.decompress(v.bytes, v.bodyStart, v.bodyEnd - v.bodyStart, back, 0, 70000), 600)
    t.eqI32("skip over: one encoder run", p.encoderRuns, 1)
    // A body of exactly one segment: its head pushes it over, so it is compressed.
    const full = request(t, "skip full", config, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("skip full: respondEncoded", full.respondEncoded(200, names, values, body, 0, 1448, p, full.acceptEncoding()), 0)
    t.ok("skip full: 1448 bytes and a head are gzipped", queued(full).has("content-encoding: gzip") && p.decision === HTTP_COMPRESS_SENT)
    t.eqI32("skip full: one encoder run more", p.encoderRuns, 2)
    const past = request(t, "skip past", config, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("skip past: respondEncoded", past.respondEncoded(200, names, values, body, 0, 1449, p, past.acceptEncoding()), 0)
    t.ok("skip past: 1449 bytes are gzipped", queued(past).has("content-encoding: gzip") && p.decision === HTTP_COMPRESS_SENT)
    t.eqI32("skip past: one encoder run more", p.encoderRuns, 3)
    // A client that takes no gzip: NOT_ACCEPTED, with vary, as before.
    const not = request(t, "skip not accepted", config, "GET", "")
    t.eqI32("skip not accepted: respondEncoded", not.respondEncoded(200, names, values, body, 0, 600, p, not.acceptEncoding()), 0)
    const a: Response = queued(not)
    t.eqI32("skip not accepted: NOT_ACCEPTED", p.decision, HTTP_COMPRESS_NOT_ACCEPTED)
    t.ok("skip not accepted: as it is, with vary", a.head.indexOf("content-encoding") < 0 && a.has("vary: accept-encoding"))
    // Under minLength: TOO_SMALL, as before.
    const short = request(t, "skip short", config, "GET", "accept-encoding: gzip\r\n")
    t.eqI32("skip short: respondEncoded", short.respondEncoded(200, names, values, body, 0, 100, p, short.acceptEncoding()), 0)
    t.eqI32("skip short: TOO_SMALL", p.decision, HTTP_COMPRESS_TOO_SMALL)
    // identity;q=0: gzip all the same, one segment or not.
    const must = request(t, "skip refused", config, "GET", "accept-encoding: gzip, identity;q=0\r\n")
    t.eqI32("skip refused: respondEncoded", must.respondEncoded(200, names, values, body, 0, 600, p, must.acceptEncoding()), 0)
    t.ok("skip refused: gzipped", queued(must).has("content-encoding: gzip") && p.decision === HTTP_COMPRESS_SENT)
    t.eqI32("skip refused: one encoder run more", p.encoderRuns, 4)
    // The count wraps rather than panic a server that has run 2^31 encoders.
    p.encoderRuns = 2147483647
    t.ok("runs: compress at 2^31 - 1 runs", p.compress(HTTP_CODING_GZIP, body, 0, 5221) > 0)
    t.eqI32("runs: wraps to -2^31", p.encoderRuns, -2147483648)
    p.encoderRuns = 2147483647
    t.ok("runs: so does compressAnyway", p.compressAnyway(HTTP_CODING_GZIP, body, 0, 40) > 0 && p.encoderRuns === -2147483648)
  }
  return t.done()
}

