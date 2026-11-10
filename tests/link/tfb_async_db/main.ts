// The async TechEmpower database entry (bench/techempower/async-db-server.ts)
// under `serveOn`, against the rules tests/link/tfb_db holds the explicit
// entry to, over loopback: a pool of two connections to the stand-in
// Postgres of backend.ts, and a Nish client, as tasks in the same process.
//
//   1. /db: 200, one `{"id":n,"randomNumber":m}` object whose number is the
//      stand-in's row for that id; `Server: nish`, an IMF-fixdate `Date` and
//      `application/json`.
//   2. /queries: as many rows as asked, each the stand-in's row, the count
//      clamped as the rules read it: absent, empty, 0, negative or not a
//      number is 1, and over 500 is 500. Each request is one World read.
//   3. /cached-queries: as many rows as asked, each the row the stand-in
//      held when the first cached query read the table, the count clamped
//      the same way; the table is read once and no World row is.
//   4. /updates: each row answered carries the number the stand-in now
//      holds for its id, numbers that differ from the rows read, every id
//      bound once, ascending, in one statement a request, and the count is
//      clamped like /queries.
//   5. /fortunes: the exact page TFB's verifier expects: the request-time
//      row added, sorted by message, `& < > " '` escaped, the Japanese row
//      byte for byte; `text/html; charset=utf-8`. A second request answers
//      the same page.
//   6. A World read the stand-in refuses answers 503 with `Server`, and the
//      next request is served again.
//
// tfb_db's batching, slot and prepared-statement checks have no twin: the
// async entry runs one unnamed statement per request on a claimed connection.
// Every request is counted in `ANSWERED`, so `serveOn` stops once the client
// is done.
import { readable, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { secret, wipe } from "nish:secret"
import { PgConfig, pgTarget } from "nish/net/postgres"
import { PgAsyncPool, pgAsyncConnect } from "nish/net/postgres-async"
import { ServeLimits, ServeStats } from "nish/net/serve"
import { Suite } from "nish/testing"
import { TfbAsyncDb, tfbDbLimits, tfbServeDb } from "../../../bench/techempower/async-db-server"
import { Conn, dial, hangUp, headerOf, sendText } from "../net_serve/client"
import { ROWS, Table, standIn } from "./backend"

/** The requests the client sends, each answered once. */
const ANSWERED: i32 = 26
const DAYS: string = "Mon Tue Wed Thu Fri Sat Sun "
const MONTHS: string = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec "

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

/** True when `name` is one of the three-letter names `list` holds, each followed by a space. */
const named = (list: string, name: string): boolean => {
  const at: i32 = toI32(list.indexOf(`${name} `))
  return toI32(name.length) === 3 && at >= 0 && at % 4 === 0
}

/** The decimal number `s` spells, or -1. */
const decimal = (s: string): i32 => {
  if (s.length === 0 || s.length > 9) {
    return -1
  }
  let n: i32 = 0
  for (let k: i32 = 0; k < toI32(s.length); k++) {
    const digit: i32 = toI32(s.charCodeAt(k)) - 48
    if (digit < 0 || digit > 9) {
      return -1
    }
    n = n * 10 + digit
  }
  return n
}

/** True when `s` is an IMF-fixdate (RFC 9110 §5.6.7): `Sun, 06 Nov 1994 08:49:37 GMT`. */
const imfFixdate = (s: string): boolean => {
  if (toI32(s.length) !== 29 || !named(DAYS, s.substring(0, 3)) || !named(MONTHS, s.substring(8, 11))) {
    return false
  }
  const day: i32 = decimal(s.substring(5, 7))
  const hour: i32 = decimal(s.substring(17, 19))
  const minute: i32 = decimal(s.substring(20, 22))
  const second: i32 = decimal(s.substring(23, 25))
  return (
    s.substring(3, 5) === ", " &&
    s.substring(7, 8) === " " &&
    s.substring(11, 12) === " " &&
    decimal(s.substring(12, 16)) >= 0 &&
    s.substring(16, 17) === " " &&
    s.substring(19, 20) === ":" &&
    s.substring(22, 23) === ":" &&
    s.substring(25, 29) === " GMT" &&
    day >= 1 &&
    day <= 31 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 60
  )
}

/** One response as the client reads it: the status, the head with its fields, the body. */
class Answer {
  status: i32 = 0
  head: string = ""
  body: string = ""
  /** The `Content-Length` field, or -1 when there is none. */
  length: i32 = -1

  /** The value of the field `name`, given in lowercase, or empty. */
  field(name: string): string {
    return headerOf(this.head, name)
  }
}

/** Reads more bytes, compacting first; false once the peer has closed. */
const moreBytes = async (c: Conn): Promise<boolean> => {
  if (c.start > 0) {
    for (let i: i32 = c.start; i < c.end; i++) {
      c.buf[i - c.start] = c.buf[i]
    }
    c.end -= c.start
    c.start = 0
  }
  while (true) {
    const n: i32 = netRead(c.fd, c.buf, c.end, toI32(c.buf.length) - c.end)
    if (n === -11) {
      await readable(c.fd)
      continue
    }
    if (n <= 0) {
      c.closed = true
      return false
    }
    c.end += n
    return true
  }
}

/** Where the head at the start of the unread bytes ends, past its blank line; -1 while it has not. */
const answerHeadEnd = (c: Conn): i32 => {
  for (let i: i32 = c.start; i + 3 < c.end; i++) {
    if (c.buf[i] === 13 && c.buf[i + 1] === 10 && c.buf[i + 2] === 13 && c.buf[i + 3] === 10) {
      return i + 4
    }
  }
  return -1
}

/** The answer to `GET path` on `c`; status 0 when the peer closed first. */
const get = async (c: Conn, path: string): Promise<Answer> => {
  await sendText(c, `GET ${path} HTTP/1.1\r\nHost: tfb\r\n\r\n`)
  const a: Answer = new Answer()
  let end: i32 = answerHeadEnd(c)
  while (end < 0) {
    const got: boolean = await moreBytes(c)
    if (!got) {
      return a
    }
    end = answerHeadEnd(c)
  }
  a.head = String.fromBytes(c.buf, c.start, end)
  if (!a.head.startsWith("HTTP/1.1 ") || a.head.length < 12) {
    return a
  }
  const length: string = a.field("content-length")
  a.length = length === "" ? -1 : decimal(length)
  const want: i32 = a.length < 0 ? 0 : a.length
  while (c.end - end < want) {
    const at: i32 = end - c.start
    const got: boolean = await moreBytes(c)
    if (!got) {
      return a
    }
    end = c.start + at
  }
  a.body = String.fromBytes(c.buf, end, end + want)
  a.status = decimal(a.head.substring(9, 12))
  c.start = end + want
  return a
}

/** Whether `a` is a 200 carrying `Server: nish`, an IMF-fixdate `Date` and `type`. */
const headers = (a: Answer, type: string): boolean =>
  a.status === 200 &&
  a.field("server") === "nish" &&
  imfFixdate(a.field("date")) &&
  a.field("content-type") === type &&
  a.length === toI32(a.body.length)

/** The digits of `s` from `at`, as `[value, end]` in `out`; false when there are none. */
const digits = (s: string, at: i32, out: i32[]): boolean => {
  let n: i32 = 0
  let end: i32 = at
  while (end < toI32(s.length) && end - at < 9 && toI32(s.charCodeAt(end)) >= 48 && toI32(s.charCodeAt(end)) <= 57) {
    n = n * 10 + toI32(s.charCodeAt(end)) - 48
    end += 1
  }
  out[0] = n
  out[1] = end
  return end > at
}

/**
 * The `{"id":n,"randomNumber":m}` rows of `s` into `ids` and `numbers`: one
 * object when `array` is false, else an array of them; -1 when `s` is not that
 * shape.
 */
const worlds = (s: string, array: boolean, ids: i32[], numbers: i32[]): i32 => {
  const open: string = '{"id":'
  const middle: string = ',"randomNumber":'
  const got: i32[] = [0, 0]
  const end: i32 = toI32(s.length)
  let at: i32 = 0
  if (array) {
    if (!s.startsWith("[")) {
      return -1
    }
    at = 1
  }
  let n: i32 = 0
  while (at < end && n < toI32(ids.length)) {
    if (s.substring(at, at + toI32(open.length)) !== open || !digits(s, at + toI32(open.length), got)) {
      return -1
    }
    ids[n] = got[0]
    at = got[1]
    if (s.substring(at, at + toI32(middle.length)) !== middle || !digits(s, at + toI32(middle.length), got)) {
      return -1
    }
    numbers[n] = got[0]
    at = got[1]
    if (at >= end || toI32(s.charCodeAt(at)) !== 125) {
      return -1
    }
    n += 1
    at += 1
    if (!array) {
      return at === end ? n : -1
    }
    if (at < end && toI32(s.charCodeAt(at)) === 44) {
      at += 1
    } else if (at < end && toI32(s.charCodeAt(at)) === 93) {
      return at + 1 === end ? n : -1
    } else {
      return -1
    }
  }
  return -1
}

/** Whether rows `[0, n)` are each the row in `table`, every id 1 to 10000. */
const rowsMatch = (table: i32[], ids: i32[], numbers: i32[], n: i32): boolean => {
  for (let k: i32 = 0; k < n; k++) {
    if (ids[k] < 1 || ids[k] > ROWS || table[ids[k]] !== numbers[k]) {
      return false
    }
  }
  return true
}

/** A copy of the stand-in's table as it is now. */
const snapshot = (table: Table): i32[] => {
  const s: i32[] = new Array<i32>(ROWS + 1)
  for (let id: i32 = 1; id <= ROWS; id++) {
    s[id] = table.world[id]
  }
  return s
}

/** How many rows `path` answers with, each checked against `rows`; -1 when any is wrong or the answer is not a 200 JSON array. */
const count = async (c: Conn, path: string, table: Table, rows: i32[], ids: i32[], numbers: i32[]): Promise<i32> => {
  const a: Answer = await get(c, path)
  if (!headers(a, "application/json")) {
    return -1
  }
  const n: i32 = worlds(a.body, true, ids, numbers)
  if (n < 0) {
    return -1
  }
  // `rows` is empty for the stand-in's table as it is when the answer arrives.
  const held: i32[] = toI32(rows.length) === 0 ? snapshot(table) : rows
  return rowsMatch(held, ids, numbers, n) ? n : -1
}

/** Ends a client's suite and writes its exit status, 0 or 1, as one byte on `doneFd`. */
const report = (t: Suite, doneFd: i32): void => {
  const code: u8[] = [toU8(t.done())]
  netWrite(doneFd, code, 0, 1)
}

/** The client: every check, in a suite of its own, since a task keeps nothing outside its region. */
const client = async (port: i32, table: Table, doneFd: i32): Promise<void> => {
  const t = new Suite("tfb async db: client")
  const c: Conn = new Conn(65536)
  const dialed: boolean = await dial(c, port)
  t.ok("the client connects", dialed)
  const ids: i32[] = new Array<i32>(512)
  const numbers: i32[] = new Array<i32>(512)
  const now: i32[] = []

  // --- 1. /db -----------------------------------------------------------------------------------
  const single: Answer = await get(c, "/db")
  t.eqI32("/db answers 200", single.status, toI32(200))
  t.ok("/db carries Server, Date and application/json", headers(single, "application/json"))
  const one: i32 = worlds(single.body, false, ids, numbers)
  t.eqI32("/db is one {id, randomNumber} object", one, toI32(1))
  t.ok("/db's number is the row's", one === 1 && rowsMatch(snapshot(table), ids, numbers, one))

  // --- 2. /queries ------------------------------------------------------------------------------
  const reads: i32 = table.worldReads
  const twenty: i32 = await count(c, "/queries?queries=20", table, now, ids, numbers)
  t.eqI32("/queries?queries=20 answers 20 rows, each the row's", twenty, toI32(20))
  t.eqI32("and reads them in one statement", table.worldReads - reads, toI32(1))
  const absent: i32 = await count(c, "/queries", table, now, ids, numbers)
  t.eqI32("a query with no count answers 1 row", absent, toI32(1))
  const empty: i32 = await count(c, "/queries?queries=", table, now, ids, numbers)
  t.eqI32("an empty count answers 1 row", empty, toI32(1))
  const zero: i32 = await count(c, "/queries?queries=0", table, now, ids, numbers)
  t.eqI32("a count of 0 answers 1 row", zero, toI32(1))
  const negative: i32 = await count(c, "/queries?queries=-5", table, now, ids, numbers)
  t.eqI32("a negative count answers 1 row", negative, toI32(1))
  const word: i32 = await count(c, "/queries?queries=foo", table, now, ids, numbers)
  t.eqI32("a count that is not a number answers 1 row", word, toI32(1))
  const most: i32 = await count(c, "/queries?queries=500", table, now, ids, numbers)
  t.eqI32("a count of 500 answers 500 rows", most, toI32(500))
  const past: i32 = await count(c, "/queries?queries=501", table, now, ids, numbers)
  t.eqI32("a count of 501 answers 500 rows", past, toI32(500))
  const huge: i32 = await count(c, "/queries?queries=99999999999999", table, now, ids, numbers)
  t.eqI32("a count past i32 answers 500 rows", huge, toI32(500))
  t.eqI32("each request is one World read", table.worldReads - reads, toI32(9))

  // --- 3. /cached-queries -----------------------------------------------------------------------
  const s: i32[] = snapshot(table)
  const cachedReads: i32 = table.worldReads
  const ten: i32 = await count(c, "/cached-queries?count=10", table, s, ids, numbers)
  t.eqI32("/cached-queries?count=10 answers 10 rows, each the row's", ten, toI32(10))
  const cachedAbsent: i32 = await count(c, "/cached-queries", table, s, ids, numbers)
  t.eqI32("a cached query with no count answers 1 row", cachedAbsent, toI32(1))
  const cachedZero: i32 = await count(c, "/cached-queries?count=0", table, s, ids, numbers)
  t.eqI32("a cached count of 0 answers 1 row", cachedZero, toI32(1))
  const cachedWord: i32 = await count(c, "/cached-queries?count=x1", table, s, ids, numbers)
  t.eqI32("a cached count that is not a number answers 1 row", cachedWord, toI32(1))
  const cachedPast: i32 = await count(c, "/cached-queries?count=501", table, s, ids, numbers)
  t.eqI32("a cached count of 501 answers 500 rows", cachedPast, toI32(500))
  t.eqI32("the cached queries read the table once", table.cacheReads, toI32(1))
  t.eqI32("and no World row", table.worldReads, cachedReads)

  // --- 4. /updates ------------------------------------------------------------------------------
  const prior: i32[] = snapshot(table)
  const before: i32 = table.updates
  const written: i32 = await count(c, "/updates?queries=20", table, now, ids, numbers)
  t.eqI32("/updates?queries=20 answers 20 rows, each the row as written", written, toI32(20))
  t.eqI32("the update is one statement", table.updates - before, toI32(1))
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
  t.ok("the rows written carry new numbers, not the ones read", changed > 0)
  t.ok("every number written is 1 to 10000", inRange)
  let untouched: boolean = true
  for (let id: i32 = 1; id <= ROWS; id++) {
    let answered: boolean = false
    for (let k: i32 = 0; k < 20; k++) {
      if (ids[k] === id) {
        answered = true
      }
    }
    if (!answered && table.world[id] !== prior[id]) {
      untouched = false
    }
  }
  t.ok("no row the update did not answer changed", untouched)
  const updAbsent: i32 = await count(c, "/updates", table, now, ids, numbers)
  t.eqI32("an update with no count answers 1 row", updAbsent, toI32(1))
  const updEmpty: i32 = await count(c, "/updates?queries=", table, now, ids, numbers)
  t.eqI32("an empty update count answers 1 row", updEmpty, toI32(1))
  const updZero: i32 = await count(c, "/updates?queries=0", table, now, ids, numbers)
  t.eqI32("an update count of 0 answers 1 row", updZero, toI32(1))
  const updNegative: i32 = await count(c, "/updates?queries=-3", table, now, ids, numbers)
  t.eqI32("a negative update count answers 1 row", updNegative, toI32(1))
  const updWord: i32 = await count(c, "/updates?queries=bar", table, now, ids, numbers)
  t.eqI32("an update count that is not a number answers 1 row", updWord, toI32(1))
  const updPast: i32 = await count(c, "/updates?queries=501", table, now, ids, numbers)
  t.eqI32("an update count of 501 answers 500 rows", updPast, toI32(500))
  t.ok("every update binds each id once, ascending", !table.unordered && table.updates === before + 7)
  // 500 random ids of 10000 repeat one almost surely; the rows that share an id share its number.
  let shared: boolean = true
  for (let k: i32 = 0; k < 500; k++) {
    for (let m: i32 = k + 1; m < 500; m++) {
      if (ids[k] === ids[m] && numbers[k] !== numbers[m]) {
        shared = false
      }
    }
  }
  t.ok("rows that share an id answer the one number written", shared)

  // --- 5. /fortunes -----------------------------------------------------------------------------
  const page: Answer = await get(c, "/fortunes")
  t.eqI32("/fortunes answers 200", page.status, toI32(200))
  t.ok("/fortunes carries Server, Date and text/html; charset=utf-8", headers(page, "text/html; charset=utf-8"))
  t.eqStr(
    "/fortunes is the expected page: the added row, sorted, escaped, the Japanese row untouched",
    page.body,
    FORTUNES
  )
  const again: Answer = await get(c, "/fortunes")
  t.ok("a second /fortunes answers the same page", again.status === 200 && again.body === FORTUNES)

  // --- 6. A refused World read ------------------------------------------------------------------
  table.refuseWorld = true
  const refused: Answer = await get(c, "/db")
  t.ok("a refused World read answers 503 with Server", refused.status === 503 && refused.field("server") === "nish")
  const next: Answer = await get(c, "/db")
  const served: i32 = worlds(next.body, false, ids, numbers)
  t.ok("the next /db is served again", next.status === 200 && served === 1 && rowsMatch(snapshot(table), ids, numbers, served))
  hangUp(c)
  report(t, doneFd)
}

/** The client's exit status, read from `fds[0]`, after which both ends are closed; -1 when none came. */
const joined = async (fds: i32[]): Promise<i32> => {
  await readable(fds[0])
  const got: u8[] = [0]
  const n: i32 = netRead(fds[0], got, 0, 1)
  netClose(fds[0])
  netClose(fds[1])
  return n === 1 ? toI32(got[0]) : -1
}

export const main = async (): Promise<i32> => {
  const t = new Suite("tfb async db")
  const table = new Table()
  const pgListen: i32 = tcpListen("127.0.0.1", 0, 16)
  spawn(standIn(pgListen, table))
  spawn(standIn(pgListen, table))
  const pool = new PgAsyncPool(2)
  const config = new PgConfig()
  config.user = "tfb"
  config.database = "tfb"
  const pw: u8[] = [112, 119]
  const password = secret(pw)
  const live: i32 = await pgAsyncConnect(pool, config, password, pgTarget("127.0.0.1", netLocalPort(pgListen)))
  wipe(password)
  t.eqI32("the pool connects both connections", live, toI32(2))
  const db = new TfbAsyncDb(pool)

  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const limits: ServeLimits = tfbDbLimits(8)
  limits.maxRequests = ANSWERED
  const stats: ServeStats = new ServeStats()
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  spawn(client(netLocalPort(listener), table, fds[1]))
  const stopped: i32 = await tfbServeDb(listener, db, limits, stats)
  const clientCode: i32 = await joined(fds)
  t.eqI32("serveOn stops once the client's requests are answered", stopped, toI32(0))
  t.eqI32("every client check passed", clientCode, toI32(0))
  t.eqI32("the server answered each request once", stats.answered, ANSWERED)
  t.eqI32("no query failed but the one refused", db.failures, toI32(1))
  t.eqI32("every statement was one of the entry's four", table.other, toI32(0))
  t.eqI32("limits asked for 0 slots have one connection", tfbDbLimits(0).connections, toI32(1))
  pool.close()
  netClose(listener)
  netClose(pgListen)
  return t.done()
}
