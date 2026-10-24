---
name: The CPU's own round, and two emit-ts conventions
overview: Two PRs merged in order. A records two --emit-ts conventions from #844's review rounds in CLAUDE.md. B makes float rounding run SSE4.1 roundsd at the default x86-64 target on any machine that has it, exact everywhere else, closing #943.
stages:
  - id: claude-md-lines
    title: "docs: record two --emit-ts conventions in CLAUDE.md"
    goal: CLAUDE.md states that the emit-ts known list is Node-version-specific and that an untyped emit-ts walk knows nothing
    verification: npm run check && npm run lint && node docs/check-links.mjs
    todos:
      - id: a-known-list-line
        content: Add the known-list paragraph to CLAUDE.md beside the generated-goldens paragraph — see Stage A
      - id: a-untyped-walk-line
        content: Add the untyped-walk paragraph to CLAUDE.md as a short paragraph near the src/ table row — see Stage A
      - id: a-names-exist
        content: Re-check every name the two paragraphs cite against origin/main before committing — see Stage A
  - id: roundsd-dispatch
    title: "perf(codegen): round with the CPU's own instruction at the default x86-64 target"
    goal: With no --cpu flag, Math.round/floor/ceil/trunc and every llvm.floor/ceil/trunc/round lowering run roundsd on an SSE4.1 machine and stay exact on baseline x86-64, with aarch64 and wasm unchanged
    verification: npm run check && npm run lint && node tests/run.js math && node tests/run.js cases && node tests/run.js selfhost && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/run.js instructions && node tests/run.js emit-ts && node tests/run.js hardening
    todos:
      - id: b-reproduce
        content: Reproduce #943 — assembly at the default target and at -march=x86-64-v2, every rounding intrinsic the emitter writes, and a 20+ run interleaved noise band on main — see Reproduce
      - id: b-race
        content: Race run-time dispatch (inline asm, a target-features helper, a multiversioned loop), the linker-side libm call and anything better, each exact, on the round/floor/ceil/trunc kernels — see Candidates
      - id: b-ship-lowering
        content: Ship the fastest exact candidate in the emitter and the runtime, with the dispatch flag safe when never set — see Shipping the lowering
      - id: b-edge-case
        content: Add a math_* case pinning JavaScript's round/floor/ceil/trunc on every listed edge, run through the fast path and through a forced fallback, byte for byte against Node — see Correctness
      - id: b-goldens
        content: Regenerate the goldens with the repo's tooling and list every .ll golden that moved — see Goldens and bench
      - id: b-bench
        content: Run the math bench and the whole bench suite and put the tables in the PR — see Goldens and bench
      - id: b-docs
        content: Update IR_COOKBOOK, LANGUAGE.md and the guide page for any user-visible override — see Docs
---

# The CPU's own round, and two emit-ts conventions

## Context

The `/feature` run in [#844](https://github.com/amritk/nish/issues/844) left one open item, [#943](https://github.com/amritk/nish/issues/943). `bench/math`'s `round` is Nish 531 ms against C at 483 ms. `Math.round` lowers in [src/emit-builtins.ts](src/emit-builtins.ts) (`emitMathRound`) to `llvm.floor.f64`, a tie fix-up and `llvm.copysign.f64`. `Math.floor/ceil/trunc` go through `f64UnaryIntrinsic` to `llvm.<name>.f64`. At the baseline x86-64 target `llvm.floor` is a libm call, and [scripts/build.sh](scripts/build.sh) (`elf=(-fno-plt)`) makes it a GOT-indirect call. Under `--cpu x86-64-v3` the same IR is an inline `roundsd`, and it beats every twin. The close-out comment on #844 also proposed two CLAUDE.md lines from recurring review findings.

## Stage A — two CLAUDE.md lines

**Owns:** `CLAUDE.md`
**Model:** sonnet

The text, kept close to the owner's wording. "Flipped" is past tense because #917 already took `str_surrogate_pair` off the list, so it is now an example, not a current entry:

```
**The emit-ts known list is Node-version-specific.** Regenerate
`tests/differential/emit-ts-known.txt` only under the Node that
`.github/workflows/ci.yml` pins; another minor flipped a verdict
(`str_surrogate_pair`) and turned CI red.

**An untyped emit-ts walk knows nothing.** In `src/emit-ts-*.ts`, read
types only through `walk.typeAt`, and treat a null binding table
(`nodeCallees`, `nodeLocals`, ...) under `walk.untyped` as unknown:
call `walk.missType()`, never take the "not bound" branch.
```

- Put the first after the "Generated goldens are regenerated" paragraph in "Definition of done".
- Put the second as its own short paragraph right after the guide table, so it sits next to the `src/` row.
- Before committing, check each name exists on `origin/main`: `typeAt(`, `missType(` and `untyped:` in [src/emit-ts-edits.ts](src/emit-ts-edits.ts), `nodeCallees` and `nodeLocals` on the program, and `node-version: 22.23.4` with its emit-ts-known comment in [.github/workflows/ci.yml](.github/workflows/ci.yml). The lead checked them at `932bbb5b`.
- Commit subject `docs: record two --emit-ts conventions in CLAUDE.md`, body `Refs: #844`. Docs only, so skip the full `npm test`.

## Stage B — the CPU's own round

**Owns:** `src/emit-builtins.ts`, `src/emit*.ts`, `src/target.ts`, `src/runtime.ts`, `src/attributes.ts`, `runtime/runtime.c`, `runtime/runtime-os.c`, `runtime/runtime-simd.c`, `runtime/nish.h`, `scripts/build.sh` (racing only; ship a change there only if candidate (b) wins), `tests/cases/math_*`, `tests/run.js`, `tests/differential/known-failures.txt`, `bench/math*`, `bench/instructions.json` (only if the `instructions` section requires it), `docs/IR_COOKBOOK.md`, `docs/LANGUAGE.md`, `docs/guide/**`, `docs/security/runtime.md`, and the generated files below.

### Reproduce

- Build the bench/math round kernel at the default target and look at its assembly: the `call *floor@GOTPCREL(%rip)`. `--cpu` takes only `x86-64-v3`, so get v2 by compiling the same `.ll` with `clang -O2 -march=x86-64-v2` and confirm the inline `roundsd`.
- Grep the emitter for every `llvm.floor/ceil/trunc/round/rint/nearbyint/roundeven` it writes, including `std/` code that reaches one. Measure floor, ceil and trunc too if they hit the same libm call. The bench may need kernels for them.
- Before racing anything, take 20+ interleaved runs of the round kernel on main, plus a byte-identical copy of the binary for the noise band. `main` carries #916 (`-z relro -z now`), so first record whether that already changed the call cost.

### Candidates

Every candidate must be exact. Never retry the five pure-SSE2 lowerings in #943; they lost in a real build.

- **(a) Run-time dispatch.** A process-wide flag set once from cpuid chooses inline `roundsd` or the existing libm path. The runtime asks `cpuid.h`, not `__builtin_cpu_supports` (the comment in [runtime/runtime-aes.c](runtime/runtime-aes.c) says why: a libgcc constructor). Follow that rule, or measure why it doesn't apply. To emit `roundsd` inside a baseline function, try:
  - inline asm with no side effects, so LLVM can hoist and CSE it;
  - a helper marked `"target-features"="+sse4.1"`, but LLVM will not inline a callee with more features than its caller, so check;
  - a multiversioned hot loop.

  Check in the optimised IR or assembly that the flag's branch is hoisted out of the hot loop, or costs nothing measurable in it.
- **(b) Linker-side.** Call libm through the PLT or with `-z now` for libm symbols only, keeping `-fno-plt` elsewhere. This is the comparison point, not the goal.
- **(c)** Anything better. Name it in the PR.

### Shipping the lowering

- The fallback must be the current exact lowering, and **an unset flag means fallback**. Code that never ran the runtime's init must still be correct: N-API addons, `--emit-c-header` libraries and freestanding builds. Prefer setting the flag inside an existing init path, or lazily, over a new constructor.
- **Targets.** x86-64 without SSE4.1 in the target features only. Under `--cpu x86-64-v3` the plain intrinsic stays (it is already `roundsd`). aarch64, wasm32 and wasi IR must be byte-identical to main's: the NEON CI job and the aarch64 goldens stay put.
- **Runtime unit.** Prefer an existing runtime unit. A new `runtime/*.c` file changes the "ten runtime units" counts and needs a security-record scope (`node scripts/security-scope.mjs`).
- **Freeze.** `src/` may not *use* a new construct or builtin. Emitting new IR is fine.

### Correctness

- Add `tests/cases/math_round_floor_edges.ts` (or extend the existing `math_round_edges` from #943's branch), checked byte for byte against Node's prelude.
  - `round`: ±0, ±0.5, ±1.5, ±2.5, 0.49999999999999994, -0.49999999999999994, 2^52-0.5, 2^52, 2^53+1, ±Infinity, NaN, -1e-300, and the smallest and largest subnormals.
  - `floor`, `ceil` and `trunc`: the matching edges, including the -0 results: `ceil(-0.5)`, `trunc(-0.5)`, `floor(-0)`.
- Run it through both paths. Force the fallback with an environment override in the existing `NISH_SIMD` style, or a test hook, so CI's SSE4.1 runners cover it. A `tests/run.js` check runs the case natively both ways and diffs against Node.

### Goldens and bench

- Only `.ll` goldens whose rounding lowering changes may move. Regenerate them with `UPDATE_GOLDENS=1 node tests/run.js <case>`, and `tests/self/goldens/checked/` with `node tests/self/goldens.js --update`. List every moved `.ll` in the PR.
- Keep the `"math"` entry in `bench/instructions.json` (the owner's decision). Change its count only if the `instructions` section requires it, and say why.
- Run `node bench/run.mjs --only math --runs 10 --warmup 2` on a scratch checkout, because it rewrites `docs/BENCHMARKS.md`. Don't commit that file. Put the full table in the PR.
  - **The bar:** on every math kernel, Nish at the default target is at or below the fastest twin built for the same baseline target, outside the noise band.
  - Report Rust `target-cpu=native` separately.
- Run the whole bench suite once and report any kernel that regresses outside its band.

### Docs

- `docs/IR_COOKBOOK.md`: the new lowering.
- `docs/LANGUAGE.md` (beside the `NISH_SIMD` rule) and a `docs/guide/` page: any new environment override, since it is user-visible. No guide page documents `NISH_SIMD` yet, so pick the page a user would look on and say why.
- `docs/security/runtime.md`: only if the runtime gains a cpuid reader the record's scope must name.

### PR

- Subject `perf(codegen): …`, `Fixes #943` in the body.
- A `Measured:` trailer with the figures and the noise band.
- The exact LLVM IR of the new lowering for each of round/floor/ceil/trunc, the list of moved goldens, and both bench tables.

## Out of scope

- Raising the default target. A binary built today must run on baseline x86-64.
- Pure-SSE2 rounding lowerings (#943 raced five).
- Any change to aarch64, wasm or wasi lowering.

## Generated files

Regenerate with the repo's tooling, never hand-edit or hand-merge: `tests/self/goldens/**`, `tests/differential/goldens/**`, `tests/differential/emit-ts-known.txt`, `tests/emit-ts/**/*.expected.ts`, `tests/cases/*.ll`.

## Verification

Each stage's `verification` command, read by bare exit code. Stage B also runs the full `npm test` once before the PR and reads its skip count. CI's four `test` shards are the full-suite gate.
