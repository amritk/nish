# The CLI

Everything Nish does goes through one command, `nish`. It has two shapes:
`nish run`, which compiles a program and runs it at once, and the plain
`nish <files>`, which writes LLVM IR, a native binary or the files another
language needs to call your code. This page covers the flags you will reach
for; `nish --help` prints the whole list on stdout and exits 0.

```
nish run [flags] <file.ts> [args ...]    compile, cache and run
nish <entry.ts> [more.ts ...] [flags]    compile: IR, a binary, sidecars
nish --version | --help
```

## Running a program: `nish run`

`nish run` is the shape for scripts and for trying things out. It compiles the
file, links it into a cache, and starts it with the rest of the command line
as its arguments:

```ts nish:ok
export const main = (): i32 => {
  const args = process.argv;
  for (let i: i32 = 1; i < args.length; i++) {
    console.log(`argument ${i}: ${args[i]}`);
  }
  return 0;
};
```

```console
$ nish run args.ts one two --help
argument 1: one
argument 2: two
argument 3: --help
```

- **Flags before the file are the compiler's, everything after it is the
  program's**, `--help` included. `nish run --number-mode f64 tool.ts x`
  compiles in f64 mode and hands the program `x`.
- **The program owns the terminal.** Its stdin, stdout and stderr are the
  program's, and so is the exit status once it starts. Performance warnings
  are not printed under `nish run`, because stderr belongs to the program; run
  `nish tool.ts` without `run` to see them.
- **Every run compiles, and a link happens only when something changed.**
  Compiling takes milliseconds. The first run after an edit links the program
  (with the fast `debug` profile, unless you pass `--profile`), and every run
  after that starts the binary it already linked.
- **The cache is safe to delete.** Programs live in `$XDG_CACHE_HOME/nish/run`,
  or `~/.cache/nish/run` when that is unset, one entry per program. Beside it,
  `nish/runtime` keeps the C runtime compiled once per profile, so a link only
  compiles your own modules. Removing either directory costs one rebuild and
  nothing else.

Flags that write a file the run would keep to itself — `-o`, `--link`,
`--target`, the `--emit-*` sidecars and `--profile wasi` — are usage errors
under `nish run`.

## Compiling: IR and binaries

Without `run`, `nish` compiles the entry file and every module it imports.

| Command | What it writes |
| --- | --- |
| `nish app.ts` | `app.ll`, the LLVM IR, beside the source |
| `nish app.ts -o out.ll` | the IR at that path (one module only) |
| `nish app.ts -o build/` | one `.ll` per module in `build/` (the trailing `/` matters) |
| `nish app.ts --link app` | a native binary `app`, plus its IR; the entry must `export const main` |

`--link` needs `clang` and `lld` on your `PATH`; installing them is in
[Installation](../getting-started/installation.md). The flags you are most
likely to add to it:

- **`--profile speed|size|debug|wasi`** — `speed` (the default) is `-O3` with
  link-time optimisation and a stripped binary; `size` optimises for bytes;
  `debug` links fastest and keeps symbols; `wasi` builds a `wasm32-wasi`
  module instead of a native binary.
- **`-g`** — DWARF debug info, so `gdb` and `lldb` step through your `.ts`
  source.
- **`--number-mode f64`** — makes a bare `number` a 64-bit float rather than
  the default `i32`. Code that spells its widths (`i32`, `f64`) means the same
  thing in both modes.
- **`--target <triple>` or `--target host`** — stamps the IR with a target's
  data layout, for cross-compiling or for reading optimised IR by hand.
  `--link` does not need it.

The sidecars that let C, Node and WebAssembly call your code —
`--emit-header`, `--emit-napi`, `--emit-dts` — have a page of their own:
[Calling Nish from other languages](interop.md).

## Reading diagnostics

An error prints with its position and an excerpt, and the compile exits 1:

```ts nish:err NL1047
export const main = (): i32 => {
  const x: i32 = 1;
  if (x == 1) {
    return 1;
  }
  return 0;
};
```

```console
$ nish bad.ts
bad.ts:3:7: error: Loose equality is forbidden; use === / !==
  3 |   if (x == 1) {
    |       ^~~~~~
```

A compile reports every error it finds, in source order, up to 20. Besides
errors there are **performance warnings** — the compiler took a slow path and
names the faster one — which are on by default, print on stderr and never
change the exit code. `--no-warn-performance` silences them.

### `--json`, for tools

`--json` prints each diagnostic as one flat JSON object per line on stdout,
with nothing else on stdout:

```console
$ nish bad.ts --json
{"file":"bad.ts","line":3,"column":7,"endLine":3,"endColumn":13,"severity":"error","code":"NL1047","message":"Loose equality is forbidden; use === / !==","fix":[{"line":3,"column":9,"endLine":3,"endColumn":11,"text":"==="}]}
```

- Lines and columns are 1-based, and `endLine` / `endColumn` are exclusive.
- **`code` is the field to match on.** `NL1047` will mean the same rule in the
  next release; the wording of `message` may improve. The first digit names
  the stage that found it: `NL1xxx` forbidden syntax, `NL2xxx` the type
  checker, `NL3xxx` modules and the driver, `NL4xxx` the interop sidecars,
  `NL7xxx` deprecations, `NL8xxx` portability, `NL9xxx` performance.
- **`severity`** is `"error"`, `"performance"`, `"portability"` or
  `"deprecation"`. Only errors fail a compile.
- Failures with no source position — no usable `clang`, an internal error —
  are JSON objects too, so under `--json` you never need to read stderr.
- The standard library has a reader for these objects:
  [`nish/json`](standard-library.md#nishjson).

### `--fix`

Some diagnostics carry a `fix`: the edits that make them go away, attached
only when the rewrite plainly means what you wrote. `nish --fix <files>`
applies them to the files you name, recompiles, and repeats until nothing
changes, then reports what is left exactly as a plain run would, and exits
with that run's code:

```console
$ nish --fix bad.ts
fixed bad.ts (1 edit)
$ grep '===' bad.ts
  if (x === 1) {
```

It never edits a standard-library module or anything under `node_modules`,
and it writes no IR, so `-o` and `--link` are usage errors beside it. **It
rewrites your files in place with no backup**, so run it on a tree you have
committed.

## Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | success |
| 1 | the program was rejected: a compile error, or an input file that does not exist |
| 2 | usage error: an unknown flag, a missing argument, no input files |
| 3 | toolchain error: no usable `clang`, or the link failed (the `.ll` files are still written) |
| 70 | internal compiler error: a bug in `nish`, not in your program — please [report it](https://github.com/amritk/nish/issues) with the input; `NISH_DEBUG=1` adds a stack trace |

`nish run` answers these codes until the program starts, and the program's own
exit status after that — the value `main` returns, `1` for a panic such as an
index out of range, or `128 + n` for a signal.

## Asking what a program can do

A few flags report on a program rather than build it; each leaves the IR
unchanged.

- **`--capabilities`** prints, on stderr, what the program can reach — files,
  processes, the network, the environment, the clock and so on — and
  `--allow <cap>` / `--deny <cap>` refuse a program that reaches more than you
  grant. `nish run --capabilities hello.ts` prints
  `capabilities: none (deterministic)` before the program's own output. See
  [Capabilities](../../LANGUAGE.md#capabilities).
- **`--deny-panics`** turns every panic the compiler cannot prove away into an
  error, and `--emit-panics <file.json>` lists them all
  ([The no-panic scope](../../LANGUAGE.md#the-no-panic-scope)).
- **`--emit-ast`** and **`--emit-checked`** print what the compiler parsed and
  what its checker recorded, one line per node.

The reference for diagnostics and the flags that shape them is
[Diagnostics and debugging flags](../../LANGUAGE.md#diagnostics-and-debugging-flags);
the exit codes and the caches are also described in
[INSTALL.md](../../INSTALL.md#4-exit-codes).
