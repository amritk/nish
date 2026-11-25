// `HttpServer.listenHttp1Tls`: HTTP/1.1 over TLS on its own port, beside a
// cleartext HTTP/1.1 listener and an HTTP/3 one, answered by the same program
// through the same calls, in one process over loopback.
//
//   1. A TLS handshake offering `http/1.1`, then a text route, a parameter as
//      JSON, a body echoed and a 404, keep-alive on one connection, each
//      response carrying `alt-svc` for the HTTP/3 port and each request
//      saying `secure`; a cleartext request beside it does not.
//   2. Warmed, a keep-alive request allocates nothing in the server's
//      `waitSigned` and `send`.
//   3. A client offering no ALPN is served as HTTP/1.1.
//   4. ALPN mismatch: a client offering only `h2` to a listener offering
//      only `http/1.1` is refused with no_application_protocol (alert 120);
//      to one offering both, it is shut down with close_notify after the
//      handshake. No request is taken from either.
//   5. Timeouts: a connection silent after its handshake is closed by the
//      carrier's `idleTimeout`, one whose head stops by its `headTimeout`,
//      and one whose body stops by the server's `bodyTimeout`.
//   6. `drain` closes an idle TLS connection, and one answering an 8 MiB
//      body to a client reading slowly only after its last byte is sent.
//   7. The TLS listener listened first, so its records start at 0: a second
//      connection on record 1, a `Connection: close` answered and shut down
//      with close_notify, and a cleartext request on the records after.
import { Secret, secret, wipe } from "nish:secret"
import { netAddress, netRead, netWrite, tcpConnect } from "nish:net"
import { Suite } from "nish/testing"
import { HttpServerLimits } from "nish/net/http-server"
import { H1_ALPN, Http1Config } from "nish/net/http1-server"
import { H2_ALPN } from "nish/net/http2-tls"
import { leafPrivate } from "../net_tls_common/server"
import { ZERO, ascii } from "../net_tls_record_common/bytes"
import { textOf } from "../crypto_x509/hex"
import { headerOf } from "../net_serve/client"
import { H1TlsClient } from "./client"
import { BIG_LENGTH, Rig } from "./rig"

/** Whether `response` is a 200 whose body is `body`, with `alt-svc` naming `quicPort`. */
const okWith = (response: string, body: string, quicPort: i32): boolean =>
  response.startsWith("HTTP/1.1 200") &&
  response.endsWith(`\r\n\r\n${body}`) &&
  response.indexOf(`alt-svc: h3=":${quicPort}"; ma=86400\r\n`) >= 0

/** One request over the cleartext listener at `port`; the response's text, or empty. */
const plainGet = (rig: Rig, port: i32, key: Secret<u8[]>): string => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  const fd: i32 = tcpConnect(addr)
  if (fd < 0) {
    return ""
  }
  const out: u8[] = ascii("GET /hello HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n")
  let sent: i32 = 0
  const buf: u8[] = new Array<u8>(4096)
  const got: u8[] = []
  for (let turn: i32 = 0; turn < 2000; turn++) {
    if (sent < toI32(out.length)) {
      const w: i32 = netWrite(fd, out, sent, toI32(out.length) - sent)
      if (w > 0) {
        sent = sent + w
      }
    }
    rig.step(5, key)
    const n: i32 = netRead(fd, buf, ZERO, toI32(buf.length))
    if (n > 0) {
      for (let k: i32 = 0; k < n; k++) {
        got.push(buf[k])
      }
    } else if (n === 0) {
      break
    }
  }
  return textOf(got)
}

/** Steps `rig` until it holds no connection; whether it got there. */
const settles = (rig: Rig, key: Secret<u8[]>): boolean => {
  for (let turn: i32 = 0; turn < 400 && rig.h.connections() > 0; turn++) {
    rig.step(5, key)
  }
  return rig.h.connections() === 0
}

/** 1 and 2: requests over TLS, then the warmed loop. */
const served = (t: Suite, rig: Rig, key: Secret<u8[]>): void => {
  const c = new H1TlsClient(rig)
  t.ok("a TLS handshake offering http/1.1, the server's signature and Finished verified", c.handshake(rig.port, [H1_ALPN], key) && c.verified)
  c.request("GET /hello HTTP/1.1\r\nHost: a\r\n\r\n", key)
  t.ok("a GET of /hello: 200 and its body, with alt-svc naming the HTTP/3 port", okWith(c.response(key), "hello", rig.quicPort))
  c.request("GET /users/42 HTTP/1.1\r\nHost: a\r\n\r\n", key)
  t.ok("a GET of /users/42 on the same connection: the parameter as JSON", okWith(c.response(key), `{"id":42}`, rig.quicPort))
  c.request("POST /echo HTTP/1.1\r\nHost: a\r\nContent-Length: 5\r\n\r\nworld", key)
  t.ok("a POST of /echo: its body echoed", okWith(c.response(key), "world", rig.quicPort))
  c.request("GET /missing HTTP/1.1\r\nHost: a\r\n\r\n", key)
  t.ok("a GET of a path no route has: 404", c.response(key).startsWith("HTTP/1.1 404"))
  t.eqI32("every request was taken, and said secure", rig.secure, 4)
  t.eqI32("of 4 taken", rig.taken, 4)
  const plain: string = plainGet(rig, rig.plainPort, key)
  t.ok("a cleartext GET beside it: 200 hello", plain.startsWith("HTTP/1.1 200") && plain.endsWith("\r\n\r\nhello"))
  t.ok("which did not say secure", rig.taken === 5 && rig.secure === 4)

  // Warm the connection and the server's buffers, then count what the next requests keep.
  for (let k: i32 = 0; k < 4; k++) {
    c.request("GET /hello HTTP/1.1\r\nHost: a\r\n\r\n", key)
    c.response(key)
  }
  const warmed: i64 = rig.kept
  let answered: i32 = 0
  for (let k: i32 = 0; k < 32; k++) {
    c.request("GET /hello HTTP/1.1\r\nHost: a\r\n\r\n", key)
    if (okWith(c.response(key), "hello", rig.quicPort)) {
      answered = answered + 1
    }
  }
  t.eqI32("32 warmed keep-alive requests over TLS, each answered", answered, 32)
  t.eqI64("and the server's waitSigned and send kept 0 arena bytes for them", rig.kept - warmed, toI64(0))
  t.ok("no alert on the connection", toI32(c.alerts.length) === 0 && !c.closed)

  const bare = new H1TlsClient(rig)
  const none: string[] = []
  t.ok("a TLS handshake offering no ALPN", bare.handshake(rig.port, none, key) && bare.verified)
  bare.request("GET /hello HTTP/1.1\r\nHost: a\r\n\r\n", key)
  t.ok("is served as HTTP/1.1: 200 hello", okWith(bare.response(key), "hello", rig.quicPort))

  // 6: drain closes both idle connections.
  rig.h.drain()
  t.ok("drain closes the idle TLS connections", settles(rig, key) && c.untilClosed(key) && bare.untilClosed(key))
}

/** 6: a drain while a response larger than the socket buffers is in flight. */
const drainsLarge = (t: Suite, key: Secret<u8[]>): void => {
  const rig = new Rig(new HttpServerLimits(), [H1_ALPN], new Http1Config(), 4, false)
  const c = new H1TlsClient(rig)
  t.ok("a TLS handshake, then a GET of an 8 MiB body", c.handshake(rig.port, [H1_ALPN], key) && c.verified)
  c.request("GET /big HTTP/1.1\r\nHost: a\r\n\r\n", key)
  // The client reads nothing yet, so the server's socket fills.
  for (let turn: i32 = 0; turn < 50; turn++) {
    rig.step(5, key)
  }
  rig.h.drain()
  const total: i32 = c.count(key)
  const head: string = textOf(c.plain)
  const end: i32 = toI32(head.indexOf("\r\n\r\n"))
  t.ok("drained meanwhile, the server ends the connection once the client has read it all", c.closed)
  c.hangUp()
  t.ok("and closes the slot once the client hangs up", settles(rig, key))
  t.ok("a 200 declaring the whole body", head.startsWith("HTTP/1.1 200") && end > 0 && headerOf(head.slice(0, end), "content-length") === `${BIG_LENGTH}`)
  t.eqI32("every body byte arrived", total - (end + 4), BIG_LENGTH)
  t.eqStr("then close_notify", c.alerts.join(","), "1 0")
}

/** 7: the TLS listener listened before the cleartext one. */
const tlsFirst = (t: Suite, key: Secret<u8[]>): void => {
  const rig = new Rig(new HttpServerLimits(), [H1_ALPN], new Http1Config(), 4, true)
  const a = new H1TlsClient(rig)
  const b = new H1TlsClient(rig)
  t.ok("TLS listened first: two TLS handshakes", a.handshake(rig.port, [H1_ALPN], key) && b.handshake(rig.port, [H1_ALPN], key))
  b.request("GET /users/7 HTTP/1.1\r\nHost: a\r\n\r\n", key)
  t.ok("the second connection, on the TLS carrier's record 1, is answered", okWith(b.response(key), `{"id":7}`, rig.quicPort))
  a.request("GET /hello HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n", key)
  const closing: string = a.response(key)
  t.ok("the first, asking Connection: close, is answered", okWith(closing, "hello", rig.quicPort))
  t.ok("then shut down with close_notify", a.untilClosed(key) && a.alerts.join(",") === "1 0")
  a.hangUp()
  const plain: string = plainGet(rig, rig.plainPort, key)
  t.ok("a cleartext GET, on the records after the TLS ones: 200 hello", plain.startsWith("HTTP/1.1 200") && plain.endsWith("\r\n\r\nhello"))
  t.ok("3 taken, the 2 over TLS secure", rig.taken === 3 && rig.secure === 2)
  rig.h.drain()
  t.ok("drain closes the idle TLS connection left", settles(rig, key) && b.untilClosed(key))
}

/** 4: a client offering only h2. */
const mismatched = (t: Suite, key: Secret<u8[]>): void => {
  const only = new Rig(new HttpServerLimits(), [H1_ALPN], new Http1Config(), 4, false)
  const a = new H1TlsClient(only)
  t.ok("ALPN h2 to a listener offering http/1.1 alone: no handshake", !a.handshake(only.port, [H2_ALPN], key))
  t.eqStr("but a fatal no_application_protocol alert", a.alerts.join(","), "2 120")
  t.ok("and the connection closed, no request taken", a.untilClosed(key) && settles(only, key) && only.taken === 0)

  const both = new Rig(new HttpServerLimits(), [H1_ALPN, H2_ALPN], new Http1Config(), 4, false)
  const b = new H1TlsClient(both)
  t.ok("ALPN h2 to a listener offering http/1.1 and h2: the handshake completes", b.handshake(both.port, [H2_ALPN], key) && b.verified)
  b.request("GET /hello HTTP/1.1\r\nHost: a\r\n\r\n", key)
  t.ok("then the server closes", b.untilClosed(key) && settles(both, key))
  t.eqStr("with close_notify, and no HTTP byte", `${b.alerts.join(",")} ${toI32(b.plain.length)}`, "1 0 0")
  t.eqI32("no request taken", both.taken, 0)
}

/** 5: the carrier's idleTimeout and the server's bodyTimeout. */
const timeouts = (t: Suite, key: Secret<u8[]>): void => {
  const config = new Http1Config()
  config.idleTimeout = 100
  const idle = new Rig(new HttpServerLimits(), [H1_ALPN], config, 4, false)
  const a = new H1TlsClient(idle)
  t.ok("idleTimeout 100: a handshake, then silence", a.handshake(idle.port, [H1_ALPN], key))
  t.ok("is closed by the server", a.untilClosed(key) && settles(idle, key))

  const heads = new Http1Config()
  heads.headTimeout = 100
  const late = new Rig(new HttpServerLimits(), [H1_ALPN], heads, 4, false)
  const h = new H1TlsClient(late)
  t.ok("headTimeout 100: a handshake", h.handshake(late.port, [H1_ALPN], key))
  h.request("GET /hello HTTP/1.1\r\nHo", key)
  t.ok("a head that stops part way is closed by the server", h.untilClosed(key) && settles(late, key))
  t.eqI32("and not handed to the program", late.taken, 0)

  const limits = new HttpServerLimits()
  limits.bodyTimeout = 100
  const slow = new Rig(limits, [H1_ALPN], new Http1Config(), 4, false)
  const b = new H1TlsClient(slow)
  t.ok("bodyTimeout 100: a handshake", b.handshake(slow.port, [H1_ALPN], key))
  b.request("POST /echo HTTP/1.1\r\nHost: a\r\nContent-Length: 10\r\n\r\nab", key)
  t.ok("a body that stops after 2 of 10 bytes is closed by the server", b.untilClosed(key) && settles(slow, key))
  t.eqI32("never handed to the program", slow.taken, 0)
}

export const main = (): i32 => {
  const t = new Suite("net_http_server_h1_tls")
  const key: Secret<u8[]> = secret(leafPrivate())
  const rig = new Rig(new HttpServerLimits(), [H1_ALPN], new Http1Config(), 4, false)
  t.ok("the server listens: HTTP/1.1, HTTP/1.1 over TLS and HTTP/3", rig.port > 0 && rig.plainPort > 0 && rig.quicPort > 0)
  served(t, rig, key)
  mismatched(t, key)
  timeouts(t, key)
  drainsLarge(t, key)
  tlsFirst(t, key)
  wipe(key)
  return t.done()
}
