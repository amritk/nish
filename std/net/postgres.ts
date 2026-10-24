/**
 * `nish/net/postgres` — the client side of PostgreSQL's frontend/backend
 * protocol, version 3.0: a sans-IO connection that writes the frontend's
 * messages into an output buffer and reads the backend's from an input
 * buffer, for a program that owns its socket (`nish:net`) and its loop.
 *
 *     const config = new PgConfig();
 *     config.user = "app";
 *     config.database = "app";
 *     const nonce = new Array<u8>(18);
 *     crypto.getRandomValues(nonce);
 *     const conn = new PgConnection(config, password, nonce);
 *     // write conn.outputBuffer()[conn.outputStart() .. conn.outputEnd()), then conn.sent(n)
 *     // read into conn.inputBuffer() at conn.inputEnd(), up to conn.inputRoom() bytes, then conn.received(n)
 *     let event: i32 = conn.next();
 *     while (event !== PG_NEED_MORE && event !== PG_FAILED) {
 *       // PG_READY: authenticated; prepare statements and send queries
 *       //   conn.prepare("by_id", "select id, name from users where id = $1", [23]); conn.sync()
 *       //   conn.bindStart("by_id"); conn.paramInt(7); conn.bindEnd(); conn.sync()
 *       // PG_ROW: conn.int(0), conn.colStart(1) .. + conn.colLength(1) in conn.inputBuffer()
 *       // PG_COMPLETE: conn.tagRows(); PG_ERROR: conn.lastError.code
 *       // PG_GROUP_DONE: one sync()'s group has been answered
 *       event = conn.next();
 *     }
 *
 * **Events.** `next()` answers `PG_READY` once, when the server has
 * authenticated the connection and is ready for queries; `PG_DESCRIBED` when a
 * prepared statement has been described (`columns` and `columnType(c)` say
 * what its rows hold, `columns` is 0 when it returns none); `PG_ROW` for each
 * row, its columns as windows into the input buffer (`colStart(c)`,
 * `colLength(c)`, -1 for NULL); `PG_COMPLETE` when an execution has finished
 * (`tagIs("UPDATE")`, `tagRows()`); `PG_ERROR` when a statement in the current
 * group failed (`lastError`); `PG_NOTICE` for a notice (`lastNotice`);
 * `PG_GROUP_DONE` when a group has been answered to its end (`groupFailed`,
 * `txStatus`); and `PG_FAILED`, final: the connection broke a rule or the
 * server ended it, `failure` says which and `lastError` holds the server's
 * reason when it gave one. `PG_NEED_MORE` asks for more input. A window stays
 * valid until the next `next()`.
 *
 * **Groups and pipelining.** Every statement is sent with the extended query
 * protocol: `prepare` (Parse and Describe), `bindStart`, the `param...` calls
 * and `bindEnd` (Bind and Execute), `closeStatement` (Close), then `sync()`,
 * which ends the group. The server answers groups in order and skips the rest
 * of a group after an error, so one failed statement costs only its own group.
 * Up to `maxInFlight` groups may wait for their answers at once; `canSend()`
 * says whether another may start, and the builder calls refuse (and write
 * nothing) when it may not. Nothing waits for a round trip that the protocol
 * does not need: a program prepares a statement and executes it in the same
 * flight.
 *
 * **Text results, no copies.** Every parameter and every result column is in
 * text format. A row is read where it lies in the input buffer: `next()` frames
 * each message once, validates its layout, and records each column's start and
 * length in two reused arrays, so a row costs no allocation. `int`, `bool`,
 * `isNull` and `PgText.timestamp` decode a column in place; `PgArrayWalker`
 * walks a one-dimensional `text[]` in place. `columnText(c)` is the one that
 * allocates, a string.
 *
 * **Authentication.** SCRAM-SHA-256 (RFC 5802, RFC 7677) or none (`trust`).
 * The password arrives as a `Secret<u8[]>`; the connection keeps a copy in a
 * holder that is wiped as soon as the proof is computed, or when the
 * connection fails or is disposed. The server's signature is checked in
 * constant time before `AuthenticationOk` is believed, and an
 * `AuthenticationOk` that skips the end of an exchange SCRAM began is refused.
 * Cleartext and MD5 passwords, and SASL mechanisms other than SCRAM-SHA-256,
 * are refused: with no TLS here the first sends the password as it is, and the
 * second is a hash any eavesdropper can replay. `docs/security/postgres.md` is
 * the record.
 *
 * **Caps.** `PgConfig` bounds what a server can make the client hold: the
 * longest message (`maxMessage`), the widest row (`maxColumns`) and the SCRAM
 * iteration count (`minIterations`, `maxIterations`). A message longer than
 * the cap, a length below 4, a layout that does not add up, a message the
 * protocol does not allow at that point (COPY among them), and an encoding
 * other than UTF-8 each fail the connection with their own `failure` code.
 *
 * Written from PostgreSQL's "Frontend/Backend Protocol" chapter (version 18)
 * and RFC 5802 and RFC 7677; not ported from another implementation.
 */
import { getI32BE, getU16BE, setI32BE, setU16BE } from "nish/bytes"
import { base64Decode, base64Encode } from "nish/crypto/base64url"
import { timingSafeEqual } from "nish/crypto/ct"
import { hmacSha256 } from "nish/crypto/hmac"
import { sha256 } from "nish/crypto/sha256"
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret"

/** `next()` needs more input before it can say anything. */
export const PG_NEED_MORE: i32 = 0
/** The connection is authenticated and ready for queries; answered once. */
export const PG_READY: i32 = 1
/** A row: `columns` columns, each at `colStart(c)` for `colLength(c)` bytes. */
export const PG_ROW: i32 = 2
/** An execution has finished: `tagIs`, `tagRows`. */
export const PG_COMPLETE: i32 = 3
/** A statement in the current group failed: `lastError`. */
export const PG_ERROR: i32 = 4
/** A group has been answered: `groupFailed`, `txStatus`. */
export const PG_GROUP_DONE: i32 = 5
/** A notice: `lastNotice`. */
export const PG_NOTICE: i32 = 6
/** A prepared statement has been described: `columns`, `columnType(c)`. */
export const PG_DESCRIBED: i32 = 7
/** Final: the connection is over, and `failure` says why. */
export const PG_FAILED: i32 = 8

/** `failure` while the connection is alive. */
export const PG_ERR_NONE: i32 = 0
/** A message length below 4, or a message whose layout does not add up. */
export const PG_ERR_FRAME: i32 = 1
/** A message longer than `maxMessage`, or a row wider than `maxColumns`. */
export const PG_ERR_TOO_BIG: i32 = 2
/** A message the protocol does not allow at this point. */
export const PG_ERR_UNEXPECTED: i32 = 3
/** An authentication method this client refuses (cleartext, MD5, GSS, SSPI, a SASL mechanism other than SCRAM-SHA-256). */
export const PG_ERR_AUTH_UNSUPPORTED: i32 = 4
/** A SCRAM exchange the server got wrong: a malformed message, a nonce that does not extend ours, an iteration count out of bounds. */
export const PG_ERR_SCRAM: i32 = 5
/** The server's SCRAM signature is not the one the password gives: it does not know the password. */
export const PG_ERR_SERVER_SIGNATURE: i32 = 6
/** The server sent a FATAL or PANIC error, or any error before the connection was ready: `lastError`. */
export const PG_ERR_SERVER: i32 = 7
/** The server's `client_encoding` is not UTF8. */
export const PG_ERR_ENCODING: i32 = 8
/** The program reported the end of the stream (`closed()`). */
export const PG_ERR_CLOSED: i32 = 9

/** `PgArrayWalker.next()`: an element, at `start` for `length` bytes. */
export const PG_ARRAY_ELEMENT: i32 = 0
/** `PgArrayWalker.next()`: a NULL element. */
export const PG_ARRAY_NULL: i32 = -1
/** `PgArrayWalker.next()`: no more elements. */
export const PG_ARRAY_END: i32 = -2
/** `PgArrayWalker.next()`: the text is not a one-dimensional array literal. */
export const PG_ARRAY_BAD: i32 = -3

// The connection's states, in the order they come.
const PG_STATE_AUTH: i32 = 0
const PG_STATE_SCRAM_FIRST: i32 = 1
const PG_STATE_SCRAM_FINAL: i32 = 2
const PG_STATE_STARTING: i32 = 3
const PG_STATE_READY: i32 = 4
const PG_STATE_FAILED: i32 = 5

// The frontend's message types, and the bytes the builder writes.
const PG_FE_PASSWORD: i32 = 112 // 'p', every SASL response
const PG_FE_PARSE: i32 = 80 // 'P'
const PG_FE_DESCRIBE: i32 = 68 // 'D'
const PG_FE_BIND: i32 = 66 // 'B'
const PG_FE_EXECUTE: i32 = 69 // 'E'
const PG_FE_CLOSE: i32 = 67 // 'C'
const PG_FE_SYNC: i32 = 83 // 'S'
const PG_FE_TERMINATE: i32 = 88 // 'X'
const PG_TARGET_STATEMENT: i32 = 83 // 'S', what Describe and Close name
const PG_ZERO: i32 = 0
const PG_COMMA: i32 = 44
const PG_QUOTE: i32 = 34
const PG_BACKSLASH: i32 = 92
const PG_LBRACE: i32 = 123
const PG_RBRACE: i32 = 125

// The protocol version the startup message asks for: 3.0.
const PG_PROTOCOL: i32 = 196608
// The bytes of the client nonce, which base64 spells in 24 characters.
const PG_NONCE_BYTES: i32 = 18

/** The caps a connection enforces, and the startup parameters it sends. */
export class PgConfig {
  /** The role to connect as; required. */
  user: string = ""
  /** The database; empty means the server's default, the role's name. */
  database: string = ""
  /** `application_name`, shown in `pg_stat_activity`; empty sends none. */
  applicationName: string = ""
  /** The startup `options` parameter (`-c name=value ...`); empty sends none. */
  options: string = ""
  /** The longest backend message, in bytes, its type byte aside; past it, `PG_ERR_TOO_BIG`. */
  maxMessage: i32 = 1048576
  /** The most groups waiting for their answers at once. */
  maxInFlight: i32 = 16
  /** The input buffer's first size, in bytes; it grows to a message's length, up to `maxMessage` + 1. */
  inputSize: i32 = 8192
  /** The widest row; past it, `PG_ERR_TOO_BIG`. PostgreSQL's own limit is 1664. */
  maxColumns: i32 = 1664
  /** The fewest SCRAM iterations accepted; 4096 is PostgreSQL's default and RFC 7677's floor. */
  minIterations: i32 = 4096
  /** The most SCRAM iterations computed, so a server cannot make the client spin. */
  maxIterations: i32 = 100000
}

/** A server's ErrorResponse or NoticeResponse: the fields a program acts on. */
export class PgError {
  /** ERROR, FATAL or PANIC; WARNING, NOTICE, DEBUG, INFO or LOG for a notice. Never localised. */
  readonly severity: string
  /** The SQLSTATE, five characters: `23505` is a unique violation. */
  readonly code: string
  /** The primary message. */
  readonly message: string
  /** The detail, or "". */
  readonly detail: string
  /** The hint, or "". */
  readonly hint: string
  /** The constraint that was violated, or "". */
  readonly constraint: string
  /** The 1-based character position in the statement's text, or "". */
  readonly position: string

  constructor(
    severity: string,
    code: string,
    message: string,
    detail: string,
    hint: string,
    constraint: string,
    position: string
  ) {
    this.severity = severity
    this.code = code
    this.message = message
    this.detail = detail
    this.hint = hint
    this.constraint = constraint
    this.position = position
  }
}

/** A fresh copy of `bytes`; the password holder keeps one. */
const pgCopyBytes = (bytes: u8[]): u8[] => {
  const copy: u8[] = new Array<u8>(toI32(bytes.length))
  copy.set(bytes, 0)
  return copy
}

/** The connection's copy of the password, wiped once the proof is computed. */
class PgPassword {
  readonly bytes: Secret<u8[]>

  constructor(password: Secret<u8[]>) {
    this.bytes = secret(expose(password, pgCopyBytes))
  }

  wipe(): void {
    wipe(this.bytes)
  }
}

/** The bytes of `text`. */
const pgBytesOf = (text: string): u8[] => {
  const out: u8[] = []
  const n: i32 = toI32(text.length)
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/** Whether `text` holds a NUL byte, which a protocol string cannot. */
const pgHasNul = (text: string): boolean => {
  const n: i32 = toI32(text.length)
  for (let i: i32 = 0; i < n; i++) {
    if (text.charCodeAt(i) === 0) {
      return true
    }
  }
  return false
}

/** The first `byte` in `b[from, end)`, or `end`. */
const pgFind = (b: u8[], from: i32, end: i32, byte: i32): i32 => {
  if (from < 0 || end > toI32(b.length)) {
    panic("nish/net/postgres: pgFind outside the buffer")
  }
  for (let i: i32 = from; i < end; i++) {
    if (toI32(b[i]) === byte) {
      return i
    }
  }
  return end
}

/** Whether `b[start, start + length)` spells `text`. */
const pgBytesAre = (b: u8[], start: i32, length: i32, text: string): boolean => {
  const n: i32 = toI32(text.length)
  if (length !== n || start < 0 || start > toI32(b.length) - n) {
    return false
  }
  for (let i: i32 = 0; i < n; i++) {
    if (toI32(b[start + i]) !== toI32(text.charCodeAt(i))) {
      return false
    }
  }
  return true
}

/**
 * The salted password, PBKDF2-HMAC-SHA-256 over the password and the salt
 * (RFC 5802 §3, `Hi`), 32 bytes, or `null` when it cannot be computed.
 *
 * PBKDF2-PENDING: `pbkdf2HmacSha256` from `nish/crypto/hmac` computes this;
 * until it lands the seam answers `null`, which fails the exchange with
 * `PG_ERR_SCRAM`.
 */
const pgSaltedPassword = (_password: Secret<u8[]>, _salt: u8[], _iterations: i32): Secret<u8[]> | null => null

/**
 * RFC 5802 §3 from the salted password and the AuthMessage: the ClientProof
 * (32 bytes) followed by the ServerSignature (32 bytes). Every key in between
 * is wiped before it returns.
 */
const pgScramKeys = (salted: u8[], authMessage: u8[]): u8[] => {
  const clientKey: u8[] = hmacSha256(salted, pgBytesOf("Client Key"))
  const storedKey: u8[] = sha256(clientKey)
  const clientSignature: u8[] = hmacSha256(storedKey, authMessage)
  const serverKey: u8[] = hmacSha256(salted, pgBytesOf("Server Key"))
  const serverSignature: u8[] = hmacSha256(serverKey, authMessage)
  const out: u8[] = new Array<u8>(64)
  if (clientKey.length < 32 || clientSignature.length < 32 || serverSignature.length < 32) {
    panic("nish/net/postgres: an HMAC-SHA-256 shorter than 32 bytes")
  }
  for (let i: i32 = 0; i < 32; i++) {
    out[i] = clientKey[i] ^ clientSignature[i]
    out[32 + i] = serverSignature[i]
  }
  wipe(clientKey)
  wipe(storedKey)
  wipe(clientSignature)
  wipe(serverKey)
  return out
}

/** Decoders for PostgreSQL's text format, in place; a bad input sets `failed`, which stays set. */
export class PgText {
  /** Whether a decode since the last `reset()` was given something it could not read. */
  failed: boolean = false

  /** Clears `failed`. */
  reset(): void {
    this.failed = false
  }

  /** An `int2`, `int4` or `int8` column: an optional `-` and 1 to 19 digits; 0 and `failed` otherwise, and on overflow. */
  int(b: u8[], start: i32, length: i32): i64 {
    const end: i32 = start + length
    if (length <= 0 || start < 0 || end < start || end > toI32(b.length)) {
      this.failed = true
      return 0
    }
    const negative: boolean = toI32(b[start]) === 45
    let i: i32 = start
    if (negative) {
      i++
    }
    if (i === end) {
      this.failed = true
      return 0
    }
    // Accumulated as a negative number, so that the most negative i64 fits.
    const lastDigit: i64 = negative ? 8 : 7
    // The most negative i64 divided by ten, which a literal cannot spell exactly.
    const minTenth: i64 = toI64(-922337203) * 1000000000 - 685477580
    let acc: i64 = 0
    while (i < end) {
      const d: i32 = toI32(b[i]) - 48
      if (d < 0 || d > 9) {
        this.failed = true
        return 0
      }
      const digit: i64 = toI64(d)
      if (acc < minTenth || (acc === minTenth && digit > lastDigit)) {
        this.failed = true
        return 0
      }
      acc = acc * 10 - digit
      i++
    }
    return negative ? acc : -acc
  }

  /** A `bool` column: `t` or `f`; false and `failed` otherwise. */
  bool(b: u8[], start: i32, length: i32): boolean {
    if (length === 1 && start >= 0 && start < toI32(b.length)) {
      const c: i32 = toI32(b[start])
      if (c === 116) {
        return true
      }
      if (c === 102) {
        return false
      }
    }
    this.failed = true
    return false
  }

  /**
   * A `timestamptz` column, as the connection's `DateStyle=ISO` and
   * `TimeZone=UTC` spell it (`2024-01-02 03:04:05.123456+00`), or a
   * `timestamp` column (the same without `+00`), written to `out[at, at + 24)`
   * as `2024-01-02T03:04:05.123Z`, the fraction cut to milliseconds. Answers
   * 24, or -1 and `failed` for anything else: a year outside 0001–9999, BC,
   * `infinity`, an offset other than `+00`.
   */
  timestamp(b: u8[], start: i32, length: i32, out: u8[], at: i32): i32 {
    if (
      start < 0 ||
      length < 19 ||
      start > toI32(b.length) - length ||
      at < 0 ||
      at + 24 > toI32(out.length)
    ) {
      this.failed = true
      return -1
    }
    // The fixed part: YYYY-MM-DD HH:MM:SS, its separators where they belong.
    for (let i: i32 = 0; i < 19; i++) {
      const c: i32 = toI32(b[start + i])
      let ok: boolean = c >= 48 && c <= 57
      if (i === 4 || i === 7) {
        ok = c === 45
      } else if (i === 10) {
        ok = c === 32
      } else if (i === 13 || i === 16) {
        ok = c === 58
      }
      if (!ok) {
        this.failed = true
        return -1
      }
    }
    let p: i32 = start + 19
    const end: i32 = start + length
    if (p < 0 || end > toI32(b.length)) {
      this.failed = true
      return -1
    }
    let millis: i32 = 0
    if (p < end && toI32(b[p]) === 46) {
      p++
      let digits: i32 = 0
      while (p < end && toI32(b[p]) >= 48 && toI32(b[p]) <= 57) {
        if (digits < 3) {
          millis = millis * 10 + toI32(b[p]) - 48
        }
        digits++
        p++
      }
      if (digits < 1 || digits > 6) {
        this.failed = true
        return -1
      }
      while (digits < 3) {
        millis = millis * 10
        digits++
      }
    }
    if (p + 3 === end && toI32(b[p]) === 43 && toI32(b[p + 1]) === 48 && toI32(b[p + 2]) === 48) {
      p = end
    }
    if (p !== end) {
      this.failed = true
      return -1
    }
    for (let i: i32 = 0; i < 19; i++) {
      out[at + i] = b[start + i]
    }
    out[at + 10] = toU8(84)
    out[at + 19] = toU8(46)
    out[at + 20] = toU8(millis / 100 + 48)
    out[at + 21] = toU8(((millis / 10) % 10) + 48)
    out[at + 22] = toU8((millis % 10) + 48)
    out[at + 23] = toU8(90)
    if (pgBytesAre(out, at, 4, "0000")) {
      this.failed = true
      return -1
    }
    return 24
  }
}

/**
 * A walk over a one-dimensional `text[]` column in place: `start` the
 * column, then `next()` until `PG_ARRAY_END` or `PG_ARRAY_BAD`. Each element
 * is the window `[start, start + length)` of the column's buffer; a quoted
 * element with a backslash escape in it has `escaped` set, and `copy` writes
 * its bytes unescaped. An unquoted `NULL`, in any case, is `PG_ARRAY_NULL`.
 * Dimension decorations (`[1:2]={...}`) and nested arrays are `PG_ARRAY_BAD`.
 */
export class PgArrayWalker {
  /** The current element's first byte in the buffer. */
  start: i32 = 0
  /** The current element's length, escapes included. */
  length: i32 = 0
  /** Whether the current element holds a backslash escape. */
  escaped: boolean = false
  private pos: i32 = 0
  private end: i32 = 0
  private first: boolean = true
  private bad: boolean = false
  private b: u8[]

  constructor() {
    this.b = []
  }

  /** Starts a walk over `b[start, start + length)`. */
  begin(b: u8[], start: i32, length: i32): void {
    this.b = b
    this.first = true
    this.bad = !(start >= 0 && length >= 2 && start + length <= toI32(b.length))
    if (!this.bad) {
      this.bad = toI32(b[start]) !== 123 || toI32(b[start + length - 1]) !== 125
    }
    this.pos = start + 1
    this.end = start + length - 1
  }

  private refuse(): i32 {
    this.bad = true
    return PG_ARRAY_BAD
  }

  /** The next element: `PG_ARRAY_ELEMENT`, `PG_ARRAY_NULL`, `PG_ARRAY_END` or `PG_ARRAY_BAD`. */
  next(): i32 {
    if (this.bad) {
      return PG_ARRAY_BAD
    }
    const b: u8[] = this.b
    const end: i32 = this.end
    if (this.pos < 0 || end > toI32(b.length)) {
      return this.refuse()
    }
    if (this.first) {
      this.first = false
      if (this.pos === end) {
        return PG_ARRAY_END
      }
    } else {
      if (this.pos === end) {
        return PG_ARRAY_END
      }
      if (toI32(b[this.pos]) !== 44) {
        return this.refuse()
      }
      this.pos += 1
    }
    let p: i32 = this.pos
    if (p < 0) {
      return this.refuse()
    }
    this.escaped = false
    if (p < end && toI32(b[p]) === 34) {
      p++
      this.start = p
      while (p < end && toI32(b[p]) !== 34) {
        if (toI32(b[p]) === 92) {
          this.escaped = true
          p++
        }
        p++
      }
      if (p >= end) {
        return this.refuse()
      }
      this.length = p - this.start
      this.pos = p + 1
      if (this.pos !== end && toI32(b[this.pos]) !== 44) {
        return this.refuse()
      }
      return PG_ARRAY_ELEMENT
    }
    this.start = p
    while (p < end && toI32(b[p]) !== 44) {
      const c: i32 = toI32(b[p])
      if (c === 123 || c === 125 || c === 34 || c === 92 || c === 32) {
        return this.refuse()
      }
      p++
    }
    this.length = p - this.start
    this.pos = p
    if (this.length === 0) {
      return this.refuse()
    }
    if (this.length === 4 && p >= 4) {
      const n: i32 = toI32(b[p - 4]) | 32
      const u: i32 = toI32(b[p - 3]) | 32
      const l1: i32 = toI32(b[p - 2]) | 32
      const l2: i32 = toI32(b[p - 1]) | 32
      if (n === 110 && u === 117 && l1 === 108 && l2 === 108) {
        return PG_ARRAY_NULL
      }
    }
    return PG_ARRAY_ELEMENT
  }

  /** Writes the current element, unescaped, to `out[at, ...)`; answers its length, or -1 when it does not fit. */
  copy(out: u8[], at: i32): i32 {
    const b: u8[] = this.b
    let n: i32 = 0
    let p: i32 = this.start
    const end: i32 = this.start + this.length
    if (p < 0 || end > toI32(b.length)) {
      return -1
    }
    while (p < end) {
      if (toI32(b[p]) === 92) {
        p++
      }
      if (p >= end || at + n >= toI32(out.length) || at < 0) {
        return -1
      }
      out[at + n] = b[p]
      n++
      p++
    }
    return n
  }
}

/**
 * One connection to a PostgreSQL server, sans IO: the program moves bytes
 * between the socket and the two buffers, and `next()` says what they meant.
 */
export class PgConnection {
  /** Why the connection failed, `PG_ERR_NONE` while it has not. */
  failure: i32 = 0
  /** The columns of the current row, or of the statement just described. */
  columns: i32 = 0
  /** The transaction status the last `PG_GROUP_DONE` reported: `I` idle, `T` in a transaction, `E` in a failed one (as a byte). */
  txStatus: i32 = 0
  /** The number of groups sent and not yet answered. */
  inFlight: i32 = 0
  /** The server's process id, from BackendKeyData. */
  backendPid: i32 = 0
  /** The number of notices received. */
  notices: i32 = 0
  /** The server's `server_version` parameter. */
  serverVersion: string = ""
  /** The last ErrorResponse, kept until the next. */
  lastError: PgError | null = null
  /** The last NoticeResponse, kept until the next. */
  lastNotice: PgError | null = null
  /** The decoders `int`, `bool` and `isNull` use; `text.failed` says whether one was given a column it could not read. */
  readonly text: PgText

  private readonly config: PgConfig
  private password: PgPassword | null = null
  private state: i32 = 0
  private input: u8[]
  private inStart: i32 = 0
  private inEnd: i32 = 0
  private out: u8[]
  private outStart: i32 = 0
  private outEnd: i32 = 0
  private colStarts: i32[]
  private colLengths: i32[]
  private colTypes: i32[]
  private tagStart: i32 = 0
  private tagLength: i32 = 0
  private errorInGroup: boolean = false
  private groupOpen: boolean = false
  /** Whether a statement in the group `PG_GROUP_DONE` just finished failed. */
  groupFailed: boolean = false
  private bindAt: i32 = -1
  private paramCountAt: i32 = 0
  private paramCount: i32 = 0
  private clientNonce: string = ""
  private serverSignature: u8[]

  /**
   * A connection that has queued its startup message. `password` is copied,
   * so the caller may wipe its own; `nonce` must be at least 18 bytes from a
   * cryptographic random source (`crypto.getRandomValues`), and is fixed only
   * in a test.
   */
  constructor(config: PgConfig, password: Secret<u8[]>, nonce: u8[]) {
    if (toI32(nonce.length) < PG_NONCE_BYTES) {
      panic("nish/net/postgres: the SCRAM nonce needs at least 18 random bytes")
    }
    if (config.user.length === 0) {
      panic("nish/net/postgres: PgConfig.user is required")
    }
    if (
      pgHasNul(config.user) ||
      pgHasNul(config.database) ||
      pgHasNul(config.applicationName) ||
      pgHasNul(config.options)
    ) {
      panic("nish/net/postgres: a startup parameter holds a NUL byte")
    }
    this.config = config
    this.text = new PgText()
    this.password = new PgPassword(password)
    const inputSize: i32 = config.inputSize < 64 ? 64 : config.inputSize
    this.input = new Array<u8>(inputSize)
    this.out = new Array<u8>(1024)
    this.colStarts = new Array<i32>(16)
    this.colLengths = new Array<i32>(16)
    this.colTypes = new Array<i32>(16)
    this.serverSignature = []
    const head: u8[] = []
    for (let i: i32 = 0; i < PG_NONCE_BYTES && i < toI32(nonce.length); i++) {
      head.push(nonce[i])
    }
    this.clientNonce = base64Encode(head)

    const at: i32 = this.outEnd
    this.putI32(PG_ZERO)
    this.putI32(PG_PROTOCOL)
    this.putParam("user", config.user)
    if (config.database.length > 0) {
      this.putParam("database", config.database)
    }
    this.putParam("client_encoding", "UTF8")
    this.putParam("DateStyle", "ISO")
    this.putParam("TimeZone", "UTC")
    if (config.applicationName.length > 0) {
      this.putParam("application_name", config.applicationName)
    }
    if (config.options.length > 0) {
      this.putParam("options", config.options)
    }
    this.putByte(PG_ZERO)
    setI32BE(this.out, at, this.outEnd - at)
  }

  // --- Buffers -----------------------------------------------------------------

  /** The input buffer: read from the socket into it at `inputEnd()`. */
  inputBuffer(): u8[] {
    return this.input
  }

  /** Where the next byte read goes. */
  inputEnd(): i32 {
    return this.inEnd
  }

  /** How many bytes may be read into the input buffer now. */
  inputRoom(): i32 {
    return toI32(this.input.length) - this.inEnd
  }

  /** Records that `n` bytes were read into the input buffer at `inputEnd()`. */
  received(n: i32): void {
    if (n < 0 || n > this.inputRoom()) {
      panic("nish/net/postgres: received more than inputRoom()")
    }
    this.inEnd += n
  }

  /** Copies what fits of `src[start, start + length)` into the input buffer; answers how much. */
  receive(src: u8[], start: i32, length: i32): i32 {
    const room: i32 = this.inputRoom()
    const n: i32 = length < room ? length : room
    for (let i: i32 = 0; i < n; i++) {
      this.input[this.inEnd + i] = src[start + i]
    }
    this.inEnd += n
    return n
  }

  /** The output buffer: write `[outputStart(), outputEnd())` to the socket. */
  outputBuffer(): u8[] {
    return this.out
  }

  /** The first byte not yet sent. */
  outputStart(): i32 {
    return this.outStart
  }

  /** One past the last byte queued. */
  outputEnd(): i32 {
    return this.outEnd
  }

  /** Records that `n` bytes from `outputStart()` were written to the socket. */
  sent(n: i32): void {
    if (n < 0 || n > this.outEnd - this.outStart) {
      panic("nish/net/postgres: sent more than was queued")
    }
    this.outStart += n
    if (this.outStart === this.outEnd) {
      this.outStart = 0
      this.outEnd = 0
    }
  }

  /** Reports the end of the stream: unless it already has, the connection fails with `PG_ERR_CLOSED`. */
  closed(): i32 {
    if (this.state !== PG_STATE_FAILED) {
      return this.fail(PG_ERR_CLOSED)
    }
    return PG_FAILED
  }

  /** Wipes the password if the connection still holds it. A program that drops a connection before it is ready calls this. */
  dispose(): void {
    const password: PgPassword | null = this.password
    if (password !== null) {
      password.wipe()
      this.password = null
    }
  }

  // --- Reading -----------------------------------------------------------------

  /** The next event from the input. */
  next(): i32 {
    while (true) {
      if (this.state === PG_STATE_FAILED) {
        return PG_FAILED
      }
      const avail: i32 = this.inEnd - this.inStart
      if (avail < 5) {
        this.compact()
        return PG_NEED_MORE
      }
      const at: i32 = this.inStart
      const type: i32 = toI32(this.input[at])
      const length: i32 = getI32BE(this.input, at + 1)
      if (length < 4) {
        return this.fail(PG_ERR_FRAME)
      }
      if (length > this.config.maxMessage) {
        return this.fail(PG_ERR_TOO_BIG)
      }
      if (avail - 1 < length) {
        this.compact()
        if (toI32(this.input.length) < length + 1) {
          const grown: u8[] = new Array<u8>(length + 1)
          grown.set(this.input, 0)
          this.input = grown
        }
        return PG_NEED_MORE
      }
      this.inStart = at + 1 + length
      const event: i32 = this.dispatch(type, at + 5, at + 1 + length)
      if (event !== PG_NEED_MORE) {
        return event
      }
    }
  }

  /** Moves the unread input, at most one partial message, to the start of the buffer. */
  private compact(): void {
    const start: i32 = this.inStart
    if (start === 0) {
      return
    }
    const n: i32 = this.inEnd - start
    for (let i: i32 = 0; i < n; i++) {
      this.input[i] = this.input[start + i]
    }
    this.inStart = 0
    this.inEnd = n
  }

  /** Fails the connection: the password is wiped and every later `next()` answers `PG_FAILED`. */
  private fail(code: i32): i32 {
    this.state = PG_STATE_FAILED
    this.failure = code
    this.dispose()
    return PG_FAILED
  }

  /** One message, `[body, end)` its contents; answers its event, or `PG_NEED_MORE` when it has none. */
  private dispatch(type: i32, body: i32, end: i32): i32 {
    const state: i32 = this.state
    if (type === 82) {
      // 'R': an authentication request.
      if (state >= PG_STATE_STARTING || end - body < 4) {
        return this.fail(end - body < 4 ? PG_ERR_FRAME : PG_ERR_UNEXPECTED)
      }
      return this.authenticate(getI32BE(this.input, body), body + 4, end)
    }
    if (type === 69 || type === 78) {
      // 'E' and 'N': an error or a notice.
      const error: PgError | null = this.readError(body, end)
      if (error === null) {
        return this.fail(PG_ERR_FRAME)
      }
      if (type === 78) {
        this.notices += 1
        this.lastNotice = error
        return PG_NOTICE
      }
      this.lastError = error
      if (state < PG_STATE_READY || error.severity === "FATAL" || error.severity === "PANIC") {
        return this.fail(PG_ERR_SERVER)
      }
      this.errorInGroup = true
      return PG_ERROR
    }
    if (type === 83) {
      // 'S': ParameterStatus, name and value.
      const nameEnd: i32 = pgFind(this.input, body, end, 0)
      if (nameEnd === end || pgFind(this.input, nameEnd + 1, end, 0) !== end - 1) {
        return this.fail(PG_ERR_FRAME)
      }
      if (pgBytesAre(this.input, body, nameEnd - body, "client_encoding")) {
        if (!pgBytesAre(this.input, nameEnd + 1, end - 2 - nameEnd, "UTF8")) {
          return this.fail(PG_ERR_ENCODING)
        }
      } else if (pgBytesAre(this.input, body, nameEnd - body, "server_version")) {
        this.serverVersion = String.fromBytes(this.input, nameEnd + 1, end - 1)
      }
      return PG_NEED_MORE
    }
    if (type === 65) {
      // 'A': a notification, for a LISTEN this client never sends.
      return PG_NEED_MORE
    }
    if (state < PG_STATE_STARTING) {
      return this.fail(PG_ERR_UNEXPECTED)
    }
    if (type === 75) {
      // 'K': BackendKeyData, the process id and the cancel key.
      if (state !== PG_STATE_STARTING || end - body !== 8) {
        return this.fail(state !== PG_STATE_STARTING ? PG_ERR_UNEXPECTED : PG_ERR_FRAME)
      }
      this.backendPid = getI32BE(this.input, body)
      return PG_NEED_MORE
    }
    if (type === 90) {
      // 'Z': ReadyForQuery, and the transaction status.
      if (end - body !== 1) {
        return this.fail(PG_ERR_FRAME)
      }
      const status: i32 = toI32(this.input[body])
      if (status !== 73 && status !== 84 && status !== 69) {
        return this.fail(PG_ERR_FRAME)
      }
      this.txStatus = status
      if (state === PG_STATE_STARTING) {
        this.state = PG_STATE_READY
        return PG_READY
      }
      if (this.inFlight === 0 || (this.inFlight === 1 && this.groupOpen)) {
        return this.fail(PG_ERR_UNEXPECTED)
      }
      this.inFlight -= 1
      this.groupFailed = this.errorInGroup
      this.errorInGroup = false
      return PG_GROUP_DONE
    }
    if (state !== PG_STATE_READY || this.inFlight === 0) {
      return this.fail(PG_ERR_UNEXPECTED)
    }
    if (type === 68) {
      return this.readRow(body, end)
    }
    if (type === 67) {
      // 'C': CommandComplete, the tag.
      if (end - body < 1 || pgFind(this.input, body, end, 0) !== end - 1) {
        return this.fail(PG_ERR_FRAME)
      }
      this.tagStart = body
      this.tagLength = end - 1 - body
      return PG_COMPLETE
    }
    if (type === 73) {
      // 'I': EmptyQueryResponse, an empty statement's completion.
      if (end !== body) {
        return this.fail(PG_ERR_FRAME)
      }
      this.tagStart = body
      this.tagLength = 0
      return PG_COMPLETE
    }
    if (type === 49 || type === 50 || type === 51) {
      // '1', '2', '3': ParseComplete, BindComplete, CloseComplete.
      return end === body ? PG_NEED_MORE : this.fail(PG_ERR_FRAME)
    }
    if (type === 116) {
      // 't': ParameterDescription.
      if (end - body < 2 || end - body !== toI32(getU16BE(this.input, body)) * 4 + 2) {
        return this.fail(PG_ERR_FRAME)
      }
      return PG_NEED_MORE
    }
    if (type === 84) {
      return this.readDescription(body, end)
    }
    if (type === 110) {
      // 'n': NoData, a statement that returns no rows.
      if (end !== body) {
        return this.fail(PG_ERR_FRAME)
      }
      this.columns = 0
      return PG_DESCRIBED
    }
    return this.fail(PG_ERR_UNEXPECTED)
  }

  /** Makes the column arrays hold at least `n`. */
  private reserveColumns(n: i32): void {
    if (n <= toI32(this.colStarts.length)) {
      return
    }
    const size: i32 = n < 2 * toI32(this.colStarts.length) ? 2 * toI32(this.colStarts.length) : n
    const starts: i32[] = new Array<i32>(size)
    const lengths: i32[] = new Array<i32>(size)
    const types: i32[] = new Array<i32>(size)
    starts.set(this.colStarts, 0)
    lengths.set(this.colLengths, 0)
    types.set(this.colTypes, 0)
    this.colStarts = starts
    this.colLengths = lengths
    this.colTypes = types
  }

  /** 'D': DataRow, each column's length (-1 for NULL) and bytes, which must fill the message exactly. */
  private readRow(body: i32, end: i32): i32 {
    if (end - body < 2) {
      return this.fail(PG_ERR_FRAME)
    }
    const b: u8[] = this.input
    const n: i32 = toI32(getU16BE(b, body))
    if (n > this.config.maxColumns) {
      return this.fail(PG_ERR_TOO_BIG)
    }
    this.reserveColumns(n)
    let p: i32 = body + 2
    for (let c: i32 = 0; c < n; c++) {
      if (end - p < 4) {
        return this.fail(PG_ERR_FRAME)
      }
      const length: i32 = getI32BE(b, p)
      p += 4
      if (length < -1 || length > end - p) {
        return this.fail(PG_ERR_FRAME)
      }
      this.colStarts[c] = p
      this.colLengths[c] = length
      if (length > 0) {
        p += length
      }
    }
    if (p !== end) {
      return this.fail(PG_ERR_FRAME)
    }
    this.columns = n
    return PG_ROW
  }

  /** 'T': RowDescription; each field is a name and 18 bytes, the type's OID 6 bytes into them. */
  private readDescription(body: i32, end: i32): i32 {
    if (end - body < 2) {
      return this.fail(PG_ERR_FRAME)
    }
    const b: u8[] = this.input
    const n: i32 = toI32(getU16BE(b, body))
    if (n > this.config.maxColumns) {
      return this.fail(PG_ERR_TOO_BIG)
    }
    this.reserveColumns(n)
    let p: i32 = body + 2
    for (let c: i32 = 0; c < n; c++) {
      const nameEnd: i32 = pgFind(b, p, end, 0)
      if (end - nameEnd < 19) {
        return this.fail(PG_ERR_FRAME)
      }
      this.colTypes[c] = getI32BE(b, nameEnd + 7)
      p = nameEnd + 19
    }
    if (p !== end) {
      return this.fail(PG_ERR_FRAME)
    }
    this.columns = n
    return PG_DESCRIBED
  }

  /** 'E' and 'N': the fields, each a type byte and a string, then a 0; `null` when they do not fill the message exactly. */
  private readError(body: i32, end: i32): PgError | null {
    const b: u8[] = this.input
    if (body < 0 || end > toI32(b.length)) {
      return null
    }
    let severity: string = ""
    let localised: string = ""
    let code: string = ""
    let message: string = ""
    let detail: string = ""
    let hint: string = ""
    let constraint: string = ""
    let position: string = ""
    let p: i32 = body
    while (true) {
      if (p < 0 || p >= end || p >= toI32(b.length)) {
        return null
      }
      const field: i32 = toI32(b[p])
      if (field === 0) {
        if (p !== end - 1) {
          return null
        }
        break
      }
      const valueEnd: i32 = pgFind(b, p + 1, end, 0)
      if (valueEnd === end) {
        return null
      }
      const value: string = String.fromBytes(b, p + 1, valueEnd)
      if (field === 86) {
        severity = value
      } else if (field === 83) {
        localised = value
      } else if (field === 67) {
        code = value
      } else if (field === 77) {
        message = value
      } else if (field === 68) {
        detail = value
      } else if (field === 72) {
        hint = value
      } else if (field === 110) {
        constraint = value
      } else if (field === 80) {
        position = value
      }
      p = valueEnd + 1
    }
    return new PgError(
      severity.length > 0 ? severity : localised,
      code,
      message,
      detail,
      hint,
      constraint,
      position
    )
  }

  // --- Authentication ----------------------------------------------------------

  /** 'R': the authentication request `code`, its data at `[body, end)`. */
  private authenticate(code: i32, body: i32, end: i32): i32 {
    const state: i32 = this.state
    if (code === 0) {
      // AuthenticationOk: without a password, or after the server proved it knows it.
      if (
        state === PG_STATE_SCRAM_FIRST ||
        (state === PG_STATE_SCRAM_FINAL && this.serverSignature.length > 0)
      ) {
        return this.fail(PG_ERR_SCRAM)
      }
      if (end !== body) {
        return this.fail(PG_ERR_FRAME)
      }
      this.dispose()
      this.state = PG_STATE_STARTING
      return PG_NEED_MORE
    }
    if (code === 10 && state === PG_STATE_AUTH) {
      return this.scramStart(body, end)
    }
    if (code === 11 && state === PG_STATE_SCRAM_FIRST) {
      return this.scramContinue(body, end)
    }
    if (code === 12 && state === PG_STATE_SCRAM_FINAL) {
      return this.scramFinal(body, end)
    }
    if (state === PG_STATE_AUTH && code !== 10 && code !== 11 && code !== 12) {
      return this.fail(PG_ERR_AUTH_UNSUPPORTED)
    }
    return this.fail(PG_ERR_UNEXPECTED)
  }

  /** AuthenticationSASL: the mechanisms, each NUL-terminated, then a 0; SCRAM-SHA-256 must be among them. */
  private scramStart(body: i32, end: i32): i32 {
    const b: u8[] = this.input
    if (body < 0 || end > toI32(b.length)) {
      return this.fail(PG_ERR_FRAME)
    }
    let offered: boolean = false
    let p: i32 = body
    while (true) {
      if (p < 0 || p >= end || p >= toI32(b.length)) {
        return this.fail(PG_ERR_FRAME)
      }
      if (toI32(b[p]) === 0) {
        if (p !== end - 1) {
          return this.fail(PG_ERR_FRAME)
        }
        break
      }
      const nameEnd: i32 = pgFind(b, p, end, 0)
      if (nameEnd === end) {
        return this.fail(PG_ERR_FRAME)
      }
      if (pgBytesAre(b, p, nameEnd - p, "SCRAM-SHA-256")) {
        offered = true
      }
      p = nameEnd + 1
    }
    if (!offered) {
      return this.fail(PG_ERR_AUTH_UNSUPPORTED)
    }
    // SASLInitialResponse: the mechanism, then client-first-message, `n,,`
    // and the bare part. PostgreSQL takes the user from the startup message,
    // so the SCRAM user name is empty (§53.3.1).
    const first: string = `n,,${this.firstBare()}`
    const at: i32 = this.startMessage(PG_FE_PASSWORD)
    this.putCString("SCRAM-SHA-256")
    this.putI32(toI32(first.length))
    this.putString(first)
    this.endMessage(at)
    this.state = PG_STATE_SCRAM_FIRST
    return PG_NEED_MORE
  }

  /** client-first-message-bare. */
  private firstBare(): string {
    return `n=,r=${this.clientNonce}`
  }

  /**
   * AuthenticationSASLContinue: server-first-message, exactly `r=`, `s=`,
   * `i=` in that order. Answers with client-final-message and its proof.
   */
  private scramContinue(body: i32, end: i32): i32 {
    const b: u8[] = this.input
    if (body < 0 || end > toI32(b.length)) {
      return this.fail(PG_ERR_FRAME)
    }
    const nonceEnd: i32 = pgFind(b, body, end, 44)
    const saltEnd: i32 = pgFind(b, nonceEnd + 1 < end ? nonceEnd + 1 : end, end, 44)
    if (
      nonceEnd === end ||
      saltEnd === end ||
      !pgBytesAre(b, body, 2, "r=") ||
      !pgBytesAre(b, nonceEnd + 1, 2, "s=") ||
      end - saltEnd < 4 ||
      !pgBytesAre(b, saltEnd + 1, 2, "i=")
    ) {
      return this.fail(PG_ERR_SCRAM)
    }
    // The nonce extends ours with printable characters other than a comma.
    const ours: i32 = toI32(this.clientNonce.length)
    if (nonceEnd - body - 2 <= ours || !pgBytesAre(b, body + 2, ours, this.clientNonce)) {
      return this.fail(PG_ERR_SCRAM)
    }
    const nonceStart: i32 = body + 2 + ours
    const digitsStart: i32 = saltEnd + 3
    if (nonceStart < 0 || nonceEnd > toI32(b.length)) {
      return this.fail(PG_ERR_SCRAM)
    }
    for (let i: i32 = nonceStart; i < nonceEnd && i < toI32(b.length); i++) {
      const c: i32 = toI32(b[i])
      if (c < 33 || c > 126) {
        return this.fail(PG_ERR_SCRAM)
      }
    }
    if (digitsStart < 0) {
      return this.fail(PG_ERR_SCRAM)
    }
    let iterations: i32 = 0
    for (let i: i32 = digitsStart; i < end && i < toI32(b.length); i++) {
      const d: i32 = toI32(b[i]) - 48
      if (d < 0 || d > 9 || iterations > this.config.maxIterations) {
        return this.fail(PG_ERR_SCRAM)
      }
      iterations = iterations * 10 + d
    }
    if (iterations < this.config.minIterations || iterations > this.config.maxIterations) {
      return this.fail(PG_ERR_SCRAM)
    }
    const salt: u8[] | null = base64Decode(String.fromBytes(b, nonceEnd + 3, saltEnd))
    if (salt === null || salt.length === 0) {
      return this.fail(PG_ERR_SCRAM)
    }
    const password: PgPassword | null = this.password
    if (password === null) {
      return this.fail(PG_ERR_SCRAM)
    }
    const salted: Secret<u8[]> | null = pgSaltedPassword(password.bytes, salt, iterations)
    if (salted === null) {
      return this.fail(PG_ERR_SCRAM)
    }
    const withoutProof: string = `c=biws,r=${String.fromBytes(b, body + 2, nonceEnd)}`
    const authMessage: u8[] = pgBytesOf(
      `${this.firstBare()},${String.fromBytes(b, body, end)},${withoutProof}`
    )
    const keys: u8[] = exposeWith(salted, authMessage, pgScramKeys)
    wipe(salted)
    this.dispose()
    const proof: u8[] = new Array<u8>(32)
    const signature: u8[] = new Array<u8>(32)
    if (toI32(keys.length) < 64) {
      panic("nish/net/postgres: the SCRAM keys are not 64 bytes")
    }
    for (let i: i32 = 0; i < 32; i++) {
      proof[i] = keys[i]
      signature[i] = keys[32 + i]
    }
    this.serverSignature = signature
    const at: i32 = this.startMessage(PG_FE_PASSWORD)
    this.putString(`${withoutProof},p=${base64Encode(proof)}`)
    this.endMessage(at)
    this.state = PG_STATE_SCRAM_FINAL
    return PG_NEED_MORE
  }

  /** AuthenticationSASLFinal: exactly `v=` and the ServerSignature, compared in constant time. */
  private scramFinal(body: i32, end: i32): i32 {
    const b: u8[] = this.input
    if (end - body < 2 || !pgBytesAre(b, body, 2, "v=")) {
      return this.fail(PG_ERR_SCRAM)
    }
    const signature: u8[] | null = base64Decode(String.fromBytes(b, body + 2, end))
    if (signature === null || signature.length !== 32) {
      return this.fail(PG_ERR_SCRAM)
    }
    if (!timingSafeEqual(signature, this.serverSignature)) {
      return this.fail(PG_ERR_SERVER_SIGNATURE)
    }
    this.serverSignature = []
    return PG_NEED_MORE
  }

  // --- Writing -----------------------------------------------------------------

  /** Makes the output buffer at least `want` bytes long. */
  private reserve(want: i32): void {
    const size: i32 = toI32(this.out.length)
    if (want <= size) {
      return
    }
    const grown: u8[] = new Array<u8>(want < 2 * size ? 2 * size : want)
    grown.set(this.out, 0)
    this.out = grown
  }

  private putByte(v: i32): void {
    this.reserve(this.outEnd + 1)
    this.out[this.outEnd] = toU8(v)
    this.outEnd += 1
  }

  private putI32(v: i32): void {
    this.reserve(this.outEnd + 4)
    setI32BE(this.out, this.outEnd, v)
    this.outEnd += 4
  }

  private putI16(v: i32): void {
    this.reserve(this.outEnd + 2)
    setU16BE(this.out, this.outEnd, toU16(v))
    this.outEnd += 2
  }

  private putString(text: string): void {
    const n: i32 = toI32(text.length)
    this.reserve(this.outEnd + n)
    for (let i: i32 = 0; i < n; i++) {
      this.out[this.outEnd + i] = toU8(text.charCodeAt(i))
    }
    this.outEnd += n
  }

  private putCString(text: string): void {
    this.putString(text)
    this.putByte(PG_ZERO)
  }

  private putParam(name: string, value: string): void {
    this.putCString(name)
    this.putCString(value)
  }

  /** Starts a message of `type`; answers where, for `endMessage`. */
  private startMessage(type: i32): i32 {
    const at: i32 = this.outEnd
    this.putByte(type)
    this.putI32(PG_ZERO)
    return at
  }

  /** Writes the length of the message started at `at`. */
  private endMessage(at: i32): void {
    setI32BE(this.out, at + 1, this.outEnd - at - 1)
  }

  /** Whether another group may start, or the open one take another message. */
  canSend(): boolean {
    return this.state === PG_STATE_READY && (this.groupOpen || this.inFlight < this.config.maxInFlight)
  }

  /** Opens a group if none is; false when none may be. */
  private openGroup(): boolean {
    if (!this.canSend() || this.bindAt >= 0) {
      return false
    }
    if (!this.groupOpen) {
      this.groupOpen = true
      this.inFlight += 1
    }
    return true
  }

  /**
   * Parse and Describe: prepares `sql` as the statement `name` ("" is the
   * unnamed one), its parameters' types given by `paramTypes` (OIDs, 0 to let
   * the server infer one, and parameters past the array are inferred too).
   * The server answers `PG_DESCRIBED`. False, and nothing written, when
   * `canSend()` is false, a bind is open, or `name` or `sql` holds a NUL.
   */
  prepare(name: string, sql: string, paramTypes: i32[]): boolean {
    if (pgHasNul(name) || pgHasNul(sql) || toI32(paramTypes.length) > 65535 || !this.openGroup()) {
      return false
    }
    const at: i32 = this.startMessage(PG_FE_PARSE)
    this.putCString(name)
    this.putCString(sql)
    this.putI16(toI32(paramTypes.length))
    for (const oid of paramTypes) {
      this.putI32(oid)
    }
    this.endMessage(at)
    const describe: i32 = this.startMessage(PG_FE_DESCRIBE)
    this.putByte(PG_TARGET_STATEMENT)
    this.putCString(name)
    this.endMessage(describe)
    return true
  }

  /** Close: forgets the prepared statement `name`. False as `prepare` is. */
  closeStatement(name: string): boolean {
    if (pgHasNul(name) || !this.openGroup()) {
      return false
    }
    const at: i32 = this.startMessage(PG_FE_CLOSE)
    this.putByte(PG_TARGET_STATEMENT)
    this.putCString(name)
    this.endMessage(at)
    return true
  }

  /**
   * Starts a Bind of the prepared statement `name`; its parameters follow, in
   * order, then `bindEnd()`. False as `prepare` is.
   */
  bindStart(name: string): boolean {
    if (pgHasNul(name) || !this.openGroup()) {
      return false
    }
    this.bindAt = this.startMessage(PG_FE_BIND)
    this.putByte(PG_ZERO)
    this.putCString(name)
    this.putI16(PG_ZERO)
    this.paramCountAt = this.outEnd
    this.putI16(PG_ZERO)
    this.paramCount = 0
    return true
  }

  /** Opens a parameter: its length is written by `endParam`. */
  private startParam(): i32 {
    if (this.bindAt < 0 || this.paramCount === 65535) {
      panic("nish/net/postgres: a parameter outside bindStart()/bindEnd(), or more than 65535")
    }
    this.paramCount += 1
    const at: i32 = this.outEnd
    this.putI32(PG_ZERO)
    return at
  }

  private endParam(at: i32): void {
    setI32BE(this.out, at, this.outEnd - at - 4)
  }

  /** A text parameter. */
  paramText(value: string): void {
    const at: i32 = this.startParam()
    this.putString(value)
    this.endParam(at)
  }

  /** A text parameter from `bytes[start, start + length)`, UTF-8. */
  paramBytes(bytes: u8[], start: i32, length: i32): void {
    const at: i32 = this.startParam()
    this.reserve(this.outEnd + length)
    for (let i: i32 = 0; i < length; i++) {
      this.out[this.outEnd + i] = bytes[start + i]
    }
    this.outEnd += length
    this.endParam(at)
  }

  /** A NULL parameter. */
  paramNull(): void {
    this.startParam()
    setI32BE(this.out, this.outEnd - 4, -1)
  }

  /** An integer parameter, in decimal. */
  paramInt(value: i64): void {
    const at: i32 = this.startParam()
    this.reserve(this.outEnd + 20)
    // The digits are written from the least significant, then reversed; the
    // value is made negative first so that the most negative i64 has its digits.
    let v: i64 = value < 0 ? value : -value
    if (value < 0) {
      this.out[this.outEnd] = toU8(45)
      this.outEnd += 1
    }
    const first: i32 = this.outEnd
    while (true) {
      this.out[this.outEnd] = toU8(48 - toI32(v % 10))
      this.outEnd += 1
      v = v / 10
      if (v === 0) {
        break
      }
    }
    let lo: i32 = first
    let hi: i32 = this.outEnd - 1
    while (lo < hi) {
      const t: u8 = this.out[lo]
      this.out[lo] = this.out[hi]
      this.out[hi] = t
      lo++
      hi--
    }
    this.endParam(at)
  }

  /** A `text[]` parameter: every element quoted, `"` and `\` escaped. */
  paramTextArray(items: string[]): void {
    const at: i32 = this.startParam()
    this.putByte(PG_LBRACE)
    let first: boolean = true
    for (const item of items) {
      if (!first) {
        this.putByte(PG_COMMA)
      }
      first = false
      this.putByte(PG_QUOTE)
      const n: i32 = toI32(item.length)
      for (let i: i32 = 0; i < n; i++) {
        const c: i32 = toI32(item.charCodeAt(i))
        if (c === 34 || c === 92) {
          this.putByte(PG_BACKSLASH)
        }
        this.putByte(c)
      }
      this.putByte(PG_QUOTE)
    }
    this.putByte(PG_RBRACE)
    this.endParam(at)
  }

  /** Ends the Bind (every result column in text) and queues its Execute, for every row. */
  bindEnd(): void {
    const at: i32 = this.bindAt
    if (at < 0) {
      panic("nish/net/postgres: bindEnd() without bindStart()")
    }
    setU16BE(this.out, this.paramCountAt, toU16(this.paramCount))
    this.putI16(PG_ZERO)
    this.endMessage(at)
    this.bindAt = -1
    const execute: i32 = this.startMessage(PG_FE_EXECUTE)
    this.putByte(PG_ZERO)
    this.putI32(PG_ZERO)
    this.endMessage(execute)
  }

  /** Sync: ends the open group, which the server answers with `PG_GROUP_DONE`. False when no group is open or a bind is. */
  sync(): boolean {
    if (!this.groupOpen || this.bindAt >= 0) {
      return false
    }
    this.groupOpen = false
    const at: i32 = this.startMessage(PG_FE_SYNC)
    this.endMessage(at)
    return true
  }

  /** Terminate: tells the server the connection is ending; close the socket once it is sent. */
  terminate(): void {
    const at: i32 = this.startMessage(PG_FE_TERMINATE)
    this.endMessage(at)
  }

  // --- Results -----------------------------------------------------------------

  /** Column `c`'s first byte in `inputBuffer()`. */
  colStart(c: i32): i32 {
    return this.colStarts[c]
  }

  /** Column `c`'s length, -1 for NULL. */
  colLength(c: i32): i32 {
    return this.colLengths[c]
  }

  /** Whether column `c` is NULL. */
  isNull(c: i32): boolean {
    return this.colLengths[c] < 0
  }

  /** Column `c` as a string; the one result read that allocates. "" for NULL. */
  columnText(c: i32): string {
    const length: i32 = this.colLengths[c]
    if (length <= 0) {
      return ""
    }
    const start: i32 = this.colStarts[c]
    return String.fromBytes(this.input, start, start + length)
  }

  /** Column `c` of the statement just described: its type's OID (23 is `int4`, 25 `text`). */
  columnType(c: i32): i32 {
    return this.colTypes[c]
  }

  /** Column `c` as an integer; NULL or a bad value sets `text.failed`. */
  int(c: i32): i64 {
    return this.text.int(this.input, this.colStarts[c], this.colLengths[c])
  }

  /** Column `c` as a boolean; NULL or a bad value sets `text.failed`. */
  bool(c: i32): boolean {
    return this.text.bool(this.input, this.colStarts[c], this.colLengths[c])
  }

  /** Whether the tag of the execution just completed starts with the word `word` (`INSERT`, `SELECT`, ...). */
  tagIs(word: string): boolean {
    const n: i32 = toI32(word.length)
    if (n > this.tagLength || !pgBytesAre(this.input, this.tagStart, n, word)) {
      return false
    }
    return n === this.tagLength || toI32(this.input[this.tagStart + n]) === 32
  }

  /** The row count the tag ends with (`INSERT 0 3` is 3, `SELECT 5` is 5), or -1 when it has none. */
  tagRows(): i64 {
    const end: i32 = this.tagStart + this.tagLength
    let p: i32 = end
    while (p > this.tagStart && toI32(this.input[p - 1]) >= 48 && toI32(this.input[p - 1]) <= 57) {
      p--
    }
    if (p === end || p === this.tagStart || toI32(this.input[p - 1]) !== 32) {
      return -1
    }
    const rows: i64 = this.text.int(this.input, p, end - p)
    return rows
  }
}
