# WP39: The HTTP server: a TechEmpower entry, then a general-purpose server

**State:** In progress · **Done:** 22 of 29 · **Design note:** [`docs/wp39-http-server.md`](https://github.com/amritk/nish/blob/main/docs/wp39-http-server.md)

## Stages

- [x] E1, E2: `SO_REUSEPORT` and `TCP_NODELAY` through `tcpListenFlags`
- [x] E3, E4: `JsonWriter` and a cached HTTP date
- [x] E5: the `json` and `plaintext` entry in `bench/techempower/`
- [ ] E5: the `json` and `plaintext` entry on one process per core
- [x] E6: the Postgres client, its pool and carrier, binary results and a live CI job
- [ ] E6: Postgres over TLS
- [x] E7, E8: the `db`, `query`, `update`, `cached-query` and `fortune` entry
- [ ] E9: submit the entry to TechEmpower *(open question)*
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
- [ ] G7: one handler for HTTP/1.1, 2 and 3, with `Alt-Svc`: the `nish/net/http-server` façade
- [x] G8: the `h2load` harness
- [ ] G8: HTTP/2 and HTTP/3 figures in BENCHMARKS.md
- [ ] G9: move WebTransport's pin when Chrome moves past the draft *(deferred)*
- [x] G10: the TLS client, chain validation and outbound HTTPS

## Next

G7's façade, `nish/net/http-server`: one handler across HTTP/1.1, 2 and 3. Spec: [`docs/http-one-handler.md`](https://github.com/amritk/nish/blob/main/docs/http-one-handler.md), and [§3 Part B](https://github.com/amritk/nish/blob/main/docs/wp39-http-server.md#3-part-b-a-general-purpose-server-every-version) for the rest.

## Open questions

E9: whether and when to submit to TechEmpower, a public number.

## Not planned

Io_uring, `sendfile`, kernel TLS, 0-RTT, HTTP/2 server push.

[All work packages](index.md)
