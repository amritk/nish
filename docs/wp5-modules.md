# WP5: Modules, entry point, linkage

**Status: landed** before the first release (merged as `wp5/modules`,
160ad63): `export`/`import` across files, whole-program compilation, the
`main` entry wrapper, linkage and `--link`. The rules are normative in
[LANGUAGE.md: `export` and `import`](LANGUAGE.md#export-and-import) and
[`main`](LANGUAGE.md#main); the IR is in
[IR_COOKBOOK.md](IR_COOKBOOK.md#modules-the-exporter). The code is
`src/compilation.ts` (loading, binding, the symbol check) and `src/emit.ts`;
the goldens are `tests/cases/export_*`, `entry_main*`, and the whole programs
under `tests/link/`.

## Modules

Each file is one module and one LLVM IR module (`.ll`); `--link` builds every
module and the C runtime into one binary.

As built, `export` was accepted on top-level functions only (classes and
interfaces followed with WP2), and the only import was a named import from a
relative specifier resolved against the importing file. `as` renames the
local binding while the LLVM symbol stays the exporter's. Since then `export` has reached `enum`, `type` and `const`, and bare
specifiers resolve to the standard library (`nish/<module>`), builtin modules
(`nish:`) and packages ([wp21-packages.md](wp21-packages.md)).

### Whole-program compilation

The compiler holds the whole program, in this order:

1. **Load.** Parse the root files and every import, recursively, each file
   once (keyed by absolute path), so cycles terminate. Each module's
   signatures are collected as soon as it is parsed.
2. **Bind** every import to the exporter's signature, so cross-module calls
   are checked with full types.
3. **Check symbols**: two functions that would collide in the program are an
   error here rather than at link time.
4. **Check bodies** for every module.
5. **Analyse** all modules at once, keyed by LLVM symbol, so purity, loop and
   escape facts are program-wide.
6. **Emit** one IR module per source module.

Import cycles are allowed and nothing about them is special, because every
signature is known before any body is checked (`tests/link/cycle`).

### Imported functions in IR

An imported function appears in the importer as a `declare` carrying
*exactly* the parameter attributes, return attributes and function attribute
set of the exporter's `define`, both rendered from the same signature and the
same program-wide facts:

```llvm
; math.ll
define noundef i32 @square(i32 noundef %n) #0 { ... }
attributes #0 = { nounwind willreturn readnone }

; main.ll
declare noundef i32 @square(i32 noundef) #0
attributes #0 = { nounwind willreturn readnone }
```

This is the point of compiling the program as a whole: the optimiser working
on `main.ll` can hoist, fold or drop a call to `square` as if it were local.
Attribute-group *numbers* may differ between modules; the contents may not,
and `tests/run.js` checks the agreement for every link test.

## Entry point

The entry module's exported `main` (written today as
`export const main = (): number => { ... }`, or `: void`) gets a C-ABI entry
by **rename and wrapper**: the user's function is emitted as `@nish_main`,
and the compiler adds a C `@main(i32 %argc, i8** %argv)` that calls it,
calls `nish_free_arena`, and returns its value (or `0` for `void`).

Why rename rather than keep `@main` and skip the wrapper: one scheme covers
both return types, the arena is always released, the wrapper has the
signature every libc start-up expects (which is where WP7 later built
`process.argv`), and an importer of `main` simply calls `@nish_main` like any
other symbol.

Only the entry module (the first file on the command line) may export `main`;
it takes no parameters and returns `void` or an `i32` (`main(): i32` under
`--number-mode f64`). A non-exported `main` is an ordinary function named
`@main`, so C drivers such as `tests/driver.c` keep working. `--link`
requires an exported `main`, and `nish_` is a reserved prefix.

## Linkage

| Function | default | `--no-strict-exports` |
| --- | --- | --- |
| `export const f` | external (`define ... @f`) | external |
| `const f` (not exported) | `define internal ... @f` | external |
| entry `export const main` | external `@nish_main` + external `@main` wrapper | same |
| inline arena allocator | `internal` | `internal` |

WP5 made every function an external symbol by default, with
`--strict-exports` as the opt-in that made non-exported functions `internal`.
WP15 §3 swapped the default: `internal` is what lets LLVM inline, specialise
or drop a function and keeps it out of the symbol table, a win on both speed
and size, so it is now the default and `--no-strict-exports` is the opt-out
for a C driver that calls something the module does not export.

**A function name is unique across the whole program, exported or not, in
either mode.** `internal` keeps a name away from the linker, but the
whole-program facts are keyed by symbol name, so two functions sharing one
would get each other's attributes: a miscompile rather than a link error.
That is why the rule does not consult the flag
(`tests/link/duplicate_internal`; the check used to be skipped under an
explicit `--strict-exports`).

## Output files

Two modules never share an output file: one module goes to `-o file.ll` (or
`<input>.ll`), several need `-o <dir>/` and get one `.ll` each, with
same-named modules told apart by their path from the entry. The current rule
is in [LANGUAGE.md](LANGUAGE.md#export-and-import).

## Not built

- **`.d.nish.json` sidecars.** The master plan specified them, but they are
  unnecessary: the compilation has every module in memory, so the importer's
  `declare` is rendered from the exporter's actual signature and facts.
  Separate compilation of a library against a sidecar can be added when a use
  case needs it ([wp21-packages.md](wp21-packages.md) keeps the shape it would
  take).
