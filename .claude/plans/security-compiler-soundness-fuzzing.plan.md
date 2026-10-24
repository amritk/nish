---
name: Compiler soundness fuzzing — an elision-off oracle, a proof-shaped generator, sanitizer builds and CI
overview: The compiler drops bounds checks, adds nsw and attributes, stack-allocates and scopes arenas on proofs (src/bounds.ts, src/ranges.ts, src/attributes.ts, src/escape.ts). Today only the IR-equality fuzzer (tests/differential/fuzz.js) guards them, and it compares seed against HEAD, so a proof both compilers share is never questioned. This run adds a reference build with every proof switched off, a differential that runs each program both ways at -O2, a generator that writes the shapes the proofs reason about, an AddressSanitizer build that can see inside Nish's bump arenas, CI that runs it all, and a codegen.md finding (fixed, with a regression test) for whatever it turns up.
stages:
  - id: oracle
    title: The elision-off reference build and the differential runner
    goal: A hidden `--no-elision` flag compiles with every proof-backed elision off, and tests/differential/soundness.js runs every program both ways at -O2 and fails on any difference in stdout, exit status, or a trap only the optimised build takes
    verification: node tests/run.js no_elision && node tests/differential/soundness.js --corpus tests/cases && npm run check && npm run lint && node tests/run.js wasi && node tests/run.js performance
    status: pending
    todos:
      - id: oracle-flag
        content: Add the hidden `--no-elision` flag on the `--range-reference` pattern (src/compile.ts parse, src/options.ts field with its test-hook doc comment, src/cli-style.ts) — not in the usage, not in docs/guide
        status: pending
      - id: oracle-switches
        content: Under the flag, switch off every proof-backed transformation — pass-2 and call-site index proofs (nodeProvenIndex stays false), proven-nsw and proven-overflow elision, proof-backed function and parameter attributes (noalias/nocapture/willreturn/readonly/dereferenceable and kin), loop header hoisting, stack allocation and escape-scoped arena releases — and list each switch in the Options doc comment so a new proof has one place to be added
        status: pending
      - id: oracle-pins
        content: tests/run.js pins that the flag works — a case with a proven index keeps its nish_panic_index call and loses its nsw/attributes under the flag (exact IR shown in the PR), and the flag changes no stdout over a sample of tests/cases
        status: pending
      - id: oracle-runner
        content: Write tests/differential/soundness.js — compile each program with and without `--no-elision` at -O2 with --link, run both, compare stdout and exit status, and report a trap or signal present only on the optimised side; takes --corpus <dir>, --seed/--count for generated programs (fuzz.js's generator for now), --threads
        status: pending
      - id: oracle-ci
        content: A fixed-seed bounded soundness step beside the existing fuzz step in .github/workflows/ci.yml (seconds-scale budget, corpus plus a fixed --seed)
        status: pending
      - id: oracle-goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff
        status: pending
  - id: generator
    title: The proof-shaped generator and the AddressSanitizer build
    goal: tests/differential/proofgen.js writes well-typed programs in the shapes the proofs reason about, and tests/differential/asan.js links a program with -fsanitize=address against a runtime whose arenas ASan can see into, so an out-of-bounds access the checker let through reports instead of reading a neighbour
    verification: node tests/differential/proofgen.js --self-test --seed 1 --count 200 && node tests/differential/asan.js --self-test && npm run lint
    status: pending
    todos:
      - id: gen-shapes
        content: Generate array indexing with derived indices (i+c, i*k, i>>1, masks, ranged u8/u16), loops whose bounds the elision trusts (i < a.length, i < n with n a proven length, reversed and stepped), push/pop inside loops, slices, aliasing (two names, an array stored in a field, passed to a callee that resizes), closures capturing arrays, arena scopes (using/scope()), and nish/threads parallel loops — each shape both in-bounds and one-past, so the checked build sometimes panics
        status: pending
      - id: gen-self-test
        content: --self-test compiles every generated program with the seed (build/seed/bin/nish) and requires the checker to accept them all, that each shape occurs, and that a share of the in-bounds accesses are actually proven (the elision is exercised, not bypassed)
        status: pending
      - id: asan-runtime
        content: Under -DNISH_ASAN, runtime/runtime.c gives every arena allocation its own malloc'd block (a chunk of exactly the request, so the inline bump in nish_alloc_struct always takes the slow path) and the array and string growth paths keep ASan's view of capacity accurate (poison the unused tail); a normal build is byte-identical
        status: pending
      - id: asan-harness
        content: tests/differential/asan.js links a program with clang -fsanitize=address (and -fsanitize=undefined on the C runtime, the only part UBSan instruments) against that runtime, runs it, and classifies a sanitizer report; --self-test proves it catches a deliberately out-of-bounds read of an arena array built with --unchecked-indexing
        status: pending
  - id: findings
    title: Wire the oracle to the generator, run it, and record what it finds
    goal: tests/differential/soundness.js drives proofgen.js programs through the elision-off oracle and the ASan build; CI runs a bounded fixed-seed pass per PR and a scheduled longer run; every miscompile or unsound acceptance found is a docs/security/codegen.md finding, fixed with a regression test
    verification: node tests/differential/soundness.js --gen --seed 20261024 --count 300 --asan && node tests/run.js cg_sec && npm run check && npm run lint && node tests/run.js wasi && node tests/run.js performance
    status: pending
    todos:
      - id: wire
        content: soundness.js takes --gen (proofgen.js) and --asan (asan.js) and reports a minimised reproducer per failure
        status: pending
      - id: ci-per-pr
        content: Switch the per-PR soundness step in ci.yml to the generator with a fixed seed and a budget of a few minutes, ASan included
        status: pending
      - id: ci-scheduled
        content: A scheduled workflow (.github/workflows/soundness-fuzz.yml) running a long randomised pass weekly, uploading reproducers and printing the seed
        status: pending
      - id: long-run
        content: Run a long pass (tens of thousands of programs) and triage every failure to a miscompile, an unsound acceptance, or a generator bug
        status: pending
      - id: record
        content: Each real finding becomes a CG-N row in docs/security/codegen.md per docs/security/README.md (anchors at a stated commit, severity, exact check(...) names), fixed in src/ with a tests/cases cg_sec_* regression (golden .ll where the rules ask) and the method section updated to name the oracle, generator and ASan build; if none is found, the record says how many programs and which shapes were run
        status: pending
      - id: findings-goldens
        content: Regenerate tests/self/goldens/checked and register new positive cases with node tests/differential/goldens.js --update
        status: pending
---

# Compiler soundness fuzzing

## Merge order

`oracle` and `generator` run at once (disjoint `Owns`). `findings` depends on
both and starts when they have merged — it needs the flag and the generator,
and it owns `src/` for its fixes.

## oracle

**Owns:** `src/compile.ts`, `src/options.ts`, `src/cli-style.ts`,
`src/compilation.ts`, `src/bounds.ts`, `src/ranges.ts`, `src/attributes.ts`,
`src/escape.ts`, `src/emit*.ts`, `src/runtime.ts`, `tests/run.js`,
`tests/cases/no_elision*`, `tests/differential/soundness.js`,
`tests/differential/goldens/**`, `tests/self/goldens/checked/**`,
`.github/workflows/ci.yml`

The flag is a test hook, like `--range-reference`: not in the usage, not a
language change, no guide page. The rolling freeze applies: `src/` may not use
anything the seed (0.20.0) lacks. "No trap only the optimised build takes"
means: the checked build exiting 0 while the optimised one dies on a signal,
panics, or exits differently is a failure; the reverse (checked panics, the
optimised build does not) is also a failure, since an elided check that
would have fired is the bug this hunts.

## generator

**Owns:** `tests/differential/proofgen.js`, `tests/differential/asan.js`,
`runtime/runtime.c`, `runtime/runtime-*.c`

New files only, plus the runtime's `NISH_ASAN` path. It does not touch
`scripts/build.sh`: the sibling `security-parser-fuzzing` run may add
sanitizer link support there; if that has merged first, `asan.js` reuses it
instead of linking by hand. It does not need the `--no-elision` flag.

## findings

**Owns:** `src/**`, `tests/cases/cg_sec_*`, `tests/run.js`,
`tests/differential/**`, `tests/self/goldens/checked/**`,
`.github/workflows/ci.yml`, `.github/workflows/soundness-fuzz.yml`,
`docs/security/codegen.md`

## Verification

`npm run check`, `npm run lint`, targeted `node tests/run.js <filter>`; the
full `npm test` (40–70 min, read the skip count) before opening each PR and
after the last merge of `main`. Any `src/` change also runs
`node tests/run.js wasi` (with `WASI_SYSROOT=/usr`) and
`node tests/run.js performance`. Generated: `tests/self/goldens/checked/**`,
`tests/differential/goldens/**` — regenerated, never hand-edited.
