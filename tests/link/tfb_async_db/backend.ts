// A loopback stand-in PostgreSQL for the async database entry
// (bench/techempower/async-db-server.ts), in the same process as the pool it
// serves. `standIn` accepts one connection, answers its startup as a `trust`
// server, then each Parse, Bind, Execute and Sync by the statement's text:
//
//   TFB_WORLD_SQL    one row (id, randomNumber) per id of the `int8[]`
//                    parameter, in its order, repeats included
//   TFB_CACHE_SQL    every World row
//   TFB_FORTUNE_SQL  the fortune rows, unsorted
//   TFB_UPDATE_SQL   writes the second `int8[]` into the rows the first names
//   anything else    an ErrorResponse, counted in `other`
//
// The table is the one object the stand-ins share with the test's client; a
// stand-in's task body writes it, and its helpers only read it.
import { readable, sleep, writable } from "nish:async"
import { netClose, netRead, netWrite, tcpAccept } from "nish:net"
import { TFB_WORLD_SQL } from "../../../bench/techempower/async-db-server"
import { TFB_CACHE_SQL, TFB_FORTUNE_SQL, TFB_UPDATE_SQL } from "../../../bench/techempower/db-server"
import { Out, Wire } from "../std_postgres_async/server"

/** World's rows. */
export const ROWS: i32 = 10000
/** Out's bytes; the answer is written out before it grows past this. */
const FLUSH_AT: i32 = 60000

/** The database the stand-ins answer from, and what they saw. */
export class Table {
  /** `world[id]` is that row's randomNumber. */
  world: i32[]
  fortunes: string[]
  /** World reads, whole-table reads and updates executed. */
  worldReads: i32 = 0
  cacheReads: i32 = 0
  updates: i32 = 0
  /** Whether any update bound an id twice or out of order. */
  unordered: boolean = false
  /** Statements whose text is none of the entry's four. */
  other: i32 = 0
  /** Whether the next World read, or whole-table read, is refused. */
  refuseWorld: boolean = false
  refuseCache: boolean = false

  constructor() {
    this.world = new Array<i32>(ROWS + 1)
    for (let id: i32 = 1; id <= ROWS; id++) {
      this.world[id] = ((id * 7919) % ROWS) + 1
    }
    this.fortunes = [
      "fortune: No such file or directory",
      "A computer scientist is someone who fixes things that aren't broken.",
      "After enough decimal places, nobody gives a damn.",
      "A bad random number generator: 1, 1, 1, 1, 1, 4.33e+67, 1, 1, 1",
      "A computer program does what you tell it to do, not what you want it to do.",
      "Emacs is a nice operating system, but I prefer UNIX. — Tom Christaensen",
      "Any program that runs right is obsolete.",
      "A list is only as strong as its weakest link. — Donald Knuth",
      "Feature: A bug with seniority.",
      "Computers make very fast, very accurate mistakes.",
      '<script>alert("This should not be displayed in a browser alert box.");</script>',
      "フレームワークのベンチマーク",
      "Fortune & Co: fish & chips.",
    ]
  }
}

/** The integers of the array literal `text`, `{1,2,3}`, into `out`; answers how many. */
export const standInInts = (text: string, out: i32[]): i32 => {
  let n: i32 = 0
  let v: i32 = 0
  let any: boolean = false
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    const d: i32 = toI32(text.charCodeAt(k))
    if (d >= 48 && d <= 57) {
      v = v * 10 + d - 48
      any = true
    } else if ((d === 44 || d === 125) && any && n < toI32(out.length)) {
      out[n] = v
      n += 1
      v = 0
      any = false
    }
  }
  return n
}

/** Accepts one connection, polling every 2 ms for at most two seconds; -1 when none came. */
const standInAccept = async (listen: i32): Promise<i32> => {
  const peer: u8[] = new Array<u8>(32)
  for (let waited: i32 = 0; waited < 2000; waited += 2) {
    const fd: i32 = tcpAccept(listen, peer)
    if (fd !== -11) {
      return fd
    }
    await sleep(2)
  }
  return -1
}

/** The next message into `w` (its type, 0 for the untyped startup), or -1 when the peer left. */
const standInMessage = async (fd: i32, w: Wire, typed: boolean): Promise<i32> => {
  w.start = w.stop
  while (true) {
    const total: i32 = w.whole(typed)
    if (total > 0) {
      w.body = w.start + (typed ? 5 : 4)
      w.stop = w.start + total
      return typed ? toI32(w.buf[w.start]) : 0
    }
    w.compact()
    const n: i32 = netRead(fd, w.buf, w.end, toI32(w.buf.length) - w.end)
    if (n === -11) {
      const ok: boolean = await readable(fd)
      if (!ok) {
        return -1
      }
    } else if (n <= 0) {
      return -1
    } else {
      w.end += n
    }
  }
}

/** Writes `o`'s bytes to `fd` and empties it; false when the peer left. */
const standInFlush = async (fd: i32, o: Out): Promise<boolean> => {
  let at: i32 = 0
  while (at < o.n) {
    const n: i32 = netWrite(fd, o.bytes, at, o.n - at)
    if (n === -11) {
      const ok: boolean = await writable(fd)
      if (!ok) {
        return false
      }
    } else if (n <= 0) {
      return false
    } else {
      at += n
    }
  }
  o.n = 0
  return true
}

/** A DataRow of two cells, an integer and `text`. */
const standInRow = (o: Out, id: i32, text: string): void => {
  const first: string = `${id}`
  o.begin(68)
  o.int16(2)
  o.int32(toI32(first.length))
  o.text(first)
  o.int32(toI32(text.length))
  o.text(text)
  o.finish()
}

/** An ErrorResponse naming `code`. */
const standInRefuse = (o: Out, code: string): void => {
  o.begin(69)
  o.byte(83)
  o.cstr("ERROR")
  o.byte(67)
  o.cstr(code)
  o.byte(77)
  o.cstr("refused by the stand-in")
  o.byte(0)
  o.finish()
}

/**
 * Accepts one connection on `listen` and answers its statements from `table`
 * until the peer leaves or sends Terminate.
 */
export const standIn = async (listen: i32, table: Table): Promise<void> => {
  const fd: i32 = await standInAccept(listen)
  if (fd < 0) {
    return
  }
  const w = new Wire()
  const o = new Out()
  const ids: i32[] = new Array<i32>(1024)
  const numbers: i32[] = new Array<i32>(1024)
  const startup: i32 = await standInMessage(fd, w, false)
  let live: boolean = startup >= 0
  if (live) {
    o.begin(82)
    o.int32(0)
    o.finish()
    o.begin(83)
    o.cstr("client_encoding")
    o.cstr("UTF8")
    o.finish()
    o.begin(75)
    o.int32(4242)
    o.int32(99)
    o.finish()
    o.ready(73)
    live = await standInFlush(fd, o)
  }
  while (live) {
    let sql: string = ""
    const values: string[] = []
    let synced: boolean = false
    while (!synced && live) {
      const type: i32 = await standInMessage(fd, w, true)
      if (type < 0 || type === 88) {
        live = false
      } else if (type === 80) {
        // Parse: the statement's name, then its text.
        let p: i32 = w.body
        while (toI32(w.buf[p]) !== 0) {
          p += 1
        }
        sql = w.cstr(p + 1)
      } else if (type === 66) {
        // Bind: portal, statement, format codes, then the values, none NULL.
        let p: i32 = w.body
        while (toI32(w.buf[p]) !== 0) {
          p += 1
        }
        p += 1
        while (toI32(w.buf[p]) !== 0) {
          p += 1
        }
        p += 1
        p += 2 + 2 * w.int16(p)
        const count: i32 = w.int16(p)
        p += 2
        for (let i: i32 = 0; i < count; i++) {
          const n: i32 = w.int32(p)
          p += 4
          values.push(n < 0 ? "" : String.fromBytes(w.buf, p, p + n))
          p += n < 0 ? 0 : n
        }
      } else if (type === 83) {
        synced = true
      }
    }
    if (!live) {
      break
    }
    o.begin(49)
    o.finish()
    o.begin(50)
    o.finish()
    if (sql === TFB_WORLD_SQL && table.refuseWorld) {
      table.refuseWorld = false
      standInRefuse(o, "57014")
    } else if (sql === TFB_WORLD_SQL && toI32(values.length) === 1) {
      table.worldReads += 1
      const n: i32 = standInInts(values[0], ids)
      let found: i32 = 0
      for (let k: i32 = 0; k < n && live; k++) {
        const id: i32 = ids[k]
        if (id >= 1 && id <= ROWS) {
          standInRow(o, id, `${table.world[id]}`)
          found += 1
        }
      }
      o.complete(`SELECT ${found}`)
    } else if (sql === TFB_CACHE_SQL && table.refuseCache) {
      table.refuseCache = false
      standInRefuse(o, "57014")
    } else if (sql === TFB_CACHE_SQL) {
      table.cacheReads += 1
      for (let id: i32 = 1; id <= ROWS && live; id++) {
        standInRow(o, id, `${table.world[id]}`)
        if (o.n > FLUSH_AT) {
          live = await standInFlush(fd, o)
        }
      }
      o.complete(`SELECT ${ROWS}`)
    } else if (sql === TFB_FORTUNE_SQL) {
      for (let k: i32 = 0; k < toI32(table.fortunes.length); k++) {
        standInRow(o, k + 1, table.fortunes[k])
      }
      o.complete(`SELECT ${table.fortunes.length}`)
    } else if (sql === TFB_UPDATE_SQL && toI32(values.length) === 2) {
      table.updates += 1
      const n: i32 = standInInts(values[0], ids)
      const m: i32 = standInInts(values[1], numbers)
      if (n !== m) {
        table.unordered = true
      }
      for (let k: i32 = 0; k < n && k < m; k++) {
        if (k > 0 && ids[k] <= ids[k - 1]) {
          table.unordered = true
        }
        if (ids[k] >= 1 && ids[k] <= ROWS) {
          table.world[ids[k]] = numbers[k]
        }
      }
      o.complete(`UPDATE ${n}`)
    } else {
      table.other += 1
      standInRefuse(o, "42601")
    }
    o.ready(73)
    if (live) {
      live = await standInFlush(fd, o)
    }
  }
  netClose(fd)
}
