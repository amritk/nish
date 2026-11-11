// A loopback stand-in PostgreSQL for the async database entry
// (bench/techempower/async-db-server.ts), in the same process as the pool it
// serves. `standIn` accepts connections one after another, the pool having
// one, answers each startup as a `trust` server, then each Parse, Bind,
// Execute and Sync by the statement's text, a Bind naming a statement a
// Parse on the same connection prepared, which it pins as the literals the
// entry must send:
//
//   WORLD_SQL    one row (id, randomNumber) per id of the `int8[]`
//                parameter, in its order, repeats included
//   CACHE_SQL    every World row
//   FORTUNE_SQL  the fortune rows, unsorted
//   UPDATE_SQL   writes the second `int8[]` into the rows the first names
//   anything else  an ErrorResponse, counted in `other`
//
// The table's flags make the next such answer go wrong in one way: refused,
// held, cut off mid-answer, ended out of step, or too long to fit. A
// connection that sends nothing is kept until the client is `finished`,
// however long it idles, as a server's is. The table
// is the one object the stand-in shares with the test's client; the
// stand-in's task body writes it, and its helpers only read it.
import { readableWithin, sleep, writableWithin } from "nish:async"
import { netClose, netRead, netWrite, tcpAccept } from "nish:net"
import { Out, Wire } from "../std_postgres_async/server"

/** The entry's World read, word for word. */
const WORLD_SQL: string =
  "select w.id, w.randomnumber from unnest($1::int8[]) with ordinality as q(key, ord) join world w on w.id = q.key order by q.ord"
/** The entry's whole-table read, for the cache. */
const CACHE_SQL: string = "select id, randomnumber from world"
/** The entry's fortunes read. */
const FORTUNE_SQL: string = "select id, message from fortune"
/** The entry's update, one statement a request. */
const UPDATE_SQL: string =
  "update world set randomnumber = v.r from (select unnest($1::int8[]) as id, unnest($2::int8[]) as r) as v where world.id = v.id"
/** The fortune rows a crowded answer sends, past the 255 a page holds. */
const CROWD: i32 = 300
/** How long the stand-in waits for a connection, or holds a whole-table read, in milliseconds. */
const WAIT_MS: i32 = 5000

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
  /** Whether a whole-table read waits until it is cleared; `cacheHeld` is set while one does. */
  holdCache: boolean = false
  cacheHeld: boolean = false
  /** Whether the next World read is cut off after its first row, the connection closed. */
  dropWorld: boolean = false
  /**
   * Whether the next World read ends with ReadyForQuery 'T', in a transaction,
   * so the connection is out of step.
   */
  busyWorld: boolean = false
  /** Whether the next fortunes read answers more rows than a page holds. */
  crowdFortunes: boolean = false
  /** Connections accepted. */
  accepted: i32 = 0
  /** Parses received: each statement's first time on a connection. */
  parses: i32 = 0
  /** Parses of a name the same connection had already prepared. */
  reparsed: i32 = 0
  /** Set once the client is done: an idle connection then waits no longer. */
  finished: boolean = false

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

/** Accepts one connection, polling every 2 ms for at most `WAIT_MS`; -1 when none came. */
const standInAccept = async (listen: i32): Promise<i32> => {
  const peer: u8[] = new Array<u8>(32)
  for (let waited: i32 = 0; waited < WAIT_MS; waited += 2) {
    const fd: i32 = tcpAccept(listen, peer)
    if (fd !== -11) {
      return fd
    }
    await sleep(2)
  }
  return -1
}

/**
 * The next message into `w` (its type, 0 for the untyped startup), or -1
 * when the peer left. Between messages (`idle`) it waits until the table is
 * `finished`; within one, at most `WAIT_MS` at a time.
 */
const standInMessage = async (fd: i32, w: Wire, typed: boolean, idle: boolean, table: Table): Promise<i32> => {
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
      const ok: boolean = await readableWithin(fd, WAIT_MS)
      if (!ok && !(idle && w.end === w.start && !table.finished)) {
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
      const ok: boolean = await writableWithin(fd, WAIT_MS)
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
 * Accepts `connections` connections on `listen`, one after another, and
 * answers each one's statements from `table` until the peer leaves or sends
 * Terminate; stops early when none comes within `WAIT_MS`.
 */
export const standIn = async (listen: i32, table: Table, connections: i32): Promise<void> => {
  for (let k: i32 = 0; k < connections; k++) {
    const fd: i32 = await standInAccept(listen)
    if (fd < 0) {
      return
    }
    table.accepted += 1
    const w = new Wire()
    const o = new Out()
    const ids: i32[] = new Array<i32>(1024)
    const numbers: i32[] = new Array<i32>(1024)
    // The statements this connection's Parses named, and their text.
    const names: string[] = []
    const texts: string[] = []
    const startup: i32 = await standInMessage(fd, w, false, false, table)
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
      let parsed: boolean = false
      let first: boolean = true
      while (!synced && live) {
        const type: i32 = await standInMessage(fd, w, true, first, table)
        first = false
        if (type < 0 || type === 88) {
          live = false
        } else if (type === 80) {
          // Parse: the statement's name, then its text.
          let p: i32 = w.body
          while (toI32(w.buf[p]) !== 0) {
            p += 1
          }
          sql = w.cstr(p + 1)
          const named: string = w.cstr(w.body)
          for (let i: i32 = 0; i < toI32(names.length); i++) {
            if (names[i] === named) {
              table.reparsed += 1
            }
          }
          names.push(named)
          texts.push(sql)
          parsed = true
          table.parses += 1
        } else if (type === 66) {
          // Bind: portal, statement, format codes, then the values, none NULL.
          let p: i32 = w.body
          while (toI32(w.buf[p]) !== 0) {
            p += 1
          }
          p += 1
          const name: string = w.cstr(p)
          for (let i: i32 = toI32(names.length) - 1; i >= 0 && !parsed; i--) {
            if (names[i] === name) {
              sql = texts[i]
              break
            }
          }
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
      if (parsed) {
        o.begin(49)
        o.finish()
      }
      o.begin(50)
      o.finish()
      let status: i32 = 73
      if (sql === CACHE_SQL && table.holdCache) {
        table.cacheHeld = true
        let held: i32 = 0
        while (table.holdCache && held < WAIT_MS) {
          await sleep(1)
          held += 1
        }
        table.cacheHeld = false
      }
      if (sql === WORLD_SQL && table.refuseWorld) {
        table.refuseWorld = false
        standInRefuse(o, "57014")
      } else if (sql === WORLD_SQL && table.dropWorld && toI32(values.length) === 1) {
        // One row of the answer, then the connection is gone.
        table.dropWorld = false
        const n: i32 = standInInts(values[0], ids)
        standInRow(o, ids[0], n > 0 && ids[0] >= 1 && ids[0] <= ROWS ? `${table.world[ids[0]]}` : "0")
        await standInFlush(fd, o)
        live = false
        break
      } else if (sql === WORLD_SQL && toI32(values.length) === 1) {
        if (table.busyWorld) {
          table.busyWorld = false
          status = 84
        }
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
      } else if (sql === CACHE_SQL && table.refuseCache) {
        table.refuseCache = false
        standInRefuse(o, "57014")
      } else if (sql === CACHE_SQL) {
        table.cacheReads += 1
        for (let id: i32 = 1; id <= ROWS && live; id++) {
          standInRow(o, id, `${table.world[id]}`)
          if (o.n > FLUSH_AT) {
            live = await standInFlush(fd, o)
          }
        }
        o.complete(`SELECT ${ROWS}`)
      } else if (sql === FORTUNE_SQL && table.crowdFortunes) {
        table.crowdFortunes = false
        for (let k: i32 = 0; k < CROWD; k++) {
          standInRow(o, k + 1, "crowd")
        }
        o.complete(`SELECT ${CROWD}`)
      } else if (sql === FORTUNE_SQL) {
        for (let k: i32 = 0; k < toI32(table.fortunes.length); k++) {
          standInRow(o, k + 1, table.fortunes[k])
        }
        o.complete(`SELECT ${table.fortunes.length}`)
      } else if (sql === UPDATE_SQL && toI32(values.length) === 2) {
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
      o.ready(status)
      if (live) {
        live = await standInFlush(fd, o)
      }
    }
    netClose(fd)
  }
}
