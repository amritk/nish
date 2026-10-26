---
name: nish/net/postgres for servers that answer many concurrent requests
overview: Make std/net/postgres.ts cheaper and easier to use for a server that answers many concurrent requests — library work every Nish program that talks to PostgreSQL benefits from, nothing specific to one workload (no Conduit code, no result caching, no timers in the library). Three PRs, in order, each merged before the next starts, because all three change std/net/postgres.ts — allocation-free array parameters, a sans-IO batching helper (the DataLoader pattern) built on them, and cheaper result decoding where a profile against libpq shows the cost.
stages:
  - id: array-params
    title: "feat(runtime): int8[] and incremental text[] parameters for nish/net/postgres"
    goal: A caller binds an int8[] parameter from a slice of an i64[] and builds a text[] parameter element by element from byte windows, encoded straight into the Bind message with no allocation, with NULL elements and correct escaping, and a builder misuse panics instead of encoding garbage
    verification: npm run check && npm run lint && node tests/run.js std_postgres && node tests/postgres/live/run.mjs && node scripts/security-scope.mjs
    status: pending
    todos:
      - id: int-array
        content: Add `paramIntArray(values: i64[], start: i32, count: i32): boolean` to PgConnection — an int8[] parameter from values[start, start+count), sized once before anything is written (a refusal writes nothing, as paramTextArray does), panicking on a range outside the array
        status: pending
      - id: text-builder
        content: Add an incremental array builder — arrayStart(), arrayElement(bytes, start, length), arrayNull(), arrayEnd() (names may change if the PR says why) — that writes one array parameter element by element into the open Bind, with the parameter length patched at arrayEnd. Decide text array literal vs binary array format for the parameter, and justify the choice in the PR body (escaping cost, the Bind's per-parameter format codes, what bindEnd/bindStart must change, compatibility with existing callers)
        status: pending
      - id: misuse
        content: Builder misuse fails loudly — an element or arrayEnd with no arrayStart, a second arrayStart, any other param* or bindEnd while an array is open — as a panic the tests/link negative tests pin, never a silently malformed Bind
        status: pending
      - id: offline-tests
        content: Byte-exact offline encoding tests in tests/link/std_postgres (or a sibling case) for both new parameters — empty array, NULL elements, `"`, `\`, `,`, `{`, `}`, spaces, the literal word NULL as text, non-ASCII UTF-8, the most negative i64 — plus one negative tests/link case per misuse class with its expected panic
        status: pending
      - id: live-tests
        content: Round trips against PostgreSQL 18 in tests/postgres/live (a new scenario or an extension of an existing one, with its expected/*.out) — each new parameter sent and read back (e.g. `SELECT x, ord FROM unnest($1::text[]) WITH ORDINALITY`), covering the same awkward elements, NULLs and the empty array
        status: pending
      - id: docs-security
        content: Document both in docs/guide/using-nish/postgres.md, std/README.md's postgres row and docs/AI.md where it describes the module; update docs/security/postgres.md (scope, what was checked about the new encoders, any finding with a before/after test); regenerate tests/self/goldens with node tests/self/goldens.js --update and read the diff
        status: pending
  - id: batch-loader
    title: "feat(runtime): a sans-IO batching helper for nish/net/postgres"
    goal: A server queues keyed reads of one statement shape and, when a connection is free, binds up to N of them (and up to a byte budget) as one execution over unnest($1::…[]) WITH ORDINALITY, with each key queried once per batch and every row — or a per-request "no row" — routed back to every request that asked for its key, and no timers inside the library
    verification: npm run check && npm run lint && node tests/run.js std_postgres && node tests/postgres/live/run.mjs && node scripts/security-scope.mjs
    status: pending
    todos:
      - id: design
        content: Read the Conduit server's batchReads / shapeOf in amritk/multicore-server-challenge submissions/nish-std-amritk (worker.ts, and the article_slugs / comment_slugs statements in sql.ts; add_repo read access, do not change that repo) to see what a user writes today, then design the type — in std/net/postgres.ts, or a new nish/net/postgres-batch module only if that needs no src/ change (a new std module registered in src/ is a src/ change under the rolling freeze; avoid it). Sans-IO like PgConnection; no allocation per request or per row on the steady path; keys as i64 or byte windows (whatever the PR justifies), bound through the array parameters of the array-params stage
        status: pending
      - id: queue-take
        content: Queue keyed requests of one statement shape; take up to N requests and up to a byte budget when the caller says a connection is free; de-duplicate identical keys so each key is bound once per batch
        status: pending
      - id: route
        content: Route each result row, by its ordinality, back to every request that asked for that key, and report "no row" per request when its key produced none, so a missing key answers alone; nothing the helper hands out outlives the execution that produced it (document the lifetime, and test that a later batch cannot read an earlier one's rows)
        status: pending
      - id: no-timers
        content: No timers inside it — when to flush is the caller's decision; document in the guide page how a caller adds a collection window (e.g. flush on the next event-loop turn, or after its own deadline) if it wants one
        status: pending
      - id: tests
        content: Offline tests in tests/link (queueing, the N and byte-budget caps, duplicate keys, a missing key, a key requested twice, the generated statement text, misuse panics) and a live round trip in tests/postgres/live; port one std test program to the helper
        status: pending
      - id: docs
        content: Port the guide's example in docs/guide/using-nish/postgres.md to the helper and document it there, in std/README.md and docs/AI.md; record its scope in docs/security/postgres.md (it routes server-supplied ordinals — an out-of-range or repeated ordinal must be refused, with a test); the PR body shows the generated statement and the IR-relevant API; regenerate tests/self/goldens
        status: pending
  - id: decode-perf
    title: "perf(runtime): cheaper result decoding in nish/net/postgres"
    goal: The client's CPU per query against PostgreSQL drops by more than the noise band of bench/postgres where a profile shows the cost, with text results still the default and every existing accessor's behaviour unchanged, and changes that do not beat the noise dropped
    verification: npm run check && npm run lint && node tests/run.js std_postgres && node tests/postgres/live/run.mjs && node scripts/security-scope.mjs && node bench/postgres/run.mjs --validate
    status: pending
    todos:
      - id: measure
        content: Set up with bash bench/postgres/setup.sh, run node bench/postgres/run.mjs --validate, then --rounds 12 on main for the baseline and the noise band (.claude/testing.md → "A `Measured:` trailer"), and profile (perf) where the client spends its time — Bind/Execute encoding, DataRow framing, column access, int/timestamp/array parsing
        status: pending
      - id: fix
        content: Fix what the profile shows, in std/net/postgres.ts. Binary result format for int8/int4/bool/timestamptz only if the bench shows it pays, opt-in, with text the default; every existing accessor keeps its behaviour (existing tests unchanged and green)
        status: pending
      - id: record
        content: Re-measure each change against main with --rounds 12, drop any that does not beat the noise band, and record the figures with their band in the PR body and the commit's Measured trailer (and docs/BENCHMARKS.md if it has a postgres section); update docs/security/postgres.md for any new decoding path, with tests, and the guide page if a new opt-in is user-visible; regenerate tests/self/goldens
        status: pending
---

# nish/net/postgres for servers that answer many concurrent requests

Three stages, one PR each, strictly in order: each stage is written against
`main` after the previous one merged. All three change `std/net/postgres.ts`,
so no two can run at once, and the batching helper is built on the array
parameters. No stage is expected to change `src/`; if one must, it follows
`.claude/selfhost.md` (rolling freeze, goldens regenerated with the tooling,
`node tests/run.js wasi` with `WASI_SYSROOT=/usr` and `node tests/run.js
performance`).

Every stage: `npm run check`, `npm run lint`, `node tests/run.js std_postgres`,
the live suite against PostgreSQL 18 (`bash bench/postgres/setup.sh` installs
one; `tests/postgres/live/run.mjs` starts a throwaway cluster under `$PG_BIN`),
`node scripts/security-scope.mjs`. The full suite is CI's four `test` shards
plus `postgres-live`; read each shard's skip count. Commit messages are the
changelog (CLAUDE.md → "Commit messages are the changelog").

## array-params

**Owns:** `std/net/postgres.ts`, `tests/link/std_postgres*/**`,
`tests/postgres/**`, `docs/guide/using-nish/postgres.md`, `std/README.md`,
`docs/AI.md`, `docs/security/postgres.md`, `docs/security/README.md` (its
index row only), `tests/self/goldens/checked/**` (regenerated only),
`tests/differential/**` (regenerated only), `tests/run.js` (only to register a
new tests/link case if registration is not automatic).

## batch-loader

**Owns:** the same as array-params, plus `std/net/postgres-batch.ts` (only if
it needs no `src/` change) and `bench/postgres/main.ts` (only if it is the std
program ported).

## decode-perf

**Owns:** the same as array-params, plus `bench/postgres/**` and
`docs/BENCHMARKS.md`.
