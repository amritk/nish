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
 * **Slots, a cap; buffers, borrowed.** The constructor makes the TLS pool
 * and slot 0's connection, but no other slot's and no frame buffer: a slot's
 * connection is made by the first `accept` into it and kept, so a pool sized
 * for its peak costs at start-up only what does not depend on the size, and
 * holds at most `size` connections once the peak has come. A connection
 * borrows its input, output and header-block buffers from the
 * server's `Http2Pools` when it first needs each, and gives each back once it
 * is empty and when the slot closes, so a free or idle slot holds none. A
 * slot whose handshake is not done holds one output buffer, its SETTINGS
 * written and waiting on TLS, until the handshake ends or the slot closes:
 * one client that stalls its handshake keeps one buffer, as it kept a whole
 * slot before (`docs/security/tls.md`, TLS-4). Each pool's ceiling is the
 * slot count, so a borrow never fails. `accept` resets
 * the slot's connection, and once the pools are warm nothing a connection
 * does allocates but a header block's HPACK decoding (`docs/security/http2.md`,
 * H2-1). The caps are the `Http2Config`'s, one for every slot, so a program
 * sets them once.
 *
 * **The Date.** Every final response carries one `date` field (RFC 9110
 * §6.6.1) from the pool's `HttpDate`, which formats the IMF-fixdate at most
 * once a second for every slot; a 1xx and trailers carry none, and a program
 * that sends its own `date` sends that one instead. `server.date.pin(unixMs)`
 * fixes it, for a test that compares bytes.
 *
 * Written from RFC 9113 §3 and §9.2, not ported from another implementation.
 */
import { Secret } from "nish:secret"
import { HttpDate } from "nish/net/http1-server"
import { H2_ERROR, H2_NEED_MORE, Http2Config, Http2Connection, Http2Pools } from "nish/net/http2"
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
  /** The caps every slot's connection is made under. */
  config: Http2Config
  /**
   * The connections made so far, slot `k`'s at `k`: slot 0's, made by the
   * constructor, and one for each slot accepted into since.
   */
  connections: Http2Connection[]
  /**
   * The `date` every slot's responses carry, formatted once a second for all
   * of them: each slot's `Http2Connection.date` is its bytes, refreshed by
   * `connection` and `next`. `date.pin` fixes its clock.
   */
  date: HttpDate
  /** The frame buffers every slot's connection borrows: one of each per slot at most, none made up front. */
  readonly pools: Http2Pools

  /**
   * A pool of `size` slots, at least one, serving HTTP/2 under `config` over
   * TLS under `tlsConfig` on `listener`. Only slot 0's connection is made
   * here, so a config it refuses panics now, with its words; every other
   * slot's is made by the first `accept` into it and kept. Frame buffers are
   * borrowed from `pools` as a connection needs them.
   */
  constructor(tlsConfig: TlsServerConfig, config: Http2Config, listener: i32, size: i32) {
    this.tls = new TlsTcpServer(tlsConfig, listener, size)
    this.config = config
    this.connections = []
    this.date = new HttpDate()
    // Formatted once now, so no slot ever sends the bytes before a first format.
    const first: Http2Connection = new Http2Connection(config)
    first.date = this.date.current()
    this.connections.push(first)
    // After slot 0's connection, so a config it refuses panics with its words.
    this.pools = new Http2Pools("Http2TlsServer", config, this.tls.size())
    first.pools = this.pools
  }

  /** A new connection on this pool's buffers and `date`, for the next slot made. */
  build(): Http2Connection {
    const conn: Http2Connection = new Http2Connection(this.config)
    conn.date = this.date.current()
    conn.pools = this.pools
    this.connections.push(conn)
    return conn
  }

  /** Whether `slot` holds a connection and its HTTP/2 side has been made. */
  live(slot: i32): boolean {
    return this.tls.holds(slot) && slot < toI32(this.connections.length)
  }

  /** How many slots the pool has, made or not. */
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

  /**
   * The HTTP/2 connection of `slot`, its `date` brought up to now. A slot
   * never accepted into, or out of range, names slot 0's, which may be live.
   */
  connection(slot: i32): Http2Connection {
    this.date.current()
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
   * SETTINGS go out once the handshake is done: the slot's own, restarted,
   * or one made now if this is the first accept into it. Answers the slot,
   * or what `TlsTcpServer.accept` answers.
   */
  accept(serverRandom: u8[], ephemeralPrivate: u8[]): i32 {
    const slot: i32 = this.tls.accept(serverRandom, ephemeralPrivate)
    if (slot < 0 || slot >= this.tls.size()) {
      return slot
    }
    // `TlsTcpServer` hands out its lowest slots first, so this makes one
    // connection, unless a program accepted on `tls` itself.
    while (toI32(this.connections.length) <= slot) {
      this.build()
    }
    this.connections[slot].restart()
    return slot
  }

  /** The socket of `slot` is readable: TLS reads it, and what HTTP/2 has to send goes after. Answers the interest. */
  readable(slot: i32): i32 {
    this.tls.readable(slot)
    const wants: i32 = this.flush(slot)
    this.rest(slot)
    return wants
  }

  /** The socket of `slot` is writable. Answers the interest. */
  writable(slot: i32): i32 {
    this.tls.writable(slot)
    const wants: i32 = this.flush(slot)
    this.rest(slot)
    return wants
  }

  /** Signs `slot`'s CertificateVerify with `key`, as `TlsTcpServer.signP256` does. Answers the interest. */
  signP256(slot: i32, key: Secret<u8[]>): i32 {
    this.tls.signP256(slot, key)
    const wants: i32 = this.flush(slot)
    this.rest(slot)
    return wants
  }

  /** Whether `slot`'s handshake is done and chose anything but `h2`. */
  refused(slot: i32): boolean {
    return this.tls.connection(slot).state === TLS_RECORD_STATE_OPEN && this.alpn(slot) !== H2_ALPN
  }

  /**
   * Moves what TLS has decrypted for `slot` into its connection, as far as
   * the connection has room, and answers the connection's next event. A free
   * slot, or one whose ALPN was not `h2`, answers `H2_ERROR`.
   */
  next(slot: i32): i32 {
    if (!this.live(slot) || this.refused(slot)) {
      return H2_ERROR
    }
    this.date.current()
    const conn: Http2Connection = this.connections[slot]
    // TLS decrypts straight into the connection's input, so a byte is
    // copied once on its way in.
    while (!conn.inputEnded) {
      const room: i32 = conn.inputTail()
      if (room <= 0) {
        break
      }
      const n: i32 = this.tls.read(slot, conn.input, conn.inputEnd, room)
      if (n === 0) {
        conn.endInput()
      }
      if (n <= 0) {
        break
      }
      conn.received(n)
    }
    const event: i32 = conn.next()
    // What the program answers to one event and the next shares a record:
    // the connection's output goes to TLS only once it stalls or ends, and
    // the program's own `flush` after the loop.
    if (event === H2_NEED_MORE || event === H2_ERROR) {
      this.flush(slot)
      this.rest(slot)
    }
    return event
  }

  /**
   * Writes what `slot`'s connection holds into TLS, as far as TLS takes it,
   * and sends it; shuts TLS down once the connection is over, the peer's
   * stream has ended, or ALPN chose another protocol. Answers the interest,
   * with the write bit while the connection still holds bytes.
   */
  flush(slot: i32): i32 {
    if (!this.live(slot)) {
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
    if (conn.isDone()) {
      return this.tls.shutdown(slot)
    }
    const wants: i32 = this.tls.interest(slot)
    return conn.wantsWrite() && (wants & TLS_RECORD_DONE) === 0 ? wants | TLS_RECORD_WANT_WRITE : wants
  }

  /**
   * Ends `slot`'s connection and frees the slot at once, as
   * `TlsTcpServer.close` does; the connection gives back every buffer it holds.
   */
  close(slot: i32): void {
    if (slot >= 0 && slot < toI32(this.connections.length)) {
      this.connections[slot].drop()
    }
    this.tls.close(slot)
  }

  /** Gives back the buffers `slot`'s connection holds and has emptied, so an idle slot holds none. */
  rest(slot: i32): void {
    if (slot >= 0 && slot < toI32(this.connections.length)) {
      this.connections[slot].rest()
    }
  }
}
