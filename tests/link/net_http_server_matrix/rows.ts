// The rows of `net_http_server_matrix`, `net_http_server_caps` and
// `net_http_server_timeouts`: `nish/net/http-server`'s answers that never reach the program, its caps,
// its timeouts and its Alt-Svc advertisement, the same on every carrier it
// serves: the scripted clients and the `Rig` of `net_http_server_carriers`,
// in one process over loopback (docs/http-one-handler.md §8.2).
//
//   1. The screen, on h2c and HTTP/3: CONNECT 501, `OPTIONS *` 204 with no
//      Allow, 431 past `maxFields`, 413 for a body past a `maxBody` that is
//      not a power of two, declared and not, then the stream reset (h2
//      RST_STREAM NO_ERROR) or its sending stopped (h3 STOP_SENDING
//      H3_NO_ERROR); none of them taken by the program.
//   2. An answer the program gives on a later turn, and one past
//      `maxResponseFields`: dropped, nothing written, the stream reset.
//   3. A response through a flow-control window of one byte.
//   4. `requests` 8: two streams per connection, the third refused; four
//      connections hold the pool and a fifth is refused. `requests` 1, 2
//      and 3: one stream per connection, the next connection refused.
//   5. `bodyTimeout` on h2c (RST_STREAM CANCEL) and HTTP/3
//      (H3_REQUEST_CANCELLED, sending stopped); `idleTimeout` over TLS.
//   6. Alt-Svc: on HTTP/1.1 and HTTP/2 over TLS (screen answers included),
//      never on h2c or HTTP/3, absent with no HTTP/3 listener, `clear` at
//      `altSvcMaxAge` 0 with and without one, `altSvcPort`'s port, and a
//      program's own value kept, once.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { netAddress, netRead, netWrite, tcpConnect } from "nish:net"
import { HANDLER_DROPPED } from "nish/net/handler"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { H3_FRAME_DATA, H3_FRAME_HEADERS, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER } from "nish/net/http3-frame"
import { QpackEncoder } from "nish/net/qpack"
import { QUIC_AEAD_AES_128_GCM, quicInitialSecrets } from "nish/net/quic-packet"
import { quicKeysOf } from "../net_quic_common/keys"
import { QuicTransportParameters, quicEncodeTransportParameters } from "nish/net/quic-conn-params"
import { n32, n64 } from "../net_quic_frame/typed"
import { leafPrivate } from "../net_tls_common/server"
import { getOf, postOf } from "../net_http2/peer"
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, H3Limits, h3Cat, h3ClientParams, h3ClientSettings, h3Frame, h3Section, h3Varint } from "../net_http3/peer"
import { CLIENT_SCID } from "../net_quic_conn/client"
import { fromHex, textOf } from "../crypto_x509/hex"
import { ZERO } from "../net_tls_record_common/bytes"
import { H2cClient, H2TlsClient, QuicClient, TURNS, h3Answer } from "../net_http_server_carriers/client"
import { RIG_ALT, Rig, rigLimits } from "../net_http_server_carriers/rig"

const H2_NO_ERROR: i32 = 0
const H2_INTERNAL_ERROR: i32 = 2
const H2_REFUSED_STREAM: i32 = 7
const H2_CANCEL_CODE: i32 = 8
const H3_NO_ERROR: i64 = 0x0100
const H3_INTERNAL_ERROR: i64 = 0x0102
const H3_REQUEST_REJECTED: i64 = 0x010b
const H3_REQUEST_CANCELLED: i64 = 0x010c

/** A `maxBody` that is not a power of two. */
export const SMALL_BODY: i32 = 1000

/** What `netRead` answers when nothing is waiting. */
const WOULD_BLOCK: i32 = -11

/** How many QUIC clients this run has made, so each gets its own original destination connection ID. */
const quicClients = new Array<i32>(1)

/** How many times `needle` occurs in `text`. */
const occurrences = (text: string, needle: string): i32 => {
  let n: i32 = 0
  let at: i32 = text.indexOf(needle)
  while (at >= 0) {
    n++
    at = text.indexOf(needle, at + toI32(needle.length))
  }
  return n
}

/** `n` request fields `x-pad-k: v`, as h2 pairs. */
const padPairs = (pairs: string[], n: i32): string[] => {
  for (let k: i32 = 0; k < n; k++) {
    pairs.push(`x-pad-${k}`)
    pairs.push("v")
  }
  return pairs
}

// ---- HTTP/1.1 -------------------------------------------------------------------

/** `GET path` over a fresh HTTP/1.1 connection to the rig with `Connection: close`; the whole response as text. */
const h1Get = (rig: Rig, key: Secret<u8[]>, method: string, path: string): string => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", rig.h2.h1Port)
  const fd: i32 = tcpConnect(addr)
  if (fd < 0) {
    return ""
  }
  const out: u8[] = []
  const request: string = `${method} ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`
  for (let k: i32 = 0; k < toI32(request.length); k++) {
    out.push(toU8(request.charCodeAt(k)))
  }
  let sent: i32 = 0
  const got: u8[] = []
  const buf: u8[] = new Array<u8>(16384)
  for (let turn: i32 = 0; turn < TURNS; turn++) {
    if (sent < toI32(out.length)) {
      const w: i32 = netWrite(fd, out, sent, toI32(out.length) - sent)
      if (w > 0) {
        sent = sent + w
      }
    }
    rig.step(n32(5), key, null, null)
    let n: i32 = netRead(fd, buf, ZERO, toI32(buf.length))
    while (n > 0) {
      for (let k: i32 = 0; k < n; k++) {
        got.push(buf[k])
      }
      n = netRead(fd, buf, ZERO, toI32(buf.length))
    }
    if (n !== WOULD_BLOCK && n <= 0) {
      break
    }
  }
  return textOf(got)
}

// ---- h2c ------------------------------------------------------------------------

/** An h2c connection to the rig with its preface, empty SETTINGS (or `ids`/`values`) and an ack queued. */
const h2cOpen = (rig: Rig, ids: i32[], values: i64[]): H2cClient => {
  const c = new H2cClient(rig)
  c.connect(rig.h2.h2cPort)
  c.wire.preface()
  c.wire.settings(ids, values)
  c.wire.settingsAck()
  return c
}

/** Flushes `c`, then turns until what it has read since holds `needle`, or the server closes; everything read. */
const h2cUntil = (c: H2cClient, key: Secret<u8[]>, needle: string): string => {
  c.flush(key)
  let acc: string = ""
  for (let turn: i32 = 0; turn < TURNS && acc.indexOf(needle) < 0 && !c.closed; turn++) {
    c.turn(key)
    acc = `${acc}; ${c.log.take()}`
  }
  return acc
}

/** Turns `c` until the rig holds `n` `/slow` requests. */
const h2cHold = (c: H2cClient, key: Secret<u8[]>, rig: Rig, n: i32): boolean => {
  c.flush(key)
  for (let turn: i32 = 0; turn < TURNS && toI32(rig.held.length) < n && !c.closed; turn++) {
    c.turn(key)
  }
  return toI32(rig.held.length) >= n
}

// ---- HTTP/3 ---------------------------------------------------------------------

/** An HTTP/3 connection to the rig with transport parameters `params`, its control and QPACK streams open. */
const h3Open = (rig: Rig, key: Secret<u8[]>, params: u8[]): QuicClient => {
  const q = new QuicClient(rig)
  quicClients[0] = quicClients[0] + 1
  const odcid: u8[] = fromHex("0001020304050600")
  odcid[7] = toU8(quicClients[0])
  q.c.odcid = odcid
  // The client derived its Initial keys from its default ODCID; this one's replace them.
  const secrets = quicInitialSecrets(odcid)
  if (secrets !== null) {
    q.c.initialWrite = quicKeysOf(QUIC_AEAD_AES_128_GCM, secrets.client)
    q.c.initialRead = quicKeysOf(QUIC_AEAD_AES_128_GCM, secrets.server)
  }
  q.connect("h3", params, key)
  q.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]), false)
  q.send(CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false)
  q.send(CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false)
  return q
}

/** The HEADERS frame of an HTTP/3 request with exactly these fields. */
const h3Fields = (names: string[], values: string[]): u8[] => h3Frame(H3_FRAME_HEADERS, h3Section(new QpackEncoder(), names, values))

/** The HEADERS frame of an HTTP/3 request of `path` by `method`, then `extra` padding fields. */
const h3Request = (method: string, path: string, extra: i32): u8[] => {
  const names: string[] = [":method", ":scheme", ":authority", ":path"]
  const values: string[] = [method, "https", "localhost", path]
  for (let k: i32 = 0; k < extra; k++) {
    names.push(`x-pad-${k}`)
    values.push("v")
  }
  return h3Fields(names, values)
}

/** Turns `q` until the rig holds `n` `/slow` requests. */
const h3Hold = (q: QuicClient, key: Secret<u8[]>, rig: Rig, n: i32): boolean => {
  for (let turn: i32 = 0; turn < TURNS && toI32(rig.held.length) < n; turn++) {
    q.pump(key)
  }
  return toI32(rig.held.length) >= n
}

/** A run of turns after the stream ended, so a STOP_SENDING sent behind it is read. */
const settle = (q: QuicClient, key: Secret<u8[]>): void => {
  for (let k: i32 = 0; k < 20; k++) {
    q.pump(key)
  }
}

/** The client's transport parameters with a receive window of one byte on each stream it opens. */
const oneByteParams = (): u8[] => {
  const p = new QuicTransportParameters()
  p.initialScid = fromHex(CLIENT_SCID)
  p.hasInitialScid = true
  p.initialMaxData = n64(67108864)
  p.initialMaxStreamDataBidiLocal = n64(1)
  p.initialMaxStreamDataBidiRemote = n64(65536)
  p.initialMaxStreamDataUni = n64(65536)
  p.initialMaxStreamsBidi = n64(0)
  p.initialMaxStreamsUni = new H3Limits().clientUniStreams
  p.activeConnectionIdLimit = n64(4)
  return quicEncodeTransportParameters(p)
}

// ---- 1, 2, 3: the screen, deferred and dropped answers, a one-byte window ---------

/** Whether stream 1's log has reached its END_STREAM, on its last byte or on an empty frame after it. */
const windowEnded = (acc: string): boolean => acc.indexOf(`DATA 1 0 "" end`) >= 0 || acc.indexOf(`DATA 1 1 "\n" end`) >= 0

export const h2cScreen = (t: Suite, rig: Rig, key: Secret<u8[]>): void => {
  const none: i32[] = []
  const noValues: i64[] = []
  const c = h2cOpen(rig, none, noValues)
  const taken: i32 = rig.taken
  c.wire.headers(n32(1), [":method", "CONNECT", ":authority", "example.com:443"], H2_FLAG_END_STREAM)
  c.wire.headers(n32(3), [":method", "OPTIONS", ":scheme", "https", ":path", "*", ":authority", "example.com"], H2_FLAG_END_STREAM)
  c.wire.headers(n32(5), padPairs(getOf("/hello"), n32(100)), H2_FLAG_END_STREAM)
  c.wire.headers(n32(7), postOf("/echo", SMALL_BODY + 1), 0)
  c.wire.headers(n32(9), [":method", "POST", ":scheme", "https", ":path", "/echo", ":authority", "example.com"], 0)
  c.wire.dataN(n32(9), SMALL_BODY + 1, 0)
  const frames: string = h2cUntil(c, key, `RST_STREAM 9 ${H2_NO_ERROR}`)
  t.ok("h2c: CONNECT is answered 501", frames.indexOf("HEADERS 1 end :status=501") >= 0)
  t.ok("h2c: OPTIONS * is answered 204, with no allow", frames.indexOf("HEADERS 3 end :status=204") >= 0 && frames.indexOf("allow=") < 0)
  t.ok("h2c: 100 fields past the pseudo-headers are answered 431", frames.indexOf("HEADERS 5 end :status=431") >= 0)
  t.ok(
    "h2c: a declared body past maxBody 1000 is answered 413, then the stream reset NO_ERROR",
    frames.indexOf("HEADERS 7 end :status=413") >= 0 && frames.indexOf(`RST_STREAM 7 ${H2_NO_ERROR}`) >= 0
  )
  t.ok(
    "h2c: an undeclared one is answered 413 when it passes it, then the stream reset NO_ERROR",
    frames.indexOf("HEADERS 9 end :status=413") >= 0 && frames.indexOf(`RST_STREAM 9 ${H2_NO_ERROR}`) >= 0
  )
  t.ok("h2c: no screen answer carries alt-svc", frames.indexOf("alt-svc") < 0)
  t.ok("h2c: the program took none of them", rig.taken === taken)
  c.wire.headers(n32(11), getOf("/defer"), H2_FLAG_END_STREAM)
  const later: string = h2cUntil(c, key, `DATA 11 0 "" end`)
  t.ok("h2c: an answer given on a later turn is sent", later.indexOf("HEADERS 11 :status=200") >= 0 && later.indexOf(`DATA 11 6 "hello\n"`) >= 0)
  rig.manyResult = 1
  c.wire.headers(n32(13), getOf("/many"), H2_FLAG_END_STREAM)
  const many: string = h2cUntil(c, key, "RST_STREAM 13 ")
  t.ok("h2c: a response past maxResponseFields is dropped", rig.manyResult === HANDLER_DROPPED)
  t.ok("h2c: nothing of it is written, and the stream is reset INTERNAL_ERROR", many.indexOf(`RST_STREAM 13 ${H2_INTERNAL_ERROR}`) >= 0 && many.indexOf("HEADERS 13") < 0)
  // A window of one byte: each DATA frame carries one, and each opens the next.
  const w = h2cOpen(rig, [n32(4)], [n64(1)])
  w.wire.headers(n32(1), getOf("/hello"), H2_FLAG_END_STREAM)
  w.flush(key)
  let acc: string = ""
  // The last byte may carry END_STREAM itself, or an empty frame may follow it.
  for (let turn: i32 = 0; turn < TURNS && !windowEnded(acc) && !w.closed; turn++) {
    w.turn(key)
    const got: string = w.log.take()
    for (let k: i32 = occurrences(got, "DATA 1 1 "); k > 0; k--) {
      w.wire.windowUpdate(n32(1), n32(1))
    }
    if (occurrences(got, "DATA 1 1 ") > 0) {
      w.flush(key)
    }
    acc = `${acc}; ${got}`
  }
  t.ok("h2c: a window of one byte carries /hello one byte per frame, to its end", occurrences(acc, "DATA 1 1 ") === 6 && windowEnded(acc))
}

export const h3Screen = (t: Suite, rig: Rig, key: Secret<u8[]>): void => {
  const q = h3Open(rig, key, h3ClientParams(new H3Limits()))
  const taken: i32 = rig.taken
  q.send(n64(0), h3Fields([":method", ":authority"], ["CONNECT", "example.com:443"]), true)
  t.ok("h3: CONNECT answered", q.turnUntil(key, n64(0), false))
  t.eqStr("h3: CONNECT is answered 501", h3Answer(q.stream(n64(0))).status, "501")
  q.send(n64(4), h3Fields([":method", ":scheme", ":authority", ":path"], ["OPTIONS", "https", "localhost", "*"]), true)
  q.turnUntil(key, n64(4), false)
  const options = h3Answer(q.stream(n64(4)))
  t.ok("h3: OPTIONS * is answered 204, with no allow", options.status === "204" && options.fields.indexOf("allow=") < 0)
  q.send(n64(8), h3Request("GET", "/hello", n32(100)), true)
  q.turnUntil(key, n64(8), false)
  t.eqStr("h3: 100 fields past the pseudo-headers are answered 431", h3Answer(q.stream(n64(8))).status, "431")
  const declared: string[] = [":method", ":scheme", ":authority", ":path", "content-length"]
  q.send(n64(12), h3Fields(declared, ["POST", "https", "localhost", "/echo", `${SMALL_BODY + 1}`]), false)
  q.turnUntil(key, n64(12), false)
  settle(q, key)
  t.ok(
    "h3: a declared body past maxBody 1000 is answered 413, its sending stopped H3_NO_ERROR",
    h3Answer(q.stream(n64(12))).status === "413" && q.stream(n64(12)).stopped === H3_NO_ERROR
  )
  q.send(n64(16), h3Cat([h3Request("POST", "/echo", n32(0)), h3Frame(H3_FRAME_DATA, new Array<u8>(SMALL_BODY + 1))]), false)
  q.turnUntil(key, n64(16), false)
  settle(q, key)
  t.ok(
    "h3: an undeclared one is answered 413 when it passes it, its sending stopped H3_NO_ERROR",
    h3Answer(q.stream(n64(16))).status === "413" && q.stream(n64(16)).stopped === H3_NO_ERROR
  )
  t.ok("h3: the program took none of them", rig.taken === taken)
  q.send(n64(20), h3Request("GET", "/defer", n32(0)), true)
  q.turnUntil(key, n64(20), false)
  const later = h3Answer(q.stream(n64(20)))
  t.eqStr("h3: an answer given on a later turn is sent", `${later.status} ${later.body}`, "200 hello\n")
  rig.manyResult = 1
  q.send(n64(24), h3Request("GET", "/many", n32(0)), true)
  q.turnUntil(key, n64(24), false)
  t.ok("h3: a response past maxResponseFields is dropped", rig.manyResult === HANDLER_DROPPED)
  t.ok(
    "h3: nothing of it is written, and the stream is reset H3_INTERNAL_ERROR",
    q.stream(n64(24)).reset === H3_INTERNAL_ERROR && toI32(q.stream(n64(24)).data.length) === 0
  )
  q.send(n64(28), h3Request("GET", "/hello", n32(0)), true)
  q.turnUntil(key, n64(28), false)
  const hello = h3Answer(q.stream(n64(28)))
  t.ok("h3: no alt-svc on an HTTP/3 response", hello.status === "200" && hello.fields.indexOf("alt-svc") < 0)
  // A window of one byte: each MAX_STREAM_DATA lets one more out.
  const w = h3Open(rig, key, oneByteParams())
  w.send(n64(0), h3Request("GET", "/hello", n32(0)), true)
  let most: i32 = 0
  let had: i32 = 0
  for (let turn: i32 = 0; turn < TURNS && !w.stream(n64(0)).fin; turn++) {
    w.pump(key)
    const now: i32 = toI32(w.stream(n64(0)).data.length)
    if (now > had) {
      most = now - had > most ? now - had : most
      had = now
      w.credit(n64(0), toI64(now + 1))
    }
  }
  const slow = h3Answer(w.stream(n64(0)))
  t.ok("h3: a window of one byte carries /hello one byte at a time, to its end", most === 1 && slow.status === "200" && slow.body === "hello\n")
}

// ---- 4: the pool and the per-connection caps --------------------------------------

/** `requests` 8, two streams per connection, on h2c and HTTP/3. */
export const caps8 = (t: Suite, key: Secret<u8[]>): void => {
  const rig = new Rig(rigLimits(n32(8)), true, n32(8))
  const none: i32[] = []
  const noValues: i64[] = []
  const a = h2cOpen(rig, none, noValues)
  a.wire.headers(n32(1), getOf("/slow"), H2_FLAG_END_STREAM)
  a.wire.headers(n32(3), getOf("/slow"), H2_FLAG_END_STREAM)
  a.wire.headers(n32(5), getOf("/slow"), H2_FLAG_END_STREAM)
  const first: string = h2cUntil(a, key, "RST_STREAM 5 ")
  t.ok("requests 8, h2c: two streams held on one connection, the third refused", toI32(rig.held.length) === 2 && first.indexOf(`RST_STREAM 5 ${H2_REFUSED_STREAM}`) >= 0)
  const b = h2cOpen(rig, none, noValues)
  b.wire.headers(n32(1), getOf("/hello"), H2_FLAG_END_STREAM)
  t.ok("a second connection's stream is served", h2cUntil(b, key, `DATA 1 0 "" end`).indexOf("HEADERS 1 :status=200") >= 0)
  b.wire.headers(n32(3), getOf("/slow"), H2_FLAG_END_STREAM)
  b.wire.headers(n32(5), getOf("/slow"), H2_FLAG_END_STREAM)
  const c = h2cOpen(rig, none, noValues)
  c.wire.headers(n32(1), getOf("/slow"), H2_FLAG_END_STREAM)
  c.wire.headers(n32(3), getOf("/slow"), H2_FLAG_END_STREAM)
  const d = h2cOpen(rig, none, noValues)
  d.wire.headers(n32(1), getOf("/slow"), H2_FLAG_END_STREAM)
  d.wire.headers(n32(3), getOf("/slow"), H2_FLAG_END_STREAM)
  b.flush(key)
  c.flush(key)
  t.ok("four connections hold two each: the pool of eight is full", h2cHold(d, key, rig, n32(8)))
  const e = h2cOpen(rig, none, noValues)
  e.wire.headers(n32(1), getOf("/slow"), H2_FLAG_END_STREAM)
  t.ok("a fifth connection's stream is refused", h2cUntil(e, key, "RST_STREAM 1 ").indexOf(`RST_STREAM 1 ${H2_REFUSED_STREAM}`) >= 0 && toI32(rig.held.length) === 8)
  t.ok("the eight held are answered", rig.answerHeld() === 8)
  const done: string = h2cUntil(a, key, `DATA 3 0 "" end`)
  t.ok("the first connection's two streams end", done.indexOf("HEADERS 1 :status=200") >= 0 && done.indexOf(`DATA 3 0 "" end`) >= 0)
  // HTTP/3: the same pool, two streams per connection.
  const q = h3Open(rig, key, h3ClientParams(new H3Limits()))
  q.send(n64(0), h3Request("GET", "/slow", n32(0)), true)
  q.send(n64(4), h3Request("GET", "/slow", n32(0)), true)
  q.send(n64(8), h3Request("GET", "/slow", n32(0)), true)
  q.turnUntil(key, n64(8), false)
  t.ok(
    "requests 8, h3: two streams held on one connection, the third H3_REQUEST_REJECTED",
    toI32(rig.held.length) === 2 && q.stream(n64(8)).reset === H3_REQUEST_REJECTED
  )
  const others: QuicClient[] = []
  for (let k: i32 = 0; k < 3; k++) {
    const o = h3Open(rig, key, h3ClientParams(new H3Limits()))
    o.send(n64(0), h3Request("GET", "/slow", n32(0)), true)
    o.send(n64(4), h3Request("GET", "/slow", n32(0)), true)
    others.push(o)
  }
  t.ok("four connections hold two each", h3Hold(q, key, rig, n32(8)))
  const fifth = h3Open(rig, key, h3ClientParams(new H3Limits()))
  fifth.send(n64(0), h3Request("GET", "/slow", n32(0)), true)
  fifth.turnUntil(key, n64(0), false)
  t.ok("a fifth connection's stream is H3_REQUEST_REJECTED", fifth.stream(n64(0)).reset === H3_REQUEST_REJECTED && toI32(rig.held.length) === 8)
  t.ok("the eight held are answered", rig.answerHeld() === 8)
  q.turnUntil(key, n64(4), false)
  others[2].turnUntil(key, n64(4), false)
  t.ok("their streams end", q.stream(n64(0)).fin && q.stream(n64(4)).fin && others[2].stream(n64(4)).fin)
}

/** `requests` n of 1, 2 or 3: one stream per connection, so n connections hold the pool and the next is refused. */
export const capsSmall = (t: Suite, key: Secret<u8[]>, n: i32): void => {
  const rig = new Rig(rigLimits(n), true, n32(4))
  const none: i32[] = []
  const noValues: i64[] = []
  const held: H2cClient[] = []
  for (let k: i32 = 0; k < n; k++) {
    const c = h2cOpen(rig, none, noValues)
    c.wire.headers(n32(1), getOf("/slow"), H2_FLAG_END_STREAM)
    c.wire.headers(n32(3), getOf("/slow"), H2_FLAG_END_STREAM)
    c.flush(key)
    held.push(c)
  }
  t.ok(`requests ${n}, h2c: ${n} connections hold one each`, h2cHold(held[n - 1], key, rig, n))
  const second: string = h2cUntil(held[0], key, "RST_STREAM 3 ")
  t.ok(`requests ${n}, h2c: a connection's second stream is refused`, second.indexOf(`RST_STREAM 3 ${H2_REFUSED_STREAM}`) >= 0)
  const next = h2cOpen(rig, none, noValues)
  next.wire.headers(n32(1), getOf("/slow"), H2_FLAG_END_STREAM)
  t.ok(`requests ${n}, h2c: the next connection's stream is refused`, h2cUntil(next, key, "RST_STREAM 1 ").indexOf(`RST_STREAM 1 ${H2_REFUSED_STREAM}`) >= 0)
  rig.answerHeld()
  h2cUntil(held[0], key, `DATA 1 0 "" end`)
  const quic: QuicClient[] = []
  for (let k: i32 = 0; k < n; k++) {
    const q = h3Open(rig, key, h3ClientParams(new H3Limits()))
    q.send(n64(0), h3Request("GET", "/slow", n32(0)), true)
    quic.push(q)
  }
  t.ok(`requests ${n}, h3: ${n} connections hold one each`, h3Hold(quic[n - 1], key, rig, n))
  const last = h3Open(rig, key, h3ClientParams(new H3Limits()))
  last.send(n64(0), h3Request("GET", "/slow", n32(0)), true)
  last.turnUntil(key, n64(0), false)
  t.ok(`requests ${n}, h3: the next connection's stream is H3_REQUEST_REJECTED`, last.stream(n64(0)).reset === H3_REQUEST_REJECTED)
  rig.answerHeld()
  quic[0].turnUntil(key, n64(0), false)
  t.ok(`requests ${n}, h3: the held streams end once answered`, quic[0].stream(n64(0)).fin)
}

// ---- 5: timeouts ---------------------------------------------------------------

export const timeouts = (t: Suite, key: Secret<u8[]>): void => {
  const limits = rigLimits(n32(16))
  limits.bodyTimeout = 300
  limits.idleTimeout = 300
  const rig = new Rig(limits, true, n32(4))
  const none: i32[] = []
  const noValues: i64[] = []
  const c = h2cOpen(rig, none, noValues)
  c.wire.headers(n32(1), postOf("/echo", n32(5)), 0)
  t.ok("bodyTimeout, h2c: a body that never comes has its stream reset CANCEL", h2cUntil(c, key, "RST_STREAM 1 ").indexOf(`RST_STREAM 1 ${H2_CANCEL_CODE}`) >= 0)
  const q = h3Open(rig, key, h3ClientParams(new H3Limits()))
  const declared: string[] = [":method", ":scheme", ":authority", ":path", "content-length"]
  q.send(n64(0), h3Fields(declared, ["POST", "https", "localhost", "/echo", "5"]), false)
  q.turnUntil(key, n64(0), false)
  settle(q, key)
  t.ok(
    "bodyTimeout, h3: its stream is reset H3_REQUEST_CANCELLED and its sending stopped",
    q.stream(n64(0)).reset === H3_REQUEST_CANCELLED && q.stream(n64(0)).stopped === H3_REQUEST_CANCELLED
  )
  const h2 = new H2TlsClient(rig)
  h2.handshake(rig.h2.port, key)
  h2.wire.preface()
  h2.wire.settings(none, noValues)
  h2.flush(key, null, null)
  for (let k: i32 = 0; k < 8 && !h2.closed; k++) {
    h2.awaitFrames(n32(1000), key, null, null)
  }
  t.ok("idleTimeout, HTTP/2 over TLS: a connection with no stream is closed", h2.closed)
}

// ---- 6: Alt-Svc -----------------------------------------------------------------

/** Whether `response`'s head has the field `name: value`, and how many `name` fields it has. */
const fieldCount = (response: string, name: string): i32 => occurrences(response, `\r\n${name}: `)

export const altSvc = (t: Suite, rig: Rig, key: Secret<u8[]>): void => {
  const ours: string = `alt-svc: h3=":${rig.quicPort}"; ma=86400\r\n`
  const hello: string = h1Get(rig, key, "GET", "/hello")
  t.ok("HTTP/1.1 with an HTTP/3 listener: alt-svc names its port", hello.indexOf("HTTP/1.1 200") === 0 && hello.indexOf(ours) >= 0)
  const options: string = h1Get(rig, key, "OPTIONS", "*")
  t.ok("HTTP/1.1: OPTIONS * is answered 204 with alt-svc and no allow", options.indexOf("HTTP/1.1 204") === 0 && options.indexOf(ours) >= 0 && options.indexOf("\r\nallow:") < 0)
  const alt: string = h1Get(rig, key, "GET", "/alt")
  t.ok("HTTP/1.1: a program's own alt-svc is kept, once", fieldCount(alt, "alt-svc") === 1 && alt.indexOf(`alt-svc: ${RIG_ALT}\r\n`) >= 0)
  const h2 = new H2TlsClient(rig)
  h2.handshake(rig.h2.port, key)
  const none: i32[] = []
  const noValues: i64[] = []
  h2.wire.preface()
  h2.wire.settings(none, noValues)
  h2.wire.settingsAck()
  h2.wire.headers(n32(1), [":method", "OPTIONS", ":scheme", "https", ":path", "*", ":authority", "example.com"], H2_FLAG_END_STREAM)
  h2.wire.headers(n32(3), getOf("/alt"), H2_FLAG_END_STREAM)
  h2.flush(key, null, null)
  let frames: string = ""
  for (let k: i32 = 0; k < 8 && frames.indexOf(`DATA 3 0 "" end`) < 0 && !h2.closed; k++) {
    frames = `${frames}; ${h2.awaitFrames(n32(1), key, null, null)}`
  }
  const screened: string = frames.substring(frames.indexOf("HEADERS 1 "), frames.indexOf("HEADERS 3 "))
  t.ok("HTTP/2 over TLS: a screen answer carries alt-svc", screened.indexOf(":status=204 ") >= 0 && screened.indexOf(` alt-svc=h3=":${rig.quicPort}"; ma=86400`) >= 0)
  t.ok("HTTP/2 over TLS: a program's own alt-svc is kept, once", occurrences(frames, "alt-svc=") === 2 && frames.indexOf(`alt-svc=${RIG_ALT}`) >= 0)
  const plain = new Rig(rigLimits(n32(16)), false, n32(4))
  t.ok("HTTP/1.1 with no HTTP/3 listener: no alt-svc", fieldCount(h1Get(plain, key, "GET", "/hello"), "alt-svc") === 0)
  const clearLimits = rigLimits(n32(16))
  clearLimits.altSvcMaxAge = 0
  const clearPlain = new Rig(clearLimits, false, n32(4))
  t.ok("altSvcMaxAge 0 with no HTTP/3 listener: alt-svc: clear", h1Get(clearPlain, key, "GET", "/hello").indexOf("\r\nalt-svc: clear\r\n") >= 0)
  const clearSigned = new Rig(clearLimits, true, n32(4))
  t.ok("altSvcMaxAge 0 with one: alt-svc: clear", h1Get(clearSigned, key, "GET", "/hello").indexOf("\r\nalt-svc: clear\r\n") >= 0)
  const portLimits = rigLimits(n32(16))
  portLimits.altSvcPort = 4433
  const ported = new Rig(portLimits, true, n32(4))
  t.ok("altSvcPort: alt-svc names it, not the socket's", h1Get(ported, key, "GET", "/hello").indexOf(`\r\nalt-svc: h3=":4433"; ma=86400\r\n`) >= 0)
}
