# Nish

<div data-nish-hero class="nish-hero"><div class="nish-hero__inner"><div class="nish-hero__aurora" aria-hidden="true"></div><p class="nish-hero__name" role="img" aria-label="Nish: Native Instruction Static Host" tabindex="0"><span class="nish-hero__name-row" aria-hidden="true"><span class="nish-hero__word" style="--i:0"><b>N</b><span class="nish-hero__rest"><span>ative</span></span></span><span class="nish-hero__word" style="--i:1"><b>I</b><span class="nish-hero__rest"><span>nstruction</span></span></span><span class="nish-hero__word" style="--i:2"><b>S</b><span class="nish-hero__rest"><span>tatic</span></span></span><span class="nish-hero__word" style="--i:3"><b>H</b><span class="nish-hero__rest"><span>ost</span></span></span></span><span class="nish-hero__name-row nish-hero__name-row--ghost" aria-hidden="true"><span class="nish-hero__word" style="--i:0"><b>N</b><span class="nish-hero__rest"><span>ative</span></span></span><span class="nish-hero__word" style="--i:1"><b>I</b><span class="nish-hero__rest"><span>nstruction</span></span></span><span class="nish-hero__word" style="--i:2"><b>S</b><span class="nish-hero__rest"><span>tatic</span></span></span><span class="nish-hero__word" style="--i:3"><b>H</b><span class="nish-hero__rest"><span>ost</span></span></span></span></p><p class="nish-hero__title">TypeScript in. <span class="nish-hero__accent">Native code out.</span></p><div class="nish-hero__actions"><a class="nish-hero__cta" href="/getting-started/installation">Get started<span aria-hidden="true">→</span></a><button class="nish-hero__install" type="button" title="Copy the install command"><span class="nish-hero__prompt" aria-hidden="true">$</span><code>curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh</code><span class="nish-hero__copied" aria-live="polite"></span></button></div><div class="nish-hero__stage"><div class="nish-hero__window nish-hero__editor" aria-hidden="true"><div class="nish-hero__bar"><i></i><i></i><i></i><span>squares.ts</span></div><pre class="nish-hero__code"><span class="nish-hero__line" style="--i:0"><span class="nish-tok-k">const</span> sumOfSquares = (limit: <span class="nish-tok-t">i32</span>): <span class="nish-tok-t">i32</span> =&gt; {</span><span class="nish-hero__line" style="--i:1">  <span class="nish-tok-k">let</span> total = <span class="nish-tok-n">0</span>;</span><span class="nish-hero__line" style="--i:2">  <span class="nish-tok-k">for</span> (<span class="nish-tok-k">let</span> i = <span class="nish-tok-n">1</span>; i &lt;= limit; i++) {</span><span class="nish-hero__line" style="--i:3">    total = total + i * i;</span><span class="nish-hero__line" style="--i:4">  }</span><span class="nish-hero__line" style="--i:5">  <span class="nish-tok-k">return</span> total;</span><span class="nish-hero__line" style="--i:6">};</span></pre></div><div class="nish-hero__flow" aria-hidden="true"><svg class="nish-hero__beams" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><path class="nish-hero__rail" d="M0 100 H120" vector-effect="non-scaling-stroke"></path><path class="nish-hero__pulse nish-hero__pulse--in" d="M0 100 H120" pathLength="100" style="--i:0" vector-effect="non-scaling-stroke"></path><path class="nish-hero__rail" d="M180 100 C230 100 240 34 300 34" vector-effect="non-scaling-stroke"></path><path class="nish-hero__pulse nish-hero__pulse--out" d="M180 100 C230 100 240 34 300 34" pathLength="100" style="--i:0" vector-effect="non-scaling-stroke"></path><path class="nish-hero__rail" d="M180 100 H300" vector-effect="non-scaling-stroke"></path><path class="nish-hero__pulse nish-hero__pulse--out" d="M180 100 H300" pathLength="100" style="--i:1" vector-effect="non-scaling-stroke"></path><path class="nish-hero__rail" d="M180 100 C230 100 240 166 300 166" vector-effect="non-scaling-stroke"></path><path class="nish-hero__pulse nish-hero__pulse--out" d="M180 100 C230 100 240 166 300 166" pathLength="100" style="--i:2" vector-effect="non-scaling-stroke"></path></svg><div class="nish-hero__core"><span class="nish-hero__ring"></span><img src="/mark.svg" alt="" width="52" height="52"></div><div class="nish-hero__targets"><span class="nish-hero__target" style="--i:0">x86_64</span><span class="nish-hero__target" style="--i:1">ARM64</span><span class="nish-hero__target" style="--i:2">WebAssembly</span></div></div><div class="nish-hero__window nish-hero__terminal"><div class="nish-hero__bar" aria-hidden="true"><i></i><i></i><i></i><span>terminal</span></div><pre class="nish-hero__code" aria-hidden="true"><span class="nish-hero__cmd"><b>$ </b><span class="nish-hero__typed">nish run squares.ts</span></span><span class="nish-hero__out">1² + … + 10² = 385</span><span class="nish-hero__ready"><b>$ </b><i></i></span></pre><input class="nish-hero__input" aria-label="Terminal" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"></div></div></div></div>

**Write TypeScript, ship a fast native binary.** Nish — **N**ative
**I**nstruction **S**tatic **H**ost — compiles a strict, static subset of
TypeScript ahead of time, through LLVM, to a small executable for x86_64,
ARM64 or WebAssembly. There is no interpreter, no JIT and no garbage
collector, and nothing to ship beside the binary. In the recorded
[benchmark run](../BENCHMARKS.md), Nish is faster than Go on all seven programs
and at most 2% slower than Rust `-O3` on six of them.

You write `.ts` files with the syntax you already know; the compiler checks
that every value has one fixed type and layout, so it can lay data out and
generate code the way a C compiler would.

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

Integers have fixed widths. A build is refused where the compiler cannot
prove an index in range or a sum in its width; `--allow-panics` checks those
while the program runs, and stops it with a message rather than wrapping
round.

</scalar-card>

<scalar-card title="A way back out" icon="phosphor/regular/arrow-u-up-left">

A Nish module is still TypeScript: the `nish` package runs it in Node or a
browser, and a native build can be called from Node, WebAssembly or C.

</scalar-card>

</scalar-grid>

## A first look

<!-- nish:ok -->
```ts
const sumOfSquares = (limit: i32): i32 => {
  let total = 0;
  for (let i = 1; i <= limit; i++) {
    if (i > 1000 || total > 1000000000) {
      return -1;
    }
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
its return value is the exit status. The test at the top of the loop is what
lets the compiler prove `total + i * i` fits an `i32`: past it, `i * i` is at
most a million and `total` at most a billion. By default the compiler refuses
a program that could panic, such as arithmetic it cannot prove fits, and the
error names the guard that would prove it; `--allow-panics` builds such a
program with the check made while it runs instead, stopping it with a message
rather than wrapping round. Save it as `squares.ts` and `nish run squares.ts`
prints `1² + … + 10² = 385`.

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
  [destructuring](language/destructuring.md),
  [discriminated unions](language/unions.md),
  [errors and `Result`](language/errors.md),
  [maps and sets](language/maps-and-sets.md), [generics](language/generics.md),
  [modules](language/modules.md), [memory](language/memory.md),
  [function references](language/function-references.md),
  [regions](language/regions.md), [compact classes](language/compact-classes.md),
  [vectors (SIMD)](language/simd.md) and
  [async functions](language/async.md).
- **Using Nish** — [the command-line interface](using-nish/cli.md),
  [the compatibility dialect](using-nish/compat.md),
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
  [one server for HTTP/1.1, 2 and 3](using-nish/http-server.md),
  [WebSocket](using-nish/websocket.md),
  [the HTTP client](using-nish/http-client.md),
  [calling other services](using-nish/calling-services.md),
  [PostgreSQL](using-nish/postgres.md),
  [password hashing](using-nish/password-hashing.md),
  [authentication tokens (JWT)](using-nish/auth.md) and
  [tokens from an OpenID Connect issuer](using-nish/oidc.md).

This guide teaches; it is not the definition of the language. That is the
[language reference](../reference/language.md), and each page here links the section of
it that governs what the page describes. Where the two disagree, the reference
is right and the guide has a bug.
