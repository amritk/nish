// `nish/net/http-server`'s request lifecycle on h2c and HTTP/3
// (docs/http-one-handler.md §8.2), each row able to fail on the defect it
// names:
//   1. a held request whose client hangs up (h2c RST_STREAM or a closed
//      socket, HTTP/3 RESET_STREAM and STOP_SENDING or CONNECTION_CLOSE)
//      reads `hungUp`, `send` answers HANDLER_DROPPED (on a closed socket,
//      SENT or DROPPED: which is kernel timing), and under `requests` 1 the
//      next request is served on the entry it gave back;
//   2. eight held h2c requests with 1000-byte bodies each hold the body in a
//      buffer of at most 64 KiB, not `maxBody`, and once warm, rounds as large
//      after the first is answered do not grow the arena at all;
//   3. `drain`: a new HTTP/3 connection gets no answer, the held h2c and
//      HTTP/3 requests are answered, and each connection carries a GOAWAY;
//   4. a request with no `:authority` and `maxFields` other fields is served,
//      as is one with `:authority` and one field fewer, and one with
//      `:authority`, a `host` it replaces and one field fewer; with
//      `:authority` and `maxFields` others it is 431.
// The helpers are `net_http_server_matrix/rows.ts`'s.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { netClose } from "nish:net"
import { HANDLER_DROPPED, HANDLER_SENT } from "nish/net/handler"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { H3_FRAME_GOAWAY, Http3FrameHeader, h3ReadFrameHeader } from "nish/net/http3-frame"
import { HttpServerRequest } from "nish/net/http-server"
import { n32, n64 } from "../net_quic_frame/typed"
import { leafPrivate } from "../net_tls_common/server"
import { getOf } from "../net_http2/peer"
import { H3Limits, h3ClientParams } from "../net_http3/peer"
import { ZERO } from "../net_tls_record_common/bytes"
import { H2cClient, QuicClient, TURNS, h3Answer } from "../net_http_server_carriers/client"
import { Rig, rigLimits } from "../net_http_server_carriers/rig"
import {
  H2_CANCEL_CODE,
  H3_NO_ERROR,
  H3_REQUEST_CANCELLED,
  h2cHold,
  h2cOpen,
  h2cUntil,
  h3Fields,
  h3Unopened,
  h3Hold,
  h3Open,
  h3Request,
  padPairs
} from "../net_http_server_matrix/rows"

/** The default `maxFields`. */
const MAX_FIELDS: i32 = 100

/** Turns the rig until `r` reads `hungUp`; whether it did. */
const awaitHungUp = (rig: Rig, r: HttpServerRequest, key: Secret<u8[]>): boolean => {
  for (let turn: i32 = 0; turn < TURNS && !rig.h.hungUp(r); turn++) {
    rig.step(n32(5), key, null, null)
  }
  return rig.h.hungUp(r)
}

/** The request `/slow` holds, taken off the rig so `answerHeld` leaves it alone; null when none is held. */
const heldOne = (rig: Rig): HttpServerRequest | null => {
  if (toI32(rig.held.length) !== 1) {
    return null
  }
  const r: HttpServerRequest = rig.held[0]
  rig.held = []
  return r
}

/** After `r`'s client hung up: whether it reads `hungUp` and `send` answers HANDLER_DROPPED. */
const dropped = (t: Suite, what: string, rig: Rig, r: HttpServerRequest | null, key: Secret<u8[]>): void => {
  if (r === null) {
    t.ok(`${what}: the held request reads hungUp`, false)
    t.ok(`${what}: and send answers HANDLER_DROPPED`, false)
    return
  }
  t.ok(`${what}: the held request reads hungUp`, awaitHungUp(rig, r, key))
  t.ok(`${what}: and send answers HANDLER_DROPPED`, rig.h.send(r, 200, rig.text, rig.hello, ZERO, toI32(rig.hello.length)) === HANDLER_DROPPED)
}

/**
 * After `r`'s client closed its socket: whether it reads `hungUp` and `send`
 * ends it, SENT or DROPPED. A close reaches the server as end of input; the
 * write may still be accepted by the kernel, or refused if the close came as
 * a reset because the client left the server's bytes unread, and which one is
 * timing. Either way the entry must come back, which the next row pins.
 */
const closed = (t: Suite, what: string, rig: Rig, r: HttpServerRequest | null, key: Secret<u8[]>): void => {
  if (r === null) {
    t.ok(`${what}: the held request reads hungUp`, false)
    t.ok(`${what}: and send ends it, SENT or DROPPED`, false)
    return
  }
  t.ok(`${what}: the held request reads hungUp`, awaitHungUp(rig, r, key))
  const status: i32 = rig.h.send(r, 200, rig.text, rig.hello, ZERO, toI32(rig.hello.length))
  t.ok(`${what}: and send ends it, SENT or DROPPED`, status === HANDLER_SENT || status === HANDLER_DROPPED)
}

/** Whether HTTP/3 stream `id` of `q` has a 200 answer, turning until it ends. */
const h3Served = (q: QuicClient, key: Secret<u8[]>, id: i64): boolean => {
  q.turnUntil(key, id, false)
  return h3Answer(q.stream(id)).status === "200"
}

/** Whether `data`, a server control stream, carries a GOAWAY frame after its stream type. */
const hasGoaway = (data: u8[]): boolean => {
  const header = new Http3FrameHeader()
  // The stream type, 0x00, is one byte.
  let at: i32 = 1
  const n: i32 = toI32(data.length)
  while (at < n) {
    const size: i32 = h3ReadFrameHeader(header, data, at, n - at)
    if (size === 0) {
      return false
    }
    if (header.type === H3_FRAME_GOAWAY) {
      return true
    }
    at = at + size + toI32(header.length)
  }
  return false
}

// ---- 1: hang-ups ----------------------------------------------------------------

const hangUps = (t: Suite, key: Secret<u8[]>): void => {
  const rig = new Rig(rigLimits(n32(1)), true, n32(4))
  const none: i32[] = []
  const noValues: i64[] = []

  const c = h2cOpen(rig, none, noValues)
  c.wire.headers(n32(1), getOf("/slow"), H2_FLAG_END_STREAM)
  h2cHold(c, key, rig, n32(1))
  const reset = heldOne(rig)
  c.wire.rst(n32(1), H2_CANCEL_CODE)
  c.flush(key)
  dropped(t, "h2c RST_STREAM", rig, reset, key)
  c.wire.headers(n32(3), getOf("/hello"), H2_FLAG_END_STREAM)
  t.ok("h2c RST_STREAM: then the next request is served on the returned entry", h2cUntil(c, key, "HEADERS 3 ").indexOf("HEADERS 3 :status=200") >= 0)

  const gone = h2cOpen(rig, none, noValues)
  gone.wire.headers(n32(1), getOf("/slow"), H2_FLAG_END_STREAM)
  h2cHold(gone, key, rig, n32(1))
  const shut = heldOne(rig)
  netClose(gone.fd)
  closed(t, "h2c socket closed", rig, shut, key)
  const after = h2cOpen(rig, none, noValues)
  after.wire.headers(n32(1), getOf("/hello"), H2_FLAG_END_STREAM)
  t.ok("h2c socket closed: then a new connection's request is served on the returned entry", h2cUntil(after, key, "HEADERS 1 ").indexOf("HEADERS 1 :status=200") >= 0)

  const q = h3Open(rig, key, h3ClientParams(new H3Limits()))
  q.send(n64(0), h3Request("GET", "/slow", n32(0)), true)
  h3Hold(q, key, rig, n32(1))
  const stopped = heldOne(rig)
  q.reset(n64(0), H3_REQUEST_CANCELLED)
  q.stop(n64(0), H3_REQUEST_CANCELLED)
  dropped(t, "h3 RESET_STREAM and STOP_SENDING", rig, stopped, key)
  q.send(n64(4), h3Request("GET", "/hello", n32(0)), true)
  t.ok("h3 RESET_STREAM and STOP_SENDING: then the next request is served on the returned entry", h3Served(q, key, n64(4)))

  const leaving = h3Open(rig, key, h3ClientParams(new H3Limits()))
  leaving.send(n64(0), h3Request("GET", "/slow", n32(0)), true)
  h3Hold(leaving, key, rig, n32(1))
  const left = heldOne(rig)
  leaving.close(H3_NO_ERROR)
  dropped(t, "h3 CONNECTION_CLOSE", rig, left, key)
  const next = h3Open(rig, key, h3ClientParams(new H3Limits()))
  next.send(n64(0), h3Request("GET", "/hello", n32(0)), true)
  t.ok("h3 CONNECTION_CLOSE: then a new connection's request is served on the returned entry", h3Served(next, key, n64(0)))
}

// ---- 2: the arena under held bodies ---------------------------------------------

/** A GET of `/slow` that declares a body of `length` bytes. */
const slowWithBody = (length: i32): string[] => [":method", "GET", ":scheme", "https", ":path", "/slow", ":authority", "example.com", "content-length", `${length}`]

/** Sends two `/slow` requests with 1000-byte bodies on streams `first` and `first + 2` of each of `conns`, then turns until the rig holds all of them. */
const holdBodies = (conns: H2cClient[], first: i32, rig: Rig, key: Secret<u8[]>): boolean => {
  for (const c of conns) {
    for (let id: i32 = first; id <= first + 2; id = id + 2) {
      c.wire.headers(id, slowWithBody(n32(1000)), 0)
      c.wire.dataN(id, n32(1000), H2_FLAG_END_STREAM)
    }
    c.flush(key)
  }
  return h2cHold(conns[0], key, rig, toI32(conns.length) * 2)
}

/** Answers what the rig holds and reads each answer on `conns`, stream `last` being the latest on each. */
const answerBodies = (conns: H2cClient[], last: i32, rig: Rig, key: Secret<u8[]>): boolean => {
  rig.answerHeld()
  let all: boolean = true
  for (const c of conns) {
    all = all && h2cUntil(c, key, `HEADERS ${last} `).indexOf(`HEADERS ${last} :status=200`) >= 0
  }
  return all
}

/** Whether `held` has eight requests, each with all `length` bytes of its body in a buffer of at most 64 KiB. */
const tierSized = (held: HttpServerRequest[], length: i32): boolean => {
  let all: boolean = toI32(held.length) === n32(8)
  for (const r of held) {
    all = all && r.bodyLength === length && toI32(r.body.length) <= n32(65536)
  }
  return all
}

const arena = (t: Suite, key: Secret<u8[]>): void => {
  const rig = new Rig(rigLimits(n32(8)), false, n32(4))
  const none: i32[] = []
  const noValues: i64[] = []
  const conns: H2cClient[] = []
  let warm: boolean = true
  for (let k: i32 = 0; k < 4; k++) {
    const c = h2cOpen(rig, none, noValues)
    c.wire.headers(n32(1), getOf("/hello"), H2_FLAG_END_STREAM)
    warm = warm && h2cUntil(c, key, "HEADERS 1 ").indexOf("HEADERS 1 :status=200") >= 0
    conns.push(c)
  }
  t.ok("arena, h2c: four connections are each served once", warm)
  const held: boolean = holdBodies(conns, n32(3), rig, key)
  t.ok("arena, h2c: eight requests with 1000-byte bodies are held", held)
  // Each held request's own body buffer, not a total of arena bytes: the
  // arena counts only its newest chunk, and a buffer past 64 KiB opens a
  // chunk of its own, so eight `maxBody` buffers could read as small.
  t.ok("arena, h2c: and each holds its body in at most 64 KiB, not maxBody's 1 MiB", tierSized(rig.held, n32(1000)))
  t.ok("arena, h2c: they are answered", answerBodies(conns, n32(5), rig, key))
  let rounds: boolean = true
  let warmed: i64 = 0
  for (let round: i32 = 1; round <= 9; round++) {
    if (round === 2) {
      warmed = rig.kept
    }
    const first: i32 = n32(3) + round * n32(4)
    rounds = rounds && holdBodies(conns, first, rig, key) && answerBodies(conns, first + n32(2), rig, key)
  }
  const grown: i64 = rig.kept - warmed
  t.ok("arena, h2c: eight more rounds as large are held and answered", rounds)
  t.ok("arena, h2c: and the server keeps no more of the arena for them", grown === toI64(0))
}

// ---- 3: drain -------------------------------------------------------------------

const draining = (t: Suite, key: Secret<u8[]>): void => {
  const rig = new Rig(rigLimits(n32(16)), true, n32(4))
  const none: i32[] = []
  const noValues: i64[] = []
  const c = h2cOpen(rig, none, noValues)
  c.wire.headers(n32(1), getOf("/slow"), H2_FLAG_END_STREAM)
  const q = h3Open(rig, key, h3ClientParams(new H3Limits()))
  q.send(n64(0), h3Request("GET", "/slow", n32(0)), true)
  c.flush(key)
  t.ok("drain: an h2c and an HTTP/3 request are held", h3Hold(q, key, rig, n32(2)))
  rig.h.drain()
  const late: QuicClient = h3Unopened(rig)
  t.ok("drain: a new HTTP/3 connection's Initial gets no answer", !late.connect("h3", h3ClientParams(new H3Limits()), key))
  rig.answerHeld()
  const h2c: string = h2cUntil(c, key, "HEADERS 1 ")
  const goaway: string = h2c.indexOf("GOAWAY") >= 0 ? h2c : h2cUntil(c, key, "GOAWAY")
  t.ok("drain, h2c: the held request is answered", h2c.indexOf("HEADERS 1 :status=200") >= 0)
  t.ok("drain, h2c: and the connection carries a GOAWAY", goaway.indexOf("GOAWAY ") >= 0)
  t.ok("drain, h3: the held request is answered", h3Served(q, key, n64(0)))
  t.ok("drain, h3: and the server's control stream carries a GOAWAY", hasGoaway(q.stream(n64(3)).data))
}

// ---- 4: maxFields with and without :authority -----------------------------------

const fields = (t: Suite, key: Secret<u8[]>): void => {
  const rig = new Rig(rigLimits(n32(16)), true, n32(4))
  const none: i32[] = []
  const noValues: i64[] = []
  const c = h2cOpen(rig, none, noValues)
  c.wire.headers(n32(1), padPairs([":method", "GET", ":scheme", "https", ":path", "/hello"], MAX_FIELDS), H2_FLAG_END_STREAM)
  t.ok("maxFields, h2c: no :authority and 100 other fields is served", h2cUntil(c, key, "HEADERS 1 ").indexOf("HEADERS 1 :status=200") >= 0)
  c.wire.headers(n32(3), padPairs(getOf("/hello"), MAX_FIELDS - 1), H2_FLAG_END_STREAM)
  t.ok("maxFields, h2c: :authority and 99 others is served", h2cUntil(c, key, "HEADERS 3 ").indexOf("HEADERS 3 :status=200") >= 0)
  c.wire.headers(n32(5), padPairs(getOf("/hello"), MAX_FIELDS), H2_FLAG_END_STREAM)
  t.ok(
    "maxFields, h2c: :authority and 100 others is 431",
    h2cUntil(c, key, "HEADERS 5 ").indexOf("HEADERS 5 end :status=431") >= 0
  )
  // The `host` field gives way to `:authority`, so it takes no slot of its own.
  const withHost: string[] = getOf("/hello")
  withHost.push("host")
  withHost.push("example.com")
  c.wire.headers(n32(7), padPairs(withHost, MAX_FIELDS - 1), H2_FLAG_END_STREAM)
  t.ok("maxFields, h2c: :authority, host and 99 others is served", h2cUntil(c, key, "HEADERS 7 ").indexOf("HEADERS 7 :status=200") >= 0)

  const q = h3Open(rig, key, h3ClientParams(new H3Limits()))
  const names: string[] = [":method", ":scheme", ":path"]
  const values: string[] = ["GET", "https", "/hello"]
  for (let k: i32 = 0; k < MAX_FIELDS; k++) {
    names.push(`x-pad-${k}`)
    values.push("v")
  }
  q.send(n64(0), h3Fields(names, values), true)
  t.ok("maxFields, h3: no :authority and 100 other fields is served", h3Served(q, key, n64(0)))
  q.send(n64(4), h3Request("GET", "/hello", MAX_FIELDS - 1), true)
  t.ok("maxFields, h3: :authority and 99 others is served", h3Served(q, key, n64(4)))
  q.send(n64(8), h3Request("GET", "/hello", MAX_FIELDS), true)
  q.turnUntil(key, n64(8), false)
  t.ok("maxFields, h3: :authority and 100 others is 431", h3Answer(q.stream(n64(8))).status === "431")
}

export const main = (): i32 => {
  const t = new Suite("http server lifecycle")
  const key: Secret<u8[]> = secret(leafPrivate())
  hangUps(t, key)
  arena(t, key)
  draining(t, key)
  fields(t, key)
  wipe(key)
  return t.done()
}
