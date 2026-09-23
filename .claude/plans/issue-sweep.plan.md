---
name: Issue sweep — the open bugs on main after language-gaps
overview: Fix the eight open issues that are still reproducible on main 0f4211f (#180–#183 bounds and attribute soundness, #173–#175 cross-module and generic diagnostics, #107 and #110 registry and docs hygiene) in five independent PRs, add the CI check #176 asks for in a sixth, and close the three issues whose work has already landed (#140, #96, #94).
stages:
  - id: bounds-soundness
    title: "fix(checker): bounds proofs see continue edges, lazy Result arguments and whole-record stores"
    goal: Every access the bounds walk or the header hoist leaves unchecked is still in range on every edge that reaches it (#181, #182, #180)
    verification: npm run check && npm test (undegraded) — with the new must-panic cases for #181, #182 and #180 passing and std/ still at zero performance warnings
    todos:
      - id: bs-continue-edge
        content: Join the state at every continue into the for update and the do/while condition in walkBoundsStatement (self/bounds.ts) — see Bounds soundness
        status: pending
      - id: bs-lazy-result
        content: Walk the unwrapOr fallback and the expect message in a cloned state in walkExpression N_CALL (self/bounds.ts) — see Bounds soundness
        status: pending
      - id: bs-record-store
        content: Make storedFields (self/emit_arrays.ts) refuse the hoist after an element store of a record, sharing storesRecord with self/bounds.ts — see Bounds soundness
        status: pending
      - id: bs-tests
        content: Add must-panic round trips for each edge (for and do/while, path and local, unwrapOr and expect, const record view) — see Tests
        status: pending
  - id: class-identity
    title: "fix(checker): same-named interfaces and classes across modules keep their identity"
    goal: A same-named interface from another module no longer accepts an unrelated class (#173), and a cross-module method or constructor clash reports a real NL3xxx code (#174)
    verification: npm run check && npm test (undegraded) && node scripts/gen-diagnostic-codes.mjs --check && npm run test:cli
    todos:
      - id: ci-coerces-to
        content: Make coercesTo and checkImplements (self/structs.ts) resolve the interface declaration instead of comparing names, reusing implementsDeclaration from self/generics.ts — see Class identity
        status: pending
      - id: ci-clash-code
        content: Give each clashMessage wording in self/compilation.ts its own NL3xxx code in self/codes.ts, naming the class for a method or constructor clash, and lower UNCODED_BACKLOG in tests/run.js — see Class identity
        status: pending
      - id: ci-stale-comment
        content: Rewrite the stale stage0 comment at self/structs.ts ~505-543 (the one-diagnostic-per-declaration rule) to describe the current compiler — see Class identity
        status: pending
      - id: ci-tests
        content: Add tests/link negatives for #173 and #174 and wordings cases for each new code, and add the codes to AGENTS.md and tests/nish/cli.ts where the table lives — see Tests
        status: pending
  - id: generic-display
    title: "fix(checker): name the instantiation, not the template, in new-expression diagnostics and the checked dump"
    goal: Constructor-argument and arity errors on a generic class say new Box<i32>, and --emit-checked prints the callee of a generic new (#175)
    verification: npm run check && npm test (undegraded)
    todos:
      - id: gd-labels
        content: Build the checkNew labels in self/members.ts from the instantiated type name — see Generic display
        status: pending
      - id: gd-dump
        content: Print the callee of a new-expression in self/dump.ts walkBody from program.nodeCallees, and regenerate tests/self/goldens — see Generic display
        status: pending
      - id: gd-comment
        content: Correct the Instantiation.template and owner comments in self/program.ts for a generic method on a generic class — see Generic display
        status: pending
      - id: gd-tests
        content: Add reject_generic_new_* cases pinning both wordings — see Tests
        status: pending
  - id: main-willreturn
    title: "fix(codegen): a function whose unproven charCodeAt can panic is not willreturn"
    goal: Under --profile speed a program whose main always panics through charCodeAt still panics, because the fixpoint counts nish_panic_index for an unproven charCodeAt (#183)
    verification: npm run check && npm test (undegraded) — with the new speed-profile must-panic round trip passing and the bootstrap at its fixed point
    todos:
      - id: mw-callees
        content: Add nish_panic_index to the callees of an unproven, checked charCodeAt (self/emit_strings.ts stringConstructCallees or self/attributes.ts ~906) — see Main willreturn
        status: pending
      - id: mw-audit
        content: Audit every other emitRangeCheck caller in the emitter for the same gap and fix any found — see Main willreturn
        status: pending
      - id: mw-tests
        content: Add a speed-profile must-panic round trip and regenerate the .ll goldens, tests/self/goldens and nish-cmp DECLARED entries this moves — see Tests
        status: pending
  - id: registry-docs
    title: "test(codes): the registry check counts every fragment line, and wp15 names its benchmark"
    goal: A stray fragment line in a self/codes.ts table fails the check (#107), and wp15 §2c's table names the program and box behind its numbers (#110)
    verification: node scripts/gen-diagnostic-codes.mjs --check && node docs/check-links.mjs && npm test (undegraded)
    todos:
      - id: rd-pair-count
        content: Count every string-literal line in each self/codes.ts table in scripts/gen-diagnostic-codes.mjs problems() and require it to be twice the pairs, plus contiguous NL9 codes — see Registry and docs
        status: pending
      - id: rd-wp15
        content: Name bench/hoist_field.ts, the box and the statistic beside the §2c table in docs/wp15-performance.md, and correct the NL9010 wording that #108 disputes — see Registry and docs
        status: pending
  - id: pr-body-check
    title: "ci: fail a pull request whose body carries a session link or tool attribution"
    goal: The attribution rule the PreToolUse hook enforces on tool calls is also enforced by CI on the PR body, which catches a footer appended after creation (#176)
    verification: node .claude/hooks/no-attribution.test.mjs && node scripts/check-pr-body.test.mjs && npm test (undegraded)
    todos:
      - id: pb-patterns
        content: Move BANNED out of .claude/hooks/no-attribution.mjs into a module both the hook and CI import — see PR body check
        status: pending
      - id: pb-script
        content: Add scripts/check-pr-body.mjs that reads the body from the environment and exits 1 naming each banned pattern — see PR body check
        status: pending
      - id: pb-workflow
        content: Add .github/workflows/pr-body.yml running it on opened, edited, reopened and synchronize — see PR body check
        status: pending
      - id: pb-tests
        content: Add scripts/check-pr-body.test.mjs covering a clean body, each banned pattern and a body that only names the rule — see Tests
        status: pending
---

## Context

Main is at 0f4211f, after the language-gaps run (#170). A triage against that head found:

| # | state on main | where it goes |
|---|---|---|
| #181 | reproduced (paths and locals), HIGH, a regression from #179 | bounds-soundness |
| #182 | reproduced | bounds-soundness |
| #180 | reproduced (`const r = rs[0]` form of `arr_path_record_store`) | bounds-soundness |
| #183 | reproduced, but the cause is `charCodeAt` missing from `stringConstructCallees`, not the carve-out the issue names | main-willreturn |
| #173 | reproduced as a layout miscompile (`NaN`, then out of memory) | class-identity |
| #174 | reproduced; all four `clashMessage` wordings are uncoded | class-identity |
| #175 | all three items confirmed | generic-display |
| #107 | its premise went with R6; a real hole remains (a stray fragment line shifts every pairing) | registry-docs |
| #110 | mostly fixed by #179; §2c's own table still names no program | registry-docs |
| #108 | still silent; the issue calls the fix a judgement call | wording only, in registry-docs (owner decision); the issue stays open |
| #176 | the hook cannot see a footer the platform appends after creation | pr-body-check (owner chose a CI check) |
| #140, #96, #94 | the work landed (R6, #101/#102, #134) | lead closes with a comment |

## Approach

- **Six stages, all against main, all concurrent.** No stage consumes an interface another introduces, so there are no development edges. #180 joins the bounds stage rather than standing alone because its fix wants `storesRecord` from `self/bounds.ts`.
- **Merge order is by risk**: bounds-soundness (the HIGH one) first, then generic-display, class-identity, registry-docs, and main-willreturn last because its golden churn is largest. pr-body-check edits `.github/workflows/**`, a sensitive path, so the lead takes it to green and reviewed and the owner merges it. The lead merges one at a time; the rest merge `main` in and regenerate.
- **Shared, regenerated files** — never hand-merged, always rebuilt with the tooling after merging `main`: existing `tests/cases/*.ll` goldens (`UPDATE_GOLDENS=1 node tests/run.js <case>`), `tests/self/goldens/**`, `tests/nish-cmp.js` DECLARED entries, `tests/perf-baseline.json`. **Shared-append files**, where each stage adds only its own lines: `tests/run.js` (case registrations), `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`.
- `CHANGELOG.md` is not edited: it is generated from commit subjects and bodies.

## Bounds soundness

**Owns:** `self/bounds.ts`, `self/emit_arrays.ts`, `tests/cases/arr_bounds_continue_*`, `tests/cases/arr_bounds_lazy_*`, `tests/cases/arr_path_continue_*`, `tests/cases/arr_header_hoist_record_*`, `tests/cases/arr_path_record_store.*` + shared.

- **#181.** `N_CONTINUE` returns "exits", so `N_IF` drops that branch's state, and the `for` update (`N_FOR` ~1842) and `do/while` condition (`N_DO` ~1832) are walked in the end-of-body state. Carry the state at each `continue` out of the body and intersect it with the fall-through state before walking the update or the condition. The conservative fallback, `forgetAcross` the body, is acceptable only if the precise join is not possible — and must be measured against the `std/` zero-warning gate (#158) and `tests/perf-baseline.json`.
- **#182.** In `walkExpression` `N_CALL`, recognise `unwrapOr` and `expect` on a Result receiver (use the helper `self/emit_result.ts` or the checker already uses to name Result methods). Walk the `unwrapOr` argument in a cloned state and intersect it back, as `walkBinary`'s `&&`/`||` does. For `expect`, walk the message in a clone and drop it, since that path exits.
- **#180.** In `storedFields`, an `N_INDEX` store whose element type is a record sets `opaque = true`. Export `storesRecord` from `self/bounds.ts` and call it, rather than writing a second copy of the rule. Update the header comment of `tests/cases/arr_path_record_store.ts`, which describes this bug as open.

## Class identity

**Owns:** `self/structs.ts`, `self/generics.ts`, `self/compilation.ts`, `self/codes.ts`, `AGENTS.md`, `tests/nish/cli.ts`, `docs/wp18-generics.md`, `tests/link/iface_same_name_*`, `tests/link/class_clash_*`, `tests/wordings/nl3*` (new files only) + shared.

- **#173.** `coercesTo` (`self/structs.ts` ~725) compares `name === wanted.name`. Resolve the declaration the way #167's `implementsDeclaration` (`self/generics.ts` ~1432) does: export it, or record the resolved `StructInfo` next to `implementsNames` (~596). Audit `checkImplements` (~620), which also scans by name.
- **#174.** Each wording in `clashMessage` (`self/compilation.ts` ~1066) gets a code: the next free NL3xxx numbers, fragments inserted longest-first, `RULE_COUNT` bumped (`node scripts/gen-diagnostic-codes.mjs` prints the next free code). A method or constructor clash names the class (for example `Class Base is declared with a constructor in both main.ts and lib.ts`), because two same-named classes with no methods do compile. Lower `UNCODED_BACKLOG` in `tests/run.js` by the number of wordings coded and correct its comment.
- **#94 leftover.** The comment at `self/structs.ts` ~505-543 describes stage0 and `src/checker/classes.ts` in the present tense and says its rule "has an expiry at R6". Rewrite it to state the rule as this compiler's own; do not change the behaviour.

## Generic display

**Owns:** `self/members.ts`, `self/dump.ts`, `self/program.ts`, `tests/cases/reject_generic_new_*` + shared (`tests/self/goldens/checked.txt` is regenerated).

- `checkNew` (`self/members.ts` ~281, ~286) builds `new ${name}` from the template's name. Use the instantiated type's display name (`table.typeName(info.type)`), so the labels read `new Box<i32>`.
- `walkBody` (`self/dump.ts` ~247) looks a callee up by `program.struct(text)`, which misses templates. Read `program.nodeCallees[node.id]`, which `checkNew` already sets.
- Correct the `Instantiation.template` / `owner` comments (`self/program.ts` ~290-305): a generic method on a generic class has both set.

## Main willreturn

**Owns:** `self/attributes.ts`, `self/emit_strings.ts`, `tests/cases/attr_panic_*` + shared (existing `.ll` goldens, `tests/self/goldens/**` and nish-cmp DECLARED entries are regenerated).

- The `charCodeAt` path emits `emitRangeCheck` → `nish_panic_index` (`self/emit_strings.ts` ~217) when the index is unproven, but `stringConstructCallees` (~345) returns nothing for it. That leaves `willreturn` on the caller, and on `nish_main`. Add the callee under the same condition the emitter uses (unproven, and not `uncheckedIndexing`), mirroring `self/attributes.ts` ~1064 for `xs[i]`.
- Then audit every other `emitRangeCheck` / `nish_panic_*` emission site for a callee the fixpoint does not see, and fix the ones found. The rule is `.claude/orientation.md` §3: no attribute without a proof.

## Registry and docs

**Owns:** `scripts/gen-diagnostic-codes.mjs`, `scripts/codes-registry.js`, `docs/wp15-performance.md`.

- **#107.** `codeFor` (`self/codes.ts` ~919) steps through each table by two. A fragment line without its code line is skipped by the `PAIR` regex and shifts every later pairing. In `problems()`, count every string-literal line per table and require the count to be twice the pairs. Also require the NL9 codes to be contiguous. Pin both checks with a mutation: a temporary copy with one stray line must fail.
- **#110.** Beside the §2c table (~685-697), name `bench/hoist_field.ts`, the box and the statistic, and point at the reconciliation that is already later in the file.
- **#108 wording.** `docs/wp15-performance.md` ~1746 says an `implements` class has no rewrite NL9010 can name. Correct it: the prefix is fixed, and the suffix is not. Whether to *implement* the suffix check depends on the owner's answer, and it is not in this stage.

## PR body check

**Owns:** `.claude/hooks/no-attribution.mjs`, `.claude/hooks/no-attribution.test.mjs`, `.claude/hooks/attribution-patterns.mjs` (new), `scripts/check-pr-body.mjs` (new), `scripts/check-pr-body.test.mjs` (new), `.github/workflows/pr-body.yml` (new). `AGENTS.md` belongs to class-identity, so this rule is documented in the header comments of the workflow and the hook.

- The hook ends in `process.exit(main())`, so CI cannot import it. Move `BANNED` (and the restoration of escaped newlines) into `.claude/hooks/attribution-patterns.mjs`. The hook and the script both import it, so there is one list.
- The script reads `BODY` from the environment. Never interpolate `${{ }}` into `run:`, for the same reason `pr-title.yml` gives. It prints each banned pattern's name and exits 1, and exits 0 for an empty body.
- The workflow mirrors `pr-title.yml`: `pull_request` with `[opened, edited, reopened, synchronize]`, `permissions: contents: read`, and a concurrency group. Because of `edited`, removing the footer clears the red check.
- A PR carrying an appended footer fails this check by design. The fix is to edit the body, never the pattern list.

## Out of scope

- #108's implementation (the owner chose the wording fix only).
- Issue and PR *comments*: CI can only see the PR body; the hook still covers comments.
- WP21 S3's remainder (package identity through a symlink), which the #170 acceptance saw as `NL0000`. #174 codes the clash wording that refusal uses, but it does not change package identity.
- `.github/workflows/**`: only pr-body-check edits CI, and it only adds a file.

## Tests

Every fix ships a regression that fails on 0f4211f:

- **bounds-soundness:** must-panic round trips registered the way `arr_path_callee_pop` is in `tests/run.js`. That means `for` and `do/while` × path and local for #181, `unwrapOr` and `expect` for #182, and the `const r = rs[0]` form for #180. Each must exit 1 with `index out of range`. Add one positive case for #181 showing a loop without a `continue` store keeps its proof.
- **main-willreturn:** the charCodeAt reproducer from #183 built with `--profile speed`, which must exit 1 with the index panic, plus a golden showing `@nish_main` without `willreturn`.
- **class-identity:** `tests/link/iface_same_name_*` must be refused with a stable code, not compile. `tests/link/class_clash_*` and one `tests/wordings/nl3xxx_*` pair per new code.
- **generic-display:** `reject_generic_new_args` and `reject_generic_new_arity`, pinning `new Box<i32>` in the `.err` files.
- **registry-docs:** the mutation check above.
- **pr-body-check:** `scripts/check-pr-body.test.mjs` needs a clean body (exit 0), one body per banned pattern (exit 1, the pattern named), a body that names the `Claude-Session:` trailer in running prose (exit 0), and the #169 footer verbatim (exit 1). `node .claude/hooks/no-attribution.test.mjs` must still pass unchanged.

## Verification

Every stage, before its PR: `npm run check`, then `npm test` read for `N passed, 0 failed` with no `DEGRADED:` banner, `npm run lint` with no new warnings, `node scripts/gen-diagnostic-codes.mjs --check`, and `node docs/check-links.mjs` when docs changed. `self/` stages also rely on `npm test`'s bootstrap fixed point.
