---
name: WP85 — std panic-free for term, raster, synth and host
overview: The terminal, raster, synth and host modules hold 462 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (host/game 7, host/ring 17, host/text 4, raster 86, synth 6, term-pixels 101, term-io 24, term-rate 44, term-probe 2, term 171). This package removes or proves them, unblocking game-starter (host/ring.ts:67, synth.ts:108 and 51, raster.ts 454, 490, 337, 262, term.ts:1728), break-web (term-pixels.ts:156, plus game.ts's own sites) and term-probe (term-pixels.ts:213, term-io.ts:882). Its first todo adds an instruction-count bench for a term frame render and a raster fill, baselined before any site changes; no PR may raise a count.
priority: 220
labels: [ready]
issue: 2154
stages:
  - id: s1-host-raster
    title: WP85 S1 — host, raster and synth
    goal: host/game, host/ring, host/text, raster and synth are cleared; the frame-render benches land first and are baselined.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js wasi && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2155
    todos:
      - id: s1-bench
        content: Add instruction-count programs to bench/instructions.json (see bench/README.md, Instruction counts, and bench/run.mjs) that call the functions this package changes - a term frame render and flush, a raster fill and blit, a synth buffer fill; baseline them on CI's runner before any site is changed, and take every count from CI's table, never a local run — see WP85 S1
        status: pending
      - id: s1-fix
        content: Remove or prove every site in std/host/game.ts, std/host/ring.ts, std/host/text.ts, std/raster.ts, std/synth.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP85 S1
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP85 S1
        status: pending
      - id: s1-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP85 S1
        status: pending
  - id: s2-term-io
    title: WP85 S2 — term-pixels, term-io, term-rate and term-probe
    goal: The pixel, input/output, rate-limit and probe sites are cleared, so break-web and term-probe build without --allow-panics.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js term && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2156
    todos:
      - id: s2-fix
        content: Remove or prove every site in std/term-pixels.ts, std/term-io.ts, std/term-rate.ts, std/term-probe.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (term-pixels.ts:156, 213; term-io.ts:882 are the first sites the examples hit) — see WP85 S2
        status: pending
      - id: s2-optout
        content: Drop the opt-out headers and smoke args of examples/break-web and examples/term-probe (game.ts's own sites are fixed here too), and the guide marker and sentence about them — see WP85 S2
        status: pending
      - id: s2-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP85 S2
        status: pending
      - id: s2-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP85 S2
        status: pending
  - id: s3-term
    title: WP85 S3 — term
    goal: term.ts is cleared, so game-starter builds without --allow-panics.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js term && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2157
    todos:
      - id: s3-fix
        content: Remove or prove every site in std/term.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) (term.ts:1728 is the first site game-starter hits) — see WP85 S3
        status: pending
      - id: s3-optout
        content: Drop the opt-out header and smoke args of examples/game-starter, and the guide marker and sentence about it — see WP85 S3
        status: pending
      - id: s3-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP85 S3
        status: pending
      - id: s3-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP85 S3
        status: pending
---

# WP85 — std panic-free for term, raster, synth and host

## Context

The terminal, raster, synth and host modules hold 462 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (host/game 7, host/ring 17, host/text 4, raster 86, synth 6, term-pixels 101, term-io 24, term-rate 44, term-probe 2, term 171). This package removes or proves them, unblocking game-starter (host/ring.ts:67, synth.ts:108 and 51, raster.ts 454, 490, 337, 262, term.ts:1728), break-web (term-pixels.ts:156, plus game.ts's own sites) and term-probe (term-pixels.ts:213, term-io.ts:882). Its first todo adds an instruction-count bench for a term frame render and a raster fill, baselined before any site changes; no PR may raise a count.

Examples unblocked: game-starter (S1, S3), break-web (S2), term-probe (S2). The diagnostic names only the first site per call, so more can appear after a fix.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

## Stages

### S1 — host, raster and synth

host/game, host/ring, host/text, raster and synth are cleared; the frame-render benches land first and are baselined.

Sites as of 071ed014 (120): host/game 7, host/ring 17, host/text 4, raster 86, synth 6. Kinds: index 53, overflow 49, array-length 13, divide 4, slice 1.

### S2 — term-pixels, term-io, term-rate and term-probe

The pixel, input/output, rate-limit and probe sites are cleared, so break-web and term-probe build without --allow-panics.

Sites as of 071ed014 (171): term-pixels 101, term-io 24, term-rate 44, term-probe 2. Kinds: overflow 105, index 43, array-length 6, divide 6, slice 5, panic 4, pop 2.

### S3 — term

term.ts is cleared, so game-starter builds without --allow-panics.

Sites as of 071ed014 (171): term 171. Kinds: overflow 105, index 38, array-length 11, panic 5, pop 5, divide 4, slice 3.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `KeyDecoder.keep`, `Screen.flush`, `termBytesText`, `termDecodeEvents`, `termDecodeKeys`.
