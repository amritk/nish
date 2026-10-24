// The challenge's three queries through `nish/sqlite`, `count` calls each:
//
//   main <lookup|feed|insert|insert-txn> <db> <count>
//
// `bench/sqlite/run.mjs` builds it with `--link` (the speed profile) and runs
// it beside `twin.c`, the same loop written against SQLite's own API. Each
// call binds, steps, reads every column (text copied into one reused buffer
// with `columnInto`) and resets, on a statement prepared once:
//
// - lookup: one post by a random id, its author and its like count.
// - feed: the 20 newest posts, every row read.
// - insert: `INSERT … RETURNING id, created_at` in autocommit, WAL with
//   `synchronous=NORMAL`; `insert-txn` the same calls inside one transaction,
//   which tells a call's cost from its commit's.
//
// Every value read is folded into a checksum, so the optimiser can drop no
// read; the fold is inside the timed loop on both sides. It prints
// `rows R checksum S failed F count N ns T`, the line `twin.c` prints for the
// same arguments, T the timed loop alone.
//
// USERS and POSTS are the sizes of the twelve-dollar server challenge's
// seed/generate.mjs (https://github.com/arjaythedev/twelve-dollar-server-challenge),
// which twin.c's seed ports; POST_SQL and INSERT_SQL are the queries of its
// SPEC.md.
// Copyright (c) 2026 arjaythedev and the challenge contributors. MIT License;
// see bench/sqlite/LICENSE.md.
import { OPEN_READWRITE, Statement, openDatabase } from "nish/sqlite"

const USERS: i32 = 50000
const POSTS: i32 = 500000
const POST_SQL: string =
  "SELECT p.id, p.body, p.created_at, u.username, (SELECT count(*) FROM likes l WHERE l.post_id = p.id) FROM posts p JOIN users u ON u.id = p.user_id"
const INSERT_SQL: string = "INSERT INTO posts (user_id, body) VALUES (?, ?) RETURNING id, created_at"

/** The checksum every value read is folded into, and the buffer text is copied into. */
class Fold {
  sum: u32 = 0
  buf: u8[]

  constructor() {
    this.buf = new Array<u8>(1024)
  }

  add(v: u32): void {
    this.sum = this.sum * 31 + v
  }

  /** Column `c` copied into `buf`, its length and every byte folded; false when the read failed. */
  text(st: Statement, c: i32): boolean {
    const r = st.columnInto(c, this.buf, 0)
    if (r.isErr()) {
      return false
    }
    const n: i32 = r.value
    // The sum is kept in a local across the loop, as twin.c's stays in a
    // register: a store to `this.sum` each byte would make the optimiser
    // reload `this.buf` each byte too, and time the fold, not the module.
    const buf: u8[] = this.buf
    let sum: u32 = this.sum * 31 + toU32(n)
    for (let k: i32 = 0; k < n && k < toI32(buf.length); k += 1) {
      sum = sum * 31 + toU32(buf[k])
    }
    this.sum = sum
    return true
  }

  /** One row of POST_SQL: id, body, created_at, username, like count. */
  post(st: Statement): boolean {
    this.add(toU32(st.columnI64(0)))
    const ok: boolean = this.text(st, 1) && this.text(st, 2) && this.text(st, 3)
    this.add(toU32(st.columnI64(4)))
    return ok
  }
}

export const main = (): number => {
  if (toI32(process.argv.length) !== 4) {
    console.error("usage: main <lookup|feed|insert|insert-txn> <db> <count>")
    return 2
  }
  const mode: string = process.argv[1]
  const count: i32 = toI32(parseInt(process.argv[3]))
  const opened = openDatabase(process.argv[2], OPEN_READWRITE)
  if (opened.isErr()) {
    console.error(`main: ${opened.error.message}`)
    return 2
  }
  const db = opened.value
  if (db.exec("PRAGMA synchronous=NORMAL").isErr()) {
    return 2
  }
  const f = new Fold()
  let rows: i32 = 0
  let failed: i32 = 0
  let t0: i64 = 0
  let t1: i64 = 0

  if (mode === "lookup") {
    const prepared = db.prepare(`${POST_SQL} WHERE p.id = ?`)
    if (prepared.isErr()) {
      console.error(`main: ${prepared.error.message}`)
      return 2
    }
    const st = prepared.value
    let x: u32 = 2463534242
    t0 = monotonicNanos()
    for (let i: i32 = 0; i < count; i += 1) {
      x = x ^ (x << 13)
      x = x ^ (x >> 17)
      x = x ^ (x << 5)
      if (st.bindI64(1, toI64(x % toU32(POSTS)) + 1).isErr()) {
        failed += 1
      }
      const r = st.step()
      if (r.isOk() && r.value) {
        rows += 1
        if (!f.post(st)) {
          failed += 1
        }
      } else {
        failed += 1
      }
      if (st.reset().isErr()) {
        failed += 1
      }
    }
    t1 = monotonicNanos()
    if (st.finalize().isErr()) {
      failed += 1
    }
  } else if (mode === "feed") {
    const prepared = db.prepare(`${POST_SQL} ORDER BY p.created_at DESC, p.id DESC LIMIT 20`)
    if (prepared.isErr()) {
      console.error(`main: ${prepared.error.message}`)
      return 2
    }
    const st = prepared.value
    t0 = monotonicNanos()
    for (let i: i32 = 0; i < count; i += 1) {
      let more: boolean = true
      while (more) {
        const r = st.step()
        if (r.isErr()) {
          failed += 1
          more = false
        } else if (r.value) {
          rows += 1
          if (!f.post(st)) {
            failed += 1
          }
        } else {
          more = false
        }
      }
      if (st.reset().isErr()) {
        failed += 1
      }
    }
    t1 = monotonicNanos()
    if (st.finalize().isErr()) {
      failed += 1
    }
  } else if (mode === "insert" || mode === "insert-txn") {
    const txn: boolean = mode === "insert-txn"
    // The 64 bodies the inserts cycle through, body k at k * 256, built as
    // twin.c builds them.
    const bodies: u8[] = new Array<u8>(64 * 256)
    for (let k: i32 = 0; k < 64; k += 1) {
      const len: i32 = 40 + ((k * 37) % 200)
      for (let j: i32 = 0; j < len; j += 1) {
        bodies[k * 256 + j] = j % 6 === 5 ? 32 : toU8(97 + ((j * 7 + k) % 26))
      }
    }
    // The rows a run adds go again before and after it, untimed, so every run
    // starts from the seed and RETURNING answers the same ids.
    if (db.exec("DELETE FROM posts WHERE id > 500000").isErr()) {
      return 2
    }
    const prepared = db.prepare(INSERT_SQL)
    if (prepared.isErr()) {
      console.error(`main: ${prepared.error.message}`)
      return 2
    }
    const st = prepared.value
    t0 = monotonicNanos()
    if (txn && db.begin().isErr()) {
      failed += 1
    }
    for (let i: i32 = 0; i < count; i += 1) {
      const k: i32 = i % 64
      if (st.bindI64(1, toI64(1 + (i % USERS))).isErr()) {
        failed += 1
      }
      if (st.bindTextBytes(2, bodies, k * 256, 40 + ((k * 37) % 200)).isErr()) {
        failed += 1
      }
      const r = st.step()
      if (r.isOk() && r.value) {
        rows += 1
        f.add(toU32(st.columnI64(0)))
        // created_at is the clock's: its length is folded, not its bytes.
        const n = st.columnInto(1, f.buf, 0)
        if (n.isOk()) {
          f.add(toU32(n.value))
        } else {
          failed += 1
        }
      } else {
        failed += 1
      }
      if (st.reset().isErr()) {
        failed += 1
      }
    }
    if (txn && db.commit().isErr()) {
      failed += 1
    }
    t1 = monotonicNanos()
    if (st.finalize().isErr()) {
      failed += 1
    }
    if (db.exec("DELETE FROM posts WHERE id > 500000").isErr()) {
      return 2
    }
    if (db.exec("PRAGMA wal_checkpoint(TRUNCATE)").isErr()) {
      return 2
    }
  } else {
    console.error(`main: unknown workload ${mode}`)
    return 2
  }
  if (db.close().isErr()) {
    return 2
  }
  console.log(`rows ${rows} checksum ${f.sum} failed ${failed} count ${count} ns ${t1 - t0}`)
  return 0
}
