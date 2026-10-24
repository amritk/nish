# Security record: the SQLite amalgamation

The record of the SQLite that `nish build` links into a program that calls it
([runtime/sqlite/README.md](../../runtime/sqlite/README.md)). It says what is
vendored and from where, which inputs SQLite trusts and which are an
attacker's, the options it is compiled with, and how it is bumped for a CVE.
It is written when the C lands, not after an audit, so that an audit starts
from evidence.

`sqlite3.c` and `sqlite3.h` are as vendored at `46559bf`; the compile options
are named by the "SQLite's compile-time options" section of
`scripts/build.sh`.

**Result.** SQLite 3.54.1, byte for byte as upstream publishes it; no line of
it is patched. Nothing was found to fix or left open.

## Scope

| File | What |
| --- | --- |
| `runtime/sqlite/sqlite3.c` | The amalgamation, upstream 3.54.1, unchanged |
| `runtime/sqlite/sqlite3.h` | Its public header, upstream 3.54.1, unchanged |

Out of scope: the `nishsqlite_*` adapters and the `std/` module built on them,
which come with their own record, and the program's own SQL.

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
| `SQLITE_MAX_EXPR_DEPTH=0` | Expression depth is bounded by the stack, not a counter |
| `SQLITE_OMIT_DEPRECATED` | No deprecated interface |
| `SQLITE_OMIT_PROGRESS_CALLBACK` | No progress callback |
| `SQLITE_OMIT_SHARED_CACHE` | No shared cache |
| `SQLITE_USE_ALLOCA` | Scratch space on the stack where SQLite allows it |
| `SQLITE_OMIT_LOAD_EXTENSION` | No `load_extension`: nothing can load code |
| `SQLITE_THREADSAFE=0`, or `=2` with `--threads` | No mutex for one thread; each connection serialised for several; always `0` on wasi |

`NISH_SQLITE_CFLAGS` is appended, and a `-D` or `-U` in it for one of these
names replaces the default. A program built with it is compiled with what its
builder chose, and this record covers only the defaults.

`SQLITE_MAX_EXPR_DEPTH=0` leaves a deeply nested expression bounded only by the
stack. It is SQL text, which is trusted, so it is recorded here rather than as
a finding; a program that runs SQL it did not write sets a depth itself.

## Bumping for a CVE

1. Download the amalgamation for the fixed release from
   [sqlite.org/download.html](https://sqlite.org/download.html) and check it
   against the SHA3-256 published there.
2. Replace `runtime/sqlite/sqlite3.c`, `sqlite3.h` and `LICENSE.md` byte for
   byte; edit none of them.
3. Update the version and the SHA3-256s of the archive and both files in
   `runtime/sqlite/README.md`, the version in `THIRD_PARTY_NOTICES.md` and
   `docs/guide/using-nish/cli.md`, and the version the `sqlite-link` checks in
   `tests/run.js` expect (`3054001` for 3.54.1).
4. Update the version and the commit in this record.
5. Run `node tests/run.js sqlite-link`, `third-party-licence` and `package`.
   The changed sources change the SQLite cache key, so every program relinks
   against the new objects.

## Not yet covered by the scope check

`scripts/security-scope.mjs` reads top-level `runtime/*.c` and does not descend
into `runtime/sqlite/`, so it does not yet require these files to be named
here. Widening its surface is a `scripts/` change for a later pull request.

## Tests

In `tests/run.js`, section `sqlite-link`:

- "sqlite-link: runtime/sqlite/README.md records the SHA3-256 of sqlite3.c and sqlite3.h as they are"
- "sqlite-link: the first link of a program that calls SQLite compiles the runtime and sqlite3.c once each"
- "sqlite-link: NISH_SQLITE_CFLAGS=-DSQLITE_THREADSAFE=1 compiles sqlite3.c alone again, into a new entry, and replaces the default"
- "sqlite-link: a program that does not call SQLite compiles no C, adds no entry and links no SQLite symbol"
- "sqlite-link: the wasm profile refuses a module that calls SQLite with exit 2, naming wasi"
