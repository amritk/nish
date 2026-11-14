# WP59: The wasm arena in a second, unexported memory

**Status: proposed, design only.** Nothing here is built. A `--profile
wasm-host` module still has one memory, exports it, and holds every pointer
and length its kept graph traces to the arena
([security record](security/wasm-host.md), WH-10). The stages are in §9 and
on [the roadmap page](roadmap/wp59-wasm-arena-memory.md). S3 waits on the
owner (§8). The plan that tracks the stages is
[`.claude/plans/wp59-wasm-arena-memory.plan.md`](../.claude/plans/wp59-wasm-arena-memory.plan.md).

Every claim about today's compiler is anchored at commit `d38a94b0`, on
`main`. Every toolchain claim was tried with the LLVM major that CI pins
(LLVM 18: `clang-18`, `lld-18` and `llvm-18` in `.github/workflows/ci.yml`),
here Ubuntu clang 18.1.3 with LLD 18.1.3. Read
[wp50-wasm-host.md](wp50-wasm-host.md) §5 and §6 first, then
[wp55-persistent-root.md](wp55-persistent-root.md) §4. WP50 explains why the
page shares the module's memory. WP55 explains why a graph now outlives a
call.

## 1. The problem

WH-10 made the root-storage trace distrust what it reads. Before the trace
reads a block, it checks that every pointer lies in the arena below `off`, or
in static data for a string. It also checks that every length fits. The
record then says what the fix leaves standing:

> What stays: a forged pointer *inside* the arena is still followed as its
> descriptor's type, so a page can scramble its own kept graph, but every
> read and write stays in the arena, the memory the page already holds.

It also proposes a structural fix:

> The structural fix is to keep the arena out of the page's reach, a second
> wasm memory the module does not export, which `views()` and the rings do
> not need.

Bounds cannot reach what stays. The page holds the same bytes the trace
reads, so any in-bounds value is one the page could have written. The only
fix is to make the arena unreachable from the page. This note asks whether
that can be done with the toolchain CI pins, what it costs, and what the
record's sentence leaves out.

The page is trusted (the record's threat model). So WH-10 is Low, and this
is defence in depth. Its value is that a bug in page code cannot become a
corrupted graph that the module then trusts.

## 2. What touches memory today

The record says `views()` and the rings do not need the arena. That holds
for the storage regions the page is meant to use. It is incomplete in two
ways:

- the loader and the host imports cross into the arena on every call that
  passes a string or an array;
- `views()` lends the page *all* of memory, not just storage.

Every reader of the module's memory from the JavaScript side, at `d38a94b0`:

| Who | Where | What it reads or writes | In the arena? |
| --- | --- | --- | --- |
| `views()` / `layout` | `src/interop-wasm.ts:1645` (`heapViews`), `:1659` (`heapViewsNew`), `:1725` (`layoutLoader`) | whole-memory typed arrays; the layout names each exported storage's `{ at, length }` | Storage is not. The views also cover the arena, the stack, static data and root tables. |
| a ring | `runtime/page.mjs:76` (`ringOver`), `:87` | `Int32Array(memory.buffer, at, length)` over a layout entry | no: module storage |
| an export's array argument | `src/interop-wasm.ts:1140` (`arrayIn`) | `raw.nish_alloc_array`, then `new Ctor(memory.buffer, data, n).set(value)` | **yes** |
| an export's array result | `:1168` (`arrayOut`), `:1184` (`copyBack`) | reads, or writes back, an arena array's elements | **yes** |
| an export's string result | `:1178` (`stringOut`) | a `{ i64 len, bytes }` header, read before the mark is released | **yes**, or static data |
| a host import's string argument | `:1388` (`text`); `src/emit-strings.ts:636`–`:643` (`emitHostString`) | `(p, n)` of any string the module holds | **yes** for a built string, static data for a literal |
| a host import's window | `:1363` (`win`); `src/emit-strings.ts:652`–`:682` (`emitHostWindow`) | a whole-memory view plus the data offset of *any* array | **yes** for a local array, no for storage |
| a panic's message | `:912` (`panicText`) | `Uint8Array(memory.buffer, msg, len)` | **yes** for a built `panic(msg)` string |
| the arena bracket | `:1011` | calls `nish_root_keep(mark)` or `nish_arena_release(mark)` | not read by JavaScript |

Most of what the page can write is not data it was meant to see:

- **runtime state** (`runtime/runtime-wasm.c`): the `nish_arena` struct
  (`:33`–`:34`, whose `off` the inlined allocator bumps); the root list
  `nish_roots` (`:225`); the scratch top (`:241`); the stack (64 KiB,
  `scripts/build.sh:1025`);
- **compiler output**: the root tables `@<sym>.root`; the root slots, the
  `internal` storage data that root storage keeps; and the trace descriptors
  `@nish.trace.N`, `internal constant`s that `src/emit-root.ts:227` writes.
  `constant` is a promise to LLVM, not to the engine: a wasm data segment is
  writable memory.

That last item is the open question in §10.1. WH-10 bounds pointers and
lengths. It does not bound a descriptor's `size`, `count`, `at` or `to`. A
forged descriptor has not been shown to reach outside the arena, and nobody
has checked that it cannot.

So a second memory removes more than the record names: the stack, the
runtime's state and the descriptors all leave the page's reach together.

## 3. The decision this note proposes

**Invert the memories.** Memory 0 stays the program's memory and stops being
exported. It holds:

- the arena;
- the stack;
- static data;
- module storage, root slots and root tables;
- trace descriptors;
- the runtime's state.

A new memory 1, which a step after `wasm-ld` adds, is exported under the name
`memory`. It holds only:

- a **mirror** of each exported module storage region, at the same offset it
  has in memory 0, so every `layout` entry, `views()` index and ring offset
  keeps its value;
- an **exchange area** above the highest mirror, where values cross for one
  call.

The module touches memory 1 with only four instructions: `memory.copy`,
`memory.fill`, `memory.size` and `memory.grow`. These are emitted from
`runtime/runtime-wasm.c` through inline assembly and intrinsics. Every load
and store that codegen writes stays exactly as it is today.

The rest of this section and §4 explain why the design goes this way round,
and why storage is mirrored, not moved.

### 3.1 Why codegen cannot pick a memory per pointer

The obvious design would have codegen give each load and store a memory
index: memory 0 for storage and memory 1 for the arena. LLVM 18 cannot do
that, and a wasm memory cannot be chosen per pointer at run time.

What I tried (`llc`, `clang` and `llvm-mc` 18.1.3). §12.1 gives each input,
command and its output, so the run can be repeated:

- `llc -march=wasm32 -mattr=help` lists `multimemory - Enable multiple
  memories.` The flag exists.
- `load i32, ptr addrspace(2) %p` with `-mattr=+multimemory` compiles to
  `i32.load 0`, a load from **memory 0**, with no warning. An address space
  does not select a memory. Codegen that relied on one would miscompile
  silently.
- `addrspace(1)` is LLVM's `wasm_var` space, used for wasm globals. A load
  from it stops `llc` with `LLVM ERROR: Encountered an unlowerable load from
  the wasm_var address space`. Spaces 10 and 20 are `externref` and
  `funcref`. None of these names a memory.
- clang's `__attribute__((address_space(2)))` with `-mmultimemory` also emits
  a plain `i32.load 0`.
- `llvm-mc` rejects a memory index on a load. It reads `i32.load 1, 0` as
  "invalid operand for instruction", and `i32.load 0 1` gives "Expected ,".
  Even hand-written assembly cannot reach memory 1 with a load or store.
- What does work is the bulk and size instructions:
  - `llvm-mc` assembles `memory.size 1` (`3f 01`) and `memory.copy 1, 0`
    (`fc 0a 01 00`);
  - clang's `__builtin_wasm_memory_size(1)` and
    `__builtin_wasm_memory_grow(1, n)` emit `memory.size 1` and
    `memory.grow 1`;
  - inline assembly in C works. This compiles with `--target=wasm32
    -mmultimemory -mbulk-memory -O2` to `memory.copy 1, 0`:

    ```c
    __asm__ volatile("local.get %0\n\tlocal.get %1\n\tlocal.get %2\n\t"
                     "memory.copy 1, 0" :: "r"(dst), "r"(src), "r"(n) : "memory");
    ```

So memory 0 is the only memory LLVM 18 loads from and stores to. Whatever
the module computes on must live there, and the arena is what it computes on
most. The memory that moves out is the one the page reads.

### 3.2 Why a step after the link

`wasm-ld` 18 declares exactly one memory. Its `--help` has
`--export-memory`, `--import-memory`, `--initial-memory`, `--max-memory`,
`--shared-memory` and `--stack-first`, and nothing that declares a second.
An object that uses `memory.copy 1, 0` links without complaint, but the
module it makes is invalid. Node refuses it: "Compiling function #0:"to_page"
failed: memory index 1 exceeds number of declared memories (1)".

A rewrite after the link fixes that in 37 lines of JavaScript (§12.2). It
walks the sections, appends a memory to the memory section (id 5), and points
the export named `memory` at index 1 in place of 0. The new memory's limits
are arguments: `{ flags 0x00, min }` grows, and `{ flags 0x01, min, max }`
with `min = max` is fixed (§4.2 says which a build gets). The test module has
four functions:

- `to_page`: `memory.copy 1, 0`;
- `ld1`: `memory.size 1`;
- `grow1`: `memory.grow 1`;
- `st0`: an `i32.store` to memory 0.

The module grew from 333 bytes to 335 (growable) or 336 (fixed). The
following held under Node v22.23.4 and headless Chromium 153.0.8010.12
(§12.3):

- the exports were `memory, to_page, ld1, grow1, st0`;
- `st0(1024, 42)` left byte 1024 of the exported memory at 0, so memory 0
  was out of the page's sight;
- `to_page(0, 1024, 4)` made bytes 0 to 3 of the exported memory
  `42, 0, 0, 0`;
- growable, `grow1(1)` answered the old size, 1, and detached the page's old
  `memory.buffer`;
- fixed at 2 pages, `grow1(1)` answered `-1`, `memory.grow(1)` from
  JavaScript threw `RangeError`, and the old buffer stayed attached.

The rewrite belongs in `scripts/build.sh`'s `wasm-host` link, after
`wasm-ld` and before any `wasm-opt`. Until the rewrite runs the module is
invalid, and `wasm-opt` validates its input. Today's default link cannot
make room for it. `NISH_WASM_OPT=1` compiles and links in one `clang` call
with an `-O` flag (`:1060`–`:1063`), and "clang 18 runs it itself after any
link with an -O flag, finding it on PATH" (`:1031`–`:1035`). On a machine
with binaryen installed, that inner `wasm-opt` would get the invalid module
before the rewrite has run, and since it validates its input, fail the
link. So the two-memory link takes
the shape `NISH_WASM_OPT=0` already has (`:1041`–`:1058`): each source is
compiled to an object with its `-O` flags, the objects are linked with no `-O`
flag, so clang starts no `wasm-opt`, and then the rewrite runs. Only after
that does the build run `wasm-opt` itself, as `:1066` does, with
`--enable-multimemory` beside `--enable-bulk-memory`. Binaryen supports
multi-memory (`features.json`, §6). §12 ran without binaryen installed, so it
never met the inner `wasm-opt`. S1's tests cover the build with it. The
script lives in `scripts/`. It uses no construct, so the rolling freeze (§7)
does not touch it.

## 4. What moves and what stays, with a reason each

| Region | Memory | Why |
| --- | --- | --- |
| the arena (every object a call or the kept graph allocates) | 0, unexported | The point of the work package: what WH-10 leaves standing lives here. LLVM 18 can only load and store memory 0 (§3.1). |
| root slots, root tables, trace descriptors | 0, unexported | The trace trusts them. Today a page can rewrite a descriptor (§2, §10.1). |
| the stack, static data, `nish_arena`, `nish_roots`, scratch | 0, unexported | Runtime state the page never had a reason to see. Static data includes every string literal and the panic texts. |
| exported module storage | 0, mirrored in 1 at the same offset | Codegen indexes storage like any array (`src/emit-arrays.ts:2085`–`:2102`: a `%struct.nish_array` header over a `.data` global), so storage flows wherever an array flows, and which memory a pointer names is not known statically. It stays in 0, where every access works, and the mirror is what the page sees (§4.1). |
| the rings | 1, as part of the mirror | A ring is a storage layout entry (`runtime/page.mjs:76`). Its offsets do not change. |
| module storage that is not exported | 0 only | The page has no layout entry for it, so no mirror is made. |
| strings and arrays crossing one call | the exchange area in 1 | §5. |
| panic text | copied into the exchange area, bounded | The message may be a built string in the arena (§5.4). |

### 4.1 Storage: a mirror synced at the edges of a call

The module reads storage in memory 0, and the page reads it in memory 1. They
agree whenever control crosses between them:

- **an export is entered**: each mirrored region is copied from memory 1 into
  memory 0, so the page's writes, such as a ring push, reach the module;
- **an export returns or traps**, before the bracket: memory 0 is copied out
  to memory 1;
- **a host import is called**: copied out before the call and in after it.
  The import's JavaScript may read `views()` or push to a ring.

Each sync is one `memory.copy` per region, covering bytes `[at, at + size)`.
The runtime keeps the region list as an `internal` table that the module
which owns storage writes beside its layout. Static memory holds no pointer
from the page's side, so copying never carries an address across.

This keeps WP50 §5's offsets, `views()` and rings. A view's lifetime is the
same as today in each build: whole-life under `--memory <MiB>`, and rebuilt
after a grow without it (§4.2). It gives up §5's title, "no copies", for
storage. The cost scales with the bytes of exported storage per crossing;
§5.7 estimates it, and S3 measures it (§9).

The two alternatives each keep "no copies" and each lose something else:

- **S-tag:** a bit in each array header says which memory the data lives in.
  Every element access then branches between a load from memory 0 and a
  helper that reads memory 1. That costs every array access in every
  program, not just a crossing, and the helper is a call where a load was.
- **S-type:** module storage gets a type of its own that cannot be converted
  to an ordinary array, so its memory is known statically. That is a
  language change, and it breaks every program that passes a storage array
  to a function taking an array: every function in `std/host/ring` takes
  the ring as an `Int32Array` (`std/host/ring.ts:44`).

S-copy changes neither the language nor any IR outside the crossings. It is
the proposal, unless S3's numbers say no (§8).

### 4.2 How memory 1 is sized, and what a grow does

WP50 §5 promises a view that is never detached only under
`--profile wasm-host --memory <MiB>`, which links memory 0 with
`--initial-memory = --max-memory` (`scripts/build.sh:1025`–`:1029`). Without
the flag, the page compares `memory.buffer` with the one it built its views
over and calls `views()` again when it changes (`docs/wp50-wasm-host.md`
§5.2). WP59 keeps both rules and applies them to memory 1.

**The rewrite sizes memory 1 from the layout.** The rewrite reads every
exported storage's `{ at, length × stride }` from the same `.data` exports the
loader's `layout` reads (`scripts/build.sh:1016`). Call the highest end of
those regions *mirror top*. Memory 1's minimum is

  ceil((mirror top + exchange size) / 64 KiB) pages.

A mirror keeps the offset it has in memory 0, wherever `wasm-ld` placed it,
past 64 KiB or not. The bytes of memory 1 below the lowest mirror are never
written. They are at most the size of memory 0's static data and stack.

**Under `--memory <MiB>`, memory 1 is fixed too.** The rewrite gives it
`{ flags 0x01, min, max }` with `min = max`, so `memory.buffer` is one
`ArrayBuffer` for the module's whole life and WP50's contract holds for every
view over memory 1 (§12.3: `memory.grow` from JavaScript throws `RangeError`,
and `memory.grow 1` answers `-1`). The exchange area then has a fixed size. A
crossing that does not fit panics with "exchange area full" through WP50 §6's
panic path, as the arena panics with "out of memory". It never grows or writes
short. Memory 0 keeps its `<MiB>`, so the module's footprint is `<MiB>` plus
memory 1's pages. The size of the exchange area, and whether `<MiB>` should
count both memories, are owner decisions (§8.3).

**Without `--memory`, memory 1 grows.** It has a minimum and no maximum. The
exchange area grows with `memory.grow 1`, which detaches the page's
`memory.buffer`, as an arena grow does today (§12.3). The page keeps WP50
§5.2's identity check and calls `views()` again. That happens less often than
today, because an arena grow is now in memory 0 and detaches nothing the page
holds. Only a crossing larger than any before it grows memory 1.

## 5. How values cross, and what each copy costs

Each crossing below already copies or decodes today. Under WP59, one
`memory.copy` between memory 0 and the exchange area goes in front of each,
and the loader then reads memory 1 as it reads memory 0 now.

### 5.1 An export's array argument

Today, the loader calls `nish_alloc_array(n, elem)` and writes the elements
into the arena block (`:1140`).

Under WP59:

1. The loader asks for an exchange block with `nish_exchange(bytes)`.
2. It writes the elements there.
3. It calls `nish_alloc_array_from(offset, n, elem)`. This allocates in the
   arena and copies memory 1 → 0.

The cost is one extra copy of the elements. The JavaScript `set` it follows
already costs the same order.

### 5.2 An export's array result, and copy-back

`nish_export_out(hdr)` copies the elements into the exchange area and
answers the offset. `arrayOut` (`:1168`) and `copyBack` (`:1184`) read the
elements from there. A copy-back writes the exchange block, and the module
copies it home with `nish_copy_back(hdr, offset)`. Each direction costs one
copy of the elements.

### 5.3 A string to the loader, or to a host import

The result header `stringOut` (`:1178`) reads, and the `(p, n)` that `text`
(`:1388`) decodes, are first copied into the exchange area. This includes a
literal, because static data is in memory 0 too. The cost is one copy of the
string's bytes. WH-9's bounds then apply to the exchange area, not to memory
0.

### 5.4 A panic's message

`panicText` (`:912`) reads a copy, bounded at 4 KiB and cut at a UTF-8
boundary. A trap inside the copy would hide the panic, so the copy is bounded
before it starts.

### 5.5 A window lent to a host import

`emitHostWindow` passes the data offset of any array. The runtime checks
whether that offset lies inside a mirrored region:

- **inside**: the offset is passed as it is. The import's pre-call sync has
  already brought the mirror up to date.
- **outside** (a local or kept array): the elements are copied into the
  exchange area, that offset is lent, and they are copied back after the
  import returns.

The cost is two copies of the window, and only for a non-storage window.

### 5.6 Exchange area lifetime

The exchange area is reset with the arena bracket. Without `--memory`, its
high-water mark is grown with `memory.grow 1` and never shrinks, just as the
arena's chunks never return. Under `--memory` it is fixed (§4.2).
`__builtin_wasm_memory_grow(1, n)` emits `memory.grow 1` (§12.1), and it
answers `-1` on a fixed memory (§12.3).

### 5.7 What the copies cost, estimated

Every copy is a `memory.copy` from memory 0 to memory 1 or back. §12.4
measured it against a copy inside memory 0, and against a JavaScript call to
an export that does one instruction. Both runs were on one 4-core 2.1 GHz Xeon
under Node v22.23.4, best of 5. These are hot-cache figures, the fast end of
the range. Cold data is slower.

| Bytes | memory 0 → 1 | memory 0 → 0 |
| --- | --- | --- |
| 64 | 4.1–4.2 ns | 4.1–4.4 ns |
| 1 KiB | 8.3–8.9 ns | 8.4–8.9 ns |
| 16 KiB | 79–83 ns | 79–82 ns |
| 64 KiB | 1.16–1.20 µs | 1.19 µs |
| 1 MiB | 15.7–19.6 µs | 15.7–19.4 µs |

A trivial export call costs 2.4–2.5 ns. Crossing memories costs what copying
within one does: the price is the bytes, not the second memory. The two runs
differ by up to 1.25× (at 1 MiB). Runs on a shared cloud machine move more
than that from one session to the next, so read every figure here as good to
within 2×.

Worked examples, at bytes per crossing × crossings per call:

| Case | Bytes copied per call | Estimate |
| --- | --- | --- |
| a 1 KiB string result (§5.3) | 1 KiB × 1 | 8–9 ns |
| a 4 KiB array argument, 1,024 `i32` (§5.1) | 4 KiB × 1 | between the 1 KiB and 16 KiB rows: 8–83 ns |
| a 16 KiB local array lent as a window (§5.5) | 16 KiB × 2 | 160–170 ns |
| an export over 64 KiB of exported storage (§4.1) | 64 KiB × 2 (in at entry, out at return) | 2.3–2.4 µs |
| the same export calling one host import | 64 KiB × 4 | 4.6–4.8 µs |
| the same export calling a host import 1,000 times | 64 KiB × 2,002 | 2.3–2.4 ms |

The copies of a value that crosses (the first three rows) cost the same order
as the JavaScript that reads or writes that value today. The storage sync
does not. An export over 64 KiB of storage pays about a thousand times a bare
call, every call, whether or not anything changed. An import called in a loop
multiplies that. So the storage sync is the one cost that can decide §8.1,
and §10.3 is how it would be cut. S3 replaces every figure here with a
measurement of real modules (§9).

## 6. Engines, and the fallback

Multi-memory is phase 5 (standardised, in Wasm 3.0). This table is the
`multiMemory` key of
[`features.json`](https://github.com/WebAssembly/website/blob/d9b8e4dc0bd46c316922048e5e9c7a2a6d649134/features.json)
in the WebAssembly/website repository at `d9b8e4dc`, cross-checked against
the web-features entry
[`features/wasm-multi-memory.yml`](https://github.com/web-platform-dx/web-features/blob/6248b5d7613eaba47649700083a04f1815104129/features/wasm-multi-memory.yml)
at `6248b5d7`:

| Engine | First version | Notes |
| --- | --- | --- |
| Chrome / Edge | 120 (2023-12-05) | Chromium 153 ran the two-memory test module (§3.2) |
| Firefox | 125 (2024-04-16) | |
| Safari, Safari iOS | **not supported in stable** | Safari Technology Preview 250 (WebKit blog, 2026-08-13): "Added support for multiple memories in a single WebAssembly module"; WebKit bug 277743 is fixed. web-features: "Baseline availability blocked since April 2024 by Safari". |
| Node.js | 22.0 | `package.json` requires `>=22.18.0`. CI pins 26.13.1. Node 22.23.4 ran the test module (§12.3). |
| Deno | 1.38 | |
| Wasmtime | 15 | |
| Wasmer | 7.3 | |
| Wasmi | 0.37 | |
| WasmEdge | 0.9.1 | |
| Binaryen (`wasm-opt`) | yes | needs `--enable-multimemory` |
| wazero | no | |

The `wasi` profile is not touched. It links `runtime.c` and wasi-libc, has no
loader and no arena handed back between calls, and exports only `memory` and
`_start`: its link (`scripts/build.sh:1124`–`:1127`) passes no `--export`, and
`:222`–`:223` say so. The plain `wasm` profile
(`--export-all`, `:916`) has no loader either and keeps one memory; see
§10.4.

**The fallback is today's module.** Until stable Safari ships multi-memory, a
page that must run there needs a single-memory build: today's layout, with
WH-10's bounds kept. WH-10's bounds stay in both builds anyway, as defence in
depth and because the trace's code is shared. How the page gets the right
build is the owner's call (§8).

## 7. The rolling freeze

WP59 adds no language construct and no builtin, so `src/` can ship it in the
release that builds it:

- the emitter and loader changes in `src/interop-wasm.ts` and
  `src/emit-strings.ts` are code the compiler *writes*, not code it is
  written in;
- the inline assembly lives in `runtime/runtime-wasm.c`, the runtime a
  `wasm-host` module links, not in the compiler's source;
- the rewrite is a script.

The compiler itself is never a `wasm-host` module, so building `src/` never
runs the new link step.

Only S-tag's helper or S-type would change what `src/` can be written in. If
the owner chooses S-type (§8), `src/` may not use the new storage type until
the release after it ships.

## 8. Decisions for the owner

1. **Storage: S-copy, S-tag or S-type** (§4.1). The proposal is S-copy,
   confirmed or refused by S3's sweep.
2. **The Safari fallback** (§6). The options:
   - a `--memories 1` flag that builds today's module, with two memories the
     default;
   - both modules built and the loader choosing by `WebAssembly.validate` of
     a 15-byte module that declares two memories. This doubles an embedded (W6) loader's
     bytes;
   - single memory the default until Safari ships, with two memories opt-in.
3. **The exchange area under `--memory <MiB>`** (§4.2). It is fixed, so its
   size is a promise about the largest value that can cross one call. The
   options:
   - a default (1 MiB, say), with a flag beside `--memory` to change it;
   - a share of `<MiB>`, so `<MiB>` stays the module's whole footprint;
   - memory 1 the same size as memory 0, so no crossing can outgrow it, at
     double the memory.

S1 and S2 can land behind a build flag before either is decided. S3 makes it
the default and waits on both.

## 9. Stages

### S1. The second memory exists

What lands:

- `scripts/wasm-memories.mjs`, the rewrite in §3.2;
- the `wasm-host` link step that runs it (behind `NISH_WASM_MEMORIES=2`, off
  by default). It compiles objects with `-O` and links them with none, as
  `NISH_WASM_OPT=0` does, so clang runs no `wasm-opt` inside the link (§3.2).
  The build then runs the rewrite, and after it `wasm-opt` with
  `--enable-multimemory`;
- `nish_memory_bytes()`, an export that answers memory 0's size in bytes
  (`memory.size 0` × 64 KiB), for the tests that today read
  `memory.buffer.byteLength` to see whether the arena grew;
- in `runtime/runtime-wasm.c`, `nish_page_copy_in`, `nish_page_copy_out`,
  `nish_page_fill` and `nish_page_grow` over memory 1, compiled with
  `-mmultimemory`;
- the new runtime calls reserved in `src/c-symbols.ts`, if any are libc
  names.

Tests:

- the rewrite over a fixture module: a memory section of two, `memory`
  exported at index 1, no other memory exported, and every other section
  byte-identical;
- a built module that `WebAssembly.validate`s and instantiates under the
  Node CI pins, both with binaryen on `PATH` and without it;
- `WebAssembly.Module.exports(m)` lists one memory;
- without `--memory`, `memory.grow 1` grows the exported memory and the
  page's views are rebuilt; under `--memory`, memory 1 declares `min = max`,
  `memory.grow 1` answers `-1`, and a view made at instantiation is never
  detached;
- `node tests/run.js c-symbols`;
- with the flag off, no IR or module byte moves.

### S2. Every crossing goes through the exchange area

What lands:

- the loader (`src/interop-wasm.ts`) and the emitted host-import glue
  (`src/emit-strings.ts`) do §5's copies;
- the runtime syncs the storage mirror around exports and imports (§4.1);
- `views()` is built over memory 1.

Tests:

- `wasm-host`, `persist` and every page example green with the flag on;
- `tests/persist/drive.mjs`'s growth checks (`:73` and `:281`) read
  `mod.memory.buffer.byteLength`, which under the flag measures memory 1, not
  the arena. They move to `nish_memory_bytes()` (S1), so "memory did not
  grow" still means the arena did not grow;
- a new test per crossing:
  - an array in, out and copied back;
  - a string result from the arena and from static data;
  - a string to an import, built and literal;
  - a window over storage and over a local array, written by the import and
    read after;
  - a panic text past 4 KiB, cut at a character;
  - under `--memory`, a value larger than the exchange area panics with
    "exchange area full";
  - a ring pushed by the page between calls and inside an import;
- `nish-cmp` `DECLARED` entries for the IR that moves.

### S3. The default, the fallback and the budget *(owner's decisions, §8)*

What lands:

- two memories become the default for `--profile wasm-host`;
- the chosen fallback;
- the guide page for `wasm-host` (`docs/guide/`), which says what `memory`
  now holds, which engines run it and how to build for Safari.

Tests:

- **The forge test, rewritten.** `tests/module-storage/persist/forge.ts`
  and `drive.mjs forge` today write a fake cell past the arena and forged
  lengths, and check each refusal. The rewrite forges as an attacker with the
  whole exported memory would:
  - it captures the instance (as `drive.mjs:12`–`:14` already does);
  - it asserts that the instance's exports hold exactly one
    `WebAssembly.Memory`, and that the module's memory section declares two;
  - between every pair of calls it fills every byte of that memory with
    random bits;
  - it asserts the kept graph's answers are unchanged, call after call.

  A forged in-arena pointer then cannot be written through memory: no view
  the page holds reaches memory 0. The exports that take an arena offset
  stay callable, and §10.2 covers them. The old in-arena forgeries become a check that the
  page cannot reach them, and the bounds tests stay against the
  single-memory build.
- **The budget, measured as #1571 measured.**
  - The graph drive, `node tests/persist/drive.mjs graph` with
    `tests/module-storage/persist/graph.ts` at 20,000 steps (9,999
    compactions), built before and after and run interleaved. The noise band
    comes from two identical builds. Budget: 1.00× within the band.
  - Module size. #1571 recorded "+745 bytes of wasm for a module with root
    storage". Budget: at most +1 KiB for the runtime's copies and the region
    table.
  - A sweep that answers §8.1. It measures µs per export call against 4 KiB,
    64 KiB, 1 MiB and 4 MiB of exported storage, and the same for an export
    that calls one host import 1,000 times.

  The commit records each with its `Measured:` trailer.

### S4. The security record

What lands:

- WH-10's "what stays" is closed: rewritten from "the memory the page already
  holds" to "memory the page cannot name", with S3's forge test as the
  after-test;
- "A forged kept graph is refused" gains the two-memory property;
- the "Root storage" and "A window is lent whole memory" divergences are
  rewritten, since a window is now lent the exchange area or a mirror, not
  the program's memory;
- §10.1's descriptor question is answered and recorded: fixed, open, or moot
  in the two-memory build;
- the single-memory fallback's residual is recorded where it stays: today's
  WH-10 text, unchanged for that build.

## 10. Open questions

1. **A forged trace descriptor.** Descriptors are `internal constant`s in
   writable static data (§2). WH-10 bounds the pointers and lengths the trace
   reads, but not `size`, `count`, `at` or `to`. A page that rewrites a
   descriptor's `at[i]` points the next slot read anywhere. Whether
   `nish_slot` (`runtime/runtime-wasm.c:375`) still holds that slot's
   *target* to the arena should be checked before S1. If it does not, it is
   a WH-10 sibling for the single-memory build, fixed there with bounds. The
   two-memory build is immune either way.
2. **The arena's entry points stay exported.** `nish_arena_release`,
   `nish_alloc_array` and the rest (`scripts/build.sh:1020`) are exports the
   loader calls. §5 adds more that take an offset into memory 0:
   `nish_alloc_array_from(offset, n, elem)`, `nish_export_out(hdr)` and
   `nish_copy_back(hdr, offset)`. The loader keeps the instance to itself,
   but a page that instantiates the bytes itself can call any of them with a
   value it chose: `nish_arena_release(0)` while a graph is kept, or a forged
   `hdr`. That is outside WH-10. It belongs to the same "keep the
   page out" line and might be closed by checking the mark against the
   floor.
3. **Narrowing the sync.** A storage annotation for direction (page writes,
   module writes, both), or an import marked as not touching storage, would
   cut S-copy's cost. Each is a construct (§7). Only worth it if S3's sweep
   shows the cost.
4. **The plain `wasm` profile.** It exports everything and has no loader.
   Whether it should get two memories too is left out. Nothing traces its
   memory between calls.
5. **A newer LLVM.** If a later LLVM lowers an address space to a memory
   index, S-tag gets cheaper. That has not been checked, and CI pins 18.

## 11. Not planned

- Moving the arena to memory 1 and leaving the program's memory exported.
  LLVM 18 cannot address it (§3.1).
- A post-link rewrite of individual loads and stores to memory 1. Which
  memory an access names is not known statically.
- Dropping WH-10's bounds from the two-memory build.
- Shared memory or threads.

## 12. Appendix: the experiment, re-runnable

Every observed result in §3.1, §3.2, §4.2, §5.6 and §5.7 comes from the runs
below. Each input is printed in full, and each command is followed by what it
printed. The toolchain was `llc`, `clang`, `llvm-mc` and `wasm-ld` 18.1.3,
Node v22.23.4 and headless Chromium 153.0.8010.12, on a 4-core Intel Xeon @
2.10 GHz. Binaryen was not installed (`command -v wasm-opt` printed nothing
and exited 1), so no link below ran `wasm-opt`, and none met the one clang
runs inside an `-O` link (§3.2). Put the files in one empty directory and run
the commands from it.

### 12.1 What LLVM 18 does with a second memory

`as.ll` and `var.ll` load through address space 2 and address space 1.
`as.c` is the same load from C. `idx1.s` and `idx2.s` try two spellings of a
memory index on a load; `llvm-mc` takes neither.
`bulk.s` uses the instructions that take a memory index in LLVM 18. `mod.c` is
the module §3.2 runs.

`as.ll`:

```llvm
target triple = "wasm32-unknown-unknown"
define i32 @ld2(ptr addrspace(2) %p) {
  %v = load i32, ptr addrspace(2) %p
  ret i32 %v
}
```

`var.ll`:

```llvm
target triple = "wasm32-unknown-unknown"
define i32 @ld1(ptr addrspace(1) %p) {
  %v = load i32, ptr addrspace(1) %p
  ret i32 %v
}
```

`as.c`:

```c
int ld(__attribute__((address_space(2))) int *p) { return *p; }
```

`idx1.s`:

```asm
ld:
  .functype ld (i32) -> (i32)
  local.get 0
  i32.load 1, 0
  end_function
```

`idx2.s`:

```asm
ld:
  .functype ld (i32) -> (i32)
  local.get 0
  i32.load 0 1
  end_function
```

`bulk.s`:

```asm
f:
  .functype f (i32, i32, i32) -> (i32)
  memory.size 1
  local.get 0
  local.get 1
  local.get 2
  memory.copy 1, 0
  end_function
```

`mod.c`:

```c
/* memory 0 is the program's; memory 1, once the rewrite adds it, the page's. */
void to_page(int dst, int src, int n) {
  __asm__ volatile("local.get %0\n\tlocal.get %1\n\tlocal.get %2\n\tmemory.copy 1, 0"
                   :: "r"(dst), "r"(src), "r"(n) : "memory");
}
int ld1(void) { return __builtin_wasm_memory_size(1); }
int grow1(int n) { return __builtin_wasm_memory_grow(1, n); }
void st0(int *p, int v) { *p = v; }
```

The commands and their output:

```text
$ llc -march=wasm32 -mattr=help 2>&1 | grep multimemory
  multimemory         - Enable multiple memories.
$ llc -mattr=+multimemory as.ll -o - | grep i32.load
	i32.load	0
$ llc -mattr=+multimemory var.ll -o /dev/null 2>&1 | head -1
LLVM ERROR: Encountered an unlowerable load from the wasm_var address space
$ clang --target=wasm32 -mmultimemory -O2 -S as.c -o - | grep i32.load
	i32.load	0
$ llvm-mc -triple=wasm32 -mattr=+multimemory idx1.s -o /dev/null 2>&1 | head -1
idx1.s:4:15: error: invalid operand for instruction
$ llvm-mc -triple=wasm32 -mattr=+multimemory idx2.s -o /dev/null 2>&1 | head -1
idx2.s:4:14: error: Expected ,, instead got: 1
$ llvm-mc -triple=wasm32 -mattr=+multimemory,+bulk-memory -show-encoding bulk.s | grep memory
	memory.size	1                       # encoding: [0x3f,0x01]
	memory.copy	1, 0                    # encoding: [0xfc,0x0a,0x01,0x00]
$ clang --target=wasm32 -mmultimemory -mbulk-memory -O2 -S mod.c -o - | grep memory\\.
	memory.copy	1, 0
	memory.size	1
	memory.grow	1
$ wasm-ld --help | grep -E -- '^  --(export|import|initial|max|shared)-memory|--stack-first'
  --export-memory=<value> Export the module's memory with the passed name
  --export-memory         Export the module's memory with the default name of "memory"
  --import-memory=<module>,<name>
  --import-memory         Import the module's memory from the default module of "env" with the name "memory".
  --initial-memory=<value>
  --max-memory=<value>    Maximum size of the linear memory
  --shared-memory         Use shared linear memory
  --stack-first           Place stack at start of linear memory rather than after data
```

### 12.2 The rewrite

`rewrite.mjs` appends memory 1 to the memory section and points the export
named `memory` at it. With one page count, memory 1 is growable; with two, its
maximum is fixed.

`rewrite.mjs`:

```js
// node rewrite.mjs in.wasm out.wasm <min-pages> [<max-pages>]
// Appends memory 1 and points the export named `memory` at it.
import { readFileSync, writeFileSync } from "node:fs"
const [, , input, output, min, max] = process.argv
const b = readFileSync(input)
const leb = (v) => { const o = []; do { let x = v & 0x7f; v >>>= 7; if (v) x |= 0x80; o.push(x) } while (v); return o }
const uleb = (buf, i) => { let v = 0, s = 0, x; do { x = buf[i++]; v |= (x & 0x7f) << s; s += 7 } while (x & 0x80); return [v >>> 0, i] }
const out = [b.subarray(0, 8)]
let p = 8
while (p < b.length) {
  const id = b[p]
  const [size, start] = uleb(b, p + 1)
  let body = b.subarray(start, start + size)
  p = start + size
  if (id === 5) { // memory section: a count, then each memory's limits
    const [count, rest] = uleb(body, 0)
    const limits = max === undefined ? [0x00, ...leb(+min)] : [0x01, ...leb(+min), ...leb(+max)]
    body = Buffer.from([...leb(count + 1), ...body.subarray(rest), ...limits])
  }
  if (id === 7) { // export section: name, kind, index
    body = Buffer.from(body)
    let [n, i] = uleb(body, 0)
    for (; n > 0; n--) {
      const [len, at] = uleb(body, i)
      const name = body.subarray(at, at + len).toString()
      const kind = body[at + len]
      const [index, next] = uleb(body, at + len + 1)
      if (kind === 2 && name === "memory") {
        if (index !== 0 || next !== at + len + 2) throw new Error("`memory` is not memory 0")
        body[at + len + 1] = 1
      }
      i = next
    }
  }
  out.push(Buffer.from([id, ...leb(body.length)]), body)
}
writeFileSync(output, Buffer.concat(out))
```

### 12.3 Linking, rewriting and running the module

`run.mjs` stores 42 at address 1024 of memory 0, copies four bytes to address
0 of memory 1, reads both through the exported memory, then grows memory 1
from wasm and from JavaScript. `chromium.mjs` runs the same steps in headless
Chromium through the preinstalled Playwright.

`run.mjs`:

```js
// node run.mjs mod.wasm
import { readFileSync } from "node:fs"
const bytes = readFileSync(process.argv[2])
const { instance } = await WebAssembly.instantiate(bytes)
const e = instance.exports
const page = () => new Uint8Array(e.memory.buffer)
console.log("bytes", bytes.length, "exports", Object.keys(e).join(", "))
e.st0(1024, 42)
console.log("after st0(1024, 42): page[1024] =", page()[1024])
e.to_page(0, 1024, 4)
console.log("after to_page(0, 1024, 4): page[0..3] =", [...page().subarray(0, 4)].join(", "))
const before = e.memory.buffer
console.log("ld1() =", e.ld1(), "pages; grow1(1) =", e.grow1(1), "; ld1() =", e.ld1())
console.log("old buffer detached:", before.byteLength === 0)
try { e.memory.grow(1); console.log("memory.grow(1) from JS: ok") } catch (x) { console.log("memory.grow(1) from JS:", x.constructor.name) }
```

`chromium.mjs`:

```js
// node chromium.mjs grow.wasm fixed.wasm — the same checks in headless Chromium
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
const { chromium } = createRequire(import.meta.url)("playwright")
const browser = await chromium.launch()
const page = await browser.newPage()
console.log("chromium", browser.version())
for (const f of process.argv.slice(2)) {
  const out = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const { instance: { exports: e } } = await WebAssembly.instantiate(bytes)
    e.st0(1024, 42); const a = new Uint8Array(e.memory.buffer)[1024]
    e.to_page(0, 1024, 4); const b = [...new Uint8Array(e.memory.buffer, 0, 4)].join(", ")
    return `${Object.keys(e).join(", ")} | page[1024] = ${a} | page[0..3] = ${b} | grow1(1) = ${e.grow1(1)}`
  }, readFileSync(f).toString("base64"))
  console.log(f, "|", out)
}
await browser.close()
```

The commands and their output:

```text
$ clang --target=wasm32 -mmultimemory -mbulk-memory -O2 -nostdlib -Wl,--no-entry -Wl,--export=to_page,--export=ld1,--export=grow1,--export=st0 mod.c -o linked.wasm
$ node run.mjs linked.wasm 2>&1 | grep -o 'CompileError.*'
CompileError: WebAssembly.instantiate(): Compiling function #0:"to_page" failed: memory index 1 exceeds number of declared memories (1) @+109]
$ node rewrite.mjs linked.wasm grow.wasm 1 && node rewrite.mjs linked.wasm fixed.wasm 2 2 && wc -c linked.wasm grow.wasm fixed.wasm
 333 linked.wasm
 335 grow.wasm
 336 fixed.wasm
1004 total
$ node run.mjs grow.wasm
bytes 335 exports memory, to_page, ld1, grow1, st0
after st0(1024, 42): page[1024] = 0
after to_page(0, 1024, 4): page[0..3] = 42, 0, 0, 0
ld1() = 1 pages; grow1(1) = 1 ; ld1() = 2
old buffer detached: true
memory.grow(1) from JS: ok
$ node run.mjs fixed.wasm
bytes 336 exports memory, to_page, ld1, grow1, st0
after st0(1024, 42): page[1024] = 0
after to_page(0, 1024, 4): page[0..3] = 42, 0, 0, 0
ld1() = 2 pages; grow1(1) = -1 ; ld1() = 2
old buffer detached: false
memory.grow(1) from JS: RangeError
$ node chromium.mjs grow.wasm fixed.wasm
chromium 153.0.8010.12
grow.wasm | memory, to_page, ld1, grow1, st0 | page[1024] = 0 | page[0..3] = 42, 0, 0, 0 | grow1(1) = 1
fixed.wasm | memory, to_page, ld1, grow1, st0 | page[1024] = 0 | page[0..3] = 42, 0, 0, 0 | grow1(1) = -1
```

### 12.4 The cost of a copy

`bench.c` copies `n` bytes `reps` times, from memory 0 to memory 1 (`cross`) or
within memory 0 (`same`; the empty `asm` keeps clang from merging the copies).
`bench.mjs` times both at five sizes, best of 5. `call.mjs` times a JavaScript
call to `ld1`, a one-instruction export, using `fixed.wasm` from §12.3. Memory
0 is fixed at 8 MiB and memory 1 at 32 pages, so neither grows while timed.

`bench.c`:

```c
/* `reps` copies of n bytes from memory 0 to memory 1 (cross), or within memory 0 (same). */
void cross(int dst, int src, int n, int reps) {
  for (int i = 0; i < reps; i++)
    __asm__ volatile("local.get %0\n\tlocal.get %1\n\tlocal.get %2\n\tmemory.copy 1, 0"
                     :: "r"(dst), "r"(src), "r"(n) : "memory");
}
void same(int dst, int src, int n, int reps) {
  for (int i = 0; i < reps; i++) { __builtin_memcpy((char *)dst, (char *)src, n); __asm__ volatile("" ::: "memory"); }
}
```

`bench.mjs`:

```js
// node bench.mjs bench2.wasm — ns per copy and GB/s, best of 5 runs
import { readFileSync } from "node:fs"
const { instance: { exports: e } } = await WebAssembly.instantiate(readFileSync(process.argv[2]))
const SRC = 4 << 20
for (const n of [64, 1024, 16384, 65536, 1048576]) {
  const reps = Math.max(200, Math.floor((1 << 30) / n / 4))
  const row = [`${n} B`]
  for (const [name, f, dst] of [["0->1", e.cross, 0], ["0->0", e.same, 2 << 20]]) {
    f(dst, SRC, n, 100)
    let best = Infinity
    for (let k = 0; k < 5; k++) { const t = process.hrtime.bigint(); f(dst, SRC, n, reps); best = Math.min(best, Number(process.hrtime.bigint() - t) / reps) }
    row.push(`${name}: ${best.toFixed(1)} ns, ${(n / best).toFixed(1)} GB/s`)
  }
  console.log(row.join(" | "))
}
```

`call.mjs`:

```js
// node call.mjs fixed.wasm — ns per JS→wasm call of a one-instruction export, best of 5
import { readFileSync } from "node:fs"
const { instance: { exports: e } } = await WebAssembly.instantiate(readFileSync(process.argv[2]))
const N = 10_000_000; let best = Infinity, s = 0
for (let k = 0; k < 5; k++) { const t = process.hrtime.bigint(); for (let i = 0; i < N; i++) s += e.ld1(); best = Math.min(best, Number(process.hrtime.bigint() - t) / N) }
console.log(`ld1(): ${best.toFixed(1)} ns per call (${s > 0})`)
```

The commands and their output, two runs each:

```text
$ clang --target=wasm32 -mmultimemory -mbulk-memory -O2 -nostdlib -Wl,--no-entry -Wl,--export=cross,--export=same -Wl,--initial-memory=8388608,--max-memory=8388608 bench.c -o bench1.wasm && node rewrite.mjs bench1.wasm bench2.wasm 32 32
$ node bench.mjs bench2.wasm
64 B | 0->1: 4.1 ns, 15.6 GB/s | 0->0: 4.4 ns, 14.7 GB/s
1024 B | 0->1: 8.9 ns, 114.7 GB/s | 0->0: 8.9 ns, 114.9 GB/s
16384 B | 0->1: 83.4 ns, 196.4 GB/s | 0->0: 81.7 ns, 200.6 GB/s
65536 B | 0->1: 1200.6 ns, 54.6 GB/s | 0->0: 1193.1 ns, 54.9 GB/s
1048576 B | 0->1: 19573.0 ns, 53.6 GB/s | 0->0: 19449.4 ns, 53.9 GB/s
$ node bench.mjs bench2.wasm
64 B | 0->1: 4.2 ns, 15.4 GB/s | 0->0: 4.1 ns, 15.6 GB/s
1024 B | 0->1: 8.3 ns, 123.9 GB/s | 0->0: 8.4 ns, 121.4 GB/s
16384 B | 0->1: 79.0 ns, 207.3 GB/s | 0->0: 79.0 ns, 207.5 GB/s
65536 B | 0->1: 1156.8 ns, 56.7 GB/s | 0->0: 1185.0 ns, 55.3 GB/s
1048576 B | 0->1: 15694.1 ns, 66.8 GB/s | 0->0: 15719.9 ns, 66.7 GB/s
$ node call.mjs fixed.wasm
ld1(): 2.4 ns per call (true)
$ node call.mjs fixed.wasm
ld1(): 2.5 ns per call (true)
```
