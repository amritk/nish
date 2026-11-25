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

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

## Acceptance

Checked against `main` after the last merge.

1. `tests/std-panics.json` on `main` gives `std/temporal.ts`, `std/math.ts`, `std/base64.ts`, `std/random.ts`, `std/regex.ts`, `std/release.ts`, `std/sqlite.ts`, `std/testing.ts` and `std/text.ts` no to-fix count (each is absent or zero, and any site left is on the `kept` list with its reason), and `node tests/run.js std-panics` passes there.
2. No file of those nine imports `nish:unsafe` on `main`, and the diff from the run's base adds no `if (i < len) … else <constant>` guard that stands in for a failure: every removed site is a proof, a Result, or a restructure the PR body names.
3. `bench/instructions.json` on `main` lists counted std programs for temporal date arithmetic, a temporal format, a temporal parse, a base64 encode and a math kernel, each with a `STD_COUNTED` row in `bench/run.mjs`, and S1's PR body shows their CI-table baseline taken before any temporal site changed.
4. No program present in `bench/instructions.json` at the run's base has a higher count on `main`, and every new or lowered count matches a CI runner table quoted in a PR body.
5. Temporal input that overflows or does not parse returns an error Result: a `tests/link` case passes an out-of-range date and a malformed date string to the changed API and its `expected.out` shows the error branch taken, with exit 0.
6. `node tests/run.js performance` passes on `main` (no stale opt-out), and no example or guide page keeps an `--allow-panics` opt-out whose only reason is a site in the nine modules.
7. Every export whose signature changed is documented as changed on its `docs/guide/` page and in `docs/reference/` (`node scripts/gen-reference.mjs --check` passes).
8. Each stage's merge commit had `ci-gate` green, and `node tests/nish-cmp.js` passes on `main`.
9. S2's PR body lists every module still non-zero in `tests/std-panics.json` with its owning package, or says there is none.

## Stages

### S1 — temporal

temporal.ts is cleared; the arithmetic and format benches land first and are baselined.

Sites as of 071ed014 (260): temporal 260. Kinds: overflow 240, index 9, slice 7, divide 3, panic 1.

**Owns:** `std/temporal.ts`, `tests/std-panics.json`, `bench/instructions.json`, `bench/run.mjs` (its `STD_COUNTED` rows), `bench/README.md`, new `bench/std-temporal*`, `bench/std-base64*` and `bench/std-math*` programs and their `.args`, `bench/temporal.ts`, `tests/nish-cmp.js`, `tests/link/std_temporal/**`, new `tests/link/std_temporal_*` cases, `tests/run.js` (the temporal and std-panics checks only), `docs/guide/using-nish/dates-and-times.md`, `docs/guide/using-nish/standard-library.md`, `std/README.md`, the examples whose only opt-out reason is a temporal site, and the generated files: `tests/self/goldens/checked/**`, `docs/reference/**`, `docs/IR_COOKBOOK.md`, pinned `std/temporal.ts:LINE:COL` quotes in `tests/link/*/expected.*`, `tests/wordings/*.err`.

**Depends on:** none. Merges first.

**Benches before fixes.** The `s1-bench` commit lands on the branch, and CI's instructions table for it is recorded in the PR body, before any commit changes a site. The base64 and math programs are added here so S2 inherits a baseline.

### S2 — math, base64, random, regex, release, sqlite, testing and text

The remaining modules are cleared, so every module in tests/std-panics.json reads zero and the baseline holds only the kept list.

Sites as of 071ed014 (131): math 48, base64 25, random 5, regex 2, release 20, sqlite 22, testing 6, text 3. Kinds: overflow 67, index 23, slice 13, panic 8, ffi-nul 7, ffi-null 6, divide 4, array-length 3.

**Owns:** `std/math.ts`, `std/base64.ts`, `std/random.ts`, `std/regex.ts`, `std/release.ts`, `std/sqlite.ts`, `std/testing.ts`, `std/text.ts`, `tests/std-panics.json`, `bench/instructions.json`, `bench/run.mjs` (its `STD_COUNTED` rows), the `bench/std-base64*`, `bench/std-math*` programs and any new `bench/std-{random,regex,release,sqlite,text}*` programs with their `.args`, `tests/nish-cmp.js`, `tests/link/std_{math,base64,random,regex,release,sqlite,testing,text}*/**` and new cases of that shape, `tests/run.js` (the std-panics check and the checks of these modules only), the `docs/guide/` pages that document these modules, the examples whose only opt-out reason is a site in these modules, and the same generated files as S1 with pinned `std/<these files>.ts:LINE:COL` quotes.

**Depends on:** s1-temporal, for development and merge: both write the same rows of `tests/std-panics.json`, `bench/instructions.json` and `tests/nish-cmp.js`, and S2's base64 and math benches are S1's baselines. S2 starts from `main` after S1 merges.

**Signatures that other packages call.** `std/testing.ts`, `std/text.ts`, `std/random.ts` and `std/base64.ts` are imported by `std/net/**`, `std/crypto/**`, `std/json*` and many `tests/link` cases that WP82, WP83 and WP86 own while they run. S2 keeps the signature of any export whose callers sit in a file this stage does not own: such a site gets a proof, or a new Result-returning export beside the old one, never an edit to another package's file. A site that can be neither is left, recorded in the PR body with its reason, and escalated.

**The final check reads what is there.** `s2-final` lists every module still non-zero in `tests/std-panics.json` and, for each one outside this stage's eight, the package that owns it (WP82, WP83, WP86 or another). It does not fix them; the goal's "every module reads zero" holds once those packages merge.
