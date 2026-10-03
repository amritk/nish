/**
 * `nish/net/tls/record-server` — a TLS 1.3 server over a byte stream: the
 * record layer of `nish/net/tls/record` wrapped around `nish/net/tls`'s
 * `TlsServer`, sans-IO. Bytes the client sent go in, bytes to send come out,
 * and once the handshake is done application data flows both ways.
 *
 *     const conn = new TlsRecordServer(new TlsServer(config, random, key));
 *     conn.receive(bytes, 0, n);                 // what the socket read
 *     if ((conn.interest() & TLS_RECORD_SIGN) !== 0) {
 *       conn.sign(tlsSignEcdsaP256(leaf, conn.signatureInput()));
 *     }
 *     // send conn.output[conn.outputStart .. conn.outputEnd), then conn.consume(sent)
 *     const got: i32 = conn.read(buf, 0, buf.length);   // application data
 *
 * **What it adds to `TlsServer`.** Records around the handshake messages:
 * ServerHello (or HelloRetryRequest) in the clear, the rest of the server's
 * flight — EncryptedExtensions through Finished — in as few records as fit
 * under the handshake keys once it is signed, which is one record for RFC
 * 8448 §3's trace, and every key installed at the record boundary RFC 8446
 * §5.1 puts it on. The middlebox-compatibility `change_cipher_spec` of §D.4:
 * the server sends one right after its first handshake message when the
 * client sent a session id, and drops the client's from its first ClientHello
 * until its Finished. Alerts (§6) both ways: `close_notify` ends the client's
 * stream, `user_canceled` is passed over, any other alert ends the
 * connection, and a refusal of this module's or of `TlsServer`'s is sent as a
 * fatal alert under whatever keys the server writes with. KeyUpdate (§4.6.3)
 * both ways: the client's moves the read keys on and, when it asks, the
 * server answers with its own; `keyUpdate` sends one, and the writer sends
 * one by itself before a key has protected `TLS_KEY_UPDATE_RECORDS` records.
 * More than `TLS_RECORD_IDLE_LIMIT` records in a row that carry nothing for
 * the caller — KeyUpdates among them, which each cost two key derivations —
 * are refused. A stream that ends without `close_notify` is truncation, but
 * only once the records still waiting for the caller have been read.
 *
 * **Fixed buffers.** The record being read, the bytes to send and the
 * application data waiting for the caller each live in an array allocated
 * once, in the constructor, so a connection that has finished its handshake
 * allocates nothing that outlives a record, and a slot can be handed the
 * next connection with `start`. A KeyUpdate does leave memory: deriving the
 * next keys leaves about 5 KB per direction behind, so a connection takes at
 * most `TLS_RECORD_MAX_KEY_UPDATES` from its client. When the caller leaves
 * application data unread for long enough to fill its buffer, records stay in the reader and
 * `interest` stops asking for reads, which is how the peer is made to wait.
 * The handshake is the exception: `TlsServer` allocates what it keeps, about
 * 52 KB per handshake, and that stays until the arena is reset (TLS-3 in
 * `docs/security/tls.md`).
 *
 * **Secrets.** Each traffic secret is copied out of `TlsServer` as it is
 * installed and the server's copy is wiped with `secureZero`, as are the
 * handshake secret once the flight is signed and the caller's ephemeral key
 * once the ServerHello is written, or the handshake fails. The two application traffic secrets live
 * on here, for KeyUpdate: each is overwritten in place by the next, and both
 * are wiped, with both directions' keys, by `wipeKeys` when the carrier
 * closes the slot and by `start`. What stays unwiped is TLS-1's and TLS-2's.
 *
 * Refusals are alerts, never panics. Written from RFC 8446 §4.6.3, §5, §6
 * and §D.4, not ported from another implementation.
 */
import {
  TLS_LEVEL_APPLICATION,
  TLS_LEVEL_HANDSHAKE,
  TLS_LEVEL_INITIAL,
  TLS_STATE_CONNECTED,
  TLS_STATE_FAILED,
  TLS_STATE_WAIT_CLIENT_HELLO,
  TLS_STATE_WAIT_FINISHED,
  TLS_STATE_WAIT_SIGNATURE,
  TlsServer,
} from "nish/net/tls"
import {
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_UNEXPECTED_MESSAGE,
} from "nish/net/tls/codec"
import {
  TLS_ALERT_CLOSE_NOTIFY,
  TLS_ALERT_LEVEL_FATAL,
  TLS_ALERT_LEVEL_WARNING,
  TLS_ALERT_USER_CANCELED,
  TLS_CONTENT_ALERT,
  TLS_CONTENT_APPLICATION_DATA,
  TLS_CONTENT_CHANGE_CIPHER_SPEC,
  TLS_CONTENT_HANDSHAKE,
  TLS_HANDSHAKE_KEY_UPDATE,
  TLS_MAX_PLAINTEXT,
  TLS_MAX_RECORD,
  TLS_RECORD_HEADER_SIZE,
  TLS_RECORD_TAG_SIZE,
  TlsRecordProtection,
  TlsRecordReader,
  tlsRecordWindowFits,
} from "nish/net/tls/record"

// ---- States ----------------------------------------------------------------------

/** The handshake is under way. */
export const TLS_RECORD_STATE_HANDSHAKE: i32 = 0
/** The client's Finished verified: application data flows both ways. */
export const TLS_RECORD_STATE_OPEN: i32 = 1
/** The server's `close_notify` is written; it sends nothing more, and may still read. */
export const TLS_RECORD_STATE_CLOSED: i32 = 2
/** The connection ended on an alert, sent (`alert`) or received (`peerAlert`), or on a stream cut short. */
export const TLS_RECORD_STATE_FAILED: i32 = 3

// ---- What the connection wants, from `interest` -----------------------------------

/** There is room for more of the stream: read the socket. */
export const TLS_RECORD_WANT_READ: i32 = 1
/** `output` holds bytes to send: write the socket. */
export const TLS_RECORD_WANT_WRITE: i32 = 2
/** `read` has application data, or the end of the client's stream, to give. */
export const TLS_RECORD_DATA: i32 = 4
/** The server is waiting for its CertificateVerify signature: `signatureInput`, then `sign`. */
export const TLS_RECORD_SIGN: i32 = 8
/** Nothing more will happen: the connection failed or closed, and everything to send is sent. */
export const TLS_RECORD_DONE: i32 = 16

/** What `read` and `write` answer once the connection has failed: Linux's ECONNRESET, as `nish:net` spells it. */
export const TLS_RECORD_RESET: i32 = -104
/** What `write` answers once the server has closed: Linux's EPIPE, as `nish:net` spells it. */
export const TLS_RECORD_PIPE: i32 = -32
/** What `read`, `write` and `keyUpdate` answer when they have to wait: Linux's EAGAIN, as `nish:net` spells it. */
export const TLS_RECORD_AGAIN: i32 = -11
/** What `read` and `write` answer for a window outside the caller's array: Linux's EINVAL. */
export const TLS_RECORD_INVALID: i32 = -22

/** The output buffer: two of the largest records, so a record can be sealed while another is still being sent. */
const TLS_RECORD_OUTPUT_SIZE: i32 = 2 * TLS_MAX_RECORD
/** The application data buffer: two records' worth, so one is opened while the caller reads the other. */
const TLS_RECORD_PLAIN_SIZE: i32 = 2 * TLS_MAX_PLAINTEXT
/** Where a record's content is opened to before it is handed on: the most content a record carries. */
const TLS_RECORD_SCRATCH_SIZE: i32 = TLS_MAX_PLAINTEXT
/** A KeyUpdate message: type, a 24-bit length of 1, and `request_update`. */
const TLS_KEY_UPDATE_SIZE: i32 = 5
/** Where ServerHello and HelloRetryRequest hold `legacy_session_id_echo`'s length: past the header, version and random. */
const TLS_SESSION_ID_ECHO_AT: i32 = 38

/**
 * How many records in a row may carry nothing for the caller — a
 * `change_cipher_spec`, empty application data, a `user_canceled` warning, a
 * KeyUpdate or a piece of one — before the connection is refused with
 * `unexpected_message`. Each costs the server work, a KeyUpdate two key
 * derivations, and none moves the connection on. Sixteen is Go's
 * `maxUselessRecords`; a record of application data, or of the handshake,
 * starts the count again.
 */
export const TLS_RECORD_IDLE_LIMIT: i32 = 16

/**
 * How many KeyUpdates one connection takes from its client before refusing
 * the next with `unexpected_message`. Each costs a key derivation whose
 * temporaries stay in the arena (5,248 bytes, twice that when the server answers),
 * so the cap is what bounds that memory (TLS-3). A client that updates when
 * RFC 8446 §5.5 asks, once per 2^24 records, reaches it after 2^30 records.
 */
export const TLS_RECORD_MAX_KEY_UPDATES: i32 = 64

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const TLS_RECORD_SERVER_FROM: i32 = 0

/** A fresh copy of a traffic secret, so `TlsServer`'s own can be wiped while this one lives on. */
const tlsCopySecret = (secret: u8[] | null): u8[] => {
  if (secret === null) {
    return []
  }
  const out: u8[] = new Array<u8>(secret.length)
  for (let k: i32 = 0; k < toI32(out.length) && k < toI32(secret.length); k++) {
    out[k] = secret[k]
  }
  return out
}

/** Appends `bytes` to `queue`, which a `TlsRecordServer` seals as records once there is room. */
const tlsQueueBytes = (queue: u8[], bytes: u8[]): void => {
  for (const b of bytes) {
    queue.push(b)
  }
}

/**
 * One TLS 1.3 server connection over a stream. Allocate one per slot, hand it
 * each connection's `TlsServer` with `start`, and drive it with `receive`,
 * `consume`, `read`, `write` and `sign` as `interest` says.
 *
 * The fields are readable: `state`, `alert` (the alert this server sent, or
 * 0), `peerAlert` (the error alert the client sent, or -1), `peerClosed`
 * (the client's `close_notify` arrived), `tls` (the handshake: suite, ALPN,
 * server name, exporter secret), and the two protections with their
 * sequence numbers. `padding` is how many zero bytes each protected record
 * the server writes carries after its content type (§5.4), 0 unless the
 * caller sets it.
 */
export class TlsRecordServer {
  tls: TlsServer
  reader: TlsRecordReader
  readProtection: TlsRecordProtection
  writeProtection: TlsRecordProtection
  /** Bytes to send are `output[outputStart .. outputEnd)`. */
  output: u8[]
  /** Application data the caller has not read is `plain[plainStart .. plainEnd)`. */
  plain: u8[]
  scratch: u8[]
  /** Handshake bytes written at the Initial level and not yet in a record. */
  pendingInitial: u8[]
  /** Handshake bytes written at the Handshake level and not yet in a record. */
  pendingHandshake: u8[]
  /** The client's and the server's current application traffic secrets, for KeyUpdate. */
  readSecret: u8[]
  writeSecret: u8[]
  /** A post-handshake message the client has sent part of. */
  postHandshake: u8[]
  state: i32 = 0
  alert: i32 = 0
  peerAlert: i32 = -1
  padding: i32 = 0
  /** The `TLS_LEVEL_*` the client's records are read at: Initial in the clear, then Handshake, then Application. */
  readLevel: i32 = 0
  /** The `TLS_LEVEL_*` the server's records are written at. */
  writeLevel: i32 = 0
  outputStart: i32 = 0
  outputEnd: i32 = 0
  plainStart: i32 = 0
  plainEnd: i32 = 0
  pendingInitialAt: i32 = 0
  pendingHandshakeAt: i32 = 0
  postHandshakeLength: i32 = 0
  /** Records in a row that carried nothing for the caller, against `TLS_RECORD_IDLE_LIMIT`. */
  idleRecords: i32 = 0
  /** KeyUpdates taken from the client, against `TLS_RECORD_MAX_KEY_UPDATES`. */
  keyUpdates: i32 = 0
  peerClosed: boolean = false
  /** The client's TCP stream ended. Without a `close_notify` before it, that is truncation and the connection failed. */
  ended: boolean = false
  /** Whether the server's first handshake message has been seen, which decides the compatibility record. */
  firstMessageSeen: boolean = false
  /** The compatibility `change_cipher_spec` is owed, after the first handshake message (§D.4). */
  ccsDue: boolean = false
  /** The client's first handshake byte has arrived, which opens the window its `change_cipher_spec` may come in. */
  started: boolean = false
  /** The server owes a KeyUpdate before its next application data (§4.6.3). */
  keyUpdateDue: boolean = false
  /** The server has closed and its `close_notify` waits for room in `output`. */
  closeDue: boolean = false

  constructor(tls: TlsServer) {
    this.tls = tls
    this.reader = new TlsRecordReader()
    this.readProtection = new TlsRecordProtection()
    this.writeProtection = new TlsRecordProtection()
    this.output = new Array<u8>(TLS_RECORD_OUTPUT_SIZE)
    this.plain = new Array<u8>(TLS_RECORD_PLAIN_SIZE)
    this.scratch = new Array<u8>(TLS_RECORD_SCRATCH_SIZE)
    this.pendingInitial = []
    this.pendingHandshake = []
    this.readSecret = []
    this.writeSecret = []
    this.postHandshake = new Array<u8>(TLS_KEY_UPDATE_SIZE)
    this.start(tls)
  }

  /**
   * Starts a new connection in this slot with `tls`, which should be fresh:
   * every buffer is emptied and the keys of the last connection are wiped;
   * the buffers are reused, and only the empty handshake queues are new. A
   * `tls` that has already failed — a configuration
   * or randomness `TlsServer` refused — fails this connection at once, with
   * its alert queued in the clear.
   */
  start(tls: TlsServer): void {
    // The last connection's traffic keys. Its ephemeral key was wiped when it
    // was used, when it failed or when its slot was closed, and is not
    // touched here: the array may already hold the next connection's.
    this.wipeTraffic()
    this.readSecret = []
    this.writeSecret = []
    this.tls = tls
    this.state = TLS_RECORD_STATE_HANDSHAKE
    this.alert = 0
    this.peerAlert = -1
    this.peerClosed = false
    this.ended = false
    this.reader.reset()
    this.readLevel = TLS_LEVEL_INITIAL
    this.writeLevel = TLS_LEVEL_INITIAL
    this.dropOutput()
    this.plainStart = 0
    this.plainEnd = 0
    this.firstMessageSeen = false
    this.started = false
    this.postHandshakeLength = 0
    this.idleRecords = 0
    this.keyUpdates = 0
    if (tls.state === TLS_STATE_FAILED) {
      this.fail(tls.alert)
    }
  }

  /**
   * Wipes every key this connection holds: the two application traffic
   * secrets it keeps for KeyUpdate, both directions' keys, and what is left
   * in `TlsServer` (`wipeHandshake`). The carrier calls it when a slot is
   * closed, so a free slot holds no key.
   */
  wipeKeys(): void {
    this.wipeTraffic()
    this.wipeHandshake()
  }

  /** Wipes the two application traffic secrets and both directions' keys. */
  wipeTraffic(): void {
    secureZero(this.readSecret)
    secureZero(this.writeSecret)
    this.readProtection.clear()
    this.writeProtection.clear()
  }

  /**
   * Wipes every secret `TlsServer` still holds — the ephemeral key it was
   * handed, the handshake, traffic and exporter secrets and the expected
   * Finished — for a connection that has failed or is closed. On the way to
   * an open connection each is wiped as soon as it has been used; this is
   * for the ways that end early, and for the exporter secret, which a caller
   * may read until the connection ends.
   */
  wipeHandshake(): void {
    const tls: TlsServer = this.tls
    secureZero(tls.ephemeralPrivate)
    secureZero(tls.handshakeSecret)
    secureZero(tls.clientHandshakeSecret)
    secureZero(tls.serverHandshakeSecret)
    secureZero(tls.clientApplicationSecret)
    secureZero(tls.serverApplicationSecret)
    secureZero(tls.exporterSecret)
    secureZero(tls.expectedClientFinished)
  }

  /** How many bytes `receive` would take now: what the socket should read at most. */
  space(): i32 {
    return this.reader.space()
  }

  /**
   * Takes bytes of the client's stream, `data[off .. off + len)`, and handles
   * every record they complete. Answers how many it took, which is fewer than
   * `len` only when its buffers are full (read `interest` before reading the
   * socket again), or `TLS_RECORD_INVALID` for a window outside `data`. Once
   * the connection has failed, or the client has sent `close_notify`, bytes
   * are taken and dropped (§6.1).
   */
  receive(data: u8[], off: i32, len: i32): i32 {
    if (!tlsRecordWindowFits(toI32(data.length), off, len)) {
      return TLS_RECORD_INVALID
    }
    if (this.state === TLS_RECORD_STATE_FAILED || this.peerClosed) {
      return len
    }
    const taken: i32 = this.reader.push(data, off, len)
    this.process()
    return taken
  }

  /**
   * The client's TCP stream ended. After its `close_notify` that is the
   * orderly end; before it, the stream was cut short — truncation, which an
   * attacker on the path can cause — and the connection fails with nothing
   * sent, since there is nobody left to read it.
   */
  end(): void {
    this.ended = true
    this.process()
  }

  /**
   * Once the client's stream has ended and every whole record it held is
   * handled, an end without `close_notify` is truncation: the connection
   * fails, with nothing more sent, though what is already on `output` may
   * still go out. Records still waiting for the caller to read, or for the
   * signature, are handled first, so a `close_notify` among them counts.
   */
  checkTruncation(): void {
    if (this.ended && !this.peerClosed && this.state !== TLS_RECORD_STATE_FAILED && this.reader.next() <= 0) {
      this.state = TLS_RECORD_STATE_FAILED
      this.dropPending()
      this.wipeHandshake()
    }
  }

  /** The socket failed under the connection: it ends with nothing more sent. */
  abort(): void {
    this.state = TLS_RECORD_STATE_FAILED
    this.dropOutput()
  }

  /** Forgets everything waiting to be sent. */
  dropOutput(): void {
    this.outputStart = 0
    this.outputEnd = 0
    this.dropPending()
  }

  /** Forgets what is owed but not yet sealed: the handshake queues, the compatibility record, a KeyUpdate and a close. */
  dropPending(): void {
    this.pendingInitial = []
    this.pendingInitialAt = 0
    this.pendingHandshake = []
    this.pendingHandshakeAt = 0
    this.ccsDue = false
    this.keyUpdateDue = false
    this.closeDue = false
  }

  /**
   * Handles every whole record the reader holds, as far as the application
   * data buffer has room for. While the server waits for its signature the
   * records stay where they are, and `sign` comes back for them: a client has
   * nothing to send then but a `change_cipher_spec`, and holding the rest
   * means bytes mean the same thing however the stream was cut.
   */
  process(): void {
    while (this.state !== TLS_RECORD_STATE_FAILED && !this.peerClosed) {
      if (this.tls.state === TLS_STATE_WAIT_SIGNATURE) {
        break
      }
      const n: i32 = this.reader.next()
      if (n < 0) {
        this.fail(-n)
        return
      }
      if (n === 0) {
        break
      }
      if (this.readLevel === TLS_LEVEL_APPLICATION && !this.plainHasRoom()) {
        break
      }
      const alert: i32 = this.handleRecord(this.reader.buffer, this.reader.start, n)
      this.reader.consume(n)
      if (alert !== 0) {
        this.fail(alert)
        return
      }
    }
    this.checkTruncation()
    this.pump()
  }

  /**
   * Whether a whole record's content fits beside what the caller has not
   * read, moving that to the front when it would then fit and only then, so
   * a caller reading a byte at a time does not move the buffer each time.
   */
  plainHasRoom(): boolean {
    const capacity: i32 = toI32(this.plain.length)
    if (capacity - (this.plainEnd - this.plainStart) < TLS_MAX_PLAINTEXT) {
      return false
    }
    if (capacity - this.plainEnd < TLS_MAX_PLAINTEXT) {
      const held: i32 = this.plainEnd - this.plainStart
      for (let k: i32 = 0; k < held; k++) {
        this.plain[k] = this.plain[this.plainStart + k]
      }
      this.plainStart = 0
      this.plainEnd = held
    }
    return true
  }

  /** Counts a record that carried nothing for the caller: 0, or `unexpected_message` once there are too many in a row. */
  idle(): i32 {
    this.idleRecords = this.idleRecords + 1
    return this.idleRecords > TLS_RECORD_IDLE_LIMIT ? TLS_ALERT_UNEXPECTED_MESSAGE : 0
  }

  /**
   * One whole record, `buf[off .. off + n)`. A `change_cipher_spec` is
   * judged on its own; anything else is opened under the read protection
   * into `scratch`, and its content goes to `handleApplicationRecord` once the
   * handshake is done, to the handshake before. Answers 0 or the alert.
   */
  handleRecord(buf: u8[], off: i32, n: i32): i32 {
    if (toI32(buf[off]) === TLS_CONTENT_CHANGE_CIPHER_SPEC) {
      return this.handleChangeCipherSpec(buf, off, n - TLS_RECORD_HEADER_SIZE)
    }
    const length: i32 = this.readProtection.open(buf, off, n, this.scratch, TLS_RECORD_SERVER_FROM)
    if (length < 0) {
      return -length
    }
    if (this.readLevel === TLS_LEVEL_APPLICATION) {
      return this.handleApplicationRecord(length)
    }
    switch (this.readProtection.contentType) {
      case TLS_CONTENT_HANDSHAKE:
        return this.handleHandshake(length)
      case TLS_CONTENT_ALERT:
        // §5.1: an alert may not fall between the records of one handshake message.
        return toI32(this.tls.input.length) > 0 ? TLS_ALERT_UNEXPECTED_MESSAGE : this.handleAlert(length)
      default:
        // Application data before the client's Finished, a protected
        // change_cipher_spec (§5), or a type nobody defined.
        return TLS_ALERT_UNEXPECTED_MESSAGE
    }
  }

  /**
   * The compatibility record (§5, §D.4): one byte of 1, in the clear, from
   * the client's first ClientHello until its Finished, and not between the
   * records of one handshake message. It is dropped; anything else is
   * `unexpected_message`.
   */
  handleChangeCipherSpec(buf: u8[], off: i32, length: i32): i32 {
    if (length !== 1 || toI32(buf[off + TLS_RECORD_HEADER_SIZE]) !== 1) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    if (!this.started || this.readLevel === TLS_LEVEL_APPLICATION || toI32(this.tls.input.length) > 0) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    return this.idle()
  }

  /**
   * Handshake bytes, `scratch[0 .. length)`, for `TlsServer` at the level
   * they were read at. An empty fragment is `unexpected_message` (§5.1 forbids
   * sending one); `TlsServer`'s own answer otherwise.
   */
  handleHandshake(length: i32): i32 {
    if (length === 0) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    this.started = true
    this.idleRecords = 0
    const alert: i32 = this.tls.receive(this.readLevel, this.scratch, TLS_RECORD_SERVER_FROM, length)
    if (alert !== 0) {
      return alert
    }
    this.advance()
    return 0
  }

  /**
   * A record under the client's application keys, its `length` bytes of
   * content opened into `scratch`. Application data goes to
   * the caller's buffer, which `process` made room in; an alert and a
   * post-handshake message are handled here; and a post-handshake message the
   * client has sent part of may not be interrupted by anything else (§5.1).
   */
  handleApplicationRecord(length: i32): i32 {
    const type: i32 = this.readProtection.contentType
    if (this.postHandshakeLength > 0 && type !== TLS_CONTENT_HANDSHAKE) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    switch (type) {
      case TLS_CONTENT_APPLICATION_DATA: {
        if (length === 0) {
          return this.idle()
        }
        for (let k: i32 = 0; k < length && this.plainEnd + k < toI32(this.plain.length); k++) {
          this.plain[this.plainEnd + k] = this.scratch[k]
        }
        this.plainEnd = this.plainEnd + length
        this.idleRecords = 0
        return 0
      }
      case TLS_CONTENT_ALERT:
        return this.handleAlert(length)
      case TLS_CONTENT_HANDSHAKE:
        return length === 0 ? TLS_ALERT_UNEXPECTED_MESSAGE : this.handlePostHandshake(length)
      default:
        return TLS_ALERT_UNEXPECTED_MESSAGE
    }
  }

  /**
   * An alert, `scratch[0 .. length)` (§6): two bytes, or `decode_error`. The
   * level is not read, as §6 allows. `close_notify` ends the client's
   * stream, `user_canceled` is passed over, and any other description — one
   * this module does not know included (§6.2) — ends the connection with
   * nothing more sent.
   */
  handleAlert(length: i32): i32 {
    if (length !== 2) {
      return TLS_ALERT_DECODE_ERROR
    }
    const description: i32 = toI32(this.scratch[1])
    if (description === TLS_ALERT_CLOSE_NOTIFY) {
      this.peerClosed = true
      return 0
    }
    if (description === TLS_ALERT_USER_CANCELED) {
      return this.idle()
    }
    this.peerAlert = description
    this.state = TLS_RECORD_STATE_FAILED
    this.dropOutput()
    return 0
  }

  /**
   * Post-handshake handshake bytes, `scratch[0 .. length)`. The only message
   * a client sends this server after its Finished is KeyUpdate (no
   * certificate was requested, so no post-handshake authentication): another
   * type is `unexpected_message`, a length other than 1 `decode_error`, a
   * `request_update` other than 0 or 1 `illegal_parameter` (§4.6.3), and a
   * KeyUpdate that does not end its record `unexpected_message`, since the
   * keys change after it (§5.1). The message may start in an earlier record.
   */
  handlePostHandshake(length: i32): i32 {
    const idle: i32 = this.idle()
    if (idle !== 0) {
      return idle
    }
    // The buffer never holds a whole message: the fifth byte either ends it
    // or is refused, so `postHandshakeLength` stays below its length.
    for (let k: i32 = 0; k < length && this.postHandshakeLength < toI32(this.postHandshake.length); k++) {
      this.postHandshake[this.postHandshakeLength] = this.scratch[k]
      this.postHandshakeLength = this.postHandshakeLength + 1
      const held: i32 = this.postHandshakeLength
      if (held === 1 && toI32(this.postHandshake[0]) !== TLS_HANDSHAKE_KEY_UPDATE) {
        return TLS_ALERT_UNEXPECTED_MESSAGE
      }
      if (held === 4) {
        const body: i32 =
          (toI32(this.postHandshake[1]) << 16) |
          (toI32(this.postHandshake[2]) << 8) |
          toI32(this.postHandshake[3])
        if (body !== 1) {
          return TLS_ALERT_DECODE_ERROR
        }
      }
      if (held === TLS_KEY_UPDATE_SIZE) {
        const request: i32 = toI32(this.postHandshake[4])
        if (request > 1) {
          return TLS_ALERT_ILLEGAL_PARAMETER
        }
        if (k !== length - 1) {
          return TLS_ALERT_UNEXPECTED_MESSAGE
        }
        this.postHandshakeLength = 0
        if (this.keyUpdates >= TLS_RECORD_MAX_KEY_UPDATES) {
          return TLS_ALERT_UNEXPECTED_MESSAGE
        }
        this.keyUpdates = this.keyUpdates + 1
        return this.updateReadKeys(request === 1)
      }
    }
    return 0
  }

  /**
   * The client's KeyUpdate: its next records are under the next secret
   * (§7.2), the old one wiped. When it asked for an update the server owes
   * one of its own before its next application data, which `pump` sends.
   * Answers 0, or `internal_error` when the keys do not install, which only
   * a secret of the wrong length could cause.
   */
  updateReadKeys(requested: boolean): i32 {
    if (!this.readProtection.advance(this.readSecret)) {
      return TLS_ALERT_INTERNAL_ERROR
    }
    if (requested) {
      this.keyUpdateDue = true
    }
    return 0
  }

  /**
   * Picks up what `TlsServer` did with the last bytes or the signature: its
   * ServerHello or HelloRetryRequest, the read keys of each level as they
   * appear, the signed flight, and the end of the handshake. The secrets it
   * hands over are copied or installed and then wiped in `TlsServer`, so
   * that only this connection holds them.
   */
  advance(): void {
    const tls: TlsServer = this.tls
    const initial: u8[] = tls.takeOutput(TLS_LEVEL_INITIAL)
    if (toI32(initial.length) > 0) {
      // §D.4: in compatibility mode, which a client asks for with a session
      // id, the server's first handshake message is followed by a
      // change_cipher_spec. The server echoes the id, so its own message says.
      if (!this.firstMessageSeen) {
        this.firstMessageSeen = true
        this.ccsDue =
          toI32(initial.length) > TLS_SESSION_ID_ECHO_AT && toI32(initial[TLS_SESSION_ID_ECHO_AT]) > 0
      }
      tlsQueueBytes(this.pendingInitial, initial)
    }
    if (this.readLevel === TLS_LEVEL_INITIAL) {
      const handshake: u8[] | null = tls.readSecret(TLS_LEVEL_HANDSHAKE)
      if (handshake !== null) {
        this.readProtection.install(tls.suite, handshake)
        this.readLevel = TLS_LEVEL_HANDSHAKE
      }
    }
    if (tls.state !== TLS_STATE_WAIT_CLIENT_HELLO) {
      // The ServerHello is written, so the exchange is done with the key.
      secureZero(tls.ephemeralPrivate)
    }
    if (tls.state === TLS_STATE_WAIT_FINISHED || tls.state === TLS_STATE_CONNECTED) {
      tlsQueueBytes(this.pendingHandshake, tls.takeOutput(TLS_LEVEL_HANDSHAKE))
      // The flight is signed and finished: the handshake secret and the
      // client's handshake secret have done their work in `TlsServer`, and
      // the read keys made from the latter are installed.
      secureZero(tls.handshakeSecret)
      secureZero(tls.clientHandshakeSecret)
    }
    if (tls.state === TLS_STATE_CONNECTED && this.readLevel === TLS_LEVEL_HANDSHAKE) {
      this.readSecret = tlsCopySecret(tls.readSecret(TLS_LEVEL_APPLICATION))
      secureZero(tls.clientApplicationSecret)
      // A direction whose keys did not install would read in the clear.
      if (!this.readProtection.install(tls.suite, this.readSecret)) {
        this.fail(TLS_ALERT_INTERNAL_ERROR)
        return
      }
      this.readLevel = TLS_LEVEL_APPLICATION
      if (this.state === TLS_RECORD_STATE_HANDSHAKE) {
        this.state = TLS_RECORD_STATE_OPEN
      }
    }
    this.pump()
  }

  /** Whether `need` more bytes fit in `output`, moving what is unsent to the front first. */
  outputHasRoom(need: i32): boolean {
    const capacity: i32 = toI32(this.output.length)
    if (this.outputEnd + need > capacity && this.outputStart > 0) {
      const held: i32 = this.outputEnd - this.outputStart
      for (let k: i32 = 0; k < held; k++) {
        this.output[k] = this.output[this.outputStart + k]
      }
      this.outputStart = 0
      this.outputEnd = held
    }
    return this.outputEnd + need <= capacity
  }

  /**
   * The most content one record may carry under the write protection as it
   * stands: 2^14 bytes, less the padding each protected record carries, since
   * the content, its type and the padding together may not pass 2^14 + 1
   * (§5.4). Below 1 when the padding leaves no room at all.
   */
  maxChunk(): i32 {
    return TLS_MAX_PLAINTEXT - this.writePadding()
  }

  /** The padding the next record carries: `padding` once records are protected, none in the clear. */
  writePadding(): i32 {
    return this.writeProtection.isProtected() ? this.padding : 0
  }

  /** The room a record of `len` content bytes takes in `output` under the write protection as it stands. */
  recordRoom(len: i32): i32 {
    if (!this.writeProtection.isProtected()) {
      return TLS_RECORD_HEADER_SIZE + len
    }
    return TLS_RECORD_HEADER_SIZE + len + 1 + this.writePadding() + TLS_RECORD_TAG_SIZE
  }

  /**
   * Seals one record of `type` from `data[off .. off + len)` onto `output`
   * under the write protection, padded when it is protected. False, writing
   * nothing, when it does not fit; a refusal from `seal` itself, which only a
   * mistake here could cause, fails the connection.
   */
  sealRecord(type: i32, data: u8[], off: i32, len: i32): boolean {
    if (!this.outputHasRoom(this.recordRoom(len))) {
      return false
    }
    const n: i32 = this.writeProtection.seal(
      type,
      data,
      off,
      len,
      this.writePadding(),
      this.output,
      this.outputEnd
    )
    if (n < 0) {
      this.fail(-n)
      return false
    }
    this.outputEnd = this.outputEnd + n
    return true
  }

  /**
   * Seals as much of `queue[at ..)` as fits, in records of at most
   * `maxChunk()` bytes, and answers where it stopped. A padding that leaves
   * no room for content fails the connection with `internal_error`.
   */
  sealQueue(queue: u8[], at: i32): i32 {
    let next: i32 = at
    const length: i32 = toI32(queue.length)
    const most: i32 = this.maxChunk()
    if (most < 1 && next < length) {
      this.fail(TLS_ALERT_INTERNAL_ERROR)
      return next
    }
    while (next < length && this.state !== TLS_RECORD_STATE_FAILED) {
      const left: i32 = length - next
      const chunk: i32 = left < most ? left : most
      if (!this.sealRecord(TLS_CONTENT_HANDSHAKE, queue, next, chunk)) {
        return next
      }
      next = next + chunk
    }
    return next
  }

  /**
   * Moves what is owed onto `output` as far as it fits, in the order the
   * client must read it: the Initial-level messages in the clear, the
   * compatibility record, the flight under the handshake keys, and then the
   * switch to the application keys, with the server's handshake and
   * application secrets wiped in `TlsServer` once they are installed here. A
   * KeyUpdate owed to the client goes last.
   */
  pump(): void {
    if (this.state === TLS_RECORD_STATE_FAILED) {
      return
    }
    // After its close_notify the server sends nothing more (§6.1).
    if (this.state === TLS_RECORD_STATE_CLOSED) {
      if (this.closeDue && this.sendAlert(TLS_ALERT_LEVEL_WARNING, TLS_ALERT_CLOSE_NOTIFY)) {
        this.closeDue = false
      }
      return
    }
    const tls: TlsServer = this.tls
    // Each queue is replaced only once it has emptied, so a connection past
    // its handshake allocates nothing here.
    if (toI32(this.pendingInitial.length) > 0) {
      this.pendingInitialAt = this.sealQueue(this.pendingInitial, this.pendingInitialAt)
      if (this.pendingInitialAt < toI32(this.pendingInitial.length)) {
        return
      }
      this.pendingInitial = []
      this.pendingInitialAt = 0
    }
    if (this.ccsDue) {
      const ccs: u8[] = [toU8(1)]
      const one: i32 = 1
      if (!this.sealRecord(TLS_CONTENT_CHANGE_CIPHER_SPEC, ccs, TLS_RECORD_SERVER_FROM, one)) {
        return
      }
      this.ccsDue = false
    }
    // Everything the server sends after its ServerHello is under the
    // handshake keys (§2), an alert before the flight included, so they go
    // in as soon as the ServerHello is sealed. `install` refuses only a suite
    // or a secret `TlsServer` never hands over; the check keeps the flight
    // from ever being sealed in the clear.
    const handshake: u8[] | null = tls.writeSecret(TLS_LEVEL_HANDSHAKE)
    if (this.writeLevel === TLS_LEVEL_INITIAL && handshake !== null) {
      if (!this.writeProtection.install(tls.suite, handshake)) {
        this.fail(TLS_ALERT_INTERNAL_ERROR)
        return
      }
      this.writeLevel = TLS_LEVEL_HANDSHAKE
    }
    if (toI32(this.pendingHandshake.length) > 0) {
      this.pendingHandshakeAt = this.sealQueue(this.pendingHandshake, this.pendingHandshakeAt)
      if (this.pendingHandshakeAt < toI32(this.pendingHandshake.length)) {
        return
      }
      this.pendingHandshake = []
      this.pendingHandshakeAt = 0
    }
    if (
      this.writeLevel === TLS_LEVEL_HANDSHAKE &&
      (tls.state === TLS_STATE_WAIT_FINISHED || tls.state === TLS_STATE_CONNECTED)
    ) {
      this.writeSecret = tlsCopySecret(tls.writeSecret(TLS_LEVEL_APPLICATION))
      secureZero(tls.serverApplicationSecret)
      secureZero(tls.serverHandshakeSecret)
      // A direction whose keys did not install would write in the clear.
      if (!this.writeProtection.install(tls.suite, this.writeSecret)) {
        this.fail(TLS_ALERT_INTERNAL_ERROR)
        return
      }
      this.writeLevel = TLS_LEVEL_APPLICATION
    }
    if (this.keyUpdateDue && this.writeLevel === TLS_LEVEL_APPLICATION && this.sendKeyUpdate(false)) {
      this.keyUpdateDue = false
    }
  }

  /**
   * Seals a KeyUpdate under the current write keys and moves the write side
   * to the next secret (§4.6.3, §7.2), the old one wiped. False, sending
   * nothing, when it does not fit in `output` yet.
   */
  sendKeyUpdate(request: boolean): boolean {
    const message: u8[] = [toU8(TLS_HANDSHAKE_KEY_UPDATE), toU8(0), toU8(0), toU8(1), toU8(request ? 1 : 0)]
    if (!this.sealRecord(TLS_CONTENT_HANDSHAKE, message, TLS_RECORD_SERVER_FROM, TLS_KEY_UPDATE_SIZE)) {
      return false
    }
    if (!this.writeProtection.advance(this.writeSecret)) {
      this.fail(TLS_ALERT_INTERNAL_ERROR)
      return false
    }
    return true
  }

  /**
   * Sends a KeyUpdate now, asking the client to update too when
   * `requestPeer` (§4.6.3). Answers 0, `TLS_RECORD_AGAIN` while the handshake
   * is under way or `output` is full, `TLS_RECORD_PIPE` once the server has
   * closed or the connection failed, or `TLS_RECORD_RESET` when the next keys
   * do not install and the connection fails on it.
   */
  keyUpdate(requestPeer: boolean): i32 {
    if (this.state === TLS_RECORD_STATE_FAILED || this.state === TLS_RECORD_STATE_CLOSED) {
      return TLS_RECORD_PIPE
    }
    if (this.state !== TLS_RECORD_STATE_OPEN) {
      return TLS_RECORD_AGAIN
    }
    this.pump()
    if (this.keyUpdateDue || !this.sendKeyUpdate(requestPeer)) {
      return this.state === TLS_RECORD_STATE_FAILED ? TLS_RECORD_RESET : TLS_RECORD_AGAIN
    }
    return 0
  }

  /**
   * Fails the connection with `alert`, sent as a fatal alert under whatever
   * the server writes with now, in the clear before its first keys. What
   * was still owed is dropped: the alert is the last thing the server sends.
   */
  fail(alert: i32): void {
    if (this.state === TLS_RECORD_STATE_FAILED) {
      return
    }
    const closed: boolean = this.state === TLS_RECORD_STATE_CLOSED
    this.dropPending()
    this.wipeHandshake()
    // Failed first, so a seal that refuses the alert cannot come back here.
    this.state = TLS_RECORD_STATE_FAILED
    this.alert = alert
    // A server that has sent its close_notify sends nothing after it (§6.1).
    if (!closed) {
      this.sendAlert(TLS_ALERT_LEVEL_FATAL, alert)
    }
  }

  /** Seals an alert record of `level` and `description`; false, sending nothing, when `output` has no room for it. */
  sendAlert(level: i32, description: i32): boolean {
    const body: u8[] = [toU8(level), toU8(description)]
    const two: i32 = 2
    return this.sealRecord(TLS_CONTENT_ALERT, body, TLS_RECORD_SERVER_FROM, two)
  }

  /**
   * Lets the first `n` bytes of `output` go, once the socket has taken them,
   * and seals what was waiting for the room.
   */
  consume(n: i32): void {
    const held: i32 = this.outputEnd - this.outputStart
    let take: i32 = n < held ? n : held
    if (take < 0) {
      take = 0
    }
    this.outputStart = this.outputStart + take
    if (this.outputStart === this.outputEnd) {
      this.outputStart = 0
      this.outputEnd = 0
    }
    this.pump()
  }

  /**
   * Application data for the client, `data[off .. off + len)`: seals as much
   * as fits, in records of at most 2^14 bytes, and answers how much that
   * was, as a socket write does. A KeyUpdate goes first when the key has
   * protected `recordLimit` records, or the client asked for one.
   * `TLS_RECORD_AGAIN` while the handshake is under way or nothing fits,
   * `TLS_RECORD_PIPE` once the server has closed or the connection failed,
   * and `TLS_RECORD_INVALID` for a window outside `data`.
   */
  write(data: u8[], off: i32, len: i32): i32 {
    if (!tlsRecordWindowFits(toI32(data.length), off, len)) {
      return TLS_RECORD_INVALID
    }
    if (this.state === TLS_RECORD_STATE_FAILED || this.state === TLS_RECORD_STATE_CLOSED) {
      return TLS_RECORD_PIPE
    }
    this.pump()
    if (
      this.state !== TLS_RECORD_STATE_OPEN ||
      this.keyUpdateDue ||
      this.writeLevel !== TLS_LEVEL_APPLICATION
    ) {
      return TLS_RECORD_AGAIN
    }
    let done: i32 = 0
    while (done < len && this.state === TLS_RECORD_STATE_OPEN) {
      if (this.writeProtection.sequence >= this.writeProtection.recordLimit && !this.sendKeyUpdate(false)) {
        break
      }
      const most: i32 = this.maxChunk()
      if (most < 1) {
        this.fail(TLS_ALERT_INTERNAL_ERROR)
        break
      }
      const left: i32 = len - done
      let chunk: i32 = left < most ? left : most
      // A record shortened to the room there is, rather than none at all.
      this.outputHasRoom(this.recordRoom(chunk))
      const room: i32 = toI32(this.output.length) - this.outputEnd - this.recordRoom(TLS_RECORD_SERVER_FROM)
      if (room < chunk) {
        chunk = room
      }
      if (chunk <= 0 || !this.sealRecord(TLS_CONTENT_APPLICATION_DATA, data, off + done, chunk)) {
        break
      }
      done = done + chunk
    }
    if (done === 0 && len > 0) {
      return this.state === TLS_RECORD_STATE_FAILED ? TLS_RECORD_RESET : TLS_RECORD_AGAIN
    }
    return done
  }

  /**
   * Application data from the client, into `buf[off .. off + len)`: the
   * count, as a socket read answers; 0 at the end of its stream (its
   * `close_notify`) or for a `len` of 0; `TLS_RECORD_AGAIN` when nothing is
   * waiting; `TLS_RECORD_RESET` once the connection has failed; and
   * `TLS_RECORD_INVALID` for a window outside `buf`. Reading makes room, so
   * records the buffer was full for are handled before it answers.
   */
  read(buf: u8[], off: i32, len: i32): i32 {
    if (!tlsRecordWindowFits(toI32(buf.length), off, len)) {
      return TLS_RECORD_INVALID
    }
    if (len === 0) {
      return 0
    }
    const avail: i32 = this.plainEnd - this.plainStart
    if (avail > 0) {
      const n: i32 = avail < len ? avail : len
      for (let k: i32 = 0; k < n; k++) {
        buf[off + k] = this.plain[this.plainStart + k]
      }
      this.plainStart = this.plainStart + n
      if (this.plainStart === this.plainEnd) {
        this.plainStart = 0
        this.plainEnd = 0
      }
      this.process()
      return n
    }
    if (this.state === TLS_RECORD_STATE_FAILED) {
      return TLS_RECORD_RESET
    }
    return this.peerClosed ? 0 : TLS_RECORD_AGAIN
  }

  /**
   * Closes the server's side (§6.1): a `close_notify`, after which `write`
   * answers `TLS_RECORD_PIPE` and nothing more is sent. What was still owed
   * of the handshake is dropped; application data already written stays
   * ahead of the alert, which waits for room in `output` when there is none.
   * Nothing happens once the connection has failed or closed.
   */
  close(): void {
    if (this.state === TLS_RECORD_STATE_FAILED || this.state === TLS_RECORD_STATE_CLOSED) {
      return
    }
    this.dropPending()
    this.state = TLS_RECORD_STATE_CLOSED
    this.closeDue = true
    this.pump()
  }

  /** What the CertificateVerify signs, while `interest` says `TLS_RECORD_SIGN`; `null` otherwise. */
  signatureInput(): u8[] | null {
    if (this.state !== TLS_RECORD_STATE_HANDSHAKE) {
      return null
    }
    return this.tls.signatureInput()
  }

  /**
   * Takes the signature over `signatureInput()` (DER for ECDSA, as
   * `tlsSignEcdsaP256` answers it) and seals the rest of the flight. Answers
   * 0, or the alert the connection failed with — `internal_error` when no
   * signature is due.
   */
  sign(signature: u8[]): i32 {
    if (this.state !== TLS_RECORD_STATE_HANDSHAKE) {
      return this.state === TLS_RECORD_STATE_FAILED ? this.alert : TLS_ALERT_INTERNAL_ERROR
    }
    const alert: i32 = this.tls.sign(signature)
    if (alert !== 0) {
      this.fail(alert)
      return alert
    }
    this.advance()
    this.process()
    return this.state === TLS_RECORD_STATE_FAILED ? this.alert : 0
  }

  /**
   * What the connection wants next, as `TLS_RECORD_*` bits: read the socket
   * (there is room, and the stream has not ended), write it (`output` holds
   * bytes), `read` (application data, or the end of the client's stream),
   * sign, or nothing more ever (`TLS_RECORD_DONE`: failed or closed, and
   * everything is sent).
   */
  interest(): i32 {
    let bits: i32 = 0
    const sending: boolean = this.outputEnd > this.outputStart || this.closeDue
    if (sending) {
      bits = bits | TLS_RECORD_WANT_WRITE
    }
    const failed: boolean = this.state === TLS_RECORD_STATE_FAILED
    if ((failed || this.state === TLS_RECORD_STATE_CLOSED) && !sending) {
      bits = bits | TLS_RECORD_DONE
    }
    // Only a live connection reads: once the server has closed or the
    // connection failed, `TLS_RECORD_DONE` follows as soon as all is sent.
    const live: boolean = this.state === TLS_RECORD_STATE_HANDSHAKE || this.state === TLS_RECORD_STATE_OPEN
    // A whole record still held means the application data buffer is full:
    // the client waits until the caller reads.
    const blocked: boolean = this.reader.next() > 0
    if (live && !this.peerClosed && !this.ended && !blocked && this.reader.space() > 0) {
      bits = bits | TLS_RECORD_WANT_READ
    }
    // The end of the client's stream is news only while the connection is
    // live; once it is done, `TLS_RECORD_DONE` says everything.
    if (this.plainEnd > this.plainStart || (this.peerClosed && live)) {
      bits = bits | TLS_RECORD_DATA
    }
    if (this.state === TLS_RECORD_STATE_HANDSHAKE && this.tls.state === TLS_STATE_WAIT_SIGNATURE) {
      bits = bits | TLS_RECORD_SIGN
    }
    return bits
  }
}
