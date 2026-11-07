---
name: Document the global builtins in JSDoc on runtime/nish.d.ts
overview: Move the API reference for Nish's global builtins out of docs/LANGUAGE.md → Builtins and onto their declarations in runtime/nish.d.ts (and typed JSON's onto std/json-typed.ts), so TypeDoc can generate the library reference from source. LANGUAGE.md keeps the normative rules and links to the reference.
stages:
  - id: globals
    title: "docs(runtime): document the global builtins in nish.d.ts"
    goal: Every global declaration in runtime/nish.d.ts and every export of std/json-typed.ts carries its reference documentation as JSDoc, and the listed LANGUAGE.md subsections keep only their rules plus a link to the reference
    verification: npm run check && npm run lint && node docs/check-links.mjs && node tests/run.js dts && node tests/run.js runtime-hosts && node tests/run.js json && node tests/self/goldens.js
    todos:
      - id: widths
        content: One-line JSDoc on each width alias (i32 … f64) and on integer<Lo, Hi> — see Declarations
      - id: core-globals
        content: JSDoc with @param and @returns on every top-level function and const in runtime/nish.d.ts before the first `declare module`, and class/member docs on every interface and `declare var` object (Result, Console, Process, StringConstructor, crypto, Arena, arena, Array.fill, …) — see Declarations
      - id: lib-surfaces
        content: Add merged `interface` declarations carrying Nish's own signatures and docs for Math, the array and string receivers, ReadonlyArray, Map and Set, and the typed-array note; reword the file header's Map/Set paragraph to match — see Lib-provided surfaces
      - id: capability-line
        content: Name each builtin's capability (or none) in its JSDoc, from LANGUAGE.md → Capabilities, which stays the normative table — see Declarations
      - id: json-typed
        content: JSDoc on std/json-typed.ts's exports (jsonDecode, jsonEncode, JsonDecoder, …) with the reference material of LANGUAGE.md → Typed JSON — see Typed JSON
      - id: trim-language
        content: In each listed LANGUAGE.md subsection, remove only reference material now carried by JSDoc, keep every rule, and add a link to the reference — see What moves and what stays
      - id: pointers
        content: Grep src/, tests/, docs/, std/, .claude/ and CLAUDE.md for anchors and quotes of every removed passage and move each pointer in the same PR — see Pointers
      - id: reference-link
        content: Point the subsections' reference link at the generated page if the generator has merged, else at runtime/nish.d.ts; regenerate the pages and inspect them if it has merged — see Reference link
---

## Stage: globals

**Owns:** `runtime/nish.d.ts` (top-level declarations only — never a line inside a `declare module "nish:*" { … }` block), `std/json-typed.ts`, `docs/LANGUAGE.md`, `tests/self/goldens/checked/**` (regenerated only), and pointer-only edits in `docs/**/*.md` (not `docs/reference/**`), `std/README.md`, `.claude/*.md`, `CLAUDE.md`, comments in `src/**` and `tests/**`.

One stage, one PR: the JSDoc and the LANGUAGE.md trim must land together, or a fact lives in neither place (or in both, drifting).

## Context

- `runtime/nish.d.ts` declares the global surface at the top (lines 1–~619), then `declare module "nish:*"` blocks from line 620, plus an `Arena` / `arena()` / `interface Array<T> { fill }` / typed-array-note section at the foot (~line 1134 on). **Another session documents the `nish:` module blocks in the same file, in parallel.** Do not touch any line inside them; keep hunks outside them so the two PRs merge cleanly.
- Many globals already carry a one-paragraph JSDoc. Keep that prose and add `@param`/`@returns`; do not rewrite comments that are already right.
- `Math`, the array/string receivers, `ReadonlyArray`, `Map` and `Set` are **not declared** in nish.d.ts today: `lib.es2022` supplies them. The header says a second `Map`/`Set` declaration would clash. That is true of `declare var Map`, not of `interface Map<K, V>`, which merges.
- Typed JSON is a `std/` module (`std/json-typed.ts`, imported as `nish/json-typed`). Its docs go there, not in nish.d.ts.
- The library-reference generator is being built in parallel (tracking issue #1233, branch `feature/library-reference/generator`). It runs TypeDoc over `std/**/*.ts` and `runtime/nish.d.ts` and writes `docs/reference/`. Its plan leaves open whether the globals get their own page (for example `docs/reference/builtins.md`) or are left out. Read its plan: `git show origin/feature/library-reference/plan:.claude/plans/library-reference.plan.md`.
- House style: `.claude/comments.md` and `.claude/typescript.md`. Say what a thing is, what it gives back and what it refuses, in the existing voice. Never narrate the change.

## Declarations

- **Function:** a description, `@param name` for every parameter, and `@returns` unless the function returns `void` or `never`. For `never`, say in the description that it ends the program.
- **Interface or `declare var` object:** a doc on the interface and a doc on every member.
- **Width aliases:** one line each (what it is, its range). `integer<Lo, Hi>` gets one short paragraph.
- **Capability:** end each builtin's description with its capability label from LANGUAGE.md → Capabilities (`Capability: fs.read.`), or `Capability: none.` Use one fixed wording everywhere.
- **Facts are copied exactly.** Errno values, panic messages, ranges and deviations from JavaScript are quoted from LANGUAGE.md, not paraphrased into something weaker. When LANGUAGE.md and an existing comment disagree, LANGUAGE.md wins; list the disagreement in the PR body.

## Lib-provided surfaces

Add `interface Math { … }`, `interface Array<T> { … }` (beside the existing `fill`), `interface ReadonlyArray<T>`, `interface String`, `interface Map<K, V>` and `interface Set<T>` declarations that merge into lib's, each member declared with **Nish's** signature (for example `min<T extends number>(a: T, b: T): T`) and its doc. They are extra overloads to `tsc`, never narrower than lib's, so a program `tsc` accepted before is still accepted. Prove that with `node tests/run.js dts`, plus one throwaway `tsc --strict` probe that is not committed. Declare only what Nish supports. The surface Nish defers (`entries`, `forEach`, …) stays undeclared, and the restrictions `tsc` cannot express stay in LANGUAGE.md. Rewrite the header's Map/Set paragraph to say what is declared now and why. If a merged declaration breaks `tsc` or the `runtime-hosts` check in a way that cannot be fixed inside these rules, leave that surface's docs in LANGUAGE.md and say so in the PR body. Do not weaken a test.

## Typed JSON

JSDoc every export of `std/json-typed.ts` with `@param`/`@returns`, and move the subsection's reference material (the call shapes, what each returns, the `static readonly json` options as an API, examples) into those docs or the module comment. Keep the module's existing header comment's voice. Regenerate `tests/self/goldens/checked/` with `node tests/self/goldens.js --update` after the edit (`--seed build/seed/bin/nish` without `build/nish`) and read the diff, even if you expect none.

## What moves and what stays

The subsections: `console`, `Math`, "Numeric conversions", `process`, "Arrays and strings as receivers", "Bulk writes: `set` and `fill`", "Readonly arrays", "Typed-array names have no `push` or `pop`", `Arena`, "`Map` and `Set`", "Typed JSON: `nish/json-typed`", "Capabilities". **No other LANGUAGE.md subsection is edited.** The `nish:` subsections and File I/O, the clock, and so on belong to the other session or to no one.

- **Stays (normative):** type rules, what the checker rejects and its diagnostics, panics and their messages, which receivers and positions the checker allows, lowering and IR facts, effect labels, the test-name columns, the Capabilities table, deviations from JavaScript.
- **Moves (reference):** signatures as documentation, what each function or method returns, examples, prose describing an API's use.
- **When a row mixes both,** the row stays and loses only its reference half. When in doubt, it stays, and the JSDoc repeats the fact. A fact may be in both places. A fact in neither place is a defect.
- Every heading stays as it is, so every `LANGUAGE.md#…` anchor keeps resolving.
- Each subsection gains one line linking to the reference (see Reference link).

## Pointers

Before removing any passage, grep `src/`, `tests/`, `docs/`, `std/`, `.claude/` and `CLAUDE.md` for its heading's anchor and for distinctive phrases from it. `tests/run.js` checks some LANGUAGE.md text literally, so grep it for every table row you change. Known anchor users today: `docs/AI.md`, `docs/IR_COOKBOOK.md`, `docs/RUN_UNDER_NODE.md`, `docs/guide/language/arrays-and-strings.md`, `docs/guide/language/maps-and-sets.md`, `docs/guide/using-nish/{cli,standard-library,terminal}.md`, `docs/wp*.md`, `std/README.md`. A pointer that quoted the removed text, or sent a reader to it for a signature, is repointed to the reference in the same commit.

## Reference link

At the time you write the links:
- **The generator has merged and renders the globals** (`docs/reference/` has a builtins page): link to that page. Run `node scripts/gen-reference.mjs`, commit the regenerated pages (they are generated files), confirm `--check` passes, and look at the rendered builtins and `nish-json-typed` pages (a screenshot in the PR body if the generator documents how to preview).
- **Otherwise:** link to [`runtime/nish.d.ts`](../runtime/nish.d.ts) (or `std/json-typed.ts`), and say in the PR body that the link moves to the generated page once it exists.

## Verification

```bash
npm run check && npm run lint && node docs/check-links.mjs
rm -rf build/test && node tests/run.js dts && node tests/run.js runtime-hosts && node tests/run.js json
node tests/self/goldens.js
git diff origin/main -- runtime/nish.d.ts | grep '^@@'   # no hunk inside a declare module block
```

Read each run's exit status, never a piped tail. CI's eight `test` shards are the full-suite gate. This repo has no coverage command; the Done list plus green shards is the gate.
