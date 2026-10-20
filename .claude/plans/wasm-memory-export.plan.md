---
name: Refuse a wasm export named `memory`
overview: A wasm module already exports its linear memory as `memory`, so an exported Nish function of that name makes a module Node refuses to instantiate ("Duplicate export name 'memory'", #643). Refuse it with a new NL code on every route that produces a wasm module, and keep accepting it in a native build.
stages:
  - id: refuse-memory-export
    title: "fix(checker): refuse an exported function named `memory` in a wasm build"
    goal: An exported function (or one `--no-strict-exports` keeps by name) called `memory` is refused with a new NL code on a wasm `--target`, `--profile wasi`, an `--emit-dts` compile, and a `scripts/build.sh --profile wasm` link of host IR; a native build still accepts it
    verification: npm run check, npm run lint, WASI_SYSROOT=/usr node tests/run.js wasi (skip line read, not skipped), node tests/run.js performance, and an undegraded npm test green, with the regenerated goldens read
    status: pending
    todos:
      - id: checker-rule
        content: Add the refusal beside rejectCLibrarySymbols in src/compilation.ts, gated on isWasmBuild(opts) or a non-empty opts.emitDts — see Stage 1, The rule
        status: pending
      - id: code
        content: Register the new NL3038 (or next free NL30xx) wording in src/codes.ts and its tests/wordings/ case — see Stage 1, The rule
        status: pending
      - id: build-sh-guard
        content: Make scripts/build.sh --profile wasm refuse, exit 2, an input .ll that defines a function `@memory` — see Stage 1, The freestanding link
        status: pending
      - id: tests
        content: Negative tests for each wasm route, a positive native case, and the build.sh refusal — see Stage 1, Tests
        status: pending
      - id: docs
        content: LANGUAGE.md rule, AI.md line, the WebAssembly section of docs/guide/using-nish/interop.md — see Stage 1, Docs
        status: pending
      - id: goldens
        content: Regenerate tests/self/goldens with goldens.js --update and register any new positive case with tests/differential/goldens.js --update — see Stage 1, Generated files
        status: pending
---

# Refuse a wasm export named `memory` (#643)

## Stage 1: refuse-memory-export

**Owns:** `src/compilation.ts`, `src/codes.ts`, `src/visibility.ts`, `scripts/build.sh`,
`tests/run.js`, `tests/cases/**`, `tests/link/**`, `tests/wordings/**`,
`tests/self/goldens/**`, `tests/differential/**`, `docs/LANGUAGE.md`, `docs/AI.md`,
`docs/guide/using-nish/interop.md`, `docs/IR_COOKBOOK.md`

### The rule

`wasm-ld` (`--export-all` on the `wasm` profile, the default memory export on
`wasi`) exports the module's linear memory as `memory`. A Nish function whose
symbol is `memory` — exported from the program's own package, or any function
`--no-strict-exports` keeps by name — collides with it. Refuse it, pointing at the
name, with a message that names the module's memory export and says to rename it,
in the style of NL3037 (`src/compilation.ts` `rejectCLibrarySymbols`): same set of
functions (own package, not foreign, no owner, no instance, symbol still the source
name), a new stable NL code in `src/codes.ts`.

**Which builds.** Only builds whose output is a wasm module: `isWasmBuild(opts)`
(`--profile wasi`, a `wasm*` `--target`) **or** `opts.emitDts` set — the guide's
freestanding route (`nish x.ts -o x.ll --emit-dts x.d.ts` then
`build.sh --profile wasm`) compiles for the host, so `isWasmBuild` alone misses it,
and `--emit-dts` writes a wasm loader. A native `-o`, `--link`, `--emit-header` or
`--emit-napi` build keeps accepting `memory`. If the predicate grows, put it next to
`isWasmBuild` in `src/visibility.ts` rather than inline.

**Other names.** `_start`, `__heap_base`, `__data_end`, `__indirect_function_table`
already begin with `_`, which NL3037 refuses everywhere: confirm with a probe, do not
add a second diagnostic for them.

### The freestanding link

`-o` alone (IR for a C host) handed to `scripts/build.sh --profile wasm` never tells
the compiler it is a wasm build (CLAUDE.md: a wasm32 guard in the compiler never sees
that route). Make `build.sh`'s `wasm` profile (and `wasi`, if it takes `.ll` inputs
the same way) refuse, exit 2 with a one-line error naming the file and the rename,
an input `.ll` that `define`s `@memory`. Native profiles are untouched.

### Tests

- Negative, compiler: an exported `memory` refused on `--target wasm32`, on
  `--profile wasi` (needs the sysroot; read the skip line), and with `--emit-dts`;
  `--no-strict-exports` with a private `memory` refused on a wasm target.
- Positive: the same program compiled natively (`-o` and `--link`) is accepted and
  its native round trip prints the expected stdout.
- `build.sh --profile wasm` of host IR defining `@memory` exits 2 with the message;
  the existing wasm round trips still pass.
- A wasm round trip that instantiates a module with a renamed function in Node, if
  the existing `wasi`/`web` checks do not already cover instantiation.
- The negative golden is `tests/wordings/` plus the `tests/run.js` checks; name each
  `check(...)` string in the PR body.

### Docs

- `docs/LANGUAGE.md`: a bullet after "An exported function is not named after a C
  library function", with the exact message and the test names.
- `docs/AI.md`: one line beside its NL3037 line.
- `docs/guide/using-nish/interop.md`, WebAssembly section: one sentence that a wasm
  module exports its memory as `memory`, so an exported function cannot take that
  name.

### Generated files

`tests/self/goldens/checked.txt` and `checked-self.txt` via
`node tests/self/goldens.js --update` (`--seed build/seed/bin/nish` if
`build/nish` is not built; run `bash scripts/fetch-seed.sh --force` first). A new
positive `tests/cases/*` registered with `node tests/differential/goldens.js --update`
in the same commit. Never hand-edited.

### Commit

`fix(checker): refuse an exported function named memory in a wasm build`, body
written as the changelog entry, `Fixes #643`, `Tests:` trailer naming the checks.
