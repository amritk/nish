# The compatibility dialect

Nish compiles a strict subset of TypeScript. The compatibility dialect is the
second way to build a program: it will accept more of TypeScript, one feature
at a time, for code that was written for Node and is being moved over. You ask
for it by name, a build that does not ask is unchanged, and the compiled
program says which one it was built in.

**No feature is built yet.** Today the dialect changes one thing, the number a
bare `number` is. The flag, the `package.json` key and the rules below are in
place so that each feature arrives without changing how you ask for it.

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

```json nish:ok file=package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": true
  }
}
```

```ts nish:ok file=main.ts
const half = (n: number): number => n / 2

export const main = (): void => {
  console.log(half(7))
}
```

That prints `3.5`. In the strict dialect a bare `number` is a 32-bit integer
and the same program prints `3`.

`"compat"` is `true` for every feature this compiler has, or an array naming
the ones you want. `[]` is the dialect with no feature, which is what `true`
means today. `--compat=<feature>,...` is the array on the command line.

## A name that is no feature

A name that is no feature is refused, on the command line (exit 2) and in
`package.json` (`NL3056`), so a typo cannot quietly leave a feature off:

```json nish:ok file=package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": ["asnyc"]
  }
}
```

```ts nish:err NL3056 file=main.ts
export const main = (): void => {
  console.log(1)
}
```

```text
package.json:5:16: error: `asnyc` is no feature of the compatibility dialect: `nish.compat` is `true` or an array of feature names, and this compiler has built none yet
```

## Numbers are doubles

The dialect implies [`--number-mode f64`](cli.md): a bare `number` is a 64-bit
float, as it is in Node. Everything `--number-mode f64` means holds, its
errors included. The one you are most likely to meet is `main`'s return type:
the exit code is a 32-bit integer, so a `main` that returns a bare `number` is
refused.

```json nish:ok file=package.json
{
  "name": "ported",
  "private": true,
  "nish": {
    "compat": true
  }
}
```

```ts nish:err NL2140 file=main.ts
export const main = (): number => {
  return 0
}
```

Write `main(): i32` or `main(): void` instead. Types that spell their width
(`i32`, `f64`, `u8`) mean the same in both dialects.

A program whose arithmetic was written for 32-bit integers can keep them:
`--compat --number-mode i32` is honoured. The compiler says once what that
costs, as a performance warning (`NL9018`), because arithmetic that leaves 32
bits panics there where a double would carry on. `--no-warn-performance`
silences it.

```text
app.ts:1:1: performance: `--number-mode i32` beside the compatibility dialect: a bare `number` is the 32-bit integer and not the double a JavaScript engine computes with, so arithmetic that leaves 32 bits panics here where it would carry on there; drop `--number-mode i32` for the dialect's own f64
```

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
!0 = !{!"f64"}
```

A strict build has no such line, so you can tell from a `.ll` file which
dialect its source was written in. `--emit-checked` opens with the same facts
(`compat number=f64 features=[]`).

## What it does not change

- A build that does not ask for the dialect is the same build it was, byte
  for byte.
- A program the dialect compiles is the program `--number-mode f64` compiles.
  It is not slower, and nothing is checked more loosely.
- Each later feature may accept a program the strict dialect refuses. It will
  not change what a program means when the strict dialect accepts it.
