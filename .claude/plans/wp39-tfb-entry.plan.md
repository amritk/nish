---
name: WP39 E2 and E5 — TCP_NODELAY and a TechEmpower-shaped json/plaintext entry
overview: Add TCP_NODELAY as flag 2 of tcpListenFlags (E2), then build bench/techempower/, a one-core Http1Server program answering TFB's /json (on JsonWriter) and /plaintext with Server and Date headers, with its verifier checks in npm test and wrk numbers against the HTTP twins in docs/BENCHMARKS.md (E5).
stages:
  - id: tcp-nodelay
    title: "feat(runtime): TCP_NODELAY on accepted sockets, as tcpListenFlags flag 2"
    goal: A listener opened with tcpListenFlags flag 2 hands out accepted sockets with TCP_NODELAY set; flags 0 and 1 behave exactly as today
    verification: node tests/run.js net_tcp && npm run check && npm run lint
    todos:
      - id: nodelay-runtime
        content: Accept flag bit 2 in nish_tcp_listen_flags (runtime/runtime-net.c) and set TCP_NODELAY on every socket tcpAccept returns from such a listener — see TCP_NODELAY
      - id: nodelay-tests
        content: Add tests/link/net_tcp_nodelay* cases proving the option is set (getsockopt reads 1) on an accepted socket, flags 1|2 together, and that bit 4 and up is still -22 — see TCP_NODELAY
      - id: nodelay-docs
        content: Update the tcpListenFlags row in docs/LANGUAGE.md, the nish:net guide page, and the RT-17 row of docs/security/runtime.md — see TCP_NODELAY
  - id: tfb-entry
    title: "feat(bench): a TechEmpower-shaped json and plaintext entry, measured against the HTTP twins"
    goal: bench/techempower/ is a one-core Nish program answering TFB's json and plaintext exactly as the verifier wants, pinned by a tests/link case, with wrk numbers against the twins in docs/BENCHMARKS.md
    verification: node tests/run.js tfb && npm run check && npm run lint && bash bench/techempower/run.sh --quick
    todos:
      - id: entry-server
        content: Write bench/techempower/main.ts — one pollWait loop on Http1Server, /json serialized per request with JsonWriter, /plaintext, Server and Date (HttpDate) headers, a pass arena per loop pass — see The entry
      - id: entry-verifier
        content: Add tests/link/tfb_* cases that drive the entry's handler over loopback and check the TFB verifier's header and body rules, pipelined plaintext, and a flat Arena.used() — see Verifier checks
      - id: entry-tfb-files
        content: Add bench/techempower/Dockerfile, benchmark_config.json and README.md in the upstream layout, unsubmitted — see TFB files
      - id: entry-harness
        content: Add bench/techempower/run.sh (and a wrk pipeline.lua) timing the entry, a byte-identical copy of it, and every built twin on /plaintext (16-deep pipelined) and /json, interleaved — see Measurement
      - id: entry-nodelay
        content: Once tcp-nodelay is on main, measure the entry with and without flag 2 against the noise band and keep the faster as the default — see Measurement
      - id: entry-numbers
        content: Record the tables in docs/BENCHMARKS.md and update docs/wp39-http-server.md (E1–E5 status, multi-core as a follow-up behind the prefork supervisor of #719) — see Recording
---

## Context

WP39 ([docs/wp39-http-server.md](../../docs/wp39-http-server.md)) orders the TechEmpower entry as E1–E4 in parallel, then E5. On `main` at `c8a00d6`: E1 is built (`tcpListenFlags`, `SO_REUSEPORT`, #733), E3 is built (`JsonWriter` in [std/json.ts](../../std/json.ts)), E4 is built (`httpDateWrite` in [std/net/http-fields.ts](../../std/net/http-fields.ts), `HttpDate` in [std/net/http1-server.ts](../../std/net/http1-server.ts)). **E2 is not**: nothing in `runtime/`, `src/` or `std/` sets `TCP_NODELAY`. The note's own status line ("Nothing here is built") is stale.

Another `/feature` run, multicore-http (#719), is live. Its `process-n12` (#742) and its pending `prefork` and `bench-measure` stages own `runtime/runtime-os.c`, `std/net/prefork.ts`, `bench/http1-server.ts` and `bench/README.md`. This plan touches none of those. `docs/LANGUAGE.md`, `docs/guide/` and the generated goldens are shared with #742 across runs; a conflict there is resolved by merging `main` and regenerating, never by hand.

## Approach

- **E2 is a flag, not a default.** `tcpListenFlags` bit `2` turns `TCP_NODELAY` on for every socket accepted from that listener. Flags `0` and `1` stay byte-for-byte what they are, so no existing program changes behaviour. WP39 says "on every accepted socket, or as a flag, whichever the measurement favours"; the flag lets E5 measure both from one binary, and the entry's default is whatever that measurement favours.
- **E5 is one core.** It is one process, one `pollWait` loop, until #719's prefork supervisor (`std/net/prefork.ts`) lands. Multi-core gets a follow-up line in WP39 and is not built here.
- **Submission is out.** The Dockerfile and `benchmark_config.json` are written in the upstream layout and nothing is sent upstream: WP39 D1 makes submitting the owner's call.

## TCP_NODELAY

**Owns:** `runtime/runtime-net.c`, `runtime/nish.d.ts`, `src/nish-modules.ts`, `tests/link/net_tcp_nodelay*/**`, `tests/cases/net_tcp_nodelay*`, `tests/cases/reject_net_nodelay*`, `tests/run.js`, `docs/LANGUAGE.md`, `docs/guide/**`, `docs/security/**`, `docs/IR_COOKBOOK.md`, and the generated files below.

- `nish_tcp_listen_flags` (`runtime/runtime-net.c:245`) refuses `flags > 1` today. Widen it to bits `1|2`; any other bit, a negative `flags` included, stays `-22` before a socket is made.
- Set the option where it is guaranteed on every platform the runtime supports: on each socket `tcpAccept` returns from a flag-2 listener (Linux inherits it from the listener, macOS/BSD do not reliably; do not rely on inheritance). Record the flag on the listener however the runtime already tracks per-fd state, or by setting it on the listener *and* each accepted socket — the worker picks and says why in the PR. A failed `setsockopt` is an error code, not ignored.
- A test that only checks the call returns `0` is not a test of this. The link case reads the option back (`getsockopt(TCP_NODELAY)`) from the accepted socket — through a small C helper the case links, or whatever the existing `net_tcp_reuseport` cases use to observe socket state — and prints it.
- wasm32: `tcpListenFlags` is already refused (NL2404); confirm the refusal still covers the new bit and the freestanding `--profile wasm` route (CLAUDE.md).
- The `tcpListenFlags` row in `docs/LANGUAGE.md` (around line 6786) names flag `2`; the `nish:net` guide page shows it; `docs/security/runtime.md`'s RT-17 (the `SO_REUSEPORT` row) gains the new option, or a sibling row.

## The entry

**Owns:** `bench/techempower/**`, `tests/link/tfb_*/**`, `docs/BENCHMARKS.md`, `docs/wp39-http-server.md`, and the generated files below. Not `tests/run.js` (link cases are discovered from their directory), not `std/`, not `bench/http-twins/**`, not `bench/http1-server.ts`. If the entry cannot be written without a `std/` change, open the PR as a draft and say what is missing.

`bench/techempower/main.ts`, one `pollWait` loop on `Http1Server`:

| Request | Answer |
| --- | --- |
| `GET /json` | 200, `Content-Type: application/json`, `{"message":"Hello, World!"}`, written by a `JsonWriter` into a reused `u8[]` **on every request** (TFB forbids caching the serialization) |
| `GET /plaintext` | 200, `Content-Type: text/plain`, `Hello, World!` |
| anything else | 404 |

Every response carries `Server: nish` (or similar) and `Date` from `HttpDate`, refreshed at most once a second, and `Content-Length`. Pipelined requests (16 deep) answer in order, a burst in one write as `Http1Server.flush` already does. A pass scope (`using a = arena()`) around each loop pass keeps `Arena.used()` flat. The handler is a module of its own so the link case and `main.ts` share it. Port and the nodelay choice come from argv, like the twins' `serve <port>` contract (`bench/http-twins/README.md`), so the harness can start it the same way.

## Verifier checks

`tests/link/tfb_*`: a link program that imports the entry's handler, serves it on a loopback port, and drives it with a client in the same loop (as `tests/link/net_http1_server` does). It checks the TFB verifier's rules for `json` and `plaintext`: status, exact body bytes, `Content-Type`, `Content-Length` equal to the body, `Server` present, `Date` a valid IMF-fixdate, a 16-deep pipelined `plaintext` burst answered in order, the JSON re-serialized per request (two requests differ in no byte but are both produced by the writer — pin it by counting writer calls, not by trust), and `Arena.used()` equal across 200 warmed requests. Plus at least one negative: a malformed request answers 400 and the server keeps serving.

## TFB files

`bench/techempower/Dockerfile` and `benchmark_config.json` in the shape TechEmpower/FrameworkBenchmarks expects (`frameworks/<Language>/<name>/`), with `json_url` and `plaintext_url`, approach `Realistic` or `Stripped` stated honestly, and `README.md` saying it is unsubmitted and why (WP39 D1). The Dockerfile builds from a released `nish` (npm or `install.sh`); building the image in CI is not required.

## Measurement

`bench/techempower/run.sh` follows `bench/http.mjs`'s method: the server pinned to CPU 0, the client (`wrk`, installed with `apt-get install wrk` if absent; `h2load --h1` as the fallback) on the other CPUs, rounds interleaved, min / median reported.

- Contestants: the entry, a byte-identical copy of the entry binary (the noise band), and every twin `bash bench/http-twins/build.sh` builds (`build/http-twins/<name>/serve <port>`). A twin that does not build is a row reading n/a, not a failure.
- `/plaintext`: wrk with a Lua script pipelining 16 requests per connection, at TFB's plaintext concurrencies (256, 1024, 4096, 16384 — clamp and say so if the box cannot open that many).
- `/json`: plain wrk at TFB's json concurrencies (16, 32, 64, 128, 256, 512). The twins' `/json` answers `{"message":"Hello, World!","n":<n>}`, eight bytes more and a counter: state that difference beside the table, do not hide it.
- `--quick` runs one round at one concurrency per test, for the stage's verification line; the recorded tables use the full run.
- Once `tcp-nodelay` is on `main` (the lead says when), merge `main`, run the entry with flag `1|2` against without it in the same interleaved rounds, and keep whichever is outside the noise band as the default; if neither is, keep it on (what most TFB entries do) and say "within noise".

## Recording

- `docs/BENCHMARKS.md` gets a "TechEmpower json and plaintext" section: machine, cores, client/server pinning, req/s per concurrency, per contestant, the noise band, the nodelay comparison, and the exact command. The 4-core box shares the machine with the client; label it so.
- `docs/wp39-http-server.md`: the status line and §1 table say E1–E5 are built and where; E5 gets a follow-up line — multi-core via #719's prefork supervisor once it lands — and nothing more.
- The squash subject and body follow CLAUDE.md's changelog rules, `Measured:` carrying the figures themselves and the noise band.

## Generated files

`tests/self/goldens/**`, `tests/differential/goldens/**`, `tests/cases/*.ll`, `tests/link/**/*.ll` and `expected.ir`, the cookbook runtime prelude in `docs/IR_COOKBOOK.md`, `CHANGELOG.md`. Regenerated with the repo's tooling, never edited or hand-merged.

## Out of scope

- Multi-core (prefork, `SO_REUSEPORT` launcher, N12) — #719.
- `db`, `query`, `update`, `cached-query`, `fortune` (E6–E8).
- Submitting to TechEmpower (D1, the owner's call).
- Changing `bench/http1-server.ts`, `bench/README.md`, the twins, or making nodelay the default for `tcpListen`.

## Verification

- Both stages: `npm run check`, `npm run lint`, an undegraded `npm test` before the PR and before merge.
- `tcp-nodelay`: `node tests/run.js net_tcp`; it changes `src/` only if the flag is checked at compile time — if it does, also `node tests/run.js wasi` and `node tests/run.js performance`.
- `tfb-entry`: `node tests/run.js tfb`, `bash bench/techempower/run.sh --quick`.
