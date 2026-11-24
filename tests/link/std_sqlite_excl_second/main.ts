// The checkpointer a unix-excl database can have (docs/sqlite-vfs.md). Under
// unix-excl no second process may open the file, but unix-excl takes its one
// file lock for the process, not for the connection, so a second connection
// in the same process shares the in-heap wal-index. Here one connection
// writes and stays open; a second, on the same `file:` URI, reads the rows,
// runs `PRAGMA wal_checkpoint(TRUNCATE)` and closes. Its answer is a number,
// 0 when every step did what this comment says, else the step that did not.
// The first connection then writes again over the emptied log. Both are on
// the main thread: a nish:threads task cannot hold a connection at all
// (tests/link/std_sqlite_excl_thread).
import { OPEN_CREATE, OPEN_READWRITE, OPEN_URI, openDatabase } from "nish/sqlite";
import { readFileBytesSync } from "nish:fs";
import { spawnSync } from "nish:process";

const PATH: string = "build/test/std_sqlite_excl_second.db";
const EXCL: string = "file:build/test/std_sqlite_excl_second.db?vfs=unix-excl";

const remove = (): void => {
  spawnSync(["rm", "-f", PATH, `${PATH}-wal`, `${PATH}-shm`, `${PATH}-journal`]);
};

/** The checkpointer: a second connection reads `rows` rows, then checkpoints the log away. */
const checkpointer = (rows: i32): i32 => {
  const opened = openDatabase(EXCL, OPEN_READWRITE | OPEN_URI);
  if (opened.isErr()) {
    return 10;
  }
  const db = opened.value;
  let answer: i32 = 0;
  const count = db.prepare("SELECT count(*) FROM t");
  if (count.isErr()) {
    answer = 11;
  } else {
    const row = count.value.step();
    if (row.isErr() || !row.value || count.value.columnI64(0) !== toI64(rows)) {
      answer = 12;
    }
    if (count.value.finalize().isErr()) {
      answer = 13;
    }
  }
  if (answer === 0) {
    const checkpoint = db.prepare("PRAGMA wal_checkpoint(TRUNCATE)");
    if (checkpoint.isErr()) {
      answer = 14;
    } else {
      // The first column is 1 when the checkpoint could not finish for a lock.
      const row = checkpoint.value.step();
      if (row.isErr() || !row.value || checkpoint.value.columnI64(0) !== toI64(0)) {
        answer = 15;
      }
      if (checkpoint.value.finalize().isErr()) {
        answer = 16;
      }
    }
  }
  if (db.close().isErr()) {
    return 17;
  }
  return answer;
};

const walBytes = (): i32 => {
  const wal = readFileBytesSync(`${PATH}-wal`);
  return wal === null ? -1 : toI32(wal.length);
};

export const main = (): i32 => {
  remove();
  const opened = openDatabase(EXCL, OPEN_READWRITE | OPEN_CREATE | OPEN_URI);
  if (opened.isErr()) {
    console.log(`open failed: ${opened.error.message}`);
    return 1;
  }
  const db = opened.value;
  console.log(`wal ${db.exec("PRAGMA journal_mode=WAL").isOk()}`);
  console.log(`write ${db.exec("CREATE TABLE t (x); INSERT INTO t VALUES (1), (2), (3)").isOk()}`);
  console.log(`the log holds frames ${walBytes() > 0}`);
  console.log(`a second connection read and checkpointed: ${checkpointer(3)}`);
  console.log(`the log is truncated ${walBytes() === 0}`);
  console.log(`no -shm ${readFileBytesSync(`${PATH}-shm`) === null}`);
  console.log(`write again ${db.exec("INSERT INTO t VALUES (4)").isOk()}`);
  console.log(`close ${db.close().isOk()}`);
  remove();
  return 0;
};
