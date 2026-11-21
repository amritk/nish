// The clients of `net_http_server_stream`: HTTP/2 over a TCP socket, in the
// clear (h2c, prior knowledge) or inside the TLS 1.3 client of
// `tests/link/net_http_server_carriers` (the handshake of `net_tls_common`,
// records of `net_tls_record_common`), with frames from
// `tests/link/net_http2/peer`; and a bare HTTP/1.1 client. Each turns the
// `StreamRig`'s loop while it waits.
import { Secret } from "nish:secret"
import { netAddress, netClose, netRead, netWrite, tcpConnect } from "nish:net"
import { TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule"
import { TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE, TlsRecordProtection } from "nish/net/tls/record"
import { TLS_GROUP_X25519, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec"
import { H2_ALPN } from "nish/net/http2-tls"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { leafPublic } from "../net_tls_common/server"
import {
  GROUP_SECP256R1,
  clientFinish,
  clientHello,
  clientShare,
  extAlpn,
  extKeyShare,
  extSignatureAlgorithms,
  extSupportedGroups,
  extSupportedVersions,
} from "../net_tls_common/client"
import { Opened, ZERO, ascii, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes"
import { clearRecord, clientKeysFor } from "../net_tls_record_common/client"
import { FrameLog, Wire, postOf } from "../net_http2/peer"
import { StreamRig } from "./rig"

/** What `netRead` answers when nothing is waiting. */
const WOULD_BLOCK: i32 = -11

/** The most turns of the server's loop one wait takes, at up to 5 ms each. */
export const TURNS: i32 = 2000

/** The largest DATA frame a client sends: inside the default SETTINGS_MAX_FRAME_SIZE, and one frame to a TLS record. */
export const PIECE: i32 = 16000

/** The window a stream opens with. */
const FIRST_WINDOW: i32 = 65535

/** The decimal number `text` ends with, after `from`. */
const tail = (text: string, from: i32): i32 => {
  let n: i32 = 0
  for (let k: i32 = from; k < toI32(text.length); k++) {
    n = n * 10 + (toI32(text.charCodeAt(k)) - 48)
  }
  return n
}

/** One HTTP/2 client of the server, in the clear or over TLS. */
export class StreamClient {
  server: StreamRig
  tls: boolean = false
  read: TlsRecordProtection
  write: TlsRecordProtection
  wire: Wire
  log: FrameLog
  /** Every frame the server sent, rendered, and how many `credit` has looked at. */
  frames: string[]
  scanned: i32 = 0
  got: u8[]
  buf: u8[]
  fd: i32 = -1
  verified: boolean = false
  /** Whether the server has closed its end. */
  closed: boolean = false

  constructor(server: StreamRig, tls: boolean) {
    this.server = server
    this.tls = tls
    this.read = new TlsRecordProtection()
    this.write = new TlsRecordProtection()
    this.wire = new Wire()
    this.log = new FrameLog()
    this.frames = []
    this.got = []
    this.buf = new Array<u8>(16384)
  }

  /** Connects, with a TLS 1.3 handshake offering `h2` when `tls`, and sends the preface and SETTINGS; false when anything went wrong. */
  connect(key: Secret<u8[]>): boolean {
    const addr: u8[] = new Array<u8>(18)
    netAddress(addr, "127.0.0.1", this.tls ? this.server.tlsPort : this.server.h2cPort)
    this.fd = tcpConnect(addr)
    if (this.fd < 0) {
      return false
    }
    if (this.tls && !this.handshake(key)) {
      return false
    }
    const none: i32[] = []
    const noValues: i64[] = []
    this.wire.preface()
    this.wire.settings(none, noValues)
    this.wire.settingsAck()
    this.flush(key)
    return true
  }

  /** The TLS 1.3 handshake of `net_http_server_carriers`' `H2TlsClient`. */
  private handshake(key: Secret<u8[]>): boolean {
    const suite: i32 = TLS_CHACHA20_POLY1305_SHA256
    const hello: u8[] = clientHello(
      [suite],
      [
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519, GROUP_SECP256R1]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [clientShare()]),
        extAlpn([H2_ALPN]),
      ]
    )
    this.send(clearRecord(hello), key)
    const serverHello: u8[] = this.nextRecord(key)
    if (toI32(serverHello.length) < 5) {
      return false
    }
    const helloBody: u8[] = range(serverHello, toI32(5), toI32(serverHello.length))
    const keys = clientKeysFor(32, hello, helloBody)
    const flight: Opened = openOne(protectionFor(suite, keys.serverHandshake), this.nextRecord(key))
    const view = clientFinish(32, hello, helloBody, flight.content, leafPublic())
    this.verified = view.signatureVerifies && view.serverFinishedVerifies
    keys.finishWith(flight.content)
    this.read.install(suite, keys.serverApplication)
    this.write.install(suite, keys.clientApplication)
    this.send(sealOne(protectionFor(suite, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO), key)
    return true
  }

  /** Sends every byte of `bytes`, turning the server's loop while the socket is full. */
  private send(bytes: u8[], key: Secret<u8[]>): void {
    let sent: i32 = 0
    for (let turn: i32 = 0; turn < TURNS && sent < toI32(bytes.length); turn++) {
      const w: i32 = netWrite(this.fd, bytes, sent, toI32(bytes.length) - sent)
      if (w > 0) {
        sent = sent + w
      } else {
        this.server.step(toI32(5), key)
      }
    }
  }

  /** Sends what `wire` holds: as it is in the clear, as one application-data record over TLS. */
  flush(key: Secret<u8[]>): void {
    const bytes: u8[] = this.wire.take()
    this.send(this.tls ? sealOne(this.write, TLS_CONTENT_APPLICATION_DATA, bytes, ZERO) : bytes, key)
  }

  /** Every byte waiting on the socket into `got`; marks `closed` at its end. */
  private drain(): void {
    let n: i32 = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length))
    while (n > 0) {
      for (let k: i32 = 0; k < n; k++) {
        this.got.push(this.buf[k])
      }
      n = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length))
    }
    if (n !== WOULD_BLOCK && n <= 0) {
      this.closed = true
    }
  }

  /** The next whole TLS record, turning the server's loop until it is in; empty if it never comes. */
  private nextRecord(key: Secret<u8[]>): u8[] {
    for (let turn: i32 = 0; turn < TURNS; turn++) {
      const record: u8[] = this.whole()
      if (toI32(record.length) > 0 || this.closed) {
        return record
      }
      this.server.step(toI32(5), key)
      this.drain()
    }
    return []
  }

  /** The whole TLS record at the front of `got`, taken off it; empty when there is none yet. */
  private whole(): u8[] {
    if (toI32(this.got.length) < 5) {
      return []
    }
    const length: i32 = toI32(5) + ((toI32(this.got[3]) << 8) | toI32(this.got[4]))
    if (toI32(this.got.length) < length) {
      return []
    }
    const record: u8[] = range(this.got, ZERO, length)
    this.got = range(this.got, length, toI32(this.got.length))
    return record
  }

  /** One turn of the server's loop, then every frame the server sent into `frames`. */
  turn(key: Secret<u8[]>): void {
    this.server.step(toI32(5), key)
    this.drain()
    if (this.tls) {
      let record: u8[] = this.whole()
      while (toI32(record.length) > 0) {
        const opened: Opened = openOne(this.read, record)
        if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
          this.log.push(opened.content, ZERO, toI32(opened.content.length))
        }
        record = this.whole()
      }
    } else {
      this.log.push(this.got, ZERO, toI32(this.got.length))
      this.got = []
    }
    for (const f of this.log.frames) {
      this.frames.push(f)
    }
    this.log.frames = []
  }

  /** Window the server gave `stream` in the frames since the last call. */
  credit(stream: i32): i32 {
    const prefix: string = `WINDOW_UPDATE ${stream} `
    let n: i32 = 0
    for (; this.scanned < toI32(this.frames.length); this.scanned = this.scanned + 1) {
      const f: string = this.frames[this.scanned]
      if (toI32(f.length) > toI32(prefix.length) && f.substring(0, toI32(prefix.length)) === prefix) {
        n = n + tail(f, toI32(prefix.length))
      }
    }
    return n
  }

  /** Every frame the server sent, joined. */
  text(): string {
    return this.frames.join("; ")
  }

  /** Turns the server's loop until a frame the server sent contains `needle`, or the server closes; whether one did. */
  awaitFrame(needle: string, key: Secret<u8[]>): boolean {
    for (let turn: i32 = 0; turn < TURNS && !this.closed; turn++) {
      if (this.text().indexOf(needle) >= 0) {
        return true
      }
      this.turn(key)
    }
    return this.text().indexOf(needle) >= 0
  }

  /** Opens `stream` as a POST to `path` declaring a body of `length` bytes. */
  open(stream: i32, path: string, length: i32, key: Secret<u8[]>): void {
    this.wire.headers(stream, postOf(path, length), ZERO)
    this.flush(key)
  }

  /**
   * Sends `length` body bytes on `stream`, never past the window the server
   * gave it, ending the stream with the last piece when `end`; whether all
   * of them went before the server stopped answering.
   */
  body(stream: i32, length: i32, end: boolean, key: Secret<u8[]>): boolean {
    let window: i32 = FIRST_WINDOW
    let sent: i32 = 0
    for (let turn: i32 = 0; turn < TURNS && sent < length && !this.closed; turn++) {
      while (sent < length && window > 0) {
        let n: i32 = length - sent
        if (n > PIECE) {
          n = PIECE
        }
        if (n > window) {
          n = window
        }
        const last: boolean = end && sent + n === length
        this.wire.dataN(stream, n, last ? H2_FLAG_END_STREAM : ZERO)
        this.flush(key)
        sent = sent + n
        window = window - n
      }
      this.turn(key)
      window = window + this.credit(stream)
    }
    return sent === length
  }

  /** Sends a trailer section ending `stream`. */
  trailers(stream: i32, key: Secret<u8[]>): void {
    this.wire.headers(stream, ["x-checksum", "1"], H2_FLAG_END_STREAM)
    this.flush(key)
  }

  /** Closes the client's socket. */
  close(): void {
    netClose(this.fd)
  }
}

/** Sends one HTTP/1.1 POST to `path` with a body of `length` bytes and reads until the server's answer has its body; the answer as text. */
export const h1Post = (server: StreamRig, key: Secret<u8[]>, path: string, length: i32): string => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", server.h1Port)
  const fd: i32 = tcpConnect(addr)
  const head: u8[] = ascii(`POST ${path} HTTP/1.1\r\nhost: localhost\r\ncontent-length: ${length}\r\n\r\n`)
  const request: u8[] = new Array<u8>(toI32(head.length) + length)
  for (let k: i32 = 0; k < toI32(head.length); k++) {
    request[k] = head[k]
  }
  let sent: i32 = 0
  const buf: u8[] = new Array<u8>(4096)
  let answer: string = ""
  for (let turn: i32 = 0; turn < TURNS && answer.indexOf("\r\n\r\n") < 0; turn++) {
    if (sent < toI32(request.length)) {
      const w: i32 = netWrite(fd, request, sent, toI32(request.length) - sent)
      if (w > 0) {
        sent = sent + w
      }
    }
    server.step(toI32(5), key)
    let n: i32 = netRead(fd, buf, ZERO, toI32(buf.length))
    while (n > 0) {
      for (let k: i32 = 0; k < n; k++) {
        answer = answer + String.fromCharCode(toI32(buf[k]))
      }
      n = netRead(fd, buf, ZERO, toI32(buf.length))
    }
  }
  netClose(fd)
  const status: i32 = answer.indexOf("\r\n")
  return status < 0 ? answer : answer.substring(0, status)
}
