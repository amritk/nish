# WP48: 32-bit references for linked classes — designed and measured

**Status: proposed on 2026-11-17, for the owner to accept or decline.** Nothing
in the compiler, the runtime or `std/` changes with this note. It reopens
WP48, whose first note
([`docs/wp48-compressed-references.md`](https://github.com/amritk/nish/blob/d38a94b00543bd87481a6fa811ecc5802ba36d92/docs/wp48-compressed-references.md),
accepted 2026-11-11, removed in `b252107a`) declined a whole-program 32-bit
mode (its "Design A"). Its §4.4 said when to come back and in what order:
when a port written with lean layouts runs out of memory, put the arena on a
reserved range first, then measure the decode cost on
`bench/wp48-refs/sibling.ts` before any emitter work. This note does those two
steps and proposes a design narrower than Design A.
[LANGUAGE.md](LANGUAGE.md) stays normative.

## 1. Why reopen it

`bench/goose/` ports Goose's benchmarks, and two of them are a pointer tree
already in the lean layout the first note recommends: a node holds its value
and two links, with no array per node. Goose stores a link as a 32-bit index,
and Nish stores it as an 8-byte pointer:

| program | node, Nish | node, Goose | Nish RSS | Goose RSS | Goose/Nish time |
| --- | ---: | ---: | ---: | ---: | ---: |
| `tree.ts`, n = 24 (33.5M nodes) | 24 B | 12 B | 788 MB | 395 MB | 0.55 |
| `bintrees.ts`, n = 19 | 16 B | 8 B | 34 MB | 26.5 MB | 0.75 |

(`bench/goose/README.md`, measured on the same machine.) There is no layout
left to change in this source: an `i32` value and two links is the whole
node. The only way to close the gap is a narrower link. Rewriting the
benchmark into columns of `i32` indices would close it too, but that is the
"rewrite the bench to dodge the problem" this note is asked not to do. A user
porting an AST or an index tree hits the same wall.

## 2. The first note's bench, re-measured

`node bench/wp48-refs/run.mjs`, 9 rounds, at `8036aff1` (after arrays grow in
place, `4ce39a88`). At 4M nodes:

| layout | peak RSS | bytes/node | build ms | visit ms | climb ms | total vs class |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| class | 239.7 MB | 62.8 | 149.9 | 184.4 | 310.0 | 1.00x |
| class-copy | 239.7 MB | 62.8 | 145.9 | 182.1 | 304.2 | 0.97x |
| sibling | 123.5 MB | 32.4 | 80.6 | 131.6 | 210.0 | 0.66x |
| pool | 93.3 MB | 24.5 | 69.5 | 97.6 | 268.5 | 0.67x |
| records | 77.9 MB | 20.4 | 61.2 | 124.7 | 291.6 | 0.74x |
| columns | 77.8 MB | 20.4 | 66.3 | 90.5 | 173.4 | 0.51x |

Noise band (class against class-copy): total 2.0%, build 4.0%, visit 1.7%,
climb 3.9%. At 400k nodes sibling is 0.78x and columns 0.76x (band 9.4%); at
20k, sibling is 0.87x (band 4.4%).

What moved since the first note: `records` fell from 157.8 MB to 77.9 MB,
because in-place growth removed the growth garbage the first note blamed on
the missing presized record array. The order of the other layouts is
unchanged, and `sibling` is still the layout a port should write. Its 32 bytes
a node are three 8-byte links and two `i32`s, and the links are the part this
note narrows.

## 3. The design

### 3.1 Which classes are compact

The compiler picks them. A program says nothing, and a class is compact when
the compiler can see that narrowing it pays and nothing it can see forbids
it. What the compiler cannot see is how many instances a run will make, and
that is what decides whether a compact class is a win (a graph larger than
cache, §5) or a small loss (a graph in cache). The rule therefore asks for
the shape that the measured wins share: a small node that links to nodes,
made over and over.

A class `R` is compact when all of these hold:

1. **The output is a native executable** (`--link`, or `nish run`). A
   wasm32 build already has 4-byte pointers, so there is nothing to do. A
   build whose classes C or Node can see (`--emit-header`, `--emit-napi`,
   `--emit-napi-async`, a C library) is left alone, because a compact class
   is opaque to C (§4) and the range would be reserved inside a host process
   Nish does not own.
2. **Something links to `R`**: some class, `R` itself included, has a field
   typed exactly `R` or `R | null`.
3. **Narrowing saves memory on every instance**: `computeLayout` run both
   ways gives `R`, or the class holding the link, a smaller size after
   rounding. A class with one link among wide fields that rounding gives back
   is left alone, because it would pay the decode for nothing.
4. **`R` is made in a loop or in a recursive function**: some `new R(...)`
   is lexically inside a loop, or inside a function that can reach itself in
   the call graph. A class made once or a few times per run is left alone.
   Layout is fixed when classes are collected, before bodies are checked
   (`src/structs.ts:1070`), so this is a scan of the parsed bodies: a direct
   call by name is an edge, a call through a value is not, and a class whose
   only `new` sits behind one is left alone. A miss costs memory, not
   correctness.
5. **Nothing forbids it**: `R` is not, and is not a field of, a `declare
   class`; `R` does not hold a `Secret`; `R` is not exported in a C or N-API
   surface.

Two controls override the rule, both erased under Node and `tsc`:

```ts
import type { Compact, Wide } from "nish:compact"

class TNode implements Compact { /* compact even if the rule says no */ }
class Big implements Wide { /* never compact */ }
```

and `--compact off` turns the whole mechanism off for one build, which is
what to try first when a program hits the range's limit (§3.3) or runs
slower. `implements Compact` on a class that rule 1 or 5 refuses is a
compile error naming the reason. Each class the rule picks is listed by
`nish --explain-layout`, so the decision can be seen and checked.

Against the measured programs: `tree.ts`'s and `bintrees.ts`'s `TNode` are
made in a recursive build and shrink from 24 to 12 and 16 to 8 bytes, and
`sibling.ts`'s node is made in the build loop and shrinks from 32 to 20. The
rule picks all three with no source change.

The rule lands after the mechanism (§8): stage 2 builds compact classes with
`implements Compact` as the only way in, and stage 3 turns the rule on once
the corpus shows no program slower beyond its noise band. Until then a
program that does not write the marker is unchanged.

**Why not every class.** The compiler could narrow every class's links, and
that is the first note's Design A, measured and declined. Three costs stay
with any class narrowed: the decode on every link load (up to a quarter more
time on a pointer-chasing loop in cache, §5.1), the range's 15 GiB cap on
everything allocated beside the class (§3.3), and a fixed address a host
process may already hold. Each rule above drops a class that pays those for
no saving: one with no link, one rounding gives the bytes back, one made a
handful of times, one C or a `Secret` must see whole. What no rule can see is
the instance count, which only a run knows; that is why `Wide` and
`--compact off` exist. `class.ts`'s node also qualifies,
but its `kids: Node[]` is an array, which stage 2 does not narrow (§7).

### 3.2 What the compiler does with it

For a compact class `R`:

- **A field whose declared type is exactly `R` or `R | null`, in any class, is
  an `i32` in memory**: the address of the instance, in 4-byte units, as an
  offset into one reserved range. `null` is 0. That holds for `R`'s own links
  and for another class's field that points at an `R`. Nothing else is
  narrowed. Locals, parameters, returns, array elements (`R[]`), `Map` keys and
  values, union members other than `null`, and a generic's `T` stay full
  pointers.
- **A load decodes and a store encodes**, in `loadField` and `storeField`
  (`src/emit-classes.ts:82`, `:89`), the two helpers nearly every field access
  already goes through (§6 lists the ones that do not).
- **`R`'s instances are 4-byte aligned**, so a node of an `i32` and two links
  is 12 bytes, not 16. An instance is still allocated in the arena, by the
  same mark and release.
- **A program with no compact class is unchanged**, down to the byte: no IR
  moves, the runtime does not reserve a range, and no golden changes. The
  range and the alignment rule are switched on only by a compact class. A
  program the rule picks a class in does change, so the stage that turns the
  rule on carries `DECLARED` nish-cmp entries and regenerated goldens for
  the programs it moves.

The decode has two shapes, measured in §5:

| shape | decode | encode | range |
| --- | --- | --- | --- |
| zero-based | `inttoptr(zext(o) << 2)` (null maps to null with no test) | `ptrtoint(p) >> 2` | fixed at [1 GiB, 16 GiB), reserved with `MAP_FIXED_NOREPLACE` |
| based | `o == 0 ? null : base + 4 * o`, `base` loaded from `@nish_ref_base` under `!invariant.load` | `p == null ? 0 : (p - base) >> 2` | anywhere the OS puts it |

The zero-based shape is faster (§5) and needs a fixed address. If that address
is taken, the program stops with a diagnostic. The based shape runs anywhere.
§7 proposes zero-based where the platform allows it (Linux, Windows), and
based where it does not (macOS, whose `__PAGEZERO` takes the low 4 GiB).

### 3.3 The arena on a reserved range

When a program has a compact class, it reserves the range at startup
(`mmap(PROT_READ|PROT_WRITE, MAP_NORESERVE)`; pages are only committed when
they are touched). Every arena chunk of 2 MiB or less is carved from the range
instead of coming from `malloc`. That means the 64 KB floor chunks, a WP46
region's doubling chunks up to 1 MiB, and a worker's chunks. Carving uses
power-of-two size classes (4 KB to 2 MiB) with a free list per class, so a
released chunk is reused and the range does not creep. An exact chunk larger
than 2 MiB (a big array, a long string) stays on `malloc`. No instance can be
in one, because an exact chunk holds one allocation and nothing is bumped
into it after.

Marks are still addresses, release still walks chunks, and `keep`, regions
and `nish_cross_adopt` link chunks just as they do today. Only `nish_arena_grow`
(where a chunk comes from) and `nish_free_until` (where it goes back) change,
plus runtime-region.c:383's `free(head)`.

An instance must be 4-aligned and is rounded to 4. Every other allocation
must stay 8-aligned. Today every bump assumes `off` is 8-aligned and rounds
to 8, so in a compact program each ordinary bump first aligns `off` up to 8
(one add and one and). The bump sites are the inline `@nish_alloc_struct`
(`src/runtime.ts:1752`), runtime.c's `nish_alloc_struct`,
runtime-text.c:73's `nish_text_alloc`, runtime.c:610's in-place array
growth, runtime-cross.c:221 and :240, and runtime-wasm.c. A compact instance
gets its own inline bump (`@nish_alloc_ref`) that rounds to 4.

The range is 15 GiB of arena: all threads, all regions, everything but big
exact chunks. Running out is a panic that names the limit and the compact
classes. The limit is why the rule asks for a class made over and over and not
every class, and the panic names `--compact off`.

## 4. The invariants, one by one

The first note listed what Design A breaks. This is what the narrower design
does with each.

| invariant | Design A | this design |
| --- | --- | --- |
| **Arena shape** | every chunk from one 32 GiB range, every program | only programs with a compact class; chunks ≤ 2 MiB from a 15 GiB range, exact chunks stay on `malloc`. Prototyped in §5: `ptr-range` (unchanged IR on the range runtime) measures the same as `ptr`, within the band. |
| **Thread sharing** | threads share the range | the same. A worker carves its chunks from the shared range under the size-class lock (a chunk grab, not a bump, so the lock is cold). `nish_cross_adopt` links range chunks unchanged. A compact instance riding in a parallel task payload (`src/emit-parallel.ts:421-512`) stays a full pointer, because a payload slot is not a class field. |
| **Escape analysis** | a stack instance has no offset | a compact class is never promoted to the stack. `holdsNoPointerSlot` (`src/escape.ts:1893`) and the promotion site (`src/emit-classes.ts:105`) refuse it. That costs the promotion for that one class, which for a linked node rarely applied anyway (a node is stored, so it escapes). A test pins it. |
| **Alignment and attributes** | — | a compact instance is `align 4 dereferenceable(size)`, not `align 8`. `src/attributes.ts:1951` and `:7053-7073` read the class's alignment instead of assuming 8, and `src/attributes.ts:2465` and `src/emit.ts:~2334` stop assuming 8-byte rounding. A decoded link is `nonnull` only once it is tested. With the zero-based decode, `o != 0` and `p != null` are the same test, and LLVM folds it (§5's assembly). `nocapture` counts an encoding store as a capture, as it counts a pointer store today. |
| **TBAA** | a compressed field may-aliases every `i32` | a compressed field gets a scalar node of its own, `ref32`, under the root, beside `i32`. A store of a link then does not alias a store of an `i32` field. The struct-path nodes carry the new offsets (`src/tbaa.ts:110-142`). Prototyped in §5's IR. |
| **C ABI and headers** | every struct holding a reference changes for C | a class holding a compressed field is **opaque** in `--emit-header` output, the same way a `Map` or a `Secret` already is (`src/interop-header.ts:147-158`), and C holds it as a handle. A compact instance passed to or returned from C is a full pointer, so N-API and FFI signatures do not change. A `declare class` (a C layout) may not hold a compact field: that is a checker refusal. |
| **wasm32** | no-op | no-op. A wasm32 pointer is already 4 bytes, so a compact class compiles to exactly today's IR there: no range, no decode. Found on the way: `computeLayout` (`src/structs.ts:171`) gives a class's pointer field 8 bytes on wasm32 where LLVM's `p:32:32` lays out 4 (only a `declare class` is special-cased), so `info.size` over-allocates on wasm32 today. Stage 4 fixes that separately. |
| **Debug info** | a member gdb cannot follow | the same, but only for compact classes: the member is a `DW_TAG_base_type` `u32` named for what it is (`ref32 TNode`), and a debugger pretty-printer (gdb Python, an lldb formatter) in `tools/` decodes it. Decoded locals are ordinary pointers, so stepping through code that holds them shows them as today. `src/debug.ts:440-468`. |
| **Pointer hashing** | must hash the decoded pointer | a `Map` key or a `Set` element is never a compressed field (§3.2), so every `ptrtoint` in `src/emit-map.ts` and `src/emit-parallel.ts` already sees a full pointer. Nothing to change. A test pins a compact class as a `Map` key. |
| **Size limit** | 32 GiB, whole program | 15 GiB of small-chunk arena, only in programs that opt in. |
| **AddressSanitizer** | — | the ASAN runtime (`-DNISH_ASAN`) mallocs every block, which a range cannot hold. Compression is a layout change with the same behaviour, so the ASAN build compiles compact classes uncompressed. The differential ASAN run tests the program's behaviour, not its layout. |
| **Persistent roots (WP55)** | — | WP55's root slots exist on wasm32 only, where nothing is compressed. On a native target a root slot is a full pointer, not a class field. |
| **JSON, `structuredClone`, copies** | — | the JSON encoders and decoders go through `loadField`/`storeField`. A whole-struct copy (`emitStructCopy`, `src/emit-arrays.ts:1050`'s record memcpy) copies the encoded bytes, which stay valid because the offset is absolute within the range, not relative to the object. |

`null` is all-zero bits in both shapes, so zero-filled fields stay valid. The
range's first 64 bytes are never handed out, which keeps offset 0 free for
`null`.

## 5. Measurements

A prototype on the generated IR, not in the compiler: a throwaway script (not committed) takes the
`.ll` that `build/nish` emits for a program and rewrites one class's link
fields to `i32` with the decode and encode at each load and store. It also
sets `align 4` and the new `dereferenceable`, adds the `ref32` TBAA node, and
replaces the class's allocation with a 4-rounding inline bump. The runtime is
patched with the range allocator of §3.3. Each binary links with
`scripts/build.sh … --profile speed`, which for the unmodified IR is
byte-identical to `build/nish --link`. Every variant prints the same output as
the stock binary. Two layouts per decode shape separate the decode's cost
from the memory it saves:

- **compact**: the class is all `i32`, so `tree.ts`'s node is 12 bytes.
- **padded**: the links are `i32`, but the node keeps its old size and
  offsets. Only the decode differs from `ptr`, not the bytes.

`ptr` is the stock binary, `ptr-copy` a copy of it (the noise band), and
`ptr-range` the stock IR on the range runtime (the cost of §3.3 alone).
9 rounds per size, the variants shuffled in every round, each run in a fresh
process under `bench/rss.c`. One virtual 4-core machine.

### 5.1 `bench/wp48-refs/sibling.ts`

At 4,000,000 nodes, 4 walks of each kind:

| variant | peak RSS | build ms | visit ms | climb ms | wall vs ptr |
| --- | ---: | ---: | ---: | ---: | ---: |
| ptr | 123.5 MB | 81.0 | 133.4 | 208.3 | 1.00x |
| ptr-copy | 123.5 MB | 75.6 | 129.0 | 202.9 | 0.97x |
| ptr-range | 123.7 MB | 79.4 | 132.0 | 199.0 | 0.96x |
| zero-padded | 123.7 MB | 78.0 | 133.0 | 255.2 | 1.10x |
| based-padded | 123.7 MB | 84.3 | 131.6 | 257.9 | 1.13x |
| **zero-compact** | **77.9 MB** | 58.8 | 103.9 | 227.1 | **0.91x** |
| based-compact | 77.9 MB | 60.0 | 106.3 | 218.0 | 0.88x |

Noise band: wall 3.5%, build 6.6%, visit 3.3%, climb 2.6%.

At 400,000 nodes, 25 walks:

| variant | peak RSS | build ms | visit ms | climb ms | wall vs ptr |
| --- | ---: | ---: | ---: | ---: | ---: |
| ptr | 13.7 MB | 8.1 | 61.8 | 109.2 | 1.00x |
| ptr-copy | 13.7 MB | 8.4 | 55.7 | 98.0 | 0.90x |
| ptr-range | 13.8 MB | 7.6 | 57.3 | 98.3 | 0.89x |
| zero-padded | 13.8 MB | 7.4 | 62.0 | 130.4 | 1.11x |
| based-padded | 13.8 MB | 7.9 | 63.7 | 135.6 | 1.15x |
| **zero-compact** | **9.2 MB** | 5.6 | 54.7 | 125.4 | **1.02x** |
| based-compact | 9.2 MB | 7.3 | 57.3 | 135.9 | 1.11x |

Noise band: wall 10.2%, visit 10.0%, climb 10.3%. This machine's band is
wide at this size. An earlier run of the same binaries, contaminated by a
second run on another core and so not tabled, gave the same order: zero-padded
climb +27%, zero-compact wall 1.10x.

### 5.2 `bench/goose/tree.ts` and `bintrees.ts`

`tree.ts` at n = 24 (33.5M nodes, the README's size), 9 rounds, one run per
variant per round:

| variant | peak RSS | wall ms | wall vs ptr |
| --- | ---: | ---: | ---: |
| ptr | 769.8 MB | 2147.5 | 1.00x |
| ptr-copy | 769.8 MB | 2140.7 | 1.00x |
| ptr-range | 769.6 MB | 2137.3 | 1.00x |
| zero-padded | 769.6 MB | 2180.6 | 1.02x |
| based-padded | 769.6 MB | 2175.4 | 1.01x |
| **zero-compact** | **385.5 MB** | **1304.0** | **0.61x** |
| based-compact | 385.5 MB | 1532.9 | 0.71x |

Noise band: wall 0.3%. (`bench/rss.c` reads 769.8 MB where the Goose README's
`/usr/bin/time` reads 788 MB. The README's Goose figures are 395 MB and
1437 ms. Goose was not rebuilt for this note, so those two figures are not
from the same rounds.)

`bintrees.ts` at n = 19, 9 rounds:

| variant | peak RSS | wall ms | wall vs ptr |
| --- | ---: | ---: | ---: |
| ptr | 33.2 MB | 556.8 | 1.00x |
| ptr-copy | 33.2 MB | 586.0 | 1.05x |
| ptr-range | 33.5 MB | 565.1 | 1.02x |
| zero-padded | 33.5 MB | 573.4 | 1.03x |
| based-padded | 33.5 MB | 562.0 | 1.01x |
| **zero-compact** | **17.5 MB** | 523.1 | 0.94x |
| based-compact | 17.5 MB | 548.3 | 0.98x |

Noise band: wall 5.3%. Its trees are small and short-lived, so the time is
allocation and release, and the decode is lost in the band.

### 5.3 What the numbers say

- **The range costs nothing.** `ptr-range` is within the band of `ptr` at
  every size. Step one of §4.4 is free on its own.
- **Memory is the win, and it is the whole of the arithmetic.** Sibling's node
  drops from 32 to 20 bytes: 0.63x RSS. `tree.ts`'s node drops from 24 to
  12 bytes: 0.50x RSS, 385.5 MB, which is under Goose's 395 MB in the README.
  `bintrees.ts` drops from 16 to 8 bytes: 0.53x RSS.
- **The decode has a cost, and it is on dependent loads.** On `sibling.ts`
  the padded variants move no bytes and are 10 to 15% slower overall. Almost all of that
  is `climb`, a parent-chasing loop where each load's address is the last
  load's result. In the zero-based shape the hop is `movl 8(%rdi), %eax;
  leaq (,%rax,4), %rdi` where `ptr` has `movq 8(%rdi), %rdi`: one extra
  address-generation step on every link of the chain, about +25% on that loop.
  `visit` reads a link and then a few fields through it, and its decode cost
  is in the band. The based shape adds a test and an add, and is slower than
  zero-based wherever the two differ by more than the band.
- **Out of cache the memory wins, in cache the decode wins.** At 4M nodes the
  compact layout's smaller working set outweighs the decode: 0.88x to 0.91x
  wall. `tree.ts` is the far end of that: 33.5M nodes touched once each, and
  the padded variants are level with `ptr`, so zero-compact's 0.61x is all
  bytes not moved: 1304 ms from 2147 ms, against the README's 1437 ms for
  Goose (not run in these rounds). At 400k the tree fits in the last-level cache, and zero-compact is
  level with `ptr` (1.02x, band 10%) while based-compact is slower. The win
  this design buys is memory, plus time on graphs larger than cache. It does
  not make a small graph faster, which is why the rule asks for repeated
allocation and `Wide` can refuse it.

## 6. Where the emitter changes

From a survey of `src/` at `8036aff1`.

**Covered by the shared helpers**, once `loadField`, `storeField` and
`fieldLLVMType` (`src/emit-classes.ts:82`, `:89`, `:614`) learn the encoding:
`src/emit-classes.ts` 187, 250, 270, 374, 478 and 482; the JSON emitters in
`src/emit-json.ts`; `src/emit-parallel.ts` 724, 762 and 886.

**Spell field access themselves**, so each needs a look:

- `src/emit-classes.ts:487-507`, compound `op=` (numeric fields only, so a
  link cannot reach it; this needs a test, not code)
- `src/emit-parallel.ts:1038`, `senderStateIn`, which loads a `Channel` class
  pointer (not compact, so a test)
- `src/emit-secret.ts:91-95`, the wipe's payload load (a `Secret` is never
  compact, so a refusal and a test)
- `src/emit-arrays.ts:1050`, the record memcpy; `arenaObject`,
  `emitStructCopy`, `emitNew` (they read `info.size` and `info.align`, which
  `computeLayout` sets)
- `src/emit-root.ts:203-217`, `writeTrace` (wasm32 only, nothing compressed)
- `src/tbaa.ts:110-142`, `src/debug.ts:440-468`
- `src/attributes.ts:1951`, `:2465`, `:7053-7073`, and `src/emit.ts:~2334`
- `src/interop-header.ts:200-216`, `src/interop-abi.ts:627`

**Layout is computed in one place**: `computeLayout` (`src/structs.ts:167-189`),
called from `src/structs.ts:1070`, `:1186` and `src/inline-arrays.ts:895`. A
compressed field is 4 wide and 4 aligned there, and the struct body built in
`structTypeDeclarations` (`src/emit-classes.ts:526`) spells it `i32`.

The decoded pointer's type stays `%struct.R*` everywhere past the load, so the
expression emitter, the checker's flow typing and every caller of a method
see the same types as today.

## 7. Open decisions

1. **Accept or decline.** Accepting buys 0.5x memory on a 3-field node (12
   against 24 bytes) and 0.63x on sibling, for a decode that costs up to a
   quarter more time on a pointer-chasing loop while the graph is in cache.
2. **Who decides.** The rule of §3.1 by default, with `implements Compact`
   and `implements Wide` from `nish:compact` to force or refuse it and
   `--compact off` per build (proposed), against markers only (every program
   that wants the saving edits its source). The spellings are open: legal
   TypeScript, erased by Node, visible at the class.
3. **The decode shape.** Zero-based on Linux and Windows, based on macOS
   (proposed), or based everywhere (one shape and no fixed address, slower).
4. **What is narrowed.** Fields only (proposed for stage 2). `R[]` elements
   would halve a children array too, but an array of compact references is a
   new element type for every array builtin. Proposed as a later stage behind
   its own measurement.
5. **The range's size.** 15 GiB in 4-byte units, zero-based from 0. With
   8-byte units the range could be 32 GiB, but a 12-byte node would round to
   16 bytes and the `tree.ts` win would be gone. Proposed: 4-byte units.
6. **A busy fixed address.** When the range cannot be reserved (another
   mapping holds it), the program panics before `main` naming
   `--compact off` (proposed), or falls back to the based shape at a
   cost measured in §5.2 (0.71x against 0.61x on `tree.ts`).

## 8. Stages

1. **The arena on a reserved range**, behind a runtime switch the compiler
   sets when a compact class exists. No IR change for any program yet. Covers
   size-class carving, regions, workers, `keep`, the 8-byte realign at every
   bump site, the exhaustion panic, and the runtime unit test under ASan and
   UBSan. `ptr-range` is the gate: it must stay within the band of `ptr`.
2. **The emitter**: `implements Compact` in the checker, `computeLayout` and the struct
   body, `loadField`/`storeField`, `@nish_alloc_ref`, attributes, TBAA, the
   refusals (`declare class`, `Secret`, stack promotion), the opaque header,
   debug info, and the ASAN build uncompressed. Ships with the construct
   checklist: golden `.ll`, `llvm-as`, a native round trip, negative tests,
   the `docs/LANGUAGE.md` rule, a cookbook entry, a guide page.
   Gate: `tree.ts` at n = 24 within 5% of the prototype's RSS and time.
3. **The rule**: §3.1's five tests, `implements Wide`, `--compact off` and
   `--explain-layout`. Gate: the nish-cmp corpus and `bench/goose` built
   both ways, no program slower beyond its noise band and every picked class
   smaller; the programs it moves carry `DECLARED` entries and regenerated
   goldens.
4. **Ports**: the `bench/goose` tree programs, `bench/wp48-refs/sibling.ts`
   and the guide's memory page say what the rule picks and when to override
   it.
5. **wasm32 layout**: `computeLayout`'s 8-byte class pointer slot on wasm32
   becomes 4 (a separate fix this survey found, independent of 1 to 4).
