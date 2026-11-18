---
name: SQLite B-tree cursors for nish/sqlite
overview: Let a Nish program read SQLite tables and indexes through SQLite's own B-tree cursor functions, skipping the VDBE, with the cursor bound to a caller-opened read transaction, invalidated across COMMIT, and refused on a schema it does not match. SQLite stays unmodified at 3.54.1; the adapter includes the amalgamation.
stages:
  - id: cursor
    title: "feat(runtime): read SQLite tables and indexes through B-tree cursors"
    goal: A design note, the one-unit build, the C cursor adapter and the scalar nish/sqlite Cursor surface, with link tests on the challenge schema and its docs and security record
    verification: npm run check && npm run lint && node tests/run.js sqlite && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node docs/check-links.mjs && node tests/nish-cmp.js
    todos:
      - id: design-note
        content: Write docs/sqlite-cursor.md — surface, transactions and invalidation, schema check, build decision, what the adapter calls and never touches — see Stage cursor / Design note
      - id: one-unit-build
        content: Make runtime/sqlite build as one translation unit, nish-sqlite.c including sqlite3.c, in scripts/build.sh (and src/run-cache.ts / src/compile.ts only if the unit list needs it); measure first-link and cached-link cost before and after — see Stage cursor / Build
      - id: c-adapter
        content: Add the nishsqlite_cursor_* functions to runtime/sqlite/nish-sqlite.c with a generation-checked cursor handle table — see Stage cursor / C adapter
      - id: txn-invalidation
        content: Add beginRead/endRead and the fail-closed invalidation of every cursor on a connection before any non-read statement runs — see Stage cursor / Transactions
      - id: schema-check
        content: Look up root page, kind and column order from sqlite_schema and PRAGMA table_xinfo / index_xinfo at open, and refuse what does not match the caller's declared columns — see Stage cursor / Schema check
      - id: std-surface
        content: Add Database.beginRead, endRead, openCursor and class Cursor to std/sqlite.ts with full doc comments — see Stage cursor / Nish surface
      - id: link-tests
        content: Add tests/link/std_sqlite_cursor (feed through cursors equals the SQL answer byte for byte) and the negatives — see Stage cursor / Tests
      - id: cursor-docs
        content: Update docs/security/sqlite.md and its index row, docs/guide/using-nish/sqlite.md, runtime/sqlite/README.md, regenerate docs/reference and the goldens, add nish-cmp DECLARED entries — see Stage cursor / Docs
  - id: bench
    title: "perf(runtime): measure the feed through cursors against SQL"
    goal: Time the challenge's GET /feed read through cursors against the same read through SQL on the bench database, and record it in docs/BENCHMARKS.md
    verification: npm run check && npm run lint && node bench/sqlite/run.mjs --validate && node docs/check-links.mjs
    todos:
      - id: bench-workload
        content: Add a feed-cursor workload beside the feed workload in bench/sqlite/main.ts, same rows and checksum, validated by run.mjs --validate — see Stage bench
      - id: bench-record
        content: Run bench/sqlite/run.mjs and record feed via SQL vs via cursors with the noise band and the commit in docs/BENCHMARKS.md — see Stage bench
---

## Context

[`std/sqlite.ts`](../../std/sqlite.ts) (`nish/sqlite`) wraps SQLite 3.54.1 through [`runtime/sqlite/nish-sqlite.c`](../../runtime/sqlite/nish-sqlite.c): connections and statements are generation-checked `i32` handles, the row loop allocates nothing, `columnInto` copies text or blob into a caller's `u8[]`. [`scripts/build.sh`](../../scripts/build.sh) compiles every `.c` in `runtime/sqlite/` as its own unit; `sqlite3.c` has `-flto` stripped (a native object, 10.6 s vs 0.04 s per link), the adapter stays LTO so it inlines into the program. [`bench/sqlite/`](../../bench/sqlite/) already runs the twelve-dollar challenge schema ([`schema.sql`](../../bench/sqlite/schema.sql)) against a C twin.

In the challenge entry `nish-std-amritk`, the VDBE is about 27% of server CPU on GET /feed (39.7 µs, half of all requests). The organizer allows SQLite's B-tree/cursor API. It forbids patching SQLite, writing a reader for its file format, and writing SQLite's private cursor fields (`BtCursor.ix`, `curFlags`, `info.*`).

## Approach

- **Calls, never fields.** The adapter calls SQLite's internal functions (`sqlite3BtreeCursor`, `sqlite3BtreeCursorSize`, `sqlite3BtreeCursorZero`, `sqlite3BtreeTableMoveto`, `sqlite3BtreeIndexMoveto`, `sqlite3BtreeFirst/Last/Next/Previous`, `sqlite3BtreeEof`, `sqlite3BtreeIntegerKey`, `sqlite3BtreePayloadSize`, `sqlite3BtreePayloadFetch`, `sqlite3BtreePayload`, `sqlite3BtreeCloseCursor`, `sqlite3VdbeRecordUnpack`, `sqlite3VdbeAllocUnpackedRecord`, `sqlite3KeyInfoAlloc`, ...). It writes no `BtCursor` member and reads none except through a function. Records are decoded only by `sqlite3VdbeRecordUnpack`; values are read from the unpacked `Mem`s through the public `sqlite3_value_*` accessors. No code parses the file or record format.
- **Text without allocation.** Read text and blob values with `sqlite3_value_blob` + `sqlite3_value_bytes`, never `sqlite3_value_text`, which nul-terminates an ephemeral string and so can allocate per row.
- **Fail closed.** The schema check and the invalidation rule are allowlists: what the adapter does not recognise as safe is refused or invalidates.
- **SQLite unmodified.** `sqlite3.c` / `sqlite3.h` keep their README hashes (the `sqlite-link` section checks them). No new file is added to `runtime/sqlite/`, so the release workflow's file gates (`.github/`, a CODEOWNERS path) do not change.

## Stage cursor

### Design note

[`docs/sqlite-cursor.md`](../../docs/sqlite-cursor.md), written first in the branch. It states: the surface (below); the transaction rule and how invalidation is enforced; what the schema check compares and what it refuses; the build decision with the measured link-time figures and their commit; the exact list of SQLite internals called; the traps it handles (below). LANGUAGE.md is not touched: this is a `std/` module, not a construct.

### Build

`nish-sqlite.c` starts with `#include "sqlite3.c"`, and `sqlite3.c` stops being a unit of its own (otherwise every SQLite symbol is defined twice). The combined unit is compiled the way `sqlite3.c` is now: native object, `-flto` stripped, the same `-DSQLITE_*` options and `NISH_SQLITE_CFLAGS`. Consequence to measure, not assume: the existing wrappers (`nishsqlite_step`, `column_*`) no longer LTO-inline into the program, but SQLite's own `sqlite3_column_*` can now inline into them. Measure with `bench/sqlite/run.mjs` before and after (inside the noise band is accepted), and measure the link cost: a first link (cold sqlite cache entry) and a cached link of a program importing `nish/sqlite`, before and after. If the worker finds two units are clearly better, it may keep a separate LTO wrapper unit only by splitting code inside `nish-sqlite.c` behind a define, never by adding a file. The cache key (`src/run-cache.ts` `sqliteUnits` / `sqliteFingerprint`) and the `sqlite-link` checks in `tests/run.js` (cache entry counts, objects) follow the new unit list. The wasm profile stays refused; `--threads` (THREADSAFE=2) and napi (-fPIC) keep working.

### C adapter

A third thread-local handle table, `nishsqlite_cursors`, generation-checked like the other two; a cursor records its owning db handle and the connection's cursor epoch. Every cursor call validates the handle and the epoch and answers `MISUSE` on a stale one. Per cursor, allocated once at open: the `BtCursor` (`sqlite3BtreeCursorSize`), the `KeyInfo`, one `UnpackedRecord` for reading sized to the declared columns, one for building seek keys, and a payload buffer used only when the payload is not wholly local (grown geometrically; no allocation in a steady-state row loop). The current row is unpacked lazily on the first column read and cached until the cursor moves. `nishsqlite_close` closes a connection's cursors before its statements.

Traps the adapter must handle and test:

| Trap | Rule |
| --- | --- |
| INTEGER PRIMARY KEY alias | stored as NULL in the record: column N of a rowid alias answers the rowid |
| record shorter than the table (ALTER TABLE ADD COLUMN) | the missing column is not in the record: answer an error, never a guess |
| index rowid | the last field of an index record; `rowid()` on an index cursor answers it |
| DESC index columns | the seek key's `KeyInfo.aSortFlags` follow `index_xinfo`'s `desc` |
| overflow payload | `sqlite3BtreePayloadFetch` gives only the local part; copy with `sqlite3BtreePayload` when short |
| REAL affinity holding an integer | `columnI64` answers the value's integer, `columnType` says what is stored |

### Transactions

- `db.beginRead()` runs `BEGIN` and makes the main database's read transaction current, so the snapshot and the schema it reads are fixed; `db.endRead()` closes every cursor on the connection, then `COMMIT`s.
- `openCursor` outside such a transaction (`sqlite3_get_autocommit(db) != 0`) answers `MISUSE`.
- **Invalidated, not dangling.** A raw cursor is not counted by SQLite's own statement bookkeeping, so a COMMIT or ROLLBACK run while one is open would end the transaction under it. The adapter therefore closes every cursor on a connection and bumps its epoch *before* any statement other than a plain read runs on it. Mechanism to evaluate in the design note: the adapter owns the connection's authorizer (`sqlite3_set_authorizer`; `nish/sqlite` exposes none) and, at prepare, marks a statement as a plain read only if every action is on an allowlist (`SQLITE_SELECT`, `SQLITE_READ`, `SQLITE_FUNCTION`, ...); `nishsqlite_step` and `nishsqlite_exec` invalidate before stepping anything else (`SQLITE_TRANSACTION`, `SQLITE_SAVEPOINT`, writes, DDL, PRAGMA, ATTACH). Under `sqlite3_exec`, which prepares and steps each statement in turn, the authorizer callback is where the invalidation happens. A cursor call after that answers `MISUSE`.
- A test proves it: open a cursor, `COMMIT` through `db.exec` (and through `db.commit()`, `ROLLBACK`, an `INSERT`), then every cursor call answers `MISUSE`; and a build with `-DSQLITE_DEBUG` (asserts on) runs the same sequence without an assertion failure.

### Schema check

At open, inside the read transaction, through the public API on the connection: `SELECT type, rootpage, tbl_name, sql FROM sqlite_schema WHERE name = ?1`, then `PRAGMA table_xinfo` / `PRAGMA index_xinfo`. The caller declares the columns it will read, in order, as one string. The open is refused (`SqliteError`, `SQLITE_SCHEMA`) when:

- the name is missing, a view, a virtual table, or a `WITHOUT ROWID` table;
- the declared column names or their order differ from the schema's (for an index: its key columns, then the rowid; `DESC` written where `index_xinfo` says `desc`);
- a table has a generated (hidden) column, or an index has an expression column (`cid` -2) or a collation other than `BINARY`.

Root page and column count come from that lookup, never from the caller.

### Nish surface

Scalar-only, like the rest of `nish/sqlite`; a `Cursor` is an `i32` handle; the row loop answers bare scalars or a two-scalar `Result`.

```ts
db.beginRead(): Result<i32, i32>                     // Err: extended code
db.endRead(): Result<i32, i32>                       // closes the connection's cursors, then COMMIT
db.openCursor(name: string, columns: string): Result<Cursor, SqliteError>
//   openCursor("posts", "id,user_id,body,created_at")
//   openCursor("posts_created_at_id_idx", "created_at DESC,id DESC,rowid")

class Cursor {
  first(): Result<bool, i32>      // Ok(true) on a row, Ok(false) when empty
  last(): Result<bool, i32>
  next(): Result<bool, i32>       // Ok(false) past the end
  previous(): Result<bool, i32>
  seekRowid(rowid: i64): Result<bool, i32>          // table cursor; Ok(true) when found
  keyReset(): void                                  // index cursor: build a key prefix
  keyI64(v: i64): Result<i32, i32>
  keyText(s: string): Result<i32, i32>
  keyTextBytes(buf: readonly u8[], off: i32, len: i32): Result<i32, i32>
  seek(op: i32): Result<bool, i32>                  // SEEK_GE | SEEK_GT | SEEK_LE | SEEK_LT on the prefix
  rowid(): i64
  columnType(n: i32): i32
  columnI64(n: i32): i64
  columnInto(n: i32, buf: u8[], at: i32): Result<i32, i32>   // same contract as Statement.columnInto
  close(): Result<i32, i32>
}
```

Exact names may move in the design note; the shape (handles, scalars, `columnInto`'s contract, no per-row allocation) does not.

### Tests

- `tests/link/std_sqlite_cursor/`: builds the challenge schema in memory (copy of [`bench/sqlite/schema.sql`](../../bench/sqlite/schema.sql)'s statements, attributed) with deterministic rows that include equal `created_at` values (so `id DESC` decides), posts with zero likes, non-ASCII text and a body read through `columnInto` with a too-small buffer first. It reads the 20 newest posts with author usernames and like counts twice: through SQL (the challenge's feed query, as `bench/sqlite/main.ts` has it) and through cursors only (`posts_created_at_id_idx` from the start, `posts` by rowid, `users` by rowid, `likes_post_id_idx` seek on the post id and count while the prefix matches). It writes both renderings into byte buffers, prints them, and fails unless they are identical. `expected.out` pins the output.
- A unit-style program (same dir or a sibling) for first/last/next/previous at both ends, seek ops on a DESC index, rowid alias, index `rowid()`, overflow payload (a table without the 500-char CHECK), and the short-record error.
- Negatives, each its own `tests/link/` dir with `expected.out`/`expected.code`: schema mismatch (wrong column order, missing column, extra column, WITHOUT ROWID, view, non-BINARY collation) is refused; cursor outside a read transaction is `MISUSE`; cursor after COMMIT / ROLLBACK / a write / `endRead` is `MISUSE`; a stale handle after `close` is `MISUSE`.
- No allocation per row: a check that a 10,000-row scan with column reads leaves the adapter's allocation count unchanged after the first row (the worker picks the counter; `SQLITE_DEFAULT_MEMSTATUS=0`, so not `sqlite3_memory_used` unless a test build turns it on).
- The `SQLITE_DEBUG` invalidation run (Transactions).
- `tests/run.js` `sqlite-link` updated for the one-unit build; `tests/link/sqlite_link_threads` and `std_sqlite_wasi` still pass.

### Docs

- [`docs/security/sqlite.md`](../../docs/security/sqlite.md): scope gains the cursor adapter; findings cover raw record reads (bounds of a payload copy, a corrupt or short record, a stale handle, a cursor across a transaction end, a schema it does not match), each fixed with a test or recorded open; its row in [`docs/security/README.md`](../../docs/security/README.md) moves with the counts.
- [`docs/guide/using-nish/sqlite.md`](../../docs/guide/using-nish/sqlite.md): a "Reading through cursors" section with a compiled example and the transaction rule.
- [`runtime/sqlite/README.md`](../../runtime/sqlite/README.md): "How it is linked" says one unit.
- `docs/reference/` regenerated (`node scripts/gen-reference.mjs`); goldens regenerated (`node tests/self/goldens.js --update`); `tests/nish-cmp.js` `DECLARED` entries for every corpus program whose IR the `std/sqlite.ts` change moves, with the PR's release-note words.

**Owns:** `docs/sqlite-cursor.md`, `runtime/sqlite/nish-sqlite.c`, `runtime/sqlite/README.md`, `scripts/build.sh`, `src/run-cache.ts`, `src/compile.ts`, `std/sqlite.ts`, `tests/link/std_sqlite_cursor*/**`, `tests/run.js`, `tests/nish-cmp.js`, `docs/security/sqlite.md`, `docs/security/README.md`, `docs/guide/using-nish/sqlite.md`, `docs/reference/**`, `tests/self/goldens/checked/**`

## Stage bench

Depends on `cursor` (consumes its surface; starts after it merges). Add a `feed-cursor` workload to [`bench/sqlite/main.ts`](../../bench/sqlite/main.ts) beside the existing feed workload: the same 20 newest posts with authors and like counts, through cursors, printing the same rows and checksum, so `run.mjs --validate` proves they agree. If `run.mjs` needs to know the workload's name, change it there. Run `node bench/sqlite/run.mjs` (default 12 rounds) and record in [`docs/BENCHMARKS.md`](../../docs/BENCHMARKS.md): feed via SQL and via cursors in ns per call, min / median / IQR, the noise band (build vs its byte-identical copy), the machine, and the commit whose bench code produced the table, under CLAUDE.md's record rules. The C twin is not given a cursor path.

**Owns:** `bench/sqlite/**`, `bench/README.md`, `docs/BENCHMARKS.md`, `tests/self/goldens/checked/**`, `tests/nish-cmp.js`

## Out of scope

Writes through cursors; seeking on REAL keys or non-BINARY collations; a cursor on an attached database; WITHOUT ROWID tables; the wasm profile; any change to `sqlite3.c` / `sqlite3.h` or the SQLite version; any file under `.github/`; the challenge server itself.

## Acceptance criteria

1. A Nish program importing `nish/sqlite` opens a cursor on a table and on an index by name, moves first/last/next/previous, seeks by rowid and by an integer and a text key prefix, and reads the rowid, an i64 column and a text column into its own `u8[]` — a link test exits 0 with its pinned output.
2. On the challenge schema, the 20 newest posts with author usernames and like counts read through cursors alone are byte-identical to the SQL feed query's answer, including ties on `created_at` and posts with no likes.
3. A cursor opened against a table or index whose columns differ from what the caller declares (order, names, count, WITHOUT ROWID, view, collation) is refused with an error; nothing is read.
4. Opening a cursor outside a read transaction is refused, and every call on a cursor after COMMIT, ROLLBACK, a write or `endRead` answers MISUSE; the same sequence runs clean in a `SQLITE_DEBUG` build.
5. Stepping and reading columns through a cursor performs no heap allocation per row, shown by a test.
6. `runtime/sqlite/sqlite3.c` and `sqlite3.h` still match the hashes in `runtime/sqlite/README.md`, SQLite is 3.54.1, and the adapter assigns no `BtCursor` member.
7. A program importing `nish/sqlite` still links (default, `--threads`), a program that does not call SQLite links no SQLite, and the link-time cost of the new build (first and cached link, before and after) is recorded with its commit.
8. `docs/BENCHMARKS.md` records the feed via SQL and via cursors on the bench database, with the noise band and the commit.
9. `docs/security/sqlite.md` covers raw record reads, `docs/reference/sqlite.md` lists the cursor API (`gen-reference --check` passes), and `docs/guide/using-nish/sqlite.md` shows a compiled cursor example; a design note in `docs/` states the surface, the transaction rule, the schema check and the build decision.

## Verification

- cursor: `npm run check && npm run lint && node tests/run.js sqlite && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node docs/check-links.mjs && node tests/nish-cmp.js`; plus `node tests/run.js wasi` (`WASI_SYSROOT=/usr`) and `node tests/run.js performance` if `src/` changed.
- bench: `npm run check && npm run lint && node bench/sqlite/run.mjs --validate && node docs/check-links.mjs`.
