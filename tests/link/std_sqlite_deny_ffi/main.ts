// `--deny ffi` refuses a program that opens a database: std/sqlite.ts calls
// its C adapter, and the error names the chain from main through the module.
import { OPEN_CREATE, OPEN_READWRITE, openDatabase } from "nish/sqlite";

export function main(): i32 {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE)
  if (!db.ok) return 1
  return db.value.close().ok ? 0 : 2
}
