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

Most of this is already what AmritScript is, which is why it is written down here
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

**3. Slice iterators.** `for (const c of s)` lowers to pointer advancement —
`p = start; end = start + len; while (p < end) { ... p++; }` — not to `s[i]`.
Memory-safe by construction and check-free by construction, which makes the
idiomatic loop also the fastest one. This is the mechanism the self-hosted
lexer should be written against.

**4. An explicit opt-out — deliberately not built yet.** A scoped `trusted`
region was considered and deferred: it is the escape hatch, and every check
mechanisms 1-3 eliminate is one nobody needs to escape. Build the proofs first,
measure how many checks actually survive them, and only then decide whether an
opt-out earns its keep. (For the record, `#trusted { }` could not have been the
spelling: AmritScript parses with the TypeScript parser, which rejects it. A
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

## 3. Fast defaults

| Flag | New default | What it buys | What it costs |
| --- | --- | --- | --- |
| `--strict-exports` | **on** | Non-exported functions get `internal` linkage: inlining, argument specialisation, dead-stripping. Wins on speed *and* size. | A non-exported function is no longer a C-ABI symbol, so the default ABI surface shrinks. `--no-strict-exports` restores it. |
| `--nsw` | **on**, with `--wrapping` to opt out | Signed overflow becomes undefined, so LLVM may widen induction variables and strength-reduce loops. | **Withdraws the documented wrapping guarantee.** Overflow is UB unless `--wrapping` is given. |

The `--nsw` change is the largest semantic change in this note and it must be
handled honestly rather than quietly:

- `docs/LANGUAGE.md`'s "integer overflow wraps" becomes "integer overflow is
  undefined by default; `--wrapping` restores two's-complement wrapping".
- Every differential corpus program that relies on wrapping is run with
  `--wrapping`, so the Node oracle keeps testing something real rather than
  comparing against undefined behaviour.
- The `.out` and golden cases that pin wrapping (`const_wrap`, the i32
  overflow cases) either move to `--wrapping` via their `.args` or are
  re-stated as UB and removed. Deleting a test to get green is forbidden; each
  one is re-pointed deliberately and the reason recorded.

---

## 4. Two string slices, not one compromise

`substring` keeps **exact JavaScript semantics** — both arguments clamped to
`[0, len]`, swapped when reversed — so code ported from TypeScript behaves the
way its author expects and the Node differential suite stays meaningful.

Alongside it, a **fast slice** (`sliceFast` / `subarray`, name open) with the
lean lowering: length computation, one bump allocation, one `memcpy`, and a
check that branches to a cold panic block rather than clamping. Out-of-range is
a panic, not a silent clamp.

Hot paths should use slice iterators (§2.3) and avoid materialising a slice at
all where they can.

---

## 5. Error handling: `Result<T, E>`, not exceptions

AmritScript has no `try`/`catch` and `throw` aborts, but the answer is not to
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

## 8. The `performance` diagnostic class

None of the above survives contact with a codebase unless the compiler says
something when code takes a slow path. So: a third diagnostic severity beside
error and the existing output — **`performance` warnings**, reported through
the same `DiagnosticSink`, carried in `--json`, and never affecting the exit
code unless promoted.

The compiler emits one whenever it *had* to take the slow path and a faster one
was available:

| Warning | Fires when | Hint | State |
| --- | --- | --- | --- |
| quadratic string building | `s = <something built from s>` where `s` is a string local declared outside the loop the assignment sits in | build a `string[]` and `join` it | **shipped** |
| allocation in a loop | `new Array<T>(n)` with a non-constant `n`, declared inside a loop, whose value never leaves the iteration | hoist it, or bound it with an arena scope | **shipped** |
| bounds check not eliminated | `a[i]` in a loop where neither the range nor a length guard proved it | hoist the length check, use `for...of`, or a ranged index | needs §2.1 |
| not inlinable | a hot, non-exported function kept external because `--no-strict-exports` was given | drop the flag | later |
| clamp not folded | a `substring` whose bounds could not be proven in range | use the fast slice, or narrow the index | needs §4 |
| wasteful struct padding | reordering a struct's fields would shrink it | names the current size, the achievable size, and the field order that gets there | later |

They are **on by default and never affect the exit code**: visible to everyone,
breaking nobody. That default carries an obligation — a performance warning
must never fire on code that has no faster form. A warning nobody can act on
trains people to ignore the whole class, so "is there a concrete rewrite this
message can name?" is the bar each new warning has to clear before it ships,
and the hint column above is part of the specification rather than a nicety.

### 8a. What shipped

The framework and the two warnings that need no analysis the checker does not
already have. Files: `src/diagnostics.ts` and `self/diagnostics.ts` (the
severity), `src/checker/performance.ts` and the WP15 section at the end of
`self/checker.ts` (the analysis), `src/index.ts` and `self/compile.ts` (the
flag and the printing). Tests: `tests/cases/perf_*` and the WP15 §8 block of
`tests/run.js`.

**The shape of a warning.** The same anchored, excerpted diagnostic an error
is, with `performance` where the word `error` would be:

```
tests/cases/perf_alloc_loop.ts:10:11: performance: `row` allocates a dynamically sized array on every
iteration of this loop and nothing keeps it past the iteration, so the arena grows once per pass: hoist
the allocation above the loop and reuse it, or bracket the loop body with `Arena.mark()` and `Arena.release(m)`
  10 |     const row = new Array<i32>(width + i);
     |           ^~~
```

Choosing `performance` rather than `warning` for that word means nothing that
greps `: error: ` picks a warning up, and the human line says the same thing
the machine field does. In `--json` that field is `"severity":"performance"`,
which is what a tool filters on; `message` carries no prefix, because the
severity already says what it is.

**Severity, the exit code and the sink.** A warning is a `PerformanceWarning`
in stage0 and a `Diagnostic` with `kind = "performance"` in stage1, and in
both it lives in a second list on the `DiagnosticSink` that is never thrown
and never cleared between phases. `hasErrors` stays a statement about errors,
so a program that trips a warning compiles and exits **0**.

Three consequences worth writing down:

- **A failed compilation prints no warnings at all.** An error report is never
  diluted with advice about code that is about to change anyway, and it keeps
  the single-error output byte-identical to what WP10 pinned.
- **The 20-warning cap is separate from the 20-error cap**, and shaped the
  same way: 20 in full, then `...and N more performance warnings`, then an
  `N performance warnings` line. A lone warning prints exactly its message.
  The two budgets never compete, because a compilation prints one or the other.
- **No sort.** The analysis meets warnings in module load order and then in
  source order, which is exactly the order `throwIfErrors` sorts errors into,
  so there is nothing to sort and no second file-order table to keep in step
  with the error report's.

**The flag: `--no-warn-performance`, default on.** §8 asks for on by default
and that is what shipped. It costs nothing in the suite: outside the four
`perf_*` cases written for it, nothing in `tests/cases/` trips either warning —
its concatenations in loops are either non-accumulating or outside a loop — and
the golden loop compares `.ll` files and a case's stdout, never the compiler's
stderr. The flag deliberately does
**not** reach `CompilerOptions`: the checker computes the warnings either way
and only the driver consults the flag, so the option struct that
`--emit-checked`, the interop surfaces and both compilers mirror is untouched,
and the IR is byte-identical with the flag and without it.

**Where the analysis lives: the checker, in a per-function pass after the body
is checked**, beside `checkResultLocalsHandled`. Both facts are syntax plus
the types and bindings pass 2 already wrote, so nothing is re-derived and no
extra traversal of anything else is needed. The emitter could not host them:
`emit/*.ts` reports no user-facing diagnostics at all and an unexpected node
there is exit 70. A poisoned body is skipped.

**Quadratic string building** fires on `s = <rhs>` where `s` is a string
local, the assignment is inside a loop, `s` was *not* declared inside that
innermost loop, and `rhs` reaches `s` through `+` operands, parentheses or
template holes. `s += t` is not a case: `+=` requires numeric operands in this
language, so the only spelling is `s = s + t`. The false-positive guards, each
with a case in `tests/cases/perf_str_concat_quiet.ts`:

| Not warned | Why |
| --- | --- |
| `line = part + "!"` in a loop | the result does not include the target: one bounded string per pass, linear |
| an accumulator declared *inside* the loop | reset every pass, so it is bounded by one iteration |
| `head = head + "b"` outside any loop | one copy, once |
| `s = f(s)`, `s = cond ? s : t` | only `+` and template holes are followed; anything else may copy nothing, and a guess would break the "name a concrete rewrite" bar |
| `this.buf = this.buf + t` | the target is a field, not a local; hoisting a field into a builder is not a rewrite this message can name |

A `for` initializer runs once, so `for (let s = ""; ...) { s = s + t; }` does
warn; a `for...of` variable is a fresh binding every pass, so it does not.

**Allocation in a loop** is the one that needed the most narrowing, because
WP6 already does the right thing for most of it (`docs/wp6-memory.md` §1).
What warrants a warning is exactly the intersection of *the compiler could not
put it on the stack* and *the value dies with the iteration*:

| In a loop | WP6 does | Warned |
| --- | --- | --- |
| `new C(...)`, `{ ... }`, `[a, b]`, `new Array<T>(<literal>)`, flow `local` | one entry-block alloca, slot reused every pass | **no** — free already, nothing to hoist |
| `new Array<T>(n)`, `n` not a literal, flow `local` | arena, released only when the *function* returns | **yes** — the arena grows once per pass |
| any of the above, flow `returned` or `leaks` | arena, and rightly so | **no** — the program asked for N objects |
| `a + b`, a template, `readFileSync` | arena | **no** — the quadratic case is the string warning's; a bounded concat per pass is linear and necessary |
| a call to a user function returning a pointer | depends on the whole-program fixpoint | **no** — the checker cannot know, and a guess would be the un-actionable kind |

"Dies with the iteration" is decided conservatively over the innermost
enclosing loop: every reference to the local must be an element read or write,
a `.length`, or a `for...of` source. A `push`, an argument, a store, a
`return`, a reassignment or a bare mention all suppress the warning, because
any of them may keep the value and hoisting would then be wrong. The guards
have a case in `tests/cases/perf_alloc_quiet.ts`.

Two things deliberately left out of this warning, both because they buy
precision the checker cannot pay for cleanly: a stackable allocation whose
data exceeds `STACK_ARRAY_BYTES` (the checker would have to import a codegen
constant, inverting the layering), and promotion of the class to an error,
which §8 leaves to whoever needs it.

**What it found.** Run over the whole corpus, the two warnings fire in exactly
two places outside the `perf_*` cases written for them, and both are true
positives:

- **`self/lexer.ts` lines 506, 509, 608 and 611** build the text of a string
  and of a template literal one character at a time with `text = text + ...`
  inside a `while` loop — the very shape `.claude/selfhost.md` forbids in
  `self/` and §1 measures at 180 MB of peak RSS for 88 KB of output. This is a
  real performance bug in the self-hosted compiler's lexer, found by the
  warning on its first run, and it is left for the change that fixes it
  (a `StringBuilder`, as the rest of `self/` already uses).
- **`bench/strbuild.ts`**, which exists to measure exactly this and is
  therefore the one place where the slow form is the point.

---

## 9. Sequencing

Roughly dependency order; each row ships with the full construct checklist from
`docs/ARCHITECTURE.md`.

1. **Fast defaults** (§3) — flag flips plus the honest re-pointing of every
   affected test and doc. Small, and it moves the baseline everything else is
   measured against.
2. **`performance` diagnostics** (§8) — **done**: the framework plus the two
   warnings that need no new analysis (quadratic string building, allocation in
   a loop). What actually shipped, and the cases each warning deliberately
   stays silent on, are in §8a.
3. **Slice iterators** (§2.3) — the biggest speed win per line of emitter code,
   and no new syntax.
4. **Unsigned types** (§6) — foundational for §2.1, touches every numeric path,
   so earlier is cheaper.
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
