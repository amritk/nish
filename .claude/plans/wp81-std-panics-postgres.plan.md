---
name: WP81 — std panic-free for the PostgreSQL client
overview: std/net's PostgreSQL client holds 1127 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (net/postgres-carrier 153, net/postgres-async 418, net/postgres 556), mostly overflow on message-length arithmetic and index into the wire buffer. This package removes or proves them - a short or malformed server message becomes a Result, not a panic. Its first todo adds instruction-count benches for PostgreSQL message encode and decode, baselined before any site changes; no PR may raise a count. The docs/security record for std/net must be updated when a finding's code moves.
priority: 180
labels: [ready]
issue: 2134
stages:
  - id: s1-carrier-async
    title: WP81 S1 — postgres-carrier and postgres-async
    goal: The carrier and async client sites are removed or proved; the bench programs for message encode and decode land first and are baselined.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2135
    todos:
      - id: s1-bench
        content: Add instruction-count programs to bench/instructions.json (see bench/README.md, Instruction counts, and bench/run.mjs) that call the functions this package changes - PostgreSQL message encode and decode, a DataRow parse and a Bind/Execute build through postgres.ts and postgres-carrier.ts; baseline them on CI's runner before any site is changed, and take every count from CI's table, never a local run — see WP81 S1
        status: pending
      - id: s1-fix
        content: Remove or prove every site in std/net/postgres-carrier.ts, std/net/postgres-async.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP81 S1
        status: pending
      - id: s1-security
        content: Update the docs/security std/net record (and its index row) where a fixed finding's file or line moved — see WP81 S1
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP81 S1
        status: pending
      - id: s1-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP81 S1
        status: pending
  - id: s2-postgres
    title: WP81 S2 — postgres
    goal: The blocking client's sites are removed or proved.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2136
    todos:
      - id: s2-fix
        content: Remove or prove every site in std/net/postgres.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP81 S2
        status: pending
      - id: s2-security
        content: Update the docs/security std/net record where a fixed finding's file or line moved — see WP81 S2
        status: pending
      - id: s2-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP81 S2
        status: pending
      - id: s2-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP81 S2
        status: pending
---

# WP81 — std panic-free for the PostgreSQL client

## Context

std/net's PostgreSQL client holds 1127 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (net/postgres-carrier 153, net/postgres-async 418, net/postgres 556), mostly overflow on message-length arithmetic and index into the wire buffer. This package removes or proves them: a short or malformed server message becomes a Result, not a panic. Its first todo adds instruction-count benches for PostgreSQL message encode and decode, baselined before any site changes; no PR may raise a count. The docs/security record for std/net must be updated when a finding's code moves.

Examples unblocked: none named; the package keeps the postgres examples buildable under strict panics.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

## Stages

### S1 — postgres-carrier and postgres-async

The carrier and async client sites are removed or proved; the bench programs for message encode and decode land first and are baselined.

Sites as of 071ed014 (571): net/postgres-carrier 153, net/postgres-async 418. Kinds: index 300, overflow 171, array-length 53, panic 22, slice 20, io-exit 5.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `pgAsyncAnswer`, `PgCarrier.batcher`.

**Owns:** `std/net/postgres-carrier.ts`, `std/net/postgres-async.ts`, `bench/instructions.json`, `bench/README.md`, `bench/pg-*.ts`, `bench/pg-*/**`, `bench/postgres/**`, `bench/techempower/**`, `bench/wp68-*.ts`, `docs/BENCHMARKS.md`, `tests/std-panics.json`, `tests/nish-cmp.js`, `tests/run.js`, `tests/postgres/**`, `tests/link/std_postgres*/**`, `tests/link/net_serve_pg/**`, `tests/link/net_http_server_carriers/**`, `tests/link/tfb_*/**`, `docs/security/postgres.md`, `docs/security/README.md`, `docs/guide/using-nish/postgres.md`, `docs/guide/using-nish/async-server.md`, `docs/guide/using-nish/standard-library.md`, `docs/wp48-layout-survey.txt`, `docs/wp68-shared-libraries.md`. Generated (regenerate, never hand-edit): `tests/self/goldens/checked/**`, `docs/reference/**`, `scalar.config.json`, `tests/differential/goldens/**`, `docs/IR_COOKBOOK.md`, `tests/wordings/*.err`, `tests/link/*/expected.caps.json`, `docs/reference/diagnostics/**`.

**Depends on:** nothing. A fix here that needs a change in `std/net/postgres.ts` (a new helper or a Result-returning signature) asks the lead for an Owns amendment rather than taking S2's file.

**Model:** the lead's (design and security judgement on which failures are real).

### S2 — postgres

The blocking client's sites are removed or proved.

Sites as of 071ed014 (556): net/postgres 556. Kinds: overflow 314, index 139, panic 46, array-length 28, divide 16, slice 13.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `pgFind`, `pgPutDecimal`.

**Owns:** `std/net/postgres.ts`, `bench/instructions.json`, `bench/README.md`, `bench/pg-*.ts`, `bench/pg-*/**`, `bench/postgres/**`, `bench/techempower/**`, `bench/wp68-*.ts`, `docs/BENCHMARKS.md`, `tests/std-panics.json`, `tests/nish-cmp.js`, `tests/run.js`, `tests/postgres/**`, `tests/link/std_postgres*/**`, `tests/link/net_serve_pg/**`, `tests/link/net_http_server_carriers/**`, `tests/link/tfb_*/**`, `docs/security/postgres.md`, `docs/security/README.md`, `docs/guide/using-nish/postgres.md`, `docs/guide/using-nish/async-server.md`, `docs/guide/using-nish/standard-library.md`, `docs/wp48-layout-survey.txt`, `docs/wp68-shared-libraries.md`. Generated (regenerate, never hand-edit): `tests/self/goldens/checked/**`, `docs/reference/**`, `scalar.config.json`, `tests/differential/goldens/**`, `docs/IR_COOKBOOK.md`, `tests/wordings/*.err`, `tests/link/*/expected.caps.json`, `docs/reference/diagnostics/**`.

**Depends on:** `s1-carrier-async`, for development and merge. `std/net/postgres-async.ts` imports this file, this stage lowers the benches S1 adds, and both stages edit `tests/std-panics.json`, `bench/instructions.json`, `tests/nish-cmp.js` and `docs/security/postgres.md`; it starts from `main` after S1 merges.

**Model:** the lead's.

## Acceptance criteria

1. `tests/std-panics.json` on `main` records for `std/net/postgres-carrier.ts`, `std/net/postgres-async.ts` and `std/net/postgres.ts` counts below the 071ed014 figures (153, 418, 556), each site left being on the kept list with its reason or recorded with why it stays, and `node tests/run.js std-panics` passes.
2. `pgAsyncAnswer`, `PgCarrier.batcher`, `pgFind` and `pgPutDecimal` hold no explicit `panic(...)`, and none of them is on the kept list.
3. A short or malformed server message (a truncated length, a field count past the frame, a DataRow cut short) fed to each client returns an error the caller sees through a Result, not a panic; a test in the suite shows it for each client.
4. `bench/instructions.json` holds programs for PostgreSQL message encode, decode, a DataRow parse and a Bind/Execute build, added before any site changed; no count in it rose across the package, and every count it holds came from CI's runner table.
5. No `nish:unsafe` and no made-up-value guard was added to the three modules (`git diff` of the package's merges).
6. `docs/security/postgres.md` and its row in `docs/security/README.md` name the moved findings at their new files and lines, and `node scripts/security-scope.mjs` passes.
7. The postgres benches, `bench/techempower` programs and `tests/postgres` programs still build; no opt-out the package made unneeded remains (`node tests/run.js performance` passes).
8. CI is green on `main` after the last merge, with every nish-cmp move declared (`node tests/nish-cmp.js` passes).

