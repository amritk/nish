// The HttpArena entry's server: one `HttpServer` a worker, serving HTTP/1.1
// on the main port and h2c (prior knowledge) on the second, under
// `nish/net/prefork` with one worker a core, each pinned to its CPU, the main
// port's connections steered to the worker on the CPU that received them.
// Every body is built for its request: nothing is precomputed or cached by
// URL, as HttpArena's standard mode asks. See README.md for the routes.
import { DEFLATE_FAST } from "nish/compress/deflate"
import { JsonWriter } from "nish/json"
import { JsonDocument, JsonValue } from "nish/json-value"
import { JsonLimits } from "nish/json-tokenizer"
import { HANDLER_ABSENT } from "nish/net/handler"
import { HTTP_CODING_GZIP, HTTP_OFFER_GZIP, HttpCompressor, httpAcceptEncoding } from "nish/net/http-compress"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { Http2Config } from "nish/net/http2"
import {
  PreforkConfig,
  preforkArgs,
  preforkIndex,
  preforkListener,
  preforkWith,
  preforkWorkerCount,
} from "nish/net/prefork"
import { Router, RouterLimits } from "nish/net/router"
import { netLocalPort, tcpListenFlags } from "nish:net"
import { getenv, signalFd } from "nish:process"
import { ArenaDb } from "./db"

// The routes, in the order they are added.
const BASELINE_GET: i32 = 0
const BASELINE_POST: i32 = 1
const PIPELINE: i32 = 2
const DELAY: i32 = 3
const JSON_ROUTE: i32 = 4
const ASYNC_DB: i32 = 5
const BASELINE2: i32 = 6

/** `tcpListenFlags` bits: 1 is `SO_REUSEPORT`, 2 `TCP_NODELAY`, 4 steering by CPU. */
const REUSEPORT: i32 = 1
const NODELAY: i32 = 2
const STEER: i32 = 4
/** The listen backlog. */
const BACKLOG: i32 = 4096
/** The signal descriptor's watch id: SIGINT or SIGTERM ends the worker. */
const SIGNAL_ID: i32 = 0
/** The longest `/delay/{ms}` honoured, in milliseconds; a longer one waits this long. */
const DELAY_CAP_MS: i32 = 10000
/** The JSON answer buffer: 50 items are under 16 KiB. */
const JSON_BYTES: i32 = 65536

/** The bytes of an ASCII string. */
export const arenaBytes = (s: string): u8[] => {
  const out: u8[] = []
  for (let k: i32 = 0; k < toI32(s.length); k++) {
    out.push(toU8(s.charCodeAt(k)))
  }
  return out
}

/**
 * Parses `buf[start .. end)` as an optionally signed decimal of at most 18
 * digits, skipping whitespace around it; answers `fallback` for anything else.
 */
export const arenaDecimal = (buf: u8[], start: i32, end: i32, fallback: i32): i64 => {
  let v: i64 = 0
  let digits: i32 = 0
  let negative: boolean = false
  // 0 before the number, 1 in its digits, 2 in the whitespace after it.
  let phase: i32 = 0
  for (let k: i32 = start; k < end; k++) {
    if (k < 0 || k >= toI32(buf.length)) {
      return toI64(fallback)
    }
    const c: i32 = toI32(buf[k])
    const space: boolean = c === 32 || c === 9 || c === 13 || c === 10
    if (c >= 48 && c <= 57 && phase < 2 && digits < 18) {
      v = v * 10 + toI64(c - 48)
      digits++
      phase = 1
    } else if (space && phase !== 1 || space && phase === 1) {
      phase = phase === 0 ? 0 : 2
    } else if ((c === 45 || c === 43) && phase === 0 && digits === 0 && !negative) {
      negative = c === 45
      phase = 1
    } else {
      return toI64(fallback)
    }
  }
  if (digits === 0) {
    return toI64(fallback)
  }
  return negative ? -v : v
}

/** The dataset's items, column by column, read once from `/data/dataset.json`. */
export class ArenaDataset {
  ids: i64[] = []
  names: string[] = []
  categories: string[] = []
  prices: i64[] = []
  quantities: i64[] = []
  active: boolean[] = []
  tags: string[][] = []
  scores: i64[] = []
  counts: i64[] = []

  /** How many items the dataset holds. */
  size(): i32 {
    return toI32(this.ids.length)
  }
}

/** Reads the dataset's JSON text into columns; an unreadable or malformed one gives no items. */
export const arenaDataset = (text: string): ArenaDataset => {
  const out = new ArenaDataset()
  const doc = new JsonDocument(new JsonLimits())
  const root: JsonValue = doc.parseText(text)
  if (doc.kind(root) !== 5) {
    return out
  }
  const n: i32 = doc.length(root)
  for (let k: i32 = 0; k < n; k++) {
    const item: JsonValue = doc.at(root, k)
    out.ids.push(doc.i64(doc.get(item, "id")))
    out.names.push(doc.string(doc.get(item, "name")))
    out.categories.push(doc.string(doc.get(item, "category")))
    out.prices.push(doc.i64(doc.get(item, "price")))
    out.quantities.push(doc.i64(doc.get(item, "quantity")))
    out.active.push(doc.boolean(doc.get(item, "active")))
    const tags: JsonValue = doc.get(item, "tags")
    const list: string[] = []
    for (let t: i32 = 0; t < doc.length(tags); t++) {
      list.push(doc.string(doc.at(tags, t)))
    }
    out.tags.push(list)
    const rating: JsonValue = doc.get(item, "rating")
    out.scores.push(doc.i64(doc.get(rating, "score")))
    out.counts.push(doc.i64(doc.get(rating, "count")))
  }
  return out
}

/** A `/delay/{ms}` request held until its `monotonicNanos` deadline. */
class ArenaHeld {
  r: HttpServerRequest
  due: i64
  ms: i32

  constructor(r: HttpServerRequest, due: i64, ms: i32) {
    this.r = r
    this.due = due
    this.ms = ms
  }
}

/** One worker's server: its `HttpServer`, the dataset, the held delays and the database. */
export class ArenaServer {
  h: HttpServer
  data: ArenaDataset
  db: ArenaDb
  held: ArenaHeld[] = []
  enc: HttpCompressor
  out: JsonWriter
  scratch: u8[]
  digits: u8[]
  textType: u8[]
  jsonType: u8[]
  jsonNames: u8[][]
  jsonValues: u8[][]
  okBody: u8[]
  /** How many requests this worker answered. */
  answered: i64 = 0

  /**
   * Serves HTTP/1.1 on `fd1` and h2c on `fd2` (when not negative), with
   * `slots` connections on each, the dataset `data` and the database `db`.
   */
  constructor(fd1: i32, fd2: i32, slots: i32, data: ArenaDataset, db: ArenaDb) {
    const router = new Router(new RouterLimits())
    router.add("GET", "/baseline11")
    router.add("POST", "/baseline11")
    router.add("GET", "/pipeline")
    router.add("GET", "/delay/:ms")
    router.add("GET", "/json/:count")
    router.add("GET", "/async-db")
    router.add("GET", "/baseline2")
    const limits = new HttpServerLimits()
    limits.requests = 65536
    limits.maxBody = 65536
    this.h = new HttpServer(limits, router)
    this.h.listenHttp1(fd1, new Http1Config(), slots)
    if (fd2 >= 0) {
      this.h.listenH2c(fd2, new Http2Config(), slots)
    }
    this.data = data
    this.db = db
    this.enc = new HttpCompressor(DEFLATE_FAST, 1, 1048576)
    this.out = new JsonWriter(new Array<u8>(JSON_BYTES), 0)
    this.scratch = new Array<u8>(64)
    this.digits = new Array<u8>(24)
    this.textType = arenaBytes("text/plain")
    this.jsonType = arenaBytes("application/json")
    this.jsonNames = [arenaBytes("content-type")]
    this.jsonValues = [arenaBytes("application/json")]
    this.okBody = arenaBytes("ok")
    this.db.attach(this.h)
  }

  /** The longest the next `wait` may block: until the first held delay or database deadline is due, or -1. */
  waitMs(now: i64): i32 {
    let best: i64 = -1
    for (let k: i32 = 0; k < toI32(this.held.length); k++) {
      const left: i64 = this.held[k].due - now
      if (best < 0 || left < best) {
        best = left < 0 ? 0 : left
      }
    }
    let ms: i32 = best < 0 ? -1 : toI32((best + 999999) / 1000000)
    const dbMs: i32 = this.db.waitMs()
    if (dbMs >= 0 && (ms < 0 || dbMs < ms)) {
      ms = dbMs
    }
    return ms
  }

  /** One turn: waits, answers every request ready and every delay due. Answers false once a stop signal came. */
  turn(): boolean {
    this.h.wait(this.waitMs(monotonicNanos()))
    if (this.h.fired(SIGNAL_ID)) {
      return false
    }
    this.db.turn(this.h)
    while (this.h.ready()) {
      this.answer(this.h.take())
    }
    this.release(monotonicNanos())
    return true
  }

  /** Answers every held delay whose deadline has passed, with its `ms`. */
  release(now: i64): void {
    let k: i32 = 0
    while (k < toI32(this.held.length)) {
      const d: ArenaHeld = this.held[k]
      if (d.due <= now) {
        this.held[k] = this.held[toI32(this.held.length) - 1]
        this.held.pop()
        this.sendNumber(d.r, toI64(d.ms))
      } else {
        k++
      }
    }
  }

  /** Answers 200 `text/plain` with the decimal `v`. */
  sendNumber(r: HttpServerRequest, v: i64): void {
    const text: string = `${v}`
    const n: i32 = toI32(text.length)
    for (let k: i32 = 0; k < n && k < toI32(this.digits.length); k++) {
      this.digits[k] = toU8(text.charCodeAt(k))
    }
    this.h.send(r, 200, this.textType, this.digits, 0, n)
    this.answered += 1
  }

  /** The query parameter `name` as a decimal, or `fallback` when absent or not one. */
  queryDecimal(r: HttpServerRequest, name: string, fallback: i32): i64 {
    const n: i32 = r.query(name, this.scratch)
    if (n < 0 || n > toI32(this.scratch.length)) {
      return toI64(fallback)
    }
    return arenaDecimal(this.scratch, 0, n, fallback)
  }

  answer(r: HttpServerRequest): void {
    switch (r.route) {
      case BASELINE_GET:
      case BASELINE2:
        this.sendNumber(r, this.queryDecimal(r, "a", 0) + this.queryDecimal(r, "b", 0))
        break
      case BASELINE_POST:
        this.sendNumber(
          r,
          this.queryDecimal(r, "a", 0) +
            this.queryDecimal(r, "b", 0) +
            arenaDecimal(r.body, 0, r.bodyLength, 0)
        )
        break
      case PIPELINE:
        this.h.send(r, 200, this.textType, this.okBody, 0, 2)
        this.answered += 1
        break
      case DELAY: {
        let ms: i32 = r.paramDecimal(0)
        if (ms < 0) {
          ms = 0
        }
        if (ms > DELAY_CAP_MS) {
          ms = DELAY_CAP_MS
        }
        if (ms === 0) {
          this.sendNumber(r, toI64(0))
        } else {
          this.held.push(new ArenaHeld(r, monotonicNanos() + toI64(ms) * 1000000, ms))
        }
        break
      }
      case JSON_ROUTE:
        this.json(r)
        break
      case ASYNC_DB:
        this.db.query(
          this.h,
          r,
          this.queryDecimal(r, "min", 10),
          this.queryDecimal(r, "max", 50),
          this.queryDecimal(r, "limit", 50)
        )
        this.answered += 1
        break
      default:
        this.h.refuse(r)
    }
  }

  /** `/json/{count}?m=`: the first `count` items with `total`, gzipped over HTTP/1.1 when asked. */
  json(r: HttpServerRequest): void {
    let count: i32 = r.paramDecimal(0)
    if (count < 0) {
      count = 0
    }
    if (count > this.data.size()) {
      count = this.data.size()
    }
    const m: i64 = this.queryDecimal(r, "m", 1)
    const w: JsonWriter = this.out
    w.reset(w.buf, 0)
    w.beginObject()
    w.key("items")
    w.beginArray()
    const d: ArenaDataset = this.data
    for (let k: i32 = 0; k < count; k++) {
      w.beginObject()
      w.key("id")
      w.i64(d.ids[k])
      w.key("name")
      w.string(d.names[k])
      w.key("category")
      w.string(d.categories[k])
      w.key("price")
      w.i64(d.prices[k])
      w.key("quantity")
      w.i64(d.quantities[k])
      w.key("active")
      w.boolean(d.active[k])
      w.key("tags")
      w.beginArray()
      const tags: string[] = d.tags[k]
      for (let t: i32 = 0; t < toI32(tags.length); t++) {
        w.string(tags[t])
      }
      w.endArray()
      w.key("rating")
      w.beginObject()
      w.key("score")
      w.i64(d.scores[k])
      w.key("count")
      w.i64(d.counts[k])
      w.endObject()
      w.key("total")
      w.i64(d.prices[k] * d.quantities[k] * m)
      w.endObject()
    }
    w.endArray()
    w.key("count")
    w.i32(count)
    w.endObject()
    const len: i32 = w.end
    this.answered += 1
    const i: i32 = r.header("accept-encoding")
    if (r.version === 1 && i !== HANDLER_ABSENT) {
      const coding: i32 = httpAcceptEncoding(r.head, r.valueStart(i), r.valueEnd(i), HTTP_OFFER_GZIP)
      if (coding === HTTP_CODING_GZIP) {
        const n: i32 = this.enc.compressAnyway(coding, w.buf, 0, len)
        if (n >= 0) {
          this.enc.addFields(this.jsonNames, this.jsonValues)
          this.h.start(r, 200, this.enc.names, this.enc.values, n)
          this.h.write(r, this.enc.output, 0, n)
          this.h.end(r)
          return
        }
      }
    }
    this.h.send(r, 200, this.jsonType, w.buf, 0, len)
  }
}

const arenaArg = (args: string[], k: i32, fallback: string): string =>
  toI32(args.length) > k ? args[k] : fallback

/**
 * The entry's program: `args[at ..]` are `[port] [h2c port] [host] [slots]
 * [workers] [dataset]`, defaulting to 8080, 8082, 0.0.0.0, 16384, 0 (one
 * worker a core; `NISH_WORKERS` overrides any but 1) and
 * `/data/dataset.json`. With more than one worker, `nish/net/prefork` binds
 * one steered `SO_REUSEPORT` listener a worker on the main port and pins
 * worker `k` to CPU `k`; the h2c port is a plain `SO_REUSEPORT` listener each
 * worker binds itself. Each serving process calls `listening(worker, port,
 * h2cPort)` once it is ready and `stopped(worker, server)` on SIGINT or
 * SIGTERM, then answers 0; the supervisor answers 0 once its workers are
 * gone, and 1 when it or a listener could not start.
 */
export const arenaMain = (
  args: string[],
  at: i32,
  listening: (worker: i32, port: i32, h2cPort: i32) => void,
  stopped: (worker: i32, server: ArenaServer) => void
): i32 => {
  const given: string[] = preforkArgs(args)
  const port: i32 = parseInt(arenaArg(given, at, "8080"))
  const h2cPort: i32 = parseInt(arenaArg(given, at + 1, "8082"))
  const host: string = arenaArg(given, at + 2, "0.0.0.0")
  const slots: i32 = parseInt(arenaArg(given, at + 3, "16384"))
  const asked: i32 = parseInt(arenaArg(given, at + 4, "0"))
  const path: string = arenaArg(given, at + 5, "/data/dataset.json")
  const workers: i32 = asked === 1 ? 1 : preforkWorkerCount(asked, getenv("NISH_WORKERS"))
  let worker: i32 = -1
  let listener: i32 = -1
  if (workers > 1 || preforkIndex(args) >= 0) {
    const config = new PreforkConfig()
    config.workers = workers
    config.listenPort = port
    config.listenHost = host
    config.listenBacklog = BACKLOG
    config.listenFlags = NODELAY | STEER
    config.pin = true
    worker = preforkWith(args, config)
    if (worker < 0) {
      return worker === -1 ? 0 : 1
    }
    listener = preforkListener(args)
  } else {
    listener = tcpListenFlags(host, port, BACKLOG, NODELAY)
  }
  if (listener < 0) {
    console.log(`listen failed ${listener}`)
    return 1
  }
  const h2c: i32 = tcpListenFlags(host, h2cPort, BACKLOG, REUSEPORT | NODELAY)
  if (h2c < 0) {
    console.log(`h2c listen failed ${h2c}`)
    return 1
  }
  // A missing dataset ends the worker, as `readFileSync` does: HttpArena always mounts it.
  const text: string = readFileSync(path)
  const db = new ArenaDb(getenv("DATABASE_URL"), getenv("DATABASE_MAX_CONN"), workers)
  const server = new ArenaServer(listener, h2c, slots, arenaDataset(text), db)
  server.h.watch(signalFd(), SIGNAL_ID)
  listening(worker, netLocalPort(listener), netLocalPort(h2c))
  while (server.turn()) {}
  stopped(worker, server)
  return 0
}
