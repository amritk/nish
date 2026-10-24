// SQL holding a NUL byte panics before it reaches the C adapter: C would read
// the NUL as the end of the statement and run only "a".
import { OPEN_CREATE, OPEN_READWRITE, openDatabase } from "nish/sqlite";

export function main(): i32 {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE)
  if (!db.ok) return 2
  const sql = "a" + String.fromCharCode(0) + "b"
  return db.value.exec(sql).isOk() ? 3 : 4
}
