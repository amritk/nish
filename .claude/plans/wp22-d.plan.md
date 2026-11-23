---
name: WP22 D — refuse a top-level `function` definition
overview: Proposed only (issue 1923, needs-decision). One parser flag and one checker refusal make `function f(...) {...}` an error at the top level, with `declare function`, host modules and bodiless signatures still accepted. Before the refusal can land, the async corpus moves to arrows (§7's 440 async definitions are rewritable today, since the 0.42.0 seed accepts `const f = async (): Promise<T> => ...`) and every allowlist group gets an answer. Seven owner decisions are open, the first being whether D happens at all (§10).
spec: docs/wp22-arrow-functions.md
priority: 22
issue: 1923
stages:
  - id: d0-async
    title: WP22 D0 — async definitions to arrows
    goal: No tests/, bench/, docs/ or examples/ file outside a host module holds an `async function` definition, so the arrow-corpus check can count async definitions and D2's refusal flips no async program but the ones it means to.
    verification: node scripts/arrowify.mjs --check && node scripts/arrow-verify.mjs --applied tests/ bench/ docs/ examples/ && node scripts/arrow-verify.mjs --applied --debug tests/cases && node tests/run.js arrow-corpus && node tests/run.js cases && node tests/run.js link && node tests/run.js wordings && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    labels: [needs-decision]
    issue: 1923
    todos:
      - id: d0-codemod
        content: Teach scripts/arrowify.mjs to rewrite `async function` (and `export async function`) as `const f = async (...): Promise<T> => {...}`, drop the stale "`async` is forbidden by Phase 0" skip reason, keep skipping host modules — see D0
        status: pending
      - id: d0-corpus
        content: Apply it to tests/cases, tests/link, tests/wordings, tests/differential emit-ts programs, tests/postgres and bench/, verified byte-for-byte with arrow-verify --applied (and --debug for -g programs); re-key frozen differential programs with --rekey-arrowified — see D0
        status: pending
      - id: d0-check
        content: Extend the arrow-corpus check (tests/run.js) and the allowlist header so an async definition counts as a definition — see D0
        status: pending
      - id: d0-docs
        content: Rewrite `export async function main` and other async definitions in docs/LANGUAGE.md, docs/guide/language/async.md, the cookbook and examples; regen the cookbook — see D0
        status: pending
  - id: d1-allowlist
    title: WP22 D1 — drain what the refusal does not exempt
    goal: tests/function-spelling-allowlist.txt holds only files D2 will keep legal (host modules) or files whose refusal is the subject and is pinned to the new code; every pinned-position file is rewritten with its golden or doc regenerated in the same commit.
    verification: node tests/run.js arrow-corpus && node tests/run.js cases && node tests/run.js parser && node tests/run.js fix && node tests/run.js link && node tests/self/goldens.js --update && git diff --exit-code tests/self/goldens/checked && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    labels: [needs-decision]
    issue: 1923
    todos:
      - id: d1-pinned
        content: Rewrite dbg_enum, dbg_locals, dbg_result, opt_target_triple (regenerate their -g goldens), dump_ast (regenerate its AST dump) and reject_type_mismatch (move the 1:40 quote in docs/FAQ.md, docs/wp10-ci.md and its tests/run.js pin) — see D1, group 1
        status: pending
      - id: d1-subject
        content: Settle each "spelling is the subject" file per the owner's compat decision — see D1, group 2
        status: pending
      - id: d1-unparseable
        content: Hand-rewrite or keep the `catch`/operator-named parser fixtures and the two reject_try_catch_*_newline cases per the ordering decision — see D1, group 3
        status: pending
  - id: d2-refuse
    title: WP22 D2 — the refusal
    goal: A top-level `function` definition is a compile error with a new NL28xx code (feat!:), host modules and `declare function` compile unchanged, every message that names the keyword spelling is reworded onto the arrow, and the docs, guide, cookbook and reference say so.
    verification: npm run build && node tests/run.js link && node tests/run.js cases && node tests/run.js wordings && node tests/run.js fix && node tests/run.js host-import && node tests/run.js arrow-corpus && node tests/run.js self && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/gen-diagnostic-codes.mjs --check && node scripts/gen-reference.mjs --check && NISH=build/nish bash docs/cookbook/regen.sh --check && node tests/nish-cmp.js && node tests/nish-cmp.js --no-sidecars && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    labels: [needs-decision]
    issue: 1923
    todos:
      - id: d2-rule
        content: Add a FunctionDecl keyword flag in src/parser.ts and the refusal in refuseBindingForm (src/statements.ts), exempting FLAG_FOREIGN, bodiless signatures, anonymous and `export default` declarations — see D2
        status: pending
      - id: d2-entry-text
        content: Reword NL2035, NL2129, NL2130, NL2149 and NL2229 onto the arrow spelling, each retiring its code and taking the next free one; fix the six comment-only mentions — see D2, reworded messages
        status: pending
      - id: d2-tests
        content: tests/cases/reject_function_declaration, a tests/link negative with expected.err, a tests/wordings entry, exemption positives, the `--fix` fixture, the regenerated goldens and nish-cmp `file: "exit"` DECLARED entries — see D2, tests
        status: pending
      - id: d2-docs
        content: docs/LANGUAGE.md Functions, main and async rules, the guide pages, docs/AI.md, llms.txt, retire docs/cookbook/fn-add-function.ts, regenerate docs/reference and the cookbook — see D2, docs
        status: pending
  - id: d3-close
    title: WP22 D3 — close the note
    goal: docs/wp22-arrow-functions.md records D as shipped (or declined) with its counts, the Biome plugin and allowlist reduce to what the compiler no longer refuses on its own, and the roadmap parent issue closes.
    verification: node tests/run.js arrow-corpus && npm run lint && node docs/check-links.mjs
    status: pending
    labels: []
    issue: 1923
    todos:
      - id: d3-note
        content: Update §7's counts, §9, §10 and the stage table in docs/wp22-arrow-functions.md and the parent plan's d-reject-function stage — see D3
        status: pending
      - id: d3-tooling
        content: Decide whether biome-plugins/no-function-declaration.grit and the arrow-corpus check stay (the compiler now refuses what they flag, except in host modules and docs code blocks) — see D3
        status: pending
---

# WP22 stage D — refuse a top-level `function` definition

Spec: [`docs/wp22-arrow-functions.md`](../../docs/wp22-arrow-functions.md)
§6, §8–§10. Parent plan: [`wp22-arrow-functions.plan.md`](wp22-arrow-functions.plan.md)
(stage `d-reject-function`, issue 1923, labelled `needs-decision`).

Stages A–C are done. C closed in #1722 (PRs #1725, #1726, #1737, #1723,
#1741, #1743, #1748). `src/` and `std/` already hold **0** `function`
definitions. §7 counts 542 in total: 101 non-async, all listed in
`tests/function-spelling-allowlist.txt` or kept as refused forms under test,
and 441 async (bench 39, tests/cases 197, tests/link 154, emit-ts 40,
postgres 1, wordings 9; host-module asyncs are part of these counts and stay).

§10 frames D as "one flag, one refusal, a `reject_function_declaration` case
and its wording". This plan agrees about the compiler change (D2). It also
finds three things that must be settled first, and they are what make D more
than one PR:

1. **Async definitions are not exempt by necessity.** §7 and arrowify both
   treat `async function` as unrewritable ("`async` is forbidden by Phase 0").
   That is stale. Under the 0.42.0 seed,
   `const two = async (): Promise<i32> => 2` and
   `export const main = async (): Promise<number> => {...}` compile and run
   (printed `2`, exit 0), and `tests/cases/reject_async_arrow_declaration`
   (NL2655) pins only the forms that are still refused. So D can refuse
   `async function` too, provided the corpus moves first (D0).
2. **The compat dialect (WP28) accepts overloads, and overloads can only be
   written on `function` declarations.** A flat refusal makes
   `--compat overloads` dead, along with seven tests and the
   docs/guide/using-nish/compat.md examples. Decision 2.
3. **D must not shadow first diagnostics that tests pin.** The two
   `function catch(...)` cases pin NL1033 (`try`/`catch` is forbidden), and the
   anonymous and `export default` forms pin NL2203 and NL2130.

## What stays accepted

D refuses a **definition**: a top-level `FunctionDecl` with a body that the
user wrote with the `function` keyword. These are not definitions and stay
legal:

- **`declare function f(...): T;`** The parser marks it `FLAG_FOREIGN`. It is
  the only way to bind an extern or host symbol (§9).
- **Host modules.** `src/host-module.ts` lexes a `.ts` host file, keeps
  `export [async] function` signatures by token (`TOK_EXPORT`, an optional
  `async` ident, `TOK_FUNCTION`) and blanks the rest. After the parse, each
  exported function becomes `FLAG_FOREIGN` with an empty body. Exempting
  `FLAG_FOREIGN` therefore covers host modules as well, with no change to
  `host-module.ts`. The host file is TypeScript run by Node, and its
  `function` spelling is the user's own code. The 22 host-module files in the
  allowlist, and the interop guide's examples
  (docs/guide/using-nish/interop.md:311, 572, 752), stay as they are.
  - **Check:** the refusal runs on the parsed tree, after `FLAG_FOREIGN` is
    set. If any path checks a host module before that marking, the refusal
    must test the module kind instead. D2's host-import run proves which
    holds.
- **A bodiless signature** (`function f(x: i32): i32;`, `children[3]` Empty).
  It keeps NL2204 "Functions must have a body" and its `overloads` feature
  message, through `bodyMissing` in `refuseAtChild`.
- **`function*`.** Phase 0 already refuses it; D adds nothing.
- **Nested `function`.** It is refused earlier, so reject_fn_nested is
  untouched (§9a).

## D0 — async definitions to arrows

**Why it comes first:** D2 refuses `async function` along with the rest. If
D2 landed first, it would flip about 440 corpus programs, and each would need
a `DECLARED` entry or a rewrite inside the breaking PR. With D0 first, D2's
diff stays the compiler change plus its own tests.

**Work:**

- **Codemod.** `scripts/arrowify.mjs` rewrites
  `[export] async function f<T>(ps): Promise<R> { body }` to
  `[export] const f = async <T>(ps): Promise<R> => { body };`, and `--concise`
  applies as it does today.
  - Delete the stale skip reason.
  - Keep skipping files that `src/host-module.ts` would read as a host module.
    The codemod already keys on a host-module path or marker; D0 reuses that
    test.
- **Corpus.**
  - Apply it in passes: tests/cases, tests/link, tests/wordings,
    tests/differential (emit-ts programs), tests/postgres, then bench/.
  - Verify each pass with `node scripts/arrow-verify.mjs --applied <dir>`
    (byte-identical IR and the other emitted outputs), and with `--debug` for
    any program compiled with `-g`.
  - Re-key frozen differential programs with `--rekey-arrowified --rev`.
  - **§8c's position rule applies:** a block rewrite moves the name 3 columns
    left. Any `.err` or `expected.err` that pins a column inside a rewritten
    async function moves in the same commit, regenerated from the compiler's
    output (`node tests/run.js wordings` and `link` say which ones).
- **Check.** The `arrow-corpus` check (tests/run.js, near line 47759) and the
  allowlist header stop listing `async` among the forms that are "not
  definitions here".
- **Docs.**
  - `export async function main` in docs/LANGUAGE.md (around line 1709 and
    "### Async functions" at line 4200).
  - docs/guide/language/async.md:66, which says "A top-level `function` or an
    arrow may be `async`".
  - Any cookbook entry, `examples/` program or docs/AI.md example.
  - Then run `NISH=build/nish bash docs/cookbook/regen.sh --check`.
  - The async guide sentence becomes true of the arrow alone only in D2. In
    D0 it changes to say the arrow is the house spelling.

**Acceptance:**

- `node scripts/arrowify.mjs --check` over the tree reports nothing to rewrite
  outside the allowlist and host modules, async included.
- Every pass's `arrow-verify --applied` reports zero byte differences and
  fails on none.
- `node tests/run.js arrow-corpus` counts async definitions and passes.
- `cases`, `link` and `wordings` pass, with each moved column regenerated
  rather than hand-edited.
- No compiler change, so no `src/` or `std/` diff and no nish-cmp entries.
  Run `node tests/nish-cmp.js` anyway to confirm zero IR moves.

**Commit:** `test(self): spell async definitions as arrows` (and `docs:` for
the docs half): one PR, or one per large directory (`tests/cases` 197 and
`tests/link` 154 are each a reviewable PR). Never `feat`; nothing a user sees
changes.

## D1 — drain what the refusal does not exempt

Each allowlist group, and what happens to it:

**Group 1 — pinned positions (6 files).** Rewrite each one; none is about the
spelling. Each leaves the list in the same commit as what it pins.

| File | Pin to regenerate |
| --- | --- |
| `tests/cases/dbg_enum.ts`, `dbg_locals.ts`, `dbg_result.ts` | `-g` golden `.ll` (DILocation columns) |
| `tests/cases/opt_target_triple.ts` | `-g` from its `.args`; golden `.ll` |
| `tests/cases/dump_ast.ts` | expected AST dump (FunctionDecl tree → const + ArrowFunction tree) |
| `tests/cases/reject_type_mismatch.ts` | the line and `1:40` that docs/FAQ.md and docs/wp10-ci.md quote, and their pin in tests/run.js |

Regenerate goldens from the compiler's output; never edit them by hand. Then
grep `reject_type_mismatch` and `1:40` across `docs/` and `tests/run.js` and
move every quote.

**Group 2 — the spelling is the subject (11 files).** Each one waits for
decision 2 or 4:

| File | If D refuses `function` outright | If a compat feature lifts it (recommended) |
| --- | --- | --- |
| `compat_optional_params.ts` | rewrite to an arrow (the lifted default is the subject, not the keyword) | keep; run it under the new feature too |
| `compat_overloads.ts` + 7 `tests/link/compat_overloads_*` / `compat_optional_params_overloaded` | delete with the `overloads` feature, or keep as negatives pinning the new code | keep; their `.args` add the new feature |
| `reject_export_c_symbol_function.ts` | becomes a negative for the new code, or is deleted as a duplicate of `reject_export_c_symbol_const` | same choice |
| `reject_ffi_body.ts` | keep: `declare function` with a body; §9a says it needs nothing. Confirm its first diagnostic is unchanged | same |
| `tests/differential/arrow-parity/declared.ts` | the parity pair loses a side: retire the pair and keep `arrow.ts` as an ordinary program (decision 4) | keep under the compat feature |
| `tests/fix/decl-export-list.ts` + `.fixed.ts`, `decl-nofix-export-default-twice.nofix.ts` | rewrite the input to arrows; the fixer's declaration-kind handling must be re-proven on `ModuleConst` | same |
| `tests/fix/port-nofix-div-shadow-function.nofix.ts` | rewrite the shadowing declaration as a const arrow, and keep the "no fix" verdict | same |
| `tests/parser/names-bindings.ts`, `recovery.ts` | parser fixtures; the parser still parses `function` (it must, for `declare` and host modules), so they stay, and the arrow-corpus check keeps listing them | same |

**Group 3 — the codemod cannot parse them (7 files).**

- **`tests/parser/names*.ts` (5).** These are parser fixtures, which do not
  run through the checker, so the refusal never reaches them. They stay
  listed.
  - Run `node tests/run.js parser` to confirm no fixture runs the checker.
- **`tests/cases/reject_try_catch_call_newline.ts` and
  `reject_try_catch_pattern_call_newline.ts`.** Each declares
  `function catch(x: i32): void {}` and pins NL1033 as its *first*
  diagnostic. `const catch` is not writable, so the file cannot be rewritten.
  - NL1033 comes from an earlier phase than the checker's
    `refuseBindingForm`. A program refused in that phase may never reach
    D2's refusal, in which case nothing moves.
  - D2 must prove this: both cases still pass with NL1033 first, and nothing
    is added after it. If the phases do not order it that way, decision 5
    applies.

**Group 4 — host modules (22 files).** These stay; see "What stays accepted".
The allowlist's comment for them changes from "src/host-module.ts reads
export function" to "host module: exempt from NL28xx as `FLAG_FOREIGN`".

**Acceptance:**

- After D1 the allowlist holds only group 2's kept files, group 3 and group 4,
  and each line's reason names why D2 does not refuse it, or that it is now a
  negative.
- `arrow-corpus` passes.
- `node tests/self/goldens.js --update` leaves no diff (no `src/` change).
- `cases`, `parser`, `fix` and `link` pass.

## D2 — the refusal

**Compiler (src/parser.ts, src/statements.ts).**

- **The flag.** The parser normalises both spellings to `NodeKind.FunctionDecl`
  with no record of the keyword. Add a flag, e.g. `FLAG_KEYWORD_FUNCTION`, that
  the parser sets when it builds a FunctionDecl from `function`.
  - Flag bits are shared across node kinds (67108864 is reused), so pick a bit
    that is free **on FunctionDecl** and say so in the flag's comment.
  - The arrow path (const + ArrowFunction lowered to a FunctionDecl) never sets
    it.
- **The refusal.** It goes in `refuseBindingForm` (src/statements.ts:1115), as
  a new final branch of the existing if/else chain. That way NL2203
  ("Functions must be named") and NL2130 (`export default`) keep firing first,
  as §9a requires.

  ```ts
  } else if (node.kind === NodeKind.FunctionDecl
      && (node.flags & FLAG_KEYWORD_FUNCTION) !== 0
      && (node.flags & FLAG_FOREIGN) === 0
      && node.children[3].kind !== NodeKind.Empty) {
    ctx.error(node, `\`function ${name}\` is not how Nish declares a function; write \`const ${name} = (...): T => ...\``)
  }
  ```

  - The wording is §6's: "`function double` is not how Nish declares a
    function; write `const double = (n: i32): i32 => ...`". Codes are keyed on
    message words, so the registry entry is the template with `${name}` and
    `${sig}` placeholders, the form other name-bearing NL2 codes use. The
    suggestion prints the declaration's real parameters and return type.
  - **Code:** NL2824, the next free NL2 code at the time of writing. Re-check
    with `node scripts/gen-diagnostic-codes.mjs --check` after any
    `npm run sync-main`.
  - **Async:** the same branch covers `async function` (`FLAG_ASYNC`). The
    suggestion keeps `async` and the `Promise<T>` return.
  - **Compat (decision 2):** if a compat feature lifts the refusal, the call is
    `ctx.errorFeature(node, msg, "function-declarations")`, and src/compat.ts
    gains the feature beside `overloads`. An overload set written with the
    `overloads` feature on, but without `function-declarations`, is refused
    with this code naming both features.
- **The quick-fix (decision 6).** src/fix.ts rewrites the declaration to the
  arrow, as stage C's codemod does: block form, with the name and `async`
  carried over. This meets the parent plan's goal ("with a quick-fix to the
  arrow spelling"). The NL2129 and NL2130 fixes, which move `export default`
  onto a declaration, must now emit `export const` and not
  `export function`.

**Reworded messages (each retires its code and takes the next free one in
its band; the old entry and number stay reserved).**

| Code | Location | Today | After |
| --- | --- | --- | --- |
| NL2035 | (checker) | "...e.g. `function f(): Result<number, string>`" | "...e.g. `const f = (): Result<number, string> => ...`" |
| NL2129 | src/checker.ts:3832 | "...use a named `export function`" | "...use a named `export const`" |
| NL2130 | src/statements.ts | "`export default` is not supported; use a named `export function`" | "...use a named `export const`" |
| NL2149 | src/builtins.ts:497 | "...(this program has no `export function main`)" | "...(this program has no `export const main`)" |
| NL2229 | src/checker.ts:823 | "Only the entry module may declare `export function main`" | "...declare `export const main`" |

- Grep each old message across the repo before pushing: `expected.err`,
  `expected.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`,
  docs/LANGUAGE.md, docs/reference/language/declarations.md and
  docs/wp48-layout-survey.txt (NL2229).
- tests/link/main_in_import/expected.err pins NL2229.
- Comment-only mentions of the keyword spelling change in the same PR:
  src/c-symbols.ts:100, src/compilation.ts:331, src/declarations.ts:59 and
  897, src/interop-abi.ts:124 and src/program.ts:1907.

**Rolling freeze.**

- `src/` may not *use* a construct the seed lacks. D2 adds none. It adds a
  refusal and a flag, written in what 0.42.0 accepts (plain consts and
  arrows). `src/` already holds no `function` definition, so the next seed
  built from D2's release compiles `src/` unchanged.
- The order matters the other way. The bootstrap job builds `src/` with the
  0.42.0 seed, then builds `src/` again with the result. The second build runs
  D2's refusal over `src/` and `std/`. Both are already clean, which
  `scripts/bootstrap.sh --verify` proves.
- `std/` keeps no `declare function` that the refusal could catch, because
  `FLAG_FOREIGN` is exempt.
- **Do not** make the refusal depend on the seed version. When a user upgrades,
  the new compiler refuses, and that is the breaking change.

**Tests.**

- `tests/cases/reject_function_declaration.ts` (+ `.err`): a plain
  `function double(n: i32): i32 { return n * 2; }`, pinning NL2824 and the
  suggested arrow text.
- `tests/link/reject_function_declaration/` with `main.ts` and `expected.err`.
  CLAUDE.md requires this, because inline `tests/run.js` checks do not count
  toward "every registry code is provoked". Add a second link negative for
  `export async function main`, so the async path and the `main` entry are
  both provoked.
- `tests/wordings/nl2824_function_declaration.ts` (+ `.err`).
- **Positives that the exemptions hold:**
  - `declare function` (already covered by the FFI cases; confirm they still
    pass).
  - `node tests/run.js host-import` and the tests/wordings/host set.
  - A bodiless signature still gives NL2204 (tests/wordings/nl2204_function_without_body.ts).
  - reject_fn_anonymous still gives NL2203.
  - The `export default` cases still give NL2130.
  - The `function catch` cases still give NL1033 first.
- `tests/fix/function-declaration.ts` + `.fixed.ts` for the quick-fix, and a
  `.nofix.ts` for a form the fix declines (if decision 6 says ship it).
- Every new or reworded code's new number appears in an `expected.err`. The
  five retired codes stay provoked only by history; check what
  diagnostic-coverage expects of a retired entry.
- **Goldens:**
  - `node tests/self/goldens.js --update`, then read the diff.
  - `node tests/differential/goldens.js --update` for the new positive cases,
    if any.
  - Regenerate `tests/differential/emit-ts-known.txt` only under the Node
    version CI pins, and only if a verdict moves.
- **nish-cmp:** the seed accepts and HEAD refuses, so every corpus program
  that still holds a top-level `function` definition flips. D0 and D1 aim for
  that set to be empty, apart from compat programs if decision 2 keeps them.
  - Each flipped program gets a `file: "exit"` `DECLARED` entry whose
    `changelog` text is the PR's subject words.
  - Each reworded message that moves a program's `.err` output gets a narrow
    entry too.
  - Run `node tests/nish-cmp.js`, then again with `--no-sidecars`, to catch a
    wasm32 program hidden behind its sidecars.
- **Old-rule grep:** search `docs/wp*.md`, docs/MASTER_PLAN.md and
  `tests/**` comments for "legacy spelling", "`function` keyword is
  accepted", "either spelling" and the old test names, as CLAUDE.md requires
  for a flipped compile/refuse.

**Docs (the user guide moves with the language).**

- **docs/LANGUAGE.md**
  - "### Functions" (around line 1713) says the keyword "is accepted as the
    legacy spelling" (tests/cases/fn_arrow) and that "a capture-free
    top-level function is a value in either spelling". Replace this with the
    refusal rule. It names NL2824, the exemptions (`declare function`, host
    modules, signatures) and the compat feature if there is one.
  - "### `main`" (around line 3228) and "### Async functions" (around line
    4200).
  - The host-modules section (around line 7916) gains one sentence: the host
    file is TypeScript and keeps `export function`.
- **Guide.**
  - docs/guide/language/functions.md:51: drop "The `function` keyword is
    accepted too…" and say it is refused with NL2824, with a
    `<!-- nish:err NL2824 -->` block.
  - docs/guide/language/async.md:66: "A top-level arrow may be `async`".
  - docs/guide/language/function-references.md:109.
  - docs/guide/using-nish/compat.md:373–430: rewrite the examples onto arrows,
    or put them under the new feature.
  - Check docs/guide/using-nish/from-typescript.md, docs/AI.md and llms.txt
    for "function" guidance and tell a TypeScript user what to write
    instead.
  - Leave the interop.md host-module examples alone.
- **Cookbook.** docs/cookbook/fn-add-function.ts (IR_COOKBOOK.md lines
  127–164, beside fn-add.ts) exists to show that both spellings emit the same
  IR. Once one spelling is refused, it either goes, or moves under the compat
  feature (decision 4). Remove its biome.json exclusion with it, then run
  `docs/cookbook/regen.sh` and `NISH=build/nish bash docs/cookbook/regen.sh --check`.
- **Reference.** `node scripts/gen-reference.mjs` rewrites
  docs/reference/diagnostics/nl2xxx.md (the new code and the reworded five) and
  docs/reference/language/declarations.md. Its routes in scalar.config.json
  move with it, and `--check` exits 0.
- `nish --help` text: if anything in it mentions `export function main`,
  regenerate `examples/break-web/help.ts` and `docs/site/break/` with
  `node examples/break-web/build.mjs`, and confirm with `--check`.

**Commit (breaking, stays on 0.x).**

```
feat(checker)!: refuse a top-level `function` definition

A top-level `function f(...) {...}` is now NL2824; write
`const f = (...): T => ...`. `declare function`, host modules and bodiless
signatures are still accepted. NL2035, NL2129, NL2130, NL2149 and NL2229
now name the arrow spelling and take new codes.

BREAKING CHANGE: a program that defines a function with the `function`
keyword no longer compiles; `nish --fix` rewrites it.
Refs: docs/wp22-arrow-functions.md#9
Tests: tests/cases/reject_function_declaration, tests/link/reject_function_declaration
Fixes #1923
```

- `!` moves the **minor** (0.42 → 0.43). Never 1.0.0, never `Release-As:`.
- The squash subject must contain every `changelog:` string that the PR's
  nish-cmp `DECLARED` entries add, verbatim. Read them from the diff before
  merging.
- The PR title is the subject; pr-title.yml checks it.

**Acceptance:**

- The refusal fires on a plain and an async top-level definition, with the
  suggested arrow carrying the real signature.
- It does not fire on `declare function`, a host module, a bodiless
  signature, an anonymous function (NL2203 instead) or `export default`
  (NL2130 instead).
- The `function catch` cases are unchanged.
- `scripts/bootstrap.sh --verify` passes; the self-host compiles itself under
  the refusal.
- `gen-diagnostic-codes --check`, `gen-reference --check` and the cookbook
  `--check` exit 0.
- Every flipped corpus program has its `DECLARED` entry.
- `wasi` (read its skip line) and `performance` pass with no new NL9007.
- CI's nine `test` shards are green on the head, with each skip count read.

## D3 — close the note

- **docs/wp22-arrow-functions.md:**
  - §7: counts after D0 and D2.
  - §9: what D foreclosed, as shipped.
  - §10: the answer to whether D happens.
  - The stage table.
- **The parent plan:** set stage `d-reject-function` to done.
- **Biome plugin and arrow-corpus check.** Once the compiler refuses, the
  plugin and the check catch a `function` definition earlier: in an editor,
  and in docs code blocks that are never compiled. They can stay with a
  narrower purpose, or the check can shrink to a guard on the allowlist's
  remaining groups. This is the owner's call; the default is to keep both.
- **Acceptance:** `node docs/check-links.mjs` passes on the moved anchors.

## Open decisions (owner)

1. **Does D happen at all?** §10 leaves it open. Against: WP28 promises that
   ordinary TypeScript compiles, and `function` is the most ordinary
   TypeScript there is. For: one spelling, which stage C has already made the
   house style everywhere.
   - If the answer is no, D0 is still worth shipping, because it makes the
     corpus consistent. D3 then records the refusal as declined.
2. **Compat and overloads.** Choose one:
   - (a) A new compat feature, `function-declarations`, lifts the refusal via
     `errorFeature`. It keeps `overloads`, `compat_optional_params`,
     arrow-parity and fn-add-function meaningful. **Recommended.**
   - (b) Exempt overload sets only, under `overloads`.
   - (c) Refuse everywhere and retire `--compat overloads`.
3. **Warning first, or a straight error?** An NL7xxx deprecation warning for
   one release (NL7001 and NL7002 are precedents), then the error in the
   next. §6 says error. A warning release makes D2 a `feat:` and moves the
   `feat!:` one release later.
4. **fn-add-function.ts and arrow-parity/declared.ts.** §9a asks what proves
   an equivalence once one side is illegal. Retire both (the equivalence was
   proven in stage B and is moot once there is one spelling), or keep them
   under decision 2(a)'s compat feature.
5. **The `function catch` ordering.** If the earlier phase does not already
   stop before the checker, choose between suppressing NL2824 after an NL1033
   in the same declaration and accepting a second diagnostic in those two
   pins.
6. **Ship the `nish --fix` quick-fix in D2?** The parent plan's goal says yes.
   It adds a src/fix.ts rewrite, its fixtures, and the NL2129/NL2130 fix
   output change.
7. **Reword all five keyword-naming messages in the one `feat!:` PR?** This
   retires five codes at once, which is churn for users who match codes.
   Alternatively, reword them in a separate `fix(checker)` PR before D2. The
   new wordings are true either way, since the arrow is already accepted
   everywhere.
