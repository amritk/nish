// What `?vfs=unix-excl` reaches on each build (docs/sqlite-vfs.md). Natively
// it is SQLite's unix-excl VFS, and a file database on it takes WAL and a
// write. The `--profile wasi` build registers the same VFS name, so the open
// succeeds, but wasi-libc has no POSIX record locks: the first statement that
// locks the file answers SQLITE_IOERR_LOCK (3850). tests/run.js builds this
// program for wasi too and holds that run to expected.wasi.out. A name no
// build registers is refused at the open on both.
import { OPEN_CREATE, OPEN_READWRITE, OPEN_URI, openDatabase } from "nish/sqlite";
import { spawnSync } from "nish:process";

const PATH: string = "build/test/std_sqlite_vfs_wasi.db";

const report = (route: string, name: string): void => {
  const opened = openDatabase(name, OPEN_READWRITE | OPEN_CREATE | OPEN_URI);
  if (opened.isErr()) {
    console.log(`${route}: open refused, ${opened.error.extendedCode}: ${opened.error.message}`);
    return;
  }
  const db = opened.value;
  const wal = db.exec("PRAGMA journal_mode=WAL");
  console.log(`${route}: journal_mode=WAL answers ${wal.isOk() ? 0 : wal.error}`);
  const write = db.exec("CREATE TABLE t (x); INSERT INTO t VALUES (1)");
  console.log(`${route}: a write answers ${write.isOk() ? 0 : write.error}`);
  console.log(`${route}: close ${db.close().isOk()}`);
};

export const main = (): i32 => {
  spawnSync(["rm", "-f", PATH, `${PATH}-wal`, `${PATH}-shm`]);
  report("unix-excl", "file:build/test/std_sqlite_vfs_wasi.db?vfs=unix-excl");
  report("no such vfs", "file:build/test/std_sqlite_vfs_wasi.db?vfs=nish-none");
  spawnSync(["rm", "-f", PATH, `${PATH}-wal`, `${PATH}-shm`]);
  return 0;
};
