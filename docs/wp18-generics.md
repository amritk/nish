# WP18: Generics by monomorphisation

User generics for Nish: `function identity<T>(x: T): T`,
`class Box<T>`, `interface Pair<A, B>`, and `<T extends Shape>`. Every
instantiation is compiled to its own specialised code, named by a mangled
symbol, and is indistinguishable from the monomorphic version somebody would
have written by hand. There is no boxing, no type dictionary, no runtime type
information, and no generic code left in the binary.

This note was the design, written before the code. **Generic functions have
landed** — §15 records what shipped against what §11 planned, and where the
implementation chose differently it says why. Generic classes, constraints and
the whole-program half are still proposals. [LANGUAGE.md](LANGUAGE.md) stays
normative for what the language *is*; the rest of this file says what it should
become and why.

**Why at all.** Because Nish is a static subset of TypeScript and
TypeScript has generics. That is the whole reason, and it is enough: every
other rule in this repository exists to keep an Nish program a
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

**Nish-0 does not adopt them.** `self/` implements generics without
using them. §10 is the argument.

---

## 1. The decision, and the one it is not

| | |
| --- | --- |
| **Lowering** | Monomorphisation. One `define` per (template, type-argument tuple); one `%struct` per instantiated generic class or interface. |
| **Discovery** | Whole-program, on a worklist owned by the `Compilation`, seeded from every annotation and every call the checker resolves. |
| **Definition** | One, in the module that declares the template. Other modules `declare` it. Never `linkonce_odr`. |
| **Inference** | From the argument types, at a call site. Type arguments are written out in an annotation (`Box<i32>`) and after `new` (`new Box<i32>(v)`), never at a call. |
| **Termination** | A static rule — no edge on a cycle in the template graph may put a type parameter under a constructor — plus a hard instantiation cap as a backstop. |
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
const identity = <T>(x: T): T => x;
const firstOf = <T>(xs: T[]): T => xs[0];
const swap = <A, B>(p: Pair<A, B>): Pair<B, A> => ...;

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
TypeScript and in Nish (`isIdentStart` in `self/lexer.ts` accepts
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
`NISH_SYMBOL`, which is how `Point.shifted` becomes `Point_shifted`. It needs
one character added to its condition. Measured end to end:

```c
int identity_i32(int x) NISH_SYMBOL("identity$i32");
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

### The rule: no expanding edge on a cycle

Build the **template dependency graph** once, over templates rather than
instantiations, so it is a property of the source and needs no enumeration:

- A node is a generic template — a function, a class or an interface.
- An edge `f → g` exists for each place `f`'s body or `f`'s fields ask for an
  instantiation of `g`, and it is labelled with the type arguments *as the
  checker resolved them*, in terms of `f`'s own parameters. "As the checker
  resolved them" rather than "as written", because inference produces edges
  nobody spelled: `grow([x], n - 1)` below asks for `grow<T[]>` with no type
  argument in the source at all.
- Each type argument on an edge is one of three things, and only the third is
  a problem:

  | The argument | Example, in `f<T>` | Verdict |
  | --- | --- | --- |
  | **a bare parameter of `f`** | `T` | non-expanding: it passes the caller's tuple on unchanged |
  | **ground** — mentions no parameter of `f` | `i32`, `string`, `Box<i32>`, `Point[]` | non-expanding: it names one fixed instantiation, and re-entering the cycle from there asks for that same one again |
  | **a constructor applied to a parameter of `f`** | `T[]`, `Box<T>`, `Result<T, E>`, `T \| null` | **expanding**: it builds a type strictly larger than the one it started from |

- An edge is **expanding** when one of its type arguments mentions a parameter
  of the source template without being exactly that parameter.

> **A cycle in the template dependency graph is legal only if no edge on it is
> expanding.**

**A self-edge is a cycle.** `grow → grow` is the shape this rule exists for and
it is a path of length one, so a cycle detector that only looks for paths of
length two or more misses every case that matters. Say it in the code, and test
it: `reject_generic_polymorphic_recursion` is a self-edge and nothing else.

**Soundness.** Let `S` be the set of all *subterms* of every type expression
the program mentions: every annotation, and every type inference reads off a
concrete argument. `S` is finite, and it is fixed before monomorphisation
starts, because unification only *selects* subterms — `unify(T[], i32[])`
yields `i32`, which is already a subterm of `i32[]` — and never builds a type
that was not there.

Now walk a legal cycle. Every type argument on it is either a bare parameter,
and so copied from the tuple the cycle was entered with, or ground, and so
written in the source and therefore in `S`. **Nothing on a legal cycle
constructs a type.** Every instantiation's tuple therefore lies in `S^arity`:
at most `|S|^arity` per template, visited once each by the worklist, which
drains. An expanding edge is exactly the one that constructs — `Box<T>` leaves
`S` as soon as `T` ranges past what is written — which is why it is the one
case refused.

The bound is over `S` rather than over the seed's own arguments, and that is
the correction the ground case forces: a cycle can introduce a type the seed
never mentioned (`countDown$str` introduces `countDown$i32`), so a bound of
`arity^arity` over the seed tuple alone would be wrong. It cannot introduce a
type the *program* never mentioned, which is what keeps the set finite.

**Completeness**, in the sense that matters: it accepts every shape real code
writes. Parameter-propagating recursion —

```ts
const sumTree = <T>(node: Node<T>): i32 =>
  sumTree(node.left) + sumTree(node.right);          // Node<T> -> Node<T>
```

— and ground recursion, where the recursive call binds the parameter to a
concrete type:

```ts
const countDown = <T>(x: T, n: i32): i32 => {
  if (n === 0) { return 0; }
  return countDown(1, n - 1);       // inference binds T := i32: ground, accepted
};
```

`countDown("hi", 3)` gives exactly two instantiations. `countDown$str`'s edge
asks for `countDown$i32`; `countDown$i32`'s edge asks for `countDown$i32`,
which is already in the set; the worklist drains after one step. The same
argument covers mutual recursion where a generic helper bottoms out at a
concrete type, which is the other shape that would have been refused by a rule
that only admitted bare parameters.

What is refused is the shape that grows:

```ts
const grow = <T>(x: T, n: i32): i32 => {
  if (n === 0) { return 0; }
  return grow([x], n - 1);          // refused: `[x]` is `T[]`, so this asks for grow<T[]>
};

class Nest<T> {
  inner: Nest<T[]> | null;          // refused: the field expands
}
```

Nobody wrote a type argument in `grow`. Inference produced the expansion from
`[x]`, which is why the rule is stated over the graph the checker builds rather
than over the syntax the user typed.

The same rule covers classes and functions because it is stated over
"templates", and a class's *fields* are edges exactly as a function's *calls*
are. That is why the graph is built once, in one place, and why the struct half
of it lands with generic classes rather than as a second mechanism. The walk is
over the whole ancestry rather than the parent, so a cycle that goes through
two other classes before it comes back is refused with the same sentence, and
the sentence names the two ends of the cycle rather than whichever struct held
the annotation — `tests/cases/reject_generic_expanding_field_chain` is the
three-deep case.

The diagnostic names the chain, not a number (§8, message 5). That is the whole
reason to prefer a rule over a limit: a user is told which type argument is
under a constructor, and that the fix is to pass the parameter itself or a type
that does not mention it.

### 4a. The recovery: what a refused request answers with

The rule above says which requests are refused. It leaves a second question,
and it is a decision about the language rather than about the implementation:
**how many diagnostics does one non-terminating monomorphisation produce?**

A refused request is still a request for a *type*. `Nest<i32>`'s `inner` field
has to resolve to something, or the class the programmer did write is left
without it, and every later mention of that class is refused a second time for
a mistake nobody made. That is what both compilers used to do, and they did not
even do it the same way: stage0 carried on with a `Nest$i32` that had no
`inner` and said "Unknown field `inner` on class `Nest$i32`" at the use; stage1
carried on with an `inner` whose type had never been made and said "`null`
needs a contextual `T | null` type" at the comparison, which is advice about
an annotation that is not the fix. Fourteen rows of
`node tests/run.js --parity` were that disagreement.

**The answer is one diagnostic per mistake, and the request is answered with
the instantiation it grew from.** `Nest<i32[]>` is refused and the requester is
handed `Nest<i32>` — which is exactly the program the sentence tells the reader
to write, "name `T` itself". Three things follow, and they are the argument for
this shape over the two the code had:

- **The class keeps its field and its layout**, so nothing downstream has to
  invent a second mistake to describe a type that is missing. "One diagnostic"
  is per offending *annotation*, not per program: a class with two fields that
  both name `Nest<T[]>` has two of them to fix and is told about both, where
  before it was told about the first and then about a consequence.
  `tests/cases/reject_generic_expanding_field_twice` pins both spans.
- **Multi-error reporting is untouched.** Nothing is thrown away and no
  recovery point is removed: an *unrelated* mistake below the refusal is still
  reported, which is what `tests/cases/reject_generic_expanding_field_recovered`
  pins — that case's second fragment also holds the recovered type to the
  ancestor, since it is the only thing the sentence about `Nest<i32>` could
  otherwise be. A rule that stopped the compilation at the refusal would have
  bought the same single diagnostic by giving up the rest of the file.
- **Nothing is emitted either way**, because the program is refused. The
  recovery decides only how much the reader is told about one mistake, never
  what the compiler produces.

Both compilers recover at the same point — `instantiateStruct`, immediately
after `expandingStructAncestor` finds the ancestor whose arguments grew — and
stage0 reports it without throwing so that the members after the refused one
are still collected and refused too. `reject_generic_expanding_field` is the
case, `tests/wordings/nl2319_generic_expanding_field` pins the sentence byte
for byte, and `node tests/run.js --parity --only reject_generic_expanding_field`
is what holds the two compilers to the same answer.

**The recovery is a declaration's, and that is the line it is drawn on.** The
first shape of this rule drew it between the struct half and the function half,
which was the wrong place: `expandingStructAncestor` walks the chain
`currentStructInstance` maintains, and that chain is set both while a struct's
members are collected *and* while one of its methods is checked, so the struct
half is reachable from an expression too.

```ts
class Nest<T> {
  inner: Nest<T> | null;            // fine: `T` is passed on
  grow(): void {
    const z: string = new Nest<T[]>();   // refused, from a *body*
  }
}
```

A field's type is a layout: it has to be *something* or the class loses it, and
the ancestor is the well-typed something a step up its own chain. The value of
a `new` expression is not a layout — it flows into the statement around it — so
a substitute there buys nothing and costs a second sentence about a mistake
nobody made, naming `Nest$i32`, a symbol nobody wrote. That is the very defect
this section exists to remove, so the expression keeps the refusal's throw and
the per-statement recovery ends the statement with one diagnostic, exactly as
every other checker error does.
`tests/cases/reject_generic_expanding_field_method` is that case, and its
`2 errors` fragment is the assertion: the unrelated mistake on the line below
is still reported, and the cascade is not.

Both compilers read the same thing to tell the two apart, because both
maintain it the same way: `collectInstanceMembers` is the one caller that
clears `currentInstance` while `currentStructInstance` is set, so an empty
`currentInstance` at the refusal means the struct's own members are being laid
out and anything else means a body is running.

**The function half keeps the old answer** for the same reason rather than for
one of its own: a request for a generic *function* is only ever made from an
expression. `grow<T[]>` is asked for from inside `grow<T>`'s own body, so
handing the caller `grow<i32>`'s signature back would check `[x]` against
`x: i32` and produce exactly that second diagnostic. The same goes for the two
caps below: a program that asked for 4,097 instantiations has no ancestor that
is the right answer either. `reject_generic_polymorphic_recursion` is the
function half's case, and the two compilers already agree on it.

The recovered case's second diagnostic shows the same type spelled two ways in
one report — `Nest<i32>` in the refusal, `Nest$i32 | null` below it — and its
`.err` pins that, because it is what both compilers do today. That is the
display-name gap §16's G8 entry already records, not a fact about this rule.

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
const identity = <T>(x: T): T => x;

export const main = (): i32 => {
  console.log(identity(7));
  console.log(identity("hi"));
  return 0;
};
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
const eq = <T>(a: T, b: T): boolean => a === b;
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
  %0 = call zeroext i1 @nish_str_eq(i8* %a, i8* %b)
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

export const main = (): i32 => {
  const n = new Box<i32>(7);
  const s = new Box<string>("hi");
  console.log(n.get());
  console.log(s.get());
  return 0;
};
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
and there is no `nish_alloc_struct` in the module:

```llvm
define noundef i32 @nish_main() #0 {
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
int32_t identity_i32(int32_t x) NISH_SYMBOL("identity$i32");
```

with the C-identifier collapse and the `NISH_SYMBOL` binding of §3c, which is
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
   Type arguments are not written at a call site in Nish: `T` is inferred
   from the arguments, so write `identity(x)`; a type argument is written out in an
   annotation (`const b: Box<i32>`) and after `new` (`new Box<i32>(v)`)
   ```

5. **Non-terminating monomorphisation** — the important one. It names the type
   argument that is under a constructor and the chain that follows from it,
   never a number, and it must not fire on a ground argument (§4): the fix
   clause therefore offers both of the shapes the rule accepts.

   ```
   Monomorphising `grow` would not terminate: `grow<T>` asks for `grow<T[]>`, which
   puts `T` under a constructor instead of passing it on, so `grow<i32>` ->
   `grow<i32[]>` -> `grow<i32[][]>` has no end; pass `T` itself, or a type that does
   not mention `T`
   ```

   and its field form

   ```
   `Nest<T>` would not terminate: the field `inner` is `Nest<T[]>`, which puts `T`
   under a constructor, so laying out `Nest<i32>` needs `Nest<i32[]>`, which needs
   `Nest<i32[][]>`; mention `Nest` at `T` itself, or at a type that does not mention
   `T`
   ```

   The type argument the message quotes is the offending one, so a template
   with several arguments names the one that grows rather than the whole list.

6. **Instantiation cap** — says it is a limit, not a rule

   ```
   `Box` has been instantiated 256 times, which is this compiler's limit rather than
   a rule of the language; the chain that reached it starts at `Box<i32>`
   ```

7. **`$` in a declared name**

   ```
   `Box$i32` cannot be the name of a class in Nish: `$` separates a generic's
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

## 10. Nish-0 does not adopt them

`self/` implements generics. `self/` is not written with them.

`docs/wp14-selfhost.md` §2 fixes Nish-0 as the subset the self-hosted
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
   "Nish-0 does not grow quietly" fires when a construct is added to the
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
| **G4** | **Termination**, for functions. The template graph (self-edges included), the no-expanding-edge rule with its three argument cases, the two caps, messages 5 and 6. Lands immediately after G3 because G3 can already diverge. | `src/checker/generics.ts` | `self/generics.ts` | `reject_generic_polymorphic_recursion`, `reject_generic_instantiation_limit`, and the two positives `gen_recursive_same_type` and `gen_recursive_ground`; `reject_oracle.js` on both messages. |
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
| `gen_recursive_same_type` | Parameter-propagating recursion, which must be *accepted*: the self-edge is labelled `T`. |
| `gen_recursive_ground` | Ground recursion — `countDown(1, n - 1)` inside `countDown<T>` — which must also be *accepted*, and whose instantiation set is exactly two entries. The other half of §4's boundary, and the case a rule that only admitted bare parameters would have refused. |
| `dbg_generic` | Two `DISubprogram`s, distinct `linkageName`, shared `line`, `name: "identity<i32>"`. |

**Negatives** (`tests/cases/reject_generic_*`), one per message in §8:
`arity`, `unsatisfied_constraint`, `uninferable`, `call_type_args`,
`polymorphic_recursion`, `expanding_field`, `instantiation_limit`,
`dollar_name`, `extends_type_param`, `member_unconstrained`,
`export_uninstantiated` (with an `.args` naming a sidecar flag). Each names the
rule it breaks in a one-line comment, so that a case which also fails for a
second, accidental reason is caught in review.

`reject_generic_polymorphic_recursion` is `grow` from §4 — one expanding
self-edge and nothing else, so it also pins that a self-edge counts as a cycle.
It and `reject_generic_expanding_field` are the negatives that
`gen_recursive_same_type` and `gen_recursive_ground` sit opposite: between the
four, both sides of §4's boundary are pinned by a test rather than by prose.

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
- **Generics in Nish-0.** §10. `self/` implements them and does not use
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
   **Answered for a *struct* name, still open for a function's.** G5's review
   found the struct half live — `class Box_i32` beside `Box<i32>` emitted two
   `struct Box_i32` definitions and the header did not compile — so
   `cStructName` is injective now (§15.4), and `cFunctionName` is G8's, where
   `NISH_SYMBOL` means the answer can be a rename rather than a refusal.
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


---

## 15. What landed

Generic **functions**, in both compilers, single module: §11's G2 (for
functions), G3 and G4, merged into one change because G4 cannot be later than
G3 and G2's "collect the template and refuse every use" state is not worth a
commit of its own once G3 is in the same branch.

Generic **classes and interfaces** (G5) followed, in both compilers, single
module: a `StructInfo` per instantiation, methods and a constructor per
instantiation, type arguments after `new` and in an annotation, `implements`
over an instantiated interface, and the struct half of the termination rule.
§15.4 records what it decided differently from §11's sketch.

The **whole-program rule** (G7) followed: a template may be exported, imported
and instantiated from anywhere, each instantiation is defined once in the
module that declares the template, and every other module `declare`s it. §15.5
records what *it* decided differently, including the trap §16 marked, which is
closed. Constraints (G6) and the peripheries (G8) are not done; §16 is the
order to take them in.

The acceptance test of §9 holds and is checked rather than asserted:
`tests/cases/gen_identity.ll` is `str_param_passthrough.ll` with the symbol
renamed, and `gen_eq_purity.ll` is `str_eq.ll`'s `@same` beside an `i32`
comparison, each with its own attribute group. `IR(stage0) == IR(stage1)` holds
byte for byte over every new case, and the bootstrap still reaches its fixed
point over an unchanged `self/`.

### 15.1 Four decisions the code made differently

**G1's accessor refactor did not happen, and is not needed.** §3d recommended
putting every node-keyed side table behind an accessor so an instantiation
could answer from its own overlay. The cheaper shape with the same effect is to
**swap the tables themselves**: `swapTables` in `src/checker/generics.ts` and
`CheckedProgram.enterInstance` / `leaveInstance` in `self/program.ts` point the
program's seven (stage0) or six (stage1) table fields at the instantiation's
copies for the duration of one body, so every existing `program.types.get(node)`
answers for the instantiation without moving. Five call sites bracket a body
walk that way — the checker, the escape analysis, the attribute fixpoint, the
emitter and the `--emit-checked` dump — and no read site changed at all. There
is never more than one installed at a time, because the worklist is drained in a
loop rather than recursed into and every other caller walks one function at a
time.

**A type parameter is never a type.** §3a spoke of `resolveTypeNode` returning
the instantiated struct; for functions the implementation goes further and
never resolves a template's annotations at all. They stay as syntax, and one
instantiation resolves them with `T` bound in the checker's named-type resolver
(stage0) or in `ctx.typeBindings` (stage1). Nothing was added to `StaticType`
or to the `TypeTable`, so `llvmType`, `alignOf`, `sameType`, `typeToString` and
every `switch` over a type kind are untouched — which is most of why the change
is as small as it is. Inference is unification over *annotation shapes* against
argument types for the same reason.

**Termination is checked on the request, not on a template graph.** §4 builds a
template dependency graph and refuses an expanding edge before any instantiation
exists. The implementation refuses the same programs one step later: when an
instantiation asks for one of the *same template* whose type argument strictly
contains its own, at any depth of the request chain. `reject_generic_polymorphic_recursion`
and `gen_recursive_ground` pin both sides of the boundary, and the message is
better for it — it names the concrete chain (`` `grow<i32>` asks for `grow<i32[]>` ``)
rather than the symbolic one. The one program the two rules disagree about is a
generic that would not terminate and is *never called*: the graph refuses it,
this refuses nothing because nothing is instantiated. §14's question 9 is
answered by construction — there is no graph, so nothing about diagnostic order
moves.

**`mangleType` gained a tag for `readonly T[]`.** `readonly T[]` and `T[]` are
two types that `sameType` tells apart, and both mangled to `arr.<elem>`, so
`identity<readonly i32[]>` and `identity<i32[]>` would have been one symbol.
They are `roarr.` and `arr.` now. Nothing in the tree mangled a readonly array
before this, so no golden moved; `tests/self/types_oracle.js` holds the two
compilers to the new spelling.

### 15.2 What is refused, and with what

Eleven rules, each with a `reject_*` case that names it. Six are the package's
own — uninferable type parameter (`reject_generic_function`, the old case
re-pointed at the rule about a generic function that survives), type arguments
at a call site, non-terminating monomorphisation, `$` in a declared name, a
constrained parameter, wrong arity — and five are the "not yet" boundary: a
generic class or interface, a generic type alias, a generic method, a generic
`main`, and instantiating a generic imported from another module.

`reject_generic_class`, `reject_type_alias_generic`, `reject_generic_method`
and `reject_generic_constraint` are refused by stage1's *parser* rather than in
the words stage0's Phase 0 writes, which is the declared difference
`tests/self/parity.js` already carries for 43 cases of the corpus and
`reject_oracle.js` counts apart. `reject_generic_call_type_args` is not: stage1
recognises `(identity < i32) > (7)` for what it is and writes stage0's message,
at stage0's span, because a checker message is not a grammar difference.

### 15.3 The cost, measured

`.text` at `--profile size`, for a program that instantiates one template at
one, two, four and eight type arguments and prints each result:

| instantiations | `.text` | binary | `define`s |
| --- | --- | --- | --- |
| 1 | 732 B | 5,192 B | 3 |
| 2 | 908 B | 5,368 B | 4 |
| 4 | 1,860 B | 6,488 B | 6 |
| 8 | 2,985 B | 7,776 B | 11 |

Read it for what it is rather than as a slope: the rows differ by more than the
instantiation, because printing an `i64`, an `f64`, a `string` and an array all
lower differently, and the eight-argument row carries five `define`s the
one-argument row does not. What the numbers do say is the shape — the cost of
generics is one copy of the body per distinct type-argument tuple and nothing
else, which is the honest answer for a monomorphising compiler and exactly what
the byte-identity check in `tests/run.js` pins: the marginal cost of an
instantiation *is* the cost of the function somebody would have written.

The other half is the one that had to be measured and is: a program that
instantiates nothing pays nothing. No overlay is allocated, no table is swapped,
and the bootstrap over an unchanged `self/` reaches the same fixed point —
`tests/self/bootstrap.js` reports `IR(stage0) == IR(stage1) == IR(stage2)` and
stage3 byte-identical to stage2 over **56 modules and 7,617,344 bytes of IR**,
which is §10's claim tested rather than asserted.

### 15.4 G5, and the four decisions *it* made differently

**`extends` is moot, not deferred.** §2 and §6.2 spend a paragraph each on
`class Box2<T> extends Box<T>` and `class IntBox extends Box<i32>`. Neither
exists to support: WP25 removed inheritance from the language after this note
was written (`docs/MASTER_PLAN.md` §3.4, "Class inheritance — **Decided
(WP25): none**"), so `extends` on any class, generic or not, is refused with
the message that names the rewrite, and §8's message 10 has nothing to fire
on. What replaced `extends` — a prefix-checked `implements` — works on an
instantiation exactly as it works on a declared class, which is
`tests/cases/gen_implements`.

**`implements` is checked per instantiation, not at the template.** §6.3 argued
for comparing the *uninstantiated* field lists, on the ground that a match with
`T` a variable is a match for every `T`. That comparison needs a type variable
to compare, and §15.1's first decision is that a type parameter is never a
type: there is nothing in `StaticType` or the `TypeTable` for `T`, by design,
and putting one there to save a repeated diagnostic would undo most of why this
change is small. So `class Box<T> implements Container<T>` is checked once per
instantiation, by the ordinary field-prefix rule, against `Container$i32`. The
cost is one message per instantiation where §6.3 wanted one; the benefit is
that the *interface* may itself be an instantiation, which the template-level
check could not have expressed.

**Termination is a request chain here too, not the template graph.** §16 says
the struct half "cannot be a request-chain check, because a field's type is
resolved while the struct is collected rather than while a body runs". That is
true of the *function* chain and not of the answer: the checker keeps a second
cursor, `currentStructInstance`, which is the struct whose members are being
collected or whose method body is being checked, and `expandingStructAncestor`
walks it exactly as `expandingAncestor` walks the function one. So there is
still no template graph, §14's question 9 stays answered by construction, and
the message names the concrete chain — `` `Nest<i32>` names `Nest<i32[]>` ``
rather than the symbolic one (`tests/cases/reject_generic_expanding_field`).

What the struct half *did* need was a widening of `containsType`: an
instantiated class is an ordinary struct (§3c) and its `StaticType` therefore
carries no type arguments at all, so `grow<T>` asking for `grow<Box<T>>` looked
like a request for an unrelated named type. It reads them back out of the
instantiation the mangled name belongs to, which also fixes the same hole on
the function side — a hole that was unreachable until this milestone, because
there was no `Box<T>` to write.

**An instantiated name is program-wide, and packages have nothing to do with
it.** `%struct.Holder$i32` and `@Holder$i32.constructor` are one name for the
whole program however many modules asked for them, so two modules that each
declare a private `Holder<T>` and each instantiate it at `i32` are a
miscompile: the second registration replaces the layout the first one's objects
were built with, a field read through an imported signature lands on the wrong
offset, and the entry module emits a `define` for a symbol it also `declare`s,
which `llvm-as` refuses. The *declared*-class spelling of that mistake is
caught before bodies are checked, by `@Holder.constructor` clashing in
`rejectSymbolClashes`; a generic class has no symbol at all until an
instantiation exists, so the check has to run after `drainInstantiations`,
where the set is final. G5 first shipped it scoped to two *packages*, which was
the case §9c's declared-struct rule already had words for and which left the
ordinary two-modules-of-one-program case silent. It is one check over both now,
with the package wording where the packages differ and
`rejectSymbolClashes`'s generic-function sentence, noun changed, where they do
not: `tests/link/generic_class_clash` and `package_generic_class_clash` are the
two halves.

**The C spelling of a struct name had to be collapsed.** §14's fourth question
asks about a *function*-name collision in the generated header; the thing that
had to be fixed to ship this is a level below it. `--emit-header` wrote
`struct Box$i32`, and `-pedantic` refuses `$` in a C identifier — the same
measurement §3c records for `identity$i32`, which `cFunctionName` already
handled. A struct's name is a *type*, not a linker symbol, so unlike a function
there is nothing to bind back with `NISH_SYMBOL`: the struct simply has a C
spelling and an LLVM spelling, and the layout is the only thing that crosses.
`tests/layout/structs.ts` now declares one generic class at two type arguments
and `structs.c` declares the two twins, so clang checks both instantiated
layouts at compile time and every field offset of both at run time.

**What the collapse alone does not buy is injectivity**, which is the half the
first version of `cStructName` got wrong. It collapsed `.` and `$` to `_` "the
way `cResultName` does" — but the collapse is not what makes *that* one
injective. `nish_result.` is a prefix a user's own class can never spell, and
every name under it is `mangleType`'s alone. Half of an instantiated generic's
name is user-chosen, so it needs both halves of the argument written out, and
`cStructName` now has them: a *declared* class or interface passes through
untouched, so the header of every program that existed before generics says
exactly what it always said, and an instantiation is `nish_gen_` — reserved,
because `nish_` is already refused in a declared name — followed by the
collapse with the user's own `_` escaped to `_0`. Without the prefix a program
that declares `class Box_i32` beside `Box<i32>` emits two `struct Box_i32`
definitions and the header does not compile; without the escape `Box_arr<i32>`
and `Box<i32[]>` are one name. `tests/cases/gen_export_header` is the first of
those, compiled under `-Wall -Wextra -Werror -pedantic`.

### 15.5 G7, and the five things it had to decide

**The request crosses a module boundary; the work does not.** A template is
monomorphised in the scope it was *declared* in, because that is the only scope
its annotations and its body mean anything in — `wrap<T>(x: T): Node` names the
declaring module's `Node`, not the caller's. So `Checker.instantiate` and
`self/generics.ts`'s `instantiate` forward to `template.home` and keep only the
*site*: the file the call was written in, and the instantiation whose body made
it. The site is what a termination or cap refusal is reported against, which is
why it travels rather than being read off the answering module — whose own
cursors are about its own work. A local template is the same path with
`home === this`, which is every program that existed before G7, and the
`IR(stage0) == IR(stage1)` equality over the whole corpus is unmoved.

**The trap §16 marked is closed by construction rather than by a rule.** An
instantiation's symbol is now minted from `template.home.symbolPrefix`, and an
instantiated class's methods from `instance.template.home.symbolPrefix` in
`collectInstanceMembers` — the two `TODO(WP18 G7)` lines, gone. Reading the
prefix off the *template* is what makes the answer right whoever asked, instead
of right because the module that instantiates is always the module that
declares. `tests/link/package_generic_import` is the program that would have
been miscompiled: a package exports `pick<T>` and `Holder<T>`, the root package
and a second package both instantiate them at `i32`, and there is one
`@pkg_lib.pick$i32` and one `@pkg_lib.Holder$i32.get` for the whole program.
`tests/link/package_generic` is the other half of the pair and is unchanged:
three packages each declaring a *private* `pick<T>` still mint three symbols.

**A type argument carries its layout across.** `identity<Point>` puts a
`%struct.Point` into the module that declares `identity`, which may never have
heard of `Point` — so the request brings the layout with it, and the answer
brings back whatever the instantiated class itself reaches. Both go through the
one closure `closeReachableStructs` already performs for an imported class,
with one difference stated where it is made: a layout going *out* brings no
symbols. The language has no way to call a member of a type parameter, so the
template's module never emits a call to one, and declaring them anyway would
put a `declare` in front of a definition `--strict-exports` made `internal` in
the module it came from.

**A signature annotation could only write the request down.** Pass 1 runs as
each module is parsed — which is what makes an import cycle legal — so
`Box<i32>` in an exported signature is resolved before a single import is
bound, and there is no template in hand. The *name* is knowable anyway, because
§3c makes an instantiation `instanceSymbol(<the exporter's name>, <the
arguments>)` and both halves are there, so the annotation resolves to the
struct it is going to be and the request is made in a new sub-pass after every
module has bound. That sub-pass is also where the one new rule of this
milestone is stated: a type-argument list on an imported name that is not a
template (`` `Point` in `./lib` takes no type arguments ``, NL2325), which
cannot be refused where it is written because at that point nothing knows what
`Point` is.

**Two questions about a mangled struct name had to come apart.** "Which
arguments was `Box$i32` made from?" is answered off the *layout* now, so that a
`Box$i32` a module imported reads back its arguments exactly as one it asked
for itself does — the termination rule and inference both have to see through
the difference. "Has *this module* already registered one?" stays the module's
own request log, and the two are deliberately not one method:
`tests/link/generic_class_clash` is two modules each declaring a private
`Holder<T>`, and merging the questions makes the second module reuse the
first's layout instead of registering a clashing one, which is the miscompile
that case exists to catch. stage1 made exactly that mistake first, and the
reject oracle is what said so.

---

## 16. What is next, in order

1. ~~**G5, generic classes and interfaces.**~~ **Landed** — §15.4 records what
   it decided differently, including that the struct half of the termination
   rule *is* a request chain after all, over a second cursor rather than over a
   template graph.
2. ~~**G7, whole-program.**~~ **Landed** — §15.5 records what it decided, and
   the trap this entry used to warn about is closed: an instantiation's symbol
   is minted from the *template's* `symbolPrefix` rather than the instantiating
   module's, in `instantiate` and in `collectInstanceMembers` on both sides, so
   two packages importing one generic mint one symbol for one function instead
   of one symbol for two. `tests/link/package_generic_import` pins it,
   `tests/link/generic_import` and `generic_two_importers` are §12's two cases,
   and the two refusals that stood in for the milestone are deleted (their
   codes, NL2298 and NL2316, are retired in `tests/wordings/unreachable.txt`
   and reserved for ever, as every retired code is).
3. **G6, constraints.** Member access on a constrained parameter admitted at the
   template, satisfaction checked at each instantiation. Small next to G5, and
   it wants G5 first because `<T extends Shape>` is most useful on a container.
4. **G8, the peripheries.** `-g` naming (`dbg_generic`), the three interop
   sidecars and the C-name collision of §14 question 4, the differential
   rewrite's one-JS-function-per-instantiation, and the fuzzer learning to emit
   a generic declaration. §6.7's display name is G8's too, and G5 left a case
   for it to fix: a diagnostic about a chain through an instantiated class
   quotes the mangled spelling — `` `grow<i32>` asks for `grow<Box$i32>` ``
   — because `typeToString` answers from the type alone and an instantiated
   class is an ordinary struct that carries no arguments. It is correct and it
   is what the IR and the header say; it is not what the user wrote. The interop half has a decision waiting in it: an
   exported template with no instantiation produces no symbol, and §8 message 9
   says that should be an error when a sidecar is asked for. It is not one yet.
5. **Generic methods on a generic class** (§14 question 7) and
   **contextual-return inference** (§2a) stay deferred with their stated
   triggers.
