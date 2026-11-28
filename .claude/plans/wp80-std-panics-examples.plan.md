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
        content: Clear the std sites outside the prover gaps (the shm ffi-nul site, prefork.ts:1170 slice, bytes.ts:592); what #2294 and #2350 did not clear, bytes.ts:592 included, moved to S7 and S8 on the owner's decision on #2209 — see WP80 S6
        status: completed
      - id: s6-twins
        content: Route constructor and contract panics through checked twins (http1-server.ts:498/:506, handler.ts:908, routerOutside, routerNoRoute) and clear respondEncoded, HttpHandler.put and HttpServer.carry; moved to S8 on the owner's decision on #2209 — see WP80 S6
        status: cancelled
      - id: s6-bench
        content: Lower each instruction count that fell to CI's printed figure, with the before and after table in the PR body — see WP80 S6
        status: completed
      - id: s6-optout
        content: After #2206, #2207 and #2208, drop the opt-out headers and smoke args of histogram-atomic, merge-patch, prefork-jobs, file-server, prefork-server and http-app, and the guide markers and sentences about them; histogram-atomic and prefork-jobs are freed, merge-patch moved to S7 and file-server, prefork-server and http-app to S8 on the owner's decision on #2209 — see WP80 S6
        status: completed
  - id: s7-bytes-windows
    title: WP80 S7 — window contracts for std/bytes, freeing merge-patch and the byte-order guide snippet
    goal: std/bytes checks each window through a window guard the prover reads as a contract, so a caller that tests its window discharges the check at its call, and examples/merge-patch.ts and the byte-order snippet in the standard-library guide build without --allow-panics, with no instruction count raised.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js json && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js --no-sidecars
    issue: 2356
    todos:
      - id: s7-fix
        content: Give std/bytes.ts's fixed-width getters and setters (getU16LE, getU32BE, setU32LE and their siblings) and bytesUtf8End's walk a window guard of the shape docs/LANGUAGE.md's window contract names, so the check moves to each caller and a caller's own test proves it (std/bytes.ts:92, :125, :273 and :592:27 are the sites the snippet and merge-patch reach today; others may appear after each fix) — see WP80 S7
        status: pending
      - id: s7-optout
        content: Drop the opt-out header and smoke args of examples/merge-patch.ts, and the allow-panics marker of the byte-order snippet in docs/guide/using-nish/standard-library.md with its sentence that a guard in your own loop does not yet remove the checks, rewritten to show the guard that does — see WP80 S7
        status: pending
      - id: s7-pins
        content: Regenerate the pinned std/bytes.ts line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP80 S7
        status: pending
      - id: s7-ratchet
        content: Lower tests/std-panics.json to the new exact bytes count and lower each instruction count that fell to CI's figure, with the before and after table in the PR body; std-json-typed may not rise — see WP80 S7
        status: pending
  - id: s8-http1-checked-config
    title: WP80 S8 — a checked HTTP/1 server config and constructor twins, freeing file-server, prefork-server and http-app
    goal: The HTTP/1 server takes its caps from a config snapshot it checks once and returns as a Result, the handler, router and prefork entry points a server example calls have checked twins that return Err where the constructor panics today, and file-server, prefork-server and http-app build without --allow-panics.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js net_static && node tests/run.js file-server && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js --no-sidecars
    issue: 2357
    todos:
      - id: s8-config
        content: Add a checked Http1Config snapshot, built by a Result-returning constructor that runs http1ServerConfigFault once and keeps a copy the caller cannot change, and an Http1Connection constructor twin that takes it, so the cap check at std/net/http1-server.ts:499:5 is not reached from a server that built its config the checked way — see WP80 S8
        status: pending
      - id: s8-twins
        content: Add checked twins for the other constructor and contract panics the three examples reach - the HttpHandler limits check (handlerCheckLimits, std/net/handler.ts:934:7; openHttpHandler is the Result form), the Router contracts routerOutside and routerNoRoute (std/net/router.ts:1289, :1290, :1304) and preforkSupervise's panic through preforkWorkers (std/net/prefork.ts:1392:5; tryPreforkWith is the Result form) - and clear respondEncoded, HttpHandler.put and HttpServer.carry, the explicit panics S4 lists as not kept — see WP80 S8
        status: pending
      - id: s8-windows
        content: Clear the window sites the examples reach outside http1-server - websocketIsUtf8's inline window check (std/net/websocket.ts:267:5) as a window guard, staticReadAll's slice (std/net/static.ts:221:20), and file-server's own write at examples/file-server.ts:126:23 of a length fileReadAt returned - each with a proof or a Result, never a made-up value — see WP80 S8
        status: pending
      - id: s8-optout
        content: Move examples/file-server.ts, examples/prefork-server.ts and examples/http-app onto the checked forms, drop their opt-out headers and smoke args and the ALLOW_PANICS their tests/run.js builds pass, and drop every guide marker and sentence the stale opt-out check reports freed (the prefork snippets in docs/guide/using-nish/networking.md and docs/guide/using-nish/api-server.md among them) — see WP80 S8
        status: pending
      - id: s8-pins
        content: Regenerate the pinned std/net line numbers, the checked goldens and docs/reference, update the guide pages of each new export, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP80 S8
        status: pending
      - id: s8-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP80 S8
        status: pending
---

# WP80 — std panic-free for threads, CLI, sync and the HTTP/1 server stack

## Context

std/ holds 2010 distinct unproven, non-OOM, non-call, non-unchecked panic sites in the modules this package owns (counts as of 071ed014; the std-panics ratchet of std-panic-free S1 holds them). This package removes or proves them, and unblocks the examples that opt out of panic checking today: api-cli, tasks, histogram, histogram-atomic, merge-patch, prefork-jobs, file-server, prefork-server and http-app. Counts per module: threads 41, json-typed 23, cli-args 170, cli-flags 36, cli 6, sync/ring 139, sync/shm 7, bytes 33, net/buffer-pool 10, net/prefork 58, net/http1-codec 298, net/http-fields 45, net/url 96, net/http-compress 20, net/http1-server 166, net/http-server 420, net/handler 171, net/serve 140, net/router 131. Its first todo adds instruction-count benches for the HTTP/1 parse and write path and the rest, baselined before any site changes; no PR may raise a count.

Examples unblocked: api-cli, tasks, histogram, histogram-atomic, merge-patch (S1); prefork-jobs (S2); file-server and prefork-server (S2 to S4); http-app (S5). The diagnostic names only the first site per call, so more can appear after a fix.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason. A wrap is spelled, never cast (owner's rule; `CLAUDE.md`, "A wrap is spelled, never cast"): no site is cleared by casting `i32` or `i64` arithmetic through `u32` or `u64` so that it wraps (`toI32(toU32(a) + toU32(b))`). Where the wrap would hide an overflow, prove the bound or return a Result. Where wrapping is the algorithm's answer (a hash multiply, a counter mod 2^32), write `wrappingAdd`, `wrappingSub` or `wrappingMul` from `nish:unsafe`, the one `nish:unsafe` use this rule allows, so every deliberate wrap is greppable. A value that is `u32` or `u64` all the way through wraps by its type and needs neither.
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

## WP80 S7 — window contracts for std/bytes, freeing merge-patch and the byte-order guide snippet

Split from S6 (#2209) on the owner's decision of 2026-11-27. #2321 made a window guard a contract: a call to a free `void` function whose body is exactly `const size: i32 = toI32(buf.length)` then `if (off < 0 || len < 0 || off > size || len > size - off) { panic(m) }` has its check recorded at the call, and a caller that tests the window proves it there (`docs/LANGUAGE.md`, the `window` contract; `tests/link/window_contract_*`). std/bytes does not use that shape yet, so its checks stay inside the module and every caller answers for them.

What still opts out on 09a6f22a8, and why:

- **`examples/merge-patch.ts`**: its only remaining site is the lead-byte read in `bytesUtf8End` (std/bytes.ts:592:27). A guard inside the walk cost +0.45% on std-json-typed, over its tolerance, so the fix puts the window check at the walk's entry, as a contract, and proves the walk from it, leaving the loop as it is.
- **The byte-order snippet** in `docs/guide/using-nish/standard-library.md` (its `allow-panics` marker cites `std/bytes.ts`): it calls `getU32BE`, `setU32LE` and `getU16LE` (std/bytes.ts:125, :273, :92). The prose after it says a guard in your own loop, such as `off + 3 < b.length`, does not yet remove these checks. That sentence changes to show the guard that now does.

The diagnostic names only the first site per call, so more std/bytes sites may appear after each fix. Rule 6 holds: no count in `bench/instructions.json` may rise, std-json-typed included.

## WP80 S8 — a checked HTTP/1 server config and constructor twins, freeing file-server, prefork-server and http-app

Split from S6 (#2209) on the owner's decision of 2026-11-27. It takes over S6's checked-twins todo, which never started, and the three server examples S6 could not free.

The blocker the three share is the cap check in the `Http1Connection` constructor (std/net/http1-server.ts:499:5, `http1ServerCheckCap`). `Http1Config` is a mutable class the connection stores as given, so no caller-side proof can show its caps are still good when the constructor runs. The fix is a config snapshot: a Result-returning constructor checks the caps once and keeps a copy nobody else can change, and a constructor twin takes only that snapshot. Letting a caller's proof discharge a constructor or contract panic in general is prover work, tracked separately in #2296; this stage does not wait for it.

Sites the examples reach on 09a6f22a8 (the first per call; more may appear after each fix):

| Example | Sites |
| --- | --- |
| `examples/file-server.ts` | http1-server.ts:499:5; `websocketIsUtf8`'s window check (std/net/websocket.ts:267:5), written inline rather than as a window guard; its own `write` at file-server.ts:126:23, of a length `fileReadAt` returned that nothing proves inside `served.window` |
| `examples/prefork-server.ts` | http1-server.ts:499:5; websocket.ts:267:5; `preforkSupervise`'s panic through `preforkWorkers` (std/net/prefork.ts:1392:5), where `tryPreforkWith` is the Result form `prefork-jobs` already uses |
| `examples/http-app/main.ts` | http1-server.ts:499:5; the `HttpHandler` limits check (`handlerCheckLimits`, std/net/handler.ts:934:7), where `openHttpHandler` is the Result form; the Router contracts `routerOutside` (router.ts:1289, :1290, from `Router.match`) and `routerNoRoute` (:1304, from `paramCount`); `staticReadAll`'s slice (std/net/static.ts:221:20) |

Each new export is public std API, so it lands with its doc comment, its `@param` and `@returns`, its reference page and a guide mention (`docs/guide/using-nish/networking.md`, `docs/guide/using-nish/api-server.md`). The `tests/run.js` builds of file-server and http-app pass `ALLOW_PANICS` today; they drop it with the headers. The prefork snippets in `networking.md` keep their markers unless the stale opt-out check reports them freed.

`examples/multi` builds strict: its `square` answers a `Result`, with the overflow in the `Err` arm. The owner's later decision for the examples-strict run (#2385, `.claude/plans/examples-strict.plan.md`) replaced the earlier one to keep `--allow-panics` there.
