---
name: WP56 — generators whose memory stays flat, a string builder and a scope per file
overview: All six stages are open. The design is accepted and every question decided, so the work is the baseline, the patterns, the builder, files from a builder, the diagnostics and CI gate, and object graphs in an arena block.
roadmap: docs/roadmap/wp56-flat-memory-generators.md
spec: docs/wp56-flat-memory-generators.md
priority: 60
issue: 1926
stages:
  - id: s0-baseline
    title: WP56 S0 — the baseline, a 25 MB spec, a generator written two ways, peak memory at 1,000 to 8,000 files
    goal: bench/wp56-generator/ exists and docs/BENCHMARKS.md has both generators at four sizes with a noise band.
    verification: bash bench/wp56-generator/run.sh && npm run lint
    status: pending
    issue: 1940
    todos:
      - id: s0-bench
        content: Add bench/wp56-generator/ with the spec maker, naive.ts, today.ts and run.sh — see WP56 S0
        status: pending
      - id: s0-table
        content: Record the table in docs/BENCHMARKS.md with the commit and noise band — see WP56 S0
        status: pending
  - id: s1-patterns
    title: WP56 S1 — the patterns with today's tools, a guide page and file I/O inside a region
    goal: A guide page shows shapes 1 to 3 over parts and join, the cookbook has two entries, and file I/O inside a region is tested.
    verification: node tests/run.js region && node tests/run.js cookbook && npm run lint
    status: pending
    issue: 1941
    todos:
      - id: s1-tests
        content: Add tests/cases and tests/link for file reads and writes inside enter and region_per_target — see WP56 S1
        status: pending
      - id: s1-guide
        content: Write the guide page with shapes 1 to 3 and link it from memory.md and regions.md in docs/guide/ — see WP56 S1
        status: pending
      - id: s1-cookbook
        content: Add mem-file-per-function.ts and mem-region-per-target.ts to the cookbook — see WP56 S1
        status: pending
  - id: s2-builder
    title: WP56 S2 — builder() from nish:string
    goal: A builder keeps its bytes outside the arena and its appends keep a loop's scope, with the checker facts, the nish:string module, the emit-ts lowering and the wasm32 refusal in place.
    verification: node tests/run.js mem_builder && node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && npm run lint
    status: pending
    issue: 1944
    todos:
      - id: s2-runtime
        content: Add the builder runtime in runtime/ with its security record rows — see WP56 S2
        status: pending
      - id: s2-checker
        content: Add the makes-builders fact, the builder-stack brackets and the refusals in src/ — see WP56 S2
        status: pending
      - id: s2-module
        content: Add the nish:string module and runtime/nish.d.ts declarations with doc comments, and the emit-ts lowering — see WP56 S2
        status: pending
      - id: s2-tests
        content: Add golden .ll, llvm-as, a native round trip, negative tests and mem_builder_pass_scope — see WP56 S2
        status: pending
      - id: s2-docs
        content: Add the LANGUAGE.md section, cookbook entry, guide page switch to the builder and regenerate docs/reference/ — see WP56 S2
        status: pending
  - id: s3-files-from-builder
    title: WP56 S3 — files from a builder, writeFileSync of a builder and a write handle that flushes
    goal: writeFileSync and appendFileSync take a builder, and fileCreate, fileWrite and fileWriteBytes flush within G2's bound.
    verification: node tests/run.js link && node tests/run.js capabilities && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    issue: 1945
    todos:
      - id: s3-api
        content: Add the writeFileSync and appendFileSync overloads and fileCreate, fileWrite, fileWriteBytes in std/ with capability rows — see WP56 S3
        status: pending
      - id: s3-tests
        content: Add tests/link for a short write and EINTR as WP44's tests do on the read side — see WP56 S3
        status: pending
      - id: s3-guide
        content: Add the guide's flush section and bench flush.ts — see WP56 S3
        status: pending
  - id: s4-diagnostics-gate
    title: WP56 S4 — the diagnostics name the builder, and the flat-memory gate runs in CI
    goal: NL9002, NL9016 and NL9018 hints name the builder, gen_flat_memory (G3) runs in CI, and G1 to G3 are green.
    verification: node tests/run.js wordings && node tests/run.js gen_flat_memory && npm run lint
    status: pending
    issue: 1947
    todos:
      - id: s4-hints
        content: Add builder hints to NL9002, NL9016 and NL9018 in src/ with wordings and goldens — see WP56 S4
        status: pending
      - id: s4-gate
        content: Add gen_flat_memory (G3) to the tests and CI, and update docs/AI.md — see WP56 S4
        status: pending
  - id: s5-arena-graphs
    title: WP56 S5 — an object graph made inside a using arena block belongs to the block
    goal: Constructors and methods that store into a graph made inside a using arena() block are admitted, with Arena.mark() unmoved over 2,000 iterations.
    verification: node tests/run.js mem_using_arena_graph && node tests/run.js reject_using_arena && node tests/nish-cmp.js && node tests/run.js wasi && node tests/run.js performance && npm run lint
    status: pending
    issue: 1950
    todos:
      - id: s5-analysis
        content: Add the confined-graph analysis and the split callee summary in src/escape.ts — see WP56 S5
        status: pending
      - id: s5-tests
        content: Add mem_using_arena_graph and one negative per route a graph member can leave by — see WP56 S5
        status: pending
      - id: s5-docs
        content: Rewrite the NL2424 row of LANGUAGE.md's using arena() table, memory.md and the guide page's shape 2, and regenerate docs/reference/ — see WP56 S5
        status: pending
---

# WP56 — generators whose memory stays flat, a string builder and a scope per file

## Context
Nothing has landed; the design is accepted and every open question decided on 2026-11-13 ([§10](../../docs/wp56-flat-memory-generators.md#10-decisions)). See the [roadmap page](../../docs/roadmap/wp56-flat-memory-generators.md). Each stage is one PR; S5 depends on nothing after S0 and can land before or after S2 to S4. The table of stages is [§9](../../docs/wp56-flat-memory-generators.md#9-stages).

## WP56 S0 — the baseline, a 25 MB spec, a generator written two ways, peak memory at 1,000 to 8,000 files
Spec: [§8 The proof](../../docs/wp56-flat-memory-generators.md#8-the-proof). Add `bench/wp56-generator/` and record the table in `docs/BENCHMARKS.md`, naming the commit and only the fields that version prints.
Likely files: `bench/wp56-generator/`, `docs/BENCHMARKS.md`.

## WP56 S1 — the patterns with today's tools, a guide page and file I/O inside a region
Spec: [§7](../../docs/wp56-flat-memory-generators.md#7-the-patterns-the-guide-page). Tests for file I/O inside `enter` and `region_per_target`, the guide page over `parts` and `join`, two cookbook entries. The page's examples run under `nish:ok`.
Likely files: `tests/cases/`, `tests/link/`, `docs/guide/`, `docs/cookbook/`.

## WP56 S2 — builder() from nish:string
Spec: [§4](../../docs/wp56-flat-memory-generators.md#4-the-api), [§5](../../docs/wp56-flat-memory-generators.md#5-the-runtime), [§6](../../docs/wp56-flat-memory-generators.md#6-the-checker). The largest stage; if it grows past one PR, split runtime and checker from the docs. A new construct, so the construct checklist applies and the builder's runtime ships with its `docs/security/` rows. nish-cmp must report no difference, because no existing program makes a builder.
Likely files: `runtime/`, `src/escape.ts`, `std/`, `runtime/nish.d.ts`, `docs/LANGUAGE.md`.

## WP56 S3 — files from a builder, writeFileSync of a builder and a write handle that flushes
Spec: [§4](../../docs/wp56-flat-memory-generators.md#4-the-api). Overloads, `fileCreate`, `fileWrite`, `fileWriteBytes`, capability rows, the guide's flush section and `flush.ts` in the bench.
Likely files: `std/`, `src/capabilities.ts`, `tests/link/`.

## WP56 S4 — the diagnostics name the builder, and the flat-memory gate runs in CI
Spec: [§8](../../docs/wp56-flat-memory-generators.md#8-the-proof). NL9002, NL9016 and NL9018 hints, `docs/AI.md`, and `gen_flat_memory` (G3). Ticks the roadmap page.
Likely files: `src/`, `tests/wordings/`, `docs/AI.md`.

## WP56 S5 — an object graph made inside a using arena block belongs to the block
Spec: [§6](../../docs/wp56-flat-memory-generators.md#6-the-checker), decision D7. The deferred extension to parallel bodies and `scope()` tasks stays out and gets its own note.
Likely files: `src/escape.ts`, `docs/LANGUAGE.md`, `docs/guide/`.
