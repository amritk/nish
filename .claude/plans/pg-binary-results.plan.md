---
name: nish/net/postgres — opt-in binary result columns
overview: Every result column is requested in text today (bindEnd writes zero result-format codes). Add an opt-in to request binary (format 1) for a whole execution or per column, decode int2/int4/int8, bool, float8, timestamptz and int4[]/int8[] from it through the same accessors callers use now, zero-copy, and measure what it saves on both sides of the wire.
stages:
  - id: binary-results
    title: "feat(runtime): binary result columns in nish/net/postgres"
    goal: A program can ask for binary result columns per execution or per column, and conn.int, conn.bool, the new conn.float and conn.timestamp, and PgArrayWalker read the same values from either format, in place
    verification: npm run check && npm run lint && node tests/run.js std_postgres && node tests/self/goldens.js --update (diff read) && node tests/postgres/live/run.mjs binary (PostgreSQL 18 locally if it installs, else CI's postgres-live job green with the new scenario counted) and every CI test shard green on the head
    status: pending
    todos:
      - id: br-bind-formats
        content: Add the binary opt-in to PgConnection's bind — bindEndBinary() for every column, bindEndFormats(formats, start, count) per column — leaving bindEnd() byte-identical — see Requesting binary
        status: pending
      - id: br-format-queue
        content: Track each queued Execute's result formats so every DataRow knows its columns' formats, through pipelining and a failed group — see Knowing a row's format
        status: pending
      - id: br-decoders
        content: Add the binary decoders (int2/int4/int8, bool, float8, timestamptz) beside PgText, and conn.float(c), conn.timestamp(c, out, at), conn.isBinary(c), with conn.int and conn.bool dispatching on the column's format — see Decoding
        status: pending
      - id: br-array-walker
        content: Teach PgArrayWalker to walk a binary one-dimensional int4[]/int8[] in place and add walker.int() reading the current element in either format — see Arrays
        status: pending
      - id: br-link-tests
        content: Extend tests/link/std_postgres with hand-built binary DataRows (every type, NULL, negatives, extremes, empty and NULL-element arrays, truncated and lying headers) plus a pipelined text/binary mix with a failed group, and add negative cases — see Tests
        status: pending
      - id: br-live-tests
        content: Add a `binary` scenario to tests/postgres/live (live.ts, schema.sql, run.mjs SCENARIOS, expected/binary.out) round-tripping every type in both formats against PostgreSQL 18 — see Tests
        status: pending
      - id: br-docs
        content: Update the module's header comment, docs/guide/using-nish/postgres.md and docs/security/postgres.md (the binary decoders read server-controlled bytes) — see Docs and record
        status: pending
      - id: br-goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff — see Tests
        status: pending
  - id: binary-bench
    title: "test(runtime): measure binary against text results in bench/postgres"
    goal: A reproducible figure for a 10k-row (int8, timestamptz, int8[]) query, text against binary — client CPU and PostgreSQL backend CPU per row, with the machine's noise band
    verification: npm run check && npm run lint && node bench/postgres/run.mjs --validate passes (both formats read the same rows and checksum) && node bench/postgres/run.mjs --workload wide prints the four figures and their noise band; node tests/self/goldens.js --update diff read; every CI test shard green on the head
    status: pending
    todos:
      - id: bb-workload
        content: Add a `wide` workload to bench/postgres/main.ts reading 10k rows of (int8, timestamptz, int8[]) in text and in binary with one checksum — see The benchmark
        status: pending
      - id: bb-server-cpu
        content: Measure the PostgreSQL backend's CPU for each run in bench/postgres/run.mjs (the backend's pid from pg_backend_pid(), /proc/<pid>/stat before and after) beside the client's getrusage — see The benchmark
        status: pending
      - id: bb-report
        content: Run it, and record the figures (client CPU/row and server CPU/row, text vs binary, medians, IQR, noise band, machine) in bench/postgres's header comment and the PR body — see The benchmark
        status: pending
---

# nish/net/postgres — opt-in binary result columns

## Where it stands

`std/net/postgres.ts` sends every statement through the extended protocol.
`bindEnd()` writes `putI16(0)` for the result-format codes, so every result
column comes back in text. The decoders work in place on the input buffer:
`PgText.int`, `PgText.bool` and `PgText.timestamp`, reached through
`conn.int(c)`, `conn.bool(c)` and `conn.text.timestamp(buf, start, len, out,
at)`, and `PgArrayWalker`, which walks a `text[]` literal. Parameters are
text as well, including the array builders. A DataRow carries only lengths
and bytes, never its format, so the client has to remember which format it
asked for.

## Requesting binary

- `bindEnd()` stays as it is, byte for byte: zero format codes, so every
  existing caller and recording is unchanged.
- `bindEndBinary()`: one format code, `1`, which the protocol applies to every
  column.
- `bindEndFormats(formats: u8[], start: i32, count: i32)`: `count` codes, each
  0 or 1, one per result column. False, with nothing written, on a code other
  than 0 or 1, a window outside `formats`, or `count` > 65535 (or past
  `maxColumns`). PG_TAIL grows by the codes' bytes, so the room check stays
  exact.
- `PgBatcher.take` keeps text. The option is per execution, so a batcher can
  take it later without a new mechanism.
- A program that asks for binary on a type with no binary decoder here (text,
  numeric, jsonb) still gets the column's window. It reads the raw bytes, and
  the accessors refuse it (`text.failed`) instead of misreading it.

## Knowing a row's format

The connection keeps a FIFO, allocated once and bounded by the pipeline caps,
with one entry per Execute queued: all-text, all-binary, or a window into a
reused format store for per-column codes. `next()` sets the current
execution's formats as each DataRow is framed, so `isBinary(c)` is an array
read. An entry is popped at CommandComplete, EmptyQueryResponse or
PortalSuspended. On ErrorResponse, the remaining entries of that group are
dropped, because the server skips to Sync. A dropped bind (`bindCancel`,
`terminate`) pushes nothing. A per-column window shorter than the row's column
count is `PG_FAILED` with `PG_ERR_UNEXPECTED`, because the server answered
something the client never asked for. A single code covers every column, as
the protocol says.

The alternative is a Describe Portal per binary Execute, reading formats from
RowDescription. It costs a message per execution, and the benchmark exists to
remove costs like that one. Use it only if the FIFO cannot be kept exact
through the error path, and say why in the PR.

## Decoding

Every binary decoder bounds-checks its window against the buffer and reads it
in place. A bad input sets `failed` and returns 0, false or -1, exactly as
`PgText` does.

- **Integers**: the window's length gives the width: 2, 4 or 8 bytes, big
  endian, sign-extended. `conn.int(c)` reads text or binary by the column's
  format, so int2/int4/int8 return the same `i64` either way.
- **bool**: one byte, 0 or 1. Any other value or length fails.
- **float8**: eight bytes as an IEEE-754 double. A new `conn.float(c): f64`
  reads text as well (PostgreSQL's shortest round-trip output, plus `NaN`,
  `Infinity`, `-Infinity`), so both formats give the same bits. float4 is
  optional.
- **timestamptz**: an `i64` count of microseconds since
  2000-01-01 00:00:00 UTC. A new `conn.timestamp(c, out, at)` writes the same
  24 bytes `PgText.timestamp` writes today (`YYYY-MM-DDTHH:MM:SS.mmmZ`,
  fraction truncated to milliseconds, years 0001–9999). Before 2000 it uses
  floor division. `infinity` and `-infinity` (i64 max and min) fail, as they
  do in text. `PgText.timestamp` stays for callers holding a raw window.
- `conn.isBinary(c)` says which format a column came in.

## Arrays

The binary array layout is ndim i32, has-null flag i32, element OID i32, then
per dimension a length i32 and a lower bound i32, then per element a length
i32 (-1 for NULL) and that many bytes. `PgArrayWalker.begin` recognises it by
its first byte, which is 0x00 for ndim 0 or 1, where a text literal starts
with `{` (0x7b). The walker also takes an explicit-format
`beginBinary`/`beginText` so callers need not rely on the sniff. For a binary
walk:

- ndim 0 is an empty array, and `next()` answers `PG_ARRAY_END`. ndim greater
  than 1, an element OID other than int4 (23) or int8 (20), a negative length,
  a lower bound the walker does not need but should not trust, an element
  count that does not fill the window exactly, or an element whose width does
  not match its OID: each is `PG_ARRAY_BAD`.
- `start` and `length` give each element's raw bytes, `PG_ARRAY_NULL` reports
  a NULL, and `escaped` is always false.
- The new `walker.int(): i64` reads the current element in either format (text
  through `PgText.int`). It sets the walker's own `failed` on a bad element.

The existing `text[]` walk does not change.

## Tests

- **Link tests (offline)**: extend `tests/link/std_postgres/main.ts`, which
  already feeds hand-built server bytes, with:
  - binary DataRows for every type, with NULL, 0, -1, the minimum and maximum
    of each width, and a timestamptz before 2000, at 2000-01-01, and at the
    ends of 0001 and 9999;
  - an empty array, `{NULL}`, `{1,NULL,-3}`, and every refused header;
  - a pipeline of text, binary and per-column executions with a failed
    statement mid-group, checking that the next group decodes in its own
    format.

  Each refusal gets a negative test (a `tests/link/*_panic` case only where
  the API panics). Assert in the same test that a text-only program's output
  bytes are unchanged.
- **Live tests (PostgreSQL 18)**: a new `binary` scenario in
  `tests/postgres/live` selects one table holding every supported type, with
  the NULLs, negatives, empty arrays and arrays with NULL elements from the
  requirements. It reads the rows once in text and once in binary and prints
  one line per value with the format named, and the expected file shows both
  formats agreeing. CI's `postgres-live` job (a `postgres:18` service) is the
  gate. Run it locally if `apt-get install postgresql-18` works from
  apt.postgresql.org, with `PG_BIN=/usr/lib/postgresql/18/bin`. Otherwise say
  in the PR that CI is the only run.
- **Goldens**: `node tests/self/goldens.js --update` after the `std/` change.
  Never hand-edit them.

## Docs and record

- The header comment's "Text results, no copies" paragraph becomes text by
  default, with binary on request.
- `docs/guide/using-nish/postgres.md` gets a section on binary results with an
  example.
- `docs/security/postgres.md`'s scope and findings cover the binary decoders
  and the array header walk, which read bytes the server controls. Every
  refusal gets a before/after link test. `node scripts/security-scope.mjs`
  must pass.

## The benchmark

`bench/postgres` already runs `main.ts` against a PostgreSQL 18 cluster that
`setup.sh` builds and seeds.

- **Workload.** Add a `wide` workload: one statement,
  `select i::int8, '2024-01-01'::timestamptz + i * interval '1 second', array[i, -i, i*7]::int8[] from generate_series(1, 10000) i`
  (or a seeded table of the same shape, created by `run.mjs`), run as text
  and as binary on one connection. Each run reads every value through the
  accessors above, walks every array element with `walker.int()`, and prints
  one checksum, which must match across the two formats.
- **CPU.** Measure client CPU (getrusage, as `run.mjs` already does) and
  backend CPU: take the backend's pid from `select pg_backend_pid()` and read
  utime+stime from `/proc/<pid>/stat` before and after the timed loop. Divide
  both by rows read.
- **Report.** Report client µs/row and server µs/row, text and binary:
  medians, IQR and the noise band (the build against its byte-identical copy,
  as `run.mjs` defines it). Give the CPU model and core count, and the verdict
  under the existing rule.
- If the cluster cannot be built here (no network to apt.postgresql.org or
  Go), say so in the PR and leave it as a draft. Do not publish figures from
  a different server version.

## Stage ownership

### binary-results

**Owns:** `std/net/postgres.ts`, `tests/link/std_postgres*/**`, `tests/postgres/live/**`, `tests/postgres/recordings/**`, `docs/guide/using-nish/postgres.md`, `docs/security/postgres.md`, `docs/security/README.md`, `tests/self/goldens/checked/**` (generated)

### binary-bench — starts after binary-results merges (it calls the new API)

**Owns:** `bench/postgres/**`, `tests/self/goldens/checked/**` (generated)

## Out of scope

- Binary parameters beyond what exists already.
- Binary decoders for numeric, text, jsonb, uuid and date.
- Switching `PgBatcher` or the carrier to binary.
- Changing any default.
