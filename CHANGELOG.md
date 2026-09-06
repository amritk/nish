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
- **Classes and interfaces.** `class` / `interface` as `%struct.<Name>` with
  clang-identical layout (verified against C `_Static_assert`s at test time),
  constructors, methods (`this` as the first parameter), field reads and
  writes, object literals, structural `implements`, `export class` across
  modules, and struct-pointer attributes (`nonnull`, `dereferenceable`,
  `readonly` / `nocapture` by a whole-program escape fixpoint).
- **Differential testing.** `npm run test:diff` compiles every whole program
  in `tests/cases` and a 50-program corpus, runs the same TypeScript under
  Node through `runtime/shim.mjs` with i32-wrapping rewrites, and compares
  stdout and exit codes byte for byte; a seeded expression fuzzer runs 10
  programs in `npm test` and 200 on demand. Known semantic gaps are listed in
  `tests/differential/known-failures.txt`.
- **Examples.** `examples/nbody.ts` (classes, arrays, `Math` in f64 mode)
  prints the reference energies and is covered by `npm run smoke`.
- **Checked integer division.** `/` and `%` on `i32` / `i64` panic with
  "attempt to divide by zero" / "attempt to divide with overflow" (exit 1)
  instead of executing an `sdiv` / `srem` whose result is poison, matching
  Rust. `Math.pow` follows ECMAScript for `pow(x, NaN)` and `pow(±1, ±Infinity)`.
  Ordering comparisons are numeric only; `?.` and `??` are rejected by the
  validator; the literal `-2147483648` is accepted.
- **Optimisation flags and benchmarks.** `--target <triple>|host` emits
  `target datalayout` / `target triple`; `--nsw` makes signed overflow
  undefined for extra optimisation; array parameters carry
  `dereferenceable(24)`; `scripts/build.sh --pgo-generate` / `--pgo-use`.
  `bench/` holds fib, nbody, spectral-norm, sieve, string building and a
  struct-heavy loop in StaticTS, C and Rust with a checksum-validated runner
  (`node bench/run.mjs`) that writes `docs/BENCHMARKS.md`.
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
- **Documentation.** `docs/LANGUAGE.md` (the normative reference, every rule
  cited to a test case), `docs/IR_COOKBOOK.md` (generated from
  `docs/cookbook/*.ts` by `docs/cookbook/regen.sh`), `docs/ARCHITECTURE.md`,
  `docs/FAQ.md`, the `docs/README.md` index, `docs/check-links.mjs`, and a
  README restructured into a short tour.

[Unreleased]: https://github.com/amritk/compiler/compare/v0.1.0...HEAD
- **Memory strategy (WP6).** Escape-analysed stack allocation: a `new`,
  object literal, array literal or `new Array<T>(<literal>)` that provably
  does not outlive its function becomes an entry-block `alloca`
  (`--no-stack-alloc` disables it). Automatic arena scopes: a function whose
  arena temporaries all die with it brackets its body with the new
  `sts_arena_mark` / `sts_arena_release` runtime calls, so hot loops keep the
  arena flat. `Arena.reset` / `mark` / `release` / `used` builtins, and
  `T | null` for class, interface, array and string types with checker-
  enforced narrowing (`if (p !== null)`, early return, `while`, `&&`, `?:`).
  See [docs/wp6-memory.md](docs/wp6-memory.md).