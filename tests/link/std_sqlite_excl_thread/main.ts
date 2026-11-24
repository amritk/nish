// Refused: a nish:threads task cannot be a unix-excl checkpointer
// (docs/sqlite-vfs.md). Every nish/sqlite call reaches C, and the compiler
// counts a C call as a write the task's caller can see, so `spawn` refuses a
// task that opens a connection, whatever VFS it names. A checkpointer for a
// unix-excl database is therefore a second connection on the thread that
// holds the first (tests/link/std_sqlite_excl_second), or that connection's
// own automatic checkpoint.
import { OPEN_READWRITE, OPEN_URI, openDatabase } from "nish/sqlite";
import { scope } from "nish/threads";

const checkpointer = (n: i32): i32 => {
  const opened = openDatabase("file:build/test/std_sqlite_excl_thread.db?vfs=unix-excl", OPEN_READWRITE | OPEN_URI);
  if (opened.isErr()) {
    return n;
  }
  const done = opened.value.exec("PRAGMA wal_checkpoint(TRUNCATE)").isOk();
  return opened.value.close().isOk() && done ? 0 : n;
};

export const main = (): i32 => {
  const out: i32[] = [-1];
  {
    using s = scope();
    s.spawn(checkpointer, 1, out, 0);
  }
  return out[0];
};
