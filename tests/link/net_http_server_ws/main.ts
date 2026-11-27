// WebSocket on `nish/net/http-server`'s HTTP/1.1 listener: `acceptWebSocket`
// upgrades a request the program took, which then comes out of `take` again
// for each message (`message`), for room after `H1_AGAIN` (`writable`) and
// once it is over (`closed`, `closeCode`). The checks echo text and a
// 300000-byte binary message larger than the output, close from either side,
// close a malformed frame with 1002 and a dropped connection with 1006,
// reuse the one request a pool of one holds, keep the arena flat over warmed
// round trips, refuse the upgrade on h2c, leave a socket alone when
// `bodyTimeout` has long passed, and close one quiet past `idleTimeout`.
import { Suite } from "nish/testing"
import { netClose } from "nish:net"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { H1_INVALID, Http1Config } from "nish/net/http1-server"
import {
  WS_CLOSE,
  WS_CLOSE_NORMAL,
  WS_MESSAGE,
  WS_OP_BINARY,
  WS_OP_CLOSE,
  WS_OP_CONTINUATION,
  WS_OP_PING,
  WS_OP_TEXT,
  WS_PONG,
  websocketClosePayload,
} from "nish/net/websocket"
import { Wire, getOf } from "../net_http2/peer"
import { ascii } from "../net_tls_record_common/bytes"
import { TURNS, WsClient, H2cClient, clientFrame } from "./client"
import { Rig, rigLimits } from "./rig"

/** Whether the program saw `n` WebSockets come out closed, the last with `code`. */
const lastCode = (rig: Rig, n: i32, code: i32): boolean => toI32(rig.codes.length) === n && rig.codes[n - 1] === code

/** The `Sec-WebSocket-Accept` RFC 6455 §1.3 derives from the handshake's key. */
const ACCEPT: string = "Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n"
/** The large message's length: more than four times the 64 KiB output. */
const LARGE: i32 = 300000
/** The most 64 KiB messages a non-reading client sends before the echo must have stalled: 32 MiB. */
const STALL_MESSAGES: i32 = 512

/** `n` bytes counting up mod 251, so a dropped or repeated fragment shows. */
const pattern = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  for (let k: i32 = 0; k < n; k++) {
    out[k] = toU8(k % 251)
  }
  return out
}

/** Whether the decoder's last message is `bytes` exactly. */
const holds = (c: WsClient, bytes: u8[]): boolean => {
  if (c.dec.dataLen !== toI32(bytes.length)) {
    return false
  }
  for (let k: i32 = 0; k < toI32(bytes.length); k++) {
    if (c.dec.data[k] !== bytes[k]) {
      return false
    }
  }
  return true
}

/** A close frame's payload carrying `code` and no reason, from `nish/net/websocket`'s encoder. */
const closeBody = (code: i32): u8[] => {
  const payload: u8[] | null = websocketClosePayload(code, "")
  return payload === null ? [] : payload
}

/** Turns `rig`'s loop until it holds no connection; whether it got there. */
const settles = (rig: Rig): boolean => {
  for (let turn: i32 = 0; turn < TURNS && rig.h.connections() > 0; turn++) {
    rig.step(5)
  }
  return rig.h.connections() === 0
}

/** An upgrade, text and a large binary message echoed, a ping answered, and a close from the client. */
const echoes = (t: Suite): void => {
  const rig = new Rig(rigLimits(4, 30000), 4, new Http1Config(), 0)
  const c = new WsClient(rig)
  const head: string = c.open(rig.port, "/ws")
  t.ok("the handshake is answered 101 with RFC 6455's accept value", head.startsWith("HTTP/1.1 101 ") && head.indexOf(ACCEPT) >= 0)
  t.eqI32("the program upgraded one request", rig.upgrades, 1)

  const hello: u8[] = ascii("hello")
  c.send(true, WS_OP_TEXT, hello)
  t.ok("a text message is echoed as text", c.next() === WS_MESSAGE && c.dec.opcode === WS_OP_TEXT && holds(c, hello))

  const large: u8[] = pattern(LARGE)
  const third: i32 = LARGE / 3
  c.send(false, WS_OP_BINARY, large.slice(0, third))
  c.send(false, WS_OP_CONTINUATION, large.slice(third, 2 * third))
  c.send(true, WS_OP_CONTINUATION, large.slice(2 * third, LARGE))
  t.ok("a 300000-byte binary message in three fragments is echoed whole", c.next() === WS_MESSAGE && c.dec.opcode === WS_OP_BINARY && holds(c, large))
  t.eqI32("two messages echoed", rig.echoed, 2)

  c.send(true, WS_OP_PING, ascii("p"))
  t.ok("a ping is answered with a pong by the connection", c.next() === WS_PONG && holds(c, ascii("p")))
  t.eqI32("and not handed to the program", rig.echoed, 2)

  c.send(true, WS_OP_CLOSE, closeBody(WS_CLOSE_NORMAL))
  t.ok("a close from the client is answered with 1000", c.next() === WS_CLOSE && c.dec.closeCode === WS_CLOSE_NORMAL)
  t.ok("then the server closes the connection", c.peer.awaitClose(TURNS) && settles(rig))
  t.ok("the program saw it closed with the client's 1000", lastCode(rig, 1, WS_CLOSE_NORMAL))
}

/** A client that stops reading: the echo stops on `H1_AGAIN`, then goes on when `writable` comes, every message whole. */
const resumes = (t: Suite): void => {
  const rig = new Rig(rigLimits(4, 30000), 4, new Http1Config(), 0)
  const c = new WsClient(rig)
  c.open(rig.port, "/ws")
  const chunk: u8[] = pattern(65536)
  c.peer.hold = true
  let sent: i32 = 0
  while (sent < STALL_MESSAGES && rig.stalled === 0) {
    c.send(true, WS_OP_BINARY, chunk)
    sent = sent + 1
  }
  t.ok("a client that stops reading stalls the echo on H1_AGAIN", rig.stalled > 0)
  c.peer.hold = false
  let whole: i32 = 0
  for (let k: i32 = 0; k < sent; k++) {
    if (c.next() === WS_MESSAGE && holds(c, chunk)) {
      whole = whole + 1
    }
  }
  t.ok("the echo went on when the connection was writable again", rig.resumed > 0)
  t.ok("every message sent while it stalled came back whole", whole === sent && rig.echoed === sent)
}

/** The program closes with 1000; then a malformed frame, and a connection dropped without a close. */
const closes = (t: Suite): void => {
  const rig = new Rig(rigLimits(4, 30000), 4, new Http1Config(), 0)
  const bye = new WsClient(rig)
  bye.open(rig.port, "/ws")
  bye.send(true, WS_OP_TEXT, ascii("bye"))
  t.ok("closeWebSocket sends a close with 1000", bye.next() === WS_CLOSE && bye.dec.closeCode === WS_CLOSE_NORMAL)
  t.ok("and the connection closes once it is sent", bye.peer.awaitClose(TURNS) && settles(rig))
  t.eqI32("the program's own close does not come back as closed", toI32(rig.codes.length), 0)

  const bad = new WsClient(rig)
  bad.open(rig.port, "/ws")
  bad.peer.send(clientFrame(true, WS_OP_TEXT, ascii("unmasked"), false))
  t.ok("an unmasked client frame is closed with 1002", bad.next() === WS_CLOSE && bad.dec.closeCode === 1002)
  t.ok("and its connection closes", bad.peer.awaitClose(TURNS) && settles(rig))
  t.ok("the program saw it closed with 1002", lastCode(rig, 1, 1002))

  const gone = new WsClient(rig)
  gone.open(rig.port, "/ws")
  netClose(gone.peer.fd)
  t.ok("a connection dropped without a close settles", settles(rig))
  t.ok("the program saw it closed with 1006", lastCode(rig, 2, 1006))
  t.eqI32("every WebSocket was handed back", toI32(rig.sockets.length), 0)
}

/** A pool of one request: each WebSocket's request is handed back for the next. */
const reused = (t: Suite): void => {
  const rig = new Rig(rigLimits(1, 30000), 4, new Http1Config(), 0)
  let opened: i32 = 0
  for (let k: i32 = 0; k < 3; k++) {
    const c = new WsClient(rig)
    if (c.open(rig.port, "/ws").startsWith("HTTP/1.1 101 ")) {
      opened = opened + 1
    }
    c.send(true, WS_OP_CLOSE, closeBody(WS_CLOSE_NORMAL))
    c.next()
    c.peer.awaitClose(TURNS)
    settles(rig)
  }
  t.eqI32("a pool of one serves three WebSockets one after another", opened, 3)
}

/** `Arena.used()` stays flat over warmed round trips, the server's calls and the echo both. */
const flat = (t: Suite): void => {
  const rig = new Rig(rigLimits(4, 30000), 4, new Http1Config(), 0)
  const c = new WsClient(rig)
  c.open(rig.port, "/ws")
  const small: u8[] = ascii("hello")
  const mid: u8[] = pattern(20000)
  for (let k: i32 = 0; k < 4; k++) {
    c.send(true, WS_OP_TEXT, small)
    c.next()
    c.send(true, WS_OP_BINARY, mid)
    c.next()
  }
  rig.kept = 0
  let good: i32 = 0
  for (let k: i32 = 0; k < 100; k++) {
    c.send(true, WS_OP_TEXT, small)
    if (c.next() === WS_MESSAGE && holds(c, small)) {
      good = good + 1
    }
    c.send(true, WS_OP_BINARY, mid)
    if (c.next() === WS_MESSAGE && holds(c, mid)) {
      good = good + 1
    }
  }
  t.eqI32("200 warmed round trips are echoed", good, 200)
  t.ok(`and leave the arena where it was (${rig.kept} bytes kept)`, rig.kept === 0)
}

/** Only an HTTP/1.1 request upgrades: h2c and a plain HTTP/1.1 GET are answered 400. */
const refused = (t: Suite): void => {
  const rig = new Rig(rigLimits(4, 30000), 4, new Http1Config(), 0)
  const h2 = new H2cClient(rig)
  t.ok("h2c: a connection", h2.peer.connect(rig.h2cPort))
  const wire = new Wire()
  wire.preface()
  const none: i32[] = []
  const noValues: i64[] = []
  wire.settings(none, noValues)
  wire.settingsAck()
  wire.headers(1, getOf("/ws"), H2_FLAG_END_STREAM)
  h2.peer.send(wire.take())
  const frames: string = h2.awaitFrames(3)
  t.eqI32("acceptWebSocket answers H1_INVALID on HTTP/2", rig.accepted, H1_INVALID)
  t.ok("and the program answers it 400", frames.indexOf("HEADERS 1 end :status=400") >= 0)

  const c = new WsClient(rig)
  const head: string = c.request(rig.port, ascii("GET /ws HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n"))
  t.eqI32("a GET with no Upgrade: acceptWebSocket answers H1_INVALID", rig.accepted, H1_INVALID)
  t.ok("and the program answers it 400", head.startsWith("HTTP/1.1 400 "))
  t.eqI32("no request was upgraded", rig.upgrades, 0)
}

/** `bodyTimeout` does not apply to a WebSocket: one quiet for longer still echoes. */
const quiet = (t: Suite): void => {
  const rig = new Rig(rigLimits(4, 1), 4, new Http1Config(), 0)
  const c = new WsClient(rig)
  c.open(rig.port, "/ws")
  const start: i64 = monotonicNanos()
  while (monotonicNanos() - start < 1500000000 && !c.peer.closed) {
    c.peer.turn()
  }
  t.ok("bodyTimeout 1: a WebSocket quiet for 1.5 s is still open", !c.peer.closed && rig.h.connections() === 1)
  const hello: u8[] = ascii("hello")
  c.send(true, WS_OP_TEXT, hello)
  t.ok("and still echoes", c.next() === WS_MESSAGE && holds(c, hello))
}

/** The slot's `idleTimeout` does apply: a WebSocket quiet for longer is closed, and the program sees 1006. */
const idle = (t: Suite): void => {
  const config = new Http1Config()
  config.idleTimeout = 300
  const rig = new Rig(rigLimits(4, 30000), 4, config, 0)
  const c = new WsClient(rig)
  c.open(rig.port, "/ws")
  const start: i64 = monotonicNanos()
  while (monotonicNanos() - start < 3000000000 && !c.peer.closed) {
    c.peer.turn()
  }
  t.ok("idleTimeout 300: a quiet WebSocket's connection is closed", c.peer.closed && settles(rig))
  t.ok("and the program saw it closed with 1006", lastCode(rig, 1, 1006))
  t.eqI32("and handed it back", toI32(rig.sockets.length), 0)
}

export const main = (): i32 => {
  const t = new Suite("net_http_server_ws")
  echoes(t)
  resumes(t)
  closes(t)
  reused(t)
  flat(t)
  refused(t)
  quiet(t)
  idle(t)
  return t.done()
}
