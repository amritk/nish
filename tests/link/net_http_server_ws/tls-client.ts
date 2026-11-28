// A WebSocket client over TLS 1.3 for `net_http_server_ws`, against a `Rig`'s
// `listenTls` listener in the same process over loopback: the handshake of
// `tests/link/net_http_server_h1_tls`'s `H1TlsClient` (from `net_tls_common`,
// records of `net_tls_record_common`), offering http/1.1, then the opening
// handshake and masked frames inside its application-data records, and the
// server's frames read from their plaintext with `nish/net/websocket`'s
// decoder. Each call sends, then turns the server's loop until the answer it
// waits for has come.
import { Secret } from "nish:secret"
import { netAddress, netClose, netRead, netWrite, tcpConnect } from "nish:net"
import { H1_ALPN } from "nish/net/http1-server"
import { TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule"
import { TLS_CONTENT_ALERT, TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE, TlsRecordProtection } from "nish/net/tls/record"
import { TLS_GROUP_X25519, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec"
import { WS_NEED_MORE, WsDecoder } from "nish/net/websocket"
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
import { textAt } from "../net_http2/peer"
import { TURNS, clientFrame, handshake } from "./client"
import { Rig } from "./rig"

/** What `netRead` answers when nothing is waiting. */
const WOULD_BLOCK: i32 = -11

/** A WebSocket client over TLS 1.3 on one connection. */
export class WsTlsClient {
  server: Rig
  read: TlsRecordProtection
  write: TlsRecordProtection
  /** Bytes read off the socket and not yet taken as a record. */
  got: u8[]
  buf: u8[]
  /** The plaintext of the application-data records before the response head ended. */
  plain: u8[]
  dec: WsDecoder
  fd: i32 = -1
  verified: boolean = false
  /** Whether the server has closed its end. */
  closed: boolean = false

  constructor(server: Rig) {
    this.server = server
    this.read = new TlsRecordProtection()
    this.write = new TlsRecordProtection()
    this.got = []
    this.buf = new Array<u8>(16384)
    this.plain = []
    this.dec = new WsDecoder(false, 16777216)
  }

  /** Sends every byte of `bytes`, turning the server's loop while the socket is full. */
  private send(bytes: u8[], key: Secret<u8[]>): void {
    let sent: i32 = 0
    for (let turn: i32 = 0; turn < TURNS && sent < toI32(bytes.length); turn++) {
      const w: i32 = netWrite(this.fd, bytes, sent, toI32(bytes.length) - sent)
      if (w > 0) {
        sent = sent + w
      } else {
        this.server.stepSigned(5, key)
      }
    }
  }

  /** The next whole TLS record, turning the server's loop until it is in; empty if it never comes, or the server closed before it was whole. */
  private nextRecord(key: Secret<u8[]>): u8[] {
    for (let turn: i32 = 0; turn < TURNS; turn++) {
      if (toI32(this.got.length) >= 5) {
        const length: i32 = 5 + ((toI32(this.got[3]) << 8) | toI32(this.got[4]))
        if (toI32(this.got.length) >= length) {
          const record: u8[] = range(this.got, ZERO, length)
          this.got = range(this.got, length, toI32(this.got.length))
          return record
        }
      }
      if (this.closed) {
        break
      }
      this.server.stepSigned(5, key)
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

  /** Connects to `port` and completes a TLS 1.3 handshake offering http/1.1; false when the server did not answer with a ServerHello. */
  connect(port: i32, key: Secret<u8[]>): boolean {
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
        extAlpn([H1_ALPN]),
      ]
    )
    this.send(clearRecord(hello), key)
    const serverHello: u8[] = this.nextRecord(key)
    if (toI32(serverHello.length) < 5 || toI32(serverHello[0]) === toI32(TLS_CONTENT_ALERT)) {
      return false
    }
    const helloBody: u8[] = range(serverHello, 5, toI32(serverHello.length))
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

  /** Seals `bytes` into one application-data record and sends it. */
  private seal(bytes: u8[], key: Secret<u8[]>): void {
    this.send(sealOne(this.write, TLS_CONTENT_APPLICATION_DATA, bytes, ZERO), key)
  }

  /** Opens the next record's application data into `into`; false when none came. */
  private take(into: u8[], key: Secret<u8[]>): boolean {
    const record: u8[] = this.nextRecord(key)
    if (toI32(record.length) === 0) {
      return false
    }
    const opened: Opened = openOne(this.read, record)
    if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
      for (const b of opened.content) {
        into.push(b)
      }
    }
    return true
  }

  /** Sends the opening handshake for `target`; the response head, or "" when none came. What follows the head goes to the decoder. */
  open(target: string, key: Secret<u8[]>): string {
    this.seal(handshake(target), key)
    for (let turn: i32 = 0; turn < 64; turn++) {
      const p: u8[] = this.plain
      for (let k: i32 = 3; k < toI32(p.length); k++) {
        if (p[k - 3] === toU8(13) && p[k - 2] === toU8(10) && p[k - 1] === toU8(13) && p[k] === toU8(10)) {
          if (k + 1 < toI32(p.length)) {
            this.dec.feed(p, k + 1, toI32(p.length) - k - 1)
          }
          this.plain = []
          return textAt(p, 0, k + 1)
        }
      }
      if (!this.take(this.plain, key)) {
        return ""
      }
    }
    return ""
  }

  /** Sends one masked frame. */
  frame(fin: boolean, opcode: i32, payload: u8[], key: Secret<u8[]>): void {
    this.seal(clientFrame(fin, opcode, payload, true), key)
  }

  /** The next event the decoder reads, opening records until one is whole; `WS_NEED_MORE` when the connection ended first. */
  next(key: Secret<u8[]>): i32 {
    let event: i32 = this.dec.next()
    for (let turn: i32 = 0; turn < 64 && event === WS_NEED_MORE; turn++) {
      const data: u8[] = []
      if (!this.take(data, key)) {
        break
      }
      if (toI32(data.length) > 0) {
        this.dec.feed(data, 0, toI32(data.length))
      }
      event = this.dec.next()
    }
    return event
  }

  /** Reads records until the server closes; whether it closed within the turns. */
  awaitClose(key: Secret<u8[]>): boolean {
    const rest: u8[] = []
    for (let turn: i32 = 0; turn < 64 && this.take(rest, key); turn++) {
      // A close_notify or what is left of the stream; the end is what counts.
    }
    return this.closed
  }

  /** Closes the client's end, as a client does once the server has closed its own; a lingering server slot is then done. */
  hangUp(): void {
    if (this.fd >= 0) {
      netClose(this.fd)
      this.fd = -1
    }
  }
}
