---
name: Conduit — coalesce same-shape reads into one array-parameter statement
overview: Cut the Conduit server's Postgres CPU per request (bench/multicore/conduit) from 233–246 µs toward the challenge target of ≤190 µs (#1 ≈ 213) at 4,000 users, think-scale 0.1, full seed. Per-transaction overhead dominates (pgbench backend CPU for 4 article reads — 4 transactions 278–386 µs, one transaction 209–217 µs, one `unnest`/array-parameter statement 148–159 µs), so waiting reads of one shape are coalesced into one statement with array parameters and their rows routed back by ordinal, hottest shape first. One stage, one PR, `perf(bench): ...`.
stages:
  - id: coalesce-reads
    title: "perf(bench): coalesce the Conduit server's same-shape reads into one array-parameter statement"
    goal: Postgres µs/request at 4,000 users falls by more than the paired spread against the current build, with p95/p99 and errors no worse, conformance 197/197, and every attempt — kept or reverted — recorded in the lab notebook
    verification: PG_BENCH_DIR=<dir> bash bench/multicore/run.sh --alt <previous binary> --users 4000 --think-scale 0.1 --repeat 3 --measure 60 --idle 0 shows the paired difference outside the spread with conformance 197/197; npm run check, npm run lint, npm run lint:dead and node docs/check-links.mjs pass; the concurrency check passes; every CI test shard green and undegraded
    status: pending
    todos:
      - id: read-first
        content: Read CLAUDE.md, .claude/orientation.md and bench/multicore/conduit/README.md in full (design, method, O1–O8). O8 (read batching as one pipelined group) was measured and reverted — do not retry it. Read the rust-tokio-Scooter1337 submission's README in arjaythedev/multicore-server-challenge for its read coalescing — ideas only, cite it in the README, copy nothing (.claude/licensing.md)
        status: pending
      - id: baseline-binary
        content: Set up Postgres with bench/multicore/setup.sh (stop any other Postgres on that data dir first), build the current main server and keep that binary as the --alt A side for the first pair
        status: pending
      - id: coalesce-article-slug
        content: "Coalesce GET /api/articles/:slug (article_slug): waiting requests become one statement over unnest($1::text[]) WITH ORDINALITY (viewer as a parallel array where the row depends on it), rows routed back to each request by ordinal, a missing slug answered 404 for its own request only. Keep enough requests queued per connection, or size the pool so it opens every read connection (PgPool opens one only when more than maxInFlight groups per connection wait — the trap that pinned O8 to one backend). Postgres holds a group's results until Sync, so a request is answered from its own statement's rows, not the whole group's"
        status: pending
      - id: measure-article-slug
        content: Measure paired against the previous binary with the verification command; keep it only if the Postgres µs/req difference beats the spread and p95/p99 are no worse; otherwise revert it. Record it as O9 in the README's changes table either way, with figures
        status: pending
      - id: coalesce-comments
        content: Same for GET /api/articles/:slug/comments, measured paired against the build before it and recorded (O10), kept only if it beats the spread
        status: pending
      - id: coalesce-tags
        content: "GET /api/tags is viewer-independent: one execution answers every request that was waiting before it was sent; no result outlives that execution (no caching across requests). Measure paired, record (O11), keep only if it beats the spread"
        status: pending
      - id: concurrency-check
        content: Add a concurrency check under bench/multicore/ — many concurrent mixed reads (article by slug with and without a viewer, missing slugs, comments, tags) must answer byte-identical to the same reads made serially, on a fresh copy of the dev seed; run it and put its result in the PR body
        status: pending
      - id: notebook
        content: Update the README — the changes table (every attempt, kept or not), "Where it stands" with the new rows, the target table, and the ~94k-user projection recomputed from the new Postgres figure — then re-stage the submission with node bench/multicore/stage.mjs
        status: pending
      - id: gates
        content: Conformance 197/197, npm run check, npm run lint, npm run lint:dead, node docs/check-links.mjs, node tests/run.js for any section the change touches; open the PR with the paired figures and the concurrency result
        status: pending
---

# Conduit — coalesce same-shape reads

## The lead

pgbench, backend CPU per transaction, for 4 article reads:

| form | µs |
| --- | ---: |
| 4 transactions | 278–386 |
| the same 4 in one transaction | 209–217 |
| one `unnest` / array-parameter statement | 148–159 |

O8 captured only the middle row's saving (one implicit transaction per group) and lost it to the
pool pinning reads to one backend. This change goes for the last row: one statement per shape.

## coalesce-reads

**Owns:** `bench/multicore/**`

Nothing else. In particular not `std/**`, `src/**`, `.github/**` or `package.json`. If PgPool's
connection-opening rule gets in the way, work around it with the pool's configuration from the
bench (as O8's last build did), and say in the PR body what a std change would have bought — do
not make it.

### Rules the challenge enforces

- No caching across requests: a coalesced result answers only the requests that were waiting
  when its statement was sent.
- Writes committed before the response (O7's group commit stays as is).
- At most 95 Postgres connections.

### Measuring

Every change paired in one session against the binary before it:

```
PG_BENCH_DIR=<dir> bash bench/multicore/run.sh --alt <previous binary> \
  --users 4000 --think-scale 0.1 --repeat 3 --measure 60 --idle 0
```

Keep a change only when it beats the spread. Watch p95 and p99 as well as CPU — O8's first
build "won" 207–220 µs with p95 tripled. Run one benchmark at a time, in the background with
output to a file; commit first.

### Not this PR

Upstream submissions, the challenge repo, `.github/**`, `package.json`, #933 and any
`chore(release)` PR.
