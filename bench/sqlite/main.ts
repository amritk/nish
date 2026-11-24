// The challenge's three queries through `nish/sqlite`, `count` calls each:
//
//   main <lookup|feed|feed-cursor-walk|feed-cursor-count|feed-cursor|insert|insert-txn> <db> <count>
//
// `bench/sqlite/run.mjs` builds it with `--link` (the speed profile) and runs
// it beside `twin.c`, the same loop written against SQLite's own API. Each
// call binds, steps, reads every column (text copied into one reused buffer
// with `columnInto`) and resets, on a statement prepared once:
//
// - lookup: one post by a random id, its author and its like count.
// - feed: the 20 newest posts, every row read.
// - feed-cursor: the same 20 rows, read through B-tree cursors and no SQL, as
//   tests/link/std_sqlite_cursor_feed walks them: the (created_at DESC, id
//   DESC) index from its first entry, each post and its author by rowid, and
//   its likes counted by seeking the likes index on the post's id. A call is
//   what a request would do: `beginRead`, open the four cursors (each open
//   checks its schema), walk, `endRead`, which closes them. It folds what
//   `feed` folds in the same order, so the two print the same line; twin.c
//   has no cursor path.
// - feed-cursor-walk: the same walk on one read transaction and four cursors
//   opened once, before the timed loop, and closed after it, so a call is the
//   seeks and steps alone. feed-cursor less it is what the per-call opens cost.
// - feed-cursor-count: feed-cursor-walk with the 20 posts' likes counted in
//   one call, `Cursor.countRange(minId, maxId, out)`: one seek and one walk of
//   the likes index inside the adapter, instead of a seek and a `next` per
//   like from Nish. It reads the 20 ids from the posts index first, then each
//   post's count at `out[id - minId]`. The 20 newest posts are consecutive
//   ids on this seed; a span wider than COUNT_SPAN falls back to one
//   `countRange(id, id, out)` per post.
// - insert: `INSERT … RETURNING id, created_at` in autocommit, WAL with
//   `synchronous=NORMAL`; `insert-txn` the same calls inside one transaction,
//   which tells a call's cost from its commit's.
//
// Every value read is folded into a checksum, so the optimiser can drop no
// read; the fold is inside the timed loop on both sides. It prints
// `rows R checksum S failed F count N ns T`, the line `twin.c` prints for the
// same arguments, T the timed loop alone.
//
// <db> is opened with OPEN_URI, so a path opens as it always has and a
// `file:<path>?vfs=unix-excl` URI opens the same file on SQLite's unix-excl
// VFS: run.mjs's `--variant unix-excl` (docs/sqlite-vfs.md).
//
// USERS and POSTS are the sizes of the twelve-dollar server challenge's
// seed/generate.mjs (https://github.com/arjaythedev/twelve-dollar-server-challenge),
// which twin.c's seed ports; POST_SQL and INSERT_SQL are the queries of its
// SPEC.md.
// Copyright (c) 2026 arjaythedev and the challenge contributors. MIT License;
// see bench/sqlite/LICENSE.md.
import { OPEN_READWRITE, OPEN_URI, SEEK_GE, Cursor, Database, Statement, openDatabase } from "nish/sqlite"

const USERS: i32 = 50000
const POSTS: i32 = 500000
/** The rows a feed answers: POST_SQL's LIMIT. */
const FEED: i32 = 20
/** The widest id span feed-cursor-count counts in one call: its buffer's length. */
const COUNT_SPAN: i32 = 1024
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

  /** Column `c` of a statement copied into `buf` and folded; false when the read failed. */
  text(st: Statement, c: i32): boolean {
    const r = st.columnInto(c, this.buf, 0)
    if (r.isErr()) {
      return false
    }
    this.bytes(r.value)
    return true
  }

  /** Column `c` of a cursor copied into `buf` and folded, as `text` folds a statement's. */
  cursorText(cur: Cursor, c: i32): boolean {
    const r = cur.columnInto(c, this.buf, 0)
    if (r.isErr()) {
      return false
    }
    this.bytes(r.value)
    return true
  }

  /** A text value's length `n` and its bytes in `buf` folded. */
  bytes(n: i32): void {
    // The sum is kept in a local across the loop, as twin.c's stays in a
    // register: a store to `this.sum` each byte would make the optimiser
    // reload `this.buf` each byte too, and time the fold, not the module.
    const buf: u8[] = this.buf
    let sum: u32 = this.sum * 31 + toU32(n)
    for (let k: i32 = 0; k < n && k < toI32(buf.length); k += 1) {
      sum = sum * 31 + toU32(buf[k])
    }
    this.sum = sum
  }

  /** One row of POST_SQL: id, body, created_at, username, like count. */
  post(st: Statement): boolean {
    this.add(toU32(st.columnI64(0)))
    const ok: boolean = this.text(st, 1) && this.text(st, 2) && this.text(st, 3)
    this.add(toU32(st.columnI64(4)))
    return ok
  }
}

/**
 * The 20 newest posts read through the four cursors, each folded as
 * `Fold.post` folds a row of POST_SQL. Answers the rows read, or -1 when a
 * read failed.
 */
const walkFeed = (ix: Cursor, post: Cursor, user: Cursor, like: Cursor, f: Fold): i32 => {
  let rows: i32 = 0
  let ok: boolean = true
  let r = ix.first()
  while (ok && r.isOk() && r.value && rows < FEED) {
    const id: i64 = ix.rowid()
    const p = post.seekRowid(id)
    ok = p.isOk() && p.value
    if (ok) {
      const u = user.seekRowid(post.columnI64(1))
      ok = u.isOk() && u.value
    }
    // The fold order is POST_SQL's: id, body, created_at, username, likes.
    f.add(toU32(id))
    ok = ok && f.cursorText(post, 2) && f.cursorText(post, 3) && f.cursorText(user, 1)
    let n: i64 = 0
    ok = ok && like.keyReset().isOk() && like.keyI64(id).isOk()
    if (ok) {
      let l = like.seek(SEEK_GE)
      while (l.isOk() && l.value && like.columnI64(0) === id) {
        n += 1
        l = like.next()
      }
      ok = l.isOk()
    }
    f.add(toU32(n))
    rows += 1
    r = ix.next()
  }
  return ok && r.isOk() ? rows : -1
}

/**
 * The 20 newest posts as `walkFeed` reads them, their likes counted in one
 * `Cursor.countRange` over the posts' [min, max] id span into `counts` (one
 * call per post when the span is wider than `counts`). `ids` holds the posts'
 * ids, read from `ix` first. Answers the rows read, or -1 when a read failed.
 */
const walkFeedCounted = (
  ix: Cursor,
  post: Cursor,
  user: Cursor,
  like: Cursor,
  ids: i64[],
  counts: i64[],
  f: Fold
): i32 => {
  let rows: i32 = 0
  let r = ix.first()
  while (r.isOk() && r.value && rows < FEED) {
    ids[rows] = ix.rowid()
    rows += 1
    r = ix.next()
  }
  let ok: boolean = r.isOk()
  let lo: i64 = 0
  let hi: i64 = -1
  for (let i: i32 = 0; i < rows; i += 1) {
    if (i === 0 || ids[i] < lo) {
      lo = ids[i]
    }
    if (i === 0 || ids[i] > hi) {
      hi = ids[i]
    }
  }
  // One seek and one walk in C, post id k's count left in `counts[k - lo]`.
  const one: boolean = rows > 0 && hi - lo < toI64(counts.length)
  if (ok && one) {
    ok = like.countRange(lo, hi, counts).isOk()
  }
  for (let i: i32 = 0; ok && i < rows; i += 1) {
    const id: i64 = ids[i]
    const p = post.seekRowid(id)
    ok = p.isOk() && p.value
    if (ok) {
      const u = user.seekRowid(post.columnI64(1))
      ok = u.isOk() && u.value
    }
    // The fold order is POST_SQL's: id, body, created_at, username, likes.
    f.add(toU32(id))
    ok = ok && f.cursorText(post, 2) && f.cursorText(post, 3) && f.cursorText(user, 1)
    let n: i64 = 0
    if (one) {
      n = counts[toI32(id - lo)]
    } else {
      ok = ok && like.countRange(id, id, counts).isOk()
      n = counts[0]
    }
    f.add(toU32(n))
  }
  return ok ? rows : -1
}

/**
 * One feed call through cursors, as a request makes it: `beginRead`, open the
 * four cursors, walk them, `endRead`, which closes them. Answers the rows
 * read, or -1 when any step failed.
 */
const feedByCursors = (db: Database, f: Fold): i32 => {
  if (db.beginRead().isErr()) {
    return -1
  }
  const recent = db.openCursor("posts_created_at_id_idx", "created_at DESC,id DESC,rowid")
  const posts = db.openCursor("posts", "id,user_id,body,created_at")
  const users = db.openCursor("users", "id,username,created_at")
  const likes = db.openCursor("likes_post_id_idx", "post_id,rowid")
  let rows: i32 = -1
  if (recent.isOk() && posts.isOk() && users.isOk() && likes.isOk()) {
    rows = walkFeed(recent.value, posts.value, users.value, likes.value, f)
  }
  if (db.endRead().isErr()) {
    return -1
  }
  return rows
}

export const main = (): number => {
  if (toI32(process.argv.length) !== 4) {
    console.error(
      "usage: main <lookup|feed|feed-cursor-walk|feed-cursor-count|feed-cursor|insert|insert-txn> <db> <count>"
    )
    return 2
  }
  const mode: string = process.argv[1]
  const count: i32 = toI32(parseInt(process.argv[3]))
  const opened = openDatabase(process.argv[2], OPEN_READWRITE | OPEN_URI)
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
    const prepared = db.prepare(`${POST_SQL} ORDER BY p.created_at DESC, p.id DESC LIMIT ${FEED}`)
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
  } else if (mode === "feed-cursor") {
    t0 = monotonicNanos()
    for (let i: i32 = 0; i < count; i += 1) {
      const n: i32 = feedByCursors(db, f)
      if (n < 0) {
        failed += 1
      } else {
        rows += n
      }
    }
    t1 = monotonicNanos()
  } else if (mode === "feed-cursor-walk" || mode === "feed-cursor-count") {
    const counted: boolean = mode === "feed-cursor-count"
    const ids: i64[] = new Array<i64>(FEED)
    const counts: i64[] = new Array<i64>(COUNT_SPAN)
    if (db.beginRead().isErr()) {
      return 2
    }
    const recent = db.openCursor("posts_created_at_id_idx", "created_at DESC,id DESC,rowid")
    const posts = db.openCursor("posts", "id,user_id,body,created_at")
    const users = db.openCursor("users", "id,username,created_at")
    const likes = db.openCursor("likes_post_id_idx", "post_id,rowid")
    if (recent.isOk() && posts.isOk() && users.isOk() && likes.isOk()) {
      t0 = monotonicNanos()
      for (let i: i32 = 0; i < count; i += 1) {
        const n: i32 = counted
          ? walkFeedCounted(recent.value, posts.value, users.value, likes.value, ids, counts, f)
          : walkFeed(recent.value, posts.value, users.value, likes.value, f)
        if (n < 0) {
          failed += 1
        } else {
          rows += n
        }
      }
      t1 = monotonicNanos()
    } else {
      failed = count
    }
    if (db.endRead().isErr()) {
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
