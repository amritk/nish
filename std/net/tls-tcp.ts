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
 * **Slots, sized at start-up.** The constructor allocates every connection's
 * buffers — about 136 KB of resident memory each, the largest record twice
 * over in each direction and the handshake's own state (TLS-3) — and `accept` hands the next connection a free slot and
 * reuses it once the program `close`s it (WP34 N9). When every slot is busy
 * a new connection is accepted and closed at once, so the listener does not
 * stay readable; the program sees `TLS_TCP_POOL_FULL`. Each slot keeps its
 * own `TlsServer`, which `accept` restarts for the connection, so neither the
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
 * `read`, `write` and `close` answer as `nish:net`'s calls do — a count, `0`
 * at the end of the stream, `-11` to wait — so a program written against a
 * plain socket moves over with the `slot` in place of the descriptor.
 * `close` frees the slot at once; `shutdown` sends the `close_notify` as the
 * socket takes it, and the slot is done when its interest says so.
 *
 * Written from RFC 8446 and docs/LANGUAGE.md's `nish:net`, not ported from
 * another implementation.
 */
import { Secret } from "nish:secret"
import { netClose, netRead, netWrite, tcpAccept } from "nish:net"
import { TlsP256Signer, TlsServer, TlsServerConfig } from "nish/net/tls"
import { TLS_ALERT_INTERNAL_ERROR } from "nish/net/tls/codec"
import { TLS_MAX_RECORD } from "nish/net/tls/record"
import {
  TLS_RECORD_AGAIN,
  TLS_RECORD_DONE,
  TLS_RECORD_INVALID,
  TLS_RECORD_STATE_FAILED,
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

/** The address form's length, from `nish:net`. */
const TLS_TCP_ADDRESS_SIZE: i32 = 18

/**
 * A pool of TLS 1.3 server connections on one listening socket. `slot`s are
 * the indices `accept` answers, from 0 to the pool's size; a slot is the
 * program's from `accept` until it calls `close`, and its descriptor is
 * `fd(slot)`.
 */
export class TlsTcpServer {
  config: TlsServerConfig
  /** The connections, one per slot, made once. */
  connections: TlsRecordServer[]
  /** Each slot's descriptor, or -1 while the slot is free. */
  fds: i32[]
  /** Where the socket is read into before a connection takes the bytes: the largest record. */
  scratch: u8[]
  /** The last accepted peer's address, in `nish:net`'s 18-byte form. */
  peer: u8[]
  /** Signs every slot's CertificateVerify in `signP256`, one for the pool, keeping nothing per signature. */
  signer: TlsP256Signer
  /**
   * Each slot's own copy of its connection's ephemeral key, so that wiping it
   * can never reach an array the program has refilled for the next one.
   */
  keys: u8[][]
  /**
   * Each slot's own copy of its connection's server random, for the same
   * reason: `TlsServer` keeps the array it is given and writes it into the
   * ServerHello only once the ClientHello arrives.
   */
  randoms: u8[][]
  /** The listening socket, which the program made with `tcpListen` and still owns. */
  listener: i32 = -1

  /**
   * A pool of `size` slots, at least one, serving `config` on `listener`, a
   * socket `tcpListen` made. Every slot's buffers are allocated here.
   */
  constructor(config: TlsServerConfig, listener: i32, size: i32) {
    this.config = config
    this.listener = listener
    this.connections = []
    this.fds = []
    this.keys = []
    this.randoms = []
    const none: u8[] = []
    const slots: i32 = size < 1 ? 1 : size
    for (let k: i32 = 0; k < slots; k++) {
      // Each slot's own handshake, refused by `TlsServer` for its empty
      // randomness, so the slot starts out failed until `accept` restarts it
      // for a connection; every later connection reuses its buffers.
      this.connections.push(new TlsRecordServer(new TlsServer(config, none, none)))
      this.fds.push(TLS_TCP_FREE)
      this.keys.push(new Array<u8>(TLS_TCP_KEY_SIZE))
      this.randoms.push(new Array<u8>(TLS_TCP_KEY_SIZE))
    }
    this.scratch = new Array<u8>(TLS_MAX_RECORD)
    this.peer = new Array<u8>(TLS_TCP_ADDRESS_SIZE)
    this.signer = new TlsP256Signer()
  }

  /** How many slots the pool has. */
  size(): i32 {
    return toI32(this.fds.length)
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
   * last connection it held.
   */
  connection(slot: i32): TlsRecordServer {
    const at: i32 = slot >= 0 && slot < toI32(this.connections.length) ? slot : 0
    return this.connections[at]
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
    let slot: i32 = -1
    for (let k: i32 = 0; k < toI32(this.fds.length); k++) {
      if (this.fds[k] < 0) {
        slot = k
        break
      }
    }
    if (slot < 0) {
      netClose(fd)
      return TLS_TCP_POOL_FULL
    }
    this.fds[slot] = fd
    const random: u8[] = this.randoms[slot]
    const key: u8[] = this.keys[slot]
    for (
      let k: i32 = 0;
      k < TLS_TCP_KEY_SIZE && k < toI32(random.length) && k < toI32(serverRandom.length);
      k++
    ) {
      random[k] = serverRandom[k]
    }
    for (
      let k: i32 = 0;
      k < TLS_TCP_KEY_SIZE && k < toI32(key.length) && k < toI32(ephemeralPrivate.length);
      k++
    ) {
      key[k] = ephemeralPrivate[k]
    }
    secureZero(ephemeralPrivate)
    const conn: TlsRecordServer = this.connections[slot]
    conn.tls.restart(random, key)
    conn.start(conn.tls)
    return slot
  }

  /**
   * The socket of `slot` is readable: reads it until it would block or the
   * connection has no room, handing each read to the connection, then sends
   * what that produced. Answers the connection's `interest`; a free slot
   * answers `TLS_RECORD_DONE`.
   */
  readable(slot: i32): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
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

  /** Writes the connection's output until the socket would block or it is all sent, and answers its `interest`. */
  flush(slot: i32): i32 {
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

  /** What `slot`'s connection wants now, without touching the socket; `TLS_RECORD_DONE` for a free slot. */
  interest(slot: i32): i32 {
    return this.holds(slot) ? this.connections[slot].interest() : TLS_RECORD_DONE
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
   * byte is sent — and the program calls `close`. Answers the interest.
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
    conn.close()
    this.flush(slot)
    netClose(this.fds[slot])
    this.fds[slot] = TLS_TCP_FREE
    conn.wipeKeys()
  }
}
