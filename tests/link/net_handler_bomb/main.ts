// `nish/net/handler` decodes a `gzip` or `deflate` request body under
// `HandlerLimits.maxDecoded` before the program takes it, over loopback.
//
//   - A gzip, x-gzip or deflate body reaches the program decoded, with
//     `decodedFrom` naming its coding.
//   - A body of exactly `maxDecoded` bytes decoded is taken; one byte more is
//     answered 413 by the handler, and so is a bomb, 4 MiB of zeros in about
//     4 KiB, under a 64 KiB cap: the program never takes either, and the
//     connection serves the next request.
//   - A gzip body whose CRC is wrong, and a zlib body cut short, are answered 400.
//   - An unknown coding, or two stacked, reach the program as they arrived.
//   - Bombs sent over a warm connection leave `Arena.used()` flat.
import { DEFLATE_DEFAULT, compressBound } from "nish/compress/deflate"
import { gzipCompress } from "nish/compress/gzip"
import { zlibCompress } from "nish/compress/zlib"
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { HTTP_CODING_DEFLATE, HTTP_CODING_GZIP, HTTP_CODING_IDENTITY } from "nish/net/http-compress"
import { Router, RouterLimits } from "nish/net/router"
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
import { Suite } from "nish/testing"
import { ascii, join, ZERO } from "../net_tls_record_common/bytes"

const FIVE_SECONDS: i64 = 5000000000
/** The decoded-body cap the server runs with. */
const CAP: i32 = 65536
/** What the bomb inflates to: 64 times the cap. */
const BOMB: i32 = 4194304

/** The server half: a handler with one route that answers how long the body was. */
class App {
  h: HttpHandler
  port: i32 = 0
  text: u8[]
  ok: u8[]
  /** How many requests the program has taken. */
  taken: i32 = 0
  /** The last request's decoded length, its coding, and its body's first byte. */
  length: i32 = -1
  coding: i32 = -9
  first: i32 = -1

  constructor() {
    const router = new Router(new RouterLimits())
    router.add("POST", "/")
    const limits = new HandlerLimits()
    limits.slots = 4
    limits.maxDecoded = CAP
    const listener: i32 = tcpListen("127.0.0.1", 0, 16)
    this.port = netLocalPort(listener)
    this.h = new HttpHandler(limits, listener, router)
    this.text = ascii("text/plain")
    this.ok = ascii("ok")
  }

  turn(): void {
    this.h.wait(toI32(1))
    while (this.h.ready()) {
      const req: HttpRequest = this.h.take()
      this.taken += 1
      this.length = req.bodyLength
      this.coding = req.decodedFrom
      this.first = req.bodyLength > 0 ? toI32(req.body[0]) : -1
      this.h.send(req, 200, this.text, this.ok, ZERO, toI32(this.ok.length))
    }
  }
}

class Client {
  fd: i32 = -1
  buf: u8[]
  length: i32 = 0
  status: i32 = 0
  responseLength: i32 = 0
  closed: boolean = false

  constructor() {
    this.buf = new Array<u8>(65536)
  }
}

const startsWith = (buf: u8[], at: i32, end: i32, text: string): boolean => {
  const n: i32 = toI32(text.length)
  if (at < 0 || at + n > end || end > toI32(buf.length)) {
    return false
  }
  for (let k: i32 = 0; k < n; k++) {
    if (toI32(buf[at + k]) !== toI32(text.charCodeAt(k))) {
      return false
    }
  }
  return true
}

const find = (buf: u8[], from: i32, end: i32, text: string): i32 => {
  for (let at: i32 = from; at + toI32(text.length) <= end; at++) {
    if (startsWith(buf, at, end, text)) {
      return at
    }
  }
  return -1
}

const headerNumber = (buf: u8[], headEnd: i32, name: string): i32 => {
  const at: i32 = find(buf, ZERO, headEnd, name)
  if (at < 0) {
    return -1
  }
  let n: i32 = 0
  let k: i32 = at + toI32(name.length)
  while (k >= 0 && k < headEnd && k < toI32(buf.length) && toI32(buf[k]) >= 48 && toI32(buf[k]) <= 57) {
    n = n * 10 + toI32(buf[k]) - 48
    k += 1
  }
  return n
}

const connect = (app: App): Client => {
  const c = new Client()
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", app.port)
  c.fd = tcpConnect(addr)
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(2)
  pollAdd(loop, c.fd, 2, ZERO)
  if (pollWait(loop, ready, 5000) !== 1 || connectResult(c.fd) !== 0) {
    panic("connect failed")
  }
  pollRemove(loop, c.fd)
  netClose(loop)
  return c
}

const sendAll = (app: App, c: Client, bytes: u8[]): void => {
  let at: i32 = 0
  const len: i32 = toI32(bytes.length)
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (at < len && monotonicNanos() < deadline) {
    const n: i32 = netWrite(c.fd, bytes, at, len - at)
    if (n > 0) {
      at += n
    } else {
      app.turn()
    }
  }
}

/** Reads one response with a `content-length`: true with its status in `c`. */
const response = (app: App, c: Client): boolean => {
  const used: i32 = c.responseLength
  if (used > 0) {
    for (let k: i32 = 0; k < c.length - used; k++) {
      c.buf[k] = c.buf[used + k]
    }
    c.length -= used
    c.responseLength = 0
  }
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (monotonicNanos() < deadline) {
    const headEnd: i32 = find(c.buf, ZERO, c.length, "\r\n\r\n")
    if (headEnd > 0) {
      c.status = headerNumber(c.buf, headEnd, "HTTP/1.1 ")
      const bodyStart: i32 = headEnd + 4
      const length: i32 = headerNumber(c.buf, headEnd, "\r\nContent-Length: ")
      if (length >= 0 && c.length - bodyStart >= length) {
        c.responseLength = bodyStart + length
        return true
      }
    }
    if (c.closed) {
      return false
    }
    app.turn()
    const room: i32 = toI32(c.buf.length) - c.length
    const n: i32 = room > 0 ? netRead(c.fd, c.buf, c.length, room) : -1
    if (n > 0) {
      c.length += n
    } else if (n === 0) {
      c.closed = true
    }
  }
  return false
}

/** The request `POST /` with `body` and, when not empty, `Content-Encoding: coding`. */
const post = (coding: string, body: u8[]): u8[] => {
  const field: string = coding.length > 0 ? `Content-Encoding: ${coding}\r\n` : ""
  return join([ascii(`POST / HTTP/1.1\r\nHost: t\r\n${field}Content-Length: ${body.length}\r\n\r\n`), body])
}

/** Sends `post(coding, body)` and reads the answer: its status, or -1 for none. */
const ask = (app: App, c: Client, coding: string, body: u8[]): i32 => {
  sendAll(app, c, post(coding, body))
  return response(app, c) ? c.status : -1
}

/** `n` bytes of `value`. */
const bytesOf = (n: i32, value: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  for (let k: i32 = 0; k < n; k++) {
    out[k] = toU8(value)
  }
  return out
}

/** `data` as one gzip member. */
const gzipped = (data: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(compressBound(toI32(data.length)))
  const end: i32 = gzipCompress(data, ZERO, toI32(data.length), out, ZERO, DEFLATE_DEFAULT)
  return out.slice(0, end)
}

/** `data` as one zlib stream. */
const zlibbed = (data: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(compressBound(toI32(data.length)))
  const end: i32 = zlibCompress(data, ZERO, toI32(data.length), out, ZERO, DEFLATE_DEFAULT)
  return out.slice(0, end)
}

export const main = (): i32 => {
  const t = new Suite("handler bomb limit")
  const app = new App()
  const c = connect(app)
  const hello: u8[] = ascii("hello, hello, hello, hello")

  t.eqI32("a gzip body is taken", ask(app, c, "gzip", gzipped(hello)), toI32(200))
  t.eqI32("decoded", app.length, toI32(hello.length))
  t.ok("with decodedFrom gzip and the data's first byte", app.coding === HTTP_CODING_GZIP && app.first === 104)
  t.eqI32("an x-gzip body in capitals is taken", ask(app, c, " X-GZIP ", gzipped(hello)), toI32(200))
  t.ok("decoded as gzip", app.length === toI32(hello.length) && app.coding === HTTP_CODING_GZIP)
  t.eqI32("a deflate body is taken", ask(app, c, "deflate", zlibbed(hello)), toI32(200))
  t.ok("decoded from the zlib format", app.length === toI32(hello.length) && app.coding === HTTP_CODING_DEFLATE)
  t.eqI32("a plain body is taken", ask(app, c, "", hello), toI32(200))
  t.ok("as it arrived", app.length === toI32(hello.length) && app.coding === HTTP_CODING_IDENTITY)

  t.eqI32("a body decoding to exactly the cap is taken", ask(app, c, "gzip", gzipped(bytesOf(CAP, 7))), toI32(200))
  t.ok("whole", app.length === CAP && app.first === 7)
  let taken: i32 = app.taken
  t.eqI32("one byte past the cap is answered 413", ask(app, c, "gzip", gzipped(bytesOf(CAP + 1, 7))), toI32(413))
  t.eqI32("and the program never takes it", app.taken, taken)

  const bomb: u8[] = gzipped(bytesOf(BOMB, 0))
  t.ok("the bomb is a thousandth of what it inflates to", toI32(bomb.length) * 1000 < BOMB)
  t.eqI32("the gzip bomb is answered 413", ask(app, c, "gzip", bomb), toI32(413))
  t.eqI32("untaken", app.taken, taken)
  t.ok("on a connection that stays open", !c.closed)
  t.eqI32("a deflate bomb is answered 413", ask(app, c, "deflate", zlibbed(bytesOf(BOMB, 0))), toI32(413))
  t.eqI32("the connection serves the next request", ask(app, c, "", hello), toI32(200))
  t.eqI32("which the program takes", app.taken, taken + 1)

  taken = app.taken
  const badCrc: u8[] = gzipped(hello)
  badCrc[toI32(badCrc.length) - 8] = toU8(toI32(badCrc[toI32(badCrc.length) - 8]) ^ 1)
  t.eqI32("a gzip body with a wrong CRC is answered 400", ask(app, c, "gzip", badCrc), toI32(400))
  const cut: u8[] = zlibbed(hello)
  t.eqI32("a zlib body cut short is answered 400", ask(app, c, "deflate", cut.slice(0, toI32(cut.length) - 3)), toI32(400))
  t.eqI32("a plain body sent as gzip is answered 400", ask(app, c, "gzip", hello), toI32(400))
  t.eqI32("none of them taken", app.taken, taken)

  t.eqI32("an unknown coding is taken", ask(app, c, "br", hello), toI32(200))
  t.ok("as it arrived", app.length === toI32(hello.length) && app.coding === HTTP_CODING_IDENTITY)
  const twice: u8[] = gzipped(gzipped(hello))
  t.eqI32("two codings in one field are taken", ask(app, c, "gzip, gzip", twice), toI32(200))
  t.ok("as they arrived", app.length === toI32(twice.length) && app.coding === HTTP_CODING_IDENTITY)
  const split: u8[] = join([
    ascii(`POST / HTTP/1.1\r\nHost: t\r\nContent-Encoding: gzip\r\nContent-Encoding: gzip\r\nContent-Length: ${twice.length}\r\n\r\n`),
    twice,
  ])
  sendAll(app, c, split)
  t.ok("two codings in two fields are taken", response(app, c) && c.status === 200)
  t.ok("as they arrived", app.length === toI32(twice.length) && app.coding === HTTP_CODING_IDENTITY)

  // Bombs and decoded bodies over a warm connection leave the arena flat.
  const request: u8[] = post("gzip", gzipped(hello))
  const bombRequest: u8[] = post("gzip", bomb)
  let good: i32 = 0
  let before: i64 = 0
  for (let round: i32 = 0; round < 40; round++) {
    sendAll(app, c, request)
    good += response(app, c) && c.status === 200 ? 1 : 0
    sendAll(app, c, bombRequest)
    good += response(app, c) && c.status === 413 ? 1 : 0
    if (round === 9) {
      before = Arena.used()
    }
  }
  const kept: i64 = Arena.used() - before
  t.eqI32("a warm connection answers forty bodies and forty bombs", good, toI32(80))
  t.eqI64("and the arena stays flat", kept, toI64(0))
  netClose(c.fd)
  return t.done()
}
