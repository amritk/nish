---
name: Facts for arrow captures
overview: Read a WP29 capture as an argument to the lifted arrow instead of as an escape, so an arrow that only reads what it captures leaves the caller's objects on the stack or in a releasable scope and the caller's parameters `readonly nocapture`. A capture the arrow keeps still leaks, exactly as today.
stages:
  - id: probe
    title: Probe the arrow's own facts
    goal: Prove the lifted arrow already has sound facts for its capture parameters before anything reads them
    verification: A scratch build of the three probe programs shows each capture parameter's pointer facts, escaping bit and element hand-out as the Probe section expects
    status: completed
    todos:
      - id: probe-arrow-facts
        content: Dump the arrow's FunctionFacts for its capture params on three probes (read, push, element kept) — see Probe
        status: completed
      - id: probe-chain
        content: List the instance chain capturesOf walks from host to arrow for fnarg_capture_forward and a parallel-forwarded arrow — see Probe
        status: completed
  - id: element-fact
    title: The arrow decides its capture parameters' elements
    goal: A lifted ordinary arrow's string[] capture parameter carries a decided elementsFree, and no host rule that walks only its own references accepts a captured array
    verification: The probe-3 pair reads elementsFree false for the keeping arrow and true for the reading one, and node tests/run.js mem_join_parts is green
    todos:
      - id: element-decide
        content: Run decideElementParams over a capturesForCall arrow's capture parameters only, its written ones unchanged — see Probe result
        status: in_progress
      - id: element-carrier
        content: storedIntoReturnedArray refuses a carrier any arrow captures, since isCarrierUse never sees the arrow's uses — see Probe result
        status: pending
  - id: attributes
    title: Attributes pass reads the arrow
    goal: A captured parameter of the host inherits the arrow's facts for its capture parameter through the existing passedTo fixpoint
    verification: fnarg_capture_escape's fill keeps neither readonly nor nocapture, the new read-only case gains both, and node tests/run.js fnarg_capture is green
    todos:
      - id: capture-target
        content: Add captureTarget(call, arrow, k) answering the arrow and parameter index, or null when the chain is not ordinary — see The capture target
        status: pending
      - id: attrs-note-captured
        content: Route noteCaptured in src/attributes.ts through the USE_ARGUMENT bookkeeping for that target, keeping escapeParam as the null fallback — see Attributes pass
        status: pending
  - id: escape
    title: Escape analysis reads the arrow
    goal: A captured local gets the outcome an argument to the arrow would get, element hand-outs included
    verification: mem_join_parts_captured and fnarg_capture_escape print what they print today, the new stack case shows an alloca, and node tests/run.js mem_ is green
    todos:
      - id: escape-argument-outcome
        content: Extract the USE_ARGUMENT branch of useOutcome in src/escape.ts into argumentOutcome(callee, index, …) — see Escape analysis
        status: pending
      - id: escape-local-outcome
        content: Replace the isCaptured short-circuit in localOutcome with argumentOutcome over each capture target, FLOW_LEAKS on null — see Escape analysis
        status: pending
  - id: cap-params
    title: Attributes on the instance's capture parameters
    goal: The %cap.N parameters an instance forwards carry the attributes the arrow's own parameter earns
    verification: The new read-only golden shows readonly nocapture on the instance's %cap.0, and llvm-as accepts every moved golden
    todos:
      - id: emit-cap-attrs
        content: Give captureParamTypes' parameters in src/emit.ts paramAttributes from the arrow's facts, noundef alone when captureTarget is null — see Instance capture parameters
        status: pending
  - id: ship
    title: Tests, docs, record, PR
    goal: Land it with the negatives that would catch a use-after-free, the rules rewritten, and its security record
    verification: npm run check, npm run lint, the targeted runs, wasi and performance, both goldens regenerated and read, CI green on every shard
    todos:
      - id: tests-positive
        content: Add the three positive cases with .ll goldens and register them with the differential goldens — see Tests
        status: pending
      - id: tests-negative
        content: Add the four negative cases, each reading a kept value back after churn — see Tests
        status: pending
      - id: docs-rules
        content: Rewrite LANGUAGE.md's capture paragraph, ARCHITECTURE.md's capture row and IR_COOKBOOK.md's capture note — see Docs
        status: pending
      - id: security-record
        content: Add a CG row to docs/security/codegen.md and a Properties verified row — see Docs
        status: pending
      - id: goldens-pr
        content: Regenerate tests/self/goldens, read the diff, open the perf(codegen) PR — see Verification
        status: pending
---

# Facts for arrow captures

## Context

An arrow given to a function parameter may read the caller's `const` locals and parameters ([LANGUAGE.md "Function parameters"](../../docs/LANGUAGE.md)). Each capture is passed as one more argument: the instance the arrow is given to carries it as `%cap.N` and only forwards it, through any instances the arrow is passed on to, until it reaches the arrow's own parameter at `writtenArity() + k` (`capturesOf`, `captureValue` in [src/emit.ts](../../src/emit.ts)).

Both analyses treat every such capture as an escape, because "no fact describes" `%cap.N`:

| Where | Today |
| --- | --- |
| [src/escape.ts](../../src/escape.ts) `localOutcome` | `isCaptured(v)` gives `FLOW_LEAKS`, so the object is never an alloca and no scope frees it |
| [src/attributes.ts](../../src/attributes.ts) `noteCaptured` | `escapeParam` sets `captured`, `outlives`, `writesThrough`, `writesShared`, or pushes `DIRT_ESCAPE` for an own object |
| [src/emit.ts](../../src/emit.ts) `%cap.N` params | `noundef` only |

That conservatism was CG-12's fix ([docs/security/codegen.md](../../docs/security/codegen.md)): before it, a captured `parts` array was released while the arrow kept one of its elements. It is right for `fnarg_capture_escape` (the arrow pushes captures into an outer array). It is needlessly wrong for the common read-only arrow, `each(xs, (x) => use(name))`.

## Approach

**A capture is an argument to the arrow.** The value has exactly one consumer that can do anything with it: the lifted arrow, at parameter `writtenArity() + k`. Every instance between host and arrow only forwards it, since the source cannot name `%cap.N`. So the host reads the capture through the same rules it applies to `f(x)` with `f` = the arrow and the index = that parameter: `calleeCaptures`, `handsOutElements`/`passesToFreeElements`, the `passedToCallees` fixpoint. No new fact kind is needed, and the element rule that CG-12 turned on is the one an ordinary argument already meets.

**Fail closed off the ordinary chain.** `captureTarget` answers null, and today's escape stands, unless every instance from the host's call to the arrow is an ordinary instance (not a parallel entry, a `spawn` entry, a region form, or a `declare function`) and the arrow's facts exist. Parallel forms and tasks already keep their own facts by their rules (`capturesForCall` false), so this widens nothing for them; it only stops an ordinary arrow forwarded into one from borrowing facts that `markParallelEntry` rewrites.

**Invariants to keep.** A call that passes captures is never a tail call (`emit.ts`, `capturesOf(callee).length > 0`): that is what makes a host alloca live for the whole call. Do not loosen it. Strings handed to a user function still escape in the attributes pass ("no fixpoint for strings", ARCHITECTURE.md); this plan changes nothing there.

## Probe

Before writing code, confirm what the arrow's own facts say. Build three scratch programs under the scratchpad with `build/nish --emit-llvm -O` and read the arrow's `define` line (and, if needed, a temporary debug print of `FunctionFacts.pointerParamAt(writtenArity()+k)`, not committed):

1. `each(xs, (x) => { t.n = t.n + x })`, with `t` a `const` object: the capture param should be not `captured`, not `outlives`, with `writesThrough` set.
2. `each(xs, (x) => { keep.push(b) })`: `b`'s capture param `captured` and `outlives`.
3. `atLast(n, (i) => { log.last = parts[i] })` (the CG-12 shape): `parts` must read as handing out elements, through whatever `useOutcome` uses (`handsOutElements` on the arrow's side). **If the arrow's facts do not record this, stop**: the element rule needs its own fact first, and that becomes stage 1 of this plan.

Also print the chain `collectCaptures` walks for `tests/link/fnarg_capture_forward` and for an arrow `each` passes to `parallelMap`, to pin what `captureTarget` must refuse.

### Probe result (2026-11-06): stopped at step 3

Built against `66f9806c` with a temporary print of `pointerParamAt(writtenArity() + k)` on both fact rounds (reverted).

| Probe | Capture param | writesThrough | captured | outlives | elementsFree | As expected? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 `t.n = t.n + x` | `t` | true | false | false | false | yes |
| 2 `keep.push(b)` | `b` | true | true | true | false | yes (`escaping` set too) |
| 2 | `keep` | true | false | false | false | yes |
| 3 `log.last = parts[i]` (CG-12) | `parts` | false | false | false | false | **no fact behind it** |
| 3, control: arrow only reads `parts[i].length` over a `returnsFreshElements` listing | `parts` | false | false | false | false | same answer as the keeping arrow |

Step 3 reads as "hands out elements", but the arrow's facts do not record that.
`analyzeEscapes` runs `decideElementParams` only when `!sig.lifted`
(`src/escape.ts`, end of `analyzeEscapes`), so a lifted arrow's
`elementsFree` is never decided. It is `false` for every arrow: a read-only
arrow and one that keeps an element get the same answer. An ordinary function
in the same program (`plain(log, parts)`, a read) does get the decision. So the
element rule has no fact of its own for an arrow parameter, which is the
plan's stop condition.

What also has to change is the host side, and the stop matters there. Two host rules
decide an element question by walking `refsOf(v)`. `visit` returns at
`N_ARROW`, so that walk never sees a use inside the arrow:

- `storedIntoReturnedArray` / `isCarrierUse`. A `string[]` the host fills,
  captures and returns would pass as a carrier once `localOutcome` stops
  answering `FLOW_LEAKS` for a capture. The pushed strings would then take the
  array's outcome while the arrow keeps `xs[0]` in an older object, which is
  `mem_capture_element_keep`'s use-after-free.
- `isJoinedParts`. It already refuses a captured `parts` explicitly, and the
  plan keeps that refusal.

Today the `isCaptured` short-circuit in `localOutcome` is the only thing
that keeps a captured array out of the carrier rule. Removing it (stage
`escape`) is sound only once the arrow's element hand-out is a decided fact
and the carrier rule reads it (or refuses a captured carrier outright).

Chains `collectCaptures` / the instances walk (step 4), all of which `captureTarget` must refuse:

- `fnarg_capture_forward`, arrow0: `nish_main` → `each$fn.16.nish_main$arrow0(%xs, %cap.0)` (ordinary) → `nish.parallelMap$…$arrow0(%src, %cap.0)` (parallel entry) → `parallelMapInto$…(%src, %dst, %cap.0)` → `$chunk(…, i8* %ctx)` / `mapRange$…(…, %cap.0)` → `nish_main$arrow0(%x, %k)`.
- `fnarg_capture_forward`, arrow1: `nish_main` → `run$fn.16.nish_main$arrow1(%x, %cap.0)` (ordinary) → `nish.ThreadScope.spawn$…$arrow1(…, %cap.0)` (spawn entry) → `$run(i8* %p)` / `$finish` → `runTask$…(…, %cap.0)` → the arrow.
- `each` → `parallelMap`: `host` → `each$fn.11.host$arrow0(%xs, %cap.0)` → `nish.parallelMap$…` → `parallelMapInto$…` → `$chunk(i8* %ctx)` / `mapRange$…` → `host$arrow0`.

Past a parallel or spawn entry, a capture travels inside an `i8*` context
struct as well as `%cap.N`. So "every instance only forwards it" holds only
up to the first non-ordinary instance, as `captureTarget` assumes.

**Proposed new stage 1 (`element-fact`)**: decide `elementsFree` for a lifted arrow's capture parameters (lift the `!sig.lifted` guard for them, or a capture-only variant of `decideElementParams`), pin it with a probe-3 pair (keep → false, read → true), and make `storedIntoReturnedArray` refuse a carrier that any capture target does not prove `elementsFree`. Then stages `attributes` through `ship` as written.

## The capture target

One helper beside `capturesOf` in [src/parallel.ts](../../src/parallel.ts), used by both passes:

```ts
/** The arrow parameter capture `k` of `arrow` reaches from a call of `callee`, or null when a non-ordinary instance is on the way. */
export const captureTarget = (callee: FunctionSig, arrow: FunctionSig, k: i32): CaptureTarget | null
// CaptureTarget { sig: FunctionSig /* the arrow */, index: i32 /* arrow.writtenArity() + k */ }
```

Both passes reach the call from the `N_ARROW` node: its parent is the call whose callee (`nodeCallees`) is the instance. Today's `noteCaptures` walks idents under the arrow; keep that walk to find `(source local, k)` pairs, with `k` the index of the ident's `captureOf` local in `arrow.captures`.

## Attributes pass

In `noteCaptured` ([src/attributes.ts](../../src/attributes.ts)), when `captureTarget` answers:

- **parameter source**: do what `noteUse`'s `USE_ARGUMENT` branch does for a pointer parameter passed at `index` to `sig`: push `sig`'s LLVM name and `index` onto `passedToCallees`/`passedToIndices`. The fixpoint at `:4775` then gives it the arrow's `writesThrough`, `writesShared`, `captured`, `outlives`. Extract a shared `noteArgument(name, callee, index)` from `noteUse` instead of copying it.
- **own object (`ROOT_OWN`)**: do what an own object passed as an argument does, rather than pushing `DIRT_ESCAPE`. Find the existing argument path for dirt (`DirtMark` users) and route through it.
- **null**: `escapeParam` / `DIRT_ESCAPE`, as now.

## Escape analysis

In [src/escape.ts](../../src/escape.ts):

- Extract the `found.kind === USE_ARGUMENT` branch of `useOutcome` into `argumentOutcome(callee, index, expr | null)`. The `listing && handsOutElements` check at its head takes the expression today; for a capture, ask the same question of the arrow's parameter (what the probe found in step 3).
- `noteCaptures` records `(source, call, arrow, k)` rather than just `source`.
- `localOutcome`: replace the `isCaptured` short-circuit with the join of `argumentOutcome` over every capture of `v` (an arrow may capture it at several calls), and the outcome of its other uses as now. Any null target gives `FLOW_LEAKS, false, true`, today's answer.
- A `FLOW_LOCAL` outcome may make the object an alloca. That is sound because the call that passes it is never a tail call and the arrow runs before the call returns. A later loop pass reusing the slot is the `spawn` hazard `spawnCaptures` names; spawn entries are off the ordinary chain, so `captureTarget` already refuses them.

`isJoinedParts` keeps refusing a `parts` array any arrow names: what decides that release is order (the arrow may run after the join), not escape. See Out of scope.

## Instance capture parameters

`captureParamTypes`' parameters in [src/emit.ts](../../src/emit.ts) (`:550`) get `paramAttributes(this.table, name, type, arrowFacts, isPrivate)` for the target's parameter when `captureTarget` answers from this instance, and `noundef` alone otherwise. The comment there ("No fact is collected about a parameter the source never names, so none is claimed") is rewritten to say whose fact is claimed and why it holds: the instance only forwards it.

## Out of scope

- The `join` release for a captured `parts` array (`isJoinedParts`). It needs an ordering proof (every capturing call precedes the join, across loop passes), not an escape fact. It could be a follow-up.
- Captures in `expose`, `exposeWith`, `region`, `enter` (still capture nothing), data-parallel forms and tasks (unchanged rules and goldens: `tests/link/par_capture`, `par_capture_large`, `par_map_captured_strings` must not move).
- String parameters' `nocapture` (no string fixpoint).
- Any language change: no new construct, diagnostic or guide page.

## Tests

Each positive case is a `tests/cases/*.ts` with `.ll` and `.out`; each negative reads a kept value back after a `churn()` that reuses every byte a wrong release would have freed (mirror [tests/cases/fnarg_capture_escape.ts](../../tests/cases/fnarg_capture_escape.ts) and [tests/cases/mem_join_parts_captured.ts](../../tests/cases/mem_join_parts_captured.ts)).

| Case | Shape | Pins |
| --- | --- | --- |
| `mem_capture_read_stack` | `const b = new Box(n); each(xs, (x) => { t = t + b.v * x })` | `b` is an `alloca` in the host's `.ll` |
| `fnarg_capture_readonly` | host `sum(p: Point, xs)` whose only use of `p` is a read-only capture | host `p` is `readonly nocapture`; the instance's `%cap.0` too (stage 4) |
| `mem_capture_read_scope` | a loop pass that allocates an object a read-only arrow captures | the pass scope releases it (mirror `mem_loop_scope*` goldens) |
| `mem_capture_forward_keep` (neg) | arrow forwarded through a second instance that it pushes the capture from | leaks, value intact after churn |
| `mem_capture_callee_keep` (neg) | arrow passes the capture to a named function that stores it | leaks through the fixpoint |
| `mem_capture_element_keep` (neg) | arrow stores `xs[i]` of a captured array into an outer object | elements kept (the CG-12 shape on a non-`parts` array) |
| `mem_capture_parallel_forward` (neg) | ordinary arrow forwarded into `parallelMap` | `captureTarget` null: today's IR exactly |

Register the positives with `node tests/differential/goldens.js --update` in the same commit. The PR body shows the exact LLVM IR for each new snippet (CLAUDE.md).

## Docs

- [docs/LANGUAGE.md](../../docs/LANGUAGE.md) `:3197`: "Escape analysis and the parameter attributes count a capture as an escaping use…" becomes: a capture is read as an argument to the arrow, so it escapes only when the arrow keeps it; name the fallback cases and `isJoinedParts`.
- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) attributes table, the "no `nocapture`, no `readonly` (params)" capture row (`:379`), and the closures paragraph near `:134`.
- [docs/IR_COOKBOOK.md](../../docs/IR_COOKBOOK.md) `:1240`.
- [docs/wp9-optimisation.md](../../docs/wp9-optimisation.md) `:13`, [docs/wp15-performance.md](../../docs/wp15-performance.md) `:14`: grep for "capture" and move each pointer (CLAUDE.md, moving a fact).
- [docs/security/codegen.md](../../docs/security/codegen.md): a new CG row (scope: `captureTarget`, `noteCaptured`, `localOutcome`, `%cap.N` attributes; what a wrong answer would be, a use-after-free; the negatives as its tests), and a Properties verified row: "a capture escapes iff the arrow keeps it, or the chain is not ordinary". Update CG-12's text where it says every capture is an escape. Check `node scripts/security-scope.mjs`.
- No `docs/guide/` page: the change is invisible to a Nish user except as speed.

## Verification

```bash
bash scripts/fetch-seed.sh --force
```

```bash
npm run check
```

```bash
npm run lint
```

```bash
node tests/run.js fnarg_capture && node tests/run.js mem_ && node tests/run.js par_capture && node tests/run.js capture
```

```bash
WASI_SYSROOT=/usr node tests/run.js wasi
```

```bash
node tests/run.js performance
```

```bash
node tests/self/goldens.js --update
```

Read the self-goldens diff: the compiler's own capturing arrows (comparators, `each` loops) should gain `readonly`/`nocapture` or allocas and nothing else. Any capture that moved the other way is a bug. Commit as `perf(codegen): read an arrow's captures as arguments to it`, with a `Measured:` trailer from `node tests/run.js performance` or a self-build RSS figure and its noise band (`.claude/testing.md`). Then CI: every `test (…, shard N/8)` row green on the head, skip counts read.
