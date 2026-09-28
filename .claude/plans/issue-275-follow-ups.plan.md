---
name: The four follow-ups from issue 275
overview: Close the four small items the p2-ranged acceptance pass left in issue 275 — pin the two T-or-null proof refusals, make the Node run command actually call main, stop emitting a poison negation of INT_MIN, and stop a refused const from cascading into Unknown identifier errors. One stage per item, one PR per stage.
stages:
  - id: null-proof-pins
    title: "test(checker): pin the T | null twins of the keeps-proof refusals"
    goal: A test fails if the T-or-null ternary or array-literal form of issue 234 ever compiles again
    verification: node tests/run.js keeps_proof
    todos:
      - id: null-ternary-case
        content: Add tests/cases/reject_null_ternary_keeps_proof.ts and .err pinning NL2187 — see Stage 1
        status: pending
      - id: null-array-case
        content: Add tests/cases/reject_null_array_keeps_proof.ts and .err pinning NL2186 — see Stage 1
        status: pending
  - id: node-run-doc
    title: "docs: make the RUN_UNDER_NODE command call main"
    goal: The command docs/RUN_UNDER_NODE.md shows, run verbatim, runs the program's main and prints its output
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: node-doc-command
        content: Replace the command in docs/RUN_UNDER_NODE.md with the -e import-and-call-main form tests/run.js uses — see Stage 2
        status: pending
      - id: node-doc-check
        content: Run the documented command verbatim on the issue 224 program and one other f64 example and record the output in the PR — see Stage 2
        status: pending
  - id: fold-negated-literal
    title: "fix(codegen): fold a negated integer literal into its constant"
    goal: No negated integer literal emits a sub instruction, so INT_MIN negation is never sub nsw 0 on INT_MIN (poison)
    verification: node tests/run.js int_min && npm run check && npm test
    todos:
      - id: fold-in-emit-unary
        content: Fold unary minus on an integer literal operand into the negated constant in emitUnary, src/emit-ops.ts — see Stage 3
        status: pending
      - id: fold-goldens
        content: Regenerate the affected .ll goldens with the repo tooling, int_min_literal.ll included — see Stage 3
        status: pending
      - id: fold-cases
        content: Add a positive case for -0x80000000 in i32 and the i64 minimum with .ll and .out — see Stage 3
        status: pending
  - id: refused-const-binds-error
    title: "fix(checker): a refused const reports once, not at every later use"
    goal: A const whose initializer is refused is still declared, with the error type, so later uses report nothing
    verification: node tests/run.js reject_ && npm run check && npm test
    todos:
      - id: bind-error-type
        content: Declare the name with T_ERROR when the initializer is refused and there is no annotation, src/statements.ts — see Stage 4
        status: pending
      - id: pin-single-error
        content: Add a test that fails if a refused const produces more than one diagnostic — see Stage 4
        status: pending
---

## Context

Issue [#275](https://github.com/amritk/nish/issues/275) lists four follow-ups from the acceptance pass of #257, run on main at 60df17a. None is a regression; each is small and self-contained, so each is one stage and one PR. None adds a construct, so no `CHANGELOG.md` line is needed — the squash-merge subject is the release entry (CLAUDE.md, "Commit messages are the changelog").

The repo's gate is its definition of done, not a coverage command (there is none): `npm run check`, an **undegraded** `npm test` (read the skip count), `npm run lint`, `npm run lint:dead`, and `node docs/check-links.mjs` for Markdown changes.

## Stage 1 — pin the `T | null` twins

**Owns:** `tests/cases/reject_null_ternary_keeps_proof.*`, `tests/cases/reject_null_array_keeps_proof.*`

Mirror [reject_result_ternary_keeps_proof.ts](../../tests/cases/reject_result_ternary_keeps_proof.ts) and [reject_result_array_keeps_proof.ts](../../tests/cases/reject_result_array_keeps_proof.ts) with a struct-or-null value `r` narrowed to non-null and `q` narrowed to `null`:

- ternary — `const z = r.v > 0 ? r : q; console.log(`${z.v}`)` → NL2187 today;
- array — `const arr = [r]; arr.push(mk(false))` then reading a field of `arr[1]` → NL2186 today.

Each `.err` is the substring the refusal prints today (`.err` is a substring match, `tests/run.js` header). Confirm each case compiles cleanly once the refused line is removed, so the test pins the refusal and not an unrelated error. No compiler change; if either no longer refuses on main, stop and open the PR as a draft saying so.

## Stage 2 — the Node run command

**Owns:** `docs/RUN_UNDER_NODE.md`, `docs/INSTALL.md`

`node --experimental-strip-types --import ./runtime/nish.mjs prog.ts` loads the module and never calls `main`, so it prints nothing and exits 0. Decision: fix the page, not the runtime — show the form `tests/run.js` uses (`-e 'const m = await import("./prog.ts"); process.exit(m.main() ?? 0)'` or equivalent), say in one sentence why the `-e` is needed (an Nish program exports `main` rather than running at top level), and keep the rest of the page's claims intact. Making `runtime/nish.mjs` run `main` itself is out of scope: it would change the prelude's "rewrites nothing" contract. If `docs/INSTALL.md` repeats the broken command, fix it the same way.

## Stage 3 — fold a negated integer literal

**Owns:** `src/emit-ops.ts`, `tests/cases/*.ll`, `tests/link/**/*.ll`, `tests/cases/int_min*`, `tests/cases/neg_literal_*`, `docs/IR_COOKBOOK.md`

`emitUnary` in [src/emit-ops.ts](../../src/emit-ops.ts) emits `sub nsw <ty> 0, <value>` for every integer negation, so `-2147483648` in i32 mode is `sub nsw i32 0, -2147483648` — poison under LangRef, rescued only because `opt -O2` folds it. [int_min_literal.ll](../../tests/cases/int_min_literal.ll) pins that poison today. When the operand is an integer literal (after any parentheses the checker already sees through), emit the negated constant directly, wrapped to the type's width, instead of an instruction. Non-literal operands keep `sub nsw`.

This changes roughly 150 goldens (357 `sub … 0, <literal>` lines): regenerate them with `UPDATE_GOLDENS=1`, never by hand, and read a sample of the diff to confirm only the negation and the SSA renumbering changed. Add `tests/cases/neg_literal_int_min_hex.ts` (`-0x80000000` in i32) and an i64-minimum case, each with `.ll` and `.out`, and put the exact IR in the PR body (CLAUDE.md). Update `docs/IR_COOKBOOK.md` if it shows a literal negation; leave the historical `docs/wp*.md` alone.

## Stage 4 — a refused `const` reports once

**Owns:** `src/statements.ts`, `src/expressions.ts`, `src/context.ts`, `tests/run.js`, `tests/wordings/**`, `tests/cases/reject_const_*`, `tests/cases/reject_rng_array_zero_fill.*`, `tests/cases/reject_arrow_as_value.err`, `tests/cases/reject_unknown_ident.err`

[src/statements.ts](../../src/statements.ts) (`checkVariableDeclaration`, the `ctx.errored && (declared < 0 || declared === T_ERROR)` branch) deliberately leaves an unannotated, refused declaration undeclared, so every later use says ``Unknown identifier `x` ``. Declare it with `T_ERROR` instead, and make sure every use of an error-typed local is silent (the checker's existing `T_ERROR` suppression) and never reaches the emitter (compilation already stops on an error). Rewrite the comment above the branch — it explains the old stage0 parity that no longer applies.

Pin it: a test that fails if a refused `const` followed by two uses produces more than one diagnostic — `reject_rng_array_zero_fill` is the known pair on main. `.err` is a substring match, so this needs an exact count: use `--json` output or a count check in `tests/run.js`, whichever the harness already has a pattern for. Check the two `.err` files naming `Unknown identifier` still describe real (non-cascade) errors.

## Out of scope

- The `@types/node` TS2403 note at the end of #275 (documentation at most; not asked for).
- `fneg` on float literals, any other constant folding, and running `main` from the prelude.

## Verification

Per stage, its `verification` line; for every stage before the PR, the full definition of done: `npm run check`, undegraded `npm test`, `npm run lint`, `npm run lint:dead`, plus `node docs/check-links.mjs` when Markdown changed.
