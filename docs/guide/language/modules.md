# Modules

A Nish program can be split across files with TypeScript's `import` and
`export`. Each file is a module, and an import names one of four things:
another file of your program, a built-in `nish:` module, a module of the
standard library, or a package installed in `node_modules`. The rules are in
the reference under [`export` and `import`](../../LANGUAGE.md#export-and-import)
and [Builtin modules](../../LANGUAGE.md#builtin-modules-nish).

## Exporting and importing

Put `export` on the declaration itself. It works on functions, constants,
classes, interfaces, enums and type aliases:

```ts
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

```ts
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
error that tells you to add `export`. Modules have no top-level code that
runs, so two modules may import each other.

## The one import form

The only import is a named one, `import { a, b as c } from "…"`. Every other
form TypeScript has is refused: a default import, a namespace import
(`import * as m`), a side-effect import (`import "./m"`), `import type`, and
`import x = require(…)`. On the export side the same goes for
`export default`, `export { a }` and `export * from`.

```ts nish:err NL2119
import * as geometry from "./geometry";

export const main = (): i32 => 0;
```

Four more rules come from compiling the whole program at once:

- **A function's name is unique across the program**, exported or not. Two
  files of your program cannot each have a private `helper`; name them apart.
  (Packages are kept apart for you, so a dependency's `helper` does not
  clash with yours.)
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
  compute, so they would reach yours instead. The same holds when you build
  for wasm or for Node through N-API, where the exported name is the one
  JavaScript calls. A private function can have any of these names, and so
  can a method: the compiler gives a private one a symbol the C library
  cannot clash with. Importing the built-in `write` from `nish:io` or `exit`
  from `nish:process` is fine too: those are not functions of your program.

```ts nish:err NL3037
export const write = (line: string): i32 => toI32(line.length);

export const main = (): i32 => write("hello");
```

Rename it (`writeLine`, say), or drop the `export` if no other module needs it.

## Built-in modules: `nish:`

Some built-in functions can be imported from a module whose name starts with
`nish:`. There is no file behind most of them; the import gives the built-in a
local name:

| Module | What it has |
| --- | --- |
| `nish:fs` | reading and writing files and directories: `readFileSync`, `writeFileSync`, `readdirSync`, … |
| `nish:process` | `exit`, `argv`, `getenv`, `spawnSync`, `spawn`, `kill`, `waitPid`, `availableParallelism`, `totalMemory`, `platform`, `arch`, … |
| `nish:io` | `write` and `writeError` (stdout and stderr without a newline), `panic` |
| `nish:net` | TCP and UDP sockets and a readiness loop ([Networking](../using-nish/networking.md)) |
| `nish:secret` | the `Secret<T>` wrapper for keys and other secret values |
| `nish:unsafe` | unchecked array access and wrapping arithmetic, available only through the import |

```ts nish:ok
import { argv } from "nish:process";
import { write } from "nish:io";

export const main = (): i32 => {
  write(`called with ${argv.length - 1} argument(s)\n`);
  return 0;
};
```

`nish run args.ts one two` prints `called with 2 argument(s)`: the first
element of `argv` is the program itself.

Except for `nish:secret` and `nish:unsafe`, which exist only as imports, these
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

```ts nish:ok
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

```json
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
- A program compiles one copy of each package. If two of your dependencies
  bring in two different copies of `hash`, the compiler refuses the second and
  names both directories.
