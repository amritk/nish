/**
 * `nish/net/http2-cleartext` — HTTP/2 over plain TCP with prior knowledge
 * (h2c, RFC 9113 §3.3): a pool of `Http2Connection`s, one per accepted
 * socket, for a program that owns its readiness loop. The client starts with
 * the 24-byte connection preface; there is no `Upgrade: h2c` (RFC 9113 §3.1
 * deprecates it) and no fallback to HTTP/1.1 on the same port.
 *
 * **No confidentiality, no integrity.** Anyone on the path reads and edits
 * the traffic. Serve h2c only upstream of a TLS-terminating proxy, on
 * loopback or a private network (`docs/security/http2-cleartext.md`).
 *
 *     import { pollAdd, pollModify, tcpListen } from "nish:net";
 *     import { H2_ERROR, H2_NEED_MORE, H2_REQUEST, Http2Config, Http2Connection } from "nish/net/http2";
 *     import { H2C_DONE, Http2CleartextServer } from "nish/net/http2-cleartext";
 *
 *     // `loop` is the program's, from `pollCreate`.
 *     const LISTENER: i32 = 64; // past every slot's token
 *     const start = (loop: i32): Http2CleartextServer => {
 *       const listener: i32 = tcpListen("127.0.0.1", 8080, 128);
 *       pollAdd(loop, listener, 1, LISTENER);
 *       return new Http2CleartextServer(new Http2Config(), listener, 64, 10000);
 *     };
 *     // When the listener's token comes back:
 *     const admit = (loop: i32, server: Http2CleartextServer): void => {
 *       const slot: i32 = server.accept();
 *       if (slot >= 0) { pollAdd(loop, server.fd(slot), 1, slot); }
 *     };
 *     // When a slot's token comes back with `events`:
 *     const serve = (loop: i32, server: Http2CleartextServer, slot: i32, events: i32): void => {
 *       let wants: i32 = (events & 5) !== 0 ? server.readable(slot) : server.writable(slot);
 *       const none: u8[][] = [];
 *       let event: i32 = server.next(slot);
 *       while (event !== H2_NEED_MORE && event !== H2_ERROR) {
 *         const conn: Http2Connection = server.connection(slot);
 *         if (event === H2_REQUEST) { conn.respond(conn.stream, 200, none, none, true); }
 *         event = server.next(slot);
 *       }
 *       wants = server.flush(slot);
 *       if ((wants & H2C_DONE) !== 0) { server.close(slot); }
 *       else { pollModify(loop, server.fd(slot), wants & 3, slot); }
 *     };
 *     // Every so often, with `monotonicNanos()`:
 *     //   server.expire(monotonicNanos());
 *
 * It is `nish/net/http2-tls`'s loop with a TCP socket in place of TLS, the
 * same method names and the same interest bits (read 1, write 2, done 16),
 * plus `expire(now)` for the preface deadline.
 *
 * **The preface is the carrier's.** `Http2Connection` checks the preface
 * itself, but on a mismatch it queues SETTINGS and a GOAWAY, and a port
 * scanner or a confused HTTP/1.1 client should get nothing back. So each slot
 * reads its first 24 bytes into a 24-byte array of its own and compares each,
 * as it comes, with `PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n`: at the first byte
 * that differs the socket is closed, with no byte sent. A whole preface is
 * fed to the connection, which checks it again, and from then on the socket
 * is read straight into the connection's input, as `http2-tls.ts` reads TLS
 * into it. Until the preface is whole the slot borrows no `Http2Pools`
 * buffer and sends nothing, so a peer that stalls there holds 24 bytes and a
 * slot until `expire` closes it, `prefaceTimeout` milliseconds after accept.
 *
 * **Relies on `@internal` members.** The carrier is the second server loop in
 * `std/net` and uses `Http2Connection.inputTail`, `received` and `endInput`
 * exactly as `http2-tls.ts` does. It keeps its own `ended` flag for the end of
 * input it passed to `endInput`, rather than reading the `@internal`
 * `inputEnded`.
 *
 * **Slots, a cap; buffers, borrowed.** As `Http2TlsServer`: slot 0's
 * connection is made by the constructor, so a bad `Http2Config` panics there
 * with its own words; every other slot's by the first `accept` into it, and
 * kept. Each connection borrows its frame buffers from the shared `pools`
 * and gives them back once empty and when the slot closes. Every final
 * response carries the pool's `date`, formatted at most once a second.
 *
 * Written from RFC 9113 §3, not ported from another implementation.
 */
import { netClose, netRead, netWrite, tcpAccept } from "nish:net"
import { HttpDate } from "nish/net/http1-server"
import { H2_ERROR, H2_NEED_MORE, Http2Config, Http2Connection, Http2Pools } from "nish/net/http2"

/** A typed zero: a bare literal is an `f64` under `--number-mode f64`. */
const H2C_ZERO: i32 = 0

/** The interest bit for "read the socket": `pollModify`'s read event. */
export const H2C_WANT_READ: i32 = 1
/** The interest bit for "write the socket": `pollModify`'s write event. */
export const H2C_WANT_WRITE: i32 = 2
/** The interest bit for "the slot is over": the program calls `close(slot)`. */
export const H2C_DONE: i32 = 16
/** What `accept` answers when every slot is busy; the connection it took is closed. */
export const H2C_POOL_FULL: i32 = -105

/** The client connection preface's length (RFC 9113 §3.4). */
const H2C_PREFACE_SIZE: i32 = 24
/** The size of `nish:net`'s peer address form, which `tcpAccept` fills. */
const H2C_ADDRESS_SIZE: i32 = 18
/** What `netRead` and `netWrite` answer when the socket would block. */
const H2C_AGAIN: i32 = -11
/** A free slot's socket: no descriptor at all. */
const H2C_NO_FD: i32 = -1
/** Nanoseconds in a millisecond, for `prefaceTimeout` against `monotonicNanos`. */
const H2C_NANOS_PER_MS: i64 = 1000000

/** The client connection preface, `PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n` (RFC 9113 §3.4). */
const H2C_PREFACE: string = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"

/**
 * One slot's socket and preface: what `accept` sets and `close` clears. The
 * slot is made by the first accept into it and kept, with its connection.
 */
class H2cSlot {
  /** The slot's number, its place in `held` and in `connections`. */
  at: i32 = 0
  /** The slot's socket, -1 while the slot is free. */
  fd: i32 = -1
  /** How many preface bytes the slot has read; 24 once the preface is whole and fed. */
  got: i32 = 0
  /** When the slot was accepted, in `monotonicNanos`: its preface deadline's start. */
  since: i64 = 0
  /** Whether the slot's socket has ended and `endInput` was called for it. */
  ended: boolean = false
  /** The slot's 24 preface bytes, read here until they are whole. */
  preface: u8[]
  /** The slot's HTTP/2 connection, the one `connections` holds at `at`. */
  conn: Http2Connection

  constructor(at: i32, conn: Http2Connection) {
    this.at = at
    this.conn = conn
    this.preface = new Array<u8>(H2C_PREFACE_SIZE)
  }
}

/**
 * A pool of HTTP/2 connections over plain TCP, with prior knowledge, on one
 * listening socket. `connection(slot)` is the HTTP/2 side of each slot.
 */
export class Http2CleartextServer {
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
  /** The slots accepted into so far, slot `k` at `k`; a free one keeps its socket at -1. */
  private held: H2cSlot[]
  /** The slots closed since they were used, a stack `accept` takes from before it makes a new one. */
  private free: H2cSlot[]
  /** The last accepted peer's address, in `nish:net`'s 18-byte form. */
  private peer: u8[]
  /** How many slots the pool may hold. */
  private slots: i32 = 1
  /** The listening socket, which the program made with `tcpListen` and still owns. */
  private listener: i32 = -1
  /** Nanoseconds a slot may wait for its whole preface before `expire` closes it. */
  private prefaceNanos: i64 = 0
  /**
   * How many held slots have not read their whole preface: `expire` walks none
   * while this is 0. At most one per slot, and `accept` and `close` keep it
   * exact, so the unsigned count neither wraps up nor goes below 0.
   */
  private waiting: u32 = 0

  /**
   * A pool of `size` slots serving HTTP/2 under `config` on `listener`. Only
   * slot 0's connection is made here, so a config it refuses panics now, with
   * its words; every other slot's is made by the first `accept` into it and
   * kept, with the slot's 24-byte preface array.
   *
   * @param config The caps every slot's connection is made under; kept, and shared by every slot.
   * @param listener The listening socket from `tcpListen`; the program still owns it and closes it.
   * @param size How many connections may be open at once, at least 1; anything less panics.
   * @param prefaceTimeout Milliseconds a peer has, from `accept`, to send its whole 24-byte preface before
   *   `expire` closes the slot; at least 1.
   */
  constructor(config: Http2Config, listener: i32, size: i32, prefaceTimeout: i32) {
    if (size < 1) {
      panic(`Http2CleartextServer: slots is ${size}; at least 1 is needed`)
    }
    if (prefaceTimeout < 1) {
      panic(`Http2CleartextServer: prefaceTimeout is ${prefaceTimeout} ms; at least 1 is needed`)
    }
    this.config = config
    this.listener = listener
    this.slots = size
    this.prefaceNanos = toI64(prefaceTimeout) * H2C_NANOS_PER_MS
    this.connections = []
    this.held = []
    this.free = []
    this.peer = new Array<u8>(H2C_ADDRESS_SIZE)
    this.date = new HttpDate()
    // Formatted once now, so no slot ever sends the bytes before a first format.
    const first: Http2Connection = new Http2Connection(config)
    first.date = this.date.current()
    this.connections.push(first)
    // After slot 0's connection, so a config it refuses panics with its words.
    this.pools = new Http2Pools("Http2CleartextServer", config, size)
    first.pools = this.pools
  }

  /** Makes the next slot's connection, on this pool's buffers and `date`, and answers it. */
  private build(): Http2Connection {
    const conn: Http2Connection = new Http2Connection(this.config)
    conn.date = this.date.current()
    conn.pools = this.pools
    this.connections.push(conn)
    return conn
  }

  /** The slot `slot` names, or null when it is out of range or never accepted into. */
  private at(slot: i32): H2cSlot | null {
    return slot >= 0 && slot < toI32(this.held.length) ? this.held[slot] : null
  }

  /** The slot `slot` names when it holds a socket, or null. */
  private open(slot: i32): H2cSlot | null {
    const s: H2cSlot | null = this.at(slot)
    return s !== null && s.fd >= 0 ? s : null
  }

  /** Whether `slot` holds a socket and has read its whole preface. */
  private live(slot: i32): boolean {
    const s: H2cSlot | null = this.open(slot)
    return s !== null && s.got === H2C_PREFACE_SIZE
  }

  /**
   * How many slots the pool has, made or not.
   *
   * @returns The slot count the constructor was given, at least 1.
   */
  size(): i32 {
    return this.slots
  }

  /**
   * How many slots hold a connection.
   *
   * @returns Slots with an open socket, whether their preface is whole or not; 0 to `size()`.
   */
  busy(): i32 {
    // At most one per slot, so the unsigned count cannot wrap.
    let n: u32 = 0
    for (const s of this.held) {
      if (s.fd >= 0) {
        n += 1
      }
    }
    return toI32(n)
  }

  /**
   * Whether `slot` holds a connection.
   *
   * @param slot A slot number, as `accept` answered it; any value is safe to ask about.
   * @returns True when `slot` is in range and holds a socket.
   */
  holds(slot: i32): boolean {
    return this.open(slot) !== null
  }

  /**
   * The descriptor of `slot`, for `pollAdd`.
   *
   * @param slot A slot number, as `accept` answered it.
   * @returns The socket descriptor, which the pool still owns and closes in `close`; -1 when `slot` holds
   *   none.
   */
  fd(slot: i32): i32 {
    const s: H2cSlot | null = this.open(slot)
    return s !== null ? s.fd : H2C_NO_FD
  }

  /**
   * Whether `slot` has read its whole connection preface, so its connection is running.
   *
   * @param slot A slot number, as `accept` answered it; any value is safe to ask about.
   * @returns True once the slot's 24 preface bytes have arrived and matched; false for a free slot.
   */
  prefaced(slot: i32): boolean {
    return this.live(slot)
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
    if (slot >= 0 && slot < toI32(this.connections.length)) {
      return this.connections[slot]
    }
    // Slot 0's connection, made by the constructor, answers for any other slot, so this builds none.
    if (toI32(this.connections.length) > 0) {
      return this.connections[0]
    }
    return this.build()
  }

  /**
   * Accepts the next waiting connection into a free slot and gives it a fresh
   * HTTP/2 connection, which sends nothing until the peer's preface is whole:
   * the slot's own, restarted, or one made now if this is the first accept
   * into it. A slot closed before is taken first, then the next never used.
   *
   * @returns The slot, 0 or more, that now holds the connection; or, taking none, -11 when no connection is
   *   waiting, `tcpAccept`'s own failure, or `H2C_POOL_FULL` when every slot is busy (the connection it
   *   took is closed with nothing sent).
   */
  accept(): i32 {
    const fd: i32 = tcpAccept(this.listener, this.peer)
    if (fd < 0) {
      return fd
    }
    const s: H2cSlot | null = this.take()
    if (s === null) {
      netClose(fd)
      return H2C_POOL_FULL
    }
    // `restart` gives back every buffer; the preface is read before any is borrowed.
    s.conn.restart()
    s.fd = fd
    s.got = H2C_ZERO
    s.since = monotonicNanos()
    s.ended = false
    this.waiting += 1
    return s.at
  }

  /** A free slot for `accept`: a closed one first, then the next never used; null when every slot is busy. */
  private take(): H2cSlot | null {
    if (this.free.length > 0) {
      return this.free.pop()
    }
    const k: i32 = toI32(this.held.length)
    if (k >= this.slots) {
      return null
    }
    // Slots are made in order and slot 0's connection by the constructor, so this makes one connection at
    // most.
    while (toI32(this.connections.length) < k) {
      this.build()
    }
    const conn: Http2Connection = k < toI32(this.connections.length) ? this.connections[k] : this.build()
    const s: H2cSlot = new H2cSlot(k, conn)
    this.held.push(s)
    return s
  }

  /**
   * Reads what is left of `slot`'s preface, byte for byte against the
   * constant, and closes the slot at the first byte that differs, or when the
   * peer hangs up or the socket fails first. Feeds a whole preface to the
   * connection.
   *
   * @returns True once the preface is whole; false while it is not, or once the slot is closed.
   */
  private admit(slot: i32): boolean {
    const s: H2cSlot | null = this.open(slot)
    if (s === null) {
      return false
    }
    if (s.got === H2C_PREFACE_SIZE) {
      return true
    }
    const preface: u8[] = s.preface
    const want: string = H2C_PREFACE
    let have: i32 = s.got
    while (have >= 0 && have < H2C_PREFACE_SIZE) {
      const n: i32 = netRead(s.fd, preface, have, H2C_PREFACE_SIZE - have)
      if (n === H2C_AGAIN) {
        return false
      }
      if (n <= 0) {
        this.close(slot)
        return false
      }
      // `netRead` answers at most the 24 - `have` bytes it was asked for, so the unsigned sum is at most 24.
      const end: i32 = toI32(toU32(have) + toU32(n))
      for (let k: i32 = have; k < end; k++) {
        if (k < 0 || k >= toI32(preface.length) || k >= want.length) {
          break
        }
        if (toI32(preface[k]) !== toI32(want.charCodeAt(k))) {
          this.close(slot)
          return false
        }
      }
      s.got = end
      have = end
    }
    this.waiting -= 1
    s.conn.feed(preface, H2C_ZERO, H2C_PREFACE_SIZE)
    return true
  }

  /**
   * The socket of `slot` is readable: while the preface is not whole, reads
   * it (and closes the slot at a byte that differs); then sends what HTTP/2
   * has to send. Once the preface is whole, `next` reads the socket.
   *
   * @param slot The slot whose socket `pollWait` reported readable, or hung up.
   * @returns The slot's interest, as `flush` answers it; `H2C_DONE` for a free slot or one this call closed.
   */
  readable(slot: i32): i32 {
    this.admit(slot)
    const wants: i32 = this.flush(slot)
    this.rest(slot)
    return wants
  }

  /**
   * The socket of `slot` is writable: what HTTP/2 holds goes out.
   *
   * @param slot The slot whose socket `pollWait` reported writable.
   * @returns The slot's interest, as `flush` answers it; `H2C_DONE` for a free slot.
   */
  writable(slot: i32): i32 {
    const wants: i32 = this.flush(slot)
    this.rest(slot)
    return wants
  }

  /**
   * Reads `slot`'s socket into its connection, as far as the connection has
   * room, and answers the connection's next event. A slot whose preface is
   * not whole reads that first and answers `H2_NEED_MORE` while it waits.
   *
   * @param slot The slot to read, as `accept` answered it.
   * @returns The connection's next event, `H2_REQUEST` to `H2_GOAWAY` of `nish/net/http2`, read from
   *   `connection(slot)`; `H2_NEED_MORE` once it needs more input or its output to drain, after the
   *   output has gone to the socket, or while the preface is not whole; or `H2_ERROR` for a connection
   *   that failed, a free slot, or one closed for a bad preface.
   */
  next(slot: i32): i32 {
    const s: H2cSlot | null = this.open(slot)
    if (s === null) {
      return H2_ERROR
    }
    if (!this.admit(slot)) {
      return s.fd >= 0 ? H2_NEED_MORE : H2_ERROR
    }
    this.date.current()
    const conn: Http2Connection = s.conn
    // The socket is read straight into the connection's input, so a byte is
    // copied once on its way in.
    while (!s.ended) {
      const room: i32 = conn.inputTail()
      if (room <= 0) {
        break
      }
      const n: i32 = netRead(s.fd, conn.input, conn.inputEnd, room)
      if (n === H2C_AGAIN) {
        break
      }
      if (n <= 0) {
        // The peer's end, or a socket that failed: either way nothing more comes.
        s.ended = true
        conn.endInput()
        break
      }
      conn.received(n)
    }
    const event: i32 = conn.next()
    if (event === H2_NEED_MORE || event === H2_ERROR) {
      this.flush(slot)
      this.rest(slot)
    }
    return event
  }

  /**
   * Writes what `slot`'s connection holds to the socket, as far as the socket
   * takes it, and answers the interest. Nothing is written while the preface
   * is not whole. A socket that fails ends the connection.
   *
   * @param slot The slot whose output to send, as `accept` answered it.
   * @returns The slot's interest: `H2C_WANT_READ` while the preface is not whole; once it is,
   *   `H2C_WANT_WRITE` while the connection holds bytes and `H2C_WANT_READ` while its input has not ended;
   *   `H2C_DONE` once the connection is over (everything is sent, and it failed, or no stream is left after
   *   a GOAWAY or after the peer's byte stream ended), for a free slot, and for one closed for a bad
   *   preface.
   */
  flush(slot: i32): i32 {
    const s: H2cSlot | null = this.open(slot)
    if (s === null) {
      return H2C_DONE
    }
    if (s.got !== H2C_PREFACE_SIZE) {
      return H2C_WANT_READ
    }
    const conn: Http2Connection = s.conn
    while (conn.wantsWrite()) {
      const start: i32 = conn.outputStart
      const end: i32 = conn.outputEnd
      if (start < 0 || end < start) {
        break
      }
      // Both ends checked just above, so the unsigned difference is the span's length and does not wrap.
      const n: i32 = netWrite(s.fd, conn.output, start, toI32(toU32(end) - toU32(start)))
      if (n === H2C_AGAIN) {
        break
      }
      if (n <= 0) {
        // The peer is gone (-32) or the socket failed: what is left can never be sent.
        conn.drop()
        break
      }
      conn.consume(n)
    }
    if (conn.isDone()) {
      return H2C_DONE
    }
    const read: i32 = s.ended ? H2C_ZERO : H2C_WANT_READ
    return conn.wantsWrite() ? read | H2C_WANT_WRITE : read
  }

  /**
   * Closes every slot whose preface is not whole `prefaceTimeout`
   * milliseconds after its accept, at `now`. A slot past its preface has no
   * deadline here: a program times idle connections itself.
   *
   * @param now The current time, from `monotonicNanos()`.
   * @returns How many slots this call closed.
   */
  expire(now: i64): i32 {
    if (this.waiting === 0) {
      return 0
    }
    // At most one per slot, so the unsigned count cannot wrap.
    let n: u32 = 0
    for (const s of this.held) {
      // `now` at or past `since`, so the unsigned difference is the wait, which does not wrap.
      if (
        s.fd >= 0 &&
        s.got < H2C_PREFACE_SIZE &&
        now >= s.since &&
        toU64(now) - toU64(s.since) >= toU64(this.prefaceNanos)
      ) {
        this.close(s.at)
        n += 1
      }
    }
    return toI32(n)
  }

  /**
   * Ends `slot`'s connection and frees the slot at once: the socket is
   * closed with nothing more sent, and the connection gives back every buffer
   * it holds.
   *
   * @param slot The slot to free; for a free or unknown slot nothing is closed.
   */
  close(slot: i32): void {
    const s: H2cSlot | null = this.open(slot)
    if (s === null) {
      return
    }
    netClose(s.fd)
    s.fd = H2C_NO_FD
    if (s.got < H2C_PREFACE_SIZE) {
      this.waiting -= 1
    }
    s.got = H2C_ZERO
    this.free.push(s)
    s.conn.drop()
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
