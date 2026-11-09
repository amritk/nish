# Calling Nish from other languages

Nish never embeds a JavaScript engine and never runs inside one. The way to
combine it with other code is the other way round: compile the hot part —
the parsing, the maths, the data transforms — with Nish, and call it from
Node, from a WebAssembly host or from C. In the opposite direction, a Nish
program can call a C function you declare.

Each direction starts from an ordinary module that `export`s the functions to
call. This one is used throughout the page:

```ts nish:ok
export const add = (a: i32, b: i32): i32 => a + b;

export const mean = (xs: Float64Array): f64 => {
  let total: f64 = 0.0;
  for (const x of xs) {
    total = total + x;
  }
  return xs.length > 0 ? total / toF64(xs.length) : 0.0;
};
```

`Float64Array` is the Nish spelling of `f64[]` — one layout under two names —
and is the name a JavaScript caller sees. `Int32Array` and `BigInt64Array` are
`i32[]` and `i64[]` the same way. Spell the widths (`i32`, `f64`) in an
exported signature, so it means the same thing whatever `--number-mode` the
module is compiled in.

A host calls the exported function as it is compiled, with every argument: a
[default](../language/functions.md#default-and-rest-parameters) is filled in only by a Nish caller, so a
JavaScript or C caller passes it, and a rest parameter `...xs: f64[]` takes one
plain `Float64Array`.

A compile writes the IR and, with these flags, the file each host needs:

| Flag | Writes | For |
| --- | --- | --- |
| `--emit-header <file.h>` | C prototypes for every exported function | a C or C++ host |
| `--emit-napi <shim.c>` | an N-API shim, compiled into a `.node` addon | Node, as native code |
| `--emit-napi-async <shim.c>` | the same shim, plus a promise-returning form of each export run off the event loop | Node |
| `--emit-dts <file.d.ts>` | TypeScript typings, and beside them `<file>.mjs`, a loader | Node or a browser, through WebAssembly |

The commands below link with `scripts/build.sh` and the C files in
`runtime/`. Both ship in the `nish` package next to the compiler (in a
checkout they are at the repository root); write `$NISH` below for that
directory.

## Node, as a native addon

The N-API shim turns each export into a JavaScript function that checks its
arguments and calls the compiled code. Build it with the `napi` profile:

```console
$ nish stats.ts -o stats.ll --emit-napi stats-napi.c
$ $NISH/scripts/build.sh stats.ll $NISH/runtime/runtime.c stats-napi.c -o stats.node --profile napi
stats.node: 45208 bytes (napi)
```

```js
import { createRequire } from "node:module";

const require = createRequire(import.meta.url); // an addon is a CommonJS module
const stats = require("./stats.node");

console.log(stats.add(2, 3));                                  // 5
console.log(stats.mean(new Float64Array([1, 2, 3, 4])));       // 2.5
stats.add("2", 3); // TypeError: add: argument 1 (a) must be a number
```

A typed array crosses without a copy: the addon reads, and writes, the
array's own bytes, so a function that fills an `Int32Array` parameter changes
the caller's array in place. A returned array is a fresh typed array, and a
string crosses as a copy. The addon links against Node's stable ABI, so it
keeps working across Node upgrades.

## WebAssembly

`--emit-dts` writes typings and a loader that copies typed arrays into the
module's memory for each call and copies results back out. Build the module
with the `wasm` profile, and add `runtime-wasm.c` when a function takes or
returns an array:

```console
$ nish stats.ts -o stats.ll --emit-dts stats.d.ts
$ $NISH/scripts/build.sh stats.ll $NISH/runtime/runtime-wasm.c -o stats.wasm --profile wasm
stats.wasm: 1607 bytes (wasm)
```

```js
import { readFileSync } from "node:fs";
import { load } from "./stats.mjs";

const stats = await load(readFileSync("stats.wasm"));
console.log(stats.add(2, 3));                                  // 5
console.log(stats.mean(new Float64Array([1, 2, 3, 4])));       // 2.5
```

`load(source, imports)` takes the bytes or a compiled `WebAssembly.Module`, and
an import object. It defaults to `{}`, unless the module imports a host module
(below): then it is required, `{ host }`, and the `.d.ts` types it. The `wasm` profile
is freestanding — no C library. An export may return a `string`, which the
loader decodes into a JS string, and a host import may take one (see
[Strings and the page](#strings-and-the-page) below). Functions that *take* a string, or do I/O, are not
callable from it; the generated `.d.ts` lists them as comments. A whole program that does need them can be built for WASI instead,
with `nish app.ts --link app.wasm --profile wasi` (which needs a WASI sysroot;
see [INSTALL.md](../../INSTALL.md#wasi-optional-for---profile-wasi)), and run
under any WASI host.

### In a browser

For a page, link with the `wasm-host` profile instead. It takes the same
inputs but exports only what the loader calls: your exported functions,
`memory`, and the arena entry points when `runtime-wasm.c` is linked. That
makes the module smaller than the `wasm` profile's (`examples/arrays.ts`:
2,827 bytes down to 2,091). `--inline` also writes the bytes as an ES module, so
the page needs no `fetch` and no `await`:

```console
$ $NISH/scripts/build.sh stats.ll $NISH/runtime/runtime-wasm.c -o stats.wasm \
    --profile wasm-host --inline stats.bytes.mjs
stats.wasm: 807 bytes (wasm-host, no wasm-opt)
```

```js
import { loadSync } from "./stats.mjs";
import { bytes } from "./stats.bytes.mjs";

const stats = loadSync(bytes);
console.log(stats.add(2, 3));                                  // 5
```

`loadSync` compiles on the calling thread. Chromium refuses to compile a module
over 8 MB that way on the main thread; for one that large, `await load(bytes)`
compiles in the background instead. The loader imports nothing and reads no
URL, so a bundler can take it as it is.

Two flags work with `wasm-host` only. `--memory <MiB>` fixes the memory size,
initial and maximum (1 to 4096); an allocation that outgrows it is a panic
of kind `memory` ([below](#when-the-module-panics)) in a program that keeps
storage or imports a host module, and a bare `RuntimeError` in one that does
neither. Without the flag the
memory grows on demand. `--inline <file.mjs>` writes the bytes
module. Any other profile refuses either flag with exit 2. The stack is a
fixed 64 KiB. If `wasm-opt` (binaryen) is on `PATH`, `build.sh` runs
`wasm-opt -Oz` on the module, and the build line says whether it ran.

With Vite, `nish/vite` does all of this in `vite build`:

```js
// vite.config.js
import nish from "nish/vite";

export default { plugins: [nish({ entries: ["src/stats.ts"] })] };
```

In a build, `import { add } from "./stats.ts"` gets the wasm build, compiled,
linked with `--profile wasm-host --inline` and loaded with `loadSync`. Under
`vite serve` the import stays the TypeScript itself. Entries are paths from
the project root.

### Functions the page supplies: host modules

A module that calls back into the page imports those functions from an
ordinary TypeScript file the page owns, a *host module*. Name it with
`--host`, or in the root `package.json` as `"nish": { "host": ["web/host.ts"] }`;
an import from any other file is an ordinary Nish import:

```ts
// web/host.ts: the page's own file, checked by tsc and bundled as usual
import type { f64, HostHandle, u32 } from "nish";
export type Canvas = HostHandle<"canvas">;

export function nowMs(): f64 { return performance.now(); }
export function fill(c: Canvas, rgb: u32): void { canvases[c].fill(rgb); }
```

```ts
// draw.ts: the Nish module
import { Canvas, fill, nowMs } from "./web/host.ts";

export function frame(c: Canvas): f64 {
  fill(c, 0x336699);
  return nowMs();
}
```

```console
$ nish draw.ts --target wasm32 --host web/host.ts --emit-dts draw.d.ts -o draw.ll
$ $NISH/scripts/build.sh draw.ll -o draw.wasm --profile wasm-host
```

```js
import * as host from "./web/host.ts";
import { load } from "./draw.mjs";

const draw = await load(await (await fetch("draw.wasm")).arrayBuffer(), { host });
```

Each `host` entry is a path relative to the `package.json`, naming a file
that exists: a value that is not a list of strings (NL2694), an empty or
absolute entry (NL2695) and one that names no file (NL2696) are refused where
the `package.json` writes them.

Nish reads only the host module's exported signatures, and skips each function
body unread, so a body may use the DOM, closures, classes and promises. Each function
becomes a wasm import from module `host` under its own name. The `.d.ts` gains
`Imports = { host: typeof import("./web/host") }`, so `tsc` refuses a page that
passes a host object short of a function.

The loader passes a function through as it stands when every value crosses
unchanged (`i32`, `i64`, `f32`, `f64`, an enum, a handle, and a `u8` or `u16`
argument), and wraps it once, at `load`, when a value needs converting: a `u32`
or `u64` argument is read unsigned, a `u8` or `u16` result is masked to its
width (a `u32` or `u64` one wraps as wasm's own conversion to `i32` or `i64`
makes it), a `boolean` crosses as 0 or 1, and a ranged integer result is
range-checked (`RangeError` naming the function).

`HostHandle<"kind">` names an object the page keeps in its own table: an `i32`
index of its own nominal type. Handles of different kinds do not mix, under
Nish and under `tsc` alike; a handle compares with `===` and `!==` against one
of its kind or `0` ("none"), and supports nothing else. A field or parameter
of a handle type may only default to `0` (NL2670).

Only the exports the Nish source imports are held to these rules, so a host
module may export page-only functions beside them, such as create-vite's
`setupCounter(element: HTMLElement)`: Nish leaves an export no module imports
unread. What an import names and cannot cross is refused with the explicit form: an object, a class, a
function or `any` (NL2661), a generic function (NL2662), a `Promise` (NL2663)
and a `string` result (NL2667). A `string` *argument* crosses: the page's
function receives a JS string, decoded from the module's UTF-8 bytes. An array
crosses only as a
[buffer window](#lending-an-array-to-the-page). A host-module body the lexer cannot read, such as a regex
literal or JSX, is refused with a message to move that code into a module the
host file imports (NL3049).

A host module exists only in a freestanding wasm
build: a native or WASI build that imports one is refused (NL3050), and so is a
`declare function` in any build that makes a page module, `--target wasm32` or
`--emit-dts` with no `--target` (NL2666), whose functions the page supplies
through a host module instead. `--target wasm32-wasi --emit-dts` is a WASI
program, which links C, so `declare function` stays legal there. A call to a host function is an `ffi` call, so `--deny ffi` refuses it.

`--emit-ts` keeps the `import` as written, so the TypeScript reading calls the
page's own functions. With Vite, list the host modules in the plugin's `host`
option (or the `package.json` field); the plugin passes them to the compiler and
the loader, and the page passes nothing:

```js
export default { plugins: [nish({ entries: ["src/draw.ts"], host: ["web/host.ts"] })] };
```

**Cross the boundary once per batch, not once per element.** A call into a
`.node` addon costs about 30 ns and a call into wasm about 2 ns before any work
is done, so pass whole buffers and let the loop run on the Nish side.

**Do not name an exported function `memory`:** the module `build.sh
--profile wasm` or `wasm-host` links exports its linear memory under that name, so a wasm
`--target`, `--profile wasi` or `--emit-dts` compile refuses the function
(NL3038), and `build.sh` refuses IR that defines one with the `wasm` or `wasi`
profile. The wasi module does not export the function, but the name is
reserved there too, so a program that builds for wasi also builds as a
freestanding wasm module.

### Sharing memory with the page

A module keeps its state in [module storage](../language/arrays-and-strings.md#module-storage),
and under `--profile wasm-host` that storage is memory the page can read and
write directly, with no call into the module
([Host modules](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#host-modules-the-functions-a-page-supplies)).
The loaded module carries two things for it, and `--emit-dts` types both:

- **`layout`** has one entry per storage, under its name:
  `{ at, length, stride, fields? }`. `at` is its byte address in `memory`,
  `stride` the size of one element, and `fields` the byte offset of each
  field of a record element. In the `.d.ts`, `length`, `stride` and each
  offset are literal types, so a page that spells one by hand, or reads a
  field the module no longer has, fails `tsc` when the module changes.
- **`views()`** answers the whole memory as `buffer` and as each typed array
  (`u8`, `i8`, `u16`, `i16`, `u32`, `i32`, `f32`, `f64`, `i64`, `u64`), plus
  `storage.<name>`, a typed array over each storage of numbers. It answers
  the same object until a growing memory replaces `memory.buffer`, so call
  it again after each call into the module rather than keeping a view.

Both names are the loader's, so a program with module storage cannot export
a function called `layout` or `views`; the compiler refuses one and asks you
to rename it. A program without storage keeps both names.

```ts
// sim.ts
interface Body {
  x: f32;
  y: f32;
}

export const bodies = new Array<Body>(256);
export const scores = new Int32Array(8);

export const step = (): void => {
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].y = bodies[i].y + 1;
  }
};
```

```js
const sim = loadSync(bytes);
sim.step();
const v = sim.views();
const b = sim.layout.bodies;
const y3 = v.f32[(b.at + 3 * b.stride + b.fields.y) >> 2];   // 1
v.storage.scores[0] = 42;                                    // the module sees 42
```

The TypeScript reading behaves the same: `--emit-ts` writes one more file,
`nish-storage.ts`, holding a buffer laid out as `layout` says. It exports
`memory`, `layout` and `views` as the loader does, and `loadSync(exports)` and
`load(exports)`, which add those three to the module's exports, so a page
written against `memory.buffer`, `layout` and `views` runs against either build.
It differs from the wasm build in five places:

- `loadSync` and `load` take the module's exports, not wasm bytes; `load` is
  `loadSync` behind a promise.
- Its memory is fixed: `memory.grow` throws a `RangeError`.
- Its `memory.buffer` holds only the storages, so the first one sits at
  `at` 0. Read offsets from `layout`, never as constants.
- There is no `NishPanic`, `onPanic` or `NishReentry`. A panic is the
  TypeScript build's own throw, and the module is not ended by it.
- An export never refuses an argument the way the loader's `TypeError` does:
  the type checker is the guard.

### Lending an array to the page

A host function may take an array as a *buffer window*: the array, then two
`u32` parameters, `at` and `n`. The page works on elements `[at, at + n)` of
the program's own array, in place, with no copy:

```ts
// web/host.ts
import type { u32 } from "nish";

export function scale(xs: Float32Array, at: u32, n: u32): void {
  for (let i = at; i < at + n; i++) xs[i] *= 2;
}
```

```ts
// the module
import { scale } from "./web/host.ts";

const DATA = new Float32Array(64);
export const tick = (): void => {
  scale(DATA, 16, 8);
};
```

- **Six element types lend**: `u8[]`, `u16[]`, `u32[]`, `i32[]`, `f32[]` and
  `f64[]`, their `readonly` forms and their typed-array names (`Uint8Array`,
  `Float32Array`, …). Any other array is refused (NL2681); so is a window
  without `at: u32, n: u32` after it (NL2682), or with them of another type
  (NL2683). Module storage and a local array both lend; a storage of records
  does not.
- **The module checks the window before the page runs.** A window that
  reaches past the end of the array panics, naming your parameters:
  `` `scale`: argument 2 (at) plus argument 3 (n) reaches past the end of argument 1 (xs) ``.
  `at + n` is added in 64 bits, so huge values cannot wrap around the check.
  Lending `0, toU32(xs.length)` of a local array `xs` is proven in bounds
  and costs no check. A window of module storage, such as `DATA` here,
  always keeps the check, even `0, toU32(DATA.length)`: the compiler proves
  facts about locals, not about storage.
- **The page is handed a view of all of memory and an index**, so its
  `xs[at]` is the program's `DATA[at]`. Read and write only `[at, at + n)`:
  past it is the rest of the module's memory
  ([security record](../../security/wasm-host.md)).

### Strings and the page

A string crosses out of the module two ways: as an export's result, and as an
argument to a host function. Both arrive as an ordinary JS string, decoded
from the module's UTF-8 bytes by the loader with `TextDecoder`, so `"😀é"`
arrives as `"😀é"` and a byte sequence that is not UTF-8 arrives as U+FFFD.
A template formats a number the way JavaScript does: `${0.1 + 0.2}` is
`0.30000000000000004`, `${1e21}` is `1e+21`.

```ts
// app.ts
import { say } from "./web/host.ts";

export function label(n: i32): string {
  return `item ${n}`;
}
export function greet(n: i32): void {
  say(`hello ${n}`);
}
```

```js
const app = loadSync(bytes, { host });
app.label(7); // "item 7"
```

A string the module builds during a call lives only until that call returns:
the loader decodes the result first, so `label` can be called in a loop and
the module's memory stays where it was.

An export cannot *take* a string; the `.d.ts` lists it as a comment that says
so. Text goes in through module storage instead: declare a `u8[]` storage, have
the page write into it with `TextEncoder.encodeInto`, and pass the byte count.
`nish/host/text` is the module's half of both directions:

```ts
// app.ts
import { textRead, textWrite, textWriteInt } from "nish/host/text";

export const INBOX = new Array<u8>(256);
export const OUTBOX = new Array<u8>(256);

export function echo(n: i32): i32 {
  const text = textRead(INBOX, n);
  if (text === null) return -1;
  return textWriteInt(OUTBOX, textWrite(OUTBOX, 0, text), toI64(n));
}
```

```js
const app = loadSync(bytes);
const n = new TextEncoder().encodeInto("héllo", app.views().storage.INBOX).written;
const end = app.echo(n);
if (end === -1) throw new Error("echo: the text did not fit"); // subarray(0, -1) would read the rest
new TextDecoder().decode(app.views().storage.OUTBOX.subarray(0, end)); // "héllo6"
```

`textRead(buf, n)` answers the first `n` bytes as a string, or `null` when
`n` is negative or past the buffer. Each writer (`textWrite`, `textWriteInt`,
`textWriteF64`) takes the offset to write at and answers the offset after
what it wrote, so writes chain; text that does not fit writes nothing and
answers -1, and every writer passes a -1 offset straight through. The storage
is lent to these functions as a `u8[]` parameter, which they only index, take
the `.length` of, or copy out of with `String.fromBytes`.

### When the module panics

A native program that panics prints a message and stops. A module in a page
cannot stop the page, so under `--profile wasm-host` a program that keeps
[module storage](#sharing-memory-with-the-page) or imports a
[host module](#functions-the-page-supplies-host-modules) reports every panic
(an index out of range, an overflow, a `panic(...)`, an allocation
`--memory` cannot hold, a `process.exit`): it unwinds out of the module and
the call that started it throws `NishPanic`, exported by the generated
loader. A program with neither gets a plainer loader: a panic is the bare
`RuntimeError` a trap is, what the call allocated is released, and the next
call runs as before.

```js
import { loadSync, NishPanic } from "./sim.mjs";

const sim = loadSync(bytes, { onPanic: (p) => showError(p.message) });
try {
  sim.step();
} catch (e) {
  if (e instanceof NishPanic) console.log(e.kind);   // "index", "overflow", …
}
```

- **`kind`** is one of `panic`, `index`, `slice`, `overflow`, `divide`,
  `memory` and `exit` for a panic the program reports, `trap` for a bare
  WebAssembly trap, `reentry` for a call back into a busy module left
  uncaught, and `exception` for anything else a host function throws that
  escapes the module.
- **`onPanic`** is called with `{ message, kind, site }` before the
  exception is thrown. Without one, the loader writes `nish: <message>` to
  the console, as `reportPanic` from `nish/page` does.
- **Where it happened.** `build.sh` writes `<out>.sites.json` beside the
  module (`app.wasm.sites.json` for `-o app.wasm`), a list of `{ kind, at }` with `at` a `path:line:col`. Pass the
  parsed list as `sites` and each message ends with ` at <path:line:col>`;
  `site` is the index into that list, or -1.
- **A panicked module is dead.** Its memory is left as it was, for a page
  that wants to read it, but every later call throws `NishPanic` ("the
  module is dead: …") before the module runs. Load the bytes again to start
  over. An exception a host function throws that escapes the module kills it
  the same way.
- **A bad argument does not.** A number of the wrong type, a `Result` that is
  not `{ ok: true, value }` or `{ ok: false, error }` with a payload of the
  right type, or an array argument that is not the typed array it names (a
  `Proxy` and a re-prototyped `DataView` included) throws a `TypeError`
  before the module runs, and the module stays alive. A typed array whose
  buffer is detached is not refused: it reads as length 0 and is passed as
  an empty array. So does a
  getter on a `Result` argument that throws: its own error reaches the
  caller.
- **One call at a time.** A host function that calls back into the module
  while a call is still running gets `NishReentry`, and the inner call never
  runs. Left uncaught, it kills the module too. `onPanic` runs once the
  module is already dead, so a call it makes throws `NishPanic` instead.

### `nish/page` and `nish/host/ring`

`nish/page` is a small plain-JavaScript module for the page side:

- **`HostTable`** keeps the objects a host module hands the program as
  `HostHandle` values. `add(value)` stores one and answers its handle (never
  0), `get(handle)` reads it, `take(handle)` removes and answers it, and
  `size` counts what it holds. A handle that names nothing (0, one already
  taken, a number `add` never answered) throws a `RangeError` rather than
  answering `undefined`; thrown inside a host function, that kills the
  module. A taken slot is reused by a later `add`.
- **`ringOver(memory, entry)`** is the page's half of a ring the program
  keeps with `nish/host/ring`.
- **`reportPanic`** is the default `onPanic`.

```ts
// web/host.ts
import { HostTable } from "nish/page";
import type { HostHandle, u32 } from "nish";

export type Canvas = HostHandle<"canvas">;
const canvases = new HostTable<HTMLCanvasElement>();

export function openCanvas(id: u32): Canvas {
  return canvases.add(document.getElementById(`c${id}`) as HTMLCanvasElement);
}
export function closeCanvas(c: Canvas): void {
  canvases.take(c);
}
```

Only the exported function signatures are read, so the table, the import
of `nish/page` and the bodies are the page's own code.

A ring passes a stream of `i32` words between the page and the program
through module storage, with no call: the program declares an
`Int32Array(2 + N)` (two counts, then `N` slots) and uses `nish/host/ring`'s
`ringPush`, `ringShift`, `ringSize`, `ringFree`, `ringCapacity` and
`ringClear` on it; the page wraps the same storage with `ringOver`, whose
`push`, `shift`, `size()`, `free()`, `capacity` and `clear()` agree with
them. `push` answers `false` when the ring is full, and `shift` answers 0
when it is empty.

```ts
// game.ts
import { ringShift, ringSize } from "nish/host/ring";
import { steer } from "./web/host.ts";

const INPUT = new Int32Array(2 + 64);

export const tick = (): void => {
  while (ringSize(INPUT) > 0) {
    steer(ringShift(INPUT));
  }
};
```

```js
import { ringOver } from "nish/page";

const game = loadSync(bytes);
const input = ringOver(game.memory, game.layout.INPUT);
addEventListener("keydown", (e) => input.push(e.key === "ArrowLeft" ? -1 : 1));
requestAnimationFrame(function frame() {
  game.tick();
  requestAnimationFrame(frame);
});
```

## C

`--emit-header` writes a prototype for each exported function. It includes
`nish.h`, the runtime's public header in `$NISH/runtime`:

```console
$ nish stats.ts -o stats.ll --emit-header stats.h
$ grep -A1 '^/\* add' stats.h
/* add(a: number, b: number): number */
int32_t add(int32_t a, int32_t b);
```

```c
#include <stdio.h>
#include "stats.h"

int main(void) {
  printf("add(2, 3) = %d\n", add(2, 3));
  return 0;
}
```

```console
$ $NISH/scripts/build.sh stats.ll $NISH/runtime/runtime.c host.c -o host -I$NISH/runtime
$ ./host
add(2, 3) = 5
```

An array is a `nish_array` (a length, a capacity and a data pointer), and a
string is a `nish_str`. Both live in the runtime's arena: a value a function
returns stays valid until you call `nish_reset_arena()` or
`nish_arena_release()`. The comment at the top of the header says how to pass
a buffer of your own.

A `Result` crosses too: the header gives it a C struct, and the addon and the
wasm loader turn it into `{ ok: true, value }` or `{ ok: false, error }`. See
[Interop](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#interop) for which `Result`s each host takes.

## Calling C from Nish: `declare function`

`declare function` names a C function the program calls but does not define.
The symbol is the name as written, and the call is an ordinary call:

```ts nish:ok
declare function abs(n: i32): i32;

export const main = (): i32 => {
  console.log(`${abs(-5)}`); // 5
  return 0;
};
```

A package or a `std/` module may declare C functions too, and they bind to the
same C name: `declare function abs` in a package calls C's `abs`, not a symbol
of the package. Every declaration of one name must give it the same types.
A function you define may not take a declared name either, since its symbol
would be the C one, unless it is private and named like a C library function
(`abs`, `free`, …): those always get a symbol of their own.

A build that makes a page module, `--target wasm32` or `--emit-dts` with no
`--target`, refuses `declare function` (NL2666): a page supplies its functions
through a [host module](#functions-the-page-supplies-host-modules) instead. A
`--target wasm32-wasi` build links C, so it keeps `declare function` even with
`--emit-dts`.

A function from the C library links with `nish run` or `--link` as it is. One
of your own goes on the build line beside the runtime:

```console
$ nish app.ts -o app.ll
$ $NISH/scripts/build.sh app.ll $NISH/runtime/runtime.c mylib.c -o app
```

Scalars cross: the integer and float widths (`i32`, `u8`, `u64`, `f64` and
the rest), `boolean` and `void`. So does a `string` *parameter*, which C reads
as a NUL-terminated `const char *`:

```ts nish:ok
declare function puts(s: string): i32;
declare function strlen(s: string): u64;

export const main = (): i32 => {
  puts("hello");
  const word = "nish" + "!";
  console.log(`${strlen(word)}`); // 5
  return 0;
};
```

C *borrows* the string: it may read the bytes until it returns, and may not
keep the address or write through it. Nothing is copied, so a C function that
keeps its argument (`putenv`) or writes into it (`strtok`) must be declared to
take a `CPtr` instead, and handed memory C allocated. A `string | null`
parameter passes `NULL` for `null`.

A Nish string can hold a NUL byte, and C would stop reading at it, so a string
that holds one stops the program before the call instead:

```console
`strlen`: argument 1 (s) holds a NUL byte, which C would read as the end of the string
```

A literal with no NUL in it is checked at compile time and costs nothing at run
time; any other string is checked with one scan of its bytes. `--emit-panics`
lists each checked call as an `ffi-nul` site.

A `string` *result* crosses the other way, as a copy. C answers a
`const char *` into a buffer it keeps, and the program copies the bytes into a
string of its own at the call, so a later call that overwrites C's buffer
changes nothing the program holds. Each call makes a new copy, which lives
like any other string the function makes, in a loop as anywhere else. A C
function that may answer `NULL` is declared `string | null`, and `NULL` arrives
as `null`:

```ts nish:ok
declare function strerror(errnum: i32): string;
declare function getenv(name: string): string | null;

export const main = (): i32 => {
  console.log(strerror(2)); // No such file or directory
  const home = getenv("HOME");
  console.log(home === null ? "no HOME" : "HOME is set");
  return 0;
};
```

A result declared `string` that is `NULL` after all stops the program, because
a `string` cannot hold it, and `--emit-panics` lists the call as an `ffi-null`
site:

```console
`getenv` returned NULL for a `string` result; declare it `string | null`
```

A string C allocated for the caller to free (`strdup`) is a `CPtr`, not a
`string`: the copy would leave C's allocation with no one to free it.

A class, an interface or an array other than the byte buffer below is
refused, in either direction, because nothing else the Nish compiler allocated
may reach code it cannot see:

```ts nish:err NL2551
declare function execvp(file: string, argv: string[]): i32;

export const main = (): i32 => {
  return 0;
};
```

A `u8[]` parameter is a byte buffer C writes into, and a `readonly u8[]` one
C only reads, as C's `const`. A run of one or more buffers is followed by one
`u64`, the number of bytes C may touch in each of them:

```ts nish:ok
declare function memcpy(dst: u8[], src: readonly u8[], n: u64): CPtr;
declare function getentropy(buf: u8[], n: u64): i32;

export const main = (): i32 => {
  return 0;
};
```

The count is paired by position, so it is your word, not the compiler's proof.
`fwrite(ptr, size, nmemb, stream)` touches `size * nmemb` bytes: declare it
`fwrite(buf: readonly u8[], n: u64, one: u64, f: CPtr)` and call it with `1`
as the third argument, so the one count is the whole size. A buffer with no
`u64` after it, a count of another type, an `i32[]`, a `u8[] | null` and a
`u8[]` result are each refused.

A call passes the array's bytes, and checks the count against each buffer
first: a count larger than the array stops the program before C runs, with
`` `write`: argument 3 (n) counts more bytes than argument 2 (buf) holds ``
and exit 1. Pass `toU64(buf.length)` of the buffer itself and the compiler
proves the count, so the call carries no check and compiles under
`--deny-panics`:

```ts nish:ok
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

export const main = (): i32 => {
  const bytes: u8[] = [104, 105, 10];
  write(1, bytes, toU64(bytes.length));
  return 0;
};
```

C borrows the bytes for the length of the call, and may write a `u8[]` (not a
`readonly u8[]`), so `read(fd, buf, toU64(buf.length))` fills `buf` in place.
A task a scope spawns may not call such a function: C's body is unseen, so the
call could write memory the parent is reading.

The one exception is `CPtr`, an address that C owns. A declared function can
take or return one, a local can hold one, and nothing else can: no field, no
array, no arithmetic. A `CPtr | null` from C is narrowed before it goes back:

```ts nish:ok
declare function calloc(count: u64, size: u64): CPtr | null;
declare function free(block: CPtr): void;

export const main = (): i32 => {
  const block = calloc(16, 8);
  if (block !== null) {
    free(block);
    console.log("allocated and freed");
  }
  return 0;
};
```

That is how a string C allocated comes back. Declare it `CPtr | null`, narrow
it, copy it with `readCString` from `nish:unsafe`, and free C's buffer
yourself. A parameter declared `CPtr | null` takes the literal `null`, which is
how `realpath` is asked to allocate:

```ts nish:ok
import { readCString } from "nish:unsafe";

declare function realpath(path: string, resolved: CPtr | null): CPtr | null;
declare function free(p: CPtr): void;

export const main = (): i32 => {
  const p = realpath(".", null);
  if (p === null) {
    return 1;
  }
  const dir = readCString(p);
  free(p);
  console.log(dir.length > 0 ? "resolved" : "empty");
  return 0;
};
```

The copy is an ordinary Nish string, so it outlives `free(p)`. `readCString`
is in `nish:unsafe` because nothing proves the pointer is live or that its
bytes end in a NUL: reading a freed or unterminated buffer is undefined
behaviour, and the import is where a module says it takes that on. It takes a
`CPtr`, not a `CPtr | null`, so an unnarrowed pointer is refused.

A `NULL` reaches C only where the source spells it. A nullable pointer held in
a variable is refused, because the path that passes it `NULL` is one nobody
wrote on purpose:

```ts nish:err NL2539
declare function free(p: CPtr | null): void;
declare function getcwd(buf: CPtr | null, size: u64): CPtr | null;

export const main = (): i32 => {
  const p = getcwd(null, 0);
  free(p);
  return 0;
};
```

```console
Argument 1 of `free` is a `CPtr | null` the program holds: a nullable foreign parameter takes the literal `null` or a pointer narrowed with `!== null`, so C is never handed a null by a path nobody tested
```

A class with a `CPtr` field is a *handle class*: it owns the C resource, and
its `[Symbol.dispose]` is exactly the call that closes it. Open one with
`using`, and the compiler closes it for you, once, at every exit of the
block — falling off its end, an early `return`, `break`, `continue`, or an
`orReturn()` that propagates:

```ts nish:ok
declare function fopen(path: string, mode: string): CPtr | null;
declare function fclose(p: CPtr): i32;
declare function fgetc(p: CPtr): i32;

class File {
  readonly file: CPtr | null;
  constructor(path: string) {
    this.file = fopen(path, "r");
  }
  read(): i32 {
    const p = this.file;
    if (p === null) {
      return -1;
    }
    return fgetc(p);
  }
  [Symbol.dispose](): void {
    const p = this.file;
    if (p !== null) {
      fclose(p);
    }
  }
}

const firstByte = (path: string): i32 => {
  using f = new File(path);
  return f.read();
};

export const main = (): i32 => {
  console.log(firstByte("/dev/null"));
  return 0;
};
```

```console
-1
```

A handle is never copied, stored or returned: you call its methods, or lend
it to a parameter of its own type. Several declarators in one `using` open
one at a time, so an `orReturn()` in a later initialiser closes the ones
before it. Falling off the end, `break` and `continue` close them in reverse
order beside an `arena()`, a `scope()` or a lock.

A `return` or an
`orReturn()` first waits for every `scope()`'s tasks, then computes its value,
then closes the handles and gives back the locks, innermost first, and only
then releases the arenas. A panic or `process.exit` ends
the process without the close; the operating system takes the descriptor
back, but a bounds panic does not flush what C still buffers, so call
`fflush` on a `FILE *` you wrote before code that may panic. The rules are in
[A handle class](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#a-handle-class-a-class-that-owns-a-cptr).

A declared function has no body and cannot be exported. Calling C has a cost
beyond the call: the compiler cannot prove anything about code it cannot see,
so it drops the optimisation facts it would otherwise give the caller and
everything that calls it. The rules are in
[Calling C](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#calling-c).
