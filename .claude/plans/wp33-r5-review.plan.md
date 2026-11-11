---
name: WP33 R5 — the `review` tier of `fix` in `--json`
overview: Finish R5 (docs/wp33-round-trip.md §5.1). A class-C portability warning whose site has a one-token rewrite that makes both readings agree carries that rewrite under a new `--json` key, `review`, beside the existing exact-only `fix`. `nish --fix` keeps applying only `fix`; the review edits are applied by the agent and checked at the site (no new CLI flag, decided at sign-off). A rewrite qualifies only if the fixed program's native IR is byte-identical to the original's, so the review tier moves the TypeScript reading and never the native one (§1 rule 6). R6 (WP28 compat mode) and the Bun adapter are out of scope.
stages:
  - id: review
    title: "feat(cli): the `review` tier of `fix` in `--json` (WP33 R5)"
    goal: "`--warn-portability --json` prints a `review` list of edits on every NL8006, NL8007 and NL8008 site whose rewrite compiles to the same IR, `fix` stays exact-only, `nish --fix` still applies only `fix`, and the contract is documented in AI.md, LANGUAGE.md, the guide, the design note and the roadmap."
    verification: npm run check && npm run lint && node tests/run.js fix && node tests/run.js port && node tests/run.js json && node tests/run.js wordings && node tests/run.js cli && node tests/run.js emit-ts && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi (skip line read) && node tests/self/goldens.js && node tests/differential/goldens.js && node tests/nish-cmp.js && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    status: pending
    todos:
      - id: contract
        content: "Add the `review` key to `Diagnostic.json()` in src/diagnostics.ts: the same edit-list shape as `fix`, printed after `fix` (so a line with neither prints exactly as today), present only when the diagnostic carries review edits; a reporter `reportPortabilityReview` beside `reportPortability`'s fix variant — see Contract"
        status: pending
      - id: applier
        content: "`nish --fix` never applies a `review` edit and no new flag is added (sign-off); make sure src/fix.ts reads only `fix` edits — see Applier"
        status: pending
      - id: rows
        content: "Attach review edits in src/portability-numbers.ts: NL8006 `a / b` on an integer type → `Math.trunc(a / b)` (and `/=`), NL8008 `x >>> k` → `(x >>> k) | 0`, NL8007 `u8`/`u16`/`u32` arithmetic → the mask (`& 0xff`, `& 0xffff`) or `>>> 0` for `u32`. A row whose rewrite does not compile, warns again, or changes the IR gets no review edit, with the reason in LANGUAGE.md's row — see Rows"
        status: pending
      - id: tests
        content: "tests/fix/: one `<case>.ts` + `<case>.reviewed.ts` pair per row and spelling (the reviewed file is the original with the review edits applied), a harness check that the reviewed file compiles with that warning gone and its `.ll` byte-identical to the original's, `nofix` cases for the sites that get none, and a pin that `nish --fix` leaves a review-only file unchanged — see Tests"
        status: pending
      - id: docs
        content: "AI.md's loop (`review` beside `fix`, how an agent applies and checks one), LANGUAGE.md's portability table and `--json` contract, the user-guide page for `--json`/`--fix`, docs/wp33-round-trip.md §5.1 and §9 (R5 built), docs/roadmap/wp33-round-trip.md (tick R5 review, Next → R6 waits on WP28) and docs/roadmap/index.md — see Docs"
        status: pending
---

# WP33 R5 — the `review` tier

Design source: `docs/wp33-round-trip.md` §2 (the four classes), §5.1 (fixes in
`--json`), §5.2 (the portability class) and §7 Q5. The `exact` tier shipped in
#421 as `"fix":[edits]` with no `safety` key; §5.1 says the review tier "would
need a key of its own, which is a change to the `--json` contract". This stage
is that key, and the first rows that carry it.

## Stage `review`

Owns: `src/**`, `tests/**`, `docs/**`, `scalar.config.json`, `.claude/*.md`,
`AGENTS.md`

Model: lead

### Contract

- Signed off: the key is `review`, a sibling of `fix`, with the same edit
  shape, printed after `fix`. `fix` keeps its
  meaning exactly: every edit in it is safe to apply blind. A consumer that
  applies `fix` and ignores unknown keys never applies a review edit.
- A diagnostic may carry `fix`, `review`, both, or neither; in practice a
  portability warning carries at most `review`.
- Every existing `--json` line is byte-identical (the `json` and `fix` tests
  pin it).
- The key is part of the machine-readable contract (orientation rule 7):
  document it wherever `fix` is documented.

### Applier

Signed off: report only. `nish --fix` keeps applying `fix` only, and no flag
applies review edits; the agent applies them from `--json` and checks each
site, as AI.md says. `--help` and the CLI surface do not change.

### Rows

A review edit makes a class-C site class A: both readings then print the same
thing, and the native reading is the one kept. It is `review`, not `exact`,
because TypeScript code coming in may have meant TypeScript's reading — the
agent confirms Nish's meaning was intended.

The qualifying test for every row is mechanical: the fixed program compiles,
the warning is gone, and its `.ll` is byte-identical to the original's. A row
or spelling that fails it ships with no review edit, and LANGUAGE.md's row
says why. Candidates:

| Row | Site | Review edit |
| --- | --- | --- |
| NL8006 | `a / b`, `a /= b` on an integer type | `Math.trunc(a / b)`, `a = Math.trunc(a / b)` (or no edit for `/=` if the expansion double-evaluates `a`) |
| NL8008 | `x >>> k` with an `i32` result | `(x >>> k) \| 0` |
| NL8007 | `+ - *` (and `op=`, `++`, `--`) on `u8`/`u16`/`u32` | `(…) & 0xff`, `(…) & 0xffff`, `(…) >>> 0`; `++`/`--`/`op=` only where the expansion is single-evaluation |

NL8001, NL8002, NL8003, NL8004, NL8005, NL8009 and NL8012 get no review edit
in this stage: none has a local rewrite that keeps the IR. Record that in the
design note's §5.1.

Parenthesisation must be correct for every operator context the site can
appear in (`a / b * c`, `-(a / b)`, a call argument); test each.

### Tests

Extend `tests/fix/` and its harness (README.md states the conventions) with a
reviewed-file convention. Each positive case shows the exact LLVM IR before
and after in the PR body, per CLAUDE.md. Pin the `--json` line of one site per
row in the `json` section. A `nofix` case per declined spelling.

### Docs

AI.md, LANGUAGE.md (portability table + `--json`), the guide page that
documents `--json`/`--fix` (`docs/guide/`), `docs/wp33-round-trip.md` §5.1/§9,
the roadmap page and index. Regenerate `tests/self/goldens/checked/` and
`docs/reference/` if they move; nish-cmp `DECLARED` entries only if an IR
moves (it should not).

## Out of scope

R6 (WP28 compatibility mode, which WP28 itself has not accepted) and the Bun
adapter (deferred in §4.3). The roadmap's **Next** moves to R6 with a note
that it waits on WP28's decision.
