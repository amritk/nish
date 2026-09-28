---
name: WP33 R1 (first half) — the parser reads all of TypeScript
overview: Make every construct the language forbids parse, so the phase that owns its rule refuses it with that rule's code and message instead of an NL0001 syntax error. Closes the 75 codes the parser pre-empts today (the "Retired at R6" parser rows of tests/wordings/unreachable.txt) plus a coded rule for for...in, in six sequential PRs.
stages:
  - id: stmt-refusals
    title: "feat(checker): refuse forbidden statements by their rule, not NL0001"
    goal: Establish the parse-then-refuse pattern and close the statement family — var, try, with, labels, for...in, for await, for-of without a declaration, top-level let and statements
    verification: npm run check && npm run lint && npm test (summary 0 failed, no DEGRADED line) && ! grep -E '^(NL1033|NL1036|NL1038|NL1046|NL2084|NL2133|NL2135|NL2230) ' tests/wordings/unreachable.txt
    todos:
      - id: pattern
        content: Decide and document the parse-then-refuse shape in src/nodes.ts and .claude/selfhost.md — see Approach
      - id: stmt-parse
        content: Parse var, try/catch/finally, with, labelled statements, for...in, for await, for-of over an expression, top-level let and top-level statements in src/parser.ts — see Stage 1
      - id: stmt-refuse
        content: Refuse each in src/validator.ts or the checker with its existing code, and add a new NL1056 for for...in — see Stage 1
      - id: stmt-registers
        content: Take the closed cases out of both parser-refusal registers and the R6 section of unreachable.txt, re-pin their .err files — see Registers
      - id: stmt-docs
        content: Update docs/LANGUAGE.md rows and the WP33 §5.0 table for the rows this closes, time bootstrap before and after — see Docs and measurement
  - id: expr-refusals
    title: "feat(checker): refuse forbidden expressions by their rule, not NL0001"
    goal: Close the expression family — loose equality, optional chaining, typeof, delete, void, in, instanceof, comma, exponent, await, yield, regex, as any/unknown, satisfies, dynamic import, array holes and spread, new on a non-identifier
    verification: npm run check && npm run lint && npm test (summary 0 failed, no DEGRADED line) && ! grep -E '^(NL1002|NL1004|NL1020|NL1025|NL1026|NL1034|NL1037|NL1039|NL1040|NL1047|NL1049|NL1050|NL1051|NL1052|NL2144|NL2210|NL2237|NL2254|NL2256) ' tests/wordings/unreachable.txt
    todos:
      - id: expr-parse
        content: Parse the 19 expression forms in src/parser.ts with the correct TypeScript precedence — see Stage 2
      - id: expr-refuse
        content: Refuse each with its existing code in src/validator.ts or the checker — see Stage 2
      - id: expr-registers
        content: Shrink the registers and unreachable.txt for the closed cases, re-pin .err files — see Registers
      - id: expr-docs
        content: Update docs/LANGUAGE.md and the WP33 §5.0 table rows, time bootstrap before and after — see Docs and measurement
  - id: decl-refusals
    title: "feat(checker): refuse forbidden declarations by their rule, not NL0001"
    goal: Close the Phase 0 declaration family — async, generators, decorators, namespace/module, declare global, generic type aliases, keyof, default type arguments
    verification: npm run check && npm run lint && npm test (summary 0 failed, no DEGRADED line) && ! grep -E '^(NL1006|NL1015|NL1019|NL1027|NL1044|NL1054|NL2038|NL2292) ' tests/wordings/unreachable.txt
    todos:
      - id: decl-parse
        content: Parse the eight declaration forms in src/parser.ts — see Stage 3
      - id: decl-refuse
        content: Refuse each with its existing code — see Stage 3
      - id: decl-registers
        content: Shrink the registers and unreachable.txt, re-pin .err files — see Registers
      - id: decl-docs
        content: Update docs/LANGUAGE.md and the WP33 §5.0 table rows, time bootstrap before and after — see Docs and measurement
  - id: fn-refusals
    title: "feat(checker): refuse forbidden function and binding forms by their rule, not NL0001"
    goal: Close the function and binding family — missing return types, destructuring, default and rest parameters, arrow forms, several names in one declaration, anonymous and body-less functions
    verification: npm run check && npm run lint && npm test (summary 0 failed, no DEGRADED line) && ! grep -E '^(NL2048|NL2096|NL2191|NL2192|NL2193|NL2203|NL2204|NL2209|NL2233|NL2235|NL2272|NL2273|NL2274) ' tests/wordings/unreachable.txt
    todos:
      - id: fn-parse
        content: Parse the thirteen function and binding forms in src/parser.ts — see Stage 4
      - id: fn-refuse
        content: Refuse each with its existing code — see Stage 4
      - id: fn-registers
        content: Shrink the registers and unreachable.txt, re-pin .err files — see Registers
      - id: fn-docs
        content: Update docs/LANGUAGE.md rows, time bootstrap before and after — see Docs and measurement
  - id: class-refusals
    title: "feat(checker): refuse forbidden class, interface and enum forms by their rule, not NL0001"
    goal: Close the class, interface and enum family — seventeen member and header forms
    verification: npm run check && npm run lint && npm test (summary 0 failed, no DEGRADED line) && ! grep -E '^(NL2018|NL2083|NL2090|NL2091|NL2092|NL2168|NL2189|NL2213|NL2214|NL2215|NL2223|NL2234|NL2253|NL2255|NL2257|NL2258|NL2286) ' tests/wordings/unreachable.txt
    todos:
      - id: class-parse
        content: Parse the seventeen class, interface and enum forms in src/parser.ts — see Stage 5
      - id: class-refuse
        content: Refuse each with its existing code, in the checker where the rule needs the class — see Stage 5
      - id: class-registers
        content: Shrink the registers and unreachable.txt, re-pin .err files — see Registers
      - id: class-docs
        content: Update docs/LANGUAGE.md rows, time bootstrap before and after — see Docs and measurement
  - id: module-refusals
    title: "feat(checker): refuse forbidden import and export forms by their rule, not NL0001"
    goal: Close the module family — ten import and export forms — and retire the now-empty R6 parser section and the registers' stale prose
    verification: npm run check && npm run lint && npm test (summary 0 failed, no DEGRADED line) && ! grep -E "^NL[0-9]+ +retired at R6. stage1's parser" tests/wordings/unreachable.txt
    todos:
      - id: mod-parse
        content: Parse the ten import and export forms in src/parser.ts — see Stage 6
      - id: mod-refuse
        content: Refuse each with its existing code — see Stage 6
      - id: mod-registers
        content: Shrink the registers, delete the empty R6 parser section, rewrite the registers' header prose to the new counts — see Registers
      - id: mod-docs
        content: Update docs/LANGUAGE.md and close out the WP33 §5.0 table and the wp19 602 row's forward note, time bootstrap before and after — see Docs and measurement
---

## Context

[docs/wp33-round-trip.md](../../docs/wp33-round-trip.md) §5.0: the parser stops at syntax the language forbids before the phase that owns the rule can name it, so an agent reading `--json` sees `NL0001 syntax error: expected ;, found IDENT` for `var x = 1` instead of `` `var` is forbidden; use `let` or `const` ``. wp19 costed this at "grammar for 43 constructs".

The mechanical inventory is larger. [tests/wordings/unreachable.txt](../../tests/wordings/unreachable.txt) lines 56–139, "Retired at R6", lists **75 codes** with the reason `stage1's parser refuses <case> before the rule is stated`. Every one already has its message fragment in [src/codes.ts](../../src/codes.ts) and a program under `tests/cases/` that provokes it. `for...in` has no code at all (LANGUAGE.md "Rejected statements"), so it is the 76th. That list, not the number 43, is the scope. Two other R6 rows (NL2260, NL2302) are `stage1_divergence.txt` rows, not parser rows, and are out of scope.

Three registers pin today's behaviour and must shrink as each rule is closed: [tests/self/parser-refusals.txt](../../tests/self/parser-refusals.txt) (109 entries, read by `reject-oracle.js`), [tests/wordings/parser_refusals.txt](../../tests/wordings/parser_refusals.txt) (41 cases, read by `diagnostic-coverage.js --strict-refusals`), and the R6 section of `unreachable.txt`. All three are checked in both directions by `npm test`, so a closed rule that is still listed fails, and so does a listed rule that stops failing.

## Approach

- **Parse what is written; refuse in the phase that owns the rule** ([.claude/selfhost.md](../selfhost.md) "Habits"). The parser builds a node for each forbidden form; NL1xxx rules are stated by Phase 0 ([src/validator.ts](../../src/validator.ts)), NL2xxx rules by the checker. The parser never states a rule's message itself.
- **Reuse the existing code and fragment.** `codeFor` in [src/codes.ts](../../src/codes.ts) matches the message by fragment, so each refusal's message must contain its code's registered fragment exactly. No code number is moved or reused; `for...in` takes the next free NL1 number, **NL1056**.
- **One diagnostic per construct.** Recovery after the refusal must not cascade: the WP33 §5.0 table's `Count` column becomes 1 for every row.
- **Stage 1 fixes the shape.** Whether a forbidden form becomes its own node kind (`N_VAR_DECL`, `N_TRY`, …) or a flag on an existing one is decided once, in stage 1, written into `.claude/selfhost.md`, and followed by every later stage. Prefer a flag on the node the construct resembles where it has one (the member-header family already did this for `x?: T` and `static` — see the header of `tests/wordings/parser_refusals.txt`); a new kind where it has none.
- **Rolling freeze.** `src/` may not *use* any of this syntax; it only has to parse it. Nothing here changes what compiles.
- **Strictly sequential.** Every stage edits `src/parser.ts`, `src/nodes.ts`, the validator, the three registers and `docs/LANGUAGE.md`, so no two stages can run at once without conflicting. Each stage branches from `main` after the previous one merges.

## Stage 1 — statements (`stmt-refusals`)

**Owns:** `src/**`, `tests/**`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/wp33-round-trip.md`, `CHANGELOG.md`, `.claude/selfhost.md`

| Construct | Code | Cases today |
| --- | --- | --- |
| `var` | NL1036 | reject_var_keyword, reject_var_in_for |
| `try` / `catch` / `finally` | NL1033 | reject_try_catch |
| `with` | NL1038 | reject_with_statement |
| labelled statement | NL1046 | reject_labeled_statement |
| `for (… in …)` | **NL1056 (new)** | none — add `reject_for_in` |
| `for await` | NL2133 | nl2133_for_await |
| `for (x of …)` without a declaration | NL2135 | reject_arr_forof_expression, nl2135_for_of_without_declaration |
| top-level `let` | NL2084 | reject_const_top_level_let |
| top-level statement | NL2230 | reject_top_level_stmt |

The pattern decision (Approach, fourth bullet) lands here, with the new NL1056 in `src/codes.ts` and its LANGUAGE.md row.

## Stage 2 — expressions (`expr-refusals`)

**Owns:** as Stage 1. **Depends on:** stmt-refusals.

`==` `!=` NL1047 · `?.` NL1049 · `typeof` NL1034 · `delete` NL1020 · `void` NL1037 · `in` NL1025 · `instanceof` NL1026 · comma NL1040 · `**` `**=` NL2254 · `await` NL1004 · `yield` NL1039 · regex literal NL1050 · `as any` NL1051 · `as unknown` NL1052 · `satisfies` NL2256 · `import(…)` NL1002 · array hole NL2210 · array spread NL2237 · `new` on a non-identifier NL2144.

Precedence and associativity follow TypeScript's (`**` is right-associative, `in`/`instanceof` are relational, `?.` binds like `.`). The regex literal needs the lexer's slash-vs-divide decision; the case is `reject_regex`.

## Stage 3 — declarations (`decl-refusals`)

**Owns:** as Stage 1. **Depends on:** expr-refusals.

`async` functions, methods, arrows NL1015 · `function*` NL1044 · decorators NL1006 · `namespace` / `module` NL1027 · `declare global` NL1019 · type parameters on a type alias NL1054 · `keyof` NL2038 · a default type argument NL2292.

LANGUAGE.md's rows for the generic type alias and the constructor type parameter currently document the *syntax error*; the alias row changes to NL1054's sentence.

## Stage 4 — functions and bindings (`fn-refusals`)

**Owns:** as Stage 1. **Depends on:** decl-refusals.

missing return type NL2096 · destructured `const` NL2191 · destructured parameter NL2192 · destructuring local NL2193 · default parameter NL2233 · rest parameter NL2235 · arrow bound with `let` NL2272 · annotated arrow binding NL2273 · two names in one declaration NL2274 · anonymous default function NL2203 · function without a body NL2204 · several declarators NL2048 / NL2209.

## Stage 5 — classes, interfaces, enums (`class-refusals`)

**Owns:** as Stage 1. **Depends on:** fn-refusals.

anonymous class NL2018 · `declare class` NL2083 · method without body NL2090 · constructor without body NL2091 · string member name NL2092 · `abstract` NL2168 · constructor return type NL2189 · class index signature NL2213 · interface index signature NL2214 · `interface … extends` NL2215 · object-literal string key NL2223 · parameter property NL2234 · compound operator on a field initialiser NL2253 · `static { }` NL2255 · interface construct/call signature NL2257 · object-literal method NL2258 · `declare enum` NL2286.

## Stage 6 — imports and exports (`module-refusals`)

**Owns:** as Stage 1. **Depends on:** class-refusals.

side-effect import NL2033 · `import * as` NL2119 · `export { … }` NL2128 · `export default <value>` / `export =` NL2129 · `export default` NL2130 · `export default class` NL2131 · default import NL2190 · template module specifier NL2212 · `export import x =` NL2226 · `import type` NL2243.

This stage also removes the then-empty R6 parser section of `unreachable.txt` and rewrites the header prose of both parser-refusal registers (their "45 constructs", "41 cases", "92 to 89" history) to state what is left and why.

## Registers

For every case a stage closes, in the same commit:

1. Remove its line from `tests/self/parser-refusals.txt` and, if present, `tests/wordings/parser_refusals.txt`.
2. Remove the code's line from the R6 section of `tests/wordings/unreachable.txt`.
3. Re-pin the case's `.err` to the rule's fragment (the `tests/wordings/nlNNNN_*.err` and `tests/cases/reject_*.err` files).

What stays a syntax error, on purpose: forms TypeScript itself refuses as syntax (numeric separators, octal and leading-zero literals, `#!` mid-file, `\u{…}` out of range, `||`/`??` mixing) and malformed input that is not a forbidden construct. Those entries stay in `parser-refusals.txt`.

## Docs and measurement

- `docs/LANGUAGE.md`: each closed row's Message column is the sentence the compiler now prints; "Rejected statements" gets NL1056's `for...in` sentence.
- `docs/wp33-round-trip.md` §5.0 table: update the `First diagnostic` and `Count` columns for the rows the stage closes.
- Changelog: the squash subject is the stage title (a conventional `feat(checker):` subject); the body says which codes became reachable. Add the `CHANGELOG.md` line only if the repo's current convention still asks for a hand-written one.
- Speed: time `scripts/bootstrap.sh --verify` on `main` and on the branch, and put both numbers in the PR body (wp33 §9: a stage that changes the parser times the compiler building itself).

## Out of scope

- The `portability` diagnostic class (WP33 §5.2, R1's other half).
- `fix` in `--json` (R5) and any change to the `--json` shape.
- Making any forbidden construct *compile*.
- NL2260 and NL2302 (`stage1_divergence.txt` rows, not parser rows).
- Line-coverage tooling: the repo has none, see Verification.

## Tests

Every closed code keeps the `reject_*` / `nlNNNN_*` case that already provokes it, now pinned to the rule; `reject_for_in` is new. `npm test` runs `diagnostic-coverage.js --strict-refusals` and `reject-oracle.js`, which fail if a register and the compiler disagree in either direction. No `.ll` golden moves and the bootstrap fixed point holds.

## Verification

```bash
npm run check
npm run lint
npm test          # read the summary: N passed, 0 failed, K skipped, and no DEGRADED: line
```

Plus each stage's `grep` in its `verification` field. There is no line-coverage command in this repo; the equivalent machine gate is `npm test`'s diagnostic-coverage check (every code in `src/codes.ts` provoked by a case or registered unreachable, registers may not grow) and the golden harness.
