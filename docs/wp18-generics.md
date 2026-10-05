# WP18: Generics by monomorphisation

**Status: closed.** Generic functions landed in 0.2.0 (#50), generic classes
and interfaces in 0.3.0, whole-program instantiation in 0.4.0 (#111),
constraints in 0.8.0 (#157), and the peripheries and generic methods in 0.9.0
(#163, #164, #165, #168). §15 records what shipped and where it differs from
this design. §16 lists what stays deferred, each item with the trigger that
would bring it back. The normative rules are in [LANGUAGE.md](LANGUAGE.md)
("Generic functions", "Generic classes and interfaces", "Generic methods"), and
the lowerings are in [IR_COOKBOOK.md](IR_COOKBOOK.md) ("A generic function", "A
generic class", "A generic method").

The language supports `function identity<T>(x: T): T`, `class Box<T>`,
`interface Pair<A, B>` and `<T extends Shape>`. Every instantiation is compiled
to its own specialised code under a mangled symbol, and is indistinguishable
from the monomorphic version somebody would have written by hand. There is no
boxing, no type dictionary, no runtime type information, and no generic code in
the binary.

**Why at all.** Nish is a static subset of TypeScript, and TypeScript has
generics. A subset that refused `<T>` would make the most ordinary container
unwritable.

**Why monomorphisation.** The memory model leaves nothing else
([wp15-performance.md](wp15-performance.md) §1a). There is no GC, a class is a C
struct, and a layout is fixed at compile time. Erasure would make every `T` a
pointer: `Box<i32>` would hold an `i32*`, and no arithmetic on a `T` would be
possible. Dictionary passing would put an indirect call on every constrained
operation, which defeats the whole-program purity, termination and escape
analyses for the same reason function values are forbidden.

**`src/` implements generics and does not use them** (§10).

---

## 1. The decision, and the one it is not

| | |
| --- | --- |
| **Lowering** | One `define` per (template, type-argument tuple), and one `%struct` per instantiated class or interface. |
| **Discovery** | Whole-program, on a FIFO worklist owned by the `Compilation`. |
| **Definition** | One, in the module that declares the template. Other modules `declare` it. Never `linkonce_odr`. |
| **Inference** | From the argument types at a call site. Type arguments are written only in an annotation and after `new`. |
| **Termination** | A static rule against type-argument growth, plus a cap as a backstop (§4). |
| **`Result<T, E>` and `Array<T>`** | Stay built-in (§6.1). |
| **Discriminated unions** | Deferred (§7). |

The decision this is *not* is wp15 §5's hope that `Result<T, E>` would "fall
out as ordinary library code" and that typed containers would retire
`src/map.ts`'s `StringMap`. §6.1 and §10 say why neither happened.

---

## 2. The surface: what is written

Type parameters are accepted on a function (either spelling), a class and an
interface, and with §15.8, on a method. A constraint is written
`<T extends Shape>`. **Every existing type rule applies to a type argument
unchanged.** A type parameter is not a hole through which something the
language refuses can be smuggled in: `Box<i32 | null>`, `Box<void>` and
`Result<T, void>` at `E = void` are all refused, as their monomorphic spellings
are.

The following are not accepted, each for a reason:

- **Default type parameters** (`<T = string>`). Nothing in the language needs
  them.
- **Generic type aliases** (`reject_type_alias_generic`). An alias only renames
  a type that already exists.
- **`class C<T> extends T`.** This is moot, because WP25 removed `extends` from
  the language.
- **Type parameters on a constructor.** A constructor's type arguments are its
  class's, written after `new`.
- **Variance annotations, `keyof`, mapped and conditional types, `infer`.**
  These are type-level computation and have no lowering.

### 2a. Inference, and why there are no type arguments at a call site

**A generic function's type arguments are inferred from its arguments, and
writing them at a call site is a compile error.** The reason is the parser.
`src/parser.ts` has one token of lookahead and no backtracking, and to it
`f<i32>(x)` is `(f < i32) > (x)`, a comparison. Telling the two apart would need
a speculative parse with a restartable lexer and a saved parser cursor. That is
a large change to the most carefully tested part of the port, for a spelling
inference already covers. The two positions where a type argument *is*
unambiguous, an annotation (`Box<Box<i32>>`, with `>>` split by
`expectTypeArgumentEnd`) and after `new`, are exactly the two the parser already
read. The checker recognises the call-site shape and names the rule.

Inference unifies each parameter's annotation *shape* against the argument's
type, left to right, and the first binding wins (`T` against `i32`, `T[]`
against `i32[]`, `Result<T, E>` against a `Result`). A parameter that is
already bound must match exactly. There is no subtyping, no least upper bound,
and no fixpoint.

**A type parameter that appears in no parameter is an error at the
declaration.** Inferring it from the contextual type, as `Ok(...)` and `[]` do,
would be a second mechanism with its own precedence. It is deferred (§16).

---

## 3. Monomorphisation: where an instantiation comes from and where it goes

### 3a. The instantiation set and the worklist

An instantiation is requested in pass 1 (an annotation such as `Box<i32>` in a
signature or a field) and in pass 2 (a call to a template, or a `new`). The set
lives on the `Compilation`, keyed by mangled symbol, and is drained to a fixed
point after pass 2. **A template's body is never checked as a template.** Only
instantiations are checked, each with its parameters bound to concrete types,
so no rule below the signature level ever sees a type variable. Order is part
of the contract: requests are made in module-load order and then source order,
the worklist is FIFO, and the map is insertion-ordered. `--emit-checked` prints
the set in that order.

### 3b. One definition, in the defining module

An instantiation is **defined once, in the module that declares its template**,
and every other module `declare`s it. It is checked by that module's checker,
in that module's scope, so the body means the same thing whoever asked for it.
The alternative, a copy in every user with `linkonce_odr`, was rejected for four
reasons:

- The compiler already sees the whole program, so the linker has no job to do.
- `linkonce_odr` is never `internal`, so it would defeat `--strict-exports`.
- `FunctionFacts`, `rejectSymbolClashes` and `--emit-header` all assume one
  `define` per symbol.
- Identical folded copies would be a guarantee to maintain for no gain.

An instantiation gets its template's linkage: `internal` when the template is
not exported, and external otherwise. The IR a module emits now depends on what
other modules asked for, as it already did through `closeReachableStructs`.

### 3c. The mangling

**The instance name is the template's name, then `$` and the `mangleType` of
each type argument in order.**

```
Box<i32>           %struct.Box$i32          identity<i32>      @identity$i32
Box<Point>         %struct.Box$$Point       Box<i32>.get       @Box$i32.get
Box<i32[]>         %struct.Box$arr.i32      Holder.pick<i32>   @Holder.pick$i32
Pair<i32, string>  %struct.Pair$i32$str     Box<i32>.pair<str> @Box$i32.pair$str
```

Each argument is prefix-coded, and `readonly T[]` got its own tag (`roarr.`), so
the encoding is injective once **`$` is refused in the name of a declared
class, interface, function or method**. Without that rule, a class named
`Box$i32` would collide with `Box<i32>`. An instantiated class is an ordinary
struct (`{ kind: "struct", name: "Box$i32" }`), not a new type kind. Layout,
`sameType`, `implements`, DWARF and the C header therefore needed no change,
and that is the single largest reason the package was affordable. The host
spelling is covered in §15.7.

### 3d. One AST, N type assignments

The checker's answers are tables keyed by AST node, and `identity`'s `return x;`
is one node with two types. Cloning the AST per instantiation was rejected,
because it would lose source positions and break the dense node-id sizing of
the side tables. The design proposed an overlay behind accessors. What shipped
is cheaper and has the same effect (§15.1): each instantiation owns a copy of
the tables, and they are swapped in around one body walk.

---

## 4. Termination

Whether a polymorphically recursive program has finitely many instantiations is
undecidable in general. Rust and C++ answer with a depth limit, and the message
is about a number. Here the answer is a rule, with a cap behind it.

### The rule: no expanding edge on a cycle

A request whose type argument is a bare parameter passes the caller's tuple on.
A **ground** argument (`i32`, `Box<i32>`) names one fixed instantiation. Neither
can grow the set. Only a **constructor applied to a parameter** (`T[]`,
`Box<T>`, `T | null`) builds a strictly larger type, and only that is refused
when it closes a cycle. A self-edge counts as a cycle.

**Soundness.** Unification only *selects* subterms of types the program wrote.
On a legal cycle every argument is either copied from the entry tuple or
written in the source, so every tuple lies in `S^arity`, where `S` is the finite
set of written subterms, and the worklist drains. **Completeness, in the sense
that matters.** Parameter-propagating recursion (`sumTree(node.left)`) and
ground recursion (`countDown(1, n - 1)` inside `countDown<T>`, two
instantiations in total) are both accepted. `grow([x], n - 1)` is refused: it
asks for `grow<T[]>`, and inference produced that expansion with no type
argument in the source. The rule is therefore stated over what the checker
resolved, not over the syntax.

As built (§15.1), the rule is checked on the request chain rather than on a
template graph, and the message names the concrete chain:
`` `grow<i32>` asks for `grow<i32[]>` ``.

### 4a. The recovery: what a refused request answers with

**One diagnostic per mistake.** A refused *field* type (`inner: Nest<T[]>`) is
answered with the instantiation it grew from (`Nest<i32>`). The class therefore
keeps its field and its layout, nothing downstream invents a second error, and
an unrelated mistake below the refusal is still reported
(`reject_generic_expanding_field_recovered`, `…_twice`). A refused request from
an *expression* (a `new` in a method body, or any generic-function call) has no
layout to preserve. It throws, and the statement ends with one diagnostic
(`reject_generic_expanding_field_method`). An empty `currentInstance` while
`currentStructInstance` is set is what tells the two cases apart (#91).

### The backstop: a cap

A program can ask for an absurd number of instantiations without any cycle, and
a bug in the rule must produce a diagnostic, not a hang. A per-template cap and
a program-wide cap are refused with a message that says it is a compiler limit,
not a language rule.

---

## 5. The worked lowering

The acceptance test of the whole package is mechanical: **an instantiation's IR
is byte-identical to its hand-written monomorphic twin, modulo the symbol
name.** `tests/run.js` compiles both and compares the two `define` blocks.
`gen_identity.ll` is `str_param_passthrough.ll` with the symbol renamed.

### `identity<T>`

`identity$i32` is `ret i32 %x`. `identity$str` lacks `nocapture` on `%x` because
returning the pointer is an escape, exactly as the hand-written function's
parameter does.

### Purity is per instantiation

`eq$i32` is `readnone`, and `eq$str`, which calls `nish_str_eq`, is `readonly`.
No machinery was added for this: `FunctionFacts` is keyed by symbol, so a
per-instantiation symbol gives per-instantiation facts.

### `Box<T>`

`%struct.Box$i32 = type { i32 }` and `%struct.Box$str = type { i8* }`, with a
constructor and getter each. They are `cls_point.ll` with the names changed, and
WP6 stack-allocates both boxes in the caller. `gen_stack` pins one source line
that is an alloca at one instantiation and an arena bump at another.

---

## 6. Every existing feature, as a rule

### 6.1 `Result<T, E>` and `Array<T>` stay built-in

**Neither becomes an ordinary generic.**

`Array<T>` cannot be one. It is not a struct but a runtime header
`{ i64 len, i64 cap, i8* data }` with an untyped payload, an element stride
computed from the element type, a bounds check branching to a cold panic,
`push` with a reallocating grow, `join`, `for...of`, and typed-array aliases
that let a Node host pass an `Int32Array` straight across. Writing it as
library code would need a `void*`, a cast and pointer arithmetic: three things
the language does not have and should not gain to express one type.

`Result<T, E>` could be *shaped* like one and still could not be one. Its
`state` is a checker-only refinement that `sameType` ignores. `isOk()`,
`isErr()` and `.ok` narrow through the registry in the checker. `orReturn()`
returns early from the enclosing function. A `Result` may not be dropped. WP17
gave it a packed register ABI with C, N-API and wasm bridges. A library type
would need trait bounds, a postfix propagation operator and a way to declare an
ABI, which is a larger package than this one.

The cost of keeping both built-in: `mangleType` keeps its `res.` and `arr.`
constructor tags beside the instantiated-struct names, so the compiler has two
spellings of "a type applied to arguments", and a reader has to know which is
which. That is the price of not designing a trait system. What generics do give
them is that `Box<Result<i32, string>>` and `Box<i32[]>` work with no special
case, because a type argument is just a type.

### 6.2 `extends`

Moot. WP25 removed class inheritance after this note was written, so `extends`
is refused on every class, generic or not.

### 6.3 `implements`

The design checked `implements` once, at the template. As built, it is checked
per instantiation (§15.4), against the instantiated interface by the ordinary
field-prefix rule.

### 6.4 The escape analysis and stack allocation (WP6)

Nothing changed. `EscapeResult` and `FunctionFacts` are per symbol, so one
instantiation can stack-allocate where another bumps the arena (`gen_stack`).

### 6.5 Constraints, and where they are checked

`<T extends Shape>`, where `Shape` is a declared class or interface. Member
access on a constrained parameter is judged against `Shape`. Satisfaction is
checked at each request, on the concrete argument. A constrained body is still
monomorphised: at `T = Circle` it calls `@Circle.area` statically, with no
vtable. §15.6 has how this was built.

### 6.6 The attribute fixpoint

Facts are computed per instantiation, for free. Instantiations are appended to
the defining module's `program.functions` before analysis. One that went missing
would reach `factsFor` with no facts, which is an internal error rather than a
wrong attribute. That is the right failure mode.

### 6.7 `-g` and DWARF

The display name is the source spelling (`identity<i32>`, `Box<i32>`), and the
linkage name is the mangled symbol, as clang does for a C++ template. `line:`
points at the template, so a breakpoint inside a generic body has N addresses.
This is `src/debug.ts` and `tests/cases/dbg_generic`. The debug type cache is
keyed on the mangled name.

### 6.8 Interop: `--emit-header`, `--emit-dts`, `--emit-napi`

Each instantiation is exported, and an exported generic that the program never
instantiates is refused when a sidecar is requested (§8 message 9). Refusing to
export generics at all was rejected, because it would make a container library
unexportable. The names changed from the design (§15.7).

---

## 7. Discriminated unions: deferred, with the coupling dissolved

wp15 §9 item 8 paired generics with discriminated unions and `Result`. They are
three lines of work, and two were walked separately: WP16 and WP17 shipped
`Result` as a built-in, so generics no longer need unions and unions no longer
need generics. A follow-on note has four things to decide:

- **Representation:** a tag word plus a payload sized and aligned to the
  largest arm.
- **Narrowing on a field:** this is the first narrowing keyed on a field, and a
  real extension of the soundness argument.
- **Exhaustive `switch`:** a missing arm is an error.
- **The interop, escape and `-g` stories** for a union payload.

The mangling has room for a union tag, and §4's rule applies to arm types as it
does to fields.

---

## 8. Diagnostics

Each message names the offending thing in backticks, then a `;` and the fix.
`tests/wordings/` pins the sentences byte for byte.

1. **Unsatisfied constraint** (NL2328): the argument does not implement the
   bound. Reported at the request site.
2. **Wrong arity:** `` `Pair` needs exactly 2 type arguments ``.
3. **Uninferable type parameter:** `` Cannot infer `T` for `empty` ``. Give it a
   parameter that mentions `T`.
4. **Type arguments at a call site:** `T` is inferred, so write `identity(x)`.
5. **Non-terminating monomorphisation:** names the concrete chain and offers
   both accepted shapes. The field form is NL2319.
6. **Instantiation cap:** says it is this compiler's limit, not a rule.
7. **`$` in a declared name:** `$` separates a generic's name from its
   arguments.
8. **Member access on an unconstrained parameter:** add `<T extends …>`.
9. **An exported generic with no instantiation, when a sidecar is requested**
   (NL4007).
10. **`extends` a bare type parameter:** moot since WP25.

Rules added during the build include NL2302 (a duplicate type parameter), NL2325
(type arguments on an imported non-template), NL2326 and NL2327 (what a
constraint may name), NL2331 (a method type parameter shadowing its class's) and
NL4008 (a C-name clash).

---

## 9. Performance, under wp15 §1

**The speed claim is an equality:** an instantiation is byte-identical to the
hand-written version, so there is nothing to benchmark. If the equality ever
breaks, that is a bug, which is why `tests/run.js` checks it structurally rather
than with a benchmark. **The size cost is real:** one body per distinct tuple.
Two things bound it. `--strict-exports` makes unused instantiations
dead-strippable, and only requested tuples are ever made. §15.3 has the
measurement.

---

## 10. Nish-0 does not adopt them

`src/` implements generics and is not written with them. `src/nodes.ts` keeps
its one `Node` class, `src/types.ts` its interned ids, and `src/map.ts` its
hand-written `StringMap`. There were four reasons when generics landed:

1. Rewriting `src/` in the package that introduced generics would have put the
   bootstrap's fixed point and the feature under test at the same time.
   Keeping `src/` monomorphic made the bootstrap a *control*.
2. wp14 §2.2's "no generics" was about sequencing the port, not a permanent
   ban.
3. Nish-0 did not grow, so wp14 §6 rule 5 did not fire.
4. An unchanged `src/` compiling to byte-identical IR is the strongest test that
   generics cost nothing when unused.

The rolling freeze now permits `src/` to use generics, since they have shipped
in a release, but nothing has adopted them. Moving `src/map.ts` to `Map<K, V>`
would change the IR of every module, so it would be a package with its own
note, not a cleanup (§14 question 8).

---

## 11. The plan

*Historical.* The design planned eight milestones, each landing in both stage0
and stage1. WP19 R6 later deleted stage0.

| | Planned | What happened |
| --- | --- | --- |
| G1 | Side tables behind accessors | Not needed: tables are swapped instead (§15.1) |
| G2–G4 | Template surface, generic functions, termination | Merged into one change, 0.2.0 (#50) |
| G5 | Generic classes and interfaces | 0.3.0 (§15.4) |
| G6 | Constraints | 0.8.0, #157 (§15.6) |
| G7 | Whole-program instantiation | 0.4.0, #111 (§15.5) |
| G8 | `-g`, interop sidecars, fuzzer, docs | 0.9.0, #163–#169 (§15.7) |

The one ordering constraint was that **G4 could not come later than G3**: the
moment generic functions existed, a program could make the compiler allocate
until it died.

---

## 12. The test obligation

The goldens are `tests/cases/gen_*`, each with a native round trip, and the
negatives are `tests/cases/reject_generic_*`, one per rule. Alongside them are
the byte-identity check against a hand-written twin in `tests/run.js`, the
`tests/link/generic_*` programs (one `define` across the program, `declare`s
elsewhere), the instantiated layouts in `tests/layout/structs.c`, and
`dbg_generic`. The stage0-versus-stage1 oracles the plan listed went with stage0
([wp19-stage0-retirement.md](wp19-stage0-retirement.md)). The fuzzer now
compares the seed with HEAD on generated generics (§15.7). The Node-side
differential rewrite, which needs one JavaScript function per instantiation, is
deferred (§16).

---

## 13. What is deliberately *not* being added

- Type arguments at a call site, and contextual-return inference (§16).
- Default type parameters, generic type aliases, variance annotations, and
  `keyof`/mapped/conditional types/`infer`.
- Retiring `Result<T, E>` and `Array<T>` into library code (§6.1).
- Discriminated unions (§7).
- Trait bounds. `<T extends Shape>` means a class or interface with `Shape`'s
  layout, because that is what `implements` means here. A bound saying "any
  type with a method `compare`" would be a trait system. Multiple and
  F-bounded constraints are out too.
- Generics in Nish-0 (§10).

---

## 14. Open questions

The questions the design asked, with their answers:

1. **Contextual-return inference.** Deferred, with a trigger (§16 item 1).
2. **Explicit type arguments at a call site.** Deferred, with a trigger (§16
   item 2).
3. **The instantiation caps.** A per-template cap and a program-wide cap ship
   as compiler limits.
4. **C-name collisions.** Answered in §15.4 and §15.7. Every instantiation is
   `nish_gen_<collapse>` in C, and only the pre-existing `Point.shifted` /
   `Point_shifted` clash is refused (NL4008).
5. **Should `--emit-dts` also declare the generic signature?** No (§15.7). The
   loader has no `identity` to return.
6. **The node-id span for the overlay.** Moot, because tables are swapped
   (§15.1).
7. **Generic methods.** Added (§15.8).
8. **Should `src/map.ts` become `Map<K, V>`?** Still open. It would be a package
   of its own, gated on the fixed point (§10).
9. **One template graph or one per module?** Moot: there is no graph, because
   the rule is checked on the request chain (§15.1).

---

## 15. What landed

Generic functions (G2–G4 merged), then classes and interfaces (G5),
whole-program instantiation (G7), constraints (G6), the peripheries (G8) and
generic methods, each in the release given in the status line. The acceptance
test of §5 is checked rather than asserted. The bootstrap reached its fixed
point over an unchanged `src/` at every step (56 modules and 7,617,344 bytes of
IR when generic functions landed).

### 15.1 Four decisions the code made differently

- **Tables are swapped, not accessed through accessors.**
  `CheckedProgram.enterInstance` and `leaveInstance` in `src/program.ts` point
  the node-keyed table fields at the instantiation's copies for one body walk.
  Five walkers bracket a body this way: the checker, escape analysis, the
  attribute fixpoint, the emitter, and the `--emit-checked` dump. No read site
  changed. Only one set of tables is ever installed at a time, because the
  worklist is drained in a loop, not by recursion.
- **A type parameter is never a type.** A template's annotations stay as syntax,
  and each instantiation resolves them with `T` bound in `ctx.typeBindings`.
  Nothing was added to `StaticType` or the `TypeTable`, which is most of why the
  change is small. The same reason explains why inference unifies annotation
  shapes.
- **Termination is checked on the request chain, not on a template graph.** An
  instantiation that asks for one of the same template whose argument strictly
  contains its own is refused, and the message names the concrete chain. A
  non-terminating generic that is never called is not refused, because nothing
  is instantiated.
- **`readonly T[]` mangles as `roarr.`**, so `identity<readonly i32[]>` and
  `identity<i32[]>` get different symbols.

### 15.2 What is refused, and with what

These refusals stand: a generic type alias, a generic `main`, a default type
argument, type parameters on a constructor, and a duplicate type parameter
(NL2302). Type arguments at a call site and an uninferable type parameter stay
refused by design (§16). The "not yet" refusals that generic functions first
shipped with were lifted by G5, G6, G7 and §15.8. Three of those old cases now
pin something else: `reject_generic_class` pins a template written without its
arguments, `reject_generic_method` pins type arguments at a method call, and
`reject_generic_constraint` pins what a constraint may not name.
`docs/LANGUAGE.md` has the current list.

### 15.3 The cost, measured

`.text` at `--profile size` for one template instantiated at 1, 2, 4 and 8 type
arguments was **732, 908, 1,860 and 2,985 bytes**. Read it as a shape, not a
slope, because printing different types lowers differently. The marginal cost
of an instantiation *is* the cost of the function somebody would have written.
A program that instantiates nothing allocates no tables and pays nothing.

### 15.4 G5, and the four decisions *it* made differently

- **`extends` is moot.** WP25 removed inheritance. A prefix-checked
  `implements` works on an instantiation as on any class (`gen_implements`).
- **`implements` is checked per instantiation**, because there is no type
  variable to compare at the template. The cost is one message per
  instantiation. The benefit is that the interface may itself be an
  instantiation.
- **The struct half of termination is a request chain too.**
  `currentStructInstance` and `expandingStructAncestor` mirror the function
  side. `containsType` reads an instantiated struct's type arguments back from
  its instantiation, so `grow<Box<T>>` is seen as growth.
- **Instantiated names are program-wide.** Two modules that each declare a
  private `Holder<T>` and instantiate it at `i32` would have produced one symbol
  with two layouts. That is refused after the worklist drains
  (`tests/link/generic_class_clash`, `package_generic_class_clash`). The C
  struct name is `nish_gen_` plus the collapsed mangling, with a user `_`
  escaped to `_0`, so it is injective and `-pedantic`-clean
  (`gen_export_header`).

### 15.5 G7, and the five things it had to decide

- **The request crosses a module boundary, and the work does not.** An
  instantiation is checked in the template's home module. Only the *site*
  travels, so that refusals are reported where the request was written.
- **Symbols are minted from `template.home.symbolPrefix`**, so the answer is
  right whoever asks (`tests/link/package_generic_import`: one
  `@pkg_lib.pick$i32` for the whole program).
- **A type argument carries its layout across** through `closeReachableStructs`,
  with no symbols, since a template never calls a member of a type parameter's
  type.
- **A signature annotation only writes the request down** in pass 1, because
  imports are not bound yet. A sub-pass after binding makes the request, and
  refuses type arguments on an imported non-template (NL2325).
- **"Which arguments made `Box$i32`?" is answered from the layout, while "has
  this module registered one?" is answered from the module's own log.** Merging
  the two questions reintroduces the `generic_class_clash` miscompile.

### 15.6 G6, and what it decided

**Member access is judged by where a value came from, not by its type.** At
`T = Point`, `p: T` and `q: Point` have one type, and only `p.x` may be refused.
So `originOf` follows a value's *type origin* through locals, parentheses,
ternaries, elements, `pop()`, fields of `this` and of `Box<U>`, `Result`
payloads, and generic calls returning a parameter. It is exhaustive over
expression kinds, and its `default` **fails closed** by refusing. The first
version waved `[t][0].x` through
(`reject_generic_member_through_expression`, `…_through_payload`). A member is
looked up in the parameter's constraint, and a refusal is reported once per
template, keyed by the member's node.

Two alternatives were set aside. Checking the template once with `T` bound to
its constraint would request instantiations at `Shape` and refuse operators that
only work at the concrete type. Marking the type as "came from `T`" would put a
type variable in the `TypeTable`.

**Satisfaction** is checked on the concrete argument at every request (call,
`new`, annotation, `implements`). The argument passes if it is the constraint,
or a class whose `implements` names it. A constraint may name a declared class
or interface, or a concrete instantiation. It may not name a scalar, string,
array, `Result` or nullable (NL2327), or mention a type parameter (NL2326). This
milestone was **breaking**: reading a member of an unconstrained parameter
stopped compiling.

### 15.7 G8, the peripheries, and what it decided

- **Display and linkage are two spellings.** `Box<i32>` (and
  `Box<i32>.pair<string>`) appears in every diagnostic, in the `--emit-checked`
  dump, and as the `-g` `name`. `Box$i32` stays in the symbol, the `%struct`,
  the DWARF `linkageName`, the sidecar bindings and every table key. The display
  spelling is a side table on the `TypeTable` (#164).
- **One host name per instantiation, in every sidecar** (#165, breaking). The
  header declares `nish_gen_identity_i32`, `nish_gen_identity_arr_i32` and
  `nish_gen_Box_i32_get`, each bound to its symbol with `NISH_SYMBOL`. The
  `.d.ts`, the wasm loader and N-API use the same identifier. The design's
  "`$` is legal in JavaScript" missed the `.` that an array, nullable or
  `Result` argument puts in a mangling. `nish_` is refused as the start of a
  user name, so the prefix is reserved. NL4008 refuses the one clash left,
  `Point.shifted` beside `Point_shifted`.
- **Message 9 is NL4007.** It fires for an uninstantiated exported template
  (function, class, interface, or generic method) whenever a sidecar flag is
  given, and never without one. The `.d.ts` declares instantiations only.
- **A constraint is satisfied by a declaration, not a name** (#161). Arguments
  are compared by `StructInfo` identity, and an implementer by
  `implementsDeclaration`, which is exact only while NL2079 keeps refusing an
  imported interface (§16 item 5).
- **The fuzzer emits generics** (#163), comparing the seed with HEAD. In the
  measurement, 300 of 300 programs agreed and 747 of 1,000 seeds contained
  generics.

### 15.8 Generic methods (§14 q7), and what they decided

A method of any class may declare `<U, ...>` (#168). Every decision reuses a
function-side rule unless it says otherwise:

- **Where.** Not on a constructor (a parser refusal) and not on interfaces,
  which have no methods. A method type parameter may not shadow its class's
  (NL2331).
- **Inference** applies only to the method's own parameters; the receiver binds
  the class's. Type arguments at a method call get the function's call-site
  message.
- **Key and symbol.** There is one instantiation per (concrete receiver struct ×
  method tuple): `@Holder.pick$i32`, `@Box$$Point.pair$arr.i32`. The symbol is
  decodable left to right because each argument list is consumed by arity. A
  generic method's own name may not contain `$`, and a non-generic method's `$`
  is refused only where it would shadow a generic sibling.
- **Termination** (decided here). Two links on the chain are the same template
  when they instantiate the same method *declaration*, and the compared tuple is
  the receiver's arguments followed by the method's. That catches recursion
  that changes the receiver (`reject_generic_method_recursion`).
- **Constraints, origins and whole-program** behave as for functions
  (`gen_method_constraint`, `tests/link/generic_method_import`).
- **Interop** (decided here). The C header declares
  `nish_gen_Holder_pick_i32`. The JavaScript sidecars bridge no methods.

### 15.9 Known issues

The two defects found in review of G8 are both fixed. `coercesTo` matched an
interface by name (#173), and now uses `implementsDeclaration`
(`tests/link/iface_same_name_class`). The constructor-argument message and the
`--emit-checked` callee of a generic `new` named the template rather than the
instantiation (#175). They now read `` `new Box<i32>` `` (#187,
`reject_generic_new_args`).

---

## 16. WP18 is closed: what stays deferred

G2 to G8 and generic methods have landed (§15). What follows is not a
remaining milestone. Each item was put off on purpose, and each says what
would bring it back.

1. **Contextual-return inference** (§2a, §14 question 1). A type parameter that
   appears only in the return type stays uninferable and is refused at the
   declaration. *Trigger:* the first container library written against
   generics needs a factory in more than two places.
2. **Explicit type arguments at a call site** (§2a, §14 question 2). Refused on
   a parser ground: one token of lookahead cannot tell `f<i32>(x)` from
   `(f < i32) > (x)`. *Trigger:* evidence that inference is too weak in
   practice, which would pay for a restartable lexer and a save/restore cursor
   in `src/parser.ts`.
3. **Discriminated unions** (§7). Their own note, with the coupling to
   generics dissolved. *Trigger:* that note.
4. **The Node-side differential rewrite** (§12). A generic body needs one
   JavaScript function per instantiation, because each instantiation rewrites
   differently (`i32` wraps, `f64` does not). The rewriter would have to read
   the instantiation set and the per-instantiation types from the checker, and
   with stage0 gone that means a rewriter driven by stage1's typed output
   (`docs/wp19-stage0-retirement.md` §6, item 6). Until then, the fuzzer's
   seed-versus-HEAD IR comparison (§15.7) and the golden round trips cover
   generics. *Trigger:* a stage1-typed rewriter.
5. **Implementing an imported interface** (NL2079, `` `Shape` is not a
   declared interface ``). Both §15.7's constraint check and the implicit
   class-to-interface conversion (#173) rely on that refusal. Both fail closed,
   so lifting the refusal alone would reject a class that implements an
   imported constraint, and its conversion to that interface. *Trigger:* a
   program that needs it. The same change then has to record the resolved
   `StructInfo` beside each `implements` name, so that `implementsDeclaration`
   in `src/generics.ts` compares declarations.
