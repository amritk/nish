# WP48: Compressed 32-bit references — designed and measured

**Status: proposed.** Nothing here is built, and nothing in the compiler, the
runtime or `std/` changes with this note. The anchors are at `c5626cb`.
[LANGUAGE.md](LANGUAGE.md) stays normative. Part of #1098.

A class reference in Nish is an 8-byte pointer into the arena. Two TypeScript
compilers written in other languages answer the cost of that width two ways.
tsrs stores a reference as a `NonZeroU32` offset, in 8-byte units, into a
reserved 32 GiB range, and reports 1.9 to 2.6 times lower peak memory than
tsgo. ts-rust stores dense `u32` ids into one arena per node kind. This note
asks what each would cost Nish and what each would buy, measures what can be
measured today, and recommends one:

- **Design A**, a whole-program mode in which every class reference stored in
  memory is a 32-bit offset from an arena base.
- **Design B**, a library `Pool` of records in arrays addressed by `i32`, in
  legal TypeScript, with no compiler change.

**The recommendation is neither as asked.** Neither 32-bit design is worth
building now. The measured win is in **layout**: an AST node with sibling links
in place of a `kids: Node[]` array takes **0.52x the memory and 0.68x the time**
of the idiomatic port, with 8-byte pointers. That costs nothing but a port
convention (§4). Design B, as columns, goes further (0.32x memory, 0.63x time)
but costs every access in the source. Design A would save about a quarter more
on top of the sibling layout (0.75x of its memory, once the arena's 8-byte
rounding is counted), and it breaks six invariants to do it (§3).

## 1. The bench

[`bench/wp48-refs/`](../bench/wp48-refs/README.md) builds one AST-shaped tree
(a seeded xorshift picks each node's kind and its 2 to 6 children, depth at most
16) in five layouts. It times three phases: the build, a recursive visitor from
the root, and a climb along parent links from every leaf to the root. All five
print the same checksum, natively and under Node.

| program | a node is | a link is |
| --- | --- | --- |
| `class` | a class with `kids: Node[]`, as a port of a TypeScript AST writes it | an 8-byte pointer |
| `sibling` | a class with `first` and `next` sibling links | an 8-byte pointer |
| `pool` | an `interface` record in one `Rec[]`, its children a run of a flat `i32[]` | an `i32` index |
| `records` | `sibling`'s five fields as one `interface` record in one `Rec[]` | an `i32` index |
| `columns` | the same five fields, one presized `i32[]` each, read with `uncheckedGet` | an `i32` index |

`records` is the layout Design A would give `sibling`: 20 bytes of fields a
node, side by side (A's arena would hand each node out as 24, §1.3). It is not
Design A's *code*: each access goes through an array with a bounds check,
where A would add a base to a shifted offset (§1.3).

```bash
npm run build
node bench/wp48-refs/run.mjs     # 9 rounds at 20k, 400k and 4M nodes
```

### 1.1 Numbers

x86-64, four-core Intel Xeon at 2.80 GHz (a virtual machine; L1d 32 KiB a
core, L2 4 MiB in all, L3 33 MiB), Ubuntu clang 18, `build/nish` at `c5626cb`
with default flags. Each figure is the median over 9 rounds. Each round runs
every program once, in a fresh process, in a shuffled order. Peak RSS is
`ru_maxrss` (from [`bench/rss.c`](../bench/rss.c)). The noise band is the
median gap between `class` and a byte-identical copy of its binary timed in the
same rounds (`.claude/testing.md`, "A `Measured:` trailer"). A gap inside the
band is no gap.

Memory is peak RSS, not `Arena.mark()`: the arena is a list of chunks, so two
marks do not subtract (the paragraph after the tables says why). "total vs
class" is the median of a layout's per-round totals over the median of
`class`'s, so it can differ by a point or two from the per-phase medians
summed. A ratio between two other layouts quoted below is the quotient of their
"total vs class" figures (columns against sibling at 4M: 0.63 / 0.68 = 0.93).

**4,000,000 nodes** (240 MB for `class`, far out of cache), 4 walks of each
kind. Band: build 8.2%, visit 8.2%, climb 1.8%, total 3.6%.

| layout | peak RSS | bytes/node | build ms | visit ms | climb ms | total vs class |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| class | 239.7 MB | 62.8 | 150.6 | 193.0 | 308.3 | 1.00x |
| class-copy | 239.7 MB | 62.8 | 161.6 | 194.5 | 301.9 | 0.99x |
| sibling | 123.6 MB | 32.4 | 93.2 | 133.4 | 217.5 | 0.68x |
| pool | 189.1 MB | 49.6 | 150.1 | 113.2 | 309.6 | 0.88x |
| records | 157.8 MB | 41.4 | 128.1 | 122.7 | 319.7 | 0.87x |
| columns | 77.8 MB | 20.4 | 79.2 | 103.6 | 237.3 | 0.63x |

**400,000 nodes** (25 MB, in L3), 25 walks. Band: build 21.7%, visit 9.4%,
climb 6.1%, total 8.1%.

| layout | peak RSS | bytes/node | build ms | visit ms | climb ms | total vs class |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| class | 25.3 MB | 66.4 | 17.7 | 133.7 | 199.8 | 1.00x |
| class-copy | 25.3 MB | 66.4 | 15.8 | 125.9 | 193.7 | 0.96x |
| sibling | 13.7 MB | 35.9 | 9.7 | 86.4 | 143.4 | 0.68x |
| pool | 22.7 MB | 59.5 | 15.8 | 70.1 | 190.3 | 0.82x |
| records | 19.2 MB | 50.4 | 13.5 | 80.1 | 207.4 | 0.86x |
| columns | 9.2 MB | 24.1 | 10.0 | 77.1 | 146.3 | 0.64x |

**20,000 nodes** (about 2 MB, in L2), 500 walks. Band: build 9.2%, visit
6.3%, climb 2.1%, total 2.1%. Bytes per node are left out: the process's own
resident set swamps the tree at this size.

| layout | peak RSS | build ms | visit ms | climb ms | total vs class |
| --- | ---: | ---: | ---: | ---: | ---: |
| class | 2.7 MB | 0.9 | 52.5 | 135.3 | 1.00x |
| class-copy | 2.7 MB | 0.8 | 54.3 | 135.2 | 1.01x |
| sibling | 2.1 MB | 0.5 | 47.8 | 116.6 | 0.87x |
| pool | 2.7 MB | 0.9 | 51.6 | 179.4 | 1.25x |
| records | 2.6 MB | 0.8 | 58.7 | 211.1 | 1.43x |
| columns | 2.0 MB | 0.6 | 62.0 | 139.0 | 1.13x |

`Arena.mark()` cannot stand in for peak memory. It is the current bump
*address*, and the arena is a list of `malloc`'d chunks
(`runtime/runtime.c:189`), so two marks in different chunks do not subtract.
`Arena.used()` covers the current chunk only. The programs print it on stderr
for a single-chunk check, and the tables use RSS.

### 1.2 What the numbers say

- **Layout wins first.** `sibling` against `class`: 0.52x the peak memory at
  4M nodes and 0.54x at 400k, 0.68x the total time at both sizes, and 0.87x in
  cache. All of these are far outside every band. `class` pays for a
  `nish_array` header (24 bytes) and a separately grown block of child
  pointers for every node, and its visitor follows two pointers per child
  where `sibling` follows one.
- **Narrow handles do not beat 8-byte pointers in the same layout.**
  `records` (20 live bytes a node) is *slower* than `sibling` (32) at every
  size. At 4M it takes 1.28x the memory: a `Rec[]` cannot be presized
  (`new Array<Rec>(n)` is refused because it would fill with null), so it grows
  by doubling, and every block it leaves behind stays in the arena. Its 41
  bytes a node is 20 live and about 21 dead. In cache, its climb is 1.81x
  `sibling`'s. The IR shows why: every step reloads the array header, compares
  the index with the length and calls `nish_panic_index` on failure, then
  indexes. `sibling` does one load.
- **Columns win on memory and keep up on time.** `columns` is the only layout
  at 20 bytes a node with no growth garbage (a column is `new Array<i32>(n)`,
  presized). At 4M nodes it takes 0.63x the memory of `sibling` and 0.93x its
  time. That time gap is outside the 3.6% band there, but inside the 8.1% band
  at 400k. In cache it is 1.30x *slower* than `sibling`: a climb step reads two
  columns, so two cache lines.
- **`pool`**, the shape a port reaches for first (records plus a child list),
  gets the worst of both: the growth garbage of a record array and a second
  indirection for the child list.

### 1.3 What Design A would measure, by arithmetic

A cannot be measured without building it. Its layout can be counted. `sibling`'s
node is `{ kind: i32, pos: i32, parent, first, next }`, 8 + 3×8 = 32 bytes.
With 4-byte references it is 8 + 3×4 = 20 bytes, but the bump allocator
rounds every allocation up to 8 (`runtime/runtime.c:216`), and A's offsets
count 8-byte units, so every object must stay 8-aligned anyway. A node is
handed out as 24 bytes: 24 / 32 predicts about **0.75x of `sibling`'s
memory** on this tree, with `sibling`'s locality. That is still more than the
20 bytes a node `columns` holds (measured at 0.63x of `sibling`). The
prediction is consistent with tsrs's 1.9 to 2.6x, which is measured against Go
and covers strings and arrays as well.

`class` gains less. Its array header is three 8-byte words whatever a
reference is, and only the child pointers inside the block and the `parent`
field narrow. By the same count it goes from 63 to roughly 47 bytes a node,
about 0.75x, and stays well above `sibling` with full pointers. The rounding
leaves this figure alone: the object (`kind`, `pos` and two 4-byte references)
is 16 bytes, and a child block grows through 4, 8, 16 slots
(`runtime/runtime.c:1444`), so 4-byte slots always fill whole 8-byte words.

The time A would cost is the decode on every load of a reference field: `zext`,
`shl 3`, an `add` of the base (a global or thread-local load, or a register the
backend keeps), and a `select` to keep 0 meaning `null`. A store pays the
reverse. JVMs pay the same and win, because the decode is a single address
mode on x86-64. Whether LLVM folds it as well, through `getelementptr` on an
`i8*` base, is **unmeasured**.

## 2. What each design costs a port, in the source

The climb from `bench/wp48-refs/`, three ways:

```ts
// sibling.ts — a pointer graph; Design A compiles this source unchanged
let at: Node | null = n
while (at !== null) {
  s = wrappingAdd(s, at.kind ^ round)
  at = at.parent
}

// records.ts — Design B as records
let at: i32 = n
while (at >= 0) {
  const p: Rec = t.nodes[at]
  s = wrappingAdd(s, p.kind ^ round)
  at = p.parent
}

// columns.ts — Design B as columns
let at: i32 = n
while (at >= 0) {
  s = wrappingAdd(s, uncheckedGet(t.kind, at) ^ round)
  at = uncheckedGet(t.parent, at)
}
```

A port under B reads a node through its pool, and the pool must be in reach
of every function that follows a link, so it is threaded through every
signature (`t: Tree`). `null` becomes `-1`, `n.parent` becomes `t.nodes[n].parent`
or `uncheckedGet(t.parent, n)`, and `new Node(...)` becomes a `push` of an
annotated literal (`const r: Rec = { ... }` first: an object literal pushed
bare has no contextual type).

B also loses type safety, and the language cannot give it back today:

- **A handle cannot be a record.** `interface Ref<T> { readonly i: i32 }` as a
  field is stored as a pointer to a separate allocation. The IR is
  `%struct.Rec = type { i32, %struct.Ref$$Rec*, ... }`, so a typed handle is
  8 bytes and an allocation, worse than the pointer it replaces.
- **A handle cannot be branded.** `type Id = i32 & { readonly __brand: "Id" }`
  is a syntax error in Nish. `type Id<T> = i32` is accepted, but the alias is
  structural, so a `NodeId` and a `TypeId` mix freely.
- **`uncheckedGet` takes arrays of numbers only.** A record array keeps its
  bounds check, which is the 1.81x in §1.2. Columns drop it, but every read
  is then a call-shaped expression, and an out-of-range index is undefined
  behaviour, not a panic.

So B as columns is the fastest layout measured and the hardest port to read.
It suits a hot, closed core (a scanner's token stream, a type table). It is a
poor rule for every node of a ported AST.

## 3. The two designs and the invariants they touch

### Design A: a whole-program compressed-reference mode

A flag (say `--refs 32`) under which every class reference **stored in
memory** (a field, an array element, a `Map` value) is a 32-bit offset, in
8-byte units, from one base. Locals, parameters and return values stay full
pointers in registers, so the decode happens at a load and the encode at a
store. This is the JVM's compressed-oops shape, and tsrs's.

What it breaks, invariant by invariant:

| invariant | today | under A |
| --- | --- | --- |
| **Arena shape** | a per-thread list of `malloc`'d chunks anywhere in the address space (`runtime/runtime.c:97`, `:189`; one TLS arena with `-DNISH_THREADS`) | every chunk must come from one reserved range (32 GiB at 8-byte units) so one base serves every object. `nish_arena_grow` becomes a carve from an `mmap(PROT_NONE)` reservation. Threads must share the range, each carving its own chunks, because a worker's chunks are linked into the caller's arena on adoption (`nish_cross_adopt`, `runtime/runtime-cross.c`). |
| **Escape analysis** | a non-escaping class instance becomes an entry-block `alloca` (`src/escape.ts:1776` `analyzeEscapes`, `src/emit-classes.ts:105`) | a stack object has no offset. Holds only while a stack site's reference is never *stored*. A stored reference already makes the site escape to the arena, but that becomes a soundness rule the compressed mode depends on, not an optimisation, and needs a test. |
| **Attribute fixpoint** | pointer parameters carry `nonnull align 8 dereferenceable(N)`, `readonly`, `nocapture` (`src/attributes.ts`, header) | parameters stay pointers, so the facts stand. A decoded field is `nonnull` only behind the `select` that maps 0 to `null`. The decode must sit before the call, and `nocapture` must count an encode-and-store as a capture. |
| **TBAA** | struct-path nodes per class and field offset; every pointer scalar is spelled `ptr` (`src/tbaa.ts:28-34`) | a compressed field is an `i32` in memory. If its scalar node is plain `i32`, it may-aliases every `i32` field. It needs a scalar node of its own (`ref32`), and under LTO two modules must agree on that name. |
| **C ABI and interop headers** | `--emit-header` emits C `struct`s with class fields as `struct X *` (`src/interop-abi.ts:419`, `src/interop-header.ts`); N-API and the wasm loader read the same layouts | a field is a `uint32_t` that C cannot follow. Either every struct holding a reference goes opaque in the header, or the header exports a decode helper and the base, and every existing C consumer changes. A pointer *passed* to C is still a pointer. |
| **wasm32** | `p:32:32` (`src/target.ts:42`); a pointer is already 4 bytes | A buys nothing on wasm32 and must be a no-op there. (Found on the way: `src/debug.ts:366` gives `DW_TAG_pointer_type` `size: 64` on every target, which is wrong on wasm32.) |
| **Debug info** | class members are `DW_TAG_pointer_type` (`src/debug.ts:366`, `:381`) | a member becomes an integer gdb and lldb cannot follow. DWARF has no member-level decode expression. It needs a pretty-printer per debugger. |
| **Pointer hashing** | `Map` with class keys and parallel payloads use `ptrtoint` (`src/emit-map.ts`, `src/emit-parallel.ts`) | unchanged if they hash the decoded pointer. Must be checked one by one. |
| **Size limit** | none but the machine | 32 GiB of arena, in all threads together. Past it the program must panic, so the mode is opt-in and the compiler itself cannot assume it. |

`null` stays all-zero bits, so zero-filled arrays and fields stay valid. That
requires offset 0 to be reserved (the range's first 8 bytes never handed out).
`Arena.mark()`/`release` are addresses today and can stay so: they bracket
chunks, not fields.

A estimated: the runtime's arena rewritten, a load/store rewrite in the
emitter, new TBAA, header, debug and N-API rules, and a second mode for every
golden that the test matrix must carry. In return, about 0.75x memory on an
already-lean node (§1.3), and an unmeasured decode cost.

### Design B: `Pool<T>` in the library

A generic pool over arrays, in legal TypeScript, with no compiler change:

```ts
export class Pool<T> {
  items: T[]
  constructor() { this.items = [] }
  add(x: T): i32 { this.items.push(x); return this.items.length - 1 }
  at(i: i32): T { return this.items[i] }
}
```

This compiles today, and it is `records.ts` behind a method, measured at
1.28x `sibling`'s memory and up to 1.81x its climb time. The bench says what
a `Pool` would have to be to pay. It would be columns, not records, and
presized, with unchecked reads. A generic `Pool<T>` cannot be columns: a
column per field is a per-type struct of arrays, which today means writing it
out by hand (`columns.ts`'s `Tree`). B as a library therefore reduces to a
convention and a few helpers, not a type.

B costs no invariant: every handle is an `i32`, every array is an ordinary
Nish array, and Node runs it unchanged. Its costs are the source costs of §2.

## 4. Recommendation

1. **Build neither A nor a generic `Pool<T>` now.** Counting the arena's
   8-byte rounding moves A's estimate from 0.6x to 0.75x of `sibling`'s
   memory, which only weakens it: the same six invariants buy a quarter less
   memory, not two fifths, and A no longer reaches the bytes `columns` already
   gives without any compiler change. The verdict stands.
2. **Make the lean layout the port convention.** A ported AST node keeps first-
   child and next-sibling links (or, where a pass needs random access, a
   child count and a presized `Node[]` built once) instead of a growing
   `kids: Node[]` per node. Measured: 0.52x memory, 0.68x time, no compiler
   change, readable source, still legal TypeScript. This is the one result
   here with a big margin over every noise band.
3. **Use columns where a table is hot and closed** (token streams, type and
   symbol tables), written out per type. Measured: 0.32x `class`'s memory,
   0.63x its time at 4M nodes. Accept `uncheckedGet` in that code only.
4. **Revisit A when a port measures out of memory with lean layouts.** Its
   first step would be the arena on a reserved range (needed by A, cheap on
   its own, and measurable), then a decode cost measured on `sibling.ts`
   before any emitter change.

Two language gaps surfaced here and would make B much better without A. Each
is its own proposal:

- **A presized record array.** `new Array<Rec>(n)` with a zero record, or a
  `reserve`, would remove the growth garbage: `records` would drop from 41 to
  20 bytes a node.
- **A nominal `i32`.** A brand, or a `newtype`-like alias that erases to
  `i32` under Node, would make a handle typed at no cost. TypeScript's own
  spelling (`i32 & { __brand }`) would keep it legal TypeScript.

## 5. Unknowns

- A's decode cost. The 0.75x memory is counted, not run.
- How much of `class`'s 63 bytes a real AST pays. Its nodes have more fields
  than this tree's two, which dilutes every saving here, and some of them are
  strings, which A would not narrow.
- The noise on build time is wide (8 to 22%), so no build-time claim here is
  finer than `sibling` and `columns` being faster than `class`.
- One machine, a virtual one. The orders held at every size, but the ratios
  in cache are the most machine-specific.
