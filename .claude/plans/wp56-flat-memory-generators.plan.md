---
name: WP56 — generators whose memory stays flat
overview: A program that reads a large spec and writes thousands of files keeps every string it built until main returns. Measure it, document the shapes that already stay flat, then add builder() from nish:string, whose storage lives outside the arena so appends keep a loop's scope, a write handle to flush it, and diagnostics that point at it (docs/wp56-flat-memory-generators.md).
stages:
  - id: s0-baseline
    title: S0 — the baseline
    goal: Peak memory of a generator written naively and written the best way today is measured at 1,000 to 8,000 files.
    verification: docs/BENCHMARKS.md has naive.ts and today.ts at four sizes with a noise band, from bench/wp56-generator/run.sh.
    todos:
      - id: spec-maker
        content: Add bench/wp56-generator/make-spec.mjs, a deterministic OpenAPI-shaped JSON of a given size and schema count — see S0 the baseline
        status: pending
      - id: generators-today
        content: Write bench/wp56-generator/naive.ts and today.ts, one .ts file per schema plus an index — see S0 the baseline
        status: pending
      - id: bench-runner
        content: Add bench/wp56-generator/run.sh reporting peak RSS, bytes and wall time per size, interleaved and repeated — see S0 the baseline
        status: pending
      - id: baseline-table
        content: Record the table in docs/BENCHMARKS.md and the reading of it in the design note §8 — see S0 the baseline
        status: pending
  - id: s1-patterns
    title: S1 — the patterns with today's tools
    goal: A user can find and copy the three shapes that keep a generator flat today, each backed by a running program.
    verification: node tests/run.js region and node tests/run.js cookbook pass, and the guide page's nish:ok examples run.
    todos:
      - id: region-io-tests
        content: Pin readFileSync and writeFileSync inside enter and enterWith with tests/cases and a tests/link region_per_target — see S1 the patterns
        status: pending
      - id: guide-page
        content: Write docs/guide/using-nish/generating-files.md with the function-per-file, arena-block and region-per-target shapes, and its scalar.config.json route — see S1 the patterns
        status: pending
      - id: cookbook-today
        content: Add docs/cookbook/mem-file-per-function.ts and mem-region-per-target.ts, and link memory.md and regions.md to the new page — see S1 the patterns
        status: pending
  - id: s2-builder
    title: S2 — builder() from nish:string
    goal: A built-in Builder, made by builder() from nish:string, whose bytes live outside the arena and are freed by the scope that made it, and whose appends keep every enclosing scope.
    verification: mem_builder_pass_scope holds Arena.mark() over 1,000,000 appends; builder.ts meets G1 and G2; nish-cmp shows no difference; wasi, performance, c-symbols and self sections pass.
    todos:
      - id: builder-runtime
        content: Add the builder and its out-of-arena block stack with nish_builders_depth and nish_builders_release, swapped by regions and freed by region free, free_arena and reset_arena, with RT rows and runtime-test.c limits — see S2 builder
        status: pending
      - id: builder-layout
        content: Mirror the header layout in src/runtime.ts and runtime/nish.h under the layout test — see S2 builder
        status: pending
      - id: builder-module
        content: Register nish:string in src/nish-modules.ts and declare builder and Builder in runtime/nish.d.ts with doc comments, then regenerate docs/reference — see S2 builder
        status: pending
      - id: builder-facts
        content: Give the methods their escape facts, add the makes-builders fixpoint fact and the new Builder, thread, parallel-body, interop and wasm32 refusals with new codes in src/codes.ts — see S2 builder
        status: pending
      - id: builder-emit
        content: Bracket every scope that makes builders with depth and release before its rewind or keep, lower the methods, and lower them in emit-ts as a string[] class held to byte equality by differential tests — see S2 builder
        status: pending
      - id: builder-tests
        content: Add golden .ll, llvm-as, native round trip, mem_builder_pass_scope and one negative test per refusal — see S2 builder
        status: pending
      - id: builder-docs
        content: Write the LANGUAGE.md section, docs/cookbook/mem-builder.ts, switch the guide page to the builder, add builder.ts to the bench — see S2 builder
        status: pending
  - id: s3-files
    title: S3 — files from a builder
    goal: A builder is written to a file without a whole-file string, and a large file is flushed in pieces through a write handle.
    verification: flush.ts peaks at spec and model plus 1 MB on a 10 MB file; tests/link covers a short write and EINTR.
    todos:
      - id: fs-overloads
        content: Add the Builder overloads of writeFileSync and appendFileSync with fs.write capability rows — see S3 files from a builder
        status: pending
      - id: write-handle
        content: Add fileCreate, fileWrite and fileWriteBytes beside WP44's fileOpen and fileClose, with LANGUAGE.md and reference — see S3 files from a builder
        status: pending
      - id: flush-docs
        content: Add the flush section and docs/cookbook/mem-builder-flush.ts, and flush.ts to the bench — see S3 files from a builder
        status: pending
  - id: s4-gate
    title: S4 — diagnostics and the gate
    goal: The warnings send users to the builder, and CI holds the flat-memory claim.
    verification: tests/link/gen_flat_memory passes for the builder and records today's shape failing; G1 to G3 hold; the roadmap page is ticked.
    todos:
      - id: hint-wordings
        content: Name the builder in the NL9002, NL9016 and NL9018 hints and the string += refusal, regenerating tests/wordings and goldens — see S4 diagnostics and the gate
        status: pending
      - id: ai-rule
        content: Add the build-output-with-builder() rule to docs/AI.md — see S4 diagnostics and the gate
        status: pending
      - id: flat-soak
        content: Add tests/link/gen_flat_memory holding Arena.mark() and anonymous RSS flat over 2,000 files — see S4 diagnostics and the gate
        status: pending
  - id: s5-arena-graph
    title: S5 — object graphs in an arena block
    goal: A class whose constructor and methods store into its own fields can be made and used inside a using arena() block, and is released with it.
    verification: mem_using_arena_graph holds Arena.mark() over 2,000 iterations; every reject_using_arena_* case still refuses; nish-cmp shows no difference; wasi and performance sections pass.
    todos:
      - id: graph-summary
        content: Split the stores-an-allocation callee summary into stores into caller memory and stores into memory only the call allocated — see S5 object graphs
        status: pending
      - id: graph-confine
        content: Track the block's graph of fresh objects and check NL2418 to NL2423 and NL2427 against every member; keep NL2424 where a store cannot be placed — see S5 object graphs
        status: pending
      - id: graph-tests
        content: Add mem_using_arena_graph and one negative test per route a graph member can leave by — see S5 object graphs
        status: pending
      - id: graph-docs
        content: Rewrite the NL2424 row in LANGUAGE.md, show a graph in memory.md and the guide page's shape 2, regenerate docs/reference — see S5 object graphs
        status: pending
---

# WP56 — generators whose memory stays flat

The design, its reasons and the owner's decisions are in [docs/wp56-flat-memory-generators.md](../../docs/wp56-flat-memory-generators.md). This file tracks the stages. Where the two disagree, the design note is the authority. Each stage is one pull request, and that pull request ticks its box on [docs/roadmap/wp56-flat-memory-generators.md](../../docs/roadmap/wp56-flat-memory-generators.md).

## Context

The arena rewinds a pass only when nothing the pass made outlives it. `s = s + t` keeps every intermediate. Pushing onto an outer `string[]` refuses the pass its scope, so every temporary of the pass is kept as well. There is no builder in `std/` and no write handle in `nish:fs`. Design note §1 and §2 give the details.

## S0 the baseline

- Make the spec with `make-spec.mjs --bytes 25000000 --schemas 8000`, which produces OpenAPI-shaped JSON with nested object schemas, enums and refs. Seed it so the output is byte-stable.
- `naive.ts` uses `out = out + ...` with templates. `today.ts` uses design note §2's shape 1: a function for each file that answers `i32`, with a local `parts` and a `join`.
- Measure without generation as well, so the gates can subtract the spec and model.
- Do not change the compiler in this stage. If `today.ts` already meets G1, write that down in §8 and keep the order of the stages.

## S1 the patterns

- The region I/O tests pin behaviour that should already work but has no test: a string built inside `enterWith` and written with `writeFileSync` before `free`, and a `readFileSync` inside `enter` whose memory goes with the region.
- The guide page follows [docs/README.md](../../docs/README.md#writing-a-guide-page). Its examples are `nish:ok` blocks with expected output. The page shows `--explain-memory` output for shape 1.

## S2 builder

- The API is design note §4. The runtime is §5, and the checker is §6.
- The owner's decisions are in design note §10: `builder()` from `nish:string`, storage freed by the scope that made it through an out-of-arena block stack (§5), thread-confined, `appendInt` and `appendF64` included, wasm32 refused with a code in S2, `s += t` still refused.
- `src/` may not use the builtin until it is released (the rolling freeze), so `src/strings.ts` stays.
- Run `nish-cmp`. It must show no difference: only a scope that makes builders gets the new bracket, and no corpus program makes one. A difference is a bug in the fact, not a `DECLARED` entry.
- Security: either a new row in `docs/security/runtime.md` for `runtime-builder.c`, or the `runtime-text.c` row widened and `RUNTIME_TEXT_UNIT_BUDGET` raised. Add a limit test on both sides, as RT-2 has.

## S3 files from a builder

- Writes loop until the whole block is written, retrying on `EINTR`, and report a negative errno on failure. This is the same contract shape as WP44's reads.
- `fileCreate` truncates, and its `mode` matches `writeFileSyncMode`. The `fs.write` capability covers it, and it is refused in a `scope()` task and in a parallel body, as the read side is.

## S4 diagnostics and the gate

- The hint wording is changed in one place, `src/codes.ts`, and in the compilation messages. Then regenerate `tests/wordings`.
- `gen_flat_memory` follows `tests/link/region_sessions_soak`: it reads `Arena.mark()` and anonymous RSS after warm-up and fails on growth past 512 KiB.

## S5 object graphs

- Design note D7 and §6. A user asked for it: per-file arenas would replace their hand-written `reset` methods, which hold about 28 MB per worker.
- Reproduction with nish 0.34.1: a `Formatter` whose constructor does `this.parts = []`, made inside `using a = arena()`, is refused with NL2424. The same class in a parallel body is accepted. A method writing `this.root.kids.push(n)` is refused in a parallel body.
- Only programs refused today change, so nish-cmp must show no difference. A difference means the split summary changed a fact some other consumer reads. That is a bug, not a `DECLARED` entry.
- This changes `src/`, so run the `wasi` and `performance` sections and regenerate the checked goldens.

## Out of scope

- Lowering a template appended to a builder without intermediate strings.
- Moving `src/` onto the builtin.
- `push` reusing the blocks it outgrows.
- A rope `string`, and a collector.
- S5's analysis for parallel bodies and `scope()` tasks (deferred, design note §9).

## Verification

```bash
npm run check
npm run lint
node tests/run.js region
node tests/run.js using_arena
node tests/run.js mem_builder
node tests/run.js cookbook
node tests/run.js c-symbols
WASI_SYSROOT=/usr node tests/run.js wasi
node tests/run.js performance
node scripts/gen-reference.mjs --check
node scripts/security-scope.mjs
bash bench/wp56-generator/run.sh
```
