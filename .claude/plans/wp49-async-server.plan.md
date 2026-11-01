---
name: WP49 — the TechEmpower top, then async/await on the server
overview: Take the Nish HTTP server to the top of TechEmpower on every test type, then give it TypeScript's async/await, non-blocking and costing nothing the explicit loop does not (docs/wp49-async-server.md, D1 accepted). Each stage is one pull request, ordered by dependency.
stages:
  - id: plaintext-hot-path
    title: Plaintext past uWebSockets.js
    goal: The plaintext entry beats uWebSockets.js on one core at every TFB connection count.
    verification: bash bench/techempower/run.sh --only plaintext
    status: completed
    todos:
      - id: parser-one-pass
        content: Read each field line once in http1TakeLine, sixteen bytes a step, with lineControl replacing the value rescan — see Plaintext past uWebSockets.js
        status: completed
      - id: parser-small-wins
        content: Make http1IsTokenByte a bitmask, walk Connection once in http1ConnectionOptions, set spans after one capacity check — see Plaintext past uWebSockets.js
        status: completed
      - id: writer-block-copies
        content: Copy names, values and the date with copyBytes in http1WriteResponseHead, and write status, CRLF and colon-space with plain stores — see Plaintext past uWebSockets.js
        status: completed
      - id: parser-edge-tests
        content: Pin every control byte at every offset of a 40-byte value in tests/link/net_http1 and record it in docs/security/http1.md — see Plaintext past uWebSockets.js
        status: completed
  - id: simd-load-fix
    title: Fix loadU8x16 in a loop over a hoisted array
    goal: loadU8x16 inside a loop over an array read from a field emits valid IR, and http1TakeLine loads its vector directly.
    verification: node tests/run.js simd && node tests/run.js net_http1 && node tests/run.js tfb
    todos:
      - id: simd-load-codegen-bug
        content: Make the vector load in src/emit-arrays.ts take the hoisted array pointer, pinned by a tests/cases simd program that loops over a field's array — see Fix loadU8x16
        status: pending
      - id: simd-inline-load16
        content: Remove http1Load16 from std/net/http1.ts and call loadU8x16 in http1TakeLine — see Fix loadU8x16
        status: pending
  - id: date-clock
    title: One clock read per serve call for the Date field
    goal: Responses written inside one Http1Server serve call share one wall-clock read; a response sent outside one still reads the clock.
    verification: node tests/run.js net_http1_server && node tests/run.js tfb && node tests/run.js net_handler
    todos:
      - id: date-clock-per-turn
        content: Read the wall clock once per serve call in std/net/http1-server.ts and let HttpDate.current use it, with a test that a deferred answer still gets the current second — see One clock read per serve call
        status: pending
  - id: upstream-http
    title: Non-blocking outbound HTTP on the handler's loop
    goal: A route handler calls another HTTP service through nish/net/upstream without blocking its worker.
    verification: node tests/run.js net_upstream && node tests/run.js net_handler && node scripts/security-scope.mjs
    todos:
      - id: upstream-module
        content: Add std/net/upstream.ts, a keep-alive pool to one origin driven by the http1-client codec on HttpHandler's loop, answers tagged with the asking request — see Non-blocking outbound HTTP
        status: pending
      - id: upstream-policy
        content: Apply OutboundPolicy in Upstream when its origin comes from input, and write docs/security/upstream.md with its index row — see Non-blocking outbound HTTP
        status: pending
      - id: upstream-guide
        content: Add the guide page for calling a service from a handler, routed in scalar.config.json, and the std/README.md and docs/AI.md rows — see Non-blocking outbound HTTP
        status: pending
  - id: pg-carrier
    title: The Postgres pool on the handler's loop
    goal: A route handler queries Postgres through PgPool and PgBatcher on HttpHandler's loop without blocking its worker.
    verification: node tests/run.js std_postgres && node tests/run.js net_handler
    todos:
      - id: pg-carrier-class
        content: Add PgCarrier to std/net/postgres.ts, the loop driving of tests/postgres/carrier.ts made a std class on HttpHandler's loop — see The Postgres pool on the handler's loop
        status: pending
      - id: pg-carrier-tests
        content: Pin it with a loopback test against the replayed server and the live suite, and move tests/postgres/carrier.ts onto it — see The Postgres pool on the handler's loop
        status: pending
      - id: pg-carrier-docs
        content: Extend docs/security/postgres.md and docs/guide/using-nish/postgres.md — see The Postgres pool on the handler's loop
        status: pending
  - id: regions-runtime
    title: Regions, the runtime (WP46 stage 1)
    goal: The runtime can make, enter, leave and free a region, with memory flat over a hundred thousand of them.
    verification: node tests/run.js budget && node tests/run.js region
    todos:
      - id: wp46-stage-1
        content: Build WP46 stage 1 — runtime/runtime-region.c, nish_arena_grow's chunk size, the build and cache units, the budgets, and its C test — see Regions, the runtime
        status: pending
  - id: client-renames
    title: Name the HTTP clients
    goal: The blocking client is nish/net/fetch with fetchSync, and the sans-IO codecs say so in their names.
    verification: npm run check && npm run lint && node tests/run.js net_ && node tests/run.js http
    todos:
      - id: rename-fetch-sync
        content: Move std/net/http-client.ts to std/net/fetch.ts with httpFetch as fetchSync and HttpClient as FetchSyncClient — see Name the HTTP clients
        status: pending
      - id: rename-codecs
        content: Move std/net/http1.ts and std/net/http1-client.ts to http1-codec.ts and http1-client-codec.ts, with every importer — see Name the HTTP clients
        status: pending
      - id: rename-docs
        content: Update docs/guide, docs/security records, std/README.md, docs/AI.md and every pointer to the old paths — see Name the HTTP clients
        status: pending
  - id: benchmarks-refresh
    title: Refresh the recorded benchmarks
    goal: docs/BENCHMARKS.md carries a TechEmpower run with every twin built, plaintext and json.
    verification: bash bench/http-twins/build.sh && bash bench/techempower/run.sh
    todos:
      - id: benchmarks-run
        content: Build every twin and rerun bench/techempower/run.sh into docs/BENCHMARKS.md — see Refresh the recorded benchmarks
        status: pending
  - id: regions-language
    title: Regions, the language (WP46 stage 2)
    goal: A program can allocate into a region of its own and free it, with the checker refusing a value that outlives its region.
    verification: node tests/run.js region && node tests/run.js reject_region
    todos:
      - id: wp46-stage-2
        content: Build WP46 stage 2 — nish:region in the checker and codegen with NL2556 to NL2561, the guide page, LANGUAGE.md and the cookbook — see Regions, the language
        status: pending
  - id: tfb-all-tests
    title: Every TFB test type, on every core
    goal: The entry answers db, query, update, cached-query and fortune, and scales across cores evenly.
    verification: node tests/run.js tfb && bash bench/techempower/run.sh
    todos:
      - id: tfb-db-tests
        content: Add db, query, update and cached-query to bench/techempower on the Postgres carrier, batching across requests in flight — see Every TFB test type
        status: pending
      - id: tfb-fortune
        content: Add fortune with an HTML escape, a byte sort and one reused response buffer — see Every TFB test type
        status: pending
      - id: prefork-pinning
        content: Pin each prefork worker to its own core and steer connections by incoming CPU in std/net/prefork.ts — see Every TFB test type
        status: pending
      - id: tfb-separate-rig
        content: Measure every test type with the client on its own machine at TFB's connection counts — see Every TFB test type
        status: pending
  - id: async-language
    title: async and await in the language
    goal: The checker and codegen accept the restricted async of WP49 section 2 and lower each task to a compile-time-sized frame.
    verification: node tests/run.js async && node tests/run.js reject_async
    todos:
      - id: async-checker
        content: Accept async, await on a direct call, Promise as a return type, spawn and awaitAll, and refuse promise values and recursion through await — see async and await in the language
        status: pending
      - id: async-lowering
        content: Lower each async function to a frame struct and resume switch, nesting awaited frames, sized at compile time — see async and await in the language
        status: pending
      - id: async-emit-ts
        content: Emit async functions as JavaScript async functions under --emit-ts and state the declared differences in LANGUAGE.md — see async and await in the language
        status: pending
  - id: async-runtime
    title: The executor and the async server
    goal: One executor per process resumes tasks when their socket or timer is ready, and serve, fetch and the Postgres pool are async.
    verification: node tests/run.js async && node tests/run.js budget && node scripts/security-scope.mjs
    todos:
      - id: executor-unit
        content: Add runtime/runtime-async.c and nish:async with readable, writable and sleep over pollWait — see The executor and the async server
        status: pending
      - id: async-serve
        content: Add serve(port, router, limits, handle) spawning one task per request with a region each — see The executor and the async server
        status: pending
      - id: async-fetch-pg
        content: Make fetch and the Postgres pool async wrappers over Upstream and the carrier — see The executor and the async server
        status: pending
      - id: async-cancellation
        content: Answer every await of a cancelled task with its call's failure, and pin it with a hang-up test — see The executor and the async server
        status: pending
  - id: async-gate
    title: The async entry, held to the gate
    goal: The TFB entry written with async matches the explicit entry, which is D1's condition.
    verification: bash bench/techempower/run.sh
    todos:
      - id: async-entry
        content: Write bench/techempower in the async style beside the explicit one — see The async entry
        status: pending
      - id: async-gate-run
        content: Run both entries in the same rounds and record the result in docs/BENCHMARKS.md and WP49 — see The async entry
        status: pending
---

# WP49 — the TechEmpower top, then async/await on the server

## Context

The design is [docs/wp49-async-server.md](../../docs/wp49-async-server.md). D1 is accepted: WP24's refusal of `async` is reversed for a restricted form, on condition that an `await` never blocks and costs nothing the explicit loop does not. The server today is one process per core ([std/net/prefork.ts](../../std/net/prefork.ts)), each running one `pollWait` loop. [std/net/postgres.ts](../../std/net/postgres.ts) already has `PgPool` and `PgBatcher`, sans-IO; [tests/postgres/carrier.ts](../../tests/postgres/carrier.ts) drives them from a test loop.

Each stage is one pull request, opened finished and merged per [AGENTS.md](../../AGENTS.md).

## Runs

| Run | Stages | Why then |
| --- | --- | --- |
| 1 | `simd-load-fix`, `date-clock`, `upstream-http`, `pg-carrier`, `regions-runtime`, then `client-renames` | independent of each other; the renames last, since they move files the others edit |
| 2 | `regions-language`, `tfb-all-tests` | after run 1; `regions-language` needs WP46's design accepted by the owner |
| 3 | `async-language`, `async-runtime`, `async-gate` | after regions; the language stage may need more than one PR |
| by hand | `benchmarks-refresh` | needs the Go, Rust, Bun and nginx toolchains `bench/http-twins/build.sh` pins |

## Plaintext past uWebSockets.js

Done in #1139. Callgrind put [std/net/http1.ts](../../std/net/http1.ts) at 10,941 user instructions per pipelined plaintext request; it is 7,146 now. Plaintext 16-deep on one core: 857k, 733k, 694k and 608k req/s at 256, 1,024, 4,096 and 16,384 connections, against uWebSockets.js at 607k, 522k, 560k and 552k.

## Fix loadU8x16

**Owns:** `src/emit-arrays.ts`, `tests/cases/simd_load_field_loop*`, `std/net/http1.ts`, `tests/link/net_http1/**`

`loadU8x16(buf, i)` inside a loop over `const buf = h.buf` emits `%n = bitcast i8*  to i8*`: the vector load does not take the array pointer the header hoist made. The repro, 25 lines, is the body of a new `tests/cases/simd_load_field_loop` with its golden `.ll` and `.out`. Then `http1TakeLine` calls `loadU8x16` directly and `http1Load16` goes. A `src/` change also runs `node tests/run.js wasi` (`WASI_SYSROOT=/usr`) and `node tests/run.js performance`, and regenerates both golden sets.

## One clock read per serve call

**Owns:** `std/net/http1-server.ts`, `tests/link/net_http1_server*/**`, `tests/link/tfb_entry/**`

`HttpDate.current()` calls `Date.now()` for every response: about 2% of server CPU under perf on pipelined plaintext. The server reads the clock once at the top of each serve call and `current` uses that reading for responses written inside it. A response written outside a serve call (a deferred answer, `nish/net/handler`'s "answered later") reads the clock as now. `pin` keeps winning over both.

## Non-blocking outbound HTTP

**Owns:** `std/net/upstream.ts`, `tests/link/net_upstream*/**`, `docs/security/upstream.md`, `docs/security/README.md`, `docs/guide/using-nish/calling-services.md`, `scalar.config.json`, `std/README.md`, `docs/AI.md`, `docs/wp49-async-server.md`

WP49 section 7. `Upstream` keeps keep-alive connections to one origin on `HttpHandler`'s loop. `get(req, path)` returns at once; `ready()`, `take()` and `release(r)` hand back finished responses tagged with `r.req`. It drives the `http1-client` codec, caps everything at start-up, allocates nothing per call once warm, and applies `OutboundPolicy` when the origin comes from input. The tests show a slow upstream not stalling another client, `Arena.used()` flat over thousands of calls, and every refusal the codec makes reaching the caller.

## The Postgres pool on the handler's loop

**Owns:** `std/net/postgres.ts`, `tests/link/std_postgres_carrier*/**`, `tests/postgres/**`, `docs/security/postgres.md`, `docs/guide/using-nish/postgres.md`

`PgCarrier` is what [tests/postgres/carrier.ts](../../tests/postgres/carrier.ts) does for a test, as a class in `std/net/postgres.ts` that registers a `PgPool`'s connections on `HttpHandler`'s loop and routes `PgBatcher` events to the requests waiting on them. It lives in the existing module, so it needs no new `std/README.md` row. CI's `postgres-live` job runs it against a real server.

## Regions, the runtime

**Owns:** `runtime/runtime-region.c`, `runtime/runtime.c`, `runtime/nish.h`, `scripts/build.sh`, `src/run-cache.ts`, `tests/runtime-budgets.js`, `tests/runtime/**`, `docs/security/runtime.md`, `docs/wp46-long-running-memory.md`

[docs/wp46-long-running-memory.md](../../docs/wp46-long-running-memory.md) stage 1, as its stage table says: the region table, `nish_region_new`, `_enter`, `_leave` and `_free`, the thread, generation and entered checks, the chunk size, the unit paired in `scripts/build.sh` and `src/run-cache.ts` in one commit, the budget rows, `--profile wasm` refusing IR that names `@nish_region_`, and a C test that frees a hundred thousand regions with RSS flat. No construct: nothing in the language reaches it yet.

## Name the HTTP clients

**Owns:** `std/net/http-client.ts`, `std/net/fetch.ts`, `std/net/http1.ts`, `std/net/http1-codec.ts`, `std/net/http1-client.ts`, `std/net/http1-client-codec.ts`, every file that imports them (`std/**`, `examples/**`, `bench/**`, `tests/**`), `docs/**`, `std/README.md`
**Model:** sonnet

WP49 section 8. A `refactor!` (the project stays on 0.x). Starts only after every other run-1 stage has merged, since it moves files they edit.

| Today | After |
| --- | --- |
| `std/net/http-client.ts` `httpFetch`, `HttpClient` | `std/net/fetch.ts` `fetchSync`, `FetchSyncClient` |
| `std/net/http1.ts` | `std/net/http1-codec.ts` |
| `std/net/http1-client.ts` | `std/net/http1-client-codec.ts` |

Regenerate both golden sets and move every pointer (CLAUDE.md, "Moving where a fact lives").

## Refresh the recorded benchmarks

**Owns:** `docs/BENCHMARKS.md`

By hand, outside the runs: [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md) still shows 324k against uWS's 412k from 2026-10-21.

## Regions, the language

**Owns:** `src/**`, `runtime/nish.d.ts`, `runtime/nish.mjs`, `std/region.ts`, `tests/cases/**`, `docs/LANGUAGE.md`, `docs/cookbook/**`, `docs/guide/**`

WP46 stage 2. Run 2, and only once the owner accepts WP46's design.

## Every TFB test type

**Owns:** `bench/techempower/**`, `std/net/prefork.ts`, `tests/link/tfb_*/**`, `tests/link/net_prefork*/**`, `docs/BENCHMARKS.md`

WP39 E7 and E8 on the carrier. `db`, `query` and `update` batch queries from every request in flight into one execution, as the strongest entries do. `fortune` needs an escape for TFB's five characters, a byte sort, and the Japanese row passed through untouched. Prefork pins worker `k` to CPU `k` and steers each connection to the worker on the CPU that received it. No rank is claimed from a client that shares the server's machine; submitting stays the owner's call.

## async and await in the language

**Owns:** `src/**`, `tests/cases/**`, `docs/LANGUAGE.md`, `docs/cookbook/**`, `docs/guide/**`, `runtime/nish.d.ts`

WP49 sections 2 and 3. `await` takes only a direct call to an `async` function; `spawn` and `awaitAll` take only such calls; a cycle through `await` is refused. Each `async` function becomes a frame struct and a resume function, an awaited callee's frame nested in its caller's, so a task is one block of a size the compiler knows. A program with no `async` function compiles byte for byte as before.

## The executor and the async server

**Owns:** `runtime/runtime-async.c`, `std/async.ts`, `std/net/serve.ts`, `std/net/upstream.ts`, `std/net/fetch.ts`, `std/net/postgres.ts`, `tests/link/async_*/**`, `docs/security/**`, `docs/guide/**`

WP49 section 4. One executor per process on `pollWait`; `serve` spawns one task per request, each in its own region; cancellation answers every later `await` with its call's failure; `--profile wasm` refuses `async`.

## The async entry

**Owns:** `bench/techempower/**`, `docs/BENCHMARKS.md`, `docs/wp49-async-server.md`

The gate D1 was accepted on: the `async` entry inside the explicit entry's noise band on plaintext, json and db, in the same interleaved rounds.

## Acceptance criteria (run 1)

1. A program that calls `loadU8x16` inside a loop over an array read from an object field compiles, links and prints its expected output, and `std/net/http1.ts` has no `http1Load16`.
2. Responses written inside one `Http1Server` serve call carry a `Date` from one clock read, and a response written outside a serve call carries the current second.
3. A route handler on `HttpHandler`'s loop calls an HTTP service through `nish/net/upstream` and answers its request from the response, while a second client is served during a slow upstream reply; `Arena.used()` stays flat over thousands of calls, and `docs/security/upstream.md` exists with its index row.
4. A route handler on `HttpHandler`'s loop queries Postgres through `PgCarrier` without blocking other connections, against the replayed server and in CI's `postgres-live` job.
5. `runtime/runtime-region.c` makes, enters, leaves and frees regions; a C test frees a hundred thousand with resident memory flat; the runtime budgets pass.
6. No file names `nish/net/http-client`, `nish/net/http1` or `nish/net/http1-client`; `fetchSync` fetches; the guide uses the new names.
7. The TechEmpower plaintext entry runs no more user instructions per request than 7,146 plus 1% (callgrind, as in #1139).

## Out of scope

Promises as values, `.then`, `Promise.all` over an array, `for await`, moving a waiting task between processes or threads, `async` on wasm, and the handler over HTTP/2 and HTTP/3 (WP43).

## Verification

```bash
npm run check
npm run lint
node tests/run.js <section>            # each stage's verification line
node tests/self/goldens.js --update    # after any std/ or src/ change
node scripts/security-scope.mjs        # a new std/net module or runtime unit
node docs/check-links.mjs
```

A `src/` stage also runs `node tests/run.js wasi` (`WASI_SYSROOT=/usr`) and `node tests/run.js performance`. CI's four `test` shards are the full gate.
