# WP2: Classes, interfaces, structs

What `class` and `interface` compile to, the layout rules, the checks the
compiler enforces (definite assignment, `readonly`, `implements`), and the
LLVM attributes it can prove for struct pointers. Every IR listing is the
exact text of a golden in `tests/cases/cls_*.ll` (module header omitted).

Code: `src/checker/classes.ts` (declarations, layout, rules) and
`src/codegen/emit/classes.ts` (lowering, memory facts). Both register into
the existing dispatch tables: `propertyCheckers.struct`,
`methodCallCheckers.struct`, `newCheckers["*"]`, the new
`assignmentTargetCheckers` table in `checker/members.ts` (keyed by the kind
of the assignment *target*, so `a[i] = v` can register next to `p.x = v`),
and their emitter mirrors. `src/codegen/attributes.ts` owns the pointer
parameter analysis described at the end.

## Layout

A class or interface `Name` is one LLVM type:

```llvm
%struct.Name = type { <field types in declaration order> }
```

A value of that type is a `%struct.Name*` into the arena (no copy semantics,
no vtable, no header). Field sizes and alignments are the natural ones:

| Field type | LLVM | size | align |
| --- | --- | ---: | ---: |
| `number` (i32 mode), `i32` | `i32` | 4 | 4 |
| `number` (f64 mode), `f64` | `double` | 8 | 8 |
| `boolean` | `i1` | 1 | 1 |
| `string` | `i8*` | 8 | 8 |
| class / interface | `%struct.X*` | 8 | 8 |

Each field starts at the next multiple of its alignment; the struct's
alignment is the largest field alignment; `sizeof` rounds the end up to it.
This is exactly clang's layout for the C struct with the same fields, so a C
program can read StaticTS objects through a matching `struct` (see the layout
test below). `sts_alloc_struct` rounds the allocation up to 8 bytes and
returns 8-aligned memory, so every object satisfies every field's alignment.

The ten structs of `tests/layout/structs.ts`, as the compiler and clang both
lay them out (`b` = boolean, `s` = string, `A*` = pointer to class A):

| Class | Fields | Offsets | sizeof |
| --- | --- | --- | ---: |
| A | i32 | 0 | 4 |
| B | i32, f64 | 0, 8 | 16 |
| C | f64, i32 | 0, 8 | 16 |
| D | b, i32, b | 0, 4, 8 | 12 |
| E | b, b, b | 0, 1, 2 | 3 |
| F | s, i32 | 0, 8 | 16 |
| G | i32, s, b, f64 | 0, 8, 16, 24 | 32 |
| H | b, A*, i32 | 0, 8, 16 | 24 |
| I | i32, i32, i32, b | 0, 4, 8, 12 | 16 |
| J | b, f64, b, i32, b, s | 0, 8, 16, 20, 24, 32 | 40 |

## Class declaration, `new`, constructor, method, field read

```ts
class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  manhattan(): number {
    return this.x + this.y;
  }
}

function sumX(p: Point, q: Point): number {
  return p.x + q.x;
}

export function main(): number {
  const p = new Point(3, 4);
  const q = new Point(10, 20);
  console.log(p.manhattan());
  console.log(sumX(p, q));
  console.log(p.y);
  return 0;
}
```

```llvm
%struct.Point = type { i32, i32 }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #3
declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #4 {
  ; the inline arena bump allocator, unchanged (see README)
}

define void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4
  ret void
}

define noundef i32 @Point.manhattan(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define noundef i32 @sumX(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p, %struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %q) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %q, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define noundef i32 @sts_main() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %q.addr = alloca %struct.Point*, align 8
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 3, i32 4)
  store %struct.Point* %1, %struct.Point** %p.addr, align 8
  %2 = call i8* @sts_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Point*
  call void @Point.constructor(%struct.Point* %3, i32 10, i32 20)
  store %struct.Point* %3, %struct.Point** %q.addr, align 8
  %4 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %5 = call i32 @Point.manhattan(%struct.Point* %4)
  %6 = call i8* @sts_str_from_i32(i32 %5)
  call void @sts_print(i8* %6)
  %7 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %8 = load %struct.Point*, %struct.Point** %q.addr, align 8
  %9 = call i32 @sumX(%struct.Point* %7, %struct.Point* %8)
  %10 = call i8* @sts_str_from_i32(i32 %9)
  call void @sts_print(i8* %10)
  %11 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %12 = getelementptr inbounds %struct.Point, %struct.Point* %11, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  %14 = call i8* @sts_str_from_i32(i32 %13)
  call void @sts_print(i8* %14)
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
```

- `new Point(3, 4)`: `call i8* @sts_alloc_struct(i64 <sizeof>)`, a `bitcast`
  to `%struct.Point*`, then `call void @Point.constructor(...)` with the
  object as the first argument. The allocator is the inline bump allocator
  from `runtime.ts`; after inlining an allocation is two loads, an add, a
  compare and a store.
- Constructors and methods are ordinary functions named `Class.member` whose
  first parameter is `%this`. They live in `CheckedProgram.functions`, so
  purity analysis, `--strict-exports` (`define internal`), cross-module
  `declare`s and symbol-clash detection treat them like free functions.
- `p.x` is `getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 <index>`
  followed by a `load` with the field's alignment; `p.x = v` is the same
  address and a `store`. Locals of struct type are pointer-sized allocas
  (`%p.addr = alloca %struct.Point*, align 8`) like every other local.
- Allocation is a memory write, so a function that contains `new` is neither
  `readnone` nor `readonly`; it keeps `willreturn` (the allocator is
  `willreturn`). A method that only reads fields is `readonly`
  (`Point.manhattan`, `sumX`); `Account.same` below, which only compares
  pointers, stays `readnone`.

## Field writes and compound assignment

```ts
function bump(c: Counter): void {
  c.count = c.count + c.step;
}

function bumpTwice(c: Counter): number {
  bump(c);
  bump(c);
  return c.count;
}

function halve(s: Stats): void {
  s.scale /= 2;
  s.total -= s.total % 2;
}
```

```llvm
define void @bump(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %c) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  %5 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  store i32 %4, i32* %5, align 4
  ret void
}

define noundef i32 @bumpTwice(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %c) #0 {
entry:
  call void @bump(%struct.Counter* %c)
  call void @bump(%struct.Counter* %c)
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define void @halve(%struct.Stats* noundef nonnull align 8 dereferenceable(12) nocapture %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 1
  %1 = load i32, i32* %0, align 4
  %2 = sdiv i32 %1, 2
  store i32 %2, i32* %0, align 4
  %3 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = srem i32 %6, 2
  %8 = sub i32 %4, %7
  store i32 %8, i32* %3, align 4
  ret void
}
```

`p.x op= v` computes the address once, loads, evaluates `v`, applies the
operator and stores; as in JS the field is read before the right-hand side
is evaluated. Only numeric fields accept compound assignment (`f64` fields
use `fadd`/`fdiv`/...). `bump` writes through `c`, `bumpTwice` only passes
`c` to a function that does: neither parameter is `readonly` (see the
attribute rules). `++`/`--` on fields are not supported yet (write
`p.x += 1`).

## `this`, method calls, recursion

```ts
class Account {
  balance: number;
  fee: number;
  ...
  charge(): void {
    this.balance -= this.fee;
  }

  drain(step: number): number {
    if (!this.withdraw(step)) {
      return this.balance;
    }
    return this.drain(step);
  }

  same(other: Account): boolean {
    return this === other;
  }
}
```

```llvm
define void @Account.charge(%struct.Account* noundef nonnull align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Account, %struct.Account* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Account, %struct.Account* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = sub i32 %1, %3
  store i32 %4, i32* %0, align 4
  ret void
}

define noundef i32 @Account.drain(%struct.Account* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %step) #0 {
entry:
  %0 = call i1 @Account.withdraw(%struct.Account* %this, i32 %step)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = getelementptr inbounds %struct.Account, %struct.Account* %this, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  ret i32 %3

if.end:
  %4 = call i32 @Account.drain(%struct.Account* %this, i32 %step)
  ret i32 %4
}

define noundef zeroext i1 @Account.same(%struct.Account* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, %struct.Account* noundef nonnull readonly align 8 dereferenceable(8) nocapture %other) #1 {
entry:
  %0 = icmp eq %struct.Account* %this, %other
  ret i1 %0
}
```

`this` is the `%this` parameter (immutable, like every parameter) and is
only valid inside a method or constructor. `this.m(args)` and `obj.m(args)`
are direct calls with the receiver first; methods may call free functions
and each other, recursively. `===` / `!==` on two values of the same struct
type compare pointers (identity); `<` and friends are rejected.

## Field initializers and the implicit constructor

```ts
class Defaults {                 // no constructor: `new Defaults()` stores the literals inline
  n: number = 42;
  neg: number = -1;
  flag: boolean = true;
  name: string = "anon";
}

class Mixed {                    // explicit constructor: initializers first, then the body
  hits: number = 0;
  limit: number;
  label: string = "mixed";

  constructor(limit: number) {
    this.limit = limit;
    if (limit > 100) {
      this.label = "big";
    }
  }
}
```

```llvm
define void @Mixed.constructor(%struct.Mixed* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %limit) #0 {
entry:
  %0 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %1, align 8
  %2 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 1
  store i32 %limit, i32* %2, align 4
  %3 = icmp sgt i32 %limit, 100
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8** %4, align 8
  br label %if.end

if.end:
  ret void
}

  ; new Defaults() in sts_main:
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Defaults*
  %2 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 0
  store i32 42, i32* %2, align 4
  %3 = sub i32 0, 1
  %4 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 2
  store i1 true, i1* %5, align 1
  %6 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 3
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %6, align 8
```

Initializers must be literals (a number, a negated number, a string, a
boolean) of the field's type. A class without a constructor gets no
`@X.constructor` symbol: `new X()` allocates and stores the initializers
inline, which is what an implicit constructor would do after inlining.

## Definite assignment

After a constructor returns every field holds a value, and no field is read
before it does. The rule, applied to the constructor body top to bottom with
the initialised fields as the starting set:

- `this.f = e;` as a statement (or a chain `this.a = this.b = e`) marks `f`
  assigned; so does the same form as a variable initializer.
- `if (c) A else B` marks what both arms mark. An arm that ends in `return`
  or `throw` does not constrain the other.
- Assignments inside loops, nested expressions (`g(this.f = 1)`), ternaries
  or calls do not count. Loop bodies are still checked for early returns and
  reads.
- Every `return` must see every field assigned
  ("Constructor of `P` returns before field `y` is assigned").
- Reading `this.f` (including `this.f += 1`) before `f` is assigned, calling
  `this.m()` before every field is assigned, or using `this` as a value
  (passing it, storing it, returning it) before every field is assigned, is
  an error. Methods may therefore assume every field is initialised.
- A class with no constructor must give every field an initializer.

This is deliberately conservative: it is a syntactic check on statements, not
a data-flow analysis. Rewrite `for (...) { this.x = ... }` as an unconditional
assignment before the loop.

## `readonly` and access modifiers

`public`, `private` and `protected` are accepted and ignored (no access
control is enforced; the layout is the same). `readonly` on a class field
forbids every assignment except `this.f = v` inside that class's own
constructor; `readonly` on an interface field forbids assignment altogether
(object literals still set it). `static`, `abstract`, getters/setters,
optional fields, index signatures, parameter properties, `!` assertions and
`extends` are rejected with a message naming the construct.

## Interfaces and object literals

```ts
interface Pair {
  first: number;
  second: number;
}

function swap(p: Pair): Pair {
  return { first: p.second, second: p.first };
}
```

```llvm
%struct.Pair = type { i32, i32 }

define noundef nonnull align 8 dereferenceable(8) %struct.Pair* @swap(%struct.Pair* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #0 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  store i32 %3, i32* %4, align 4
  %5 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 1
  store i32 %6, i32* %7, align 4
  ret %struct.Pair* %1
}
```

An interface is a struct type with the same layout rules and no methods,
constructor, or `new`. An object literal allocates in the arena and stores
every property in source order; every field must be set exactly once, with
no extras. Shorthand `{ first, second }` is accepted. Nested literals
(`{ tag: "t", pair: { first: 1, second: 2 } }`) allocate the inner object
first.

Object literals take their type from the context: the annotation of the
variable they initialise, the return type of the enclosing function, the
parameter of the user function, method or constructor they are passed to,
the field or variable they are assigned to, or the field of an enclosing
literal. Without one of these the literal is rejected
("Object literal needs a contextual class or interface type").

## `implements`

```ts
interface Shape { width: number; height: number; }

class Rect implements Shape {
  width: number;
  height: number;
  ...
}

function perimeter(s: Shape): number { ... }

function grow(r: Rect, by: number): Shape {
  r.width += by;
  return r;
}
```

```llvm
%struct.Shape = type { i32, i32 }
%struct.Rect = type { i32, i32 }

define noundef nonnull align 8 dereferenceable(8) %struct.Shape* @grow(%struct.Rect* noundef nonnull align 8 dereferenceable(8) %r, i32 noundef %by) #0 {
entry:
  %0 = getelementptr inbounds %struct.Rect, %struct.Rect* %r, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = add i32 %1, %by
  store i32 %2, i32* %0, align 4
  %3 = bitcast %struct.Rect* %r to %struct.Shape*
  ret %struct.Shape* %3
}

  ; perimeter(r) in sts_main:
  %2 = load %struct.Rect*, %struct.Rect** %r.addr, align 8
  %3 = bitcast %struct.Rect* %2 to %struct.Shape*
  %4 = call i32 @perimeter(%struct.Shape* %3)
```

`class C implements I` is checked structurally: `C` must declare exactly
`I`'s fields, in the same order, with identical types (the error names the
first differing field). Because the layouts are then identical, a `C` value
converts to `I` wherever an `I` is expected (variable initializer, return,
argument, assignment, field store, ternary arm) with one `bitcast`. The
checker records the conversion per expression (`CheckedProgram.coercions`)
from the same contextual-type rule that types object literals, and the
emitter core inserts the cast; `sameType` itself stays a comparison by name,
so `I` never silently becomes a `C`. A class that does not list `I` in its
`implements` clause is not assignable to `I` even with identical fields.

## Modules

`export class` and `export interface` work; `import { Point, Size } from
"./shapes"` binds them by name. The type name is part of the ABI
(`%struct.Point`, `@Point.constructor`, `@Point.method`), so renaming on
import (`Point as P`) is an error. The importer's module declares the
exported class's constructor and methods with the exporter's attributes,
like imported functions (`tests/link/class_export`):

```llvm
%struct.Point = type { i32, i32 }
%struct.Size = type { i32, i32 }

declare void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i32 noundef, i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(8) %struct.Point* @Point.shifted(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture, i32 noundef) #0
declare noundef i32 @area(%struct.Size* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #2
```

A struct type the module only points at (a field of an imported class whose
own class was not imported) is emitted as `%struct.X = type opaque`.
Non-exported classes in two modules with the same name clash exactly like
same-named functions do (their method symbols collide) unless
`--strict-exports` makes them `internal`.

## Attribute rules for struct pointers

Every attribute is a guarantee proved in `src/codegen/attributes.ts`:

| Attribute | On | When |
| --- | --- | --- |
| `noundef nonnull align 8 dereferenceable(sizeof)` | every struct param and return | All struct values come from the arena allocator: never null, 8-aligned, at least `sizeof` bytes (`dereferenceable` is omitted for an empty class). |
| `noalias` | `%this` of a constructor only | `new` hands the constructor a fresh allocation nothing else points at. Never on any other struct parameter: two parameters may be the same object. |
| `readonly` | a struct param | The function never stores through it (`p.f = v`, `p.f op= v`), never lets it escape, and only passes it to callees whose corresponding parameter is itself `readonly`, by a fixpoint over the call graph (`pointerParams`). |
| `nocapture` | a struct param | The pointer never escapes: it is not returned, not stored into a field, local or literal, and only passed to callees whose corresponding parameter is `nocapture` (same fixpoint). A method call `p.m()` passes `p` as `this`. |
| `readsMemory` -> `readonly` (function) | functions reading fields | A field read is a load through a pointer the function does not own. |
| `write` (no purity attr) | functions storing fields, `new`, object literals | Stores and arena allocation. Allocation keeps `willreturn`. |

Escaping is decided by the position of the parameter reference
(`classifyUse`): it is harmless as the receiver of a field read, an operand
of an arithmetic/comparison/logical operator, a condition, a hole of a
template that builds a new string, or an argument of a runtime builtin; it
escapes when returned, assigned or used to initialise anything, stored into
an object literal, passed to a user function (strings: always; structs: per
the callee's facts), or used in any way not on this list. Parentheses,
ternary arms and single-hole templates are transparent. This replaces the
earlier string-only rule and also fixes two gaps it had: `return c ? a : b`
and `const t = s; return t;` now correctly drop `nocapture`.

Examples from the goldens: `Point.constructor` gets `noalias nocapture` on
`%this` (stores through it, so no `readonly`); `Point.manhattan` gets
`readonly nocapture`; `widest(a, b)` returns one of its parameters, so both
lose `readonly` and `nocapture`; `Segment.constructor` stores `from`, `to`
and the string `label` into fields, so all three lose `nocapture`;
`endpoint(s)` returns `s.to` (a loaded pointer, not `s`), so `s` keeps both.

## Rejected forms

| Source | Message |
| --- | --- |
| `p.z` / `p.z = 1` (no such field) | `` Unknown field `z` on class `Point` `` |
| `this.value = 0` in a method, `readonly value` | `` Cannot assign to readonly field `value` of `Id` outside its constructor `` |
| `this` in a free function | `` `this` is only valid inside a method or constructor `` |
| `{ first: 1 }` for `Pair` | `` Object literal for `Pair` is missing field `second` `` |
| `{ first: 1, second: 2, third: 3 }` | `` `Pair` has no field `third` `` |
| field assigned in one `if` arm only | `` Field `y` of class `Point` is not definitely assigned in the constructor `` |
| field without initializer, no constructor | `` Field `x` of class `Point` has no initializer and no constructor assigns it `` |
| `this.y = this.x + x` before `this.x = x` | `` Field `x` is read before it is assigned in the constructor of `Point` `` |
| `new Point(1)` for a 2-parameter constructor | `` `new Point` expects 2 argument(s), got 1 `` |
| `implements` with fields in a different order | `` Class `Square` does not implement `Shape`: field 1 is `width: i32` in `Shape` but `height: i32` in `Square` `` |
| `x = 0;` without a type | `` Field `x` of class `Point` needs a type annotation `` |
| `class D extends B` | `` Class inheritance (`extends`) is not supported yet (WP2b) `` |
| `static total: number` | `` `static` members are not supported `` |
| `new Pair()` on an interface | `` Cannot `new` interface `Pair`; use an object literal `` |
| `const p = { first: 1 }` | `` Object literal needs a contextual class or interface type `` |
| `a < b` on struct values | `` Operator `<` requires two operands of the same primitive type, got Point and Point `` |
| passing a `Rect` that does not `implements Shape` | `` Argument 1 of `area`: expected Shape, got Rect `` |
| `import { Point as P }` | `` Classes cannot be renamed on import (`Point as P`) `` |

## Tests

- `tests/cases/cls_*.ts`: goldens, `llvm-as`, `opt -passes=verify`, and
  native round trips printing through `console.log` (`cls_point`,
  `cls_field_write`, `cls_nested`, `cls_interface_literal`,
  `cls_implements`, `cls_this_method_call`, `cls_initializers`,
  `cls_compound_field`, `cls_readonly_ok`, `cls_vector` under
  `--number-mode f64`); `reject_cls_*.ts` for every row above.
- `tests/layout/structs.ts` + `structs.c`: the runner reads each class's
  `sts_alloc_struct(i64 N)` from the IR and compares it with the
  `_Static_assert(sizeof(struct X) == N)` in the C file; then the C program
  is built with `clang -std=c11 -Wall -Wextra -Werror` (so the asserts are
  validated against clang's layout), fills every struct through the C
  definition and reads each field back through the compiled getters, so
  every offset is verified at run time too.
- `tests/link/class_export` (imports a class and an interface, checks the
  `declare`s attribute for attribute) and `tests/link/class_import_rename`.

## Not in this package

- Inheritance, `super`, virtual dispatch (WP2b), `static` members,
  getters/setters, `++`/`--` on fields, non-literal field initializers,
  optional fields and `T | null` (WP6), escape-analysed stack allocation of
  non-escaping objects (WP6), `noalias` on struct parameters other than a
  constructor's `this` (WP9 aliasing rule).
- `runtime/runtime.c` is unchanged: allocation goes through the existing
  inline allocator.
