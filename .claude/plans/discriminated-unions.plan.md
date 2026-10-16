---
name: Discriminated unions
overview: Accept a union of classes and interfaces whose first field is a readonly enum-member tag, lowered as one pointer to the variant, narrowed by testing the tag with `===`, `!==` or `switch`. Every other union stays refused, and the source stays TypeScript that tsc --strict accepts.
stages:
  - id: enum-member-types
    title: "feat(checker): enum member types such as Kind.Array"
    goal: Let a member such as Kind.Array be written as a type, so a readonly tag field can hold exactly that one member
    verification: bash -o pipefail -c 'npm run check && npm test 2>&1 | tee build/feature-test.log && ! grep -q DEGRADED build/feature-test.log && node tests/run.js wasi && node tests/run.js performance && npm run lint && npm run lint:dead && node docs/check-links.mjs && bash docs/cookbook/regen.sh --check'
    todos:
      - id: emt-parse
        content: Parse a qualified name `E.M` in type position in parsePrimaryType (src/parser.ts) — see Stage 1, Syntax
        status: pending
      - id: emt-type
        content: Add the enum-member type kind to src/types.ts and resolve it in src/annotations.ts — see Stage 1, The type
        status: pending
      - id: emt-assign
        content: Accept exactly the matching member in member-typed slots and enum-member field initializers in src/structs.ts and src/members.ts — see Stage 1, Values
        status: pending
      - id: emt-passes
        content: Give the new kind its case in every pass that switches on type kinds — see Stage 1, Other passes
        status: pending
      - id: emt-tests
        content: Add positive, negative and wording cases, register differential goldens, regenerate checked goldens — see Tests
        status: pending
      - id: emt-docs
        content: Document the rule in LANGUAGE.md Enums, AI.md, the cookbook and the guide types page — see Stage 1, Docs
        status: pending
  - id: union-types
    title: "feat(checker): discriminated union types"
    goal: Declare, store, pass and return a union of tagged classes and interfaces, read its tag, and refuse every other union with the existing NL1053
    verification: bash -o pipefail -c 'npm run check && npm test 2>&1 | tee build/feature-test.log && ! grep -q DEGRADED build/feature-test.log && node tests/run.js wasi && node tests/run.js performance && npm run lint && npm run lint:dead && node docs/check-links.mjs && bash docs/cookbook/regen.sh --check'
    todos:
      - id: ut-validator
        content: Let Phase 0 pass a union of type references through to the resolver in checkNullUnion (src/validator.ts) — see Stage 2, Where the rule moves
        status: pending
      - id: ut-type
        content: Add the union type kind, interned by variant set, with llvmType, alignOf, typeName, mangle and assignable cases in src/types.ts — see Stage 2, The type
        status: pending
      - id: ut-resolve
        content: Validate variants and build the union in src/annotations.ts with a new NL code per refusal — see Stage 2, Variant rules
        status: pending
      - id: ut-coerce
        content: Widen variant to union and sub-union to union through nodeCoercions, emitted as a bitcast — see Stage 2, Conversions
        status: pending
      - id: ut-tag-read
        content: Read the tag through an un-narrowed union and refuse every other member access — see Stage 2, Members
        status: pending
      - id: ut-passes
        content: Give the union kind its case in escape, attributes, tbaa, inline records, generics, interop, parallel, secret, json, debug and dump — see Stage 2, Other passes
        status: pending
      - id: ut-tests
        content: Add native round trips, a tests/link export case, every reject case, wordings and goldens — see Tests
        status: pending
      - id: ut-docs
        content: Write the LANGUAGE.md section, AI.md row, cookbook entry and the new guide page with its route — see Stage 2, Docs
        status: pending
  - id: union-narrowing
    title: "feat(checker): narrow a discriminated union by testing its tag"
    goal: Narrow a union-typed local or parameter to a variant or a smaller union after `x.kind === K.A` or `!==`, in if, ternary, && and early return
    verification: bash -o pipefail -c 'npm run check && npm test 2>&1 | tee build/feature-test.log && ! grep -q DEGRADED build/feature-test.log && node tests/run.js wasi && node tests/run.js performance && npm run lint && npm run lint:dead && node docs/check-links.mjs && bash docs/cookbook/regen.sh --check'
    todos:
      - id: un-narrow
        content: Teach narrowBinary in src/expressions.ts to narrow on a tag test, composing with the null test — see Stage 3, Narrowing
        status: pending
      - id: un-downcast
        content: Record each narrowed read in a new side table and emit its bitcast in the emitter — see Stage 3, Lowering
        status: pending
      - id: un-refuse
        content: Refuse a tag comparison with a member no variant carries and a narrowing on a property path — see Stage 3, Refusals
        status: pending
      - id: un-tests
        content: Add round trips that read variant fields and call variant methods after narrowing, the reject cases and goldens — see Tests
        status: pending
      - id: un-docs
        content: Extend the LANGUAGE.md section, cookbook entry and guide page with narrowing — see Stage 3, Docs
        status: pending
  - id: union-switch
    title: "feat(checker): switch on a union's tag, with exhaustiveness"
    goal: Narrow each clause of `switch (x.kind)` and treat a switch that names every variant as terminating, lowered with an unreachable default
    verification: bash -o pipefail -c 'npm run check && npm test 2>&1 | tee build/feature-test.log && ! grep -q DEGRADED build/feature-test.log && node tests/run.js wasi && node tests/run.js performance && npm run lint && npm run lint:dead && node docs/check-links.mjs && bash docs/cookbook/regen.sh --check'
    todos:
      - id: us-narrow
        content: Narrow the switched local in each clause and in default in checkSwitch (src/statements.ts) — see Stage 4, Clauses
        status: pending
      - id: us-exhaustive
        content: Treat an exhaustive tag switch as terminating and lower its default to unreachable in emitSwitch — see Stage 4, Exhaustiveness
        status: pending
      - id: us-walkers
        content: Update the other switch walkers in bounds, secret, escape and checker for the new termination rule — see Stage 4, Other passes
        status: pending
      - id: us-tests
        content: Add the exhaustive and non-exhaustive cases, the reject cases and goldens — see Tests
        status: pending
      - id: us-docs
        content: Finish the LANGUAGE.md section, the switch rule, the cookbook entry and the guide page — see Stage 4, Docs
        status: pending
---

# Discriminated unions

## Context

Nish refuses every union except `T | null`: Phase 0 in [`src/validator.ts`](../../src/validator.ts) `checkNullUnion`, and again in [`src/annotations.ts`](../../src/annotations.ts) `resolveNullableUnion`, both NL1053 ("values have one fixed layout"). The guide's advice is to store a kind in a field and `switch` on it ([`docs/guide/language/classes-and-interfaces.md`](../../docs/guide/language/classes-and-interfaces.md)), but with no downcast there is no way to reach a variant's own fields after that test, so a program models a tree as one wide class, as [`src/nodes.ts`](../../src/nodes.ts) does.

TypeScript's discriminated union is that model with a type behind it. It fits Nish's layout rule because each variant keeps one fixed layout and the union value is a single pointer, the same shape `T | null` and `class C implements I` already have ([`docs/LANGUAGE.md`](../../docs/LANGUAGE.md), "Interfaces and object literals").

## Approach

```ts
enum Kind { Scalar, Array, Missing }

interface ScalarNode { readonly kind: Kind.Scalar; width: i32 }
class ArrayNode {
  readonly kind: Kind.Array = Kind.Array;
  constructor(public items: SchemaNode) {}
  depth(): i32 { return 1 + depthOf(this.items); }
}
interface MissingNode { readonly kind: Kind.Missing }

type SchemaNode = ScalarNode | ArrayNode | MissingNode;

const depthOf = (n: SchemaNode): i32 => {
  switch (n.kind) {
    case Kind.Scalar: return 1;
    case Kind.Array: return n.depth();
    case Kind.Missing: return 0;
  }
};
```

| Decision | Choice | Why |
| --- | --- | --- |
| What may be a variant | a non-generic class or interface whose **first** field is `readonly`, typed with an enum member type | The tag sits at offset 0 in every variant, so reading it needs no knowledge of which variant it is. `readonly` plus a constant-only type means only a constructor or literal ever writes it, so a tag can never disagree with its layout. |
| Tag type | an **enum member type** `Kind.Array` (stage 1), never a string literal | Nish has numeric enums and no string-literal types. `tsc` narrows on enum members too, so the source stays TypeScript. |
| Representation | a pointer, LLVM type `%union.tagged* ` where `%union.tagged = type { i32 }` is declared once per module that names a union | Every union and sub-union is the same LLVM type, so widening a sub-union is free. Converting between a variant and a union is a `bitcast`, exactly as `implements` does today. |
| `U \| null` | the null pointer, as for any struct | It reuses `K_NULLABLE` unchanged. |
| Identity | `A \| B` and `B \| A` are one interned type, keyed by the sorted variant ids | This is TypeScript's reading, and it keeps type equality an integer compare. |
| What is readable before narrowing | the tag only. Every variant must name its tag field the same | This is TypeScript's discriminant rule. Common non-tag fields are out of scope. |
| Narrowing | on a local or parameter only, like the existing null narrowing | "Only a variable narrows" (src/expressions.ts, above `narrow`) stays the one rule. |
| Exhaustive switch default | LLVM `unreachable`, no panic | This is sound because the tag is readonly and constant-written, and unions never cross an interop boundary (stage 2 refuses that). Nish has no checked or fast build split to hang a panic on. A plain enum switch is unchanged, because an enum *can* arrive from C. |
| TBAA | no tag on any field access of a variant struct | The same bytes are read through `%union.tagged` and through the variant. This is the rule [`src/tbaa.ts`](../../src/tbaa.ts) already applies to interfaces and their implementers. |

Every stage is a construct that ships whole per [`CLAUDE.md`](../../CLAUDE.md) "Definition of done": golden `.ll`, `llvm-as`, native `.out`, reject cases, LANGUAGE.md rule, cookbook entry, guide page, regenerated goldens, conventional commit. None of them uses the construct in `src/` (the rolling freeze).

The stages are strictly sequential, because each consumes the interface the previous one adds. Each also edits [`src/types.ts`](../../src/types.ts) and moves the generated goldens in `tests/self/goldens/`, which would conflict between any two concurrent `src/` PRs anyway. Each stage starts from `main` after its predecessor merges.

## Stage 1: enum member types

**Owns:** `src/**`, `tests/cases/**`, `tests/link/**`, `tests/self/**`, `tests/differential/goldens/**`, `tests/wordings/**`, `tests/nish-cmp.js`, `docs/**`, `scalar.config.json`

### Syntax

`parsePrimaryType` ([`src/parser.ts`](../../src/parser.ts)) reads only an identifier plus type arguments. It now also reads `Ident.Ident` as a qualified type reference node. Any other dotted shape stays a parse error. `tests/parser-oracle.js` must still agree with the `typescript` parser node for node.

### The type

- Add a new kind for an enum member type to [`src/types.ts`](../../src/types.ts). Its `ref` is the enum's type id and it carries the member's value. Its `llvmType` is `i32`, its `alignOf` is 4 and its `typeName` is `Kind.Array`. Its `mangle` must not collide with the enum's `en$Kind`.
- Resolve it in [`src/annotations.ts`](../../src/annotations.ts). The left side must name an enum (local or imported). Two new NL2 codes: one when it is not an enum, and one for an unknown member, which reuses the `has no member` wording.
- `assignable`: a member type converts to its enum. Nothing converts from the enum to a member type. Two member types are the same type only if they are the same member.

### Values

- The expression `Kind.Array` keeps the type `Kind`, so no existing golden moves. A slot whose declared type is `Kind.Array` accepts an expression whose `nodeEnumValues` constant is that member, or a value already of type `Kind.Array`. Anything else is a new diagnostic naming both the member and the value. The slot can be a local, parameter, return, field store, constructor assignment, object-literal field or ternary arm.
- A field initializer may now be an enum member constant when the field's type is that enum or a member type of it ([`src/structs.ts`](../../src/structs.ts) `:424-444`). That makes `readonly kind: Kind.Array = Kind.Array` legal.
- A `switch` discriminant of member type is treated as its enum.

### Other passes

Every switch over type kinds listed in the map below gets a case. Most of them treat a member type as its enum: interop crosses it as the enum crosses, debug info uses the enum's DWARF type, and JSON reads and writes it as the enum.

| File | Places |
| --- | --- |
| [`src/types.ts`](../../src/types.ts) | `derivedKey`/`internAll`, `mangle`, `llvmType`, `alignOf`, `typeName`, `assignable`, `holdsSecret`, `packablePayload` |
| [`src/escape.ts`](../../src/escape.ts), [`src/attributes.ts`](../../src/attributes.ts) | the scalar paths (`isScalarArgument`, `kindOf`) |
| [`src/generics.ts`](../../src/generics.ts) | `isCollectionKey`, `containsType` |
| `src/interop-*.ts` | `cType`, `tsKeyword`, `wasmType`, the N-API readers |
| [`src/debug.ts`](../../src/debug.ts), [`src/dump.ts`](../../src/dump.ts), `src/json-typed.ts`, `src/emit-json.ts` | as above |

### Docs

- [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) "Enums": a bullet for member types, with its test citations.
- [`docs/AI.md`](../../docs/AI.md): the enum section.
- A cookbook entry `decl-enum-member` showing that the IR is the enum's.
- [`docs/guide/language/types.md`](../../docs/guide/language/types.md): a short paragraph.

## Stage 2: union types

**Owns:** the same globs as stage 1.

### Where the rule moves

- Phase 0 keeps NL1053 for any union that has a keyword or scalar member (`number | string`, `i32 | string`), or that has more than one `null`. A union of type references, plus at most one `null`, passes to the resolver, which decides.
- `tests/cases/reject_union_type`, `reject_union_undefined` and `reject_paren_union_type` keep their wordings.
- A parenthesised union `(A | B)[]` is accepted when it resolves to a discriminated union.
- An alias whose right side is a union flattens into it: `type U = A | V` with `V = B | C` is `A | B | C`.

### Variant rules

Each rule is a new code in the NL2 band of [`src/codes.ts`](../../src/codes.ts), with a `tests/cases/reject_union_*` case and a `tests/wordings/` program each:

1. A member is not a class or interface, or it is generic.
2. The first field is missing, not `readonly`, or not typed with an enum member type.
3. The variants' tags are members of different enums.
4. The variants' tag fields have different names.
5. Two variants carry the same tag member. The message names both.
6. Fewer than two distinct variants remain after flattening.

### The type

- A new union kind in [`src/types.ts`](../../src/types.ts), interned by its sorted variant ids. It records its tag enum, the tag field name and its variant list.
- `llvmType` is `%union.tagged*`, `alignOf` is 8 (pointer), and `typeName` lists the variants in id order, joined by ` | `.
- `isPointer` is true, so `U | null` is accepted.
- `mangle` has a stable spelling built from the variant mangles.
- [`src/emit-classes.ts`](../../src/emit-classes.ts) `structTypeDeclarations` emits `%union.tagged = type { i32 }` once per module that references a union.

### Conversions

- `assignable` gains two widenings: a variant converts to any union that contains it, and a union converts to any union whose variant set contains its own.
- `coercesTo` ([`src/structs.ts`](../../src/structs.ts)) records both in `nodeCoercions`, and `emitEntering` emits a `bitcast`. A union-to-union widening emits nothing, since the LLVM type is the same.
- It covers every site class-to-interface coercion covers: initializer, return, argument, assignment, field store, ternary arm and array element.
- `===` and `!==` on two values of one union type compare identity, as for classes.

### Members

- `u.kind` (the shared tag name) on an un-narrowed union has the tag's enum type. It lowers to `getelementptr %union.tagged, %union.tagged* u, i32 0, i32 0` plus a `load i32`.
- Any other field read or write, and any method call, on a union is a new diagnostic that names the union, the member, and says to test the tag first. A write to the tag is already refused by `readonly`.
- A null test on `U | null`, followed by a tag read, works through the existing nullable narrowing.

### Other passes

| Area | Rule |
| --- | --- |
| [`src/escape.ts`](../../src/escape.ts) | A union is a pointer value. A widening keeps the escape facts of the value widened, as a class-to-interface bitcast does. |
| [`src/attributes.ts`](../../src/attributes.ts) | A union parameter or return claims at most `nonnull` (when not nullable), `dereferenceable(4)` and `align 4`, which is what the header proves. Never a variant's size. |
| [`src/tbaa.ts`](../../src/tbaa.ts) | No tag on any field access of a struct that is a variant of any union, and no tag on the header read. |
| inline records ([`src/program.ts`](../../src/program.ts) `:1985-2009`) | An interface that is a variant is pointer-stored, like an implemented interface, because a union element must point at it. |
| [`src/generics.ts`](../../src/generics.ts) | A union as a type argument, or as a `Map`/`Set` key or value, is a new diagnostic (out of scope below). |
| `src/interop-*.ts` | A union, `U \| null` or `U[]` in an exported or interop signature is a new diagnostic. It never reaches a sidecar. |
| [`src/parallel.ts`](../../src/parallel.ts), [`src/secret.ts`](../../src/secret.ts), `src/json-typed.ts` | A union is accepted exactly where a class value is accepted. Where a pass has no class rule, it is refused with a diagnostic. |
| [`src/debug.ts`](../../src/debug.ts) | A pointer to a DWARF structure `tagged` with one member of the tag's enum type. |
| [`src/dump.ts`](../../src/dump.ts), `tests/self/types.ts` | `typeName` in `--emit-checked`, plus type-model entries for the new kind. |

### Docs

- [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md): a new "Discriminated unions" section under classes and interfaces, covering declaration, layout and what is readable. Also amend the Types rule (`:199-214`) and the Phase 0 table rows (`:8031-8032`).
- [`docs/AI.md`](../../docs/AI.md): rewrite the `A | B` row (`:172`).
- [`docs/MASTER_PLAN.md`](../../docs/MASTER_PLAN.md): the forbidden list (`:129`).
- A cookbook entry `decl-union`.
- A new guide page `docs/guide/language/unions.md` with a route in [`scalar.config.json`](../../scalar.config.json) under `/language`. Point to it from `classes-and-interfaces.md` and from `from-typescript.md`'s NL1053 fence, which keeps refusing `i32 | string`.

## Stage 3: narrowing on the tag

**Owns:** the same globs as stage 1.

### Narrowing

- `narrowBinary` ([`src/expressions.ts`](../../src/expressions.ts) `:1496-1544`) recognises `x.kind === K.M` and `K.M === x.kind`, and `!==` both ways, where `x` is a local or parameter whose current type is a union.
- `===` narrows `x` to the variant tagged `M`. `!==` narrows to the union of the rest, or to a single variant when one remains. Both go through `scope.narrow`, so `if`, the ternary, `&&`/`||` and the early-return form all work, and assignment invalidation is unchanged.
- On `U | null`, `x !== null && x.kind === K.M` composes the two narrowings.

### Lowering

- `emitIdentifier` loads with the declared `local.type` ([`src/emit.ts`](../../src/emit.ts) `:1346`). When the identifier's recorded `nodeTypes` entry is a variant, or a union of a different declared type, the checker records the pair in a new side table, and the emitter emits the `bitcast` from it. Field reads then use the variant's `%struct` through the existing `emitPropertyAccess`.
- Add the side table to `CheckedProgram` and to `Instantiation`'s per-instance copies ([`src/program.ts`](../../src/program.ts) `:620-638`).
- Method calls on a narrowed class variant name that class's method, as on any class value.

### Refusals

New codes, each with a reject case and a wording:
- A tag compared with a member no variant of the union carries. This is also `tsc`'s "comparison appears to be unintentional".
- A field read through a property path such as `h.node.items` after `h.node.kind === K.Array`. The message says to copy `h.node` to a local, which is the existing nullable rule's advice.
- A read of a variant field after a branch that did not narrow, such as `if (x.kind !== K.A) {} x.a`.

### Docs

Extend the LANGUAGE.md section, the `decl-union` cookbook entry (or add `union-narrow`), the guide page, and [`docs/AI.md`](../../docs/AI.md).

## Stage 4: switch and exhaustiveness

**Owns:** the same globs as stage 1.

### Clauses

In `checkSwitch` ([`src/statements.ts`](../../src/statements.ts) `:886-940`), when the discriminant is `x.kind` with `x` a union local:
- Each clause's scope narrows `x` to the union of its labels' variants, including labels collected through empty fall-through clauses.
- `default` narrows `x` to the variants no label named.
- A label that names a member no variant carries is the stage 3 refusal.

### Exhaustiveness

- A tag switch whose labels name every variant, and that has no `default`, terminates when every clause terminates. This extends `hasDefault && !broke && lastTerminates` (`:939`). A non-void function may then end with it, as `tsc` allows under `noImplicitReturns`.
- `emitSwitch` ([`src/emit-control.ts`](../../src/emit-control.ts) `:209-275`) points the LLVM `switch` default at a block that holds only `unreachable`.
- A non-exhaustive tag switch, and every plain enum or integer switch, behave exactly as today, and none of their goldens move.

### Other passes

The switch walkers in [`src/bounds.ts`](../../src/bounds.ts) `:4330`, [`src/secret.ts`](../../src/secret.ts) `:655`/`:860`, [`src/escape.ts`](../../src/escape.ts) `:1829` and [`src/checker.ts`](../../src/checker.ts) `:1871`/`:1889`/`:3316` must agree on the new termination rule. A walker that assumed "no default means control falls out" must not see that path for an exhaustive tag switch.

### Docs

The `switch` rule in LANGUAGE.md (`:3672`), the union section, the cookbook (`union-switch`), the guide page, and `control-flow.md`.

## Out of scope

- Untagged unions (`string | number`, `A | B` without a tag) and string-literal tags.
- Reading a field common to all variants other than the tag.
- Narrowing through property paths, `in`, `instanceof` or user type guards.
- A union as a generic type argument or a `Map`/`Set` element, and unions across interop boundaries. Each is refused with its own diagnostic, so a later change can lift it.
- Exhaustiveness for plain enum switches.
- Using any of this in `src/` (the rolling freeze).

## Tests

Every stage:
- `tests/cases/<name>.ts` with `.ll` and `.out` for each positive case. Mirror `enum_ir`, `cls_implements`, `cls_interface_literal` and `obj_lit_nullable_*`.
- `reject_<name>.ts` with `.err` for each refusal, and a `tests/wordings/` program for each new code.
- Register new positive cases with `node tests/differential/goldens.js --update` in the same commit.
- Regenerate `tests/self/goldens/` with `node tests/self/goldens.js --update`, and read the diff.

Stage 2 adds `tests/link/union_export*`: an exported union alias and variants imported by another module.

Stage 4 adds:
- a pair whose `.ll` shows `unreachable` as the default;
- a non-exhaustive tag switch in a non-void function that ends without a return, refused as a missing return;
- a byte-identical check that an existing enum switch golden did not move.

## Verification

Run on the stage's branch before the PR goes up:

```bash
bash scripts/fetch-seed.sh --force
bash -o pipefail -c 'npm run check && npm test 2>&1 | tee build/feature-test.log && ! grep -q DEGRADED build/feature-test.log'
node tests/run.js wasi          # read its skip line; WASI_SYSROOT=/usr where wasi-libc is installed
node tests/run.js performance
npm run lint && npm run lint:dead
node docs/check-links.mjs
bash docs/cookbook/regen.sh --check
```

The PR body shows the exact LLVM IR for every TypeScript snippet the stage adds to the tests, per CLAUDE.md.
