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
decoded only by `sqlite3VdbeRecordUnpack` and compared only by
`sqlite3VdbeRecordCompare`, and values are read from the decoded `Mem`s
through the public `sqlite3_value_*` accessors.

Opening a database on SQLite's `unix-excl` VFS, which drops the per-transaction
file locks the rest of a short read pays for, is decided in
[sqlite-vfs.md](sqlite-vfs.md).

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
  countRange(lo: i64, hi: i64, out: i64[]): Result<i32, i32> // index cursor: entries per first key
  rowid(): i64
  columnType(n: i32): Result<i32, i32>
  columnI64(n: i32): i64
  columnInto(n: i32, buf: u8[], at: i32): Result<i32, i32>
  selectRow(cols: readonly i32[]): Result<void, i32>
  readRow(ints: i64[], spans: i32[], text: u8[]): Result<i32, i32>
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
- `countRange(lo, hi, out)` counts an index's entries whose first key column
  is `k`, for each `k` from `lo` to `hi`, into `out[k - lo]`, and answers their
  total. It is one seek and one forward walk inside the adapter, each entry's
  record compared with `k` by `sqlite3VdbeRecordCompare` and never unpacked; a
  key with no entries costs one `Mem` write and one record compare as the walk
  steps past it, and `out` holds 0 for it. On a full index it agrees with
  `SELECT count(*) … WHERE col = k` for every `k`, under an ascending or `DESC`
  first column; a partial index holds, and counts, only the rows its `WHERE`
  admits. Copying the counts into `out` takes one adapter call per key, and
  one more when `out` is longer than the span. It refuses with
  `Err(SQLITE_MISUSE)` on a table cursor, `Err(SQLITE_MISMATCH)` when the
  first key column's affinity is neither INTEGER nor NUMERIC (under TEXT
  affinity SQL's `col = k` compares as text), and `Err(SQLITE_RANGE)` when
  `lo > hi` or the span is longer than `out`; `out` is then left as it was,
  and so is every element past the span. A count
  that reaches its walk clears the seek key and leaves the cursor on no row,
  as a failed seek does, whatever it answers; a refusal, or `SQLITE_NOMEM` for
  its buffer, comes first and leaves both as they were.
- `selectRow(cols)` chooses the columns `readRow` reads, in that order and
  repeats allowed, once for every row after it: the `Cursor` keeps the list,
  with no adapter call. Over 65,535 columns is `MISUSE`, and a refused list
  leaves the one chosen before; it checks no index, so a column past the
  cursor's is `RANGE` from `readRow`.
- `readRow(ints, spans, text)` reads the chosen columns of the current row
  with one adapter call, in one pass over them. Column `cols[i]` answers its
  type in `spans[3i]`; an INTEGER or FLOAT its integer in `ints[i]` as
  `columnI64` reads it (the INTEGER PRIMARY KEY column its rowid); a TEXT or
  BLOB the offset and length of its bytes in `text` in `spans[3i + 1]` and
  `spans[3i + 2]`, each column's bytes after the one before. `ints[i]` is 0
  for TEXT, BLOB and NULL: unlike `columnI64`, `readRow` converts no TEXT or
  BLOB to a number, so a caller that wants `'42'` as 42 calls `columnI64`.
  Other types answer offset and length 0. It answers `Ok` with the bytes the
  row's columns hold, 0 for an empty list. When that is more than
  `text.length` it writes nothing to `ints` or `spans` (`text` may hold the
  columns that fit before it), so a caller grows `text` and calls again. A
  refusal is the code `columnType` answers for the first column it refuses
  (`RANGE`, `SCHEMA`, or `MISUSE` with no row or a closed cursor), and
  writes nothing to `ints` or `spans`, though `text` may hold the bytes of
  the columns before it; no `selectRow` before it, `ints` shorter than the
  list or `spans` shorter than 3 per column is `MISUSE`, and over 2^31 - 1
  bytes is `TOOBIG`. On the feed
  walk it replaces a post's four column calls (three on the post, one on its
  author) with two
  ([docs/BENCHMARKS.md](BENCHMARKS.md#one-call-per-row-readrow) has what that
  measured).
- A cursor call on a closed, stale or invalidated cursor answers `MISUSE`
  (`Err(SQLITE_MISUSE)`, or 0 from `rowid` and `columnI64`). So does `next` or
  `previous` when the cursor has no current row, and a column read then.

## Transactions and invalidation

A cursor reads one snapshot, so it lives inside a read transaction:

- `db.beginRead()` runs `BEGIN` and then a read of `sqlite_schema`, so the main
  database's read transaction is current (`sqlite3_txn_state(db, "main")` is
  `SQLITE_TXN_READ`) and the snapshot and schema it reads are fixed.
- `db.openCursor` answers `MISUSE` unless the main database is in a read
  transaction: autocommit off (`sqlite3_get_autocommit(db) == 0`) and
  `sqlite3_txn_state(db, "main") >= SQLITE_TXN_READ`. A deferred `BEGIN` that
  has not read yet is therefore refused too.
- `db.endRead()` closes every cursor on the connection, then runs `COMMIT`.
- `beginRead` does not make the transaction read-only. A write run inside it
  invalidates the cursors like any other write, and `endRead`'s `COMMIT`
  commits it.

A raw B-tree cursor is not counted by SQLite's statement bookkeeping
(`nVdbeRead`, `nVdbeActive`), so a `COMMIT` or `ROLLBACK` run while one is open
would end the transaction under it, and a write would move pages under it. The
adapter therefore **invalidates** every cursor on a connection, closing its
`BtCursor` and freeing it (its handle then answers `MISUSE`), *before*
anything other than a plain read runs:

- **The adapter owns the connection's authorizer.** `nishsqlite_open` installs
  one with `sqlite3_set_authorizer`; `nish/sqlite` exposes no authorizer of its
  own. At `nishsqlite_prepare` the callback classifies the statement: it is a
  plain read only if it authorized `SQLITE_SELECT` and every action it
  authorized is on an allowlist (`SQLITE_SELECT`, `SQLITE_READ`,
  `SQLITE_FUNCTION`, `SQLITE_RECURSIVE`). Anything else — `SQLITE_TRANSACTION`,
  `SQLITE_SAVEPOINT`, every write, DDL, `PRAGMA`, `ATTACH`, `ANALYZE`, or a
  statement that authorized nothing, such as `VACUUM` — makes it a statement
  that invalidates. A `SELECT` from a `pragma_*` table-valued function
  authorizes `SQLITE_PRAGMA`, so it invalidates too.
- **`nishsqlite_step` invalidates** before it steps a statement that is not a
  plain read.
- **`nishsqlite_exec` invalidates** before it runs anything: it answers no rows,
  so a plain read through it has no use, and it runs `db.begin`, `db.commit`
  and `db.rollback`.
- **A re-prepare cannot slip past.** When `sqlite3_step` re-prepares a statement
  after a schema change, the authorizer runs again; outside the adapter's own
  prepare, an action off the allowlist invalidates on the spot.
- **An end the adapter did not start is caught.** SQLite rolls the whole
  transaction back by itself when a statement fails with `SQLITE_NOMEM`,
  `SQLITE_IOERR` or `SQLITE_FULL`, a plain `SELECT` included. `nishsqlite_open`
  installs a rollback hook (`sqlite3_rollback_hook`) that SQLite calls at the
  end of every rollback of the transaction, and it invalidates the cursors. A
  C helper whose allocator refuses large blocks while one `SELECT` runs checks
  that its cursor then answers `MISUSE`; without the hook the cursor goes on
  reading rows.

Since every route that ends the read invalidates as it does so, a cursor whose
slot is live is inside its read. A cursor call therefore checks one thing: that
its handle names a live slot (`slot_of`, an index and a generation compare). It
reads no transaction state. A handle carried to another thread under
`--threads` indexes that thread's own table: it names that thread's cursor of
the same index and generation if there is one (a thread's first cursor has the
same handle value as another's), and otherwise answers `MISUSE`, never reaching
the first thread's memory. The same helper checks the `MISUSE` answer on a
thread that has opened no cursor, and that a closed connection's cursor handle
names none of a later connection's cursors.

The adapter's own statements (the schema check, `beginRead`'s `BEGIN` and
read) run with the callback told they are internal, so they do not invalidate
the cursors they serve.

A build with `-DSQLITE_DEBUG` (SQLite's assertions on) runs
`tests/link/std_sqlite_cursor_stale` without an assertion failure; a test pins
it.

Every cursor entry point holds the connection's `db->mutex` as SQLite's own API
functions do, since the internal functions it calls expect it held. The cursor
keeps the mutex (`sqlite3_db_mutex`, read when it opens), so a call looks its
handle up once and then enters and leaves the mutex around the work. The mutex
is recursive, and NULL (a no-op) in the default `THREADSAFE=0` build and under
`--threads` (`THREADSAFE=2`). A `SQLITE_DEBUG`, `THREADSAFE=1` build of the
adapter with a C helper that walks, reads and seeks asserts it; a test pins it.

## The schema check

At `openCursor`, inside the read transaction, through the public API on the
same connection:

1. `PRAGMA main.encoding` must answer `UTF-8`: text is read as bytes and keys
   are compared as bytes.
2. `SELECT type, rootpage, tbl_name FROM main.sqlite_schema WHERE name = ?1`
   finds the object, which must be a `table` or an `index` with a root page
   above 0. The root page comes from this row, never from the caller.
3. `SELECT type, wr FROM pragma_table_list WHERE schema = 'main' AND name = ?1`,
   on the table (or the index's table), must answer `type = 'table'` and
   `wr = 0`: not a view, a virtual table or a `WITHOUT ROWID` table.
4. For a table, `pragma_table_xinfo` lists its columns; for an index,
   `pragma_index_xinfo` lists its key columns and then the rowid, with each
   one's `desc` and collation. `pragma_index_list(table)` says whether a
   table's primary key is an index (`origin = 'pk'`).

The open is refused with `SqliteError` and `SQLITE_SCHEMA` when:

- the name is missing, or names a view, a trigger, a virtual table or a
  `WITHOUT ROWID` table (or an index on one);
- the declared names differ from the schema's in any name, in their order or in
  their count; for an index, `DESC` is written exactly where `index_xinfo` says
  `desc`, and the last name is `rowid`;
- a table has a generated column (`hidden` 2 or 3), or an index has an
  expression column (`cid` -2) or a collation other than `BINARY`;
- a schema name holds a comma or ends in ` DESC`, which the joined list could
  not tell apart from a separator or a sort flag;
- the database's encoding is not UTF-8.

A column of a table is the rowid's alias when the table's primary key is that
single column and no index implements it (`index_list` has no `origin = 'pk'`
row): that is how SQLite itself decides, `INTEGER PRIMARY KEY DESC` included.

### Kept shapes

The check costs seven queries, so a connection keeps the last eight shapes it
passed: the name and declared columns, the root page, the alias column and,
for an index, its `KeyInfo` (one reference, `sqlite3KeyInfoRef`). Each is
stamped with the schema cookie it was checked under, read from the `main`
B-tree with `sqlite3BtreeGetMeta(BTREE_SCHEMA_VERSION)`. An open answers from
a kept shape only when the `main` transaction is `SQLITE_TXN_READ` and the
cookie is the shape's; a miss runs the check and keeps the result, replacing
the entries in turn. A write transaction's open runs the check and keeps
nothing: its cookie may belong to a schema it later rolls back, and a
committed change of as many DDL statements reaches the same cookie. This is
SQLite's own test of whether a prepared statement still matches the schema.
`nishsqlite_close` releases the kept references under the connection's mutex.

`beginRead` and `endRead` prepare their `BEGIN`, schema read and `COMMIT`
once per connection (`SQLITE_PREPARE_PERSISTENT`) and reset them after each
run. On `bench/sqlite`'s database, one read transaction per call, that took a
point lookup from 72.0 to 6.2 µs and a feed read from 84.5 to 16.1 µs; the same
work through SQL in autocommit takes 5.9 and 19.1 µs.

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
| seek key affinity | a key part is compared as given, with no column affinity: `keyText("5")` on an INTEGER column sorts after every number, as SQLite's text sorts after its integers |

## Memory

Per cursor, allocated at open and freed at close: one `sqlite3_malloc64`
block holding the cursor, its `BtCursor` (`sqlite3BtreeCursorSize` bytes,
zeroed with `sqlite3BtreeCursorZero`) and the `Mem`s of its seek key
(`sqlite3VdbeMemInit`) and the `UnpackedRecord` a seek hands SQLite over
them, filled once at open; the `KeyInfo` (`sqlite3KeyInfoAlloc`); and one
`UnpackedRecord` for the current row (`sqlite3VdbeAllocUnpackedRecord`). A
seek on integer key parts sets those `Mem`s and the record's few per-seek
fields, and allocates nothing. A
count buffer (`sqlite3_realloc64`) is allocated by the first `countRange`,
grows to the longest span asked (never past `out.length`), and is kept. A payload
buffer (`sqlite3_realloc64`) is allocated only when a record is not wholly on
its page, grows geometrically, and keeps 18 zeroed bytes past the record, the
slack SQLite's record decoder may read past a corrupt record's end. The current row is
unpacked lazily, on the first column read after a move, and cached until the
cursor moves. A steady-state row loop therefore allocates nothing; a test
reads 10,000 rows under `SQLITE_DEFAULT_MEMSTATUS=1` and checks that SQLite's
memory high-water mark does not move. Another
(`tests/link/std_sqlite_cursor_count`, linked with
`SQLITE_DEFAULT_MEMSTATUS=1`) pins `countRange`'s buffer reuse: a second pass
of integer seeks and range counts leaves SQLite's memory in use and its
high-water mark where the first pass left them. `selectRow` allocates the `Cursor`'s
byte buffer, 11 bytes a column: the list's indices, 2 bytes each, then a
9-byte slot each for `readRow`'s answers. It allocates once per
`selectRow`; `readRow` then copies text and blob bytes into the caller's
`text` and allocates nothing. A test walks 2,000 rows, one in four
on overflow pages, with `readRow` twice after a first pass and checks the
same high-water mark, which counts SQLite's allocator only, not the Nish
heap.

`nishsqlite_close` closes a connection's cursors before its statements.

## What the adapter calls

SQLite's internal functions are `static` in the amalgamation
(`SQLITE_PRIVATE`), so the adapter can call them only from the same
translation unit. The calls, all of them:

- B-tree: `sqlite3DbNameToBtree`, `sqlite3BtreeCursorSize`,
  `sqlite3BtreeCursorZero`, `sqlite3BtreeCursor`, `sqlite3BtreeCloseCursor`,
  `sqlite3BtreeCursorHasMoved`, `sqlite3BtreeGetMeta`,
  `sqlite3BtreeFirst`, `sqlite3BtreeLast`, `sqlite3BtreeNext`,
  `sqlite3BtreePrevious`, `sqlite3BtreeEof`, `sqlite3BtreeTableMoveto`,
  `sqlite3BtreeIndexMoveto`, `sqlite3BtreeIntegerKey`,
  `sqlite3BtreePayloadSize`, `sqlite3BtreePayloadFetch`, `sqlite3BtreePayload`.
- Schema: `sqlite3FindIndex` and `sqlite3TableColumnAffinity`, at open, for the
  affinity of an index's first key column, which `countRange` checks.
- Records and keys: `sqlite3KeyInfoAlloc`, `sqlite3KeyInfoRef`,
  `sqlite3KeyInfoUnref`,
  `sqlite3VdbeAllocUnpackedRecord`, `sqlite3VdbeRecordUnpack`,
  `sqlite3VdbeRecordCompare`,
  `sqlite3VdbeMemInit`, `sqlite3VdbeMemSetInt64`, `sqlite3VdbeMemSetStr`,
  `sqlite3VdbeMemSetNull`, `sqlite3VdbeMemRelease`, `sqlite3DbFree`.
- Public API: `sqlite3_set_authorizer`, `sqlite3_rollback_hook`,
  `sqlite3_get_autocommit`,
  `sqlite3_txn_state`, `sqlite3_db_mutex`, `sqlite3_mutex_enter`,
  `sqlite3_mutex_leave`, `sqlite3_malloc64`, `sqlite3_realloc64`,
  `sqlite3_free`, the `sqlite3_value_*` accessors, and the statement and
  `sqlite3_str` API for the schema check (with `sqlite3_prepare_v3` for
  `beginRead`'s and `endRead`'s kept statements).

`readRow` (`nishsqlite_cursor_read_row`) calls nothing the per-column reads
do not: it calls the adapter's own `columnType`, `columnI64` and
`columnInto` functions for each chosen column, under the connection's
mutex, which is recursive. `selectRow` calls no adapter function.

What it writes, all of it: its own allocations, and the caller's buffers a
`readRow` passes; in the `KeyInfo` it allocated,
`aSortFlags` (the per-column `DESC` flags `sqlite3KeyInfoAlloc` leaves zero,
the way SQLite's own code generator fills them; `aColl` stays zero, which is
`BINARY`); in the row's `UnpackedRecord`, `nField`, which SQLite's caller
sets before an unpack; and the cursor's seek `UnpackedRecord`, zeroed at open
and given `pKeyInfo` and `aMem` then, and `nField`, `default_rc`, `errCode` and
`eqSeen` before each seek or count, as the VDBE's `OP_SeekGE` fills its own.
It writes no member of `BtCursor`, `Btree`, `BtShared`, `Mem` (only through
`sqlite3VdbeMem*`) or `sqlite3`.

The seek follows `OP_SeekGE`/`OP_SeekGT`/`OP_SeekLE`/`OP_SeekLT`:
`sqlite3BtreeIndexMoveto` with `default_rc` +1 for GE and LT and -1 for GT and
LE, then one `sqlite3BtreeNext` or `sqlite3BtreePrevious` when the cursor
landed on the wrong side.

`countRange` seeks the same way to the first entry at or after `lo` (`hi`
under `DESC`), sets `default_rc` to 0, and walks with `sqlite3BtreeNext`. Each
entry's record (`sqlite3BtreePayloadFetch`, or copied as a column read copies
it) is compared with the one-value key: equal counts it, after it moves `k` on
in index order and compares again, and past the last `k` the walk ends. A
NULL sorts before every number and a TEXT or BLOB after, so neither is
counted, and a REAL compares with `k` by value; `col = k` counts the same.

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
entry and then two cached links; seconds, wall clock, 4-core cloud container).
Before is `4d0faa4b` (SQLite compiled as its own unit); after is `3765b270`
(SQLite compiled inside the adapter, cursors included):

| Profile | Before, cold | Before, cached | After, cold | After, cached |
| --- | --- | --- | --- | --- |
| debug | 2.64 | 0.21–0.23 | 2.81 | 0.24–0.27 |
| speed | 27.6 | 0.28–0.29 | 28.0 | 0.31–0.34 |

A cold link is one sample per profile; an earlier after-run at the same code
took 2.72 s (debug) and 26.73 s (speed). For speed, the cold difference is
inside the spread of single runs. For debug it is not: the before sample is
below both after samples, so the cold debug link measured about 0.1 s slower.
The cached ranges do not overlap either: a cached link measured about 0.03
to 0.05 s slower in both profiles, and is under 0.35 s in both.

`bench/sqlite/run.mjs` before (`4d0faa4b`) and after (`3765b270`), median
ns per call over 12 rounds. The bench reads only through the VDBE (prepared
statements); it is here to check that compiling SQLite inside the adapter did
not move that path. Each run's checksums match. "Band" is the run's own noise
band (the build timed against a copy of itself, median):

| Workload | Nish | C | Nish − C | Band | Nish, after | C, after | Nish − C, after | Band, after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lookup | 6631 | 6529 | +1.6% | 0.7% | 7187 | 7435 | −3.3% | 0.8% |
| feed | 22246 | 22966 | −3.1% | 0.8% | 22490 | 21990 | +2.3% | 20.5% |
| insert | 21149 | 22899 | −7.6% | 3.2% | 23320 | 23269 | +0.2% | 1.1% |
| insert-txn | 6987 | 6526 | +7.1% | 6.3% | 7053 | 7232 | −2.5% | 0.5% |

Absolute figures move between the two runs on this container by more than
either run's band: the C program, which this change does not touch, is 14%
slower in the after run on lookup and 4% faster on feed (it builds
`sqlite3.c` and `twin.c` itself, not through the adapter). So the comparison
is Nish against C within one run. That gap moved by −4.9, +5.4, +7.8 and −9.6
points, in both directions, and on lookup, insert and insert-txn by more than
either run's band. The check finds no consistent slowdown of the VDBE path; it does not
bound a change smaller than the run-to-run spread.

## Out of scope

Writes through cursors; seeking on REAL keys or non-BINARY collations; a cursor
on an attached database; `WITHOUT ROWID` tables; the wasm profile, which stays
refused (`--threads` and the napi build keep working).
