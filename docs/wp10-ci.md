# WP10: CI and diagnostics

This page covers the GitHub Actions workflow, how to reproduce it on a
workstation, and the format every compile error is printed in.

## CI matrix

`.github/workflows/ci.yml` runs on every push and pull request.

| Job | Runner | Steps |
| --- | --- | --- |
| `test (ubuntu-latest)` | Ubuntu, LLVM 18 from apt (`clang-18 lld-18 llvm-18`) | `npm ci`, `npm run check`, `npm test`, size report |
| `test (macos-latest)` | macOS (Apple Silicon), Homebrew `llvm@18` | same |
| `lint` | Ubuntu | `npm run lint --if-present` (a no-op until `package.json` defines `lint`) |

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

## Not in this part of WP10

Multi-error reporting, `--json` diagnostics, `--emit-ast` / `--emit-checked`
dumps and `!dbg` debug info are listed under WP10 in `docs/MASTER_PLAN.md`
and are left for a follow-up; the excerpt formatter above is written so that
a collected-diagnostics mode can reuse `formatDiagnostic` per error.
