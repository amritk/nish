// The ring measurement's server (WP63 S4; bench/handler-ring/run.sh): a
// stand-in for the benchmark entry, built the way the entry is, on
// `nish/net/handler` with one SQLite database. The entry itself is not in this
// repository; this server answers what bench/fd-limit/loadgen.c asks, with the
// work the entry's read route does.
//
//   GET /plaintext  one post looked up by a random id with bench/sqlite's
//                   lookup query (the post, its author and its like count),
//                   answered as 13 bytes of text/plain under `Server: nish`, `<id, 7 digits>
//                   <likes, 5 digits>`: loadgen counts responses by their
//                   length, 129 bytes, as it does the fd-limit prototypes'
//   anything else   404, or 405 with its Allow
//
// Usage: server <port> <slots> <db>. It prints `listening <port>` once the
// handler is built and serves until it is killed. With BENCH_CORES=N above 1
// it runs as N workers under `nish/net/prefork`, each with its own listener
// (SO_REUSEPORT), its own handler of `slots` slots and its own connection to
// the database. BENCH_RING=1 sets `HandlerLimits.ring`, so each listener
// takes its connections into io_uring slots and `slots` may pass the
// descriptor limit; worker 0 prints `rings <netRingState()>` after
// `listening`, 1 when the kernel took rings.
//
// BENCH_MIN_EVENTS=M and BENCH_MAX_WAIT_MS=W set `HandlerLimits.minEvents`
// and `maxWaitMs`, so a turn with fewer than M events waits up to W ms for
// more (`pollWaitBatch`); unset, they keep the handler's defaults, 1 and 0,
// and the wait is plain `pollWait`. Under BENCH_RING=1, worker 0 prints
// `batch <minEvents> <maxWaitMs>` before `rings`.
//
// Two knobs for the cheaper wins (WP63 S5; bench/handler-ring/wins.sh):
// BENCH_MMAP=1 runs `PRAGMA mmap_size=268435456` on each worker's connection
// after it opens, and worker 0 prints `mmap <the value SQLite reports>`.
// BENCH_CACHE=shm keeps each post's like count, once looked up, in one
// `nish/sync/shm` region all the workers map (the supervisor makes it); a
// request whose id is cached answers without SQLite. BENCH_CACHE=private keeps
// the same table in each worker's own memory, the cache the shared one
// replaces. Nothing writes the database, so neither cache goes stale. With
// either, each worker prints `cache <worker> <hits> <misses>` every 4,096
// requests.
//
// BENCH_NODB=1 is the no-database route (bench/http1-request's breakdown in
// docs/BENCHMARKS.md, "A minimal GET on Http1Server"): /plaintext answers the
// same 129 bytes with the random id and a like count of 0 and makes no query
// (the database is still opened and the lookup prepared, and never stepped),
// so a request costs the handler and the codec alone.
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { PREFORK_STOPPED, PreforkConfig, preforkArgs, preforkIndex, preforkWith } from "nish/net/prefork"
import { Router, RouterLimits } from "nish/net/router"
import { OPEN_READWRITE, Statement, openDatabase } from "nish/sqlite"
import { RELAXED, SharedRegion, createRegion, openRegion, unlinkRegion } from "nish/sync/shm"
import { netRingState } from "nish:net"
import { getenv } from "nish:process"

const OK: i32 = 200
const ERROR: i32 = 500
const ROUTE_PLAINTEXT: i32 = 0
const TURN_MS: i32 = 1000
/** bench/sqlite's post count; ids run from 1 to it. */
const POSTS: i32 = 500000
const LOOKUP_SQL: string =
  "SELECT p.id, p.body, p.created_at, u.username, (SELECT count(*) FROM likes l WHERE l.post_id = p.id) FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?"
/** The answer's length: loadgen.c's 129-byte response has a 13-byte body. */
const BODY: i32 = 13
/** `PRAGMA mmap_size` under BENCH_MMAP=1: 256 MiB, design §9's figure. */
const MMAP_SQL: string = "PRAGMA mmap_size=268435456"
const CACHE_NONE: i32 = 0
const CACHE_SHM: i32 = 1
const CACHE_PRIVATE: i32 = 2
/** BENCH_NODB=1: no query, the lookup's statement never stepped. */
const CACHE_NODB: i32 = 3
/** The shared cache's region: one i32 a post, its like count plus 1, 0 when not yet looked up. */
const CACHE_REGION: string = "nish-bench-cache"
const CACHE_BYTES: i32 = (POSTS + 1) * 4
/** How many requests a worker answers between its `cache` lines. */
const CACHE_REPORT: i32 = 4096

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** `value` as `width` decimal digits into `out` from `at`, its high digits cut. */
const digitsInto = (out: u8[], at: i32, width: i32, value: i64): void => {
  let v: i64 = value < 0 ? 0 : value
  for (let k: i32 = at + width - 1; k >= at && k < toI32(out.length); k--) {
    out[k] = toU8(48 + toI32(v % 10))
    v = v / 10
  }
}

class Entry {
  h: HttpHandler
  st: Statement
  body: u8[]
  oops: u8[]
  names: u8[][]
  values: u8[][]
  /** The lookup's xorshift state: bench/sqlite/main.ts's generator, each worker seeded apart. */
  x: u32
  /** CACHE_NONE, CACHE_SHM or CACHE_PRIVATE. */
  mode: i32
  /** The shared cache under CACHE_SHM. */
  shared: SharedRegion | null = null
  /** The private cache under CACHE_PRIVATE, laid out as the region is. */
  own: i32[]
  worker: i32
  hits: i64
  misses: i64

  constructor(h: HttpHandler, st: Statement, seed: u32, mode: i32, worker: i32) {
    this.h = h
    this.st = st
    this.mode = mode
    this.own = new Array<i32>(mode === CACHE_PRIVATE ? POSTS + 1 : 0)
    this.worker = worker
    this.hits = 0
    this.misses = 0
    this.body = new Array<u8>(BODY)
    this.body[7] = toU8(32)
    this.oops = bytesOf("lookup failed")
    // `Server: nish` as bench/http1-server.ts sends it, for loadgen's 129 bytes.
    this.names = [bytesOf("Server"), bytesOf("Content-Type")]
    this.values = [bytesOf("nish"), bytesOf("text/plain")]
    this.x = seed
  }

  /** One post by a random id: its id and like count into `body`; false when SQLite failed. */
  lookup(): boolean {
    let x: u32 = this.x
    x = x ^ (x << 13)
    x = x ^ (x >> 17)
    x = x ^ (x << 5)
    this.x = x
    const id: i32 = toI32(x % toU32(POSTS)) + 1
    if (this.mode === CACHE_NODB) {
      digitsInto(this.body, 0, 7, toI64(id))
      digitsInto(this.body, 8, 5, 0)
      return true
    }
    const cached: i32 = this.cached(id)
    if (cached > 0) {
      this.hits = this.hits + 1
      this.report()
      digitsInto(this.body, 0, 7, toI64(id))
      digitsInto(this.body, 8, 5, toI64(cached - 1))
      return true
    }
    const st: Statement = this.st
    let ok: boolean = st.bindI64(1, toI64(id)).isOk()
    const r = st.step()
    if (ok && r.isOk() && r.value) {
      const likes: i64 = st.columnI64(4)
      digitsInto(this.body, 0, 7, st.columnI64(0))
      digitsInto(this.body, 8, 5, likes)
      this.keep(id, toI32(likes) + 1)
    } else {
      ok = false
    }
    if (this.mode !== CACHE_NONE) {
      this.misses = this.misses + 1
      this.report()
    }
    return st.reset().isOk() && ok
  }

  /** Post `id`'s cached like count plus 1, or 0 when it is not cached or there is no cache. */
  cached(id: i32): i32 {
    if (this.mode === CACHE_PRIVATE && id < toI32(this.own.length)) {
      return this.own[id]
    }
    const region: SharedRegion | null = this.shared
    if (region !== null) {
      return region.loadI32(id * 4, RELAXED)
    }
    return 0
  }

  /** Caches post `id`'s like count plus 1, when there is a cache. */
  keep(id: i32, value: i32): void {
    if (this.mode === CACHE_PRIVATE && id < toI32(this.own.length)) {
      this.own[id] = value
    }
    const region: SharedRegion | null = this.shared
    if (region !== null) {
      region.storeI32(id * 4, value, RELAXED)
    }
  }

  /** The `cache` line, every CACHE_REPORT requests. */
  report(): void {
    if ((this.hits + this.misses) % toI64(CACHE_REPORT) === 0) {
      console.log(`cache ${this.worker} ${this.hits} ${this.misses}`)
    }
  }

  run(): void {
    while (true) {
      this.h.wait(TURN_MS)
      while (this.h.ready()) {
        const r: HttpRequest = this.h.take()
        if (r.route !== ROUTE_PLAINTEXT) {
          this.h.refuse(r)
        } else if (this.lookup()) {
          this.h.sendFields(r, OK, this.names, this.values, this.body, 0, BODY)
        } else {
          this.h.sendFields(r, ERROR, this.names, this.values, this.oops, 0, toI32(this.oops.length))
        }
      }
    }
  }
}

/** The worker count `BENCH_CORES` asks for; 1 when it is unset or not a number. */
const benchCores = (): i32 => {
  const env: string | null = getenv("BENCH_CORES")
  const n: i32 = env !== null ? parseInt(env) : 1
  return n > 1 ? n : 1
}

/** The cache `BENCH_CACHE` asks for: `shm`, `private`, or none; CACHE_NODB under BENCH_NODB=1. */
const benchCache = (): i32 => {
  const nodb: string | null = getenv("BENCH_NODB")
  if (nodb !== null && nodb === "1") {
    return CACHE_NODB
  }
  const env: string | null = getenv("BENCH_CACHE")
  if (env !== null && env === "shm") {
    return CACHE_SHM
  }
  return env !== null && env === "private" ? CACHE_PRIVATE : CACHE_NONE
}

/** Makes the shared cache's region, after removing one a killed run left; null when it cannot. */
const makeCache = (): SharedRegion | null => {
  const stale = unlinkRegion(CACHE_REGION)
  if (stale.isErr()) {
    // None: the usual case.
  }
  const made = createRegion(CACHE_REGION, CACHE_BYTES)
  if (made.isErr()) {
    console.error(`server: the cache region: ${made.error.code}`)
    return null
  }
  return made.value
}

export const main = (): i32 => {
  const cores: i32 = benchCores()
  const mode: i32 = benchCache()
  let worker: i32 = 0
  // The supervisor (or the only process) makes the region; workers open it by name.
  let region: SharedRegion | null = null
  if (mode === CACHE_SHM && (cores <= 1 || preforkIndex(process.argv) < 0)) {
    region = makeCache()
    if (region === null) {
      return 1
    }
  }
  if (cores > 1) {
    const config: PreforkConfig = new PreforkConfig()
    config.workers = cores
    worker = preforkWith(process.argv, config)
    if (worker < 0) {
      return worker === PREFORK_STOPPED ? 0 : 1
    }
  }
  const args: string[] = preforkArgs(process.argv)
  if (args.length !== 4) {
    console.error("usage: server <port> <slots> <db>")
    return 2
  }
  const port: i32 = parseInt(args[1])
  const opened = openDatabase(args[3], OPEN_READWRITE)
  if (opened.isErr()) {
    console.error(`server: ${opened.error.message}`)
    return 1
  }
  const db = opened.value
  const mmap: string | null = getenv("BENCH_MMAP")
  if (mmap !== null && mmap === "1") {
    if (db.exec(MMAP_SQL).isErr()) {
      console.error("server: PRAGMA mmap_size failed")
      return 1
    }
    const q = db.prepare("PRAGMA mmap_size")
    if (q.isErr()) {
      console.error(`server: ${q.error.message}`)
      return 1
    }
    const st: Statement = q.value
    const r = st.step()
    if (worker === 0 && r.isOk() && r.value) {
      console.log(`mmap ${st.columnI64(0)}`)
    }
    if (st.finalize().isErr()) {
      return 1
    }
  }
  if (mode === CACHE_SHM && cores > 1) {
    const opened2 = openRegion(CACHE_REGION)
    if (opened2.isErr()) {
      console.error(`server: open the cache region: ${opened2.error.code}`)
      return 1
    }
    region = opened2.value
  }
  const prepared = db.prepare(LOOKUP_SQL)
  if (prepared.isErr()) {
    console.error(`server: ${prepared.error.message}`)
    return 1
  }
  const limits: HandlerLimits = new HandlerLimits()
  limits.slots = parseInt(args[2])
  limits.maxEvents = 128
  // The loadgen opens every connection before its first request, and 300,000
  // take about 95 s to open: past the carrier's 60 s default the first ones
  // would be closed as idle before the window starts. Ten minutes covers it.
  limits.http.idleTimeout = 600000
  const ring: string | null = getenv("BENCH_RING")
  limits.ring = ring !== null && ring === "1"
  const minEvents: string | null = getenv("BENCH_MIN_EVENTS")
  if (minEvents !== null) {
    limits.minEvents = parseInt(minEvents)
  }
  const maxWaitMs: string | null = getenv("BENCH_MAX_WAIT_MS")
  if (maxWaitMs !== null) {
    limits.maxWaitMs = parseInt(maxWaitMs)
  }
  const listener: i32 = limits.listen("127.0.0.1", port, 4096, cores > 1 ? 1 : 0)
  if (listener < 0) {
    console.error(`server: listen failed ${listener}`)
    return 1
  }
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/plaintext")
  const entry: Entry = new Entry(
    new HttpHandler(limits, listener, router),
    prepared.value,
    2463534242 + toU32(worker),
    mode,
    worker
  )
  entry.shared = region
  if (worker === 0) {
    console.log(`listening ${port}`)
    if (limits.ring) {
      console.log(`batch ${limits.minEvents} ${limits.maxWaitMs}`)
      console.log(`rings ${netRingState()}`)
    }
  }
  entry.run()
  return 0
}
