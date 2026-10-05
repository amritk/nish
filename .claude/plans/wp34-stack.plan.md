---
name: WP34 — the rest of the stack, through the relay
overview: Finish the Nish network stack under std/net (the HTTP/1.1 server, HTTP/2, QUIC loss recovery and streams, HTTP/3 with QPACK, WebTransport) and then build the relay on it, with N9's soak, the loopback suite and S2's interop CI job. One stage per lane, one pull request per stage, in the order docs/wp34-hosting-cs.md §5 sets.
stages:
  - id: h1-server
    title: "feat(net): the HTTP/1.1 server on nish:net"
    goal: A streaming HTTP/1.1 server over TCP and over TLS on the existing parser — keep-alive, chunked bodies both ways, Upgrade to WebSocket — in a slot pool sized at start-up
    verification: npm run check && node tests/run.js net_http1 && node tests/run.js net_websocket && npm run lint && npm run lint:dead
    todos:
      - id: h1-server-module
        content: Add std/net/http1-server.ts, a sans-IO connection plus a slot-pool carrier on nish:net and nish/net/tls-tcp — see H1 server
      - id: h1-server-streaming
        content: Stream request and response bodies a chunk at a time with back-pressure, chunked both ways, keep-alive and pipelining — see H1 server
      - id: h1-server-upgrade
        content: Hand an Upgrade request to nish/net/websocket on the same slot — see H1 server
      - id: h1-server-tests
        content: Add tests/link/net_http1_server cases, a Nish client over loopback split at every byte, plus negatives — see H1 server
      - id: h1-server-docs
        content: Add docs/security/http1.md and the registry entries for the new module — see Shared registry files
  - id: h2-frames
    title: "feat(net): HTTP/2 frames, streams and flow control"
    goal: HTTP/2 over TLS with ALPN h2 — frames, the stream state machine, connection and stream flow control, SETTINGS, PING, GOAWAY, RST_STREAM, extended CONNECT (RFC 8441) — on the existing HPACK, plus the header model HTTP/3 reuses
    verification: npm run check && node tests/run.js net_http2 && node tests/run.js net_http_fields && npm run lint && npm run lint:dead
    todos:
      - id: h2-fields
        content: Add std/net/http-fields.ts, the version-neutral header model (pseudo-header validation, field-name rules, the request and response shapes) — see H2
      - id: h2-frame-codec
        content: Add std/net/http2-frame.ts, every RFC 9113 frame encoded and decoded with its size and flag rules — see H2
      - id: h2-connection
        content: Add std/net/http2.ts, the connection and stream state machine, flow control windows, SETTINGS negotiation, GOAWAY and extended CONNECT — see H2
      - id: h2-carrier
        content: Serve it over nish/net/tls-tcp with ALPN h2 in a slot pool — see H2
      - id: h2-tests
        content: Add tests/link/net_http2 cases, RFC 9113 error paths as negatives — see H2
      - id: h2-docs
        content: Add docs/security/http2.md and the registry entries — see Shared registry files
  - id: q3-recovery
    title: "feat(net): QUIC loss recovery, PTO, NewReno and pacing"
    goal: RFC 9002 on the existing QuicConnection — sent-packet tracking, RTT estimation, loss detection by packet and time threshold, PTO, NewReno congestion control and a pacer
    verification: npm run check && node tests/run.js net_quic && npm run lint && npm run lint:dead
    todos:
      - id: q3-recovery-module
        content: Add std/net/quic-recovery.ts, RTT, loss detection, PTO and NewReno as sans-IO state per packet-number space — see Q3
      - id: q3-wire
        content: Wire recovery into std/net/quic.ts and std/net/quic-conn-ack.ts, replacing the fixed QUIC_CONN_PTO — see Q3
      - id: q3-pacing
        content: Pace sends in std/net/quic-listener.ts from the congestion window and smoothed RTT — see Q3
      - id: q3-tests
        content: Add tests/link/net_quic_recovery cases with scripted loss, reordering and PTO, and keep the aioquic replays green — see Q3
      - id: q3-docs
        content: Update docs/security/quic.md and the registry entries — see Shared registry files
  - id: qpack
    title: "feat(net): QPACK with the static table and dynamic capacity 0"
    goal: RFC 9204 field-section encoding and decoding with the 99-entry static table, Huffman shared with HPACK, and a dynamic table refused above capacity 0
    verification: npm run check && node tests/run.js net_qpack && npm run lint && npm run lint:dead
    todos:
      - id: qpack-module
        content: Add std/net/qpack.ts, static table, prefixed integers and literals, the Required Insert Count 0 encoder and decoder — see QPACK
      - id: qpack-tests
        content: Add tests/link/net_qpack cases reproducing RFC 9204 static-table encodings, plus negatives for every refused instruction — see QPACK
      - id: qpack-docs
        content: Add the registry entries for the new module — see Shared registry files
  - id: n9-tls-memory
    title: "perf(net): a TLS handshake that keeps its state in the slot"
    goal: Close TLS-3 — a TLS 1.3 handshake allocates nothing in the arena that outlives the pass, so N9's soak can hold Arena.used() flat
    verification: npm run check && node tests/run.js net_tls && node tests/run.js crypto && npm run lint && npm run lint:dead
    todos:
      - id: n9-tls-slot
        content: Move handshake state in std/net/tls.ts and std/net/tls into a per-connection slot or arena — see N9 TLS memory
      - id: n9-hkdf-hmac
        content: Give std/crypto/hkdf.ts and std/crypto/hmac.ts caller-owned scratch so they stop storing allocations of their own — see N9 TLS memory
      - id: n9-tls-test
        content: Add a tests/link/net_tls_memory case that runs many handshakes and asserts Arena.used() flat — see N9 TLS memory
      - id: n9-tls-docs
        content: Close TLS-3 in docs/security/tls.md with the measured figures — see N9 TLS memory
  - id: q4-streams
    title: "feat(net): QUIC streams, DATAGRAM frames and GSO batching"
    goal: Bidirectional and unidirectional streams with stream and connection flow control, RFC 9221 DATAGRAM frames, GSO send batching, and no per-packet allocation (QUIC-3 closed)
    verification: npm run check && node tests/run.js net_quic && npm run lint && npm run lint:dead
    todos:
      - id: q4-streams-module
        content: Add std/net/quic-stream.ts, stream states, MAX_STREAM_DATA, MAX_DATA, MAX_STREAMS, STOP_SENDING and RESET_STREAM — see Q4
      - id: q4-datagram
        content: Add DATAGRAM frames and the max_datagram_frame_size transport parameter in std/net/quic-frame.ts and std/net/quic-conn-params.ts — see Q4
      - id: q4-gso
        content: Batch sends through UDP_SEGMENT in std/net/quic-listener.ts — see Q4
      - id: q4-quic3
        content: Remove per-packet allocation from std/net/quic.ts so a connection is a reusable slot — see Q4
      - id: q4-tests
        content: Add tests/link/net_quic_stream and net_quic_datagram cases, a datagram round trip at the MTU edge, and an arena-flat case — see Q4
      - id: q4-docs
        content: Close QUIC-3 in docs/security/quic.md and add the registry entries — see Shared registry files
  - id: r1-http3
    title: "feat(net): HTTP/3 on QUIC streams"
    goal: RFC 9114 over Q4's streams with QPACK and the shared header model — control and QPACK streams, SETTINGS, HEADERS and DATA frames, GOAWAY, streaming bodies
    verification: npm run check && node tests/run.js net_http3 && npm run lint && npm run lint:dead
    todos:
      - id: r1-frames
        content: Add std/net/http3.ts, the HTTP/3 frame codec, the unidirectional stream types and the request stream state machine — see R1
      - id: r1-server
        content: Serve requests over the QUIC listener with ALPN h3, using std/net/qpack.ts and std/net/http-fields.ts — see R1
      - id: r1-tests
        content: Add tests/link/net_http3 cases, a Nish client over loopback, plus RFC 9114 error negatives — see R1
      - id: r1-docs
        content: Add docs/security/http3.md and the registry entries — see Shared registry files
  - id: r2-webtransport
    title: "feat(net): WebTransport over HTTP/3"
    goal: Extended CONNECT (RFC 9220), HTTP datagrams (RFC 9297) and WebTransport sessions with datagrams, unidirectional and bidirectional streams and close, pinned to the draft Chrome negotiates
    verification: npm run check && node tests/run.js net_webtransport && npm run lint && npm run lint:dead
    todos:
      - id: r2-connect
        content: Add extended CONNECT and the WebTransport SETTINGS to std/net/http3.ts — see R2
      - id: r2-session
        content: Add std/net/webtransport.ts, sessions, datagrams with quarter-stream-id, stream association and CLOSE_WEBTRANSPORT_SESSION — see R2
      - id: r2-golden
        content: Record one wtransport 0.7 exchange as a golden and replay it from a Nish client — see R2
      - id: r2-tests
        content: Add tests/link/net_webtransport cases plus negatives — see R2
      - id: r2-docs
        content: Add docs/security/webtransport.md and the registry entries — see Shared registry files
  - id: loopback-suite
    title: "test(net): a Nish server and a Nish client over loopback, every carrier"
    goal: The cross-lane suite of wp34 §5a — TLS over TCP, HTTP/1.1, WebSocket, HTTP/2, QUIC, HTTP/3 and WebTransport, each a Nish server and a Nish client in one loop inside npm test
    verification: npm run check && node tests/run.js net_loopback && npm run lint && npm run lint:dead
    todos:
      - id: loopback-cases
        content: Add tests/link/net_loopback cases, one per carrier, with Arena.used() asserted flat — see Loopback suite
  - id: interop-ci
    title: "ci: the interop job — quic-interop-runner, h2spec, curl and Chrome"
    goal: Decision S2's interop job beside npm test, against a Nish interop server
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js interop
    todos:
      - id: interop-server
        content: Add tests/interop/server.ts, the Nish endpoint the runners drive, and its Dockerfile for the quic-interop-runner — see Interop CI
      - id: interop-workflow
        content: Add .github/workflows/interop.yml running the runner cases, h2spec, curl --http2 and --http3, and Chrome through Playwright — see Interop CI
  - id: a1-relay
    title: "feat(net): the relay in Nish, with N9's soak"
    goal: The relay of wp34 §2 written in Nish on std/net — frame and grant, the session table and caps, timeouts, stats, the hash file and certificate reload, one upstream socket per session, GSO and GRO — and the 100,000-session soak
    verification: npm run check && node tests/run.js relay && npm run lint && npm run lint:dead
    todos:
      - id: a1-frame-grant
        content: Port frame.rs and grant.rs with cs's existing fixtures — see A1
      - id: a1-relay-loop
        content: Write the relay loop, session table, caps, timeouts, stats, identity and reload — see A1
      - id: a1-soak
        content: Add the N9 soak, 100,000 sessions with Arena.used() and resident memory flat after the pools fill — see A1
      - id: a1-docs
        content: Mark A1 and the stack built in docs/wp34-hosting-cs.md and docs/MASTER_PLAN.md — see A1
---

# WP34 — the rest of the stack, through the relay

## Context

[docs/wp34-hosting-cs.md](../../docs/wp34-hosting-cs.md) §5 is the lane table. Built on `main`: K1–K6, T1, T2, H1's parser and WebSocket framing ([std/net/http1.ts](../../std/net/http1.ts), [std/net/websocket.ts](../../std/net/websocket.ts)), HPACK ([std/net/hpack.ts](../../std/net/hpack.ts)), Q1 and Q2 ([std/net/quic.ts](../../std/net/quic.ts) and its `quic-*` modules). Open: everything this plan lists. Every stage is `std/` Nish plus `tests/link/` cases; no stage changes `src/`, so the rolling freeze does not bind.

## Approach

- **One stage per lane**, in §5's order. The critical path is `q3-recovery → q4-streams → r1-http3 → r2-webtransport → a1-relay`. `h1-server`, `h2-frames` and `qpack` sit beside it, and `n9-tls-memory` beside `q4-streams`.
- **Sans-IO core, carrier on top**, as T2 and Q2 did: each protocol is a state machine over byte windows `(buf, off, len)`, and a thin carrier runs it on `nish:net`. That keeps every lane provable by vectors with no socket.
- **N9 discipline in every lane**: state in pools sized at start-up, nothing allocated per packet, each carrier test asserts `Arena.used()` flat.
- **Proof is the repo's**: each module reproduces its RFC's vectors in a `tests/link/` case, with negative cases, and keeps a `docs/security/` record. The external suites (h2spec, the quic-interop-runner, curl, Chrome) run in the interop job, not in `npm test` (decision S2).

## Merge order

| stage | develops after | merges after |
|---|---|---|
| h1-server | — | — |
| h2-frames | — | — |
| q3-recovery | — | — |
| qpack | — | — |
| n9-tls-memory | — | — |
| q4-streams | q3-recovery (both own `std/net/quic.ts`) | q3-recovery |
| r1-http3 | q4-streams (consumes its stream API) | q4-streams, qpack, h2-frames |
| r2-webtransport | r1-http3 | r1-http3 |
| loopback-suite | r2-webtransport | r2-webtransport, h1-server, n9-tls-memory |
| interop-ci | r2-webtransport | r2-webtransport, h1-server, h2-frames |
| a1-relay | r2-webtransport | r2-webtransport, n9-tls-memory |

## Shared registry files

Several files list every `std/` module and every lane, and each stage must add its own entries or `npm test` fails (`tests/run.js` holds every `std/` module to each of release.yml's three presence gates). These are **append-only registries**: a stage adds its own lines and edits nothing else in them. A conflict there is resolved by merging `main` into the branch, never by rebasing.

| file | what a stage adds |
|---|---|
| [.github/workflows/release.yml](../../.github/workflows/release.yml) | its new `std/net/*.ts` paths on the three `for f in …` presence-gate lines, and the count in the echo after each |
| [std/README.md](../../std/README.md) | its module's row in the `nish/net` section |
| [docs/wp34-hosting-cs.md](../../docs/wp34-hosting-cs.md) | its lane's State cell in §5 and its row in §5a |
| [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) | an entry only if it ports code (`.claude/licensing.md`) |
| [src/std-modules.ts](../../src/std-modules.ts) | its new module's name in the list of `std/` modules (`npm test` checks the list is complete) — a data string, the only `src/` edit any stage makes |
| [tests/nish-cmp.js](../../tests/nish-cmp.js) | its `declareMoved` entries for the IR its module moves against the last release, or CI's `nish-cmp` job fails |
| `tests/self/goldens/*` | regenerated with `node tests/self/goldens.js --update`, never edited by hand |

## H1 server

**Owns:** `std/net/http1*.ts`, `std/net/websocket.ts`, `tests/link/net_http1*/**`, `tests/link/net_websocket*/**`, `docs/security/http1.md`, plus the registries.

The parser in [std/net/http1.ts](../../std/net/http1.ts) is incremental; the server drives it per slot. Keep-alive and pipelined requests on one connection; `Content-Length` and chunked request bodies delivered to the handler a chunk at a time; responses written either with a length or chunked, with back-pressure from the socket's writability. `Upgrade: websocket` hands the slot to [std/net/websocket.ts](../../std/net/websocket.ts). The same connection runs over plain TCP and over `nish/net/tls-tcp` with ALPN `http/1.1`. Caps (header bytes, slots, idle timeout) are numbers fixed at start-up. Tests: requests split at every byte, a body larger than any buffer, a pipelined pair, a WebSocket echo, and negatives for oversize headers, bad chunk sizes and a smuggling-shaped `Content-Length` with `Transfer-Encoding`.

## H2

**Owns:** `std/net/http2*.ts`, `std/net/http-fields.ts`, `tests/link/net_http2*/**`, `tests/link/net_http_fields*/**`, `docs/security/http2.md`, plus the registries.

`http-fields.ts` is the header model R1 imports: field-name and value validation, pseudo-headers in order, the connection-specific fields HTTP/2 and HTTP/3 refuse. `http2-frame.ts` codes every frame type of RFC 9113 §6. `http2.ts` is the connection: preface, SETTINGS and ACK, the stream state machine of §5.1, connection and stream windows with WINDOW_UPDATE, PING, RST_STREAM, GOAWAY with the last stream id, HPACK through [std/net/hpack.ts](../../std/net/hpack.ts), and extended CONNECT with `SETTINGS_ENABLE_CONNECT_PROTOCOL` (RFC 8441). Carrier: `nish/net/tls-tcp` with ALPN `h2`. Tests: the frame codec against hand-built frames, a request and a streamed response, flow control stalling and resuming, and negatives for each connection error class.

## Q3

**Owns:** `std/net/quic.ts`, `std/net/quic-recovery.ts`, `std/net/quic-conn-ack.ts`, `std/net/quic-listener.ts`, `tests/link/net_quic_*/**`, `docs/security/quic.md`, plus the registries.

RFC 9002 §5–7 and Appendix A/B: per-space sent-packet records in a fixed ring, `latest_rtt`/`smoothed_rtt`/`rttvar`/`min_rtt`, packet and time thresholds, PTO with backoff replacing `QUIC_CONN_PTO`, NewReno slow start, recovery and persistent congestion, and a pacer the listener consults before each send. Tests drive the sans-IO connection with scripted loss, reordering and a black-hole PTO, and assert the RTT and window figures against Appendix A's arithmetic. The aioquic replays stay green.

## QPACK

**Owns:** `std/net/qpack.ts`, `tests/link/net_qpack*/**`, plus the registries.

RFC 9204 with dynamic capacity 0: the 99-entry static table of Appendix A, prefixed integers and string literals (Huffman imported from [std/net/hpack.ts](../../std/net/hpack.ts), not copied), field-line representations with Required Insert Count 0, and encoder and decoder stream instructions refused as `QPACK_ENCODER_STREAM_ERROR` / `QPACK_DECOMPRESSION_FAILED` where capacity 0 forbids them. Tests reproduce the RFC's static-table encodings and refuse each forbidden instruction.

## N9 TLS memory

**Owns:** `std/net/tls.ts`, `std/net/tls/**`, `std/net/tls-tcp.ts`, `std/crypto/hkdf.ts`, `std/crypto/hmac.ts`, `tests/link/net_tls_*/**`, `docs/security/tls.md`, plus the registries.

TLS-3 measures about 52 KB of arena per handshake. Move the handshake's state into the connection slot (or an arena per connection, released with the slot), and give HKDF and HMAC caller-owned scratch so `using a = arena()` is no longer refused around them. The RFC 8448 trace must still reproduce byte for byte. A new case runs a thousand handshakes and asserts `Arena.used()` flat; `docs/security/tls.md` closes TLS-3 with the measured figure.

## Q4

**Owns:** `std/net/quic*.ts`, `tests/link/net_quic_*/**`, `docs/security/quic.md`, plus the registries. Starts after `q3-recovery` merges.

Streams per RFC 9000 §2–4: ids, the send and receive state machines, reassembly into a fixed buffer per stream, `MAX_STREAM_DATA`/`MAX_DATA`/`MAX_STREAMS` with the blocked frames, `STOP_SENDING` and `RESET_STREAM`. DATAGRAM frames (RFC 9221) with `max_datagram_frame_size`, never retransmitted and counted against congestion. GSO: the listener coalesces a flight to one peer into one `UDP_SEGMENT` send. QUIC-3: the connection is a slot, reset and reused, with nothing allocated per packet. Tests: a multiplexed transfer, flow control blocking and resuming, a datagram exactly at the path MTU and one byte over, a GSO send read back by a GRO receiver, and an arena-flat run of many connections.

## R1

**Owns:** `std/net/http3*.ts`, `tests/link/net_http3*/**`, `docs/security/http3.md`, plus the registries. Starts after `q4-streams` merges.

RFC 9114: the control stream and SETTINGS, the QPACK encoder and decoder streams (opened, capacity 0), HEADERS and DATA on request streams with bodies streamed, GOAWAY, and the error codes. Fields go through [std/net/http-fields.ts](../../std/net/http-fields.ts) and [std/net/qpack.ts](../../std/net/qpack.ts). Served over the QUIC listener with ALPN `h3`.

## R2

**Owns:** `std/net/webtransport*.ts`, `std/net/http3*.ts`, `tests/link/net_webtransport*/**`, `docs/security/webtransport.md`, plus the registries. Starts after `r1-http3` merges.

Extended CONNECT (RFC 9220) with `:protocol = webtransport`, `SETTINGS_ENABLE_CONNECT_PROTOCOL`, `SETTINGS_H3_DATAGRAM` and the WebTransport settings of the draft Chrome negotiates; HTTP datagrams (RFC 9297) with the quarter stream id; WebTransport unidirectional and bidirectional streams with their signal values; `CLOSE_WEBTRANSPORT_SESSION` and `DRAIN`. The draft's SETTINGS and headers are recorded once from a `wtransport` 0.7 client and held as a golden that a Nish client replays.

## Loopback suite

**Owns:** `tests/link/net_loopback*/**`. Starts after `r2-webtransport` merges.

One case per carrier — TLS over TCP, HTTP/1.1, WebSocket, HTTP/2, QUIC, HTTP/3, WebTransport — each a Nish server and a scripted Nish client in one `pollWait` loop, exchanging a request, a streamed body and a close, with `Arena.used()` asserted flat. It catches two lanes that each pass their own vectors and disagree with each other.

## Interop CI

**Owns:** `.github/workflows/interop.yml`, `tests/interop/**`. Starts after `r2-webtransport` merges.

A Nish interop server (`tests/interop/server.ts`) serving HTTP/1.1, HTTP/2, HTTP/3 and a WebTransport echo, packaged for the quic-interop-runner's server role. The workflow runs the runner's handshake, transfer, retry, chacha20, multiplexing, keyupdate, lossy, congested and http3 cases against two client implementations, `h2spec` against the HTTP/2 server, `curl --http2` and `--http3`, and Chrome through Playwright opening a WebTransport session and echoing a datagram. It runs beside `npm test`, on pull requests touching `std/net/**` and on `main`, as S2 decided.

## A1

**Owns:** `examples/relay/**`, `tests/link/net_relay*/**`, `docs/MASTER_PLAN.md`, plus the registries (its own §5 row and the note's status paragraph in `docs/wp34-hosting-cs.md`). Starts after `r2-webtransport` merges.

Where the relay lives is the decision put to the owner with this plan (see Out of scope). Ported from cs's `services/relay/src/*.rs`: the 3-byte frame header, the grant `v1.<b64url JSON>.<b64url HMAC>` checked before the JSON is parsed (with N11's small hand-written JSON case), the session table (4,096 sessions, 64 per peer, 256 datagrams a second), the 5 s hello and 10 s idle timeouts, stats every 2 s, the self-signed identity with its hash file or `--cert`/`--key` re-read every 60 s, one upstream UDP socket per session, GSO and GRO, and a clean stop on a signal. The frame and grant tests use cs's fixtures from `packages/protocol`. The soak drives 100,000 sessions through connect, send and leave, and asserts `Arena.used()` and resident memory flat after the pools fill.

## Run decisions (signed off 2026-10-05)

- **A1 lives in nish** as `examples/relay/`. The cs `services/relay` port is a follow-up once a human merges a Release PR carrying R2.
- **The gate is the repository's definition of done**, not a coverage command: `npm run check`, an undegraded `npm test`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`.
- **Authorised for autonomous merge** despite the sensitive-path rule: a stage's own lines on release.yml's three presence gates; `.github/workflows/interop.yml` (interop-ci only); `std/crypto/hkdf.ts` and `std/crypto/hmac.ts` (n9-tls-memory only). Any other workflow, CI or crypto edit escalates.
- **Deadline** 48 hours from the run's start.

## Out of scope

- The cs side of A1 — `services/relay` replaced in amritk/cs, `boot-check`'s wire pass, `bench:offload` against Rust — because cs can use a lane only once a nish release carries it, and merging the Release PR is a human's act. A1 here makes that port a copy.
- #430 (key-holding structs onto `nish:secret`), WebTransport over HTTP/2, 0-RTT, migration, server push, a QPACK dynamic table, client certificates, the TLS client role (N13).

## Tests

Every stage mirrors the existing `tests/link/net_*` layout (`main.ts`, `checks.ts`, `expected.out`, `expected.code`) and its `_f64` twin where the lane has one, with negative cases. See [tests/link/net_quic_conn](../../tests/link/net_quic_conn) and [tests/link/net_tls_record_tcp](../../tests/link/net_tls_record_tcp).

## Verification

Each stage's own `verification` line, and the repository's definition of done on every pull request: `npm run check`, an **undegraded** `npm test` (the skip count read), `npm run lint`, `npm run lint:dead`, and `node docs/check-links.mjs` when Markdown changed.
