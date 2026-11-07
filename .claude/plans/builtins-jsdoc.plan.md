---
name: Document the global builtins in JSDoc on runtime/nish.d.ts
overview: Document every global builtin in JSDoc on its declaration in runtime/nish.d.ts (and typed JSON on std/json-typed.ts), carrying everything docs/LANGUAGE.md → Builtins says about it, so TypeDoc can generate the library reference from source. LANGUAGE.md is not trimmed; nothing is removed from it.
stages:
  - id: globals
    title: "docs(runtime): document the global builtins in nish.d.ts"
    goal: Every global declaration in runtime/nish.d.ts and every export of std/json-typed.ts is fully documented in JSDoc, with every fact LANGUAGE.md gives about it, and LANGUAGE.md loses no text
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
      - id: no-trim
        content: Copy, never move — LANGUAGE.md keeps every line it has; its only edit is one added reference link per listed subsection — see What is documented
      - id: completeness
        content: Walk every global declaration against its LANGUAGE.md subsection (the 12 listed and the others — File I/O, the clock, spawn, net, term, unsafe, constant time, …) and confirm each fact about it is in its JSDoc — see What is documented
      - id: reference-link
        content: Point the subsections' reference link at the generated page if the generator has merged, else at runtime/nish.d.ts; regenerate the pages and inspect them if it has merged — see Reference link
---

## Stage: globals

**Owns:** `runtime/nish.d.ts` (top-level declarations only — never a line inside a `declare module "nish:*" { … }` block), `std/json-typed.ts`, `docs/LANGUAGE.md`, `tests/self/goldens/checked/**` and `docs/reference/**` (regenerated only). No other file.

One stage, one PR: the JSDoc for the whole global surface, plus the reference links.

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

Add `interface Math { … }`, `interface Array<T> { … }` (beside the existing `fill`), `interface ReadonlyArray<T>`, `interface String`, `interface Map<K, V>` and `interface Set<T>` declarations that merge into lib's, each member declared with **Nish's** signature (for example `min<T extends number>(a: T, b: T): T`) and its doc. They are extra overloads to `tsc`, never narrower than lib's, so a program `tsc` accepted before is still accepted. Prove that with `node tests/run.js dts`, plus one throwaway `tsc --strict` probe that is not committed. Declare only what Nish supports. The surface Nish defers (`entries`, `forEach`, …) stays undeclared, and the restrictions `tsc` cannot express stay in LANGUAGE.md. Rewrite the header's Map/Set paragraph to say what is declared now and why. If a merged declaration breaks `tsc` or the `runtime-hosts` check in a way that cannot be fixed inside these rules, leave that surface undeclared and say so in the PR body. Do not weaken a test.

## Typed JSON

JSDoc every export of `std/json-typed.ts` with `@param`/`@returns`, and copy the subsection's reference material (the call shapes, what each returns, the `static readonly json` options as an API, examples) into those docs or the module comment. Keep the module's existing header comment's voice. Regenerate `tests/self/goldens/checked/` with `node tests/self/goldens.js --update` after the edit (`--seed build/seed/bin/nish` without `build/nish`) and read the diff, even if you expect none.

## What is documented

**Nothing is trimmed.** The human changed this after sign-off: LANGUAGE.md loses no line. `git diff origin/main -- docs/LANGUAGE.md` shows only added lines, and the only additions are one reference link per listed subsection. LANGUAGE.md stays the normative spec. The JSDoc is a complete copy of the reference, so a reader of the generated page never needs LANGUAGE.md to learn what a builtin does.

- **Everything about a declaration goes in its JSDoc:** what it returns, every special case and deviation from JavaScript, errno values, panics and their messages, positions and argument rules, and examples. Leave out only compiler-internal detail (IR lowering, test names) unless a user can observe it.
- **Every global is covered,** not only the 12 subsections the reference link goes into. A global whose subsection is File I/O, the clock, spawn, `nish:net`, `nish:term`, `nish:unsafe`, constant time and so on gets the same completeness from that subsection, which is itself not edited.
- **Facts are copied exactly.** Quote numbers, messages and ranges from LANGUAGE.md word for word. Do not paraphrase them into something weaker.
- The listed subsections are: `console`, `Math`, "Numeric conversions", `process`, "Arrays and strings as receivers", "Bulk writes: `set` and `fill`", "Readonly arrays", "Typed-array names have no `push` or `pop`", `Arena`, "`Map` and `Set`", "Typed JSON: `nish/json-typed`", "Capabilities". Each gains one line linking to the reference (see Reference link). Headings stay as they are.

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
git diff origin/main -- docs/LANGUAGE.md | grep -c '^-[^-]'  # 0: nothing removed
```

Read each run's exit status, never a piped tail. CI's eight `test` shards are the full-suite gate. This repo has no coverage command; the Done list plus green shards is the gate.
