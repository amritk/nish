---
name: WP28 C1 — the free tier of compatibility mode
overview: WP33's R6 is WP28. This run lands WP28's next stage, C1. Under `--compat` only, the compiler accepts optional chaining, `??` on a left operand strict refuses, string `switch`, `for...of` over a string, optional parameters with non-constant defaults, and overload signatures. Each one is a feature name in `src/compat.ts`'s registry and reuses or adds a fixed-layout lowering. Each is held to the erasure invariant and to a Node differential. The work lands as three PRs in sequence, because every C1 entry edits the same registry, erasure test and dialect docs. A strict build's IR does not move.
stages:
  - id: c1-nullish
    title: "feat(checker): accept optional chaining and nullish coalescing under --compat"
    goal: Under `--compat`, `a?.b` outside a `??` chain, `a?.[i]` and `a?.m()` compile to the null test strict already emits, and `??` compiles on a left operand whose nish type strict refuses for it. Each native round trip prints what Node prints. A strict build is unchanged. The shared C1 machinery is in place for the next two stages, and a strict refusal of an admitted construct names the feature that admits it.
    verification: npm run check && npm run lint && npm run lint:dead && WASI_SYSROOT=/usr node tests/run.js compat && node tests/run.js nullish && node tests/run.js optional && node tests/run.js link && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/self/goldens.js checked && node scripts/gen-reference.mjs --check && node scripts/gen-diagnostic-codes.mjs --check && NISH=build/nish bash docs/cookbook/regen.sh --check && node docs/check-links.mjs && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
    todos:
      - id: helper
        content: Add one query a checker or lowering site calls to ask whether a feature is on for this build, such as `ctx.compatAllows("<feature>")` reading `opts.compat` and `opts.compatFeatures`. No site reads `opts.compatFeatures` directly. See The shared machinery.
        status: pending
      - id: names-feature
        content: A strict refusal of a construct that a built feature admits names that feature, per §5.2 ("add `<feature>` to nish.compat in package.json to accept it"). Write it as a shared note so the next two stages add one line per refusal. Regenerate the `.err`/`.json` goldens it moves and grep the old text across the repo. See The shared machinery.
        status: pending
      - id: erasure
        content: Teach tests/compat-erasure.js that a `reject_*` case may compile under bare `--compat` only when a built feature admits it. List each such case with its feature, check that the case's native output under `--compat` matches Node's, and fail on a reject case that compiles with no listed feature. Keep the COMPAT_TAMPER self-test passing, and add one that proves an unlisted acceptance fails. See The shared machinery.
        status: pending
      - id: c0-strings
        content: Move the C0 strings that say no feature is built (src/compat.ts:31, tests/run.js WP28 C0 probes, tests/link/compat_* expected.err, docs/guide/using-nish/compat.md). Each probe that used `async` or `decorators` as an unbuilt name keeps using an unbuilt name.
        status: pending
      - id: optional-chaining
        content: Register feature `optional-chaining`. Under it, src/validator.ts admits `a?.b` outside a `??` chain, `a?.[i]` and `a?.m()`, and they lower through the existing `admitChain`/`linkReceiver` null test. `f?.()` on a function value stays refused (C2b), and so does a chain whose result type has no nish representation, each with a diagnostic that says why. See The constructs.
        status: pending
      - id: nullish
        content: Register feature `nullish` for the `??` forms strict refuses (src/expressions.ts `checkCoalesce`, NL1048). Use the meaning Node gives them, with the lowering strict already uses for `T | null`. If the left operand can never be null and Node's answer is always the left side, compile it to the left side and say so in a performance-class or portability note, not silently. See The constructs.
        status: pending
      - id: checklist
        content: For each feature, ship what docs/ARCHITECTURE.md → "How to add a construct" asks for. That is compat-only positive cases with `.args` `--compat` (golden `.ll`, `llvm-as`, native round trip with expected `.out` equal to Node's), at least one negative per feature, and the docs/LANGUAGE.md rule under "The compatibility dialect" plus a pointer from the strict refusal prose. Add a section in docs/guide/using-nish/compat.md, regenerate docs/reference/, and register new positive cases with `node tests/differential/goldens.js --update`. The PR body names any checklist item that does not apply to a compat entry, with the reason.
        status: pending
      - id: notes
        content: Update docs/wp28-compatibility-mode.md's §2.1 status and §7.3 C1 row to say which C1 entries are built. Leave the roadmap checkbox for the last stage.
        status: pending
  - id: c1-strings
    title: "feat(codegen): accept string switch and for...of over a string under --compat"
    goal: Under `--compat`, a `switch` on a string with string-literal cases compiles to a content comparison chain, or to a length-bucketed tree where that is the better shape. `for...of` over a string walks it with the iteration rule docs/LANGUAGE.md states. Each native round trip prints what Node prints, including a non-ASCII string. A strict build is unchanged.
    verification: npm run check && npm run lint && npm run lint:dead && WASI_SYSROOT=/usr node tests/run.js compat && node tests/run.js switch && node tests/run.js for_of && node tests/run.js link && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/self/goldens.js checked && node scripts/gen-reference.mjs --check && node scripts/gen-diagnostic-codes.mjs --check && NISH=build/nish bash docs/cookbook/regen.sh --check && node docs/check-links.mjs && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
    todos:
      - id: string-switch
        content: Register feature `string-switch`. Under it, src/statements.ts's switch check (NL2009 today) takes a string discriminant with string-literal (or string-constant) cases, rejects duplicate labels, and keeps fallthrough, `default` and `break` behaving as Node does. src/emit-control.ts lowers it to a chain of content comparisons, or a length-bucketed tree, and the PR says which and why. The `--emit-ts` emitter handles it. The strict refusal names the feature, using stage c1-nullish's shared note. See The constructs.
        status: pending
      - id: for-of-string
        content: Register feature `for-of-string`. Under it, `for (const c of s)` over a string (NL2136 today) iterates as Node does, one code point per step as a one- or two-unit string. If nish's string model makes that a different unit, refuse what cannot match Node and state the rule in docs/LANGUAGE.md. A round trip includes a non-ASCII and an astral character. `break`/`continue` and labels work inside it. See The constructs.
        status: pending
      - id: erasure-entries
        content: Add each reject case these features admit to tests/compat-erasure.js's admitted list, under its feature name.
        status: pending
      - id: checklist
        content: Ship the construct checklist for both features, as in stage c1-nullish (compat cases with `.args`, golden `.ll`, `llvm-as`, `.out` equal to Node's, negatives, docs/LANGUAGE.md, docs/guide/using-nish/compat.md, docs/reference/, differential goldens registered), and update docs/wp28-compatibility-mode.md's C1 row.
        status: pending
  - id: c1-signatures
    title: "feat(checker): accept optional parameters, non-constant defaults and overload signatures under --compat"
    goal: Under `--compat`, a top-level function or method may declare `x?: T`, a default that is not a constant, and overload signatures ahead of one implementation. Each call compiles with its arity fixed at the call site and prints what Node prints. A strict build is unchanged, and WP28's C1 box is ticked.
    verification: npm run check && npm run lint && npm run lint:dead && WASI_SYSROOT=/usr node tests/run.js compat && node tests/run.js param && node tests/run.js overload && node tests/run.js link && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/self/goldens.js checked && node scripts/gen-reference.mjs --check && node scripts/gen-diagnostic-codes.mjs --check && NISH=build/nish bash docs/cookbook/regen.sh --check && node docs/check-links.mjs && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
    todos:
      - id: optional-params
        content: Register feature `optional-params`. Under it, `x?: T` (NL2605 today) and a default that is not a constant (the `notLiteral` refusal in src/declarations.ts) are accepted on top-level functions and methods. A non-constant default is evaluated on the callee side on each call that omits it, in Node's order, and an omitted `x?: T` has the meaning Node gives it as far as nish can represent it. Decide and document what an omitted optional is in nish, which has no `undefined`. Refuse what cannot match Node, such as reading an omitted primitive, with a diagnostic that says why. See The constructs.
        status: pending
      - id: overloads
        content: Register feature `overloads`. Under it, bodiless signatures ahead of one implementation (NL2204 for functions, NL2091 for constructors, and the method case) are accepted. Calls check against the overload signatures, as tsc does, and compile to the one implementation. Each signature has to be assignable to the implementation's, or the checker refuses it. See The constructs.
        status: pending
      - id: erasure-entries
        content: Add each reject case these features admit to tests/compat-erasure.js's admitted list, under its feature name.
        status: pending
      - id: checklist
        content: Ship the construct checklist for both features, as in stage c1-nullish, including the `--emit-ts`, `--emit-dts` and interop emitters (refuse a compat-only signature in an N-API or C surface if it has no mapping there).
        status: pending
      - id: roadmap
        content: Tick C1 in docs/roadmap/wp28-compatibility-mode.md (Done 6 of 13) and move its Next to C-lib. Update WP33's R6 "Next" line in docs/roadmap/wp33-round-trip.md, but leave R6 unticked, because R6 is done when all of WP28 is. Finish the §7.3 C1 row and the compat guide page's opening.
        status: pending
---

# WP28 C1 — the free tier of compatibility mode

## Context

WP33's R6 is "compatibility mode (WP28)", and it is done only when WP28 is.
WP28 has eight open stages (C1, C-lib, C2b, C3–C7). Several are large (C2b
function values, C5 exceptions), and each needs its own design decisions.
**This run lands C1**, the next stage, which the roadmap calls "the free tier":
six wp23 refusals reversed *in compat only*, each costing "nothing measurable"
(design note §2.1). The rest of WP28 is later runs.

C0 built the machinery and registered no features. The pieces are:

- `src/compat.ts`: `compatFeatureNames()`, an empty array, plus `compatHasFeature` and `compatKnownText`.
- `Options.compat`/`compatFeatures`, parsed in `src/compile.ts:937-956`.
- `nish.compat` in `src/manifest.ts`, resolved in `src/compilation.ts:1838-1879`.
- The root-package ceiling, NL3057.
- `!nish.compat` in `src/emit.ts:564`.
- The S3 erasure test, `tests/compat-erasure.js`.

Strict already takes more than the design note's §2.1 row says. It accepts
`a?.b ?? d` (a `?.` chain ending in `??`), and `??` on `T | null` and on a
`Map.get` maybe. C1's `?.`/`??` entry is what strict still refuses.

The stages run **one after another**. All three edit the registry, the erasure
test's admitted list, `docs/LANGUAGE.md`'s "The compatibility dialect" and
`docs/guide/using-nish/compat.md`. Each is worth merging on its own if a later
one stalls, and six constructs in one PR is too much to review in one sitting.
Stage c1-nullish goes first because it reuses lowering that exists and builds
the machinery the other two use.

## Rules for every stage

- **Additive.** A program that compiles without `--compat` emits the same bytes
  as before. tests/compat-erasure.js and the goldens prove it.
- **Node is the oracle.** Every compat positive case has an `.out` that is
  Node's stdout for the same file, through `tests/differential/`. A form whose
  native result cannot match Node is refused with a diagnostic that says why.
  It never compiles to a different answer.
- **One feature name per entry**, in kebab-case: `optional-chaining`,
  `nullish`, `string-switch`, `for-of-string`, `optional-params`, `overloads`.
  Bare `--compat` turns on every built feature, and `--compat=<name>` turns on
  one.
- **The rolling freeze holds.** `src/` uses none of these constructs. Compat
  never applies inside `src/` (§4.4).
- **No per-construct pricing is required.** §2.1 prices every C1 row at
  "nothing". Add a performance-class line only where a lowering really costs
  something, such as a `??` folded to its left side.
- **Diagnostics.** A new code lands with a `tests/link` negative carrying an
  `expected.err`. A changed message is grepped across the whole repo.
  `node scripts/gen-diagnostic-codes.mjs` is regenerated.
- **Generated files** are regenerated, never hand-edited. These are
  `tests/self/goldens/checked/**`, `docs/reference/**` with their
  `scalar.config.json` routes, and `tests/differential/` golden registrations.

## The shared machinery

Stage c1-nullish builds these. The next two stages use them.

1. **One query.** Every site asks, for example, `ctx.compatAllows("nullish")`,
   so the check is greppable and the next stages repeat it.
2. **The refusal names the feature.** §5.2's example: a strict build that
   refuses `a?.b` adds `= add optional-chaining to nish.compat in
   package.json to accept it`. This is one shared helper, so later stages add
   one call per refusal site. Build it as a note on the existing diagnostic,
   not a new code. The dialect line itself appears only under `--compat`, so
   strict `--emit-checked` output does not move.
3. **The erasure test learns admissions.** Today every `reject_*` case must be
   rejected identically under bare `--compat`. After C1, a case a built feature
   admits compiles there instead. The test reads a list of (case → feature).
   For a listed case it checks that the case compiles under `--compat`, that its
   native output equals Node's, and that it is still rejected without
   `--compat`. An unlisted reject case that compiles under `--compat` fails the
   test. That failure is the invariant.

## The constructs

| Feature | Strict refusal today | Compat lowering (§2.1) |
| --- | --- | --- |
| `optional-chaining` | NL1049/NL1062 in src/validator.ts | the null test strict already emits for `a?.b ?? d` (`admitChain`, `linkReceiver`) |
| `nullish` | NL1048 in src/expressions.ts `checkCoalesce` | the `T \| null` coalesce strict has |
| `string-switch` | NL2009 in src/statements.ts | a content-comparison chain or a length-bucketed tree in src/emit-control.ts |
| `for-of-string` | NL2136 in src/statements.ts | the string walk, with the iteration unit stated |
| `optional-params` | NL2605, `notLiteral` in src/declarations.ts | callee-side default, with arity fixed at each call site |
| `overloads` | NL2204/NL2091 in src/statements.ts | signatures checked as tsc does, one implementation compiled |

`f?.()` on a function value and overloads that need run-time dispatch remain
refused. They belong to C2b.

## Stages

The stages run in sequence, so their `Owns` sets may overlap. Each stage
updates from `main` before it starts editing.

### c1-nullish

**Owns:** `src/compat.ts`, `src/context.ts`, `src/codes.ts`, `src/diagnostics.ts`, `src/compilation.ts`, `src/emit.ts`, `src/bounds.ts`, `src/checker.ts`, `src/arrays.ts`, `src/validator.ts`, `src/expressions.ts`, `src/members.ts`, `src/emit-util.ts`, `src/emit-map.ts`, `src/emit-ts-*.ts`, `tests/compat-erasure.js`, `tests/run.js`, `tests/link/compat_*/**`, `tests/cases/compat_*`, `tests/cases/reject_optional_*`, `tests/cases/reject_nullish*`, `tests/cases/nullish_*`, `tests/link/*/expected.err`, `tests/link/*/expected.json`, `tests/cases/*.err`, `tests/cases/*.json`, `docs/LANGUAGE.md`, `docs/guide/**`, `docs/wp28-compatibility-mode.md`, `src/options.ts`, `tests/nish-cmp.js`, `tests/wordings/**`, `tests/cases/*.ll`, `tests/cases/*.out`, `src/emit-*.ts`, `src/fusion.ts`, `src/inline-arrays.ts`

**Depends on:** none.

**Amended 2026-11-18, after the first worker stopped on scope (#1770):** the
checker never sees `opts`, so the compat flags are wired into `CheckContext` in
`src/compilation.ts` (beside `deterministic`). Optional chaining also needs
these files. `src/emit.ts` routes a statement-position chain to a skip block.
`src/bounds.ts` and `src/checker.ts` treat a statement chain as one that may
stop at any link. `src/arrays.ts` handles a non-final `?.[i]`. A value use of
`a?.b` (Node gives `undefined`, and nish has none) and a final `?.[i]` past
the end both stay refused, each with a diagnostic that says why.

### c1-strings

**Owns:** `src/compat.ts`, `src/context.ts`, `src/codes.ts`, `src/statements.ts`, `src/emit-control.ts`, `src/emit-strings.ts`, `src/emit-ts-control.ts`, `src/emit-ts-strings.ts`, `src/loop-flow.ts`, `src/program.ts`, `tests/compat-erasure.js`, `tests/run.js`, `tests/link/compat_*/**`, `tests/cases/compat_*`, `tests/cases/reject_switch_*`, `tests/cases/reject_for_of_*`, `tests/cases/*.err`, `tests/cases/*.json`, `docs/LANGUAGE.md`, `docs/guide/**`, `docs/wp28-compatibility-mode.md`, `src/options.ts`, `tests/nish-cmp.js`, `tests/wordings/**`, `tests/cases/*.ll`, `tests/cases/*.out`, `src/emit-*.ts`, `src/arrays.ts`, `src/validator.ts`, `src/checker.ts`, `src/bounds.ts`, `src/escape.ts`, `src/assignment.ts`, `src/strings.ts`, `tests/link/*/expected.err`, `tests/link/*/expected.json`, `tests/cases/switch_*`, `tests/cases/for_of_*`, `src/attributes.ts`, `src/parallel.ts`, `src/compact-rule.ts`, `src/region-rules.ts`, `src/arena-report.ts`, `src/module-storage.ts`, `src/secret.ts`, `src/portability-records.ts`, `src/fnref-places.ts`, `src/script.ts`, `tests/cases/reject_*`

**Depends on:** c1-nullish, which must merge before this stage starts.

**Amended 2026-11-19, pre-flight before spawn:** `emitForOf` lives in `src/emit-arrays.ts`, and `src/validator.ts`, `src/checker.ts`, `src/bounds.ts`, `src/escape.ts`, `src/assignment.ts` and `src/arrays.ts` each walk a `ForOf` on the assumption that it iterates an array. A string iterable may need each of them. A reworded strict refusal moves `tests/link/*/expected.err`/`.json`. c1-nullish needed the same widening three times, so this stage gets it up front.

**Amended 2026-11-19, the worker's first blocker:** `src/attributes.ts` computes per-node facts (callees, `readsMemory`) for function attributes, and a string `for...of` or `switch` adds calls (`nish_str_new`, `nish_str_eq`) that its facts must record. The other per-node analyses that walk `ForOf` or `Switch` are added with it, so that a string iterable or discriminant does not block the stage again. Touch one only where the construct needs it, gated on the feature.

**Amended 2026-11-19, the worker's second blocker:** a strict reject case that a C1 feature now admits (`reject_arr_forof_non_array.ts`) must be listed in `tests/compat-erasure.js` and needs a `main` that prints, so Node has output to compare. The stage owns `tests/cases/reject_*`. Keep each such case at its path with its strict `.err` unchanged, and add the printing `main`. It needs the shared query, the feature-naming note and the erasure list.

### c1-signatures

**Owns:** `src/compat.ts`, `src/context.ts`, `src/codes.ts`, `src/declarations.ts`, `src/annotations.ts`, `src/statements.ts`, `src/expressions.ts`, `src/emit.ts`, `src/emit-classes.ts`, `src/emit-ts-*.ts`, `src/interop-*.ts`, `tests/compat-erasure.js`, `tests/run.js`, `tests/link/compat_*/**`, `tests/cases/compat_*`, `tests/cases/reject_param_*`, `tests/cases/*.err`, `tests/cases/*.json`, `docs/LANGUAGE.md`, `docs/guide/**`, `docs/wp28-compatibility-mode.md`, `docs/roadmap/wp28-compatibility-mode.md`, `docs/roadmap/wp33-round-trip.md`, `src/options.ts`, `tests/nish-cmp.js`, `tests/wordings/**`, `tests/cases/*.ll`, `tests/cases/*.out`

**Depends on:** c1-strings, which must merge before this stage starts.

**Amended 2026-11-19, before spawn:** c1-nullish and c1-strings needed five Owns widenings between them, each a file the construct reached through an analysis that walks it. Only one slice runs at a time, so a narrow Owns buys nothing. This stage owns `src/**`, `tests/**` and `docs/**`. It touches a file only where `optional-params` or `overloads` needs it, gated on the feature. It never edits a generated file by hand, and it may not touch `.github/`, `scripts/`, `runtime/` or `std/` without asking the lead.

**Amended again (#1770 round 1):** the emitter's statement-pattern matchers (`appendRangeOf`, `emitAddGuards` in `src/emit-arrays.ts`, `firstCallOf` in `src/fusion.ts`, the inline-array and lend-in-place matchers) do not know an optional call. c1-nullish owns `src/emit-*.ts`, `src/fusion.ts` and `src/inline-arrays.ts` so that it can make each of them refuse to fuse one.

Every stage may also regenerate these: `tests/self/goldens/checked/**`,
`docs/reference/**`, `scalar.config.json` (reference routes only),
`tests/differential/goldens/**` and `tests/differential/emit-ts-known.txt`
(only under the Node version CI pins). A new file a stage needs and no glob
covers is named in the PR body.

**Amended 2026-11-18 (#1770's blockers):** each stage also owns `src/options.ts`, `tests/nish-cmp.js` (its `DECLARED` entries, which CLAUDE.md requires in the same PR), `tests/wordings/**` (diagnostic coverage reads only that folder), and `tests/cases/*.ll`/`*.out` goldens that the stage's change moves, regenerated with the repo's tooling.

## Acceptance

These were written before any code. Each is checked against `main` once the
last stage merges. Each check compiles a program with `build/nish ... --link`,
runs it, and compares stdout with `node <file>.ts`.

1. A program that uses `a?.b` with no `??`, `a?.[i]` and `a?.m()` compiles with `--compat`, and its stdout equals Node's. Without `--compat` it is refused with a message that names `optional-chaining`.
2. A program that uses `??` on a left operand strict refuses compiles with `--compat`, and its stdout equals Node's. Without `--compat` the refusal names `nullish`.
3. A `switch` on a string, with fallthrough, `default` and `break`, compiles with `--compat`, and its stdout equals Node's.
4. `for (const c of s)` over a string holding ASCII, a non-ASCII character and an astral character compiles with `--compat`, and its stdout equals Node's, or it is refused with a diagnostic stating the rule.
5. A function with `x?: T` and with a non-constant default, called with and without those arguments, compiles with `--compat`, and its stdout equals Node's.
6. A function with overload signatures compiles with `--compat`, and its stdout equals Node's. A call that matches no overload is refused.
7. `--compat=<one feature>` turns on only that feature. A program that uses a different C1 construct is refused with a message naming the missing feature. An unknown name still exits 2.
8. A program that compiles without `--compat` emits the same IR as on the base commit. `node tests/run.js compat` (erasure) and `NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js` pass on `main`.
9. `nish.compat` in a root package.json accepts each of the six names. A dependency that asks for a feature the root does not allow is refused with NL3057.
10. docs/guide/using-nish/compat.md documents all six features with an example each, and docs/roadmap/wp28-compatibility-mode.md shows C1 ticked.

## Out of scope

C-lib, C2b–C7, the open question of whether `--compat` keeps implying
`--number-mode f64` (§10), a per-dependency ceiling beyond NL3057, and `--fix`
rewrites for these constructs. A worker who sees a cheap meaning-preserving
`--fix` names it in the PR body for a follow-up and does not build it.
