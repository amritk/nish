// `columnInto` with no row: before the first step and after the step that
// answers DONE, a column the statement has reads as empty (`Ok(0)`), and one
// it does not have, past the end or negative, is RANGE, as it is with a row.
// None of it touches the connection's message (the step to DONE sets that
// one, so each read is checked against the message just before it).
import { Suite } from "nish/testing";
import {
  OPEN_CREATE,
  OPEN_READWRITE,
  SQLITE_ERROR,
  SQLITE_RANGE,
  Database,
  Statement,
  openDatabase,
} from "nish/sqlite";

const noRow = (t: Suite, when: string, db: Database, q: Statement, buf: u8[]): void => {
  const before = db.error(SQLITE_ERROR).message;
  const inRange = q.columnInto(1, buf, 0);
  t.ok(`${when}: an in-range column answers 0`, inRange.isOk() && inRange.value === 0);
  const past = q.columnInto(2, buf, 0);
  t.ok(`${when}: one past the last column is RANGE`, past.isErr() && past.error === SQLITE_RANGE);
  const far = q.columnInto(99, buf, 0);
  t.ok(`${when}: column 99 is RANGE`, far.isErr() && far.error === SQLITE_RANGE);
  const negative = q.columnInto(-1, buf, 0);
  t.ok(`${when}: column -1 is RANGE`, negative.isErr() && negative.error === SQLITE_RANGE);
  t.eqI32(`${when}: and writes nothing`, toI32(buf[0]), 7);
  t.eqStr(`${when}: the connection's message is unchanged`, db.error(SQLITE_ERROR).message, before);
};

export function main(): i32 {
  const t = new Suite("std_sqlite_norow");
  const opened = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE);
  if (opened.isErr()) {
    t.fail("open", opened.error.message);
    return t.done();
  }
  const db = opened.value;
  if (db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO t VALUES (1, 'ada')").isErr()) {
    t.fail("exec", db.error(SQLITE_ERROR).message);
    return t.done();
  }
  const p = db.prepare("SELECT id, name FROM t WHERE id = ?");
  if (p.isErr()) {
    t.fail("prepare", p.error.message);
    return t.done();
  }
  const q = p.value;
  const buf: u8[] = [7, 7, 7, 7, 7, 7, 7, 7];
  noRow(t, "before the first step", db, q, buf);
  t.ok("bind", q.bindI64(1, toI64(2)).isOk());
  const step = q.step();
  t.ok("step: no row is DONE", step.isOk() && !step.value);
  noRow(t, "after DONE", db, q, buf);
  t.ok("finalize", q.finalize().isOk());
  t.ok("close", db.close().isOk());
  return t.done();
}
