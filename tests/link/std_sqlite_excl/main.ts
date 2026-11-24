// SQLite's unix-excl VFS, reached through the route openDatabase already has:
// OPEN_URI and `?vfs=unix-excl` in a `file:` name (docs/sqlite-vfs.md).
// Under it a WAL database keeps its wal-index in heap, so no `-shm` file is
// made, and the connection holds one file lock until it closes, so a second
// process that opens the file is refused with SQLITE_BUSY. The parent runs
// this program again as that second process; the child's answer is its exit
// status (0 refused with BUSY as expected, otherwise the step that differed),
// never its output. The default `unix` VFS on the same file is the control:
// it makes `-shm`, and a second process reads it.
import { OPEN_CREATE, OPEN_READWRITE, OPEN_URI, SQLITE_BUSY, openDatabase } from "nish/sqlite";
import { readFileBytesSync } from "nish:fs";
import { platform, spawnSync } from "nish:process";

const PATH: string = "build/test/std_sqlite_excl.db";
const EXCL: string = "file:build/test/std_sqlite_excl.db?vfs=unix-excl";

/** This program's path, for running it again. */
const selfPath = (): string => {
  const exe: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null;
  return exe !== null ? exe : process.argv[0];
};

const remove = (): void => {
  spawnSync(["rm", "-f", PATH, `${PATH}-wal`, `${PATH}-shm`, `${PATH}-journal`]);
};

const exists = (path: string): boolean => readFileBytesSync(path) !== null;

/** The second process: open the file on the default VFS and read it. 0 when the read answers `want`. */
const child = (want: i32): i32 => {
  const opened = openDatabase(PATH, OPEN_READWRITE);
  if (opened.isErr()) {
    return 10;
  }
  const db = opened.value;
  const read = db.exec("SELECT count(*) FROM t");
  const got: i32 = read.isOk() ? 0 : read.error & 0xff;
  if (db.close().isErr()) {
    return 12;
  }
  return got === want ? 0 : 11;
};

export const main = (): i32 => {
  if (process.argv.length > 2 && process.argv[1] === "child") {
    return child(process.argv[2] === "busy" ? SQLITE_BUSY : 0);
  }
  for (const route of ["unix", "unix-excl"]) {
    remove();
    const name = route === "unix" ? PATH : EXCL;
    const flags = route === "unix" ? OPEN_READWRITE | OPEN_CREATE : OPEN_READWRITE | OPEN_CREATE | OPEN_URI;
    const opened = openDatabase(name, flags);
    if (opened.isErr()) {
      console.log(`${route}: open failed: ${opened.error.message}`);
      return 1;
    }
    const db = opened.value;
    console.log(`${route}: wal ${db.exec("PRAGMA journal_mode=WAL").isOk()}`);
    console.log(`${route}: write ${db.exec("CREATE TABLE t (x); INSERT INTO t VALUES (1)").isOk()}`);
    console.log(`${route}: -wal ${exists(`${PATH}-wal`)}`);
    console.log(`${route}: -shm ${exists(`${PATH}-shm`)}`);
    const status = spawnSync([selfPath(), "child", route === "unix" ? "ok" : "busy"]);
    console.log(`${route}: second process ${route === "unix" ? "reads" : "is refused with BUSY"} ${status === 0}`);
    console.log(`${route}: close ${db.close().isOk()}`);
  }
  remove();
  return 0;
};
