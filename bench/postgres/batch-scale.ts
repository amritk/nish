// What a `PgBatcher` take costs per key as `maxRequests` grows from 1 to its
// most, 65536, against a live PostgreSQL on this machine:
//
//   batch-scale <spread|collide> <port> <user> <password> <database> <n> <rounds>
//
// `bench/postgres/batch-scale.mjs` builds it with `--link` and runs every
// size. One connection, one batcher of int8 keys taking at most `n`
// requests; each round queues `n` requests, takes them all into one
// execution and routes every answer back. The statement is
// `select q.key as k, g from generate_series(1, (q.key & 2147483647) % 3) as g`,
// so a key has none, one or two rows by its low 31 bits, each naming the key
// it answers.
//
// - spread: request `t`'s key is `1 + t % d`, `d` three quarters of `n`, so
//   the last quarter repeat earlier keys.
// - collide: the same, each key `j` made `collidingKey(j)`, whose high half
//   cancels its low one in the batcher's int hash: every key lands in the
//   same slot of the batcher's table, the probe's worst case.
//
// One untimed round first connects, prepares and warms the plan. It prints
// `keys K rows R missing M wrong W ns T cpu U built B peak P`: K the
// requests the timed rounds answered, R the rows and M the requests with
// none; W the requests answered otherwise than the statement says (a row of
// another key, rows out of order, a wrong count, a failure); T the timed
// rounds' wall time in nanoseconds; U this process's user + system CPU time
// over them in microseconds (getrusage); B the peak resident set the batcher's
// construction added, and P the peak resident set at the end, in KiB
// (`ru_maxrss`).
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
  PG_BATCH_DONE,
  PG_BATCH_FAILED,
  PG_BATCH_INT,
  PG_BATCH_MISSING,
  PG_BATCH_NONE,
  PG_BATCH_ROW,
  PG_COMPLETE,
  PG_ERROR,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_LOST,
  PG_NEED_MORE,
  PG_ROW,
  PgBatchConfig,
  PgBatcher,
  PgConfig,
  PgConnection,
  PgPool,
} from "nish/net/postgres"

declare function calloc(count: u64, size: u64): CPtr | null
declare function free(p: CPtr): void
declare function getrusage(who: i32, usage: CPtr): i32
declare function bcopy(src: CPtr, dst: u8[], n: u64): void

const AGAIN: i32 = -11
const WANT_READ: i32 = 1
const WANT_WRITE: i32 = 2

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** The little-endian i64 at `b[at, at + 8)`. */
const word = (b: u8[], at: i32): i64 => {
  let v: i64 = 0
  for (let k: i32 = 7; k >= 0; k--) {
    v = v * 256 + toI64(b[at + k])
  }
  return v
}

/** The first 40 bytes of this process's `struct rusage`: user and system time, then `ru_maxrss`. */
const usage = (): u8[] => {
  const out: u8[] = new Array<u8>(40)
  const p: CPtr | null = calloc(toU64(1), toU64(144))
  if (p === null) {
    return out
  }
  getrusage(0, p)
  bcopy(p, out, toU64(out.length))
  free(p)
  return out
}

/** This process's user + system CPU time so far, in microseconds. */
const cpuMicros = (): i64 => {
  const u: u8[] = usage()
  return word(u, 0) * 1000000 + word(u, 8) + word(u, 16) * 1000000 + word(u, 24)
}

/** This process's peak resident set so far, in KiB. */
const peakKiB = (): i64 => word(usage(), 32)

/** The rows the statement gives key `k`. */
const rowsOf = (k: i64): i32 => toI32((k & toI64(2147483647)) % toI64(3))

const LOW32: i64 = 4294967295
const GOLDEN: i64 = 2654435769

/** The int8 key `j * 2^32 + (j * 2654435769 mod 2^32)`: its low half is its high half times the multiplier the batcher's int hash xors in, so every such key hashes alike. */
const collidingKey = (j: i64): i64 => (j << toI64(32)) + ((j * GOLDEN) & LOW32)

/** One connection on an epoll loop, one batcher, and what its answers came to. */
class Driver {
  readonly pool: PgPool
  readonly batcher: PgBatcher
  readonly address: u8[]
  readonly loop: i32
  readonly ready: i32[]
  /** Per request of the round: its key, the rows seen, and whether it ended. */
  readonly keys: i64[]
  readonly seen: i32[]
  readonly ended: boolean[]
  fd: i32 = -1
  connected: boolean = false
  mask: i32 = 0
  run: i32 = -1
  rows: i64 = 0
  missing: i64 = 0
  wrong: i64 = 0

  constructor(pool: PgPool, batcher: PgBatcher, address: u8[], n: i32) {
    this.pool = pool
    this.batcher = batcher
    this.address = address
    this.loop = pollCreate()
    this.ready = new Array<i32>(64)
    this.keys = new Array<i64>(n)
    this.seen = new Array<i32>(n)
    this.ended = new Array<boolean>(n)
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

  /** Routes the events the batcher's run holds, checking each against the statement. */
  route(conn: PgConnection): void {
    const b: PgBatcher = this.batcher
    let event: i32 = b.next(this.run)
    while (event !== PG_BATCH_NONE) {
      const t: i32 = b.tag
      if (t < 0 || t >= toI32(this.keys.length) || this.ended[t]) {
        this.wrong += 1
      } else if (event === PG_BATCH_ROW) {
        this.seen[t] += 1
        this.rows += 1
        if (conn.int(0) !== this.keys[t] || conn.int(1) !== toI64(this.seen[t])) {
          this.wrong += 1
        }
      } else {
        this.ended[t] = true
        const want: i32 = rowsOf(this.keys[t])
        if (event === PG_BATCH_MISSING) {
          this.missing += 1
        }
        if (event === PG_BATCH_FAILED || (event === PG_BATCH_DONE) !== want > 0 || this.seen[t] !== want) {
          this.wrong += 1
        }
      }
      event = b.next(this.run)
    }
  }

  /** One round: `n` requests, spread or colliding keys, taken as one execution and answered; false, the reason printed, when the connection fails. */
  round(collide: boolean): boolean {
    const n: i32 = toI32(this.keys.length)
    const distinct: i32 = n - n / toI32(4)
    for (let t: i32 = 0; t < n; t++) {
      const j: i64 = toI64((t % distinct) + toI32(1))
      this.keys[t] = collide ? collidingKey(j) : j
      this.seen[t] = 0
      this.ended[t] = false
      if (!this.batcher.addInt(this.keys[t], t)) {
        console.log(`request ${t} refused`)
        return false
      }
    }
    const pool = this.pool
    if (pool.request() < 0) {
      console.log("the pool refused the request")
      return false
    }
    let done: boolean = false
    while (!done) {
      let slot: i32 = pool.dispatch()
      while (slot >= 0) {
        this.run = this.batcher.take(pool.connection(slot))
        pool.send()
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
      const conn = pool.connection(0)
      if (this.connected) {
        if (!this.flush(conn)) {
          console.log("the socket closed")
          return false
        }
        const wants: i32 = conn.outputEnd() > conn.outputStart() ? WANT_READ | WANT_WRITE : WANT_READ
        if (wants !== this.mask) {
          pollModify(this.loop, this.fd, wants, 0)
          this.mask = wants
        }
      }
      if (pollWait(this.loop, this.ready, toI32(30000)) <= 0) {
        console.log("timed out")
        return false
      }
      if (!this.connected) {
        if (connectResult(this.fd) !== 0) {
          console.log("connect failed")
          return false
        }
        this.connected = true
      } else if ((this.ready[1] & 5) !== 0) {
        const arrived: i32 = netRead(this.fd, conn.inputBuffer(), conn.inputEnd(), conn.inputRoom())
        if (arrived === 0 || (arrived < 0 && arrived !== AGAIN)) {
          conn.closed()
        } else if (arrived > 0) {
          conn.received(arrived)
        }
      }
      let event: i32 = pool.next(0)
      while (event !== PG_NEED_MORE) {
        if (event === PG_ROW && this.run >= 0) {
          if (!this.batcher.row(this.run, conn)) {
            this.wrong += 1
          }
          this.route(conn)
        } else if (event === PG_COMPLETE && this.run >= 0) {
          this.batcher.end(this.run)
          this.route(conn)
        } else if (event === PG_ERROR) {
          const error = conn.lastError
          console.log(error === null ? "server error" : `server error: ${error.code} ${error.message}`)
          if (this.run >= 0) {
            this.batcher.fail(this.run)
            this.route(conn)
          }
        } else if (event === PG_GROUP_DONE) {
          done = true
        } else if (event === PG_LOST || event === PG_FAILED) {
          console.log(`connection failed: ${conn.failure}`)
          return false
        }
        event = pool.next(0)
      }
    }
    for (let t: i32 = 0; t < n; t++) {
      if (!this.ended[t]) {
        this.wrong += 1
      }
    }
    return true
  }
}

export const main = (): i32 => {
  if (process.argv.length < 8) {
    console.log("usage: batch-scale <spread|collide> <port> <user> <password> <database> <n> <rounds>")
    return 2
  }
  const mode: string = process.argv[1]
  const n: i32 = parseInt(process.argv[6])
  const rounds: i32 = parseInt(process.argv[7])
  if ((mode !== "spread" && mode !== "collide") || n < 1 || n > 65536 || rounds < 1) {
    console.log(`bad arguments: ${mode} ${n} ${rounds}`)
    return 2
  }
  const collide: boolean = mode === "collide"
  const before: i64 = peakKiB()
  const config = new PgBatchConfig()
  config.name = "scale"
  config.keyType = PG_BATCH_INT
  config.select = "select q.key as k, g from generate_series(1, (q.key & 2147483647) % 3) as g"
  config.maxRequests = n
  config.maxBytes = 4194304
  config.queueSize = n
  const batcher = new PgBatcher(config)
  const built: i64 = peakKiB() - before

  const pgConfig = new PgConfig()
  pgConfig.user = process.argv[3]
  pgConfig.database = process.argv[5]
  pgConfig.maxOutput = 8388608
  const password = secret(bytesOf(process.argv[4]))
  const pool = new PgPool(pgConfig, password, toI32(1), toI32(1))
  wipe(password)
  const none: i32[] = []
  pool.register(batcher.name, batcher.sql, none)
  const address = new Array<u8>(18)
  netAddress(address, "127.0.0.1", parseInt(process.argv[2]))
  const driver = new Driver(pool, batcher, address, n)
  // The connect, SCRAM, the prepare and the plan fall in this one.
  if (!driver.round(collide)) {
    return 1
  }
  driver.rows = 0
  driver.missing = 0
  const cpu0: i64 = cpuMicros()
  const t0: i64 = monotonicNanos()
  for (let r: i32 = 0; r < rounds; r++) {
    if (!driver.round(collide)) {
      return 1
    }
  }
  const ns: i64 = monotonicNanos() - t0
  const cpu: i64 = cpuMicros() - cpu0
  console.log(
    `keys ${toI64(n) * toI64(rounds)} rows ${driver.rows} missing ${driver.missing} wrong ${driver.wrong} ns ${ns} cpu ${cpu} built ${built} peak ${peakKiB()}`
  )
  const conn = pool.connection(0)
  conn.terminate()
  driver.flush(conn)
  netClose(driver.fd)
  pool.dispose()
  return 0
}
