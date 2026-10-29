/**
 * `nish/net/tls/record-client` — a TLS 1.3 client over a byte stream: the
 * record layer of `nish/net/tls/record` wrapped around
 * `nish/net/tls/client`'s `TlsClient`, sans-IO. Bytes the server sent go in,
 * bytes to send come out, and once the handshake is done application data
 * flows both ways. The mirror of `nish/net/tls/record-server`.
 *
 *     const conn = new TlsRecordClient(new TlsClient(config, random, x25519Key, p256Key));
 *     // send conn.output[conn.outputStart .. conn.outputEnd), then conn.consume(sent)
 *     conn.receive(bytes, 0, n);                 // what the socket read
 *     if ((conn.interest() & TLS_RECORD_AUTH) !== 0) {
 *       // check conn.tls.peerCertificates() and the CertificateVerify
 *       conn.authenticate(verified);
 *     }
 *     const got: i32 = conn.read(buf, 0, buf.length);   // application data
 *
 * **What it adds to `TlsClient`.** Records around the handshake messages:
 * the ClientHello in the clear, then the client's Finished under the
 * handshake keys, and every key installed at the record boundary RFC 8446
 * §5.1 puts it on. The middlebox-compatibility `change_cipher_spec` of §D.4,
 * which a client that sends a session id (this one always does) owes: one,
 * in the clear, before its second ClientHello after a HelloRetryRequest, or
 * else before its first protected record; the server's is dropped from its
 * first handshake record until its Finished. Alerts (§6) both ways, as the
 * server has them: `close_notify` ends the server's stream, `user_canceled`
 * is passed over, any other alert ends the connection, and a refusal of this
 * module's or of `TlsClient`'s is sent as a fatal alert under whatever keys
 * the client writes with. KeyUpdate (§4.6.3) both ways, with the server's
 * limits: `TLS_RECORD_IDLE_LIMIT` records in a row that carry nothing, and
 * `TLS_RECORD_MAX_KEY_UPDATES` KeyUpdates. A NewSessionTicket is handed to
 * `TlsClient`, which checks and drops it; any other post-handshake message is
 * `unexpected_message` (no client certificate is offered, so no
 * CertificateRequest). A stream that ends without `close_notify` is
 * truncation.
 *
 * **Authentication is the caller's.** At `TlsClient`'s `WAIT_AUTH` the
 * records after the server's CertificateVerify stay in the reader and
 * `interest` says `TLS_RECORD_AUTH`: nothing more is read until the caller
 * has checked the chain and the signature and called `authenticate(true)` —
 * or `authenticate(false)` / `reject(alert)`, which fail the connection with
 * the alert sent. Nothing here proves who the server is.
 *
 * **Buffers.** One connection, one object: `output`, `plain` and `scratch`
 * are allocated with it, and `wipe` zeroes the two that hold plaintext. The
 * handshake's messages are sealed straight out of `TlsClient`'s own buffers.
 *
 * **Secrets.** As in `TlsRecordServer`: `TlsClient` holds the handshake's
 * secrets, this object the two application traffic secrets, one readonly
 * field per direction and hash length, with `readHash` and `writeHash` saying
 * which of each pair is live. A secret is copied out of `TlsClient` as it is
 * installed and the client's copy zeroed; the handshake secrets are zeroed
 * once the Finished messages no longer need them; a KeyUpdate overwrites
 * the live field in place. A failure of any kind wipes everything both
 * objects hold once the last alert is sealed; the client's `close_notify`,
 * once sealed, wipes the write direction, and the server's the read
 * direction; `wipe` wipes the rest (TLS-1, TLS-3 and "The client" in
 * `docs/security/tls.md`).
 *
 * Refusals are alerts, never panics. Written from RFC 8446 §4.6.3, §5, §6
 * and §D.4, not ported from another implementation.
 */
import {
  TLS_LEVEL_APPLICATION,
  TLS_LEVEL_HANDSHAKE,
  TLS_LEVEL_INITIAL,
  TLS_SECRET_CLIENT_APPLICATION,
  TLS_SECRET_CLIENT_HANDSHAKE,
  TLS_SECRET_HANDSHAKE,
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
  TLS_CLIENT_STATE_START,
  TLS_CLIENT_STATE_WAIT_AUTH,
  TlsClient,
} from "nish/net/tls/client"
import {
  TLS_RECORD_AGAIN,
  TLS_RECORD_DATA,
  TLS_RECORD_DONE,
  TLS_RECORD_IDLE_LIMIT,
  TLS_RECORD_INVALID,
  TLS_RECORD_MAX_KEY_UPDATES,
  TLS_RECORD_PIPE,
  TLS_RECORD_RESET,
  TLS_RECORD_STATE_CLOSED,
  TLS_RECORD_STATE_FAILED,
  TLS_RECORD_STATE_HANDSHAKE,
  TLS_RECORD_STATE_OPEN,
  TLS_RECORD_WANT_READ,
  TLS_RECORD_WANT_WRITE,
} from "nish/net/tls/record-server"
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

/**
 * An `interest` bit beside `nish/net/tls/record-server`'s `TLS_RECORD_*`:
 * the server's chain and CertificateVerify wait for the caller's verdict,
 * `authenticate` or `reject`.
 */
export const TLS_RECORD_AUTH: i32 = 64

/** The size of the bytes to send: two whole records, so a record fits beside one partly sent. */
const TLS_RECORD_CLIENT_OUTPUT_SIZE: i32 = 2 * TLS_MAX_RECORD
/** The size of the application data the caller has not read: two records' worth. */
const TLS_RECORD_CLIENT_PLAIN_SIZE: i32 = 2 * TLS_MAX_PLAINTEXT

/** A KeyUpdate message: type, a 24-bit length of 1, and `request_update`. */
const TLS_KEY_UPDATE_SIZE: i32 = 5
/** A handshake message header: type and a 24-bit length. */
const TLS_MESSAGE_HEADER_SIZE: i32 = 4

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const TLS_RECORD_CLIENT_FROM: i32 = 0

/** Zeroes the bytes a traffic secret field holds, for `exposeWith`; answers 0. */
const tlsClientTrafficZero = (held: u8[], answer: i32): i32 => {
  wipe(held)
  return answer
}

/**
 * Installs `protection` under `suite` from the traffic secret `held`, from a
 * plain copy that dies with the arena block, zeroed; false, as `install`
 * answers, when the keys do not install. As in `nish/net/tls/record-server`.
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
 * `held`'s bytes in place, the KeyUpdate step; false when the keys do not
 * install. As in `nish/net/tls/record-server`.
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
 * One TLS 1.3 client connection over a stream. Make one per connection
 * around a fresh `TlsClient`, which it starts, and drive it with `receive`,
 * `consume`, `read`, `write` and `authenticate` as `interest` says.
 *
 * The fields are readable: `state`, `alert` (the alert this client sent, or
 * 0), `peerAlert` (the error alert the server sent, or -1), `peerClosed`
 * (the server's `close_notify` arrived), `tls` (the handshake: suite, ALPN,
 * the server's certificates, exporter secret), and the two protections with
 * their sequence numbers. `padding` is how many zero bytes each protected
 * record the client writes carries after its content type (§5.4).
 */
export class TlsRecordClient {
  tls: TlsClient
  reader: TlsRecordReader
  readProtection: TlsRecordProtection
  writeProtection: TlsRecordProtection
  /** Never installed: seals the compatibility record in the clear once the write side is protected. */
  clearProtection: TlsRecordProtection
  /** Bytes to send are `output[outputStart .. outputEnd)`. */
  output: u8[]
  /** Application data the caller has not read is `plain[plainStart .. plainEnd)`. */
  plain: u8[]
  /** Where a record is opened to. */
  scratch: u8[]
  /** The server's and the client's current application traffic secrets, at both hash lengths. */
  readonly readTraffic256: Secret<u8[]>
  readonly readTraffic384: Secret<u8[]>
  readonly writeTraffic256: Secret<u8[]>
  readonly writeTraffic384: Secret<u8[]>
  readHash: i32 = 0
  writeHash: i32 = 0
  /** The header of a post-handshake message the server has sent part of, and a KeyUpdate's body. */
  postHandshake: u8[]
  state: i32 = 0
  alert: i32 = 0
  peerAlert: i32 = -1
  padding: i32 = 0
  /** The `TLS_LEVEL_*` the server's records are read at. */
  readLevel: i32 = 0
  /** The `TLS_LEVEL_*` the client's records are written at. */
  writeLevel: i32 = 0
  outputStart: i32 = 0
  outputEnd: i32 = 0
  plainStart: i32 = 0
  plainEnd: i32 = 0
  /** How much of `TlsClient`'s Initial-level output is already in records. */
  pendingInitialAt: i32 = 0
  /** How much of `TlsClient`'s Handshake-level output is already in records. */
  pendingHandshakeAt: i32 = 0
  /** How many bytes of the current post-handshake message's header or KeyUpdate are in `postHandshake`. */
  postHandshakeLength: i32 = 0
  /** How many body bytes of a NewSessionTicket are still to come, handed to `TlsClient` as they arrive. */
  ticketLeft: i32 = 0
  idleRecords: i32 = 0
  keyUpdates: i32 = 0
  peerClosed: boolean = false
  ended: boolean = false
  /** The server's first handshake record has arrived, which opens the window its `change_cipher_spec` may come in. */
  started: boolean = false
  /** The client's compatibility `change_cipher_spec` is sent (§D.4). */
  ccsSent: boolean = false
  keyUpdateDue: boolean = false
  closeDue: boolean = false

  /**
   * Wraps `tls`, which should be fresh, and starts it: the ClientHello is
   * sealed into `output` at once. A `tls` that has already failed, or whose
   * ClientHello cannot be written, fails this connection with its alert
   * queued in the clear.
   */
  constructor(tls: TlsClient) {
    this.tls = tls
    this.reader = new TlsRecordReader()
    this.readProtection = new TlsRecordProtection()
    this.writeProtection = new TlsRecordProtection()
    this.clearProtection = new TlsRecordProtection()
    this.output = new Array<u8>(TLS_RECORD_CLIENT_OUTPUT_SIZE)
    this.plain = new Array<u8>(TLS_RECORD_CLIENT_PLAIN_SIZE)
    this.scratch = new Array<u8>(TLS_MAX_PLAINTEXT)
    this.readTraffic256 = secret(new Array<u8>(SHA256_SIZE))
    this.readTraffic384 = secret(new Array<u8>(SHA384_SIZE))
    this.writeTraffic256 = secret(new Array<u8>(SHA256_SIZE))
    this.writeTraffic384 = secret(new Array<u8>(SHA384_SIZE))
    this.postHandshake = new Array<u8>(TLS_KEY_UPDATE_SIZE)
    this.state = TLS_RECORD_STATE_HANDSHAKE
    let alert: i32 = tls.state === TLS_CLIENT_STATE_FAILED ? tls.alert : 0
    if (alert === 0 && tls.state === TLS_CLIENT_STATE_START) {
      alert = tls.start()
    }
    if (alert !== 0) {
      this.fail(alert)
      return
    }
    this.pump()
  }

  /**
   * Wipes everything this connection holds: both traffic secrets at both
   * hash lengths, both directions' keys, the plaintext buffers and everything
   * `TlsClient` holds. Call it when the connection is done with.
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
    secureZero(this.plain)
    secureZero(this.scratch)
    secureZero(this.postHandshake)
    this.tls.wipe()
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
    let installed: boolean = false
    if (this.readHash === SHA384_SIZE) {
      exposeWith(pool.serverApplication, this.readTraffic384, tlsHeldCopyOver)
      tls.wipeSecret(TLS_SECRET_SERVER_APPLICATION)
      installed = tlsClientInstallHeld(this.readProtection, tls.suite, this.readTraffic384)
    } else {
      exposeWith(pool.serverApplication, this.readTraffic256, tlsHeldCopyOver)
      tls.wipeSecret(TLS_SECRET_SERVER_APPLICATION)
      installed = tlsClientInstallHeld(this.readProtection, tls.suite, this.readTraffic256)
    }
    return installed
  }

  /** `keepRead` for the client's application traffic secret and the write keys. */
  keepWrite(): boolean {
    const tls: TlsClient = this.tls
    if (!tls.writeKnown(TLS_LEVEL_APPLICATION)) {
      return false
    }
    const pool: TlsSecretPool = tls.secrets()
    this.writeHash = tls.hashLength
    let installed: boolean = false
    if (this.writeHash === SHA384_SIZE) {
      exposeWith(pool.clientApplication, this.writeTraffic384, tlsHeldCopyOver)
      tls.wipeSecret(TLS_SECRET_CLIENT_APPLICATION)
      installed = tlsClientInstallHeld(this.writeProtection, tls.suite, this.writeTraffic384)
    } else {
      exposeWith(pool.clientApplication, this.writeTraffic256, tlsHeldCopyOver)
      tls.wipeSecret(TLS_SECRET_CLIENT_APPLICATION)
      installed = tlsClientInstallHeld(this.writeProtection, tls.suite, this.writeTraffic256)
    }
    return installed
  }

  /** How many bytes `receive` would take now: what the socket should read at most. */
  space(): i32 {
    return this.reader.space()
  }

  /**
   * Takes bytes of the server's stream, `data[off .. off + len)`, and handles
   * every record they complete. Answers how many it took, fewer than `len`
   * only when its buffers are full, or `TLS_RECORD_INVALID` for a window
   * outside `data`. Once the connection has failed, or the server has sent
   * `close_notify`, bytes are taken and dropped (§6.1).
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

  /** The server's TCP stream ended: the orderly end after its `close_notify`, truncation before it. */
  end(): void {
    this.ended = true
    this.process()
  }

  /**
   * Once the server's stream has ended and every whole record it held is
   * handled, an end without `close_notify` is truncation: the connection
   * fails with nothing more sent, and every key it holds is wiped.
   */
  checkTruncation(): void {
    if (this.ended && !this.peerClosed && this.state !== TLS_RECORD_STATE_FAILED && this.reader.next() <= 0) {
      this.state = TLS_RECORD_STATE_FAILED
      this.dropPending()
      this.wipe()
    }
  }

  /** The socket failed under the connection: it ends with nothing more sent, and every key it holds wiped. */
  abort(): void {
    this.state = TLS_RECORD_STATE_FAILED
    this.outputStart = 0
    this.outputEnd = 0
    this.dropPending()
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
   * data buffer has room for. While `TlsClient` waits for the caller's
   * verdict on the server's certificate the records stay where they are, and
   * `authenticate` comes back for them.
   */
  process(): void {
    while (this.state !== TLS_RECORD_STATE_FAILED && !this.peerClosed) {
      if (this.tls.state === TLS_CLIENT_STATE_WAIT_AUTH) {
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

  /** Whether a whole record's content fits beside what the caller has not read, moving that to the front when it would then fit. */
  plainHasRoom(): boolean {
    const capacity: i32 = TLS_RECORD_CLIENT_PLAIN_SIZE
    if (capacity - (this.plainEnd - this.plainStart) < TLS_MAX_PLAINTEXT) {
      return false
    }
    if (capacity - this.plainEnd < TLS_MAX_PLAINTEXT) {
      const held: i32 = this.plainEnd - this.plainStart
      for (let k: i32 = 0; k < held && this.plainStart + k < toI32(this.plain.length); k++) {
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
   * One whole record, `buf[off .. off + n)`: a `change_cipher_spec` is judged
   * on its own; anything else is opened under the read protection into
   * `scratch`, and its content goes to `handleApplicationRecord` once the
   * server's Finished is read, to the handshake before. Answers 0 or the alert.
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
   * The server's compatibility record (§5, §D.4): one byte of 1, in the
   * clear, after its first handshake record and before its Finished, and not
   * between the records of one handshake message. Dropped; anything else is
   * `unexpected_message`.
   */
  handleChangeCipherSpec(buf: u8[], off: i32, length: i32): i32 {
    if (length !== 1 || toI32(buf[off + TLS_RECORD_HEADER_SIZE]) !== 1) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    if (!this.started || this.readLevel === TLS_LEVEL_APPLICATION || this.tls.inputLength > 0) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    return this.idle()
  }

  /** Handshake bytes, `scratch[0 .. length)`, for `TlsClient` at the level they were read at; an empty fragment is `unexpected_message` (§5.1). */
  handleHandshake(length: i32): i32 {
    if (length === 0) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    this.started = true
    this.idleRecords = 0
    const alert: i32 = this.tls.receive(this.readLevel, this.scratch, TLS_RECORD_CLIENT_FROM, length)
    if (alert !== 0) {
      return alert
    }
    this.advance()
    return 0
  }

  /**
   * A record under the server's application keys, its `length` bytes of
   * content in `scratch`: application data for the caller, an alert, or
   * post-handshake handshake bytes, which nothing else may interrupt (§5.1).
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
   * An alert, `scratch[0 .. length)` (§6): two bytes, or `decode_error`.
   * `close_notify` ends the server's stream and wipes the read direction,
   * `user_canceled` is passed over, and any other description ends the
   * connection with nothing more sent and every key wiped.
   */
  handleAlert(length: i32): i32 {
    if (length !== 2) {
      return TLS_ALERT_DECODE_ERROR
    }
    const description: i32 = toI32(this.scratch[1])
    if (description === TLS_ALERT_CLOSE_NOTIFY) {
      this.peerClosed = true
      this.wipeRead()
      return 0
    }
    if (description === TLS_ALERT_USER_CANCELED) {
      return this.idle()
    }
    this.peerAlert = description
    this.state = TLS_RECORD_STATE_FAILED
    this.outputStart = 0
    this.outputEnd = 0
    this.dropPending()
    this.wipe()
    return 0
  }

  /**
   * Post-handshake handshake bytes, `scratch[0 .. length)`, which may continue
   * a message an earlier record began. A NewSessionTicket goes to `TlsClient`
   * as it arrives, which reads and drops it. A KeyUpdate is this module's:
   * a length other than 1 is `decode_error`, a `request_update` other than 0
   * or 1 `illegal_parameter`, and one that does not end its record
   * `unexpected_message`, since the keys change after it (§4.6.3, §5.1). Any
   * other type is `unexpected_message`. Each message counts against the idle
   * limit.
   */
  handlePostHandshake(length: i32): i32 {
    let k: i32 = 0
    while (k < length) {
      if (this.ticketLeft > 0) {
        const left: i32 = length - k
        const take: i32 = left < this.ticketLeft ? left : this.ticketLeft
        const alert: i32 = this.tls.receive(TLS_LEVEL_APPLICATION, this.scratch, k, take)
        if (alert !== 0) {
          return alert
        }
        this.ticketLeft = this.ticketLeft - take
        k = k + take
        continue
      }
      if (this.postHandshakeLength === 0) {
        const idle: i32 = this.idle()
        if (idle !== 0) {
          return idle
        }
      }
      if (this.postHandshakeLength < toI32(this.postHandshake.length)) {
        this.postHandshake[this.postHandshakeLength] = this.scratch[k]
      }
      this.postHandshakeLength = this.postHandshakeLength + 1
      const held: i32 = this.postHandshakeLength
      const type: i32 = toI32(this.postHandshake[0])
      if (held === 1 && type !== TLS_HANDSHAKE_KEY_UPDATE && type !== TLS_HANDSHAKE_NEW_SESSION_TICKET) {
        return TLS_ALERT_UNEXPECTED_MESSAGE
      }
      if (held === TLS_MESSAGE_HEADER_SIZE) {
        const body: i32 =
          (toI32(this.postHandshake[1]) << 16) |
          (toI32(this.postHandshake[2]) << 8) |
          toI32(this.postHandshake[3])
        if (type === TLS_HANDSHAKE_NEW_SESSION_TICKET) {
          // The header goes to `TlsClient` with the body, which it reads whole.
          const alert: i32 = this.tls.receive(
            TLS_LEVEL_APPLICATION,
            this.postHandshake,
            TLS_RECORD_CLIENT_FROM,
            TLS_MESSAGE_HEADER_SIZE
          )
          if (alert !== 0) {
            return alert
          }
          this.postHandshakeLength = 0
          this.ticketLeft = body
        } else if (body !== 1) {
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
      k = k + 1
    }
    return 0
  }

  /**
   * The server's KeyUpdate: its next records are under the next secret
   * (§7.2), the old one wiped; when it asked, the client owes one of its own,
   * which `pump` sends. Answers 0, or `internal_error` when the keys do not
   * install.
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
   * Picks up what `TlsClient` did with the last bytes or the caller's
   * verdict: the read keys of each level as they appear, and the end of the
   * server's flight, after which its handshake secrets have done their work
   * and are wiped in `TlsClient`.
   */
  advance(): void {
    const tls: TlsClient = this.tls
    if (this.readLevel === TLS_LEVEL_INITIAL && tls.readKnown(TLS_LEVEL_HANDSHAKE)) {
      if (!tlsClientInstallHeld(this.readProtection, tls.suite, tls.secrets().serverHandshake)) {
        this.fail(TLS_ALERT_INTERNAL_ERROR)
        return
      }
      this.readLevel = TLS_LEVEL_HANDSHAKE
    }
    if (tls.state === TLS_CLIENT_STATE_CONNECTED && this.readLevel === TLS_LEVEL_HANDSHAKE) {
      // The server's Finished is verified: the handshake secret and the
      // server's handshake secret are done with.
      tls.wipeSecret(TLS_SECRET_HANDSHAKE)
      tls.wipeSecret(TLS_SECRET_SERVER_HANDSHAKE)
      if (!this.keepRead()) {
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
    const capacity: i32 = TLS_RECORD_CLIENT_OUTPUT_SIZE
    if (this.outputEnd + need > capacity && this.outputStart > 0) {
      const held: i32 = this.outputEnd - this.outputStart
      for (let k: i32 = 0; k < held && this.outputStart + k < toI32(this.output.length); k++) {
        this.output[k] = this.output[this.outputStart + k]
      }
      this.outputStart = 0
      this.outputEnd = held
    }
    return this.outputEnd + need <= capacity
  }

  /** The most content one record may carry under the write protection as it stands (§5.4). */
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
   * under `protection`. False, writing nothing, when it does not fit; a
   * refusal from `seal` itself fails the connection.
   */
  sealWith(protection: TlsRecordProtection, type: i32, data: u8[], off: i32, len: i32): boolean {
    const room: i32 = this.recordRoom(len)
    if (!this.outputHasRoom(room)) {
      return false
    }
    const n: i32 = protection.seal(type, data, off, len, this.writePadding(), this.output, this.outputEnd)
    if (n < 0) {
      this.fail(-n)
      return false
    }
    this.outputEnd = this.outputEnd + n
    return true
  }

  /** `sealWith` under the write protection. */
  sealRecord(type: i32, data: u8[], off: i32, len: i32): boolean {
    return this.sealWith(this.writeProtection, type, data, off, len)
  }

  /**
   * The compatibility `change_cipher_spec` (§D.4), in the clear whatever the
   * write side is under, once a connection. False when `output` has no room.
   */
  sealChangeCipherSpec(): boolean {
    if (this.ccsSent) {
      return true
    }
    const ccs: u8[] = [toU8(1)]
    const one: i32 = 1
    // `recordRoom` counts the protected size, which is more than the clear record needs.
    if (
      !this.sealWith(this.clearProtection, TLS_CONTENT_CHANGE_CIPHER_SPEC, ccs, TLS_RECORD_CLIENT_FROM, one)
    ) {
      return false
    }
    this.ccsSent = true
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
   * server must read it: the ClientHellos in the clear (the compatibility
   * record before a second one), the compatibility record and the handshake
   * write keys once they are known, the client's Finished under them, and
   * then the switch to the application keys, with the client's handshake and
   * application secrets wiped in `TlsClient` once they are installed here. A
   * KeyUpdate owed to the server goes last.
   */
  pump(): void {
    if (this.state === TLS_RECORD_STATE_FAILED) {
      return
    }
    if (this.state === TLS_RECORD_STATE_CLOSED) {
      this.sealClose()
      return
    }
    const tls: TlsClient = this.tls
    if (tls.outputInitialLength > 0) {
      // §D.4: after a HelloRetryRequest the record goes before the second ClientHello.
      if (tls.retried && !this.sealChangeCipherSpec()) {
        return
      }
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
    // Everything the client sends after its ServerHello is read is under the
    // handshake keys, an alert included, so they go in as soon as they are
    // known; the compatibility record, in the clear, goes first.
    if (this.writeLevel === TLS_LEVEL_INITIAL && tls.writeKnown(TLS_LEVEL_HANDSHAKE)) {
      if (!this.sealChangeCipherSpec()) {
        return
      }
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
      // The client's Finished is sealed: its handshake secret is done with.
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
   * to the next secret (§4.6.3, §7.2), the old one wiped. False, sending
   * nothing, when it does not fit in `output` yet.
   */
  sendKeyUpdate(request: boolean): boolean {
    const message: u8[] = [toU8(TLS_HANDSHAKE_KEY_UPDATE), toU8(0), toU8(0), toU8(1), toU8(request ? 1 : 0)]
    if (!this.sealRecord(TLS_CONTENT_HANDSHAKE, message, TLS_RECORD_CLIENT_FROM, TLS_KEY_UPDATE_SIZE)) {
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
   * `requestPeer` (§4.6.3). Answers 0, `TLS_RECORD_AGAIN` while the handshake
   * is under way or `output` is full, `TLS_RECORD_PIPE` once the client has
   * closed or the connection failed, or `TLS_RECORD_RESET` when the next keys
   * do not install.
   */
  keyUpdate(requestPeer: boolean): i32 {
    if (this.state === TLS_RECORD_STATE_FAILED || this.state === TLS_RECORD_STATE_CLOSED) {
      return TLS_RECORD_PIPE
    }
    this.pump()
    if (this.state !== TLS_RECORD_STATE_OPEN || this.writeLevel !== TLS_LEVEL_APPLICATION) {
      return this.state === TLS_RECORD_STATE_FAILED ? TLS_RECORD_RESET : TLS_RECORD_AGAIN
    }
    if (this.keyUpdateDue || !this.sendKeyUpdate(requestPeer)) {
      return this.state === TLS_RECORD_STATE_FAILED ? TLS_RECORD_RESET : TLS_RECORD_AGAIN
    }
    return 0
  }

  /**
   * Fails the connection with `alert`, sent as a fatal alert under whatever
   * the client writes with now. What was still owed is dropped, and once the
   * alert is sealed every key the connection holds is wiped.
   */
  fail(alert: i32): void {
    if (this.state === TLS_RECORD_STATE_FAILED) {
      return
    }
    const closed: boolean = this.state === TLS_RECORD_STATE_CLOSED
    this.dropPending()
    this.state = TLS_RECORD_STATE_FAILED
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
   * was. A KeyUpdate goes first when the key has protected `recordLimit`
   * records, or the server asked for one. `TLS_RECORD_AGAIN` while the
   * handshake is under way or nothing fits, `TLS_RECORD_PIPE` once the client
   * has closed or the connection failed, `TLS_RECORD_INVALID` for a window
   * outside `data`.
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
      return this.state === TLS_RECORD_STATE_FAILED ? TLS_RECORD_RESET : TLS_RECORD_AGAIN
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
      return this.state === TLS_RECORD_STATE_FAILED ? TLS_RECORD_RESET : TLS_RECORD_AGAIN
    }
    return done
  }

  /**
   * Application data from the server, into `buf[off .. off + len)`: the
   * count; 0 at the end of its stream (its `close_notify`) or for a `len` of
   * 0; `TLS_RECORD_AGAIN` when nothing is waiting; `TLS_RECORD_RESET` once
   * the connection has failed; `TLS_RECORD_INVALID` for a window outside
   * `buf`.
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
      for (let k: i32 = 0; k < n && off + k < toI32(buf.length); k++) {
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
   * Closes the client's side (§6.1): a `close_notify`, after which `write`
   * answers `TLS_RECORD_PIPE`. Application data already written stays ahead
   * of the alert; the write keys are wiped once it is sealed. Nothing
   * happens once the connection has failed or closed.
   */
  close(): void {
    if (this.state === TLS_RECORD_STATE_FAILED || this.state === TLS_RECORD_STATE_CLOSED) {
      return
    }
    this.dropPending()
    this.state = TLS_RECORD_STATE_CLOSED
    this.closeDue = true
    this.sealClose()
  }

  /** Seals the `close_notify` `close` owes once `output` has room, then wipes the write direction. */
  sealClose(): void {
    if (this.closeDue && this.sendAlert(TLS_ALERT_LEVEL_WARNING, TLS_ALERT_CLOSE_NOTIFY)) {
      this.closeDue = false
      this.wipeWrite()
    }
  }

  /**
   * The caller's verdict on the server's certificate chain and
   * CertificateVerify, while `interest` says `TLS_RECORD_AUTH`
   * (`TlsClient.authenticate`): `true` reads on to the server's Finished and
   * seals the client's; `false` fails the connection with `bad_certificate`
   * sent. Answers 0, or the alert the connection failed with —
   * `internal_error` when no verdict is due.
   */
  authenticate(ok: boolean): i32 {
    if (this.state !== TLS_RECORD_STATE_HANDSHAKE) {
      return this.state === TLS_RECORD_STATE_FAILED ? this.alert : TLS_ALERT_INTERNAL_ERROR
    }
    const alert: i32 = this.tls.authenticate(ok)
    if (alert !== 0) {
      this.fail(alert)
      return alert
    }
    this.advance()
    this.process()
    return this.state === TLS_RECORD_STATE_FAILED ? this.alert : 0
  }

  /** Refuses the server with the caller's `alert` (`TlsClient.reject`), sent; answers the alert. */
  reject(alert: i32): i32 {
    if (this.state !== TLS_RECORD_STATE_HANDSHAKE) {
      return this.state === TLS_RECORD_STATE_FAILED ? this.alert : TLS_ALERT_INTERNAL_ERROR
    }
    const sent: i32 = this.tls.reject(alert)
    this.fail(sent)
    return sent
  }

  /**
   * What the connection wants next, as `TLS_RECORD_*` bits: read the socket,
   * write it, `read`, the caller's verdict on the server (`TLS_RECORD_AUTH`),
   * or nothing more ever (`TLS_RECORD_DONE`).
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
    const live: boolean = this.state === TLS_RECORD_STATE_HANDSHAKE || this.state === TLS_RECORD_STATE_OPEN
    const blocked: boolean = this.reader.next() > 0
    if (live && !this.peerClosed && !this.ended && !blocked && this.reader.space() > 0) {
      bits = bits | TLS_RECORD_WANT_READ
    }
    if (this.plainEnd > this.plainStart || (this.peerClosed && live)) {
      bits = bits | TLS_RECORD_DATA
    }
    if (this.state === TLS_RECORD_STATE_HANDSHAKE && this.tls.state === TLS_CLIENT_STATE_WAIT_AUTH) {
      bits = bits | TLS_RECORD_AUTH
    }
    return bits
  }
}
