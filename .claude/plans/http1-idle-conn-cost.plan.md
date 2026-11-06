---
name: Http1Server — less CPU per request on many cold keep-alive connections
overview: Cut the user-space CPU per request of nish/net/http1-server when thousands of mostly-idle keep-alive connections each send one request every second or two, so every request lands on a connection whose state is out of cache. Measured by a new 10,000-connection round-robin shape of bench/http1-conn driven through the sans-IO API with idleInput lending, before and after, with peak RSS per idle connection. No wire byte, limit, status or public API changes.
stages:
  - id: idle-conn-hot-path
    title: "perf(net): fewer cache misses per request on cold Http1Server keep-alive connections"
    goal: On a pool of 10,000 lending (idleInput) connections fed one ~300–600-byte request each in round-robin order, Http1Server's per-request path (readable → feed → next → respond → flush/settle → park) costs measurably fewer ns per request than on main, outside the old/old′ noise band, with peak RSS per idle connection no higher than main's, and every existing HTTP/1.1 test and golden unchanged in behaviour.
    verification: npm run check && npm run lint && node tests/run.js http1 && node tests/self/goldens.js --update && git diff --exit-code -- tests/self/goldens/checked && node bench/http1-conn/run.mjs --shape idle --connections 10000 --rounds 15 --base origin/main (the --shape flag is this stage's)
    status: pending
    todos:
      - id: bench-idle-shape
        content: Add an `idle` shape to bench/http1-conn (main.ts + run.mjs + README) that builds an Http1Server-shaped pool of 10,000 slots with Http1Config.idleInput on, shared HttpDate pinned, and drives each request the way Http1Server.readable/next/flush do (bytes copied into the scratch buffer as recv would, feed, next, respond with a small JSON body, consume as if sent, settle → park), one request per connection in round-robin so every request finds its connection, parser and lent buffers cold; requests are a ~350-byte GET head and a ~550-byte head with a small JSON body, mixed. It reports ns per request (median, min–max over rounds) for old, old′ (byte-identical copy of old, the noise band) and new, pinned with taskset as the existing shapes are, and fails on a checksum mismatch
      - id: bench-rss
        content: Make the same bench (or a mode of it) report peak RSS per idle connection — VmHWM after 10,000 connections have each served one request and parked, minus the same program at 0 connections, divided by 10,000 — for old and new, median and spread of ≥5 runs
      - id: measure-before
        content: Before changing std/, record the baseline on main — idle-shape ns/request, RSS per idle connection, and `perf stat -e cache-misses,L1-dcache-load-misses` (or cachegrind D1 misses) per request — and a perf annotate of http1Next/inputRoom on the idle shape confirming where the cold misses land (the buffer header load and the first SIMD compare of the request bytes, as the production profile shows)
      - id: hot-block
        content: Evaluate keeping each connection's per-request hot fields (state, flags, buffer offsets/lengths, the current read buffer's start and capacity, lastActive/headSince) contiguous in one or two cache lines — either reordered within Http1Connection/Http1Parser or as a struct-of-arrays on Http1Server indexed by slot — so dispatch → parse → respond does not chase connections[] → conn → parser → buf header. Take the variant that measures best; keep Http1Connection usable standalone (sans-IO) and Http1TlsServer working
      - id: inline-buffer-header
        content: Evaluate avoiding the pointer hop to the lent input buffer's header on every read (inputRoom, buffered, feed, the parser's bounds check) by keeping its length/capacity inline in the hot fields the path already touches
      - id: warm-buffers
        content: Evaluate making recv's bytes land in warm memory — confirm Http1OutputPool lends LIFO (it does today) and measure whether the scratch → parser.buf copy can be avoided (read straight into the lent buffer when it has room) or made to touch fewer cold lines; take it only if it measures
      - id: other-hot-spots
        content: Look at what else the annotate shows on this path — Http1Connection.inputRoom called twice per request (readable loop and settle), respond, http1TakeLine, park, Http1Parser.methodIs — and fix what measures outside the noise band; anything found and not done goes in the PR body with an estimate of its worth
      - id: memory-budget
        content: Keep an idle connection as cheap as main's (about 1.1 KiB; no new per-slot buffer, no array per slot that main does not have); report object sizes and any `performance:` layout warning for Http1Connection and Http1Parser before and after
      - id: api-intact
        content: Keep the public API the multicore-server-challenge submission uses unchanged — Http1Server.next/flush/rearm/close/expire/accept/fd/connection(slot), Http1Connection.data/dataStart/dataLength, respond, every H1_* constant — and every existing program (examples/prefork-server.ts, bench/http1-server.ts, bench/techempower, examples/http-app, examples/relay, tests/link/net_interop_server) compiling with no source edit
      - id: tests
        content: Pin any new state the change introduces (an inline buffer length, a slot-indexed array, a read-into-lent-buffer path) with tests in tests/link/net_http1_server (park/unpark across idleInput, pipelined requests, a request split across reads, a request that grows past the first input buffer, WebSocket upgrade after lending, expire of a parked slot); regenerate tests/self/goldens/checked with `node tests/self/goldens.js --update`
      - id: record
        content: Add a dated entry to docs/security/http1-codec.md naming the change to the input path and the tests that pin it (std/net/http1-server.ts is in its scope); update bench/README.md's http1-conn section and docs/BENCHMARKS.md with the idle shape and its numbers
      - id: report
        content: PR body carries, for each of the four ideas, taken or not with its measured effect; the before/after table (ns/request median and min–max for old/old′/new on the idle shape, plus the existing hot and cold shapes), RSS per idle connection before/after, cache-miss counts per request before/after, the CPU model, and the exact commands to rerun on the 4-vCPU box
---

# Http1Server — less CPU per request on many cold keep-alive connections

Requested for the multicore-server-challenge submission
(`amritk/multicore-server-challenge`, `submissions/nish-std-amritk`, Nish 0.34.1):
2 HTTP workers × ~7,500 keep-alive connections, each sending about one request
every 1–2 s, so almost every request lands on a connection whose state is cold.

Production profile (perf, x86-64-v3, 15,000 users, ~14,900 req/s on 4 vCPUs):
`http1Next` 12.6% of a worker's samples — 17.6% of it on the `cmp` right after
loading the input buffer's length through the connection
(`mov 0x38(%r13),%rsi; mov (%rsi),%rdx`, a miss on the buffer object's header),
21% on the first `vpcmpeqb` over the request bytes (first touch of the data);
`Http1Connection.inputRoom` 4.3%; `respond` 2.5%, `http1TakeLine` 2.2%, `park`
1.4%, `Http1Parser.methodIs` 1.3%. User time ~4.3 µs/request, kernel ~5.5 µs
(TCP, out of scope).

Prior work: #1176 (run #1175) already reordered `Http1Connection` hot-first
(184 bytes, two cache lines for the per-request methods) and added
`bench/http1-conn` with `hot` and `cold` shapes over 50,000 connections — but
those shapes do not lend input buffers (`idleInput`) and do not go through
`Http1Server`'s slot dispatch, which is where the production misses are. This
plan builds on that layout rather than redoing it.

One stage: the benchmark and the change are a chain (the change is judged by the
benchmark), and together they are one PR's worth.

## idle-conn-hot-path

**Owns:** `std/net/http1-server.ts`, `std/net/http1-codec.ts` (the parser's
field layout and input-buffer bookkeeping only — no change to what it accepts
or refuses), `bench/http1-conn/**`, `bench/README.md`, `docs/BENCHMARKS.md`,
`tests/link/net_http1_server/**`, `tests/link/net_http1_server_*/**`,
`tests/link/net_http1/**`, `docs/security/http1-codec.md`,
`tests/self/goldens/checked/**` (generated),
`.claude/plans/http1-idle-conn-cost.plan.md`

Out of scope: `src/` (if a layout the change wants needs a compiler feature,
say so in the PR instead of adding it — the rolling freeze), the kernel/TCP
half of the cost, `Http1Parser`'s acceptance rules, other servers
(`http2`, `http3`, `buffer-pool.ts`).

Measuring: old / old′ / new interleaved, pinned, at least 15 rounds, as
`bench/http1-conn/run.mjs` already does; a delta inside the old/old′ band is no
win and is reported as such. The container's CPU is not the challenge's 4-vCPU
box; the PR names the CPU and carries the rerun commands.
