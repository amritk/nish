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
| `SQLITE_MAX_EXPR_DEPTH=0` | No limit on expression depth: the parser does not count it |
| `SQLITE_OMIT_DEPRECATED` | No deprecated interface |
| `SQLITE_OMIT_PROGRESS_CALLBACK` | No progress callback |
| `SQLITE_OMIT_SHARED_CACHE` | No shared cache |
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

## Bumping for a CVE

Follow "Updating" in [runtime/sqlite/README.md](../../runtime/sqlite/README.md):
it lists every file the version lives in and the sections to run. Then update
the version and the commit in this record, and the version in
`docs/guide/using-nish/cli.md`. The changed sources change the SQLite cache
key, so every program relinks against the new objects.

## Not yet covered by the scope check

`scripts/security-scope.mjs` reads top-level `runtime/*.c` and does not descend
into `runtime/sqlite/`, so it does not yet require these files to be named
here. Widening its surface is a `scripts/` change for a later pull request.

## Tests

In `tests/run.js`, section `sqlite-link`:

- "sqlite-link: runtime/sqlite/README.md records the SHA3-256 of sqlite3.c and sqlite3.h as they are"
  — the vendored files are the ones the README's hashes name, so an edit to
  either fails it.
- "sqlite-link: NISH_SQLITE_CFLAGS=-DSQLITE_THREADSAFE=1 compiles sqlite3.c alone again, into a new entry, and replaces the default"
  — a builder's option replaces the default rather than joining it.
- "sqlite-link: a program that does not call SQLite compiles no C, adds no entry and links no SQLite symbol"
  — a program that never names SQLite carries none of its code.
- "sqlite-link: a string constant that names `@sqlite3_open` does not link SQLite"
  and "sqlite-link: a string constant that names `@nishsqlite_open` does not link SQLite"
  — only a declaration triggers the link, not text in the program.
- "sqlite-link: the napi addon exports no `sqlite3_` symbol"
  — an addon keeps SQLite's API out of the Node process's namespace.
