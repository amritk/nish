<div align="center">

# Nish

**An ahead-of-time compiler for a strictly static subset of TypeScript — LLVM IR in the middle, native binaries at the end. No interpreter, no garbage collector, nothing to ship beside the executable.**

![status](https://img.shields.io/badge/status-pre--alpha-ef4444?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-static%20subset-3178c6?style=flat-square&logo=typescript&logoColor=white)
![LLVM](https://img.shields.io/badge/LLVM-18-4b5563?style=flat-square&logo=llvm&logoColor=white)
![node](https://img.shields.io/badge/node-%E2%89%A522.18-339933?style=flat-square&logo=node.js&logoColor=white)
![WebAssembly](https://img.shields.io/badge/wasm-wasm32%20%C2%B7%20wasi-654ff0?style=flat-square&logo=webassembly&logoColor=white)
![self-hosted](https://img.shields.io/badge/self--hosted-stage2%20fixpoint-0ea5e9?style=flat-square)
![GC](https://img.shields.io/badge/GC-none-f97316?style=flat-square)
![vibe coded](https://img.shields.io/badge/vibe-coded-a855f7?style=flat-square)

</div>

---

Nish parses source with the official TypeScript compiler API, rejects
everything dynamic (`any`, prototypes, `eval`, exceptions, a garbage
collector), and emits textual LLVM IR (`.ll`). LLVM's own toolchain
(`clang` / `llc`) then optimises and produces native binaries for x86_64,
ARM64, or WebAssembly.

```
TypeScript source ──▶ TS AST ──▶ validator + checker ──▶ LLVM IR (.ll) ──▶ clang/llc ──▶ native binary
                     (typescript)      (src/)             (src/codegen/)        + runtime/runtime.c
```

If it compiles, every value has one fixed, known memory layout; binaries are
a few kilobytes; there is no interpreter and no GC anywhere in the pipeline.

> [!WARNING]
> **Nish is pre-alpha.** The language, the CLI flags and the IR that either
> compiler emits all change without notice until 1.0. Every commit compiles,
> tests and bootstraps itself — see [Project status](#project-status) for what
> is done and what is next — but nothing here is frozen yet, so pin an exact
> version rather than a range, expect to fix your source when you move to a
> newer one, and read [CHANGELOG.md](CHANGELOG.md) before you upgrade.

---

## Quickstart

Requirements: Node.js 22.18+ and, to produce binaries, clang (LLVM 18) + lld;
per-OS install commands are in [docs/INSTALL.md](docs/INSTALL.md).

```bash
# the npm name `nish` belongs to an unrelated package; install the release tarball
curl -LO https://github.com/amritk/nish/releases/download/v0.1.1/nish-0.1.1.tgz
npm install -g ./nish-0.1.1.tgz
```

> [!TIP]
> Building from source works just as well: `git clone`, `npm install`,
> `npm run build`, then `node dist/index.js ...` wherever this README says
> `nish`.

`hello.ts`:

```ts
export const main = (): number => {
  console.log("hello from Nish");
  return 0;                          // the process exit code
};
```

```bash
nish hello.ts --link hello    # writes hello.ll, then builds hello with clang -O3 -flto
./hello                            # hello from Nish
nish hello.ts -o hello.ll     # IR only
```

The IR is readable as is. `examples/add.ts` compiles to:

```llvm
define noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = add nsw i32 %a, %b
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```

`--plain` drops the attributes and alignment hints and leaves
`define i32 @add(i32 %a, i32 %b)` with the same body. Every construct's IR
is in [docs/IR_COOKBOOK.md](docs/IR_COOKBOOK.md).

---

## The language

The full reference is [docs/LANGUAGE.md](docs/LANGUAGE.md); every rule
there cites the test case that proves it.

| Feature | Summary | Reference |
|:---|:---|:---|
| Types | `number` (`i32` by default, `double` with `--number-mode f64`), `i32`, `i64`, `f64`, `boolean`, `string`, `T[]`, classes, interfaces, `T \| null`, `void`; 1:1 LLVM mapping, no implicit conversions | [Types](docs/LANGUAGE.md#types) |
| Functions and modules | annotated signatures, calls in any order, `export`/named relative `import`, whole-program attribute facts, `export const main` as the entry, `internal` linkage for everything not exported | [Declarations](docs/LANGUAGE.md#declarations) |
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

Semantics that differ from JavaScript on purpose: signed integer overflow is
undefined behaviour (`--wrapping` restores two's-complement wrapping; the
unsigned widths wrap either way), integer division by zero panics instead of
yielding `0`, `.length` counts bytes, there is no `throw` and no unwinding,
`toI32` saturates, `Math.min`/`max` take two arguments. The reasons are in the
[FAQ](docs/FAQ.md); [docs/wp13-differential.md](docs/wp13-differential.md)
lists everything the differential test suite found that still differs from
Node.

### The standard library

[`std/`](std/README.md) is Nish written in Nish, for Nish programs to import:
[`std/testing`](std/testing.ts), a test runner, so a compiled program can check
itself and answer an exit code with no Node in the picture, and
[`std/text`](std/text.ts), the string operations a program would otherwise write
inline — the language has no `split`, `trim` or regular expression, because each
of those allocates and some need a character table the runtime has no room for.

```ts
import { Suite } from "../std/testing";

export const main = (): number => {
  const t = new Suite("stats");
  t.eqI32("sumOf", sumOf([3, 9, 4, 9]), 25);
  return t.done();          // prints the report; 0 when nothing failed
};
```

A library module is source, not a built artifact, so it compiles with the
program that imports it and the whole-program pass sees straight through it
([docs/wp21-packages.md](docs/wp21-packages.md)). There is no bare specifier
yet — imports are relative, as everywhere else in the language — and no
callbacks, which is what makes a suite a value with methods rather than a
`test("name", () => ...)`: a function is never a value here.

The suite's own golden cases are run by [`tests/nish/run.ts`](tests/nish/run.ts),
which is this repository's test harness written in the language it tests:
`readdirSync` finds the cases, `spawnSyncTo` captures each compile and each run,
and the IR is diffed against the golden line by line. `npm run test:nish` runs it
over the whole corpus.

---

## Memory safety

There is no garbage collector and no `free`, so the bugs that need one cannot
be written. What is left — an index out of range, a null dereference — is
checked, and every way to give a check up is a flag you pass or a builtin you
call on purpose.

| Bug class | What Nish does | Reference |
|:---|:---|:---|
| Use-after-free, double free | Not expressible: nothing is freed individually. Four compile-time mechanisms decide where a value lives — a stack `alloca` when escape analysis proves it dies with the frame, an automatic arena scope when a function's temporaries do, a `nish_arena_keep` reclaim at the call site for a returned string, the bump arena otherwise — and the arena goes back when `main` returns | [Memory model](docs/LANGUAGE.md#memory-model), [wp6-memory.md](docs/wp6-memory.md) |
| Out-of-bounds read or write | Every `a[i]`, `a[i] op= v`, `s.charCodeAt(i)` and `a.pop()` is bounds-checked, with an unsigned compare, so a negative index fails too; the failure prints `index out of range: <i> >= <len>` and exits 1 | [Element access](docs/LANGUAGE.md#element-access), `tests/cases/arr_bounds_panic` |
| Null dereference | `T \| null` is a separate type, for pointers only; member access needs a narrowing the checker accepts and `?.` is forbidden — which is what lets the emitter put `nonnull dereferenceable` on every pointer that is not one | [Nullable types](docs/LANGUAGE.md#nullable-types) |
| Uninitialised memory | `new Array<T>(n)` zero-fills and rejects pointer element types, because a zeroed pointer would be a null nobody declared; class fields are definitely assigned | [Classes](docs/LANGUAGE.md#classes), `tests/cases/arr_new_zeroed` |
| Unwinding past a release | There is none. Every function is `nounwind`; a failure a caller should handle is a `Result<T, E>` and one it should not is `panic(message)` — stderr, exit 1 | [Result](docs/LANGUAGE.md#result-and-error-handling) |

### What happens when the proof fails

This is where designs actually differ. Asked to place a value it cannot show
dies with its frame, Rust refuses to compile it, Go falls back to the garbage
collector, and Zig hands the question back to you and an allocator. Nish
leaves the value in the arena, where it stays until `main` returns.

So [`src/codegen/escape.ts`](src/codegen/escape.ts) and the whole-program fact
fixpoint are optimisations and nothing else: a refusal costs memory and never
correctness, and no program is rejected for a lifetime reason. The compiler
says so out loud where the cost is real: assigning an allocation to a local
that already holds one drops the old value where nothing can free it *and*
costs the whole function its arena scope, and that is a `performance`
diagnostic naming both rewrites ([Diagnostics](docs/LANGUAGE.md#diagnostics-and-debugging-flags), on by
default, never fatal). That is the
trade the whole memory design rests on — the arena discipline a compiler pass
or a frame loop would otherwise be written around by hand, moved into the
compiler. `tests/cases/mem_*` pin the placements, and `Arena.used()` either
side of a 100000-iteration loop is how the suite checks that a scope really
does recycle.

### Which language is this like

Not any one of them; it is more useful to say which piece came from where.

| Concern | Closest to | Not |
|:---|:---|:---|
| Lifetimes | Go's escape analysis, over a Zig-style arena discipline the compiler writes for you | Rust: no ownership, no borrow checker, no lifetime annotations |
| Bounds and panics | Rust with `panic=abort` | C |
| Null | Kotlin and C# nullable reference types: flow narrowing, not a wrapper type | Rust's `Option<T>` |
| Errors | Rust: `Result<T, E>`, and `orReturn()` is `?` | exceptions, or Go's second return value |
| Signed overflow | C: undefined by default, `--wrapping` to opt out | Rust, where it is defined in both profiles |
| Syntax | TypeScript | |

The older relative is region inference as in Cyclone and MLKit: regions the
compiler infers, bracketed by a mark and a release, which is exactly what the
arena scopes and the call-site reclaim are. This version is deliberately
weaker: one global arena, per-function granularity, no region polymorphism.

### Where it is not safe

> [!CAUTION]
> Four holes, every one of them asked for by name.

- **`Arena.reset()` / `Arena.release(m)`** release or recycle in O(1), and
  doing either while anything allocated after the mark is still referenced is
  undefined behaviour. The compiler protects its own marks — a function that
  touches either, directly or through a callee, never gets an automatic
  scope — and not yours ([`Arena`](docs/LANGUAGE.md#arena)).
- **`--unchecked-indexing`** drops the bounds checks, after which an
  out-of-range index is undefined behaviour. It is there for benchmarks
  (`tests/cases/arr_unchecked`).
- **Signed integer overflow is undefined** by default, so LLVM may widen
  induction variables and strength-reduce loops; `--wrapping` restores
  two's-complement wrapping for a hash or an LCG that overflows on purpose
  ([Semantics](docs/LANGUAGE.md#semantics-decisions)).
- **Interop** hands a pointer to a C, wasm or N-API host, and what happens to
  it there is the host's business
  ([wp8-interop.md](docs/wp8-interop.md)).

Memory-safe like Go, allocated like Zig, errors like Rust, nulls like Kotlin,
overflow like C — with two C-shaped holes you have to ask for by name. What it
buys is the output: no GC, no runtime, and the sizes under
[Performance and binary size](#performance-and-binary-size).

---

## Command line

```
nish <entry.ts> [more.ts ...] [options]
       nish --version | --help
  -o, --output <file.ll>     output path for a single module (default: <input>.ll)
  -o, --output <dir>/        output directory: one <dir>/<module>.ll per module
  --link <exe>               build a native binary from every module + runtime/runtime.c
                             (entry module must declare `export const main`)
  --profile speed|size|debug build profile for --link (default: speed)
  --no-strict-exports        every function is an external symbol (default: non-exported
                             functions get `internal` linkage)
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
  --wrapping                 signed integer add/sub/mul wrap two's-complement (default: they
                             carry `nsw`, so signed overflow is undefined, like C)
  --no-stack-alloc           keep every allocation in the arena (disables escape-analysed allocas)
  --threads                  give every thread its own arena and random seed; the runtime is
                             built to match by --link (no language surface: nothing in the
                             language spawns a thread yet)
  --no-warn-performance      do not report the `performance` diagnostics (they are on by default,
                             print on stderr, and never change the exit code)
  -g                         emit DWARF debug info (!dbg locations, variables); kept by --link
  --json                     print diagnostics as one JSON object per line on stdout (no excerpt)
  --emit-ast                 print the syntax tree of every module to stdout instead of IR
  --emit-checked             print the checker's tables (signatures, locals, structs, facts) instead of IR
  -v, --version              print the nish version and exit
```

Exit codes: `0` success, `1` compile error (`file:line:col: error: ...` plus
a caret excerpt), `2` usage error, `3` toolchain error, `70` internal
compiler error (please report it; `NISH_DEBUG=1` adds the stack trace).
A compile that fails reports every error it found (statement by statement,
declaration by declaration), in source order, up to 20 before `...and N more
errors`; `--json` gives editors and tools the same list as
`{"file","line","column","endLine","endColumn","severity","code","message"}`
objects, one per line, where `code` is a stable identifier for the rule
(`NL1013`, `NL2231`) and is what to match on rather than the prose. Failures
with no source position — an unusable C toolchain, an internal error — are JSON
objects too, so `--json` never leaves a caller with an empty stdout.
`--help` prints on stdout and exits `0`; only a usage *error* goes to stderr
with `2`. `-g` adds a DWARF line table and variables to the IR so
`gdb`/`lldb` step through the `.ts` source of a `--link`ed binary
([docs/wp10-ci.md](docs/wp10-ci.md)).
Multi-file programs: `nish examples/multi/main.ts --link build/multi && ./build/multi; echo $?`
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

---

## Performance and binary size

Rust-class output is the goal: no GC, no embedded engine, aliasing and
purity facts handed to LLVM up front, and a link step that strips everything
unused. `examples/add.ts` + `examples/main.c` + `runtime/runtime.c`, x86_64
Linux, glibc dynamically linked (`npm run size-report`):

| Profile | Bytes | What it does |
|:---|---:|:---|
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
with `nish_arena_mark` / `nish_arena_release`, so hot loops keep the arena
flat. Every LLVM attribute the compiler emits (`nounwind`, `willreturn`,
`readnone`/`readonly`, `noundef`, `zeroext`, `nonnull`, `noalias`,
`nocapture`, `dereferenceable`) is a proved guarantee, never a hint; the
rules are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#attribute-soundness-rules).

The benchmark suite (`bench/`: fib, n-body, spectral norm, sieve, string
building, a `Vec3` method loop, each in Nish, C and Rust with identical
algorithms and a shared checksum) is run by `node bench/run.mjs`, which
writes [docs/BENCHMARKS.md](docs/BENCHMARKS.md): wall time, binary size and
peak memory per column, plus the exact build commands. The analysis of every
gap, and what `--nsw` and PGO (`scripts/build.sh --pgo-generate` /
`--pgo-use`) buy, is in [docs/wp9-optimisation.md](docs/wp9-optimisation.md);
the rules of the game are in [bench/README.md](bench/README.md).

---

## Interop: export, do not embed

Nish never embeds a JavaScript engine (see the [FAQ](docs/FAQ.md#why-not-embed-a-javascript-engine-for-npm-packages)).
The supported direction is Node importing Nish:

```
[ Node / Bun process ]  imports  [ Nish .wasm or .node addon ]
  I/O, HTTP, npm packages          math, parsing, data transforms, hot loops
                 cross the boundary once per batch, not once per element
```

- `scripts/build.sh --profile wasm` produces a module `WebAssembly.instantiate`
  loads directly (`examples/node-host.mjs`); exports use the plain C ABI.
  Add `runtime/runtime_wasm.c` (arena + arrays, no libc) when a function
  takes or returns an array.
- `--emit-napi` + `scripts/build.sh --profile napi` build a `.node` addon
  with argument type checks (`examples/node-addon.mjs`).
- Buffers cross as typed arrays: an Nish `Int32Array` / `Float64Array` /
  `BigInt64Array` parameter (the spellings of `i32[]` / `f64[]` / `i64[]`,
  one layout) is a JS typed array on both paths. The addon borrows it
  (zero-copy; writes are visible in JS), the wasm loader that `--emit-dts`
  writes next to the `.d.ts` copies it into the module's memory and results
  back out; strings cross the addon as copies (`examples/arrays.ts`).
- `--emit-header` writes C prototypes (`int32_t add(int32_t a, int32_t b);`,
  `double sumF64(const nish_array *xs);`) next to `runtime/nish.h`, the
  public runtime ABI (arena, strings, arrays, `nish_reset_arena`,
  `nish_arena_mark` / `nish_arena_release` for a host that manages batches).
- An N-API call costs about 30 ns and a wasm call about 2 ns before any work
  is done; one call with a 1M-element `Float64Array` runs at 0.5 ns/element
  (`node bench/ffi.mjs`), so pass whole buffers, not elements.

Details: [docs/wp8-interop.md](docs/wp8-interop.md).

---

## The compiler in a browser

`self/` is an Nish program, so the compiler compiles itself to
WebAssembly like any other one:

```bash
node dist/index.js self/compile.ts --link web/nish.wasm --profile wasi
node web/compile.mjs web/nish.wasm examples/add.ts     # the IR, from a Web Worker
```

That module is about 480 KB (140 KB gzipped) and lexes, checks and emits IR
with no server in the loop; `web/index.html` is a playground built on it and
`web/wasi.mjs` is the in-memory filesystem it runs against. It stops at the
IR — `clang` and `wasm-ld` are not in a page — so `--link` and `--profile` are
refused there. [web/README.md](web/README.md) has the rest.

---

## Self-hosting

`self/` is the same compiler written in Nish — lexer, parser, checker and
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
npm run bootstrap                   # build/nish, built by itself
build/nish hello.ts --link hello  # -o, --link, --profile, its own directories
```

The released `.tgz` still ships the Node compiler: it is the seed every
bootstrap starts from and the oracle every `self/` phase is compared against.
What it is no longer is the only one that can emit DWARF, write the interop
sidecars or link an executable — the self-hosted compiler does all three, the
first two byte for byte the same, and it answers `--target host` and `--emit-ast` too.
No flag is stage0's by name any more; what differs is what `--emit-ast`
*prints*, since each compiler dumps its own tree — stage0 the `typescript`
package's node names, the self-hosted one the vocabulary of `self/nodes.ts` —
and imitating the other was never the point.
Details, and the subset `self/` is written in, are in
[docs/wp14-selfhost.md](docs/wp14-selfhost.md).

---

## Project status

Pre-alpha, as above: M4 is the milestone that freezes the language reference
and tags a release, so until it lands a construct's spelling, a flag's name
and the IR any of them lowers to are all still free to change.

| Milestone | Contents | State |
|:---|:---|:---|
| M1 "Programs" | pipeline prep, validator, control flow, strings, modules, CI | done |
| M2 "Data" | classes and interfaces, arrays, runtime and intrinsics | done |
| M3 "Rust parity" | interop, memory strategy (stack allocation, arena scopes, `T \| null`), benchmarks with `--target`/`--nsw`/PGO, differential testing against Node | done |
| M4 "1.0" | frozen language reference, tagged release | next |
| M5 "Self-hosting" | `self/`: the compiler, written in Nish, compiling itself | done |

Not in the language yet, in the order they are likely to land: optional
reference counting for objects that must outlive an arena reset, and dynamic
dispatch — which would be a trait object over an interface, since inheritance
was removed ([docs/wp25-inheritance.md](docs/wp25-inheritance.md)) and every
method call names one symbol today.
Generics, closures, `try`/`catch` and labelled `break`/`continue` are
refusals rather than gaps, each with the message and the idiom to use
instead ([docs/LANGUAGE.md](docs/LANGUAGE.md#forbidden-constructs-phase-0-validator)).
Release engineering (`--version`, exit codes, npm packaging, tag-driven
releases) landed with WP12; see [CHANGELOG.md](CHANGELOG.md) and
[docs/wp12-release.md](docs/wp12-release.md). The plan itself is
[docs/MASTER_PLAN.md](docs/MASTER_PLAN.md).

---

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
npm run bootstrap        # build the self-hosted compiler into build/nish
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

---

## License

MIT, see [LICENSE](LICENSE).
