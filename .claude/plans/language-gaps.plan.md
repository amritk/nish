---
name: LANG — Language, runtime and codegen gaps from real programs
overview: Gaps found by real programs (a C++ formatter in Nish, a recursion benchmark, the discriminated-unions run) that the compiler still has to close — byte search and zero-fill on u8 and i32 arrays, checked-accumulator recursion beyond fib, and union shapes in the loop pre-pass.
priority: 70
issue: 1856
stages:
  - id: lang3-accumulator-recursion
    title: LANG 1 — widen the checked-accumulator recursion loop beyond i32 free-function sums
    goal: Overflow cases are pinned against the recursion under both the loop and no-elision by stdout, stderr and exit status, the comment gaps are closed, and at least one widening (methods, other widths) is proven or declined with a recorded reason.
    verification: node tests/run.js accumulate && node tests/run.js performance && node tests/nish-cmp.js && npm run lint
    status: pending
    issue: 1605
    todos:
      - id: l3-pin-overflow
        content: Run each panicking acc_overflow, acc_effects and acc_soundness case under the loop and --no-elision and compare stdout, stderr and exit status in tests/run.js — see LANG 1
        status: pending
      - id: l3-docs
        content: Point the emitter's comment at the recorder's argument in src/accumulate.ts and commit the tree-sum program under bench/ so docs/wp9-optimisation.md's 318 to 191 ms figure reproduces — see LANG 1
        status: pending
      - id: l3-widen
        content: Evaluate methods, other integer widths, arena-scope functions and an effect-free Y in src/accumulate.ts, each needing its own proof, and record which are built — see LANG 1
        status: pending
  - id: lang4-union-loop-gaps
    title: LANG 2 — close or re-scope the loop pre-pass accept-gaps LANGUAGE.md lists for unions
    goal: Either the union shapes are followed or refused, or they are documented as accept-gaps and pinned by a union_loop_join_gap case, and NL2559 and NL2523 print once per site.
    verification: node tests/run.js enum_loop_join_gap && node tests/run.js link && npm run check && npm run lint
    status: pending
    issue: 800
    labels: [needs-decision]
    todos:
      - id: l4-decide
        content: Record the decision between closing the union shapes and re-scoping them in docs/LANGUAGE.md around line 1276 — see LANG 2
        status: pending
      - id: l4-implement
        content: Follow a union tag held by a path in the loop pre-pass and make a union over 29 variants a refusal, or pin each shape in tests/cases/union_loop_join_gap.ts — see LANG 2
        status: pending
      - id: l4-double-print
        content: Make NL2559 and NL2523 print once per site, in text and --json, with a regression test — see LANG 2
        status: pending
---

# LANG — Language, runtime and codegen gaps from real programs

## Context
No roadmap page. These gaps came from real programs: the recursion follow-up #1605 and the unions run #800. The formatter tracker #1633's two open gaps, #1629 and #1630, are the same work as [WP65](../../docs/roadmap/wp65-lexer-surface.md) S1 and S2 and are tracked there; #1628, #1631 and #1632 are done.

## LANG 1 — widen the checked-accumulator recursion loop beyond i32 free-function sums
Issue #1605, a follow-up of #1582 and #1597. fib is at 0.93x and 0.89x of Rust, but only fib-like code moved (16 nish-cmp programs; nothing in `src/` or `std/`). Eligible set today (`src/accumulate.ts`): free `i32` functions, `+` only, no arena scope, no loops, `switch` or methods, `Y` a literal or parameter. Open: (2) overflow cases pinned by hand, not compared against the recursion byte for byte; (3) the reorder argument for `Y` lives only in `src/accumulate.ts`, and the tree-sum program is not under `bench/` (`bench/treesum.ts` exists, check whether it is that program). Recursive-descent parsers return nodes, so this technique will not reach them. The issue's proposed CLAUDE.md line is a human decision, not part of this stage.

## LANG 2 — close or re-scope the loop pre-pass accept-gaps LANGUAGE.md lists for unions
Issue #800. The behaviour holds (NL2531, `reject_union_narrow_second_*`), but `docs/LANGUAGE.md` still lists two union gaps (a tag held by a path, `h.k`; more than 29 variants, around lines 1276 and 1295), also in AI.md and `docs/guide/language/unions.md`. `tests/cases/enum_loop_join_gap.ts` pins only enum shapes. Also open: other enum-only loop gaps (a field read through an element or call, a receiver or `let` declared in the loop, a const copied from a tracked local, a ternary arm holding nothing), and NL2559 and NL2523 printing twice for one site. Evidence the double-print may persist: both codes are still in `src/codes.ts`.

### Decision needed
Close the union shapes or re-scope. Close: follow a union tag held by a path through the loop pre-pass and refuse more than 29 variants. Re-scope: keep them documented, pin each with `@ts-expect-error` in `union_loop_join_gap`, and amend #649's criterion 2. The owner's direction during the run was "real fixes, not accept-gaps".
