// `HttpServer.streamBody` over HTTP/2 over TLS and h2c, and its absence on
// HTTP/1.1, in one process over loopback: the clients of `client.ts`
// against the `StreamRig` of `rig.ts`, whose `maxBody` is 1000 bytes.
//
//   1. A body of 300000 bytes on `/upload`, sent no faster than the window
//      the server gives: read in pieces, never more than one stream window
//      held and the body array never longer, and answered with its length;
//      then 800000 more on a second stream of the same connection, past
//      the connection's window of 1048576, which only arrival credits.
//   2. A body ended by a trailer section rather than END_STREAM on DATA.
//   3. A peer that ignores the window on `/lazy`, which never consumes:
//      RST_STREAM FLOW_CONTROL_ERROR, and the request comes back hung up.
//   4. RST_STREAM CANCEL part way through a body: the request comes back
//      hung up and an answer to it is dropped.
//   5. The connection lost part way through a body: the same.
//   5a. An answer still flushing when more body queues its request again:
//      the request stays out of `take`.
//   6. `/early` answered before its body ends: the response, then
//      RST_STREAM NO_ERROR for the rest.
//   7. `/echo`, not marked, keeps the whole body: answered with it, and a
//      declared length past `maxBody` is still 413.
//   8. HTTP/1.1 ignores the mark: `/upload` gets its whole body at once, and
//      a body past `maxBody` is 413.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { H2_CANCEL, H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { HANDLER_DROPPED, HANDLER_SENT } from "nish/net/handler"
import { HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { leafPrivate } from "../net_tls_common/server"
import { postOf } from "../net_http2/peer"
import { ZERO } from "../net_tls_record_common/bytes"
import { PIECE, StreamClient, TURNS, h1Post } from "./client"
import { STREAM_MAX_BODY, StreamRig } from "./rig"

/** The window a stream opens with, and so the most a streamed request may hold. */
const WINDOW: i32 = 65535

/** A connected client of `rig`; `name` says which carrier in each check. */
const connected = (t: Suite, rig: StreamRig, key: Secret<u8[]>, tls: boolean, name: string, what: string): StreamClient => {
  const c = new StreamClient(rig, tls)
  t.ok(`${name}: ${what}: connected${tls ? ", the server's signature and Finished verified" : ""}`, c.connect(key) && (!tls || c.verified))
  return c
}

/** Turns `rig` until the program has taken more than `hung` hung-up requests; whether it has. */
const awaitHung = (rig: StreamRig, key: Secret<u8[]>, hung: i32): boolean => {
  for (let turn: i32 = 0; turn < TURNS && rig.hung <= hung; turn++) {
    rig.step(toI32(5), key)
  }
  return rig.hung > hung
}

/** Turns `rig` until the program has first taken more than `seen` requests; whether it has. */
const awaitFirst = (rig: StreamRig, key: Secret<u8[]>, seen: i32): boolean => {
  for (let turn: i32 = 0; turn < TURNS && toI32(rig.firsts.length) <= seen; turn++) {
    rig.step(toI32(5), key)
  }
  return toI32(rig.firsts.length) > seen
}

/** Turns `rig` until the server holds no connection; whether it got there. */
const awaitClosed = (rig: StreamRig, key: Secret<u8[]>): boolean => {
  for (let turn: i32 = 0; turn < TURNS && rig.h.connections() > 0; turn++) {
    rig.step(toI32(5), key)
  }
  return rig.h.connections() === 0
}

/** What the program's answer to the last hung-up request returned; 1 when there was none. */
const lastHung = (rig: StreamRig): i32 => {
  const n: i32 = toI32(rig.hungResults.length)
  return n > 0 ? rig.hungResults[n - 1] : toI32(1)
}

/** Cases 1 to 7 on one carrier. */
const carrier = (t: Suite, rig: StreamRig, key: Secret<u8[]>, tls: boolean): void => {
  const name: string = tls ? "HTTP/2 over TLS" : "h2c"
  const total: i32 = 300000

  rig.maxHeld = 0
  rig.maxArray = 0
  rig.total = 0
  // Each carrier's checks read only the requests it sent.
  rig.firsts = []
  const up = connected(t, rig, key, tls, name, "a long upload")
  up.open(toI32(1), "/upload", total, key)
  t.ok(`${name}: 300000 bytes sent within the window the server gave`, up.body(toI32(1), total, true, key))
  t.ok(`${name}: answered with the length read`, up.awaitFrame(`DATA 1 6 "${total}"`, key))
  t.ok(`${name}: the request was first taken streaming, its body not ended`, rig.firsts.join("; ").indexOf("0 true/false") >= 0)
  t.ok(`${name}: never more than one stream window held`, rig.maxHeld > 0 && rig.maxHeld <= WINDOW)
  t.ok(`${name}: the body array never longer than the window`, rig.maxArray > 0 && rig.maxArray <= WINDOW)
  t.ok(`${name}: the stream window credited as the program consumed`, up.text().indexOf("WINDOW_UPDATE 1 ") >= 0)
  up.open(toI32(3), "/upload", toI32(800000), key)
  t.ok(`${name}: 800000 more on the connection, past its window`, up.body(toI32(3), toI32(800000), true, key))
  t.ok(`${name}: the connection window credited as streamed bodies arrived`, up.awaitFrame(`DATA 3 6 "800000"`, key))
  up.close()

  const trailed = connected(t, rig, key, tls, name, "a body ended by trailers")
  trailed.open(toI32(1), "/upload", toI32(20000), key)
  t.ok(`${name}: 20000 bytes sent, END_STREAM left to the trailers`, trailed.body(toI32(1), toI32(20000), false, key))
  trailed.trailers(toI32(1), key)
  t.ok(`${name}: the trailers end the body`, trailed.awaitFrame(`DATA 1 5 "20000"`, key))
  trailed.close()

  let hung: i32 = rig.hung
  const greedy = connected(t, rig, key, tls, name, "a peer that ignores the window")
  const seen: i32 = toI32(rig.firsts.length)
  greedy.open(toI32(1), "/lazy", toI32(100000), key)
  greedy.wire.dataN(toI32(1), PIECE, ZERO)
  greedy.flush(key)
  t.ok(`${name}: /lazy taken streaming`, awaitFirst(rig, key, seen) && rig.firsts[seen].indexOf("1 true/false") === 0)
  for (let sent: i32 = PIECE; sent < WINDOW; sent = sent + PIECE) {
    const n: i32 = WINDOW - sent < PIECE ? WINDOW - sent : PIECE
    greedy.wire.dataN(toI32(1), n, ZERO)
    greedy.flush(key)
  }
  greedy.wire.dataN(toI32(1), toI32(1), ZERO)
  greedy.flush(key)
  t.ok(`${name}: one byte past the window resets the stream FLOW_CONTROL_ERROR`, greedy.awaitFrame("RST_STREAM 1 3", key))
  t.ok(`${name}: the unconsumed request comes back hung up`, awaitHung(rig, key, hung))
  t.ok(`${name}: the unconsumed request's answer is dropped`, lastHung(rig) === HANDLER_DROPPED)
  t.ok(`${name}: no WINDOW_UPDATE for a stream nothing consumed`, greedy.text().indexOf("WINDOW_UPDATE 1 ") < 0)
  greedy.close()

  hung = rig.hung
  const cancel = connected(t, rig, key, tls, name, "RST_STREAM mid-body")
  const cancelSeen: i32 = toI32(rig.firsts.length)
  cancel.open(toI32(1), "/upload", toI32(100000), key)
  cancel.wire.dataN(toI32(1), PIECE, ZERO)
  cancel.flush(key)
  t.ok(`${name}: the body to cancel taken streaming`, awaitFirst(rig, key, cancelSeen))
  cancel.wire.rst(toI32(1), H2_CANCEL)
  cancel.flush(key)
  t.ok(`${name}: a cancelled body comes back hung up`, awaitHung(rig, key, hung))
  t.ok(`${name}: the cancelled request's answer is dropped`, lastHung(rig) === HANDLER_DROPPED)
  cancel.close()

  hung = rig.hung
  const lost = connected(t, rig, key, tls, name, "the connection lost mid-body")
  const lostSeen: i32 = toI32(rig.firsts.length)
  lost.open(toI32(1), "/upload", toI32(100000), key)
  lost.wire.dataN(toI32(1), PIECE, ZERO)
  lost.flush(key)
  t.ok(`${name}: the body to lose taken streaming`, awaitFirst(rig, key, lostSeen))
  lost.close()
  t.ok(`${name}: a body whose connection closed comes back hung up`, awaitHung(rig, key, hung))
  t.ok(`${name}: the lost request's answer is dropped`, lastHung(rig) === HANDLER_DROPPED)
  t.ok(`${name}: and the connection it was on closes`, awaitClosed(rig, key))

  // An answer that outlasts the client's window while more body queues its request again.
  const stuck = connected(t, rig, key, tls, name, "an answer still flushing")
  const stuckSeen: i32 = toI32(rig.firsts.length)
  stuck.open(toI32(1), "/lazy", toI32(100000), key)
  stuck.wire.dataN(toI32(1), PIECE, ZERO)
  stuck.flush(key)
  t.ok(`${name}: the body to answer taken streaming`, awaitFirst(rig, key, stuckSeen))
  const held: HttpServerRequest = rig.reading[toI32(rig.reading.length) - 1]
  stuck.wire.dataN(toI32(1), PIECE, ZERO)
  stuck.flush(key)
  let queued: boolean = false
  for (let turn: i32 = 0; turn < TURNS && !queued; turn++) {
    rig.h.waitSigned(toI32(5), key)
    queued = rig.h.ready()
  }
  t.ok(`${name}: more body queues the held request again`, queued)
  rig.forget(held)
  const big: u8[] = new Array<u8>(100000)
  const sent: i32 = rig.h.send(held, 200, rig.text, big, ZERO, toI32(100000))
  t.ok(`${name}: answered past the client's window, still flushing`, sent === HANDLER_SENT && rig.h.pending(held) > 0)
  t.ok(`${name}: a request answered since it was queued again stays out of take`, !rig.h.ready())
  stuck.close()
  t.ok(`${name}: and its connection closes`, awaitClosed(rig, key))

  const early = connected(t, rig, key, tls, name, "an answer before the body ends")
  early.open(toI32(1), "/early", toI32(100000), key)
  early.wire.dataN(toI32(1), PIECE, ZERO)
  early.flush(key)
  t.ok(`${name}: the answer goes out with the body unfinished`, early.awaitFrame(`DATA 1 5 "early"`, key))
  t.ok(`${name}: then RST_STREAM NO_ERROR for the rest`, early.awaitFrame("RST_STREAM 1 0", key))
  early.close()

  const whole = connected(t, rig, key, tls, name, "a route not marked")
  whole.wire.headers(toI32(1), postOf("/echo", toI32(5)), ZERO)
  whole.wire.data(toI32(1), "hello", H2_FLAG_END_STREAM)
  whole.flush(key)
  t.ok(`${name}: /echo answered with its whole body`, whole.awaitFrame(`DATA 1 1 "5"`, key))
  t.ok(`${name}: and taken whole`, rig.firsts.join("; ").indexOf("3 false/true") >= 0)
  whole.open(toI32(3), "/echo", STREAM_MAX_BODY + 1, key)
  t.ok(`${name}: a declared length past maxBody is still 413`, whole.awaitFrame(":status=413", key))
  whole.close()
}

export const main = (): i32 => {
  const t = new Suite("http server stream")
  const key: Secret<u8[]> = secret(leafPrivate())
  const limits = new HttpServerLimits()
  limits.maxBody = STREAM_MAX_BODY
  const rig = new StreamRig(limits, toI32(4))
  t.ok("the server listens: HTTP/1.1, h2c and HTTP/2 over TLS", rig.h1Port > 0 && rig.h2cPort > 0 && rig.tlsPort > 0)
  carrier(t, rig, key, false)
  carrier(t, rig, key, true)

  const answered: i32 = toI32(rig.answers.length)
  t.eqStr("HTTP/1.1: /upload answered", h1Post(rig, key, "/upload", toI32(500)), "HTTP/1.1 200 OK")
  t.ok("HTTP/1.1: with the whole body", toI32(rig.answers.length) > answered && rig.answers[toI32(rig.answers.length) - 1] === "0 500")
  t.ok("HTTP/1.1: taken whole, not streaming", rig.firsts.join("; ").indexOf("0 false/true") >= 0)
  t.ok("HTTP/1.1: a body past maxBody is 413 on a marked route", h1Post(rig, key, "/upload", STREAM_MAX_BODY + 1).indexOf("413") >= 0)
  wipe(key)
  return t.done()
}
