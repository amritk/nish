---
name: WP39 — the HTTP server, follow-ups and open decisions
overview: Every WP39 roadmap stage is built except G9 (WebTransport pin, deferred) and three G7 additions to the nish/net/http-server façade that WP71's HttpArena profiles need (HTTP/1.1 over TLS, WebSocket, h2c by preface). Open issues add HTTP/1 pipelining, bench-record gaps, an HTTP/3 pacer cost and a few acceptance gaps. E9, the TechEmpower submission, is retired.
spec: docs/wp39-http-server.md
priority: 80
labels: [ready]
issue: 1850
stages:
  - id: g7-h1-tls
    title: WP39 G7 — HTTP/1.1 over TLS on the nish/net/http-server façade
    goal: HttpServer gets listenHttp1Tls, which runs Http1TlsServer beside listenHttp2Tls on its own port, so one handler answers HTTP/1.1 over TLS as it answers every other version.
    verification: node tests/run.js net_http_server && node tests/run.js net_http1_server && node tests/run.js net && node scripts/security-scope.mjs && npm run lint
    issue: 2010
    todos:
      - id: g7-h1-tls-listener
        content: Add HttpServer.listenHttp1Tls in std/net/http-server.ts over Http1TlsServer, with its slots, limits, Alt-Svc and timeouts as listenHttp1 has them — see WP39 G7 HTTP/1.1 over TLS
        status: pending
      - id: g7-h1-tls-tests
        content: Add tests/link/net_http_server_h1_tls with a positive round trip and an ALPN-mismatch negative, plus the warmed-request zero-allocation check — see WP39 G7 HTTP/1.1 over TLS
        status: pending
      - id: g7-h1-tls-docs
        content: Amend docs/http-one-handler.md §4.2 F2, docs/security/http-server.md and the docs/guide page for the façade — see WP39 G7 HTTP/1.1 over TLS
        status: pending
  - id: g7-websocket
    title: WP39 G7 — WebSocket on the façade's HTTP/1.1 listener
    goal: A program on nish/net/http-server accepts a WebSocket upgrade on an HTTP/1.1 listener (cleartext and, once g7-h1-tls lands, TLS) and sends and receives messages through the façade, as Http1Server's acceptWebSocket does today.
    verification: node tests/run.js net_http_server && node tests/run.js net_http1_server && node tests/run.js net && node scripts/security-scope.mjs && npm run lint
    issue: 2011
    todos:
      - id: g7-ws-api
        content: Add the façade's WebSocket surface in std/net/http-server.ts over Http1Connection.acceptWebSocket and its H1_WS_MESSAGE and H1_WS_CLOSE events — see WP39 G7 WebSocket
        status: pending
      - id: g7-ws-tests
        content: Add tests/link/net_http_server_ws with an echo round trip, a refused upgrade on an HTTP/2 or HTTP/3 request and a malformed-frame close — see WP39 G7 WebSocket
        status: pending
      - id: g7-ws-autobahn
        content: Run the Autobahn WebSocket suite against a façade echo server in the interop job — see WP39 G7 WebSocket
        status: pending
      - id: g7-ws-docs
        content: Record it in docs/http-one-handler.md, docs/security/http-server.md and the façade's docs/guide page — see WP39 G7 WebSocket
        status: pending
  - id: g7-h2c-preface
    title: WP39 G7 — an h2c peer taken by its preface on the façade's HTTP/1.1 listener
    goal: A listenHttp1 that opts in hands a connection whose first bytes are the 24-byte HTTP/2 preface to the h2c carrier and serves every other connection as HTTP/1.1, so one port speaks HTTP/1.1, WebSocket and cleartext HTTP/2.
    verification: node tests/run.js net_http_server && node tests/run.js net_http2_cleartext && node tests/run.js net && node scripts/security-scope.mjs && npm run lint
    issue: 2012
    todos:
      - id: g7-h2c-preface-option
        content: Add the opt-in to listenHttp1 in std/net/http-server.ts, off by default, that reads up to the preface's 24 bytes and routes the slot to Http2CleartextServer or Http1Server — see WP39 G7 h2c by preface
        status: pending
      - id: g7-h2c-preface-tests
        content: Add tests/link cases for an h2c peer, an HTTP/1.1 peer and a request starting PRI on an opted-in port, and an h2c peer refused on a default port — see WP39 G7 h2c by preface
        status: pending
      - id: g7-h2c-preface-docs
        content: Amend docs/http-one-handler.md §4 (no sniffing, unless opted in), docs/security/http-server.md and docs/security/http2-cleartext.md, and the façade's docs/guide page — see WP39 G7 h2c by preface
        status: pending
  - id: g9-webtransport-pin
    title: WP39 G9 — move WebTransport's pin when Chrome moves past the draft
    goal: The WebTransport draft pin follows Chrome's, with the interop job green against the new draft.
    verification: node tests/run.js webtransport && npm run lint
    status: pending
    labels: [deferred]
    issue: 1867
    todos:
      - id: g9-pin
        content: Move the draft pin in std/net webtransport once Chrome ships past it, and rerun the Chrome interop job — see WP39 G9
        status: pending
  - id: h1-pipelined-stream-end
    title: WP39 H1 — a streamed response finished by length must not drop the next pipelined request
    goal: An async streaming HttpHandler response that writes its full Content-Length body, yields, then ends keeps the next pipelined request, and both responses arrive in order.
    verification: node tests/run.js net_handler && node tests/run.js net_serve && node tests/run.js net_http1_server && npm run lint
    status: pending
    issue: 1556
    todos:
      - id: h1-pipelined-test
        content: Add a tests/link case with an async streaming handler, a fully written body, a deferred end and a pipelined second request — see WP39 H1 pipelined stream end
        status: pending
      - id: h1-pipelined-fix
        content: Add the unended(slot) check to HttpHandler.drive in std/net/handler.ts, as HttpServer.unended does in std/net/http-server.ts — see WP39 H1 pipelined stream end
        status: pending
  - id: http1-hot-block
    title: WP39 H1 — an inline read-buffer header and a slot-indexed hot block for http1-server
    goal: Both ideas are measured with bench/http1-conn and either adopted with a gain beyond the noise band or recorded as no gain.
    verification: node tests/run.js net_http1_server && bash bench/http1-conn/misses.sh && npm run lint
    status: pending
    issue: 1225
    todos:
      - id: inline-buffer-header
        content: Try the lent read buffer's start and capacity inline in the connection's hot block in std/net/http1-server.ts and measure D1 misses and ns per request — see WP39 H1 hot block
        status: pending
      - id: soa-hot-block
        content: Try a struct-of-arrays hot block on Http1Server indexed by slot and measure it the same way — see WP39 H1 hot block
        status: pending
      - id: hot-block-record
        content: Record both results in bench/http1-conn/README.md and docs/BENCHMARKS.md with the noise band — see WP39 H1 hot block
        status: pending
  - id: lazy-slots
    title: WP39 H1 — lazy Http1Server slots, the RSS gap and the throughput run left open after the first change
    goal: The RSS gap at 16,384 slots is accepted or removed, ping, query and body throughput are measured against the pre-change build with wrk, and the lazy-slot change reaches the TLS, HTTP/2 and HTTP/3 servers or is declined.
    verification: node bench/http.mjs --only startup --rounds 9 && node tests/run.js net && npm run lint
    status: pending
    issue: 744
    labels: [needs-decision]
    todos:
      - id: lazy-rss
        content: Make the bench server's per-slot state in bench/http1-server.ts lazy or record the 0.7 MB gap at 16,384 slots as accepted — see WP39 H1 lazy slots
        status: pending
      - id: lazy-throughput
        content: Run the ping, query and body throughput comparison with wrk on a quiet machine, with a base-against-base noise band — see WP39 H1 lazy slots
        status: pending
      - id: lazy-other-servers
        content: Apply lazy slots to Http1TlsServer, std/net/tls-tcp.ts, http2 and http3 servers, or record why not — see WP39 H1 lazy slots
        status: pending
  - id: h3-pacer-cost
    title: WP39 G5 — the HTTP/3 microsecond pacer's cost at 96 connections
    goal: The pacer's 100 B cost at c96 and c96m10 is re-measured on a quiet machine, profiled and either accepted, gated on the budget or reworked, with the decision recorded in docs/h3-latency.md.
    verification: node bench/h3-latency.mjs --runs 9 --baseline 5f983c9 --size 100 && node tests/run.js http3 && npm run lint
    status: pending
    issue: 700
    labels: [needs-decision]
    todos:
      - id: pacer-remeasure
        content: Re-measure every scenario the before-figures cover at 100 B and 4 kB with bench/h3-latency.mjs against its noise band — see WP39 G5 pacer cost
        status: pending
      - id: pacer-profile
        content: Profile pacerQuantum, quicListenerFlightTime and the microsecond refill at c96m10 and c96 in std/net/http3-server.ts — see WP39 G5 pacer cost
        status: pending
      - id: pacer-decide
        content: Accept the cost, skip pacing when a connection's budget is above the quantum, or rework the quantum, and record it in docs/h3-latency.md — see WP39 G5 pacer cost
        status: pending
  - id: date-header
    title: WP39 H1 — repeated Date fields and the HTTP/2 and HTTP/3 cost of the Date header
    goal: The outgoing field check either refuses a repeated date field or documents why not, and a load bench puts HTTP/2 and HTTP/3 Date cost inside the noise band or records it.
    verification: node tests/run.js net_http_fields && node tests/run.js net_http2_tls && node tests/run.js http1 && npm run lint
    status: pending
    issue: 696
    todos:
      - id: date-repeat
        content: Make httpFieldsCheckOutgoing in std/net/http-fields.ts refuse a repeated date field, and add its tests/link negative — see WP39 H1 Date header
        status: pending
      - id: date-h2h3-bench
        content: Measure the Date cost on HTTP/2 and HTTP/3 with bench/h2load.mjs and record it in docs/BENCHMARKS.md with a noise band — see WP39 H1 Date header
        status: pending
  - id: conduit-tail
    title: WP39 H1 — the Conduit coalesced-reads p99 tail and the stale submission README
    goal: The p99 regression against main is explained or recovered by the read pool's connection rule, and the submission README carries the post-coalescing figures.
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    issue: 966
    labels: [needs-decision]
    todos:
      - id: conduit-tail-measure
        content: Measure how many read connections open under the 4,000-user mix and try opening one whenever none is idle and the queue is non-empty, or a per-pool minimum — see WP39 H1 Conduit tail
        status: pending
      - id: conduit-readme
        content: Update the submission README figures that still read 233 to 246 microseconds and 34 microseconds HTTP, locating the file first — see WP39 H1 Conduit tail
        status: pending
  - id: bench-base-build
    title: WP39 H1 — make bench/http1-conn's --base comparison build the base and re-measure idle memory and throughput
    goal: node bench/http1-conn/run.mjs --base builds the base, and idle RSS and keep-alive throughput are re-measured base against main with a base-against-base noise band.
    verification: node bench/http1-conn/run.mjs --shape rss --rss 5 --connections 10000 --base 7d921842 && npm run lint
    status: pending
    issue: 1560
    todos:
      - id: base-shim
        content: Shim netWrite2 for older bases in bench/http1-conn/run.mjs or pin the comparison base — see WP39 H1 bench base build
        status: pending
      - id: base-remeasure
        content: Re-measure idle bytes per connection and keep-alive throughput, base against main, interleaved, and update bench/http1-conn/README.md — see WP39 H1 bench base build
        status: pending
  - id: bench-lean-record
    title: WP39 H1 — finish the http-lean-get record and the http1-cpu-per-request gaps
    goal: BENCHMARKS.md http-lean-get gives ns per component with a base-against-base band and a serving-connection byte sum checked against RSS, measured in a cloud container. The x86 PMU proof and the 18,000-connection ring runs are bench-lean-machine.
    verification: node bench/http1-conn/run.mjs --connections 10000 --rounds 15 && node docs/check-links.mjs && npm run lint
    status: pending
    issue: 1780
    todos:
      - id: lean-component-ns
        content: Time head parse apart from header spans and Date including its clock read in bench/http1-conn, with a noise band — see WP39 H1 bench lean record
        status: pending
      - id: lean-serving-bytes
        content: Sum the serving connection's bytes by object and check them against RSS while serving — see WP39 H1 bench lean record
        status: pending
  - id: bench-lean-machine
    title: WP39 H1 — the x86 head-scan proof and the 18,000-connection ring runs, on a machine with counters
    goal: The x86 gain of the 16-byte head scans is proven or withdrawn with hardware counters, and h1 over NET_LISTEN_RING and idle memory at 18,000 connections are measured on a quiet machine.
    verification: node bench/http1-conn/run.mjs --connections 18000 --rounds 15 && npm run lint
    status: pending
    labels: [deferred]
    related: [1295]
    todos:
      - id: lean-ring-idle
        content: Run bench/http1-server.ts over NET_LISTEN_RING at 18,000 connections interleaved with epoll and a byte-identical copy, and measure idle memory with the load stopped — see WP39 H1 bench lean machine
        status: pending
      - id: x86-parse-pmu
        content: Prove or withdraw the x86 gain of the 16-byte head scans on a machine with x86 hardware counters, and add ns per stage for the submission stages — see WP39 H1 bench lean machine
        status: pending
  - id: bench-syscall-box
    title: WP39 H1 — split the syscall bench in one run and measure the QUICKACK alternatives
    goal: bench/syscall-cost prints a request's kernel time split into entry and exit and TCP work in one run, and bench/quickack measures the route, BPF sockops and sysctl alternatives to per-response QUICKACK, in a cloud container. The reported-box run is bench-syscall-reported-box.
    verification: bash bench/syscall-cost/run.sh && bash bench/quickack/run.sh && npm run lint
    status: pending
    issue: 1092
    todos:
      - id: syscall-split
        content: Make bench/syscall-cost/run.sh print a request's kernel time split into entry and exit and TCP work without a separate run — see WP39 H1 bench syscall box
        status: pending
      - id: quickack-alternatives
        content: Measure the ip route quickack, BPF sockops and sysctl alternatives in bench/quickack, not only reason about them — see WP39 H1 bench syscall box
        status: pending
  - id: bench-syscall-reported-box
    title: WP39 H1 — the syscall and quickack benches on the reported Xeon 8260 box
    goal: bench/syscall-cost and bench/quickack run on the reported Linux 6.8 Xeon Platinum 8260 box, and the per-response QUICKACK reset is removed if it measures within noise there.
    verification: bash bench/syscall-cost/run.sh && bash bench/quickack/run.sh && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: quickack-reported-box
        content: Run both benches on the reported box and drop the per-response netSetOption NET_TCP_QUICKACK call if it measures within noise — see WP39 H1 bench syscall reported box
        status: pending
  - id: plaintext-codec-followup
    title: WP39 H1 — the http1 plaintext codec follow-up, the /plaintext Ir target and the /json regression
    goal: The explicit /json regression at 128 to 512 connections is isolated and fixed, bench/http1-parse runs on main again, and the plaintext Ir and browser-shaped json gaps are met or recorded.
    verification: bash bench/techempower/profile.sh --only plaintext && node bench/http1-parse/run.mjs && node tests/run.js net_http1_server && npm run lint
    status: pending
    issue: 1525
    todos:
      - id: codec-json-regression
        content: Isolate the explicit /json loss at 128 to 512 connections between the per-request section scan and the per-connection head state in std/net/http1-server.ts — see WP39 H1 plaintext codec
        status: pending
      - id: codec-checksum
        content: Update the pinned checksum b29eddcc in bench/http1-parse for the head that keeps each field line's CRLF — see WP39 H1 plaintext codec
        status: pending
      - id: codec-plaintext-ir
        content: Cut http1Next from 3,873 toward 3,251 Ir per /plaintext request, or record the owner's accepted miss — see WP39 H1 plaintext codec
        status: pending
      - id: codec-varied-browser
        content: Explain or fix varied at +1.1 percent wall time and browser-shaped /json at c=256 — see WP39 H1 plaintext codec
        status: pending
---

# WP39 — the HTTP server, follow-ups and open decisions

## Context
27 of 29 roadmap stages have landed (E1 to E8, G1 to G8, G10); see [the design note](../../docs/wp39-http-server.md). G9 is deferred and E9 is retired (see Out of scope). G7's façade, `nish/net/http-server`, landed in #1473 ([`docs/http-one-handler.md`](../../docs/http-one-handler.md)); [WP71](https://github.com/amritk/nish/pull/1809)'s HttpArena entry asks it for three more things, the first three stages below. Their spec is #1809's `docs/wp39-http-server.md` §1 to §4 (G7's row) and `docs/wp71-httparena.md` §3. The other stages here come from open follow-up issues; every issue was read, and several items inside them are already settled, noted per stage. Spec: [design note](../../docs/wp39-http-server.md).

## WP39 G7 — HTTP/1.1 over TLS on the nish/net/http-server façade
[`docs/http-one-handler.md`](../../docs/http-one-handler.md#42-finding-f2-one-tls-port-for-http11-and-http2) §4.2, finding F2, left `Http1TlsServer` out of the façade: one TLS port that lets ALPN choose between `http/1.1` and `h2` needs a carrier change, and a second TLS port for HTTP/1.1 was judged not worth its setup. WP71 now needs it: HttpArena's `json-tls` (the JSON test over HTTP/1.1 on TLS, port 8081) and `8gbit` (`POST /echo`, 10 KiB at 50,000 req/s over HTTP/1.1 on TLS, scored on CPU per request and p99) profiles run on a port of their own, so this is the second-port shape F2 already describes, not ALPN fallback.

- Add `HttpServer.listenHttp1Tls(fd, tls: TlsServerConfig, config: Http1Config, slots)` beside `listenHttp2Tls` (`std/net/http-server.ts:982`), over `Http1TlsServer` (`std/net/http1-server.ts:3038`), which already takes ALPN `http/1.1` or none and shuts any other protocol down with `close_notify`.
- It keeps the façade's rules: `Alt-Svc` for HTTP/3 on its responses, the limits (`bodyTimeout`, `idleTimeout`, the head deadline) applied as `listenHttp1` applies them, and a warmed request allocates nothing (`docs/http-one-handler.md` §6).
- ALPN fallback on one port (`http/1.1` and `h2` together) stays out of scope: it is a change to `http2-tls.ts`, F2's deferral stands.
- Amend F2 to say HTTP/1.1 over TLS is on the façade on its own port; add the listener to `docs/security/http-server.md`'s scope and the façade's `docs/guide/` page.

Likely files: `std/net/http-server.ts`, `std/net/http1-server.ts` (read-only unless a carrier hook is missing), `tests/link/net_http_server*`, `docs/http-one-handler.md`, `docs/security/http-server.md`, `docs/guide/`.

Owns: `std/net/http-server.ts`, `tests/link/net_http_server_h1_tls*/**`, `docs/http-one-handler.md`, `docs/security/http-server.md`, `docs/security/README.md`, `docs/guide/using-nish/http-server.md`.
Depends on: none. First of the three G7 stages; they share `std/net/http-server.ts`, so they run one after another: h1-tls, then h2c-preface, then websocket.

## WP39 G7 — WebSocket on the façade's HTTP/1.1 listener
`Http1Server` and `Http1Connection` speak WebSocket today (`acceptWebSocket(protocol)` at `std/net/http1-server.ts:2173`, events `H1_WS_MESSAGE` and `H1_WS_CLOSE`, Autobahn in the interop job since G1), but `nish/net/http-server` exposes none of it, so a façade program cannot answer an upgrade. WP71's three echo profiles (`echo-ws`, `echo-ws-pipeline`, `echo-ws-limited`: an upgrade on `/ws`, port 8080, text echoed) need it on the same listener that serves HTTP/1.1.

- Add a WebSocket surface to the façade: a request that asked to upgrade reaches the handler as any other; the handler accepts it, and the slot then yields message and close events and takes sends through `HttpServer`, mapped onto the carrier's existing calls without a copy beyond §3's one in and one out.
- An upgrade on an HTTP/2 or HTTP/3 request is refused (RFC 8441 extended CONNECT is out of scope), and on a TLS listener it works once the `g7-h1-tls` stage has landed.
- A warmed message round trip allocates nothing, as a warmed request does; the façade's slot and timeout accounting covers an upgraded slot (`idleTimeout` applies, `bodyTimeout` does not).
- Point the interop job's Autobahn run at a façade echo server as well as the existing one.

Likely files: `std/net/http-server.ts`, `std/net/websocket.ts`, `tests/link/net_http_server*`, the interop job, `docs/http-one-handler.md`, `docs/security/http-server.md`, `docs/guide/`.

Owns: `std/net/http-server.ts`, `std/net/websocket.ts`, `tests/link/net_http_server_ws*/**`, `tests/interop/**`, `.github/workflows/interop.yml`, `docs/security/http1-codec.md`, `docs/http-one-handler.md`, `docs/security/http-server.md`, `docs/security/README.md`, `docs/guide/using-nish/http-server.md`, `tests/nish-cmp.js` (its `DECLARED` entries only).
Depends on: none (g7-h2c-preface merged as 471394b). Last of the G7 stages, because its Autobahn todo edits `.github/workflows/interop.yml`, a sensitive path: its PR is built and reviewed, then left for a human merge, and nothing waits behind it.

## WP39 G7 — an h2c peer taken by its preface on the façade's HTTP/1.1 listener
[`docs/http-one-handler.md`](../../docs/http-one-handler.md#4-h2c-prior-knowledge-only) §4 rules sniffing out: an h2c port never falls back to HTTP/1.1, and a deployment that wants both runs two ports. HttpArena serves HTTP/1.1, WebSocket and cleartext gRPC on one port (8080), so WP71's `unary-grpc` profile (with [WP72](https://github.com/amritk/nish/pull/1809)'s gRPC) cannot be entered without it.

**Decided (owner, 2026-11-20): yes, opt in per listener.** `listenHttp1` takes an option, off by default, so a listener that does not ask behaves exactly as today and §4's rule stays the default.

- On an opted-in listener, a new slot reads into a 24-byte array first, as the h2c carrier does (§4.1, finding F1). The first byte that differs from `PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n` sends the slot to `Http1Server` with those bytes as the start of its input; all 24 matching sends it to `Http2CleartextServer`, which feeds them to `Http2Connection` as F1's step 3 does.
- An HTTP/1.1 request whose method is `PRI` but whose line differs from the preface goes to `Http1Server` with the bytes read so far, which answers it as it answers that request today; a peer that sends a partial preface and stops is closed by `prefaceTimeout`, as on an h2c port.
- Neither carrier is edited if a hand-over hook can be had from the façade; if `Http1Connection` needs a way to take bytes already read, that is the one carrier change, recorded in the note.
- No `Upgrade: h2c` (RFC 9113 §3.1 deprecates it; §4 stands on that).
- Amend §4 to "no sniffing unless the listener opts in", and record the preface read in `docs/security/http-server.md` and `docs/security/http2-cleartext.md` (a slot held by a silent peer costs 24 bytes until `prefaceTimeout`).

Likely files: `std/net/http-server.ts`, `std/net/http2-cleartext.ts`, `std/net/http1-server.ts`, `tests/link/net_http_server*`, `docs/http-one-handler.md`, `docs/security/`, `docs/guide/`.

Owns: `std/net/http-server.ts`, `std/net/http2-cleartext.ts`, `std/net/http1-server.ts`, `tests/link/net_http_server_h2c*/**`, `docs/security/http2-cleartext.md`, `docs/security/http1-codec.md`, `docs/http-one-handler.md`, `docs/security/http-server.md`, `docs/security/README.md`, `docs/guide/using-nish/http-server.md`.
Depends on: g7-h1-tls and date-header (development and merge; date-header also owns `docs/security/http1-codec.md`).

## WP39 G9 — move WebTransport's pin when Chrome moves past the draft
Deferred until Chrome moves past the WebTransport draft. Nothing to do until then.
Likely files: `std/net/` webtransport modules, the interop job.

## WP39 H1 — a streamed response finished by length must not drop the next pipelined request
Issue #1556, a follow-up to #1546. After #1546, `Http1Connection.nextRequest` finishes a response itself once its whole `Content-Length` body is sent; `HttpHandler.drive` (`std/net/handler.ts:800-813`) still loops `next(slot)` for a slot streaming a response, so a pipelined r2 can begin, then a deferred `handler.end(r1)` ends or drops r2. Found by reading, not reproduced; the first step is a failing test.
Likely files: `std/net/handler.ts`, `std/net/http1-server.ts`, `tests/link/`.

**Decided (owner, 2026-11-21): option (a).** `HttpHandler.drive` (`std/net/handler.ts`) stops taking `next()` for a slot whose request is still unended, with an `unended(slot)` check the way `HttpServer.unended` does it (`std/net/http-server.ts:1477`, `1489`, `1510`), so the handler's `end` stays the boundary. No public API change, and `std/net/http1-server.ts` is not edited.

- Write the regression test first and see it fail: a pipelined pair where r1 streams a length-framed body and ends on a later turn. Both responses go out in order, and `pooled()` stays flat.
- Record the fix in `docs/security/handler.md` inside the existing row it belongs to (HANDLER-13 covers `drive`), citing the new case. Adding no new row keeps `docs/security/README.md`'s counts where they are, which the G7 lane owns.

Owns: `std/net/handler.ts`, `tests/link/net_handler_pipelined*/**`, `docs/security/handler.md`.
Depends on: none.

## WP39 H1 — an inline read-buffer header and a slot-indexed hot block for http1-server
Issue #1225, a follow-up to #1211, which cut D1 misses per idle request from 10.95 to 9.01 with no wall-time gain. Not evaluated: the lent buffer's start and capacity inline in the hot block (3.50 D1 read misses per idle request sit in `Http1Connection.inputRoom`), and a struct-of-arrays hot block on `Http1Server` indexed by slot. Public API stays the same and an idle connection stays about 1.1 KiB (1,026 B today). Bench: `node bench/http1-conn/run.mjs --connections 10000 --rounds 15 --base <base>` and `bash bench/http1-conn/misses.sh`. Settled, do not redo: LIFO lending and reading straight into the lent buffer.
Likely files: `std/net/http1-server.ts`, `bench/http1-conn/`.

Owns: `std/net/http1-server.ts`, `bench/http1-conn/**`, `docs/BENCHMARKS.md` (its `http1-conn` hot-block record only), `tests/runtime-budgets.js`, `docs/wp7-runtime.md`, `tests/nish-cmp.js` (its `DECLARED` entries only).
Depends on: plaintext-codec-followup (`std/net/http1-server.ts`, development and merge) and bench-lean-record (`bench/http1-conn/**`, development and merge). bench-base-build merged as 86ce9bc.

## WP39 H1 — lazy Http1Server slots, the RSS gap and the throughput run left open after the first change
Issue #744 (after #734). Open: (1) RSS at 16,384 slots is 0.7 MB above 1,024 (2.6 against 1.9 MB), likely the bench server's own per-slot state at `bench/http1-server.ts:269-272`; accept it or make that lazy; (2) ping, query and body throughput were never compared with `wrk`. Item 3, a stale preallocation claim in `bench/README.md`, is already met per the owner's comment of 2026-11-12. Also unblocked: the same lazy-slot change for `Http1TlsServer`, `std/net/tls-tcp.ts`, `http2*` and `http3*`.
Likely files: `bench/http1-server.ts`, `std/net/http1-server.ts`, `std/net/tls-tcp.ts`, `bench/README.md`.

**Waiting on a decision (2026-11-25).** Left out of the `/feature` run: the owner asked for the wrk throughput comparison on a quiet machine, and the run has only a shared 4-core cloud container. The stage's issue carries `needs-decision` with the question.

## WP39 G5 — the HTTP/3 microsecond pacer's cost at 96 connections
Issue #700 (after #694). At 100 B and 96 connections the fix measured −3.8% req/s (c96m10, band ±0.8%) and +3.4% CPU a request, against the fix stage's own run showing none; the 4 kB cases are at or just outside the band. The owner's decisions (comment of 2026-10-19): profile first, re-measuring every scenario the before-figures cover on a quiet machine, then profile `pacerQuantum`, `quicListenerFlightTime` and the microsecond refill and decide from that; criterion 2 at 100 B is dropped; the p256 WASI intermittent is #708. Measure: `node bench/h3-latency.mjs --runs 9 --baseline 5f983c9 --size 100` and `--size 4096`.
Likely files: `std/net/http3-server.ts`, `std/net/quic*.ts`, `docs/h3-latency.md`.

**Waiting on a decision (2026-11-25).** Left out of the `/feature` run: the owner's decision is to re-measure on a quiet machine before profiling, and the run has only a shared 4-core cloud container. The stage's issue carries `needs-decision` with the question.

## WP39 H1 — repeated Date fields and the HTTP/2 and HTTP/3 cost of the Date header
Issue #696 (after #675 and #692). Two open points: a program passing two `date` fields gets both sent because `httpFieldsCheckOutgoing` does not refuse a repeated singleton field, and HTTP/2 and HTTP/3 have no measured cost (h1 is measured inside the band; `bench/http.mjs` drives only h1). Criterion 5 was judged met.
Likely files: `std/net/http-fields.ts`, `std/net/http2.ts`, `std/net/http3-server.ts`, `docs/BENCHMARKS.md`.

**Decided (owner, 2026-11-21): refuse and bench.**

- `httpFieldsCheckOutgoing` (`std/net/http-fields.ts`) refuses a repeated `date` field (RFC 9110 §5.3 forbids combining it), with a `tests/link` negative that sends two and shows the refusal.
- Measure the Date cost on HTTP/2 and HTTP/3 with `bench/h2load.mjs` (h2load comes from `apt-get install -y nghttp2-client`; HTTP/3 falls back to the script's own scripted client, as its header says), a build with the Date field against one without, base against base for the band. Record it in `docs/BENCHMARKS.md`, naming the commit, with the band. The cost is inside the band, or the figure is recorded as it is.
- Record the refusal in the existing rows of `docs/security/http1-codec.md` and `docs/security/http2.md` that cover `http-fields.ts`, adding no row (`docs/security/README.md` stays the G7 lane's). If `docs/guide/using-nish/standard-library.md` describes the outgoing check, it gains the sentence.

Owns: `std/net/http-fields.ts`, `tests/link/net_http_fields_date*/**`, `bench/h2load.mjs`, `docs/BENCHMARKS.md`, `docs/security/http1-codec.md`, `docs/security/http2.md`, `docs/guide/using-nish/standard-library.md`.
Depends on: none.

## WP39 H1 — the Conduit coalesced-reads p99 tail and the stale submission README
Issue #966 (after #963). Mean p99 got worse, 201 against 173 ms (the first pair 308 ms), while mean p95 improved, 108 against 117 ms. A possible cause is the read pool's connection rule (a third read connection opens only when 9 or more groups are in flight); #963 proposes opening one whenever none is idle and the queue is non-empty, or a per-pool minimum, unmeasured. The submission README (`bench/multicore/submission/nish-std-amritk/README.md:91`) still gives 233 to 246 microseconds and 34 microseconds HTTP; that path does not exist in this checkout, so locate where the submission now lives first. Whether either needs action was the owner's call; this stage measures and then decides.
Likely files: `std/net/` pool code, the submission directory.

**Waiting on a decision (2026-11-25).** Left out of the `/feature` run: the Conduit submission and its read pool are not in this repository (`bench/multicore/` does not exist), so there is nothing to measure or edit here. The stage's issue carries `needs-decision` with the question.

## WP39 H1 — make bench/http1-conn's --base comparison build the base and re-measure idle memory and throughput
Issue #1560. `node bench/http1-conn/run.mjs --shape rss --rss 5 --connections 10000 --base 7d921842` fails with `Module nish:net has no export netWrite2` because `bench/http1-conn/main.ts:57` imports it and run.mjs's `dated` shim does not cover it. Until then the idle-memory figure (4,258 to 1,215 B per connection; arena 3,384 to 904 B at `tests/runtime-budgets.js:847`) and keep-alive throughput (162,653 to 171,743 plaintext; band 12 to 17% from two copies of the new build) are unreproduced against a base.
Likely files: `bench/http1-conn/run.mjs`, `bench/http1-conn/main.ts`, `bench/http1-conn/README.md`.

Owns: `bench/http1-conn/run.mjs`, `bench/http1-conn/main.ts`, `bench/http1-conn/README.md`.
Model: sonnet
Depends on: none.

## WP39 H1 — finish the http-lean-get record and the http1-cpu-per-request gaps
Issue #1780 (BENCHMARKS.md section `http-lean-get`; verdict STOP stands): ns per component with a band (head parse apart from header spans, and Date including its clock read, estimated up to about 28 ns); the serving connection's bytes summed by object and checked against RSS; `bench/http1-server.ts` over `NET_LISTEN_RING` (`BENCH_RING=1`) at 18,000 connections, plus idle memory with the load stopped. Related #1295, the same kind of gap: the x86 gain of the 16-byte head scans is unproven (aarch64 parse 474.3 to 314.5 ns; x86 ranges overlap) and the submission stages lack ns; its small defects were fixed per the owner's comment of 2026-11-12.
Likely files: `bench/http1-conn/`, `bench/http1-server.ts`, `bench/http1-e2e/`, `docs/BENCHMARKS.md`.

**Decided (owner, via /decide, 2026-11-25, on #1780): split.** This stage keeps the component ns and the serving-connection bytes against RSS, measured in a cloud container with a base-against-base band. The x86 PMU parse proof and the 18,000-connection `NET_LISTEN_RING` and idle runs are `bench-lean-machine`, which waits for a machine with counters and low noise. #1295 belongs to that half, so this stage's PR does not close it.

Owns: `bench/http1-conn/**`, `docs/BENCHMARKS.md` (its `http-lean-get` section only).
Depends on: none.

## WP39 H1 — the x86 head-scan proof and the 18,000-connection ring runs, on a machine with counters
The half of #1780 that `bench-lean-record` leaves: `lean-ring-idle` and `x86-parse-pmu`, with #1295. Deferred until a machine with x86 hardware counters (`perf` usable) and low noise is available; agents do not build it before then.
Likely files: `bench/http1-server.ts`, `bench/http1-e2e/`, `bench/http1-conn/`, `docs/BENCHMARKS.md`.

## WP39 H1 — measure the syscall and quickack benches on the reported box
Issue #1092 (after #1085 and #1088). `bench/syscall-cost/run.sh` splits a request's kernel time only with `--split` from a separate run; `bench/quickack` measured `none`, `once0`, `reset0` and `reset1` but only reasoned about the route, BPF sockops and sysctl alternatives; every figure is from cloud VMs on Linux 6.18, never the reported Xeon Platinum 8260 on Linux 6.8. Actionable if it holds there: the per-response `netSetOption(conn, NET_TCP_QUICKACK, 0)` buys nothing and costs one syscall (3.6 to about 2.6 syscalls a request). Needs access to that box.
Likely files: `bench/syscall-cost/`, `bench/quickack/`, the Conduit submission's QUICKACK call.

**Decided (owner, via /decide, 2026-11-25, on #1092): split.** This stage builds the `run.sh` split and measures the route, BPF sockops and sysctl QUICKACK alternatives in a cloud container, and records that the figures are from a cloud VM. If an alternative needs a capability the container lacks (`CAP_NET_ADMIN`, BPF), the record says so with the refusal rather than an estimate. The per-response QUICKACK call stays: removing it waits for the reported box.

Owns: `bench/syscall-cost/**`, `bench/quickack/**`, `bench/README.md`, `docs/BENCHMARKS.md` (its `Syscall cost` section only).
Depends on: none.

## WP39 H1 — the syscall and quickack benches on the reported Xeon 8260 box
The half of #1092 that `bench-syscall-box` leaves: `quickack-reported-box`. Deferred until someone with access to the reported Xeon Platinum 8260 on Linux 6.8 runs it.
Likely files: `bench/syscall-cost/`, `bench/quickack/`, the Conduit submission's QUICKACK call.

## WP39 H1 — the http1 plaintext codec follow-up, the /plaintext Ir target and the /json regression
Issue #1525 (after #1416). Open: explicit `/plaintext` at 3,873 to 3,883 Ir against the 3,251 target (the owner accepted the miss); explicit `/json` worse in four cells from 128 to 512 connections, as low as −18.7%, cause not isolated (candidates #1460's section scan and #1457's head state); `varied` +1.1% wall against a ±0.9% band; `node bench/http1-parse/run.mjs` refuses to run on main because `new`'s checksum 5937a130 no longer matches the pinned `b29eddcc`; browser-shaped `/json` at c=256 is −5.9% and −11.7%. Fuzz sanitizer replays did not run in the acceptance container.
Likely files: `std/net/http1-server.ts`, `bench/http1-parse/`, `bench/techempower/`, `docs/BENCHMARKS.md`.

The owner accepted the `/plaintext` Ir miss on the issue, so `codec-plaintext-ir` records it rather than cutting Ir. Fuzz sanitizer replays are out of this stage.

Owns: `std/net/http1-server.ts`, `bench/http1-parse/**`, `bench/techempower/**`, `tests/link/net_http1_server*/**`, `docs/BENCHMARKS.md` (its http1 codec and TechEmpower sections only), `tests/nish-cmp.js` (its `DECLARED` entries only). A codec change that moves a `docs/security/http1-codec.md` row is recorded in the PR body for a follow-up, since g7-websocket owns that record while both run.
Depends on: none (date-header and g7-h2c-preface merged).

**Shared by section (second feature run, 2026-11-27).** `docs/BENCHMARKS.md` and `tests/nish-cmp.js` are named by more than one stage that runs at once. Each stage edits only the section or `DECLARED` entries its `Owns` line names, the stages merge one at a time, and a textual conflict a merge of `main` brings into either file is resolved by the stage's worker.

## Acceptance criteria
Checked on `main` after the last merge of the run (stages left out of it are not checked).

1. `HttpServer.listenHttp1Tls` serves HTTP/1.1 over TLS on its own port; a peer offering only ALPN `h2` is refused; a warmed request allocates nothing (`tests/link/net_http_server_h1_tls*`).
2. A `listenHttp1` that opts in serves an h2c prior-knowledge peer and an HTTP/1.1 peer on one port; a default port refuses the h2c peer as before; a `PRI` request that is not the preface is answered as today (`tests/link/net_http_server_h2c*`).
3. The façade accepts a WebSocket upgrade on an HTTP/1.1 listener and echoes messages; an upgrade on HTTP/2 or HTTP/3 is refused; a malformed frame closes the connection; the interop job runs Autobahn against a façade echo server.
4. A pipelined pair whose first response streams a length-framed body and ends on a later turn gets both responses, in order, and `pooled()` stays flat (`tests/link/net_handler_pipelined*`).
5. `httpFieldsCheckOutgoing` refuses a repeated `date` (a `tests/link` negative), and `docs/BENCHMARKS.md` records the HTTP/2 and HTTP/3 Date cost with its band and commit.
6. `node bench/http1-conn/run.mjs --shape rss --rss 5 --connections 10000 --base 7d921842` runs to completion, and `bench/http1-conn/README.md` records idle bytes per connection and keep-alive throughput base against main with a band.
7. `node bench/http1-parse/run.mjs` runs on `main`; the explicit `/json` loss at 128 to 512 connections is isolated and fixed or recorded with its cause; the `/plaintext` Ir miss is recorded as accepted.
8. The inline read-buffer header and the slot-indexed hot block are each measured with `bench/http1-conn` and adopted with a gain beyond the band or recorded as no gain.
9. `ci-gate` is green on `main` after the last merge.
10. Each built stage's issue is closed by its merged PR.
11. `bash bench/syscall-cost/run.sh` prints a request's kernel time split into entry and exit and TCP work in one run, and `bench/quickack` records a measured figure, or the refusal that stopped it, for each of the route, BPF sockops and sysctl alternatives, stating that the figures are from a cloud VM.
12. `docs/BENCHMARKS.md` `http-lean-get` gives ns for head parse, header spans and Date including its clock read, each with a base-against-base band, and the serving connection's bytes summed by object and checked against RSS.

Criteria 1, 2, 4, 5 and 6 were checked by the first run (2026-11-26); the second run checks 3 and 7 to 12.

## Out of scope
- **E9, submitting the entry to TechEmpower.** TechEmpower archived TechEmpower/FrameworkBenchmarks on 2026-03-24 ([its issue 10932](https://github.com/TechEmpower/FrameworkBenchmarks/issues/10932)) and takes no entries; #1859 is closed as not planned. The entry stays in `bench/techempower/` as this repository's benchmark, and a public number goes through [WP71](https://github.com/amritk/nish/pull/1809)'s HttpArena entry.
- ALPN fallback between `http/1.1` and `h2` on one TLS port (F2's deferral), `Upgrade: h2c`, and WebSocket over HTTP/2 or HTTP/3 (RFC 8441, RFC 9220).
- `sendfile`, kernel TLS, 0-RTT and HTTP/2 server push.
