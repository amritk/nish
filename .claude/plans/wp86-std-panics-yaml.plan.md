---
name: WP86 — std panic-free for YAML and the JSON helpers
overview: The YAML modules and the JSON helpers S1 of std-panic-free does not fix hold 398 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (json-equal 6, json-value 3, json-number 1, json-tokenizer 1, yaml-lines 12, yaml-write 14, yaml-json 57, yaml 304); yaml.ts alone has 275 overflow sites in the scanner. This package removes or proves them - a malformed document is a Result with a position, never a panic. Its first todo adds a YAML parse instruction-count bench, baselined before any site changes; no PR may raise a count.
priority: 230
labels: [ready]
issue: 2158
stages:
  - id: s1-small
    title: WP86 S1 — the JSON helpers, yaml-lines, yaml-write and yaml-json
    goal: The JSON helper and YAML front-end sites are cleared; the YAML parse bench lands first and is baselined.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js json && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2159
    todos:
      - id: s1-bench
        content: Add instruction-count programs to bench/instructions.json (see bench/README.md, Instruction counts, and bench/run.mjs) that call the functions this package changes - a YAML parse of a fixed document, a YAML to JSON conversion, a json equality compare; baseline them on CI's runner before any site is changed, and take every count from CI's table, never a local run — see WP86 S1
        status: pending
      - id: s1-fix
        content: Remove or prove every site in std/json-equal.ts, std/json-value.ts, std/json-number.ts, std/json-tokenizer.ts, std/yaml-lines.ts, std/yaml-write.ts, std/yaml-json.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP86 S1
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP86 S1
        status: pending
      - id: s1-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP86 S1
        status: pending
  - id: s2-yaml
    title: WP86 S2 — the YAML parser
    goal: yaml.ts is cleared without raising the parse count.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js yaml && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2160
    todos:
      - id: s2-fix
        content: Remove or prove every site in std/yaml.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP86 S2
        status: pending
      - id: s2-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP86 S2
        status: pending
      - id: s2-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP86 S2
        status: pending
---

# WP86 — std panic-free for YAML and the JSON helpers

## Context

The YAML modules and the JSON helpers S1 of std-panic-free does not fix hold 398 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (json-equal 6, json-value 3, json-number 1, json-tokenizer 1, yaml-lines 12, yaml-write 14, yaml-json 57, yaml 304); yaml.ts alone has 275 overflow sites in the scanner. This package removes or proves them: a malformed document is a Result with a position, never a panic. Its first todo adds a YAML parse instruction-count bench, baselined before any site changes; no PR may raise a count.

Examples unblocked: none named.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

## Stages

### S1 — the JSON helpers, yaml-lines, yaml-write and yaml-json

The JSON helper and YAML front-end sites are cleared; the YAML parse bench lands first and is baselined.

Sites as of 071ed014 (94): json-equal 6, json-value 3, json-number 1, json-tokenizer 1, yaml-lines 12, yaml-write 14, yaml-json 57. Kinds: overflow 64, index 22, slice 5, pop 2, array-length 1.

### S2 — the YAML parser

yaml.ts is cleared without raising the parse count.

Sites as of 071ed014 (304): yaml 304. Kinds: overflow 275, array-length 13, index 12, slice 3, panic 1.
