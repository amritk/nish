// The TechEmpower database entry (bench/techempower/db-server.ts) against the
// rules TFB's verifier applies to its db, query, update, cached-query and
// fortune tests, over loopback, with a stand-in Postgres and Nish clients in
// the same loop as the server:
//
//   1. /db: 200, one `{"id":n,"randomNumber":m}` object whose number is the
//      stand-in's row for that id; `Server`, `Date` and `application/json`.
//   2. /queries: an array of as many rows as asked, each the stand-in's row;
//      the count clamped as the rules read it: absent, empty, 0, negative,
//      not a number is 1, and over 500 is 500.
//   3. Five clients' /queries in one turn reach the stand-in as fewer
//      executions than requests: keys from every request ride one batch.
//   4. /cached-queries: as many rows as asked, each the row the stand-in held
//      when the table was read at start-up, the count clamped the same way.
//   5. /updates: each row answered carries the number the stand-in now
//      holds for its id, numbers that differ from the rows read before, the
//      update binds each id once, ascending, and the count is clamped like
//      /queries.
//   6. /fortunes: the exact page TFB's verifier expects: the request-time
//      row added, sorted by message, `& < > " '` escaped, the Japanese row
//      byte for byte; `text/html; charset=utf-8`. A second request answers
//      the same page from the reused buffer.
//   7. A batch the stand-in refuses answers 503, and the next request is
//      served again.
//   8. With the carrier full, a request whose keys fail while the rest wait
//      for room answers 503, and its slot's next request, a cached one while
//      the table loads, is answered once: every slot comes back once.
//   9. Every statement the entry prepares is the SQL it names, word for
//      word, and header values match exactly, `Date` in its RFC 9110 form.
import { copyBytes } from "nish/bytes"
import { PgConfig, PgPool, pgTarget } from "nish/net/postgres"
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollRemove,
  pollWait,
  tcpAccept,
  tcpConnect,
  tcpListen,
} from "nish:net"
import { secret, wipe } from "nish:secret"
import { TFB_QUERY_ROOM, TfbDb } from "../../../bench/techempower/db-server"

const ZERO: i32 = 0
const AGAIN: i32 = -11
const FIVE_SECONDS: i64 = 5000000000
const ROWS: i32 = 10000
/** The entry's connection slots. */
const SLOTS: i32 = 64

/** The statements the entry binds, by name; 0 for any other. */
const KIND_OTHER: i32 = 0
const KIND_WORLD: i32 = 1
const KIND_FORTUNE: i32 = 2
const KIND_CACHE: i32 = 3
const KIND_UPDATE: i32 = 4

const ascii = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(text.length)
  for (let k: i32 = 0; k < toI32(text.length) && k < toI32(out.length); k++) {
    out[k] = toU8(text.charCodeAt(k))
  }
  return out
}

/** Whether `buf[at ..)` holds `name` and then a NUL. */
const cstrIs = (buf: u8[], at: i32, end: i32, name: u8[]): boolean => {
  const n: i32 = toI32(name.length)
  if (at < 0 || at + n >= end || end > toI32(buf.length)) {
    return false
  }
  for (let k: i32 = 0; k < n; k++) {
    if (buf[at + k] !== name[k]) {
      return false
    }
  }
  return toI32(buf[at + n]) === 0
}

/** Where the NUL ending the string at `at` is, or `end`. */
const cstrEnd = (buf: u8[], at: i32, end: i32): i32 => {
  let k: i32 = at
  while (k >= 0 && k < end && k < toI32(buf.length) && toI32(buf[k]) !== 0) {
    k += 1
  }
  return k
}

const be32 = (buf: u8[], at: i32): i32 =>
  (toI32(buf[at]) << 24) | (toI32(buf[at + 1]) << 16) | (toI32(buf[at + 2]) << 8) | toI32(buf[at + 3])

const be16 = (buf: u8[], at: i32): i32 => (toI32(buf[at]) << 8) | toI32(buf[at + 1])

/** The integers of the text array literal `buf[0, len)`, `{1,2,3}`, into `out`; answers how many. */
const intArray = (buf: u8[], len: i32, out: i32[]): i32 => {
  let n: i32 = 0
  let v: i32 = 0
  let any: boolean = false
  for (let k: i32 = 0; k < len; k++) {
    const d: i32 = toI32(buf[k])
    if (d >= 48 && d <= 57) {
      v = v * 10 + d - 48
      any = true
    } else if ((d === 44 || d === 125) && any && n < toI32(out.length)) {
      out[n] = v
      n += 1
      v = 0
      any = false
    }
  }
  return n
}

/** One connection the stand-in accepted: what it read and has to write, and its bound statement. */
class BackendConn {
  input: u8[]
  output: u8[]
  param: u8[]
  param2: u8[]
  fd: i32 = -1
  inLen: i32 = 0
  outStart: i32 = 0
  outLen: i32 = 0
  lenAt: i32 = 0
  colAt: i32 = 0
  paramLen: i32 = 0
  param2Len: i32 = 0
  kind: i32 = 0
  started: boolean = false
  /** After an ErrorResponse: messages up to the next Sync are skipped, as a server does. */
  skipping: boolean = false

  constructor() {
    this.input = new Array<u8>(65536)
    this.output = new Array<u8>(1048576)
    this.param = new Array<u8>(16384)
    this.param2 = new Array<u8>(16384)
  }

  byte(b: i32): void {
    this.output[this.outLen] = toU8(b & 255)
    this.outLen += 1
  }

  int16(v: i32): void {
    this.byte(v >> 8)
    this.byte(v)
  }

  int32(v: i32): void {
    this.byte(v >> 24)
    this.byte(v >> 16)
    this.byte(v >> 8)
    this.byte(v)
  }

  setInt32(at: i32, v: i32): void {
    this.output[at] = toU8((v >> 24) & 255)
    this.output[at + 1] = toU8((v >> 16) & 255)
    this.output[at + 2] = toU8((v >> 8) & 255)
    this.output[at + 3] = toU8(v & 255)
  }

  begin(type: i32): void {
    this.byte(type)
    this.lenAt = this.outLen
    this.int32(ZERO)
  }

  end(): void {
    this.setInt32(this.lenAt, this.outLen - this.lenAt)
  }

  text(s: u8[]): void {
    for (let k: i32 = 0; k < toI32(s.length); k++) {
      this.byte(toI32(s[k]))
    }
  }

  digits(n: i32): void {
    if (n >= 10) {
      this.digits(n / 10)
    }
    this.byte(48 + (n % 10))
  }

  /** A DataRow of `columns` columns, each written by `intColumn` or `textColumn`, then `end()`. */
  row(columns: i32): void {
    this.begin(68)
    this.int16(columns)
  }

  intColumn(v: i32): void {
    const at: i32 = this.outLen
    this.int32(ZERO)
    this.digits(v)
    this.setInt32(at, this.outLen - at - 4)
  }

  textColumn(s: u8[]): void {
    this.int32(toI32(s.length))
    this.text(s)
  }

  /** An ErrorResponse: serialization_failure. */
  error(): void {
    this.begin(69)
    this.byte(83)
    this.text(ascii("ERROR"))
    this.byte(0)
    this.byte(86)
    this.text(ascii("ERROR"))
    this.byte(0)
    this.byte(67)
    this.text(ascii("40001"))
    this.byte(0)
    this.byte(77)
    this.text(ascii("could not serialize access"))
    this.byte(0)
    this.byte(0)
    this.end()
    this.skipping = true
  }

  /** A CommandComplete `<tag> n`. */
  complete(tag: string, n: i32): void {
    this.begin(67)
    this.text(ascii(tag))
    this.byte(32)
    this.digits(n)
    this.byte(0)
    this.end()
  }
}

/** The stand-in server: a listener, the connections it accepted, and the World and Fortune tables. */
class Backend {
  conns: BackendConn[]
  names: u8[][]
  peer: u8[]
  /** `world[id]` is that row's randomNumber. */
  world: i32[]
  fortunes: u8[][]
  keys: i32[]
  values: i32[]
  listener: i32
  port: i32
  /** Executions of the World batch, and the most keys one carried. */
  batches: i32 = 0
  mostKeys: i32 = 0
  /** Updates executed, rows they wrote, and whether any bound an id twice or out of order. */
  updates: i32 = 0
  updated: i32 = 0
  unordered: boolean = false
  /** Whether the next World batch is refused. */
  refuseWorld: boolean = false
  /** Whether every read of the whole table is refused. */
  refuseCache: boolean = false
  /** The SQL each statement in `names` must be prepared with. */
  sql: u8[][]
  /** Statements prepared, and how many named one of `names` with other SQL or named none. */
  parsed: i32 = 0
  wrongSql: i32 = 0

  constructor() {
    this.listener = tcpListen("127.0.0.1", 0, 16)
    this.port = netLocalPort(this.listener)
    this.conns = []
    for (let k: i32 = 0; k < 8; k++) {
      this.conns.push(new BackendConn())
    }
    this.names = [ascii("world"), ascii("fortune"), ascii("cache"), ascii("update")]
    this.sql = [
      ascii(
        "select t.*, q.ord from unnest($1::int8[]) with ordinality as q(key, ord) cross join lateral (select id, randomnumber from world where id = q.key) as t order by q.ord"
      ),
      ascii("select id, message from fortune"),
      ascii("select id, randomnumber from world"),
      ascii(
        "update world set randomnumber = v.r from (select unnest($1::int8[]) as id, unnest($2::int8[]) as r) as v where world.id = v.id"
      ),
    ]
    this.peer = new Array<u8>(32)
    this.world = new Array<i32>(ROWS + 1)
    for (let id: i32 = 1; id <= ROWS; id++) {
      this.world[id] = ((id * 7919) % ROWS) + 1
    }
    this.fortunes = [
      ascii("fortune: No such file or directory"),
      ascii("A computer scientist is someone who fixes things that aren't broken."),
      ascii("After enough decimal places, nobody gives a damn."),
      ascii("A bad random number generator: 1, 1, 1, 1, 1, 4.33e+67, 1, 1, 1"),
      ascii("A computer program does what you tell it to do, not what you want it to do."),
      ascii("Emacs is a nice operating system, but I prefer UNIX. — Tom Christaensen"),
      ascii("Any program that runs right is obsolete."),
      ascii("A list is only as strong as its weakest link. — Donald Knuth"),
      ascii("Feature: A bug with seniority."),
      ascii("Computers make very fast, very accurate mistakes."),
      ascii('<script>alert("This should not be displayed in a browser alert box.");</script>'),
      ascii("フレームワークのベンチマーク"),
      ascii("Fortune & Co: fish & chips."),
    ]
    this.keys = new Array<i32>(4096)
    this.values = new Array<i32>(4096)
  }

  serve(): void {
    let fd: i32 = tcpAccept(this.listener, this.peer)
    while (fd >= 0) {
      let placed: boolean = false
      for (let k: i32 = 0; k < toI32(this.conns.length) && !placed; k++) {
        const c: BackendConn = this.conns[k]
        if (c.fd < 0) {
          c.fd = fd
          c.inLen = 0
          c.outStart = 0
          c.outLen = 0
          c.started = false
          c.skipping = false
          placed = true
        }
      }
      if (!placed) {
        netClose(fd)
      }
      fd = tcpAccept(this.listener, this.peer)
    }
    for (let k: i32 = 0; k < toI32(this.conns.length); k++) {
      const c: BackendConn = this.conns[k]
      if (c.fd < 0) {
        continue
      }
      const got: i32 = netRead(c.fd, c.input, c.inLen, toI32(c.input.length) - c.inLen)
      if (got === 0 || (got < 0 && got !== AGAIN)) {
        netClose(c.fd)
        c.fd = -1
        continue
      }
      if (got > 0) {
        c.inLen += got
      }
      this.process(c)
      while (c.fd >= 0 && c.outLen > c.outStart) {
        const n: i32 = netWrite(c.fd, c.output, c.outStart, c.outLen - c.outStart)
        if (n <= 0) {
          break
        }
        c.outStart += n
      }
      if (c.outStart === c.outLen) {
        c.outStart = 0
        c.outLen = 0
      }
    }
  }

  kindOf(buf: u8[], at: i32, end: i32): i32 {
    for (let k: i32 = 0; k < toI32(this.names.length); k++) {
      if (cstrIs(buf, at, end, this.names[k])) {
        return k + 1
      }
    }
    return KIND_OTHER
  }

  /** Copies the parameter at `buf[p ..)` into `out`; answers where the next one starts and its length in `c.paramLen`. */
  param(c: BackendConn, buf: u8[], p: i32, out: u8[], second: boolean): i32 {
    const len: i32 = be32(buf, p)
    let n: i32 = 0
    if (len > 0 && len <= toI32(out.length)) {
      copyBytes(out, ZERO, buf, p + 4, len)
      n = len
    }
    if (second) {
      c.param2Len = n
    } else {
      c.paramLen = n
    }
    return p + 4 + (len > 0 ? len : 0)
  }

  /** Answers every whole message `c` read. */
  process(c: BackendConn): void {
    const input: u8[] = c.input
    let at: i32 = 0
    if (!c.started) {
      if (c.inLen < 4 || c.inLen < be32(input, ZERO)) {
        return
      }
      at = be32(input, ZERO)
      c.started = true
      c.begin(82)
      c.int32(ZERO)
      c.end()
      c.begin(83)
      c.text(ascii("client_encoding"))
      c.byte(0)
      c.text(ascii("UTF8"))
      c.byte(0)
      c.end()
      c.begin(75)
      c.int32(toI32(4242))
      c.int32(toI32(7))
      c.end()
      c.begin(90)
      c.byte(73)
      c.end()
    }
    while (c.fd >= 0 && c.inLen - at >= 5 && at >= 0 && at < toI32(input.length)) {
      const type: i32 = toI32(input[at])
      const end: i32 = at + 1 + be32(input, at + 1)
      if (end > c.inLen) {
        break
      }
      const body: i32 = at + 5
      if (c.skipping && type !== 83) {
        at = end
        continue
      }
      if (type === 80) {
        // Parse: the statement's SQL must be the one its name stands for.
        const query: i32 = cstrEnd(input, body, end) + 1
        const kind: i32 = this.kindOf(input, body, end)
        this.parsed += 1
        if (kind === KIND_OTHER || !cstrIs(input, query, end, this.sql[kind - 1])) {
          this.wrongSql += 1
        }
        c.begin(49)
        c.end()
      } else if (type === 68) {
        // Describe: no parameters, and NoData.
        c.begin(116)
        c.int16(ZERO)
        c.end()
        c.begin(110)
        c.end()
      } else if (type === 66) {
        // Bind: the statement and its first two parameters.
        const stmt: i32 = cstrEnd(input, body, end) + 1
        c.kind = this.kindOf(input, stmt, end)
        let p: i32 = cstrEnd(input, stmt, end) + 1
        p += 2 + 2 * be16(input, p)
        const params: i32 = be16(input, p)
        p += 2
        c.paramLen = 0
        c.param2Len = 0
        if (params > 0) {
          p = this.param(c, input, p, c.param, false)
        }
        if (params > 1) {
          p = this.param(c, input, p, c.param2, true)
        }
        c.begin(50)
        c.end()
      } else if (type === 69) {
        // Execute
        if (c.kind === KIND_WORLD && this.refuseWorld) {
          this.refuseWorld = false
          c.error()
        } else if (c.kind === KIND_CACHE && this.refuseCache) {
          c.error()
        } else {
          this.execute(c)
        }
      } else if (type === 83) {
        // Sync
        c.skipping = false
        c.begin(90)
        c.byte(73)
        c.end()
      } else if (type === 88) {
        netClose(c.fd)
        c.fd = -1
        return
      }
      at = end
    }
    if (at > 0) {
      copyBytes(input, ZERO, input, at, c.inLen - at)
      c.inLen -= at
    }
  }

  execute(c: BackendConn): void {
    if (c.kind === KIND_WORLD) {
      // `select t.*, q.ord ...`: id, randomNumber, ordinal for each key in the table.
      const n: i32 = intArray(c.param, c.paramLen, this.keys)
      let rows: i32 = 0
      for (let k: i32 = 0; k < n; k++) {
        const id: i32 = this.keys[k]
        if (id >= 1 && id <= ROWS) {
          c.row(toI32(3))
          c.intColumn(id)
          c.intColumn(this.world[id])
          c.intColumn(k + 1)
          c.end()
          rows += 1
        }
      }
      this.batches += 1
      if (n > this.mostKeys) {
        this.mostKeys = n
      }
      c.complete("SELECT", rows)
    } else if (c.kind === KIND_CACHE) {
      for (let id: i32 = 1; id <= ROWS; id++) {
        c.row(toI32(2))
        c.intColumn(id)
        c.intColumn(this.world[id])
        c.end()
      }
      c.complete("SELECT", ROWS)
    } else if (c.kind === KIND_FORTUNE) {
      for (let k: i32 = 0; k < toI32(this.fortunes.length); k++) {
        c.row(toI32(2))
        c.intColumn(k + 1)
        c.textColumn(this.fortunes[k])
        c.end()
      }
      c.complete("SELECT", toI32(this.fortunes.length))
    } else if (c.kind === KIND_UPDATE) {
      const n: i32 = intArray(c.param, c.paramLen, this.keys)
      const m: i32 = intArray(c.param2, c.param2Len, this.values)
      if (n !== m) {
        this.unordered = true
      }
      for (let k: i32 = 0; k < n && k < m; k++) {
        if (k > 0 && this.keys[k] <= this.keys[k - 1]) {
          this.unordered = true
        }
        const id: i32 = this.keys[k]
        if (id >= 1 && id <= ROWS) {
          this.world[id] = this.values[k]
        }
      }
      this.updates += 1
      this.updated += n
      c.complete("UPDATE 0", n)
    } else {
      c.complete("SELECT", ZERO)
    }
  }
}

/** The server half: the entry, its pool, and the stand-in it talks to. */
class App {
  db: TfbDb
  pool: PgPool
  backend: Backend
  headEnd: u8[]
  contentLength: u8[]
  port: i32 = 0
  failures: i32 = 0
  /** The stand-in's World table as the entry read it at start-up. */
  snapshot: i32[]

  /** `queries` is the carrier's room: `TFB_QUERY_ROOM`, or fewer to fill it. */
  constructor(queries: i32) {
    const listener: i32 = tcpListen("127.0.0.1", 0, 64)
    this.port = netLocalPort(listener)
    this.backend = new Backend()
    this.snapshot = new Array<i32>(ROWS + 1)
    for (let id: i32 = 1; id <= ROWS; id++) {
      this.snapshot[id] = this.backend.world[id]
    }
    const config = new PgConfig()
    config.user = "app"
    config.database = "db"
    const password = secret(ascii("pw"))
    this.pool = new PgPool(config, password, toI32(2), toI32(1024))
    wipe(password)
    this.db = new TfbDb(listener, SLOTS, this.pool, pgTarget("127.0.0.1", this.backend.port), queries)
    this.headEnd = ascii("\r\n\r\n")
    this.contentLength = ascii("content-length: ")
  }

  turn(): void {
    this.backend.serve()
    this.db.turn(toI32(1))
  }
}

/** A client: its socket and what it has read and not yet consumed. */
class Client {
  fd: i32 = -1
  buf: u8[]
  length: i32 = 0
  status: i32 = 0
  headEnd: i32 = 0
  bodyStart: i32 = 0
  bodyLength: i32 = 0
  responseLength: i32 = 0
  closed: boolean = false

  constructor() {
    this.buf = new Array<u8>(65536)
  }
}

/** Where `text`, in lower case, first appears in `buf[from .. end)` in any case, or -1. */
const find = (buf: u8[], from: i32, end: i32, text: u8[]): i32 => {
  const n: i32 = toI32(text.length)
  for (let at: i32 = from; at + n <= end; at++) {
    let k: i32 = 0
    while (k < n && (toI32(buf[at + k]) | (toI32(text[k]) >= 97 ? 32 : 0)) === toI32(text[k])) {
      k += 1
    }
    if (k === n) {
      return at
    }
  }
  return -1
}

const STATUS_AT: i32 = 9

/** The decimal at `buf[at ..)`. */
const decimal = (buf: u8[], at: i32, end: i32): i32 => {
  let n: i32 = 0
  let k: i32 = at
  while (k >= 0 && k < end && k < toI32(buf.length) && toI32(buf[k]) >= 48 && toI32(buf[k]) <= 57) {
    n = n * 10 + toI32(buf[k]) - 48
    k += 1
  }
  return n
}

const connect = (app: App): Client => {
  const c = new Client()
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", app.port)
  c.fd = tcpConnect(addr)
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(2)
  pollAdd(loop, c.fd, 2, ZERO)
  if (pollWait(loop, ready, 5000) !== 1 || connectResult(c.fd) !== 0) {
    panic("connect failed")
  }
  pollRemove(loop, c.fd)
  netClose(loop)
  return c
}

/** Sends all of `bytes`, turning the app while the socket is full. */
const sendAll = (app: App, c: Client, bytes: u8[]): void => {
  let at: i32 = 0
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (at < toI32(bytes.length) && monotonicNanos() < deadline) {
    const n: i32 = netWrite(c.fd, bytes, at, toI32(bytes.length) - at)
    if (n > 0) {
      at += n
    } else {
      app.turn()
    }
  }
}

/** Reads what has arrived. */
const pull = (c: Client): void => {
  const room: i32 = toI32(c.buf.length) - c.length
  if (room <= 0) {
    return
  }
  const n: i32 = netRead(c.fd, c.buf, c.length, room)
  if (n > 0) {
    c.length += n
  } else if (n === 0) {
    c.closed = true
  }
}

/** Whether a whole response has arrived; with its status and body in `c` when so. */
const whole = (app: App, c: Client): boolean => {
  const headEnd: i32 = find(c.buf, ZERO, c.length, app.headEnd)
  if (headEnd < 0) {
    return false
  }
  const at: i32 = find(c.buf, ZERO, headEnd, app.contentLength)
  const length: i32 = at < 0 ? 0 : decimal(c.buf, at + toI32(app.contentLength.length), headEnd)
  if (c.length - headEnd - 4 < length) {
    return false
  }
  c.status = decimal(c.buf, STATUS_AT, headEnd)
  c.headEnd = headEnd
  c.bodyStart = headEnd + 4
  c.bodyLength = length
  c.responseLength = headEnd + 4 + length
  return true
}

/** Reads one response, turning the app until it is whole or five seconds pass. */
const response = (app: App, c: Client): boolean => {
  if (c.responseLength > 0) {
    copyBytes(c.buf, ZERO, c.buf, c.responseLength, c.length - c.responseLength)
    c.length -= c.responseLength
    c.responseLength = 0
  }
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (monotonicNanos() < deadline && !c.closed) {
    if (whole(app, c)) {
      return true
    }
    app.turn()
    pull(c)
  }
  return whole(app, c)
}

/** Sends `GET path` on `c` and reads its answer. */
const get = (app: App, c: Client, path: string): boolean => {
  sendAll(app, c, ascii(`GET ${path} HTTP/1.1\r\nHost: t\r\n\r\n`))
  return response(app, c)
}

const check = (app: App, name: string, ok: boolean): void => {
  if (ok) {
    console.log(`PASS  ${name}`)
  } else {
    console.log(`FAIL  ${name}`)
    app.failures += 1
  }
}

/** Where the value of header `name` (lower case; its name matched in any case) starts in the last head, or -1. */
const valueAt = (c: Client, name: string): i32 => {
  const label: u8[] = ascii(`\r\n${name}: `)
  const at: i32 = find(c.buf, ZERO, c.headEnd, label)
  return at < 0 ? -1 : at + toI32(label.length)
}

/** Whether the last head holds header `name` with exactly the value `value`: the name in any case, the value byte for byte. */
const header = (c: Client, name: string, value: string): boolean => {
  const at: i32 = valueAt(c, name)
  const v: u8[] = ascii(`${value}\r\n`)
  if (at < 0 || at + toI32(v.length) > c.headEnd + 2) {
    return false
  }
  for (let k: i32 = 0; k < toI32(v.length); k++) {
    if (c.buf[at + k] !== v[k]) {
      return false
    }
  }
  return true
}

/** Whether `buf[at, at + n)` is all ASCII digits. */
const digitsAt = (buf: u8[], at: i32, n: i32): boolean => {
  for (let k: i32 = 0; k < n; k++) {
    if (toI32(buf[at + k]) < 48 || toI32(buf[at + k]) > 57) {
      return false
    }
  }
  return true
}

/** Whether `buf[at, at + 3)` is one of the three-letter names in `names`, byte for byte. */
const nameAt = (buf: u8[], at: i32, names: string): boolean => {
  const list: u8[] = ascii(names)
  for (let n: i32 = 0; n + 3 <= toI32(list.length); n += 3) {
    if (buf[at] === list[n] && buf[at + 1] === list[n + 1] && buf[at + 2] === list[n + 2]) {
      return true
    }
  }
  return false
}

/** Whether the last head's `Date` is an RFC 9110 IMF-fixdate, `Sun, 06 Nov 1994 08:49:37 GMT`, and its line ends there. */
const dated = (c: Client): boolean => {
  const at: i32 = valueAt(c, "date")
  if (at < 0 || at + 31 > c.headEnd + 2) {
    return false
  }
  const b: u8[] = c.buf
  // `0` is any digit; the day and month names are checked after.
  const shape: u8[] = ascii("Www, 00 Mmm 0000 00:00:00 GMT\r\n")
  for (let k: i32 = 0; k < toI32(shape.length); k++) {
    const want: i32 = toI32(shape[k])
    const got: i32 = toI32(b[at + k])
    const name: boolean = k < 3 || (k >= 8 && k <= 10)
    if (!name && (want === 48 ? got < 48 || got > 57 : got !== want)) {
      return false
    }
  }
  return nameAt(b, at, "MonTueWedThuFriSatSun") && nameAt(b, at + 8, "JanFebMarAprMayJunJulAugSepOctNovDec")
}

/** Whether the head carries `Server: nish`, a well-formed `Date` and `Content-Type: type`. */
const headers = (c: Client, type: string): boolean =>
  header(c, "server", "nish") && dated(c) && header(c, "content-type", type)

/**
 * The rows of the last JSON body, `{"id":n,"randomNumber":m}` each, into
 * `ids` and `numbers`; answers how many, or -1 when the body is not exactly
 * that shape: one object when `array` is false, else an array of them.
 */
const worlds = (c: Client, array: boolean, ids: i32[], numbers: i32[]): i32 => {
  const b: u8[] = c.buf
  const end: i32 = c.bodyStart + c.bodyLength
  const open: u8[] = ascii('{"id":')
  const middle: u8[] = ascii(',"randomNumber":')
  let at: i32 = c.bodyStart
  if (array) {
    if (at >= end || toI32(b[at]) !== 91) {
      return -1
    }
    at += 1
  }
  let n: i32 = 0
  while (at < end) {
    if (find(b, at, at + toI32(open.length), open) !== at) {
      return -1
    }
    at += toI32(open.length)
    const idStart: i32 = at
    const id: i32 = decimal(b, at, end)
    while (at < end && toI32(b[at]) >= 48 && toI32(b[at]) <= 57) {
      at += 1
    }
    if (at === idStart || find(b, at, at + toI32(middle.length), middle) !== at) {
      return -1
    }
    at += toI32(middle.length)
    const numberStart: i32 = at
    const number: i32 = decimal(b, at, end)
    while (at < end && toI32(b[at]) >= 48 && toI32(b[at]) <= 57) {
      at += 1
    }
    if (at === numberStart || at >= end || toI32(b[at]) !== 125 || n >= toI32(ids.length)) {
      return -1
    }
    ids[n] = id
    numbers[n] = number
    n += 1
    at += 1
    if (!array) {
      return at === end ? n : -1
    }
    if (at < end && toI32(b[at]) === 44) {
      at += 1
    } else if (at < end && toI32(b[at]) === 93) {
      return at + 1 === end ? n : -1
    } else {
      return -1
    }
  }
  return -1
}

/** Whether rows `[0, n)` are each the stand-in's row in `table`, every id 1 to 10000. */
const rowsMatch = (table: i32[], ids: i32[], numbers: i32[], n: i32): boolean => {
  for (let k: i32 = 0; k < n; k++) {
    if (ids[k] < 1 || ids[k] > ROWS || table[ids[k]] !== numbers[k]) {
      return false
    }
  }
  return true
}

/** How many rows `path` answers with, each checked against `table`; -1 when any is wrong or the answer is not a 200 JSON array. */
const count = (app: App, c: Client, path: string, table: i32[], ids: i32[], numbers: i32[]): i32 => {
  if (!get(app, c, path) || c.status !== 200 || !headers(c, "application/json")) {
    return -1
  }
  const n: i32 = worlds(c, true, ids, numbers)
  return n >= 0 && rowsMatch(table, ids, numbers, n) ? n : -1
}

const single = (app: App, ids: i32[], numbers: i32[]): void => {
  const c: Client = connect(app)
  const ok: boolean = get(app, c, "/db") && c.status === 200
  check(app, "/db answers 200", ok)
  check(app, "/db carries Server, Date and application/json", ok && headers(c, "application/json"))
  const n: i32 = ok ? worlds(c, false, ids, numbers) : -1
  check(app, "/db is one {id, randomNumber} object", n === 1)
  check(app, "/db's number is the row's", n === 1 && rowsMatch(app.backend.world, ids, numbers, n))
  netClose(c.fd)
}

const queries = (app: App, ids: i32[], numbers: i32[]): void => {
  const c: Client = connect(app)
  const w: i32[] = app.backend.world
  check(app, "/queries?queries=20 answers 20 rows, each the row's", count(app, c, "/queries?queries=20", w, ids, numbers) === 20)
  check(app, "a query with no count answers 1 row", count(app, c, "/queries", w, ids, numbers) === 1)
  check(app, "an empty count answers 1 row", count(app, c, "/queries?queries=", w, ids, numbers) === 1)
  check(app, "a count of 0 answers 1 row", count(app, c, "/queries?queries=0", w, ids, numbers) === 1)
  check(app, "a negative count answers 1 row", count(app, c, "/queries?queries=-5", w, ids, numbers) === 1)
  check(app, "a count that is not a number answers 1 row", count(app, c, "/queries?queries=foo", w, ids, numbers) === 1)
  check(app, "a count of 500 answers 500 rows", count(app, c, "/queries?queries=500", w, ids, numbers) === 500)
  check(app, "a count of 501 answers 500 rows", count(app, c, "/queries?queries=501", w, ids, numbers) === 500)
  check(
    app,
    "a count past i32 answers 500 rows",
    count(app, c, "/queries?queries=99999999999999", w, ids, numbers) === 500
  )
  netClose(c.fd)
}

/** Five clients' requests in one turn: their keys ride fewer executions than there are requests. */
const batching = (app: App, ids: i32[], numbers: i32[]): void => {
  const cs: Client[] = []
  for (let k: i32 = 0; k < 5; k++) {
    cs.push(connect(app))
  }
  const before: i32 = app.backend.batches
  app.backend.mostKeys = 0
  const request: u8[] = ascii("GET /queries?queries=20 HTTP/1.1\r\nHost: t\r\n\r\n")
  for (const c of cs) {
    sendAll(app, c, request)
  }
  let answered: i32 = 0
  for (const c of cs) {
    if (response(app, c) && c.status === 200 && worlds(c, true, ids, numbers) === 20) {
      if (rowsMatch(app.backend.world, ids, numbers, toI32(20))) {
        answered += 1
      }
    }
  }
  check(app, "five clients' 20 rows each are answered", answered === 5)
  check(app, "their 100 keys ride fewer executions than five", app.backend.batches - before < 5)
  check(app, "one execution carries keys of more than one request", app.backend.mostKeys > 20)
  for (const c of cs) {
    netClose(c.fd)
  }
}

const cached = (app: App, ids: i32[], numbers: i32[]): void => {
  const c: Client = connect(app)
  const s: i32[] = app.snapshot
  const before: i32 = app.backend.batches
  check(app, "/cached-queries?count=10 answers 10 rows, each the row's", count(app, c, "/cached-queries?count=10", s, ids, numbers) === 10)
  check(app, "a cached query with no count answers 1 row", count(app, c, "/cached-queries", s, ids, numbers) === 1)
  check(app, "a cached count of 0 answers 1 row", count(app, c, "/cached-queries?count=0", s, ids, numbers) === 1)
  check(app, "a cached count that is not a number answers 1 row", count(app, c, "/cached-queries?count=x1", s, ids, numbers) === 1)
  check(app, "a cached count of 501 answers 500 rows", count(app, c, "/cached-queries?count=501", s, ids, numbers) === 500)
  check(app, "a cached query reads no row from the database", app.backend.batches === before)
  netClose(c.fd)
}

const updates = (app: App, ids: i32[], numbers: i32[]): void => {
  const c: Client = connect(app)
  const w: i32[] = app.backend.world
  const prior: i32[] = new Array<i32>(ROWS + 1)
  for (let id: i32 = 1; id <= ROWS; id++) {
    prior[id] = w[id]
  }
  const before: i32 = app.backend.updates
  check(app, "/updates?queries=20 answers 20 rows, each the row as written", count(app, c, "/updates?queries=20", w, ids, numbers) === 20)
  check(app, "the update is one statement", app.backend.updates === before + 1)
  // A fresh number per row: one equals the row's old number once in 10000, so 20 all equal never passes.
  let changed: i32 = 0
  let inRange: boolean = true
  for (let k: i32 = 0; k < 20; k++) {
    if (numbers[k] !== prior[ids[k]]) {
      changed += 1
    }
    if (numbers[k] < 1 || numbers[k] > ROWS) {
      inRange = false
    }
  }
  check(app, "the rows written carry new numbers, not the ones read", changed > 0)
  check(app, "every number written is 1 to 10000", inRange)
  let table: boolean = true
  for (let id: i32 = 1; id <= ROWS; id++) {
    let answered: boolean = false
    for (let k: i32 = 0; k < 20; k++) {
      if (ids[k] === id) {
        answered = true
      }
    }
    if (!answered && w[id] !== prior[id]) {
      table = false
    }
  }
  check(app, "no row the update did not answer changed", table)
  check(app, "an update with no count answers 1 row", count(app, c, "/updates", w, ids, numbers) === 1)
  check(app, "an empty update count answers 1 row", count(app, c, "/updates?queries=", w, ids, numbers) === 1)
  check(app, "an update count of 0 answers 1 row", count(app, c, "/updates?queries=0", w, ids, numbers) === 1)
  check(app, "a negative update count answers 1 row", count(app, c, "/updates?queries=-3", w, ids, numbers) === 1)
  check(app, "an update count that is not a number answers 1 row", count(app, c, "/updates?queries=bar", w, ids, numbers) === 1)
  check(app, "an update count of 501 answers 500 rows", count(app, c, "/updates?queries=501", w, ids, numbers) === 500)
  check(app, "every update binds each id once, ascending", !app.backend.unordered && app.backend.updates === before + 7)
  // 500 random ids of 10000 repeat one almost surely; the rows that share an id share its number.
  let shared: boolean = true
  for (let k: i32 = 0; k < 500; k++) {
    for (let m: i32 = k + 1; m < 500; m++) {
      if (ids[k] === ids[m] && numbers[k] !== numbers[m]) {
        shared = false
      }
    }
  }
  check(app, "rows that share an id answer the one number written", shared)
  netClose(c.fd)
}

/** The page TFB's verifier expects, its rows sorted by message; row 13 carries the `&` its rows lack. */
const FORTUNES: string =
  "<!DOCTYPE html><html><head><title>Fortunes</title></head><body><table><tr><th>id</th><th>message</th></tr>" +
  "<tr><td>11</td><td>&lt;script&gt;alert(&quot;This should not be displayed in a browser alert box.&quot;);&lt;/script&gt;</td></tr>" +
  "<tr><td>4</td><td>A bad random number generator: 1, 1, 1, 1, 1, 4.33e+67, 1, 1, 1</td></tr>" +
  "<tr><td>5</td><td>A computer program does what you tell it to do, not what you want it to do.</td></tr>" +
  "<tr><td>2</td><td>A computer scientist is someone who fixes things that aren&#39;t broken.</td></tr>" +
  "<tr><td>8</td><td>A list is only as strong as its weakest link. — Donald Knuth</td></tr>" +
  "<tr><td>0</td><td>Additional fortune added at request time.</td></tr>" +
  "<tr><td>3</td><td>After enough decimal places, nobody gives a damn.</td></tr>" +
  "<tr><td>7</td><td>Any program that runs right is obsolete.</td></tr>" +
  "<tr><td>10</td><td>Computers make very fast, very accurate mistakes.</td></tr>" +
  "<tr><td>6</td><td>Emacs is a nice operating system, but I prefer UNIX. — Tom Christaensen</td></tr>" +
  "<tr><td>9</td><td>Feature: A bug with seniority.</td></tr>" +
  "<tr><td>13</td><td>Fortune &amp; Co: fish &amp; chips.</td></tr>" +
  "<tr><td>1</td><td>fortune: No such file or directory</td></tr>" +
  "<tr><td>12</td><td>フレームワークのベンチマーク</td></tr>" +
  "</table></body></html>"

/** Whether the last body is `expected`, byte for byte. */
const body = (c: Client, expected: u8[]): boolean => {
  if (c.bodyLength !== toI32(expected.length)) {
    return false
  }
  for (let k: i32 = 0; k < c.bodyLength && k < toI32(expected.length); k++) {
    if (c.buf[c.bodyStart + k] !== expected[k]) {
      return false
    }
  }
  return true
}

const fortunes = (app: App): void => {
  const c: Client = connect(app)
  const page: u8[] = ascii(FORTUNES)
  const ok: boolean = get(app, c, "/fortunes") && c.status === 200
  check(app, "/fortunes answers 200", ok)
  check(app, "/fortunes carries Server, Date and text/html; charset=utf-8", ok && headers(c, "text/html; charset=utf-8"))
  check(app, "/fortunes is the expected page: the added row, sorted, escaped, the Japanese row untouched", ok && body(c, page))
  const again: boolean = get(app, c, "/fortunes") && c.status === 200 && body(c, page)
  check(app, "a second /fortunes answers the same page from the reused buffer", again)
  netClose(c.fd)
}

/**
 * A second entry with room for 4 queries: a 20-key request fills it and
 * waits for room, its keys fail, and it answers 503 while still waiting.
 * Its slot's next request is a cached one taken while the table loads;
 * it must be answered once, and every slot must come back once.
 */
const stale = (app: App, ids: i32[], numbers: i32[]): void => {
  const full = new App(toI32(4))
  full.backend.refuseCache = true
  full.backend.refuseWorld = true
  const c: Client = connect(full)
  const refused: boolean = get(full, c, "/queries?queries=20") && c.status === 503
  check(app, "keys failing while the rest wait for room answer 503", refused)
  full.backend.refuseCache = false
  const answered: boolean =
    get(full, c, "/cached-queries?count=3") && c.status === 200 && worlds(c, true, ids, numbers) === 3
  check(app, "its slot's next request, cached during warm-up, is answered", answered && rowsMatch(full.snapshot, ids, numbers, toI32(3)))
  for (let k: i32 = 0; k < 20; k++) {
    full.turn()
  }
  check(app, "every slot comes back once", full.db.freeSlots() === SLOTS)
  const again: boolean = get(full, c, "/db") && c.status === 200 && worlds(c, false, ids, numbers) === 1
  check(app, "the entry serves on after", again && full.db.freeSlots() === SLOTS)
  check(app, "the full entry failed only the one request", full.db.failures === 1)
  netClose(c.fd)
}

const refusal = (app: App, ids: i32[], numbers: i32[]): void => {
  const c: Client = connect(app)
  app.backend.refuseWorld = true
  const ok: boolean = get(app, c, "/db")
  check(app, "a refused batch answers 503 with Server", ok && c.status === 503 && header(c, "server", "nish"))
  const next: boolean = get(app, c, "/db") && c.status === 200 && worlds(c, false, ids, numbers) === 1
  check(app, "the next /db is served again", next && rowsMatch(app.backend.world, ids, numbers, toI32(1)))
  netClose(c.fd)
}

export const main = (): i32 => {
  const app = new App(TFB_QUERY_ROOM)
  const ids: i32[] = new Array<i32>(512)
  const numbers: i32[] = new Array<i32>(512)
  single(app, ids, numbers)
  queries(app, ids, numbers)
  batching(app, ids, numbers)
  cached(app, ids, numbers)
  updates(app, ids, numbers)
  fortunes(app)
  refusal(app, ids, numbers)
  check(app, "no query failed but the one refused", app.db.failures === 1)
  check(app, "every slot is free at the end", app.db.freeSlots() === SLOTS)
  stale(app, ids, numbers)
  check(
    app,
    "every statement was prepared with the SQL its name stands for",
    app.backend.parsed >= 4 && app.backend.wrongSql === 0
  )
  return app.failures === 0 ? 0 : 1
}
