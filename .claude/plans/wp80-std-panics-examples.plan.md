---
name: WP80 — std panic-free for threads, CLI, sync and the HTTP/1 server stack
overview: std/ holds 2010 distinct unproven, non-OOM, non-call, non-unchecked panic sites in the modules this package owns (counts as of 071ed014; the std-panics ratchet of std-panic-free S1 holds them). This package removes or proves them, and unblocks the examples that opt out of panic checking today - api-cli, tasks, histogram, histogram-atomic, merge-patch, prefork-jobs, file-server, prefork-server and http-app. Counts per module - threads 41, json-typed 23, cli-args 170, cli-flags 36, cli 6, sync/ring 139, sync/shm 7, bytes 33, net/buffer-pool 10, net/prefork 58, net/http1-codec 298, net/http-fields 45, net/url 96, net/http-compress 20, net/http1-server 166, net/http-server 420, net/handler 171, net/serve 140, net/router 131. Its first todo adds instruction-count benches for the HTTP/1 parse and write path and the rest, baselined before any site changes; no PR may raise a count.
priority: 170
labels: [ready]
issue: 2128
stages:
  - id: s1-leftovers
    title: WP80 S1 — what S1 leaves of threads, json-typed and cli-args, with cli-flags and cli
    goal: The sites S1 of std-panic-free leaves in std/threads.ts, std/json-typed.ts and std/cli-args.ts, and the sites in std/cli-flags.ts and std/cli.ts, are removed or proved, with the std/json.ts sites api-cli and merge-patch reach, so api-cli and histogram-atomic build without --allow-panics (tasks and histogram already do; merge-patch's last WP80 site is in std/bytes.ts, so S2 drops its opt-out). The bench programs this package needs land first and are baselined.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js threads && node tests/run.js json && node tests/run.js cli && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2129
    todos:
      - id: s1-bench
        content: Add instruction-count programs to bench/instructions.json (see bench/README.md, Instruction counts, and bench/run.mjs) that call the functions this package changes - HTTP/1 request parse and response write (http1-codec, http1-server), a router dispatch, ring push and pop (sync/ring), ThreadScope.spawn, jsonDecode through json-typed, cli-args parsing; baseline them on CI's runner before any site is changed, and take every count from CI's table, never a local run — see WP80 S1
        status: pending
      - id: s1-fix
        content: Remove or prove every site in std/threads.ts, std/json-typed.ts, std/cli-args.ts, std/cli-flags.ts, std/cli.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (as of 81d20e58 - cli-args.ts:184, 349, 357, 463 for api-cli; threads.ts:817, 849 for histogram-atomic; json.ts:957 for merge-patch; others may appear after each fix) — see WP80 S1
        status: pending
      - id: s1-optout
        content: Drop the opt-out headers and the // smoke - args --allow-panics lines of examples/api-cli and examples/histogram-atomic (tasks and histogram carry none; merge-patch is S2's), and every guide allow-panics marker and sentence this stage makes stale — see WP80 S1
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP80 S1
        status: pending
      - id: s1-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP80 S1
        status: pending
  - id: s2-sync
    title: WP80 S2 — sync/ring, sync/shm, bytes, buffer-pool and prefork
    goal: The sites in the ring buffer, shared memory, byte helpers, buffer pool and prefork supervisor are removed or proved, so prefork-jobs and merge-patch build without --allow-panics and the prefork half of prefork-server is clear.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js sync && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2130
    todos:
      - id: s2-fix
        content: Remove or prove every site in std/sync/ring.ts, std/sync/shm.ts, std/bytes.ts, std/net/buffer-pool.ts, std/net/prefork.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (as of 81d20e58 - sync/ring.ts:141, 155, 168, 188, 290, 462, 731 and bytes.ts:113, 273, 304 for prefork-jobs; bytes.ts:592 for merge-patch; prefork.ts sites for prefork-server) — see WP80 S2
        status: pending
      - id: s2-optout
        content: Drop the opt-out headers and smoke args of examples/prefork-jobs and examples/merge-patch, and every guide allow-panics marker and sentence this stage makes stale — see WP80 S2
        status: pending
      - id: s2-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP80 S2
        status: pending
      - id: s2-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP80 S2
        status: pending
  - id: s3-http1-wire
    title: WP80 S3 — the HTTP/1 wire layer, http1-codec, http-fields, url and http-compress
    goal: The HTTP/1 parser, header fields, URL and response compression sites are removed or proved; parse errors become a Result value the server already maps to a 400, never a made-up default.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2131
    todos:
      - id: s3-fix
        content: Remove or prove every site in std/net/http1-codec.ts, std/net/http-fields.ts, std/net/url.ts, std/net/http-compress.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (as of 81d20e58 - http1-codec.ts:972 is the first site file-server and prefork-server hit) — see WP80 S3
        status: pending
      - id: s3-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP80 S3
        status: pending
      - id: s3-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP80 S3
        status: pending
  - id: s4-http1-server
    title: WP80 S4 — the HTTP/1 server, http1-server and http-server
    goal: The two largest server modules are cleared, so file-server and prefork-server build without --allow-panics once S2 and S3 are in.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2132
    todos:
      - id: s4-fix
        content: Remove or prove every site in std/net/http1-server.ts, std/net/http-server.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (as of 81d20e58 - http1-server.ts:417, 539, 2586, 2620, 2688 are the first sites file-server and prefork-server hit; HttpHandler.put is S5's, by the owner's decision on #2133) — see WP80 S4
        status: pending
      - id: s4-optout
        content: Drop the opt-out headers and smoke args of examples/file-server and examples/prefork-server, and every guide allow-panics marker and sentence this stage makes stale — see WP80 S4
        status: pending
      - id: s4-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP80 S4
        status: pending
      - id: s4-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP80 S4
        status: pending
  - id: s5-app
    title: WP80 S5 — the handler, serve and router layer
    goal: handler, serve and router are cleared, with the std/net/static.ts sites http-app reaches and the String.fromBytes slice in examples/http-app/app.ts, so http-app builds without --allow-panics.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2133
    todos:
      - id: s5-fix
        content: Remove or prove every site in std/net/handler.ts, std/net/serve.ts, std/net/router.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (as of 81d20e58 - handler.ts:480, 693, 755, 766, 1664, 1738, http1-server.ts:2620 and 2688 through handler, static.ts:458 and app.ts's String.fromBytes slice are what http-app hits; HttpHandler.put and its taken < 0 panic are this stage's, by the owner's decision on #2133 - prove it away or return the failure) — see WP80 S5
        status: pending
      - id: s5-optout
        content: Drop the opt-out header and smoke args of examples/http-app, the --allow-panics in docs/guide/using-nish/api-server.md's build sentence, and every guide allow-panics marker and sentence this stage makes stale — see WP80 S5
        status: pending
      - id: s5-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP80 S5
        status: pending
      - id: s5-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP80 S5
        status: pending
---

# WP80 — std panic-free for threads, CLI, sync and the HTTP/1 server stack

## Context

std/ holds 2010 distinct unproven, non-OOM, non-call, non-unchecked panic sites in the modules this package owns (counts as of 071ed014; the std-panics ratchet of std-panic-free S1 holds them). This package removes or proves them, and unblocks the examples that opt out of panic checking today: api-cli, tasks, histogram, histogram-atomic, merge-patch, prefork-jobs, file-server, prefork-server and http-app. Counts per module: threads 41, json-typed 23, cli-args 170, cli-flags 36, cli 6, sync/ring 139, sync/shm 7, bytes 33, net/buffer-pool 10, net/prefork 58, net/http1-codec 298, net/http-fields 45, net/url 96, net/http-compress 20, net/http1-server 166, net/http-server 420, net/handler 171, net/serve 140, net/router 131. Its first todo adds instruction-count benches for the HTTP/1 parse and write path and the rest, baselined before any site changes; no PR may raise a count.

Examples unblocked: api-cli and histogram-atomic (S1; tasks and histogram already compile clean at 81d20e58); prefork-jobs and merge-patch (S2, after S1 fixes merge-patch's std/json.ts:957); file-server and prefork-server (S2 to S4); http-app (S5). The diagnostic names only the first site per call, so more can appear after a fix.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

7. Owns. A stage edits only the files its `Owns:` line names, plus these shared files, where it adds or changes only its own entries: `bench/instructions.json`, `tests/nish-cmp.js` (`DECLARED`), `tests/run.js`, and the `docs/guide/**/*.md` `<!-- allow-panics: ... -->` markers (and their sentences) whose snippet the branch makes compile without the flag. A marker still needed stays. Generated files are regenerated with their tool, never hand-edited or hand-merged: `tests/self/goldens/checked/**`, `docs/reference/**`, `scalar.config.json`, `docs/IR_COOKBOOK.md`, `tests/std-panics.json`, `tests/link/*/expected.caps.json`, `tests/wordings/*.err` and the differential register. A new `tests/link` case goes in a new directory the stage creates.
8. No public signature change whose callers lie outside the stage's `Owns`. Prove the site instead, or stop and say so in a draft PR.
9. An example blocked only by a module outside this package, or by a `src/` prover gap, may keep its opt-out with the header rewritten to name exactly those blockers. The PR names the owning WP.
10. Merge order is S1, S2, S3, S4, S5. Stages develop at the same time, but each updates from `main` after the one before it merges, then re-takes its counts (std-panics, bench) from the merged state before it merges.

## Stages

### S1 — what S1 leaves of threads, json-typed and cli-args, with cli-flags and cli

The sites S1 of std-panic-free leaves in std/threads.ts, std/json-typed.ts and std/cli-args.ts, and the sites in std/cli-flags.ts and std/cli.ts, are removed or proved, so api-cli, tasks, histogram, histogram-atomic and merge-patch build without --allow-panics. The bench programs this package needs land first and are baselined.

Sites as of 071ed014 (276): threads 41, json-typed 23, cli-args 170, cli-flags 36, cli 6. Kinds: index 167, overflow 53, panic 48, array-length 4, slice 4.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `editDistance (cli-args)`.

**Owns:** `std/threads.ts`, `std/json-typed.ts`, `std/json.ts`, `std/cli-args.ts`, `std/cli-flags.ts`, `std/cli.ts`, `examples/api-cli/**`, `examples/tasks.ts`, `examples/histogram.ts`, `examples/histogram-atomic.ts`, `bench/std-*.ts`, `bench/std-*.args`, `bench/run.mjs`, `bench/README.md`. std/json.ts joins S1 for the merge-patch site at json.ts:957 (jsonHexByte); no other WP80 stage reaches it.

### S2 — sync/ring, sync/shm, bytes, buffer-pool and prefork

The sites in the ring buffer, shared memory, byte helpers, buffer pool and prefork supervisor are removed or proved, so prefork-jobs builds without --allow-panics and the prefork half of prefork-server is clear.

Sites as of 071ed014 (247): sync/ring 139, sync/shm 7, bytes 33, net/buffer-pool 10, net/prefork 58. Kinds: overflow 152, index 59, panic 27, ffi-nul 3, slice 3, array-length 2, ffi-null 1.

**Owns:** `std/sync/ring.ts`, `std/sync/shm.ts`, `std/bytes.ts`, `std/net/buffer-pool.ts`, `std/net/prefork.ts`, `examples/prefork-jobs.ts`, `examples/merge-patch.ts`. merge-patch moves here from S1: its last WP80 site, bytes.ts:592, is this stage's.

### S3 — the HTTP/1 wire layer, http1-codec, http-fields, url and http-compress

The HTTP/1 parser, header fields, URL and response compression sites are removed or proved; parse errors become a Result value the server already maps to a 400, never a made-up default.

Sites as of 071ed014 (459): net/http1-codec 298, net/http-fields 45, net/url 96, net/http-compress 20. Kinds: overflow 319, index 107, panic 12, array-length 11, slice 10.

**Owns:** `std/net/http1-codec.ts`, `std/net/http-fields.ts`, `std/net/url.ts`, `std/net/http-compress.ts`.

### S4 — the HTTP/1 server, http1-server and http-server

The two largest server modules are cleared, so file-server and prefork-server build without --allow-panics once S2 and S3 are in.

Sites as of 071ed014 (586): net/http1-server 166, net/http-server 420. Kinds: overflow 261, index 236, panic 47, array-length 27, slice 5, divide 5, pop 3, io-exit 2.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `HttpServer.carry`, `HttpServer.h1Of`, `HttpServer.h2cOf`, `HttpServer.h2Of`, `HttpServer.h3Of`, `Http1Connection.respondEncoded`. (`HttpHandler.put` is S5's, by the owner's decision on #2133.)

**Owns:** `std/net/http1-server.ts`, `std/net/http-server.ts`, `examples/file-server.ts`, `examples/prefork-server.ts`.

### S5 — the handler, serve and router layer

handler, serve and router are cleared, so http-app builds without --allow-panics.

Sites as of 071ed014 (442): net/handler 171, net/serve 140, net/router 131. Kinds: index 209, overflow 154, array-length 40, panic 25, slice 9, divide 4, pop 1.

Explicit panics to fix, not kept: `HttpHandler.put` (moved from S4 by the owner's decision on #2133; prove the `taken < 0` site away or return the failure).

**Owns:** `std/net/handler.ts`, `std/net/serve.ts`, `std/net/router.ts`, `std/net/static.ts` (only the sites http-app reaches; the rest is WP82's), `examples/http-app/**`.

## Acceptance criteria

1. Each of api-cli, tasks, histogram, histogram-atomic, merge-patch, prefork-jobs, file-server, prefork-server and http-app compiles with `build/nish` without `--allow-panics`, or its opt-out header names only blockers outside this package's modules (with the owning WP).
2. `node tests/run.js std-panics` passes on `main`, and `tests/std-panics.json` holds no site for threads, json-typed, cli-args, cli-flags, cli, sync/ring, sync/shm, bytes, net/buffer-pool, net/prefork, net/http1-codec, net/http-fields, net/url, net/http-compress, net/http1-server, net/http-server, net/handler, net/serve or net/router except kept explicit panics.
3. `editDistance`, `HttpServer.carry`, `h1Of`, `h2cOf`, `h2Of`, `h3Of`, `Http1Connection.respondEncoded` and `HttpHandler.put` no longer appear in `--emit-panics` output.
4. `bench/instructions.json` has programs for HTTP/1 parse and write, router dispatch, ring push and pop, ThreadScope.spawn, jsonDecode through json-typed and cli-args; no count is higher than at 81d20e58, and the instructions check passes on CI.
5. A malformed HTTP/1 request sent to a running file-server gets a 400 response and the server keeps serving; it does not crash.
6. `bash scripts/smoke.sh` passes on `main` with those examples built without `--allow-panics`.
7. `main`'s CI is green after the last merge.
