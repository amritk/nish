# WP16: Result and the end of `throw`

Rust-style error handling for StaticTS: a function that can fail says so in
its return type, hands the caller a `Result<T, E>`, and the caller cannot
reach the success value without first deciding what happens to the failure.
`throw` is removed in the same package, because leaving it in would have left
a second, invisible way to report a failure.

The normative rules are in [LANGUAGE.md](LANGUAGE.md#result-and-error-handling);
this note is the *why*.

**Both compilers have it.** S5 froze stage0 as the bootstrap seed and the
differential oracle, and said new constructs land in `self/` (§4 of
[wp14-selfhost.md](wp14-selfhost.md)); the IR oracle enforces that by
requiring stage1 to compile every program in the corpus, with no exemption
list. So this package is implemented twice, and the oracle is what says the
two agree: `IR(stage0, p) == IR(stage1, p)` byte for byte over all six
`res_*` cases and the `result_import` link test, and every one of the ten
`reject_result_*` messages matching character for character.

Files, stage0: `src/types.ts` (the type and its mangling),
`src/checker/result.ts` (the rules), `src/checker/narrowing.ts` (the engine
`T | null` and `Result` now share), `src/codegen/emit/result.ts` (the
lowering), `src/codegen/escape.ts` and `attributes.ts` (allocation sites and
pointer facts), `src/validator.ts` (Phase 0 refuses `throw`).
Stage1, mirroring each: `self/types.ts`, `self/annotations.ts`,
`self/result.ts`, `self/expressions.ts` (`narrow`), `self/emit_result.ts`,
`self/escape.ts`, `self/attributes.ts`, `self/validator.ts`.
Shared: `runtime/statictsc.d.ts` (the ambient declarations),
`runtime/shim.mjs` and `tests/differential/rewrite.js` (the Node twin).
Tests: `tests/cases/res_*`, `tests/cases/reject_result_*`,
`tests/cases/reject_throw`, `tests/link/result_import`, the
"WP16: the ambient declarations" block in `tests/run.js`, and the S3/S4
oracles in `tests/self/`.

## 1. Why `throw` had to go

StaticTS's `throw` never unwound. It evaluated its operand, discarded it, and
executed `llvm.trap`, which is a SIGILL and no message. That is an *abort*
wearing the syntax of error handling, and it had three costs:

- a program could report a failure in a way no caller could see or handle;
- the value it threw was dropped, so the one thing a reader most wants when a
  program dies — what went wrong — was the one thing it could not keep;
- every reader arriving from TypeScript assumed `try`/`catch` semantics that
  the language does not and cannot have (functions are `nounwind`; there is no
  landing pad, no personality function, and no unwind tables).

Both of its real uses now have a better spelling. A failure the caller should
handle is a `Result<T, E>`. An invariant that cannot hold is `panic(message)`,
which has existed since WP14 D1 and keeps the message. So `throw` is a Phase 0
rejection (`tests/cases/reject_throw`), with a message that names both
replacements, and `try` keeps its own rejection for the same reason.

Stage1 (`self/`) refuses it in Phase 0 too. Its parser still *reads* `throw`,
which is deliberate: a rejection that can point at the whole statement beats a
syntax error at the keyword.

## 2. Why a pointer, not a value

Rust returns a `Result` by value, and a monomorphised `{ i1, T, E }` in an
LLVM aggregate is what this package would ideally emit. It does not, and the
reason is the C ABI.

LLVM does not lower aggregates to a platform's calling convention — the
frontend does. clang decides, per target, whether a small struct goes in
registers, in a register pair, or through an `sret` pointer; emitting
`define { i32, i8* } @f()` and hoping is how a frontend produces something
that links but does not interoperate. StaticTS's whole point is that its
output is C-ABI-compatible (`--emit-header`, `--emit-napi`, a `.ll` a C
program links against), so an ABI it cannot describe in a header is not an
option.

A pointer to an arena struct has none of that problem and, in this compiler,
costs much less than it sounds:

- the layout is computed exactly as a `class` is, so `dereferenceable`,
  `align 8` and `nonnull` are all true of it and the existing attribute
  machinery applies unchanged;
- the WP6 escape analysis treats `Ok(v)` and `Err(e)` as ordinary allocation
  sites, so a `Result` that does not outlive its function becomes an
  entry-block `alloca` and there is no allocator call at all
  (`tests/cases/res_stack`);
- a `Result` that *is* returned is one arena bump — a pointer increment —
  and the arena is reclaimed in O(1).

The cost that remains is a returned `Result`: one bump, plus the load of the
discriminant the caller cannot avoid. `TODO(WP17)` is to add the missing ABI
lowering and return small `Result`s by value, at which point an inlined ok
path costs nothing at all. Until then a `Result` may not cross the host
boundary: `--emit-header`, `--emit-dts` and `--emit-napi` skip such a function
and leave a note naming the type, which is honest about exactly this gap.

## 3. Monomorphisation without generics

StaticTS has no user generics and this package does not add them.
`Result<T, E>` is a built-in type constructor, in the same way `Array<T>` is:
`resolveTypeNode` recognises the name, resolves the two arguments, and returns
a `{ kind: "result", ok, err, state }`.

Each distinct pair gets one LLVM struct, named by a prefix-coded mangling of
the two payload types (`src/types.ts`, `mangleType`): `Result<i32, string>` is
`%struct.sts_result.i32.str`, `Result<i32, IoError>` is
`%struct.sts_result.i32.$IoError`. Writing each constructor's tag before its
operands makes the encoding unambiguous without separators of its own —
`res.res.i32.str.str` can only be read one way — and the `$` on a named type
cannot appear in a TypeScript identifier, so a class called `res` cannot
collide with the `Result` constructor.

The layout is **derived, never declared** (`resultLayout` in
`src/checker/result.ts`): both the checker and the emitter compute it from the
type, so there is no registry entry to keep in sync and an imported signature
that mentions a `Result` needs nothing brought across but the layouts of its
payloads (`tests/link/result_import`).

`state` — `"unknown"`, `"ok"`, `"err"` — is a checker-only refinement. It is
part of the `StaticType` because narrowing is keyed by type
(`Scope.narrow(v, type)`), and `sameType` ignores it, because the LLVM value
is the same pointer whatever the checker has proved about it.

## 4. The three rules, and why each is a hard error

**A `Result` cannot be dropped.** Rust makes this a lint (`#[must_use]`);
here it is an error, because the whole value of the feature is that a failure
cannot go unnoticed, and a warning in a build nobody reads is not that. Two
shapes are refused: a `Result`-valued expression statement, and a local that
holds one and is never read. Handing the value on — an argument, a `return` —
counts as reading it, since the responsibility travels with the value and the
receiving signature carries the same rules.

**The error arm comes first.** This is what the user-visible ordering
guarantee reduces to: `r.value` is legal only where the checker proved
`isOk()`, `r.error` only where it proved `isErr()`. Since those are the only
spellings that reach a payload, there is no way to write the success path
before the failure path has been decided.

The narrowing is not new machinery. WP6 already had a flow engine for
`T | null`, and this package extracted it into `src/checker/narrowing.ts` with
a small registry: `nullable.ts` contributes the rule that recognises a null
test, `result.ts` the one that recognises a discriminant test, and the engine
owns the boolean algebra (`!`, `&&`, `||`, parentheses) and the scope
plumbing. The soundness argument is therefore the same one, unchanged: a
narrowing applies to a *variable*, ends at any assignment to it, and is
dropped before a loop that assigns it.

**Propagation is contagious.** `orReturn()` is this language's `?`. It is
legal only inside a function returning a `Result` whose error arm accepts the
propagated one, which is exactly the contagion `?` enforces in Rust — minus
the `From<E>` conversion, because StaticTS has no trait to hang one on, so a
mismatched error type is named rather than silently widened.

It is a method rather than an operator because TypeScript has no postfix
operator to spare that would still parse and still mean something sane. `!`
was available syntactically (StaticTS never accepted a non-null assertion) and
was rejected on purpose: it means "trust me, not null" to a TypeScript reader
and "panic" to a Rust one, and it would have meant neither here.

## 5. It has to stay TypeScript

A StaticTS program has always been parseable TypeScript. This package makes
one stronger claim, and tests it: with `runtime/statictsc.d.ts` on the include
path, a `Result` program **type-checks** under plain `tsc --strict`.

That is not decoration. It is what keeps an editor useful on a StaticTS file,
and it is a design constraint on the surface: every spelling here had to be
one TypeScript can model. `Result` is declared as the tagged union TypeScript
would use anyway, intersected with the method surface —

```ts
type Result<T, E> = (ResultOk<T> | ResultErr<E>) & ResultMethods<T, E>;
```

— so `if (r.ok)` narrows by TypeScript's own discriminated-union rule, and
`isOk()` / `isErr()` narrow through `this is` predicates. `tests/run.js`
asserts both directions: every `res_*` case type-checks, and
`reject_result_value_unchecked` is refused by `tsc` with
`Property 'value' does not exist` — which is the check that proves the
declarations model the *narrowing* and not just the names.

`statictsc` is still the authority. `tsc` cannot see that a `Result` may not
be dropped, that `orReturn()` returns early, or that the enclosing function
has to return a `Result` at all; and the integer widths are aliases of
`number` there. A program `tsc` accepts may still be rejected here. The
reverse would be a bug in the declarations.

## 6. Left out

- **`unwrap()`.** `expect(message)` says the same thing and insists on a
  reason. An unwrap with no message is the one call that turns a careful error
  type back into `throw`.
- **`map` / `andThen` / `orElse`.** They need function values, which StaticTS
  forbids: the whole-program pass cannot prove purity, termination or escape
  through an unknown callee. Narrowing plus `orReturn()` covers what they are
  for.
- **`match`.** No pattern matching in TypeScript syntax, and the narrowing
  gives the same guarantee.
- **Error conversion on propagation.** Rust's `?` applies `From<E>`; there is
  no trait system here to carry one.
- **`Result` across the host boundary**, and **by-value returns** — both
  waiting on the ABI lowering in §2.
- **DWARF members for a `Result`.** `-g` describes the pointer but not the
  fields, since there is no `StructInfo` to render; `TODO(WP17)` in
  `src/codegen/debug.ts`.
- **Nothing, on the stage1 side.** `self/` implements the whole package, and
  the S3 and S4 oracles hold it to stage0's exact messages and exact IR. What
  the two do *not* share is the shape of the code: stage0 interns nothing and
  compares types structurally, stage1 interns every type into a table and
  compares ids, so the `state` refinement is a third interned id there rather
  than a field on an object. That is the same difference the rest of the port
  already carries, not a WP16 decision.
