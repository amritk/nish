---
name: Machine-applicable fixes on diagnostics
overview: Give a --json diagnostic an optional "fix" array of edits, implement the fix for every mechanical row of docs/AI.md "What you must unlearn", and add `nish --fix <files>` that applies them and recompiles until nothing changes or 5 rounds pass — so an agent's next attempt compiles.
stages:
  - id: core
    title: "feat(cli): carry a machine-applicable fix on a diagnostic, and apply it with nish --fix"
    goal: The fix field, the edit applier, the --fix driver, the test harness for fix cases and the first fix (loose equality) land end to end.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, skip count read) && npm run test:cli && node docs/check-links.mjs
    todos:
      - id: core-edit-model
        content: Add an Edit class and an optional edits list to Diagnostic in src/diagnostics.ts, emitted by json() as a trailing "fix" key only when non-empty — see Core → Data model
      - id: core-report-api
        content: Add the sink and context entry points that report an error, a performance or a portability warning with edits (src/diagnostics.ts, src/context.ts) — see Core → Reporting API
      - id: core-loose-eq
        content: Attach the == to === and != to !== fix at both loose-equality sites (src/validator.ts, src/expressions.ts) — see Core → First fix
      - id: core-apply
        content: Write src/fix.ts — convert edits to byte offsets, drop overlaps, apply back to front, and the 5-round driver — see Core → nish --fix
      - id: core-cli-flag
        content: Add --fix to src/compile.ts and the usage line, with the exit-code contract — see Core → nish --fix
      - id: core-harness
        content: Add tests/fix/ cases (input, expected output, compiles clean) and their runner section in tests/run.js, with the eq_ cases — see Core → Tests
      - id: core-cli-contract
        content: Pin the fix field contract in tests/nish/cli.ts — present with exact positions on ==, absent on a diagnostic with no safe fix — see Core → Tests
      - id: core-docs
        content: Document the fix field and nish --fix in AGENTS.md (Machine-readable surfaces) and docs/AI.md (The loop) — see Core → Docs
  - id: expr-fixes
    title: "feat(cli): fix truthiness, String(n), Map.get and call-site type arguments mechanically"
    goal: Every mechanical unlearn row whose diagnostic is reported by the expression checker carries a fix.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, skip count read) && npm run test:cli
    todos:
      - id: expr-truthiness
        content: Fix a non-boolean condition by its type — see Expression fixes
      - id: expr-string
        content: Fix String(n) and n.toString() with no arguments to a template literal — see Expression fixes
      - id: expr-map-get
        content: Fix m.get(k) used as a value to m.get(k) ?? the zero of V, where V has one — see Expression fixes
      - id: expr-type-args
        content: Fix a type argument written at a call site by deleting it — see Expression fixes
      - id: expr-cases
        content: Add a tests/fix/expr_ case per fix plus one per refused shape (no fix emitted) — see Expression fixes
  - id: decl-fixes
    title: "feat(cli): fix export default, export lists, type-only imports, fs imports and the range guard mechanically"
    goal: Every mechanical unlearn row whose diagnostic is reported by the declaration, module or performance passes carries a fix.
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, skip count read) && npm run test:cli
    todos:
      - id: decl-export-default
        content: Fix export default f and export { f } by moving export onto the declaration — see Declaration fixes
      - id: decl-import-type
        content: Fix import type { T } to import { T } — see Declaration fixes
      - id: decl-fs
        content: Fix a bare fs specifier to nish:fs when every imported name exists there — see Declaration fixes
      - id: decl-range-guard
        content: Fix NL9007 with a panic guard before the statement, or no fix if the range analysis does not credit it — see Declaration fixes
      - id: decl-cases
        content: Add a tests/fix/decl_ case per fix plus one per refused shape (no fix emitted) — see Declaration fixes
---

# Machine-applicable fixes on diagnostics

## Context

`nish --json` prints one flat object per diagnostic ([`src/diagnostics.ts`](../../src/diagnostics.ts) `Diagnostic.json()`), and [`docs/AI.md`](../../docs/AI.md) "What you must unlearn" lists the reflexes it rejects together with what to write instead. Many of those rewrites are mechanical, but an agent still has to read the prose and redo the edit itself. This work attaches the edit to the diagnostic and adds `nish --fix`.

`nish:unsafe` and `using a = arena()` have **not landed** (no hit in `src/`, `runtime/`, `docs/`), so their migrations are out of scope.

## Approach

- **The fix is data on the diagnostic, not a second pass.** The site that knows the rule knows the span and the replacement, so it reports both. No later pass re-derives a rewrite from a message.
- **A fix is all-or-nothing and behaviour-preserving.** A diagnostic gets a fix only when applying it gives a program whose meaning is what the author plainly meant and whose TypeScript reading is unchanged. Any doubt (an unknown zero, an ambiguous `string | null` truthiness, a radix argument) means no fix — the field is left out, never emitted empty.
- **Positions match the diagnostic.** Each edit is `{line, column, endLine, endColumn, text}`, 1-based, columns in UTF-16 code units, end exclusive — the same convention `columnOf` already uses. An insertion has start = end.
- **Byte-stable for everything else.** The `fix` key is appended after `message`, so every existing `--json` line without a fix is byte-identical to today.
- **No new language construct.** Nothing here changes what a program means, so there is no golden `.ll`, `LANGUAGE.md` rule or cookbook entry; the surface is a CLI flag and a JSON field, documented where the `--json` contract already is.

## Core

**Owns:** `src/diagnostics.ts`, `src/context.ts`, `src/validator.ts`, `src/expressions.ts` (the loose-equality site only), `src/compile.ts`, `src/fix.ts` (new), `src/options.ts`, `tests/fix/eq_*`, `tests/fix/README.md`, `tests/run.js`, `tests/nish/cli.ts`, `AGENTS.md`, `docs/AI.md`, `tests/self/goldens/**` (regenerated only), `tests/wordings/**` (only if a pin must move), `knip.json`

### Data model

```ts
export class Edit {           // one replacement; start === end is an insertion
  start: i32                  // byte offset into source.text
  end: i32
  text: string
}
// Diagnostic gains `edits: Edit[]` (empty by default); json() appends
// ,"fix":[{"line":L,"column":C,"endLine":EL,"endColumn":EC,"text":"..."}]
// only when edits.length !== 0, using source.lineOf / source.columnOf.
```

### Reporting API

`DiagnosticSink.reportFix(source, start, end, text, edits)` plus the performance and portability equivalents, and `ctx.errorFix(node, text, edits)` / `ctx.performanceFix(...)` in [`src/context.ts`](../../src/context.ts) with an `edit(start, end, text)` helper. Later stages call only these.

### First fix

`==` → `===` and `!=` → `!==`, at [`src/validator.ts:166`](../../src/validator.ts) and [`src/expressions.ts:708`](../../src/expressions.ts). The edit replaces the operator token only.

### nish --fix

`nish --fix <files> [flags]`: compile; collect every edit for a file named on the command line (never one under `node_modules`, `std/` or a `nish:` module); drop any edit that overlaps an earlier one in the same file (the next round picks it up); apply back to front; write the file; recompile. Stop when a round applies nothing, or after 5 rounds. Then report the final compile's diagnostics as a normal run would (human or `--json`), and exit with its code. `--fix` combined with `-o`/`--link` is a usage error (exit 2). A file with no edits is never rewritten.

### Tests

- `tests/fix/<name>.ts` (input) and `tests/fix/<name>.fixed.ts` (expected). The runner section in `tests/run.js` copies the input to a temp dir, runs `nish --fix` on it, compares the result with `.fixed.ts` byte for byte, then compiles `.fixed.ts` with `--json` and requires no error object and exit 0. A `<name>.nofix.ts` case asserts the diagnostic is reported with **no** `fix` key and `--fix` leaves the file byte-identical.
- Core's cases: `eq_loose`, `eq_loose_not`, `eq_multi_round` (proves the round loop: two overlapping fixes applied over two rounds), `eq_nofix_throw` (a diagnostic with no safe fix).
- [`tests/nish/cli.ts`](../../tests/nish/cli.ts): `--json` on `a == b` has `fix` with the exact span of `==`; `throw` has no `fix` key; `--fix` with `-o` is exit 2; `--help` names `--fix`.

### Docs

[`AGENTS.md`](../../AGENTS.md) "Machine-readable surfaces": the field, its shape and positions, that it is absent rather than empty, and that a fix is behaviour-preserving. [`docs/AI.md`](../../docs/AI.md) "The loop": a sample object with `fix`, and `nish --fix program.ts` in the command block.

## Expression fixes

**Owns:** `src/expressions.ts`, `src/builtins.ts`, `src/members.ts`, `src/generics.ts`, `src/types.ts`, `tests/fix/expr_*`, `tests/self/goldens/**` (regenerated only). **Depends on:** core (development and merge).

| row | fix | no fix when |
| --- | --- | --- |
| `if (xs.length)` (condition not boolean) | number → `(e) !== 0`; `T \| null` → `e !== null`; `string` → `e.length !== 0` | `string \| null`, anything else |
| `String(n)` | `` `${n}` `` | more than one argument |
| `n.toString()` | `` `${n}` `` | any argument (a radix) |
| `m.get(k)` held in a `let`, passed, or used in arithmetic | append ` ?? <zero>` (`0`, `0.0`, `""`, `false`) | V is a class, array, Map, Set or nullable |
| `f<T>(…)`, `h.get<T>(…)` | delete `<T>` | — |

Parenthesise the operand whenever its precedence is below the inserted operator. Cases: `expr_truthy_number`, `expr_truthy_nullable`, `expr_truthy_string`, `expr_string_call`, `expr_to_string`, `expr_map_get_let`, `expr_map_get_arith`, `expr_type_args`, and `expr_nofix_*` for each "no fix when".

## Declaration fixes

**Owns:** `src/checker.ts`, `src/statements.ts`, `src/declarations.ts`, `src/compilation.ts`, `src/ranges.ts`, `src/bounds.ts`, `tests/fix/decl_*`, `tests/self/goldens/**` (regenerated only). **Depends on:** core (development and merge).

| row | fix | no fix when |
| --- | --- | --- |
| `export default f` | delete the statement, insert `export ` before `const f` | `f` is not a top-level declaration of this module, or is already exported |
| `export { f, g }` | delete the list, insert `export ` before each declaration | any name is a re-export, renamed (`as`), or not declared here |
| `import type { T } from "./m"` | delete `type ` | — |
| `import { readFileSync } from "fs"` | `"fs"` → `"nish:fs"` | any imported name is not exported by `nish:fs` |
| NL9007 range guard | insert `if (!(i >= 0 && i < xs.length)) { panic("…") }` before the statement holding the access, so out of range still ends the process (decided at sign-off) | the range analysis does not credit that guard (then no NL9007 fix at all, and the reason goes in the PR body), or no statement boundary reaches the access |

Cases: `decl_export_default`, `decl_export_list`, `decl_import_type`, `decl_fs`, `decl_range_guard`, and `decl_nofix_*` for each "no fix when".

## Out of scope

- `nish:unsafe` and `using a = arena()` migrations — not landed.
- Rows with no mechanical rewrite: `throw`, `try`, array methods, string methods, `?.`, casts, `typeof`, unions, classes with `extends`, destructuring, `async`, `JSON`, `Date`, generic aliases.
- Fixes for syntax errors (NL0001) and toolchain/internal failures.
- An LSP code-action surface.

## Shared generated files

`tests/self/goldens/checked-self.txt` (and possibly `checked.txt`) is a dump of `src/`, so expr-fixes and decl-fixes both regenerate it. Per [`CLAUDE.md`](../../CLAUDE.md), whichever merges second merges `main` in and re-runs `node tests/self/goldens.js --update` — never hand-resolves it. This is the one path the two concurrent stages share, by the repo's own rule.

## Decisions taken at sign-off

- **Coverage gate.** There is no line-coverage tool for Nish. The gate is an undegraded `npm test` plus a `tests/fix/` case for every fix and every "no fix when" shape; a fix without its case is a blocking review finding.
- **NL9007.** The fix never turns an out-of-range panic into a silent skip. A panic guard if the analysis credits it, otherwise no fix.
- **Merge.** Autonomous squash-merge per AGENTS.md once the gate passes.

## Verification

`npm run check`, `npm run lint`, `npm run lint:dead`, `npm test` with the summary read (zero failed; skips only the three environmental ones AGENTS.md names), `npm run test:cli`, and `node docs/check-links.mjs` for a Markdown change.
