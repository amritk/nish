---
name: std panic-free — a ratchet that only lets std/'s panic count fall, the kept-panic rule, and one work package per area
overview: std/ still holds 9,584 distinct unproven, non-OOM, non-call, non-unchecked panic sites in 116 modules (inventory on 071ed014). One PR adds a tests/run.js section that rebuilds that inventory from the compiler's own --emit-panics output and holds it to an exact committed baseline (tests/std-panics.json), classifies the 462 explicit panic sites as kept or to fix and records the rule, adds instruction-count benchmarks that reach the code each package changes so every package must hold or lower them, drafts one work package per area (WP80 to WP87), and if time allows removes the threads, json-typed and cli-args sites that keep tasks, histogram, histogram-atomic, merge-patch and api-cli opted out.
priority: 100
labels: [ready]
stages:
  - id: s1-ratchet
    title: std panic ratchet, kept-panic rule, perf benches and the first fixes
    goal: node tests/run.js std-panics fails on any rise, any new module with sites, and any fall the baseline does not record; the 462 explicit panics are each kept with a reason or counted to fix; the rule is in docs/LANGUAGE.md; instruction-count benches reach threads, json-typed and cli-args and their counts hold or fall; the WP80 to WP87 plan files are on main; and, time allowing, tasks, histogram, histogram-atomic, merge-patch and api-cli build without --allow-panics.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js wasi && node tests/run.js threads && node tests/run.js json && node tests/run.js cli && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/gen-diagnostic-codes.mjs --check && node tests/nish-cmp.js
    todos:
      - id: s1-inventory
        content: Add a tests/run.js section std-panics that compiles every git-tracked std/**/*.ts as root with --allow-panics --emit-panics into a temp directory (-o <dir>/ for multi-module files), keeps sites that are not proven, not allowed, not kind call, oom or unchecked, dedupes them by module:line:col:kind, and counts them per module and per kind
        status: pending
      - id: s1-baseline
        content: Commit tests/std-panics.json with the exact per-module counts, a kept list (function, module, reason) counted separately from the to-fix count, and fail on a rise, a new module with sites, a fall not written back, or a kept entry whose site no longer exists; print the command that rewrites it (--update) on failure
        status: pending
      - id: s1-classify
        content: Classify each of the 462 explicit panic(...) sites (323 functions in 63 modules) as kept (a documented contract violation where a Result would push a made-up value onto every caller) or to fix (a real failure that should be a Result, or unreachable and provable away), recording kept ones in the baseline with their reason
        status: pending
      - id: s1-rule
        content: Write the kept-panic rule in docs/LANGUAGE.md (panics section) and a sentence with a link in the std/ guide page, including whether a kept site still refuses strict callers (NL2458)
        status: pending
      - id: s1-spawn
        content: Make ThreadScope.spawn's slot check (std/threads.ts:277) and parallelMapInto's dstTooShort (:174) caller-proven, as the owner decided at sign-off — a site kind the call site's bounds proof (0 <= at < dst.length, dst.length >= src.length) discharges, modelled on parallel-length in src/attributes.ts noteCall and src/panics.ts refuseSite, with a tests/link negative for an unproven call and a positive for a proven one — and record in the PR body that neither #2103 nor #2118 left threads.ts:278 there (it predates both; #2103's message names std/threads but its diff never touched the file)
        status: pending
      - id: s1-perf
        content: Add instruction-count programs to bench/instructions.json that reach ThreadScope.spawn and parallelMapInto, jsonDecode through json-typed, and cli-args parsing, landed and counted before any fix in this PR so the fix's effect is measured; take every count from CI's runner table, never from a local cachegrind run
        status: pending
      - id: s1-fixes
        content: If time allows, remove or prove the threads, json-typed (std/json-typed.ts:806 overflow) and cli-args sites the five examples reach, the way #2103 did (no nish:unsafe, no made-up-value guards, Result where a failure is real), drop their opt-out headers and smoke args, lower tests/std-panics.json, and lower each instruction count that fell to CI's figure
        status: pending
      - id: s1-pins
        content: Regenerate every pinned std/<file>.ts:LINE:COL the edits move (tests/link/*/expected.caps.json, tests/wordings/*.err, docs/reference/diagnostics/), the checked goldens and docs/reference, and add DECLARED (and file exit) entries in tests/nish-cmp.js for every corpus program whose IR or exit moves, found with MAX_ROWS raised in an uncommitted scratch copy
        status: pending
      - id: s1-wps
        content: Commit the WP80 to WP87 plan files the lead drafted (.claude/plans/wp8*-*.plan.md) with their issue numbers
        status: pending
---

# std panic-free

## Context

`--emit-panics` on 071ed014 (each git-tracked `std/**/*.ts` compiled as
root with `--allow-panics`, sites deduped by `module:line:col:kind`, skipping
`proven`, `allowed`, `call`, `oom` and `unchecked`) gives 9,584 sites in 116
modules: overflow 5,263, index 2,995, array-length 513, panic 462, slice 168,
divide 97, pop 24, io-exit 23, range 22, ffi-nul 10, ffi-null 7.

`std/threads.ts:278` (`slotOutOfRange`) is not a regression. `git log` shows no
commit to `std/threads.ts` since before #2004; #2103's subject names
std/threads but its diff does not touch the file, and #2118 (lend) does not
either. `examples/tasks.ts`'s opt-out header dates from #2004.

## Stages

### S1 — the ratchet, the rule, the benches, the first fixes

Owns: `tests/run.js`, `tests/std-panics.json`, `std/threads.ts`,
`std/json-typed.ts`, `std/cli-args.ts`, `src/panics.ts`, `src/attributes.ts`,
`src/bounds.ts`, `src/codes.ts`, `docs/LANGUAGE.md`, `docs/guide/**`,
`docs/reference/**`, `docs/IR_COOKBOOK.md`, `examples/tasks.ts`,
`examples/histogram.ts`, `examples/histogram-atomic.ts`,
`examples/merge-patch.ts`, `examples/api-cli/**`, `bench/**`,
`tests/nish-cmp.js`, `tests/link/**`, `tests/wordings/**`,
`tests/self/goldens/checked/**`, `tests/differential/**`,
`.claude/plans/wp8*-*.plan.md`, `scalar.config.json`.

Perf rule for this stage and for every work package it files: each package
first adds instruction-count programs (bench/instructions.json) that reach the
functions it will change, baselined before the change; its PRs may not raise any
count; a count that falls is lowered in the same PR to CI's runner figure. The
PR body shows the before and after table from CI.

## Work packages this stage files under #1849

| WP | Area | Blocks examples |
| --- | --- | --- |
| WP80 | threads, json-typed, cli-args (what S1 leaves), cli-flags, cli, sync/ring, sync/shm, bytes, and the HTTP/1 server stack (http-server, http1-codec, http1-server, handler, serve, router, http-fields, url, prefork, buffer-pool, http-compress) | api-cli, tasks, histogram, histogram-atomic, merge-patch, prefork-jobs, file-server, prefork-server, http-app |
| WP81 | postgres, postgres-async, postgres-carrier | — |
| WP82 | QUIC, HTTP/3, QPACK, WebTransport, TLS, DNS, and the rest of std/net (fetch, http1-client-codec, outbound, upstream, http2, hpack, websocket, grpc, oidc) | http-get-json, relay |
| WP83 | std/crypto | — |
| WP84 | std/compress | — |
| WP85 | term, term-pixels, term-rate, term-io, term-probe, host/*, raster, synth | game-starter, break-web, term-probe |
| WP86 | yaml and the rest of json | — |
| WP87 | temporal and the rest of std | — |
