/**
 * `std/sqlite` — SQLite, the database in a file, from a Nish program.
 *
 *     import { openDatabase, OPEN_READWRITE, OPEN_CREATE } from "nish/sqlite"
 *
 *     const db = openDatabase("app.db", OPEN_READWRITE | OPEN_CREATE).expect("open")
 *     db.exec("CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY, name TEXT)").expect("create")
 *     const insert = db.prepare("INSERT INTO t (name) VALUES (?1)").expect("prepare")
 *     insert.bindText(1, "ada").expect("bind")
 *     insert.step().expect("insert")
 *     insert.reset().expect("reset")
 *
 * It is the SQLite C library, vendored in `runtime/sqlite/` and linked into a
 * program that imports this module (`scripts/build.sh`), with one small C
 * adapter beside it (`runtime/sqlite/nish-sqlite.c`). A connection and a
 * prepared statement are handles into the adapter's tables, so a `Database`
 * and a `Statement` are an `i32` each, and a handle used after `close` or
 * `finalize` answers `MISUSE` instead of reaching freed memory.
 *
 * **The loop allocates nothing.** Every call a row makes — bind, `step`,
 * `reset`, `columnI64`, `columnF64`, `columnInto` — answers a `Result` of two
 * scalars, which travels as one machine word, and copies nothing but what it
 * is asked for: `columnInto` copies a text or blob column into the caller's
 * `u8[]` with one `memcpy`. `columnText` is the convenience that allocates a
 * string. Building a `SqliteError` allocates, which is why the hot calls answer
 * the bare result code and `error(code)` builds the message only for the
 * caller who wants it.
 *
 * **Results are SQLite's own codes**, extended (`SQLITE_CONSTRAINT_UNIQUE`
 * rather than `SQLITE_CONSTRAINT`), so a program can compare them with the
 * constants below or with SQLite's documentation. `SqliteError.code` is the
 * primary code, the low byte.
 *
 * **Closing is explicit.** `close` finalizes every statement the connection
 * still has, so a statement never outlives its database; `finalize` frees one
 * statement early. A connection and its statements belong to the thread that
 * opened them (the handle tables are thread-local under `--threads`).
 *
 * Calling C is the `ffi` capability (docs/LANGUAGE.md, "Capabilities"), so a
 * program that imports this module is reported with `ffi`, and `--deny ffi`
 * refuses it. The files SQLite opens are opened by C, beneath the `fs`
 * capability's view.
 */

// biome-ignore-all lint/style/useNamingConvention: the declarations name C symbols
// The adapters are `nishsqlite_`, not `nish_sqlite_`: `nish_` names are the
// runtime's (NL2202). scripts/build.sh links SQLite for a module that declares
// an `sqlite3_` function: `sqlite3_errstr` and `sqlite3_libversion` below.
declare function nishsqlite_open(path: string, flags: i32): i32
declare function nishsqlite_open_errmsg(): string
declare function nishsqlite_close(h: i32): i32
declare function nishsqlite_exec(h: i32, sql: string): i32
declare function nishsqlite_errmsg(h: i32): string
declare function nishsqlite_last_insert_rowid(h: i32): i64
declare function nishsqlite_changes(h: i32): i64
declare function nishsqlite_prepare(h: i32, sql: string): i32
declare function nishsqlite_stmt_errmsg(h: i32): string
declare function nishsqlite_finalize(h: i32): i32
declare function nishsqlite_step(h: i32): i32
declare function nishsqlite_reset(h: i32): i32
declare function nishsqlite_clear_bindings(h: i32): i32
declare function nishsqlite_bind_i64(h: i32, i: i32, v: i64): i32
declare function nishsqlite_bind_f64(h: i32, i: i32, v: f64): i32
declare function nishsqlite_bind_null(h: i32, i: i32): i32
declare function nishsqlite_bind_text(h: i32, i: i32, text: string): i32
declare function nishsqlite_bind_bytes(
  h: i32,
  i: i32,
  buf: readonly u8[],
  n: u64,
  off: i32,
  len: i32,
  blob: i32
): i32
declare function nishsqlite_column_count(h: i32): i32
declare function nishsqlite_column_type(h: i32, c: i32): i32
declare function nishsqlite_column_i64(h: i32, c: i32): i64
declare function nishsqlite_column_f64(h: i32, c: i32): f64
declare function nishsqlite_column_bytes(h: i32, c: i32): i32
declare function nishsqlite_column_text(h: i32, c: i32): string | null
declare function nishsqlite_column_into(h: i32, c: i32, buf: u8[], n: u64, at: i32): i32
declare function sqlite3_errstr(code: i32): string
declare function sqlite3_libversion(): string

/** Success. */
export const SQLITE_OK: i32 = 0
/** A generic failure; `error(code).message` says which. */
export const SQLITE_ERROR: i32 = 1
/** An internal fault in SQLite. */
export const SQLITE_INTERNAL: i32 = 2
/** The access mode the database was opened with does not allow the write. */
export const SQLITE_PERM: i32 = 3
/** The operation was interrupted. */
export const SQLITE_ABORT: i32 = 4
/** Another connection holds the lock the operation needs. */
export const SQLITE_BUSY: i32 = 5
/** A table is locked by this connection's own work. */
export const SQLITE_LOCKED: i32 = 6
/** SQLite could not allocate. */
export const SQLITE_NOMEM: i32 = 7
/** The database is read-only. */
export const SQLITE_READONLY: i32 = 8
/** The operating system failed a read or a write. */
export const SQLITE_IOERR: i32 = 10
/** The database file is malformed. */
export const SQLITE_CORRUPT: i32 = 11
/** The disk is full. */
export const SQLITE_FULL: i32 = 13
/** The file could not be opened. */
export const SQLITE_CANTOPEN: i32 = 14
/** The schema changed; prepare the statement again. */
export const SQLITE_SCHEMA: i32 = 17
/** A string or blob is larger than SQLite's limit. */
export const SQLITE_TOOBIG: i32 = 18
/** A constraint (UNIQUE, NOT NULL, CHECK, a foreign key) failed. */
export const SQLITE_CONSTRAINT: i32 = 19
/** A value of the wrong type for a STRICT column. */
export const SQLITE_MISMATCH: i32 = 20
/** A call out of order, or a handle that names nothing. */
export const SQLITE_MISUSE: i32 = 21
/** A parameter or column index that is not there. */
export const SQLITE_RANGE: i32 = 25
/** The file is not a database. */
export const SQLITE_NOTADB: i32 = 26
/** `step` has a row. */
export const SQLITE_ROW: i32 = 100
/** `step` has finished. */
export const SQLITE_DONE: i32 = 101

/** `columnType` of an integer. */
export const SQLITE_INTEGER: i32 = 1
/** `columnType` of a floating-point value. */
export const SQLITE_FLOAT: i32 = 2
/** `columnType` of text. */
export const SQLITE_TEXT: i32 = 3
/** `columnType` of a blob. */
export const SQLITE_BLOB: i32 = 4
/** `columnType` of SQL NULL. */
export const SQLITE_NULL: i32 = 5

/** Open for reading only. One of the three modes `openDatabase` needs. */
export const OPEN_READONLY: i32 = 0x1
/** Open for reading and writing; the file must exist unless `OPEN_CREATE` is given too. */
export const OPEN_READWRITE: i32 = 0x2
/** With `OPEN_READWRITE`, create the file when it is not there. */
export const OPEN_CREATE: i32 = 0x4
/** Read the path as a `file:` URI. */
export const OPEN_URI: i32 = 0x40
/** An in-memory database, the path only naming it. */
export const OPEN_MEMORY: i32 = 0x80
/** Refuse a path whose last component is a symbolic link. */
export const OPEN_NOFOLLOW: i32 = 0x01000000

/** The SQLite version linked in, such as `3.50.4`. */
export const sqliteVersion = (): string => sqlite3_libversion()

/** A failure, with SQLite's message for it. Built only when asked for, by `error(code)`. */
export class SqliteError {
  /** The primary result code, such as `SQLITE_CONSTRAINT`. */
  code: i32
  /** The extended code, such as `SQLITE_CONSTRAINT_UNIQUE` (2067). */
  extendedCode: i32
  /** SQLite's message, such as `UNIQUE constraint failed: t.id`. */
  message: string

  constructor(extendedCode: i32, message: string) {
    this.code = extendedCode & 0xff
    this.extendedCode = extendedCode
    this.message = message
  }
}

/** `Ok()` for `SQLITE_OK`, the code otherwise. */
const done = (rc: i32): Result<void, i32> => {
  if (rc !== SQLITE_OK) {
    return Err(rc)
  }
  return Ok()
}

/**
 * The message for `code`: the connection's own, unless the code is one the
 * adapter answers before SQLite runs (`MISUSE`, `RANGE`), where the
 * connection's message is still that of some earlier failure.
 */
const messageFor = (code: i32, connection: string): string => {
  const primary: i32 = code & 0xff
  if (primary === SQLITE_MISUSE || primary === SQLITE_RANGE) {
    return sqlite3_errstr(code)
  }
  return connection
}

/**
 * Opens the database at `path`. `flags` holds one of `OPEN_READONLY`,
 * `OPEN_READWRITE` or `OPEN_READWRITE | OPEN_CREATE`, with any of `OPEN_URI`,
 * `OPEN_MEMORY` and `OPEN_NOFOLLOW`; anything else is `SQLITE_MISUSE`. The
 * path `:memory:` is a database of its own that lives as long as the
 * connection.
 */
export const openDatabase = (path: string, flags: i32): Result<Database, SqliteError> => {
  const h: i32 = nishsqlite_open(path, flags)
  if (h < 0) {
    return Err(new SqliteError(-h, nishsqlite_open_errmsg()))
  }
  return Ok(new Database(h))
}

/** A connection. Close it with `close`, which finalizes its statements too. */
export class Database {
  /** The adapter's handle; 0 names nothing. */
  handle: i32

  constructor(handle: i32) {
    this.handle = handle
  }

  /** Runs every statement of `sql` in turn, discarding any rows. */
  exec(sql: string): Result<void, i32> {
    return done(nishsqlite_exec(this.handle, sql))
  }

  /** `exec("BEGIN")`. */
  begin(): Result<void, i32> {
    return this.exec("BEGIN")
  }

  /** `exec("COMMIT")`. */
  commit(): Result<void, i32> {
    return this.exec("COMMIT")
  }

  /** `exec("ROLLBACK")`. */
  rollback(): Result<void, i32> {
    return this.exec("ROLLBACK")
  }

  /**
   * Compiles the first statement of `sql`, to be bound, stepped and reset as
   * often as wanted; text after it is ignored. Text with no statement in it is
   * `SQLITE_MISUSE`.
   */
  prepare(sql: string): Result<Statement, SqliteError> {
    const s: i32 = nishsqlite_prepare(this.handle, sql)
    if (s < 0) {
      return Err(this.error(-s))
    }
    return Ok(new Statement(s, this.handle))
  }

  /** The error for `code`, which this connection's last call answered. Ask before the next call. */
  error(code: i32): SqliteError {
    return new SqliteError(code, messageFor(code, nishsqlite_errmsg(this.handle)))
  }

  /** The rowid of the last row an INSERT on this connection made, 0 before any. */
  lastInsertRowid(): i64 {
    return nishsqlite_last_insert_rowid(this.handle)
  }

  /** The rows the last INSERT, UPDATE or DELETE changed. */
  changes(): i64 {
    return nishsqlite_changes(this.handle)
  }

  /** Finalizes every statement of this connection and closes it; the handles name nothing after. */
  close(): Result<void, i32> {
    return done(nishsqlite_close(this.handle))
  }
}

/**
 * A prepared statement. Parameters count from 1 (`?1`, or the order of `?`),
 * columns from 0, as in SQLite.
 */
export class Statement {
  /** The adapter's handle. */
  handle: i32
  /** The handle of the connection it was prepared on. */
  database: i32

  constructor(handle: i32, database: i32) {
    this.handle = handle
    this.database = database
  }

  /** Binds an integer to parameter `i`. */
  bindI64(i: i32, v: i64): Result<void, i32> {
    return done(nishsqlite_bind_i64(this.handle, i, v))
  }

  /** Binds a floating-point value to parameter `i`. */
  bindF64(i: i32, v: f64): Result<void, i32> {
    return done(nishsqlite_bind_f64(this.handle, i, v))
  }

  /** Binds SQL NULL to parameter `i`. */
  bindNull(i: i32): Result<void, i32> {
    return done(nishsqlite_bind_null(this.handle, i))
  }

  /** Binds `text` to parameter `i`; SQLite copies it. */
  bindText(i: i32, text: string): Result<void, i32> {
    return done(nishsqlite_bind_text(this.handle, i, text))
  }

  /** Binds `buf[off, off + len)` as text, copied; a window outside `buf` is `SQLITE_MISUSE`. */
  bindTextBytes(i: i32, buf: readonly u8[], off: i32, len: i32): Result<void, i32> {
    return done(nishsqlite_bind_bytes(this.handle, i, buf, toU64(buf.length), off, len, 0))
  }

  /** Binds `buf[off, off + len)` as a blob, copied; a window outside `buf` is `SQLITE_MISUSE`. */
  bindBlob(i: i32, buf: readonly u8[], off: i32, len: i32): Result<void, i32> {
    return done(nishsqlite_bind_bytes(this.handle, i, buf, toU64(buf.length), off, len, 1))
  }

  /** Clears every parameter back to NULL. */
  clearBindings(): Result<void, i32> {
    return done(nishsqlite_clear_bindings(this.handle))
  }

  /** Runs the statement to its next row: `true` with a row to read, `false` when it has finished. */
  step(): Result<boolean, i32> {
    const rc: i32 = nishsqlite_step(this.handle)
    if (rc === SQLITE_ROW) {
      return Ok(true)
    }
    if (rc === SQLITE_DONE) {
      return Ok(false)
    }
    return Err(rc)
  }

  /** Rewinds the statement to run again, keeping its bindings. */
  reset(): Result<void, i32> {
    return done(nishsqlite_reset(this.handle))
  }

  /** Frees the statement; its handle names nothing after. */
  finalize(): Result<void, i32> {
    return done(nishsqlite_finalize(this.handle))
  }

  /** The number of columns a row has. */
  columnCount(): i32 {
    return nishsqlite_column_count(this.handle)
  }

  /** The type of column `c` in this row, `SQLITE_INTEGER` to `SQLITE_NULL`; `SQLITE_NULL` for a column that is not there. */
  columnType(c: i32): i32 {
    return nishsqlite_column_type(this.handle, c)
  }

  /** Column `c` as an integer, converted as SQLite converts; 0 for NULL or a column that is not there. */
  columnI64(c: i32): i64 {
    return nishsqlite_column_i64(this.handle, c)
  }

  /** Column `c` as a floating-point value; 0 for NULL or a column that is not there. */
  columnF64(c: i32): f64 {
    return nishsqlite_column_f64(this.handle, c)
  }

  /** The bytes `columnInto` would copy for column `c`. */
  columnBytes(c: i32): i32 {
    return nishsqlite_column_bytes(this.handle, c)
  }

  /** Column `c` as a new string; `null` for NULL or a column that is not there. Allocates. */
  columnText(c: i32): string | null {
    return nishsqlite_column_text(this.handle, c)
  }

  /**
   * Copies column `c` — a blob's bytes, anything else as text — into `buf`
   * at `at`, and answers its length. It copies only when all of it fits, so
   * a length larger than `buf.length - at` means nothing was written and
   * says how much room is needed. `SQLITE_RANGE` for a column that is not
   * there, `SQLITE_MISUSE` for an `at` outside `0..buf.length`.
   */
  columnInto(c: i32, buf: u8[], at: i32): Result<i32, i32> {
    const n: i32 = nishsqlite_column_into(this.handle, c, buf, toU64(buf.length), at)
    if (n < 0) {
      return Err(-n)
    }
    return Ok(n)
  }

  /** The error for `code`, which this statement's last call answered. Ask before the next call. */
  error(code: i32): SqliteError {
    return new SqliteError(code, messageFor(code, nishsqlite_stmt_errmsg(this.handle)))
  }
}
