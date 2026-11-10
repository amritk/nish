// The TechEmpower database tests — db, query, update, cached-query and
// fortune — as a `serve` handler that awaits a `PgAsyncPool`: the async twin
// of db-server.ts, shared by async-db-main.ts and tests/link/tfb_async_db.
// It answers each request as `TfbDb` does, from the same encoders, sort and
// HTML escape, and the same statements.
//
// Each request runs in a task of its own. It takes a seat on one of the
// pool's connections and sends its statement there, behind the statements
// other tasks have in flight on it, so a connection carries many requests'
// statements at once; each of the four statements is prepared once a
// connection, the first time a task sends it there. A World read is one statement whatever the count: the ids go as
// one `int8[]` parameter, read back in the order they were drawn, repeats
// included. An update reads its rows that way, then writes every new
// randomNumber in one statement over two `int8[]` parameters, each distinct
// id once, ascending, a seat of its own once the read is answered. The first
// cached query reads the whole table, and every cached query answers from
// that copy; one task reads it while the others that need it wait, and a read
// that fails fails them all and leaves it to the next request. No response is
// cached. A fortune reads the table, adds the request-time row, sorts by the
// message's bytes, and renders the page.
//
// What the tasks share is one `TfbAsyncDb`, whose scratch buffers a task
// fills and reads with no `await` in between, so no other task runs while it
// holds them. The answer's body is the task's own: the region rules keep a
// task from handing `serve` a buffer it shares, so a JSON answer is written
// into a buffer sized to it, and a fortunes page is copied out of the shared
// one it is rendered into.
//
// A connection the pool closes (a query lost, cancelled mid-answer, or ended
// out of step) is dialled again by `tfbKeepPool`, which `main` awaits beside
// `tfbServeDbUntil` in one `awaitAll`: dialling holds the password, which no
// spawned task may.
import { sleep } from "nish:async"
import { Secret } from "nish:secret"
import { JsonWriter } from "nish/json"
import { PgConfig, PgTarget } from "nish/net/postgres"
import {
  PgAsyncParams,
  PgAsyncPool,
  pgAsyncAnswer,
  pgAsyncConnect,
  pgAsyncDone,
  pgAsyncPrepare,
  pgAsyncSeat,
  pgAsyncSend,
  pgAsyncTurn,
} from "nish/net/postgres-async"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import {
  TFB_CACHE_SQL,
  TFB_CACHED,
  TFB_DB,
  TFB_FORTUNE_SQL,
  TFB_FORTUNES,
  TFB_HTML_BYTES,
  TFB_MAX_COUNT,
  TFB_QUERIES,
  TFB_UPDATE_SQL,
  TFB_WORLD_ROWS,
  TfbFortunes,
  tfbCount,
  tfbDigits,
  tfbPlanUpdate,
  tfbWorldId,
  tfbWriteWorld,
} from "./db-server"

/** The World rows whose ids are `$1`, one row per element, in the array's order. */
export const TFB_WORLD_SQL: string =
  "select w.id, w.randomnumber from unnest($1::int8[]) with ordinality as q(key, ord) join world w on w.id = q.key order by q.ord"

/** The most bytes one `{"id":…,"randomNumber":…}` and its comma take, each number an `i32`. */
const TFB_ROW_JSON: i32 = 46
/** The most bytes one id of an `int8[]` literal and its comma take. */
const TFB_ROW_ARRAY: i32 = 12
const TFB_ZERO: i32 = 0
/** The longest `tfbKeepPool` waits between dials while none succeeds. */
const TFB_REDIAL_MOST_MS: i32 = 5000

/** What every request's task shares: the pool, the cached table and the scratch a task fills and reads without waiting. */
export class TfbAsyncDb {
  readonly pool: PgAsyncPool
  /** The four statements' numbers, as `pgAsyncPrepare` registered them. */
  readonly worldSql: i32
  readonly cacheSql: i32
  readonly fortuneSql: i32
  readonly updateSql: i32
  /** The cached World table: `cache[id]` is its randomNumber, once `cacheReady`. */
  readonly cache: i64[]
  /** An update's rows and plan, read and written with no `await` between. */
  readonly ids: i64[]
  readonly numbers: i64[]
  readonly updateIds: i64[]
  readonly updateNumbers: i64[]
  /** A fortunes answer's rows, and the page they render into. */
  readonly fortunes: TfbFortunes
  readonly html: u8[]
  cacheReady: boolean = false
  /** Set while one task reads the table for the cache; the others wait on it. */
  cacheLoading: boolean = false
  /** How many times a cached query waited on another task's read of the table. */
  cacheWaits: i32 = 0
  /** How many requests were answered 503 because a query failed or no connection came. */
  failures: i32 = 0
  /** 1 while `tfbServeDbUntil` serves, 0 once `serveOn` returned. */
  serving: i32 = 1
  /** Connections `tfbKeepPool` dialled again after the pool closed them. */
  redials: i32 = 0

  /** Registers the four statements with `pool`; call it before any request is served. */
  constructor(pool: PgAsyncPool) {
    this.pool = pool
    this.worldSql = pgAsyncPrepare(pool, TFB_WORLD_SQL)
    this.cacheSql = pgAsyncPrepare(pool, TFB_CACHE_SQL)
    this.fortuneSql = pgAsyncPrepare(pool, TFB_FORTUNE_SQL)
    this.updateSql = pgAsyncPrepare(pool, TFB_UPDATE_SQL)
    this.cache = new Array<i64>(TFB_WORLD_ROWS + 1)
    this.ids = new Array<i64>(TFB_MAX_COUNT)
    this.numbers = new Array<i64>(TFB_MAX_COUNT)
    this.updateIds = new Array<i64>(TFB_MAX_COUNT)
    this.updateNumbers = new Array<i64>(TFB_MAX_COUNT)
    this.fortunes = new TfbFortunes()
    this.html = new Array<u8>(TFB_HTML_BYTES)
  }
}

/** The five routes, in `TfbDb`'s order. */
export const tfbDbRouter = (): Router => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/db")
  router.add("GET", "/queries")
  router.add("GET", "/updates")
  router.add("GET", "/cached-queries")
  router.add("GET", "/fortunes")
  return router
}

/**
 * The caps for `slots` requests in flight, at least one: as many connections
 * as requests, no deadline (the explicit entry has none), and `Server: nish`.
 */
export const tfbDbLimits = (slots: i32): ServeLimits => {
  const limits = new ServeLimits()
  limits.connections = slots < 1 ? 1 : slots
  limits.inFlight = limits.connections
  limits.deadline = 0
  limits.server = "nish"
  return limits
}

/** `[0, end)` of `buf` as an `int8[]` literal's text. */
const tfbArrayText = (buf: u8[], end: i32): string => String.fromBytes(buf, 0, end)

/**
 * Serves the database tests on `listener` until `limits.maxRequests` are
 * answered (for good when it is 0), every handler sharing `db`.
 * @returns what `serveOn` answers
 */
export const tfbServeDb = async (
  listener: i32,
  db: TfbAsyncDb,
  limits: ServeLimits,
  stats: ServeStats
): Promise<i32> =>
  await serveOn(
    listener,
    tfbDbRouter(),
    limits,
    async (req: Request): Promise<Response> => {
      const route: i32 = req.route
      if (route < TFB_DB || route > TFB_FORTUNES) {
        return refuse(req)
      }
      if (route === TFB_CACHED) {
        if (!db.cacheReady && db.cacheLoading) {
          // Another task reads the table: wait for it, and fail with it.
          db.cacheWaits += 1
          let waiting: boolean = true
          while (waiting && db.cacheLoading) {
            waiting = await sleep(1)
          }
          if (!db.cacheReady) {
            db.failures += 1
            return new Response(503)
          }
        }
        if (!db.cacheReady) {
          // The first cached query reads the table; one that fails leaves it to the next.
          db.cacheLoading = true
          const ticket: i32 = await pgAsyncSeat(db.pool, db.cacheSql)
          if (ticket < 0) {
            db.cacheLoading = false
            db.failures += 1
            return new Response(503)
          }
          const sent: i32 = await pgAsyncSend(db.pool, ticket, new PgAsyncParams())
          const turn: i32 = await pgAsyncTurn(db.pool, ticket, sent)
          const table = await pgAsyncAnswer(db.pool, ticket, turn)
          pgAsyncDone(db.pool, ticket, turn, table.reusable)
          if (!table.ok()) {
            db.cacheLoading = false
            db.failures += 1
            return new Response(503)
          }
          for (let k: i32 = 0; k < table.rows; k++) {
            const id: i32 = table.int(k, 0, -1)
            if (id >= 1 && id <= TFB_WORLD_ROWS) {
              db.cache[id] = toI64(table.int(k, 1, 0))
            }
          }
          db.cacheReady = true
          db.cacheLoading = false
        }
        const count: i32 = tfbCount(req.raw, "count")
        const body: u8[] = new Array<u8>(count * TFB_ROW_JSON + 2)
        const w = new JsonWriter(body, TFB_ZERO)
        w.beginArray()
        for (let k: i32 = 0; k < count; k++) {
          const id: i64 = tfbWorldId()
          tfbWriteWorld(w, id, db.cache[toI32(id)])
        }
        w.endArray()
        return new Response(200).bytes("application/json", body, TFB_ZERO, w.end)
      }
      const params = new PgAsyncParams()
      if (route === TFB_FORTUNES) {
        const ticket: i32 = await pgAsyncSeat(db.pool, db.fortuneSql)
        if (ticket < 0) {
          db.failures += 1
          return new Response(503)
        }
        const sent: i32 = await pgAsyncSend(db.pool, ticket, params)
        const turn: i32 = await pgAsyncTurn(db.pool, ticket, sent)
        const r = await pgAsyncAnswer(db.pool, ticket, turn)
        pgAsyncDone(db.pool, ticket, turn, r.reusable)
        const f: TfbFortunes = db.fortunes
        f.reset()
        let fits: boolean = r.ok()
        for (let k: i32 = 0; k < r.rows && fits; k++) {
          const message: string = r.text(k, 1)
          const length: i32 = r.isNull(k, 1) ? -1 : toI32(message.length)
          fits = f.room(length)
          if (fits) {
            for (let b: i32 = 0; b < length; b++) {
              f.text[f.textLength + b] = toU8(toI32(message.charCodeAt(b)))
            }
            f.push(toI64(r.int(k, 0, 0)), length)
          }
        }
        const end: i32 = fits ? f.render(db.html) : -1
        if (end < 0) {
          db.failures += 1
          return new Response(503)
        }
        const page: u8[] = new Array<u8>(end)
        for (let b: i32 = 0; b < end; b++) {
          page[b] = db.html[b]
        }
        return new Response(200).bytes("text/html; charset=utf-8", page, TFB_ZERO, end)
      }
      // The World read: `count` ids drawn now, one statement.
      const count: i32 = route === TFB_DB ? 1 : tfbCount(req.raw, "queries")
      const ids: u8[] = new Array<u8>(count * TFB_ROW_ARRAY + 2)
      ids[0] = toU8(123)
      let at: i32 = 1
      for (let k: i32 = 0; k < count; k++) {
        if (k > 0) {
          ids[at] = toU8(44)
          at += 1
        }
        at = tfbDigits(ids, at, tfbWorldId())
      }
      ids[at] = toU8(125)
      params.text(tfbArrayText(ids, at + 1))
      const ticket: i32 = await pgAsyncSeat(db.pool, db.worldSql)
      if (ticket < 0) {
        db.failures += 1
        return new Response(503)
      }
      const sent: i32 = await pgAsyncSend(db.pool, ticket, params)
      const turn: i32 = await pgAsyncTurn(db.pool, ticket, sent)
      const r = await pgAsyncAnswer(db.pool, ticket, turn)
      pgAsyncDone(db.pool, ticket, turn, r.reusable)
      if (!r.ok() || r.rows !== count) {
        db.failures += 1
        return new Response(503)
      }
      const body: u8[] = new Array<u8>(count * TFB_ROW_JSON + 2)
      const w = new JsonWriter(body, TFB_ZERO)
      if (route === TFB_DB) {
        tfbWriteWorld(w, toI64(r.int(0, 0, 0)), toI64(r.int(0, 1, 0)))
        return new Response(200).bytes("application/json", body, TFB_ZERO, w.end)
      }
      w.beginArray()
      if (route === TFB_QUERIES) {
        for (let k: i32 = 0; k < count; k++) {
          tfbWriteWorld(w, toI64(r.int(k, 0, 0)), toI64(r.int(k, 1, 0)))
        }
        w.endArray()
        return new Response(200).bytes("application/json", body, TFB_ZERO, w.end)
      }
      if (!r.reusable) {
        // The read ended out of step, and its connection is closed: no update follows it.
        db.failures += 1
        return new Response(503)
      }
      // The update: plan it in the shared scratch, then write the answer and
      // both parameters before the next `await` lets another task in.
      for (let k: i32 = 0; k < count; k++) {
        db.ids[k] = toI64(r.int(k, 0, 0))
      }
      const n: i32 = tfbPlanUpdate(db.ids, db.numbers, count, db.updateIds, db.updateNumbers)
      for (let k: i32 = 0; k < count; k++) {
        tfbWriteWorld(w, db.ids[k], db.numbers[k])
      }
      w.endArray()
      const numbers: u8[] = new Array<u8>(n * TFB_ROW_ARRAY + 2)
      ids[0] = toU8(123)
      numbers[0] = toU8(123)
      let idsAt: i32 = 1
      let numbersAt: i32 = 1
      for (let k: i32 = 0; k < n; k++) {
        if (k > 0) {
          ids[idsAt] = toU8(44)
          numbers[numbersAt] = toU8(44)
          idsAt += 1
          numbersAt += 1
        }
        idsAt = tfbDigits(ids, idsAt, db.updateIds[k])
        numbersAt = tfbDigits(numbers, numbersAt, db.updateNumbers[k])
      }
      ids[idsAt] = toU8(125)
      numbers[numbersAt] = toU8(125)
      const update = new PgAsyncParams()
      update.text(tfbArrayText(ids, idsAt + 1))
      update.text(tfbArrayText(numbers, numbersAt + 1))
      const writer: i32 = await pgAsyncSeat(db.pool, db.updateSql)
      if (writer < 0) {
        db.failures += 1
        return new Response(503)
      }
      const wrote: i32 = await pgAsyncSend(db.pool, writer, update)
      const written: i32 = await pgAsyncTurn(db.pool, writer, wrote)
      const u = await pgAsyncAnswer(db.pool, writer, written)
      pgAsyncDone(db.pool, writer, written, u.reusable)
      if (!u.ok()) {
        db.failures += 1
        return new Response(503)
      }
      return new Response(200).bytes("application/json", body, TFB_ZERO, w.end)
    },
    stats
  )

/**
 * `tfbServeDb`, then `db.serving` set to 0 so `tfbKeepPool` stops: the two
 * are awaited together, in one `awaitAll`.
 * @param listener the listening socket
 * @param db what every request's task shares
 * @param limits the server's caps
 * @param stats the server's counters
 * @returns what `serveOn` answered
 */
export const tfbServeDbUntil = async (
  listener: i32,
  db: TfbAsyncDb,
  limits: ServeLimits,
  stats: ServeStats
): Promise<i32> => {
  const code: i32 = await tfbServeDb(listener, db, limits, stats)
  db.serving = 0
  return code
}

/**
 * How long `tfbKeepPool` waits before it looks again: `every` once the pool
 * is full, else twice `wait`, up to `TFB_REDIAL_MOST_MS`, so a server that
 * takes back only some of the connections is not dialled every `every`.
 * @param wait how long it waited last
 * @param every how often it looks while the pool is full
 * @param full whether every slot of the pool is connected
 * @returns the next wait, in milliseconds
 */
export const tfbRedialWait = (wait: i32, every: i32, full: boolean): i32 => {
  if (full) {
    return every
  }
  return wait > TFB_REDIAL_MOST_MS / 2 ? TFB_REDIAL_MOST_MS : wait * 2
}

/**
 * Dials again every connection of `db.pool` that is closed, while
 * `tfbServeDbUntil` serves: it looks every `everyMs`, and while the pool is
 * not full after a dial it waits twice as long each time, up to five
 * seconds. Each connection's dial and startup take at most
 * `db.pool.connectWaitMs`. Call it from `main`, beside `tfbServeDbUntil` in
 * an `awaitAll`, not from a spawned task: it holds the password, which
 * `main` keeps for the life of the process.
 * @param db what the server's tasks share; `db.serving` ends the watch
 * @param config the startup parameters, as the first connect had them
 * @param password the role's password, which the caller wipes once this returns
 * @param target where the server is
 * @param everyMs how often to look, at least 1
 * @returns how many connections it dialled again
 */
export const tfbKeepPool = async (
  db: TfbAsyncDb,
  config: PgConfig,
  password: Secret<u8[]>,
  target: PgTarget,
  everyMs: i32
): Promise<i32> => {
  const every: i32 = everyMs < 1 ? 1 : everyMs
  let wait: i32 = every
  while (db.serving === 1) {
    await sleep(wait)
    if (db.serving !== 1 || db.pool.live() >= db.pool.size) {
      wait = every
      continue
    }
    const before: i32 = db.pool.connects
    await pgAsyncConnect(db.pool, config, password, target)
    db.redials += db.pool.connects - before
    wait = tfbRedialWait(wait, every, db.pool.live() >= db.pool.size)
  }
  return db.redials
}
