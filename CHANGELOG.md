# Changelog

All notable changes to `statictsc` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/). The release procedure (bump,
changelog, tag, workflow) is in [docs/wp12-release.md](docs/wp12-release.md).

## [Unreleased]

### Added

- **Phase 1: basic math.** `function`, `number` (`i32` by default, `f64` with
  `--number-mode f64`), `boolean`, arithmetic, comparisons, locals, calls, and
  exact LLVM IR output (`add(a, b)` compiles to the documented target IR).
  `--plain` drops all performance annotations.
- **Performance pass.** Zero-GC arena runtime (`runtime/runtime.c`),
  Rust-parity LLVM function/parameter attributes (`noundef`, `nounwind`,
  `willreturn`, `readnone`, ...), alignment hints, and the `scripts/build.sh`
  pipeline with `debug` / `speed` / `size` profiles (LTO, section GC, strip).
  `scripts/size-report.sh` prints before/after binary sizes.
- **Phase 0 validator** (`src/validator.ts`). A single syntax-only pass that
  rejects every construct StaticTS can never compile (`any`, `eval`, `with`,
  dynamic property access, ...) in about 2 ms per 1,000 lines, before the
  checker runs. Biome lint/format configuration.
- **Control flow.** `if` / `else`, `while`, `do ... while`, `for`, `break` /
  `continue`, `throw`, the ternary, short-circuit `&&` / `||`, compound
  assignment and `++` / `--`, with termination analysis feeding the
  `willreturn` attribute.
- **Strings.** Arena-allocated immutable `string` (header + UTF-8 bytes),
  literals, `+` concatenation, `===` / `!==`, `.length`, template literals,
  and `console.log`.
- **Modules, entry point, linkage.** `export function` / named relative
  `import`, whole-program compilation with program-wide attribute facts,
  import cycles, `export function main(): number | void` as the process entry
  (its return value is the exit code), `--link <exe>`, `-o <dir>/` for one
  `.ll` per module, and `--strict-exports` for `internal` linkage.
- **Runtime and intrinsics.** `Math.*` as LLVM intrinsics, the `i64` type with
  explicit numeric conversions, `process.exit`, synchronous file I/O, and
  JavaScript-accurate number formatting in the runtime.
- **Interop.** `--emit-header` (C header), `--emit-dts` (TypeScript
  declarations for the wasm exports), `--emit-napi` (N-API shim) plus the
  `napi` and `wasm` build profiles; an FFI benchmark.
- **Arrays.** `T[]` / `Array<T>`, literals, `new Array<T>(n)`, indexing with
  bounds checks (panic on out-of-range), `.length`, `push`, `for ... of`, and
  `--unchecked-indexing` for benchmarks.
- **CI and diagnostics.** GitHub Actions matrix (Ubuntu + macOS, LLVM 18) with
  a size table in the job summary; every error is
  `<file>:<line>:<col>: error: <message>` followed by a caret excerpt.
- **Release engineering.** `--version`; documented exit codes (0 ok, 1 compile
  error, 2 usage, 3 toolchain, 70 internal compiler error, stack trace with
  `STATICTSC_DEBUG=1`); a clear per-platform install hint when `--link` cannot
  find `clang`; `scripts/build.sh` and `runtime/runtime.c` resolved from the
  package root so a global `npm install -g statictsc` works from any
  directory; npm `files` whitelist, `prepublishOnly`, `LICENSE` (MIT);
  `npm run smoke` (`scripts/smoke.sh`) builds and runs every example with a
  `main`; `.github/workflows/release.yml` attaches the npm tarball to a GitHub
  release on `v*` tags; `docs/INSTALL.md`.

[Unreleased]: https://github.com/amritk/compiler/compare/v0.1.0...HEAD
