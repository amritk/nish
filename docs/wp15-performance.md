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

Roughly dependency order; each row ships with the full construct checklist from
`docs/ARCHITECTURE.md`.

1. **Fast defaults** (§3) — flag flips plus the honest re-pointing of every
   affected test and doc. Small, and it moves the baseline everything else is
   measured against.
2. **`performance` diagnostics** (§8) — the framework plus the two warnings that
   need no new analysis (quadratic string building, allocation in a loop).
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
