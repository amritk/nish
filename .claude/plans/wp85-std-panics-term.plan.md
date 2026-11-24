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

**Owns:** `std/host/game.ts`, `std/host/ring.ts`, `std/host/text.ts`, `std/raster.ts`, `std/synth.ts`, `bench/std-term-*`, `bench/std-raster*`, `bench/std-synth*`, `bench/run.mjs`, `bench/README.md`, `tests/link/std_host_*/**`, `tests/link/std_raster*/**`, `tests/link/std_synth*/**`, `tests/host-import/text/**`, `docs/security/wasm-host.md`, and the shared-row files (below): `tests/std-panics.json`, `bench/instructions.json`, `tests/nish-cmp.js`, `docs/guide/using-nish/standard-library.md`, `docs/guide/using-nish/terminal.md`, `docs/guide/using-nish/browser-games.md`, `docs/security/README.md`

**Model:** lead (the bench design and the proofs are judgement).

**Runs with:** S2 and S3 in parallel. Merges first.

### S2 — term-pixels, term-io, term-rate and term-probe

The pixel, input/output, rate-limit and probe sites are cleared, so break-web and term-probe build without --allow-panics.

Sites as of 071ed014 (171): term-pixels 101, term-io 24, term-rate 44, term-probe 2. Kinds: overflow 105, index 43, array-length 6, divide 6, slice 5, panic 4, pop 2.

**Owns:** `std/term-pixels.ts`, `std/term-io.ts`, `std/term-rate.ts`, `std/term-probe.ts`, `examples/break-web/game.ts`, `examples/break-web/build.mjs`, `examples/term-probe.ts`, `tests/link/std_term_pixels*/**`, `tests/link/std_term_io*/**`, `tests/link/std_term_rate*/**`, `tests/link/std_term_probe*/**`, `tests/link/break_*/**`, and the shared-row files (below): `tests/std-panics.json`, `bench/instructions.json`, `tests/nish-cmp.js`, `docs/guide/using-nish/standard-library.md`, `docs/guide/using-nish/terminal.md`, `docs/guide/using-nish/browser-games.md`, `docs/security/README.md`

**Model:** lead.

**Runs with:** S1 and S3 in parallel. Merges after S1 (it updates from main first, so S1's benches are on its base and its counts are measured against them).

A break-web or term-probe opt-out that cannot be dropped only because a call still reaches a `std/term.ts` site stays, and the PR body names the site; S3 drops it.

### S3 — term

term.ts is cleared, so game-starter builds without --allow-panics.

Sites as of 071ed014 (171): term 171. Kinds: overflow 105, index 38, array-length 11, panic 5, pop 5, divide 4, slice 3.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `KeyDecoder.keep`, `Screen.flush`, `termBytesText`, `termDecodeEvents`, `termDecodeKeys`.

**Owns:** `std/term.ts`, `examples/game-starter/**`, `tests/link/std_term/**`, `tests/link/std_term_events/**`, `tests/link/std_term_f64/**`, `tests/link/std_term_buffers_disagree/**`, `tests/link/reject_term_feed_string/**`, `tests/link/std_term_neg_*/**` for new term.ts negatives, `docs/security/term.md`, and the shared-row files (below): `tests/std-panics.json`, `bench/instructions.json`, `tests/nish-cmp.js`, `docs/guide/using-nish/standard-library.md`, `docs/guide/using-nish/terminal.md`, `docs/guide/using-nish/browser-games.md`, `docs/security/README.md`; after S2 has merged and S3 has taken in main, also the opt-out lines S2 left in `examples/break-web/game.ts`, `examples/break-web/build.mjs` and `examples/term-probe.ts`.

**Model:** lead.

**Runs with:** S1 and S2 in parallel. Merges last.

## Running the stages together (refined for `/feature`)

The three stages are written at once and merge in order S1 → S2 → S3.

- **Shared-row files.** `tests/std-panics.json`, `bench/instructions.json`, `tests/nish-cmp.js`, the three guide pages and `docs/security/README.md` are in every stage's Owns, because each stage must write its own modules' rows there. A stage edits only the rows, entries and guide sections that name its own modules and examples. The stage that merges later takes in main before it merges and resolves the conflict in those rows; nothing else is shared.
- **Generated files** (regenerated with the repo's tooling, never hand-merged, in any stage): `tests/self/goldens/checked/**`, `docs/reference/**`, `scalar.config.json`, `tests/differential/goldens/**`, `docs/IR_COOKBOOK.md`, `tests/wordings/*.err`, `tests/link/*/expected.caps.json`, `docs/reference/diagnostics/**`, `examples/break-web/help.ts`, `docs/site/break/**`.
- **Exports another stage calls keep their signatures.** `std/host/game.ts` (S1) and `std/term-pixels.ts`, `std/term-io.ts`, `std/term-rate.ts`, `std/term-probe.ts` (S2) import `nish/term` (S3); `examples/game-starter` (S3) imports `nish/raster` and `nish/synth` (S1). A stage does not change the signature of an export whose callers sit outside its Owns. Where a site's only honest fix is such a change, the site stays, counted, and the PR body lists it as a follow-up.
- **A wrapping cast or a mask is not a proof** unless the value is modular by meaning (a hash, a PRNG step, a checksum). Do not remove an overflow site by rewriting a checked sum as `toI32(toU32(a) + toU32(b))` or by masking a value the code expects to stay in range: whether that idiom counts is the open question in #2219. Such a site stays, counted, and the PR body lists it.

## Acceptance criteria

Derived from the plan's goals and rules, not given separately.

1. On main after the last merge, `node tests/run.js std-panics` passes and every one of the ten modules' counts in `tests/std-panics.json` is lower than at 071ed014 (462 sites in all); each site that remains is listed in a PR body with its reason.
2. `examples/game-starter/game.ts`, `examples/break-web/game.ts` and `examples/term-probe.ts` carry no `--allow-panics` opt-out (header comment or `// smoke: args`) and build without it; `node tests/run.js performance` (the stale opt-out check) passes.
3. The five explicit panics in `std/term.ts` (`KeyDecoder.keep`, `Screen.flush`, `termBytesText`, `termDecodeEvents`, `termDecodeKeys`) are gone, and a test shows what each now does on the input that used to reach it.
4. `bench/instructions.json` counts a term frame render and flush, a raster fill and blit, and a synth buffer fill, baselined from CI's table before any site changed; no count in it rose across the run's merges.
5. No `nish:unsafe` import and no made-up-value guard was added to the ten modules, and no site was removed by a wrapping cast or mask the compiler did not prove.
6. `node tests/run.js term` and the `std_term*`, `std_raster`, `std_synth`, `std_host_*` and `break_*` link cases pass on main.
7. The guide no longer says these modules keep panic sites where they no longer do, and states every changed public API; `node scripts/gen-reference.mjs --check` passes.
8. CI is green on main after the last merge, and every nish-cmp IR move the run caused is declared.
