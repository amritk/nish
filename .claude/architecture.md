# Architecture

`nish` is an ahead-of-time compiler from a strictly static subset of
TypeScript to textual LLVM IR. It parses with the official TypeScript compiler
API, rejects everything dynamic (`any`, prototypes, `eval`, exceptions, a
garbage collector), and emits `.ll` files that clang / llc turn into native
binaries, wasm, or N-API modules. If it compiles, every value has one fixed,
known memory layout; there is no interpreter and no GC anywhere in the
pipeline.

The full description lives in **[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)**
and is not duplicated here. This file is the map of where to look.

## The pipeline in one screen

```
nish a.ts b.ts [-o out/] [--link exe]                             src/index.ts
   │
   ▼
Compilation                                                            src/compilation.ts
   ├─ load (per module, transitively through imports; each file once)
   │    ├─ Phase A  parse        ts.createSourceFile                    src/parser.ts
   │    ├─ Phase 0  validate     forbidden-syntax sweep, hard fail      src/validator.ts
   │    └─ Phase B1 signatures   functions, classes, interfaces, imports src/checker/index.ts
   ├─ check
   │    ├─ Phase B1b bind imports to the exporters' signatures
   │    └─ Phase B2 bodies       statements/expressions via dispatch tables
   ├─ emit
   │    ├─ Phase C0 attributes   program-wide purity/escape/loop fixpoint src/codegen/attributes.ts
   │    └─ Phase C1 IR text      one module per source file             src/codegen/emitter.ts
   └─ interop sidecars           --emit-header / --emit-dts / --emit-napi src/interop/
   │
   ▼
.ll files ──▶ scripts/build.sh + runtime/*.c ──▶ native binary / .wasm / .node
```

## The rules that shape every change

- **The checker records, the emitter reads.** Everything the emitter needs is
  written into `CheckedProgram` (`src/checker/program.ts`) in `WeakMap`s keyed
  by AST node; the AST is never mutated and the emitter never re-derives a
  type. `emit/*.ts` has no diagnostics; an unexpected node there is an internal
  error (exit 70).
- **Dispatch tables, not branches.** The validator, checker and emitter are
  each a table keyed by `ts.SyntaxKind`. A construct is added as an entry in
  each, mirrored across the layers.
- **No attribute without a proof.** `src/codegen/attributes.ts` may only emit
  an LLVM attribute (`readnone`, `willreturn`, `nounwind`, `dereferenceable`,
  `nsw`) that the whole-program fact fixpoint justifies, with the reason
  written next to the code. See "Attribute soundness rules" in
  `docs/ARCHITECTURE.md`.
- **Layout changes are two-sided.** A struct layout lives in
  `src/codegen/runtime.ts` and `runtime/runtime.c` / `runtime/nish.h`;
  they change in the same commit and a layout test grows with them.
  `tests/run.js` fails when the runtime symbol table disagrees between them.
- **The runtime has two budgets.** Every `.text*` section of
  `clang -Oz -c <file>`, summed, for each of the runtime's two translation
  units: `runtime/runtime.c` — the core every program touches, which is a closed
  set — stays under 3,584 bytes and is 3,480 today; `runtime/runtime_os.c` — the
  syscall wrappers, which is the surface that grows as the language reaches
  further into the operating system — stays under 1,280 and is 1,190. They are
  apart so that a new builtin for files, directories, processes, the environment
  or the clock cannot move the core's number; the source bytes of either are
  history rather than a limit. `tests/run.js` measures both on every run
  (`node tests/run.js budget`), so a PR that touches the runtime does not depend
  on a reviewer remembering to report a size. Raising either ceiling takes a
  fresh measurement written into `docs/wp7-runtime.md` §"Runtime additions and
  budget", and the two are raised for different reasons: the core's should come
  down over time, the other one's rises with the surface.
- **A link line names the runtime through `scripts/build.sh`.** It compiles
  `runtime_os.c` beside any `runtime.c` it is handed, which is what keeps
  `nish --link` in both compilers, the published package and every recipe in the
  documents correct with one file named. A direct `clang` line names both.
- **The name lives in two files.** `src/branding.ts` and `self/branding.ts` are
  the only source files that spell the project's name. Every string the
  compiler prints builds it from `LANGUAGE` / `CLI` there; prose is exempt, and
  the `nish_` prefix on the runtime's C symbols is ABI rather than branding:
  it is frozen and a rename does not follow it. See "Where the name lives" in
  `docs/ARCHITECTURE.md`.
- **The language is the reference.** `docs/LANGUAGE.md` is normative and every
  rule there cites the test case that proves it; the `docs/wp*.md` notes are
  historical, and where they disagree LANGUAGE.md wins.

## Where to read next

| Question | Document |
| --- | --- |
| How do I add a construct? | `docs/ARCHITECTURE.md` → "How to add a construct" (the nine-step checklist) |
| What does the language allow, exactly? | `docs/LANGUAGE.md` |
| What IR does construct X compile to today? | `docs/IR_COOKBOOK.md` (regenerated by `docs/cookbook/regen.sh`) |
| Which ABI guarantees do the tests pin? | `docs/ARCHITECTURE.md` → "ABI contracts and the tests that guard them" |
| Why is attribute Y sound? | `docs/ARCHITECTURE.md` → "Attribute soundness rules", and the comment beside the code |
| Why is the semantics different from JavaScript here? | `docs/FAQ.md`, `docs/wp13-differential.md` |
| What is the plan and who owns what? | `docs/MASTER_PLAN.md` (§7 conventions, §8 agent brief) |
| How does the harness work? | `.claude/testing.md`, then `docs/ARCHITECTURE.md` → "Test harness" |

## Repository layout

```
src/                 the compiler (tsc → dist/)
  index.ts           CLI: flags, output planning, exit codes
  compilation.ts     one program: load, check, emit, sidecars
  parser.ts / validator.ts / types.ts / diagnostics.ts
  checker/           pass 1 signatures, pass 1b imports, pass 2 bodies; side tables in program.ts
  codegen/           attributes, escape analysis, target table, ir builder, runtime ABI, emit/*
  interop/           C header, wasm .d.ts and N-API shim generators
runtime/             runtime.c (core), runtime_os.c (the syscall wrappers), nish.h,
                     runtime_wasm.c, shim.mjs (the Node twin)
scripts/             build.sh (clang/LTO profiles), size-report.sh, smoke.sh, changelog-section.sh
tests/               run.js + cases/ (goldens), link/, ir/, layout/, differential/, driver.c, runtime_test.c
examples/            Nish inputs used by the README, smoke test and size report
bench/               Nish / C / Rust suite that writes docs/BENCHMARKS.md
docs/                LANGUAGE, ARCHITECTURE, IR_COOKBOOK, FAQ, INSTALL, MASTER_PLAN, wp*.md design notes
.claude/             these guidelines
```
