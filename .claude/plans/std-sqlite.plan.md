---
name: std/sqlite and std/postgres — database clients in the standard library
overview: Add `nish/sqlite`, a SQLite client on a vendored public-domain amalgamation and a thin C adapter, linked automatically when a program uses it and measured per call against C on the $12-server challenge schema; and `nish/postgres`, a PostgreSQL client written in Nish over the v3 wire protocol on `nish:net`, with SCRAM-SHA-256 from a new PBKDF2 in `nish/crypto/hmac`. Fixes the compiler bug that keeps a `declare function` in any package from binding to its C symbol, which the SQLite module needs first.
stages:
  - id: ffi-package-symbols
    title: "fix(checker): bind a declare function in a package to its bare C symbol"
    goal: A `declare function` in a non-root package (std/ is package `nish`) is emitted under its C name, not the package prefix, and two declarations of one C name that disagree are refused
    verification: npm run check, npm run lint, npm run lint:dead, node tests/run.js link, node tests/run.js ffi, node tests/run.js wasi, node tests/run.js performance, then an undegraded npm test, all green with the goldens regenerated and read
    status: pending
    todos:
      - id: unqualify-foreign
        content: Leave foreign signatures out of qualifySymbols in src/checker.ts so foreignDeclarationFor emits the bare name — see Stage A, The fix
        status: pending
      - id: foreign-clash-rule
        content: Refuse two declarations of one C symbol whose signatures differ, across packages, and a declared name that equals a defined function's emitted symbol — see Stage A, The clash rule
        status: pending
      - id: tests-package-foreign
        content: Add tests/link programs with a declaring module under node_modules (positive) and the clash negatives — see Stage A, Tests
        status: pending
      - id: docs-package-foreign
        content: State the rule in docs/LANGUAGE.md "Calling C" and one line in docs/guide/using-nish/interop.md — see Stage A, Docs
        status: pending
  - id: sqlite-link
    title: "feat(cli): vendor SQLite and link it when a program uses it"
    goal: The SQLite amalgamation is vendored under runtime/sqlite/, and `nish run`, `--link` and scripts/build.sh compile and link it, cached, exactly when a program's IR calls into it, with no hand-written build line
    verification: npm run check, npm run lint, npm run lint:dead, node tests/run.js link, node tests/run.js third-party-licence, node tests/run.js budget, node tests/run.js wasi, node tests/run.js performance, node docs/check-links.mjs, then an undegraded npm test, all green with the goldens regenerated and read
    status: pending
    todos:
      - id: vendor-amalgamation
        content: Vendor the latest SQLite amalgamation into runtime/sqlite/ with its version, URL and SHA3-256 recorded — see Stage B, Vendoring
        status: pending
      - id: build-sh-sqlite
        content: Teach scripts/build.sh to compile and link runtime/sqlite/*.c when the IR references a sqlite3_ or nish_sqlite_ symbol, with the default compile options and NISH_SQLITE_CFLAGS — see Stage B, When it links
        status: pending
      - id: cache-sqlite
        content: Cache the compiled SQLite objects in the runtime cache and key them in src/run-cache.ts and tests/run.js — see Stage B, The cache
        status: pending
      - id: profiles-sqlite
        content: Make the wasm, wasi and napi profiles either link it or refuse with one clear error, and test each — see Stage B, Profiles
        status: pending
      - id: notices-sqlite
        content: Add the THIRD_PARTY_NOTICES.md row and whatever the third-party-licence check and release.yml gates require — see Stage B, Licensing
        status: pending
      - id: tests-sqlite-link
        content: Add tests/link programs that declare sqlite3_libversion_number and run under nish run and --link — see Stage B, Tests
        status: pending
      - id: docs-sqlite-link
        content: Document the automatic link and NISH_SQLITE_CFLAGS in docs/guide/using-nish/cli.md and the runtime map in .claude/architecture.md — see Stage B, Docs
        status: pending
  - id: std-sqlite
    title: "feat(runtime): add nish/sqlite, a SQLite client"
    goal: Programs import `nish/sqlite` to open a database, exec, prepare once and reuse, bind, step, reset and read columns, with Results for every failure and no allocation per row on the read path
    verification: npm run check, npm run lint, npm run lint:dead, node tests/run.js std_sqlite, node tests/run.js link, node tests/run.js wasi, node tests/run.js performance, node docs/check-links.mjs, then an undegraded npm test, all green with the goldens regenerated and read
    status: pending
    todos:
      - id: glue-c
        content: Write runtime/sqlite/nish-sqlite.c, the handle tables and one adapter per SQLite call, nothing else — see Stage C, The C adapter
        status: pending
      - id: module-ts
        content: Write std/sqlite.ts with Database, Statement, SqliteError and the open flags, and register it in src/std-modules.ts — see Stage C, The API
        status: pending
      - id: tests-std-sqlite
        content: Add tests/link/std_sqlite* programs covering every call, the arena-flat read loop, and the negatives — see Stage C, Tests
        status: pending
      - id: caps-std-sqlite
        content: Pin what --deny ffi does to an importer with a negative link test and an expected.caps.json — see Stage C, Capabilities
        status: pending
      - id: docs-std-sqlite
        content: Add docs/guide/using-nish/sqlite.md and its route in scalar.config.json, the std/README.md row, the standard-library.md pointer and the release.yml presence gates — see Stage C, Docs
        status: pending
  - id: pbkdf2
    title: "feat(runtime): add PBKDF2-HMAC-SHA256 to nish/crypto/hmac"
    goal: A PBKDF2-HMAC-SHA256 that takes the password as a Secret, wipes every intermediate, and matches the RFC 7914 section 11 vectors, for SCRAM-SHA-256
    verification: npm run check, npm run lint, npm run lint:dead, node tests/run.js std_pbkdf2, node tests/run.js hmac, node tests/run.js secret, node docs/check-links.mjs, then an undegraded npm test, all green with the goldens regenerated and read
    status: pending
    todos:
      - id: pbkdf2-impl
        content: Add pbkdf2HmacSha256 to std/crypto/hmac.ts with Secret in and out and every block wiped — see Stage E, The function
        status: pending
      - id: pbkdf2-tests
        content: Add tests/link/std_pbkdf2 with the RFC 7914 vectors, a dkLen that is not a multiple of 32, and the negatives — see Stage E, Tests
        status: pending
      - id: pbkdf2-docs
        content: Record it in its docs/security record, std/README.md and the standard-library guide page — see Stage E, Docs
        status: pending
  - id: std-postgres
    title: "feat(runtime): add nish/postgres, a PostgreSQL wire-protocol client"
    goal: Programs import `nish/postgres` to connect to PostgreSQL over TCP, authenticate with SCRAM-SHA-256, cleartext or trust, run simple and extended queries with prepared statements reused, bind and read int8, float8, text, bytea and null with no allocation per row, and get every server error as a Result carrying its SQLSTATE
    verification: npm run check, npm run lint, npm run lint:dead, node tests/run.js std_postgres against a live PostgreSQL 16 with no skips, node tests/run.js wasi, node docs/check-links.mjs, then an undegraded npm test, all green with the goldens regenerated and read
    status: pending
    todos:
      - id: pg-protocol
        content: Write the sans-IO protocol core in std/postgres.ts, bytes in and bytes out with no socket, every message bounded and no input able to panic — see Stage F, Two layers
        status: pending
      - id: pg-auth
        content: Implement trust, cleartext and SCRAM-SHA-256 with the server signature verified, and refuse MD5, GSS and SSPI with one clear error — see Stage F, Authentication
        status: pending
      - id: pg-queries
        content: Implement simple query, Parse, Bind, Execute and Sync with named statements, binary int8 and float8, columns read into a caller u8[], command tags and ErrorResponse fields — see Stage F, Queries
        status: pending
      - id: pg-connection
        content: Write PgConnection, which drives the core over nish:net with its own poll, plus a pipelined form for a program that owns its loop — see Stage F, Two layers
        status: pending
      - id: pg-tests
        content: Add byte-exact transcript tests, a seeded fuzz of the decoder, and live tests against a throwaway PostgreSQL started by the harness, with CI installing it — see Stage F, Tests
        status: pending
      - id: pg-docs
        content: Add docs/guide/using-nish/postgres.md and its route, the std/README.md row, docs/security/postgres.md, the std-modules registry and the release.yml presence gates — see Stage F, Docs
        status: pending
  - id: sqlite-bench
    title: "perf(runtime): measure nish/sqlite against C on the challenge schema"
    goal: A benchmark that runs point lookup, the 20-row feed and insert-in-WAL through nish/sqlite and through the same loop in C, reports the cost per call Nish adds with its noise band, and any change to the module or adapter that brings that cost toward zero
    verification: node bench/sqlite/run.mjs --validate and a full run with its figures in the PR body, then npm run check, npm run lint, node tests/run.js std_sqlite and an undegraded npm test green
    status: pending
    todos:
      - id: bench-dataset
        content: Build the challenge schema and a deterministic seed at the challenge's sizes inside the benchmark — see Stage D, The data
        status: pending
      - id: bench-twins
        content: Write the Nish and C twins of the three workloads and bench/sqlite/run.mjs with --validate — see Stage D, The twins
        status: pending
      - id: bench-overhead
        content: Measure the per-call overhead with a noise band and drive it down in std/sqlite.ts and nish-sqlite.c — see Stage D, Driving it to zero
        status: pending
      - id: bench-docs
        content: Record the figures in bench/README.md and a "What it costs" section of the sqlite guide page — see Stage D, Docs
        status: pending
---

# std/sqlite

## Why

The "$12 server" challenge
([SPEC.md](https://github.com/arjaythedev/twelve-dollar-server-challenge/blob/main/SPEC.md),
README "Rules") is an HTTP + SQLite feed API, scored by how many users one
1 vCPU / 2 GB box holds at p95 < 500 ms. Nish has the HTTP/1.1 server, router,
JSON and HMAC-SHA256. It has no database client. A later session writes the
server on this module, so **the API is judged by its cost per request**: no
allocation on the read path, and as close to zero Nish-added cost per call as
the FFI allows.

Out of scope: the challenge server, io_uring, PGO itself (the later session
needs only the knob to pass the flags; see Stage B).

## Decisions, recorded

**1. Integer handles into C-side tables, not a handle class.** `Database` and
`Statement` are ordinary exported Nish classes holding an `i32`. The C adapter
keeps `sqlite3 *` and `sqlite3_stmt *` in two growable tables and hands out
the index. This is the design, not a workaround. A `CPtr` can live only in a
`declare function` signature, a local, or the one field of a handle class. A
handle class cannot be exported, and `using` of one is not lowered
(LANGUAGE.md "CPtr", "A handle class"). The FFI also cannot take an
out-pointer (`sqlite3 **`) or turn an integer into a pointer
(`SQLITE_TRANSIENT`). With handles:

- C does what only C can: `sqlite3_open_v2(…, &db, …)`, `SQLITE_TRANSIENT`.
- Each adapter is one table load plus the SQLite call.
- A handle carries a generation in its high bits, so a closed or finalized
  handle used again answers `SQLITE_MISUSE` instead of reaching a freed pointer.

**2. Vendored amalgamation, not the system library.** The amalgamation is
public domain, which licensing.md allows. The later session must build SQLite
with `-O3`, `-march=native`, `SQLITE_THREADSAFE=0`, `OMIT_` options and PGO,
pinned and built from source, as the challenge requires. Vendoring also makes
`nish run` work with no `libsqlite3-dev`, and gives one version everywhere.
The cost is the tarball, about +2.5 MB compressed; Stage B measures it and
records it in its PR.

**3. Linking is decided by the IR, in `scripts/build.sh`.** This follows the
precedent at build.sh:403-413, where the wasm profile adds `runtime-aes.c`
when the IR mentions `@nish_aes_hw(`. A link that sees a `sqlite3_` or
`nish_sqlite_` symbol in the IR compiles every `runtime/sqlite/*.c`. Every
route to a binary goes through build.sh: `nish run`, `--link`, the documents'
recipes, and a hand-written build line. So one rule covers all of them, and
no flag is needed. The compiled objects are cached like the runtime's.
Compiling sqlite3.c costs tens of seconds and must happen once per key, not
once per link.

**4. Text and blob columns are read into a caller-owned `u8[]`.** A `string`
result copies, and allocates once per column per row. `columnInto(col, buf, at)`
copies the column's bytes into the caller's buffer at `at` and returns the
length. Text is bound from a `string` (borrowed; the NUL scan is the FFI's) or
from a window of a `u8[]` (no scan: the HTTP body is already bytes).
Everything is bound with `SQLITE_TRANSIENT`, because C may not keep a borrowed
pointer past the call (LANGUAGE.md "Calling C").

**5. `--deny ffi`.** `ffi` is a capability, and it propagates through call
chains across packages (LANGUAGE.md ~8866). Any program that calls a
`nish/sqlite` function therefore reaches `ffi`. `--deny ffi` refuses it, with
the witness chain through `std/sqlite.ts`. Such a program is also
non-deterministic, and is compiled open-world, which keeps bounds checks on
exported functions (src/visibility.ts:99). One more limit: SQLite reads and
writes files through its own VFS, in C, so no file-system capability sees it;
`ffi` is the capability that covers it. A program that only imports a type
reaches nothing. The guide page says all of this, and Stage C pins it with
tests.

**6. Threads.** The handle tables are process globals with no lock. A
`Database` and its statements belong to one thread. A task a scope spawns
already may not call a function that takes a `u8[]`. SQLite is compiled
`SQLITE_THREADSAFE=0` without `--threads`, and `=2` (multi-thread: one
connection per thread) with it. Prefork, the challenge's likely shape, is one
process per core, each with its own tables.

**7. Coverage.** This repository has no coverage command or threshold. Its
gate is CLAUDE.md's definition of done: `npm run check`, `npm run lint` and
`lint:dead`, and an undegraded `npm test` (read the skip count). Every adapter
and every exported function also gets a positive and a negative test. That
stands in for "100% of added lines".

## Stage A — ffi-package-symbols

**Owns:** `src/checker.ts`, `src/emit.ts`, `src/codes.ts`, `src/compilation.ts`, `src/packages.ts`, `src/program.ts`, `docs/wp27-ffi.md`, `tests/cases/reject_ffi_package_*` (new), `tests/link/ffi_package_*/**`, `tests/wordings/**`, `docs/LANGUAGE.md`, `docs/guide/using-nish/interop.md`, `docs/AI.md`, `tests/self/goldens/checked/**` (generated)

### The bug

Reproduced on the 0.20.0 seed. `node_modules/probe/index.ts` declares
`declare function abs(n: i32): i32` and exports a wrapper. A root program that
calls the wrapper gets `declare i32 @probe.abs(i32)` and
`ld.lld: error: undefined symbol: probe.abs`. `qualifySymbols`
(src/checker.ts:402-421) prefixes every signature defined in a non-root
package, foreign ones included, and `foreignDeclarationFor`
(src/emit.ts:895-905) emits `@${sig.name}`. std/ is package `nish`, so a
declaration in `std/sqlite.ts` would be `@nish.sqlite3_open`.

### The fix

A foreign signature names a C symbol, and C has one global namespace. So it is
never package-qualified. The fact tables are keyed by emitted symbol
(src/packages.ts header). Check that a foreign symbol shared by two packages
cannot mix their facts. It should not, because a foreign function's facts are
"unknown, open world" either way. Write the reason beside the code.

### The clash rule

Unprefixed foreign names reopen the collision that package prefixes closed.

- Two modules, in any packages, that declare one C name with **identical**
  signatures are one function. Accept them.
- Two modules that declare it with **different** signatures are refused, with
  a new NL2 code naming both declarations. The program would be
  calling one C function two ways.
- A declared C name equal to a function the program defines and emits under
  that same symbol is refused. That means a root-package function, since the
  root's prefix is empty. Check whether `rejectSymbolClashes` already catches
  this before adding anything.

The next free code goes in src/codes.ts (orientation.md rule 7). Its wording
goes in tests/wordings.

### Tests

- `tests/link/ffi_package_declare/`: `main.ts` imports
  `./node_modules/probe/index` (and a second package, through a bare
  specifier if the link harness supports one). It declares `abs` and
  `strlen`, runs, and prints the expected stdout. Give the exact IR in the PR
  body.
- `tests/link/ffi_package_declare_same/`: two packages declare `abs`
  identically. It links and runs.
- `tests/link/ffi_package_declare_clash/` (`expected.err`): two packages
  declare `abs` with different signatures.
- `tests/link/ffi_package_declare_root_clash/` (`expected.err`), if the rule
  needs a new check.

### Docs

LANGUAGE.md "Calling C" gets the rule: a declared function's symbol is its
name as written, in whatever package declares it. Duplicate declarations must
agree. Cite the tests. interop.md gets one sentence: a package or `std/`
module may declare C functions, and they bind to the C name.

## Stage B — sqlite-link

**Owns:** `runtime/sqlite/sqlite3.c`, `runtime/sqlite/sqlite3.h`, `runtime/sqlite/README.md`, `runtime/sqlite/LICENSE*`, `scripts/build.sh`, `src/run-cache.ts`, `src/compile.ts`, `tests/run.js`, `tests/runtime-budgets.js`, `tests/nish/run.ts`, `tests/link/sqlite_link*/**`, `THIRD_PARTY_NOTICES.md`, `.github/workflows/release.yml`, `scripts/check-filenames.mjs`, `biome.json`, `knip.json`, `docs/guide/using-nish/cli.md`, `docs/INSTALL.md`, `.claude/architecture.md`, `docs/ARCHITECTURE.md`, `docs/wp7-runtime.md`, `tests/self/goldens/checked/**` (generated)

### Vendoring

Take the newest SQLite release's amalgamation zip from sqlite.org. The
container reaches it. Keep only `sqlite3.c` and `sqlite3.h`, byte for byte.
`runtime/sqlite/README.md` records the version, the URL, the SHA3-256 that
sqlite.org's download page publishes (check it), the date, that the code is
public domain, and how to bump it. No edits to the vendored files. Reviewers
treat `runtime/sqlite/sqlite3.{c,h}` as vendored and do not read them.

### When it links

In scripts/build.sh, when an input `.ll` mentions `@sqlite3_` or
`@nish_sqlite_`, compile and link every `runtime/sqlite/*.c`. Stage C adds
`nish-sqlite.c` to that directory and changes no build logic. Use the
profile's optimisation level and its `--cpu`. Measure two choices and record
them:

- `sqlite3.c` as a plain object rather than LTO bitcode, so a link does not
  re-optimise 250k lines. The adapter should stay LTO bitcode in the speed
  profile, so a Nish call into it can inline down to the SQLite call.
- `-lm`, plus `-lpthread`/`-ldl` only if the options chosen need them. With
  `SQLITE_OMIT_LOAD_EXTENSION` and `SQLITE_THREADSAFE=0` they should not.

Default options are sqlite.org's "Recommended Compile-time Options":
`SQLITE_DQS=0`, `SQLITE_DEFAULT_MEMSTATUS=0`,
`SQLITE_DEFAULT_WAL_SYNCHRONOUS=1`, `SQLITE_LIKE_DOESNT_MATCH_BLOBS`,
`SQLITE_MAX_EXPR_DEPTH=0`, `SQLITE_OMIT_DEPRECATED`,
`SQLITE_OMIT_PROGRESS_CALLBACK`, `SQLITE_OMIT_SHARED_CACHE`,
`SQLITE_USE_ALLOCA`, `SQLITE_OMIT_LOAD_EXTENSION`, and `SQLITE_THREADSAFE=0`
(`=2` under `--threads`). Leave `SQLITE_OMIT_AUTOINIT` out unless Stage C's
adapter calls `sqlite3_initialize`; Stage C may add it then.

`NISH_SQLITE_CFLAGS`, when set, is appended after the defaults. This is how
the later session passes `-O3 -march=native -fprofile-use=…` and `OMIT_`
options with no hand-written build line. It is part of the cache key. A program
whose IR does not touch SQLite never compiles it, and pays nothing.

### The cache

The SQLite objects are cached beside the runtime's in the runtime cache
(`--runtime-from`, src/compile.ts:1764). Their key covers the
`runtime/sqlite/*.c|h` hashes, the profile, `--cpu`, `--threads`, `cc`, the
options and `NISH_SQLITE_CFLAGS`. The `nish run` key (src/run-cache.ts:283)
covers the same. tests/run.js keeps its own list of runtime inputs
(131-151); move it with them. Record in the PR: a cold link (cache empty) and
a warm one, in seconds.

### Profiles

The speed, size and debug profiles link it. For wasm, wasi and napi, make it
work if that is cheap. wasi has a libc, but no file locking: say what works.
Otherwise refuse with one clear `build.sh` error that names the profile. Test
the path you choose.

### Licensing

`THIRD_PARTY_NOTICES.md` gets a row: `runtime/sqlite/sqlite3.c`,
`sqlite3.h`, SQLite amalgamation, version, public domain. The SQLite blessing
replaces the licence text. Do whatever `node tests/run.js third-party-licence`
and the release.yml presence gates require, including a licence or notice
file in `runtime/sqlite/` if the check insists on one. The PR body names the
upstream, version, licence and what was taken (licensing.md, "What a copy
must carry" 5).

### Tests

`tests/link/sqlite_link/`: `declare function sqlite3_libversion_number(): i32`
and `sqlite3_libversion(): string`. It prints the vendored version, through
`--link` and through `nish run`, and through the warm cache. Also cover a
program that declares nothing from SQLite: its link line and binary are
unchanged, so pin that no sqlite object is compiled. If the runtime budgets
check measures all of `runtime/`, exclude the vendored files explicitly. The
adapter gets its own `*_TEXT_BUDGET` in Stage C.

### Docs

cli.md: a program that calls into SQLite links it automatically, what
`NISH_SQLITE_CFLAGS` does, and the cold-link cost. .claude/architecture.md and
docs/ARCHITECTURE.md: runtime/sqlite/ is an optional unit that the IR selects,
not one of the always-linked units.

## Stage C — std-sqlite

**Owns:** `std/sqlite.ts`, `runtime/sqlite/nish-sqlite.c`, `src/std-modules.ts`, `tests/link/std_sqlite*/**`, `tests/cases/*sqlite*`, `tests/runtime-budgets.js`, `tests/run.js`, `std/README.md`, `docs/guide/using-nish/sqlite.md`, `docs/guide/using-nish/standard-library.md`, `scalar.config.json`, `docs/LANGUAGE.md`, `docs/AI.md`, `llms.txt`, `.github/workflows/release.yml`, `tests/differential/**` (generated), `tests/self/goldens/checked/**` (generated)

### The C adapter

`runtime/sqlite/nish-sqlite.c` adapts SQLite's API to what the FFI can carry,
and nothing else: no SQL, no JSON, no application logic. Per call:

- Look up the handle, checking its generation.
- Make the one SQLite call.
- Return an `i32` code or the value.

Strings and buffers are borrowed for the call only. Every function is
`nish_sqlite_*`. It holds the open, prepare and finalize out-pointers, the
`SQLITE_TRANSIENT` binds, and `sqlite3_errmsg` copied out on error.

### The API

A sketch. Stage C owns the final names, and must keep the shape:

```ts
import { Database, Statement, SqliteError, SQLITE_OPEN_READWRITE, SQLITE_OPEN_CREATE, SQLITE_ROW, SQLITE_DONE } from "nish/sqlite"

const db = Database.open(path, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE)   // Result<Database, SqliteError>
db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL")               // Result<…, SqliteError>
const st = db.prepare("SELECT … WHERE p.id = ?")                             // Result<Statement, SqliteError>, prepared once, reused
st.bindI64(1, id); st.bindF64; st.bindText(i, s); st.bindTextBytes(i, buf, off, len); st.bindBlob(i, buf, off, len); st.bindNull(i)
st.step()              // SQLITE_ROW | SQLITE_DONE, or an error
st.columnI64(c); st.columnF64(c); st.columnType(c); st.columnBytes(c)
st.columnInto(c, buf, at)   // copies text/blob bytes into buf at `at`, answers the length; no allocation
st.reset(); st.clearBindings(); st.finalize()
db.lastInsertRowid(); db.changes(); db.begin(); db.commit(); db.rollback(); db.close()
// SqliteError: code, extendedCode, message (message allocated only on failure)
```

Errors are `Result`s, in the style of the rest of std/: read `std/net` and
`std/json-value.ts` and match them. On the hot path (bind, step, column
reads), returning a `Result` must not allocate. If it does, use the sticky-code
style `JsonWriter` uses (`failed`), and say why in the module header. Measure
it, do not guess. Look at whether `using` works on an ordinary class with
`[Symbol.dispose]`. If it does, offer `using db = …`.

### Tests

`tests/link/std_sqlite*`, each a program with expected stdout:

- Open `:memory:` and a file in a temp dir.
- exec of DDL and pragmas: `journal_mode` answers `wal` on a file.
- Prepare, bind each of i64, f64, text from a string, text from a window,
  blob and null; step; read each back with its type.
- Reset and rebind across 1,000 iterations.
- `lastInsertRowid` and `changes`, including an `ON CONFLICT DO NOTHING`
  that changes 0.
- Begin, commit and rollback.
- `columnInto` with a buffer too small: it answers the needed length and
  writes nothing past the buffer.
- An arena-flat loop: 100,000 steps and column reads over a reused statement.
  The arena's high-water mark after the loop equals the one after the first
  row. Find how std/json-value pins "keeps the arena flat" and do the same.

Negatives, each with its exact message or code:

- Invalid SQL answers an error with `SQLITE_ERROR` and SQLite's
  `near "…": syntax error`.
- Opening a missing file with `SQLITE_OPEN_READONLY`.
- A bind index out of range (`SQLITE_RANGE`).
- A constraint violation (`SQLITE_CONSTRAINT_*` extended code).
- A finalized statement used again, and a closed database used again: both
  `SQLITE_MISUSE`, never a crash.
- `columnInto` with `at` past the buffer: a Result or panic, as the module
  defines it, tested.
- A program that keeps a `Statement` past its `Database`'s close.

### Capabilities

- `tests/link/std_sqlite_deny_ffi/`: `args` holds `--deny ffi`, with an
  `expected.err` naming `ffi` and the chain through `std/sqlite.ts`.
- One std_sqlite program has an `expected.caps.json` showing `ffi`.
- A program that imports only a type from `nish/sqlite` reaches nothing.
  Test it if the type-only import compiles.

### Docs

- `docs/guide/using-nish/sqlite.md`: a new page. Opening, pragmas (WAL and
  `synchronous=NORMAL`), prepare-once-and-reuse, binding, reading into a
  buffer, transactions, errors, threads, what `--deny ffi` and the file system
  mean (Decision 5), and the build knobs from Stage B. Every example is fenced
  `ts nish:ok`, so `npm test` compiles it. Follow docs/README.md "Writing a
  guide page".
- Its route `/sqlite` under using-nish in scalar.config.json.
- A row in std/README.md.
- A pointer from standard-library.md.
- Add `sqlite` to each of the three `for f in …` presence gates in
  `.github/workflows/release.yml` (321, 412, 537). `tests/run.js` 5430-5452
  requires every std module in all three. This is the only workflow edit in
  the run, and it is mechanical.
- docs/LANGUAGE.md only if a rule changes. A new std module is normally a
  guide matter here; check how `nish/json-typed` and `nish/random` are listed.
- Give the adapter a `*_TEXT_BUDGET` in tests/runtime-budgets.js if that file
  measures every runtime unit.

## Stage D — sqlite-bench

**Owns:** `bench/sqlite/**`, `bench/README.md`, `std/sqlite.ts`, `runtime/sqlite/nish-sqlite.c`, `docs/guide/using-nish/sqlite.md`, `knip.json`, `tests/self/goldens/checked/**` (generated)

Stage D starts after Stage C merges, so sharing std/sqlite.ts and the adapter
is sequential, not concurrent. It may change them only to cut cost, never
their behaviour. Every test from Stage C stays green unmodified.

### The data

Use the challenge's `schema.sql`, copied into `bench/sqlite/schema.sql` with
its source URL. It is three tables, `users`, `posts` and `likes`, with the
indexes `posts_created_at_id_idx`, `posts_user_id_idx` and
`likes_post_id_idx`. Generate a deterministic seed at the challenge's sizes
(50k users, 500k posts, 2M likes) into a file in WAL mode, with one fixed
PRNG, through SQL or the C twin. Nothing is downloaded at bench time.

### The twins

Each workload is a Nish program and a C program doing the same loop on the
same file, `clang -O3`, both linking the same vendored SQLite with the same
options:

1. **Point lookup**: the challenge query, prepared once and reused, over N
   random ids:
   `SELECT p.id, p.body, p.created_at, u.username, (SELECT count(*) FROM likes l WHERE l.post_id = p.id) FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`.
   Per row: bind, step, read every column, text into a buffer, reset.
2. **Feed**: the same select with `ORDER BY p.created_at DESC, p.id DESC LIMIT 20`.
   All 20 rows read, then reset.
3. **Insert in WAL**: `INSERT INTO posts (user_id, body) VALUES (?, ?) RETURNING id, created_at`
   in autocommit, with `synchronous=NORMAL`. Also run `begin`, then N inserts,
   then `commit`, so per-call cost can be told apart from fsync.

`bench/sqlite/run.mjs` builds both, checks that their checksums agree
(`--validate`, cheap enough for CI), and then times them. It prints ns/op per
workload for each, and the difference: the cost per call that Nish adds.

### Driving it to zero

Measure the way `.claude/testing.md`'s "A `Measured:` trailer" requires,
with the noise band taken from a byte-identical rerun. Then read the IR of the
Nish hot loop. Look for:

- the bind and column calls inlined through LTO into the SQLite call;
- no Result construction or allocation on the hot path;
- no NUL scan where a window bind was possible;
- no handle check that could be hoisted.

Fix what the IR shows, and re-measure. The PR states each workload's overhead
per call, with its band, before and after.

### Docs

`bench/README.md` gets how to run it. The sqlite guide page gets "What it
costs" with the figures. Neither is docs/BENCHMARKS.md, which is generated.

## Stage E — pbkdf2

**Owns:** `std/crypto/hmac.ts`, `tests/link/std_pbkdf2*/**`, `docs/security/**`, `std/README.md`, `docs/guide/using-nish/standard-library.md`, `tests/self/goldens/checked/**` (generated)

### The function

SCRAM-SHA-256 (RFC 5802, RFC 7677) needs `Hi()`, which is
PBKDF2-HMAC-SHA256 (RFC 8018 §5.2). Write it beside `hmacSha256` in
`std/crypto/hmac.ts`, from the RFC, in the module's own structure. It is an
idea, not a copy: cite the RFC, and name the closest upstream if the code
follows one (licensing.md, "Name the closest upstream").

It follows CLAUDE.md's Secret rule:

- The password comes in as a `Secret<u8[]>`, and the derived key goes out
  as one.
- Each `U_i` and `T_i` is computed inside `expose` and `wipe`d before
  return.

Read `docs/security/README.md` before starting, and the existing HMAC record.
`iterations` must be at least 1, and `dkLen` at least 1 and at most
`(2^32 - 1) * 32`. Anything outside that answers a Result error and never
panics. An `i32` iteration count up to the 2^31 - 1 a server may ask for is
fine.

### Tests

`tests/link/std_pbkdf2`:

- the RFC 7914 §11 PBKDF2-HMAC-SHA256 vectors (c = 1 and c = 80000, P =
  "passwd" and "Password");
- a dkLen of 20 and of 64;
- negatives for 0 iterations and a dkLen of 0;
- a check that the wipe survives `opt -O2`, the way the
  `nish:secret: the wipe survives opt -O2` check pins it.

### Docs

The function goes in the record that covers `std/crypto/hmac.ts`, in the
format that `docs/security/README.md` → "Writing a record" requires. Note
what a wipe cannot reach. The function also goes in the hmac row of
`std/README.md` and in standard-library.md.

## Stage F — std-postgres

**Owns:** `std/postgres.ts`, `std/postgres/**`, `src/std-modules.ts`, `tests/link/std_postgres*/**`, `tests/postgres/**`, `tests/run.js`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.claude/hooks/session-start.sh`, `std/README.md`, `docs/guide/using-nish/postgres.md`, `docs/guide/using-nish/standard-library.md`, `scalar.config.json`, `docs/security/postgres.md`, `docs/security/README.md`, `docs/LANGUAGE.md`, `docs/AI.md`, `llms.txt`, `tests/self/goldens/checked/**` (generated)

### Decision — Nish over the wire protocol, not libpq

The client is written in Nish, over protocol 3.0 on `nish:net`, with no C.

- It runs inside the program's own readiness loop (the program is the loop,
  as in `nish/net/tls-tcp`), so a server can pipeline queries on one
  connection.
- It reads rows straight into the caller's buffers. libpq copies every result
  into a `PGresult` it allocates.
- It needs no system library on the build machine.
- It reaches the `net` capability, not `ffi`, so `--deny net` refuses an
  importer that connects, and `--deny ffi` does not.

What it gives up, all because of what `nish:net` and std/ have today:

- **No TLS.** std/ has a TLS 1.3 server but no client.
- **No host names.** `nish:net` takes numeric hosts only.
- **No Unix-domain sockets.**
- **No MD5, GSS or SSPI authentication.**

The guide page lists each limit. A server that requires TLS, or offers only
MD5, is refused with one clear error.

### Two layers

1. **`PgProtocol`, the sans-IO core.** It encodes front-end messages into a
   caller's `u8[]` and decodes back-end messages from bytes it is fed. Every
   call answers what the connection wants next, the way `TlsTcpServer` does.
   - No socket, no clock, no allocation per row.
   - Every length field is checked against a cap before it is trusted.
   - No input can panic or read outside its window.
   - It is the layer a server using its own `pollWait` loop drives, with
     queries pipelined: several `Bind`/`Execute` pairs before one `Sync`.
2. **`PgConnection`.** It drives the core over `tcpConnect`, `netRead` and
   `netWrite`, with a private poll, for a program that wants
   `connect(...)` → `query` → rows. Its waits are bounded by a timeout the
   caller passes, so a dead server is an error, not a hang.

### Authentication

- **Trust and cleartext.** Cleartext takes the password as `Secret<u8[]>`.
- **SCRAM-SHA-256** (RFC 5802, RFC 7677):
  - client-first with a nonce from the OS entropy the runtime already
    exposes;
  - `SaltedPassword` from Stage E's PBKDF2, and `ClientKey`, `StoredKey`,
    `ClientSignature` and `ClientProof` through `nish/crypto/hmac` and
    `sha256`, each a `Secret` and wiped;
  - the server's `ServerSignature` verified in constant time
    (`nish/crypto/ct`) before `AuthenticationOk` is believed;
  - `SCRAM-SHA-256-PLUS` (channel binding) is not offered, since there is no
    TLS.
- **MD5, GSS, SSPI and the KRB methods** answer
  `PG_ERR_AUTH_UNSUPPORTED`, naming the method.
- `SSLRequest` is never sent. A server whose `pg_hba` demands `hostssl`
  answers its own error, which surfaces as a `PgError`.

### Queries

- `exec(sql)`: the simple query protocol, for DDL, `SET`, `BEGIN` and
  `COMMIT`. Several statements are allowed, and each command tag is read.
- `prepare(name, sql, paramTypes)`: `Parse` with the parameter OIDs, then
  `Describe`, so the result columns' types are known once. Reused across
  executes, the way `std/sqlite` is.
- Bind and execute:
  - Parameters are `int8` and `float8` in binary format, `text` and `bytea`
    in binary (text from a string or from a window of a `u8[]`), and `null`.
  - Result columns are requested in binary for `int8`/`int4`/`float8`/`bool`
    and in text for the rest.
  - `columnI64`, `columnF64`, `columnIsNull`, `columnLength`, and
    `columnInto(col, buf, at)` copy from the receive buffer into the
    caller's, with no allocation.
- `CommandComplete` gives `rowsAffected`. `RETURNING` rows are read like any
  others. There is no "last insert id" in PostgreSQL; the guide page says to
  use `RETURNING`.
- `ErrorResponse` becomes `PgError` with the severity, SQLSTATE (`C`) and
  message (`M`), plus detail and hint when present. It is allocated only on
  failure. After an error in an extended-query batch, the client
  resynchronises at `ReadyForQuery`, so the connection stays usable.
- `NoticeResponse` and `ParameterStatus` are consumed. `ParameterStatus` keeps
  `server_version` and `client_encoding`, which is required to be UTF8 or the
  connection is refused.
- `begin()`, `commit()` and `rollback()` are convenience wrappers over `exec`.
  `ReadyForQuery`'s status byte answers whether the connection is inside a
  transaction.
- `Terminate` and close.

Errors are `Result`s in the style of std/ (match `std/sqlite` and
`std/net`). On the hot path a `Result` must not allocate; measure it.

### Tests

- **Transcripts, with no server.** Byte-exact front-end messages for
  startup, `Parse`/`Bind`/`Execute`/`Sync` and `Terminate`, and a decode of
  recorded back-end messages. Use the SCRAM exchange from RFC 7677 §3 as
  the auth vector.
- **Seeded fuzz of the decoder** over random and truncated messages. It never
  panics and never reads past its window, in the manner of
  `tests/link/std_json_tokenizer`.
- **Live tests against PostgreSQL 16:**
  - The harness, in `tests/postgres/`, runs `initdb` into a temp dir and
    starts `postgres` on a free port bound to 127.0.0.1. It creates one user
    with a SCRAM password and one with trust auth, and stops the server when
    the run ends.
  - Each `tests/link/std_postgres*` program connects, creates tables,
    inserts with every bind type through a prepared statement reused 1,000
    times, and reads it back.
  - It checks `RETURNING`, `rowsAffected`, `ON CONFLICT DO NOTHING` (0
    rows), a transaction that rolls back, a pipelined batch of 20
    `Execute`s, and an arena-flat read loop over 100,000 rows.
- **Negatives, each with its SQLSTATE or code:**
  - a wrong password: `28P01`;
  - a syntax error: `42601`, with the server's message;
  - a unique violation: `23505`, after which the connection still serves a
    query;
  - a refused port: the `-111` from `nish:net`, as a Result;
  - a server that offers only MD5: `PG_ERR_AUTH_UNSUPPORTED`;
  - a forged `ServerSignature` from a fake server in the harness: refused;
  - a connect timeout;
  - `--deny net` refusing an importer, with `expected.err`;
  - an `expected.caps.json` showing `net` and no `ffi`.
- **The live tests must not skip in CI.**
  - Install `postgresql` in the `test` job of `.github/workflows/ci.yml`:
    the apt package and nothing else, with no service container.
  - Make `.claude/hooks/session-start.sh` install it if it is absent.
  - A missing PostgreSQL locally is reported as a `DEGRADED:` reason,
    like a missing LLVM tool, never as a silent skip.

### Docs

- `docs/guide/using-nish/postgres.md`, a new page: connecting, the limits
  (no TLS, numeric hosts, the auth methods), prepared statements, binding,
  reading into a buffer, pipelining from your own loop, transactions,
  errors and SQLSTATEs, and capabilities. Every example is fenced
  `ts nish:ok`.
- Its route `/postgres` in scalar.config.json.
- A row in std/README.md.
- The `std-modules.ts` registry entry.
- `postgres` in each of the three release.yml presence gates.
- `docs/security/postgres.md`, a record for a parser of untrusted network
  input: the caps, what can and cannot panic, the SCRAM verification, and
  what a wipe cannot reach. Add it to the list in `docs/security/README.md`.

## Merge order

| Stage | Develops | Merges after |
| --- | --- | --- |
| A `ffi-package-symbols` | at once | — |
| B `sqlite-link` | at once | — |
| E `pbkdf2` | at once | — |
| C `std-sqlite` | when A, B and E have merged | A, B, E |
| D `sqlite-bench` | when C has merged | C |
| F `std-postgres` | when C has merged | C, E |

- **A, B and E run in parallel.** Their `Owns` sets are disjoint apart from
  the generated goldens.
- **C waits for A, B and E.** It needs A's fix to link at all, and B's
  build.sh to link with no hand-written line. It also shares
  `std/README.md` and `standard-library.md` with E.
- **D and F run in parallel once C has merged.** Their sets are disjoint.
- **F waits for C** because both edit the shared registries:
  `src/std-modules.ts`, the release.yml gates, `scalar.config.json` and
  `std/README.md`.

## Acceptance criteria

1. A program importing `nish/sqlite` opens a file database, creates a table,
   inserts with bound i64, f64, text, blob and null, and prints the values
   read back. It does so under plain `nish run app.ts`, and under
   `nish app.ts -o out/ --link app`, with no extra flags or build line.
2. SQLite failures answer a `Result` error with its code and message, never a
   crash. This covers invalid SQL, a missing file opened read-only, a bind
   index out of range, a constraint violation, and use after finalize or
   close.
3. `PRAGMA journal_mode=WAL` on a file database answers `wal`. `begin`,
   `commit` and `rollback`, `lastInsertRowid` and `changes` match SQLite,
   including 0 changes for `ON CONFLICT DO NOTHING`.
4. Text read into a caller buffer allocates nothing. The arena does not grow
   across 100,000 SQLite row reads on a reused statement.
5. `nish run app.ts --deny ffi` on a program that calls `nish/sqlite` exits 1,
   naming `ffi` and the chain through `std/sqlite.ts`.
6. A `declare function` in a `node_modules` package links against the bare C
   symbol and runs. Two packages that declare one C name differently are
   refused.
7. `node bench/sqlite/run.mjs` runs point lookup, the 20-row feed and
   insert-in-WAL, through Nish and through C, on the challenge schema at the
   challenge's sizes. It prints ns/op for each and the per-call cost Nish
   adds, and the merged PR records them with their noise band.
8. PBKDF2-HMAC-SHA256 from `nish/crypto/hmac` reproduces the RFC 7914 §11
   vectors.
9. A program importing `nish/postgres`, under plain `nish run`, does all of
   this against a local PostgreSQL 16 at 127.0.0.1:
   - connects with SCRAM-SHA-256;
   - creates a table;
   - inserts int8, float8, text, bytea and null through a prepared statement
     executed repeatedly;
   - reads the rows back, text into a caller buffer;
   - prints the expected values.
10. PostgreSQL failures answer a `Result` with the SQLSTATE, never a crash or
    a hang:
    - a wrong password: `28P01`;
    - a syntax error: `42601`;
    - a unique violation: `23505`, after which the connection is still
      usable;
    - a refused port;
    - an MD5-only server: unsupported auth.
11. `--deny net` refuses a program that connects with `nish/postgres`, and
    `--deny ffi` does not.
12. The `sqlite` and `postgres` guide pages are reachable at their routes in
    `scalar.config.json`. `std/README.md` lists both modules,
    THIRD_PARTY_NOTICES lists the amalgamation, and
    `node tests/run.js third-party-licence` and `node docs/check-links.mjs`
    pass.
13. `npm pack --dry-run` includes `runtime/sqlite/sqlite3.c`,
    `std/sqlite.ts` and `std/postgres.ts`.
14. On `main` after the last merge:
    - `npm run check`, `npm run lint` and an undegraded `npm test` are green;
    - CI's `test` job ran the live PostgreSQL tests, not skipped them.
