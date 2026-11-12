// `nish/net/http-server` over HTTP/2 over TLS, h2c and HTTP/3, in one process
// over loopback: the scripted clients of `tests/link/net_interop_server`
// against one `HttpServer` holding all three listeners, so the program of
// `rig.ts` answers each carrier through the same calls.
//
//   1. HTTP/2 over TLS: a text route, a parameter as JSON, a body echoed, a
//      404 as problem+json, and `alt-svc` naming the HTTP/3 port on each.
//   2. h2c: the same requests, answered alike, with no `alt-svc`.
//   3. HTTP/3: the same requests, answered alike, with no `alt-svc`.
//   4. A stream reset while its response waits for flow-control window: the
//      request goes back to the pool, so a server whose pool holds one
//      request answers the next stream rather than refusing it.
//   5. `altSvcMaxAge` 0: `alt-svc: clear` over TLS, still none over h2c; an
//      h2c connection silent before its preface is closed by
//      `prefaceTimeout`, and one silent after it by `idleTimeout`.
//   6. A server with no TLS or QUIC listener turns by `wait`, no key lent.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { H2_CANCEL, H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { H3_FRAME_DATA, H3_FRAME_HEADERS, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER } from "nish/net/http3-frame"
import { QpackEncoder } from "nish/net/qpack"
import { n32, n64 } from "../net_quic_frame/typed"
import { leafPrivate } from "../net_tls_common/server"
import { Wire, getOf, postOf } from "../net_http2/peer"
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, H3Limits, h3Cat, h3ClientParams, h3ClientSettings, h3Frame, h3Section, h3Varint } from "../net_http3/peer"
import { H2cClient, H2TlsClient, QuicClient, TURNS, h3Answer } from "./client"
import { Rig, rigLimits } from "./rig"

/** The HEADERS frame of an HTTP/3 request with these pseudo-headers, then `names`/`values`. */
const request = (method: string, path: string, names: string[], values: string[]): u8[] => {
  const allNames: string[] = [":method", ":scheme", ":authority", ":path"]
  const allValues: string[] = [method, "https", "localhost", path]
  for (let k: i32 = 0; k < toI32(names.length) && k < toI32(values.length); k++) {
    allNames.push(names[k])
    allValues.push(values[k])
  }
  return h3Frame(H3_FRAME_HEADERS, h3Section(new QpackEncoder(), allNames, allValues))
}

/** HTTP/2 over TLS, one request per stream. */
const h2Checks = (t: Suite, rig: Rig, key: Secret<u8[]>): void => {
  const h2 = new H2TlsClient(rig)
  t.ok("HTTP/2: a TLS handshake offering h2, the server's signature and Finished verified", h2.handshake(rig.h2.port, key) && h2.verified)
  const none: i32[] = []
  const noValues: i64[] = []
  h2.wire.preface()
  h2.wire.settings(none, noValues)
  h2.wire.settingsAck()
  h2.wire.headers(n32(1), getOf("/hello"), H2_FLAG_END_STREAM)
  h2.wire.headers(n32(3), getOf("/users/42"), H2_FLAG_END_STREAM)
  h2.wire.headers(n32(5), postOf("/echo", n32(5)), 0)
  h2.wire.data(n32(5), "hello", H2_FLAG_END_STREAM)
  h2.wire.headers(n32(7), getOf("/missing"), H2_FLAG_END_STREAM)
  h2.flush(key, null, null)
  // SETTINGS, WINDOW_UPDATE and the ack, then HEADERS and two DATA frames
  // (the body, and the empty one `end` sends) on each of the four streams.
  const frames: string = h2.awaitFrames(n32(15), key, null, null)
  const alt: string = `alt-svc=h3=":${rig.quicPort}"; ma=86400`
  t.ok("a GET of /hello: 200 and its body", frames.indexOf("HEADERS 1 :status=200 ") >= 0 && frames.indexOf(`DATA 1 6 "hello\n"`) >= 0)
  t.ok("with alt-svc naming the HTTP/3 port, and its content-length", frames.indexOf(`content-type=text/plain ${alt} content-length=6;`) >= 0)
  t.ok("a GET of /users/42: the parameter as JSON", frames.indexOf(`content-type=application/json ${alt} content-length=9;`) >= 0 && frames.indexOf(`DATA 3 9 "{"id":42}"`) >= 0)
  t.ok("a POST of /echo: its body echoed", frames.indexOf("HEADERS 5 :status=200 ") >= 0 && frames.indexOf(`DATA 5 5 "hello"`) >= 0)
  t.ok("a GET of a path no route has: 404 as problem+json", frames.indexOf("HEADERS 7 :status=404 ") >= 0 && frames.indexOf(`content-type=application/problem+json ${alt} content-length=55;`) >= 0 && frames.indexOf("DATA 7 55;") >= 0)
  t.ok("every stream ended", frames.indexOf(`DATA 1 0 "" end`) >= 0 && frames.indexOf(`DATA 3 0 "" end`) >= 0 && frames.indexOf(`DATA 5 0 "" end`) >= 0 && frames.indexOf(`DATA 7 0 "" end`) >= 0)
}

/** The four requests of `h2Checks`, on streams 1, 3, 5 and 7 of `wire`, after the preface and SETTINGS. */
const fourRequests = (wire: Wire): void => {
  const none: i32[] = []
  const noValues: i64[] = []
  wire.preface()
  wire.settings(none, noValues)
  wire.settingsAck()
  wire.headers(n32(1), getOf("/hello"), H2_FLAG_END_STREAM)
  wire.headers(n32(3), getOf("/users/42"), H2_FLAG_END_STREAM)
  wire.headers(n32(5), postOf("/echo", n32(5)), 0)
  wire.data(n32(5), "hello", H2_FLAG_END_STREAM)
  wire.headers(n32(7), getOf("/missing"), H2_FLAG_END_STREAM)
}

/** h2c, prior knowledge: `h2Checks`'s requests, answered alike, with no `alt-svc`. */
const h2cChecks = (t: Suite, rig: Rig, key: Secret<u8[]>): void => {
  const c = new H2cClient(rig)
  t.ok("h2c: a connection to the cleartext listener", c.connect(rig.h2.h2cPort))
  fourRequests(c.wire)
  c.flush(key)
  const frames: string = c.awaitFrames(n32(15), key)
  t.ok("a GET of /hello: 200, its body, its content-length and no alt-svc", frames.indexOf("HEADERS 1 :status=200 ") >= 0 && frames.indexOf("content-type=text/plain content-length=6;") >= 0 && frames.indexOf(`DATA 1 6 "hello\n"`) >= 0)
  t.ok("a GET of /users/42: the parameter as JSON", frames.indexOf("content-type=application/json content-length=9;") >= 0 && frames.indexOf(`DATA 3 9 "{"id":42}"`) >= 0)
  t.ok("a POST of /echo: its body echoed", frames.indexOf("HEADERS 5 :status=200 ") >= 0 && frames.indexOf(`DATA 5 5 "hello"`) >= 0)
  t.ok("a GET of a path no route has: 404 as problem+json", frames.indexOf("HEADERS 7 :status=404 ") >= 0 && frames.indexOf("content-type=application/problem+json content-length=55;") >= 0 && frames.indexOf("DATA 7 55;") >= 0)
  t.ok("every stream ended, and no alt-svc on any", frames.indexOf(`DATA 7 0 "" end`) >= 0 && frames.indexOf("alt-svc") < 0)
}

/** `altSvcMaxAge` 0, and the two timeouts of an h2c connection. */
const clearChecks = (t: Suite, key: Secret<u8[]>): void => {
  const limits = rigLimits(n32(16))
  limits.altSvcMaxAge = 0
  limits.prefaceTimeout = 300
  limits.idleTimeout = 300
  const rig = new Rig(limits, true, toI32(4))
  const h2 = new H2TlsClient(rig)
  t.ok("altSvcMaxAge 0: the TLS handshake", h2.handshake(rig.h2.port, key) && h2.verified)
  fourRequests(h2.wire)
  h2.flush(key, null, null)
  t.ok("HTTP/2 over TLS says alt-svc: clear", h2.awaitFrames(n32(15), key, null, null).indexOf("content-type=text/plain alt-svc=clear content-length=6;") >= 0)
  const c = new H2cClient(rig)
  c.connect(rig.h2.h2cPort)
  fourRequests(c.wire)
  c.flush(key)
  const frames: string = c.awaitFrames(n32(15), key)
  t.ok("h2c says nothing of alt-svc", frames.indexOf("content-type=text/plain content-length=6;") >= 0 && frames.indexOf("alt-svc") < 0)
  const silent = new H2cClient(rig)
  silent.connect(rig.h2.h2cPort)
  t.ok("an h2c connection that never sends its preface is closed by prefaceTimeout", silent.awaitClose(TURNS, key))
  const idle = new H2cClient(rig)
  idle.connect(rig.h2.h2cPort)
  const none: i32[] = []
  const noValues: i64[] = []
  idle.wire.preface()
  idle.wire.settings(none, noValues)
  idle.flush(key)
  t.ok("one silent after its preface is closed by idleTimeout", idle.awaitClose(TURNS, key) && idle.log.take().indexOf("SETTINGS") >= 0)
}

/** A server with no TLS or QUIC listener needs no key: its loop turns by `wait`. */
const waitChecks = (t: Suite, key: Secret<u8[]>): void => {
  const rig = new Rig(rigLimits(n32(16)), false, toI32(4))
  const c = new H2cClient(rig)
  t.ok("no TLS listener: an h2c connection", c.connect(rig.h2.h2cPort))
  fourRequests(c.wire)
  c.flush(key)
  const frames: string = c.awaitFrames(n32(15), key)
  t.ok("wait serves it: /hello answered and every stream ended", frames.indexOf(`DATA 1 6 "hello\n"`) >= 0 && frames.indexOf(`DATA 7 0 "" end`) >= 0)
}

/** A reset of a stream still flushing its response hands its request back. */
const h2ResetFlushing = (t: Suite, key: Secret<u8[]>): void => {
  const rig = new Rig(rigLimits(n32(1)), true, toI32(4))
  const h2 = new H2TlsClient(rig)
  t.ok("a server with a pool of one: the TLS handshake", h2.handshake(rig.h2.port, key) && h2.verified)
  const none: i32[] = []
  const noValues: i64[] = []
  h2.wire.preface()
  h2.wire.settings(none, noValues)
  h2.wire.settingsAck()
  h2.wire.headers(n32(1), getOf("/big"), H2_FLAG_END_STREAM)
  h2.flush(key, null, null)
  // SETTINGS, WINDOW_UPDATE and the ack, then HEADERS and the first of the
  // 65535 bytes the stream's window lets out.
  const first: string = h2.awaitFrames(n32(5), key, null, null)
  t.ok("a GET of /big: 200, and the body waits for window", first.indexOf("HEADERS 1 :status=200 ") >= 0 && first.indexOf("DATA 1 ") >= 0 && first.indexOf(" end") < 0)
  h2.wire.rst(n32(1), H2_CANCEL)
  // /big spent the connection's window too: open it for stream 3's body.
  h2.wire.windowUpdate(n32(0), n32(65535))
  h2.wire.headers(n32(3), getOf("/hello"), H2_FLAG_END_STREAM)
  h2.flush(key, null, null)
  // The rest of the window's DATA may still come first: read until stream 3 ends.
  let next: string = ""
  for (let round: i32 = 0; round < 8 && next.indexOf(`DATA 3 0 "" end`) < 0 && !h2.closed; round++) {
    next = `${next}; ${h2.awaitFrames(n32(1), key, null, null)}`
  }
  t.ok("the reset handed the request back: the next stream is answered, not refused", next.indexOf("HEADERS 3 :status=200 ") >= 0 && next.indexOf(`DATA 3 0 "" end`) >= 0 && next.indexOf("RST_STREAM 3") < 0)
}

/** HTTP/3, one request per stream. */
const h3Checks = (t: Suite, rig: Rig, key: Secret<u8[]>): void => {
  const h3 = new QuicClient(rig)
  t.ok("HTTP/3: the handshake through the listener into a slot, ALPN h3", h3.connect("h3", h3ClientParams(new H3Limits()), key))
  h3.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]), false)
  h3.send(CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false)
  h3.send(CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false)
  const noNames: string[] = []
  h3.send(n64(0), request("GET", "/hello", noNames, noNames), true)
  t.ok("a GET of /hello answered and ended", h3.turnUntil(key, n64(0), false))
  const hello = h3Answer(h3.stream(n64(0)))
  t.eqStr("200 hello", `${hello.status} ${hello.body}`, "200 hello\n")
  h3.send(n64(4), request("GET", "/users/42", noNames, noNames), true)
  t.ok("a GET of /users/42 answered and ended", h3.turnUntil(key, n64(4), false))
  const user = h3Answer(h3.stream(n64(4)))
  t.eqStr("200 with the parameter as JSON", `${user.status} ${user.body}`, `200 {"id":42}`)
  h3.send(n64(8), h3Cat([request("POST", "/echo", ["content-length"], ["5"]), h3Frame(H3_FRAME_DATA, [104, 101, 108, 108, 111])]), true)
  t.ok("a POST of /echo answered and ended", h3.turnUntil(key, n64(8), false))
  const echo = h3Answer(h3.stream(n64(8)))
  t.eqStr("200 with its body echoed", `${echo.status} ${echo.body}`, "200 hello")
  h3.send(n64(12), request("GET", "/missing", noNames, noNames), true)
  t.ok("a GET of a path no route has answered and ended", h3.turnUntil(key, n64(12), false))
  const missing = h3Answer(h3.stream(n64(12)))
  t.eqStr("404 as problem+json", `${missing.status} ${missing.body}`, `404 {"type":"about:blank","title":"Not Found","status":404}`)
}

export const main = (): i32 => {
  const t = new Suite("http server carriers")
  const key: Secret<u8[]> = secret(leafPrivate())
  const rig = new Rig(rigLimits(n32(1024)), true, toI32(4))
  t.ok("the server listens: HTTP/2 over TLS, h2c and HTTP/3", rig.h2.port > 0 && rig.h2.h2cPort > 0 && rig.quicPort > 0)
  h2Checks(t, rig, key)
  h2cChecks(t, rig, key)
  h3Checks(t, rig, key)
  h2ResetFlushing(t, key)
  clearChecks(t, key)
  waitChecks(t, key)
  wipe(key)
  return t.done()
}
