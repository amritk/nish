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
| Types | `number` (`i32` by default, `double` with `--number-mode f64`), `i32`, `i64`, `f64`, `boolean`, `string`, `T[]`, classes, interfaces, `T \| null`, `void`; 1:1 LLVM mapping, no implicit conversions | [Types](docs/LANGUAGE.md#types) |
| Functions and modules | annotated signatures, calls in any order, `export`/named relative `import`, whole-program attribute facts, `export function main` as the entry, `--strict-exports` | [Declarations](docs/LANGUAGE.md#declarations) |
| Control flow | `if`/`else`, `while`, `do`, `for`, `for...of`, `break`/`continue`, boolean-only conditions, definite return, unreachable-code errors | [Statements](docs/LANGUAGE.md#statements) |
| Expressions | `+ - * / %` (integer `/` and `%` checked: zero divisor or `MIN / -1` panics), numeric-only ordering, `=== !==` (strings by content), `&& \|\|`, `?:`, `op=`, `++`/`--`, template literals, contextual numeric literals | [Expressions](docs/LANGUAGE.md#expressions) |
| Strings | immutable UTF-8 (`.length` is the byte length), literals as constant data, `+`, `===`, templates, `console.log` | [Builtins](docs/LANGUAGE.md#builtins), [Semantics](docs/LANGUAGE.md#semantics-decisions) |
| Arrays | `T[]` with one element type, literals, `new Array<T>(n)` zero-filled, bounds-checked `a[i]` (panic, or `--unchecked-indexing`), `.length`, `push`, `for...of` | [Arrays](docs/LANGUAGE.md#array-literals) |
| Classes and interfaces | LLVM structs with clang's layout, constructors, methods, `readonly`, definite assignment, object literals, `implements` by identical layout | [Classes](docs/LANGUAGE.md#classes) |
| Memory | no GC: objects that provably do not escape their function are stack `alloca`s, functions whose temporaries die with them get an automatic arena scope, `Arena.reset/mark/release/used` for explicit control | [`Arena`](docs/LANGUAGE.md#arena), [Memory](docs/LANGUAGE.md#memory-model) |
| `T \| null` | for class, interface, array and string types; `=== null`, and narrowing to `T` by `if`, early return, `while`, `&&`, `?:`, enforced by the checker | [Nullable types](docs/LANGUAGE.md#nullable-types) |
| Errors | Rust-style `Result<T, E>` with `Ok`/`Err`, `isOk()`/`isErr()`, `orReturn()` (the `?`), `unwrapOr`, `expect`; the checker refuses to let a failure be dropped or the success payload be read before the error is handled. No `throw`, no unwinding | [Result and error handling](docs/LANGUAGE.md#result-and-error-handling) |
| Builtins | `console.log`, `Math.*` as LLVM intrinsics (ECMAScript `pow` corner cases included), `Math.random`, `toI32`/`toI64`/`toF64`, `process.exit`, `readFileSync`/`writeFileSync`/`appendFileSync` | [Builtins](docs/LANGUAGE.md#builtins) |
| Rejected | `any`, `unknown`, `var`, `==`, `?.`, `??`, generics, `async`, `try`, `throw`, `typeof`, `delete`, prototypes, `Object.assign`, string-keyed access, ... with exact messages | [Forbidden constructs](docs/LANGUAGE.md#forbidden-constructs-phase-0-validator) |

Semantics that differ from JavaScript on purpose: integers wrap (no `nsw`
unless you ask for it), integer division by zero panics instead of yielding
`0`, `.length` counts bytes, there is no `throw` and no unwinding, `toI32`
saturates, `Math.min`/`max` take two arguments. The reasons are in the
[FAQ](docs/FAQ.md); [docs/wp13-differential.md](docs/wp13-differential.md)
lists everything the differential test suite found that still differs from
Node.

## Command line

```
statictsc <entry.ts> [more.ts ...] [options]
       statictsc --version | --help
  -o, --output <file.ll>     output path for a single module (default: <input>.ll)
  -o, --output <dir>/        output directory: one <dir>/<module>.ll per module
  --link <exe>               build a native binary from every module + runtime/runtime.c
                             (entry module must declare `export function main`)
  --profile speed|size|debug build profile for --link (default: speed)
  --strict-exports           non-exported functions get `internal` linkage
  --number-mode i32|f64      lowering of `number` (default: i32)
  --plain                    no performance attributes or alignment hints
  --runtime-decls            always emit the runtime ABI prelude (arena + strings)
  --emit-header <file.h>     also write a C header for the callable functions
  --emit-dts <file.d.ts>     also write TypeScript declarations for the wasm exports, plus
                             <file>.mjs, a loader that marshals typed arrays
  --emit-napi <shim.c>       also write an N-API shim (build with --profile napi)
  --unchecked-indexing       drop array bounds checks (unsafe; for benchmarks)
  --target <triple>|host     emit `target datalayout`/`target triple` for that machine
                             (x86_64-unknown-linux-gnu, aarch64-unknown-linux-gnu, x86_64-apple-darwin,
                             aarch64-apple-darwin, wasm32-unknown-unknown, wasm32-wasi); default: target-neutral IR
  --nsw                      integer add/sub/mul carry `nsw`: signed overflow is undefined (like C)
  --no-stack-alloc           keep every allocation in the arena (disables escape-analysed allocas)
  -g                         emit DWARF debug info (!dbg locations, variables); kept by --link
  --json                     print diagnostics as one JSON object per line on stdout (no excerpt)
  --emit-ast                 print the syntax tree of every module to stdout instead of IR
  --emit-checked             print the checker's tables (signatures, locals, structs, facts) instead of IR
  -v, --version              print the statictsc version and exit
```

Exit codes: `0` success, `1` compile error (`file:line:col: error: ...` plus
a caret excerpt), `2` usage error, `3` toolchain error, `70` internal
compiler error (please report it; `STATICTSC_DEBUG=1` adds the stack trace).
A compile that fails reports every error it found (statement by statement,
declaration by declaration), in source order, up to 20 before `...and N more
errors`; `--json` gives editors the same list as
`{"file","line","column","endLine","endColumn","severity","message"}` objects,
one per line. `-g` adds a DWARF line table and variables to the IR so
`gdb`/`lldb` step through the `.ts` source of a `--link`ed binary
([docs/wp10-ci.md](docs/wp10-ci.md)).
Multi-file programs: `statictsc examples/multi/main.ts --link build/multi && ./build/multi; echo $?`
prints `49`.

Without `--link`, build the IR yourself: `clang add.ll examples/main.c runtime/runtime.c -o app`
(the `overriding the module target triple` warning is harmless: the IR is
target-neutral unless you pass `--target`; `-Wno-override-module` silences
it), or step by step with `llvm-as`, `llc -O2 -filetype=obj`, and
`opt -S -O2` to watch `mem2reg` turn the `alloca` locals into registers.
`opt` and `llc` only vectorise when the module carries a data layout, so
pass `--target host` (or a triple) when you inspect optimised IR by hand;
`--link` never needs it because clang supplies the layout. Cross-compile
with `--target aarch64-unknown-linux-gnu` / `wasm32-wasi` plus
`clang --target=...`, or with `llc -mtriple=...`.

## Performance and binary size

Rust-class output is the goal: no GC, no embedded engine, aliasing and
purity facts handed to LLVM up front, and a link step that strips everything
unused. `examples/add.ts` + `examples/main.c` + `runtime/runtime.c`, x86_64
Linux, glibc dynamically linked (`npm run size-report`):

| Profile | Bytes | What it does |
| --- | ---: | --- |
| `debug` | 15,072 | `clang` defaults: no optimisation, symbols kept. |
| `speed` | 4,528 | `-O3 -flto`, section GC, unwind tables off, stripped. Rust `--release`. |
| `size` | 4,512 | `-Oz -flto`, plus hidden visibility and no stack protector. Rust `opt-level="z"`. |
| `wasm` | 279 | Freestanding `wasm32` module, every function exported, stripped. |
| `wasi` | 42,228 (`argv.ts`) | `wasm32-wasi` command module: the runtime linked against wasi-libc, `_start` runs `main`; needs a WASI sysroot ([INSTALL.md](docs/INSTALL.md#wasi-optional-for---profile-wasi)). |

`hello.ts` with `--link` is 4,696 bytes. The whole runtime is about 4 KB
of machine code (`runtime.c`: one chunked bump arena with O(1) reset and
mark/release, strings, JavaScript-exact number formatting, string parsing,
`Math.random`, exit, files, `process.argv`, array growth, the panic paths);
`Math.*` calls are LLVM intrinsics, so pure functions stay `readnone`.

Memory is the part that usually costs a compiled-JavaScript design its
speed, so it is done statically ([docs/wp6-memory.md](docs/wp6-memory.md)):
a `new`, object literal or array literal that provably never outlives its
function is an `alloca` (LLVM's SROA then turns its fields into registers);
what does reach the arena is bumped inline (a load, an add, a compare and a
store); a function whose arena temporaries all die with it brackets its body
with `sts_arena_mark` / `sts_arena_release`, so hot loops keep the arena
flat. Every LLVM attribute the compiler emits (`nounwind`, `willreturn`,
`readnone`/`readonly`, `noundef`, `zeroext`, `nonnull`, `noalias`,
`nocapture`, `dereferenceable`) is a proved guarantee, never a hint; the
rules are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#attribute-soundness-rules).

The benchmark suite (`bench/`: fib, n-body, spectral norm, sieve, string
building, a `Vec3` method loop, each in StaticTS, C and Rust with identical
algorithms and a shared checksum) is run by `node bench/run.mjs`, which
writes [docs/BENCHMARKS.md](docs/BENCHMARKS.md): wall time, binary size and
peak memory per column, plus the exact build commands. The analysis of every
gap, and what `--nsw` and PGO (`scripts/build.sh --pgo-generate` /
`--pgo-use`) buy, is in [docs/wp9-optimisation.md](docs/wp9-optimisation.md);
the rules of the game are in [bench/README.md](bench/README.md).

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
  Add `runtime/runtime_wasm.c` (arena + arrays, no libc) when a function
  takes or returns an array.
- `--emit-napi` + `scripts/build.sh --profile napi` build a `.node` addon
  with argument type checks (`examples/node-addon.mjs`).
- Buffers cross as typed arrays: a StaticTS `Int32Array` / `Float64Array` /
  `BigInt64Array` parameter (the spellings of `i32[]` / `f64[]` / `i64[]`,
  one layout) is a JS typed array on both paths. The addon borrows it
  (zero-copy; writes are visible in JS), the wasm loader that `--emit-dts`
  writes next to the `.d.ts` copies it into the module's memory and results
  back out; strings cross the addon as copies (`examples/arrays.ts`).
- `--emit-header` writes C prototypes (`int32_t add(int32_t a, int32_t b);`,
  `double sumF64(const sts_array *xs);`) next to `runtime/statictsc.h`, the
  public runtime ABI (arena, strings, arrays, `sts_reset_arena`,
  `sts_arena_mark` / `sts_arena_release` for a host that manages batches).
- An N-API call costs about 30 ns and a wasm call about 2 ns before any work
  is done; one call with a 1M-element `Float64Array` runs at 0.5 ns/element
  (`node bench/ffi.mjs`), so pass whole buffers, not elements.

Details: [docs/wp8-interop.md](docs/wp8-interop.md).

## Self-hosting

`self/` is the same compiler written in StaticTS — lexer, parser, checker and
emitter, 43 modules, no `typescript` package underneath — and it compiles its
own source to a fixed point:

```
IR(stage0, self/) == IR(stage1, self/) == IR(stage2, self/)     byte for byte
```

stage1 is `self/` built by the Node compiler, stage2 is `self/` built by
stage1, and `npm test` re-proves both equalities (and that a stage3 binary is
byte-identical to stage2) on every run. Compiling the whole compiler costs the
native one **91 ms and 86 MB** against the Node one's 786 ms and 178 MB.

```bash
npm run bootstrap                            # build/statictsc, built by itself
scripts/statictsc.sh hello.ts --link hello   # its command line: -o, --link, --profile
```

`npm install -g statictsc` still ships the Node compiler: it is the seed every
bootstrap starts from, the oracle every `self/` phase is compared against, and
the one that emits debug info and the interop sidecars. Details, and the
subset `self/` is written in, are in
[docs/wp14-selfhost.md](docs/wp14-selfhost.md).

## Project status

| Milestone | Contents | State |
| --- | --- | --- |
| M1 "Programs" | pipeline prep, validator, control flow, strings, modules, CI | done |
| M2 "Data" | classes and interfaces, arrays, runtime and intrinsics | done |
| M3 "Rust parity" | interop, memory strategy (stack allocation, arena scopes, `T \| null`), benchmarks with `--target`/`--nsw`/PGO, differential testing against Node | done |
| M4 "1.0" | frozen language reference, tagged release | next |
| M5 "Self-hosting" | `self/`: the compiler, written in StaticTS, compiling itself | done |

Not in the language yet, in the order they are likely to land: optional
reference counting for objects that must outlive an arena reset, virtual
dispatch (single inheritance is in; method calls resolve statically), and
returning a small `Result<T, E>` by value instead of through the arena.
Generics, closures, `try`/`catch` and labelled `break`/`continue` are
refusals rather than gaps, each with the message and the idiom to use
instead ([docs/LANGUAGE.md](docs/LANGUAGE.md#forbidden-constructs-phase-0-validator)).
Release engineering (`--version`, exit codes, npm packaging, tag-driven
releases) landed with WP12; see [CHANGELOG.md](CHANGELOG.md) and
[docs/wp12-release.md](docs/wp12-release.md). The plan itself is
[docs/MASTER_PLAN.md](docs/MASTER_PLAN.md).

## Contributing

```bash
npm install
npm test                 # build + goldens, llvm-as, native round trips, runtime, layout, memory, interop, bench checksums, differential
node tests/run.js locals # only cases whose name contains "locals"
npm run test:update      # write missing .ll goldens for new cases
npm run test:diff        # every whole program natively and under Node (runtime/shim.mjs), compared byte for byte
node tests/differential/fuzz.js --count 200   # random integer programs against Node; prints the seed
npm run check            # tsc --noEmit
npm run lint             # Biome style lint (advisory, never a compile gate)
npm run smoke            # build and run every example with a main
npm run bootstrap        # build the self-hosted compiler into build/statictsc
node bench/run.mjs       # the benchmark suite; rewrites docs/BENCHMARKS.md (about 3 minutes)
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
[docs/README.md](docs/README.md). Coding guidelines for contributors and
coding agents are in [AGENTS.md](AGENTS.md) and [`.claude/`](.claude/).

## License

MIT, see [LICENSE](LICENSE).
