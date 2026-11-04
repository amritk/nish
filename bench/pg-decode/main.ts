// nish/net/postgres's decode and encode paths in nanoseconds an operation,
// with no server: canned backend bytes fed to a PgConnection the program
// started itself, under bench/crypto/README.md's program contract.
// bench/pg-decode/run.mjs builds it with `--profile speed` and runs
//
//   main <kernel> <size> <iterations>
//
//   rows <n>     a binary-format group on one PgConnection: a Bind of one
//                int8 parameter (paramInt, so putDecimal), Execute and Sync
//                written and drained, then BindComplete, RowDescription, <n>
//                DataRows, CommandComplete and ReadyForQuery fed through
//                receive/next (readRow), every column read: int8 and
//                timestamptz by binaryInt (getI64BE), the text by its window,
//                the int8[] by PgBinaryArray, the NULL by isNull
//   pool <n>     the same group through a one-slot PgPool: request, dispatch,
//                bind, send, and PgPool.next for every event
//   params <n>   a text-format Bind as PgBatcher's PG_BATCH_TEXT writes one:
//                an array of <n> text keys of 8 to 64 bytes (arrayElement),
//                an int8[] of <n> ids (paramIntArray, so putDecimal) and one
//                int8 (paramInt), then Execute and Sync; its answer is
//                BindComplete, CommandComplete and ReadyForQuery
//
// A row's columns are an int8 id, a text of 8 to 64 bytes, a timestamptz, an
// int8[] of 0, 1, 4 or 8 elements, and a text that is NULL on two rows in
// three. Every byte written and every value read is folded into the checksum;
// each prints it on stdout and the timed loop's nanoseconds on stderr.
import { Args, foldStart, now, parseArgs, report } from "../crypto/lib/gen"
import {
  PG_ARRAY_ELEMENT,
  PG_ARRAY_NULL,
  PG_DESCRIBED,
  PG_ERR_NONE,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_NEED_MORE,
  PG_READY,
  PG_ROW,
  PgBinaryArray,
  PgConfig,
  PgConnection,
  PgPool,
} from "nish/net/postgres"
import { secret, wipe } from "nish:secret"

/** The `client-nonce` every connection starts with: 18 bytes, as `PgConnection` asks. */
const NONCE: string = "nish-pg-decode-nnc"

/** The low 32 bits of an i64. */
const LOW32: i64 = 4294967295
/** Knuth's multiplicative hash constant, spreading the ids. */
const GOLDEN: i64 = 2654435761
/** 2025-01-01 00:00:00 UTC in microseconds since PostgreSQL's 2000-01-01 epoch. */
const EPOCH_2025: i64 = 788918400000000

/** The columns of a row: id, name, at, tags, note. */
const COLUMNS: i32 = 5

/** One byte into FNV-1a 32, as ../crypto/lib/gen folds. */
const mix = (h: u32, b: i32): u32 => (h ^ toU32(b & 255)) * 16777619

/** The low four bytes of `v` into `h`, least significant first. */
const foldInt = (h: u32, v: i64): u32 => {
  let s: u32 = h
  for (let k: i32 = 0; k < 4; k++) {
    s = mix(s, toI32((v >> toI64(k) * toI64(8)) & toI64(255)))
  }
  return s
}

/** A growable byte buffer the canned messages are written into. */
class Bytes {
  b: u8[]
  n: i32 = 0

  constructor() {
    this.b = new Array<u8>(256)
  }

  byte(v: i32): void {
    if (this.n === toI32(this.b.length)) {
      const grown: u8[] = new Array<u8>(2 * this.n)
      grown.set(this.b, 0)
      this.b = grown
    }
    this.b[this.n] = toU8(v)
    this.n += 1
  }

  i16(v: i32): void {
    this.byte(v >> 8)
    this.byte(v)
  }

  i32(v: i32): void {
    this.byte(v >> 24)
    this.byte(v >> 16)
    this.byte(v >> 8)
    this.byte(v)
  }

  i64(v: i64): void {
    this.i32(toI32(v >> toI64(32)))
    this.i32(toI32(v & LOW32))
  }

  text(s: string): void {
    for (let i: i32 = 0; i < toI32(s.length); i++) {
      this.byte(s.charCodeAt(i))
    }
  }

  cstring(s: string): void {
    this.text(s)
    this.byte(0)
  }

  /** Starts a message of `type`; answers where its length goes, for `end`. */
  start(type: i32): i32 {
    this.byte(type)
    const at: i32 = this.n
    this.i32(0)
    return at
  }

  /** Writes the length of the message whose length word is at `at`. */
  end(at: i32): void {
    const length: i32 = this.n - at
    this.b[at] = toU8(length >> 24)
    this.b[at + 1] = toU8(length >> 16)
    this.b[at + 2] = toU8(length >> 8)
    this.b[at + 3] = toU8(length)
  }

  /** The bytes written, exactly. */
  done(): u8[] {
    const out: u8[] = new Array<u8>(this.n)
    for (let i: i32 = 0; i < toI32(out.length) && i < toI32(this.b.length); i++) {
      out[i] = this.b[i]
    }
    return out
  }
}

/** The elements row `r`'s int8[] has: 0, 1, 4 or 8. */
const tagCount = (r: i32): i32 => {
  const k: i32 = r % 4
  return k === 0 ? 0 : k === 1 ? 1 : k === 2 ? 4 : 8
}

/** Row `r`'s name: 8 to 64 lowercase letters. */
const nameOf = (r: i32): string => {
  const length: i32 = 8 + ((r * 37) % 57)
  const out: string[] = []
  for (let i: i32 = 0; i < length; i++) {
    out.push(String.fromCharCode(97 + ((r + i * 7) % 26)))
  }
  return out.join("")
}

/** A RowDescription field: name, table OID, column, type OID, size, modifier, format 1. */
const field = (w: Bytes, name: string, oid: i32, size: i32): void => {
  w.cstring(name)
  w.i32(16384)
  w.i16(1)
  w.i32(oid)
  w.i16(size)
  w.i32(-1)
  w.i16(1)
}

/** The answer to one binary group of `rows` rows: BindComplete, RowDescription, the DataRows, CommandComplete, ReadyForQuery. */
const rowStream = (rows: i32): u8[] => {
  const w = new Bytes()
  w.end(w.start(50))
  const t: i32 = w.start(84)
  w.i16(COLUMNS)
  field(w, "id", 20, 8)
  field(w, "name", 25, -1)
  field(w, "at", 1184, 8)
  field(w, "tags", 1016, -1)
  field(w, "note", 25, -1)
  w.end(t)
  for (let r: i32 = 0; r < rows; r++) {
    const d: i32 = w.start(68)
    w.i16(COLUMNS)
    w.i32(8)
    w.i64(toI64(r) * GOLDEN + toI64(1))
    const name: string = nameOf(r)
    w.i32(toI32(name.length))
    w.text(name)
    w.i32(8)
    w.i64(EPOCH_2025 + toI64(r) * toI64(1000003))
    const tags: i32 = tagCount(r)
    // array_send's layout: no dimension for an empty array, else one from 1.
    w.i32(tags === 0 ? 12 : 20 + 12 * tags)
    w.i32(tags === 0 ? 0 : 1)
    w.i32(0)
    w.i32(20)
    if (tags > 0) {
      w.i32(tags)
      w.i32(1)
      for (let k: i32 = 0; k < tags; k++) {
        w.i32(8)
        w.i64(toI64(r * 8 + k) - toI64(3))
      }
    }
    if (r % 3 === 0) {
      w.i32(8)
      w.text("note-row")
    } else {
      w.i32(-1)
    }
    w.end(d)
  }
  const c: i32 = w.start(67)
  w.cstring(`SELECT ${rows}`)
  w.end(c)
  const z: i32 = w.start(90)
  w.byte(73)
  w.end(z)
  return w.done()
}

/** The answer to one group with no rows: BindComplete, CommandComplete, ReadyForQuery. */
const emptyStream = (): u8[] => {
  const w = new Bytes()
  w.end(w.start(50))
  const c: i32 = w.start(67)
  w.cstring("SELECT 0")
  w.end(c)
  const z: i32 = w.start(90)
  w.byte(73)
  w.end(z)
  return w.done()
}

/** One ParameterStatus: `name` is `value`. */
const setting = (w: Bytes, name: string, value: string): void => {
  const s: i32 = w.start(83)
  w.cstring(name)
  w.cstring(value)
  w.end(s)
}

/** The startup a server with no password answers: AuthenticationOk, the settings checked, BackendKeyData, ReadyForQuery. */
const startupStream = (): u8[] => {
  const w = new Bytes()
  const r: i32 = w.start(82)
  w.i32(0)
  w.end(r)
  setting(w, "client_encoding", "UTF8")
  setting(w, "DateStyle", "ISO, MDY")
  setting(w, "TimeZone", "UTC")
  const k: i32 = w.start(75)
  w.i32(4242)
  w.i32(77)
  w.end(k)
  const z: i32 = w.start(90)
  w.byte(73)
  w.end(z)
  return w.done()
}

const nonceBytes = (): u8[] => {
  const out: u8[] = new Array<u8>(toI32(NONCE.length))
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8(NONCE.charCodeAt(i))
  }
  return out
}

/** A trust server's password: none. */
const noPassword = (): u8[] => new Array<u8>(0)

const configOf = (): PgConfig => {
  const config = new PgConfig()
  config.user = "bench"
  config.database = "bench"
  return config
}

/** The output queued on `conn` folded into `h`, then marked sent, as a carrier writes it. */
const drain = (conn: PgConnection, h: u32): u32 => {
  const out: u8[] = conn.outputBuffer()
  const start: i32 = conn.outputStart()
  const end: i32 = conn.outputEnd()
  let s: u32 = h
  for (let i: i32 = start; i >= 0 && i < end && i < toI32(out.length); i++) {
    s = mix(s, toI32(out[i]))
  }
  conn.sent(end - start)
  return s
}

/** Row `conn` holds folded into `h`: every column, as the server's read paths read it. */
const readRow = (conn: PgConnection, tags: PgBinaryArray, h: u32): u32 => {
  let s: u32 = foldInt(h, conn.binaryInt(0))
  s = mix(s, conn.colLength(1))
  const name: i32 = conn.colStart(1)
  const input: u8[] = conn.inputBuffer()
  if (name >= 0 && name < toI32(input.length)) {
    s = mix(s, toI32(input[name]))
  }
  s = foldInt(s, conn.binaryInt(2))
  tags.begin(input, conn.colStart(3), conn.colLength(3))
  while (true) {
    const e: i32 = tags.next()
    if (e === PG_ARRAY_ELEMENT) {
      s = foldInt(s, tags.int())
    } else if (e !== PG_ARRAY_NULL) {
      s = mix(s, e)
      break
    }
  }
  return mix(s, conn.isNull(4) ? 1 : 0)
}

/** A connection past its startup, ready for groups. */
const started = (): PgConnection | null => {
  const password = secret(noPassword())
  const conn = new PgConnection(configOf(), password, nonceBytes())
  wipe(password)
  conn.sent(conn.outputEnd() - conn.outputStart())
  const startup: u8[] = startupStream()
  conn.receive(startup, 0, toI32(startup.length))
  while (true) {
    const event: i32 = conn.next()
    if (event === PG_READY) {
      return conn
    }
    if (event !== PG_NEED_MORE) {
      return null
    }
  }
}

/** Feeds `stream` to `conn` as reads that fit, answering each event through `next`; the fold of what it read. */
const answer = (conn: PgConnection, stream: u8[], tags: PgBinaryArray, h: u32): u32 => {
  let s: u32 = h
  let fed: i32 = 0
  while (true) {
    const event: i32 = conn.next()
    if (event === PG_GROUP_DONE || event === PG_FAILED) {
      return mix(s, event)
    }
    if (event === PG_ROW) {
      s = readRow(conn, tags, s)
    } else if (event === PG_NEED_MORE) {
      if (fed === toI32(stream.length)) {
        return mix(s, 255)
      }
      fed += conn.receive(stream, fed, toI32(stream.length) - fed)
    } else if (event !== PG_DESCRIBED) {
      s = mix(s, event)
    }
  }
}

/** `rows`: one binary group a iteration on a PgConnection. */
const rowsLoop = (a: Args): i32 => {
  const conn: PgConnection | null = started()
  if (conn === null) {
    writeError("pg-decode: the startup failed\n")
    return 1
  }
  const stream: u8[] = rowStream(a.size)
  const tags = new PgBinaryArray(conn.binary)
  let sum: u32 = foldStart()
  const t0: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    conn.bindStartBinary("rows")
    conn.paramInt(toI64(i) * toI64(1000003))
    conn.bindEnd()
    conn.sync()
    sum = drain(conn, sum)
    sum = answer(conn, stream, tags, sum)
  }
  if (conn.failure !== PG_ERR_NONE || conn.binary.failed) {
    writeError(`pg-decode: the connection failed (${conn.failure}) or a column did not decode\n`)
    return 1
  }
  report(sum, t0)
  return 0
}

/** `pool`: the same group through a one-slot PgPool. */
const poolLoop = (a: Args): i32 => {
  const password = secret(noPassword())
  const pool = new PgPool(configOf(), password, 1, 16)
  wipe(password)
  pool.request()
  pool.dispatch()
  pool.connect(pool.wanted(), nonceBytes())
  const conn: PgConnection = pool.connection(0)
  conn.sent(conn.outputEnd() - conn.outputStart())
  const startup: u8[] = startupStream()
  conn.receive(startup, 0, toI32(startup.length))
  if (pool.next(0) !== PG_READY) {
    writeError("pg-decode: the pool's startup failed\n")
    return 1
  }
  // The request queued to want the slot; a dispatch now hands it out, and it is answered empty.
  const stream: u8[] = rowStream(a.size)
  const tags = new PgBinaryArray(conn.binary)
  if (!firstGroup(pool, conn, emptyStream(), tags)) {
    writeError("pg-decode: the pool's first group failed\n")
    return 1
  }
  let sum: u32 = foldStart()
  const t0: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    pool.request()
    if (pool.dispatch() !== 0) {
      writeError("pg-decode: the pool handed out no slot\n")
      return 1
    }
    conn.bindStartBinary("rows")
    conn.paramInt(toI64(i) * toI64(1000003))
    conn.bindEnd()
    pool.send()
    sum = drain(conn, sum)
    let fed: i32 = 0
    while (true) {
      const event: i32 = pool.next(0)
      if (event === PG_GROUP_DONE) {
        sum = mix(sum, event)
        break
      }
      if (event === PG_FAILED) {
        writeError(`pg-decode: the pool's connection failed (${conn.failure})\n`)
        return 1
      }
      if (event === PG_ROW) {
        sum = readRow(conn, tags, sum)
      } else if (event === PG_NEED_MORE) {
        if (fed === toI32(stream.length)) {
          writeError("pg-decode: the pool's group never ended\n")
          return 1
        }
        fed += conn.receive(stream, fed, toI32(stream.length) - fed)
      } else if (event !== PG_DESCRIBED) {
        sum = mix(sum, event)
      }
    }
  }
  report(sum, t0)
  return 0
}

/** Sends the request that wanted the slot as an empty bind and feeds it `stream`; whether its group ended. */
const firstGroup = (pool: PgPool, conn: PgConnection, stream: u8[], tags: PgBinaryArray): boolean => {
  if (pool.dispatch() !== 0) {
    return false
  }
  conn.bindStartBinary("rows")
  conn.bindEnd()
  pool.send()
  drain(conn, 0)
  let fed: i32 = 0
  while (true) {
    const event: i32 = pool.next(0)
    if (event === PG_GROUP_DONE || event === PG_FAILED) {
      return event === PG_GROUP_DONE
    }
    if (event === PG_ROW) {
      readRow(conn, tags, 0)
    } else if (event === PG_NEED_MORE) {
      if (fed === toI32(stream.length)) {
        return false
      }
      fed += conn.receive(stream, fed, toI32(stream.length) - fed)
    }
  }
}

/** `params`: one PG_BATCH_TEXT bind a iteration, `n` keys and `n` ids. */
const paramsLoop = (a: Args): i32 => {
  const conn: PgConnection | null = started()
  if (conn === null) {
    writeError("pg-decode: the startup failed\n")
    return 1
  }
  const n: i32 = a.size
  const keys: u8[][] = []
  const ids: i64[] = []
  for (let k: i32 = 0; k < n; k++) {
    const name: string = nameOf(k * 5 + 1)
    const bytes: u8[] = new Array<u8>(toI32(name.length))
    for (let j: i32 = 0; j < toI32(bytes.length) && j < toI32(name.length); j++) {
      bytes[j] = toU8(name.charCodeAt(j))
    }
    keys.push(bytes)
    ids.push(toI64(k) * GOLDEN - toI64(500000))
  }
  const stream: u8[] = emptyStream()
  const tags = new PgBinaryArray(conn.binary)
  let sum: u32 = foldStart()
  const t0: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    conn.bindStart("batch")
    conn.arrayStart()
    for (const key of keys) {
      conn.arrayElement(key, 0, toI32(key.length))
    }
    conn.arrayEnd()
    conn.paramIntArray(ids, 0, n)
    conn.paramInt(toI64(i))
    conn.bindEnd()
    conn.sync()
    sum = drain(conn, sum)
    sum = answer(conn, stream, tags, sum)
  }
  if (conn.failure !== PG_ERR_NONE) {
    writeError(`pg-decode: the connection failed (${conn.failure})\n`)
    return 1
  }
  report(sum, t0)
  return 0
}

export const main = (): i32 => {
  const a: Args | null = parseArgs("pg-decode")
  if (a === null) {
    return 2
  }
  if (a.kernel === "rows") {
    return rowsLoop(a)
  }
  if (a.kernel === "pool") {
    return poolLoop(a)
  }
  if (a.kernel === "params") {
    return paramsLoop(a)
  }
  writeError(`pg-decode: no kernel ${a.kernel}\n`)
  return 2
}
