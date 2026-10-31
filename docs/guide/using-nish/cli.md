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
       nish run --watch <file.ts> [args ...]  rebuild and rerun it on each edit
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
  The first run after an edit links the program (with the fast `debug`
  profile, unless you pass `--profile`), and every run after that starts the
  binary it already linked. Under `debug`, the link compiles only the modules
  your edit changed: a one-line edit to a 5,000-line server rebuilds in about
  a second and a half on a 4-core machine, against about five seconds for the
  first link.
- **What `nish run` caches**, under `$XDG_CACHE_HOME/nish`, or `~/.cache/nish`
  when that is unset:

  | Directory | Holds | Kept for |
  | --- | --- | --- |
  | `run` | one linked binary per program | the same program, built the same way |
  | `runtime` | the C runtime, compiled once per profile | every link with that profile |
  | `module` | each module's object, `debug` profile only | the same module, unchanged |

  An entry is used only when everything it was built from is unchanged: the
  compiler, the profile and its flags, the C compiler, and the code itself.
  The `speed` and `size` profiles do not use `module`, so their binaries are
  exactly what a build without a cache makes. Without an absolute
  `XDG_CACHE_HOME` or `HOME`, or when `nish/module` cannot be made private to
  you (mode 700, owned by you), the link skips `module` and compiles every
  module, as the first link does.
- **The cache is safe to delete.** Removing any of these directories costs
  one rebuild and nothing else. Nothing prunes them, so delete `nish/module`
  now and then if a program you edit often has grown it.

Flags that write a file the run would keep to itself — `-o`, `--link`,
`--target`, the `--emit-*` sidecars and `--profile wasi` — are usage errors
under `nish run`.

### Rebuilding on each edit: `--watch`

`nish run --watch` builds and runs the program as `nish run` does, then
watches every file the program was built from. When one changes it builds
again and puts the new program in place of the running one:

```console
$ nish run --watch server.ts 8080
watch: built in 1830 ms
listening on 8080
watch: rebuilt in 412 ms
listening on 8080
```

- **What is watched** is the entry file and every module it imports, as far
  as the last build got to load them, so a build that fails in an imported
  module rebuilds when you fix that module. The standard library is left out, since an installed `nish` does not change
  under you; run from a checkout of the compiler, `std/` is watched too.
- **A failed build changes nothing.** Its diagnostics are printed, as plain
  `nish run` prints them (one JSON object per line under `--json`), followed
  by `watch: the build failed; the running program keeps running`, and the
  program you had keeps running until the next edit builds. When no program
  is running yet, the line ends `waiting for a change` instead.
- **Edits are gathered, and the newest wins.** A change waits a tenth of a
  second for the editor's next write before it builds, and an edit during a
  build stops that build and starts a new one, so the program that runs is
  always built from the files as they are.
- **A server is started before the old one stops.** A program that uses the
  network is taken for a server: the new build starts while the old one still
  runs, and once the new one has lasted a moment the old one is sent SIGTERM,
  then SIGKILL if it has not exited after five seconds. Listen with
  `SO_REUSEPORT` (`tcpListenFlags(host, port, backlog, 1)`) so both can hold
  the port at once, and answer SIGTERM by finishing the connections you have
  accepted — a server that does both loses no request across a rebuild. A
  server that does not set `SO_REUSEPORT` cannot bind beside the old one: the
  new build exits as it starts, that is reported, and the old one keeps
  serving the old code. A network client is taken for a server too, so for a
  moment after each rebuild the old and the new copy both run.
- **Any other program is stopped, then started again**, with the same
  SIGTERM and SIGKILL, because two copies would write the same terminal and
  files. A program that exits on its own leaves the watch waiting for an edit.
- **Each run sees `NISH_WATCH=1`** in its environment, so a program can tell
  it is being watched, and each build prints how long it took.
- **Ctrl-C stops the watch and the program** and leaves nothing running.
  The exit status is the one an interrupted program has (130 in a shell).
  If the `nish run --watch` process itself is killed, the watch stops the
  program and exits as a hangup does (129).

`--watch` is a flag of `nish run`; `nish --watch app.ts` is a usage error
(exit 2).

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
  link-time optimisation (its code generation spread over every core when
  the link goes through lld) and a stripped binary; `size` optimises for
  bytes; `debug` links fastest and keeps symbols; `wasi` builds a `wasm32-wasi`
  module instead of a native binary.
  Every native profile links a hardened binary: position independent, with a
  read-only GOT (full RELRO), a non-executable stack, stack-clash probes,
  control-flow protection (CET on x86-64, BTI and pointer authentication on
  arm64) and the stack protector in the C runtime. You do not need a flag for
  it, and `node scripts/check-hardening.mjs <binary>` in a checkout reads the
  protections back from a binary's headers.
  On Linux every native binary also carries a GNU build id (an
  `NT_GNU_BUILD_ID` note; `readelf -n app` shows it), which `perf`, `gdb` and
  debuginfod use to match a binary with its debug information. The id is a
  hash of the binary's bytes, so linking the same program twice gives the
  same id, while two different builds (a `-g` link and a plain one, or two
  profiles) give different ones.
- **`--cpu x86-64-v3`** — compiles your program and the runtime for x86-64
  CPUs with AVX2 (Intel Haswell, AMD Excavator and later), which can make
  tight loops faster. It is the one level `nish` accepts; anything else, and
  the flag with `--profile wasi` or a non-x86-64 `--target`, is refused with
  exit 2. What your program computes does not change. A binary built with it
  **crashes with `SIGILL` on a CPU without AVX2**, so use it only for binaries
  that stay on machines you know; ship anything else without it.
- **`-g`** — DWARF debug info, so `gdb` and `lldb` step through your `.ts`
  source.

  To ship a binary without its debug information and keep that information
  beside it, split the `-g` build rather than linking twice, since a second
  link would carry a different build id:

  ```sh
  nish app.ts --link app -g
  objcopy --only-keep-debug app app.debug
  strip -g app
  objcopy --add-gnu-debuglink=app.debug app
  ```

  `app` and `app.debug` share one build id, so `gdb`, debuginfod or
  `perf buildid-cache -a app.debug` match the shipped `app` with the DWARF
  in `app.debug`, and source lines come back for it. (`strip -g` keeps the
  symbol table, so function names resolve without the debug file.)
- **`--number-mode f64`** — makes a bare `number` a 64-bit float rather than
  the default `i32`. Code that spells its widths (`i32`, `f64`) means the same
  thing in both modes.
- **`--target <triple>` or `--target host`** — stamps the IR with a target's
  data layout, for cross-compiling or for reading optimised IR by hand.
  `--link` does not need it.

The sidecars that let C, Node and WebAssembly call your code —
`--emit-header`, `--emit-napi`, `--emit-dts` — have a page of their own:
[Calling Nish from other languages](interop.md).

### SQLite is linked when your program calls it

`nish` ships [SQLite](https://sqlite.org/) 3.54.1 as source, and `--link`
compiles it into a program that calls a SQLite C function (`sqlite3_open`, or
any other `sqlite3_*`). You need no SQLite library on your system, and a
program that does not call SQLite gets none of it.

```ts nish:ok
declare function sqlite3_libversion(): string;

export const main = (): i32 => {
  console.log(sqlite3_libversion());
  return 0;
};
```

```console
$ nish run version.ts
3.54.1
```

- **The first link that uses it is slower.** SQLite is about 9.6 MB of C. The
  first link compiles it once, which takes about 1.5 s under `debug` (and
  `nish run`) and about 18 s under `speed`. `nish` keeps the result in the
  runtime cache, so every later link takes about as long as one without
  SQLite.
- **One thread, unless you build with `--threads`.** SQLite is compiled with
  `SQLITE_THREADSAFE=0`, and with `=2` under `--threads`: multi-thread mode,
  where no mutex guards a connection, so open one per thread and never share it.
- **The defaults are most of SQLite's
  [recommended options](https://sqlite.org/compile.html#recommended_compile_time_options).**
  Two are left out. `SQLITE_OMIT_DECLTYPE` would remove
  `sqlite3_column_decltype`, which reports a column's declared type.
  `SQLITE_OMIT_AUTOINIT` would make any call before `sqlite3_initialize()`
  undefined behaviour.
- **`NISH_SQLITE_CFLAGS` adds compile-time options.** Its words are added to
  SQLite's compile line, and a `-D` or `-U` for an option `nish` already sets
  replaces it. For example, `NISH_SQLITE_CFLAGS="-DSQLITE_ENABLE_FTS5"` adds
  full-text search. The cache keeps a separate copy for each value. Only the
  first line is read, and it is split on whitespace: quotes are not removed,
  so a word cannot hold a space. A relative `-I` path is taken from
  `runtime/sqlite/`, where SQLite is compiled, so give an absolute one.
- **`--profile napi` links it with hidden visibility.** The addon uses SQLite
  but does not export its functions to Node or to other addons.
- **`--profile wasi` links it.** There SQLite locks a database with lock
  files and has no WAL mode across processes. `scripts/build.sh --profile
  wasm`, which links no C library, refuses a module that calls SQLite with
  exit 2.

## Writing TypeScript: `--emit-ts`

`nish app.ts --emit-ts out/` writes your program back out as TypeScript that
Node runs, one file per module, and no IR:

```sh
nish app.ts --emit-ts out/
node out/entry.ts
```

The output imports its runtime from the `nish` package, as `nish/runtime`, so
Node has to find `nish` from `out/`, the way it finds any dependency. Node
22.18 or newer runs it, with the type stripping it has on by default. A program that uses `using` needs Node 24, or
`--js-explicit-resource-management` on Node 22.

Inside `out/`:

- **Your modules** keep their paths relative to the directory they share:
  `app.ts` and `lib/tally.ts` are written as `out/app.ts` and
  `out/lib/tally.ts`.
- **Each standard-library module** your program imports is written under
  `nish/`, so `nish/pair` becomes `out/nish/pair.ts`.
- **`entry.ts`** runs your `main` and exits with the number it returns.

Imports are rewritten so Node can follow them. A `nish:` builtin becomes
`nish/runtime`, the one package the output imports, `nish:secret` included:
its `wipe` is the runtime's, and `std/secret.ts` is not written. A `nish/x` or relative
import becomes a relative path ending in `.ts`. An imported interface or type
alias is marked `import { type Pair }`. A module that needs none of this, and
none of the rewrites below, is written byte for byte; one rewrite that reaches
an otherwise plain module is `const s = "hi"`, written `const s: string = "hi"`
so TypeScript does not narrow `s` to the literal.

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
- **`Arena.used()`** and `Arena.mark()` become `nish/runtime`'s `arenaUsed`
  and `arenaMark`, and a `Result` annotation
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
- **`i32` arithmetic** that can overflow, `a + b`, `a - b`, `a * b` and
  `-a`, becomes `checkedAdd(a, b)`, `checkedSub`, `checkedMul` and
  `checkedNeg`, which panic as the native build does; where the compiler
  proved the result fits, it is `(a + b) | 0` or
  `Math.imul(a, b)`. `/` and `%` become `idiv` and `irem`.
- **`dst.set(src, at)`** between two arrays of one type becomes
  `arraySetAt(dst, src, at)`, the copy a plain JavaScript array lacks, which
  panics past the end as the native one does.

The flag also turns on `--warn-portability`. Those warnings name the places
where your program can answer differently under Node.

Five kinds of module cannot be written. In each case `nish` exits 1 and
writes no file:

```text
app.ts:4:1: error: --emit-ts cannot write a module that declares C functions; keep it native and import it through --emit-napi (wp33 §4.4)
app.ts:4:1: error: --emit-ts cannot yet write signalFd, readSignal or nish:net, whose translation is not local to its statement (wp33 §3.5)
app.ts:6:3: error: --emit-ts cannot write this compound assignment, whose target it would read twice and which holds a call, a step or an element read: hoist the index into a const
app.ts:9:1: error: --emit-ts cannot write this generic, whose instances would be written as different TypeScript: an element held inline in one and by reference in another, or two element types with different zeros; write a function per element type
app.ts:12:15: error: --emit-ts cannot write this generic, which no instance reaches: its body copies or zero-fills an element whose type only an instance would say; call it with the element type it is for, or write a function per element type
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

A generic nothing calls is written too: a function or method, or the methods
and constructor of a class no type argument list names. The native build
compiles no body for it, so there are no types to translate by. Where no type
would change its text, it is written as it is, with only the rewrites that
need no type, such as the bounds check on `a[i]`. Where a type would (a 64-bit
integer, an `f32`, a builtin call such as `toU32`, arithmetic whose width
wraps, a string's `.length` or methods), it is written with a body that throws
instead, and a warning (`portability:`, NL8012) names it and its line when it
is the program's own; the standard library's are written without one. The
fifth refusal (NL4014) is a generic of your own whose body fills
`new Array<T>(n)` with `T`'s zero, or copies an element into an array slot in a
program that keeps records inline: which code those need depends on a `T` no
call names, so it is refused rather than stubbed, even where a 64-bit integer
or a builtin call in the same body would have made it a stub. Call it, or write a function per element type. The same
body in the standard library is a stub, and the program is written.

The `nish:unsafe` functions are imports from `nish/runtime` too:
`uncheckedGet`, `uncheckedSet` and the `wrapping*` arithmetic run under Node,
and `readCString`, which reads C memory, has no export, so a program that
calls it does not run under Node.

The `nish:term` functions are written as imports from `nish/runtime` too, and
they resolve. Under Node, `isTerminal` and `terminalSize` answer, and
`readStdin`, `waitStdin`, `setRawMode` and `setTerminalRestore` throw, naming themselves, as they do
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

The colours are your terminal's own: the basic ANSI colours, bold and faint,
which your theme defines, so the help takes on whatever palette you chose (a
terminal with no theme shows its built-in defaults). On a terminal whose
`TERM` terminfo entry declares no colours at all (`tput colors` prints fewer
than 8, as it does for `TERM=vt100`), the help marks headings and flags in
bold and placeholders with an underline instead, which a monochrome terminal
still shows. Forced colour (`FORCE_COLOR`, `CLICOLOR_FORCE`) is always the
theme's, whatever `TERM` says, because what reads it is a pager or an editor
that paints the escapes itself. Your own tools can print a help that behaves the same way with
[`nish/cli`](standard-library.md#nishcli).

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

A few flags report on a program rather than build it; each but `--sandbox`
leaves the IR unchanged.

- **`--capabilities`** prints, on stderr, what the program can reach — files,
  processes, the network, the environment, the clock and so on — and
  `--allow <cap>` / `--deny <cap>` refuse a program that reaches more than you
  grant. A call to a `nish:unsafe` function, in your code or in a
  dependency's, shows up as `unsafe`, and `--deny unsafe` refuses it.
  `nish run --capabilities hello.ts` prints
  `capabilities: none (deterministic)` before the program's own output. See
  [Capabilities](../../LANGUAGE.md#capabilities).
- **A dependency needs your grant** for `unsafe`, `ffi`, `net` and
  `process.spawn`. A package under `node_modules` that reaches one of them,
  itself or through anything it calls, stops the build until your
  `package.json` names it:

  ```json
  { "nish": { "capabilities": { "dependencies": { "pkg_http": ["net"] } } } }
  ```

  Without it the build stops with exit code 1, and the error names the
  grant to add and the calls that reach the capability:

  ```text
  node_modules/pkg_http/src/index.ts:6:10: error: the dependency `pkg_http` reaches `net` through `dial`, which the root package does not grant it; grant it with "nish": { "capabilities": { "dependencies": { "pkg_http": ["net"] } } } — the chain that reaches it: node_modules/pkg_http/src/index.ts:6:10 calls netAddress
  ```

  Only your own `package.json` grants: `--allow` does not, and neither does
  the dependency's. The standard library needs no grant. See
  [A dependency's capabilities](../../LANGUAGE.md#a-dependencys-capabilities).
- **`--update-capability-lock`** writes `nish-capabilities.lock.json` beside
  your `package.json`: every capability each dependency reaches, granted or
  not. Commit it. While it exists, an upgrade that makes a dependency reach
  something new stops the build with exit code 1, naming the dependency, the
  capability and the calls, until you read the chain and run the flag again:

  ```text
  node_modules/pkg_http/src/index.ts:6:10: error: the dependency `pkg_http` reaches `net` through `dial`, which `nish-capabilities.lock.json` does not record for it; review the chain, then record it with `--update-capability-lock` — the chain that reaches it: node_modules/pkg_http/src/index.ts:6:10 calls netAddress
  ```

  A dependency that reaches less than its row records is fine. A build the
  grants refuse writes no lockfile. `nish run` takes the flag; `--fix` and
  `--emit-ast` do not. See
  [The capability lockfile](../../LANGUAGE.md#the-capability-lockfile).
- **`--sandbox`** goes one step further on Linux: the built program asks the
  kernel, before `main` runs, to refuse the files, processes and sockets its
  `main` does not reach — C code it links included. It adds a few lines to the
  IR. With it, `--allow fs.read=<dir>` and `--allow fs.write=<dir>` grant a
  capability beneath one directory. See [The sandbox](sandbox.md).
- **`--deny-panics`** turns every panic the compiler cannot prove away into an
  error, and `--emit-panics <file.json>` lists them all
  ([The no-panic scope](../../LANGUAGE.md#the-no-panic-scope)).
- **`--emit-ast`** and **`--emit-checked`** print what the compiler parsed and
  what its checker recorded, one line per node.

The reference for diagnostics and the flags that shape them is
[Diagnostics and debugging flags](../../LANGUAGE.md#diagnostics-and-debugging-flags);
the exit codes and the caches are also described in
[INSTALL.md](../../INSTALL.md#4-exit-codes).
