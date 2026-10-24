// Three of the multicore server challenge's queries through `nish/net/postgres`,
// against a live PostgreSQL 18 holding the challenge's --dev seed:
//
//   main <pk|list|insert> <port> <user> <password> <database> <count>
//
// `bench/postgres/run.mjs` builds it with `--link` (the speed profile) and runs
// it beside `twin.c`, the same loop written against libpq in pipeline mode.
// The module is used as `tests/postgres/carrier.ts` uses it: a `PgPool` of one
// connection on an epoll loop, each query a request the pool dispatches, bound
// on the connection and sent as its own group (Bind, Execute, Sync). Every
// value read is folded into a checksum in place, from the input buffer, with
// no string made:
//
// - pk: a user by primary key (`int8`), 16 groups in flight; five columns.
// - list: the article list (the viewer, a limit of 20, an offset), 16 groups
//   in flight; 20 rows of 13 columns, the two timestamps decoded with
//   `text.timestamp` and the tag array walked with `PgArrayWalker`.
// - insert: an INSERT of a follow, one group in flight, so each waits for the
//   ReadyForQuery of the one before; the rows its tag counts are folded. The
//   rows it adds are deleted before and after the timed loop.
//
// Each mode runs `depth` queries untimed first (the connect, SCRAM and the
// prepares fall in them), then `count` timed. It prints
// `rows R checksum S failed F count N ns T cpu U`, the line `twin.c` prints
// for the same arguments: T the timed loop's wall time in nanoseconds, U the
// process's user and system CPU time over it, in microseconds (getrusage).
//
// PK_SQL, LIST_SQL and INSERT_SQL are the queries of the challenge's SPEC.md
// (https://github.com/arjaythedev/multicore-server-challenge).
// Copyright (c) 2026 arjaythedev and the challenge contributors. MIT License;
// see bench/postgres/LICENSE.md.
import {
  connectResult,
  netAddress,
  netClose,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollWait,
  tcpConnect,
} from "nish:net"
import { secret, wipe } from "nish:secret"
import {
  PG_ARRAY_ELEMENT,
  PG_ARRAY_END,
  PG_ARRAY_NULL,
  PG_COMPLETE,
  PG_ERROR,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_LOST,
  PG_NEED_MORE,
  PG_ROW,
  PgArrayWalker,
  PgConfig,
  PgConnection,
  PgPool,
} from "nish/net/postgres"

declare function calloc(count: u64, size: u64): CPtr | null
declare function free(p: CPtr): void
declare function getrusage(who: i32, usage: CPtr): i32
declare function bcopy(src: CPtr, dst: u8[], n: u64): void

const PK_SQL: string = "SELECT id, username, email, bio, image FROM users WHERE id = $1"
const LIST_SQL: string =
  "SELECT a.id, a.slug, a.title, a.description, a.created_at, a.updated_at, " +
  "ARRAY(SELECT t.name FROM article_tags at JOIN tags t ON t.id = at.tag_id " +
  "WHERE at.article_id = a.id ORDER BY t.name) AS tag_list, " +
  "(SELECT count(*) FROM favorites f WHERE f.article_id = a.id) AS favorites_count, " +
  "EXISTS (SELECT 1 FROM favorites f WHERE f.article_id = a.id AND f.user_id = $1) AS favorited, " +
  "u.username, u.bio, u.image, " +
  "EXISTS (SELECT 1 FROM follows fo WHERE fo.follower_id = $1 AND fo.followee_id = a.author_id) AS following " +
  "FROM articles a JOIN users u ON u.id = a.author_id " +
  "ORDER BY a.id DESC LIMIT $2 OFFSET $3"
const INSERT_SQL: string =
  "INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
// Every follow the timed loop adds is a self-follow, which the seed has none of.
const RESET_SQL: string = "DELETE FROM follows WHERE follower_id = followee_id"

const PK: i32 = 0
const LIST: i32 = 1
const INSERT: i32 = 2
const RESET: i32 = 3
const INT8: i32 = 20
const USERS: i64 = 100000
/** `netRead` and `netWrite`: nothing to do now. */
const AGAIN: i32 = -11
const WANT_READ: i32 = 1
const WANT_WRITE: i32 = 2
/** The u32 a NULL folds as. */
const NULL_FOLD: i32 = -1

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** The process's user and system CPU time so far, in microseconds. */
const cpuMicros = (): i64 => {
  const p: CPtr | null = calloc(toU64(1), toU64(144))
  if (p === null) {
    return 0
  }
  getrusage(0, p)
  const usage: u8[] = new Array<u8>(32)
  bcopy(p, usage, toU64(usage.length))
  free(p)
  return word(usage, 0) * 1000000 + word(usage, 8) + word(usage, 16) * 1000000 + word(usage, 24)
}

/** The little-endian i64 at `b[at, at + 8)`. */
const word = (b: u8[], at: i32): i64 => {
  let v: i64 = 0
  for (let k: i32 = 7; k >= 0; k--) {
    v = v * 256 + toI64(b[at + k])
  }
  return v
}

/** The checksum every value read is folded into: `sum = sum * 31 + v`, the sum a u32. */
class Fold {
  rows: i64 = 0
  /** A timestamp's 24 bytes, and an escaped array element's unescaped ones. */
  readonly buf: u8[]
  readonly walker: PgArrayWalker
  sum: u32 = 0
  failed: i32 = 0

  constructor() {
    this.buf = new Array<u8>(1024)
    this.walker = new PgArrayWalker()
  }

  add(v: u32): void {
    this.sum = this.sum * 31 + v
  }

  /** Column `c` as text: its length, then every byte; NULL as `NULL_FOLD`. */
  text(conn: PgConnection, c: i32): void {
    const n: i32 = conn.colLength(c)
    if (n < 0) {
      this.add(toU32(NULL_FOLD))
      return
    }
    this.bytes(conn.inputBuffer(), conn.colStart(c), n)
  }

  /** `b[start, start + n)`: its length, then every byte. */
  bytes(b: u8[], start: i32, n: i32): void {
    // The sum is kept in a local across the loop, as twin.c's stays in a
    // register: a store to `this.sum` each byte would time the fold.
    let sum: u32 = this.sum * 31 + toU32(n)
    const end: i32 = start + n
    for (let k: i32 = start; k >= 0 && k < end && k < toI32(b.length); k++) {
      sum = sum * 31 + toU32(b[k])
    }
    this.sum = sum
  }

  /** Column `c` as an integer: its low 32 bits. */
  int(conn: PgConnection, c: i32): void {
    this.add(toU32(conn.int(c) & 4294967295))
  }

  /** Column `c` as a boolean: 1 or 0. */
  bool(conn: PgConnection, c: i32): void {
    this.add(conn.bool(c) ? toU32(1) : toU32(0))
  }

  /** Column `c` as a timestamp: its 24 decoded bytes, or `NULL_FOLD` and a failure. */
  timestamp(conn: PgConnection, c: i32): void {
    const n: i32 = conn.text.timestamp(conn.inputBuffer(), conn.colStart(c), conn.colLength(c), this.buf, 0)
    if (n < 0) {
      this.add(toU32(NULL_FOLD))
      return
    }
    this.bytes(this.buf, 0, n)
  }

  /** Column `c` as a `text[]`: each element as text, unescaped, then the count; a malformed array is a failure. */
  array(conn: PgConnection, c: i32): void {
    const b: u8[] = conn.inputBuffer()
    const walker: PgArrayWalker = this.walker
    walker.begin(b, conn.colStart(c), conn.colLength(c))
    let count: u32 = 0
    let event: i32 = walker.next()
    while (event === PG_ARRAY_ELEMENT || event === PG_ARRAY_NULL) {
      if (event === PG_ARRAY_NULL) {
        this.add(toU32(NULL_FOLD))
      } else if (walker.escaped) {
        const n: i32 = walker.copy(this.buf, 0)
        if (n < 0) {
          this.failed += 1
        } else {
          this.bytes(this.buf, 0, n)
        }
      } else {
        this.bytes(b, walker.start, walker.length)
      }
      count += 1
      event = walker.next()
    }
    if (event !== PG_ARRAY_END) {
      this.failed += 1
    }
    this.add(count)
  }

  /** The row `conn` just read, as `mode` returns it. */
  row(conn: PgConnection, mode: i32): void {
    if (mode === PK) {
      this.int(conn, 0)
      for (let c: i32 = 1; c < 5; c++) {
        this.text(conn, c)
      }
    } else if (mode === LIST) {
      this.int(conn, 0)
      this.text(conn, 1)
      this.text(conn, 2)
      this.text(conn, 3)
      this.timestamp(conn, 4)
      this.timestamp(conn, 5)
      this.array(conn, 6)
      this.int(conn, 7)
      this.bool(conn, 8)
      this.text(conn, 9)
      this.text(conn, 10)
      this.text(conn, 11)
      this.bool(conn, 12)
    }
    this.rows += 1
    if (conn.text.failed) {
      this.failed += 1
      conn.text.reset()
    }
  }
}

/** The pool, its one socket and the epoll loop around it. */
class Bench {
  readonly pool: PgPool
  readonly address: u8[]
  readonly loop: i32
  readonly ready: i32[]
  readonly fold: Fold
  fd: i32 = -1
  connected: boolean = false
  /** The poll mask `fd` is registered with. */
  mask: i32 = 0
  /** The xorshift32 state the ids are drawn from. */
  x: u32 = 0

  constructor(pool: PgPool, address: u8[]) {
    this.pool = pool
    this.address = address
    this.loop = pollCreate()
    this.ready = new Array<i32>(64)
    this.fold = new Fold()
  }

  /** The next id, from 1 to USERS. */
  id(): i64 {
    let x: u32 = this.x
    x = x ^ (x << 13)
    x = x ^ (x >> 17)
    x = x ^ (x << 5)
    this.x = x
    return (toI64(x) % USERS) + 1
  }

  /** Binds query `i` of `mode` on `conn`. */
  bind(conn: PgConnection, mode: i32, i: i32): void {
    if (mode === PK) {
      conn.bindStart("pk")
      conn.paramInt(this.id())
    } else if (mode === LIST) {
      conn.bindStart("list")
      conn.paramInt(this.id())
      conn.paramInt(toI64(20))
      conn.paramInt(toI64(i % 10) * toI64(20))
    } else if (mode === INSERT) {
      const u: i64 = toI64(1) + (toI64(i) % USERS)
      conn.bindStart("insert")
      conn.paramInt(u)
      conn.paramInt(u)
    } else {
      conn.bindStart("reset")
    }
    conn.bindEnd()
  }

  /** Writes what the connection queued; false when the socket is gone. */
  flush(conn: PgConnection): boolean {
    while (conn.outputEnd() > conn.outputStart()) {
      const n: i32 = netWrite(
        this.fd,
        conn.outputBuffer(),
        conn.outputStart(),
        conn.outputEnd() - conn.outputStart()
      )
      if (n === AGAIN) {
        return true
      }
      if (n <= 0) {
        return false
      }
      conn.sent(n)
    }
    return true
  }

  /**
   * Runs `n` queries of `mode`, up to `depth` in flight, and folds what they
   * answer when `fold` is set. False, the reason printed, when the connection
   * fails or the server stops answering.
   */
  run(mode: i32, n: i32, depth: i32, fold: boolean): boolean {
    const pool = this.pool
    this.x = 2463534242
    let requested: i32 = 0
    let bound: i32 = 0
    let done: i32 = 0
    let pending: boolean = this.fd >= 0
    while (done < n) {
      if (pending) {
        pending = false
        let event: i32 = pool.next(0)
        while (event !== PG_NEED_MORE) {
          if (event === PG_ROW) {
            if (fold) {
              this.fold.row(pool.connection(0), mode)
            }
          } else if (event === PG_COMPLETE) {
            if (fold && mode === INSERT) {
              const rows: i64 = pool.connection(0).tagRows()
              this.fold.rows += rows
              this.fold.add(toU32(rows & 4294967295))
            }
          } else if (event === PG_ERROR) {
            if (fold) {
              this.fold.failed += 1
            }
          } else if (event === PG_GROUP_DONE) {
            done += 1
          } else if (event === PG_LOST || event === PG_FAILED) {
            console.log(`connection failed: ${pool.connection(0).failure}`)
            return false
          }
          event = pool.next(0)
        }
        if (done === n) {
          break
        }
      }
      while (requested < n && requested - done < depth && pool.request() >= 0) {
        requested += 1
      }
      let slot: i32 = pool.dispatch()
      while (slot >= 0) {
        this.bind(pool.connection(slot), mode, bound)
        pool.send()
        bound += 1
        slot = pool.dispatch()
      }
      if (pool.wanted() === 0) {
        const nonce = new Array<u8>(18)
        crypto.getRandomValues(nonce)
        pool.connect(0, nonce)
        this.fd = tcpConnect(this.address)
        this.connected = false
        this.mask = WANT_WRITE
        if (this.fd < 0 || pollAdd(this.loop, this.fd, WANT_WRITE, 0) < 0) {
          console.log(`connect failed: ${this.fd}`)
          return false
        }
      }
      if (this.connected) {
        const conn = pool.connection(0)
        if (!this.flush(conn)) {
          conn.closed()
          pending = true
          continue
        }
        const wants: i32 = conn.outputEnd() > conn.outputStart() ? WANT_READ | WANT_WRITE : WANT_READ
        if (wants !== this.mask) {
          pollModify(this.loop, this.fd, wants, 0)
          this.mask = wants
        }
      }
      const got: i32 = pollWait(this.loop, this.ready, toI32(10000))
      if (got <= 0) {
        console.log("timed out")
        return false
      }
      const conn = pool.connection(0)
      if (!this.connected) {
        // The socket is writable once its connect finished, or failed.
        if (connectResult(this.fd) === 0) {
          this.connected = true
        } else {
          conn.closed()
        }
      } else if ((this.ready[1] & 5) !== 0) {
        const read: i32 = netRead(this.fd, conn.inputBuffer(), conn.inputEnd(), conn.inputRoom())
        if (read === 0 || (read < 0 && read !== AGAIN)) {
          conn.closed()
        } else if (read > 0) {
          conn.received(read)
        }
      }
      pending = true
    }
    return true
  }
}

export const main = (): i32 => {
  if (process.argv.length < 7) {
    console.log("usage: main <pk|list|insert> <port> <user> <password> <database> <count>")
    return 2
  }
  const name: string = process.argv[1]
  let mode: i32 = -1
  if (name === "pk") {
    mode = PK
  } else if (name === "list") {
    mode = LIST
  } else if (name === "insert") {
    mode = INSERT
  }
  if (mode < 0) {
    console.log(`unknown mode ${name}`)
    return 2
  }
  const count: i32 = toI32(parseInt(process.argv[6]))
  const depth: i32 = mode === INSERT ? 1 : 16
  const config = new PgConfig()
  config.user = process.argv[3]
  config.database = process.argv[5]
  config.maxInFlight = depth
  const password = secret(bytesOf(process.argv[4]))
  const pool = new PgPool(config, password, toI32(1), depth)
  wipe(password)
  if (mode === PK) {
    pool.register("pk", PK_SQL, [INT8])
  } else if (mode === LIST) {
    pool.register("list", LIST_SQL, [INT8, INT8, INT8])
  } else {
    pool.register("insert", INSERT_SQL, [INT8, INT8])
    const none: i32[] = []
    pool.register("reset", RESET_SQL, none)
  }
  const address = new Array<u8>(18)
  netAddress(address, "127.0.0.1", parseInt(process.argv[2]))
  const bench = new Bench(pool, address)

  if (!bench.run(mode, depth, depth, false) || (mode === INSERT && !bench.run(RESET, 1, 1, false))) {
    return 1
  }
  const cpu0: i64 = cpuMicros()
  const t0: i64 = monotonicNanos()
  const ok: boolean = bench.run(mode, count, depth, true)
  const ns: i64 = monotonicNanos() - t0
  const cpu: i64 = cpuMicros() - cpu0
  if (!ok || (mode === INSERT && !bench.run(RESET, 1, 1, false))) {
    return 1
  }
  const fold = bench.fold
  console.log(
    `rows ${fold.rows} checksum ${fold.sum} failed ${fold.failed} count ${count} ns ${ns} cpu ${cpu}`
  )
  const conn = pool.connection(0)
  conn.terminate()
  bench.flush(conn)
  netClose(bench.fd)
  pool.dispose()
  return 0
}
