---
name: std/sqlite and std/postgres — database clients in the standard library
overview: Add `nish/sqlite`, a SQLite client on a vendored public-domain amalgamation and a thin C adapter, linked automatically when a program uses it and measured per call against C on the $12-server challenge schema; and `nish/net/postgres`, a sans-IO PostgreSQL client for the multicore Conduit challenge, with SCRAM-SHA-256 on a new PBKDF2, a pool, a carrier on the program's own loop, and a benchmark against libpq. Fixes the compiler bug that keeps a `declare function` in any package from binding to its C symbol, which the SQLite module needs first.
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
  - id: pg-protocol
    title: "feat(runtime): add nish/net/postgres, a sans-IO PostgreSQL client"
    goal: A sans-IO PostgreSQL protocol-3 client in std/net/postgres — startup, SCRAM-SHA-256, the extended query protocol with prepared statements and capped pipelining, errors and notices, and text results read as byte windows with the decoders the Conduit spec needs — proven by exchanges recorded from PostgreSQL 18 and replayed byte for byte in npm test
    verification: npm run check, npm run lint, npm run lint:dead, node tests/run.js std_postgres, node tests/run.js base64, node tests/run.js x509, node docs/check-links.mjs, then an undegraded npm test, all green with the goldens regenerated and read
    status: pending
    todos:
      - id: pg-base64
        content: Lift padded standard base64 out of std/crypto/x509.ts into one exported copy in std/crypto/base64url.ts and make x509 use it — see Stage F1, Base64
        status: pending
      - id: pg-core
        content: Write the sans-IO connection state machine in std/net/postgres.ts with bounded framing, startup, ParameterStatus, BackendKeyData and ReadyForQuery — see Stage F1, The core
        status: pending
      - id: pg-scram
        content: Implement SCRAM-SHA-256 over SASL on Stage E's PBKDF2 with gs2 header n,, and the server signature checked, and record why MD5 is left out — see Stage F1, Authentication
        status: pending
      - id: pg-extended
        content: Implement Parse, Bind, Describe, Execute, Sync and Close with named statements prepared once per connection, Sync groups pipelined under a cap with a FIFO, and recovery to the next Sync after an error — see Stage F1, Queries and pipelining
        status: pending
      - id: pg-results
        content: Expose result columns as windows into the receive buffer, with the int8, int4, bool, NULL, timestamptz and text[] decoders and the text[] parameter encoder — see Stage F1, Results
        status: pending
      - id: pg-replay
        content: Record exchanges from a real PostgreSQL 18 and replay them byte for byte in tests/link/std_postgres*, plus the negatives — see Stage F1, Tests
        status: pending
      - id: pg-docs
        content: Add docs/security/postgres.md, the guide page and its route, std/README.md and the std registry entries — see Stage F1, Docs
        status: pending
  - id: pg-pool
    title: "feat(runtime): a connection pool and an epoll carrier for nish/net/postgres"
    goal: A pool whose size is a cap with each slot's connection built on first use, a carrier that runs it on the program's own nish:net loop so a query never blocks HTTP, and a CI job that runs the client live against a postgres:18 service container
    verification: npm run check, npm run lint, npm run lint:dead, node tests/run.js std_postgres, the new live suite against PostgreSQL 18 locally with no skips, node docs/check-links.mjs, then an undegraded npm test, all green with the goldens regenerated and read
    status: pending
    todos:
      - id: pool-cap
        content: Add PgPool to std/net/postgres.ts, a cap on slots with each connection built on first use and requests routed to the least-loaded ready slot — see Stage F2, The pool
        status: pending
      - id: pool-carrier
        content: Write the carrier example on tcpConnect, pollAdd and pollWait, used by the guide page and the live tests — see Stage F2, The carrier
        status: pending
      - id: pool-live
        content: Add the live suite in tests/postgres/ and a CI job on a postgres:18 service container that runs it — see Stage F2, Live tests and CI
        status: pending
      - id: pool-docs
        content: Extend the postgres guide page and security record with the pool and the carrier — see Stage F2, Docs
        status: pending
  - id: pg-bench
    title: "perf(runtime): measure nish/net/postgres against libpq pipeline mode"
    goal: A benchmark on PostgreSQL 18 with the challenge's --dev seed comparing client CPU microseconds per query and queries per second against libpq in pipeline mode, for a primary-key SELECT 16 deep, the article-list query and an INSERT, and changes that drive the added cost toward zero
    verification: node bench/postgres/run.mjs --validate and a full run with Measured lines and noise bands in the PR body, then npm run check, npm run lint, node tests/run.js std_postgres and an undegraded npm test green
    status: pending
    todos:
      - id: pgb-setup
        content: Script the PostgreSQL 18 and --dev seed setup the benchmark runs on, with nothing hard-coded to one machine — see Stage F3, The setup
        status: pending
      - id: pgb-twins
        content: Write the Nish and libpq pipeline-mode twins of the three workloads and bench/postgres/run.mjs — see Stage F3, The twins
        status: pending
      - id: pgb-overhead
        content: Measure client CPU per query with getrusage and the noise band, and drive the Nish cost down in std/net/postgres.ts — see Stage F3, Driving it to zero
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

**Owns:** `std/crypto/hmac.ts`, `tests/link/std_pbkdf2*/**`, `docs/security/crypto-k1.md`, `std/README.md`, `docs/guide/using-nish/standard-library.md`, `tests/self/goldens/checked/**` (generated)

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

## Postgres — what it is for, and the decisions

`nish/net/postgres` is the client for the multicore server challenge
([arjaythedev/multicore-server-challenge](https://github.com/arjaythedev/multicore-server-challenge)).
That challenge is the RealWorld "Conduit" API on PostgreSQL 18, on 8 vCPUs.
In every top entry, Postgres takes 70–80 % of the box (LEADERBOARD.md). So
the client is judged on two things: **round trips**, and **the client CPU it
costs per query**. `docs/wp39-http-server.md` E6 and decision D4 plan it. This
plan supersedes the earlier `std/postgres.ts` stage.

- **P1. Sans-IO, in `std/net/postgres.ts`** (D4), in the style of
  `std/net/http1-server.ts`: bytes in, bytes out. A carrier owns the socket,
  using `tcpConnect` and `pollAdd` on the program's own loop, so a query never
  blocks HTTP. There is no blocking driver. Every call answers what the
  connection wants next, as the other `nish/net` modules do.
- **P2. Authentication is SCRAM-SHA-256** (RFC 5802, RFC 7677) over SASL, as
  `box/setup-box.sh` forces it for 127.0.0.1. With no TLS there is no channel
  binding: the gs2 header is `n,,`, and `SCRAM-SHA-256-PLUS` is never chosen.
  Cleartext `AuthenticationCleartextPassword` and trust are also accepted;
  they are a few lines each.
  - The salted password is Stage E's PBKDF2-HMAC-SHA256, on the `Secret`
    path. The password is a `Secret<u8[]>` end to end, and `ClientKey`,
    `StoredKey`, `ClientSignature` and `ClientProof` are each wiped
    (CLAUDE.md "Security").
  - `ServerSignature` is checked in constant time before
    `AuthenticationOk` is believed.
  - **MD5 is left out.** `setup-box.sh` forces SCRAM, PostgreSQL 18
    deprecates MD5 passwords, and MD5 would need a new `nish/crypto/md5`. The
    security record and the guide page say so. An MD5 request answers a
    defined `PG_ERR_AUTH_UNSUPPORTED`.
- **P3. Padded standard base64 exists once.** SCRAM's messages are base64, and
  `std/crypto/x509.ts` already has the codec inside `pemToDer`. Lift it into
  `std/crypto/base64url.ts` as exported `base64Encode` and `base64Decode`
  (RFC 4648 §4, padded, canonical), beside `base64url`, and make `x509.ts`
  import it. No second copy, and no new module, so the registries and release
  gates are untouched.
- **P4. Text format everywhere.** Results are read as byte windows into the
  receive buffer: a column is `(offset, length)` or NULL. A caller copies
  bytes straight into JSON, with no string per column. This is what the
  fastest C entry, c-iouring-tigokraft, does. Binary format comes in only if
  Stage F3 measures a win.
- **P5. Pipelining with a cap.** Many requests' Bind/Execute/Sync groups are
  in flight on one connection without waiting for each other.
  - At most `maxInFlight` groups go out per connection (default 16, as
    c-iouring-tigokraft measured: 2–4 starve the backends, 8–64 are equal).
    The rest wait in a FIFO, so requests are served in arrival order.
  - Each Sync group is its own implicit transaction. The caller learns when
    its group's `ReadyForQuery` has arrived. That is the commit that the
    challenge's rule 6 requires before a response.
- **P6. Bounded everything.** Every length field is checked against a cap
  before it is trusted. The receive and send buffers have fixed maximums. A
  malformed or oversized message is a defined `PG_ERR_*` and closes the
  connection. It never panics and never grows a buffer without bound.

## Stage F1 — pg-protocol

**Owns:** `std/net/postgres.ts`, `std/crypto/base64url.ts`, `std/crypto/x509.ts`, `src/std-modules.ts`, `tests/link/std_postgres*/**`, `tests/link/std_base64*/**`, `tests/postgres/recordings/**`, `tests/postgres/record.mjs`, `.github/workflows/release.yml`, `std/README.md`, `docs/guide/using-nish/postgres.md`, `docs/guide/using-nish/standard-library.md`, `scalar.config.json`, `docs/security/postgres.md`, `docs/security/README.md`, `docs/security/crypto-x509.md`, `docs/wp39-http-server.md`, `llms.txt`, `tests/self/goldens/checked/**` (generated)

Shared files: `src/std-modules.ts`, `release.yml`, `std/README.md`,
`scalar.config.json` and `standard-library.md` are also edited by Stage C,
and `std/README.md` by Stage E. The edits are one row or one name each in a
list. Whichever stage reaches its merge second runs `npm run sync-main` and
keeps both entries. See "Merge order".

### Base64

Move the codec and its comments out of `x509.ts` unchanged, into
`base64url.ts`, as `base64Encode(data: u8[]): string` and
`base64Decode(text: string): u8[] | null`, strict and canonical. `x509`'s
tests and `docs/security/crypto-x509.md` must still hold. Give it its own
vectors (RFC 4648 §10) and negatives: bad padding, a non-canonical last
sextet, and a character outside the alphabet.

### The core

`PgConnection` holds the state of one connection.

- Startup message: protocol 3.0, `user`, `database`, `client_encoding=UTF8`,
  `DateStyle=ISO`, `TimeZone=UTC`, `application_name`, and caller-supplied
  session options such as `plan_cache_mode` and `jit`.
- Every `ParameterStatus` is consumed. `server_version` and
  `client_encoding` are kept, and an encoding other than UTF8 is refused.
- `BackendKeyData` is kept, for a cancel the carrier may send later; cancel
  itself is not in scope.
- `ReadyForQuery` exposes its transaction status, `I`, `T` or `E`.
- `NoticeResponse` is parsed and counted. The last one's fields are readable,
  and nothing accumulates.
- Framing: a 1-byte type plus a 4-byte length. The length is checked against
  `maxMessage`, default 1 MiB and set by the caller, before any byte of the
  body is read.

### Authentication

The SCRAM state machine follows P2:

- client-first with a nonce from the runtime's entropy;
- the server-first message parsed strictly (`r=`, `s=`, `i=`), with the
  server's nonce required to start with ours and the iteration count bounded;
- client-final with the proof;
- server-final checked.

Each failure is its own `PG_ERR_*`.

### Queries and pipelining

- `prepare(name, sql, paramOids)`: `Parse` and then `Describe` of the
  statement, once per connection. The connection remembers which names it
  has prepared, so a pool can prepare lazily.
- A group is one request: one or more Bind/Execute pairs and one Sync.
  `Close` is available for statements and portals.
- Parameters are text format. `null` is length -1. A `text[]` parameter is
  encoded as an array literal from a list of byte windows, with quoting and
  backslash escapes.
- The cap and FIFO follow P5. A caller tags each group, and learns per group:
  - its rows and `CommandComplete` tags, with the parsed row count for
    INSERT, UPDATE, DELETE and SELECT;
  - its error, if any;
  - its `ReadyForQuery`, which means committed.
- After an `ErrorResponse`, the server skips to the next Sync. The client marks
  the rest of that group failed, and resumes cleanly with the next group.
  Other requests' groups are unaffected.
- `ErrorResponse` becomes `PgError` with the severity, SQLSTATE (`C`) and
  message (`M`). Detail, hint, constraint and position are kept when present.
  These are allocated only on failure, never on the hot path.

### Results

`DataRow` columns are windows into the receive buffer, valid until the
group's next row is read.

Decoders work on windows and allocate nothing:

- `int8` and `int4` to `i64`;
- `bool` (`t` and `f`);
- NULL;
- `timestamptz` text (`YYYY-MM-DD HH:MM:SS[.ffffff]+00`) to RFC 3339 UTC with
  exactly 3 fractional digits, truncated, written into a caller's `u8[]`.
  This is the challenge's SPEC.md "Formats" rule;
- the `text[]` literal (`{a,"b c","d\"e",NULL}`) walked element by element,
  quoting and escapes included, each element unescaped into a caller buffer.
  The reference SQL returns `tag_list` this way.

Test each decoder against PostgreSQL's own output, from recordings: an empty
array, a quoted element, an escape, and a NULL element.

### Tests

- **Recordings.** `tests/postgres/record.mjs` drives a real PostgreSQL 18 and
  writes each exchange's bytes, both directions, into
  `tests/postgres/recordings/`. Install `postgresql-18` from
  apt.postgresql.org in the worker container; the network allows it. The
  recordings cover:
  - SCRAM success;
  - SCRAM with a wrong password (`28P01`);
  - prepare and execute for each type the Conduit SQL returns (bigint, int,
    text, timestamptz, bool, `text[]`, NULL);
  - a 16-deep pipeline;
  - an error mid-pipeline (`23505` in group 3 of 5, groups 4 and 5 fine);
  - INSERT, UPDATE and DELETE tags;
  - a notice.
- **Replay.** The `tests/link/std_postgres*` programs replay each recording
  byte for byte. The client's output must equal the recorded front-end bytes,
  except for SCRAM's client nonce. Seed it through a test-only entropy hook,
  or record with a fixed nonce. Decoded values go to expected stdout. `npm
  test` needs no server.
- **Negatives:**
  - a malformed message (a bad type byte, or a length under 4);
  - an oversized message, over `maxMessage`;
  - truncated input at every byte offset of a recording;
  - a forged `ServerSignature`;
  - a server nonce that does not extend ours;
  - an iteration count over the bound;
  - an MD5 request;
  - a `text[]` literal with an unterminated quote;
  - a seeded fuzz of the decoder that never panics, in the manner of
    `tests/link/std_json_tokenizer`.
- **Capabilities.** The module is sans-IO, so it reaches no `net` capability
  itself. Pin that with an `expected.caps.json`.

### Docs

- `docs/security/postgres.md`, a new record in the format of
  `docs/security/README.md` → "Writing a record". It covers:
  - the parser of untrusted network input: caps, what can and cannot panic,
    what a malformed message does;
  - SCRAM, and what a wipe cannot reach;
  - why MD5 and TLS are absent.
  List it in `docs/security/README.md`.
- `docs/guide/using-nish/postgres.md` and its route `/postgres` in
  scalar.config.json. It covers connecting through a carrier: give a minimal
  one here, and Stage F2 adds the pool. It also covers prepared statements,
  a pipelined group, reading windows and decoders, errors and SQLSTATEs, and
  the limits: no TLS, SCRAM, cleartext or trust only, numeric hosts.
- `std/README.md` rows: postgres, and base64 in the base64url row.
- `standard-library.md`.
- `net/postgres` in the std registry and in the three release.yml presence
  gates.
- Mark E6 progress in `docs/wp39-http-server.md`.

## Stage F2 — pg-pool

**Owns:** `std/net/postgres.ts`, `tests/link/std_postgres_pool*/**`, `tests/postgres/live/**`, `tests/postgres/carrier.ts`, `.github/workflows/ci.yml`, `docs/guide/using-nish/postgres.md`, `docs/security/postgres.md`, `tests/self/goldens/checked/**` (generated)

F2 starts when F1 has merged, so the shared files are sequential.

### The pool

`PgPool` is sans-IO too. Its size is a cap, and no slot is built at start-up:
a slot's connection is made the first time a request needs it and none is
free, as in N9's discipline (wp39 E6).

- A request goes to the ready slot with the fewest groups in flight.
- When every slot is at its cap, it waits in the pool's FIFO.
- A slot whose connection failed is rebuilt on next use.
- The pool tells the carrier which slots need a socket, and when.
- Statements registered on the pool are prepared on each slot before its
  first use, in the same pipeline as the first request, which saves a round
  trip.

### The carrier

`tests/postgres/carrier.ts`, and the guide page's copy of it, is a small loop:

- `tcpConnect` to `127.0.0.1` (numeric hosts; no DNS in `nish:net`);
- `pollAdd` with each slot's token;
- on readiness, `netRead` into the slot's receive window and `netWrite` of
  what the pool wants sent.

It shares the loop with an HTTP listener, which shows a query not blocking
HTTP: a slow query (`pg_sleep`) is in flight while an HTTP request is served.

### Live tests and CI

- `tests/postgres/live/` runs the carrier and the pool against a real server
  at `$PG_TEST_URL`. Cover:
  - auth;
  - a pipeline of 100 groups through a pool of 4, with the cap at 16;
  - a slot killed with `pg_terminate_backend` and rebuilt;
  - an error mid-pipeline;
  - the Conduit article-list query on a small fixture schema.
- Run it locally against apt's postgresql-18.
- A new CI job in `.github/workflows/ci.yml` on a `postgres:18` service
  container, with the scram-sha-256 password set through the container's env,
  runs the suite. It is a separate job, so `npm test` stays server-free. This
  is the workflow edit the user asked for.

### Docs

The guide page gets the pool and the full carrier. The security record gets
the pool's bounds.

## Stage F3 — pg-bench

**Owns:** `bench/postgres/**`, `bench/README.md`, `std/net/postgres.ts`, `docs/guide/using-nish/postgres.md`, `knip.json`, `tests/self/goldens/checked/**` (generated)

F3 starts when F2 has merged. It may change `postgres.ts` only to cut cost,
never its behaviour, and every F1 and F2 test stays green unmodified.

### The setup

`bench/postgres/setup.sh` does the following:

- installs or uses a PostgreSQL 18;
- applies the challenge's `box/pg-conf.sh` settings, scaled to the machine;
- builds the challenge's `--dev` seed with its `seed/make-seed.sh`, cloned at
  a pinned commit into a scratch directory. That needs Go 1.27 or later and
  `psql`;
- creates role `conduit` with scram-sha-256.

Nothing from the challenge is vendored, except a pinned commit hash and the
SQL quoted with its source.

### The twins

Each workload is a Nish program on `nish/net/postgres` and a C program on
libpq in pipeline mode (`PQenterPipelineMode`, `PQsendQueryPrepared`,
`PQpipelineSync`), doing the same work over one connection, with text
results:

1. a primary-key `SELECT … FROM users WHERE id = $1`, pipelined 16 deep;
2. the article-list query from SPEC.md (`ARTICLE_LIST_SELECT` with
   `ORDER BY a.id DESC LIMIT $2 OFFSET $3`), with every column read and the
   timestamp and `text[]` decoded;
3. an INSERT (`INSERT INTO follows … ON CONFLICT DO NOTHING`, or a comment),
   one per Sync, waiting for `ReadyForQuery`.

`bench/postgres/run.mjs` builds both, checks that their checksums agree
(`--validate`), then reports, for each:

- client CPU µs per query, from `getrusage` of the client process only;
- queries per second.

### Driving it to zero

The number to drive toward 0 is Nish's added client CPU per query over libpq.

- Measure it per `.claude/testing.md` → "A `Measured:` trailer", with the
  noise band from a rerun of an identical build.
- Read the IR of the hot loop, and fix what it shows:
  - allocation per row;
  - a string per column;
  - a copy of the receive buffer;
  - framing work done twice.
- The PR states the before and after figures as `Measured:` lines.
- Try the binary format for `int8` only if it measures a win; per P4, keep
  text otherwise.

## Merge order

| Stage | Develops | Merges after |
| --- | --- | --- |
| A `ffi-package-symbols` | at once | — |
| B `sqlite-link` | at once | — |
| E `pbkdf2` | at once | — |
| F1 `pg-protocol` | at once; picks up E's PBKDF2 by syncing `main` once E merges | E, B |
| C `std-sqlite` | when A, B and E have merged | A, B, E |
| D `sqlite-bench` | when C has merged | C |
| F2 `pg-pool` | when F1 has merged | F1 |
| F3 `pg-bench` | when F2 has merged | F2 |

**F1 overlaps three stages on one-line list edits.** It shares them with C
(`src/std-modules.ts`, the release.yml gates, `std/README.md`,
`scalar.config.json`, `standard-library.md`), with B (the release.yml gates)
and with E (`std/README.md`). F1 merges after B and E, so those two overlaps
are ordered. The first to converge merges
first. The other runs `npm run sync-main`, keeps both entries, and pushes.
This is deliberate: holding F1 until C merged would put the Postgres chain
past the deadline. Every other pair that runs at once is disjoint apart from
the generated goldens.

A parallel session outside this run is writing `std/crypto/bcrypt`. No stage
touches it. A conflict with it in a shared list is resolved the same way, on
sync.

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
8. PBKDF2-HMAC-SHA256 reproduces the RFC 7914 §11 vectors, with the password
   and output as `Secret`s. Padded standard base64 is exported once, and
   `x509` uses it.
9. Through the guide page's carrier, a program on `nish/net/postgres` does all
   of this against PostgreSQL 18 at 127.0.0.1 with SCRAM-SHA-256:
   - prepares the Conduit article-list query once;
   - runs it pipelined;
   - prints the rows: timestamps as RFC 3339 with 3 truncated fractional
     digits, `tag_list` as a JSON array, NULL `bio` as `null`.
10. Through the pool, 100 pipelined groups on 4 connections never exceed 16 in
    flight per connection. Each group learns its own `ReadyForQuery`. An
    error in one group (`23505`) fails only that group, and the connection
    serves the next.
11. A wrong password answers `28P01`. A malformed or oversized message, a
    forged server signature, and an MD5 request each answer a defined error,
    with no panic and no unbounded buffer.
12. `npm test` replays the recorded PostgreSQL 18 exchanges byte for byte with
    no server. A CI job on a `postgres:18` service container runs the live
    suite green.
13. `node bench/postgres/run.mjs` reports client CPU µs per query and
    queries/s for Nish and for libpq pipeline mode: the PK SELECT 16 deep, the
    article list, and an INSERT. The merged PR states them as `Measured:`
    lines with noise bands.
14. The `sqlite` and `postgres` guide pages are reachable at their routes.
    `std/README.md` lists both modules, `docs/security/postgres.md` exists,
    THIRD_PARTY_NOTICES lists the amalgamation, and
    `node tests/run.js third-party-licence` and `node docs/check-links.mjs`
    pass.
15. `npm pack --dry-run` includes `runtime/sqlite/sqlite3.c`, `std/sqlite.ts`
    and `std/net/postgres.ts`.
16. On `main` after the last merge, `npm run check`, `npm run lint` and an
    undegraded `npm test` are green.
