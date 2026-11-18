# The compatibility dialect

Nish compiles a strict subset of TypeScript. The compatibility dialect is the
second way to build a program: it accepts more of TypeScript, one feature at
a time, for code that was written for Node and is being moved over. You ask
for it by name, a build that does not ask is unchanged, and the compiled
program says which one it was built in.

The dialect changes the number a bare `number` is, and it has two features:
`optional-chaining` and `nullish`. Each admits a form of TypeScript the strict
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

```text
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

```text
package.json:5:16: error: `asnyc` is no feature of the compatibility dialect: `nish.compat` is `true` or an array of feature names, and the ones this compiler has built are `nullish`, `optional-chaining`
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
costs, as a performance warning (`NL9020`), because arithmetic that leaves 32
bits panics there where a double would carry on. `--no-warn-performance`
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

Two forms stay refused in both dialects, because Node's answer and the
compiled program's would part. `?.[i]` cannot end a chain (`NL1067`): past the
end of the array Node answers `undefined`, where Nish's bounds check panics.
Test the index against `length` instead. And an optional call `f?.()` is
refused (`NL1068`): narrow `f` with `!== null` and call it.

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

The default must still have the type of the left side, as TypeScript asks
(`NL2370`). A `??` on a value that may be `null` is the strict dialect's own,
and means the same in both.

## Dependencies follow the root package

A program is compiled in one dialect: the one its root package asks for, the
package whose `package.json` is nearest above the file you compile. A
dependency cannot widen it. If a package in `node_modules` asks for
`"compat"` and yours does not, the import is refused (`NL3057`):

```text
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
!0 = !{!"f64", !"nullish", !"optional-chaining"}
```

A strict build has no such line, so you can tell from a `.ll` file which
dialect its source was written in. `--emit-checked` opens with the same facts
(`compat number=f64 features=[nullish,optional-chaining]`).

## What it does not change

- A build that does not ask for the dialect is the same build it was, byte
  for byte.
- A program the strict dialect accepts compiles under the dialect to the
  program `--number-mode f64` compiles. It is not slower, and nothing is
  checked more loosely.
- A feature accepts programs the strict dialect refuses, and runs them as
  Node does. It never changes what a program means when the strict dialect
  accepts it.
