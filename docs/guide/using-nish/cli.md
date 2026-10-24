# The CLI

Everything Nish does goes through one command, `nish`. It has two shapes:
`nish run`, which compiles a program and runs it at once, and the plain
`nish <files>`, which writes LLVM IR, a native binary or the files another
language needs to call your code. This page covers the flags you will reach
for; `nish --help` prints the whole list on stdout and exits 0, grouped by what
the flags are for (Build, Check, Capabilities, Interop, Inspect, Code
generation) and followed by the exit codes and a few examples.

```
usage: nish <file.ts> [more.ts ...] [flags]   compile to LLVM IR
       nish run [flags] <file.ts> [args ...]  build, cache and run it
       nish -v, --version | -h, --help
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
- **`--cpu x86-64-v3`** — compiles your program and the runtime for x86-64
  CPUs with AVX2 (Intel Haswell, AMD Excavator and later), which can make
  tight loops faster. It is the one level `nish` accepts; anything else, and
  the flag with `--profile wasi` or a non-x86-64 `--target`, is refused with
  exit 2. What your program computes does not change. A binary built with it
  **crashes with `SIGILL` on a CPU without AVX2**, so use it only for binaries
  that stay on machines you know; ship anything else without it.
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

## Writing TypeScript: `--emit-ts`

`nish app.ts --emit-ts out/` writes your program back out as TypeScript that
Node runs, one file per module, and no IR:

```sh
nish app.ts --emit-ts out/
node --experimental-strip-types out/entry.ts
```

The output imports its runtime from the `nish` package, as `nish/runtime`, so
Node has to find `nish` from `out/`, the way it finds any dependency. A program
that uses `using` also needs `--js-explicit-resource-management`.

Inside `out/`:

- **Your modules** keep their paths relative to the directory they share:
  `app.ts` and `lib/tally.ts` are written as `out/app.ts` and
  `out/lib/tally.ts`.
- **Each standard-library module** your program imports is written under
  `nish/`, so `nish/pair` becomes `out/nish/pair.ts`.
- **`entry.ts`** runs your `main` and exits with the number it returns.

Imports are rewritten so Node can follow them. A `nish:` builtin becomes
`nish/runtime`, the one package the output imports, except `nish:secret`,
which is written like a standard-library module, as `nish/secret.ts`. A `nish/x` or relative
import becomes a relative path ending in `.ts`. An imported interface or type
alias is marked `import { type Pair }`. A module that needs none of this is
written unchanged, byte for byte.

Some constructs JavaScript spells differently are rewritten too:

- **`x.orReturn()`** becomes a local, `const __t0 = x;`, and
  `if (__t0.isErr()) return Err(__t0.error);` before its statement, with
  `__t0.value` in its place. Where that would change when the call runs —
  the right of `&&`, a branch of `?:`, a loop's condition, after a call in
  the same statement — it stays a call, and the function around it gets a
  `try` that turns the call's throw into the `Err` it returns.
- **An `enum`** becomes a `const` object of its members' values and a type of
  the same name: `enum Shape { Circle, Square = 4 }` is written as
  `const Shape = { Circle: 0, Square: 4 } as const;` and
  `type Shape = (typeof Shape)[keyof typeof Shape];`.
- **`Arena.used()`** and its siblings become `nish/runtime`'s `arenaUsed`,
  `arenaMark`, `arenaRelease` and `arenaReset`, and a `Result` annotation
  imports `Result` from it.
- **An element read `a[i]`** whose index the compiler cannot prove in range
  becomes `idx(a, i)`, and a store `a[i] = v` becomes `setIdx(a, i, v)`.
  Both panic out of range as the native check does, where JavaScript would
  read `undefined` or grow the array. A compound store `a[i] += v` checks
  the index again after `v` runs, at a proven index too, since `v` can
  shrink the array.
- **`new Array<T>(n)`** becomes `newArray(n, zero)`, filled with `T`'s zero
  (`0`, `0n`, `false`, or `null` for a nullable `T`) where JavaScript would
  leave holes. An `i64` or `u64` length goes through `Number`.
- **A record an array holds inline** is copied as it goes in:
  `xs.push(p)` pushes `{ ...p }`, and `xs[i] = p` writes `p`'s fields into
  the record already in the slot, so a later change to `p` leaves `xs`
  alone, as it does natively. A `(P | null)[]` holds references and copies
  nothing.
- **`dst.set(src, at)`** between two arrays of one type becomes
  `arraySet(dst, src, at)`, the copy a plain JavaScript array lacks, which
  panics past the end as the native one does.

The flag also turns on `--warn-portability`. Those warnings name the places
where your program can answer differently under Node.

Four kinds of module cannot be written. In each case `nish` exits 1 and
writes no file:

```text
app.ts:4:1: error: --emit-ts cannot write a module that declares C functions; keep it native and import it through --emit-napi (wp33 §4.4)
app.ts:4:1: error: --emit-ts cannot yet write signalFd, readSignal or nish:net, whose translation is not local to its statement (wp33 §3.5)
app.ts:6:3: error: --emit-ts cannot write this compound assignment, whose target it would read twice and which holds a call, a step or an element read: hoist the index into a const
app.ts:9:1: error: --emit-ts cannot write this generic, whose instances would be written as different TypeScript: an element held inline in one and by reference in another, or two element types with different zeros; write a function per element type
```

The second is reported at each `nish:net` import and at each call to a
`nish:net` function, `signalFd` or `readSignal`, imported or not.

The third is reported at an `x op= e` that Node needs written as
`x = x op e`, such as `+=` on a `u8` that has to wrap, when the index in `x`
holds a call, a `++`, or another array read: `hist[data[0]] += 10`. Read the
index into a `const` first, `const at = data[0]`, then `hist[at] += 10`.

The fourth is reported at a generic function that TypeScript writes once
for all the types it is called at, when those types need different code: a
record held inline in one call and a `P | null` reference in another, or an
`i32` and an `i64` element in `new Array<T>(n)`, whose zeros differ. Write a
function per element type.

Not every builtin has a runtime export yet. The `nish:unsafe` functions
(`uncheckedGet`, `wrappingAdd`, `readCString` and the rest) are written as
imports from `nish/runtime` that Node cannot resolve, so a program that uses
them does not run under Node yet.

The `nish:term` functions are written as imports from `nish/runtime` too, and
they resolve. Under Node, `isTerminal` and `terminalSize` answer, and
`readStdin`, `waitStdin` and `setRawMode` throw, naming themselves, as they do
when a program is [run under Node](terminal.md#where-it-runs).

`--emit-ts` writes a directory instead of IR, so it exits 2 if you also
pass `-o`, `--link`, `--emit-ast`, `--emit-checked`, `--emit-header`,
`--emit-dts`, `--emit-napi` or `--emit-napi-async`, or give it an empty
directory. It also exits 2 when a
module lies above the directory of the others (`../shared/s.ts`), or when two
modules would land on one file — a module of your own at `nish/pair.ts` and
the standard library's `nish/pair`, say. And it exits 2, before writing
anything, when a file it would write is one of your own sources: `--emit-ts .`
next to `app.ts` would write over it, so give it a directory of its own.

`--emit-panics`, `--emit-arena` and `--emit-capabilities` still write their
files alongside `--emit-ts`, and they are written before the TypeScript, so
they are there even when the program is refused or its modules cannot be laid
out.

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

## Colour, and when an agent runs `nish`

`nish --help` is coloured when it prints to a terminal and plain when it is
piped or redirected, so `nish --help | less` and `nish --help > flags.txt` hold
no escape codes. Diagnostics are never coloured. These variables change that:

| Variable | Effect |
| --- | --- |
| `NO_COLOR`, not empty | never colour; it wins over everything below |
| `FORCE_COLOR` set to `0`, `false`, `no` or `off`, in any case | never colour, even on a terminal |
| `FORCE_COLOR` or `CLICOLOR_FORCE`, neither empty nor one of those | colour even when piped, unless an agent is running `nish` |
| `CLICOLOR` set to one of those, or `TERM=dumb` | no colour, unless one of the two above forces it |

The palette uses 256 colours when `TERM` names a 256-colour terminal,
`COLORTERM` is set or `FORCE_COLOR` is `2` or `3`, and the 16 basic ones
otherwise.

**Coding agents get a plain help with an extra section.** When `nish` runs
under an agent — `CLAUDECODE` or `GEMINI_CLI` is set to anything but empty
or a no (`0`, `false`, `no`, `off`), or you set `NISH_AGENT` the same way
(`NISH_AGENT=1`) — the help has no colour, even on a terminal or with
`FORCE_COLOR` set, and ends with an **Agents** section: the absolute path of
`docs/AI.md` (the language as rules, traps first) in the installed package,
and the flags an agent's loop needs —
`--json`, `--fix` and `nish run`. `NISH_AGENT=0` (or `false`, `no`, `off`) turns this off
when one of those variables is set for some other reason. If the package's
`docs/AI.md` cannot be found, the section names it without a path.

## Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | success |
| 1 | the program was rejected: a compile error, or an input file that does not exist |
| 2 | usage error: an unknown flag, a missing argument, no input files |
| 3 | toolchain error: no usable `clang`, or the link failed (the `.ll` files are still written) |
| 70 | internal compiler error: a bug in `nish`, not in your program — please [report it](https://github.com/amritk/nish/issues) with the input, the command line and the message it printed |

`nish run` answers these codes until the program starts, and the program's own
exit status after that — the value `main` returns, `1` for a panic such as an
index out of range, or `128 + n` for a signal.

## Asking what a program can do

A few flags report on a program rather than build it; each leaves the IR
unchanged.

- **`--capabilities`** prints, on stderr, what the program can reach — files,
  processes, the network, the environment, the clock and so on — and
  `--allow <cap>` / `--deny <cap>` refuse a program that reaches more than you
  grant. A call to a `nish:unsafe` function, in your code or in a
  dependency's, shows up as `unsafe`, and `--deny unsafe` refuses it.
  `nish run --capabilities hello.ts` prints
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
