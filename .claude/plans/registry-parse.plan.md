---
name: One registry parse, not three
overview: Close issue 96 — extract the diagnostic-registry reader into one shared, indentation-agnostic module that throws on an empty parse, repoint its three copies at it, and give parity.js flagsOf the empty guard it is missing.
stages:
  - id: registry-reader
    title: One shared registry reader
    goal: The fragment-plus-code parse over codes.ts exists once, is indentation-agnostic, and throws rather than returning empty.
    verification: node scripts/gen-diagnostic-codes.mjs --check exits 0, npm test is green and undegraded, and a reindented copy of src/codes.ts still parses 407 pairs
    status: pending
    todos:
      - id: reader-module
        content: Add the shared reader module exporting a codes-registry parse — see One shared registry reader
        status: pending
      - id: repoint-generator
        content: Repoint the existing() parse in scripts/gen-diagnostic-codes.mjs at the shared reader — see The generator is the live defect
        status: pending
      - id: repoint-coverage-and-run
        content: Repoint tests/diagnostic_coverage.js and the pairsOf helper in tests/run.js at the same reader — see The two already-fixed copies
        status: pending
      - id: reader-negative-test
        content: Pin the guard with a negative check that an empty parse fails — see Tests
        status: pending
  - id: flags-guard
    title: An empty flag set is a failure, not a pass
    goal: flagsOf in parity.js can no longer report two empty flag sets as agreement.
    verification: node tests/self/parity.js --flags-only exits 0 on the real compilers and fails when either help text parses to no flags
    status: pending
    todos:
      - id: flags-empty-guard
        content: Make an empty flag set from either compiler a failure in tests/self/parity.js — see An empty flag set is a failure
        status: pending
      - id: flags-negative-test
        content: Demonstrate the guard firing on a help text that parses to nothing — see Tests
        status: pending
---

## Context

[issue #96](https://github.com/amritk/nish/issues/96) records two instances of one defect — a parse keyed on a fixed indentation with no guard on an empty result — and names the fix as one shared reader.

Four readers parse the diagnostic registry out of [`src/codes.ts`](../../src/codes.ts). Three have been repaired one at a time; the fourth has not:

| Reader | Pattern | Empty guard | State |
| --- | --- | --- | --- |
| [`tests/run.js`](../../tests/run.js) `pairsOf` (line 735) | `^\s+` | `stage0Codes.length > 0` in the check | fixed, with the trap documented above it |
| [`tests/diagnostic_coverage.js`](../../tests/diagnostic_coverage.js) (line 109) | `^\s+` | throws at line 113 | fixed by #95 |
| [`scripts/gen-diagnostic-codes.mjs`](../../scripts/gen-diagnostic-codes.mjs) `existing()` (line 150) | `^ {4}` | none | **the live defect** |
| [`tests/self/parity.js`](../../tests/self/parity.js) `flagsOf` (line 500) | `^ {2}` over `--help` | none | **the live defect, different grammar** |

Measured on this checkout: `^ {4}` matches 407 pairs in `src/codes.ts` and **0** in `self/codes.ts`, which lost an indentation level when WP22 stage C rewrote its tables as arrows. `^\s+` matches 407 in both.

## Approach

Two separate fixes, because the two defects share a shape but not a grammar.

The three registry readers parse the same thing and become **one module**. `existing()` reads only `src/codes.ts` today, so this is not a behaviour change on the current tree — it is the removal of the condition under which a reindent silently renumbers every published diagnostic code.

`flagsOf` parses `--help` output, not a codes table. It gets **the guard only**. Relaxing its indentation would be a regression: the `^ {2}` is load-bearing, and the comment above it says so — continuations are indented further and must not match, or a flag named in a description gets counted as a flag. Do not generalise this one into the shared reader.

The repo is `"type": "module"` throughout, so one ESM module imports cleanly into both `scripts/` and `tests/`.

## One shared registry reader

One module, exporting one function that takes a path and returns the fragment-to-code pairs. It must:

- match with `^\s+` on both lines of the pair, so indentation is not part of the contract
- **throw** when it parses nothing, so an empty registry can never read as a covered one

```js
// pairs of [fragment, code], in file order
export const readCodesRegistry = (file) => { /* ^\s+ parse; throw when empty */ };
```

The module lands at `tests/self/codes-registry.js` — beside [`tests/self/corpus.js`](../../tests/self/corpus.js), which is where issue 96 puts it. The location is pinned rather than left open so this stage's file set stays disjoint from the other's. The binding constraint is that all three callers import the same one and no fourth copy of the regex survives in the repo.

**Owns:** `tests/self/codes-registry.js`, `scripts/gen-diagnostic-codes.mjs`, `tests/diagnostic_coverage.js`, `tests/run.js`

### The generator is the live defect

`existing()` in [`scripts/gen-diagnostic-codes.mjs`](../../scripts/gen-diagnostic-codes.mjs) keeps the promise that a code never moves. If its parse ever returns empty, `assigned` is empty, the per-band watermark is lost, and a regeneration renumbers every code.

The hazard is one step past `--check`, and the issue corrects an earlier mis-statement of it: `--check` builds in memory and compares against disk (lines 381-391), so a renumber under `--check` goes **red**. The damage is that the remedy a red `--check` prints is to run the generator, and a human doing that without `--check` renumbers silently.

### The two already-fixed copies

`pairsOf` and the `diagnostic_coverage.js` parse already have the right pattern and their own guards. Repoint them anyway — three copies is how the first two drifted apart, and leaving two correct copies preserves the mechanism. Keep each caller's existing failure behaviour intact where it is stronger than the module's throw.

## An empty flag set is a failure

`flagSetDifferences` compares two sets. If both parse to empty it finds no difference and reports agreement, so "the two compilers accept the same flags" and "neither compiler was parsed" are indistinguishable — the exact indistinguishability #95 removed from `diagnostic_coverage.js`.

Line 620 already fails when either `--help` exits non-zero, so this is the milder of the two defects. It still runs in **every** `npm test` via [`tests/run.js`](../../tests/run.js) line 4793.

Make an empty set from either side a failure. Leave the `^ {2}` option-line pattern and the permissive usage-line fallback exactly as they are.

**Owns:** `tests/self/parity.js`

## Out of scope

- **`src/codes.ts` and `self/codes.ts` are not edited.** Both are read, neither is written. Run wp15-remainder is adding `NL9010` to both; this run must not touch them.
- **`tests/cases/`, `tests/wordings/`, `docs/LANGUAGE.md`** — also held by that run.
- The two other fixed-indent parses in `tests/run.js` (lines 3885 and 5296) are a different shape over different input and are not in issue 96.
- No renumbering, no registry regeneration, no new diagnostic codes.

## Tests

This adds no language construct, so the golden-`.ll` half of the definition of done does not apply. What it does need is the negative half — each guard demonstrated firing, in the style #95 set when it made an empty registry throw.

- **Registry reader** — a reindented copy of `src/codes.ts` still yields 407 pairs, and a file the pattern cannot match raises rather than returning an empty map.
- **flagsOf** — help text that parses to no flags fails the flag-set comparison instead of passing it.

Each demonstration lives inside the stage that owns its file, so the two stages stay disjoint — the registry one with the `codes:` checks already in [`tests/run.js`](../../tests/run.js) at lines 719-750, the flag one inside [`tests/self/parity.js`](../../tests/self/parity.js), which is a standalone script with its own `--flags-only` entry point.

## Verification

```
npm run check
node scripts/gen-diagnostic-codes.mjs --check
node tests/self/parity.js --flags-only
npm test
npm run lint
```

`npm test` must be green **and undegraded** — read the skip count, not just the exit code. The base records 1976 passed, 0 failed, 2 skipped.
