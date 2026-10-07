# Security audit index

The index of the repository's first security audit (#363). Each area was
audited by its own stage, and each stage left a record in this directory. A
record says what was checked, how, what was found, its severity and what became
of it, and it names the test that pins each property. How to report a
vulnerability, which releases get fixes and the threat model in brief are in
[`SECURITY.md`](../../SECURITY.md).

Every fix landed with a regression test that was shown failing on the stage's
base commit and passing after. An area that found nothing would still have
shipped its record and tests pinning what it checked.

**Severity.** Critical: forgery, key recovery, remote code execution. High:
memory corruption, a verifier that accepts bad input, secret-dependent timing
in a fixture path. Medium: denial of service (a panic, an unbounded loop or
allocation) on attacker input. Low: hardening and documentation drift.

## Areas

Counts are by severity, C / H / M / L, and say what is true on `main` now. A
finding one stage left open and a later stage fixed is counted as fixed, under
the record that found it. The notes below the table name each such finding.

| Area | Record | Scope | Fixed (C / H / M / L) | Open (C / H / M / L) |
| --- | --- | --- | ---: | ---: |
| AEADs | [crypto-aead.md](crypto-aead.md) | `std/crypto/chacha20poly1305.ts`, `std/crypto/aes.ts` | 0 / 0 / 0 / 3 | 0 / 0 / 0 / 0 |
| P-256 and X25519 | [crypto-ecc.md](crypto-ecc.md) | `std/crypto/p256.ts`, `std/crypto/x25519.ts`, their constant-time fixtures | 0 / 0 / 0 / 3 | 0 / 0 / 0 / 0 |
| SHA-2, HMAC, HKDF, ct, base64url | [crypto-k1.md](crypto-k1.md) | `std/crypto/sha256.ts`, `sha512.ts`, `hmac.ts`, `hkdf.ts`, `ct.ts`, `base64url.ts` | 0 / 3 / 0 / 3 ¹ | 0 / 0 / 0 / 0 |
| DER, PEM, X.509 | [crypto-x509.md](crypto-x509.md) | `std/crypto/x509.ts` | 0 / 0 / 0 / 8 | 0 / 0 / 0 / 1 |
| Constant-time checks | [ct-verification.md](ct-verification.md) | `tests/ct-asm.js`, `tests/ct-timing.js`, the `ct_asm_*` fixtures, the harness in `tests/run.js` | 0 / 0 / 0 / 14 | 0 / 1 ² / 0 / 1 |
| Codegen | [codegen.md](codegen.md) | `src/bounds.ts`, `src/attributes.ts`, `src/escape.ts`, `src/parallel.ts`, `src/emit-arrays.ts` | 0 / 4 / 3 / 3 ³ | 0 / 0 / 0 / 0 |
| C runtime | [runtime.md](runtime.md) | `runtime/*.c`, `runtime/nish.h` | 0 / 2 / 3 / 8 ⁴ | 0 / 0 / 0 / 0 |
| CLI and `nish run` | [cli.md](cli.md) | `src/compile.ts`, `src/run-cache.ts`, `src/compilation.ts` (module resolution) | 0 / 1 / 2 / 5 ⁵ | 0 / 0 / 0 / 2 |
| TLS 1.3 server handshake, records and TCP carrier | [tls.md](tls.md) | `std/net/tls.ts`, `std/net/tls/codec.ts`, `std/net/tls/schedule.ts`, `std/net/tls/record.ts`, `std/net/tls/record-server.ts`, `std/net/tls-tcp.ts` | 0 / 0 / 1 / 0 ⁹ | 0 / 0 / 0 / 3 |
| QUIC packets, connections and listener | [quic.md](quic.md) | `std/net/quic-packet.ts`, `std/net/quic.ts`, `std/net/quic-frame.ts`, `std/net/quic-conn-params.ts`, `std/net/quic-conn-ack.ts`, `std/net/quic-conn-cid.ts`, `std/net/quic-listener.ts` | 0 / 0 / 1 / 0 | 0 / 0 / 0 / 6 |
| Supply chain | [supply-chain.md](supply-chain.md) | `install.sh`, `bin/`, the install, seed and build scripts, `.github/workflows/`, `runtime/nish.mjs` and `shim.mjs`, `web/` | 3 / 0 / 2 / 19 | 0 / 0 / 0 / 1 ⁶ |
| HTTP/1.1 and WebSocket | [http1.md](http1.md) | `std/net/http1.ts`, `std/net/http1-server.ts`, `std/net/websocket.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 1 / 2 ⁷ |
| HTTP/2 | [http2.md](http2.md) | `std/net/http2.ts`, `std/net/http2-tls.ts`, `std/net/hpack.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 1 / 1 ⁷ |
| HTTP/3 | [http3.md](http3.md) | `std/net/http3.ts`, `std/net/http3-server.ts` | 0 / 0 / 0 / 3 | 0 / 0 / 0 / 3 ⁷ |
| WebTransport | [webtransport.md](webtransport.md) | `std/net/webtransport.ts` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 2 ⁷ |
| **Total** ⁸ | | | **3 / 10 / 12 / 69** | **0 / 1 / 2 / 22** |

1. K1-6 (High) was found by the K1 stage and fixed by the two after it: `push`
   and `new Array` by the codegen stage, and the file reads and concatenation
   by the runtime stage. The one source left, `join`, was closed with CG-3
   (#427, for #382) and is counted under it.
2. CT-13 is High *if real* and is unconfirmed.
3. CG-9 (Low) was fixed by the runtime stage as RT-7; the codegen record
   counts CG-9 and the runtime record counts RT-7. K1-6, which the codegen
   record also lists, is counted once, under K1.
4. RT-9 added the ownership primitives CLI-7 and CLI-9 need; it is counted as
   a fixed Low. RT-10, RT-11, RT-12 and RT-13 (Low) were left open by the
   runtime stage and fixed by #405 (closes #387). The "CG-3 (rest)" row of
   that record is CG-3 and is counted under codegen.
5. CLI-6 (Medium) was fixed in the runtime as RT-4. The compiler is built by
   the last release, so `nish` itself has the fix from 0.16.0. CLI-8 (Low)
   was left open by the CLI stage and fixed by #425 (for #386): the cache
   entry is named by a SHA-256.
6. SC-17 (Low) is accepted rather than open, and is not counted: `curl … | sh`
   runs `install.sh` unverified, and the record says why that stands.
7. H2-2, H3-4, WT-3, WT-4 and WT-5 (Low) are accepted, with the reason in
   their records, and are not counted, as SC-17 is not. H2-3, H3-5 and WT-2
   are open: the program owns the loop and the clock. WT-1 repeats H3-1 and
   is counted in its own record. H3-2, H3-6 and H3-7 are closed and counted
   as fixed. H1-3 is open: its record says "accepted for now", but it names
   the fix that closes it, so it is counted open and not accepted.
8. A finding that two records both list is counted in each record, except
   K1-6, which is counted once, under K1: CG-9 and RT-7, CLI-6 and RT-4, and
   H3-1 and WT-1. The Total therefore counts those twins twice.
9. TLS-3 is closed by `TlsServer` allocating its buffers once, yet H3-1 and
   QUIC-3's remainder record the QUIC handshake still leaving 89,288 bytes of
   arena memory per connection. The records disagree on what a handshake
   leaves behind; tracked in #492. The counts follow each record as written.

## Open findings

Every finding still open across the records, most severe first. Where a
follow-up issue exists it is named. The rest are recorded in their records
only.

| Id | Severity | File | What is left | Follow-up |
| --- | --- | --- | --- | --- |
| CT-13 | High if real; unconfirmed | `tests/cases/ct_asm_x25519.ts` (`ladderStep`), `std/crypto/x25519.ts` | `ladderStep` measured \|t\| = 35–42 in one link layout of the timing driver and 1.4–2.9 in others. Not established as a leak or as an artefact | #378 |
| H1-1 | Medium | `std/net/http1-server.ts` (`Http1Server.expire`, `Http1TlsServer.expire`, `Http1Connection.idle`) | The idle timeout counts from the last byte moved, so a client that sends one byte of its head every `idleTimeout` (slowloris) keeps its slot, and with every slot held new connections are shed. Memory stays bounded. The fix is a deadline for a whole head | — |
| H2-1 | Medium | `std/net/http2.ts` (`endBlock`, `trailers`), `std/net/hpack.ts` (`HpackDecoder.decode`) | Each header block leaves memory in the arena until the program resets it: 664 bytes a request, so a client that sends requests in a loop grows the server. The way out is an HPACK decoder that decodes into storage the caller owns | — |
| H1-2 | Low | `std/net/http1-server.ts` (`fail`, the carriers' `close`) | After a refusal the socket is closed at once, without the lingering close RFC 9112 §9.6 describes, so a client still sending a body may see a reset instead of the 413 or 400 | — |
| H1-3 | Low | `std/net/http1-server.ts` (`acceptWebSocket`) | Accepting a WebSocket leaves 58 bytes in the arena until the program resets it; once a connection, not once a message | — |
| H2-3 | Low | `std/net/http2.ts`, `std/net/http2-tls.ts` | No clock: a client that never acknowledges SETTINGS, or holds a connection idle, keeps its slot. The program owns the timeout | — |
| H3-1 | Low | `std/net/http3-server.ts`, `std/net/quic.ts`, `std/net/tls.ts` | Each new connection's handshake leaves 89,288 bytes in the arena; it goes when HKDF and HMAC take caller-owned scratch. WT-1 repeats it | — |
| H3-3 | Low | `std/net/http3-server.ts`, `std/net/quic-listener.ts` (`QuicListener.handle`) | What a datagram no slot owns can cost: 3,128 bytes for one answered with a stateless reset, past a budget of 16 at once and one per 100 ms | — |
| H3-5 | Low | `std/net/http3.ts`, `std/net/http3-server.ts` | No clock at the HTTP/3 layer: a client that trickles bytes keeps its slot. The program owns the timeout. WT-2 repeats it for sessions | — |
| WT-1 | Low | `std/net/webtransport.ts`, `std/net/quic.ts`, `std/net/tls.ts` | The QUIC handshake's memory, as H3-1: nothing WebTransport does after a handshake allocates | — |
| WT-2 | Low | `std/net/webtransport.ts` | No clock and no rate cap on a session; the program may `close` or `drain` one. As H3-5 | — |
| QUIC-7 | Low | `std/net/quic-recovery.ts` (`onAck`), `std/net/quic.ts` (`receiveAck`) | An optimistic ACK is not detected: packet numbers are sent in order, so an ACK of one in flight cannot be told from a real one. The Application Data record of 128 packets in flight bounds the effect | — |
| CLI-7 | Low | `src/compile.ts` (`runProgram`) | A cache hit does not check who owns the cache root. The primitive exists now (RT-9); `src/` may use it from the next release | — |
| CLI-9 | Low | `src/compile.ts` (`programOnPath`, `packageRootCandidates`) | The package root is trusted without an owner check, and `programOnPath` takes the first readable `nish`, where the shell takes the first executable one. Documented in [`docs/INSTALL.md`](../INSTALL.md); the primitives exist now (RT-9) | — |
| TLS-1 | Low | `std/net/tls.ts`, `std/net/tls/schedule.ts` | What `TlsServer` keeps in its fields (the caller's ephemeral key bytes, the handshake, traffic and exporter secrets) and the schedule's plain-bytes answers are not wiped. The ECDHE secret and the exchange's key copy are `Secret`s, wiped on every path | #430 |
| TLS-2 | Low | `std/net/tls/record.ts` | The AES key schedule is zeroed by ordinary stores, since `secureZero` takes only bytes, and the copies made while deriving a key die unwiped | #430 |
| TLS-4 | Low | `std/net/tls-tcp.ts` | No timeout in the carrier: a client may hold a slot as long as it keeps its connection open, and once every slot is held new connections are shed. The program owns the loop's timeout | — |
| QUIC-1 | Low | `std/net/quic-packet.ts` (`quicKeys`, `quicKeyUpdateSecret`, `quicKeysUpdate`) | Handshake and 1-RTT traffic secrets and the keys derived from them are not wiped yet. The primitives are on `main` (`secureZero`, #417; `nish:secret`, #418) but this module does not use them yet; the Initial keys are public by construction | #430 |
| QUIC-2 | Low | `std/net/quic.ts` (`QuicConnection`) | What a connection holds between calls: each level's packet keys until the level is discarded, the key-update secrets and the next generation's read keys, both sides' stateless reset tokens, and its `TlsServer`'s secrets and the connection-ID seed until `release()` or the idle timeout, which wipe them; a key update wipes the keys it replaces. The expanded AES key schedules and the HKDF and HMAC intermediates are not wiped | #430 |
| QUIC-4 | Low | `std/net/quic.ts` (`notePhase`, `updateWriteKeys`, `prepareNextReadKeys`) | Each key update a client starts leaves its two key derivations in the arena, 11,200 bytes measured; a connection follows at most 64 and closes on the next with KEY_UPDATE_ERROR, so a client can make the server derive at most 716,800 bytes a connection this way | — |
| QUIC-5 | Low | `std/net/quic.ts` (`QuicServerConfig`), `std/net/quic-listener.ts` (`QuicListener`) | The stateless reset key and Retry token key live in the caller's configuration, and the listener's seed in the listener, for the server's life, unwiped by either module | #430 |
| QUIC-6 | Low | `std/net/quic.ts` | RFC 9001 §6.6's AEAD limits are not counted: no key update before 2^23 packets under one AES-GCM key, no AEAD_LIMIT_REACHED after too many failed opens | Q3 and Q4 |
| X509-6 | Low | `std/crypto/x509.ts` (`x509MintSelfSigned`) | The mint takes its key and serial from the caller. A helper that draws both would have to be a native-only module | — |
| CT-16 | Low | `tests/run.js` | The check reads `clang -O2` for the baseline CPU only. Documented in [`docs/LANGUAGE.md`](../LANGUAGE.md#constant-time-ctselect-and-cteq) | — |
| SC-16 | Low | `.github/workflows/release.yml` | Immutable releases are on from v0.16.0 (`immutable: true`), so its assets and `SHA256SUMS` are fixed once published. Build provenance attestations, the stronger answer, are not: they need `id-token` and `attestations: write` on `release.yml` | #389 |

#382 also tracks the emitter half of CG-6. The codegen stage closed CG-6 by
refusing `orReturn` inside a `scope()` region. Joining before the return in
`src/emit-result.ts` would let that refusal go.

## Corrections still to make

None. The stages listed documentation corrections outside their own files,
and the security-policy stage made every one in `std/README.md`,
`docs/INSTALL.md`, `docs/LANGUAGE.md`, `docs/ARCHITECTURE.md`,
`docs/wp7-runtime.md`, `.claude/selfhost.md`, `codegen.md` and `cli.md`. The
three it left open have been made since: `runtime/shim.mjs` and
`runtime/nish.d.ts` open their writes with `O_NOFOLLOW`, as the native
runtime does for RT-4 (#405, [runtime.md](runtime.md)); `scripts/bootstrap.sh`
no longer needs the working-directory fallback (#425, [cli.md](cli.md)); and
`std/README.md` no longer says a string built by `join` can pass 2^31 − 1
bytes, since #427 closed CG-3.
