<div align="center">

# Nish

**Native Instruction Static Host AKA Turbo Typescript. A fast subset of typescript without the encumbrance of javascript.**

**An ahead-of-time compiler for a strictly static subset of TypeScript — LLVM IR in the middle, native binaries at the end. No interpreter, no garbage collector, nothing to ship beside the executable.**

![status](https://img.shields.io/badge/status-pre--alpha-ef4444?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-static%20subset-3178c6?style=flat-square&logo=typescript&logoColor=white)
![LLVM](https://img.shields.io/badge/LLVM-18-4b5563?style=flat-square&logo=llvm&logoColor=white)
![WebAssembly](https://img.shields.io/badge/wasm-wasm32%20%C2%B7%20wasi-654ff0?style=flat-square&logo=webassembly&logoColor=white)
![vibe coded](https://img.shields.io/badge/vibe-coded-a855f7?style=flat-square)

</div>

---

You write `.ts` files with the syntax you already know. Nish checks that every
value has one fixed type and memory layout, refuses everything dynamic
(`any`, prototypes, `eval`, exceptions), and emits LLVM IR that `clang` turns
into a small native binary for x86_64, ARM64 or WebAssembly. The compiler is
itself written in Nish.

```
TypeScript source ──▶ lexer + parser ──▶ validator + checker ──▶ LLVM IR (.ll) ──▶ clang ──▶ native binary
```

> [!CAUTION]
> **Nish is pre-alpha. Do not use it in production.** Expect
> miscompilations, crashes, missing features and confusing diagnostics. Until
> 1.0 the language, the flags and the output change without notice, often
> between minor releases: pin an exact version and read the
> [changelog](CHANGELOG.md) before you upgrade. The code, cryptography
> included, has had no independent review ([security records](docs/security/README.md)).

## A taste

```bash
curl -fsSL https://raw.githubusercontent.com/amritk/nish/main/install.sh | sh
```

`hello.ts`:

```ts
export const main = (): i32 => {
  console.log("hello from Nish");
  return 0;                     // the process exit code
};
```

```bash
nish run hello.ts               # build into a cache and run it
nish hello.ts --link hello      # a native binary, about 4.7 KB
nish hello.ts -o hello.ll       # just the LLVM IR
```

A short program can skip `main` and read like a script:

```ts
const square = (n: i32): i32 => n * n

const sides = [3, 4, 5]
for (const side of sides) {
  console.log(square(side))
}
```

The IR is readable. `examples/add.ts`, `a + b` on two `number`s (32-bit
integers by default), compiles to a checked add: an overflow panics instead
of wrapping, and a sum the compiler proves fits is a plain `add nsw`.

```llvm
define noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}
```

Next step: [Your first program](docs/guide/getting-started/first-program.md).

## Contents

- [Install](#install)
- [The language](#the-language)
- [Memory without a garbage collector](#memory-without-a-garbage-collector)
- [The standard library](#the-standard-library)
- [Threads and async](#threads-and-async)
- [The command line](#the-command-line)
- [Performance and binary size](#performance-and-binary-size)
- [Interop](#interop)
- [The compiler in a browser](#the-compiler-in-a-browser)
- [Documentation](#documentation)
- [Project status](#project-status)
- [Contributing, security and license](#contributing-security-and-license)

## Install

The install script needs only `sh`, `curl` and `tar`, and puts the prebuilt
compiler in `~/.nish`. With Node.js 22.18+ there is also npm:

```bash
npm install -g nish
```

Linking binaries needs clang (LLVM 18) and lld. Per-OS commands, the supported
platforms and building from source are in
[Installation](docs/guide/getting-started/installation.md).

## The language

The TypeScript you know, held to one rule: every value's type and layout is
known at compile time.

- **Types:** `number`, fixed-width integers (`i32`, `u8`, `i64`, ...), ranged
  `integer<Lo, Hi>`, `f64`, `boolean`, `string`, arrays, `Map` and `Set`,
  classes, interfaces, enums, discriminated unions and `T | null`.
- **Code:** arrow functions, generics by monomorphisation, modules and
  packages, `for...of`, exhaustive `switch`, `async`/`await`.
- **Errors:** `Result<T, E>` with `orReturn()` (Rust's `?`), and `panic` for
  what a caller should not handle. No `throw`, no unwinding.
- **Refused, with the idiom to use instead:** `any`, `unknown`, `var`, `==`,
  `try`, `typeof`, `instanceof`, prototypes, closures stored as values.

Some answers differ from JavaScript on purpose: signed overflow and integer
division by zero panic, and `.length` counts UTF-8 bytes.

Start with [Coming from TypeScript](docs/guide/getting-started/from-typescript.md),
then the language pages: [types](docs/guide/language/types.md),
[functions](docs/guide/language/functions.md),
[classes and interfaces](docs/guide/language/classes-and-interfaces.md),
[unions](docs/guide/language/unions.md),
[generics](docs/guide/language/generics.md),
[errors](docs/guide/language/errors.md) and
[modules](docs/guide/language/modules.md). The normative rules are in the
[language reference](docs/LANGUAGE.md); writing Nish with an AI, start from
[docs/AI.md](docs/AI.md) and [llms.txt](llms.txt).

## Memory without a garbage collector

There is no GC and no `free`, so use-after-free and double free cannot be
written. The compiler places each value: on the stack when it provably dies
with its function, in an arena scope the compiler opens and releases for you,
or in a region you free in a long-running program. Array indexes are
bounds-checked unless a proof shows they are in range, `null` is a separate
type that must be narrowed, and the only ways around a check are imports you
ask for by name (`nish:unsafe`).

Read [Memory](docs/guide/language/memory.md) and
[Regions](docs/guide/language/regions.md).

## The standard library

[`std/`](std/README.md) is Nish written in Nish, compiled with your program,
so what you never call is dropped at the link:

- **Data and text:** JSON, YAML, regular expressions with linear-time search,
  base64, bytes, text helpers, sorting and collections.
- **Programs:** a test runner, argument parsing, terminal I/O, SQLite, a
  seeded random generator.
- **Crypto:** SHA-1/2, HMAC, HKDF, PBKDF2, ChaCha20-Poly1305, AES-GCM, X25519,
  Ed25519, P-256 and P-384 ECDSA, RSA, bcrypt and X.509, with keys held as a
  wiped `Secret<T>`.
- **Network:** TLS 1.3, HTTP/1.1, HTTP/2, HTTP/3 and QUIC, WebSocket,
  WebTransport, an HTTP router and client, DNS and PostgreSQL.

```ts
import { Suite } from "nish/testing";

const sumOf = (xs: i32[]): i32 => {
  let total = 0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
};

export const main = (): i32 => {
  const t = new Suite("sums");
  t.eqI32("four numbers", sumOf([3, 9, 4, 9]), 25);
  return t.done();          // prints the report; 0 when nothing failed
};
```

Tour it in [The standard library](docs/guide/using-nish/standard-library.md);
there are guide pages for an [API server](docs/guide/using-nish/api-server.md),
an [HTTP client](docs/guide/using-nish/http-client.md),
[PostgreSQL](docs/guide/using-nish/postgres.md),
[SQLite](docs/guide/using-nish/sqlite.md),
[password hashing](docs/guide/using-nish/password-hashing.md) and
[more](docs/guide/index.md).

## Threads and async

`nish/threads` gives parallel maps and reduces, scoped tasks, a `Mutex` that
owns its data, atomics and channels, with data races and deadlocks refused at
compile time. `async` functions compile to a frame and a resume switch, with
no promise ever a value.

Read [Threads](docs/guide/using-nish/threads.md),
[Async](docs/guide/language/async.md) and
[An async server](docs/guide/using-nish/async-server.md).

## The command line

```
nish <file.ts> [more.ts ...] [flags]    compile to LLVM IR (--link for a binary)
nish run [flags] <file.ts> [args ...]   build, cache and run it
nish --help                              every flag, the exit codes, examples
```

Errors arrive all at once as `file:line:col` with a caret, or as JSON with a
stable code for editors. `--fix` applies safe fixes, `--allow`/`--deny` refuse
a program that reaches more capabilities (files, network, processes) than you
grant, and `--emit-ts` writes the program back out as plain TypeScript.

Read [The CLI](docs/guide/using-nish/cli.md) and
[Sandboxing](docs/guide/using-nish/sandbox.md).

## Performance and binary size

No GC, no embedded engine, and every LLVM attribute the compiler emits is a
proved guarantee. `hello.ts` links to about 4.7 KB; a freestanding wasm
module can be a few hundred bytes. The benchmark suite runs the same
algorithms in Nish, C and Rust and records wall time, size and memory in
[docs/BENCHMARKS.md](docs/BENCHMARKS.md).

## Interop

Nish never embeds a JavaScript engine; JavaScript calls Nish. A program
builds to a wasm module or a Node addon with generated `.d.ts` types, the
addon borrows typed arrays without a copy, and `--emit-header` writes C
prototypes for a C host. Read [Calling Nish from other languages](docs/guide/using-nish/interop.md)
and [Browser games](docs/guide/using-nish/browser-games.md).

## The compiler in a browser

The compiler compiles itself to WebAssembly, about 140 KB gzipped, and checks
and emits IR in a Web Worker with no server. [web/README.md](web/README.md)
has the playground.

## Documentation

| Read | For |
|:---|:---|
| [The user guide](docs/guide/index.md) | Learning Nish page by page, every example compiled by the test suite |
| [Installation](docs/guide/getting-started/installation.md) | Platforms, LLVM, WASI, building from source |
| [Language reference](docs/LANGUAGE.md) | Every rule, each citing the test that proves it |
| [docs/AI.md](docs/AI.md), [llms.txt](llms.txt) | The whole language in one pass, for people and models writing it |
| [`std/` README](std/README.md) | Every standard library module |
| [FAQ](docs/FAQ.md) | Why the design is the way it is |
| [IR cookbook](docs/IR_COOKBOOK.md) | The exact IR of every construct |
| [Roadmap](docs/roadmap/index.md) | What is built and what is next |
| [Changelog](CHANGELOG.md) | What changed in each release |

## Project status

Pre-alpha and on 0.x, with no compatibility promise: a construct's spelling,
a flag's name and the IR either lowers to can change between minor releases.
Every commit compiles, tests and rebuilds the compiler with itself. The
[roadmap](docs/roadmap/index.md) has what is built and what is next.

## Contributing, security and license

- **Contributing:** building the compiler, the tests and the conventions are in
  [CONTRIBUTING.md](CONTRIBUTING.md).
- **Security:** report a vulnerability privately through GitHub's **Security →
  Report a vulnerability**, never in a public issue; see
  [SECURITY.md](SECURITY.md). The audit records are in
  [docs/security/](docs/security/README.md).
- **License:** MIT, see [LICENSE](LICENSE). Third-party code keeps its own
  licence; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
