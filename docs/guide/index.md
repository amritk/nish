# Introduction

Nish compiles a strict, static subset of TypeScript ahead of time to native
code. You write `.ts` files with the syntax you already know; the compiler
checks that every value has one fixed type and layout, turns the program into
LLVM IR, and LLVM turns that into a small executable for x86_64, ARM64 or
WebAssembly. There is no interpreter, no garbage collector and nothing to ship
beside the binary. What makes that possible is what Nish leaves out: `any`,
exceptions, prototypes and the other parts of TypeScript that only make sense
at run time are compile errors, each with a stable code and a message saying
what to write instead.

> [!CAUTION]
> **Nish is pre-alpha. Do not use it in production.** It is an early
> experiment, not a tool to build on yet: expect miscompilations, crashes,
> missing features and confusing diagnostics. Until 1.0 the language, the
> command-line flags and the output all change without notice, often between
> one minor release and the next. If you try it, pin an exact version and read
> the [changelog](../../CHANGELOG.md) before you upgrade.

## A first look

```ts nish:ok
const sumOfSquares = (limit: i32): i32 => {
  let total = 0;
  for (let i = 1; i <= limit; i++) {
    total = total + i * i;
  }
  return total;
};

export const main = (): i32 => {
  console.log(`1² + … + 10² = ${sumOfSquares(10)}`);
  return 0;
};
```

`i32` is a 32-bit integer, `export const main` is where the program starts and
its return value is the exit status, and `total + i * i` is checked: if it
overflowed, the program would stop with a message rather than wrap round.
Save it as `squares.ts` and `nish run squares.ts` prints `1² + … + 10² = 385`.

## How this guide is laid out

- **Getting started** — [install Nish](getting-started/installation.md),
  [build and run a first program](getting-started/first-program.md), and see
  [what changes coming from TypeScript](getting-started/from-typescript.md).
- **The language** — [types](language/types.md),
  [functions](language/functions.md), [control flow](language/control-flow.md),
  [arrays and strings](language/arrays-and-strings.md),
  [classes and interfaces](language/classes-and-interfaces.md),
  [errors and `Result`](language/errors.md),
  [maps and sets](language/maps-and-sets.md), [generics](language/generics.md),
  [modules](language/modules.md) and [memory](language/memory.md).
- **Using Nish** — [the command-line interface](using-nish/cli.md),
  [the standard library](using-nish/standard-library.md),
  [calling Nish from other languages](using-nish/interop.md) and
  [threads](using-nish/threads.md).

This guide teaches; it is not the definition of the language. That is the
[language reference](../LANGUAGE.md), and each page here links the section of
it that governs what the page describes. Where the two disagree, the reference
is right and the guide has a bug.
