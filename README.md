# StaticTS

An ahead-of-time compiler for a strictly static subset of TypeScript. It
parses source with the official TypeScript compiler API, rejects everything
dynamic (`any`, prototypes, `eval`, exceptions, a garbage collector), and
emits textual LLVM IR (`.ll`). LLVM's own toolchain (`clang` / `llc`) then
optimises and produces native binaries for x86_64, ARM64, or WebAssembly.

```
TypeScript source ──▶ TS AST ──▶ validator + checker ──▶ LLVM IR (.ll) ──▶ clang/llc ──▶ native binary
                     (typescript)      (src/)             (src/codegen/)        + runtime/runtime.c
```

If it compiles, every value has one fixed, known memory layout; binaries are
a few kilobytes; there is no interpreter and no GC anywhere in the pipeline.

## Quickstart

Requirements: Node.js 18+ and, to produce binaries, clang (LLVM 18) + lld;
per-OS install commands are in [docs/INSTALL.md](docs/INSTALL.md).

```bash
npm install -g statictsc          # or: git clone, npm install, npm run build, node dist/index.js ...
```

`hello.ts`:

```ts
export function main(): number {
  console.log("hello from StaticTS");
  return 0;                          // the process exit code
}
```

```bash
statictsc hello.ts --link hello    # writes hello.ll, then builds hello with clang -O3 -flto
./hello                            # hello from StaticTS
statictsc hello.ts -o hello.ll     # IR only
```

The IR is readable as is. `examples/add.ts` compiles to:

```llvm
define noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = add i32 %a, %b
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```

`--plain` drops the attributes and alignment hints and leaves
`define i32 @add(i32 %a, i32 %b)` with the same body. Every construct's IR
is in [docs/IR_COOKBOOK.md](docs/IR_COOKBOOK.md).

## The language

The full reference is [docs/LANGUAGE.md](docs/LANGUAGE.md); every rule
there cites the test case that proves it.

| Feature | Summary | Reference |
| --- | --- | --- |
| Types | `number` (`i32` by default, `double` with `--number-mode f64`), `i32`, `i64`, `f64`, `boolean`, `string`, `T[]`, classes, interfaces, `void`; 1:1 LLVM mapping, no implicit conversions | [Types](docs/LANGUAGE.md#types) |
| Functions and modules | annotated signatures, calls in any order, `export`/named relative `import`, whole-program attribute facts, `export function main` as the entry, `--strict-exports` | [Declarations](docs/LANGUAGE.md#declarations) |
| Control flow | `if`/`else`, `while`, `do`, `for`, `for...of`, `break`/`continue`, `throw` (aborts), boolean-only conditions, definite return, unreachable-code errors | [Statements](docs/LANGUAGE.md#statements) |
| Expressions | `+ - * / %`, comparisons, `=== !==` (strings by content), `&& \|\|`, `?:`, `op=`, `++`/`--`, template literals, contextual numeric literals | [Expressions](docs/LANGUAGE.md#expressions) |
| Strings | immutable UTF-8 (`.length` is the byte length), literals as constant data, `+`, `===`, templates, `console.log` | [Builtins](docs/LANGUAGE.md#builtins), [Semantics](docs/LANGUAGE.md#semantics-decisions) |
| Arrays | `T[]` with one element type, literals, `new Array<T>(n)` zero-filled, bounds-checked `a[i]` (panic, or `--unchecked-indexing`), `.length`, `push`, `for...of` | [Arrays](docs/LANGUAGE.md#array-literals) |
| Classes and interfaces | LLVM structs with clang's layout, constructors, methods, `readonly`, definite assignment, object literals, `implements` by identical layout | [Classes](docs/LANGUAGE.md#classes) |
| Builtins | `console.log`, `Math.*` as LLVM intrinsics, `Math.random`, `toI32`/`toI64`/`toF64`, `process.exit`, `readFileSync`/`writeFileSync`/`appendFileSync` | [Builtins](docs/LANGUAGE.md#builtins) |
| Rejected | `any`, `unknown`, `var`, `==`, generics, `async`, `try`, `typeof`, `delete`, prototypes, `Object.assign`, string-keyed access, ... with exact messages | [Forbidden constructs](docs/LANGUAGE.md#forbidden-constructs-phase-0-validator) |

Semantics that differ from JavaScript on purpose: integers wrap (no `nsw`),
`.length` counts bytes, `throw` aborts instead of unwinding, `toI32`
saturates, `Math.min`/`max` take two arguments. The reasons are in the
[FAQ](docs/FAQ.md).

## Command line

```
statictsc <entry.ts> [more.ts ...] [options]
  -o, --output <file.ll>     output path for a single module (default: <input>.ll)
  -o, --output <dir>/        output directory: one <dir>/<module>.ll per module
  --link <exe>               build a native binary from every module + runtime/runtime.c
  --profile speed|size|debug build profile for --link (default: speed)
  --strict-exports           non-exported functions get `internal` linkage
  --number-mode i32|f64      lowering of `number` (default: i32)
  --plain                    no performance attributes or alignment hints
  --runtime-decls            always emit the runtime ABI prelude (arena + strings)
  --emit-header <file.h>     also write a C header for the callable functions
  --emit-dts <file.d.ts>     also write TypeScript declarations for the wasm exports
  --emit-napi <shim.c>       also write an N-API shim (build with --profile napi)
  --unchecked-indexing       drop array bounds checks (unsafe; for benchmarks)
  -v, --version              print the version and exit
```

Exit codes: `0` success, `1` compile error (`file:line:col: error: ...` plus
a caret excerpt), `2` usage error, `3` toolchain error, `70` internal
compiler error (please report it; `STATICTSC_DEBUG=1` adds the stack trace).
Multi-file programs: `statictsc examples/multi/main.ts --link build/multi && ./build/multi; echo $?`
prints `49`.

Without `--link`, build the IR yourself: `clang add.ll examples/main.c runtime/runtime.c -o app`
(the `overriding the module target triple` warning is harmless: the IR is
target-neutral; `-Wno-override-module` silences it), or step by step with
`llvm-as`, `llc -O2 -filetype=obj`,
and `opt -S -O2` to watch `mem2reg` turn the `alloca` locals into
registers. Cross-compile with `llc -mtriple=wasm32-unknown-unknown` or
`-mtriple=aarch64-linux-gnu`.

## Performance and binary size

Rust-class output is the goal: no GC, no embedded engine, aliasing and
purity facts handed to LLVM up front, and a link step that strips everything
unused. `examples/add.ts` + `examples/main.c` + `runtime/runtime.c`, x86_64
Linux, glibc dynamically linked (`npm run size-report`):

| Profile | Bytes | What it does |
| --- | ---: | --- |
| `debug` | 14,264 | `clang` defaults: no optimisation, symbols kept. |
| `speed` | 4,528 | `-O3 -flto`, section GC, unwind tables off, stripped. Rust `--release`. |
| `size` | 4,512 | `-Oz -flto`, plus hidden visibility and no stack protector. Rust `opt-level="z"`. |
| `wasm` | 279 | Freestanding `wasm32` module, every function exported, stripped. |

`hello.ts` with `--link` is 4,696 bytes. The whole runtime is about 3 KB of
machine code (`runtime.c`: one chunked bump arena with O(1) reset, strings,
JavaScript-exact number formatting, `Math.random`, exit, files, array
growth); allocation is inlined as a load, an add, a compare and a store;
`Math.*` calls are LLVM intrinsics, so pure functions stay `readnone`.
`fib(35)` compiled from StaticTS runs within measurement noise of the same
C (0.030 s vs 0.030 s, [docs/wp1-control-flow.md](docs/wp1-control-flow.md#the-willreturn-rule)),
and `opt -O2` vectorises the summation loops in the test suite.

Every LLVM attribute the compiler emits (`nounwind`, `willreturn`,
`readnone`/`readonly`, `noundef`, `zeroext`, `nonnull`, `noalias`,
`nocapture`, `dereferenceable`) is a proved guarantee, never a hint; the
rules are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#attribute-soundness-rules).
Integer arithmetic is emitted without `nsw`, so overflow wraps as in Rust
release builds.

A benchmark table against C and Rust is coming with WP9 in
`docs/BENCHMARKS.md` (not yet written).

## Interop: export, do not embed

StaticTS never embeds a JavaScript engine (see the [FAQ](docs/FAQ.md#why-not-embed-a-javascript-engine-for-npm-packages)).
The supported direction is Node importing StaticTS:

```
[ Node / Bun process ]  imports  [ StaticTS .wasm or .node addon ]
  I/O, HTTP, npm packages          math, parsing, data transforms, hot loops
                 cross the boundary once per batch, not once per element
```

- `scripts/build.sh --profile wasm` produces a module `WebAssembly.instantiate`
  loads directly (`examples/node-host.mjs`); exports use the plain C ABI.
- `--emit-napi` + `scripts/build.sh --profile napi` build a `.node` addon
  with argument type checks (`examples/node-addon.mjs`).
- `--emit-header` writes C prototypes (`int32_t add(int32_t a, int32_t b);`)
  next to `runtime/statictsc.h`, the public runtime ABI; `--emit-dts` writes
  typings for the wasm exports.
- An N-API call costs about 40 ns and a wasm call about 3 ns before any work
  is done (`node bench/ffi.mjs`), so pass whole buffers, not elements.

Details: [docs/wp8-interop.md](docs/wp8-interop.md).

## Project status

| Milestone | Contents | State |
| --- | --- | --- |
| M1 "Programs" | pipeline prep, validator, control flow, strings, modules, CI | done |
| M2 "Data" | classes and interfaces, arrays, runtime and intrinsics | done |
| M3 "Rust parity" | interop (done); memory strategy (WP6), benchmarks and `--target`/`--nsw` (WP9), differential testing (WP13) | in progress |
| M4 "1.0" | inheritance (WP2b), frozen language reference, tagged release | next |

Release engineering (`--version`, exit codes, npm packaging, tag-driven
releases) landed with WP12; see [CHANGELOG.md](CHANGELOG.md) and
[docs/wp12-release.md](docs/wp12-release.md). Further out: optional
reference counting for objects that must outlive an arena reset, `--target`
cross builds (ARM64, wasm with WASI), and an `llvm-bindings` backend as an
alternative to text emission. The plan itself is
[docs/MASTER_PLAN.md](docs/MASTER_PLAN.md).

## Contributing

```bash
npm install
npm test                 # build + goldens, llvm-as, native round trips, runtime, layout, interop (466 checks)
node tests/run.js locals # only cases whose name contains "locals"
npm run test:update      # write missing .ll goldens for new cases
npm run check            # tsc --noEmit
npm run lint             # Biome style lint (advisory, never a compile gate)
npm run smoke            # build and run every example with a main
docs/cookbook/regen.sh   # refresh docs/IR_COOKBOOK.md; node docs/check-links.mjs checks the links
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (the pipeline, side tables,
the add-a-construct checklist, ABI guard tests) and the conventions in
[docs/MASTER_PLAN.md §7](docs/MASTER_PLAN.md#7-conventions-for-every-agent):
every construct ships with a golden `.ll`, an `llvm-as` pass, a native round
trip, a negative test, and its LANGUAGE.md and cookbook entries; no attribute
without a proof; layout changes touch `runtime.ts` and `runtime.c` together.
CI runs the suite on Ubuntu and macOS with LLVM 18
([docs/wp10-ci.md](docs/wp10-ci.md)). The documentation index is
[docs/README.md](docs/README.md).

## License

MIT, see [LICENSE](LICENSE).
