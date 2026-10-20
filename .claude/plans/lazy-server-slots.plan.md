---
name: Build the TLS, HTTP/2 and HTTP/3 servers' slots on first accept
overview: "#734 made Http1Server build a slot's connection on the first accept into it, so its slot count is a cap rather than a cost paid at start-up. TlsTcpServer (and Http1TlsServer on it), Http2TlsServer and Http3Server still build every slot before they listen: the interop server's comment puts a QUIC slot at 12.2 MB, an HTTP/2 slot at 278 KB and an HTTPS/1.1 slot at 160 KB, so 64 slots start at 809 MB. Apply the same change to each, measure start-up RSS before and after with bench/pool-rss.mjs, and fix the stale preallocation claim #744 names. #744's criteria 1 and 2 (the bench server's RSS gap and the wrk throughput run) stay with the owner."
stages:
  - id: tls-lazy
    title: "perf(std): build TlsTcpServer's and Http1TlsServer's slots on first accept"
    goal: TlsTcpServer and Http1TlsServer allocate a slot's TLS record server, server random and Http1Connection on the first accept into it and keep them, with accept order, O(1) slot finding, size() and the pool-full answer unchanged
    verification: npm run check && npm run lint && node tests/run.js net_tls && node tests/run.js net_http1_server && node tests/run.js net_loopback && node tests/run.js net_interop_server && node tests/run.js runtime-budget && node tests/run.js wasi && node tests/run.js performance && npm test
    todos:
      - id: tls-measure-before
        content: Build the interop server at the base commit and record per-pool start-up RSS and time for h1s with bench/pool-rss.mjs --per-pool, plus a byte-identical copy for the noise band — see Measuring
        status: pending
      - id: tls-lazy-ctor
        content: Make TlsTcpServer's constructor build no TlsRecordServer, TlsServer or random per slot, and build a slot's on its first accept with a high-water mark plus a free stack, as Http1Server does — see TLS-TCP and HTTPS/1.1
        status: pending
      - id: tls-h1s-lazy
        content: Make Http1TlsServer build a slot's Http1Connection on its first accept, and make every reader of both classes safe on a slot never built — see TLS-TCP and HTTPS/1.1
        status: pending
      - id: tls-tests
        content: Add construction-bytes ceilings for a large TlsTcpServer and Http1TlsServer to tests/runtime-budgets.js, enforced by tests/run.js, plus first-accept, re-accept, pool-full and never-built-slot checks — see Tests
        status: pending
      - id: tls-measure-after
        content: Re-measure h1s per-pool RSS and time against the base and its copy, and put the figures in the commit's Measured trailer — see Measuring
        status: pending
      - id: tls-docs
        content: Update the classes' header comments and JSDoc, and docs/security/tls.md and http1.md where they say slots are built up front, re-anchoring moved rows — see TLS-TCP and HTTPS/1.1
        status: pending
      - id: tls-goldens
        content: Regenerate tests/self/goldens/checked.txt and checked-self.txt with node tests/self/goldens.js --update and read the diff
        status: pending
  - id: h3-lazy
    title: "perf(std): build Http3Server's slots on first accept"
    goal: Http3Server allocates a slot's QuicConnection, Http3Connection and address on the first Initial accepted into it and keeps them, with the slot cap, the refused counter and every per-slot memory bound unchanged
    verification: npm run check && npm run lint && node tests/run.js net_http3 && node tests/run.js net_quic && node tests/run.js net_webtransport && node tests/run.js net_loopback && node tests/run.js net_interop_server && node tests/run.js runtime-budget && node tests/run.js wasi && node tests/run.js performance && npm test
    todos:
      - id: h3-measure-before
        content: Record per-pool start-up RSS and time for h3 at the base commit with bench/pool-rss.mjs --per-pool, plus a byte-identical copy for the noise band — see Measuring
        status: pending
      - id: h3-lazy-ctor
        content: Make Http3Server's constructor build no QuicConnection, Http3Connection or address per slot, and build a slot's on the first Initial into it, drawing its entropy then — see HTTP/3
        status: pending
      - id: h3-readers
        content: Make every reader of quics, conns and addresses safe on a slot never built, including callers in std/net/webtransport.ts and examples/relay — see HTTP/3
        status: pending
      - id: h3-tests
        content: Add a construction-bytes ceiling for a large Http3Server to tests/runtime-budgets.js, enforced by tests/run.js, plus first-accept, re-accept, refused-at-cap and never-built-slot checks — see Tests
        status: pending
      - id: h3-measure-after
        content: Re-measure h3 per-pool RSS and time against the base and its copy, and put the figures in the commit's Measured trailer — see Measuring
        status: pending
      - id: h3-docs
        content: Update Http3Server's header comment and JSDoc, and docs/security/http3.md and quic.md where they say slots are made up front, re-anchoring moved rows — see HTTP/3
        status: pending
      - id: h3-goldens
        content: Regenerate tests/self/goldens/checked.txt and checked-self.txt with node tests/self/goldens.js --update and read the diff
        status: pending
  - id: h2-lazy
    title: "perf(std): build Http2TlsServer's connections on first accept"
    goal: Http2TlsServer allocates a slot's Http2Connection on the first accept into it and keeps it, with size(), the pool-full answer and the shared Http2Pools ceiling unchanged
    verification: npm run check && npm run lint && node tests/run.js net_http2 && node tests/run.js net_loopback && node tests/run.js net_interop_server && node tests/run.js runtime-budget && node tests/run.js wasi && node tests/run.js performance && npm test
    todos:
      - id: h2-lazy-ctor
        content: Make Http2TlsServer's constructor build no Http2Connection per slot while still refusing a bad config at construction, and build a slot's on its first accept — see HTTP/2
        status: pending
      - id: h2-readers
        content: Make every reader of connections safe on a slot never built — see HTTP/2
        status: pending
      - id: h2-tests
        content: Add a construction-bytes ceiling for a large Http2TlsServer to tests/runtime-budgets.js, enforced by tests/run.js, plus first-accept, re-accept and never-built-slot checks — see Tests
        status: pending
      - id: h2-measure
        content: Once tls-lazy is on main, merge main and measure h2 per-pool RSS and time against the base commit and a byte-identical copy; figures in the Measured trailer — see Measuring
        status: pending
      - id: h2-docs
        content: Update Http2TlsServer's header comment and JSDoc, and docs/security/http2.md where it says slots are built up front, re-anchoring moved rows — see HTTP/2
        status: pending
      - id: h2-goldens
        content: Regenerate tests/self/goldens/checked.txt and checked-self.txt with node tests/self/goldens.js --update and read the diff
        status: pending
  - id: pool-docs
    title: "docs(bench): say what each server builds before it listens"
    goal: No prose in the repo says a server builds its slots before it listens; bench/README.md's Pool memory section records start-up RSS per pool at the base commit and on main, measured together
    verification: npm run check && npm run lint && node tests/run.js net_interop_server && npm test
    todos:
      - id: docs-claim
        content: Rewrite bench/README.md's Pool memory paragraph (the "builds a connection pool per carrier before it listens ... each --slots connections deep" claim) and bench/http.mjs's header comment about the slot pool built before listening — see Pool docs
        status: pending
      - id: docs-bind-lazily
        content: In tests/link/net_interop_server/server.ts and examples/relay/relay.ts, bind each slot's WebTransport on the first accept into the slot instead of calling Http3Server.connection(slot) for every slot at start-up, which builds every QUIC slot and hides h3-lazy's start-up win — see Pool docs
        status: pending
      - id: docs-measure
        content: Measure bench/pool-rss.mjs --per-pool at 16,64,256,1024 slots for the base commit and main in the same interleaved rounds, with a byte-identical copy of main for the noise band, and record the table in bench/README.md — see Pool docs
        status: pending
      - id: docs-prose
        content: Update the per-slot cost comment in tests/link/net_interop_server/server.ts, the guide's standard-library.md pool text, std/README.md's rows and docs/wp39-http-server.md — see Pool docs
        status: pending
---

## Context

Issue #744 left three items after #734 (`4765ef2`), which made `Http1Server`
build a slot's `Http1Connection` on the first `accept` into it. This run takes:

- **Item 3**, the stale claim at `bench/README.md` "Pool memory" (lines 828–829
  on `main` at `c8a00d6`; #744 cites 795–798 at its older base): "builds a
  connection pool per carrier before it listens: QUIC for HTTP/3, HTTP/2,
  HTTPS/1.1 and plain HTTP/1.1, each `--slots` connections deep", and the same
  wording in `bench/http.mjs`'s header comment.
- **"Also unblocked"**, the same lazy-slot change for `Http1TlsServer`
  (`std/net/http1-server.ts` ~1494), `TlsTcpServer` (`std/net/tls-tcp.ts` ~111,
  which `Http1TlsServer` and `Http2TlsServer` both sit on), `Http2TlsServer`
  (`std/net/http2-tls.ts` ~79) and `Http3Server` (`std/net/http3-server.ts`
  ~414), with start-up RSS measured before and after.

**Not this run:** #744's criteria 1 (the 0.7 MB RSS gap between 16,384 and
1,024 slots in `bench/http1-server.ts`) and 2 (ping, query and body throughput
under `wrk`). They are the owner's. No stage changes `bench/http1-server.ts`, no
PR says it settles either one, and no PR closes #744: each says `Refs #744`,
never `Fixes #744`.

The reference implementation is `Http1Server` at `c8a00d6`
(`std/net/http1-server.ts` 1197–1300 and its `accept`): a high-water mark for
slots never used, a `free` stack for released ones, arrays grown by `push`,
`size()` still the cap, and a `connection(slot)` on a slot never built that
answers a defined value. Read #734's commit body and diff before starting: the
shape, the tests (`tests/link/net_http1_server/startup.ts`, the
`HTTP1_SERVER_START_BYTES` ceiling in `tests/runtime-budgets.js` and its
check in `tests/run.js` ~6301) and the docs it moved are the template.

## Shared files across concurrent stages

`tls-lazy`, `h3-lazy` and `h2-lazy` run at once. Each also needs
`tests/runtime-budgets.js`, `tests/run.js` and the two generated goldens. These
are shared deliberately and narrowly:

- `tests/runtime-budgets.js`: each stage adds only its own `*_START_BYTES`
  constant(s), with a measurement comment in the file's style, directly after
  `HTTP1_SERVER_START_BYTES`.
- `tests/run.js`: each stage adds only its own check(s) beside its carrier's
  existing section, and its constant(s) to the `runtime-budgets.js` import.
  That import line is the one place two stages will conflict; the later stage
  resolves it when it merges `main`.
- `tests/self/goldens/checked.txt` and `checked-self.txt` are regenerated with
  `node tests/self/goldens.js --update`, never hand-merged.

Merge order: `tls-lazy`, then `h3-lazy` (or `h3-lazy` first if it converges
first; neither depends on the other), then `h2-lazy`, then `pool-docs`.

## TLS-TCP and HTTPS/1.1

**Owns:** `std/net/tls-tcp.ts`, `std/net/http1-server.ts` (the `Http1TlsServer`
class and constants it alone uses; `Http1Server` is not changed),
`tests/link/net_tls_record_tcp/**`, `tests/link/net_tls_record_tcp_f64/**`,
`tests/link/net_tls_memory/**`, `tests/link/net_http1_server/**`,
`docs/security/tls.md`, `docs/security/http1.md`, plus the shared files above.

- `TlsTcpServer`'s constructor builds today, per slot, a `TlsServer`, a
  `TlsRecordServer` that borrows from `pools`, a 32-byte random and an `fds`
  entry. Build each on the first `accept` into the slot and keep it. Keep the
  free-slot behaviour (`TLS_RECORD_STATE_FAILED` fail-closed on a free slot)
  for a slot never built: every reader (`connection`, `holds`, `fd`, `busy`,
  `readable`, `writable`, `signP256`, close and expiry paths, anything else)
  answers a never-built slot as it answers a free one, without panicking or
  reading out of bounds. `TlsRecordPools`' ceiling stays one per slot.
- `Http1TlsServer` builds one `Http1Connection` per slot in its constructor;
  build each on the slot's first `accept` instead. `connection(slot)` falls
  back to index 0 today, which may not exist now: give it a defined answer, as
  `Http1Server.connection` does, and say it in the JSDoc.
- The placeholder zero key and the per-slot randoms: say in the commit body
  what is allocated when and why the handshake's security properties are
  unchanged (the slot's `TlsServer` is still restarted with real randomness on
  every accept).
- Update the header comments and constructor JSDoc of both classes, and
  `docs/security/tls.md` and `http1.md` where they say slots are built up
  front. Re-anchor every row whose `file:line` anchors move, naming the commit
  they are at, and grep every cited `check(...)` name against `tests/run.js`
  (CLAUDE.md, Security).
- Callers to read, and change only if they relied on a slot built up front:
  `tests/link/net_interop_server/server.ts`, `tests/link/net_tls_resume/tcp.ts`,
  `tests/link/net_tls_wipes/checks.ts`, `tests/link/net_loopback/tcp.ts`,
  `examples/relay/relay.ts`. If one needs a change outside this stage's Owns,
  say so in the PR body rather than making it.

## HTTP/3

**Owns:** `std/net/http3-server.ts`, `tests/link/net_http3_server/**`,
`tests/link/net_http3_server_f64/**`, `tests/link/net_http3_server_bad_config/**`,
`docs/security/http3.md`, `docs/security/quic.md`, plus the shared files above.

- The constructor builds today, per slot, a `QuicConnection` (with fresh
  entropy from `crypto.getRandomValues`), its stream-pool sharing, an
  `Http3Connection` sharing `dataPool` and `sectionPool`, and a 20-byte
  address. This is the costly pool: the interop server's comment puts a QUIC
  slot at 12.2 MB resident. Build each on the first Initial accepted into the
  slot and keep it; draw the slot's entropy then. `streamPools` is built from
  the first connection's stream table today (`k === 0`); keep it built once,
  from whichever connection is built first, or from the config if that is
  equivalent — say which in the commit body.
- `free` is seeded with every index today. Use a high-water mark plus the free
  stack, as `Http1Server` does, keeping slot order and O(1) finding. The
  `refused` counter still counts an Initial dropped at exactly `size` busy.
- The fixed per-slot tables — `Http3CidIndex`, `Http3Wheel`, `signatures`,
  `state`, `readyRing`, `dirtyStack`, `queued` — are words per slot, not the
  per-slot connection state. They may stay sized by the cap. State their
  measured bytes per slot in the commit body; making them grow is out of
  scope.
- Every reader of `quics`, `conns` and `addresses` (`size`, `holds`,
  `connection`, the ready/dirty/flush/expiry paths, `stop`'s wipes and
  anything else) is safe on a slot never built. `size()` still answers the
  cap, not the number built: it reads `quics.length` today. `stop` still
  wipes every built slot's secrets.
- Callers to read, and change only if they relied on slots built up front:
  `std/net/webtransport.ts`, `examples/relay/relay.ts`,
  `tests/link/net_interop_server/server.ts`, `tests/link/net_loopback/udp.ts`,
  `tests/link/net_webtransport/record.ts`. If one needs a change outside this
  stage's Owns, say so in the PR body rather than making it.
- `docs/security/http3.md` (H3-1 says "The slot is made once and `reset`") and
  `quic.md` (QUIC-3): the bounds still hold, a slot now being made on its
  first connection. Re-anchor moved rows and grep cited check names, as
  above.

## HTTP/2

**Owns:** `std/net/http2-tls.ts`, `tests/link/net_http2_tls/**`,
`tests/link/net_http2_tls_f64/**`, `docs/security/http2.md`, plus the shared
files above.

- The constructor builds one `Http2Connection` per slot, then `Http2Pools`
  after them "so a config they refuse panics with their words". Build each
  slot's connection on its first accept instead, and keep a bad config
  refused at construction with the same words (`tests/link/net_http2_bad_config`
  must pass unchanged). `Http2Pools`' ceiling stays `size`.
- Every reader of `connections` (`connection`, which falls back to index 0
  today, `next`, `flush`, `date` refresh, close and expiry, anything else) is
  safe on a slot never built.
- `TlsTcpServer` underneath becomes lazy in `tls-lazy`. This stage can be
  written and tested against `main` now; its measurement waits until
  `tls-lazy` is merged, when the lead tells the worker to merge `main`.
- Callers to read: `tests/link/net_interop_server/h2.ts` and `server.ts`.

## Tests

Read `.claude/testing.md` first. For each server, as `net_http1_server`'s
`startup.ts` does for `Http1Server`:

- Constructing a large pool (16,384 slots for TLS-TCP, HTTPS/1.1 and HTTP/2;
  for HTTP/3, the largest count its fixed tables allow in the test's arena)
  allocates a small, fixed number of bytes, measured with `Arena.used()`
  before and after. The figure is a ceiling in `tests/runtime-budgets.js`,
  with a measurement comment in the file's style, enforced by a check in
  `tests/run.js`.
- The first accept into a slot allocates; closing it and accepting into it
  again allocates nothing; a warmed slot stays flat over many requests (an
  existing flat-arena check, or one beside it).
- Negative cases: the pool-full answer (or `refused` for HTTP/3) at exactly
  `size` busy slots, and `connection`, `fd` and `holds` (or their HTTP/3
  equivalents) on a slot never built.
- The existing link tests for the carrier, `net_loopback*`,
  `net_interop_server*` and (for HTTP/3) `net_webtransport*` stay green with
  their expected output unchanged beyond lines the stage adds.
- `std/` changes, so run `node tests/run.js wasi` (with `WASI_SYSROOT` set if
  the sysroot is installed; read its skip line) and `node tests/run.js
  performance` before pushing.

## Measuring

`bench/pool-rss.mjs` times the interop server from exec until all four ports
answer and reads `VmRSS` and `VmHWM`; `--per-pool` sizes one pool from
`--slots` and the others at one slot.

```bash
bash scripts/fetch-seed.sh --force && npm run build
build/nish tests/link/net_interop_server/main.ts -o build/interop.ir/ --link build/interop
cp build/interop build/interop-copy                       # byte-identical: the noise band
node bench/pool-rss.mjs --bin build/interop --slots 16,64,256,1024 --per-pool
```

Build the base commit (`c8a00d6`, or `main` at the stage's start) as
`build/interop-base` the same way in a separate worktree. Report, for the
stage's own pool (`h1s`, `h3` or `h2`): start-up RSS and time to listen at
each slot count, for base, head and the copy, in the same session. The figures
go in the commit's `Measured:` trailer, with the noise band, per CLAUDE.md's
rules on measured claims. If a slot count is too costly on the worker's
machine at base (`--cap`), drop it and say so.

## Pool docs

**Owns:** `bench/README.md`, `bench/http.mjs` (its header comment only),
`tests/link/net_interop_server/**`, `examples/relay/**`,
`docs/guide/using-nish/standard-library.md`, `std/README.md`,
`docs/wp39-http-server.md`. Starts after the three code stages are merged.

- *Added during the run (h3-lazy review, #779):* the interop server
  (`server.ts`, the `wts` loop after `new Http3Server`) and
  `examples/relay/relay.ts` (~351) call `Http3Server.connection(slot)` for
  every slot at start-up to bind a `WebTransport`, and `connection` builds the
  slot it names, so every QUIC slot is still built before the server listens:
  #779 measured no start-up RSS change in the interop server. Bind each slot's
  `WebTransport` on the first accept into it instead (or wherever the slot is
  first handed to the app), keep the interop and relay tests' expected output
  unchanged, and measure the `h3` pool before and after in this stage's table.

- `bench/README.md` "Pool memory": replace "builds a connection pool per
  carrier before it listens … each `--slots` connections deep" with what is
  true on `main`: each pool's slot count is a cap, a slot's connection is built
  on its first connection, and what each server still allocates per slot at
  start-up (HTTP/3's fixed tables). Record one `pool-rss.mjs --per-pool` table
  at 16, 64, 256 and 1,024 slots for the base commit `c8a00d6` and for `main`,
  with a byte-identical copy of `main` for the noise band.
- `bench/http.mjs` header: "the Nish server the slot pool it builds before it
  listens" is stale since #734. Say what the Nish server counts now.
- `tests/link/net_interop_server/server.ts`'s `slots` comment gives per-slot
  costs and "64 slots start at 809 MB resident and 256 at 3.2 GB": replace them
  with the measured figures on `main`.
- The guide's pool text, `std/README.md`'s rows for these servers and
  `docs/wp39-http-server.md`: remove any claim that slots are preallocated.
  `docs/README.md` has the guide page rules.
- Do not touch `bench/http1-server.ts` or the startup paragraph's account of
  the 1,024-vs-16,384 RSS gap: that is #744's criterion 1, the owner's.

## Verification

Each stage's `verification` line, run bare with exit statuses read, then one
undegraded `npm test` with the skip count read. Commits are `perf(std): …` for
the code stages and `docs(bench): …` for the last, with `Measured:`, `Refs:`
and `Tests:` trailers, and `Refs #744` in the PR body.
