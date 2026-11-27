// The clients of `net_http_server_ws`, against a `Rig` in the same process
// over loopback: a WebSocket client that sends the opening handshake and
// masked frames and reads the server's frames with `nish/net/websocket`'s
// decoder, and an h2c client whose frames `tests/link/net_http2/peer` writes
// and renders. Each sends, then turns the server's loop until the answer it
// waits for has come.
import { netAddress, netRead, netWrite, tcpConnect } from "nish:net"
import { WS_NEED_MORE, WsDecoder, websocketFrame } from "nish/net/websocket"
import { FrameLog, textAt } from "../net_http2/peer"
import { ascii } from "../net_tls_record_common/bytes"
import { Rig } from "./rig"

/** What `netRead` answers when nothing is waiting on a non-blocking socket. */
const WOULD_BLOCK: i32 = -11
/** How many turns of the server's loop a client waits through for an answer. */
export const TURNS: i32 = 2000

/** The opening handshake of RFC 6455 §1.3's example, for `target`. */
export const handshake = (target: string): u8[] =>
  ascii(
    `GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`
  )

/** A frame masked with 01 02 03 04, as a client's must be, or unmasked when `masked` is false. */
export const clientFrame = (fin: boolean, opcode: i32, payload: u8[], masked: boolean): u8[] => {
  const mask: u8[] | null = masked ? [toU8(1), toU8(2), toU8(3), toU8(4)] : null
  const frame: u8[] | null = websocketFrame(fin, opcode, payload, 0, toI32(payload.length), mask)
  return frame === null ? [] : frame
}

/** A TCP connection to the rig: what it sends, and what it has read and not yet taken. */
export class Peer {
  server: Rig
  fd: i32 = -1
  buf: u8[]
  /** The bytes read and not yet taken. */
  got: u8[]
  /** Whether the server has closed its end. */
  closed: boolean = false
  /** Whether `turn` leaves the socket unread, so the server's output fills. */
  hold: boolean = false

  constructor(server: Rig) {
    this.server = server
    this.buf = new Array<u8>(65536)
    this.got = []
  }

  /** Connects to `port`; false when the connect failed. */
  connect(port: i32): boolean {
    const addr: u8[] = new Array<u8>(18)
    netAddress(addr, "127.0.0.1", port)
    this.fd = tcpConnect(addr)
    return this.fd >= 0
  }

  /** Sends `bytes`, turning the server's loop (and reading what it sends) while the socket is full. */
  send(bytes: u8[]): void {
    let sent: i32 = 0
    for (let turn: i32 = 0; turn < TURNS && sent < toI32(bytes.length); turn++) {
      const w: i32 = netWrite(this.fd, bytes, sent, toI32(bytes.length) - sent)
      if (w > 0) {
        sent = sent + w
      } else {
        this.turn()
      }
    }
  }

  /** One turn of the server's loop, then every byte waiting on the socket into `got` unless `hold` is set; marks `closed` at its end. */
  turn(): void {
    this.server.step(5)
    if (!this.hold) {
      this.read()
    }
  }

  /** Every byte waiting on the socket into `got`, without turning the server's loop. */
  read(): void {
    let n: i32 = netRead(this.fd, this.buf, 0, toI32(this.buf.length))
    while (n > 0) {
      for (let k: i32 = 0; k < n; k++) {
        this.got.push(this.buf[k])
      }
      n = netRead(this.fd, this.buf, 0, toI32(this.buf.length))
    }
    if (n !== WOULD_BLOCK && n <= 0) {
      this.closed = true
    }
  }

  /** Turns the server's loop until it closes the connection, at most `turns` times; whether it did. */
  awaitClose(turns: i32): boolean {
    for (let turn: i32 = 0; turn < turns && !this.closed; turn++) {
      this.turn()
    }
    return this.closed
  }
}

/** A WebSocket client: the handshake's response as text, then the server's frames through a decoder. */
export class WsClient {
  peer: Peer
  dec: WsDecoder

  constructor(server: Rig) {
    this.peer = new Peer(server)
    this.dec = new WsDecoder(false, 16777216)
  }

  /** Connects to `port` and sends the opening handshake for `target`; the response head, or "" when none came. */
  open(port: i32, target: string): string {
    if (!this.peer.connect(port)) {
      return ""
    }
    this.peer.send(handshake(target))
    for (let turn: i32 = 0; turn < TURNS && !this.peer.closed; turn++) {
      const end: i32 = this.headEnd()
      if (end > 0) {
        const head: string = textAt(this.peer.got, 0, end)
        this.feed(end)
        return head
      }
      this.peer.turn()
    }
    return ""
  }

  /** Where the response head ends in `got`, past its blank line, or 0 before it has. */
  private headEnd(): i32 {
    const got: u8[] = this.peer.got
    for (let k: i32 = 3; k < toI32(got.length); k++) {
      if (got[k - 3] === toU8(13) && got[k - 2] === toU8(10) && got[k - 1] === toU8(13) && got[k] === toU8(10)) {
        return k + 1
      }
    }
    return 0
  }

  /** Feeds `got` from `from` on to the decoder and empties it. */
  private feed(from: i32): void {
    const got: u8[] = this.peer.got
    if (from < toI32(got.length)) {
      this.dec.feed(got, from, toI32(got.length) - from)
    }
    this.peer.got = []
  }

  /** Sends one frame. */
  send(fin: boolean, opcode: i32, payload: u8[]): void {
    this.peer.send(clientFrame(fin, opcode, payload, true))
  }

  /** The next event the decoder reads (`WS_MESSAGE`, `WS_CLOSE`, ...), turning the server's loop until one is whole; `WS_NEED_MORE` when the connection ended first. */
  next(): i32 {
    let event: i32 = this.dec.next()
    for (let turn: i32 = 0; turn < TURNS && event === WS_NEED_MORE && !this.peer.closed; turn++) {
      this.peer.turn()
      this.feed(0)
      event = this.dec.next()
    }
    return event
  }
}

/** An h2c client: the bytes it sends, and the server's frames rendered as text. */
export class H2cClient {
  peer: Peer
  log: FrameLog

  constructor(server: Rig) {
    this.peer = new Peer(server)
    this.log = new FrameLog()
  }

  /** Turns the server's loop until the log holds `n` frames, or the server closes; answers them joined. */
  awaitFrames(n: i32): string {
    for (let turn: i32 = 0; turn < TURNS && toI32(this.log.frames.length) < n && !this.peer.closed; turn++) {
      this.peer.turn()
      const got: u8[] = this.peer.got
      if (toI32(got.length) > 0) {
        this.log.push(got, 0, toI32(got.length))
        this.peer.got = []
      }
    }
    return this.log.take()
  }
}
