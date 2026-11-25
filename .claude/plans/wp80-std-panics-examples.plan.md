---
name: WP80 — std panic-free for threads, CLI, sync and the HTTP/1 server stack
overview: std/ holds 2010 distinct unproven, non-OOM, non-call, non-unchecked panic sites in the modules this package owns (counts as of 071ed014; the std-panics ratchet of std-panic-free S1 holds them). This package removes or proves them, and unblocks the examples that opt out of panic checking today - api-cli, tasks, histogram, histogram-atomic, merge-patch, prefork-jobs, file-server, prefork-server and http-app. Counts per module - threads 41, json-typed 23, cli-args 170, cli-flags 36, cli 6, sync/ring 139, sync/shm 7, bytes 33, net/buffer-pool 10, net/prefork 58, net/http1-codec 298, net/http-fields 45, net/url 96, net/http-compress 20, net/http1-server 166, net/http-server 420, net/handler 171, net/serve 140, net/router 131. Its first todo adds instruction-count benches for the HTTP/1 parse and write path and the rest, baselined before any site changes; no PR may raise a count.
priority: 170
labels: [ready]
issue: 2128
stages:
  - id: s1-leftovers
    title: WP80 S1 — what S1 leaves of threads, json-typed and cli-args, with cli-flags and cli
    goal: The sites S1 of std-panic-free leaves in std/threads.ts, std/json-typed.ts and std/cli-args.ts, and the sites in std/cli-flags.ts and std/cli.ts, are removed or proved, so api-cli, tasks, histogram, histogram-atomic and merge-patch build without --allow-panics. The bench programs this package needs land first and are baselined.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js threads && node tests/run.js json && node tests/run.js cli && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2129
    todos:
      - id: s1-bench
        content: Add instruction-count programs to bench/instructions.json (see bench/README.md, Instruction counts, and bench/run.mjs) that call the functions this package changes - HTTP/1 request parse and response write (http1-codec, http1-server), a router dispatch, ring push and pop (sync/ring), ThreadScope.spawn, jsonDecode through json-typed, cli-args parsing; baseline them on CI's runner before any site is changed, and take every count from CI's table, never a local run — see WP80 S1
        status: pending
      - id: s1-fix
        content: Remove or prove every site in std/threads.ts, std/json-typed.ts, std/cli-args.ts, std/cli-flags.ts, std/cli.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (threads.ts:278, 849, 827, 817; json-typed.ts:806; cli-args.ts:349, 184, 463, 357 are the first sites the examples hit; others may appear after each fix) — see WP80 S1
        status: pending
      - id: s1-optout
        content: Drop the opt-out headers and the // smoke - args --allow-panics lines of examples/api-cli, tasks, histogram, histogram-atomic and merge-patch, and any guide marker and sentence about them — see WP80 S1
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP80 S1
        status: pending
      - id: s1-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP80 S1
        status: pending
  - id: s2-sync
    title: WP80 S2 — sync/ring, sync/shm, bytes, buffer-pool and prefork
    goal: The sites in the ring buffer, shared memory, byte helpers, buffer pool and prefork supervisor are removed or proved, so prefork-jobs builds without --allow-panics and the prefork half of prefork-server is clear.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js sync && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2130
    todos:
      - id: s2-fix
        content: Remove or prove every site in std/sync/ring.ts, std/sync/shm.ts, std/bytes.ts, std/net/buffer-pool.ts, std/net/prefork.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (sync/ring.ts 141, 188, 731, 462, 290, 168; bytes.ts:273, 113; prefork.ts:296, 1138 are the first sites the examples hit) — see WP80 S2
        status: pending
      - id: s2-optout
        content: Drop the opt-out header and smoke args of examples/prefork-jobs, and the guide marker and sentence about it — see WP80 S2
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
        content: Remove or prove every site in std/net/http1-codec.ts, std/net/http-fields.ts, std/net/url.ts, std/net/http-compress.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (http1-codec.ts:972 is the first site file-server hits) — see WP80 S3
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
        content: Remove or prove every site in std/net/http1-server.ts, std/net/http-server.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (http1-server.ts 712, 539, 2856, 2741, 2688, 2643, 417, 2620, 2674 are the first sites the examples hit) — see WP80 S4
        status: pending
      - id: s4-optout
        content: Drop the opt-out header and smoke args of examples/file-server and examples/prefork-server, and the guide marker and sentence about them — see WP80 S4
        status: pending
      - id: s4-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP80 S4
        status: pending
      - id: s4-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP80 S4
        status: pending
  - id: s5-app
    title: WP80 S5 — the handler, serve and router layer
    goal: handler, serve and router are cleared, so http-app builds without --allow-panics.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2133
    todos:
      - id: s5-fix
        content: Remove or prove every site in std/net/handler.ts, std/net/serve.ts, std/net/router.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (handler.ts 1503, 1429, 678, 406, 667, 612 are the first sites http-app hits) — see WP80 S5
        status: pending
      - id: s5-optout
        content: Drop the opt-out header and smoke args of examples/http-app, and the guide marker and sentence about it — see WP80 S5
        status: pending
      - id: s5-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP80 S5
        status: pending
      - id: s5-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP80 S5
        status: pending
  - id: s6-fixup
    title: WP80 S6 — fix-up, remaining std sites, fallen bench counts, the six example opt-outs
    goal: the WP80 modules carry only kept explicit panics, the instruction counts that fell are lowered to CI's figures, and the six examples build without --allow-panics.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js --no-sidecars
    issue: 2209
    todos:
      - id: s6-router
        content: Land the router rework so std/net/router.ts keeps only its kept explicit panics (std-router +4.3% accepted on #2204) — see WP80 S6
        status: completed
      - id: s6-sites
        content: Clear the std sites outside the prover gaps (the shm ffi-nul site, prefork.ts:1170 slice, bytes.ts:592) — see WP80 S6
        status: in_progress
      - id: s6-twins
        content: Route constructor and contract panics through checked twins (http1-server.ts:498/:506, handler.ts:908, routerOutside, routerNoRoute) and clear respondEncoded, HttpHandler.put and HttpServer.carry — see WP80 S6
        status: pending
      - id: s6-bench
        content: Lower each instruction count that fell to CI's printed figure, with the before and after table in the PR body — see WP80 S6
        status: pending
      - id: s6-optout
        content: After #2206, #2207 and #2208, drop the opt-out headers and smoke args of histogram-atomic, merge-patch, prefork-jobs, file-server, prefork-server and http-app, and the guide markers and sentences about them — see WP80 S6
        status: pending
---

# WP80 — std panic-free for threads, CLI, sync and the HTTP/1 server stack

## Context

std/ holds 2010 distinct unproven, non-OOM, non-call, non-unchecked panic sites in the modules this package owns (counts as of 071ed014; the std-panics ratchet of std-panic-free S1 holds them). This package removes or proves them, and unblocks the examples that opt out of panic checking today: api-cli, tasks, histogram, histogram-atomic, merge-patch, prefork-jobs, file-server, prefork-server and http-app. Counts per module: threads 41, json-typed 23, cli-args 170, cli-flags 36, cli 6, sync/ring 139, sync/shm 7, bytes 33, net/buffer-pool 10, net/prefork 58, net/http1-codec 298, net/http-fields 45, net/url 96, net/http-compress 20, net/http1-server 166, net/http-server 420, net/handler 171, net/serve 140, net/router 131. Its first todo adds instruction-count benches for the HTTP/1 parse and write path and the rest, baselined before any site changes; no PR may raise a count.

Examples unblocked: api-cli, tasks, histogram, histogram-atomic, merge-patch (S1); prefork-jobs (S2); file-server and prefork-server (S2 to S4); http-app (S5). The diagnostic names only the first site per call, so more can appear after a fix.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

## Stages

### S1 — what S1 leaves of threads, json-typed and cli-args, with cli-flags and cli

The sites S1 of std-panic-free leaves in std/threads.ts, std/json-typed.ts and std/cli-args.ts, and the sites in std/cli-flags.ts and std/cli.ts, are removed or proved, so api-cli, tasks, histogram, histogram-atomic and merge-patch build without --allow-panics. The bench programs this package needs land first and are baselined.

Sites as of 071ed014 (276): threads 41, json-typed 23, cli-args 170, cli-flags 36, cli 6. Kinds: index 167, overflow 53, panic 48, array-length 4, slice 4.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `editDistance (cli-args)`.

### S2 — sync/ring, sync/shm, bytes, buffer-pool and prefork

The sites in the ring buffer, shared memory, byte helpers, buffer pool and prefork supervisor are removed or proved, so prefork-jobs builds without --allow-panics and the prefork half of prefork-server is clear.

Sites as of 071ed014 (247): sync/ring 139, sync/shm 7, bytes 33, net/buffer-pool 10, net/prefork 58. Kinds: overflow 152, index 59, panic 27, ffi-nul 3, slice 3, array-length 2, ffi-null 1.

### S3 — the HTTP/1 wire layer, http1-codec, http-fields, url and http-compress

The HTTP/1 parser, header fields, URL and response compression sites are removed or proved; parse errors become a Result value the server already maps to a 400, never a made-up default.

Sites as of 071ed014 (459): net/http1-codec 298, net/http-fields 45, net/url 96, net/http-compress 20. Kinds: overflow 319, index 107, panic 12, array-length 11, slice 10.

### S4 — the HTTP/1 server, http1-server and http-server

The two largest server modules are cleared, so file-server and prefork-server build without --allow-panics once S2 and S3 are in.

Sites as of 071ed014 (586): net/http1-server 166, net/http-server 420. Kinds: overflow 261, index 236, panic 47, array-length 27, slice 5, divide 5, pop 3, io-exit 2.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `HttpServer.carry`, `HttpServer.h1Of`, `HttpServer.h2cOf`, `HttpServer.h2Of`, `HttpServer.h3Of`, `Http1Connection.respondEncoded`, `HttpHandler.put`.

### S5 — the handler, serve and router layer

handler, serve and router are cleared, so http-app builds without --allow-panics.

Sites as of 071ed014 (442): net/handler 171, net/serve 140, net/router 131. Kinds: index 209, overflow 154, array-length 40, panic 25, slice 9, divide 4, pop 1.

### S6 — fix-up: remaining std sites, fallen bench counts, the six example opt-outs

Added on the owner's decision on #2204: the `src/` prover gaps the earlier stages hit are their own work (#2206 atomic element index, #2207 type-only `new Array<T>(n)` length, #2208 `String.fromBytes`/`netRead` slices), and this stage follows them. It clears what S1–S5 left outside those gaps, lowers the instruction counts that fell during the package to CI's figures, and drops the six opt-outs (histogram-atomic, merge-patch, prefork-jobs, file-server, prefork-server, http-app) once the prover proves their sites.

One exception to rule 6, accepted on #2204: the router rework (plain guards and clamps in place of wrap helpers, so router.ts keeps only its six kept explicit panics) raises std-router by about 4.3% of instructions. Its count is written from the run that measured it and replaced with CI's printed figure once the bench shard prints it.
