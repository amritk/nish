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
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { PREFORK_STOPPED, PreforkConfig, preforkArgs, preforkWith } from "nish/net/prefork"
import { Router, RouterLimits } from "nish/net/router"
import { OPEN_READWRITE, Statement, openDatabase } from "nish/sqlite"
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

  constructor(h: HttpHandler, st: Statement, seed: u32) {
    this.h = h
    this.st = st
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
    const st: Statement = this.st
    let ok: boolean = st.bindI64(1, toI64(x % toU32(POSTS)) + 1).isOk()
    const r = st.step()
    if (ok && r.isOk() && r.value) {
      digitsInto(this.body, 0, 7, st.columnI64(0))
      digitsInto(this.body, 8, 5, st.columnI64(4))
    } else {
      ok = false
    }
    return st.reset().isOk() && ok
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

export const main = (): i32 => {
  const cores: i32 = benchCores()
  let worker: i32 = 0
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
  const prepared = db.prepare(LOOKUP_SQL)
  if (prepared.isErr()) {
    console.error(`server: ${prepared.error.message}`)
    return 1
  }
  const limits: HandlerLimits = new HandlerLimits()
  limits.slots = parseInt(args[2])
  limits.maxEvents = 128
  const ring: string | null = getenv("BENCH_RING")
  limits.ring = ring !== null && ring === "1"
  const listener: i32 = limits.listen("127.0.0.1", port, 4096, cores > 1 ? 1 : 0)
  if (listener < 0) {
    console.error(`server: listen failed ${listener}`)
    return 1
  }
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/plaintext")
  const entry: Entry = new Entry(new HttpHandler(limits, listener, router), prepared.value, 2463534242 + toU32(worker))
  if (worker === 0) {
    console.log(`listening ${port}`)
    if (limits.ring) {
      console.log(`rings ${netRingState()}`)
    }
  }
  entry.run()
  return 0
}
