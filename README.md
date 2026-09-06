# StaticTS

An ahead-of-time compiler for a strictly static subset of TypeScript. It parses
source with the official TypeScript compiler API, enforces the StaticTS rules,
and emits textual LLVM IR (`.ll`). LLVM's own toolchain (`llc` / `clang`) then
handles optimization and native code generation for x86_64, ARM64, or
WebAssembly.

```
TypeScript source ──▶ TS AST ──▶ StaticTS checker ──▶ LLVM IR (.ll) ──▶ llc/clang ──▶ native binary
                     (typescript)   (src/checker.ts)   (src/codegen/)
```

## Status

- Phase 1: basic math. `add(a, b)` compiles to the exact target IR below.
- Performance pass: zero-GC arena runtime, Rust-parity LLVM attributes,
  alignment hints, and an LTO/dead-strip build pipeline. See
  [Performance and binary size](#performance-and-binary-size).

## Phase 1: basic math

Given `examples/add.ts`:

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

`statictsc` emits:

```llvm
; ModuleID = 'examples/add.ts'
source_filename = "examples/add.ts"

define noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = add i32 %a, %b
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```

With `--plain` the attributes and alignment hints are dropped and you get the
bare Phase 1 form:

```llvm
define i32 @add(i32 %a, i32 %b) {
entry:
  %0 = add i32 %a, %b
  ret i32 %0
}
```

## Setup

Requirements: Node.js 18+ and, to produce binaries, clang (LLVM 18) + lld.
Per-OS install commands, the `npm install -g statictsc` route, and a
hello-world walkthrough are in [docs/INSTALL.md](docs/INSTALL.md).

```bash
npm install
npm run build          # compiles src/ -> dist/ with tsc
node dist/index.js --version
```

## Usage

```bash
node dist/index.js <entry.ts> [more.ts ...] [options]      # or `statictsc ...` when installed
  -v, --version              print the version and exit
  -o, --output <file.ll>     output path for a single module (default: <input>.ll)
  -o, --output <dir>/        output directory: one <dir>/<module>.ll per module
  --link <exe>               build a native binary from every module + runtime/runtime.c
                             (entry module must declare `export function main`)
  --profile speed|size|debug build profile for --link (default: speed)
  --strict-exports           non-exported functions get `internal` linkage
  --number-mode i32|f64      lowering of `number` (default: i32)
  --plain                    no performance attributes or alignment hints
  --runtime-decls            always emit the runtime ABI prelude (arena + strings)
  --unchecked-indexing       drop array bounds checks (unsafe: out-of-range is UB; benchmarks only)
  --no-stack-alloc           keep every allocation in the arena (disables escape-analysed allocas; debugging)

# Example
node dist/index.js examples/add.ts -o build/add.ll

# Multi-file program: main.ts imports square from ./math and returns it as
# the exit code. `import`/`export`, the C `main` wrapper, and linkage are
# described in docs/wp5-modules.md.
node dist/index.js examples/multi/main.ts --link build/multi && ./build/multi; echo $?
# 49
```

Exit codes: `0` success, `1` compile error, `2` usage error, `3` toolchain
error (`--link` cannot find `clang`, or `scripts/build.sh` failed), `70`
internal compiler error (please report it; `STATICTSC_DEBUG=1` adds the stack
trace). Details in [docs/wp12-release.md](docs/wp12-release.md).
`npm run smoke` builds and runs every example that has a `main`.

`--number-mode` selects how the `number` keyword is lowered: `i32` (default,
integer arithmetic) or `f64` (`double`, floating point). The explicit type
names `i32`, `i64`, and `f64` are always available regardless of the mode.

Programs that call `Math.sin/cos/exp/log/pow` on non-constant arguments end
up calling libm; link them with `-lm` (`tests/run.js` does; `scripts/build.sh`
does not yet, see the TODO in [docs/wp7-runtime.md](docs/wp7-runtime.md)).

## Running the generated LLVM IR

```bash
# 1. Compile the IR together with a C driver into an executable
clang build/add.ll examples/main.c -o my_static_ts_app

# 2. Run it
./my_static_ts_app
# add(2, 3) = 5
```

`clang` may print `warning: overriding the module target triple`; the IR is
target-neutral and clang fills in the host triple, so this is harmless. Pass
`-Wno-override-module` to silence it.

Alternative, step by step with `llc`:

```bash
llvm-as build/add.ll -o build/add.bc      # validate + assemble to bitcode
llc -O2 -filetype=obj build/add.ll -o build/add.o   # IR -> native object file
clang build/add.o examples/main.c -o my_static_ts_app
```

Run LLVM's optimizer over the IR to see `alloca`/`load`/`store` locals promoted
to registers:

```bash
opt -S -O2 build/math.ll
```

Cross compile to WebAssembly or ARM64 with `llc -mtriple=wasm32-unknown-unknown`
or `llc -mtriple=aarch64-linux-gnu`.

## Performance and binary size

The goal is Rust-class output: no garbage collector, no embedded engine,
aliasing and purity facts handed to LLVM up front, and a link step that strips
everything unused. Measured on this repo's `add.ts` + `examples/main.c` +
`runtime/runtime.c`, x86_64 Linux, glibc dynamically linked:

| Profile | Bytes | What it does |
| --- | ---: | --- |
| `debug` | 9,552 | `clang a.ll runtime.c main.c` with defaults: no optimisation, symbols kept. |
| `speed` | 4,528 | `-O3 -flto`, section GC, unwind tables off, stripped. Rust `--release`. |
| `size` | 4,512 | `-Oz -flto`, plus hidden visibility and no stack protector. Rust `opt-level="z"`. |
| `wasm` | 279 | Freestanding `wasm32` module, every function exported, stripped. |

Reproduce with `npm run size-report`. A real CLI that uses strings and the
arena stays in the same low-kilobyte range because the whole runtime is
1.1 KB of machine code; nothing in the pipeline drags in a GC or interpreter.

### Build commands

`scripts/build.sh` wraps the exact clang invocations:

```bash
# Rust --release equivalent
scripts/build.sh build/app.ll runtime/runtime.c main.c -o app --profile speed
#   clang -fuse-ld=lld -O3 -flto -DNDEBUG -ffunction-sections -fdata-sections \
#         -fomit-frame-pointer -fno-asynchronous-unwind-tables -fno-unwind-tables -fno-plt \
#         -Wl,--gc-sections -Wl,--as-needed -Wl,-O2 -Wl,--build-id=none -s ...

# Smallest binary
scripts/build.sh build/app.ll runtime/runtime.c main.c -o app --profile size
#   as above with -Oz -fno-stack-protector -fvisibility=hidden

# WebAssembly module for Node / browsers (modules that do not use the C runtime)
scripts/build.sh build/add.ll -o build/add.wasm --profile wasm
node examples/node-host.mjs build/add.wasm
```

On macOS the script swaps `--gc-sections` for `-Wl,-dead_strip`. On Linux it
uses `lld` when available because GNU `ld` needs the gold plugin for LTO.
`-flto` matters more here than for C: LLVM sees the StaticTS module and the C
runtime as one unit, so `sts_str_len` inlines into a load and unreferenced
runtime functions vanish.

### Runtime: arena allocation, no GC

`runtime/runtime.c` (8.0 KB of source, 3.3 KB compiled at `-Oz`; budget 8 KB / 4 KB) provides:

| Symbol | Purpose |
| --- | --- |
| `sts_alloc_struct(size)` | Bump allocation, 8-byte rounded and aligned, uninitialised. |
| `sts_reset_arena()` | Recycle everything in O(1). Keeps the newest chunk, frees the rest, so a steady-state program stops calling `malloc` at all. |
| `sts_free_arena()` | Release all chunks. |
| `sts_arena_grow(size)` | Slow path: push a new chunk (at least 64 KB) and bump from it. |
| `sts_arena_mark()` / `sts_arena_release(mark)` | Arena scopes (WP6): a mark is the current bump address; release frees everything allocated since it (chunks pushed after it are freed). Compiled functions whose temporaries provably die with them bracket their body with these; `Arena.mark()` / `Arena.release(m)` expose them. |
| `sts_arena_used()` | Bytes bumped in the current chunk (`Arena.used()`), the number the memory tests watch. |
| `sts_str_new / concat / eq / len / print / from_i32 / from_i64 / from_f64` | Length-prefixed, NUL-terminated, immutable UTF-8 strings living in the arena. `from_f64` prints exactly what JavaScript's `String(x)` prints (shortest round-trip digits). |
| `sts_random()` | `Math.random`: xorshift64\*, seeded lazily from time and pid, 53 random bits in `[0, 1)`. |
| `sts_exit(code)` | `process.exit`. |
| `sts_read_file / write_file / append_file` | `readFileSync` / `writeFileSync` / `appendFileSync`: `open`/`read`/`write` syscalls, whole file in one arena string; a failure prints `statictsc: cannot read <path>` and exits 1. |

`Math.sqrt`, `Math.floor`, `Math.abs`, `Math.min`, ... are not runtime calls at
all: they lower to LLVM intrinsics (`llvm.sqrt.f64`, `llvm.smin.i32`, ...),
declared `readnone willreturn`, so a function built from them stays pure. See
[docs/wp7-runtime.md](docs/wp7-runtime.md).

Arena state is one global that the IR reads directly:

```llvm
%struct.sts_arena = type { i8*, i64, i64, i8* }   ; { buf, offset, capacity, chunk list }
@sts_arena = external global %struct.sts_arena, align 8
```

The compiler does not call the C `sts_alloc_struct`. It emits its own
`alwaysinline` copy of the fast path into every module that allocates
(`node dist/index.js x.ts --runtime-decls` shows it), so after inlining an
allocation of a fixed-size struct is two loads, an add, a compare, and a store:

```asm
movq  8(%r14), %rbx      ; offset
movq  16(%r14), %rcx     ; capacity
leaq  16(%rbx), %rax     ; offset + sizeof(struct)
cmpq  %rcx, %rax
ja    .slow              ; cold: call sts_arena_grow
movq  %rax, 8(%r14)      ; commit
addq  (%r14), %rbx       ; object = buf + old offset
```

Strings are `{ i64 len, i8 data[len], i8 0 }` behind an `i8*`. Literals will
be emitted as `private unnamed_addr constant` data with the same layout, so
they cost no allocation at all; heap strings come from the arena. The trailing
NUL keeps them passable to C. Because strings are immutable, sharing a pointer
is always safe and no copy is ever needed.

`tests/runtime_test.c` checks the arena and string semantics, and
`tests/ir/alloc_smoke.ll` links the compiler's inline allocator against
`runtime.c` and checks the bump distance, so a layout mismatch between the IR
struct and the C struct fails `npm test` rather than corrupting memory.

### LLVM attributes (Rust parity)

`src/codegen/attributes.ts` computes attributes from facts the checker already
proved. Every attribute is a guarantee, not a hint: a wrong one is undefined
behaviour, so nothing is emitted speculatively.

| Attribute | When | Why it is sound |
| --- | --- | --- |
| `nounwind` | always | StaticTS has no exceptions. |
| `willreturn` | no loops in the body | Straight-line code terminates. Loops (Phase 2) will clear this unless proven bounded. |
| `readnone` | touches only its own allocas and calls only `readnone` functions | Fixpoint over the call graph; matches what LLVM's own `function-attrs` pass infers. LLVM 16+ upgrades it to `memory(none)`. |
| `readonly` | as above, but a callee reads memory (e.g. `sts_str_len`) | Lets LLVM hoist the call out of loops. |
| `noundef` on params and returns | always | Every StaticTS value is initialised. |
| `zeroext` on `boolean` | always | Matches the C ABI for `bool` in a register. |
| `nonnull align 8` on `string` | always | No null type; literals and arena strings are 8-aligned. |
| `readonly` on `string` params | always | Strings are immutable. |
| `noalias` on `string` params | always | `noalias` only concerns memory that is modified, and nothing writes through a string pointer. |
| `nocapture` on `string` params | the param is never returned or passed to a call | Escape analysis in `attributes.ts`. |
| no `nonnull` / `dereferenceable` on `T \| null` params and returns | always | A null value would violate them; `align 8`, `readonly`, `nocapture` stay (WP6). |
| `alwaysinline allocsize(0)` | the inline allocator | Forces the fast path into callers; `allocsize` tells LLVM the object size. |
| `cold noinline` | `sts_arena_grow` | Keeps the slow path out of the hot loop. |
| `align 4/8` on `alloca`/`load`/`store` | always | Natural alignment, identical to clang and rustc. |

Example, `examples/strings.ts`: the parameter `a` is passed on (captured),
`b` is untouched:

```llvm
define noundef nonnull align 8 i8* @pick(i1 noundef zeroext %flag,
    i8* noundef nonnull noalias readonly align 8 %a,
    i8* noundef nonnull noalias readonly align 8 nocapture %b) #0
```

Integer arithmetic is emitted without `nsw`, so overflow wraps, exactly as in
Rust release builds. Adding `nsw` would allow a few more transformations at
the cost of making overflow undefined; that is a language decision left open.

### Interop with Node and npm: export, do not embed

Calling npm packages *from* a StaticTS binary would mean embedding a JS engine
(QuickJS adds about 2 MB, V8 tens of MB), marshalling every value across the
boundary at hundreds of cycles per call, and running a second, garbage
collected heap next to the arena. That erases the reasons to compile in the
first place, so StaticTS deliberately has no such bridge.

The supported direction is the reverse:

```
[ Node / Bun process ]  imports  [ StaticTS .wasm or .node addon ]
  I/O, HTTP, npm packages          math, parsing, data transforms, hot loops
                 cross the boundary once per batch, not once per element
```

- `scripts/build.sh --profile wasm` produces a module `WebAssembly.instantiate`
  loads directly; `examples/node-host.mjs` shows it. Exports use the plain C
  ABI (`i32`, `f64`, `i1`), so no glue code is needed for scalars.
- Native `.node` addons: `--emit-napi` writes a Node-API shim in C and
  `--profile napi` builds it with the module and the runtime into an addon
  that `require` loads; `examples/node-addon.mjs` shows it.
- Design the boundary around buffers: pass a whole array or string in, process
  it in native memory, return one result. An N-API call costs about 40 ns and
  a wasm call about 3 ns before any work is done (`node bench/ffi.mjs`).

Three flags write host-side declarations from the same signatures the IR was
emitted from (details in [docs/wp8-interop.md](docs/wp8-interop.md)):

```bash
node dist/index.js examples/add.ts -o build/add.ll \
  --emit-header build/add.h        # C prototypes: int32_t add(int32_t a, int32_t b);
  --emit-dts build/add.d.ts        # typings for the wasm exports + load(bytes)
  --emit-napi build/add_napi.c     # N-API shim with argument type checks

# C host: include runtime/statictsc.h (sts_str, arena API) via -Iruntime
clang -Iruntime -Ibuild build/add.ll runtime/runtime.c my_host.c -o my_host

# Node addon
scripts/build.sh build/add.ll runtime/runtime.c build/add_napi.c -o build/add.node --profile napi
node examples/node-addon.mjs build/add.node
# add(2, 3) = 5
# add("2", 3) throws: add: argument 1 (a) must be a number
```

`number` maps to `int32_t` (or `double` under `--number-mode f64`), `boolean`
to `bool`, `string` to `sts_str *` (`{ uint64_t len; char data[]; }`, arena
owned, valid until `sts_reset_arena()`). The N-API shim bridges scalar
functions and lists string-taking ones as skipped; the `.d.ts` does the same
for the freestanding wasm profile.

## Project layout

| File | Phase | Responsibility |
| --- | --- | --- |
| `src/parser.ts` | A. Parse | Wraps `ts.createSourceFile`; surfaces syntax errors. |
| `src/validator.ts` | 0. Validate | Forbidden-syntax sweep over the whole tree (`any`, `eval`, `delete`, prototypes, ...); hard fails before type checking. See `docs/wp0-validator.md`. |
| `src/types.ts` | B. Types | The StaticTS type model, its 1:1 LLVM type mapping, alignment. |
| `src/checker/index.ts` | B. Check | Core: signatures, function bodies, dispatch to handler tables; records types in side tables. |
| `src/checker/statements.ts`, `expressions.ts` | B. Check | One handler per `ts.SyntaxKind` (and per binary operator). Add a construct by adding an entry. |
| `src/checker/declarations.ts`, `scope.ts`, `program.ts` | B. Check | Signature collection, lexical scopes, the `CheckedProgram` data model. |
| `src/checker/builtins.ts`, `math.ts`, `io.ts` | B. Check | Builtin calls without a declaration: `Math.*`, `toI32/toI64/toF64`, `process.exit`, file I/O; contextual typing of numeric literals (`i64`). Mirrored by `src/codegen/emit/{builtins,math,io}.ts`. |
| `src/codegen/ir.ts` | C. Emit | Textual IR builder: functions, blocks, attribute groups, SSA temp numbering. |
| `src/codegen/emitter.ts` | C. Emit | Core: module assembly, function setup, runtime prelude, dispatch. |
| `src/codegen/emit/statements.ts`, `expressions.ts` | C. Emit | Lowering handlers keyed by `ts.SyntaxKind` / operator, mirroring the checker tables. |
| `src/codegen/attributes.ts` | C. Emit | Purity, loop, and escape analysis; attribute rendering. |
| `src/codegen/escape.ts` | C. Emit | Allocation escape analysis (WP6): which `new` / literals become allocas, which functions get an arena scope. |
| `src/checker/nullable.ts`, `arena.ts` | B. Check | `T \| null` (the `null` literal, narrowing) and the `Arena.*` builtins; lowered by `src/codegen/emit/arena.ts`. |
| `src/codegen/runtime.ts` | C. Emit | Runtime ABI declarations and the inline arena allocator. |
| `src/compiler.ts` | Driver | Chains the three phases. |
| `src/index.ts` | CLI | Argument parsing and file I/O. |
| `runtime/runtime.c` | Runtime | Arena allocator and string handler linked into every binary. |
| `scripts/build.sh` | Build | Optimised clang/LTO/wasm build profiles. |
| `scripts/size-report.sh` | Build | Before/after binary size table. |
| `tests/cases/` | Tests | One `.ts` per case with `.ll` golden, optional `.args`, `.err` (must reject), `.out` (native stdout). |
| `tests/run.js` | Tests | Discovers cases, runs llvm-as and native round trips, plus runtime and layout checks. |

The checker and the emitter are deliberately separate: the checker records
types and symbol bindings in side tables, and the emitter reads only those
tables. The emitter therefore contains no user-facing error handling; any node
it sees is already known to be valid.

## The StaticTS language (Phase 1 subset)

Type mapping:

| StaticTS | LLVM |
| --- | --- |
| `number` (i32 mode), `i32` | `i32` |
| `number` (f64 mode), `f64` | `double` |
| `i64` | `i64`, align 8; wrapping arithmetic, never the lowering of `number`; literals take the type from context (`let x: i64 = 5`, `x * 2`); convert with `toI64` / `toI32` / `toF64` |
| `boolean` | `i1` |
| `string` | `i8*` to `{ i64 len, i8 data[len], i8 0 }`, 8-aligned, immutable; literals are module constants, `.length` is the UTF-8 byte length |
| `T[]`, `Array<T>` | `%struct.sts_array*` to `{ i64 len, i64 cap, i8* data }`, arena-allocated, 8-aligned; `data` holds `cap` elements of `T`; `a[i]` is bounds-checked (see [docs/wp4-arrays.md](docs/wp4-arrays.md)) |
| `class C` | `%struct.C*` to `%struct.C = type { fields in declaration order }`, arena-allocated, natural alignment and padding exactly as clang lays out the same C struct. See [docs/wp2-classes.md](docs/wp2-classes.md). |
| `interface I` | `%struct.I*`, same layout rules; built from object literals, no methods |
| `T \| null` (`T` a class, interface, array or string) | the same pointer type as `T`, with the constant `null` as an extra value; only `=== null` / `!== null`, assignment, passing, and narrowing inside `if (p !== null)` are allowed on it (see [docs/wp6-memory.md](docs/wp6-memory.md)) |
| `void` | `void` |

Supported today:

- Top-level `function` declarations with fully annotated parameters and return type.
- `let` / `const` locals (initializer required; type inferred or annotated).
- Arithmetic `+ - * / %`, unary `-` and `!`, comparisons `< <= > >= === !==`.
- Calls between functions in the same file, in any order.
- `return`, expression statements, nested blocks.
- String literals (`"..."`, `` `...` ``) as deduplicated `private unnamed_addr constant` data; UTF-8, `\XX`-escaped.
- `a + b` on two strings (`sts_str_concat`); `"a" + 1` is rejected (no implicit conversion).
- `===` / `!==` on strings by content (`sts_str_eq`); `<` etc. on strings stay rejected.
- `s.length`: a direct `load i64` of the header (byte length, no call); functions that read it are `readonly`.
- Template literals `` `n=${n}` `` with string, number, and boolean holes, chained through `sts_str_concat`.
- `console.log(x)` for `x: string | number | boolean`, statement position only, lowered to `sts_print`.
- Number to string via `sts_str_from_i32` / `sts_str_from_f64` (`%.17g`; shortest round-trip formatting is WP7). See [docs/wp3-strings.md](docs/wp3-strings.md).
- `if` / `else` (including `else if` chains); conditions must be `boolean`, there is no truthiness.
- `while` loops.
- `do ... while` loops.
- `for (init; cond; update)` loops; a `let` in the initializer is scoped to the loop.
- `break` and `continue` (unlabelled) inside loops.
- `throw <expr>`: aborts via `llvm.trap` (no unwinding); the thrown value is discarded for now.
- Ternary `c ? a : b` with both arms of the same type, lowered to `phi`.
- Short-circuit `&&` / `||` on booleans (the right operand runs only when needed).
- Compound assignment `+= -= *= /= %=` on mutable numeric locals.
- Prefix and postfix `++` / `--` on mutable numeric locals (postfix yields the old value).
- Number to string via `sts_str_from_i32` / `from_i64` / `from_f64`; doubles print exactly as JavaScript's `String(x)` (`0.1`, `1e+21`, `1e-7`, `NaN`, `Infinity`, `-0` as `0`). See [docs/wp3-strings.md](docs/wp3-strings.md).
- `Math.sqrt/floor/ceil/trunc/round/sin/cos/exp/log/pow` (f64), `Math.abs/min/max` (any numeric type), `Math.PI`, `Math.E` as LLVM intrinsics and constants (`readnone`); `Math.random()` via `sts_random`. See [docs/wp7-runtime.md](docs/wp7-runtime.md).
- `i64` values, arithmetic, comparisons, parameters, returns, and the conversions `toI32(x)`, `toI64(x)`, `toF64(x)` (`sext`/`trunc`/`sitofp`/`llvm.fptosi.sat`).
- `process.exit(code)` (a `noreturn` call plus `unreachable`; counts as a terminator), `readFileSync(path)`, `writeFileSync(path, data)`, `appendFileSync(path, data)`.
- Arrays `T[]` / `Array<T>` of any element type (numbers, booleans, strings, nested arrays): literals `[a, b]` (one element type; `[]` needs an annotation), `new Array<T>(n)` zero-filled, `a[i]` reads and writes (`=`, `op=`), `.length`, `push(v)`, and `for (const x of a)` with `break` / `continue`.
- Bounds checking on every `a[i]`: an out-of-range index prints `index out of range: <i> >= <len>` and exits 1; `--unchecked-indexing` removes the check.
- `class` declarations with typed fields (literal initializers allowed), a constructor, and methods; `new C(args)` allocates in the arena and calls `@C.constructor`; methods are `@C.method` with `%this` first.
- Field reads `p.x` (`getelementptr inbounds` + `load`), writes `p.x = v` and `p.x op= v` (`store`), `this.x` inside methods; `readonly` fields assignable only in the constructor.
- Definite assignment: every field is initialised (inline literal or constructor) before it can be read; `this` cannot leak from a constructor early.
- `interface` declarations as struct types built from object literals (`const p: P = { x: 1, y: 2 }`, all fields required); `class C implements I` requires the identical field list, and a `C` converts to `I` by `bitcast`.
- `export class` / `export interface` and importing them by name (no renaming); methods of an imported class are `declare`d with the exporter's attributes.
- Escape-analysed stack allocation: a `new C(...)`, object literal, array literal, or `new Array<T>(<literal>)` whose value provably does not outlive the function (never returned, stored, pushed, re-assigned, or passed to a capturing callee) becomes an entry-block `alloca` instead of an arena bump; a temporary in a loop reuses one hoisted slot. `--no-stack-alloc` turns it off. See [docs/wp6-memory.md](docs/wp6-memory.md).
- Automatic arena scopes: a function whose arena temporaries (dynamic arrays, `push` growth, concatenated strings, number-to-string conversions, callee results) all die with it calls `sts_arena_mark` on entry and `sts_arena_release` before every `ret`, so a function called a million times keeps the arena flat.
- `Arena.reset()`, `Arena.mark(): i64`, `Arena.release(m: i64)`, `Arena.used(): i64` for explicit control (releasing while an object allocated after the mark is still referenced is undefined behaviour).
- `T | null` for class, interface, array, and string types: `null` typed by context, `=== null` / `!== null`, and narrowing to `T` inside `if (p !== null) { ... }`, after `if (p === null) { return ...; }`, in `while (p !== null)`, in the right operand of `p !== null && ...`, and in ternary arms; any field, method, index, or `.length` access on an un-narrowed nullable is an error.

Rejected with a diagnostic (`file:line:col: error: ...`):

- `any`, `unknown`, `var`, loose `==` / `!=`, generics, optional/rest/default
  parameters, destructuring, `async`, generators.
- Assignment to parameters or `const`s, mixing types in an operator, missing
  return on a non-`void` path, unreachable code after `return`.
- Class inheritance, `static`, getters/setters, optional fields, index
  signatures, parameter properties, `new` on an interface, object literals
  without a contextual type, `<` on struct values, reading a field before the
  constructor assigns it (see [docs/wp2-classes.md](docs/wp2-classes.md)).
- `null` where a plain `T` is expected, member access on a `T | null` that
  was not narrowed, comparing two nullable values directly, `number | null`.
- Anything else outside the current subset, which later phases add.

## Lowering rules

- Parameters are immutable and used directly as SSA values (`%a`).
- Locals live in an `alloca` slot hoisted to the top of `entry` (`%x.addr`);
  reads are `load`s, writes are `store`s. `opt -mem2reg` (part of `-O1`)
  turns these back into registers, so this costs nothing at runtime.
- Basic blocks and parameters are always named, so unnamed temporaries in
  every function start at `%0`, exactly matching LLVM's numbering rules.
- Runtime declarations are emitted only for symbols the module actually uses
  (`--runtime-decls` forces all of them), so a pure-math module links with
  nothing but libc.
- Float constants are emitted as IEEE-754 hex (`0x4000000000000000`) because
  LLVM rejects decimal literals that do not round-trip exactly.

## Tests

```bash
npm test                 # everything
node tests/run.js locals # only cases whose name contains "locals"
npm run test:update      # write missing .ll goldens for new cases
npm run check            # typecheck without emitting
npm run lint             # Biome style lint of src/, tests/*.js, examples/ (advisory, never a compile gate)
```

Each `tests/cases/<name>.ts` is compiled and compared with `<name>.ll`
(module header excluded), assembled with `llvm-as`, and, when `<name>.out`
exists, linked with `<name>.c` or the default `tests/driver.c` (which prints
`test()`) plus `runtime/runtime.c`, run, and compared. `<name>.err` marks a
case that must be rejected with that message, and `<name>.args` adds CLI
flags. The runner also unit-tests `runtime.c`, links the inline allocator
against the C arena, and builds the `size` and `wasm` profiles. Toolchain
steps are skipped when LLVM is not installed.

CI runs the same steps on Ubuntu and macOS with LLVM 18 and posts a binary
size table per run; see [docs/wp10-ci.md](docs/wp10-ci.md) for the matrix,
how to reproduce it locally, and the diagnostic format (`file:line:col`
summary plus a source excerpt with a `^~~~` caret line).

## Roadmap

The full plan, cut into parallelisable work packages with acceptance
criteria and agent briefs, is in [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md).
Summary:

- Phase 2: `if` / `while` / `for` control flow with `br` and `phi`.
- Phase 3: classes and interfaces as `%struct.*` types, `getelementptr` field access.
- Phase 4: string literals and operations lowered onto `runtime.c` (`sts_str_*`).
- Phase 5: `export` to N-API addon and `--target` cross builds (ARM64, wasm with WASI).
- Phase 6: optional reference counting for structs that outlive an arena reset.
- Phase 7: `llvm-bindings` backend as an alternative to text emission.
