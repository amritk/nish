# WP39: The HTTP server: a TechEmpower entry, then a general-purpose server

**State:** In progress · **Done:** 23 of 31 · **Design note:** [`docs/wp39-http-server.md`](https://github.com/amritk/nish/blob/main/docs/wp39-http-server.md)

## Stages

- [x] E1, E2: `SO_REUSEPORT` and `TCP_NODELAY` through `tcpListenFlags`
- [x] E3, E4: `JsonWriter` and a cached HTTP date
- [x] E5: the `json` and `plaintext` entry in `bench/techempower/`
- [ ] E5: the `json` and `plaintext` entry on one process per core
- [x] E6: the Postgres client, its pool and carrier, binary results and a live CI job
- [ ] E6: Postgres over TLS
- [x] E7, E8: the `db`, `query`, `update`, `cached-query` and `fortune` entry
- [x] G1: Chrome over HTTP/2 on TCP in the interop job
- [x] G1: `curl` and Autobahn for HTTP/1.1 and WebSocket; Chrome over HTTP/1.1 ([#1437](https://github.com/amritk/nish/pull/1437))
- [x] G2: the request-head deadline (H1-1) and HPACK's allocation (H2-1)
- [x] G2: a lingering close after a refusal (H1-2) ([#1454](https://github.com/amritk/nish/pull/1454))
- [x] G2: SETTINGS and idle timeouts for HTTP/2 (H2-3) ([#1454](https://github.com/amritk/nish/pull/1454))
- [x] G2: an idle timeout in the TLS carrier (TLS-4) ([#1449](https://github.com/amritk/nish/pull/1449))
- [x] G2: a session clock and rate cap for WebTransport (WT-2) ([#1454](https://github.com/amritk/nish/pull/1454))
- [x] G3: session tickets and PSK resumption, without 0-RTT
- [x] G3: `secp256r1` as a key-share group on the server ([#1449](https://github.com/amritk/nish/pull/1449), [#1479](https://github.com/amritk/nish/pull/1479)); `record_size_limit` ([#1467](https://github.com/amritk/nish/pull/1467))
- [x] G4: AES-GCM on AES-NI with PCLMULQDQ and on AArch64 AES with PMULL
- [x] G4: a faster P-256 ([#1516](https://github.com/amritk/nish/pull/1516), [#1518](https://github.com/amritk/nish/pull/1518))
- [x] G5: a peer's address change, ECN, the AEAD limits and optimistic-ACK detection
- [x] G5: path MTU discovery ([#1458](https://github.com/amritk/nish/pull/1458))
- [ ] G5: a congestion controller beyond NewReno, if a measurement asks for one
- [x] G6: QUIC on more than one core ([`docs/h3-multicore.md`](https://github.com/amritk/nish/blob/main/docs/h3-multicore.md), [#1470](https://github.com/amritk/nish/pull/1470))
- [x] G7: h2c, cleartext HTTP/2 with prior knowledge, `nish/net/http2-cleartext` ([#1461](https://github.com/amritk/nish/pull/1461))
- [x] G7: one handler for HTTP/1.1, 2 and 3, with `Alt-Svc`: the `nish/net/http-server` façade ([#1473](https://github.com/amritk/nish/pull/1473))
- [ ] G7: HTTP/1.1 over TLS on the façade, which WP71's `json-tls` and `8gbit` profiles need
- [ ] G7: WebSocket on the façade's HTTP/1.1 listener, which WP71's three echo profiles need
- [ ] G7: an h2c peer taken by its preface on the façade's HTTP/1.1 listener, for WP71's cleartext gRPC on one port *(open question)*
- [x] G8: the `h2load` harness
- [ ] G8: HTTP/2 and HTTP/3 figures in BENCHMARKS.md
- [ ] G9: move WebTransport's pin when Chrome moves past the draft *(deferred)*
- [x] G10: the TLS client, chain validation and outbound HTTPS

## Next

G7's HTTP/1.1 over TLS on the façade: `Http1TlsServer` beside `listenHttp2Tls`, which [F2](https://github.com/amritk/nish/blob/main/docs/http-one-handler.md#42-finding-f2-one-tls-port-for-http11-and-http2) left out. Spec: [§3 Part B](https://github.com/amritk/nish/blob/main/docs/wp39-http-server.md#3-part-b-a-general-purpose-server-every-version), G7's row.

## Open questions

Whether the façade's HTTP/1.1 listener takes an h2c peer by its 24-byte preface. [The note](https://github.com/amritk/nish/blob/main/docs/http-one-handler.md#4-h2c-prior-knowledge-only) rules sniffing out, so a deployment that wants both runs two ports; HttpArena serves HTTP/1.1, WebSocket and cleartext gRPC on one port ([WP71](wp71-httparena.md)).

## Not planned

`sendfile`, kernel TLS, 0-RTT, HTTP/2 server push. io_uring, once listed here, is [WP63](wp63-iouring-net.md)'s, landed.

E9, submitting to TechEmpower: TechEmpower archived the project on 2026-03-24 and takes no entries. The public entry is [WP71](wp71-httparena.md).

[All work packages](index.md)
