# Security record: the SQLite amalgamation

The record of the SQLite that `nish build` links into a program that calls it
([runtime/sqlite/README.md](https://github.com/amritk/nish/blob/main/runtime/sqlite/README.md)). It says what is
vendored and from where, which inputs SQLite trusts and which are an
attacker's, the options it is compiled with, and how it is bumped for a CVE.
It is written when the C lands, not after an audit, so that an audit starts
from evidence.

`sqlite3.c` and `sqlite3.h` are as vendored at `46559bf`; the compile options
are named by the "SQLite's compile-time options" section of
`scripts/build.sh`.

**Result.** SQLite 3.54.1, byte for byte as upstream publishes it; no line of
it is patched. The review of the adapter found two Low findings: one is
fixed, one is open ([Findings](#findings)).

## Scope

| File | What |
| --- | --- |
| `runtime/sqlite/sqlite3.c` | The amalgamation, upstream 3.54.1, unchanged |
| `runtime/sqlite/sqlite3.h` | Its public header, upstream 3.54.1, unchanged |
| `runtime/sqlite/nish-sqlite.c` | The `nishsqlite_*` adapters `nish/sqlite` calls: handles, and the bounds of a buffer SQLite reads or writes; the B-tree cursors (`nishsqlite_cursor_*`, `nishsqlite_key_*`, `nishsqlite_begin_read`, `nishsqlite_end_read`) and the authorizer that invalidates them; the `#include "sqlite3.c"` that makes it SQLite's one unit |
| `std/sqlite.ts` | `nish/sqlite`, the module over the adapters, `Cursor` and `Database.beginRead`, `endRead`, `openCursor` among them |

Out of scope: the program's own SQL.

## The adapter

`nish/sqlite` never holds a C pointer. A connection or a statement is an `i32`
handle, `(generation << 16) | index` into a thread-local table, and every
adapter looks it up before it touches SQLite: an index past the table, an empty
slot or a stale generation is `SQLITE_MISUSE`, so a handle used after `close`
or `finalize`, or forged, reaches no freed or foreign object. Slot 0 is never
handed out, so the zero handle names nothing.

A freed slot's generation moves on, and a slot whose generation reaches 32,767,
the field's width, is retired rather than restarted, so no handle is ever
handed out twice and a stale one can never come to name a live object. A table
whose 65,535 slots are all live or retired answers `SQLITE_NOMEM`. Tests:
`tests/link/std_sqlite` (a handle after `close` and after `finalize`, a forged
handle).

The tables are per thread: a handle passed to another thread names nothing
there and answers `SQLITE_MISUSE`. A thread's tables are not freed when it
exits, so connections a thread leaves open stay allocated with their files
open; that is a leak, not a use after free, since no other thread can name
them.

Errors carry the connection's message only when SQLite set it. A code the
adapter answers without SQLite — `SQLITE_MISUSE`, `SQLITE_RANGE`, and
`SQLITE_NOMEM` from a full table or a value SQLite could not convert to text
in `columnInto` — takes `sqlite3_errstr`'s message for the code instead of the
connection's, which is still that of some earlier call.

A read of a column that is not there, or of any column when no row is current
(before the first `step`, or after the last), is answered before SQLite and
leaves the connection's message as it was. `close` frees the handle only when
`sqlite3_close_v2` succeeds, so a close that fails leaves the connection and
its message readable; its statements are already finalized. `columnText` reads
a value SQLite fails to convert under memory pressure as `null`, the same as
SQL `NULL` (SQL-2).

SQL text, file names and `bindText`'s string reach C as `const char *`, where
a NUL byte would end them early. The FFI checks each one before the call and
stops the program with the `ffi-nul` panic rather than passing a shortened
string (`tests/cases/panics_ffi_nul`); `bindTextBytes` and `bindBlob` take a
length and pass NUL bytes through.

The adapter bounds every buffer it is given with the buffer's length: a bind of
`buf[off, off + len)` outside `0..n` is `SQLITE_MISUSE` and binds nothing, and
`columnInto` copies only when the whole column fits after `at`, otherwise
answering the length it needs and writing nothing. Text and blobs are bound
`SQLITE_TRANSIENT`, so SQLite copies them and no Nish array is read after the
call returns. Tests: `tests/link/std_sqlite` (stale and forged handles, windows
out of range, a buffer too small).

### Cursors

A `Cursor` reads one table or index of `main` through SQLite's own B-tree
cursor and record decoder, called from the same unit
([docs/sqlite-cursor.md](https://github.com/amritk/nish/blob/main/docs/sqlite-cursor.md)). The adapter has no reader of
its own for the file format or the record format, and writes no field of
`BtCursor`, `Btree`, `BtShared`, `Mem` or `sqlite3`.

A cursor is an `i32` handle in its own slot table, with the generation scheme
above, and the slot records the connection that owns it. A closed, forged or
invalidated handle is `SQLITE_MISUSE`. `nishsqlite_close` frees a
connection's cursors before its statements and its `sqlite3`, so no handle
outlives the B-tree it reads.

A raw B-tree cursor is outside SQLite's statement bookkeeping, so the
transaction could end, or pages move, under it. The adapter frees every
cursor of a connection before that can happen:

- at `endRead`, before its `COMMIT`;
- in `nishsqlite_exec`, before it runs anything;
- in `nishsqlite_step`, before it steps a statement that is not a plain read.
  The authorizer `nishsqlite_open` installs classifies each statement at
  prepare: a plain read authorized `SQLITE_SELECT` and nothing but
  `SQLITE_SELECT`, `SQLITE_READ`, `SQLITE_FUNCTION` and `SQLITE_RECURSIVE`;
- in the authorizer itself, when an action off that list is authorized
  outside a prepare it classifies (a re-prepare inside `sqlite3_step`);
- in every cursor call (`cursor_of`), when `sqlite3_get_autocommit` is set or
  the `main` B-tree's transaction state is `SQLITE_TXN_NONE`: a rollback
  SQLite made by itself.

The authorizer never refuses an action; it only watches. A statement it
cannot classify as a plain read is treated as one that invalidates.

`openCursor` takes the root page from `sqlite_schema` on the same
connection, never from the caller. It refuses with `SQLITE_SCHEMA` an object
it cannot read as a plain rowid B-tree of known shape: a view, a trigger, a
virtual table and its shadow tables, a `WITHOUT ROWID` table or an index on
one, a generated column, an expression or non-`BINARY` index column, a
declared column list that differs from the schema's, and a database whose
encoding is not UTF-8.

A connection keeps up to eight shapes the check passed (name, declared
columns, root page, alias, the index's `KeyInfo`), each with the schema
cookie (`BTREE_SCHEMA_VERSION`, read with `sqlite3BtreeGetMeta`) it was
checked under. An open answers from a kept shape, without the check's
queries, only when the `main` transaction is `SQLITE_TXN_READ` and its cookie
equals the shape's; a shape is kept only from such an open, so its cookie is a
committed one. A write transaction's open always runs the check and keeps
nothing, so a DDL it rolls back, followed by as many DDL statements
committed, cannot bring a shape checked against the rolled-back schema back
under the same cookie. The cache is SQLite's own test of whether a prepared
statement still matches the schema; it does not cover a change to the file
made outside SQLite's locking, which a prepared statement does not catch
either. A kept `KeyInfo` holds one reference (`sqlite3KeyInfoRef`), released
at eviction and at `nishsqlite_close`, which frees it under the connection's
mutex.

`beginRead` and `endRead` run their `BEGIN`, schema read and `COMMIT` from
statements prepared once per connection (`SQLITE_PREPARE_PERSISTENT`) and
reset after each run; they are finalized at `nishsqlite_close`, before the
statement table. A schema change re-prepares them inside `sqlite3_step`
under the adapter's `internal` flag, which the authorizer passes without
classifying; no cursor is open then (`BEGIN` runs in autocommit, and
`endRead` frees its cursors before `COMMIT`).

Column reads are bounded twice. A column number outside the declared list is
`SQLITE_RANGE`, and one past the fields the row's record holds is
`SQLITE_SCHEMA`. `columnInto` and `keyTextBytes` bound the caller's buffer as
`columnInto` and `bindTextBytes` do: an `at` past the buffer, or a window
outside it, is `SQLITE_MISUSE`, and a value is copied only when it fits.

A record's length is read with `sqlite3BtreePayloadSize`. Over
`SQLITE_MAX_LENGTH` it is `SQLITE_CORRUPT`, which keeps the decoder's `u32`
offsets from wrapping. `sqlite3VdbeRecordUnpack` checks each field's start
against the record's length and sets the field that runs past the end to
NULL, so no value a read answers reaches past the record. On a corrupt
record it can still read a header varint and an 8-byte value past the end.

Where the decoded bytes lie:

- A record wholly on its page is decoded where it lies. That is the read
  SQLite's own VDBE and `sqlite3BtreeIndexMoveto` make, into the overrun area
  the page cache keeps after each page buffer.
- A record that spills onto overflow pages is copied whole with
  `sqlite3BtreePayload` into the cursor's buffer. 18 zeroed bytes are kept
  after it: the padding `sqlite3BtreeIndexMoveto` gives the copy it decodes.

A seek key is built only with `sqlite3VdbeMemSetInt64` and
`sqlite3VdbeMemSetStr` (text copied, `SQLITE_TRANSIENT`), and no more key
parts than the index has key columns: one more is `SQLITE_RANGE`.

Tests:

- `tests/link/std_sqlite_cursor`: the moves, the seeks and the column reads,
  checked against SQL, with 142 records spilling onto overflow pages; a
  closed cursor, a column out of range, an `at` past the buffer, a
  `keyTextBytes` window outside it, one key part too many, and a buffer too
  small.
- `tests/link/std_sqlite_cursor_stale`: a cursor open across `COMMIT`,
  `ROLLBACK`, `commit()`, `rollback()`, a write through `exec` and through a
  prepared statement, a prepared `ROLLBACK`, `endRead`, a `SELECT` on a
  `pragma_*` function and `close` answers `SQLITE_MISUSE`; so does one open
  inside a read across a prepared `UPDATE`, an `exec` `DELETE`, DDL through
  `exec` and a prepared statement, `SAVEPOINT` then `RELEASE` and a
  `PRAGMA x = y`, and a closed cursor's handle once a new cursor takes its
  slot. It runs again with `-DSQLITE_DEBUG`, so SQLite's assertions check the
  same sequences.
- `tests/link/std_sqlite_cursor_shapes`: a kept table and index shape read
  again; a kept shape refused after `ALTER TABLE ADD COLUMN` (same root page),
  a `DROP` then `CREATE`, another connection's `DROP` then `CREATE` on a file
  database, and a write transaction's two DDL statements that are rolled back
  and then matched by two committed ones; twelve shapes, past the eight kept,
  each read right twice over; and `close` with shapes kept. It runs again
  with `-DSQLITE_DEBUG`, whose assertions check that `close` frees the kept
  `KeyInfo` under the connection's mutex.
- `tests/link/std_sqlite_cursor_sql`: every walk of a table and an index in
  both directions, and each seek, checked row by row against the `SELECT`
  that answers the same question, with index keys and records on overflow
  pages and `NULL` keys.
- `tests/run.js` (`sqlite-link`): the adapter built with `-DSQLITE_DEBUG` and
  `THREADSAFE=1` under a C helper that calls every exported cursor and key
  function, so SQLite's assertions check that each holds the connection's
  mutex; and, with memory statistics on, two passes of index seeks and a
  backward walk over overflow rows that leave SQLite's memory in use and its
  high-water mark where the first pass left them.
- `tests/link/std_sqlite_cursor_schema`: each refused object, and a column
  whose name holds a comma or ends in ` DESC`. It runs again
  with `-DSQLITE_ENABLE_RTREE`, for an rtree table and its shadow table.
- `tests/link/std_sqlite_cursor_feed`: a feed read through four cursors,
  equal byte for byte to SQL's.

Untested: a read that answers `SQLITE_ABORT` because the row moved under the
cursor (`sqlite3BtreeCursorHasMoved`; the cursor stays open), `SQLITE_CORRUPT`
for an oversized record, and the `SQLITE_NOMEM` paths, each of which needs a
corrupt file or a failing allocator the suite has no harness for; the
invalidation by a re-prepare whose statement now authorizes an action off the
allowlist, which needs another connection to change the schema between a
prepare and its step; and the invalidation `cursor_of` makes when SQLite has
rolled the transaction back by itself, which needs an I/O error mid-read.

## Findings

| ID | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| SQL-1 | Low | `runtime/sqlite/nish-sqlite.c` (`slot_give`) | A freed slot's 15-bit generation wrapped back to 1, so after 32,767 reuses of one slot a stale handle named the live object then in it: a statement or connection the holder never opened. | **Fixed.** A slot whose generation reaches 32,767 is retired, never handed out again. |
| SQL-2 | Low | `std/sqlite.ts` (`columnText`) | `sqlite3_column_text` answers NULL both for SQL `NULL` and when converting the value to text runs out of memory, and `columnText` reads either as `null`. A program can take a value it failed to read for an empty column. `columnInto` tells the two apart and answers `SQLITE_NOMEM`. | **Open.** Telling them apart in `columnText` needs a `Result` answer, a change to the API. |

## Trust model

SQL text is the program's and is trusted: SQLite runs whatever statement it is
given, so a program that splices an attacker's string into SQL has handed them
the database. Values reach a statement through bound parameters, never through
its text.

A database file is not. A file from an untrusted source — a download, an
upload, anything another party could have written — is attacker input to
SQLite's parser, and SQLite's own guidance for it applies
([sqlite.org/security.html](https://sqlite.org/security.html)): open it with
`SQLITE_DBCONFIG_DEFENSIVE` set, which refuses the writes that can corrupt a
file (`PRAGMA writable_schema`, writes to shadow tables, direct page writes),
and run `PRAGMA quick_check` or `integrity_check` before trusting its content.
Loadable extensions are compiled out (below), so a database or a statement
cannot load code.

## Compile options

Every unit in `runtime/sqlite/` is compiled with:

| Option | Why |
| --- | --- |
| `SQLITE_DQS=0` | A double-quoted string is an identifier only, never a string literal |
| `SQLITE_DEFAULT_MEMSTATUS=0` | No memory statistics, and no mutex to keep them |
| `SQLITE_DEFAULT_WAL_SYNCHRONOUS=1` | `synchronous=NORMAL` in WAL mode |
| `SQLITE_LIKE_DOESNT_MATCH_BLOBS` | `LIKE` and `GLOB` do not match a blob |
| `SQLITE_MAX_EXPR_DEPTH=0` | No limit on expression depth: the parser does not count it |
| `SQLITE_OMIT_DEPRECATED` | No deprecated interface |
| `SQLITE_OMIT_PROGRESS_CALLBACK` | No progress callback |
| `SQLITE_OMIT_SHARED_CACHE` | No shared cache. The cursors rely on it: with a shared cache another connection could free pages under one, so `nish-sqlite.c` refuses to build without it (`#error`) |
| `SQLITE_USE_ALLOCA` | Scratch space on the stack where SQLite allows it |
| `SQLITE_OMIT_LOAD_EXTENSION` | No `load_extension`: nothing can load code |
| `SQLITE_THREADSAFE=0`, or `=2` with `--threads` | Single-thread mode, or multi-thread mode: no mutex guards a connection, so a program must not share one across threads (serialized mode is `1`); always `0` on wasi |

`NISH_SQLITE_CFLAGS` is appended, and a `-D` or `-U` in it for one of these
names replaces the default. A program built with it is compiled with what its
builder chose, and this record covers only the defaults.

`SQLITE_MAX_EXPR_DEPTH=0` removes the limit, so a deeply enough nested
expression recurses until the stack overflows and the process dies. Only SQL
text reaches the parser, and it is trusted, so this is recorded here rather
than as a finding. A program that runs SQL it did not write rebuilds with
`NISH_SQLITE_CFLAGS=-DSQLITE_MAX_EXPR_DEPTH=1000` (SQLite's default); that is
the only mitigation. `sqlite3_limit(db, SQLITE_LIMIT_EXPR_DEPTH, n)` has no
effect in the default build: the height check and every `nHeight` update sit
under `#if SQLITE_MAX_EXPR_DEPTH>0` (`sqlite3ExprCheckHeight` at
`sqlite3.c:23070` is an empty macro otherwise), so the runtime limit is never
read.

`HAVE_USLEEP` is not defined, and need not be. In 3.54.1 the default busy
handler (`sqliteDefaultBusyCallback`, `sqlite3.c:190106`) and `unixSleep`
(`sqlite3.c:47805`) key on `HAVE_NANOSLEEP`, which is on unless a build defines
it to `0`. The default build therefore backs off in 1 to 100 ms steps, and
`PRAGMA busy_timeout` honours a timeout under a second. The whole-second
handler returns `SQLITE_BUSY` at once for any such timeout. A SQLite bump or a
changed default that brings it back fails "link/sqlite_busy_backoff"
(`tests/link/sqlite_busy_backoff`): a second connection that waits 300 ms on an
exclusive lock must give up after at least 250 ms.

## Bumping for a CVE

Follow "Updating" in [runtime/sqlite/README.md](https://github.com/amritk/nish/blob/main/runtime/sqlite/README.md):
it lists every file the version lives in and the sections to run. Then update
the version and the commit in this record, and the version in
`docs/guide/using-nish/cli.md`. The changed sources change the SQLite cache
key, so every program relinks against the new objects.

## Not yet covered by the scope check

`scripts/security-scope.mjs` reads top-level `runtime/*.c` and does not descend
into `runtime/sqlite/`, so it does not yet require these files to be named
here. Widening its surface is a `scripts/` change for a later pull request.

## Tests

Besides the cursor tests under [Cursors](#cursors):

`tests/link/sqlite_busy_backoff` pins the lock-wait backoff above
("link/sqlite_busy_backoff: exits with 0 and stdout matches expected.out").

In `tests/run.js`, section `sqlite-link`:

- "sqlite-link: runtime/sqlite/README.md records the SHA3-256 of sqlite3.c and sqlite3.h as they are"
  — the vendored files are the ones the README's hashes name, so an edit to
  either fails it.
- "sqlite-link: NISH_SQLITE_CFLAGS=-DSQLITE_THREADSAFE=1 compiles runtime/sqlite/ alone again, into a new entry, and replaces the default"
  — a builder's option replaces the default rather than joining it.
- "sqlite-link: a program that does not call SQLite compiles no C, adds no entry and links no SQLite symbol"
  — a program that never names SQLite carries none of its code.
- "sqlite-link: a string constant that names `@sqlite3_open` does not link SQLite"
  and "sqlite-link: a string constant that names `@nishsqlite_open` does not link SQLite"
  — only a declaration triggers the link, not text in the program.
- "sqlite-link: the napi addon exports no `sqlite3_` symbol"
  — an addon keeps SQLite's API out of the Node process's namespace.
