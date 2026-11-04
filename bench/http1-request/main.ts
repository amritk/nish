// The HTTP/1.1 request path as a server meets it, without sockets: request
// heads in the shapes real clients send, fed to one keep-alive
// `Http1Connection`, answered through `respond` with a JSON body written by
// `JsonWriter`, then what `Http1Server.send` and `settle` do once the bytes
// are out. run.mjs times every case in interleaved rounds; see
// bench/http1-request/README.md.
//
//   main <case> <iterations>
//
//     browser   a 756-byte browser GET: Accept, Accept-Language, User-Agent,
//               Cookie and a 251-byte HS256 Bearer token
//     api       an API client's POST: a 338-byte head with a 148-byte HS256
//               Bearer token, and a 61-byte JSON body
//     short     `GET / HTTP/1.1` and Host, 37 bytes
//     pipelined the API POST and the browser GET in one read
//     split     the browser GET in two reads, cut inside its Cookie line
//     json1k, json4k, json16k, json40k
//               the short GET answered with up to that much JSON: 1,008,
//               3,943, 16,193 and 40,760 bytes in the first iteration
//
// Each iteration feeds the case's reads, takes every request they hold to
// its end, answers it, and drains the output. On each request the program
// does what a router does: `methodIs` for GET, POST, PUT and DELETE, and
// `headerIndex("authorization")`. It prints `checksum xxxxxxxx` on stdout
// and the timed loop's nanoseconds as `ns N` on stderr. The checksum folds
// every response's bytes in the first iteration, and every iteration's
// read count and every request's target length, method, field count,
// Authorization index and body bytes in all of them, so two builds that
// parse or answer differently disagree on it, and `split` does not share
// `browser`'s.

import { JsonWriter } from "nish/json"
import {
  H1_BODY,
  H1_END,
  H1_NEED_MORE,
  H1_REQUEST,
  Http1Config,
  Http1Connection,
  Http1OutputPool,
  HttpDate,
} from "nish/net/http1-server"

import { foldStart, now, report } from "../crypto/lib/gen"

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(text.length))
  for (let i: i32 = 0; i < toI32(out.length); i += 1) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/** `a` then `b`, one array. */
const concat = (a: u8[], b: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(toI32(a.length) + toI32(b.length))
  for (let i: i32 = 0; i < toI32(a.length); i += 1) {
    out[i] = a[i]
  }
  for (let i: i32 = 0; i < toI32(b.length); i += 1) {
    out[toI32(a.length) + i] = b[i]
  }
  return out
}

/** `bytes[from, to)` as a new array. */
const slice = (bytes: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = new Array<u8>(to - from)
  for (let i: i32 = from; i < to; i += 1) {
    out[i - from] = bytes[i]
  }
  return out
}

/** `n` base64url characters drawn from a fixed stream. */
const b64 = (n: i32, seed: i32): string => {
  const alphabet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  const parts: string[] = []
  let x: i32 = seed
  for (let k: i32 = 0; k < n; k += 1) {
    x = (x * 1103 + 12345) & 65535
    parts.push(alphabet.substring(x & 63, (x & 63) + 1))
  }
  return parts.join("")
}

/**
 * An HS256 JWT: the usual 36-character protected header, a claims part of
 * `claims` characters and a 43-character signature, each part filled from
 * `seed`.
 */
const jwt = (claims: i32, seed: i32): string =>
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${b64(claims, seed)}.${b64(43, seed + 4)}`

/**
 * A browser's GET for a page's data: 756 bytes. Its longest lines are
 * Authorization (273 bytes), User-Agent (113) and Cookie (93).
 */
const browserHead = (): string =>
  "GET /api/articles?limit=20&offset=0&tag=dragons HTTP/1.1\r\n" +
  "Host: conduit.example.com\r\n" +
  "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\r\n" +
  "Accept: application/json, text/plain, */*\r\n" +
  "Accept-Language: en-US,en;q=0.9,de;q=0.8\r\n" +
  "Accept-Encoding: gzip, deflate, br\r\n" +
  "Referer: https://conduit.example.com/\r\n" +
  `Cookie: session=${b64(32, 3)}; theme=dark; _ga=GA1.2.1234567890.1700000000\r\n` +
  `Authorization: Bearer ${jwt(170, 7)}\r\n` +
  "Connection: keep-alive\r\n" +
  "\r\n"

/** The JSON an API client posts: 61 bytes. */
const API_BODY: string = '{"article":{"title":"How to train your dragon","tagList":[]}}'

/**
 * An API client's POST: a 338-byte head, its Bearer token the 148-byte HS256
 * JWT a server issues (a 67-character claims part, about 50 bytes of JSON:
 * sub, iat, exp), and the JSON body.
 */
const apiRequest = (): string =>
  "POST /api/articles HTTP/1.1\r\n" +
  "Host: api.example.com\r\n" +
  "User-Agent: conduit-client/2.4.1\r\n" +
  "Accept: application/json\r\n" +
  "Content-Type: application/json\r\n" +
  `Content-Length: ${API_BODY.length}\r\n` +
  `Authorization: Bearer ${jwt(67, 13)}\r\n` +
  "\r\n" +
  API_BODY

/** The shortest request a client sends: 37 bytes. */
const SHORT: string = "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"

/** One case: the reads one iteration feeds, the requests they hold, and the JSON each answer carries. */
class Case {
  reads: u8[][]
  requests: i32
  jsonBytes: i32
  constructor(reads: u8[][], requests: i32, jsonBytes: i32) {
    this.reads = reads
    this.requests = requests
    this.jsonBytes = jsonBytes
  }
}

/** The case named `name`, or null. */
const caseNamed = (name: string): Case | null => {
  if (name === "browser") {
    return new Case([ascii(browserHead())], 1, 0)
  }
  if (name === "api") {
    return new Case([ascii(apiRequest())], 1, 0)
  }
  if (name === "short") {
    return new Case([ascii(SHORT)], 1, 0)
  }
  if (name === "pipelined") {
    return new Case([concat(ascii(apiRequest()), ascii(browserHead()))], 2, 0)
  }
  if (name === "split") {
    const head: u8[] = ascii(browserHead())
    const cut: i32 = toI32(browserHead().indexOf("theme=dark"))
    return new Case([slice(head, 0, cut), slice(head, cut, toI32(head.length))], 1, 0)
  }
  if (name === "json1k") {
    return new Case([ascii(SHORT)], 1, 1024)
  }
  if (name === "json4k") {
    return new Case([ascii(SHORT)], 1, 4096)
  }
  if (name === "json16k") {
    return new Case([ascii(SHORT)], 1, 16384)
  }
  if (name === "json40k") {
    return new Case([ascii(SHORT)], 1, 40960)
  }
  return null
}

/** One FNV-1a 32 step, as bench/crypto/lib/gen.ts folds a byte. */
const mix = (h: u32, b: u32): u32 => (h ^ b) * 16777619

/** The state one run keeps: the connection, its answer's buffers, and the checksum. */
class Bench {
  conn: Http1Connection
  c: Case
  names: u8[][]
  values: u8[][]
  json: u8[]
  out: JsonWriter
  slug: u8[]
  clock: i64 = 0
  sum: u32 = 0
  full: boolean = true

  constructor(c: Case) {
    const config: Http1Config = new Http1Config()
    const date: HttpDate = new HttpDate()
    date.pin(toI64(1700000000) * toI64(1000))
    // As `Http1Server.build` makes a slot's connection.
    this.conn = new Http1Connection(config)
    this.conn.pool = new Http1OutputPool(config.outputSize)
    this.conn.date = date
    this.c = c
    this.names = [ascii("content-type")]
    this.values = [ascii("application/json")]
    this.json = new Array<u8>(c.jsonBytes + 1024)
    this.out = new JsonWriter(this.json, 0)
    this.slug = ascii("how-to-train-your-dragon")
    this.sum = foldStart()
  }

  /**
   * The answer to request `n`: `{"articles":[...],"articlesCount":k}`, the
   * articles appended until about `jsonBytes` are written, as a server's
   * list endpoint writes them.
   */
  answer(n: i32): i32 {
    const w: JsonWriter = this.out
    w.reset(this.json, 0)
    w.beginObject()
    w.key("articles")
    w.beginArray()
    let k: i32 = 0
    while (w.written() + 240 < this.c.jsonBytes) {
      w.beginObject()
      w.key("slug")
      w.stringBytes(this.slug, 0, toI32(this.slug.length))
      w.key("title")
      w.string("How to train your dragon")
      w.key("description")
      w.string('Ever wonder how? "Very carefully", they said.')
      w.key("tagList")
      w.beginArray()
      w.string("dragons")
      w.string("training")
      w.endArray()
      w.key("createdAt")
      w.string("2016-02-18T03:22:56.637Z")
      w.key("favorited")
      w.boolean(false)
      w.key("favoritesCount")
      w.i32(n + k)
      w.endObject()
      k += 1
    }
    w.endArray()
    w.key("articlesCount")
    w.i32(k)
    w.endObject()
    if (!w.complete()) {
      panic("bench: the JSON did not fit")
    }
    return w.written()
  }

  /** One iteration: every read fed, every request answered, the output sent. */
  run(n: i32): void {
    const conn: Http1Connection = this.conn
    let served: i32 = 0
    this.sum = mix(this.sum, toU32(this.c.reads.length))
    for (const read of this.c.reads) {
      // `Http1Server.readable`: the room, the read, the clocks.
      const len: i32 = toI32(read.length)
      if (conn.inputRoom() < len || conn.feed(read, 0, len) !== len) {
        panic("bench: the connection took less than a read")
      }
      this.clock = this.clock + toI64(1000)
      conn.lastActive = this.clock
      conn.headArrived(this.clock)
      // The program's loop.
      let event: i32 = conn.next()
      while (event !== H1_NEED_MORE) {
        if (event === H1_REQUEST) {
          const p = conn.parser
          let method: u32 = 0
          if (p.methodIs("GET")) {
            method = 1
          } else if (p.methodIs("POST")) {
            method = 2
          } else if (p.methodIs("PUT")) {
            method = 3
          } else if (p.methodIs("DELETE")) {
            method = 4
          }
          const auth: i32 = p.headerIndex("authorization")
          this.sum = mix(this.sum, method)
          this.sum = mix(this.sum, toU32(p.headerCount * 256 + auth + 1))
          this.sum = mix(this.sum, toU32(p.targetEnd - p.targetStart))
        } else if (event === H1_BODY) {
          for (let i: i32 = 0; i < conn.dataLength; i += 1) {
            this.sum = mix(this.sum, toU32(conn.data[conn.dataStart + i]))
          }
        } else if (event === H1_END) {
          const body: i32 = this.c.jsonBytes > 0 ? this.answer(n) : 0
          const len2: i32 = body > 0 ? body : this.small(n)
          if (
            conn.respond(200, this.names, this.values, len2) !== 0 ||
            conn.write(this.json, 0, len2) !== len2
          ) {
            panic("bench: the response was refused")
          }
          conn.end()
          served += 1
        } else {
          panic(`bench: unexpected event ${event}`)
        }
        event = conn.next()
      }
    }
    if (served !== this.c.requests) {
      panic(`bench: ${served} requests answered, not ${this.c.requests}`)
    }
    // `Http1Server.send` and `settle`: everything is written at once.
    const pending: i32 = conn.outputEnd - conn.outputStart
    this.sum = mix(this.sum, toU32(pending))
    if (this.full) {
      for (let i: i32 = conn.outputStart; i < conn.outputEnd; i += 1) {
        this.sum = mix(this.sum, toU32(conn.output[i]))
      }
      this.full = false
    }
    conn.consume(pending)
    conn.release()
    if (conn.isDone()) {
      panic("bench: the connection closed")
    }
    conn.park()
    if (conn.inputRoom() <= 0 || conn.wantsWrite()) {
      panic("bench: the connection does not want to read")
    }
  }

  /** A small answer, `{"id":n,"ok":true}`, for the cases that time the head. */
  small(n: i32): i32 {
    const w: JsonWriter = this.out
    w.reset(this.json, 0)
    w.beginObject()
    w.key("id")
    w.i32(n)
    w.key("ok")
    w.boolean(true)
    w.endObject()
    return w.written()
  }
}

export const main = (): i32 => {
  const name: string = process.argv.length > 1 ? process.argv[1] : "browser"
  const iterations: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 1
  const c: Case | null = caseNamed(name)
  if (c === null || iterations < 1) {
    writeError(`http1-request: usage: main <case> <iterations>, not ${name}\n`)
    return 2
  }
  const b: Bench = new Bench(c)
  const started: i64 = now()
  for (let i: i32 = 0; i < iterations; i += 1) {
    b.run(i)
  }
  report(b.sum, started)
  return 0
}
