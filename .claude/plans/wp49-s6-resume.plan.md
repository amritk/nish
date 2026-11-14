---
name: WP49 stage 6, resume — remove serve's two resumes per request, cut ServeConns' answer path and the per-task region, then regate
overview: Close #1610, #1468 and #1402. On main (after #1601 and #1596) async spends 2,043 Ir/req more than explicit on plaintext and 2,429 on json; serve accounts for ~1,600/2,060 of it (serveOn's resume 459, serveTask's resume 432, ServeConns.send 401, ServeConns.drive 237) and the task region and executor ~225. Profile main line by line against explicit's TfbServer.resume and explain the /queries?queries=20 c=64 drop, spike three cuts in parallel measured the same way — (a) a detach-on-first-suspend lowering in src/, (b) a library-only ServeConns.send/drive cut, (c) holding the request record only between parse and copy to undo SERVE-13's +24% peak RSS — decide with the owner on the measured table, build the choice, then re-run the unchanged run.sh gate on main. Last gate is docs/BENCHMARKS.md "TechEmpower: the gate after the hand-off build" (#1608).
stages:
  - id: profile
    title: "measure: attribute serve's per-request cost against TfbServer.resume, and the /queries c=64 drop (WP49 stage 6, no merge unless a fix)"
    goal: One comment on #1468 that attributes, line by line under callgrind on main, serveOn's resume, serveTask's resume, ServeConns.send and ServeConns.drive against explicit's TfbServer.resume on plaintext and json, and names the cause of /queries?queries=20 at c=64 falling 9.3% in #1608 with evidence (or shows it is noise by re-running it) — plus, only if the cause is a defect independent of the spikes, a small fix PR with before/after.
    verification: bash scripts/fetch-seed.sh --force && npm run build && bash bench/techempower/profile.sh --only plaintext && bash bench/techempower/profile.sh --only json && bash bench/techempower/run.sh --only db (foreground; main at the run's base and, for /queries, main at #1601's parent interleaved)
    status: pending
    todos:
      - id: p-setup
        content: "bash scripts/fetch-seed.sh --force; apt-install wrk, strace, linux-tools (perf) and Postgres; build main, and #1601's parent (7699d971, e9730272^) in a second worktree for the /queries comparison"
        status: pending
      - id: p-attribute
        content: "profile.sh on plaintext c=256 and json c=64, then callgrind_annotate --auto=yes on the serve frames: attribute every line of serveOn's resume, serveTask's resume, ServeConns.send and ServeConns.drive (Ir, calls, bounds checks the prover could not discharge, copies, region and executor calls) beside the matching lines of explicit's TfbServer.resume. Name, per frame, which Ir is structural (a second task, a second resume, a region) and which is library work explicit does not do (header array building, status lookup, buffer growth, re-driving)"
        status: pending
      - id: p-queries
        content: "Explain /queries?queries=20 at c=64 −9.3% (#1608): re-run run.sh --only db on main and on #1601's parent, interleaved, three times; if it reproduces, profile one /queries request under callgrind on both and name the frame that grew; if it does not, say so with the figures. If the cause is a defect in std/net/serve.ts independent of the spikes, open a small fix PR (Owns below) with before/after and a test; otherwise no PR"
        status: pending
      - id: p-report
        content: "Post one comment on #1468 (or send it to the lead if the session has no GitHub tools): the per-line tables, the structural vs library split per frame, the /queries verdict, and the upper bound each of spike-a/b/c can reach on paper from these lines. Send the lead `profile table posted <comment url>` as soon as it is up — spike-b and spike-c start from it"
        status: pending
  - id: spike-a
    title: "spike: a serve-spawned task starts inline and detaches at its first suspend (WP49 stage 6 — not for merge)"
    goal: A draft PR, never merged, whose body gives the lowering's measured Ir per request against main (plaintext, json, a plain serve app), says where the frame lives after the detach and what emit-async.ts and async-check.ts change, whether every serve invariant holds, and what the full build would cost — with the wasi and performance sections run and the rolling freeze respected.
    verification: npm run check && npm run lint && node tests/run.js async && node tests/run.js net_serve && node tests/run.js tfb_async_entry && node tests/run.js tfb_async_db && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi (skip line read) && bash bench/techempower/profile.sh --only plaintext && bash bench/techempower/profile.sh --only json (main and the spike, interleaved, same container)
    status: pending
    todos:
      - id: a-setup
        content: "bash scripts/fetch-seed.sh --force; apt-install wrk, strace, linux-tools and Postgres; build main in a second worktree so main and the spike are measured alternately in this container"
        status: pending
      - id: a-lower
        content: "Prototype the lowering in src/emit-async.ts (and src/async-check.ts if the checker must admit it): a task spawned by serve runs inline on the serveOn loop's frame and is detached to its own task node only at its first suspend; a task that never suspends never allocates a node, a region or a second resume. Decide and state where the callee's frame lives after the detach (copied out, allocated up front but unlinked, or a stack slot promoted at suspend), how the per-request deadline, cancellation on hang-up, 503 past inFlight and ServeStats count an inline task, and which runtime-async.c paths (spawn, done, region) change. src/ itself must not use the lowering (rolling freeze); std/ may"
        status: pending
      - id: a-sound
        content: "Keep the invariants or say exactly which one breaks: a non-suspending handler and a suspending one (await on db) both answered byte-identically; pipelining order; deadline; hang-up; maxRequests; shutdown; a wrong Response is a 500. Run the net_serve_* probes and tfb_async_* unchanged. An upper bound that breaks an invariant is reported as a bound, not a gain"
        status: pending
      - id: a-measure
        content: "Main and the spike interleaved: profile.sh plaintext c=256 and json c=64 (Ir/req, top frames), a plain serve + Router app (two routes, one awaiting a timer) under callgrind, VmHWM on net_serve, net_serve_burst, net_serve_rss_flat, run.sh --only plaintext and --only json in the foreground, peak RSS at plaintext c=16384. Run node tests/run.js performance and WASI_SYSROOT=/usr node tests/run.js wasi and report the skip line and any NL9007"
        status: pending
      - id: a-report
        content: "Open the draft PR (body to the lead if no GitHub tools): delta tables, frames, the frame-after-detach answer, the emit-async/async-check change list, invariants kept or broken, security records touched (docs/security/async.md ASYNC-*, serve.md SERVE-*), runtime text against RUNTIME_ASYNC_TEXT_BUDGET, the construct checklist it would need (docs/ARCHITECTURE.md \"How to add a construct\") and the build's file list. Send the lead one line with the Ir/req gain as soon as profile.sh gives it"
        status: pending
  - id: spike-b
    title: "spike: cut ServeConns.send and drive toward the explicit server's write path (WP49 stage 6 — not for merge)"
    goal: A draft PR, never merged, whose body gives a library-only cut of ServeConns.send and ServeConns.drive measured against main the same way as the other spikes, with every answered byte identical and every serve invariant held, and the build's cost.
    verification: npm run check && npm run lint && node tests/run.js net_serve && node tests/run.js net_router && node tests/run.js tfb_async_entry && node tests/run.js tfb_async_db && bash bench/techempower/profile.sh --only plaintext && bash bench/techempower/profile.sh --only json (main and the spike, interleaved)
    status: pending
    todos:
      - id: b-setup
        content: "As a-setup. Read the profile stage's comment on #1468 (the lead sends its URL) before changing code; start on your own callgrind of ServeConns.send/drive vs TfbServer.resume if it is not up within 60 minutes"
        status: pending
      - id: b-cut
        content: "Library only (std/net/serve.ts; std/net/http1-server.ts only if its public behaviour for other users is unchanged): bring ServeConns.send and drive toward TfbServer's write path — what the profile names, e.g. headers written straight into the connection's output buffer instead of name/value arrays, the status line and fixed headers precomputed, no re-drive when the output is already flushed, one write per batch. No epoll registration kept across waits; per-wait dup/ADD/DEL/close unchanged; nothing in bench/techempower/"
        status: pending
      - id: b-measure
        content: "Same metric set as a-measure (profile.sh plaintext/json with frames, the plain serve + Router app, VmHWM on the three probes, run.sh --only plaintext/json foreground, peak RSS c=16384); byte-identical answers checked by diffing raw responses (curl --raw or a socket dump) on main and the spike for plaintext, json, a 404, a 500 from a wrong Response, a 503 past inFlight, HEAD and a pipelined batch"
        status: pending
      - id: b-report
        content: "Open the draft PR (body to the lead if no GitHub tools): deltas, frames, the byte diff result, invariants, security rows touched (SERVE-*), the build's file list. One line to the lead with the Ir/req gain when it exists"
        status: pending
  - id: spike-c
    title: "spike: hold the request record only between parse and copy (WP49 stage 6, SERVE-13 — not for merge)"
    goal: A draft PR, never merged, whose body shows peak RSS at plaintext c=16384 back toward 26.2 MiB (from 32.5) with the request record held only between parse and copy instead of once per connection, its Ir/req cost or gain, and every invariant held.
    verification: npm run check && npm run lint && node tests/run.js net_serve && node tests/run.js tfb_async_entry && node tests/run.js tfb_async_db && bash bench/techempower/profile.sh --only plaintext && bash bench/techempower/run.sh --only plaintext (main and the spike, interleaved; peak RSS at c=16384)
    status: pending
    todos:
      - id: c-setup
        content: "As a-setup. Read the profile stage's comment on #1468 when it is up; this spike does not wait for it"
        status: pending
      - id: c-record
        content: "Library only (std/net/serve.ts): the request record a connection's slot keeps (SERVE-13) is taken from a small pool, or built per parse, and held only from parse to the task's copy, so idle keep-alive connections hold none; say what the pool's size is bound by (inFlight, not connections) and what a pipelined batch does"
        status: pending
      - id: c-measure
        content: "Peak RSS (VmHWM) at plaintext c=16384 and c=256, net_serve_rss_flat over thousands of keep-alive requests, profile.sh plaintext/json Ir/req with frames, run.sh --only plaintext in the foreground; main and the spike interleaved"
        status: pending
      - id: c-report
        content: "Open the draft PR (body to the lead if no GitHub tools): RSS and Ir deltas, the SERVE-13 bound rewritten for the change, invariants, the build's file list. One line to the lead with the c=16384 peak RSS when it exists"
        status: pending
  - id: build
    title: "perf(net): cut serve's per-request resumes and answer path (WP49 stage 6)"
    goal: The design the owner chose at the decide step is built properly — tests that fail without it, every serve invariant held, security records, docs, regenerated goldens and nish-cmp DECLARED entries — with before/after Ir, RSS and req/s on the async TFB entry and on a plain serve + Router app in the PR body and a Measured trailer.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js net_serve && node tests/run.js net_router && node tests/run.js tfb_async_entry && node tests/run.js tfb_async_db && node tests/run.js async && node tests/run.js budget && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && node docs/check-links.mjs && bash scripts/fetch-seed.sh --force && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && bash bench/techempower/profile.sh && bash bench/techempower/run.sh --only plaintext && bash bench/techempower/run.sh --only json && bash bench/techempower/run.sh --only db (main and the branch interleaved); plus node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi if src/ changed, node tests/run.js c-symbols if runtime/*.c changed
    status: pending
    todos:
      - id: build-impl
        content: "Implement the design the owner chose (the lead's decide comment on #1468 is the spec), in the files it names. If the choice includes spike-a's lowering, the owner approved the language change first and the build may be split into a src/ PR and a std/ PR with a merge-order edge (the lead decides at the decide step). No benchmark-only path, nothing in bench/techempower/ or run.sh, no kept epoll registrations"
        status: pending
      - id: build-invariants
        content: "Pin with tests that fail without the change: every answered byte identical; pipelining, deadline (default 30 s), hang-up cancels only its connection's work, 503 past inFlight, maxRequests, shutdown, a wrong Response is a 500 that never stops the server, ServeStats keeps its documented meanings. The net_serve_* probes and tfb_async_entry / tfb_async_db pass — a probe asserting an internal count changes only with a reason in the PR body. Request, Response, ServeLimits, ServeStats, serve, serveOn, refuse stay source-compatible"
        status: pending
      - id: build-docs
        content: "docs/security/serve.md (SERVE-13's bound rewritten if spike-c is built) and async.md (findings fixed with a before/after test or recorded open, index row); the async-server guide page if a user sees anything; docs/reference via scripts/gen-reference.mjs; regenerated tests/self/goldens/checked; nish-cmp DECLARED entries in the PR title's words; for a src/ lowering, its docs/LANGUAGE.md or docs/IR_COOKBOOK.md entry and the golden .ll, llvm-as pass, native round trip and negative test the construct checklist asks for. Show the exact LLVM IR for every TypeScript snippet the PR adds to the tests"
        status: pending
      - id: build-measure
        content: "Before (main) and after (branch), interleaved in one container: profile.sh Ir/req with frames on plaintext and json, run.sh --only plaintext / json / db (every /queries and /updates cell included), VmHWM on the serve probes, peak RSS at plaintext c=16384, the plain serve + Router app under callgrind; figures and bands in the PR body and a Measured trailer. No judged or recorded cell worse than main by more than its band"
        status: pending
  - id: regate
    title: "docs(runtime): re-measure WP49 stage 6's gate after the resume build"
    goal: run.sh, unchanged, re-measures every judged and recorded cell on main before and after the build in one container, docs/BENCHMARKS.md carries a new section with both, and WP49 §6, §10, the status line and docs/roadmap/wp49-async-server.md read stage 6 built — with Fixes #1610, #1468, #1402 — if and only if every judged cell is inside the band.
    verification: npm run lint && node docs/check-links.mjs && bash bench/techempower/run.sh --only plaintext && bash bench/techempower/run.sh --only json && bash bench/techempower/run.sh --only db (foreground, on main at the build's merge and on the pre-build main SHA, one container)
    status: pending
    todos:
      - id: regate-run
        content: "In one container, foreground, split by test: run.sh --only plaintext, --only json, --only db on the pre-build main SHA (before) and on main at the build's merge (after). A judged cell whose explicit pair is bimodal is re-run once; still bimodal, it is recorded not judgeable and never called inside"
        status: pending
      - id: regate-publish
        content: "A new docs/BENCHMARKS.md section, outside every generated <!-- name:begin/end --> block, with before and after for every judged cell (plaintext 256/1024/4096, json 16..512, db 64/256) and every recorded one (plaintext 16384 with peak RSS, db 16, every /queries and /updates cell), the band and the verdict by run.sh's rule; a Measured trailer"
        status: pending
      - id: regate-status
        content: "Update WP49 §6, §10 and the status line in docs/wp49-async-server.md and docs/roadmap/wp49-async-server.md. Every judged cell inside: mark stage 6 built and put Fixes #1610, Fixes #1468 and Fixes #1402 in the PR. Otherwise record the gap by cell and by frame and leave stage 6 unbuilt; the lead opens the follow-up issue with the next /feature prompt"
        status: pending
---

# WP49 stage 6, resume

Issues #1610, #1468 and #1402. On `main`: #1601 (e9730272) makes serve drive
`Http1Server` directly but keeps a spawned task per request and the task's
request copy; #1596 (2fc0f205) makes `Router.match` 8–22% cheaper. #1608 is
the latest gate: 4 of 11 judged cells inside (json 32 and 64, db 64 and 256);
plaintext 256/1024/4096 outside by 20–36%; json 16/128/256 outside; json 512
not judgeable (bimodal twice). Async − explicit is 2,043 Ir/req on plaintext
and 2,429 on json: serve ~1,600/2,060 (serveOn's resume 459, serveTask's
resume 432, ServeConns.send 401, ServeConns.drive 237), router ~430/330,
codec/connection ~280/610, task region and executor ~225. #1608 flagged
/queries?queries=20 at c=64 −9.3% (beyond both bands) and peak RSS at
plaintext c=16384 26.2 → 32.5 MiB from one request record per connection
(SERVE-13).

Earlier spikes (#1591, #1595, the comparison on #1468): an inline start that
spawns on its first suspend needs a detach-on-first-suspend lowering in
`src/emit-async.ts`; per-request reclaim around `await handle(req)` is refused
by NL2424; the unsound upper bound for removing spawn, region and copy was
~760 Ir/req; design B (a borrowed view) caps at ~370 Ir/req and is a construct.

## Lead steps (no worker)

- **0. Ledger.** `Feature: wp49-s6-resume` (label `feature-run`), linking
  #1610, #1468, #1402 and every PR.
- **3. Decide.** When the three spikes have reported, the lead posts one
  comparison table on #1468 (per spike: Ir/req plaintext and json, run.sh
  deltas, peak RSS c=16384, invariants kept, build cost) and **asks the owner**
  which to build. Spike-a is a language change: it is never built without the
  owner's yes. Spikes b and c are not exclusive and may be built together. The
  lead then narrows `build`'s Owns below and closes the spike PRs.
  - No spike moves plaintext Ir/req or req/s beyond its band and c does not
    move RSS → report to the owner; nothing is built; regate does not run.

## Stage order

`profile` ∥ `spike-a` start at once. `spike-b` and `spike-c` start at once
too, and read the profile's comment when it lands (b waits up to 60 minutes
for it before profiling on its own; c does not wait). → decide (owner) →
`build` → `regate` on main. Spikes never merge, so sharing `std/net/serve.ts`
is not a conflict. A /queries fix from `profile`, if one is opened, merges
before `build` (build syncs main after it).

### profile
**Owns:** nothing unless the /queries cause is a defect: then `std/net/serve.ts`, `tests/link/net_serve*/**`, `docs/security/serve.md`, `tests/self/goldens/checked/**`, `tests/nish-cmp.js` (one fix PR)

### spike-a
**Owns:** `src/emit-async.ts`, `src/async-check.ts`, `runtime/runtime-async.c`, `std/net/serve.ts`, `tests/link/net_serve*/**`, `tests/cases/**` (throwaway branch, draft PR, never merged)

### spike-b
**Owns:** `std/net/serve.ts`, `std/net/http1-server.ts` (throwaway branch, draft PR, never merged)

### spike-c
**Owns:** `std/net/serve.ts` (throwaway branch, draft PR, never merged)

### build
**Owns (narrowed at decide):** `std/net/serve.ts`, `std/net/http1-server.ts` (b only), `src/emit-async.ts`, `src/async-check.ts`, `runtime/runtime-async.c`, `src/c-symbols.ts`, `tests/runtime-budgets.js`, `docs/wp7-runtime.md` (a only), `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**` (a only), `tests/link/net_serve*/**`, `tests/cases/**` (new cases only), `docs/security/{serve,async}.md`, `docs/security/README.md`, `docs/guide/using-nish/async-server.md`, `docs/reference/**`, `tests/self/goldens/checked/**`, `tests/differential/goldens/**`, `tests/nish-cmp.js`. Not `bench/techempower/**`, not `std/net/router.ts`.

### regate
**Owns:** `docs/BENCHMARKS.md` (outside generated blocks), `docs/wp49-async-server.md`, `docs/roadmap/wp49-async-server.md`

## Owner's rules (every stage)

Only changes that help regular serve/Router users. Nothing added to
`bench/techempower/` or `run.sh`. No kept epoll registrations (per-wait
dup/ADD/DEL/close stays). Every answered byte identical. The serve invariants
and the `net_serve_*` / `tfb_async_*` probes hold. The public API stays
source-compatible. No judged or recorded cell worse by more than its band.

## Measuring

`examples/http-app` drives HttpHandler, not serve: the ordinary program is a
plain serve + Router app. Benchmarks run in the foreground (background runs
die with an idle container), split by `--only`. Each session measures main
and its own head in the same container, interleaved, and reports deltas,
never against another machine's figures. profile.sh on a 4-core box gives
deterministic Ir; req/s bands of 5–20% are noise. RSS as VmHWM. Install wrk,
strace, linux-tools and Postgres with apt; valgrind is preinstalled. Run
`bash scripts/fetch-seed.sh --force` first. Take in main only on real
overlap or golden/nish-cmp changes (`npm run sync-main`). A sound spike keeps
the invariants; an upper bound that breaks them is not a gain.
