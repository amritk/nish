---
name: Contiguous atomic arrays
overview: Add `AtomicI32Array` and `AtomicI64Array` to `nish/threads` — n atomic counters in one contiguous buffer, each operation one inline seq_cst instruction on an element — so shared counters, per-route request tallies and histograms stop paying for one allocation per counter. par-histogram-atomic moves onto the new type, which is the layout its Rust and Go twins already use, and closes its 1.6x–1.95x gap.
stages:
  - id: atomic-arrays
    title: "feat(threads): AtomicI32Array and AtomicI64Array, n atomics in one buffer"
    goal: A program can share one contiguous array of atomic i32 / i64 counters across a scope's tasks and parallel bodies, every element operation lowers to one inline atomic instruction on a GEP into the buffer, and par-histogram-atomic on it is within 1.10x of the fastest Rust twin
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js atomic && node tests/run.js threads && node tests/run.js emit-ts && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/gen-reference.mjs --check && node docs/check-links.mjs && node tests/nish-cmp.js && node bench/run.mjs --only par
    todos:
      - id: rule
        content: "Decide the rule and lowering first (docs/ARCHITECTURE.md → How to add a construct, step 1) — see Design. Hand-write the IR for `add(i, d)` and check it with llvm-as and opt -passes=verify; state the TypeScript reading (class A: the std source body is Node's meaning)"
      - id: std
        content: "Declare both classes in std/threads.ts beside AtomicI32/AtomicI64, with Node-meaning bodies over an i32[] / i64[] and a full doc comment, @param and @returns on every public member (gen-reference --check)"
      - id: checker
        content: "Teach the checker and src/parallel.ts that the new classes reach a task and a parallel body by exactly the routes AtomicI32 does, with the same refusals (the NL2516-family rules); a new diagnostic only if a rule has no existing code, next free number in its band, with a tests/wordings/ program"
      - id: emitter
        content: "Lower every method in src/emit-parallel.ts next to emitAtomicBody: bounds check exactly as an array index is checked (the prover may discharge it), then one load atomic / store atomic / atomicrmw / cmpxchg seq_cst on the element's GEP, natural alignment. The buffer is one allocation; place it so 16 i32 elements share one 64-byte line where the allocator already allows it (measure; do not add a runtime symbol for alignment unless the bench shows it matters)"
      - id: attributes
        content: "Record the memory effects in src/attributes.ts as AtomicI32's are recorded — no attribute without a proof"
      - id: wasm-emit-ts
        content: "Make the wasm target and --emit-ts do what they do for AtomicI32 (fixture under tests/emit-ts/ if the reading is not A)"
      - id: tests
        content: "Golden tests/cases/*.ts + .ll for each width (show the exact IR in the PR body), llvm-as pass, native round trip with .out — four scope tasks adding to shared bins, no lost add — plus a parallelMapInto body updating elements; reject_* cases for each refusal and for misuse the checker catches; an out-of-range index exits through the bounds panic (round trip). Regenerate tests/self/goldens/checked/ and register new positive cases with tests/differential/goldens.js --update; add narrow DECLARED entries to tests/nish-cmp.js if any corpus program's IR moves"
      - id: docs
        content: "docs/LANGUAGE.md Atomics rule, docs/IR_COOKBOOK.md Atomics entry (docs/cookbook/regen.sh --check), docs/guide/using-nish/threads.md: the decision table row and a section on the array types with a compiled example (a per-route request counter or a histogram) and when to choose them over AtomicI32[] (one allocation per counter, contended lines), docs/AI.md if it lists the atomics; regenerate docs/reference/ with node scripts/gen-reference.mjs"
      - id: examples
        content: "Move examples/histogram-atomic.ts and the guide's histogram example onto AtomicI32Array where it reads better; scripts/smoke.sh must still pass"
      - id: bench
        content: "bench/par-histogram-atomic.ts keeps its 16 bins in one AtomicI32Array (the layout its .rs and .go twins already use), same work, same checksum `56760 3200000`; update its header comment, bench/README.md and the kernel's description in docs/BENCHMARKS.md"
      - id: measure
        content: "Run node bench/run.mjs --only par three times on the branch, read each run against its band, and rewrite the Data parallelism tables in docs/BENCHMARKS.md (date, machine, SHA, as the section already states them); the PR body gives par-histogram-atomic before/after and Nish / fastest per run"
---

# Contiguous atomic arrays

## Why

`docs/BENCHMARKS.md` → "Data parallelism against Rust and Go": par-histogram-atomic is 1.586x–1.950x slower than the fastest Rust twin in all three runs, outside the band. par-histogram (the Mutex version) beats Rust and Go.

## Diagnosis (measured before planning)

The inner loop of `binStream`, after LTO, is already tight: `AtomicI32.add` is inlined, its unused result becomes `lock incl`, the overflow intrinsics are proven away, and one bounds compare and two dependent loads (array data → element pointer) precede the lock. Rust's is `lock incl (%rax,%rdx,4)`.

The difference is the **layout**. `AtomicI32` is `{ i32 }`, allocated one per `new`, 8 bytes in the arena, interleaved with the array's growth blocks: the 16 bins land on **4 cache lines** (1, 4, 4 and 7 objects), and the read-mostly array header can share a line with bin 0, which every thread writes. Rust's `[AtomicI32; 16]` and Go's `[16]atomic.Int32` are one 64-byte line.

Hand-edited IR, `par`, 4 cores, 9 interleaved runs, two sessions, min / median ms:

| variant | run 1 | run 2 |
|---|---|---|
| Nish as shipped | 119 / 133 | 115 / 139 |
| bins as one contiguous `[16 x i32]`, bounds check and array load kept | 59 / 66 | 58 / 66 |
| per-object layout, no bounds check | 139 / 159 | 124 / 148 |
| contiguous, no bounds check | 60 / 65 | 61 / 64 |
| Rust twin | 56 / 60 | 57 / 66 |

Contiguity alone closes the gap; the bounds check and the pointer chase cost nothing measurable. Nish today has no way to say "n atomics in one buffer": `AtomicI32`/`AtomicI64` are the only atomics, there is no `Atomics.*` builtin, and a task may not write a shared `i32[]` except under a `Mutex`.

## Design

Two classes in `nish/threads` (`std/threads.ts`), the same shape at each width (`AtomicI64Array` with `i64`):

```ts
export class AtomicI32Array {
  constructor(length: i32)              // every element 0
  readonly length: i32                  // or the std convention for a length, if it differs
  load(i: i32): i32
  store(i: i32, value: i32): void
  add(i: i32, delta: i32): i32          // the value before, wraps at 32 bits
  sub(i: i32, delta: i32): i32
  min(i: i32, value: i32): i32          // signed, as AtomicI32's
  max(i: i32, value: i32): i32
  exchange(i: i32, value: i32): i32
  compareExchange(i: i32, expected: i32, desired: i32): i32
}
```

- Method names, semantics and ordering mirror `AtomicI32` exactly (seq_cst), with the element index first — a reader who knows one knows the other.
- The elements are one contiguous allocation; the object is a header plus that buffer (or a pointer to it), never one allocation per element.
- An out-of-range index stops the program as an out-of-range array index does; the range check is an ordinary one the prover may discharge.
- It reaches a scope's tasks and a parallel body by the routes `AtomicI32` does, and is refused where `AtomicI32` is refused.
- TypeScript reading: class A — under Node the std source runs as written, over an `i32[]` / `i64[]` (Node is single-threaded, so it means the same).
- No `runtime/*.c` change is planned. If the bench shows 64-byte alignment of the buffer matters and the allocator cannot give it, that is a measured reason to add one, with `src/runtime.ts`, `runtime/nish.h` and `node tests/run.js c-symbols` in the same commit.

Out of scope: changing `AtomicI32`'s own layout, padding or sharding counters per thread, an `Atomics.*` builtin over `i32[]`.

## Stage atomic-arrays

**Owns:** `src/**`, `std/threads.ts`, `runtime/**`, `tests/**`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/guide/**`, `docs/reference/**`, `docs/AI.md`, `docs/BENCHMARKS.md`, `scalar.config.json`, `examples/histogram-atomic.ts`, `bench/par-histogram-atomic*`, `bench/README.md`

One stage on purpose: the bench and the measurement consume the type the construct introduces, so splitting them would be a chain (the second stage could not start until the first merged).

## Acceptance criteria

1. A program that imports `AtomicI32Array` (and one that imports `AtomicI64Array`) from `nish/threads`, has four scope tasks add to shared bins, and builds with `nish --link` prints the exact totals, so no add is lost. The same program run through `--emit-ts` under Node prints the same output.
2. An element `add` compiles to one `atomicrmw add ... seq_cst` on a pointer into a single buffer. The golden `.ll` shows no per-element object pointer load.
3. An out-of-range index stops the program with the array-index panic and a non-zero exit. It never touches memory outside the buffer.
4. The checker refuses an atomic array wherever it refuses an `AtomicI32`, with a diagnostic that names the construct, and a `reject_*` case pins each refusal.
5. `docs/guide/using-nish/threads.md` teaches the array types with a compiled example: a request counter or a histogram, plus when to choose them over `AtomicI32[]`. The rule is in `docs/LANGUAGE.md`, the entry is in `docs/IR_COOKBOOK.md`, and `node scripts/gen-reference.mjs --check` passes.
6. In each of 3 runs of `node bench/run.mjs --only par`, par-histogram-atomic on the new type prints `56760 3200000` and reaches Nish / fastest, by min, of at most 1.10x. The result is recorded in `docs/BENCHMARKS.md` with date, machine and SHA.
7. Existing `AtomicI32` / `AtomicI64` programs compile to the same IR as before. nish-cmp is green with no `DECLARED` entry for an atomic program that does not use the new types.
