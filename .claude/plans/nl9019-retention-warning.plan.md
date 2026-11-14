---
name: NL9019 — finish the kept-memory warning without a latch
overview: Land PR #1558 (NL9019, a function that keeps an allocation on every call run from a loop pass that releases nothing; plus Ok/Err as visible allocations for NL9003/NL9016). Its last blocking finding is that the once-latch exemption decides "same object every pass" from the loop's text alone, so a replacement in a callee or through a pre-loop alias keeps a latched function silent. Rounds 1-4 each found a new hole in that pattern-matcher, so the latch goes (option b) and NL9019 is narrowed to the functions a loop pass calls directly, judged on their own kept allocations.
stages:
  - id: s1-direct-callees
    title: "fix(checker): narrow NL9019 to a loop's direct callees and drop the once-latch"
    goal: NL9019 reports a function the loop pass calls directly that keeps an allocation of its own, with no exemption that reasons about which object a call receives, so the round-4 counterexamples warn; src/ and std/ stay clean under the selfhost ratchet, and PR #1558 is green and mergeable on current main.
    verification: npm run check && npm run lint && node tests/run.js performance && node tests/run.js selfhost && WASI_SYSROOT=/usr node tests/run.js wasi && node scripts/gen-reference.mjs --check
    todos:
      - id: sync-main
        content: Check out feature/let-result-arena/retention-warn (PR #1558, head 5680025f) and run `npm run sync-main`; commit the merge with regenerated goldens — see S1
        status: pending
      - id: drop-latch
        content: Delete the latch and same-object machinery from src/escape.ts (latchParameter, noResets, latchingStoresIn, latchPathOf, sameObjectIn, touchesPath, passMask, reachedMask, Latches, Reach.fixed and the re-walk on a shrinking mask) — see S1
        status: pending
      - id: direct-only
        content: Make loopReachedFunctions answer only the functions a pass that takes no scope calls directly (a call of a function parameter still resolves to the argument inside the instantiation); keptMemoryFindings judges each on its own kept allocation — see S1
        status: pending
      - id: tests
        content: Rewrite perf_kept_memory_latch as perf_kept_memory_direct (warns on the callee-renewal and pre-loop-alias shapes and every former latch shape called directly); keep perf_kept_memory_quiet quiet, adding a deeper-chain case that is silent by design; regenerate .ll/.out, goldens, differential goldens, nish-cmp DECLARED — see S1
        status: pending
      - id: lists
        content: List NL9018 and NL9019 in src/options.ts (~line 197, the --deny-retention doc comment) and AGENTS.md (~line 84, the --deny-retention row), and anywhere else that enumerates the retention codes — see S1
        status: pending
      - id: docs
        content: State NL9019's scope (direct callees of the pass, their own allocations; deeper chains are out of scope) in docs/LANGUAGE.md, the guide page for retention warnings, and the diagnostic's reference entry; regenerate docs/reference — see S1
        status: pending
      - id: ratchet
        content: Run the selfhost ratchet and the performance section; src/break-sound.ts onPath and std/cli.ts envSaysNo, envSaysYes, paletteOf stay silent — see S1
        status: pending
---

# NL9019 — finish the kept-memory warning without a latch

## Decision: option (b)

PR #1558's once-latch exempts a function guarded by `if (o.flag) return; o.flag = true` when it is called on "the same object on every pass". Proving "same object" needs alias and side-effect reasoning over the whole program; the PR approximates it with an AST matcher over the loop's text (`sameObjectIn`/`touchesPath`), and four review rounds each found a shape it misses. Its two open holes:

- a replacement inside a callee (`renewG()` sets `g.cur` during the pass), and
- a replacement through an alias made before the loop (`const t = h; t.cur = new State(); prep(h.cur)`).

Options considered:

- **(a) whole-program same-object**, as `noResets` scans every unit — still a pattern-matcher, now over every module and every alias; the next round finds the next spelling. Rejected.
- **(b) drop the latch; NL9019 covers the loop's direct callees and their own kept allocations** — chosen. It deletes the matcher rather than patching it. What the latch quieted is mostly quiet without it: a latched function that stores into its receiver or a parameter is already exempt (`fillsParam`), and the transitive callee behind a latch (`tally` behind `prepare`) is no longer reached at all. The cost is stated in the docs: memory kept two calls down, behind a direct callee that answers memory, is not reported by NL9019 (`--explain-memory` still lists it), and a direct callee that really is once-only and keeps a local array warns — the hint names `using a = arena()`.
- **(c) ship NL9019 off by default** — keeps every hole and hides the warning; the fallback only if (b) breaks the ratchet.

**Stop rule.** If (b) makes any function in `src/` or `std/` warn under the selfhost ratchet and the only way to quiet it is a new shape-matching exemption, do not add one: push, mark the PR draft, and name the function in the PR body. The lead escalates; (c) is the human's call.

## S1 — direct callees, no latch

**Owns:** `src/escape.ts`, `src/checker.ts`, `src/compilation.ts`, `src/options.ts`, `src/codes.ts`, `AGENTS.md`, `docs/LANGUAGE.md`, `docs/guide/**`, `docs/reference/**`, `scalar.config.json`, `tests/cases/perf_kept_memory*`, `tests/cases/reject_deny_retention_*`, `tests/cases/res_let_reassign*`, `tests/wordings/nl9019*`, `tests/run.js`, `tests/nish-cmp.js`, `tests/self/goldens/**`, `tests/differential/**`

Work on the existing PR branch `feature/let-result-arena/retention-warn` (PR #1558), not a new one: the review history lives there.

1. `npm run sync-main` first (main has moved past #1555 and #1566); commit the merge.
2. Remove every function and field that exists to decide "same object every pass" or "latched". `git grep -n 'latch\|sameObject\|touchesPath\|noResets\|passMask\|reachedMask' src/` returns nothing NL9019-related afterwards.
3. `loopReachedFunctions` → the direct callees of a pass that takes no scope, across every module and instantiation (keep the function-parameter → argument resolution; it is a call-graph fact, not an object fact). No work-list over callees' callees.
4. Tests, each with its IR shown in the PR per CLAUDE.md:
   - `perf_kept_memory_direct` (replaces `perf_kept_memory_latch`): every former non-latch guard, plus `renewG` and the pre-loop alias, plus a once-guarded function on a fixed object that keeps a local array — all warn.
   - `perf_kept_memory_quiet`: keep its cases quiet; replace the latch-reliant ones (`warmVia`/`warmOnce`) with a two-deep chain that is silent by design and say so in its comment.
   - `res_let_reassign` still raises none of NL9003/NL9016/NL9018/NL9019; `reject_deny_retention_kept` still errors as NL2462.
5. `src/options.ts` (`denyRetention` doc, ~197) and `AGENTS.md` (`--deny-retention` row, ~84) list NL9002, NL9003, NL9011, NL9016, NL9018, NL9019; grep docs for any other enumeration of the codes.
6. Docs: LANGUAGE.md's NL9019 rule and the guide page state the scope in (b) above; `node scripts/gen-reference.mjs`.
7. Before pushing: `npm run check`, `npm run lint`, `npm run lint:dead`, `node tests/run.js performance`, `node tests/run.js selfhost`, `WASI_SYSROOT=/usr node tests/run.js wasi`, nish-cmp; CI's eight shards are the full-suite gate.
