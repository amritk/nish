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

### S2 — postgres

The blocking client's sites are removed or proved.

Sites as of 071ed014 (556): net/postgres 556. Kinds: overflow 314, index 139, panic 46, array-length 28, divide 16, slice 13.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `pgFind`, `pgPutDecimal`.
