// The scripted HTTP/2 clients of `tests/link/net_http_server_carriers/client`,
// against a `GrpcRig` in the same process over loopback: its `H2TlsClient`
// (the TLS 1.3 client of `net_http2_tls`, with only the full handshake) and
// its `H2cClient`, with the server's class swapped for this case's rig. Each
// sends, then turns the server's loop until the answer it waits for has come.
import { Secret } from "nish:secret"
import { netAddress, netRead, netWrite, tcpConnect } from "nish:net"
import { TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule"
import { TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE, TlsRecordProtection } from "nish/net/tls/record"
import { TLS_GROUP_X25519, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec"
import { H2_ALPN } from "nish/net/http2-tls"
import { n32 } from "../net_quic_frame/typed"
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
import { Opened, ZERO, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes"
import { clearRecord, clientKeysFor } from "../net_tls_record_common/client"
import { FrameLog, Wire } from "../net_http2/peer"
import { GrpcRig } from "./rig"

/** What `netRead` answers when nothing is waiting. */
const WOULD_BLOCK: i32 = -11

/** The most turns of the server's loop one wait takes, at up to 5 ms each. */
const TURNS: i32 = 2000

/** One HTTP/2 over TLS client: its socket, record keys, and the frames it has read. */
export class H2TlsClient {
  server: GrpcRig
  read: TlsRecordProtection
  write: TlsRecordProtection
  wire: Wire
  log: FrameLog
  got: u8[]
  buf: u8[]
  fd: i32 = -1
  verified: boolean = false
  /** Whether the server has closed its end. */
  closed: boolean = false

  constructor(server: GrpcRig) {
    this.server = server
    this.read = new TlsRecordProtection()
    this.write = new TlsRecordProtection()
    this.wire = new Wire()
    this.log = new FrameLog()
    this.got = []
    this.buf = new Array<u8>(16384)
  }

  /** Sends every byte of `bytes`, turning the server's loop while the socket is full. */
  send(bytes: u8[], key: Secret<u8[]>): void {
    let sent: i32 = 0
    for (let turn: i32 = 0; turn < TURNS && sent < toI32(bytes.length); turn++) {
      const w: i32 = netWrite(this.fd, bytes, sent, toI32(bytes.length) - sent)
      if (w > 0) {
        sent = sent + w
      } else {
        this.server.step(n32(5), key)
      }
    }
  }

  /** The next whole TLS record, turning the server's loop until it is in; empty if it never comes, or the server closed before it was whole. */
  nextRecord(key: Secret<u8[]>): u8[] {
    for (let turn: i32 = 0; turn < TURNS; turn++) {
      if (toI32(this.got.length) >= 5) {
        const length: i32 = n32(5) + ((toI32(this.got[3]) << 8) | toI32(this.got[4]))
        if (toI32(this.got.length) >= length) {
          const record: u8[] = range(this.got, ZERO, length)
          this.got = range(this.got, length, toI32(this.got.length))
          return record
        }
      }
      if (this.closed) {
        break
      }
      this.server.step(n32(5), key)
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
    return []
  }

  /** Connects to `port` and completes a TLS 1.3 handshake offering `h2`; false when anything went wrong. */
  handshake(port: i32, key: Secret<u8[]>): boolean {
    const addr: u8[] = new Array<u8>(18)
    netAddress(addr, "127.0.0.1", port)
    this.fd = tcpConnect(addr)
    if (this.fd < 0) {
      return false
    }
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
    const helloBody: u8[] = range(serverHello, n32(5), toI32(serverHello.length))
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

  /** Seals what `wire` holds into one application-data record and sends it. */
  flush(key: Secret<u8[]>): void {
    this.send(sealOne(this.write, TLS_CONTENT_APPLICATION_DATA, this.wire.take(), ZERO), key)
  }

  /** Reads records until the log holds `n` frames, or the server closes; answers them joined. */
  awaitFrames(n: i32, key: Secret<u8[]>): string {
    while (toI32(this.log.frames.length) < n) {
      const record: u8[] = this.nextRecord(key)
      if (toI32(record.length) === 0) {
        break
      }
      const opened: Opened = openOne(this.read, record)
      if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
        this.log.push(opened.content, ZERO, toI32(opened.content.length))
      }
    }
    return this.log.take()
  }

  /** Reads records until a frame read since the last `take` shows `marker`, or the server closes; answers them joined. */
  awaitText(marker: string, key: Secret<u8[]>): string {
    while (this.log.frames.join("; ").indexOf(marker) < 0) {
      const record: u8[] = this.nextRecord(key)
      if (toI32(record.length) === 0) {
        break
      }
      const opened: Opened = openOne(this.read, record)
      if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
        this.log.push(opened.content, ZERO, toI32(opened.content.length))
      }
    }
    return this.log.take()
  }
}

/** One cleartext HTTP/2 (h2c, prior knowledge) client: frames from `wire` straight onto a TCP socket. */
export class H2cClient {
  server: GrpcRig
  wire: Wire
  log: FrameLog
  buf: u8[]
  fd: i32 = -1
  /** Whether the server has closed its end. */
  closed: boolean = false

  constructor(server: GrpcRig) {
    this.server = server
    this.wire = new Wire()
    this.log = new FrameLog()
    this.buf = new Array<u8>(16384)
  }

  /** Connects to `port`; false when the connect failed. */
  connect(port: i32): boolean {
    const addr: u8[] = new Array<u8>(18)
    netAddress(addr, "127.0.0.1", port)
    this.fd = tcpConnect(addr)
    return this.fd >= 0
  }

  /** Sends what `wire` holds, turning the server's loop while the socket is full. */
  flush(key: Secret<u8[]>): void {
    const bytes: u8[] = this.wire.take()
    let sent: i32 = 0
    for (let turn: i32 = 0; turn < TURNS && sent < toI32(bytes.length); turn++) {
      const w: i32 = netWrite(this.fd, bytes, sent, toI32(bytes.length) - sent)
      if (w > 0) {
        sent = sent + w
      } else {
        this.server.step(n32(5), key)
      }
    }
  }

  /** One turn of the server's loop, then every byte waiting on the socket into the log; marks `closed` at its end. */
  turn(key: Secret<u8[]>): void {
    this.server.step(n32(5), key)
    let n: i32 = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length))
    while (n > 0) {
      this.log.push(this.buf, ZERO, n)
      n = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length))
    }
    if (n !== WOULD_BLOCK && n <= 0) {
      this.closed = true
    }
  }

  /** Turns the server's loop until the log holds `n` frames, or the server closes; answers them joined. */
  awaitFrames(n: i32, key: Secret<u8[]>): string {
    for (let turn: i32 = 0; turn < TURNS && toI32(this.log.frames.length) < n && !this.closed; turn++) {
      this.turn(key)
    }
    return this.log.take()
  }

  /** Turns the server's loop until a frame read since the last `take` shows `marker`, or the server closes; answers them joined. */
  awaitText(marker: string, key: Secret<u8[]>): string {
    for (let turn: i32 = 0; turn < TURNS && this.log.frames.join("; ").indexOf(marker) < 0 && !this.closed; turn++) {
      this.turn(key)
    }
    return this.log.take()
  }
}

/** One HTTP/1.1 client: raw bytes onto a TCP socket, and what comes back as text. */
export class H1Client {
  server: GrpcRig
  buf: u8[]
  got: string = ""
  fd: i32 = -1

  constructor(server: GrpcRig) {
    this.server = server
    this.buf = new Array<u8>(4096)
  }

  /** Connects to `port` and sends `request`; false when the connect failed. */
  send(port: i32, request: string, key: Secret<u8[]>): boolean {
    const addr: u8[] = new Array<u8>(18)
    netAddress(addr, "127.0.0.1", port)
    this.fd = tcpConnect(addr)
    if (this.fd < 0) {
      return false
    }
    const bytes: u8[] = []
    for (let k: i32 = 0; k < toI32(request.length); k++) {
      bytes.push(toU8(request.charCodeAt(k)))
    }
    let sent: i32 = 0
    for (let turn: i32 = 0; turn < TURNS && sent < toI32(bytes.length); turn++) {
      const w: i32 = netWrite(this.fd, bytes, sent, toI32(bytes.length) - sent)
      if (w > 0) {
        sent = sent + w
      } else {
        this.server.step(n32(5), key)
      }
    }
    return true
  }

  /** Turns the server's loop until the text read so far holds `marker`, or the server closes; answers it. */
  await(marker: string, key: Secret<u8[]>): string {
    for (let turn: i32 = 0; turn < TURNS && this.got.indexOf(marker) < 0; turn++) {
      this.server.step(n32(5), key)
      let n: i32 = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length))
      while (n > 0) {
        for (let k: i32 = 0; k < n; k++) {
          this.got = this.got + String.fromCharCode(toI32(this.buf[k]))
        }
        n = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length))
      }
      if (n !== WOULD_BLOCK && n <= 0) {
        break
      }
    }
    return this.got
  }
}
