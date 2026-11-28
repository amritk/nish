---
name: WP92 — std/ui state management, a signals graph without closures
overview: std/ui keeps its state in a fine-grained signals graph (a port of alien-signals' push-pull algorithm as std/signals) whose derivations, effects and handlers are top-level functions over a typed per-node context, so a signal write marks only the retained UI nodes it reaches layout- or paint-dirty and std/gfx redraws only when something is dirty.
priority: 280
labels: [ready]
issue: 2417
stages:
  - id: s1-design
    title: WP92 S1 — the signals design note
    goal: docs/wp92-signals.md settles the graph, the Rt, Signal, Store and bridge API, memory, the dirty-marking rules and the four scenarios, each with a compiled sketch or a measurement
    verification: Every sketch the note quotes compiles (or refuses with the code it names) under build/seed/bin/nish run, the string-growth figure is re-measured, and node docs/check-links.mjs passes
    issue: 2418
    todos:
      - id: s1-note
        content: Write docs/wp92-signals.md — algorithm, API, memory, dirty rules, scenarios, rejected models — see WP92 S1
        status: pending
      - id: s1-sketches
        content: Re-run the probe sketches and the dispatch bench on the current seed and record each result in the note — see WP92 S1
        status: pending
  - id: s2-signals
    title: WP92 S2 — std/signals, the reactive runtime
    goal: std/signals.ts ships Rt, Signal, Store with computeds, effects and handlers, batch, effect scopes and dispose, ported from alien-signals with its notice, and the ported tests pass natively
    verification: The tests/cases signals programs pass with goldens and llvm-as, the ported alien-signals suite passes under std/testing, the string-growth check stays inside its bound, node tests/run.js third-party-licence passes, and node scripts/gen-reference.mjs --check passes
    issue: 2419
    todos:
      - id: s2-graph
        content: Add std/signals.ts — Rt with the flat link arrays, flags, propagate, checkDirty, batch and the effect queue — see WP92 S2
        status: pending
      - id: s2-store
        content: Add Signal and Store in std/signals.ts — typed contexts, function columns, cut-off, handlers as nodes, scopes and dispose — see WP92 S2
        status: pending
      - id: s2-notice
        content: Add std/LICENSE-alien-signals, its THIRD_PARTY_NOTICES.md entries and its name in the three release.yml presence gates — see WP92 S2
        status: pending
      - id: s2-tests
        content: Port alien-signals' tests to tests/cases signals programs with the upstream notice, and add the string-growth check — see WP92 S2
        status: pending
      - id: s2-docs
        content: Register signals in src/std-modules.ts, std/README.md and standard-library.md, add docs/guide/using-nish/signals.md with its route, regenerate docs/reference and the goldens — see WP92 S2
        status: pending
  - id: s3-bindings
    title: WP92 S3 — headless UI bindings and dirty marking
    goal: A retained UiNode's chained setters take a plain value, a Signal or a computed node, bindings mark the node layout- or paint-dirty when the value changes, and the four scenarios run headless
    verification: node tests/run.js ui_ passes, each scenario program asserts which nodes are dirty after each write, an unchanged write marks nothing, and requestRedraw fires once per flush
    issue: 2420
    todos:
      - id: s3-uinode
        content: Add std/ui/node.ts — UiNode with chained setters that bind Signal or computed nodes — see WP92 S3
        status: pending
      - id: s3-dirty
        content: Add std/ui/dirty.ts — the layout and paint dirty queues, the flush order and the requestRedraw hook — see WP92 S3
        status: pending
      - id: s3-scenarios
        content: Add the virtualList, textInput, theme hot-swap and HUD scenario programs to tests/cases and register them as differential goldens — see WP92 S3
        status: pending
      - id: s3-docs
        content: Register ui/node and ui/dirty in src/std-modules.ts, add docs/guide/using-nish/ui.md with its route, regenerate docs/reference and the goldens — see WP92 S3
        status: pending
  - id: s4-gfx-loop
    title: WP92 S4 — std/ui on the std/gfx idle loop
    goal: A std/ui app runs on runApp's wait-for-events mode, sleeping while nothing is dirty and drawing only dirty nodes, natively and in the browser
    verification: An example UI app idles at the CPU figure WP89 S9 pins, a click redraws within one frame, and the HUD example keeps the game loop's rate
    issue: 2421
    todos:
      - id: s4-runner
        content: Connect the std/ui dirty queue to runApp's requestRedraw and idle mode in std/ui/app.ts — see WP92 S4
        status: pending
      - id: s4-examples
        content: Add examples/ui/todos.ts and examples/ui/hud.ts on both backends — see WP92 S4
        status: pending
      - id: s4-docs-security
        content: Register ui/app, extend the ui guide page and docs/reference, and name std/ui/app.ts in docs/security/gfx.md's scope — see WP92 S4
        status: pending
  - id: s5-direct-api
    title: WP92 S5 — passing derivations directly once generic function-type aliases land
    goal: Store's methods take the derivation or handler as an argument, as in a.perTodo.computedStr(t, rowLabel) and a.perTodo.handler(t, toggle), and the staging fields go
    verification: The S2 and S3 programs are rewritten to the direct form and pass, the staging fields are gone, and the guide page shows only the direct form
    issue: 2422
    todos:
      - id: s5-api
        content: Replace the staging fields in std/signals.ts and std/ui/node.ts with method parameters typed through Derive — see WP92 S5
        status: pending
      - id: s5-docs
        content: Rewrite the tests, examples and docs/guide/using-nish/signals.md to the direct form — see WP92 S5
        status: pending
---

# WP92 — std/ui state management

## Context

std/ui is planned on WP89's std/gfx (#2235). WP89's frame model ([docs/wp89-gfx.md](../../docs/wp89-gfx.md) §4) is a game loop: every frame runs `step` (at most 8), `update(dt)` and `draw(alpha)`, and nothing tracks what changed. Nish has no capturing closures (NL2731), no arrow in value position (NL2336), no GC, and module constants hold only numbers, booleans and strings.

**Confirmed understanding.**
- **Goal:** settle how a std/ui app holds and changes state and how widget events reach it, without closures. The model is signals: a retained tree, fine-grained updates and event-driven redraw, after [amritk/niv](https://github.com/amritk/niv) (alien-signals plus DOM bindings).
- **In scope:**
  - std/signals, a port of alien-signals' push-pull algorithm;
  - its explicit-runtime API, usable on the seed today;
  - how signal writes mark retained UI nodes layout- or paint-dirty;
  - the wait-for-events loop mode this needs from WP89 S8 and S9;
  - the direct API that removes today's staging fields, once WP93 S1 (#2410) lands.
- **Done when:** the design note settles the model, std/signals passes the ported alien-signals tests, the four scenarios (virtualList, textInput, Theme.fromTokens hot-swap, a game HUD) run headless with correct dirty sets, and a UI app idles on the gfx loop.

**Ordering.** WP92 sits after WP51 (priority 40), WP89 (260) and WP93 (#2409, 270), at 280. S4 is blocked by WP89 S8 (#2243) and S9 (#2244). S5 is blocked by WP93 S1 (#2410), generic function-type aliases. Each blocked stage says so in its section. WP92 S2 is the std/signals port that WP93's parent issue calls "a separate plan".

## Approach

### The model: signals over typed per-node contexts

A derivation, effect or handler is a **top-level function over a typed context**, `(t: Todo) => string`. It is never a closure. A **direct binding** (`ui.checkbox().checked(t.done)`) needs no function at all. Three pieces carry it:

| Piece | What it is | Why |
| --- | --- | --- |
| `Rt` | One per app, not generic. Holds flat `i32` arrays: flags, dependency and subscriber links, the owning store of each node, the node's index in that store. Also the active subscriber, the batch depth, the effect queue and `updaters: Array<Updater \| null>`. | The graph is one scheduler over every node. It is passed explicitly because a module constant cannot hold an object. `Signal<T>` keeps its `Rt`. |
| `Store<C>` | A table per context type. Holds `ctx: C[]`, one function column and one value column per value kind (string, boolean, i32, f64, handler), and the cached values. | It keeps a node's context typed. No key lookup can go stale when a list row is removed. |
| bridge | One top-level function per store, `(rt: Rt, i: i32): boolean => APP[0].perTodo.update(i)`, reached through a module-private root slot `const APP = new Array<App \| null>(1)`. | `Rt` dispatches without generics. A method cannot be referenced (WP51 §2.2), so the bridge stands in for `store.update`. |

**A write, step by step:**
1. `t.done.set(true)` marks its subscribers Dirty or Pending and queues the effects.
2. The flush calls each dirty node's bridge, which calls `store.update(i)`, which re-runs the function on `ctx[i]`.
3. **Cut-off:** an unchanged value stops propagation there.
4. A changed value reaches its binding, which marks its UiNode layout-dirty or paint-dirty (S3).
5. The flush ends with one `requestRedraw()`.

**The app, today:**

```ts
class Todo {
  title: Signal<string>
  done: Signal<boolean>
}

const rowLabel = (t: Todo): string =>
  t.done.get() ? `[x] ${t.title.get()}` : `[ ] ${t.title.get()}`
const toggle = (t: Todo): void => t.done.set(!t.done.peek())

class App {
  rt: Rt
  perTodo: Store<Todo>
}
const APP = new Array<App | null>(1)
const updateTodo = (rt: Rt, i: i32): boolean => {
  const a = APP[0]
  if (a === null) return false
  return a.perTodo.update(i)
}

const todoRow = (a: App, t: Todo): UiNode => {
  a.perTodo.nextStr = rowLabel          // staging field until WP93 S1
  const label = a.perTodo.computedStr(t)
  a.perTodo.nextHandler = toggle
  const onToggle = a.perTodo.handler(t)
  return ui.row().gap(8).padding(4)
    .child(ui.checkbox().checked(t.done))
    .child(ui.text().text(label))
    .child(ui.button("x").onClick(onToggle))
}
```

**The same view after S5:**

```ts
.child(ui.text().text(a.perTodo.computedStr(t, rowLabel)))
.child(ui.button("x").onClick(a.perTodo.handler(t, toggle)))
```

**Chaining stays.** A setter given a plain value sets it. A setter given a `Signal` or a computed node id creates a binding. `.onClick(id)` takes a handler node, so it works today.

**Mapping from the libraries the request named.**
- A jotai atom is a `Signal`.
- A pinia store's getters are a `Store`'s computeds.
- A zustand store is the app class holding signals, with its actions as top-level functions over it.

None of the three needs a closure once a derivation is a function over a context.

### Rejected models

| Model | Why not |
| --- | --- |
| (a) Immediate mode: rebuild the tree each frame, query clicks by id | It burns CPU while idle. Scroll offsets, cursors and focus still need id-keyed side storage that outlives a per-frame arena. Every frame re-lays out everything. |
| (b) Function references plus one app state and an `i32` key | It works today, and was first chosen, then replaced. A key goes stale when a row is removed, and a whole-state parameter gives no fine-grained invalidation. Per-node typed contexts keep (b)'s dispatch and drop both problems. |
| (c) Elm-style `Msg` queue into one `update(state, msg)` | It works today, but every message invalidates the whole view, so it needs a diff to find what changed. The signals graph knows what changed. |
| (d) Retained widget state the library owns | Kept, as signals inside widgets: textInput's cursor and virtualList's scroll offset are `Signal`s the widget owns, in the same graph. |
| (e) Dirty tracking or idle redraw instead of reactivity | Kept as the loop mode, not as the state model. Signals produce the dirty set, and idle mode consumes it. |

### What closures would change

Nothing in the graph. WP93 S4 (#2413, inline-environment closures) could later add `computed(() => ...)` as an optional facade that lowers to the same `Store` node with the closure's environment as its context. That is out of scope here.

### Facts the sketches established (seed 0.44.0)

| Sketch | Result |
| --- | --- |
| a generic type alias `type F<C> = (c: C) => string` | refused by the validator (no code): "Generic type parameters are forbidden on a type alias". WP93 S1 admits it for a function-type body |
| an inline function type on a method or constructor parameter | NL2338 |
| a top-level generic factory storing its function parameter | NL2334 |
| a capturing arrow | NL2731 |
| a capture-free arrow in value position | NL2336 |
| JSX | parse error |
| a non-generic alias-typed constructor parameter, stored in a field | compiles: WP51 stage 1 made it a reference parameter |
| a generic class field `get: ((rt: Rt, c: C) => T) \| null`, assigned directly | compiles: this is the staging field |
| `Store<C>` plus a bridge (p1) | compiles and runs, with cut-off (`true`, `false`, `true` for change, no change, change) |
| chained `UiNode` setters (c1) | compiles and runs |

Module-storage indexing on the seed needs `--allow-panics` before the file (fixed on main by #2391). The entry module needs `export const main`.

**Dispatch cost.** 1024 nodes, 200k rounds, native `-O2`:
- direct call: 0.100 s, 0.49 ns per call;
- through a reference, a 1-member set: 0.188 s, 0.92 ns;
- through a reference, a 4-member set: 0.178 s, 0.87 ns.

So a stored reference costs about 1.8 to 1.9 times a direct call. A bridge adds a second indirect call per update, still under 2 ns per node.

**String growth.** A fresh string written into long-lived storage on every update grows without bound: 76 MB at 1,000 updates, 862 MB at 20M (`m2.ts`). A string computed therefore needs an in-place text slot or a region per node (S1 decides which, by measurement).

## WP92 S1 — the signals design note

Write `docs/wp92-signals.md`, the spec S2 to S5 build from. It answers these, each with a compiled sketch or a figure:

- **Algorithm.** It ports alien-signals 3.2.1's `createReactiveSystem`: `link`, `unlink`, `propagate`, `checkDirty`, `shallowPropagate` and the batch. The flags are None 0, Mutable 1, Watching 2, RecursedCheck 4, Recursed 8, Dirty 16, Pending 32, HasChildEffect 64. Links are nodes in flat `i32` arrays (dep, sub, prevDep, nextDep, prevSub, nextSub) with a free list, in place of JS objects.
- **API:**
  - `Rt`, `Signal<T>` (`get`, `set`, `peek`);
  - `Store<C>`'s `computedStr`, `computedBool`, `computedI32` and `computedF64`, plus `effect`, `handler`, `update`, `read` and `setCtx`;
  - the staging fields (`nextStr`, `nextBool`, `nextI32`, `nextF64`, `nextHandler`);
  - the bridge and root slot an app writes per store;
  - `batch`;
  - effect scopes and `dispose`.
- **Memory:**
  - A disposed node's slots and links return to free lists.
  - An effect scope owns the nodes created inside it, so disposing a virtualList row frees them.
  - For string computeds, the note chooses a per-node text slot or a region per node. It re-measures `m2` (n = 1,000 and 20M) and gives the figure for each option.
- **Dirty-marking rules (S3):**
  - Layout properties mark the node layout-dirty, and its ancestors up to the nearest fixed-size box. These are gap, padding, width, height, flex, font size, text content, and child lists.
  - Paint properties mark only the node's rect paint-dirty. These are colour, background, opacity, checked and pressed visuals.
  - The flush order:
    1. signal effects;
    2. bindings mark nodes;
    3. layout over the dirty subtrees;
    4. paint over the dirty rects;
    5. one `requestRedraw()`.
- **Scenarios:**
  - **virtualList.** Rows are recycled. The list owns `scroll: Signal<f64>`. `setCtx(i, item)` re-points a row's context and marks it dirty.
  - **textInput.** The widget owns cursor, selection and scroll signals, and its value is a `Signal<string>` the app binds both ways.
  - **Theme.fromTokens hot-swap.** The theme is a `Signal<Theme>` every style binding reads. A swap is one `set` inside a batch: font tokens mark layout, colours mark paint.
  - **Game HUD.** The game's `step` writes `hp.set(x)`. Cut-off makes an unchanged value free, and the HUD re-lays out only the changed text.
- **Records.** It records the sketch table and the dispatch bench from the Approach. They are re-run on the then-current seed, with the bench's command line and noise band.
- **Rejected models.** It carries the rejected-models table, and what closures would change.

## WP92 S2 — std/signals, the reactive runtime

- **`std/signals.ts`.** The S1 API, ported from alien-signals' `src/system.ts` and `src/index.ts`. The upstream MIT notice ("Copyright (c) 2024-present Johnson Chu") goes at the head of the file.
  - Every index into the link arrays is guarded or proven by `src/bounds.ts`, so a `--deny-panics` caller can use the module.
  - It has no `wrappingAdd`, because counters stay in range.
- **Licensing** ([.claude/licensing.md](../licensing.md): a port is a copy).
  - Add `std/LICENSE-alien-signals` beside the module, as `std/LICENSE-fdlibm` is.
  - Add its entries in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md), for the module and for the ported tests.
  - Add `std/LICENSE-alien-signals` to the three package presence gates in `.github/workflows/release.yml` (the `for f in ...` lists beside `std/LICENSE-fdlibm`).
  - Check with `node tests/run.js third-party-licence`, which reads those gates.
  - Each ported test file carries the upstream notice. The PR body names the upstream (alien-signals 3.2.1) and says, function by function, whether the port keeps its structure.
- **Tests.** Port alien-signals' test files to `tests/cases/signals_*.ts`, each with `.out` and a golden `.ll`, asserting through `nish/testing`. Add:
  - one program that pins cut-off;
  - one that pins the effect order in a batch;
  - one that pins dispose freeing a scope's nodes;
  - the string-growth check from S1, with its bound.

  Register them with `node tests/differential/goldens.js --update`.
- **Docs.**
  - Add `signals` to `stdModuleNames` in `src/std-modules.ts` (a string-only `src/` edit: no new construct, so no freeze issue; run `node tests/run.js wasi` and `node tests/run.js performance`). Add its rows in `std/README.md` and `docs/guide/using-nish/standard-library.md`.
  - Add `docs/guide/using-nish/signals.md` with its route in `scalar.config.json`, showing the Todo example.
  - Add a public-declaration doc comment for each export, with `@param` and `@returns`.
  - Run `node scripts/gen-reference.mjs` and `node tests/self/goldens.js --update`.
  - Add `DECLARED` entries in `tests/nish-cmp.js` if a corpus program's IR moves.

## WP92 S3 — headless UI bindings and dirty marking

- **`std/ui/node.ts`.** `UiNode` with chained setters. Each setter has three forms: a plain value, a `Signal<T>`, or a computed node id (`text(label)`). A binding records the node and the property kind (layout or paint) as an effect in the node's scope. `.onClick(handlerId)` and `.child(n)` return the node.
- **`std/ui/dirty.ts`.** Two queues, `layoutDirty` and `paintDirty`, deduplicated by a flag per node, and the S1 flush order. The `requestRedraw` hook is a function-reference field the runner sets, and is a no-op headless.
- **Scenarios.** Four programs in `tests/cases/ui_*.ts`: virtualList, textInput, theme hot-swap and HUD. Each writes signals and asserts the exact dirty sets after each flush. One write repeats an unchanged value and asserts an empty set.
- **Docs.**
  - Add `ui/node` and `ui/dirty` to `stdModuleNames`.
  - Add `docs/guide/using-nish/ui.md` with its `scalar.config.json` route, and its row in `standard-library.md`.
  - Regenerate `docs/reference` and the goldens.
  - Register the scenario programs with `node tests/differential/goldens.js --update`.
- No widget set, layout algorithm or painting lands here. Layout and paint are stubs that record what they were asked to do.

## WP92 S4 — std/ui on the std/gfx idle loop

**Blocked by** WP89 S8 (#2243), which adds `runApp`'s wait-for-events mode and `requestRedraw()`, and WP89 S9 (#2244), whose `bench/gfx-idle` pins the idle-CPU and redraw-latency bounds this stage is judged by.

- **`std/ui/app.ts`.**
  - Sets the runner's `requestRedraw` from the dirty flush.
  - Runs the S3 layout and paint stubs from `draw`.
  - Runs a game HUD on continuous mode, where the game loop already draws every frame.
- **`examples/ui/todos.ts`** (idle mode) and **`examples/ui/hud.ts`** (continuous mode) run natively and in the browser, in CI's `examples` job.
- **Docs and scope.**
  - Register `ui/app` in `stdModuleNames` (`src/std-modules.ts`).
  - Add the runner section to `docs/guide/using-nish/ui.md`, and regenerate `docs/reference`.
  - `std/ui/app.ts` reads input events through std/gfx, so name it in [docs/security/gfx.md](../../docs/security/gfx.md)'s scope, which `node scripts/security-scope.mjs` checks. It adds no new reader of the network, terminal or another process.

## WP92 S5 — passing derivations directly once generic function-type aliases land

**Blocked by** WP93 S1 (#2410), "generic function-type aliases, so a factory can store its function". It admits `type Derive<C, T> = (ctx: C) => T` and makes a method or constructor parameter typed through it a stored reference.

- **`std/signals.ts`.** `computedStr(c: C, f: Derive<C, string>)`, `handler(c: C, f: Derive<C, void>)` and the other kinds take the function directly. The staging fields go. A breaking change on 0.x, so the commit carries `feat(runtime)!` (std/ changes ship under `runtime`; CLAUDE.md lists no `std` scope) and `BREAKING CHANGE:`.
- **`std/ui/node.ts`.** It takes the new form where it forwards derivations.
- **Docs and tests.** The S2 and S3 tests, the examples and the guide page move to the direct form. The bridge stays, because a method still cannot be referenced.

## Out of scope

- Closures. A `computed(() => ...)` facade over WP93 S4 is later, optional work over the same nodes.
- The widget set, the layout algorithm and painting. Later WP92 stages will add them.
- JSX. It is a parse error today.
- WP60 `Dyn`.
- Signals across threads.

## Tests

- **S2.** `tests/cases/signals_*.ts` (ported alien-signals cases, cut-off, batch order, dispose, string growth) with `.out` and goldens, mirroring `tests/cases/region_*`.
- **S3.** `tests/cases/ui_*.ts` scenario programs asserting dirty sets.
- **S4.** The examples, and the idle and latency checks from WP89 S9's bench.
- **S5.** The same programs in the direct form.

## Verification

- **Every stage:**

  ```bash
  npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
  ```
- **S2 and S3:**

  ```bash
  node tests/run.js signals
  node tests/run.js ui_
  node tests/run.js third-party-licence
  node tests/run.js wasi
  node tests/run.js performance
  node scripts/gen-reference.mjs --check
  node tests/self/goldens.js --update
  ```

  Read the diff from the goldens update. Run nish-cmp.
- **S1:** `build/seed/bin/nish run --allow-panics <sketch>.ts` for every sketch the note quotes.
