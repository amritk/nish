---
name: WP93 — stored callbacks for signals, by context argument and by inline-environment closure
overview: A signals-based std/ui needs a derivation or handler stored in a reactive node and called later. This plan gives Nish two strict-mode forms that allocate nothing and keep WP51's escape proofs. One is a top-level function plus a typed context argument, through generic function-type aliases. The other is a capturing arrow whose `const` captures live inline in the slot that holds it. Each lands behind a measured dispatch gate on native and wasm32.
spec: docs/wp93-closures.md
stages:
  - id: s1-generic-fn-aliases
    title: WP93 S1 — generic function-type aliases, so a factory can store its function
    goal: A generic function, method or constructor takes a parameter typed `Derive<C, T>` and stores it as a WP51 reference, so `computed(rt, t, rowLabel)` compiles with C and T inferred. A call whose argument is already on the heap is no longer refused for an escape-join mismatch.
    verification: node tests/run.js fnref && node tests/run.js generics && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s1-design-note
        content: Write docs/wp93-closures.md with the two forms, the representation, the rules, the gates and every figure it cites recomputed from its source — see WP93 S1 — generic function-type aliases, so a factory can store its function
        status: pending
      - id: s1-lift-nl1054
        content: "Admit a type alias whose type parameters are used by a function type (`type Derive<C, T> = (ctx: C) => T`) in src/, instantiating it at each use like a generic class field. Every other generic alias keeps NL1054 — see WP93 S1 — generic function-type aliases, so a factory can store its function"
        status: pending
      - id: s1-infer
        content: Infer the alias's type arguments from a reference argument at a generic call, or refuse with a message naming the explicit form — see WP93 S1 — generic function-type aliases, so a factory can store its function
        status: pending
      - id: s1-escape-join-heap
        content: Skip the escape-join refusal (NL2736, src/compilation.ts escape-join loop) for an argument whose allocation the call does not decide, such as a field or element read — see WP93 S1 — generic function-type aliases, so a factory can store its function
        status: pending
      - id: s1-construct
        content: Ship golden .ll, llvm-as pass, native round trip, negatives, LANGUAGE.md rule, cookbook entry and guide page for generic function-type aliases — see WP93 S1 — generic function-type aliases, so a factory can store its function
        status: pending
  - id: s2-wide-dispatch
    title: WP93 S2 — dispatch for sets wider than eight, measured
    goal: A call through a set of 16 to 64 members, the shape a signals runtime's node field produces, is lowered the way the data says is fastest, and never costs more than the indirect call WP28's compat closures would pay on the same stream.
    verification: node bench/wp93-dispatch/run.mjs && node tests/run.js fnref && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    todos:
      - id: s2-bench
        content: Add bench/wp93-dispatch/ — switch against a table of function pointers at K = 8, 16, 32, 64 on monomorphic, periodic, aperiodic and signals-propagation streams, plus WP28 section 7.4's programs re-run at the same commit — see WP93 S2 — dispatch for sets wider than eight, measured
        status: pending
      - id: s2-lowering
        content: Lower a set past the measured crossover to the faster form in src/fnref-places.ts makeDispatcher and src/emit-fnrefs.ts, or record that the switch stays — see WP93 S2 — dispatch for sets wider than eight, measured
        status: pending
      - id: s2-forged-tag
        content: Keep the forged-tag property under any table lowering (an out-of-range tag reaches a real member, or traps under the debug profile) with a tests/run.js check that fails when the mask is removed — see WP93 S2 — dispatch for sets wider than eight, measured
        status: pending
      - id: s2-record
        content: Record the tables in docs/BENCHMARKS.md and docs/wp93-closures.md, naming the commit main reaches, and update the NL9017 wording if the lowering changes — see WP93 S2 — dispatch for sets wider than eight, measured
        status: pending
  - id: s3-wasm-fields
    title: WP93 S3 — function-typed class fields on wasm32
    goal: A wasm32 build compiles a class with a function-typed field when the class never crosses the host boundary. NL2733 still refuses one whose layout the host reads, and the wasm-host security record states why a host-written tag is safe.
    verification: node tests/run.js fnref && node tests/run.js wasm && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && node scripts/security-scope.mjs
    todos:
      - id: s3-narrow-nl2733
        content: Narrow refuseHostReferences (src/fnrefs.ts) under layoutsShared from every class to the classes an export, an import or a sidecar signature reaches — see WP93 S3 — function-typed class fields on wasm32
        status: pending
      - id: s3-tests
        content: Add a wasm32 round trip of a class with a stored reference and a negative tests/link case for one the host reads — see WP93 S3 — function-typed class fields on wasm32
        status: pending
      - id: s3-security-row
        content: Add the row to docs/security/wasm-host.md and its index count in docs/security/README.md, each property citing its failing check — see WP93 S3 — function-typed class fields on wasm32
        status: pending
  - id: s4-inline-closures
    title: WP93 S4 — capturing arrows stored as inline-environment closures
    goal: An arrow that reads only `const` locals and parameters can be stored in a field, element, local or Map value as a tag plus its captured values, with no allocation. Every arena, region and escape rule sees through it to its captures.
    verification: node tests/run.js fnref && node tests/run.js closure && node tests/run.js arena && node tests/run.js region && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s4-layout
        content: Size each place's slot as an i32 tag plus the widest capture list stored there, capped at four 8-byte slots, in src/fnref-places.ts and the class layout. Over the cap is a new refusal code — see WP93 S4 — capturing arrows stored as inline-environment closures
        status: pending
      - id: s4-dispatch
        content: Unpack the slots in each dispatcher arm into the extra parameters WP29's capture lowering already passes, so each arm keeps its own escape facts — see WP93 S4 — capturing arrows stored as inline-environment closures
        status: pending
      - id: s4-origins
        content: Make src/escape.ts, the arena block rules (NL2418–NL2427) and src/region-rules.ts (NL2609, NL2610) treat storing a closure as storing each captured value, with a negative for each — see WP93 S4 — capturing arrows stored as inline-environment closures
        status: pending
      - id: s4-refusals
        content: Refuse closure equality, a closure as a Map key, a closure printed or converted to a string, and a closure crossing a thread, the C ABI or the host, with new codes and tests/link negatives — see WP93 S4 — capturing arrows stored as inline-environment closures
        status: pending
      - id: s4-emit-ts
        content: Emit a stored closure as a plain arrow in src/emit-ts-*.ts, reading types only through walk.typeAt — see WP93 S4 — capturing arrows stored as inline-environment closures
        status: pending
      - id: s4-construct
        content: Ship golden .ll, llvm-as, native and wasm32 round trips, negatives, LANGUAGE.md rule, cookbook entry, guide page, and the rewritten NL2731 and ARCHITECTURE.md closure wording — see WP93 S4 — capturing arrows stored as inline-environment closures
        status: pending
  - id: s5-signals-acceptance
    title: WP93 S5 — a signals-shaped acceptance program and its cost
    goal: A small signal, computed and effect graph runs on native and wasm32 in both forms, prints the same output in each, and its measured call and memory cost is recorded against WP28 section 7.4.
    verification: node tests/run.js closure && node bench/wp93-dispatch/run.mjs --signals && node tests/run.js wasi && npm run check && npm run lint
    todos:
      - id: s5-program
        content: Add tests/cases/closure_signals (context form) and tests/cases/closure_signals_inline (closure form) with expected stdout, native and wasm32 — see WP93 S5 — a signals-shaped acceptance program and its cost
        status: pending
      - id: s5-measure
        content: Measure both forms against a hand-written switch and WP28's opaque call on the same machine and commit, with peak RSS, and record the table — see WP93 S5 — a signals-shaped acceptance program and its cost
        status: pending
  - id: s6-wp28-rescope
    title: WP93 S6 — narrow WP28 C2b to what strict now covers
    goal: WP28's C2b and its issue describe only the function values strict still refuses, and the std/ui plan can cite the two forms as available.
    verification: npm run lint && node docs/check-links.mjs
    todos:
      - id: s6-wp28-doc
        content: Rewrite docs/wp28-compatibility-mode.md C2b and .claude/plans/wp28-compatibility-mode.plan.md c2b-function-values to the remainder (let captures, outliving the holder, generic and async closures) — see WP93 S6 — narrow WP28 C2b to what strict now covers
        status: pending
      - id: s6-grep-claims
        content: Grep docs/wp*.md, docs/MASTER_PLAN.md, docs/LANGUAGE.md, docs/guide/ and tests/** comments for "no closure" and "carries no environment" wording, and update each that this plan made false — see WP93 S6 — narrow WP28 C2b to what strict now covers
        status: pending
---

# WP93 — stored callbacks for signals

## Context

std/ui (WP92, planned) is signals-based, modelled on amritk/niv: a retained tree, fine-grained updates, redraw only when something changed. Its reactive runtime keeps a derivation or handler in a node and calls it later. The std/signals port itself is a separate plan.

Seed 0.44.0 can already run a closure-free graph. A `Computed<C, T>` holds a top-level `(ctx: C) => T` in a nullable generic field, and it memoizes correctly. This plan removes two language blockers to a good API:

- **No factory can store its function.** A function parameter whose type is written inline is a compile-time template (NL2334). Only one typed through a *non-generic* alias can be stored ([`docs/wp51-function-references.md:1020`](../../docs/wp51-function-references.md)), and generic aliases are refused (NL1054). So `computed<C, T>(fn)` cannot be written.
- **No inline derivation.** A capturing arrow in value position is refused (NL2731), so `computed(() => count.get() * 2)` cannot be written.

Confirmed scope:

- Both forms are in scope.
- Neither may allocate per closure or lose an escape proof.
- Both run on native and on wasm32.
- Done is judged by the stage gates below, with WP28 §7.4 re-measured as the comparison.

## Approach

**Two forms, one representation family.** Both are WP51 references, an i32 tag dispatched over a per-place set of known functions. The closure form adds its captured values inline in the same slot.

| | Context form (S1) | Inline closure (S4) |
| --- | --- | --- |
| Written as | `computed(rt, t, rowLabel)` | `computed(rt, () => t.done.get())` |
| Stored as | i32 tag | i32 tag + up to four 8-byte captured values |
| Allocation | none | none |
| Escape facts | joined over the set for declared args; S1 lifts the join for args already on the heap | captures go per arm; only declared args are joined |
| New lifetime rule | none | none; storing a closure is storing its captures |

**Why inline, not a region-allocated environment.** The node arrays sit outside any scope's region. A region-allocated environment stored there is NL2609 ([`src/region-rules.ts:194`](../../src/region-rules.ts)). A computed in a child scope reading a parent's signal hits NL2609 or NL2610 whichever way the edge points. Inline slots need no new rule, and they keep [`docs/ARCHITECTURE.md:136`](../../docs/ARCHITECTURE.md)'s "no environment struct" true for allocation, while S4 rewrites its "no closure value" wording.

**Strict, not WP28 compat.** Both forms are checked whole-program and erase to plain TypeScript: a stored arrow over `const` captures behaves the same in JavaScript. So they belong in strict, and WP28 C2b shrinks to what strict still refuses (S6).

**The measurement gate, corrected against WP51's data.** At confirmation the gate was "a jump table past eight members, no worse than §7.4's 1.26–1.40×". WP51's own measurements change the details, not the bar.

What WP51 measured:

- `llc` already lowers a switch of five or more members to a jump table (§3.5).
- WP51 compared that jump table with an indirect `call *` on the same stream (§3.4–§3.5):

  | Stream | switch vs `call *` |
  | --- | --- |
  | periodic, K up to 8 | the switch was 3.1–4.7× faster |
  | aperiodic, K = 2 | the switch was 1.28× faster |
  | aperiodic, K = 4 | the switch was 1.21× faster |
  | aperiodic, K = 8 | 1.07×, within the noise band |

- The 4.6× at K = 16 and 12.4× at K = 32 (periodic, against a direct call) have no indirect-call row, so whether a table of function pointers beats the switch there is unmeasured.
- §7.4's 1.26–1.40× is one opaque callee against a direct call, and names no commit.

S2's gate, therefore:

- At every K and stream measured, the chosen lowering costs no more than an indirect call on the same stream, within the run's band. That is the cost WP28 C2b's opaque function value would pay.
- A set of one stays within ±3% of a direct call.
- §7.4's programs are re-run at the same commit, so the comparison has a pinned baseline.

**Dependencies.** S4 needs WP51 S3 ([amritk/nish#1899](https://github.com/amritk/nish/issues/1899), capture-free arrows in value position) merged first. That stage is filed under WP51 and is not repeated here. S2 and S3 do not depend on S1. S5 needs S1–S4.

## WP93 S1 — generic function-type aliases, so a factory can store its function

The design note [`docs/wp93-closures.md`](../../docs/wp93-closures.md) is written first and is this plan's `spec`.

**Generic aliases.** Admit a generic alias whose body is a function type:

```ts
type Derive<C, T> = (ctx: C) => T
class Computed<C, T> { fn: Derive<C, T> | null = null; /* … */ }
const computed = <C, T>(rt: Rt, ctx: C, fn: Derive<C, T>): Computed<C, T> => { const c = new Computed<C, T>(rt, ctx); c.fn = fn; return c }
```

- Each use is instantiated like a generic class field's type, so `Derive<Todo, string>` is the reference type `(ctx: Todo) => string`.
- A parameter typed through it is a reference parameter, which may be stored. That is the existing non-generic-alias rule, now generic. A parameter typed inline stays a compile-time template, so inline arrows passed to such a parameter keep being inlined ([`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) "Captures", ~3958–3986).
- Every other generic alias (object, union, tuple bodies) keeps NL1054 (`tests/cases/reject_type_alias_generic`).

**Inference.** At `computed(rt, t, rowLabel)`, C comes from `t` and T from `rowLabel`'s return type. Where inference cannot settle a type argument, the refusal names the explicit form `computed<Todo, string>(…)`.

**The escape join for heap arguments.**
- NL2736 refuses a call when one member of the set keeps a pointer argument and another does not, because the call would then have to allocate that argument in the arena ([`src/compilation.ts:3160-3185`](../../src/compilation.ts)).
- When the argument is a field or element read, it is already on the heap, so the call decides no allocation and the refusal is skipped. A signals node passing its stored context is exactly this case.
- A fresh `new`, or a local escape analysis would keep on the stack, is still joined and still refused.
- A `tests/run.js` check proves the skip does not change the argument's allocation: same IR as the direct call.

**Construct checklist.** Per [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) "How to add a construct":
- golden `.ll`, `llvm-as`, native round trip
- negatives: a non-function generic alias; uninferrable type arguments
- a `tests/link` `expected.err` per new code (the next free code from `node scripts/gen-diagnostic-codes.mjs`)
- `docs/LANGUAGE.md` "Function references" rule, `docs/IR_COOKBOOK.md` entry, and the [`docs/guide/language/function-references.md`](../../docs/guide/language/function-references.md) section

A program NL1054 or NL2736 used to refuse that now compiles gets its `file: "exit"` `DECLARED` entries in `tests/nish-cmp.js`.

## WP93 S2 — dispatch for sets wider than eight, measured

A signals runtime's effect field gathers every effect in the program into one set. That is the 16-plus member case WP51 measured only for the switch.

**Bench.** `bench/wp93-dispatch/run.mjs` reuses the programs from WP51 §12.1 and adds:

- K = 16, 32, 64;
- a signals-propagation stream: the tags in dependency order over a random graph, neither periodic nor uniform;
- the indirect lowering at every K (WP51 §12.3's hand edit, generated);
- WP28 §7.4's opaque-callee programs.

Method: best of seven, interleaved, band stated, commit named. Each side calls the shipped dispatcher, not a loop the bench wrote. A loop the bench did write says so.

**Lowering.**
- If the data shows a crossover K above which a table of function pointers beats the switch on every stream, sets past it lower to `{ fn ptr }[K]` indexed by tag: a constant global on native, `call_indirect` through the module table on wasm32.
- If no K crosses on every stream, the switch stays and the data is recorded.
- The members' joined escape facts are unchanged either way. Only the branch changes.

**Forged tags.**
- Native masks or bounds-checks the index, so any i32 lands on a member.
- wasm's `call_indirect` checks the signature, and the index is bounds-checked into the set's own table segment.
- Under the debug profile an out-of-range tag still traps (`emitTagCheck`).
- A `tests/run.js` check feeds a forged tag and fails if the mask is removed.

## WP93 S3 — function-typed class fields on wasm32

Today, under `layoutsShared`, every class's function-typed field is refused with NL2733. That covers a sidecar, a `declare function` and any wasm build ([`docs/wp51-function-references.md:890-915`](../../docs/wp51-function-references.md), `refuseHostReferences` in [`src/fnrefs.ts:305`](../../src/fnrefs.ts)). So `Computed` does not build for wasm32 at all.

**Narrowing.**
- Refuse only classes reachable from an export's, import's or sidecar's signature, the ones whose layout the generated loader describes (`layoutLoader` in `src/interop-wasm.ts`).
- A class the page never sees compiles.
- A host that writes a tag into linear memory reaches a real member of the set. The tag is an index, never an address, the same argument S2's forged-tag check pins.

**Security record.** Add a row to [`docs/security/wasm-host.md`](../../docs/security/wasm-host.md) and update its count in [`docs/security/README.md`](../../docs/security/README.md). It states:
- that a host-written tag reaches only a member of the set, citing S2's check;
- that a class the host reads stays refused, citing the S3 negative `tests/link` case.

## WP93 S4 — capturing arrows stored as inline-environment closures

Lifts NL2731 for an arrow in value position that reads only `const` locals and parameters of its enclosing function. The capture rules are unchanged: NL2585, NL2586 and NL2590 still refuse a `let`, a write to a captured name, and `this`.

**Layout.**
- A place (field, element type, local, return, Map value) holding closures stores `{ i32 tag, slot0 … slotN }`.
- N is the largest capture count among the arrows stored into that place, and each slot is 8 bytes.
- Capped at four slots, so 36 bytes with the tag: a new refusal over the cap tells the author to bundle the captures into one object.
- A capture-free member leaves its slots unread.
- Tag 0 with zeroed slots is `null`.
- On a `layoutsShared` build this follows S3: a closure place in a class the host reads is refused, since the loader describes the layout (`src/inline-arrays.ts:815` inlines nothing there either).

**Dispatch.**
- Each dispatcher arm loads the slots it needs and passes them as the extra arguments WP29's capture lowering already uses (`liftArrow`, `src/generics.ts`).
- The call to the member is direct, so the member's own escape facts apply to its captures. Only declared parameters are joined across the set.

**Origins.** Storing a closure is storing each captured value. The three checkers read it that way:

| Checker | Rule applied to each captured value |
| --- | --- |
| `src/escape.ts` | a captured pointer escapes where the closure does |
| arena block rules (`decideArenaBlock`, NL2418–NL2427) | a closure capturing a young pointer is young |
| `src/region-rules.ts` | a closure's origin is the join of its captures' origins, so NL2609/NL2610 fire as they would for the pointer |

Each gets a negative that the pointer alone already provokes, rewritten through a closure.

**Refusals,** each with a new code and a `tests/link` `expected.err`:
- `===` and `!==` on closures, which JavaScript and native would answer differently;
- a closure as a Map key;
- a closure printed or turned into a string;
- a closure stored where NL2733 already stops a reference: spawn, channels, the C ABI, host imports.

**emit-ts.** The TypeScript output is the arrow itself. The emitter reads its type only through `walk.typeAt` and treats an unbound table as unknown (CLAUDE.md, emit-ts rule).

**Construct checklist.**
- golden `.ll` showing the slot layout and an unpacking arm; `llvm-as`
- native and wasm32 round trips; negatives with `tests/link` `expected.err` per new code
- `docs/LANGUAGE.md` "Closures" rule, cookbook entry, a [`docs/guide/language/functions.md`](../../docs/guide/language/functions.md) section
- NL2731's rewritten message, and `docs/ARCHITECTURE.md:136`'s paragraph
- `tests/nish-cmp.js` `DECLARED` entries for each refused corpus program this flips

## WP93 S5 — a signals-shaped acceptance program and its cost

**Programs.** Two `tests/cases` programs build the same graph, a counter, a doubled computed, a filtered list and an effect that prints, and print the same stdout on native and wasm32:
- `closure_signals`, in the context form;
- `closure_signals_inline`, in the closure form.

**Measurement.** `node bench/wp93-dispatch/run.mjs --signals` times propagation through 1,000 derivations in three variants:
- the context form;
- the closure form;
- a hand-written `switch` over the same functions, the floor.

Each is set against WP28 §7.4's opaque call, re-run at the same commit. Peak RSS is recorded for each, and the closure form must allocate nothing per closure: RSS within the band of the hand-written variant. The table goes in `docs/BENCHMARKS.md` and `docs/wp93-closures.md`.

## WP93 S6 — narrow WP28 C2b to what strict now covers

[`docs/wp28-compatibility-mode.md`](../../docs/wp28-compatibility-mode.md) C2b (`:157`, `:550`, §7.4) and the `c2b-function-values` stage ([amritk/nish#1912](https://github.com/amritk/nish/issues/1912)) describe function values in general. They now cover only what strict still refuses:
- `let` captures;
- closures that outlive their holder;
- generic and async closures.

The stage's issue gets a comment linking this plan. Then grep `docs/wp*.md`, `docs/MASTER_PLAN.md`, `docs/LANGUAGE.md`, `docs/guide/` and `tests/**` comments for "no closure", "carries no environment" and NL2731's old wording, and update each sentence this plan made false.

## Out of scope

- The std/signals port, its API, dirty marking and the std/gfx wait-for-events loop (the state plan).
- A closure that outlives the slot holding it, a closure in module storage, and module constants that hold objects.
- Capturing `let`, writing a captured name, capturing `this`.
- Generic or async closures, closures as Map keys, closures across threads, the C ABI or host imports.
- An environment allocated in an arena or a nish:region.
- JSX.

## Tests

- **Mirror:** `tests/cases/fnref_field`, `tests/cases/fnref_array`, `tests/cases/fnref_arg` (positives); `tests/cases/reject_type_alias_generic`, `tests/wordings/nl2336_*`, `tests/wordings/nl2334_*` (wordings).
- **Every new positive case** is registered with `node tests/differential/goldens.js --update`, and `tests/self/goldens/checked/` is regenerated with `node tests/self/goldens.js --update`.
- **Each new code** gets a `tests/link` negative with `expected.err`.
- **S4's origin negatives** each pair with the existing pointer-only negative they mirror (the `reject_using_arena_*` and region cases).

## Verification

Each stage's `verification` line, plus, before every push:
- `npm run lint:dead`
- `node docs/check-links.mjs`
- `node scripts/gen-reference.mjs --check`
- `NISH=build/nish bash docs/cookbook/regen.sh --check`
- nish-cmp, rerun with `--no-sidecars` for a wasm32 change

CI's nine `test` shards are the full-suite gate. A stage's bench figures are checked against `bench/wp93-dispatch/run.mjs`'s printed output, and the PR body states how many were checked.
