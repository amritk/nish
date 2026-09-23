---
name: Language gaps before 1.0 — Pair, package diagnostics, property-path bounds, ranged-integer design
overview: Four independent PRs that close the pre-1.0 items not owned by the G8 run (#162) — Pair in std/, WP21 S3's resolution diagnostics, #106's property-path length facts (the rest of WP15 1b's 2.48x), and the design note that ranged integer<Lo, Hi> needs before it can be built after G8.
stages:
  - id: pair
    title: "feat(std): Pair<A, B> as a standard-library type"
    goal: A program imports Pair from nish/pair and returns two values from one call, with no new grammar.
    verification: npm run check && node tests/run.js std_pair && npm test && npm run lint
    todos:
      - id: pair-module
        content: Add std/pair.ts exporting interface Pair<A, B> and list it in std/README.md — see Pair
        status: pending
      - id: pair-goldens
        content: Add tests/cases/std_pair*.ts round trips with .ll and .out goldens across scalar, string, array, nested and class-field instantiations — see Pair
        status: pending
      - id: pair-rejects
        content: Add tests/cases/reject_std_pair_*.ts negatives for a field-type mismatch and a missing field — see Pair
        status: pending
      - id: pair-docs
        content: Record Pair in docs/wp23-language-surface.md §5, docs/wp26-stdlib.md, the LANGUAGE.md and AI.md module lists and CHANGELOG.md — see Pair
        status: pending
  - id: package-diagnostics
    title: "feat(checker): WP21 S3 — specific diagnostics at the package boundary"
    goal: Every failure to resolve a package through the nish condition names its real cause with its own stable code, instead of one NL3014 message.
    verification: npm run check && node tests/run.js package && node scripts/gen-diagnostic-codes.mjs --check && npm test && npm run lint
    todos:
      - id: s3-mode-mismatch
        content: Report a package that offers only the other number mode, naming both modes, in self/compilation.ts and self/manifest.ts — see Package diagnostics
        status: pending
      - id: s3-engines-floor
        content: Read engines.nish and refuse a floor above the running compiler, naming both versions — see Package diagnostics
        status: pending
      - id: s3-no-condition
        content: Split the no-nish-condition case and the unreadable-manifest case out of NL3014, keeping NL3014 for what remains — see Package diagnostics
        status: pending
      - id: s3-codes-tests
        content: Register the new NL3xxx codes in self/codes.ts and AGENTS.md, with a tests/link/package_* case and a --json check per code — see Package diagnostics
        status: pending
      - id: s3-docs
        content: Update docs/wp21-packages.md §8 and §10d, the LANGUAGE.md import rule and CHANGELOG.md, and retire the TODO(WP21 S3) sites this closes — see Package diagnostics
        status: pending
  - id: bounds-paths
    title: "perf(checker): key bounds length facts by property path (#106)"
    goal: h.xs.length proves h.xs[i] in range wherever nothing reachable can resize the array or rebind the path, so the field-held scan drops to one bounds compare.
    verification: npm run check && node tests/run.js bounds && node tests/run.js arr_ && node tests/run.js perf_bounds && npm test && npm run lint
    todos:
      - id: paths-holder
        content: Add a property-path length holder to self/bounds.ts beside the variable-keyed facts — see Property-path bounds
        status: pending
      - id: paths-invalidate
        content: Invalidate path facts on a store to any field the path names, a rebind of its root, and any call whose resizesArray fact is true or unknown — see Property-path bounds
        status: pending
      - id: paths-golden
        content: Regenerate tests/cases/arr_header_hoist.ll and flip the fieldScale versus constScale assertion in tests/run.js to equality — see Property-path bounds
        status: pending
      - id: paths-soundness
        content: Add tests/cases/arr_path_* panic round trips where a callee pops, the loop reassigns the field, a second holder aliases the array, and a link is nullable — see Property-path bounds
        status: pending
      - id: paths-measure
        content: Measure bench/hoist_field.ts before and after and record the number in docs/wp15-performance.md §2c and item 1b, LANGUAGE.md Element access and CHANGELOG.md — see Property-path bounds
        status: pending
  - id: ranged-design
    title: "docs: WP31 — ranged integer types, designed for after G8"
    goal: Decide the surface and semantics of integer<Lo, Hi> so building it after G8 is a build rather than a decision.
    verification: node docs/check-links.mjs && npm run check
    todos:
      - id: ranged-note
        content: Write docs/wp31-ranged-integers.md deciding the eight questions and the build stages — see Ranged-integer design
        status: pending
      - id: ranged-tsc
        content: Prove the proposed nish.d.ts declaration and the note's examples under tsc --strict, and quote the command and result in the note — see Ranged-integer design
        status: pending
      - id: ranged-index
        content: Add the note's row to docs/README.md — see Ranged-integer design
        status: pending
---

# Language gaps before 1.0

## Context

The four items handed to this run were checked against `main` @ `1b86668` before planning, and two had moved:

| Asked for | State on main | This run does |
| --- | --- | --- |
| Ranged `integer<0, 255>` (WP15 item 6) | Analysis shipped; syntax waits on G8, which run #162 is building now, and on a numeric-literal type argument WP18 never designed | **ranged-design**: the design note only (owner decision) |
| `Pair<A, B>` in `std/` (wp23 §5) | Decided and buildable; `std/` has no `pair.ts` | **pair** |
| WP15 1b header hoist | **Shipped** in #104 with `FunctionFacts.resizesArray`; #104 measured that the 2.48x lives in the bounds checker, filed as #106 | **bounds-paths** (#106) |
| WP21 S2 | **Shipped** (wp21 §10, `4bf07f0`) | **package-diagnostics**: S3, the next stage |

Threads (WP20 T1–T4, WP29 P1) are 1.1 and out of scope.

## Approach

- **One stage, one PR, all four concurrent.** No stage consumes another's interface, so there are no merge-order edges inside this run.
- **Shared-append files.** `CHANGELOG.md` (`[Unreleased]`), `docs/LANGUAGE.md`, `docs/AI.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/README.md` and `tests/run.js` are touched by more than one stage. Each stage edits only its own section or rule in them. A conflict is resolved by keeping both sides, and generated files (`docs/cookbook/**`, `.ll` goldens) are regenerated with the repo's tooling (`bash docs/cookbook/regen.sh`, `UPDATE_GOLDENS=1 node tests/run.js <case>`), never merged by hand. This is the same decision run #162 recorded.
- **Run #162 (G8) is concurrent.** Its stages own `self/generics.ts`, `self/types.ts`, `self/program.ts`, `self/structs.ts`, `self/debug.ts`, `self/emit*.ts`, `self/interop_*.ts`, `self/checker.ts`, `self/codes.ts`, `AGENTS.md` and, late, `docs/**`. This run's stages stay out of those files wherever the work allows. Where one of them has to be touched (package-diagnostics needs `self/codes.ts` and `AGENTS.md`), the edit is additive in its own band. A conflict with a #162 merge is this run's worker's to resolve by merging `main` in. Nobody in this run touches a `feature/g8/*` branch.
- **Rolling freeze.** No stage adds syntax, and no stage makes `self/` use `nish/pair` or any construct the 0.8.0 seed lacks.
- **Gates** (owner decision, as in the G6 and G8 runs): there is no coverage command. CLAUDE.md's golden checklist stands in for it: a golden `.ll`, `llvm-as`, a native round trip with `.out`, at least one negative, the LANGUAGE.md rule, the cookbook entry where IR is new, and a CHANGELOG line. `npm test` must be **undegraded**, with no `DEGRADED:` line and the skip count stated in the PR body. The PR body shows the exact IR for every TypeScript snippet the PR adds to the tests.

## Pair

**Owns:** [`std/pair.ts`](../../std/pair.ts) (new), [`std/README.md`](../../std/README.md), `tests/cases/std_pair*`, `tests/cases/reject_std_pair_*`, [`docs/wp23-language-surface.md`](../../docs/wp23-language-surface.md), [`docs/wp26-stdlib.md`](../../docs/wp26-stdlib.md), plus the shared-append files.

**Amended 2026-09-23T16:10Z** (the worker's draft #172 showed the original globs could not ship a `std/` module): also [`self/std_modules.ts`](../../self/std_modules.ts) (the module list `tests/run.js` checks against `std/`), [`.github/workflows/release.yml`](../../.github/workflows/release.yml) (the presence-gate loops only — a sensitive path, so the merge gate escalates it to the owner rather than merging it autonomously), `tests/link/std_pair_*/**` (the positive round trips live here, not in `tests/cases/`, because a `std/` import writes two modules), `tests/nish-cmp.js` (`DECLARED` entries, shared-append), and `tests/self/goldens/**` (regenerated only).

- `export interface Pair<A, B> { first: A; second: B; }`, exactly wp23 §5.2. Use an interface, not a class, and add no constructor helper and no grammar. The JSDoc says what it is for, per wp23 §5.1: returning two values from one call, not storing two values side by side.
- Round trips (`tests/cases/std_pair*.ts` + `.ll` + `.out`):
  - `Pair<i32, boolean>` returned from an arrow as an object literal (wp23 §5's `scanEscape` shape);
  - `Pair<string, f64>` under `--number-mode f64` (the `.args` convention);
  - `Pair<i32[], string>`;
  - a nested `Pair<Pair<i32, i32>, string>`;
  - a `Pair` held in a class field and in an array.
- Negatives: a `Pair<i32, string>` given where `Pair<string, i32>` is expected, and an object literal missing `second`. Both use the codes the checker already has; this stage adds no new code.
- `std/` is already held to zero performance warnings by `tests/run.js`'s gate, which discovers `std/*.ts` itself. `npm run check` type-checks `std/pair.ts` under `tsc`.
- Docs: wp23 §5 becomes **landed**, with the case names. wp26 and the LANGUAGE.md and AI.md module lists name `nish/pair`. CHANGELOG gets a line.

## Package diagnostics

**Owns:** [`self/manifest.ts`](../../self/manifest.ts), [`self/compilation.ts`](../../self/compilation.ts), [`self/packages.ts`](../../self/packages.ts), [`self/codes.ts`](../../self/codes.ts) (NL3xxx band only), [`AGENTS.md`](../../AGENTS.md) (codes table rows), `tests/link/package_*/**` (new cases only), `tests/cases/reject_package_*`, `tests/wordings/**` (new NL3xxx files only), [`tests/nish/cli.ts`](../../tests/nish/cli.ts), [`docs/wp21-packages.md`](../../docs/wp21-packages.md), plus the shared-append files.

**Amended 2026-09-23T16:40Z** (round 1 of #178 found both forced by the change): also `tests/self/goldens/**` (regenerated only — `checked_self.txt` moves with every `self/` edit) and `tests/nish-cmp.js` (`DECLARED` entries for this stage's new cases only, shared-append).

This is WP21 S3's resolution half: §5c, §6 and §10d's "one diagnostic, not four". Each case below gets the next free NL3xxx number, a `tests/link/package_*` case, and a `--json` code assertion.

| Case | Message must name |
| --- | --- |
| The package offers Nish only in the other mode (`nish-f64` only, compiled `--number-mode i32`, and the reverse) | the package, the mode it offers, the mode this program compiles in (§6's sentence) |
| `engines.nish` is above the running compiler | the package, the floor, this compiler's version |
| `exports` exists but has no `nish*` condition for the subpath | the package, and that it has no Nish entry point (§6's `lodash` case) |
| The manifest could not be read past a syntax error, *and* resolution failed | the manifest path, and that it is malformed |

- NL3014 stays for any shape that is none of these. No existing code is renumbered or reused.
- `engines.nish` accepts `>=X.Y.Z` (and `>=X.Y`). Any other range shape is its own diagnostic and is never silently accepted. The compiler's version comes from wherever `--version` already reads it.
- **Out of scope**, and left recorded in wp21 §8 as S3's remainder:
  - the package-identity/symlink decision (§10d, `tests/link/package_symlink` stays a refusal);
  - the whole-program "builtin with no runtime on this target" diagnostic;
  - attributing a dependency's compile error to the dependency.

  Retire only the `TODO(WP21 S3)` comments this stage actually closes.

## Property-path bounds

**Owns:** [`self/bounds.ts`](../../self/bounds.ts), [`self/attributes.ts`](../../self/attributes.ts), [`self/emit_arrays.ts`](../../self/emit_arrays.ts) (only if the emitter must read a new side-table entry), `tests/cases/arr_header_hoist.*`, `tests/cases/arr_path_*`, `tests/cases/perf_bounds_*` (regenerated goldens only), [`bench/hoist_field.ts`](../../bench/hoist_field.ts) (read, measure), [`docs/wp15-performance.md`](../../docs/wp15-performance.md), plus the shared-append files.

**Amended 2026-09-23T16:40Z**, pre-emptively, for the same reason as package-diagnostics: also `tests/self/goldens/**` (regenerated only), `tests/nish-cmp.js` (`DECLARED` entries for this stage's new cases only, shared-append) and `tests/perf-baseline.json` (only if the ratchet moves down). **Amended again 2026-09-23T16:55Z** (draft #179): also `tests/differential/goldens/**` (regenerated only — a new `tests/cases` program registers in `unfrozen.txt`).

This stage implements #106 as that issue states it.

- A length fact keyed by a **property path**: a root local or parameter plus a chain of field names (`h.xs`, `this.state.atMostIndex`). It is established by the same guards and loop conditions that establish variable facts today.
- **Invalidation is the soundness argument**, and each rule gets a test:
  - any store to a field named anywhere on the path, through any holder of that struct type;
  - any assignment to the root;
  - any `push`/`pop`;
  - any call whose callee's `resizesArray` is true or not known yet (the fact is round-1-safe the way `bodyMayExtend` is);
  - a path through a link whose **declared** type is nullable. #104's miscompile was exactly this, so the declared type is what counts, never the narrowed one.
- Per LANGUAGE.md, `a.length` stays `i32`. #106 rules out the i64-compare alternative, and it is out of scope here.
- `tests/cases/arr_header_hoist.ll`: `@fieldScale`'s `xs` read loses its check. The `tests/run.js` assertion at the `panics("fieldScale")` site changes to `panics("fieldScale") === panics("constScale")`, so the gap cannot silently reopen.
- Soundness round trips (`tests/cases/arr_path_*.ts` + `.out`), each of which **must still panic** with the index panic:
  - a callee called in the loop pops the field's array;
  - the loop body reassigns `h.xs`;
  - a second holder shares the array and shrinks it;
  - the path goes through a nullable link.

  Also add one positive case where the fact must hold.
- Measure `bench/hoist_field.ts` before and after, with the method #104 used (loop alignment pinned). Put the number in the commit's `Measured:` trailer and in wp15 §2c and item 1b. Say plainly whether it reaches the 2.48x, and if not, why. Count the header-domain loads and checks the fact removes in `self/bounds.ts`'s own loops (wp15 §2c's real-code check).

## Ranged-integer design

**Owns:** [`docs/wp31-ranged-integers.md`](../../docs/wp31-ranged-integers.md) (new) and [`docs/README.md`](../../docs/README.md) (one row, shared-append). It does not edit `docs/wp15-performance.md`, which bounds-paths owns; the note links to wp15 item 6 and §2, and the pointer back from wp15 is left to the G8-follow-up run that builds it.

The note is a design and builds nothing. It must decide the following, each with the alternative it rejects:

1. **Spelling and the tsc declaration.** `integer<Lo, Hi>` with numeric-literal type arguments, and its `runtime/nish.d.ts` line, e.g. `type integer<Lo extends number, Hi extends number> = number`. Prove it under `tsc --strict` and quote the command. Check the name against the TS lib and the existing builtin names.
2. **The literal type argument.** WP18 has only type parameters. Say what a numeric literal in a type-argument position is to the parser, the checker and `mangleType`, and what is refused: non-literals, `Lo > Hi`, and bounds outside `i32`/`u32`.
3. **Representation.** The underlying machine type, its relation to `u8`/`u16`/`u32`, and behaviour under `--number-mode f64`.
4. **Entering the range.** What an assignment, argument or return of an unproven value does: a compile error, a checked conversion that panics, or an explicit conversion builtin. Base the choice on how the §2 facts already prove ranges.
5. **Leaving the range.** Arithmetic results widen to the base type; say where a range survives, if anywhere.
6. **Feeding `self/bounds.ts`.** A declared range becomes a fact source, per wp15 §2 mechanism 1's "one more source of facts for the same domain".
7. **Interop and `-g`.** The C header, `.d.ts`, N-API and DWARF spelling, reusing G8's naming decisions rather than inventing new ones.
8. **Stages and sequencing.** The build stages after G8 merges, the rolling-freeze consequence (`self/` cannot use it until the release after), and the acceptance program: wp15 item 3's cursor and the `getByte` example.

The note is a design and must say so in its own status line.

## Out of scope

- Implementing ranged integers, and anything G8 run #162 owns.
- WP21 S3's remainder: package identity and symlinks, builtin-without-runtime, dependency error attribution. S4 and S5 are also out.
- Threads (WP20, WP29): these are 1.1 work.
- Using `Pair` in `self/` (for example `self/lexer.ts`'s `scanEscape`): this needs the next release first, because of the rolling freeze.

## Tests

Mirror the existing cases:
- `tests/cases/arr_header_hoist`, `arr_bounds_shrink_panic` and `perf_bounds_*` for bounds-paths;
- `tests/link/package_bare`, `package_mode_order` and `package_not_nish` for package-diagnostics;
- `tests/cases/reject_std_unknown_module` and the `std/text` cases for pair.

## Verification

Every code stage runs:

```bash
npm run check
npm test            # undegraded: no DEGRADED line; state the skip count in the PR
npm run lint        # no new warnings
node docs/check-links.mjs
bash docs/cookbook/regen.sh --check
node scripts/gen-diagnostic-codes.mjs --check
```

After the last merge, acceptance runs the same set on merged `main`, plus `scripts/bootstrap.sh --verify`.
