# Modules

A Nish program can be split across files with TypeScript's `import` and
`export`. Each file is a module, and an import names one of four things:
another file of your program, a built-in `nish:` module, a module of the
standard library, or a package installed in `node_modules`. The rules are in
the reference under [`export` and `import`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#export-and-import)
and [Builtin modules](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#builtin-modules-nish).

## Exporting and importing

Put `export` on the declaration itself. It works on functions, constants,
classes, interfaces, enums and type aliases:

<!-- nish:ok -->
```ts geometry.ts
// geometry.ts
export interface Point {
  x: i32;
  y: i32;
}

export const distance2 = (a: Point, b: Point): i32 => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
```

Then import what you need by name, with a path that starts with `./` or
`../`. The `.ts` extension is optional:

<!-- allow-panics: does integer arithmetic nothing bounds -->
<!-- nish:ok --allow-panics -->
```ts main.ts
// main.ts
import { distance2, Point } from "./geometry";

export const main = (): i32 => {
  const a: Point = { x: 0, y: 0 };
  const b: Point = { x: 3, y: 4 };
  console.log(`${distance2(a, b)}`);
  return 0;
};
```

Give the compiler the file with `main` and it finds the rest by following the
imports: `nish run main.ts` prints `25`, and `nish main.ts --link app` builds
one executable from both files.

A generic function or class imported from another file works as one declared
in yours, and what it answers needs no annotation. If `box.ts` exports
`box = <T>(value: T): Box<T> => new Box<T>(value)`, then `const b = box(7)` in
`main.ts` is a `Box<i32>`, with `b.get()` and `b.value` to hand, even though
`main.ts` never writes `Box<i32>`.

A declaration without `export` is private to its file, and importing it is an
error that tells you to add `export`. An imported module has no top-level
code that runs, so two modules may import each other; the one piece of
state a module keeps is [module storage](arrays-and-strings.md#module-storage),
which is laid out when the program compiles, not set up by code. Only the file you
compile may hold statements at the top level, and only when it declares no
`main` ([Your first program](../getting-started/first-program.md#without-main)).

## The one import form

The only import is a named one, `import { a, b as c } from "…"`. Every other
form TypeScript has is refused: a default import, a namespace import
(`import * as m`), a side-effect import (`import "./m"`), `import type`, and
`import x = require(…)`. On the export side the same goes for
`export default`, `export { a }` and `export * from`.

<!-- nish:err NL2119 -->
```ts
import * as geometry from "./geometry";

export const main = (): i32 => 0;
```

Four more rules come from compiling the whole program at once:

- **An exported function's name is unique across the program.** A private
  one need not be: two files may each keep their own private `helper`, as
  [the next section](#private-functions-of-one-name) shows. (Packages are kept
  apart for you too, so a dependency's `helper` does not clash with yours.)
- **A class or interface name is unique across the program too**, for the
  same reason.
- **Classes and interfaces cannot be renamed on import.** `import { Point as P }`
  is refused, because the type's name is part of the compiled program; anything
else, generic classes and interfaces included, can be renamed with `as`.
- **An exported function cannot be named after a C library function** such as
  `write`, `read`, `free`, `exit`, `strlen`, `sin` or `abs`, nor take a name that
  begins with `_`, `napi_` or `node_api_`. That includes every function C's
  `<math.h>` and `<complex.h>` declare, in each precision: `hypot`, `nan`,
  `tgamma`, `erff`, `conj` and the like. An exported function keeps its name in the
  compiled program, and the runtime and your own `Math` calls reach the C
  library's function of that name to print, read files, allocate memory and
  compute, so they would reach yours instead.

  The same holds when you build for wasm or for Node through N-API, where the
  exported name is the one JavaScript calls. A private function can have any of
  these names, and so can a method: the compiler gives a private one a symbol
  the C library cannot clash with. Importing the built-in `write` from
  `nish:io` or `exit` from `nish:process` is fine too: those are not functions
  of your program.

<!-- nish:err NL3037 -->
```ts
export const write = (line: string): i32 => toI32(line.length);

export const main = (): i32 => write("hello");
```

Rename it (`writeLine`, say), or drop the `export` if no other module needs it.

## Private functions of one name

Two files may each declare a private function, or a private generic
function, of the same name; each file calls its own.

<!-- nish:ok -->
```ts helper.ts
// helper.ts
const add = (a: i32, b: i32): i32 => a + b;

export const sum3 = (a: i32, b: i32, c: i32): i32 => add(add(a, b), c);
```

<!-- allow-panics: does integer arithmetic nothing bounds -->
<!-- nish:ok --allow-panics -->
```ts main.ts
// main.ts
import { sum3 } from "./helper";

const add = (a: i32, b: i32): i32 => a * 10 + b;

export const main = (): i32 => {
  console.log(`${sum3(1, 2, 3)} ${add(1, 2)}`);
  return 0;
};
```

This prints `6 12`. Each private `add` gets a symbol named after its file
(`helper$.add` and `main$.add`), so a native debugger or profiler shows which
one ran. Exported functions are still unique across the program, and so are
private ones when you build with `--no-strict-exports`, which keeps every
function's own name as its symbol so a C driver can call it.

## Built-in modules: `nish:`

Some built-in functions can be imported from a module whose name starts with
`nish:`. There is no file behind most of them; the import gives the built-in a
local name:

| Module | What it has |
| --- | --- |
| `nish:fs` | reading and writing files and directories: `readFileSync`, `writeFileSync`, `writeFileBytesSync`, `writeFileSyncMode`, `createFileExclusiveSync`, `mkdirSyncMode`, `renameSync`, `unlinkSync`, `readdirSync`, … |
| `nish:process` | `exit`, `argv`, `getenv`, `spawnSync`, `spawnPiped`, `spawnPipedWithin`, `spawn`, `spawnWithFds`, `kill`, `waitPid`, `availableParallelism`, `totalMemory`, `setNice`, `setIdlePriority`, `platform`, `arch`, … |
| `nish:io` | `write` and `writeError` (stdout and stderr without a newline), `writeBytes` (bytes from a `u8[]` to stdout, as they are), `panic` |
| `nish:net` | TCP, UDP and Unix-domain sockets, descriptor passing and peer credentials, and a readiness loop ([Networking](../using-nish/networking.md), [Unix sockets](../using-nish/unix-sockets.md)) |
| `nish:secret` | the `Secret<T>` wrapper for keys and other secret values |
| `nish:unsafe` | unchecked array access and wrapping arithmetic, available only through the import |
| `nish:simd` | sixteen-byte vectors and the calls that make, load and store them ([Vectors](simd.md)), available only through the import |
| `nish:async` | `spawn` and `awaitAll` for `async` functions ([Async functions](async.md)), available only through the import |

<!-- allow-panics: does integer arithmetic nothing bounds -->
<!-- nish:ok --allow-panics -->
```ts
import { argv } from "nish:process";
import { write } from "nish:io";

export const main = (): i32 => {
  write(`called with ${argv.length - 1} argument(s)\n`);
  return 0;
};
```

`nish run args.ts one two` prints `called with 2 argument(s)`: the first
element of `argv` is the program itself.

Except for `nish:secret`, `nish:unsafe`, `nish:simd` and `nish:async`, which exist only as imports, these
are also globals, like `console.log`, so you can call them without an import.
The `nish:process` names are spelled `process.argv`, `process.exit`,
`process.platform` and `process.arch` there, as in Node. Importing has one advantage: an imported built-in cannot be shadowed by
a function of yours with the same name, whereas a global one silently can.
`Math`, `console`, `Ok`, `Err` and the number conversions are always global.

## The standard library: `nish/<module>`

The standard library is ordinary Nish source that ships with the compiler,
and you import it as `nish/` followed by the module's name: `nish/text`,
`nish/map`, `nish/pair`, `nish/json`, `nish/threads`, `nish/crypto/sha256`
and so on. It is compiled into your program like your own code, so a module
you import but never call costs nothing.

<!-- allow-panics: indexes an array without a guard the checker reads; calls `std/text.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { splitWhitespace, trim } from "nish/text";

export const main = (): i32 => {
  const words = splitWhitespace(trim("  the quick  brown fox "));
  console.log(`${words.length} words, the last is ${words[words.length - 1]}`);
  return 0;
};
```

This prints `4 words, the last is fox`. Naming a module the library does not
have is an error that lists the ones it does. What each module offers is on
[the standard library](../using-nish/standard-library.md) page. `Map` and
`Set` need no import at all ([Maps and sets](maps-and-sets.md)).

## Packages

Any other name, such as `hash` or `@scope/hash`, optionally followed by a
subpath (`@scope/hash/blake3`), is a package, looked up in `node_modules` the
way Node looks it up. Install one with npm as usual.

A package is compiled from its TypeScript source, not from built JavaScript,
so it is checked and optimised exactly as your own code is. Its
`package.json` says which file to compile under the `nish` export condition:

<!-- nish:ok -->
```json node_modules/hash/package.json
{
  "name": "hash",
  "version": "1.0.0",
  "exports": {
    ".": { "nish": "./src/index.ts" },
    "./blake3": { "nish": "./src/blake3.ts" }
  },
  "engines": { "nish": ">=0.18.0" }
}
```

With `src/index.ts` and `src/blake3.ts` beside it in the package,

<!-- nish:ok -->
```ts node_modules/hash/src/index.ts
// node_modules/hash/src/index.ts
export const fnv1a = (text: string): u32 => {
  let h: u32 = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = (h ^ toU32(text.charCodeAt(i))) * 16777619;
  }
  return h;
};
```

<!-- nish:ok -->
```ts node_modules/hash/src/blake3.ts
// node_modules/hash/src/blake3.ts
export const blake3Name = (): string => "BLAKE3";
```

a program imports the package by its name, and the subpath by the name of
its export:

<!-- nish:ok -->
```ts main.ts
// main.ts
import { fnv1a } from "hash";
import { blake3Name } from "hash/blake3";

export const main = (): i32 => {
  console.log(`${fnv1a("nish")} ${blake3Name()}`);
  return 0;
};
```

`nish run main.ts` prints `4149877227 BLAKE3`.

- An ordinary npm package has no `nish` condition, so importing it is an
  error saying it has no Nish entry point: there is nothing in a `.js` file
  for Nish to compile.
- A package whose source is correct only with one
  [`--number-mode`](../using-nish/cli.md) can say so with `nish-i32` or
  `nish-f64` instead of, or beside, `nish`. The compiler takes the one for its
  own mode first, and a package that offers only the other mode is an error
  at the import rather than a wrong answer at run time.
- `engines.nish` is the lowest compiler version the package needs, written
  `>=X.Y.Z` or `>=X.Y`. An older compiler refuses the package and says which version it
  asked for.
- A package can ship agent skills in `skills/<name>/SKILL.md`, and
  `npx nish-skills` links them into the project's `.claude/skills/`
  ([Agent skills](../using-nish/agent-skills.md)).
- A package that wraps a C library names it, and its own C sources, in
  `nish.link`. Your root `package.json` grants each one before it is linked
  ([Calling C from Nish](../using-nish/interop.md#calling-c-from-nish-declare-function)).
- The [`package.json` reference](../../reference/config/package-json.md)
  lists every field Nish reads in a package's manifest, and the error each
  mistake in one gets.
- A program compiles one copy of each package. If two of your dependencies
  bring in two different copies of `hash`, the compiler refuses the second and
  names both directories.
- An error inside a package's own source says so, under the excerpt, with the
  package's version, so you know to upgrade it, pin another version or report
  it upstream rather than look in your own code; under `--json` the object
  carries the package's name in `package`:

  ```text
  node_modules/pkg_broken/src/index.ts:2:39: error: Return type mismatch: function returns i32 but expression is string
    2 | export const twice = (n: i32): i32 => `${n * 2}`;
      |                                       ^~~~~~~~~~
    = note: this is in the dependency `pkg_broken` 0.3.1, not in this program's own source
  ```
