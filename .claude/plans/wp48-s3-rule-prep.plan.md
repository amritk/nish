---
name: WP48 stage 3 prep — the compact-class rule as analysis, and `nish --explain-layout`
overview: Build §3.1's five tests of docs/wp48-ref32-classes.md as a standalone analysis module that decides, per class, whether the rule would pick it and what its layout would be both ways, and expose it as `nish --explain-layout`. No IR changes for any program; codegen is not wired (stage 3 does that once stage 2 lands). Checked against the design's three measured claims, and run over src/ and the nish-cmp corpus as stage 5's first survey data.
stages:
  - id: s1-layout-rule
    title: "feat(cli): report which classes the compact-class rule picks, with --explain-layout"
    goal: A new module computes §3.1's five tests per class plus both layouts, `nish --explain-layout` prints one line per class (picked or the refusing test, before→after bytes) and changes no byte of the IR, tree.ts/bintrees.ts TNode and sibling.ts's node are reported picked at 24→12, 16→8, 32→20, and the flag has its guide entry, CLI test and regenerated reference page.
    verification: npm run check && npm run lint && node scripts/gen-reference.mjs --check && node tests/run.js explain && node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js
    todos:
      - id: rule-module
        content: "New module (e.g. src/compact-rule.ts) evaluating §3.1's five tests per class, in order, reporting the first that refuses: (1) native output — not wasm32, and none of --emit-header / --emit-napi / --emit-napi-async / a C library; (2) some class, R included, has a field typed exactly R or R | null; (3) computeLayout run both ways (link fields to R as 4-wide 4-aligned, R's instances 4-aligned) gives R or a class holding the link a smaller rounded size; (4) some `new R(...)` lexically inside a loop, or inside a function that reaches itself in the direct-call-by-name graph scanned from parsed bodies (calls through a value are not edges); (5) R is not and is not a field of a `declare class`, holds no `Secret`, is not exported in a C or N-API surface — see S1"
        status: pending
      - id: layout-both-ways
        content: "Compute the narrowed layout without mutating the real StructInfo — the real computeLayout result, and therefore every program's IR, stays byte-identical — see S1"
        status: pending
      - id: cli-flag
        content: "`--explain-layout` on the compile and `nish run` paths, modelled on `--explain-memory`: one line per class with name, picked or the refusing test number and reason, before→after size in bytes; refused with the same usage errors --explain-memory gives (--emit-ast, --fix, --json); listed in helpText (src/cli-style.ts) and the break-web help mirror if its drift check requires it — see S1"
        status: pending
      - id: tests
        content: "CLI tests in tests/run.js: the flag changes no byte of the IR; a golden report over bench/goose/tree.ts, bench/goose/bintrees.ts and bench/wp48-refs/sibling.ts showing TNode 24→12, TNode 16→8 and sibling's node 32→20 picked; one negative case per test 1–5 showing the refusing test (e.g. --emit-header for test 1, a link-free class for 2, a wide-rounded class for 3, a class made once and one only behind a call through a value for 4, a declare class / Secret holder for 5); the usage-error refusals — see S1"
        status: pending
      - id: docs
        content: "The flag in docs/guide/using-nish/cli.md (beside --explain-memory) and a pointer from docs/guide/language/memory.md; regenerate docs/reference/ with node scripts/gen-reference.mjs; note the prep on the stage 3 line of docs/roadmap/wp48-ref32-classes.md without ticking any box — see S1"
        status: pending
      - id: survey
        content: "Run --explain-layout over src/ (the compiler's entry, native) and over every nish-cmp corpus program (tests/self/corpus.js), and put both outputs in the PR body (collapsed in <details>) as stage 5's first survey data, with a one-paragraph summary of what is picked — see S1"
        status: pending
---

# WP48 stage 3 prep — the compact-class rule as analysis

## S1 — the rule, the report, the flag

**Owns:** `src/compact-rule.ts` (new; another name is fine if it states the
same thing), `src/structs.ts`, `src/options.ts`, `src/compile.ts`,
`src/compilation.ts`, `src/cli-style.ts`, `src/codes.ts`,
`tests/run.js`, `tests/nish/cli.ts`, `tests/compat-erasure.js`,
`tests/cases/explain_layout*`, `tests/link/explain_layout*/**`,
`examples/break-web/help.ts`, `docs/guide/using-nish/cli.md`,
`docs/guide/language/memory.md`, `docs/roadmap/wp48-ref32-classes.md`,
`.claude/plans/wp48-s3-rule-prep.plan.md`.
Generated, regenerated with the repo's tooling only: `docs/reference/**`,
`scalar.config.json` (reference routes), `tests/self/goldens/checked/**`,
`tests/differential/**` goldens.

One PR. The design is `docs/wp48-ref32-classes.md` §3.1; it is normative for
the five tests, and §6 names where layout is computed (`computeLayout`,
`src/structs.ts:167`, called from `:1070`, `:1186`,
`src/inline-arrays.ts:895`).

**What this stage does not do.** It does not narrow any field, change any
`StructInfo`, emit any IR differently, or read `implements Compact` /
`implements Wide` / `--compact off` (stage 2 and stage 3). With or without
`--explain-layout`, every program's IR is byte-identical to `main`'s, and
nish-cmp moves nothing. If that turns out impossible, the stage stops and
says why in a draft PR.

**The report.** One line per user class, deterministic order (source order is
fine), in the style of `--explain-memory`: the class, `compact` or the first
test that refuses (`1 native`, `2 no link`, `3 no saving`, `4 not made in a
loop or recursion`, `5 forbidden: <reason>`), and `before → after` bytes
(after = the narrowed size; equal to before when test 2 or 3 refuses). A
summary line counts picked of total. Test 3 names which class saves — R or
the class holding the link. Classes from `std/` are reported too, marked as
such, since stage 5 surveys them.

**Rolling freeze.** `src/` may not *use* any construct or builtin the seed
does not ship; adding a flag uses none. A new diagnostic code, if one is
needed, lands with a `tests/link` negative that provokes it.

**Checks from the design.** `bench/goose/tree.ts`'s `TNode` picked at
24 → 12, `bench/goose/bintrees.ts`'s `TNode` at 16 → 8,
`bench/wp48-refs/sibling.ts`'s node at 32 → 20, with no source change. If the
module disagrees with any of the three, the PR says which and why rather than
bending the rule to fit.

**Survey.** The PR body carries `--explain-layout` output over `src/` and over
the nish-cmp corpus, as stage 5's first data. It is evidence, not a decision:
nothing in `src/` or `std/` gets a marker here.

**Commit subject** (the changelog line): `feat(cli): report which classes the
compact-class rule picks, with --explain-layout`.
