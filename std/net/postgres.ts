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
 * reason when it gave one. `PG_NEED_MORE` asks for more input.
 *
 * **Windows and buffers.** A column's window, the tag `tagIs` and `tagRows`
 * read are valid until the next `next()`,
 * which may move the unread input to the start of the buffer or replace the
 * buffer with a larger one. Fetch `inputBuffer()` again after every `next()`
 * rather than keep it; the same holds for `outputBuffer()` after a builder
 * call.
 *
 * **Groups and pipelining.** Every statement is sent with the extended query
 * protocol: `prepare` (Parse and Describe), `bindStart`, the `param...` calls
 * and `bindEnd` (Bind and Execute), `closeStatement` (Close), then `sync()`,
 * which ends the group. The server answers groups in order and skips the rest
 * of a group after an error, so one failed statement costs only its own group.
 * In a failed group, `PG_DESCRIBED` comes once for each `prepare` the server
 * parsed before the error: a program that counts them knows which statements
 * exist (named ones last past the group) and which must be prepared again.
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
 * allocates, a string. An array parameter is a text array literal too:
 * `paramIntArray` writes an `int8[]` from an `i64[]` window, and `arrayStart`,
 * `arrayElement`, `arrayInt`, `arrayNull` and `arrayEnd` build an array one
 * element at a time into the Bind, so a list needs no string built first. A
 * program whose element was refused for room can drop the whole bind,
 * unsent, with `bindCancel`.
 *
 * **Authentication.** SCRAM-SHA-256 (RFC 5802, RFC 7677) or none (`trust`).
 * The password arrives as a `Secret<u8[]>`; the connection keeps a copy in a
 * holder that is wiped as soon as the proof is computed, or when the
 * connection fails or is disposed. The server's signature is checked in
 * constant time before `AuthenticationOk` is believed, and an
 * `AuthenticationOk` that skips the end of an exchange SCRAM began is refused.
 * Cleartext and MD5 passwords, and SASL mechanisms other than SCRAM-SHA-256,
 * are refused: with no TLS here the first sends the password as it is, and the
 * second is a hash any eavesdropper can replay. The password's bytes are used
 * as they are, without SASLprep (RFC 4013): an ASCII password works, and a
 * non-ASCII one works only when it is already in the form SASLprep would give
 * (PostgreSQL itself falls back to the raw bytes when it cannot prepare one).
 * `docs/security/postgres.md` is the record.
 *
 * **Caps.** `PgConfig` bounds what a server can make the client hold: the
 * longest message (`maxMessage`), the widest row (`maxColumns`) and the SCRAM
 * iteration count (`minIterations`, `maxIterations`); and what a program can
 * queue unsent (`maxOutput`), past which a builder call answers false. A
 * message longer than the cap, a length below 4, a layout that does not add
 * up, a message the protocol does not allow at that point (COPY among them),
 * an encoding other than UTF-8, and a `DateStyle` other than ISO or a
 * `TimeZone` other than UTC (at startup or after a `SET`), each fail the
 * connection with their own `failure` code. The constructor panics on a cap
 * out of range, as on a missing user or a short nonce.
 *
 * **Pools.** `PgPool` holds up to `size` connections to one server and a FIFO
 * queue of up to `queueSize` requests, still sans-IO: `wanted()` names a slot
 * that needs a socket, `connect(slot, nonce)` starts its connection, and the
 * program moves its bytes as above through `connection(slot)`. A request is a
 * ticket from `request()`; `dispatch()` gives the oldest to the ready
 * connection with the fewest groups in flight, the program builds its group and
 * ends it with `send()`, and `next(slot)` reads that connection's events with
 * `ticket` naming the request. Statements given to `register` are prepared on
 * each connection ahead of its first request. A connection that fails reports
 * `PG_LOST` for each request it took, then `PG_FAILED`; the program closes the
 * socket and the slot is built again on its next use. `tests/postgres/carrier.ts`
 * is a whole carrier: one `pollWait` loop holding the pool's sockets beside an
 * HTTP listener.
 *
 * **Batching.** `PgBatcher` turns many reads of one row shape by key — a user
 * by id, an article by slug — into one execution of a statement over
 * `unnest($1) with ordinality`. `addInt` or `addText` queues a request's key
 * and tag; `take(conn)` binds the oldest waiting, each distinct key once, up
 * to `maxRequests` and `maxBytes`, and answers a run; `row`, `end` and `fail`
 * take that execution's events, routing each row by its ordinal (checked
 * first: a server's ordinal is refused before it routes anything), and
 * `next(run)` answers `PG_BATCH_ROW`, then `PG_BATCH_DONE`, `PG_BATCH_MISSING`
 * or `PG_BATCH_FAILED`, for each request. It reads no clock and allocates
 * only in its constructor; when to take is the program's.
 *
 * Written from PostgreSQL's "Frontend/Backend Protocol" chapter (version 18)
 * and RFC 5802 and RFC 7677; not ported from another implementation.
 */
import { copyBytes, getI32BE, getU16BE, setI32BE, setU16BE } from "nish/bytes"
import { base64StdPadDecode, base64StdPadEncode } from "nish/crypto/base64url"
import { timingSafeEqual } from "nish/crypto/ct"
import { hmacSha256, pbkdf2HmacSha256 } from "nish/crypto/hmac"
import { Sha256 } from "nish/crypto/sha256"
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
/** The server's `DateStyle` is not ISO or its `TimeZone` is not UTC, the two the decoders read: at startup, or after a `SET`. */
export const PG_ERR_SETTING: i32 = 10

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
// What a bind's end (Bind's result formats, then Execute: 2 + 10) and a Sync (5)
// take: kept free under `maxOutput` by every other builder call, so that
// `bindEnd()` and `sync()` are never refused for room.
const PG_TAIL: i32 = 17
// The largest `maxMessage` and `maxOutput`. The input buffer doubles up to one
// past them; the output buffer doubles only while twice its size fits in an i32.
const PG_MAX_CAP: i32 = 1073741823
// The largest `maxIterations`: the count is read digit by digit, times ten, in an i32.
const PG_MAX_ITERATIONS: i32 = 214748363

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
  /**
   * The most bytes the builder calls may queue unsent; a call that would pass
   * it answers false and writes nothing, so a program that never drains its
   * output cannot grow the buffer without bound.
   */
  maxOutput: i32 = 1048576
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

/** Whether every byte of `bytes` is zero. */
const pgAllZero = (bytes: u8[]): boolean => {
  for (const b of bytes) {
    if (toI32(b) !== 0) {
      return false
    }
  }
  return true
}

/**
 * The connection's copy of the password, wiped once the proof is computed.
 * The holder outlives the wipe, so that `wiped()` reads the very bytes.
 */
class PgPassword {
  readonly bytes: Secret<u8[]>
  /** Whether `wipe()` has run; the bytes are no longer a password. */
  gone: boolean = false

  constructor(password: Secret<u8[]>) {
    this.bytes = secret(expose(password, pgCopyBytes))
  }

  wipe(): void {
    wipe(this.bytes)
    this.gone = true
  }

  wiped(): boolean {
    return expose(this.bytes, pgAllZero)
  }
}

/** Panics on a `PgConfig` that is a mistake in the program: no user, a cap out of range, a NUL in a startup parameter. */
const pgCheckConfig = (config: PgConfig): void => {
  if (config.user.length === 0) {
    panic("nish/net/postgres: PgConfig.user is required")
  }
  if (
    config.maxMessage < 1024 ||
    config.maxMessage > PG_MAX_CAP ||
    config.maxOutput < 1024 ||
    config.maxOutput > PG_MAX_CAP ||
    config.maxInFlight < 1 ||
    config.maxColumns < 1 ||
    config.maxColumns > 65535 ||
    config.minIterations < 1 ||
    config.maxIterations < config.minIterations ||
    config.maxIterations > PG_MAX_ITERATIONS
  ) {
    panic("nish/net/postgres: a PgConfig cap out of range")
  }
  if (
    pgHasNul(config.user) ||
    pgHasNul(config.database) ||
    pgHasNul(config.applicationName) ||
    pgHasNul(config.options)
  ) {
    panic("nish/net/postgres: a startup parameter holds a NUL byte")
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

/** How many bytes `value` takes in decimal, its sign included. */
const pgDecimalLength = (value: i64): i32 => {
  let n: i32 = value < 0 ? 2 : 1
  let v: i64 = value < 0 ? value : -value
  while (v <= -10) {
    v = v / 10
    n += 1
  }
  return n
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
 * The caller has bounded `iterations` by `maxIterations`, since the time is
 * linear in it.
 */
const pgSaltedPassword = (password: Secret<u8[]>, salt: u8[], iterations: i32): Secret<u8[]> | null =>
  pbkdf2HmacSha256(password, salt, iterations, 32)

/**
 * SHA-256 of `data` through a hasher of its own, whose state, block and
 * schedule are wiped before it returns: the one-shot `sha256` leaves the last
 * block of its input in a hasher nothing wipes, and here the input is
 * ClientKey.
 */
const pgSha256Wiped = (data: u8[]): u8[] => {
  const h = new Sha256()
  h.update(data, toI32(0), toI32(data.length))
  const digest: u8[] = h.digest()
  wipe(h.state)
  wipe(h.block)
  wipe(h.schedule)
  h.fill = 0
  h.total = 0
  h.finished = true
  return digest
}

/**
 * RFC 5802 §3 from the salted password and the AuthMessage: the ClientProof
 * (32 bytes) followed by the ServerSignature (32 bytes). Every key in between
 * is wiped before it returns.
 */
const pgScramKeys = (salted: u8[], authMessage: u8[]): u8[] => {
  const clientKey: u8[] = hmacSha256(salted, pgBytesOf("Client Key"))
  const storedKey: u8[] = pgSha256Wiped(clientKey)
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
    // The fixed part: YYYY-MM-DD HH:MM:SS. Its five separators are where they
    // belong and are not digits, so the other fourteen bytes are digits
    // exactly when the part holds five non-digits.
    let p: i32 = start + 19
    const end: i32 = start + length
    if (p < 0 || end > toI32(b.length)) {
      this.failed = true
      return -1
    }
    let others: i32 = 0
    for (let i: i32 = start; i < p && i < toI32(b.length); i++) {
      const c: i32 = toI32(b[i])
      if (c < 48 || c > 57) {
        others++
      }
    }
    if (
      others !== 5 ||
      toI32(b[start + 4]) !== 45 ||
      toI32(b[start + 7]) !== 45 ||
      toI32(b[start + 10]) !== 32 ||
      toI32(b[start + 13]) !== 58 ||
      toI32(b[start + 16]) !== 58
    ) {
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
    // The year's four bytes are digits, so their OR is '0' exactly when the year is 0000.
    const year: i32 = toI32(b[start]) | toI32(b[start + 1]) | toI32(b[start + 2]) | toI32(b[start + 3])
    if (p !== end || year === 48) {
      this.failed = true
      return -1
    }
    copyBytes(out, at, b, start, 19)
    out[at + 10] = toU8(84)
    out[at + 19] = toU8(46)
    out[at + 20] = toU8(millis / 100 + 48)
    out[at + 21] = toU8(((millis / 10) % 10) + 48)
    out[at + 22] = toU8((millis % 10) + 48)
    out[at + 23] = toU8(90)
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
  /** The number of notices received, stopping at 2^31 - 1. */
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
  private readonly password: PgPassword
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
  // Whether the open bind opened its group, which `bindCancel` closes again.
  private bindOpened: boolean = false
  private bindAt: i32 = -1
  private paramCountAt: i32 = 0
  private paramCount: i32 = 0
  // The open array parameter's length word, -1 when none is open, and its elements so far.
  private arrayAt: i32 = -1
  private arrayCount: i32 = 0
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
    pgCheckConfig(config)
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
    this.clientNonce = base64StdPadEncode(head)

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
    if (start < 0 || length < 0 || length > toI32(src.length) - start) {
      panic("nish/net/postgres: receive() outside its source")
    }
    const room: i32 = this.inputRoom()
    const n: i32 = length < room ? length : room
    copyBytes(this.input, this.inEnd, src, start, n)
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

  /** One past the last byte that may be sent: a Bind still open is held back until `bindEnd()` has written its lengths. */
  outputEnd(): i32 {
    return this.bindAt >= 0 ? this.bindAt : this.outEnd
  }

  /** Records that `n` bytes from `outputStart()` were written to the socket. */
  sent(n: i32): void {
    if (n < 0 || n > this.outputEnd() - this.outStart) {
      panic("nish/net/postgres: sent more than was queued")
    }
    this.outStart += n
    if (this.outStart === this.outEnd) {
      this.outStart = 0
      this.outEnd = 0
    } else if (this.outStart >= toI32(this.out.length) / 2) {
      this.compactOutput()
    }
  }

  /** Reports the end of the stream: unless it already has, the connection fails with `PG_ERR_CLOSED`. */
  closed(): i32 {
    if (this.state !== PG_STATE_FAILED) {
      return this.fail(PG_ERR_CLOSED)
    }
    return PG_FAILED
  }

  /**
   * Whether every byte of the connection's copy of the password is zero: true
   * once the proof is computed, the connection has failed or `dispose()` has
   * run (and for an empty password). It reads the copy itself, so a test can
   * see the wipe happen; a program has no use for it.
   */
  passwordWiped(): boolean {
    return this.password.wiped()
  }

  /** Wipes the password if the connection still holds it. A program that drops a connection before it is ready calls this. */
  dispose(): void {
    if (!this.password.gone) {
      this.password.wipe()
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
      const b: u8[] = this.input
      // inStart and inEnd stay within the buffer, so this test never fails; it proves the indices.
      if (at < 0 || at + 4 >= toI32(b.length)) {
        return this.fail(PG_ERR_FRAME)
      }
      const type: i32 = toI32(b[at])
      // getI32BE written out, as in readRow: this runs once per message.
      const length: i32 =
        (toI32(b[at + 1]) << 24) | (toI32(b[at + 2]) << 16) | (toI32(b[at + 3]) << 8) | toI32(b[at + 4])
      if (length < 4) {
        return this.fail(PG_ERR_FRAME)
      }
      if (length > this.config.maxMessage) {
        return this.fail(PG_ERR_TOO_BIG)
      }
      if (avail - 1 < length) {
        this.compact()
        const size: i32 = toI32(this.input.length)
        if (size < length + 1) {
          // Doubled, up to one message of maxMessage, so that a run of growing messages copies each byte a bounded number of times.
          const cap: i32 = this.config.maxMessage + 1
          const doubled: i32 = size < cap / 2 ? size * 2 : cap
          const grown: u8[] = new Array<u8>(doubled > length + 1 ? doubled : length + 1)
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
    copyBytes(this.input, 0, this.input, start, n)
    this.inStart = 0
    this.inEnd = n
  }

  /** Fails the connection: the password is wiped and every later `next()` answers `PG_FAILED`. */
  private fail(code: i32): i32 {
    this.state = PG_STATE_FAILED
    this.failure = code
    this.dispose()
    wipe(this.serverSignature)
    this.serverSignature = []
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
        if (this.notices < 2147483647) {
          this.notices += 1
        }
        this.lastNotice = error
        return PG_NOTICE
      }
      this.lastError = error
      if (state < PG_STATE_READY || error.severity === "FATAL" || error.severity === "PANIC") {
        return this.fail(PG_ERR_SERVER)
      }
      if (this.inFlight === 0) {
        return this.fail(PG_ERR_UNEXPECTED)
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
      } else if (pgBytesAre(this.input, body, nameEnd - body, "DateStyle")) {
        // "ISO, MDY": the output style comes first, the input order after the comma.
        const valueLength: i32 = end - 2 - nameEnd
        const iso: boolean = valueLength >= 3 && pgBytesAre(this.input, nameEnd + 1, 3, "ISO")
        if (!iso || (valueLength > 3 && toI32(this.input[nameEnd + 4]) !== PG_COMMA)) {
          return this.fail(PG_ERR_SETTING)
        }
      } else if (pgBytesAre(this.input, body, nameEnd - body, "TimeZone")) {
        if (!pgBytesAre(this.input, nameEnd + 1, end - 2 - nameEnd, "UTC")) {
          return this.fail(PG_ERR_SETTING)
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
    const starts: i32[] = this.colStarts
    const lengths: i32[] = this.colLengths
    let p: i32 = body + 2
    // reserveColumns made both arrays hold n; the length tests prove the indices.
    for (let c: i32 = 0; c < n && c < toI32(starts.length) && c < toI32(lengths.length); c++) {
      // The buffer tests never fail on a frame next() cut from it; they prove the indices.
      if (end - p < 4 || p < 0 || p + 3 >= toI32(b.length)) {
        return this.fail(PG_ERR_FRAME)
      }
      // getI32BE written out: a call per column was a fifth of the row's cost.
      const length: i32 =
        (toI32(b[p]) << 24) | (toI32(b[p + 1]) << 16) | (toI32(b[p + 2]) << 8) | toI32(b[p + 3])
      p += 4
      if (length < -1 || length > end - p) {
        return this.fail(PG_ERR_FRAME)
      }
      starts[c] = p
      lengths[c] = length
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
    const salt: u8[] | null = base64StdPadDecode(String.fromBytes(b, nonceEnd + 3, saltEnd))
    if (salt === null || salt.length === 0) {
      return this.fail(PG_ERR_SCRAM)
    }
    const password: PgPassword = this.password
    if (password.gone) {
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
    wipe(keys)
    this.serverSignature = signature
    // The proof goes on the wire as it is, so its base64 string is no secret.
    const encoded: string = base64StdPadEncode(proof)
    wipe(proof)
    const at: i32 = this.startMessage(PG_FE_PASSWORD)
    this.putString(`${withoutProof},p=${encoded}`)
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
    const signature: u8[] | null = base64StdPadDecode(String.fromBytes(b, body + 2, end))
    if (signature === null || signature.length !== 32) {
      return this.fail(PG_ERR_SCRAM)
    }
    if (!timingSafeEqual(signature, this.serverSignature)) {
      return this.fail(PG_ERR_SERVER_SIGNATURE)
    }
    wipe(this.serverSignature)
    this.serverSignature = []
    return PG_NEED_MORE
  }

  // --- Writing -----------------------------------------------------------------

  /**
   * Whether a builder call may queue `size` more bytes and still leave
   * `PG_TAIL` under `maxOutput`. When they would not fit after the end of the
   * buffer, the unsent bytes move to its start first: a builder call asks
   * before it takes any offset into the buffer, so nothing it holds moves.
   */
  private room(size: i32): boolean {
    const queued: i32 = this.outEnd - this.outStart
    if (size < 0 || size > this.config.maxOutput - PG_TAIL - queued) {
      return false
    }
    if (this.outStart > 0 && this.outEnd + size > toI32(this.out.length)) {
      this.compactOutput()
    }
    return true
  }

  /**
   * Makes room for the `size` bytes of a tail message (`bindEnd`, `sync`,
   * `terminate`) the way `room` does for the rest, so that the buffer is not
   * grown past `maxOutput` while sent bytes still fill its start.
   */
  private tailRoom(size: i32): void {
    if (this.outStart > 0 && this.outEnd + size > toI32(this.out.length)) {
      this.compactOutput()
    }
  }

  /** Moves the unsent output to the start of the buffer, the open bind's offsets with it. */
  private compactOutput(): void {
    const shift: i32 = this.outStart
    if (shift === 0) {
      return
    }
    copyBytes(this.out, 0, this.out, shift, this.outEnd - shift)
    this.outEnd -= shift
    this.outStart = 0
    if (this.bindAt >= 0) {
      this.bindAt -= shift
      this.paramCountAt -= shift
    }
    if (this.arrayAt >= 0) {
      this.arrayAt -= shift
    }
  }

  /** Makes the output buffer at least `want` bytes long. */
  private reserve(want: i32): void {
    const size: i32 = toI32(this.out.length)
    if (want <= size) {
      return
    }
    const grown: u8[] = new Array<u8>(size <= PG_MAX_CAP && want < 2 * size ? 2 * size : want)
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

  /** Opens a group if none is, for a message of `size` bytes; false, and no group opened, when none may be or there is no room. */
  private canOpen(size: i32): boolean {
    if (!this.canSend() || this.bindAt >= 0 || !this.room(size)) {
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
   * `canSend()` is false, a bind is open, `name` or `sql` holds a NUL, or the
   * message would pass `maxOutput`.
   */
  prepare(name: string, sql: string, paramTypes: i32[]): boolean {
    const nameLength: i32 = toI32(name.length)
    const types: i32 = toI32(paramTypes.length)
    if (pgHasNul(name) || pgHasNul(sql) || types > 65535 || nameLength > PG_MAX_CAP / 4) {
      return false
    }
    const sqlLength: i32 = toI32(sql.length)
    if (sqlLength > PG_MAX_CAP || !this.canOpen(toI32(16) + 2 * nameLength + sqlLength + 4 * types)) {
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
    if (pgHasNul(name) || toI32(name.length) > PG_MAX_CAP || !this.canOpen(7 + toI32(name.length))) {
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
    const opens: boolean = !this.groupOpen
    if (pgHasNul(name) || toI32(name.length) > PG_MAX_CAP || !this.canOpen(11 + toI32(name.length))) {
      return false
    }
    this.bindOpened = opens
    this.bindAt = this.startMessage(PG_FE_BIND)
    this.putByte(PG_ZERO)
    this.putCString(name)
    this.putI16(PG_ZERO)
    this.paramCountAt = this.outEnd
    this.putI16(PG_ZERO)
    this.paramCount = 0
    return true
  }

  /**
   * Opens a parameter of `size` bytes, its length word aside, and answers
   * where its length goes; -1, and nothing written, when no bind is open, the
   * bind has 65535 parameters already, or there is no room under `maxOutput`.
   */
  private startParam(size: i32): i32 {
    this.noArrayOpen()
    if (this.bindAt < 0 || this.paramCount === 65535 || size > PG_MAX_CAP || !this.room(4 + size)) {
      return -1
    }
    this.paramCount += 1
    const at: i32 = this.outEnd
    this.putI32(PG_ZERO)
    return at
  }

  private endParam(at: i32): void {
    setI32BE(this.out, at, this.outEnd - at - 4)
  }

  private noArrayOpen(): void {
    if (this.arrayAt >= 0) {
      panic("nish/net/postgres: a parameter while an array is open")
    }
  }

  // Every `param...` call answers false, and writes nothing, when no bind is
  // open, the bind has 65535 parameters already, or the parameter would pass
  // `maxOutput`; a program that checked `bindStart()` meets only the last.

  /** A text parameter. */
  paramText(value: string): boolean {
    const at: i32 = this.startParam(toI32(value.length))
    if (at < 0) {
      return false
    }
    this.putString(value)
    this.endParam(at)
    return true
  }

  /** A text parameter from `bytes[start, start + length)`, UTF-8; false too when the window is not inside `bytes`. */
  paramBytes(bytes: u8[], start: i32, length: i32): boolean {
    this.noArrayOpen()
    if (start < 0 || length < 0 || length > toI32(bytes.length) - start) {
      return false
    }
    const at: i32 = this.startParam(length)
    if (at < 0) {
      return false
    }
    this.reserve(this.outEnd + length)
    copyBytes(this.out, this.outEnd, bytes, start, length)
    this.outEnd += length
    this.endParam(at)
    return true
  }

  /** A NULL parameter. */
  paramNull(): boolean {
    if (this.startParam(toI32(0)) < 0) {
      return false
    }
    setI32BE(this.out, this.outEnd - 4, -1)
    return true
  }

  /** An integer parameter, in decimal. */
  paramInt(value: i64): boolean {
    const at: i32 = this.startParam(toI32(20))
    if (at < 0) {
      return false
    }
    this.putDecimal(value)
    this.endParam(at)
    return true
  }

  /** `value` in decimal, `pgDecimalLength(value)` bytes. */
  private putDecimal(value: i64): void {
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
  }

  /**
   * An `int8[]` parameter from `values[start, start + count)`, in decimal;
   * panics when the range is not inside `values`.
   */
  paramIntArray(values: i64[], start: i32, count: i32): boolean {
    if (start < 0 || count < 0 || count > toI32(values.length) - start) {
      panic("nish/net/postgres: paramIntArray() outside its array")
    }
    // Each loop is bounded by `values.length` as well as by the window's end,
    // which the guard above keeps inside it: that names the bound the compiler
    // proves `values[i]` against, where the guard alone does not reach it.
    const end: i32 = start + count
    // Its exact size first, so that room is asked for once and a refusal writes nothing.
    let size: i64 = count > 0 ? toI64(count + 1) : toI64(2)
    for (let i: i32 = start; i < end && i < toI32(values.length); i++) {
      size += toI64(pgDecimalLength(values[i]))
    }
    const at: i32 = this.startParam(size > toI64(PG_MAX_CAP) ? PG_MAX_CAP + 1 : toI32(size))
    if (at < 0) {
      return false
    }
    this.putByte(PG_LBRACE)
    for (let i: i32 = start; i < end && i < toI32(values.length); i++) {
      // Read before the comma's call, which could drop the length fact.
      const value: i64 = values[i]
      if (i > start) {
        this.putByte(PG_COMMA)
      }
      this.putDecimal(value)
    }
    this.putByte(PG_RBRACE)
    this.endParam(at)
    return true
  }

  /** A `text[]` parameter: every element quoted, `"` and `\` escaped. */
  paramTextArray(items: string[]): boolean {
    // Its exact size first, so that room is asked for once and a refusal writes nothing.
    let size: i64 = 2
    for (const item of items) {
      size += toI64(item.length) + 3
      const n: i32 = toI32(item.length)
      for (let i: i32 = 0; i < n; i++) {
        const c: i32 = toI32(item.charCodeAt(i))
        if (c === 34 || c === 92) {
          size += 1
        }
      }
    }
    const at: i32 = this.startParam(size > toI64(PG_MAX_CAP) ? PG_MAX_CAP + 1 : toI32(size))
    if (at < 0) {
      return false
    }
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
    return true
  }

  // An array parameter built element by element: `arrayStart()`, then
  // `arrayElement`, `arrayInt` or `arrayNull` for each element, then `arrayEnd()`. An
  // element refused for room writes nothing and leaves the array open, so a
  // program that batches rows ends the array with the elements it has and
  // sends the rest in the next statement. While an array is open, every other
  // `param...` call and `bindEnd()` panic, as do an element or `arrayEnd()`
  // with none open and a second `arrayStart()`; `sync()`, `prepare`,
  // `closeStatement` and `bindStart` answer false, the bind being open.

  /** Opens an array parameter, `{}` so far; false as the `param...` calls are. */
  arrayStart(): boolean {
    if (this.arrayAt >= 0) {
      panic("nish/net/postgres: arrayStart() while an array is open")
    }
    // Room for `{}`: the `}` is owed, and every element keeps room for it.
    const at: i32 = this.startParam(toI32(2))
    if (at < 0) {
      return false
    }
    this.putByte(PG_LBRACE)
    this.arrayAt = at
    this.arrayCount = 0
    return true
  }

  private arrayOpen(): void {
    if (this.arrayAt < 0) {
      panic("nish/net/postgres: an array element with no arrayStart()")
    }
  }

  /** Whether the open array has room for an element of `size` bytes, its comma, and the `}` it owes. */
  private elementRoom(size: i64): boolean {
    const total: i64 = size + toI64(this.arrayCount > 0 ? 2 : 1)
    return total <= toI64(PG_MAX_CAP) && this.room(toI32(total))
  }

  /**
   * A text element from `bytes[start, start + length)`, UTF-8, quoted with
   * `"` and `\` escaped; false, and nothing written, when there is no room.
   * Panics when no array is open or the window is not inside `bytes`.
   */
  arrayElement(bytes: u8[], start: i32, length: i32): boolean {
    this.arrayOpen()
    if (start < 0 || length < 0 || length > toI32(bytes.length) - start) {
      panic("nish/net/postgres: arrayElement() outside its source")
    }
    // Both loops are bounded by `bytes.length` too, as `paramIntArray`'s are.
    const end: i32 = start + length
    let escapes: i32 = 0
    for (let i: i32 = start; i < end && i < toI32(bytes.length); i++) {
      const c: i32 = toI32(bytes[i])
      if (c === PG_QUOTE || c === PG_BACKSLASH) {
        escapes += 1
      }
    }
    if (!this.elementRoom(toI64(length) + toI64(escapes) + 2)) {
      return false
    }
    this.elementComma()
    this.putByte(PG_QUOTE)
    this.reserve(this.outEnd + length + escapes + 1)
    if (escapes === 0) {
      copyBytes(this.out, this.outEnd, bytes, start, length)
      this.outEnd += length
    } else {
      for (let i: i32 = start; i < end && i < toI32(bytes.length); i++) {
        const c: i32 = toI32(bytes[i])
        if (c === PG_QUOTE || c === PG_BACKSLASH) {
          this.putByte(PG_BACKSLASH)
        }
        this.putByte(c)
      }
    }
    this.putByte(PG_QUOTE)
    return true
  }

  /** A NULL element; false, and nothing written, when there is no room. Panics when no array is open. */
  arrayNull(): boolean {
    this.arrayOpen()
    if (!this.elementRoom(toI64(4))) {
      return false
    }
    this.elementComma()
    this.putString("NULL")
    return true
  }

  private elementComma(): void {
    if (this.arrayCount > 0) {
      this.putByte(PG_COMMA)
    }
    this.arrayCount += 1
  }

  /** An integer element, in decimal; false, and nothing written, when there is no room. Panics when no array is open. */
  arrayInt(value: i64): boolean {
    this.arrayOpen()
    if (!this.elementRoom(toI64(pgDecimalLength(value)))) {
      return false
    }
    this.elementComma()
    this.putDecimal(value)
    return true
  }

  /** Ends the open array parameter; never refused for room, which its elements kept. Panics when no array is open. */
  arrayEnd(): void {
    if (this.arrayAt < 0) {
      panic("nish/net/postgres: arrayEnd() with no arrayStart()")
    }
    this.tailRoom(toI32(1))
    this.putByte(PG_RBRACE)
    this.endParam(this.arrayAt)
    this.arrayAt = -1
  }

  /**
   * Ends the Bind (every result column in text) and queues its Execute, for
   * every row. False, and nothing written, when no bind is open; never for
   * room, which the calls before it kept.
   */
  bindEnd(): boolean {
    if (this.bindAt < 0) {
      return false
    }
    if (this.arrayAt >= 0) {
      panic("nish/net/postgres: bindEnd() while an array is open")
    }
    this.tailRoom(PG_TAIL)
    const at: i32 = this.bindAt
    setU16BE(this.out, this.paramCountAt, toU16(this.paramCount))
    this.putI16(PG_ZERO)
    this.endMessage(at)
    this.bindAt = -1
    const execute: i32 = this.startMessage(PG_FE_EXECUTE)
    this.putByte(PG_ZERO)
    this.putI32(PG_ZERO)
    this.endMessage(execute)
    return true
  }

  /**
   * Drops the open bind, and the array open in it, unsent, so that a program
   * whose parameter was refused for room can send the group without it; a
   * group the bind opened is closed again. False when no bind is open.
   */
  bindCancel(): boolean {
    if (this.bindAt < 0) {
      return false
    }
    this.outEnd = this.bindAt
    this.bindAt = -1
    this.arrayAt = -1
    if (this.bindOpened) {
      this.groupOpen = false
      this.inFlight -= 1
    }
    return true
  }

  /** Sync: ends the open group, which the server answers with `PG_GROUP_DONE`. False when no group is open or a bind is; never for room. */
  sync(): boolean {
    if (!this.groupOpen || this.bindAt >= 0) {
      return false
    }
    this.groupOpen = false
    this.tailRoom(toI32(5))
    const at: i32 = this.startMessage(PG_FE_SYNC)
    this.endMessage(at)
    return true
  }

  /** Terminate: tells the server the connection is ending; close the socket once it is sent. A bind still open is dropped unsent. */
  terminate(): void {
    if (this.bindAt >= 0) {
      this.outEnd = this.bindAt
      this.bindAt = -1
      this.arrayAt = -1
    }
    this.tailRoom(toI32(5))
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

  /** The row count the tag ends with (`INSERT 0 3` is 3, `SELECT 5` is 5), or -1 when it has none or it does not fit an i64. */
  tagRows(): i64 {
    const end: i32 = this.tagStart + this.tagLength
    let p: i32 = end
    while (p > this.tagStart && toI32(this.input[p - 1]) >= 48 && toI32(this.input[p - 1]) <= 57) {
      p--
    }
    if (p === end || p === this.tagStart || toI32(this.input[p - 1]) !== 32) {
      return -1
    }
    // Read without touching `text.failed`, which belongs to the program's own decoding.
    const failed: boolean = this.text.failed
    this.text.failed = false
    const rows: i64 = this.text.int(this.input, p, end - p)
    const overflowed: boolean = this.text.failed
    this.text.failed = failed
    return overflowed ? -1 : rows
  }
}

// --- The pool ------------------------------------------------------------------

/** `PgPool.next(slot)`: the request `ticket` names will get no answer, because its connection failed first. */
export const PG_LOST: i32 = 9
/** `PgPool.dispatch()` and `PgPool.wanted()`: no slot. */
export const PG_POOL_NONE: i32 = -1
/** `PgPool.request()`: the queue is full, and the request was not taken. */
export const PG_POOL_FULL: i32 = -2

/** The most slots a pool may have. */
const PG_POOL_MAX_SLOTS: i32 = 1024
/** The longest queue a pool may have. */
const PG_POOL_MAX_QUEUE: i32 = 1048576
/** The most groups a pooled connection may have in flight, which sizes each slot's ring. */
const PG_POOL_MAX_IN_FLIGHT: i32 = 1024
/** The most statements a pool may register. */
const PG_POOL_MAX_STATEMENTS: i32 = 256

/** No connection: one is built the next time a request needs it. */
const PG_SLOT_IDLE: i32 = 0
/** A request needs a connection here: the carrier is to make a socket. */
const PG_SLOT_WANTED: i32 = 1
/** The connection is made and authenticating. */
const PG_SLOT_STARTING: i32 = 2
const PG_SLOT_READY: i32 = 3
/** The connection failed: `next` is reporting the requests it took with it. */
const PG_SLOT_DRAINING: i32 = 4

/** One of a pool's connections, and the groups it has in flight. */
class PgPoolSlot {
  state: i32 = 0
  conn: PgConnection | null = null
  /** How many registered statements this connection has queued, and how many the server has described. */
  queued: i32 = 0
  described: i32 = 0
  /** The groups in flight, oldest first, in a ring: each one's ticket, and how many of the pool's own prepares lead it. */
  readonly tickets: i32[]
  readonly leads: i32[]
  head: i32 = 0
  count: i32 = 0

  constructor(ring: i32) {
    this.tickets = new Array<i32>(ring)
    this.leads = new Array<i32>(ring)
  }

  push(ticket: i32, leads: i32): void {
    const at: i32 = (this.head + this.count) % toI32(this.tickets.length)
    this.tickets[at] = ticket
    this.leads[at] = leads
    this.count += 1
  }

  pop(): void {
    this.head = (this.head + 1) % toI32(this.tickets.length)
    this.count -= 1
  }
}

/**
 * A pool of connections to one server, sans-IO like `PgConnection`: it makes
 * no socket and reads no clock, and says which slot needs a socket and when.
 * Its size is a cap, and no connection is made until a request needs one and
 * no ready connection has room.
 *
 * A request is a ticket from `request()`, queued in FIFO order. `dispatch()`
 * hands the queue's head to the ready connection with the fewest groups in
 * flight, never past `maxInFlight` on one; the program builds the request's
 * group on `connection(slot)` and ends it with `send()`, not `sync()`.
 * `next(slot)` then reads that connection's events, `ticket` naming the
 * request each is about. A connection that fails reports `PG_LOST` for each
 * request it took with it, then `PG_FAILED`, and is built again on its next
 * use. Statements given to `register` are prepared on each connection in the
 * same group as its first request, so a request may bind them at once.
 */
export class PgPool {
  /** The request the last `dispatch()`, or event from `next(slot)`, is about; -1 for none. */
  ticket: i32 = -1
  /** The number of slots, the most connections the pool makes. */
  readonly size: i32

  private readonly config: PgConfig
  private readonly password: PgPassword
  private readonly slots: PgPoolSlot[]
  private readonly queue: i32[]
  private queueHead: i32 = 0
  private queueCount: i32 = 0
  private nextTicket: i32 = 0
  /** The slot whose request is being built, between `dispatch()` and `send()`. */
  private building: i32 = -1
  private started: boolean = false
  private readonly names: string[]
  private readonly sqls: string[]
  private readonly types: i32[][]

  /**
   * A pool of up to `size` connections (1 to 1024) and up to `queueSize`
   * waiting requests (1 to 2^20). `password` is copied and kept until
   * `dispose()`, since a connection is made again after a failure. Panics as
   * `PgConnection` does on `config`, and on a `maxInFlight` over 1024.
   */
  constructor(config: PgConfig, password: Secret<u8[]>, size: i32, queueSize: i32) {
    pgCheckConfig(config)
    if (size < 1 || size > PG_POOL_MAX_SLOTS) {
      panic("nish/net/postgres: a PgPool size out of range")
    }
    if (queueSize < 1 || queueSize > PG_POOL_MAX_QUEUE) {
      panic("nish/net/postgres: a PgPool queueSize out of range")
    }
    if (config.maxInFlight > PG_POOL_MAX_IN_FLIGHT) {
      panic("nish/net/postgres: a PgPool connection's maxInFlight is over 1024")
    }
    this.config = config
    this.password = new PgPassword(password)
    this.size = size
    this.slots = []
    for (let i: i32 = 0; i < size; i++) {
      this.slots.push(new PgPoolSlot(config.maxInFlight))
    }
    this.queue = new Array<i32>(queueSize)
    this.names = []
    this.sqls = []
    this.types = []
  }

  /**
   * Registers a statement for every connection to prepare before its first
   * request. False when a connection has been made already, `name` or `sql`
   * holds a NUL, or 256 are registered.
   */
  register(name: string, sql: string, paramTypes: i32[]): boolean {
    if (
      this.started ||
      pgHasNul(name) ||
      pgHasNul(sql) ||
      toI32(this.names.length) === PG_POOL_MAX_STATEMENTS
    ) {
      return false
    }
    const types: i32[] = []
    for (const oid of paramTypes) {
      types.push(oid)
    }
    this.names.push(name)
    this.sqls.push(sql)
    this.types.push(types)
    return true
  }

  /** Queues a request and answers its ticket, or `PG_POOL_FULL` when `queueSize` are waiting. */
  request(): i32 {
    const room: i32 = toI32(this.queue.length)
    if (this.queueCount === room) {
      return PG_POOL_FULL
    }
    const ticket: i32 = this.nextTicket
    this.nextTicket = ticket === 2147483647 ? 0 : ticket + 1
    this.queue[(this.queueHead + this.queueCount) % room] = ticket
    this.queueCount += 1
    return ticket
  }

  /** The number of requests waiting for a connection. */
  waiting(): i32 {
    return this.queueCount
  }

  /**
   * Hands the oldest waiting request to a ready connection with room, and
   * answers its slot, `ticket` set to the request: build its group on
   * `connection(slot)`, then `send()`. `PG_POOL_NONE` when nothing waits, a
   * request is still being built, or no ready connection has room; then a
   * connection may be wanted (`wanted()`): one more for every `maxInFlight`
   * waiting requests that the connections already starting cannot take. A
   * request handed out is the program's to end with `send()`: until then no
   * other is handed out.
   */
  dispatch(): i32 {
    if (this.building >= 0 || this.queueCount === 0) {
      return PG_POOL_NONE
    }
    const cap: i32 = this.config.maxInFlight
    let best: i32 = -1
    let load: i32 = 0
    let starting: i32 = 0
    let idle: i32 = -1
    for (let s: i32 = 0; s < this.size; s++) {
      const slot: PgPoolSlot = this.slots[s]
      const conn: PgConnection | null = slot.conn
      if (slot.state === PG_SLOT_READY && conn !== null) {
        if (conn.inFlight < cap && (best < 0 || conn.inFlight < load)) {
          best = s
          load = conn.inFlight
        }
      } else if (slot.state === PG_SLOT_WANTED || slot.state === PG_SLOT_STARTING) {
        starting += 1
      } else if (slot.state === PG_SLOT_IDLE && idle < 0) {
        idle = s
      }
    }
    if (best < 0) {
      if (idle >= 0 && toI64(this.queueCount) > toI64(starting) * toI64(cap)) {
        this.slots[idle].state = PG_SLOT_WANTED
      }
      return PG_POOL_NONE
    }
    const ticket: i32 = this.queue[this.queueHead]
    this.queueHead = (this.queueHead + 1) % toI32(this.queue.length)
    this.queueCount -= 1
    const slot: PgPoolSlot = this.slots[best]
    const conn: PgConnection = this.connection(best)
    let leads: i32 = 0
    while (slot.queued < toI32(this.names.length)) {
      const k: i32 = slot.queued
      if (!conn.prepare(this.names[k], this.sqls[k], this.types[k])) {
        break
      }
      slot.queued += 1
      leads += 1
    }
    slot.push(ticket, leads)
    this.building = best
    this.ticket = ticket
    return best
  }

  /**
   * Ends the group of the request `dispatch()` handed out. False when there
   * is none; when a bind is still open, so finish it and call again; and
   * when no message of the group was written, so the request is dropped and
   * gets no events (`PG_LOST` if its connection has failed).
   */
  send(): boolean {
    const s: i32 = this.building
    if (s < 0) {
      return false
    }
    const slot: PgPoolSlot = this.slots[s]
    const conn: PgConnection = this.connection(s)
    if (conn.sync()) {
      this.building = -1
      return true
    }
    if (conn.inFlight < slot.count) {
      // No message opened the group. A failed connection reports the request
      // lost with the rest; a live one would never answer it, so it is dropped.
      if (conn.failure === PG_ERR_NONE) {
        slot.count -= 1
      }
      this.building = -1
    }
    return false
  }

  /** A slot that needs a socket, or `PG_POOL_NONE`: connect it, then call `connect(slot, nonce)`. */
  wanted(): i32 {
    for (let s: i32 = 0; s < this.size; s++) {
      if (this.slots[s].state === PG_SLOT_WANTED) {
        return s
      }
    }
    return PG_POOL_NONE
  }

  /**
   * Makes the wanted `slot`'s connection, `nonce` as `PgConnection` takes it:
   * send its output once the socket is connected, and if the socket fails,
   * call `connection(slot).closed()`. Panics when `slot` is not wanted or the
   * pool is disposed.
   */
  connect(slot: i32, nonce: u8[]): void {
    if (slot < 0 || slot >= this.size || this.slots[slot].state !== PG_SLOT_WANTED) {
      panic("nish/net/postgres: PgPool.connect on a slot that wants no connection")
    }
    if (this.password.gone) {
      panic("nish/net/postgres: PgPool.connect after dispose")
    }
    const s: PgPoolSlot = this.slots[slot]
    s.conn = new PgConnection(this.config, this.password.bytes, nonce)
    s.state = PG_SLOT_STARTING
    s.queued = 0
    s.described = 0
    s.head = 0
    s.count = 0
    this.started = true
  }

  /** The connection in `slot`, its buffers the carrier's to fill and drain; the last one made after it fails. Panics when none was made. */
  connection(slot: i32): PgConnection {
    const conn: PgConnection | null = slot < 0 || slot >= this.size ? null : this.slots[slot].conn
    if (conn === null) {
      panic("nish/net/postgres: PgPool.connection on a slot with no connection")
    }
    return conn
  }

  /**
   * The next event from `slot`'s input, as `PgConnection.next()` answers it,
   * `ticket` naming the request it is about (-1 for `PG_READY`, `PG_FAILED`,
   * and a notice while no request is in flight). The `PG_DESCRIBED` of a registered
   * statement is the pool's and is not answered. When the connection fails,
   * `PG_LOST` comes for each request in flight on it, oldest first, then
   * `PG_FAILED`: close its socket. A connection that fails before it is ready,
   * while no other is, takes the oldest waiting request with it, so that a
   * server that cannot be reached empties the queue rather than holds it.
   * `PG_NEED_MORE` once `PG_FAILED` was answered, until `connect` builds the
   * slot again. Panics as `connection(slot)` does.
   */
  next(slot: i32): i32 {
    const conn: PgConnection = this.connection(slot)
    const s: PgPoolSlot = this.slots[slot]
    if (s.state === PG_SLOT_IDLE || s.state === PG_SLOT_WANTED) {
      this.ticket = -1
      return PG_NEED_MORE
    }
    while (s.state === PG_SLOT_STARTING || s.state === PG_SLOT_READY) {
      this.ticket = s.count > 0 ? s.tickets[s.head] : -1
      const event: i32 = conn.next()
      if (event === PG_READY) {
        s.state = PG_SLOT_READY
      } else if (event === PG_DESCRIBED && s.count > 0 && s.leads[s.head] > 0) {
        s.leads[s.head] -= 1
        s.described += 1
        continue
      } else if (event === PG_ERROR && s.count > 0 && s.leads[s.head] > 0) {
        // The rest of the group's prepares were skipped: the next request prepares them again.
        s.leads[s.head] = 0
        s.queued = s.described
      } else if (event === PG_GROUP_DONE) {
        s.pop()
      } else if (event === PG_FAILED) {
        if (s.state === PG_SLOT_STARTING && this.queueCount > 0 && !this.anyReady()) {
          s.push(this.queue[this.queueHead], toI32(0))
          this.queueHead = (this.queueHead + 1) % toI32(this.queue.length)
          this.queueCount -= 1
        }
        if (this.building === slot) {
          this.building = -1
        }
        s.state = PG_SLOT_DRAINING
        break
      }
      return event
    }
    if (s.state === PG_SLOT_DRAINING && s.count > 0) {
      this.ticket = s.tickets[s.head]
      s.pop()
      return PG_LOST
    }
    s.state = PG_SLOT_IDLE
    this.ticket = -1
    return PG_FAILED
  }

  private anyReady(): boolean {
    for (const slot of this.slots) {
      if (slot.state === PG_SLOT_READY) {
        return true
      }
    }
    return false
  }

  /** Whether every byte of the pool's copy of the password is zero, as `PgConnection.passwordWiped()` reads its own. */
  passwordWiped(): boolean {
    return this.password.wiped()
  }

  /** Wipes the pool's password and every connection's; `connect` panics after it. */
  dispose(): void {
    if (!this.password.gone) {
      this.password.wipe()
    }
    for (const slot of this.slots) {
      const conn: PgConnection | null = slot.conn
      if (conn !== null) {
        conn.dispose()
      }
    }
  }
}

// --- Batching ------------------------------------------------------------------

/** `PgBatchConfig.keyType`: the keys are `int8`, given to `PgBatcher.addInt`. */
export const PG_BATCH_INT: i32 = 0
/** `PgBatchConfig.keyType`: the keys are `text`, given to `PgBatcher.addText`. */
export const PG_BATCH_TEXT: i32 = 1

/** `PgBatcher.next(run)`: no event until the next row, `end` or `fail`. */
export const PG_BATCH_NONE: i32 = 0
/** `PgBatcher.next(run)`: the connection's current row answers the request `tag`. */
export const PG_BATCH_ROW: i32 = 1
/** `PgBatcher.next(run)`: the request `tag` has had all its rows, at least one. */
export const PG_BATCH_DONE: i32 = 2
/** `PgBatcher.next(run)`: no row answered the request `tag`'s key. */
export const PG_BATCH_MISSING: i32 = 3
/** `PgBatcher.next(run)`: the request `tag`'s execution failed, and its rows so far may be incomplete. */
export const PG_BATCH_FAILED: i32 = 4

const PG_BATCH_MAX_REQUESTS: i32 = 65536
const PG_BATCH_MAX_QUEUE: i32 = 1048576
const PG_BATCH_MAX_RUNS: i32 = 1024
// The array's `{}` and the longest int8 element, `-9223372036854775808`.
const PG_BATCH_MIN_BYTES: i32 = 22

/** What a `PgBatcher` sends: one statement shape, its key, and its caps. */
export class PgBatchConfig {
  /** The prepared statement's name, which `PgBatcher.sql` is prepared under. */
  name: string = ""
  /** The query for one key, `q.key`: `select id, title from articles where slug = q.key`. */
  select: string = ""
  /** Columns of `t`, the query's rows, ordering the rows of one key: `t.created_at desc`; "" for none. */
  orderBy: string = ""
  /** `PG_BATCH_INT` or `PG_BATCH_TEXT`. */
  keyType: i32 = 0
  /** The most requests one execution answers. */
  maxRequests: i32 = 32
  /** The most bytes the key array parameter takes, `{}` included. */
  maxBytes: i32 = 32768
  /** The most requests waiting. */
  queueSize: i32 = 1024
  /** The most bytes of text keys waiting. */
  queueBytes: i32 = 65536
  /** The most executions in flight at once. */
  runs: i32 = 16
}

/** One execution's requests, grouped by key, and how far its rows have been routed. */
class PgBatchRun {
  /** Key `k`'s requests' tags are `tags[first[k], first[k + 1])`, in the order they were added. */
  readonly tags: i32[]
  readonly first: i32[]
  keys: i32 = 0
  /** The key rows are being read for, whether it has had one, and the next of its requests to answer. */
  cur: i32 = 0
  curRows: boolean = false
  at: i32 = 0
  /** The key whose `PG_BATCH_ROW` events are owed for the connection's current row; -1 for none. */
  target: i32 = -1
  open: boolean = false
  ended: boolean = false
  failed: boolean = false

  constructor(maxRequests: i32) {
    this.tags = new Array<i32>(maxRequests)
    this.first = new Array<i32>(maxRequests + 1)
  }
}

/**
 * Batches keyed reads of one statement shape, sans-IO like `PgConnection`:
 * it reads no clock and makes no socket. Each request is a key and the
 * caller's `tag`, queued by `addInt` or `addText`. When a connection is free,
 * `take(conn)` binds up to `maxRequests` of them, and up to `maxBytes` of
 * keys, as one execution of `sql`, each distinct key once, and answers the
 * execution's run. Each `PG_ROW` of that execution goes to `row(run, conn)`,
 * its `PG_COMPLETE` to `end(run)`, and an error or a lost connection to
 * `fail(run)`; after each, `next(run)` answers events until
 * `PG_BATCH_NONE`, `tag` naming the request each is about. Every row goes to
 * every request for its key, and every request gets one last event:
 * `PG_BATCH_DONE`, `PG_BATCH_MISSING` or `PG_BATCH_FAILED`.
 *
 * Nothing outlives its execution: a run is free again once the events
 * `end` or `fail` owe are answered, and `row`, `end` and `fail` then panic
 * on it until `take` hands it out again. The ordinal each row carries comes
 * from the server and is checked before it routes anything.
 */
export class PgBatcher {
  /** The prepared statement's name. */
  readonly name: string
  /** The statement to prepare under `name` (`PgPool.register` or `PgConnection.prepare`, no parameter types); each row's last column is the ordinal it routes by. */
  readonly sql: string
  // The queue, a ring: each request's tag, its key's hash and encoded size,
  // and the key: an int8, or a window of `store`, where text keys sit in the
  // order they were added, from the oldest's start to `storeEnd`.
  private readonly qTags: i32[]
  private readonly qHashes: i32[]
  private readonly qSizes: i32[]
  private readonly qInts: i64[]
  private readonly qStarts: i32[]
  private readonly qLengths: i32[]
  private readonly store: u8[]
  // `take`'s open-addressed table of the keys it has bound, each a key number
  // plus one, 0 for an empty slot; and for each key, its slot and its first request.
  private readonly table: i32[]
  private readonly keySlots: i32[]
  private readonly keyEntries: i32[]
  private readonly keyCounts: i32[]
  private readonly takenKeys: i32[]
  private readonly runs: PgBatchRun[]
  /** The request the last `next(run)` answered about; -1 for none. */
  tag: i32 = -1
  /** The number of rows refused because their ordinal named no key still open; each failed its execution. */
  refused: i32 = 0
  private readonly keyType: i32
  private readonly maxRequests: i32
  private readonly maxBytes: i32
  private storeEnd: i32 = 0
  private head: i32 = 0
  private count: i32 = 0

  /** A batcher for `config`; panics when a name or query is empty or holds a NUL, or a cap is out of range. */
  constructor(config: PgBatchConfig) {
    const keyType: i32 = config.keyType
    if (keyType !== PG_BATCH_INT && keyType !== PG_BATCH_TEXT) {
      panic("nish/net/postgres: a PgBatchConfig keyType out of range")
    }
    if (
      config.name.length === 0 ||
      config.select.length === 0 ||
      pgHasNul(config.name) ||
      pgHasNul(config.select) ||
      pgHasNul(config.orderBy)
    ) {
      panic("nish/net/postgres: a PgBatchConfig name or query empty or with a NUL")
    }
    const maxRequests: i32 = config.maxRequests
    if (
      maxRequests < 1 ||
      maxRequests > PG_BATCH_MAX_REQUESTS ||
      config.maxBytes < PG_BATCH_MIN_BYTES ||
      config.maxBytes > PG_MAX_CAP ||
      config.queueSize < 1 ||
      config.queueSize > PG_BATCH_MAX_QUEUE ||
      config.queueBytes < 0 ||
      config.queueBytes > PG_MAX_CAP ||
      config.runs < 1 ||
      config.runs > PG_BATCH_MAX_RUNS
    ) {
      panic("nish/net/postgres: a PgBatchConfig cap out of range")
    }
    this.keyType = keyType
    this.maxRequests = maxRequests
    this.maxBytes = config.maxBytes
    this.name = config.name
    const type: string = keyType === PG_BATCH_INT ? "int8" : "text"
    const order: string = config.orderBy.length > 0 ? `, ${config.orderBy}` : ""
    this.sql = `select t.*, q.ord from unnest($1::${type}[]) with ordinality as q(key, ord) cross join lateral (${config.select}) as t order by q.ord${order}`
    const queueSize: i32 = config.queueSize
    this.qTags = new Array<i32>(queueSize)
    this.qHashes = new Array<i32>(queueSize)
    this.qSizes = new Array<i32>(queueSize)
    const text: boolean = keyType === PG_BATCH_TEXT
    const intSize: i32 = text ? 0 : queueSize
    const textSize: i32 = text ? queueSize : 0
    const storeSize: i32 = text ? config.queueBytes : 0
    this.qInts = new Array<i64>(intSize)
    this.qStarts = new Array<i32>(textSize)
    this.qLengths = new Array<i32>(textSize)
    this.store = new Array<u8>(storeSize)
    // At least twice the keys a take can hold, a power of two for the mask.
    let tableSize: i32 = 2
    while (tableSize < 2 * maxRequests) {
      tableSize *= 2
    }
    this.table = new Array<i32>(tableSize)
    this.keySlots = new Array<i32>(maxRequests)
    this.keyEntries = new Array<i32>(maxRequests)
    this.keyCounts = new Array<i32>(maxRequests)
    this.takenKeys = new Array<i32>(maxRequests)
    this.runs = []
    for (let r: i32 = 0; r < config.runs; r++) {
      this.runs.push(new PgBatchRun(maxRequests))
    }
  }

  /** The number of requests waiting for `take`. */
  waiting(): i32 {
    return this.count
  }

  /** Queues a request for the int8 `key`; false when `queueSize` are waiting. Panics on a text batcher. */
  addInt(key: i64, tag: i32): boolean {
    if (this.keyType !== PG_BATCH_INT) {
      panic("nish/net/postgres: PgBatcher.addInt on a text batcher")
    }
    const q: i32 = this.slotToAdd()
    if (q < 0) {
      return false
    }
    // Both halves folded to 31 bits, so that no step can overflow.
    const h: i32 = toI32(key & toI64(0x7fffffff)) ^ toI32((key >> toI64(31)) & toI64(0x7fffffff))
    this.qInts[q] = key
    this.added(q, tag, h ^ (h >> 15), pgDecimalLength(key))
    return true
  }

  /**
   * Queues a request for the text key `bytes[start, start + length)`, UTF-8,
   * which is copied; false when `queueSize` are waiting, the key would not
   * fit in `queueBytes` beside those waiting, or it is too long for one
   * execution's `maxBytes`. Panics on an int8 batcher, or when the window is
   * not inside `bytes`.
   */
  addText(bytes: u8[], start: i32, length: i32, tag: i32): boolean {
    if (this.keyType !== PG_BATCH_TEXT) {
      panic("nish/net/postgres: PgBatcher.addText on an int8 batcher")
    }
    if (start < 0 || length < 0 || length > toI32(bytes.length) - start) {
      panic("nish/net/postgres: PgBatcher.addText outside its source")
    }
    // The element as `arrayElement` writes it: quoted, `"` and `\` escaped.
    const end: i32 = start + length
    let size: i64 = toI64(length) + 2
    let h: i32 = 0
    for (let i: i32 = start; i < end && i < toI32(bytes.length); i++) {
      const c: i32 = toI32(bytes[i])
      if (c === PG_QUOTE || c === PG_BACKSLASH) {
        size += 1
      }
      // Kept under 2^20 before the multiply, so that no step can overflow.
      h = (h & 0xfffff) * 31 + c
    }
    if (size + 2 > toI64(this.maxBytes)) {
      return false
    }
    const q: i32 = this.slotToAdd()
    if (q < 0) {
      return false
    }
    let at: i32 = this.storeEnd
    if (length > toI32(this.store.length) - at) {
      // The waiting keys are moved to the front, the room the taken ones left after them.
      const from: i32 = this.count > 0 ? this.qStarts[this.head] : at
      copyBytes(this.store, 0, this.store, from, at - from)
      for (let i: i32 = 0; i < this.count; i++) {
        const w: i32 = (this.head + i) % toI32(this.qStarts.length)
        this.qStarts[w] -= from
      }
      at -= from
      this.storeEnd = at
      if (length > toI32(this.store.length) - at) {
        return false
      }
    }
    copyBytes(this.store, at, bytes, start, length)
    this.storeEnd = at + length
    this.qStarts[q] = at
    this.qLengths[q] = length
    this.added(q, tag, h, toI32(size))
    return true
  }

  /** The ring slot the next request goes in, or -1 when the queue is full. */
  private slotToAdd(): i32 {
    const size: i32 = toI32(this.qTags.length)
    return this.count === size ? -1 : (this.head + this.count) % size
  }

  private added(q: i32, tag: i32, hash: i32, size: i32): void {
    this.qTags[q] = tag
    this.qHashes[q] = hash
    this.qSizes[q] = size
    this.count += 1
  }

  /** Whether the keys of the queued requests `a` and `b` are equal. */
  private sameKey(a: i32, b: i32): boolean {
    if (this.keyType === PG_BATCH_INT) {
      return this.qInts[a] === this.qInts[b]
    }
    const n: i32 = this.qLengths[a]
    if (n !== this.qLengths[b]) {
      return false
    }
    const x: i32 = this.qStarts[a]
    const y: i32 = this.qStarts[b]
    for (let i: i32 = 0; i < n; i++) {
      if (this.store[x + i] !== this.store[y + i]) {
        return false
      }
    }
    return true
  }

  /**
   * Binds the oldest waiting requests on `conn` as one execution of `sql`,
   * prepared there already, and answers its run; the caller ends the group
   * (`sync()`, or `PgPool.send()`). It takes up to `maxRequests` requests,
   * oldest first, and stops at the first whose key would pass `maxBytes` or
   * the connection's `maxOutput`; those not taken stay queued. -1, and
   * nothing written, when none waits, every run is in flight, or `conn`
   * refused the bind or the first key.
   */
  take(conn: PgConnection): i32 {
    if (this.count === 0) {
      return -1
    }
    let r: i32 = -1
    for (let i: i32 = 0; i < toI32(this.runs.length); i++) {
      if (!this.runs[i].open) {
        r = i
        break
      }
    }
    if (r < 0 || !conn.bindStart(this.name)) {
      return -1
    }
    if (!conn.arrayStart()) {
      conn.bindCancel()
      return -1
    }
    const ring: i32 = toI32(this.qTags.length)
    const mask: i32 = toI32(this.table.length) - 1
    let keys: i32 = 0
    let taken: i32 = 0
    let bytes: i32 = 2
    while (taken < this.count && taken < this.maxRequests && taken < toI32(this.takenKeys.length)) {
      const q: i32 = (this.head + taken) % ring
      // Probe for the key: a slot holding it, or the empty slot it would take.
      let slot: i32 = this.qHashes[q] & mask
      let k: i32 = -1
      while (this.table[slot] > 0) {
        const seen: i32 = this.table[slot] - 1
        if (this.sameKey(this.keyEntries[seen], q)) {
          k = seen
          break
        }
        slot = (slot + 1) & mask
      }
      if (k < 0) {
        const cost: i32 = this.qSizes[q] + (keys > 0 ? 1 : 0)
        if (cost > this.maxBytes - bytes || !this.bindKey(conn, q)) {
          break
        }
        bytes += cost
        k = keys
        keys += 1
        this.table[slot] = keys
        this.keySlots[k] = slot
        this.keyEntries[k] = q
        this.keyCounts[k] = 0
      }
      this.keyCounts[k] += 1
      this.takenKeys[taken] = k
      taken += 1
    }
    for (let k: i32 = 0; k < keys && k < toI32(this.keySlots.length); k++) {
      this.table[this.keySlots[k]] = 0
    }
    if (taken === 0) {
      conn.bindCancel()
      return -1
    }
    conn.arrayEnd()
    conn.bindEnd()
    // The requests grouped by key, each key's in the order they were added.
    const run: PgBatchRun = this.runs[r]
    run.first[0] = 0
    for (let k: i32 = 0; k < keys && k < toI32(this.keyCounts.length); k++) {
      run.first[k + 1] = run.first[k] + this.keyCounts[k]
      this.keyCounts[k] = run.first[k]
    }
    for (let i: i32 = 0; i < taken && i < toI32(this.takenKeys.length); i++) {
      const k: i32 = this.takenKeys[i]
      run.tags[this.keyCounts[k]] = this.qTags[(this.head + i) % ring]
      this.keyCounts[k] += 1
    }
    run.open = true
    run.keys = keys
    run.cur = 0
    run.curRows = false
    run.at = 0
    run.target = -1
    run.ended = false
    run.failed = false
    this.head = (this.head + taken) % ring
    this.count -= taken
    if (this.count === 0) {
      this.storeEnd = 0
    }
    return r
  }

  /** Writes the queued request `q`'s key as the open array's next element; false when `conn` has no room. */
  private bindKey(conn: PgConnection, q: i32): boolean {
    if (this.keyType === PG_BATCH_INT) {
      return conn.arrayInt(this.qInts[q])
    }
    return conn.arrayElement(this.store, this.qStarts[q], this.qLengths[q])
  }

  private run(r: i32): PgBatchRun {
    if (r < 0 || r >= toI32(this.runs.length)) {
      panic("nish/net/postgres: a PgBatcher run out of range")
    }
    return this.runs[r]
  }

  /** The run `r`, which `take` handed out, not ended, and whose events are all answered. */
  private quietRun(r: i32, what: string): PgBatchRun {
    const run: PgBatchRun = this.run(r)
    if (!run.open) {
      panic(`nish/net/postgres: PgBatcher.${what} on a run that is over`)
    }
    if (run.target >= 0 || run.ended) {
      panic(`nish/net/postgres: PgBatcher.${what} before next(run) answered PG_BATCH_NONE`)
    }
    return run
  }

  /**
   * Routes `conn`'s current row, of run `r`'s execution, by the ordinal in
   * its last column: `next(r)` then answers `PG_BATCH_ROW` for each request
   * of its key, after the last events of the keys before it. False, and the
   * row dropped, when the run has failed; and when the ordinal is NULL, not
   * an integer, or names no key still open (one out of range, or one before
   * the key the last row was for): that counts in `refused` and fails the
   * run. Panics when the run is over or its events are not all answered.
   */
  row(r: i32, conn: PgConnection): boolean {
    const run: PgBatchRun = this.quietRun(r, "row")
    if (run.failed) {
      return false
    }
    const last: i32 = conn.columns - 1
    let ordinal: i64 = 0
    let bad: boolean = last < 0 || conn.isNull(last)
    if (!bad) {
      // Read without touching `text.failed`, which belongs to the program's own decoding.
      const failed: boolean = conn.text.failed
      conn.text.failed = false
      ordinal = conn.int(last)
      bad = conn.text.failed
      conn.text.failed = failed
    }
    // Ordinals count from 1 and come in order: a row may name the current key again, never one before it.
    if (bad || ordinal < toI64(run.cur) + 1 || ordinal > toI64(run.keys)) {
      this.refused += 1
      run.failed = true
      return false
    }
    run.target = toI32(ordinal) - 1
    return true
  }

  /** Ends run `r`'s execution, on its `PG_COMPLETE`: `next(r)` then closes every request left. Panics as `row` does. */
  end(r: i32): void {
    this.quietRun(r, "end").ended = true
  }

  /** Fails run `r`'s execution, on its `PG_ERROR` or `PG_LOST`: `next(r)` then answers `PG_BATCH_FAILED` for every request left. Panics as `row` does. */
  fail(r: i32): void {
    const run: PgBatchRun = this.quietRun(r, "fail")
    run.failed = true
    run.ended = true
  }

  /**
   * The next event `row`, `end` or `fail` owes on run `r`, with `tag` the
   * request it is about; `PG_BATCH_NONE`, and `tag` -1, when there is none.
   * Once `end` or `fail` has had all its events the run is over and free
   * for `take` again.
   */
  next(r: i32): i32 {
    const run: PgBatchRun = this.run(r)
    this.tag = -1
    if (!run.open) {
      return PG_BATCH_NONE
    }
    // The keys before the row's, or every key once the execution is over, have had all their rows.
    const limit: i32 = run.target >= 0 ? run.target : run.ended ? run.keys : run.cur
    while (run.cur < limit && run.cur < toI32(run.tags.length)) {
      const at: i32 = run.first[run.cur] + run.at
      if (at < run.first[run.cur + 1]) {
        run.at += 1
        this.tag = run.tags[at]
        return run.failed ? PG_BATCH_FAILED : run.curRows ? PG_BATCH_DONE : PG_BATCH_MISSING
      }
      run.cur += 1
      run.at = 0
      run.curRows = false
    }
    if (run.target >= 0 && run.cur < toI32(run.tags.length)) {
      run.curRows = true
      const at: i32 = run.first[run.cur] + run.at
      if (at < run.first[run.cur + 1]) {
        run.at += 1
        this.tag = run.tags[at]
        return PG_BATCH_ROW
      }
      run.target = -1
      run.at = 0
    }
    if (run.ended && run.cur >= run.keys) {
      run.open = false
    }
    return PG_BATCH_NONE
  }
}
