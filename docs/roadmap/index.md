# Roadmap

What Nish has built and what is left, with one page per work package. A
checked box is built and on `main`; an unchecked one is not. An item marked
*(owner's decision)* waits on the project's owner, and one marked
*(deferred)* is wanted but not scheduled. Each package's design and its
reasons are in its design note on GitHub, linked from its page; the state is
kept here, and a pull request that lands a stage ticks its box.

## Milestones

- [x] M1, programs: fib, gcd and a string CLI build with `nish --link`, under 20 KB
- [x] M2, data: nbody with structs and arrays matches C's output bit for bit
- [x] M3, Rust parity: the benchmark table within 10% of Rust, wasm and N-API demos
- [x] M5, self-hosting: `src/` compiles `src/`, and stage3 is byte-identical to stage2
- [x] M6, one compiler: stage0 deleted rather than frozen, first released in 0.7.0
- [ ] M4, 1.0: a frozen language reference *(owner's decision)*. Nish stays on 0.x, and a breaking change moves the minor, until its owner declares 1.0

## Up next

In order, as of 2026-11-11. Each package's page says what its next stage is
and where it is specified.

1. [WP49: `async`/`await` on the server, and the TechEmpower top](wp49-async-server.md): meet stage 6's gate.
2. [WP39: The HTTP server: a TechEmpower entry, then a general-purpose server](wp39-http-server.md): G1's interop, G2's open timeouts, then G7's one handler.
3. [WP43: The HTTP application layer](wp43-http-app-layer.md): stage 3, static files.
4. [WP46: Memory for programs that do not exit: regions](wp46-long-running-memory.md): stage 3, the soak.
5. [WP21: Packages](wp21-packages.md): S4, the build cache.
6. [WP33: The round trip to TypeScript](wp33-round-trip.md): R5's `review` tier.
7. [WP38: SIMD](wp38-simd.md): `--cpu` levels for AArch64 or `x86-64-v4`.

[WP34: Hosting cs: the network stack](wp34-hosting-cs.md)'s remaining waves are in the cs repository.

## Waiting on a decision

- M4: when to declare 1.0.
- [WP22: Arrow functions as the declaration form](wp22-arrow-functions.md): whether stage D rejects a `function` definition.
- [WP27: Calling C](wp27-ffi.md): whether S4 (C structs) and S5 (`errno`) happen at all.
- [WP28: Compatibility mode](wp28-compatibility-mode.md): whether to accept compatibility mode, and its open questions.
- [WP39: The HTTP server: a TechEmpower entry, then a general-purpose server](wp39-http-server.md) and [WP49: `async`/`await` on the server, and the TechEmpower top](wp49-async-server.md): whether and when to submit to TechEmpower.

## Picking up a work package

For a contributor, or an agent asked to "pick up WP50":

1. Open the package's page here. The work is the item under **Next**; if
   that item waits on a decision, ask the owner instead of starting.
2. Read the section of the design note that **Next** links, the package's
   plan in `.claude/plans/` if it has one, and the open pull requests and
   issues that name the package, so the work is not done twice.
3. In the pull request that lands the stage, tick its box here, move
   **Next** on, and update the Up next list above if the order changed.

## In progress and proposed

| Work package | State | Done |
| --- | --- | --- |
| [WP21: Packages](wp21-packages.md) | In progress | 5 of 7 |
| [WP22: Arrow functions as the declaration form](wp22-arrow-functions.md) | In progress | 3 of 5 |
| [WP27: Calling C](wp27-ffi.md) | In progress | 3 of 5 |
| [WP33: The round trip to TypeScript](wp33-round-trip.md) | In progress | 6 of 9 |
| [WP34: Hosting cs: the network stack](wp34-hosting-cs.md) | In progress | 9 of 18 |
| [WP37: The OS sandbox](wp37-os-sandbox.md) | In progress | 4 of 8 |
| [WP38: SIMD](wp38-simd.md) | In progress | 9 of 10 |
| [WP39: The HTTP server: a TechEmpower entry, then a general-purpose server](wp39-http-server.md) | In progress | 12 of 27 |
| [WP43: The HTTP application layer](wp43-http-app-layer.md) | In progress | 3 of 7 |
| [WP46: Memory for programs that do not exit: regions](wp46-long-running-memory.md) | In progress | 3 of 4 |
| [WP49: `async`/`await` on the server, and the TechEmpower top](wp49-async-server.md) | In progress | 4 of 6 |
| [WP51: References to capture-free top-level functions](wp51-function-references.md) | In progress | 2 of 4 |
| [WP28: Compatibility mode](wp28-compatibility-mode.md) | Proposed | 2 of 13 |

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
| [WP29: The thread surface](wp29-thread-surface.md) | Landed | 5 of 8 |
| [WP30: Bytes across the interop boundary](wp30-bytes-interop.md) | Landed | 1 of 3 |
| [WP31: Ranged integers](wp31-ranged-integers.md) | Landed | 1 of 4 |
| [WP32: `Map` and `Set`](wp32-map.md) | Landed | 2 of 2 |
| [WP35: The capability report](wp35-capabilities.md) | Landed | 1 of 1 |
| [WP36: The capability policy](wp36-capability-policy.md) | Landed | 1 of 1 |
| [WP40: Dependency capabilities](wp40-dependency-capabilities.md) | Landed | 1 of 1 |
| [WP42: A multi-core server from pre-forked processes](wp42-multicore-server.md) | Landed | 1 of 1 |
| [WP44: Streaming file reads](wp44-streaming-files.md) | Landed | 4 of 4 |
| [WP45: Name resolution: a DNS stub resolver](wp45-name-resolution.md) | Landed | 1 of 1 |
| [WP47: Shared work across cores: regions, atomics and rings](wp47-shared-memory.md) | Landed | 1 of 2 |
| [WP48: Compressed 32-bit references](wp48-compressed-references.md) | Landed | 2 of 4 |
| [WP50: A WebAssembly module a TypeScript page drives](wp50-wasm-host.md) | Landed | 6 of 6 |
| [WP52: Fast rebuilds for `nish run`](wp52-run-rebuilds.md) | Landed | 1 of 2 |
| [WP53: Buffers and handles across `declare function`](wp53-ffi-buffers-handles.md) | Landed | 1 of 1 |
| [WP24: `async`/`await`](wp24-async.md) | Superseded | 3 of 4 |
| [WP41: A wide multiply](wp41-mul-wide.md) | Declined | 1 of 1 |

WP-P, the pipeline prep, landed without a note, and WP11, documentation, is
folded into every package.
