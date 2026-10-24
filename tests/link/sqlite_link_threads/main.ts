// sqlite_link under --threads: scripts/build.sh compiles runtime/sqlite/ with
// SQLITE_THREADSAFE=2, so SQLite serialises each connection on its own mutex
// rather than taking none, and `sqlite3_threadsafe` answers 2.
import { version } from "./version.ts";

export const main = (): i32 => {
  console.log(version());
  return 0;
};
