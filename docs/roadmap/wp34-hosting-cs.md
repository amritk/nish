# WP34: Hosting cs: the network stack

**State:** In progress · **Done:** 9 of 18 · **Design note:** [`docs/wp34-hosting-cs.md`](https://github.com/amritk/nish/blob/main/docs/wp34-hosting-cs.md)

## Stages

- [x] N1, N2, N3, N5, N6: exported enums and aliases, byte plumbing, clock and entropy and signals, `nish:net`, constant-time builtins
- [x] N9: pooled state, a 100,000-session soak flat at 0 bytes
- [x] K1 to K6: SHA-2, HMAC and HKDF, ChaCha20-Poly1305, AES-GCM, X25519, P-256 ECDSA, DER, PEM and X.509
- [x] Key-holding structs on `nish:secret` ([#430](https://github.com/amritk/nish/issues/430))
- [x] T1, T2: the TLS 1.3 server and TLS over TCP
- [x] H1, H2: the HTTP/1.1 server and WebSocket; HPACK and HTTP/2, `h2spec` 146 of 146
- [x] Q1 to Q4: QUIC packets, connections, loss recovery, streams and datagrams, ECN, NAT rebinding followed
- [x] R1, R2: QPACK and HTTP/3; WebTransport
- [x] A1: the relay in Nish, `examples/relay/`, with the loopback suite ([#489](https://github.com/amritk/nish/pull/489)) and the interop job ([#487](https://github.com/amritk/nish/pull/487))
- [ ] K2, K3, K4: the remaining constant-time disassembly (ChaCha rounds, the bitsliced AES fallback, the X25519 ladder)
- [ ] K5: a faster field inversion, 64-bit limbs and verify's variable-base window
- [ ] T1: key-exchange groups other than x25519 on the server
- [ ] T2, H1, H2: Chrome over TCP for HTTP/1.1, `curl` and Autobahn (WP39 G1); the open timeouts (WP39 G2)
- [ ] Q3: the interop runner's congestion cases
- [ ] A1: DATA down above 1,164 bytes, once QUIC sends past 1,200
- [ ] cs, wave 3: port `services/relay` and run the Nish relay in staging behind a flag
- [ ] cs, wave 3: `boot-check`'s wire pass and `bench:offload` against the Rust relay
- [ ] cs, wave 4: the reverse proxy for `/connect` and `/play` (S5), then retire the Rust relay

## Next

The cs side, waves 3 and 4, in the cs repository. In this repository the lanes' open items are WP39's Part B stages.

## Not planned

WebTransport over HTTP/2, 0-RTT, client-started migration.

[All work packages](index.md)
