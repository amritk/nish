---
name: Conduit server for the multicore server challenge, past #1
overview: Build a RealWorld Conduit server in Nish for arjaythedev/multicore-server-challenge that passes its 197 conformance checks and beats #1 (rust-tokio-Scooter1337) on Postgres CPU per request, with the std/runtime fixes it needs, a local benchmark harness and a staged submission folder, all in one pull request.
stages:
  - id: conduit
    title: "feat(net): a Conduit server for the multicore server challenge"
    goal: One PR carrying the std/runtime prerequisites, bench/multicore/conduit, the bench/multicore harness and the staged submission at bench/multicore/submission/nish-std-amritk, with measured figures against the targets derived from #1
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/run.js prefork && node tests/run.js net && bash bench/multicore/run.sh --conformance-only reports 197/197; then an undegraded npm test before the PR opens, and every CI test shard green and undegraded on the head
    status: pending
    todos:
      - id: read-challenge
        content: Clone the challenge at a pinned commit into the scratchpad and read README, SPEC, WORKLOAD, LEADERBOARD, box/, test/run.sh and the three named submissions — see Reading
        status: pending
      - id: prefork-no-restart
        content: Add a no-restart mode to PreforkConfig in std/net/prefork.ts with tests/link cases and its guide section — see Prerequisites, P1
        status: pending
      - id: tcp-nodelay
        content: Set TCP_NODELAY on tcpConnect sockets in runtime/runtime-net.c, drop the bench/postgres setsockopt workaround, test it, document it, Fixes 942 in the first push — see Prerequisites, P2
        status: pending
      - id: event-loop-100k
        content: Confirm pollWait is epoll-backed with no O(all fds) work per wakeup and that Http1Server sweeps do not scan every slot per tick, and fix what does — see Prerequisites, P3
        status: pending
      - id: idle-memory
        content: Measure RSS per idle Http1Server connection and add an option to release a slot's input buffer while idle if it is KiBs — see Prerequisites, P4
        status: pending
      - id: harness-setup
        content: Write bench/multicore/setup.sh (PG18 cluster tuned like box/, max_connections=100, pinned seed) reusing bench/postgres/setup.sh — see Harness
        status: pending
      - id: server-correct
        content: Write the straightforward pipelined server in bench/multicore/conduit and pass test/run.sh 197/197 on the dev seed — see Server, Correct first
        status: pending
      - id: bcrypt-process
        content: Run bcrypt in one dedicated process batching up to 4 lanes into bcryptVerify4/bcryptHash4, reached over a local socket, passwords as Secret and wiped — see Server, bcrypt
        status: pending
      - id: harness-run
        content: Write bench/multicore/run.sh driving the challenge's own box/ load generator at fixed open-loop loads and printing req/s, p95/p99, errors, Postgres and app µs/request and KiB/idle connection — see Harness
        status: pending
      - id: baseline
        content: Measure the baseline on the full seed (or the largest that fits, said so) and record it with its noise band in bench/multicore/conduit/README.md — see Measuring
        status: pending
      - id: optimize
        content: Add optimizations one at a time (SETs, page-cut subqueries, app-side formatting, group commit, read coalescing, topology sweeps), keeping only those beyond the noise band, every result recorded — see Server, Optimizations
        status: pending
      - id: submission
        content: Stage bench/multicore/submission/nish-std-amritk with install.sh, build.sh, start.sh, README, LICENSE, .gitignore and notices, proven end to end from npm pack as a fresh user — see Submission
        status: pending
      - id: records-and-docs
        content: Add the docs/security records the new attacker-facing code needs, THIRD_PARTY_NOTICES.md rows for anything copied, and the guide pages for every user-visible std change — see Docs and records
        status: pending
      - id: pr
        content: Run the definition of done, open the PR with the figures table and the user projection — see Definition of done
        status: pending
---

# Conduit server for the multicore server challenge

## Context

[arjaythedev/multicore-server-challenge](https://github.com/arjaythedev/multicore-server-challenge) scores RealWorld Conduit servers by how many simulated users they hold on an 8-vCPU, 16 GB Ubuntu 24.04 box against Postgres 18. #1 is rust-tokio-Scooter1337: 100,000 users, 26,279 req/s, p95 119 ms. Postgres takes 70–80% of the CPU in every top entry, so Postgres CPU per request is the main lever, then app CPU per request, then memory per idle connection.

Nish already has most of the parts on `main`: [std/net/postgres.ts](../../std/net/postgres.ts) (PgPool with pipelining, PgArrayWalker, zero-copy column reads), [std/net/http1-server.ts](../../std/net/http1-server.ts), [std/net/router.ts](../../std/net/router.ts), [std/json.ts](../../std/json.ts) JsonWriter, [std/crypto/hmac.ts](../../std/crypto/hmac.ts), [std/crypto/base64url.ts](../../std/crypto/base64url.ts), [std/crypto/bcrypt.ts](../../std/crypto/bcrypt.ts) (bcryptHash4/bcryptVerify4), [std/net/prefork.ts](../../std/net/prefork.ts), [tests/postgres/carrier.ts](../../tests/postgres/carrier.ts) (a pollWait loop driving pool sockets beside an HTTP listener), [tests/postgres/live](../../tests/postgres/live) and [bench/postgres/setup.sh](../../bench/postgres/setup.sh). Design background: [docs/wp42-multicore-server.md](../../docs/wp42-multicore-server.md).

The owner's request is reproduced verbatim in the tracking issue and the worker prompt. It is authoritative where this plan is shorter.

## Approach

**Owns:** `std/**` (a `std/crypto` change only with its security record), `runtime/runtime-net.c`, `runtime/runtime-os.c`, `runtime/nish.d.ts`, `src/runtime.ts` and `src/nish-modules.ts` (only if P2 changes a builtin's signature), `tests/**`, `bench/**`, `docs/**`, `THIRD_PARTY_NOTICES.md`, `.claude/plans/conduit-challenge.plan.md`. Not `.github/**`, not `package.json`, not `src/**` beyond the two files named.

One stage, because the owner asked for one PR. The std fixes are still their own conventional commits inside it (`fix(runtime)`, `feat(net)`, …), so the PR history reads right. The squash merge lands one changelog entry, so its body names each std fix.

Every rule that shapes the design is checked against the challenge's README before code depends on it, and a rule the README contradicts goes in the PR body: ≤ 95 Postgres connections, no ALTER SYSTEM or schema changes, never `synchronous_commit=off`, no caching across requests (coalescing only among requests already waiting), every write committed before its response, bcrypt cost 10 on every login, HS256 signature and exp on every request, no benchmark detection, no worker auto-restart (rule 9), `Front: direct` on 0.0.0.0:80 with an idle timeout ≥ 65 s.

## Reading

Clone the challenge into the scratchpad at a commit you record, and read README.md, SPEC.md, WORKLOAD.md, LEADERBOARD.md, box/ and test/run.sh. Read submissions/rust-tokio-Scooter1337 (README and source), and the READMEs of csharp-sockets-jh-d and c-iouring-tigokraft. They are MIT: anything copied keeps its notice and gets a THIRD_PARTY_NOTICES.md row ([.claude/licensing.md](../licensing.md)). Settle from SPEC and conformance: the bcrypt prefix signup may write ($2a$ or $2b$), and whether a capped articlesCount is allowed.

## Prerequisites

Each is its own commit with tests and its guide section.

- **P1, prefork without restarts.** Add an option to `PreforkConfig` (e.g. `restart: boolean`, default today's behaviour): a dead worker stays dead, and the supervisor exits once none remain or on SIGTERM. Tests beside [tests/link/net_prefork](../../tests/link/net_prefork). Document it in the networking guide's prefork section.
- **P2, TCP_NODELAY on tcpConnect** ([#942](https://github.com/amritk/nish/issues/942)). On by default or as a flag, whichever matches nish:net's style (`tcpAccept` takes a flag today). The fix lives in [runtime/runtime-net.c](../../runtime/runtime-net.c) and its declaration in [runtime/nish.d.ts](../../runtime/nish.d.ts); touch `src/` only if the builtin's signature changes, and then follow [.claude/selfhost.md](../selfhost.md). Drop the workaround at [bench/postgres/main.ts](../../bench/postgres/main.ts):67–71 and :381–386. `Fixes #942` in the first push.
- **P3, the event loop at 100k fds.** Confirm pollWait is epoll-backed with no O(all fds) work per wakeup, and that Http1Server's expire/idle sweeps do not scan every slot each tick. Fix what does, with a test or a measurement that pins it.
- **P4, idle connection memory.** Measure RSS per idle keep-alive connection. If it is KiBs of buffer, add an Http1Config option to release a slot's input buffer while idle between exchanges. The server sets idleTimeout ≥ 65000.
- **P5, anything else hit.** Fix std rather than work around it in the server, and say why in the commit body.

A change to `runtime/*.c` or a `nish:` module that reads the network lands with its `docs/security/` record update ([docs/security/README.md](../../docs/security/README.md)).

## Server

Lives in `bench/multicore/conduit/`.

### Correct first

The straightforward server: prefork with SO_REUSEPORT (`tcpListenFlags(..., 1)`) and restarts off, N=2 workers to start, each owning a PgPool of read and write connections (≤ 16 pipelined groups each, the rest FIFO), every connection sending `SET plan_cache_mode=force_generic_plan`, `SET jit=off` and `SET max_parallel_workers_per_gather=0` at startup. Every statement registered up front. JWT HS256 over a precomputed HmacSha256 keyed with JWT_SECRET, sub/iat/exp per SPEC, signature and exp checked every request. It passes test/run.sh 197/197 on the dev seed before any optimization.

### bcrypt

One dedicated process the workers reach over a unix socket or loopback TCP (whatever std/net offers), batching up to 4 lanes into bcryptVerify4/bcryptHash4 with a collection window up to ~160 ms (tune it), sized for login bursts. Salts from the CSPRNG. Passwords are `Secret<u8[]>` and wiped ([CLAUDE.md](../../CLAUDE.md) → Security).

### Optimizations

One at a time, conformance re-run after each, kept only beyond the noise band, every result kept or dropped recorded in `bench/multicore/conduit/README.md`:

- feeds and lists cut the page in a subquery on the indexed sort before any join; author, following, favorited and favoritesCount via LATERAL after pagination; capped articlesCount only if allowed;
- raw text columns formatted in Nish: RFC 3339 with 3 fractional digits truncated, tags sorted under C collation, JSON built from colStart/colLength into JsonWriter, text[] walked with PgArrayWalker;
- group commit on write connections: up to 128 mutations or ≤ 1 ms per transaction, each response after COMMIT; a failed batch rolls back and retries each request alone; an uncertain commit answers 500 and is never retried;
- read coalescing of compatible queued reads of one shape into one array-parameterized LATERAL query (`unnest($1::...[]) WITH ORDINALITY`), ≤ 32 per group, no collection delay;
- topology sweeps: workers 1–4, read/write connection counts within 8–28 total;
- direct HTTP/1.1: keep-alive, a large backlog, several accepts per wakeup, no per-request allocation on the hot path, the cached Date header.

## Harness

`bench/multicore/setup.sh`: a PG18 cluster tuned like box/ (max_connections=100), seeded at the pinned challenge commit, reusing [bench/postgres/setup.sh](../../bench/postgres/setup.sh). `bench/multicore/run.sh`: build, start the server, run conformance, then run box/'s own load generator (read it, do not reimplement it) at fixed open-loop loads, and print req/s, p95/p99, errors, Postgres µs/request (summed `/proc/<pid>/stat` of every postgres backend over the run ÷ completed requests), app µs/request and KiB per idle connection. Wire it the way bench/postgres is wired; the full run stays manual. No `.github/workflows` edits.

## Measuring

Check disk first; use the full seed (100k users, 500k articles, ~2.35 GB) or the largest that fits and say so. Targets, per request, because this container has 4 cores and the box has 8:

| metric | #1 (derived) | target |
| --- | --- | --- |
| Postgres CPU / request | ≈ 213 µs | ≤ 190 µs |
| app CPU / request | ≈ 61 µs | ≤ 61 µs |
| RSS / idle keep-alive connection | ~1 KiB at 100k | ~1 KiB plus kernel |
| fixed open-loop load, 5-minute hold | p95 119 ms | p95 < 500 ms, p99 < 1 s, < 1% errors |

Every figure carries its noise band ([.claude/testing.md](../testing.md) → "A `Measured:` trailer").

## Submission

`bench/multicore/submission/nish-std-amritk/`: install.sh (root, clean Ubuntu 24.04: apt clang-18, lld-18, llvm-18, and a pinned released nish from npm or the official installer), build.sh (normal user, CC=clang-18, pinned), start.sh (foreground, env only: DATABASE_URL, JWT_SECRET, HOST, PORT; `ulimit -n` high; GET /api/tags answers within 60 s), README.md (`Front: direct`, versions, every optimization), .gitignore, LICENSE (MIT), notices for anything vendored. Pin the version release PR #933 will carry (its title today: `chore(release): 0.22.0`). Prove the scripts end to end with `npm pack` of this checkout standing in for the release, in a fresh directory as a fresh user. Never merge #933 or any `chore(release):` PR.

## Docs and records

Guide pages for every user-visible std change (prefork option, tcpConnect Nagle, the idle-buffer option), per [docs/README.md](../../docs/README.md#writing-a-guide-page). `docs/security/` records for attacker-facing changes, and `node scripts/security-scope.mjs` passing. THIRD_PARTY_NOTICES.md for anything copied.

## Out of scope

Cutting a release, merging #933 or any `chore(release):` PR, opening the challenge PR upstream, CI workflow edits, schema changes to the challenge's database, and `src/` changes beyond what P2 strictly needs.

## Definition of done

`npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/security-scope.mjs` green, read by exit code. `node tests/run.js <filter>` for every section touched (and `wasi` plus `performance` with the goldens regenerated if `src/` moved). Conformance 197/197. An undegraded `npm test` before the PR opens, skip count read. The PR body carries the figures table beside #1's derived ones (Postgres µs/request, app µs/request, KiB/idle connection, p95/p99 at the highest load held) and an honest projection of users on the 8-vCPU box with its assumptions.

## Requirements, verbatim

See the tracking issue body, which carries the owner's request unedited.
