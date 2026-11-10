// The TechEmpower database tests — db, query, update, cached-query and
// fortune — on one `HttpHandler` and one `PgCarrier`, single-threaded. See
// README.md for the rules each answers to and what is not yet measured.
//
// Every request taken becomes a job, one per handler slot, and its job's
// index is the tag of every query it queues. A World row is read through the
// carrier's `PgBatcher`: each id a request asks for is a key queued with
// `runInt`, and the carrier binds every key waiting, from every request in
// flight, into one execution of the batch statement. A key the carrier has no
// room for stays with its job and is queued again next turn. A job is
// answered only once each query it queued has had its final event, so no
// event outlives the job its tag names.
//
// An update reads its rows that way first, then writes every new
// randomNumber in one statement over two `int8[]` parameters, ids ascending,
// so two updates never wait on each other in opposite orders. The cached
// query reads the whole table once at start-up and answers from that copy;
// no response is cached. A fortune reads the table with a plain query,
// copies each message into its job, adds the request-time row, sorts by the
// message's bytes, and renders into one response buffer every request
// reuses.
import { JsonWriter } from "nish/json"
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { PgBatchConfig, PgBatcher, PgConnection, PgPool, PgTarget } from "nish/net/postgres"
import {
  PG_CARRIER_BUILD,
  PG_CARRIER_DONE,
  PG_CARRIER_FAILED,
  PG_CARRIER_FULL,
  PG_CARRIER_MISSING,
  PG_CARRIER_NONE,
  PG_CARRIER_ROW,
  PgCarrier,
  PgCarrierLimits,
} from "nish/net/postgres-carrier"
import { Router, RouterLimits } from "nish/net/router"

/** The routes, in the order they are added to the router. */
export const TFB_DB: i32 = 0
export const TFB_QUERIES: i32 = 1
export const TFB_UPDATES: i32 = 2
export const TFB_CACHED: i32 = 3
export const TFB_FORTUNES: i32 = 4

/** The most rows one query, update or cached-query request asks for; TFB clamps the count to it. */
export const TFB_MAX_COUNT: i32 = 500
/** The World table's ids are 1 to this. */
export const TFB_WORLD_ROWS: i32 = 10000
/** How many queries the carrier holds: room for every slot's every key. */
export const TFB_QUERY_ROOM: i32 = 65536
/** The most Fortune rows one request holds, and the bytes their messages may take. */
export const TFB_FORTUNE_ROWS: i32 = 256
export const TFB_FORTUNE_BYTES: i32 = 32768
/** Room for a fortunes page: every message byte escaped to at most six, and the markup. */
export const TFB_HTML_BYTES: i32 = 8 * TFB_FORTUNE_BYTES
/** Room for a JSON answer of up to `TFB_MAX_COUNT` rows. */
export const TFB_JSON_BYTES: i32 = 32768

/** The statements both entries run. */
export const TFB_FORTUNE_SQL: string = "select id, message from fortune"
export const TFB_CACHE_SQL: string = "select id, randomnumber from world"
export const TFB_UPDATE_SQL: string =
  "update world set randomnumber = v.r from (select unnest($1::int8[]) as id, unnest($2::int8[]) as r) as v where world.id = v.id"

/** A job's phase: rows being read, the update in flight, or waiting on the cache. */
const PHASE_READ: i32 = 0
const PHASE_UPDATE: i32 = 1
const PHASE_CACHE: i32 = 2
/** An update whose rows are read but whose statement the carrier had no room for. */
const PHASE_UPDATE_WAIT: i32 = 3

const ZERO: i32 = 0
/** How long a turn waits at most while work the carrier refused for room waits. */
const BUSY_WAIT_MS: i32 = 1

/** `s` as bytes; the entry's strings are ASCII. */
export const tfbAscii = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(s.length))
  for (let k: i32 = 0; k < toI32(s.length); k++) {
    out[k] = toU8(toI32(s.charCodeAt(k)))
  }
  return out
}

/**
 * The count a query, update or cached-query request asks for, as TFB's rules
 * read it: absent, empty, not a whole number, or below 1 is 1, and above 500
 * is 500. The value is read raw, digits only, and stops counting past 500.
 */
export const tfbCount = (req: HttpRequest, name: string): i32 => {
  if (req.queryIndex(name) < 0) {
    return 1
  }
  const start: i32 = req.queryValueStart
  const end: i32 = req.queryValueEnd
  if (end <= start) {
    return 1
  }
  let n: i32 = 0
  for (let k: i32 = start; k < end; k++) {
    const d: i32 = toI32(req.head[k])
    if (d < 48 || d > 57) {
      return 1
    }
    if (n <= TFB_MAX_COUNT) {
      n = n * 10 + d - 48
    }
  }
  if (n < 1) {
    return 1
  }
  return n > TFB_MAX_COUNT ? TFB_MAX_COUNT : n
}

/** A random World id, 1 to 10000. */
export const tfbWorldId = (): i64 => toI64(1 + toI32(Math.floor(Math.random() * 10000.0)))

/** Writes `{"id":id,"randomNumber":number}`. */
export const tfbWriteWorld = (w: JsonWriter, id: i64, number: i64): void => {
  w.beginObject()
  w.key("id")
  w.i64(id)
  w.key("randomNumber")
  w.i64(number)
  w.endObject()
}

/**
 * Plans an update of `rows` rows read into `ids`: draws each row's new number
 * into `numbers`, and lists each distinct id once, ascending, in `updateIds`
 * with the number all its rows share in `updateNumbers`. Answers how many
 * distinct ids there are.
 */
export const tfbPlanUpdate = (ids: i64[], numbers: i64[], rows: i32, updateIds: i64[], updateNumbers: i64[]): i32 => {
  let n: i32 = 0
  for (let k: i32 = 0; k < rows; k++) {
    const id: i64 = ids[k]
    // Insertion into the ascending list; an id already there keeps its number.
    let at: i32 = n
    while (at > 0 && updateIds[at - 1] > id) {
      at -= 1
    }
    if (at > 0 && updateIds[at - 1] === id) {
      numbers[k] = updateNumbers[at - 1]
      continue
    }
    for (let m: i32 = n; m > at; m--) {
      updateIds[m] = updateIds[m - 1]
      updateNumbers[m] = updateNumbers[m - 1]
    }
    numbers[k] = tfbWorldId()
    updateIds[at] = id
    updateNumbers[at] = numbers[k]
    n += 1
  }
  return n
}

/** Whether `a[as, as + al)` sorts before `b[bs, bs + bl)`, byte by byte. */
const tfbBytesBefore = (a: u8[], as: i32, al: i32, b: u8[], bs: i32, bl: i32): boolean => {
  const n: i32 = al < bl ? al : bl
  for (let k: i32 = 0; k < n; k++) {
    const x: i32 = toI32(a[as + k])
    const y: i32 = toI32(b[bs + k])
    if (x !== y) {
      return x < y
    }
  }
  return al < bl
}

/** Writes the ASCII `s` at `out[at]`; answers the end. */
const tfbPut = (out: u8[], at: i32, s: string): i32 => {
  const n: i32 = toI32(s.length)
  for (let k: i32 = 0; k < n; k++) {
    out[at + k] = toU8(toI32(s.charCodeAt(k)))
  }
  return at + n
}

/**
 * Writes `v` in decimal at `out[at]`, a `-` first when it is negative.
 * @returns where the digits end
 */
export const tfbDigits = (out: u8[], at: i32, v: i64): i32 => {
  if (v < toI64(0)) {
    out[at] = toU8(45)
    return tfbDigits(out, at + 1, -v)
  }
  let end: i32 = at
  if (v >= toI64(10)) {
    end = tfbDigits(out, at, v / toI64(10))
  }
  out[end] = toU8(48 + toI32(v % toI64(10)))
  return end + 1
}

/** Writes `text[start, start + length)` HTML-escaped at `out[at]`: `& < > " '` as entities, every other byte as it is. */
const tfbEscape = (out: u8[], at: i32, text: u8[], start: i32, length: i32): i32 => {
  let end: i32 = at
  for (let k: i32 = 0; k < length; k++) {
    const b: u8 = text[start + k]
    const c: i32 = toI32(b)
    if (c === 38) {
      end = tfbPut(out, end, "&amp;")
    } else if (c === 60) {
      end = tfbPut(out, end, "&lt;")
    } else if (c === 62) {
      end = tfbPut(out, end, "&gt;")
    } else if (c === 34) {
      end = tfbPut(out, end, "&quot;")
    } else if (c === 39) {
      end = tfbPut(out, end, "&#39;")
    } else {
      out[end] = b
      end += 1
    }
  }
  return end
}

/** The row TFB adds to every fortunes answer at request time, with id 0. */
const TFB_EXTRA_FORTUNE: string = "Additional fortune added at request time."

/**
 * One fortunes answer's rows: row `k` has id `ids[k]` and the message at
 * `text[starts[k], starts[k] + lengths[k])`. A reader writes a message's
 * bytes at `text[textLength]`, once `room` allows them, then calls `push`.
 */
export class TfbFortunes {
  ids: i64[]
  starts: i32[]
  lengths: i32[]
  order: i32[]
  text: u8[]
  rows: i32 = 0
  textLength: i32 = 0

  constructor() {
    this.ids = new Array<i64>(TFB_FORTUNE_ROWS)
    this.starts = new Array<i32>(TFB_FORTUNE_ROWS)
    this.lengths = new Array<i32>(TFB_FORTUNE_ROWS)
    this.order = new Array<i32>(TFB_FORTUNE_ROWS)
    this.text = new Array<u8>(TFB_FORTUNE_BYTES)
  }

  /** Empties it for the next answer. */
  reset(): void {
    this.rows = 0
    this.textLength = 0
  }

  /**
   * Whether a row whose message is `length` bytes fits, leaving a row for the
   * request-time one.
   * @param length the message's bytes, negative for a NULL message
   * @returns false when the answer must fail
   */
  room(length: i32): boolean {
    return this.rows < TFB_FORTUNE_ROWS - 1 && length >= 0 && this.textLength + length <= TFB_FORTUNE_BYTES
  }

  /**
   * Adds the row `id` whose `length` message bytes are already at `text[textLength]`.
   * @param id the row's id
   * @param length its message's bytes, which `room` allowed
   */
  push(id: i64, length: i32): void {
    this.ids[this.rows] = id
    this.starts[this.rows] = this.textLength
    this.lengths[this.rows] = length
    this.textLength += length
    this.rows += 1
  }

  /**
   * Adds the request-time row, sorts every row by its message's bytes and
   * writes the page into `out`, which holds `TFB_HTML_BYTES`.
   * @param out the page's buffer
   * @returns the page's length, or -1 when the request-time row does not fit
   */
  render(out: u8[]): i32 {
    const length: i32 = toI32(TFB_EXTRA_FORTUNE.length)
    if (this.textLength + length > TFB_FORTUNE_BYTES) {
      return -1
    }
    for (let k: i32 = 0; k < length; k++) {
      this.text[this.textLength + k] = toU8(toI32(TFB_EXTRA_FORTUNE.charCodeAt(k)))
    }
    this.push(toI64(0), length)
    const n: i32 = this.rows
    for (let k: i32 = 0; k < n; k++) {
      let at: i32 = k
      while (
        at > 0 &&
        tfbBytesBefore(
          this.text,
          this.starts[k],
          this.lengths[k],
          this.text,
          this.starts[this.order[at - 1]],
          this.lengths[this.order[at - 1]]
        )
      ) {
        this.order[at] = this.order[at - 1]
        at -= 1
      }
      this.order[at] = k
    }
    let end: i32 = tfbPut(
      out,
      ZERO,
      "<!DOCTYPE html><html><head><title>Fortunes</title></head><body><table><tr><th>id</th><th>message</th></tr>"
    )
    for (let k: i32 = 0; k < n; k++) {
      const r: i32 = this.order[k]
      end = tfbPut(out, end, "<tr><td>")
      end = tfbDigits(out, end, this.ids[r])
      end = tfbPut(out, end, "</td><td>")
      end = tfbEscape(out, end, this.text, this.starts[r], this.lengths[r])
      end = tfbPut(out, end, "</td></tr>")
    }
    return tfbPut(out, end, "</table></body></html>")
  }
}

/** One request in flight and everything its answer needs. */
class TfbJob {
  req: HttpRequest | null = null
  /** The rows it read: `ids[k]` and `numbers[k]` for `k` below `rows`. */
  ids: i64[]
  numbers: i64[]
  /** The update's parameters: each distinct id once, ascending, and its new number. */
  updateIds: i64[]
  updateNumbers: i64[]
  /** The Fortune rows it read. */
  fortunes: TfbFortunes
  route: i32 = 0
  phase: i32 = 0
  /** How many rows it asks for, how many queries it queued, how many of those have had their final event. */
  count: i32 = 0
  queued: i32 = 0
  finished: i32 = 0
  rows: i32 = 0
  updates: i32 = 0
  failed: boolean = false
  /** Whether it waits in `TfbDb.waiting` for the carrier to have room. */
  listed: boolean = false

  constructor() {
    this.ids = new Array<i64>(TFB_MAX_COUNT)
    this.numbers = new Array<i64>(TFB_MAX_COUNT)
    this.updateIds = new Array<i64>(TFB_MAX_COUNT)
    this.updateNumbers = new Array<i64>(TFB_MAX_COUNT)
    this.fortunes = new TfbFortunes()
  }
}


/** The database half of the TechEmpower entry: a handler, its carrier and the jobs in flight. */
export class TfbDb {
  readonly h: HttpHandler
  readonly carrier: PgCarrier
  private jobs: TfbJob[]
  private free: i32[]
  /** Jobs with keys or an update the carrier had no room for, or waiting on the cache. */
  private waiting: i32[]
  private json: JsonWriter
  private jsonBuf: u8[]
  private html: u8[]
  private names: u8[][]
  private jsonValues: u8[][]
  private htmlValues: u8[][]
  private serverName: u8[][]
  private serverValue: u8[][]
  /** The cached World table: `cache[id]` is its randomNumber. */
  private cache: i64[]
  /** The batcher every World read goes through. */
  readonly world: i32
  private freeCount: i32 = 0
  private waitingCount: i32 = 0
  /** The tag of the start-up read of the table, past every job's index. */
  private cacheTag: i32 = 0
  /** How many requests were answered 503 because a query failed. */
  failures: i32 = 0
  private cacheReady: boolean = false
  private cacheLoading: boolean = false
  private cacheFailed: boolean = false
  /** What the last turn left: work refused for room makes the next wait short. */
  private refused: boolean = false

  /**
   * Builds the handler on `listener` with `slots` connections, registers the
   * entry's statements on `pool` (which must have no connection yet), and
   * the carrier that connects it to `target` with room for `queries`
   * queries (`TFB_QUERY_ROOM`; a test passes fewer to fill it).
   */
  constructor(listener: i32, slots: i32, pool: PgPool, target: PgTarget, queries: i32) {
    const router = new Router(new RouterLimits())
    router.add("GET", "/db")
    router.add("GET", "/queries")
    router.add("GET", "/updates")
    router.add("GET", "/cached-queries")
    router.add("GET", "/fortunes")
    const limits = new HandlerLimits()
    limits.slots = slots
    this.h = new HttpHandler(limits, listener, router)
    const types: i32[] = []
    pool.register("fortune", TFB_FORTUNE_SQL, types)
    pool.register("cache", TFB_CACHE_SQL, types)
    pool.register("update", TFB_UPDATE_SQL, types)
    const carrierLimits = new PgCarrierLimits()
    carrierLimits.queries = queries
    carrierLimits.executions = 1024
    this.carrier = new PgCarrier(carrierLimits, pool, target, this.h)
    const batch = new PgBatchConfig()
    batch.name = "world"
    batch.select = "select id, randomnumber from world where id = q.key"
    batch.maxRequests = 1024
    batch.maxBytes = 65536
    batch.queueSize = 65536
    batch.runs = 64
    this.world = this.carrier.attach(new PgBatcher(batch))
    this.jobs = []
    this.free = new Array<i32>(slots)
    this.waiting = new Array<i32>(slots)
    for (let k: i32 = 0; k < slots; k++) {
      this.jobs.push(new TfbJob())
      this.free[k] = slots - 1 - k
    }
    this.freeCount = slots
    this.cacheTag = slots
    this.jsonBuf = new Array<u8>(TFB_JSON_BYTES)
    this.json = new JsonWriter(this.jsonBuf, ZERO)
    this.html = new Array<u8>(TFB_HTML_BYTES)
    this.names = [tfbAscii("Server"), tfbAscii("Content-Type")]
    this.jsonValues = [tfbAscii("nish"), tfbAscii("application/json")]
    this.htmlValues = [tfbAscii("nish"), tfbAscii("text/html; charset=utf-8")]
    this.serverName = [tfbAscii("Server")]
    this.serverValue = [tfbAscii("nish")]
    this.cache = new Array<i64>(TFB_WORLD_ROWS + 1)
  }

  /**
   * One turn: wait on the handler up to `idleMs` (1 while work waits for
   * room), take every whole request, queue what waits, and read the
   * carrier's events until none is left.
   */
  turn(idleMs: i32): void {
    if (!this.cacheReady && !this.cacheLoading) {
      this.loadCache()
    }
    this.h.wait(this.refused && idleMs > BUSY_WAIT_MS ? BUSY_WAIT_MS : idleMs)
    while (this.h.ready()) {
      this.take(this.h.take())
    }
    this.refused = false
    this.retry()
    this.events()
  }

  /** Queues the start-up read of the World table; a failed one is tried again next turn. */
  private loadCache(): void {
    if (this.carrier.run(null, this.cacheTag) >= 0) {
      this.cacheLoading = true
      this.cacheFailed = false
    } else {
      this.refused = true
    }
  }

  private take(req: HttpRequest): void {
    const route: i32 = req.route
    if (route < TFB_DB || route > TFB_FORTUNES || this.freeCount === 0) {
      this.h.refuse(req)
      return
    }
    this.freeCount -= 1
    const index: i32 = this.free[this.freeCount]
    const job: TfbJob = this.jobs[index]
    job.req = req
    job.route = route
    job.phase = PHASE_READ
    job.queued = 0
    job.finished = 0
    job.rows = 0
    job.failed = false
    job.listed = false
    job.fortunes.reset()
    if (route === TFB_DB) {
      job.count = 1
    } else if (route === TFB_QUERIES || route === TFB_UPDATES) {
      job.count = tfbCount(req, "queries")
    } else if (route === TFB_CACHED) {
      job.count = tfbCount(req, "count")
      if (!this.cacheReady) {
        job.phase = PHASE_CACHE
        this.list(index)
        return
      }
      this.answerCached(index)
      return
    } else {
      job.count = 1
      if (this.carrier.run(req, index) < 0) {
        this.release(index)
        this.h.sendFields(req, 503, this.serverName, this.serverValue, this.jsonBuf, ZERO, ZERO)
      } else {
        job.queued = 1
      }
      return
    }
    this.queue(index)
  }

  /** Queues job `index`'s keys while the carrier has room; the rest wait for the next turn. */
  private queue(index: i32): void {
    const job: TfbJob = this.jobs[index]
    const req: HttpRequest | null = job.req
    if (req === null) {
      return
    }
    while (job.queued < job.count && !job.failed) {
      if (this.carrier.runInt(req, this.world, tfbWorldId(), index) === PG_CARRIER_FULL) {
        this.list(index)
        return
      }
      job.queued += 1
    }
  }

  private list(index: i32): void {
    const job: TfbJob = this.jobs[index]
    this.refused = true
    if (!job.listed) {
      job.listed = true
      this.waiting[this.waitingCount] = index
      this.waitingCount += 1
    }
  }

  /** Gives each waiting job another try, in the order they waited. */
  private retry(): void {
    const n: i32 = this.waitingCount
    if (n === 0) {
      return
    }
    this.waitingCount = 0
    for (let k: i32 = 0; k < n; k++) {
      const index: i32 = this.waiting[k]
      const job: TfbJob = this.jobs[index]
      job.listed = false
      if (job.phase === PHASE_READ) {
        this.queue(index)
      } else if (job.phase === PHASE_UPDATE_WAIT) {
        this.runUpdate(index)
      } else if (job.phase === PHASE_CACHE) {
        if (this.cacheReady) {
          this.answerCached(index)
        } else if (this.cacheFailed && !this.cacheLoading) {
          this.fail(index)
        } else {
          this.list(index)
        }
      }
    }
  }

  private events(): void {
    const c: PgCarrier = this.carrier
    let event: i32 = c.next()
    while (event !== PG_CARRIER_NONE) {
      const tag: i32 = c.tag
      if (tag === this.cacheTag) {
        this.cacheEvent(event)
      } else if (event === PG_CARRIER_BUILD) {
        this.build(tag)
      } else if (event === PG_CARRIER_ROW) {
        this.row(tag)
      } else if (event === PG_CARRIER_DONE || event === PG_CARRIER_MISSING || event === PG_CARRIER_FAILED) {
        this.final(tag, event)
      }
      event = c.next()
    }
  }

  private cacheEvent(event: i32): void {
    const c: PgCarrier = this.carrier
    if (event === PG_CARRIER_BUILD) {
      const conn: PgConnection = c.connection()
      conn.bindStart("cache")
      conn.bindEnd()
      c.send()
    } else if (event === PG_CARRIER_ROW) {
      const conn: PgConnection = c.connection()
      const id: i64 = conn.int(ZERO)
      if (id >= 1 && id <= toI64(TFB_WORLD_ROWS)) {
        this.cache[toI32(id)] = conn.int(toI32(1))
      }
    } else if (event === PG_CARRIER_DONE) {
      this.cacheLoading = false
      this.cacheReady = true
    } else if (event === PG_CARRIER_FAILED || event === PG_CARRIER_MISSING) {
      this.cacheLoading = false
      this.cacheFailed = true
    }
  }

  private build(index: i32): void {
    const c: PgCarrier = this.carrier
    const conn: PgConnection = c.connection()
    const job: TfbJob = this.jobs[index]
    if (job.route === TFB_FORTUNES) {
      conn.bindStart("fortune")
    } else {
      conn.bindStart("update")
      conn.paramIntArray(job.updateIds, ZERO, job.updates)
      conn.paramIntArray(job.updateNumbers, ZERO, job.updates)
    }
    conn.bindEnd()
    c.send()
  }

  private row(index: i32): void {
    const conn: PgConnection = this.carrier.connection()
    const job: TfbJob = this.jobs[index]
    if (job.route === TFB_FORTUNES) {
      const f: TfbFortunes = job.fortunes
      const length: i32 = conn.colLength(toI32(1))
      if (!f.room(length)) {
        job.failed = true
        return
      }
      const input: u8[] = conn.inputBuffer()
      const start: i32 = conn.colStart(toI32(1))
      for (let k: i32 = 0; k < length; k++) {
        f.text[f.textLength + k] = input[start + k]
      }
      f.push(conn.int(ZERO), length)
    } else if (job.phase === PHASE_READ && job.rows < job.count) {
      job.ids[job.rows] = conn.int(ZERO)
      job.numbers[job.rows] = conn.int(toI32(1))
      job.rows += 1
    }
  }

  private final(index: i32, event: i32): void {
    const job: TfbJob = this.jobs[index]
    if (event !== PG_CARRIER_DONE) {
      job.failed = true
    }
    job.finished += 1
    if (job.finished < job.queued || (job.queued < job.count && !job.failed)) {
      return
    }
    if (job.failed) {
      this.fail(index)
    } else if (job.route === TFB_FORTUNES) {
      this.answerFortunes(index)
    } else if (job.route === TFB_UPDATES && job.phase === PHASE_READ) {
      this.startUpdate(index)
    } else {
      this.answerWorlds(index)
    }
  }

  /** Draws each row's new number, then lists each distinct id once, ascending, with the number all its rows share. */
  private startUpdate(index: i32): void {
    const job: TfbJob = this.jobs[index]
    job.updates = tfbPlanUpdate(job.ids, job.numbers, job.rows, job.updateIds, job.updateNumbers)
    this.runUpdate(index)
  }

  private runUpdate(index: i32): void {
    const job: TfbJob = this.jobs[index]
    const req: HttpRequest | null = job.req
    if (req === null) {
      return
    }
    if (this.carrier.run(req, index) < 0) {
      job.phase = PHASE_UPDATE_WAIT
      this.list(index)
      return
    }
    job.phase = PHASE_UPDATE
    job.queued += 1
  }

  private answerWorlds(index: i32): void {
    const job: TfbJob = this.jobs[index]
    const w: JsonWriter = this.json
    w.reset(this.jsonBuf, ZERO)
    if (job.route === TFB_DB) {
      tfbWriteWorld(w, job.ids[0], job.numbers[0])
    } else {
      w.beginArray()
      for (let k: i32 = 0; k < job.rows; k++) {
        tfbWriteWorld(w, job.ids[k], job.numbers[k])
      }
      w.endArray()
    }
    this.sendJson(index)
  }

  private answerCached(index: i32): void {
    const job: TfbJob = this.jobs[index]
    const w: JsonWriter = this.json
    w.reset(this.jsonBuf, ZERO)
    w.beginArray()
    for (let k: i32 = 0; k < job.count; k++) {
      const id: i64 = tfbWorldId()
      tfbWriteWorld(w, id, this.cache[toI32(id)])
    }
    w.endArray()
    this.sendJson(index)
  }

  private sendJson(index: i32): void {
    const job: TfbJob = this.jobs[index]
    const req: HttpRequest | null = job.req
    this.release(index)
    if (req !== null) {
      this.h.sendFields(req, 200, this.names, this.jsonValues, this.jsonBuf, ZERO, this.json.end)
    }
  }

  private fail(index: i32): void {
    const req: HttpRequest | null = this.jobs[index].req
    this.release(index)
    this.failures += 1
    if (req !== null) {
      this.h.sendFields(req, 503, this.serverName, this.serverValue, this.jsonBuf, ZERO, ZERO)
    }
  }

  /** How many slots are free: every one of them once no request is in flight. */
  freeSlots(): i32 {
    return this.freeCount
  }

  /**
   * Frees job `index`'s slot. A job answered while it still waits for room
   * (a key failed after others were refused) leaves `waiting` here, so the
   * slot's next request is never retried, or released, a second time.
   */
  private release(index: i32): void {
    const job: TfbJob = this.jobs[index]
    job.req = null
    if (job.listed) {
      job.listed = false
      let to: i32 = 0
      for (let k: i32 = 0; k < this.waitingCount; k++) {
        const other: i32 = this.waiting[k]
        if (other !== index) {
          this.waiting[to] = other
          to += 1
        }
      }
      this.waitingCount = to
    }
    this.free[this.freeCount] = index
    this.freeCount += 1
  }

  private answerFortunes(index: i32): void {
    const job: TfbJob = this.jobs[index]
    const end: i32 = job.fortunes.render(this.html)
    if (end < 0) {
      this.fail(index)
      return
    }
    const req: HttpRequest | null = job.req
    this.release(index)
    if (req !== null) {
      this.h.sendFields(req, 200, this.names, this.htmlValues, this.html, ZERO, end)
    }
  }
}
