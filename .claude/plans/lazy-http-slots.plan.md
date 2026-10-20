---
name: Allocate HTTP server slots lazily
overview: Http1Server, Http1TlsServer and TlsTcpServer build every slot's connection in the constructor, which is nearly all of nish's startup time and RSS at the bench's 16,384 slots. Keep the slot count as a cap and build a slot's connection the first time accept puts a socket in it, reusing it from then on with Arena.used() flat.
stages:
  - id: http1-lazy
    title: "perf(std): build an HTTP/1.1 slot's connection on its first accept"
    goal: Http1Server and Http1TlsServer allocate no Http1Connection up front; accept builds one per slot on first use and reuses it after, with every slot reader safe on a slot never built
    verification: node tests/run.js link && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm test
    todos:
      - id: h1-slot-state
        content: Rework Http1Server's slot state in std/net/http1-server.ts so the constructor builds no connection, with O(1) accept in order 0, 1, 2 — see Http1Server
      - id: h1-readers
        content: Make every reader of connections, fds and armed in Http1Server safe on an unbuilt slot (connection, holds, fd, busy, expire, close, rearm, readable, writable, next, flush) — see Readers
      - id: h1-tls-twin
        content: Apply the same to Http1TlsServer, building a slot's Http1Connection when TlsTcpServer.accept first hands it that slot — see Http1TlsServer
      - id: h1-tests
        content: Add the startup, first-accept, warm-slot and negative checks to tests/link/net_http1_server and its TLS twin — see Tests
      - id: h1-docs
        content: Update the http1-server.ts header and both constructor JSDocs, docs/security/http1.md, the guide, std/README.md and docs/wp39-http-server.md — see Docs
      - id: h1-measure
        content: Measure startup and throughput against nish-copy and record them in bench/README.md and the commit trailer — see Measure
      - id: h1-goldens
        content: Regenerate tests/self/goldens/checked.txt with node tests/self/goldens.js --update and read the diff — see Verification
  - id: tls-tcp-lazy
    title: "perf(std): build a TLS slot's record server on its first accept"
    goal: TlsTcpServer allocates no TlsServer, TlsRecordServer or random per slot up front; accept builds them on a slot's first use and reuses them after, and its BufferPool ceiling stays the slot count with nothing made at construction
    verification: node tests/run.js link && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm test
    todos:
      - id: tls-slot-state
        content: Rework TlsTcpServer's slot state in std/net/tls-tcp.ts the same way, building TlsRecordServer, TlsServer and the slot's random on first accept — see TlsTcpServer
      - id: tls-readers
        content: Make every TlsTcpServer reader safe on an unbuilt slot, and every caller in std/net that indexes tls.connections or calls tls.connection (http1-server.ts, http2-tls.ts) — see TlsTcpServer
      - id: tls-tests
        content: Add the construction, first-accept, reuse and unbuilt-slot checks to tests/link/net_tls_record_tcp and net_tls_memory — see Tests
      - id: tls-docs
        content: Update the tls-tcp.ts constructor JSDoc and docs/security/tls.md, and re-measure startup in bench/README.md — see Docs
      - id: tls-goldens
        content: Regenerate tests/self/goldens/checked.txt and read the diff — see Verification
---

## Context

[`std/net/http1-server.ts`](../../std/net/http1-server.ts) `Http1Server` (line 1222) pushes one `Http1Connection` per slot, plus `fds`, `armed` and the `free` stack; `Http1TlsServer` (line 1480) pushes one `Http1Connection` per `tls.size()`. [`std/net/tls-tcp.ts`](../../std/net/tls-tcp.ts) `TlsTcpServer` (line 124) pushes a `TlsRecordServer(new TlsServer(...))` and a 32-byte random per slot. [`bench/http1-server.ts`](../../bench/http1-server.ts) defaults to 16,384 slots: 51.7 ms to first answer and 65.3 MB RSS, against 7.4 ms / 5.8 MB at 1,024 slots and Go's 7.9–9.6 ms / 7.4 MB.

## Approach

- **Cap, not cost.** `size()` stays the cap. `accept` refuses with `H1_POOL_FULL` (TLS: its own full answer) at exactly `size` busy slots, as now.
- **Slot choice.** Suggested: a high-water mark `built` for slots never used plus the existing `free` stack for released ones; accept pops `free` first, else takes `built` and builds its connection. That keeps order 0, 1, 2, … and O(1), and the arrays grow by `push` only when a slot is first built. The worker may pick another shape that keeps both properties and must say why in the commit body.
- **One allocation per new slot.** An accept that reaches a never-built slot allocates exactly one connection (and, for TLS, its record server and random); one that reuses a slot allocates nothing. Warm slots keep the `Arena.used()`-flat rule in the file header.
- **Unbuilt slots read as free.** `holds` false, `fd` −1, the per-slot calls answer as they do for a free slot today. `connection(slot)` currently falls back to slot 0 for an out-of-range index; with no slot built it has nothing to fall back to. Decide one behaviour (e.g. a single sentinel connection made in the constructor, or build slot 0 eagerly, or panic) and pin it with a test; the existing `net_http2_tls` check "a slot out of range names the first connection" must keep passing unchanged.
- **DoS bound unchanged.** Peak memory is still `size` × the per-connection caps; `docs/security/http1.md` and `docs/security/tls.md` keep the bound, with rows re-anchored per CLAUDE.md's record rules (state the commit the anchors are at).

## Http1Server

Constructor builds no `Http1Connection`. `accept` takes a slot per Approach and builds on first use; `date`, config and anything the constructor set on each connection is set at build time instead.

## Readers

Every method that indexes `connections`, `fds` or `armed` is checked against an index that is in range of the cap but not built: `connection`, `holds`, `fd`, `busy`, `expire`, `close`, `rearm`, `readable`, `writable`, `next`, `flush`. Grep `std/net/` and `tests/link/` for other indexers.

## Http1TlsServer

Its slot index comes from `TlsTcpServer.accept`, which may hand out any slot index below the cap. Build the `Http1Connection` for that index on first use (the array may need a sparse form, e.g. growing to the index, or nullable entries — whichever the checker and the performance ratchet accept with no new NL9007). `idle`/`expire`, `close` and `connection` follow Readers.

## TlsTcpServer

Stage 2. Builds on #713 (TLS record buffers borrowed from a `BufferPool`), which edits the same constructor, so this stage starts only once #713 has merged and after `http1-lazy` merged. Same slot scheme as Http1Server; the `BufferPool` keeps ceiling = slot count and makes nothing at construction. Callers: `Http1TlsServer` (stage 1's code), `Http2TlsServer` in [`std/net/http2-tls.ts`](../../std/net/http2-tls.ts) via `tls.connection(slot)` — touch it only as far as a reader of an unbuilt TLS slot needs.

## Tests

Read `.claude/testing.md` first. In `tests/link/net_http1_server` (and its TLS harness):

- A 16,384-slot pool's construction moves `Arena.used()` by a small fixed amount, pinned as a measured byte ceiling.
- The first accept into a slot allocates (one connection); the second accept into that slot, after a close, allocates nothing.
- A warmed slot serves many requests with `Arena.used()` flat.
- Negative: pool-full at exactly `size` busy slots; `connection`, `fd` and `holds` on a never-built slot; close-and-reaccept reuses without allocating.

Stage 2 adds the same for `TlsTcpServer` in `net_tls_record_tcp` / `net_tls_memory` as far as their harness allows. Every existing `net_http1_server*`, `net_http2_tls*`, `net_tls_*` and `net_loopback` expected output stays unchanged except for added lines.

## Docs

Stage 1: the header of `http1-server.ts` ("Every buffer is allocated by the constructor…"), both constructor JSDocs, [`docs/guide/using-nish/standard-library.md`](../../docs/guide/using-nish/standard-library.md) where it describes the pool or slots, [`docs/security/http1.md`](../../docs/security/http1.md), [`std/README.md`](../../std/README.md), [`docs/wp39-http-server.md`](../../docs/wp39-http-server.md), and `bench/README.md`'s startup paragraph. Grep the tree for other "preallocated"/"allocated here" claims about slots. Stage 2: `tls-tcp.ts` header and constructor JSDoc, [`docs/security/tls.md`](../../docs/security/tls.md), and `bench/README.md` re-measured.

## Measure

`node bench/http.mjs --only startup` at the default 16,384 slots, against `nish-copy` for the noise band; then ping, query and body to show throughput is inside the band. Figures go in the commit's `Measured:` trailer and replace the numbers in `bench/README.md` that blame slot preallocation.

## Stage ownership

**http1-lazy** — **Owns:** `std/net/http1-server.ts`, `tests/link/net_http1_server*/**`, `docs/security/http1.md`, `docs/guide/using-nish/standard-library.md`, `std/README.md`, `docs/wp39-http-server.md`, `bench/README.md`, `tests/self/goldens/checked.txt` (generated). Depends on: the bench branch `claude/lucid-pasteur-n9t5md` merged.

**tls-tcp-lazy** — **Owns:** `std/net/tls-tcp.ts`, `std/net/http1-server.ts` (only `Http1TlsServer`'s calls into `tls`), `std/net/http2-tls.ts` (only reads of `tls.connection`), `tests/link/net_tls_record_tcp*/**`, `tests/link/net_tls_memory*/**`, `docs/security/tls.md`, `bench/README.md`, `tests/self/goldens/checked.txt` (generated). Depends on: `http1-lazy` merged and #713 merged; development starts only then, so its Owns may overlap stage 1's.

## Out of scope

`Http2TlsServer`'s own per-slot `Http2Connection` and the HTTP/3/QUIC servers (unless sign-off adds a stage). Changing the default `--slots` in the bench. Any change to the per-connection caps.

## Verification

`node tests/run.js link` for what changed; `node tests/run.js wasi` and `node tests/run.js performance` (std/ is linked into the wasi module); `npm run check`; `npm run lint` read by exit status; `node tests/self/goldens.js --update` with the diff read; the full `npm test` before opening the PR, skip count read. Commit type `perf(std)`.
