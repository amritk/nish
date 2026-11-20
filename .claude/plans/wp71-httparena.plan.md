---
name: WP71 — an HttpArena entry, and what it asks of std/net
overview: TechEmpower is archived and HttpArena took its place. This package builds the entry in bench/httparena/ on the 10 scored profiles that wait on nothing, joins the nine that wait on other packages as each lands, and checks io_uring under the façade, before the owner decides whether to enter it. It runs nothing HttpArena-specific of its own; HttpArena's validate.sh is the entry's check.
spec: docs/wp71-httparena.md
priority: 90
labels: [ready]
issue: 2015
stages:
  - id: s1-entry
    title: WP71 S1 — bench/httparena/ on what is built, the 10 scored profiles that wait on nothing, passing validate.sh
    goal: bench/httparena/ is a framework entry in HttpArena's layout, standard mode, serving the 10 scored profiles of the spec's §3 that wait on no other package with one pinned worker a core, and HttpArena's validate.sh passes on it.
    verification: node tests/run.js httparena_entry passes with a nonzero case count; validate.sh nish passes in an HttpArena checkout at the commit bench/httparena/README.md names; npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2020
    todos:
      - id: entry-layout
        content: Add bench/httparena/ with a Dockerfile from a released compiler, a meta.json (type emerging, standard mode, middleware declared missing) and a README — see WP71 S1
        status: pending
      - id: entry-h1
        content: Serve baseline, limited-conn, async, latency-1m and latency-10k on port 8080 through nish/net/http-server under nish/net/prefork — see WP71 S1
        status: pending
      - id: entry-json-comp
        content: Serve json-comp from /data/dataset.json with JsonWriter and gzip through nish/net/http-compress — see WP71 S1
        status: pending
      - id: entry-h2-h3
        content: Serve baseline-h2 and baseline-h3 on 8443 and baseline-h2c and json-h2c on 8082 through listenHttp2Tls, listenHttp3 and listenH2c — see WP71 S1
        status: pending
      - id: entry-reference
        content: Join the reference-only pipelined and async-db profiles, async-db through nish/net/postgres, and not fortunes (D4) — see WP71 S1
        status: pending
      - id: entry-workers
        content: Run one prefork worker a core, each pinned with setCpuAffinity and steered by CPU (tcpListenFlags flag 4, QUIC by connection ID) — see WP71 S1
        status: pending
      - id: entry-link-test
        content: Add tests/link/httparena_entry checking every route's answer over loopback, as tests/link/tfb_entry does — see WP71 S1
        status: pending
      - id: entry-validate
        content: Run validate.sh on the entry and record the HttpArena commit it passed at in bench/httparena/README.md — see WP71 S1
        status: pending
  - id: s2-tls
    title: WP71 S2a — json-tls and 8gbit, HTTP/1.1 over TLS on port 8081, after WP39 G7's TLS on the façade
    goal: The entry serves json-tls and 8gbit on port 8081 through the façade's HTTP/1.1-over-TLS listener and passes validate.sh for both.
    verification: node tests/run.js httparena_entry passes with the TLS routes; validate.sh nish passes with both profiles in meta.json
    labels: [deferred]
    issue: 2021
    todos:
      - id: tls-routes
        content: Serve json-tls and 8gbit's POST /echo on 8081 through the façade's HTTP/1.1-over-TLS listener and add them to meta.json — see WP71 S2a
        status: pending
      - id: tls-link-test
        content: Extend tests/link/httparena_entry to the TLS routes — see WP71 S2a
        status: pending
  - id: s2-ws
    title: WP71 S2b — echo-ws, echo-ws-pipeline and echo-ws-limited, after WP39 G7's WebSocket on the façade
    goal: The entry upgrades /ws on port 8080 through the façade's WebSocket, echoes text, and passes validate.sh for the three echo profiles.
    verification: node tests/run.js httparena_entry passes with the WebSocket route; validate.sh nish passes with the three profiles in meta.json
    labels: [deferred]
    issue: 2022
    todos:
      - id: ws-route
        content: Upgrade /ws on 8080 through the façade's WebSocket, echo text frames, and add the three profiles to meta.json — see WP71 S2b
        status: pending
      - id: ws-link-test
        content: Extend tests/link/httparena_entry to the echo — see WP71 S2b
        status: pending
  - id: s2-grpc
    title: WP71 S2c — unary-grpc and unary-grpc-tls, after WP72's gRPC
    goal: The entry answers BenchmarkService/GetSum over TLS on 8443 and over cleartext h2c on 8080 beside HTTP/1.1, and passes validate.sh for both.
    verification: node tests/run.js httparena_entry passes with the gRPC calls; validate.sh nish passes with both profiles in meta.json
    labels: [deferred]
    issue: 2024
    todos:
      - id: grpc-tls
        content: Answer GetSum through nish/net/grpc on the façade's 8443 listener and join unary-grpc-tls — see WP71 S2c
        status: pending
      - id: grpc-cleartext
        content: Answer GetSum over h2c on 8080 beside HTTP/1.1 through WP39 G7's h2c-by-preface and join unary-grpc — see WP71 S2c
        status: pending
      - id: grpc-link-test
        content: Extend tests/link/httparena_entry to both calls — see WP71 S2c
        status: pending
  - id: s2-static
    title: WP71 S2d — static-h2 and static-h3, after WP43 S3's static files
    goal: The entry serves the 20 files of /data/static/ over HTTP/2 and HTTP/3 through nish/net/static, with br or gzip when offered, and passes validate.sh for both.
    verification: node tests/run.js httparena_entry passes with the static routes; validate.sh nish passes with both profiles in meta.json
    labels: [deferred]
    issue: 2025
    todos:
      - id: static-routes
        content: Serve /data/static/ through nish/net/static on 8443 over HTTP/2 and HTTP/3 and join static-h2 and static-h3 — see WP71 S2d
        status: pending
      - id: static-link-test
        content: Extend tests/link/httparena_entry to a static file over both versions — see WP71 S2d
        status: pending
  - id: s2-br
    title: WP71 S2e — br for json-comp, after WP43 S4's br coding on WP73's encoder
    goal: json-comp answers br when the request offers it, and its bytes per response are recorded against the gzip-only entry's.
    verification: node tests/run.js httparena_entry passes with a br response; validate.sh nish passes; bench/httparena/README.md records both codings' bytes per response
    labels: [deferred]
    issue: 2027
    todos:
      - id: br-coding
        content: Offer br on json-comp through nish/net/http-compress's br coding (WP43 S4, issue 2006) when Accept-Encoding asks for it — see WP71 S2e
        status: pending
      - id: br-size
        content: Record json-comp's bytes per response with br and with gzip in bench/httparena/README.md — see WP71 S2e
        status: pending
  - id: s3-iouring
    title: WP71 S3 — io_uring under the nish/net/http-server façade, checked and measured on the CPU-scored profiles
    goal: A tests/link case proves the façade's carriers run on ring slots when its listener is opened with tcpListenFlags flag 8, and the CPU-scored profiles' routes are measured with and without the rings.
    verification: node tests/run.js net_http_server_ring passes with a nonzero case count; docs/BENCHMARKS.md has the with-and-without rows with the machine, the commit and the noise band; npm run check && npm run lint
    issue: 2028
    todos:
      - id: ring-facade-test
        content: Add tests/link/net_http_server_ring opening the façade's listener with tcpListenFlags flag 8 and proving its carriers take ring slots — see WP71 S3
        status: pending
      - id: ring-facade-fix
        content: Fix whatever the test finds in std/net/http-server.ts so the façade runs on the rings it is given — see WP71 S3
        status: pending
      - id: ring-measure
        content: Measure latency-1m's and latency-10k's route at a fixed rate with and without the rings, CPU per request, p99 and mean, and record both in docs/BENCHMARKS.md — see WP71 S3
        status: pending
  - id: s4-enter
    title: WP71 S4 — enter the entry in HttpArena
    goal: Once S1 lands and the owner confirms (D3 decided for after S1), a pull request to MDA2AV/HttpArena adds frameworks/nish/ from bench/httparena/.
    verification: the owner's answer is recorded on the issue; if entering, the HttpArena pull request passes its validate.sh and its benchmark comment's figures are recorded in docs/BENCHMARKS.md
    labels: [needs-decision]
    issue: 2030
    todos:
      - id: enter-decide
        content: Once S1 has landed, ask the owner to confirm entering, with every joined profile listed (D3, decided for after S1) — see WP71 S4
        status: pending
      - id: enter-pr
        content: Copy bench/httparena/ into frameworks/nish/ in a fork of MDA2AV/HttpArena and open the pull request, only on the owner's yes — see WP71 S4
        status: pending
  - id: gateway
    title: WP71 S5 — the gateway board, gateway-h2, gateway-h3 and production-stack
    goal: The entry joins HttpArena's gateway board behind its proxy, and production-stack reads Redis through a std/ client that does not exist yet.
    verification: validate.sh nish passes for the gateway profiles joined
    labels: [deferred]
    issue: 2031
    todos:
      - id: gateway-h2-h3
        content: Join gateway-h2 and gateway-h3 behind HttpArena's proxy — see WP71 S5
        status: pending
      - id: gateway-redis
        content: Plan a Redis client for std/net in its own package, then join production-stack on it — see WP71 S5
        status: pending
---

# WP71: an HttpArena entry, and what it asks of `std/net`

## Context

TechEmpower archived its Framework Benchmarks on 2026-03-24. [HttpArena](https://www.http-arena.com/) took its place: one machine, entries added by pull request and benchmarked on that pull request, a leaderboard over HTTP/1.1, HTTP/2, HTTP/3, gRPC and WebSocket. The spec is [`docs/wp71-httparena.md`](../../docs/wp71-httparena.md): how it scores (§1), the rules that bind a framework entry (§2), the 19 scored profiles against what is built (§3), the stages (§4) and the decisions (§5). Breadth is worth more on that board than the last 10% on one profile, so the order is every family first.

This package builds the entry and the features it needs. It does not stand up HttpArena's machine or measure the leaders: HttpArena's own `validate.sh` checks the entry, and HttpArena's machine measures it when it is entered (S4). HttpArena's facts move; each stage re-reads the site and the harness before it relies on one.

## Approach

The spec's decisions are taken as written:

| | Decision |
| --- | --- |
| D1 | A framework entry of type `emerging`, **standard mode**. Tuned mode is a second entry once standard is measured. |
| D2 | The entry lives in `bench/httparena/`, beside [`bench/techempower/`](../../bench/techempower/), copied into `frameworks/nish/` when entered. |
| D3 | Entering is the owner's call each time — S4 carries it as an open decision. |
| D4 | Join the reference-only `pipelined` and `async-db`; **not `fortunes`** (needs a template engine `std/` lacks). |
| D5 | `meta.json` declares routing, request and response; middleware missing until [WP43](../../docs/wp43-http-app-layer.md) stage 5 lands. |

**The S2 stages wait on other packages.** Each opens with a **Waits on** line naming the package (its issue where one exists, else its design note) and is labelled `deferred` so no agent builds it early. When that dependency closes, the label comes off and the stage is ready.

## WP71 S1 — bench/httparena/ on what is built, the 10 scored profiles that wait on nothing, passing validate.sh

Ten of the 19 scored profiles wait on no other package ([§3](../../docs/wp71-httparena.md#3-the-profiles-against-what-is-built)). `bench/httparena/` serves them on [`std/net/http-server.ts`](../../std/net/http-server.ts) (`nish/net/http-server`) under [`std/net/prefork.ts`](../../std/net/prefork.ts):

| Family | Profiles | Port | Through |
| --- | --- | --- | --- |
| HTTP/1.1 | `baseline`, `limited-conn`, `async`, `latency-1m`, `latency-10k` | 8080 | `listenHttp1`; `async` answers after a real timer, held past the turn ([http-one-handler.md §3.3](../../docs/http-one-handler.md#33-streams-slots-and-late-answers)) |
| HTTP/1.1 | `json-comp` | 8080 | `JsonWriter` over `/data/dataset.json`, gzip through [`std/net/http-compress.ts`](../../std/net/http-compress.ts) |
| HTTP/2 | `baseline-h2` | 8443 | `listenHttp2Tls`, certificates from `/certs/` |
| HTTP/2 | `baseline-h2c`, `json-h2c` | 8082 | `listenH2c` |
| HTTP/3 | `baseline-h3` | 8443 | `listenHttp3` |

Also the reference-only `pipelined` and `async-db` (D4), `async-db` one query a request on `nish/net/postgres` against `DATABASE_URL`. Not `fortunes`.

- `Dockerfile` installs a released compiler, as `bench/techempower/`'s do; `meta.json` declares type `emerging`, standard mode, the profiles joined, and middleware missing (D5).
- Standard mode: no precomputed or URL-cached body ([§2](../../docs/wp71-httparena.md#2-the-rules-that-bind-the-entry)).
- **Workers.** One prefork worker for each CPU the container is given, each pinned with `setCpuAffinity` and its connections steered to its CPU by the reuseport program behind `tcpListenFlags`'s flag 4 ([`runtime/runtime-net.c`](../../runtime/runtime-net.c)); QUIC steers by connection ID ([h3-multicore.md](../../docs/h3-multicore.md)). HttpArena gives the server 64 CPUs; the entry takes the count from the container, not a constant.
- `tests/link/httparena_entry` checks every route's answer over loopback, as [`tests/link/tfb_entry`](../../tests/link/tfb_entry) does for TechEmpower's.
- Done when `validate.sh nish` passes in an HttpArena checkout with `bench/httparena/` copied into `frameworks/nish/`; `bench/httparena/README.md` names the HttpArena commit.

## WP71 S2a — json-tls and 8gbit, HTTP/1.1 over TLS on port 8081, after WP39 G7's TLS on the façade

**Waits on** [WP39](../../docs/wp39-http-server.md) G7's HTTP/1.1 over TLS on the `nish/net/http-server` façade ([F2](../../docs/http-one-handler.md#42-finding-f2-one-tls-port-for-http11-and-http2) puts `Http1TlsServer` outside it today).

- `json-tls`: the `json-comp` JSON over HTTP/1.1 on TLS, port 8081.
- `8gbit`: `POST /echo`, 10 KiB at a fixed 50,000 req/s, scored on CPU per request and latency.

Both join `meta.json`, `tests/link/httparena_entry` covers their routes, and `validate.sh` passes with them.

## WP71 S2b — echo-ws, echo-ws-pipeline and echo-ws-limited, after WP39 G7's WebSocket on the façade

**Waits on** [WP39](../../docs/wp39-http-server.md) G7's WebSocket on the façade's HTTP/1.1 listener ([`std/net/websocket.ts`](../../std/net/websocket.ts) runs on `Http1Server` today, not on the façade).

`echo-ws`, `echo-ws-pipeline` and `echo-ws-limited`: an upgrade on `/ws`, port 8080, text frames echoed. They join `meta.json`, `tests/link/httparena_entry` covers the echo, and `validate.sh` passes with them. The WebSocket board takes no completeness penalty.

## WP71 S2c — unary-grpc and unary-grpc-tls, after WP72's gRPC

**Waits on** [WP72](../../docs/wp72-grpc.md) (#2008: `nish/net/protobuf`, trailers on the façade, unary calls in `nish/net/grpc`). `unary-grpc` also waits on WP39 G7's open question: whether the façade's HTTP/1.1 listener takes an h2c peer by its preface, which [http-one-handler.md §4](../../docs/http-one-handler.md#4-h2c-prior-knowledge-only) rules out today.

- `unary-grpc-tls`: `BenchmarkService/GetSum` over TLS on 8443.
- `unary-grpc`: the same over h2c on 8080, beside HTTP/1.1. If the owner keeps "no sniffing", this profile is not joined and the stage records why.

## WP71 S2d — static-h2 and static-h3, after WP43 S3's static files

**Waits on** [WP43](../../docs/wp43-http-app-layer.md) stage 3 (#485), `nish/net/static` with a cache that follows the disk and `.br`/`.gz` siblings.

`static-h2` and `static-h3`: the 20 files of `/data/static/` on 8443 over HTTP/2 and HTTP/3, br or gzip when the request offers it. Standard mode allows a cache only if the framework owns it and it follows the disk ([§2](../../docs/wp71-httparena.md#2-the-rules-that-bind-the-entry)).

## WP71 S2e — br for json-comp, after WP43 S4's br coding on WP73's encoder

**Waits on** [WP43](../../docs/wp43-http-app-layer.md) stage 4 (#2006), `br` as a response coding in `nish/net/http-compress`, on [WP73](../../docs/wp73-brotli.md)'s Brotli encoder.

`json-comp`'s rate is multiplied by (smallest bytes per response ÷ ours)², so a smaller body is worth more than a faster one. Offer br when `Accept-Encoding` asks for it, and record the bytes per response with br beside gzip's in `bench/httparena/README.md`.

## WP71 S3 — io_uring under the nish/net/http-server façade, checked and measured on the CPU-scored profiles

[WP63](../../docs/wp63-iouring-net.md) S4 measured 29.5% less CPU a request under `HttpHandler` at 96,000 connections, the rings taken through the listener (`tcpListenFlags`'s flag 8, `HandlerLimits.listen`). The façade serves a listener the program makes, but no `tests/link/net_http_server*` case opens its listener with flag 8, so whether its carriers run on ring slots is untested.

1. `tests/link/net_http_server_ring`: the façade over a flag-8 listener, proving its carriers take ring slots. Fix in [`std/net/http-server.ts`](../../std/net/http-server.ts) what it finds.
2. Measure the CPU-scored profiles' route (`/baseline11` at a fixed rate, as `latency-1m` and `latency-10k` drive it) with and without the rings: CPU per request, p99 and mean latency, the three HttpArena scores them on, with their noise band, on the machine the `docs/BENCHMARKS.md` table names. `8gbit` joins the measurement once S2a has landed; until then the stage records it as not measured. If the rings win, the entry opens its listeners with flag 8.

## WP71 S4 — enter the entry in HttpArena

A pull request to [MDA2AV/HttpArena](https://github.com/MDA2AV/HttpArena) adding `frameworks/nish/` from `bench/httparena/`; HttpArena benchmarks it on its own machine and posts a public number. Its `CODEOWNERS` asks two maintainers to review every file.

### Decision (D3)

**Decided: enter after S1**, with every profile that waits on nothing joined; HttpArena's `/benchmark` comment on the pull request is the first figure at its size, and the entry is updated as each S2 stage lands. Because a public number is the owner's call each time, this stage stays `needs-decision`: the owner confirms before the pull request opens, and again before each update to it.

## WP71 S5 — the gateway board, gateway-h2, gateway-h3 and production-stack

`gateway-h2`, `gateway-h3` and `production-stack` run the server behind nginx or a peer, on a board of their own, not in the overall score. `production-stack` reads Redis, and `std/` has no Redis client; that client is its own package. Deferred until the overall board is joined.

## Out of scope

- **`fortunes`** (D4): standard mode wants it rendered by "a real template engine", which `std/` does not have.
- **A rig of HttpArena's size, and the leaders measured on it.** HttpArena's own machine measures the entry when it is entered.
- **Tuned mode** (D1): a second entry once standard is measured.
- The work of the packages S2 waits on (WP39 G7, WP43 stage 3, WP72, WP73): each is planned in its own package.

## Tests

- `tests/link/httparena_entry` (S1, extended by each S2 stage): every route's status, headers and body over loopback, mirroring [`tests/link/tfb_entry`](../../tests/link/tfb_entry).
- `tests/link/net_http_server_ring` (S3), mirroring [`tests/link/net_http_server_carriers`](../../tests/link/net_http_server_carriers).
- HttpArena's own `validate.sh` for every joined profile.

## Verification

```bash
node tests/run.js httparena_entry
```

```bash
node tests/run.js net_http_server_ring
```

```bash
npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
```

In an HttpArena checkout at the commit `bench/httparena/README.md` names, with `bench/httparena/` copied to `frameworks/nish/`:

```bash
./scripts/validate.sh nish
```
