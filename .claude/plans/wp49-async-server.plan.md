---
name: WP49 — the TechEmpower top, then async/await on the server
overview: Take the Nish HTTP server to the top of TechEmpower on every test type, then give it TypeScript's async/await, non-blocking and costing nothing the explicit loop does not (docs/wp49-async-server.md, D1 accepted). Each stage is one pull request, ordered by dependency.
stages:
  - id: plaintext-hot-path
    title: Plaintext past uWebSockets.js
    goal: The plaintext entry beats uWebSockets.js on one core at every TFB connection count.
    verification: bench/techempower/run.sh --only plaintext puts entry above uws beyond the entry-copy noise band at 256, 1024 and 4096 connections.
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
  - id: plaintext-follow-ups
    title: Plaintext follow-ups
    goal: The loose ends of the plaintext work are closed, and the recorded numbers describe the code.
    verification: http1Load16 is gone with no invalid IR, tests/link/net_http1 and tfb pass, and docs/BENCHMARKS.md carries a full twins run.
    todos:
      - id: simd-load-codegen-bug
        content: Fix loadU8x16 emitting a bitcast with no operand inside a loop over a hoisted array header, pinned by a tests/cases program, then inline http1Load16 — see Plaintext follow-ups
        status: pending
      - id: date-clock-per-turn
        content: Read the wall clock once per Http1Server serve call instead of per response in HttpDate.current — see Plaintext follow-ups
        status: pending
      - id: benchmarks-refresh
        content: Build every twin with bench/http-twins/build.sh and rerun bench/techempower/run.sh into docs/BENCHMARKS.md — see Plaintext follow-ups
        status: pending
  - id: client-renames
    title: Name the HTTP clients
    goal: The blocking client is nish/net/fetch with fetchSync, and the sans-IO codecs say so in their names.
    verification: No file names nish/net/http-client or nish/net/http1-client, npm run check, npm run lint and the net_ test sections pass, and the guide pages use the new names.
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
  - id: upstream-explicit
    title: Non-blocking outbound calls on the explicit loop
    goal: A route handler calls another HTTP service or Postgres without blocking its worker, on the handler's own poll loop.
    verification: tests/link for Upstream and the Postgres carrier pass over loopback, Arena.used() stays flat over thousands of calls, and both have docs/security records and guide pages.
    todos:
      - id: upstream-module
        content: Add std/net/upstream.ts, a keep-alive pool to one origin driven by the http1-client codec on HttpHandler's loop, answers tagged with the asking request — see Non-blocking outbound calls
        status: pending
      - id: upstream-policy
        content: Apply OutboundPolicy in Upstream when its origin comes from input, and write docs/security/upstream.md — see Non-blocking outbound calls
        status: pending
      - id: pg-carrier
        content: Promote tests/postgres/carrier.ts into std as a PgPool and PgBatcher carrier on HttpHandler's loop — see Non-blocking outbound calls
        status: pending
      - id: upstream-guide
        content: Add a guide page for calling a service from a handler, routed in scalar.config.json — see Non-blocking outbound calls
        status: pending
  - id: tfb-all-tests
    title: Every TFB test type, on every core
    goal: The entry answers db, query, update, cached-query and fortune, and scales across cores evenly.
    verification: The TFB verifier passes all seven test types, and a run with the client on its own machine has numbers for each in docs/BENCHMARKS.md.
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
  - id: regions-prerequisite
    title: Regions (WP46 stages 1 and 2)
    goal: A program can allocate into a region of its own and free it, which a task's memory needs.
    verification: WP46's stage table is met — the runtime unit, nish:region with its negative tests, and the guide page.
    todos:
      - id: wp46-stage-1
        content: Build WP46 stage 1, runtime/runtime-region.c and its budgets — see Regions
        status: pending
      - id: wp46-stage-2
        content: Build WP46 stage 2, nish:region in the checker and codegen with its NL codes — see Regions
        status: pending
  - id: async-language
    title: async and await in the language
    goal: The checker and codegen accept the restricted async of WP49 section 2 and lower each task to a compile-time-sized frame.
    verification: The construct checklist of docs/ARCHITECTURE.md is met — golden .ll, llvm-as, native round trips, one negative test per refusal, LANGUAGE.md rule, cookbook entry and guide page.
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
    verification: A program with no async function links no executor, an async server serves pipelined requests with Arena.used() flat, and runtime-async.c has a budget row and a security record.
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
    verification: On plaintext, json and db the async entry is inside the noise band of the explicit entry, both measured in the same interleaved rounds.
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

The design is [docs/wp49-async-server.md](../../docs/wp49-async-server.md). D1 is accepted: WP24's refusal of `async` is reversed for a restricted form, on condition that an `await` never blocks and costs nothing the explicit loop does not. The server today is one process per core ([std/net/prefork.ts](../../std/net/prefork.ts)), each running one `pollWait` loop. [std/net/postgres.ts](../../std/net/postgres.ts) already has `PgPool` and `PgBatcher`, sans-IO; [tests/postgres/carrier.ts](../../tests/postgres/carrier.ts) drives them from a test loop, and [bench/postgres/main.ts](../../bench/postgres/main.ts) measures them.

Each stage below is one pull request (the language stage may need more), opened finished and merged per [AGENTS.md](../../AGENTS.md).

## Plaintext past uWebSockets.js

Done in `34282c6e` on `claude/multithread-http-server-design-5jqc3h`. Callgrind put [std/net/http1.ts](../../std/net/http1.ts) at 10,941 user instructions per pipelined plaintext request; it is 7,146 now.

| Connections | Nish before | Nish after | uWebSockets.js | noise |
| ---: | ---: | ---: | ---: | ---: |
| 256 | 589k | 857k | 607k | 5.7% |
| 1,024 | 573k | 733k | 522k | 1.1% |
| 4,096 | 548k | 694k | 560k | 4.0% |
| 16,384 | 451k | 608k | 552k | 6.6% |

One core of a shared 4-vCPU VM, wrk on the other three, medians of 3 rounds of 5 s.

## Plaintext follow-ups

- **The codegen bug.** `loadU8x16(buf, i)` inside a loop over `const buf = h.buf` emits `%n = bitcast i8*  to i8*`. A 25-line repro is in this session's summary; the fix is in `src/`, so it takes the `src/` checks (wasi, performance, goldens). Then inline `http1Load16` back into `http1TakeLine`.
- **The clock.** `HttpDate.current()` calls `Date.now()` per response, about 2% of server CPU under perf. Read it once per `Http1Server` serve call; a response sent outside a serve call (a deferred answer) still reads the clock.
- **The record.** [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md) still shows 324k against uWS's 412k from 2026-10-21. Refresh it with every twin built, and rerun `json`.

## Name the HTTP clients

WP49 section 8. A `refactor!` (the project stays on 0.x).

| Today | After |
| --- | --- |
| [std/net/http-client.ts](../../std/net/http-client.ts) `httpFetch`, `HttpClient` | `std/net/fetch.ts` `fetchSync`, `FetchSyncClient` |
| [std/net/http1.ts](../../std/net/http1.ts) | `std/net/http1-codec.ts` |
| [std/net/http1-client.ts](../../std/net/http1-client.ts) | `std/net/http1-client-codec.ts` |

35 files name the old paths. Regenerate `tests/self/goldens/checked/` and move every pointer (CLAUDE.md, "Moving where a fact lives").

## Non-blocking outbound calls

WP49 section 7. `Upstream` keeps keep-alive connections to one origin on `HttpHandler`'s loop. `get(req, path)` returns at once; `ready()`, `take()` and `release(r)` hand back finished responses tagged with `r.req`. It drives the `http1-client` codec, caps everything at start-up, and allocates nothing per call once warm.

The Postgres carrier is the same shape over `PgPool` and `PgBatcher`: what `tests/postgres/carrier.ts` does for a test, as a std module on the handler's loop. Both are attacker-facing and land with their `docs/security/` records.

## Every TFB test type

WP39 E7 and E8 on the carrier. `db`, `query` and `update` batch queries from every request in flight into one execution (`PgBatcher`), as the strongest entries do. `cached-query` fills a `Map` at start-up. `fortune` needs an escape for TFB's five characters, a byte sort, and the Japanese row passed through untouched.

Prefork pins worker `k` to CPU `k` and steers each connection to the worker on the CPU that received it (`SO_INCOMING_CPU`, or a reuseport CBPF program).

No rank is claimed from a client that shares the server's machine. Submitting to TFB stays the owner's call (WP39 D1, WP49 D6).

## Regions

[docs/wp46-long-running-memory.md](../../docs/wp46-long-running-memory.md) stages 1 and 2, as that note's stage table says. A task's allocations go to its own region, freed when it ends (WP49 section 5), so this blocks the language stage.

## async and await in the language

WP49 sections 2 and 3:
- `await` takes only a direct call to an `async` function, and `spawn` and `awaitAll` take only such calls, so no expression has a promise type.
- A cycle through `await` is refused.
- Each `async` function becomes a frame struct plus a resume function. An awaited callee's frame nests in its caller's, so a task is one block of a size the compiler knows.
- The executor resumes a task through a generated `switch` over task kinds, not a function pointer.
- A program with no `async` function compiles byte for byte as before.

## The executor and the async server

WP49 section 4:
- One executor per process, on `pollWait`. An epoll entry carries a task index and a generation.
- `serve` spawns one task per request, each in its own region.
- `fetch` and the Postgres pool become async wrappers over `Upstream` and the carrier.
- Cancellation answers every later `await` with the call's own failure. The task runs to its end and its region is freed.
- `--profile wasm` refuses `async`.

## The async entry

The gate D1 was accepted on. The `async` entry runs in the same interleaved rounds as the explicit one, on plaintext, json and db. Outside the noise band, the lowering is fixed before the feature ships.

## Out of scope

Promises as values, `.then`, `Promise.all` over an array, `for await`, moving a waiting task between processes or threads, `async` on wasm, and the handler over HTTP/2 and HTTP/3 (WP43).

## Verification

Per stage, before pushing:

```bash
npm run check
npm run lint
node tests/run.js <section>            # net_http1, tfb, net_handler, net_loopback, http_, std_postgres, …
node tests/self/goldens.js --update    # after any std/ or src/ change
node scripts/security-scope.mjs        # a new std/net module or runtime unit
node docs/check-links.mjs
```

A `src/` stage also runs `node tests/run.js wasi` (`WASI_SYSROOT=/usr`) and `node tests/run.js performance`. CI's four `test` shards are the full gate.
