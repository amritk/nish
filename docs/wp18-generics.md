# WP18: Generics by monomorphisation

User generics for AmritScript: `function identity<T>(x: T): T`,
`class Box<T>`, `interface Pair<A, B>`, and `<T extends Shape>`. Every
instantiation is compiled to its own specialised code, named by a mangled
symbol, and is indistinguishable from the monomorphic version somebody would
have written by hand. There is no boxing, no type dictionary, no runtime type
information, and no generic code left in the binary.

This note is the design, written before the code. It is a proposal to be
reviewed, not a record of something that landed: where the answer is genuinely
open it says so (§14) rather than inventing certainty.
[LANGUAGE.md](LANGUAGE.md) stays normative for what the language *is*; this
file says what it should become and why.

**Why at all.** Because AmritScript is a static subset of TypeScript and
TypeScript has generics. That is the whole reason, and it is enough: every
other rule in this repository exists to keep an AmritScript program a
TypeScript program that `tsc --strict` also accepts
([wp16-results.md](wp16-results.md) §5), and a subset that refuses `<T>` makes
the most ordinary container in the language unwritable.

**Why monomorphisation.** Because the memory model leaves nothing else.
`docs/wp15-performance.md` §1a is the argument in full: there is no GC, a
`class` is `%struct.Name` laid out exactly as clang lays out the equivalent C
struct, and a value's layout is fixed at compile time. Erasure would make
every `T` a pointer, so `Box<i32>` would hold an `i32*` — one arena bump and
one indirection per value, and no arithmetic on a `T` at all. Dictionary
passing would put an indirect call on every constrained operation, which is
the same thing that makes function values forbidden: the whole-program pass
cannot prove purity, termination or escape through an unknown callee.
Monomorphisation is not the faster of two defensible answers here; it is the
only one that fits.

**Both compilers, together.** stage0 (`src/`) is the bootstrap seed and the
differential oracle, `tests/self/ir_oracle.js` has no exemption list, and
`tests/self/bootstrap.js` must still reach a byte-identical fixed point. So
this lands in `src/` and `self/` in the same milestones, and the oracles are
what say the two agree — exactly as WP16 and WP17 did
([wp17-result-abi.md](wp17-result-abi.md) §6).

**AmritScript-0 does not adopt them.** `self/` implements generics without
using them. §10 is the argument.

---

## 1. The decision, and the one it is not

| | |
| --- | --- |
| **Lowering** | Monomorphisation. One `define` per (template, type-argument tuple); one `%struct` per instantiated generic class or interface. |
| **Discovery** | Whole-program, on a worklist owned by the `Compilation`, seeded from every annotation and every call the checker resolves. |
| **Definition** | One, in the module that declares the template. Other modules `declare` it. Never `linkonce_odr`. |
| **Inference** | From the argument types, at a call site. Type arguments are written out in an annotation (`Box<i32>`) and after `new` (`new Box<i32>(v)`), never at a call. |
| **Termination** | A static rule — no expanding cycle in the template graph — plus a hard instantiation cap as a backstop. |
| **`Result<T, E>` and `Array<T>`** | Stay built-in. They are not retired into library code. |
| **Discriminated unions** | Out of scope; deferred with an argument (§7). |

The decision this is *not*: `docs/wp15-performance.md` §5 says
"`Result<T, E>` then falls out as ordinary library code rather than a compiler
special case, and typed containers come with it, which retires the
hand-written `StringMap` of `wp14-selfhost.md` §2.2." Neither half survives
contact with what shipped in between. §6.1 and §10 give the reasons; the
short form is that WP16 and WP17 gave `Result` a narrowing engine, an
early-return operator and a packed-word ABI that no library type can declare,
and that rewriting `self/map.ts` would put the bootstrap's fixed point at risk
for a readability win.

---

## 2. The surface: what is written

Accepted:

```ts
function identity<T>(x: T): T { return x; }
function firstOf<T>(xs: T[]): T { return xs[0]; }
function swap<A, B>(p: Pair<A, B>): Pair<B, A> { ... }

class Box<T> {
  value: T;
  constructor(v: T) { this.value = v; }
  get(): T { return this.value; }
}

interface Pair<A, B> { first: A; second: B; }

class Sorted<T extends Comparable> { ... }        // a constrained parameter
class IntBox extends Box<i32> { ... }             // a base that is an instantiation
class Box2<T> extends Box<T> { ... }              // a base that mentions the parameter
class Box3<T> implements Container<T> { ... }
```

**Every existing type rule applies to a type argument unchanged**, and that is
the point rather than a caveat: a type parameter is not a hole through which
something the language refuses can be smuggled in. `Result<T, void>` is still
refused at every instantiation whose `E` is `void`; `T | null` is still only
over a pointer type, so `Box<i32 | null>` is refused; `Box<void>` is refused
because a field may not have type `void`; and there are still no union types
beyond `T | null`, so no signature written with `A` and `B` can produce one.

Not accepted, each with the reason:

- **Type parameters on a method of a non-generic class.** `class C { m<T>(x: T): T }`
  doubles the instantiation key (receiver type × method arguments) and buys
  nothing a generic class does not already give. A class's own parameters are
  in scope in its methods; a method may not add more.
- **Default type parameters** (`<T = string>`). `Result<T, E>` is built-in and
  takes both arguments, so the shape wp15 §5 sketched them for does not arise.
  Cost: `Pair<i32>` is not shorthand for `Pair<i32, string>`.
- **Generic type aliases.** There are no `type` aliases in the language at all,
  so the row wp15 §5 lists is moot.
- **`class C<T> extends T`.** A base class has to have a layout and a bare
  parameter does not have one until `C` is instantiated. The base may be an
  instantiation (`extends Box<i32>`) or mention the parameter
  (`extends Box<T>`); it may not *be* the parameter.
- **Variance annotations, `keyof`, mapped and conditional types, `infer`.**
  None of them has a lowering; all of them are type-level computation, which
  is a different language from the one this compiler implements.

### 2a. Inference, and why there are no type arguments at a call site

**Decision: a generic function's type arguments are inferred from the
argument types, and writing them at a call site is a compile error.**

The reason is the parser, and it is specific. `self/parser.ts` has **one token
of lookahead and no backtracking**: the lexer is a cursor with no save or
restore, and `advance()`/`peek()` are the whole mechanism (its header comment
names the two places TypeScript is ambiguous to one token and says one token
covers both). `f<i32>(x)` is not one of those two places. To a one-token
parser it is `(f < i32) > (x)` — a comparison — and the only way to tell is to
parse a type list speculatively and roll back if the `>` is not followed by
`(`. That means a restartable lexer, a parser cursor that can be saved and
restored, and a new class of divergence from the `typescript` scanner for
`tests/parser_oracle.js` to reconcile. That is a large change to the most
carefully-oracled part of the port, bought for a spelling inference already
covers.

Where the grammar is *not* ambiguous, type arguments are written out and are
**required**:

- in a type annotation: `const b: Box<i32> = ...` — `<` after a type name is
  already a type-argument list in `self/parser.ts` (`parseType`), and
  `expectTypeArgumentEnd` already splits the `>>` the lexer merged, so
  `Box<Box<i32>>` parses today;
- after `new`: `new Box<i32>(7)` — `parseNew` already reads a type-argument
  list, because `new Array<T>(n)` needs one.

So the grammar work in stage1 is close to zero, and that is not a coincidence:
the two positions where a type argument is unambiguous are exactly the two the
parser already reads.

**How inference works.** Unify each parameter's declared type pattern against
the argument's `StaticType`, left to right, first binding wins:

```
unify(T, i32)              -> T := i32
unify(T[], i32[])          -> T := i32
unify(Box<T>, Box$str)     -> T := string
unify(Result<T, E>, ...)   -> T, E from the payloads
```

A parameter already bound must match exactly (`sameType`), so
`identity2(1, "a")` on `function identity2<T>(a: T, b: T)` is an error naming
both types. There is no subtyping to widen against, no least-upper-bound
computation, and no fixpoint: the language's `assignable` is identity plus
`T` into `T | null`, and inference does not go looking for more.

**A type parameter that appears in no parameter is a compile error**
(§8, message 3). `function empty<T>(): T[]` cannot be called. The alternative
— inferring from the contextual type the way `Ok(...)` and `Err(...)` and the
`[]` literal already do — is a second mechanism with its own precedence rules
against the first, and it is **deferred**, with a stated trigger: if the first
real container library needs it in more than two places, it comes back as its
own change with its own cases. Cost until then: a factory function has to take
an argument that mentions its type parameter, or be a `static`-less generic
class whose arguments are written out.

---

## 3. Monomorphisation: where an instantiation comes from and where it goes

### 3a. The instantiation set and the worklist

Today's passes (`src/checker/index.ts`, `src/compilation.ts`):

```
1   collectSignatures    per module, during load
1b  bindImports          after every module is loaded
    closeReachableStructs
2   checkBodies          per module
```

An instantiation is discovered in **both** pass 1 and pass 2, and that is the
first structural fact:

- **Pass 1 (and 1b)** sees `Box<i32>` in a *signature* — a parameter, a return
  type, a field, a module constant's annotation. `resolveTypeNode` resolves it,
  requests the struct instantiation, and returns `{ kind: "struct", name: "Box$i32" }`.
  Nothing about the caller changes: from here on `Box<i32>` is an ordinary
  named struct type.
- **Pass 2** sees a call whose callee is a generic template. The checker
  unifies (§2a), requests the function instantiation, and records the
  instantiated `FunctionSig` in `program.callees` — so the emitter's existing
  `call <ret> @<callee.name>(...)` writes `@identity$i32` with no new code
  path at all.

**A generic declaration's body is never checked as a template.** Pass 2 skips
it. Only instantiations are checked, and each is checked with its type
parameters bound to concrete types, so every rule in the checker sees ordinary
types and needs no notion of a type variable below the signature level. The
one exception is the constraint check of §6.5, which is deliberately done at
the template so an error is reported once.

**The set lives on the `Compilation`**, not on a module:

```ts
compilation.instantiations: Map<string, Instantiation>   // key: the mangled symbol
```

`check()` gains a fourth step, after pass 2:

```
3   drainInstantiations   until the worklist is empty
```

Draining an entry checks one instantiation's body (or completes one struct's
members), which may request more; the loop runs to a fixed point. §4 is what
makes that loop finite.

**Order is part of the contract.** The two compilers must produce byte-identical
IR, so the enumeration order of the set must be identical. Three rules give
that: requests are made in module load order then source order (both compilers
already walk that way), the worklist is FIFO, and the map is insertion-ordered
(stage0's `Map` is by specification; stage1's `StringMap` is by construction —
`wp14-selfhost.md` §3 wave C, "iteration is insertion order, which is what a
golden-compared dump needs"). `--emit-checked` prints the set in that order,
so `tests/self/checked_oracle.js` compares it directly rather than waiting for
the IR to disagree.

### 3b. One definition, in the defining module

An instantiation is **defined once, in the module that declares its template**,
and every other module that uses it emits a `declare`.

The alternative was to emit a copy in every using module with `linkonce_odr`
linkage and let the linker fold them. It is rejected for four reasons:

1. This is not a separate-compilation compiler. `Compilation` loads every
   module transitively before anything is checked, so the compiler already
   knows the whole program and does not need the linker to do a job it can do
   exactly.
2. `linkonce_odr` would defeat `--strict-exports`, which
   `docs/wp15-performance.md` §3 makes the default: a `linkonce_odr` symbol is
   not `internal`, so LLVM may not specialise or dead-strip it the way it
   strips a non-exported function today.
3. Every existing mechanism assumes one `define` per symbol — `FunctionFacts`
   is `Map<string, FunctionFacts>` keyed by `sig.name`, `rejectSymbolClashes`
   requires uniqueness, `--emit-header` writes one prototype per symbol.
4. The folded copies would have to be *identical*, which requires the attribute
   fixpoint to give the same answer in every module. It does — facts are
   program-wide — but relying on that is a guarantee to maintain for no gain.

The consequence to accept: the IR a module emits now depends on what other
modules asked for. That was already true of `reachableStructs`
(`closeReachableStructs` puts a layout in a module that never named it), and
`emit()` already runs after the whole program is checked and analysed, so
nothing about the pipeline moves.

**Linkage falls out of the rule.** An instantiation gets exactly the linkage
its template would get: `internal` under `--strict-exports` when the template
is not exported, external otherwise. That is sound without a second thought,
because a non-exported template cannot be named from another module — you can
only import an exported name — so a non-exported template's instantiations are
all requested from inside its own module.

**Checked where it is defined.** An instantiation requested by module B of a
template declared in A is checked by **A's** `Checker`, in A's scope: A's
imports, A's constants, A's structs. Any other choice would make the body mean
different things depending on who asked for it.

### 3c. The mangling

`mangleType` (`src/types.ts`) and `TypeTable.mangle` (`self/types.ts`) already
prefix-code a type — every constructor writes its tag before its operands, so
`res.res.i32.str.str` can only be read one way. Two additions:

```
Box<i32>                %struct.Box$i32           mangleType -> $Box$i32
Box<string>             %struct.Box$str
Box<Point>              %struct.Box$$Point
Box<i32[]>              %struct.Box$arr.i32
Box<Box<i32>>           %struct.Box$$Box$i32
Pair<i32, string>       %struct.Pair$i32$str
identity<i32>           @identity$i32
identity<string>        @identity$str
Box<i32>.get            @Box$i32.get
Box<i32>.constructor    @Box$i32.constructor
```

The rule is one line: **the instance name is the template's name, then `$` and
the `mangleType` of each type argument in order.** `$` separates the name from
the arguments; `.` stays what it already is, the separator *inside* one type
and before a method name. A reader can see where the name ends. `$` is legal
in an LLVM identifier (`[-a-zA-Z$._][-a-zA-Z$._0-9]*`), checked: `llvm-as`
accepts `%struct.Box$i32` and `@Box$i32.get`.

An **instantiated generic class is an ordinary struct**, not a new
`StaticType` kind. `Box<i32>` is `{ kind: "struct", name: "Box$i32" }`, and
therefore `llvmType`, `alignOf`, `sameType`, `typeToString`, the layout
computation, `implements`, `extends`, `structTypeDeclarations`, the DWARF
composite type, and the C header all work with no change. That is the single
largest reason the change is affordable, and it is the same trick WP16 used in
reverse: `Result`'s layout is derived rather than declared, and an instantiated
class's layout is declared rather than derived, because a class has methods,
heritage and debug info that a `Result` does not.

**`$` must be reserved.** `mangleType`'s comment today claims a class name is
prefixed with `$` "because that character cannot appear in a TypeScript
identifier". That is not true — `$` is a legal identifier character in
TypeScript and in AmritScript (`isIdentStart` in `self/lexer.ts` accepts
`CH_DOLLAR`). The existing encoding survives anyway, because a struct's `$`
prefix distinguishes it from the bare `res`/`arr`/`opt` constructor tags. The
new encoding does not: a class literally named `Box$i32` would collide with
`Box<i32>`. So this package adds a rule and a `reject_*` case:

> **`$` may not appear in the name of a declared class, interface, function or
> method.** Locals, parameters and fields keep it; only names that become
> symbols are restricted.

With that, the encoding is injective: a symbol splits at the first `$` into a
declared name (no `$`) and a type-argument list, and each argument is
prefix-coded and therefore self-delimiting.

**The C name is not the LLVM name, and that is already solved.** `-pedantic`
refuses `$` in a C identifier — measured, clang 18.1.3:
`error: '$' in identifier [-Wdollar-in-identifier-extension]` — and the WP17
header test compiles its driver with `-Wall -Wextra -Werror -pedantic`. The
mechanism for this exists: `cFunctionName` in `src/interop/abi.ts` already
collapses `.` to `_` and binds the C declaration to the real symbol with
`AMRIT_SYMBOL`, which is how `Point.shifted` becomes `Point_shifted`. It needs
one character added to its condition. Measured end to end:

```c
int identity_i32(int x) AMRIT_SYMBOL("identity$i32");
```
compiles clean under `-Wall -Wextra -Werror -pedantic` and emits
`jmp identity$i32@PLT`. §14 records the one thing to check: whether the header
generator reports a *collision* between two collapsed C names (`identity$i32`
and a user function named `identity_i32` both become `identity_i32`). That
hazard predates this package — `Point.shifted` and `Point_shifted` collide the
same way — but generics make it much easier to hit.

### 3d. One AST, N type assignments

This is the part of the change that touches the most files, and it is worth
naming precisely because it is not obvious from the outside.

`CheckedProgram` records the checker's answers in tables **keyed by AST node**:
`types`, `bindings`, `locals`, `callees`, `coercions`, `caseValues` are
`WeakMap`s in stage0, and in stage1 they are `Array`s indexed by `Node.id`,
sized from the parser's `nodeCount` (`self/program.ts`). Monomorphisation
breaks that key: `identity`'s `return x;` is one node with two types.

Two ways out.

**(a) Clone the template's AST per instantiation.** Rejected. In stage0 a
`ts.factory` clone has no source positions, so every diagnostic and every `-g`
location inside an instantiation would point nowhere unless every node is
position-fixed up by hand. In stage1 the ids are dense and every side table is
sized before checking starts, so cloning after the parse means resizing all of
them, and the parser's "dense ids are the size the checker's side tables need"
invariant is gone.

**(b) An instantiation-local overlay.** Recommended. Each `Instantiation`
carries its own copy of the node-keyed tables, and every read and write of
them goes through an accessor that answers from the current instantiation when
one is being checked or emitted, and from the module otherwise. In stage1 the
overlay is sized by the template's node-id *span*: the parser hands out ids in
creation order, so all of a declaration's nodes lie in one contiguous range,
and recording `idEnd = parser.nodeCount` after each top-level declaration makes
the overlay `Array<i32>(idEnd - idStart)` indexed by `node.id - idStart`. If
that turns out to be fiddlier than it looks, the fallback is a full-`nodeCount`
overlay, which costs memory and nothing else.

The refactor this implies is mechanical and should land on its own, before any
generic code: **every node-keyed side table moves behind an accessor**, in both
compilers, with no behaviour change and every golden unmoved. That is G1's real
content.

Three consumers outside the checker and emitter read those tables and move with
them: `src/codegen/escape.ts`, `src/codegen/attributes.ts`, and
`tests/differential/rewrite.js` (§12).

---

## 4. Termination

Monomorphising a polymorphically-recursive function does not terminate. It is
not a matter of trying harder: deciding whether a polymorphically recursive
program has finitely many instantiations is equivalent to semi-unification and
is undecidable. Rust answers with a recursion limit; C++ answers with
`-ftemplate-depth` (900 by default in clang). Both produce a message about a
number rather than about the program.

**The answer here is a static rule, with a cap as a backstop.**

### The rule: no expanding cycle

Build the **template dependency graph** once, over templates rather than
instantiations, so it is a property of the source and needs no enumeration:

- A node is a generic template — a function, a class or an interface.
- An edge `f → g` exists for each place `f`'s body or `f`'s fields mention an
  instantiation of `g`, and it is labelled with the type arguments *as written*,
  in terms of `f`'s own parameters.
- An edge is **non-expanding** when every one of its type arguments is exactly
  a type parameter of `f` — a bare variable, `T`, never `Box<T>`, `T[]`,
  `Result<T, E>` or a nullable of one.

> **A cycle in the template graph is legal only if every edge on it is
> non-expanding.**

Soundness: on a non-expanding cycle, every type argument passed around is
drawn from the tuple the cycle was entered with, so the set of tuples reachable
from one seed is a subset of the tuples over that seed's own arguments —
finite, and bounded by `arity^arity` per template. The worklist therefore
drains. Completeness: it accepts every monomorphic recursion, which is what
real code writes —

```ts
function sumTree<T>(node: Node<T>): i32 {
  return sumTree(node.left) + sumTree(node.right);   // Node<T> -> Node<T>: fine
}
```

— and refuses exactly the shapes that cannot terminate:

```ts
function grow<T>(x: T, n: i32): i32 {
  if (n === 0) { return 0; }
  return grow<T[]>([x], n - 1);       // refused: T[] is not a bare T
}

class Nest<T> {
  inner: Nest<T[]> | null;            // refused: the field expands
}
```

The same rule covers classes and functions because it is stated over
"templates", and a class's *fields* are edges exactly as a function's *calls*
are. That is why the graph is built once, in one place, and why the struct half
of it lands with generic classes rather than as a second mechanism.

The diagnostic names the chain, not a number (§8, message 5). That is the
whole reason to prefer a rule over a limit: a user who wrote `grow<T[]>` is
told which type argument grows and that the fix is to pass `T`.

### The backstop: a cap

The rule is about type-level recursion. A program can still ask for an absurd
number of instantiations without any cycle at all, and a bug in the rule must
produce a diagnostic rather than a hang. So the worklist also carries a hard
cap — a per-template count and a program-wide total — and exceeding it is an
error that says it is a compiler limit rather than a language rule (§8,
message 6). Starting values of 256 and 4096 are placeholders; §14 records that
they want a real program behind them.

---

## 5. The worked lowering

Everything below is the dialect the emitter really writes today — typed
pointers, `noundef`, one attribute group per distinct set — checked against the
goldens it is copied from. `llvm-as` accepts all of it.

### `identity<T>`

```ts
function identity<T>(x: T): T { return x; }

export function main(): i32 {
  console.log(identity(7));
  console.log(identity("hi"));
  return 0;
}
```

Two instantiations, `identity$i32` and `identity$str`:

```llvm
define noundef i32 @identity$i32(i32 noundef %x) #0 {
entry:
  ret i32 %x
}

define noundef nonnull align 8 i8* @identity$str(i8* noundef nonnull noalias readonly align 8 %x) #0 {
entry:
  ret i8* %x
}

attributes #0 = { nounwind willreturn readnone }
```

`identity$str` has no `nocapture` on `%x`, because returning the pointer is an
escape — and that is not a rule this package writes. It is
`tests/cases/str_param_passthrough.ll`, character for character, with the
symbol renamed: `@passthrough` there is
`define noundef nonnull align 8 i8* @passthrough(i8* noundef nonnull noalias readonly align 8 %s)`
under `attributes #0 = { nounwind willreturn readnone }`.

That is the acceptance test of the whole package, and it is mechanical rather
than aspirational: **an instantiation's IR must be byte-identical to the IR of
the hand-written monomorphic twin, modulo the symbol name.** §12 makes it a
check in `tests/run.js`.

### Purity is per instantiation

```ts
function eq<T>(a: T, b: T): boolean { return a === b; }
```

```llvm
define noundef zeroext i1 @eq$i32(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %a, %b
  ret i1 %0
}

define noundef zeroext i1 @eq$str(i8* noundef nonnull noalias readonly align 8 nocapture %a,
                                  i8* noundef nonnull noalias readonly align 8 nocapture %b) #1 {
entry:
  %0 = call zeroext i1 @amrit_str_eq(i8* %a, i8* %b)
  ret i1 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn readonly }
```

`eq$str` is `@same` from `tests/cases/str_eq.ll`, again character for
character. The two instantiations get different attribute groups because they
are different functions with different facts, and no machinery was added to
make that happen: `FunctionFacts` is already `Map<string, FunctionFacts>` keyed
by symbol, so a per-instantiation symbol gives per-instantiation facts for
free. §6.6 says the same about escape analysis.

### `Box<T>`

```ts
class Box<T> {
  value: T;
  constructor(v: T) { this.value = v; }
  get(): T { return this.value; }
}

export function main(): i32 {
  const n = new Box<i32>(7);
  const s = new Box<string>("hi");
  console.log(n.get());
  console.log(s.get());
  return 0;
}
```

Two structs, four functions:

```llvm
%struct.Box$i32 = type { i32 }
%struct.Box$str = type { i8* }

define void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this,
                                 i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4
  ret void
}

define noundef i32 @Box$i32.get(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define void @Box$str.constructor(%struct.Box$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this,
                                 i8* noundef nonnull noalias readonly align 8 %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  store i8* %v, i8** %0, align 8
  ret void
}

define noundef nonnull align 8 i8* @Box$str.get(%struct.Box$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8
  ret i8* %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
```

Every line of that is `tests/cases/cls_point.ll` and
`tests/cases/cls_extends_basic.ll` with the names changed:
`dereferenceable(4)` for a one-`i32` struct and `(8)` for a one-pointer struct
follow `sizeOf`; `%v` in `Box$str.constructor` loses `nocapture` because it is
stored into a field, which is exactly what `Animal.constructor`'s `%name`
does; the constructor is `nounwind willreturn` and the getter adds `readonly`,
as `Point.constructor` and `Point.manhattan` do.

The caller is unchanged from a non-generic class, WP6 included — the escape
analysis proves neither box outlives `main`, so both are entry-block allocas
and there is no `amrit_alloc_struct` in the module:

```llvm
define noundef i32 @amrit_main() #0 {
entry:
  %n.addr = alloca %struct.Box$i32*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  %s.addr = alloca %struct.Box$str*, align 8
  %Box$str.obj = alloca %struct.Box$str, align 8
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 7)
  store %struct.Box$i32* %Box$i32.obj, %struct.Box$i32** %n.addr, align 8
  ...
}
```

---

## 6. Every existing feature, as a rule

### 6.1 `Result<T, E>` and `Array<T>` stay built-in

**Recommendation: neither becomes an ordinary generic.**

`Array<T>` cannot be one. It is not a struct: it is the runtime header
`{ i64 len, i64 cap, i8* data }` with an untyped payload, an element stride
computed from the element type, a bounds check that branches to a cold panic
block, `push` with a reallocating grow, `join`, `for...of` as pointer
advancement, and the typed-array aliases that let a Node host hand an
`Int32Array` straight across. Writing it as library code needs a `void*`, a
cast, and pointer arithmetic — three things the language does not have and
should not gain to express one type.

`Result<T, E>` could be *shaped* like one and still could not be one. Its
`state` is a checker-only refinement that rides on the type and that `sameType`
ignores; `isOk()`/`isErr()`/`.ok` narrow through the registry in
`checker/narrowing.ts`; `orReturn()` returns early from the enclosing function;
it may not be dropped; and WP17 gave it a packed-`i64` ABI with C, N-API and
wasm bridges. A library type would need trait bounds, a postfix propagation
operator and a way to declare an ABI, which is a larger package than this one.

The cost of keeping both built-in, stated plainly: `mangleType` keeps its
`res.` and `arr.` constructor tags beside the new instantiated-struct names, so
there are two spellings of "a type applied to arguments" in the compiler, and
a reader has to know which is which. That is the price of not designing a trait
system.

What generics *do* give them: `Box<Result<i32, string>>` and `Box<i32[]>` work
with no special case, because a type argument is just a `StaticType`. And
`resultTypesIn` already walks into arrays and nullables to find the `Result`
layouts a module must declare; it gains a case for an instantiated struct's
fields exactly as `structTypeDeclarations` already has one.

### 6.2 `extends`

`class Box2<T> extends Box<T>` and `class IntBox extends Box<i32>` are both
legal. The base is an edge in the template graph (§4), so it is instantiated
before the derived class's members are collected — which the existing
`collected: "collecting" | "done"` marker on `StructInfo` already sequences and
already uses to catch a cycle. The derived instantiation's fields are the base
instantiation's fields as a prefix, with the same indices and offsets, so the
`bitcast` upcast, the inherited method call and the inherited constructor of
WP2b work unchanged. `class C<T> extends T` is refused (§2).

### 6.3 `implements`

**Checked at the template, not per instantiation.** `implements` in this
language means "identical fields, in order, with identical types", and that
comparison can be made on the *uninstantiated* field lists: if
`class Box<T> implements Container<T>` matches with `T` a variable, it matches
for every `T`. Checking at the template reports a mismatch once, against the
declaration the user wrote, instead of once per instantiation with a
de-duplication pass to hide the copies. A non-generic class implementing an
instantiation (`class IntBag implements Container<i32>`) is the ordinary check
against the instantiated interface, unchanged.

### 6.4 The escape analysis and stack allocation (WP6)

No change, and the reason is the same one as for attributes: `EscapeResult`
and `FunctionFacts` are computed and stored **per symbol**, and each
instantiation has its own symbol. `stackSites` is a set of AST nodes *within*
one function's facts, so `Box<i32>` being stack-allocated in one instantiation
and arena-allocated in another is representable without touching the model.
The one real consequence is worth a golden: a generic body whose `T` is a
scalar may have no allocation at all, while the same body at `T = string` may
have to bump the arena because the payload escapes — one source line, two
different memory behaviours, which is what `gen_stack` exists to pin.

### 6.5 Constraints, and where they are checked

`<T extends Shape>` where `Shape` is a declared class or interface. Two checks,
deliberately in different places:

- **At the template**, member access on a constrained parameter is admitted
  against `Shape`'s members. `T`'s methods and fields are `Shape`'s. That means
  a body that reads a member `Shape` does not have is rejected once, at the
  declaration, rather than at every instantiation. Member access on an
  *unconstrained* parameter is refused with a message naming the fix (§8,
  message 8).
- **At each instantiation**, the type argument must satisfy the constraint:
  `implementsInterface(arg, Shape) || isSubclassOf(arg, Shape)`, the two
  predicates `src/checker/classes.ts` already has. Failure is reported at the
  request site, which is where the user wrote the type argument.

A constrained parameter is still monomorphised: `Shape`'s methods are called
on the *concrete* type, statically, with no vtable — a `T extends Shape` body
compiled at `T = Circle` calls `@Circle.area`, not `@Shape.area`.

### 6.6 The attribute fixpoint

Per instantiation, for free (§5). One thing to say out loud, because it is the
class of bug a golden is worst at catching (`.claude/selfhost.md`, "Habits that
have paid off"): the fixpoint runs over `program.functions`, and instantiations
are appended to the defining module's `program.functions` before `analyze()` —
so an instantiation that never made it into that list would be emitted with
*no facts at all*, which `factsFor` turns into an internal error rather than a
wrong attribute. That is the right failure mode and it should stay.

### 6.7 `-g` and DWARF

```
DISubprogram(name: "identity<i32>", linkageName: "identity$i32", ...)
DICompositeType(tag: DW_TAG_structure_type, name: "Box<i32>", ...)   -> %struct.Box$i32
```

The **display name is the source spelling with its type arguments**; the
**linkage name is the mangled symbol**. That is what clang does for a C++
template instantiation, it is what a debugger's user expects to type, and it
costs nothing: `typeToString` gains the `Box<i32>` spelling when `StructInfo`
carries its type arguments, and `beginFunction` already takes `name` and
`fn.name` separately.

`line:` points at the template's declaration, because that is the source a
debugger should show when stepping into `identity$i32`. The consequence is
that N instantiations share source lines, so a breakpoint on a line inside a
generic body has N addresses — the same thing gdb does for a C++ template, and
the reason `dbg_generic` should assert two `DISubprogram`s with distinct
`linkageName`s and the same `line`.

`-g` is stage0's today (`wp17-result-abi.md` §6); if it still is when this
lands, the IR oracle skips the `-g` corpus exactly as it does now, and the
DWARF half is a stage0-only change.

### 6.8 Interop: `--emit-header`, `--emit-dts`, `--emit-napi`

**Recommendation: export each instantiation under its mangled name, and refuse
to describe an exported generic that the program never instantiates.**

A generic function has no single C signature, but `identity$i32` has one, and
— by the linkage rule of §3b — it is already an external symbol of the final
link. A header that omitted it would describe a different ABI than the module
defines, which is the one thing the interop generators must never do
(`src/interop/abi.ts`: "Everything is derived from the `Compilation` the
emitter already used").

So:

```c
/* identity<i32> */
int32_t identity_i32(int32_t x) AMRIT_SYMBOL("identity$i32");
```

with the C-identifier collapse and the `AMRIT_SYMBOL` binding of §3c, which is
the mechanism `Point.shifted` already uses and which was measured to produce
the right relocation. `--emit-dts` and `--emit-napi` need no collapse at all:
`$` is a legal JavaScript identifier character, so they export `identity$i32`
verbatim, and the comment above it says which instantiation it is.

The refusal covers the one confusing case. `export function identity<T>(x: T): T`
in a program that never calls it produces no symbol, so a user who asked for a
header and expected an `identity` in it gets nothing. Rather than let that be
silent, a sidecar flag makes it an error (§8, message 9). It fires only where
it matters — no sidecar, no error — and it names the reason rather than the
absence.

The alternative, refusing to export generics at all, was rejected because it
would make the most useful thing a library can ship (a container the caller
instantiates) unexportable, while the instantiations it actually contains are
perfectly ordinary C functions.

---

## 7. Discriminated unions: deferred, with the coupling dissolved

`docs/wp15-performance.md` §9 item 8 pairs generics with discriminated unions
and `Result<T, E>` as one line of work. **They are three lines, and two of them
have already been walked.**

The pairing existed because `Result<T, E>` was going to be library code built
out of a generic discriminated union. WP16 shipped it as a built-in with its
own narrowing rules, WP17 gave it a register ABI, and §6.1 above keeps it that
way. So the coupling is gone in both directions: generics no longer need
unions to justify themselves, and unions no longer need generics to be worth
having.

Deferring them keeps the largest change in the project from being larger,
which is the same instinct as wp14 §6 rule 1 (a construct enters the language
on its own, with its own cases and its own cookbook entry).

What a follow-on note has to decide, recorded here so the deferral is informed:

- **Representation.** `%struct.<Name> = type { i32 tag, [N x i8] payload }`,
  `N` the largest arm's size, alignment the largest arm's alignment, an arm
  reached through a `bitcast` of the payload address. The tag gets a full word
  for the same reason WP17's discriminant does — so the payload's offset does
  not depend on the payload's alignment.
- **Narrowing** on the tag field, through the registry in
  `checker/narrowing.ts` that `nullable.ts` and `result.ts` already share. This
  is the first narrowing keyed on a *field* rather than on a whole value, which
  is a real extension of the soundness argument, not a reuse of it.
- **Exhaustiveness** in `switch`: the arm set is known, `switch` is already
  integer-only and lowers to LLVM's `switch`, and a missing arm is an error.
- The interop, escape and `-g` stories for a union payload.

Two things this package must not foreclose, and does not: the mangling has room
for a union constructor tag beside `res.`/`arr.`/`opt.`, and the template graph
rule of §4 applies to a union's arm types exactly as it applies to a class's
fields.

---

## 8. Diagnostics

Written in the voice of the existing ones: the offending thing in backticks,
then a `;` and the fix, phrased as the code the programmer should write.

1. **Unsatisfied constraint**

   ``` 
   `T` of `sorted` requires `T extends Comparable`, and `i32` does not implement it;
   pass a class or interface that declares `implements Comparable`
   ```

2. **Wrong arity** — mirroring `` `Array` needs exactly one type argument `` and
   `` `Result` needs exactly two type arguments ``

   ```
   `Pair` needs exactly 2 type arguments, e.g. `Pair<number, string>`
   ```

3. **Uninferable type parameter**

   ```
   Cannot infer `T` for `empty`: a type parameter is inferred from the arguments,
   and `T` appears only in the return type; give `empty` a parameter that mentions
   `T`, or use a generic class, whose type arguments are written out
   ```

4. **Type arguments at a call site**

   ```
   Type arguments are not written at a call site in AmritScript: `T` is inferred
   from the arguments, so write `identity(x)`; a type argument is written out in an
   annotation (`const b: Box<i32>`) and after `new` (`new Box<i32>(v)`)
   ```

5. **Non-terminating monomorphisation** — the important one, and it names the
   chain rather than a number

   ```
   Monomorphising `grow` would not terminate: `grow<T>` instantiates `grow<T[]>`,
   which is larger than the type it started from, so `grow<i32>` -> `grow<i32[]>` ->
   `grow<i32[][]>` has no end; make the recursive call pass `T` itself
   ```

   and its field form

   ```
   `Nest<T>` would not terminate: the field `inner` is `Nest<T[]>`, so laying out
   `Nest<i32>` needs `Nest<i32[]>`, which needs `Nest<i32[][]>`; a generic class may
   only mention itself at its own type parameters
   ```

6. **Instantiation cap** — says it is a limit, not a rule

   ```
   `Box` has been instantiated 256 times, which is this compiler's limit rather than
   a rule of the language; the chain that reached it starts at `Box<i32>`
   ```

7. **`$` in a declared name**

   ```
   `Box$i32` cannot be the name of a class in AmritScript: `$` separates a generic's
   name from its type arguments in the symbols the compiler emits, so `Box<i32>` is
   already `Box$i32`
   ```

8. **Member access on an unconstrained parameter**

   ```
   Cannot read `x` of `T`: an unconstrained type parameter has no members; say which
   ones it has with `<T extends Point>`
   ```

9. **An exported generic with no instantiation, when a sidecar is requested**

   ```
   `identity` is generic, so it has no single C signature: a generic function becomes
   a symbol only where it is instantiated, and this program instantiates none
   ```

10. **`extends` a bare type parameter**

    ```
    `class Holder<T> extends T` is not supported: a base class has to have a layout,
    and `T` has none until `Holder` is instantiated
    ```

Every one of these gets a `reject_*.ts` + `.err` pair, and
`tests/self/reject_oracle.js` holds the two compilers to them character for
character — which is what stops the second implementation from paraphrasing.

---

## 9. Performance, under wp15 §1

The rule is that the faster lowering wins and that "faster" means measured.
Here the measurement is unusually cheap, because the claim is an *equality*
rather than a ratio.

**The speed claim: an instantiation is byte-identical to the hand-written
monomorphic version.** §5 shows it twice against goldens already in the tree.
If it holds, there is nothing left to benchmark: the generated code *is* the
code every earlier package already measured, and a `Box<i32>` loop is the
`Point` loop `docs/BENCHMARKS.md` reports. If it ever stops holding, that is a
bug in the instantiation path, not a performance question — which is why §12
makes it a structural check in `tests/run.js` rather than a benchmark.

**The size cost is the real one, and it is honest.** One copy of every generic
function body per distinct type-argument tuple; one `%struct` plus one copy of
every method per instantiated class. A container used at eight element types is
eight copies. Two things bound it:

- `--strict-exports`, which wp15 §3 makes the default, gives a non-exported
  instantiation `internal` linkage, so LLVM dead-strips the ones nothing calls
  and specialises the ones it does.
- Instantiations are only created for type arguments the program actually
  uses. There is no eager instantiation of anything.

The measurement to take, rather than a number to guess: `scripts/size-report.sh`
over an example that instantiates one container at 1, 2, 4 and 8 element types,
reporting `.text` at `--profile size` for each, so the marginal cost per
instantiation is a measured slope. Report it in the PR the way a `runtime.c`
change reports its byte count.

**The compile-time cost.** A template body is checked once per instantiation,
and each instantiation carries a side-table overlay (§3d), so checking is
O(Σ instantiations × template nodes) rather than O(template nodes).
`wp14-selfhost.md` §3a D5 measured the baseline the hard way — stage1 compiles
the whole of `self/` in **86 MB of peak RSS and 91 ms**, against stage0's
178 MB and 786 ms — and that measurement is also this package's regression
test, because `self/` uses no generics (§10). A program that instantiates
nothing must allocate no overlay and cost nothing, and the bootstrap is what
proves it.

---

## 10. AmritScript-0 does not adopt them

`self/` implements generics. `self/` is not written with them.

`docs/wp14-selfhost.md` §2 fixes AmritScript-0 as the subset the self-hosted
compiler may use, and its first line is "no generics". That line does not
change. `self/nodes.ts` keeps its one `Node` class, `self/types.ts` keeps its
interned `i32` ids, and `self/map.ts` keeps its hand-written `StringMap` over
parallel arrays.

**Why, when the language now has them:**

1. **The fixed point is the project's central proof, and this is the project's
   largest change.** `IR(stage1, self/) == IR(stage2, self/)` over 51 modules
   and six megabytes of IR is the claim wp14 exists to make. Rewriting `self/`
   in terms of generics in the same package that introduces them would put that
   proof and the feature under test at the same time, so a failure could not be
   attributed to either. Keeping `self/` monomorphic means the bootstrap stays
   a *control*: it must produce byte-identical IR before and after this package,
   because none of its input changed.
2. **wp14 §2.2's argument is spent, not reversed.** It says "resist the urge to
   add `Map<K, V>` to the language for it — that would drag in generics, which
   is a work package of its own and is not on the path". That was an argument
   about *sequencing the port*, not about the language never having generics.
   The port is done; the work package is this one; the language gets them. What
   does not follow is that `self/` must then use them.
3. **wp14 §6 rule 5 is satisfied precisely because the subset does not grow.**
   "AmritScript-0 does not grow quietly" fires when a construct is added to the
   subset, because every addition is something stage1 must implement in order
   to compile itself. Nothing is added here, so the rule does not fire — the
   same way WP17 did not fire it (`wp17-result-abi.md` §6: "the packing is
   shifts, `zext`, `trunc`, `select` and one `bitcast`, all of which `self/`
   could already express").
4. **It is the strongest available test of "generics cost nothing when
   unused".** If the whole of `self/` still compiles to byte-identical IR in
   the same time and the same memory after this package, then the instantiation
   machinery is genuinely inert on a program that instantiates nothing.

Whether `self/map.ts` should ever become `Map<K, V>` is a later question with
its own note, and §14 records it. It would change the IR of every module of
`self/`, so it is a package, not a cleanup.

---

## 11. The plan

Eight milestones, in the style of wp14 §4. Each lands in **both** compilers,
leaves `npm run check`, `npm test` and the bootstrap green, and is useful on
its own. This is written to be implemented by several agents in sequence, so
each row says what proves it.

| | Lands | stage0 | stage1 | Proved by |
| --- | --- | --- | --- | --- |
| **G1** | The side-table accessor refactor, and nothing else. Every node-keyed table (`types`, `bindings`, `locals`, `callees`, `coercions`, `caseValues`) moves behind a getter/setter; the parser records each top-level declaration's node-id span. No behaviour change. | `src/checker/program.ts`, `index.ts`, every `checker/<family>.ts`, `codegen/emit/*`, `codegen/escape.ts`, `codegen/attributes.ts` | `self/program.ts`, `self/checker.ts`, `self/parser.ts`, `self/emit*.ts`, `self/escape.ts`, `self/attributes.ts` | Every golden byte-identical; every oracle unchanged; the bootstrap green. A milestone whose diff is large and whose test output is empty. |
| **G2** | The template surface. Phase 0 stops rejecting type parameters on functions, classes and interfaces; pass 1 collects templates; **every use is still refused** (`` `Box` is generic and this compiler cannot instantiate it yet ``). `mangleType` gains the instantiation encoding; the `$`-in-a-declared-name rule lands. | `src/validator.ts`, `src/types.ts`, `src/checker/declarations.ts`, `classes.ts`, `program.ts` | `self/validator.ts`, `self/types.ts`, `self/parser.ts` (type-parameter lists), `self/nodes.ts`, `self/declarations.ts`, `self/structs.ts` | `tests/self/types_oracle.js` over the new mangled strings; `reject_generic_dollar_name`; the two old cases `reject_generic_function` / `reject_generic_class` are re-pointed at the new message rather than deleted. |
| **G3** | Generic **functions**: the instantiation set on the `Compilation`, the FIFO worklist, the overlay, inference from arguments, the mangled symbol, one `define` per instantiation. Single module only. | `src/checker/generics.ts` (new), `src/checker/index.ts`, `src/compilation.ts`, `src/codegen/emitter.ts` | `self/generics.ts` (new), `self/checker.ts`, `self/compilation.ts`, `self/emit.ts` | `gen_identity`, `gen_eq_purity`, `gen_infer_two`; the byte-identity check against the hand-written twin; `ir_oracle.js` and `checked_oracle.js` over the new cases. |
| **G4** | **Termination**, for functions. The template graph, the non-expanding-cycle rule, the two caps, messages 5 and 6. Lands immediately after G3 because G3 can already diverge. | `src/checker/generics.ts` | `self/generics.ts` | `reject_generic_polymorphic_recursion`, `reject_generic_instantiation_limit`, and a positive `gen_recursive_same_type`; `reject_oracle.js` on both messages. |
| **G5** | Generic **classes and interfaces**: a `StructInfo` per instantiation, methods, constructor, `new Box<i32>(v)`, fields, layout, the struct half of the template graph, `implements` at the template, `extends` including a generic base. | `src/checker/classes.ts`, `generics.ts`, `src/codegen/emit/classes.ts` | `self/structs.ts`, `self/generics.ts`, `self/emit_classes.ts` | `gen_box_i32`, `gen_box_string`, `gen_box_struct`, `gen_nested`, `gen_extends`, `gen_implements`, `gen_stack`; `reject_generic_expanding_field`, `reject_generic_extends_type_param`; `tests/layout/` offsets against clang. |
| **G6** | **Constraints** (`<T extends Shape>`): member access admitted at the template, satisfaction checked at each instantiation. | `src/checker/generics.ts`, `classes.ts` | `self/generics.ts`, `self/structs.ts` | `gen_constraint`, `gen_constraint_method`; `reject_generic_unsatisfied_constraint`, `reject_generic_member_unconstrained`. |
| **G7** | **Whole-program**: a generic exported from one module and instantiated in two others; one definition in the defining module; `declare`s elsewhere; linkage; `--strict-exports`. | `src/compilation.ts`, `src/codegen/emitter.ts` | `self/compilation.ts`, `self/emit.ts` | `tests/link/generic_import/`, `tests/link/generic_two_importers/` (asserting exactly one `define` across the program's modules); `reject_oracle.js` reads the link negatives already. |
| **G8** | **The peripheries**: `-g` naming, the three interop sidecars, the differential rewrite (§12), the cookbook entries, the LANGUAGE.md rules, the size report, the `CHANGELOG.md` line. | `src/codegen/debug.ts`, `src/interop/*` | `self/debug.ts`, `self/interop_*.ts` | `dbg_generic`; `interop_oracle.js`; `npm run test:diff`; `docs/cookbook/regen.sh --check`; `node docs/check-links.mjs`; and the bootstrap, which must still reach its fixed point over an unchanged `self/`. |

The ordering constraint that matters: **G4 cannot be later than it is.** The
moment G3 lands, a program can be written that makes the compiler allocate
until it dies, and shipping that state even between two commits on a branch is
not acceptable. If G3 and G4 are hard to separate in practice, merge them.

---

## 12. The test obligation

Per `docs/ARCHITECTURE.md`'s nine-step checklist and `.claude/testing.md`.

**Golden `.ll` cases** (`tests/cases/gen_*`), each small and about one thing,
each with a `.out` native round trip:

| Case | Pins |
| --- | --- |
| `gen_identity` | Two instantiations of one function; the `$` symbols; `identity$str`'s missing `nocapture`. |
| `gen_eq_purity` | `readnone` on one instantiation and `readonly` on another — the per-instantiation attribute fixpoint. |
| `gen_infer_two` | Inference through `T[]` and through a nested instantiation. |
| `gen_box_i32`, `gen_box_string` | `%struct.Box$i32` / `%struct.Box$str`, the constructor, the getter, the `dereferenceable` per layout. |
| `gen_box_struct` | A type argument that is a class: the `$$` in `Box$$Point`. |
| `gen_nested` | `Box<Box<i32>>` — the `>>` split and the recursive mangling. |
| `gen_extends`, `gen_implements` | A generic base, an instantiated base, and a template-level `implements`. |
| `gen_constraint`, `gen_constraint_method` | A constrained parameter, and a static call to the concrete method. |
| `gen_stack` | WP6: an alloca at one instantiation and an arena bump at another, from one source line. |
| `gen_result_payload`, `gen_array_payload` | `Box<Result<i32, string>>` and `Box<i32[]>` — the built-ins as type arguments. |
| `gen_recursive_same_type` | Monomorphic recursion, which must be *accepted*. |
| `dbg_generic` | Two `DISubprogram`s, distinct `linkageName`, shared `line`, `name: "identity<i32>"`. |

**Negatives** (`tests/cases/reject_generic_*`), one per message in §8:
`arity`, `unsatisfied_constraint`, `uninferable`, `call_type_args`,
`polymorphic_recursion`, `expanding_field`, `instantiation_limit`,
`dollar_name`, `extends_type_param`, `member_unconstrained`,
`export_uninstantiated` (with an `.args` naming a sidecar flag). Each names the
rule it breaks in a one-line comment, so that a case which also fails for a
second, accidental reason is caught in review.

**A structural check in `tests/run.js`**, because a golden cannot express it:
compile a source that declares `function identity<T>(x: T): T` used at `i32`
and one that declares `function identityI32(x: i32): i32` with the same body,
and assert the two `define` blocks are equal after renaming the symbol. That is
the acceptance test of §9 and it should fail loudly if the instantiation path
ever starts emitting something a hand-written function would not.

**`tests/link/`**: `generic_import/` (defined in `a.ts`, instantiated in
`b.ts`) and `generic_two_importers/` (instantiated at the same type in two
modules — exactly one `define` in the whole program, `declare`s elsewhere;
`expected.ir` fragments assert both).

**`tests/layout/`**: the instantiated struct offsets and `sizeof` cross-checked
against clang for the same C struct, as the ten existing structs are.

**Differential (`tests/differential/`)** — and this one needs design work, not
just corpus. Node has no monomorphisation: `ts.transpileModule` erases the type
parameters and leaves *one* JavaScript function. But `rewrite.js` rewrites each
node according to the checker's recorded type — `i32` wraps, `f32` rounds, `u32`
is unsigned, `s.length` is a byte count — and after §3d one node has N types.
So a generic body genuinely cannot be one JS function: `add<T>(a, b)` at
`T = i32` must wrap and at `T = f64` must not.

**The rewrite therefore emits one JavaScript function per instantiation**,
named by the mangled symbol, with each call rewritten to its instantiation's
function. It reads the instantiation set and the overlays from the checker, the
same way it already reads `program.types`. That is a real piece of work and it
belongs in G8 rather than being discovered there. The corpus then wants
`gen_*.ts` files whose instantiations differ observably: integer wrapping at
`i32` beside `f64`, `f32` rounding, unsigned `u32` shifts, and string `===`
(value equality on both sides, which should agree and is worth pinning).

**The `self/` oracles** need no new oracle and one dump change:

- `checked_oracle.js` — `--emit-checked` must print the instantiation set (key,
  template, type arguments, in discovery order) in both compilers, so a
  divergence in *which* instantiations exist is caught before the IR is
  compared. That is an addition to `src/dump.ts` and `self/dump.ts`.
- `reject_oracle.js` — the eleven new negatives, character for character.
- `ir_oracle.js` — the new cases and the two link programs, byte for byte,
  module set included.
- `interop_oracle.js` — the `.h`, `.d.ts`, loader and `.napi.c` for a program
  exporting instantiations.
- `bootstrap.js` — unchanged input, so it is a control: byte-identical IR
  before and after, and the fixed point still reached.
- `tests/differential/fuzz.js --stage1` — the generator should learn to emit a
  generic declaration and a couple of instantiations, which is how the two
  compilers get compared on generics nobody wrote. That is the check that found
  a real contextual-typing divergence at S5 and is worth pointing at the
  largest new feature.

**Docs**: a `docs/LANGUAGE.md` section citing each case by name, the
"Generic type parameters are forbidden" row of the forbidden-constructs table
rewritten rather than deleted, `docs/cookbook/gen_function.ts` and
`gen_class.ts` with their `IR_COOKBOOK.md` markers, `docs/cookbook/regen.sh`,
and a `CHANGELOG.md` line.

---

## 13. What is deliberately *not* being added

- **Type arguments at a call site.** §2a: one token of lookahead, no
  backtracking, and inference covers it.
- **Contextual-return inference.** `function empty<T>(): T[]` cannot be called.
  Deferred with a stated trigger rather than refused forever.
- **Generic methods on non-generic classes**, **default type parameters**,
  **generic type aliases** (there are no type aliases), **variance
  annotations**, **`keyof` / mapped / conditional types / `infer`**.
- **`class C<T> extends T`.**
- **Retiring `Result<T, E>` and `Array<T>` into library code.** §6.1, against
  wp15 §5's aspiration, with the reason.
- **Discriminated unions.** §7, with the shape a follow-on note starts from.
- **Trait or interface bounds with method requirements beyond a struct's
  layout.** `<T extends Shape>` means "a class or interface with `Shape`'s
  layout", because that is what `implements` already means here. A bound that
  said "any type with a method `compare`" would be a trait system, and it is
  not on this path.
- **Generics in AmritScript-0.** §10. `self/` implements them and does not use
  them, and the hand-written `StringMap` stays.
- **Any change to the bootstrap's input.** `self/` compiles to byte-identical
  IR before and after this package, and that is a test, not a hope.

---

## 14. Open questions

Recorded as questions rather than answered, because this note is meant to be
reviewed before code is written.

1. **Contextual-return inference.** Deferred (§2a). The revisit trigger should
   be concrete: if the first container library written against this needs a
   factory in more than two places, it comes back with its own cases. Is that
   the right trigger?
2. **Explicit type arguments at a call site.** Refused on a parser-architecture
   ground (§2a), not a language one. If inference proves too weak in practice,
   the price is a restartable lexer and a save/restore parser cursor in
   `self/parser.ts`, plus whatever `tests/parser_oracle.js` then has to
   reconcile. Worth revisiting only with evidence.
3. **The instantiation caps.** 256 per template and 4096 program-wide are
   placeholders (§4). They want a real program behind them before they ship.
4. **C-name collisions in the generated header.** `identity$i32` and a user
   function named `identity_i32` both collapse to `identity_i32` (§3c). Does
   `--emit-header` report a duplicate C identifier today? If not, that is a
   pre-existing gap — `Point.shifted` and `Point_shifted` collide the same way
   — that generics make much easier to hit, and it should be closed in G8.
5. **Whether `--emit-dts` should also declare the *generic* signature**
   alongside the instantiations. TypeScript can express `identity<T>(x: T): T`;
   C cannot. Declaring both would make the `.d.ts` read the way a TypeScript
   user expects while the instantiations carry the actual exports — at the cost
   of a declaration that has no symbol behind it.
6. **The node-id span for stage1's overlay.** §3d assumes a top-level
   declaration's nodes occupy a contiguous id range, which follows from the
   parser handing out ids at node creation. It has not been proved over every
   grammar path; if it does not hold, the fallback is a full-`nodeCount`
   overlay, which costs memory and nothing else.
7. **Generic methods**, deferred in §2. The instantiation key would become
   (receiver instantiation × method arguments). Is there a real want?
8. **Whether `self/map.ts` should ever become `Map<K, V>`.** §10 says not in
   this package. It would change the IR of every module of `self/`, so it is a
   package with its own note and its own bootstrap risk, gated on the fixed
   point being green for a while with generics in the language and out of
   `self/`.
9. **Whether the template graph should be built once for the whole program or
   per module.** §4 says once, over templates; a program-wide graph is simpler
   to reason about but means the rule can only fire after every module is
   loaded, so the error's position in the diagnostic order shifts. Worth
   checking against `reject_multi_*`'s expectations before G4.
