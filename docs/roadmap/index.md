# Roadmap

What Nish has built and what is left, with one page per work package. A
checked box is built and on `main`; an unchecked one is not. An item marked
*(open question)* waits on a decision that has not been made, and one marked
*(deferred)* is wanted but not scheduled. Each package's design and its
reasons are in its design note on GitHub, linked from its page; the state is
kept here, and a pull request that lands a stage ticks its box.

## Milestones

- [x] M1, programs: fib, gcd and a string CLI build with `nish --link`, under 20 KB
- [x] M2, data: nbody with structs and arrays matches C's output bit for bit
- [x] M3, Rust parity: the benchmark table within 10% of Rust, wasm and N-API demos
- [x] M5, self-hosting: `src/` compiles `src/`, and stage3 is byte-identical to stage2
- [x] M6, one compiler: stage0 deleted rather than frozen, first released in 0.7.0
- [ ] M4, 1.0: a frozen language reference *(open question)*. Nish stays on 0.x, and a breaking change moves the minor, until 1.0

## Up next

In order. Each package's page says what its next stage is and where it is
specified.

1. [WP49: `async`/`await` on the server, and the TechEmpower top](wp49-async-server.md): meet stage 6's gate.
2. [WP39: The HTTP server: a TechEmpower entry, then a general-purpose server](wp39-http-server.md): G7's one handler, the `nish/net/http-server` façade.
3. [WP43: The HTTP application layer](wp43-http-app-layer.md): stage 3, static files.
4. [WP21: Packages](wp21-packages.md): S4, the build cache.

## Open questions

- M4: when to declare 1.0.
- [WP22: Arrow functions as the declaration form](wp22-arrow-functions.md): whether stage D rejects a `function` definition.
- [WP28: Compatibility mode](wp28-compatibility-mode.md): whether to accept compatibility mode, and its open questions. [WP33: The round trip to TypeScript](wp33-round-trip.md)'s R6 is that mode, so it waits here too.
- [WP57: Module-scoped names](wp57-module-scoped-names.md): whether two exported functions of one package may share a name, and what that does to the C surface (S2).
- [WP59: The wasm arena in a second, unexported memory](wp59-wasm-arena-memory.md): how module storage crosses into the hidden memory, how a page that must run in Safari gets a single-memory module, and how large the exchange area is under `--memory` (S3).
- [WP60: Dynamic dispatch over interfaces](wp60-dyn-dispatch.md): whether to build `Dyn<I>`; the design note measures it against the hand-written dispatch and recommends shipping interface method signatures (stage 1) now, with `Dyn<I>` in registers and in stored places each gated on its own build's timing.
- [WP62: Nish classes from a JSON Schema](wp62-json-schema-classes.md): whether its typed JSON prerequisites land as its S1 or in WP61, a reverse generator, `readOnly`/`writeOnly`, unknown and `x-*` keywords, nullable `boolean` and type-discriminated unions, presence flags, field-name style, where the generator lives, and whether `format` is checked by default (S5).
- [WP39: The HTTP server: a TechEmpower entry, then a general-purpose server](wp39-http-server.md) and [WP49: `async`/`await` on the server, and the TechEmpower top](wp49-async-server.md): whether and when to submit to TechEmpower.
- [WP54: `async` on wasm, with the page as the executor](wp54-async-wasm.md): whether to build it, which waits on a program that must run on a Worker, and its other questions.

## In progress and proposed

| Work package | State | Done |
| --- | --- | --- |
| [WP21: Packages](wp21-packages.md) | In progress | 5 of 7 |
| [WP22: Arrow functions as the declaration form](wp22-arrow-functions.md) | In progress | 3 of 5 |
| [WP33: The round trip to TypeScript](wp33-round-trip.md) | In progress | 7 of 9 |
| [WP37: The OS sandbox](wp37-os-sandbox.md) | In progress | 5 of 9 |
| [WP39: The HTTP server: a TechEmpower entry, then a general-purpose server](wp39-http-server.md) | In progress | 22 of 29 |
| [WP43: The HTTP application layer](wp43-http-app-layer.md) | In progress | 3 of 7 |
| [WP49: `async`/`await` on the server, and the TechEmpower top](wp49-async-server.md) | In progress | 4 of 6 |
| [WP51: References to capture-free top-level functions](wp51-function-references.md) | In progress | 3 of 4 |
| [WP28: Compatibility mode](wp28-compatibility-mode.md) | Proposed | 2 of 13 |
| [WP54: `async` on wasm, with the page as the executor](wp54-async-wasm.md) | Proposed | 0 of 4 |
| [WP56: Generators whose memory stays flat: a string builder, and a scope per file](wp56-flat-memory-generators.md) | Proposed | 0 of 6 |
| [WP57: Module-scoped names](wp57-module-scoped-names.md) | Proposed | 0 of 3 |
| [WP59: The wasm arena in a second, unexported memory](wp59-wasm-arena-memory.md) | Proposed | 0 of 4 |
| [WP60: Dynamic dispatch over interfaces](wp60-dyn-dispatch.md) | Proposed | 1 of 5 |
| [WP62: Nish classes from a JSON Schema](wp62-json-schema-classes.md) | Proposed | 0 of 5 |

## Landed

| Work package | State | Done |
| --- | --- | --- |
| [WP0: The Phase 0 validator](wp0-validator.md) | Landed | 1 of 1 |
| [WP1: Control flow](wp1-control-flow.md) | Landed | 1 of 1 |
| [WP2: Classes, interfaces, structs](wp2-classes.md) | Landed | 1 of 1 |
| [WP3: Strings](wp3-strings.md) | Landed | 1 of 1 |
| [WP4: Arrays](wp4-arrays.md) | Landed | 1 of 1 |
| [WP5: Modules, entry point, linkage](wp5-modules.md) | Landed | 1 of 1 |
| [WP6: Memory: escape-analysed stack, arena scopes, `T \| null`](wp6-memory.md) | Landed | 1 of 3 |
| [WP7: Runtime and intrinsics](wp7-runtime.md) | Landed | 1 of 1 |
| [WP8: Interop: wasm, N-API, headers](wp8-interop.md) | Landed | 1 of 1 |
| [WP9: Optimisation and benchmarks](wp9-optimisation.md) | Landed | 1 of 1 |
| [WP10: CI, diagnostics, the code registry](wp10-ci.md) | Landed | 1 of 1 |
| [WP12: Release engineering](wp12-release.md) | Landed | 1 of 1 |
| [WP13: Differential testing against Node](wp13-differential.md) | Landed | 1 of 2 |
| [WP14: Self-hosting](wp14-selfhost.md) | Landed | 1 of 1 |
| [WP15: Performance first](wp15-performance.md) | Landed | 1 of 1 |
| [WP16: `Result<T, E>` and the end of `throw`](wp16-results.md) | Landed | 1 of 1 |
| [WP17: `Result` across the ABI](wp17-result-abi.md) | Landed | 1 of 1 |
| [WP18: Generics by monomorphisation](wp18-generics.md) | Landed | 2 of 6 |
| [WP19: Stage0 retirement](wp19-stage0-retirement.md) | Landed | 1 of 2 |
| [WP20: Threads: the runtime half](wp20-threads.md) | Landed | 1 of 1 |
| [WP23: The language surface a corpus review asked for](wp23-language-surface.md) | Landed | 1 of 1 |
| [WP25: Remove inheritance, widen `implements`](wp25-inheritance.md) | Landed | 1 of 1 |
| [WP26: The standard library](wp26-stdlib.md) | Landed | 1 of 1 |
| [WP27: Calling C](wp27-ffi.md) | Landed | 5 of 5 |
| [WP29: The thread surface](wp29-thread-surface.md) | Landed | 5 of 8 |
| [WP30: Bytes across the interop boundary](wp30-bytes-interop.md) | Landed | 1 of 3 |
| [WP31: Ranged integers](wp31-ranged-integers.md) | Landed | 1 of 4 |
| [WP32: `Map` and `Set`](wp32-map.md) | Landed | 2 of 2 |
| [WP34: The network stack](wp34-network-stack.md) | Landed | 24 of 24 |
| [WP35: The capability report](wp35-capabilities.md) | Landed | 1 of 1 |
| [WP36: The capability policy](wp36-capability-policy.md) | Landed | 1 of 1 |
| [WP38: SIMD](wp38-simd.md) | Landed | 10 of 10 |
| [WP40: Dependency capabilities](wp40-dependency-capabilities.md) | Landed | 1 of 1 |
| [WP42: A multi-core server from pre-forked processes](wp42-multicore-server.md) | Landed | 1 of 1 |
| [WP44: Streaming file reads](wp44-streaming-files.md) | Landed | 4 of 4 |
| [WP45: Name resolution: a DNS stub resolver](wp45-name-resolution.md) | Landed | 1 of 1 |
| [WP46: Memory for programs that do not exit: regions](wp46-long-running-memory.md) | Landed | 4 of 4 |
| [WP47: Shared work across cores: regions, atomics and rings](wp47-shared-memory.md) | Landed | 1 of 2 |
| [WP50: A WebAssembly module a TypeScript page drives](wp50-wasm-host.md) | Landed | 6 of 6 |
| [WP52: Fast rebuilds for `nish run`](wp52-run-rebuilds.md) | Landed | 1 of 2 |
| [WP53: Buffers and handles across `declare function`](wp53-ffi-buffers-handles.md) | Landed | 1 of 1 |
| [WP55: An object graph a WebAssembly module keeps between calls](wp55-persistent-root.md) | Landed | 1 of 1 |
| [WP58: A discriminated union as a generic's type argument](wp58-generics-over-unions.md) | Landed | 1 of 1 |
| [WP24: `async`/`await`](wp24-async.md) | Superseded | 3 of 4 |

## Not built

- WP41, a 64×64→128 multiply: measured on Poly1305, 14% to 21% faster natively but 19% to 27% slower on wasm32, so it was declined.
- WP48, compressed 32-bit references: measured, and neither a whole-program 32-bit mode nor an `i32` pool was built; ports use a tree's first-child and next-sibling links instead, which took about half the memory.

WP-P, the pipeline prep, landed without a note, and WP11, documentation, is
folded into every package.
