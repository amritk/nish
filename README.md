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

Requirements: Node.js 18+ and, to produce binaries, an LLVM toolchain
(`clang`, optionally `llc` / `llvm-as` / `opt`).

```bash
# Ubuntu / Debian
sudo apt install clang llvm
# macOS
brew install llvm   # or use Xcode's clang

npm install
npm run build          # compiles src/ -> dist/ with tsc
```

## Usage

```bash
node dist/index.js <input.ts> [options]
  -o, --output <file.ll>     output path (default: <input>.ll)
  --number-mode i32|f64      lowering of `number` (default: i32)
  --plain                    no performance attributes or alignment hints
  --runtime-decls            always emit the runtime ABI prelude (arena + strings)

# Example
node dist/index.js examples/add.ts -o build/add.ll
```

`--number-mode` selects how the `number` keyword is lowered: `i32` (default,
integer arithmetic) or `f64` (`double`, floating point). The explicit type
names `i32` and `f64` are always available regardless of the mode.

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

`runtime/runtime.c` (about 4 KB of source, 1.1 KB compiled) provides:

| Symbol | Purpose |
| --- | --- |
| `sts_alloc_struct(size)` | Bump allocation, 8-byte rounded and aligned, uninitialised. |
| `sts_reset_arena()` | Recycle everything in O(1). Keeps the newest chunk, frees the rest, so a steady-state program stops calling `malloc` at all. |
| `sts_free_arena()` | Release all chunks. |
| `sts_arena_grow(size)` | Slow path: push a new chunk (at least 64 KB) and bump from it. |
| `sts_str_new / concat / eq / len / print / from_i32 / from_f64` | Length-prefixed, NUL-terminated, immutable UTF-8 strings living in the arena. |

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
- Native `.node` addons (N-API) and `--target` cross builds are on the roadmap;
  the emitted IR is target-neutral, so they are linker work, not compiler work.
- Design the boundary around buffers: pass a whole array or string in, process
  it in native memory, return one result.

## Project layout

| File | Phase | Responsibility |
| --- | --- | --- |
| `src/parser.ts` | A. Parse | Wraps `ts.createSourceFile`; surfaces syntax errors. |
| `src/types.ts` | B. Types | The StaticTS type model, its 1:1 LLVM type mapping, alignment. |
| `src/checker.ts` | B. Check | Enforces the language rules and annotates every expression with its type. |
| `src/codegen/ir.ts` | C. Emit | Textual IR builder: functions, blocks, attribute groups, SSA temp numbering. |
| `src/codegen/emitter.ts` | C. Emit | AST visitor that lowers a checked program to IR. |
| `src/codegen/attributes.ts` | C. Emit | Purity, loop, and escape analysis; attribute rendering. |
| `src/codegen/runtime.ts` | C. Emit | Runtime ABI declarations and the inline arena allocator. |
| `src/compiler.ts` | Driver | Chains the three phases. |
| `src/index.ts` | CLI | Argument parsing and file I/O. |
| `runtime/runtime.c` | Runtime | Arena allocator and string handler linked into every binary. |
| `scripts/build.sh` | Build | Optimised clang/LTO/wasm build profiles. |
| `scripts/size-report.sh` | Build | Before/after binary size table. |
| `tests/run.js` | Tests | Golden IR, toolchain round trip, runtime and layout tests, negative cases. |

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
| `boolean` | `i1` |
| `string` | `i8*` (reserved; no string operations yet) |
| `void` | `void` |

Supported today:

- Top-level `function` declarations with fully annotated parameters and return type.
- `let` / `const` locals (initializer required; type inferred or annotated).
- Arithmetic `+ - * / %`, unary `-` and `!`, comparisons `< <= > >= === !==`.
- Calls between functions in the same file, in any order.
- `return`, expression statements, nested blocks.

Rejected with a diagnostic (`file:line:col: error: ...`):

- `any`, `unknown`, `var`, loose `==` / `!=`, generics, optional/rest/default
  parameters, destructuring, `async`, generators.
- Assignment to parameters or `const`s, mixing types in an operator, missing
  return on a non-`void` path, unreachable code after `return`.
- Anything else outside the Phase 1 subset (control flow, objects, classes,
  strings), which later phases add.

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
npm test
```

Checks that `examples/add.ts` produces the golden IR (`tests/expected/add.ll`
and the `--plain` form), assembles it with `llvm-as`, links it with
`examples/main.c`, runs the binary, unit-tests `runtime.c`, links the inline
allocator against the C arena, builds the `size` and `wasm` profiles, and
confirms invalid programs are rejected. Toolchain steps are skipped when LLVM
is not installed.

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
