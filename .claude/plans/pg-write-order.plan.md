---
name: Postgres write order and the async TechEmpower entry's failures
overview: The async TechEmpower entry answered non-2xx on /db, /queries and /updates in its first recorded run, with the cause never named, and its /updates sorts ids before an UPDATE ... FROM unnest whose row-lock order is set by the plan, not by the array. Find the cause of the failures, prove or fix the lock order, and record why nish/net/postgres declines a cross-request write batcher.
priority: 90
labels: [ready]
issue: 2054
stages:
  - id: non2xx-cause
    title: PG writes S1 — name the cause of the async entry's non-2xx answers
    goal: Each non-2xx answer the async-db entry gives under bench/techempower/run.sh is attributed to serve's 503 for a full task table, a pgAsyncClaim that found no connection, or a Postgres error by SQLSTATE, and the count of each is recorded.
    verification: bash bench/techempower/run.sh on the db tests at 16, 64 and 256 connections with the counters printed, and the attribution added to docs/BENCHMARKS.md
    status: pending
    issue: 2055
    todos:
      - id: entry-counters
        content: Count the async-db entry's failed answers by cause in bench/techempower/async-db-server.ts — ServeStats.busy, claims answering -1, and pgAsyncQuery errors by errorCode — and print them at exit — see PG writes S1
        status: pending
      - id: runsh-status
        content: Make bench/techempower/run.sh report the status-code split it already parses, beside the Non-2xx count — see PG writes S1
        status: pending
      - id: cause-record
        content: Re-run the db tests and record the cause split in docs/BENCHMARKS.md under the async-entry section, naming the commit — see PG writes S1
        status: pending
  - id: lock-order
    title: PG writes S2 — prove or fix the /updates row-lock order
    goal: The /updates statement is shown to lock world rows in one order for every transaction, by its plan under the TFB schema and by zero 40P01 under a concurrent stress, or the SQL is changed so that it does.
    verification: the stress in PG writes S2 reports 0 deadlocks over its run, and node tests/run.js tfb_ passes
    status: pending
    issue: 2056
    todos:
      - id: explain-update
        content: Record EXPLAIN (ANALYZE, BUFFERS) of TFB_UPDATE_SQL from bench/techempower/db-server.ts at 1, 20 and 500 ids against the TFB world table — see PG writes S2
        status: pending
      - id: deadlock-stress
        content: Stress /updates?queries=20 at 256 connections with overlapping ids against both entries and count 40P01 from the server log and the entry counters — see PG writes S2
        status: pending
      - id: order-fix
        content: If the stress finds a deadlock, lock the rows in id order in the same pipelined group before the UPDATE, and pin it with the stress — see PG writes S2
        status: pending
  - id: write-batcher
    title: PG writes S3 — record the declined cross-request write batcher
    goal: The nish/net/postgres module doc and docs/BENCHMARKS.md say that cross-request write merging is left to the program, and why.
    verification: node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    status: pending
    issue: 2057
    todos:
      - id: batcher-decline
        content: Add the decline paragraph beside PgBatcher's Batching section in std/net/postgres.ts and a line in the async-entry section of docs/BENCHMARKS.md — see PG writes S3
        status: pending
---

## Context

[`docs/BENCHMARKS.md`](../../docs/BENCHMARKS.md) ("TechEmpower: the async entry against the explicit one") lists non-2xx answers from `async-db` on `/db`, `/queries` and `/updates` at 64 and 256 connections, up to 2,006 in a round. The cause is not stated anywhere. Because they hit read-only routes too, a deadlock cannot be the whole story. `serve` answers 503 when its task table is full ([`std/net/serve.ts`](../../std/net/serve.ts), `serveFreeSlot`, counted in `ServeStats.busy`), and that is the first suspect.

`/updates` plans its ids with `tfbPlanUpdate` ([`bench/techempower/db-server.ts`](../../bench/techempower/db-server.ts), line 134): distinct ids, ascending. It writes them in one statement:

```sql
update world set randomnumber = v.r
from (select unnest($1::int8[]) as id, unnest($2::int8[]) as r) as v
where world.id = v.id
```

An UPDATE locks rows in the order its plan visits them. With a nested loop driven by `v`, that is the array's order, so the sort works. With a hash join probing a sequential scan of `world`, it is heap order. Heap order is the same for every transaction only while no concurrent update moves a row's newest version. Whether two `/updates` can deadlock is therefore a property of the plan and has to be measured, not inferred from the sort.

## Approach

- **Measure before changing anything.** S1 and S2 each start by counting. A fix lands only for a cause the counters show.
- **The entry is the deliverable, not `std/`.** S1 and S2 change `bench/techempower/` and BENCHMARKS.md. `std/net/postgres*` changes only through S3's decision.

## PG writes S1 — name the cause of the async entry's non-2xx answers

- In [`async-db-server.ts`](../../bench/techempower/async-db-server.ts), count by cause:
  - `ServeStats.busy` (503, task table full)
  - each `pgAsyncClaim` that answers below 0
  - each `pgAsyncQuery` result that is not `ok()`, keyed by `errorCode` (`40P01` deadlock, `40001` serialization, `57014` cancel, other)

  Print one line at exit in the `key=value` style the bench scripts parse.
- [`bench/techempower/run.sh`](../../bench/techempower/run.sh) already reads wrk's status codes (line ~323). Report the 5xx and 4xx split beside the Non-2xx count, so the table's `*` footnotes say which status.
- Re-run `/db`, `/queries?queries=20` and `/updates?queries=20` at 16, 64 and 256 connections, 3 interleaved rounds. Add the split to the async-entry section of BENCHMARKS.md, naming the commit. If the cause is the 503 for a full task table, that links to the overload plan ([`net-overload-queue.plan.md`](net-overload-queue.plan.md), S4).

## PG writes S2 — prove or fix the /updates row-lock order

- Record `EXPLAIN (ANALYZE, BUFFERS)` of the statement at 1, 20 and 500 ids against the TFB `world` table (10,000 rows, as loaded by the bench), in the async-entry section of BENCHMARKS.md.
- Stress: `/updates?queries=20` at 256 connections for 60 s against `db-entry` and `async-db`, with `log_lock_waits = on` and `deadlock_timeout` at its default. Count `40P01` from both the server log and S1's counters. Random ids over 10,000 rows at 20 a request overlap often enough to show a deadlock if the order is not total.
- If any deadlock shows, take the locks in id order inside the same pipelined group before the UPDATE: `select id from world where id = any($1) order by id for update`. Both statements go in one group, so this adds no round trip. Re-run the stress to 0 and record the before and after req/s with their band.
- If none shows, record the plan and the zero count as the evidence. The sort in `tfbPlanUpdate` stays, since it also de-duplicates.

## PG writes S3 — record the declined cross-request write batcher

`PgBatcher` merges many requests' keyed *reads* into one execution. Its write counterpart would queue keyed updates from many requests while a connection is busy, merge them into one `update ... from unnest(...)` sorted by key, and route the one result back to each request. The catch is failure isolation: one bad row or one conflict fails every request in the batch, so it needs a fallback that re-runs each request alone. It mainly pays where many small writes to one table arrive at once, which is the TechEmpower `/updates` shape more than a typical application's.

**Decided: declined.** The owner declined `PgWriteBatcher` on 2026-11-20. One failure would fail every request in the batch, and the gain is mainly in the TechEmpower `/updates` shape. This stage only records that:

- In [`std/net/postgres.ts`](../../std/net/postgres.ts), after the **Batching** paragraph, add a short paragraph. It says that `PgBatcher` is for reads only, that merging different requests' writes into one statement is left to the program, and why: failure isolation. Doc-only, so no line moves elsewhere. It does add lines to a `std/*.ts` file, though, so grep `std/net/postgres.ts:[0-9]` across the pinned outputs and regenerate them (CLAUDE.md, "std/ line moves").
- Add one line in the async-entry section of BENCHMARKS.md.

## Out of scope

- Changing `PgBatcher`, `PgBatchClock` or the read path.
- Group commit on the server side (`commit_delay`). It is a Postgres setting, not nish code.
- The 503 policy itself. That belongs to [`net-overload-queue.plan.md`](net-overload-queue.plan.md).

## Tests

- S2's fix, if any, is pinned by the stress's zero-deadlock count recorded in BENCHMARKS.md and by `node tests/run.js tfb_` still passing.

## Verification

```bash
npm run check
npm run lint
node tests/run.js tfb_
node tests/run.js postgres
node docs/check-links.mjs
```
