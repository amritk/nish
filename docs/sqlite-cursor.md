# Reading SQLite through B-tree cursors

`nish/sqlite` answers every query through SQLite's virtual machine (the VDBE):
prepare, bind, step, read columns. For a hot read such as a feed of the newest
posts, the VDBE's opcode loop is a large part of the cost. This note describes
a second way to read a table or index from `nish/sqlite`: a cursor on SQLite's
own B-tree, moved and read through SQLite's own internal functions, with no
VDBE program in between.

The rule that bounds the whole design: **SQLite stays unmodified, and the
adapter only calls SQLite's functions.** It does not patch `sqlite3.c`. It does
not read the database file format or the record format itself. It never writes
a `BtCursor` member, and it reads none except through a function. Records are
decoded only by `sqlite3VdbeRecordUnpack`, and values are read from the decoded
`Mem`s through the public `sqlite3_value_*` accessors.

## The surface

A `Cursor` is an `i32` handle, like `Database` and `Statement`. Every call
answers a bare scalar or a `Result` whose payloads are `i32`s, which a Nish
function returns in registers, so a row loop allocates nothing.

```ts
db.beginRead(): Result<void, i32>     // BEGIN, then start the main database's read transaction
db.endRead(): Result<void, i32>       // close every cursor on the connection, then COMMIT
db.openCursor(name: string, columns: string): Result<Cursor, SqliteError>
//   db.openCursor("posts", "id,user_id,body,created_at")
//   db.openCursor("posts_created_at_id_idx", "created_at DESC,id DESC,rowid")

class Cursor {
  first(): Result<boolean, i32>       // Ok(true) on a row, Ok(false) when there is none
  last(): Result<boolean, i32>
  next(): Result<boolean, i32>        // Ok(false) past the end
  previous(): Result<boolean, i32>    // Ok(false) before the start
  seekRowid(rowid: i64): Result<boolean, i32>   // table cursor: Ok(true) when the row exists
  keyReset(): Result<void, i32>       // index cursor: start a new key prefix
  keyI64(v: i64): Result<void, i32>   // append an integer to the prefix
  keyText(s: string): Result<void, i32>
  keyTextBytes(buf: readonly u8[], off: i32, len: i32): Result<void, i32>
  seek(op: i32): Result<boolean, i32> // SEEK_GE | SEEK_GT | SEEK_LE | SEEK_LT on the prefix
  rowid(): i64
  columnType(n: i32): Result<i32, i32>
  columnI64(n: i32): i64
  columnInto(n: i32, buf: u8[], at: i32): Result<i32, i32>
  close(): Result<void, i32>
}
```

- `columns` names the columns the caller reads, in the schema's order, as one
  comma-separated string. Column `n` of a cursor is the `n`th name in it. For an
  index, the key columns come first, each with `DESC` where the index has it,
  and then `rowid`.
- `rowid()` answers the current row's rowid: the key of a table cursor, the last
  field of an index record. It answers 0 when the cursor has no row.
- `columnType(n)` answers what the record stores (`SQLITE_INTEGER`,
  `SQLITE_FLOAT`, `SQLITE_TEXT`, `SQLITE_BLOB`, `SQLITE_NULL`), or `Err` with
  the code of why the column cannot be read. `columnI64(n)` answers the value as
  an integer, and 0 for any column `columnType` refuses: a caller that can meet
  a missing column reads `columnType` first. `i64` is not returned in a
  `Result` because a `Result<i64, i32>` is a heap value in Nish.
- `columnInto(n, buf, at)` has `Statement.columnInto`'s contract: it copies a
  TEXT or BLOB value's bytes into `buf` at `at` only when they fit, and answers
  their length either way, so a caller whose buffer is too small grows it and
  calls again. A NULL is 0 bytes. An INTEGER or FLOAT is `Err(SQLITE_MISMATCH)`:
  turning a number into text would allocate inside SQLite, and `columnI64`
  reads it.
- A cursor call on a closed, stale or invalidated cursor answers `MISUSE`
  (`Err(SQLITE_MISUSE)`, or 0 from `rowid` and `columnI64`). So does `next` or
  `previous` when the cursor has no current row, and a column read then.

## Transactions and invalidation

A cursor reads one snapshot, so it lives inside a read transaction:

- `db.beginRead()` runs `BEGIN` and then a read of `sqlite_schema`, so the main
  database's read transaction is current (`sqlite3_txn_state(db, "main")` is
  `SQLITE_TXN_READ`) and the snapshot and schema it reads are fixed.
- `db.openCursor` outside a transaction (`sqlite3_get_autocommit(db) != 0`)
  answers `MISUSE`.
- `db.endRead()` closes every cursor on the connection, then runs `COMMIT`.

A raw B-tree cursor is not counted by SQLite's statement bookkeeping
(`nVdbeRead`, `nVdbeActive`), so a `COMMIT` or `ROLLBACK` run while one is open
would end the transaction under it, and a write would move pages under it. The
adapter therefore **invalidates** every cursor on a connection, closing its
`BtCursor` and bumping the connection's cursor epoch, *before* anything other
than a plain read runs:

- **The adapter owns the connection's authorizer.** `nishsqlite_open` installs
  one with `sqlite3_set_authorizer`; `nish/sqlite` exposes no authorizer of its
  own. At `nishsqlite_prepare` the callback classifies the statement: it is a
  plain read only if it authorized `SQLITE_SELECT` and every action it
  authorized is on an allowlist (`SQLITE_SELECT`, `SQLITE_READ`,
  `SQLITE_FUNCTION`, `SQLITE_RECURSIVE`). Anything else — `SQLITE_TRANSACTION`,
  `SQLITE_SAVEPOINT`, every write, DDL, `PRAGMA`, `ATTACH`, `ANALYZE`, or a
  statement that authorized nothing, such as `VACUUM` — makes it a statement
  that invalidates.
- **`nishsqlite_step` invalidates** before it steps a statement that is not a
  plain read.
- **`nishsqlite_exec` invalidates** before it runs anything: it answers no rows,
  so a plain read through it has no use, and it runs `db.begin`, `db.commit`
  and `db.rollback`.
- **A re-prepare cannot slip past.** When `sqlite3_step` re-prepares a statement
  after a schema change, the authorizer runs again; outside the adapter's own
  prepare, an action off the allowlist invalidates on the spot.
- **An end the adapter did not see is caught.** If SQLite rolls the transaction
  back by itself (an I/O error or out-of-memory during a read), it trips every
  cursor on the B-tree, ours included. Every cursor call also checks
  `sqlite3_get_autocommit(db)` and invalidates when the transaction is gone.

The adapter's own statements (the schema check, `beginRead`'s `BEGIN` and
read) run with the callback told they are internal, so they do not invalidate
the cursors they serve.

A build with `-DSQLITE_DEBUG` (SQLite's assertions on) runs the same sequences
— a cursor open across `db.exec("COMMIT")`, `db.commit()`, `db.rollback()`, an
`INSERT` and `endRead` — without an assertion failure; a test pins it.

## The schema check

At `openCursor`, inside the read transaction, through the public API on the
same connection:

1. `PRAGMA encoding` must answer `UTF-8`: text is read as bytes and keys are
   compared as bytes.
2. `SELECT type, rootpage, tbl_name, sql FROM sqlite_schema WHERE name = ?1`
   finds the object. The root page comes from this row, never from the caller.
3. For a table, `PRAGMA table_xinfo(name)` lists its columns; for an index,
   `PRAGMA index_xinfo(name)` lists its key columns and then the rowid, with
   each one's `desc` and collation. `PRAGMA index_list(table)` says whether a
   table's primary key is an index (`origin = 'pk'`).

The open is refused with `SqliteError` and `SQLITE_SCHEMA` when:

- the name is missing, or names a view, a trigger, a virtual table
  (`CREATE VIRTUAL TABLE` in its `sql`, root page 0) or a `WITHOUT ROWID` table
  (or an index on one, which `index_xinfo` lists without a rowid);
- the declared names differ from the schema's in any name, in their order or in
  their count; for an index, `DESC` is written exactly where `index_xinfo` says
  `desc`, and the last name is `rowid`;
- a table has a generated column (`hidden` 2 or 3), or an index has an
  expression column (`cid` -2) or a collation other than `BINARY`;
- the database's encoding is not UTF-8.

A column of a table is the rowid's alias when the table's primary key is that
single column and no index implements it (`index_list` has no `origin = 'pk'`
row): that is how SQLite itself decides, `INTEGER PRIMARY KEY DESC` included.

## The traps

| Trap | Rule |
| --- | --- |
| INTEGER PRIMARY KEY alias | the record stores NULL in its place: the alias column answers the rowid, as `SQLITE_INTEGER` |
| record shorter than the table (`ALTER TABLE ADD COLUMN`) | a column past the end of the record answers `Err(SQLITE_SCHEMA)` (0 from `columnI64`), never the column's default |
| index rowid | the last field of an index record: `rowid()` on an index cursor answers it, as does the declared `rowid` column |
| DESC index columns | the cursor's `KeyInfo.aSortFlags` follow `index_xinfo`'s `desc`, so a seek compares as the index sorts |
| overflow payload | `sqlite3BtreePayloadFetch` gives only the part on the B-tree page: when it is shorter than `sqlite3BtreePayloadSize`, `sqlite3BtreePayload` copies the whole record into the cursor's buffer |
| REAL affinity holding an integer | the record stores an integer: `columnType` answers `SQLITE_INTEGER` and `columnI64` its value |
| text read | `sqlite3_value_blob` + `sqlite3_value_bytes`, never `sqlite3_value_text`, which can convert and allocate |

## Memory

Per cursor, allocated once at open with `sqlite3_malloc64`/`sqlite3DbMallocRaw`
and freed at close: the `BtCursor` (`sqlite3BtreeCursorSize` bytes, zeroed with
`sqlite3BtreeCursorZero`), the `KeyInfo` (`sqlite3KeyInfoAlloc`), one
`UnpackedRecord` for reading the current row and one for building seek keys
(`sqlite3VdbeAllocUnpackedRecord`). A payload buffer is allocated only when a
record is not wholly on its page, and grows geometrically. The current row is
unpacked lazily, on the first column read after a move, and cached until the
cursor moves. A steady-state row loop therefore allocates nothing; a test
reads 10,000 rows under `SQLITE_DEFAULT_MEMSTATUS=1` and checks that SQLite's
memory high-water mark does not move.

`nishsqlite_close` closes a connection's cursors before its statements.

## What the adapter calls

SQLite's internal functions are `static` in the amalgamation
(`SQLITE_PRIVATE`), so the adapter can call them only from the same
translation unit. The calls, all of them:

- B-tree: `sqlite3DbNameToBtree`, `sqlite3BtreeCursorSize`,
  `sqlite3BtreeCursorZero`, `sqlite3BtreeCursor`, `sqlite3BtreeCloseCursor`,
  `sqlite3BtreeFirst`, `sqlite3BtreeLast`, `sqlite3BtreeNext`,
  `sqlite3BtreePrevious`, `sqlite3BtreeEof`, `sqlite3BtreeTableMoveto`,
  `sqlite3BtreeIndexMoveto`, `sqlite3BtreeIntegerKey`,
  `sqlite3BtreePayloadSize`, `sqlite3BtreePayloadFetch`, `sqlite3BtreePayload`.
- Records and keys: `sqlite3KeyInfoAlloc`, `sqlite3KeyInfoUnref`,
  `sqlite3VdbeAllocUnpackedRecord`, `sqlite3VdbeRecordUnpack`,
  `sqlite3VdbeMemInit`, `sqlite3VdbeMemSetInt64`, `sqlite3VdbeMemSetStr`,
  `sqlite3DbFree`.
- Public API: `sqlite3_set_authorizer`, `sqlite3_get_autocommit`,
  `sqlite3_txn_state`, `sqlite3_db_mutex`, `sqlite3_mutex_enter`,
  `sqlite3_mutex_leave`, the `sqlite3_value_*` accessors, and the statement API
  for the schema check.

What it writes, all of it: its own allocations; in the `KeyInfo` it allocated,
`aSortFlags` (the per-column `DESC` flags `sqlite3KeyInfoAlloc` leaves zero,
the way SQLite's own code generator fills them; `aColl` stays zero, which is
`BINARY`); and in the `UnpackedRecord`s it allocated, `nField` and
`default_rc`, which SQLite's caller sets before an unpack or a seek, as the
VDBE's `OP_SeekGE` does. It writes no member of `BtCursor`, `Btree`, `BtShared`,
`Mem` (only through `sqlite3VdbeMem*`) or `sqlite3`.

The seek follows `OP_SeekGE`/`OP_SeekGT`/`OP_SeekLE`/`OP_SeekLT`:
`sqlite3BtreeIndexMoveto` with `default_rc` +1 for GE and LT and -1 for GT and
LE, then one `sqlite3BtreeNext` or `sqlite3BtreePrevious` when the cursor
landed on the wrong side.

## The build decision

`runtime/sqlite/nish-sqlite.c` starts with `#include "sqlite3.c"`, and
`sqlite3.c` is no longer a unit of its own (otherwise every SQLite symbol would
be defined twice). `scripts/build.sh` and `src/run-cache.ts` (`sqliteUnits`)
compile every `.c` in `runtime/sqlite/` except `sqlite3.c`, so the one unit is
`nish-sqlite.c`. It is compiled as `sqlite3.c` was: a native object with
`-flto` stripped, the same `-DSQLITE_*` options and `NISH_SQLITE_CFLAGS`. The
cache fingerprint still covers every `.c` and `.h` there, `sqlite3.c`
included. No file is added to `runtime/sqlite/`, and `sqlite3.c` and
`sqlite3.h` keep the hashes in [its README](../runtime/sqlite/README.md).

The consequence: the adapter's wrappers (`nishsqlite_step`,
`nishsqlite_column_*`) no longer inline into the program under LTO, but
SQLite's own `sqlite3_column_*` and `sqlite3_step` now inline into them.

Link cost of `tests/link/sqlite_link/main.ts` (`--link`, a cold SQLite cache
entry and then two cached links; seconds, wall clock, 4-core cloud container),
before at `4d0faa4b`:

| Profile | First link | Cached link |
| --- | --- | --- |
| debug, before | 2.64 | 0.21–0.23 |
| speed, before | 27.6 | 0.28–0.29 |

The after figures and `bench/sqlite/run.mjs` before and after are recorded
with the commit that measured them in the pull request that lands this note.

## Out of scope

Writes through cursors; seeking on REAL keys or non-BINARY collations; a cursor
on an attached database; `WITHOUT ROWID` tables; the wasm profile, which stays
refused (`--threads` and the napi build keep working).
