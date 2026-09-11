# WP0: Phase 0 validator

`src/validator.ts` is the first phase of the pipeline. It runs on the raw
syntax tree immediately after parsing and before the checker, and throws a
`CompileError` (`file:line:col: error: <message>`) on the first construct that
Nish can never compile. Every rule is decided from syntax alone: no
types, no scopes, no symbol resolution. The walk is a single pre-order
`ts.forEachChild` traversal dispatched through a table keyed by
`ts.SyntaxKind`, so it costs about 2 ms warm (under 5 ms cold, JIT included) on a
1,000-line, 23,000-node file (`npm test` asserts under 50 ms on a synthetic
file of that size and prints the measured time).

The validator is defence in depth, not the only guard. The checker still
rejects what it does not understand, but it only looks where it has to;
the validator sees every node, so `any` buried in a type argument, `delete`
inside an unreachable branch, or `with` in a function nobody calls all fail
regardless of what later phases do. Conversely, constructs that are merely
not supported *yet* (control flow, classes, arrays, modules, ...) are not
the validator's business and pass through untouched.

## Forbidden constructs

The "why" column names the guarantee from `docs/MASTER_PLAN.md` that the
construct would break: **layout** (every value has one fixed, known memory
layout), **no dynamic dispatch** (no prototype chain, no runtime property
lookup), **no runtime** (no interpreter, GC, event loop, unwinder, or regex
engine in the 1 KB C runtime), **fixed arity** (calls are direct with a
known signature).

### Types

| Construct | Message | Why |
| --- | --- | --- |
| `any` (any type position, including nested type arguments) | `` `any` is forbidden in Nish `` | layout: a value of unknown type has no fixed representation. |
| `unknown` | `` `unknown` is forbidden in Nish `` | layout: same as `any`; narrowing would need runtime type tags. |
| `symbol` | `` `symbol` type is forbidden in Nish (no symbol type) `` | no runtime: symbols are unique heap-allocated identities. |
| `bigint` type | `` `bigint` type is forbidden in Nish (use number, i32, or f64) `` | no runtime: arbitrary-precision integers need a heap-allocated bignum library. |
| `undefined` type | `` `undefined` is forbidden in Nish; use `null` with a `T \| null` type `` | layout: one sentinel (`null`, only on pointer types) is enough; two would need a tagged representation. |
| Union types other than `T \| null` / `null \| T` | `` Union types other than `T \| null` are forbidden in Nish (values have one fixed layout) `` | layout: a union of unrelated types needs a tag and the largest member's storage. |
| `Function`, `Symbol`, `Proxy` as type names | `` `Function` type is forbidden in Nish (no dynamic function values) `` (and analogous) | no dynamic dispatch: untyped callables have no signature to lower to. |
| `import("x").T` type queries | `` Dynamic `import()` is forbidden in Nish (modules are resolved at compile time) `` | no runtime: modules are linked ahead of time. |
| `x as any`, `<any>x`, `x as unknown`, `<unknown>x` | `` Type assertion to `any` is forbidden in Nish `` / `` ... to `unknown` ... `` | layout: an escape hatch out of the static type system. |

### Declarations

| Construct | Message | Why |
| --- | --- | --- |
| Type parameters on functions, methods, arrows, classes, interfaces, type aliases (`<T>`) | `` Generic type parameters are forbidden in Nish (no monomorphisation yet) `` | layout: a generic body has no fixed layout until instantiated; a monomorphisation WP may lift this. |
| Generators (`function*`, `*method()`) | `` Generators are forbidden in Nish (no coroutine runtime) `` | no runtime: suspended frames need heap-allocated coroutine state. |
| `async` functions, methods, arrows | `` `async` functions are forbidden in Nish (no event loop or promises) `` | no runtime: promises and an event loop do not exist. |
| `var` (in statements and `for` heads) | `` `var` is forbidden; use `let` or `const` `` | layout: function-scoped hoisting with implicit `undefined` initialisation; `let`/`const` map directly to `alloca`. |
| Enum members whose initializer is not a numeric literal (`A = "a"`, `B = A + 1`) | `` Enum members must be numeric literals in Nish (enums lower to plain integers) `` | layout: enums are plain integers; string members and computed values need runtime objects. |
| `namespace` / `module` blocks (including `declare module "x"`) | `` `namespace` and `module` blocks are forbidden in Nish (use ES module files) `` | no dynamic dispatch: namespaces are runtime objects with property lookup. |
| `declare global` | `` `declare global` is forbidden in Nish (no global object to augment) `` | no dynamic dispatch: there is no global object. |
| Decorators (`@dec` on classes, methods, ...) | `` Decorators are forbidden in Nish (no runtime metadata or class rewriting) `` | no runtime: decorators rewrite classes at load time via reflection. |
| Computed property names (`{ [k]: 1 }`, `class { [k]() {} }`) | `` Computed property names are forbidden in Nish (object layout is fixed at compile time) `` | layout: field names must be known at compile time to assign offsets. |

### Statements

| Construct | Message | Why |
| --- | --- | --- |
| `with` | `` `with` is forbidden in Nish (no dynamic scope) `` | no dynamic dispatch: identifiers would resolve at runtime. |
| `try` / `catch` / `finally` | `` `try`/`catch`/`finally` is forbidden in Nish (no unwinding; `throw` aborts) `` | no runtime: functions are `nounwind`; `throw` lowers to print + `abort`. |
| `debugger` | `` `debugger` is forbidden in Nish (no debugger hook) `` | no runtime: there is no engine to break into; use `lldb` on the binary. |
| Labeled statements | `` Labeled statements are forbidden in Nish (use structured loops) `` | keeps control flow structured so block naming in the emitter stays simple. |

### Expressions

| Construct | Message | Why |
| --- | --- | --- |
| `eval(...)`, `eval` as a value | `` `eval` is forbidden in Nish (no interpreter at runtime) `` | no runtime. |
| `Function(...)`, `new Function(...)`, `Function` as a value | `` `new Function` is forbidden in Nish (no interpreter at runtime) `` (and analogous) | no runtime. |
| `new Proxy(...)`, `Proxy` as a value | `` `new Proxy` is forbidden in Nish (no dynamic property interception) `` | no dynamic dispatch: field access is a `getelementptr`, nothing can intercept it. |
| `Reflect` | `` `Reflect` is forbidden in Nish (no runtime reflection) `` | no dynamic dispatch: no type metadata exists at runtime. |
| `Symbol(...)`, `Symbol` as a value | `` `Symbol` is forbidden in Nish (no symbol type) `` | no runtime. |
| `globalThis` | `` `globalThis` is forbidden in Nish (no global object) `` | no dynamic dispatch. |
| `arguments` | `` `arguments` is forbidden in Nish (functions have fixed arity) `` | fixed arity: parameters are SSA values, there is no arguments array. |
| `undefined` as a value | `` `undefined` is forbidden in Nish; use `null` with a `T \| null` type `` | layout: see the `undefined` type. |
| `void expr` | `` `void` expressions are forbidden in Nish (no `undefined` value) `` | layout: the only thing `void` produces is `undefined`. |
| `==`, `!=` | `Loose equality is forbidden; use === / !==` | no dynamic dispatch: loose equality coerces across types at runtime. |
| `in` | `` `in` operator is forbidden in Nish (no dynamic property lookup) `` | no dynamic dispatch. |
| `instanceof` | `` `instanceof` is forbidden in Nish (no prototype chain) `` | no dynamic dispatch: no runtime type tags or prototype chain. |
| Comma expressions (`(a, b)`) | `Comma expressions are forbidden in Nish (write separate statements)` | readability; also closes the indirect-eval idiom `(0, eval)`. |
| `typeof x` (value position) | `` `typeof` is forbidden in Nish (no runtime type tags) `` | no dynamic dispatch: values carry no runtime type. |
| `delete x.y` | `` `delete` is forbidden in Nish (object layout is fixed) `` | layout: fields cannot be removed from a struct. |
| `await` | `` `await` is forbidden in Nish (no event loop or promises) `` | no runtime. |
| `yield` | `` `yield` is forbidden in Nish (no coroutine runtime) `` | no runtime. |
| Regex literals (`/x/`) | `Regular expression literals are forbidden in Nish (no regex engine in the runtime)` | no runtime. |
| `bigint` literals (`10n`) | `` `bigint` literals are forbidden in Nish (use number, i32, or f64) `` | no runtime. |
| Object spread (`{ ...a }`) | `Object spread is forbidden in Nish (object layout is fixed at compile time)` | layout: copying an unknown set of fields needs runtime shape information. |
| `{ __proto__: x }` | `` `__proto__` is forbidden in Nish (no prototype chain) `` | no dynamic dispatch. |
| `x.__proto__` | `` `__proto__` access is forbidden in Nish (no prototype chain) `` | no dynamic dispatch. |
| `x.prototype` | `` `.prototype` access is forbidden in Nish (no prototype chain) `` | no dynamic dispatch. |
| `Object.assign`, `Object.create`, `Object.defineProperty`, `Object.defineProperties`, `Object.setPrototypeOf`, `Object.getPrototypeOf` | `` `Object.assign` is forbidden in Nish (object layout is fixed at compile time) `` (and analogous) | layout / no dynamic dispatch: these mutate shape or prototype at runtime. |
| Element access with a string or template key (`o["x"]`, `` o[`x${k}`] ``) | `` String-keyed element access is forbidden in Nish; use `obj.name` (no dynamic property lookup) `` | no dynamic dispatch: fields are resolved to offsets at compile time. |
| Element access with a key that is not numeric-shaped (`o[true]`, `o[{}]`, `o[() => 1]`, ...) | `Element access requires a numeric index in Nish (no dynamic property lookup)` | no dynamic dispatch: only array indexing survives. |
| Dynamic `import(...)` | `` Dynamic `import()` is forbidden in Nish (modules are resolved at compile time) `` | no runtime: modules are linked ahead of time. |

"Numeric-shaped" index keys are accepted syntactically so that future array
code (WP4) is not blocked: identifiers, numeric literals, parenthesised
expressions, unary `+`/`-`, `+ - * / %` over those, calls, property access
(`a[a.length - 1]`) and nested element access (`a[b[i]]`). The checker
enforces that the key actually has a numeric type.

## What the validator deliberately does not check

These items from §3.2 of the master plan depend on types or scopes and are
the checker's job:

- `this` outside methods (needs the enclosing declaration kind and class context).
- Adding properties not declared on the class (needs the class's field list).
- Optional chaining `?.` and nullish coalescing `??` on non-nullable types (needs the operand's type).
- `never` in value positions (needs type inference to decide what is a value position).
- `Map` / `Set` / `WeakMap` and other library types (whether they exist is a runtime-library decision, not a syntax rule).
- Array and call spread (`[...a]`, `f(...a)`) are left to the checker, which currently rejects them as unsupported.

## Tests

Every row above has at least one `tests/cases/reject_<construct>.ts` with the
message fragment in `reject_<construct>.err`. `tests/run.js` also asserts the
validator accepts a generated 1,000-line file (written to
`build/test/validator_perf.ts`) in under 50 ms; the measured time is printed
in the test name.

## Biome

Biome (`biome.json`) is configured as a formatter and style linter for the
compiler's own source, `tests/**/*.js`, and the Nish programs a reader
is meant to learn from: `examples/**`, `docs/cookbook/**`, `bench/**/*.ts`.
It never influences compilation. `npm run lint` runs `biome check` with the
formatter check disabled so that files not yet formatted to the shared style
do not fail the gate; `npm run format` rewrites files in place.

The rule set is the recommended preset plus the rules that mirror what the
validator refuses, so that the compiler's own source and the example programs
read like the language: `noVar`, `noExplicitAny`, `noEnum`, `noNamespace`,
`noVoid`, `noParameterAssign` (parameters are immutable in Nish),
`useExplicitLengthCheck` (there is no truthiness), `useConsistentArrayType`
(`T[]`), and `useFilenamingConvention` (kebab-case for the compiler, snake_case
for Nish programs). Two recommended rules are turned *off* because they
push code towards constructs Nish rejects: `useOptionalChain` (`?.`) and
`useExponentiationOperator` (`**`). `useImportType`, `useTemplate` and
`noNonNullAssertion` are off as a matter of house style.

A second group is house style rather than language mirroring: `type` over
`interface`, and a function written as an arrow bound to a `const`. Three of
them are clean today and are errors — `useArrowFunction` (a function
*expression* becomes an arrow), `useShorthandFunctionType` and
`useConsistentArrowReturn`. Three have a backlog and are therefore `warn`:
`useConsistentTypeDefinitions` (`type`, never `interface`),
`useConsistentMethodSignatures` (a member holding a function is a property,
which is also checked more strictly than method shorthand), and the
`biome-plugins/no-function-declaration.grit` plugin.

That last one is a plugin because Biome ships no built-in rule for it:
`useArrowFunction` rewrites function *expressions* and says nothing about
declarations. It is a GritQL pattern, scoped by an override to the compiler
source and the JavaScript harness. Warnings do not fail `biome check`, so the
gate stays green and the count measures the migration that is left;
`npm run lint -- --diagnostic-level=error` hides it while looking for real
errors.

Neither applies to an Nish program: the language has no arrow functions and
no `type` aliases, so `function` and `interface` are the only spellings there,
and both rules plus the plugin are turned off for those directories. That is a
Phase 1 limitation rather than a Phase 0 rule — the validator lets an arrow and
a `type` alias through, and the checker's `Unsupported ... in Phase 1` fallback
is what refuses them.

For the Nish program directories the unused-variable rules and the
numeric-literal rules (`noPrecisionLoss`, `noApproximativeNumericConstant`)
are off too: those
files are compiler inputs, and the n-body constants are the benchmark's own
digits. Test fixtures (`tests/cases`, `tests/link`, `tests/differential/corpus`)
are not linted at all, because a `reject_*` case exists to contain what the
rules forbid.
