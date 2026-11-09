// The TechEmpower entry's async handler (bench/techempower/async-server.ts)
// under `serveOn`, against the rules tests/link/tfb_entry holds the explicit
// entry to, over loopback, with a Nish client as a task in the same process:
//
//   1. /json: 200, the exact body, `application/json`, `Content-Length` equal
//      to the body, `Server` present, `Date` an IMF-fixdate.
//   2. /plaintext: the same rules, `text/plain`, `Hello, World!`.
//   3. A burst of 16 pipelined /plaintext requests, sent in one write, is
//      answered in order: 16 whole responses and nothing more. A /json and
//      /plaintext mix of 16 keeps its order, and so does a burst of 1000,
//      whose answers are twice what the server's output holds.
//   4. Any other path answers 404 with the same fields; a malformed request
//      answers 400 and closes that connection, and the server goes on serving
//      a new one.
//   5. A warmed connection serves 200 requests, /json and /plaintext in turn,
//      and the server's `Arena.used()` does not move over them.
//   6. A pool asked for 0 slots has one, and answers on it.
//
// Every request is counted in `ANSWERED`, so `serveOn` stops once the client
// is done; the 400 counts with the rest.
import { readable, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { ServeLimits, ServeStats, serveOn } from "nish/net/serve"
import { Suite } from "nish/testing"
import { tfbHandle, tfbLimits, tfbRouter } from "../../../bench/techempower/async-server"
import { Conn, dial, hangUp, headerOf, sendText } from "../net_serve/client"

const JSON_BODY: string = '{"message":"Hello, World!"}'
const PLAIN: string = "Hello, World!"
/** The answers the first server sends: 2, 16, 16, 1000, the 404, the 400, one after it, and 200 warmed. */
const ANSWERED: i32 = 1236
/** The answers after which the server's arena is read warm: all but the 200 warmed requests. */
const WARM: i32 = 1036

const DAYS: string = "Mon Tue Wed Thu Fri Sat Sun "
const MONTHS: string = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec "

/** True when `name` is one of the three-letter names `list` holds, each followed by a space. */
const named = (list: string, name: string): boolean => {
  const at: i32 = toI32(list.indexOf(`${name} `))
  return toI32(name.length) === 3 && at >= 0 && at % 4 === 0
}

/** The decimal number `s` spells, or -1. */
const decimal = (s: string): i32 => {
  if (s.length === 0 || s.length > 9) {
    return -1
  }
  let n: i32 = 0
  for (let k: i32 = 0; k < toI32(s.length); k++) {
    const digit: i32 = toI32(s.charCodeAt(k)) - 48
    if (digit < 0 || digit > 9) {
      return -1
    }
    n = n * 10 + digit
  }
  return n
}

/** True when `s` is an IMF-fixdate (RFC 9110 §5.6.7): `Sun, 06 Nov 1994 08:49:37 GMT`. */
const imfFixdate = (s: string): boolean => {
  if (toI32(s.length) !== 29 || !named(DAYS, s.substring(0, 3)) || !named(MONTHS, s.substring(8, 11))) {
    return false
  }
  const day: i32 = decimal(s.substring(5, 7))
  const hour: i32 = decimal(s.substring(17, 19))
  const minute: i32 = decimal(s.substring(20, 22))
  const second: i32 = decimal(s.substring(23, 25))
  return (
    s.substring(3, 5) === ", " &&
    s.substring(7, 8) === " " &&
    s.substring(11, 12) === " " &&
    decimal(s.substring(12, 16)) >= 0 &&
    s.substring(16, 17) === " " &&
    s.substring(19, 20) === ":" &&
    s.substring(22, 23) === ":" &&
    s.substring(25, 29) === " GMT" &&
    day >= 1 &&
    day <= 31 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 60
  )
}

/** One response as the client reads it: the status, the head with its fields, the body. */
class Answer {
  status: i32 = 0
  head: string = ""
  body: string = ""
  /** The `Content-Length` field, or -1 when there is none. */
  length: i32 = -1

  /** The value of the field `name`, given in lowercase, or empty. */
  field(name: string): string {
    return headerOf(this.head, name)
  }

  /** How many fields are named `name`, given in lowercase. */
  count(name: string): i32 {
    let n: i32 = 0
    let at: i32 = toI32(this.head.indexOf("\r\n"))
    while (at >= 0) {
      const from: i32 = at + 2
      let same: boolean = toI32(this.head.length) > from + toI32(name.length)
      for (let k: i32 = 0; same && k < toI32(name.length); k++) {
        let ch: i32 = toI32(this.head.charCodeAt(from + k))
        if (ch >= 65 && ch <= 90) {
          ch = ch + 32
        }
        same = ch === toI32(name.charCodeAt(k))
      }
      if (same && this.head.charCodeAt(from + toI32(name.length)) === 58) {
        n = n + 1
      }
      at = toI32(this.head.indexOf("\r\n", from))
    }
    return n
  }
}

/** Reads more bytes, compacting first; false once the peer has closed. */
const moreBytes = async (c: Conn): Promise<boolean> => {
  if (c.start > 0) {
    for (let i: i32 = c.start; i < c.end; i++) {
      c.buf[i - c.start] = c.buf[i]
    }
    c.end -= c.start
    c.start = 0
  }
  while (true) {
    const n: i32 = netRead(c.fd, c.buf, c.end, toI32(c.buf.length) - c.end)
    if (n === -11) {
      await readable(c.fd)
      continue
    }
    if (n <= 0) {
      c.closed = true
      return false
    }
    c.end += n
    return true
  }
}

/** Where the head at the start of the unread bytes ends, past its blank line; -1 while it has not. */
const answerHeadEnd = (c: Conn): i32 => {
  for (let i: i32 = c.start; i + 3 < c.end; i++) {
    if (c.buf[i] === 13 && c.buf[i + 1] === 10 && c.buf[i + 2] === 13 && c.buf[i + 3] === 10) {
      return i + 4
    }
  }
  return -1
}

/** The next whole response on `c`; status 0 when the peer closed first. */
const answer = async (c: Conn): Promise<Answer> => {
  const a: Answer = new Answer()
  let end: i32 = answerHeadEnd(c)
  while (end < 0) {
    const got: boolean = await moreBytes(c)
    if (!got) {
      return a
    }
    end = answerHeadEnd(c)
  }
  a.head = String.fromBytes(c.buf, c.start, end)
  if (!a.head.startsWith("HTTP/1.1 ") || a.head.length < 12) {
    return a
  }
  const length: string = a.field("content-length")
  a.length = length === "" ? -1 : decimal(length)
  const want: i32 = a.length < 0 ? 0 : a.length
  while (c.end - end < want) {
    const at: i32 = end - c.start
    const got: boolean = await moreBytes(c)
    if (!got) {
      return a
    }
    end = c.start + at
  }
  a.body = String.fromBytes(c.buf, end, end + want)
  a.status = decimal(a.head.substring(9, 12))
  c.start = end + want
  return a
}

/** Whether no byte waits on `c` past the answers already read: a read that would block. */
const quiet = (c: Conn): boolean => {
  if (c.end > c.start) {
    return false
  }
  const n: i32 = netRead(c.fd, c.buf, c.end, toI32(c.buf.length) - c.end)
  return n === -11
}

const get = (path: string): string => `GET ${path} HTTP/1.1\r\nHost: tfb\r\n\r\n`

/** `n` pipelined requests as one string: every `every`th for `rare`, the rest for `common`. */
const burst = (n: i32, every: i32, rare: string, common: string): string => {
  let out: string = ""
  for (let k: i32 = 0; k < n; k++) {
    out = out + get(k % every === every - 1 ? rare : common)
  }
  return out
}

/** Every rule the verifier applies to one answer, as checks named after `what`. */
const verify = (t: Suite, what: string, a: Answer, body: string, type: string): void => {
  t.eqI32(`${what}: status 200`, a.status, toI32(200))
  t.eqStr(`${what}: the body, byte for byte`, a.body, body)
  t.eqStr(`${what}: Content-Type`, a.field("content-type"), type)
  t.eqI32(`${what}: Content-Length is the body's length`, a.length, toI32(body.length))
  t.eqI32(`${what}: one Content-Length`, a.count("content-length"), toI32(1))
  t.eqStr(`${what}: Server is nish, as main.ts sends it`, a.field("server"), "nish")
  t.ok(`${what}: Date is an IMF-fixdate`, imfFixdate(a.field("date")))
}

/** How many of the answers to `burst(n, every, rare, common)` are 200 with the body asked for, read in order. */
const inOrder = async (c: Conn, n: i32, every: i32, rare: string, common: string): Promise<i32> => {
  let good: i32 = 0
  for (let k: i32 = 0; k < n; k++) {
    const a: Answer = await answer(c)
    const want: string = k % every === every - 1 ? rare : common
    if (a.status === 200 && a.body === want && a.length === toI32(want.length) && imfFixdate(a.field("date"))) {
      good = good + 1
    }
  }
  return good
}

/** Ends a client's suite and writes its exit status, 0 or 1, as one byte on `doneFd`. */
const report = (t: Suite, doneFd: i32): void => {
  const code: u8[] = [toU8(t.done())]
  netWrite(doneFd, code, 0, 1)
}

/** The client: every check against the first server, in a suite of its own, since a task keeps nothing outside its region. */
const client = async (port: i32, doneFd: i32): Promise<void> => {
  const t = new Suite("tfb async entry: client")
  const c: Conn = new Conn(65536)
  const dialed: boolean = await dial(c, port)
  t.ok("the client connects", dialed)

  // --- 1 and 2. One of each ---------------------------------------------------------------------
  await sendText(c, get("/json"))
  const json: Answer = await answer(c)
  verify(t, "/json", json, JSON_BODY, "application/json")
  await sendText(c, get("/plaintext"))
  const plain: Answer = await answer(c)
  verify(t, "/plaintext", plain, PLAIN, "text/plain")

  // --- 3. Pipelined bursts ----------------------------------------------------------------------
  await sendText(c, burst(16, 1, "/plaintext", "/plaintext"))
  const sixteen: i32 = await inOrder(c, 16, 1, PLAIN, PLAIN)
  t.eqI32("16 pipelined requests in one write are answered by 16 whole responses", sixteen, toI32(16))
  t.ok("and nothing more follows them", quiet(c))
  await sendText(c, burst(16, 3, "/json", "/plaintext"))
  const mixed: i32 = await inOrder(c, 16, 3, JSON_BODY, PLAIN)
  t.eqI32("a pipelined mix of /json and /plaintext is answered in the order asked", mixed, toI32(16))
  await sendText(c, burst(1000, 4, "/plaintext", "/json"))
  const thousand: i32 = await inOrder(c, 1000, 4, PLAIN, JSON_BODY)
  t.eqI32("1000 pipelined requests, past what the output holds, are answered whole and in order", thousand, toI32(1000))
  t.ok("and nothing more follows the 1000", quiet(c))

  // --- 4. 404, then a malformed request ---------------------------------------------------------
  await sendText(c, get("/nothing"))
  const missing: Answer = await answer(c)
  t.eqI32("another path answers 404", missing.status, toI32(404))
  t.eqStr("with the body `not found`, the 404 body main.ts sends", missing.body, "not found")
  t.ok("with Server nish and an IMF-fixdate Date", missing.field("server") === "nish" && imfFixdate(missing.field("date")))
  t.eqI32("and a Content-Length equal to its body", missing.length, toI32(missing.body.length))
  await sendText(c, "GET /json HTTP/1.1\r\nHost tfb\r\n\r\n")
  const malformed: Answer = await answer(c)
  t.eqI32("a header line with no colon answers 400", malformed.status, toI32(400))
  const after: Answer = await answer(c)
  t.ok("and the server closes that connection", after.status === 0 && c.closed)
  hangUp(c)
  const d: Conn = new Conn(65536)
  const redialed: boolean = await dial(d, port)
  t.ok("a new connection after the 400 connects", redialed)
  await sendText(d, get("/plaintext"))
  const fresh: Answer = await answer(d)
  verify(t, "a new connection after the 400", fresh, PLAIN, "text/plain")

  // --- 5. 200 warmed requests -------------------------------------------------------------------
  let served: i32 = 0
  for (let k: i32 = 0; k < 200; k++) {
    const path: string = k % 2 === 0 ? "/json" : "/plaintext"
    await sendText(d, get(path))
    const a: Answer = await answer(d)
    if (a.status === 200 && a.body === (k % 2 === 0 ? JSON_BODY : PLAIN)) {
      served = served + 1
    }
  }
  t.eqI32("a warmed connection answers 200 requests", served, toI32(200))
  hangUp(d)
  report(t, doneFd)
}

/** One /json request to a server whose pool was asked for 0 slots, in a suite of its own. */
const oneSlotClient = async (port: i32, doneFd: i32): Promise<void> => {
  const t = new Suite("tfb async entry: 0-slot client")
  const c: Conn = new Conn(4096)
  const dialed: boolean = await dial(c, port)
  t.ok("the 0-slot pool's client connects", dialed)
  await sendText(c, get("/json"))
  const json: Answer = await answer(c)
  verify(t, "a pool asked for 0 slots", json, JSON_BODY, "application/json")
  hangUp(c)
  report(t, doneFd)
}

/** The client's exit status, read from `fds[0]`, after which both ends are closed; -1 when none came. */
const joined = async (fds: i32[]): Promise<i32> => {
  await readable(fds[0])
  const got: u8[] = [0]
  const n: i32 = netRead(fds[0], got, 0, 1)
  netClose(fds[0])
  netClose(fds[1])
  return n === 1 ? toI32(got[0]) : -1
}

export const main = async (): Promise<i32> => {
  const t = new Suite("tfb async entry")
  t.ok("the date check takes RFC 9110's example", imfFixdate("Sun, 06 Nov 1994 08:49:37 GMT"))
  t.ok("and refuses the obsolete RFC 850 form", !imfFixdate("Sunday, 06-Nov-94 08:49:37 GMT"))

  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const limits: ServeLimits = tfbLimits(8)
  limits.maxRequests = ANSWERED
  const stats: ServeStats = new ServeStats()
  stats.warmAfter = WARM
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  spawn(client(netLocalPort(listener), fds[1]))
  const stopped: i32 = await serveOn(listener, tfbRouter(), limits, tfbHandle, stats)
  t.eqI32("serveOn stops once the client's requests are answered", stopped, toI32(0))
  const clientCode: i32 = await joined(fds)
  t.eqI32("every client check passed", clientCode, toI32(0))
  netClose(listener)
  t.eqI32("the server answered each request once", stats.answered, ANSWERED)
  t.eqI32("and none of them failed or was turned away", stats.failed + stats.busy, toI32(0))
  t.ok("the server's arena did not move over the 200 warmed requests", stats.usedWarm !== 0 && stats.usedEnd === stats.usedWarm)

  // --- 6. A pool of 0 slots is a pool of one ----------------------------------------------------
  const zero: ServeLimits = tfbLimits(0)
  t.eqI32("a pool asked for 0 slots has one connection", zero.connections, toI32(1))
  t.eqI32("and one request in flight", zero.inFlight, toI32(1))
  zero.maxRequests = 1
  const single: i32 = tcpListen("127.0.0.1", 0, 16)
  const oneFds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, oneFds)
  spawn(oneSlotClient(netLocalPort(single), oneFds[1]))
  const singleStopped: i32 = await serveOn(single, tfbRouter(), zero, tfbHandle, new ServeStats())
  t.eqI32("the 0-slot server stops after its one answer", singleStopped, toI32(0))
  const oneCode: i32 = await joined(oneFds)
  t.eqI32("every 0-slot client check passed", oneCode, toI32(0))
  netClose(single)
  return t.done()
}
