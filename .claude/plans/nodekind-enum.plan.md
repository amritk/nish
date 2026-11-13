---
name: NodeKind enum for the AST node kinds
overview: Replace the 79 `N_*` i32 module constants in src/nodes.ts with one numeric `enum NodeKind`, type `Node.kind` and every kind-carrying signature with it, and grow Nish-0 to admit enums. The compiler's own IR does not change except for one dead check the enum proves dead.
stages:
  - id: enum-perf
    title: perf(checker) — enum narrowing builds an enum's members once
    goal: Checking src/ with node kinds as an enum costs no more than with i32 constants (within noise), with identical diagnostics and IR
    verification: npm run check && npm run lint && node tests/run.js self && node tests/run.js performance && node tests/nish-cmp.js && node tests/self/goldens.js
    todos:
      - id: cache-members
        content: Build each enum's member list once in enumMembersOf (src/expressions.ts) instead of re-interning every member per test — see Stage enum-perf
      - id: set-joins
        content: Make narrowHeld, joinHeld and memberListId linear and allocation-free when nothing narrows — see Stage enum-perf
      - id: measure-parity
        content: Measure a compiler built from this branch on main's src/ and on feature/nodekind-enum/enum's src/ — see Stage enum-perf
  - id: enum
    title: refactor(self) — the AST node kinds become enum NodeKind
    goal: Every node kind in src/ is a NodeKind member, no node kind is typed i32, Nish-0 admits enums, and the compiler's IR is unchanged but for the one explained dead check
    verification: bash scripts/bootstrap.sh --verify && npm run check && npm run lint && npm run lint:dead && node tests/run.js self && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/nish-cmp.js && node tests/self/goldens.js
    todos:
      - id: declare-enum
        content: Declare export enum NodeKind in src/nodes.ts with each kind's value and layout comment, type Node.kind, the constructor and nodeName with it, delete N_COUNT — see Declaration
      - id: rename-uses
        content: Rewrite every N_* use and import across src/ to NodeKind members — see Use sites
      - id: widen-signatures
        content: Retype the six audited kind-carrying signatures and drop the dead check in statements.ts — see Audit result
      - id: text-pointers
        content: Update the src-text matchers in tests/run.js and tests/bodiless-stance.js, and every N_* pointer in comments, docs and .claude — see Pointers
      - id: grow-nish0
        content: Admit enums in Nish-0 in docs/wp14-selfhost.md section 2, .claude/selfhost.md and .claude/typescript.md, flags stay i32 — see Nish-0
      - id: verify-ir
        content: Diff the compiler's own IR before and after, regenerate tests/self/goldens/checked, measure self-compile time — see Verification
---

## Stage `enum-perf` (added after review; merges before `enum`)

**Owns:** `src/expressions.ts`, `src/program.ts`, `src/types.ts`, `src/symbols.ts`, `src/loop-flow.ts`, `tests/self/goldens/checked/**`, `tests/run.js` (a performance pin only, if one fits).

Found at the merge gate of #1508: the seed compiles the enum'd `src/` 11% slower. Callgrind (+1.28 G instructions, +26%) puts it all in enum narrowing: `enumMembersOf` +332 M (re-interns all 79 members per test via a string key), `joinHeld` +216 M (pairwise 79×79 compares at every `||`/`&&` join), `TypeTable.internAll` and its key building ~+660 M, `narrowHeld` +32 M. A per-enum cache alone took the gap from +11% to +3% with byte-identical IR. Fix the checker so an enum costs what `i32` costs: cache members per enum, make join/narrow set-based (member types of one enum are interned by value, so ids compare), and do not allocate a new member list when a test leaves the set unchanged. No diagnostic, type or IR may change. The released seed keeps the old cost until the next release; measure with a compiler built from `src/`.

## Stage `enum`

**Owns:** `src/**`, `tests/self/goldens/checked/**`, `tests/run.js`, `tests/bodiless-stance.js`, `tests/parser-oracle.js`, `tests/parser/recovery.ts`, `docs/**/*.md`, `.claude/*.md`, `AGENTS.md`, `CLAUDE.md`, `tests/nish-cmp.js` (only if nish-cmp moves, which it should not). One stage, one PR: every file the rename touches moves together or the tree does not compile.

## Context

[`src/nodes.ts`](../../src/nodes.ts) declares 79 node kinds as `export const N_IF: i32 = …` (plus `N_COUNT = 79`), and `Node.kind` is `i32`. About 400 `case N_…` arms read them across 67 files in `src/`. Nish-0 ([`docs/wp14-selfhost.md`](../../docs/wp14-selfhost.md) §2, [`.claude/selfhost.md`](../selfhost.md) → "Nish-0") bans `enum` for sequencing reasons only ([`docs/wp18-generics.md`](../../docs/wp18-generics.md) §10, [`docs/wp23-language-surface.md`](../../docs/wp23-language-surface.md) §3). The seed is 0.38.0, which compiles enums ([`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) → "Enums"), so the rolling freeze allows `src/` to use one. Biome's `noEnum` is already off for `src/**` ([`biome.json`](../../biome.json)).

## Audit result

Done by the lead before planning: a scratch copy with the enum declared, every `N_X` rewritten to a member and `Node.kind: NodeKind`, compiled with `build/seed/bin/nish src/compile.ts`. The seed's errors are the complete list of places a node kind leaves `NodeKind`, because enum and `i32` do not convert either way:

| site | today | change |
| --- | --- | --- |
| `CheckedProgram.newNode` (`src/program.ts`) | `kind: i32` | `NodeKind` |
| `isTypeNode` (`src/handles.ts`) | `kind: i32` | `NodeKind` |
| `syntaxKindName` (`src/checker.ts`) | `kind: i32` | `NodeKind` (only ever called with `.kind` of a node) |
| `Parser.node` (`src/parser.ts`) | `kind: i32` | `NodeKind` |
| `Parser.parseJump` (`src/parser.ts`) | `kind: i32` | `NodeKind` |
| `node()` helper (`src/fnref-places.ts`) | `kind: i32` | `NodeKind` |
| `checkVariableList` (`src/statements.ts`, the `holdMembers` call) | `if (initializer.kind !== N_EMPTY)` after an earlier `=== N_EMPTY … continue` | the seed rejects it as always true (enum narrowing); drop the `if`, keep the call |

With those, the seed compiles `src/` with exit 0. There is **no** arithmetic, ordered comparison, array index or numeric print of a node kind anywhere: no conversion is needed. `N_COUNT` ("the size of a table indexed by kind") has no reader outside its golden; delete it, since no table can be indexed by an enum.

The `kinds: i32[]` sites hold other families and stay `i32`: `src/parser.ts` (`const kinds: i32[]` in the `[Symbol.dispose]` lookahead) holds **token** kinds; `context.ts loopKinds`, `bounds.ts`, `host-module.ts`, `break-*.ts` hold their own families. Token kinds (`TOK_*`), type kinds (`K_*`), `flags` and every other kind family are out of scope.

**IR of the compiler, before vs after (seed, `src/compile.ts -o dir/`)**: 129 modules, 128 byte-identical; `statements.ll` differs only by the removed `load/icmp ne i32 …, 1/br` of the dead check and the SSA renumbering after it. The worker repeats this diff on the final tree and states it in the PR.

## Approach — member naming

`NodeKind.If`, `NodeKind.TypeRef`, `NodeKind.ExprStmt`: PascalCase, the old name minus `N_`, mechanically (`N_BIGINT` → `Bigint`, `N_FOR_OF` → `ForOf`). Why: in a 400-arm switch the label is read hundreds of times, and `case NodeKind.TypeRef:` carries the family once in the type name instead of twice (`NodeKind.N_TYPE_REF`); it is the spelling [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) → "Enums" models (`Kind.If`). The mechanical rule keeps the rename scriptable and reversible. `nodeName`'s returned strings (`"TYPE_REF"`, what `--emit-ast` prints) do **not** change — that output is user-visible.

## Declaration

`export enum NodeKind { Error = 0, // a parse that failed… }` in place of the constant block, each member keeping its value and its layout comment where it sits today. `Node.kind: NodeKind`, `constructor(kind: NodeKind, …)`, `nodeName = (kind: NodeKind)`. Flag constants stay `i32` (`docs/LANGUAGE.md`: bit flags stay module constants).

## Use sites

Every `N_X` in code becomes `NodeKind.X`; every `import { …N_X… } from "./nodes"` drops the kind names and imports `NodeKind`. A script does this (scratch, not committed); then the six signatures above. `npm run check` (tsc) and the seed both have to pass.

## Pointers

Text that names a kind moves with it (CLAUDE.md: "Moving where a fact lives moves every pointer"):

- `tests/run.js` (the secret-alias mutation edit matching `named.kind === N_CONDITIONAL`) and `tests/bodiless-stance.js` (`body.kind === N_BLOCK`) match `src/` text: update the strings, and confirm each mutation still applies (its test fails loudly if the needle is missing — check that it does).
- Comments in `src/` (~190 `N_*` mentions), `tests/parser-oracle.js`, `tests/parser/recovery.ts`, and `docs/`, `.claude/`, `AGENTS.md` (~70): rewrite `N_X` → `NodeKind.X`. Instructions such as "add an `N_FOO` to nodes.ts" in the add-a-construct checklist become "add a `NodeKind` member". `CHANGELOG.md` is history: leave it.
- `N_` names in `tests/link/crypto_*` are unrelated crypto constants: do not touch.

## Nish-0

Grow the subset explicitly (wp14 §6 rule 5): `docs/wp14-selfhost.md` §2 and `.claude/selfhost.md` → "Nish-0" admit numeric `enum` (members compared with `===`/`!==` and switched on; bit flags stay `i32` module constants by the language's own rule). Fix every line saying `src/` does not use enums: at least `.claude/typescript.md` ("no `enum`"), `.claude/selfhost.md` line ~139, `docs/wp14-selfhost.md` line ~52; grep `docs/`, `.claude/`, `CLAUDE.md`, `AGENTS.md` and `src/` comments for "enum" and judge each. `.claude/linting.md` lists `noEnum` as a mirror of the language; it is already off for `src/` — correct the line if it now misstates.

## Out of scope

Token kinds, type kinds (`K_*`), `flags` and every other `i32` kind family; any change to compiler output for user programs; `--emit-ast` text; new constructs (so no golden `.ll`); `docs/guide/` (no user-visible change).

## Verification

- Compiler IR before/after: `build/seed/bin/nish src/compile.ts -o <dir>/` on the base and on the head, `diff -r`. Only the `statements.ll` dead-check hunk may differ; anything else is a finding to explain.
- `bash scripts/bootstrap.sh --verify`, `npm run check`, `npm run lint` and `npm run lint:dead` (exit status, not a piped tail), `node tests/run.js self`, `node tests/run.js performance`, `WASI_SYSROOT=/usr node tests/run.js wasi` (read its skip line), `node tests/nish-cmp.js` (expect no `DECLARED` entries: user-program IR does not move).
- `node tests/self/goldens.js --update`, read the diff: `i32` → `NodeKind` in printed kinds, the deleted `N_COUNT`, the member spellings; nothing else.
- `Measured:` trailer: self-compile time before and after with its noise band, per `.claude/testing.md` → "A `Measured:` trailer".
- Commit `refactor(self): …`; the body says Nish-0 grew by numeric enums and that flags stay `i32`.
