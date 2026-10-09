# WP15 — Performance first

**Status: closed.** Every item on the §9 list has shipped or was closed by a
measurement. The last open one, item 1b, landed in two halves: the emitter's
header hoist (#104, 0.4.0) and property-path bounds facts (#179, 0.9.0). Item 8
became WP18 ([wp18-generics.md](wp18-generics.md)). One decision has since been
reversed: §3 made signed overflow `nsw` undefined behaviour by default, and #426
made it a checked panic instead.

The project's northern star is **the fastest binary we can emit**, with
**binary size second**. This note records the decisions that follow from that
ordering and the measurements behind them. [LANGUAGE.md](LANGUAGE.md) stays
normative for what the language *is*. The lowerings are in
[IR_COOKBOOK.md](IR_COOKBOOK.md), and the current timings are in
[BENCHMARKS.md](BENCHMARKS.md) and `bench/README.md`. Where this note and
`docs/wp14-selfhost.md` disagree about priority, this note wins: a self-hosted
compiler that emits slower code is not the goal.

---

## 1. The rule

When a language decision has two defensible answers, the faster lowering wins,
and "faster" means **measured**, not assumed. When the choice is not obvious,
read the generated assembly as well as the IR. Two early decisions show the rule
at work:

- **Shift counts are masked** (`x << n` lowers to `shl x, (n & 31)`). This makes
  `i32` shifts match JavaScript's and removes LLVM's out-of-range-shift UB. It
  is free: `llc -O3` emits no `and` on x86-64 and the same assembly as the
  unmasked form on aarch64, because both ISAs mask in hardware.
- **`join` is mandatory, not sugar.** Building 88 KB of text by repeated `+`
  costs 180 MB of peak RSS, because every concatenation copies and the arena
  never reclaims.

---

## 1a. The paradigm: data-oriented and procedural

Pure OOP is a cache-miss machine (vtables, deep hierarchies, a heap object per
value), and pure FP is an allocation machine (closures and `.map().filter()`
chains allocating per step). Both put indirection between the CPU and the data.
The memory model therefore sets the style: **flat structs in contiguous memory,
top-level procedural functions that LLVM inlines, explicit mutation, and
functional idioms only where they remove runtime work**. The value-based
`Result<T, E>` is the example: one `i1` and a branch instead of unwinding
tables.

| Feature | Status | Why |
| --- | --- | --- |
| Flat classes as C structs | the design | `class` is `%struct.Name`, laid out as clang lays out the C struct. There are no prototypes, vtables or object headers. |
| Top-level procedural functions | the only form | Purity is *computed* by the whole-program fixpoint, not declared. |
| `Result<T, E>` | built-in (WP16, WP17) | Register-passed, no unwinding. |
| Inheritance | removed by WP25 | `implements` with a field prefix replaced it. |
| Runtime closures | forbidden | A captured environment needs a heap allocation and an indirect call, and an unknown callee defeats the purity, termination and escape analyses. |
| `prototype`, dynamic properties | forbidden | They would break the fixed layout. |

---

## 2. Zero-cost safety: the bounds-check pipeline

The compiler should prove an access safe at build time and emit no check.
The runtime panic is only the floor, used when nothing proves the access. The
proof is `src/bounds.ts`, and `docs/LANGUAGE.md` ("Element access") states its
rules normatively.

**The measurement protocol** used throughout this section, and cited by later
notes (WP31 §10), is CPU time (user + sys), the minimum of 15 runs after 3
warm-ups, at `--profile speed`, on x86-64 with LLVM 18. Wall time on a shared
four-core box under a load average of 25 measures the neighbours, so it was not
used.

### 2.1 Ranged integer types

The planned spelling, `i: integer<0, 255>`, needed type parameters (item 8), so
the *analysis* shipped first. It infers the range of every integer local from
the guards, loop conditions and initialisers already in the program, and from
the unsigned types, whose lower bound is the declaration. The declared surface
shipped later as WP31 (#261, #268, #273). WP31 measured it as a frontend fact
and not a speed-up: `bench/getbyte.ts` builds to the same executable as the
unchecked build (0.994x), and its `i32` spelling is already proven by the
call-site facts of §2.4.

### 2.2 Length-narrowing guards, and a passed check is a fact

A length check proves an index for the region it reaches. The plan was to
narrow `data` to a tuple type inside `if (data.length >= 4)`. Instead the facts
are recorded per variable: `i >= 0`, `i < w.length`, `i <= w.length`, `i < n`
and `w.length >= n`. The tuple type would have had to be threaded through
assignment, parameter passing and both type tables, and would have bought
nothing more. The rules that invalidate a fact are the soundness argument.

On a lexer-shaped cursor (400 passes over 547 KB), the proof measured
**1.069x** against a floor of 1.082x for removing *every* check, and the hot
function came out byte-identical to the `--unchecked-indexing` build. On an
ordinary counted array loop it recovers nothing measurable, as §2b predicted.

One shape the facts cannot hold is `min`. In
`const shorter = a.length < b.length ? a.length : b.length`, both bounds follow
from the *condition* rather than from either arm. Recognising that shape would
be sound, but it was deliberately not done: a peephole inside a
soundness-critical analysis is how a wrong elision gets in.

**A passed check is a fact.** `a[i]` either panics (`noreturn`) or continues
with `0 <= i < a.length`, so the walk records that fact past every checked
access, and a repeat of the same index on the same holder is proven. The fact
lands where the emitter runs the check. The emitter checks `a[i] = a[j]`'s
value before its store, and checks `a[i] op= x` before `x`. A store whose value
calls anything teaches a *path* nothing, because the field may be replaced
(`arr_repeat_check_panic`). On AWFY Permute's `swap` this took the checks from
four to two. Cachegrind counted **339.7 M instructions against 309.5 M**
(−8.9%). Wall time did not follow: it was within ±10% noise on a four-core
container, and was recorded as such.

### 2.3 Slice iterators — measured, and not taken

The proposal was to lower `for (const c of s)` to pointer advancement. Measured
at `c100f11`, the indexed loop it was meant to beat already is that loop.
`for (const x of xs)` and `for (let i = 0; i < xs.length; i++)` over an `i32[]`
link to **byte-identical** 8,008-byte binaries, because the §2b alias domains
let `opt -O3` hoist the length and data pointer. A guarded byte loop over a
string is byte-identical with and without `--unchecked-indexing`. The string
half is declined on language grounds by
[wp23-language-surface.md](wp23-language-surface.md) §7.

What is not free is a cursor the body advances by a variable amount, which
`for...of` cannot express. On that shape, removing every check is worth
**1.094x** (1.40 s against 1.28 s). That number became §2.2's acceptance number.

### 2.4 What survives the local proofs: no opt-out, and call-site ranges

**No opt-out.** A scoped `trusted` region was deferred until the proofs had
landed and the surviving checks could be counted. Over the whole of `src/`, the
count was **seventeen checks surviving inside a loop** in a shape the analysis
handles. Each is an invariant the program has and the compiler cannot see: two
arrays kept the same length, a `min` cursor, or a merge sort's indices.
`NL9007` names a rewrite for each, and seventeen sites do not justify a language
feature. The opt-out stays unbuilt. The per-site escape hatch that exists today
is `uncheckedGet`/`uncheckedSet` from `nish:unsafe` (#422). It replaces the
whole-package `--unchecked-indexing` flag, which is deprecated (NL9014) and which
`nish --unchecked-indexing --fix` migrates away from (#459).

**Call-site ranges** (`src/ranges.ts`, #222) carry facts across a call, and they
feed the same walk.

- **A summary of what each callee may store.** A call with a summary resizes no
  array, so the caller keeps its length facts across it. A callee that calls
  `push`/`pop`, `Arena`, a foreign function or an instantiation has no summary.
- **Entry facts.** These are a floor and a `maxIndex` per integer parameter,
  plus length facts about parameter-rooted paths. A function gets them only
  when every call site proves them, and only when every caller is visible.
  `hostVisible` in `src/visibility.ts` decides visibility from the build: an
  export takes entry facts only in a closed `--link` build with no sidecar and
  no `declare function`.
- **Recursion.** The entries form a fixpoint that only weakens, so it ends.
  `src/` settles in six rounds, under a limit of 64.

Under these rules, AWFY Permute's `swap` is entered with `i, j` in `[0, 6)` and
has no check in a closed build. It keeps both checks under `--emit-header`,
soundly, because a C host may call it with anything
(`tests/link/range_export*`). Towers executes 5.6% fewer instructions and
Storage 3.3% fewer. The compile-time cost was cut back from +4.7% to +1.5% of
`src/`'s `--link` compile without losing a proof (#217). `tests/run.js`'s
`range_reference` holds the IR to that.

**The floor.** When nothing proves an access, the panic is emitted. Safety is
the default, and speed is what the proofs buy.

---

## 2a. Arrays of records are contiguous — **done**

`Point[]` used to store one pointer per element. An array of **records** (an
`interface` that no class implements) is now `N` structs end to end in one
allocation, with clang's stride and alignment (`tests/layout/structs.c`).
Holding an element reference across a `push`/`pop` of its array, or across a
call handed the array mutably, is refused (`NL2290`), because growth would leave
the reference dangling. `ps.push(ps[i])` gets its own message (`NL2291`).

| Shape (`--profile speed`, min of 7) | pointers | contiguous | |
| --- | ---: | ---: | --- |
| 200k records, a second array built in the same loop | 1864 ms | **820 ms** | **2.27x** |
| 1M records built in traversal order | 588 ms | 579 ms | noise |
| 8192 records, L2-resident | 1501 ms | 1500 ms | none |

The 2.27x is what the layout buys when allocation order and traversal order
differ. A bump allocator had already made the old layout contiguous whenever
the two orders agreed.

### Class elements: closed by decision

**An array of classes is one pointer per slot, permanently.** A class has
identity, and copying it into a slot would give `xs.push(c); c.m()` a different
meaning from `xs.push(c); xs[n].m()`. Nothing else in the language copies a
class. The idea was costed against `src/` and found to be a change of meaning,
not a migration:

- One `FunctionSig` is held in `program.functions`, `methodSigs` and `ctor` at
  once and written through whichever is to hand.
- 54 identity comparisons in 10 modules ask whether an element of a `Local[]`
  or `Node[]` *is* a given object. Twenty of them are in `src/bounds.ts`. Nine of
  those are the `!==` guards in `forget`, and with value slots those guards would
  never match. No fact would ever be retracted, so the compiler would drop needed
  checks: a miscompile, not a slow program (`perf_bounds_loop` catches it).
- The syntax tree would be copied once per level of nesting.

A program that wants the layout declares the element type as an `interface`,
and `C | null` gives back a pointer array. `inlineElementStruct` in
`src/program.ts` is where the decision lives.

---

## 2b. The array header is not the array's elements — **done**

An array is a pointer to `{ i64 len, i64 cap, i8* data }`. Nothing in the IR
said that the header and the element buffer are disjoint, so every element
store could clobber `len` and `data`. LICM therefore reloaded the header on
every iteration, and the vectoriser gave up. The header and the elements are now
**separate alias domains**. The proof is about bytes: every header and every
element buffer the compiler produces occupies its own byte range, and the
argument sits beside the code in `src/emit-arrays.ts`. Strings are left out
because a string is one block, and struct fields are left out until a
measurement asks for them.

On `dst[i] = src[i] * 2.0` (8192 doubles, 150k passes), the domains took the
loop from 1205 ms to 763 ms (**1.58x**). Adding `--unchecked-indexing` on top of
a hoisted header bought only 0.5%. **The checks were never the cost. The
aliasing was.** `tests/cases/arr_alias_domains` pins that no header load
survives in the loop after `opt -O2`, and that the loop vectorises. Re-measured
in §2c, the domains are worth **1.63x to 3.96x** depending on where the array is
held, so quote the range and name the shape with any single number.

---

## 2c. Making the header invariant — **candidate 1 refuted, the item re-scoped**

§2b predicted that an *invariant* header would be worth the same again (373 ms,
3.23x). Two candidates were proposed: mark header loads `!invariant.load` off a
`readonly T[]` spelling (candidate 1), or hoist the header in the emitter
(candidate 2).

### The acceptance program

The comparison is between two shapes, using §2's protocol with 8192 doubles and
150,000 passes:

- **Parameter shape:** `scale(dst: f64[], src: f64[])` loops
  `while (i < src.length) { dst[i] = src[i] * 2.0; ... }`.
- **Field shape:** the same loop over `h.xs`, where `h` is a `Holder` class. This
  is how `src/` is written. `knownAtMost` in `src/bounds.ts` is this shape
  verbatim.

| build | parameter | field |
| --- | ---: | ---: |
| alias domains stripped | 1208 ms | 1230 ms |
| main at the time | **305 ms** | **756 ms** |
| + every header load `!invariant.load` | 307 ms | 305 ms |
| + `const xs = h.xs` hoisted by hand | — | 306 ms |

The parameter shape was already where the invariant header would put it. The
field shape was **2.48x** behind, and a hand hoist in the source recovered all
of it. `bench/hoist-field.ts` reproduces the pair in one process.

### The criterion: one length value

The 2.48x was **not** a header load in the loop. In the linked binary the
header loads were already in the per-pass preamble. The difference was
vectorisation. The field shape read `h.xs.length` twice, once for the `while`
and once for the bounds check, and the two reads stayed two values. The loop
therefore had two exits, got no `llvm.umin`, and the vectoriser declined it. A
hand edit that left **zero** header loads in the loop but still two lengths
measured 761 ms, *slower* than the original. So the acceptance criterion was
**one length value feeding both the loop condition and the bounds check**.
"Header hoisted once per loop" can be satisfied while buying nothing.

### Candidate 1 is unsound, and `readonly T[]` is why

`readonly` constrains the holder, not the array: the caller can still `push`.
`!invariant.load` holds for *every point in the program where the location is
dereferenceable*, not just inside the callee. So one `push` anywhere in the
array's life makes the marking undefined behaviour, not a lost hoist. A
twenty-line program that must print `6 10` prints `6 6` with every header load
marked. The whole of `src/` marked that way (7,068 loads, 988,296 bytes
unmarked) linked to a 22,048-byte compiler that answered
``compile: unknown flag `tiny.ts` ``. At two earlier heads it did not link at
all. The deletion reproduces, and its severity does not. **An invariant header
needs a proof that no `push` reaches the array for its whole life, and neither
`readonly` nor a fixed-length spelling gives one.** The same refutation applies
to [wp9-optimisation.md](wp9-optimisation.md)'s proposal to mark nbody's element
loads `!invariant.load` "inside that function". An earlier claim of 3.35x from
GVN dropping `!alias.scope` named no program and was withdrawn.

### Candidate 2 shipped, and the checker's property paths are what took the 2.48x

- **The hoist (#104)** lifts a field-held array's header into the preheader
  wherever `FunctionFacts.resizesArray` says nothing the loop reaches can grow
  the array. That whole-program "does not grow an array" fact was this item's
  prerequisite. The hoist alone measured neutral (755 ms against 753 ms): one
  `len` fed both uses, but the bounds proof still could not see that
  `h.xs.length` bounds `h.xs[i]`, so the second compare stayed.
- **Property-path facts (#179, issue #106)** key a length fact by a root and a
  chain of field names as well as by a variable. A path fact is dropped by a
  store to any field named on the path (by name, through any holder), by a
  whole-record element store, by an assignment to the root, and by **any call
  or `new`**. Every call drops every path because `resizesArray` is computed
  after the checker runs, and because a callee that stores `h.xs = shorter`
  resizes nothing and still rebinds the path. No path is built through a
  nullable link. Each of these rules has a must-panic program in
  `tests/cases/arr_path_*`.

On `bench/hoist-field.ts` (clang 18, loop alignment pinned, `taskset -c 0`), the
field scan went from **577 ms to 242 ms (2.38x)**, level with the parameter and
hand-hoisted shapes at 243 ms. That closes the gap §2c measured as 2.48x on
another box. `tests/cases/arr_header_hoist` pins `@fieldScale`'s loop as
`@constScale`'s, register for register. In `src/bounds.ts` under `opt -O2`,
bounds-check exits inside loops fell from 110 to 87.

One gap found during that work, the hoist missing a whole-record element store
(`rs[0] = other`), was closed by #190, which made the proof and the hoist share
one rule.

---

## 3. Fast defaults — **done**

| Flag | Default | What it buys | Status now |
| --- | --- | --- | --- |
| `--strict-exports` | **on** | Non-exported functions get `internal` linkage: inlining, specialisation and dead-stripping, for speed *and* size. | Unchanged. `--no-strict-exports` restores the C-ABI symbols. |
| `--nsw` | was **on** | Signed overflow was undefined, so LLVM could widen and strength-reduce induction variables. | **Superseded by #426.** Signed overflow is a checked panic by default, with `nsw` written only where `src/bounds.ts` proves the operation fits. `--nsw` is refused (exit 2). A wrap is asked for per site with `wrappingAdd`/`wrappingSub`/`wrappingMul` from `nish:unsafe`, or with the deprecated `--wrapping` (NL9015). |

The `nsw` flip was the largest semantic change in this note, and it was made in
the open. The docs were re-pointed, and every differential and golden case that
relied on wrapping was moved to `--wrapping` rather than deleted. #426 reversed
the trade for the reason the flip had accepted as its cost: a program that
`tsc --strict` accepts could compile into undefined behaviour.
`docs/LANGUAGE.md` ("Signed integer overflow is a checked panic", "Target,
overflow and linkage flags") is the current rule.

Decisions from the flip that still hold:

1. **Unsigned arithmetic never carries a no-wrap flag.** `u8`–`u64` wrap by
   definition (§6).
2. **Constant folding mirrors the emitter.** A module constant that overflows
   its width is a compile error, unless wrapping was asked for.
3. **A function name stays unique across the program, exported or not.**
   `internal` linkage does not buy a second namespace, because the fact
   fixpoint is keyed by `FunctionSig.name`. The bootstrap found this within the
   hour (`tests/link/duplicate_internal`).

The flip also produced two measurements. `bench/nbody` shrank from 12,000 to
10,856 bytes through dead-stripping. A 4% `fib` "regression" was code layout:
sorted, the instruction multisets were identical.

---

## 4. Two string slices, not one compromise — **done**

`substring` keeps exact JavaScript semantics, clamping and swapping its
arguments. **`slice`** is the fast cut: `0 <= start <= end <= s.length` or it
panics (`nish_panic_slice`, which prints the offsets signed). It lowers to two
`icmp ule`, a `sub`, a GEP and `nish_str_new`. The name is `slice` because the
proposed `sliceFast` and `subarray` are `TS2339` under `tsc --strict`, while
`slice` is in `lib.es5.d.ts`.

The measurement was 40 M slices of 14 bytes on a lexer-shaped scan: **1.18x**
(734 ms against 618 ms). `callgrind` counted exactly 13 x86-64 instructions
fewer per slice. The win is a constant per call, so it matters where slices are
small and many. The larger point is that **a check is provable and a clamp is
not**. With constant offsets, `opt -O2` deletes every compare in `str_slice`,
and no optimiser can do the same to `substring`'s `smin`/`smax`, which are part
of its answer.

---

## 5. Error handling: `Result<T, E>`, not exceptions

The plan was a discriminated union in library code, built on generics. What
shipped was a built-in `Result<T, E>`, with a narrowing engine and `orReturn()`
from [wp16-results.md](wp16-results.md) and a register ABI from
[wp17-result-abi.md](wp17-result-abi.md). It is never a heap object and needs no
unwinding tables, so every function stays `nounwind`. Generics
([wp18-generics.md](wp18-generics.md)) are monomorphised as this section
required: no boxing, no dictionaries and no runtime type information. WP18 §6.1
explains why `Result` and `Array` stayed built-in rather than becoming library
code, and why `src/map.ts`'s `StringMap` was not retired.

---

## 6. Unsigned integers

`u8`, `u16`, `u32` and `u64` are done (§9 item 4). They exist because
`-1 >>> 0` needs an unsigned type to hold `4294967295`, and because hashing,
bit-packing, byte buffers and ranged types all want one underneath. Unsigned
arithmetic wraps by definition. `i8`/`i16` are left out until something needs
them, so that the conversion matrix does not double again.

---

## 7. The runtime budget yields to a measured win

The runtime's compiled-code budget is the default forcing function (4 KB of
`.text` for `runtime.c` when this was written; [wp7-runtime.md](wp7-runtime.md)
keeps the live ceilings). A helper may exceed the budget **on the strength of a
benchmark in the pull request**, not an assertion. Size is second, not
irrelevant.

## 7a. Formatting a double — **done**

`String(x)` used to search for the shortest round-tripping length with
`snprintf`/`strtod`. That was slow (2,557 ns), and wrong about one value in
twenty thousand: `snprintf` returns the correctly rounded k-digit string, which
need not be the shortest one that round-trips. A port of
[Ryu](https://github.com/ulfjack/ryu) (Boost Software License 1.0,
`runtime/LICENSE-ryu`, listed in `THIRD_PARTY_NOTICES.md`) takes **72 ns, 35x
faster**, and is shortest by construction. It was validated against the
ECMAScript rule over 20.9 million values with zero violations. The cost is
9,888 bytes of tables in `.rodata`, linked only by a binary that formats a
double: `bench/nbody` went from 10,856 to 21,168 bytes. This is the largest size
regression taken deliberately.

## 7b. A private ABI inside a module — **done**

A function no host can name does not owe anyone its calling convention. For a
non-exported function (`strictExports && !exported`, the same test that writes
`internal`), a small `Result` is passed as `{ i1, i32 }` rather than WP17's
packed `i64`. That let instcombine fold around the tag, and took `bench/result`
from 650 ms to 464 ms (**1.40x**). The private shape was then widened to
`{ i1, i32, i32 }`, one slot per arm, so that the two arms stop meeting in a
`phi`. The shared slot had become a variable shift `n >> (1 - odd)` after
inlining. With the separate slots, `bench/result` went from 1.84x behind Rust
`-O3` to **1.00x**. `--no-strict-exports` turns both off together.

## 7c. `indexOf` gets a real algorithm — **done**

`s.indexOf(sub)` was an inline byte-at-a-time loop. It is now
`nish_str_index_of`, a `memchr`/`memcmp` scan: 53.7 ms became 2.9–3.1 ms on an
880 KB haystack (**about 17–18x**), within a quarter of glibc `memmem`. It also
shrinks every call site. `memmem` itself was rejected: it needs `_GNU_SOURCE`,
which makes `<string.h>` include `<strings.h>`, and a generated `strings.h` on
the include path (`examples/strings.ts` produces one) then broke `runtime.c`.

## 7d. Arena provenance — **measured, and not taken**

WP9 measured a `noinline` allocator recovering vec3 (757 ms to 356 ms) and
nbody (−6%), because the call's `noalias` return gave LLVM provenance.
Re-measured after WP6's stack allocation, nbody was 1467 ms against 1479 ms,
which is noise, and vec3 already beat C. A call per allocation for zero is not
being made.

---

## 8. The `performance` diagnostic class

A compiler that silently takes a slow path loses these decisions over time. So
there is a third severity: **performance warnings**. They go through the same
sink, are carried in `--json`, are on by default, never affect the exit code,
and are turned off by `--no-warn-performance`. **The bar is a concrete rewrite,
named in the message.** A warning nobody can act on trains people to ignore the
whole class, so the hint is part of the specification. Some rules flag
arithmetic that provably does not compute what was written. Those are not
performance advice, but they ride this class because it already has the right
shape, and a fourth severity would change a machine-readable contract.

| Warning | Fires when |
| --- | --- |
| bounds check not eliminated (`NL9007`) | `a[i]` or `charCodeAt(i)` in a loop that the §2 proof could not discharge |
| quadratic string building | `s = s + t` with `s` assigned in an enclosing loop |
| allocation in a loop | an escaping `new`, array literal or concat inside a loop |
| not inlinable (`NL9008`) | a call in a loop to a non-exported function kept external by `--no-strict-exports` |
| clamp not folded (`NL9009`) | a `substring` bound in a loop that the proof could not place in `[0, s.length]` |
| wasteful struct padding (`NL9010`) | a field order that costs bytes no order has to spend |
| allocation dropped by an assignment | `p = new Point(n)` overwriting an allocation nothing captured |
| allocation dropped on every pass (`NL9016`) | `x = <allocation>` on every pass of a loop, with `x` declared outside it and nothing capturing the old value |
| constant computed with overflow | literal arithmetic that does not fit its `i32` |
| product widened after wrapping | `toI64(a * b)` with an `i32` multiplication |
| shift count at or beyond the width | `x << 32` on an `i32` |

`docs/LANGUAGE.md` specifies each one, and `tests/cases/perf_*` pins them. The
report order is normative: by file in the order files are first warned about,
then by position, then by code (#99, `diag_order_pass1`). `NL9010` is found in
pass 1, before any body is checked, so the list is sorted as it is built.

---

## 9. Sequencing

Each item shipped with the construct checklist from `docs/ARCHITECTURE.md`. An
item that a measurement closed says so.

1. **Fast defaults** (§3) — **done**. The `nsw` half was superseded by #426.

   1a. **Array alias domains** (§2b) — **done**. 1.58x on an element loop with no
   language change. It also showed that the bounds checks cost 0.5% once the
   header is hoisted, which re-ordered the rest of this list.

   1b. **An invariant array header** (§2c) — **candidate 1 refuted, candidate 2
   done.** The `readonly T[]` marking is a miscompile. The emitter hoist (#104)
   plus property-path facts (#179) closed the field shape's gap: 577 ms became
   242 ms (2.38x) on `bench/hoist-field.ts`. The acceptance criterion was one
   length value for both the loop condition and the bounds check, and the
   prerequisite was `FunctionFacts.resizesArray`.

   1c. **Shortest-digit formatting** (§7a) — **done**. 35x, and a correctness
   fix.

   1d. **The private `Result` ABI** (§7b) — **done**. `bench/result` is level
   with Rust.

   1e. **`indexOf` in the runtime** (§7c) — **done**. About 17–18x, and smaller
   call sites.

   1f. **Arena provenance** (§7d) — **measured and dropped**.

2. **`performance` diagnostics** (§8) — **done**, all ten rules. What measuring
   the last four taught:
   - **`NL9007`** shipped with item 6.
   - **`NL9009`** shipped with the clamp fold it presupposed. Measuring first
     showed that LLVM folds a clamp only where it can hoist the length, and
     never through a parameter receiver, so the compiler folds the clamp from
     the §2 facts itself. Over `src/` this took the `llvm.smin`/`smax` calls from
     218 to 190. `bench/substr.ts` measures the fold at **1.10x** on 16-byte
     pieces and 1.20x on 4-byte pieces.
   - **`NL9008` is a size, not a time.** `--no-strict-exports` costs
     `bench/sieve` 240 bytes, and the wall clock does not move: five protocols
     agreed to within 2.4%, with the sign flipping between them. An earlier 4%
     figure did not reproduce and was withdrawn. The warning names the missed
     specialisation and no speed figure, and it skips a `declare function`
     (`perf_inline_foreign`).
   - **`NL9010`** compares each struct with a floor (the sum of the field widths,
     rounded up to the struct's alignment). The floor is reachable because every
     field width is a power of two equal to its alignment. In a class that
     `implements` an interface, the interface prefix is fixed, and the suffix is
     ordered least-padding-first from the prefix's end (#196). Generic
     instantiations stay silent. At `c656ee3`, 11 of the structs in `src/`
     wasted padding.

3. **Slice iterators** (§2.3) — **measured, and not taken**. The array half was
   already banked by §2b, and the string half is declined by WP23 §7.

4. **Unsigned types** (§6) — **done** (`tests/cases/u_*`).

5. **Fast slice** (§4) — **done**. 1.18x, and the check folds away where the
   bounds are provable (`str_slice`, `str_slice_panic`).

6. **Ranged types and length narrowing** (§2.1, §2.2) — **done**. The analysis
   came first. The declared `integer<Lo, Hi>` surface shipped later as WP31, and
   WP31 §10 measured it under §2's protocol at 0.991x to 0.994x against the
   unchecked build, which is noise. The proven cursor of `bench/cursor.ts` is
   byte-identical to the unchecked one.

7. **Contiguous record arrays** (§2a) — **done for `interface` elements, closed
   for class elements**. 2.27x where allocation and traversal order differ.

8. **Generics, discriminated unions, `Result<T, E>`** (§5) — split into
   WP16/WP17 (`Result`) and WP18 (generics). Discriminated unions stay deferred
   (WP18 §7).

The explicit bounds-check opt-out was deferred until item 6 had landed and the
surviving checks were counted. That count closed it (§2.4).
