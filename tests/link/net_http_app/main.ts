// `examples/http-app` over loopback: its `App`, routes and configuration,
// driven by a Nish client in the same loop as the handler.
//
//   1. Configuration: a port and the flags are read; a missing port and a
//      flag without its number are usage errors.
//   2. The API: health, create (201), list, show, delete (204), a full store
//      (507), a body without "text" (400), an unknown id (404), and 404 and
//      405 problems from the router.
//   3. The stop: a drain closes the idle client and the handler holds no
//      connection.
import { copyBytes } from "nish/bytes"
import { HandlerLimits, HttpHandler } from "nish/net/handler"
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
import { monotonicNanos } from "nish:process"
import { App, appRoutes, configure, serveTurn } from "../../../examples/http-app/app"

const NONE: i32 = 0
const ONE_MS: i32 = 1
const FIVE_SECONDS: i64 = 5000000000

/** The client's socket and what it has read; `failures` counts the checks that failed. */
class Client {
  buf: u8[]
  /** The last response's head and body, as text. */
  head: string = ""
  body: string = ""
  fd: i32 = -1
  length: i32 = 0
  /** The last response's status. */
  status: i32 = 0
  failures: i32 = 0
  closed: boolean = false

  constructor() {
    this.buf = new Array<u8>(65536)
  }
}

const textBytes = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(text.length)
  for (let k: i32 = 0; k < toI32(text.length) && k < toI32(out.length); k++) {
    out[k] = toU8(text.charCodeAt(k))
  }
  return out
}

const connect = (port: i32): Client => {
  const c = new Client()
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  c.fd = tcpConnect(addr)
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(2)
  pollAdd(loop, c.fd, 2, NONE)
  if (pollWait(loop, ready, 5000) !== 1 || connectResult(c.fd) !== 0) {
    panic("connect failed")
  }
  pollRemove(loop, c.fd)
  netClose(loop)
  return c
}

/** Reads what has arrived, noting the peer's close. */
const pull = (c: Client): void => {
  const room: i32 = toI32(c.buf.length) - c.length
  if (room > 0) {
    const n: i32 = netRead(c.fd, c.buf, c.length, room)
    if (n > 0) {
      c.length += n
    } else if (n === 0) {
      c.closed = true
    }
  }
}

/** Where `text`, which is lower case, first appears in `c.buf[0 .. c.length)` in any case, or -1. */
const find = (c: Client, text: string): i32 => {
  const n: i32 = toI32(text.length)
  for (let at: i32 = 0; at + n <= c.length; at++) {
    let k: i32 = 0
    while (k < n && at + k < toI32(c.buf.length) && (toI32(c.buf[at + k]) | 32) === (toI32(text.charCodeAt(k)) | 32)) {
      k++
    }
    if (k === n) {
      return at
    }
  }
  return -1
}

/** The decimal at `c.buf[at ..)`. */
const numberAt = (c: Client, at: i32): i32 => {
  let value: i32 = 0
  let k: i32 = at
  while (k >= 0 && k < c.length && k < toI32(c.buf.length) && c.buf[k] >= 48 && c.buf[k] <= 57) {
    value = value * 10 + (toI32(c.buf[k]) - 48)
    k++
  }
  return value
}

/** Sends `request`, then turns the app until one whole response is read into `c`. */
const exchange = (app: App, c: Client, request: string): boolean => {
  const bytes: u8[] = textBytes(request)
  let sent: i32 = 0
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (monotonicNanos() < deadline && !c.closed) {
    if (sent < toI32(bytes.length)) {
      const n: i32 = netWrite(c.fd, bytes, sent, toI32(bytes.length) - sent)
      if (n > 0) {
        sent += n
      }
    }
    serveTurn(app, ONE_MS)
    pull(c)
    const headEnd: i32 = find(c, "\r\n\r\n")
    if (headEnd > 0) {
      const lengthAt: i32 = find(c, "content-length: ")
      const length: i32 = lengthAt >= 0 && lengthAt < headEnd ? numberAt(c, lengthAt + 16) : 0
      const end: i32 = headEnd + 4 + length
      if (c.length >= end) {
        c.status = numberAt(c, toI32(9))
        c.head = String.fromBytes(c.buf, NONE, headEnd)
        c.body = String.fromBytes(c.buf, headEnd + 4, end)
        copyBytes(c.buf, NONE, c.buf, end, c.length - end)
        c.length -= end
        return true
      }
    }
  }
  return false
}

const post = (body: string): string =>
  `POST /notes HTTP/1.1\r\nHost: t\r\nContent-Length: ${body.length}\r\n\r\n${body}`

const check = (c: Client, name: string, ok: boolean): void => {
  if (ok) {
    console.log(`PASS  ${name}`)
  } else {
    console.log(`FAIL  ${name}`)
    c.failures += 1
  }
}

export const main = (): i32 => {
  const tally = new Client()
  const good = configure(["http-app", "8080", "--max-notes", "2", "--drain-ms", "50", "--quiet"])
  check(tally, "a port and the flags are read", good.error === "" && good.port === 8080 && good.maxNotes === 2 && good.drainMs === 50 && good.quiet)
  check(tally, "a missing port is a usage error", configure(["http-app", "--quiet"]).error === "a port is required")
  check(tally, "a flag without its number is a usage error", configure(["http-app", "80", "--max-notes"]).error === "--max-notes takes a number")
  check(tally, "a port out of range is refused", configure(["http-app", "70000"]).error !== "")

  const listener: i32 = tcpListen("127.0.0.1", NONE, 64)
  const h = new HttpHandler(new HandlerLimits(), listener, appRoutes())
  const app = new App(h, good)
  const c = connect(netLocalPort(listener))
  c.failures = tally.failures

  check(c, "health answers ok with no notes", exchange(app, c, "GET /health HTTP/1.1\r\nHost: t\r\n\r\n") && c.status === 200 && c.body === "{\"status\":\"ok\",\"notes\":0}")
  check(c, "a note is created", exchange(app, c, post("{\"text\":\"milk\"}")) && c.status === 201 && c.body === "{\"id\":1,\"text\":\"milk\"}")
  check(c, "a second one takes the next id", exchange(app, c, post("{\"text\":\"eggs\"}")) && c.body === "{\"id\":2,\"text\":\"eggs\"}")
  check(c, "a third is past --max-notes: 507", exchange(app, c, post("{\"text\":\"tea\"}")) && c.status === 507)
  check(c, "a body without text is 400", exchange(app, c, post("[1,2]")) && c.status === 400)
  check(c, "as application/problem+json", c.head.indexOf("content-type: application/problem+json") >= 0)
  check(c, "the list holds both, in order", exchange(app, c, "GET /notes HTTP/1.1\r\nHost: t\r\n\r\n") && c.body === "[{\"id\":1,\"text\":\"milk\"},{\"id\":2,\"text\":\"eggs\"}]")
  check(c, "a note is shown by id", exchange(app, c, "GET /notes/2 HTTP/1.1\r\nHost: t\r\n\r\n") && c.status === 200 && c.body === "{\"id\":2,\"text\":\"eggs\"}")
  check(c, "and deleted with 204", exchange(app, c, "DELETE /notes/1 HTTP/1.1\r\nHost: t\r\n\r\n") && c.status === 204)
  check(c, "then it is gone: 404", exchange(app, c, "GET /notes/1 HTTP/1.1\r\nHost: t\r\n\r\n") && c.status === 404)
  check(c, "an id that is not a number is 404", exchange(app, c, "DELETE /notes/x HTTP/1.1\r\nHost: t\r\n\r\n") && c.status === 404)
  check(c, "an unknown path is 404", exchange(app, c, "GET /nowhere HTTP/1.1\r\nHost: t\r\n\r\n") && c.status === 404)
  check(c, "a method the path does not take is 405 with its Allow", exchange(app, c, "PUT /notes HTTP/1.1\r\nHost: t\r\nContent-Length: 0\r\n\r\n") && c.status === 405 && c.head.indexOf("allow: GET, POST") >= 0)

  h.drain()
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (!c.closed && monotonicNanos() < deadline) {
    serveTurn(app, ONE_MS)
    pull(c)
  }
  check(c, "a drain closes the idle client", c.closed)
  check(c, "and the handler holds no connection", h.connections() === 0)
  netClose(c.fd)
  netClose(listener)
  return c.failures === 0 ? 0 : 1
}
