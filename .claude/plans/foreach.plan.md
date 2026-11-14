---
name: forEach on arrays, Map and Set
overview: Accept `xs.forEach(f)` on `T[]`/`readonly T[]`, `m.forEach((v, k) => …)` on `Map<K, V>` and `s.forEach((v) => …)` on `Set<T>`, built on the existing statically-known-callee template machinery that `map`/`filter` use, lowering to the same loop `for...of` emits, with no allocation and no performance or memory regression.
stages:
  - id: foreach
    title: "feat(checker): forEach on arrays, Map and Set"
    goal: forEach on the three receivers compiles to the for-of loop with the callee inlined, keeps NL2586, answers void, and is documented everywhere a refusal of it is documented today.
    verification: "npm run check && npm run lint && npm run lint:dead && node scripts/gen-reference.mjs --check && node scripts/gen-diagnostic-codes.mjs --check && node tests/run.js foreach && node tests/run.js arr_ && node tests/run.js map_ && node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js"
    todos:
      - id: arr-template
        content: Add forEach / forEachIndexed templates to std/array.ts and route `forEach` through `checkCallbackMethod` in src/arrays.ts (ARRAY_METHODS list, template table in src/std-modules.ts) — see Arrays
      - id: arr-semantics
        content: Settle receiver mutation inside an array forEach callback (push/pop/set on the captured receiver) so output equals Node's, or refuse it with a diagnostic — see Mutating the receiver
      - id: map-set-lowering
        content: Lower `m.forEach((v, k) => …)` and `s.forEach((v) => …)` onto the existing table walk (src/emit-map.ts `emitWalk`), one probe per entry, replacing the forEach branch of `refuseCollectionMember` in src/members.ts — see Map and Set
      - id: void-and-arity
        content: Refuse using forEach's answer and refuse a third callback parameter (or support it if trivial), each with a negative test — see Answer and arity
      - id: capture-message
        content: Make the NL2586 message, when raised inside a forEach callback, point to a `for...of` loop for accumulation; keep `xs.forEach(x => sum += x)` refused — see Capture rule
      - id: emit-ts
        content: Teach the --emit-ts back-rewrite (src/emit-ts-records.ts) the new templates so --emit-ts prints `xs.forEach(f)` — see --emit-ts
      - id: tests
        content: Add positive tests/cases (.ts/.ll/.out) and reject_* negatives, register them with node tests/differential/goldens.js --update, regenerate tests/self/goldens/checked/ — see Tests
      - id: ir-evidence
        content: Put the forEach IR beside the equivalent for-of IR in the PR body for array, Map and Set — see IR evidence
      - id: docs
        content: Update docs/LANGUAGE.md, docs/AI.md, runtime/nish.d.ts comments, docs/guide/language/arrays-and-strings.md, maps-and-sets.md, getting-started/from-typescript.md, then regenerate docs/reference — see Docs
      - id: perf
        content: Show no time or memory regression with tests/run.js performance and nish-cmp, adding narrow DECLARED entries only if corpus IR moves — see Performance and memory
---

# forEach on arrays, Map and Set

## Context

`forEach` is refused today: on arrays as NL2249 `Unknown method` (`src/arrays.ts:722`, list at `src/arrays.ts:51`), on `Map`/`Set` by `refuseCollectionMember` (`src/members.ts:1208`, test `tests/cases/reject_map_foreach`). The reason the docs give, that a method cannot take a function, stopped being true when `map`/`filter`/`some`/`every`/`findIndex` landed. Those rewrite `xs.m(f)` in place into a call of a generic template from `std/array.ts` (`checkAsTemplateCall`, `src/arrays.ts:500`), so each callback gets its own instance that calls it directly. That path is the one to use, not a new callback mechanism.

The point of the change is that today nothing visits a `Map`'s key and value together.

Base: `main` at `d38a94b00543bd87481a6fa811ecc5802ba36d92`.

## Arrays

**Owns:** `src/**`, `std/**`, `runtime/nish.d.ts`, `tests/cases/**`, `tests/self/goldens/**`, `tests/differential/**`, `tests/nish-cmp.js`, `tests/diagnostic-coverage.js`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/guide/**`, `docs/reference/**`, `scalar.config.json`, `scripts/undocumented.txt`, `llms.txt`

- `forEach((x) => …)` and `forEach((x, i) => …)` on `T[]` and `readonly T[]`, through `checkCallbackMethod` with an Indexed twin, like `map`/`mapIndexed`.
- The lowering must come out as the loop `for (const x of xs)` emits (`src/emit-arrays.ts:1957`, `emitForOf`), with the callee inlined and no allocation: no result array, no closure object.
- If a template instance shows up as a separate call in the golden `.ll`, show that it inlines (the IR under the optimisation level the tests and benchmarks use), or emit the loop at the call site. Either way the IR evidence has to show the same loop.
- `src/` may not call `.forEach` (rolling freeze; CI's `bootstrap` job checks it).

## Mutating the receiver

`for...of` over an array re-reads the length on every iteration, so a `push` in the body is visited. JS `forEach` fixes the length when it starts and skips indices that are past the current length. These differ, and the differential tests compare against Node. Whatever the lowering, a program that mutates the receiver from inside the callback either prints what Node prints or is refused with a clear diagnostic. A test pins each case the language accepts: push, pop and an index store on an array, and set, delete and clear on a `Map` or `Set`. `Map`/`Set` `forEach` in JS matches `for...of` over the table (entries added during the walk are visited, deleted ones are not), so the existing walk semantics (`docs/LANGUAGE.md` ~13049, `tests/cases/map_iter_*`) should carry over. Check whether the capture rule even lets a callback reach the receiver (NL2586 allows writing through an object the function holds) before you design for it.

## Map and Set

- `m.forEach((v, k) => …)` on `Map<K, V>` (value first, then key, as in JS) and `s.forEach((v) => …)` on `Set<T>`, in insertion order, on the same table walk as `for (const k of m.keys())` (`src/emit-map.ts:948`, `emitWalk`, `walkOpen`/`walkNext`/`walkClose`).
- One probe per entry: read the value from the slot the walk is already on, never `m.get(k)` per key (see `tests/cases/map_fused_walk`).
- An early `return` from the enclosing function is not possible from inside a callback, but every way out of the walk still has to close it (live-walk counter).
- Replace the `forEach` branch of `refuseCollectionMember`. `entries` stays refused. Update `reject_map_foreach` (delete it or turn it into a different refusal) and add the Map/Set entry to the "Unknown member … a `Map` has …" list.
- A one-parameter Map callback `(v) => …` is legal JS; accept it.

## Answer and arity

- The answer is `void`. Using it (`const r = xs.forEach(f)`, `return xs.forEach(f)` in a non-void function, as an argument) is an error with a negative test. Reuse the existing void-value diagnostic if one fits.
- A third callback parameter (`array` / `map` / `set`) is refused with a negative test, unless supporting it is trivial (it is the receiver itself).

## Capture rule

NL2586 stays as it is: an arrow reads captured locals and never assigns them, so `xs.forEach(x => sum += x)` is still refused. When the arrow is a forEach callback, the message must name a `for...of` loop as the way to accumulate. Add a negative test with that exact `.err`.

## --emit-ts

`src/emit-ts-records.ts:295` rewrites the templates back to method calls. Add forEach. Follow CLAUDE.md's rule on untyped walks: read types only through `walk.typeAt`, and treat a null binding table as unknown.

## Tests

- Positive (`.ts` + `.ll` + `.out`): array forEach with one and with two parameters; `readonly` receiver; Map with `(v, k)` and with `(v)`; Set; insertion order after delete and re-add; nested forEach; a callback that calls a function; each accepted receiver mutation.
- Negative (`reject_*.ts` + `.err`): using the answer; a third parameter; `sum += x` (NL2586, with the for-of hint); non-arrow or non-statically-known callee if that is refused for `map`; `forEach` on a type without it.
- Register new positives with `node tests/differential/goldens.js --update` in the same commit. Regenerate `tests/self/goldens/checked/` with `node tests/self/goldens.js --update`. Never hand-edit either.
- If a new diagnostic code is needed, take the next free number in its band in `src/codes.ts`; `tests/diagnostic-coverage.js` and `gen-diagnostic-codes.mjs --check` must pass.

## IR evidence

The PR body shows, for an array, a `Map` and a `Set`, the forEach program's IR next to the IR of the equivalent `for...of` program. They should be the same loop. CLAUDE.md also asks for the exact LLVM IR of every TypeScript snippet the PR adds to the tests.

## Docs

- `docs/LANGUAGE.md`: the receiver table (~11935) gains forEach; the Map/Set members bullet (~12755) drops "no `forEach`"; the iteration section (~13049) covers `forEach`'s order and mutation semantics.
- `docs/AI.md`: the table rows at ~180 (`.forEach` refused) and ~221 (`m.forEach`), the ~2734 "refused by name" line, and the ~3077 "no `reduce` or `forEach`" line.
- `runtime/nish.d.ts` comments at ~36 and ~6060 that say there is no `forEach`; add declarations if the language's declarations of Array/Map/Set methods live there (each with a doc comment, `@param` and `@returns`).
- Guide: `docs/guide/language/arrays-and-strings.md`, `docs/guide/language/maps-and-sets.md`, `docs/guide/getting-started/from-typescript.md:344`.
- The cookbook entry if `docs/ARCHITECTURE.md` → "How to add a construct" counts this as one (a new method on an existing receiver probably is).
- Then `node scripts/gen-reference.mjs` and `bash docs/cookbook/regen.sh --check`.

## Performance and memory

The requirement: no performance regression, and memory may only improve.
- `node tests/run.js performance` passes (it is also required for any `src/` change).
- `node tests/nish-cmp.js` shows no corpus program's IR moved. If adding templates to `std/array.ts` moves a module's IR, add narrow `DECLARED` entries (program and file, the release-note words) and say why in the PR body.
- The forEach loop allocates nothing and probes a table once per entry, which the IR evidence shows.
- If a `Measured:` trailer is used, follow `.claude/testing.md` → "A `Measured:` trailer".
