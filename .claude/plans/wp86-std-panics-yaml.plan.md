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

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason. A wrap is spelled, never cast (owner's rule; `CLAUDE.md`, "A wrap is spelled, never cast"): no site is cleared by casting `i32` or `i64` arithmetic through `u32` or `u64` so that it wraps (`toI32(toU32(a) + toU32(b))`). Where the wrap would hide an overflow, prove the bound or return a Result. Where wrapping is the algorithm's answer (a hash multiply, a counter mod 2^32), write `wrappingAdd`, `wrappingSub` or `wrappingMul` from `nish:unsafe`, the one `nish:unsafe` use this rule allows, so every deliberate wrap is greppable. A value that is `u32` or `u64` all the way through wraps by its type and needs neither. The owner's ruling on #2158 (from the #2219 decision): a u32-cast wrapping sum, or a mask no wider than an assumed maximum, does **not** count as a proof. Where `src/bounds.ts` cannot prove a sum in range, return a Result (the owner's stated preference) or add a bound the prover checks. A silent loop cap or truncation is a made-up value too.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

## Stages

### S1 — the JSON helpers, yaml-lines, yaml-write and yaml-json

The JSON helper and YAML front-end sites are cleared; the YAML parse bench lands first and is baselined.

Sites as of 071ed014 (94): json-equal 6, json-value 3, json-number 1, json-tokenizer 1, yaml-lines 12, yaml-write 14, yaml-json 57. Kinds: overflow 64, index 22, slice 5, pop 2, array-length 1.

Sites at 1629b1de, read from [`tests/std-panics.json`](../../tests/std-panics.json) (90): json-equal 6 (index 4, pop 2), json-value 1 (array-length 1), json-number 0, json-tokenizer 1 (slice 1), yaml-lines 12 (overflow), yaml-write 13 (overflow), yaml-json 57 (index 18, overflow 39). The stage starts from the figures at its base.

**Owns:** `std/json-equal.ts`, `std/json-value.ts`, `std/json-number.ts`, `std/json-tokenizer.ts`, `std/yaml-lines.ts`, `std/yaml-write.ts`, `std/yaml-json.ts`; the new bench programs (`bench/yaml-parse/**`, `bench/yaml-json/**`, `bench/json-equal/**`, or the names `bench/README.md`'s convention gives) and their rows and lowered rows in `bench/instructions.json`, with `bench/README.md`'s program count; these modules' rows in `tests/std-panics.json` and `scripts/wrap-casts.txt`; its entries in `tests/nish-cmp.js`; json and yaml-json checks in `tests/run.js`; `tests/link/std_json*/**`, `tests/link/std_yaml_json*/**`, `tests/link/std_yaml_write*/**`; the pinned `std/<these files>.ts:LINE:COL` wherever they are (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`); the json-equal, json-value, yaml-json and yaml-write sections of `docs/guide/using-nish/standard-library.md` with their `allow-panics` markers; and the regenerated `docs/reference/**`, `tests/self/goldens/checked/**`, `tests/differential/goldens/**`.

**Cast wraps in these files.** `scripts/wrap-casts.txt` lists 29 cast wraps in `std/json-value.ts`, 2 in `std/json-number.ts` and 1 in `std/json-tokenizer.ts` from before the rule. WP84 S3 left them to WP85–WP87 under the owner's #2219 decision, and these files are this stage's. Each one becomes a proven sum, a Result, or a `wrappingAdd`, `wrappingSub` or `wrappingMul` where the wrap is the algorithm's answer. Their rows in `scripts/wrap-casts.txt` fall to 0 (`node scripts/wrap-casts.mjs --update`). The PR body has an inventory table: site, kind, whether input reaches it, and what replaced it.

**Bench first.** The first commit adds the bench programs and nothing else. CI's runner prints their counts, which become the baseline in a second commit before any `std/` site changes. A YAML parse of a fixed document drives `parseYaml` in `std/yaml.ts`, so S2 is gated on it too.

### S2 — the YAML parser

yaml.ts is cleared without raising the parse count.

Sites as of 071ed014 (304): yaml 304. Kinds: overflow 275, array-length 13, index 12, slice 3, panic 1.

Sites at 1629b1de (294): overflow 275, index 12, array-length 3, slice 3, panic 1. The panic is `parseYamlWith`'s `maxDepth` check, on the kept list in `tests/std-panics.json` with its reason; it stays.

**Owns:** `std/yaml.ts`; `std/yaml-json.ts` only to follow a changed `std/yaml.ts` export, and only after syncing S1's merge; `std/yaml.ts`'s rows in `tests/std-panics.json`, `scripts/wrap-casts.txt` and `bench/instructions.json` (lowered only); its entries in `tests/nish-cmp.js`; yaml checks in `tests/run.js`; `tests/link/std_yaml*/**` except `std_yaml_json*` and `std_yaml_write*`; the pinned `std/yaml.ts:LINE:COL` wherever they are; the `std/yaml.ts` sections of `docs/guide/using-nish/standard-library.md` with their `allow-panics` markers; and the regenerated `docs/reference/**`, `tests/self/goldens/checked/**`, `tests/differential/goldens/**`.

**Merge order:** after S1. Development does not wait for it. S1's bench is S2's gate: S2 syncs `main` once S1 merges, and is not merged until CI's instruction table on its synced head shows no count above S1's baseline, the YAML parse count included. A shared file (`tests/std-panics.json`, `tests/nish-cmp.js`, `bench/instructions.json`, the guide page) is merged row by row; the generated files are regenerated, never hand-merged.

**Existing wraps.** `std/yaml.ts` already calls `wrappingAdd`, `wrappingSub` and `wrappingMul` (3 sites at 1629b1de). The PR body names the algorithmic reason for each, or replaces one that stands in for a bound.

## Acceptance criteria (run on #2158)

1. `tests/std-panics.json` has no row left for `std/json-equal.ts`, `std/json-value.ts`, `std/json-number.ts`, `std/json-tokenizer.ts`, `std/yaml-lines.ts`, `std/yaml-write.ts` or `std/yaml-json.ts`, and `std/yaml.ts` keeps only its kept `parseYamlWith` panic. Any site that stays is a `residual` entry with its reason, and the PR body says why no proof or Result reaches it.
2. A malformed, truncated or oversized YAML or JSON input reaching a former site answers a Result with a position, never a panic. A `tests/run.js` check or `tests/link` case per new error path fails when its guard is removed.
3. The YAML parse, YAML-to-JSON and JSON-equal instruction-count benches are in `bench/instructions.json`, baselined from CI's table before any site changed. No count in the file rose in either PR, and every lowered count came from CI's table.
4. No `nish:unsafe` beyond `wrappingAdd`, `wrappingSub` or `wrappingMul` where a wrap is the algorithm's answer, each with its reason. No made-up-value guard, silent loop cap or truncation. No u32-cast wrapping sum and no mask no wider than an assumed maximum (the owner's #2158 ruling). `scripts/wrap-casts.txt` shows 0 for every file of this package.
5. `node tests/run.js json`, `node tests/run.js yaml` and `node tests/run.js link` pass at the last merge.
6. No stale opt-out: the guide's `allow-panics` markers and sentences for these modules are gone or rewritten, and `node tests/run.js performance` passes. The guide states any changed API.
7. CI is green on `main` after the last merge, and every nish-cmp IR move is declared.
