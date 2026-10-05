# WP16: Result and the end of `throw`

**Status: complete** (#5). A function that can fail says so in its return
type and hands the caller a `Result<T, E>`, and the caller cannot reach the
success value without first deciding what happens to the failure. `throw` was
removed in the same package. The normative rules and the full method table
are in [LANGUAGE.md](LANGUAGE.md#result-and-error-handling); the IR is in
[IR_COOKBOOK.md](IR_COOKBOOK.md); this note is the *why*.

It was the first construct after the WP14 freeze and landed in stage0 and
`src/` together, the IR oracle holding the two byte-identical; stage0 has
since been deleted ([wp19-stage0-retirement.md](wp19-stage0-retirement.md)).
In `src/` the type and its mangling live in `src/types.ts`, the rules in
`src/result.ts`, narrowing in `src/expressions.ts` (`narrow`), the lowering in
`src/emit-result.ts`, and allocation sites and pointer facts in
`src/escape.ts` and `src/attributes.ts`. `runtime/nish.d.ts` holds the ambient
declarations. Tests: `tests/cases/res_*`, `reject_result_*`, `reject_throw`
and `tests/link/result_import`.

## 1. Why `throw` had to go

Nish's `throw` never unwound: it evaluated its operand, discarded it and
executed `llvm.trap` — a SIGILL with no message. That let a program report a
failure no caller could see or handle, dropped the one thing a reader wants
when a program dies, and promised TypeScript readers `try`/`catch` semantics
the language cannot have (functions are `nounwind`; there are no landing pads
or unwind tables). Both real uses have a better spelling: a failure the caller
should handle is a `Result`, and an invariant that cannot hold is
`panic(message)`, which keeps the message. So `throw` is a Phase 0 rejection
whose message names both. The parser still reads `throw`, so the rejection can
point at the whole statement rather than at a syntax error on the keyword.

## 2. Why a pointer, not a value

A by-value `{ i1, T, E }` LLVM aggregate is what Rust would suggest, and it
was ruled out by the C ABI. LLVM does not lower aggregates to a platform's
calling convention; the frontend does, per target, and Nish's output has to be
something a C host links against and a generated header can describe.

A pointer to an arena struct has none of that problem and costs little here:
the layout is computed as a `class`'s, so `nonnull`, `align 8` and
`dereferenceable` apply unchanged; the WP6 escape analysis treats `Ok(v)` and
`Err(e)` as ordinary allocation sites, so a `Result` that does not outlive its
function is an entry-block `alloca` (`tests/cases/res_stack`); and a returned
one is a single arena bump.

That premise turned out half right. A by-value *aggregate* is unavailable
(clang returns the same C struct three different ways across the six
targets), but a by-value *scalar* is not: a `Result` whose payloads are each at
most four bytes packs into one `i64`, the same LLVM type on every target.
[wp17-result-abi.md](wp17-result-abi.md) did that, so the pointer is now the
in-memory representation and the shape of a large `Result`, not of every one.

## 3. Monomorphisation without generics

`Result<T, E>` is a built-in type constructor, as `Array<T>` is; Nish had no
user generics then (WP18 added them later). Each distinct pair gets one LLVM
struct named by a prefix-coded mangling of its payloads —
`Result<i32, string>` is `%struct.nish_result.i32.str`, `Result<i32, IoError>`
is `%struct.nish_result.i32.$IoError`. Writing each constructor's tag before
its operands makes the encoding unambiguous without separators, and `$` cannot
appear in a TypeScript identifier, so a class called `res` cannot collide.

The layout is **derived, never declared**: checker and emitter both compute it
from the type, so there is no registry to keep in sync and an imported
signature needs only its payloads' layouts (`tests/link/result_import`). The
`ok` / `err` / unknown state is a checker-only refinement keyed by type, and
type identity ignores it, because the LLVM value is the same pointer whatever
the checker has proved.

## 4. The three rules, and why each is a hard error

**A `Result` cannot be dropped.** Rust makes this a lint; here it is an error,
because the value of the feature is that a failure cannot go unnoticed. An
expression statement of `Result` type and a local holding one that is never
read are refused; passing it on (an argument, a `return`) counts as reading it.

**The error arm comes first.** `r.value` is legal only where the checker
proved `isOk()`, `r.error` only where it proved `isErr()`, so the success path
cannot be written before the failure has been decided. The narrowing reuses
the `T | null` flow engine from WP6, so the soundness argument is the same: a
narrowing applies to a variable, ends at any assignment to it, and is dropped
before a loop that assigns it.

**Propagation is contagious.** `orReturn()` is Rust's `?`, legal only inside a
function returning a `Result` whose error type matches, without `From<E>`
conversion because there is no trait to hang one on. It is a method because
TypeScript has no spare postfix operator; `!` was rejected on purpose, since it
means "not null" to a TypeScript reader and "panic" to a Rust one.

## 5. It has to stay TypeScript

With `runtime/nish.d.ts` on the include path a `Result` program type-checks
under plain `tsc --strict`, which keeps an editor useful and constrains the
surface to spellings TypeScript can model:

```ts
type Result<T, E> = (ResultOk<T> | ResultErr<E>) & ResultMethods<T, E>;
```

`if (r.ok)` narrows by TypeScript's discriminated-union rule and `isOk()` /
`isErr()` through `this is` predicates. `tests/run.js` checks both directions:
every `res_*` case type-checks, and `reject_result_value_unchecked` is refused
by `tsc` too, which proves the declarations model the narrowing and not just
the names. `nish` stays the authority: `tsc` cannot see the drop rule or
`orReturn()`'s early return, so a program `tsc` accepts may still be refused,
and the reverse would be a bug in the declarations.

## 6. Left out

- **`unwrap()`.** `expect(message)` says the same and insists on a reason.
- **`map` / `andThen` / `orElse`.** They need function values, which Nish
  forbids: the whole-program pass cannot prove purity, termination or escape
  through an unknown callee. Narrowing plus `orReturn()` covers their use.
- **`match`.** No pattern matching in TypeScript syntax; narrowing gives the
  same guarantee.
- **Error conversion on propagation.** No trait system to carry `From<E>`.

By-value returns and parameters, the host boundary (`--emit-header`,
`--emit-dts`, `--emit-napi`) and DWARF members for a `Result`, all left out
here, landed in [WP17](wp17-result-abi.md).
