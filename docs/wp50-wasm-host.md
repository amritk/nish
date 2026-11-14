# WP50: A WebAssembly module a TypeScript page drives

**Status: accepted, 2026-11-06; stages 1 to 6 built.** The owner accepted every
recommendation in §13, with Q1 revised: the functions a page supplies are an
`import` from the page's own TypeScript module (§3), not a `declare function`.
Stage 1 (§14) is built: `--profile wasm-host`, `--memory`, `--inline`, the
loader's `loadSync` and `nish/vite`. Stage 2 is built: host modules
(`--host`, `nish.host`, `src/host-module.ts`), their import attributes,
`HostHandle<K>`, `Imports` in the `.d.ts`, the loader's adapters, the kept
`import` under `--emit-ts`, the refusals NL2661–NL2670, NL3049 and NL3050, and
the plugin's `host` option (`tests/run.js`, section `host-import`). Stage 3 is
built: module storage (`src/module-storage.ts`) and its codes, `Layout` and
`views()`, buffer windows, the `nish.panic` import with site numbers and
`<out>.sites.json`, the loader's re-entry and dead-module guard, `nish/page`
and `nish/host/ring`, and the storage's TypeScript reading
(`src/emit-ts-storage.ts`, which departs from §5.4's sketch as it says); its
security record is `docs/security/wasm-host.md`. Stage 4 is built: string
parameters of host imports and string results of exports (§7), `nish/host/text`,
a module-storage `u8[]` lent to a `u8[]` parameter, and `runtime/runtime-text.c`
(`tests/run.js`, section `host-import-text`). Stage 5a is built: on a page
module `Math.sin`, `cos`, `exp`, `log` and `pow` call `std/math.ts`'s fdlibm
ports and a float `%` its `fmodF64`, so both page profiles link them with no
import (`tests/run.js`, section `wasm-math`). Stage 5b is built:
`--deterministic`, which lowers the five on every target to the same
functions, sends the TypeScript reading to `nish/math`, makes `f64ToBits` and
`f32ToBits` give the canonical quiet NaN, refuses the nondeterministic
capabilities (NL2700–NL2701, NL3052–NL3054), reads `Number(s)`,
`parseFloat` and `parseInt` with the `--emit-ts` grammar, compiles every
runtime unit with `-ffp-contract=off`, and holds the float corpus
(`tests/differential/corpus/float/`) to one `expected.txt` natively, on
wasm32-wasi and under `--emit-ts` (`tests/run.js`, sections `deterministic`
and `float-corpus`; CI's `simd-arm64` job runs it on AArch64). Stage 6 is
built: `examples/wasm-arena/`, its replay check (`tests/run.js`, section
`wasm-arena`), its size row (`wasm-size`) and the `interop` workflow's `arena`
job, the ten-minute Chromium soak (§10). The anchors below are at `39a87b3b`.
[LANGUAGE.md](LANGUAGE.md) stays normative; the spellings in this note are
the accepted design. Stages 1 to 6 are built.

cs, a browser arena shooter, is moving the bulk of its client into Nish
compiled to WebAssembly: the fixed-step simulation (the same source the native
game server compiles), prediction, reconciliation and interpolation, the
snapshot codec, map decoding, geometry and the per-frame instance list, and the
WGSL and GLSL text it generates at start-up. The TypeScript that stays is the
page: menus, the title screen, the `window.cs` test hook, and a thin layer over
WebGPU, WebGL 2, Web Audio, WebTransport and input. The page calls into the
module every frame, and the module calls out to the page for anything the
browser owns.

This note is the Nish half of that boundary. It is
[wp34](wp34-hosting-cs.md) §8's **N8** (host imports on wasm) and the
host-driven half of **N9**, which [wp46](wp46-long-running-memory.md) left
open. It keeps [wp27](wp27-ffi.md) and [wp53](wp53-ffi-buffers-handles.md)'s
rules (buffers lent for the call, write-through, typed handles), and it changes
their spelling for the page. A C function stays a `declare function`, and a
function the page supplies is imported from the page's own TypeScript, where
it is written (§3). The aim is that the module and the page read as one
TypeScript program. The boundary is implicit wherever crossing it is free, and
refused, with the explicit form named, wherever it would copy or allocate in
secret.

## 1. What is there today

Each row was checked against `main` at `39a87b3b`.

| | Today | Where |
| --- | --- | --- |
| Imports | none. A `declare function` is `declare <ret> @name(...)` with no attributes, and `--profile wasm` links it against the C it is given. An unresolved one is `wasm-ld: undefined symbol`, because the link has no `--allow-undefined`. The loader instantiates with `{}` | `src/emit.ts:1071` (`foreignDeclarationFor`), `scripts/build.sh:752-755`, `src/interop-wasm.ts` (`generateWasmLoader`) |
| The TypeScript reading of a declaration | refused: NL4010, "`--emit-ts` cannot write a module that declares C functions" | `src/emit-ts-edits.ts:1288`, `src/codes.ts:436` |
| Shared memory | none the page can hold. Every array argument is copied into the arena by `arrayIn` and copied back out by `arrayOut(...).slice()` | [wp8](wp8-interop.md) "`--emit-dts`", [wp30](wp30-bytes-interop.md) "Deferred" |
| Long-lived state | **none.** A module has no top-level `let`, and a module `const` is a folded scalar or string with no symbol: "an array, class, or interface constant would need an allocation, and there is no code to run it" | LANGUAGE.md "Module constants", "Top-level code" |
| Strings on wasm | none. `runtime/runtime-wasm.c` has no string runtime, and `wasmSkipReason` leaves out every function that takes or returns one | `runtime/runtime-wasm.c:1-14`, `src/interop-wasm.ts:163-198` |
| Reclaiming | one bump arena from `__heap_base`, grown by `memory.grow`, never shrunk. The loader brackets each call in `nish_arena_mark` / `nish_arena_release`. Regions are refused by `build.sh`, not by a diagnostic: "it has no malloc" | `runtime/runtime-wasm.c:40-86`, `scripts/build.sh:676-686` |
| Panics on wasm | `__builtin_trap()`, with the message and the operands discarded. The page sees a bare `RuntimeError` | `runtime/runtime-wasm.c:118-128` |
| Loading | `export async function load(bytes)` and `WebAssembly.instantiate(bytes, {})`. The generated loader imports nothing from Node. The guide tells a browser to pass it a `fetch` | `src/interop-wasm.ts:699-700`, `docs/guide/using-nish/interop.md` |
| Exports | `--export-all`, so every runtime symbol is exported and `--gc-sections` cannot drop any of it: `floor`, `ceil`, `trunc`, `nish_round_init`, every panic stub and the linker's own globals (`__data_end`, `__stack_low`, `__table_base`, ...) come with every module that links `runtime-wasm.c` | `scripts/build.sh:754` |
| Memory size | wasm-ld's defaults: no `--initial-memory`, no `--max-memory`, no `-z stack-size` | `scripts/build.sh:752-755` |
| `Math` on wasm | `sin`, `cos`, `exp`, `log` and `pow` lower to `llvm.sin.f64` and friends, which become libm calls that **fail to link** on freestanding wasm (`undefined symbol: sin`). No diagnostic catches it first. `tan`, `atan2` and `hypot` are Nish code in `std/math.ts` and link | `src/emit-builtins.ts:176-190`, `src/checker.ts:382-390` |
| Browser CI | the `interop` workflow's `chrome` job runs Playwright's Chromium against the QUIC and TLS servers. No job loads a `.wasm` in a browser | `.github/workflows/interop.yml:389-461` |
| A size guard | none for wasm. `scripts/size-report.sh` prints a row and nothing fails on it | `scripts/size-report.sh:79-83` |

Two more facts the design leans on:

- **Arrays of plain interfaces are already contiguous records**, at the
  stride and alignment clang gives the matching C array (LANGUAGE.md "Arrays of
  records are contiguous"). The layout the page needs exists; it is just not
  exported.
- **The compiler already reports where every allocation goes**: `--emit-arena`
  labels each site `stack`, `pass`, `block`, `function`, `returned`, `caller`,
  `kept` or `unscoped` (LANGUAGE.md "Arena placement"). §6 needs only one fact
  out of that machinery, and it is a type rule rather than an analysis.

## 2. The shape

```
 page (TypeScript)                             module (Nish → wasm32)
 ───────────────────────────────────────────   ────────────────────────────────
 requestAnimationFrame ──── frame(dtMs) ─────▶ export: step the fixed tick,
                                                build the instance list
 keydown/pointer ── writes ─▶ ┌──────────────── module storage (§5) ─────────┐
                              │ input ring · world · instances · out ring    │
 writeBuffer(view) ◀─ reads ──└──────────────────────────────────────────────┘
 imports: gpu, audio,  ◀───── host calls ────── import from host.ts (§3)
 transport, log, panic        handles (§4), (view, at, n) buffers,
                              strings decoded once (§7)
```

There is one linear memory, sized at instantiation and never grown in the mode
cs uses. The page makes its typed-array views over it once, at start-up. Every
crossing on a per-frame path is a number or a window `(view, at, n)` into that
memory: nothing is copied and nothing is allocated in JavaScript.

Everything below is opt-in at two places. At compile time it is a **wasm
build**: `isWasmBuild` (`src/visibility.ts`), which is `--target wasm32-*` or
`--emit-dts`. At link time it is a new profile, `scripts/build.sh --profile
wasm-host`, so that `--profile wasm` and every module built with it today stay
byte-identical (Q5).

## 3. W1. Imports: an `import` from the page's own TypeScript

**Decided by the owner, 2026-11-06** (Q1 as revised). The functions the page
supplies are written once, in an ordinary TypeScript module the page owns, and
the Nish module imports them the way any TypeScript module would:

```ts
// web/host.ts: the page's file, compiled by tsc and bundled by Vite
import type { f64, i32, u32 } from "nish";
export type GpuBuffer = HostHandle<"gpu_buffer">;

export function hostLog(level: u32, code: i32): void { console.warn(level, code); }
export function nowMs(): f64 { return performance.now(); }
export function gpuWrite(b: GpuBuffer, offset: u32, data: Float32Array, at: u32, n: u32): void {
  device.queue.writeBuffer(buffers[b], offset, data, at, n);
}
```

```ts
// client.ts: the Nish module
import { GpuBuffer, gpuWrite, hostLog, nowMs } from "../web/host.ts";
```

```llvm
declare void @hostLog(i32, i32) #2
declare double @nowMs() #3
attributes #2 = { "wasm-import-module"="host" "wasm-import-name"="hostLog" }
attributes #3 = { "wasm-import-module"="host" "wasm-import-name"="nowMs" }
```

- **A host module is named, not guessed.** `"nish": { "host": ["web/host.ts"] }`
  in the root `package.json`, or `--host web/host.ts` on the command line, makes
  that file a host module. An import from any other file is an ordinary Nish
  import, as today. The compiler reads only a host module's exported
  signatures: each `export function`'s parameter and result types, and each
  exported `type` alias of a `HostHandle`. It skips each function body
  unparsed, as a balanced run of tokens, so the body may use the DOM, closures,
  promises and anything else TypeScript has. If the lexer cannot read a token
  in a body, such as a regex literal, it refuses the file with a message to
  move that code into a module the host file imports. Stage 2 checks the lexer
  against the Vite templates' TypeScript before relying on it.
- **The signature is the one source.** `tsc` checks the page's
  implementation, and Nish checks every call against the same text, so
  nothing is generated or kept in step by hand. Nish's own names (`u32`,
  `i32`, `f32`, `f64`) are type aliases of `number`, declared in
  `runtime/nish.d.ts`. The npm package exports the same declarations as
  `import type { ... } from "nish"`, so the page's `tsc` reads them
  unchanged. A bare
  `number` means the program's number mode. In a host signature,
  `Float32Array` is `f32[]`, as everywhere in Nish. `Uint8Array`,
  `Uint16Array` and `Uint32Array`, which are not Nish spellings, are read as
  `u8[]`, `u16[]` and `u32[]` there and only there.
- **In the wasm reading** each imported function is a wasm import from module
  `host` under its own name (IR above). Checked by hand on this container's
  toolchain: wasm-ld turns such a declaration into an import,
  `{"module":"host","name":"drawCount","kind":"function"}`, with no
  `--allow-undefined` (an 88-byte module). The generated loader takes the host
  module itself, `import * as host from "./host.ts"`, and passes each function
  straight through when every parameter and the result are `i32`, `f32` or
  `f64`, so the import costs a plain wasm-to-JS call. An import that needs
  adapting (an unsigned or `boolean` result, a buffer, a string) gets one
  closure, built once at `load`. Calling it allocates nothing, except a
  `string`'s decode (§7). With the Vite plugin (§8) the page never passes
  `host` itself.
- **In the TypeScript reading the import is already TypeScript.** `--emit-ts`
  keeps the `import` line as written, where it refused a foreign declaration
  before (NL4010), so the TS reading calls the very function the wasm import
  table names.
- **`declare function` stays C's.** In a wasm build it is refused, with a
  message that names the host-module form. A function the page supplies has
  one spelling, and a C definition can no longer silently replace an import:
  wasm-ld lets a C definition win over a declared import, which was checked.
  "The freestanding `--profile wasm` link resolves the declaration against the
  C the link is given" (LANGUAGE.md, untested per wp53) is withdrawn. A C
  library on wasm stays a `--profile wasi` program. A host module imported in a
  native build is refused too, because there is no page there. The simulation
  that both builds compile imports no host module.
- **What crosses, and what is refused.** The rule is that a crossing is
  implicit where it is free and refused where it would copy or allocate in
  secret. Each refusal names the explicit form:

  | In a host signature | Crosses as |
  | --- | --- |
  | `i32`, `u8`, `u16`, `u32`, `f32`, `f64`, `boolean`, a ranged integer, an enum, a `HostHandle` (§4) | itself, in both directions |
  | `i64`, `u64` | a `bigint`, in both directions. V8 allocates one per call, so `--emit-dts` marks the function "allocates per call" |
  | a typed array followed by `at` and `n` (§5.3) | a window into module memory: the view, an element index and a count |
  | `string`, as a parameter | its UTF-8 bytes, decoded once by the loader (§7) |
  | `string` as a result | refused: `return the text by writing it into a module-storage u8[] the module names, and return its length` |
  | an object, a class, an array of objects, a function, a `Promise`, `unknown` or `any` | refused: `write it into module storage and pass its index`, or for a promise, `await it in the page and call an export with the result` |
- **`--emit-dts` types what the page owes.** The `.d.ts` gains
  `Imports = { host: typeof import("./host.ts") }`. A host module that loses
  an export the Nish module calls fails `tsc`, not the first frame.
- **Capability: `ffi`** (Q2, accepted). A call to a host import is a call to
  code the program cannot see, which is exactly what `ffi` already means:
  `--deny ffi` refuses it, `--emit-capabilities` names the import, and a
  program that calls one is not `deterministic`.
- **Attributes.** None on the declaration, and its callers lose `readnone` and
  `willreturn` exactly as for C (LANGUAGE.md "The declaration carries no LLVM
  attributes").
- **Cost to a program that does not use it: zero.** A program with no host
  module emits no import and no attribute. Native IR and every golden are
  unchanged.

## 4. W4. Host handles: `HostHandle<"kind">`

**Proposal.** A host object (a GPU buffer, a pipeline, a datagram writer) is an
`i32` index into a table the page keeps, and Nish gives each kind its own
nominal type:

```ts
// web/host.ts
export type GpuBuffer = HostHandle<"gpu_buffer">;
export type GpuTexture = HostHandle<"gpu_texture">;

const buffers = new HostTable<GPUBuffer>(); // nish/page, the page-side helper (§11)
export function gpuCreateBuffer(bytes: u32, usage: u32): GpuBuffer {
  return buffers.add(device.createBuffer({ size: bytes, usage }));
}
export function gpuDestroyBuffer(b: GpuBuffer): void { buffers.take(b).destroy(); }
export function gpuBindTexture(slot: u32, t: GpuTexture): void { ... }
```

- **The type.** `HostHandle<K>` takes a string-literal type argument, and
  `HostHandle<"a">` and `HostHandle<"b">` are different types. Passing a
  `GpuTexture` where a `GpuBuffer` is wanted is a type error in Nish and also
  under `tsc`. `runtime/nish.d.ts` declares
  `type HostHandle<K extends string> = number & { readonly [hostKind]: K }`
  with a `unique symbol`, so both checkers refuse the same call.
- **What it supports.**
  - `===` and `!==` against the same kind and against `0`. `0` is "none",
    and the page never hands it out.
  - Storage anywhere a scalar goes, module storage (§5) included.
  - Nothing else: no arithmetic, no conversion to or from a number. A
    handle is made only by an import that returns one.
- **Why not WP53's handle class.** A handle class owns a `CPtr`, lives only
  in a `using`, and is closed at the end of its block. A GPU buffer lives as
  long as the module, in module storage, which a handle class can never be
  in. It is also not memory, so the module holding a stale index endangers
  nothing in the module's own memory. The page's table answers for it. So a
  host handle is a value, and destroying the object is an ordinary import
  call. Making a handle class over a `HostHandle` field, for a resource
  scoped to a block, is Q6. It is not proposed now.
- **Why not `externref`.** It would be no cheaper. A JavaScript array lookup
  by an `i32` index costs about what `table.get` does. It would also be
  worse: an `externref` cannot be stored in linear memory, so it could not
  live in a record, an array or module storage. LLVM 18 spells it only as an
  `addrspace(10)` value that no Nish type maps to.
- **Its TypeScript reading** is the same branded `number`, so the TS reading
  needs no change beyond the type alias.
- **Cost: zero.** It is a new type, lowered to `i32`.

## 5. W2. One memory, no copies

### 5.1 Module storage: fixed arrays at the top level

The module needs long-lived arrays that both sides read and write: the world,
the instance list, an input ring, an outbound datagram ring. The language has
no place to put one (§1). **Proposal:** a top-level `const` whose initialiser
is `new Array<T>(N)` (or a typed-array `new` of a constant length) is **module
storage**: zero-filled memory reserved at link time, with no initialiser that
runs.

```ts
interface Instance { x: f32; y: f32; z: f32; yaw: f32; tint: u32; kind: u32 }

export const MAX_INSTANCES: i32 = 4096;
export const instances: Instance[] = new Array<Instance>(MAX_INSTANCES);
export const input: u32[] = new Array<u32>(256);
export const sim: SimState[] = new Array<SimState>(1);
```

```llvm
@nish_storage_0_instances.data = global [4096 x %struct.Instance] zeroinitializer, align 16
@nish_storage_0_instances = global %struct.nish_array { i64 4096, i64 4096, i8* bitcast ([4096 x %struct.Instance]* @nish_storage_0_instances.data to i8*) }, align 8
```

- **Fixed length.** `push`, `pop`, an assignment to `length`, and anything
  else that can change the length or move the data is refused on module
  storage (a new code). Because of that rule a view the page makes stays valid
  for the module's whole life (§5.2). This is the typed-array names' "no
  `push` or `pop`" rule (LANGUAGE.md), applied to a binding instead of a
  spelling.
- **Pointer-free elements only.** The element type is a scalar, an enum or a
  ranged integer whose zero is a member, a `HostHandle`, or an `interface`
  that no class implements whose fields are all of those. A field may not be
  another record: in the native layout a record field is a pointer to its
  record, so a nested record would put a pointer in storage. Stage 3 refuses
  it with its own message and asks for the inner fields spelled on the outer
  record (an earlier draft said "recursively"; an inline value-record layout
  is future work). A string, an array, a class, `T | null` and a `Map` are
  refused, each with its own message. This one rule carries the whole of §6's memory proof: module
  storage can never point into the arena.
- **Zero is the initial state.** There is no initialiser expression, so there
  is still no initialisation order, which is the property the "Module
  constants" rule protects. An `init()` export sets real values. The zero fill
  of an interface element is new: today `new Array<T>(n)` takes only scalars.
  It is allowed only here, where every field's zero is a valid value.
- **No top-level `let`.** A scalar the module keeps (a tick counter, an RNG
  state) is a field of a length-one record, `sim[0].tick`. Q3 asks whether
  that is acceptable or whether scalar `let`s are worth a rule of their own.
- **Element access.** An element of a module-storage record array is read
  and written as `instances[i].x`, read whole into a local (a copy), and
  assigned whole (a copy). Binding the element itself, as in
  `const p = instances[i]` (an interior pointer), or passing it as an
  argument is refused (a new code). That is what makes the TypeScript reading
  below possible, and Q4 asks for it.
- **Native builds get the same thing.** On x86-64 and aarch64 it is `.bss`,
  so the simulation's module storage compiles natively for the server and for
  §9's bit-identity check.
- **Fixpoint facts.** A function that reads or writes module storage reads or
  writes memory older than any call. To the attribute fixpoint it is an array
  parameter nobody passed: the function loses `readnone`, and a write loses
  `readonly`. It is never a `parallel` capture.
- **Cost: zero.** It is a new construct, and IR that has no module storage
  has no new global.

### 5.2 The layout has one source: `--emit-dts`

`--emit-dts` exports what the page needs to build its views. The parts known
at compile time go in the `.d.ts`. The address is read from the instance once,
at `load`:

```ts
export interface Layout {
  instances: { at: number; length: 4096; stride: 24; fields: { x: 0; y: 4; z: 8; yaw: 12; tint: 16; kind: 20 } };
  input: { at: number; length: 256; stride: 4 };
}
export interface Module { memory: WebAssembly.Memory; layout: Layout; /* exports */ }
```

The `.d.ts` spells `length`, `stride` and each field offset as literal types,
so a page that hard-codes `24` where the stride became `28` fails `tsc` once
the declarations are regenerated. `at` is the byte address of the data. Under
`--profile wasm-host` the link exports each module-storage symbol
(`--export=nish_storage_0_instances.data`; the symbol is
`nish_storage_<module>_<name>`, unique across modules), and wasm-ld exports a data symbol as a global
holding its address. The loader reads it into `layout.instances.at`.

**Memory sized at instantiation, never grown.**
`build.sh --profile wasm-host --memory <MiB>` links with
`--initial-memory = --max-memory = <MiB>` and a fixed `-z stack-size`. Checked
by hand: a module linked with both at 16 MiB gives 256 pages, and
`memory.grow(1)` throws `RangeError`. The arena's `memory.grow` returns `-1` in
that mode, and the arena panics with "out of memory" through §6's panic path,
never silently. The pools are sized from caps, as wp34 N9 asks: module storage
is the caps times the record size. The arena is the rest, less the stack. In
this mode `memory.buffer` is one `ArrayBuffer` for the module's whole life, so
a view made once is never detached.

**Where memory may grow** (the default `--profile wasm`, or `wasm-host`
without `--memory`), the page compares `memory.buffer` with the buffer it
built its views over. A grow replaces that object, so identity is the
generation counter. Reading it calls nothing in the module and allocates
nothing. The loader exports `views()` to rebuild them when it changes.
Q5 records the alternative, a counter word in memory.

### 5.3 A buffer argument to an import: a window `(view, at, n)`

LANGUAGE.md already says that "a window into a buffer is `(buf, offset, length)`
by convention", and that convention is the host signature:

```ts
// web/host.ts
export function sendDatagram(w: DatagramWriter, bytes: Uint8Array, at: u32, n: u32): void { ... }
export function gpuWrite(b: GpuBuffer, offset: u32, data: Float32Array, at: u32, n: u32): void { ... }
```

```ts
// client.ts: the same three arguments, in both readings
gpuWrite(instanceBuffer, 0, instanceFloats, 0, count * 6);
```

```llvm
declare void @gpuWrite(i32, i32, i8*, i32, i32) #4
```

- **The element types.** A host import takes `u8[]`, `u16[]`, `u32[]`,
  `i32[]`, `f32[]` and `f64[]` (and the `readonly` form of each), each
  followed by an element index `at` and an element count `n`, both `u32`.
  WP53's C rule takes only `u8[]` with one `u64` byte count, because C would
  need an element size the declaration does not carry. The page does not: its
  typed array carries one. A `u64` index or count would cross as a `bigint`,
  an allocation per call, so it is refused with a message that names `u32`.
- **The check.** `at + n <= data.length` is checked before the call (the
  `ffi-length` panic site). `0, toU32(data.length)` of the buffer itself is
  proved, as `toU64(b.length)` is for C.
- **What the page receives** is the same three arguments in both readings,
  so the page's function has one signature. In the wasm reading the view is
  the `Float32Array` over the whole memory that the loader made once. Its
  index is the data pointer divided by four, plus `at`. The adapter is one
  shift, one add and one call:
  `(b, o, p, at, n) => host.gpuWrite(b, o, F32, (p >>> 2) + at, n)`. It needs
  no `subarray` and no copy, and the call allocates nothing. In the TS reading
  the view is the array's own typed array and the index is `at` itself. Either
  way the page hands it straight to `queue.writeBuffer(gpuBuf, o, data, at, n)`,
  whose `dataOffset` and `size` are element counts for a typed array. Module
  storage is a typed-array view in the TS reading (§5.4). Stage 3 checked
  whether a local `f32[]` is a `Float32Array` there: it is not. A local
  `new Float32Array(n)` is a plain zero-filled `Array` in the TS reading, and
  it crosses as that array, unconverted, so a page that needs a real typed
  array in both readings lends module storage.
- **Write-through: WP53's rule unchanged.** A `u8[]` argument may be written
  by the host during the call, and the compiler records the call as a store.
  A `readonly` one may not. The rule is the declaration's word, as in C. The
  window is lent for the call: the page may not keep `(view, at)` and read it
  later, because the bytes may belong to an arena temporary the module
  releases after the call returns. Module storage is the exception the page
  can rely on. Its views are the page's own, made once from `layout`, and
  they are valid for the module's life.

**Which host APIs copy and which keep.** This is the rule the page follows, by
API. The "copies" column is what each specification says. Stage 6 checks in
the browser the ones W9 uses.

| Copies during the call: pass the window directly | Keeps a reference past the call: copy into a page-owned buffer first |
| --- | --- |
| WebGPU `queue.writeBuffer`, `queue.writeTexture` | a `WritableStream` with a page-written sink: the chunk is queued as it is |
| WebGL 2 `bufferSubData`, `bufferData`, `texSubImage2D` | `ReadableStreamBYOBReader.read(view)`: it transfers the buffer, and a `WebAssembly.Memory` buffer cannot be transferred (a `TypeError`). Read into a page buffer, then `.set` |
| `TextDecoder.decode` | `postMessage(view, [view.buffer])`: never transfer module memory |
| `AudioBuffer.copyToChannel`, `copyFromChannel` | an `AudioWorklet`'s `port.postMessage` of a view: it clones, which allocates, so do it once and not per frame |
| WebTransport `datagrams.writable` and send-stream `write`: the spec copies the bytes at write. Checked by stage 6 (`tests/interop/chrome-arena.py`, which fails the `arena` job otherwise): a 32-byte view written as a datagram and overwritten with `z` as soon as `write` returns, before its promise settles, comes back from the echo server as the 32 bytes written. In CI's pinned Chromium 141.0.7390.37 the echo was the bytes written on the first try; also seen locally in Chromium 153 | anything else not in the left column, until it is checked |
| `new Blob([view])`, a `fetch` body | |

"Copy into a page-owned buffer" means `pageBuf.set(view.subarray(at, at + n))`
into a buffer from a pool made once, never `.slice()`. The `subarray` itself
allocates a small view object, so the API on the right is not a per-frame path
unless the page keeps a view per slot.

### 5.4 The TypeScript reading of module storage

The page's code must be the same against either reading (wp33: a module's TS
reading must still run in a browser). So in the TS reading, module storage is
one `ArrayBuffer`, laid out exactly as §5.2 lays it out, and each binding is a
typed-array view of it:

```ts
const heap = new ArrayBuffer(LAYOUT_BYTES);
export const input = new Uint32Array(heap, INPUT_AT, 256);
// instances[i].yaw = a   →   F32[(INSTANCES_AT + i * 24 + 12) >> 2] = a
```

**As built (stage 3), a record storage is not index arithmetic.** Each element
is a plain object whose fields are accessors over the heap's views at
`(at + i * stride + offset) >> shift`, so `instances[i].yaw = a` stays as it
is written and runs a setter that writes the buffer, and a whole-element copy
is `Object.assign`, field by field as the native copy is
(`src/emit-ts-storage.ts`). The source needs no rewrite at each access, and
the page sees the same bytes either way. The offsets are the reading's own,
each storage on an 8-byte boundary from 0, so a page reads them from `layout`
and never spells one. A scalar storage is the typed-array view sketched above
(a `boolean` one is a byte view behind a proxy). The rule below still holds.
That is why §5.1 refuses an element reference: with no
interior pointer to represent, every access is `name[i].field`, and the
rewrite is local. `nish-storage.ts` also exports `views()`, `loadSync` and
`load`, as the wasm loader does. Its loaders take the module's exports (the
reading's instance) where the wasm loader takes its bytes, and answer
`{ ...exports, memory, layout, views }`. `views()` answers one object for
good, because `heap` never moves, and `memory.grow` throws a `RangeError`, as
a wasm build pinned with `--memory` refuses to grow. tests/run.js's
module-storage section runs the same `tests/module-storage/page.ts` against
both readings.
`--emit-ts` refuses module storage only where it would need an interior
pointer. That case is unreachable after §5.1's rule, and `emit-ts-known.txt`
says so if it ever is reached.

## 6. W5. A module the page drives for hours

**Shared state** is module storage (§5). Every export reads and writes the
same world, pools and instance list.

**Flat memory is proved by two rules, not hoped for.**

1. **Every export runs in an arena bracket.** The loader already wraps each
   call in `nish_arena_mark` / `nish_arena_release` (`scoped`, wp8), and keeps
   doing so. Everything the call allocates in the arena is released when it
   returns or traps.
2. **Nothing outside the call can reach the arena.** Module storage is
   pointer-free by §5.1's type rule, so no store can put an arena address into
   memory that outlives the call. An export's result is a scalar, a handle, or
   a string or array that the loader decodes or copies *inside* the bracket
   (§7). An import receives windows that are lent for the call only.

The rules keep the module's own stores from reaching the arena. The page still
can: it holds the one memory, arena included.
[WP59](wp59-wasm-arena-memory.md) proposes a second memory, not exported, for
the arena.

Together the two rules mean the arena's mark is the same at the end of every
call as at its start. That is a property of the types, not of the program's
care: no rewrite of the program can break it while it still compiles. In fixed
memory (§5.2) the remaining bound is the largest single call's temporaries. A
call that exceeds it panics with "out of memory", the same call every time for
the same input. The arena is runtime code with no emitted call to tag, so that
panic reports site `-1`: the page learns the call, not the line. `nish_arena_used` and the mark are exports
the page or a test can read after each call, and W9 asserts the mark is equal
after every frame for ten minutes.

Regions on wasm are not needed by this design. Making them link would mean a
page-free `malloc`. The arena bracket already gives per-call reclaim, and
module storage gives per-match state, reset by an export that zero-fills it.
WP46's region-per-match stays the native server's answer.

**Which programs get it.** Everything below from here to the end of this
section, the `nish.panic` import, the site table, the dead module, `NishPanic`,
`NishReentry`, and the `onPanic` and `sites` options of `load` and
`loadSync` (`loadSync` itself is in every loader), is for a program that
uses stage 2 or 3: one with module storage (§5) or a host module (§4)
(`Compilation.guardsPanics`). Any other program, `examples/add.ts` for one,
gets the loader, the `.d.ts` and the `.wasm` it got before stage 3, byte for
byte, under both profiles: a trap is a bare `RuntimeError`, the arena bracket
releases what the call allocated, and the next call works. The trigger is in
the program rather than a flag, so a page that adopts module storage or an
import gets the guard without asking, and one that adopts neither pays
nothing. The compiler marks such a program by ending its IR with a
`; nish.sites <count>` line; that line, not the profile alone, is what
`scripts/build.sh --profile wasm-host` reads to compile `runtime-wasm.c` with
`NISH_WASM_HOST` and rewrite the sites. `tests/runtime-budgets.js`'s
`WASM_PLAIN_DIGESTS` holds three examples to their earlier bytes:
`add.ts`, `arrays.ts` and `results.ts`, whose `Result` parameter pins the
plain `{ ok, value }` packing.

**A panic reaches the page.** In such a program under `--profile wasm-host`,
`runtime-wasm.c`'s panic entry points call one import before they trap:

```ts
// the loader's own import, not the program's
nish: { panic(kind: number, site: number, msg: number, len: number, a: number, b: number): void }
```

- **The operands `a` and `b` are `f64`**, not `bigint`: every entry point
  converts its index, length or bound to `double`, so the import has no `i64`
  parameter and a call allocates nothing. A `u64` operand past 2^53 is rounded
  in the message; the trap and the site are exact.
- **The loader formats the message**, so the runtime carries no formatting
  code: `index out of range: 7 >= 4` from the kind and the two operands, or the
  text of `panic(msg)` decoded from `(msg, len)`. It marks the instance dead
  and calls the page's `onPanic({ message, kind, site })`, then throws the
  `NishPanic` itself (`panicOf`), carrying the same fields; the exception
  unwinds the module and the export wrapper lets it through.
- **After a panic the module is dead.** Every wrapper throws `NishPanic` on
  entry from then on. The page re-instantiates; it never resumes. A JavaScript
  exception that escapes an import kills the module the same way: it unwinds
  through Nish frames that have no landing pads, so module storage may be half
  written.
- **The site.** In a wasm build the emitter tags each panic call with a site
  number (`!nish.site !{i32 N}`), numbered in the order it first writes each
  (kind, position), and `scripts/build.sh --profile wasm-host` rewrites the
  tagged call into the runtime's `_at` form that passes it
  (`docs/IR_COOKBOOK.md` → "Panic sites").
  The build also writes `x.sites.json`, mapping each number to
  `{ kind, at: "path:line:col" }`, which a development page loads. The module
  carries no file names (Q9). Native IR and native panics are unchanged, so no
  native golden moves.
- **Cost:** none to a program without module storage or a host module. To
  one with them, an `i32` argument per panic call, in wasm builds only. The
  import exists only under `--profile wasm-host`. A module built with
  `--profile wasm` imports nothing, as hand-written hosts that pass `{}`
  expect: each panic is a bare trap with no message or site. For a program
  with module storage or a host module the generated loader still marks the
  module dead on that trap; any other program's loader is unchanged.

**No re-entry.** An import may not call back into the module. The proof that
re-entry would be safe does not exist: the attribute fixpoint treats a foreign
call as a hole that writes only its buffers, so an import that ran an export
could change module storage under a function that the fixpoint said held it
still. The loader keeps one flag. An export entered while another is on the
stack throws `NishReentry` before it touches the module. The flag costs one
load, one store and one compare per export call.

**`async` stays refused** on wasm (NL2652, unchanged). The page awaits its
promises (a `fetch`, a datagram read, `requestAdapter`) and calls an export
with the result: `onSnapshot(n)` after writing the bytes into the inbound ring.

## 7. W3. Strings out and in

- **Out, to an import.** A `string` parameter of a host import crosses as the
  pointer to its bytes and its length, `(i32, i32)`. The adapter decodes them
  with a `TextDecoder` the loader made at `load`,
  `utf8.decode(U8.subarray(p, p + n))`, and the page's function receives a
  JavaScript `string`. The TS reading passes the string itself, so the page
  sees one signature in both readings. The decode allocates the string, which
  is inherent in giving JavaScript a string, and one `subarray`. A per-frame
  text path uses a `readonly u8[]` buffer instead and decodes where it chooses.
- **Out, as an export's result.** The loader decodes the string inside the
  export's arena bracket, before `release`.
- **What keeps the bytes alive until the page has read them:**
  - **To an import:** WP27's borrow. The escape analysis treats a string
    argument as a read, so the scope that holds it is released only after the
    call returns, and the adapter decodes during the call.
  - **Out of an export:** the loader's bracket, which releases only after the
    decode.
  - **A literal:** constant data, alive for the module's life.
  - The page may never keep `(p, n)` past the call. The loader does not
    expose them.
- **In.** The page writes UTF-8 into a module-storage `u8[]` with
  `encoder.encodeInto(text, inboxView)`. `inboxView` is a view made once over
  `layout.textIn`. The page then calls an export with the byte count, and the
  module makes the string with `String.fromBytes(textIn, 0, n)`, which exists
  today.
- **The runtime.** The shader text is built with templates, concatenation and
  number formatting, and that code lives in `runtime.c` (`nish_str_concat`,
  the shortest-digits formatter) beside code that needs libc (`malloc` at
  `runtime.c:206`, `strtod` at `:1456`). Stage 4 splits the string and
  formatting half into a unit that compiles freestanding. Its only
  dependencies are `memcpy` and `memcmp` (bulk memory) and the arena. The
  split is paired as wp46 §7 pairs a unit in `build.sh`'s `halves` and in
  `runtime-budgets.js`. `build.sh` adds the unit to a wasm link only when the
  IR names one of its symbols, as it does for `runtime-bytes.c`, and
  `--gc-sections` drops what is not called. A module with no string operation
  links byte-identical.
- **Cost:** zero to a program with no strings: the `wasm-size` check holds
  `add.ts`, `arrays.ts` and `results.ts` to the digests they had before
  stage 4. Measured when stage 4 landed (clang 18, no wasm-opt):
  `examples/label.ts`, a template with an `i32` and an `f64`, links to 13,046
  bytes (gzip 11,786). 10,296 of them are the shortest-digits printer's
  power-of-ten table, and the code is 2,502. The same template with only the
  `i32` links to 1,111, because `--gc-sections` drops the printer. The
  `wasm-size` check holds `label.ts` to those bytes
  (`WASM_HOST_SIZE_BUDGETS`).
  Those figures are `--profile wasm-host`'s. `--profile wasm` links with
  `--export-all` (`scripts/build.sh`), which exports, and so keeps, every
  `runtime-text.c` function the link pulls in: there a string program keeps
  `nish_f64_format` and its table though it formats no `f64`. The `i32`-only
  template measured 14,514 bytes under `--profile wasm` against 1,111 under
  `wasm-host` (the full `label.ts`: 14,590 against 13,046). A page that cares
  about size builds with `wasm-host`; `wasm` is the profile that answers every
  symbol for a hand-written loader.
- **Built (stage 4).** The adapter is `text(p, n)`, a `new Uint8Array` over the
  memory decoded by a `TextDecoder` made once per load (the export guard and
  the import adapters each make one), and an export's result is
  `stringOut`, read inside `guarded` or `scoped`. An export that takes a
  `string` is left out of the bridge, and its `.d.ts` line tells the page to
  write module storage instead. `nish/host/text` is the module's half: `textRead`
  is `String.fromBytes` behind a count check, and `textWrite`,
  `textWriteInt` and `textWriteF64` chain into a storage `u8[]` and answer -1
  when the text does not fit. A storage `u8[]` may be passed to a `u8[]`
  parameter that only indexes it, so these take the storage itself. The
  security record is `docs/security/wasm-host.md` ("A string crosses as bytes
  inside memory") and `docs/security/runtime.md` (`runtime-text.c`).

## 8. W6. Loading with no fetch

- **The loader is an ES module with no Node imports** already
  (`generateWasmLoader` writes no `import`). It also uses no `import.meta.url`,
  no `new URL(..., import.meta.url)` and no top-level `await`, so Vite bundles
  it as it stands. A test reads the generated text and fails on any of those
  four.
- **The page imports the module as TypeScript.** `nish/vite`, a Vite plugin
  in the npm package, takes the root `package.json`'s Nish entries (or
  `nish({ entries: ["src/client.ts"] })`). The page writes:

  ```ts
  import { init, frame } from "./client.ts";      // the module's exports, typed from its source
  import { memory, layout } from "./client.nish"; // its memory and layout (§5.2), from the .d.ts
  ```

  In a build the plugin compiles the entry with `--emit-dts`, links it under
  `--profile wasm-host`, inlines the bytes, and resolves both specifiers to
  one generated module. That module instantiates with `loadSync` and the host
  modules the entry imports, so the page needs no `await`, no `load` call and
  no import object. Under `vite dev` the plugin can serve the TS reading
  instead, from `--emit-ts`, for fast reloads. It resolves `./client.nish` to
  that reading's heap and the same layout, so the page's code is the same.
  `tsc` checks the page's calls against the Nish source itself, because the
  source is TypeScript. A build needs the compiler and LLVM where Vite runs,
  as any `--profile wasm` build does. `vite dev` with the TS reading needs only
  the compiler.
- **`load(source, imports)`** takes a `BufferSource` or a compiled
  `WebAssembly.Module`. **`loadSync(source, imports)`** uses
  `new WebAssembly.Module` and `new WebAssembly.Instance`, so a page can
  instantiate inside its start-up function before the first
  `requestAnimationFrame`. That works without `await`, but it is not required:
  an `async` start that awaits `load` before the first frame meets the same
  requirement, and has no size limit.
- **The browsers' limit on synchronous compilation.** Chromium refused
  `new WebAssembly.Module` on the main thread above 4 KB. In 2023 it raised
  that to 8 MB, measured as an 8 MB module compiling in under 200 ms on a
  Pixel 1 with Liftoff and lazy compilation
  ([the Chromium change](https://chromium.googlesource.com/chromium/src/+/d1a1a8fdd9b28feaf5d3accc0578092444a1083e);
  [the intent to deprecate the limit](https://groups.google.com/a/chromium.org/g/blink-dev/c/nJw2zwaiJ2s)).
  Firefox and Safari have no such limit. For size, this means `loadSync` is
  safe for any module cs will ship: §10's example is kilobytes, and cs's
  whole client would have to grow by three orders of magnitude to reach the
  limit. The loader's documentation states the 8 MB figure, and stage 6 runs
  `loadSync` in Chromium to confirm the limit has not come back. In CI's
  pinned Chromium 141.0.7390.37, the arena's module padded to 8,384,512 bytes
  (8 MiB − 4 KiB) loads in 5.4 ms; padded to 8,392,704 (8 MiB + 4 KiB) it is
  refused at once (0 ms) with `RangeError:
  WebAssembly.Compile is disallowed on the main thread, if the buffer size is
  larger than 8MB. Use WebAssembly.compile, compile on a worker thread, or use
  the flag --enable-features=WebAssemblyUnlimitedSyncCompilation`. Locally,
  Chromium 153 gave the same two results (5 ms, and the same `RangeError`).
  The soak asserts both sides on every run: the load
  under 8 MiB must succeed at the size asked, and the one over must be
  refused with a `RangeError`. The job's summary prints both results.
- **The bytes inside the bundle.** `build.sh --inline <file.mjs>` writes the
  module's bytes as an ES module, `export const bytes = new Uint8Array([...])`.
  The page passes `load(bytes, imports)`. Measured on this container (raw /
  gzip -9 / brotli q11, bytes), against the `.wasm` served on its own:

  | Form | `add.wasm` (316 B) | `arrays.wasm` (2,827 B) |
  | --- | --- | --- |
  | the `.wasm` file itself | 316 / 233 / 211 | 2,827 / 1,479 / 1,302 |
  | `new Uint8Array([0,97,115,...])` | 1,001 / 345 / 327 | 8,425 / 1,831 / **1,630** |
  | a Latin-1 string and `charCodeAt` | 935 / 351 / 338 | 8,822 / 1,901 / 1,686 |
  | base64 and `atob` | 488 / 374 / 368 | 3,836 / 2,033 / 1,942 |

  The decimal array literal is the smallest inline form after either
  compressor, at about 25% over the separate file under brotli, and it is the
  one with no decode step. Base64 is the largest after compression, so it is
  not the default (Q10).

## 9. W7. The same bits on every target

**The claim.** For a program built with `--deterministic`, the native
x86-64 and aarch64 builds, the `wasm32` build and the TypeScript reading under
Node give bit-identical `f64` and `f32` results for every arithmetic operation
and every `Math` builtin over a fixed corpus. An operation that cannot be made
to agree is refused under the flag.

What already agrees, and why:

- **`+ - * /` and `Math.sqrt` on `f64`** are IEEE-754 correctly rounded on
  every target. The emitter writes no `contract` or `fast` flag (`src/emit-ops.ts`).
  Nothing passes `-ffast-math` or `-march=native`, and since stage 5b every
  C unit and the program's IR are compiled with `-ffp-contract=off`
  (`scripts/build.sh`). So the IR's `fmul` and `fadd` are never fused into an
  FMA on aarch64.
- **`f32`.** Native builds use single-precision instructions. The TS reading
  writes `Math.fround(a op b)` (`src/emit-ts-numbers.ts:392`). Rounding to
  double and then to single gives the same answer as rounding once for
  `+ - * /` and `sqrt`, because 53 ≥ 2·24 + 2, so the two agree.
- **`floor`, `ceil`, `trunc`, `round`, `abs`, `sign`, `min` and `max`** are
  exact, and since N7 (#847) they agree on `-0` and NaN too.
- **`tan`, `atan2` and `hypot`** are Nish code (`std/math.ts`), the same on
  every native target and on wasm.

What does not agree today, and what the flag does about it:

| Source of disagreement | Under `--deterministic` |
| --- | --- |
| `sin`, `cos`, `exp`, `log` and `pow` are the platform's libm natively (glibc, Darwin), V8's fdlibm port under Node, and **nothing** on freestanding wasm (§1) | Each lowers to a Nish implementation in `std/math.ts`, fdlibm-derived as `tan` already is, on every target. The TS reading calls that same function, transpiled, instead of `Math.sin`. One algorithm in correctly rounded basic operations gives one answer everywhere |
| `tan`, `atan2` and `hypot` in the TS reading are `Math.tan` and friends (V8's) | the TS reading calls the `std/math.ts` function |
| `%` on `f64` is `frem`, which is a call to `fmod` on wasm32 (wasm has no `f64.rem`), and so fails to link there like `sin` (checked: a `frem double` compiled for `wasm32-unknown-unknown` leaves `U fmod`) | a `std/math.ts` `fmod`, exact by construction, on every target |
| NaN bit patterns. x86-64 makes the default NaN with the sign set, aarch64 without it, and wasm leaves the sign and payload of an arithmetic NaN nondeterministic. They differ only where a program reads a float's bits | `f64ToBits` and `f32ToBits` return the canonical quiet NaN (`0x7ff8000000000000`, `0x7fc00000`) for any NaN: one compare and one select. A snapshot codec that writes floats through them sends the same bytes from server and client |
| The runtime's C units are compiled with clang's default contraction, which may fuse inside C on aarch64 | every runtime unit is compiled with `-ffp-contract=off`. The float code in them today is exact or integer-only, so this is a guard, not a fix |
| `Math.random`, `Date.now` and every other capability outside the deterministic set | refused: the flag is also the capability policy that denies `clock`, `entropy`, `env`, `ffi`, `fs.*`, `net`, `process.spawn` and `tty`, so the simulation module cannot call a host import either |
| Parsing a float from text (`Number(s)`, `parseFloat`, `parseInt`). Stage 5b ran 94 strings (0.1, the `DBL_MIN` and `DBL_MAX` edges, 2^53 + 1 and + 3, exact halfway decimals, subnormals and their halfway points, 1e±400, whitespace, signs, `Infinity` spellings, `0b`/`0o`/`0x`) natively (glibc), on wasm32-wasi (musl) and under Node. Every decimal spelling and every `parseInt` agreed: the three libraries round correctly. Only hex differed: a hex float (`0x1p3`) is 8 through `strtod` and NaN (`Number`) or 1 (`parseFloat`) in the `--emit-ts` grammar, and musl's `strtod` misrounds a 57-bit hex integer (`0x1fffffffffffff1`: `0x4380000000000000` on wasm32, `0x437fffffffffffff` on glibc and Node) | under the flag a string `Number(s)` and `parseFloat(s)` call `std/math.ts`'s `numberExact` and `parseFloatExact`, which read the `--emit-ts` grammar (the hex integer, correctly rounded on any libc, and nothing after it) and hand every other spelling to the runtime; `parseInt` already agreed. The runtime is unchanged, so a build without the flag reads hex as before. The 94 strings are in the float corpus, and agree on all three targets. A refusal was the alternative; it would have refused `std/` modules that parse numbers (`std/json`) for a difference only hex floats show |

- **The corpus.** `tests/differential/corpus/float/float.ts` runs every operation
  and every `Math` builtin over a fixed set of operands: ±0, ±subnormals, the
  smallest and largest normals, ±Inf, NaN, integers around 2^53, multiples
  of π/4 near the argument-reduction boundaries, and arguments up to 1e300.
  It prints each result's bits in hex. `tests/run.js`'s `float-corpus`
  section holds each output byte for byte to one `expected.txt`: native
  x86-64 and native aarch64 (Q8, CI's `simd-arm64` job), wasm32-wasi under
  Node, and `--emit-ts` under Node. It is not a `main.ts`, so the
  differential runners, which build without the flag, pass it by. They are bits, not printed decimals, because
  printing can hide a last-bit difference.
- **The speed cost** falls only on programs that pass the flag, and it is
  not a cost: measured on x86-64 against glibc 2.39, 20M calls accumulated,
  medians of 11 interleaved rounds, `std/math.ts` `sin` takes 0.27× glibc's
  time over [0, 14620] (0.126 s against 0.472 s) and 0.70× over [0, 0.78)
  (0.097 s against 0.139 s). The noise band, glibc against a byte-identical
  copy of itself, is 1.005 and 1.007.
- **Without the flag, nothing changes.** One exception is Q7: making
  `std/math.ts` the lowering of the five functions on freestanding wasm
  regardless of the flag. That fixes today's link failure, and it costs
  nothing on any build that links today.

## 10. W8 and W9. Size, and the acceptance example

### Size

Measured on this container with the seed (0.34.1), `scripts/build.sh --profile
wasm` as it is, then the same IR linked with an explicit export list instead of
`--export-all` (raw / gzip -9 / brotli q11, bytes):

| | `--export-all` (today) | explicit exports |
| --- | --- | --- |
| `examples/add.ts` (one function, no runtime) | 316 / 233 / 211 | **102 / 111 / 87** |
| `examples/arrays.ts` with `runtime-wasm.c` | 2,827 / 1,479 / 1,302 | **2,091 / 1,092 / 970** |
| the generated loader, `add.mjs` | 691 / 399 / 322 | — |
| the generated loader, `arrays.mjs` | 3,623 / 1,278 / 1,114 | — |

So `--export-all` costs 68% of the hello world and 26% of a module with arrays.
`--profile wasm-host` exports the program's exported functions, its exported
module storage, and the runtime entry points the loader calls (the arena mark,
release and allocation), and nothing else. `--gc-sections` is already applied.
`build.sh` runs `wasm-opt -Oz --strip-target-features` when it is on `PATH` and
records in the build line whether it ran (binaryen 132: `add.wasm` 74 bytes,
`arrays.wasm` 1,713). clang 18 also runs a `wasm-opt` it finds itself after an
`-O` link, keeping the `target_features` section, which made `add.wasm` 150
bytes and broke the guard on a machine with binaryen (#1257).
`NISH_WASM_OPT=0` links with neither pass; the size test measures that build,
with a stub `wasm-opt` on `PATH` to prove neither runs.

**The guard.** A `wasm-size` block in `tests/run.js` builds the hello world and
the W9 example under `--profile wasm-host`. It writes the raw, gzip and brotli
size of the `.wasm`, the loader and the inlined module, and fails above a
ceiling per row, as `tests/runtime-budgets.js` does for native `.text`. A stage
that grows a figure raises its ceiling in the same commit and states the delta
in its `Measured:` trailer. Brotli comes from Node's `zlib`, because this
container has no `brotli` command.

### The acceptance example: `examples/wasm-arena/`

- `sim.ts`: a fixed-step simulation of a few hundred bodies, with
  module-storage pools sized from caps, compiled with `--deterministic`. It is
  the same file the native build compiles.
- `client.ts`: imports `sim.ts`. It reads the input ring once per tick, steps
  the fixed tick, and builds the instance list in module storage. At start-up
  it generates the WGSL text with templates and hands it to a
  `gpuCreateShader(src: string)` import.
- `page.ts` and `index.html`: listeners write input words into the ring
  through a view made once, and `requestAnimationFrame` calls `frame(dtMs)`.
  After each frame the page calls `queue.writeBuffer(instances, 0, F32, at, n)`
  over the views made at start-up, against memory sized by `--memory`.
- A Playwright driver in the `interop` workflow's Chromium job (Q8, Q11) runs
  ten minutes of frames with scripted input, and asserts three things:
  - **Linear memory is flat.** `memory.buffer.byteLength` is constant, and the
    arena mark read after every frame is equal throughout.
  - **No JavaScript allocation per frame.** It runs a sampling heap profile
    over the frame loop through the DevTools protocol (`HeapProfiler`), and the
    used heap after a forced GC at minute one and at minute ten are equal
    within a stated band.
  - **The state is bit-identical to native.** The page records the input
    words of each tick. At the end it reads a hash of the simulation's state
    (FNV over `f64ToBits` of every field). A native build of `sim.ts` replays
    the same input for the same number of ticks and prints its own hash, and
    the two must be equal.

**Built (stage 6).** The example is `sim.ts` (256 bodies, 64 shots and a ship
in module storage, stepped at 60 Hz), `client.ts` (the input ring, the
instance list, and the WGSL and GLSL generated with templates), `host.ts`,
`page.ts`, `index.html`, `replay.ts` (the native replay) and `build.mjs`, which
writes the page and the replay into one directory. `tests/run.js`'s
`wasm-arena` section runs the page under Node for 3,000 frames
(`node-run.mjs`) and holds its hash to the native replay's and to the replay's
`--emit-ts` reading. The `interop` workflow's `arena` job runs it in Chromium
for ten minutes against the band `tests/interop/chrome-arena.py` states (256
KiB of used heap after GC between minute one and minute ten, and 1 KiB
sampled per frame), and writes its figures to the job summary: the browser's
version and user agent, the renderer and adapter, the datagram and both
`loadSync` results.

Measured in CI's pinned Chromium 141.0.7390.37 (Playwright 1.56, headless,
WebGPU on the adapter `google / swiftshader`), over 600.0 s: 36,005 frames and
36,002 ticks, none stepped past the log's end; memory's `byteLength`
4,194,304 and the arena mark 89,616 on every frame; used heap after GC
1,217,728 bytes at minute one and 1,220,760 at minute ten (+3,032, inside the
±262,144 band); 224.6 bytes sampled per frame over 32,401 frames (band
1,024), most of it the command encoder and texture view each frame's draw
makes; and the hash `4432046c1f1caf92` on the page and from the native replay
of the recorded input. The datagram was copied on the first try, and
`loadSync` loaded 8,384,512 bytes in 5.4 ms and refused 8,392,704 in 0 ms.

**Why the page and native bits agree.** The native replay (`replay.ts`) is
built with `--deterministic`. The page module cannot be: the flag is also the
capability policy, and it refuses the host import `client.ts` makes (NL3054).
The same `sim.ts` is in both, and three things make its bits agree without
the flag. Stage 5a lowers `sin`, `cos`, `exp`, `log`, `pow` and the float `%`
on a page module to the same `std/math.ts` functions `--deterministic` uses;
`sim.ts` calls `sin`, `cos` and `%`, and its page IR calls `nish.sinF64`,
`nish.cosF64` and `nish.fmodF64`, never an intrinsic. `sqrt` is the one
intrinsic it calls, and IEEE 754 makes it exact on every target. The hash
quiets a NaN by hand before reading its bits, as `f64ToBits` does under the
flag. The capability policy is still enforced on `sim.ts`, by the native
deterministic build of the same file.

**WebGPU in headless Chromium.** `navigator.gpu` answers with
`--enable-unsafe-webgpu --enable-features=Vulkan
--use-webgpu-adapter=swiftshader` on a secure context: CI's pinned Chromium
141.0.7390.37 and, locally, Chromium 153 both gave the adapter
`google / swiftshader` on `http://127.0.0.1`. On a `data:` URL, not a
secure context, `navigator.gpu` is `undefined`, so the soak serves the page
from localhost. The page keeps the WebGL 2 `bufferSubData` path the owner
allowed (Q8) for a browser with no adapter. The soak fails when the page draws
with any renderer but the one its `--expect` names, which is `webgpu` in the
job, or on an adapter whose string lacks its `--adapter` substring,
`swiftshader` in the job, so a silent fall back to WebGL 2 or another adapter
turns the job red rather than soaking a path this section does not claim.
CI's ten-minute figures are under "Built (stage 6)" above. Measured locally
only, in Chromium 153, over 120 s on WebGPU: memory 4,194,304 bytes and the
arena mark 89,616 throughout, used heap +1,984 bytes between the two GCs,
about 250 bytes sampled per frame (the command encoder and texture view each
frame's draw makes), and the hash `4e0d41bf2e08771a` after 7,203 ticks on the
page and natively.

## 11. Not wasm-bindgen; what goes in `std`

**Why not use wasm-bindgen.** Rust's wasm-bindgen solves the same problem, and
this design takes its best idea, an import from the page's own JavaScript
module (`#[wasm_bindgen(module = "/host.js")] extern`), which §3 is. Using the
tool itself does not work for four reasons:

- **It reads Rust's descriptors, not types.** The bindgen command line
  rewrites a module from descriptors its Rust macro compiled in, and the
  command line and the crate must be the same version. Nish would have to emit
  an internal, unversioned format for a tool that does not promise it.
- **Its defaults copy and allocate.** Passing a string in calls the module's
  `__wbindgen_malloc` and `TextEncoder.encodeInto` on every call, and a `Vec`
  is copied in and out. That is convenient, and it is the per-frame
  allocation W2 exists to rule out.
- **It holds JavaScript objects in a heap table the module indexes.** That is
  §4's `HostHandle`, except that bindgen's handles are untyped at the boundary
  and Nish's are typed per kind.
- **The compiler already knows more than bindgen is told.** `--emit-dts` and
  its loader are generated from the checked program (wp8). They see every
  type, range and layout directly, and §3, §5 and §7 are additions to that
  generator, not a second one.

The WebAssembly Component Model (WIT, run in a browser through `jco`) was
weighed too. Its canonical ABI copies every string and list into and out of
the module by design, browsers do not run components without that
transpiling step, and it adds a second interface language beside TypeScript.

**What the standard library holds, and what it cannot.** The mechanism has to
be the compiler's: an import attribute, storage reserved at link time, a layout
in the `.d.ts`, and the generated loader are things no library can add. Every
helper above the mechanism is a library, in Nish or in the npm package's
JavaScript:

| Module | Side | What it is |
| --- | --- | --- |
| `nish/host/ring` | the module, in Nish | a single-producer ring over module storage, for the input ring and the outbound datagram ring: `push` from one side, `drain` once per tick on the other, with a head and a tail the page and the module each advance. There are no atomics, because one thread runs both sides. Its page half is below |
| `nish/host/text` | the module, in Nish | a UTF-8 writer into a module-storage `u8[]` (the shader text, a log line), and a reader of text the page encoded into an inbox, for §7's strings in without a string runtime |
| `nish/page` (JS) | the page | `HostTable<T>`, the typed handle table of §4 (`add`, `get`, `take`, with slot 0 never handed out); the ring's page half over a view made once; and `onPanic`'s default reporter |
| `nish/vite` (JS) | the build | §8's plugin |

These ship in stages 3 and 6 (§14), each with its own test like any `std/`
module, and `--gc-sections` drops whatever a program does not use.

## 12. The cost to a program that does not use it

| Piece | What a program without it sees |
| --- | --- |
| Imports (§3) | nothing: an import attribute is written only for a function imported from a host module |
| `std` helpers (§11) | nothing: a module a program does not import is not compiled |
| `HostHandle` (§4) | nothing: a new type |
| Module storage (§5) | nothing: a new construct, with no global unless one is declared |
| Panic sites (§6) | nothing natively. In a wasm build, one `i32` argument per panic call, and the `nish.panic` import only under `--profile wasm-host` |
| Strings (§7) | nothing: the unit is linked only when the IR names it |
| `--deterministic` (§9) | nothing without the flag, apart from Q7's fix of a link that fails today |
| `--profile wasm-host` (§2, §10) | nothing: `--profile wasm` is unchanged, byte for byte |

## 13. Questions for the owner, answered 2026-11-06

| | Question | Recommendation, accepted unless the row says otherwise |
| --- | --- | --- |
| **Q1** | How does a module name a function the page supplies? First asked as "is every `declare function` in a wasm build a host import?" | **Revised and accepted:** an `import` from a host module, the page's own TypeScript, named in `package.json` or by `--host` (§3). `declare function` stays C's and is refused in a wasm build, and the untested freestanding C route is withdrawn |
| **Q2** | The capability: `ffi`, or a new `host`? | **`ffi`.** Both are code the program cannot see, and both break `deterministic`. One label keeps every policy, lockfile and dependency grant as it is |
| **Q3** | Module storage as §5.1 has it: top-level fixed-length arrays of pointer-free elements, zero-filled, no initialiser, and no top-level `let`. Scalars live in a length-one record | **Yes.** A scalar `let` would add a second kind of global for a convenience the record already gives |
| **Q4** | Refuse binding or passing an element of a module-storage record array (`const p = instances[i]`), so that the TS reading can lay module storage out in one `ArrayBuffer` that the page views identically in both readings | **Yes.** The alternative is a page with two code paths, one per reading |
| **Q5** | A new `--profile wasm-host` (explicit exports, fixed memory, the panic import, `--inline`), or change `--profile wasm` in place. In place, explicit exports would shrink every module by 26–68%, but break hosts that call runtime exports by hand, as `web/bytes-worker.mjs` calls `nish_alloc_array`. Also: for growable memory, buffer identity as the generation counter, or a counter word in memory? | **A new profile, and buffer identity.** `--profile wasm` can adopt the export list later as its own change |
| **Q6** | Host handles as values only (§4), or also handle classes over a `HostHandle` field, for a resource scoped to a block? | **Values only now.** Add the class form when cs has a block-scoped host resource |
| **Q7** | `--deterministic` as §9 has it: the capability policy plus `std/math.ts` transcendentals on every target and canonical NaN bits. Separately, should `std/math.ts` be the lowering of `sin`, `cos`, `exp`, `log`, `pow` and `%` on freestanding wasm even without the flag? | **Yes to both.** The second fixes a link that fails today and costs nothing that works today |
| **Q8** | CI for the claims: an `ubuntu-24.04-arm` runner for the aarch64 column of the float corpus, and WebGPU in headless Chromium (`--enable-unsafe-webgpu` on SwiftShader). If WebGPU proves unavailable on the runner, may W9 fall back to WebGL 2 `bufferSubData`? | **The arm runner, yes.** WebGPU is required. If SwiftShader cannot provide it, stage 6 stops and asks rather than switching APIs. Revised at stage 6: the page falls back to WebGL 2 `bufferSubData` where no adapter answers. SwiftShader provides WebGPU on a localhost page (§10): CI's pinned Chromium 141.0.7390.37 drew the ten-minute soak with WebGPU on `google / swiftshader`, so the fallback is for browsers, and the soak asserts the renderer and adapter it ran |
| **Q9** | A panic's site: a number plus an `x.sites.json` sidecar, or `path:line:col` strings inside the module? | **The number.** File names cost bytes in every download and help only a developer, who has the sidecar |
| **Q10** | Inline bytes: the decimal array literal (smallest of the inline forms after compression, +25% over the separate file under brotli), opt-in through `--inline` | **Yes**, opt-in. cs decides per build whether a separate fetch is worth the bytes |
| **Q11** | The ten-minute soak runs in the `interop` workflow beside the QUIC and TLS jobs, not in `npm test` | **Yes.** It needs a browser and ten minutes, and `npm test`'s shards should not wait on either |

## 14. Stages

Each stage is one PR, built only once the questions it depends on are
answered. Stage 5 depends on nothing before it and can run beside stages 1–4.

| Stage | What | Depends on | Size effect |
| --- | --- | --- | --- |
| 1 | **Link and load (W6, W8).** `--profile wasm-host`: explicit exports, `--memory`, a fixed stack, `wasm-opt` when present, `--inline`. Loader `load(source, imports)` and `loadSync`. The `nish/vite` plugin for exports (the page imports the module as TypeScript). The Vite-readiness test of the loader's text. The `wasm-size` guard with today's figures | Q5, Q10 | shrinks: −214 B on the hello world, −736 B on `arrays.ts` (raw) |
| 2 | **Imports and handles (W1, W4).** Host modules (`--host`, `package.json`), reading their signatures and skipping bodies. Import attributes. `HostHandle<K>`. `Imports` in the `.d.ts`. The adapter closures. The TS reading keeps the `import`. The refusals: a `string` result, an object, a function, a `Promise`, `declare function` in a wasm build, a host module in a native build. The plugin gains host modules | Q1, Q2, Q6 | about 20 B per imported function; nothing without one |
| 3 | **Module storage and the driven module (W2, W5).** Module storage and its codes. `nish/host/ring` and the `nish/page` helpers (§11). `Layout` in the `.d.ts` and the views in the loader. Buffer windows for imports. Its TS reading. The re-entry flag. The `nish.panic` import and site numbers. Decoding results inside the bracket | Q3, Q4, Q9 | nothing to a program with no module storage and no host module: its loader, `.d.ts` and `.wasm` are the bytes it had before (`WASM_PLAIN_DIGESTS`, §6). One with either pays the `nish.panic` import and its site arguments. **Built**; record `docs/security/wasm-host.md` |
| 4 | **Strings (W3).** `nish/host/text`. The freestanding string and formatting unit. String parameters to imports, string results of exports | stage 3 | nothing to a program with no strings (`WASM_PLAIN_DIGESTS`); 1,111 B for an integer template, 13,046 B with an `f64` (10,296 B of it the printer's table). **Built** |
| 5 | **The same bits (W7).** `--deterministic`, the `std/math.ts` transcendentals and `fmod`, canonical NaN bits, `-ffp-contract=off` for runtime units, the float corpus across four targets | Q7, Q8 | `sin` and friends in each module that calls them, measured over an `x + 1.0` module, raw / gzip / brotli on `wasm-host` with no wasm-opt: `sin` 1,741 / 1,211 / 1,164 B, `cos` 1,755 / 1,219 / 1,176, `exp` 730 / 478 / 502, `log` 610 / 397 / 387, `pow` 2,250 / 1,292 / 1,243, `%` (`fmod`) 710 / 366 / 331, all six 6,250 / 3,490 / 3,352; `--profile wasm` adds the same raw bytes. Nothing to a module that calls none (`WASM_PLAIN_DIGESTS`). **Built** |
| 6 | **The acceptance example (W9).** `examples/wasm-arena/`, the Chromium job, the ten-minute soak, the size rows for the example, and the guide's browser section | stages 1–5, Q8, Q11 | the example's figures become the guard's `examples/wasm-arena/client.ts` row (`WASM_HOST_SIZE_BUDGETS`). **Built** |

Every stage carries its own definition of done from `CLAUDE.md`. That means a
golden `.ll` and the exact IR for each new construct, a native and a wasm round
trip, a negative test per refusal, the `docs/LANGUAGE.md` rule, the cookbook
entry, and the `docs/guide/using-nish/interop.md` browser section as the
surface grows. The `docs/security/` record comes with stage 3, because the
loader's import adapters and the `nish.panic` import are a builtin surface
that reads another process's input (the page's), and with stage 4 if it adds a
`runtime/*.c` unit. Goldens are regenerated, never edited. cs can use a stage
only once a release carries it, so a Release PR is worth cutting after stage 3
(the first stage cs can build a client against) and again after stage 6.

## Not in this work package

Each would be its own note, on its own measurement:

- **Generated DOM bindings.** The page keeps the DOM.
- **Threads** and `SharedArrayBuffer`. A single-threaded module and its page
  already share one memory.
- **JavaScript Promise Integration (JSPI).**
- **Closures**, and so callbacks from the page into anything but an export.
- **`async` on wasm.** NL2652 stays, and nothing here waits for it. Every
  promise cs has (a fetch, a datagram read, adapter set-up) is awaited by the
  page, which then calls an export with the result. Later, WP49's lowering of
  an `async` function to a fixed-size state machine could run on wasm with the
  page as its executor: it resolves the promise and calls a resume export.
  That would let module code write `await gpuReady()`. It is its own note.
- **Regions on freestanding wasm.** §6 shows the driven module does not need
  them.
