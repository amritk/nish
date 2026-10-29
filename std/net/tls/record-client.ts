/**
 * `nish/net/tls/record-client` — a TLS 1.3 client over a byte stream: the
 * record layer of `nish/net/tls/record` wrapped around `nish/net/tls-client`'s
 * `TlsClient`, sans-IO, the mirror of `nish/net/tls/record-server`. Bytes the
 * server sent go in, bytes to send come out, and once the handshake is done
 * application data flows both ways.
 *
 *     const conn = new TlsRecordClient(new TlsClient(config, random, key));
 *     conn.start();
 *     // send conn.output[conn.outputStart .. conn.outputEnd), then conn.consume(sent)
 *     conn.receive(bytes, 0, n);                 // what the socket read
 *     if ((conn.interest() & TLS_RECORD_CLIENT_AUTHENTICATE) !== 0) {
 *       tlsRecordClientAuthenticate(conn, auth, verifyChain, verifySignature);
 *     }
 *     const got: i32 = conn.read(buf, 0, buf.length);   // application data
 *
 * **What it adds to `TlsClient`.** Records around the handshake messages: the
 * ClientHello (and a second one after a HelloRetryRequest) in the clear, the
 * client's Finished under its handshake keys, and every key installed at the
 * record boundary RFC 8446 §5.1 puts it on. The ClientHello's legacy session
 * id is empty, so no compatibility `change_cipher_spec` is owed (§D.4); one
 * from the server — a single byte of 1 in the clear, before its Finished and
 * not inside a handshake message — is dropped, and any other is
 * `unexpected_message`. Alerts (§6) both ways: `close_notify` ends the
 * server's stream, `user_canceled` is passed over, any other alert ends the
 * connection, and a refusal of this module's or of `TlsClient`'s is sent as
 * a fatal alert under whatever keys the client writes with. After the
 * handshake the server may send a NewSessionTicket, which is read to its end
 * and dropped (no resumption is offered), and KeyUpdate both ways (§4.6.3):
 * the server's moves the read keys on and, when it asks, the client answers
 * with its own; `keyUpdate` sends one, and the writer sends one by itself
 * before a key has protected `TLS_KEY_UPDATE_RECORDS` records. More than
 * `TLS_RECORD_CLIENT_IDLE_LIMIT` records in a row that carry nothing for the
 * caller are refused. A record longer than 2^14 + 256 bytes is
 * `record_overflow` before any of it is opened. A stream that ends without
 * `close_notify` is truncation, once the records still waiting for the
 * caller have been read.
 *
 * **Authentication waits on the caller.** While `TlsClient` waits for the
 * verdict on the server's certificate chain and CertificateVerify,
 * `interest` says `TLS_RECORD_CLIENT_AUTHENTICATE` and records stay in the
 * reader; `authenticate` (or `tlsRecordClientAuthenticate`, which asks the
 * caller's two verifiers) hands the verdict on and handles them.
 *
 * **Secrets.** Each traffic secret is a `Secret<u8[]>` (`nish:secret`):
 * `TlsClient` holds the handshake's, and this connection holds the two
 * application traffic secrets in four readonly fields, one per direction and
 * hash length, with `readHash` and `writeHash` saying which of each pair is
 * live. A secret is copied out of `TlsClient` as it is installed and the
 * client's copy is zeroed; the handshake traffic secrets are the Finished
 * keys as well, so they are zeroed only once the client is connected — the
 * server's once its Finished is verified, the client's once its own Finished
 * is sealed. Every way the connection ends wipes what it holds: a failure of
 * any kind wipes both directions' keys, both secrets, everything `TlsClient`
 * holds and the record buffers once the last alert is sealed; the client's
 * `close_notify`, once sealed, wipes the write direction, and the server's the
 * read direction. No secret leaves either object but through `expose`
 * (`docs/security/tls-client.md`).
 *
 * Refusals are alerts, never panics. Written from RFC 8446 §4.6, §5, §6 and
 * §D.4, not ported from another implementation.
 */
import {
  TLS_LEVEL_APPLICATION,
  TLS_LEVEL_HANDSHAKE,
  TLS_LEVEL_INITIAL,
  TLS_SECRET_CLIENT_APPLICATION,
  TLS_SECRET_CLIENT_HANDSHAKE,
  TLS_SECRET_SERVER_APPLICATION,
  TLS_SECRET_SERVER_HANDSHAKE,
  TlsSecretPool,
  tlsHeldClone,
  tlsHeldCopyIn,
  tlsHeldCopyOver,
} from "nish/net/tls"
import {
  TLS_CLIENT_STATE_CONNECTED,
  TLS_CLIENT_STATE_FAILED,
  TLS_CLIENT_STATE_WAIT_AUTHENTICATION,
  TlsClient,
} from "nish/net/tls-client"
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret"
import { SHA256_SIZE } from "nish/crypto/sha256"
import { SHA384_SIZE } from "nish/crypto/sha512"
import {
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_UNEXPECTED_MESSAGE,
  TLS_HANDSHAKE_NEW_SESSION_TICKET,
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
export const TLS_RECORD_CLIENT_STATE_HANDSHAKE: i32 = 0
/** The server's Finished verified: application data flows both ways. */
export const TLS_RECORD_CLIENT_STATE_OPEN: i32 = 1
/** The client's `close_notify` is written; it sends nothing more, and may still read. */
export const TLS_RECORD_CLIENT_STATE_CLOSED: i32 = 2
/** The connection ended on an alert, sent (`alert`) or received (`peerAlert`), or on a stream cut short. */
export const TLS_RECORD_CLIENT_STATE_FAILED: i32 = 3

// ---- What the connection wants, from `interest` -----------------------------------

/** There is room for more of the stream: read the socket. */
export const TLS_RECORD_CLIENT_WANT_READ: i32 = 1
/** `output` holds bytes to send: write the socket. */
export const TLS_RECORD_CLIENT_WANT_WRITE: i32 = 2
/** `read` has application data, or the end of the server's stream, to give. */
export const TLS_RECORD_CLIENT_DATA: i32 = 4
/** The client waits for the verdict on the server's chain and signature: `authenticate`. */
export const TLS_RECORD_CLIENT_AUTHENTICATE: i32 = 8
/** Nothing more will happen: the connection failed or closed, and everything to send is sent. */
export const TLS_RECORD_CLIENT_DONE: i32 = 16

/** What `read` and `write` answer once the connection has failed: Linux's ECONNRESET, as `nish:net` spells it. */
export const TLS_RECORD_CLIENT_RESET: i32 = -104
/** What `write` answers once the client has closed: Linux's EPIPE, as `nish:net` spells it. */
export const TLS_RECORD_CLIENT_PIPE: i32 = -32
/** What `read`, `write` and `keyUpdate` answer when they have to wait: Linux's EAGAIN, as `nish:net` spells it. */
export const TLS_RECORD_CLIENT_AGAIN: i32 = -11
/** What `read` and `write` answer for a window outside the caller's array: Linux's EINVAL. */
export const TLS_RECORD_CLIENT_INVALID: i32 = -22

/**
 * How many records in a row may carry nothing for the caller — a
 * `change_cipher_spec`, empty application data, a `user_canceled` warning, a
 * KeyUpdate, a NewSessionTicket or a piece of one — before the connection is
 * refused with `unexpected_message`. Sixteen, as the server's
 * `TLS_RECORD_IDLE_LIMIT`; a record of application data, or of the
 * handshake, starts the count again.
 */
export const TLS_RECORD_CLIENT_IDLE_LIMIT: i32 = 16

/**
 * How many KeyUpdates one connection takes from its server before refusing
 * the next with `unexpected_message`, as the server's
 * `TLS_RECORD_MAX_KEY_UPDATES` bounds its client's: each costs a key install,
 * two when the client answers.
 */
export const TLS_RECORD_CLIENT_MAX_KEY_UPDATES: i32 = 64

/**
 * The longest NewSessionTicket body RFC 8446 §4.6.1 allows: lifetime and
 * age_add (8), a nonce of up to 255 bytes with its length (256), a ticket of
 * up to 2^16 - 1 bytes and extensions of up to 2^16 - 1, each with its
 * two-byte length. A longer one is `decode_error`.
 */
export const TLS_RECORD_CLIENT_MAX_TICKET: i32 = 131336

/** The shortest: an empty nonce, a one-byte ticket and no extensions. */
const TLS_RECORD_CLIENT_MIN_TICKET: i32 = 14

/** The output buffer: two of the largest records, so a record can be sealed while another is still being sent. */
const TLS_RECORD_CLIENT_OUTPUT_SIZE: i32 = 2 * TLS_MAX_RECORD
/** The application data buffer: two records' worth, so one is opened while the caller reads the other. */
const TLS_RECORD_CLIENT_PLAIN_SIZE: i32 = 2 * TLS_MAX_PLAINTEXT
/** A KeyUpdate message: type, a 24-bit length of 1, and `request_update`. */
const TLS_RECORD_CLIENT_KEY_UPDATE_SIZE: i32 = 5
/** A handshake message header: type and a 24-bit length. */
const TLS_RECORD_CLIENT_HEADER: i32 = 4

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const TLS_RECORD_CLIENT_FROM: i32 = 0

/** Zeroes the bytes a traffic secret field holds, for `exposeWith`; answers 0. */
const tlsClientTrafficZero = (held: u8[], answer: i32): i32 => {
  wipe(held)
  return answer
}

/**
 * Installs `protection` under `suite` from the traffic secret `held`, derived
 * from a plain copy that dies with the arena block and is zeroed before it
 * ends; false, as `install` answers, when the keys do not install.
 */
const tlsClientInstallHeld = (protection: TlsRecordProtection, suite: i32, held: Secret<u8[]>): boolean => {
  using _scope = arena()
  const plain: u8[] = expose(held, tlsHeldClone)
  const installed: boolean = protection.install(suite, plain)
  secureZero(plain)
  return installed
}

/**
 * Moves `protection` to the next traffic secret (§7.2) and writes it over
 * `held`'s bytes in place, the KeyUpdate step; the plain copy dies with the
 * arena block, zeroed. False when the keys do not install.
 */
const tlsClientAdvanceHeld = (protection: TlsRecordProtection, held: Secret<u8[]>): boolean => {
  using _scope = arena()
  const plain: u8[] = expose(held, tlsHeldClone)
  const installed: boolean = protection.advance(plain)
  exposeWith(held, plain, tlsHeldCopyIn)
  secureZero(plain)
  return installed
}

/**
 * One TLS 1.3 client connection over a stream. Make it around a fresh
 * `TlsClient`, call `start`, and drive it with `receive`, `consume`, `read`,
 * `write` and `authenticate` as `interest` says.
 *
 * The fields are readable: `state`, `alert` (the alert this client sent, or
 * 0), `peerAlert` (the error alert the server sent, or -1), `peerClosed` (the
 * server's `close_notify` arrived), `tls` (the handshake: suite, ALPN, the
 * server's chain, the exporter secret), and the two protections with their
 * sequence numbers. `padding` is how many zero bytes each protected record
 * the client writes carries after its content type (§5.4).
 */
export class TlsRecordClient {
  tls: TlsClient
  reader: TlsRecordReader
  readProtection: TlsRecordProtection
  writeProtection: TlsRecordProtection
  /** Bytes to send are `output[outputStart .. outputEnd)`. */
  output: u8[]
  /** Application data the caller has not read is `plain[plainStart .. plainEnd)`. */
  plain: u8[]
  /** Where a record is opened to. */
  scratch: u8[]
  /** The server's and the client's current application traffic secrets, for KeyUpdate, at both hash lengths. */
  readonly readTraffic256: Secret<u8[]>
  readonly readTraffic384: Secret<u8[]>
  readonly writeTraffic256: Secret<u8[]>
  readonly writeTraffic384: Secret<u8[]>
  /** The header of a post-handshake message the server has sent part of, and a KeyUpdate's last byte. */
  postHandshake: u8[]
  readHash: i32 = 0
  writeHash: i32 = 0
  state: i32 = 0
  alert: i32 = 0
  peerAlert: i32 = -1
  padding: i32 = 0
  /** The `TLS_LEVEL_*` the server's records are read at: Initial in the clear, then Handshake, then Application. */
  readLevel: i32 = 0
  /** The `TLS_LEVEL_*` the client's records are written at. */
  writeLevel: i32 = 0
  outputStart: i32 = 0
  outputEnd: i32 = 0
  plainStart: i32 = 0
  plainEnd: i32 = 0
  /** How much of `TlsClient`'s Initial-level output is already in records. */
  pendingInitialAt: i32 = 0
  /** How much of `TlsClient`'s Handshake-level output, its Finished, is already in records. */
  pendingHandshakeAt: i32 = 0
  /** How many bytes of `postHandshake` hold the message being read. */
  postHandshakeLength: i32 = 0
  /** How many bytes of a NewSessionTicket's body are still to be dropped. */
  ticketLeft: i32 = 0
  /** Records in a row that carried nothing for the caller, against `TLS_RECORD_CLIENT_IDLE_LIMIT`. */
  idleRecords: i32 = 0
  /** KeyUpdates taken from the server, against `TLS_RECORD_CLIENT_MAX_KEY_UPDATES`. */
  keyUpdates: i32 = 0
  peerClosed: boolean = false
  /** The server's TCP stream ended. Without a `close_notify` before it, that is truncation and the connection failed. */
  ended: boolean = false
  /** The client owes a KeyUpdate before its next application data (§4.6.3). */
  keyUpdateDue: boolean = false
  /** The client has closed and its `close_notify` waits for room in `output`. */
  closeDue: boolean = false
  /** The record buffers are zeroed, once the connection has ended. */
  buffersWiped: boolean = false

  constructor(tls: TlsClient) {
    this.tls = tls
    this.reader = new TlsRecordReader()
    this.readProtection = new TlsRecordProtection()
    this.writeProtection = new TlsRecordProtection()
    this.output = new Array<u8>(TLS_RECORD_CLIENT_OUTPUT_SIZE)
    this.plain = new Array<u8>(TLS_RECORD_CLIENT_PLAIN_SIZE)
    this.scratch = new Array<u8>(TLS_MAX_PLAINTEXT)
    this.readTraffic256 = secret(new Array<u8>(SHA256_SIZE))
    this.readTraffic384 = secret(new Array<u8>(SHA384_SIZE))
    this.writeTraffic256 = secret(new Array<u8>(SHA256_SIZE))
    this.writeTraffic384 = secret(new Array<u8>(SHA384_SIZE))
    this.postHandshake = new Array<u8>(TLS_RECORD_CLIENT_KEY_UPDATE_SIZE)
  }

  /**
   * Writes the first ClientHello onto `output`, in the clear. Answers 0, or
   * the alert the connection failed with; a `TlsClient` the constructor
   * refused fails here with its alert queued in the clear.
   */
  start(): i32 {
    if (this.state !== TLS_RECORD_CLIENT_STATE_HANDSHAKE || this.tls.state === TLS_CLIENT_STATE_FAILED) {
      if (this.state === TLS_RECORD_CLIENT_STATE_HANDSHAKE) {
        this.fail(this.tls.alert)
      }
      return this.alert !== 0 ? this.alert : TLS_ALERT_INTERNAL_ERROR
    }
    const alert: i32 = this.tls.start()
    if (alert !== 0) {
      this.fail(alert)
      return alert
    }
    this.pump()
    return this.state === TLS_RECORD_CLIENT_STATE_FAILED ? this.alert : 0
  }

  /**
   * Wipes everything this connection holds: both application traffic secrets
   * at both hash lengths, both directions' keys, everything `TlsClient`
   * holds, and the record buffers but for an alert still waiting in
   * `output`.
   */
  wipe(): void {
    wipe(this.readTraffic256)
    wipe(this.readTraffic384)
    wipe(this.writeTraffic256)
    wipe(this.writeTraffic384)
    this.readHash = 0
    this.writeHash = 0
    this.readProtection.clear()
    this.writeProtection.clear()
    this.tls.wipe()
    this.wipeBuffers()
  }

  /**
   * Zeroes the record buffers once, as the connection ends: the record held
   * in the reader is dropped, and `output` is zeroed but for what is still to
   * be sent, which is never more than a last alert. Application data the
   * caller has not read stays for `read`, as on the server: it was opened
   * under the keys and is the server's, and many servers end with the
   * socket's close rather than `close_notify`. `read` zeroes `plain` once it
   * has given the last of it.
   */
  wipeBuffers(): void {
    if (this.buffersWiped) {
      return
    }
    this.buffersWiped = true
    if (this.plainStart === this.plainEnd) {
      this.plainStart = 0
      this.plainEnd = 0
      secureZero(this.plain)
    }
    secureZero(this.scratch)
    secureZero(this.postHandshake)
    this.reader.reset()
    for (let k: i32 = 0; k < this.outputStart; k++) {
      this.output[k] = toU8(0)
    }
  }

  /** Wipes the server's application traffic secret and the read keys. */
  wipeRead(): void {
    exposeWith(this.readTraffic256, TLS_RECORD_CLIENT_FROM, tlsClientTrafficZero)
    exposeWith(this.readTraffic384, TLS_RECORD_CLIENT_FROM, tlsClientTrafficZero)
    this.readHash = 0
    this.readProtection.clear()
  }

  /** Wipes the client's application traffic secret and its write keys. */
  wipeWrite(): void {
    exposeWith(this.writeTraffic256, TLS_RECORD_CLIENT_FROM, tlsClientTrafficZero)
    exposeWith(this.writeTraffic384, TLS_RECORD_CLIENT_FROM, tlsClientTrafficZero)
    this.writeHash = 0
    this.writeProtection.clear()
  }

  /**
   * Copies the server's application traffic secret out of `TlsClient` into
   * the field of its hash's length, wipes the client's copy, and installs the
   * read keys from it. False when the secret is not known or the keys do not
   * install.
   */
  keepRead(): boolean {
    const tls: TlsClient = this.tls
    if (!tls.readKnown(TLS_LEVEL_APPLICATION)) {
      return false
    }
    const pool: TlsSecretPool = tls.secrets()
    this.readHash = tls.hashLength
    if (this.readHash === SHA384_SIZE) {
      exposeWith(pool.serverApplication, this.readTraffic384, tlsHeldCopyOver)
      tls.wipeSecret(TLS_SECRET_SERVER_APPLICATION)
      return tlsClientInstallHeld(this.readProtection, tls.suite, this.readTraffic384)
    }
    exposeWith(pool.serverApplication, this.readTraffic256, tlsHeldCopyOver)
    tls.wipeSecret(TLS_SECRET_SERVER_APPLICATION)
    return tlsClientInstallHeld(this.readProtection, tls.suite, this.readTraffic256)
  }

  /** `keepRead` for the client's application traffic secret and the write keys. */
  keepWrite(): boolean {
    const tls: TlsClient = this.tls
    if (!tls.writeKnown(TLS_LEVEL_APPLICATION)) {
      return false
    }
    const pool: TlsSecretPool = tls.secrets()
    this.writeHash = tls.hashLength
    if (this.writeHash === SHA384_SIZE) {
      exposeWith(pool.clientApplication, this.writeTraffic384, tlsHeldCopyOver)
      tls.wipeSecret(TLS_SECRET_CLIENT_APPLICATION)
      return tlsClientInstallHeld(this.writeProtection, tls.suite, this.writeTraffic384)
    }
    exposeWith(pool.clientApplication, this.writeTraffic256, tlsHeldCopyOver)
    tls.wipeSecret(TLS_SECRET_CLIENT_APPLICATION)
    return tlsClientInstallHeld(this.writeProtection, tls.suite, this.writeTraffic256)
  }

  /** How many bytes `receive` would take now: what the socket should read at most. */
  space(): i32 {
    return this.reader.space()
  }

  /**
   * Takes bytes of the server's stream, `data[off .. off + len)`, and handles
   * every record they complete. Answers how many it took, fewer than `len`
   * only when its buffers are full (read `interest` before reading the socket
   * again), or `TLS_RECORD_CLIENT_INVALID` for a window outside `data`. Once
   * the connection has failed, or the server has sent `close_notify`, bytes
   * are taken and dropped (§6.1).
   */
  receive(data: u8[], off: i32, len: i32): i32 {
    if (!tlsRecordWindowFits(toI32(data.length), off, len)) {
      return TLS_RECORD_CLIENT_INVALID
    }
    if (this.state === TLS_RECORD_CLIENT_STATE_FAILED || this.peerClosed) {
      return len
    }
    const taken: i32 = this.reader.push(data, off, len)
    this.process()
    return taken
  }

  /**
   * The server's TCP stream ended. After its `close_notify` that is the
   * orderly end; before it, the stream was cut short — truncation, which an
   * attacker on the path can cause — and the connection fails.
   */
  end(): void {
    this.ended = true
    this.process()
  }

  /** The socket failed under the connection: it ends with nothing more sent, and every key it holds wiped. */
  abort(): void {
    this.state = TLS_RECORD_CLIENT_STATE_FAILED
    this.dropPending()
    this.outputStart = 0
    this.outputEnd = 0
    this.wipe()
  }

  /** Forgets what is owed but not yet sealed: the handshake queues, a KeyUpdate and a close. */
  dropPending(): void {
    this.tls.clearOutput(TLS_LEVEL_INITIAL)
    this.tls.clearOutput(TLS_LEVEL_HANDSHAKE)
    this.pendingInitialAt = 0
    this.pendingHandshakeAt = 0
    this.keyUpdateDue = false
    this.closeDue = false
  }

  /**
   * Handles every whole record the reader holds, as far as the application
   * data buffer has room for. While the client waits for `authenticate` the
   * records stay where they are, and `authenticate` comes back for them.
   * Once the stream has ended and every whole record is handled, an end
   * without `close_notify` is truncation and the connection fails, wiped.
   */
  process(): void {
    while (this.state !== TLS_RECORD_CLIENT_STATE_FAILED && !this.peerClosed) {
      if (this.tls.state === TLS_CLIENT_STATE_WAIT_AUTHENTICATION) {
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
    if (
      this.ended &&
      !this.peerClosed &&
      this.state !== TLS_RECORD_CLIENT_STATE_FAILED &&
      this.tls.state !== TLS_CLIENT_STATE_WAIT_AUTHENTICATION &&
      this.reader.next() <= 0
    ) {
      this.state = TLS_RECORD_CLIENT_STATE_FAILED
      this.dropPending()
      this.wipe()
    }
    this.pump()
  }

  /**
   * Whether a whole record's content fits beside what the caller has not
   * read, moving that to the front when it would then fit and only then.
   */
  plainHasRoom(): boolean {
    const capacity: i32 = TLS_RECORD_CLIENT_PLAIN_SIZE
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
    return this.idleRecords > TLS_RECORD_CLIENT_IDLE_LIMIT ? TLS_ALERT_UNEXPECTED_MESSAGE : 0
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
    const length: i32 = this.readProtection.open(buf, off, n, this.scratch, TLS_RECORD_CLIENT_FROM)
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
        return this.tls.inputLength > 0 ? TLS_ALERT_UNEXPECTED_MESSAGE : this.handleAlert(length)
      default:
        // Application data before the server's Finished, a protected
        // change_cipher_spec (§5), or a type nobody defined.
        return TLS_ALERT_UNEXPECTED_MESSAGE
    }
  }

  /**
   * A server's compatibility record (§5): one byte of 1, in the clear, before
   * its Finished and not between the records of one handshake message. It
   * is dropped; anything else is `unexpected_message`.
   */
  handleChangeCipherSpec(buf: u8[], off: i32, length: i32): i32 {
    if (length !== 1 || toI32(buf[off + TLS_RECORD_HEADER_SIZE]) !== 1) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    if (this.readLevel === TLS_LEVEL_APPLICATION || this.tls.inputLength > 0) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    return this.idle()
  }

  /**
   * Handshake bytes, `scratch[0 .. length)`, for `TlsClient` at the level
   * they were read at. An empty fragment is `unexpected_message` (§5.1
   * forbids sending one); `TlsClient`'s own answer otherwise.
   */
  handleHandshake(length: i32): i32 {
    if (length === 0) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    this.idleRecords = 0
    const alert: i32 = this.tls.receive(this.readLevel, this.scratch, TLS_RECORD_CLIENT_FROM, length)
    if (alert !== 0) {
      return alert
    }
    return this.advance()
  }

  /**
   * A record under the server's application keys, its `length` bytes of
   * content opened into `scratch`. Application data goes to the caller's
   * buffer, which `process` made room in; an alert and a post-handshake
   * message are handled here; and a post-handshake message the server has
   * sent part of may not be interrupted by anything else (§5.1).
   */
  handleApplicationRecord(length: i32): i32 {
    const type: i32 = this.readProtection.contentType
    if ((this.postHandshakeLength > 0 || this.ticketLeft > 0) && type !== TLS_CONTENT_HANDSHAKE) {
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
   * level is not read, as §6 allows. `close_notify` ends the server's stream,
   * `user_canceled` is passed over, and any other description ends the
   * connection with nothing more sent.
   */
  handleAlert(length: i32): i32 {
    if (length !== 2) {
      return TLS_ALERT_DECODE_ERROR
    }
    const description: i32 = toI32(this.scratch[1])
    if (description === TLS_ALERT_CLOSE_NOTIFY) {
      // The server writes nothing after it (§6.1), so the read keys have
      // opened their last record. Before the handshake is done the
      // connection can never open, so it fails, wiped.
      this.peerClosed = true
      if (this.state === TLS_RECORD_CLIENT_STATE_HANDSHAKE) {
        this.peerAlert = description
        this.state = TLS_RECORD_CLIENT_STATE_FAILED
        this.dropPending()
        this.outputStart = 0
        this.outputEnd = 0
        this.wipe()
        return 0
      }
      this.wipeRead()
      return 0
    }
    if (description === TLS_ALERT_USER_CANCELED) {
      return this.idle()
    }
    this.peerAlert = description
    this.state = TLS_RECORD_CLIENT_STATE_FAILED
    this.dropPending()
    this.outputStart = 0
    this.outputEnd = 0
    this.wipe()
    return 0
  }

  /**
   * Post-handshake handshake bytes, `scratch[0 .. length)`, which may start
   * in an earlier record. The server may send a NewSessionTicket, read to its
   * end and dropped since no resumption is offered — a body shorter than
   * the least or longer than the most §4.6.1 allows is `decode_error` — and
   * a KeyUpdate: a length other than 1 is `decode_error`, a `request_update`
   * other than 0 or 1 `illegal_parameter` (§4.6.3), and one that does not
   * end its record `unexpected_message`, since the keys change after it
   * (§5.1). No certificate was offered to be requested, so any other type is
   * `unexpected_message`.
   */
  handlePostHandshake(length: i32): i32 {
    const idle: i32 = this.idle()
    if (idle !== 0) {
      return idle
    }
    let k: i32 = 0
    while (k < length) {
      if (this.ticketLeft > 0) {
        const left: i32 = length - k
        const take: i32 = left < this.ticketLeft ? left : this.ticketLeft
        this.ticketLeft = this.ticketLeft - take
        k = k + take
        if (this.ticketLeft === 0) {
          this.postHandshakeLength = 0
        }
        continue
      }
      this.postHandshake[this.postHandshakeLength] = this.scratch[k]
      this.postHandshakeLength = this.postHandshakeLength + 1
      k = k + 1
      const held: i32 = this.postHandshakeLength
      const type: i32 = toI32(this.postHandshake[0])
      if (held === 1 && type !== TLS_HANDSHAKE_KEY_UPDATE && type !== TLS_HANDSHAKE_NEW_SESSION_TICKET) {
        return TLS_ALERT_UNEXPECTED_MESSAGE
      }
      if (held === TLS_RECORD_CLIENT_HEADER) {
        const body: i32 =
          (toI32(this.postHandshake[1]) << 16) |
          (toI32(this.postHandshake[2]) << 8) |
          toI32(this.postHandshake[3])
        if (type === TLS_HANDSHAKE_NEW_SESSION_TICKET) {
          if (body < TLS_RECORD_CLIENT_MIN_TICKET || body > TLS_RECORD_CLIENT_MAX_TICKET) {
            return TLS_ALERT_DECODE_ERROR
          }
          this.ticketLeft = body
        } else if (body !== 1) {
          return TLS_ALERT_DECODE_ERROR
        }
      }
      if (held === TLS_RECORD_CLIENT_KEY_UPDATE_SIZE) {
        const request: i32 = toI32(this.postHandshake[4])
        this.postHandshakeLength = 0
        if (request > 1) {
          return TLS_ALERT_ILLEGAL_PARAMETER
        }
        if (k !== length) {
          return TLS_ALERT_UNEXPECTED_MESSAGE
        }
        if (this.keyUpdates >= TLS_RECORD_CLIENT_MAX_KEY_UPDATES) {
          return TLS_ALERT_UNEXPECTED_MESSAGE
        }
        this.keyUpdates = this.keyUpdates + 1
        return this.updateReadKeys(request === 1)
      }
    }
    return 0
  }

  /**
   * The server's KeyUpdate: its next records are under the next secret
   * (§7.2), the old one overwritten. When it asked for an update the client
   * owes one of its own before its next application data, which `pump`
   * sends. Answers 0, or `internal_error` when the keys do not install.
   */
  updateReadKeys(requested: boolean): i32 {
    const advanced: boolean =
      this.readHash === SHA384_SIZE
        ? tlsClientAdvanceHeld(this.readProtection, this.readTraffic384)
        : this.readHash !== 0 && tlsClientAdvanceHeld(this.readProtection, this.readTraffic256)
    if (!advanced) {
      return TLS_ALERT_INTERNAL_ERROR
    }
    if (requested) {
      this.keyUpdateDue = true
    }
    return 0
  }

  /**
   * Picks up what `TlsClient` did with the last bytes or the verdict: the
   * server's handshake read keys once its ServerHello is read, and, once its
   * Finished verifies, the application read keys, with the server's
   * handshake traffic secret wiped in `TlsClient`. Answers 0, or
   * `internal_error` when keys do not install.
   */
  advance(): i32 {
    const tls: TlsClient = this.tls
    if (this.readLevel === TLS_LEVEL_INITIAL && tls.readKnown(TLS_LEVEL_HANDSHAKE)) {
      if (!tlsClientInstallHeld(this.readProtection, tls.suite, tls.secrets().serverHandshake)) {
        return TLS_ALERT_INTERNAL_ERROR
      }
      this.readLevel = TLS_LEVEL_HANDSHAKE
    }
    if (tls.state === TLS_CLIENT_STATE_CONNECTED && this.readLevel === TLS_LEVEL_HANDSHAKE) {
      // The server's Finished is verified, the secret's last use.
      tls.wipeSecret(TLS_SECRET_SERVER_HANDSHAKE)
      if (!this.keepRead()) {
        return TLS_ALERT_INTERNAL_ERROR
      }
      this.readLevel = TLS_LEVEL_APPLICATION
      this.state = TLS_RECORD_CLIENT_STATE_OPEN
    }
    this.pump()
    return 0
  }

  /** Whether `need` more bytes fit in `output`, moving what is unsent to the front first. */
  outputHasRoom(need: i32): boolean {
    const capacity: i32 = TLS_RECORD_CLIENT_OUTPUT_SIZE
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

  /** The most content one record may carry under the write protection: 2^14 bytes, less the padding (§5.4). */
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
   * under the write protection. False, writing nothing, when it does not
   * fit; a refusal from `seal` itself fails the connection.
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
   * Seals as much of `queue[at .. length)` as fits, in records of at most
   * `maxChunk()` bytes, and answers where it stopped. A padding that leaves
   * no room for content fails the connection with `internal_error`.
   */
  sealQueue(queue: u8[], at: i32, length: i32): i32 {
    let next: i32 = at
    const most: i32 = this.maxChunk()
    if (most < 1 && next < length) {
      this.fail(TLS_ALERT_INTERNAL_ERROR)
      return next
    }
    while (next < length && this.state !== TLS_RECORD_CLIENT_STATE_FAILED) {
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
   * server must read it: the ClientHellos in the clear, then the handshake
   * write keys, the client's Finished under them, and the switch to the
   * application keys, with the client's handshake and application secrets
   * wiped in `TlsClient` once they have done their work here. A KeyUpdate
   * owed to the server goes last.
   */
  pump(): void {
    if (this.state === TLS_RECORD_CLIENT_STATE_FAILED) {
      return
    }
    if (this.state === TLS_RECORD_CLIENT_STATE_CLOSED) {
      this.sealClose()
      return
    }
    const tls: TlsClient = this.tls
    if (tls.outputInitialLength > 0) {
      this.pendingInitialAt = this.sealQueue(
        tls.outputInitial,
        this.pendingInitialAt,
        tls.outputInitialLength
      )
      if (this.pendingInitialAt < tls.outputInitialLength) {
        return
      }
      tls.clearOutput(TLS_LEVEL_INITIAL)
      this.pendingInitialAt = 0
    }
    // Everything the client sends after the server's ServerHello is under the
    // handshake keys, an alert included, so they go in as soon as it is read.
    if (this.writeLevel === TLS_LEVEL_INITIAL && tls.writeKnown(TLS_LEVEL_HANDSHAKE)) {
      if (!tlsClientInstallHeld(this.writeProtection, tls.suite, tls.secrets().clientHandshake)) {
        this.fail(TLS_ALERT_INTERNAL_ERROR)
        return
      }
      this.writeLevel = TLS_LEVEL_HANDSHAKE
    }
    if (this.writeLevel === TLS_LEVEL_HANDSHAKE && tls.outputHandshakeLength > 0) {
      this.pendingHandshakeAt = this.sealQueue(
        tls.outputHandshake,
        this.pendingHandshakeAt,
        tls.outputHandshakeLength
      )
      if (this.pendingHandshakeAt < tls.outputHandshakeLength) {
        return
      }
      tls.clearOutput(TLS_LEVEL_HANDSHAKE)
      this.pendingHandshakeAt = 0
    }
    if (this.writeLevel === TLS_LEVEL_HANDSHAKE && tls.state === TLS_CLIENT_STATE_CONNECTED) {
      // The client's Finished is sealed, the secret's last use.
      tls.wipeSecret(TLS_SECRET_CLIENT_HANDSHAKE)
      if (!this.keepWrite()) {
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
   * to the next secret (§4.6.3, §7.2). False, sending nothing, when it does
   * not fit in `output` yet.
   */
  sendKeyUpdate(request: boolean): boolean {
    const message: u8[] = [toU8(TLS_HANDSHAKE_KEY_UPDATE), toU8(0), toU8(0), toU8(1), toU8(request ? 1 : 0)]
    if (
      !this.sealRecord(
        TLS_CONTENT_HANDSHAKE,
        message,
        TLS_RECORD_CLIENT_FROM,
        TLS_RECORD_CLIENT_KEY_UPDATE_SIZE
      )
    ) {
      return false
    }
    const advanced: boolean =
      this.writeHash === SHA384_SIZE
        ? tlsClientAdvanceHeld(this.writeProtection, this.writeTraffic384)
        : this.writeHash !== 0 && tlsClientAdvanceHeld(this.writeProtection, this.writeTraffic256)
    if (!advanced) {
      this.fail(TLS_ALERT_INTERNAL_ERROR)
      return false
    }
    return true
  }

  /**
   * Sends a KeyUpdate now, asking the server to update too when
   * `requestPeer` (§4.6.3). Answers 0, `TLS_RECORD_CLIENT_AGAIN` while the
   * handshake is under way or `output` is full, `TLS_RECORD_CLIENT_PIPE` once
   * the client has closed or the connection failed, or
   * `TLS_RECORD_CLIENT_RESET` when the next keys do not install.
   */
  keyUpdate(requestPeer: boolean): i32 {
    if (this.state === TLS_RECORD_CLIENT_STATE_FAILED || this.state === TLS_RECORD_CLIENT_STATE_CLOSED) {
      return TLS_RECORD_CLIENT_PIPE
    }
    this.pump()
    if (this.state !== TLS_RECORD_CLIENT_STATE_OPEN || this.writeLevel !== TLS_LEVEL_APPLICATION) {
      return TLS_RECORD_CLIENT_AGAIN
    }
    if (this.keyUpdateDue || !this.sendKeyUpdate(requestPeer)) {
      return this.state === TLS_RECORD_CLIENT_STATE_FAILED ? TLS_RECORD_CLIENT_RESET : TLS_RECORD_CLIENT_AGAIN
    }
    return 0
  }

  /**
   * Fails the connection with `alert`, sent as a fatal alert under whatever
   * the client writes with now, in the clear before its first keys. What
   * was still owed is dropped, and once the alert is sealed every key and
   * record buffer the connection holds is wiped.
   */
  fail(alert: i32): void {
    if (this.state === TLS_RECORD_CLIENT_STATE_FAILED) {
      return
    }
    const closed: boolean = this.state === TLS_RECORD_CLIENT_STATE_CLOSED
    this.dropPending()
    // Failed first, so a seal that refuses the alert cannot come back here.
    this.state = TLS_RECORD_CLIENT_STATE_FAILED
    this.alert = alert
    // A client that has sent its close_notify sends nothing after it (§6.1).
    if (!closed) {
      this.sendAlert(TLS_ALERT_LEVEL_FATAL, alert)
    }
    this.wipe()
  }

  /** Seals an alert record of `level` and `description`; false, sending nothing, when `output` has no room for it. */
  sendAlert(level: i32, description: i32): boolean {
    const body: u8[] = [toU8(level), toU8(description)]
    const two: i32 = 2
    return this.sealRecord(TLS_CONTENT_ALERT, body, TLS_RECORD_CLIENT_FROM, two)
  }

  /** Lets the first `n` bytes of `output` go, once the socket has taken them, and seals what was waiting for the room. */
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
   * Application data for the server, `data[off .. off + len)`: seals as much
   * as fits, in records of at most 2^14 bytes, and answers how much that
   * was, as a socket write does. A KeyUpdate goes first when the key has
   * protected `recordLimit` records, or the server asked for one.
   * `TLS_RECORD_CLIENT_AGAIN` while the handshake is under way or nothing
   * fits, `TLS_RECORD_CLIENT_PIPE` once the client has closed,
   * `TLS_RECORD_CLIENT_RESET` once the connection failed, and
   * `TLS_RECORD_CLIENT_INVALID` for a window outside `data`.
   */
  write(data: u8[], off: i32, len: i32): i32 {
    if (!tlsRecordWindowFits(toI32(data.length), off, len)) {
      return TLS_RECORD_CLIENT_INVALID
    }
    if (this.state === TLS_RECORD_CLIENT_STATE_FAILED) {
      return TLS_RECORD_CLIENT_RESET
    }
    if (this.state === TLS_RECORD_CLIENT_STATE_CLOSED) {
      return TLS_RECORD_CLIENT_PIPE
    }
    this.pump()
    if (
      this.state !== TLS_RECORD_CLIENT_STATE_OPEN ||
      this.keyUpdateDue ||
      this.writeLevel !== TLS_LEVEL_APPLICATION
    ) {
      return this.state === TLS_RECORD_CLIENT_STATE_FAILED ? TLS_RECORD_CLIENT_RESET : TLS_RECORD_CLIENT_AGAIN
    }
    let done: i32 = 0
    while (done < len && this.state === TLS_RECORD_CLIENT_STATE_OPEN) {
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
      const room: i32 =
        TLS_RECORD_CLIENT_OUTPUT_SIZE - this.outputEnd - this.recordRoom(TLS_RECORD_CLIENT_FROM)
      if (room < chunk) {
        chunk = room
      }
      if (chunk <= 0 || !this.sealRecord(TLS_CONTENT_APPLICATION_DATA, data, off + done, chunk)) {
        break
      }
      done = done + chunk
    }
    if (done === 0 && len > 0) {
      return this.state === TLS_RECORD_CLIENT_STATE_FAILED ? TLS_RECORD_CLIENT_RESET : TLS_RECORD_CLIENT_AGAIN
    }
    return done
  }

  /**
   * Application data from the server, into `buf[off .. off + len)`: the
   * count, as a socket read answers; 0 at the end of its stream (its
   * `close_notify`) or for a `len` of 0; `TLS_RECORD_CLIENT_AGAIN` when
   * nothing is waiting; `TLS_RECORD_CLIENT_RESET` once the connection has
   * failed; and `TLS_RECORD_CLIENT_INVALID` for a window outside `buf`.
   */
  read(buf: u8[], off: i32, len: i32): i32 {
    if (!tlsRecordWindowFits(toI32(buf.length), off, len)) {
      return TLS_RECORD_CLIENT_INVALID
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
        if (this.state === TLS_RECORD_CLIENT_STATE_FAILED) {
          // The last of what a failed connection opened: nothing reads it again.
          secureZero(this.plain)
        }
      }
      this.process()
      return n
    }
    if (this.state === TLS_RECORD_CLIENT_STATE_FAILED) {
      return TLS_RECORD_CLIENT_RESET
    }
    return this.peerClosed ? 0 : TLS_RECORD_CLIENT_AGAIN
  }

  /**
   * Closes the client's side (§6.1): a `close_notify`, after which `write`
   * answers `TLS_RECORD_CLIENT_PIPE`. Application data already written stays
   * ahead of the alert, which waits for room in `output` when there is none.
   * During the handshake the alert is `user_canceled`'s companion: the
   * connection can never open, so it ends as a failure, wiped, once the
   * `close_notify` is sealed. Nothing happens once it has failed or closed.
   */
  close(): void {
    if (this.state === TLS_RECORD_CLIENT_STATE_FAILED || this.state === TLS_RECORD_CLIENT_STATE_CLOSED) {
      return
    }
    if (this.state === TLS_RECORD_CLIENT_STATE_HANDSHAKE) {
      this.dropPending()
      this.state = TLS_RECORD_CLIENT_STATE_FAILED
      this.sendAlert(TLS_ALERT_LEVEL_WARNING, TLS_ALERT_CLOSE_NOTIFY)
      this.wipe()
      return
    }
    this.state = TLS_RECORD_CLIENT_STATE_CLOSED
    this.closeDue = true
    this.sealClose()
  }

  /**
   * Seals the `close_notify` `close` owes, once `output` has room for it, and
   * wipes the write keys and the client's traffic secret, which protect
   * nothing after it. The read keys stay until the server's own `close_notify`.
   */
  sealClose(): void {
    if (this.closeDue && this.sendAlert(TLS_ALERT_LEVEL_WARNING, TLS_ALERT_CLOSE_NOTIFY)) {
      this.closeDue = false
      this.wipeWrite()
    }
  }

  /**
   * Hands `TlsClient` the caller's verdict on the server, while `interest`
   * says `TLS_RECORD_CLIENT_AUTHENTICATE`: `chainAlert` 0 accepts the chain
   * (else it is the alert to refuse it with), and `signatureValid` says the
   * CertificateVerify verified. The records held meanwhile are then handled.
   * Answers 0, or the alert the connection failed with.
   */
  authenticate(chainAlert: i32, signatureValid: boolean): i32 {
    if (this.state !== TLS_RECORD_CLIENT_STATE_HANDSHAKE) {
      return this.state === TLS_RECORD_CLIENT_STATE_FAILED ? this.alert : TLS_ALERT_INTERNAL_ERROR
    }
    let alert: i32 = this.tls.authenticate(chainAlert, signatureValid)
    if (alert === 0) {
      alert = this.advance()
    }
    if (alert !== 0) {
      this.fail(alert)
      return alert
    }
    this.process()
    return this.state === TLS_RECORD_CLIENT_STATE_FAILED ? this.alert : 0
  }

  /**
   * What the connection wants next, as `TLS_RECORD_CLIENT_*` bits: read the
   * socket, write it, `read`, `authenticate`, or nothing more ever
   * (`TLS_RECORD_CLIENT_DONE`: failed or closed, and everything is sent).
   */
  interest(): i32 {
    let bits: i32 = 0
    const sending: boolean = this.outputEnd > this.outputStart || this.closeDue
    if (sending) {
      bits = bits | TLS_RECORD_CLIENT_WANT_WRITE
    }
    const failed: boolean = this.state === TLS_RECORD_CLIENT_STATE_FAILED
    const closedDone: boolean = this.state === TLS_RECORD_CLIENT_STATE_CLOSED && this.peerClosed
    if ((failed || closedDone) && !sending) {
      bits = bits | TLS_RECORD_CLIENT_DONE
    }
    // A client that has closed still reads, for the server's close_notify.
    const live: boolean = !failed
    const authenticating: boolean = this.tls.state === TLS_CLIENT_STATE_WAIT_AUTHENTICATION
    // A whole record still held means the application data buffer is full,
    // or the verdict is awaited: the server waits.
    const blocked: boolean = this.reader.next() > 0
    if (live && !this.peerClosed && !this.ended && !blocked && this.reader.space() > 0) {
      bits = bits | TLS_RECORD_CLIENT_WANT_READ
    }
    if (this.plainEnd > this.plainStart || (this.peerClosed && live)) {
      bits = bits | TLS_RECORD_CLIENT_DATA
    }
    if (live && this.state === TLS_RECORD_CLIENT_STATE_HANDSHAKE && authenticating) {
      bits = bits | TLS_RECORD_CLIENT_AUTHENTICATE
    }
    return bits
  }
}

/**
 * Asks the caller's verifiers about the server `conn` waits on and hands the
 * verdict to `conn.authenticate`, as `tlsClientAuthenticate` does for a bare
 * `TlsClient`: `verifyChain(auth, chain, serverName)` answers 0 or the alert
 * to refuse the chain with, and only a chain it accepts is asked
 * `verifySignature(auth, chain, scheme, content, signature)`. Answers what
 * `authenticate` answers.
 */
export const tlsRecordClientAuthenticate = <A>(
  conn: TlsRecordClient,
  auth: A,
  verifyChain: (auth: A, chain: u8[][], serverName: string) => i32,
  verifySignature: (auth: A, chain: u8[][], scheme: i32, content: u8[], signature: u8[]) => boolean
): i32 => {
  const client: TlsClient = conn.tls
  if (client.state !== TLS_CLIENT_STATE_WAIT_AUTHENTICATION) {
    return conn.authenticate(toI32(0), false)
  }
  const chainAlert: i32 = verifyChain(auth, client.chain, client.serverName)
  if (chainAlert !== 0) {
    return conn.authenticate(chainAlert, false)
  }
  return conn.authenticate(
    toI32(0),
    verifySignature(auth, client.chain, client.scheme, client.signatureContent, client.signature)
  )
}
