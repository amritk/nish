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

In a browser, pass `load` the `arrayBuffer()` of a `fetch` response. The `wasm` profile
is freestanding — no C library — so functions that take or return strings, or
do I/O, are not callable from it; the generated `.d.ts` lists them as
comments. A whole program that does need them can be built for WASI instead,
with `nish app.ts --link app.wasm --profile wasi` (which needs a WASI sysroot;
see [INSTALL.md](../../INSTALL.md#wasi-optional-for---profile-wasi)), and run
under any WASI host.

**Cross the boundary once per batch, not once per element.** A call into a
`.node` addon costs about 30 ns and a call into wasm about 2 ns before any work
is done, so pass whole buffers and let the loop run on the Nish side.

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
[Interop](../../LANGUAGE.md#interop) for which `Result`s each host takes.

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

A function from the C library links with `nish run` or `--link` as it is. One
of your own goes on the build line beside the runtime:

```console
$ nish app.ts -o app.ll
$ $NISH/scripts/build.sh app.ll $NISH/runtime/runtime.c mylib.c -o app
```

Only scalars cross: the integer and float widths (`i32`, `u8`, `u64`, `f64`
and the rest), `boolean` and `void`. A string, an array, a class or an
interface is refused, because nothing the Nish compiler allocated may reach
code it cannot see:

```ts nish:err NL2322
declare function puts(s: string): i32;

export const main = (): i32 => {
  puts("hello");
  return 0;
};
```

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

A declared function has no body and cannot be exported. Calling C has a cost
beyond the call: the compiler cannot prove anything about code it cannot see,
so it drops the optimisation facts it would otherwise give the caller and
everything that calls it. The rules are in
[Calling C](../../LANGUAGE.md#calling-c).
