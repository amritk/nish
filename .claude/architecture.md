# Architecture

`nish` is an ahead-of-time compiler from a strictly static subset of
TypeScript to textual LLVM IR, written in that subset itself (`src/`) and built
by its own previous release. It has its own lexer and parser, rejects everything
dynamic (`any`, prototypes, `eval`, exceptions, a
garbage collector), and emits `.ll` files that clang / llc turn into native
binaries, wasm, or N-API modules. If it compiles, every value has one fixed,
known memory layout; there is no interpreter and no GC anywhere in the
pipeline.

The full description lives in **[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)**
and is not duplicated here. This file is the map of where to look.

## The pipeline in one screen

```
nish a.ts b.ts [-o out/] [--link exe]                             src/compile.ts
   │
   ▼
Compilation                                                            src/compilation.ts
   ├─ load (per module, transitively through imports; each file once)
   │    ├─ Phase A  lex, parse   one Node class, dense ids              src/lexer.ts, parser.ts
   │    ├─ Phase 0  validate     forbidden-syntax sweep, hard fail      src/validator.ts
   │    └─ Phase B1 signatures   functions, classes, interfaces, imports src/checker.ts
   ├─ check
   │    ├─ Phase B1b bind imports to the exporters' signatures
   │    └─ Phase B2 bodies       statements/expressions, switch on kind  src/statements.ts, expressions.ts
   ├─ emit
   │    ├─ Phase C0 attributes   program-wide purity/escape/loop fixpoint src/attributes.ts
   │    └─ Phase C1 IR text      one module per source file             src/emit.ts
   └─ interop sidecars           --emit-header / --emit-dts / --emit-napi src/interop-*.ts
   │
   ▼
.ll files ──▶ scripts/build.sh + runtime/*.c ──▶ native binary / .wasm / .node
```

## The rules that shape every change

- **The checker records, the emitter reads.** Everything the emitter needs is
  written into the side tables of `src/program.ts`, arrays indexed by
  `Node.id`; the emitter never re-derives a type. `src/emit*.ts` has no
  diagnostics; an unexpected node there is an internal
  error (exit 70).
- **Dispatch, not `if` chains.** The validator, checker and emitter each
  dispatch through a central `switch` on the node kind. A construct is added as
  an entry in each, mirrored across the layers.
- **No attribute without a proof.** `src/attributes.ts` may only emit
  an LLVM attribute (`readnone`, `willreturn`, `nounwind`, `dereferenceable`,
  `nsw`) that the whole-program fact fixpoint justifies, with the reason
  written next to the code. See "Attribute soundness rules" in
  `docs/ARCHITECTURE.md`.
- **Layout changes are two-sided.** A struct layout lives in
  `src/runtime.ts` and `runtime/runtime.c` / `runtime/nish.h`;
  they change in the same commit and a layout test grows with them.
  `tests/run.js` fails when the runtime symbol table disagrees between them.
- **The runtime has a budget per translation unit.** Every `.text*` section of
  `clang -Oz -c <file>`, summed, for each of the runtime's five translation
  units:

  | Unit | What it holds | Today | Ceiling |
  | --- | --- | --- | --- |
  | `runtime/runtime.c` | the core every program touches, a closed set | 3,606 (3,731 with `-DNISH_THREADS=1`) | 3,606 (3,840) |
  | `runtime/runtime-os.c` | the syscall wrappers: files, directories, processes, the environment | 1,530 | 1,536 |
  | `runtime/runtime-parallel.c` | dividing a range of work across threads | 286 (905 threaded) | 320 (1,024) |
  | `runtime/runtime-host.c` | the wall clock, entropy, file times, signals | 764 | 768 |
  | `runtime/runtime-net.c` | the sockets of `nish:net`: addresses, non-blocking TCP and UDP, the readiness loop | 2,303 | 2,304 |

  They are apart so that a new builtin in one area cannot move another's
  number; the source bytes of any of them are history rather than a limit.
  `tests/run.js` measures every one on every run (`node tests/run.js budget`),
  so a PR that touches the runtime does not depend on a reviewer remembering to
  report a size. Raising a ceiling takes a fresh measurement written into
  `docs/wp7-runtime.md` §"Runtime additions and budget"; the core's should come
  down over time, the others rise with their surface. **When an addition does
  not fit, split it into a new unit with its own measured ceiling rather than
  raising an existing one**, as `runtime-parallel.c` and `runtime-host.c` were.
- **A link line names the runtime through `scripts/build.sh`.** It compiles
  the other units beside any `runtime.c` it is handed, which is what keeps
  `nish --link`, the published package and every recipe in the documents
  correct with one file named. A direct `clang` line names them all.
- **A new runtime unit is named in five places, in the same commit:** the list
  in `scripts/build.sh` that pairs units with `runtime.c` (without it every
  `--link` fails on an undefined symbol), `RUNTIME_C` and the `npm pack` check
  in `tests/run.js`, the link line in `tests/nish/run.ts`, the `nish run` cache
  key in `src/run-cache.ts`, and a `*_TEXT_BUDGET` of its own in
  `tests/run.js`. `package.json`'s `files` already ships all of `runtime/`. A
  plan whose stage may split the runtime must give that stage
  `scripts/build.sh` (WP34 N3, #312, needed it and had not been given it).
- **The name lives in one file.** `src/branding.ts` is the only source file
  that spells the project's name. Every string the
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
| How do I add a construct? | `docs/ARCHITECTURE.md` → "How to add a construct" (the ten-step checklist) |
| What does the language allow, exactly? | `docs/LANGUAGE.md` |
| What IR does construct X compile to today? | `docs/IR_COOKBOOK.md` (regenerated by `docs/cookbook/regen.sh`) |
| Which ABI guarantees do the tests pin? | `docs/ARCHITECTURE.md` → "ABI contracts and the tests that guard them" |
| Why is attribute Y sound? | `docs/ARCHITECTURE.md` → "Attribute soundness rules", and the comment beside the code |
| Why is the semantics different from JavaScript here? | `docs/FAQ.md`, `docs/wp13-differential.md` |
| What is the plan and who owns what? | `docs/MASTER_PLAN.md` (§7 conventions, §8 agent brief) |
| How does the harness work? | `.claude/testing.md`, then `docs/ARCHITECTURE.md` → "Test harness" |

## Repository layout

```
src/                the compiler, in Nish, built by the last release (see selfhost.md)
  compile.ts         CLI: flags, output planning, exit codes
  compilation.ts     one program: load, check, emit, sidecars
  lexer.ts parser.ts nodes.ts validator.ts types.ts diagnostics.ts codes.ts
  checker.ts …       pass 1 signatures, pass 1b imports, pass 2 bodies; side tables in program.ts
  emit*.ts …         attributes, escape analysis, target table, ir builder, runtime ABI
  interop-*.ts       C header, wasm .d.ts and N-API shim generators
std/                 the standard library, in Nish
runtime/             runtime.c (core), runtime-os.c (the syscall wrappers),
                     runtime-parallel.c (threads), runtime-host.c (clock, entropy,
                     file times, signals), runtime-net.c (sockets), nish.h,
                     nish.d.ts (the builtins, for npm run check), runtime-wasm.c,
                     shim.mjs (the Node twin)
bin/                 the npm command, which hands over to the prebuilt native compiler
scripts/             build.sh (clang/LTO profiles), bootstrap.sh, fetch-seed.sh,
                     size-report.sh, smoke.sh, changelog-gen.mjs
tests/               run.js + cases/ (goldens), link/, ir/, layout/, differential/, self/,
                     wordings/, nish/, driver.c, runtime-test.c
examples/            Nish inputs used by the README, smoke test and size report
bench/               Nish / C / Rust suite that writes docs/BENCHMARKS.md
docs/                LANGUAGE, ARCHITECTURE, IR_COOKBOOK, FAQ, INSTALL, MASTER_PLAN, wp*.md design notes
.claude/             these guidelines
```
