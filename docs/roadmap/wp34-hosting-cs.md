# WP34: Hosting cs: the network stack

**State:** In progress · **Done:** 23 of 27 · **Design note:** [`docs/wp34-hosting-cs.md`](https://github.com/amritk/nish/blob/main/docs/wp34-hosting-cs.md)

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
- [x] K2, K3, K4: the remaining constant-time disassembly (ChaCha rounds, the bitsliced AES fallback, the X25519 ladder) ([#1464](https://github.com/amritk/nish/pull/1464)); AEAD-4 and the `--cpu` flag stay open
- [x] K5: a safegcd field inversion and a windowed verify ([#1469](https://github.com/amritk/nish/pull/1469))
- [ ] K5: 64-bit limbs, a scalar safegcd for verify, and a cached table for G
- [x] T1: secp256r1 key shares on the server, direct and through HelloRetryRequest, and the TLS-4 carrier idle timeout ([#1449](https://github.com/amritk/nish/pull/1449), [#1479](https://github.com/amritk/nish/pull/1479))
- [x] T2, H1, H2: `curl --http1.1`, Autobahn and Chrome over HTTP/1.1 in the interop job (WP39 G1, [#1437](https://github.com/amritk/nish/pull/1437)); the lingering close, the HTTP/2 SETTINGS and idle timeouts and WebTransport's session clock (WP39 G2, [#1454](https://github.com/amritk/nish/pull/1454)); H3-5 stays open
- [x] Q3: the interop runner's goodput and crosstraffic cases, both passing for quic-go and ngtcp2 ([#1477](https://github.com/amritk/nish/pull/1477))
- [x] A1: QUIC DPLPMTUD, so DATA down is no longer held to 1,164 bytes ([#1458](https://github.com/amritk/nish/pull/1458))
- [ ] cs, wave 3: port `services/relay` and run the Nish relay in staging behind a flag
- [ ] cs, wave 3: `boot-check`'s wire pass and `bench:offload` against the Rust relay
- [ ] cs, wave 4: the reverse proxy for `/connect` and `/play` (S5), then retire the Rust relay
- [x] Phase two, N7: `atan2`, `tan`, `hypot`, `sign`, `imul` and `f32ToBits`, and JavaScript's `-0` and NaN from `Math.round`, `min` and `max` ([#847](https://github.com/amritk/nish/pull/847))
- [x] Phase two, N8 and the host half of N9: host imports on wasm and a module the page drives every frame, built as [WP50](wp50-wasm-host.md)
- [x] Phase two, N9 for the game server: memory reclaimed per match, built as [WP46](wp46-long-running-memory.md)'s regions
- [x] Phase two, N10: `sort` with a comparator ([#1108](https://github.com/amritk/nish/pull/1108)), and `split` and `toFixed` in `nish/text` ([#1361](https://github.com/amritk/nish/pull/1361), [#1396](https://github.com/amritk/nish/pull/1396))
- [x] Phase two, N11: typed JSON, `jsonDecode` and `jsonEncode` over `nish/json-tokenizer` and `JsonWriter` ([#571](https://github.com/amritk/nish/pull/571), [#572](https://github.com/amritk/nish/pull/572), [#573](https://github.com/amritk/nish/pull/573))
- [x] Phase two, N12: `spawn`, `kill`, `waitPid`, `availableParallelism` and `totalMemory` in `nish:process`
- [x] Phase two, N13: the TLS 1.3 client ([#1018](https://github.com/amritk/nish/pull/1018)), and Postgres over TLS in the carrier ([#1446](https://github.com/amritk/nish/pull/1446))
- [x] Phase two, N14: discriminated unions ([#682](https://github.com/amritk/nish/pull/682), [#716](https://github.com/amritk/nish/pull/716), [#798](https://github.com/amritk/nish/pull/798))

## Next

The cs waves remain (wave 3's two items and wave 4), in the cs repository and its staging. In this repository the open items are 64-bit limbs for K5, and WP39's Part B stages.

## Not planned

WebTransport over HTTP/2, 0-RTT, client-started migration.

[All work packages](index.md)
