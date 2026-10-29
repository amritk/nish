/**
 * `nish/net/tls-tcp` — TLS 1.3 over TCP (WP34 T2): a pool of server
 * connections on `nish:net`, each a `TlsRecordServer` driving a `TlsServer`,
 * for a program that owns its readiness loop.
 *
 *     const listener = tcpListen("0.0.0.0", 8443, 128);
 *     const tls = new TlsTcpServer(config, listener, 64);
 *     pollAdd(loop, listener, 1, LISTENER);
 *     // when the listener is readable:
 *     const slot: i32 = tls.accept(random32(), random32());
 *     if (slot >= 0) { pollAdd(loop, tls.fd(slot), 1, slot); }
 *     // when a connection's token comes back:
 *     let wants: i32 = (events & 5) !== 0 ? tls.readable(slot) : tls.writable(slot);
 *     if ((wants & TLS_RECORD_SIGN) !== 0) { wants = tls.signP256(slot, leafKey); }
 *     if ((wants & TLS_RECORD_DATA) !== 0) { tls.read(slot, buf, 0, buf.length); ... }
 *     if ((wants & TLS_RECORD_DONE) !== 0) { tls.close(slot); }
 *     else { pollModify(loop, tls.fd(slot), wants & 3, slot); }
 *
 * **The program is the loop.** A function is not a value, so there are no
 * callbacks: every call answers what the connection wants next as the
 * `TLS_RECORD_*` bits of `nish/net/tls/record-server`, and the low two bits
 * are exactly the events `pollModify` takes — readable, writable — so the
 * program re-arms the descriptor with them after each call. The loop stays
 * level-triggered and never spins: a connection whose application data the
 * program has not read stops asking to be read, and one with nothing to send
 * stops asking to be written. An event with the hang-up bit (4) goes to
 * `readable`, which is where a closed or failed socket is noticed.
 *
 * **Slots, built on first use; record buffers, borrowed.** The pool's size
 * is a cap: the constructor builds no slot, and the first `accept` into a
 * slot builds its handshake state and keys (TLS-3) and keeps them, so a pool
 * sized for its peak costs at start-up only what does not depend on the
 * size. `accept` hands the next connection the slot closed last, or failing
 * that the next never used, and reuses it once the program `close`s it
 * (WP34 N9). The record buffers — the bytes to send, the plaintext waiting
 * for the program, the record being opened and the record being read — are
 * borrowed from pools this server owns while a connection uses the slot, and
 * given back zeroed (`BufferPool.giveSecret`) when it ends, so a free slot
 * holds none of them ("What moves between connections" in
 * `docs/security/tls.md`). When every slot is busy a new connection is
 * accepted and closed at once, so the listener does not stay readable; the
 * program sees `TLS_TCP_POOL_FULL`. Each slot keeps its own `TlsServer`, which `accept` restarts for the connection, so neither the
 * handshake nor application data allocates anything that outlives a call:
 * a thousand connections through one slot leave `Arena.mark()` where the
 * first left it, under every suite (TLS-3 in `docs/security/tls.md`,
 * `tests/link/net_tls_memory`).
 *
 * **Randomness is the caller's.** `accept` takes the 32-byte server random and
 * the 32-byte x25519 private key the handshake uses, as `TlsServer` does, so a
 * test replays RFC 8448's trace and a server draws them with
 * `crypto.getRandomValues`. `accept` copies both into the slot and wipes the
 * caller's key array, so one buffer of each refilled for every `accept` is
 * safe, and refuses either when it is not 32 bytes before taking a
 * connection; the slot's copy of the key is wiped once the ServerHello is
 * written, when the handshake fails, or when the slot is closed. **Signing is the caller's**, as `TlsServer`'s is: `signP256` signs
 * the CertificateVerify with a P-256 key the caller holds as a `Secret` and
 * borrows for the call, and `signatureInput` / `sign` hand the input out and
 * take any signature back.
 *
 * **Resumption is opt-in, and its keys are the caller's.** After
 * `enableTickets`, a slot whose interest says `TLS_RECORD_TICKET` waits on
 * the program: in the handshake, `resume` reads the ClientHello's tickets
 * under the current and previous ticket keys and a strike register the
 * program lends for the call, and answers the hello resumed or in full; once
 * the connection is open, `issue` seals it one ticket. The pool keeps no
 * ticket key and no register of its own (`docs/security/tls.md`,
 * "Resumption").
 *
 * `read`, `write` and `close` answer as `nish:net`'s calls do — a count, `0`
 * at the end of the stream, `-11` to wait — so a program written against a
 * plain socket moves over with the `slot` in place of the descriptor.
 * `close` frees the slot at once; `shutdown` sends the `close_notify` as the
 * socket takes it, and the slot is done when its interest says so.
 *
 * **A closed connection lingers until the client hangs up.** Once a
 * connection the server closed has sent everything, the slot shuts the
 * socket's write side — the client reads the response, the `close_notify`
 * and then the end of the stream — and reads and throws away what the
 * client still sends, until its own end of stream, before its interest says
 * `TLS_RECORD_DONE` (RFC 9112 §9.6's staged close). A socket closed with
 * the client's bytes unread, or that the client writes to after the close,
 * answers with a TCP reset, and a client may report that reset instead of
 * the response it was sent: Chromium's `ERR_CONNECTION_RESET` after an HTTP/2
 * `GOAWAY`, when its SETTINGS acknowledgement crossed the server's close. A
 * lingering slot holds no key and no record buffer, asks only to be read,
 * and gives up past `TLS_TCP_LINGER_LIMIT` bytes. A connection that failed,
 * whose client sent its own `close_notify` (it writes nothing after it,
 * RFC 8446 §6.1) or whose client's stream had already ended, is done at
 * once. A client that never hangs up keeps its slot, as one that never sends
 * does: how long a slot may wait is the program's (`docs/security/tls.md`,
 * TLS-6 and TLS-4).
 *
 * Written from RFC 8446 and docs/LANGUAGE.md's `nish:net`, not ported from
 * another implementation.
 */
import { Secret } from "nish:secret"
import {
  connectResult,
  netClose,
  netRead,
  netShutdown,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollWait,
  tcpAccept,
  tcpConnect,
} from "nish:net"
import { monotonicNanos, wallClockNanos } from "nish:process"
import { TlsP256Signer, TlsServer, TlsServerConfig } from "nish/net/tls"
import { TlsClient, TlsClientConfig } from "nish/net/tls/client"
import { TLS_RECORD_AUTH, TlsRecordClient } from "nish/net/tls/record-client"
import { TlsClientTrust, tlsClientAuthenticate, tlsClientSystemTrust } from "nish/net/tls/verify"
import { TLS_ALERT_INTERNAL_ERROR } from "nish/net/tls/codec"
import { TLS_MAX_RECORD } from "nish/net/tls/record"
import { TlsTicketKeyInfo, TlsTicketStrikes } from "nish/net/tls/ticket"
import {
  TLS_RECORD_AGAIN,
  TLS_RECORD_DATA,
  TLS_RECORD_DONE,
  TLS_RECORD_INVALID,
  TLS_RECORD_PIPE,
  TLS_RECORD_RESET,
  TLS_RECORD_STATE_CLOSED,
  TLS_RECORD_STATE_FAILED,
  TLS_RECORD_STATE_OPEN,
  TLS_RECORD_WANT_READ,
  TLS_RECORD_WANT_WRITE,
  TlsRecordPools,
  TlsRecordServer,
} from "nish/net/tls/record-server"

/** What `accept` answers when every slot is busy: the connection was accepted and closed. Linux's ENOBUFS. */
export const TLS_TCP_POOL_FULL: i32 = -105

/** A free slot's descriptor. */
const TLS_TCP_FREE: i32 = -1

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const TLS_TCP_FROM: i32 = 0

/** The length of an x25519 private key and of a server random: what `TlsServer` takes for each. */
const TLS_TCP_KEY_SIZE: i32 = 32

/** The most a lingering slot reads and throws away before it is done anyway: 64 KiB. */
const TLS_TCP_LINGER_LIMIT: i32 = 65536

/** In `lingered`: a slot that is not lingering. */
const TLS_TCP_LIVE: i32 = -1

/** In `lingered`: a slot whose linger is over, which is done. */
const TLS_TCP_LINGERED: i32 = -2

/** `netShutdown`'s write side. */
const TLS_TCP_SHUT_WRITE: i32 = 1

/** The address form's length, from `nish:net`. */
const TLS_TCP_ADDRESS_SIZE: i32 = 18

/** What `tlsConnect` answers when the connection did not open within its timeout. Linux's ETIMEDOUT. */
export const TLS_TCP_TIMED_OUT: i32 = -110

/** `pollWait`'s readable bit and its hang-up-or-error bit: the events `readable` takes. */
const TLS_TCP_READ_EVENTS: i32 = 5

/** The events `pollModify` takes, readable and writable: the low two `TLS_RECORD_*` bits. */
const TLS_TCP_POLL_EVENTS: i32 = 3

/** The token `tlsConnect`'s own loop watches its one socket under. */
const TLS_TCP_TOKEN: i32 = 1

/** Nanoseconds in a millisecond, for the clocks of `nish:process`. */
const TLS_TCP_NANOS_PER_MS: i64 = 1000000

/**
 * A pool of TLS 1.3 server connections on one listening socket. `slot`s are
 * the indices `accept` answers, from 0 to the pool's size; a slot is the
 * program's from `accept` until it calls `close`, and its descriptor is
 * `fd(slot)`.
 */
export class TlsTcpServer {
  config: TlsServerConfig
  /**
   * The connections built so far, slot `k`'s at `k`: one per slot ever
   * accepted into. `connection` never adds to it; a slot never built reads
   * `vacant` instead.
   */
  connections: TlsRecordServer[]
  /**
   * Each slot's descriptor, or -1 while the slot is free, for the slots
   * accepted into so far: its length is the high-water mark, and a slot past
   * it has never been used.
   */
  fds: i32[]
  /**
   * Each slot's linger, beside `fds`: `TLS_TCP_LIVE` until its connection is
   * over, then how many bytes it has thrown away while it waits for the
   * client's end of stream, then `TLS_TCP_LINGERED` once it is done.
   */
  lingered: i32[]
  /**
   * The slots closed since they were used, a stack whose top `accept` takes
   * before it builds a slot past the high-water mark, so finding one costs
   * the same with every slot free as with all but one busy.
   */
  free: i32[]
  /** Where the socket is read into before a connection takes the bytes: the largest record. */
  scratch: u8[]
  /** The last accepted peer's address, in `nish:net`'s 18-byte form. */
  peer: u8[]
  /** Signs every slot's CertificateVerify in `signP256`, one for the pool, keeping nothing per signature. */
  signer: TlsP256Signer
  /**
   * Each slot's own copy of its connection's server random: `TlsServer`
   * keeps the array it is given and writes it into the ServerHello only once
   * the ClientHello arrives, so the program's array may be refilled for the
   * next one. The ephemeral key needs no copy here: `TlsServer.restart`
   * copies it into the server's own `Secret` and wipes the array it was
   * handed.
   */
  randoms: u8[][]
  /** How many slots the pool may hold, which `size` answers. */
  slots: i32 = 1
  /** Whether `enableTickets` has run, so a slot built after it resumes too. */
  tickets: boolean = false
  /**
   * What `connection` answers for every slot never built: one failed
   * connection no slot holds and every such slot shares, so the slot reads
   * as a free one does (no ALPN, not open) and never as another slot's live
   * session. Its first read allocates it, once per server; it has no
   * tickets, and a caller must not change it.
   */
  vacant: TlsRecordServer | null = null
  /**
   * The pools every slot borrows its record buffers from, each with a
   * ceiling of one per slot: `lent()` is 0 once every connection has ended,
   * and `made()` is the most connections that were ever open at once.
   */
  pools: TlsRecordPools
  /** The listening socket, which the program made with `tcpListen` and still owns. */
  listener: i32 = -1

  /**
   * A pool of `size` slots, at least one, serving `config` on `listener`, a
   * socket `tcpListen` made. No slot is built here: a slot's handshake state
   * and its server random are allocated by the first `accept` into it and
   * kept, and its record buffers are borrowed from `pools` while a
   * connection uses them, so a pool sized for a peak costs at start-up only
   * the read scratch, the signer and the empty pools.
   */
  constructor(config: TlsServerConfig, listener: i32, size: i32) {
    this.config = config
    this.listener = listener
    this.connections = []
    this.fds = []
    this.lingered = []
    this.free = []
    this.randoms = []
    this.slots = size < 1 ? 1 : size
    this.pools = new TlsRecordPools(this.slots)
    this.scratch = new Array<u8>(TLS_MAX_RECORD)
    this.peer = new Array<u8>(TLS_TCP_ADDRESS_SIZE)
    this.signer = new TlsP256Signer()
  }

  /**
   * The next slot's connection and server random, for the slot built next.
   * Called by `accept` alone, as the pool's high-water mark rises: slot `k`'s
   * entry must sit at index `k` of `connections` and `randoms`. Its handshake
   * is never given a ClientHello: `accept` restarts it for a connection with
   * real randomness, and every later connection reuses its state.
   */
  build(): TlsRecordServer {
    const random: u8[] = new Array<u8>(TLS_TCP_KEY_SIZE)
    this.randoms.push(random)
    const conn: TlsRecordServer = this.make(random)
    if (this.tickets) {
      conn.tls.enableTickets()
    }
    this.connections.push(conn)
    return conn
  }

  /**
   * A connection over `random` that is marked failed without sealing an
   * alert, so a stray call on it fails closed, and that borrows no buffer
   * until a connection moves bytes through it.
   */
  make(random: u8[]): TlsRecordServer {
    // A placeholder key for a first handshake, which never runs.
    const zeros: u8[] = new Array<u8>(TLS_TCP_KEY_SIZE)
    const conn: TlsRecordServer = new TlsRecordServer(new TlsServer(this.config, random, zeros))
    conn.borrowFrom(this.pools)
    conn.state = TLS_RECORD_STATE_FAILED
    return conn
  }

  /** How many slots the pool has, built or not. */
  size(): i32 {
    return this.slots
  }

  /** How many slots hold a connection. */
  busy(): i32 {
    let n: i32 = 0
    for (const fd of this.fds) {
      if (fd >= 0) {
        n = n + 1
      }
    }
    return n
  }

  /** Whether `slot` is a slot of this pool that holds a connection. */
  holds(slot: i32): boolean {
    return slot >= 0 && slot < toI32(this.fds.length) && this.fds[slot] >= 0
  }

  /** The descriptor of `slot`, for `pollAdd`; -1 for a free or unknown slot. */
  fd(slot: i32): i32 {
    return this.holds(slot) ? this.fds[slot] : -1
  }

  /**
   * The connection in `slot`: its state, its handshake (`tls`: suite, ALPN,
   * server name) and the alerts sent and received. A free slot answers the
   * last connection it held. A slot never accepted into answers `vacant`,
   * failed, as a free slot does, and builds no slot; a slot out of range
   * names slot 0's.
   */
  connection(slot: i32): TlsRecordServer {
    const index: i32 = slot >= 0 && slot < this.slots ? slot : 0
    if (index >= 0 && index < toI32(this.connections.length)) {
      return this.connections[index]
    }
    const vacant: TlsRecordServer | null = this.vacant
    if (vacant !== null) {
      return vacant
    }
    const made: TlsRecordServer = this.make(new Array<u8>(TLS_TCP_KEY_SIZE))
    this.vacant = made
    return made
  }

  /**
   * Accepts the next waiting connection into a free slot and starts its
   * handshake with `serverRandom` and `ephemeralPrivate` (32 bytes each),
   * and answers the slot. The peer's address is in `peer`. Both arrays are
   * copied into the slot, which reads them only when the ClientHello
   * arrives, and the key's array is then wiped, so the program may refill
   * one buffer of each for every call. Answers -11 when no connection is
   * waiting, `TLS_TCP_POOL_FULL` when one was but every slot is busy (it is
   * closed), or `tcpAccept`'s own failure; and `TLS_RECORD_INVALID` (-22),
   * before any connection is taken, for a random or key that is not 32
   * bytes. On any answer but a slot both arrays are left as they were.
   */
  accept(serverRandom: u8[], ephemeralPrivate: u8[]): i32 {
    if (
      toI32(serverRandom.length) !== TLS_TCP_KEY_SIZE ||
      toI32(ephemeralPrivate.length) !== TLS_TCP_KEY_SIZE
    ) {
      return TLS_RECORD_INVALID
    }
    const fd: i32 = tcpAccept(this.listener, this.peer)
    if (fd < 0) {
      return fd
    }
    // A slot closed before is taken first, then the next never used, so the
    // first accepts take slots 0, 1, 2 ... and a pool that never fills never
    // builds its last slots.
    let slot: i32 = TLS_TCP_POOL_FULL
    if (this.free.length > 0) {
      slot = this.free[this.free.length - 1]
      this.free.pop()
    } else if (toI32(this.fds.length) < this.slots) {
      slot = toI32(this.fds.length)
      this.fds.push(TLS_TCP_FREE)
      this.lingered.push(TLS_TCP_LIVE)
    }
    if (slot < 0 || slot >= toI32(this.fds.length)) {
      netClose(fd)
      return TLS_TCP_POOL_FULL
    }
    const conn: TlsRecordServer =
      slot < toI32(this.connections.length) ? this.connections[slot] : this.build()
    this.fds[slot] = fd
    this.lingered[slot] = TLS_TCP_LIVE
    const random: u8[] = this.randoms[slot]
    for (
      let k: i32 = 0;
      k < TLS_TCP_KEY_SIZE && k < toI32(random.length) && k < toI32(serverRandom.length);
      k++
    ) {
      random[k] = serverRandom[k]
    }
    // `restart` copies the key into the server's own `Secret` and wipes this array.
    conn.tls.restart(random, ephemeralPrivate)
    conn.start(conn.tls)
    return slot
  }

  /**
   * The socket of `slot` is readable: reads it until it would block or the
   * connection has no room, handing each read to the connection, then sends
   * what that produced. Answers the connection's `interest`, or, while the
   * slot lingers, what `drain` answers; a free slot answers `TLS_RECORD_DONE`.
   */
  readable(slot: i32): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
    }
    if (this.lingered[slot] !== TLS_TCP_LIVE) {
      return this.drain(slot)
    }
    const fd: i32 = this.fds[slot]
    const conn: TlsRecordServer = this.connections[slot]
    while (true) {
      const room: i32 = conn.space()
      const want: i32 = room < toI32(this.scratch.length) ? room : toI32(this.scratch.length)
      if (want <= 0 || conn.state === TLS_RECORD_STATE_FAILED || conn.peerClosed) {
        break
      }
      const n: i32 = netRead(fd, this.scratch, TLS_TCP_FROM, want)
      if (n <= 0) {
        if (n === 0) {
          conn.end()
        } else if (n !== TLS_RECORD_AGAIN) {
          conn.abort()
        }
        break
      }
      conn.receive(this.scratch, TLS_TCP_FROM, n)
    }
    return this.flush(slot)
  }

  /** The socket of `slot` is writable: sends what the connection holds. Answers its `interest`. */
  writable(slot: i32): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
    }
    return this.flush(slot)
  }

  /**
   * Writes the connection's output until the socket would block or it is all
   * sent, and answers its `interest`; once the connection is over and the
   * program has read what the client sent, the slot lingers (`linger`). A
   * free slot answers `TLS_RECORD_DONE`.
   */
  flush(slot: i32): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
    }
    if (this.lingered[slot] !== TLS_TCP_LIVE) {
      return this.lingerInterest(slot)
    }
    const wants: i32 = this.send(slot)
    // Application data still unread keeps the connection, and its keys, until
    // the program reads it: lingering gives back the buffer that holds it.
    return (wants & TLS_RECORD_DONE) !== 0 && (wants & TLS_RECORD_DATA) === 0 ? this.linger(slot) : wants
  }

  /** Writes `slot`'s output until the socket would block or it is all sent; answers the connection's `interest`. */
  send(slot: i32): i32 {
    const fd: i32 = this.fds[slot]
    const conn: TlsRecordServer = this.connections[slot]
    while (conn.outputEnd > conn.outputStart) {
      const n: i32 = netWrite(fd, conn.output, conn.outputStart, conn.outputEnd - conn.outputStart)
      if (n <= 0) {
        if (n !== TLS_RECORD_AGAIN) {
          conn.abort()
        }
        break
      }
      conn.consume(n)
    }
    return conn.interest()
  }

  /**
   * `slot`'s connection is over and everything is sent. One the server
   * closed, whose client has neither sent its `close_notify` nor ended its
   * stream, lingers: the socket's write side is shut, every key wiped and
   * every record buffer given back, and what the client sends is drained
   * (`drain`). Any other is done.
   */
  linger(slot: i32): i32 {
    const conn: TlsRecordServer = this.connections[slot]
    if (
      conn.state !== TLS_RECORD_STATE_CLOSED ||
      conn.peerClosed ||
      conn.ended ||
      netShutdown(this.fds[slot], TLS_TCP_SHUT_WRITE) < 0
    ) {
      this.lingered[slot] = TLS_TCP_LINGERED
      return TLS_RECORD_DONE
    }
    this.lingered[slot] = 0
    conn.wipeKeys()
    conn.release()
    return this.drain(slot)
  }

  /**
   * Reads what a lingering `slot`'s client sends and throws it away, until
   * the socket would block (`TLS_RECORD_WANT_READ`), or its stream ends, the
   * socket fails or more than `TLS_TCP_LINGER_LIMIT` bytes came
   * (`TLS_RECORD_DONE`).
   */
  drain(slot: i32): i32 {
    while (this.lingered[slot] >= 0) {
      const n: i32 = netRead(this.fds[slot], this.scratch, TLS_TCP_FROM, toI32(this.scratch.length))
      if (n === TLS_RECORD_AGAIN) {
        return TLS_RECORD_WANT_READ
      }
      this.lingered[slot] =
        n > 0 && this.lingered[slot] + n <= TLS_TCP_LINGER_LIMIT ? this.lingered[slot] + n : TLS_TCP_LINGERED
    }
    return TLS_RECORD_DONE
  }

  /**
   * Whether `slot` lingers: its connection is over and it waits for the
   * client to hang up. A carrier's idle clock does not move for what a
   * lingering slot drains, so its idle timeout bounds the wait.
   */
  lingering(slot: i32): boolean {
    return this.holds(slot) && this.lingered[slot] >= 0
  }

  /** A lingering `slot`'s interest: to be read, or `TLS_RECORD_DONE` once its linger is over. */
  lingerInterest(slot: i32): i32 {
    return this.lingered[slot] >= 0 ? TLS_RECORD_WANT_READ : TLS_RECORD_DONE
  }

  /** What `slot`'s connection wants now, without touching the socket; `TLS_RECORD_DONE` for a free slot. */
  interest(slot: i32): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
    }
    return this.lingered[slot] !== TLS_TCP_LIVE
      ? this.lingerInterest(slot)
      : this.connections[slot].interest()
  }

  /** What `slot`'s CertificateVerify signs, while its `interest` says `TLS_RECORD_SIGN`; `null` otherwise. */
  signatureInput(slot: i32): u8[] | null {
    return this.holds(slot) ? this.connections[slot].signatureInput() : null
  }

  /** Hands `slot` the signature over `signatureInput(slot)`, seals the rest of its flight and sends it. Answers its `interest`. */
  sign(slot: i32, signature: u8[]): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
    }
    this.connections[slot].sign(signature)
    return this.flush(slot)
  }

  /**
   * Signs `slot`'s CertificateVerify with the P-256 private key `key` and
   * hands it over, as `sign` does, through the pool's `TlsP256Signer`, so a
   * handshake's signature keeps nothing. The key is borrowed: the caller made
   * the `Secret`, and wipes it. A malformed key fails the connection with
   * `internal_error`.
   */
  signP256(slot: i32, key: Secret<u8[]>): i32 {
    const input: u8[] | null = this.signatureInput(slot)
    if (input === null) {
      return this.interest(slot)
    }
    const signature: u8[] | null = this.signer.sign(key, input)
    if (signature === null) {
      this.connections[slot].fail(TLS_ALERT_INTERNAL_ERROR)
      return this.flush(slot)
    }
    return this.sign(slot, signature)
  }

  /**
   * Turns session resumption on for every slot (`TlsServer.enableTickets`):
   * from the next `accept`, a connection offering a ticket, or one that may
   * be issued one, says `TLS_RECORD_TICKET` in its interest. A slot built
   * later is built with them on.
   */
  enableTickets(): void {
    this.tickets = true
    for (let k: i32 = 0; k < toI32(this.connections.length); k++) {
      this.connections[k].tls.enableTickets()
    }
  }

  /**
   * While `slot`'s interest says `TLS_RECORD_TICKET` in the handshake: reads
   * its ClientHello's tickets under `current` and `previous`, with what each
   * `info` says of them, records the one it resumes in `strikes`, and sends
   * the flight that answers the hello, resumed or in full
   * (`TlsRecordServer.resume`). The keys and the register are borrowed for
   * the call. Answers the slot's interest.
   */
  resume(
    slot: i32,
    current: Secret<u8[]>,
    currentInfo: TlsTicketKeyInfo,
    previous: Secret<u8[]>,
    previousInfo: TlsTicketKeyInfo,
    strikes: TlsTicketStrikes,
    now: i64
  ): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
    }
    this.connections[slot].resume(current, currentInfo, previous, previousInfo, strikes, now)
    return this.flush(slot)
  }

  /**
   * While `slot`'s interest says `TLS_RECORD_TICKET` on an open connection:
   * seals one ticket under the borrowed `key` and sends its
   * NewSessionTicket (`TlsRecordServer.issue`). Answers the slot's interest.
   */
  issue(slot: i32, key: Secret<u8[]>, info: TlsTicketKeyInfo, now: i64): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
    }
    this.connections[slot].issue(key, info, now)
    return this.flush(slot)
  }

  /**
   * Application data from `slot`'s client into `buf[off .. off + len)`: the
   * count, 0 at the end of its stream, -11 when nothing is waiting, -104 once
   * the connection has failed, as `TlsRecordServer.read` says. Reading makes
   * room, and the records that were waiting for it may be handled and
   * answered (a KeyUpdate), which is sent here; the connection may then want
   * the socket read again, so re-arm it with `interest(slot)`.
   */
  read(slot: i32, buf: u8[], off: i32, len: i32): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_INVALID
    }
    const n: i32 = this.connections[slot].read(buf, off, len)
    this.flush(slot)
    return n
  }

  /**
   * Application data for `slot`'s client, `data[off .. off + len)`: seals as
   * much as fits and sends what the socket takes, and answers how much was
   * taken, -11 when nothing fits yet or the handshake is under way, -32 once
   * the server has closed, as `TlsRecordServer.write` says.
   */
  write(slot: i32, data: u8[], off: i32, len: i32): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_INVALID
    }
    const n: i32 = this.connections[slot].write(data, off, len)
    this.flush(slot)
    return n
  }

  /** Sends a KeyUpdate on `slot`, asking the client for one too when `requestPeer`; answers as `TlsRecordServer.keyUpdate`. */
  keyUpdate(slot: i32, requestPeer: boolean): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_INVALID
    }
    const r: i32 = this.connections[slot].keyUpdate(requestPeer)
    this.flush(slot)
    return r
  }

  /**
   * Closes the server's side of `slot`'s connection (§6.1): a `close_notify`
   * after whatever is already written, sent as the socket takes it. The slot
   * stays the program's until its interest says `TLS_RECORD_DONE` — every
   * byte is sent and, once the slot lingers (`linger`), the client has hung
   * up — and the program calls `close`. Meanwhile the interest asks for the
   * socket to be read. Answers the interest.
   */
  shutdown(slot: i32): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
    }
    this.connections[slot].close()
    return this.flush(slot)
  }

  /**
   * Ends `slot`'s connection and frees the slot at once: a `close_notify`
   * unless the connection already failed or closed, one attempt to send what
   * is left, every key wiped, and the descriptor closed, which also takes it
   * out of every loop. A program that must know every byte and the
   * `close_notify` arrived calls `shutdown` instead, and `close` once the
   * slot's interest says `TLS_RECORD_DONE`.
   */
  close(slot: i32): void {
    if (!this.holds(slot)) {
      return
    }
    const conn: TlsRecordServer = this.connections[slot]
    if (this.lingered[slot] === TLS_TCP_LIVE) {
      conn.close()
      this.send(slot)
    }
    netClose(this.fds[slot])
    this.fds[slot] = TLS_TCP_FREE
    this.lingered[slot] = TLS_TCP_LIVE
    this.free.push(slot)
    conn.wipeKeys()
    // Whatever the last flush could not send is dropped with its buffer.
    conn.release()
  }
}

/**
 * One TLS 1.3 client connection over TCP: a `TlsRecordClient` driving a
 * `TlsClient` on a socket `tcpConnect` opened, for a program that owns its
 * readiness loop, as `TlsTcpServer` is for a server.
 *
 *     const client = new TlsTcpClient(addr, new TlsClientConfig("example.com", ["h2"]), trust);
 *     pollAdd(loop, client.fd(), client.interest() & 3, TOKEN);
 *     // when the token comes back:
 *     let wants: i32 = (events & 5) !== 0 ? client.readable() : client.writable();
 *     if ((wants & TLS_RECORD_DATA) !== 0) { client.read(buf, 0, buf.length); ... }
 *     if ((wants & TLS_RECORD_DONE) !== 0) { client.close(); }
 *     else { pollModify(loop, client.fd(), wants & 3, TOKEN); }
 *
 * **The server is always authenticated.** When the handshake reaches the
 * server's certificate chain and CertificateVerify, the client gives its own
 * verdict at once (`tlsClientAuthenticate` in `nish/net/tls/verify`) under
 * `trust` and the wall clock, before it reads the server's Finished, so
 * `interest` never says `TLS_RECORD_AUTH` and there is no way to open a
 * connection to a server the trust does not vouch for. A refusal fails the
 * connection with its alert sent: `failure()` names it.
 *
 * **Randomness is the CSPRNG's.** The client random and both ephemeral keys
 * (x25519, and P-256 for a server that asks for that group) are drawn from
 * `crypto.getRandomValues` in the constructor; `TlsClient` copies the keys
 * into its own `Secret`s and the arrays they were drawn into are zeroed.
 *
 * The socket is still connecting when the constructor returns, so the first
 * interest is writable alone; the first event on it, writable or a hang-up,
 * says how the connection went (`connectResult`), and a socket that did not
 * connect leaves the client done, its failure in `connectError`.
 */
export class TlsTcpClient {
  conn: TlsRecordClient
  trust: TlsClientTrust
  /** The socket, -1 once `close` has run or when `tcpConnect` refused at once. */
  socket: i32 = -1
  /** Whether the socket has yet to say how its connection went. */
  connecting: boolean = true
  /**
   * Why the connection failed below TLS, or 0: `tcpConnect`'s or
   * `connectResult`'s failure, or what ended `tlsConnect`'s wait — its
   * timeout (`TLS_TCP_TIMED_OUT`) or its loop's failure.
   */
  connectError: i32 = 0
  /** Where the socket is read into before the connection takes the bytes: the largest record. */
  scratch: u8[]

  /**
   * A connection to the server at `addr` (`nish:net`'s 18-byte form, which
   * `netAddress` writes) under `config`, authenticated against `trust`. The
   * name the certificate must carry is `config.serverName`, never one taken
   * from `addr`. The ClientHello is sealed here and waits for the socket.
   */
  constructor(addr: u8[], config: TlsClientConfig, trust: TlsClientTrust) {
    const random: u8[] = new Array<u8>(TLS_TCP_KEY_SIZE)
    const x25519: u8[] = new Array<u8>(TLS_TCP_KEY_SIZE)
    const p256: u8[] = new Array<u8>(TLS_TCP_KEY_SIZE)
    crypto.getRandomValues(random)
    crypto.getRandomValues(x25519)
    crypto.getRandomValues(p256)
    // `TlsClient` copies both keys and zeroes these arrays.
    this.conn = new TlsRecordClient(new TlsClient(config, random, x25519, p256))
    this.trust = trust
    this.scratch = new Array<u8>(TLS_MAX_RECORD)
    // A config `TlsClient` refused (a bad name or protocol) is never dialled:
    // the client is failed already, its alert in `failure()`.
    if (this.conn.state === TLS_RECORD_STATE_FAILED) {
      this.connecting = false
      return
    }
    const fd: i32 = toI32(addr.length) < TLS_TCP_ADDRESS_SIZE ? TLS_RECORD_INVALID : tcpConnect(addr)
    if (fd < 0) {
      this.connecting = false
      this.connectError = fd
      this.conn.abort()
      return
    }
    this.socket = fd
  }

  /** The socket, for `pollAdd`; -1 when there is none. */
  fd(): i32 {
    return this.socket
  }

  /** Whether the handshake is done and the server authenticated, so application data flows. */
  open(): boolean {
    return this.conn.state === TLS_RECORD_STATE_OPEN
  }

  /** Why a failed connection failed: `connectError` when TCP did not connect, else the alert (`TlsRecordClient.failure`). */
  failure(): i32 {
    return this.connectError !== 0 ? this.connectError : this.conn.failure()
  }

  /** What the connection wants now, as `TLS_RECORD_*` bits, without touching the socket. */
  interest(): i32 {
    if (this.socket < 0) {
      return TLS_RECORD_DONE
    }
    return this.connecting ? TLS_RECORD_WANT_WRITE : this.conn.interest()
  }

  /**
   * The first event on a connecting socket: whether it connected. One that
   * did not leaves the client failed with nothing sent, its reason in
   * `connectError`.
   */
  connected(): boolean {
    this.connecting = false
    const result: i32 = connectResult(this.socket)
    if (result !== 0) {
      this.connectError = result
      this.conn.abort()
      return false
    }
    return true
  }

  /**
   * The socket is readable, or hung up: reads it until it would block or the
   * connection has no room, handing each read to the connection, then sends
   * what that produced. Answers the `interest`.
   */
  readable(): i32 {
    if (this.socket < 0) {
      return TLS_RECORD_DONE
    }
    if (this.connecting && !this.connected()) {
      return TLS_RECORD_DONE
    }
    const conn: TlsRecordClient = this.conn
    while (true) {
      const room: i32 = conn.space()
      const want: i32 = room < toI32(this.scratch.length) ? room : toI32(this.scratch.length)
      if (want <= 0 || conn.state === TLS_RECORD_STATE_FAILED || conn.peerClosed) {
        break
      }
      const n: i32 = netRead(this.socket, this.scratch, TLS_TCP_FROM, want)
      if (n <= 0) {
        if (n === 0) {
          conn.end()
        } else if (n !== TLS_RECORD_AGAIN) {
          conn.abort()
        }
        break
      }
      conn.receive(this.scratch, TLS_TCP_FROM, n)
    }
    return this.flush()
  }

  /** The socket is writable: on the first event, how the connection went; then sends what the connection holds. Answers the `interest`. */
  writable(): i32 {
    if (this.socket < 0) {
      return TLS_RECORD_DONE
    }
    if (this.connecting && !this.connected()) {
      return TLS_RECORD_DONE
    }
    return this.flush()
  }

  /**
   * Authenticates the server once the handshake asks for it, then writes the
   * connection's output until the socket would block or it is all sent, and
   * answers the `interest`.
   */
  flush(): i32 {
    if (this.socket < 0) {
      return TLS_RECORD_DONE
    }
    if (this.connecting) {
      return TLS_RECORD_WANT_WRITE
    }
    if ((this.conn.interest() & TLS_RECORD_AUTH) !== 0) {
      tlsClientAuthenticate(this.conn, this.trust, wallClockNanos() / TLS_TCP_NANOS_PER_MS)
    }
    const conn: TlsRecordClient = this.conn
    while (conn.outputEnd > conn.outputStart) {
      const n: i32 = netWrite(this.socket, conn.output, conn.outputStart, conn.outputEnd - conn.outputStart)
      if (n <= 0) {
        if (n !== TLS_RECORD_AGAIN) {
          conn.abort()
        }
        break
      }
      conn.consume(n)
    }
    return conn.interest()
  }

  /**
   * Application data from the server into `buf[off .. off + len)`: the count,
   * 0 at the end of its stream, -11 when nothing is waiting, -104 once the
   * connection has failed, as `TlsRecordClient.read` says, and -32 once
   * `close` has run. What reading makes room for is answered and sent here;
   * re-arm with `interest()`.
   */
  read(buf: u8[], off: i32, len: i32): i32 {
    if (this.socket < 0) {
      return this.ended()
    }
    const n: i32 = this.conn.read(buf, off, len)
    this.flush()
    return n
  }

  /** What a call on a client that is done answers: -104 when it failed, else -32. */
  ended(): i32 {
    return this.conn.state === TLS_RECORD_STATE_FAILED ? TLS_RECORD_RESET : TLS_RECORD_PIPE
  }

  /**
   * Application data from the server, waiting for it up to `timeoutMs`
   * milliseconds in a loop of the client's own, for a program with no loop:
   * the count, 0 at the end of the server's stream, `TLS_TCP_TIMED_OUT` when
   * nothing came in time (the connection stays usable), -104 once it has
   * failed, -32 once it is done otherwise, or the loop's failure. It drives
   * the handshake too, so it may follow `new TlsTcpClient` directly.
   */
  readWait(buf: u8[], off: i32, len: i32, timeoutMs: i32): i32 {
    const end: i64 = tlsTcpDeadline(timeoutMs)
    let n: i32 = this.read(buf, off, len)
    if (n !== TLS_RECORD_AGAIN) {
      return n
    }
    const loop: i32 = this.ownLoop()
    if (loop < 0) {
      return loop
    }
    while (n === TLS_RECORD_AGAIN) {
      const turned: i32 = this.turn(loop, end)
      if (turned === TLS_RECORD_DONE) {
        n = this.read(buf, off, len)
        if (n === TLS_RECORD_AGAIN) {
          n = this.ended()
        }
        break
      }
      if (turned < 0) {
        n = turned
        break
      }
      n = this.read(buf, off, len)
    }
    netClose(loop)
    return n
  }

  /**
   * Writes all of `data[off .. off + len)` and waits up to `timeoutMs`
   * milliseconds, in a loop of the client's own, until the socket has taken
   * every byte of it: `len`, or — some of it perhaps sent — `TLS_TCP_TIMED_OUT`,
   * -32 once the client has closed, -104 once the connection has failed,
   * -22 for a window outside `data`, or the loop's failure. It drives the
   * handshake too, so it may follow `new TlsTcpClient` directly.
   */
  writeAll(data: u8[], off: i32, len: i32, timeoutMs: i32): i32 {
    const end: i64 = tlsTcpDeadline(timeoutMs)
    let done: i32 = 0
    let loop: i32 = -1
    let result: i32 = 0
    while (true) {
      if (done < len) {
        const n: i32 = this.write(data, off + done, len - done)
        if (n >= 0) {
          done = done + n
        } else if (n !== TLS_RECORD_AGAIN) {
          result = n
          break
        }
      }
      if (done >= len && !this.sending()) {
        break
      }
      if (loop < 0) {
        loop = this.ownLoop()
        if (loop < 0) {
          result = loop
          break
        }
      }
      const turned: i32 = this.turn(loop, end)
      if (turned === TLS_RECORD_DONE) {
        result = this.ended()
        break
      }
      if (turned < 0) {
        result = turned
        break
      }
    }
    if (loop >= 0) {
      netClose(loop)
    }
    return result < 0 ? result : done
  }

  /** Whether sealed bytes are still waiting for the socket. */
  sending(): boolean {
    return this.conn.outputEnd > this.conn.outputStart
  }

  /** A readiness loop of the client's own holding its socket, for the waiting calls, or the loop's failure. */
  ownLoop(): i32 {
    const loop: i32 = pollCreate()
    if (loop >= 0) {
      pollAdd(loop, this.socket, this.interest() & TLS_TCP_POLL_EVENTS, TLS_TCP_TOKEN)
    }
    return loop
  }

  /**
   * One turn of `loop` (from `ownLoop`): waits until the socket is ready, or
   * until `end` on the monotonic clock, and handles what came. Answers 0,
   * `TLS_RECORD_DONE` once the connection wants nothing more,
   * `TLS_TCP_TIMED_OUT`, or the loop's failure.
   */
  turn(loop: i32, end: i64): i32 {
    const wants: i32 = this.interest()
    if ((wants & TLS_RECORD_DONE) !== 0) {
      return TLS_RECORD_DONE
    }
    const now: i64 = monotonicNanos()
    if (now >= end) {
      return TLS_TCP_TIMED_OUT
    }
    pollModify(loop, this.socket, wants & TLS_TCP_POLL_EVENTS, TLS_TCP_TOKEN)
    const ready: i32[] = new Array<i32>(2)
    const count: i32 = pollWait(
      loop,
      ready,
      toI32((end - now + TLS_TCP_NANOS_PER_MS - 1) / TLS_TCP_NANOS_PER_MS)
    )
    if (count < 0) {
      return count
    }
    if (count > 0) {
      if ((ready[1] & TLS_TCP_READ_EVENTS) !== 0) {
        this.readable()
      } else {
        this.writable()
      }
    }
    return 0
  }

  /**
   * Application data for the server, `data[off .. off + len)`: seals as much
   * as fits and sends what the socket takes, and answers how much was taken,
   * -11 when nothing fits yet or the handshake is under way, -32 once the
   * client has closed, as `TlsRecordClient.write` says.
   */
  write(data: u8[], off: i32, len: i32): i32 {
    const n: i32 = this.conn.write(data, off, len)
    this.flush()
    return n
  }

  /** Sends a KeyUpdate, asking the server for one too when `requestPeer`; answers as `TlsRecordClient.keyUpdate`. */
  keyUpdate(requestPeer: boolean): i32 {
    const r: i32 = this.conn.keyUpdate(requestPeer)
    this.flush()
    return r
  }

  /**
   * Closes the client's side (§6.1): a `close_notify` after whatever is
   * already written, sent as the socket takes it. The connection reads on
   * until the server's own `close_notify`; call `close` once the interest
   * says `TLS_RECORD_DONE`, or reads answer 0. Answers the interest.
   */
  shutdown(): i32 {
    this.conn.close()
    return this.flush()
  }

  /**
   * Ends the connection at once: a `close_notify` unless it already failed
   * or closed, one attempt to send what is left, every key wiped and the
   * socket closed, which also takes it out of every loop.
   */
  close(): void {
    if (this.socket < 0) {
      this.conn.wipe()
      return
    }
    if (!this.connecting) {
      this.conn.close()
      this.flush()
    }
    netClose(this.socket)
    this.socket = -1
    this.conn.wipe()
  }
}

/** The monotonic clock `timeoutMs` milliseconds from now. */
const tlsTcpDeadline = (timeoutMs: i32): i64 => monotonicNanos() + toI64(timeoutMs) * TLS_TCP_NANOS_PER_MS

/**
 * Opens a TLS 1.3 connection to the server at `addr` (`nish:net`'s 18-byte
 * form) for `serverName`, offering `alpn`, authenticated against the
 * system's roots, and waits in a loop of its own until the handshake is done
 * and the client's last flight sent, or it fails, or `timeoutMs` milliseconds
 * pass, reading the roots included. Answers the client either way:
 * `open()` says whether it opened; otherwise `failure()` says why — the TCP
 * failure, the alert, or `TLS_TCP_TIMED_OUT`, the client closed. Nothing is
 * looked up: to reach a name, resolve it first with `nish/net/dns`'s
 * `resolveHost`; the name the certificate must carry is always `serverName`,
 * never one taken from `addr`. The open client's socket is in no loop: the
 * program adds it to its own, or uses `writeAll` and `readWait`. The roots
 * are read on every call; a program that connects often reads them once with
 * `tlsClientSystemTrust` and passes them to `tlsConnectWith`.
 */
export const tlsConnect = (addr: u8[], serverName: string, alpn: string[], timeoutMs: i32): TlsTcpClient => {
  const end: i64 = tlsTcpDeadline(timeoutMs)
  return tlsConnectBy(addr, new TlsClientConfig(serverName, alpn), tlsClientSystemTrust(), end)
}

/** `tlsConnect` under a `config` and `trust` of the caller's. */
export const tlsConnectWith = (
  addr: u8[],
  config: TlsClientConfig,
  trust: TlsClientTrust,
  timeoutMs: i32
): TlsTcpClient => tlsConnectBy(addr, config, trust, tlsTcpDeadline(timeoutMs))

/** `tlsConnectWith`, waiting until `end` on the monotonic clock. */
const tlsConnectBy = (addr: u8[], config: TlsClientConfig, trust: TlsClientTrust, end: i64): TlsTcpClient => {
  const client: TlsTcpClient = new TlsTcpClient(addr, config, trust)
  if (client.fd() < 0) {
    return client
  }
  const loop: i32 = client.ownLoop()
  if (loop < 0) {
    client.connectError = loop
    client.close()
    return client
  }
  // The connection opens on the server's Finished, with the client's own
  // perhaps still queued: it is sent before the client is handed back.
  while (!client.open() || client.sending()) {
    const turned: i32 = client.turn(loop, end)
    if (turned === TLS_RECORD_DONE) {
      break
    }
    if (turned < 0) {
      client.connectError = turned
      break
    }
  }
  netClose(loop)
  if (!client.open() || client.connectError !== 0) {
    client.close()
  }
  return client
}
