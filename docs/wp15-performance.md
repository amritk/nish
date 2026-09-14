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
§2a fixed the half of it that can be fixed without changing what a `class`
means: an array of *records* (an `interface`) is contiguous storage. An array
of classes is still one pointer per slot, and §2a says why and what the
measurement was.

---

## 2. Zero-cost safety: the bounds-check pipeline

A bounds check is the largest per-instruction cost in the loops that matter,
and the choice is *not* between unsafe speed and safe slowness. The compiler
should prove the access safe at build time and emit no check at all. Four
mechanisms, tried in order, with the runtime panic only as the floor:

**1. Ranged integer types — the analysis shipped, the syntax did not.**
`number` says nothing a compiler can use. A constrained integer does:

```ts
function getByte(buf: FixedBuffer<256>, i: integer<0, 255>): u8 {
  return buf[i];   // proof: i <= 255 < 256 — no check emitted
}
```

That spelling needs a generic type parameter, which Phase 0 refuses and which
§9 item 8 owns, so item 6 could not have built it without building item 8's
prerequisite first — the sequencing rules it out, and this note had not
noticed. What shipped instead is the *range analysis* the declared form would
have fed: `src/checker/bounds.ts` and `self/bounds.ts` infer the range of every
integer local from the guards, loop conditions and initialisers already in the
program, and from the one ranged type the language does have — `u8`/`u16`/
`u32`/`u64`, whose lower bound is the declaration rather than a proof. A
declared range is then one more source of facts for the same domain, which is
a smaller change than it looks from here.

**2. Length-narrowing type guards — shipped, as facts rather than as types.**
A length check proves an index for the region it reaches, so the check happens
once outside the loop instead of once per access:

```ts
if (data.length >= 4) {
  const magic = data[0];   // proven, no check
}
```

The plan's spelling was that `data` *becomes* `[u8, u8, u8, u8, ...u8[]]` in
the guarded block. It does not: the tuple type would have to be threaded
through assignment, parameter passing and the two type tables, and everything
it buys is already bought by recording `data.length >= 4` as a fact keyed by
the variable. The facts are `i >= 0`, `i < w.length`, `i <= w.length`,
`i < n` and `w.length >= n`, and the rules that invalidate them are the
soundness argument — they are written out in `src/checker/bounds.ts` and
stated normatively in `docs/LANGUAGE.md` under "Element access".

The shape the domain most obviously cannot hold is **`min`**:

```ts
const shorter = a.length < b.length ? a.length : b.length;
while (i < shorter) { if (a[i] !== b[i]) { ... } }
```

`shorter <= a.length` and `shorter <= b.length` are both true, and both follow
from the *condition* rather than from either arm, so a fact keyed by one
variable and one holder cannot carry them: the then-arm gives
`shorter <= a.length` and the else-arm `shorter <= b.length`, and their
intersection is empty. Recognising `c ? a.length : b.length` where `c` is
`a.length < b.length` would be sound and would close it, and it is deliberately
not done: a peephole inside a soundness-critical analysis is how a wrong
elision gets in, and nothing has measured this shape yet. It is what
`std/text.ts`'s `firstDifference` and `self/strings.ts`'s `compareStrings`
report, and it is four of the surviving warnings in the whole tree.

**What it measured.** On the lexer-shaped scan of §2.3 below — a cursor the
body advances by a variable amount, 400 passes over 547 KB of this
repository's own source — **1.069x**, against a floor of 1.082x that removing
*every* check buys on the same program. CPU time rather than wall time, min of
15 after 3 warm-ups, `--profile speed`, x86-64 with LLVM 18, because the box
was carrying five other agents' test suites and wall time under a load average
of 25 on four cores measures the neighbours:

| | CPU min | CPU median | checks left in the module |
| --- | ---: | ---: | ---: |
| before | 673 ms | 678 ms | 2 |
| **proven** | **630 ms** | 639 ms | 1 |
| `--unchecked-indexing` | 623 ms | 632 ms | 0 |

The 7 ms between the proven build and the unchecked one is not a check in the
loop: the hot `@scan` function is **byte-identical** between them (178 lines
and four `nish_panic_index` calls before, 138 and none in both after). What is
left is `process.argv[1]`, which runs once at startup, plus code layout. The
shortfall against §2.3's 1.094x is the program rather than the analysis — this
scan carries an `isDigit` arm that one did not — and the thing that matters is
that there is no check left in the loop to remove.

On an ordinary counted loop over an array it recovers nothing measurable, which
§2b had already predicted: once the header is hoisted, the checks are worth
about 0.5%. The honest summary is that this item is worth what §2b said it was
worth, and that the place it is worth time is the string cursor; everywhere
else it buys code size and `willreturn`.

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

**4. An explicit opt-out — deliberately not built, and now with the count
behind that.** A scoped `trusted` region was considered and deferred: it is the
escape hatch, and every check mechanisms 1-3 eliminate is one nobody needs to
escape. Build the proofs first, measure how many checks actually survive them,
and only then decide whether an opt-out earns its keep. Item 6 has landed and
the count is in: over the whole of `self/` — sixty modules, about fifty
thousand lines, the most index-heavy program this repository has — **seventeen
checks survive inside a loop** in a shape the analysis could have proved, and
every one of them is an invariant the program has and the compiler cannot see:
two arrays the program keeps the same length, a `min(a.length, b.length)`
cursor, a merge sort's three indices into two buffers. Seventeen sites do not
justify a language feature, and each of them already has a rewrite the warning
names. The opt-out stays unbuilt. (For the record, `#trusted { }` could not have been the
spelling: Nish parses with the TypeScript parser, which rejects it. A
labelled block `trusted: { ... }` or a `/* @trusted */` pragma would be the
candidates.)

**Floor: the runtime check stays.** When none of the above proves it, the panic
is emitted, as today. Safety is the default; speed is what the proofs buy.

Between 2 and 4 sits LLVM's own bounds-check elimination, which already removes
the check from ordinary counted loops. Part of this work is *measuring* how
much it gets on its own before hand-building analysis that duplicates it.

---

## 2a. Arrays of records are contiguous — **done**

`Point[]` stored **one pointer per element**: the array data was
`%struct.Point**`, each entry pointing somewhere in the arena. Iterating it
chased a pointer per element and scattered the fields across memory — the exact
pattern §1a exists to avoid, sitting in the middle of the language.

An array of **records** is now **contiguous values**: `N` structs end to end,
one allocation, `ps[i]` an interior `getelementptr` rather than a
load-then-chase, at exactly the stride and alignment clang gives the matching C
array (`tests/layout/structs.c` walks one through a C `struct P *`).

### A record is an `interface` nobody implements, and this is where the item changed shape

The plan said "arrays of structs". The language has two struct kinds, and only
one of them can be given value semantics without changing what the language
means:

- An **`interface`** is fields and nothing else — no constructor, no methods,
  no `this`. The only thing a program can observe about one is its fields, so
  copying it into a slot is indistinguishable from pointing at it. This is the
  flat record §1a is written about.
- A **`class`** has identity. A constructor runs on one object, a method
  mutates the `this` it was handed, and every other position in the language —
  a parameter, a field, a return, a local — passes a class value by reference.
  Making an array the single place a class is *copied* would give
  `xs.push(c); c.m()` a different meaning from `xs.push(c); xs[n].m()`, and
  nothing else in the language works that way.

That is not a conservative guess; it was measured on the largest Nish program
there is. `self/` keeps one `FunctionSig` in `program.functions`, in
`StructInfo.methodSigs` and in `StructInfo.ctor` at the same time and then
writes `sig.poisoned` through one of them; `declareStruct` registers a
`StructInfo` and goes on filling in the object the registry now holds. With
value slots those are separate objects and every such write is lost. A stage1
built with class arrays as values rejects `self/` with 41 errors of the form
"`Field ctor of class StructInfo` has no initializer and no constructor assigns
it" — the registry handing back a copy whose constructor never ran. Every
registry in that compiler is built the same way. That was first read as a
migration somebody would do later; it was then costed, and it is not one, so
**an array of classes is one pointer per slot by decision** — the subsection
after "Measured" below is the costing and what it found.

An **interface some class `implements` is not a record either**: that array is
the language's only polymorphic container — a `Shape[]` holding a `Square` and
a `Circle` — and both implementers are longer than `Shape`, so a value slot
would slice them. The property is recorded on the shared `StructInfo` by
`checkImplements`, which runs for every module before any body is checked, so
one compilation has one layout for `Shape[]` everywhere in it. That is also why
there is no anti-slicing diagnostic: nothing that could be sliced is ever
stored inline.

`C | null` stays a pointer too, whichever kind `C` is: a null element has no
bytes to be. That spelling is how a program asks for a sparse array of records
and is the way out of the copy semantics.

### The hazard, and the rule that closes it

Growing an array reallocates, so an interior pointer taken before a `push`
dangles afterwards:

```ts
const p = ps[0];    // interior pointer into the array data
ps.push(other);     // may reallocate and move the data
p.x = 1.0;          // would write to freed memory
```

**The checker rejects it** (`NL2290`): an element reference may not be held
across a mutation of the array it came from. The reference is a `const` bound
to `a[i]` or `a.pop()`, or the variable of a `for (const p of a)`; the mutation
is a `push` or a `pop` on the same array, or any call handed that array as a
non-`readonly` parameter. A loop is checked as a whole, because a `push` at the
bottom of the body reaches a reference taken at the top on the next pass.
`ps.push(ps[i])` has a message of its own (`NL2291`) — the argument is read
after the growth has already moved the block. It rejects some programs that
would have been fine, and that is the accepted cost of the layout; the message
names the fix.

The analysis is `codegen/escape.ts`'s, run in the phase that is allowed to
report — a source-order walk of one body, references followed from the
declaration that binds them through every identifier that names them, blocks
popped when they end. It lives in `checker/arrays.ts` and `self/arrays.ts`
beside the array family it belongs to, hung off `checkFunctionBody` next to the
§8 performance warnings, because the emitter reports no user errors at all.

### Measured

x86-64, LLVM 18, `--profile speed --number-mode f64`, min of 7 runs, the same
program twice with `Point` spelled `interface` and `class` — which is exactly
the two layouts.

| Shape | pointers | contiguous | |
| --- | ---: | ---: | --- |
| 200k records, a second array built in the same loop, 2000 passes | 1864 ms | **820 ms** | **2.27x** |
| 1M records built in traversal order, 200 passes | 588 ms | 579 ms | 1.02x, noise |
| 8192 records, `d.x = s.x * 2.0` elementwise, 150k passes | 1501 ms | 1500 ms | none |

**Read the last two rows before quoting the first.** A bump allocator lays
objects out in allocation order, so when a program builds an array and then
walks it in the same order, the old pointer layout was *already* contiguous
underneath and the extra load costs nothing the out-of-order core cannot hide;
and when the working set is L2-resident the extra load is free whatever the
order. The 2.27x is what the layout buys when allocation order and traversal
order differ — which is what happens the moment a program builds two arrays in
one loop, or allocates anything else between elements. That is the common case
in real code and it is the case §1a is about, but "arrays of structs were
chasing pointers across memory" was only true for some of them.

This changes the array ABI, so the C header, the runtime's own documentation
and the layout test move with it. The wasm bridge and the N-API shim decline
these functions exactly as before: the missing half was never the layout, it is
that JS has no typed array of a struct, so a host would need a per-field unpack
loop and a JS object per element — marshalling rather than a view.

### Class elements: measured against `self/`, and closed rather than deferred

§2a left class elements out and called the migration "the work, not the
layout". The migration was then looked at properly, against the program that
has to survive it, and it is not a migration of `self/`: it is a change to what
`T[]` *means* for every class `T`, and `self/` is only the largest program that
would be caught by it. Three things were checked, in rising order of how hard
they are to route around.

**One `FunctionSig`, three holders.** `collectMethod` ends

```ts
owner.methodIndex.set(name, owner.methodSigs.length);
owner.methodSigs.push(sig);
ctx.program.functions.push(sig);          // self/structs.ts
```

and `collectConstructor` the same with `owner.ctor = sig`. Pass 2 reaches the
signature through `program.functions` and writes `sig.poisoned = true`
(`self/checker.ts`); the emitter reaches it through `methodSigs`. With value
slots those are two copies and a pointer, the write lands on one of them, and
the emitter emits a body the checker rejected. `declareStruct` has the same
shape one level up: it calls `addStruct`, which does
`structList.push(info)`, and then hands `info` back for `collectStructMembers`
to fill in — so the registry's copy would keep `size = 0` and `ctor = null`
for every struct in the program. This is the aliasing §2a describes, and it is
the tractable part: a registry can be rewritten to construct in place, and
`(FunctionSig | null)[]` keeps today's pointer semantics for a registry that
should not copy.

**Fifty-four comparisons ask whether an element of such an array *is* a given
object.** Not equal — the same object. The count is a walk of every file in
`self/` with the TypeScript compiler API rather than a grep, and the rule is
worth stating because the obvious grep is what got this wrong the first time:
a `===` or `!==` whose **two operands are both class-typed**, where at least
one of them is an element read out of a **class-typed array** — either `a[i]`
directly or the binding of a `for (const x of a)`. That is **54 operators on
50 lines in 10 modules**:

| module | operators | lines |
| --- | ---: | ---: |
| `self/bounds.ts` | 20 | 16 |
| `self/attributes.ts` | 13 | 13 |
| `self/escape.ts` | 11 | 11 |
| `self/checker.ts` | 4 | 4 |
| `emit.ts`, `emit_util.ts`, `assignment.ts`, `symbols.ts`, `dump.ts`, `interop_abi.ts` | 1 each | 1 each |

```ts
if (state.belowIndex[k] === i && state.belowHolder[k] === w) { ... }  // self/bounds.ts
for (const x of list) { if (x === v) { return true; } }              // self/bounds.ts, contains()
if (this.declared[i] === local) { ... }                              // self/checker.ts, the §8 walk
if (this.slotLocals[i] === local) { ... }                            // self/emit.ts
if (this.refLocals[i] === local) { ... }                             // self/escape.ts
if (this.narrowedVars[i] === variable) { ... }                       // self/symbols.ts
if (list.children[i] === node) { ... }                               // self/attributes.ts
```

The `contains()` line is the one a grep for `x[i] === y` cannot see and the
one the `nonNegative` family is built on, and a grep for `===` cannot see the
`!==` half at all — which is where the real hazard turned out to be. Every one
of those arrays is `Local[]` or `Node[]`, and `Local` and `Node` are classes. A
value slot makes each comparison weigh an interior pointer against the
original, which is never equal. (Widen the rule to *every* class-typed identity
comparison in `self/`, element-sourced or not, and it is 80 across 19 modules;
that is the ceiling on what the change could alter the meaning of.)

**In `self/bounds.ts` the failure mode is a miscompile, not a slow program.**
Twenty of the 54 are there, in the module whose seven `Local[]` fact arrays are
the WP15 §2 proof itself, and they split in two. The *lookups* —
`knownBelow`, `knownAtMost`, `maxIndexOf`, `knownMinLength` — answering "not
found" only loses proofs, and a check that survives is indeed a slower program.
The *invalidation* is the other half, and this module's own header calls it
"the whole soundness argument": `forget` and `forgetUpperBounds` keep a fact by
testing `!==` against the variable being clobbered, nine operators on the seven
lines `self/bounds.ts:333`, `:345`, `:357`, `:374`, `:383`, `:395` and `:408`.
An identity test that never matches makes every one of those guards always
true, so no fact is ever forgotten and the analysis proves things that stopped
being true:

```ts
const xs: i32[] = [7];
let i = 0;
if (i >= 0 && i < xs.length) { i = i + 1; console.log(xs[i]); }
```

The guard proves `i < xs.length` for `i = 0`; the increment has to retract it.
Today that program emits one `bounds.fail` block and prints
`index out of range: 1 >= 1` with exit 1. Compiled with those seven lines
forced always-true it emits **no bounds check at all**, reads one element past
the end of a one-element array, prints whatever is there and exits 0. That is
a wrong program, not a slow one.

**And the suite does say so** — which is why nothing new has to be written to
guard a migration that is not happening. `tests/cases/arr_bounds_proven.ll` is
a golden whose entire assertion is the *absence* of the check: not one
`bounds.fail` block, not one `nish_panic_index`. Simulating the lookup half —
every fact lookup answering "not found" — takes it from **0 `nish_panic_index`
calls to 5**, in five `bounds.fail` blocks, 197 golden lines against 249, and
`arr_bounds_proven: IR matches golden` fails; `perf_bounds_quiet` fails the
same way. Simulating the invalidation half instead — the half that is a wrong
program rather than a slow one — leaves both of those **passing**, and fails
`perf_bounds_loop: IR matches golden` alone. One golden of the three, not
three: the two halves are caught by different cases, and rounding that up is
the same kind of error this subsection exists to remove. It is the *first* case
that loses its check — "Two arrays, one length: nothing says `ys` is as long as
`xs`" — where the loop guard proves `i < xs.length`, `xs` has a literal length
of 3, and the `maxIndex` fact that `i = i + 1` has to retract survives instead.
Three `bounds.fail` blocks become two, the removed one sits in the `i` loop,
and the two surviving `NL9007` warnings are at lines 20 and 28, not line 12.
That is the *fewer checks* direction the snippet above turns into a bad read,
and the shape that detects it is a literal-length array plus a bound surviving
an increment — not the downward cursor of the third case, which keeps its check
either way. And for a regression that would be `self/`'s alone,
`tests/self/ir_oracle.js` compares `IR(stage0, p)` with `IR(stage1, p)` byte for
byte over the whole corpus. The hazard is loud. What it is not is benign.

**And the syntax tree would be storage rather than a tree.** `Node` is one
class carrying the union of every kind's fields — the Nish-0 design
`.claude/selfhost.md` describes — and its children are `children: Node[]`.
Under value elements `parser.finish` pushes a child into `node.children` and
its caller pushes the returned `node` into *its* parent's children, so every
node is copied once per level of nesting it ends up under, and the deepest
expressions in a real program pay that most. `self/attributes.ts` already asks
`list.children[i] === node`, which stops being answerable at all. A syntax
tree is the one structure in a compiler that is all identity and no traversal
locality, which makes it the worst candidate there is for the layout §2a
shipped — and `Local[]` and `Node[]`, the two arrays this section keeps coming
back to, are the two most common class-typed arrays in `self/`. The same walk
counts the *declarations* of such a slot, under a rule worth stating as
precisely as the one above: every syntactic position that declares a slot and
carries an explicit type annotation — a property declaration or interface
member, a variable declaration, a parameter — whose annotation is `C[]` where
the element type is a class, or a union whose every non-`null` member is one,
so that `Local[]` and `(FunctionSig | null)[]` both count. A *return* type is
not a slot and is excluded, which is what separates holding one of these from
merely mentioning one. That is **168 declarations over 36 element classes**,
with `Local[]` at 47 and `Node[]` at 18 ahead of everything else. This is not a
corner of the compiler that the migration would touch.

**What it would have bought, and what already buys it.** §2a's 2.27x is a
property of the *layout*, not of the struct kind: it is what a contiguous array
of small records buys on a loop whose allocation order and traversal order
differ. A program that wants it can have it today by declaring the element type
an `interface`, which is what §2a shipped, and `C | null` is the way back to a
pointer array. What a class element would add over an `interface` element is
methods and a constructor on the element type — worth something, but not worth
changing what `xs.push(c); c.m()` means, which is the price, and not worth it
against a language where nothing else copies a class.

So this is **closed by decision rather than deferred**: an array of classes is
one pointer per slot, permanently, and the contiguous shape is spelled
`interface`. `docs/LANGUAGE.md` already states the rule that way, and
`inlineElementStruct` is where the decision lives in the code — in
`src/checker/program.ts`, which carries the argument, and in `self/program.ts`,
which carries the rule and points at it. The first of those read "a separate
change with a migration of its own" until this section was written, and the
second sent the reader to it for the full argument; both say "a decision and
not deferred work" now, because a comment that defers is a comment that invites
somebody to pick the work up.

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
| + the header treated as invariant | 373 ms | 3.23x, and it vectorises — was read as §2c's to buy; §2c measures main already there **on this shape**, and 2.48x short of it when the array is in a class field |
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

## 2c. Making the header invariant — **candidate 1 refuted, the item re-scoped**

§2b stopped the header from being *clobbered* and predicted that stopping it
from *changing* was worth the same again: 763 ms with the domains, 373 ms with
the header treated as invariant, "3.23x, and it vectorises — needs §2c". The
prediction was re-measured on two loop shapes rather than one, and the two
answers point in opposite directions.

- On a loop over two array **parameters** — the shape §2b measured — the win is
  banked already: main is where §2b said only an invariant header could put it,
  and marking every header load moves the time by 2 ms.
- On the same loop with the array in a **class field** — the shape `self/` is
  written in, and `self/bounds.ts` is made of — nothing is banked. **2.48x** is
  still on the table.

So one of §2c's two candidates is finished and the other is not. **Candidate 1,
marking the header `!invariant.load` off a `readonly T[]` spelling, is
refuted**: it is a wrong answer rather than a slow one, and the program that
shows it is below. **Candidate 2, hoisting the header in the emitter, is not
refuted** — it is exactly what the field shape is waiting for, and the field
shape is its acceptance program and its 2.48x the acceptance number. Item 1b
stays open for it, narrowed to that.

### The box, and what every number in this section was run on

x86-64, Ubuntu clang 18.1.3 (LLVM 18), four cores carrying several agents' test
suites at once — a load average around 25 — which is why the measure is **CPU
time (user + sys)** and not wall time, for the reason §2 gives. Min of 15 after
3 warm-ups, `--profile speed`, 8192 doubles and 150,000 passes in every row.
Each variant is compiled and linked with

```bash
node dist/index.js <prog>.ts -o <prog>.ll --profile speed
# ... edit the .ll for the stripped and the marked rows ...
scripts/build.sh <prog>.ll runtime/runtime.c -o <bin> --profile speed
```

and the second line `cmp`s equal to what the compiler's own `--link` writes, so
the hand-edited `.ll` builds and the compiler's own are comparable. Every program is
given in full, because a number whose program is not named cannot be audited and
§1 says faster means measured.

### The parameter shape: banked, and an invariant header adds nothing

```ts
export const scale = (dst: f64[], src: f64[]): void => {
  let i: i32 = 0;
  while (i < src.length) {
    dst[i] = src[i] * 2.0;
    i = i + 1;
  }
};

export const main = (): number => {
  const n: i32 = 8192;
  const src: f64[] = new Array<f64>(n);
  const dst: f64[] = new Array<f64>(n);
  let i: i32 = 0;
  while (i < n) {
    src[i] = toF64(i);
    i = i + 1;
  }
  let acc: f64 = 0.0;
  let pass: i32 = 0;
  while (pass < 150000) {
    scale(dst, src);
    acc = acc + dst[0];
    src[0] = src[0] + 1.0;    // so that 150,000 passes are not one pass, folded
    pass = pass + 1;
  }
  console.log(`${acc}`);
  return 0;
};
```

| build | CPU min | CPU median | |
| --- | ---: | ---: | --- |
| alias domains stripped out of the emitted `.ll` (§2b's "before") | 1208 ms | 1232 ms | reproduces §2b's 1205 ms |
| **main today** | **305 ms** | 311 ms | **3.96x** |
| + every header load `!invariant.load` (12 in the module) | 307 ms | 313 ms | noise: 2 ms |

Main lands where §2b's invariant row is, with no invariant header anywhere in
the module. After `opt -O3` the loop vectorises `<2 x double>` in `@scale` and
again in the copy inlined into `@nish_main`; with the alias domains stripped it
vectorises nowhere. Both halves of that — no header load left in the loop, and
the loop vectorising — are pinned by `tests/cases/arr_alias_domains`, so the
banked win cannot go quiet.

The third row is where this section previously recorded a **byte-identical**
binary. On this program it is not byte-identical: the marked build is 248 bytes
smaller (18,784 against 19,032), because in *this* program the marking happens
to be true — `main` never pushes — so LLVM is entitled to use it, and does, in
the array-filling loop. What reproduces is the conclusion rather than the bytes:
there is no time in it.

### The field shape: 2.48x is still on the table, and invariance is not how to take it

The same loop with the source array held in a class field, which is how `self/`
is written — and the only change from the program above:

```ts
class Holder {
  xs: f64[];
  constructor(xs: f64[]) {
    this.xs = xs;
  }
}

export const scale = (dst: f64[], h: Holder): void => {
  let i: i32 = 0;
  while (i < h.xs.length) {
    dst[i] = h.xs[i] * 2.0;
    i = i + 1;
  }
};
```

with `main` building the same 8192 doubles, wrapping them in one `Holder` before
the timing loop, and calling `scale(dst, h)` 150,000 times.

| build | CPU min | CPU median | |
| --- | ---: | ---: | --- |
| alias domains stripped out of the emitted `.ll` | 1230 ms | 1249 ms | |
| **main today** | **756 ms** | 768 ms | 1.63x on the domains, and **2.48x behind the parameter shape** |
| + every header load `!invariant.load` (13 in the module) | 305 ms | 310 ms | |
| + `const xs = h.xs` hoisted **by hand in the source** | 306 ms | 308 ms | |

The last row is the one that decides the item. A hoist a programmer can write in
the source recovers all of it, so the win does not need an invariance claim and
does not need a language change: it needs the compiler to do that hoist, which
is candidate 2. The third row only says the same thing in an unsound way.

### What the 2.48x actually is, which is not a header load in the loop

The obvious reading — the field shape pays for re-reading `h.xs`, `len` and
`data` every iteration — is what the `opt -O2` dump of `@scale` alone shows, and
it is **not** what the binary does. In the linked `--profile speed` build, no
field-shape variant has a header load in its hot loop, unmodified `main`
included. Disassembled, the inner loop of the 756 ms build is ten instructions
at `4250`–`4278`: two bounds compares and their branches, an element load, the
add, an element store, the increment and the latch. The `mov (%r12),%rsi` and
`mov 0x10(%r12),%r8` that read `len` and `data` sit at `4240`–`4244`, in the
per-pass preamble outside it. `opt -O3` agrees once `scale` is inlined into
`@nish_main`: the field load and both header loads hoist in *every* field
variant.

What separates the two groups is **vectorisation**, and it is visible in the
binary:

| build | `mulpd`/`movupd` in the binary | CPU min |
| --- | ---: | ---: |
| field, main | **0** | 756 ms |
| field + every header load `!invariant.load` | 4 | 305 ms |
| field + `const xs = h.xs` in the source | 4 | 306 ms |
| parameter | 4 | 305 ms |

The field shape reads `h.xs.length` **twice** — once for the `while` condition,
once for the bounds check — and hoisting the loads does not make the two one
value. The parameter shape's two lengths become a single trip count under
`opt -O2` (`llvm.umin.i64` of `src.length` and `dst.length`, computed in the
preheader) and the loop has one exit; the field shape gets no `umin`, keeps both
compares against separate values — in the binary `cmp %r9,%rdi` beside
`cmp %r9,%rsi` — and a loop with that second exit is one the vectoriser
declines. The source hoist is what collapses them, because it gives the two uses
one `const`.

**One piece of metadata does collapse them, and it is the unsound one.** With
all 13 header loads marked `!invariant.load`, `@nish_main` acquires
`%umin = tail call i64 @llvm.umin.i64(i64 %9, i64 8191)` and a `vector.body`,
and the binary runs at 305 ms — row 2 of the table above. That is not a
counter-example to the argument, it *is* the argument: the only annotation that
makes the two lengths one value is the one that tells LLVM the location cannot
change for the whole life of the program, which §2c's next part shows is a
miscompile. Sound metadata does not reach it; the two probes below are what that
looks like.

That is what makes the criterion sharp, and it is worth stating before anyone
builds to it: **"hoist the header once per loop" is satisfiable while buying
nothing.** A preheader load plus a fresh `len` for each bounds check is "hoisted
once per loop" and still runs at ~750 ms. It does *not* then resemble the
parameter shape where it counts, and the resemblance is the trap: the probe
below has no header load in its loop and no `umin`, two length values, two exits
and no `vector.body`, while the parameter shape has `umin` in the preheader, one
exit and `vector.ph`/`vector.body`. So "does my `opt -O2` dump look like the
parameter shape's?" is not the acceptance test. The acceptance test is **one
length value feeding both the loop condition and the bounds check**, and the
thing to look for is the `umin` — or one compare where there were two.

**Describing more of the heap to LLVM is not the fix, and that was probed rather
than assumed.** Two hand edits to the field-shape `.ll`, neither of them
proposed as sound — an array of records stores struct fields *inside* an element
buffer, which is exactly why §2b left struct fields alone:

| hand edit to the `.ll` | loads of `h.xs`, `len` or `data` left in `@scale`'s `opt -O2` loop | CPU min |
| --- | ---: | ---: |
| none (main) | 3 | 756 ms |
| the array-typed field load put in the header scope | 1 | — |
| + `!dereferenceable`/`!nonnull`/`!align` on it, so the header load can be speculated out of the bounds-checked block | **0** | **761 ms** |

The last row is the instructive one: it reaches the state the naive criterion
asks for — not one header load left in `@scale`'s loop under `opt -O2` — and the
program is 5 ms *slower* than the one it was supposed to fix. Two lengths are
still two lengths, there is still no `umin`, the loop still has the extra exit,
and the binary still contains no vector instruction. Which is the argument for
candidate 2 doing the hoist in the IR the emitter produces, where one value can
feed both uses and every inlined copy inherits it, rather than for annotating
the field load and hoping.

### The multiplier is program-dependent, so the range is the honest answer

§2b's middle row (763 ms, the domains alone) is not reproduced here on the
parameter shape, and this note declines to book the whole distance from 1208 ms
to 305 ms as the domains' either. What the domains are worth, measured in one
run on one box on one compiler, is **1.63x on the field shape and 3.96x on the
parameter shape** — the same metadata, the same element loop, two spellings of
where the array is kept. §2b's own 1.58x is inside that range and stays the
number that item 1a shipped with.

The reason the range is wide is the reason this section exists: what the domains
buy is a *hoist*, and the hoist is worth whatever else in the loop was standing
on it. So quote the range, and name the shape with any single number.

### Candidate 1 is unsound, and `readonly T[]` is why

"`readonly T[]` already carries most of the proof" was wrong, and the way it is
wrong is a wrong answer rather than a slow one. `readonly` constrains the
*holder*, not the array: the callee may not write through it, and the caller
still holds the mutable one.

```ts
const total = (xs: readonly i32[]): i32 => {
  let s = 0;
  let i = 0;
  while (i < xs.length) {
    s = s + xs[i];
    i = i + 1;
  }
  return s;
};

export const main = (): number => {
  const xs: i32[] = [1, 2, 3];
  const a = total(xs);
  xs.push(4);
  const b = total(xs);
  console.log(`${a} ${b}`);   // 6 10
  return 0;
};
```

`!invariant.load` does not mean "this does not change while the callee runs".
LLVM's LangRef says the location holds the same value **at every point in the
program where it is dereferenceable**, so one `push` anywhere in the array's
life is undefined behaviour rather than a lost hoist.

Be exact about what shows it, because this is the paragraph a reader checks by
hand. Marking **every header load in the module** — the five of them, including
the three in `@nish_main` where the `push` is — makes that program print `6 6`.
Marking only the two inside `@total`, which is the whole of what a `readonly`
parameter could ever justify, prints `6 10` here. That is not the marking being
sound: the program is undefined either way, and the second spelling is the worse
position to be in, because it is an entitlement LLVM has not cashed yet and no
rule says when it will.

The same experiment over the whole of `self/` is the scale of it. At this
branch's head, 60 modules and **7,068** header loads marked, where the unmarked
build links at **988,296** bytes (the pair was 6,675 and 939,784 before
`2861f8c` reached this branch through `main`, so quote it with a commit or
re-derive it). What comes out is not a slower compiler. The marked build links
at **22,048 bytes — 2.2% of the unmarked compiler, measured twice and
byte-identical between links — and it cannot parse its own argv**: handed a file
to compile it answers ``compile: unknown flag `tiny.ts` `` and exits 2, where
the unmarked build compiles the same file. `self/options.ts` is where argv
parsing lives, and LLVM had taken the contradiction and deleted almost the whole
program around it.

The deletion is what reproduces; its severity is not. At two earlier heads, on
this same box and the same clang/LLD 18.1.3, the marked build did not link at
all — `ld.lld: undefined symbol: Options.constructor`, the same definition
dropped one step further along — while a second box linked it at three different
mark counts. Nobody has identified what varies, and nothing here needs it to be
identified: a compiler deleted to 2.2% of itself and a compiler whose remains do
not link are both the contradiction being taken, rather than an optimisation
being declined.
**An invariant header needs a proof that no `push` reaches the array for the
whole of its life, and neither `readonly` nor a fixed-length spelling of
`Int32Array` gives one while the array is still reachable from a mutable
binding.** Fixed-length arrays stay a language question for M4's reference
freeze (`docs/LANGUAGE.md`, "Typed-array names are aliases"); what this
measurement removes is the speed argument for opening it.

### What is left is candidate 2, and `self/bounds.ts` is where it is waiting

The field shape is not a synthetic one. `knownAtMost` in
[`self/bounds.ts`](../self/bounds.ts) is it, verbatim — a `while` over
`state.atMostIndex.length` reading `state.atMostIndex[k]` and
`state.atMostHolder[k]` — and it is the ordinary way to write a loop in a
compiler whose state is a class.

```bash
node dist/index.js self/compile.ts -o build/selfir/ --profile speed
opt -O2 -S -mtriple=x86_64-unknown-linux-gnu build/selfir/bounds.ll
```

```llvm
bounds.ok:
  %9  = load ptr, ptr %5, align 8, !alias.scope !22, !noalias !25   ; atMostIndex.data, per iteration
land.rhs:
  %13 = load i64, ptr %7, align 8, !alias.scope !22, !noalias !25   ; atMostHolder.len,  per iteration
bounds.ok.1:
  %15 = load ptr, ptr %8, align 8, !alias.scope !22, !noalias !25   ; atMostHolder.data, per iteration
```

Up to three header-domain loads an iteration — the first unconditionally, the
other two only on a match, since `land.rhs` and `bounds.ok.1` are reached when
`atMostIndex[k]` is the index being asked about — in a loop that otherwise only
reads two elements. **24 functions in that one module** still carry a
header-domain load inside a loop (counted by walking the `opt -O2` CFG for
blocks that reach themselves), so the answer to "what real code has this shape"
is: the compiler this repository is written in, all through.

Two things to keep straight about that module, because the resemblance is to the
*source* shape rather than to the mechanism. `knownAtMost` reads a class field
holding an array in a loop, which is the shape verbatim; but its own field load
is already hoisted to `entry`, and what keeps `len` and `data` in the loop is
that they sit in conditionally-reached blocks where the load cannot be
speculated — not the field-versus-element aliasing this section measured. Same
symptom, a different cause, and one candidate 2's hoist also reaches, since a
header the emitter loads in the preheader is loaded unconditionally.

So candidate 2 stands, and it is what item 1b now means: hoist the header in the
**emitter**, once per loop, wherever the compiler can prove nothing in the loop
grows the array — which does not depend on an invariance claim, on `readonly`,
or on what LLVM chooses to keep across GVN. The criterion is the sharp one
above: **one length value feeding the loop condition and the bounds check
both**, since a hoist that leaves two is worth nothing and the probe table
proves it. It needs the whole-program "does not grow an array" fact that the
`attributes.ts` fixpoint does not have yet — the same fact `checker/bounds.ts`
wants, where *any* call drops every array length fact today for exactly this
reason. Its acceptance is the field-shape program above, at the parameter
shape's number: 756 ms to 305 ms, 2.48x, with the `self/bounds.ts` loops as the
real-code check that the fact fires where it matters.

What this section no longer claims is a **3.35x** it used to attribute to LLVM's
GVN dropping `!alias.scope` from header loads it created itself. That number
named no program, no flags and no file, so nobody could re-run it; under §1 it
was not a measurement, and it is withdrawn rather than restated. Metadata
preservation may still be a real second-order effect — but it would have to be
measured on a named program before anything is built for it, and the field shape
above is the one that is both measured and on real code.

### The same refutation kills one more live proposal, so it is named here

[`wp9-optimisation.md`](wp9-optimisation.md) ends its nbody section with a
proposal to mark the loads of `bodies[i]` — array **data**, not the header —
`!invariant.load` "inside that function", for a function that never stores an
element. Candidate 1's refutation reaches it more directly than it reaches
`readonly T[]`, and this note says so rather than leaving a live proposal for
the same miscompile uncited. `!invariant.load` has no "inside that function":
the LangRef scopes it to every point in the program where the location is
dereferenceable, so a caller that writes `bodies[i]` between two calls is
exactly the `6 10` → `6 6` program above with the element buffer in place of the
header. The arena makes it worse rather than better, because it never frees: the
window in which the location stays dereferenceable is the life of the process.
Whatever closes nbody's gap, it is not that marking.

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

## 4. Two string slices, not one compromise — **done**

`substring` keeps **exact JavaScript semantics** — both arguments clamped to
`[0, len]`, swapped when reversed — so code ported from TypeScript behaves the
way its author expects and the Node differential suite stays meaningful.

Alongside it, a **fast slice** with the lean lowering: length computation, one
bump allocation, one `memcpy`, and a check that branches to a cold panic block
rather than clamping. Out-of-range is a panic, not a silent clamp.

**The name is `slice`, and the two this note proposed could not have been it.**
`sliceFast` and `subarray` are both `TS2339: Property '...' does not exist on
type 'string'` under `tsc --strict` (verified, not assumed), and the rule
[wp23-language-surface.md](wp23-language-surface.md) §7 declines `for...of`
over a string to protect is that an Nish program is a TypeScript program
`tsc --strict` also accepts. A method nobody else has is a worse break of it
than a loop that means something else, because it does not even compile.
`slice` is in `lib.es5.d.ts` as `slice(start?: number, end?: number): string`,
so the language gains no name of its own and a reader's editor already knows
what it returns.

What `slice` does *not* keep is JavaScript's argument handling, and that is the
point of having two: `0 <= start <= end <= s.length` or it panics, where
JavaScript counts a negative offset from the end and answers `""` for a
reversed pair. That is the same shape of divergence `charCodeAt` already
carries — JavaScript answers `NaN` out of range and Nish panics — and it is
recorded the same way, in `docs/LANGUAGE.md`'s method table and in
[wp13-differential.md](wp13-differential.md).

The lowering is two `icmp ule` against a cold `nish_panic_slice` block, one
`sub`, one `getelementptr` and one `nish_str_new`. Two compares are the whole
range test because a negative offset sign-extends to a value above any byte
length, which is the trick the array bounds check already uses. With no `end`,
`end` *is* `len` and only the ordering compare is emitted.

**Measured**, x86-64, LLVM 18, `--profile speed`. A lexer-shaped scan slices
every word out of a 300 KB source, 2,000 passes — 40,000,000 slices of 14
bytes each:

| | min wall | |
| --- | ---: | --- |
| `substring` | 734 ms | six `llvm.smin` / `llvm.smax` per slice |
| **`slice`** | **618 ms** | **1.18x** |

Wall time on a loaded machine is the weaker half of that, so the number the
claim rests on is instructions retired, which does not care what else is
running: over 100 passes of the same scan, `callgrind` counts **339,516,079**
against **313,516,079**, 8.3% of the whole program and exactly
**13 x86-64 instructions per slice**. `llc -O3` bears that out statically: the
scan function is 74 instructions with `substring` and 65 with `slice`, and the
six `cmov` the clamp leaves behind are zero in the `slice` build. The copy is
identical in both, which is why the win is a constant per call rather than a
factor: `slice` is worth reaching for where slices are small and many, and
worth nothing where one slice copies a megabyte.

The other half of the argument is not about instruction counts at all. **A
check is provable and a clamp is not.** `tests/cases/str_slice` slices constant
offsets out of a literal and `opt -O2` deletes every compare, branch and panic
block in the module — a golden cannot express that, so `tests/run.js` asserts
no `nish_panic_slice` survives. No optimiser can do the same to `substring`,
because its `smin`/`smax` are not a check that might be redundant but part of
the answer it is defined to give. That is what makes this two constructs rather
than one replacing the other, and it is what §2.1's ranged types will extend:
every proof they add removes a `slice` check and none of them can remove a
clamp.

`slice` costs one runtime symbol, `nish_panic_slice`, rather than reusing
`nish_panic_index`: a reversed pair is as common a mistake as an end past the
string and `index out of range: i >= len` describes neither. It prints the two
offsets signed although the check compares them unsigned, so someone who wrote
`s.slice(i - 1)` is told `-1` rather than 18446744073709551615. That is 113
bytes of `.text` at `-Oz` (16,844 to 16,957), spent under §7's rule on the
measurement above.

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

The runtime's compiled-code budget stays the default forcing function — 4 KB of
`.text` for the single `runtime.c` when this note was written, and one ceiling
per translation unit since the operating-system half was split out
(`docs/wp7-runtime.md` §"Runtime additions and budget" carries both and the live
measurements). For small operations, inline IR is both faster *and* smaller, so
the budget and the northern star usually agree. When they disagree, a runtime
helper may exceed the budget **on the strength of a benchmark in the pull
request**, not an assertion. Size is second, not irrelevant.

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
calling convention — nor, it turned out, the *shape* of its values.

WP17 packs a small `Result` into one `i64` because that is what a C or wasm
host must see. Inside a module nobody is looking, and the word costs
something. It took two steps to stop paying for it, and the second one is
where the benchmark's remaining gap was.

**Step one: the tag leaves the word.** With the discriminant and the payload
in one register the `select` that picks the live arm happens on the *word*, so
instcombine cannot fold the arithmetic around it. Giving a non-exported
function the two-scalar `{ i1, i32 }` shape instead — rustc's `ScalarPair` —
takes `bench/result` from **650 ms to 464 ms**, which is C's 444 rather than
1.46x behind it. That step moved no packing code: `packArm`, `packObject` and
`unpackResult` still built and read the word, the pair was made from it at the
boundary and taken apart on the other side, and LLVM folded the round trip
away entirely — a hand-written two-scalar lowering measured 467 ms against
464, the same within noise.

**Step two: the two arms stop sharing a slot.** 464 ms was C's number, and
Rust was at 253. One payload slot means the ok arm and the error arm are still not
separate SSA values, which is exactly what
[wp17-result-abi.md](wp17-result-abi.md) §4's four-way table blamed: `half`'s
two `return`s meet in one `i32`, so after inlining the value the ok path reads
is `phi(n, n >> 1)`, and instcombine folds that to the *variable* shift
`n >> (1 - odd)`. The enclosing `select` cannot undo it — nothing propagates
"on this arm `odd` is 0" into a shift amount — so the loop carries a shift
whose count is a data dependency. Widening the private ABI to `{ i1, i32, i32 }`,
one slot per arm with the dead one `undef`, removes the `phi` instead of
fighting the fold: `phi(undef, n >> 1)` is `n >> 1`, and the shift is constant
again. `bench/result` goes from **1.84x behind Rust `-O3` to 1.00x** — 218 ms
against Rust's 218 ms in [BENCHMARKS.md](BENCHMARKS.md), with the program's own
C twin at 405 ms — and leaves the WP9 gap table.

This step *did* move the packing code — `armsForArm`, `armsForObject` and
`unpackArms` in `emit/result.ts` build and read the arms directly, rather than
routing through a word that has only one slot to route through. That is the
one thing step one got wrong about itself: the word round trip was free, but
the *shape* it round-tripped through was not.

**The condition is the linkage condition**, in both steps.
`strictExports && !exported`, the same test that writes `internal`, because
the private shape is safe only while no host can name the symbol. The two must
not drift, which is why the comment at each site says so.
`--no-strict-exports` turns both off together.

This is what §3 meant when it said `--strict-exports` "does not buy a second
namespace": it does not, but it does buy a second *calling convention* — and
then a second *value shape* to go with it. On the shape the benchmark exists
to measure that was worth **1.40x** in the first half and **1.8x again** in
the second.

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
was available — and, since the arithmetic rules below, whenever it can *prove*
that a piece of arithmetic does not compute what it was written to compute.
Those are not performance advice, and the honest thing would be a severity of
their own; they ride this class because it already has the shape they need (on
by default, never fatal, filterable in `--json`) and a fourth severity is a
change to a machine-readable contract, which is worth making once rather than
per rule. What they share with the rest of the class is the bar: a concrete
rewrite, named in the message.

| Warning | Fires when | Hint |
| --- | --- | --- |
| allocation dropped by an assignment | `p = new Point(n)` where `p` was declared holding an allocation and nothing captured that value first: the old value is unreachable, nothing frees it, and the assignment costs the function its arena scope as well | a `const` per value, or an explicit `Arena.mark()` / `Arena.release(m)` bracket |
| constant computed with overflow | a `+`, `-` or `*` over decimal literals whose value does not fit the `i32` it is computed in, under the default `nsw` | widen the operands with `toI64`, or pass `--wrapping` if the wrap is intended |
| product widened after wrapping | `toI64(a * b)` / `toF64(a * b)` where the multiplication is `i32`. Multiplication only: `+` and `-` overflow too, but `toI64(intBits(t) - 1)` is the same shape with nothing wrong with it | convert the operands first: `toI64(a) * toI64(b)` |
| shift count at or beyond the width | `x << 32` on an `i32`, where the count is masked and the shift that runs is not the one written | mask deliberately, or shift a wider value |

and the original six:

| Warning | Fires when | Hint |
| --- | --- | --- |
| bounds check not eliminated | `a[i]` or `s.charCodeAt(i)` in a loop where neither the range nor a length guard proved it, and where the receiver and the index are both plain locals — the shape the analysis knows how to prove | guard the access with `if (i >= 0 && i < a.length)`, which proves both ends wherever it reaches, or give the index an unsigned type, which proves the lower one |
| quadratic string building | `s = s + t` where `s` is assigned in an enclosing loop | build a `string[]` and `join` it |
| allocation in a loop | a `new`, array literal or concat that escapes and is inside a loop | hoist it, or bound it with an arena scope |
| not inlinable | a call **inside a loop** to a function the module does not export, while `--no-strict-exports` is keeping it an external symbol | drop the flag |
| clamp not folded | a `substring` **bound** the §2 proof could not place in `[0, s.length]`, on a call inside a loop | the guard that proves it, which makes the compiler write the bound through, or `slice`, which has no clamp |
| wasteful struct padding | reordering a struct's fields would shrink it | names the current size, the achievable size, and the field order that gets there |

The bar cuts both ways, and the dropped-allocation rule is where it shows.
A function that loses its arena scope to a local assigned in a branch retains
its memory exactly as one that drops an allocation does, and is not reported,
because the rewrite that would fix it does not exist. That gap is written down
in [wp6-memory.md](wp6-memory.md) under "Left out", with the two ways to close
it: a "captured only into one binding" fact in the escape analysis, or an
opt-in `--report-arena` audit that reports placements without warning about
them.

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
1b. **An invariant array header** (§2c) — **candidate 1 refuted, candidate 2
   open, and the item re-scoped to it**. What is closed is the `readonly T[]`
   marking: `readonly` constrains the holder rather than the array, so a
   caller's `push` between two calls makes the marking undefined behaviour and
   not a lost hoist — a twenty-line program that must print `6 10` prints `6 6`
   with every header load in its module marked — and the whole of `self/` marked
   that way (60 modules, 7,068 header loads, 988,296 bytes unmarked) comes out
   as a **22,048-byte** compiler — 2.2% of the unmarked one — that answers
   ``compile: unknown flag `tiny.ts` `` where the unmarked build compiles the
   file. The deletion is what reproduces; its severity is not, and two earlier
   heads on the same box produced `ld.lld: undefined symbol:
   Options.constructor` instead. What is **not** closed is the win. On a loop over two
   array *parameters* it is banked — 305 ms against the 1208 ms that stripping
   the alias domains reproduces, and an invariant header moves that by 2 ms —
   but on the same loop with the array in a **class field**, which is how
   `self/` is written, main is at 756 ms: **2.48x** still on the table,
   recovered in full by writing `const xs = h.xs` by hand in the source. That
   hand hoist is candidate 2 — the emitter hoisting the header in the preheader
   where nothing in the loop can grow the array — and the field-shape program of
   §2c is its acceptance program at 2.48x. Its criterion is **one length value
   feeding the loop condition and the bounds check both**: §2c's probe reaches
   zero header loads in the loop by hand and measures 761 ms, because two
   lengths leave the second loop exit that stops the vectoriser. `self/bounds.ts`
   is the source shape verbatim — `knownAtMost` over `state.atMostIndex.length`,
   and 24 functions in that one module carry a header-domain load inside a loop.
   The item's prerequisite is the whole-program "does not grow an array" fact
   the `attributes.ts` fixpoint does not have yet, which is also what
   `checker/bounds.ts` wants.
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
   `perf_alloc_loop` and `perf_alloc_quiet` pin them.

   **The four rows that were said to be waiting are now three answers and one
   correction**, and nine of §8's ten rules exist:
   - **bounds check not eliminated** — shipped with item 6, not waiting.
     `NL9007`, `tests/cases/perf_bounds_loop` / `perf_bounds_quiet`. This row
     had gone stale.
   - **clamp not folded** — shipped, `NL9009`, and with it the fold it had
     presupposed. Measuring first showed the premise was half wrong, and the
     half that stands is the half the warning fires on. Where the receiver is a
     *parameter*, `opt -O3` keeps all six `llvm.smin` / `llvm.smax` calls
     whether or not a dominating guard proves both ends: the guard compares
     `i32` and the clamp runs on the `sext`, the length is re-read on every
     pass, and `nish_str_new` — which every `substring` calls — is not
     `readnone`, so nothing proves the second read equals the first. Where it
     can hoist the length, LLVM does find it unaided: a string literal in a
     local with `const n = s.length` and a loop counter folds from six to zero
     at `-O3` before this change — and so, for that matter, does
     `tests/cases/perf_clamp`, the case that ships the warning, whose receiver
     is a literal. So the claim is shape-qualified wherever it is written down
     (`checker/bounds.ts`, `emit/strings.ts`, the message itself), and the
     compiler folds the clamp out of the §2 facts it already has rather than
     leaving it to a pass that only sometimes gets there.

     "Keeps all six" is exact for the call with two guarded bounds. Its
     neighbour `s.substring(0, i)`, `i` guarded, goes six to **two** at `-O3`
     before this change: the optimiser folds the literal `0`'s clamp and the
     swap and keeps the clamp on `i` — the one bound the warning is about. So
     the shape the warning fires on is the shape the optimiser does not reach,
     which is what the rule needed to be true and is narrower than "all six".

     A literal `0` is proven for every string, which is why `s.substring(0, n)`
     — the commonest spelling there is — loses two of its six intrinsic calls
     with nothing rewritten: the cookbook's `head` went from six to four. Over
     `self/` the fold takes **218 `llvm.smin`/`llvm.smax` calls to 190**
     (12.8%), with three bounds it could not prove left warning — one in
     `self/strings.ts` and two on one line of `self/manifest.ts`.

     **What the fold is worth in time is `bench/substr.ts`**, which is
     committed so that the figure can be re-derived: two scans of a 40 KB
     string into 16-byte pieces, same control flow and same guard, differing
     only in whether the §2 proof comes off, timed in alternating rounds inside
     the program. Measured **1.10x** (21.5 ms against 19.4 ms for 1,024,000
     calls: the program's own minimum of 15, best of seven runs under
     `taskset -c 2` on a busy shared machine, where the spread between runs is
     wider than the effect and the minimum is the only stable statistic) —
     about 2 ns a call, which is **six** intrinsic calls rather than the four
     the emitter left out. Exported so that neither scan is inlined away and
     run through `opt -O3`, the two bodies come out at six calls against zero:
     dropping the clamps is what lets LLVM prove `at <= at + 16` and fold the
     swap pair too, which it cannot do while each end has been through an
     `smin`/`smax`. The whole gap is still this change, and nothing else
     differs between the two scans. Slice width is what moves it: with
     `at + 16` changed to `at + 4` throughout, the same program measures
     **1.20x** (55.3 ms against 46.1 ms), because the clamp is a fixed cost per
     call and the `memcpy` is not. That is the ceiling, on a loop that does
     nothing but slice; §4's 1.18x for `slice` over `substring` is what the
     same instructions plus the two swap calls are worth on lexer-shaped code.
     `tests/cases/perf_clamp`, `perf_clamp_quiet`, `perf_clamp_order`,
     `perf_clamp_rebind`.
   - **not inlinable** — shipped, `NL9008`, and it is smaller than the row
     sounded: **it is a size, not a time.** `--no-strict-exports` costs
     `bench/sieve` **240 bytes** — 6,576 against 6,816 — and the mechanism is
     visible in the IR: `opt -O3` inlines and deletes `@sieve` under the
     default, where it is `internal`, and keeps the out-of-line copy under the
     flag. The wall clock does not move. Five interleaved protocols on a
     pinned core put the two builds within 2.4% of each other with the sign
     flipping between them (minimum of 25: 746.9 ms against 764.8; three runs
     of 20: 741.0/748.1, 752.3/761.1, 754.8/747.0; a paired run of 40: 732.1
     against 720.7, with the flagged build ahead in 22 rounds of 40), which is
     a machine, not a compiler. An earlier draft of this note reported 848 ms
     against 882 ms and called it 4% slower; that figure does not reproduce and
     is withdrawn. `bench/spectral` is the same either way (450.6 ms against
     453.2, minimum of 20) and its binary is 64 bytes *smaller* with the flag,
     since the single call site is inlined in the linked build regardless and
     only the surviving copy differs.

     The warning therefore names the missed whole-program specialisation and
     no speed figure. It still fires only at a call inside a loop to a function
     the module does not export, and only when the flag is given — which means
     it can never be noise for a default build.
     `tests/cases/perf_inline` / `perf_inline_quiet`.
   - **wasteful struct padding** — still not shipped, and what blocks it is
     the *report* rather than the analysis. The layout is already computed
     (`computeLayout` in `checker/classes.ts`, `StructInfo.size`/`align` and
     `FieldInfo.offset`), so the better packing is arithmetic. But a struct is
     laid out in pass 1 and every §8 warning today comes out of one
     source-order walk in pass 2, so the warning would print ahead of every
     warning in the same file. Closing it means giving the warning list a sort,
     in both compilers, which changes the order of a machine-readable stream
     and is worth doing deliberately rather than as a side effect of a
     diagnostic.
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
5. **Fast slice** (§4) — **done**. `slice`, not `sliceFast` or `subarray`:
   both names this note proposed are `TS2339` under `tsc --strict`, and
   `wp23-language-surface.md` §7's rule is what settles it. 1.18x on a
   lexer-shaped scan and 8.3% fewer instructions retired whole-program, which
   is 13 x86-64 instructions per slice; and, unlike a clamp, the check folds
   away entirely where the bounds are provable, which is the half of the case
   that item 6 compounds. `tests/cases/str_slice`, `str_slice_panic`,
   `reject_str_slice_arity`, `reject_str_slice_type` and
   `tests/differential/corpus/str_slice` pin it.
6. **Ranged types and length narrowing** (§2.1, §2.2) — **done, and smaller
   than it was written**. The flow-sensitive analysis shipped
   (`src/checker/bounds.ts`, `self/bounds.ts`), and with it the §8 warning for
   a check that survives, which is what proves it worked. What did *not* ship
   is the declared surface: `integer<0, 255>` needs the generics of item 8, so
   the sequencing forbids it, and the tuple form of the length guard buys
   nothing the facts do not. Measured **1.069x** on the lexer-shaped cursor of
   item 3, against the 1.082x that removing every check buys on the same
   program — the hot function comes out byte-identical to the
   `--unchecked-indexing` build, so there is no check left in the loop — and
   nothing measurable on a counted array loop, exactly as §2b said: once the
   header is hoisted the checks cost about 0.5%. An index proven here also
   takes `nish_panic_index` out of the function's callee set, so a function
   whose every index is proven keeps `willreturn`.
7. **Contiguous record arrays** (§2a) — **done for `interface` elements, and
   closed for class elements**. 2.27x on a loop whose allocation order and
   traversal order differ, and nothing at all when they agree — the measurement
   that re-scoped the item. The layout, the escape rule (`NL2290`/`NL2291`)
   that makes the dangling interior pointer a compile error, and the C header
   and layout test that move with the ABI, in both compilers. **Class elements
   are not a deferred half any more.** The migration was costed against `self/`
   and it is not a migration of `self/`: it changes what `T[]` means for every
   class `T`. One `FunctionSig` is held in `program.functions`, in
   `StructInfo.methodSigs` and in `StructInfo.ctor` at once and written through
   whichever is to hand; **54 comparisons on 50 lines in 10 modules** ask
   whether an element of a `Local[]` or a `Node[]` *is* a given object, 20 of
   them inside `self/bounds.ts` — nine on the seven lines of `forget` and
   `forgetUpperBounds`, where an identity test that never matches means a fact
   is never retracted and the compiler emits no check where one is needed, a
   miscompile rather than a slow program, and one `perf_bounds_loop` fails on:
   `arr_bounds_proven` and `perf_bounds_quiet` fail on the *lookup* half
   instead, which costs checks and not soundness; and the syntax tree itself
   would become storage, copied once per level of nesting. What the layout buys
   is available today by declaring the element type an `interface`,
   and `C | null` is the way back to a pointer array — so an array of classes is
   one pointer per slot by decision. §2a records the three findings and how each
   number was counted.
8. **Generics, discriminated unions, `Result<T, E>`** (§5) — the largest, and
   the one self-hosting most depends on.

An explicit bounds-check opt-out (§2.4) is deferred until 6 has landed and the
surviving checks have been counted.
