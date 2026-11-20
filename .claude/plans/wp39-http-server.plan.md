---
name: WP39 — the HTTP server, follow-ups and open decisions
overview: Every WP39 stage is built except E9 (submit to TechEmpower, an owner decision) and G9 (WebTransport pin, deferred). Open issues add HTTP/1 pipelining, bench-record gaps, an HTTP/3 pacer cost and a few acceptance gaps.
roadmap: docs/roadmap/wp39-http-server.md
spec: docs/wp39-http-server.md
priority: 80
issue: 1850
stages:
  - id: e9-submit
    title: WP39 E9 — submit the entry to TechEmpower
    goal: The owner has decided whether and when to submit the TechEmpower entry, and the answer is recorded in the design note.
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    labels: [needs-decision]
    issue: 1859
    todos:
      - id: e9-decide
        content: Record the owner's answer on submitting in docs/wp39-http-server.md E9 and docs/roadmap/wp39-http-server.md — see WP39 E9 Decision needed
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
    verification: node tests/run.js net_serve && node tests/run.js net_http1_server && node tests/run.js net_handler && npm run lint
    status: pending
    issue: 1556
    labels: [needs-decision]
    todos:
      - id: h1-pipelined-test
        content: Add a tests/link case with an async streaming handler, a fully written body, a deferred end and a pipelined second request — see WP39 H1 pipelined stream end
        status: pending
      - id: h1-pipelined-fix
        content: Apply the chosen fix in HttpHandler.drive in std/net/handler.ts or Http1Connection.nextRequest in std/net/http1-server.ts — see WP39 H1 pipelined stream end
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
    verification: node tests/run.js net_http2_tls && node tests/run.js http1 && npm run lint
    status: pending
    issue: 696
    labels: [needs-decision]
    todos:
      - id: date-repeat
        content: Decide whether httpFieldsCheckOutgoing in std/net/http-fields.ts refuses a repeated date field, and add its tests/link negative — see WP39 H1 Date header Decision needed
        status: pending
      - id: date-h2h3-bench
        content: Measure the Date cost on HTTP/2 and HTTP/3 with the h2load harness and record it in docs/BENCHMARKS.md with a noise band — see WP39 H1 Date header
        status: pending
  - id: conduit-tail
    title: WP39 H1 — the Conduit coalesced-reads p99 tail and the stale submission README
    goal: The p99 regression against main is explained or recovered by the read pool's connection rule, and the submission README carries the post-coalescing figures.
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    issue: 966
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
    goal: BENCHMARKS.md http-lean-get gives ns per component with a band, a serving-connection byte sum checked against RSS, h1 over NET_LISTEN_RING and idle memory at 18,000 connections, and the x86 parse gain is proven or withdrawn.
    verification: node bench/http1-conn/run.mjs --connections 10000 --rounds 15 && node docs/check-links.mjs && npm run lint
    status: pending
    issue: 1780
    related: [1295]
    todos:
      - id: lean-component-ns
        content: Time head parse apart from header spans and Date including its clock read in bench/http1-conn, with a noise band — see WP39 H1 bench lean record
        status: pending
      - id: lean-serving-bytes
        content: Sum the serving connection's bytes by object and check them against RSS while serving — see WP39 H1 bench lean record
        status: pending
      - id: lean-ring-idle
        content: Run bench/http1-server.ts over NET_LISTEN_RING at 18,000 connections interleaved with epoll and a byte-identical copy, and measure idle memory with the load stopped — see WP39 H1 bench lean record
        status: pending
      - id: x86-parse-pmu
        content: Prove or withdraw the x86 gain of the 16-byte head scans on a machine with x86 hardware counters, and add ns per stage for the submission stages — see WP39 H1 bench lean record
        status: pending
  - id: bench-syscall-box
    title: WP39 H1 — measure the syscall and quickack benches on the reported box
    goal: bench/syscall-cost and bench/quickack are run on the reported Linux 6.8 Xeon box, the alternatives to per-response QUICKACK are measured, and the reset-per-response syscall is removed if it buys nothing.
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
      - id: quickack-reported-box
        content: Run both benches on the reported box and drop the per-response netSetOption NET_TCP_QUICKACK call if it measures within noise — see WP39 H1 bench syscall box
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
27 of 29 roadmap stages have landed (E1 to E8, G1 to G8, G10); see [the roadmap page](../../docs/roadmap/wp39-http-server.md). Unbuilt are E9 and G9. The other stages here come from open follow-up issues; every issue was read, and several items inside them are already settled, noted per stage. Spec: [design note](../../docs/wp39-http-server.md).

## WP39 E9 — submit the entry to TechEmpower
Spec: [design note E9](../../docs/wp39-http-server.md#e9-submitting-upstream).

### Decision needed
Whether and when to submit the entry; a public number is the owner's call. An open, unmerged PR (#1809) proposes retiring the TechEmpower submission (TechEmpower archived its Framework Benchmarks on 2026-03-24) in favour of HttpArena, which moves E9 to not planned. Options: not planned via #1809, or hold. Recommended: close as not planned if #1809 merges.

## WP39 G9 — move WebTransport's pin when Chrome moves past the draft
Deferred until Chrome moves past the WebTransport draft. Nothing to do until then.
Likely files: `std/net/` webtransport modules, the interop job.

## WP39 H1 — a streamed response finished by length must not drop the next pipelined request
Issue #1556, a follow-up to #1546. After #1546, `Http1Connection.nextRequest` finishes a response itself once its whole `Content-Length` body is sent; `HttpHandler.drive` (`std/net/handler.ts:800-813`) still loops `next(slot)` for a slot streaming a response, so a pipelined r2 can begin, then a deferred `handler.end(r1)` ends or drops r2. Found by reading, not reproduced; the first step is a failing test.
Likely files: `std/net/handler.ts`, `std/net/http1-server.ts`, `tests/link/`.

### Decision needed
Which fix. (a) `HttpHandler.drive` stops taking `next()` for a slot whose request is `HANDLER_STREAMING` or `HANDLER_FLUSHING`, so the handler's `end` stays the boundary; (b) the connection gets a flag saying a response is ended explicitly, so implicit finishing is skipped; (c) narrow `nextRequest`'s implicit finish. The issue gives no recommendation; (a) is the smallest change in one file.

## WP39 H1 — an inline read-buffer header and a slot-indexed hot block for http1-server
Issue #1225, a follow-up to #1211, which cut D1 misses per idle request from 10.95 to 9.01 with no wall-time gain. Not evaluated: the lent buffer's start and capacity inline in the hot block (3.50 D1 read misses per idle request sit in `Http1Connection.inputRoom`), and a struct-of-arrays hot block on `Http1Server` indexed by slot. Public API stays the same and an idle connection stays about 1.1 KiB (1,026 B today). Bench: `node bench/http1-conn/run.mjs --connections 10000 --rounds 15 --base <base>` and `bash bench/http1-conn/misses.sh`. Settled, do not redo: LIFO lending and reading straight into the lent buffer.
Likely files: `std/net/http1-server.ts`, `bench/http1-conn/`.

## WP39 H1 — lazy Http1Server slots, the RSS gap and the throughput run left open after the first change
Issue #744 (after #734). Open: (1) RSS at 16,384 slots is 0.7 MB above 1,024 (2.6 against 1.9 MB), likely the bench server's own per-slot state at `bench/http1-server.ts:269-272`; accept it or make that lazy; (2) ping, query and body throughput were never compared with `wrk`. Item 3, a stale preallocation claim in `bench/README.md`, is already met per the owner's comment of 2026-11-12. Also unblocked: the same lazy-slot change for `Http1TlsServer`, `std/net/tls-tcp.ts`, `http2*` and `http3*`.
Likely files: `bench/http1-server.ts`, `std/net/http1-server.ts`, `std/net/tls-tcp.ts`, `bench/README.md`.

## WP39 G5 — the HTTP/3 microsecond pacer's cost at 96 connections
Issue #700 (after #694). At 100 B and 96 connections the fix measured −3.8% req/s (c96m10, band ±0.8%) and +3.4% CPU a request, against the fix stage's own run showing none; the 4 kB cases are at or just outside the band. The owner's decisions (comment of 2026-10-19): profile first, re-measuring every scenario the before-figures cover on a quiet machine, then profile `pacerQuantum`, `quicListenerFlightTime` and the microsecond refill and decide from that; criterion 2 at 100 B is dropped; the p256 WASI intermittent is #708. Measure: `node bench/h3-latency.mjs --runs 9 --baseline 5f983c9 --size 100` and `--size 4096`.
Likely files: `std/net/http3-server.ts`, `std/net/quic*.ts`, `docs/h3-latency.md`.

## WP39 H1 — repeated Date fields and the HTTP/2 and HTTP/3 cost of the Date header
Issue #696 (after #675 and #692). Two open points: a program passing two `date` fields gets both sent because `httpFieldsCheckOutgoing` does not refuse a repeated singleton field, and HTTP/2 and HTTP/3 have no measured cost (h1 is measured inside the band; `bench/http.mjs` drives only h1). Criterion 5 was judged met.
Likely files: `std/net/http-fields.ts`, `std/net/http2.ts`, `std/net/http3-server.ts`, `docs/BENCHMARKS.md`.

### Decision needed
Whether the outgoing field check refuses a repeated `date` (RFC 9110 section 5.3 forbids combining it), and whether h2/h3 need a load bench such as h2load over TLS. Options: refuse and bench; refuse only; accept both gaps. No recommendation in the issue; refusing is cheap and matches the RFC.

## WP39 H1 — the Conduit coalesced-reads p99 tail and the stale submission README
Issue #966 (after #963). Mean p99 got worse, 201 against 173 ms (the first pair 308 ms), while mean p95 improved, 108 against 117 ms. A possible cause is the read pool's connection rule (a third read connection opens only when 9 or more groups are in flight); #963 proposes opening one whenever none is idle and the queue is non-empty, or a per-pool minimum, unmeasured. The submission README (`bench/multicore/submission/nish-std-amritk/README.md:91`) still gives 233 to 246 microseconds and 34 microseconds HTTP; that path does not exist in this checkout, so locate where the submission now lives first. Whether either needs action was the owner's call; this stage measures and then decides.
Likely files: `std/net/` pool code, the submission directory.

## WP39 H1 — make bench/http1-conn's --base comparison build the base and re-measure idle memory and throughput
Issue #1560. `node bench/http1-conn/run.mjs --shape rss --rss 5 --connections 10000 --base 7d921842` fails with `Module nish:net has no export netWrite2` because `bench/http1-conn/main.ts:57` imports it and run.mjs's `dated` shim does not cover it. Until then the idle-memory figure (4,258 to 1,215 B per connection; arena 3,384 to 904 B at `tests/runtime-budgets.js:847`) and keep-alive throughput (162,653 to 171,743 plaintext; band 12 to 17% from two copies of the new build) are unreproduced against a base.
Likely files: `bench/http1-conn/run.mjs`, `bench/http1-conn/main.ts`, `bench/http1-conn/README.md`.

## WP39 H1 — finish the http-lean-get record and the http1-cpu-per-request gaps
Issue #1780 (BENCHMARKS.md section `http-lean-get`; verdict STOP stands): ns per component with a band (head parse apart from header spans, and Date including its clock read, estimated up to about 28 ns); the serving connection's bytes summed by object and checked against RSS; `bench/http1-server.ts` over `NET_LISTEN_RING` (`BENCH_RING=1`) at 18,000 connections, plus idle memory with the load stopped. Related #1295, the same kind of gap: the x86 gain of the 16-byte head scans is unproven (aarch64 parse 474.3 to 314.5 ns; x86 ranges overlap) and the submission stages lack ns; its small defects were fixed per the owner's comment of 2026-11-12.
Likely files: `bench/http1-conn/`, `bench/http1-server.ts`, `bench/http1-e2e/`, `docs/BENCHMARKS.md`.

## WP39 H1 — measure the syscall and quickack benches on the reported box
Issue #1092 (after #1085 and #1088). `bench/syscall-cost/run.sh` splits a request's kernel time only with `--split` from a separate run; `bench/quickack` measured `none`, `once0`, `reset0` and `reset1` but only reasoned about the route, BPF sockops and sysctl alternatives; every figure is from cloud VMs on Linux 6.18, never the reported Xeon Platinum 8260 on Linux 6.8. Actionable if it holds there: the per-response `netSetOption(conn, NET_TCP_QUICKACK, 0)` buys nothing and costs one syscall (3.6 to about 2.6 syscalls a request). Needs access to that box.
Likely files: `bench/syscall-cost/`, `bench/quickack/`, the Conduit submission's QUICKACK call.

## WP39 H1 — the http1 plaintext codec follow-up, the /plaintext Ir target and the /json regression
Issue #1525 (after #1416). Open: explicit `/plaintext` at 3,873 to 3,883 Ir against the 3,251 target (the owner accepted the miss); explicit `/json` worse in four cells from 128 to 512 connections, as low as −18.7%, cause not isolated (candidates #1460's section scan and #1457's head state); `varied` +1.1% wall against a ±0.9% band; `node bench/http1-parse/run.mjs` refuses to run on main because `new`'s checksum 5937a130 no longer matches the pinned `b29eddcc`; browser-shaped `/json` at c=256 is −5.9% and −11.7%. Fuzz sanitizer replays did not run in the acceptance container.
Likely files: `std/net/http1-server.ts`, `bench/http1-parse/`, `bench/techempower/`, `docs/BENCHMARKS.md`.
