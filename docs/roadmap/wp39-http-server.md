# WP39: The HTTP server: a TechEmpower entry, then a general-purpose server

**State:** In progress · **Done:** 12 of 27 · **Design note:** [`docs/wp39-http-server.md`](https://github.com/amritk/nish/blob/main/docs/wp39-http-server.md)

## Stages

- [x] E1, E2: `SO_REUSEPORT` and `TCP_NODELAY` through `tcpListenFlags`
- [x] E3, E4: `JsonWriter` and a cached HTTP date
- [x] E5: the `json` and `plaintext` entry in `bench/techempower/`
- [ ] E5: the `json` and `plaintext` entry on one process per core
- [x] E6: the Postgres client, its pool and carrier, binary results and a live CI job
- [ ] E6: Postgres over TLS
- [x] E7, E8: the `db`, `query`, `update`, `cached-query` and `fortune` entry
- [ ] E9: submit the entry to TechEmpower *(owner's decision)*
- [x] G1: Chrome over HTTP/2 on TCP in the interop job
- [ ] G1: `curl` and Autobahn for HTTP/1.1 and WebSocket; Chrome over HTTP/1.1
- [x] G2: the request-head deadline (H1-1) and HPACK's allocation (H2-1)
- [ ] G2: a lingering close after a refusal (H1-2)
- [ ] G2: SETTINGS and idle timeouts for HTTP/2 (H2-3)
- [ ] G2: an idle timeout in the TLS carrier (TLS-4)
- [ ] G2: a session clock and rate cap for WebTransport (WT-2)
- [x] G3: session tickets and PSK resumption, without 0-RTT
- [ ] G3: `secp256r1` as a key-share group on the server; `record_size_limit`
- [x] G4: AES-GCM on AES-NI with PCLMULQDQ and on AArch64 AES with PMULL
- [ ] G4: a faster P-256
- [x] G5: a peer's address change, ECN, the AEAD limits and optimistic-ACK detection
- [ ] G5: a congestion controller beyond NewReno; path MTU discovery
- [ ] G6: QUIC on more than one core, design note first
- [ ] G7: one handler for HTTP/1.1, 2 and 3, with `Alt-Svc` and h2c, design note first
- [x] G8: the `h2load` harness
- [ ] G8: HTTP/2 and HTTP/3 figures in BENCHMARKS.md
- [ ] G9: move WebTransport's pin when Chrome moves past the draft *(deferred)*
- [x] G10: the TLS client, chain validation and outbound HTTPS

## Next

G1, the missing interop, then G2's open timeouts, then G7. Spec: [§3 Part B](https://github.com/amritk/nish/blob/main/docs/wp39-http-server.md#3-part-b-a-general-purpose-server-every-version).

## Waiting on a decision

E9: whether and when to submit to TechEmpower, a public number.

## Not planned

Io_uring, `sendfile`, kernel TLS, 0-RTT, HTTP/2 server push.

[All work packages](index.md)
