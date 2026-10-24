// `nish/sqlite` and its C adapter on one in-memory database: a prepared
// insert reused, a column copied into a buffer, a column read as a string,
// and a constraint failure turned into its error. tests/run.js also builds
// this program for `--profile wasi` and runs it under Node's WASI, where the
// lines must be the same.
import { OPEN_CREATE, OPEN_READWRITE, SQLITE_CONSTRAINT, openDatabase } from "nish/sqlite"

export const main = (): i32 => {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open")
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)").expect("create")
  const insert = db.prepare("INSERT INTO t VALUES (?1, ?2)").expect("prepare")
  const names = ["ada", "grace", "edsger"]
  let id: i64 = 0
  for (const name of names) {
    id++
    insert.bindI64(1, id).expect("bind id")
    insert.bindText(2, name).expect("bind name")
    insert.step().expect("insert")
    insert.reset().expect("reset")
  }
  console.log(`inserted ${db.lastInsertRowid()}`)

  const rows = db.prepare("SELECT id, name FROM t ORDER BY id DESC").expect("select")
  const buf = new Array<u8>(16)
  while (rows.step().expect("step")) {
    const n = rows.columnInto(1, buf, 0).expect("into")
    console.log(`${rows.columnI64(0)} ${String.fromBytes(buf, 0, n)} ${rows.columnText(1) ?? "null"}`)
  }

  const again = insert.step()
  if (again.isErr()) {
    const e = insert.error(again.error)
    console.log(`${e.code === SQLITE_CONSTRAINT} ${e.extendedCode} ${e.message}`)
  }
  db.close().expect("close")
  return 0
}
