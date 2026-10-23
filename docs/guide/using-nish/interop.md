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

**Do not name an exported function `memory`:** the module `build.sh
--profile wasm` links exports its linear memory under that name, so a wasm
`--target`, `--profile wasi` or `--emit-dts` compile refuses the function
(NL3038), and `build.sh` refuses IR that defines one with the `wasm` or `wasi`
profile. The wasi module does not export the function, but the name is
reserved there too, so a program that builds for wasi also builds as a
freestanding wasm module.

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
its `[Symbol.dispose]` is exactly the call that closes it. The compiler checks
such a class and every place one goes, but does not yet lower `using` of one,
so `using f = new File(path)` is refused with "`using` of handle class `File`
is not lowered yet: until a release emits its close, hold the `CPtr` in a
local and close it yourself" — do exactly that, as above. The rules are in
[A handle class](../../LANGUAGE.md#a-handle-class-a-class-that-owns-a-cptr).

A declared function has no body and cannot be exported. Calling C has a cost
beyond the call: the compiler cannot prove anything about code it cannot see,
so it drops the optimisation facts it would otherwise give the caller and
everything that calls it. The rules are in
[Calling C](../../LANGUAGE.md#calling-c).
