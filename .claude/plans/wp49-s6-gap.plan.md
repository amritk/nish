---
name: WP49 stage 6, the gap — bring the async TFB entry inside the band on plaintext, json and db
overview: Close #1402. Profile the async entries against the explicit ones (main.ts, server.ts, db-*.ts, the frozen baseline) on plaintext, json and /db, publish what the profile shows, fix the serve/task path and the async Postgres pool from that evidence, then re-measure the whole gate with run.sh and mark stage 6 built only if every gated test is inside the band. Design source docs/wp49-async-server.md §6, §9 D1, §10.
stages:
  - id: profile
    title: "docs(runtime): profile the async TFB entry against the explicit one on plaintext, json and db (WP49 stage 6)"
    goal: BENCHMARKS.md shows, for plaintext, json and /db at one concurrency each, measured on one machine, the instructions per request and the top user-space frames of the async entry beside the explicit one, and WP49 §6 names the cause each test's gap points to.
    verification: npm run lint && node docs/check-links.mjs && bash -n bench/techempower/profile.sh && shellcheck -S warning bench/techempower/profile.sh && bash bench/techempower/profile.sh --help
    status: pending
    todos:
      - id: profile-tool
        content: Get a sampling profiler and an instruction counter that work in the container (perf from a linux-tools package or built from source; if hardware counters are unavailable in the VM, valgrind --tool=callgrind for instructions per request and frames, with perf's software clock or callgrind for the frame ranking) and say in the doc which one each figure comes from
        status: pending
      - id: profile-script
        content: Add bench/techempower/profile.sh, which builds the four entries as run.sh does, drives N requests at one concurrency with wrk (plaintext pipelined 16 deep), and reports instructions per request and the top-20 user-space frames for async against explicit, so a fix PR can re-run the same profile
        status: pending
      - id: profile-run
        content: Run it on plaintext (c=256), json (c=64) and /db (c=64, local Postgres as run.sh sets it up), async and explicit interleaved on the same machine, in the foreground
        status: pending
      - id: profile-publish
        content: Publish the per-request instruction counts, syscalls per request and the top user-space frames of each pair in a new docs/BENCHMARKS.md section with the commands, and replace §6's "not profiled" bullets in docs/wp49-async-server.md with what the profile attributes the gap to, per test, as ranked candidates for the fix stages
        status: pending
  - id: fix-serve
    title: "perf(runtime): close the async serve gap on plaintext and json (WP49 stage 6)"
    goal: The async entry's median on plaintext (c=256..4096) and json (c=16..512) is inside the entry vs entry-copy band, measured with run.sh on the same machine before and after, with every byte it answers unchanged.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js net_serve && node tests/run.js tfb_async_entry && node tests/run.js tfb_entry && node tests/run.js async && node tests/run.js emit-ts && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi (skip line read) && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && bash scripts/fetch-seed.sh --force && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && bash bench/techempower/run.sh (plaintext and json rows, before on main and after on the branch)
    status: pending
    todos:
      - id: serve-cause
        content: Take the profile stage's ranked causes for plaintext and json and confirm the top one with profile.sh on the branch before changing code (per-request task spawn and turn, the handler's request/response objects, the json body build, or what the profile names instead) — the executor's per-wait syscalls are ruled out (#1374) and are not reopened
        status: pending
      - id: serve-fix
        content: Remove the per-request cost the profile names, in std/net/serve.ts, std/net/handler.ts, runtime/runtime-async.c, src/emit-async.ts or the async entry itself, keeping a program with no async function byte for byte as before and the explicit entries untouched
        status: pending
      - id: serve-tests
        content: Pin the change with a test that fails without it (tests/link or tests/cases), keep tfb_async_entry's byte-for-byte plaintext and json answers, 16-deep pipelining included, and RSS flat over a long run
        status: pending
      - id: serve-measure
        content: Re-run profile.sh and run.sh on plaintext and json, before (main) and after (branch), and put the figures with the band in the PR body and a Measured trailer; record a remaining gap honestly rather than widening the band
        status: pending
      - id: serve-docs
        content: Update docs/security/serve.md (and async.md if runtime-async.c changes), the async-server guide page if anything a user sees changes, docs/IR_COOKBOOK.md if the lowering changes, regenerate tests/self/goldens/checked and docs/reference, and add DECLARED entries to tests/nish-cmp.js in the PR title's words if any corpus program's IR moves
        status: pending
  - id: fix-pool
    title: "perf(net): close the async Postgres pool gap on /db (WP49 stage 6)"
    goal: The async db entry's median on /db at c=64 and c=256 is inside the entry vs entry-copy band, measured with run.sh before and after, with query, update, cached-query and fortune no worse than on main.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js std_postgres && node tests/run.js tfb_async_db && node tests/run.js tfb_db && node tests/run.js net_serve_pg && node tests/postgres/live/run.mjs (local Postgres, PG_TEST_URL) && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && bash scripts/fetch-seed.sh --force && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && bash bench/techempower/run.sh (db, query, update, cached-query and fortune rows, before on main and after on the branch)
    status: pending
    todos:
      - id: pool-cause
        content: Take the profile stage's ranked causes for /db and confirm the top one on the branch before changing code (pool depth 8 per connection, a Sync per statement where the explicit pool batches, task turns per query, the slot-wake herd #1379 recorded on fortune, or what the profile names instead)
        status: pending
      - id: pool-fix
        content: Remove it in std/net/postgres-async.ts (and std/net/postgres-carrier.ts or the async db entry if the cause is there), keeping the pool's seat, cancellation and release rules and its panics
        status: pending
      - id: pool-tests
        content: Pin the change with a std_postgres_async test that fails without it, keep all five TFB db tests passing in tests/link/tfb_async_db and the postgres-live tfb-style check, and RSS flat over a long run
        status: pending
      - id: pool-measure
        content: Re-run profile.sh on /db and run.sh on db, query, update, cached-query and fortune, before (main) and after (branch), with the band, in the PR body and a Measured trailer; fortune and updates must not regress outside their band
        status: pending
      - id: pool-docs
        content: Update docs/security/postgres.md (the async pool's findings), docs/guide/using-nish/postgres.md if a user-visible pool option changes (async-server.md is fix-serve's; describe a change it needs in the PR and regate makes it), regenerate tests/self/goldens/checked and docs/reference, and add DECLARED entries to tests/nish-cmp.js in the PR title's words if any corpus program's IR moves
        status: pending
  - id: trim
    title: "perf(runtime): trim the async request path's instructions per request (WP49 stage 6)"
    goal: With fix-serve and fix-pool merged, profile.sh shows the async entry's instructions per request on plaintext, json and /db cut further toward the explicit entry's, with every byte answered unchanged and the explicit entry's figures unmoved.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js net_serve && node tests/run.js net_router && node tests/run.js tfb_async_entry && node tests/run.js tfb_entry && node tests/run.js std_postgres && node tests/run.js tfb_async_db && node tests/run.js async && node tests/postgres/live/run.mjs && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && bash scripts/fetch-seed.sh --force && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && bash bench/techempower/profile.sh (before on main, after on the branch)
    status: pending
    todos:
      - id: trim-profile
        content: Re-run profile.sh on main with both fixes merged and list what is left of the async entry's extra Ir per request on plaintext, json and /db, frame by frame
        status: pending
      - id: trim-cut
        content: Cut the largest remaining async-only costs in the async request path (serve, handler, router, the async pool, the task machinery), each change measured by its Ir delta; shared code both entries run (the HTTP codec, the JSON writer, the explicit carrier) is out of scope
        status: pending
      - id: trim-tests
        content: Keep tfb_async_entry's byte-for-byte answers, the five TFB db tests and RSS flat; pin any behaviour a change could alter with a test that fails without it
        status: pending
      - id: trim-measure
        content: Put before/after Ir per request and run.sh medians with the band in the PR body and a Measured trailer
        status: pending
  - id: regate
    title: "docs(runtime): re-measure WP49 stage 6's gate after the serve and pool fixes"
    goal: run.sh re-measures every gated test on main with both fixes and the trim pass merged, BENCHMARKS.md and WP49 §6 carry the figures, and §10 and the status line read stage 6 built if and only if async is inside the band on plaintext, json and db.
    verification: npm run lint && node docs/check-links.mjs && bash bench/techempower/run.sh (all rows, on main at the merge of fix-serve and fix-pool)
    status: pending
    todos:
      - id: regate-run
        content: Run bench/techempower/run.sh in the foreground on main with fix-serve and fix-pool merged, plaintext, json, db and the other db tests at the concurrencies #1399 used
        status: pending
      - id: regate-publish
        content: Add the re-measured section to docs/BENCHMARKS.md, update §6's gate table and its per-test causes, and the Measured trailer in the commit
        status: pending
      - id: regate-status
        content: If plaintext, json and db are all inside the band, mark §10 stage 6 built, update the status line and say D1's condition holds, and put "Fixes #1402" in the PR; if not, record what is still outside and do not mark it built
        status: pending
---

# WP49 stage 6, the gap

Issue #1402. The async TFB entries (`bench/techempower/async-*.ts`) are
written and correct, and `run.sh` measures them against the explicit ones
(`main.ts`, `server.ts`, `db-*.ts`, the frozen baseline) with a one-sided
band rule: async is inside when its median difference d ≥ −band, the band
being the explicit entry against a byte-identical copy of itself. On `main`
after #1378 and #1379 (figures from #1399):

| test | async vs explicit | band |
| --- | --- | --- |
| plaintext | −33.3 / −32.0 / −38.3 / −70.9%* at 256 / 1,024 / 4,096 / 16,384 | 2.6 / 1.4 / 0.1 / 8.3% |
| json | −2.5 … −17.1% at 16 … 512 | 0.5–2.5% |
| db | −74.2 / −79.4% at 64 / 256 | 3.1 / 5.7% |

**Ruled out:** the executor's per-wait syscalls (#1374, closed — json flat
after removing them). Nobody reopens it.

**Out of scope:** promises as values, `for await`, async on wasm, HTTP/2–3
under `serve`, moving tasks between threads, async in `src/` (the compiler
may *lower* async differently; it may not *use* it), a public TFB submission.

## Lessons carried from the wp49-s6 run (#1337)

- Run benchmarks **in the foreground**: an idle container is reclaimed with its
  background run.
- Measure memory as RSS, not `Arena.used()`.
- Regenerate `tests/self/goldens/checked/` after every `std/net` edit.
- `bash scripts/fetch-seed.sh --force` before nish-cmp; DECLARED words come
  from the branch's commit subjects (the PR title).
- No session URL in PR bodies.
- The container has no wrk and no Postgres server; install them with apt-get
  as `run.sh` and `tests/postgres/live/run.mjs` describe. It has no `perf`
  either (`linux-perf` is not in the apt sources and `linux-tools-*` would
  not install on 2026-11-11); valgrind is installed.

## profile

**Owns:** `bench/techempower/profile.sh` (new), `bench/techempower/README.md`,
`docs/BENCHMARKS.md`, `docs/wp49-async-server.md`

A profile, not a fix: no change to `std/`, `src/`, `runtime/` or the entries.
One concurrency per test (plaintext c=256 pipelined 16 deep, json c=64, /db
c=64), async and explicit on the same machine, interleaved. The output a fix
stage needs is a ranked list of causes per test, each tied to frames and an
instruction count, not a narrative. Instruction counts per request are the
primary figure because they hold across machines and noise; wall-clock
req/s comes from `run.sh`, not from this stage.

If no hardware counter works in the VM, callgrind's Ir per request is the
instruction count (drive a fixed N requests, subtract a startup-only run, divide
by N), and the doc says so.

## fix-serve

**Owns:** `std/net/serve.ts`, `std/net/handler.ts`, `std/net/http1-server.ts`,
`std/net/http1-codec.ts`, `runtime/runtime-async.c`, `runtime/async.mjs`,
`runtime/async.d.mts`, `src/emit-async.ts`, `src/async-check.ts`,
`bench/techempower/async-main.ts`, `bench/techempower/async-server.ts`,
`tests/link/net_serve*/**`, `tests/link/tfb_async_entry/**`,
`tests/link/async_*/**`, `tests/cases/*async*`, `tests/runtime-budgets.js`,
`docs/security/serve.md`, `docs/security/async.md`,
`docs/guide/using-nish/async-server.md`, `docs/IR_COOKBOOK.md`,
`tests/nish-cmp.js` (shared — see merge order)

Starts after `profile` merges: its first todo consumes the profile's ranking.
The explicit entries (`main.ts`, `server.ts`) and `std/net/handler.ts`'s
explicit loop are the baseline; a change to shared handler code must not move
the explicit entry's figures outside its own band. Byte-for-byte answers and
16-deep pipelining stay pinned by `tfb_async_entry`. A `src/` change runs the
`wasi` and `performance` sections and the `bootstrap` reproduction.

## fix-pool

**Owns:** `std/net/postgres-async.ts`, `std/net/postgres-carrier.ts`,
`bench/techempower/async-db-main.ts`, `bench/techempower/async-db-server.ts`,
`tests/link/std_postgres_async*/**`, `tests/link/tfb_async_db/**`,
`tests/postgres/**`, `docs/security/postgres.md`,
`docs/guide/using-nish/postgres.md`,
`tests/nish-cmp.js` (shared — see merge order)

Starts after `profile` merges. `std/net/postgres.ts` (the explicit pool) and
`db-main.ts`/`db-server.ts` are the baseline and are not edited. If the
cause sits in `serve` or the executor (fix-serve's files), the worker says so
in the PR and stops rather than editing them.

## trim

**Owns:** the union of fix-serve's and fix-pool's Owns (both have merged
before it starts), except `src/**` beyond `src/emit-async.ts`.

Added at the owner's request on 2026-11-11 after sign-off: a pass on
reducing instructions after the two fixes, on the async path only, before
regate so that regate measures the final state once. It starts after
fix-serve and fix-pool merge, from a fresh profile on `main`. Shared code
both entries run is out of scope, so the explicit baseline does not move.

## regate

**Owns:** `docs/BENCHMARKS.md`, `docs/wp49-async-server.md`,
`bench/techempower/README.md`, `docs/guide/using-nish/async-server.md` (only what fix-pool asked for), `bench/techempower/run.sh` (only a harness
bug, never the band rule)

Starts after trim merges. This stage changes no code: if the
gate still fails, it records the figures and leaves §10 at "measured, gate not
met", and the run's acceptance escalates.

## Merge order

`profile` → (`fix-serve` ∥ `fix-pool`, developed concurrently) → `trim` → `regate`.
`fix-serve` and `fix-pool` share only `tests/nish-cmp.js` (append-only
DECLARED entries) and the generated `tests/self/goldens/checked/**` and
`docs/reference/**`; `fix-serve` merges first and `fix-pool` updates from
`main` and regenerates before it merges.
