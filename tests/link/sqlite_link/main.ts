// The vendored SQLite links into a program whose IR calls it: scripts/build.sh
// reads `declare ... @sqlite3_` in a module and compiles runtime/sqlite/ beside
// the runtime, so the C functions `version.ts` calls need no library on the
// system. The numbers are runtime/sqlite/sqlite3.h's. `sqlite3_threadsafe`
// answers the SQLITE_THREADSAFE it was compiled with: 0, since the program has
// one thread (sqlite_link_threads is the same program under --threads).
import { version } from "./version.ts";

export const main = (): i32 => {
  console.log(version());
  return 0;
};
