# WP2: Classes, interfaces, structs

**Status: landed** before the first release (merged as `wp2/classes`,
6f0e601). WP2b, single inheritance, landed after it (36b45df) and was then
**removed** by [wp25-inheritance.md](wp25-inheritance.md), which also turned
`implements` from an exact field match into a *prefix* check. The
[Inheritance](#inheritance-wp2b) section below is the record of WP2b, not a
description of the language. [LANGUAGE.md: Classes](LANGUAGE.md#classes) and
[Interfaces and object literals](LANGUAGE.md#interfaces-and-object-literals)
are normative; the code is `src/structs.ts`, `src/members.ts` and
`src/emit-classes.ts`, and the goldens are `tests/cases/cls_*.ts` with
`reject_cls_*.ts` for the refusals.

## Layout

A class or interface `Name` is one LLVM type,
`%struct.Name = type { <field types in declaration order> }`, and a value of
it is a pointer to that struct: no copy semantics, no vtable, no header.
Fields take their natural size and alignment (`i32` 4, `double` 8, `i1` 1,
`string` and struct pointers 8); each starts at the next multiple of its
alignment, the struct is aligned to its widest field, and `sizeof` rounds up
to that. This is exactly clang's layout for the C struct with the same
fields, so a C program reads Nish objects through a matching `struct`. The
allocator returns 8-aligned memory, so every field's alignment holds.

`tests/layout/structs.ts` and `structs.c` pin it: the runner compares each
class's allocation size in the IR with a `_Static_assert(sizeof(...))` that
clang checks under `-Werror`, then fills every struct from C and reads each
field back through compiled getters, so every offset is verified at run time
too. The ten original structs (`b` boolean, `s` string, `A*` pointer to A):

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

## Lowering

- `new C(args)` allocates `sizeof(C)` (arena or, after WP6, stack when it does
  not escape) and calls `@C.constructor` with the object first. Constructors
  and methods are ordinary functions named `Class.member` with `%this` first,
  so purity analysis, linkage, cross-module `declare`s and symbol-clash
  detection treat them like free functions. Method calls are direct.
- A class without a constructor gets no constructor symbol: `new C()` stores
  the field initialisers inline. Initialisers are literals of the field's
  type, so they can be emitted without running code.
- `p.x` is a `getelementptr inbounds` and a `load` at the field's alignment;
  `p.x = v` and `p.x op= v` store to the same address, the old value read
  before the right-hand side as in JavaScript.
- `===`/`!==` on two values of one struct type compare identity.
- An object literal takes its interface type from context (an annotation, a
  return type, a parameter, an assignment target or an enclosing literal),
  allocates, and stores every field in source order; each field is set
  exactly once, with no extras.
- `export class`/`export interface` work across modules. The type name is
  part of the ABI (`%struct.Point`, `@Point.constructor`), so a class cannot
  be renamed on import. A struct a module only points at is emitted as
  `type opaque`.

## Rules, and why

- **Definite assignment** is a syntactic check on the constructor, top to
  bottom, not a data-flow analysis: `this.f = e;` statements mark a field, an
  `if` marks what both arms mark, assignments in loops, nested expressions or
  calls do not count, every `return` must see every field set, and reading
  `this.f`, calling `this.m()` or letting `this` escape before then is an
  error. In exchange, every method may assume every field is initialised.
  Rewrite a loop that sets a field as an unconditional assignment before it.
- **`readonly`** forbids every write but `this.f = v` in the declaring class's
  constructor. `public`/`private`/`protected` are accepted and ignored: the
  layout does not change, and no access control is enforced.
- **`implements` is checked, never inferred.** As built, `C` had to declare
  exactly `I`'s fields in order with identical types; since WP25 `I`'s fields
  must be `C`'s *first* fields (`cls_implements_prefix`). Either way the
  layouts agree, so a `C` converts to an `I` with one `bitcast` wherever an `I`
  is expected. The checker records the conversion on the expression
  (`coercions`) and the emitter inserts the cast; type equality stays by name,
  and a class that does not name `I` is not assignable to it even with the
  same fields.

## Attribute rules for struct pointers

Every attribute is a proof, made in `src/attributes.ts`:

| Attribute | On | When |
| --- | --- | --- |
| `noundef nonnull align 8 dereferenceable(sizeof)` | struct params and returns | Struct values come from the allocator: never null, 8-aligned, at least `sizeof` bytes. Not on `T \| null` (WP6). |
| `noalias` | a constructor's `%this` only | `new` hands it a fresh allocation. Never on another struct parameter: two parameters may be the same object. |
| `readonly` | a struct param | Never stored through, never escapes, and passed only to callees whose matching parameter is `readonly` (the `pointerParams` fixpoint). |
| `nocapture` | a struct param | Never returned or stored, and passed only to callees whose matching parameter is `nocapture`. `p.m()` passes `p` as `this`. |
| `readonly` (function) | functions that read fields | A field read is a load through memory the function does not own. Allocation and field stores are writes; allocation keeps `willreturn`. |

Escape is decided by where a parameter reference sits (`classifyUse`, which
WP4 and WP6 reuse): harmless as the receiver of a field read, an operand of an
arithmetic, comparison or logical operator, a condition, a hole of a template
that builds a new string, or a runtime builtin's argument; captured when
returned, assigned, used as an initialiser, stored in a literal, passed to a
user function whose facts say so, or used any other way. Parentheses, ternary
arms and single-hole templates are transparent, which is what makes
`return c ? a : b` and `const t = s; return t` correctly drop `nocapture`.

## Inheritance (WP2b)

Removed by WP25; recorded here because the prefix layout it introduced is
what `implements` is now.

- **Layout prefix.** `class D extends B` laid out `B`'s fields first, then
  `D`'s, so a `%struct.D*` was a `%struct.B*` after one `bitcast`. A derived
  field could land in the base's tail padding, which is why a C twin listed
  the fields flattened rather than nesting `struct B`.
- **Static dispatch.** `recv.m()` resolved in the checker to the `m` of the
  receiver's *declared* class or its nearest ancestor; there was no vtable, so
  `areaOf(s: Shape)` called `Shape.area` even when handed a `Square`. An
  override had to keep the signature, and `super.m()` resolved from the base.
  This was a documented deviation from JavaScript (the differential runner
  listed `cls_extends_override` as a known failure), and it is why WP25
  removed the feature rather than add a vtable: an indirect call is one the
  whole-program fact pass cannot see through, and a hierarchy without dynamic
  dispatch has none of the payoff.
- **Construction.** `super(args)` had to be the first statement of a derived
  constructor; definite assignment counted the inherited fields as set once it
  had run. A base class had to be declared in the same module, and an exported
  class could extend only an exported one.
- **What survived.** WP2b fixed an escape-analysis gap that still matters: a
  `new C(...)` whose constructor captures `this` leaks rather than becoming an
  alloca (`tests/cases/mem_stack_ctor_capture`).

## Not built here

Virtual dispatch, `abstract`, `static` members, getters and setters, optional
fields and index signatures are still refused (LANGUAGE.md lists each).
`++`/`--` on a field is still refused; write `p.x += 1`. `T | null` and
escape-analysed stack allocation came with WP6. `noalias` is still never put
on a struct parameter other than a constructor's `this`; field accesses are
told apart by `!tbaa` instead ([IR_COOKBOOK.md](IR_COOKBOOK.md#reading-the-attributes)).
