<div align="center">

# Nish

**Native Instruction Static Host AKA Turbo Typescript. A fast subset of typescript without the encumbrance of javascript.**

**An ahead-of-time compiler for a strictly static subset of TypeScript — LLVM IR in the middle, native binaries at the end. No interpreter, no garbage collector, nothing to ship beside the executable.**

![status](https://img.shields.io/badge/status-pre--alpha-ef4444?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-static%20subset-3178c6?style=flat-square&logo=typescript&logoColor=white)
![LLVM](https://img.shields.io/badge/LLVM-18-4b5563?style=flat-square&logo=llvm&logoColor=white)
![WebAssembly](https://img.shields.io/badge/wasm-wasm32%20%C2%B7%20wasi-654ff0?style=flat-square&logo=webassembly&logoColor=white)
![vibe coded](https://img.shields.io/badge/vibe-coded-a855f7?style=flat-square)

</div>

---

Nish parses source with its own lexer and parser, rejects everything dynamic
(`any`, prototypes, `eval`, exceptions, a garbage collector), and emits
textual LLVM IR (`.ll`). LLVM's own toolchain (`clang` / `llc`) then optimises
and produces native binaries for x86_64, ARM64, or WebAssembly. The compiler
is itself written in Nish, in `src/`, and ships as a native binary with no
runtime dependency.

```
TypeScript source ──▶ AST ──▶ validator + checker ──▶ LLVM IR (.ll) ──▶ clang/llc ──▶ native binary
              (src/parser.ts)  (src/checker.ts)      (src/emit*.ts)         + runtime/runtime.c + runtime-os.c
```

If it compiles, every value has one fixed, known memory layout; binaries are
a few kilobytes; there is no interpreter and no GC anywhere in the pipeline.

> [!CAUTION]
> **Do not use Nish in production.** It is a very early, pre-alpha
> experiment in how far a static subset of TypeScript can go when it is
> compiled straight to native code, not a tool to build on yet. Expect
> miscompilations, crashes, missing features and diagnostics that are wrong
> or confusing. The compiler, the runtime and the standard library,
> cryptography included, have had one audit by the project itself
> ([docs/security/](docs/security/README.md)), which fixed what it found and
> left findings open. No one independent has reviewed them. Nothing it
> produces should handle data, money or systems you care about. To report a
> vulnerability, see [SECURITY.md](SECURITY.md).

> [!WARNING]
> **Everything still changes.** Until 1.0, the language, the CLI flags and the
> IR the compiler emits all change without notice, often from one minor
> release to the next. Every commit compiles, tests and bootstraps itself (see
> [Project status](#project-status) for what is done and what is next), but
> nothing here is frozen. If you try it anyway, pin an exact version rather
> than a range, expect to fix your source when you move to a newer one, and
> read [CHANGELOG.md](CHANGELOG.md) before you upgrade.

---

## Quickstart

Requirements: clang (LLVM 18) + lld, to produce binaries; per-OS install
commands are in [docs/INSTALL.md](docs/INSTALL.md).

```bash
curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh
```

The script needs only `sh`, `curl` and `tar`. It installs the prebuilt
compiler into `~/.nish` and puts it on your `PATH` in your shell's startup
file (zsh, bash, fish, or `~/.profile`); `--no-modify-path` leaves that file
alone.

**Or with npm**, which needs Node.js 22.18+:

```bash
npm install -g nish            # or per project: npm i -D nish
npx nish --version             # or run it without installing
```

npm fetches the prebuilt native compiler for your machine alongside it.

> [!NOTE]
> **From a release tarball rather than the registry, install the pair.** The
> main package is a launcher and carries no compiler: installed on its own it
> has nothing to hand over to and says so, exiting 3.
> The same is true on a platform this project publishes no binary for (musl,
> FreeBSD, 32-bit anything), where `nish` names the four platforms that have
> one. [docs/INSTALL.md](docs/INSTALL.md) §2 has the table of what is built for
> what, and what is left for a platform outside it.

> [!TIP]
> Building from source works just as well, and `build/nish` then stands in
> wherever this README says `nish`:
> [CONTRIBUTING.md](CONTRIBUTING.md#building-the-compiler-from-source) has the
> steps.

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
nish run hello.ts             # build into a cache and run it: a script, still native
```

The IR is readable as is. `examples/add.ts` compiles to:

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```

Nothing bounds `a` and `b`, so the `+` is checked: an overflow panics with
`attempt to add with overflow` rather than wrapping or being undefined, and a
sum the compiler proves fits is a plain `add nsw` instead
([Semantics decisions](docs/LANGUAGE.md#semantics-decisions)).

`--plain` drops the attributes and alignment hints and leaves
`define i32 @add(i32 %a, i32 %b)` with the same body. Every construct's IR
is in [docs/IR_COOKBOOK.md](docs/IR_COOKBOOK.md).

---

## The language

New to Nish? The [user guide](docs/guide/index.md) teaches the language page
by page, from installing it to threads, with every example compiled by
`npm test`.

Threads come from one import, `nish/threads`: parallel maps and reduces,
scoped tasks, a `Mutex` that owns its data, atomics and channels, with data
races and deadlocks refused at compile time.
[Which one to reach for](docs/guide/using-nish/threads.md) is the guide's
threads page.

The full reference is [docs/LANGUAGE.md](docs/LANGUAGE.md); every rule
there cites the test case that proves it. If an **AI** is writing the program —
or you want the whole language in one pass rather than as a reference to browse
— read [docs/AI.md](docs/AI.md) instead: the same rules, ordered by which
TypeScript reflex they reject, with every example compiled by `npm test`. Both
ship in the npm package, and [llms.txt](llms.txt) indexes them.

| Feature | Summary | Reference |
|:---|:---|:---|
| Types | `number` (`i32` by default, `double` with `--number-mode f64`), `i32`, `i64`, unsigned `u8`/`u16`/`u32`/`u64`, `f32`, `f64`, ranged `integer<Lo, Hi>`, `boolean`, `string`, `T[]` and `readonly T[]`, classes, interfaces, `T \| null`, `void`; 1:1 LLVM mapping, no implicit conversions | [Types](docs/LANGUAGE.md#types) |
| Enums, aliases and unions | numeric `enum`s as a distinct type, with members usable as types (`Kind.Circle`); `type` aliases; discriminated unions `Circle \| Square` of classes or interfaces tagged by an enum-member field, narrowed by testing the tag; all exportable across modules | [Enums](docs/LANGUAGE.md#enums), [Type aliases](docs/LANGUAGE.md#type-aliases), [Discriminated unions](docs/LANGUAGE.md#discriminated-unions) |
| Functions and modules | annotated signatures, calls in any order, default and rest parameters, `export`/named relative `import`, packages by name, whole-program attribute facts, `export const main` as the entry (or, in an entry with no `main`, statements at the top level that run as one), `internal` linkage for everything not exported; a parameter may have a function type, and each function or arrow passed to it compiles to its own instantiation with a direct call, never a function pointer, while the arrow may read the caller's `const` locals and parameters | [Declarations](docs/LANGUAGE.md#declarations), [Top-level code](docs/LANGUAGE.md#top-level-code), [Default and rest parameters](docs/LANGUAGE.md#default-and-rest-parameters), [Function parameters](docs/LANGUAGE.md#function-parameters) |
| Async functions | `async` functions and arrows returning `Promise<T>`, `await` on a direct call, `spawn` and `awaitAll` from `nish:async`, `export async function main`; each compiles to a frame and a resume switch sized at link time, with no promise ever a value | [Async functions](docs/LANGUAGE.md#async-functions-async-and-await) |
| Control flow | `if`/`else`, `while`, `do`, `for`, `for...of` (arrays, `Map` keys and values, `Set`), `switch` (exhaustive over a union's tag, a clause may fall into the next), `break`/`continue`, labelled or not, boolean-only conditions, definite return, unreachable-code errors | [Statements](docs/LANGUAGE.md#statements) |
| Expressions | `+ - * / %` (integer `/` and `%` checked: zero divisor or `MIN / -1` panics), shifts and bitwise operators, numeric-only ordering, `=== !==` (strings by content), `&& \|\|`, `?:`, `??` on a `T \| null` and a `?.` chain that ends in `??`, `op=`, `++`/`--`, template literals, contextual numeric literals | [Expressions](docs/LANGUAGE.md#expressions) |
| Strings | immutable UTF-8 (`.length` is the byte length), literals as constant data, `+`, `===`, templates, `console.log` | [Builtins](docs/LANGUAGE.md#builtins), [Semantics](docs/LANGUAGE.md#semantics-decisions) |
| Arrays | `T[]` with one element type, literals, `new Array<T>(n)` zero-filled, bounds-checked `a[i]` (panic, or `uncheckedGet` from `nish:unsafe`), `.length`, `push`/`pop`, `set`/`fill`, `sort`, `map`/`filter`/`some`/`every`/`findIndex`/`slice`, `for...of`; arrays of records stored contiguously and fixed-length array fields inline | [Arrays](docs/LANGUAGE.md#array-literals) |
| `Map` and `Set` | the global `Map<K, V>` and `Set<T>`, insertion-ordered, one probe per `get`/`set`/`has`/`delete`; `get` is `V \| undefined` and narrowed as TypeScript does | [`Map` and `Set`](docs/LANGUAGE.md#map-and-set) |
| Classes and interfaces | LLVM structs with clang's layout, constructors, methods, `readonly`, definite assignment, object literals, `implements` by identical layout; no inheritance | [Classes](docs/LANGUAGE.md#classes) |
| Generics | generic functions, classes, interfaces and methods by monomorphisation: one specialised `define` per instantiation, type arguments inferred at a call and written after `new` or in an annotation, `<T extends Shape>` constraints, exported instantiations callable from C and JavaScript as `nish_gen_identity_i32` | [Generic functions](docs/LANGUAGE.md#generic-functions) |
| Memory | no GC: objects that provably do not escape their function are stack `alloca`s, functions whose temporaries die with them get an automatic arena scope, `using a = arena()` frees a batch the compiler has checked nothing outlives, and `Arena.mark`/`Arena.used` read the arena; a long-running program frees a batch that outlives one call with `nish:region` | [`using a = arena()`](docs/LANGUAGE.md#using-a--arena), [`Arena`](docs/LANGUAGE.md#arena), [Memory](docs/LANGUAGE.md#memory-model) |
| `T \| null` | for class, interface, array and string types; `=== null`, a `??` default, and narrowing to `T` by `if`, early return, `while`, `&&`, `?:`, enforced by the checker | [Nullable types](docs/LANGUAGE.md#nullable-types) |
| Errors | Rust-style `Result<T, E>` with `Ok`/`Err`, `isOk()`/`isErr()`, `orReturn()` (the `?`), `unwrapOr`, `expect`; the checker refuses to let a failure be dropped or the success payload be read before the error is handled. No `throw`, no unwinding: `panic(message)` ends the process | [Result and error handling](docs/LANGUAGE.md#result-and-error-handling) |
| Threads | `nish/threads`: `parallelMap`/`parallelReduce`, scoped tasks (`using s = scope()`), `Mutex<T>`, `AtomicI32`/`AtomicI64`, `Channel<T>`; data races and deadlocks refused at compile time | [Data parallelism](docs/LANGUAGE.md#data-parallelism-nishthreads) |
| Builtins | `console.log`, `Math.*` as LLVM intrinsics (JavaScript's `pow`, `round`, `min`/`max` corner cases included), `Math.random`, `toI32`/`toI64`/`toF64`, `process.exit`, files, directories, subprocesses, the environment and the clock; the runtime-backed ones are also importable from `nish:fs` / `nish:process` / `nish:io` / `nish:net` / `nish:term`, which is the same builtin under a name nothing can shadow; `nish:unsafe` (unchecked access, defined wrapping), `nish:secret` (`Secret<T>`, key material the checker keeps in and wipes), `nish:region`, `nish:simd` (128-bit vector lanes) and `nish:async` (`spawn`, `awaitAll`) are reached only by import | [Builtins](docs/LANGUAGE.md#builtins), [Builtin modules](docs/LANGUAGE.md#builtin-modules-nish) |
| Calling C | `declare function` binds a C symbol, `CPtr` holds an opaque C pointer, and a handle class bound with `using` is closed at every exit of its block | [Calling C](docs/LANGUAGE.md#calling-c) |
| Capabilities and policies | the compiler reports which capabilities (`fs.read`, `net`, `process.spawn`, `ffi`, `unsafe`, ...) every function, module and package reaches, with the call chain; `--allow`/`--deny` and `package.json` refuse a program that reaches one it is not granted, a dependency gets none it is not given, and a capability lockfile fails a build when a dependency reaches a new one. `--deny-panics` or `noPanic` refuses every panic site the compiler cannot prove away | [Capabilities](docs/LANGUAGE.md#capabilities), [The no-panic scope](docs/LANGUAGE.md#the-no-panic-scope) |
| Rejected | `any`, `unknown`, `var`, `==`, `?.` outside a `??` chain, generic type aliases, a promise as a value (`.then`, `Promise.all`), `try`, `throw`, `typeof`, `instanceof`, `delete`, prototypes, `Object.assign`, string-keyed access, ... with exact messages | [Forbidden constructs](docs/LANGUAGE.md#forbidden-constructs-phase-0-validator) |

Semantics that differ from JavaScript on purpose: signed integer overflow
panics unless the compiler proves the operation fits (`wrappingAdd`,
`wrappingSub` and `wrappingMul` from `nish:unsafe` wrap two's-complement; the
unsigned widths wrap either way), integer division by zero panics instead of
yielding `0`, `.length` counts bytes, there is no `throw` and no unwinding,
`toI32` saturates, `Math.min`/`max` take two arguments. The reasons are in the
[FAQ](docs/FAQ.md), and [docs/RUN_UNDER_NODE.md](docs/RUN_UNDER_NODE.md) lists
where a program still answers differently under Node.

### The standard library

[`std/`](std/README.md) is Nish written in Nish, for Nish programs to import.
[`std/testing`](std/testing.ts) is a test runner, so a compiled program can
check itself and return an exit code with no Node involved. For text there is
[`std/text`](std/text.ts) (`trim`, `splitLines`, `splitWhitespace`,
`replaceAll`) and [`std/regex`](std/regex.ts), regular expressions in
JavaScript syntax whose search time is linear in the input. For data there is
`std/json` (plus a tokenizer, typed decoding and a value tree), `std/yaml`,
`std/base64` and `std/bytes`. Programs also get `std/cli` for arguments,
`std/random` (a seeded `Rng`), `std/map`, `std/collections`, `std/threads`,
`std/sqlite` (SQLite, the database in a file) and `std/term` (raw-mode
terminal I/O and styling, with pixel graphics in `std/term-pixels`).
`nish/crypto/*` holds the primitives: SHA-1/2, HMAC, PBKDF2, HKDF,
ChaCha20-Poly1305, AES-GCM, X25519, Ed25519, P-256 ECDSA, bcrypt and X.509,
with secret material held as a wiped `Secret<T>`. `nish/net/*` holds the
protocols built on them: TLS 1.3, QUIC, HTTP/1.1, HTTP/2 (HPACK), HTTP/3
(QPACK), WebSocket (server and client), WebTransport, a URL parser, an HTTP router, a prefork
server and a sans-IO PostgreSQL client. The [standard
library](docs/guide/using-nish/standard-library.md) guide page walks through
them, and the [`std/` README](std/README.md) lists every module.

```ts
import { Suite } from "nish/testing";

export const main = (): number => {
  const t = new Suite("stats");
  t.eqI32("sumOf", sumOf([3, 9, 4, 9]), 25);
  return t.done();          // prints the report; 0 when nothing failed
};
```

A library module is source, not a built artifact, so it compiles with the
program that imports it and the whole-program pass sees straight through it
([Packages](docs/guide/language/modules.md#packages)): `nish/<module>` resolves to
`std/<module>.ts` beside the running compiler, and what you import but never
call is dropped at the link. A function can be *passed* as a typed parameter.
Each call site is specialised into a direct call. A function is never a stored
value, so a suite is an object with methods rather than a registry of
`test("name", () => ...)` closures. This repository's own test harness is
written that way ([CONTRIBUTING.md](CONTRIBUTING.md#tests-written-in-nish)).

---

## Memory safety

There is no garbage collector and no `free`, so the bugs that need one cannot
be written. What is left — an index out of range, a null dereference — is
checked, and every way to give a check up is a flag you pass or a builtin you
call on purpose.

| Bug class | What Nish does | Reference |
|:---|:---|:---|
| Use-after-free, double free | Not expressible: nothing is freed individually. Four compile-time mechanisms decide where a value lives — a stack `alloca` when escape analysis proves it dies with the frame, an automatic arena scope when a function's temporaries do, a `nish_arena_keep` reclaim at the call site for a returned string, the bump arena otherwise — and the arena goes back when `main` returns | [Memory model](docs/LANGUAGE.md#memory-model), [the guide's Memory page](docs/guide/language/memory.md) |
| Out-of-bounds read or write | Every `a[i]`, `a[i] op= v`, `s.charCodeAt(i)`, `s.slice(a, b)` and `a.pop()` is bounds-checked, with an unsigned compare, so a negative index fails too; the failure prints `index out of range: <i> >= <len>` (or, for `slice`, `slice out of range: [<a>, <b>) of length <len>`) and exits 1. Where a flow-sensitive proof shows the index is already in range — a loop condition, a length guard, a hoisted `const n = a.length`, an unsigned index — **no check is emitted at all**, and the checks that survive inside a loop say so as a `performance` warning naming the guard that would remove them | [Element access](docs/LANGUAGE.md#element-access), `tests/cases/arr_bounds_panic`, `arr_bounds_proven` |
| Null dereference | `T \| null` is a separate type, for pointers only; member access needs a narrowing the checker accepts, and `?.` appears only in a chain that ends in a `??` default — which is what lets the emitter put `nonnull dereferenceable` on every pointer that is not one | [Nullable types](docs/LANGUAGE.md#nullable-types) |
| Uninitialised memory | `new Array<T>(n)` zero-fills and rejects pointer element types, because a zeroed pointer would be a null nobody declared; class fields are definitely assigned | [Classes](docs/LANGUAGE.md#classes), `tests/cases/arr_new_zeroed` |
| Unwinding past a release | There is none. Every function is `nounwind`; a failure a caller should handle is a `Result<T, E>` and one it should not is `panic(message)` — stderr, exit 1 | [Result](docs/LANGUAGE.md#result-and-error-handling) |

### What happens when the proof fails

This is where designs actually differ. Asked to place a value it cannot show
dies with its frame, Rust refuses to compile it, Go falls back to the garbage
collector, and Zig hands the question back to you and an allocator. Nish
leaves the value in the arena, where it stays until `main` returns.

So [`src/escape.ts`](src/escape.ts) and the whole-program fact
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
| Signed overflow | Rust's debug profile: a checked panic, in every build, unless the compiler proves the operation fits; Rust's `wrapping_add` as an imported call to opt out at one site | C, where it is undefined |
| Syntax | TypeScript | |

The older relative is region inference as in Cyclone and MLKit: regions the
compiler infers, bracketed by a mark and a release, which is exactly what the
arena scopes and the call-site reclaim are. This version is deliberately
weaker: one global arena, per-function granularity, no region polymorphism.

### Where it is not safe

> [!CAUTION]
> Two holes, each of them asked for by name.

- **`uncheckedGet` and `uncheckedSet`** from `nish:unsafe` read and write an
  element with no bounds check, after which an out-of-range index at that site
  is undefined behaviour. A module reaches them only through the import, so
  every module that gives up a check says so at its top and every site is a
  call (`tests/cases/unsafe_get_set`). That is a different thing from the
  proof above: the proof removes a check the compiler showed was never going
  to fire, and changes nothing about what the program means
  ([`nish:unsafe`](docs/LANGUAGE.md#nishunsafe-unchecked-access-and-defined-wrapping)).
  No flag turns the checks off for a whole program.
- **Interop** hands a pointer to a C, wasm or N-API host, and what happens to
  it there is the host's business
  ([Calling Nish from other languages](docs/guide/using-nish/interop.md)).

Memory-safe like Go, allocated like Zig, errors like Rust, nulls like Kotlin,
overflow checked like Rust's debug builds — with two C-shaped holes you have to ask for by name. What it
buys is the output: no GC, no runtime, and the sizes under
[Performance and binary size](#performance-and-binary-size).

---

## Command line

```
usage: nish <file.ts> [more.ts ...] [flags]   compile to LLVM IR
       nish run [flags] <file.ts> [args ...]  build, cache and run it
       nish -v, --version | -h, --help
```

`nish --help` prints every flag, grouped by what it is for (Build, Check,
Capabilities, Interop, Inspect, Code generation), then the exit codes and a
few examples. Among them: `--link` builds a native binary, `--fix` applies the
compiler's safe fixes in place, `--allow`/`--deny` refuse a program that
reaches more than a capability policy grants, `--deny-panics` refuses any
panic the compiler cannot prove away, `-g` adds debug info for `gdb`/`lldb`,
and `--emit-ts` writes the program out as plain TypeScript instead of IR.
`nish run tool.ts a b` is the scripting shape: it compiles `tool.ts`, links it
into a cache only when something changed, and starts it with `a b` as its
arguments.

A failed compile reports every error it found, in source order, as
`file:line:col: error: ...` plus a caret excerpt; `--json` gives editors and
tools the same list, one object per line with a stable `code` (`NL1013`) to
match on. Exit codes: `0` success, `1` compile error, `2` usage error, `3`
toolchain error, `70` internal compiler error (please
[report it](https://github.com/amritk/nish/issues/new/choose) with the input
and the command line).

[The CLI](docs/guide/using-nish/cli.md) guide page walks through all of it,
and [docs/INSTALL.md](docs/INSTALL.md) shows how to link the IR by hand with
`clang`.

---

## Performance and binary size

Rust-class output is the goal: no GC, no embedded engine, aliasing and
purity facts handed to LLVM up front, and a link step that strips everything
unused. Binary sizes for `examples/add.ts` with `examples/main.c` and the
runtime, on x86_64 Linux (`npm run size-report`):

| Profile | Bytes | What it does |
|:---|---:|:---|
| `debug` | 15,072 | `clang` defaults: no optimisation, symbols kept. |
| `speed` | 4,528 | `-O3 -flto`, section GC, unwind tables off, stripped. Rust `--release`. |
| `size` | 4,512 | `-Oz -flto`, plus hidden visibility and no stack protector. Rust `opt-level="z"`. |
| `wasm` | 279 | Freestanding `wasm32` module, every function exported, stripped. |
| `wasi` | 42,228 (`argv.ts`) | `wasm32-wasi` command module: the runtime linked against wasi-libc, `_start` runs `main`; needs a WASI sysroot ([INSTALL.md](docs/INSTALL.md#wasi-optional-for---profile-wasi)). |

`hello.ts` with `--link` is 4,712 bytes. The C runtime is split into small
units, each with a measured size ceiling, and section GC drops whatever a
program does not call, so a program pays only for the parts of the runtime it
uses.

Memory is the part that usually costs a compiled-JavaScript design its
speed, so it is done statically ([Memory](docs/guide/language/memory.md)):
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
algorithms and a shared checksum) writes
[docs/BENCHMARKS.md](docs/BENCHMARKS.md): wall time, binary size and peak
memory per column, plus the exact build commands. The rules of the game are
in [bench/README.md](bench/README.md).

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
  Add `runtime/runtime-wasm.c` (arena + arrays, no libc) when a function
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
- `--emit-ts <dir>` writes the program back out as TypeScript that Node 22.18+
  runs with type stripping, one file per module plus an `entry.ts`, importing
  its builtins from `nish/runtime`; overflow and bounds checks stay, as
  helpers (`docs/guide/using-nish/to-typescript.md`).
- An N-API call costs about 30 ns and a wasm call about 2 ns before any work
  is done; one call with a 1M-element `Float64Array` runs at 0.5 ns/element
  (`node bench/ffi.mjs`), so pass whole buffers, not elements.

Details: [Calling Nish from other languages](docs/guide/using-nish/interop.md).

---

## The compiler in a browser

`src/` is an Nish program, so the compiler compiles itself to
WebAssembly like any other one:

```bash
nish src/compile.ts --link web/nish.wasm --profile wasi
node web/compile.mjs web/nish.wasm examples/add.ts     # the IR, from a Web Worker
```

That module is about 480 KB (140 KB gzipped) and lexes, checks and emits IR
with no server in the loop; `web/index.html` is a playground built on it and
`web/wasi.mjs` is the in-memory filesystem it runs against. It stops at the
IR — `clang` and `wasm-ld` are not in a page — so `--link` and `--profile` are
refused there. [web/README.md](web/README.md) has the rest.

---

## Nish compiles itself

The compiler in `src/` is written in Nish, with no `typescript` package
underneath, and is built by the previous release; each build compiles it
twice more and checks the two outputs agree byte for byte.
[CONTRIBUTING.md](CONTRIBUTING.md) has how to build it from source and how the
bootstrap works.

---

## Project status

Pre-alpha, as above, and **not for production use**. The one security audit
so far was the project's own ([docs/security/](docs/security/README.md), with
findings still open), and there is no compatibility promise: the project stays
on 0.x until 1.0, which is not scheduled, and until then a construct's
spelling, a flag's name and the IR any of them lowers to can change between
minor releases. [CHANGELOG.md](CHANGELOG.md) says what changed in each, and
the [roadmap](docs/roadmap/index.md) says what is built and what is next.

There is no dynamic dispatch yet (classes have no inheritance, so every method
call names one function; [WP60](docs/wp60-dyn-dispatch.md) proposes it over
interfaces) and no reference counting: memory is the arena, the
stack and `nish:region`. Generic type aliases, closures stored as values (an
arrow written as a call's argument may read the caller's `const` locals and
parameters, but is never stored) and `try`/`catch` are refused by design, each
with the message and the idiom to use instead
([docs/LANGUAGE.md](docs/LANGUAGE.md#forbidden-constructs-phase-0-validator)).

---

## Contributing

Building the compiler, running the tests and the project's conventions are in
[CONTRIBUTING.md](CONTRIBUTING.md).

---

## Security

Report a vulnerability privately, through GitHub's **Security → Report a
vulnerability**, never in a public issue. [SECURITY.md](SECURITY.md) has the
reporting channel, the supported versions and the threat model.
[docs/security/](docs/security/README.md) holds the audit record of every area
and the list of findings still open.

---

## License

MIT, see [LICENSE](LICENSE). Third-party code in the repository keeps its own
licence; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
