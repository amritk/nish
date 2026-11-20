# WP48: 32-bit references for linked classes — designed and measured

**Status: accepted on 2026-11-17 (§7).** Stage 1, the arena on a reserved
range, is in the runtime (§3.3, measured in §5.4); no program selects it until
stage 2's emitter. It reopens
WP48, whose first note
([`docs/wp48-compressed-references.md`](https://github.com/amritk/nish/blob/d38a94b00543bd87481a6fa811ecc5802ba36d92/docs/wp48-compressed-references.md),
accepted 2026-11-11, removed in `b252107a`) declined a whole-program 32-bit
mode (its "Design A"). Its §4.4 said when to come back and in what order:
when a port written with lean layouts runs out of memory, put the arena on a
reserved range first, then measure the decode cost on
`bench/wp48-refs/sibling.ts` before any emitter work. This note does those two
steps and proposes a design narrower than Design A.
[LANGUAGE.md](LANGUAGE.md) stays normative.

**Where the measurements were taken.** The figures were taken on the
branch that added `bench/goose/` and made arrays grow in place, both now on
`main`. §2's `pool` and `records` figures need
the in-place growth.

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
   build whose classes Node can see (`--emit-napi`, `--emit-napi-async`, also
   beside `--emit-header`) or a C library another process loads is left
   alone, because the range would be reserved inside a host process Nish
   does not own. An `implements Compact` class is refused there (NL4021, and
   NL4020 at an export's signature). Since stage 2c a `--emit-header` build
   whose C host is the process is not refused: the header keeps every class
   holding a link opaque (§4), the host holds an instance as a `struct X *`
   handle, the runtime is the range runtime (`-DNISH_ARENA_RANGE`), and a
   runtime built without it lacks `nish_arena_range_abi`, so a program fails
   to link as soon as a module whose links are offsets allocates: both
   inline bumps name the symbol there, so an 8-aligned compact class does
   too. A module that allocates nothing names nothing. A busy range address
   is the start-up panic every range build has. The automatic rule
   (`src/compact-rule.ts`, test 1) still leaves a header build alone.
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
   surface. This test is the automatic rule's: an `implements Compact` class
   may cross `--emit-header` as an opaque handle (rule 1).

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
the chunks of 2 MiB or less everything beside the class takes (§3.3), and a fixed address a host
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
§7 takes zero-based where the platform allows it (Linux, Windows), and
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
and `nish_cross_adopt` link chunks just as they do today. What changes is
where a chunk comes from (`nish_arena_grow`) and where it goes back
(`nish_free_until`, and the drop in runtime-region.c's `nish_region_adopt`);
the as-built list below gives the rest: the reservation, the five realigns,
the RT-58 guard in `nish_array_grow_here` and the `--debug-arena` changes.

An instance must be 4-aligned and is rounded to 4. Every other allocation
must stay 8-aligned. Today every bump assumes `off` is 8-aligned and rounds
to 8, so in a compact program each ordinary bump first aligns `off` up to 8
(one add and one and). The bump sites are the inline `@nish_alloc_struct`
(`src/runtime.ts:1752`), runtime.c's `nish_alloc_struct`,
runtime-text.c:73's `nish_text_alloc`, runtime.c:610's in-place array
growth, runtime-cross.c:221 and :240, and runtime-wasm.c. A compact instance
gets its own inline bump (`@nish_alloc_ref`) that rounds to 4.

The range is 15 GiB of arena: all threads, all regions, every chunk but one
past 2 MiB, which stays on `malloc`. Running out is a panic that names the limit. The limit is why
the rule asks for a class made over and over and not every class.

**As built in stage 1** (`-DNISH_ARENA_RANGE`, runtime.c's "The compact-class
range"; the record is `docs/security/runtime.md`, "The compact-class range"):

- `scripts/build.sh --arena-range` adds the define. It has no user CLI flag:
  the compiler passes it when `hasCompactClass` (src/compile.ts) is true,
  which no program is until stage 2, and the run cache keys the variant. The
  wasm, wasi and napi profiles refuse it. The runtime defines
  `nish_arena_range_abi`, so IR that needs the range fails to link against a
  runtime without it.
- On Linux the range is `mmap(0x40000000, 15 GiB, MAP_FIXED_NOREPLACE |
  MAP_NORESERVE)`, once, from a constructor. `EEXIST`, or a kernel that
  maps elsewhere because it treats the address as a hint (that mapping is
  unmapped), is the panic "cannot reserve its 15 GiB range at 0x40000000
  (1 GiB to 16 GiB): the address is in use"; any other error (`ENOMEM`: an
  address-space or mapping limit) is the same panic ending "the system
  refused the mapping (an address-space or mapping limit)". Both come before
  `main`. `MAP_FIXED` is
  never used. Elsewhere (macOS) the system places it. `nish_ref_base` holds
  the base wherever the range is reserved; under `NISH_ASAN` nothing is
  reserved and it stays null. The first 64 bytes are never handed out.
- A chunk's class is its `cap` rounded up to a power of two from 4 KiB to
  2 MiB, with the 16-byte header in front of it. A take pops the class's free
  list, or bumps the high-water mark. A drop (`nish_free_until`, and
  runtime-region.c's adopt) pushes a range chunk onto its list and frees any
  other chunk with `free`, told apart by address. One spin lock covers the
  lists and the mark. The panic on exhaustion is "nish: the compact-class
  arena's 15 GiB range is used up".
- The realign is in runtime.c's `nish_alloc_struct` and `nish_arena_keep`,
  runtime-text.c's `nish_text_alloc`, runtime-cross.c's `nish_cross_in` and
  the carve in runtime-region.c's `nish_region_adopt`: these place a new
  block at an offset compiled code may have left 4 past an 8-byte boundary,
  and each rounds it up to 8 first. The other sites that set an offset start
  a chunk (`nish_arena_grow`, `nish_cross_link`), rewind to a chunk's start
  or a mark (`nish_reset_arena`, `nish_arena_release`), or swap a whole
  arena (`nish_region_swap`); a block the runtime places after any of them
  comes from one of the five, which realign.
  `nish_cross_keep` bumps only its own transfer blocks, in 8-byte multiples,
  and needs none. The in-place array growth of PR #1697
  (`nish_array_grow_here`), now on main, hands out no new block: its bump
  lengthens the array that ends at the offset by an 8-byte multiple, and its
  `realloc` never touches a chunk the range owns (RT-58). runtime-wasm.c is unchanged and never gets the
  define. The inline bump in `src/runtime.ts` is unchanged: stage 2 adds
  `@nish_alloc_ref` and the realign together.
- `--debug-arena` with the range makes the debug reservation the range
  itself (`PROT_NONE`, opened page by page), so its never-reuse rule holds
  and a stale reference still faults. Its exhaustion message names the
  15 GiB limit. `NISH_ASAN` wins over both: it reserves nothing,
  `nish_ref_base` stays null, and the ABI symbol is still defined.
- The 4 KiB class floor costs memory where many regions each hold one small
  first chunk. `region_sessions_soak` (1000 live regions) holds about
  4.6 MB of anonymous memory with the range, against about 762 KB (761,856 bytes) without it,
  and prints the same output. A program with a compact class makes that class
  over and over, so its chunks are not that small. The cost grows with live
  regions, though: each region's first chunk, and each recycled async task's
  (runtime-async.c sets `nish_region_chunk = 8`), takes a whole 4 KiB class
  where it was a `malloc` of about the request, so 100,000 small live
  regions would commit hundreds of MB. Not measured; stage 2, which first
  selects the range, weighs it.

## 4. The invariants, one by one

The first note listed what Design A breaks. This is what the narrower design
does with each.

| invariant | Design A | this design |
| --- | --- | --- |
| **Arena shape** | every chunk from one 32 GiB range, every program | only programs with a compact class; chunks ≤ 2 MiB from a 15 GiB range, exact chunks stay on `malloc`. Prototyped in §5: `ptr-range` (unchanged IR on the range runtime) measures the same as `ptr`, within the band. |
| **Thread sharing** | threads share the range | the same. A worker carves its chunks from the shared range under the size-class lock (a chunk grab, not a bump, so the lock is cold). `nish_cross_adopt` links range chunks unchanged. A compact instance riding in a parallel task payload (`src/emit-parallel.ts:421-512`) stays a full pointer, because a payload slot is not a class field. |
| **Escape analysis** | a stack instance has no offset | a compact class is never promoted to the stack. `holdsNoPointerSlot` (`src/escape.ts:1893`) and the promotion site (`src/emit-classes.ts:105`) refuse it. That costs the promotion for that one class, which for a linked node rarely applied anyway (a node is stored, so it escapes). A test pins it. |
| **Alignment and attributes** | — | a compact instance is `align 4 dereferenceable(size)`, not `align 8`. `src/attributes.ts:1951` and `:7053-7073` read the class's alignment instead of assuming 8, and `src/attributes.ts:2465` and `src/emit.ts:~2334` stop assuming 8-byte rounding. A decoded link is `nonnull` only once it is tested. With the zero-based decode, `o != 0` and `p != null` are the same test, and LLVM folds it (§5's assembly). `nocapture` counts an encoding store as a capture, as it counts a pointer store today. |
| **TBAA** | a compressed field may-aliases every `i32` | a compressed field gets a scalar node of its own, `ref32`, under the root, beside `i32`. A store of a link then does not alias a store of an `i32` field. The struct-path nodes carry the new offsets. Landed in stage 2b (`ref32Node` and `fieldScalar` in `src/tbaa.ts`); two tags that both name a class are told apart by the class path whatever their scalars, so the node decides only once LLVM merges link stores through two classes into one store tagged with the bare scalar. `tests/cases/compact_tbaa.ts` pins that case: after `simplifycfg` sinks the two stores, `gvn` forwards an `i32` field and a pointer field across the merged store, and renaming the node to `i32` or `ptr` keeps the matching reload (`tests/run.js`, "compact tbaa"). `--plain` reloads both. |
| **C ABI and headers** | every struct holding a reference changes for C | a class holding a compressed field is **opaque** in `--emit-header` output, the same way a `Map` or a `Secret` already is (`holdsLink` in `src/interop-header.ts`): the compact class itself, any class with a field narrowed to `i32`, and an instantiation such as `Box<Cell>`. C holds it as a handle. A compact instance passed to or returned from C is a full `struct X *`, so FFI signatures do not change. Done in stage 2c, with a C host round trip in `tests/run.js` ("compact header"). N-API stays refused (NL4020, NL4021), also beside `--emit-header`: an addon runs in Node's process. Out of scope: a header build linked into a shared library another process loads. A `declare class` (a C layout) may not hold a compact field: that is a checker refusal. |
| **wasm32** | no-op | no-op. A wasm32 pointer is already 4 bytes, so a compact class compiles to exactly today's IR there: no range, no decode. Found on the way: `computeLayout` (`src/structs.ts:171`) gives a class's pointer field 8 bytes on wasm32 where LLVM's `p:32:32` lays out 4 (only a `declare class` is special-cased), so `info.size` over-allocated on wasm32. Stage 6 fixed that separately: `computeLayout` now gives a pointer field 4 bytes on wasm32, so a class's size, alignment and field offsets there are LLVM's own. |
| **Debug info** | a member gdb cannot follow | the same, but only for compact classes: the member is a `DW_TAG_typedef` named for what it is (`ref32 TNode`) over `unsigned int` (a typedef, not a renamed base type, because lldb shows a base type by its encoding and drops the name), and a debugger pretty-printer in `tools/` decodes it: `tools/gdb/ref32.py` (a printer and `$ref32(link)`) and `tools/lldb/ref32.py` (a summary and a synthetic child provider). Each picks the zero-based or based decode from the inferior's OS ABI or triple, as `zeroBasedLinks` does, with an override. Decoded locals are ordinary pointers, so stepping through code that holds them shows them as today. Landed in stage 2b (`linkType` in `src/debug.ts`); `tests/run.js` walks a list to `null` in both debuggers on Linux. |
| **Pointer hashing** | must hash the decoded pointer | a `Map` key or a `Set` element is never a compressed field (§3.2), so every `ptrtoint` in `src/emit-map.ts` and `src/emit-parallel.ts` already sees a full pointer. Nothing to change. A test pins a compact class as a `Map` key. |
| **Size limit** | 32 GiB, whole program | 15 GiB of arena for chunks of 2 MiB or less, only in programs the compiler gives a compact class (§7, decision 2). |
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

Stage 2b's `ref32` TBAA node, measured on `tree.ts` (compact) at n = 24:
the IR linked with the node and with it renamed to `i32` (so a link
may-aliases an `i32` again) builds byte-identical binaries, peak RSS
394652 KB each: the node changes nothing LLVM does to `tree.ts`, so its time
and memory cannot move. `tests/cases/compact_tbaa.ts` is a case the node does
fold.

### 5.3 What the numbers say

- **The range's cost is inside the band.** `ptr-range` is within the band of
  `ptr` at every size, which bounds its cost at the band, not at zero; §5.4's
  `sibling.ts` runs, of the runtime before #1697 merged in (39064a03), put it at
  −2.8% and +1.0%, and the `tree.ts` run at this stage's head, the gate
  evidence for the runtime as merged, at +2.5%. Step one of §4.4 costs nothing this run can tell apart
  from noise.
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

### 5.4 Stage 1's runtime, measured

The runtime of §3.3 as built, not the prototype's patch:
[`bench/wp48-refs/range.mjs`](../bench/wp48-refs/range.mjs) compiles
`sibling.ts` once with the seed in `build/seed` (nish 0.41.0 for every run
below; main has since released 0.42.0) and links that one module three ways at
`--profile speed`: `ptr` on the default runtime, `ptr-copy` a copy of it, and
`ptr-range` with `scripts/build.sh --arena-range`. All three print the same
checksum. The variants run shuffled in every round, each in a fresh process
under `bench/rss.c`, on one virtual 4-core machine, 2026-11-17. These
`sibling.ts` runs are of the pre-merge head's runtime (39064a03, unchanged
since 79493153, which recorded them), before the in-place
array growth (#1697) and RT-58's guard; `bench/goose/tree.ts`, below, was run
after them, and it is the gate evidence at this stage's head.

The protocol was fixed before the run: 21 rounds at both sizes; "wall" is
build + visit + climb, the program's own timers, not the process's lifetime;
a figure is the median over the rounds; the band is the widest per-round gap
between `ptr` and `ptr-copy`, the same binary, over all 21 rounds; the verdict
is whether `ptr-range`'s median wall lies within that band of `ptr`'s. In the tables,
"wall vs ptr" is the median of a variant's per-round totals over `ptr`'s; each
component column is a median of its own, so the components need not sum to
it. The command, from the repository root, at the pre-merge head:

```sh
NISH=build/seed/bin/nish node bench/wp48-refs/range.mjs --rounds 21 --sizes 400000,4000000
```

At 400,000 nodes, 25 walks of each kind:

| variant | peak RSS | build ms | visit ms | climb ms | wall vs ptr |
| --- | ---: | ---: | ---: | ---: | ---: |
| ptr | 13.7 MB | 7.7 | 58.2 | 103.9 | 1.00x |
| ptr-copy | 13.7 MB | 7.9 | 58.4 | 103.0 | 1.03x |
| ptr-range | 13.8 MB | 7.9 | 58.5 | 98.7 | 0.97x |

Band: build 29.5%, visit 22.1%, climb 28.2%, wall 24.8%. Verdict: `ptr-range`
wall −2.8% against `ptr`, within the band.

At 4,000,000 nodes, 4 walks of each kind:

| variant | peak RSS | build ms | visit ms | climb ms | wall vs ptr |
| --- | ---: | ---: | ---: | ---: | ---: |
| ptr | 123.5 MB | 79.6 | 126.0 | 209.8 | 1.00x |
| ptr-copy | 123.5 MB | 79.6 | 126.6 | 208.6 | 1.00x |
| ptr-range | 123.7 MB | 81.8 | 127.7 | 204.8 | 1.01x |

Band: build 19.1%, visit 16.3%, climb 15.2%, wall 15.1%. Verdict: `ptr-range`
wall +1.0% against `ptr`, within the band.

The gate passes at both sizes: the range's cost is not told apart from the
noise of running one binary twice, and peak RSS moves by 0.2 MB at most. The
band is wide (one virtual machine, a round's worst gap), so the run bounds the
cost at no more than that band, not at zero. These two runs predate the
median band `range.mjs` now prints beside the widest, and their per-round
gaps were not kept, so they have no median-band verdict; the `tree.ts` run
below has both. An earlier run with a median
band and unequal rounds is superseded by this one. That was stage 1's gate before the merge; at this stage's head the gate is
the `tree.ts` run: +2.5%, inside its widest band (16.8%) and its median band
(3.5%).

`bench/goose/tree.ts`, after #1697 merged and with RT-58's guard, at the
stage's head, under the same protocol: 21 rounds at depth 24 (33,554,431
nodes), the program built at that depth from its `bench:n` line. It has no
timers, so "wall" is the process's lifetime under `bench/rss.c`. The same run
gives the median of the per-round gaps beside their widest:

```sh
NISH=build/seed/bin/nish node bench/wp48-refs/range.mjs --program tree --rounds 21 --sizes 24
```

| variant | peak RSS | wall ms | wall vs ptr |
| --- | ---: | ---: | ---: |
| ptr | 769.8 MB | 2123.6 | 1.00x |
| ptr-copy | 769.8 MB | 2131.8 | 1.00x |
| ptr-range | 769.7 MB | 2175.7 | 1.02x |

All three print 33554431 and 134079322148. Band: widest per-round gap 16.8%,
median per-round gap 3.5%. Verdict: `ptr-range` wall +2.5% against `ptr`,
within the widest band and within the median band. Peak RSS moves by 0.1 MB.

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
- `src/tbaa.ts` and `src/debug.ts` (done in stage 2b: `fieldScalar` and `linkType`)
- `src/attributes.ts:1951`, `:2465`, `:7053-7073`, and `src/emit.ts:~2334`
- `src/interop-header.ts:200-216`, `src/interop-abi.ts:627` at `8036aff1`;
  since stage 2c the header's handling is `holdsLink` and the opaque branch
  of `structDefinitions` (`src/interop-header.ts:199-245`), and the refusals
  are `refuseCompactSidecars` (`src/interop-abi.ts:1340`)

**Layout is computed in one place**: `computeLayout` (`src/structs.ts:167-189`),
called from `src/structs.ts:1070`, `:1186` and `src/inline-arrays.ts:895`. A
compressed field is 4 wide and 4 aligned there, and the struct body built in
`structTypeDeclarations` (`src/emit-classes.ts:526`) spells it `i32`.

The decoded pointer's type stays `%struct.R*` everywhere past the load, so the
expression emitter, the checker's flow typing and every caller of a method
see the same types as today.

## 7. Decisions

The owner decided all six on 2026-11-17:

1. **Accept or decline: accepted.** It buys 0.5x memory on a 3-field node (12
   against 24 bytes) and 0.63x on sibling, for a decode that costs up to a
   quarter more time on a pointer-chasing loop while the graph is in cache.
2. **Who decides: the compiler.** It picks compact classes by the rule of
   §3.1. `implements Compact` and `implements Wide` from `nish:compact` force
   or refuse it at the class. `--compact off` per build stays proposed, for
   stage 3. The spellings are legal TypeScript, erased by Node, visible at
   the class.
3. **The decode shape: zero-based on Linux and Windows, based on macOS.**
   Nish has no Windows target today; Windows takes the zero-based shape when
   it has one.
4. **What is narrowed: fields only.** No locals and no arrays. `R[]` elements
   would halve a children array too, but an array of compact references is a
   new element type for every array builtin.
5. **The range's size: 4-byte units, a 15 GiB range at [1 GiB, 16 GiB).**
   With 8-byte units the range could be 32 GiB, but a 12-byte node would
   round to 16 bytes and the `tree.ts` win would be gone.
6. **A busy fixed address: a panic before `main`**, naming the address and
   the limit. There is no fallback to the based shape (0.71x against 0.61x on
   `tree.ts`, §5.2), because compiled code treats the base as a constant.

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
5. **Inside Nish**: where the compiler and `std/` gain from compact
   classes. The compiler is a native executable built by the seed, so once a
   release ships the rule, its own linked classes (AST and type nodes,
   scopes, the call graph) are picked with no source change. `std/` classes
   compile into user programs and are picked by the same rule there. The
   stage is a survey of both: `nish --explain-layout` over `src/` and over
   the nish-cmp corpus's `std/` imports, the classes picked and the ones
   left wide, and for each its measured effect (the compiler's peak RSS and
   time on a self-build, and the `std/` benches). A class the rule misses
   that measures faster compact gets `implements Compact`, and one it picks
   that measures slower gets `implements Wide`. Under the rolling freeze,
   `src/` can write either marker only after the release that ships it.
   `std/net` and `std/crypto` classes stay wide where C sees them or they
   hold a `Secret`, which rule 5 already refuses.
6. **wasm32 layout**: `computeLayout`'s 8-byte class pointer slot on wasm32
   becomes 4 (a separate fix this survey found, independent of 1 to 5).
