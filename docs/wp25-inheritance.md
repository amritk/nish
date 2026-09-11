# WP25: Inheritance removed, `implements` widened

**Landed.** This note is the plan of record for two changes made in one
commit, because neither is coherent without the other:

1. `extends`, `super` and method overriding are removed from the language.
2. `implements` becomes a **prefix** check rather than an exact field match,
   which is what keeps the one thing inheritance was good for.

[LANGUAGE.md](LANGUAGE.md) is normative for what the language *is*; this note
says why. [wp2-classes.md](wp2-classes.md) keeps the record of WP2b, the
inheritance this removes.

## 1. The rule it is judged by

The rule MASTER_PLAN §1 and [wp15-performance.md](wp15-performance.md) §1a set
is that an addition must either close a functional gap or cost nothing at run
time. A *removal* is judged by its mirror: what does the feature buy, what does
it cost, and is anything left that cannot be said without it?

## 2. What inheritance bought, and why it was not enough

Single inheritance gave three things. Two of them are cheap to replace and the
third never worked.

- **A field prefix.** `%struct.D` was `B`'s fields followed by `D`'s own, so a
  `D*` was a valid `B*` after one `bitcast`. This is real and worth keeping —
  §3 keeps it.
- **Member reuse.** A derived class inherited the base's fields, methods and
  constructor. Composition covers the data (a field of the base's type) and a
  free function covers the behaviour; what neither covers is *inline* layout,
  which is again §3.
- **Polymorphism.** This is the reason hierarchies exist, and Nish never had
  it. Dispatch is static: `d.m()` resolves to the `m` of `d`'s **declared**
  type. So the classic use — hold a `Base[]`, call `m()`, get each object's own
  behaviour — silently did the wrong thing.

That third point is not a missing optimisation, it is the feature's purpose,
and the language had already refused it: a vtable means an indirect call, and
the whole-program fact pass of §3a cannot prove purity, termination or escape
facts through one. Inheritance without virtual dispatch is the syntax of a
hierarchy with none of the payoff.

## 3. What replaced it: `implements` as a prefix

`class C implements I` used to require `C`'s fields to equal `I`'s exactly.
Now `I`'s fields must be `C`'s **first** fields, in order and with identical
types; `C` may declare more after them.

```ts
interface Shape { x: i32; y: i32; }

class Square implements Shape { x: i32; y: i32; side: i32; /* ... */ }
class Circle implements Shape { x: i32; y: i32; radius: i32; filled: boolean; }
```

```llvm
%struct.Shape  = type { i32, i32 }
%struct.Square = type { i32, i32, i32 }
%struct.Circle = type { i32, i32, i32, i1 }
```

A `Square*` becomes a `Shape*` with one `bitcast`, a `Shape` operation reads
and writes the `Square`'s own bytes at the same offsets, and two classes with
different tails live in one `Shape[]`. That is the whole of what `extends`
was doing for a program that could not rely on dispatch.

The layout claim is pinned rather than asserted: `tests/layout/structs.ts`
declares `K`, `L` and `M` — the three classes that used to be derived — as
classes implementing an interface, and they are still 24, 16 and 32 bytes,
with the C twin's `_Static_assert`s unchanged. A class's own fields reuse the
prefix's tail padding, which a nested `struct L { struct Flipped f; i32 c; }`
would not.

**Interfaces carry no behaviour**, and that is the point rather than a gap: an
interface has no methods (it never did), so there is nothing to dispatch and
nothing for two implementations to disagree about. Shared behaviour is a free
function over the interface type, which the attribute pass reads as an ordinary
`nocapture readonly` pointer parameter — a borrow, in the language the
optimiser already speaks.

## 4. What the removal bought

**The language's only knowing divergence from JavaScript.** Static dispatch
through an override is what
[RUN_UNDER_NODE.md](RUN_UNDER_NODE.md) listed among the four things no prelude
can reach: *"Method dispatch is virtual under Node, static natively."* The same
program printed different numbers depending on which side ran it —

```
                        Node    native
areaOf(sq)                 9        0
sq.report()              100       10
```

— and `tests/differential/known-failures.txt` carried `cls_extends_override`
as a by-design failure. With no overriding, every method call in a program
names exactly one symbol, and the entry is gone rather than explained.

Two smaller declarations went with it:

- **The parity oracle's inheritance-cycle entry.** stage0 reported a cycle once
  per class in it and stage1 once, because stage0's `throw` left a `collecting`
  marker set. `tests/self/parity.js` had carried the difference as DECLARED
  with a paragraph of justification. No rule, no declaration.
- **The `tsc` ambient divergence for an implicit `super()`.** Nish let a
  derived constructor omit `super(...)` when no ancestor constructor took
  parameters; JavaScript throws at the first `this`. It was the only accepted
  program in the corpus that `tsc` refused, and now `arr_typed_views` is the
  last one.

## 5. What it cost, measured

Almost nothing, which is the argument.

| Surface | Count |
| --- | ---: |
| `self/` — derived classes declared | **0** |
| `examples/`, `bench/` — uses | **0** |
| `tests/cases/` — positives deleted | 4 |
| `tests/cases/` — `reject_*` deleted | 16 |
| `tests/link/` — programs deleted | 2 |
| `docs/cookbook/` — entries replaced | 1 |

The self-hosted compiler is 25,911 lines over 57 modules and declares no
derived class at all. That is not an accident:
[wp14-selfhost.md](wp14-selfhost.md) §2.1 chose **one `Node` class with a
`kind: i32` discriminant** over a hierarchy, and Nish-0 — the subset `self/` is
written in — was defined as the language minus "inheritance and downcasts".
The largest Nish program in existence had already declined the feature.

Sixteen `reject_*` cases collapse into two, because sixteen rules collapse into
two: `extends` is refused, and `super` is refused. Both live in the **checker**
rather than Phase 0, by the doctrine [wp22-arrow-functions.md](wp22-arrow-functions.md)
§6 states for a removed spelling — Phase 0 is for what the language can never
compile, and inheritance compiled fine until this note. Both messages name the
rewrite.

## 6. What is not affected

- **No IR moved.** Not one golden `.ll` changed except the ones whose programs
  were deleted, and the three layout classes emit the same bytes at the same
  offsets they did as derived classes.
- **`self/` did not change**, so the bootstrap fixpoint (`IR(stage1) ==
  IR(stage2)`, stage3 byte-identical to stage2) is re-established over the
  same source, and the diagnostic-code registry appended three numbers
  (`NL2277`–`NL2279`) without renumbering one.
- **Classes are otherwise untouched**: fields, layout, constructors, methods,
  `readonly`, definite assignment, `new`, identity `===`, and the interop
  sidecars all work as WP2 describes them.

## 7. What is still open

- **Dynamic dispatch.** Nothing here adds it, and nothing here forecloses it.
  If it is ever wanted, the shape to reach for is Rust's: a trait object with
  an explicit `dyn`-style opt-in at the use site, built on interfaces — which
  is what `implements` now is — rather than on a class hierarchy. It needs a
  vtable and function pointers, and both are refused today for the reasons §2
  gives, so it is a work package of its own and not a follow-up to this one.
- **Interface inheritance.** `interface A extends B` is still refused ("list
  every field"). A prefix rule between two interfaces would be the natural
  generalisation of §3 and costs nothing structurally; it is left out because
  no program in the corpus wants it, and a rule nothing exercises is a rule
  nobody maintains.
- **Whether `implements` should widen to interfaces the class does not name.**
  It does not: a class with the right fields that does not list `I` is still
  not assignable to `I` (`tests/cases/reject_cls_not_implements`). That is
  nominal where the rest of the type system is structural, and it is kept
  deliberately — the clause is the author saying the prefix is a promise, not
  a coincidence — but it is the one decision here that a future note could
  reasonably reopen.
