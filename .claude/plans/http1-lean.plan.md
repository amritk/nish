---
name: Http1Server's lean path — measure a minimal request, then build a lean mode only if it saves more than 0.5 µs
overview: "In the twelve-dollar challenge entry nish-std-amritk, a 404 that touches no database costs 5.1 µs on one core, about 3 µs of it in the kernel. Http1Server parses every header line into spans, sends a Date on every response and keeps per-request parser state on every connection; an idle connection costs 813 bytes (about 1.6 KB while serving) against about 40 bytes in the leaderboard's C entries. First measure where a minimal GET -> 200 JSON spends its instructions and bytes. Only if a lean path would save more than about 0.5 µs a request, add an opt-in Http1Config mode that parses only the request line and a few named fields, keeps no per-connection state it does not need between requests, and still holds every property of docs/security/http1-codec.md. If the general path is within about 0.5 µs of the lean one, the run records that and stops."
stages:
  - id: s1-measure
    title: "docs(bench): measure where a minimal HTTP/1.1 GET spends its instructions and bytes"
    goal: "docs/BENCHMARKS.md has a measured breakdown of a minimal GET -> 200 JSON on Http1Server: instructions and wall-clock ns per request for head parse, header spans, Date, response head and sendBody; bytes per idle and per serving connection, by object; per-request CPU and idle-connection memory on bench/http1-server.ts and at 18,000 connections over epoll and over io_uring ring slots (NET_LISTEN_RING). It states an upper bound on what a lean path could save, against the 0.5 µs bar, and ends in a verdict line: GO or STOP."
    verification: "npm run build && node bench/http1-request/run.mjs --validate && node bench/http1-conn/run.mjs --shape stages --rounds 1 && bash -n bench/handler-ring/run.sh && npm run lint && node docs/check-links.mjs && npm run check"
    todos:
      - id: s1-breakdown
        content: "Extend bench/http1-conn (its stages shape, or a new shape beside it) so one minimal keep-alive GET -> 200 JSON on Http1Connection is split into: head parse (request line, line scan, end of head), header spans (http1FieldLine's lowercasing, the head copy, the span stores, for fields no one reads), Date (HttpDate.current, the clock read hold makes, the 29-byte copy into the head), response head (http1WriteResponseHead and the kept-head path), and sendBody. Report instructions per request from callgrind (deterministic, GLIBC_TUNABLES and NISH_SIMD=base pinned as bench/run.mjs pins them) and wall-clock ns per request with a noise band from a byte-identical copy, cold over 18,000 connections and DRAM-cold (the -dram shapes). The request is about 350 bytes with Authorization, as the bench feeds now; also give the 37-byte short GET. Give a request with 0, 4 and 10 unread fields so the per-field cost is a slope, not one point."
        status: pending
      - id: s1-bytes
        content: "Account for the bytes: per idle connection and per serving connection, list every object and buffer Http1Server holds for it (Http1Connection, Http1Parser, spans, Http1ListTally, headLengths, headBytes, the lent input and head buffers, the output borrowed while writing), with its size including the allocator's header and rounding, and check the sum against the rss shape's measured peak RSS per connection. Say which of those fields are needed between requests on a keep-alive connection and which are per-request parse state."
        status: pending
      - id: s1-server-18k
        content: "Measure per-request CPU (µs of user and of system time a request) and idle-connection memory on bench/http1-server.ts (GET /json, one core, as bench/http.mjs runs it), and at 18,000 keep-alive connections over epoll and over NET_LISTEN_RING slots with bench/handler-ring. Use a route that touches no database (add one to bench/handler-ring/server.ts if it has none), so the figure is comparable with the entry's 404. Interleave the builds as run.sh does, give the noise band and the exact commands. These are the 'before' figures stage s2 compares against."
        status: pending
      - id: s1-verdict
        content: "From the breakdown, give the upper bound on what a lean path could save per request: everything header spans cost for unread fields, the per-request state reset a lean parser would skip, and the cache misses at 18,000 connections that per-connection state no longer needed between requests costs (measured in the -dram shape, not assumed). Date is kept by the lean mode (see the plan body), so its cost is reported but not counted as a saving. Compare the bound with 0.5 µs, on the wall clock of this container and as a share of the measured 5.1 µs. End the section with one line, `Verdict: GO` or `Verdict: STOP`, and the figure it rests on."
        status: pending
      - id: s1-record
        content: "Write it as a dated section of docs/BENCHMARKS.md (and the bench READMEs the benches have), naming the commit whose bench code produced each table and claiming only the fields that version prints, per CLAUDE.md's definition of done. Every 'up to', 'only' and 'lower than' is checked against the table it summarises."
        status: pending
  - id: s2-lean-mode
    title: "feat(net): add an opt-in lean Http1Config mode that parses only the fields a program names"
    goal: "Only if s1's merged verdict is GO. A program sets an Http1Config mode naming the fields it reads (here authorization and content-length) and accepting only Content-Length bodies; the parser then keeps spans only for the named fields, keeps no per-connection state that is not needed between requests, and still sends Date. Every property of docs/security/http1-codec.md still holds in the mode — the request-smuggling refusals, the limits and the headTimeout slowloris deadline — each pinned by a tests/link case run in the lean mode. Per-request CPU and idle-connection memory are re-measured against s1's figures."
    verification: "npm run build && node tests/run.js http1 && node tests/run.js net_handler && node tests/run.js std_http1 && node tests/nish-cmp.js && node tests/self/goldens.js && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && npm run lint && npm run check"
    todos:
      - id: s2-config
        content: "Add the opt-in to Http1Config (std/net/http1-server.ts), off by default: a list of the field names the program reads (lowercase) and a switch that accepts only Content-Length bodies. Reachable from nish/net/handler's HandlerLimits.http as every other Http1Config field is. A doc comment with @param/@returns for every new public declaration (gen-reference --check)."
        status: pending
      - id: s2-parse
        content: "In std/net/http1-codec.ts, under the mode: every field line is still scanned, checked for control bytes, obs-fold, bare LF, whitespace before the colon, counted against maxHeaders and maxHeaderBytes, and its name classified by http1FramingField, so Host, Content-Length, Transfer-Encoding, Connection and Upgrade are still seen and refused exactly as now. Only the named fields and the framing fields get spans; other fields are neither lowercased into the head copy nor stored. A request with Transfer-Encoding is refused (state which status and why) since the mode reads only Content-Length bodies; an Upgrade request is refused or ignored, decided and recorded. headerIndex answers -1 for a name the mode was not given, and that is documented."
        status: pending
      - id: s2-state
        content: "Under the mode, keep on a connection only what is needed between requests (keep-alive, the held head per H1-5, the limits, the shared pools); per-request parse state lives in what the server lends while a request is in flight, or is otherwise not held by an idle connection. Measure the idle connection's bytes with bench/http1-conn's rss shape and say where each byte that is left goes."
        status: pending
      - id: s2-security
        content: "Every property in docs/security/http1-codec.md holds in the mode, each with a tests/link case run with the mode on: CL+TE, two Content-Length fields, a non-digit Content-Length, Transfer-Encoding at all, obs-fold, bare LF, whitespace before a colon, a bad or missing Host (H1-9), maxTarget 414, maxHeaderBytes 431 (unnamed fields counted), maxHeaders 431, maxBody 413, the headTimeout deadline (H1-1) and the held head (H1-5). Add the mode to the record's scope and a finding for it (scope, what it skips, why that skip is safe), with before/after tests where the mode refuses something the general path accepts, and update its row in docs/security/README.md."
        status: pending
      - id: s2-measure
        content: "Re-run s1's benches on the mode: the instruction and ns breakdown, bytes per idle and serving connection, bench/http1-server.ts per-request CPU, and bench/handler-ring at 18,000 connections over epoll and NET_LISTEN_RING, interleaved against main with a byte-identical copy for the noise band. Record before/after in docs/BENCHMARKS.md beside s1's section. A bench server that uses the mode is an opt-in flag on the bench, not a change to the default."
        status: pending
      - id: s2-docs
        content: "docs/guide/using-nish/http-server.md (and api-server.md if it shows Http1Config) gains the mode: what it reads, what it refuses, that Date is still sent and why. Regenerate docs/reference with node scripts/gen-reference.mjs and tests/self/goldens/checked with node tests/self/goldens.js --update. A std change that moves a nish-cmp corpus program's IR adds narrow DECLARED entries to tests/nish-cmp.js with this PR's release-note words."
        status: pending
---

# Http1Server's lean path

Requirements (from the owner): in the twelve-dollar challenge entry
`nish-std-amritk`, a request that touches no database (a 404) costs 5.1 µs on
one core, about 3 µs of it in the kernel. Http1Server parses every header line
into spans, sends a Date on every response, and keeps per-request parser state
on every connection. In 0.41.0 an idle connection costs 813 bytes and about
1.6 KB while serving; the leaderboard's C entries spend about 40 bytes.

1. Measure first: instructions and bytes per request for a minimal GET -> 200
   JSON on Http1Server, broken down into head parse, header spans, Date,
   response head and sendBody.
2. If the lean path would save more than about 0.5 µs, add an opt-in
   Http1Config mode (request line, named headers such as `authorization` and
   `content-length`, Content-Length bodies only; no per-connection state not
   needed between requests). Everything in docs/security/http1-codec.md must
   still hold.
3. Report per-request CPU and idle-connection memory before and after, on
   bench/http1-server.ts and at 18k connections, including over io_uring ring
   slots (NET_LISTEN_RING).

If the general path is within about 0.5 µs of the lean one, say so and stop.

## Shape of the run

The two stages are **serial, and s2 is conditional.** s2 does not start until
s1 has merged with `Verdict: GO`. On `Verdict: STOP` the run marks s2
`skipped (STOP verdict)` — not escalated — and goes to acceptance; that is the
answer the owner said is fine. They are not one stage because s1 is worth
merging on its own whatever it finds, and its verdict decides whether s2
exists at all.

## The Date decision (made at planning)

RFC 9110 §6.6.1: an origin server *with a clock* MUST generate a Date field in
2xx, 3xx and 4xx responses and MAY in 1xx and 5xx; an origin server *without a
clock* MUST NOT generate one. (Quoted from the RFC as known; rfc-editor.org is
not reachable from this environment, and the repository already cites the same
rule at `std/net/http1-server.ts:436`.) A Linux server reading
`CLOCK_REALTIME` has a clock, so the "no trusted clock" exemption does not
describe it, and omitting Date would break a MUST. **The lean mode keeps
Date.** It is cheap by construction: `HttpDate` formats at most once a second
and `hold` reads the clock once per serve call. s1 measures what it costs so
the record says so; a large figure is a reason to make Date cheaper, not to
drop it.

## Facts the stages rest on (read at base `792a4335`)

- `Http1Parser` (`std/net/http1-codec.ts`, from ~line 180): `buf` and `head`
  are lent back while idle (`Http1Config.idleInput`, on by default); `spans`
  (4 i32 a field, first size 64) and `Http1ListTally` are per connection and
  never lent. About 40 i32 fields of per-request parse state are reset by
  `http1StartRequest` (~line 700). `keepText` is already off in the server.
- Every field line becomes spans in `http1FieldLine` (~line 1401): lowercased
  by `http1LowerName`, copied into `head`, stored by `http1SpanSet`.
  `http1FramingField` (~1166) classifies host, upgrade, connection,
  content-length and transfer-encoding; `http1EndOfHead` (~1495) makes every
  smuggling refusal. A lean mode must keep both.
- `HttpDate` is one per server, shared by its connections; Date is written by
  `http1WriteResponseHead` (~2509) on a final status. No flag disables it.
- `Http1Connection` (`std/net/http1-server.ts`, ~748–1000) holds the parser,
  the kept response head (`headBytes`, up to 1024 bytes), clocks, response
  state and WebSocket state.
- Benches: `bench/http1-conn` (shapes hot, cold, idle, direct, `-dram`,
  stages, rss), `bench/http1-request` (`--validate`, `--instructions`),
  `bench/http1-server.ts` with `bench/http.mjs`, `bench/handler-ring`
  (18,000 and the box's C; `BENCH_RING=1` sets `HandlerLimits.ring`, i.e.
  `NET_LISTEN_RING`). Its server does a SQLite lookup per request, so a
  no-database route may need adding.
- Existing figures (bench/http1-conn README, 2026-11-08): the library's stages
  total about 590 ns a cold request on x86 (parse about 312, respond about
  106, sendBody about 77), about 6,400 instructions. So the CPU bound alone is
  unlikely to clear 0.5 µs; what s1 must settle is whether the cache misses of
  per-connection state at 18,000 connections do.
- docs/security/http1-codec.md: smuggling refusals are a prose property
  (lines ~130–146), limits under "Caps" (~541–548), H1-1 is the headTimeout
  deadline, H1-5 the held head, H1-9 Host validation; scope covers
  http1-codec.ts, http1-server.ts, `httpDateWrite`, websocket.ts.
- `std/net/websocket.ts` reads `p.spans` as an `i32[]`; s2 keeps that working.
- The open run `wp63-ring-gaps` (#1708, PR #1717) also edits
  `bench/handler-ring/**` and `docs/BENCHMARKS.md`. A textual conflict there
  is resolved by s1's worker merging `main`.

## S1 — measure

**Owns:** `bench/http1-conn/**`, `bench/http1-request/**`,
`bench/handler-ring/**`, `bench/http1-server.ts`, `bench/http.mjs`,
`bench/README.md`, `docs/BENCHMARKS.md`

Measurement only: no change to `std/`, `src/` or `runtime/`. The verdict line
is what the lead reads to decide whether s2 is spawned.

## S2 — the lean mode (only on GO)

**Owns:** `std/net/http1-codec.ts`, `std/net/http1-server.ts`,
`std/net/handler.ts`, `std/net/websocket.ts`, `tests/link/net_http1*/**`,
`tests/link/std_http1*/**`, `tests/link/net_http1_lean*/**`,
`tests/link/net_handler*/**`, `tests/run.js`, `tests/nish-cmp.js`,
`docs/security/http1-codec.md`, `docs/security/README.md`,
`docs/guide/using-nish/http-server.md`, `docs/guide/using-nish/api-server.md`,
`docs/BENCHMARKS.md`, `bench/http1-conn/**`, `bench/http1-server.ts`,
`bench/handler-ring/**`, `bench/README.md`

Generated (regenerate, never hand-edit): `tests/self/goldens/checked/**`,
`docs/reference/**`, `tests/differential/emit-ts-known.txt`.
