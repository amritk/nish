// A TLS 1.3 client for `net_http_server_h1_tls`, against a `Rig` in the same
// process over loopback: the handshake of `tests/link/net_http_server_carriers`'s
// `H2TlsClient` (from `net_tls_common`, records of `net_tls_record_common`),
// offering the ALPN names it is given, with HTTP/1.1 bytes inside its
// application-data records. Each call sends, then turns the server's loop
// until the answer it waits for has come.
import { Secret } from "nish:secret"
import { netAddress, netClose, netRead, netWrite, tcpConnect } from "nish:net"
import { TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule"
import { TLS_CONTENT_ALERT, TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE, TlsRecordProtection } from "nish/net/tls/record"
import { TLS_GROUP_X25519, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec"
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
import { textOf } from "../crypto_x509/hex"
import { headerOf } from "../net_serve/client"
import { Rig } from "./rig"

/** What `netRead` answers when nothing is waiting. */
const WOULD_BLOCK: i32 = -11

/** The most turns of the server's loop one wait takes, at up to 5 ms each. */
const TURNS: i32 = 2000

/** The decimal value of `head`'s Content-Length field; 0 with none. */
const contentLength = (head: string): i32 => {
  const field: string = headerOf(head, "content-length")
  let n: i32 = 0
  for (let k: i32 = 0; k < toI32(field.length); k++) {
    const c: i32 = toI32(field.charCodeAt(k))
    if (c < 48 || c > 57 || n > 100000000) {
      break
    }
    n = n * 10 + (c - 48)
  }
  return n
}

/** An HTTP/1.1 client over TLS 1.3 on one connection. */
export class H1TlsClient {
  server: Rig
  read: TlsRecordProtection
  write: TlsRecordProtection
  /** Bytes read off the socket and not yet taken as a record. */
  got: u8[]
  buf: u8[]
  /** The plaintext of every application-data record not yet taken as a response. */
  plain: u8[]
  /** Each alert the server sent, as `level description`, cleartext or sealed. */
  alerts: string[]
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
    this.alerts = []
  }

  /** Sends every byte of `bytes`, turning the server's loop while the socket is full. */
  send(bytes: u8[], key: Secret<u8[]>): void {
    let sent: i32 = 0
    for (let turn: i32 = 0; turn < TURNS && sent < toI32(bytes.length); turn++) {
      const w: i32 = netWrite(this.fd, bytes, sent, toI32(bytes.length) - sent)
      if (w > 0) {
        sent = sent + w
      } else {
        this.server.step(5, key)
      }
    }
  }

  /** The next whole TLS record, turning the server's loop until it is in; empty if it never comes, or the server closed before it was whole. */
  nextRecord(key: Secret<u8[]>): u8[] {
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
      this.server.step(5, key)
      let n: i32 = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length))
      while (n > 0) {
        for (let k: i32 = 0; k < n; k++) {
          this.got.push(this.buf[k])
        }
        n = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length))
      }
      // The records read before the end are still taken, on the next turn.
      if (n !== WOULD_BLOCK && n <= 0) {
        this.closed = true
      }
    }
    return []
  }

  /**
   * Connects to `port` and sends a TLS 1.3 ClientHello offering `alpn` (none
   * when empty). Completes the handshake and answers true when the server
   * answers with a ServerHello; when it answers with an alert, keeps it in
   * `alerts` and answers false, as for anything else that went wrong.
   */
  handshake(port: i32, alpn: string[], key: Secret<u8[]>): boolean {
    const addr: u8[] = new Array<u8>(18)
    netAddress(addr, "127.0.0.1", port)
    this.fd = tcpConnect(addr)
    if (this.fd < 0) {
      return false
    }
    const suite: i32 = TLS_CHACHA20_POLY1305_SHA256
    const extensions: u8[][] = [
      extSupportedVersions([TLS_VERSION_13]),
      extSupportedGroups([TLS_GROUP_X25519, GROUP_SECP256R1]),
      extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
      extKeyShare([TLS_GROUP_X25519], [clientShare()]),
    ]
    if (toI32(alpn.length) > 0) {
      extensions.push(extAlpn(alpn))
    }
    const hello: u8[] = clientHello([suite], extensions)
    this.send(clearRecord(hello), key)
    const serverHello: u8[] = this.nextRecord(key)
    if (toI32(serverHello.length) === 7 && toI32(serverHello[0]) === toI32(TLS_CONTENT_ALERT)) {
      this.alerts.push(`${serverHello[5]} ${serverHello[6]}`)
      return false
    }
    if (toI32(serverHello.length) < 5) {
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

  /** Seals `text` into one application-data record and sends it. */
  request(text: string, key: Secret<u8[]>): void {
    this.send(sealOne(this.write, TLS_CONTENT_APPLICATION_DATA, ascii(text), ZERO), key)
  }

  /** Opens the next record into `plain` or `alerts`; false when none came. */
  private take(key: Secret<u8[]>): boolean {
    const record: u8[] = this.nextRecord(key)
    if (toI32(record.length) === 0) {
      return false
    }
    const opened: Opened = openOne(this.read, record)
    const c: u8[] = opened.content
    if (opened.type === TLS_CONTENT_ALERT && toI32(c.length) === 2) {
      this.alerts.push(`${c[0]} ${c[1]}`)
    } else if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
      for (const b of c) {
        this.plain.push(b)
      }
    }
    return true
  }

  /**
   * The next whole response, head and `content-length` body, as text; empty
   * when the server closed or sent nothing before one was whole.
   */
  response(key: Secret<u8[]>): string {
    for (let turn: i32 = 0; turn < 64; turn++) {
      const text: string = textOf(this.plain)
      const end: i32 = toI32(text.indexOf("\r\n\r\n"))
      if (end >= 0) {
        const length: i32 = contentLength(text.slice(0, end))
        const whole: i32 = end + 4 + length
        if (toI32(text.length) >= whole) {
          this.plain = range(this.plain, whole, toI32(this.plain.length))
          return text.slice(0, whole)
        }
      }
      if (!this.take(key)) {
        return ""
      }
    }
    return ""
  }

  /**
   * Reads until the server closes, one buffer a turn, keeping the alerts and
   * the first 1024 plaintext bytes in `plain` and counting the rest: how many
   * application-data bytes came. A large response is read as slowly as the
   * loop turns, so the server's socket stays full until its last record.
   */
  count(key: Secret<u8[]>): i32 {
    let total: i32 = 0
    let at: i32 = 0
    for (let turn: i32 = 0; turn < 200000; turn++) {
      const held: i32 = toI32(this.got.length) - at
      const length: i32 = held >= 5 ? 5 + ((toI32(this.got[at + 3]) << 8) | toI32(this.got[at + 4])) : 0
      if (held >= 5 && held >= length) {
        const opened: Opened = openOne(this.read, range(this.got, at, at + length))
        const c: u8[] = opened.content
        if (opened.type === TLS_CONTENT_ALERT && toI32(c.length) === 2) {
          this.alerts.push(`${c[0]} ${c[1]}`)
        } else if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
          for (let k: i32 = 0; k < toI32(c.length) && toI32(this.plain.length) < 1024; k++) {
            this.plain.push(c[k])
          }
          total = total + toI32(c.length)
        }
        at = at + length
      } else if (this.closed) {
        break
      } else {
        this.got = range(this.got, at, toI32(this.got.length))
        at = 0
        this.server.step(1, key)
        const n: i32 = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length))
        for (let k: i32 = 0; k < n; k++) {
          this.got.push(this.buf[k])
        }
        if (n !== WOULD_BLOCK && n <= 0) {
          this.closed = true
        }
      }
    }
    return total
  }

  /** Closes the client's end, as a client does once the server has closed its own; a lingering server slot is then done. */
  hangUp(): void {
    if (this.fd >= 0) {
      netClose(this.fd)
      this.fd = -1
    }
  }

  /** Reads until the server closes, keeping what it sends; whether it closed within the turns. */
  untilClosed(key: Secret<u8[]>): boolean {
    for (let turn: i32 = 0; turn < 64 && this.take(key); turn++) {
      // Each record taken goes to `plain` or `alerts`.
    }
    return this.closed
  }
}
