// `nish/net/http-server` over HTTP/2 over TLS and HTTP/3, in one process over
// loopback: the scripted clients of `tests/link/net_interop_server` against
// one `HttpServer` holding both listeners, so the program of `rig.ts` answers
// each carrier through the same calls.
//
//   1. HTTP/2 over TLS: a text route, a parameter as JSON, a body echoed, a
//      404 as problem+json, and `alt-svc` naming the HTTP/3 port on each.
//   2. HTTP/3: the same requests, answered alike, with no `alt-svc`.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { H3_FRAME_DATA, H3_FRAME_HEADERS, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER } from "nish/net/http3-frame"
import { QpackEncoder } from "nish/net/qpack"
import { n32, n64 } from "../net_quic_frame/typed"
import { leafPrivate } from "../net_tls_common/server"
import { getOf, postOf } from "../net_http2/peer"
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, H3Limits, h3Cat, h3ClientParams, h3ClientSettings, h3Frame, h3Section, h3Varint } from "../net_http3/peer"
import { H2TlsClient, QuicClient, h3Answer } from "./client"
import { Rig } from "./rig"

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
  const rig = new Rig()
  t.ok("the server listens: HTTP/2 over TLS and HTTP/3", rig.h2.port > 0 && rig.quicPort > 0)
  h2Checks(t, rig, key)
  h3Checks(t, rig, key)
  wipe(key)
  return t.done()
}
