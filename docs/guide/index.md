# Nish

<div data-nish-hero></div>

Nish compiles a strict, static subset of TypeScript ahead of time to native
code. You write `.ts` files with the syntax you already know; the compiler
checks that every value has one fixed type and layout, turns the program into
LLVM IR, and LLVM turns that into a small executable for x86_64, ARM64 or
WebAssembly. There is no interpreter, no garbage collector and nothing to ship
beside the binary.

> [!CAUTION]
> **Nish is pre-alpha. Do not use it in production.** It is an early
> experiment, not a tool to build on yet: expect miscompilations, crashes,
> missing features and confusing diagnostics. Until 1.0 the language, the
> command-line flags and the output all change without notice, often between
> one minor release and the next. If you try it, pin an exact version and read
> the [changelog](../../CHANGELOG.md) before you upgrade.

## Why Nish

<scalar-grid cols="3">

<scalar-card title="The TypeScript you know" icon="phosphor/regular/file-ts">

Arrow functions, classes, interfaces, discriminated unions, generics and
modules, in `.ts` files your editor already understands.

</scalar-card>

<scalar-card title="One binary, nothing beside it" icon="phosphor/regular/cube">

LLVM builds a small executable for x86_64, ARM64 or WebAssembly. No runtime
to install, no interpreter, no JIT warming up.

</scalar-card>

<scalar-card title="No garbage collector" icon="phosphor/regular/memory">

The compiler decides where every value lives and when its memory is reused,
so nothing pauses the program to scan for garbage.

</scalar-card>

<scalar-card title="Errors you can act on" icon="phosphor/regular/chat-circle-text">

What only makes sense at run time — `any`, exceptions, prototypes — is a
compile error with a stable code and a message saying what to write instead.

</scalar-card>

<scalar-card title="Checked by default" icon="phosphor/regular/shield-check">

Integers have fixed widths, and arithmetic that overflows stops the program
with a message rather than wrapping round.

</scalar-card>

<scalar-card title="A way back out" icon="phosphor/regular/arrow-u-up-left">

A Nish module is still TypeScript: the `nish` package runs it in Node or a
browser, and a native build can be called from Node, WebAssembly or C.

</scalar-card>

</scalar-grid>

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

## Explore the docs

<scalar-grid cols="2">

<scalar-card title="Getting started" icon="phosphor/regular/rocket-launch" href="getting-started/installation.md">

Install Nish, build and run a first program, and see what changes coming from
TypeScript.

</scalar-card>

<scalar-card title="The language" icon="phosphor/regular/code" href="language/types.md">

Types, functions, unions, errors and `Result`, generics, modules, memory and
the rest of what a program is written in.

</scalar-card>

<scalar-card title="Using Nish" icon="phosphor/regular/terminal-window" href="using-nish/cli.md">

The command line, the standard library, threads, networking, databases, the
sandbox and going back to TypeScript.

</scalar-card>

<scalar-card title="Reference" icon="phosphor/regular/book-open" href="../reference/index.md">

Every module and builtin of the library, the compiler's flags and diagnostics,
and the language specification.

</scalar-card>

</scalar-grid>

## Every page

- **Getting started** — [install Nish](getting-started/installation.md),
  [build and run a first program](getting-started/first-program.md), and see
  [what changes coming from TypeScript](getting-started/from-typescript.md).
- **The language** — [types](language/types.md),
  [functions](language/functions.md), [control flow](language/control-flow.md),
  [arrays and strings](language/arrays-and-strings.md),
  [classes and interfaces](language/classes-and-interfaces.md),
  [discriminated unions](language/unions.md),
  [errors and `Result`](language/errors.md),
  [maps and sets](language/maps-and-sets.md), [generics](language/generics.md),
  [modules](language/modules.md), [memory](language/memory.md),
  [regions](language/regions.md), [vectors (SIMD)](language/simd.md) and
  [async functions](language/async.md).
- **Using Nish** — [the command-line interface](using-nish/cli.md),
  [the standard library](using-nish/standard-library.md),
  [calling Nish from other languages](using-nish/interop.md),
  [threads](using-nish/threads.md),
  [shared memory between processes](using-nish/shared-memory.md),
  [SQLite](using-nish/sqlite.md),
  [terminal programs](using-nish/terminal.md),
  [the sandbox](using-nish/sandbox.md),
  [compression](using-nish/compression.md) and
  [going back to TypeScript](using-nish/to-typescript.md).
- **Networking** — [sockets](using-nish/networking.md),
  [Unix sockets](using-nish/unix-sockets.md),
  [verifying TLS certificates](using-nish/tls-certificates.md),
  [the TLS client](using-nish/tls-client.md),
  [HTTP routing](using-nish/http-router.md),
  [an API server](using-nish/api-server.md),
  [an async server](using-nish/async-server.md),
  [WebSocket](using-nish/websocket.md),
  [the HTTP client](using-nish/http-client.md),
  [calling other services](using-nish/calling-services.md),
  [PostgreSQL](using-nish/postgres.md),
  [password hashing](using-nish/password-hashing.md) and
  [authentication tokens (JWT)](using-nish/auth.md).

This guide teaches; it is not the definition of the language. That is the
[language reference](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md), and each page here links the section of
it that governs what the page describes. Where the two disagree, the reference
is right and the guide has a bug.
