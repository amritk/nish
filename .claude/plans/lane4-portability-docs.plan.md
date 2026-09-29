---
name: Lane 4 — portability fixes, docs debt and issue hygiene
overview: Retire NL8011 and narrow NL8008 so every portability row marks a real divergence under the reference reading, make LANGUAGE.md and wp33 describe the rows the code has, and pay down the stale doc lines and small gaps #308, #317 and #307 name, plus the wp34 status line and MASTER_PLAN §9.
stages:
  - id: port-rows
    title: "fix(checker): retire NL8011 and stop NL8008 on a constant shift"
    goal: Every live NL8 row marks a divergence the reference reading (Node plus runtime/nish.mjs) really has
    verification: npm run check && npm run lint && npm test && node scripts/gen-diagnostic-codes.mjs --check && node tests/diagnostic-coverage.js --require-coverage
    todos:
      - id: retire-nl8011
        content: Remove the NL8011 finding from src/portability-numbers.ts, keep its codes.ts entry, and record it retired in tests/wordings/unreachable.txt — see Stage port-rows
      - id: narrow-nl8008
        content: Stop NL8008 on a shift whose count is a constant k with k mod 32 not 0, with a new quiet-counterpart case — see Stage port-rows
      - id: port-goldens
        content: Update the .portability goldens of port_num_negzero, port_array_zero_fill and port_array_quiet_f64 and the stale comments, moving no .ll golden — see Stage port-rows
      - id: wordings-308
        content: Fix tests/wordings/unreachable.txt lines 55–56 (NL2045, not NL2376) and drop the empty WP33 header — see Stage port-rows
      - id: self-goldens
        content: Regenerate tests/self/goldens with the repo tooling after merging main — see Stage port-rows
  - id: port-docs
    title: "docs: make the portability rows and wp33's status match the code"
    goal: LANGUAGE.md's portability table and wp33 describe exactly the rows src/portability*.ts reports
    verification: node docs/check-links.mjs && npm run lint && npm test
    todos:
      - id: language-rows
        content: Rewrite LANGUAGE.md's portability rows (NL8001, NL8003, NL8004, NL8008, NL8010, NL8011 retired) and drop the NL8005-is-live sentence — see Stage port-docs
      - id: wp33-status
        content: Rewrite wp33's header status, §3.1 NL8011 ledger row, §5.2 example and the portability paragraph of §9 — see Stage port-docs
  - id: plan-docs
    title: "docs: mark WP34 N1, N2, N3 and N6 built and bring MASTER_PLAN §9 up to date"
    goal: The status lines of wp34 and MASTER_PLAN say what is built and what is next
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: wp34-status
        content: Rewrite wp34's status line and mark N1, N2, N3 and N6 built with their PRs, leaving N5 alone — see Stage plan-docs
      - id: master-plan-next
        content: Rewrite MASTER_PLAN §9 What remains and Next to the live work, each linking its note, and fix the 0.10.0 next-release wording — see Stage plan-docs
  - id: lang-gaps
    title: "docs(checker): pin readFileBytesSync's refusals and fix the fill and i64-literal rules"
    goal: The fill rule, readFileBytesSync's Tests column and the i64-literal rule say what the compiler does
    verification: npm run check && npm run lint && npm test && node tests/diagnostic-coverage.js --require-coverage && node docs/check-links.mjs
    todos:
      - id: fill-infinity
        content: Replace Infinity in LANGUAGE.md's fill rule with a form Nish compiles — see Stage lang-gaps
      - id: bytes-read-rejects
        content: Add tests/cases/reject_bytes_read_arity and reject_bytes_read_type and list them in the rule's Tests column — see Stage lang-gaps
      - id: i64-min-doc
        content: Document in LANGUAGE.md's literal rule why the i64 minimum is not writable as a literal and how to build it — see Stage lang-gaps
---

## Context

The portability-warnings run (#280) failed acceptance on two points, filed as #309: NL8011 ("prints a negative zero as 0 here, and Node's console prints -0") marks no divergence under the reference reading, because `runtime/nish.mjs` replaces `console.log`/`console.error` with shims that print `String(x)`, so `-0` prints `0` in both; and the docs still describe only NL8005. #309 also notes NL8008 fires on any `>>>` with an `i32` result, where only a count of 0 (mod 32) can diverge. Earlier runs left small doc gaps (#308, #317) and an open decision (#307). This run pays that down. Codes: none new; warning bands are gap-free.

## Approach — decisions

- **NL8011 is retired, not narrowed.** Every site it could name prints through `console.log`/`console.error`, which the reference reading shims to `String(x)`; `String(-0)` is `"0"`, native prints `0`. No site diverges under the reading the class is defined against. A future `--emit ts` that does not install the shim is the only reading where it would, and that output does not exist yet (wp33 §4); if it lands without the shim, it can revive the row under a new code. Retirement per the registry: the fragment/code pair stays in `portabilityRules` (it matches nothing), the number stays reserved, the band stays gap-free, and `tests/wordings/unreachable.txt` gets an `NL8011  retired: …` line.
- **NL8008 is quiet for a constant count k with k & 31 ≠ 0.** `x >>> k` for such k is at most 2^31−1, so it reads back the same signed and unsigned. Counts that are a constant 0 mod 32, or not constant, keep the warning.
- **#307 is decided as "document, don't widen".** A numeric literal is read as a double, as TypeScript reads it, and the 2^53 bound is what keeps every literal exact in both readings. Admitting `-9223372036854775808` would add a one-value exception to that rule, and the value is not exact as an i64 in the TypeScript reading anyway (NL8009). So LANGUAGE.md says why and shows the arithmetic form; `negatedLiteral` in `src/emit-ops.ts` stays correct for every literal the checker accepts. This needs no `src/lexer.ts` or `src/parser.ts` change.

## Stage port-rows

**Owns:** `src/portability.ts`, `src/portability-numbers.ts`, `src/portability-strings.ts`, `src/portability-records.ts`, `src/codes.ts` (comments of `portabilityRules` only — the NL8011 pair stays), `tests/cases/port_*`, `tests/wordings/nl80*`, `tests/wordings/unreachable.txt`, `tests/self/goldens/**`.

- In [`src/portability-numbers.ts`](../../src/portability-numbers.ts) remove the `console.log` / `console.error` branch that emits NL8011 and its helper, and fix the file header and the `// ---- NL8010, NL8011` banner. Fix the family list in [`src/portability.ts`](../../src/portability.ts)'s header ("`-0` printed").
- In the NL8008 predicate, read the count's folded constant from `walk.program.nodeConstants` (or a literal) and skip when it is an integer k with `k & 31` not 0. Add `tests/cases/port_num_ushr_const_quiet` (`.ts`, `.ll`, `.out`, empty `.portability`) with e.g. `-16 >>> 2`, a named `const K = 5` shift and a parenthesised count, and keep `>>> 0` warning in `port_num_ushr`. Do not edit an existing case's `.ts` — that would move its `.ll`.
- NL8011's quiet counterpart is `port_num_negzero` itself: its `.portability` loses its three NL8011 lines. Update `port_array_zero_fill.portability` and `port_array_quiet_f64.portability` the same way, and the comments in those cases that describe NL8011 (a comment change in a `.ts` must not move its `.ll`: check `git diff --stat tests/cases/*.ll` is empty; if it would move, leave the comment and say so in the PR).
- Delete `tests/wordings/nl8011_float_log.ts`; add `NL8011  retired: …` to `tests/wordings/unreachable.txt` beside the other retired lines, and drop the empty "Not live yet: WP33 R1's portability rows" header block (lines ~144–150). Fix lines 55–56 (#308 item 2): importing a non-exported enum or alias is NL2045, not NL2376.
- `src/codes.ts`: keep the NL8011 pair; update the `portabilityRules` comment so it says retired rows keep their entry, not that `unreachable.txt` names rows "not live yet".
- Merge `main`, `npm run build`, `node tests/self/goldens.js --update`; never hand-merge a generated file.

## Stage port-docs

**Owns:** the portability section of [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) (the portability rows table and the "NL8005 is live" sentence, around lines 5080–5100), [`docs/wp33-round-trip.md`](../../docs/wp33-round-trip.md) (header status lines 1–10, §3.1's NL8011 row, §5.2, and the portability paragraph of §9 — **not** the parser paragraph, which is lane 1's).

Merge order: after port-rows. Develop against the plan's decisions; before opening the PR, fetch `origin/feature/lane4-portability-docs/port-rows` (or `main` once it merged) and check `build/nish --warn-portability` on every `tests/cases/port_*.ts` against the rows, row for row.

- LANGUAGE.md rows: NL8001 — the full predicate from #304's PR body (comparison or arithmetic with a literal offset, e.g. `width - s.length`; the 0/−1 and ≥128 thresholds; printing, storing, `main`'s return). NL8003/NL8004 — the predicates, covered/not-covered and known-conservative spots from #302's PR body. NL8008 — only a count that is not a constant non-zero (mod 32). NL8010 — native already rounds a half towards +∞ (`2.5→3`, `-2.5→-2`); only the `-0` result differs (`Math.round(-0.4)`), plus the NaN rule of `min`/`max`. NL8011 — marked retired, with the reason. Replace the "NL8005 is live; the other rows are registered…" sentence.
- wp33: the header (lines 3–4) marks R1's second half built (#293, #301, #302, #304, and this run's PR); §3.1 moves the `-0` printing row out of class C with the reason (the reference runtime prints `String(x)`); §5.2's example no longer flags `const width = name.length;` alone — use a site NL8001 does report; §9's portability paragraph says all rows are live except the retired NL8011.

## Stage plan-docs

**Owns:** [`docs/wp34-hosting-cs.md`](../../docs/wp34-hosting-cs.md) (status line and the N1, N2, N3, N6 sections and §5a — never N5), [`docs/MASTER_PLAN.md`](../../docs/MASTER_PLAN.md).

- wp34 lines 3–4: K1, K4, N1 (#296, #300), N2 (#295), N3 (#312) and N6 (#310) have landed; N5 and the rest are not built. Each of N1/N2/N3/N6 has a `**State.** Done in #…` line naming its PRs (N1 currently says only "Done").
- MASTER_PLAN §9 (line ~755 on): "What remains" / "Next" drop threads P1/P2, ranged integers and Map/Set (shipped) and list the live work, each linking its note — WP34 wave 1 (N5; K2/K3/K5/K6) → `docs/wp34-hosting-cs.md`, WP33 R2–R4 → `docs/wp33-round-trip.md`, threads P3 → its wp note (find which; `docs/wp29-thread-surface.md` or `docs/wp20-threads.md`). Replace "0.10.0, the next release" wording with what is true now (0.14.0 is the pending release, #303) — or phrase it so it does not go stale. Verify each shipped claim against `CHANGELOG.md`.

## Stage lang-gaps

**Owns:** in [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) the `fill` rule, the `readFileBytesSync` rule's Tests column, and the integer-literal paragraph (lines ~420–440); `tests/cases/reject_bytes_read_arity.*`, `tests/cases/reject_bytes_read_type.*`.

Merge order: after port-docs (same file, different sections).

- `fill`: replace `a.fill(v, 0, Infinity)` with an omitted `end` (or `1 / 0` if the rule wants to say an infinite end clamps) — the example must compile.
- `reject_bytes_read_arity` / `reject_bytes_read_type`: negative cases with `.err` goldens pinning NL2060/NL2061 and NL2268 as `--json` gives them today; list them in the rule's Tests column. Mirror the existing N2/N3 `reject_bytes_*` cases.
- i64 minimum: after "The largest `u64` values are past 2^53 and cannot be written at all", say the same of the i64 minimum −2^63, why (the reason in Approach), and the arithmetic form (`tests/cases/neg_literal_i64_min`).

## Out of scope

`src/lexer.ts`, `src/parser.ts`, `src/validator.ts` (lane 1); the runtime and builtin tables (lane 2); `std/**` (lane 3); the member-call checker (lane 5); wp34 N5 (lane 2); wp33's parser paragraph (lane 1); NL8002 on literal receivers (#309 "also noted" — file as its own issue); any new NL8 code; any Release PR.

## Tests

port-rows: `node tests/run.js port_`, `node tests/run.js wordings`, `node tests/run.js self`, then the whole `npm test`. lang-gaps: `node tests/run.js reject_bytes`. All: `git diff --stat origin/main -- 'tests/cases/*.ll'` shows no modified `.ll` (new ones are fine).

## Verification

`npm run check`, `npm run lint`, `npm run lint:dead`, undegraded `npm test` (no `DEGRADED:` line; only the environmental skips), `node scripts/gen-diagnostic-codes.mjs --check`, `node tests/diagnostic-coverage.js --require-coverage`, and `node docs/check-links.mjs` for Markdown.
