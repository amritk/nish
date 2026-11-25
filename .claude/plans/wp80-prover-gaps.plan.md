---
name: WP80 prover gaps — the src/ proofs WP80 S6 waits on
overview: WP80 S6 (#2209) stopped at what a std-only stage can reach. The owner decided "prover work first" (decision on #2209, 2026-11-25). Land #2279 (new Array lengths and slice ranges, for #2207 and #2208), then close the four prover gaps S6 found — a [start, end) window slice (#2297), the index of an atomic element method (#2206), a caller's proof discharging a constructor or contract panic outside std/threads.ts (#2296), and a non-literal string proven NUL-free at an ffi call (#2298). Then S6 reruns and drops the example opt-outs these free. The stages run one after another, because every one of them edits the same prover files (src/bounds.ts, src/attributes.ts, src/panics.ts, src/emit-strings.ts) and the same pinned files (tests/std-panics.json, tests/cases/*.ll, tests/nish-cmp.js, docs/LANGUAGE.md). Example opt-outs are not touched here; S6 owns them.
priority: 170
stages:
  - id: s1-ranges
    title: Land #2279 — prove new Array lengths and slice ranges
    goal: The owner's draft #2279 is brought up to date with main, finished and merged, so `new Array(n)` lengths and `(buf, 0, len)` slice ranges the code has checked are recorded as proven, and #2207 and #2208 close.
    verification: node tests/run.js std-panics && node tests/run.js deny_panics && node tests/run.js arr_ && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && NISH=build/nish bash docs/cookbook/regen.sh --check
    todos:
      - id: s1-take
        content: Branch from the head of #2279 (claude/modest-meitner-bsjb3p, c59a6efc), take in main with npm run sync-main, and regenerate every generated file the merge conflicts on, never resolving one by hand
        status: pending
      - id: s1-finish
        content: Finish what #2279 leaves open (its body's unchecked items, its own review), keep its release-note words "new Array lengths and slice ranges" in the DECLARED changelog strings and the PR title
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers, tests/cases/*.ll, the checked goldens, docs/reference and docs/IR_COOKBOOK.md; lower tests/std-panics.json to the exact new per-module counts
        status: pending
  - id: s2-window
    title: Prove a [start, end) window slice (#2297)
    goal: A slice window whose start and end the code has checked against the buffer's length (0 <= start <= end <= buf.length), including field-held bounds, is recorded as proven by src/bounds.ts, with end - start proven not to overflow.
    verification: node tests/run.js std-panics && node tests/run.js deny_panics && node tests/run.js net_http1 && node tests/run.js net_static && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && NISH=build/nish bash docs/cookbook/regen.sh --check
    todos:
      - id: s2-prove
        content: Extend the slice prover from s1 to [start, end) windows, with the sites std/net/http1-server.ts send (the [start, end) window, :3286 at b2d5c989) and std/net/static.ts this.path window (:1416) as the cases to clear
        status: pending
      - id: s2-tests
        content: A tests/link case or tests/run.js check that fails when the proof is removed, and a negative showing an unchecked window stays unproven
        status: pending
      - id: s2-pins
        content: Regenerate the pinned files and lower tests/std-panics.json; nish-cmp DECLARED entries for any corpus IR it moves; the docs/LANGUAGE.md rule and docs/guide page that say which slices are proven
        status: pending
  - id: s3-atomic
    title: Prove the index of an atomic element method (#2206)
    goal: A guarded or loop-bounded index into an AtomicI32Array or AtomicI64Array element method (load, store, add, compareExchange and the rest in std/threads.ts) is recorded as proven by src/bounds.ts.
    verification: node tests/run.js std-panics && node tests/run.js deny_panics && node tests/run.js threads && node tests/run.js atomic && node tests/run.js par_atomic && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && NISH=build/nish bash docs/cookbook/regen.sh --check
    todos:
      - id: s3-prove
        content: Prove the atomic element index when the caller has checked i < arr.length or loops i < length; the sites examples/histogram-atomic reaches (std/threads.ts :826, :841, :863 at b2d5c989) and the 32 index sites in std/threads.ts are the cases to clear
        status: pending
      - id: s3-tests
        content: A tests/link case or tests/run.js check that fails when the proof is removed, and a negative showing an unguarded index stays unproven
        status: pending
      - id: s3-pins
        content: Regenerate the pinned files and lower the std/threads.ts count in tests/std-panics.json; nish-cmp DECLARED entries; the docs/LANGUAGE.md rule and docs/guide page
        status: pending
  - id: s4-caller
    title: Let a caller's proof discharge a contract panic outside std/threads.ts (#2296)
    goal: A constructor or method contract panic whose every route goes through a checked twin is no longer reached, either because callerProven (src/attributes.ts) discharges it beyond std/threads.ts or because std gets a panic-free construction path the twins use, with no public signature change.
    verification: node tests/run.js std-panics && node tests/run.js deny_panics && node tests/run.js net_http1 && node tests/run.js net_handler && node tests/run.js net_router && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && NISH=build/nish bash docs/cookbook/regen.sh --check
    todos:
      - id: s4-discharge
        content: Clear the cap check in Http1Connection's constructor (std/net/http1-server.ts :498), the write caller window (:506), std/net/handler.ts :934 reached from openHttpHandler, and routerOutside and routerNoRoute in std/net/router.ts (lines at b2d5c989)
        status: pending
      - id: s4-tests
        content: A tests/link case or tests/run.js check that fails when the discharge is removed, and a negative showing an unchecked caller still reaches the panic
        status: pending
      - id: s4-pins
        content: Regenerate the pinned files and lower tests/std-panics.json; nish-cmp DECLARED entries; the docs/LANGUAGE.md rule and docs/guide page
        status: pending
  - id: s5-nul
    title: Prove a non-literal string NUL-free at an ffi call (#2298)
    goal: A string the code has checked for NUL, or one built only from NUL-free parts, is recorded as NUL-free at the ffi call, beyond the string literals foreignStringIsNulFree (src/emit-strings.ts) proves today.
    verification: node tests/run.js std-panics && node tests/run.js deny_panics && node tests/run.js ffi && node tests/run.js sync_shm && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && NISH=build/nish bash docs/cookbook/regen.sh --check
    todos:
      - id: s5-prove
        content: Prove NUL-free a string checked for NUL or built from NUL-free parts; the three std/sync/shm.ts ffi-nul sites in tests/std-panics.json are the cases to clear
        status: pending
      - id: s5-tests
        content: A tests/link case or tests/run.js check that fails when the proof is removed, and a negative showing an unchecked string stays unproven
        status: pending
      - id: s5-pins
        content: Regenerate the pinned files and lower the std/sync/shm.ts ffi-nul count in tests/std-panics.json; nish-cmp DECLARED entries; docs/LANGUAGE.md, docs/guide and docs/security/codegen.md where they describe the ffi-nul check
        status: pending
---

# WP80 prover gaps

The owner's decision on #2209: land #2279, #2206, #2296, #2297 and #2298, then
rerun WP80 S6 to drop the example opt-outs they free. This plan is the first
half. S6's rerun is not in it.

## Why the stages run in series

All five items are `src/` prover work. #2279 alone edits `src/bounds.ts`,
`src/attributes.ts`, `src/panics.ts`, `src/emit-strings.ts`, `src/program.ts`,
`src/emit-arrays.ts` and `src/emit-builtins.ts`, and its proofs move dozens of
`tests/cases/*.ll` goldens, `tests/std-panics.json`, `tests/nish-cmp.js`,
`docs/LANGUAGE.md` and guide pages. Each later stage builds on its facts and
touches the same files, so no two stages have disjoint `Owns`. Each stage
starts once the one before it has merged. #2297 extends the slice prover
#2279 adds; it stays its own stage because #2279 is worth merging on its own.

## s1-ranges

**Owns:** `src/**`, `std/**`, `tests/run.js`, `tests/link/**`, `tests/cases/**`, `tests/nish-cmp.js`, `tests/std-panics.json`, `tests/differential/**`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/guide/**`, `docs/security/codegen.md`, `docs/reference/**`, `scalar.config.json`, `docs/IR_COOKBOOK.md`, `tests/self/goldens/checked/**`, `tests/wordings/**`, `bench/instructions.json`, `examples/arrays.ts`

Starts from #2279's head, not from main. The PR it opens supersedes #2279,
`Fixes #2207` and `Fixes #2208`.

## s2-window

**Owns:** as s1-ranges, without `examples/arrays.ts`

**Depends on:** s1-ranges (merged)

`Fixes #2297`.

## s3-atomic

**Owns:** as s2-window

**Depends on:** s2-window (merged)

`Fixes #2206`.

## s4-caller

**Owns:** as s2-window

**Depends on:** s3-atomic (merged)

`Fixes #2296`. A std-side construction path is allowed (the issue's second
option). A public `std/` signature change is not.

## s5-nul

**Owns:** as s2-window

**Depends on:** s4-caller (merged)

`Fixes #2298`.

## Not in scope

- The example opt-out headers and `// smoke - args --allow-panics` lines.
  WP80 S6 drops them on its rerun.
- The kept panics `negativeAtomicLength` and `prefork.ts:1392`, and the
  `std/json-typed` sites merge-patch reaches.
