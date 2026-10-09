# WP8: Interop: C headers, TypeScript declarations, N-API addons, wasm

**Status: complete** (0.1.0). It was extended later:

- `--emit-napi-async` (WP24 A1, #67, 0.3.0);
- the unsigned widths as typed arrays (WP30, #138, 0.6.0);
- generic instantiations exported under valid, injective names (WP18 G8,
  #165, 0.9.0);
- ranged parameters at the boundary (WP31, #273, 0.13.0);
- the by-value `Result` (WP17).

The generators are `src/interop-*.ts`. The stage0 twins and the
`interop_oracle.js` byte-for-byte comparison went with stage0 in WP19 R6. The
living reference is [LANGUAGE.md "Interop"](LANGUAGE.md#interop). This note
keeps the ABI, the boundary rules and the measurements behind them.

Nish never embeds a JavaScript engine. A compiled module is *called from* C,
from Node through a native addon, or from JavaScript as WebAssembly. All three
sets of host declarations are generated from the same checked program the IR
came from:

```
nish x.ts -o x.ll --emit-header x.h --emit-dts x.d.ts --emit-napi x_napi.c
```

## The C ABI

A Nish function is an ordinary C function: parameters by value, in order, with
no hidden context and no name mangling. `runtime/nish.h` is the runtime half
of the ABI. It declares `nish_str`, `nish_array`, `struct nish_arena`, every
runtime prototype and `NISH_SYMBOL`, and is C11- and C++-clean under
`-Wall -Wextra -Werror -pedantic`. `tests/run.js` fails if it and
`src/runtime.ts` drift apart.

| Nish | C | N-API (JS) | wasm, through the generated loader |
| --- | --- | --- | --- |
| `i32` (`number` in i32 mode) | `int32_t` | `number`, ToInt32 | `number` |
| `f64` (`number` in f64 mode) | `double` | `number` | `number` |
| `i64` / `u64` | `int64_t` / `uint64_t` | `bigint` | `bigint` (`u64` through `BigInt.asUintN(64, …)`) |
| `u8`, `u16`, `u32` | `uint8_t`, `uint16_t`, `uint32_t` | `number`: ToUint32, then the width's modulus; out through `napi_create_uint32` | `number`, masked by the loader (see below) |
| `f32` | `float` | `number`, rounded in by `nish_napi_f32` | `number`, untouched |
| `boolean` | `bool` (`i1 zeroext`) | `boolean` | in `boolean`, out `0 \| 1` (`WasmBool`) |
| `string` | `const nish_str *` in, `nish_str *` out | `string`, copied both ways | not available (no runtime strings in freestanding wasm) |
| `i32[]`, `f32[]`, `f64[]`, `i64[]`, and since WP30 `u8[]`, `u16[]`, `u32[]`, `u64[]` | `const nish_array *` if never written through, else `nish_array *` | the matching typed array, borrowed in, copied out | the matching typed array, copied in and out |
| a by-value `Result` over scalars | a one-word struct (WP17) | `{ ok, value }` / `{ ok, error }` | the same union |
| classes, `T \| null`, `string[]`, `boolean[]`, nested arrays, `Map` | `struct X *` / `nish_array *` in the header | not bridged | not exported |

`nish_str` is `{ uint64_t len; char data[]; }`: the UTF-8 byte length, then
NUL-terminated bytes. `nish_array` is `{ uint64_t len; uint64_t cap; char *data; }`,
so `len` is at offset 0, `cap` at 8 and `data` at 16
([wp4-arrays.md](wp4-arrays.md#layout-abi)). Strings and arrays the module
returns live in the arena until `nish_reset_arena()` or `nish_free_arena()`,
and a host never frees one. A C host can pass its own buffer through a stack
header, `nish_array a = { n, n, (char *)buf };`. Otherwise
`nish_alloc_array(elemSize, len)` makes an arena-owned array.

### `--emit-header <file.h>`

- **What is declared.** Every external symbol of the link: the exports, or
  every function under `--no-strict-exports`. Each imported module appears
  under its own `/* file.ts */` heading. The entry `main` is omitted, because
  the C host owns `main`.
- **Names C cannot spell.** A keyword-named function such as
  `export function double` is declared as
  `double_(…) NISH_SYMBOL("double")`, an asm label bound to the real symbol
  that also covers Mach-O's `_` prefix. Methods and constructors use the same
  mechanism (`Point_constructor(struct Point *this_, …)
  NISH_SYMBOL("Point.constructor")`).
- **Classes and interfaces** become `struct <Name>` with the compiled layout:
  an implemented interface's fields first, flattened. Forward declarations come first, so structs
  may point at each other. The `layout` block of `tests/run.js`
  static-asserts every size against hand-written C twins.
- **Comments.** Every prototype carries its source signature and its array
  element types in a comment. A ranged parameter's comment also says it
  panics outside its range (WP31).

## `--emit-dts <file.d.ts>`: typings and a loader for the wasm build

`scripts/build.sh --profile wasm` links a freestanding module with
`--export-all`, against `runtime/runtime-wasm.c`. That file is an arena over
linear memory, the array cold paths, trapping panics, and the `fmin`, `fmax`,
`fminf` and `fmaxf` that `Math.min` and `Math.max` of a float become on wasm32,
which has no instruction with `minnum`'s NaN rule
(`tests/cases/math_minmax_float`). It has no strings, no I/O and no other libm:
`Math.pow`, `sin`, `cos`, `exp` and `log` still need a libm the profile does
not link. An array argument is a pointer into linear memory, which is not
a JS value, so `--emit-dts x.d.ts` writes two files: the declarations, which
use typed arrays, and `x.mjs`, the loader that implements them. **Both come
from one predicate**, `wasmSkipReason`, so that neither file can describe a
function the other omits. They used to be two predicates, and they drifted:
`port(p: u16)` was declared and then missing from `load()`, which surfaced as
a `TypeError` with no diagnostic. A function that cannot cross is written as a
comment naming the position and the type that stopped it.

A wrapped call such as `scale(xs, 2)` does four things:

- It runs inside `scoped`, which takes `nish_arena_mark()` and calls
  `nish_arena_release` in a `finally`, so the arena is recycled even when the
  module traps.
- `arrayIn` checks `instanceof` and throws a `TypeError` naming the function
  and the parameter. It then copies the argument into a
  `nish_alloc_array` (about 0.6 ns per element).
- `arrayOut` returns `new TypedArray(memory.buffer, data, len).slice()`. The
  copy is needed because the next `memory.grow` detaches a view, and the
  release lets the module overwrite the data.
- A parameter the function writes through is copied back, so the wasm and
  N-API builds agree.

`memory.buffer` is re-read after every call. The profile passes
`-mbulk-memory`, so that zero-fills and copies lower to `memory.fill` /
`memory.copy`. A module without arrays links nothing extra (`add.wasm` is 279
bytes).

### The unsigned widths

The wasm ABI has four value types, so `u8`, `u16` and `u32` travel as `i32`,
and `u64` as `i64`. The loader is the only place their range can be restored,
and it uses the spellings `runtime/shim.mjs` uses:

```js
idU8:  (x) => raw.idU8(x & 0xff) & 0xff,
idU16: (x) => raw.idU16(x & 0xffff) & 0xffff,
idU32: (x) => raw.idU32(x) >>> 0,
idU64: (x) => BigInt.asUintN(64, raw.idU64(x)),
```

- **Out.** A `u32` result arrives signed: `idU32(4294967295)` is `-1` without
  the `>>> 0`. A `u8` or `u16` result needs its mask because the callee never
  narrows the 32-bit register: `addU16(65535, 2)` answers 65537 where the
  language says 1.
- **In.** `u32` and `u64` need nothing, because ToInt32 and ToBigInt64 give
  the right bits. `u8` and `u16` are masked because the emitted parameter is a
  bare `i8` / `i16` with no `zeroext`. That makes zero-extension the caller's
  obligation, and today's backend happens to mask inside the callee only by
  luck. Masking also matches `new Uint8Array([300])[0]`, which is 44.
- **`f32`** needs nothing: the call rounds the argument, and every f32 is exact
  in a double.
- **Arrays of the unsigned widths** need no masking at all. A `Uint8Array`
  store truncates, and its view yields only 0–255 (WP30).

`tests/self/interop-unsigned.ts` and `interop-unsigned-arrays.ts` are the
fixtures.

## `--emit-napi <shim.c>` and `--profile napi`: a native Node addon

The shim is generated per module. It gives Node `-O3` machine code with the
runtime linked in, through Node-API, so the `.node` file works across Node
versions without a rebuild. Each bridged export gets a `napi_callback` that:

- checks the argument count and each argument's JS type, throwing a
  `TypeError` that names the function and the parameter;
- converts each argument;
- calls the function through its C ABI;
- boxes the result.

`scripts/build.sh --profile napi` uses the `speed` flags plus `-shared -fPIC`,
and `-Wl,-undefined,dynamic_lookup` on macOS. It finds `node_api.h` next to
the running `node`, or at `NODE_INCLUDE`, and a missing header is a clear
error. The `add.ts` addon is 8.5 KB. ESM loads it through `createRequire`.

**Numeric widths follow JavaScript's typed-array store rule:** convert, then
take the width's modulus, and never throw. So `echoU8(300)` is 44 and
`echoU32(-1)` is 4294967295, which is how `i32` already behaved under
`x | 0`. Two decisions are deliberate:

- a `u32` result is boxed with `napi_create_uint32`, so it stays positive;
- `nish_napi_f32` sends anything at or past `0x1.ffffffp127` to an infinity,
  because C leaves an out-of-range double-to-float conversion undefined.

`i64` / `u64` take a `bigint`, and a JS `number` there is a `TypeError`. A
ranged parameter is read as a double and throws a `RangeError` outside
`[Lo, Hi]`, before ToInt32 could wrap it into range (WP31).
`tests/self/interop-widths.ts` is the fixture.

### Functions the shim cannot bridge say so

Every external function is either wrapped or written into the shim as a
comment naming the position and the type that stopped it, under a heading
listing what does cross:

```c
/* app.ts: move(p: Point, dx: number): Point -- not bridged: parameter 1 (p) is Point */
```

This is not decoration. The unsigned widths were missing from every addon for
as long as the reader table had no row for them, because the function was
dropped under a message that named no type.

### Arrays and strings across the boundary

**A typed-array argument is borrowed, not copied.** The shim checks the
element kind and builds the `nish_array` header on the C stack over the typed
array's own bytes. A million-element `Float64Array` therefore crosses in the
time it takes to read one pointer, and `fill(xs, 7)` writes into the buffer
the caller holds. The borrow has two consequences:

- the callee must not retain the pointer, which only a returned alias could
  do, and results are copied;
- a `push` that grows a borrowed array moves it into the arena, invisibly to
  JS.

**A returned array or string is copied** into a fresh typed array or JS
string, so no JS value ever aliases the arena. **A string argument** is copied
into an arena `nish_str`. Every wrapper that touches the arena brackets the
call with `nish_arena_mark` / `nish_arena_release`, including its failure
paths (`nish_napi_fail_at`), so a host never needs to reset the arena for
bridged calls.

### `--emit-napi-async <shim.c>`: the same exports, off the event loop

The synchronous shim runs on Node's main thread, so a 200 ms function blocks
the event loop for 200 ms. That is the defect
[wp24-async.md](wp24-async.md) §5.1 names A1. `--emit-napi-async` writes the
same shim **plus** a promise-returning `<name>Async` for every export whose
arguments and result are scalars. It uses `napi_create_async_work` on libuv's
pool. There is no language surface: all of the asynchrony is generated C.
Measured with `examples/node-addon-async.mjs`, the worst loop stall during a
220 ms call fell from 218 ms to 0.36 ms.

- **`--threads` is required on both halves.** The worker allocates, so both
  the shim and the module's IR need the thread-local arena. The shim
  `#error`s without `-DNISH_THREADS`, and `nish` refuses the flag without
  `--threads` (exit 2), because a non-TLS reference would link silently.
- **`<name>Async` rejects; it never throws.** The promise is created before the
  arguments are read.
- **Scalars only.** A string result lives in the worker's arena. A typed array
  is borrowed only for the duration of the callback that read it, which an
  asynchronous call outlives. A by-value `Result` parameter crosses, but a
  `Result` result does not yet. Marshalling through a `malloc`ed copy would
  lift these restrictions, and was left out deliberately.

Without the flag, `--emit-napi` writes a byte-identical shim.

## Batching: cross the boundary once per batch

`bench/ffi.mjs` sums 1..1,000,000 across each boundary (`bench/sum.ts`, f64
mode; best of 5, x86_64 Linux, Node 22, clang 18):

| Path | Per element |
| --- | ---: |
| N-API, one call per element | 29.9 ns |
| wasm, one call per element | 2.3 ns |
| N-API, one call over a borrowed `Float64Array` | 0.54 ns |
| wasm, one call over a copied-in `Float64Array` | 1.13 ns |
| JS loop / JS loop over the `Float64Array` | 0.48 / 0.96 ns |
| one call to closed-form `sumTo(n)`, either build | under 1 µs in total |

An N-API crossing costs about 30 ns, which is 60× a JS add, so per-element
calls into an addon never pay. A wasm crossing is about 13× cheaper, but still
5× slower than the JS loop body. **The design rule for every Nish boundary is
to pass a whole array, string or buffer in, process it in native memory, and
return one result.** With the data in the call, the addon's `-O3` loop beats
V8 over the same buffer. Wasm pays for the copy, because a JS buffer cannot be
aliased from linear memory. `sumTo` is written in closed form, which is what
LLVM's scalar evolution makes of the loop anyway.

## Not in this package

- **Strings and I/O from wasm.** `runtime-wasm.c` has no strings, so string
  functions stay comments in the `.d.ts`. The `wasi` profile
  ([wp7-runtime.md](wp7-runtime.md#wasi-target)) runs whole programs, but it
  does not generate a loader for library exports.
- **Zero-copy arrays in wasm.** A host can build a header in `memory.buffer`
  itself and call the raw export (`nish_alloc_array` is exported for that). A
  caller-owned destination instead of `.slice()` is measured in
  [wp30-bytes-interop.md](wp30-bytes-interop.md) and left to its own package.
- **Classes, `T | null`, `string[]`, `boolean[]`, nested arrays and `Map`**
  across either JS boundary. They are reported, never silently omitted.
- **A one-shot `--link`-style flag for addons.** It would change `--link`'s
  contract (a program with `main`), so building an addon stays two commands.
