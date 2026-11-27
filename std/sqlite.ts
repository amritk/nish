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
declare function nishsqlite_open_errmsg(): string | null
declare function nishsqlite_close(h: i32): i32
declare function nishsqlite_exec(h: i32, sql: string): i32
declare function nishsqlite_errmsg(h: i32): string | null
declare function nishsqlite_last_insert_rowid(h: i32): i64
declare function nishsqlite_changes(h: i32): i64
declare function nishsqlite_prepare(h: i32, sql: string): i32
declare function nishsqlite_stmt_errmsg(h: i32): string | null
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
declare function sqlite3_errstr(code: i32): string | null
declare function sqlite3_libversion_number(): i32

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
export const sqliteVersion = (): string => {
  // SQLite numbers 3.50.4 as 3050004, the major times a million plus the minor
  // times a thousand plus the patch.
  const n: i32 = sqlite3_libversion_number()
  return `${n / 1000000}.${(n / 1000) % 1000}.${n % 1000}`
}

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
 * SQLite's description of `code`, such as `constraint failed`. The C type lets
 * `sqlite3_errstr` answer NULL, so the code stands in for the text then, as
 * `error 19`, rather than stop the program over a message.
 */
const describe = (code: i32): string => {
  const text = sqlite3_errstr(code)
  return text === null ? `error ${code}` : text
}

/**
 * The message for `code`: the connection's own, unless the code is one the
 * adapter can answer without SQLite (`MISUSE`, `RANGE`, `NOMEM` for a full
 * handle table or a failed conversion), where the connection's message may
 * still be that of some earlier failure, or the connection has no message
 * (NULL), where SQLite's description of the code stands in.
 */
const messageFor = (code: i32, connection: string | null): string => {
  const primary: i32 = code & 0xff
  if (
    connection === null ||
    primary === SQLITE_MISUSE ||
    primary === SQLITE_RANGE ||
    primary === SQLITE_NOMEM
  ) {
    return describe(code)
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
    const code: i32 = -h
    const message = nishsqlite_open_errmsg()
    return Err(new SqliteError(code, message === null ? describe(code) : message))
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
    const h = this.cursorHandle(name, columns)
    if (h.isErr()) {
      return Err(h.error)
    }
    return Ok(new Cursor(h.value))
  }

  /** The adapter's cursor on `name`, as `openCursor` opens it, or its refusal. */
  private cursorHandle(name: string, columns: string): Result<i32, SqliteError> {
    const h: i32 = nishsqlite_cursor_open(this.handle, name, columns)
    if (h < 0) {
      const code: i32 = -h
      if (code === SQLITE_SCHEMA) {
        return Err(
          new SqliteError(code, `no table or index ${name} with columns "${columns}" that a cursor reads`)
        )
      }
      return Err(this.error(code))
    }
    return Ok(h)
  }

  /**
   * `openCursor` into a `Cursor` the program already holds, which then reads
   * the new cursor: the one it held before, open or already ended with its
   * read, is closed first. There is no garbage collector, so a loop that
   * opens the same cursors in every read transaction keeps one `Cursor` each
   * this way and allocates nothing, where `openCursor`'s new object a time
   * would stay allocated for good.
   *
   * @param cur The cursor to reopen.
   * @param name The table or index, as `openCursor` takes it.
   * @param columns Its columns, as `openCursor` takes them.
   * @returns `Ok()`, or `Err` as `openCursor` answers, when `cur` is left
   *   closed.
   */
  reopenCursor(cur: Cursor, name: string, columns: string): Result<void, SqliteError> {
    // A cursor whose read has ended is gone already, and its close answers
    // SQLITE_MISUSE: nothing is open to lose either way.
    const closed = cur.close()
    if (closed.isErr() && closed.error !== SQLITE_MISUSE) {
      return Err(this.error(closed.error))
    }
    const h = this.cursorHandle(name, columns)
    if (h.isErr()) {
      return Err(h.error)
    }
    cur.rebind(h.value)
    return Ok()
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

// Cursor.countRange's two calls: the count, then each count read back.
declare function nishsqlite_cursor_count_range(h: i32, lo: i64, hi: i64, n: u64): i32
declare function nishsqlite_cursor_count_at(h: i32, i: u64): i64
declare function nishsqlite_cursor_read_row(h: i32, io: u8[], n: u64, text: u8[], ntext: u64): i32
declare function nishsqlite_cursor_record(h: i32, buf: u8[], n: u64): i32

/**
 * The SQLite result code the adapter answered as `n`, minus that code: `-n`,
 * spelled `~n + 1`. The adapter only answers small codes; a stray
 * `-2147483648`, whose negation is past an `i32`, answers `2147483647` rather
 * than overflow, and the test with the literal is what proves the sum.
 */
const sqliteNegated = (n: i32): i32 => {
  const m: i32 = ~n
  if (m < 0 || m > 2147483646) {
    return 2147483647
  }
  return m + 1
}

/**
 * A B-tree cursor on a table or index, which reads rows without a statement.
 * Columns count from 0 in the order `openCursor` named them. A call on a
 * closed or invalidated cursor answers `SQLITE_MISUSE` (0 from `rowid` and
 * `columnI64`).
 */
export class Cursor {
  /** `readRow`'s answers from the adapter, sized by `selectRow`. */
  private rowIo: u8[]
  /** The adapter's handle. */
  private handle: i32
  /** The columns `selectRow` chose, -1 before it. */
  private nsel: i32

  /**
   * Wraps an adapter handle. A program gets a `Cursor` from
   * `Database.openCursor` rather than building one.
   *
   * @param handle The adapter's cursor handle.
   */
  constructor(handle: i32) {
    this.handle = handle
    this.rowIo = []
    this.nsel = -1
  }

  /**
   * Points this object at the adapter's cursor `handle`, forgetting the
   * columns `selectRow` chose. `Database.reopenCursor` calls it; a program
   * calls that instead.
   *
   * @param handle The adapter's cursor handle.
   */
  rebind(handle: i32): void {
    this.handle = handle
    this.nsel = -1
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
   * Counts an index's entries whose first key column is `k`, for each `k`
   * from `lo` to `hi`, into `out[k - lo]`, in one seek and one walk of the
   * index, for an index whose first column has INTEGER or NUMERIC affinity.
   * On a full index that is what `SELECT count(*) ... WHERE col = k` answers
   * for each `k`; a partial index holds only the rows its WHERE admits, and
   * counts only those. A count that reaches its walk clears the seek key and
   * leaves the cursor on no row, whatever it answers; one refused first leaves
   * both as they were. Copying the counts into `out` takes one call per key,
   * and one more when `out` is longer than the span. `out` past the span, and
   * all of it on an `Err`, is left as it was.
   *
   * @param lo The first key counted.
   * @param hi The last key counted, at least `lo`.
   * @param out Where the counts go; at least `hi - lo + 1` long.
   * @returns The number of entries counted, or `Err` with `SQLITE_MISUSE` for
   *   a table cursor, `SQLITE_MISMATCH` for an index whose first column has
   *   another affinity, `SQLITE_RANGE` when `lo > hi` or the span is longer
   *   than `out`, or the code SQLite fails with, as for `first`.
   */
  countRange(lo: i64, hi: i64, out: i64[]): Result<i32, i32> {
    const n: i32 = nishsqlite_cursor_count_range(this.handle, lo, hi, toU64(out.length))
    if (n < 0) {
      // The adapter answers minus a SQLite result code.
      return Err(sqliteNegated(n))
    }
    for (let i = 0; i < out.length; i++) {
      const c: i64 = nishsqlite_cursor_count_at(this.handle, toU64(i))
      if (c < 0) {
        break
      }
      // The call above ends what the loop proved of `i`.
      if (i < out.length) {
        out[i] = c
      }
    }
    return Ok(n)
  }

  /**
   * Copies the current row's record into `buf`: SQLite's record format,
   * whole, as it is stored (https://sqlite.org/fileformat2.html#record_format),
   * a header of varints giving each field's serial type, then the fields'
   * bytes. It converts nothing, so a program that decodes the format itself
   * reads a row with one call and one copy. An index entry's record ends with
   * its rowid; a table row's holds NULL for an INTEGER PRIMARY KEY column,
   * whose value is the row's key (`rowid`). It allocates nothing.
   *
   * @param buf Receives the record.
   * @returns The record's length. When that is more than `buf.length`,
   *   nothing is copied: grow `buf` and call again. `Err` with the code:
   *   `SQLITE_MISUSE` with no row or a closed cursor, `SQLITE_ABORT` when the
   *   row has moved, `SQLITE_CORRUPT` for a record longer than SQLite allows,
   *   or SQLite's, such as `SQLITE_IOERR`, when an overflow page cannot be
   *   read.
   */
  record(buf: u8[]): Result<i32, i32> {
    const n: i32 = nishsqlite_cursor_record(this.handle, buf, toU64(buf.length))
    if (n < 0) {
      // The adapter answers minus a SQLite result code.
      return Err(sqliteNegated(n))
    }
    return Ok(n)
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
   * Chooses the columns `readRow` reads, in order; a column may repeat. The
   * list holds until the next `selectRow`, so a loop chooses it once and
   * calls `readRow` per row. It allocates one buffer of 11 bytes per column
   * and checks no index: `readRow` answers `SQLITE_RANGE` for one outside the
   * cursor's columns.
   *
   * @param cols The columns' indices, from 0.
   * @returns `Ok()`, or `Err` with `SQLITE_MISUSE` for over 65535 columns,
   *   which leaves the earlier list chosen.
   */
  selectRow(cols: readonly i32[]): Result<void, i32> {
    const k: i32 = toI32(cols.length)
    if (k > 0xffff) {
      return Err(SQLITE_MISUSE)
    }
    // Each index goes to the adapter as a little-endian u16; one outside
    // 0..65535 is sent as 65535, which no cursor has, so it is RANGE there.
    // A slot of 9 bytes per column follows, which `readRow` fills.
    const io: u8[] = []
    for (let i: i32 = 0; i < k && i < toI32(cols.length); i++) {
      const c: i32 = cols[i] < 0 || cols[i] > 0xffff ? 0xffff : cols[i]
      io.push(toU8(c & 0xff))
      io.push(toU8(c >> 8))
    }
    for (let i: i32 = 0; i < k; i++) {
      for (let b: i32 = 0; b < 9; b++) {
        io.push(0)
      }
    }
    this.rowIo = io
    this.nsel = k
    return Ok()
  }

  /**
   * Reads the current row's `selectRow` columns in one call. For the `k`th
   * of them it writes `spans[3k]`, `spans[3k + 1]` and `spans[3k + 2]`: the
   * type `columnType` answers, then where its bytes start in `text` and how
   * many there are, which are the bytes `columnInto` copies (0 and 0 for a
   * number or NULL); and `ints[k]`, the value `columnI64` answers for an
   * INTEGER or FLOAT column and 0 for TEXT, BLOB and NULL, which it does not
   * convert. The row's text and blob bytes sit in `text` in column order. A
   * refusal, or an answer larger than `text.length`, writes no `ints` or
   * `spans`, and `text` may hold the first columns' bytes: grow `text` and
   * call again. An empty list answers `Ok(0)` on a row, and `SQLITE_MISUSE`
   * with no row or a closed cursor, as any list does. It allocates nothing.
   *
   * @param ints Receives each column's integer; at least as long as the list.
   * @param spans Receives each column's type, offset and length; at least
   *   three times as long as the list.
   * @param text Receives the text and blob bytes.
   * @returns The text and blob bytes the row holds, or `Err` with the code
   *   `columnType` answers for the first column it refuses (`SQLITE_RANGE`
   *   for an index outside the cursor's columns, `SQLITE_SCHEMA` for a
   *   record too short for it, `SQLITE_MISUSE` with no row or a closed
   *   cursor), or `SQLITE_MISUSE` before `selectRow` or when `ints` or
   *   `spans` is too short, or `SQLITE_TOOBIG` for over 2^31 - 1 bytes.
   */
  readRow(ints: i64[], spans: i32[], text: u8[]): Result<i32, i32> {
    const k: i32 = this.nsel
    const ni: i32 = toI32(ints.length)
    const ns: i32 = toI32(spans.length)
    if (k < 0 || ni < k || ns / 3 < k) {
      return Err(SQLITE_MISUSE)
    }
    const io: u8[] = this.rowIo
    const n: i32 = nishsqlite_cursor_read_row(this.handle, io, toU64(io.length), text, toU64(text.length))
    if (n < 0) {
      // The adapter answers minus a SQLite result code.
      return Err(sqliteNegated(n))
    }
    if (n > toI32(text.length)) {
      return Ok(n)
    }
    // The slots follow the 2k index bytes: a column's type, then 8
    // little-endian bytes, the integer, or a TEXT or BLOB column's length,
    // under 2^31 since the row's bytes fit `text`. Those bytes sit in `text`
    // one column after another, so each starts where the last one ended.
    const nio: i32 = toI32(io.length)
    let at: i32 = toI32(toI64(k) + toI64(k))
    let s: i32 = 0
    let off: i32 = 0
    for (
      let i: i32 = 0;
      i < k && i < toI32(ints.length) && s >= 0 && s <= toI32(spans.length) - 3 && at >= 0 && at <= nio - 9;
      i++
    ) {
      const ty: i32 = toI32(io[at])
      spans[s] = ty
      if (ty === SQLITE_TEXT || ty === SQLITE_BLOB) {
        const len: i32 =
          toI32(io[at + 1]) | (toI32(io[at + 2]) << 8) | (toI32(io[at + 3]) << 16) | (toI32(io[at + 4]) << 24)
        ints[i] = 0
        spans[s + 1] = off
        spans[s + 2] = len
        const end: i64 = toI64(off) + toI64(len)
        off = len >= 0 && end <= toI64(n) ? toI32(end) : n
      } else {
        ints[i] =
          ty === SQLITE_NULL
            ? 0
            : toI64(
                toU64(io[at + 1]) |
                  (toU64(io[at + 2]) << toU64(8)) |
                  ((toU64(io[at + 3]) << toU64(16)) | (toU64(io[at + 4]) << toU64(24))) |
                  ((toU64(io[at + 5]) << toU64(32)) |
                    (toU64(io[at + 6]) << toU64(40)) |
                    ((toU64(io[at + 7]) << toU64(48)) | (toU64(io[at + 8]) << toU64(56))))
              )
        spans[s + 1] = 0
        spans[s + 2] = 0
      }
      s += 3
      at += 9
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
    return new SqliteError(code, describe(code))
  }
}

/** Serial types 0 to 9's lengths in bytes (https://sqlite.org/fileformat2.html#record_format); 10 and 11 are reserved, and 12 up are `(t - 12) / 2`. */
const RECORD_SMALL_SIZES: readonly i32[] = [0, 1, 2, 3, 4, 6, 8, 8, 0, 0, 0, 0]

/**
 * A row as SQLite stores it, copied whole by `Cursor.record` and decoded
 * here: the record format's header of varints, one serial type a field, and
 * the fields' bytes after it. One `read` is one call into the adapter and one
 * copy, and the fields are then read from this object's own buffer, so a loop
 * that reads many columns of many rows pays for the record once a row rather
 * than once a column. It allocates only when a record is longer than its
 * buffer, which then grows to fit.
 *
 * Fields are the record's, in its order: a table row's columns as declared,
 * with NULL for an INTEGER PRIMARY KEY column, whose value is the row's key
 * (`Cursor.rowid`), and an index entry's key columns and then its rowid. A
 * record written before `ALTER TABLE ADD COLUMN` holds fewer fields than the
 * table has columns; `fields` says how many it holds.
 *
 *     const row = new RowRecord(256, 8)
 *     let on = cur.first().expect("first")
 *     while (on) {
 *       row.read(cur).expect("record")
 *       if (row.type(1) === SQLITE_TEXT) {
 *         console.log(String.fromBytes(row.buf, row.start(1), row.size(1)))
 *       }
 *       on = cur.next().expect("next")
 *     }
 */
export class RowRecord {
  /** The record's bytes, from 0 to `length`. */
  buf: u8[]
  /** How long the record last read is. */
  length: i32 = 0
  /** How many fields its header gives, at most the `maxFields` it was made with. */
  fields: i32 = 0
  /** Each field's serial type. */
  private types: i32[]
  /** Where each field's bytes start in `buf`. */
  private offs: i32[]

  /**
   * A decoder with a buffer of `capacity` bytes, which reads at most
   * `maxFields` fields of each record.
   *
   * @param capacity The buffer's first length, grown when a record is longer.
   * @param maxFields How many fields to decode; a record's fields past them are not read.
   */
  constructor(capacity: i32, maxFields: i32) {
    this.buf = capacity > 0 ? new Array<u8>(capacity) : new Array<u8>(0)
    this.types = maxFields > 0 ? new Array<i32>(maxFields) : new Array<i32>(0)
    this.offs = maxFields > 0 ? new Array<i32>(maxFields) : new Array<i32>(0)
  }

  /**
   * Copies `cur`'s current row and reads its header, as SQLite's own
   * `sqlite3VdbeRecordUnpack` reads it: the fields it would find and no
   * others, and a last field whose bytes would run past the record's end
   * reads as NULL.
   *
   * @param cur The cursor, on a row.
   * @returns `Ok()`, or `Err` with the code: `Cursor.record`'s, or
   *   `SQLITE_CORRUPT` for a header SQLite never writes (a varint past the
   *   record, a serial type past 2^31, or a header longer than the record),
   *   when `fields` is 0.
   */
  read(cur: Cursor): Result<void, i32> {
    this.length = 0
    this.fields = 0
    let r = cur.record(this.buf)
    if (r.isOk() && r.value > toI32(this.buf.length)) {
      const need: i32 = r.value
      if (need > 0) {
        this.buf = new Array<u8>(need)
      }
      r = cur.record(this.buf)
    }
    if (r.isErr()) {
      return Err(r.error)
    }
    if (r.value > toI32(this.buf.length)) {
      return Err(SQLITE_CORRUPT)
    }
    this.length = r.value
    return this.header() ? Ok() : Err(SQLITE_CORRUPT)
  }

  /** The varint at `at`, at most 5 bytes and below 2^31, with its length in `vlen`; -1 when there is none. */
  private vlen: i32 = 0
  private varint(at: i32): i64 {
    const b: u8[] = this.buf
    let v: i64 = 0
    let k: i32 = at
    let n: i32 = 0
    while (n < 5 && k >= 0 && k < this.length && k < toI32(b.length)) {
      const c: i32 = toI32(b[k])
      v = (v << toI64(7)) | toI64(c & 127)
      k = k + 1
      n = n + 1
      if (c < 128) {
        this.vlen = n
        return v <= toI64(2147483647) ? v : toI64(-1)
      }
    }
    return toI64(-1)
  }

  /** Reads the header of the record in `buf` into `types` and `offs`; false when it is not one SQLite writes. */
  private header(): boolean {
    if (this.length === 0) {
      return true
    }
    const h: i64 = this.varint(toI32(0))
    if (h < toI64(0) || h > toI64(this.length)) {
      return false
    }
    const hdr: i32 = toI32(h)
    let idx: i32 = this.vlen & 7
    // `d` is where the next field's bytes start; a field longer than 2^31
    // leaves the record behind, which the loop's test finds.
    let d: i64 = h
    let u: i32 = 0
    const types: i32[] = this.types
    const offs: i32[] = this.offs
    const sizes: readonly i32[] = RECORD_SMALL_SIZES
    for (let k: i32 = 0; k >= 0 && k < toI32(types.length) && k < toI32(offs.length); k += 1) {
      if (idx >= hdr || d > toI64(this.length)) {
        break
      }
      const t: i64 = this.varint(idx)
      if (t < toI64(0)) {
        return false
      }
      // A varint is at most 5 bytes, so the mask keeps its length. `idx` is
      // below `hdr`, so only a header within 7 bytes of 2^31 could pass the
      // literal, which no record buffer reaches; the test is what proves the
      // sum, and a header that did would end the walk as a short one.
      if (idx > 2147483640) {
        return false
      }
      idx = idx + (this.vlen & 7)
      const ty: i32 = toI32(t)
      types[k] = ty
      // At most the record's length, checked above, so it is exact in an i32.
      const at: i32 = toI32(d)
      offs[k] = at
      let sz: i32 = 0
      if (ty >= 12) {
        sz = (ty - 12) >> 1
      } else if (ty >= 0 && ty < toI32(sizes.length)) {
        sz = sizes[ty] & 15
      }
      // Two i32s summed in i64, which cannot overflow.
      d = toI64(at) + toI64(sz)
      u = k + 1
    }
    if (d > toI64(this.length) && u > 0 && u <= toI32(types.length)) {
      types[u - 1] = 0
    }
    this.fields = u
    return true
  }

  /** Field `k`'s serial type, or 0 (NULL) past the fields read. */
  private serial(k: i32): i32 {
    if (k < 0 || k >= this.fields || k >= toI32(this.types.length)) {
      return 0
    }
    return this.types[k]
  }

  /**
   * Field `k`'s type, as `Cursor.columnType` answers it.
   *
   * @param k The field, from 0.
   * @returns `SQLITE_INTEGER`, `SQLITE_FLOAT`, `SQLITE_TEXT`, `SQLITE_BLOB`,
   *   or `SQLITE_NULL`, which a field past `fields` is too.
   */
  type(k: i32): i32 {
    const t: i32 = this.serial(k)
    if (t >= 12) {
      return (t & 1) === 1 ? SQLITE_TEXT : SQLITE_BLOB
    }
    if (t === 7) {
      return SQLITE_FLOAT
    }
    return t === 0 || t === 10 || t === 11 ? SQLITE_NULL : SQLITE_INTEGER
  }

  /**
   * Where field `k`'s bytes start in `buf`: a text's or a blob's first byte,
   * an integer's or a float's big-endian bytes.
   *
   * @param k The field, from 0.
   * @returns The offset in `buf`, or 0 past the fields read.
   */
  start(k: i32): i32 {
    if (k < 0 || k >= this.fields || k >= toI32(this.offs.length)) {
      return 0
    }
    return this.offs[k]
  }

  /**
   * How many bytes field `k` holds in `buf` from `start(k)`: a text's or a
   * blob's length, which is what a program copies or compares.
   *
   * @param k The field, from 0.
   * @returns The length for TEXT or BLOB, 0 for any other type.
   */
  size(k: i32): i32 {
    const t: i32 = this.serial(k)
    return t >= 12 ? (t - 12) >> 1 : 0
  }

  /**
   * Field `k`'s integer: big-endian, two's complement, as SQLite stores it.
   *
   * @param k The field, from 0.
   * @returns The value of an `SQLITE_INTEGER` field, 0 for any other type.
   */
  int(k: i32): i64 {
    const t: i32 = this.serial(k)
    if (t === 8 || t === 9) {
      return t === 8 ? toI64(0) : toI64(1)
    }
    if (t < 1 || t > 6) {
      return toI64(0)
    }
    return this.bigEndian(this.start(k), RECORD_SMALL_SIZES[t], true)
  }

  /**
   * Field `k`'s number as a float: an `SQLITE_FLOAT`'s IEEE 754 value, an
   * `SQLITE_INTEGER`'s value converted.
   *
   * @param k The field, from 0.
   * @returns The value, or 0 for TEXT, BLOB and NULL.
   */
  float(k: i32): f64 {
    if (this.serial(k) === 7) {
      return bitsToF64(this.bigEndian(this.start(k), toI32(8), false))
    }
    return toF64(this.int(k))
  }

  /** The `n` bytes at `at` as a big-endian integer, its sign from the first when `signed`; 0 when they lie outside the record. */
  private bigEndian(at: i32, n: i32, signed: boolean): i64 {
    const b: u8[] = this.buf
    if (
      n < 1 ||
      at < 0 ||
      at >= toI32(b.length) ||
      toI64(at) + toI64(n) > toI64(this.length) ||
      at > toI32(b.length) - n
    ) {
      return toI64(0)
    }
    const first: i32 = toI32(b[at])
    let v: i64 = signed && first >= 128 ? toI64(first - 256) : toI64(first)
    // Two i32s summed in i64, which cannot overflow; the window was checked
    // to lie inside `buf`.
    const stop: i64 = toI64(at) + toI64(n)
    for (let i: i32 = at + 1; i >= 0 && toI64(i) < stop && i < toI32(b.length); i += 1) {
      v = (v << toI64(8)) | toI64(b[i])
    }
    return v
  }
}
