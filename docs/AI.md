# Writing Nish: the rules card

This is the **whole language, stated as rules, for a model that has to write
Nish and get it accepted on the first try**. It is a digest, not the authority:
[`LANGUAGE.md`](LANGUAGE.md) is normative and settles every disagreement, and
[`IR_COOKBOOK.md`](IR_COOKBOOK.md) shows the exact IR each construct lowers to.
This page exists because LANGUAGE.md is 2,300 lines written to be *read*, and
what an author needs is the rules in one pass with the traps first.

> Working **on the compiler** rather than **in the language**? That is a
> different document: [`AGENTS.md`](../AGENTS.md) and [`.claude/`](../.claude/).

Nish is a strictly static subset of TypeScript compiled ahead of time to LLVM
IR. Every Nish program is legal TypeScript *syntax* — it is parsed by the
official TypeScript parser — and with
[`runtime/nish.d.ts`](../runtime/nish.d.ts) on the include path it type-checks
under `tsc --strict` too. That is the trap this page exists for: **your
TypeScript instincts produce programs that parse, that `tsc` accepts, and that
`nish` rejects.** The subset is much smaller than it looks.

Contents: [The loop](#the-loop-compile-read-the-code-fix) ·
[A whole program](#a-whole-program) ·
[What you must unlearn](#what-you-must-unlearn) · [Types](#types) ·
[Failure](#failure-result-not-exceptions) · [Absence](#absence-nullable-types) ·
[Declarations](#declarations) · [Generics](#generic-functions) ·
[Calling C](#calling-c) · [Statements](#statements) ·
[Expressions](#expressions) · [The builtins, in full](#the-builtins-in-full) ·
[Memory](#memory) · [Recipes](#recipes-for-what-is-missing) ·
[Before you say it compiles](#before-you-say-it-compiles)

## The loop: compile, read the code, fix

Do not reason about whether a program is legal. Ask the compiler — it is fast,
and it is the only authority.

```bash
nish program.ts --json            # one JSON object per diagnostic, on stdout
nish program.ts -o out.ll         # emit LLVM IR
nish program.ts --link prog       # build a native binary (needs clang)
nish --help                       # the full flag list, stdout, exit 0
```

`--json` is the surface to automate against. One flat object per line on
stdout, nothing on stderr, every field 1-based with `endLine`/`endColumn`
exclusive:

```json
{"file":"p.ts","line":3,"column":17,"endLine":3,"endColumn":20,"severity":"error","code":"NL2249","message":"Unknown method `map` on i32[] (supported: push, pop, indexOf, join)"}
```

- **Key on `code`, never on `message`.** A code is a promise: `NL2249` means
  the same rule next release. The prose may improve; the code may not.
- **`severity`** is `"error"` or `"performance"`. A performance warning never
  changes the exit code — it is advice, not a rejection.
- **Bands**: `NL1xxx` the Phase 0 forbidden-syntax sweep, `NL2xxx` the checker,
  `NL3xxx` the driver and modules, `NL4xxx` the interop sidecars, `NL9xxx`
  performance, `NL0001` syntax, `NL0002` toolchain, `NL0003` internal,
  `NL0000` a diagnostic with no rule yet.
- **Exit codes**: `0` ok, `1` the program was rejected, `2` usage, `3` the C
  toolchain is unusable, `70` an internal compiler error — that last one is a
  bug in `nish`, not in your program, and is worth reporting.
- Every failure is a `--json` object, toolchain and internal errors included,
  so you never have to parse stderr to find out why a run failed.

Two more surfaces worth knowing: `nish --emit-ast f.ts` prints what was parsed
and `nish --emit-checked f.ts` prints the side tables the emitter reads. Both
are one node per line, which is to say diffable.

## A whole program

```ts nish:ok
const gcd = (a: i32, b: i32): i32 => {
  let x = a;
  let y = b;
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
};

export const main = (): i32 => {
  console.log(`gcd = ${gcd(1071, 462)}`);
  return 0;
};
```

That is the shape: top-level `const` arrows, an exported `main`, explicit types
everywhere, a template literal instead of `String(n)`.

- A module is one `.ts` file. At the top level it may hold **only**
  declarations: `const` arrows (functions), `class`, `interface`, module
  `const`s, `type` aliases, numeric `enum`s, and `import`s. There is no
  top-level code, so there is no initialisation order to think about.
- `export const main` lives in the entry module only, takes no parameters, and
  returns `void` or an `i32`-lowered `number` — the process exit code. Under
  `--number-mode f64`, declare it `main(): i32`.
- `number` is `i32` by default and `f64` under `--number-mode f64`. Write the
  explicit width (`i32`, `f64`) when you mean one; it reads the same in both
  modes.

## What you must unlearn

Every row is something a TypeScript-trained model writes by reflex and Nish
rejects. This table is the highest-value part of the page.

| Your reflex | What happens | Write instead |
| --- | --- | --- |
| `if (xs.length)` | `Condition must be boolean … (Nish has no truthiness)` | `if (xs.length !== 0)` |
| `x == y` | `Loose equality is forbidden` | `x === y` |
| `throw new Error(m)` | `` `throw` is forbidden `` | `return Err(m)`, or `panic(m)` to end the process |
| `try { … } catch { … }` | `` `try`/`catch`/`finally` is forbidden `` | `Result<T, E>` and `isErr()` |
| `xs.map(f)`, `.filter`, `.reduce`, `.forEach`, `.slice`, `.sort`, `.shift` | `` Unknown method `map` on i32[] (supported: push, pop, indexOf, join) `` | a `for` loop; there are no function values to pass |
| `s.toUpperCase()`, `s.split()`, `s.trim()`, `s.replace()` | `` Unknown method … on string `` | index bytes with `charCodeAt` / `substring` |
| `a?.b`, `a ?? b` | forbidden | `if (a !== null)` first |
| `x as T`, `<T>x`, `x!` | `Unsupported expression in Phase 1: AsExpression` | there are no casts; `implements` is the only widening |
| `any`, `unknown` | forbidden | name the real type |
| `undefined` | forbidden | `null`, with a `T \| null` type |
| `let total = 0` at the top level | `` Top-level `let` is not supported `` | a module `const`, or a local |
| a callback: `xs.forEach(f)`, `(cb: (n: i32) => i32)` | `` Unsupported type `(n: i32) => i32` `` | there are **no function values**; inline the body or write a loop |
| `type Pair<T>` (a generic alias) | `` Generic type parameters are forbidden on a type alias in Nish `` | a generic **function**, **class**, **interface** and **method** all work — see below; an alias renames a type that already exists, so it has nothing to specialise |
| `constructor<T>(x: T)` | a syntax error: `a constructor cannot have type parameters` | put the parameter on the class (`class Box<T>`), or on a method |
| `h.get<i32>(7)` (type argument at a method call) | `Type arguments are not written at a call site in Nish` | `h.get(7)` — a generic method infers like a generic function |
| `<T>(p: T) => p.x` (a member of a type parameter) | `` Cannot read `x` of `T`: an unconstrained type parameter has no members `` | `<T extends Point>(p: T) => p.x`, where `Point` is a class or interface that declares `x` |
| `identity<i32>(7)` (type argument at a call) | `Type arguments are not written at a call site in Nish` | `identity(7)` — `T` is inferred from the arguments |
| `async` / `await` / `Promise` | forbidden (no event loop) | the I/O builtins are synchronous |
| `class B extends A` | `` `extends` is not supported: Nish has no inheritance `` | repeat the fields and `implements` an interface |
| `static` members, getters/setters | not supported | module `const`s and plain methods |
| `type Pair = { a: i32 }` (inline object type) | `` Unsupported type `{ a: i32 }` `` | declare an `interface` |
| `A \| B` unions | `` Union types other than `T \| null` are forbidden `` | one type, or an `interface` prefix |
| `String(n)`, `n.toString()` | `` Unknown function `String` `` / `` Unknown method `toString` on i32 `` | `` `${n}` `` |
| `xs.length = 0` | `` Cannot assign to `length` of i32[] (array length is read-only; use `push`) `` | build a new array |
| `for (const k in o)` | `Unsupported statement in Phase 1: ForInStatement` | `for (const x of xs)` over an array |
| `import { readFileSync } from "fs"` | `` Cannot find package `fs` `` — a bare specifier is a **package name**, so it is looked for in `node_modules`; one that is installed but has no `nish` condition is `` Package `fs` has no Nish entry point `` | `readFileSync` is a global; no import needed (or `import { readFileSync } from "nish:fs"`) |
| `export default f` | `` `export default` / `export =` are not supported `` | `export const f = …` |
| `export type T = …`, `export enum K` | cannot be exported | declare the alias/enum in each module that needs it |
| `new Date()`, `Date.now()` | `` Unknown builtin `Date.now` `` | `monotonicNanos()` for elapsed time; there is no wall clock and no calendar |
| `JSON.parse`, `RegExp`, `Map`, `Set`, `Promise` | unknown / forbidden | none of these exist; write them or restructure |
| `let x = 5; x = "s"` | `Cannot initialize …` | types never change and never convert implicitly |

A worked pair. This is the single most common rejection:

```ts nish:err-body NL2188
const xs = [1, 2, 3];
if (xs.length) {
  console.log("non-empty");
}
```

```ts nish:ok-body
const xs = [1, 2, 3];
if (xs.length !== 0) {
  console.log("non-empty");
}
```

## Types

Every type is exactly one LLVM first-class type. No boxing, no runtime tag, no
structural subtyping, **no implicit conversion of any kind**: two values are
compatible only when their types are identical.

| Type | Is | Notes |
| --- | --- | --- |
| `number` | `i32`, or `f64` under `--number-mode f64` | the mode's default width |
| `i32`, `i64` | signed integers | signed overflow is undefined; `--wrapping` wraps |
| `u8`, `u16`, `u32`, `u64` | unsigned integers | arithmetic **always** wraps; `>>` is logical |
| `f32`, `f64` | IEEE-754 | `f32` is never the lowering of `number` |
| `boolean` | `i1` | no truthiness anywhere |
| `string` | immutable UTF-8 bytes | `length` is the **byte** length |
| `T[]`, `Array<T>` | one element type, bounds-checked | `readonly T[]` refuses every write |
| `Int32Array`, `Float32Array`, `Float64Array`, `BigInt64Array` | aliases of `i32[]`, `f32[]`, `f64[]`, `i64[]` | not distinct types |
| `class C`, `interface I` | a struct, fields in declaration order | no header, no vtable |
| `enum K` | a **distinct** type represented as `i32` | never interchangeable with `i32` |
| `T \| null` | `T` a class, interface, array, or string | a scalar can never be nullable |
| `Result<T, E>` | the only way to report failure | `E` may not be `void` |
| `void` | return type only | |

**Mixing widths is an error, always.** `f32 + f64`, `i64 + number`, even
`u32 + i32` (same LLVM type, different signedness) are rejected. Convert
explicitly: `toI32` `toI64` `toU8` `toU16` `toU32` `toU64` `toF32` `toF64`.

```ts nish:err NL2231
const bad = (a: i32, b: i64): i64 => {
  return a + b;
};
```

```ts nish:ok
const good = (a: i32, b: i64): i64 => {
  return toI64(a) + b;
};
```

### Numeric literals take their type from the immediate context

A literal is the mode's default (`i32`, or `f64` in f64 mode) **unless its
immediate context demands another numeric type**, and the contexts that do are
a closed list: an annotated initializer, a `return`, an argument to a user
*function* or to a constructor, the other operand of a binary operator whose
type is already known, `Math.min` / `Math.max`, the f64-only `Math.*` and
`toF64` / `toF32`, `process.exit`, `Number`, an element of an array literal
that itself has a `T[]` context, a class field's literal initializer, a field
or element assignment target, a ternary arm taking the conditional's own
context, and `push` / `indexOf` through a receiver that is a **plain name**.

Everything else leaves the literal at the default, however obvious the intent.
The three that catch you out: an **object-literal property**, a `Result`
payload, and a **method's** argument.

```ts nish:err NL2269
interface Pixel { r: u8; g: u8; b: u8; }

export const main = (): i32 => {
  const p: Pixel = { r: 255, g: 0, b: 0 };
  console.log(`${p.r}`);
  return 0;
};
```

```ts nish:ok
interface Pixel { r: u8; g: u8; b: u8; }

export const main = (): i32 => {
  const p: Pixel = { r: toU8(255), g: toU8(0), b: toU8(0) };
  console.log(`${p.r}`);
  return 0;
};
```

The same rule refuses `const b: u8 = 1 + 2` — that is a sum of two `i32`
literals, not a literal in a `u8` context. Name the value first, or convert.

## Failure: `Result`, not exceptions

There is no `throw`, no `try`, and no unwinding anywhere in the language. A
function that can fail says so in its return type.

```ts nish:ok
const half = (n: i32): Result<i32, string> => {
  if (n % 2 !== 0) {
    return Err("odd");
  }
  return Ok(n / 2);
};

const quarter = (n: i32): Result<i32, string> => {
  const h = half(n).orReturn();   // Rust's `?`: propagates the error
  return half(h);
};

export const main = (): i32 => {
  const outcome = quarter(8);
  if (outcome.isErr()) {
    console.error(outcome.error);
    return 1;
  }
  console.log(`${outcome.value}`);
  return 0;
};
```

The surface: `Ok(v)` / `Ok()`, `Err(e)`, `r.isOk()`, `r.isErr()`, `r.ok`,
`r.value`, `r.error`, `r.orReturn()`, `r.unwrapOr(d)`, `r.expect(msg)`. There
is deliberately no `unwrap()` — `expect` insists on a reason — and no
`map`/`andThen`, which would need function values.

**Three rules, and they are the ones that catch you out:**

1. **A `Result` cannot be dropped.** A call answering one may not stand as an
   expression statement, and a local holding one must be read at least once.
   Passing it on — as an argument, as a `return` — counts as reading it.
2. **The error arm comes first.** `r.value` is legal only where the checker
   proved `isOk()`; `r.error` only where it proved `isErr()`. There is no
   spelling that reaches the success payload without deciding what happens to
   the failure.
3. **Propagation is contagious.** `r.orReturn()` is legal only inside a
   function that itself returns a `Result` whose error arm accepts `E`. There
   is no implicit error conversion — convert by hand with
   `if (r.isErr()) { return Err(…); }`.

```ts nish:err NL2044
const half = (n: i32): Result<i32, string> => {
  return Ok(n / 2);
};

export const main = (): i32 => {
  const r = half(8);
  console.log(`${r.value}`);
  return 0;
};
```

Narrowing follows the same engine as `T | null` below: it applies to a
**variable**, never a property path; it ends at any assignment to that
variable; and it is dropped before a loop that assigns it. `if (r.isOk()) A
else B` narrows in `A`, and after the `if` when `B` cannot fall through.

`panic(message)` is the other ending: message to stderr, exit 1. It is for an
invariant that cannot hold, not for a failure a caller should handle. It
terminates control flow, so a non-`void` function may end with it.

## Absence: nullable types

`T | null` is available for `T` a class, interface, array, or string — never a
scalar, which has no null value. It is the same pointer with `null` as one more
value, so nothing is boxed.

```ts nish:ok
class Node {
  value: i32;
  next: Node | null = null;
  constructor(value: i32) {
    this.value = value;
  }
}

const total = (head: Node | null): i32 => {
  let sum = 0;
  let cur = head;
  while (cur !== null) {
    sum = sum + cur.value;
    cur = cur.next;
  }
  return sum;
};

export const main = (): i32 => {
  const a = new Node(1);
  a.next = new Node(2);
  console.log(`${total(a)}`);
  return 0;
};
```

- Reading anything off an un-narrowed nullable is an error: narrow with
  `!== null` first. `?.` and `??` are forbidden outright.
- Narrowing applies to a **local or parameter**, never a property path. `if
  (n.next !== null) n.next.v` is rejected — copy into a local first.
- A narrowing ends at any assignment to the variable, and is dropped before a
  loop whose body, condition or update assigns it.
- Two nullables cannot be compared with each other; compare each with `null`.
- `new Array<T | null>(n)` is allowed: the zero fill *is* `null`.

## Declarations

### Functions

```ts nish:ok
const add = (a: i32, b: i32): i32 => {
  return a + b;
};

const double = (n: i32): i32 => n * 2;   // a concise body is that one `return`
```

- A function is a **module-level `const` bound to an arrow**. `let` is
  rejected; annotating the `const` is rejected (the annotation would be a
  function type, and those are forbidden). The `function` keyword is accepted
  as the legacy spelling and compiles to identical IR.
- **Every parameter and the return type must be annotated.**
- **A function is not a value.** `const alias = double` is
  `` Unknown identifier `double` ``. No callbacks, no function types, ever.
- **Parameters are immutable**: `p = 1`, `p++`, `p += 1` are all rejected. Copy
  into a `let` first.
- A non-`void` function must return on every path.
- Rejected: generators, `async`, destructured / rest / optional / default
  parameters, overloads, nested function declarations. Type parameters *are*
  allowed — see [Generic functions](#generic-functions).

### Generic functions

A function may declare type parameters, and **each instantiation is compiled to
its own specialised function** — no boxing, no dictionary, no runtime type
information. The IR is what somebody would have written by hand at that type.

```ts nish:ok
const identity = <T>(x: T): T => x;

export const main = (): i32 => {
  console.log(identity(7));
  console.log(identity("hi"));
  return 0;
};
```

- **The type argument is inferred from the arguments and is never written at a
  call site.** `identity<i32>(7)` is
  `Type arguments are not written at a call site in Nish`. Inference matches the
  shape of each declared parameter against its argument — `T` against `i32`,
  `T[]` against `i32[]`, `Result<T, string>` against `Result<i32, string>` —
  left to right, first binding wins.
- **A type parameter that appears in no parameter is an error at the
  declaration**, because it could never be inferred.
- **Every other rule still applies inside.** A type parameter is not a hole to
  smuggle something through: each instantiation is checked with `T` bound to a
  concrete type.
- **A template may be exported and instantiated from another module.** Each
  instantiation is defined once, in the module that declares the template, and
  `declare`d everywhere else — so one imported name becomes one symbol per
  distinct type-argument tuple, and two modules asking for the same tuple share
  the one definition. A type argument may be a class the declaring module has
  never heard of. A template that is not exported cannot be imported, and an
  imported one may be renamed (`import { identity as id }`) without moving the
  symbol. A type-argument list on an imported name that is *not* a template is
  `` `Point` in `./lib` takes no type arguments ``.
- **A type parameter has no members unless it is constrained.** Passing a `T`
  on, returning it, storing it and comparing it are fine; `p.x`, `p.x = 1` and
  `p.m()` through a `T` are `` Cannot read `x` of `T`: an unconstrained type
  parameter has no members ``, even when every call passes a type with an `x`.
  It is where the value came from that counts — a local copied from a `T`, an
  element of a `T[]` and a narrowed `T | null` are all a `T` — never its type.

```ts nish:err NL2329
interface Point { x: i32; y: i32; }

const getX = <T>(p: T): i32 => p.x;

export const main = (): i32 => {
  const p: Point = { x: 1, y: 2 };
  return getX(p);
};
```

- **`<T extends Shape>` gives `T` exactly `Shape`'s members**: its fields, and
  its methods when `Shape` is a class. A constraint is a declared class or
  interface (or `Container<i32>`, with its arguments written out) — never a
  scalar, `string`, an array or another type parameter. Each instantiation still
  reads its own struct directly, with no vtable.
- **A type argument must satisfy the constraint**: be `Shape` itself, or a
  class that declares `implements Shape`. Matching field names are not enough.
  A class constraint is satisfied by that class alone. The refusal is at the
  call: `` `T` of `areaOf` requires `T extends Shape`, and `i32` does not
  implement it ``.

```ts nish:ok
interface Shape { area: i32; }

class Circle implements Shape {
  area: i32;
  radius: i32;
  constructor(r: i32) { this.area = 3 * r * r; this.radius = r; }
}

const areaOf = <T extends Shape>(s: T): i32 => s.area;   // s.radius would be refused

export const main = (): i32 => areaOf(new Circle(2)) - 12;
```

- **Not supported yet**, each with its own message: a default type argument
  (`<T = string>`), and type parameters on a **constructor or type alias**. A
  generic `main` is refused. There are no multiple bounds (`T extends A & B`)
  and no bound that mentions another parameter.
- **`$` may not appear in a function, class or interface name** — it is what
  separates a generic's name from its type arguments in the emitted symbol.

### Generic classes and interfaces

A `class` or an `interface` may take type parameters too, and an instantiation
is **an ordinary struct**: `Box<i32>` is `%struct.Box$i32` with `Box`'s fields
at `T = i32`, and everything the language does to a struct works on it.

```ts nish:ok
class Box<T> {
  value: T;
  constructor(v: T) { this.value = v; }
  get(): T { return this.value; }
}

interface Pair<A, B> { first: A; second: B; }

export const main = (): i32 => {
  const b = new Box<i32>(7);
  const p: Pair<i32, string> = { first: 1, second: "hi" };
  console.log(p.second);
  return b.get();
};
```

- **Write the type arguments out.** `Box` on its own is not a type — there is
  no layout until `T` is bound — so it is `` `Box` is generic: it must be
  written with its type arguments ``. The two positions that take them are an
  annotation (`const b: Box<i32>`) and `new` (`new Box<i32>(7)`); a *call*
  infers instead. A class that is not generic takes none.
- **A type argument may be anything a type may be**, including another
  instantiation: `Box<Point>`, `Box<Box<i32>>`, `Box<i32[]>`,
  `Box<Result<i32, string>>`.
- **`implements` may name an instantiation**: `class Box<T> implements
  Container<T>` is checked per instantiation by the usual field-prefix rule.
- **A field may not grow its own type argument.** `class Nest<T> { inner:
  Nest<T[]> | null }` is `` Monomorphising `Nest` would not terminate ``;
  `Nest<T>` and a type that mentions no parameter are both fine.
- **A type parameter takes no type arguments of its own.** `T` is whatever the
  instantiation bound it to, so `const y: T<i32>` is
  `` Unsupported type reference `T<i32>` ``.
- **A template obeys every rule a declared class obeys**: `declare class
  Box<T>`, `export default class Box<T>`, `abstract class Box<T>` and
  `interface Box<T> extends Base` are refused in the words their non-generic
  spellings are refused in.
- **A template claims its name.** `class Box<T>` is a declaration of `Box`, so
  a function, constant, alias, enum or second class of that name is refused
  whichever was written first: `` `Box` is already declared in this module ``,
  or `` Duplicate declaration of `Box` `` for a second class.
- **Two modules may not both declare a generic class of one name** once both
  instantiate it: `%struct.Box$i32` is program-wide, so
  `` Generic class `Holder` is also declared in helper.ts ``.
- **A generic class or interface may be imported**, and the rule is a generic
  function's: `%struct.Box$i32` and every `@Box$i32.*` symbol are defined once,
  by the module that declares `Box<T>`, and `declare`d by every module that
  holds one. Unlike a declared class it may be renamed on import, because the
  name that crosses the ABI is the template's. Named without its type arguments
  it is `` `Crate` is generic: it must be written with its type arguments ``.
- **A class or interface may constrain its parameters** — `class Holder<T
  extends Shape>` — by the rules a function's follow: its methods may read
  `this.item.area` through a field of type `T`, and `new Holder<Point>` or an
  annotation `Holder<Point>` is refused unless `Point` satisfies `Shape`.

### Generic methods

A method — of a generic class or not — may declare its own type parameters.
They are inferred from the arguments like a generic function's, and each
(receiver, method type arguments) pair is its own `define`:
`@Chooser.pick$i32`, `@Box$i32.keep$str`.

```ts nish:ok
class Chooser {
  flip: boolean = false;
  pick<T>(a: T, b: T): T { return this.flip ? b : a; }
}

class Box<T> {
  value: T;
  constructor(v: T) { this.value = v; }
  keep<U>(other: U): T { return this.value; }
}

export const main = (): i32 => {
  const c = new Chooser();
  const word: string = c.pick("left", "right");
  console.log(word);
  return c.pick(0, 1) + new Box<i32>(7).keep("seven") - 7;
};
```

- **Never write the type arguments at the call**: `c.pick<i32>(1, 2)` is
  `` Type arguments are not written at a call site ``. A method type parameter
  that no parameter mentions is `` Cannot infer `U` for `Holder.make` ``.
- **Do not reuse a class parameter's name**: `class Box<T> { map<T>(…) }` is
  `` Type parameter `T` of `Box.map` shadows `Box`'s own `T` `` (NL2331) —
  call the method's `U`.
- **Constrain it like a function's** — `apply<U extends Shape>(u: U)` reads
  `u.area` — but the constraint may not mention a type parameter, the class's
  included.
- **A constructor takes none**; its class's are written after `new`.

```ts nish:err NL2331
class Box<T> {
  value: T;
  constructor(v: T) { this.value = v; }
  map<T>(other: T): T { return other; }   // shadows Box's T: call it U
}

export const main = (): i32 => new Box<i32>(1).value;
```

### Calling C

`declare function name(params): T;` declares a C function this program calls but
does not define. The symbol is the identifier, unmangled, and the call is an
ordinary call.

```ts nish:ok
declare function abs(n: i32): i32;

export const main = (): i32 => {
  console.log(`${abs(-5)}`);
  return 0;
};
```

- **Every position must be a scalar** — the integer and float widths, `boolean`,
  `void`. A `string`, array, class or interface is rejected. That is not style:
  a scalar boundary has no pointer for a foreign function to capture or free,
  which is what lets the escape analysis stay correct without knowing anything
  about the callee.
- **No body, and it cannot be `export`ed.**
- **It costs the caller its attributes.** Nothing about a body the compiler
  cannot see is provable, so a function that calls C loses `readnone` and
  `willreturn`, and so does everything above it in the call graph. A program
  that calls C is no longer one the compiler can reason about end to end — that
  trade *is* the feature.

### Module constants

```ts nish:ok
const TOKEN_NAME: i32 = 1;
const TOKEN_END: i32 = TOKEN_NAME + 1;
export const PROMPT: string = "> ";
```

A top-level `const` names a value the compiler already knows. **No symbol is
emitted and no initialiser runs** — every use lowers to the value itself.

- The **type annotation is required**, and so is an initialiser.
- The type must be `i32`, `i64`, `f64`, `number`, `boolean`, or `string`. An
  array, class or interface constant would need an allocation, and there is no
  code to run it.
- The initialiser is literals, other constants (declared anywhere, or
  imported), and arithmetic over them. A call, a `new`, a local — anything else
  — is rejected.
- Folding uses the language's own arithmetic, so an overflowing fold is an
  error rather than a wrap, and `1 / 0` in a constant is refused at compile
  time.

### Classes and interfaces

```ts nish:ok
interface Shape { width: i32; height: i32; }

class Rect implements Shape {
  width: i32;
  height: i32;
  label: string = "r";

  constructor(width: i32, height: i32) {
    this.width = width;
    this.height = height;
  }

  area(): i32 {
    return this.width * this.height;
  }
}

const describe = (s: Shape): i32 => s.width + s.height;

export const main = (): i32 => {
  const r = new Rect(3, 4);
  console.log(`${r.area()} ${describe(r)}`);
  return 0;
};
```

- Fields need annotations; an initializer must be a **literal** of the field's
  type. Layout is declaration order, exactly as clang lays out the same C
  struct.
- At most one constructor, no parameter properties, no overloads. **Definite
  assignment** is checked syntactically: after the constructor returns every
  field holds a value, and reading `this.f` before every field is assigned is
  an error.
- Methods need a body and an explicit return type. `readonly` fields may be
  assigned only as `this.f = v` in their own class's constructor.
- `===` / `!==` on two values of one class is pointer identity; `<` and friends
  are rejected.
- **No inheritance.** `extends` and `super` are rejected in every spelling.
- An **interface** is a struct with fields only — no methods, no `extends`, no
  `new`.
- **`class C implements I` requires `I`'s fields to be `C`'s first fields**, in
  order, with identical types; `C` may declare more after them. A `C` then
  converts to an `I` wherever one is expected. **This is the only widening in
  the language**, and nothing converts back — no downcast, no `instanceof`.

### An array of records is one contiguous block

`Point[]` where `Point` is a class or interface stores the records themselves,
back to back — not an array of pointers. So `ps[i]` is an *interior* pointer,
and `push` may move the whole block to grow it. **Holding an element across a
`push` on the same array is therefore refused**, because the write would land
in the old storage:

```ts nish:err NL2290
interface Point { x: i32; }

export const main = (): i32 => {
  const ps: Point[] = [{ x: 1 }];
  const p = ps[0];
  ps.push({ x: 2 });
  p.x = 3;
  return 0;
};
```

Index again after the `push` instead of holding the element across it:

```ts nish:ok
interface Point { x: i32; }

export const main = (): i32 => {
  const ps: Point[] = [{ x: 1 }];
  ps.push({ x: 2 });
  ps[0].x = 3;
  console.log(`${ps[0].x}`);
  return 0;
};
```

### Object literals

An object literal takes its type from context — a variable annotation, the
enclosing function's return type, the parameter it is passed to, the field it
is assigned to, or a field of an enclosing literal. It must set every field
exactly once, with plain identifier keys.

```ts nish:ok
interface Pair { first: i32; second: i32; }

const swap = (p: Pair): Pair => ({ first: p.second, second: p.first });

export const main = (): i32 => {
  const p: Pair = { first: 1, second: 2 };
  console.log(`${swap(p).first}`);
  return 0;
};
```

The context reaches a nested literal and a `null`, and stops there: a numeric
literal in a property keeps the mode's default type (above), and `[]` has no
element type at all in that position.

### Type aliases and enums

```ts nish:ok
type Byte = u8;
type Bytes = Byte[];

enum Kind {
  If = 1,
  While = 2,
}

const name = (k: Kind): string => {
  switch (k) {
    case Kind.If:
      return "if";
    default:
      return "while";
  }
};

export const main = (): i32 => {
  console.log(name(Kind.If));
  return 0;
};
```

- A `type` alias is a second name for an existing type, **not a type of its
  own** — the same program with and without its aliases emits byte-identical
  IR. A generic *alias* is still forbidden even though a generic function,
  class and interface are not; built-in names may not be aliased.
- A numeric `enum` is a **distinct type** represented as `i32`, and that is the
  point: `Kind` and `i32` never convert in either direction. Members must be
  numeric literals. `===` and `!==` are the **only** operators — no arithmetic,
  no bitwise, so **bit flags stay `i32` module constants**.
- **Neither can be exported.** Both are module-local; declare them in every
  module that needs them. A class or interface is what crosses a module
  boundary.
- Both are top-level only.

### Modules

- `export` goes on `const` (function or constant), `class`, and `interface`
  declarations. No `export default`, no `export { … }`, no `export *`.
- The only import form is a **named import**:
  `import { square, cube as pow3 } from "./math"`. `.ts` is optional. Default
  imports, namespace imports, side-effect imports and type-only imports are all
  rejected.
- A specifier is a relative path (`./x`, `../x`), a builtin module (`nish:fs`),
  a standard-library module (`nish/text`), or a **package name** (`hash`,
  `@scope/hash`, with a subpath after it if you want one).
- **A package is resolved through `node_modules` and compiled from source.**
  The package's `package.json` must offer the file under the `nish` export
  condition — `{"exports": {".": {"nish": "./src/index.ts"}}}` — and the mode
  gets a spelling of its own, `nish-i32` / `nish-f64`, for source that is only
  correct under one `--number-mode`. The mode-qualified condition wins wherever
  the package declares it, so a manifest carrying both never compiles the wrong
  one of the two. A package without that condition is
  `` Package `lodash` has no Nish entry point ``, which is what an ordinary npm
  package gets: there is nothing to compile in a `.js` file.
- Functions may be renamed on import; classes and interfaces may not — the type
  name is part of the ABI.
- Import cycles are allowed; a shared dependency is compiled once.
- **A function name is unique across the whole program**, exported or not.
- An `export`ed function is an external C-ABI symbol; every other function gets
  `internal` linkage so LLVM may inline or drop it.

## Statements

- **Conditions must be `boolean`.** There is no truthiness, in `if`, `while`,
  `for`, the ternary, `&&` or `||`.
- `let` / `const` need an initializer and take their type from it; an
  annotation must match **exactly**. `const` freezes the binding, not the
  contents: `xs[0] = 1` and `xs.push(1)` on a `const xs` are fine.
- `var` is forbidden. Destructuring is not supported.
- `for (init; cond; update)` with every clause optional, and
  `for (const x of xs)` over an **array** only — `x` gets the element type and
  must not be annotated. The array's `length` is re-read each iteration, so a
  `push` inside the body extends the loop.
- `switch` takes an **integer or enum** discriminant; every `case` label is an
  integer constant expression of that type. **There is no implicit
  fallthrough** — a clause with statements ends in `break`, `return`,
  `continue` or `process.exit`, unless it is the last. An *empty* clause does
  fall through, which is how `case 1: case 2:` shares a body. A clause cannot
  declare a variable directly; wrap its body in a block.
- `break` / `continue` are unlabelled only; labeled statements are forbidden.
- `process.exit(code)` and `panic(msg)` **terminate control flow**, so a
  non-`void` function may end with either.
- **Unreachable code is an error**, not a warning: anything after a `return`,
  `break`, `continue`, `process.exit`, an `if` whose branches all return, or an
  infinite loop.

```ts nish:err NL2166
const classify = (n: i32): string => {
  switch (n) {
    case 0:
      console.log("zero");   // no `break`: a clause with statements must end in one
    case 1:
      return "one";
    default:
      return "many";
  }
};

export const main = (): i32 => {
  console.log(classify(0));
  return 0;
};
```

## Expressions

- Arithmetic `+ - * / %` takes **two numbers of one type**. `+` on two strings
  concatenates; `string + number` is rejected (use a template literal).
- **Integer division is checked**, Rust-style: a zero divisor, or `MIN / -1`,
  prints to stderr and exits 1. Float division is never checked.
- Bitwise `& | ^ ~` and shifts `<< >> >>>` take **integers of one type**.
  `>>` is arithmetic on a signed type and logical on an unsigned one; the shift
  count is masked to the operand width.
- `=== !==` on any two values of the same type: integers and booleans by value,
  `f64` by `fcmp` (so `x !== x` is true for `NaN`), **strings by content**,
  arrays and objects by **identity**.
- `< <= > >=` on two numbers of one type and nothing else — not booleans, not
  strings, not structs.
- `++` / `--` work on **numeric mutable locals only**, not fields or elements.
- Compound assignment `+= -= *= /= %=` requires a numeric target (so `+=` never
  concatenates strings); the bitwise forms need an integer target.
- **Forbidden**: `,` `??` `?.` `in` `instanceof` `typeof` `delete` `void expr`
  `==` `!=` `**` unary `+`.
- Element access `a[i]` needs an array and a numeric index, and is
  bounds-checked (negative indices fail too). String-keyed access is forbidden.
  The check comes off where the compiler proves the index in range — a loop
  condition `i < xs.length`, or `i < h.xs.length` on a field path — as long as
  nothing between the test and the access calls a function, stores to a field
  the path names, or reassigns its root.
- Array literals need one element type; `[]` needs a contextual `T[]`. Holes
  and spread are not supported.
- Template literals accept holes of type `string`, `number`, `i64`, `f64` or
  `boolean` — this is how you convert a number to a string.

## The builtins, in full

No import is needed; these are resolved by name, and a user function of the
same bare name shadows the builtin. **This list is exhaustive** — anything not
on it does not exist, and inventing a method is the most common way to write a
program that does not compile.

**Output.** `console.log(x)` and `console.error(x)` take exactly one argument
of `string | number | i64 | f64 | boolean` and are **statement position only**.
`write(s)` / `writeError(s)` take a `string` and add no newline.
`panic(message)` writes to stderr and exits 1.

**`Math`.** `sqrt` `floor` `ceil` `trunc` `sin` `cos` `exp` `log` (all `f64`
argument, `f64` result), `pow(x, y)`, `round(x)`, `abs(x)` (any numeric type),
`min(a, b)` / `max(a, b)` (exactly two, one type), `random()`, and the
constants `Math.PI` / `Math.E`. The f64-only ones reject an `i32`: write
`Math.sqrt(toF64(n))`.

**Conversions.** `toI32` `toI64` `toU8` `toU16` `toU32` `toU64` `toF32`
`toF64`; `f64ToBits(x)` / `bitsToF64(b)` reinterpret rather than convert;
`Number(x)`, `parseInt(s)` (base 10, `i32`, no `NaN` — no digits give `0`),
`parseFloat(s)`.

**Arrays.** `a.length` (read-only), `a.push(v)`, `a.pop()` (panics when empty —
there is no `undefined` to return), `a.indexOf(v)`, `a.join(sep)` — **`join` is
`string[]` only**. That is every array method there is.

**Strings.** `s.length` (**bytes**), `s.charCodeAt(i)` (the byte, bounds-checked),
`s.substring(start[, end])`, `s.slice(start[, end])`, `s.indexOf(sub)`,
`s.startsWith(sub)`, `s.endsWith(sub)`, and `String.fromCharCode(c)`. That is
every string method there is. `substring` **clamps** an out-of-range offset the
way JavaScript does; `slice` instead **panics** unless
`0 <= start <= end <= s.length`, and is the faster of the two when you have
already established the range. Every offset is a **byte** offset, so cutting a multi-byte character
in half is possible.

**Process.** `process.exit(code)`, `process.argv` (a read-only `string[]`;
`argv[0]` is the program path, one index earlier than Node),
`process.platform`, `process.arch`.

**Files and the system.** `readFileSync(path)` (exits 1 on failure),
`readFileSyncOrNull(path)` (`string | null`), `writeFileSync(path, data)`,
`appendFileSync(path, data)`, `mkdirSync(path)` (one level, `boolean`),
`isDirectorySync(path)`, `readdirSync(path)` (`string[] | null`, sorted by
bytes, no `.`/`..`), `spawnSync(argv)`, `spawnSyncTo(argv, outPath, errPath)`,
`getenv(name)` (`string | null` — unset and empty are different answers),
`realpathSync(path)` (`string | null`; symbolic links resolved, absolute, and
`null` when it does not resolve),
`monotonicNanos()` (`i64`; elapsed time only, **there is no wall clock and no
`Date`**).

**Arena.** `Arena.mark()`, `Arena.release(m)`, `Arena.reset()`, `Arena.used()`
— see below.

## Memory

There is **no garbage collector and no `free`**, and nothing about this changes
what a program computes — only where memory lives. You do not have to manage
it, and mostly you should not try:

1. **Stack allocation** for a `new`, object literal, array literal or
   `new Array<T>(literal)` whose value provably does not outlive its function.
2. **Automatic arena scopes** for a function whose temporaries all die with it:
   a mark on entry, a release before every `ret`.
3. **A reclaim at the call site** for a function that returns a string.
4. **Explicit control** with the `Arena` builtins, for code that manages
   batches itself.

Everything else is bumped from the arena, which is released when `main`
returns. **Safety rule**: `Arena.release` / `Arena.reset` while any object,
array or string allocated after the mark is still referenced is undefined
behaviour. Reach for them only when you are deliberately managing a batch.

## Recipes for what is missing

**Iterate and transform** — there is no `map`, and no function to pass it:

```ts nish:ok-body
const xs: i32[] = [1, 2, 3];
const doubled: i32[] = [];
for (const x of xs) {
  doubled.push(x * 2);
}
console.log(`${doubled.length}`);
```

**Convert a number to a string** — there is no `toString` and no `String()`:

```ts nish:ok-body
const n = 42;
const s = `${n}`;
console.log(s);
```

**Return two values** — there are no tuples: declare an interface.

```ts nish:ok
interface Split { head: string; rest: string; }

const cut = (s: string, at: i32): Split => ({
  head: s.substring(0, at),
  rest: s.substring(at),
});

export const main = (): i32 => {
  console.log(cut("hello", 2).rest);
  return 0;
};
```

**A map or a set** — neither exists. Use parallel arrays with a linear scan, or
an array indexed by a small integer key, and write the lookup out.

**Shared behaviour over several shapes** — there is no inheritance and no
dispatch. Give each class the interface's fields **first**, `implements` it,
and write a free function over the interface:

```ts nish:ok
interface Sized { width: i32; height: i32; }

class Photo implements Sized {
  width: i32;
  height: i32;
  path: string = "";
  constructor(width: i32, height: i32) {
    this.width = width;
    this.height = height;
  }
}

const area = (s: Sized): i32 => s.width * s.height;

export const main = (): i32 => {
  console.log(`${area(new Photo(3, 4))}`);
  return 0;
};
```

**Optional parameters** — there are none. Write two functions with different
names, or take the value and document the sentinel.

**A wall clock, regex, JSON, threads of your own** — not in the language. Say
so rather than emitting code that cannot compile.

## Before you say it compiles

Run it. `nish file.ts --json` is one command and it is the only proof.

1. Did you **run the compiler**? Nothing else counts.
2. Are all conditions `boolean` — no `if (x)` on a number, string or array?
3. Did you invent a method? Check it against
   [the builtins list](#the-builtins-in-full).
4. Is every parameter, return type, field and module constant annotated?
5. Does every numeric type match exactly — no `i32` meeting `i64`, no literal
   in an object-literal property or a method argument expecting a width?
6. Is every `Result` read, and is every `.value` behind an `isOk()`?
7. Is every nullable narrowed with `!== null` before it is touched?
8. Did you use `throw`, `try`, `any`, `undefined`, `?.`, `??`, a cast, a
   callback, a generic *alias* or *method*, or `extends`?
9. If you are adding to this repository: `npm run check` and `npm test` green,
   and a new construct ships a golden `.ll`, an `llvm-as` pass, a native round
   trip, a negative test, its `LANGUAGE.md` rule and cookbook entry, and a
   `CHANGELOG.md` line.

Every `ts nish:ok` and `ts nish:err` block on this page is compiled by
`npm test`, so an example that has gone stale is a failing test rather than a
program that no longer works.
