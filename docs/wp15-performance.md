# WP15 — Performance first

The project's northern star: **the fastest binary we can emit**, with **binary
size second**. This note records the decisions that follow from that ordering,
the language features they require, and the diagnostic class that stops them
from being decisions nobody remembers.

`docs/LANGUAGE.md` stays normative for what the language *is*.
`docs/wp14-selfhost.md` owns self-hosting; this file owns speed. Where they
disagree about priority, this one wins — a self-hosted compiler that emits
slower code is not the goal.

---

## 1. The rule

When a language decision has two defensible answers, the faster lowering wins,
and "faster" means **measured**, not assumed. Read the generated assembly, not
just the IR, when the choice is not obvious.

Two decisions already made under this rule, with their measurements, because a
rule with no worked examples is decoration:

- **Shift counts are masked** (`x << n` lowers to `shl x, (n & 31)`), which
  makes `i32` shifts exactly JavaScript's and removes LLVM's
  out-of-range-shift undefined behaviour. Measured: `llc -O3` emits **zero
  `and` instructions** for the compiler's real output on x86-64, and identical
  assembly to the unmasked form on aarch64 — both ISAs mask in hardware and the
  backend drops it. Free, so safety won at no cost.
- **`join` is mandatory, not sugar.** Building 88 KB of text by repeated `+`
  costs **180 MB of peak RSS**: every concatenation allocates a fresh copy and
  the arena never reclaims. Quadratic in time and memory.

---

## 1a. The paradigm: data-oriented and procedural

Neither pure OOP nor pure functional. Both lose, for the same underlying
reason — they put indirection between the CPU and the data.

- **Pure OOP** is a cache-miss machine: vtables, deep hierarchies, and a heap
  object per value mean the CPU follows a pointer chain to reach anything.
- **Pure FP** is an allocation machine: immutability, closures and
  `.map().filter().reduce()` chains allocate per step, which is precisely what
  a bump arena and a small binary cannot afford.

So the memory model dictates the style, not a paradigm: **flat structs in
contiguous memory, top-level procedural functions that LLVM inlines, explicit
mutation, and functional idioms only where they remove runtime work** — the
value-based `Result<T, E>` of §5 being the example, since it replaces unwinding
tables with one `i1` and a branch.

Most of this is already what Nish is, which is why it is written down here
as a frame rather than a change:

| Feature | Status | Why |
| --- | --- | --- |
| Flat classes as C structs | **allowed, already the design** | `class` is `%struct.Name` with fixed fields in declared order, laid out exactly as clang lays out the equivalent C struct, and a layout test pins it. No prototypes, no vtables, no headers. |
| Top-level procedural functions | **allowed, already the only form** | Nested functions, function values and closures do not exist. Purity is *computed*, not declared: the whole-program fixpoint marks a function `readnone`/`readonly` when it earns it. |
| `Result<T, E>` | **planned (§5)** | Stack-allocated, register-passed, no unwinding. |
| `extends` | **allowed, any depth** | Single inheritance by struct prefix, no virtual dispatch. Depth costs nothing: each ancestor is a prefix of the derived layout, so a chain of three is still one flat struct and one `getelementptr`. Considered restricting it to one level and did not — the layout reason does not bite, and a rule with no cost behind it is just a rule. |
| Runtime closures | **forbidden** | Stricter than "restricted": a captured environment needs a heap allocation and an indirect call, and an unknown callee defeats the purity, termination and escape analyses the attributes depend on. |
| `prototype`, dynamic property mutation | **forbidden (Phase 0)** | Breaks the fixed layout the whole model rests on. |

The one place the language was **not** data-oriented is arrays of structs, and
that is being fixed — see §2a.

---

## 2. Zero-cost safety: the bounds-check pipeline

A bounds check is the largest per-instruction cost in the loops that matter,
and the choice is *not* between unsafe speed and safe slowness. The compiler
should prove the access safe at build time and emit no check at all. Four
mechanisms, tried in order, with the runtime panic only as the floor:

**1. Ranged integer types.** `number` says nothing a compiler can use.
A constrained integer does:

```ts
function getByte(buf: FixedBuffer<256>, i: integer<0, 255>): u8 {
  return buf[i];   // proof: i <= 255 < 256 — no check emitted
}
```

Passing an unproven value is a build error. Once it type-checks, the binary
reads memory directly.

**2. Length-narrowing type guards.** A length check narrows an array to a
fixed-size tuple for the rest of the block, so the check happens once outside
the loop instead of once per access:

```ts
if (data.length >= 4) {
  // data is [u8, u8, u8, u8, ...u8[]] in here
  const magic = data[0];   // proven, no check
}
```

**3. Slice iterators — measured, and not taken.** The proposal was that
`for (const c of s)` lower to pointer advancement —
`p = start; end = start + len; while (p < end) { ... p++; }` — rather than to
`s[i]`, so that the idiomatic loop was also the check-free one. Measured at
commit `c100f11` on x86-64 with LLVM 18 at the default `speed` profile, the
loop it was written to beat already is that loop.

Two whole programs sum a 20,000,000-element `i32[]` ten times, one written
`for (const x of xs)`, the other
`for (let i = 0; i < xs.length; i++) { sum += xs[i]; }`. Both link to
**8,008 bytes** and the binaries are **byte-identical** — `cmp` reports no
difference. After `opt -O3` the `for...of` length load is hoisted to `entry`
and the data pointer to the preheader — the §2b alias domains are what prove
an element store cannot clobber the header — leaving a body of
`getelementptr` + `load` + `add` + `add` + `icmp`. That is the pointer
advancement this mechanism describes, and the per-iteration `.length` re-read
it was written to remove does not survive to the binary. Both loops vectorise
8-wide once a target triple is given.

A simple guarded byte loop is the same story:
`for (let i = 0; i < s.length; i++) { acc += classify(s.charCodeAt(i)); }` over
a 547 KB string builds to **7,008 bytes both with and without
`--unchecked-indexing`, byte-identical**: LLVM relates the index to the length
and drops the check unaided. Nor does a call in the loop body put the header
back — a scanning loop that calls `push` on an array argument, so that
`nish_array_grow` sits in the body, still hoists the string's length load to
`entry`, because the attribute fixpoint gives the string parameter
`noalias nocapture readonly` and the §2b domains separate the array's header
from its elements.

The string half of the proposal is declined on language grounds rather than
measured: `wp23-language-surface.md` §7 rejects `for...of` over a string
because it would not be what `tsc --strict` means, because the type-honest
version allocates per character, and because it would diverge from Node's
code-point iterator.

**What is not free is a cursor that advances by a variable amount**, and that
belongs to mechanisms 1 and 2 rather than here, because `for (const c of s)`
cannot express one. A lexer-shaped program — `while (i < s.length)` around
nested `while (i < s.length && isAlpha(s.charCodeAt(i))) { i = i + 1; }` scans,
2000 passes over a 547 KB source — measures **1.40 s checked against 1.28 s
unchecked** (best of 7 runs each), **1.094x**, and 216 bytes of code (6,664
against 6,448). That is the ceiling for eliminating bounds checks on real lexer
code, and it is the acceptance number for ranged types and length narrowing
(§9 item 6), not for this mechanism. It is also what `self/lexer.ts` is made
of: its scanning loops are all `while (... < this.source.length)` with a cursor
the body advances by variable amounts. WP23 §7 makes the same observation about
the lexer from the language side; this is the measured version of it.

The numbers above are x86-64, LLVM 18, at the `speed` profile, and they are
`-O3` numbers: a guarantee that holds at `debug` and on wasm's weaker
vectoriser would be worth something these hide. Not enough to reopen the item,
but worth stating.

**4. An explicit opt-out — deliberately not built yet.** A scoped `trusted`
region was considered and deferred: it is the escape hatch, and every check
mechanisms 1-3 eliminate is one nobody needs to escape. Build the proofs first,
measure how many checks actually survive them, and only then decide whether an
opt-out earns its keep. (For the record, `#trusted { }` could not have been the
spelling: Nish parses with the TypeScript parser, which rejects it. A
labelled block `trusted: { ... }` or a `/* @trusted */` pragma would be the
candidates.)

**Floor: the runtime check stays.** When none of the above proves it, the panic
is emitted, as today. Safety is the default; speed is what the proofs buy.

Between 2 and 4 sits LLVM's own bounds-check elimination, which already removes
the check from ordinary counted loops. Part of this work is *measuring* how
much it gets on its own before hand-building analysis that duplicates it.

---

## 2a. Arrays of structs are contiguous

`Point[]` stored **one pointer per element**: the array data was
`%struct.Point**`, each entry pointing somewhere in the arena. Iterating it
chased a pointer per element and scattered the fields across memory — the exact
pattern §1a exists to avoid, sitting in the middle of the language.

Struct arrays become **contiguous values**: `N` structs end to end, one
allocation, `ps[i]` an interior `getelementptr` rather than a load-then-chase.
That is what makes a loop over `Point[]` vectorisable and what makes a struct
array a cache line's worth of useful data instead of a cache line's worth of
pointers.

The hazard this introduces is real and is not being waved away. Growing an
array reallocates, so an interior pointer taken before a `push` dangles
afterwards:

```ts
const p = ps[0];    // interior pointer into the array data
ps.push(other);     // may reallocate and move the data
p.x = 1.0;          // would write to freed memory
```

Today that is safe, because `p` is an independent heap object. Under
contiguous storage it is a use-after-free, so **the checker rejects it**: an
element reference may not be held across a mutation of the array it came from.
The rule reuses the flow-sensitive machinery the narrowing analysis already
has, and it will reject some programs that would have been fine — that is the
accepted cost of the layout, and the message names the fix (index again after
the push, or hoist the push).

This changes the array ABI, so the C header, the wasm bridge, the N-API shim
and their tests move with it.

---

## 2b. The array header is not the array's elements — **done**

The largest measured win in this note, and it needed no language change at all.

An array is a `%struct.nish_array*` to `{ i64 len, i64 cap, i8* data }`, and
`data` points somewhere else. Nothing in the IR said those two regions are
disjoint, so LLVM had to assume `a[i] = v` might land on some array's `len` or
`data`. The consequence is not a missed peephole — it is that **the header is
reloaded on every iteration of every loop that writes an element**, because
LICM may not hoist a load a store might clobber, and the loop vectoriser gives
up behind it.

Measured on `dst[i] = src[i] * 2.0`, 8192 doubles (L2-resident), 150k passes,
`--profile speed`, min of 7:

| | min | |
| --- | ---: | --- |
| before | 1205 ms | header reloaded per iteration |
| **header and elements as separate alias domains** | **763 ms** | **1.58x**, sound today |
| + the header treated as invariant | 373 ms | 3.23x, and it vectorises — needs §2c |
| + `--unchecked-indexing` on top | 371 ms | 0.5%: the checks were never the cost |

That last row is worth reading twice. **Bounds checks were not what the loop
was paying for**, and the intuition that they are is what sent WP9's diagnosis
looking at `--unchecked-indexing` (which bought 0% on nbody and 4% on sieve).
The cost was the aliasing, and the checks only looked expensive because the
`len` they compare against was being reloaded with everything else.

**The proof is about bytes, not allocations.** Every header the compiler
produces is a 24-byte `nish_alloc_struct` bump, an entry-block
`alloca %struct.nish_array` (WP6), or the `malloc` block `nish_argv_init`
builds; every element buffer is a separate bump, a separate `alloca [n x T]`,
or — for argv alone — the bytes *after* the header in that one block. In all
four shapes the two occupy disjoint byte ranges, so no store through an element
pointer reaches a header field and none the other way. `nish_array_grow` bumps
a fresh buffer and writes `data`/`cap`, which is a header write, and stays
inside the same split. The argument lives beside the code in
`src/codegen/emit/arrays.ts`, per the "no attribute without a proof" rule.

Strings are deliberately left out: a string is one block whose length header and
bytes are contiguous, so there is no split to describe. Struct fields are left
out too, until there is a measurement behind them — the nbody gap is a struct
aliasing problem and annotating the array headers moved it by nothing
(1829 ms against 1895, noise).

`tests/cases/arr_alias_domains` pins the property a golden cannot express: after
`opt -O2`, no header load survives inside the loop. The GEPs hoist on their own,
so the check is on the loads.

## 2c. Making the header invariant — the other 2x

§2b stops the header from being *clobbered*; it does not say the header never
*changes*. `push` can change `len` and `data`, so the load still has to happen
once per loop, and the bounds compare still reads a value LLVM cannot fold —
which is why the vectoriser is still out at 763 ms and in at 373 ms.

Closing it needs the header to be genuinely immutable for the loop's duration.
Two candidates, in preference order:

1. **Fixed-length arrays.** `Int32Array`/`Float64Array` are aliases of `T[]`
   today, `push` and all (`docs/LANGUAGE.md`, "Typed-array names are aliases").
   Making them real fixed-length types gives the header an immutability the
   emitter can state as `!invariant.load`, and gives a program a way to ask for
   the fast shape by name.
2. **A "no `push` reaches this loop" analysis.** Cheaper for existing code and
   needs no new type, but it is a whole-program question once a callee is
   involved, so it wants the same fixpoint `attributes.ts` already runs.

`readonly T[]` already carries most of the proof for case 1 and the emitter
currently throws it away: a `readonly i32[]` parameter emits nothing but the
`readonly` attribute. That is the cheapest place to start.

## 3. Fast defaults — **done**

| Flag | Default | What it buys | What it costs |
| --- | --- | --- | --- |
| `--strict-exports` | **on** | Non-exported functions get `internal` linkage: inlining, argument specialisation, dead-stripping. Wins on speed *and* size. | A non-exported function is no longer a C-ABI symbol, so the default ABI surface shrinks. `--no-strict-exports` restores it. |
| `--nsw` | **on**, with `--wrapping` to opt out | Signed overflow is undefined, so LLVM may widen induction variables and strength-reduce loops. | **Withdrew the documented wrapping guarantee.** Signed overflow is UB unless `--wrapping` is given. |

Both flags are still accepted by name and now say explicitly what the compiler
does anyway, so a build script written before the flip still runs.

The `--nsw` change was the largest semantic change in this note, and it was
handled in the open rather than quietly:

- `docs/LANGUAGE.md`'s "integer overflow wraps" became "signed integer overflow
  is undefined behaviour; `--wrapping` restores two's-complement wrapping", and
  the same sentence was re-pointed in the README, the FAQ, the cookbook,
  `docs/ARCHITECTURE.md`, `docs/MASTER_PLAN.md` §3.3 and §3.4, and
  `docs/wp13-differential.md`.
- Every differential corpus program that relies on wrapping carries
  `--wrapping` in its `.args`, so the Node oracle keeps testing something real
  rather than comparing against undefined behaviour: `int_wrap`,
  `int_literal_edges`, `int_incdec`, `int_compound`, `i64_arith`,
  `conversions_roundtrip`, `digits`, `recursion`, `bool_logic`, `bit_fnv1a`,
  `prng_lcg` and `const_module`.
- The golden cases that pin wrapping moved to `--wrapping` via their `.args`
  rather than being deleted: `tests/cases/const_wrap` (the folded
  `2147483647 + 1`) and `tests/cases/i64_basic` (`sq * 2` past 2^63).
  `tests/cases/u_arith_wrap` needed nothing, because unsigned overflow is still
  defined.

`--strict-exports` needed re-pointing of its own, and in the other direction:
the golden corpus links `tests/driver.c`, which calls `test()` from C, so every
case that does now says `export function test()` rather than opting out of the
default. Their helpers stay non-exported and the goldens show them `internal`,
which is the point. The same reasoning applies to `examples/add.ts` and
`examples/strings.ts`, whose whole purpose is to be called from C, and to the
interop tests: `--emit-header` no longer promises a non-exported function, and
`tests/run.js` checks both that it is left out by default and that
`--no-strict-exports` puts it back.
`tests/differential/rewrite.js` also learned `--wrapping`, because the checker
it borrows folds constants and would otherwise refuse a program the native side
had just compiled.

Four decisions the flip forced, each recorded here because none of them is
obvious from the flag names:

1. **Unsigned arithmetic never carries a no-wrap flag, in either mode.**
   `--nsw` used to put `nuw` on unsigned `add`/`sub`/`mul`. That was defensible
   while the flag was opt-in and is not defensible as a default: §6 defines
   `u8`/`u16`/`u32`/`u64` as wrapping precisely so that hashing and bit-packing
   have somewhere to live, and `nuw` would withdraw that too. So the flag is
   read as its name says — *no signed wrap* — and the proof under it is "the
   checker recorded a signed type".
2. **Constant folding mirrors the emitter.** A module constant must compute
   what the instruction it replaces computes, so by default an initialiser
   whose `+`/`-`/`*`/unary `-` overflows its width is a compile error
   (`attempt to compute with overflow in a constant`) rather than a silently
   wrapped value the optimiser is entitled to assume impossible; under
   `--wrapping` it wraps, as it always did. This is the same treatment the two
   divisor failures already had: what traps at run time is refused at compile
   time once the operands are known. `-2147483648` is unaffected — its result
   fits.
3. **`self/` had two places that relied on wrapping**, and both were fixed
   rather than exempted: the FNV-1a round in `self/map.ts`, which now
   accumulates in `u32`, and `parseIntegerLiteral` in `self/constants.ts`,
   which now multiplies through `u64`. The folder's own overflow detection is
   written the same way, so the compiler never overflows a signed value of its
   own in order to describe one.
4. **A function name stays unique across the program, exported or not.** The
   obvious reading of `internal` linkage is that two modules may now share a
   non-exported name, and `rejectSymbolClashes` used to skip its check under
   `--strict-exports` on exactly that reasoning. It is wrong:
   `analyzeFunctions` keys the whole-program fact fixpoint by
   `FunctionSig.name`, so two functions sharing a name share one set of facts
   and each is emitted with the other's attributes. Making the flag the default
   turned a rare hazard into a common one — the bootstrap found it within the
   hour, as an out-of-bounds inside stage1 after two modules of `self/` both
   declared a `narrow` — so the check no longer consults the flag
   (`tests/link/duplicate_internal`). `internal` linkage buys inlining,
   specialisation and dead-stripping; it does not buy a second namespace.

### What the defaults measured, and one thing they did not

The benchmark table was regenerated after the flip (`docs/BENCHMARKS.md`), on
an idle machine with the same `--runs 15 --warmup 3` the previous table used —
matching the parameters matters, because the defaults are 5 and 1 and a table
built with those is not comparable to one built with these.

The unambiguous wins are size and string building. `bench/nbody` links to
**10,856 bytes against 12,000** before the flip, which is dead-stripping doing
what §3 said it would, and `strbuild` went from 1.64x C-naive to **0.82x** —
though that one belongs to the call-site reclaim (`wp9-optimisation.md`), not
to these flags.

**`fib` appeared to regress by about 4 % and did not.** The two binaries were
disassembled, their addresses normalised and their instruction streams sorted:
the multisets are **identical**. The same instructions in a different order,
because `internal` linkage changed where the linker placed the function. That
is a code-layout effect — the phenomenon that makes a 4 % swing reproducible
without any change in code quality — and it is recorded here so that the next
person to see `fib` move does not go looking for a miscompilation. The
attribution was checked flag by flag on one machine: `--nsw` alone is neutral
on `fib` (439 ms against 436), which is what a recursive function with no
induction variable should show.

**`nbody` is a real difference and a small one**: 1,296 instructions against
1,497, and about 2.6 % slower. Fewer instructions and more time is the
signature of an inlining or scheduling trade rather than of lost work, and at
that size it is not worth an investigation on its own — but it is the one row
where the defaults changed the generated code and did not pay, so it is named
rather than averaged away.

---

## 4. Two string slices, not one compromise

`substring` keeps **exact JavaScript semantics** — both arguments clamped to
`[0, len]`, swapped when reversed — so code ported from TypeScript behaves the
way its author expects and the Node differential suite stays meaningful.

Alongside it, a **fast slice** (`sliceFast` / `subarray`, name open) with the
lean lowering: length computation, one bump allocation, one `memcpy`, and a
check that branches to a cold panic block rather than clamping. Out-of-range is
a panic, not a silent clamp.

Hot paths should avoid materialising a slice at all where they can — a counted
loop over the original string, guarded by `i < s.length`, already emits no
check at all (§2.3). A cursor the body advances by a variable amount does not
get that for free; §2.1 and §2.2 are what it waits on.

---

## 5. Error handling: `Result<T, E>`, not exceptions

Nish has no `try`/`catch` and `throw` aborts, but the answer is not to
thread sentinels by hand. It is a discriminated union:

```ts
type Result<T, E = string> =
  | { ok: true;  data: T }
  | { ok: false; error: E; message?: string };
```

Lowered as a **tagged union struct**, never a heap object:

```llvm
%Result_Node = type { i1, %Node*, %String*, %String* }   ; tag, data, error, message
```

`if (r.ok)` becomes `extractvalue` + `br i1` — one comparison, one branch.
Small results pass in registers. No stack-unwinding tables, so every function
stays `nounwind` and LLVM keeps the loop and register optimisations that
depend on it. Reading `.data` on a failed result is a *compile* error, because
the union is discriminated.

This is worth being clear about: it requires three things the language does not
have — **generic type parameters**, **discriminated unions beyond `T | null`**,
and **narrowing on a boolean discriminant**. That is the largest single
addition on the list, and it is what makes the self-hosted compiler's 292 error
sites tractable.

Generics are **full and monomorphised**: generic functions, classes and type
aliases, each instantiation compiled to its own specialised code. No boxing, no
type dictionaries, no runtime type information — an instantiation is
indistinguishable from the hand-written monomorphic version, which is the only
form compatible with §1. `Result<T, E>` then falls out as ordinary library code
rather than a compiler special case, and typed containers come with it, which
retires the hand-written `StringMap` of `wp14-selfhost.md` §2.2.

The cost is honest and large: monomorphisation touches every phase, needs an
instantiation cache keyed by type arguments, mangled symbol names, and a rule
for what happens when instantiation is unbounded (a generic function that
instantiates itself at a larger type must be a compile error, not a hang).

---

## 6. Unsigned integers

`u8`, `u16`, `u32` and `u64`. Today `i32 >>> n` yields the raw bits read as a
*signed* i32, so `-1 >>> 0` is `-1` where JavaScript gives `4294967295` — a
divergence that exists only because there is no unsigned type to put the answer
in. Unsigned types fix that class of bug properly and are what hashing,
bit-packing and the ranged types of §2.1 all want underneath.

The narrow widths are not decoration. `u8` is what a byte buffer and a lexer
actually want — `charCodeAt` returns a byte — and narrow fields pack structs
tighter, which serves the size goal at the same time. The cost is that every
conversion pair needs a stated rule and the ABI, header and N-API tables all
grow; `i8`/`i16` are deliberately left out until something needs them, to keep
that matrix from doubling again.

---

## 7. The runtime budget yields to a measured win

`runtime.c`'s 4 KB `.text` budget stays the default forcing function — for
small operations, inline IR is both faster *and* smaller, so the budget and the
northern star usually agree. When they disagree, a runtime helper may exceed
the budget **on the strength of a benchmark in the pull request**, not an
assertion. Size is second, not irrelevant.

---

## 7a. Formatting a double — **done**

The rule in §7 is that the runtime budget yields to a measured win. This is the
first one to claim it, and it turned out to be a correctness fix as well.

`String(x)` prints the fewest digits that read back as the same double. The old
`nish_str_from_f64` looked for that length by asking `snprintf` for k digits
and `strtod` whether they round-trip, walking k up from 1. Two things were
wrong with it:

- **Slow.** Up to seventeen format-and-parse round trips per number: 2,557 ns
  each, against 15 ns for the same value as an integer.
- **Wrong, about one value in twenty thousand.** `snprintf` can only return the
  *correctly-rounded* k-digit string, and the shortest string that round-trips
  at length k need not be that one. When it was not, the search rejected k and
  went on to k+1. `7.120236347223045e-307` is such a value; we printed
  `7.1202363472230444e-307`, and so disagreed with `runtime/shim.mjs`, which
  delegates to JavaScript's own `String`.

Ryu (Adams, PLDI 2018) computes the digits directly: **72 ns, a 35x speedup**,
and the shortest string by construction. Only digit generation moved; the
ECMAScript layout around it is untouched.

**What it costs, and who pays.** Two power-of-five tables, 9,888 bytes of
read-only data, generated with exact integer arithmetic rather than
transcribed. `runtime.c`'s `.text` goes 2,775 -> 3,852, still inside §2's 4 KB
budget; `.rodata` goes 32 -> 9,920. Section GC means only a binary that
actually formats a double links them: `bench/fib` is unchanged at 5,600 bytes,
`bench/nbody` goes 10,856 -> 21,168. That is the largest size regression this
project has taken deliberately, and it is recorded here rather than averaged
away. If it proves too much, Ryu's size-optimised tables (every 26th entry,
the rest recomputed) trade roughly a third of the speed for about 1.3 KB.

**How it was validated.** Against the ECMAScript rule itself, not against the
code it replaces — which is just as well, since that code was the buggy one.
Three properties per value: the digits round-trip, no shorter string
round-trips, and no same-length string is closer. Checked over 20.9 million
values: every finite exponent with boundary and random mantissas, the powers of
ten and two, small integers and their reciprocals, and uniform random bit
patterns. Zero violations. The same harness finds 46 per 1.4 million in the old
implementation.

## 7b. A private ABI inside a module — **done**

The third measured win, and the one that needed no new analysis at all: just
the observation that a function no host can name does not owe anyone its
calling convention.

WP17 packs a small `Result` into one `i64` because that is what a C or wasm
host must see. Inside a module nobody is looking, and the word costs
something: with the discriminant and the payload in one register the `select`
that picks the live arm happens on the *word*, so instcombine cannot fold the
arithmetic around it. Giving a non-exported function the two-scalar
`{ i1, i32 }` shape instead — rustc's `ScalarPair` — takes `bench/result` from
**650 ms to 464 ms**, which is C's 444 rather than 1.46x behind it.

Two decisions worth keeping:

- **The packing code did not move.** `packArm`, `packObject` and
  `unpackResult` still build and read the same word; the pair is made from it
  at the boundary and taken apart on the other side. LLVM folds the round trip
  away entirely — a hand-written two-scalar lowering measures 467 ms against
  464, the same within noise — so one packing path was worth more than the
  instructions the conversion appears to cost. The change is a predicate and a
  boundary, not a rewrite.
- **The condition is the linkage condition.** `strictExports && !exported`,
  the same test that writes `internal`, because the private shape is safe only
  while no host can name the symbol. The two must not drift, which is why the
  comment at each site says so. `--no-strict-exports` turns both off together.

This is what §3 meant when it said `--strict-exports` "does not buy a second
namespace": it does not, but it does buy a second *calling convention*, and
that turned out to be worth 1.40x on the shape the benchmark exists to measure.

## 7c. `indexOf` gets a real algorithm — **done**

The second claim on §7's rule, and the plainest one: the budget said the
string search had to be inline, and inline meant a byte at a time.

`s.indexOf(sub)` was a loop over `nish_str_at`, one probe per offset, emitted
at every call site so that `runtime.c` stayed small. Scanning an 880 KB
haystack sixty times over:

| | needle absent, rare first byte | needle absent, common first byte |
| --- | ---: | ---: |
| the inline probe loop | 53.7 ms | 53.7 ms |
| **`nish_str_index_of`, this change** | **2.9 ms** | **3.1 ms** |
| glibc `memmem`, for scale | 2.5 ms | 2.5 ms |

**About 17x**, and within a quarter of `memmem` even on the shape that suits
`memchr` least. It also *shrinks* every caller, since thirty lines of loop
become one call; `runtime.c`'s `.text` goes from 3,852 to 4,002 bytes and stays
inside the 4 KB budget, though with little room left.

**`memmem` was tried and rejected, and the reason is worth keeping.** It is a
GNU extension glibc hides behind `_GNU_SOURCE`, and defining that macro makes
`<string.h>` include `<strings.h>` — which any `-I` directory containing a file
of that name then shadows. This project *generates* exactly such a header from
`examples/strings.ts`, and the interop tests caught it immediately: `runtime.c`
picked up the generated `strings.h`, inherited `nish.h` through it, and
failed to compile with four redefinitions. A C host passing `-I` at its own
generated headers would hit the same. A fifth of the time is not worth making
the runtime sensitive to its includer's include path, so the portable
`memchr`/`memcmp` scan is the only path and there is no second one to rot.

The semantics are the loop's, unchanged: an empty needle answers 0, a needle
longer than the haystack -1, and the offset is in bytes.

## 7d. Arena provenance — **measured, and not taken**

The last item on the list this section came from, and the one that turned out
not to exist any more.

`wp9-optimisation.md` diagnosed vec3 and nbody as provenance problems: the
inline bump allocator returns `buf + offset` from a global, so LLVM sees
pointers of unknown origin that may alias, and reloads fields it could have
kept in registers. Making the allocator `noinline` — so its `noalias` return
survives as a call — measured vec3 757 -> 356 ms and nbody -6%.

Re-measured on today's compiler, the nbody edit is **1467 ms against 1479**:
noise, and slightly the wrong way. WP6's stack allocation took the objects the
experiment was recovering, and vec3 now beats C without it (0.93x Rust). So
the trade — a real call on every allocation, in exchange for provenance — buys
nothing and is not being made.

Recording it because a stale measurement is worse than no measurement: it
would have justified a change that costs a call per allocation for zero.
nbody's remaining gap (1.19x Rust, 1.16x C) is now unexplained by any theory
in either note, and that is the honest state of it.

## 8. The `performance` diagnostic class

None of the above survives contact with a codebase unless the compiler says
something when code takes a slow path. So: a third diagnostic severity beside
error and the existing output — **`performance` warnings**, reported through
the same `DiagnosticSink`, carried in `--json`, and never affecting the exit
code unless promoted.

The compiler emits one whenever it *had* to take the slow path and a faster one
was available:

| Warning | Fires when | Hint |
| --- | --- | --- |
| bounds check not eliminated | `a[i]` in a loop where neither the range nor a length guard proved it | hoist the length check, use `for...of`, or a ranged index |
| quadratic string building | `s = s + t` where `s` is assigned in an enclosing loop | build a `string[]` and `join` it |
| allocation in a loop | a `new`, array literal or concat that escapes and is inside a loop | hoist it, or bound it with an arena scope |
| not inlinable | a hot, non-exported function kept external because `--no-strict-exports` was given | drop the flag |
| clamp not folded | a `substring` whose bounds could not be proven in range | use the fast slice, or narrow the index |
| wasteful struct padding | reordering a struct's fields would shrink it | names the current size, the achievable size, and the field order that gets there |

They are **on by default and never affect the exit code**: visible to everyone,
breaking nobody. That default carries an obligation — a performance warning
must never fire on code that has no faster form. A warning nobody can act on
trains people to ignore the whole class, so "is there a concrete rewrite this
message can name?" is the bar each new warning has to clear before it ships,
and the hint column above is part of the specification rather than a nicety.

---

## 9. Sequencing

Roughly dependency order; each row that ships does so with the full construct
checklist from `docs/ARCHITECTURE.md`. Some of them no longer ship: an item a
measurement closed says so and says why.

1. **Fast defaults** (§3) — **done**. Flag flips plus the honest re-pointing
   of every affected test and doc. Small, and it moves the baseline everything
   else is measured against.
1a. **Array alias domains** (§2b) — **done**. 1.58x on an element loop, no
   language change, and it re-ordered this list: it showed that the bounds
   checks everything below was written to eliminate cost 0.5% once the header
   is hoisted.
1b. **An invariant array header** (§2c) — the other 2x, and the first item
   that needs a language decision (fixed-length arrays) or a whole-program
   analysis.
1c. **Shortest-digit formatting** (§7a) — **done**. 35x on printing a double,
   and a correctness fix; the first item to spend the runtime budget.
1d. **The private `Result` ABI** (§7b) — **done**. 1.40x on `bench/result`,
   no new analysis, and it closes the last gap to C on that shape.
1e. **`indexOf` in the runtime** (§7c) — **done**. 19x, and smaller code at
   every call site.
1f. **Arena provenance** (§7d) — **measured and dropped**. The win WP9
   recorded is gone; the change would now cost a call per allocation for
   nothing.
2. **`performance` diagnostics** (§8) — **done**. The framework plus the two
   warnings that need no new analysis: quadratic string building and allocation
   in a loop. `--no-warn-performance` is in `src/index.ts` and
   `self/compile.ts`, `PerformanceWarning` is in `src/diagnostics.ts`, both
   warnings are specified in `docs/LANGUAGE.md`, and
   `tests/cases/perf_str_concat_loop`, `perf_str_concat_quiet`,
   `perf_alloc_loop` and `perf_alloc_quiet` pin them. Only those two shipped:
   the other four rows of §8's table — bounds check not eliminated, not
   inlinable, clamp not folded, wasteful struct padding — still wait on the
   analyses that feed them.
3. **Slice iterators** (§2.3) — **measured, and not taken**. The array half was
   already banked by §2b: `for (const x of xs)` and the counted loop over
   `xs[i]` link to byte-identical binaries, and a guarded byte loop is
   byte-identical with and without `--unchecked-indexing`, so the per-iteration
   `.length` re-read the mechanism was written to remove does not reach the
   binary. The string half is declined on language grounds by
   `wp23-language-surface.md` §7. What survives is the variable-advancing
   cursor `for (const c of s)` cannot express, and its 1.094x on lexer-shaped
   code is item 6's acceptance number, not this item's.
4. **Unsigned types** (§6) — **done**. `u8`/`u16`/`u32`/`u64` are specified in
   `docs/LANGUAGE.md`, carried through the N-API and wasm bridges, and tested
   by `tests/cases/u_*` — `u_arith_wrap`, `u_compare_above_intmax`,
   `u_conv_roundtrip` and `u_conv_f64` among them — plus
   `reject_u_mixed_signedness`.
5. **Fast slice** (§4).
6. **Ranged types and length narrowing** (§2.1, §2.2) — a real flow-sensitive
   analysis; the `performance` warning for a check that survives is its
   acceptance test.
7. **Contiguous struct arrays** (§2a) — the layout change plus the
   escape rule that makes the dangling case a compile error, and the interop
   surfaces that move with the ABI.
8. **Generics, discriminated unions, `Result<T, E>`** (§5) — the largest, and
   the one self-hosting most depends on.

An explicit bounds-check opt-out (§2.4) is deferred until 6 has landed and the
surviving checks have been counted.
