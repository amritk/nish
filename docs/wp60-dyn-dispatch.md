# WP60: Dynamic dispatch over interfaces — designed and measured

**Status: designed and measured; nothing built.** This note recommends a
construct in four stages: stage 1 ships now, and stages 2 and 3 are each
gated on their own build's timing (§8, §9). Every program it measured lives
in §12 and was not committed. [LANGUAGE.md](LANGUAGE.md) stays normative. The
anchors are at `e0a1661e`. Part of #1583.

**The number.** This package was first proposed as WP54. WP54 is
[PR #1528](https://github.com/amritk/nish/pull/1528)'s and WP59 is #1577's, so
it is WP60 everywhere: this note, its roadmap page and every pointer to it.

Today a Nish interface describes a layout and nothing else. A class is a
`%struct.C*` with no header and no vtable; `implements` checks that the class
lists the interface's fields first (`checkImplements`, `src/structs.ts:1231`),
so a `%struct.C*` is a `%struct.I*` by a `bitcast`; and an interface that
declares a method is refused with NL2048, `` Interface `X` cannot declare
methods (interfaces describe layout only) `` (`refuseMembers`, `src/statements.ts:1111`; the error itself is at `:1142`,
and every section of this note cites the two the same way). Every method call names one symbol: `emitMethodCall`
(`src/emit-classes.ts:438`) reads the callee the checker recorded in
`program.nodeCallees`, and a call with none is an internal error (`:447`). A
program that holds "one of several kinds of thing that each know how to do
`m`" writes the dispatch by hand: a `kind` field and a `switch`, a
[discriminated union](LANGUAGE.md#discriminated-unions) and a `switch`, or,
since WP51, an array of function references indexed by `kind`.

This note asks whether Nish can admit the thing those programs are spelling —
a value whose static type is an interface with methods, and a call that runs
the method of whichever class the value holds — without paying what dynamic
dispatch costs elsewhere: an indirect call the optimiser cannot see through,
an escape proof that gives up, and a header in every object. It measures the
proposed lowering against the three hand programs and a vtable, and
recommends one answer.

**The proposal.** WP51 already built the machinery. For a function reference
the whole program is visible, so the set of functions that can reach each call
is closed and known at compile time, and a call lowers to a `switch` over that
set with a direct call in each arm. A dynamic interface value is the same
idea with the set made of classes: a **tagged reference**, a small integer
tag naming the class carried with the pointer to the object — two scalars in a
local or a parameter, one pointer-sized word (the tag in bits the address does
not use) in a field, an array element or a `Map` value. A method call through it
lowers to a dispatcher per (set, method) — a `switch` on the tag with a direct
call to that class's method in each arm, recorded before any whole-program
pass reads the call graph. The attribute fixpoint, the escape analysis and the
call-site ranges then see ordinary direct calls, as they do for WP51. A
generic `<T extends I>` keeps meaning what it means today: one instantiation
per class, and no dispatch at all.

## 1. The decision

**Ship stage 1 now. Stages 2 and 3 are gated, and on this note's figures
neither lands yet (§8, §9).** Stage 1 is interface method signatures with
`<T extends I>`: no IR moves, and the common case, one class at a time, stays
static. Stage 2 is `Dyn<I>` from `nish:dyn` in locals, parameters, returns and
calls — a tagged reference held as an `i32` tag and a pointer, one dispatcher
per (module, set, method) built by WP51's place solver, the escape-join
refusal with `this` as an argument, and the debug-build tag check. Measured in
the shapes stage 2 can write (§3.6), it is 0.72x the hand `kind` + `switch` in
geomean over 15 cases, and 47 ms against the hand registry's 91 (both wins
are LLVM merging the selecting `switch` with the dispatch, which a hand
program that dispatched once would get too: not a property of `Dyn`, §3.6),
but one case, a set of two chosen at random per call, runs at 2.21x, past the
1.25x line its gate draws: stage 2 lands when its own build passes that gate, and declines
otherwise. **Stage 3, a `Dyn<I>` in a field, an array element, a `Map` value
or a `Result` payload, is gated too.** Its form, one pointer-sized word with
the tag in bits the address does not use, meets I5 on x86_64, aarch64 and
wasm32 (where an interface stored as a `Dyn` has at most 7 classes), but its
spike missed I2 on the array rows (1.18x the hand program in geomean, 1.67x at
worst), and neither other stored form measured meets I2 and I5 together
(§3.4). Until a stage lands, a program writes the hand `kind` field and
`switch` it writes today. A plain interface stays a layout; `<T extends I>`
stays static.

- **What it costs where it is used** (§3). Stage 2's register form, the tag a
  constant where the `Dyn` is made and a register from there (§3.6): 0.72x the
  hand program in geomean over 15 cases of 2 to 16 classes (strategy 1.01x,
  periodic 0.37x, aperiodic 1.00x), 0.22x at best and 2.21x at worst (the
  aperiodic set of two), against a ±3.3% band; on a 13-class, 4-method registry,
  47 ms against the hand program's 91 (94 for its byte-identical copy). The
  periodic rows' 0.37x and the registry's halving are one LLVM merge of two
  jump tables into one, which the hand program written to dispatch once would
  also get (§3.6): they bound nothing in `Dyn`'s favour, and the claim this
  note makes for stage 2 is only that it is no slower than the gate allows. §3.3's
  0.98x over 25 cases is a different form: 20 of its cases read the tag from a
  side `i32[]` beside the objects (1.02x; the ten array rows 1.03x) and only
  the five serial-aperiodic cases take it from a register (0.84x); §3.5's
  registry at 51 ms against 50 is the side array too. There a vtable costs
  1.88x, WP51's function tables 1.14x and a discriminated union 1.13x. Stored,
  the form stage 3 would ship: 1.11x in geomean over 20 cases (0.73x to
  1.67x), inside the band on every serial-same row and 1.07x to 1.67x on every
  array row but one.
- **What it cannot do to a program** (§4). A call through a `Dyn<I>` compiles
  to the `switch` a program writes by hand today, or is refused. A set whose
  members disagree on keeping the receiver or an argument is a compile error,
  so the hand program's case B (5.9x case A's time at 100M iterations, and
  764 MB where A holds 13) cannot be reached through it. Cases A and C keep
  every allocation in the loop on the stack: 13 MB peak at 1x, 10x and 100x
  the loop. valgrind finds 0 bytes in use at exit and 0 errors over 183
  binaries: every §3.3 and §3.4 dispatch variant, the three escape cases and the registry's
  forms (§4.4).
- **What it costs where it is not used.** Nothing: no class gains a header, no
  plain interface changes meaning, and no program that compiles today emits a
  different instruction (I1), in any stage: `std/` does not adopt `Dyn` in
  this work package (§11).
- **What it costs in memory** (§2.3, I5). A stored `Dyn<I>` is one word, 8
  bytes on x86_64 and aarch64 and 4 on wasm32: the size of the hand program's
  reference, whose tag lives in the object. A class with one or two `Dyn`
  fields is the hand class's size on all three targets. A million of them in an
  array peak at 25948 KB, the hand array's figure to the kilobyte; round 0's
  16-byte fat reference cost 16 MiB more there, and 16 MiB more as a `Map`
  value.

The seven decisions, each with the alternatives it beat:

| # | Decision | Chosen | Lost, and why |
| --- | --- | --- | --- |
| D1 | Spelling and its TS reading (§2.1) | `Dyn<Shape>`, imported from `nish:dyn`; TypeScript reads it as `type Dyn<T> = T` | **A rule keyed on methods** (an interface that declares a method is dynamic wherever it is a value type): the cost is not visible in the type, and adding a method to an interface would change the representation of every existing `I` field, array and parameter — an I1 and I5 surprise in code that never calls the method. **`abstract class` / `extends`**: inheritance, which WP25 left out on purpose (a header, field layout across a hierarchy). **Leave it to the hand program**: §3 measures what it costs to keep writing it. |
| D2 | Static dispatch | `<T extends I>` over an interface with methods monomorphises, as it does over a class today (`satisfiesConstraint`, `implementsDeclaration`, `src/generics.ts:3201`): zero dispatch | **Make every `I` parameter dynamic**: the most common use, a function generic over one implementation at a time, would pay a tag it never reads. **Make `Dyn` the default and `<T extends I>` the opt-out**: the same cost, and the opposite of every other Nish default (the cheap reading is the plain one). |
| D3 | Representation (§2.3) | A tagged reference: an `i32` tag and a `%struct.I*` as two SSA values in a local, a parameter or a return; one pointer-sized word, the tag in bits 48–55 (the low 3 bits on wasm32), in a field, an array element, a `Map` value or a `Result` payload (stage 3, gated on I2) | **A fat reference `{ i32, ptr }` everywhere** (round 0 of this note): 16 bytes a stored place where the hand program pays 8, so it fails I5 in a field (24 against 16), in two fields (32 against 16) and per element (16 against 8), and a million in an array peak 16 MiB above the hand program (§2.3). **The fat reference split into two class fields**: meets I5 for one field on 64-bit, fails it for two (24 against 16) and on wasm32 for one (12 against 8). **Structure of arrays** (a tag array beside a pointer array): 1.02x the hand program in the array rows (§3.4) but 12 bytes a slot, so it fails I5, and a `Map` value has no second array. **A tag in every object's header**: every class whose instance can become a `Dyn<I>` changes layout everywhere, its C header and typed JSON included. **A vtable pointer instead of a tag**: an indirect call per method call, 1.88x the hand program in geomean (§3.3), and it hides the callee from the attribute fixpoint and the escape proof (§4). **A discriminated union `A \| B`**: the cheapest form when every member already declares the tag, a later optimisation (§11), but it needs the user to write a tag in every class. |
| D4 | Sets and dispatchers (§2.4) | Per-place sets, solved by WP51's `RefPass` (`src/fnref-places.ts`, `solve` `:680`); one dispatcher per (set, method); a set of one compiles to the direct call; the sets are known before the whole-program passes (WP51 §2.4) | **One set per interface** (every class that `implements I`): a call that only ever sees one class pays a `switch` over all of them. **One dispatcher per call site**: the same `switch` emitted N times, and N copies for the inliner to weigh. |
| D5 | Escape-join refusal (§2.5) | Per method and per parameter, with `this` as parameter 0: a call whose set holds a member whose method keeps an argument and one whose method does not is a compile error | **Join** (every call keeps what any member keeps): case B's cost, silently, at every call (§4). **Split the call by tag at the call site**: a `switch` in every caller, which is the hand program with the type hiding it. |
| D6 | Boundaries (§2.6) | A `Dyn<I>` never crosses the C ABI or a host-visible signature (as NL2733 refuses a function reference); it may sit in a `Result` arm as the tagged word; it crosses `spawn` and `parallelMap` when every member of its set may | **A C spelling** (`struct { int32_t tag; void *obj; }`): a C caller could hand in a tag no set holds, which breaks the closed set everything rests on. **Refuse it in a `Result`**: a function that may fail could not return one, so every fallible factory (`parse(): Result<Dyn<Shape>, E>`) would return the hand program instead; the payload slot is a reference's, so nothing is gained by the refusal. **A `Result` payload as the fat pair**: a second payload layout in `Result`, for one type. **Refuse it across `spawn` and `parallelMap`**: the tag is a program constant valid in every thread, so the refusal would protect nothing the members' own sendability does not; it would push a worker pool over plugins back to the hand program. **Admit it across threads whatever the members**: a member holding a non-sendable field would cross by the back door. |
| D7 | Diagnostics (§2.7) | Ten new codes from NL2771 (NL2774, NL2778 and NL2780 in stage 1, NL2777 in stage 3, the rest in stage 2) and one warning, NL9020, for a set past eight members (as NL9017); three existing codes widen (NL2556 in stage 1, NL2353 and NL2766 in stage 3) | **Reuse WP51's codes** (NL2733, NL2736, NL9017): their words name a function reference and a function; a dyn call's names a class and a method, and a code is a stable identifier an agent keys on. **Reuse NL2048 for stage 1's refusals**: its words, "interfaces describe layout only", stop being true in stage 1, so stage 1's negatives (a call on a plain `I`, a missing or mismatched method) get their own codes and NL2048 narrows to what is not a plain signature (an accessor, `?`, a type parameter; a body is a parse error before it, §9 stage 1). |

**The invariants.** Each one names the check that holds it, in the stage that
lands it (§9).

| # | Invariant | The check |
| --- | --- | --- |
| I1 | **Zero cost unused.** A program with no `Dyn` emits the IR it emits today, and the same sidecars. | `node tests/nish-cmp.js` over the corpus (its IR and its sidecars) with **no** `DECLARED` entry, in every stage's PR: no stage moves any program's IR. Stage 4 does not touch `std/`; adopting `Dyn` there would move `std/` IR and add `DECLARED` entries, so it is left to later work (§11), outside this work package's I1. |
| I2 | **Never slower than the hand program.** A call through a `Dyn<I>` costs what the hand `kind` + `switch` costs over the same set, within the noise band. Not yet met in every case by either form. Stage 2's register form is 0.72x in geomean and 2.21x on one case (§3.6); the stored form is 1.11x, 1.18x on arrays (§3.4). Both stages are gated. | Stage 2: the §3.6 programs (`s2/`: strategy, periodic and aperiodic at K = 2, 4, 8, 13, 16, and `reg2`, all of which stage 2 can build) rebuilt with K real classes, `class C0 implements Base` to `C{K-1}`, each with its own `m` (§12.11's `gen.mjs` changed to emit them in place of its functions `g0`..), and `Dyn<Base>` for the `surface` variant, rerun against the hand programs with `python3 bench.py groups.json 7` (§12.7: best of 7, interleaved), which must print `checksums ok` (a mismatch fails the run), and **the stage 2 gate** (§8): the geomean of the 15 cases inside the band or below it, and no case above 1.25x, or stage 2 does not land; §3.3 and §3.5 hold the tag in a side array, a stored place stage 2 refuses, so they are not stage 2's check. A `tests/run.js` IR check that the dispatcher of a set of one is the direct call. Stage 3: the §3.4 rows rerun against its build and **the stage 3 gate** (§8): the geomean of the ten array rows inside the ±2.6% band and no array row above 1.25x, or stage 3 does not land. |
| I3 | **The escape proof survives.** A `Dyn` call whose set agrees on keeping places its arguments as the hand call does; one whose set disagrees is refused. | `.memory` goldens for case A (stack) and case C (stack, the keeper outside the set), and a negative test for case B (§4, §9). |
| I4 | **No leak, no growth.** Peak RSS is flat at 1x, 10x and 100x a loop's length, and valgrind finds 0 bytes lost. | The §4 programs rerun by stage 2's PR; valgrind over every variant, case A, B and C and the registry forms, as this note ran it (`v/run.sh`, §12.10: 183 binaries, 0 bytes in use at exit, 0 errors); stage 3 adds a 1M-slot array at 1x/10x/100x and an `NISH_ASAN` run (LeakSanitizer and the tagged word, §10). |
| I5 | **No layout surprise.** In the brief's words: "A field or element of the dynamic type is no larger than the hand program's tag plus reference; padding reported by the existing layout warning is the same or better." No class, plain interface or union changes size. Met on x86_64, aarch64 and wasm32 by the tagged word (§2.3), wasm32's for an interface with at most 7 classes converted to `Dyn` (more is NL2777). | A `tests/run.js` probe, "WP60: Dyn layout", added by stage 3: it compiles a class with one `Dyn` field, one with two, and their hand twins (a `kind` field's place taken by nothing, the reference by the class) with `nish --target` for `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu` and `wasm32-unknown-wasi`, reads each class's size from the `.ll` as LLVM computes it (`opt -O2 -mtriple=<t>` folding a gep-from-null size function, `l2/probe.ll`'s idiom, §12.8), checks every `Dyn` class equals its hand twin on every target, and checks NL9010's words for the pair are the same. `tests/layout/` cannot serve: it compares a class with its C twin on the host only, and a `Dyn` has no C spelling (NL2772). |
| I6 | **Compiler cost.** Solving the sets and generating dispatchers costs no more than WP51's pass already does per member; the self-hosted compiler is not slower to build or bigger. | `node tests/run.js performance`; the registry's compile time rerun against stage 2's build (§3.5: 7 ms best, 11 max, the hand program 7 and 8); the self-host build's wall time and `build/nish`'s size before and after, each inside its band (`src/` uses no `Dyn` under the rolling freeze, so neither should move); the number of `$dyn.` dispatchers in the registry's `.ll` (4, one per method, §2.3). |
| I7 | **Safety.** The tag is unforgeable: no source construct reads or writes it, and only the conversion from a class instance makes one. A speed build's `default` arm is a member of the set. A `--profile debug` build checks the tag and panics outside the set. | A negative test per way to spell the tag (§2.7); an IR check that the `default` arm calls a member; a debug-profile run that panics (WP51's "fnref tag check" shape). |

## 2. The rule and the lowering

### 2.1 What is admitted

```ts
import { Dyn } from "nish:dyn"

interface Shape {
  area(): f64
  scale(by: f64): void
}
class Circle implements Shape {
  r: f64 = 1
  area(): f64 { return 3.14159 * this.r * this.r }
  scale(by: f64): void { this.r = this.r * by }
}
class Square implements Shape {
  side: f64 = 1
  area(): f64 { return this.side * this.side }
  scale(by: f64): void { this.side = this.side * by }
}

const total = (shapes: Dyn<Shape>[]): f64 => {
  let sum = 0.0
  for (const s of shapes) sum = sum + s.area()
  return sum
}
const all: Dyn<Shape>[] = [new Circle(), new Square()]
console.log(`${total(all)}`)
```

This is the whole proposal's program, and its `Dyn<Shape>[]` is a stored
place: stages 1 and 2 refuse it (NL2779) until stage 3 lands. What stage 2
compiles of it is a `Dyn<Shape>` local, parameter or return, for example
`const show = (s: Dyn<Shape>): f64 => s.area()` called with a `Circle` and a
`Square`.

- **An interface may declare method signatures** (stage 1). A signature has
  no body; a getter or a setter, an optional `m?()` and a type parameter
  `m<T>()` in an interface stay refused (NL2048, its words narrowed to name
  the plain signature, §9 stage 1), and a body stays the parse error it is
  today (`` an interface holds only annotated fields ``: the parser reads a
  signature up to its separator and never reads a body there,
  `parseMethodSignature`, `src/parser.ts:2969`). Fields and signatures may
  mix.
- **`implements I` checks the methods** (stage 1). `checkImplements`
  (`src/structs.ts:1231`) checks today that the class lists the interface's
  fields first; it learns to check that the class declares each of the
  interface's methods with the same parameter and return types. Membership is
  nominal: a class with the right methods that does not say `implements I`
  does not convert to `Dyn<I>`.
- **`<T extends I>` calls the methods** (stage 1). A generic constrained by an
  interface with methods may call them on a `T`; each instantiation names one
  class, so the call is that class's method, direct, as `<T extends C>`
  already is for a class `C` (`tests/cases/gen_constraint_method`).
- **`Dyn<I>` is a value type** (stages 2 and 3): a local, a parameter, a
  return, a call's receiver (stage 2); a class field, an array element, a
  `Map` value, `Dyn<I> | null` and a `Result` arm (stage 3). The last two
  and a `spawn` or `parallelMap` argument are stage 3 even in a local: a
  `| null` local is laid out as a nullable reference, one word, and a `Result`
  payload and a thread's argument are stored slots, so all three hold the
  tagged word, and stage 2 refuses them with NL2779 as it refuses a field. A
  value of a
  class `C` that implements `I` converts to `Dyn<I>` where one is expected,
  implicitly, as a `C` converts to `I` today.
- **A method call on a `Dyn<I>` runs the method of the class it holds.**
- **`===` and `!==`** compare the objects, by identity: two `Dyn<I>` holding
  the same object are equal. Tags are dealt per interface, so one object always
  carries the same tag in a `Dyn<I>`; comparing the tagged words (§2.3) is
  therefore comparing the pointers, and `=== null` is a compare with the
  all-zero word.
- **The conversions**, each decided:

  | From → to | Rule | Lowering |
  | --- | --- | --- |
  | `C` → `Dyn<I>` (`C implements I`) | implicit where a `Dyn<I>` is expected | the class's tag, a constant, beside the bitcast pointer |
  | `Dyn<I>` → `I` | implicit: a `Dyn<I>` is usable where a plain `I` is, for its fields | drop the tag (an untag where the word is stored) |
  | `I` → `Dyn<I>` | refused (NL2776): a plain `I` names no class, so there is no tag to write | — |
  | `Dyn<I>` → `Dyn<J>` | refused (NL2776), even when every member also implements `J`: tags are dealt per interface, so the conversion would be a `switch` that renumbers, and nothing measured asks for it | — |
  | `Dyn<I>` → `C` | not in the language: there is no downcast, as there is no `as` | — |

- **Generics.** `<T extends I>` keeps monomorphising (D2). Instantiated at
  `T = Dyn<I>` (stage 2), `T` is a `Dyn<I>` and a call on it goes through the
  dispatcher: one instantiation for `Dyn<I>`, beside one per class. A generic
  class that implements `I` (`class Box<T> implements Shape`) contributes one
  member per instantiation, each with its own tag, as each instantiation is
  its own `%struct`. A generic interface is dynamic per instantiation:
  `Dyn<Cell<i32>>` and `Dyn<Cell<f64>>` are two interfaces with two numberings,
  and a `Dyn<Cell<T>>` inside a generic body is resolved after
  monomorphisation, so the solver only ever sees concrete interfaces.
- **A field of `I` read through a `Dyn<I>`** is a load through the pointer,
  as it is through a plain `I`.

**What `nish:dyn` exports.** One type, `Dyn<T>`. `runtime/nish.d.ts` declares
it `export type Dyn<T> = T`, so `tsc` and an editor read `Dyn<Shape>` as
`Shape` and every call on it as TypeScript's own method call.

### 2.2 What stays refused

- **A method call on a plain interface value.** `(s: Shape) => s.area()` is
  refused: a plain `Shape` is a pointer to a layout and names no class. From
  stage 1 the diagnostic names the way stage 1 has, `<T extends Shape>` for one
  class at a time (NL2774); from stage 2 it also names `Dyn<Shape>` for any of
  them (§2.7). Reading a field through a plain `Shape` stays what it is today.
- **A class that does not implement the interface's methods**, or implements
  one with a different signature (stage 1, NL2778).
- **A class that implements an imported interface** stays refused with NL2079,
  `` `X` is not a declared interface `` (`src/structs.ts:1159`; the rule is
  commented at `src/generics.ts:3194`). A `Dyn<I>`'s members are therefore
  classes of `I`'s own module; stage 4 decides whether to lift that (§9).
- **`Dyn<T>` of anything but an interface that declares a method** (NL2775):
  `Dyn<Circle>` would be a tag with one possible value, and `Dyn<Point>` over a
  layout-only interface has no call to dispatch.
- **A `Dyn<I>` across the C ABI or a host-visible signature** (NL2772, §2.6).
- **A `Dyn<I>` as a `Map` key or a `Set` element**: an interface is not a key
  today (`reject_map_key_interface`), and a `Dyn` is keyed by nothing an
  interface is not. Identity keys would hash the tagged word, which is sound
  (one object, one word), but nothing measured asks for them; they stay
  refused, and a `Map` *value* is admitted (stage 3).
- **Inheritance, `abstract`, interface `extends`**: unchanged, WP25's.
- **Reading or writing the tag.** There is no syntax for it, and `as` is not
  in the language (NL2048's neighbours, `tests/cases/reject_as_*`).

### 2.3 The lowering

**The type.** `Dyn<I>` is a tag and a `%struct.I*`. Tags are dealt per
interface from 1, in the order the solver meets the members, as
`numberMembers` (`src/fnref-places.ts:777`) deals a function reference's
(":808: A tag is the position among the functions of one signature, from 1").
Tag 0 is `null`. A tag names one class wherever the value flows, so a stored
place can receive any tag its interface has dealt, whatever its own set: a
two-member place over an interface with ten converted classes may hold tags 8
and 9. The stored form's limit therefore counts the interface's tags, not the
place's set (below). Where
the value lives decides how it is spelled — a **tagged reference**:

| Where | LLVM | Size (64-bit) | Today's `I` there |
| --- | --- | --- | --- |
| a local, a parameter, a return | two SSA values; two parameters `i32 %s.tag, %struct.I* %s`; a return of `{ i32, %struct.I* }` | registers | one pointer |
| a class field, an array element, a `Map` value, a `Result` payload | one `i8*`-sized word: the pointer with the tag in bits 48–55 | 8 | 8 |
| `Dyn<I> \| null` | in registers, tag 0 and `null`; stored, the all-zero word (a member's tag is at least 1, so a tagged word is never 0) | as above | as above |

A stored word is made and read with three operations, none of which reaches
memory:

```llvm
; tag: tag << 48 added to the address. A non-inbounds GEP, so LLVM
; assumes nothing about the result's alignment or bounds.
%t64 = zext i32 %tag to i64
%sh  = shl i64 %t64, 48
%raw = bitcast %struct.Shape* %p to i8*
%w   = getelementptr i8, i8* %raw, i64 %sh
; read the tag: the top 16 bits
%wi  = ptrtoint i8* %w to i64
%hi  = lshr i64 %wi, 48
%tg  = trunc i64 %hi to i32
; untag: clear the top 16 bits, keeping provenance
%ob  = call i8* @llvm.ptrmask.p0.i64(i8* %w, i64 281474976710655)
```

On wasm32 the same three operations are 32 bits wide and use the low 3 bits
(the name mangles the mask's width; this form was not run, §7):

```llvm
; tag: the tag added to an 8-aligned address
%raw = bitcast %struct.Shape* %p to i8*
%w   = getelementptr i8, i8* %raw, i32 %tag
; read the tag: the low 3 bits
%wi  = ptrtoint i8* %w to i32
%tg  = and i32 %wi, 7
; untag: clear the low 3 bits, keeping provenance
%ob  = call i8* @llvm.ptrmask.p0.i32(i8* %w, i32 -8)
```

These are the transforms `mktp.mjs` and `mktp1m.py` (§12.8) apply to the
compiler's own IR for the `tp` variants §3 times. The spike's hand programs
number their kinds from 0, so the transforms store `tag + 1` and subtract 1 on
the read: one `add` and one `sub` more than the compiler's lowering, so the
`tp` timings overstate its cost by those two instructions. The rules the stage that
builds them follows:

- **No pointer metadata on a tagged load.** A load of a stored word carries no
  `dereferenceable`, `nonnull` or `align` metadata; only the untagged pointer
  is dereferenced, and every dereference goes through `ptrmask`.
- **A debug check before tagging.** Under `--profile debug`, tagging checks
  the top 16 bits of the address are 0 and panics otherwise. Linux gives user
  space addresses below 2^47 unless a program maps above it on purpose (5-level
  paging, LA57, is opt-in per mapping), so the check never fires on today's
  allocator; it names the assumption.
- **At most 255 classes for an interface that is stored.** Eight bits hold
  the tag, and tags are dealt per interface, so the limit is the number of
  classes the program converts to `Dyn<I>`, the highest tag dealt for `I`. A
  program that stores a `Dyn<I>` anywhere while converting more than 255
  classes to it is refused (NL2777) at the first stored place, however few of
  them reach that place. A program that never stores one keeps the full `i32`
  in locals, parameters and returns, with no limit. Dealing tags per stored
  set instead would make one class carry two tags, and every move between
  places a renumbering `switch`.
- **Sanitizers.** HWASan and MTE keep their own tag in the top byte; Nish
  builds neither. ASan runs only under `scripts/fuzz.sh` and `tests/run.js`'s
  `NISH_ASAN` (`nish_alloc_struct` calls `nish_asan_alloc`, `runtime/runtime.c`);
  it checks the untagged address, because every dereference goes through
  `ptrmask`. LeakSanitizer scans memory for pointer-shaped words and may not
  see a tagged word as a reference to its object: a stage-3 risk the stage-3
  PR checks under `NISH_ASAN` before it lands (§10). Pointer authentication on
  aarch64 signs code pointers, not data pointers.
- **wasm32.** A pointer is 4 bytes and the address space is the module's
  linear memory, so there are no spare high bits. Every object is 8-aligned
  (the arena base is rounded to 8, `runtime/runtime-wasm.c:83`, and every size
  to 8, `:105`; `runtime/runtime.c:239` keeps the same rule natively; an
  `alloca` is `align 8`), so the low 3 bits are free: wasm32 stores the tag
  there, and an interface that is stored has at most 7 classes converted to
  it on wasm32 (NL2777 names the target), counted as on 64-bit.
- **Root storage and the other readers of a stored word.** A page module's
  root tracer (`nish_runtime_root_keep`, `runtime/runtime-wasm.c`) follows
  only what `holdsPointer` (`src/emit-root.ts:67`–`72`) names: a string, an
  array, a union or a class. A tagged word is none of them, so a descriptor
  would skip the field and the slide would release the object it tags; were it
  treated as a class pointer instead, its low tag bits on wasm32 would point
  inside an object and the tracer's range check would panic with
  `NISH_FORGED_POINTER` (`:353`, `:382`). Stage 3 does neither: root storage
  refuses a `Dyn<I>` anywhere its closure reaches, with NL2766, the code that
  already refuses "an interface a class implements" (the same polymorphic
  reference, `rootFault` in `src/module-storage.ts:385`–`396`), its words
  gaining `` a `Dyn` ``. Lifting that is a later change and needs a fifth
  descriptor kind: a flag in `holdsPointer`, the untag (`& ~7` on wasm32, the
  only target with root storage) in the tracer, and one class descriptor per
  tag, as kind 3 has per union variant. The word's other readers are closed by
  the refusals already listed: `--emit-header` and the C ABI (NL2772), the
  typed-JSON sidecars and `jsonRefusal` (NL2486), and a `Map` key or `Set`
  element (NL2353).
- **32-bit references (WP48).** WP48 measured compressed 32-bit references
  and built neither a whole-program 32-bit mode nor an `i32` pool
  (`docs/roadmap/index.md`, `MASTER_PLAN.md` row 48), so no 64-bit target has
  a 4-byte reference today. If one lands, the split form is unchanged (an
  `i32` tag beside a 4-byte reference in registers, and SoA's side array if a
  stored place used it), but the tagged word has no spare high bits: it takes
  the wasm32 form there (the low 3 bits of an 8-aligned offset, at most 7
  classes of a stored interface) or the stored place widens to 8 bytes. That choice is that work's,
  and NL2777 names whichever limit holds. The 48-bit assumption the 64-bit
  form rests on is the debug check's above, and LA57's 5-level paging is the
  one way it breaks on Linux today.

**The sizes**, LLVM's own, for each target's data layout: `l2/probe.ll`
(§12.8), `opt -O2 -mtriple=<t>` folding each `@size_*` to a constant, LLVM
18.1.3:

| Layout | What it is | x86_64 | aarch64 | wasm32-wasi |
| --- | --- | --- | --- | --- |
| `Fat` | `{ i32, ptr }`, the round-0 fat reference | 16 | 16 | 8 |
| `OneField` | `class { n: i32; h: Dyn<I> }`, `h` as a `Fat` aggregate | 24 | 24 | 12 |
| `OneSplit` | the same, the tag split out beside `n` | 16 | 16 | 12 |
| `OneTagged` | the same, `h` a tagged word | **16** | **16** | **8** |
| `HandOne` | the hand program: `n` and a plain `I` (the kind in the object) | 16 | 16 | 8 |
| `TwoAgg` | two `Dyn` fields as `Fat` aggregates | 32 | 32 | 16 |
| `TwoSplit` | two split `Dyn` fields | 24 | 24 | 16 |
| `TwoTagged` | two tagged words | **16** | **16** | **8** |
| `HandTwo` | the hand program: two plain `I` | 16 | 16 | 8 |
| `ptr` | an array element or `Map` value: a tagged word, the hand program's pointer | 8 | 8 | 4 |

The brief's I5 reads: "A field or element of the dynamic type is no larger
than the hand program's tag plus reference; padding reported by the existing
layout warning is the same or better." The hand program keeps its tag inside
the object, so its field is one reference: 8 bytes (4 on wasm32). The tagged
word is that size on all three targets, in a field, an array element and a
`Map` value, and a class with tagged fields is byte-for-byte the hand class's
size (`OneTagged` = `HandOne`, `TwoTagged` = `HandTwo`), so NL9010 reports the
same padding. Round 0's fat reference failed I5 in every stored place (24
against 16 for one field, 32 against 16 for two, 16 against 8 per element);
the split form failed it with two fields (24 against 16) and on wasm32 with one
(12 against 8). The tagged reference is why I5 holds.

**What it costs in a million objects** (`l2/`, §12.8: 1,048,576 objects of
two classes pushed to an array or set in a `Map<i32, _>`, then summed; peak RSS
from `wait4`, best of 3, `l2/rss.py`; its output was not kept, and a rerun
gave every figure within 20 KB of these):

| Program | What the slot is | Peak RSS (KB) | Over `empty` |
| --- | --- | --- | --- |
| `empty` | prints `0` | 12952 | — |
| `hand` | `Base[]`, the kind in the object | 25948 | 12996 |
| `tp` | `hand`'s IR with every element a tagged word (`mktp1m.py`) | 25948 | 12996 |
| `union` | a discriminated union array | 25948 | 12996 |
| `aos` | `{ t: i32; o: Base }[]`, a 16-byte slot (the fat reference) | 42332 | 29380 |
| `map_hand` | `Map<i32, Obj>` | 58848 | 45896 |
| `map_aos` | `Map<i32, Slot>`, a boxed `{ tag, ref }` per value | 75236 | 62284 |

Every program but `empty` prints the same sum. The tagged array costs exactly
what the hand array costs. The fat reference's array costs 16 MiB more: 8 MiB
is the steady state (1M slots × 8 bytes), and the rest is, by inference not
measurement, the doubling copy's transient (the old and new buffers live at
once at the last `push` growth). A `Map` cannot hold a 16-byte value inline, so
the fat form there is a boxed slot per value: 16 MiB more. The tagged word is
an 8-byte value in both.

**A conversion** writes the class's constant tag with the pointer. Written for
this note from the compiler's output for `tests/cases/gen_constraint_method`
(`.ll:36-37`); it is not compiler output (no compiler emits `Dyn` yet):

```llvm
; const s: Dyn<Shape> = new Circle(2.0)    (hand-written: the proposed lowering)
%Circle.obj = alloca %struct.Circle, align 8
call void @Circle.constructor(%struct.Circle* %Circle.obj, double 2.0)
%s = bitcast %struct.Circle* %Circle.obj to %struct.Shape*
; %s.tag = i32 1, the constant: Circle is member 1 of Shape's numbering
; stored into a field, the same pair becomes one word:
;   %w = getelementptr i8, i8* (bitcast %s), i64 281474976710656  ; 1 << 48
```

**A member's method** is the class's own method, `this` typed as the class.
The dispatcher holds a `%struct.Shape*`, so each arm bitcasts it back:

```llvm
sw.case:                                   ; Circle, tag 1
  %c = bitcast %struct.Shape* %o to %struct.Circle*
  %0 = call double @Circle.area(%struct.Circle* %c)
  ret double %0
```

**A call** passes the tag and the pointer to the dispatcher of the place's set
for that method. The dispatcher is the function the spike's `proposed`
variant writes by hand, and its IR is the compiler's own: this is the `@d` the
`build/nish` (0.39.0, built from `e0a1661e`) emitted for
`serial_periodic_k4_proposed` (§12.1), whose four members stand for four
classes' `m`. The hand program numbers its kinds from 0, so its cases read
0..2; the generated dispatcher's read 1..3 (tags from 1, as above), and each of
its arms bitcasts `%o` to the member's class before the call, as the
`sw.case` above shows — the spike's members all take the base type, so its
arms have no bitcast:

```llvm
define internal noundef i32 @d(i32 noundef %t, %struct.Base* noundef nonnull readonly align 8 dereferenceable(8) nocapture %o, i32 noundef %x) #1 {
entry:
  switch i32 %t, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
  ]

sw.case:
  %0 = call i32 @g0(%struct.Base* %o, i32 %x)
  ret i32 %0

sw.case.1:
  %1 = call i32 @g1(%struct.Base* %o, i32 %x)
  ret i32 %1

sw.case.2:
  %2 = call i32 @g2(%struct.Base* %o, i32 %x)
  ret i32 %2

sw.default:
  %3 = call i32 @g3(%struct.Base* %o, i32 %x)
  ret i32 %3
}
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
```

Three things in it are the proposal's requirements, and the compiler already
does each one for this hand program:

- **The `default` arm is a member.** The last member is the `default`, so a
  speed build has no unreachable arm and no check (I7). WP51's dispatcher is
  built the same way (`makeDispatcher`, `src/fnref-places.ts:879`).
- **The attributes are the members' join.** `@d` is `readonly`, and its
  `%o` is `nocapture readonly`, because every member is. That is the
  attribute fixpoint reading a function with direct calls; it would read a
  generated dispatcher the same way, as it reads WP51's.
- **The receiver is an argument.** The member is called with the object
  pointer first, as `emitMethodCall` passes `this` today, so the escape
  analysis sees `this` where it sees every other argument (§2.5).

The generated dispatcher's name follows WP51's
`$ref.<module>.<signature>.<n>` (`src/fnref-places.ts:1131`) as
`$dyn.<module>.<interface>.<method>.<n>`, and it is recorded against the call
as `resolveReferences` records a reference's (`pass.siteTables[s][call.id]`,
`:1148`), so `emitMethodCall` finds a callee, as it must
(`src/emit-classes.ts:447`), and every whole-program pass sees an ordinary
call to an ordinary function.

**How many dispatchers.** WP51 makes one per module and member set ("One
dispatcher per module and member set", `src/fnref-places.ts:1115`;
`dispatcherFor`, `:997`, called at `:1132`, returns the one already made for
the same set). `Dyn<I>` keys the same map by (module, member set, method): two
calls of `area` over `{Circle, Square}` in one module share one dispatcher;
`scale` over the same set gets its own; the same set in another module gets
another. The registry (§3.5) has 4 dispatchers for its 13-member set, one per
hook.

**What extends WP51, and what is new.** Reused as they are: the place solver
(`RefPass`, `solve` `:680`), the member numbering (`numberMembers` `:777`), the
dispatcher builder (`makeDispatcher` `:879`), its de-duplication
(`dispatcherFor` `:997`), the tag check (`emitTagCheck`) and the >8-member
warning's shape. Extended: the place kinds learn class instances as members
beside functions, and `shapeReferenceCalls` (`:1046`), which rewrites a
reference call's arguments after the checker, learns a method call's receiver.
New: the per-interface tag registry (a class's tag in `I`'s numbering, which a
function reference's signature-keyed numbering does not have); the arm that
bitcasts `%struct.I*` to the member's class (a function reference's members
share one signature, so its arms pass arguments as they are); the two-value
receiver in `emitMethodCall` (a `Dyn<I>` receiver is tag and pointer, where
today's is one `%struct.C*`); and the tagged word's three operations
(stage 3).

**A set of one** compiles to the direct call: the dispatcher is not made, and
the tag, which no instruction then reads, is dead. A local of a set of one is
typed by its member (`%struct.Circle*`, no tag). A parameter or return of a set
of one is too: the sets are solved before any function is emitted (§2.4), so
the function is emitted with the member's type and no tag parameter, its
symbol and signature are the ones the same function written with `Circle`
gets, and every caller, being in the same whole program, passes the bare
pointer. No caller outside the program exists: a host-visible signature
cannot carry a `Dyn` (§2.6). So for a local, a parameter or a return the IR is
the IR of the same program written with `Circle`, which stage 2's
`tests/run.js` check "dyn: a set of one is the direct call" pins by diffing
the two programs' `.ll`, one with a `Dyn` parameter and one with a `Dyn`
local. In both programs `Circle` declares `implements Shape` and `Shape`
keeps its method signature: only the `Dyn<Shape>` spellings differ. That is
what makes byte equality a fair claim: `fieldTbaa` (`src/tbaa.ts:137`) tags
no field access of a class that implements an interface, so a twin whose
`Circle` dropped `implements Shape` would carry `!tbaa` on every field access
and differ for a reason that is not `Dyn`'s, and a twin without `Shape` would
lose its `%struct.Shape` definition. For a stored place it is not identical: the field,
element or `Map` value still holds a tagged word, so a store tags and a load
untags (an `add` and an `and` the hand program does not have); stage 3's
`.ll` golden `dyn_field_set_of_one` records that IR rather than claiming
equality.

**The debug check.** Under `--profile debug` the dispatcher's entry checks
that the tag is a member of the set and panics with
`` a `Dyn<Shape>` holds a class outside its place's set `` otherwise, as
`emitTagCheck` (`src/emit-fnrefs.ts`, called from `src/emit.ts:683`) checks a
function reference's. A speed build has no check: by construction the tag is
always a member (I7), and WP51 measured every check it timed at up to 1.2x to
2.7x somewhere (WP51 §4.4).

### 2.4 Sets, and when they are known

A **place** is anything that holds a `Dyn<I>`: a local, a parameter, a return,
a field, an array's elements, a `Map`'s values. A place's set is the classes
whose instances can reach it, solved over the assignments, calls and returns
between places as WP51's `RefPass` solves a function reference's
(`src/fnref-places.ts`, `solve` at `:680`). A call's set is its receiver
place's set. The dispatcher is shared by every call of one method over one
set.

The sets are solved by the pass that solves WP51's, called from
`resolveReferences` (`src/compilation.ts:1467`): after every body is checked,
before the attribute fixpoint, the escape analysis and the call-site ranges
read the call graph (WP51 §2.4). Nothing after that pass learns a new member,
so every whole-program fact is computed over the final sets.

A place whose set the solver cannot close — a value from a host signature —
does not exist, because the boundary refuses it (§2.6).

### 2.5 The escape-join refusal

For each call through a `Dyn<I>`, for each parameter of the method, `this`
first: if one member's method keeps the argument (stores it somewhere that
outlives the call) and another member's does not, the call is refused
(NL2771). The check is WP51's `checkReferenceSites`
(`src/compilation.ts:2750`) with the receiver as parameter 0. Its words
are `escapeJoinMessage` (`src/fnrefs.ts:405`) filled in, unchanged, with the
call as `shown`, `this` as the parameter and the store that brought `Circle`
into the set as `via`:

```
this call through `s.area` can reach `Circle.area`, which keeps `this`, and `Square.area`,
which does not, so every call here would allocate `this` in the arena; `Circle.area` reaches
`s.area` through `shapes`: call `Circle.area` directly, or store it where `s.area` does not read
```

The last clause is WP51's, written for a function value; for a receiver it
reads as "store the `Circle`". Stage 2 decides whether NL2771 keeps it or
takes its own last clause, and its wording test pins the choice.

**Why `this` counts.** A method that stores `this` into a field or a global
keeps its receiver exactly as a function that stores its parameter does. The
escape analysis already reads `this` as the method's first parameter
(`emitMethodCall` passes it first); the refusal reads the same facts.

### 2.6 The boundaries

- **The C ABI and a host-visible signature.** A tag is an index into one
  program's numbering; to C it is a meaningless `int`, and a C caller could
  hand in an object of no class in the set. A `Dyn<I>` is refused in a
  `declare function` parameter or return, a field of a class a host can reach,
  and every signature `hostVisible` (`src/visibility.ts:153`) answers yes for,
  as WP51 §5.2 refuses a function reference (NL2733, `refuseHostReferences`,
  `src/fnrefs.ts:305`). The new code is NL2772. `structDefinitions`
  (`src/interop-header.ts:111`) writes an interface as its flattened field prefix; it has nothing to write
  for a `Dyn`, and does not have to, because none reaches it.
- **A `Result` arm.** `Result<Dyn<I>, E>` holds the tagged word in its
  payload slot (stage 3), a pointer-sized payload like any reference's;
  nothing crosses a boundary.
- **`spawn` and `parallelMap`.** The tag is a constant of the program, valid in
  every thread. A `Dyn<I>` crosses where an object of every class in its set
  may cross, and is refused with that class's own message where one may not
  (stage 3).
- **Typed JSON.** A `Dyn<I>` has no JSON reading: the tag is not data, and a
  decoder could not choose a class without one. A discriminated union is the
  way to read "one of several classes" from JSON
  ([LANGUAGE.md](LANGUAGE.md#typed-json-nishjson-typed)), and stays it.

### 2.7 The diagnostics

New codes take the next free numbers in their bands (`src/codes.ts`: the
highest NL2 code is NL2770 and the highest NL9 is NL9019 at `e0a1661e`). The
numbers are this note's proposal; the stage that lands a diagnostic takes the
next free number when it lands.

| Code | When | Words (proposed) | Stage |
| --- | --- | --- | --- |
| NL2771 | the escape-join refusal (§2.5) | as above | 2 |
| NL2772 | a `Dyn<I>` across the C ABI or a host-visible signature | `` `s` is a `Dyn<Shape>`: C cannot hold it, because its tag is an index this program's dispatchers read, not a type C can name `` | 2 |
| NL2773 | a class converted to `Dyn<I>` that does not declare `implements I` | `` `Hexagon` cannot be a `Dyn<Shape>`: it does not declare `implements Shape` `` | 2 |
| NL2774 | a method call on a plain interface value | stage 1: `` `area` is called on a `Shape`, which names no class: write `<T extends Shape>` to call it on one class at a time ``; stage 2 appends `` , or `Dyn<Shape>` for any of them `` | 1 (the clause naming `Dyn`: 2) |
| NL2775 | `Dyn<T>` of a class, a layout-only interface or anything else | `` `Dyn<Point>` needs an interface that declares a method: `Point` has none to dispatch `` | 2 |
| NL2776 | a conversion §2.1 refuses: a plain `I` to `Dyn<I>`, or `Dyn<I>` to `Dyn<J>` | `` a `Shape` cannot become a `Dyn<Shape>`: a plain interface value names no class, so there is no tag to give it; convert the class instance where it is made `` | 2 |
| NL2777 | a stored place (a field, an array element, a `Map` value, a `Result` payload) of `Dyn<I>` in a program that converts more than 255 classes to `Dyn<I>`, or 7 on wasm32, whatever the place's own set (§2.3) | `` `shapes` stores a `Dyn<Shape>`, and this program converts 300 classes to `Dyn<Shape>`, more than the 255 a stored one can tag; keep `Dyn<Shape>` in locals, parameters and returns, or convert fewer classes to it `` (on wasm32, `7` and `on wasm32`) | 3 |
| NL2778 | `implements I` where the class lacks one of `I`'s methods, or declares it with another signature | `` `Hexagon` declares `implements Shape` but has no method `area(): f64` `` | 1 |
| NL2779 | a `Dyn<I>` stored in a field, an array element, a `Map` value or a `Result` payload, before stage 3 lands (§1, §8) | `` a `Dyn<Shape>` lives in locals, parameters and returns: storing one in `shapes` is not supported yet; keep the class's own `kind` field and `switch` on it `` | 2 (lifted by 3) |
| NL2780 | an interface that declares a method used as its own type argument for `<T extends I>`, written or inferred (§9 stage 1) | `` `Shape` cannot be `T` in `<T extends Shape>`: `Shape` declares methods, and a call through `T` runs a class's method, so `T` is a class that declares `implements Shape` `` | 1 |
| NL9020 | a call whose set passes eight classes (as NL9017) | `` this call of `area` through `Dyn<Shape>` can reach 13 classes, more than eight, so it branches on a `switch` of them where a direct call would not; they came in through ... `` | 2 |

NL2048 keeps its number and narrows to an interface member that is not a
plain method signature (§9 stage 1). Three existing codes widen rather than
gain a sibling, because the rule each states is the same rule: NL2556 (an
object literal typed as something with methods) takes an interface that
declares a method in stage 1; NL2353 (a `Map` key or `Set` element) and
NL2766 (root storage) take a `Dyn<I>` in stage 3, each word list gaining
`` a `Dyn` ``.

## 3. The measurements

Every figure here was produced by the programs in §12, compiled by
`build/nish` 0.39.0 built from `e0a1661e` (`build/nish X.ts -o X.ll`), linked
by `scripts/build.sh X.ll runtime/runtime.c -o X --profile speed`, and timed on
one machine: 4 cores, Intel Xeon @ 2.30GHz, Linux, clang 18.1.3. `perf` is not
installed there, so no counter is quoted (§7).

### 3.1 Method

The runner (§12.7) takes the best wall time of seven runs per binary, the runs
interleaved across a group and the order rotated each round, and reads peak
RSS from `wait4`.

**Checksums.** Every binary prints a checksum. The runner exits 1, printing
`MISMATCH`, when a binary's output changes from one run to the next, or when
two binaries of a group that compute the same thing print different
checksums: every variant of one K; `direct` and `direct_copy`; every `reg_*`
program of §3.5 against the others; and the first field (the accumulator) of
escape cases A and B of §4.2, whose second field differs by design. Escape
case C is another program and `empty` prints 0, so neither is compared. The
runner prints `checksums ok (N pairs compared)` otherwise, and every run
quoted here printed `checksums ok`; the §3.5 and §4.2 figures are from the
reruns under this rule (`r/timing3`, `e/timing2`), each with 3 pairs
compared. `direct` is the
K=1 program: one class, every call `g0(o, ACC)` to the one method, no tag. In a
`same` group every K computes `direct`'s chain (array same 4265377792, serial
same 1738459905), and the runner compares the variants of one K with each other and `direct`
with `direct_copy`, not a K variant with `direct`; a `periodic` or `aperiodic`
group's checksum differs per K, and the check is across the variants of that
K.

**The spawn floor.** Each group also times `empty`, a program whose `main`
returns at once: 1 ms in every group. That is what starting a process costs on
this machine, and it is inside every figure below; at 100 ms and up it is
under 1%.

**The noise band.** Each group also times `direct` against `direct_copy`, a
byte-identical binary. Their best times differed by 0.0%, 1.3%, 2.6%, 0.0% and
0.0% in the five groups: **the band is ±2.6%**, and a difference inside it is
no difference. The band measures this machine's run-to-run noise on one
binary, not the effect of code layout: two binaries that differ only in where
the linker placed a loop can differ by more. Serial same is the example:
`switch` at K=2 runs 201 ms and at K=4 151 ms, though K=4 does strictly more
work per call. This note does not know why (§7); it is larger than the band,
and every K=2 variant in that row shares it, so the ratio column, not the
absolute time, is the figure to read.

**The K=1 rows.** At K=1 there is one class, so `switch`, `union`, `table` and
`proposed` all reduce to `direct` (one arm, folded) and time within the band of
it in the serial periodic, serial aperiodic and array periodic groups; the
serial same and array same groups built only `switch` at K=1, so their other
K=1 cells are blank. The `vtable` K=1 row does not fold: it still loads the one table entry and
calls through it, so its 201 ms to 257 ms is the price of one indirect,
non-inlined call per iteration with a perfectly predicted target.

### 3.2 The programs

`K` classes (1, 2, 4, 8, 13, 16), each with one method `f(x)` of different
arithmetic, called 200M times in a serial chain (`acc = f(acc)`) or 200M
times over a 1024-element array (`sum += f(r + j)`), with the receiver's class:

- **same**: always class 0 (the set has K members, the run sees one);
- **periodic**: drawn by xorshift from 0..K-1 once, into a 1024-entry pool
  replayed in order (a predictor can learn a 1024-long pattern partly);
- **aperiodic**: drawn by xorshift on every call (serial only).

Each is written five ways:

| Variant | What it is |
| --- | --- |
| `switch` | the hand program: a `kind` field in each object, `call(o, x)` switches on `o.kind` and calls one function per class |
| `union` | a discriminated union of K classes, each with its own `readonly kind`; `call` switches on `s.kind` and calls `s.f(x)` |
| `table` | WP51's function references: `tbl[o.kind](o, x)` over a `((o, x) => u32)[]` |
| `proposed` | what `Dyn<I>` lowers to: the tag beside the pointer (a parallel `tags` array, or the drawn tag), passed to `d(t, o, x)`, a `switch` on `t` (§2.3) |
| `vtable` | `proposed`'s IR with `@d` rewritten to an indirect call through a 16-entry global table (§12.2) |

### 3.3 Dispatch

Best of 7, milliseconds; in brackets, the ratio to `switch`.

**serial, same** (direct 151):

| K | switch | union | table | proposed | vtable |
| --- | --- | --- | --- | --- | --- |
| 1 | 150 | | | | |
| 2 | 201 | 202 | 202 | 205 (1.02) | 250 (1.24) |
| 4 | 151 | 148 | 152 | 150 (0.99) | 211 (1.40) |
| 8 | 151 | 152 | 159 | 151 (1.00) | 201 (1.33) |
| 13 | 153 | 152 | 251 | 155 (1.01) | 201 (1.31) |
| 16 | 155 | 182 | 174 | 150 (0.97) | 200 (1.29) |

**serial, periodic** (direct 151):

| K | switch | union | table | proposed | vtable |
| --- | --- | --- | --- | --- | --- |
| 1 | 151 | 152 | 152 | 150 | 254 |
| 2 | 200 | 201 | 201 | 202 (1.01) | 963 (4.82) |
| 4 | 189 | 238 | 163 | 195 (1.03) | 449 (2.38) |
| 8 | 257 | 272 | 264 | 259 (1.01) | 812 (3.16) |
| 13 | 456 | 723 | 286 | 565 (1.24) | 900 (1.97) |
| 16 | 291 | 540 | 464 | 238 (0.82) | 906 (3.11) |

**serial, aperiodic** (direct 151):

| K | switch | union | table | proposed | vtable |
| --- | --- | --- | --- | --- | --- |
| 1 | 150 | 153 | 150 | 151 | 201 |
| 2 | 392 | 391 | 404 | 397 (1.01) | 1053 (2.69) |
| 4 | 1596 | 1850 | 1861 | 1210 (0.76) | 1416 (0.89) |
| 8 | 2161 | 2047 | 2371 | 1712 (0.79) | 1620 (0.75) |
| 13 | 2532 | 2684 | 2997 | 2130 (0.84) | 2021 (0.80) |
| 16 | 2264 | 2405 | 2637 | 1845 (0.81) | 1655 (0.73) |

**array, same** (direct 103):

| K | switch | union | table | proposed | vtable |
| --- | --- | --- | --- | --- | --- |
| 2 | 105 | 107 | 158 | 121 (1.15) | 207 (1.97) |
| 4 | 123 | 144 | 146 | 132 (1.07) | 262 (2.13) |
| 8 | 156 | 161 | 180 | 156 (1.00) | 206 (1.32) |
| 13 | 156 | 156 | 178 | 156 (1.00) | 256 (1.64) |
| 16 | 171 | 170 | 191 | 174 (1.02) | 257 (1.50) |

**array, periodic** (direct 103):

| K | switch | union | table | proposed | vtable |
| --- | --- | --- | --- | --- | --- |
| 1 | 103 | 103 | 103 | 103 | 257 |
| 2 | 107 | 107 | 155 | 122 (1.14) | 678 (6.34) |
| 4 | 205 | 180 | 205 | 214 (1.04) | 483 (2.36) |
| 8 | 300 | 338 | 263 | 279 (0.93) | 929 (3.10) |
| 13 | 290 | 279 | 655 | 282 (0.97) | 932 (3.21) |
| 16 | 264 | 791 | 282 | 262 (0.99) | 1039 (3.94) |

Peak RSS was 13 MB for every binary.

Over the 25 cases with K ≥ 2, against `switch`:

| Variant | geomean | best | worst |
| --- | --- | --- | --- |
| `proposed` | **0.98** (20 side-array cases 1.02, 5 register cases 0.84) | 0.76 (serial aperiodic, K=4) | 1.24 (serial periodic, K=13) |
| `union` | 1.13 | 0.88 (array periodic, K=4) | 3.00 (array periodic, K=16) |
| `table` (WP51) | 1.14 | 0.63 (serial periodic, K=13) | 2.26 (array periodic, K=13) |
| `vtable` | 1.88 | 0.73 (serial aperiodic, K=16) | 6.34 (array periodic, K=2) |

What this says, and does not:

- **The proposed lowering is the hand program's cost here, and this is not
  stage 2's form.** Its geomean is 0.98 and 12 of its 25 cases sit within 3%
  of `switch`; it is never the slowest variant of a row. Only the five serial
  aperiodic cases take the tag from a register (the drawn index, 0.84x in
  geomean, a shape that favours `proposed` by construction: `switch` must
  load what `proposed` already holds). The other 20 read it from a side
  `i32[]` beside the pool (1.02x; the ten array rows 1.03x), a stored place
  stage 2 refuses. Stage 2's own form is measured in §3.6; the stored form the
  note proposes, the tagged word, is §3.4's (1.11x, 1.18x on the array rows).
- **Its outliers go both ways and are larger than the band.** It is faster by
  16% to 24% on every aperiodic row with K ≥ 4 (the tag comes from a register,
  not a load from the object the call is about to read), and slower by 24% on
  serial periodic K=13 and 14% to 15% on the K=2 array rows. The two `switch`
  programs differ only in where the tag is read from, and the machine code
  shows it (§12.9): at serial aperiodic K=4 the `switch` and `proposed` hot
  loops are 50 and 49 instructions, the same three-compare chain on the tag and
  the same arms (four members: three compares, the fourth the fall-through), and differ in one place — `switch` loads the tag from
  the object (`mov esi, [rdx]`), `proposed` takes it from the index it already
  holds (`shr esi, 8; and esi, 3`). At K=13 both become one jump table (88 and
  87 instructions). With no counters (§7) this note does not claim why any
  row moves.
- **A vtable is the wrong representation here**: 1.88x in geomean and up to
  6.34x. Its indirect call hides the arms from the inliner, and the callee from
  the attribute fixpoint the escape proof reads (§2.5; an inference from how
  the proof works, not a §4 measurement: no §4 program was built with a
  vtable). Its K=4 hot loop is 22 instructions, the
  whole of it the xorshift, an index and `call [r14+rcx]` (§12.9): every arm
  is out of line.
- **Where a vtable wins, the proposal keeps the switch anyway.** Aperiodic,
  K ≥ 8 is the one place the vtable is faster than `proposed`: by 5% (1620
  against 1712 at K=8, 2021 against 2130 at K=13) to 10% (1655 against 1845 at
  K=16); this note claims no cause (§7). The note does not lower a large set
  to a table of function pointers: the gain is 5% to 10% on that shape only,
  the cost against `proposed` is 1.30x (serial same K=13, 201 against 155) to
  3.97x (array periodic K=16, 1039 against 262) on every other shape of the
  same K, and the indirect call removes the callee from the attribute
  fixpoint the escape proof reads at every site, not only the hot ones (an
  inference, as above). A program whose calls are that unpredictable can still
  write the table itself with WP51's function references (`table` above).
  §11 records the threshold as a later question.
- **A union pays for `s.f(x)` re-dispatching per arm** at large K (3.00x at
  array periodic K=16), and WP51's table form pays, per site, a
  bounds check on `kind` against the table's length and an `i32` load of the
  function reference before its `$ref.` dispatcher's `switch`, whose arms are
  inlined: no indirect call (§12.9, `serial_aperiodic_k4_table`: `cmp rdi,0x4;
  jae`, then `mov esi,[rsp+rdi*4+0x60]` and a three-compare chain).

### 3.4 The stored form

The `proposed` array rows of §3.3 keep the tags in a separate `i32[]` (a
structure of arrays, SoA: 12 bytes a slot). That is not a form the note can
ship: I5 asks for the hand program's size, and 12 is not 8 (§2.3). Two stored
forms were measured beside it in one run of seven rounds (`timing_tp`; direct
103 and 106, copies 103 and 106, `empty` 1 ms, `checksums ok`):

- **AoS**, one 16-byte `{ i32, ptr }` slot per element (§12.3), the round-0
  form: fails I5 (16 against 8);
- **tp**, the tagged word §2.3 chooses: one 8-byte element, the tag in bits
  48–55, read with `lshr`/`trunc` and stripped with `llvm.ptrmask`
  (`mktp.mjs`, §12.8): meets I5.

Milliseconds; in brackets, the ratio to `switch`:

| Group | K | switch | SoA | AoS | tp |
| --- | --- | --- | --- | --- | --- |
| array same | 2 | 112 | 126 (1.12) | 124 (1.11) | 131 (1.17) |
| array same | 4 | 126 | 132 (1.05) | 135 (1.07) | 137 (1.09) |
| array same | 8 | 158 | 160 (1.01) | 164 (1.04) | 170 (1.08) |
| array same | 13 | 165 | 156 (0.95) | 176 (1.07) | 176 (1.07) |
| array same | 16 | 179 | 176 (0.98) | 198 (1.11) | 199 (1.11) |
| array periodic | 2 | 112 | 123 (1.10) | 127 (1.13) | 126 (1.12) |
| array periodic | 4 | 207 | 220 (1.06) | 207 (1.00) | 204 (0.99) |
| array periodic | 8 | 295 | 278 (0.94) | 289 (0.98) | 494 (1.67) |
| array periodic | 13 | 290 | 289 (1.00) | 388 (1.34) | 442 (1.52) |
| array periodic | 16 | 268 | 268 (1.00) | 296 (1.10) | 313 (1.17) |

A second run (`timing_tp3`, nine rounds) repeated the three periodic rows that
move and timed the serial programs' `tp` variant (the same 1024-entry pool of
tagged words, read under a serial chain, §12.8); each serial cell is tp/switch
in milliseconds:

| Group | K | switch | SoA | AoS | tp |
| --- | --- | --- | --- | --- | --- |
| array periodic | 4 | 208 | 220 (1.06) | 211 (1.01) | 211 (1.01) |
| array periodic | 8 | 302 | 273 (0.90) | 285 (0.94) | 501 (1.66) |
| array periodic | 13 | 285 | 291 (1.02) | 390 (1.37) | 426 (1.49) |

| Group | K=2 | K=4 | K=8 | K=13 | K=16 |
| --- | --- | --- | --- | --- | --- |
| serial same, tp | 205/205 (1.00) | 157/158 (0.99) | 157/157 (1.00) | 157/157 (1.00) | 158/157 (1.01) |
| serial periodic, tp | 213/208 (1.02) | 196/195 (1.01) | 368/253 (1.45) | 289/394 (0.73) | 524/382 (1.37) |

Serial periodic at K ≥ 8 swings from run to run for every variant, `proposed`
included (565 ms in §3.3 and 585 ms here at K=13, against `switch`'s 456 and
394; 238 ms at K=16 in both): its rows are the least trustworthy in the note,
and the 0.73, 1.45 and 1.37 above are read as noise of that shape, not as a
gain or a loss of the tagged word.

**The band is within a run.** ±2.6% is `direct` against `direct_copy` inside
one run. Between runs the same binary moves more: `switch` at array same K=2
is 105 ms in §3.3's run and 112 in `timing_tp` (7%), and at array periodic
K=8 295 and 302 in this section's two runs (2%). Every ratio here is therefore
taken within one run, and no ratio compares a figure of one run with another's.

Geomeans against `switch`:

| Stored form | Arrays (10 cases) | All stored cases (20) | Slot | I5 |
| --- | --- | --- | --- | --- |
| SoA | 1.02 | — | 12 B | fails |
| AoS | 1.09 | — | 16 B | fails |
| tp | **1.18** | **1.11** | 8 B | meets |

**No stored form meets I2 and I5 together.** The one that comes within the
band of the hand program in the geomean, SoA at 1.02x, is 12 bytes a slot; AoS
is outside the band at 1.09x and 16 bytes; the one that is as wide as the hand
program, tp, is 18% slower on arrays. The cost is not spread evenly: tp is
0.99x on one array row (periodic K=4), 1.07x to 1.09x on three, 1.11x to
1.17x on four, and 1.52x and 1.67x at array periodic K=13 and K=8, the two
that stay at 1.5x to 1.7x in both runs; its serial rows are within the band at
every K of the same set and at K ≤ 4 of the periodic one.

The machine code says where those two rows' cost is not (§12.9). At array
periodic K=8 the `switch` and `tp` hot loops are the same jump table over the
same eight arms; they differ only in how the tag is had — `mov r9d, [r8]` (the
object's `kind`) against `and r9, rax; shr r10, 0x30; dec r10d` (strip the tag,
shift it down, count from 0). Three ALU instructions in place of a load cannot
cost 200 ms over 200M calls, 1 ns a call, on their own; the difference is in how
the branch predictor or the loop's placement meets the jump table, which
without counters (§7) this machine cannot show. It is recorded as unexplained,
and it is why stage 3 is gated (§1, §9): stage 3 lands when its own run of
these rows, with counters, passes the stage 3 gate (§8: the array geomean
inside the band, no array row above 1.25x), or it does not land.

Peak RSS for all of these is 13 MB at 1024 elements; §2.3 gives the 1M-element
array and the `Map` sizes, where the tagged word costs the hand program's
memory to the kilobyte.

### 3.5 A registry: K classes, H methods

The shape `Dyn` is for: 13 implementations of a 4-method interface, called
50M times in all through a 1024-entry pool (§12.6). Written by hand (a `kind`
field and four `switch` functions), with WP51's function references (four
`Hook[]` tables indexed by `kind`), and as the proposed lowering (four
dispatchers on a tag). The proposed program's pool is a stored place: a
`Plugin[]` and a parallel `tags: i32[]`, §3.4's SoA form (`r/src/reg_proposed.ts`
`:128`), because the tagged word is stage 3's; its 51 ms is SoA's figure on
this shape, neither the tagged word's nor stage 2's (which cannot store a
`Dyn`; §3.6 runs the registry in stage 2's shape). A fourth program, `hand_copy`, is the hand source
copied byte for byte and built to a second binary, so the registry has its own
band. Run time is best of 7 (`r/timing3`, `empty` 1 ms, `checksums ok (3 pairs
compared)`);
`nish X.ts -o X.ll` and the full `scripts/build.sh --profile speed` build are
best and worst of seven rounds, interleaved (`r/ctime.py`, §12.10):

| Form | run | per hook call | `nish` compile, best/max | full build, best/max | binary | dispatchers |
| --- | --- | --- | --- | --- | --- | --- |
| hand | 50 ms | 1.0 ns | 7/8 ms | 1704/1815 ms | 7352 B | 4 hand `switch` functions |
| hand_copy | 50 ms | 1.0 ns | 7/9 ms | 1781/1913 ms | 7352 B | the same |
| proposed | 51 ms | 1.0 ns | 7/11 ms | 1756/1981 ms | 7352 B | 4, one per method of the 13-member set |
| table (WP51) | 191 ms (3.8x) | 3.8 ns | 8/11 ms | 1715/1883 ms | 8288 B | 1, a 52-member `$ref.` dispatcher |

All four print 425062. **The band here is 4%** in run time: hand and
hand_copy are both 50 ms in this run, and 50 against 48 in the first one
(`r/timing2`, the same binaries under the earlier runner), so the note takes
the wider figure; the build times' best-to-max spread is 6% to 13% for every form,
hand_copy included, so build and compile differences under that spread are no
difference. The proposed form is the hand form inside both bands: 51 against
50 ms (2%), 1.0 ns a hook call, a binary of the same size to the byte (not
compared with `cmp`; the symbols differ), and a compile
time whose best is the hand form's. That compile time times no `Dyn` pass:
the proposed program's dispatchers are written by hand in Nish, so it is the
compile time of four more ordinary functions, not of set solving or
dispatcher generation (§7). The table form is 3.8x slower (191 against
50), and shows
why §2.4 makes one dispatcher per (set, method) and not per type: its four
same-typed `Hook[]` arrays share one place, so one 52-member set and one
`$ref.0.fr2.$Plugin.u32.u32.0` dispatcher serve all four, and NL9017 fires
("can reach 52 functions"). A `Dyn<Plugin>` set holds 13 classes, and each of
its four methods gets its own 13-arm dispatcher: four dispatchers for the set.

### 3.6 Stage 2's surface

§3.3's `proposed` arrays and §3.5's registry read a tag from a stored place,
which stage 2 refuses (NL2779). This section times what stage 2 admits: the
tag and pointer in registers, made where the class is chosen and carried to the
call, against the hand program that holds a `Base` pointer and reads its
`kind` field at the call. The programs are §12.11's. As in §3.3, the K classes
are modelled as K objects of one class (`kind: i32`, `a: u32`) and K functions
`g0` to `gK-1` of different arithmetic bodies, which is what each class's
method compiles to; the K objects are locals made before the loop. Each call's
result is folded into a checksum, and each pair's checksums match
(`checksums ok (17 pairs compared)`).

- **strategy**: a class chosen once, from a runtime xorshift value, then called
  200M times in a loop.
- **periodic**: per call, the class is `kinds[i & 1023]`, a stored `i32[]` of
  1024 entries that cycles through the K classes; 200M calls.
- **aperiodic**: per call, the class is drawn from the xorshift state; 200M
  calls.
- **reg2**: §3.5's registry in stage 2's shape: K=13, H=4 hooks, 12.5M rounds
  (50M calls); per round a `switch` on `kinds[i & 1023]` picks the plugin and
  the four hooks are called on it. `reg2_hand_copy` is a copy of `reg2_hand`
  (the binaries are identical), which gives the band.

In the hand variant the selecting code makes a `Base` (the class, widened) and
the call site `switch`es on its `kind`; in the surface variant the selecting
code makes the tag and pointer and the call goes through a dispatcher
`d(tg, o, x)`, a `switch` on the tag whose arms call each class's method.
That dispatcher is written by hand in Nish, in the form §2.3 specifies; it is
not the compiler's `$dyn.` function, which stage 2 generates (§7).

Best of 7, interleaved and rotated (§12.7), in ms; peak RSS 12 MB for every
binary; `empty` 1 ms.

| shape | K=2 | K=4 | K=8 | K=13 | K=16 |
| --- | --- | --- | --- | --- | --- |
| strategy, hand / surface | 103 / 102 | 150 / 155 | 158 / 158 | 218 / 218 | 153 / 157 |
| strategy, ratio | 0.99 | 1.03 | 1.00 | 1.00 | 1.03 |
| periodic, hand / surface | 211 / 130 | 275 / 202 | 894 / 277 | 1422 / 310 | 1169 / 267 |
| periodic, ratio | 0.62 | 0.73 | 0.31 | 0.22 | 0.23 |
| aperiodic, hand / surface | 379 / 838 | 1367 / 1235 | 1972 / 1601 | 2525 / 2124 | 2414 / 1778 |
| aperiodic, ratio | **2.21** | 0.90 | 0.81 | 0.84 | 0.74 |

| | hand | surface | hand_copy |
| --- | --- | --- | --- |
| reg2 | 91 | 47 | 94 |

The band, from `reg2_hand` against `reg2_hand_copy`, is ±3.3%. Geomeans of the
ratio: strategy 1.01, periodic 0.37, aperiodic 1.00; all 15 cases 0.72 (0.67
without aperiodic K=2). The registry is 47 ms against 91.

- **One case fails the 1.25x line.** Aperiodic K=2 is 2.21x. In `clang -O3`'s
  machine code (§12.9's `hot.py`) the hand loop is 25 instructions and has no
  branch on the drawn bit: `test ebp,0x100; cmove rdx,rbx` selects the object
  and `cmp DWORD PTR [rdx],0x0; cmove ecx,edi` its arm. The surface loop is
  23 instructions and branches on it (`test ebp,0x100; je`). A random bit is a
  branch the predictor misses half the time; with no counters (§7) the note
  states the difference in the code, not that it is the cost.
- **The periodic and registry wins are a merge, not a property of `Dyn`.** At
  periodic and aperiodic K=13 and in `reg2`, the hand loop holds two indirect
  jumps through tables (the selecting `switch` and the `kind` `switch`) and the
  surface loop one: LLVM merged the selection with the dispatch once the tag
  was a value it could follow. A hand program that called the method inside
  the selecting arm would get the same code. I2 bounds how much slower `Dyn`
  may be; these rows do not show `Dyn` beats a hand program written to
  dispatch once.
- **Strategy is the hand program's cost**, within the band at every K.

## 4. The escape proof through a dynamic call

### 4.1 The three cases

The question is whether a call through a dynamic set can still place its
argument on the stack. Each program (§12.5) allocates one `Obj` per iteration
and passes it to `d(t, o, k, acc)`, a four-member dispatcher, in a loop of
1M, 10M and 100M:

- **A**: no member keeps `o`. The proof places every `Obj` on the stack.
- **B**: member 3 stores `o` into `k.last`; the other three do not. This is
  what a *join* would compile every call to, and what the escape-join refusal
  (§2.5) makes a compile error instead.
- **C**: member 3 keeps `o`, but the dispatcher's set holds members 0 to 2;
  member 3 is called once, outside the loop, directly. This is the per-place
  set doing its work: the keeper is not in the set, so the call places its
  argument as A does.

### 4.2 Results

Best of 7 (`e/timing2`, `checksums ok (3 pairs compared)`); milliseconds and
peak RSS in MB:

| Case | 1M | 10M | 100M |
| --- | --- | --- | --- |
| A | 2 ms, 13 MB | 7 ms, 13 MB | 66 ms, 13 MB |
| B | 5 ms, 13 MB | 41 ms, 77 MB | 391 ms, 764 MB |
| C | 2 ms, 13 MB | 9 ms, 13 MB | 77 ms, 13 MB |

B is 5.9x A at 100M and its memory grows with the loop: every object the
loop allocates is kept by the arena, because one member might keep it. A and
C are flat at 1x, 10x and 100x (I4). C's time is not comparable with A's (a
3-way dispatch over different arithmetic); its RSS is the point. A and B
print the same accumulator (4246864251); B's second number is the last object
kept (999999 at 1M), A's is 0.

### 4.3 What the compiler says

`build/nish --explain-memory` on each, in full. Case A (`esc_A_s.ts`):

```text
esc_A_s.ts:24:1: memory: `main` keeps what it allocates for the rest of the run, because an allocation it makes is held where this analysis does not prove it dead when it returns (a local assigned more than once, an array of its own, or a callee that keeps its argument); the first allocation it holds is on line 25
explain-memory: 0 of 0 allocating loops keep what a pass allocates past the pass; 1 of 1 allocating functions with a scalar result keep what they allocate past the call
```

Case B (`esc_B_s.ts`):

```text
esc_B_s.ts:27:1: memory: `main` keeps what it allocates for the rest of the run, because an allocation it makes is held where this analysis does not prove it dead when it returns (a local assigned more than once, an array of its own, or a callee that keeps its argument); the first allocation it holds is on line 28
esc_B_s.ts:30:3: memory: this loop keeps what each pass allocates for the rest of the run, because the allocation on line 32 is stored into memory, where this analysis stops following it
explain-memory: 1 of 1 allocating loops keep what a pass allocates past the pass; 1 of 1 allocating functions with a scalar result keep what they allocate past the call
```

Case C (`esc_C_s.ts`):

```text
esc_C_s.ts:26:1: memory: `main` keeps what it allocates for the rest of the run, because an allocation it makes is held where this analysis does not prove it dead when it returns (a local assigned more than once, an array of its own, or a callee that keeps its argument); the first allocation it holds is on line 27
explain-memory: 0 of 0 allocating loops keep what a pass allocates past the pass; 1 of 1 allocating functions with a scalar result keep what they allocate past the call
```

The `main` line is the same in all three and is not about the loop: it is the
once-only `new Keep(...)` before the loop (line 25, 28, 27), which `main`
holds for the rest of the run, as any program's `main` would. The loop lines
are the result:

- **A and C**: `0 of 0 allocating loops` — the loop's `new Obj(...)` is not
  counted as an allocating loop at all, because it is no longer an
  allocation. In C's IR it is `%Obj.obj = alloca %struct.Obj, align 8` in
  `main`'s entry block, initialised each pass by
  `call void @Obj.constructor(%struct.Obj* %Obj.obj, i32 %7, i32 %8)` and
  passed straight to `call i32 @d(i32 %9, %struct.Base* %11, ...)`, the
  three-member dispatcher. The one `Obj` that member 3 keeps is the
  `new Obj(3, 9)` after the loop, and it stays on the heap
  (`@nish_alloc_struct(i64 8)`), passed to `@m3` directly. A's IR has the same
  `alloca` and the same loop, with the four-member `@d`.
- **B**: `1 of 1 allocating loops keep what a pass allocates`, and the reason
  names line 32, the `new Obj` whose result member 3 stores (`k.last = o`,
  line 16), reached through the dispatcher.

So the escape proof reads through the dispatcher's arms as it reads through
any direct call: the dispatcher is an ordinary function with ordinary direct
calls (§2.3), and the proof needs nothing new. What the refusal adds is that
case B cannot be written by accident through a `Dyn<I>`: B's call site,
written as a `Dyn<Base>` call over a set holding a keeper and three
non-keepers, is NL2771 under the rule, and stage 2 lands it as the negative
`tests/cases/reject_dyn_escape_join.ts` with the message pinned (§9).

### 4.4 Valgrind

`esc_A_s`, `esc_B_s` and `esc_C_s` are among the 183 binaries the I4 run
(`v/run.sh`, §12.10) put under `valgrind --leak-check=full
--error-exitcode=1`: each shows 0 bytes in use at exit and 0 errors, B
included, because the arena frees what B keeps when the run ends.

## 5. Semantics

### 5.1 Node and `--emit-ts`

Classes are per [wp33-round-trip.md](wp33-round-trip.md) §2:

| What | Native | TypeScript | Class |
| --- | --- | --- | --- |
| `Dyn<I>` | a tagged reference: a tag and a pointer in registers, one tagged word in a stored place (§2.3) | `type Dyn<T> = T`: the interface itself | A |
| `s.m(x)` on a `Dyn<I>` | the dispatcher's arm for the held class | the prototype's method of the held object | A: the same body runs |
| `===`, `!==` | the objects' identity | the objects' identity | A |
| `Dyn<I> \| null`, `=== null` | tag 0 | `null` | A |
| the debug tag check | unreachable by construction (I7) | — | no reading to differ |
| an interface method signature | checked by `implements` | checked by `implements` | A |
| a method call on a plain `I` | refused (NL2774) | allowed | B: a compile-time refusal |
| a class with the right methods and no `implements` | refused (NL2773) | allowed: TypeScript is structural | B |

`--emit-ts` writes `Dyn<Shape>` as `Shape` and drops the `nish:dyn` import,
the way it drops every type-only import; the method call is written as it was
read. No C row, so no helper.

### 5.2 The C ABI

None crosses (§2.6). A real C callback or C-side vtable is
[wp27-ffi.md](wp27-ffi.md)'s question and this note does not move it.

### 5.3 `-g` and DWARF

- **The value in a debugger.** A `Dyn<I>` is a `DW_TAG_structure_type` named
  `Dyn<Shape>` with two members: `tag`, whose type is a
  `DW_TAG_enumeration_type` with one `DIEnumerator` per class of the set
  (`name: "Circle", value: 1`), and `obj`, a pointer to `Shape`. `src/debug.ts`
  emits the enumeration already for an `enum` and, since WP51, for a function
  reference; the structure is new. gdb would print
  `s = {tag = Circle, obj = 0x...}` for a local or a parameter, whose two
  halves are two SSA values. A stored tagged word (stage 3) is described as
  the same structure over one 64-bit word with two bit-field members:
  `obj`, an unsigned 48-bit field at bit 0 (printed as an address), and
  `tag`, the enumeration at `DW_AT_data_bit_offset` 48, 8 bits wide; on
  wasm32, `tag` is the low 3 bits and `obj` the rest. gdb prints it as
  `{obj = 0x..., tag = Circle}`; stage 3 lands a `-g` test that reads it.
- **The dispatcher** is artificial, as WP51's is (`DIFlagArtificial`, line 0),
  and a backtrace from inside a method shows the method, then the caller at
  the call line, because the dispatcher tail-calls (WP51 §5.3 found exactly
  this for its dispatcher under gdb 15).
- **What would print** a `Dyn` as the held object's own type
  (`p *s` showing a `Circle`) is a debugger extension; not proposed.

### 5.4 The rolling freeze

`src/` may not use `Dyn` until the release after the one that ships it. It
needs none first: the compiler's own dispatch is central `switch`es on node
kinds (`docs/wp14-selfhost.md` §3a D2), which is the lowering this proposal
generates; whether a release after should rewrite one as a `Dyn` is a
readability question, not a speed one, since §3.6 measures its register form
(a `Dyn` made where its class is known, the form a local `Dyn` in `src/`
would take) at 0.72x of the hand `switch` in geomean.

## 6. What leaned on "interfaces describe layout only" and "every method call names one symbol"

Grep over `src/`, `std/`, `docs/` (outside `docs/reference/`, which is
generated), `.claude/` and `CLAUDE.md` at `e0a1661e`, for the two premises and
their neighbours ("vtable", "dynamic dispatch", "cannot declare methods",
"one symbol", "no inheritance"). Each row says what the premise holds up and
what the proposal does to it.

| Where | What it says | What leans on it | Under the proposal |
| --- | --- | --- | --- |
| `src/statements.ts:1111` (`refuseMembers`; the error at `:1142`), `src/codes.ts:1086` (NL2048) | `` Interface `X` cannot declare methods (interfaces describe layout only) `` | the refusal | narrows to what is not a plain signature (stage 1, §9) |
| `src/structs.ts:1159`, `src/codes.ts:1597` (NL2079) | `` `X` is not a declared interface ``: `implements` names an interface of the class's own module | which classes a set can hold | holds through stage 3: a `Dyn<I>`'s members are classes of `I`'s module (§2.2); stage 4 decides whether to lift it, with NL2079's words (§9) |
| `src/structs.ts:1231` (`checkImplements`) | `implements` is a field-prefix check | the bitcast widening | learns to check method signatures too; the prefix rule stands (stage 1) |
| `src/generics.ts:3201` (`implementsDeclaration`) | a constraint is satisfied by a class or its `implements` | `<T extends I>` | an interface with methods constrains `T` and its methods are callable (stage 1) |
| `src/emit-classes.ts:13` | "There is no inheritance and no vtable — a method call resolves to the method of the receiver's own type" | the emitter's one path | still true of every call the checker records: a `Dyn` call's recorded callee is the dispatcher, itself an ordinary function (stage 2); the comment gains that sentence |
| `src/emit-classes.ts:447` (`emitMethodCall`) | a method call with no recorded callee is an internal error | the side-table rule | holds: the dispatcher is recorded (§2.3) |
| `src/interop-header.ts:100`–`111` (`structDefinitions`) | an interface is its flattened field prefix in C | the C header | holds: a `Dyn` never reaches it (§2.6) |
| `src/fnref-places.ts`, `src/fnrefs.ts`, `src/emit-fnrefs.ts` | sets, dispatchers and the tag check for function references | WP51 | generalised to a member that is a class's method (stage 2) |
| [LANGUAGE.md](LANGUAGE.md) "Classes" (`:3070`–`3082`) | "every method call in a program names exactly one symbol and there is nothing for a vtable to decide" | the rule users read | true of every call but one through a `Dyn`, which names a dispatcher (stage 2 rewrites the sentence) |
| LANGUAGE.md "Method dispatch is static" (`:14229`–`14233`) | "every method call in a program names one symbol" | the performance model | gains the `Dyn` case and its cost (stage 2) |
| LANGUAGE.md `:262` (types table), `:3271` (constraints) | a class is a struct with no header and no vtable; constraints | the layout table | unchanged: no class gains a header; a row for `Dyn<I>` is added (stage 2) |
| LANGUAGE.md `:6230`, `:16102` | quote NL2048's words, "interfaces describe layout only" | the diagnostic index | rewritten to NL2048's narrowed words (stage 1) |
| [guide from-typescript](guide/getting-started/from-typescript.md) `:330`; [guide classes-and-interfaces](guide/language/classes-and-interfaces.md) `:4`, `:78`, `:100`; [AI.md](AI.md) `:1784` | an interface holds fields only, never methods | users and agents | rewritten to admit method signatures and `<T extends I>` (stage 1) |
| LANGUAGE.md `:8478`–`8500` (arrays of records) | an array of an interface is inline records, unless a class implements it, when it is a pointer per slot — "the language's only polymorphic container" | arrays | unchanged; `Dyn<I>[]` is a second polymorphic container, one tagged word (8 bytes, the hand array's) a slot (stage 3) |
| LANGUAGE.md `:12794` (`Map` values) | a value is anything but `void` and an interface | `Map` | unchanged for `I`; `Dyn<I>` is admitted as a value (stage 3) |
| [IR_COOKBOOK.md](IR_COOKBOOK.md) `:628` | a constrained generic is monomorphised | the cookbook | gains a `Dyn` entry beside it (stage 2) |
| [AI.md](AI.md) `:205`, `:294`, `:712` | no inheritance; dispatch is a `switch`; constraints | agents writing Nish | gains the `Dyn` idiom and when to prefer `<T extends I>` (stage 4) |
| [guide classes-and-interfaces](guide/language/classes-and-interfaces.md) `:236` | constraints | users | a section on `Dyn` (stage 2, which ships the construct a user sees: CLAUDE.md's "the user guide moves with the language") |
| [wp2-classes.md](wp2-classes.md) `:18`, `:120`–`138`; [roadmap/wp2-classes.md](roadmap/wp2-classes.md) `:15` | no vtable, by design | the history | historical notes; unchanged |
| [wp15-performance.md](wp15-performance.md) `:49`, `:60` | static dispatch as a speed property | the performance case | holds for every program without `Dyn` (I1) |
| [wp18-generics.md](wp18-generics.md) `:295` | constraints monomorphise | D2 | holds (D2) |
| [wp25-inheritance.md](wp25-inheritance.md) `:40`–`42`, `:155`–`160`; [roadmap/wp25-inheritance.md](roadmap/wp25-inheritance.md) `:15` | dynamic dispatch "is a work package of its own" | the pointer | repointed here by this PR |
| [wp26-stdlib.md](wp26-stdlib.md) `:97` | the library avoids dynamic dispatch | `std/` | unchanged in this work package: no stage adopts `Dyn` in `std/` (§11) |
| [wp28-compatibility-mode.md](wp28-compatibility-mode.md) `:144`, `:481`; [roadmap/wp28-compatibility-mode.md](roadmap/wp28-compatibility-mode.md) `:19` | C7: `extends` with virtual dispatch, in compat mode | the compat plan | unchanged; strict `Dyn` covers the interface half of C7, not `extends` |
| [wp51-function-references.md](wp51-function-references.md) `:1077` | no vtables: dispatch is closed-world | WP51 | intact: a `Dyn` set is closed and solved per program, and no stage adds a vtable |
| [FAQ.md](FAQ.md) `:12`, [wp0-validator.md](wp0-validator.md) `:40` | JavaScript's dynamic dispatch is out | the strict subset | true: prototype dispatch stays out; a pointer to this note is added |
| [README.md](../README.md) | (formerly) "There is no dynamic dispatch (classes have no inheritance, so every method call names one function)" | the front page | the sentence left the front page on `main`; nothing to repoint |
| `std/` | no interface declares a method (NL2048) | — | unchanged in this work package (§11) |
| [.claude/typescript.md](../.claude/typescript.md) `:90`–`92` | "An `interface` is a struct with fields only ... `class C implements I` means identical fields in the same order" | agents writing TypeScript in `src/` | stale at stage 1: stage 1's PR rewrites it to admit method signatures (named here, not edited by this PR) |
| `CLAUDE.md` | no sentence on either premise | — | nothing to change |

## 7. Not measured

- **Hardware counters.** `perf` is not installed on the machine; the
  outliers in §3.3, and the tagged word's array periodic K=8 and K=13 rows in
  §3.4, have no branch-miss or cache-miss figure behind them. §12.9's machine
  code shows what the hot loops are and where they differ, not why the
  difference costs what it does; this note claims no cause.
- **The real dispatchers.** The `proposed` and `tp` variants are the
  dispatcher written in Nish and the tagged word written into the IR by a
  script; the IR is the compiler's (§2.3), but no `$dyn.*` function was
  generated, so its attributes, its name and its `default` arm are what §2.3
  specifies, not what a build produced. §3.6's surface dispatcher is the
  same: written by hand. Stage 2 reruns §3.6 with the surface variants
  rebuilt on `Dyn<Base>`; stage 3 reruns §3.4.
- **Stored places other than an array element.** §3.4 times array elements;
  a `Dyn` field, a `Map` value and a `Result` payload use the same word but
  were not timed. §3.5's registry holds its pool as two arrays (SoA).
- **The escape-join refusal's reach.** No program was checked for how often
  NL2771 would fire, or how many arena allocations it prevents.
- **Compile time.** Set solving and the dispatchers' emission were not timed.
  §3.5's compile-time row times its hand-written dispatchers, which are
  ordinary functions to today's compiler, so it says nothing of a `Dyn` pass.
- **§3.6 under valgrind or counters.** The stage 2 programs were not run under
  valgrind, and aperiodic K=2's 2.21x has no branch-miss figure.
- **Sets wider than 16.** NL9020's threshold of eight is WP51's; no program
  here measures a set of 32 or 100.
- **DWARF and gdb.** §5.3's debugger reading was not built or run.
- **`--emit-ts`.** The TypeScript reading of `Dyn<T> = T` was not run under
  Node.
- **`std/`.** No `std/` module was rewritten to use the lowering.
- **Other machines.** One x86-64 machine; no arm64 run, no WASI run. The
  aarch64 and wasm32 sizes in §2.3 are LLVM's data layout (`probe.ll`), not a
  program run there; wasm32's 3-bit tag was not timed.

## 8. The recommendation

**Ship stage 1 now. Stages 2 and 3 are gated, and on this note's figures
neither lands yet.**

- **Stage 1** (no IR moves): interface method signatures, checked by
  `implements`, callable on `<T extends I>`. The common case — one class at a
  time — costs nothing, as today. It ships on its own: it changes no program's
  IR (I1) and needs no figure.
- **Stage 2 is gated.** `Dyn<I>` in locals, parameters, returns and calls, the
  escape proof intact (§4: case B's 5.9x and 764 MB is a compile error,
  NL2771), the debug tag check, and a stored `Dyn<I>` refused with NL2779,
  whose words name what to write instead. It lands when its PR rebuilds §3.6's
  programs with K real classes `C{i} implements Base` and `Dyn<Base>`,
  times them with `python3 bench.py groups.json 7` (§12.7), which must print
  `checksums ok`, and passes **the stage 2 gate**: over the 15
  strategy, periodic and aperiodic cases, the geomean of surface over hand
  inside the band or below it, and no case above 1.25x; `reg2` reported beside
  them. On §3.6's modelled surface the geomean passes (0.72x) and one case
  fails: aperiodic K=2 at 2.21x. If the compiler's own dispatcher also fails
  there, stage 2 declines, and the note's §11 question (a set of two lowered
  to a select) is what to try first.
- **Stage 3 is gated, and follows stage 2.** It lands when its PR reruns
  §3.4's rows against the compiler's tagged word, with counters if the machine
  has them, and passes **the stage 3 gate**: the geomean of the ten array rows
  inside the ±2.6% band and no array row above 1.25x. On §3.4's figures it
  does not (1.18x); NL2779 stays, and §11's tag in the object is the next form
  to try. Its form is not reopened: a stored form wider than the hand
  program's fails I5, which is the brief's and is not redefined here.
- **Stage 4**: the agents' idiom and the NL2079 decision, after stage 2.
  `std/` does not adopt `Dyn` in this work package (§11).

Two conditions go with the gated stages:

1. **A gate is run on the build, not on this note.** §3.6's surface and
   §3.4's tagged word are hand-written models of what the compiler would emit.
   Each gated stage reruns its programs against its own output and states the
   band, every case's ratio and any case above 1.25x in its PR.
2. **The vtable stays out.** It wins only aperiodic K ≥ 8, by 5% to 10%, and
   costs 1.88x elsewhere (§3.3) and, by inference, the escape proof at every
   site.

## 9. If it ships: stages

Each stage is one PR and lands the construct's checklist
([ARCHITECTURE.md](ARCHITECTURE.md), "How to add a construct"): golden `.ll`,
an `llvm-as` pass, a native round trip with expected stdout, negative tests,
the `LANGUAGE.md` rule, the cookbook entry and the guide page, and the
`--emit-ts` reading of what it adds. A user sees each stage, so each moves its
guide page in its own PR. Test names are proposed; each stage's PR settles
them. Every stage changes `src/`, so every stage's PR also runs CLAUDE.md's
standing steps for it: `node tests/self/goldens.js --update` and
`node tests/differential/goldens.js --update` for its new positive cases,
`tests/differential/emit-ts-known.txt` regenerated under CI's Node if a
verdict moves, and `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`) and
`node tests/run.js performance` before it is pushed.

**Stage 1: interface method signatures and `<T extends I>`.** No IR moves.

- Rule: an interface may declare method signatures; `implements` checks them
  (NL2778); `<T extends I>` calls them on `T`; a method call on a plain `I` is
  NL2774, naming `<T extends I>`.
- Code: `refuseMembers` (`src/statements.ts:1111`) admits a signature;
  the interface collector (`src/structs.ts:1178`–`1182`, which keeps only
  fields) records the signatures; `checkImplements` (`src/structs.ts:1231`)
  and `implementsDeclaration` (`src/generics.ts:3201`) read methods;
  `satisfiesConstraint` (`src/generics.ts:3175`–`3185`) refuses a
  method-bearing interface as its own argument (NL2780, reported by
  `checkConstraints`, `src/generics.ts:3218`, the one caller, for function
  and class templates alike); NL2556's check (`src/members.ts:1003`, whose
  `STRUCT_CLASS` test goes; words at `:742`) widens to such an interface; the method lookup on a
  constrained `T` reads the interface's signatures. The comments that say an
  interface holds only fields are rewritten with it: `src/parser.ts:2883`
  and `:2963`, and `src/statements.ts:1107`.
- Rule, the ways a value of an interface that declares a method comes to
  exist. A method is only ever called on a `T` bound to a class, so a plain
  `I` value is harmless wherever it comes from, provided it can never become
  that `T`. Each way in:
  - A class instance converted to `I` (a class that `implements I`): admitted;
    a call on it is NL2774.
  - `I` itself as the type argument of `<T extends I>`, written
    (`area<Shape>(s)`) or inferred from an argument typed `I`: refused,
    NL2780 (new). Today `satisfiesConstraint`
    (`src/generics.ts:3175`–`3185`) answers `info === want ||
    implementsDeclaration(info, want)`, so the interface satisfies its own
    constraint; the instantiation `area$$Shape` would reach `emitMethodCall`
    with no callee bound and stop with an internal error (`emitter: no method
    recorded for ...`, `src/emit-classes.ts:447`–`449`). Stage 1 keeps
    `info === want` for an interface that declares only fields (WP18's
    `gen_constraint` relies on it) and refuses it for one that declares a
    method. Words: `` `Shape` cannot be `T` in `<T extends Shape>`: `Shape`
    declares methods, and a call through `T` runs a class's method, so `T` is
    a class that declares `implements Shape` ``. A constrained type parameter
    passed on (`<U extends Shape>` calling `area<U>`) is bound to a class by
    the time it is instantiated, and is checked there.
  - An object literal typed `I`: refused with NL2556, the rule that already
    refuses one typed as a class with methods (`classLiteralMessage`,
    `src/members.ts:742`–`744`, tested at `:1003`), its condition widened to an interface that
    declares a method. Under Node the literal is a plain object with no
    method, and `--emit-ts`'s `tsc` would refuse it for the missing member.
    Interface words: `` `Shape` declares methods, so a `Shape` is made only
    by `new` of a class that implements it: an object literal would be a
    plain object under Node, with none of the methods. Write `new Circle(...)`
    for a class that `implements Shape` `` (the class named is the first that
    implements `Shape`, or `a class` when none does). `src/codes.ts`'s NL2556
    entry gains the interface case.
  - Typed JSON: already refused, an interface is not a class to `jsonRefusal`
    (`src/json-typed.ts:1119`–`1123`).
  - C, the host or `declare function`: a pointer to `I`'s fields, as today.
    It names no class, and by the two refusals above it can reach no method
    call.
  - An inline record (an interface no class implements, `inlineElementStruct`,
    `src/program.ts:2650`): the same value as above, copied in place; no class
    exists to call.
- Tests: `tests/cases/iface_method_sig` (golden `.ll`, `llvm-as`, round trip),
  `gen_constraint_iface_method` (golden `.ll`, compared byte for byte by a
  `tests/run.js` check with `gen_constraint_iface_method_class`'s: the same
  program, the same `interface Shape` fields and the same `class Circle
  implements Shape`, but `Shape` declares no method and the function is
  `<T extends Circle>`; both instantiate only at `Circle`, so both emit
  `twice$$Circle`, both define `%struct.Shape`, and `fieldTbaa`
  (`src/tbaa.ts:137`) tags no field access of either, since `Circle`
  implements an interface in both; a twin without `implements` would carry
  `!tbaa` and differ for that reason alone), negatives
  `reject_iface_method_optional` (`area?(): i32;`, NL2048), `reject_iface_method_on_plain`
  (NL2774), `reject_implements_method_missing` and
  `reject_implements_method_signature` (NL2778), `reject_iface_as_own_type_arg`
  (NL2780, written and inferred) and `reject_iface_method_literal` (NL2556,
  the interface words).
- NL2048 narrows. Stage 1 admits a plain signature, `m(params): R;`, and NL2048
  keeps refusing every other method form the parser reads in an interface: an
  accessor, an optional `m?()` and a type parameter `m<T>()`. Its words become
  `` Interface `Shape` cannot declare `area` that way: an interface method is
  a plain signature, `area(params): R;`, with no accessor, `?` or type
  parameters ``, and `src/codes.ts`'s NL2048 entry is rewritten to match. A
  body never reaches the checker: `parseMethodSignature`
  (`src/parser.ts:2969`–`2987`) pushes an empty body and eats only `;` or `,`
  (`eatMemberSeparator`, `:2811`), so the `{` falls to `` an interface holds
  only annotated fields `` (`this.fail` at `:2903` and `:2932`). Stage 1 leaves the parser alone: a body
  stays that parse error, `tests/wordings/parser_refusals.txt` gains no entry,
  and the parser oracle sees no change. Only the comment above the call
  (`:2934`–`2935`, "for the checker to refuse (NL2048)") is rewritten to say
  the checker admits a plain signature.
- Tests that flip, each updated in stage 1's PR:
  - `tests/wordings/nl2048_interface_method.ts` declares `area(): i32;`,
    which stage 1 admits: it is retargeted to `area<T>(of: T): i32;`, a type
    parameter, which the parser reads and NL2048 still refuses; its header
    comment says so, and `nl2048_interface_method.err` takes the words above.
  - `tests/cases/reject_iface_method.ts` (`area?<T>(of: T): i32;`) and
    `tests/cases/reject_iface_accessor.ts` (`get size(): i32;`) stay refused;
    their `.err` files take the new words.
  - `tests/cases/reject_multi_decl.ts`'s `interface Shape { area(): number; }`
    is admitted, so its `.err` loses that line; the file keeps its other
    refusals.
  - `tests/wordings/nl2330_member_not_in_constraint.ts` still fails (`grow`
    is not in `Shape`), but its comment ("an interface has fields only") is
    rewritten.
  - `docs/AI.md`'s row for a method in an `interface`, and the generated
    `docs/reference/` pages that quote NL2048, move with it.
  - `.claude/typescript.md:90`–`92` ("An `interface` is a struct with fields
    only") is rewritten to admit a method signature (§6).
- Stage 2 and stage 4 flip no existing test: no test under `tests/` names
  `Dyn`, `nish:dyn` or a code from NL2771 on, and stage 2's NL2774 clause only
  adds words to a code stage 1 introduces. Stage 3 flips stage 2's own NL2779
  negatives (below).
- Invariants: I1 (nish-cmp, 0 `DECLARED`).
- Docs: LANGUAGE.md "Interfaces" and "Constraints", and its NL2048 quotes
  (`:6230`, `:16102`); IR_COOKBOOK "A constrained type parameter"
  (`docs/IR_COOKBOOK.md:620`); guide `classes-and-interfaces.md` (`:4`, `:78`,
  `:100`) and `getting-started/from-typescript.md` (`:330`); `docs/AI.md`
  (`:1784`); `docs/reference/` regenerated
  (`node scripts/gen-reference.mjs`) for the LANGUAGE.md and NL2048 changes.
  `--emit-ts` needs nothing new: an interface method signature is already
  TypeScript, and the stage's round trips run under Node through it.

**Stage 2: `Dyn<I>` in locals, parameters, returns and calls. Gated on the
stage 2 gate (§8).**

- Rule: `nish:dyn`, the conversion, the call, `===`; per-place sets, one
  dispatcher per (module, set, method); the escape-join refusal; the debug tag
  check; NL2771, NL2772, NL2773, NL2775, NL2776, NL2779, NL9020; NL2774 gains
  the `Dyn<I>` clause.
- Code: `RefPass` (`src/fnref-places.ts`) takes a class member; the
  dispatcher generator writes `$dyn.*`; `emitMethodCall` passes the tag and
  pointer; `src/debug.ts` describes the structure; `runtime/nish.d.ts`
  declares `Dyn`; `--emit-ts` writes `Dyn<I>` as `I` and drops the import
  (§5.1).
- Tests: `dyn_call` (golden `.ll` holding a `$dyn.` dispatcher with a member
  `default` arm), `dyn_set_of_one` (golden `.ll` equal, names aside, to
  `dyn_set_of_one_direct`'s: a set of one is a direct call, §2.4; in both
  `Circle` declares `implements Shape`, so `fieldTbaa` tags neither),
  `dyn_eq`, `dyn_return`; the round trips with expected stdout, each also run
  under Node through `--emit-ts`; `.memory` goldens `dyn_escape_a` (stack) and
  `dyn_escape_c` (stack, the keeper outside the set); negatives
  `reject_dyn_escape_join` (case B, NL2771), `reject_dyn_ffi` and
  `reject_dyn_host_export` (NL2772), `reject_dyn_not_implemented` (NL2773),
  `reject_dyn_layout_iface` (NL2775), `reject_dyn_from_plain` and
  `reject_dyn_widen` (NL2776), and `reject_dyn_stored_field`,
  `reject_dyn_stored_array`, `reject_dyn_stored_map` (NL2779); the wide-set
  warning pinned as `tests/wordings/nl9020_dyn_wide_set.ts` and `.err`, as
  NL9017's `nl9017_fnref_wide_set` is: a header comment naming the code, and
  the exact words with a location (``this call of `area` through `Dyn<Shape>`
  can reach 9 classes, more than eight, ...``), since
  `tests/diagnostic-coverage.js` reads `tests/wordings/` and not
  `tests/cases/warn_*`; a `--profile debug` run that panics on
  a forged tag (built from hand IR, as WP51's tag-check test is); a `-g` check
  that gdb prints the class name.
- Invariants: I1 (nish-cmp, 0 `DECLARED`); I2 (§3.6's programs rebuilt on
  `Dyn<Base>`, under the stage 2 gate, band stated in the PR, or the stage
  does not land); I3; I4 (the §4 programs rerun, valgrind over them); I6
  (`tests/run.js performance`, the self-host build time and `build/nish`'s
  size); I7.
- Docs: LANGUAGE.md "Dynamic dispatch: `Dyn<I>`" with the cost model and the
  stored-place refusal; the types table row; IR_COOKBOOK "Dynamic dispatch";
  guide page `docs/guide/language/dynamic-dispatch.md` and its route in
  `scalar.config.json`; `Dyn`'s declaration in `runtime/nish.d.ts` lands with
  its doc comment (a type alias, so no `@param` or `@returns`), and `docs/reference/` is regenerated so
  `node scripts/gen-reference.mjs --check` passes with `scripts/undocumented.txt`
  unchanged.

**Stage 3: fields, arrays, `Map` values, `| null`, `Result`, threads. Gated
on the stage 3 gate (§8), after stage 2.**

- Rule: NL2779 is lifted. A stored `Dyn<I>` is one tagged word (§2.3): a
  field, `Dyn<I>[]`, a `Map` value, `Dyn<I> | null` (the 0 word), a `Result`
  arm, across `spawn` and `parallelMap`; a stored place of `Dyn<I>` in a
  program that converts more than 255 classes to `Dyn<I>` (7 on wasm32) is
  NL2777, however few of them reach the place (§2.3). Root storage refuses a
  `Dyn<I>` its closure reaches (NL2766, §2.3 "Root storage"), so the root
  tracer and `holdsPointer` (`src/emit-root.ts:67`–`72`) are unchanged.
- Tests: `dyn_field`, `dyn_field_two`, `dyn_field_set_of_one` (a stored set of
  one is still a word: its tag is 1, and the call is direct), `dyn_array`,
  `dyn_map_value`, `dyn_nullable`, `dyn_result`, `dyn_spawn`;
  the `tests/run.js` probe "WP60: Dyn layout" (I5's check, §1): a class with
  one and two `Dyn` fields and their hand twins, built with `--target` for
  x86_64, aarch64 and wasm32, sizes read with `opt -O2 -mtriple` and equal,
  NL9010's words the same; negatives `reject_dyn_wide_stored` (NL2777: 256
  classes converted to `Dyn<I>` in locals, and one field whose own set holds
  two of them) and `reject_dyn_wide_stored_wasm32` (the same with 8 classes,
  built for wasm32),
  `reject_dyn_map_key` and `reject_dyn_set_element` (NL2353, whose words gain
  `` a `Dyn` `` beside "an interface"), `reject_dyn_json` (NL2486: a `Dyn` is
  not a class to typed JSON), `reject_dyn_spawn_unsendable` (the member's own
  refusal, §2.6: the test's member is an object of the spawner's region,
  NL2673), and `reject_dyn_root_storage` (NL2766: a root class with a
  `Dyn<Shape>` field, and one reaching it through a nested class's field;
  §2.3, "Root storage").
- Tests that flip: stage 2's `reject_dyn_stored_field`,
  `reject_dyn_stored_array` and `reject_dyn_stored_map` are admitted, and are
  deleted (`dyn_field`, `dyn_array` and `dyn_map_value` cover the same
  places). NL2779 then has no path that provokes it, so it is retired in
  `tests/wordings/unreachable.txt` (``NL2779  retired: a stored `Dyn<I>`,
  admitted by stage 3``), which `--require-coverage` reads; its
  `src/codes.ts` entry stays, as every retired rule's does (`src/codes.ts:13`).
- Invariants: I1; I2 for stored places: §3.4's rows rerun against the
  compiler's word, and the stage 3 gate (§8: the array geomean inside the
  band, no array row above 1.25x), or the stage does not land; I4 (RSS at 1x/10x/100x for a 1M-element array, valgrind
  and an `NISH_ASAN` run); I5 (the layout probe above).
- Docs: LANGUAGE.md arrays and `Map`; the cookbook's layout entry; the guide
  page's container section, and the NL2779 section removed; `docs/reference/`
  regenerated. `--emit-ts` needs nothing new: a stored `Dyn<I>` is an `I` in
  TypeScript, as a local is.

**Stage 4: the agents' idiom and the NL2079 decision.**

- NL2079: whether a class may implement an imported interface, which a
  library's open set needs. If it is lifted, NL2079's words change from
  `` `X` is not a declared interface `` to name the module the interface
  must be declared in; if not, the guide page says why.
- `std/` is not touched: adopting `Dyn` there moves programs' IR and would
  need `DECLARED` entries, outside I1 as the brief states it (§11).
- Docs: AI.md's `Dyn` idiom and when to use `<T extends I>`; the guide page's
  library section; `docs/reference/` regenerated if NL2079's words move.

## 10. Risks

- **The tagged word hides a pointer from leak checkers.** A stored `Dyn<I>`
  holds its tag in bits 48 to 55 (§2.3); LeakSanitizer and valgrind's leak
  check scan for whole pointers and may report an object reachable only
  through such a word as leaked. §4.4's valgrind runs over the stored
  variants reported 0 errors and 0 leaks, but those programs free what they
  allocate; stage 3 runs `NISH_ASAN` over a program that keeps its objects
  live only through `Dyn<I>[]` and records what LSan says.
- **A reader of memory that does not know the word.** Any code that walks a
  stored object by its type, the root tracer first (§2.3, "Root storage"),
  sees a `Dyn<I>` field as a scalar unless taught otherwise, and drops the
  object it tags. Stage 3 refuses a `Dyn` in root storage (NL2766) and in every
  other walker named in §2.3, pins it with `reject_dyn_root_storage`, and
  `src/emit-root.ts`'s `traceFail` stays the backstop for a type with no
  descriptor.
- **The stored form costs time the hand program does not.** The tagged word
  matches the hand program's memory to the byte (1M-element array: 25948 KB
  peak RSS for hand, tagged word and union alike; the 16-byte form 16 MiB
  more, §2.3) but runs 1.18x on arrays (§3.4). That is why stage 3 is gated
  and NL2779 says what to write meanwhile.
- **Per-place sets widen through a shared place.** One array that every
  plugin passes through makes every call's set the whole program's. NL9020
  names the stores that widened it, as NL9017 does.
- **The escape-join refusal fires on a receiver that is already on the heap.**
  An object stored in an array has escaped whatever a method does with it;
  the refusal still fires when one member keeps `this` (§11).
- **A wrong set is a wrong call.** The solver must see every store; a missed
  one makes a speed build call the `default` member. The debug-profile check
  and the WP51 solver's existing tests are the guard; stage 2 adds a test per
  kind of place.
- **Separate compilation.** The sets need the whole program. Nish compiles
  whole programs, and a library module's `Dyn` values are solved in the
  program that links it; a host-visible signature cannot carry one (§2.6).

## 11. Open

- **Why the tagged word costs 1.18x on arrays.** §3.4 measured it and
  §12.9 shows its K=8 loop (`objdump` only; no `.ll` is quoted for the array
  rows): the same jump table as the hand program's, with
  `and`, `shr` and `dec` where the hand program loads `kind` from the
  object. No counter says where the 18% goes. Stage 3's run against the gate
  (§8) answers it or the stage does not land.
- **The vtable or jump-table threshold.** The vtable won aperiodic K ≥ 8 by
  5% to 10% (§3.3); on this machine LLVM lowered the dispatcher's `switch` to
  a chain of compares at K=4 and to a jump table at K=8 and K=13 (§12.9). Whether the dispatcher should pick an
  indirect call above some K, with the escape proof kept by the closed set, is
  a question for after stage 2 measures its own dispatchers.
- **`std/` adoption.** A `std/` module that dispatches by hand over classes
  could take `Dyn`, but each adoption moves the IR of every program that uses
  the module and needs `DECLARED` entries in `tests/nish-cmp.js`; the brief's
  I1 asks for none, so it is later work with its own measurement.
- **A set of two, drawn at random.** §3.6's aperiodic K=2 hand loop selects
  with two `cmove`s; the surface loop branches. Whether the dispatcher for a
  set of two should be a `select` the backend can make branchless, and
  whether the compiler's own dispatcher already is one, is stage 2's first
  question.
- **Thin `Dyn` over tagged classes.** When every class in a set already
  begins with a discriminated union's tag field, the tag is in the object and
  the reference could be the union's thin pointer: the hand program's own
  form, which §3.4 measured at 1.00x. It is the next stored form to try if
  stage 3's gate fails.
- **Firing the escape-join refusal only where it changes a placement.** The
  refusal could read the escape facts at the call and fire only when the
  argument could otherwise be on the stack. WP51 did not; this note keeps its
  rule and records the question.
- **Default methods.** An interface method with a body would be a function
  every member without its own shares. Not proposed: it is a step toward
  inheritance.
- **Interface `extends`.** A `Dyn<A>` where `B extends A` is a subtype
  question WP25 left out; not proposed.

## 12. Appendix: the programs

Every program was generated, compiled and run in the session that wrote this
note, under the scratch directory; none is committed. Each generator writes
`<name>.ts` files into the directory it is given. A program `X` was built as:

```sh
export NISH=<checkout>                      # the repository: build/nish, scripts/build.sh
$NISH/build/nish X.ts -o ll_X.ll            # build/nish 0.39.0, from e0a1661e
bash buildone.sh X                          # §12.7: llvm-as, then scripts/build.sh --profile speed
python3 bench.py groups.json 7              # §12.7: best of 7, interleaved
python3 ctime.py 7                          # §12.10, in r/: compile and build times
```

Working directories, under the scratch directory: `d/` holds `gen.mjs`,
`mkvt.mjs`, `mkaos.mjs`, `mktp.mjs`, `buildone.sh` and `bench.py`, and every
§3.3 and §3.4 program is generated, rewritten, built and timed there (`node
gen.mjs src`, then `node mkaos.mjs ...` and `node mktp.mjs ...` from `d/`);
`l2/` holds the million-object programs, `mktp1m.py` and `rss.py`, run from
`l2/` (`python3 mktp1m.py`, then `python3 rss.py empty hand tp union aos ...`);
`e/` the escape programs, `r/` the registry and `ctime.py`, `s2/` §3.6's
programs, `v/` the valgrind run. `e/`, `r/` and `s2/` each hold a copy of
`bench.py` and are timed from their own directory; `buildone.sh` builds into
the directory it sits in (`cd "$(dirname "$0")"`), so it is copied into the
directory being built.

Each `groups*.json` maps a group name to the binaries `bench.py` interleaves
within it; every group but the registry's and `s2/`'s opens with `empty` or the group's
`direct` and closes with `direct_copy`, a `cp` of `direct`, which is where the
band comes from:

| File | Groups | Section |
| --- | --- | --- |
| `d/groups.json` | `serial_periodic`, `serial_aperiodic`, `array_periodic`: `switch`, `union`, `table`, `proposed` and `vtable` at K = 1, 2, 4, 8, 13, 16; `serial_same`, `array_same`: `switch` at K = 1 to 16 and the other four at K = 2 to 16. `vtable` exists only where `proposed` does (28 programs, §12.2) | §3.3 |
| `d/groups_tp.json` | `array_same`, `array_periodic`: `switch`, `proposed`, `aos`, `tp` at K = 2 to 16 (`timing_tp`, 7 rounds) | §3.4 |
| `d/groups_tp3.json` | `serial_same`, `serial_periodic` with `tp`; `array_periodic` K = 4, 8, 13 (`timing_tp3`, 9 rounds) | §3.4 |
| `e/groups.json` | `s`, `m`, `l`: cases A, B and C at one loop length each (`timing2`, 7 rounds) | §4 |
| `r/groups2.json` | `reg`: `empty`, `reg_hand`, `reg_table`, `reg_proposed`, `reg_hand_copy` (`timing3`, 7 rounds) | §3.5 |
| `s2/groups.json` | `strategy`, `periodic`, `aperiodic`: `hand` and `surface` at K = 2, 4, 8, 13, 16; `reg2`: `empty`, `reg2_hand`, `reg2_surface`, `reg2_hand_copy` (`timing.txt`, 7 rounds) | §3.6 |

`d/groups_aos.json` and `d/groups_tp2.json` were earlier, smaller runs of the
same binaries, superseded by the two above and not cited. `--explain-memory`
was run as `build/nish --explain-memory X.ts`, and valgrind by `v/run.sh`
(§12.10).

### 12.1 The dispatch programs (`gen.mjs`)

```js
// Generates the WP60 dispatch spike programs. Usage: node gen.mjs <outdir>
import { writeFileSync, mkdirSync } from "node:fs"
const out = process.argv[2]
mkdirSync(out, { recursive: true })
const BODIES = [
  "x * 3 + A", "(x ^ A) + 7", "(x << 1) - A", "(x * 5) ^ (A >>> 1)",
  "(x + A) * 9", "(x >>> 3) + A * 11", "(x ^ (A << 2)) ^ 85", "(x | A) + 13",
  "(x & 65535) * 17 + A", "(x - 19) ^ A", "x * 23 - (A & 7)", "((x >>> 5) ^ x) + A",
  "(x << 3) + (x >>> 29) + A", "((x * 29) ^ (x >>> 7)) ^ A", "(x + 31) ^ (A << 1)", "((x ^ 40503) * 37) + A",
]
const SERIAL = Number(process.env.SERIAL ?? 200000000), ROUNDS = Number(process.env.ROUNDS ?? 200000)
const KS = [1, 2, 4, 8, 13, 16]
const GROUPS = [["serial", "same"], ["serial", "periodic"], ["serial", "aperiodic"], ["array", "same"], ["array", "periodic"]]
const VARIANTS = ["switch", "union", "table", "proposed"]

function prelude(k, variant) {
  let s = ""
  if (variant === "union") {
    s += `enum Kind { ${Array.from({ length: k }, (_, i) => `K${i}`).join(", ")} }\n`
    for (let i = 0; i < k; i++) {
      s += `class C${i} {\n  readonly kind: Kind.K${i} = Kind.K${i}\n  a: u32\n  constructor(a: u32) { this.a = a }\n  f(x: u32): u32 { return ${BODIES[i].replaceAll("A", "this.a")} }\n}\n`
    }
    s += k === 1 ? "type U = C0\n" : `type U = ${Array.from({ length: k }, (_, i) => `C${i}`).join(" | ")}\n`
    s += "function make(t: i32, a: u32): U {\n  switch (t) {\n"
    for (let i = 0; i < k - 1; i++) s += `    case ${i}: return new C${i}(a)\n`
    s += `    default: return new C${k - 1}(a)\n  }\n}\n`
    s += "function call(s: U, x: u32): u32 {\n"
    if (k === 1) s += "  return s.f(x)\n}\n"
    else {
      s += "  switch (s.kind) {\n"
      for (let i = 0; i < k; i++) s += `    case Kind.K${i}: return s.f(x)\n`
      s += "  }\n}\n"
    }
    return s
  }
  s += "interface Base { kind: i32; a: u32 }\n"
  s += "class Obj implements Base {\n  kind: i32\n  a: u32\n  constructor(k: i32, a: u32) { this.kind = k; this.a = a }\n}\n"
  for (let i = 0; i < k; i++) s += `function g${i}(o: Base, x: u32): u32 { return ${BODIES[i].replaceAll("A", "o.a")} }\n`
  if (variant === "table") s += "type Op = (o: Base, x: u32) => u32\n"
  const arms = (subj) => {
    if (k === 1) return "  return g0(o, x)\n"
    let a = `  switch (${subj}) {\n`
    for (let i = 0; i < k - 1; i++) a += `    case ${i}: return g${i}(o, x)\n`
    return a + `    default: return g${k - 1}(o, x)\n  }\n`
  }
  if (variant === "switch") s += `function call(o: Base, x: u32): u32 {\n${arms("o.kind")}}\n`
  if (variant === "proposed") s += `function d(t: i32, o: Base, x: u32): u32 {\n${arms("t")}}\n`
  return s
}

function program(shape, stream, k, variant) {
  const direct = variant === "direct"
  const v = direct ? "switch" : variant
  let s = prelude(direct ? 1 : k, v === "switch" && direct ? "direct" : v)
  const T = v === "union" ? "U" : "Base"
  s += "export const main = (): void => {\n"
  if (v === "table") s += `  const tbl: Op[] = [${Array.from({ length: k }, (_, i) => `g${i}`).join(", ")}]\n`
  s += `  const pool: ${T}[] = []\n  const tags: i32[] = []\n  const byKind: ${T}[] = []\n  let s: u32 = 2463534242\n`
  const mk = (t, a) => (v === "union" ? `make(${t}, ${a})` : `new Obj(${t}, ${a})`)
  s += `  for (let j = 0; j < ${k}; j++) { byKind.push(${mk("j", "toU32(j * 7 + 1)")}) }\n`
  s += "  for (let j = 0; j < 1024; j++) {\n"
  s += "    s = s ^ (s << 13)\n    s = s ^ (s >>> 17)\n    s = s ^ (s << 5)\n"
  s += stream === "periodic" ? `    const t = toI32((s >>> 8) % ${k})\n` : "    const t = 0\n"
  s += `    tags.push(t)\n    pool.push(${mk("t", "toU32(j * 7 + 1)")})\n  }\n`
  let callOf
  if (direct) callOf = (o) => `g0(${o}, ACC)`
  else if (v === "switch" || v === "union") callOf = (o) => `call(${o}, ACC)`
  else if (v === "table") callOf = (o) => `tbl[${o}.kind](${o}, ACC)`
  else callOf = (o, t) => `d(${t}, ${o}, ACC)`
  if (shape === "serial") {
    s += "  let acc: u32 = 1\n"
    s += `  for (let i = 0; i < ${SERIAL}; i++) {\n`
    if (stream === "aperiodic") {
      s += "    s = s ^ (s << 13)\n    s = s ^ (s >>> 17)\n    s = s ^ (s << 5)\n"
      s += `    const t = toI32((s >>> 8) % ${k})\n`
      s += `    if (t >= 0 && t < byKind.length) { acc = ${callOf("byKind[t]", "t").replace("ACC", "acc")} }\n`
    } else {
      s += "    const j = i & 1023\n"
      s += `    if (j < pool.length && j < tags.length) { acc = ${callOf("pool[j]", "tags[j]").replace("ACC", "acc")} }\n`
    }
    s += "  }\n  console.log(`${acc}`)\n}\n"
  } else {
    s += "  let sum: u32 = 0\n"
    s += `  for (let r = 0; r < ${ROUNDS}; r++) {\n    for (let j = 0; j < pool.length; j++) {\n`
    s += `      if (j < tags.length) { sum = sum + ${callOf("pool[j]", "tags[j]").replace("ACC", "toU32(j + r)")} }\n`
    s += "    }\n  }\n  console.log(`${sum}`)\n}\n"
  }
  return s
}

const list = []
for (const [shape, stream] of GROUPS) {
  const g = `${shape}_${stream}`
  const name = `${g}_direct`
  writeFileSync(`${out}/${name}.ts`, program(shape, stream, 1, "direct")); list.push(name)
  for (const k of KS) for (const v of VARIANTS) {
    if (stream === "same" && k === 1 && v !== "switch") continue
    const n = `${g}_k${k}_${v}`
    writeFileSync(`${out}/${n}.ts`, program(shape, stream, k, v)); list.push(n)
  }
}
writeFileSync(`${out}/list.txt`, list.join("\n") + "\n")
console.log(list.length)
```

### 12.2 The vtable variant (`mkvt.mjs`, `wp60_vt.c`)

`node mkvt.mjs ll_X_proposed.ll ll_X_vtable.ll K` rewrites the compiled `@d`
of a `proposed` program; the result is hand-edited IR, not the compiler's. The
compiler gave `@d` attribute group `#1`, `{ nounwind willreturn readonly }`;
an indirect call to an unknown function is neither `readonly` nor known to
return, so the rewritten `@d` takes `#2`, `{ nounwind }`, the group the same
module already gives a function that writes memory. Keeping `#1` would let
LLVM delete or hoist the call.

```js
// Rewrites @d of a "proposed" .ll into an indirect call through a 16-entry table.
// Usage: node mkvt.mjs <in.ll> <out.ll> <K>
import { readFileSync, writeFileSync } from "node:fs"
const [, , inp, outp, ks] = process.argv
const k = Number(ks)
const ll = readFileSync(inp, "utf8")
const fp = "i32 (%struct.Base*, i32)*"
const start = ll.indexOf("define internal noundef i32 @d(")
const end = ll.indexOf("\n}\n", start) + 3
const head = ll.slice(start, ll.indexOf("{", start)).replace(/#1\s*$/, "#2 ")
const body = `${head}{
entry:
  %i = sext i32 %t to i64
  %slot = getelementptr inbounds [16 x ${fp}], [16 x ${fp}]* @wp60_vt, i64 0, i64 %i
  %fp = load ${fp}, ${fp}* %slot, align 8
  %r = call i32 %fp(%struct.Base* %o, i32 %x)
  ret i32 %r
}
`
const entries = Array.from({ length: 16 }, (_, i) => (i < k ? `${fp} @g${i}` : `${fp} null`)).join(", ")
const table = `@wp60_vt = global [16 x ${fp}] [${entries}], align 8\n`
let res = ll.slice(0, start) + body + ll.slice(end)
const firstDefine = res.indexOf("\ndefine ")
res = res.slice(0, firstDefine + 1) + table + res.slice(firstDefine + 1)
writeFileSync(outp, res)
```

```c
/* Declares the dispatch table the hand-edited .ll defines. The constructor's
   store, taken only when WP60_SHUFFLE is set (never in a timed run), is why
   link-time optimisation cannot treat the table as constant. */
#include <stdlib.h>
extern void *wp60_vt[16];
__attribute__((constructor)) static void wp60_touch(void) {
  if (getenv("WP60_SHUFFLE") != NULL) {
    void *t = wp60_vt[0];
    wp60_vt[0] = wp60_vt[1];
    wp60_vt[1] = t;
  }
}
```

### 12.3 The 16-byte slot (`mkaos.mjs`)

`node mkaos.mjs array_same_k2 ...` rewrites `src/<name>_proposed.ts` into
`src/<name>_aos.ts`. Its comment calls this "the proposed `Dyn<I>[]` layout": it was round 0's
proposal, which §2.3 replaces with the tagged word (§12.8).

```js
// mkaos.mjs: array_*_k*_proposed.ts -> array_*_k*_aos.ts, the tag and the
// pointer in one 16-byte inline record per slot (the proposed Dyn<I>[] layout).
import { readFileSync, writeFileSync } from "node:fs"
for (const name of process.argv.slice(2)) {
  let s = readFileSync(`src/${name}_proposed.ts`, "utf8")
  const rep = (a, b) => { if (!s.includes(a)) throw new Error(`${name}: ${a}`); s = s.replace(a, b) }
  rep("export const main", "interface Slot { t: i32; o: Base }\nexport const main")
  rep("const tags: i32[] = []", "const slots: Slot[] = []")
  rep("    tags.push(t)\n    pool.push(new Obj(t, toU32(j * 7 + 1)))",
      "    const ob = new Obj(t, toU32(j * 7 + 1))\n    pool.push(ob)\n    slots.push({ t: t, o: ob })")
  rep("if (j < tags.length) { sum = sum + d(tags[j], pool[j], toU32(j + r)) }",
      "if (j < slots.length) { const sl = slots[j]; sum = sum + d(sl.t, sl.o, toU32(j + r)) }")
  writeFileSync(`src/${name}_aos.ts`, s)
}
```

### 12.4 The layout (`layout.c`)

`clang layout.c -o layout && ./layout` printed:

```text
Fat 16 (tag at 0, ptr at 8)
OneField 24  OneSplit 16  HandOne 16
TwoAgg 32  TwoSplit 24  HandTwo 16
array element: Fat 16, I 8, (i32 tag + I) side by side 12
```

```c
/* WP60 layout spike: the sizes the x86_64 data layout gives the candidate
   representations (clang uses the same layout LLVM does for these types). */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
typedef struct { int32_t tag; void *p; } Fat;               /* the fat ref as one aggregate */
typedef struct { int32_t kind; int32_t a; } Obj;            /* a hand object: kind first */
typedef struct { int32_t n; Fat h; } OneField;              /* class { n: i32; h: Dyn<I> } */
typedef struct { Fat h; Fat g; } TwoAgg;                    /* class { h: Dyn<I>; g: Dyn<I> }, aggregate */
typedef struct { int32_t ht; int32_t gt; void *hp; void *gp; } TwoSplit; /* the same, halves split */
typedef struct { int32_t n; void *h; } HandOne;             /* class { n: i32; h: I } (kind lives in *h) */
typedef struct { void *h; void *g; } HandTwo;               /* class { h: I; g: I } */
typedef struct { int32_t n; int32_t ht; void *hp; } OneSplit; /* class { n: i32; h: Dyn<I> }, halves split */
int main(void) {
  printf("Fat %zu (tag at %zu, ptr at %zu)\n", sizeof(Fat), offsetof(Fat, tag), offsetof(Fat, p));
  printf("OneField %zu  OneSplit %zu  HandOne %zu\n", sizeof(OneField), sizeof(OneSplit), sizeof(HandOne));
  printf("TwoAgg %zu  TwoSplit %zu  HandTwo %zu\n", sizeof(TwoAgg), sizeof(TwoSplit), sizeof(HandTwo));
  printf("array element: Fat %zu, I %zu, (i32 tag + I) side by side %zu\n", sizeof(Fat), sizeof(void *), sizeof(int32_t) + sizeof(void *));
  return 0;
}
```

### 12.5 The escape programs (`e/gen.mjs`)

```js
// WP60 escape spike: cases A, B, C at three loop lengths. Usage: node gen.mjs <outdir>
import { writeFileSync, mkdirSync } from "node:fs"
const out = process.argv[2]
mkdirSync(out, { recursive: true })
const N = { s: 1000000, m: 10000000, l: 100000000 }
function program(kase, n) {
  const keeps = kase !== "A"
  const k = kase === "C" ? 3 : 4
  let s = "interface Base { kind: i32; v: u32 }\n"
  s += "class Obj implements Base {\n  kind: i32\n  v: u32\n  constructor(k: i32, v: u32) { this.kind = k; this.v = v }\n}\n"
  s += "class Keep {\n  last: Base\n  n: u32\n  constructor(b: Base) { this.last = b; this.n = 0 }\n}\n"
  s += "function m0(o: Base, k: Keep, x: u32): u32 { return x * 3 + o.v }\n"
  s += "function m1(o: Base, k: Keep, x: u32): u32 { return (x ^ o.v) + 7 }\n"
  s += "function m2(o: Base, k: Keep, x: u32): u32 { return (x << 1) - o.v }\n"
  s += keeps
    ? "function m3(o: Base, k: Keep, x: u32): u32 {\n  k.last = o\n  return (x * 5) ^ (o.v >>> 1)\n}\n"
    : "function m3(o: Base, k: Keep, x: u32): u32 { return (x * 5) ^ (o.v >>> 1) }\n"
  s += "function d(t: i32, o: Base, k: Keep, x: u32): u32 {\n  switch (t) {\n"
  for (let i = 0; i < k - 1; i++) s += `    case ${i}: return m${i}(o, k, x)\n`
  s += `    default: return m${k - 1}(o, k, x)\n  }\n}\n`
  s += "export const main = (): void => {\n  const k = new Keep(new Obj(0, 0))\n  let acc: u32 = 1\n"
  s += `  for (let i = 0; i < ${n}; i++) {\n    const t = i % ${k}\n    const o = new Obj(t, toU32(i))\n    acc = d(t, o, k, acc)\n  }\n`
  if (kase === "C") s += "  acc = m3(new Obj(3, 9), k, acc)\n"
  s += "  console.log(`${acc} ${k.last.v}`)\n}\n"
  return s
}
const list = []
for (const c of ["A", "B", "C"]) for (const [tag, n] of Object.entries(N)) {
  const name = `esc_${c}_${tag}`
  writeFileSync(`${out}/${name}.ts`, program(c, n)); list.push(name)
}
writeFileSync(`${out}/list.txt`, list.join("\n") + "\n")
```

### 12.6 The registry (`r/gen.mjs`)

```js
// WP60 registry spike: 13 implementations x H hooks, written three ways.
// Usage: node gen.mjs <outdir>
import { writeFileSync, mkdirSync } from "node:fs"
const out = process.argv[2]
mkdirSync(out, { recursive: true })
const OPS = ["x * 3 + A", "(x ^ A) + 7", "(x << 1) - A", "(x * 5) ^ (A >>> 1)", "(x + A) * 9", "(x >>> 3) + A * 11",
  "(x ^ (A << 2)) ^ 85", "(x | A) + 13", "(x & 65535) * 17 + A", "(x - 19) ^ A", "x * 23 - (A & 7)", "((x >>> 5) ^ x) + A",
  "(x << 3) + (x >>> 29) + A", "((x * 29) ^ (x >>> 7)) ^ A", "(x + 31) ^ (A << 1)", "((x ^ 40503) * 37) + A"]
const K = 13, H = 4, CALLS = Number(process.env.CALLS ?? 50000000)
const body = (k, h) => `(${OPS[(k + h * 5) % 16].replaceAll("A", "p.a")}) + ${h * 13 + k}`
function program(form) {
  let s = "interface Plugin { kind: i32; a: u32 }\n"
  s += "class Impl implements Plugin {\n  kind: i32\n  a: u32\n  constructor(k: i32, a: u32) { this.kind = k; this.a = a }\n}\n"
  for (let h = 0; h < H; h++) for (let k = 0; k < K; k++) s += `function p${k}_h${h}(p: Plugin, x: u32): u32 { return ${body(k, h)} }\n`
  if (form === "table") s += "type Hook = (p: Plugin, x: u32) => u32\n"
  for (let h = 0; h < H; h++) {
    if (form === "table") continue
    const subj = form === "hand" ? "p.kind" : "t"
    s += form === "hand" ? `function hook${h}(p: Plugin, x: u32): u32 {\n` : `function hook${h}(t: i32, p: Plugin, x: u32): u32 {\n`
    s += `  switch (${subj}) {\n`
    for (let k = 0; k < K - 1; k++) s += `    case ${k}: return p${k}_h${h}(p, x)\n`
    s += `    default: return p${K - 1}_h${h}(p, x)\n  }\n}\n`
  }
  s += "export const main = (): void => {\n"
  if (form === "table") for (let h = 0; h < H; h++) s += `  const hook${h}: Hook[] = [${Array.from({ length: K }, (_, k) => `p${k}_h${h}`).join(", ")}]\n`
  s += "  const pool: Plugin[] = []\n  const tags: i32[] = []\n  let s: u32 = 2463534242\n"
  s += "  for (let j = 0; j < 1024; j++) {\n    s = s ^ (s << 13)\n    s = s ^ (s >>> 17)\n    s = s ^ (s << 5)\n"
  s += `    const t = toI32((s >>> 8) % ${K})\n    tags.push(t)\n    pool.push(new Impl(t, toU32(j * 7 + 1)))\n  }\n`
  s += `  let acc: u32 = 1\n  for (let i = 0; i < ${CALLS / H}; i++) {\n    const j = i & 1023\n`
  s += "    if (j < pool.length && j < tags.length) {\n      const p = pool[j]\n"
  for (let h = 0; h < H; h++) {
    const c = form === "hand" ? `hook${h}(p, acc)` : form === "table" ? `hook${h}[p.kind](p, acc)` : `hook${h}(tags[j], p, acc)`
    s += `      acc = ${c}\n`
  }
  s += "    }\n  }\n  console.log(`${acc}`)\n}\n"
  return s
}
for (const f of ["hand", "table", "proposed"]) writeFileSync(`${out}/reg_${f}.ts`, program(f))
```

### 12.7 The runner (`buildone.sh`, `bench.py`)

```sh
#!/bin/bash
# NISH: the repository checkout (scripts/build.sh, runtime/runtime.c)
# buildone.sh <name>: ll_<name>.ll -> bin/<name> at --profile speed
set -e
cd "$(dirname "$0")"; mkdir -p bin
n=$1
llvm-as ll_$n.ll -o /dev/null
extra=""
case $n in *_vtable) extra=wp60_vt.c;; esac
(cd "${NISH:?set NISH to the nish checkout}" && scripts/build.sh "$OLDPWD/ll_$n.ll" runtime/runtime.c ${extra:+"$OLDPWD/$extra"} -o "$OLDPWD/bin/$n" --profile speed) > blog_$n.txt 2>&1
```

```python
# bench.py <groups.json> <rounds>: best-of-N wall time, interleaved and rotated.
# groups.json maps a group name to the list of binaries under bin/ it times.
# Every binary must print the same output in every round. Within a group, the
# binaries that compute the same thing must print the same checksum, keyed:
#   a name with _kN_     -> every name of that group and K
#   a name with "direct" -> direct and direct_copy
#   empty                -> nothing to compare (prints 0)
#   esc_A_*, esc_B_*     -> the first field (acc) of A and B; the second field,
#                           k.last.v, differs by design (B keeps, A does not)
#   esc_C_*              -> none: C is another program (three members in the
#                           loop and one keeper call after it), so its acc differs
#   any other name       -> every other such name of the group (reg_*)
# Exits 1 on any mismatch and prints how many comparisons it made.
import json, os, re, subprocess, sys, time
groups = json.load(open(sys.argv[1]))
rounds = int(sys.argv[2])
best, rss, outs = {}, {}, {}
for r in range(rounds):
    for g, names in groups.items():
        order = names[r % len(names):] + names[:r % len(names)]
        for n in order:
            t0 = time.perf_counter()
            p = subprocess.Popen(["bin/" + n], stdout=subprocess.PIPE)
            out = p.stdout.read()
            _, status, ru = os.wait4(p.pid, 0)
            t = time.perf_counter() - t0
            assert status == 0, (n, status)
            best[n] = min(best.get(n, 1e9), t)
            rss[n] = max(rss.get(n, 0), ru.ru_maxrss)
            outs.setdefault(n, set()).add(out.decode().strip())
    print("round", r + 1, "done", flush=True)
def key(n):
    m = re.search(r"_k(\d+)_", n)
    if m: return "k" + m.group(1), lambda o: o
    if "direct" in n: return "direct", lambda o: o
    if n == "empty" or n.startswith("esc_C_"): return None, None
    if re.match(r"esc_[AB]_", n): return "AB", lambda o: o.split()[0]
    return "*", lambda o: o
bad, compared = 0, 0
for g, names in groups.items():
    for n in names:
        print(f"{g}\t{n}\t{best[n]*1000:.0f}\t{rss[n]//1024}\t{','.join(sorted(outs[n]))}")
        if len(outs[n]) != 1: print("MISMATCH run-to-run", n); bad = 1
    keyed = {}
    for n in names:
        k, f = key(n)
        if k is None: continue
        keyed.setdefault(k, []).append((n, {f(o) for o in outs[n]}))
    for k, members in keyed.items():
        vals = set().union(*(v for _, v in members))
        compared += len(members) - 1
        if len(vals) != 1: print("MISMATCH", g, k, [(n, sorted(v)) for n, v in members]); bad = 1
print("checksums", "FAIL" if bad else "ok", f"({compared} pairs compared)")
sys.exit(bad)
```

### 12.8 The stored forms (`mktp.mjs`, `l2/`)

`node mktp.mjs array_same_k2 serial_same_k2 ...` rewrites each
`ll_<name>_proposed.ll` into `ll_<name>_tp.ll`, for the array and the serial
programs alike (both fill a 1024-entry `pool` and a parallel `tags` array
through `push.store.1` and call `d(tags[j], pool[j], acc)` from the hot loop):
the pool's elements become tagged words, and the hot loop reads its tag from
the word it loads, not from the `tags` array. A serial program differs from an
array one only in its chain (`acc = d(...)`), so its `tp` rows in §3.4 are
the same stored word under a serial dependency. It runs on the compiler's IR,
so the rest of the program is the compiler's.

```js
// mktp.mjs <name>...: ll_<name>_proposed.ll -> ll_<name>_tp.ll, for any
// array_* or serial_* name: the tag in the pointer's top 16 bits (the
// tagged Dyn<I> word, 8 bytes). Tags are stored as t+1 so that 0 stays null;
// the hot loop reads the tag with lshr and strips it with llvm.ptrmask.
import { readFileSync, writeFileSync } from "node:fs"
for (const name of process.argv.slice(2)) {
  let s = readFileSync(`ll_${name}_proposed.ll`, "utf8")
  const lines = s.split("\n")
  const find = (re, from = 0) => { for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i; throw new Error(`${name}: ${re}`) }
  // 1. the pool push in the fill loop: the constructor call whose tag comes from %t.addr
  const tl = find(/= load i32, i32\* %t\.addr/, find(/^push\.store\.1:/))
  const tv = lines[tl].match(/^\s*(%\d+) =/)[1]
  const ci = find(/call void @Obj\.constructor\(%struct\.Obj\* (%\d+), i32 /, tl)
  const bc = find(/= bitcast %struct\.Obj\* %\d+ to %struct\.Base\*/, ci)
  const [, bv, ov] = lines[bc].match(/^\s*(%\d+) = bitcast %struct\.Obj\* (%\d+) to/)
  lines[bc] = [
    `  %tp.raw = bitcast %struct.Obj* ${ov} to i8*`,
    `  %tp.t1 = add i32 ${tv}, 1`,
    `  %tp.tz = zext i32 %tp.t1 to i64`,
    `  %tp.off = shl i64 %tp.tz, 48`,
    `  %tp.tagged = getelementptr i8, i8* %tp.raw, i64 %tp.off`,
    `  ${bv} = bitcast i8* %tp.tagged to %struct.Base*`,
  ].join("\n")
  // 2. the hot loop: the tag load from tags[j] and the pool[j] load
  const call = find(/= call i32 @d\(i32 (%\d+), %struct\.Base\* (%\d+), i32/)
  const [, tg, pv] = lines[call].match(/@d\(i32 (%\d+), %struct\.Base\* (%\d+),/)
  const tload = find(new RegExp(`^\\s*${tg} = load i32, i32\\* %\\d+`))
  lines[tload] = `  ${tg} = add i32 0, 0`
  const pload = find(new RegExp(`^\\s*${pv} = load %struct\\.Base\\*, %struct\\.Base\\*\\* %\\d+`))
  lines[pload] += "\n" + [
    `  %tp.i = ptrtoint %struct.Base* ${pv} to i64`,
    `  %tp.h = lshr i64 %tp.i, 48`,
    `  %tp.h32 = trunc i64 %tp.h to i32`,
    `  %tp.tag = sub i32 %tp.h32, 1`,
    `  %tp.r = bitcast %struct.Base* ${pv} to i8*`,
    `  %tp.m = call i8* @llvm.ptrmask.p0.i64(i8* %tp.r, i64 281474976710655)`,
    `  %tp.ptr = bitcast i8* %tp.m to %struct.Base*`,
  ].join("\n")
  lines[call] = lines[call].replace(`@d(i32 ${tg}, %struct.Base* ${pv},`, "@d(i32 %tp.tag, %struct.Base* %tp.ptr,")
  s = lines.join("\n").replace(/^(declare void @nish_array_grow.*)$/m, "$1\ndeclare i8* @llvm.ptrmask.p0.i64(i8*, i64)")
  s = s.replaceAll(`_${'proposed'}.ts`, "_tp.ts")
  writeFileSync(`ll_${name}_tp.ll`, s)
}
```

The million-object programs (§2.3). Each was compiled by `build/nish`, built
by `buildone.sh` and run by `rss.py`; `tp` is `hand`'s IR rewritten by
`mktp1m.py`.

`empty.ts`:

```ts
export const main = (): void => { console.log("0") }
```

`hand.ts`:

```ts
interface Base { kind: i32; a: u32 }
class Obj implements Base {
  kind: i32
  a: u32
  constructor(k: i32, a: u32) { this.kind = k; this.a = a }
}

export const main = (): void => {
  const pool: Base[] = []
  for (let j = 0; j < 1048576; j++) { pool.push(new Obj(j & 1, toU32(j * 7 + 5))) }
  let sum: u32 = 0
  for (let j = 0; j < pool.length; j++) { const o = pool[j]; sum = sum + o.a + toU32(o.kind) }
  console.log(`${sum}`)
}
```

`union.ts`:

```ts
enum Kind { A, B }
class CA { readonly kind: Kind.A = Kind.A; a: u32; constructor(a: u32) { this.a = a } }
class CB { readonly kind: Kind.B = Kind.B; a: u32; constructor(a: u32) { this.a = a } }
type U = CA | CB
function mk(t: i32, a: u32): U { if (t === 0) { return new CA(a) } return new CB(a) }
export const main = (): void => {
  const pool: U[] = []
  for (let j = 0; j < 1048576; j++) { pool.push(mk(j & 1, toU32(j * 7 + 5))) }
  let sum: u32 = 0
  for (let j = 0; j < pool.length; j++) { const o = pool[j]; if (o.kind === Kind.A) { sum = sum + o.a } else { sum = sum + o.a + 1 } }
  console.log(`${sum}`)
}
```

`aos.ts`:

```ts
interface Base { kind: i32; a: u32 }
class Obj implements Base {
  kind: i32
  a: u32
  constructor(k: i32, a: u32) { this.kind = k; this.a = a }
}

interface Slot { t: i32; o: Base }
export const main = (): void => {
  const slots: Slot[] = []
  for (let j = 0; j < 1048576; j++) { slots.push({ t: j & 1, o: new Obj(j & 1, toU32(j * 7 + 5)) }) }
  let sum: u32 = 0
  for (let j = 0; j < slots.length; j++) { const sl = slots[j]; sum = sum + sl.o.a + toU32(sl.t) }
  console.log(`${sum}`)
}
```

`map_hand.ts`:

```ts
interface Base { kind: i32; a: u32 }
class Obj implements Base {
  kind: i32
  a: u32
  constructor(k: i32, a: u32) { this.kind = k; this.a = a }
}

export const main = (): void => {
  const m = new Map<i32, Obj>()
  for (let j = 0; j < 1048576; j++) { m.set(j, new Obj(j & 1, toU32(j * 7 + 5))) }
  let sum: u32 = 0
  for (let j = 0; j < 1048576; j++) { const o = m.get(j); if (o !== undefined) { sum = sum + o.a + toU32(o.kind) } }
  console.log(`${sum}`)
}
```

`map_aos.ts`:

```ts
interface Base { kind: i32; a: u32 }
class Obj implements Base {
  kind: i32
  a: u32
  constructor(k: i32, a: u32) { this.kind = k; this.a = a }
}
class Slot { t: i32; o: Obj; constructor(t: i32, o: Obj) { this.t = t; this.o = o } }
export const main = (): void => {
  const m = new Map<i32, Slot>()
  for (let j = 0; j < 1048576; j++) { m.set(j, new Slot(j & 1, new Obj(j & 1, toU32(j * 7 + 5)))) }
  let sum: u32 = 0
  for (let j = 0; j < 1048576; j++) { const sl = m.get(j); if (sl !== undefined) { sum = sum + sl.o.a + toU32(sl.t) } }
  console.log(`${sum}`)
}
```

```python
# mktp1m.py: ll_hand.ll -> ll_tp.ll: the same 1M-element Base[], each element
# the object pointer with (kind + 1) << 48 in its top bits; the read loop strips
# the tag with llvm.ptrmask before it touches the object.
import re, sys
s = open("ll_hand.ll").read()
m = re.search(r"call void @Obj\.constructor\(%struct\.Obj\* (%\d+), i32 (%\d+), i32 %\d+\)\n  (%\d+) = bitcast %struct\.Obj\* \1 to %struct\.Base\*\n", s)
o, k, b = m.groups()
s = s.replace(m.group(0), m.group(0).split("\n")[0] + "\n" + f"""  %tp.raw = bitcast %struct.Obj* {o} to i8*
  %tp.t1 = add i32 {k}, 1
  %tp.tz = zext i32 %tp.t1 to i64
  %tp.off = shl i64 %tp.tz, 48
  %tp.tagged = getelementptr i8, i8* %tp.raw, i64 %tp.off
  {b} = bitcast i8* %tp.tagged to %struct.Base*
""")
m = re.search(r"  (%\d+) = load %struct\.Base\*, %struct\.Base\*\* %\d+, align 8, [^\n]*\n  store %struct\.Base\* \1, %struct\.Base\*\* %o\.addr", s)
v = m.group(1)
s = s.replace(m.group(0), m.group(0).replace(f"store %struct.Base* {v},", f"""%tp.r = bitcast %struct.Base* {v} to i8*
  %tp.m = call i8* @llvm.ptrmask.p0.i64(i8* %tp.r, i64 281474976710655)
  %tp.ptr = bitcast i8* %tp.m to %struct.Base*
  store %struct.Base* %tp.ptr,"""))
s = re.sub(r"^(declare void @nish_array_grow.*)$", r"\1\ndeclare i8* @llvm.ptrmask.p0.i64(i8*, i64)", s, flags=re.M)
open("ll_tp.ll", "w").write(s)
```

```python
# rss.py <name>...: peak RSS (KB, from wait4) and stdout of bin/<name>, best of 3.
import os, subprocess, sys
for n in sys.argv[1:]:
    best, out = None, set()
    for _ in range(3):
        p = subprocess.Popen(["bin/" + n], stdout=subprocess.PIPE)
        o = p.stdout.read(); _, st, ru = os.wait4(p.pid, 0)
        assert st == 0, (n, st)
        best = ru.ru_maxrss if best is None else min(best, ru.ru_maxrss); out.add(o.decode().strip())
    print(f"{n}\t{best} KB\t{','.join(sorted(out))}")
```

`probe.ll` gives §2.3's size table: each `@size_*` returns the size of one
layout as LLVM computes it, and `opt -O2 -mtriple=<t> -S` folds it to a
constant for `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu` and
`wasm32-unknown-wasi`.

```llvm
; probe.ll: LLVM's own sizes for the WP60 layouts. Each @size_* returns the
; allocation size of one type (the gep-from-null idiom), which opt -O2 folds to
; a constant under the module's data layout.
%Fat = type { i32, ptr }
%OneField = type { i32, %Fat }
%OneSplit = type { i32, i32, ptr }
%HandOne = type { i32, ptr }
%TwoAgg = type { %Fat, %Fat }
%TwoSplit = type { i32, i32, ptr, ptr }
%HandTwo = type { ptr, ptr }
%OneTagged = type { i32, ptr }
%TwoTagged = type { ptr, ptr }
define i64 @size_Fat() {
  %p = getelementptr %Fat, ptr null, i32 1
  %n = ptrtoint ptr %p to i64
  ret i64 %n
}
define i64 @size_OneField() {
  %p = getelementptr %OneField, ptr null, i32 1
  %n = ptrtoint ptr %p to i64
  ret i64 %n
}
define i64 @size_OneSplit() {
  %p = getelementptr %OneSplit, ptr null, i32 1
  %n = ptrtoint ptr %p to i64
  ret i64 %n
}
define i64 @size_HandOne() {
  %p = getelementptr %HandOne, ptr null, i32 1
  %n = ptrtoint ptr %p to i64
  ret i64 %n
}
define i64 @size_TwoAgg() {
  %p = getelementptr %TwoAgg, ptr null, i32 1
  %n = ptrtoint ptr %p to i64
  ret i64 %n
}
define i64 @size_TwoSplit() {
  %p = getelementptr %TwoSplit, ptr null, i32 1
  %n = ptrtoint ptr %p to i64
  ret i64 %n
}
define i64 @size_HandTwo() {
  %p = getelementptr %HandTwo, ptr null, i32 1
  %n = ptrtoint ptr %p to i64
  ret i64 %n
}
define i64 @size_OneTagged() {
  %p = getelementptr %OneTagged, ptr null, i32 1
  %n = ptrtoint ptr %p to i64
  ret i64 %n
}
define i64 @size_TwoTagged() {
  %p = getelementptr %TwoTagged, ptr null, i32 1
  %n = ptrtoint ptr %p to i64
  ret i64 %n
}
define i64 @size_ptr() {
  %p = getelementptr ptr, ptr null, i32 1
  %n = ptrtoint ptr %p to i64
  ret i64 %n
}
```

### 12.9 The hot loops (`hot.py`, `hotll.py`)

§3.3 and §3.4 read the machine code of the program's own module, not the
linked binary, so the runtime's calls stay calls and the addresses are the
object file's:

```sh
clang -O3 -fomit-frame-pointer -Wno-override-module -ffp-contract=off -DNDEBUG \
  -S -emit-llvm ll_X.ll -o asm/X.O3.ll
clang -O3 -fomit-frame-pointer -fno-asynchronous-unwind-tables -Wno-override-module \
  -ffp-contract=off -DNDEBUG -c ll_X.ll -o asm/X.o
objdump -d --no-show-raw-insn -M intel asm/X.o > asm/X.s
(cd asm && python3 hot.py X > X.hot.txt && python3 hotll.py X > X.hotll.txt)
```

```python
# hot.py <name>: the hot loop of nish_main in <name>.s, from the instruction
# that loads the trip count (200000000 serial, 200000 array) to the call that
# prints the result. Prints the instructions without addresses' noise.
import re, sys
n = sys.argv[1]
lines = open(f"{n}.s").read().split("<nish_main>:")[1].split("\n\n")[0].split("\n")
start = next(i for i, l in enumerate(lines) if "0xbebc200" in l or "0x30d40" in l)
end = next(i for i in range(start, len(lines)) if re.search(r"call\s+[0-9a-f]+ <nish_main", lines[i]))
for l in lines[start:end]:
    print(l.rstrip())
```

```python
# hotll.py <name>: the hot loop of nish_main in <name>.O3.ll: every block from
# the first one after the pool's fill loop to the block that leaves the loop,
# i.e. the blocks that do not belong to the fill and do not print.
import re, sys
src = open(f"{sys.argv[1]}.O3.ll").read()
body = re.search(r"^define [^\n]*@nish_main\b.*?^}", src, re.S | re.M).group(0)
blocks = re.split(r"\n(?=[\w.$-]+:)", body)
out, started = [], False
for b in blocks[1:]:
    name = b.split(":")[0]
    fill = re.match(r"(push\.|fast\.|slow\.|nish_alloc|for\.body\.1$|for\.body$|entry)", name)
    if not started and fill: continue
    if re.search(r"@nish_(print|u32|str|console|i32_to)|call void @nish_print|@puts|@printf", b) and started: break
    if not fill or started:
        started = True; out.append(b)
print("\n".join(out))
```

Lines in each hot loop, serial aperiodic:

| Variant | K=4 `objdump` | K=4 `.ll` | K=13 `objdump` | K=13 `.ll` |
| --- | --- | --- | --- | --- |
| `switch` | 50 | 50 | 88 | 117 |
| `proposed` | 49 | 49 | 87 | 116 |
| `table` | 53 | 61 | 92 | 128 |
| `vtable` | 22 | 21 | 31 | 33 |

<details>
<summary><code>serial_aperiodic_k4_switch</code>: <code>objdump -d</code> and the <code>-O3</code> IR</summary>

```asm
 27d:	mov    eax,0xbebc200
 282:	mov    rdi,QWORD PTR [rsp+0x60]
 287:	jmp    29b <nish_main+0x29b>
 289:	nop    DWORD PTR [rax+0x0]
 290:	xor    edx,ecx
 292:	add    edx,0x7
 295:	mov    ecx,edx
 297:	dec    eax
 299:	je     2fd <nish_main+0x2fd>
 29b:	mov    edx,ebp
 29d:	shl    edx,0xd
 2a0:	xor    edx,ebp
 2a2:	mov    esi,edx
 2a4:	shr    esi,0x11
 2a7:	xor    esi,edx
 2a9:	mov    ebp,esi
 2ab:	shl    ebp,0x5
 2ae:	xor    ebp,esi
 2b0:	mov    edx,ebp
 2b2:	shr    edx,0x5
 2b5:	and    edx,0x18
 2b8:	mov    rdx,QWORD PTR [rdi+rdx*1]
 2bc:	mov    esi,DWORD PTR [rdx]
 2be:	mov    edx,DWORD PTR [rdx+0x4]
 2c1:	cmp    esi,0x2
 2c4:	je     2e0 <nish_main+0x2e0>
 2c6:	cmp    esi,0x1
 2c9:	je     290 <nish_main+0x290>
 2cb:	test   esi,esi
 2cd:	jne    2f0 <nish_main+0x2f0>
 2cf:	lea    ecx,[rcx+rcx*2]
 2d2:	add    edx,ecx
 2d4:	mov    ecx,edx
 2d6:	dec    eax
 2d8:	jne    29b <nish_main+0x29b>
 2da:	jmp    2fd <nish_main+0x2fd>
 2dc:	nop    DWORD PTR [rax+0x0]
 2e0:	add    ecx,ecx
 2e2:	sub    ecx,edx
 2e4:	dec    eax
 2e6:	jne    29b <nish_main+0x29b>
 2e8:	jmp    2fd <nish_main+0x2fd>
 2ea:	nop    WORD PTR [rax+rax*1+0x0]
 2f0:	lea    ecx,[rcx+rcx*4]
 2f3:	shr    edx,1
 2f5:	xor    edx,ecx
 2f7:	mov    ecx,edx
 2f9:	dec    eax
 2fb:	jne    29b <nish_main+0x29b>
 2fd:	mov    edi,ecx
```

```llvm
if.then:                                          ; preds = %push.store.2, %for.inc.2
  %s.addr.142 = phi i32 [ %51, %for.inc.2 ], [ %31, %push.store.2 ]
  %i.addr.041 = phi i32 [ %67, %for.inc.2 ], [ 0, %push.store.2 ]
  %acc.addr.040 = phi i32 [ %acc.addr.1, %for.inc.2 ], [ 1, %push.store.2 ]
  %46 = shl i32 %s.addr.142, 13
  %47 = xor i32 %46, %s.addr.142
  %48 = lshr i32 %47, 17
  %49 = xor i32 %48, %47
  %50 = shl i32 %49, 5
  %51 = xor i32 %50, %49
  %52 = lshr i32 %51, 8
  %53 = and i32 %52, 3
  %54 = zext nneg i32 %53 to i64
  %55 = getelementptr inbounds ptr, ptr %20, i64 %54
  %56 = load ptr, ptr %55, align 8, !tbaa !19, !alias.scope !17, !noalias !14
  %.val = load i32, ptr %56, align 4
  %57 = getelementptr i8, ptr %56, i64 4
  %.val35 = load i32, ptr %57, align 4
  switch i32 %.val, label %sw.default.i [
    i32 0, label %sw.case.i
    i32 1, label %sw.case.1.i
    i32 2, label %sw.case.2.i
  ]

sw.case.i:                                        ; preds = %if.then
  %58 = mul i32 %acc.addr.040, 3
  %59 = add i32 %.val35, %58
  br label %for.inc.2

sw.case.1.i:                                      ; preds = %if.then
  %60 = xor i32 %.val35, %acc.addr.040
  %61 = add i32 %60, 7
  br label %for.inc.2

sw.case.2.i:                                      ; preds = %if.then
  %62 = shl i32 %acc.addr.040, 1
  %63 = sub i32 %62, %.val35
  br label %for.inc.2

sw.default.i:                                     ; preds = %if.then
  %64 = mul i32 %acc.addr.040, 5
  %65 = lshr i32 %.val35, 1
  %66 = xor i32 %65, %64
  br label %for.inc.2

for.inc.2:                                        ; preds = %sw.default.i, %sw.case.2.i, %sw.case.1.i, %sw.case.i
  %acc.addr.1 = phi i32 [ %59, %sw.case.i ], [ %61, %sw.case.1.i ], [ %63, %sw.case.2.i ], [ %66, %sw.default.i ]
  %67 = add nuw nsw i32 %i.addr.041, 1
  %exitcond49.not = icmp eq i32 %67, 200000000
  br i1 %exitcond49.not, label %for.end.2, label %if.then
```

</details>

<details>
<summary><code>serial_aperiodic_k4_proposed</code>: <code>objdump -d</code> and the <code>-O3</code> IR</summary>

```asm
 27d:	mov    eax,0xbebc200
 282:	mov    rdi,QWORD PTR [rsp+0x60]
 287:	jmp    29b <nish_main+0x29b>
 289:	nop    DWORD PTR [rax+0x0]
 290:	xor    edx,ecx
 292:	add    edx,0x7
 295:	mov    ecx,edx
 297:	dec    eax
 299:	je     2fd <nish_main+0x2fd>
 29b:	mov    edx,ebp
 29d:	shl    edx,0xd
 2a0:	xor    edx,ebp
 2a2:	mov    esi,edx
 2a4:	shr    esi,0x11
 2a7:	xor    esi,edx
 2a9:	mov    ebp,esi
 2ab:	shl    ebp,0x5
 2ae:	xor    ebp,esi
 2b0:	mov    esi,ebp
 2b2:	shr    esi,0x8
 2b5:	and    esi,0x3
 2b8:	mov    rdx,QWORD PTR [rdi+rsi*8]
 2bc:	mov    edx,DWORD PTR [rdx+0x4]
 2bf:	cmp    esi,0x2
 2c2:	je     2e0 <nish_main+0x2e0>
 2c4:	cmp    esi,0x1
 2c7:	je     290 <nish_main+0x290>
 2c9:	test   esi,esi
 2cb:	jne    2f0 <nish_main+0x2f0>
 2cd:	lea    ecx,[rcx+rcx*2]
 2d0:	add    edx,ecx
 2d2:	mov    ecx,edx
 2d4:	dec    eax
 2d6:	jne    29b <nish_main+0x29b>
 2d8:	jmp    2fd <nish_main+0x2fd>
 2da:	nop    WORD PTR [rax+rax*1+0x0]
 2e0:	add    ecx,ecx
 2e2:	sub    ecx,edx
 2e4:	dec    eax
 2e6:	jne    29b <nish_main+0x29b>
 2e8:	jmp    2fd <nish_main+0x2fd>
 2ea:	nop    WORD PTR [rax+rax*1+0x0]
 2f0:	lea    ecx,[rcx+rcx*4]
 2f3:	shr    edx,1
 2f5:	xor    edx,ecx
 2f7:	mov    ecx,edx
 2f9:	dec    eax
 2fb:	jne    29b <nish_main+0x29b>
 2fd:	mov    edi,ecx
```

```llvm
if.then:                                          ; preds = %push.store.2, %for.inc.2
  %s.addr.142 = phi i32 [ %51, %for.inc.2 ], [ %31, %push.store.2 ]
  %i.addr.041 = phi i32 [ %67, %for.inc.2 ], [ 0, %push.store.2 ]
  %acc.addr.040 = phi i32 [ %acc.addr.1, %for.inc.2 ], [ 1, %push.store.2 ]
  %46 = shl i32 %s.addr.142, 13
  %47 = xor i32 %46, %s.addr.142
  %48 = lshr i32 %47, 17
  %49 = xor i32 %48, %47
  %50 = shl i32 %49, 5
  %51 = xor i32 %50, %49
  %52 = lshr i32 %51, 8
  %53 = and i32 %52, 3
  %54 = zext nneg i32 %53 to i64
  %55 = getelementptr inbounds ptr, ptr %20, i64 %54
  %56 = load ptr, ptr %55, align 8, !tbaa !19, !alias.scope !17, !noalias !14
  %57 = getelementptr i8, ptr %56, i64 4
  %.val = load i32, ptr %57, align 4
  switch i32 %53, label %sw.default.i [
    i32 0, label %sw.case.i
    i32 1, label %sw.case.1.i
    i32 2, label %sw.case.2.i
  ]

sw.case.i:                                        ; preds = %if.then
  %58 = mul i32 %acc.addr.040, 3
  %59 = add i32 %.val, %58
  br label %for.inc.2

sw.case.1.i:                                      ; preds = %if.then
  %60 = xor i32 %.val, %acc.addr.040
  %61 = add i32 %60, 7
  br label %for.inc.2

sw.case.2.i:                                      ; preds = %if.then
  %62 = shl i32 %acc.addr.040, 1
  %63 = sub i32 %62, %.val
  br label %for.inc.2

sw.default.i:                                     ; preds = %if.then
  %64 = mul i32 %acc.addr.040, 5
  %65 = lshr i32 %.val, 1
  %66 = xor i32 %65, %64
  br label %for.inc.2

for.inc.2:                                        ; preds = %sw.default.i, %sw.case.2.i, %sw.case.1.i, %sw.case.i
  %acc.addr.1 = phi i32 [ %59, %sw.case.i ], [ %61, %sw.case.1.i ], [ %63, %sw.case.2.i ], [ %66, %sw.default.i ]
  %67 = add nuw nsw i32 %i.addr.041, 1
  %exitcond49.not = icmp eq i32 %67, 200000000
  br i1 %exitcond49.not, label %for.end.2, label %if.then
```

</details>

<details>
<summary><code>serial_aperiodic_k4_table</code>: <code>objdump -d</code> and the <code>-O3</code> IR</summary>

```asm
 28d:	mov    eax,0xbebc200
 292:	mov    r8,QWORD PTR [rsp+0x58]
 297:	jmp    2ab <nish_main+0x2ab>
 299:	nop    DWORD PTR [rax+0x0]
 2a0:	xor    edx,ecx
 2a2:	add    edx,0x7
 2a5:	mov    ecx,edx
 2a7:	dec    eax
 2a9:	je     31d <nish_main+0x31d>
 2ab:	mov    edx,ebp
 2ad:	shl    edx,0xd
 2b0:	xor    edx,ebp
 2b2:	mov    esi,edx
 2b4:	shr    esi,0x11
 2b7:	xor    esi,edx
 2b9:	mov    ebp,esi
 2bb:	shl    ebp,0x5
 2be:	xor    ebp,esi
 2c0:	mov    edx,ebp
 2c2:	shr    edx,0x5
 2c5:	and    edx,0x18
 2c8:	mov    rdx,QWORD PTR [r8+rdx*1]
 2cc:	movsxd rdi,DWORD PTR [rdx]
 2cf:	cmp    rdi,0x4
 2d3:	jae    3e2 <nish_main+0x3e2>
 2d9:	mov    esi,DWORD PTR [rsp+rdi*4+0x60]
 2dd:	mov    edx,DWORD PTR [rdx+0x4]
 2e0:	cmp    esi,0x3
 2e3:	je     300 <nish_main+0x300>
 2e5:	cmp    esi,0x2
 2e8:	je     2a0 <nish_main+0x2a0>
 2ea:	cmp    esi,0x1
 2ed:	jne    310 <nish_main+0x310>
 2ef:	lea    ecx,[rcx+rcx*2]
 2f2:	add    edx,ecx
 2f4:	mov    ecx,edx
 2f6:	dec    eax
 2f8:	jne    2ab <nish_main+0x2ab>
 2fa:	jmp    31d <nish_main+0x31d>
 2fc:	nop    DWORD PTR [rax+0x0]
 300:	add    ecx,ecx
 302:	sub    ecx,edx
 304:	dec    eax
 306:	jne    2ab <nish_main+0x2ab>
 308:	jmp    31d <nish_main+0x31d>
 30a:	nop    WORD PTR [rax+rax*1+0x0]
 310:	lea    ecx,[rcx+rcx*4]
 313:	shr    edx,1
 315:	xor    edx,ecx
 317:	mov    ecx,edx
 319:	dec    eax
 31b:	jne    2ab <nish_main+0x2ab>
 31d:	mov    edi,ecx
```

```llvm
if.then:                                          ; preds = %push.store.2, %for.inc.2
  %s.addr.144 = phi i32 [ %51, %for.inc.2 ], [ %31, %push.store.2 ]
  %i.addr.043 = phi i32 [ %72, %for.inc.2 ], [ 0, %push.store.2 ]
  %acc.addr.042 = phi i32 [ %acc.addr.1, %for.inc.2 ], [ 1, %push.store.2 ]
  %46 = shl i32 %s.addr.144, 13
  %47 = xor i32 %46, %s.addr.144
  %48 = lshr i32 %47, 17
  %49 = xor i32 %48, %47
  %50 = shl i32 %49, 5
  %51 = xor i32 %50, %49
  %52 = lshr i32 %51, 8
  %53 = and i32 %52, 3
  %54 = zext nneg i32 %53 to i64
  %55 = getelementptr inbounds ptr, ptr %20, i64 %54
  %56 = load ptr, ptr %55, align 8, !tbaa !21, !alias.scope !9, !noalias !12
  %57 = load i32, ptr %56, align 4
  %58 = sext i32 %57 to i64
  %59 = icmp ult i32 %57, 4
  br i1 %59, label %bounds.ok, label %bounds.fail

bounds.fail:                                      ; preds = %if.then
  tail call void @nish_panic_index(i64 %58, i64 4)
  unreachable

bounds.ok:                                        ; preds = %if.then
  %60 = getelementptr inbounds i32, ptr %arr.data, i64 %58
  %61 = load i32, ptr %60, align 4, !tbaa !5, !alias.scope !9, !noalias !12
  %62 = getelementptr i8, ptr %56, i64 4
  %.val = load i32, ptr %62, align 4
  switch i32 %61, label %sw.default.i [
    i32 1, label %sw.case.i
    i32 2, label %sw.case.1.i
    i32 3, label %sw.case.2.i
  ]

sw.case.i:                                        ; preds = %bounds.ok
  %63 = mul i32 %acc.addr.042, 3
  %64 = add i32 %.val, %63
  br label %for.inc.2

sw.case.1.i:                                      ; preds = %bounds.ok
  %65 = xor i32 %.val, %acc.addr.042
  %66 = add i32 %65, 7
  br label %for.inc.2

sw.case.2.i:                                      ; preds = %bounds.ok
  %67 = shl i32 %acc.addr.042, 1
  %68 = sub i32 %67, %.val
  br label %for.inc.2

sw.default.i:                                     ; preds = %bounds.ok
  %69 = mul i32 %acc.addr.042, 5
  %70 = lshr i32 %.val, 1
  %71 = xor i32 %70, %69
  br label %for.inc.2

for.inc.2:                                        ; preds = %sw.default.i, %sw.case.2.i, %sw.case.1.i, %sw.case.i
  %acc.addr.1 = phi i32 [ %64, %sw.case.i ], [ %66, %sw.case.1.i ], [ %68, %sw.case.2.i ], [ %71, %sw.default.i ]
  %72 = add nuw nsw i32 %i.addr.043, 1
  %exitcond52.not = icmp eq i32 %72, 200000000
  br i1 %exitcond52.not, label %for.end.2, label %if.then
```

</details>

<details>
<summary><code>serial_aperiodic_k4_vtable</code>: <code>objdump -d</code> and the <code>-O3</code> IR</summary>

```asm
 2bc:	mov    ebx,0xbebc200
 2c1:	mov    r14,QWORD PTR [rip+0x0]        # 2c8 <nish_main+0x288>
 2c8:	mov    r15,QWORD PTR [rsp+0x60]
 2cd:	nop    DWORD PTR [rax]
 2d0:	mov    ecx,ebp
 2d2:	shl    ecx,0xd
 2d5:	xor    ecx,ebp
 2d7:	mov    edx,ecx
 2d9:	shr    edx,0x11
 2dc:	xor    edx,ecx
 2de:	mov    ebp,edx
 2e0:	shl    ebp,0x5
 2e3:	xor    ebp,edx
 2e5:	mov    ecx,ebp
 2e7:	shr    ecx,0x5
 2ea:	and    ecx,0x18
 2ed:	mov    rdi,QWORD PTR [r15+rcx*1]
 2f1:	mov    esi,eax
 2f3:	call   QWORD PTR [r14+rcx*1]
 2f7:	dec    ebx
 2f9:	jne    2d0 <nish_main+0x290>
 2fb:	mov    edi,eax
```

```llvm
for.inc.2:                                        ; preds = %push.store.2, %for.inc.2
  %s.addr.141 = phi i32 [ %51, %for.inc.2 ], [ %31, %push.store.2 ]
  %i.addr.040 = phi i32 [ %57, %for.inc.2 ], [ 0, %push.store.2 ]
  %acc.addr.039 = phi i32 [ %r.i, %for.inc.2 ], [ 1, %push.store.2 ]
  %46 = shl i32 %s.addr.141, 13
  %47 = xor i32 %46, %s.addr.141
  %48 = lshr i32 %47, 17
  %49 = xor i32 %48, %47
  %50 = shl i32 %49, 5
  %51 = xor i32 %50, %49
  %52 = lshr i32 %51, 8
  %53 = and i32 %52, 3
  %54 = zext nneg i32 %53 to i64
  %55 = getelementptr inbounds ptr, ptr %20, i64 %54
  %56 = load ptr, ptr %55, align 8, !tbaa !19, !alias.scope !17, !noalias !14
  %slot.i = getelementptr inbounds [16 x ptr], ptr @wp60_vt, i64 0, i64 %54
  %fp.i = load ptr, ptr %slot.i, align 8
  %r.i = tail call noundef i32 %fp.i(ptr nonnull %56, i32 %acc.addr.039) #4
  %57 = add nuw nsw i32 %i.addr.040, 1
  %exitcond48.not = icmp eq i32 %57, 200000000
  br i1 %exitcond48.not, label %for.end.2, label %for.inc.2
```

</details>

<details>
<summary><code>serial_aperiodic_k13_switch</code>: <code>objdump -d</code> and the <code>-O3</code> IR</summary>

```asm
 1dd:	mov    eax,0xbebc200
 1e2:	lea    rcx,[rip+0x0]        # 1e9 <nish_main+0x1e9>
 1e9:	mov    r9,QWORD PTR [rsp+0x60]
 1ee:	mov    r10,QWORD PTR [rsp+0x58]
 1f3:	jmp    20a <nish_main+0x20a>
 1f5:	add    edx,0xffffffed
 1f8:	xor    esi,edx
 1fa:	nop    WORD PTR [rax+rax*1+0x0]
 200:	mov    edx,esi
 202:	dec    eax
 204:	je     2e8 <nish_main+0x2e8>
 20a:	mov    esi,ebp
 20c:	shl    esi,0xd
 20f:	xor    esi,ebp
 211:	mov    edi,esi
 213:	shr    edi,0x11
 216:	xor    edi,esi
 218:	mov    ebp,edi
 21a:	shl    ebp,0x5
 21d:	xor    ebp,edi
 21f:	mov    esi,ebp
 221:	shr    esi,0x8
 224:	imul   rdi,rsi,0x13b13b14
 22b:	shr    rdi,0x20
 22f:	lea    r8d,[rdi+rdi*2]
 233:	lea    edi,[rdi+r8*4]
 237:	sub    esi,edi
 239:	cmp    esi,r10d
 23c:	jge    202 <nish_main+0x202>
 23e:	mov    esi,esi
 240:	mov    rsi,QWORD PTR [r9+rsi*8]
 244:	mov    edi,DWORD PTR [rsi]
 246:	mov    esi,DWORD PTR [rsi+0x4]
 249:	cmp    rdi,0xb
 24d:	ja     2de <nish_main+0x2de>
 253:	movsxd rdi,DWORD PTR [rcx+rdi*4]
 257:	add    rdi,rcx
 25a:	notrack jmp rdi
 25d:	lea    edx,[rdx+rdx*2]
 260:	add    esi,edx
 262:	jmp    200 <nish_main+0x200>
 264:	mov    edi,edx
 266:	shr    edi,0x5
 269:	xor    edi,edx
 26b:	jmp    2d7 <nish_main+0x2d7>
 26d:	add    esi,edx
 26f:	lea    edx,[rsi+rsi*8]
 272:	jmp    202 <nish_main+0x202>
 274:	add    edx,edx
 276:	sub    edx,esi
 278:	jmp    202 <nish_main+0x202>
 27a:	lea    edx,[rdx+rdx*4]
 27d:	shr    esi,1
 27f:	xor    esi,edx
 281:	jmp    200 <nish_main+0x200>
 286:	or     esi,edx
 288:	add    esi,0xd
 28b:	jmp    200 <nish_main+0x200>
 290:	xor    esi,edx
 292:	add    esi,0x7
 295:	jmp    200 <nish_main+0x200>
 29a:	shr    edx,0x3
 29d:	lea    edi,[rsi+rsi*4]
 2a0:	lea    esi,[rsi+rdi*2]
 2a3:	add    esi,edx
 2a5:	mov    edx,esi
 2a7:	jmp    202 <nish_main+0x202>
 2ac:	shl    esi,0x2
 2af:	xor    edx,esi
 2b1:	xor    edx,0x55
 2b4:	jmp    202 <nish_main+0x202>
 2b9:	lea    edi,[rdx+rdx*2]
 2bc:	shl    edi,0x3
 2bf:	sub    edi,edx
 2c1:	and    esi,0x7
 2c4:	sub    edi,esi
 2c6:	mov    edx,edi
 2c8:	jmp    202 <nish_main+0x202>
 2cd:	movzx  edx,dx
 2d0:	mov    edi,edx
 2d2:	shl    edi,0x4
 2d5:	add    edi,edx
 2d7:	add    esi,edi
 2d9:	jmp    200 <nish_main+0x200>
 2de:	rol    edx,0x3
 2e1:	add    esi,edx
 2e3:	jmp    200 <nish_main+0x200>
 2e8:	mov    edi,edx
```

```llvm
for.end.1:                                        ; preds = %push.store.2
  %41 = trunc i64 %15 to i32
  br label %for.body.2

for.body.2:                                       ; preds = %for.end.1, %for.inc.2
  %s.addr.142 = phi i32 [ %26, %for.end.1 ], [ %47, %for.inc.2 ]
  %i.addr.041 = phi i32 [ 0, %for.end.1 ], [ %87, %for.inc.2 ]
  %acc.addr.040 = phi i32 [ 1, %for.end.1 ], [ %acc.addr.1, %for.inc.2 ]
  %42 = shl i32 %s.addr.142, 13
  %43 = xor i32 %42, %s.addr.142
  %44 = lshr i32 %43, 17
  %45 = xor i32 %44, %43
  %46 = shl i32 %45, 5
  %47 = xor i32 %46, %45
  %48 = lshr i32 %47, 8
  %49 = urem i32 %48, 13
  %50 = icmp slt i32 %49, %41
  br i1 %50, label %if.then, label %for.inc.2

if.then:                                          ; preds = %for.body.2
  %51 = zext nneg i32 %49 to i64
  %52 = getelementptr inbounds ptr, ptr %13, i64 %51
  %53 = load ptr, ptr %52, align 8, !tbaa !20, !alias.scope !17, !noalias !14
  %.val = load i32, ptr %53, align 4
  %54 = getelementptr i8, ptr %53, i64 4
  %.val35 = load i32, ptr %54, align 4
  switch i32 %.val, label %sw.default.i [
    i32 0, label %sw.case.i
    i32 1, label %sw.case.1.i
    i32 2, label %sw.case.2.i
    i32 3, label %sw.case.3.i
    i32 4, label %sw.case.4.i
    i32 5, label %sw.case.5.i
    i32 6, label %sw.case.6.i
    i32 7, label %sw.case.7.i
    i32 8, label %sw.case.8.i
    i32 9, label %sw.case.9.i
    i32 10, label %sw.case.10.i
    i32 11, label %sw.case.11.i
  ]

sw.case.i:                                        ; preds = %if.then
  %55 = mul i32 %acc.addr.040, 3
  %56 = add i32 %.val35, %55
  br label %for.inc.2

sw.case.1.i:                                      ; preds = %if.then
  %57 = xor i32 %.val35, %acc.addr.040
  %58 = add i32 %57, 7
  br label %for.inc.2

sw.case.2.i:                                      ; preds = %if.then
  %59 = shl i32 %acc.addr.040, 1
  %60 = sub i32 %59, %.val35
  br label %for.inc.2

sw.case.3.i:                                      ; preds = %if.then
  %61 = mul i32 %acc.addr.040, 5
  %62 = lshr i32 %.val35, 1
  %63 = xor i32 %62, %61
  br label %for.inc.2

sw.case.4.i:                                      ; preds = %if.then
  %64 = add i32 %.val35, %acc.addr.040
  %65 = mul i32 %64, 9
  br label %for.inc.2

sw.case.5.i:                                      ; preds = %if.then
  %66 = lshr i32 %acc.addr.040, 3
  %67 = mul i32 %.val35, 11
  %68 = add i32 %67, %66
  br label %for.inc.2

sw.case.6.i:                                      ; preds = %if.then
  %69 = shl i32 %.val35, 2
  %70 = xor i32 %acc.addr.040, %69
  %71 = xor i32 %70, 85
  br label %for.inc.2

sw.case.7.i:                                      ; preds = %if.then
  %72 = or i32 %.val35, %acc.addr.040
  %73 = add i32 %72, 13
  br label %for.inc.2

sw.case.8.i:                                      ; preds = %if.then
  %74 = and i32 %acc.addr.040, 65535
  %75 = mul nuw nsw i32 %74, 17
  %76 = add i32 %.val35, %75
  br label %for.inc.2

sw.case.9.i:                                      ; preds = %if.then
  %77 = add i32 %acc.addr.040, -19
  %78 = xor i32 %.val35, %77
  br label %for.inc.2

sw.case.10.i:                                     ; preds = %if.then
  %79 = mul i32 %acc.addr.040, 23
  %80 = and i32 %.val35, 7
  %81 = sub i32 %79, %80
  br label %for.inc.2

sw.case.11.i:                                     ; preds = %if.then
  %82 = lshr i32 %acc.addr.040, 5
  %83 = xor i32 %82, %acc.addr.040
  %84 = add i32 %.val35, %83
  br label %for.inc.2

sw.default.i:                                     ; preds = %if.then
  %85 = tail call i32 @llvm.fshl.i32(i32 %acc.addr.040, i32 %acc.addr.040, i32 3)
  %86 = add i32 %.val35, %85
  br label %for.inc.2

for.inc.2:                                        ; preds = %sw.default.i, %sw.case.11.i, %sw.case.10.i, %sw.case.9.i, %sw.case.8.i, %sw.case.7.i, %sw.case.6.i, %sw.case.5.i, %sw.case.4.i, %sw.case.3.i, %sw.case.2.i, %sw.case.1.i, %sw.case.i, %for.body.2
  %acc.addr.1 = phi i32 [ %acc.addr.040, %for.body.2 ], [ %56, %sw.case.i ], [ %58, %sw.case.1.i ], [ %60, %sw.case.2.i ], [ %63, %sw.case.3.i ], [ %65, %sw.case.4.i ], [ %68, %sw.case.5.i ], [ %71, %sw.case.6.i ], [ %73, %sw.case.7.i ], [ %76, %sw.case.8.i ], [ %78, %sw.case.9.i ], [ %81, %sw.case.10.i ], [ %84, %sw.case.11.i ], [ %86, %sw.default.i ]
  %87 = add nuw nsw i32 %i.addr.041, 1
  %exitcond44.not = icmp eq i32 %87, 200000000
  br i1 %exitcond44.not, label %for.end.2, label %for.body.2
```

</details>

<details>
<summary><code>serial_aperiodic_k13_proposed</code>: <code>objdump -d</code> and the <code>-O3</code> IR</summary>

```asm
 1dd:	mov    eax,0xbebc200
 1e2:	lea    rcx,[rip+0x0]        # 1e9 <nish_main+0x1e9>
 1e9:	mov    r9,QWORD PTR [rsp+0x60]
 1ee:	mov    r10,QWORD PTR [rsp+0x58]
 1f3:	jmp    20a <nish_main+0x20a>
 1f5:	add    edx,0xffffffed
 1f8:	xor    esi,edx
 1fa:	nop    WORD PTR [rax+rax*1+0x0]
 200:	mov    edx,esi
 202:	dec    eax
 204:	je     2e6 <nish_main+0x2e6>
 20a:	mov    esi,ebp
 20c:	shl    esi,0xd
 20f:	xor    esi,ebp
 211:	mov    edi,esi
 213:	shr    edi,0x11
 216:	xor    edi,esi
 218:	mov    ebp,edi
 21a:	shl    ebp,0x5
 21d:	xor    ebp,edi
 21f:	mov    edi,ebp
 221:	shr    edi,0x8
 224:	imul   rsi,rdi,0x13b13b14
 22b:	shr    rsi,0x20
 22f:	lea    r8d,[rsi+rsi*2]
 233:	lea    esi,[rsi+r8*4]
 237:	sub    edi,esi
 239:	cmp    edi,r10d
 23c:	jge    202 <nish_main+0x202>
 23e:	mov    r8d,edi
 241:	mov    rsi,QWORD PTR [r9+r8*8]
 245:	mov    esi,DWORD PTR [rsi+0x4]
 248:	cmp    edi,0xb
 24b:	ja     2dc <nish_main+0x2dc>
 251:	movsxd rdi,DWORD PTR [rcx+r8*4]
 255:	add    rdi,rcx
 258:	notrack jmp rdi
 25b:	lea    edx,[rdx+rdx*2]
 25e:	add    esi,edx
 260:	jmp    200 <nish_main+0x200>
 262:	mov    edi,edx
 264:	shr    edi,0x5
 267:	xor    edi,edx
 269:	jmp    2d5 <nish_main+0x2d5>
 26b:	add    esi,edx
 26d:	lea    edx,[rsi+rsi*8]
 270:	jmp    202 <nish_main+0x202>
 272:	add    edx,edx
 274:	sub    edx,esi
 276:	jmp    202 <nish_main+0x202>
 278:	lea    edx,[rdx+rdx*4]
 27b:	shr    esi,1
 27d:	xor    esi,edx
 27f:	jmp    200 <nish_main+0x200>
 284:	or     esi,edx
 286:	add    esi,0xd
 289:	jmp    200 <nish_main+0x200>
 28e:	xor    esi,edx
 290:	add    esi,0x7
 293:	jmp    200 <nish_main+0x200>
 298:	shr    edx,0x3
 29b:	lea    edi,[rsi+rsi*4]
 29e:	lea    esi,[rsi+rdi*2]
 2a1:	add    esi,edx
 2a3:	mov    edx,esi
 2a5:	jmp    202 <nish_main+0x202>
 2aa:	shl    esi,0x2
 2ad:	xor    edx,esi
 2af:	xor    edx,0x55
 2b2:	jmp    202 <nish_main+0x202>
 2b7:	lea    edi,[rdx+rdx*2]
 2ba:	shl    edi,0x3
 2bd:	sub    edi,edx
 2bf:	and    esi,0x7
 2c2:	sub    edi,esi
 2c4:	mov    edx,edi
 2c6:	jmp    202 <nish_main+0x202>
 2cb:	movzx  edx,dx
 2ce:	mov    edi,edx
 2d0:	shl    edi,0x4
 2d3:	add    edi,edx
 2d5:	add    esi,edi
 2d7:	jmp    200 <nish_main+0x200>
 2dc:	rol    edx,0x3
 2df:	add    esi,edx
 2e1:	jmp    200 <nish_main+0x200>
 2e6:	mov    edi,edx
```

```llvm
for.end.1:                                        ; preds = %push.store.2
  %41 = trunc i64 %15 to i32
  br label %for.body.2

for.body.2:                                       ; preds = %for.end.1, %for.inc.2
  %s.addr.142 = phi i32 [ %26, %for.end.1 ], [ %47, %for.inc.2 ]
  %i.addr.041 = phi i32 [ 0, %for.end.1 ], [ %87, %for.inc.2 ]
  %acc.addr.040 = phi i32 [ 1, %for.end.1 ], [ %acc.addr.1, %for.inc.2 ]
  %42 = shl i32 %s.addr.142, 13
  %43 = xor i32 %42, %s.addr.142
  %44 = lshr i32 %43, 17
  %45 = xor i32 %44, %43
  %46 = shl i32 %45, 5
  %47 = xor i32 %46, %45
  %48 = lshr i32 %47, 8
  %49 = urem i32 %48, 13
  %50 = icmp slt i32 %49, %41
  br i1 %50, label %if.then, label %for.inc.2

if.then:                                          ; preds = %for.body.2
  %51 = zext nneg i32 %49 to i64
  %52 = getelementptr inbounds ptr, ptr %13, i64 %51
  %53 = load ptr, ptr %52, align 8, !tbaa !20, !alias.scope !17, !noalias !14
  %54 = getelementptr i8, ptr %53, i64 4
  %.val = load i32, ptr %54, align 4
  switch i32 %49, label %sw.default.i [
    i32 0, label %sw.case.i
    i32 1, label %sw.case.1.i
    i32 2, label %sw.case.2.i
    i32 3, label %sw.case.3.i
    i32 4, label %sw.case.4.i
    i32 5, label %sw.case.5.i
    i32 6, label %sw.case.6.i
    i32 7, label %sw.case.7.i
    i32 8, label %sw.case.8.i
    i32 9, label %sw.case.9.i
    i32 10, label %sw.case.10.i
    i32 11, label %sw.case.11.i
  ]

sw.case.i:                                        ; preds = %if.then
  %55 = mul i32 %acc.addr.040, 3
  %56 = add i32 %.val, %55
  br label %for.inc.2

sw.case.1.i:                                      ; preds = %if.then
  %57 = xor i32 %.val, %acc.addr.040
  %58 = add i32 %57, 7
  br label %for.inc.2

sw.case.2.i:                                      ; preds = %if.then
  %59 = shl i32 %acc.addr.040, 1
  %60 = sub i32 %59, %.val
  br label %for.inc.2

sw.case.3.i:                                      ; preds = %if.then
  %61 = mul i32 %acc.addr.040, 5
  %62 = lshr i32 %.val, 1
  %63 = xor i32 %62, %61
  br label %for.inc.2

sw.case.4.i:                                      ; preds = %if.then
  %64 = add i32 %.val, %acc.addr.040
  %65 = mul i32 %64, 9
  br label %for.inc.2

sw.case.5.i:                                      ; preds = %if.then
  %66 = lshr i32 %acc.addr.040, 3
  %67 = mul i32 %.val, 11
  %68 = add i32 %67, %66
  br label %for.inc.2

sw.case.6.i:                                      ; preds = %if.then
  %69 = shl i32 %.val, 2
  %70 = xor i32 %acc.addr.040, %69
  %71 = xor i32 %70, 85
  br label %for.inc.2

sw.case.7.i:                                      ; preds = %if.then
  %72 = or i32 %.val, %acc.addr.040
  %73 = add i32 %72, 13
  br label %for.inc.2

sw.case.8.i:                                      ; preds = %if.then
  %74 = and i32 %acc.addr.040, 65535
  %75 = mul nuw nsw i32 %74, 17
  %76 = add i32 %.val, %75
  br label %for.inc.2

sw.case.9.i:                                      ; preds = %if.then
  %77 = add i32 %acc.addr.040, -19
  %78 = xor i32 %.val, %77
  br label %for.inc.2

sw.case.10.i:                                     ; preds = %if.then
  %79 = mul i32 %acc.addr.040, 23
  %80 = and i32 %.val, 7
  %81 = sub i32 %79, %80
  br label %for.inc.2

sw.case.11.i:                                     ; preds = %if.then
  %82 = lshr i32 %acc.addr.040, 5
  %83 = xor i32 %82, %acc.addr.040
  %84 = add i32 %.val, %83
  br label %for.inc.2

sw.default.i:                                     ; preds = %if.then
  %85 = tail call i32 @llvm.fshl.i32(i32 %acc.addr.040, i32 %acc.addr.040, i32 3)
  %86 = add i32 %.val, %85
  br label %for.inc.2

for.inc.2:                                        ; preds = %sw.default.i, %sw.case.11.i, %sw.case.10.i, %sw.case.9.i, %sw.case.8.i, %sw.case.7.i, %sw.case.6.i, %sw.case.5.i, %sw.case.4.i, %sw.case.3.i, %sw.case.2.i, %sw.case.1.i, %sw.case.i, %for.body.2
  %acc.addr.1 = phi i32 [ %acc.addr.040, %for.body.2 ], [ %56, %sw.case.i ], [ %58, %sw.case.1.i ], [ %60, %sw.case.2.i ], [ %63, %sw.case.3.i ], [ %65, %sw.case.4.i ], [ %68, %sw.case.5.i ], [ %71, %sw.case.6.i ], [ %73, %sw.case.7.i ], [ %76, %sw.case.8.i ], [ %78, %sw.case.9.i ], [ %81, %sw.case.10.i ], [ %84, %sw.case.11.i ], [ %86, %sw.default.i ]
  %87 = add nuw nsw i32 %i.addr.041, 1
  %exitcond44.not = icmp eq i32 %87, 200000000
  br i1 %exitcond44.not, label %for.end.2, label %for.body.2
```

</details>

<details>
<summary><code>serial_aperiodic_k13_table</code>: <code>objdump -d</code> and the <code>-O3</code> IR</summary>

```asm
 20d:	mov    eax,0xbebc200
 212:	lea    rcx,[rip+0x0]        # 219 <nish_main+0x219>
 219:	mov    r9,QWORD PTR [rsp+0x68]
 21e:	mov    r10,QWORD PTR [rsp+0x60]
 223:	jmp    23a <nish_main+0x23a>
 225:	add    edx,0xffffffed
 228:	xor    esi,edx
 22a:	nop    WORD PTR [rax+rax*1+0x0]
 230:	mov    edx,esi
 232:	dec    eax
 234:	je     32e <nish_main+0x32e>
 23a:	mov    esi,ebp
 23c:	shl    esi,0xd
 23f:	xor    esi,ebp
 241:	mov    edi,esi
 243:	shr    edi,0x11
 246:	xor    edi,esi
 248:	mov    ebp,edi
 24a:	shl    ebp,0x5
 24d:	xor    ebp,edi
 24f:	mov    esi,ebp
 251:	shr    esi,0x8
 254:	imul   rdi,rsi,0x13b13b14
 25b:	shr    rdi,0x20
 25f:	lea    r8d,[rdi+rdi*2]
 263:	lea    edi,[rdi+r8*4]
 267:	sub    esi,edi
 269:	cmp    esi,r10d
 26c:	jge    232 <nish_main+0x232>
 26e:	mov    esi,esi
 270:	mov    rsi,QWORD PTR [r9+rsi*8]
 274:	movsxd rdi,DWORD PTR [rsi]
 277:	cmp    rdi,0xd
 27b:	jae    34e <nish_main+0x34e>
 281:	mov    edi,DWORD PTR [rsp+rdi*4+0x70]
 285:	mov    esi,DWORD PTR [rsi+0x4]
 288:	dec    edi
 28a:	cmp    edi,0xb
 28d:	ja     324 <nish_main+0x324>
 293:	movsxd rdi,DWORD PTR [rcx+rdi*4]
 297:	add    rdi,rcx
 29a:	notrack jmp rdi
 29d:	lea    edx,[rdx+rdx*2]
 2a0:	add    esi,edx
 2a2:	jmp    230 <nish_main+0x230>
 2a4:	mov    edi,edx
 2a6:	shr    edi,0x5
 2a9:	xor    edi,edx
 2ab:	jmp    31d <nish_main+0x31d>
 2ad:	add    esi,edx
 2af:	lea    edx,[rsi+rsi*8]
 2b2:	jmp    232 <nish_main+0x232>
 2b7:	add    edx,edx
 2b9:	sub    edx,esi
 2bb:	jmp    232 <nish_main+0x232>
 2c0:	lea    edx,[rdx+rdx*4]
 2c3:	shr    esi,1
 2c5:	xor    esi,edx
 2c7:	jmp    230 <nish_main+0x230>
 2cc:	or     esi,edx
 2ce:	add    esi,0xd
 2d1:	jmp    230 <nish_main+0x230>
 2d6:	xor    esi,edx
 2d8:	add    esi,0x7
 2db:	jmp    230 <nish_main+0x230>
 2e0:	shr    edx,0x3
 2e3:	lea    edi,[rsi+rsi*4]
 2e6:	lea    esi,[rsi+rdi*2]
 2e9:	add    esi,edx
 2eb:	mov    edx,esi
 2ed:	jmp    232 <nish_main+0x232>
 2f2:	shl    esi,0x2
 2f5:	xor    edx,esi
 2f7:	xor    edx,0x55
 2fa:	jmp    232 <nish_main+0x232>
 2ff:	lea    edi,[rdx+rdx*2]
 302:	shl    edi,0x3
 305:	sub    edi,edx
 307:	and    esi,0x7
 30a:	sub    edi,esi
 30c:	mov    edx,edi
 30e:	jmp    232 <nish_main+0x232>
 313:	movzx  edx,dx
 316:	mov    edi,edx
 318:	shl    edi,0x4
 31b:	add    edi,edx
 31d:	add    esi,edi
 31f:	jmp    230 <nish_main+0x230>
 324:	rol    edx,0x3
 327:	add    esi,edx
 329:	jmp    230 <nish_main+0x230>
 32e:	mov    edi,edx
```

```llvm
for.end.1:                                        ; preds = %push.store.2
  %44 = trunc i64 %18 to i32
  br label %for.body.2

for.body.2:                                       ; preds = %for.end.1, %for.inc.2
  %s.addr.144 = phi i32 [ %29, %for.end.1 ], [ %50, %for.inc.2 ]
  %i.addr.043 = phi i32 [ 0, %for.end.1 ], [ %95, %for.inc.2 ]
  %acc.addr.042 = phi i32 [ 1, %for.end.1 ], [ %acc.addr.1, %for.inc.2 ]
  %45 = shl i32 %s.addr.144, 13
  %46 = xor i32 %45, %s.addr.144
  %47 = lshr i32 %46, 17
  %48 = xor i32 %47, %46
  %49 = shl i32 %48, 5
  %50 = xor i32 %49, %48
  %51 = lshr i32 %50, 8
  %52 = urem i32 %51, 13
  %53 = icmp slt i32 %52, %44
  br i1 %53, label %if.then, label %for.inc.2

if.then:                                          ; preds = %for.body.2
  %54 = zext nneg i32 %52 to i64
  %55 = getelementptr inbounds ptr, ptr %16, i64 %54
  %56 = load ptr, ptr %55, align 8, !tbaa !22, !alias.scope !9, !noalias !12
  %57 = load i32, ptr %56, align 4
  %58 = sext i32 %57 to i64
  %59 = icmp ult i32 %57, 13
  br i1 %59, label %bounds.ok, label %bounds.fail

bounds.fail:                                      ; preds = %if.then
  tail call void @nish_panic_index(i64 %58, i64 13)
  unreachable

bounds.ok:                                        ; preds = %if.then
  %60 = getelementptr inbounds i32, ptr %arr.data, i64 %58
  %61 = load i32, ptr %60, align 4, !tbaa !5, !alias.scope !9, !noalias !12
  %62 = getelementptr i8, ptr %56, i64 4
  %.val = load i32, ptr %62, align 4
  switch i32 %61, label %sw.default.i [
    i32 1, label %sw.case.i
    i32 2, label %sw.case.1.i
    i32 3, label %sw.case.2.i
    i32 4, label %sw.case.3.i
    i32 5, label %sw.case.4.i
    i32 6, label %sw.case.5.i
    i32 7, label %sw.case.6.i
    i32 8, label %sw.case.7.i
    i32 9, label %sw.case.8.i
    i32 10, label %sw.case.9.i
    i32 11, label %sw.case.10.i
    i32 12, label %sw.case.11.i
  ]

sw.case.i:                                        ; preds = %bounds.ok
  %63 = mul i32 %acc.addr.042, 3
  %64 = add i32 %.val, %63
  br label %for.inc.2

sw.case.1.i:                                      ; preds = %bounds.ok
  %65 = xor i32 %.val, %acc.addr.042
  %66 = add i32 %65, 7
  br label %for.inc.2

sw.case.2.i:                                      ; preds = %bounds.ok
  %67 = shl i32 %acc.addr.042, 1
  %68 = sub i32 %67, %.val
  br label %for.inc.2

sw.case.3.i:                                      ; preds = %bounds.ok
  %69 = mul i32 %acc.addr.042, 5
  %70 = lshr i32 %.val, 1
  %71 = xor i32 %70, %69
  br label %for.inc.2

sw.case.4.i:                                      ; preds = %bounds.ok
  %72 = add i32 %.val, %acc.addr.042
  %73 = mul i32 %72, 9
  br label %for.inc.2

sw.case.5.i:                                      ; preds = %bounds.ok
  %74 = lshr i32 %acc.addr.042, 3
  %75 = mul i32 %.val, 11
  %76 = add i32 %75, %74
  br label %for.inc.2

sw.case.6.i:                                      ; preds = %bounds.ok
  %77 = shl i32 %.val, 2
  %78 = xor i32 %acc.addr.042, %77
  %79 = xor i32 %78, 85
  br label %for.inc.2

sw.case.7.i:                                      ; preds = %bounds.ok
  %80 = or i32 %.val, %acc.addr.042
  %81 = add i32 %80, 13
  br label %for.inc.2

sw.case.8.i:                                      ; preds = %bounds.ok
  %82 = and i32 %acc.addr.042, 65535
  %83 = mul nuw nsw i32 %82, 17
  %84 = add i32 %.val, %83
  br label %for.inc.2

sw.case.9.i:                                      ; preds = %bounds.ok
  %85 = add i32 %acc.addr.042, -19
  %86 = xor i32 %.val, %85
  br label %for.inc.2

sw.case.10.i:                                     ; preds = %bounds.ok
  %87 = mul i32 %acc.addr.042, 23
  %88 = and i32 %.val, 7
  %89 = sub i32 %87, %88
  br label %for.inc.2

sw.case.11.i:                                     ; preds = %bounds.ok
  %90 = lshr i32 %acc.addr.042, 5
  %91 = xor i32 %90, %acc.addr.042
  %92 = add i32 %.val, %91
  br label %for.inc.2

sw.default.i:                                     ; preds = %bounds.ok
  %93 = tail call i32 @llvm.fshl.i32(i32 %acc.addr.042, i32 %acc.addr.042, i32 3)
  %94 = add i32 %.val, %93
  br label %for.inc.2

for.inc.2:                                        ; preds = %sw.default.i, %sw.case.11.i, %sw.case.10.i, %sw.case.9.i, %sw.case.8.i, %sw.case.7.i, %sw.case.6.i, %sw.case.5.i, %sw.case.4.i, %sw.case.3.i, %sw.case.2.i, %sw.case.1.i, %sw.case.i, %for.body.2
  %acc.addr.1 = phi i32 [ %acc.addr.042, %for.body.2 ], [ %64, %sw.case.i ], [ %66, %sw.case.1.i ], [ %68, %sw.case.2.i ], [ %71, %sw.case.3.i ], [ %73, %sw.case.4.i ], [ %76, %sw.case.5.i ], [ %79, %sw.case.6.i ], [ %81, %sw.case.7.i ], [ %84, %sw.case.8.i ], [ %86, %sw.case.9.i ], [ %89, %sw.case.10.i ], [ %92, %sw.case.11.i ], [ %94, %sw.default.i ]
  %95 = add nuw nsw i32 %i.addr.043, 1
  %exitcond47.not = icmp eq i32 %95, 200000000
  br i1 %exitcond47.not, label %for.end.2, label %for.body.2
```

</details>

<details>
<summary><code>serial_aperiodic_k13_vtable</code>: <code>objdump -d</code> and the <code>-O3</code> IR</summary>

```asm
 2df:	mov    ebp,0xbebc200
 2e4:	mov    r14,QWORD PTR [rip+0x0]        # 2eb <nish_main+0x1eb>
 2eb:	mov    r15,QWORD PTR [rsp+0x70]
 2f0:	jmp    304 <nish_main+0x204>
 2f2:	data16 data16 data16 data16 cs nop WORD PTR [rax+rax*1+0x0]
 300:	dec    ebp
 302:	je     344 <nish_main+0x244>
 304:	mov    ecx,ebx
 306:	shl    ecx,0xd
 309:	xor    ecx,ebx
 30b:	mov    edx,ecx
 30d:	shr    edx,0x11
 310:	xor    edx,ecx
 312:	mov    ebx,edx
 314:	shl    ebx,0x5
 317:	xor    ebx,edx
 319:	mov    ecx,ebx
 31b:	shr    ecx,0x8
 31e:	imul   rdx,rcx,0x13b13b14
 325:	shr    rdx,0x20
 329:	lea    esi,[rdx+rdx*2]
 32c:	lea    edx,[rdx+rsi*4]
 32f:	sub    ecx,edx
 331:	cmp    ecx,r13d
 334:	jge    300 <nish_main+0x200>
 336:	mov    ecx,ecx
 338:	mov    rdi,QWORD PTR [r15+rcx*8]
 33c:	mov    esi,eax
 33e:	call   QWORD PTR [r14+rcx*8]
 342:	jmp    300 <nish_main+0x200>
 344:	mov    edi,eax
```

```llvm
for.end.1:                                        ; preds = %push.store.2
  %41 = trunc i64 %15 to i32
  br label %for.body.2

for.body.2:                                       ; preds = %for.end.1, %for.inc.2
  %s.addr.141 = phi i32 [ %26, %for.end.1 ], [ %47, %for.inc.2 ]
  %i.addr.040 = phi i32 [ 0, %for.end.1 ], [ %54, %for.inc.2 ]
  %acc.addr.039 = phi i32 [ 1, %for.end.1 ], [ %acc.addr.1, %for.inc.2 ]
  %42 = shl i32 %s.addr.141, 13
  %43 = xor i32 %42, %s.addr.141
  %44 = lshr i32 %43, 17
  %45 = xor i32 %44, %43
  %46 = shl i32 %45, 5
  %47 = xor i32 %46, %45
  %48 = lshr i32 %47, 8
  %49 = urem i32 %48, 13
  %50 = icmp slt i32 %49, %41
  br i1 %50, label %if.then, label %for.inc.2

if.then:                                          ; preds = %for.body.2
  %51 = zext nneg i32 %49 to i64
  %52 = getelementptr inbounds ptr, ptr %13, i64 %51
  %53 = load ptr, ptr %52, align 8, !tbaa !20, !alias.scope !17, !noalias !14
  %slot.i = getelementptr inbounds [16 x ptr], ptr @wp60_vt, i64 0, i64 %51
  %fp.i = load ptr, ptr %slot.i, align 8
  %r.i = tail call noundef i32 %fp.i(ptr nonnull %53, i32 %acc.addr.039) #5
  br label %for.inc.2

for.inc.2:                                        ; preds = %for.body.2, %if.then
  %acc.addr.1 = phi i32 [ %r.i, %if.then ], [ %acc.addr.039, %for.body.2 ]
  %54 = add nuw nsw i32 %i.addr.040, 1
  %exitcond43.not = icmp eq i32 %54, 200000000
  br i1 %exitcond43.not, label %for.end.2, label %for.body.2
```

</details>

The array periodic K=8 loops §3.4 compares, `switch` and `tp`:

<details>
<summary><code>array_periodic_k8_switch</code>: <code>objdump -d</code></summary>

```asm
 3f2:	cmp    edi,0x30d40
 3f8:	je     489 <nish_main+0x489>
 3fe:	xor    edx,edx
 400:	jmp    418 <nish_main+0x418>
 402:	lea    esi,[rsi+rsi*4]
 405:	shr    r8d,1
 408:	xor    r8d,esi
 40b:	mov    esi,r8d
 40e:	add    ecx,esi
 410:	inc    rdx
 413:	cmp    rbp,rdx
 416:	je     3f0 <nish_main+0x3f0>
 418:	cmp    rdx,rbp
 41b:	jge    410 <nish_main+0x410>
 41d:	mov    esi,edx
 41f:	add    esi,edi
 421:	jo     616 <nish_main+0x616>
 427:	mov    r8,QWORD PTR [r10+rdx*8]
 42b:	mov    r9d,DWORD PTR [r8]
 42e:	mov    r8d,DWORD PTR [r8+0x4]
 432:	cmp    r9,0x6
 436:	ja     45b <nish_main+0x45b>
 438:	movsxd r9,DWORD PTR [rax+r9*4]
 43c:	add    r9,rax
 43f:	notrack jmp r9
 443:	lea    esi,[rsi+rsi*2]
 446:	add    r8d,esi
 449:	jmp    40b <nish_main+0x40b>
 44b:	add    r8d,esi
 44e:	lea    esi,[r8+r8*8]
 452:	jmp    40e <nish_main+0x40e>
 454:	add    esi,esi
 456:	sub    esi,r8d
 459:	jmp    40e <nish_main+0x40e>
 45b:	or     r8d,esi
 45e:	add    r8d,0xd
 462:	jmp    40b <nish_main+0x40b>
 464:	xor    r8d,esi
 467:	add    r8d,0x7
 46b:	jmp    40b <nish_main+0x40b>
 46d:	shr    esi,0x3
 470:	lea    r9d,[r8+r8*4]
 474:	lea    r8d,[r8+r9*2]
 478:	add    esi,r8d
 47b:	jmp    40e <nish_main+0x40e>
 47d:	shl    r8d,0x2
 481:	xor    esi,r8d
 484:	xor    esi,0x55
 487:	jmp    40e <nish_main+0x40e>
 489:	mov    edi,ecx
```

</details>

<details>
<summary><code>array_periodic_k8_tp</code>: <code>objdump -d</code></summary>

```asm
 402:	cmp    edi,0x30d40
 408:	je     4ae <nish_main+0x4ae>
 40e:	xor    esi,esi
 410:	jmp    42a <nish_main+0x42a>
 412:	lea    r8d,[r8+r8*4]
 416:	shr    r9d,1
 419:	xor    r9d,r8d
 41c:	mov    r8d,r9d
 41f:	add    edx,r8d
 422:	inc    rsi
 425:	cmp    rbp,rsi
 428:	je     400 <nish_main+0x400>
 42a:	cmp    rsi,rbp
 42d:	jge    422 <nish_main+0x422>
 42f:	mov    r8d,esi
 432:	add    r8d,edi
 435:	jo     60a <nish_main+0x60a>
 43b:	mov    r10,QWORD PTR [r11+rsi*8]
 43f:	mov    r9,r10
 442:	and    r9,rax
 445:	shr    r10,0x30
 449:	mov    r9d,DWORD PTR [r9+0x4]
 44d:	dec    r10d
 450:	cmp    r10d,0x6
 454:	ja     47b <nish_main+0x47b>
 456:	movsxd r10,DWORD PTR [rcx+r10*4]
 45a:	add    r10,rcx
 45d:	notrack jmp r10
 461:	lea    r8d,[r8+r8*2]
 465:	add    r9d,r8d
 468:	jmp    41c <nish_main+0x41c>
 46a:	add    r9d,r8d
 46d:	lea    r8d,[r9+r9*8]
 471:	jmp    41f <nish_main+0x41f>
 473:	add    r8d,r8d
 476:	sub    r8d,r9d
 479:	jmp    41f <nish_main+0x41f>
 47b:	or     r9d,r8d
 47e:	add    r9d,0xd
 482:	jmp    41c <nish_main+0x41c>
 484:	xor    r9d,r8d
 487:	add    r9d,0x7
 48b:	jmp    41c <nish_main+0x41c>
 48d:	shr    r8d,0x3
 491:	lea    r10d,[r9+r9*4]
 495:	lea    r9d,[r9+r10*2]
 499:	add    r8d,r9d
 49c:	jmp    41f <nish_main+0x41f>
 49e:	shl    r9d,0x2
 4a2:	xor    r8d,r9d
 4a5:	xor    r8d,0x55
 4a9:	jmp    41f <nish_main+0x41f>
 4ae:	mov    edi,edx
```

</details>

### 12.10 Compile time and valgrind (`ctime.py`, `v/run.sh`)

`NISH=<checkout> python3 ctime.py 7`, run in `r/` after `r/gen.mjs`
wrote `src/` and `src/reg_hand_copy.ts` was copied from `src/reg_hand.ts`,
gives §3.5's compile, build and size columns:

```python
# ctime.py <rounds>: best-of-N and max-of-N wall time for the compile step
# (nish src -o ll) and the build step (scripts/build.sh --profile speed) of
# each registry form, interleaved; then the binary's stripped size.
import os, subprocess, sys, time
NISH = os.environ["NISH"]; R = int(sys.argv[1]); here = os.getcwd()
forms = ["reg_hand", "reg_table", "reg_proposed", "reg_hand_copy"]
res = {}
def t(cmd):
    t0 = time.perf_counter(); subprocess.run(cmd, check=True, cwd=NISH, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); return time.perf_counter() - t0
for r in range(R):
    for i in range(len(forms)):
        f = forms[(i + r) % len(forms)]
        c = t([f"{NISH}/build/nish", f"{here}/src/{f}.ts", "-o", f"{here}/ct_{f}.ll"])
        b = t(["bash", "scripts/build.sh", f"{here}/ct_{f}.ll", "runtime/runtime.c", "-o", f"{here}/ct_{f}", "--profile", "speed"])
        res.setdefault(f, []).append((c, b))
for f in forms:
    cs = [x[0] for x in res[f]]; bs = [x[1] for x in res[f]]
    print(f"{f}\tcompile best {min(cs)*1000:.0f} max {max(cs)*1000:.0f}\tbuild best {min(bs)*1000:.0f} max {max(bs)*1000:.0f}\tbytes {os.path.getsize(here + '/ct_' + f)}")
```

`bash v/run.sh` builds every §3.3 and §3.4 variant at a hundredth of its loop
length (`gen.mjs` reads `SERIAL` and `ROUNDS` from the environment in this
run), the twenty tagged-word variants of §3.4 (array and serial), the three
escape cases at `s` (rebuilt from `e/gen.mjs`) and the registry at 500,000
calls, and runs each under valgrind: `NISH=<checkout> bash v/run.sh` writes
one line per binary to `v/valgrind.txt`, 183 lines and `VDONE` (§4.4). The environment
variables change only the loop lengths; the timed programs used the defaults.

```sh
# v/run.sh: every §3.3/§3.4 variant at 1/100th of its loop (the serial and
# array tp variants included), the escape cases A, B and C at s, and the three
# registry forms at 500k calls, each under valgrind --error-exitcode=1
# --leak-check=full. One line per binary in valgrind.txt; 183 lines and VDONE.
# Needs NISH (the checkout with build/nish) and the sibling d/, e/ and r/
# directories for their generators; it builds every binary it runs.
set -u
: "${NISH:?set NISH to the nish checkout}"; export NISH
S=$(cd "$(dirname "$0")/.." && pwd); V=$S/v
cd $V; mkdir -p bin src rsrc esrc
cp $S/d/gen.mjs $S/d/mkvt.mjs $S/d/mkaos.mjs $S/d/mktp.mjs $S/d/wp60_vt.c $S/d/buildone.sh .
SERIAL=2000000 ROUNDS=2000 node gen.mjs src > /dev/null
aos=""; tp=""
for g in array_same array_periodic; do for k in 2 4 8 13 16; do aos="$aos ${g}_k$k"; done; done
for g in serial_same serial_periodic array_same array_periodic; do for k in 2 4 8 13 16; do tp="$tp ${g}_k$k"; done; done
node mkaos.mjs $aos
names="$(cat src/list.txt)"
for n in $aos; do names="$names ${n}_aos"; done
for n in $names; do $NISH/build/nish src/$n.ts -o ll_$n.ll 2> clog_$n.txt || echo "COMPILE FAIL $n"; done
for n in $(grep _proposed src/list.txt); do
  k=$(echo $n | sed 's/.*_k\([0-9]*\)_.*/\1/'); vt=${n%_proposed}_vtable
  node mkvt.mjs ll_$n.ll ll_$vt.ll $k; names="$names $vt"
done
node mktp.mjs $tp; for n in $tp; do names="$names ${n}_tp"; done
for n in $names; do bash buildone.sh $n || echo "BUILD FAIL $n"; done
CALLS=500000 node $S/r/gen.mjs rsrc > /dev/null
for f in hand table proposed; do
  $NISH/build/nish rsrc/reg_$f.ts -o ll_reg_$f.ll && bash buildone.sh reg_$f || echo "BUILD FAIL reg_$f"; names="$names reg_$f"
done
node $S/e/gen.mjs esrc > /dev/null
for e in A B C; do
  $NISH/build/nish esrc/esc_${e}_s.ts -o ll_esc_${e}_s.ll && bash buildone.sh esc_${e}_s || echo "BUILD FAIL esc_${e}_s"; names="$names esc_${e}_s"
done
: > valgrind.txt
for n in $names; do
  valgrind --error-exitcode=1 --leak-check=full --log-file=vlog_$n.txt bin/$n > out_$n.txt
  st=$?
  inuse=$(grep -o "in use at exit: [0-9,]* bytes" vlog_$n.txt | head -1)
  errs=$(grep -o "ERROR SUMMARY: [0-9,]* errors" vlog_$n.txt)
  echo "$n	exit $st	$inuse	$errs	$(cat out_$n.txt | tr '\n' ' ')" >> valgrind.txt
done
echo VDONE >> valgrind.txt
```

### 12.11 Stage 2's surface (`s2/gen.mjs`, `s2/genreg.mjs`)

§3.6's programs, in `s2/`. `node gen.mjs src` writes the 30 strategy,
periodic and aperiodic programs and `src/groups.json`; `node genreg.mjs src`
writes `reg2_hand.ts` and `reg2_surface.ts`; `reg2_hand_copy.ts` is a `cp` of
`reg2_hand.ts`. `groups.json` (in `s2/`) is the generated one with a `reg2`
group added by hand: `empty`, `reg2_hand`, `reg2_surface`, `reg2_hand_copy`.
`build.sh` compiles and builds every program, `asm/` holds the `clang -O3 -c`
objects read with `objdump -d -M intel` and §12.9's `hot.py`, and the timing
is `python3 bench.py groups.json 7`, from `s2/`, into `timing.txt`.

```js
// WP60 round 3: the register form in shapes stage 2 can write (no stored Dyn).
// Usage: node gen.mjs <outdir>. Every Dyn is made where its class is known:
// K objects in locals c0..c{K-1}, one chosen by a switch on a plain i32, which
// is what a stage 2 program writes to pick one of K implementations.
//   hand    : the object's own `kind` field and the hand switch (`call(o, x)`)
//   surface : the lowering of `let o: Dyn<Base>` assigned in the arms of the
//             selecting switch: each arm writes the constant tag and the
//             pointer (two locals), and the call is `d(tag, o, x)`
// Shapes (serial, 200M calls):
//   strategy : the object is chosen once from a runtime value, then called in
//              a loop (a strategy, a visitor passed down)
//   periodic : chosen per call from a stored plain i32[] of 1024 kinds
//              (the user's own data, not a Dyn), period 1024
//   aperiodic: chosen per call from a fresh xorshift value
import { writeFileSync, mkdirSync } from "node:fs"
const out = process.argv[2]
mkdirSync(out, { recursive: true })
const BODIES = [
  "x * 3 + A", "(x ^ A) + 7", "(x << 1) - A", "(x * 5) ^ (A >>> 1)",
  "(x + A) * 9", "(x >>> 3) + A * 11", "(x ^ (A << 2)) ^ 85", "(x | A) + 13",
  "(x & 65535) * 17 + A", "(x - 19) ^ A", "x * 23 - (A & 7)", "((x >>> 5) ^ x) + A",
  "(x << 3) + (x >>> 29) + A", "((x * 29) ^ (x >>> 7)) ^ A", "(x + 31) ^ (A << 1)", "((x ^ 40503) * 37) + A",
]
const SERIAL = Number(process.env.SERIAL ?? 200000000)
const KS = [2, 4, 8, 13, 16]
const SHAPES = ["strategy", "periodic", "aperiodic"]
function program(shape, k, v) {
  let s = "interface Base { kind: i32; a: u32 }\n"
  s += "class Obj implements Base {\n  kind: i32\n  a: u32\n  constructor(k: i32, a: u32) { this.kind = k; this.a = a }\n}\n"
  for (let i = 0; i < k; i++) s += `function g${i}(o: Base, x: u32): u32 { return ${BODIES[i].replaceAll("A", "o.a")} }\n`
  const arms = (subj) => {
    let a = `  switch (${subj}) {\n`
    for (let i = 0; i < k - 1; i++) a += `    case ${i}: return g${i}(o, x)\n`
    return a + `    default: return g${k - 1}(o, x)\n  }\n`
  }
  if (v === "hand") s += `function call(o: Base, x: u32): u32 {\n${arms("o.kind")}}\n`
  else s += `function d(t: i32, o: Base, x: u32): u32 {\n${arms("t")}}\n`
  s += "export const main = (): void => {\n"
  for (let i = 0; i < k; i++) s += `  const c${i}: Base = new Obj(${i}, ${i * 7 + 1})\n`
  s += "  const kinds: i32[] = []\n  let s: u32 = 2463534242\n"
  s += "  for (let j = 0; j < 1024; j++) {\n    s = s ^ (s << 13)\n    s = s ^ (s >>> 17)\n    s = s ^ (s << 5)\n"
  s += `    kinds.push(toI32((s >>> 8) % ${k}))\n  }\n`
  // select(subj, indent): leaves the chosen object in `o` (and its tag in `tg` for surface)
  const select = (subj, ind) => {
    let a = `${ind}let o: Base = c${k - 1}\n`
    if (v === "surface") a += `${ind}let tg: i32 = ${k - 1}\n`
    a += `${ind}switch (${subj}) {\n`
    for (let i = 0; i < k - 1; i++) a += `${ind}  case ${i}: o = c${i}${v === "surface" ? `; tg = ${i}` : ""}; break\n`
    return a + `${ind}  default: break\n${ind}}\n`
  }
  const call = v === "hand" ? "call(o, acc)" : "d(tg, o, acc)"
  s += "  let acc: u32 = 1\n"
  if (shape === "strategy") {
    s += "  s = s ^ (s << 13)\n  s = s ^ (s >>> 17)\n  s = s ^ (s << 5)\n"
    s += select(`toI32((s >>> 8) % ${k})`, "  ")
    s += `  for (let i = 0; i < ${SERIAL}; i++) { acc = ${call} }\n`
  } else {
    s += `  for (let i = 0; i < ${SERIAL}; i++) {\n`
    if (shape === "aperiodic") {
      s += "    s = s ^ (s << 13)\n    s = s ^ (s >>> 17)\n    s = s ^ (s << 5)\n"
      s += select(`toI32((s >>> 8) % ${k})`, "    ")
    } else {
      s += "    const j = i & 1023\n    let t: i32 = 0\n    if (j < kinds.length) { t = kinds[j] }\n"
      s += select("t", "    ")
    }
    s += `    acc = ${call}\n  }\n`
  }
  s += "  console.log(`${acc}`)\n}\n"
  return s
}
const groups = {}
for (const sh of SHAPES) {
  const names = []
  for (const k of KS) for (const v of ["hand", "surface"]) {
    const n = `s2_${sh}_k${k}_${v}`
    writeFileSync(`${out}/${n}.ts`, program(sh, k, v)); names.push(n)
  }
  groups[sh] = names
}
writeFileSync(`${out}/groups.json`, JSON.stringify(groups))
console.log(Object.values(groups).flat().length)
```

```js
// WP60 round 3: the registry (13 classes x 4 hooks, 50M hook calls) on stage 2's
// surface: the 13 plugins in locals, a stored plain i32[] of 1024 kinds (the
// program's own data), one plugin chosen per round by a switch on the kind,
// then its 4 hooks called. hand: hooks switch on p.kind; surface: the chosen
// tag and pointer, hooks switch on the tag. Usage: node genreg.mjs <outdir>
import { writeFileSync, mkdirSync } from "node:fs"
const out = process.argv[2]
mkdirSync(out, { recursive: true })
const OPS = ["x * 3 + A", "(x ^ A) + 7", "(x << 1) - A", "(x * 5) ^ (A >>> 1)", "(x + A) * 9", "(x >>> 3) + A * 11",
  "(x ^ (A << 2)) ^ 85", "(x | A) + 13", "(x & 65535) * 17 + A", "(x - 19) ^ A", "x * 23 - (A & 7)", "((x >>> 5) ^ x) + A",
  "(x << 3) + (x >>> 29) + A", "((x * 29) ^ (x >>> 7)) ^ A", "(x + 31) ^ (A << 1)", "((x ^ 40503) * 37) + A"]
const K = 13, H = 4, CALLS = 50000000
const body = (k, h) => `(${OPS[(k + h * 5) % 16].replaceAll("A", "p.a")}) + ${h * 13 + k}`
function program(form) {
  const sur = form === "surface"
  let s = "interface Plugin { kind: i32; a: u32 }\n"
  s += "class Impl implements Plugin {\n  kind: i32\n  a: u32\n  constructor(k: i32, a: u32) { this.kind = k; this.a = a }\n}\n"
  for (let h = 0; h < H; h++) for (let k = 0; k < K; k++) s += `function p${k}_h${h}(p: Plugin, x: u32): u32 { return ${body(k, h)} }\n`
  for (let h = 0; h < H; h++) {
    s += sur ? `function hook${h}(t: i32, p: Plugin, x: u32): u32 {\n  switch (t) {\n` : `function hook${h}(p: Plugin, x: u32): u32 {\n  switch (p.kind) {\n`
    for (let k = 0; k < K - 1; k++) s += `    case ${k}: return p${k}_h${h}(p, x)\n`
    s += `    default: return p${K - 1}_h${h}(p, x)\n  }\n}\n`
  }
  s += "export const main = (): void => {\n"
  for (let k = 0; k < K; k++) s += `  const c${k}: Plugin = new Impl(${k}, ${k * 7 + 1})\n`
  s += "  const kinds: i32[] = []\n  let s: u32 = 2463534242\n"
  s += "  for (let j = 0; j < 1024; j++) {\n    s = s ^ (s << 13)\n    s = s ^ (s >>> 17)\n    s = s ^ (s << 5)\n"
  s += `    kinds.push(toI32((s >>> 8) % ${K}))\n  }\n`
  s += `  let acc: u32 = 1\n  for (let i = 0; i < ${CALLS / H}; i++) {\n    const j = i & 1023\n    let t: i32 = 0\n    if (j < kinds.length) { t = kinds[j] }\n`
  s += `    let p: Plugin = c${K - 1}\n` + (sur ? `    let tg: i32 = ${K - 1}\n` : "") + "    switch (t) {\n"
  for (let k = 0; k < K - 1; k++) s += `      case ${k}: p = c${k}${sur ? `; tg = ${k}` : ""}; break\n`
  s += "      default: break\n    }\n"
  for (let h = 0; h < H; h++) s += `    acc = ${sur ? `hook${h}(tg, p, acc)` : `hook${h}(p, acc)`}\n`
  s += "  }\n  console.log(`${acc}`)\n}\n"
  return s
}
for (const f of ["hand", "surface"]) writeFileSync(`${out}/reg2_${f}.ts`, program(f))
```

```sh
#!/bin/bash
# build.sh: every src/*.ts -> ll_<name>.ll (build/nish) -> bin/<name>; run from s2/
set -e
cd "$(dirname "$0")"
for f in src/*.ts; do n=$(basename $f .ts); "$NISH/build/nish" $f -o ll_$n.ll >/dev/null; NISH=$NISH ./buildone.sh $n; done
echo built
```
