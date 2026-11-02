// What a binary `int4[]` or `int8[]` parameter (`paramInt4Array`,
// `paramInt8Array`) saves over the text one `paramIntArray` writes, and what
// `PgBinaryArray` saves over walking an `array_agg` column as text, against a
// live PostgreSQL on this machine:
//
//   arrays <mode> <port> <user> <password> <database> <count> <4|8> <length> <text|binary>
//
// `bench/postgres/arrays.mjs` builds it with `--link` and runs every cell. The
// array is `length` elements of the type, made once before the timed loop:
//
// - unnest: `select count(*) from unnest($1::int8[])` (`int4[]` for 4), the
//   elements random over the type's whole range; `count` groups (Bind,
//   Execute, Sync), one in flight.
// - any: `select count(*) from bench_pk where id = any($1)`, the elements ids
//   the table holds, all distinct (`1 + k * 7919 % 100000`); as unnest.
// - check: unnest's array through `select count(*), bit_xor(x) from
//   unnest($1) x`, each answer compared with the count and xor of the array
//   as sent; a difference is a failure. `--validate` runs it for both formats.
// - encode: no query. Both formats time `count` rounds of `bindStart`, the
//   array's parameter (`paramIntArray`, or `paramInt4Array` /
//   `paramInt8Array`) and `bindCancel`, less as many of `bindStart`,
//   `paramNull` and `bindCancel`, so each side pays the same Bind around it.
// - decode: one query, `select array_agg(...)` of `length` hashed integers of
//   the type, its result in text (`bindStart`) or binary
//   (`bindStartBinary`); the one row's column is decoded `count` times in
//   place, by `PgArrayWalker` and `PgText.int`, or by `PgBinaryArray`.
//
// A text parameter goes as `paramIntArray` writes it, a binary one as
// `paramInt4Array` or `paramInt8Array` does: the shipped API, nothing patched.
//
// It prints `rows R checksum S failed F count N ns T user U sys K` and, for
// unnest, any and check, ` server_ns C server_ticks B`: T the timed loop's
// wall time in nanoseconds, U and K this process's user and system CPU time
// over it in microseconds (getrusage), C the backend's time on a CPU over the
// loop in nanoseconds (`/proc/<pid>/schedstat` of `pg_backend_pid()`) and B
// its utime + stime in clock ticks (`/proc/<pid>/stat`). S folds every
// answer: the counts, or the decoded elements, so text and binary print the
// same S for the same cell; for encode, the elements of every array written.
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
  PG_ERROR,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_LOST,
  PG_NEED_MORE,
  PG_ROW,
  PgArrayWalker,
  PgBinary,
  PgBinaryArray,
  PgConfig,
  PgConnection,
  PgPool,
} from "nish/net/postgres"

declare function calloc(count: u64, size: u64): CPtr | null
declare function free(p: CPtr): void
declare function getrusage(who: i32, usage: CPtr): i32
declare function bcopy(src: CPtr, dst: u8[], n: u64): void
declare function open(path: string, flags: i32): i32
declare function read(fd: i32, buf: u8[], n: u64): i64
declare function close(fd: i32): i32

const UNNEST: i32 = 0
const ANY: i32 = 1
const CHECK: i32 = 2
const ENCODE: i32 = 3
const DECODE: i32 = 4
const PID: i32 = 5
const OID_INT4: i32 = 23
const OID_INT8: i32 = 20
const OID_INT4_ARRAY: i32 = 1007
const OID_INT8_ARRAY: i32 = 1016
/** The ids `bench_pk` holds, 1 to this; arrays.mjs makes it. */
const IDS: i64 = 100000
const AGAIN: i32 = -11
const WANT_READ: i32 = 1
const WANT_WRITE: i32 = 2
const O_RDONLY_CLOEXEC: i32 = 0x80000
const PROC_BYTES: i32 = 1024

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

/** This process's user + system CPU time so far, in microseconds (getrusage). */
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

/** The process's system CPU time so far, in microseconds. */
const sysMicros = (): i64 => {
  const p: CPtr | null = calloc(toU64(1), toU64(144))
  if (p === null) {
    return 0
  }
  getrusage(0, p)
  const usage: u8[] = new Array<u8>(32)
  bcopy(p, usage, toU64(usage.length))
  free(p)
  return word(usage, 16) * 1000000 + word(usage, 24)
}

/**
 * The `field`th space-separated number after the `)` that ends the command
 * name in `/proc/<pid>/stat`, or the first number of `schedstat`; -1 when the
 * file cannot be read. As bench/postgres/main.ts reads them.
 */
const procNumber = (path: string, field: i32): i64 => {
  const fd: i32 = open(path, O_RDONLY_CLOEXEC)
  if (fd < 0) {
    return -1
  }
  const b = new Array<u8>(PROC_BYTES)
  const got: i64 = read(fd, b, toU64(PROC_BYTES))
  close(fd)
  if (got <= 0) {
    return -1
  }
  const end: i32 = toI32(got)
  let at: i32 = 0
  for (let k: i32 = 0; k < end; k++) {
    if (b[k] === 41) {
      at = k + 2
    }
  }
  let seen: i32 = 0
  while (at < end && seen < field) {
    if (b[at] === 32) {
      seen += 1
    }
    at += 1
  }
  let v: i64 = 0
  let digits: i32 = 0
  while (at < end && b[at] >= 48 && b[at] <= 57) {
    v = v * 10 + toI64(b[at] - 48)
    digits += 1
    at += 1
  }
  return digits > 0 ? v : -1
}

const serverTicks = (pid: i64): i64 => {
  const path: string = `/proc/${pid}/stat`
  return procNumber(path, 11) + procNumber(path, 12)
}

const serverNanos = (pid: i64): i64 => procNumber(`/proc/${pid}/schedstat`, 0)

/** One connection on an epoll loop, one group in flight, and what its answers fold to. */
class Driver {
  readonly pool: PgPool
  readonly address: u8[]
  readonly loop: i32
  readonly ready: i32[]
  readonly values: i64[]
  readonly length: i32
  readonly oid: i32
  readonly binary: boolean
  readonly walker: PgArrayWalker
  /** The decoder `array` reads with; its `failed` is a decode's failure. */
  readonly decoder: PgBinary
  readonly array: PgBinaryArray
  /** The decodes each `DECODE` row is given. */
  decodes: i32 = 1
  fd: i32 = -1
  connected: boolean = false
  mask: i32 = 0
  backend: i64 = -1
  rows: i64 = 0
  sum: u32 = 0
  failed: i32 = 0
  /** The xor of `values`, which `CHECK` compares the server's with. */
  xor: i64 = 0
  /** Decode's CPU time and wall time, microseconds and nanoseconds. */
  decodeMicros: i64 = 0
  decodeSys: i64 = 0
  decodeNanos: i64 = 0

  constructor(pool: PgPool, address: u8[], values: i64[], oid: i32, binary: boolean) {
    this.pool = pool
    this.address = address
    this.loop = pollCreate()
    this.ready = new Array<i32>(64)
    this.values = values
    this.length = toI32(values.length)
    this.oid = oid
    this.binary = binary
    this.walker = new PgArrayWalker()
    this.decoder = new PgBinary()
    this.array = new PgBinaryArray(this.decoder)
    for (const v of values) {
      this.xor = this.xor ^ v
    }
  }

  add(v: i64): void {
    this.sum = this.sum * 31 + toU32(v & 4294967295)
  }

  /** The array's parameter, in text or binary; false when refused. */
  param(conn: PgConnection): boolean {
    if (!this.binary) {
      return conn.paramIntArray(this.values, 0, this.length)
    }
    return this.oid === OID_INT4
      ? conn.paramInt4Array(this.values, 0, this.length)
      : conn.paramInt8Array(this.values, 0, this.length)
  }

  /** A Bind of statement `name` with the array; a refused parameter is a failure. */
  bindArray(conn: PgConnection, name: string): void {
    conn.bindStart(name)
    if (!this.param(conn)) {
      this.failed += 1
    }
    conn.bindEnd()
  }

  bind(conn: PgConnection, mode: i32): void {
    if (mode === PID) {
      conn.bindStart("pid")
      conn.bindEnd()
    } else if (mode === UNNEST || mode === ANY) {
      this.bindArray(conn, "q")
    } else if (mode === CHECK) {
      this.bindArray(conn, "c")
    } else {
      if (this.binary) {
        conn.bindStartBinary("q")
      } else {
        conn.bindStart("q")
      }
      conn.paramInt(toI64(this.length))
      conn.bindEnd()
    }
  }

  /** `count` decodes of column 0, an `int4[]` or `int8[]`, every element folded; the time they take kept. */
  decode(conn: PgConnection): void {
    const b: u8[] = conn.inputBuffer()
    const start: i32 = conn.colStart(0)
    const n: i32 = conn.colLength(0)
    const cpu0: i64 = cpuMicros()
    const sys0: i64 = sysMicros()
    const t0: i64 = monotonicNanos()
    let sum: u32 = this.sum
    let elements: i32 = 0
    for (let round: i32 = 0; round < this.decodes; round++) {
      elements = 0
      if (this.binary) {
        const array: PgBinaryArray = this.array
        array.begin(b, start, n)
        let event: i32 = array.next()
        while (event === PG_ARRAY_ELEMENT) {
          sum = sum * 31 + toU32(array.int() & 4294967295)
          elements += 1
          event = array.next()
        }
        if (event !== PG_ARRAY_END) {
          this.failed += 1
        }
      } else {
        const walker: PgArrayWalker = this.walker
        walker.begin(b, start, n)
        let event: i32 = walker.next()
        while (event === PG_ARRAY_ELEMENT) {
          sum = sum * 31 + toU32(conn.text.int(b, walker.start, walker.length) & 4294967295)
          elements += 1
          event = walker.next()
        }
        if (event !== PG_ARRAY_END) {
          this.failed += 1
        }
      }
    }
    this.decodeNanos = monotonicNanos() - t0
    this.decodeMicros = cpuMicros() - cpu0
    this.decodeSys = sysMicros() - sys0
    this.sum = sum
    if (elements !== this.length || conn.text.failed || this.decoder.failed) {
      this.failed += 1
    }
  }

  row(conn: PgConnection, mode: i32): void {
    if (mode === PID) {
      this.backend = conn.int(0)
      return
    }
    this.rows += 1
    if (mode === DECODE) {
      this.decode(conn)
      return
    }
    const count: i64 = conn.int(0)
    this.add(count)
    if ((mode === UNNEST || mode === ANY) && count !== toI64(this.length)) {
      this.failed += 1
    } else if (mode === CHECK && (count !== toI64(this.length) || conn.int(1) !== this.xor)) {
      this.failed += 1
    }
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

  /** `n` groups of `mode`, one in flight; false, the reason printed, when the connection fails. */
  run(mode: i32, n: i32): boolean {
    const pool = this.pool
    let requested: i32 = 0
    let done: i32 = 0
    let pending: boolean = this.fd >= 0
    while (done < n) {
      if (pending) {
        pending = false
        let event: i32 = pool.next(0)
        while (event !== PG_NEED_MORE) {
          if (event === PG_ROW) {
            this.row(pool.connection(0), mode)
          } else if (event === PG_ERROR) {
            const error = pool.connection(0).lastError
            console.log(error === null ? "server error" : `server error: ${error.code} ${error.message}`)
            this.failed += 1
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
      if (requested === done && requested < n && pool.request() >= 0) {
        requested += 1
      }
      let slot: i32 = pool.dispatch()
      while (slot >= 0) {
        this.bind(pool.connection(slot), mode)
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
        if (connectResult(this.fd) === 0) {
          this.connected = true
        } else {
          conn.closed()
        }
      } else if ((this.ready[1] & 5) !== 0) {
        const arrived: i32 = netRead(this.fd, conn.inputBuffer(), conn.inputEnd(), conn.inputRoom())
        if (arrived === 0 || (arrived < 0 && arrived !== AGAIN)) {
          conn.closed()
        } else if (arrived > 0) {
          conn.received(arrived)
        }
      }
      pending = true
    }
    return true
  }

  /**
   * `count` encodes of the array, on `conn` with nothing in flight: a Bind
   * holding it in this driver's format, cancelled, less a Bind of one NULL
   * cancelled as often. Answers CPU microseconds and puts wall nanoseconds in
   * `decodeNanos`; folds the elements of each array written into `sum`, and
   * counts a refused call a failure.
   */
  encode(conn: PgConnection, count: i32): i64 {
    const cpuBase: i64 = cpuMicros()
    const tBase: i64 = monotonicNanos()
    for (let i: i32 = 0; i < count; i++) {
      if (!conn.bindStart("q") || !conn.paramNull() || !conn.bindCancel()) {
        this.failed += 1
      }
    }
    const baseNanos: i64 = monotonicNanos() - tBase
    const base: i64 = cpuMicros() - cpuBase
    const cpu0: i64 = cpuMicros()
    const t0: i64 = monotonicNanos()
    let sum: u32 = 0
    for (let i: i32 = 0; i < count; i++) {
      if (conn.bindStart("q") && this.param(conn) && conn.bindCancel()) {
        sum = sum * 31 + toU32(this.length)
      } else {
        this.failed += 1
      }
    }
    this.decodeNanos = monotonicNanos() - t0 - baseNanos
    const cpu: i64 = cpuMicros() - cpu0 - base
    this.sum = sum
    this.rows = toI64(count)
    return cpu
  }
}

export const main = (): i32 => {
  if (process.argv.length < 10) {
    console.log(
      "usage: arrays <unnest|any|check|encode|decode> <port> <user> <password> <database> <count> <4|8> <length> <text|binary>"
    )
    return 2
  }
  const name: string = process.argv[1]
  let mode: i32 = -1
  if (name === "unnest") {
    mode = UNNEST
  } else if (name === "any") {
    mode = ANY
  } else if (name === "check") {
    mode = CHECK
  } else if (name === "encode") {
    mode = ENCODE
  } else if (name === "decode") {
    mode = DECODE
  }
  const count: i32 = toI32(parseInt(process.argv[6]))
  const width: string = process.argv[7]
  const length: i32 = toI32(parseInt(process.argv[8]))
  const format: string = process.argv[9]
  if (
    mode < 0 ||
    (width !== "4" && width !== "8") ||
    (format !== "text" && format !== "binary") ||
    count < 1 ||
    length < 0
  ) {
    console.log(`bad arguments: ${name} ${width} ${format} ${count} ${length}`)
    return 2
  }
  const int4: boolean = width === "4"
  const oid: i32 = int4 ? OID_INT4 : OID_INT8
  const arrayOid: i32 = int4 ? OID_INT4_ARRAY : OID_INT8_ARRAY
  const values: i64[] = new Array<i64>(length)
  let x: u64 = toU64(1234567) * toU64(987654321) + toU64(1)
  for (let k: i32 = 0; k < length && k < toI32(values.length); k++) {
    if (mode === ANY) {
      values[k] = toI64(1) + ((toI64(k) * toI64(7919)) % IDS)
    } else {
      x = x ^ (x << toU64(13))
      x = x ^ (x >> toU64(7))
      x = x ^ (x << toU64(17))
      const v: i64 = toI64(x)
      // An int4 is the low 32 bits, sign-extended.
      values[k] = int4 ? (v << 32) >> 32 : v
    }
  }

  const config = new PgConfig()
  config.user = process.argv[3]
  config.database = process.argv[5]
  config.maxInFlight = 1
  config.maxOutput = 4194304
  config.maxMessage = 4194304
  const password = secret(bytesOf(process.argv[4]))
  const pool = new PgPool(config, password, toI32(1), toI32(1))
  wipe(password)
  const type: string = int4 ? "int4" : "int8"
  const none: i32[] = []
  pool.register("pid", "select pg_backend_pid()", none)
  if (mode === UNNEST || mode === ENCODE) {
    pool.register("q", `select count(*) from unnest($1::${type}[])`, [arrayOid])
  } else if (mode === ANY) {
    pool.register("q", "select count(*) from bench_pk where id = any($1)", [arrayOid])
  } else if (mode === CHECK) {
    pool.register("c", `select count(*), bit_xor(x) from unnest($1::${type}[]) x`, [arrayOid])
  } else {
    const element: string = int4 ? "hashint4(g)" : "hashint8extended(g, 0)"
    pool.register("q", `select array_agg(${element}) from generate_series(1, $1::int4) g`, none)
  }
  const address = new Array<u8>(18)
  netAddress(address, "127.0.0.1", parseInt(process.argv[2]))
  const driver = new Driver(pool, address, values, oid, format === "binary")
  // The connect, SCRAM and the prepares fall in this one.
  if (!driver.run(PID, 1) || driver.backend <= 0) {
    console.log("pg_backend_pid() did not answer")
    return 1
  }
  const server: boolean = mode === UNNEST || mode === ANY || mode === CHECK
  const conn = pool.connection(0)
  let ns: i64 = 0
  let cpu: i64 = 0
  let sys: i64 = 0
  let ticks: i64 = 0
  let nanos: i64 = 0
  if (server) {
    // One untimed group first, so the plan is cached before the loop.
    if (!driver.run(mode, 1)) {
      return 1
    }
    driver.rows = 0
    driver.sum = 0
    const ticks0: i64 = serverTicks(driver.backend)
    const nanos0: i64 = serverNanos(driver.backend)
    const cpu0: i64 = cpuMicros()
    const sys0: i64 = sysMicros()
    const t0: i64 = monotonicNanos()
    if (!driver.run(mode, count)) {
      return 1
    }
    ns = monotonicNanos() - t0
    cpu = cpuMicros() - cpu0
    sys = sysMicros() - sys0
    ticks = serverTicks(driver.backend) - ticks0
    nanos = serverNanos(driver.backend) - nanos0
    if (ticks0 < 0 || nanos0 < 0 || ticks < 0 || nanos < 0) {
      console.log(`cannot read /proc/${driver.backend}: the server must run on this machine`)
      return 1
    }
  } else if (mode === ENCODE) {
    cpu = driver.encode(conn, count)
    ns = driver.decodeNanos
  } else {
    driver.decodes = count
    if (!driver.run(mode, 1)) {
      return 1
    }
    cpu = driver.decodeMicros
    sys = driver.decodeSys
    ns = driver.decodeNanos
  }
  const suffix: string = server ? ` server_ns ${nanos} server_ticks ${ticks}` : ""
  console.log(
    `rows ${driver.rows} checksum ${driver.sum} failed ${driver.failed} count ${count} ns ${ns} user ${cpu - sys} sys ${sys}${suffix}`
  )
  conn.terminate()
  driver.flush(conn)
  netClose(driver.fd)
  pool.dispose()
  return 0
}
