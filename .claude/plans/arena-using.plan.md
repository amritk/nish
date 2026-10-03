---
name: Safe arena release — using a = arena()
overview: Replace the undefined behaviour of Arena.release / Arena.reset in ordinary code with a checked bracket, `using a = arena()`, that marks the arena on entry, releases it on every exit, and refuses at compile time anything allocated inside that would outlive the block. The old calls stay legal but warn.
stages:
  - id: arena-using
    title: feat(checker) — add using a = arena(), a checked arena bracket
    goal: A block that declares `using a = arena()` marks the arena on entry and releases it on every exit, and the checker refuses every route by which a value allocated inside could outlive the block.
    verification: npm run check && npm test (undegraded — only the environmental skips) && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: arena-builtin
        content: Declare the global builtin arena() in runtime/nish.d.ts, src/builtins.ts and src/emit-builtins.ts, with no-op Disposables in runtime/nish.mjs and runtime/shim.mjs — see Stage 1 → Surface
      - id: arena-using-accept
        content: Accept `using a = arena()` beside `using s = scope()` in src/parallel.ts walkScopes, reword NL2387 / NL2393, and add codes for arena() outside a using and for any other use of its binding — see Stage 1 → Surface
      - id: arena-using-emit
        content: Emit nish_arena_mark at the declaration and the release on block end, return, break, continue and orReturn, in LIFO order with thread-scope joins and automatic scopes — see Stage 1 → Emission
      - id: arena-using-escape
        content: Add the block escape check in src/escape.ts reusing the loop-pass PassWalk rules, refusing each route with its own NL2xxx code naming the value and the escape site — see Stage 1 → The escape check
      - id: arena-using-tests
        content: Add round trips, one negative test per escape route, a golden .ll for the bracket, and a Node run — see Stage 1 → Tests
      - id: arena-using-docs
        content: Document the rule in docs/LANGUAGE.md (Arena and Memory model), a line in docs/AI.md Memory, and a docs/IR_COOKBOOK.md entry — see Stage 1 → Docs
  - id: arena-deprecate
    title: feat(checker) — deprecate Arena.release and Arena.reset in favour of using a = arena()
    goal: Every program that calls Arena.release or Arena.reset still compiles and runs, and gets a warning on stderr pointing to `using a = arena()`; Arena.mark and Arena.used do not warn.
    verification: npm run check && npm test (undegraded — only the environmental skips) && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: deprecation-kind
        content: Add a deprecation warning kind to src/diagnostics.ts and a new NL7xxx band to src/codes.ts and scripts/gen-diagnostic-codes.mjs, shown by default and with severity "deprecation" in --json — see Stage 2 → The warning
      - id: deprecation-arena
        content: Report the deprecation at every Arena.release and Arena.reset call in src/builtins.ts checkArena — see Stage 2 → The warning
      - id: deprecation-advice
        content: Point the NL9011 arena-loop advice in src/checker.ts and src/escape.ts at `using a = arena()` instead of Arena.mark / Arena.release, regenerating tests/wordings — see Stage 2 → Advice
      - id: deprecation-migrate
        content: Migrate the repo's own programs that call Arena.release / Arena.reset to `using a = arena()` where the checker accepts it, keeping mem_arena_builtins on the old API to pin the warning — see Stage 2 → Migration
      - id: deprecation-tests-docs
        content: Pin the warning (human text, --json code and severity, exit 0) in tests/run.js and update the Arena section of docs/LANGUAGE.md, docs/AI.md, AGENTS.md and docs/wp10-ci.md bands — see Stage 2 → Tests and docs
---

## Context

[`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) → `Arena` says releasing or resetting while anything allocated after the mark is still referenced is undefined behaviour — in ordinary code, with no opt-in. The compiler already proves the same property for the scopes it inserts itself: a function's arena scope and a loop pass's scope (`decideLoopScopes` / `PassWalk` in [`src/escape.ts`](../../src/escape.ts), `LoopScope` in [`src/attributes.ts`](../../src/attributes.ts), LANGUAGE.md "A loop's pass gets a scope of its own"). This plan gives programmers that proof for a bracket they write, and deprecates the unchecked one.

## Approach

- **`arena()` is a global builtin**, `declare function arena(): Disposable` in [`runtime/nish.d.ts`](../../runtime/nish.d.ts), not an export of a std module. A std class (as `ThreadScope` is) would itself be allocated in the arena it brackets, and a builtin needs no package/path special case. The mark is a plain `i64` local from `nish_arena_mark`; the binding `a` holds nothing the program can use.
- **Recognition** is by builtin name in the `using` walk ([`src/parallel.ts`](../../src/parallel.ts) `walkScopes` / `isScopeCall`, `src/compilation.ts` `checkScopes`), beside the existing `scope()` rule. `src/` never uses `arena()` (rolling freeze), so nothing in `src/` depends on the seed knowing it.
- **The escape check is the loop-pass rule, refusing instead of declining.** Where an unscoped loop silently loses its scope (and NL9011 warns), a `using a = arena()` block that fails the same test is a compile error. Each `PassWalk` reason that applies becomes its own NL2xxx code (next free is NL2416 at plan time — take them in order from `node scripts/gen-diagnostic-codes.mjs`).
- **The deprecation is a new warning kind**, not a ride on `performance`: there is no deprecation severity today, and a deprecation is not a performance claim. New band `NL7xxx`, shown by default (unlike `--warn-portability`), `severity: "deprecation"` in `--json`. Warnings never change the exit code.
- **Two stages, serial.** Both touch `src/codes.ts`, `docs/LANGUAGE.md` and the generated `tests/self/goldens/checked-self.txt` (which conflicts with every concurrent `src/` PR), and stage 2's warning names stage 1's construct. Stage 2 starts after stage 1 merges.
- `CHANGELOG.md` is generated from commit messages — neither stage edits it by hand; the squash commit's subject and body are the changelog line.

## Stage 1 — `using a = arena()`

**Owns:** `src/**`, `runtime/nish.d.ts`, `runtime/nish.mjs`, `runtime/shim.mjs`, `runtime/runtime.c`, `runtime/runtime-wasm.c`, `runtime/nish.h`, `tests/**`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `AGENTS.md`, `llms.txt`

### Surface

| file | change |
| --- | --- |
| `runtime/nish.d.ts` | `declare function arena(): Disposable;` beside `Arena`, with a doc comment; the `Disposable` comment stops saying `using` takes only `scope()` |
| `src/builtins.ts` | `arena` in `isBuiltinFunction` and `SUPPORTED_BUILTINS`; checked to type `Disposable`-like, zero arguments, effect write |
| `src/parallel.ts`, `src/compilation.ts` | `using` accepts an `arena()` initialiser as it accepts `scope()`; `arena()` anywhere but a `using` initialiser is refused (as NL2388 does for `scope()`); the binding may not be read (as NL2389) |
| `src/codes.ts` | reword NL2387 (`using` takes only `scope()` or `arena()`) keeping its number; new codes appended; `RULE_COUNT` bumped |
| `runtime/nish.mjs`, `runtime/shim.mjs` | `arena()` returns `{ [Symbol.dispose]() {} }` |

A parallel body (`parallelMapInto`, `parallelReduce`, `spawn` tasks) may not call `arena()`, for the reason it may not call `Arena.*` — extend that rule and its message.

### Emission

- At the declaration: `%m = call i64 @nish_arena_mark()` kept in a local.
- At every exit of the block — fall-through end (`closeBlockScopes`), `return` (after the value is computed and proven old), `break` / `continue` out of the block (`emitScopeJoins` paths in `src/emit-control.ts`), `orReturn` (`src/emit-result.ts`) — `call void @nish_arena_release(i64 %m)`. A `return`'s value is computed first, then released, then returned.
- LIFO with everything else on the same stacks: a `using s = scope()` declared inside the arena block joins before the arena releases; an arena block inside a scoped loop pass or scoped function releases before the outer scope does. Reuse `openScopes` / `openScopeLoops` (src/emit.ts) rather than a parallel stack, tagging which kind each entry is.
- `arena()` must not count as arena *control* (`usesArenaControl`, `LOOP_CONTROL`): a function containing the block keeps its automatic scopes.

### The escape check

A block passes when nothing allocated inside it is reachable after it ends. Reuse `PassWalk`'s reasons with the block as the region:

| route | loop reason it mirrors | refused when |
| --- | --- | --- |
| assignment to a local declared outside the block | `LOOP_OUTER_LOCAL` | the right side is not `isOld` |
| store into a field (`o.f = v`) of an object not allocated in the block | `escapingNodes` / `LOOP_STORED` | `v` may be allocated in the block |
| store into an element (`xs[i] = v`) | `escapingNodes` / `LOOP_STORED` | likewise |
| `push` onto an array not allocated in the block | `LOOP_OUTER_PUSH` | always, unless the array is a block-local fresh array |
| `return` (and `orReturn`) of a value | `LOOP_RETURN` | the value is not `isOld` |
| a call to a callee whose allocations escape | `LOOP_CALLEE_STORES` | `g.allocEscapes` |
| a call through a function value, foreign function, or callee with no facts | `LOOP_UNSEEN` | always |
| `Arena.release` / `Arena.reset` inside the block | `LOOP_CONTROL` | always |

Each route gets its own NL2xxx code and a message that names the escaping value (its source text) and the place it escapes to, e.g. `` `label` is allocated inside the `using arena()` block that starts at 4:3 and is stored into the outer local `last`: it would point into freed memory when the block ends ``. Scalars (numbers, booleans, enums) and values proven old pass freely. The check runs in the same post-check phase as `checkScopes`, as an error, so a refused program never reaches emission.

### Tests

Mirror `tests/link/thread_scope_exit_paths` and `tests/cases/mem_loop_scope*`.

- `tests/cases/mem_using_arena.ts` + `.ll` + `.out`: allocates strings, an array and an object in the block, prints `Arena.used()` before and after — equal. This `.ll` is the golden for the bracket.
- `tests/link/arena_using_exit_paths/`: leaves the block by fall-through, `return`, `break`, `continue`, and `orReturn`; nests a `using s = scope()` inside and an arena block inside a scoped loop; each path prints `Arena.used()` equal to its value before the block.
- One `tests/cases/reject_using_arena_<route>.ts` + `.err` per row of the escape table, plus `arena()` outside `using`, a read of the binding, and `arena()` in a parallel body.
- A Node run of a `using a = arena()` program through `runtime/nish.mjs` (the `tests/differential` or unmodified-Node harness) with the same stdout as native, `Arena.used()` aside.
- Regenerate `tests/self/goldens/*` with `node tests/self/goldens.js --update`, never by hand.

### Docs

- `docs/LANGUAGE.md`: a `using a = arena()` rule under `Arena` (what it brackets, the exits, the escape table, each code), cross-referenced from Memory model item 2 and the `using` section (NL2387 wording); the Safety rule paragraph says the UB is now confined to the deprecated calls.
- `docs/AI.md` → `Memory`: one line — to free a batch, wrap it in a block with `using a = arena()`; anything that must outlive the block is allocated before it.
- `docs/IR_COOKBOOK.md`: the bracket's IR, from the golden.

## Stage 2 — deprecate `Arena.release` and `Arena.reset`

**Owns:** `src/**`, `scripts/gen-diagnostic-codes.mjs`, `tests/**`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/wp10-ci.md`, `AGENTS.md`, `llms.txt`

Depends on: `arena-using` (merged) — development starts after it lands.

### The warning

- `src/diagnostics.ts`: a `deprecation` kind beside `performance` and `portability`, printed by default as `file:line:col: warning: <text>`, kept and dropped by the same rules, `severity: "deprecation"` in `--json`.
- `src/codes.ts` + `scripts/gen-diagnostic-codes.mjs`: band `NL7xxx`, a table of its own, first code `NL7001`, checked like NL8/NL9 (no gaps).
- `src/builtins.ts` `checkArena`: at `Arena.release` and `Arena.reset`, report `` `Arena.release` is deprecated: releasing while anything allocated after the mark is still referenced is undefined behaviour. Bracket the work with `using a = arena()`, which the compiler checks `` (and the same for `reset`). `Arena.mark` / `Arena.used` are unchanged.

### Advice

The NL9011 arena-loop advice (`src/checker.ts` ~1993, ~2292; `src/escape.ts` `passReason` / `noScopeReason`) recommends `using a = arena()` instead of `Arena.mark()` / `Arena.release(m)`. Regenerate `tests/wordings/nl9011_arena_loop.err` and every golden that pins the old text.

### Migration

The programs in `tests/` that call `Arena.release` / `Arena.reset` (crypto suites under `tests/link/`, `mem_*` cases) move to `using a = arena()` where the checker accepts the result and the test still tests what it did. `mem_arena_builtins`, `reject_arena_release_type`, `mem_loop_scope_control`, `mem_callee_scope_control`, `perf_arena_control` and `reject_par_arena` keep the old API because the old API is what they test. `std/` and `examples/` have no calls today and must stay at zero warnings.

### Tests and docs

- `tests/run.js`: a program calling each of `release` / `reset` compiles with exit 0 and the warning on stderr; `--json` carries `NL7001` and `severity: "deprecation"`; `mark` / `used` alone print nothing.
- `docs/LANGUAGE.md` `Arena` table marks both deprecated and points to the stage-1 rule; `docs/AI.md` stops teaching them; `AGENTS.md` and `docs/wp10-ci.md` list the NL7xxx band and the new severity.

## Out of scope

- Removing `Arena.release` / `Arena.reset`, or making them errors — a later, breaking change.
- A runtime wipe of released memory (#385).
- Changing when the compiler inserts its own automatic scopes.
- Any use of `arena()` inside `src/` (rolling freeze).

## Verification

Each stage, before its PR: `npm run check`, `npm test` read for its skip count (only no-WASI-sysroot / `NISH_BOOTSTRAP` / no-`jq` skips allowed), `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/gen-diagnostic-codes.mjs --check`, `node scripts/changelog-gen.mjs --check-subject "<title>"`.
