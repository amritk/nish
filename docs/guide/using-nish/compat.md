# The compatibility dialect

Nish compiles a strict subset of TypeScript. The compatibility dialect is the
second way to build a program: it accepts more of TypeScript, one feature at
a time, for code that was written for Node and is being moved over. You ask
for it by name, a build that does not ask is unchanged, and the compiled
program says which one it was built in.

The dialect changes the number a bare `number` is, and it has six features:
`optional-chaining`, `nullish`, `string-switch`, `for-of-string`,
`optional-params` and `overloads`. Each admits a form of TypeScript the strict
dialect refuses, with the meaning Node gives it.

The rules are in the reference, under
[The compatibility dialect](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#the-compatibility-dialect).

## Asking for it

Pass `--compat` where you would build or run the program:

```sh
nish --link app.ts --compat -o app
nish run --compat app.ts
```

Or say so once in your `package.json`, and every build of the package is a
compat build with no flag:

<!-- nish:ok -->
```json package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": true
  }
}
```

<!-- nish:ok -->
```ts main.ts
const half = (n: number): number => n / 2

export const main = (): void => {
  console.log(half(7))
}
```

That prints `3.5`. In the strict dialect a bare `number` is a 32-bit integer
and the same program prints `3`.

`"compat"` is `true` for every feature this compiler has, or an array naming
the ones you want, such as `["nullish"]`. `[]` is the dialect with no feature.
`--compat=<feature>,...` is the array on the command line.

When the strict dialect refuses something a feature would accept, the error
says which feature to add:

```log
main.ts:4:10: error: Nullish coalescing `??` is forbidden in Nish (narrow with `!== null` instead)
  = add `nullish` to `nish.compat` in package.json to accept it
```

## A name that is no feature

A name that is no feature is refused, on the command line (exit 2) and in
`package.json` (`NL3056`), so a typo cannot quietly leave a feature off:

<!-- nish:ok -->
```json package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": ["asnyc"]
  }
}
```

<!-- nish:err NL3056 -->
```ts main.ts
export const main = (): void => {
  console.log(1)
}
```

```log
package.json:5:16: error: `asnyc` is no feature of the compatibility dialect: `nish.compat` is `true` or an array of feature names, and the ones this compiler has built are `nullish`, `optional-chaining`, `string-switch`, `for-of-string`, `optional-params`, `overloads`
```

## Numbers are doubles

The dialect implies [`--number-mode f64`](cli.md): a bare `number` is a 64-bit
float, as it is in Node. Everything `--number-mode f64` means holds, its
errors included. The one you are most likely to meet is `main`'s return type:
the exit code is a 32-bit integer, so a `main` that returns a bare `number` is
refused.

<!-- nish:ok -->
```json package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": true
  }
}
```

<!-- nish:err NL2140 -->
```ts main.ts
export const main = (): number => {
  return 0
}
```

Write `main(): i32` or `main(): void` instead. Types that spell their width
(`i32`, `f64`, `u8`) mean the same in both dialects.

A program whose arithmetic was written for 32-bit integers can keep them:
`--compat --number-mode i32` is honoured. The compiler says once what that
costs, as a performance warning (`NL9020`), because arithmetic that may leave
32 bits is a compile error there, or a panic under `--allow-panics`, where a
double would carry on. `--no-warn-performance`
silences it.

```text
app.ts:1:1: performance: `--number-mode i32` beside the compatibility dialect: a bare `number` is the 32-bit integer and not the double a JavaScript engine computes with, so arithmetic that leaves 32 bits panics here where it would carry on there; drop `--number-mode i32` for the dialect's own f64
```

## Optional chaining as a statement

The strict dialect takes a `?.` chain only as the left side of a `??`, which
gives it a value when a link is missing. With `optional-chaining`, a chain
that is a statement of its own compiles too: it runs when every link is
there, and does nothing from the first `null` link, its call's arguments
included, as Node does.

<!-- nish:ok -->
```json package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": ["optional-chaining"]
  }
}
```

<!-- nish:ok -->
```ts main.ts
class Counter {
  n: number = 0
  bump(by: number): void {
    this.n += by
  }
}

export const main = (): void => {
  const a: Counter | null = new Counter()
  const b: Counter | null = null
  a?.bump(2)
  b?.bump(5)
  console.log(a === null ? -1 : a.n)
}
```

That prints `2`. An element read may sit inside a chain, as in
`rows?.[i].length ?? -1`: the bounds check runs only when the array is there.

### What stays refused

Two forms stay refused in both dialects, because Node's answer and the
compiled program's would part. An element read the chain would carry on past
is refused (`NL1067`): a `?.[i]` that ends a `??` chain or a statement, and,
in a statement, any element read that ends it, `h?.xs[i];`, or that a `?.`
tests, `xs[i]?.bump();` or `(xs[i])?.bump();`. Past the end of the array Node answers `undefined`
and goes on, where Nish refuses an index it cannot prove in range, and its
bounds check panics under `--allow-panics`. Test the index against `length`
instead. (With a `??` default, `xs[i]?.n ?? 0` is the strict
dialect's own: the `?.` tests a nullable element, and the read is
bounds-checked as every element read is. So is a plain element read that
ends a `??` chain, `h?.xs[5] ?? 0`: under `--allow-panics` it panics past the
end where Node gives `0`, exactly as the strict build does.) (A `?.[i]` that ends a chain anywhere else, as in
`const x = xs?.[0]`, is refused as a chain with no default.) And an optional
call `f?.()` is refused (`NL1068`): narrow `f` with `!== null` and call it.

<!-- nish:ok -->
```json package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": ["optional-chaining"]
  }
}
```

<!-- nish:err NL1067 -->
```ts main.ts
const first = (xs: number[] | null): number => xs?.[0] ?? -1

export const main = (): void => {
  console.log(first([42]))
}
```

## Nullish coalescing on a value that is never missing

The strict dialect refuses a `??` whose left side can never be `null`: the
default would never run. Code written for Node often has one anyway. With
`nullish` it compiles to its left side, as Node computes it, and the compiler
says so in a performance warning (`NL9021`) that names the default to drop:

<!-- nish:ok -->
```json package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": ["nullish"]
  }
}
```

<!-- nish:ok -->
```ts main.ts
const size = (p: string | null): number => {
  if (p !== null) {
    return (p ?? "fallback").length
  }
  return 0
}

export const main = (): void => {
  console.log(size("abc"))
}
```

```text
main.ts:3:13: performance: `p` is never `null` or `undefined`, so `??` never runs its default: the build keeps the left operand alone (drop `?? "fallback"`)
```

This covers a left side the compiler can see JavaScript never leaves
`undefined`: a literal, a name, `this`, a `new`, an arithmetic or logical
operation, or a field read of one of these. A call or a ternary on the left,
`twice(x) ?? 1` or `(c ? a : b) ?? 0`, keeps the strict refusal for now, as
does an element read, `xs[i] ?? 0`, which can run past the end.

The default must still have the type of the left side, as TypeScript asks
(`NL2370`). A `??` on a value that may be `null` is the strict dialect's own,
and means the same in both.

## A `switch` on a string

The strict dialect switches on integers and enums only. With `string-switch`,
a `switch` on a `string` compiles too, and picks its case as Node does:

<!-- nish:ok -->
```json package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": ["string-switch"]
  }
}
```

<!-- nish:ok -->
```ts main.ts
const HELLO: string = "hello"

const kind = (word: string): string => {
  switch (word) {
    case "a":
    case "b":
      return "letter"
    case HELLO:
      return "greeting"
    default:
      return "other"
  }
}

export const main = (): void => {
  console.log(kind("b"))
  console.log(kind("hello"))
  console.log(kind("zz"))
}
```

That prints `letter`, `greeting` and `other`. A label is a string literal or a
module constant of type `string`, since a label is compared without being run;
a label the compiler would have to run, such as a parameter or a call, is
refused (`NL2799`), and so are two labels with the same text, however each is
spelled (`"\u00e9"` and `"é"` are one label). Fallthrough, `default`,
`break`, `return` and `continue` mean what they mean in Node, and the word is
worked out once, before the first comparison. A `string | null` word is not a
`string`, so its switch gets the strict refusal, which names no feature to
add: check it for `null` first. The compiler compares the
word with each label in turn, so a switch with many cases costs a comparison
per case before the one that matches.

## `for...of` over a string

The strict dialect walks arrays. With `for-of-string`, `for...of` walks a
`string` one character at a time, as Node does: a character outside the
Basic Multilingual Plane, such as an emoji, is one step, not two.

<!-- nish:ok -->
```json package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": ["for-of-string"]
  }
}
```

<!-- nish:ok -->
```ts main.ts
export const main = (): void => {
  let out: string = ""
  for (const c of "né😀") {
    out = `${out}[${c}]`
  }
  console.log(out)
}
```

That prints `[n][é][😀]`. Each character is a new `string`, which lives
until the function around the loop returns (or the loop around it ends a
pass), so keeping one after the loop is safe; a walk of a long string holds
one small string per character until then. `break`, `continue` and labels
work as they do over an array. A destructuring head, `for (const [c] of s)`,
stays refused, and so does a walk of a `string | null`, with the strict
refusal: check it for `null` first.

A string that is not valid UTF-8, such as one built with
`String.fromCharCode(200)`, is walked byte by byte where its bytes do not
form a character: a byte that starts a character but is not followed by the
bytes that finish it is one step on its own, and the next byte gets its own
step. So `String.fromCharCode(200) + "abc"` takes four steps, as it does in
Node, although the first step's bytes are nish's, not Node's.

## Optional parameters and defaults that run

The strict dialect asks for a default on every parameter a call may leave
out, and takes only a constant for it. With `optional-params`, a parameter
may be written `x?: T`, and a top-level function's default may be any
expression, run as Node runs it.

<!-- nish:ok -->
```json package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": ["optional-params"]
  }
}
```

<!-- nish:ok -->
```ts main.ts
const fallback = (): number => {
  console.log("fallback ran")
  return 10
}

function greet(name: string, greeting?: string): string {
  return `${greeting ?? "hello"}, ${name}`
}

function area(width: number, height: number = fallback(), scale: number = width + height): number {
  return width * height * scale
}

export const main = (): void => {
  console.log(greet("ada"))
  console.log(greet("ada", "hi"))
  console.log(area(2))
  console.log(area(2, 3))
}
```

That prints `hello, ada`, `hi, ada`, `fallback ran`, `240` and `30`: a
default runs once for each call that leaves its argument out, after the
arguments it got, and never for a call that writes the argument.

An `x?` parameter is read only as the left side of `??`, as in
`greeting ?? "hello"`. A call that leaves it out gives `undefined` in Node and
`null` here, and `??` is the one read that treats the two alike; anything
else, `greeting.length` or `return greeting`, is refused (`NL2803`). An `x?`
must be of a type that has `null` to stand for the missing argument, such as
a `string` or a class; `factor?: number` is refused (`NL2804`), so give it a
default, `factor: number = 1`, instead. A default on a method or a
constructor is still a constant.

A default that runs is taken only on a function every call to which the
module can see: one that is not exported and not overloaded, with a default
on every parameter from the first such default to the last. An exported
function, an overloaded one, or one with a required parameter between two
such defaults keeps the strict refusal, and its message says which rule it
missed. Write the default as a constant there, or move the computation into
the body: `xs: number[] | null = null` and `const list = xs ?? fresh()`.

## Overload signatures

With `overloads`, a function, a method or a constructor may be written as
bodiless signatures followed by its implementation, as TypeScript reads them:

<!-- nish:ok -->
```json package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": ["overloads"]
  }
}
```

<!-- nish:ok -->
```ts main.ts
function area(side: number): number
function area(width: number, height: number): number
function area(width: number, height: number = -1): number {
  return height < 0 ? width * width : width * height
}

export const main = (): void => {
  console.log(`${area(3)} ${area(2, 5)}`)
}
```

That prints `9 10`. The compiled program is the implementation alone; the
signatures decide which calls are allowed. Each signature must be one the
implementation can stand behind, with exactly the same return type (`tsc`
also allows a narrower one), or it is refused (`NL2800`). A call is held to the signatures, not to the
implementation, so a call that no signature takes is refused (`NL2801`)
even when the implementation would run it, as `tsc` refuses it. A call
through a function value is held to the implementation only. A function
with signatures cannot be exported to C or Node with `--emit-header`,
`--emit-napi` or `--emit-dts` (`NL2802`): export one function per signature
instead.

## Dependencies follow the root package

A program is compiled in one dialect: the one its root package asks for, the
package whose `package.json` is nearest above the file you compile. A
dependency cannot widen it. If a package in `node_modules` asks for
`"compat"` and yours does not, the import is refused (`NL3057`):

```log
main.ts:3:23: error: Package `pkg_loose` asks for the compatibility dialect, which the root package's `compat` does not allow: a program is compiled in its root package's dialect, so `pkg_loose` cannot be part of this one until the root's `package.json` allows it in `nish.compat` (or the build passes `--compat`)
```

Add `"compat"` to your own `package.json`, or pass `--compat`, and it
compiles. A strict dependency inside a compat program needs nothing: it is
compiled in the program's dialect like every other module, so its bare
`number` is a double there too.

## What a compat build tells you

Every module a compat build writes ends with a mark that names the dialect,
the number mode and the features:

```llvm
!nish.compat = !{!0}
!0 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}
```

A strict build has no such line, so you can tell from a `.ll` file which
dialect its source was written in. `--emit-checked` opens with the same facts
(`compat number=f64 features=[nullish,optional-chaining,string-switch,for-of-string,optional-params,overloads]`).

## What it does not change

- A build that does not ask for the dialect compiles every program it
  accepted before to the same IR, byte for byte.
- A program the strict dialect accepts compiles under the dialect to the
  program `--number-mode f64` compiles. It is not slower, and nothing is
  checked more loosely.
- A feature accepts programs the strict dialect refuses, and runs them as
  Node does. It never changes what a program means when the strict dialect
  accepts it.
