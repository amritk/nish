# WP5: Modules, entry point, linkage

AmritScript programs can span several files. Each file is one module and becomes
one LLVM IR module (`.ll`); `scripts/build.sh` links them with the C runtime
into a native binary. This document is the reference for how modules resolve,
how the process entry is produced, which functions are visible to the linker,
and how the CLI drives all of it.

## Modules

### `export`

`export` is accepted on top-level function declarations and nothing else:

```ts
export function square(n: number): number {   // callable from other modules
  return n * n;
}

function helper(n: number): number { ... }      // module-private (see Linkage)
```

`export const`, `export { f }`, `export * from`, `export default`, and
`export =` are rejected with a message that names the form. `export class` /
`export interface` are accepted since WP2 (see docs/wp2-classes.md).

### `import`

The only import form is a named import from a relative specifier:

```ts
import { square, cube as pow3 } from "./math";
```

- The specifier must start with `./` or `../`. Bare specifiers (`"math"`,
  `"lodash"`) are rejected: AmritScript has no package resolution.
- The `.ts` extension is optional. `./math.js` is also accepted and mapped to
  `./math.ts`, matching the TypeScript convention for ESM-style sources.
- The path is resolved relative to the *importing* file, not the working
  directory.
- `as` renames the binding locally; the LLVM symbol stays the exporter's name.
- Default imports (`import m from`), namespace imports (`import * as m`),
  side-effect imports (`import "./m"`), and type-only imports are errors.
- Importing a name that the module does not export is an error. The message
  distinguishes "declared but not exported" from "no such function".
- Importing the same local name twice, or a name that is also declared in
  the importing module, is an error.

### Whole-program compilation

`src/compilation.ts` owns the program:

1. **Load.** The root file(s) are parsed; every `import` is resolved and the
   target is loaded recursively. Each file is parsed exactly once (keyed by
   absolute path), so cycles terminate. As soon as a module is parsed its
   signatures are collected (checker pass 1), before any body is checked.
2. **Bind.** Every import is bound to the exporter's signature (pass 1b), so
   calls into other modules are checked with full parameter and return types.
3. **Symbol check.** Any two functions that would both be external symbols
   in the final link must have different names (see Linkage). Clashes are a
   compile error instead of a linker error.
4. **Check bodies** (pass 2) for every module.
5. **Analyse.** `analyzeFunctions` runs over *all* modules at once, keyed by
   LLVM symbol, so purity, loop, and escape facts are program-wide.
6. **Emit** one IR module per source module.

Cycles are allowed: `main.ts` may import from `other.ts` while `other.ts`
imports from `main.ts`. Because signatures of every module are known before
any body is checked, and the link step sees all modules, nothing about a
cycle is special (`tests/link/cycle`).

### Imported functions in IR

An imported function appears in the importer as a `declare` that carries
*exactly* the parameter attributes, return attributes, and function attribute
set of the exporter's `define`. Both are rendered from the same signature and
the same program-wide facts table:

```llvm
; math.ll
define noundef i32 @square(i32 noundef %n) #0 { ... }
attributes #0 = { nounwind willreturn readnone }

; main.ll
declare noundef i32 @square(i32 noundef) #0
attributes #0 = { nounwind willreturn readnone }
```

This is the point of compiling the program as a whole: the optimiser working
on `main.ll` knows `square` is `readnone` and `willreturn` and can hoist,
fold, or drop the call exactly as if it were local. The attribute-group
*numbers* may differ between modules (they are interned per module); the
contents are identical, and `tests/run.js` checks that for every link test.

## Entry point

An entry module that declares

```ts
export function main(): number { ... }   // or  export function main(): void
```

gets a C-ABI entry. The chosen scheme is **rename + wrapper**:

- The user's function is emitted under the symbol `@amrit_main`
  (`FunctionSig.name`; the source name stays `main` for diagnostics).
- The emitter adds

  ```llvm
  define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
  entry:
    %0 = call i32 @amrit_main()
    call void @amrit_free_arena()
    ret i32 %0
  }
  attributes #1 = { nounwind }
  ```

  For a `void` main the wrapper returns `0`. The arena is lazy, so nothing is
  initialised; `amrit_free_arena` releases every chunk on the way out.

Why rename rather than keep `@main` and skip the wrapper? One scheme covers
both return types, the arena is always released, the wrapper's signature is
the one every libc start-up code expects (`argc`/`argv` are accepted now and
exposed in WP7), and an importer that does `import { main } from "./main"`
simply calls `@amrit_main` like any other symbol.

Rules:

- Only the **entry module** (the first file on the command line) may declare
  `export function main`; in any other module it is an error.
- `main` takes no parameters yet (`process.argv` arrives in WP7).
- `main` returns `void` or an `i32`-lowered `number`. Under
  `--number-mode f64` write `main(): i32`.
- A non-exported `function main` is not an entry: it is emitted as `@main`
  with its own signature, exactly as before WP5 (so C drivers such as
  `tests/driver.c` keep working with library-style modules).
- `amrit_` is a reserved prefix for function names.

`--link` requires the entry module to declare `export function main`.

## Linkage

| Function | default | `--strict-exports` |
| --- | --- | --- |
| `export function f` | external (`define ... @f`) | external |
| `function f` | external | `define internal ... @f` |
| entry `export function main` | external `@amrit_main` + external `@main` wrapper | same |
| inline arena allocator | `internal` | `internal` |

Default linkage stays external so C drivers and the wasm profile
(`--export-all`) keep seeing every function. `--strict-exports` is the
Rust-like mode: non-exported functions become `internal`, which lets LLVM
inline, specialise, or drop them and keeps them out of the binary's symbol
table.

Because an external symbol is global to the whole link, the compiler rejects
name clashes up front:

- Two modules exporting the same name is always an error.
- Two modules defining the same non-exported name is an error *without*
  `--strict-exports` (both would be external); with it they are `internal`
  and coexist.
- A module defining `main` while the entry has an entry wrapper is an error
  unless `--strict-exports` makes it internal.

## CLI

```
amritc <entry.ts> [more.ts ...] [options]
  -o, --output <file.ll>     output path for a single module (default: <input>.ll)
  -o, --output <dir>/        output directory: one <dir>/<module>.ll per module
  --link <exe>               build a native binary from every module + runtime/runtime.c
  --profile speed|size|debug build profile for --link (default: speed)
  --strict-exports           non-exported functions get `internal` linkage
  --number-mode i32|f64      lowering of `number` (default: i32)
  --plain                    no performance attributes or alignment hints
  --runtime-decls            always emit the runtime ABI prelude (arena + strings)
```

Output rules:

- One resulting module: `-o file.ll` writes it there (as before); with no
  `-o` it goes next to the source as `<input>.ll`.
- Several modules (more than one input, or an import graph): `-o <dir>/`
  writes `<dir>/<basename>.ll` per module (a trailing slash or an existing
  directory marks a directory). If two modules share a basename, those two
  use their path relative to the entry's directory with `/` turned into `_`.
  A single `-o file.ll` for several modules is an error.
- With `--link <exe>` and no `-o`, intermediates go next to the binary:
  `<exe>.ll` for one module, `<exe>.modules/<basename>.ll` for several.

`--link` runs `bash scripts/build.sh <every .ll> runtime/runtime.c -o <exe>
--profile <profile>` and prints the binary path and size that the script
reports. The runtime is always linked because the entry wrapper calls
`amrit_free_arena`.

Example (`examples/multi/`):

```bash
node dist/index.js examples/multi/main.ts --link build/multi && ./build/multi; echo $?
# linked build/multi: 4488 bytes (speed)
# 49
```

## Tests

- `tests/cases/`: `export_fn`, `export_strict` (`--strict-exports` shows
  `define internal`), `entry_main` and `entry_main_void` (wrapper goldens,
  linked without `tests/driver.c` because the source contains
  `export function main`), and `reject_*` cases for `main` with parameters,
  non-function exports, `export default`, default/namespace/side-effect/bare
  imports, and a missing module.
- `tests/link/<name>/`: whole programs built with `--link`. Since nothing can
  print until WP3 lands `console.log`, each `main` returns its result and
  `expected.code` holds the exit code; `expected.out` is the expected stdout
  (empty for now). `two_file` also carries goldens for both modules,
  `diamond` checks that a shared dependency is compiled once, `cycle`
  imports in both directions, `strict` asserts `define internal` on a
  helper via `expected.ir`, and the negative directories cover a missing
  module, a non-exported import, an unknown export, duplicate imports,
  duplicate exports across modules, `main` with parameters, `--link` without
  `main`, and `export function main` outside the entry. Every positive link
  test is assembled with `llvm-as`, verified with `opt -passes=verify`, and
  checked for `declare`/`define` attribute agreement across modules.

## Not in this package

- `.d.amrit.json` sidecars from the master plan are unnecessary: the
  Compilation has every module in memory, so the importer's `declare` is
  rendered from the exporter's actual signature and facts. Separate
  compilation of a library against a sidecar can be added when a use case
  needs it.
- `process.argv` (WP7), `console.log` (WP3), header generation (WP8).
