---
name: WP34 — the network stack, the open follow-ups
overview: All 24 WP34 stages have landed. Five issues remain here (a sixth, RSA certificates on the TLS server, moved to tls-rsa-server.plan.md), one for each loose end the earlier stages left, in nish:net, the PostgreSQL batcher and async pool, and the PostgreSQL bench and guide.
spec: docs/wp34-network-stack.md
priority: 80
issue: 1852
stages:
  - id: s25-net-after-n5
    title: WP34 S25 — nish:net after N5, split what is left of the tcpConnect issue
    goal: The leftovers of issue 357 are either shipped or split into their own issues, and the issue is closed once tcpConnect and DNS are confirmed done.
    verification: node tests/run.js net && node tests/run.js wasi && npm run lint
    status: pending
    issue: 357
    labels: [needs-decision]
    todos:
      - id: s25-confirm-done
        content: Confirm tcpConnect and the DNS resolver in std/net/dns.ts, std/net/fetch.ts and std/net/postgres-async.ts cover the issue's client and DNS items, and say so on the issue — see WP34 S25 — nish:net after N5
        status: pending
      - id: s25-batching
        content: Measure sendmmsg and recvmmsg for the relay's per-tick fan-out against GSO before adding anything to runtime/ — see WP34 S25 — nish:net after N5
        status: pending
      - id: s25-split
        content: Split edge-triggered mode, timers beyond pollWait and Windows and WASI sockets into their own issues or record them as not planned — see WP34 S25 — nish:net after N5
        status: pending
  - id: s26-tls-rsa-server
    title: WP34 S26 — RSA certificates on the TLS server
    goal: Moved to its own plan, tls-rsa-server.plan.md (stage s1-rsa-server), which now holds issue 481, so it can be placed on the Roadmap beside WP71's HttpArena entry.
    verification: node tests/run.js tls && node tests/run.js ct_asm && node scripts/security-scope.mjs && npm run lint
    status: cancelled
    todos:
      - id: s26-confirm-rest
        content: Confirm P-256 key shares, session tickets and record_size_limit are done in std/net/tls and close those items on the issue — see WP34 S26 — RSA certificates on the TLS server
        status: pending
      - id: s26-rsa-sign
        content: Add RSA-PSS signing with constant-time big-number arithmetic and a Secret private key to std/crypto/rsa.ts, which today only verifies — see WP34 S26 — RSA certificates on the TLS server
        status: pending
      - id: s26-key-parse
        content: Parse an RSA private key and certificate in std/crypto/x509.ts and offer it in the server's signature algorithms in std/net/tls.ts — see WP34 S26 — RSA certificates on the TLS server
        status: pending
      - id: s26-record
        content: Add Wycheproof signing vectors, a ct_asm fixture, and update docs/security/crypto-rsa.md and docs/security/tls.md with their README rows — see WP34 S26 — RSA certificates on the TLS server
        status: pending
  - id: s27-batcher-collide
    title: WP34 S27 — PgBatcher per-key cost for colliding int keys, and the guide's flat claim
    goal: The per-key cost for colliding int keys is either flat within the noise band or the guide qualifies its claim with the measured figure, and the guide shows the full int4 and int8 array table or links it.
    verification: node tests/run.js postgres && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    issue: 1165
    labels: [needs-decision]
    todos:
      - id: s27-decide
        content: Choose between accepting the PG_BATCH_PROBES bound with a qualified guide claim and lowering the collider cost in std/net/postgres.ts — see WP34 S27 — PgBatcher per-key cost
        status: pending
      - id: s27-guide
        content: Qualify the flat claim near line 655 of docs/guide/using-nish/postgres.md and the collision note near line 585, and add the other int4 and int8 lengths or link them — see WP34 S27 — PgBatcher per-key cost
        status: pending
      - id: s27-take-sizing
        content: Size take's table and run arrays from the take rather than the backlog, and fix the pgIntHash comment and the garbled sentence in docs/security/postgres.md — see WP34 S27 — PgBatcher per-key cost
        status: pending
      - id: s27-tests
        content: Assert the colliding live case collides, assert one execution per case and 0 waiting, and make bench/postgres/batch-scale.mjs compare the flatness ratio with its band — see WP34 S27 — PgBatcher per-key cost
        status: pending
  - id: s28-async-reconnect-leak
    title: WP34 S28 — pgAsyncConnect keeps about 17 KB per reconnect in the caller's arena
    goal: Reconnecting a PgAsyncPool connection in a loop holds RSS flat, or the bound is documented, with an RSS-measuring test pinning the answer.
    verification: node tests/run.js postgres && node tests/run.js link && npm run lint
    status: pending
    issue: 1325
    todos:
      - id: s28-repro
        content: Rewrite the reconnect-loop probe (claim, release with reusable false, query) and confirm the 16.5 to 17 KB per cycle on main — see WP34 S28 — pgAsyncConnect reconnect memory
        status: pending
      - id: s28-fix
        content: Connect into memory reused per slot in std/net/postgres-async.ts, or document the bound in its header and docs/guide/using-nish/postgres.md — see WP34 S28 — pgAsyncConnect reconnect memory
        status: pending
      - id: s28-test
        content: Add a test that measures RSS across thousands of reconnects, since Arena.used does not show it, beside tests/link/std_postgres_async_flat — see WP34 S28 — pgAsyncConnect reconnect memory
        status: pending
  - id: s29-bench-qps
    title: WP34 S29 — queries per second in the PostgreSQL Measured lines
    goal: bench/README.md's PostgreSQL table has a q/s column with median, IQR and band from a full 12-round run, one Measured line per workload, and a sentence saying q/s is server-bound on one connection.
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    issue: 948
    todos:
      - id: s29-run
        content: Run bench/postgres/run.mjs for the full 12 rounds against PostgreSQL and libpq pipeline mode and record q/s median, IQR and band per workload — see WP34 S29 — queries per second in the Measured lines
        status: pending
      - id: s29-readme
        content: Add the q/s column and one Measured line per workload to the PostgreSQL section of bench/README.md, saying q/s is server-bound — see WP34 S29 — queries per second in the Measured lines
        status: pending
  - id: s30-conduit-carrier
    title: WP34 S30 — the guide's carrier runs the Conduit article list
    goal: A single live check covers the article list through the guide's carrier, or the guide points at the live suite's conduit scenario and the split is accepted.
    verification: node tests/run.js postgres && npm run lint
    status: pending
    issue: 947
    labels: [needs-decision]
    todos:
      - id: s30-decide
        content: Choose between an HTTP route on tests/postgres/carrier.ts that runs the article list through the pool and pointing the guide at the conduit scenario in tests/postgres/live/live.ts — see WP34 S30 — the Conduit article list through the carrier
        status: pending
      - id: s30-implement
        content: Implement the chosen option and update docs/guide/using-nish/postgres.md and the expected output — see WP34 S30 — the Conduit article list through the carrier
        status: pending
---

# WP34 — the network stack, the open follow-ups

## Context
All 24 of 24 roadmap stages have landed (the crypto kernels, TLS 1.3 server and client, HTTP/1.1 to HTTP/3, WebTransport, the relay, the phase-two builtins) — see [the design note](../../docs/wp34-network-stack.md). No roadmap box is open. Design note: [docs/wp34-network-stack.md](../../docs/wp34-network-stack.md). The stages below are the six open issues assigned to this plan; the test-section names in `verification` are guesses for the lead to refine.

## WP34 S25 — nish:net after N5, split what is left of the tcpConnect issue
#357 lists what N5 scoped out. `tcpConnect` is exported and used by `std/net/dns.ts`, `fetch.ts` and `postgres-async.ts`, and `std/net/dns.ts` exists, so the "Nish client" and "DNS" items look done (the lead should confirm; `docs/security/dns.md` and `fetch.md` exist). Still unplaced: `sendmmsg` and `recvmmsg` batching (nothing in `std/net` mentions them), edge-triggered mode, timers beyond `pollWait`, Windows and WASI sockets. The issue itself says to split them when one is picked up.

### Decision needed
Close #357 as done for tcpConnect and DNS and open one issue per remaining item (recommended, as the issue itself instructs), or keep it as the umbrella. Batching is measured against GSO before anything is added.

## WP34 S26 — RSA certificates on the TLS server

**Moved** to [`tls-rsa-server.plan.md`](tls-rsa-server.plan.md), which holds #481 now: HttpArena mounts an RSA-2048 pair, so every TLS profile of [WP71](../../docs/wp71-httparena.md) waits on it, and it is placed on the Roadmap after WP71. The text below is the record of what was planned here.

#481 lists four server gaps. On main three look done: secp256r1 key shares (roadmap T1 row, #1449), session tickets (`std/net/tls/ticket.ts`, `docs/security/tls.md` resumption) and `record_size_limit` (WP39 G3). What stays: the server signs only with P-256 ECDSA, and `std/crypto/rsa.ts` says it is verification only. That needs RSA-PSS signing with constant-time big numbers, a new crypto lane with its own vectors and audit. Acceptance from the issue: an RSA-certificate server accepted by `curl` and Chrome, plus Wycheproof vectors and a `docs/security/` record. Client authentication stays out of scope. Reads: `docs/security/crypto-rsa.md`, `docs/security/tls.md`.
Likely files: `std/crypto/rsa.ts`, `std/crypto/x509.ts`, `std/net/tls.ts`.

## WP34 S27 — PgBatcher per-key cost for colliding int keys, and the guide's flat claim
#1165 (from run #1149): on main at 61011739, PostgreSQL 18.6, `bench/postgres/batch-scale.mjs` shows the per-key wall time from 1,024 to 65,536 keys at 1.13x for spread, 1.48x for dense ranges and 2.30x (2,799 to 6,428 ns, band 35 percent) for colliding keys. Each key probes at most `PG_BATCH_PROBES` (1024) slots, so it is linear, not quadratic. The guide at `docs/guide/using-nish/postgres.md` line 655 says a take's cost per request stays flat. The guide also shows only length 1,000 of the 32-cell array table in #1150. Deferred round-2 findings from #1158: `take` sizes arrays from the backlog, not the take; the `pgIntHash` comment's "never collide" is off by the final shift; one garbled sentence in `docs/security/postgres.md`; four test gaps listed in the issue.

### Decision needed
Accept the bound and qualify the guide's "flat" claim with the measured figure, or lower the cost for colliders (a smaller probe bound at large sizes, a seeded hash, another collision strategy) and re-measure. The issue gives no recommendation.

## WP34 S28 — pgAsyncConnect keeps about 17 KB per reconnect in the caller's arena
#1325, from the dynamic review of #1323: reconnecting a `PgAsyncPool` connection in a loop grows RSS by 16.5 to 17 KB a cycle (10000 cycles reach about 165 MB; with a cancelled query 19.7 MB at 1000), and a control with no cancel grows the same, so the cause is the reconnect path from #1321, not cancellation. Presumed cause: allocation in the caller's arena, which `main` never scopes. Not checked on main here.
Likely files: `std/net/postgres-async.ts`.

## WP34 S29 — queries per second in the PostgreSQL Measured lines
#948: `bench/postgres/run.mjs` already prints q/s (`run.mjs:316`), but the `Measured:` lines and `bench/README.md` give client CPU only. From the acceptance session: pk 42,029 against libpq 42,173 q/s, list 590 against 597, insert 3,014 against 3,026, with client CPU 18 to 33 percent lower. Say q/s is server-bound on one connection.

## WP34 S30 — the guide's carrier runs the Conduit article list
#947: the live suite's `conduit` scenario (`tests/postgres/live/live.ts`, expected `tests/postgres/live/expected/conduit.out`) runs SCRAM, prepares the article list and pipelines it on its own epoll driver, and `postgres-live` CI is green. The guide links `tests/postgres/carrier.ts`, whose query is `select 'slept ' || $1 from pg_sleep($1::float8)`.

### Decision needed
(1) Give the carrier an HTTP route that runs the article list through the pool and prints rows, so one live check covers the criterion as written; (2) point the guide at the live `conduit` scenario and accept the split. The issue recommends neither.
