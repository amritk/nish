// `nish/net/http-server` over HTTP/1.1 loopback: Nish clients against an
// `HttpServer` in the same loop, its turn run between each client write and
// read. The sections of `net_handler`, which the facade must answer alike:
//
//   1. Routing: a text route, a parameter and a decoded query as JSON, HEAD on
//      a GET route, 404 and 405 (with its `Allow`) as problem+json, a body
//      echoed, a chunked response streamed in pieces, a 204.
//   2. Limits: a declared body over the cap is answered 413 and the
//      connection ends; a body at the cap is taken whole.
//   2a. The screen: CONNECT 501 and `OPTIONS *` 204 with no Allow, neither
//      taken; a chunked body past the cap 413; a head of an 8000-byte target
//      and 16000 bytes of fields served, 16400 bytes of fields 431, a
//      9000-byte target 414. Eight bodies held under `requests` 8 add less
//      to the arena than `requests × (maxBody + 3T)`, `T` = min(64 KiB,
//      `maxBody`), with a `maxBody` that is not a power of two; small bodies
//      less than `requests × 3T`.
//   3. Pipelining: three requests in one write are answered in order.
//   4. The late answer: a request held while its peer leaves answers
//      HANDLER_DROPPED, also once a new connection has taken its slot, and the
//      new connection is answered as if nothing happened.
//   5. The body deadline: a body trickled a byte at a time, each inside the
//      idle timeout, is cut off at `bodyTimeout` with no answer.
//   6. Backpressure: a peer that pipelines large answers and reads none is
//      given only what its socket holds, then every answer once it reads.
//   7. The flat arena: a warm connection serves two thousand requests with
//      `Arena.used()` unchanged and no request made past the pool.
//   8. The drain: an idle connection closes at once, no new one is accepted,
//      and a held request is still answered before its connection closes,
//      with `Connection: close` and no pipelined request read behind it.
//   9. The full pool: under `requests` 1, a request held on one connection
//      leaves a second connection's request unread, and the held answer
//      returns the entry that serves it.
//
// `deep.ts` runs the deep pipeline of `server.ts` alone, under a small stack
// (tests/run.js, "net_http_server_deep").
import { copyBytes } from "nish/bytes"
import { JsonWriter } from "nish/json"
import { HTTP1_CHUNKED } from "nish/net/http1-codec"
import { HANDLER_ABSENT, HANDLER_DROPPED, HANDLER_SENT } from "nish/net/handler"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { ROUTER_BAD_ESCAPE, Router, RouterLimits } from "nish/net/router"
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollRemove,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

import {
  App,
  awaitClose,
  awaitConnections,
  awaitHeld,
  BIG_COUNT,
  BIG_LENGTH,
  bodyIs,
  CAP,
  check,
  Client,
  dial,
  headHas,
  MILLISECOND,
  pull,
  response,
  sendAll,
  sendText,
} from "./server"

const routing = (app: App): void => {
  const c = dial(app)
  sendText(app, c, "GET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a GET of a text route is answered 200 with its body", response(app, c, false) && c.status === 200 && bodyIs(c, "hello"))
  check(app, "and its content type", headHas(c, "\r\ncontent-type: text/plain\r\n"))

  sendText(app, c, "GET /users/42?x=1&name=a%20b+c HTTP/1.1\r\nHost: t\r\n\r\n")
  check(
    app, "a parameter and a form-decoded query come back as JSON",
    response(app, c, false) && c.status === 200 && bodyIs(c, "{\"id\":42,\"name\":\"a b c\"}")
  )
  check(app, "as application/json", headHas(c, "\r\ncontent-type: application/json\r\n"))

  sendText(app, c, "GET /users/7 HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a query without the name leaves it out", response(app, c, false) && bodyIs(c, "{\"id\":7}"))

  sendText(app, c, "GET /users/7?name=a%00b HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a %00 in the query decodes to a NUL byte, as in a parameter", response(app, c, false) && bodyIs(c, "{\"id\":7,\"name\":\"a\\u0000b\"}"))

  sendText(app, c, "GET /users/7?name=%zz HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a malformed escape in the query is the program's 400", response(app, c, false) && c.status === 400)

  sendText(app, c, "HEAD / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "HEAD takes the GET route and is answered with its length and no body", response(app, c, true) && c.status === 200 && headHas(c, "\r\ncontent-length: 5\r\n"))

  sendText(app, c, "GET /nowhere HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "an unknown path is 404", response(app, c, false) && c.status === 404)
  check(app, "as an RFC 9457 problem", headHas(c, "\r\ncontent-type: application/problem+json\r\n") && bodyIs(c, "{\"type\":\"about:blank\",\"title\":\"Not Found\",\"status\":404}"))

  sendText(app, c, "PUT /users/3 HTTP/1.1\r\nHost: t\r\nContent-Length: 0\r\n\r\n")
  check(app, "a method the path does not take is 405", response(app, c, false) && c.status === 405)
  check(app, "with an Allow naming GET and DELETE, and HEAD for the GET", headHas(c, "\r\nallow: GET, DELETE, HEAD\r\n"))
  sendText(app, c, "PATCH /users/3 HTTP/1.1\r\nHost: t\r\nContent-Length: 0\r\n\r\n")
  check(app, "and a second one reuses the Allow value made for the first", response(app, c, false) && c.status === 405 && headHas(c, "DELETE"))

  sendText(app, c, "GET /problem HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a problem too large for the JSON buffer is sent without its detail", response(app, c, false) && c.status === 418 && bodyIs(c, "{\"type\":\"about:blank\",\"title\":\"I'm a teapot\",\"status\":418}"))

  sendText(app, c, "GET /users/%zz HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a parameter that is not a number is the program's 400", response(app, c, false) && c.status === 400)

  sendText(app, c, "POST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: 11\r\n\r\nhello world")
  check(app, "a body is echoed", response(app, c, false) && c.status === 200 && bodyIs(c, "hello world"))

  sendText(app, c, "POST /echo HTTP/1.1\r\nHost: t\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n4\r\ndefg\r\n0\r\n\r\n")
  check(app, "a chunked body is gathered whole", response(app, c, false) && bodyIs(c, "abcdefg"))

  sendText(app, c, "GET /stream HTTP/1.1\r\nHost: t\r\n\r\n")
  check(
    app, "a response written in three pieces arrives chunked",
    response(app, c, false) && c.status === 200 && headHas(c, "transfer-encoding: chunked") && bodyIs(c, "4\r\none,\r\n4\r\ntwo,\r\n5\r\nthree\r\n0\r\n\r\n")
  )

  sendText(app, c, "DELETE /users/9 HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "an empty answer is a 204 with no body", response(app, c, true) && c.status === 204 && c.bodyLength === 0)
  netClose(c.fd)
  check(app, "the client's close is seen", awaitConnections(app, toI32(0)))
}

const limits = (app: App): void => {
  const c = dial(app)
  sendText(app, c, `POST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: ${CAP + 1}\r\n\r\n`)
  check(app, "a declared body one byte over the cap is answered 413", response(app, c, false) && c.status === 413)
  check(app, "and the connection ends", awaitClose(app, c))
  netClose(c.fd)

  const d = dial(app)
  const body: u8[] = new Array<u8>(CAP)
  for (let k: i32 = 0; k < toI32(body.length); k++) {
    body[k] = toU8(97 + (k % 26))
  }
  sendText(app, d, `POST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: ${CAP}\r\n\r\n`)
  sendAll(app, d, body, ZERO, CAP)
  let same: boolean = response(app, d, false) && d.status === 200 && d.bodyLength === CAP
  for (let k: i32 = 0; same && k < toI32(body.length); k++) {
    same = d.buf[d.bodyStart + k] === body[k]
  }
  check(app, "a body exactly at the cap is taken whole and echoed byte for byte", same)
  netClose(d.fd)
  check(app, "both clients are gone", awaitConnections(app, toI32(0)))
}

/** `n` bytes of `a`. */
const pad = (n: i32): string => {
  let out: string = ""
  let piece: string = "a"
  let left: i32 = n
  while (left > 0) {
    if ((left & 1) === 1) {
      out = out + piece
    }
    piece = piece + piece
    left = left >> 1
  }
  return out
}

/** A request head for `GET target` whose header lines (each with its CRLF) take `fieldBytes` bytes. */
const sizedHead = (target: string, fieldBytes: i32): string =>
  `GET ${target} HTTP/1.1\r\nHost: t\r\nX-Pad: ${pad(fieldBytes - 9 - 9)}\r\n\r\n`

/** The answers the server gives before the program sees a request, and the request-head bounds. */
const screens = (app: App): void => {
  const taken: i32 = app.taken
  const c = dial(app)
  sendText(app, c, "CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n\r\n")
  check(app, "CONNECT is answered 501", response(app, c, false) && c.status === 501)
  netClose(c.fd)
  const d = dial(app)
  sendText(app, d, "OPTIONS * HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "OPTIONS * is answered 204 with no Allow", response(app, d, true) && d.status === 204 && !headHas(d, "\r\nallow:"))
  netClose(d.fd)
  check(app, "the program takes neither", app.taken === taken)

  const e = dial(app)
  sendText(app, e, `POST /echo HTTP/1.1\r\nHost: t\r\nTransfer-Encoding: chunked\r\n\r\n10001\r\n`)
  const body: u8[] = new Array<u8>(CAP + 1)
  sendAll(app, e, body, ZERO, CAP + 1)
  check(app, "a chunked body past the cap is answered 413", response(app, e, false) && e.status === 413)
  check(app, "and the connection ends", awaitClose(app, e))
  check(app, "the program never takes it", app.taken === taken)
  netClose(e.fd)

  const f = dial(app)
  sendText(app, f, sizedHead(`/?p=${pad(8000 - 4)}`, 16000))
  check(app, "an 8000-byte target with 16000 bytes of fields is served", response(app, f, false) && f.status === 200 && bodyIs(f, "hello"))
  netClose(f.fd)
  const g = dial(app)
  sendText(app, g, sizedHead("/", 16400))
  check(app, "16400 bytes of fields are answered 431", response(app, g, false) && g.status === 431)
  netClose(g.fd)
  const k = dial(app)
  sendText(app, k, sizedHead(`/?p=${pad(9000 - 4)}`, 100))
  check(app, "a 9000-byte target is answered 414", response(app, k, false) && k.status === 414)
  netClose(k.fd)
  check(app, "the screened clients are gone", awaitConnections(app, toI32(0)))
}

/**
 * The largest body array of eight requests held with a body each of `length`
 * bytes, under `requests` 8 and `maxBody`; -1 if they were not all held
 * whole. It reads the arrays, not `Arena.used`: that counts the newest chunk
 * only, and an array past 64 KiB takes a chunk of its own.
 */
const bodyLargest = (maxBody: i32, length: i32): i64 => {
  const app = new App(toI32(60000), toI32(30000), toI32(8), maxBody, toI32(16384))
  const head: u8[] = ascii(`POST /hold HTTP/1.1\r\nHost: t\r\nContent-Length: ${length}\r\n\r\n`)
  const body: u8[] = new Array<u8>(length)
  const clients: Client[] = []
  for (let k: i32 = 0; k < 8; k++) {
    clients.push(dial(app))
  }
  awaitConnections(app, toI32(8))
  for (const c of clients) {
    sendAll(app, c, head, ZERO, toI32(head.length))
    sendAll(app, c, body, ZERO, length)
  }
  let largest: i64 = toI64(-1)
  if (awaitHeld(app, toI32(8))) {
    largest = toI64(0)
    for (let k: i32 = 0; k < 8; k++) {
      const r: HttpServerRequest = app.held[k]
      if (r.bodyLength !== length) {
        largest = toI64(-1)
        break
      }
      if (toI64(r.body.length) > largest) {
        largest = toI64(r.body.length)
      }
    }
  }
  for (const c of clients) {
    netClose(c.fd)
  }
  return largest
}

/**
 * The bytes of body array eight requests hold, each sent a chunked body of
 * exactly `maxBody` bytes in pieces of 1000, 70000 and the rest, under
 * `requests` 8; -1 if they were not all held whole. A body this large takes
 * a chunk of its own, past what `Arena.used` reads, so this reads the arrays.
 */
const bodyHeld = (maxBody: i32): i64 => {
  const app = new App(toI32(60000), toI32(30000), toI32(8), maxBody, toI32(16384))
  const head: u8[] = ascii("POST /hold HTTP/1.1\r\nHost: t\r\nTransfer-Encoding: chunked\r\n\r\n")
  const body: u8[] = new Array<u8>(maxBody)
  const sizes: i32[] = [1000, 70000, maxBody - 71000]
  const clients: Client[] = []
  for (let k: i32 = 0; k < 8; k++) {
    clients.push(dial(app))
  }
  awaitConnections(app, toI32(8))
  for (const c of clients) {
    sendAll(app, c, head, ZERO, toI32(head.length))
    for (const n of sizes) {
      const line: u8[] = ascii(`${httpHex(n)}\r\n`)
      sendAll(app, c, line, ZERO, toI32(line.length))
      sendAll(app, c, body, ZERO, n)
      sendText(app, c, "\r\n")
    }
    sendText(app, c, "0\r\n\r\n")
  }
  let total: i64 = toI64(-1)
  if (awaitHeld(app, toI32(8))) {
    total = toI64(0)
    for (let k: i32 = 0; k < 8; k++) {
      const r: HttpServerRequest = app.held[k]
      if (r.bodyLength !== maxBody) {
        total = toI64(-1)
        break
      }
      total += toI64(r.body.length)
    }
  }
  for (const c of clients) {
    netClose(c.fd)
  }
  return total
}

/** `n` in hexadecimal, as a chunk size line writes it. */
const httpHex = (n: i32): string => {
  const digits: string = "0123456789abcdef"
  let out: string = ""
  let v: i32 = n
  while (v > 0 || out.length === 0) {
    out = digits.substring(v % 16, (v % 16) + 1) + out
    v = toI32(v / 16)
  }
  return out
}

/** The body arena's bound: below `requests × (maxBody + 3T)`, `T` the smaller of 64 KiB and `maxBody`. */
const bodyBound = (app: App): void => {
  const T: i64 = toI64(65536)
  const big: i64 = bodyHeld(toI32(1048575))
  check(app, "eight chunked bodies of maxBody 1048575 are held in arrays of exactly maxBody", big === toI64(8) * toI64(1048575))
  check(app, "below 8 × (maxBody + 192 KiB)", big > toI64(0) && big < toI64(8) * (toI64(1048575) + toI64(3) * T))
  const small: i64 = bodyLargest(toI32(1048575), toI32(1000))
  check(app, "eight held bodies of 1000 bytes are each in an array of at most 64 KiB, not maxBody", small > toI64(0) && small <= T)
}

const pipelining = (app: App): void => {
  const c = dial(app)
  sendText(app, c, "GET /users/1 HTTP/1.1\r\nHost: t\r\n\r\nPOST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: 3\r\n\r\nabcGET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "the first of three pipelined requests is answered first", response(app, c, false) && bodyIs(c, "{\"id\":1}"))
  check(app, "then the second", response(app, c, false) && bodyIs(c, "abc"))
  check(app, "then the third", response(app, c, false) && bodyIs(c, "hello"))
  netClose(c.fd)
  check(app, "the pipelining client is gone", awaitConnections(app, toI32(0)))
}

const lateAnswer = (app: App): void => {
  const c = dial(app)
  sendText(app, c, "GET /slow HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a request the program holds is taken", awaitHeld(app, toI32(1)))
  netClose(c.fd)
  check(app, "its peer leaves, and the idle timeout ends the connection before the answer", awaitConnections(app, toI32(0)))
  const r: HttpServerRequest = app.held[0]
  check(app, "the late answer is dropped", app.h.send(r, 200, app.text, app.hello, ZERO, toI32(app.hello.length)) === HANDLER_DROPPED)

  const d = dial(app)
  sendText(app, d, "GET /slow HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a second request is held", awaitHeld(app, toI32(2)))
  netClose(d.fd)
  check(app, "and its peer leaves and times out too", awaitConnections(app, toI32(0)))
  const e = dial(app)
  sendText(app, e, "GET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a new connection on the freed slot is answered", response(app, e, false) && bodyIs(e, "hello"))
  const s: HttpServerRequest = app.held[1]
  check(app, "an answer for the old connection is dropped though the slot is in use again", app.h.problem(s, 503, "Service Unavailable", "") === HANDLER_DROPPED)
  sendText(app, e, "GET /users/5 HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "and the new connection never sees it", response(app, e, false) && e.status === 200 && bodyIs(e, "{\"id\":5}"))
  // The pool holds two requests: the held two. The new connection was served
  // on the first one dropped, and only the second's return lets it go on.
  sendText(app, e, "GET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "the dropped requests went back to the pool", response(app, e, false) && bodyIs(e, "hello"))
  app.heldCount = 0
  netClose(e.fd)
  check(app, "the last client is gone", awaitConnections(app, toI32(0)))
}

const bodyDeadline = (app: App): void => {
  const c = dial(app)
  sendText(app, c, "POST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: 4\r\n\r\nfast")
  check(app, "a body sent whole inside the body deadline is answered", response(app, c, false) && bodyIs(c, "fast"))
  sendText(app, c, "POST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: 40\r\n\r\n")
  // A byte every 100 ms keeps the connection inside its 300 ms idle timeout,
  // so only the body deadline can end it before the fortieth.
  const one: u8[] = ascii("x")
  let sent: i32 = 0
  while (sent < 40 && !c.closed) {
    if (netWrite(c.fd, one, ZERO, toI32(1)) === 1) {
      sent += 1
    }
    const until: i64 = monotonicNanos() + toI64(100) * MILLISECOND
    while (!c.closed && monotonicNanos() < until) {
      app.turn()
      pull(c)
    }
  }
  check(app, "a body trickled inside the idle timeout is cut off at the body deadline", c.closed && sent < 40)
  check(app, "with no answer", c.length === c.responseLength)
  check(app, "and its slot is freed", awaitConnections(app, toI32(0)))
  netClose(c.fd)
}

const backpressure = (app: App): void => {
  const c = dial(app)
  let pipeline: string = ""
  for (let k: i32 = 0; k < BIG_COUNT; k++) {
    pipeline = pipeline + "GET /big HTTP/1.1\r\nHost: t\r\n\r\n"
  }
  sendText(app, c, pipeline)
  const until: i64 = monotonicNanos() + toI64(500) * MILLISECOND
  while (monotonicNanos() < until) {
    app.turn()
  }
  const early: i32 = app.bigCount
  check(app, "a peer that pipelines large answers and reads none is given only what its socket holds", early >= 1 && early < BIG_COUNT)
  let good: i32 = 0
  for (let k: i32 = 0; k < BIG_COUNT; k++) {
    if (response(app, c, false) && c.status === 200 && c.bodyLength === BIG_LENGTH) {
      good += 1
    }
  }
  check(app, "once it reads, every answer comes, in order and whole", good === BIG_COUNT && app.bigCount === BIG_COUNT)
  netClose(c.fd)
  check(app, "the reading client is gone", awaitConnections(app, toI32(0)))
}

const flat = (app: App): void => {
  const c = dial(app)
  const request: u8[] = ascii("GET /users/12?name=flat HTTP/1.1\r\nHost: t\r\n\r\nPOST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: 4\r\n\r\nflat")
  let good: i32 = 0
  for (let round: i32 = 0; round < 100; round++) {
    sendAll(app, c, request, ZERO, toI32(request.length))
    if (response(app, c, false) && response(app, c, false)) {
      good += 1
    }
  }
  const before: i64 = Arena.used()
  for (let round: i32 = 0; round < 1000; round++) {
    sendAll(app, c, request, ZERO, toI32(request.length))
    if (response(app, c, false) && c.status === 200 && response(app, c, false) && c.bodyLength === 4) {
      good += 1
    }
  }
  const kept: i64 = Arena.used() - before
  check(app, "a warm connection answers two thousand more requests, two pipelined at a time", good === 1100)
  check(app, "and the arena stays flat", kept === toI64(0))
  netClose(c.fd)
  check(app, "the warm client is gone", awaitConnections(app, toI32(0)))
}

const poolFull = (app: App): void => {
  const a = dial(app)
  sendText(app, a, "GET /slow HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "under requests 1 a held request takes the only pool entry", awaitHeld(app, toI32(1)))
  const b = dial(app)
  sendText(app, b, "GET / HTTP/1.1\r\nHost: t\r\n\r\n")
  for (let k: i32 = 0; k < 50; k++) {
    app.turn()
    pull(b)
  }
  check(app, "a second connection's request waits unread while the pool is empty", b.length === 0 && !b.closed && app.taken === 1)
  const r: HttpServerRequest = app.held[0]
  app.heldCount = 0
  check(app, "the held request is answered", app.h.send(r, 200, app.text, app.hello, ZERO, toI32(app.hello.length)) === HANDLER_SENT)
  check(app, "and its client reads it", response(app, a, false) && bodyIs(a, "hello"))
  check(app, "then the waiting request is served on the returned entry", response(app, b, false) && b.status === 200 && bodyIs(b, "hello"))
  netClose(a.fd)
  netClose(b.fd)
  check(app, "both clients are gone", awaitConnections(app, toI32(0)))
}

const draining = (app: App): void => {
  const idle = dial(app)
  sendText(app, idle, "GET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "before the drain a keep-alive client is answered", response(app, idle, false) && bodyIs(idle, "hello"))
  const busy = dial(app)
  sendText(app, busy, "GET /slow HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "and a request the program holds is taken", awaitHeld(app, toI32(1)))
  app.h.drain()
  check(app, "a drain closes the idle connection at once", awaitClose(app, idle))
  check(app, "and keeps the busy one", app.h.connections() === 1)
  const late = dial(app)
  app.turn()
  check(app, "a draining handler accepts no new connection", app.h.connections() === 1)
  const r: HttpServerRequest = app.held[0]
  app.heldCount = 0
  check(app, "the held request is still answered", app.h.send(r, 200, app.text, app.hello, ZERO, toI32(app.hello.length)) === HANDLER_SENT)
  check(app, "and its client reads the answer", response(app, busy, false) && bodyIs(busy, "hello"))
  check(app, "then that connection closes too", awaitClose(app, busy))
  check(app, "and none are left", app.h.connections() === 0)
  netClose(idle.fd)
  netClose(busy.fd)
  netClose(late.fd)
}

const drainingPipelined = (app: App): void => {
  const c = dial(app)
  sendText(app, c, "GET /slow HTTP/1.1\r\nHost: t\r\n\r\nGET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a held request with another pipelined behind it is taken", awaitHeld(app, toI32(1)))
  app.h.drain()
  const r: HttpServerRequest = app.held[0]
  app.heldCount = 0
  app.h.send(r, 200, app.text, app.hello, ZERO, toI32(app.hello.length))
  check(app, "a draining connection's answer says it closes", response(app, c, false) && headHas(c, "\r\nConnection: close\r\n"))
  check(app, "and the pipelined request is not read: the connection closes", awaitClose(app, c) && c.length === c.responseLength)
  check(app, "and none are left", app.h.connections() === 0)
  netClose(c.fd)
}

export const main = (): i32 => {
  const app = new App(toI32(60000), toI32(30000), toI32(64), CAP, toI32(16384))
  check(app, "the handler answers its codes as named", HANDLER_SENT === 0 && HANDLER_DROPPED < 0 && HANDLER_ABSENT < 0)
  routing(app)
  limits(app)
  screens(app)
  bodyBound(app)
  pipelining(app)
  // A peer that closes may only have half-closed and still be waiting for
  // its answer, so a held request's connection ends at the idle timeout:
  // a short one here.
  const late = new App(toI32(300), toI32(30000), toI32(2), CAP, toI32(16384))
  lateAnswer(late)
  // The body deadline against a peer the idle timeout would keep.
  const slow = new App(toI32(300), toI32(300), toI32(64), CAP, toI32(16384))
  bodyDeadline(slow)
  backpressure(app)
  flat(app)
  const drained = new App(toI32(60000), toI32(30000), toI32(64), CAP, toI32(16384))
  draining(drained)
  const drainedPipelined = new App(toI32(60000), toI32(30000), toI32(64), CAP, toI32(16384))
  drainingPipelined(drainedPipelined)
  // One pool entry, held: a second connection's request waits for it.
  const single = new App(toI32(60000), toI32(30000), toI32(1), CAP, toI32(16384))
  poolFull(single)
  const failures: i32 =
    app.failures + late.failures + slow.failures + drained.failures + drainedPipelined.failures + single.failures
  return failures === 0 ? 0 : 1
}
