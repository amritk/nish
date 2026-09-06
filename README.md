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

## Phase 1 status: basic math

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
node dist/index.js <input.ts> [-o <output.ll>] [--number-mode i32|f64]

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

## Project layout

| File | Phase | Responsibility |
| --- | --- | --- |
| `src/parser.ts` | A. Parse | Wraps `ts.createSourceFile`; surfaces syntax errors. |
| `src/types.ts` | B. Types | The StaticTS type model and its 1:1 LLVM type mapping. |
| `src/checker.ts` | B. Check | Enforces the language rules and annotates every expression with its type. |
| `src/codegen/ir.ts` | C. Emit | Textual IR builder: functions, blocks, SSA temp numbering. |
| `src/codegen/emitter.ts` | C. Emit | AST visitor that lowers a checked program to IR. |
| `src/compiler.ts` | Driver | Chains the three phases. |
| `src/index.ts` | CLI | Argument parsing and file I/O. |
| `tests/run.js` | Tests | Golden IR comparison, toolchain round trip, negative cases. |

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
- Float constants are emitted as IEEE-754 hex (`0x4000000000000000`) because
  LLVM rejects decimal literals that do not round-trip exactly.

## Tests

```bash
npm test
```

Checks that `examples/add.ts` produces the golden IR in `tests/expected/add.ll`,
assembles it with `llvm-as`, links it with `examples/main.c`, runs the binary,
and confirms invalid programs are rejected. Toolchain steps are skipped when
LLVM is not installed.

## Roadmap

- Phase 2: `if` / `while` / `for` control flow with `br` and `phi`.
- Phase 3: classes and interfaces as `%struct.*` types, `getelementptr` field access.
- Phase 4: strings with a length-prefixed runtime and a small C runtime library.
- Phase 5: `llvm-bindings` backend as an alternative to text emission.
