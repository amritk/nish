---
name: nish/net/postgres — binary integer array parameters (if measured worth it), and a PgBatcher cap above 1024
overview: Measure text against binary int4[]/int8[] array parameters and results against PostgreSQL 18, and ship binary array parameters only if the numbers clear the bar set here; then lift PgBatchConfig.maxRequests past 1024 once the batcher's per-key cost is flat. Two stages, two PRs, run in order because both edit std/net/postgres.ts.
stages:
  - id: binary-int-params
    title: Binary int4[] and int8[] array parameters, or a measured verdict
    goal: The text-versus-binary cost of integer array parameters and results is measured against PostgreSQL 18 and recorded; if it clears the bar, a program can bind int4[] and int8[] parameters in binary with an explicit element type, giving the same query results as the text path.
    verification: npm run check && npm run lint && node tests/run.js std_postgres && PG_BIN=/usr/lib/postgresql/18/bin node tests/postgres/live/run.mjs && node bench/postgres/arrays.mjs --validate
    todos:
      - id: read-current-paths
        content: Confirm with a test, not by reading, how paramIntArray, arrayStart/arrayElement/arrayInt/arrayEnd, bindStartBinary and PgBinaryArray behave today — parameter format codes in the Bind, result format codes — see Stage 1, "What exists"
        status: pending
      - id: bench-harness
        content: Add bench/postgres/arrays.mjs (and its Nish/C programs) measuring server CPU per Bind/Execute, client encode CPU and client array_agg decode CPU, text vs binary, int4 and int8, lengths 10/100/1000/10000 — see Stage 1, "Measure"
        status: pending
      - id: verdict
        content: Apply the decision rule to the medians and write the figures and the verdict into docs/guide/using-nish/postgres.md and the PR body before building the API — see Stage 1, "Decision rule"
        status: pending
      - id: binary-param-api
        content: If worth it, add binary int4[]/int8[] parameters with an explicit element type, per-parameter format codes in the Bind, empty arrays, NULL elements and range checks — see Stage 1, "If worth it"
        status: pending
      - id: live-roundtrip
        content: If worth it, add live scenarios and link tests — empty, one, NULLs, each type's min and max, arrays crossing the output buffer, element type mismatch, text and binary giving identical results — see Stage 1, "Tests"
        status: pending
      - id: docs-security
        content: Update the guide page, std/README.md, docs/AI.md and docs/security/postgres.md, and say whether PgBatcher can use binary integer keys — see Stage 1, "Docs"
        status: pending
  - id: batcher-cap
    title: PgBatchConfig.maxRequests above 1024
    goal: A PgBatcher can be configured for far more than 1024 requests per execution, with per-key time and memory flat from 1 to the new maximum, and every existing config behaving as before.
    verification: npm run check && npm run lint && node tests/run.js std_postgres && PG_BIN=/usr/lib/postgresql/18/bin node tests/postgres/live/run.mjs && node bench/postgres/batch-scale.mjs --validate
    todos:
      - id: find-limit
        content: Establish why the cap is 1024 — the take probe bound (maxRequests^2 / 2), table and per-run array sizes, handle and ordinal encoding — and write the answer down — see Stage 2, "Why 1024"
        status: pending
      - id: flat-per-key
        content: Remove anything that makes per-key cost grow with batch size, and anything allocated per batcher or per run that scales with the cap when batches are small — see Stage 2, "Flat per key"
        status: pending
      - id: raise-cap
        content: Raise PG_BATCH_MAX_REQUESTS to what the implementation supports (65536 or a stated real limit), keeping every existing config's behaviour — see Stage 2, "The new cap"
        status: pending
      - id: scale-tests
        content: Live batches of 1, 1024, 1025, 4096 and the new maximum, routing, missing and multi-row keys, a failed batch, failed and empty runs at large sizes; update the cap-panic link test to the new edge — see Stage 2, "Tests"
        status: pending
      - id: scale-bench
        content: Add bench/postgres/batch-scale.mjs reporting time and memory per key at each size, and update the guide page and security record — see Stage 2, "Measure and document"
        status: pending
---

# nish/net/postgres: binary integer arrays, and a bigger PgBatcher

Two requests from the same user, in their order: first the binary integer
arrays (measure first, and allow "not worth it"), then the PgBatcher cap.
Both stages edit `std/net/postgres.ts`, its live suite and its guide page, so
they run one after the other: Stage 2 starts once Stage 1 has merged.

Run-wide rules for both stages (from `CLAUDE.md`):

- A local PostgreSQL 18 is required: `tests/postgres/live/run.mjs` starts a
  throwaway cluster under `PG_BIN` (default `/usr/lib/postgresql/18/bin`). The
  container ships 16. Install 18 from apt.postgresql.org (reachable):
  `sudo install -d /usr/share/postgresql-common/pgdg && sudo curl -fsSo
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  https://www.postgresql.org/media/keys/ACCC4CF8.asc`, add
  `deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc]
  https://apt.postgresql.org/pub/repos/apt <codename>-pgdg main`, then
  `apt-get install -y postgresql-18`. Every figure is from 18, never from 16.
- `std/` changes move `tests/self/goldens/checked/`: regenerate with
  `node tests/self/goldens.js --update` (`--seed build/seed/bin/nish` without
  `build/nish`) and read the diff. Never hand-edit or hand-merge it.
- A `Measured:` trailer states figures with their noise band
  (`.claude/testing.md` → "A `Measured:` trailer"). Report medians over at
  least 7 runs with the spread; a difference inside the spread is no difference.
- The user guide moves with the API (`docs/guide/using-nish/postgres.md`), and
  so does `docs/security/postgres.md` for anything that reads or writes the wire.
- Commit subjects are changelog lines: `feat(interop): …` or `perf(…)`,
  `docs(…)` for a verdict-only PR.

## Stage 1: Binary int4[] and int8[] array parameters, or a measured verdict

**Owns:** `std/net/postgres.ts`, `std/README.md`, `tests/postgres/**`,
`tests/link/std_postgres_*/**`, `bench/postgres/**`,
`docs/guide/using-nish/postgres.md`, `docs/security/postgres.md`,
`docs/AI.md`, `tests/self/goldens/checked/**` (generated)

### What exists

Check each of these before designing, and pin the finding with a test where
one is cheap:

- `bindStartBinary` asks for every result column in binary (one result
  format code). It does not touch parameter format codes.
- `PgBinaryArray` walks a one-dimensional `int2[]`, `int4[]` or `int8[]`
  result column in binary, refusing other shapes (amritk/nish#1046).
- `paramIntArray` writes an `int8[]` as a *text* array literal; `arrayStart`,
  `arrayElement`, `arrayInt`, `arrayNull`, `arrayEnd` build a text literal one
  element at a time inside the Bind. The module comment says "Every parameter
  is in text format". The belief is that the Bind sends zero parameter format
  codes; confirm it.

### Measure

`bench/postgres/arrays.mjs` (with whatever Nish program or C twin it drives,
next to the existing `bench/postgres/main.ts` and `twin.c`), against a local
PostgreSQL 18, prepared statements, int4 and int8, lengths 10, 100, 1,000 and
10,000:

1. **Server CPU per Bind/Execute**, text versus binary, for
   `select count(*) from unnest($1::int8[])` (and `int4`) and for
   `select count(*) from bench_pk where id = any($1)` on a primary-keyed
   table. Measure the backend's own CPU — e.g. the `utime + stime` delta of
   `/proc/<pg_backend_pid()>/stat` across N executions on one connection —
   not wall time, and divide by N.
2. **Client CPU to encode** the parameter, text versus binary, with the
   prototype binary encoder from this stage.
3. **Client CPU to decode** an `array_agg` result, text (the text decode a
   program does today) versus binary (`PgBinaryArray`).

`--validate` runs every cell at a tiny count and checks both formats return
the same answer: that is what the verification line runs. Put the full table
in the PR body before building the API.

### Decision rule

Decided here, so the worker does not decide it from the numbers:

- **Build** if, at length 1,000, binary cuts server CPU per Bind/Execute by
  at least 10% on either statement for either type, or cuts client encode or
  decode CPU by at least 30% — beyond the measured spread in both cases.
- **Otherwise stop**: write the table and the verdict ("not worth it, and
  why") into `docs/guide/using-nish/postgres.md`, commit the bench harness,
  and open the PR as `docs(interop): …` with no API change. Drop the
  prototype encoder from `std/`.

### If worth it

- **API with an explicit element type.** For example `paramInt4Array` /
  `paramInt8Array` over an `i64[]` window, and a binary element-by-element
  builder (`binaryArrayStart(elementOid)`, `binaryArrayInt`,
  `binaryArrayNull`, then the existing `arrayEnd` or its binary twin). An
  `int4` element outside −2³¹…2³¹−1 is refused the way `arrayInt` refuses
  today (return false and write nothing, or panic as program misuse — pick
  the one consistent with the module and document it).
- **Per-parameter format codes.** The Bind carries its parameter format codes
  *before* the parameter values, and the builder writes the Bind
  incrementally. Design how a binary parameter's format code gets there
  (reserve and back-patch, or declare at bind start) without slowing the
  all-text path, and say which in the PR.
- **Element OID mismatch.** If the statement's parameter is `int8[]` and the
  program sends an `int4` element OID (or the reverse), define what happens:
  the server's error arrives as that execution's `PG_ERROR`, the connection
  stays usable for the next group, and a live test pins it.
- **Header.** Write ndim = 1 (0 for an empty array, as `array_send` does),
  flags = has-nulls bit when any element is NULL, the element OID (23 / 20),
  length and lower bound 1; NULL elements as length −1.
- **Results.** Binary decode of `int4[]`/`int8[]` results already exists in
  `PgBinaryArray`; keep its bounds checks on every wire read and add any the
  new tests show missing.
- **Existing text APIs unchanged.** Every existing `std_postgres` link test
  and live scenario passes unmodified.
- **PgBatcher.** Say in the docs and the PR whether PgBatcher's `PG_BATCH_INT`
  keys could use binary parameters, and what it would save at its batch
  sizes. Do not change PgBatcher in this stage: Stage 2 owns it next.

### Tests

Live round trips against PostgreSQL 18 (new scenarios in
`tests/postgres/live/live.ts` with `expected/*.out`): empty, one element,
NULL elements, min and max of int4 and int8, arrays long enough to cross the
output buffer limit (and the refusal when one does not fit), and an element
type mismatch. Each case runs through text and binary and the outputs must be
identical. Link tests (`tests/link/std_postgres_*`) for the Bind bytes and for
each refusal and panic, negative cases included.

### Docs

The guide page's binary section, `std/README.md`, `docs/AI.md`, and
`docs/security/postgres.md` (scope and a finding line for the new encoder,
before/after tests named). The measured table goes on the guide page either
way.

## Stage 2: PgBatchConfig.maxRequests above 1024

**Owns:** `std/net/postgres.ts`, `std/README.md`, `tests/postgres/**`,
`tests/link/std_postgres_batch*/**`, `bench/postgres/**`,
`bench/pg-batch-clock.ts`, `docs/guide/using-nish/postgres.md`,
`docs/security/postgres.md`, `docs/AI.md`, `tests/self/goldens/checked/**`
(generated)

Depends on Stage 1 (merge and start): same file.

### Why 1024

The comment beside `PG_BATCH_MAX_REQUESTS` says it: `take` probes at most
maxRequests² / 2 slots, and the cap keeps that near 5·10⁵. That is O(n²)
work in the worst case, so the cap is a real constraint of the current
algorithm, not only a sanity cap. Confirm it, and list anything else that
ties to the cap: `tableSize` (≥ 2·maxRequests), `PgBatchRun.tags`/`first`
(maxRequests each, times `runs`), handle encoding (`PG_BATCH_USES`, handles
under 2³⁰), the ordinal the server sends back, `maxBytes` against the key
array a full batch needs, and `PgBatchClock`'s own limit on maxRequests.

### Flat per key

Remove the quadratic probe bound (e.g. a table sized so expected probes per
key stay constant, with a bound that grows linearly) and any other per-key
work that grows with batch size. Memory allocated per batcher or per run in
proportion to the cap while batches are small is a finding too: say how much
a config at the new maximum costs at construction and whether it should
grow lazily.

### The new cap

Raise `PG_BATCH_MAX_REQUESTS` (for example to 65536) or tie it to what the
implementation really supports, with the reason written beside it. A value
past the new cap still panics with the same message. Every existing config —
the defaults and every value 1…1024 — behaves exactly as before: same SQL,
same events, same order.

### Tests

- Live batches of 1, 1024, 1025, 4096 and the new maximum against
  PostgreSQL 18, every row routed to the right key, including missing keys
  and keys with several rows.
- A failed batch fails every key in it.
- A failed run and an empty run still work at large sizes.
- `tests/link/std_postgres_batch_config_cap_panic` moves to the new edge.

### Measure and document

`bench/postgres/batch-scale.mjs`: time per key and memory per key (batcher
construction and steady state) at each size above. Put the table in the PR
body with a `Measured:` trailer. Update the guide page and the security
record's PgBatcher scope.

## Acceptance criteria

1. A committed benchmark under `bench/postgres/` reproduces text-versus-binary
   figures for int4 and int8 at lengths 10, 100, 1,000 and 10,000: server CPU
   per Bind/Execute on an `unnest` statement and on `id = any($1)` against a
   primary key, client encode CPU, and client `array_agg` decode CPU — measured
   on PostgreSQL 18, and the figures appear in the merged PR and the guide page.
2. The guide page states the verdict the decision rule gives. If "not worth
   it", nothing else in Stage 1 applies and criteria 3–5 are marked n/a.
3. (If built) A program binds `int4[]` and `int8[]` parameters in binary with
   the element type named in the call, and against PostgreSQL 18 gets results
   identical to the text path for: empty, one element, NULL elements, each
   type's min and max, and an array that crosses the output buffer limit.
4. (If built) Sending an element type the statement does not expect has a
   documented outcome: an error for that execution, and the connection keeps
   working — shown by a live test.
5. (If built) Every existing text array API and its tests work unchanged.
6. The docs say whether PgBatcher can use binary parameters for its integer
   keys.
7. A `PgBatcher` constructs without panic at `maxRequests` 1025, 4096 and the
   new maximum; one past the new maximum still panics with "a PgBatchConfig
   cap out of range".
8. Against PostgreSQL 18, batches of 1, 1024, 1025, 4096 and the new maximum
   route every row to its key, including missing keys and keys with several
   rows; a failed batch fails every key; a failed run and an empty run work at
   large sizes.
9. The merged PR reports time and memory per key at each of those sizes, and
   per-key time does not grow with batch size beyond the noise band.
10. Configs with `maxRequests` ≤ 1024 behave as before: existing batcher tests
    pass unmodified.
11. The guide page documents the new maximum (and, if built, the binary
    parameter API).
