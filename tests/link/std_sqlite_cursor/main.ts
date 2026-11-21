// `Cursor`, call by call, on a 1000-row table and its index (name, score
// DESC). Every seventh row's blob is 9000 bytes of one letter, so its record spills onto
// overflow pages and is read through the cursor's copy. Each move, seek and
// column read is checked against the value SQL would answer, and each refusal
// against its code: a cursor outside a read transaction, a wrong column list,
// a call the cursor cannot make, and a cursor that a write, a COMMIT,
// `endRead` or `close` closed.
import { Suite } from "nish/testing";
import {
  OPEN_CREATE,
  OPEN_READWRITE,
  SEEK_GE,
  SEEK_GT,
  SEEK_LE,
  SEEK_LT,
  SQLITE_BLOB,
  SQLITE_ERROR,
  SQLITE_FLOAT,
  SQLITE_INTEGER,
  SQLITE_MISMATCH,
  SQLITE_MISUSE,
  SQLITE_NULL,
  SQLITE_RANGE,
  SQLITE_TEXT,
  Cursor,
  Database,
  openDatabase,
} from "nish/sqlite";

/** The cursor's text column `c`, or "" when it cannot be read. */
const text = (cur: Cursor, c: i32, buf: u8[]): string => {
  const n = cur.columnInto(c, buf, 0);
  if (n.isErr() || n.value > buf.length) return "";
  return String.fromBytes(buf, 0, n.value);
};

/** `r` is `Ok(want)`. */
const isOk = (r: Result<boolean, i32>, want: boolean): boolean => r.isOk() && r.value === want;

/** `r` is `Err(code)`. */
const isErr = (r: Result<boolean, i32>, code: i32): boolean => r.isErr() && r.error === code;

/** `r` is `Err(code)`. */
const voidErr = (r: Result<void, i32>, code: i32): boolean => r.isErr() && r.error === code;

/** `r` is `Err(code)`. */
const i32Err = (r: Result<i32, i32>, code: i32): boolean => r.isErr() && r.error === code;

const scan = (t: Suite, db: Database, buf: u8[]): void => {
  const opened = db.openCursor("t", "id,name,score,pad");
  if (opened.isErr()) {
    t.fail("open t", opened.error.message);
    return;
  }
  const c = opened.value;
  let rows = 0;
  let sum = toI64(0);
  let rowidIsId = true;
  let blobBytes = 0;
  let big = 0;
  let r = c.first();
  while (r.isOk() && r.value) {
    rows = rows + 1;
    sum = sum + c.columnI64(0) + c.columnI64(2);
    if (c.columnI64(0) !== c.rowid()) rowidIsId = false;
    const n = c.columnInto(3, buf, 0);
    if (n.isOk()) {
      blobBytes = blobBytes + n.value;
      if (n.value === 9000) big = big + 1;
    }
    r = c.next();
  }
  t.ok("scan: ends with Ok(false)", isOk(r, false));
  t.eqI32("scan: 1000 rows", rows, 1000);
  t.eqI64("scan: ids and scores sum as SQL's", sum, toI64(1000 * 1001 + (1000 * 1001) / 2));
  t.ok("scan: rowid is the INTEGER PRIMARY KEY", rowidIsId);
  t.eqI32("scan: 142 records spill to overflow pages", big, 142);
  t.eqI32("scan: every blob's length", blobBytes, 142 * 9000 + 858 * 10);
  t.ok("next past the end is MISUSE", isErr(c.next(), SQLITE_MISUSE));
  t.ok("a column with no row is MISUSE", i32Err(c.columnType(1), SQLITE_MISUSE));
  t.eqI64("rowid with no row is 0", c.rowid(), toI64(0));

  t.ok("seekRowid 20 finds it", isOk(c.seekRowid(toI64(20)), true));
  t.eqI64("  its score", c.columnI64(2), toI64(10));
  t.eqStr("  its name", text(c, 1, buf), "n0");
  const ty = c.columnType(0);
  t.ok("  the alias column is INTEGER", ty.isOk() && ty.value === SQLITE_INTEGER);
  t.ok("  and columnInto refuses it", i32Err(c.columnInto(0, buf, 0), SQLITE_MISMATCH));
  t.ok("  an INTEGER column is MISMATCH", i32Err(c.columnInto(2, buf, 0), SQLITE_MISMATCH));
  const tt = c.columnType(1);
  t.ok("  name is TEXT", tt.isOk() && tt.value === SQLITE_TEXT);
  const tb = c.columnType(3);
  t.ok("  pad is BLOB", tb.isOk() && tb.value === SQLITE_BLOB);
  t.ok("  column 4 is RANGE", i32Err(c.columnType(4), SQLITE_RANGE));
  t.ok("  column -1 is RANGE", i32Err(c.columnType(-1), SQLITE_RANGE));
  t.ok("  at past the buffer is MISUSE", i32Err(c.columnInto(1, buf, buf.length + 1), SQLITE_MISUSE));
  const small: u8[] = [7];
  const fit = c.columnInto(1, small, 0);
  t.ok("  a buffer too small answers the length", fit.isOk() && fit.value === 2);
  t.eqI32("  and writes nothing", toI32(small[0]), 7);
  t.ok("seekRowid 21 is not there", isOk(c.seekRowid(toI64(21)), false));
  t.ok("  and leaves no row", i32Err(c.columnType(1), SQLITE_MISUSE));
  t.ok("seekRowid 14 (an overflow row)", isOk(c.seekRowid(toI64(14)), true));
  const wide = new Array<u8>(9002);
  const over = c.columnInto(3, wide, 1);
  t.ok("  reads its 9000 bytes", over.isOk() && over.value === 9000);
  let allH = true;
  for (let i = 1; i <= 9000; i++) {
    if (wide[i] !== 72) allH = false;
  }
  t.ok("  each one the row's letter, at the offset asked", allH && wide[0] === 0 && wide[9001] === 0);
  wide[9001] = 5;
  const short = c.columnInto(3, wide, 3);
  t.ok("  one byte short answers the length", short.isOk() && short.value === 9000);
  t.eqI32("  and writes nothing", toI32(wide[9001]), 5);
  t.ok("last", isOk(c.last(), true));
  t.eqI64("  is rowid 2000", c.rowid(), toI64(2000));
  t.ok("previous", isOk(c.previous(), true));
  t.eqI64("  is rowid 1998", c.rowid(), toI64(1998));
  t.ok("a table cursor has no key", voidErr(c.keyI64(toI64(1)), SQLITE_MISUSE));
  t.ok("  nor keyReset", voidErr(c.keyReset(), SQLITE_MISUSE));
  t.ok("  nor seek", isErr(c.seek(SEEK_GE), SQLITE_MISUSE));
  t.ok("close", c.close().isOk());
  t.ok("close again is MISUSE", voidErr(c.close(), SQLITE_MISUSE));
  t.ok("a closed cursor's first is MISUSE", isErr(c.first(), SQLITE_MISUSE));
  t.eqStr("error() names the code", c.error(SQLITE_MISUSE).message, "bad parameter or other API misuse");
};

const seeks = (t: Suite, db: Database, buf: u8[]): void => {
  const opened = db.openCursor("t_name", "name,score DESC,rowid");
  if (opened.isErr()) {
    t.fail("open t_name", opened.error.message);
    return;
  }
  const ix = opened.value;
  t.ok("index: seekRowid is MISUSE", isErr(ix.seekRowid(toI64(1)), SQLITE_MISUSE));
  t.ok("index: seek with no key is MISUSE", isErr(ix.seek(SEEK_GE), SQLITE_MISUSE));
  t.ok("key n3", ix.keyText("n3").isOk());
  t.ok("  seek op 0 is MISUSE", isErr(ix.seek(0), SQLITE_MISUSE));
  t.ok("  seek op 5 is MISUSE", isErr(ix.seek(5), SQLITE_MISUSE));
  t.ok("  GE", isOk(ix.seek(SEEK_GE), true));
  t.eqStr("  lands on n3", text(ix, 0, buf), "n3");
  t.eqI64("  with the highest score first", ix.columnI64(1), toI64(993));
  t.eqI64("  and its rowid", ix.rowid(), toI64(1986));
  t.eqI64("  column 2 is the rowid too", ix.columnI64(2), toI64(1986));
  t.ok("  LE", isOk(ix.seek(SEEK_LE), true));
  t.eqI64("  lands on n3's last entry", ix.columnI64(1), toI64(3));
  t.ok("  GT", isOk(ix.seek(SEEK_GT), true));
  t.eqStr("  lands on n4", text(ix, 0, buf), "n4");
  t.eqI64("  at its first entry", ix.columnI64(1), toI64(994));
  t.ok("  LT", isOk(ix.seek(SEEK_LT), true));
  t.eqStr("  lands on n2", text(ix, 0, buf), "n2");
  t.eqI64("  at its last entry", ix.columnI64(1), toI64(2));
  t.ok("key n3, 503", ix.keyI64(toI64(503)).isOk());
  t.ok("  GE", isOk(ix.seek(SEEK_GE), true));
  t.eqI64("  counts the equal entry", ix.columnI64(1), toI64(503));
  t.ok("  GT", isOk(ix.seek(SEEK_GT), true));
  t.eqI64("  steps past it, down the DESC column", ix.columnI64(1), toI64(493));
  t.ok("  LT", isOk(ix.seek(SEEK_LT), true));
  t.eqI64("  steps before it", ix.columnI64(1), toI64(513));
  t.ok("  LE", isOk(ix.seek(SEEK_LE), true));
  t.eqI64("  counts the equal entry", ix.columnI64(1), toI64(503));
  t.ok("  next", isOk(ix.next(), true));
  t.eqI64("  is the next lower score", ix.columnI64(1), toI64(493));
  t.ok("a third key value is RANGE", voidErr(ix.keyI64(toI64(1)), SQLITE_RANGE));
  t.ok("keyReset", ix.keyReset().isOk());
  const zz: u8[] = [0x78, 0x7a, 0x7a, 0x78];
  t.ok("keyTextBytes outside the buffer is MISUSE", voidErr(ix.keyTextBytes(zz, 2, 3), SQLITE_MISUSE));
  t.ok("keyTextBytes zz", ix.keyTextBytes(zz, 1, 2).isOk());
  t.ok("  GE past the last is Ok(false)", isOk(ix.seek(SEEK_GE), false));
  t.ok("  LT is the last entry", isOk(ix.seek(SEEK_LT), true));
  t.eqStr("  n9", text(ix, 0, buf), "n9");
  t.eqI64("  its lowest score", ix.columnI64(1), toI64(9));
  t.ok("  next is Ok(false)", isOk(ix.next(), false));
  t.ok(
    "keyReset and key a",
    ix.keyReset().isOk() && ix.keyText("a").isOk()
  );
  t.ok("  LT before the first is Ok(false)", isOk(ix.seek(SEEK_LT), false));
  t.ok("  GE is the first entry", isOk(ix.seek(SEEK_GE), true));
  t.eqStr("  n0", text(ix, 0, buf), "n0");
  t.ok("  previous is Ok(false)", isOk(ix.previous(), false));
  t.ok("first", isOk(ix.first(), true));
  t.eqI64("  is n0's highest score", ix.columnI64(1), toI64(1000));
};

const invalidation = (t: Suite, db: Database): void => {
  const c = db.openCursor("t", "id,name,score,pad").expect("open t");
  const ix = db.openCursor("t_name", "name,score DESC,rowid").expect("open t_name");
  t.ok("first", isOk(c.first(), true) && isOk(ix.first(), true));
  const count = db.prepare("SELECT count(*) FROM t").expect("prepare");
  t.ok("a SELECT", isOk(count.step(), true));
  t.ok("  leaves the cursor", isOk(c.next(), true));
  t.ok("finalize", count.finalize().isOk());
  t.ok("an INSERT", db.exec("INSERT INTO t (name) VALUES ('x')").isOk());
  t.ok("  closes the table cursor", isErr(c.first(), SQLITE_MISUSE));
  t.ok("  and the index cursor", isErr(ix.first(), SQLITE_MISUSE));
  t.ok("  whose close is MISUSE", voidErr(c.close(), SQLITE_MISUSE));
  const d = db.openCursor("t", "id,name,score,pad").expect("open again");
  t.ok("COMMIT", db.exec("COMMIT").isOk());
  t.ok("  closes the cursor", isErr(d.first(), SQLITE_MISUSE));
  t.ok("endRead outside a transaction is MISUSE", voidErr(db.endRead(), SQLITE_MISUSE));
  const outside = db.openCursor("t", "id,name,score,pad");
  t.ok("openCursor outside one is MISUSE", outside.isErr() && outside.error.code === SQLITE_MISUSE);
  t.ok("beginRead", db.beginRead().isOk());
  t.ok("beginRead again is MISUSE", voidErr(db.beginRead(), SQLITE_MISUSE));
  const e = db.openCursor("t", "id,name,score,pad").expect("open in a new read");
  t.ok("  sees the committed row", isOk(e.last(), true));
  t.eqI64("  rowid 2001", e.rowid(), toI64(2001));
  const ty = e.columnType(2);
  t.ok("  its NULL score", ty.isOk() && ty.value === SQLITE_NULL);
  t.eqI64("  reads as 0", e.columnI64(2), toI64(0));
  const one: u8[] = [0];
  const pad = e.columnInto(3, one, 0);
  t.ok("  a NULL blob is 0 bytes", pad.isOk() && pad.value === 0);
  t.ok("endRead", db.endRead().isOk());
  t.ok("  closes the cursor", isErr(e.first(), SQLITE_MISUSE));
};

export const main = (): i32 => {
  const t = new Suite("std_sqlite_cursor");
  const opened = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE);
  if (opened.isErr()) {
    t.fail("open", opened.error.message);
    return t.done();
  }
  const db = opened.value;
  const schema =
    "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, score INT, pad BLOB);" +
    "CREATE INDEX t_name ON t (name, score DESC);" +
    "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 1000)" +
    " INSERT INTO t SELECT x * 2, 'n' || (x % 10), x," +
    " CAST(replace(hex(zeroblob(CASE WHEN x % 7 = 0 THEN 9000 ELSE 10 END)), '00'," +
    " char(65 + x % 26)) AS BLOB) FROM c;" +
    "CREATE TABLE f (v REAL)"
  if (db.exec(schema).isErr()) {
    t.fail("exec", db.error(SQLITE_ERROR).message);
    return t.done();
  }
  const early = db.openCursor("t", "id,name,score,pad");
  t.ok("openCursor before beginRead is MISUSE", early.isErr() && early.error.code === SQLITE_MISUSE);
  t.ok("beginRead", db.beginRead().isOk());
  const wrong = db.openCursor("t", "id,name,score");
  t.ok("a column list short of the table's is SCHEMA", wrong.isErr() && wrong.error.code === 17);
  if (wrong.isErr()) {
    t.eqStr(
      "  and says why",
      wrong.error.message,
      'no table or index t with columns "id,name,score" that a cursor reads'
    );
  }
  const nope = db.openCursor("nope", "id");
  t.ok("a missing table is SCHEMA", nope.isErr() && nope.error.code === 17);
  const spaced = db.openCursor("t", "id, name, score, pad");
  t.ok("the list has no spaces", spaced.isErr() && spaced.error.code === 17);
  const asc = db.openCursor("t_name", "name,score,rowid");
  t.ok("an index list without its DESC is SCHEMA", asc.isErr() && asc.error.code === 17);
  const buf = new Array<u8>(16);
  scan(t, db, buf);
  seeks(t, db, buf);
  const f = db.openCursor("f", "v").expect("open f");
  t.ok("an empty table's first is Ok(false)", isOk(f.first(), false));
  t.ok("  and last", isOk(f.last(), false));
  t.ok("  previous with no row is MISUSE", isErr(f.previous(), SQLITE_MISUSE));
  t.ok("close f", f.close().isOk());
  invalidation(t, db);
  t.ok("a REAL row", db.exec("INSERT INTO f VALUES (1.5), (2.0)").isOk());
  t.ok("beginRead", db.beginRead().isOk());
  const g = db.openCursor("f", "v").expect("open f again");
  t.ok("first", isOk(g.first(), true));
  const ft = g.columnType(0);
  t.ok("  1.5 is FLOAT", ft.isOk() && ft.value === SQLITE_FLOAT);
  t.ok("  and columnInto is MISMATCH", i32Err(g.columnInto(0, buf, 0), SQLITE_MISMATCH));
  t.eqI64("  columnI64 truncates", g.columnI64(0), toI64(1));
  t.ok("next", isOk(g.next(), true));
  const it = g.columnType(0);
  t.ok("  2.0 is stored as an INTEGER", it.isOk() && it.value === SQLITE_INTEGER);
  const left = db.openCursor("t", "id,name,score,pad").expect("open t");
  t.ok("close the connection", db.close().isOk());
  t.ok("  closes its cursors", isErr(left.first(), SQLITE_MISUSE) && isErr(g.next(), SQLITE_MISUSE));
  return t.done();
};
