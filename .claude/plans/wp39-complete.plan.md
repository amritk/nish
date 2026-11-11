---
name: WP39 complete — what wp34-finish does not already cover
overview: Finish every open, actionable WP39 box that the concurrent wp34-finish run (#1430) does not take — E5 on every core, Postgres over TLS, record_size_limit, a fixed-base P-256, a congestion controller beyond NewReno, G6 and G7 with their design notes, and G8's figures — then tick the roadmap. E9 (owner's decision) and G9 (deferred) stay open.
stages:
  - id: e5-prefork
    title: "perf(net): serve the TechEmpower json and plaintext entry on every core (WP39 E5)"
    goal: bench/techempower/main.ts runs one worker a core on one SO_REUSEPORT port through nish/net/prefork, as db-main.ts does, with figures against the one-process build
    verification: node tests/run.js tfb_entry && npm run check && npm run lint
    todos:
      - id: e5-main
        content: Move bench/techempower/main.ts onto preforkWith/preforkListener, worker count from available parallelism and a flag to force one — see E5 on every core
      - id: e5-test
        content: Extend tests/link/tfb_entry so it proves two workers answer on one port and the verifier checks still pass — see E5 on every core
      - id: e5-measure
        content: Measure one process vs one a core with bench/techempower/run.sh, interleaved, with the noise band, into the TechEmpower section of docs/BENCHMARKS.md — see E5 on every core
  - id: e6-pg-tls
    title: "feat(net): Postgres over TLS in the carrier (WP39 E6)"
    goal: The Postgres carrier sends SSLRequest and runs the G10 TLS client with chain and name validation, so a program can require TLS to its database; PG-9 is closed
    verification: node tests/run.js std_postgres && node scripts/security-scope.mjs && npm run check && npm run lint
    todos:
      - id: e6-sslrequest
        content: Add SSLRequest and its one-byte answer to std/net/postgres.ts with a tls mode (disable, require, verify-full) on the connect config — see Postgres over TLS
      - id: e6-carrier
        content: Run nish/net/tls/client inside std/net/postgres-carrier.ts on the program's loop, nonblocking, after the S answer — see Postgres over TLS
      - id: e6-tests
        content: Add a replay or loopback TLS test under tests/link/std_postgres_tls and a TLS case to tests/postgres/live plus the postgres-live job in ci.yml — see Postgres over TLS
      - id: e6-record
        content: Close PG-9 in docs/security/postgres.md with before/after tests and update docs/guide/using-nish/postgres.md — see Postgres over TLS
  - id: g7-note
    title: "docs: design note for one handler across HTTP/1.1, 2 and 3 (WP39 G7)"
    goal: A design note fixes the façade's API, Alt-Svc, h2c with prior knowledge and how "nothing allocates per request" survives, before any code
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: g7-note-write
        content: Write docs/wp39-g7-one-handler.md naming the module std/net/http-server.ts and the h2c carrier std/net/http2-cleartext.ts — see G7 design note
  - id: g6-note
    title: "docs: design note for QUIC on more than one core (WP39 G6)"
    goal: A design note picks between SO_ATTACH_REUSEPORT_EBPF and forwarding between processes, with the connection-ID layout and measurements that decide it
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: g6-note-write
        content: Write docs/wp39-g6-quic-multicore.md with the CID encoding, the steering choice and its security surface — see G6 design note
  - id: g8-figures
    title: "docs(bench): HTTP/2 and HTTP/3 figures from the h2load harness (WP39 G8)"
    goal: docs/BENCHMARKS.md carries HTTP/2 and HTTP/3 requests per second from bench/h2load.mjs, with the noise band and the machine named
    verification: grep -q "HTTP/3" docs/BENCHMARKS.md && node docs/check-links.mjs && npm run lint
    todos:
      - id: g8-run
        content: Install h2load (nghttp2-client) and run bench/h2load.mjs for HTTP/2 over TLS and HTTP/3, interleaved rounds, a byte-identical twin for the noise band — see G8 figures
      - id: g8-record
        content: Add an HTTP/2 and HTTP/3 section to docs/BENCHMARKS.md with the command that reproduces it — see G8 figures
  - id: g7-h2c
    title: "feat(net): cleartext HTTP/2 with prior knowledge (WP39 G7)"
    goal: A server accepts HTTP/2 over plain TCP with the connection preface (h2c, no Upgrade), on the existing sans-IO http2.ts core, so h2load can drive it
    verification: node tests/run.js net_http2_cleartext && node scripts/security-scope.mjs && npm run check && npm run lint
    todos:
      - id: g7-h2c-carrier
        content: Add std/net/http2-cleartext.ts per the G7 note, reusing http2.ts without editing it — see G7 h2c
      - id: g7-h2c-tests
        content: Add tests/link/net_http2_cleartext with a positive exchange, a bad preface refusal and an h2load smoke where h2load exists — see G7 h2c
      - id: g7-h2c-docs
        content: Add the h2c record section and its docs/security/README.md row, and the guide text — see G7 h2c
  - id: g7-facade
    title: "feat(net): one handler for HTTP/1.1, 2 and 3 with Alt-Svc (WP39 G7)"
    goal: A program writes one handler and serves it over HTTP/1.1, HTTP/2 over TLS, h2c and HTTP/3, with Alt-Svc on the TCP responses and no allocation per warmed request
    verification: node tests/run.js net_http_server && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && npm run check && npm run lint
    todos:
      - id: g7-facade-module
        content: Add std/net/http-server.ts over Http1Server, Http2TlsServer, the h2c carrier and Http3Server per the G7 note — see G7 façade
      - id: g7-facade-altsvc
        content: Advertise Alt-Svc for HTTP/3 from HTTP/1.1 and HTTP/2 responses when a QUIC listener is configured — see G7 façade
      - id: g7-facade-tests
        content: Add tests/link/net_http_server answering one request over all four, pinning Arena.used flat over a warmed run — see G7 façade
      - id: g7-facade-docs
        content: Add docs/guide/using-nish/http-server.md with its scalar.config.json route, a security record and its README row — see G7 façade
  - id: g6-steer
    title: "feat(net): steer QUIC packets to the owning process (WP39 G6)"
    goal: Prefork workers sharing one UDP port keep a QUIC connection whose peer rebinds its address on the process that owns it, by the mechanism the G6 note chose
    verification: node tests/run.js net_quic_prefork && node scripts/security-scope.mjs && npm run check && npm run lint
    todos:
      - id: g6-cid
        content: Encode the owning worker in server-issued connection IDs in std/net/quic-conn-cid.ts and std/net/quic-listener.ts — see G6 steering
      - id: g6-route
        content: Steer or forward a packet to its owner per the note, in std/net/prefork.ts and any runtime C it needs — see G6 steering
      - id: g6-tests
        content: Add tests/link/net_quic_prefork where a client rebinds mid-connection across two workers and the connection survives — see G6 steering
      - id: g6-record
        content: Add docs/security/quic-multicore.md and its README row — see G6 steering
  - id: g3-record-size-limit
    title: "feat(net): record_size_limit on the TLS server (WP39 G3)"
    goal: The TLS 1.3 server honours a client's record_size_limit (RFC 8449), sends its own, and refuses an invalid value
    verification: node tests/run.js net_tls && node scripts/security-scope.mjs && npm run check && npm run lint
    todos:
      - id: g3-rsl-codec
        content: Parse and emit record_size_limit in std/net/tls/codec.ts and cap outgoing plaintext in the record layer — see G3 record_size_limit
      - id: g3-rsl-tests
        content: Add tests/link/net_tls_record_size_limit with a small limit honoured, a value under 64 refused with illegal_parameter, and openssl s_client where available — see G3 record_size_limit
      - id: g3-rsl-record
        content: Record it in docs/security/tls.md and the TLS guide page — see G3 record_size_limit
  - id: g4-p256-fixed-base
    title: "perf(crypto): a fixed-base table for P-256 sign and key generation (WP39 G4)"
    goal: P-256 base-point multiplication uses a precomputed constant-time comb table, cutting sign and keygen cost outside the noise band, still constant time
    verification: node tests/run.js crypto_p256 && node tests/run.js crypto_wycheproof && node tests/run.js ct_asm && npm run check && npm run lint
    todos:
      - id: g4-table
        content: Add a fixed-base comb table and constant-time lookup for G in std/crypto/p256.ts — see G4 fixed base
      - id: g4-measure
        content: Measure sign, keygen and bench/tls-handshake.mjs in valgrind Ir against base and a byte-identical twin — see G4 fixed base
      - id: g4-record
        content: Update docs/security/crypto-ecc.md and tests/cases/ct_asm_p256 for the table lookup — see G4 fixed base
  - id: g5-cubic
    title: "feat(net): CUBIC congestion control for QUIC (WP39 G5)"
    goal: QUIC gets CUBIC (RFC 9438) beside NewReno, chosen by config, measured against NewReno on a lossy high-BDP loopback; the default follows the measurement
    verification: node tests/run.js net_quic_recovery && node scripts/security-scope.mjs && npm run check && npm run lint
    todos:
      - id: g5-cubic-impl
        content: Add CUBIC to std/net/quic-recovery.ts behind a controller choice in std/net/quic.ts config — see G5 CUBIC
      - id: g5-cubic-tests
        content: Add window-growth, loss and recovery cases to tests/link/net_quic_recovery for CUBIC — see G5 CUBIC
      - id: g5-cubic-measure
        content: Measure goodput NewReno vs CUBIC under netem-like loss on loopback, with the noise band, and record it in docs/security/quic.md and the PR — see G5 CUBIC
  - id: roadmap
    title: "docs: tick WP39's landed stages and move Next"
    goal: docs/roadmap/wp39-http-server.md, docs/roadmap/index.md and docs/wp39-http-server.md say exactly what this run merged
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: roadmap-tick
        content: Tick the merged boxes, update Done counts, Next and the index row; leave escalated stages, E9 and G9 unticked — see Roadmap
      - id: roadmap-note
        content: Update the design note's status paragraph, section 1 table and section 3 rows for what merged — see Roadmap
---

# WP39 complete

## Context

WP39 ([page](../../docs/roadmap/wp39-http-server.md), [note](../../docs/wp39-http-server.md)) is 12 of 27. The concurrent run **wp34-finish** ([#1430](https://github.com/amritk/nish/issues/1430)) already owns G1 (curl, Autobahn, Chrome over HTTP/1.1), all four G2 timeouts (H1-2, H2-3, TLS-4, WT-2), G3's secp256r1 server share, a P-256 speed-up (safegcd field inversion, windowed verify), G5's PMTUD and the runner's congestion cases, and the WP39 roadmap ticks for those. This plan takes **everything else that is actionable** and does not touch files that run owns until its PRs merge.

Not in this plan: **E9** (submitting to TechEmpower is the owner's decision, D1) and **G9** (deferred until Chrome moves past the draft).

## Approach

- **External merge-order edges.** Three stages start only after a wp34-finish PR merges, because they edit the same files: `g3-record-size-limit` after `tls-server`; `g4-p256-fixed-base` after `p256-speed`; `g5-cubic` after `quic-congestion` (which follows `quic-pmtu`); `g6-steer` after `quic-pmtu`. The lead checks those on each wake by branch and PR state.
- **Design notes first** for G6 and G7, as the WP asks. Each implementation stage starts once its note has merged, and follows it. A note that concludes a mechanism is not worth building ends its implementation stage as an escalation, not as a substitute.
- **New modules, not edits, for G7.** The façade (`std/net/http-server.ts`) and h2c (`std/net/http2-cleartext.ts`) are new files over the existing carriers, so G7 does not collide with wp34-finish's `http-timeouts` or the `http1-plaintext-codec` and `wp49-s6-gap` runs that edit `http1-server.ts`, `serve.ts` and `handler.ts`. If the note finds a carrier must change, that is a finding for the PR body and an escalation, not a widened scope.
- **One roadmap stage, last.** Every stage's box lives on one page with one "Done: N of 27" line; ticking it in every PR conflicts in every PR. The `roadmap` stage ticks what merged, after wp34-finish's own `roadmap` stage has merged.
- **Measurements** follow `.claude/testing.md` → "A `Measured:` trailer": interleaved rounds, a byte-identical twin for the noise band, the machine named.

## Ownership

| stage | Owns | model | starts after |
| --- | --- | --- | --- |
| e5-prefork | `bench/techempower/main.ts`, `server.ts`, `nish.dockerfile`, `benchmark-config.json`, `run.sh`, `README.md`, `tests/link/tfb_entry/**`, `docs/BENCHMARKS.md` (TechEmpower json/plaintext section) | lead | — |
| e6-pg-tls | `std/net/postgres.ts`, `std/net/postgres-carrier.ts`, `std/net/tls/client.ts` (only if the carrier needs a nonblocking entry), `tests/link/std_postgres_tls*/**`, `tests/postgres/live/**`, `.github/workflows/ci.yml` (postgres-live job only), `docs/security/postgres.md`, `docs/guide/using-nish/postgres.md` | lead | — |
| g7-note | `docs/wp39-g7-one-handler.md` | lead | — |
| g6-note | `docs/wp39-g6-quic-multicore.md` | lead | — |
| g8-figures | `bench/h2load.mjs`, `docs/BENCHMARKS.md` (new HTTP/2 and HTTP/3 section) | sonnet | — (merges after e5-prefork) |
| g7-h2c | `std/net/http2-cleartext.ts`, `tests/link/net_http2_cleartext*/**`, `docs/security/http2-cleartext.md` | lead | g7-note |
| g7-facade | `std/net/http-server.ts`, `tests/link/net_http_server*/**`, `docs/guide/using-nish/http-server.md`, `scalar.config.json`, `docs/security/http-server.md` | lead | g7-note (merges after g7-h2c) |
| g6-steer | `std/net/quic-listener.ts`, `std/net/quic-conn-cid.ts`, `std/net/prefork.ts`, `runtime/runtime-net*.c` (only if the note chose eBPF), `tests/link/net_quic_prefork*/**`, `docs/security/quic-multicore.md` | lead | g6-note, wp34-finish `quic-pmtu` |
| g3-record-size-limit | `std/net/tls.ts`, `std/net/tls/codec.ts`, `std/net/tls/record-server.ts`, `tests/link/net_tls_record_size_limit*/**`, `docs/security/tls.md`, `docs/guide/using-nish/tls-certificates.md` | lead | wp34-finish `tls-server` |
| g4-p256-fixed-base | `std/crypto/p256.ts`, `tests/cases/ct_asm_p256.*`, `tests/link/crypto_p256*/**`, `docs/security/crypto-ecc.md` | lead | wp34-finish `p256-speed` |
| g5-cubic | `std/net/quic-recovery.ts`, `std/net/quic.ts`, `tests/link/net_quic_recovery*/**`, `docs/security/quic.md` | lead | wp34-finish `quic-congestion` |
| roadmap | `docs/roadmap/wp39-http-server.md`, `docs/roadmap/index.md`, `docs/wp39-http-server.md` | sonnet | every other stage merged or escalated, and wp34-finish `roadmap` |

**Shared append files** (each stage edits only its own rows; a conflict is resolved by the worker on update): `tests/run.js`, `tests/nish-cmp.js` (`DECLARED` entries), `docs/security/README.md`, `scripts/security-scope.mjs` scope lists, `THIRD_PARTY_NOTICES.md`.

**Generated, never hand-edited** (regenerate with the repo's tooling): `tests/self/goldens/checked/**`, `tests/differential/**` goldens, `docs/reference/**` and its `scalar.config.json` routes, `tests/differential/emit-ts-known.txt` (CI's Node only).

## E5 on every core

`main.ts` today is one `pollWait` loop on `TfbServer`. Copy `db-main.ts`'s shape: `preforkWith` with a worker count from the available parallelism, each worker on `preforkListener` sharing the `SO_REUSEPORT` port. Keep a `--workers 1` path so `run.sh` can measure one against many on the same build. `tests/link/tfb_entry` must still pin the verifier's header and body checks and the flat `Arena.used()`, and add one check that two worker pids answered. The figures go beside the existing one-core rows in `docs/BENCHMARKS.md#techempower-json-and-plaintext`.

## Postgres over TLS

`SSLRequest` (80877103) before startup; `S` continues into a TLS 1.3 client handshake from `nish/net/tls/client` with `nish/net/tls/verify` against the system store or a supplied CA, `N` is a refusal unless the mode is `disable`. Modes mirror libpq's meaning: `require` encrypts without verifying, `verify-full` checks chain and host name; the default stays as today (no TLS) unless the record argues otherwise. The carrier drives the handshake on the program's loop without blocking. The live job adds a TLS-enabled server (self-signed CA generated in the job) and runs the TLS case; the replay test pins the SSLRequest bytes and the `N` path. PG-9 moves to fixed with before/after tests; PG-10 is mentioned if the TLS path changes it.

## G7 design note

Answers, with sketches: the handler type (request view, response writer) and how it maps onto `Http1Server`'s slot, `Http2TlsServer`'s streams and `Http3Server`'s streams without copying; where `Alt-Svc` is added and its `ma`; h2c with prior knowledge only (no `Upgrade: h2c`, deprecated by RFC 9113); how the façade keeps "a warmed request allocates nothing"; what each version still refuses; the test matrix. It names the two module paths in the table above, or says why it cannot.

## G6 design note

Answers: the connection-ID layout carrying the worker index (and why it does not leak more than it must); `SO_ATTACH_REUSEPORT_EBPF` vs forwarding between processes (a UNIX socket hop), with a measurement or a cost estimate for each; what happens to Initial packets, to a worker that dies, and to a rebinding peer; the security surface and which record carries it.

## G8 figures

`bench/h2load.mjs` exists and compares one build against another. Install `nghttp2-client` (apt); if the network refuses it, stop and say so in a draft PR rather than measuring something else. Run HTTP/2 over TLS (and h2c only if `g7-h2c` has merged by then — not required) and HTTP/3, at the harness's levels, interleaved, with the noise band from a byte-identical twin. Name the machine; a cloud VM is allowed if the section says so.

## G7 h2c

A carrier for HTTP/2 over plain TCP with prior knowledge: read the 24-byte preface, then hand bytes to the existing `http2.ts` connection exactly as `http2-tls.ts` does after the handshake. A bad preface closes with no response. Its record is new (`docs/security/http2-cleartext.md`): cleartext means no confidentiality, and a proxy upstream is the intended use.

## G7 façade

`std/net/http-server.ts` takes one handler and any of the four listeners. Responses on HTTP/1.1 and HTTP/2 carry `Alt-Svc: h3=":<port>"; ma=<n>` when a QUIC listener is configured. A guide page (`docs/guide/using-nish/http-server.md`) with a route in `scalar.config.json`. The test answers the same request over all four and pins `Arena.used()` flat over a warmed run.

## G6 steering

Implements the note. The test runs two prefork workers on one UDP port, opens a connection, rebinds the client's port mid-connection and checks the connection completes on the same worker.

## G3 record_size_limit

RFC 8449: the extension in ClientHello and EncryptedExtensions, a value below 64 is `illegal_parameter`, the server caps each outgoing record's plaintext (TLS 1.3: limit minus one for the content type) and advertises its own limit. Test with a small limit and, where `openssl s_client` exists, `-record_size_limit` if supported.

## G4 fixed base

64-bit limbs stay out (they lean on WP41's wide multiply). A comb or windowed fixed-base table for `G`, scanned in full with masks for a constant-time lookup, used by sign and keygen. Verify keeps wp34-finish's windowed path. Gate: valgrind Ir for sign and keygen outside the noise band against base, and `bench/tls-handshake.mjs` server CPU. If the gain is inside the band, the PR says so and is a draft.

## G5 CUBIC

RFC 9438 CUBIC in `quic-recovery.ts` beside NewReno, picked in the QUIC config. The WP gates it "if a measurement asks for one": measure goodput on a lossy, high-delay loopback (a userspace delay/loss shim in the test if `tc netem` is unavailable) for both. If CUBIC is not better outside the noise band, keep NewReno as default and say so; the box is ticked either way because the controller and the measurement are what it asked for.

## Roadmap

Tick only what merged across this run and wp34-finish's WP39 items that have merged by then. Update "Done: N of 27", Next, the index row and the Up next list. E9 stays waiting on the owner; G9 stays deferred.

## Out of scope

E9 submission; G9; 64-bit P-256 limbs; anything wp34-finish owns (G1, G2, G3 secp256r1, PMTUD, the runner's congestion cases); io_uring, sendfile, kernel TLS, 0-RTT, server push.

## Verification

Per stage: its `verification` line, then `npm run check`, `npm run lint`, `node scripts/gen-reference.mjs --check`, `node docs/check-links.mjs`, `node scripts/security-scope.mjs`, and `node tests/run.js <section>` for each section touched. CI's eight shards are the full-suite gate. A stage that changes `std/` runs nish-cmp (`bash scripts/fetch-seed.sh --force && node tests/nish-cmp.js`) and regenerates `tests/self/goldens/checked/`.
