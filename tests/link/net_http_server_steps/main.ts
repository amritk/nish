// `nish/net/http-server`'s steps on every version it serves: the `Rig` of
// `net_http_server_carriers` binds `id` and `tag` to `/stepped` and `id` and
// `auth` to `/guarded`, and answers each request through `before`, its body
// and `after`, the same calls on HTTP/1.1, h2c and HTTP/3.
//
//   1. `/stepped`: `id` runs before the body and `tag` after it, and both
//      fields reach the answer.
//   2. `/guarded` with no `authorization` field: `auth` refuses it with 401,
//      which still carries the field `id` added; the body never runs.
//   3. `/guarded` with one: 200, the id, no `x-tag`.
//   4. `/hello`, bound to no step: neither field.
//   5. `/sized`: `size` adds `alt-svc`, and on HTTP/2 and HTTP/3
//      `content-length`, which the server adds itself when the answer has
//      none; each goes out once, the step's.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { netAddress, netRead, netWrite, tcpConnect } from "nish:net"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { H3_FRAME_HEADERS, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER } from "nish/net/http3-frame"
import { QpackEncoder } from "nish/net/qpack"
import { n32, n64 } from "../net_quic_frame/typed"
import { leafPrivate } from "../net_tls_common/server"
import { getOf } from "../net_http2/peer"
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, H3Limits, h3Cat, h3ClientParams, h3ClientSettings, h3Frame, h3Section, h3Varint } from "../net_http3/peer"
import { textOf } from "../crypto_x509/hex"
import { ZERO } from "../net_tls_record_common/bytes"
import { QuicClient, TURNS, h3Answer } from "../net_http_server_carriers/client"
import { h2cOpen, h2cUntil } from "../net_http_server_matrix/rows"
import { Rig, rigLimits } from "../net_http_server_carriers/rig"

/** What `netRead` answers when nothing is waiting. */
const WOULD_BLOCK: i32 = -11

/** The whole HTTP/1.1 answer to a GET of `path` with `extra` header lines, over a connection the client closes after it. */
const h1Get = (rig: Rig, key: Secret<u8[]>, path: string, extra: string): string => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", rig.h2.h1Port)
  const fd: i32 = tcpConnect(addr)
  if (fd < 0) {
    return ""
  }
  const out: u8[] = []
  const request: string = `GET ${path} HTTP/1.1\r\nHost: localhost\r\n${extra}Connection: close\r\n\r\n`
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

/** The HEADERS frame of an HTTP/3 GET of `path`, then `names`/`values`. */
const h3Get = (path: string, names: string[], values: string[]): u8[] => {
  const allNames: string[] = [":method", ":scheme", ":authority", ":path"]
  const allValues: string[] = ["GET", "https", "localhost", path]
  for (let k: i32 = 0; k < toI32(names.length) && k < toI32(values.length); k++) {
    allNames.push(names[k])
    allValues.push(values[k])
  }
  return h3Frame(H3_FRAME_HEADERS, h3Section(new QpackEncoder(), allNames, allValues))
}

/** How many times `part` occurs in `text`. */
const occurrences = (text: string, part: string): i32 => {
  let n: i32 = 0
  let at: i32 = text.indexOf(part)
  while (at >= 0) {
    n = n + 1
    at = text.indexOf(part, at + toI32(part.length))
  }
  return n
}

const h1Checks = (t: Suite, rig: Rig, key: Secret<u8[]>): void => {
  const stepped: string = h1Get(rig, key, "/stepped", "")
  t.ok("HTTP/1.1 /stepped: 200 with x-request-id 0 and x-tag", stepped.indexOf("HTTP/1.1 200 ") === 0 && stepped.indexOf("\r\nx-request-id: 0\r\n") > 0 && stepped.indexOf("\r\nx-tag: on\r\n") > 0)
  t.eqStr("HTTP/1.1 /stepped: id, the body, then tag", rig.ran, "id body tag")
  const refused: string = h1Get(rig, key, "/guarded", "")
  t.ok("HTTP/1.1 /guarded with no authorization: 401 carrying x-request-id 1, no x-tag", refused.indexOf("HTTP/1.1 401 ") === 0 && refused.indexOf("\r\nx-request-id: 1\r\n") > 0 && refused.indexOf("x-tag") < 0)
  t.eqStr("HTTP/1.1 /guarded refused: the body never ran", rig.ran, "id auth ")
  const allowed: string = h1Get(rig, key, "/guarded", "Authorization: yes\r\n")
  t.ok("HTTP/1.1 /guarded with authorization: 200 with x-request-id 2, no x-tag", allowed.indexOf("HTTP/1.1 200 ") === 0 && allowed.indexOf("\r\nx-request-id: 2\r\n") > 0 && allowed.indexOf("x-tag") < 0)
  t.eqStr("HTTP/1.1 /guarded allowed: id, auth, the body", rig.ran, "id auth body")
  const plain: string = h1Get(rig, key, "/hello", "")
  t.ok("HTTP/1.1 /hello, bound to no step: 200 with neither field", plain.indexOf("HTTP/1.1 200 ") === 0 && plain.indexOf("x-request-id") < 0 && plain.indexOf("x-tag") < 0)
  const sized: string = h1Get(rig, key, "/sized", "")
  t.ok("HTTP/1.1 /sized: 200 with the step's alt-svc", sized.indexOf("HTTP/1.1 200 ") === 0 && sized.indexOf("\r\nalt-svc: clear\r\n") > 0)
  t.eqI32("HTTP/1.1 /sized: one alt-svc, the server adds none beside the step's", occurrences(sized, "\r\nalt-svc:"), 1)
}

const h2cChecks = (t: Suite, rig: Rig, key: Secret<u8[]>): void => {
  const none: i32[] = []
  const noValues: i64[] = []
  const c = h2cOpen(rig, none, noValues)
  c.wire.headers(n32(1), getOf("/stepped"), H2_FLAG_END_STREAM)
  const stepped: string = h2cUntil(c, key, "DATA 1 0 \"\" end")
  t.ok("h2c /stepped: 200 with x-request-id 3 and x-tag", stepped.indexOf("HEADERS 1 :status=200 ") >= 0 && stepped.indexOf("x-request-id=3") >= 0 && stepped.indexOf("x-tag=on") >= 0)
  t.eqStr("h2c /stepped: id, the body, then tag", rig.ran, "id body tag")
  c.wire.headers(n32(3), getOf("/guarded"), H2_FLAG_END_STREAM)
  const refused: string = h2cUntil(c, key, "DATA 3 0 \"\" end")
  t.ok("h2c /guarded with no authorization: 401 carrying x-request-id 4, no x-tag", refused.indexOf("HEADERS 3 :status=401 ") >= 0 && refused.indexOf("x-request-id=4") >= 0 && refused.indexOf("x-tag") < 0)
  t.eqStr("h2c /guarded refused: the body never ran", rig.ran, "id auth ")
  const authorized: string[] = getOf("/guarded")
  authorized.push("authorization")
  authorized.push("yes")
  c.wire.headers(n32(5), authorized, H2_FLAG_END_STREAM)
  const allowed: string = h2cUntil(c, key, "DATA 5 0 \"\" end")
  t.ok("h2c /guarded with authorization: 200 with x-request-id 5", allowed.indexOf("HEADERS 5 :status=200 ") >= 0 && allowed.indexOf("x-request-id=5") >= 0)
  t.eqStr("h2c /guarded allowed: id, auth, the body", rig.ran, "id auth body")
  c.wire.headers(n32(7), getOf("/sized"), H2_FLAG_END_STREAM)
  const sized: string = h2cUntil(c, key, "DATA 7 0 \"\" end")
  t.ok("h2c /sized: 200 with the step's content-length", sized.indexOf("HEADERS 7 :status=200 ") >= 0 && sized.indexOf("content-length=6") >= 0)
  t.eqI32("h2c /sized: one content-length, the server adds none beside the step's", occurrences(sized, "content-length="), 1)
  c.wire.headers(n32(9), getOf("/hello"), H2_FLAG_END_STREAM)
  const plain: string = h2cUntil(c, key, "DATA 9 0 \"\" end")
  t.ok("h2c /hello, bound to no step: 200 with neither field", plain.indexOf("HEADERS 9 :status=200 ") >= 0 && plain.indexOf("x-request-id") < 0 && plain.indexOf("x-tag") < 0)
}

const h3Checks = (t: Suite, rig: Rig, key: Secret<u8[]>): void => {
  const h3 = new QuicClient(rig)
  t.ok("HTTP/3: the handshake, ALPN h3", h3.connect("h3", h3ClientParams(new H3Limits()), key))
  h3.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]), false)
  h3.send(CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false)
  h3.send(CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false)
  const noNames: string[] = []
  h3.send(n64(0), h3Get("/stepped", noNames, noNames), true)
  t.ok("HTTP/3 /stepped answered and ended", h3.turnUntil(key, n64(0), false))
  const stepped = h3Answer(h3.stream(n64(0)))
  t.ok("HTTP/3 /stepped: 200 with x-request-id 6 and x-tag", stepped.status === "200" && stepped.fields.indexOf("x-request-id=6") >= 0 && stepped.fields.indexOf("x-tag=on") >= 0)
  t.eqStr("HTTP/3 /stepped: id, the body, then tag", rig.ran, "id body tag")
  h3.send(n64(4), h3Get("/guarded", noNames, noNames), true)
  t.ok("HTTP/3 /guarded with no authorization answered and ended", h3.turnUntil(key, n64(4), false))
  const refused = h3Answer(h3.stream(n64(4)))
  t.ok("HTTP/3 /guarded with no authorization: 401 carrying x-request-id 7, no x-tag", refused.status === "401" && refused.fields.indexOf("x-request-id=7") >= 0 && refused.fields.indexOf("x-tag") < 0)
  t.eqStr("HTTP/3 /guarded refused: the body never ran", rig.ran, "id auth ")
  h3.send(n64(8), h3Get("/guarded", ["authorization"], ["yes"]), true)
  t.ok("HTTP/3 /guarded with authorization answered and ended", h3.turnUntil(key, n64(8), false))
  const allowed = h3Answer(h3.stream(n64(8)))
  t.ok("HTTP/3 /guarded with authorization: 200 with x-request-id 8", allowed.status === "200" && allowed.fields.indexOf("x-request-id=8") >= 0)
  t.eqStr("HTTP/3 /guarded allowed: id, auth, the body", rig.ran, "id auth body")
  h3.send(n64(12), h3Get("/hello", noNames, noNames), true)
  t.ok("HTTP/3 /hello answered and ended", h3.turnUntil(key, n64(12), false))
  const plain = h3Answer(h3.stream(n64(12)))
  t.ok("HTTP/3 /hello, bound to no step: 200 with neither field", plain.status === "200" && plain.fields.indexOf("x-request-id") < 0 && plain.fields.indexOf("x-tag") < 0)
  h3.send(n64(16), h3Get("/sized", noNames, noNames), true)
  t.ok("HTTP/3 /sized answered and ended", h3.turnUntil(key, n64(16), false))
  const sized = h3Answer(h3.stream(n64(16)))
  t.ok("HTTP/3 /sized: 200 with the step's content-length", sized.status === "200" && sized.fields.indexOf("content-length=6") >= 0)
  t.eqI32("HTTP/3 /sized: one content-length, the server adds none beside the step's", occurrences(sized.fields, "content-length="), 1)
}

export const main = (): i32 => {
  const t = new Suite("http server steps")
  const key: Secret<u8[]> = secret(leafPrivate())
  const rig = new Rig(rigLimits(n32(16)), true, toI32(4))
  h1Checks(t, rig, key)
  h2cChecks(t, rig, key)
  h3Checks(t, rig, key)
  t.eqI32("nine requests named, one per stepped request", rig.named, 9)
  wipe(key)
  return t.done()
}
