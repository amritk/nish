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
| `test (macos-latest)` | macOS (Apple Silicon), Homebrew `llvm@18` | **commented out of the matrix**, see below |
| `lint` | Ubuntu | `npm run lint --if-present` (a no-op until `package.json` defines `lint`) |

**The macOS job is disabled for now.** It is not a compiler failure and not an
architecture one: `scripts/build.sh` runs under `set -euo pipefail`, and macOS
ships bash 3.2 as `/bin/bash` (Apple will not ship GPLv3), where expanding an
empty array as `"${arr[@]}"` while `set -u` is on raises *unbound variable*.
bash 4.4 made that expansion legal, which is why every Linux runner passes and
every macOS one fails at

```
scripts/build.sh: line 96: pgo[@]: unbound variable
```

`pgo`, `elf`, `strip_flag` and `libs` are all legitimately empty on the
ordinary macOS path, so every `--link` at the `speed`, `size` and `napi`
profiles dies before clang is reached. The fix is `${arr[@]+"${arr[@]}"}` at
the nine sites that expand them; the matrix line in `ci.yml` carries the same
note and is restored in the same commit. Until then macOS is untested here,
and what that costs is the ld64 / Mach-O half of `build.sh` — `-dead_strip`,
`-Wl,-x`, no `-fuse-ld=lld`, no `-fno-plt` — which no Linux runner exercises
at any architecture.

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
| Phase 0 validator | every forbidden construct (a rejected node's subtree is skipped, so `Array<any>` is one error) | `validateAmritScript` |
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

`amritc --json file.ts` prints one JSON object per error on stdout, nothing
else on stdout and nothing on stderr, with the same exit code:

```
{"file":"tests/cases/reject_multi_error.ts","line":2,"column":10,"endLine":2,"endColumn":18,"severity":"error","code":"AS2231","message":"Operator `+` requires two operands of the same numeric type or two strings, got i32 and boolean"}
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
| `AS0000` | no rule matched this message yet (see the backlog below) |
| `AS0001` | a syntax error; the text is the `typescript` package's, so all of them share one code |
| `AS0002` | the C toolchain `--link` needs could not be used (exit 3) |
| `AS0003` | an internal compiler error (exit 70) |
| `AS1xxx` | Phase 0, the forbidden-syntax sweep (`src/validator.ts`) |
| `AS2xxx` | the checker: signatures, bodies, types |
| `AS3xxx` | the driver and module loading |
| `AS4xxx` | the interop sidecar generators |
| `AS9xxx` | a WP15 §8 performance warning |

A code is matched against the longest literal run of the message's template —
the rule stated in words, with the interpolated names, types and counts
removed. A handful of messages are built entirely out of interpolations
(`` `${fn}` expects ${a}, got ${b} ``) and have no run long enough to identify
a rule; those report `AS0000`. `tests/run.js` pins how many there are, so the
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
{"severity":"error","code":"AS0002","message":"--link: no usable C compiler found (...)"}
{"severity":"error","code":"AS0003","message":"internal compiler error while compiling a.ts: ..."}
```

A driver error (a bad `-o` layout, an unreadable input) has the same shape and
takes whatever code the registry resolves for its text, or `AS0000`. The human
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
(`DW_LANG_C99`, producer `amritc <version>`), a `DIFile` per source file a
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
