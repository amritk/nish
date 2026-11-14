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
| a host import's window | `:1363` (`win`); `src/emit-strings.ts:652`–`:684` (`emitHostWindow`) | a whole-memory view plus the data offset of *any* array | **yes** for a local array, no for storage |
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

What I tried (`llc`, `clang` and `llvm-mc` 18.1.3):

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
  - the intrinsic `llvm.wasm.memory.size.i32(i32 1)` emits `memory.size 1`;
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
module it makes is invalid. Node refuses it: "Compiling function #0:"g"
failed: memory index 1 exceeds number of declared memories (1)".

A rewrite after the link fixes that in about 30 lines of JavaScript. It walks
the sections, appends a memory `{ flags 0x00, min 1 }` to the memory section
(id 5), and points the export named `memory` at index 1 in place of 0. On a
test module with three functions:

- `to_page`: `memory.copy 1, 0`;
- `ld1`: `memory.size 1`;
- `st0`: an `i32.store` to memory 0.

The module grew from 174 bytes to 176. `st0(1024, 42)` left byte 1024 of the
exported memory at 0, so memory 0 was out of the page's sight.
`to_page(0, 1024, 4)` made bytes 0 to 3 of the exported memory `42, 0, 0, 0`.
The exports were `memory, to_page, ld1, st0`. It ran the same under Node
v22.23.4 and v24.22.1.

A hand-built module checked the other direction. It had two memories, a
store and a load through memory index 1 (memarg flag `0x42`), and exported
only memory 0. It ran under:

- Node v22.23.4 (V8 12.4);
- Node v24.22.1 (V8 13.6);
- headless Chromium 153.0.8010.12.

In each, `f()` answered 42, the exported memory's byte 0 stayed 0, and the
exports were `memory, f`. Node 22's `--v8-options` shows
`--experimental-wasm-multi-memory` on by default.

The rewrite belongs in `scripts/build.sh`'s `wasm-host` link, directly after
`wasm-ld` and before the optional `wasm-opt` (`:1066`). Until the rewrite
runs the module is invalid, and `wasm-opt` validates its input. `wasm-opt`
then needs `--enable-multimemory` beside `--enable-bulk-memory`. Binaryen
supports multi-memory (features.json, §6). The script lives in `scripts/`. It
uses no construct, so the rolling freeze (§7) does not touch it.

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

This keeps WP50 §5's contract: offsets, `views()`, rings and "a view stays
valid for the module's whole life". It gives up §5's title, "no copies", for
storage. The cost scales with the bytes of exported storage per crossing. It
is measured, not guessed (§9, S3).

The two alternatives each keep "no copies" and each lose something else:

- **S-tag:** a bit in each array header says which memory the data lives in.
  Every element access then branches between a load from memory 0 and a
  helper that reads memory 1. That costs every array access in every
  program, not just a crossing, and the helper is a call where a load was.
- **S-type:** module storage gets a type of its own that cannot be converted
  to `T[]`, so its memory is known statically. That is a language change,
  and it breaks every program that passes a storage array to a function
  taking `T[]`, which `std/host/ring` does.

S-copy changes neither the language nor any IR outside the crossings. It is
the proposal, unless S3's numbers say no (§8).

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

The exchange area is reset with the arena bracket. Its high-water mark is
grown with `memory.grow 1` and never shrinks, just as the arena's chunks
never return. S1 checks that `llvm.wasm.memory.grow` takes index 1, as
`memory.size` does.

## 6. Engines, and the fallback

Multi-memory is phase 5 (standardised, in Wasm 3.0). This table is the
`multiMemory` key of `features.json` in the WebAssembly/website repository,
cross-checked against the web-features `wasm-multi-memory` entry:

| Engine | First version | Notes |
| --- | --- | --- |
| Chrome / Edge | 120 (2023-12-05) | Chromium 153 ran the two-memory test module (§3.2) |
| Firefox | 125 (2024-04-16) | |
| Safari, Safari iOS | **not supported in stable** | Safari Technology Preview 250 (WebKit blog, 2026-08-13): "Added support for multiple memories in a single WebAssembly module"; WebKit bug 277743 is fixed. web-features: "Baseline availability blocked since April 2024 by Safari". |
| Node.js | 22.0 | `package.json` requires `>=22.18.0`. CI pins 26.13.1. Node 22.23.4 and 24.22.1 ran both test modules. |
| Deno | 1.38 | |
| Wasmtime | 15 | |
| Wasmer | 7.3 | |
| Wasmi | 0.37 | |
| WasmEdge | 0.9.1 | |
| Binaryen (`wasm-opt`) | yes | needs `--enable-multimemory` |
| wazero | no | |

The `wasi` profile is not touched. It links `runtime.c` and wasi-libc, has no
loader and no arena handed back between calls, and exports only `memory` and
`_start` (`scripts/build.sh:65`–`:69`). The plain `wasm` profile
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
- the inline assembly lives in `runtime/runtime-wasm.c`, which the seed does
  not compile `src/` with;
- the rewrite is a script.

CI's `bootstrap` job builds `src/` with the seed. That build uses the `wasi`
profile and the native one, not `wasm-host`, so it never runs the new link
step.

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

S1 and S2 can land behind a build flag before either is decided. S3 makes it
the default and waits on both.

## 9. Stages

### S1. The second memory exists

What lands:

- `scripts/wasm-memories.mjs`, the rewrite in §3.2;
- the `wasm-host` link step that runs it (behind `NISH_WASM_MEMORIES=2`, off
  by default), and `--enable-multimemory` on `wasm-opt`;
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
  Node CI pins;
- `WebAssembly.Module.exports(m)` lists one memory;
- `memory.grow 1` grows the exported memory;
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
- a new test per crossing:
  - an array in, out and copied back;
  - a string result from the arena and from static data;
  - a string to an import, built and literal;
  - a window over storage and over a local array, written by the import and
    read after;
  - a panic text past 4 KiB, cut at a character;
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

  A forged in-arena pointer then cannot be written at all: no value the page
  holds names memory 0. The old in-arena forgeries become a check that the
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
   loader calls. The loader keeps the instance to itself, but a page that
   instantiates the bytes itself can call `nish_arena_release(0)` while a
   graph is kept. That is outside WH-10. It belongs to the same "keep the
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
