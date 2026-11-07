/**
 * `nish/net/http2-tls` — HTTP/2 over TLS 1.3 on TCP: a pool of
 * `Http2Connection`s, one beside each slot of a `TlsTcpServer`, for a
 * program that owns its readiness loop. Slot 0's connection is built with the
 * server, so a bad `Http2Config` is refused there; every other slot's is built
 * on the first accept into it.
 *
 *     import { Secret } from "nish:secret";
 *     import { pollAdd, pollModify, tcpListen } from "nish:net";
 *     import { H2_ERROR, H2_NEED_MORE, H2_REQUEST, Http2Config, Http2Connection } from "nish/net/http2";
 *     import { Http2TlsServer } from "nish/net/http2-tls";
 *     import { TlsServerConfig } from "nish/net/tls";
 *     import { TLS_RECORD_DONE, TLS_RECORD_SIGN } from "nish/net/tls/record-server";
 *
 *     // `tlsConfig.alpn` holds `H2_ALPN`; `loop` is the program's, from `pollCreate`.
 *     const LISTENER: i32 = 64; // past every slot's token
 *     const start = (loop: i32, tlsConfig: TlsServerConfig): Http2TlsServer => {
 *       const listener: i32 = tcpListen("0.0.0.0", 8443, 128);
 *       pollAdd(loop, listener, 1, LISTENER);
 *       return new Http2TlsServer(tlsConfig, new Http2Config(), listener, 64);
 *     };
 *     // When the listener's token comes back:
 *     const admit = (loop: i32, server: Http2TlsServer, random: u8[], key: u8[]): void => {
 *       crypto.getRandomValues(random);
 *       crypto.getRandomValues(key);
 *       const slot: i32 = server.accept(random, key);
 *       if (slot >= 0) { pollAdd(loop, server.fd(slot), 1, slot); }
 *     };
 *     // When a slot's token comes back with `events`:
 *     const serve = (loop: i32, server: Http2TlsServer, slot: i32, events: i32, key: Secret<u8[]>): void => {
 *       let wants: i32 = (events & 5) !== 0 ? server.readable(slot) : server.writable(slot);
 *       if ((wants & TLS_RECORD_SIGN) !== 0) { wants = server.signP256(slot, key); }
 *       const none: u8[][] = [];
 *       let event: i32 = server.next(slot);
 *       while (event !== H2_NEED_MORE && event !== H2_ERROR) {
 *         const conn: Http2Connection = server.connection(slot);
 *         if (event === H2_REQUEST) { conn.respond(conn.stream, 200, none, none, true); }
 *         event = server.next(slot);
 *       }
 *       wants = server.flush(slot);
 *       if ((wants & TLS_RECORD_DONE) !== 0) { server.close(slot); }
 *       else { pollModify(loop, server.fd(slot), wants & 3, slot); }
 *     };
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
  /**
   * The TLS pool under this server, slot for slot, for what this class does not wrap, such as session
   * tickets (`enableTickets`, `issue`, `resume`). Accept through this class's `accept`: a slot accepted on
   * `tls` itself gets no fresh HTTP/2 connection, so `next` and `flush` may treat it as free or run it on
   * the state of the slot's last peer.
   */
  tls: TlsTcpServer
  /** The caps every slot's connection is made under. */
  private config: Http2Config
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
   *
   * @param tlsConfig What TLS serves on every slot: the certificate chain, the ALPN list (which must offer
   *   `h2`) and the rest; every slot shares it.
   * @param config The caps every slot's connection is made under; kept, and shared by every slot.
   * @param listener The listening socket from `tcpListen`; the program still owns it and closes it.
   * @param size How many connections may be open at once; anything below 1 is taken as 1.
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

  /** Makes the next slot's connection, on this pool's buffers and `date`. */
  private build(): void {
    const conn: Http2Connection = new Http2Connection(this.config)
    conn.date = this.date.current()
    conn.pools = this.pools
    this.connections.push(conn)
  }

  /** Whether `slot` holds a connection and its HTTP/2 side has been made. */
  private live(slot: i32): boolean {
    return this.tls.holds(slot) && slot < toI32(this.connections.length)
  }

  /**
   * How many slots the pool has, made or not.
   *
   * @returns The slot count the TLS pool settled on, at least 1.
   */
  size(): i32 {
    return this.tls.size()
  }

  /**
   * How many slots hold a connection.
   *
   * @returns Slots with an open descriptor, lingering ones included; 0 to `size()`.
   */
  busy(): i32 {
    return this.tls.busy()
  }

  /**
   * Whether `slot` holds a connection.
   *
   * @param slot A slot number, as `accept` answered it; any value is safe to ask about.
   * @returns True when `slot` is in range and holds a descriptor, lingering or live.
   */
  holds(slot: i32): boolean {
    return this.tls.holds(slot)
  }

  /**
   * The descriptor of `slot`, for `pollAdd`.
   *
   * @param slot A slot number, as `accept` answered it.
   * @returns The socket descriptor, which the pool still owns and closes in `close`; -1 when `slot` holds
   *   none.
   */
  fd(slot: i32): i32 {
    return this.tls.fd(slot)
  }

  /**
   * The HTTP/2 connection of `slot`, its `date` brought up to now. A slot
   * never accepted into, or out of range, names slot 0's, which may be live.
   *
   * @param slot A slot number, as `accept` answered it.
   * @returns The slot's connection, to read events from and answer on; the server keeps it and restarts
   *   it for the slot's next peer.
   */
  connection(slot: i32): Http2Connection {
    this.date.current()
    const at: i32 = slot >= 0 && slot < toI32(this.connections.length) ? slot : H2_TLS_ZERO
    return this.connections[at]
  }

  /**
   * The ALPN protocol `slot`'s handshake chose.
   *
   * @param slot A slot number, as `accept` answered it.
   * @returns The protocol chosen, empty when none was or the handshake is not that far; a free slot
   *   answers its last connection's, and a slot out of range slot 0's.
   */
  alpn(slot: i32): string {
    return this.tls.connection(slot).tls.alpn
  }

  /**
   * Accepts the next waiting connection into a free slot, as
   * `TlsTcpServer.accept` does, and gives it a fresh HTTP/2 connection whose
   * SETTINGS go out once the handshake is done: the slot's own, restarted,
   * or one made now if this is the first accept into it. Answers the slot,
   * or what `TlsTcpServer.accept` answers.
   *
   * @param serverRandom 32 fresh random bytes for the ServerHello's random; copied, not kept.
   * @param ephemeralPrivate 32 fresh random bytes for this handshake's key share; when a slot is answered it
   *   has been copied into the slot and this array wiped.
   * @returns The slot, 0 or more, that now holds the connection; or, taking none, -11 when no connection is
   *   waiting, `TLS_TCP_POOL_FULL` when every slot is busy (the connection is closed), `tcpAccept`'s own
   *   failure, or `TLS_RECORD_INVALID` (-22) for a random or key that is not 32 bytes.
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

  /**
   * The socket of `slot` is readable: TLS reads it, and what HTTP/2 has to send goes after.
   *
   * @param slot The slot whose socket `pollWait` reported readable, or hung up.
   * @returns The slot's interest, as `flush` answers it; `TLS_RECORD_DONE` for a free slot.
   */
  readable(slot: i32): i32 {
    this.tls.readable(slot)
    const wants: i32 = this.flush(slot)
    this.rest(slot)
    return wants
  }

  /**
   * The socket of `slot` is writable: what TLS and HTTP/2 hold goes out.
   *
   * @param slot The slot whose socket `pollWait` reported writable.
   * @returns The slot's interest, as `flush` answers it; `TLS_RECORD_DONE` for a free slot.
   */
  writable(slot: i32): i32 {
    this.tls.writable(slot)
    const wants: i32 = this.flush(slot)
    this.rest(slot)
    return wants
  }

  /**
   * Signs `slot`'s CertificateVerify with `key`, as `TlsTcpServer.signP256` does.
   *
   * @param slot The slot whose interest says `TLS_RECORD_SIGN`.
   * @param key The certificate's P-256 private key; borrowed for the call, still the caller's to wipe.
   * @returns The slot's interest, as `flush` answers it; `TLS_RECORD_DONE` for a free slot.
   */
  signP256(slot: i32, key: Secret<u8[]>): i32 {
    this.tls.signP256(slot, key)
    const wants: i32 = this.flush(slot)
    this.rest(slot)
    return wants
  }

  /** Whether `slot`'s handshake is done and chose anything but `h2`. */
  private refused(slot: i32): boolean {
    return this.tls.connection(slot).state === TLS_RECORD_STATE_OPEN && this.alpn(slot) !== H2_ALPN
  }

  /**
   * Moves what TLS has decrypted for `slot` into its connection, as far as
   * the connection has room, and answers the connection's next event. A free
   * slot, or one whose ALPN was not `h2`, answers `H2_ERROR`.
   *
   * @param slot The slot to read, as `accept` answered it.
   * @returns The connection's next event, `H2_REQUEST` to `H2_GOAWAY` of `nish/net/http2`, read from
   *   `connection(slot)`; `H2_NEED_MORE` once it needs more input or its output to drain, after the
   *   output has gone to TLS; or `H2_ERROR`, final, for a connection that failed, a free slot, a slot
   *   whose HTTP/2 connection was never made, or one whose ALPN was not `h2`.
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
   * and sends it; shuts TLS down once the connection is over (everything is
   * sent, and it failed, or no stream is left after a GOAWAY or after the
   * peer's byte stream ended), or ALPN chose another protocol. Answers the
   * interest, with the write bit while the connection still holds bytes.
   *
   * @param slot The slot whose output to send, as `accept` answered it.
   * @returns The slot's `TLS_RECORD_*` interest, whose low two bits are the events for `pollModify`;
   *   once TLS is shut down, its interest until the `close_notify` is sent and the client has hung up,
   *   then `TLS_RECORD_DONE`; `TLS_RECORD_DONE` for a free slot or one whose HTTP/2 connection was never
   *   made.
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
   *
   * @param slot The slot to free; for a free or unknown slot nothing is sent or closed.
   */
  close(slot: i32): void {
    if (slot >= 0 && slot < toI32(this.connections.length)) {
      this.connections[slot].drop()
    }
    this.tls.close(slot)
  }

  /**
   * Gives back the buffers `slot`'s connection holds and has emptied, so an idle slot holds none.
   *
   * @param slot A slot number; a slot never accepted into, or out of range, is left alone.
   */
  rest(slot: i32): void {
    if (slot >= 0 && slot < toI32(this.connections.length)) {
      this.connections[slot].rest()
    }
  }
}
