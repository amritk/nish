---
name: WP49 stage 6, the hand-off — spike two designs for the serve → handler → task hand-off, build the faster one, regate
overview: Close #1468 and #1402. Remove the per-request cost of the serve → HttpHandler → spawned task hand-off in the async server. Spike design A (no spawned task per request; library and runtime only) and design B (a task may borrow its spawner's buffer; a language rule) in parallel, each measured against main in its own container with the same metrics, pick the one with the larger gain on the judged cells, build it properly in one PR, then re-run the unchanged run.sh gate on main. Design source docs/wp49-async-server.md §3, §6, §10; the last gate is docs/BENCHMARKS.md "TechEmpower: the gate after task recycling" (#1514).
stages:
  - id: spike-a
    title: "spike: serve without a spawned task per request (WP49 stage 6, design A — not for merge)"
    goal: A draft PR, never merged, whose body gives design A's measured deltas against main (Ir per request with frames, memcpy and RSS, run.sh req/s, examples/http-app Ir), all taken in one container in one session with main and the spike interleaved, plus what A breaks or risks and what its full build would cost.
    verification: npm run check && npm run lint && node tests/run.js net_serve && node tests/run.js tfb_async_entry && node tests/run.js tfb_async_db && bash bench/techempower/profile.sh --only plaintext && bash bench/techempower/profile.sh --only json (main and the spike head, interleaved, same container)
    status: pending
    todos:
      - id: a-setup
        content: "bash scripts/fetch-seed.sh --force; apt-install wrk, strace, linux-tools (perf) and Postgres binaries; build main's head in a second worktree so main and the spike can be measured alternately in this container"
        status: pending
      - id: a-prototype
        content: "Prototype just enough to measure: serve runs the handler directly on the connection's own task (or one per-connection task) and spawns only when the handler actually awaits — or an equivalent that removes the per-request spawn, region and copy. serve may drive Http1Server directly as the explicit server does, if HttpHandler's public behaviour for its other users stays the same. Library and runtime only: std/net/serve.ts, std/net/handler.ts, runtime/runtime-async.c spawn/done paths, src/emit-async.ts only if the lowering needs it"
        status: pending
      - id: a-reclaim
        content: "Per-request reclaim for a per-connection task, and the per-request deadline armed and disarmed around each handler call; check the checker accepts an await inside the reclaim bracket. Say where an awaited callee's frame lives once an inline start suspends (WP49 §3), and whether that needs emit-async changes beyond spawn/done. Say whether the request copy (~330 Ir) stays because in-place is unsound under today's rules (NL2609/2615)"
        status: pending
      - id: a-measure
        content: "Measure main and the spike interleaved: profile.sh defaults on plaintext c=256 and json c=64 (Ir per request, top frames by self Ir for both, the remaining gap attributed to router / executor / codec); memcpy Ir and calls from callgrind and VmHWM on tests/link/net_serve, net_serve_burst, net_serve_pipelined_flat; VmHWM flat over thousands of keep-alive requests; run.sh --only plaintext (256/1024/4096) and --only json (16..512) in the foreground; examples/http-app with default ServeLimits on /health and /notes/17 under callgrind; peak RSS at plaintext c=16384; the deadline's arm/disarm cost with the default ServeLimits"
        status: pending
      - id: a-report
        content: "Open the draft PR (body to the lead if the session has no GitHub tools) with the delta tables, the frame tables, which invariants the prototype keeps or breaks (serve probes, 503 past inFlight, deadline, hang-up, maxRequests, ServeStats fields, shutdown), the security records it touches (docs/security/serve.md SERVE-4/6/7, docs/security/async.md ASYNC-*, ASYNC-20's stale bytes in a reused region), and the full build's cost (files, runtime text budget against RUNTIME_ASYNC_TEXT_BUDGET 4,096, Darwin kqueue path)"
        status: pending
  - id: spike-b
    title: "spike: a task may borrow its spawner's buffer (WP49 stage 6, design B — not for merge)"
    goal: A draft PR, never merged, whose body gives B's ceiling — Ir per request with the request copy removed unsoundly, against main in one container, interleaved — and, only if that ceiling could beat A, the rule's design, whether readonly T[] already expresses it, its security story and its build cost.
    verification: npm run check && npm run lint && node tests/run.js net_serve && node tests/run.js tfb_async_entry && bash bench/techempower/profile.sh --only plaintext && bash bench/techempower/profile.sh --only json (main and the spike head, interleaved, same container)
    status: pending
    todos:
      - id: b-setup
        content: "bash scripts/fetch-seed.sh --force; apt-install wrk, strace, linux-tools (perf) and Postgres binaries; build main's head in a second worktree so main and the spike can be measured alternately in this container"
        status: pending
      - id: b-ceiling
        content: "Remove serveTask's request copy unsoundly, with no checker work (hand the slot's head and body to the handler in place), and measure the ceiling with the same metric set as spike-a: profile.sh on plaintext c=256 and json c=64 with top frames, memcpy Ir and calls and VmHWM on net_serve / burst / pipelined_flat, run.sh plaintext 256/1024/4096 and json 16..512, examples/http-app /health and /notes/17. Send the lead the ceiling figure as soon as it exists (one line), so the decide step can compare it with A's gain"
        status: pending
      - id: b-design
        content: "Unless the lead says the ceiling is below A's gain: check whether `readonly T[]` (LANGUAGE.md \"Readonly arrays\") plus a checker change already expresses a borrowed, non-growable view for a task's lifetime, so B is a rule change rather than a construct; sketch copy-on-escape when the handler keeps the view; say whether Request.raw would become a view (a breaking change the owner must approve first); say whether std/ may use it the release it lands in (nish-cmp compares against the last release)"
        status: pending
      - id: b-report
        content: "Open the draft PR (body to the lead if the session has no GitHub tools) with the ceiling tables and frames, what B breaks or risks (a slot freed or reused while a task still holds its view, a cancelled or hung-up task, SERVE-4/6/7, ASYNC-*, ASYNC-20), and the full build's cost (the docs/ARCHITECTURE.md \"How to add a construct\" checklist or the smaller rule-change list, files, rolling freeze)"
        status: pending
  - id: remeasure
    title: "measure: main, spike-a and spike-b on one machine (only if the spikes are within twice the band)"
    goal: "Spawned only when the two spikes' deltas on the judged cells are within twice the band of each other: one container measures main, spike-a's head and spike-b's head interleaved with the same metric set, and sends the lead one comparison table. No PR."
    verification: bash bench/techempower/profile.sh --only plaintext && bash bench/techempower/profile.sh --only json && bash bench/techempower/run.sh --only plaintext && bash bench/techempower/run.sh --only json (main, spike-a, spike-b interleaved)
    status: pending
    todos:
      - id: r-measure
        content: "Build main, feature/wp49-s6-handoff/spike-a and feature/wp49-s6-handoff/spike-b in three worktrees; run profile.sh (plaintext c=256, json c=64) and run.sh --only plaintext / --only json, rotating the three, in the foreground; examples/http-app /health and /notes/17 under callgrind"
        status: pending
      - id: r-report
        content: "Send the lead one table: per judged cell, main, A and B medians and the band; Ir per request and the top frames for each; nothing pushed"
        status: pending
  - id: build
    title: "perf(runtime): <the chosen design> — fill in at the decide step (WP49 stage 6)"
    goal: The chosen design is built properly in one PR — tests that fail without it, every serve invariant held, security records, docs, regenerated goldens and nish-cmp DECLARED entries — and its body gives before/after Ir, RSS and req/s on the TFB entry and on examples/http-app.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js net_serve && node tests/run.js net_router && node tests/run.js tfb_async_entry && node tests/run.js tfb_async_db && node tests/run.js tfb_entry && node tests/run.js async && node tests/run.js budget && node tests/run.js c-symbols && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi (skip line read) && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && node docs/check-links.mjs && bash scripts/fetch-seed.sh --force && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && bash bench/techempower/profile.sh && bash bench/techempower/run.sh --only plaintext && bash bench/techempower/run.sh --only json && bash bench/techempower/run.sh --only db (main and the branch, interleaved)
    status: pending
    todos:
      - id: build-impl
        content: "Implement the design the lead chose at the decide step (its PR comment on #1468 is the spec), in the files that design names — never a benchmark-only path, nothing in bench/techempower/ or run.sh, no kept epoll registrations and no change to the per-wait dup/ADD/DEL/close"
        status: pending
      - id: build-invariants
        content: "Hold and pin with tests that fail without the change: every answered byte identical; pipelining, deadlines, hang-up, cancellation and shutdown as today; a wrong Response is a 500 that never stops the server; 503 past inFlight's cap; the default ServeLimits.deadline (30 s) cancels a single request's work; a hang-up cancels only its connection's in-flight work; maxRequests drains as today; ServeStats fields keep their documented meanings. The tests/link/net_serve_* probes and tfb_async_entry / tfb_async_db pass unchanged — a probe asserting an internal count changes only with a reason in the PR body. Request, Response, ServeLimits, ServeStats, serve, serveOn and refuse stay source-compatible; Request.raw stays a public HttpRequest unless the owner approved otherwise"
        status: pending
      - id: build-memory
        content: "For a per-connection task: VmHWM flat over thousands of keep-alive requests (a test), and peak RSS at plaintext c=16384 reported. A runtime-async.c change stays inside RUNTIME_ASYNC_TEXT_BUDGET (4,096) or raises it with the figure recorded in docs/wp7-runtime.md; the Darwin kqueue path compiles and is correct (runtime-net macOS CI)"
        status: pending
      - id: build-docs
        content: "docs/security/serve.md and async.md (findings fixed with a before/after test or recorded open, index row), the async-server guide page if users see it, docs/reference via scripts/gen-reference.mjs, regenerated tests/self/goldens/checked, nish-cmp DECLARED entries in the PR title's words. If B was chosen: the full construct checklist (golden .ll, llvm-as, native round trip, a negative test, LANGUAGE.md rule, cookbook entry, guide page) or the smaller rule-change list the spike justified, and the rolling freeze (src/ may not use it). Show the exact LLVM IR for every TypeScript snippet the PR adds to the tests"
        status: pending
      - id: build-measure
        content: "Before (main) and after (the branch), interleaved in one container: profile.sh Ir per request with frames on plaintext and json, run.sh --only plaintext / json / db, VmHWM on the three serve probes, examples/http-app /health and /notes/17 Ir; figures with the band in the PR body and a Measured trailer. No judged or recorded cell (the other db tests included) worse than main by more than its band"
        status: pending
  - id: router
    title: "perf(net): cut Router.match's instructions per request for every route kind"
    goal: Router.match costs fewer instructions per request on fixed routes, parametrised routes and 404s alike — none worse beyond noise — measured on examples/http-app (/health, /notes/17, a 404), a 44-route router and the async TFB entry, with every match result, parameter and limit unchanged; merged independently of the hand-off build.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js net_router && node tests/run.js net_serve && node tests/run.js tfb_async_entry && node tests/run.js tfb_async_db && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && node docs/check-links.mjs && bash scripts/fetch-seed.sh --force && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && bash bench/techempower/profile.sh --only plaintext && bash bench/techempower/profile.sh --only json (main and the branch, interleaved)
    status: pending
    todos:
      - id: router-profile
        content: "Profile Router.match and walk under callgrind on main (examples/http-app /health, /notes/17 and a 404; a 44-route router; the async TFB entry's plaintext and json) and attribute their ~530 Ir per request by line and callee before changing code. Explicit uses targetIs; #1514 measured a fixed-path table at 506 → 491 on /health, nothing on /notes/17 and 527 → 570 on a 404, and dropped it — a design that makes 404s or parametrised routes slower is out"
        status: pending
      - id: router-cut
        content: "Remove the general per-match cost the profile names (method dispatch, segment scanning, per-node comparisons, param bookkeeping, bounds checks the prover cannot discharge, or what the profile names instead) so every route kind gains; same matches, same precedence, same params, same RouterLimits and the same negative diagnostics. No benchmark-only path; nothing in bench/techempower/"
        status: pending
      - id: router-tests
        content: "Pin behaviour with tests that fail on a wrong match: fixed vs parametrised precedence, trailing slash, methods, 404 and 405 if Router has them, every RouterLimits bound; keep net_router_negative_* unchanged. Show the exact LLVM IR for every TypeScript snippet added to the tests"
        status: pending
      - id: router-measure
        content: "Before (main) and after (branch), interleaved in one container: Ir per match for each route kind on http-app and the 44-route router, profile.sh Ir per request on plaintext and json with Router's frames; figures with the noise band in the PR body and a Measured trailer"
        status: pending
      - id: router-docs
        content: "docs/security/router.md (the match path's findings, before/after tests or recorded open), the http-router guide page if a user sees anything change, docs/reference via scripts/gen-reference.mjs, regenerated tests/self/goldens/checked, nish-cmp DECLARED entries in the PR title's words"
        status: pending
  - id: regate
    title: "docs(runtime): re-measure WP49 stage 6's gate after the hand-off build"
    goal: run.sh, unchanged, re-measures every judged and recorded cell on main after the build and router stages merged, docs/BENCHMARKS.md carries a new section with before (main before the build) and after, and WP49 §6, §10, the status line and docs/roadmap/wp49-async-server.md read stage 6 built if and only if every judged cell is inside the band.
    verification: npm run lint && node docs/check-links.mjs && bash bench/techempower/run.sh --only plaintext && bash bench/techempower/run.sh --only json && bash bench/techempower/run.sh --only db (foreground, on main at the build's merge, and on the pre-build main SHA)
    status: pending
    todos:
      - id: regate-run
        content: "In one container, foreground, split by test: run.sh --only plaintext, --only json, --only db on the pre-build main SHA (the before) and on main at the build's merge (the after). A judged cell whose explicit pair is bimodal is re-run once; still bimodal, it is recorded not judgeable and never called inside"
        status: pending
      - id: regate-publish
        content: "A new docs/BENCHMARKS.md section, outside every generated <!-- name:begin/end --> block, with before and after for every judged cell (plaintext 256/1024/4096, json 16..512, db 64/256) and every recorded one (plaintext 16384, db 16, the other db tests), the band and the verdict by run.sh's rule (inside when d ≥ −band; a `*` cell is never inside); a Measured trailer"
        status: pending
      - id: regate-status
        content: "Update WP49 §6, §10 and the status line in docs/wp49-async-server.md and docs/roadmap/wp49-async-server.md. Every judged cell inside: mark stage 6 built and put Fixes #1402 and Fixes #1468 in the PR. Otherwise record the gap by cell and by frame and leave stage 6 unbuilt; the lead opens the follow-up issue with the next /feature prompt"
        status: pending
---

# WP49 stage 6, the hand-off

Issues #1468 and #1402. On `main`, #1493 recycles a finished task's frame and
region, and #1514 is the latest gate: plaintext 256/1024/4096 are outside the
band by 24 to 35%, json 16, 64, 256 and 512 are outside, json 32 and 128 and
db 64 and 256 are inside. Async spends about 2,500 more Ir per request than
explicit on plaintext. By frame: the serveOn loop ~455, HttpHandler.drive+start
~700, serveTask ~490 (the request copy ~330), Router.match+walk ~530, plus
nish_async_done and an extra memcpy. Re-measure main before quoting a before
figure; the 7,848 vs 4,814 baseline predates #1493.

## Lead steps (no worker)

- **0. Ledger.** The lead opens `Feature: wp49-s6-handoff` (label
  `feature-run`), links #1468, #1402 and every PR from it.
- **2. Decide.** Once both spikes report: the spike with the larger measured
  gain on the judged cells wins. If their deltas are within twice the band of
  each other, `remeasure` runs first. Ties go to A (B is a language change).
  The comparison table and the choice are posted on #1468 before `build`
  spawns, and both draft spike PRs are closed then.
  - Neither spike moves plaintext by more than its band against main → stop
    and report; nothing is built.
  - Router: the owner added a Router stage (2026-11-14 06:25Z), run in
    parallel; the decide step no longer asks about it.
  - B chosen and it makes `Request.raw` read-only or a view → **ask the owner**
    before `build` spawns.

## Stage order

`spike-a` ∥ `spike-b` → (`remeasure`, only if needed) → decide → `build`;
`router` in parallel with all of them; `regate` on main after `build` and
`router` both merge. Spikes never merge, so their shared
files (`std/net/serve.ts`) are not a conflict.

### spike-a
**Owns:** `std/net/serve.ts`, `std/net/handler.ts`, `runtime/runtime-async.c`, `src/emit-async.ts`, `tests/link/net_serve*/**` (throwaway branch `feature/wp49-s6-handoff/spike-a`, draft PR, never merged)

### spike-b
**Owns:** `std/net/serve.ts`, `std/net/handler.ts` (throwaway branch `feature/wp49-s6-handoff/spike-b`, draft PR, never merged; the checker design is on paper in the PR body)

### remeasure
**Owns:** nothing — measures three existing heads and sends one table.

### build
**Owns:** `std/net/serve.ts`, `std/net/handler.ts`, `runtime/runtime-async.c`, `runtime/async.{mjs,d.mts}` if touched (the kqueue path lives in runtime-async.c), `src/emit-async.ts`, `src/async-check.ts`, (B only: `src/check*.ts`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`), `tests/link/net_serve*/**`, `tests/cases/**` (new cases only), `tests/runtime-budgets.js`, `docs/wp7-runtime.md`, `docs/security/{serve,async}.md`, `docs/security/README.md`, `docs/guide/using-nish/async-server.md`, `docs/reference/**`, `tests/self/goldens/checked/**`, `tests/differential/goldens/**`, `tests/nish-cmp.js`, `scalar.config.json`. Not `bench/techempower/**`, not `std/net/router.ts` (the router stage's).

### router
Added by the owner at 06:25Z on 2026-11-14, after spike-a's upper bound left Router as most of the projected remainder. Runs in parallel with the spikes and the build; merges on its own.
**Owns:** `std/net/router.ts`, `tests/link/net_router*/**`, `tests/cases/**` (new router cases only), `docs/security/router.md`, `docs/guide/using-nish/http-router.md`. Shared generated files (`docs/reference/**`, `tests/self/goldens/checked/**`) are regenerated, and `tests/nish-cmp.js` keeps both sides' DECLARED entries: whichever of router and build merges second syncs with `npm run sync-main`.

### regate
**Owns:** `docs/BENCHMARKS.md` (outside generated blocks), `docs/wp49-async-server.md`, `docs/roadmap/wp49-async-server.md`

## Owner's rules (every stage)

Only changes that help ordinary users of nish:async, serve and Router;
nothing added to `bench/techempower/` or `run.sh`; no benchmark-only paths;
/db batching untouched. Executor per-wait epoll syscalls stay as they are
(#1374; its branch `feature/wp49-s6/fix-executor` is not revived). Behaviour
of existing serve programs unchanged, byte for byte. Public API
source-compatible. Out of scope: promises as values, `for await`, async on
wasm, HTTP/2–3 under serve, moving tasks between threads, async in `src/`, a
public TFB submission, the shared HTTP/1 codec and the JSON writer, the /db
batching rules question.

## Measuring

Benchmarks run in the foreground (an idle container is reclaimed with its
background run), split by `--only` to stay under the per-call limit. Each
session measures main and its own head in the same container, interleaved,
and reports deltas — never against another machine's figures. RSS (VmHWM),
never `Arena.used()`. Install wrk, strace, linux-tools and Postgres with apt;
only valgrind is preinstalled. Run `bash scripts/fetch-seed.sh --force`
first. Take in main with `npm run sync-main`; keep both sides' DECLARED
entries in `tests/nish-cmp.js`.
