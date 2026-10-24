// `nish/sqlite` reaches `ffi`, and the report says so with the chain: main opens a
// database, and std/sqlite.ts calls its C adapter. The `nish` package lists every
// export of the module, so the report pins the module's whole surface.
import { OPEN_CREATE, OPEN_READWRITE, openDatabase } from "nish/sqlite";

export function main(): i32 {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE)
  if (!db.ok) return 1
  return db.value.close().ok ? 0 : 2
}
