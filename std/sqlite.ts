/**
 * `nish/sqlite` (the file `std/sqlite.ts`) — SQLite, the database in a file,
 * from a Nish program.
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
 *     const rows = db.prepare("SELECT id, name FROM t ORDER BY id").expect("prepare")
 *     const buf = new Array<u8>(64)
 *     while (rows.step().expect("step")) {
 *       const n = rows.columnInto(1, buf, 0).expect("name")
 *       // n > buf.length means nothing was copied: grow buf and read again
 *       console.log(`${rows.columnI64(0)} ${String.fromBytes(buf, 0, n)}`)
 *     }
 *     db.close().expect("close")  // finalizes `insert` and `rows` too
 *
 * It is the SQLite C library, vendored in `runtime/sqlite/` and linked into a
 * program that imports this module (`scripts/build.sh`), with one small C
 * adapter beside it (`runtime/sqlite/nish-sqlite.c`). A connection and a
 * prepared statement are handles into the adapter's tables, so a `Database`
 * and a `Statement` are an `i32` each, and a handle used after `close` or
 * `finalize` answers `MISUSE` instead of reaching freed memory.
 *
 * **The loop allocates nothing.** Every call a row makes — bind, `step`,
 * `reset`, `columnI64`, `columnF64`, `columnInto` — answers a bare scalar or a
 * `Result` of two scalars, which travels as one machine word, and copies
 * nothing but what it is asked for: `columnInto` copies a text or blob column into the caller's
 * `u8[]` with one `memcpy`. `columnText` is the convenience that allocates a
 * string. Building a `SqliteError` allocates, which is why the hot calls answer
 * the bare result code and `error(code)` builds the message only for the
 * caller who wants it.
 *
 * **Results are SQLite's own codes**, extended (`SQLITE_CONSTRAINT_UNIQUE`
 * rather than `SQLITE_CONSTRAINT`), so a program can compare them with the
 * constants below or with SQLite's documentation. `SqliteError.code` is the
 * primary code, the low byte. `openDatabase` and `prepare` answer a built
 * `SqliteError`, since they run once and the caller nearly always wants the
 * message; every other call answers `Err` with the bare extended code, and
 * `Database.error` or `Statement.error` turns it into a `SqliteError`.
 *
 * **A cursor reads a table or index without SQL.** Inside a read transaction
 * (`beginRead` to `endRead`), `openCursor` checks the object's columns against
 * the list the program names, and the `Cursor` then walks SQLite's B-tree
 * directly: `first`, `next`, `seekRowid`, and for an index a seek key built
 * with `keyI64` and `keyText` and moved to with `seek`. Its column reads
 * answer what the row stores and, like a statement's, allocate nothing. Every
 * `exec`, `commit`, `rollback` and `endRead`, and every stepped statement but
 * a plain read (a `pragma_*` SELECT included), closes every cursor first, so
 * a cursor never reads a page that changed; its calls answer `SQLITE_MISUSE`.
 *
 *     db.beginRead().expect("begin")
 *     const ix = db.openCursor("t_name", "name,rowid").expect("cursor")
 *     ix.keyText("ada").expect("key")
 *     let on = ix.seek(SEEK_GE).expect("seek")
 *     while (on) {
 *       // ix.columnInto(0, buf, 0) is the name, ix.rowid() the row
 *       on = ix.next().expect("next")
 *     }
 *     db.endRead().expect("end")  // closes `ix`
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
// an `sqlite3_` or a `nishsqlite_` function, as this one does.
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
declare function nishsqlite_begin_read(h: i32): i32
declare function nishsqlite_end_read(h: i32): i32
declare function nishsqlite_cursor_open(h: i32, name: string, columns: string): i32
declare function nishsqlite_cursor_close(h: i32): i32
declare function nishsqlite_cursor_first(h: i32): i32
declare function nishsqlite_cursor_last(h: i32): i32
declare function nishsqlite_cursor_next(h: i32): i32
declare function nishsqlite_cursor_previous(h: i32): i32
declare function nishsqlite_cursor_seek_rowid(h: i32, rowid: i64): i32
declare function nishsqlite_key_reset(h: i32): i32
declare function nishsqlite_key_i64(h: i32, v: i64): i32
declare function nishsqlite_key_text(h: i32, text: string): i32
declare function nishsqlite_key_bytes(h: i32, buf: readonly u8[], n: u64, off: i32, len: i32): i32
declare function nishsqlite_cursor_seek(h: i32, op: i32): i32
declare function nishsqlite_cursor_column_type(h: i32, c: i32): i32
declare function nishsqlite_cursor_column_i64(h: i32, c: i32): i64
declare function nishsqlite_cursor_column_into(h: i32, c: i32, buf: u8[], n: u64, at: i32): i32
declare function nishsqlite_cursor_rowid(h: i32): i64
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

/** `Cursor.seek`: the first index entry at or after the key. */
export const SEEK_GE: i32 = 1
/** `Cursor.seek`: the first index entry after the key. */
export const SEEK_GT: i32 = 2
/** `Cursor.seek`: the last index entry at or before the key. */
export const SEEK_LE: i32 = 3
/** `Cursor.seek`: the last index entry before the key. */
export const SEEK_LT: i32 = 4

/**
 * The version of the SQLite library linked into this program.
 *
 * @returns The version string, such as `3.50.4`.
 */
export const sqliteVersion = (): string => sqlite3_libversion()

/** A failure, with SQLite's message for it. Built only when asked for, by `error(code)`. */
export class SqliteError {
  /** The primary result code, such as `SQLITE_CONSTRAINT`. */
  code: i32
  /** The extended code, such as `SQLITE_CONSTRAINT_UNIQUE` (2067). */
  extendedCode: i32
  /** SQLite's message, such as `UNIQUE constraint failed: t.id`. */
  message: string

  /**
   * Builds the error from an extended code, keeping its low byte as `code`.
   *
   * @param extendedCode The extended result code, such as 2067 for
   *   `SQLITE_CONSTRAINT_UNIQUE`; a primary code is its own extended code.
   * @param message The text to report, usually SQLite's message for the code.
   */
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
 * adapter can answer without SQLite (`MISUSE`, `RANGE`, `NOMEM` for a full
 * handle table or a failed conversion), where the connection's message may
 * still be that of some earlier failure.
 */
const messageFor = (code: i32, connection: string): string => {
  const primary: i32 = code & 0xff
  if (primary === SQLITE_MISUSE || primary === SQLITE_RANGE || primary === SQLITE_NOMEM) {
    return sqlite3_errstr(code)
  }
  return connection
}

/** A cursor move's answer: 1 on a row, 0 for none, the negated code. */
const moved = (r: i32): Result<boolean, i32> => {
  if (r < 0) {
    return Err(-r)
  }
  return Ok(r === 1)
}

/**
 * Opens the database at `path`. `flags` holds one of `OPEN_READONLY`,
 * `OPEN_READWRITE` or `OPEN_READWRITE | OPEN_CREATE`, with any of `OPEN_URI`,
 * `OPEN_MEMORY` and `OPEN_NOFOLLOW`; anything else is `SQLITE_MISUSE`. The
 * path `:memory:` is a database of its own that lives as long as the
 * connection. A failed open leaves nothing open behind it.
 *
 * @param path The file to open, a `file:` URI under `OPEN_URI`, or `:memory:`.
 * @param flags The `OPEN_*` bits, combined with `|`.
 * @returns The connection, or a `SqliteError` with SQLite's code and message,
 *   such as `SQLITE_CANTOPEN` for a file that cannot be opened.
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
  private handle: i32

  /**
   * Wraps an adapter handle. A program gets a `Database` from `openDatabase`
   * rather than building one. With a handle that names no connection, a call
   * that can fail fails with `SQLITE_MISUSE`; `lastInsertRowid` and `changes`
   * answer 0, and `error` answers a message.
   *
   * @param handle The adapter's connection handle.
   */
  constructor(handle: i32) {
    this.handle = handle
  }

  /**
   * Runs every statement of `sql` in turn, discarding any rows. It stops at
   * the first statement that fails, so the ones before it have run.
   *
   * @param sql One or more SQL statements, separated by `;`.
   * @returns `Ok()`, or `Err` with the extended result code of the failure.
   */
  exec(sql: string): Result<void, i32> {
    return done(nishsqlite_exec(this.handle, sql))
  }

  /**
   * Starts a transaction: `exec("BEGIN")`.
   *
   * @returns `Ok()`, or `Err` with the extended result code, such as
   *   `SQLITE_ERROR` inside a transaction already.
   */
  begin(): Result<void, i32> {
    return this.exec("BEGIN")
  }

  /**
   * Commits the open transaction: `exec("COMMIT")`.
   *
   * @returns `Ok()`, or `Err` with the extended result code, such as
   *   `SQLITE_BUSY` when another connection holds the lock.
   */
  commit(): Result<void, i32> {
    return this.exec("COMMIT")
  }

  /**
   * Undoes the open transaction: `exec("ROLLBACK")`.
   *
   * @returns `Ok()`, or `Err` with the extended result code.
   */
  rollback(): Result<void, i32> {
    return this.exec("ROLLBACK")
  }

  /**
   * Starts a read transaction: `BEGIN`, then a read of the schema, which takes
   * the main database's read lock. Its snapshot is what every cursor of this
   * connection reads until `endRead`, and `openCursor` needs one.
   *
   * @returns `Ok()`, or `Err` with `SQLITE_MISUSE` inside a transaction
   *   already, or the extended result code, such as `SQLITE_BUSY`.
   */
  beginRead(): Result<void, i32> {
    return done(nishsqlite_begin_read(this.handle))
  }

  /**
   * Closes every cursor of this connection and commits the transaction.
   *
   * @returns `Ok()`, or `Err` with `SQLITE_MISUSE` outside a transaction, or
   *   the extended result code of the `COMMIT`.
   */
  endRead(): Result<void, i32> {
    return done(nishsqlite_end_read(this.handle))
  }

  /**
   * Opens a cursor on `name`, a table or index of the main database, inside a
   * read transaction (`beginRead`). `columns` is the schema the program reads,
   * checked at open: a table's columns, or an index's key columns, each with
   * ` DESC` where the index has it, and then `rowid`, in order, joined by `,`
   * with no space. A table that is `WITHOUT ROWID`, a view or virtual table,
   * one with a generated column, an index on an expression or with a
   * collation other than `BINARY`, and a database that is not UTF-8 are
   * refused. `close`, `endRead`, closing the connection, any `exec`, and any
   * stepped statement but a plain read (`pragma_*` SELECTs too) close it.
   *
   * @param name The table or index, as the schema names it.
   * @param columns The columns, such as `"id,name,score"` for a table or
   *   `"name,score DESC,rowid"` for an index.
   * @returns The cursor, or a `SqliteError`: `SQLITE_MISUSE` outside a read
   *   transaction, `SQLITE_SCHEMA` for an object that is not there, is not one
   *   a cursor reads, or has columns other than `columns`.
   */
  openCursor(name: string, columns: string): Result<Cursor, SqliteError> {
    const h: i32 = nishsqlite_cursor_open(this.handle, name, columns)
    if (h < 0) {
      if (-h === SQLITE_SCHEMA) {
        return Err(
          new SqliteError(-h, `no table or index ${name} with columns "${columns}" that a cursor reads`)
        )
      }
      return Err(this.error(-h))
    }
    return Ok(new Cursor(h))
  }

  /**
   * Compiles the first statement of `sql`, to be bound, stepped and reset as
   * often as wanted; text after it is ignored. Text with no statement in it is
   * `SQLITE_MISUSE`. The statement belongs to this connection, and `close`
   * finalizes it.
   *
   * @param sql The statement, with `?` or `?N` for each parameter.
   * @returns The statement, or a `SqliteError` with the code and message, such
   *   as a syntax error's `SQLITE_ERROR`.
   */
  prepare(sql: string): Result<Statement, SqliteError> {
    const s: i32 = nishsqlite_prepare(this.handle, sql)
    if (s < 0) {
      return Err(this.error(-s))
    }
    return Ok(new Statement(s))
  }

  /**
   * The error for `code`, which this connection's last call answered. Ask
   * before the next call, since the next call replaces the connection's
   * message. Allocates the `SqliteError`.
   *
   * @param code The extended result code an `Err` carried.
   * @returns The error, with SQLite's message for it.
   */
  error(code: i32): SqliteError {
    return new SqliteError(code, messageFor(code, nishsqlite_errmsg(this.handle)))
  }

  /**
   * The rowid of the last row an INSERT on this connection made.
   *
   * @returns The rowid, or 0 before any INSERT and for a closed connection.
   */
  lastInsertRowid(): i64 {
    return nishsqlite_last_insert_rowid(this.handle)
  }

  /**
   * How many rows the last INSERT, UPDATE or DELETE on this connection
   * changed.
   *
   * @returns The row count, or 0 for a closed connection.
   */
  changes(): i64 {
    return nishsqlite_changes(this.handle)
  }

  /**
   * Finalizes every statement of this connection and closes it; the handles
   * name nothing after. A close that fails has still finalized the
   * statements, but leaves the connection open, its message readable through
   * `error`.
   *
   * @returns `Ok()`, or `Err` with the extended result code, such as
   *   `SQLITE_MISUSE` for a connection already closed.
   */
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
  private handle: i32

  /**
   * Wraps an adapter handle. A program gets a `Statement` from
   * `Database.prepare` rather than building one. With a handle that names no
   * statement, a call that can fail fails with `SQLITE_MISUSE`, and the
   * other column readers answer as for a column that is not there: 0,
   * `SQLITE_NULL`, or `null`.
   *
   * @param handle The adapter's statement handle.
   */
  constructor(handle: i32) {
    this.handle = handle
  }

  /**
   * Binds an integer to parameter `i`.
   *
   * @param i The parameter's index, from 1.
   * @param v The value.
   * @returns `Ok()`, or `Err` with `SQLITE_RANGE` for an index the statement
   *   has no parameter at, `SQLITE_MISUSE` for a finalized statement or one
   *   stepped since its last `reset`: finished or not, it refuses binds until
   *   `reset`.
   */
  bindI64(i: i32, v: i64): Result<void, i32> {
    return done(nishsqlite_bind_i64(this.handle, i, v))
  }

  /**
   * Binds a floating-point value to parameter `i`.
   *
   * @param i The parameter's index, from 1.
   * @param v The value.
   * @returns `Ok()`, or `Err` with the code, as for `bindI64`.
   */
  bindF64(i: i32, v: f64): Result<void, i32> {
    return done(nishsqlite_bind_f64(this.handle, i, v))
  }

  /**
   * Binds SQL NULL to parameter `i`.
   *
   * @param i The parameter's index, from 1.
   * @returns `Ok()`, or `Err` with the code, as for `bindI64`.
   */
  bindNull(i: i32): Result<void, i32> {
    return done(nishsqlite_bind_null(this.handle, i))
  }

  /**
   * Binds `text` to parameter `i`; SQLite copies it, so the string need not
   * outlive the call. The text ends at its first NUL.
   *
   * @param i The parameter's index, from 1.
   * @param text The value.
   * @returns `Ok()`, or `Err` with the code, as for `bindI64`, or
   *   `SQLITE_TOOBIG` or `SQLITE_NOMEM` from SQLite.
   */
  bindText(i: i32, text: string): Result<void, i32> {
    return done(nishsqlite_bind_text(this.handle, i, text))
  }

  /**
   * Binds `buf[off, off + len)` as text, copied, so `buf` may change after
   * the call; a window outside `buf` is `SQLITE_MISUSE`. The bytes should be
   * UTF-8 and may hold a NUL.
   *
   * @param i The parameter's index, from 1.
   * @param buf The bytes to read from.
   * @param off Where the text starts in `buf`, in bytes.
   * @param len The text's length in bytes.
   * @returns `Ok()`, or `Err` with the code, as for `bindI64`, or
   *   `SQLITE_TOOBIG` or `SQLITE_NOMEM` from SQLite.
   */
  bindTextBytes(i: i32, buf: readonly u8[], off: i32, len: i32): Result<void, i32> {
    return done(nishsqlite_bind_bytes(this.handle, i, buf, toU64(buf.length), off, len, 0))
  }

  /**
   * Binds `buf[off, off + len)` as a blob, copied, so `buf` may change after
   * the call; a window outside `buf` is `SQLITE_MISUSE`.
   *
   * @param i The parameter's index, from 1.
   * @param buf The bytes to read from.
   * @param off Where the blob starts in `buf`, in bytes.
   * @param len The blob's length in bytes.
   * @returns `Ok()`, or `Err` with the code, as for `bindI64`, or
   *   `SQLITE_TOOBIG` or `SQLITE_NOMEM` from SQLite.
   */
  bindBlob(i: i32, buf: readonly u8[], off: i32, len: i32): Result<void, i32> {
    return done(nishsqlite_bind_bytes(this.handle, i, buf, toU64(buf.length), off, len, 1))
  }

  /**
   * Clears every parameter back to NULL. `reset` keeps the bindings, so this
   * is the call for a run that must not see the last one's values.
   *
   * @returns `Ok()`, or `Err` with `SQLITE_MISUSE` for a finalized statement.
   */
  clearBindings(): Result<void, i32> {
    return done(nishsqlite_clear_bindings(this.handle))
  }

  /**
   * Runs the statement to its next row. Call `reset` to run it again from
   * the start, with the same bindings.
   *
   * @returns `true` with a row to read, `false` when it has finished, or `Err`
   *   with the extended result code, such as `SQLITE_CONSTRAINT_UNIQUE`.
   */
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

  /**
   * Rewinds the statement to run again, keeping its bindings. A failure of
   * the last `step` is not answered again here: `step` already answered it.
   *
   * @returns `Ok()`, or `Err` with `SQLITE_MISUSE` for a finalized statement.
   */
  reset(): Result<void, i32> {
    return done(nishsqlite_reset(this.handle))
  }

  /**
   * Frees the statement early; its handle names nothing after. Without this,
   * `Database.close` frees it.
   *
   * @returns `Ok()`, or `Err` with `SQLITE_MISUSE` for a statement already
   *   finalized or whose connection is closed.
   */
  finalize(): Result<void, i32> {
    return done(nishsqlite_finalize(this.handle))
  }

  /**
   * The number of columns a row of this statement has, known from `prepare`
   * on, before the first `step`.
   *
   * @returns The column count, or 0 for a statement that returns no rows (an
   *   INSERT, say) and for a finalized one.
   */
  columnCount(): i32 {
    return nishsqlite_column_count(this.handle)
  }

  /**
   * The type of column `c` in the current row.
   *
   * @param c The column's index, from 0.
   * @returns One of `SQLITE_INTEGER` to `SQLITE_NULL`; `SQLITE_NULL` for a
   *   column that is not there or when no row is current.
   */
  columnType(c: i32): i32 {
    return nishsqlite_column_type(this.handle, c)
  }

  /**
   * Column `c` of the current row as an integer, converted as SQLite
   * converts (text `"12abc"` is 12, a float is truncated).
   *
   * @param c The column's index, from 0.
   * @returns The value; 0 for NULL, a column that is not there, or when no
   *   row is current.
   */
  columnI64(c: i32): i64 {
    return nishsqlite_column_i64(this.handle, c)
  }

  /**
   * Column `c` of the current row as a floating-point value, converted as
   * SQLite converts.
   *
   * @param c The column's index, from 0.
   * @returns The value; 0 for NULL, a column that is not there, or when no
   *   row is current.
   */
  columnF64(c: i32): f64 {
    return nishsqlite_column_f64(this.handle, c)
  }

  /**
   * How many bytes `columnInto` would copy for column `c`: a blob's length,
   * or anything else's length as text. Ask it to size a buffer before the
   * copy.
   *
   * @param c The column's index, from 0.
   * @returns The length in bytes, without a terminating NUL; 0 for NULL, a
   *   column that is not there, or when no row is current.
   */
  columnBytes(c: i32): i32 {
    return nishsqlite_column_bytes(this.handle, c)
  }

  /**
   * Column `c` of the current row as a new string, cut at its first NUL.
   * Allocates on every call; `columnInto` is the call for a hot loop.
   *
   * @param c The column's index, from 0.
   * @returns The text, or `null` for NULL, a column that is not there, or
   *   when no row is current.
   */
  columnText(c: i32): string | null {
    return nishsqlite_column_text(this.handle, c)
  }

  /**
   * Copies column `c` — a blob's bytes, anything else as text — into `buf`
   * at `at`, and answers its length. It copies only when all of it fits, so
   * a length larger than `buf.length - at` means nothing was written and
   * says how much room is needed. `SQLITE_RANGE` for a column that is not
   * there, `SQLITE_MISUSE` for an `at` outside `0..buf.length`.
   *
   * @param c The column's index, from 0.
   * @param buf The caller's buffer, written in place.
   * @param at Where in `buf` the copy starts, in bytes.
   * @returns The column's length in bytes (0 for NULL, or when no row is
   *   current), or `Err` with `SQLITE_RANGE`, `SQLITE_MISUSE`, or
   *   `SQLITE_NOMEM` when SQLite cannot convert the value to text.
   */
  columnInto(c: i32, buf: u8[], at: i32): Result<i32, i32> {
    const n: i32 = nishsqlite_column_into(this.handle, c, buf, toU64(buf.length), at)
    if (n < 0) {
      return Err(-n)
    }
    return Ok(n)
  }

  /**
   * The error for `code`, which this statement's last call answered. Ask
   * before the next call, since the next call on the connection replaces its
   * message. Allocates the `SqliteError`.
   *
   * @param code The extended result code an `Err` carried.
   * @returns The error, with SQLite's message for it.
   */
  error(code: i32): SqliteError {
    return new SqliteError(code, messageFor(code, nishsqlite_stmt_errmsg(this.handle)))
  }
}

declare function nishsqlite_cursor_read_row(h: i32, io: u8[], n: u64, ncols: i32, text: u8[], ntext: u64): i32

/**
 * A B-tree cursor on a table or index, which reads rows without a statement.
 * Columns count from 0 in the order `openCursor` named them. A call on a
 * closed or invalidated cursor answers `SQLITE_MISUSE` (0 from `rowid` and
 * `columnI64`).
 */
export class Cursor {
  /** The adapter's handle. */
  private handle: i32
  /** `readRow`'s exchange with the adapter, grown to the widest row read. */
  private rowIo: u8[]

  /**
   * Wraps an adapter handle. A program gets a `Cursor` from
   * `Database.openCursor` rather than building one.
   *
   * @param handle The adapter's cursor handle.
   */
  constructor(handle: i32) {
    this.handle = handle
    this.rowIo = []
  }

  /**
   * Moves to the first row, in the index's order for an index.
   *
   * @returns `true` on a row, `false` for an empty table or index, or `Err`
   *   with the code: `SQLITE_MISUSE` for a closed cursor, or SQLite's, such as
   *   `SQLITE_CORRUPT`.
   */
  first(): Result<boolean, i32> {
    return moved(nishsqlite_cursor_first(this.handle))
  }

  /**
   * Moves to the last row.
   *
   * @returns `true` on a row, `false` for an empty table or index, or `Err`
   *   with the code, as for `first`.
   */
  last(): Result<boolean, i32> {
    return moved(nishsqlite_cursor_last(this.handle))
  }

  /**
   * Moves to the next row.
   *
   * @returns `true` on a row, `false` past the last, or `Err` with the code,
   *   as for `first`, or `SQLITE_MISUSE` when the cursor has no row to move
   *   from.
   */
  next(): Result<boolean, i32> {
    return moved(nishsqlite_cursor_next(this.handle))
  }

  /**
   * Moves to the row before.
   *
   * @returns `true` on a row, `false` before the first, or `Err` with the
   *   code, as for `next`.
   */
  previous(): Result<boolean, i32> {
    return moved(nishsqlite_cursor_previous(this.handle))
  }

  /**
   * Moves a table cursor to the row whose rowid is `rowid`.
   *
   * @param rowid The row's rowid.
   * @returns `true` when the row is there, `false` when not, or `Err` with
   *   the code, as for `first`, or `SQLITE_MISUSE` for an index cursor.
   */
  seekRowid(rowid: i64): Result<boolean, i32> {
    return moved(nishsqlite_cursor_seek_rowid(this.handle, rowid))
  }

  /**
   * Empties an index cursor's seek key, to build a new one with `keyI64`,
   * `keyText` and `keyTextBytes`.
   *
   * @returns `Ok()`, or `Err` with `SQLITE_MISUSE` for a table cursor or a
   *   closed one.
   */
  keyReset(): Result<void, i32> {
    return done(nishsqlite_key_reset(this.handle))
  }

  /**
   * Appends an integer to the seek key, for the index's next key column.
   *
   * @param v The value.
   * @returns `Ok()`, or `Err` with `SQLITE_RANGE` when the key has a value
   *   for every key column already, or `SQLITE_MISUSE` for a table cursor.
   */
  keyI64(v: i64): Result<void, i32> {
    return done(nishsqlite_key_i64(this.handle, v))
  }

  /**
   * Appends text to the seek key, copied; the text ends at its first NUL.
   *
   * @param text The value.
   * @returns `Ok()`, or `Err` with the code, as for `keyI64`, or
   *   `SQLITE_NOMEM`.
   */
  keyText(text: string): Result<void, i32> {
    return done(nishsqlite_key_text(this.handle, text))
  }

  /**
   * Appends `buf[off, off + len)` to the seek key as text, copied; a window
   * outside `buf` is `SQLITE_MISUSE`.
   *
   * @param buf The bytes to read from.
   * @param off Where the text starts in `buf`, in bytes.
   * @param len The text's length in bytes.
   * @returns `Ok()`, or `Err` with the code, as for `keyText`.
   */
  keyTextBytes(buf: readonly u8[], off: i32, len: i32): Result<void, i32> {
    return done(nishsqlite_key_bytes(this.handle, buf, toU64(buf.length), off, len))
  }

  /**
   * Moves an index cursor by its seek key, compared with each entry's first
   * key columns, so a key with fewer values than the index is a prefix:
   * `SEEK_GE` and `SEEK_GT` land on the first entry at or after the key,
   * `SEEK_LE` and `SEEK_LT` on the last at or before it, the `E` forms
   * counting an equal entry. The key stays, for the next seek.
   *
   * @param op One of `SEEK_GE`, `SEEK_GT`, `SEEK_LE` and `SEEK_LT`.
   * @returns `true` on an entry, `false` when there is none on that side, or
   *   `Err` with the code, as for `first`, or `SQLITE_MISUSE` for a table
   *   cursor, an empty key or another `op`.
   */
  seek(op: i32): Result<boolean, i32> {
    return moved(nishsqlite_cursor_seek(this.handle, op))
  }

  /**
   * The current row's rowid: a table row's key, an index entry's `rowid`.
   *
   * @returns The rowid, or 0 when the cursor has no row.
   */
  rowid(): i64 {
    return nishsqlite_cursor_rowid(this.handle)
  }

  /**
   * The type the current row stores for column `c`, as written: a REAL
   * column holding a whole number stores an integer, where a query would
   * answer a float.
   *
   * @param c The column's index, from 0, in `openCursor`'s order.
   * @returns One of `SQLITE_INTEGER` to `SQLITE_NULL`, or `Err` with
   *   `SQLITE_MISUSE` when the cursor has no row, `SQLITE_RANGE` for a column
   *   that is not there, `SQLITE_SCHEMA` for a row written before `ALTER TABLE`
   *   added the column, or `SQLITE_ABORT` when the cursor's row has moved.
   */
  columnType(c: i32): Result<i32, i32> {
    const t: i32 = nishsqlite_cursor_column_type(this.handle, c)
    if (t < 0) {
      return Err(-t)
    }
    return Ok(t)
  }

  /**
   * Column `c` of the current row as an integer, converted as SQLite
   * converts.
   *
   * @param c The column's index, from 0.
   * @returns The value; 0 for NULL and for a column `columnType` refuses.
   */
  columnI64(c: i32): i64 {
    return nishsqlite_cursor_column_i64(this.handle, c)
  }

  /**
   * Copies a text or blob column's stored bytes into `buf` at `at`, and
   * answers their length, as `Statement.columnInto` does: it copies only when
   * all of them fit, so a length larger than `buf.length - at` means nothing
   * was written. It converts no number to text.
   *
   * @param c The column's index, from 0.
   * @param buf The caller's buffer, written in place.
   * @param at Where in `buf` the copy starts, in bytes.
   * @returns The length in bytes, 0 for NULL, or `Err` with the code, as for
   *   `columnType`, or `SQLITE_MISMATCH` for an integer or float, or
   *   `SQLITE_MISUSE` for an `at` outside `0..buf.length`.
   */
  columnInto(c: i32, buf: u8[], at: i32): Result<i32, i32> {
    const n: i32 = nishsqlite_cursor_column_into(this.handle, c, buf, toU64(buf.length), at)
    if (n < 0) {
      return Err(-n)
    }
    return Ok(n)
  }

  /**
   * Reads the current row's columns `cols` in one call. For column `cols[k]`
   * it writes `ints[k]`, the value `columnI64` answers (text and blob converted),
   * and `spans[3k]`, `spans[3k + 1]` and `spans[3k + 2]`: the type
   * `columnType` answers, then where its bytes start in `text` and how many
   * there are, which are the bytes `columnInto` copies (0 and 0 for a
   * number or NULL). The row's text and blob bytes sit in `text` in column
   * order. It copies only when all of them fit, so an answer larger than
   * `text.length` means nothing was written to any buffer: grow `text` and
   * call again. It allocates only when `cols` is longer than every list
   * read before.
   *
   * @param cols The columns' indices, from 0.
   * @param ints Receives each column's integer; at least `cols.length` long.
   * @param spans Receives each column's type, offset and length; at least
   *   `3 * cols.length` long.
   * @param text Receives the text and blob bytes.
   * @returns The text and blob bytes the row holds, or `Err` with the code
   *   of the first column refused, as for `columnType`, or `SQLITE_MISUSE`
   *   when `ints` or `spans` is too short or `cols` holds over 65535
   *   columns, or `SQLITE_TOOBIG` for over 2^31 - 1 bytes.
   */
  readRow(cols: readonly i32[], ints: i64[], spans: i32[], text: u8[]): Result<i32, i32> {
    const k: i32 = cols.length
    if (k > 0xffff || ints.length < k || spans.length < 3 * k) {
      return Err(SQLITE_MISUSE)
    }
    if (this.rowIo.length < 22 * k) {
      this.rowIo = new Array<u8>(22 * k)
    }
    const io: u8[] = this.rowIo
    for (let i: i32 = 0; i < k; i++) {
      const c: i32 = cols[i] < 0 || cols[i] > 0xffff ? 0xffff : cols[i]
      io[2 * i] = toU8(c & 0xff)
      io[2 * i + 1] = toU8(c >> 8)
    }
    const n: i32 = nishsqlite_cursor_read_row(this.handle, io, toU64(io.length), k, text, toU64(text.length))
    if (n < 0) {
      return Err(-n)
    }
    if (n > text.length) {
      return Ok(n)
    }
    let at: i32 = 2 * k
    for (let i: i32 = 0; i < k && i < ints.length && at >= 0 && at + 19 < io.length; i++) {
      let v: u64 = 0
      for (let b: i32 = 7; b >= 0; b--) {
        v = (v << 8) | toU64(io[at + b])
      }
      ints[i] = toI64(v)
      for (let f: i32 = 0; f < 3; f++) {
        const p: i32 = at + 8 + 4 * f
        const s: i32 = 3 * i + f
        if (s < spans.length && p >= 0 && p + 3 < io.length) {
          spans[s] = toI32(
            toU32(io[p]) | (toU32(io[p + 1]) << 8) | (toU32(io[p + 2]) << 16) | (toU32(io[p + 3]) << 24)
          )
        }
      }
      at = at + 20
    }
    return Ok(n)
  }

  /**
   * Closes the cursor; the handle names nothing after.
   *
   * @returns `Ok()`, or `Err` with `SQLITE_MISUSE` for a cursor already
   *   closed or invalidated.
   */
  close(): Result<void, i32> {
    return done(nishsqlite_cursor_close(this.handle))
  }

  /**
   * The error for `code`, which this cursor's last call answered.
   * Allocates the `SqliteError`.
   *
   * @param code The extended result code an `Err` carried.
   * @returns The error, with SQLite's description of the code.
   */
  error(code: i32): SqliteError {
    return new SqliteError(code, sqlite3_errstr(code))
  }
}
