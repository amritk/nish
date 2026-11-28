---
name: WP87 — std panic-free for temporal and the remaining modules
overview: temporal and every remaining std module with sites hold 391 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (temporal 260, math 48, base64 25, random 5, regex 2, release 20, sqlite 22, testing 6, text 3). This package removes or proves them - date arithmetic that overflows or a bad date string becomes a Result. Its first todo adds temporal arithmetic and format instruction-count benches, baselined before any site changes; no PR may raise a count.
priority: 240
labels: [ready]
issue: 2161
stages:
  - id: s1-temporal
    title: WP87 S1 — temporal
    goal: temporal.ts is cleared; the arithmetic and format benches land first and are baselined.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js temporal && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2162
    todos:
      - id: s1-bench
        content: Add instruction-count programs to bench/instructions.json (see bench/README.md, Instruction counts, and bench/run.mjs) that call the functions this package changes - temporal date arithmetic, a format and a parse, a base64 encode, a math kernel; baseline them on CI's runner before any site is changed, and take every count from CI's table, never a local run — see WP87 S1
        status: pending
      - id: s1-fix
        content: Remove or prove every site in std/temporal.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP87 S1
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP87 S1
        status: pending
      - id: s1-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP87 S1
        status: pending
  - id: s2-rest
    title: WP87 S2 — math, base64, random, regex, release, sqlite, testing and text
    goal: The remaining modules are cleared, so every module in tests/std-panics.json reads zero and the baseline holds only the kept list.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js temporal && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2163
    todos:
      - id: s2-fix
        content: Remove or prove every site in std/math.ts, std/base64.ts, std/random.ts, std/regex.ts, std/release.ts, std/sqlite.ts, std/testing.ts, std/text.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP87 S2
        status: pending
      - id: s2-final
        content: Check tests/std-panics.json lists no module with a to-fix count, and that the kept list is the only remaining panics — see WP87 S2
        status: pending
      - id: s2-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP87 S2
        status: pending
      - id: s2-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP87 S2
        status: pending
---

# WP87 — std panic-free for temporal and the remaining modules

## Context

temporal and every remaining std module with sites hold 391 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (temporal 260, math 48, base64 25, random 5, regex 2, release 20, sqlite 22, testing 6, text 3). This package removes or proves them: date arithmetic that overflows or a bad date string becomes a Result. Its first todo adds temporal arithmetic and format instruction-count benches, baselined before any site changes; no PR may raise a count.

Examples unblocked: none named.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason. A wrap is spelled, never cast (owner's rule; `CLAUDE.md`, "A wrap is spelled, never cast"): no site is cleared by casting `i32` or `i64` arithmetic through `u32` or `u64` so that it wraps (`toI32(toU32(a) + toU32(b))`). Where the wrap would hide an overflow, prove the bound or return a Result. Where wrapping is the algorithm's answer (a hash multiply, a counter mod 2^32), write `wrappingAdd`, `wrappingSub` or `wrappingMul` from `nish:unsafe`, the one `nish:unsafe` use this rule allows, so every deliberate wrap is greppable. A value that is `u32` or `u64` all the way through wraps by its type and needs neither.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. A PR that removes a panic site may not raise any count in `bench/instructions.json` (`CLAUDE.md`, "Definition of done"); a count that falls is lowered in that PR. Where a proof needs a slower form, teach the prover instead, as #2303 did for `new Array` lengths and slice ranges; only where that cannot be done is the raise recorded in the file's `raises`, with a measured reason (`node bench/run.mjs --instructions --update --raise <row> --why "..."`; `bench/README.md`, "Raising a baseline"). CI's `lint` job compares every row against the merge-base's file and fails on a raise `raises` does not record. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

## Stages

### S1 — temporal

temporal.ts is cleared; the arithmetic and format benches land first and are baselined.

Sites as of 071ed014 (260): temporal 260. Kinds: overflow 240, index 9, slice 7, divide 3, panic 1.

### S2 — math, base64, random, regex, release, sqlite, testing and text

The remaining modules are cleared, so every module in tests/std-panics.json reads zero and the baseline holds only the kept list.

Sites as of 071ed014 (131): math 48, base64 25, random 5, regex 2, release 20, sqlite 22, testing 6, text 3. Kinds: overflow 67, index 23, slice 13, panic 8, ffi-nul 7, ffi-null 6, divide 4, array-length 3.
