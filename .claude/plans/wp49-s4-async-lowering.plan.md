---
name: WP49 stage 4, part 2 — compile `async` functions
overview: Replace part 1's NL2653 gate with the frame lowering of docs/wp49-async-server.md §3, a small run-to-completion driver standing in for stage 5's executor, and emitted TypeScript async/await, so async programs run natively and under Node. A program with no `async` compiles byte for byte as before (D1). Part of #1141.
stages:
  - id: lowering
    title: "feat(codegen): lower async functions to frame state machines (WP49 stage 4, part 2)"
    goal: An async program that passes part 1's rules compiles to native code through per-function frame structs and resume switches, runs to completion on an in-process driver, and prints what it should; a program with no async is unchanged byte for byte.
    verification: npm run check && npm run lint && node tests/run.js async && node tests/run.js await && node tests/run.js reject_async && node tests/run.js performance && node tests/run.js emit-ts && WASI_SYSROOT=/usr node tests/run.js wasi (failure count no higher than main's) && the D1 diff of every no-async tests/cases .ll against main reports 0 different
    status: pending
    todos:
      - id: frame-layout
        content: Lay out one frame struct per async function — the named locals live across an await plus a state number — with each awaited callee's frame nested in its caller's and frames at different awaits sharing space as a union, so a task's frame tree has a compile-time size (§3)
        status: pending
      - id: resume-switch
        content: Emit each async function as a resume function that switches on the state number; each await saves the frame and returns PENDING; await stays at statement top so every slot is a named local
        status: pending
      - id: attributes
        content: Apply WP24 §4.3 — a function with an await loses willreturn and its saved locals lose readonly; functions without an await keep every attribute they have today, even when an async function calls them
        status: pending
      - id: driver
        content: Add a minimal run-to-completion driver for spawn, awaitAll and an async main, resuming tasks through a generated switch on the task kind (no function pointers); record in docs/wp49-async-server.md what stage 5's executor replaces
        status: pending
      - id: lift-gate
        content: Remove the NL2653 gate (retire the code per codes.ts conventions, RULE_COUNT and scripts/gen-diagnostic-codes.mjs --check kept right), keep NL2652 for wasm, and make emit-ts refuse async cleanly via walk.missType() until stage emit-ts lands
        status: pending
      - id: tests
        content: Positive tests/cases with golden .ll, llvm-as pass and native round trip with expected stdout — single await, chain of awaits, awaitAll, spawn, async main, Result-returning async call; an unused-async-function case proving the rest of the IR unchanged; at least one negative test; register with tests/differential/goldens.js --update and regenerate tests/self/goldens
        status: pending
      - id: d1-proof
        content: Diff the .ll of every tests/cases program with no async against main's build and report the count in the PR body (part 1 found 0 of 892)
        status: pending
      - id: docs
        content: docs/IR_COOKBOOK.md entry, the IR doc, docs/LANGUAGE.md async section (no longer rejected, with the "Where it is not Node" resume-order differences as declared differences), docs/guide async page leading with Promise<Result<T, E>> failure, and the Stage 4 part 2 section of docs/wp49-async-server.md
        status: pending
  - id: emit-ts
    title: "feat(interop): emit async functions as TypeScript async/await (WP49 stage 4, part 2b)"
    goal: An async program's --emit-ts output runs under Node with async/await and prints the same as native for every async tests/cases program whose output does not depend on interleaving.
    verification: npm run check && npm run lint && node tests/run.js emit-ts && node tests/run.js async && node tests/run.js await && node tests/differential/run.js (async cases agree with native)
    status: completed
    todos:
      - id: emit-async
        content: Emit async functions, await, spawn, awaitAll and an async main as TypeScript async/await in src/emit-ts-*.ts, reading types only through walk.typeAt and treating a null binding table under walk.untyped as unknown via walk.missType()
        status: completed
      - id: emit-tests
        content: Take the async tests/cases out of the emit-ts known list (regenerate tests/differential/emit-ts-known.txt only under CI's pinned Node), add differential coverage, regenerate goldens
        status: completed
      - id: emit-docs
        content: Record in docs/LANGUAGE.md and the guide async page that --emit-ts output uses Node's async/await and where its resume order differs from native (§2 "Where it is not Node")
        status: completed
---

# WP49 stage 4, part 2 — compile `async` functions

Design source: `docs/wp49-async-server.md` §2, §3, §10 and "Stage 4, part 1".
Part 1 (#1160, 89dad841) is the checker. This plan is the lowering.

The two stages are a chain: emit-ts cannot be exercised until `lowering` lifts
the NL2653 gate. It is split because `lowering` is a complete, mergeable
feature on its own (async runs natively) and already one full review, as the
request asks ("lowering plus driver plus goldens first, emit-ts second").
`emit-ts` starts once `lowering` merges.

## lowering

**Owns:** `src/**` except `src/emit-ts*.ts` beyond the one-line async refusal,
`runtime/**`, `std/**`, `tests/cases/**`, `tests/run.js`, `tests/self/goldens/**`,
`tests/differential/goldens*`, `tests/differential/emit-ts-known.txt`,
`docs/IR_COOKBOOK.md`, `docs/IR*.md`, `docs/LANGUAGE.md`, `docs/guide/**`,
`docs/wp49-async-server.md`, `docs/ARCHITECTURE.md`, `scalar.config.json`,
`scripts/gen-diagnostic-codes.mjs` outputs, `.claude/plans/wp49-s4-async-lowering.plan.md`

The driver is deliberately not stage 5: no `runtime-async.c`, no `nish:async`
loop, no `serve`, no async fetch or Postgres. Every task runs to completion in
process; `spawn` may run its task eagerly or queue it until the spawner's next
await or return, whichever the worker shows is simplest and states in the WP doc.
Frame slots are named locals only. The rolling freeze holds: `src/` uses no async.

## emit-ts

**Owns:** `src/emit-ts*.ts`, `tests/differential/**`, `tests/cases/*async*`
(expected output only), `tests/self/goldens/**`, `docs/LANGUAGE.md` (the
emit-ts paragraph of the async section), `docs/guide/**` (the async page's
emit-ts note)

Waits for `lowering` to merge (development and merge).

## Branches

- `lowering`: `claude/nish-async-lowering-48e3xy` (carries this plan file)
- `emit-ts`: `claude/nish-async-lowering-48e3xy-emit-ts`, cut from `main` after `lowering` merges

## Acceptance criteria

1. Single await, chain of awaits, awaitAll, spawn, async main and a Result-returning async call each compile, pass llvm-as and print the expected stdout natively.
2. 0 tests/cases programs without async have a `.ll` that differs from main's.
3. An unused async function leaves the rest of the program's IR unchanged.
4. A function without an await keeps its attributes; one with an await loses `willreturn`.
5. NL2652 still refuses async in a wasm build.
6. `src/` uses no async.
7. docs/LANGUAGE.md and the guide no longer describe async as rejected, and state the resume-order differences from Node.
8. Every async tests/cases program's `--emit-ts` output runs under Node and prints the native output.
