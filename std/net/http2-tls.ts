/**
 * `nish/net/http2-tls` — HTTP/2 over TLS 1.3 on TCP: a pool of
 * `Http2Connection`s, one beside each slot of a `TlsTcpServer`, for a
 * program that owns its readiness loop.
 *
 *     const listener = tcpListen("0.0.0.0", 8443, 128);
 *     const server = new Http2TlsServer(tlsConfig, new Http2Config(), listener, 64);
 *     // tlsConfig.alpn holds "h2"
 *     // when the listener is readable:
 *     const slot: i32 = server.accept(serverRandom, ephemeralKey);
 *     if (slot >= 0) { pollAdd(loop, server.fd(slot), 1, slot); }
 *     // when a connection's token comes back:
 *     let wants: i32 = (events & 5) !== 0 ? server.readable(slot) : server.writable(slot);
 *     if ((wants & TLS_RECORD_SIGN) !== 0) { server.signP256(slot, leafKey); }
 *     let event: i32 = server.next(slot);
 *     while (event !== H2_NEED_MORE && event !== H2_ERROR) {
 *       const conn: Http2Connection = server.connection(slot);
 *       // H2_REQUEST: conn.respond(conn.stream, 200, names, values, false) ...
 *       event = server.next(slot);
 *     }
 *     wants = server.flush(slot);
 *     if ((wants & TLS_RECORD_DONE) !== 0) { server.close(slot); }
 *     else { pollModify(loop, server.fd(slot), wants & 3, slot); }
 *
 * It is `nish/net/tls-tcp`'s loop with one step added: `next` moves what TLS
 * has decrypted into the slot's connection and answers the connection's next
 * event, and `flush` moves what the connection wrote into TLS and on to the
 * socket. Every call answers the TLS slot's interest, whose low two bits are
 * the events `pollModify` takes. A connection whose input buffer is full
 * stops reading TLS, TLS then stops asking for the socket to be read, and the
 * peer's TCP window closes: back-pressure goes all the way down.
 *
 * **ALPN.** RFC 9113 §3.2 runs HTTP/2 over TLS only when ALPN chose `h2`. A
 * slot whose handshake ends with any other protocol, or none, is shut down
 * with TLS's `close_notify` and never reaches its connection; the program's
 * configuration offers `h2` (and may offer `http/1.1` beside it, for a
 * program that serves both and calls `alpn(slot)` itself).
 *
 * **Slots, sized at start-up.** The constructor makes every connection and
 * the TLS pool beside them; `accept` resets the slot's connection, and
 * nothing a connection does after that allocates but a header block's HPACK
 * decoding (`docs/security/http2.md`, H2-1). The caps are the
 * `Http2Config`'s, one for every slot, so a program sets them once.
 *
 * Written from RFC 9113 §3 and §9.2, not ported from another implementation.
 */
import { Secret } from "nish:secret"
import { H2_ERROR, Http2Config, Http2Connection } from "nish/net/http2"
import { TlsServerConfig } from "nish/net/tls"
import { TLS_RECORD_DONE, TLS_RECORD_STATE_OPEN, TLS_RECORD_WANT_WRITE } from "nish/net/tls/record-server"
import { TlsTcpServer } from "nish/net/tls-tcp"

/** A typed zero: a bare literal is an `f64` under `--number-mode f64`. */
const H2_TLS_ZERO: i32 = 0

/** The ALPN protocol identifier of HTTP/2 over TLS (RFC 9113 §3.2). */
export const H2_ALPN: string = "h2"

/**
 * A pool of HTTP/2 connections over TLS on one listening socket. `slot`s are
 * `TlsTcpServer`'s, and `connection(slot)` is the HTTP/2 side of each.
 */
export class Http2TlsServer {
  tls: TlsTcpServer
  config: Http2Config
  connections: Http2Connection[]
  /** Where decrypted bytes are read before the connection takes them: one frame. */
  scratch: u8[]
  /** Whether each slot's TLS stream has ended, so its connection will get no more. */
  ended: boolean[]

  /**
   * A pool of `size` slots, at least one, serving HTTP/2 under `config` over
   * TLS under `tlsConfig` on `listener`. Every slot's buffers are allocated
   * here.
   */
  constructor(tlsConfig: TlsServerConfig, config: Http2Config, listener: i32, size: i32) {
    this.tls = new TlsTcpServer(tlsConfig, listener, size)
    this.config = config
    this.connections = []
    this.ended = []
    for (let k: i32 = 0; k < this.tls.size(); k++) {
      this.connections.push(new Http2Connection(config))
      this.ended.push(false)
    }
    this.scratch = new Array<u8>(config.maxFrameSize)
  }

  /** How many slots the pool has. */
  size(): i32 {
    return this.tls.size()
  }

  /** How many slots hold a connection. */
  busy(): i32 {
    return this.tls.busy()
  }

  /** Whether `slot` holds a connection. */
  holds(slot: i32): boolean {
    return this.tls.holds(slot)
  }

  /** The descriptor of `slot`, for `pollAdd`; -1 for a free one. */
  fd(slot: i32): i32 {
    return this.tls.fd(slot)
  }

  /** The HTTP/2 connection of `slot`; a slot out of range names the first. */
  connection(slot: i32): Http2Connection {
    const at: i32 = slot >= 0 && slot < toI32(this.connections.length) ? slot : H2_TLS_ZERO
    return this.connections[at]
  }

  /** The ALPN protocol `slot`'s handshake chose, or empty. */
  alpn(slot: i32): string {
    return this.tls.connection(slot).tls.alpn
  }

  /**
   * Accepts the next waiting connection into a free slot, as
   * `TlsTcpServer.accept` does, and gives it a fresh HTTP/2 connection whose
   * SETTINGS go out once the handshake is done. Answers the slot, or what
   * `TlsTcpServer.accept` answers.
   */
  accept(serverRandom: u8[], ephemeralPrivate: u8[]): i32 {
    const slot: i32 = this.tls.accept(serverRandom, ephemeralPrivate)
    if (slot >= 0 && slot < toI32(this.connections.length)) {
      this.connections[slot].restart()
      this.ended[slot] = false
    }
    return slot
  }

  /** The socket of `slot` is readable: TLS reads it, and what HTTP/2 has to send goes after. Answers the interest. */
  readable(slot: i32): i32 {
    this.tls.readable(slot)
    return this.flush(slot)
  }

  /** The socket of `slot` is writable. Answers the interest. */
  writable(slot: i32): i32 {
    this.tls.writable(slot)
    return this.flush(slot)
  }

  /** Signs `slot`'s CertificateVerify with `key`, as `TlsTcpServer.signP256` does. Answers the interest. */
  signP256(slot: i32, key: Secret<u8[]>): i32 {
    this.tls.signP256(slot, key)
    return this.flush(slot)
  }

  /** Whether `slot`'s handshake is done and chose anything but `h2`. */
  refused(slot: i32): boolean {
    const record = this.tls.connection(slot)
    return record.state === TLS_RECORD_STATE_OPEN && record.tls.alpn !== H2_ALPN
  }

  /**
   * Moves what TLS has decrypted for `slot` into its connection, as far as
   * the connection has room, and answers the connection's next event. A free
   * slot, or one whose ALPN was not `h2`, answers `H2_ERROR`.
   */
  next(slot: i32): i32 {
    if (!this.holds(slot) || this.refused(slot)) {
      return H2_ERROR
    }
    const conn: Http2Connection = this.connections[slot]
    while (!this.ended[slot]) {
      const room: i32 = conn.inputRoom()
      const want: i32 = room < toI32(this.scratch.length) ? room : toI32(this.scratch.length)
      if (want <= 0) {
        break
      }
      const n: i32 = this.tls.read(slot, this.scratch, H2_TLS_ZERO, want)
      if (n === 0) {
        this.ended[slot] = true
      }
      if (n <= 0) {
        break
      }
      conn.feed(this.scratch, H2_TLS_ZERO, n)
    }
    const event: i32 = conn.next()
    this.flush(slot)
    return event
  }

  /**
   * Writes what `slot`'s connection holds into TLS, as far as TLS takes it,
   * and sends it; shuts TLS down once the connection is over, the peer's
   * stream has ended, or ALPN chose another protocol. Answers the interest,
   * with the write bit while the connection still holds bytes.
   */
  flush(slot: i32): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
    }
    if (this.refused(slot)) {
      return this.tls.shutdown(slot)
    }
    const conn: Http2Connection = this.connections[slot]
    while (conn.wantsWrite()) {
      const n: i32 = this.tls.write(slot, conn.output, conn.outputStart, conn.outputEnd - conn.outputStart)
      if (n <= 0) {
        break
      }
      conn.consume(n)
    }
    if (conn.isDone() || (this.ended[slot] && !conn.wantsWrite())) {
      return this.tls.shutdown(slot)
    }
    const wants: i32 = this.tls.interest(slot)
    return conn.wantsWrite() && (wants & TLS_RECORD_DONE) === 0 ? wants | TLS_RECORD_WANT_WRITE : wants
  }

  /** Ends `slot`'s connection and frees the slot at once, as `TlsTcpServer.close` does. */
  close(slot: i32): void {
    this.tls.close(slot)
  }
}
