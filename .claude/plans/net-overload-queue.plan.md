---
name: Newest-first serving under overload in HttpHandler
overview: HttpHandler always hands out its oldest queued request, so when the program falls behind, every request waits behind the backlog and the tail grows for the whole overload. Add an opt-in policy that switches to newest-first once the oldest request has waited past a threshold, and optionally sheds requests too old to be worth answering, then measure it on the saturated loadgen runs.
priority: 90
labels: [ready]
issue: 2047
stages:
  - id: queue-age
    title: Overload S1 — queue age and the newest-first policy in HttpHandler
    goal: HttpHandler records when each request was queued, reports the oldest queued request's age, and with HandlerLimits.lifoAfterMs set takes the newest request while the oldest has waited longer than that.
    verification: node tests/run.js net_handler && npm run check && npm run lint && npm run lint:dead && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    status: pending
    issue: 2050
    todos:
      - id: queued-at
        content: Add HttpRequest.queuedAt, stamped from turnAt in HttpHandler.enqueue, and HttpHandler.oldestWaitMs() over the live head of the queue — see Overload S1
        status: pending
      - id: lifo-take
        content: Add HandlerLimits.lifoAfterMs (0 means off, the default) and make take() and ready() pop the live tail of the ring while the head is older than it — see Overload S1
        status: pending
      - id: lifo-test
        content: Add a tests/link net_handler case that queues requests across connections, advances past the threshold and pins take order, FIFO below and newest-first above — see Overload S1
        status: pending
  - id: queue-shed
    title: Overload S2 — shedding requests older than a bound
    goal: With HandlerLimits.shedAfterMs set, a queued request older than it is answered 503 with Retry-After by the handler instead of being handed to the program, so newest-first cannot starve one request for the whole overload.
    verification: node tests/run.js net_handler && node scripts/security-scope.mjs && node docs/check-links.mjs
    status: pending
    issue: 2051
    todos:
      - id: shed-bound
        content: Add HandlerLimits.shedAfterMs and answer 503 with Retry-After for any queued request older than it during wait, counting them in a handler stat — see Overload S2
        status: pending
      - id: shed-record
        content: Record the starvation bound and the shed answer in docs/security/handler.md and its row in docs/security/README.md — see Overload S2
        status: pending
  - id: queue-measure
    title: Overload S3 — measure the policy at and past saturation
    goal: docs/BENCHMARKS.md has an interleaved A/B of FIFO against newest-first (and shedding) on the handler-ring server at the saturated thinks, reporting req/s, p50, p99, p99.9 and lost per round with its noise band, and the guide says when to turn it on.
    verification: bash bench/handler-ring/run.sh with the policy flag at the saturated thinks, then node docs/check-links.mjs
    status: pending
    issue: 2052
    todos:
      - id: bench-flag
        content: Add a --lifo-after and --shed-after option to bench/handler-ring/server.ts and run.sh so the same build runs every policy — see Overload S3
        status: pending
      - id: bench-run
        content: Run FIFO, newest-first and newest-first with shedding interleaved at the 1.6 s and 2 s thinks and one light load, and record the table in docs/BENCHMARKS.md naming the commit — see Overload S3
        status: pending
      - id: guide-page
        content: Document lifoAfterMs and shedAfterMs in docs/guide/using-nish/api-server.md with the measured trade-off, or record a decline if the A/B shows no tail gain — see Overload S3
        status: pending
  - id: queue-serve
    title: Overload S4 — the same policy for serve and the async Postgres pool
    goal: If S3 shows a tail-latency gain on HttpHandler, pgAsyncClaim's waiters are served newest-first past a wait threshold and serve sheds requests older than a bound; if it shows none, the decline is recorded.
    verification: node tests/run.js serve && node tests/run.js postgres_async
    status: pending
    issue: 2053
    todos:
      - id: claim-lifo
        content: Gate on S3's verdict, then add a newest-first waiter order past a threshold to pgAsyncClaim in std/net/postgres-async.ts with a tests/link case — see Overload S4
        status: pending
      - id: serve-shed
        content: Gate on S3's verdict, then add an age bound to serve's admission in std/net/serve.ts that answers 503 like the full-table path, with a tests/link case — see Overload S4
        status: pending
---

## Context

[`std/net/handler.ts`](../../std/net/handler.ts) queues each whole request in a ring (`enqueue`, line ~1026). [`take()`](../../std/net/handler.ts) always gives the program the request at `queueStart`, the oldest. When a program falls behind (a burst, a slow route, a saturated core), every new request waits behind the whole backlog. The tail then grows for as long as the overload lasts. [`docs/BENCHMARKS.md`](../../docs/BENCHMARKS.md) → "The ring's tail latency" shows exactly that: at the 2 s and 1.6 s thinks the servers were saturated and "their p99 there is a backlog that grows for the whole window".

Under overload, newest-first serving keeps the tail short for most requests by giving up on the oldest ones. Those are the requests whose clients are most likely to have timed out already. This is the "adaptive LIFO" pattern: FIFO while the queue is healthy, newest-first once it is not.

Nothing in [`.claude/plans/`](.) or the open issues covers it. The only LIFO in the plans is buffer lending ([`wp39-http-server.plan.md`](wp39-http-server.plan.md), settled).

## Approach

- **Reordering is safe in this queue.** The handler reads a connection's next request only once the one before it is answered and handed over (the module doc, "Keep-alive and pipelining are the carrier's"). So the queue holds at most one request per connection, and reordering it never reorders one connection's responses.
- **Opt-in, off by default.** `lifoAfterMs = 0` keeps today's FIFO byte for byte. Whether to change the default is S3's call, made from figures.
- **Threshold on the oldest request's age, not the queue length.** Queue length depends on the route mix; age is what the client sees. The age is measured from `turnAt` at enqueue, so it costs no extra clock read.
- **Shedding bounds the starvation.** Pure newest-first can leave one request queued for the whole overload. `shedAfterMs` answers it 503 with `Retry-After` instead. That is a bound a peer can rely on, and it belongs in the security record.

## Overload S1 — queue age and the newest-first policy in HttpHandler

- `HttpRequest.queuedAt: i64`, set in `enqueue` from `this.turnAt` (the turn's `monotonicNanos`).
- `HttpHandler.oldestWaitMs(): i32` is the age of the live head (skipping dead entries as `ready()` does), or 0 when the queue is empty. It is public, so a program can export it as a metric.
- `HandlerLimits.lifoAfterMs: i32 = 0`. In `take()`: if it is above 0 and the live head's age exceeds it, pop the live tail (`(queueStart + queueCount - 1) % size`) instead of the head. `ready()` must then skip dead entries at the tail as well as the head; factor the liveness walk into one helper used from both ends.
- The doc comment, its `@param`/`@returns` and the module's header paragraph change with it, then run `node scripts/gen-reference.mjs`.
- Test: add a case beside [`tests/link/net_handler`](../../tests/link/net_handler). It opens N connections, sends one request each, holds the program back past the threshold, and pins the routes `take` gives out in order (FIFO below the threshold, newest-first above). Mirror that case's client harness.

## Overload S2 — shedding requests older than a bound

- `HandlerLimits.shedAfterMs: i32 = 0` (off). During `wait`, after the turn's events, walk the queue from the head while the head is older than the bound. Answer each such request 503 with `Retry-After: 1` through the same path as `problem`, release it, and count it in a new `shed()` counter.
- [`docs/security/handler.md`](../../docs/security/handler.md) gets a finding row. The issue: under `lifoAfterMs` without `shedAfterMs`, a peer's request can wait unboundedly while newer ones are served. The fix: a pinned test that a request older than `shedAfterMs` is answered 503 within one turn. Update its count in [`docs/security/README.md`](../../docs/security/README.md).
- A diagnostic code is not involved; this is a runtime answer, not a compile error.

## Overload S3 — measure the policy at and past saturation

- [`bench/handler-ring/server.ts`](../../bench/handler-ring/server.ts) reads `--lifo-after MS` and `--shed-after MS`; [`run.sh`](../../bench/handler-ring/run.sh) passes them as part of a design name, so one build runs as `fifo`, `lifo` and `lifo-shed`, interleaved.
- Run at the thinks that saturate the box (2 s and 1.6 s at 90,000 connections, or the equivalent on the host used) and one light load as a control. Report req/s, p50, p99, p99.9, `lost` and the shed count, as medians (min to max) of at least 3 rounds. Name the commit the bench code ran at. The p99 noise there is up to 11.8× across rounds (BENCHMARKS.md, same section), so the verdict reads which side is lower in each round, not the digits.
- What counts as a win: a lower p50 and p99 in every round at saturation, no req/s loss outside the band, and no change at the light load. Shed and `lost` are reported beside it, never folded into the percentiles.
- Then [`docs/guide/using-nish/api-server.md`](../../docs/guide/using-nish/api-server.md) gains a short "When the server falls behind" section with the measured trade-off. If the A/B shows no gain, record the decline in BENCHMARKS.md, mark S2/S3's guide todo cancelled with the reason, and leave the flags documented only in the reference.

## Overload S4 — the same policy for serve and the async Postgres pool

[`std/net/serve.ts`](../../std/net/serve.ts) does not queue in the handler. Each turn it spawns a task for every ready request until its task slots run out, then answers 503 (`serveFreeSlot`, line ~1572). Its backlog therefore lives in the executor and in [`pgAsyncClaim`](../../std/net/postgres-async.ts)'s waiters, not in a ring that `take` reorders. Applying the policy there means ordering the claim waiters newest-first past a wait threshold, and that is a different change.

**Decided (owner, 2026-11-20): build it only if S3 shows a gain.** S4 starts once S3's verdict is recorded.
- If S3 shows a lower p50 and p99 at saturation with no throughput loss, build both items:
  - `pgAsyncClaim` serves its waiters newest-first once the oldest has waited past a threshold (a new `PgAsyncPool` field, 0 meaning off).
  - `serve` answers 503 to a request older than a bound at admission (a new `ServeLimits` field, 0 meaning off), through the same path as the full-task-table 503 and counted in `ServeStats.busy` or a new counter.

  Each lands with a `tests/link` case pinning the order or the shed, its guide lines in [`postgres.md`](../../docs/guide/using-nish/postgres.md) and [`api-server.md`](../../docs/guide/using-nish/api-server.md), and its [`docs/security/serve.md`](../../docs/security/serve.md) row.
- If S3 shows no gain, mark both todos cancelled and record the decline beside S3's table in BENCHMARKS.md.

## Out of scope

- HTTP/2 and HTTP/3 servers: their streams are not queued through `HttpHandler`.
- Changing the default to newest-first. Off stays the default until S3's figures and an owner decision say otherwise.
- The TCP delayed-ACK piggyback argument. It is not measured here; the claim this plan tests is tail latency at saturation.

## Tests

- New `tests/link/net_handler_*` case for take order (S1) and for the 503 shed within one turn (S2), with `expected` stdout like the existing `net_handler` cases.
- `tests/link/net_handler` keeps passing unchanged, which pins that the default is still FIFO.

## Verification

```bash
npm run check
npm run lint
npm run lint:dead
node tests/run.js net_handler
node scripts/gen-reference.mjs --check
node scripts/security-scope.mjs
node docs/check-links.mjs
```
