// HTTP/1.1 (std/net/http1-codec.ts and std/net/http1-server.ts) under an
// instruction count, with no socket: each round parses a POST with a body
// and a GET on one kept-alive `Http1Parser`, with the limits
// nish/net/http1-server defaults to, and writes a chunked response with
// `http1WriteResponseHead`, `http1WriteChunk` and `http1WriteLastChunk`;
// then it feeds the GET to an `Http1Connection`, answers it with `respond`,
// `write` and `end`, and takes the output back with `consume`, its date
// pinned so that no clock reaches the count. Both the parser and the writers
// hold panic sites the std/ ratchet counts, so a fix to one of them shows
// here as a count that holds or falls. It prints a sum over what it parsed
// and wrote.
import {
  HTTP1_BODY,
  HTTP1_CHUNKED,
  HTTP1_END,
  HTTP1_HEAD,
  HTTP1_NEED_MORE,
  Http1Parser,
  http1WriteChunk,
  http1WriteLastChunk,
  http1WriteResponseHead,
} from "nish/net/http1-codec"
import { H1_REQUEST, Http1Config, Http1Connection } from "nish/net/http1-server"
import { httpFieldBytes } from "nish/net/http-fields"

/** The limits nish/net/http1-server defaults to. */
const MAX_TARGET: i32 = 8192
const MAX_HEADER_BYTES: i32 = 16384
const MAX_HEADERS: i32 = 100
const MAX_BODY: i32 = 1048576
/** The instant the connection's date is pinned to, in milliseconds since 1970. */
const PINNED_MS: i64 = 1792138314000

const CRLF: string = "\r\n"

/** A POST with a JSON body of 61 bytes. */
const postRequest = (): string =>
  `POST /api/items HTTP/1.1${CRLF}Host: 10.0.0.2:8080${CRLF}User-Agent: loadgen/1.0${CRLF}Accept: application/json${CRLF}Accept-Encoding: gzip, deflate${CRLF}Authorization: Token abcdefghijklmnopqrstuvwxyz0123456789-_ABCDEFGH${CRLF}Content-Type: application/json${CRLF}Content-Length: 61${CRLF}${CRLF}{"name":"widget","count":12,"tags":["a","b"],"ok":true,"n":1}`

/** A GET with a query and a cookie. */
const getRequest = (): string =>
  `GET /api/items/42?view=full HTTP/1.1${CRLF}Host: 10.0.0.2:8080${CRLF}User-Agent: loadgen/1.0${CRLF}Accept: application/json${CRLF}Cookie: session=0123456789abcdef; theme=dark${CRLF}${CRLF}`

/** One step of FNV-1a over a whole `i32`. */
const mix = (sum: u32, x: i32): u32 => (sum ^ toU32(x)) * 16777619

/** Parses the one request `p` was fed, to its `HTTP1_END`, folding what it read into `sum0`. */
const parseOne = (p: Http1Parser, sum0: u32): u32 => {
  let sum: u32 = sum0
  let event: i32 = p.next()
  while (event !== HTTP1_END) {
    if (event === HTTP1_HEAD) {
      sum = mix(sum, p.methodStart)
      sum = mix(sum, p.targetEnd)
      sum = mix(sum, p.headerCount)
      sum = mix(sum, p.contentLength)
      for (let k: i32 = 0; k < 4 * p.headerCount && k < toI32(p.spans.length); k++) {
        sum = mix(sum, p.spans[k])
      }
    } else if (event === HTTP1_BODY) {
      sum = mix(sum, p.bodyLen)
    } else if (event === HTTP1_NEED_MORE || p.status !== 0) {
      panic("std-http1: the parser stopped before the end of a request")
    }
    event = p.next()
  }
  return sum
}

/** A chunked response with `body` in two chunks, written into `out` from 0: where it ends. */
const writeResponse = (out: u8[], names: u8[][], values: u8[][], date: u8[], body: u8[]): i32 => {
  let at: i32 = http1WriteResponseHead(out, 0, 200, "OK", names, values, HTTP1_CHUNKED, "", date)
  if (at < 0) {
    panic(`std-http1: the head was refused with ${at}`)
  }
  const half: i32 = toI32(body.length) / 2
  at = http1WriteChunk(out, at, body, 0, half)
  if (at >= 0) {
    at = http1WriteChunk(out, at, body, half, toI32(body.length) - half)
  }
  if (at >= 0) {
    at = http1WriteLastChunk(out, at)
  }
  if (at < 0) {
    panic("std-http1: the response does not fit")
  }
  return at
}

/** Feeds `request` to `conn`, answers it with `body` in a chunked response, and takes the output: its length. */
const serveOne = (conn: Http1Connection, request: u8[], names: u8[][], values: u8[][], body: u8[]): i32 => {
  if (conn.feed(request, 0, toI32(request.length)) !== toI32(request.length)) {
    panic("std-http1: the connection took part of the request")
  }
  let found: boolean = false
  for (let k: i32 = 0; k < 4 && !found; k++) {
    found = conn.next() === H1_REQUEST
  }
  if (!found) {
    panic("std-http1: the connection read no request")
  }
  if (conn.respond(200, names, values, HTTP1_CHUNKED) !== 0) {
    panic("std-http1: respond refused the head")
  }
  if (conn.write(body, 0, toI32(body.length)) !== toI32(body.length) || conn.end() !== 0) {
    panic("std-http1: the body did not fit")
  }
  const sent: i32 = conn.outputEnd - conn.outputStart
  conn.consume(sent)
  return sent
}

export const main = (): i32 => {
  const n: i32 = 8000 // bench:n
  const post: u8[] = httpFieldBytes(postRequest())
  const get: u8[] = httpFieldBytes(getRequest())
  const body: u8[] = httpFieldBytes(`{"id":42,"name":"widget","count":12,"tags":["a","b"],"ok":true}`)
  const names: u8[][] = [
    httpFieldBytes("Content-Type"),
    httpFieldBytes("Server"),
    httpFieldBytes("Cache-Control"),
  ]
  const values: u8[][] = [
    httpFieldBytes("application/json"),
    httpFieldBytes("nish"),
    httpFieldBytes("no-store"),
  ]
  const date: u8[] = httpFieldBytes("Sun, 06 Nov 1994 08:49:37 GMT")
  const out = new Array<u8>(4096)
  const p = new Http1Parser(MAX_TARGET, MAX_HEADER_BYTES, MAX_HEADERS, MAX_BODY)
  p.keepText = false
  const config = new Http1Config()
  config.outputSize = 8192
  const conn = new Http1Connection(config)
  conn.date.pin(PINNED_MS)
  let sum: u32 = 2166136261
  let written: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    p.feed(post, 0, toI32(post.length))
    sum = parseOne(p, sum)
    p.feed(get, 0, toI32(get.length))
    sum = parseOne(p, sum)
    const end: i32 = writeResponse(out, names, values, date, body)
    written += toI64(end) + toI64(out[end - 7])
    written += toI64(serveOne(conn, get, names, values, body))
  }
  console.log(`${sum} ${written}`)
  return 0
}
