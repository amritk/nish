// The async TechEmpower database entry (bench/techempower/async-db-server.ts)
// under `serveOn`, against the rules tests/link/tfb_db holds the explicit
// entry to, over loopback: a pool of one connection to the stand-in Postgres
// of backend.ts, the entry's `tfbKeepPool` dialling it again whenever the
// pool closes it, and a Nish client, as tasks in the same process.
//
//   1. /db: 200, one `{"id":n,"randomNumber":m}` object whose number is the
//      stand-in's row for that id; `Server: nish`, an IMF-fixdate `Date` and
//      `application/json`.
//   2. /queries: as many rows as asked, each the stand-in's row, the count
//      clamped as the rules read it: absent, empty, 0, negative or not a
//      number is 1, and over 500 is 500. Each request is one World read.
//   3. /cached-queries: a cached query at a cold start with no connection
//      to seat answers 503 and leaves the cache cold. Two cached queries at
//      a cold start share one read
//      of the table, the second waiting on the first: when that read is
//      refused both answer 503 with `Server`, and when it succeeds both
//      answer 200. Then as many rows as asked, each the row the stand-in
//      held when the table was read, the count clamped the same way; the
//      table is read once and no World row is.
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
//   7. With the pool's one connection claimed by the client, /db answers 503
//      once `claimWaitMs` passes, and is served once it is released.
//   8. A fortunes answer with more rows than a page holds answers 503, and
//      the next /fortunes is the page again.
//   9. A World read the stand-in cuts off mid-answer answers 503; the pool
//      closes the connection, `tfbKeepPool` dials it again, and the next
//      /db is served on the new one.
//  10. A World read that ends in a transaction (ReadyForQuery 'T') leaves
//      /updates no connection to write on: it answers 503 with no update
//      sent, the connection is closed and dialled again, and the next
//      /updates is served.
//  11. A connection left idle past five seconds is still the pool's: the
//      next /db is served on it, with no dial. `tfbRedialWait` waits `every`
//      once the pool is full, else twice the last wait, up to five seconds.
//
// Every wait the client and stand-in make is bounded at five seconds, so a
// broken entry fails the test instead of hanging it; `watch` ends the
// process if `serveOn` does not stop once the client is done.
//
// The entry prepares each of its statements once per connection, the
// stand-in answering a Bind by the statement a Parse on that connection
// named; tfb_db's batching and slot checks have no twin. Every request is counted in `ANSWERED`, so `serveOn` stops once the client
// is done.
import { awaitAll, readableWithin, sleep, spawn, writableWithin } from "nish:async"
import {
  NET_UNIX_STREAM,
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  tcpConnect,
  tcpListen,
  unixSocketPair,
} from "nish:net"
import { secret, wipe } from "nish:secret"
import { PgConfig, pgTarget } from "nish/net/postgres"
import { PgAsyncPool, pgAsyncClaim, pgAsyncConnect, pgAsyncRelease } from "nish/net/postgres-async"
import { ServeLimits, ServeStats } from "nish/net/serve"
import { Suite } from "nish/testing"
import { TfbAsyncDb, tfbDbLimits, tfbKeepPool, tfbRedialWait, tfbServeDbUntil } from "../../../bench/techempower/async-db-server"
import { Conn, hangUp, headerOf } from "../net_serve/client"
import { ROWS, Table, standIn } from "./backend"

/** The requests the client sends, each answered once. */
const ANSWERED: i32 = 40
/** The connections the stand-in accepts: the first, and one after each of the two the pool closes. */
const CONNECTIONS: i32 = 3
/** The longest any one wait of the test lasts, in milliseconds. */
const WAIT_MS: i32 = 5000
/** The longest the whole client runs, in milliseconds. */
const CLIENT_MS: i32 = 60000
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
      const ready: boolean = await readableWithin(c.fd, WAIT_MS)
      if (!ready) {
        c.closed = true
        return false
      }
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

/** Connects `c` to the loopback `port`, waiting at most `WAIT_MS`; false when it could not. */
const dialWithin = async (c: Conn, port: i32): Promise<boolean> => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  const fd: i32 = tcpConnect(addr)
  if (fd < 0) {
    return false
  }
  const ready: boolean = await writableWithin(fd, WAIT_MS)
  if (!ready || connectResult(fd) !== 0) {
    netClose(fd)
    return false
  }
  c.fd = fd
  return true
}

/** Sends `GET path` on `c`, each wait for room at most `WAIT_MS`; false when it could not. */
const ask = async (c: Conn, path: string): Promise<boolean> => {
  const text: string = `GET ${path} HTTP/1.1\r\nHost: tfb\r\n\r\n`
  const bytes: u8[] = new Array<u8>(text.length)
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    bytes[i] = toU8(text.charCodeAt(i))
  }
  let at: i32 = 0
  while (at < toI32(text.length)) {
    const n: i32 = netWrite(c.fd, bytes, at, toI32(text.length) - at)
    if (n === -11) {
      const ready: boolean = await writableWithin(c.fd, WAIT_MS)
      if (!ready) {
        return false
      }
    } else if (n <= 0) {
      return false
    } else {
      at += n
    }
  }
  return true
}

/** The answer to `GET path` on `c`; status 0 when the peer closed first. */
const get = async (c: Conn, path: string): Promise<Answer> => {
  const sent: boolean = await ask(c, path)
  if (!sent) {
    return new Answer()
  }
  return await answer(c)
}

/** The next answer on `c`; status 0 when the peer closed or went quiet first. */
const answer = async (c: Conn): Promise<Answer> => {
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

/** Waits, polling every 5 ms for at most `WAIT_MS`, until the pool has `live` connections; false when it has not. */
const liveWithin = async (db: TfbAsyncDb, live: i32): Promise<boolean> => {
  for (let waited: i32 = 0; waited < WAIT_MS; waited += 5) {
    if (db.pool.live() === live) {
      return true
    }
    await sleep(5)
  }
  return db.pool.live() === live
}

/** Waits, polling every millisecond for at most `WAIT_MS`, until the stand-in holds a whole-table read; false when it does not. */
const heldWithin = async (table: Table): Promise<boolean> => {
  for (let waited: i32 = 0; waited < WAIT_MS; waited++) {
    if (table.cacheHeld) {
      return true
    }
    await sleep(1)
  }
  return table.cacheHeld
}

/** Waits, polling every millisecond for at most `WAIT_MS`, until a cached query waits on the table's read; false when none does. */
const waitedWithin = async (db: TfbAsyncDb, waits: i32): Promise<boolean> => {
  for (let waited: i32 = 0; waited < WAIT_MS; waited++) {
    if (db.cacheWaits > waits) {
      return true
    }
    await sleep(1)
  }
  return db.cacheWaits > waits
}

/**
 * Two cached queries at a cold start, one on `c` and one on `c2`, the
 * stand-in holding whole-table reads: the first reads the table, and the
 * second is sent once it does; answers whether the second waited on it.
 */
const coalesced = async (c: Conn, c2: Conn, db: TfbAsyncDb, table: Table): Promise<boolean> => {
  const waits: i32 = db.cacheWaits
  let waited: boolean = false
  const first: boolean = await ask(c, "/cached-queries?count=3")
  if (first) {
    const held: boolean = await heldWithin(table)
    if (held) {
      const second: boolean = await ask(c2, "/cached-queries?count=3")
      if (second) {
        waited = await waitedWithin(db, waits)
      }
    }
  }
  return waited
}

/** Ends a client's suite and writes its exit status, 0 or 1, as one byte on `doneFd`. */
const report = (t: Suite, doneFd: i32): void => {
  const code: u8[] = [toU8(t.done())]
  netWrite(doneFd, code, 0, 1)
}

/** The client: every check, in a suite of its own, since a task keeps nothing outside its region. */
const client = async (port: i32, table: Table, db: TfbAsyncDb, doneFd: i32): Promise<void> => {
  const t = new Suite("tfb async db: client")
  const c: Conn = new Conn(65536)
  const dialed: boolean = await dialWithin(c, port)
  t.ok("the client connects", dialed)
  const c2: Conn = new Conn(65536)
  const dialed2: boolean = await dialWithin(c2, port)
  t.ok("and a second connection", dialed2)
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
  const held: i32 = await pgAsyncClaim(db.pool)
  const seatless: Answer = await get(c, "/cached-queries?count=3")
  if (held >= 0) {
    pgAsyncRelease(db.pool, held, true)
  }
  t.ok(
    "a cached query at a cold start with no connection to seat answers 503 with Server",
    held >= 0 && seatless.status === 503 && seatless.field("server") === "nish"
  )
  t.ok("and leaves the cache cold, not loading", !db.cacheReady && !db.cacheLoading)
  const s: i32[] = snapshot(table)
  const cachedReads: i32 = table.worldReads
  const failed: i32 = db.failures
  table.refuseCache = true
  table.holdCache = true
  const sharedRefused: boolean = await coalesced(c, c2, db, table)
  table.holdCache = false
  t.ok("a cached query at a cold start waits on the one reading the table", sharedRefused)
  const refusedFirst: Answer = await answer(c)
  const refusedSecond: Answer = await answer(c2)
  t.ok(
    "a refused read of the table answers 503 with Server, to both",
    refusedFirst.status === 503 &&
      refusedFirst.field("server") === "nish" &&
      refusedSecond.status === 503 &&
      refusedSecond.field("server") === "nish"
  )
  t.eqI32("both are counted as failures", db.failures - failed, toI32(2))
  t.ok("and the cache is left cold", !db.cacheReady && !db.cacheLoading)
  table.holdCache = true
  const sharedRead: boolean = await coalesced(c, c2, db, table)
  table.holdCache = false
  t.ok("the next cached query reads the table, the other waiting on it", sharedRead)
  const readFirst: Answer = await answer(c)
  const readSecond: Answer = await answer(c2)
  const firstRows: i32 = headers(readFirst, "application/json") ? worlds(readFirst.body, true, ids, numbers) : -1
  t.ok("the reader answers 3 rows, each the row's", firstRows === 3 && rowsMatch(s, ids, numbers, firstRows))
  const secondRows: i32 = headers(readSecond, "application/json") ? worlds(readSecond.body, true, ids, numbers) : -1
  t.ok("so does the one that waited", secondRows === 3 && rowsMatch(s, ids, numbers, secondRows))
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

  // --- 7. No connection to claim ----------------------------------------------------------------
  const ticket: i32 = await pgAsyncClaim(db.pool)
  t.ok("the client claims the pool's one connection", ticket >= 0)
  const unclaimed: Answer = await get(c, "/db")
  t.ok("/db with no connection to claim answers 503 with Server", unclaimed.status === 503 && unclaimed.field("server") === "nish")
  if (ticket >= 0) {
    pgAsyncRelease(db.pool, ticket, true)
  }
  const claimed: Answer = await get(c, "/db")
  t.eqI32("once it is released, /db is served", claimed.status, toI32(200))

  // --- 8. Fortunes past a page ------------------------------------------------------------------
  table.crowdFortunes = true
  const crowded: Answer = await get(c, "/fortunes")
  t.ok("fortunes past what a page holds answer 503 with Server", crowded.status === 503 && crowded.field("server") === "nish")
  const after: Answer = await get(c, "/fortunes")
  t.ok("the next /fortunes is the page again", after.status === 200 && after.body === FORTUNES)

  // --- 9. A connection lost mid-answer ----------------------------------------------------------
  const dropped: i32 = db.pool.dropped
  table.dropWorld = true
  const cut: Answer = await get(c, "/db")
  t.ok("a World read cut off mid-answer answers 503 with Server", cut.status === 503 && cut.field("server") === "nish")
  t.eqI32("the pool closes that connection", db.pool.dropped - dropped, toI32(1))
  const redialled: boolean = await liveWithin(db, 1)
  t.ok("tfbKeepPool dials it again", redialled && table.accepted === 2)
  const fresh: Answer = await get(c, "/db")
  const freshRows: i32 = worlds(fresh.body, false, ids, numbers)
  t.ok(
    "the next /db is served on the new connection",
    fresh.status === 200 && freshRows === 1 && rowsMatch(snapshot(table), ids, numbers, freshRows)
  )

  // --- 10. A read that ends out of step ---------------------------------------------------------
  const updatesBefore: i32 = table.updates
  table.busyWorld = true
  const busy: Answer = await get(c, "/updates?queries=5")
  t.ok("an update whose read ends in a transaction answers 503 with Server", busy.status === 503 && busy.field("server") === "nish")
  t.eqI32("and sends no update", table.updates, updatesBefore)
  t.eqI32("the pool closes that connection too", db.pool.dropped - dropped, toI32(2))
  const again2: boolean = await liveWithin(db, 1)
  t.ok("tfbKeepPool dials it again", again2 && table.accepted === 3)
  const healed: i32 = await count(c, "/updates?queries=5", table, now, ids, numbers)
  t.eqI32("the next /updates is served", healed, toI32(5))
  t.eqI32("tfbKeepPool dialled two connections again", db.redials, toI32(2))

  // --- 11. An idle connection, and the redial backoff -------------------------------------------
  await sleep(WAIT_MS + 200)
  const idled: Answer = await get(c, "/db")
  t.ok("a connection idle past five seconds still serves /db", idled.status === 200)
  t.ok("with no dial", table.accepted === 3 && db.redials === 2)
  t.eqI32("a full pool waits `every` to look again", tfbRedialWait(640, 10, true), toI32(10))
  t.eqI32("a pool still short doubles the wait", tfbRedialWait(640, 10, false), toI32(1280))
  t.eqI32("up to five seconds", tfbRedialWait(4000, 10, false), toI32(5000))
  t.eqI32("and no further", tfbRedialWait(5000, 10, false), toI32(5000))
  table.finished = true
  hangUp(c)
  hangUp(c2)
  report(t, doneFd)
}

/**
 * The client's exit status, read from `fds[0]` within `CLIENT_MS`, after which
 * both ends are closed; -1 when none came. Ends the process with 1 if
 * `serveOn` has not stopped within `WAIT_MS` of the client's end, which only
 * a broken entry would do.
 */
const watch = async (fds: i32[], db: TfbAsyncDb): Promise<i32> => {
  const ready: boolean = await readableWithin(fds[0], CLIENT_MS)
  const got: u8[] = [0]
  const n: i32 = ready ? netRead(fds[0], got, 0, 1) : -1
  netClose(fds[0])
  netClose(fds[1])
  for (let waited: i32 = 0; waited < WAIT_MS && db.serving === 1; waited += 5) {
    await sleep(5)
  }
  if (db.serving === 1) {
    console.log("serveOn did not stop once the client was done")
    process.exit(1)
  }
  return n === 1 ? toI32(got[0]) : -1
}

export const main = async (): Promise<i32> => {
  const t = new Suite("tfb async db")
  const table = new Table()
  const pgListen: i32 = tcpListen("127.0.0.1", 0, 16)
  spawn(standIn(pgListen, table, CONNECTIONS))
  const pool = new PgAsyncPool(1)
  pool.claimWaitMs = 50
  const config = new PgConfig()
  config.user = "tfb"
  config.database = "tfb"
  const pw: u8[] = [112, 119]
  const password = secret(pw)
  const target = pgTarget("127.0.0.1", netLocalPort(pgListen))
  const live: i32 = await pgAsyncConnect(pool, config, password, target)
  t.eqI32("the pool connects its connection", live, toI32(1))
  const db = new TfbAsyncDb(pool)

  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const limits: ServeLimits = tfbDbLimits(8)
  limits.maxRequests = ANSWERED
  const stats: ServeStats = new ServeStats()
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  spawn(client(netLocalPort(listener), table, db, fds[1]))
  const [stopped, redials, clientCode] = await awaitAll(
    tfbServeDbUntil(listener, db, limits, stats),
    tfbKeepPool(db, config, password, target, 10),
    watch(fds, db)
  )
  wipe(password)
  t.eqI32("serveOn stops once the client's requests are answered", stopped, toI32(0))
  t.eqI32("every client check passed", clientCode, toI32(0))
  t.eqI32("tfbKeepPool stops with it, having dialled two connections again", redials, toI32(2))
  t.eqI32("the server answered each request once", stats.answered, ANSWERED)
  t.eqI32("no query failed but the eight made to", db.failures, toI32(8))
  t.eqI32("every statement was one of the entry's four", table.other, toI32(0))
  t.ok("each was prepared once a connection", table.parses > 0 && table.reparsed === 0)
  t.eqI32("limits asked for 0 slots have one connection", tfbDbLimits(0).connections, toI32(1))
  pool.close()
  netClose(listener)
  netClose(pgListen)
  return t.done()
}
