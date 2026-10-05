# WP10: CI and diagnostics

**Status:** complete. The workflow below is what `.github/workflows/ci.yml`
runs today. The diagnostic format, multi-error reporting, `--json` with stable
codes, `--emit-ast` / `--emit-checked` and `-g` all shipped and are specified
normatively in [LANGUAGE.md](LANGUAGE.md#diagnostics-and-debugging-flags);
this page keeps the design notes, the code bands, and the CI facts the
workflow's comments point at.

## CI matrix

`.github/workflows/ci.yml` runs on every pull request, on pushes to `main`
(scoped to `main` so a branch with an open pull request is not tested twice),
and through `workflow_call` from `release.yml`. A pull request's superseded
runs are cancelled; a push to `main` never is, because each one is a merge and
its run is the only record of whether `main` was green after it (#396 and
#397 ended cancelled before that rule).

| Job | Runner | What it does |
| --- | --- | --- |
| `test (ubuntu-latest)` | Ubuntu, LLVM 18 from apt (`clang-18 lld-18 llvm-18`, `valgrind`, `wasi-libc`, `libclang-rt-18-dev-wasm32`) | `npm ci`, `npm run check`, the seed (`scripts/fetch-seed.sh`), `npm test -- --seed build/seed/bin/nish --delegate-fixed-point`, then the stage1 the suite built kept as `build/nish` and used for the smoke test, `docs/cookbook/regen.sh --check`, `gen-diagnostic-codes.mjs --check` and the size report in the job summary |
| `test (macos-latest)` | — | **commented out** of the matrix, on six named checks (below). `bootstrap` has had darwin rows since the 0.4.0 seeds; `nish-cmp` is Linux-only |
| `seeds` | Ubuntu | runs `.github/seed-matrix.sh`: asks the newest release which seed assets it carries and emits the `bootstrap` and `nish-cmp` matrices. Red only when a seed that is due is missing |
| `bootstrap (<asset>)` | the row's `runner` from `.github/seed-targets.json` | `NISH_BOOTSTRAP=<seed> scripts/bootstrap.sh --verify` — the only check of WP19's rolling freeze — then `tests/nish/cli.ts` against the stage2 it built |
| `nish-cmp (<asset>)` | the row's `runner` | WP19 G2.1: `tests/nish-cmp.js` compiles the corpus with the last release and with HEAD and requires every byte to match, then `tests/differential/fuzz.js --stage1` does the same for 200 random programs. Rows only for the Linux (`ubuntu-*`) seeds, and none until the newest release is at or after `cmpSince` |
| `runner` | Ubuntu, LLVM 18 | builds the compiler from the seed and runs the whole golden corpus through `tests/nish/run.ts`, the harness written in Nish. A regression in the runner, or in `readdirSync` / `spawnSyncTo` / `monotonicNanos`, fails only here |
| `lint` | Ubuntu | `npm ls --package-lock-only` (skipped on tags and on `release/next`), `npm run lint` (filenames and Biome), `npm run lint:dead` (knip), `shellcheck -S warning` over the repository's shell scripts, and `node docs/check-links.mjs` |

Every job that compiles anything compiles with `src/`, built from the seed:
there is no other compiler in the repository. The jobs that compared two
implementations — `batch-parity`, `parity-select`, `parity-changed`, the
nightly `parity.yml` and `release.yml`'s `ddc` job — were deleted with stage0's
`src/` in WP19 R6 ([below](#the-parity-run-retired)).

The other workflows: `release.yml` and `release-pr.yml`
([wp12-release.md](wp12-release.md#release-procedure)); `pr-title.yml`, which
checks a pull request title with `changelog-gen.mjs --check-subject`;
`pr-body.yml`, which refuses tool attribution in a pull request body; and
`ct-timing.yml`, a weekly dudect-style timing test of the constant-time crypto
code that files an issue rather than failing a pull request.

`--delegate-fixed-point` makes `tests/run.js` record its own copy of the
bootstrap fixed point (`IR(stage1) == IR(stage2)`, `stage3 == stage2`, about
80 s of the critical path) as **delegated** to the `bootstrap (x86_64-linux)`
row, which asserts the same equalities with the same seed in the same run. It
is a third count beside passed and skipped, honoured only under GitHub Actions
on a host with a seed target, and a check fails if `test` asks for it while
`bootstrap` has stopped running `--verify`. A local `npm test` always runs the
fixed point.

### The macOS `test` row

`npm test` on `macos-latest` was run on 2026-09-13 (five failures) and on
2026-09-21 (`2125 passed, 6 failed, 4 skipped`,
[run 606](https://github.com/amritk/nish/actions/runs/35652075129)). None of
the failures is a compiler bug: each check read an ELF fact out of a linked
binary instead of the property it tests. Three were ported (`lineTableOf` in
`tests/run.js` reads the `.dSYM` the Darwin driver writes; the `--threads`
runtime mismatch is caught as a segfault on Darwin rather than as a link
error). The six that still hold the row out, listed with the run in the
comment beside `os:` in `ci.yml`, are three causes and one simulation:

- the `--threads` mismatch again, in the prebuilt runtime-object gate;
- the Mach-O debug map, read through `.debug_info` in the self-hosting `-g`
  check;
- `LC_UUID` (next section) in `tests/self/bootstrap.js`'s `stage3 == stage2`
  and the two `runtime objects:` byte comparisons, each of which links its two
  binaries at different output paths;
- plus one check that simulates Darwin from Linux through `NISH_UNAME_S` and
  has nothing to report on a real mac.

The macOS row also skips two more checks than Linux (the runtime `.text`
budgets are measured on `linux-x64`; `verify-binaries`'s debug-map arms need a
toolchain this one is not). Restoring the row is the one commented line plus
those six ports; the macOS LLVM install step is already written and guarded by
`runner.os`. Two bash 3.2 defects that used to stop the row first — empty
arrays under `set -u` in `scripts/build.sh`, and `mapfile` in
`scripts/smoke.sh` — are fixed.

#### What ld64 varies, measured

A throwaway workflow ran `release.yml`'s `binaries` steps on both darwin rows
on 2026-09-19 and attributed every byte by which stage3 and stage2 differed:

| Row | Runner | Size, both | Differing | Where |
| --- | --- | --- | --- | --- |
| `x86_64-darwin` | `macos-15-intel` | 649,808 | 16 bytes | `0x468`–`0x478`: `LC_UUID`, and nothing else |
| `aarch64-darwin` | `macos-latest` | 646,696 | 48 bytes | the same sixteen, plus 33 in the `LC_CODE_SIGNATURE` blob: the page hash of the page `LC_UUID` sits on, because ld64 ad-hoc signs arm64 |

`-Wl,-no_uuid` makes the binaries identical but is not available: dyld on
arm64 refuses an image with no `LC_UUID` (`missing LC_UUID load command`,
then `Abort trap: 6`). A further probe found the UUID stable across two links
to one output path and different on a link to another. The output path is the
leading explanation, not a finding — the probe's same-path links also ran
first, so path and invocation order are confounded, and the fourth link that
would separate them was not run. The remedy holds either way:
`scripts/bootstrap.sh` links stage2 and stage3 at one path and moves each into
place, `stage3 == stage2` is still a raw `cmp`, and both darwin rows came out
byte-identical end to end:

| Run | `aarch64-linux` | `aarch64-darwin` | `x86_64-darwin` |
| --- | --- | --- | --- |
| [1, as things stood](https://github.com/amritk/nish/actions/runs/35431909673) | green | red, *unattributed* | red, *unattributed* |
| [2, `-Wl,-no_uuid`](https://github.com/amritk/nish/actions/runs/35432446491) | green | red in dyld | green |
| [3, the UUID probe](https://github.com/amritk/nish/actions/runs/35432749109) | green | red, *unattributed* | red, *unattributed* |
| [4, one link path](https://github.com/amritk/nish/actions/runs/35433181271) | green | **green** | **green** |

The Darwin narrowing in `scripts/verify-binaries.sh` stays as a net under a
comparison that now holds, and `tests/run.js` pins its `LC_UUID` case as a
known limitation of that script. `scripts/verify-binaries.sh`'s header carries
the offsets.

### The seeded build, and what a missing seed reports

`bootstrap` builds `src/` with the **last released** binary, the only compiler
that exists to build it with, and so is the only check of the rolling freeze
([wp12-release.md](wp12-release.md#the-bootstrap-seed)). There are three
answers and two colours, so it is a pair of jobs: `seeds` answers in seconds,
before any toolchain, and `bootstrap` is a matrix over that answer, one row per
seed the release actually carries.

| The checks list says | It means |
| --- | --- |
| `seeds` green, a `bootstrap (<seed>)` row green | the freeze was checked with that seed on its own platform, and held |
| `seeds` green, no row for a platform | the freeze was *not* checked there, and nothing is wrong: no release carries that seed yet. The `seeds` summary names every platform in both states |
| `seeds` green, `bootstrap` **skipped** | there is no release at all |
| `seeds` **red** | a release is missing a seed it was due to attach |
| a `bootstrap` row **red** | `src/` does not build with the last release: the rolling freeze broken |

The gate has been wrong both ways. It first warned and exited 0 when it had
checked nothing; then it went red for every missing seed, which deadlocks a
repository with no release (the 0.1.0 base case, and every fresh fork),
because `release.yml`'s `release` job is `needs: ci`. Which missing seed is red
is now data: `.github/seed-targets.json` gives each platform its triple, its
asset name, its runner, and `attachedSince`, the first version that carries
it, and `.github/seed-due.sh` is the one place that compares versions. The
targets are attached from these releases: `x86_64-linux` from 0.1.1 and the
other three from 0.4.0. A platform not yet due has no row and is listed as
unchecked.

`.github/seed-matrix.sh` is a file rather than inline shell so that
`tests/run.js` can drive it against a stand-in for `gh` through every state;
inline shell nothing could run is how the logic was got wrong twice. The same
block checks each row's `triple` against `src/target.ts` and that each `asset`
is the triple with vendor and ABI dropped.

G3 is checked on both operating systems: the darwin pair's `attachedSince` is
0.4.0, so `bootstrap (aarch64-darwin)` and `bootstrap (x86_64-darwin)` have
run since that release. Because *presence* of an asset, not `attachedSince`,
creates a row, a platform's rows are exercised once before its version
arrives — a red row there would be red CI repo-wide, and only deleting the
published asset clears it. `release.yml` cannot be dispatched at a branch, so
that is done with a throwaway branch workflow running the `binaries` steps
without uploading; it needs a `push:` trigger, since `workflow_dispatch` needs
`actions: write`. The note under BEFORE ADDING A PLATFORM in
`seed-targets.json` has the recipe, and the four runs above are its record.

### The parity run, retired

`parity.yml` ran the whole corpus nightly through both compilers under sixteen
flag variations, and `parity-select` / `parity-changed` did the same per pull
request; it was WP19 G1's corpus half. All three compared stage0 with stage1
and went with stage0's `src/` in R6. The corpus is held now to its goldens
(`tests/cases/*.ll`, `.err`, `.stdout`) and to `nish-cmp`, which compares HEAD
with the last release.

### The toolchain on each runner

`tests/run.js` and the scripts probe for the plain names `clang`, `llc`,
`llvm-as`, `opt`, `ld.lld` and `wasm-ld`. Ubuntu symlinks Debian's versioned
binaries into `$RUNNER_TEMP/llvm-bin` ahead of `/usr/bin`; macOS prepends
`$(brew --prefix llvm@18)/bin` and installs the standalone `lld` formula only
if `llvm@18` ever stops bundling `wasm-ld`. The `Test` step sets
`WASI_SYSROOT=/usr`, because Debian's wasi-libc lives under
`/usr/lib/wasm32-wasi`; with it the wasi checks run instead of being counted as
skips, and a sysroot that is found and cannot link is a failure (the guard
#396 lacked). `node tests/run.js wasi` runs those checks alone.
`NODE_COMPILE_CACHE` is set for every job; it can only save Node start-up time,
never change an answer.

## Where the wall clock goes

The last full measurement predates R6 (run 474 on `main`, `a89bee7`,
2026-09-18): `batch-parity` 18 m 21 s, `test` 15 m 42 s (`npm test` 14 m 44 s),
`runner` 6 m 08 s, `bootstrap` 1 m 11 s, `lint` 10 s, `seeds` 8 s. Most of
`test` then was comparisons with stage0, each paying about 634 ms of Node and
`typescript` start-up per spawned compiler for 1.5 ms of compiling; R6 removed
both the comparisons and that cost. These numbers describe that tree, not this
one, and want re-measuring before anyone cites them. The ten costliest checks
were 70% of that run:

| Check (`a89bee7`, local run of 660.5 s) | Cost |
| --- | --- |
| `src/emit.ts emits the IR stage0 emits` | 90.1 s |
| `codes: every registry code is provoked by a program or explained` | 80.0 s |
| `src/checker.ts agrees with stage0 on what it accepts` | 70.5 s |
| `differential` | 51.1 s |
| `src/ compiles src/: the bootstrap reaches a fixed point` | 46.1 s |

`scripts/ci-profile.mjs` produced that table. It spawns a suite command,
timestamps each output line and attributes every gap to the check that closed
it:

```bash
node scripts/ci-profile.mjs                    # node tests/run.js
node scripts/ci-profile.mjs --top 60 --json    # machine-readable
node scripts/ci-profile.mjs -- npm run test:nish
```

Profile the **unfiltered** run: `node tests/run.js <substring>` measures
nothing until `rm -rf build/test`, and `fs.existsSync` guards drop checks with
no `SKIP` line (`.claude/testing.md`). Splitting `test` further would first
need a `--section` mechanism in `tests/run.js` with honest skip counting.

## Running the same steps locally

```bash
# Ubuntu / Debian
sudo apt-get install -y clang-18 lld-18 llvm-18
mkdir -p ~/.local/llvm-bin
for t in clang clang++ llc llvm-as opt ld.lld wasm-ld; do ln -sf /usr/bin/$t-18 ~/.local/llvm-bin/$t; done
export PATH=~/.local/llvm-bin:$PATH

# macOS
brew install llvm@18
export PATH="$(brew --prefix llvm@18)/bin:$PATH"

npm ci
bash scripts/fetch-seed.sh   # the last release's nish into build/seed/ (or set NISH_BOOTSTRAP)
npm run check           # tsc over src/, std/ and tests/nish/, emitting nothing
npm run build           # the seeded bootstrap: build/nish
npm test                # stage1 from the seed + tests/run.js
npm run lint
npm run size-report

# the wasi checks, as CI runs them (Ubuntu / Debian)
sudo apt-get install -y wasi-libc libclang-rt-18-dev-wasm32
WASI_SYSROOT=/usr node tests/run.js wasi
```

`npm run test:update` writes a missing case golden but not the per-module
goldens of `tests/link/` programs; `node tests/run.js <name>
--update-link-goldens` rewrites those (all of them without `<name>`). Read
the diff before committing any regenerated golden.

`scripts/build.sh` and `scripts/size-report.sh` branch on `uname`: on macOS
they use ld64's `-dead_strip` / `-x` instead of `--gc-sections` / `-s` and skip
`-fuse-ld=lld` and `-fno-plt`. The `wasm` profile finds the linker with
`clang -print-prog-name=wasm-ld`; with no `wasm-ld` the size report omits the
row and `build.sh --profile wasm` exits 2.

## Diagnostic format

Every error is a `Diagnostic` (`src/diagnostics.ts`), printed to stderr as:

```
tests/cases/reject_type_mismatch.ts:1:40: error: Operator `+` requires two operands of the same numeric type, got i32 and boolean
  1 | function f(a: number): number { return a + true; }
    |                                        ^~~~~~~~
```

- Line 1 is `<file>:<line>:<col>: error: <message>`, 1-based, at the start of
  the offending node. Tests match substrings of this line.
- Line 2 is the source line, prefixed with its number and ` | `.
- Line 3 puts `^` under the start column and `~` to the end of the node on
  that line; tabs are reproduced so the markers stay aligned.

Parser errors use the same layout with `syntax error:` in place of `error:`.
A tool that wants the parts reads `--json` instead of parsing this text. The
format's tests are the `// ---- WP10: diagnostics` block of `tests/run.js`.

## Multi-error reporting

Every phase that can recover reports into one `DiagnosticSink` owned by the
`Compilation` (`src/compilation.ts`):

| Phase | Recovery unit | Where |
| --- | --- | --- |
| Parser | every parse diagnostic of the file | `parse` (`src/parser.ts`) |
| Phase 0 validator | every forbidden construct (a rejected node's subtree is skipped) | `validate` (`src/validator.ts`) |
| Pass 1 (signatures) | per declaration; a broken class is marked `poisoned` | `Checker.collectSignatures`, `Compilation.load` |
| Pass 1b/1c | per import binding; every symbol clash | `Checker.bindImports`, `Compilation.rejectSymbolClashes` |
| Pass 2 (bodies) | per statement; the enclosing function is `poisoned` | `checkStatements` (`src/statements.ts`) |

The language has no exceptions, so a phase returns a sentinel and the sink is
asked at the end of the phase whether to stop: pass 2 never runs over broken
signatures and the emitter never sees a poisoned function. `sorted()` orders
the errors by file load order, then line and column, stably. The driver prints
at most 20 (`MAX_REPORTED_ERRORS`), then `...and N more errors`, then
`N errors`; a lone error prints exactly its message. `let x: T = <rejected>`
still declares `x` as `T`, and unreachable code is reported once per statement
list, to limit cascades. Tests: `tests/cases/reject_multi_*`.

## `--json`

`nish --json file.ts` prints one JSON object per diagnostic on stdout, nothing
on stderr, with the same exit code:

```
{"file":"tests/cases/reject_multi_error.ts","line":2,"column":10,"endLine":2,"endColumn":18,"severity":"error","code":"NL2231","message":"Operator `+` requires two operands of the same numeric type or two strings, got i32 and boolean"}
```

`line`/`column` are 1-based, `endLine`/`endColumn` exclusive. `severity` is
`"error"`, `"performance"` (WP15 §8), `"portability"` (WP33,
`--warn-portability`) or `"deprecation"`. Syntax errors keep the
`syntax error: ` prefix in `message`.

### `code`

`code` is the stable identifier of the broken rule and the field to key on:
`message` may improve between releases, the code may not. The registry is
`src/codes.ts`, **kept by hand**: a new diagnostic takes the next free number
in its band (`node scripts/gen-diagnostic-codes.mjs` with no flag prints
them), a number is never moved or reused, and a retired rule keeps its entry so
its number stays reserved. `--check`, run by `npm test` and by CI, validates
the format, the bands, the longest-fragment-first order, the pairing, that the
`NL7xxx`, `NL8xxx` and `NL9xxx` runs have no gaps, and that every code is
unique. The script generated the registry from stage0's sources until R6 and
is frozen now. `tests/diagnostic-coverage.js` requires every code to be
provoked by a program in `tests/wordings/` or explained in
`tests/wordings/unreachable.txt`.

The band says which phase refused the program:

| Band | Meaning |
| --- | --- |
| `NL0000` | no rule matched this message |
| `NL0001` | a syntax error; every one shares this code |
| `NL0002` | the C toolchain `--link` needs, or the prebuilt compiler itself, could not be run (exit 3) |
| `NL0003` | an internal compiler error (exit 70) |
| `NL1xxx` | Phase 0, the forbidden-syntax sweep (`src/validator.ts`) |
| `NL2xxx` | the checker: signatures, bodies, types |
| `NL3xxx` | the driver and module loading |
| `NL4xxx` | the interop sidecar generators |
| `NL7xxx` | a deprecation warning: a call that still compiles and that a later breaking release removes ([LANGUAGE.md](LANGUAGE.md#diagnostics-and-debugging-flags)) |
| `NL8xxx` | a WP33 portability warning, under `--warn-portability` ([wp33-round-trip.md](wp33-round-trip.md) §5.2) |
| `NL9xxx` | a WP15 §8 performance warning |

A code is matched against the longest literal run of the message's template,
with interpolated names, types and counts removed. A message built entirely of
interpolations has no such run and reports `NL0000`; `tests/run.js` pins that
backlog (`UNCODED_BACKLOG`, zero today) so it can shrink but not grow. Codes
appear in `--json` only: the human summary line is byte-for-byte what the
`.err` goldens match.

### Failures without a source position

Every failure is a parseable line under `--json`, so a wrapper is never left
with an empty stdout:

```
{"severity":"error","code":"NL0002","message":"--link: no usable C compiler found (...)"}
{"severity":"error","code":"NL0003","message":"internal compiler error while compiling a.ts: ..."}
```

A driver error (a bad `-o` layout, an unreadable input) has the same shape and
takes whatever code its text resolves to. An internal error is also reported
on stderr, because a crash is worth seeing twice.

## Performance warnings in CI

A performance warning never changes the exit code, so the gate is checks in
`tests/run.js` rather than a flag or a workflow step:

| What | Held to | Read from |
| --- | --- | --- |
| every `std/*.ts`, `examples/*.ts` and `examples/*/main.ts`, discovered from the directory | **zero** performance warnings, in both number modes where the program compiles | `--json`, `severity` `"performance"` (`NL9xxx`) |
| the same programs | **zero** deprecation warnings | `--json`, `severity` `"deprecation"` (`NL7xxx`) |
| the compiler, `src/` | `tests/perf-baseline.json`, per file and per code | the `--json` of the self-hosting compile |

The baseline only moves down. A count above it fails and prints the warnings;
a count below it fails with the line to edit (`set it to N in
tests/perf-baseline.json`), which is made in the same change, deleting an
entry that reaches zero. `.claude/testing.md`, "The performance gate", has the
rest.

## `--emit-ast` and `--emit-checked`

Both write to stdout instead of IR (`src/ast-text.ts`, `src/dump.ts`), with
file names relative to the working directory.

- `--emit-ast`: the tree of every module after Phase 0, one node per line,
  `<SyntaxKind> <line:col>-<line:col>` (end exclusive) plus identifier and
  literal text.
- `--emit-checked`: after every checker pass and the attribute analysis,
  per module: `struct` lines (layout, fields with index and byte offset),
  `import` lines, and `function` lines (signature, `@symbol`, flags), each with
  its `facts:`, `pointer <param>:` facts and `local` / `callee` lines.
  `tests/self/goldens/checked.txt` and `checked-self.txt` are this dump.

Goldens: `tests/cases/dump_*.stdout`.

## `-g` debug info

`src/debug.ts` builds the DWARF metadata; `IRFunction` (`src/ir.ts`) carries
the `subprogram` and the current location the emitter sets around every
statement and expression. Emitted: `!llvm.dbg.cu`, the `Dwarf Version` and
`Debug Info Version` module flags, a `DICompileUnit` (`DW_LANG_C99`, producer
`nish <version>`), a `DIFile` per source file (directory `.`), one `distinct
DISubprogram` per function (methods are `Owner.method`), `DILocation`s,
`llvm.dbg.value` for parameters and `llvm.dbg.declare` for locals and
`for...of` slots, with struct and array types described from the checker's
layouts.

- The directory is `.`, as with clang's `-fdebug-compilation-dir=.`, so a
  `-g` build depends only on the command line. An imported class is described
  against its own `DIFile`.
- A function's position is where its **declaration** starts (`export`,
  `const` or `function`), not its arrow (`tests/cases/dbg_arrow`).
- A `DILocation` column is a **byte** offset plus one, as `clang -g` writes
  (`tests/cases/dbg_utf8`); diagnostic columns are UTF-16 code units for an
  editor (`columnOf` and `byteColumnOf` in `src/diagnostics.ts`).

Without `-g` the IR is byte-identical. `--link -g` passes `-g` to
`scripts/build.sh`, which builds every input with it and drops the strip flag.
The `dbg_*` goldens pin the metadata, and the `-g` block of `tests/run.js`
verifies it with `opt -passes=verify`, links with two profiles, and checks the
line table names the `.ts` file, printing a visible `SKIP` when no DWARF tool
exists.
