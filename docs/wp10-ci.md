# WP10: CI and diagnostics

This page covers the GitHub Actions workflow, how to reproduce it on a
workstation, and the format every compile error is printed in.

## CI matrix

`.github/workflows/ci.yml` runs on every pull request and on pushes to
`main`. Scoping the `push` trigger to `main` is what stops a branch with an
open pull request from running the matrix twice over, once per event; the
comment above the `on:` block has the details.

| Job | Runner | Steps |
| --- | --- | --- |
| `test (ubuntu-latest)` | Ubuntu, LLVM 18 from apt (`clang-18 lld-18 llvm-18`) | `npm ci`, `npm run check`, `npm test`, size report |
| `test (macos-latest)` | macOS (Apple Silicon), Homebrew `llvm@18` | **out of the matrix**, on five measured failures rather than on cost; see below |
| `seeds` | Ubuntu | asks the last release which seed binaries it attaches, and builds the `bootstrap` matrix from the answer. Green means it looked; **red** means a seed that should exist does not |
| `bootstrap (x86_64-linux)` | Ubuntu | builds `self/` with that seed, which is the only thing that checks WP19's rolling freeze. One row per seed that exists, so a platform with no seed has no row rather than a green one |
| `lint` | Ubuntu | `npm run lint --if-present` (a no-op until `package.json` defines `lint`) |

`.github/workflows/parity.yml` is the fourth job and does not run here: WP19
G1's corpus half is nightly, on its own workflow, for the reasons under
[the parity run](#the-parity-run-nightly) below.

**The macOS `test` row was run for the first time on 2026-09-13, and it fails.**
That is new information rather than a guess, and it replaces the cost argument
that used to stand here: `npm test` on `macos-latest` reports **five failures in
four families**, none of them a compiler bug and all of them checks that encode
an ELF/Linux assumption.

| | What fails | Why |
| --- | --- | --- |
| 1, 2 | `llvm-dwarfdump` finds an empty `.debug_line` in the linked binary | On Mach-O `clang -g` leaves DWARF in the `.o` files; the executable carries a debug map and `dsymutil` is what produces a line table. Two checks read the executable |
| 3 | `--threads` IR **links** against a runtime built without `-DNISH_THREADS`, exit 0 | ELF refuses a TLS symbol against a non-TLS definition and ld64 does not. The safety net `build.sh`'s header describes does not exist on macOS — a finding about the platform, not about the check |
| 4, 5 | `stage3 == stage2` as files, at *identical size* (597,048 bytes both) | Every IR equality passes, so the compiler is deterministic and the linker is not: Mach-O's debug map records each `.o`'s path and mtime, which differ between two links |

The fourth family reaches further than this job: `scripts/bootstrap.sh --verify`
asserts the same `stage3 == stage2` comparison, so it also stands between the
release workflow and a **darwin binary**
([G5](wp19-stage0-retirement.md#g5--distribution-does-not-need-node)).

Restoring the row therefore means porting four checks against hardware that has
to be iterated on, which is a package of its own rather than a line in the
matrix. The install half is already written and was exercised by that run: both
"Install LLVM 18 + lld" steps in the `test` job are guarded by `runner.os`, so
restoring the row is one uncommented line plus the five fixes.

The two defects the row was waiting for before this are both bash 3.2,
which macOS ships as
`/bin/bash` (Apple will not ship GPLv3) and which this repository's shell
scripts had been written against:

- `scripts/build.sh` runs under `set -euo pipefail`, and in bash 3.2
  expanding an empty array as `"${arr[@]}"` while `set -u` is on raises
  *unbound variable* — bash 4.4 made it legal. `pgo`, `elf`, `strip_flag` and
  `libs` are all legitimately empty on the ordinary macOS path, so every
  `--link` at the `speed`, `size` and `napi` profiles died at
  `scripts/build.sh: line 96: pgo[@]: unbound variable`, before clang was
  reached. The nine sites spell it `${arr[@]+"${arr[@]}"}` now.
- `scripts/smoke.sh` collected its program list with `mapfile`, a bash 4
  builtin that bash 3.2 does not have at all, so the smoke step died on the
  first line that used it. It reads the same pipeline with `while read` now.

Neither stops the row now, and neither is what the five failures above are.

### The seeded build, and what a missing seed reports

`bootstrap` builds `self/` with the **last released** binary rather than with
stage0, which is the only thing that checks WP19's rolling freeze
([G3](wp19-stage0-retirement.md#g3--the-seed-protocol-exists-and-ci-uses-it)).

**There are three answers and only two colours, so the freeze is a pair of
jobs.** `seeds` asks the last release which seed binaries it attaches — it
needs `gh` and the checkout, no Node and no LLVM, so it answers in seconds
rather than after two minutes of setup it may be about to throw away — and
`bootstrap` is a **matrix over that answer**, one row per seed that actually
exists. A platform with no seed therefore has no row, rather than a green one
with a warning inside it. Read the pair:

| The checks list says | It means |
| --- | --- |
| `seeds` green, a `bootstrap (<seed>)` row green | the freeze was checked with that seed, on that seed's own platform, and it held |
| `seeds` green, no row for a platform | the freeze was *not* checked there, and nothing is wrong: no release carries a seed for it yet. The `seeds` summary names every platform in both states |
| `seeds` green, `bootstrap` **skipped** | the same for every platform at once: there is no release at all |
| `seeds` **red** | a seed that should exist does not — a release missing an asset `release.yml` attaches |
| a `bootstrap` row **red** | `self/` does not build with the last release. That is the rolling freeze broken, and it is what this pair exists to catch |

An absent row, and a grey job where there is nothing at all, are the
distinctions the gate could not draw while it was one job. It has now been
wrong in both directions. It first named the asset it wanted, warned, and
exited 0 — and a warning above a green check is a green check, which is
precisely the shape
[§A5](wp19-stage0-retirement.md#a5-the-gate-reopened-and-the-correction-a4-needed)
is the written record of. The correction for that made every missing seed red,
which is the opposite error: `release.yml`'s `release` job is `needs: ci`, so a
repository with no release — the 0.1.0 base case
([wp12-release.md](wp12-release.md#release-procedure)), and every fork on the
day it is forked — could never cut the release that would supply the seed the
gate was waiting for.

**Which missing seed is red is decided by platform, and the list is data.**
[`.github/seed-targets.json`](../.github/seed-targets.json) carries all four of
G5's platforms, the canonical triple each one is, the asset name derived from
it, and whether `release.yml` attaches it today. So:

- **no release at all** — nothing to check the freeze against and nothing
  wrong. No rows, `bootstrap` skipped, `seeds` green and saying so.
- **a release with no asset for a platform marked `attached`** (`x86_64-linux`
  today) — a regression in `release.yml` or in the asset name the two workflows
  share. Red, and the annotation says how to get unstuck: attach the asset, or
  delete the release, before cutting another.
- **a release with no asset for a platform nothing builds for yet** (darwin and
  `aarch64-linux`, until
  [G5](wp19-stage0-retirement.md#g5--distribution-does-not-need-node)) —
  expected. No row for it, and the `seeds` summary lists it as unchecked.

The one thing this pair may not do is report success without having built
anything, and the one thing it may not do now is be red for a state in which
nothing is wrong.

**The lookup is a file, and `npm test` runs it.** `.github/seed-matrix.sh` is
the step body, and the WP19 block of `tests/run.js` drives it against a
stand-in for `gh` through each of those states — the seed present, the
`attached` seed missing (exit 1 with an `::error::`), no release at all, and a
seed appearing for a platform that had none. Both times this logic was got
wrong it was inline shell in a workflow that nothing could run; the checks are
what make the third revision of it the last one that needs a reviewer to catch
a regression.

`.github/seed-targets.json` is also where the *asset name* is spelled, once.
`release.yml` looks its own up rather than writing it out, and the same block
of `tests/run.js` checks every row against the compiler's own target table:
that each `triple` is one `src/codegen/target.ts` calls canonical, and that
each `asset` is that triple with the vendor and the ABI dropped
(`x86_64-unknown-linux-gnu` → `x86_64-linux`, `aarch64-apple-darwin` →
`aarch64-darwin`). The four spellings used to live in two comments calling each
other a contract, and two of them — `aarch64-darwin` and `x86_64-darwin` — were
described as triples the compiler accepts, which it never has.

G3 asks for this on **both** operating systems and it runs on Linux alone,
because a release attaches `x86_64-linux` and nothing else. Two things have to
land before the second platform: the darwin **seed**, which is
[G5](wp19-stage0-retirement.md#g5--distribution-does-not-need-node), and the
**ld64 fixed point** — the fourth family in the table above, which is the
comparison `scripts/bootstrap.sh --verify` makes, and which now carries a note
at the comparison itself saying what was measured. A macOS row that arrived
before that was fixed would be red on the day its seed did, which is the other
way a gate lies about itself. Neither is a line in `ci.yml`: the matrix is the
release's answer, so the row appears when the seed does.


### The parity run, nightly

`.github/workflows/parity.yml` runs `node tests/run.js --parity` on a
`schedule:` at 06:17 UTC, and on `workflow_dispatch` with an optional `only`
filter. It is the corpus half of WP19 G1: every program in the corpus through
both compilers under all fifteen flag variations, comparing exit status,
stdout, stderr and every file written.

It is a workflow of its own rather than a step in `test` because of what it
costs — roughly 9,000 compilations by each compiler, plus linking a stage1
binary first, which is forty minutes against three for `npm test`. The
flag-set half is the opposite trade and already runs inside `npm test`: two
`--help` runs, seconds, and it is the half that found `--no-warn-performance`
and `--out-dir`.

Nightly rather than on demand because the gate has already reopened once in
the gap between runs, and nobody noticed until it was run by hand
([wp19 §A5](wp19-stage0-retirement.md#a5-the-gate-reopened-and-the-correction-a4-needed)).
The job writes its summary line into the run summary with the date, because
that number is a fact about the corpus on the day it was measured. A red
result is a gate, not a flake.

Both `test` jobs need the plain tool names `clang`, `llc`, `llvm-as`, `opt`,
`ld.lld` and `wasm-ld` on `PATH`, because `tests/run.js` and the scripts
probe for exactly those:

- Ubuntu installs the versioned Debian binaries (`clang-18`, `llc-18`, ...)
  and symlinks them under `$RUNNER_TEMP/llvm-bin`, which is prepended to
  `PATH` via `$GITHUB_PATH`. This wins over whatever `/usr/bin/clang` the
  runner image ships.
- macOS prepends `$(brew --prefix llvm@18)/bin`. Homebrew's `llvm@18` bundles
  lld (including `wasm-ld`); the workflow installs the standalone `lld`
  formula only if that ever stops being true, because `lld` pulls in the
  newest LLVM as a dependency.

After the tests, the job compiles `examples/add.ts`, runs
`scripts/size-report.sh --markdown`, and appends the table to the job summary
so the size of every profile (`debug`, `speed`, `size`, `wasm`) is visible on
the run page for each OS. A `concurrency` group cancels superseded runs of
the same branch.

## Running the same steps locally

```bash
# Ubuntu / Debian
sudo apt-get install -y clang-18 lld-18 llvm-18
# then either update-alternatives or a symlink dir, e.g.
mkdir -p ~/.local/llvm-bin
for t in clang clang++ llc llvm-as opt ld.lld wasm-ld; do ln -sf /usr/bin/$t-18 ~/.local/llvm-bin/$t; done
export PATH=~/.local/llvm-bin:$PATH

# macOS
brew install llvm@18
export PATH="$(brew --prefix llvm@18)/bin:$PATH"

npm ci
npm run check           # tsc --noEmit
npm test                # build + tests/run.js (goldens, llvm-as, native, runtime, size, wasm)
npm run lint            # only if package.json defines it
npm run size-report     # the plain table; add --markdown via scripts/size-report.sh
```

`scripts/build.sh` and `scripts/size-report.sh` branch on `uname`: on macOS
they use ld64's `-dead_strip` / `-x` instead of `--gc-sections` / `-s`, skip
`-fuse-ld=lld` and `-fno-plt`, and strip the padding macOS `wc -c` adds. The
`wasm` profile asks `clang -print-prog-name=wasm-ld` where the linker is, so a
Homebrew LLVM works even when its bin dir is not on `PATH`; when no `wasm-ld`
exists the size report omits the row and `build.sh --profile wasm` exits 2
with a message.

## Diagnostic format

Every error the compiler reports, whether from the parser or the checker, is a
`CompileError` (`src/diagnostics.ts`) and is printed to stderr in this shape:

```
tests/cases/reject_type_mismatch.ts:1:40: error: Operator `+` requires two operands of the same numeric type, got i32 and boolean
  1 | function f(a: number): number { return a + true; }
    |                                        ^~~~~~~~
```

- Line 1 is the summary: `<file>:<line>:<col>: error: <message>`, with 1-based
  line and column of the start of the offending node. This line is unchanged
  from earlier releases, so tests that match a substring of it keep passing.
- Line 2 is the source line, prefixed with the line number and ` | `.
- Line 3 is the caret line: `^` under the node's start column, then `~` up to
  the end of the node's text on that line (a node that spans several lines is
  marked only on its first line). Tabs in the source are reproduced in the
  caret line so the markers stay aligned in a terminal.

Syntax errors from the TypeScript parser use the same layout with the
`syntax error:` prefix (`StaticSyntaxError`, a `CompileError` subclass):

```
build/test/diag_syntax.ts:2:10: syntax error: ':' expected.
  2 |   return 1;
    |          ^
```

The `CompileError` object exposes `file`, `line`, `column`, `summary` (the
first line) and `excerpt` (the two excerpt lines) for tooling that wants the
parts separately; `message` is always `summary + "\n" + excerpt`.

Tests for the format live in the `// ---- WP10: diagnostics` block of
`tests/run.js`.

## Multi-error reporting

The compiler no longer stops at the first error. Every phase that can
recover hands its `CompileError`s to one `DiagnosticSink`
(`src/diagnostics.ts`) owned by the `Compilation`:

| Phase | Recovery unit | Where |
| --- | --- | --- |
| Parser | every parse diagnostic of the file | `parseSource` |
| Phase 0 validator | every forbidden construct (a rejected node's subtree is skipped, so `Array<any>` is one error) | `validateNish` |
| Pass 1 (signatures) | per declaration: class/interface (marked `poisoned`, its layout checks skipped), import, function signature, module resolution | `Checker.collectSignatures`, `Compilation.load` |
| Pass 1b/1c | per import binding; every symbol clash | `Checker.bindImports`, `Compilation.rejectSymbolClashes` |
| Pass 2 (bodies) | per statement, at the innermost statement list; the enclosing function is marked `poisoned` and its definite-return check is skipped | `checkStatements` |

Between phases `DiagnosticSink.throwIfErrors` sorts what was collected (files
in load order, then line and column), throws the first error as a plain
`CompileError` and attaches the rest as `error.additional`. So a caller that
only knows single errors (`compileToIR`, older tests) still gets exactly the
message it always got, pass 2 never runs over broken signatures, and the
emitter never sees a poisoned function.

The driver prints `formatErrorReport`: each error's summary and excerpt, at
most 20 (`MAX_REPORTED_ERRORS`) before `...and N more errors`, then an
`N errors` line. A lone error prints exactly its message, as before. To
limit cascades, `let x: T = <rejected>` still declares `x` as `T`, and
unreachable code is reported once per statement list.

Tests: `tests/cases/reject_multi_error` (three body errors), `reject_multi_forbidden`
(three Phase 0 errors), `reject_multi_decl` (three declaration errors). A
`.err` golden may now hold several lines, each a fragment that must appear.

## `--json`

`nish --json file.ts` prints one JSON object per error on stdout, nothing
else on stdout and nothing on stderr, with the same exit code:

```
{"file":"tests/cases/reject_multi_error.ts","line":2,"column":10,"endLine":2,"endColumn":18,"severity":"error","code":"NL2231","message":"Operator `+` requires two operands of the same numeric type or two strings, got i32 and boolean"}
```

`line`/`column` are 1-based, `endLine`/`endColumn` exclusive. `severity` was
always `"error"` here; since WP15 §8 it is `"error"` for every error and
`"performance"` for a performance warning, which is the field a tool filters
on. Syntax errors keep the `syntax error: ` prefix in `message`.

### `code`

`code` is the stable identifier for the rule that was broken, and it is the
field to key on: the prose in `message` is allowed to improve between releases
and the code is not. The registry is `src/codes.ts` and its stage1 twin
`self/codes.ts`, both generated by `scripts/gen-diagnostic-codes.mjs` from the
compiler's own diagnostic sites, so a diagnostic added without a code fails
`npm test` rather than shipping. The generator only ever appends numbers, and a
retired rule keeps its number reserved.

The band says which phase refused the program:

| Band | Meaning |
| --- | --- |
| `NL0000` | no rule matched this message yet (see the backlog below) |
| `NL0001` | a syntax error; the text is the `typescript` package's, so all of them share one code |
| `NL0002` | the C toolchain `--link` needs could not be used (exit 3) |
| `NL0003` | an internal compiler error (exit 70) |
| `NL1xxx` | Phase 0, the forbidden-syntax sweep (`src/validator.ts`) |
| `NL2xxx` | the checker: signatures, bodies, types |
| `NL3xxx` | the driver and module loading |
| `NL4xxx` | the interop sidecar generators |
| `NL9xxx` | a WP15 §8 performance warning |

A code is matched against the longest literal run of the message's template —
the rule stated in words, with the interpolated names, types and counts
removed. A handful of messages are built entirely out of interpolations
(`` `${fn}` expects ${a}, got ${b} ``) and have no run long enough to identify
a rule; those report `NL0000`. `tests/run.js` pins how many there are, so the
backlog can shrink but not grow. Giving one a code is a matter of giving the
message words of its own, not of editing the table.

Codes appear in `--json` only. The human summary line
`file:line:col: error: <text>` is unchanged, because the `.err` goldens and
`tests/self/reject_oracle.js` match on it byte for byte.

### Failures without a source position

Every failure is a parseable line under `--json`, not just the ones with a
span, so a wrapper that asked for JSON is never left with an empty stdout and
an exit code to guess about:

```
{"severity":"error","code":"NL0002","message":"--link: no usable C compiler found (...)"}
{"severity":"error","code":"NL0003","message":"internal compiler error while compiling a.ts: ..."}
```

A driver error (a bad `-o` layout, an unreadable input) has the same shape and
takes whatever code the registry resolves for its text, or `NL0000`. The human
report still goes to stderr in the internal-error case, because a crash is
worth seeing twice.

## `--emit-ast` and `--emit-checked`

Both write to stdout instead of IR (`src/dump.ts`); file names are printed
relative to the working directory.

- `--emit-ast`: the syntax tree of every module after Phase 0, one node per
  line, `<SyntaxKind> <line:col>-<line:col>` (start without trivia, end
  exclusive) with identifier and literal text appended. Token kinds use their
  real names (`EqualsToken`, not `FirstAssignment`).
- `--emit-checked`: after every checker pass and the attribute analysis: per
  module `struct` lines (kind, size, align, fields with index and byte offset,
  `readonly`/`initialized`, constructor and method symbols), `import` lines,
  and `function` lines (resolved signature, `@symbol`, `[exported]`
  `[method]` `[constructor]` `[entry]`), each followed by its `facts:`
  (effect, willReturn, loops, ...), `pointer <param>:` facts, and `local` /
  `callee` lines in source order.

Goldens: `tests/cases/dump_ast.stdout`, `tests/cases/dump_checked.stdout`
(`tests/run.js` compares stdout when a `.stdout` sidecar exists).

## `-g` debug info

`src/codegen/debug.ts` builds the DWARF metadata; `IRFunction` gained a
`subprogram` (`define ... !dbg !N`) and a current location that `emit`
appends as `, !dbg !N`, set by the emitter around every statement and
expression and restored afterwards. Emitted: `!llvm.dbg.cu`, the
`Dwarf Version`/`Debug Info Version` module flags, a `DICompileUnit`
(`DW_LANG_C99`, producer `nish <version>`), a `DIFile` per source file a
declaration comes from (name as given, directory `.`), one `distinct
DISubprogram` per function (methods are
`Owner.method`; the `@main` wrapper is an artificial `main` at the user's
`main`), `DILocation`s, `llvm.dbg.value` for parameters, `llvm.dbg.declare`
for `let`/`const` and `for (const x of a)` slots. Types: `int`, `long`,
`double`, `bool`, `char*`, struct pointers to `DICompositeType`s with the
checker's offsets, array pointers to `{ long len; long cap; T* data; }`.

The directory is `.` rather than the working directory, which is what clang's
`-fdebug-compilation-dir=.` writes: a `-g` build then depends only on the
command line, so it is reproducible across machines, and stage1 — which has no
`process.cwd()` to ask for and no runtime budget to grow one (WP14 D4) — emits
the same bytes. A class reached through an import is described against *its
own* `DIFile` and line numbers rather than the importing module's, which is why
there is more than one `DIFile` in a program with imports
(`tests/link/reachable_struct`).

A function's own position — the `DISubprogram`'s `line` and `scopeLine`, its
parameters' `DILocalVariable`s, and the `DILocation` the prologue and any
untied instruction carry — is where the **declaration** starts: `export`, or
`const`, or `function`. Not the arrow. stage0 used to read it off the
`ArrowFunction`, whose own start is its parameter list, which put the same
function at two different positions depending on which of WP22's two spellings
declared it and named the wrong line whenever the arrow sat below its `const`;
`FunctionSig.declSite` is the node the checker records for it now
(`tests/cases/dbg_arrow`, `docs/wp19-stage0-retirement.md` §A5). Stage1 never
had the bug, because its parser normalises both spellings into one node that
spans the declaration.

A `DILocation` column is a **byte** offset into its line, plus one — what
`clang -g` writes and what a debugger reads it back against. stage0 used to
count the UTF-16 code units the `typescript` API hands it, which differs from
stage1's byte count for every position after a non-ASCII character on the same
line (`tests/cases/dbg_utf8`). Diagnostic columns are a separate question and
are still code units on stage0: the consumer there is an editor.

**Both compilers emit it.** `self/debug.ts` is the stage1 port, `-g` is a flag
of `self/compile.ts` as it is of `src/index.ts`, and `tests/self/ir_oracle.js`
compares the two byte for byte, metadata numbering included.

`--link -g` passes `-g` to `scripts/build.sh`, which adds `-g` for every
input (so `runtime.c` has symbols too) and drops the strip flag of the
speed/size/napi profiles. Without `-g` the IR is byte-identical (every golden
is unchanged). `tests/cases/dbg_locals` is the `-g` golden (the harness
replaces the repository path with `<root>`); the `-g` block of `tests/run.js`
verifies it with `opt -passes=verify`, links a program with
`--profile debug` and with the speed profile, and checks that
`llvm-dwarfdump --debug-line` (or `objdump --dwarf=decodedline`) lists the
`.ts` file with at least one row, printing a visible `SKIP` when neither
tool exists.
