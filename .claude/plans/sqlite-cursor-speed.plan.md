---
name: nish/sqlite cursor speed — close the gap to a C shim on the feed
overview: Profiled on the twelve-dollar entry nish-std-amritk (GET /feed and GET /posts/:id through nish/sqlite's cursors) against rust-iouring-kensac (a C shim on the same amalgamation), the adapter spends its extra time in a per-call handle lookup (cursor_of 1.47%, row_of 0.53%, per-column calls ~0.5%), in unpacking a record per integer seek and per index entry (sqlite3VdbeRecordUnpack + vdbeRecordCompareInt 2.06% vs 0.12%), and in more B-tree moves (sqlite3BtreeTableMoveto 2.83% vs 1.52%, pcache1Fetch 1.15% vs 0.62%). Remove the per-call lookup, the per-seek unpack, the per-post like-count seeks and the per-column calls, each measured on bench/sqlite's cursor workloads against its noise band, and decide whether openDatabase may take SQLite's unix-excl VFS.
priority: 80
labels: []
stages:
  - id: s1-handle
    title: "perf(runtime): a nish/sqlite Cursor holds its cursor, checked once per call"
    goal: A Cursor call reaches its nishsqlite_cursor without a handle-table lookup and with one cheap validity check, while every safety rule of docs/sqlite-cursor.md and docs/security/sqlite.md still holds (a stale, closed or invalidated cursor answers MISUSE and touches no freed memory), and bench/sqlite can time a build of the base commit in the same rounds as the branch.
    verification: node tests/run.js sqlite && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node bench/sqlite/run.mjs --validate
    status: pending
    todos:
      - id: base-variant
        content: Give bench/sqlite/run.mjs a way to time main.ts built from a base commit's std/ and runtime/ (a git worktree) in the same rounds as the branch build and its copy, so a change that keeps the API is measured before/after inside one run's noise band — see S1
        status: pending
      - id: handle-design
        content: Make Cursor carry what cursor_of finds (or an equally cheap key to it) and replace the per-call slot lookup, the second lookup in cur_mutex, and the per-call autocommit/txn-state reads with one check that still catches endRead, COMMIT/ROLLBACK, a write, close, and a rollback SQLite made on its own — see S1
        status: pending
      - id: handle-tests
        content: Keep tests/link/std_sqlite_cursor_stale, its SQLITE_DEBUG run and the THREADSAFE=1 mutex run passing, and add a case for each route the new check must catch that no existing case pins (use after close, after endRead, after a write, after an on-its-own rollback, a handle from another connection or thread) — see S1
        status: pending
      - id: handle-record
        content: Update docs/sqlite-cursor.md (surface, invalidation, memory) and docs/security/sqlite.md (cursor rows, each bound citing the check that fails without it), and record the before/after feed-cursor-walk and feed-cursor figures with their noise band and commit in docs/BENCHMARKS.md — see S1
        status: pending
  - id: s2-int-seek
    title: "perf(runtime): integer index seeks reuse one key, and Cursor.countRange counts an index's keys in one walk"
    goal: An integer seek on an index cursor builds no UnpackedRecord and unpacks no record per call (the key record and KeyInfo are built once per cursor and their integer fields set in place), and a new Cursor call fills a caller's i64[] with the number of entries whose first key column is k, for each k in [lo, hi], in one walk of the index; the feed's 20 like counts use it.
    verification: node tests/run.js sqlite && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node bench/sqlite/run.mjs --validate
    status: pending
    todos:
      - id: kept-key
        content: Build the seek's UnpackedRecord once per index cursor (at open, beside its KeyInfo) and have keyI64/seek set its integer Mems in place, so an integer seek allocates nothing and calls no sqlite3VdbeRecordUnpack — see S2
        status: pending
      - id: range-count
        content: Add the range count to runtime/sqlite/nish-sqlite.c and std/sqlite.ts — counts into a caller's i64[] for each k in [lo, hi], one seek and one forward walk, comparing each entry's first key field with SQLite's own record compare rather than a full unpack; refuses a span longer than the buffer, lo > hi, a non-index cursor, and an index whose first key column is not compared as an integer — see S2
        status: pending
      - id: range-tests
        content: A tests/link case pins the count against SELECT count(*) for every k (keys with no entries, the first and last key, a span past the end, overflow-free and DESC indexes), each refusal, and no allocation in a steady-state seek/count loop under SQLITE_DEFAULT_MEMSTATUS=1 — see S2
        status: pending
      - id: range-bench
        content: Add a bench/sqlite workload whose like counts use the range count, timed in the same rounds as feed-cursor-walk with the same checksum, and record both figures, the noise band and the commit in docs/BENCHMARKS.md; update docs/sqlite-cursor.md (surface, what the adapter calls and writes) and docs/security/sqlite.md — see S2
        status: pending
  - id: s3-row-decode
    title: "perf(runtime): Cursor.readRow decodes a row's requested columns in one call"
    goal: One Cursor call writes every requested integer column of the current row into a caller's i64[] and every requested text or blob column's bytes into a caller's u8[] with their spans, with the same values and refusals the per-column calls give, and the feed walk reads posts and users with it.
    verification: node tests/run.js sqlite && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node bench/sqlite/run.mjs --validate
    status: pending
    todos:
      - id: row-call
        content: Add the one-call row read to runtime/sqlite/nish-sqlite.c and std/sqlite.ts — a column list chosen once (at open or per call), integers into i64[], text/blob copied into u8[] with (offset, length) spans, the INTEGER PRIMARY KEY alias, NULL, a record shorter than the table and an overflow record handled exactly as columnI64/columnInto/columnType handle them, and a buffer too small answered so the caller can grow it and call again — see S3
        status: pending
      - id: row-tests
        content: A tests/link case compares the one-call read with the per-column calls on every column type and trap in docs/sqlite-cursor.md's table, pins every refusal, and checks a steady-state loop allocates nothing — see S3
        status: pending
      - id: row-bench
        content: Add a bench/sqlite workload whose post and user reads use the one-call read, timed in the same rounds as the per-column walk with the same checksum, and record both, the noise band and the commit in docs/BENCHMARKS.md; update docs/sqlite-cursor.md and docs/security/sqlite.md — see S3
        status: pending
  - id: s4-unix-excl
    title: "docs(runtime): decide whether openDatabase takes SQLite's unix-excl VFS, and what a checkpointer then is"
    goal: A recorded, measured decision on whether nish/sqlite offers unix-excl (no -shm file, no file lock per transaction), with what it costs (no second process, the checkpointer must be a thread on a second connection under nish:threads); if adopted, openDatabase takes it through a documented route, and tests pin the no--shm, second-process-refused and thread-checkpointer behaviour; if declined, the note gives the figures and the reason.
    verification: node tests/run.js sqlite && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node bench/sqlite/run.mjs --validate
    status: pending
    todos:
      - id: excl-measure
        content: Time lookup, feed, feed-cursor-walk, insert and insert-txn with the database opened on unix-excl against the default unix VFS, in the same rounds (a bench/sqlite variant), WAL and synchronous=NORMAL as the bench has them — see S4
        status: pending
      - id: excl-facts
        content: Establish by test, not by reading, what unix-excl does in this build — the wal-index in heap, no -shm file, a second process refused with SQLITE_BUSY, a second connection in the same process (another nish:threads thread) able to read and to run wal_checkpoint — and whether the existing OPEN_URI `?vfs=unix-excl` route already reaches it, and what nish's sandbox and capability reports say about it — see S4
        status: pending
      - id: excl-decide
        content: Write the decision as docs/sqlite-vfs.md (linked from docs/sqlite-cursor.md's neighbours and the guide) — adopt, adopt as opt-in, or decline, with the figures; if adopted, the openDatabase route (a flag or the URI), its tests/link cases, its guide section, its docs/LANGUAGE.md rule and its docs/security/sqlite.md rows — see S4
        status: pending
---

## Context

The entry `nish-std-amritk` in the twelve-dollar server challenge answers
`GET /feed` and `GET /posts/:id` through `nish/sqlite`'s B-tree cursors
([`docs/sqlite-cursor.md`](../../docs/sqlite-cursor.md)). Profiled under the
same load as the top entry `rust-iouring-kensac`, a C shim over the same
SQLite amalgamation:

| Symbol | nish-std-amritk | kensac |
| --- | --- | --- |
| `sqlite3BtreeTableMoveto` | 2.83% | 1.52% |
| `sqlite3VdbeRecordUnpack` + `vdbeRecordCompareInt` | 2.06% | 0.12% |
| `pcache1Fetch` | 1.15% | 0.62% |
| adapter `cursor_of` + `row_of` + per-column calls | 1.47% + 0.53% + ~0.5% | — |

What the adapter does today ([`runtime/sqlite/nish-sqlite.c`](../../runtime/sqlite/nish-sqlite.c)):

- Every `nishsqlite_cursor_*` entry point calls `cur_mutex(h)` (a slot
  lookup) and then `cursor_of(h)` (a second slot lookup, then
  `sqlite3_get_autocommit` and `sqlite3BtreeTxnState`).
- `seek` builds an `UnpackedRecord` on the stack each call; the feed then reads
  `like.columnI64(0)` for each like entry, which unpacks the entry's record
  (`row_of` → `sqlite3VdbeRecordUnpack`). The feed seeks the likes index once
  per post: 20 seeks a feed.
- Each column read is its own call through `column_mem` → `cursor_of`.

`bench/sqlite/main.ts`'s `walkFeed` is the same walk as the entry's feed.
The seed writes posts in id order with increasing `created_at`, so the 20
newest posts have consecutive ids and one range count over
`likes_post_id_idx` replaces their 20 seeks.

`OPEN_URI` is already accepted by `nishsqlite_open`, so a
`file:…?vfs=unix-excl` URI may reach unix-excl today, untested and
undocumented.

## Approach

- **The safety rules stay.** SQLite stays unmodified; the adapter only calls
  SQLite's functions; a stale cursor answers `MISUSE` and never reads freed
  memory; invalidation still happens before anything but a plain read runs.
  A change to what the adapter calls or writes updates the lists in
  `docs/sqlite-cursor.md` ("What the adapter calls") and its record. Reading a
  record's first field through SQLite's own record compare
  (`sqlite3VdbeRecordCompare` and friends) is allowed and listed; reading the
  record format by hand is not.
- **Measured in one run.** Every gain is timed in the same `bench/sqlite`
  rounds as the code it replaces — the base build (S1's variant) for a change
  that keeps the API, the old workload beside the new one for a new call —
  with the run's own noise band. A difference inside the band is recorded as
  not shown. Figures go in `docs/BENCHMARKS.md` ("The feed through cursors
  against SQL") naming the commit, following CLAUDE.md's record rules.
- **Order.** S1 changes every cursor entry point and the `Cursor` class, so S2
  and S3 start from `main` after S1 merges. S4 touches only the open path and
  runs beside S1. Merge order: S1, then S4, S2, S3 (S3 updates from main
  after S2).

### Ownership

The four stages share a few files by region. Each stage edits only its own
region of them and its own entries; the later stage in merge order resolves a
textual conflict when it updates from `main`.

| Stage | Owns |
| --- | --- |
| S1 | `runtime/sqlite/nish-sqlite.c` (cursor handle, `cursor_of`, `cur_mutex`, the entry points' prologues), `std/sqlite.ts` (`Cursor` class and the cursor `declare function`s), `bench/sqlite/run.mjs`, `bench/sqlite/main.ts`, `bench/README.md` (sqlite section), `tests/link/std_sqlite_cursor*/**` |
| S2 | `runtime/sqlite/nish-sqlite.c` (seek-key functions, new range count), `std/sqlite.ts` (`Cursor` seek/key methods, new range count), `tests/link/std_sqlite_cursor_count*/**`, `tests/link/std_sqlite_cursor_seek*/**` |
| S3 | `runtime/sqlite/nish-sqlite.c` (column functions, new row read), `std/sqlite.ts` (`Cursor` column methods, new row read), `tests/link/std_sqlite_cursor_row*/**` |
| S4 | `runtime/sqlite/nish-sqlite.c` (`nishsqlite_open` and above it), `std/sqlite.ts` (`OPEN_*` constants, `openDatabase`), `docs/sqlite-vfs.md`, `tests/link/std_sqlite_excl*/**`, `tests/link/std_sqlite_vfs*/**` |

Shared, own entries only, every stage: `docs/sqlite-cursor.md`,
`docs/security/sqlite.md` (its rows and its README row's counts),
`docs/guide/using-nish/sqlite.md`, `docs/LANGUAGE.md` (the SQLite section),
`docs/BENCHMARKS.md` (the cursor sections), `bench/sqlite/main.ts` and
`bench/sqlite/run.mjs` (S2–S4: own workloads or variant only),
`tests/run.js` (own sqlite checks), `tests/nish-cmp.js` (own `DECLARED`
entries). Generated, regenerated with the repo's tooling, never hand-edited:
`tests/self/goldens/checked/**`, `docs/reference/**`, `scalar.config.json`,
`docs/IR_COOKBOOK.md`, `tests/link/*/expected.caps.json`,
`tests/wordings/*.err`, `docs/reference/diagnostics/**`,
`tests/differential/**`.

## S1 — a Cursor holds its cursor

**Owns:** `runtime/sqlite/nish-sqlite.c`, `std/sqlite.ts`, `bench/sqlite/run.mjs`, `bench/sqlite/main.ts`, `bench/README.md`, `tests/link/std_sqlite_cursor*/**`, plus the shared files (own entries only) and generated files listed under Ownership.

- **The base variant first.** `bench/sqlite/run.mjs` gets a way to build
  `main.ts` against a base commit's `std/` and `runtime/` (a `git worktree` at
  that commit, its own `build/nish` or the branch compiler pointed at the
  worktree's std/runtime — whichever the build allows) and time it in the same
  rounds as the branch build and its copy. Without it, a before/after for an
  unchanged API is two runs whose absolute figures move more than either band
  (the note in `docs/sqlite-cursor.md`, "The build decision", shows the C twin
  moving 14% between runs).
- **The design is the worker's**, inside these bounds: no per-call slot-table
  scan; one check per call that catches every route in
  `docs/sqlite-cursor.md` → "Transactions and invalidation", including an end
  the adapter did not see; a stale `Cursor` value — after `close`,
  `endRead`, invalidation, or on another thread — answers `MISUSE` and reads
  no freed memory (a cursor block kept alive until `close`, a generation
  stamp, or a connection epoch are all acceptable shapes). The handle tables
  are `NISH_TLS`; the `--threads` build must keep working.
- Record the figures for `feed-cursor-walk` and `feed-cursor` (base vs
  branch, same rounds).

## S2 — integer seeks without an unpack, and the range count

**Owns:** `runtime/sqlite/nish-sqlite.c` (seek-key and range-count functions), `std/sqlite.ts` (`Cursor` key/seek and range-count methods), `tests/link/std_sqlite_cursor_count*/**`, `tests/link/std_sqlite_cursor_seek*/**`, plus the shared files (own entries only) and generated files listed under Ownership.

- The kept key: one `UnpackedRecord` over the cursor's key `Mem`s, built at
  open, its `default_rc` and `nField` set per seek; `keyI64` sets a `Mem`'s
  integer in place. The doc's "What it writes" list changes with it.
- The range count (`Cursor.countRange(lo: i64, hi: i64, out: i64[]):
  Result<i32, i32>` or a better name the worker picks): one seek GE `lo`, then
  `next` while the first key field is ≤ `hi`, adding one to
  `out[k - lo]`. Comparing the first field uses SQLite's record compare
  against the kept key, never a full unpack. Answers the entries counted.
- The feed walk's like counts become one call over `[minId, maxId]` of the 20
  posts. The old per-post seek walk stays as its own workload so both are
  timed in the same rounds.

## S3 — one call per row

**Owns:** `runtime/sqlite/nish-sqlite.c` (column and row-read functions), `std/sqlite.ts` (`Cursor` column and row-read methods), `tests/link/std_sqlite_cursor_row*/**`, plus the shared files (own entries only) and generated files listed under Ownership.

- `Cursor.readRow` (name the worker's) takes the columns it reads, an
  `i64[]` for integers, a `u8[]` for text and blob bytes and an `i32[]` for
  their (offset, length) spans; it answers per column what `columnType`
  answers, or one code for the row. A buffer too small answers the length
  needed, as `columnInto` does, and copies nothing partial.
- The feed walk reads each post's and author's columns with one call each;
  the per-column walk stays as its own workload.

## S4 — unix-excl

**Owns:** `runtime/sqlite/nish-sqlite.c` (`nishsqlite_open` and above it), `std/sqlite.ts` (`OPEN_*` constants, `openDatabase`), `docs/sqlite-vfs.md`, `tests/link/std_sqlite_excl*/**`, `tests/link/std_sqlite_vfs*/**`, plus the shared files (own entries only) and generated files listed under Ownership.

- The decision is the deliverable. Measure first, establish the facts by
  test, then write `docs/sqlite-vfs.md`: adopt (default), adopt as opt-in, or
  decline. A checkpointer under unix-excl cannot be another process; it is a
  thread with its own connection (`nish:threads`) — show that it works or
  that it does not.
- If adopted: the route (`OPEN_EXCLUSIVE`-style flag passing `"unix-excl"` as
  `sqlite3_open_v2`'s VFS, or the existing URI), a `tests/link` case for each
  behaviour, a negative case, the guide section, the `docs/LANGUAGE.md` rule
  and the security record's rows. A new open flag is refused where the build
  has no unix VFS (the wasm/WASI profile).
