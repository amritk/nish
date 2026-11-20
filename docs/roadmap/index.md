# Roadmap

What Nish has built, with one page per work package, and where the work that
is left is tracked. A checked box on a page is built and on `main`. The open
work is GitHub issues: the [Roadmap issue](https://github.com/amritk/nish/issues/1849) lists one parent issue per
work package in the order agents pick them up, and each parent's sub-issues
are its stages, one pull request each, specified by the package's plan file in
`.claude/plans/`. Each package's design and its reasons are in its design
note, linked from its page. A package is listed as landed once every stage it
has left is deferred or waits on a decision.

## Milestones

- [x] M1, programs: fib, gcd and a string CLI build with `nish --link`, under 20 KB
- [x] M2, data: nbody with structs and arrays matches C's output bit for bit
- [x] M3, Rust parity: the benchmark table within 10% of Rust, wasm and N-API demos
- [x] M5, self-hosting: `src/` compiles `src/`, and stage3 is byte-identical to stage2
- [x] M6, one compiler: stage0 deleted rather than frozen, first released in 0.7.0
- [ ] M4, 1.0: a frozen language reference *(open question)*. Nish stays on 0.x, and a breaking change moves the minor, until 1.0

## Up next

In the order of the [Roadmap issue](https://github.com/amritk/nish/issues/1849). The packages an agent may pick up
now are its [`ready` parents](https://github.com/amritk/nish/issues?q=is%3Aopen+label%3Aplan+label%3Aready);
`/feature --next` claims the first. The questions waiting on the owner are the
issues labelled [`needs-decision`](https://github.com/amritk/nish/issues?q=is%3Aopen+label%3Aneeds-decision),
which `/decide` asks; M4, when to declare 1.0, stays the owner's.

## In progress and proposed

| Work package | State | Open work |
| --- | --- | --- |
| [WP21: Packages](wp21-packages.md) | In progress | [#1911](https://github.com/amritk/nish/issues/1911) |
| [WP28: Compatibility mode](wp28-compatibility-mode.md) | In progress | [#1907](https://github.com/amritk/nish/issues/1907) |
| [WP33: The round trip to TypeScript](wp33-round-trip.md) | In progress | [#1877](https://github.com/amritk/nish/issues/1877) |
| [WP43: The HTTP application layer](wp43-http-app-layer.md) | In progress | [#1857](https://github.com/amritk/nish/issues/1857) |
| [WP48: 32-bit references for linked classes](wp48-ref32-classes.md) | In progress | [#1893](https://github.com/amritk/nish/issues/1893) |
| [WP49: `async`/`await` on the server, and the TechEmpower top](wp49-async-server.md) | In progress | [#1854](https://github.com/amritk/nish/issues/1854) |
| [WP51: References to capture-free top-level functions](wp51-function-references.md) | In progress | [#1892](https://github.com/amritk/nish/issues/1892) |
| [WP57: Module-scoped names](wp57-module-scoped-names.md) | In progress | [#1871](https://github.com/amritk/nish/issues/1871) |
| [WP64: Temporal — dates, times and time zones](wp64-temporal.md) | In progress | [#1870](https://github.com/amritk/nish/issues/1870) |
| [WP65: The surface a lexer port asked for](wp65-lexer-surface.md) | Proposed | [#1884](https://github.com/amritk/nish/issues/1884) |
| [WP68: Shared libraries, layered like atomic design](wp68-shared-libraries.md) | Proposed | [#1868](https://github.com/amritk/nish/issues/1868) |
| [WP54: `async` on wasm, with the page as the executor](wp54-async-wasm.md) | Proposed | [#1956](https://github.com/amritk/nish/issues/1956) |
| [WP56: Generators whose memory stays flat: a string builder, and a scope per file](wp56-flat-memory-generators.md) | Proposed | [#1926](https://github.com/amritk/nish/issues/1926) |
| [WP59: The wasm arena in a second, unexported memory](wp59-wasm-arena-memory.md) | Proposed | [#1861](https://github.com/amritk/nish/issues/1861) |
| [WP60: Dynamic dispatch over interfaces](wp60-dyn-dispatch.md) | Proposed | [#1872](https://github.com/amritk/nish/issues/1872) |
| [WP61: Typed JSON, constraints and coercion in one pass](wp61-json-typed-checks.md) | Proposed | [#1869](https://github.com/amritk/nish/issues/1869) |
| [WP62: Nish classes from a JSON Schema](wp62-json-schema-classes.md) | Proposed | [#1860](https://github.com/amritk/nish/issues/1860) |

## Landed

| Work package | State | Open work |
| --- | --- | --- |
| [WP0: The Phase 0 validator](wp0-validator.md) | Landed | none |
| [WP1: Control flow](wp1-control-flow.md) | Landed | none |
| [WP2: Classes, interfaces, structs](wp2-classes.md) | Landed | none |
| [WP3: Strings](wp3-strings.md) | Landed | none |
| [WP4: Arrays](wp4-arrays.md) | Landed | none |
| [WP5: Modules, entry point, linkage](wp5-modules.md) | Landed | none |
| [WP6: Memory: escape-analysed stack, arena scopes, `T \| null`](wp6-memory.md) | Landed | [#1993](https://github.com/amritk/nish/issues/1993) |
| [WP7: Runtime and intrinsics](wp7-runtime.md) | Landed | none |
| [WP8: Interop: wasm, N-API, headers](wp8-interop.md) | Landed | none |
| [WP9: Optimisation and benchmarks](wp9-optimisation.md) | Landed | none |
| [WP10: CI, diagnostics, the code registry](wp10-ci.md) | Landed | none |
| [WP12: Release engineering](wp12-release.md) | Landed | none |
| [WP13: Differential testing against Node](wp13-differential.md) | Landed | [#1864](https://github.com/amritk/nish/issues/1864) |
| [WP14: Self-hosting](wp14-selfhost.md) | Landed | none |
| [WP15: Performance first](wp15-performance.md) | Landed | none |
| [WP16: `Result<T, E>` and the end of `throw`](wp16-results.md) | Landed | none |
| [WP17: `Result` across the ABI](wp17-result-abi.md) | Landed | none |
| [WP18: Generics by monomorphisation](wp18-generics.md) | Landed | [#1975](https://github.com/amritk/nish/issues/1975) |
| [WP19: Stage0 retirement](wp19-stage0-retirement.md) | Landed | [#1874](https://github.com/amritk/nish/issues/1874) |
| [WP20: Threads: the runtime half](wp20-threads.md) | Landed | none |
| [WP22: Arrow functions as the declaration form](wp22-arrow-functions.md) | Landed | [#1866](https://github.com/amritk/nish/issues/1866) |
| [WP23: The language surface a corpus review asked for](wp23-language-surface.md) | Landed | none |
| [WP25: Remove inheritance, widen `implements`](wp25-inheritance.md) | Landed | none |
| [WP26: The standard library](wp26-stdlib.md) | Landed | none |
| [WP27: Calling C](wp27-ffi.md) | Landed | none |
| [WP29: The thread surface](wp29-thread-surface.md) | Landed | [#1988](https://github.com/amritk/nish/issues/1988) |
| [WP30: Bytes across the interop boundary](wp30-bytes-interop.md) | Landed | [#1913](https://github.com/amritk/nish/issues/1913) |
| [WP31: Ranged integers](wp31-ranged-integers.md) | Landed | [#1863](https://github.com/amritk/nish/issues/1863) |
| [WP32: `Map` and `Set`](wp32-map.md) | Landed | [#1862](https://github.com/amritk/nish/issues/1862) |
| [WP34: The network stack](wp34-network-stack.md) | Landed | [#1852](https://github.com/amritk/nish/issues/1852) |
| [WP35: The capability report](wp35-capabilities.md) | Landed | none |
| [WP36: The capability policy](wp36-capability-policy.md) | Landed | none |
| [WP37: The OS sandbox](wp37-os-sandbox.md) | Landed | [#1909](https://github.com/amritk/nish/issues/1909) |
| [WP38: SIMD](wp38-simd.md) | Landed | [#1865](https://github.com/amritk/nish/issues/1865) |
| [WP39: The HTTP server: a TechEmpower entry, then a general-purpose server](wp39-http-server.md) | Landed | [#1850](https://github.com/amritk/nish/issues/1850) |
| [WP40: Dependency capabilities](wp40-dependency-capabilities.md) | Landed | none |
| [WP42: A multi-core server from pre-forked processes](wp42-multicore-server.md) | Landed | none |
| [WP44: Streaming file reads](wp44-streaming-files.md) | Landed | none |
| [WP45: Name resolution: a DNS stub resolver](wp45-name-resolution.md) | Landed | none |
| [WP46: Memory for programs that do not exit: regions](wp46-long-running-memory.md) | Landed | none |
| [WP47: Shared work across cores: regions, atomics and rings](wp47-shared-memory.md) | Landed | [#1903](https://github.com/amritk/nish/issues/1903) |
| [WP50: A WebAssembly module a TypeScript page drives](wp50-wasm-host.md) | Landed | [#1873](https://github.com/amritk/nish/issues/1873) |
| [WP52: Fast rebuilds for `nish run`](wp52-run-rebuilds.md) | Landed | [#1875](https://github.com/amritk/nish/issues/1875) |
| [WP53: Buffers and handles across `declare function`](wp53-ffi-buffers-handles.md) | Landed | none |
| [WP55: An object graph a WebAssembly module keeps between calls](wp55-persistent-root.md) | Landed | none |
| [WP58: A discriminated union as a generic's type argument](wp58-generics-over-unions.md) | Landed | none |
| [WP63: io_uring direct descriptors for `nish:net`](wp63-iouring-net.md) | Landed | [#1891](https://github.com/amritk/nish/issues/1891) |
| [WP66: C libraries from their headers](wp66-c-headers.md) | Landed | [#1996](https://github.com/amritk/nish/issues/1996) |
| [WP24: `async`/`await`](wp24-async.md) | Superseded | [#1918](https://github.com/amritk/nish/issues/1918) |

## Not built

- WP41, a 64×64→128 multiply: measured on Poly1305, 14% to 21% faster natively but 19% to 27% slower on wasm32, so it was declined.
- WP48's first design, a whole-program 32-bit mode or an `i32` pool: measured and declined on 2026-11-11; ports use a tree's first-child and next-sibling links instead, which took about half the memory. WP48 is reopened above for linked classes the compiler picks.

WP-P, the pipeline prep, landed without a note, and WP11, documentation, is
folded into every package.
