// The feed read two ways: by the SQL query a feed runs (posts joined to their
// author, a count of each post's likes, newest first, 20 rows), and by
// cursors alone, as a program would hand-plan it: walk the
// (created_at DESC, id DESC) index from its first entry, look each post and
// its author up by rowid, and count its likes by seeking the likes index on
// the post's id and stepping while the key matches. The schema is the
// twelve-dollar server challenge's, read at run time from
// bench/sqlite/schema.sql (MIT; see bench/sqlite/LICENSE.md) and executed
// unchanged, so `openCursor` checks the real tables: their DEFAULTs, CHECK and
// three indexes. Timestamps are in its wire format (YYYY-MM-DDTHH:MM:SS.mmmZ),
// and users take the DEFAULT one. Twelve posts share each timestamp, so the
// order within a stamp comes from the id; every third post has no likes and
// the rest one to seven; names and bodies hold non-ASCII text, and the bodies
// are read into a 16-byte buffer first, so most need the buffer grown and read
// again. Both renderings are printed, and must be the same bytes.
import { readFileSyncOrNull } from "nish:fs";
import { Suite } from "nish/testing";
import {
  OPEN_CREATE,
  OPEN_READWRITE,
  SEEK_GE,
  SQLITE_ERROR,
  Cursor,
  Database,
  openDatabase,
} from "nish/sqlite";

/** How many rows the feed answers. */
const PAGE: i32 = 20;

/** The buffer column reads use, which `textOf` grows. */
class Scratch {
  buf: u8[];
  grown: i32 = 0;
  constructor() {
    this.buf = new Array<u8>(16);
  }
}

/** The cursor's text column `c`, read into `s.buf`, grown when short. */
const textOf = (cur: Cursor, c: i32, s: Scratch): string => {
  let n = cur.columnInto(c, s.buf, 0).expect("columnInto");
  if (n > s.buf.length) {
    s.buf = new Array<u8>(n);
    s.grown = s.grown + 1;
    n = cur.columnInto(c, s.buf, 0).expect("columnInto again");
  }
  return String.fromBytes(s.buf, 0, n);
};

/** One feed row, as both readings render it. */
const line = (id: i64, body: string, at: string, user: string, likes: i64): string =>
  `${id} | ${at} | ${user} | ${likes} | ${body}\n`;

/** The feed through SQL. */
const bySql = (db: Database): string => {
  const q = db
    .prepare(
      "SELECT p.id, p.body, p.created_at, u.username," +
        " (SELECT count(*) FROM likes l WHERE l.post_id = p.id)" +
        " FROM posts p JOIN users u ON u.id = p.user_id" +
        " ORDER BY p.created_at DESC, p.id DESC LIMIT 20"
    )
    .expect("prepare the feed");
  let out = "";
  let r = q.step();
  while (r.isOk() && r.value) {
    const body = q.columnText(1);
    const at = q.columnText(2);
    const user = q.columnText(3);
    out = out + line(q.columnI64(0), body ?? "", at ?? "", user ?? "", q.columnI64(4));
    r = q.step();
  }
  q.finalize().expect("finalize");
  return out;
};

/** The feed through cursors. */
const byCursors = (t: Suite, db: Database, s: Scratch): string => {
  db.beginRead().expect("beginRead");
  const recent = db.openCursor("posts_created_at_id_idx", "created_at DESC,id DESC,rowid").expect("open the index");
  const posts = db.openCursor("posts", "id,user_id,body,created_at").expect("open posts");
  const users = db.openCursor("users", "id,username,created_at").expect("open users");
  const likes = db.openCursor("likes_post_id_idx", "post_id,rowid").expect("open the likes index");
  let out = "";
  let rows = 0;
  let idIsRowid = true;
  let r = recent.first();
  while (r.isOk() && r.value && rows < PAGE) {
    const id = recent.rowid();
    if (recent.columnI64(1) !== id) idIsRowid = false;
    posts.seekRowid(id).expect("seek the post");
    const author = posts.columnI64(1);
    const body = textOf(posts, 2, s);
    const at = textOf(posts, 3, s);
    users.seekRowid(author).expect("seek the author");
    const user = textOf(users, 1, s);
    likes.keyReset().expect("keyReset");
    likes.keyI64(id).expect("keyI64");
    let n = toI64(0);
    let l = likes.seek(SEEK_GE);
    while (l.isOk() && l.value && likes.columnI64(0) === id) {
      n = n + toI64(1);
      l = likes.next();
    }
    out = out + line(id, body, at, user, n);
    rows = rows + 1;
    r = recent.next();
  }
  t.eqI32("cursors: 20 rows", rows, PAGE);
  t.ok("cursors: the index's id column is the rowid", idIsRowid);
  db.endRead().expect("endRead");
  return out;
};

export const main = (): i32 => {
  const t = new Suite("std_sqlite_cursor_feed");
  const opened = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE);
  if (opened.isErr()) {
    t.fail("open", opened.error.message);
    return t.done();
  }
  const db = opened.value;
  // The tests run from the repository root.
  const schema = readFileSyncOrNull("bench/sqlite/schema.sql");
  if (schema === null) {
    t.fail("read", "bench/sqlite/schema.sql");
    return t.done();
  }
  if (db.exec(schema).isErr()) {
    t.fail("schema", db.error(SQLITE_ERROR).message);
    return t.done();
  }
  const rows =
    "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 25)" +
    " INSERT INTO users (id, username) SELECT x, CASE x % 3 WHEN 0 THEN 'zoë_' WHEN 1 THEN '名前_' ELSE 'user_' END || x" +
    " FROM c;" +
    "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 300)" +
    " INSERT INTO posts SELECT x, 1 + (x * 7) % 25," +
    " 'post ' || x || ': ' || substr(replace(hex(zeroblob(200)), '0', 'ab ü '), 1, 1 + (x * 13) % 60)," +
    " '2026-01-' || printf('%02d', 1 + x / 12) || 'T09:00:00.000Z' FROM c;" +
    "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 3000)" +
    " INSERT INTO likes SELECT 1 + x / 300, 1 + (x * 37) % 300, '2026-02-01T00:00:00.000Z' FROM c" +
    " WHERE (1 + (x * 37) % 300) % 3 <> 0 AND x / 300 <= (1 + (x * 37) % 300) % 7";
  if (db.exec(rows).isErr()) {
    t.fail("rows", db.error(SQLITE_ERROR).message);
    return t.done();
  }
  const s = new Scratch();
  const sql = bySql(db);
  const cursors = byCursors(t, db, s);
  console.log("SQL:");
  console.log(sql);
  console.log("cursors:");
  console.log(cursors);
  t.eqStr("the cursors' feed is the query's, byte for byte", cursors, sql);
  t.ok("some bodies needed the buffer grown", s.grown > 0);
  t.ok("close", db.close().isOk());
  return t.done();
};
