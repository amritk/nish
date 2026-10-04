---
name: Panic-guard range proofs, the NL9007 fix, and the nish:unsafe migration
overview: Let the range analysis credit a panic or process.exit guard, and use that to give NL9007 a machine-applicable panic-guard fix. Then give every site that --unchecked-indexing or --wrapping silently changes a per-site warning whose fix rewrites it into the matching nish:unsafe call, so nish --fix migrates a program off both deprecated flags without changing what it does.
stages:
  - id: panic-credit
    title: "perf(checker): credit a panic or process.exit guard in the range analysis"
    goal: An index behind a guard that ends in panic(…) or process.exit(…) is proven in range, and every IR change this causes is shown to come only from that.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, skip count read) && npm run test:cli, plus the IR-diff classification in the PR body
    todos:
      - id: credit-exit
        content: End a bounds path at an expression statement whose call terminates control flow in walkBoundsStatement (src/bounds.ts) — see Panic credit → Change
      - id: credit-classify
        content: Classify every changed .ll golden, link golden and src module diff before regenerating, and stop and report if any diff is not a removed bounds check behind a panic or exit guard — see Panic credit → The owner's condition
      - id: credit-regen
        content: Regenerate the 59 tests/cases .ll goldens, the map_extras_two_modules link golden and the self goldens with the repo's tools — see Panic credit → Regeneration
      - id: credit-cases
        content: Add golden cases pinning a credited panic guard, a credited process.exit guard and an uncredited guard — see Panic credit → Tests
      - id: credit-docs
        content: State in docs/LANGUAGE.md and docs/IR_COOKBOOK.md that a guard ending in panic or process.exit proves the access — see Panic credit → Docs
  - id: nl9007-fix
    title: "feat(cli): fix an index not proven in range with a panic guard"
    goal: NL9007 carries a fix that inserts a credited panic guard before the statement wherever that guard compiles, and no fix anywhere else.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, skip count read) && npm run test:cli
    todos:
      - id: guard-runner
        content: Teach the tests/fix runner a warning-only case, and make a no-fix case assert its diagnostic code — see NL9007 fix → Runner
      - id: guard-fix
        content: Attach the guard insertion to NL9007 in checkSurvivingBoundsCheck (src/checker.ts) for an i32 or i32-based ranged index — see NL9007 fix → The edit
      - id: guard-cases
        content: Add tests/fix/guard-* cases for each fixed shape and each refused shape — see NL9007 fix → Tests
      - id: guard-docs
        content: Update tests/fix/README.md, the NL9007 row in docs/AI.md and the AGENTS.md fix list — see NL9007 fix → Docs
  - id: unsafe-index
    title: "feat(cli): migrate --unchecked-indexing to uncheckedGet and uncheckedSet with nish --fix"
    goal: Under --unchecked-indexing, every index site whose check the flag drops reports a per-site warning, and the warning carries a uncheckedGet or uncheckedSet rewrite wherever one exists.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, skip count read) && npm run test:cli, plus the flag-dropped output equivalence cases
    todos:
      - id: unsafe-code
        content: Allocate the next free deprecation code for a per-site unchecked index with scripts/gen-diagnostic-codes.mjs — see Unsafe migration → Codes
      - id: unsafe-index-site
        content: Report the per-site warning for every entry-package index the flag leaves unchecked, after proveCallSiteRanges (src/compilation.ts) — see Unsafe migration → Which sites
      - id: unsafe-import-edit
        content: Write the shared nish:unsafe import edit (add the import, or extend an existing one, with every name the module needs) — see Unsafe migration → The import
      - id: unsafe-index-fix
        content: Attach the uncheckedGet / uncheckedSet rewrite for each mappable shape, and no fix for the rest — see Unsafe migration → Index shapes
      - id: unsafe-index-cases
        content: Add tests/fix/unsafe-index-* cases, including output equivalence after the flag is dropped — see Unsafe migration → Tests
      - id: unsafe-index-docs
        content: Point NL9014's message at nish --fix, and document the code in docs/LANGUAGE.md (nish:unsafe), docs/AI.md and tests/fix/README.md — see Unsafe migration → Docs
  - id: unsafe-wrap
    title: "feat(cli): migrate --wrapping to wrappingAdd, wrappingSub and wrappingMul with nish --fix"
    goal: Under --wrapping, every signed operation whose overflow check the flag drops reports a per-site warning, and the warning carries a wrapping* rewrite wherever one exists.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, skip count read) && npm run test:cli, plus the flag-dropped output equivalence cases
    todos:
      - id: wrap-code
        content: Allocate the next free deprecation code for a per-site wrapping operation — see Unsafe migration → Codes
      - id: wrap-site
        content: Report the per-site warning for every entry-package signed operation the flag leaves unchecked — see Unsafe migration → Which sites
      - id: wrap-fix
        content: Attach the wrappingAdd / wrappingSub / wrappingMul rewrite for each mappable form, reusing the import edit — see Unsafe migration → Wrapping forms
      - id: wrap-cases
        content: Add tests/fix/unsafe-wrap-* cases, including a deliberately overflowing program whose output is unchanged with the flag dropped — see Unsafe migration → Tests
      - id: wrap-docs
        content: Point NL9015's message at nish --fix and document the code — see Unsafe migration → Docs
---

# Panic-guard range proofs, the NL9007 fix, and the nish:unsafe migration

## Context

This is the follow-up to the `diagnostic-fix` run (#413). Its open items are in #440, where the owner decided both of them (2026-10-04):

1. **The IR changes from crediting a `panic` exit are accepted.** First spot-check the diffs and confirm they come *only* from the range analysis recognising `panic`. Any unrelated diff stops the work and is reported rather than accepted.
2. **The `nish:unsafe` migration is approved as a new stage.** Importing `nish:unsafe` is the opt-in that allows `uncheckedGet`/`uncheckedSet`, including under `--deny-panics`. That opt-in has since landed as #455; **this plan does not touch `src/panics.ts`** and covers only the migration.

All facts below were measured against main `cad7114`, which includes #426 (checked overflow by default) and #443 (`--deny-panics`). The run's base is `6773fb80`, which adds #455 (the opt-in) and #452 (capability policy); each worker re-confirms the line numbers on its base.

## Approach

- **A fix stays all or nothing, and it must not change behaviour on any input the program could get before.**
  - The panic guard replaces the runtime's own index failure with a panic that also exits with status 1.
  - A migration rewrite does exactly what the flag did at that site.
- **A shape with no compiling spelling gets the warning and no fix.** This is the rule from #413.
- **No new language construct.** No golden `.ll` is owed beyond the cases that pin the analysis change, and no cookbook entry. The new codes are documented where their siblings are.

## Panic credit

**Owns:**
- `src/bounds.ts`
- `tests/cases/**` (new cases, plus the regenerated `.ll` of the affected cases)
- `tests/link/map_extras_two_modules/**` (regenerated golden only)
- `tests/self/goldens/**` (regenerated only)
- `docs/LANGUAGE.md` (the bounds section)
- `docs/IR_COOKBOOK.md` (the bounds-check entry)
- `tests/nish-cmp.js` (only if CI's seed comparison needs a declaration)

### Change

`walkBoundsStatement` (`src/bounds.ts:3411`) ends a path at `N_RETURN`, `N_CONTINUE`, `N_BREAK` and `N_THROW`. `N_EXPR_STMT` (3432) always continues. Make it return `terminatesControlFlow(walk.ctx, stmt.children[0])` after walking the expression.

`terminatesControlFlow` (`src/builtins.ts:1030`) counts the global `panic(…)` and `process.exit(…)` / `nish:process` `exit`. It is already the checker's path-termination test (`statements.ts:172`). One import is added.

### The owner's condition

Before regenerating anything, the stage produces a classification of every diff and puts it in the PR body. A measured run of the change on `cad7114` gives:

- **59 `tests/cases` `.ll` goldens.** Every hunk is a removal: 89 bounds checks in all, −10 lines each, +0 lines anywhere. All of them sit behind the three guards in `std/collections.ts`: `Map.keyAt`, `Map.valueAt` and `Set.keyAt`, each `if (index < 0 || index >= toI32(…length)) { panic(…) }`.
- **One link golden:** `map_extras_two_modules`.
- **Two `src/` modules:** `emit-map.ll` and `emit-parallel.ll`. These are checks behind `process.exit(internalErrorFor(…))` length guards.
- **No change** to any `.panics` golden or to any diagnostic in the corpus.

The worker re-runs this classification on the branch's actual base. It confirms by reading every hunk's preceding source that **each removed check is behind a panic or exit guard**, and that no hunk adds a line. **If any diff does not fit, the worker stops, does not regenerate, and reports the diff on the PR. The lead takes it to the owner.**

### Regeneration

Regeneration uses only the repo's tools:
1. Delete the affected `.ll` files, then run `UPDATE_GOLDENS=1 node tests/run.js map` and `UPDATE_GOLDENS=1 node tests/run.js set_iter`, or run `npm run test:update`.
2. Run `node tests/run.js map_extras_two_modules --update-link-goldens`.
3. Run `node tests/self/goldens.js --update`.

### Tests

Three new golden cases. Each ships a `.ll`, an `llvm-as` pass and a native round trip with expected stdout. The negative case pins that the check stays.
- `bounds_panic_guard`: a loop with `if (i < 0 || i >= xs.length) { panic("…") }` before `xs[i]`. No `nish_panic_index`, and no NL9007.
- `bounds_exit_guard`: the same guard ending in `process.exit(3)`.
- `bounds_guard_not_exit`: the same guard ending in a plain call (`log(…)`). The check stays and NL9007 still fires.

### Docs

Add one rule to the `docs/LANGUAGE.md` bounds section: a guard whose failing branch ends in `panic` or `process.exit` proves the access. Add the matching line to the `IR_COOKBOOK.md` bounds-check entry.

## NL9007 fix

**Depends on:** panic-credit.

**Owns:**
- `src/checker.ts` (`checkSurvivingBoundsCheck` and the helpers it needs)
- `tests/run.js` (the fix runner section only)
- `tests/fix/guard-*`
- `tests/fix/README.md`
- `docs/AI.md` (the NL9007 row and "The loop")
- `AGENTS.md` (the fix list)
- `tests/self/goldens/**` (regenerated only)

### The edit

NL9007 is reported in `checkSurvivingBoundsCheck` (`src/checker.ts:1620`). It only ever fires for a plain-local index on a plain-local array or string receiver, inside a loop. The fix is one insertion at the start of the statement that holds the access, using the statement's own indentation:

```ts
if (!(i >= 0 && i < toI32(xs.length))) { panic("index out of range") }
```

- For a string receiver used with `charCodeAt(i)`, the guard is the same with `t.length`.
- The `toI32(…)` form is the only spelling the analysis credits in both number modes. It was measured with the change in place: under `--number-mode f64`, `i < xs.length` does not compile with an i32 index.

**No fix when** (each needs a case):
- the index is i64, or u8/u16/u32. No spelling of the upper bound both compiles and is credited (`toI64`/`toU32` are not credited).
- the access is in a loop condition (`while (xs[i] !== 0)`), so there is no statement to insert before.
- a call between the guard point and the access may resize the array (`s = s + grow(xs) + xs[i]`). The warning stays and is correct.
- under `--deny-panics`. NL9007 is already withdrawn where NL2457 covers the site, and an inserted `panic` would itself be refused.

The NL9007 message's "an unsigned index needs only the upper one" has no compiling spelling today, as noted above. Fixing that wording is **not** in this stage. It is recorded as a follow-up.

### Runner

`tests/run.js` (3657–3820) requires a plain run that exits 1, so a warning-only case cannot be written. Make two changes:
1. A case may name its plain exit status in a `<name>.plain-exit` sidecar (`plain-exit` for a directory case), defaulting to 1. The other checks are unchanged: a fix-carrying object is present, `--fix` exits 0 and the result compiles with no error object.
2. A `*.nofix.ts` case may name the code it is about in a `<name>.code` sidecar, and the runner asserts that code is among the diagnostics. This is #440 item 4, needed here so a refused NL9007 case proves it reached NL9007.

`src/fix.ts:110-123` already applies warning fixes when the program checked.

### Tests

Fixed cases, each with `.fixed.ts` and `.plain-exit` = 0:
- `guard-array`
- `guard-string-charcode`
- `guard-ranged-index`
- `guard-two-receivers`
- `guard-f64-mode/` (a directory case with `argv` `--number-mode f64`)

Refused cases, each with a `.code` sidecar:
- `guard-nofix-i64`
- `guard-nofix-u32`
- `guard-nofix-loop-condition`
- `guard-nofix-resize`

One round trip shows the fixed program prints the same output on in-range input and exits 1 on out-of-range input.

### Docs

- Update `tests/fix/README.md`: remove "no warning carries a fix today" and document the two sidecars.
- Update the NL9007 row in `docs/AI.md` "What you must unlearn".
- Update the `AGENTS.md` fix list.

## Unsafe migration

**unsafe-index owns:**
- `src/compilation.ts` (`reportDeprecatedFlags` and a new per-site report next to it)
- `src/unsafe-migrate.ts` (new: the site walk, the rewrites and the import edit)
- `src/codes.ts`
- `tests/fix/unsafe-index-*`
- `docs/LANGUAGE.md` (the `nish:unsafe` section)
- `docs/AI.md`
- `tests/fix/README.md`
- `tests/self/goldens/**` (regenerated only)
- `tests/wordings/**` (only if a pin must move)
- `tests/link/unsafe-migrate-*` (new directories only)

Not owned: `tests/run.js` (nl9007-fix owns the fix runner) and `tests/cases/**` (panic-credit owns it).

**unsafe-wrap** owns the same files with `tests/fix/unsafe-wrap-*`, and **depends on unsafe-index** for `src/unsafe-migrate.ts` and the import edit.

Neither stage touches `src/panics.ts`, where the deny-panics session is implementing the import opt-in.

### Codes

Both flags are command-line only (`compile.ts:539-552`). Their deprecation warnings NL9014 and NL9015 are reported at offset 0 of the entry module, so they have nothing to carry a per-site edit. Each stage adds one per-site warning:
- **unsafe-index:** "this index goes unchecked only because of `--unchecked-indexing`"
- **unsafe-wrap:** "this operation wraps only because of `--wrapping`"

Each takes the next free code in the deprecation band, per `node scripts/gen-diagnostic-codes.mjs`: **NL7002**, then **NL7003**, if the band is still free when the stage starts. The severity is the same as NL7001's. The worker checks that the severity is silenced like NL9014/NL9015 and reported in `nish run` the same way.

NL9014's and NL9015's messages gain one clause: "`nish --fix` rewrites each site; then drop the flag."

### Which sites

**unsafe-index:**
- Report every index read or write in the entry package whose check `--unchecked-indexing` drops: `program.nodeProvenIndex[node.id]` is false.
- Report after `proveCallSiteRanges` (`compilation.ts:1149`). That is the point where `reportDeprecatedFlags` already runs and where the per-site verdicts are final.
- Under the flag, proofs are a subset of the no-flag proofs, because the flag records no passed-check facts. So every site left as `xs[i]` stays proven once the flag is dropped.

**unsafe-wrap:**
- Report every signed `+ - *`, unary `-`, `++ --` and `+= -= *=` in the entry package that would carry an overflow check without the flag. The set is `checkedArithmeticType` (`bounds.ts:3759`) and `checksOverflow`.
- Where the analysis cannot decide under the flag, the site is reported. A wrapping call on values that never overflow computes the same result, so over-reporting is safe and under-reporting is not.

### The import

A rewrite needs `uncheckedGet`, `uncheckedSet` or a `wrapping*` name imported from `nish:unsafe`. `as` renames are allowed, and NL2456 refuses a call without the import.

The import edit is part of every site's fix while the module lacks a name it needs. It names **every** `nish:unsafe` function that the module's reported sites need:
- a new `import { … } from "nish:unsafe"` after the module's last import;
- or an extension of an existing `nish:unsafe` import list.

In round 1 the import edits from different sites overlap, so only one site's fix applies (the driver drops overlaps). In round 2 the import is present, and every other site's fix applies. A module converges in at most 2 rounds, and a `.rounds` case pins that. A site calls the name under its local alias when the module already imports it renamed.

### Index shapes

Rewritten (number element, i32 or i32-based ranged index):

| Shape | Rewrite |
| --- | --- |
| `xs[i]` read | `uncheckedGet(xs, i)` |
| `xs[i] = v` as a statement | `uncheckedSet(xs, i, v)` |
| `xs[i] op= v` and `xs[i]++` / `xs[i]--` as statements, with `xs` and `i` free of side effects | `uncheckedSet(xs, i, uncheckedGet(xs, i) op v)` |
| the inner index of `xs[i][j]`, when the inner array holds numbers | rewritten; the outer stays |

No fix, warning only (each needs a case):
- a non-number element (`string[]`, a class, a record, a nested array as the read result);
- a u8/u16/u32/i64 index;
- `xs[i] = v` or `xs[i]++` used as a value;
- `op=` on a receiver or index that has side effects;
- a readonly array store;
- `charCodeAt`, `pop`, `slice`, `set`, and net buffers, which have no `nish:unsafe` equivalent. Dropping the flag puts their check back, which is the safe direction.

### Wrapping forms

| Form | Rewrite |
| --- | --- |
| `a + b` | `wrappingAdd(a, b)` |
| `a - b` | `wrappingSub(a, b)` |
| `a * b` | `wrappingMul(a, b)` |
| `x op= y` (target free of side effects) | `x = wrappingAdd(x, y)`, and likewise for `-` and `*` |
| `x++` / `x--` as a statement | `x = wrappingAdd(x, 1)` / `x = wrappingSub(x, 1)` |
| unary `-x` | `wrappingSub(0, x)` |

These are the spellings `wrappingForm` (`panics.ts:786-801`) already gives. Operands must share one i32 or i64 type, and a bare literal takes the other operand's type.

No fix, warning only:
- `++` / `--` used as a value;
- `op=` on a target with side effects;
- operands of mixed width.

### Tests

Each stage pins its fixes and its refusals as `tests/fix` cases. A directory case passes the flag through `argv`. Each stage also adds an **equivalence** case: `nish --flag --fix` rewrites the program, then the program compiled *without* the flag prints exactly what the original printed *with* it. The index case reads only in-range elements. The wrap case deliberately overflows an i32 (a hash loop) and prints the wrapped checksum. The equivalence is pinned without touching `tests/run.js`: two `tests/link/unsafe-migrate-*` cases with one `expected.out`, the original under the flag and the migrated source (byte-identical to the `.fixed.ts`) without it.

### Docs

- Document the new code in the `nish:unsafe` section of `docs/LANGUAGE.md`.
- Add a line to `docs/AI.md` (the deprecated flags, and `nish --fix` as the migration).
- Add a row to `tests/fix/README.md`.

## Parallelism and merge order

- `panic-credit` and `unsafe-index` start together. Their only shared paths are `docs/LANGUAGE.md`, where each edits a different section, and the regenerated goldens.
- `nl9007-fix` and the unsafe stages share `docs/AI.md` and `tests/fix/README.md`. Whichever merges second merges main and resolves those two files by hand, because they are prose and not generated.
- `nl9007-fix` starts once `panic-credit` merges, and `unsafe-wrap` starts once `unsafe-index` merges.
- Every stage changes `src/`, so the generated goldens conflict on every merge. Each later stage merges main and regenerates; nobody edits a golden by hand.

## Acceptance

1. With a guard `if (i < 0 || i >= xs.length) { panic("…") }` before `xs[i]` in a loop, `nish p.ts` reports no NL9007, and `--emit-llvm` shows no `nish_panic_index` for that access. The same holds with `process.exit(…)`.
2. The PR for panic-credit classifies every changed golden, and each change is a removed bounds check behind a panic or exit guard, with no added line and no diagnostic changed in the corpus.
3. `nish --fix` on a loop with an unproven i32 `xs[i]` inserts the guard. The result compiles with no NL9007 and exit 0, prints the same output on in-range input, and exits 1 on out-of-range input.
4. NL9007 on an i64 or unsigned index, on a loop-condition access, or under `--deny-panics`, reports without a `fix`.
5. `nish --unchecked-indexing --fix p.ts` rewrites every unproven number-array index to `uncheckedGet`/`uncheckedSet` and adds the import. The program then compiles **without** the flag and prints the same output as before. Unmappable sites report the per-site warning without `fix`.
6. Likewise for `--wrapping` → `wrappingAdd/Sub/Mul`: a deliberately overflowing program prints the same checksum after migration with the flag dropped.
7. The new codes, the two reworded deprecation messages and the runner sidecars are documented.
8. `npm run check` and an undegraded `npm test` are green on merged main, and CI is green on each merge.

## Risks

- **Main churn.** Every `src/` merge conflicts on the goldens. The fast merge-only procedure from #413 applies: run the fast checks locally, let CI's full suite gate the merge, and the lead checks that each merge-only push leaves the PR's own diff identical.
- **The deny-panics opt-in lands while unsafe-index is open.** Neither stage touches `src/panics.ts`. If that PR changes which sites count as unchecked, the stage re-runs its equivalence cases after merging main.
- **Number of rewrites.** A large flagged program gets many `nish:unsafe` calls. That is the approved design: the opt-in becomes visible at each site instead of being hidden in a flag.
