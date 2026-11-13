// SQLite's busy handler waits in millisecond steps in the default build. One
// file database on two connections: A holds an exclusive lock, B sets
// `busy_timeout = 300` and writes, and must give up with SQLITE_BUSY after
// about 300 ms. The whole-second handler (`!HAVE_NANOSLEEP`, no `HAVE_USLEEP`)
// returns BUSY at once for any timeout under 1,000 ms, so the lower bound on
// the elapsed time tells the two apart; the upper bound is loose for a loaded
// runner. The measured time is not printed.
import { OPEN_CREATE, OPEN_READWRITE, SQLITE_BUSY, openDatabase } from "nish/sqlite";
import { monotonicNanos } from "nish:process";
import { spawnSync } from "nish:process";

const path: string = "build/sqlite_busy_backoff.db";
const clean = (): void => {
  spawnSync(["rm", "-f", path, `${path}-journal`, `${path}-wal`, `${path}-shm`]);
};

export const main = (): i32 => {
  clean();
  const a = openDatabase(path, OPEN_READWRITE | OPEN_CREATE);
  const b = openDatabase(path, OPEN_READWRITE);
  if (a.isErr() || b.isErr()) {
    console.log("open failed");
    return 1;
  }
  if (a.value.exec("CREATE TABLE t (x)").isErr() || a.value.exec("BEGIN EXCLUSIVE").isErr()) {
    console.log("lock failed");
    return 1;
  }
  if (b.value.exec("PRAGMA busy_timeout = 300").isErr()) {
    console.log("busy_timeout failed");
    return 1;
  }
  const start = monotonicNanos();
  const wrote = b.value.exec("INSERT INTO t VALUES (1)");
  const ms = (monotonicNanos() - start) / 1000000;
  const busy = wrote.isErr() && (wrote.error & 255) === SQLITE_BUSY;
  const undone = a.value.exec("ROLLBACK");
  const closedA = a.value.close();
  const closedB = b.value.close();
  clean();
  if (undone.isErr() || closedA.isErr() || closedB.isErr()) {
    console.log("cleanup failed");
    return 1;
  }
  if (!busy) {
    console.log("not busy");
    return 1;
  }
  if (ms < 250) {
    console.log("gave up early: whole-second handler");
    return 1;
  }
  if (ms > 900) {
    console.log("waited too long");
    return 1;
  }
  console.log("busy after a millisecond-step wait");
  return 0;
};
