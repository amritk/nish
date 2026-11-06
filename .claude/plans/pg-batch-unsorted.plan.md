---
name: PgBatcher without the ordinal sort
overview: Add PgBatchConfig.sorted (default true). Set to false, PgBatcher's statement drops the `order by q.ord`, and the batcher routes rows whatever order their ordinals arrive in, holding each request's last event until the execution ends. Today's statement and event order stay the default.
stages:
  - id: unsorted-batch
    title: "feat(interop): let a PgBatcher skip the ordinal sort"
    goal: Under sorted = false the statement has no ORDER BY on q.ord, EXPLAIN shows no Sort node, and every request still gets all its rows then exactly one last event
    verification: npm run check && npm run lint && npm run lint:dead && node scripts/security-scope.mjs && node docs/check-links.mjs && node tests/run.js std_postgres_batch && PG_BIN=/usr/lib/postgresql/16/bin node tests/postgres/live/run.mjs batch explain
    todos:
      - id: config-flag
        content: Add `sorted` to PgBatchConfig and build the unsorted statement in the PgBatcher constructor — see Statement
        status: pending
      - id: unsorted-routing
        content: Route rows by ordinal in any order under sorted = false in PgBatcher.row, next and PgBatchRun, holding last events until end or fail — see Routing
        status: pending
      - id: carrier-check
        content: Confirm PgCarrier's batch routing in std/net/postgres-carrier.ts survives interleaved ROW events across tags, and fix it with a carrier test only if it does not — see Carrier
        status: pending
      - id: link-tests
        content: Add tests/link/std_postgres_batch_unsorted with interleaved ordinals, a key with no rows, failed runs, bad ordinals and stray events — see Tests
        status: pending
      - id: live-explain
        content: Add an `explain` scenario and an unsorted batch to tests/postgres/live (live.ts, expected/*.out) showing the Sort node gone — see Tests
        status: pending
      - id: docs-record
        content: Document the semantics in docs/guide/using-nish/postgres.md, the PgBatcher doc comments, std/README.md, docs/AI.md and docs/security/postgres.md PG-14 — see Docs and record
        status: pending
      - id: goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff — see Verification
        status: pending
---

## Context

[`std/net/postgres.ts`](../../std/net/postgres.ts) `PgBatcher` (constructor at line ~3462) prepares:

```sql
select t.*, q.ord from unnest($1::<type>[]) with ordinality as q(key, ord)
  cross join lateral (<select>) as t order by q.ord[, <orderBy>]
```

`row` refuses any ordinal before the current key (`ordinal < run.cur + 1`), and `next` closes every key before a row's key with `PG_BATCH_DONE` / `PG_BATCH_MISSING` as soon as that row arrives: routing is a single forward walk, which the sort pays for. In the multicore-server-challenge submission that sort is a Sort or Incremental Sort over every batch (about 190 wide article rows and 1,000 comment rows per execution), roughly 0.2 to 0.3 ms of a 25 ms plan.

## Approach

- **`PgBatchConfig.sorted: boolean = true`.** The default leaves the statement byte for byte as it is, and the event order too. Every existing test must pass unchanged.
- **`orderBy` under `sorted = false`: keep a sort just for it.** The statement ends in `order by <orderBy>` with no `q.ord`. A global sort on those columns still orders each key's rows the way it asks, so `orderBy` means the same thing in both modes. It still costs a Sort node, and the guide says so: to drop every sort, leave `orderBy` empty and order a key's rows in the program. (The other option, refusing `orderBy` with `sorted = false`, gives the caller no way to get ordered rows from the server at all.)
- **Last events wait for the end.** With interleaving, a key cannot be known complete until `PG_COMPLETE`, so `PG_BATCH_DONE` / `PG_BATCH_MISSING` for every request come only after `end`, in key order and then request order. `PG_BATCH_ROW` events still come at once, one per request of the row's key.
- **A failed run fails every request.** No request has had its last event before `end` or `fail`, so `fail`, or a refused ordinal, gives every request `PG_BATCH_FAILED` once, including keys that already had rows. That is `PG_BATCH_FAILED`'s documented meaning: its rows so far may be incomplete.

## Stage unsorted-batch — feat(interop): let a PgBatcher skip the ordinal sort

**Owns:** `std/net/postgres.ts`, `std/net/postgres-carrier.ts`, `tests/link/std_postgres_batch_unsorted/**` (new), `tests/link/std_postgres_carrier/**`, `tests/postgres/live/**`, `docs/guide/using-nish/postgres.md`, `docs/security/postgres.md`, `std/README.md`, `docs/AI.md`, `tests/self/goldens/checked/**` (generated), `.claude/plans/pg-batch-unsorted.plan.md` (status only)

One stage, one PR: the flag, its routing, its tests and its docs are one reviewable change, and splitting them would only chain two PRs.

## Statement

```ts
const order: string = config.orderBy.length > 0 ? `, ${config.orderBy}` : ""
const tail: string = config.sorted
  ? ` order by q.ord${order}`
  : config.orderBy.length > 0 ? ` order by ${config.orderBy}` : ""
this.sql = `select t.*, q.ord from unnest($1::${type}[]) with ordinality as q(key, ord) cross join lateral (${config.select}) as t${tail}`
```

The PgBatcher gets a private `sorted` field from the config.

## Routing

Only for `sorted = false`; the sorted path is not changed.

- `PgBatchRun` gets `had: boolean[]`, one per key, grown by `take` to the batch the way `tags` and `first` are, and cleared for the run's keys in `reset`. Nothing is allocated per row or per request.
- `row`: an ordinal is bad when it is missing, NULL, not an integer, below 1 or above `run.keys`. The "goes back" rule does not apply. A bad ordinal counts in `refused` and fails the run, as today. A good one sets `run.target`, marks `had[target]`, and resets the per-row request cursor.
- `next`, while `target >= 0`: emits `PG_BATCH_ROW` for each request of key `target`, then clears `target`. It does not advance `cur`.
- `next`, once `ended`: walks `cur` from 0 to `keys`, emitting `PG_BATCH_FAILED` when the run failed, else `PG_BATCH_DONE` when `had[cur]`, else `PG_BATCH_MISSING`, for each request of each key. Then the run closes and its handle is spent.
- The panics are unchanged: `row`, `end` or `fail` before `next` answered `PG_BATCH_NONE`, or a handle out of range. Events on a spent handle are counted in `stray`, as today.

Keep the two walks readable: either one `next` that branches on `sorted`, or a private `nextUnsorted`. Pick whichever keeps the sorted path's code unchanged.

## Carrier

[`std/net/postgres-carrier.ts`](../../std/net/postgres-carrier.ts) feeds a batcher's events to `PG_CARRIER_ROW` / `PG_CARRIER_DONE` / ... by `tag`. Read its batch routing and confirm it holds no "current request" that an interleaved ROW for another tag would break. If it does hold one, fix it and add a case to `tests/link/std_postgres_carrier`. If it does not, the PR body says so, with the lines read.

## Docs and record

- [`docs/guide/using-nish/postgres.md`](../../docs/guide/using-nish/postgres.md): next to the statement at line ~581, a `sorted` subsection. Cover the statement each mode prepares, when the last events come, what `orderBy` does under each mode, and why to use it (the Sort node it drops).
- `PgBatchConfig.sorted`'s JSDoc, the `PgBatcher` class comment, `row`'s comment, and the module's **Batching** paragraph: the event order under each mode.
- [`std/README.md`](../../std/README.md) `net/postgres.ts` row and [`docs/AI.md`](../../docs/AI.md) around line 2837: one clause each.
- [`docs/security/postgres.md`](../../docs/security/postgres.md) PG-14: the unsorted mode's ordinal check (1 to keys, any order), named by its tests. An ordinal that repeats a key, or goes back, cannot answer a request after its last event, because no last event is sent before `end`.

## Tests

`tests/link/std_postgres_batch_unsorted/` (new; mirror `tests/link/std_postgres_batch/main.ts`, its `args` and `expected.out`, feeding the connection the server's bytes):

- the statement: the default unchanged; `sorted = false` with no `order by`; `sorted = false` with `orderBy` ending in `order by <orderBy>` only;
- interleaved ordinals (for example 2, 1, 3, 1, 2): every request gets each row of its key as `PG_BATCH_ROW` in arrival order, no last event before `end`, then exactly one `PG_BATCH_DONE` each;
- duplicate requests for one key, each getting every row;
- a key with no rows: `PG_BATCH_MISSING` at `end`, never before;
- a failed run: an error after rows of two keys gives every request one `PG_BATCH_FAILED`, including those with rows; a lost connection does the same;
- bad ordinals (0, keys + 1, NULL, not an integer) fail the run, count in `refused`, and the rows after them are dropped; a repeated or earlier ordinal is accepted;
- spent handles: a row, end or fail after the run is answered counts in `stray`, and a reused run's handle does not see the old run's `had` flags;
- the run's handle is free again after its last events, with `next` answering `PG_BATCH_NONE`.

`tests/postgres/live/live.ts` and `expected/`: a new `explain` scenario that runs `explain (costs off)` on the sorted and unsorted statements of an int and a text batcher over the fixture's tables, and prints whether each plan has a `Sort` or `Incremental Sort` node. Expected output: the sorted plan does, the unsorted one with no `orderBy` does not. Also add one unsorted batcher to the `batch` scenario, so a real server's rows are routed in that mode, and print what it routes.

## Out of scope

- Changing the default. `sorted = true` stays the default; the challenge submission opts in.
- `PgBatchClock`, `PgBatchTurns`, `shed`, `take`'s key binding, and the binary or text decoding of ordinals.
- The challenge submission itself, which lives outside this repo.

## Verification

```bash
npm run check && npm run lint && npm run lint:dead
node scripts/security-scope.mjs && node docs/check-links.mjs
node tests/run.js std_postgres_batch
PG_BIN=/usr/lib/postgresql/16/bin node tests/postgres/live/run.mjs batch explain
node tests/self/goldens.js --update   # std/ changed; read the diff
```

CI's `postgres-live` job runs the live suite against PostgreSQL 18, and the eight `test` shards run the rest.
