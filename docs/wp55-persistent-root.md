# WP55: an object graph a WebAssembly module keeps between calls

**Status: landed (2026-11-13).** Stage R1 built it.

## 1. The problem

A `--profile wasm-host` module answers a page through exports, and the loader
brackets every export call with `nish_arena_mark` / `nish_arena_release`
([WP50](wp50-wasm-host.md) §6). That bracket is what keeps the module's memory
flat: nothing a call allocates outlives it. It is also why a module can keep
no object between calls: module state is number, `boolean` and string
constants and [module storage](LANGUAGE.md#module-storage), whose elements are
pointer-free (NL2686). A game whose state is a class instance with arrays,
strings and other instances hanging off it — a director that owns its scenes —
cannot be driven by `init` / `step` / `draw` exports. It has to be rebuilt
every call, or flattened by hand into typed arrays.

The goal: a module holds one object graph — a class instance and everything
reachable from it — alive across export calls, with memory **bounded** while
the page calls `step` 120 times a second for hours, and the code that runs
behind the exports is ordinary Nish that allocates as it likes.

## 2. The options

**A. An allocation-site persistent region.** Allocations the root can reach
go to a second arena the bracket does not release. Which allocations those
are is a whole-program flow question, and the answer for a program that
replaces a scene, a particle list or a string every step is "most of them".
What the root stops reaching stays in the persistent arena for ever: the
memory grows with play time, which is the failure this package exists to
remove. Rejected.

**B. Opt out of the bracket.** The module asks the loader not to release.
Every temporary of every call is kept; a module calling `step` 120 times a
second grows without bound. Rejected for the same reason.

**C. Keep only what the root reaches: copy it.** The bracket stays. At the
end of a call, instead of releasing to the mark, the runtime traces the graph
from the root slots and keeps exactly what they reach, moving it down to close
the gaps; everything else is released as before. Memory is bounded by a
multiple of the live graph, whatever the program allocates per call. The cost
is a tracing copy, paid for by the compiler describing every type the root can
reach. **Chosen.**

**D. One export that never returns, yielding each frame.** The conventional
port: `run()` loops for ever and suspends at a host import once a frame,
through JSPI (`WebAssembly.Suspending`/`promising`) where the browser has it
and an Asyncify build (`wasm-opt --asyncify`) where it does not. It needs no
language change, but it does not bound memory: inside one call nothing
releases the arena, so every step's allocations stay until the call returns,
which it never does. That is exactly how native `nish break` runs today, and
it grows with play time too: `nish src/break.ts --explain-memory` reports that
`wallUpdate` and `stepBreakDirector` store what they allocate into memory, so
no pass of `playBreak`'s loop (`src/break.ts`, around `runTerminal`) is
scoped, and each frame's allocations live until `playBreak` returns. D would
also add a second build path: JSPI is not in every browser, and Asyncify needs
binaryen's `wasm-opt`, which `scripts/build.sh` treats as optional, and its
instrumentation grows the module and slows the functions it rewrites. Rejected: it moves the loop, not the memory.

`nish:region` ([WP46](wp46-long-running-memory.md)) is not an alternative: a
region is an arena of its own that grows until it is freed whole, so a root in
a region that the program re-enters every step grows with play time just as A
does.

## 3. The surface: root storage

One existing construct, widened. Module storage whose element type is
`C | null`, for a class `C`, is **root storage**:

```ts
class World {
  balls: Ball[] = []
  title: string = ""
  tick: i64 = 0
}

const world = new Array<World | null>(1)

export const init = (): void => {
  world[0] = new World()
}

export const step = (): void => {
  const w = world[0]
  if (w !== null) {
    w.tick = w.tick + 1
    w.balls.push(new Ball(w.tick))
  }
}
```

- Its elements start `null` (the storage is zero-filled, and a null pointer is
  zero), and each element is a root.
- An element is read, bound (`const w = world[0]`), passed and assigned as any
  `C | null`. Module storage's element rules for pointer-free elements (NL2674,
  NL2675) are about copies of a record that is stored inline; a root element is
  a pointer, so binding it aliases the object, as binding any object does.
- Everything else module storage refuses stays refused: the storage itself as a
  value (NL2677), `for…of` over it (NL2678), its methods and `length` (NL2688).
- It is **not exported**: the page reaches nothing new. Exported module storage
  is a layout the page reads; root storage has no layout a page could read
  safely, because the runtime moves what it points to. `export` of root storage
  is refused.
- What the root can reach must be traceable (§4): the checker walks the type
  closure of `C` — every field, array element and union variant, transitively —
  and refuses a type the runtime cannot trace, naming the path from `C` to it.

Nothing new is spelled: no keyword, no builtin, no import. A program that does
not declare root storage compiles byte for byte as before.

### 3.1 What the closure may hold

| Type in the closure | Traced as |
| --- | --- |
| a number, `boolean`, `enum`, function reference | not a pointer: copied with the object holding it |
| `string` | a block of `8 + len + 1` bytes |
| `T[]`, `readonly T[]`, typed arrays | the 24-byte header and `cap` elements of data, each element traced when `T` holds pointers |
| a class or record `D`, `D \| null` | `sizeof(D)` bytes, each pointer field traced |
| a discriminated union `A \| B` | the variant its tag names |

Refused (one code, the path named in the message): `Map`, `Set`, an interface a
class implements (the object behind it may be larger than the interface, with
fields the interface does not describe), `Region`, `Secret`, a handle class, a
`declare class`, `CPtr`, `Promise` and anything else not in the table. Each
refusal can be lifted later by teaching the tracer the layout.

## 4. The runtime: keep what the roots reach

The compiler emits, for a program with root storage, a table of the root slots
and a **trace descriptor** per type in the closure: its kind, its size and the
offset and descriptor of each pointer it holds. Offsets and sizes are LLVM
constant expressions (`ptrtoint` of a `getelementptr` from `null`), so the same
IR describes a 32-bit and a 64-bit target. It also emits one function,
`nish_root_keep(mark)`, that hands the table to the runtime.

The wasm loader, for such a program, calls `nish_root_keep(mark)` where it
called `nish_arena_release(mark)`, after the result is decoded, as before.

`nish_root_keep` in `runtime/runtime-wasm.c`:

1. The **kept region** is `[floor, off)`: `floor` is the lowest mark a keep has
   seen, so it is where the first kept object went, and memory below it
   (anything allocated before the first call) is never moved.
2. If the kept region is at most `2 × live + 64 KiB`, where `live` is the size
   the last compaction kept, nothing is released: the call's allocations stay.
   This is the cheap path, taken by most calls.
3. Otherwise it **compacts**: it traces from every root slot with a work list
   (no recursion, so a list as long as the run does not run out of stack),
   recording each reachable block in the kept region (start, size) and each
   pointer slot that holds a pointer into it. A pointer outside the kept
   region — a string constant, memory below `floor` — is followed, so what it
   reaches is traced too, but it is never moved. Blocks are sorted and
   overlapping blocks merged into extents, so aliasing, cycles and a pointer
   into the middle of a block are all one extent. Every recorded slot is
   rewritten, once, by a binary search over the extents; then the extents
   slide down in place, in address order, with `memmove` — each one's new
   place is at or below its old one and above every earlier extent's, so a
   forward move never overwrites what is still to move. `off` is set past the
   last; `live` becomes the kept size.

The trace's bookkeeping lives in **scratch** above `off`: the block list, the
slot list, the work list and a seen set (an open-addressing hash of
(object, descriptor) pairs, so one address traced as two types is traced as
both), each a vector that doubles as it grows, and then the extent list. A
vector that grows gives its old copy back to a short free list, and the work
list and the seen set go back to it once the trace ends, so the extent list
and later growth reuse them; scratch is never copied into the heap and is
forgotten when the keep returns.

Memory is then bounded by `2 × live + 64 KiB` of kept region, plus one call's
temporaries, plus the scratch, which grows with the number of blocks and
pointer slots the roots reach, not their bytes. At its worst — every vector
just doubled, its old copy not yet reused, the seen set a quarter full — the
scratch is about 220 bytes an object (an array is two blocks, its header and
its data) and 32 bytes a pointer slot. `memory.buffer` grows to that
high-water mark and stays there, so the peak is at most

    static data + 3 × live + 64 KiB + one call's allocations
                + 220 B × objects + 32 B × pointer slots

Measured (`tests/persist/drive.mjs`, chain): a list of 200,000 nodes, each 8
bytes once compacted, is 1.6 MB of live data; the kept heap after the last
call is 2,213,360 bytes, the static data and the nodes pushed since the last
compaction at the 16 bytes each was allocated, and linear memory peaks at
14,090,240 bytes, 8.8× the live data. The break director, with fewer and
larger blocks, has a kept heap of 3.26 MB in 3.34 MB of memory; the kept heap
is the arena's offset after a keep (the static data, what the roots reach and
what has been kept since the last compaction), not the live graph alone. The
bound is loose for most graphs, but it is the safe default: the peak grows
with the live graph, so a measurement holds only for a graph as large as the
one measured. To size `--memory` below it, run the module once without
`--memory` through the largest session or graph the program will reach, read
the peak `memory.buffer.byteLength`, and give `--memory` about 1.5× that.

The amortised cost of a call is at most twice what it allocated. A compaction
comes only after at least `live + 64 KiB` was allocated since the last one,
and it moves what is live now: at most the last `live` plus what those calls
kept, so at most twice what they allocated.

### 4.1 Why nothing else points into the kept region

The bracket's proof (WP50 §6) is that nothing outside a call reaches the
arena. Root storage adds exactly one way, the root slots, and the trace starts
from them. Module storage elements are pointer-free; locals are gone when the
export returns; the loader decodes every result and copies back every array
argument inside the bracket, before `nish_root_keep` runs; the runtime keeps no
pointer into the arena across calls. So a compaction moves every pointer that
names a kept object.

Inside a call, a function's own arena scope must not release what it stored
into the root graph. The escape analysis (`src/escape.ts`) counts any store of
an allocation into memory as an escape, so an allocation stored into a root
slot, or into an object or array loaded from one, is heap memory, never a stack
slot or memory the storing function's scope releases. What it could not see
was the other half of the containment proof, `rootsHoldNoPointer`: a function
whose parameters hold no pointer was taken to reach no memory older than the
call, so an `init()` that stores a fresh object into a root still counted as
contained, and the scope the callee rule gives a contained function released
the object's arrays, which its constructor had allocated. A program that declares root storage, on any target, loses
that half (`Options.holdsRoots`), and containment rests on `!allocEscapes`
alone, which is sound because a store through a root is an escape.

### 4.2 Interactions

- **Panics.** A panic kills a guarded module; `nish_root_keep` is never reached
  and nothing is moved. Root storage makes a module guarded, as module storage
  does.
- **`nish_reset_arena`.** Resetting the arena empties every root slot first.
- **Native builds.** A native program never releases its arena across calls
  to its own functions, so root storage is ordinary module storage holding a
  pointer: the graph lives in the thread's arena, and no trace runs.
  `nish_root_keep` is emitted only for wasm. A build that writes a native
  shim (`--emit-napi`, `--emit-napi-async`, `--emit-header`) is different:
  the shim marks the arena before a call that passes a string or an array
  and releases it after, which would free what a root reaches. Root storage
  is refused there (NL2769) rather than traced. So is a `--profile wasi`
  build with `--emit-dts` (NL2770): its loader releases the arena after
  every call, and it is not a page module, so no `nish_root_keep` is emitted
  for it to call instead. A freestanding `--target wasm32` build without
  `--emit-dts` emits the keep but writes no loader: its host's own loader
  must call `nish_root_keep(mark)` in place of `nish_arena_release(mark)`.
- **`--emit-ts`.** Root storage is an `Array` of objects filled with `null`; the
  JS heap keeps the graph.
- **`--deterministic`.** A compaction depends only on the bytes allocated, not
  on time or addresses outside the arena; the output is unchanged.
- **Threads.** A parallel body, a spawned task and a region's `f` get their own
  arena; storing their memory into a root would leave a pointer into an arena
  that is freed. Reading or writing root storage there is refused, as is
  region memory stored into it (NL2609 already treats module storage as outer
  memory).

## 5. Refusals

| Refused | Code |
| --- | --- |
| root storage whose class reaches a type §3.1 does not trace | NL2766 |
| `export` of root storage | NL2767 |
| root storage in a program that loads `nish/threads` or `nish:region` (§4.2) | NL2768 |
| root storage in a build that writes a native shim: `--emit-napi`, `--emit-napi-async` or `--emit-header` (§4.2) | NL2769 |
| root storage in a `--profile wasi` build with `--emit-dts`, whose loader releases the arena (§4.2) | NL2770 |
| the element of root storage something other than `C \| null` for a class `C` (`C` alone, an interface, a record) | NL2686, as today |

## 6. Proof

- A golden `.ll` of a program with root storage: the descriptors, the root
  table and `nish_root_keep`; an `llvm-as` pass.
- A native round trip with expected stdout.
- `node tests/run.js persist`: a wasm module driven from Node for at least
  100,000 calls, asserting the values each call answers and that
  `memory.buffer.byteLength` and the kept region are flat after warm-up; and a
  second module whose root is a real game director, run through
  `init` / `step` / `draw` for a long scripted session.
- A negative test per refusal.

## 7. Stages

- [x] R1: root storage — checker, descriptors, `nish_root_keep`, loader,
  tests and docs

## Not in this work package

A generational keep (copying only what the call allocated and the old graph
points to), which would make a compaction cost what the call kept rather than
the live graph; a root reachable from a page; the refused types of §3.1.

The page holds the memory the kept graph lives in, so it can still scramble
that graph inside the arena (security record, WH-10).
[WP59](wp59-wasm-arena-memory.md) proposes moving the arena into a second
memory the module does not export.
