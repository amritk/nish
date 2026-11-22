// nish/net/postgres's message encode and decode under an instruction count,
// with no server: a PgConnection fed canned backend bytes, as
// bench/pg-decode/main.ts drives one, `n` rounds of two groups. Each round
// builds a Bind of every parameter kind (int8, text, bytes, NULL, an int8[],
// a text[] and a binary int8[]) with its Execute and Sync, drains it, then
// feeds the answer: BindComplete, RowDescription, `ROWS` DataRows,
// CommandComplete and ReadyForQuery, once in the binary format and once in
// the text one, every column read (binaryInt, int, the text window, isNull,
// PgBinaryArray and PgArrayWalker). The startup it starts from is decoded
// once. It reaches the encode, DataRow parse and Bind/Execute build paths
// whose panic sites the std/ ratchet counts in std/net/postgres.ts, so a fix
// to one of them shows here as a count that holds or falls. It prints the
// fold of every byte written and every value read.
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
  PgArrayWalker,
  PgBinaryArray,
  PgConfig,
  PgConnection,
} from "nish/net/postgres"
import { secret, wipe } from "nish:secret"

/** The DataRows each group answers. */
const ROWS: i32 = 16
/** The columns of a row: an int8 id, a text name, an int8[] of tags, and a text note that is NULL on two rows in three. */
const COLUMNS: i32 = 4
/** The low 32 bits of an i64. */
const LOW32: i64 = 4294967295
/** Knuth's multiplicative hash constant, spreading the ids. */
const GOLDEN: i64 = 2654435761

/** One byte into FNV-1a 32. */
const mix = (h: u32, b: i32): u32 => (h ^ toU32(b & 255)) * 16777619

/** The low four bytes of `v` into `h`. */
const foldInt = (h: u32, v: i64): u32 => {
  let s: u32 = h
  for (let k: i32 = 0; k < 4; k++) {
    s = mix(s, toI32((v >> (toI64(k) * toI64(8))) & toI64(255)))
  }
  return s
}

/** A byte buffer the canned messages are written into. */
class Bytes {
  b: u8[] = []

  byte(v: i32): void {
    this.b.push(toU8(v))
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

  /** Writes a message of `type` whose body is `body`, its length word first. */
  message(type: i32, body: Bytes): void {
    this.byte(type)
    this.i32(toI32(toI64(body.b.length) + toI64(4)))
    for (const v of body.b) {
      this.b.push(v)
    }
  }
}

/** Row `r`'s name: 8 to 40 lowercase letters. */
const nameOf = (r: i32): string => {
  const out: string[] = []
  const width: i64 = toI64(8) + ((toI64(r) * toI64(37)) % toI64(33))
  for (let i: i64 = 0; i < width; i++) {
    out.push(String.fromCharCode(toI32(toI64(97) + ((toI64(r) + i * toI64(7)) % toI64(26)))))
  }
  return out.join("")
}

/** How many tags row `r` has: 0, 1, 4 or 8. */
const tagCount = (r: i32): i32 => {
  const k: i32 = r % 4
  return k < 2 ? k : 4 << (k - 2)
}

/** Row `r`'s tag `k`. */
const tagValue = (r: i32, k: i32): i64 => toI64(r) * toI64(8) + toI64(k) - toI64(3)

/** A RowDescription field: name, table OID, column, type OID, size, modifier, format. */
const field = (w: Bytes, name: string, oid: i32, size: i32, format: i32): void => {
  w.cstring(name)
  w.i32(16384)
  w.i16(1)
  w.i32(oid)
  w.i16(size)
  w.i32(-1)
  w.i16(format)
}

/** A text-format column: its length, then its bytes. */
const textColumn = (w: Bytes, s: string): void => {
  w.i32(toI32(s.length))
  w.text(s)
}

/** The answer to one group of `ROWS` rows in the binary format or the text one. */
const rowStream = (binary: boolean): u8[] => {
  const w = new Bytes()
  const format: i32 = binary ? 1 : 0
  w.message(50, new Bytes())
  const t = new Bytes()
  t.i16(COLUMNS)
  field(t, "id", 20, 8, format)
  field(t, "name", 25, -1, format)
  field(t, "tags", 1016, -1, format)
  field(t, "note", 25, -1, format)
  w.message(84, t)
  for (let r: i32 = 0; r < ROWS; r++) {
    const d = new Bytes()
    d.i16(COLUMNS)
    const id: i64 = toI64(r) * GOLDEN + toI64(1)
    const tags: i32 = tagCount(r)
    if (binary) {
      d.i32(8)
      d.i64(id)
      textColumn(d, nameOf(r))
      // array_send's layout: no dimension for an empty array, else one from 1.
      d.i32(tags === 0 ? 12 : toI32(toI64(20) + toI64(12) * toI64(tags)))
      d.i32(tags === 0 ? 0 : 1)
      d.i32(0)
      d.i32(20)
      if (tags > 0) {
        d.i32(tags)
        d.i32(1)
        for (let k: i32 = 0; k < tags; k++) {
          d.i32(8)
          d.i64(tagValue(r, k))
        }
      }
    } else {
      textColumn(d, `${id}`)
      textColumn(d, nameOf(r))
      const elements: string[] = []
      for (let k: i32 = 0; k < tags; k++) {
        elements.push(`${tagValue(r, k)}`)
      }
      textColumn(d, `{${elements.join(",")}}`)
    }
    if (r % 3 === 0) {
      textColumn(d, "note-row")
    } else {
      d.i32(-1)
    }
    w.message(68, d)
  }
  const c = new Bytes()
  c.cstring(`SELECT ${ROWS}`)
  w.message(67, c)
  const z = new Bytes()
  z.byte(73)
  w.message(90, z)
  return w.b
}

/** One ParameterStatus: `name` is `value`. */
const setting = (w: Bytes, name: string, value: string): void => {
  const s = new Bytes()
  s.cstring(name)
  s.cstring(value)
  w.message(83, s)
}

/** The startup a server with no password answers. */
const startupStream = (): u8[] => {
  const w = new Bytes()
  const r = new Bytes()
  r.i32(0)
  w.message(82, r)
  setting(w, "client_encoding", "UTF8")
  setting(w, "DateStyle", "ISO, MDY")
  setting(w, "TimeZone", "UTC")
  const k = new Bytes()
  k.i32(4242)
  k.i32(77)
  w.message(75, k)
  const z = new Bytes()
  z.byte(73)
  w.message(90, z)
  return w.b
}

/** `s`'s bytes. */
const ascii = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(s.length))
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(s.length); i++) {
    out[i] = toU8(s.charCodeAt(i))
  }
  return out
}

/** A connection past its startup, ready for groups. */
const started = (): PgConnection | null => {
  const config = new PgConfig()
  config.user = "bench"
  config.database = "bench"
  const password = secret(new Array<u8>(0))
  const conn = new PgConnection(config, password, ascii("nish-pg-codec-nnce"))
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

/** The output queued on `conn` folded into `h`, then marked sent. */
const drain = (conn: PgConnection, h: u32): u32 => {
  const out: u8[] = conn.outputBuffer()
  let s: u32 = h
  for (let i: i32 = conn.outputStart(); i >= 0 && i < conn.outputEnd() && i < toI32(out.length); i++) {
    s = mix(s, toI32(out[i]))
  }
  conn.sent(conn.outputEnd() - conn.outputStart())
  return s
}

/** What a group's rows are read with. */
class Readers {
  tags: PgBinaryArray
  walker: PgArrayWalker

  constructor(conn: PgConnection) {
    this.tags = new PgBinaryArray(conn.binary)
    this.walker = new PgArrayWalker()
  }
}

/** The row `conn` holds folded into `h`, in the binary format or the text one. */
const readRow = (conn: PgConnection, r: Readers, binary: boolean, h: u32): u32 => {
  let s: u32 = foldInt(h, binary ? conn.binaryInt(0) : conn.int(0))
  s = mix(s, conn.colLength(1))
  const input: u8[] = conn.inputBuffer()
  const name: i32 = conn.colStart(1)
  if (name >= 0 && name < toI32(input.length)) {
    s = mix(s, toI32(input[name]))
  }
  if (binary) {
    r.tags.begin(input, conn.colStart(2), conn.colLength(2))
    while (true) {
      const e: i32 = r.tags.next()
      if (e === PG_ARRAY_ELEMENT) {
        s = foldInt(s, r.tags.int())
      } else if (e !== PG_ARRAY_NULL) {
        s = mix(s, e)
        break
      }
    }
  } else {
    r.walker.begin(input, conn.colStart(2), conn.colLength(2))
    while (true) {
      const e: i32 = r.walker.next()
      if (e === PG_ARRAY_ELEMENT) {
        s = foldInt(s, conn.text.int(input, r.walker.start, r.walker.length))
      } else if (e !== PG_ARRAY_NULL) {
        s = mix(s, e)
        break
      }
    }
  }
  return mix(s, conn.isNull(3) ? 1 : 0)
}

/** Feeds `stream` to `conn`, reading each event; the fold of what it read. */
const answer = (conn: PgConnection, stream: u8[], r: Readers, binary: boolean, h: u32): u32 => {
  let s: u32 = h
  let fed: i32 = 0
  while (true) {
    const event: i32 = conn.next()
    if (event === PG_GROUP_DONE || event === PG_FAILED) {
      return mix(s, event)
    }
    if (event === PG_ROW) {
      s = readRow(conn, r, binary, s)
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

/** Binds one group of every parameter kind and queues its Execute and Sync. */
const build = (
  conn: PgConnection,
  binary: boolean,
  round: i32,
  key: u8[],
  ids: i64[],
  names: string[]
): void => {
  if (binary) {
    conn.bindStartBinary("rows")
  } else {
    conn.bindStart("rows")
  }
  conn.paramInt(toI64(round) * toI64(1000003))
  conn.paramText(names[round % toI32(names.length)])
  conn.paramBytes(key, 0, toI32(key.length))
  conn.paramNull()
  conn.paramIntArray(ids, 0, toI32(ids.length))
  conn.paramTextArray(names)
  conn.binaryArrayStart(20)
  for (let k: i32 = 0; k < 8; k++) {
    conn.binaryArrayInt(toI64(round + k))
  }
  conn.binaryArrayNull()
  conn.arrayEnd()
  conn.bindEnd()
  conn.sync()
}

export const main = (): i32 => {
  const n: i32 = 2000 // bench:n
  const conn: PgConnection | null = started()
  if (conn === null) {
    console.log("pg-codec: the startup failed")
    return 1
  }
  const binaryRows: u8[] = rowStream(true)
  const textRows: u8[] = rowStream(false)
  const readers = new Readers(conn)
  const key: u8[] = ascii("a-key-of-some-bytes")
  const ids: i64[] = []
  const names: string[] = []
  for (let k: i32 = 0; k < 16; k++) {
    ids.push(toI64(k) * GOLDEN - toI64(500000))
    names.push(nameOf(k * 5 + 1))
  }
  let sum: u32 = 2166136261
  for (let round: i32 = 0; round < n; round++) {
    build(conn, true, round, key, ids, names)
    sum = drain(conn, sum)
    sum = answer(conn, binaryRows, readers, true, sum)
    build(conn, false, round, key, ids, names)
    sum = drain(conn, sum)
    sum = answer(conn, textRows, readers, false, sum)
  }
  if (conn.failure !== PG_ERR_NONE || conn.binary.failed || conn.text.failed) {
    console.log(`pg-codec: the connection failed (${conn.failure}) or a column did not decode`)
    return 1
  }
  console.log(`${sum}`)
  return 0
}
