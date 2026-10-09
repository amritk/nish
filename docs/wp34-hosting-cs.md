# WP34: Hosting cs — the network stack first

**Status: in progress.** Built: every compiler and runtime item phase one
needs (N1, N2, N3, N5, N6 of §4); every crypto lane, K1 to K6; and the whole
stack of §3 — the TLS 1.3 server handshake and its TCP carrier (T1 #407, T2
#437), with its state kept in the slot (#467); the HTTP/1.1 parser, server and
WebSocket (H1 #399, #468); HPACK and HTTP/2 (H2 #406, #465); QUIC packets,
connections, loss recovery, streams and datagrams (Q1 #404, Q2 #441 and #444,
Q3 #466, Q4 #469), with the handshake's state kept in the slot (#492); QPACK
and HTTP/3 (R1 #464, #470); WebTransport (R2 #471); the loopback suite
across every carrier (#489); and the interop job of decision S2 (#487). **A1 adds the relay**, `examples/relay/`: cs's
`services/relay` in Nish on that stack, with its frame and grant tested
against cs's own fixtures, its caps, timeouts, close codes, stats, identity
and certificate reload, one upstream socket per session, GSO and GRO both
sides and a clean stop on a signal, proved across loopback in `npm test`
(§5a), and N9's soak flat: 100,000 sessions keep 0 bytes, arena and resident
set alike, since the handshake (#492), its signature (#512) and the QUIC
listener (#515) keep nothing. **Open:** #430;
and the cs side of A1 — the port of `services/relay` itself, `boot-check`'s
wire pass and `bench:offload` against the Rust relay. 0.16.0 carried N1, N2,
N3, N5 and N6 (less #402 and `tcpConnect`, #411) and K1–K6 (less
HKDF-Expand-Label, #398); 0.17.0 carries everything from T1 to R2 and the
minted certificate's extensions (#491), so the cs side can start; #489, #492
and A1 are on `main` or in review and not yet released (§7).

This note covers the compiler's half of a plan whose other half lives in the
program being ported,
[`amritk/cs` → `docs/nish-port.md`](https://github.com/amritk/cs/blob/main/docs/nish-port.md).

On 2026-09-28 the owner set the order: **the port starts with the Rust part of
the game server.** That part is the relay, the process that terminates
WebTransport and forwards game datagrams over UDP. It is built on a Nish network
stack that serves HTTP/1.1, HTTP/2 and HTTP/3 with streaming, raw sockets, and
WebTransport. Everything else in cs comes after it:

- the simulation;
- netcode;
- the client, as `wasm`;
- the master;
- the account service.

§8 lists what those later phases owe the compiler. They do not block phase one.

[LANGUAGE.md](LANGUAGE.md) stays normative. Where this note and LANGUAGE.md
disagree, LANGUAGE.md wins, and an item that changes the language lands its rule
there in the same pull request. The TypeScript half of cs moves in place, which
is [WP33](wp33-round-trip.md)'s road in. Its `portability` class (§5.2 there) is
the map of the sites where a rewritten module and its TypeScript reading
disagree. This note therefore adds no check of its own for that.

## 1. Why the relay first

- **It is already a separate process with a byte contract.** The relay knows
  nothing about the game. It parses a 3-byte frame header, verifies a signed
  grant, and forwards an opaque payload. Nothing in it has to agree with the
  simulation to the bit, so moving it carries none of the determinism risk the
  rest of the port does. Its only contracts with the TypeScript are the frame
  format and the grant format, and both are already tested against fixtures
  that `packages/protocol/src/session.ts` produces.
- **It is the edge the whole server needs.** A native game server needs
  sockets, TLS, QUIC, HTTP and WebTransport before it can take a single
  player. Building that stack under the relay first means the game server
  inherits a stack that has already carried real traffic.
- **It forces exactly the language work that everything after it needs.** That
  work is:
  - a process that runs for days;
  - memory that does not grow while sessions come and go;
  - byte plumbing without copies;
  - a clock and entropy;
  - constant-time arithmetic.

  §4 lists each item, and each is argued from a line of the relay.
- **It has a Rust twin to be measured against.** `bun run bench:offload` and
  the relay's own caps give a like-for-like comparison: latency added per
  datagram, datagrams per `recv`, and resident memory at 4,096 sessions.

## 2. What the relay does today

`services/relay` is 2,545 lines of Rust (`wc -l src/*.rs`, 2026-09-28) over
`wtransport` 0.7, which brings in quinn, rustls, ring and rcgen, plus tokio.
It does eight things:

- **Terminates WebTransport over HTTP/3 and uses only its datagrams.** No
  WebTransport stream is opened in either direction. The browser sends one
  datagram per tick. The QUIC keep-alive interval is 3 s and the idle timeout
  30 s.
- **Speaks a 3-byte frame header** (`frame.rs`): Hello, HelloOk, Data, Ping,
  Pong, Close and Stats, mirroring `session.ts`.
- **Verifies a grant before anything else** (`grant.rs`). The grant is
  `v1.<base64url JSON>.<base64url HMAC-SHA-256>`, and the signature is checked
  before the JSON is parsed.
- **Opens one upstream UDP socket per session**, so the game server sees one
  source address per player.
- **Enforces caps.** At most 4,096 sessions, 64 per peer, and 256 datagrams a
  second per session. A session has 5 s to say hello and is dropped after 10 s
  idle. It reports stats every 2 s.
- **Holds one of two identities** (`tls.rs`):
  - a self-signed ECDSA P-256 certificate, valid for at most fourteen days and
    pinned by the browser through `serverCertificateHashes`, with its hash
    written to a file the game server reads;
  - or a real `--cert`/`--key` pair, re-read when the files change (polled
    every 60 s).
- **Batches with the kernel** (`offload.rs`). It uses `UDP_SEGMENT` and
  `UDP_GRO` through raw `cmsg`. This is the only `unsafe` in cs.
- **Stops cleanly on a signal.**

## 3. The target: one stack, two transports

```
                apps:  relay (phase 1) · the game server's HTTP (phase 1b) · later, the game server itself
                          │
   ┌──────────────────────┴───────────────────────────┐
   │ TCP                                               │ UDP
   │ TLS 1.3 records ─ ALPN                            │ QUIC v1 (RFC 9000/9001/9002) + DATAGRAM (RFC 9221)
   │   ├ HTTP/1.1: streaming bodies, WebSocket          │   └ HTTP/3 (RFC 9114) + QPACK (RFC 9204)
   │   └ HTTP/2 (RFC 9113) + HPACK (RFC 7541),          │       ├ extended CONNECT (RFC 9220), HTTP datagrams (RFC 9297)
   │       extended CONNECT for WebSocket (RFC 8441)    │       └ WebTransport over HTTP/3
   └──────────── TLS 1.3 handshake, one state machine for both (RFC 8446) ────────┘
                 crypto primitives · X.509/DER · sockets and the loop (the runtime)
```

**The TLS handshake is one state machine with two carriers.** Over TCP, its
messages travel in TLS records. Over QUIC, they travel in CRYPTO frames at
three encryption levels. This is RFC 9001's design, and it is the one
structural decision to take on the first day: a handshake written against TCP
records has to be rewritten for QUIC.

**Streaming means bodies never wait to be complete.** In all three HTTP
versions, a request or response body is read and written a chunk at a time,
with flow control pushing back on the sender. Nothing in the stack buffers a
whole body.

**Out of scope for phase one:**

- WebTransport over HTTP/2, which no browser cs targets speaks.
- 0-RTT.
- Connection migration.
- Server push.
- A QPACK dynamic table. Capacity 0 is legal, and the stack starts there.
- Verifying a client's certificate.
- The client role of TLS. The account service will need it later, for Postgres
  and for Resend. It reuses the same key schedule, and is written down in §8
  rather than built here.

## 4. What the compiler and the runtime owe phase one

Every item followed the MASTER_PLAN §5 sizes (S under a day of agent work, M
one to two days, L several), shipped with the construct checklist of
[ARCHITECTURE.md](ARCHITECTURE.md), and had to land **in a release before
anything above it could use it**. N1, N2, N3, N5 and N6 are built and in
0.16.0, except N5's `tcpConnect` (#411), which is on `main`. N9 is a
discipline the stack keeps, and its acceptance soak belongs to A1.
LANGUAGE.md has the rule for each built item.

### N1. Exported enums and type aliases (S–M, checker lane)

A protocol stack is enums crossing module boundaries: frame types, error
codes, stream states and settings identifiers. **Built** in #296 (enums)
and #300 (aliases): an exported enum is used in a second module as a field type, a
parameter type, a `switch` discriminant and a `Map` key
(`tests/link/enum_export_uses`), and an exported alias resolves, in the module
that wrote it, to the class, array or `T | null` it names
(`tests/link/alias_export_*`). One pre-pass binds every module's enums and
aliases before any signature. String enums, `const enum` and default exports
stay refused.

### N2. Byte plumbing (S–M, builtins lane)

**Built** in #295: `dst.set(src, offset)` with `TypedArray.prototype.set`'s
meaning, a `memmove`, and a `memcpy` where the checker proves the two buffers
distinct; `fill`, a `memset` on a `u8[]`; and `readFileBytesSync(path): u8[] |
null` in `nish:fs`, because a DER key is binary. `set` is WP33 class A under
`runtime/nish.mjs` and class C without it.

A window into a buffer is spelled `(buf, off, len)` by convention, not by a
new view type. A view would be a second array layout that every array path in
the emitter has to handle, which is a much larger change than the plumbing
needs.

### N3. A wall clock, entropy, file times and signals (S, runtime-os lane)

**Built** in #312: `Date.now()` in whole milliseconds (every other `Date`
member is refused by one rule); `crypto.getRandomValues` on a `u8[]` only, at
most 65,536 bytes a call, panicking rather than returning weak bytes;
`statMtimeSync`, which answers NaN for a path it cannot stat, because an `f64`
has no `null`; and `signalFd()` / `readSignal(fd)` in `nish:process`. They
measured 571 bytes of `.text*` against the 143 `runtime-os.c` had left, so
they are a translation unit of their own, `runtime/runtime-host.c`, with a
ceiling of 768. The signal descriptor is a pipe written from a `sigaction`
handler on every platform, not the `signalfd` this note proposed: a `signalfd`
hears only a signal blocked in every thread, and a running `scope()` task
keeps its own mask. The signal pair is WP33 class C with no synchronous shim.

### N5. Sockets and the loop a program owns (L, runtime lane)

[wp24](wp24-async.md) §2 named "a real server" as the trigger for revisiting
`async`; this is one, and the refusal stands anyway. A server that owns its
loop and blocks in `epoll` until the next deadline or the next readable socket
needs no colour in the language, and that loop is what tokio runs underneath
the relay today.

**Built** as the builtin module `nish:net`, each call a global too, on `i32`
descriptors: addresses and non-blocking TCP (#341); UDP with `SO_REUSEPORT`,
`UDP_SEGMENT`, `UDP_GRO` and the ECN bits (#343); a level-triggered readiness
loop, `pollCreate`, `pollAdd`, `pollModify`, `pollRemove` and `pollWait`, over
epoll on Linux and kqueue on Darwin (#349); the dual-stack `"::"` path
exercised over both families (#402); and the client half of TCP, `tcpConnect`
and `connectResult` (#411). Every socket is non-blocking and close-on-exec, a
failure is a negative errno in Linux's numbering on every platform, an address
is 18 bytes of the caller's `u8[]`, and nothing allocates. N3's `signalFd()`
goes into the loop like any other descriptor (`net_loop_two`). The C is
`runtime/runtime-net.c`, 2,071 bytes of `.text*` when the loop landed, against
a ceiling of its own of 2,304. One finding changed the GSO/GRO acceptance: on
loopback, GRO keeps a GSO super-packet whole but does not merge datagrams sent
one by one, so the test pairs a Nish GSO sender with a Nish GRO receiver. The
Darwin branch is compiled by CI's Darwin rows and run by nothing. `wasm` is out
of scope, because a browser reaches the network through the host.

### N6. Constant time (S–M, builtins lane)

Crypto code must not branch or index on a secret, and LLVM promises nothing
about that. **Built** in #310: `ctSelect(mask, a, b)` and `ctEq(a, b)` over
`u32` and `u64`, lowered behind an empty inline `asm` barrier, and
`tests/ct-asm.js`, which reads the `-O2` assembly of every function a
`tests/cases/ct_asm_*` fixture names, for x86-64 and aarch64, on every
`npm test`, and refuses a conditional branch or a secret-indexed access. The
weekly dudect-style timing run over the same functions landed in #339
(`.github/workflows/ct-timing.yml`, not a pull-request check).
[docs/security/ct-verification.md](security/ct-verification.md) records what
the check models. Wide multiplication was not needed: K4 and K5 are written in
limbs whose products fit in `i64` and `u64`.

### N9. Programs that do not exit — phase one needs the discipline, not the note

The arena never frees an object, and the relay runs for days while sessions
come and go. Phase one does not wait for a memory model. It does not need one,
because every cap the relay has is a compile-time number. So the stack has two
rules:

- **State lives in pools sized at start-up.** There are 4,096 session slots
  and a matching number of QUIC connection slots, stream tables and reassembly
  buffers. A slot is reset and reused, never freed.
- **Nothing allocates per packet.** The loop's body is a pass scope
  (LANGUAGE.md §Memory model). Anything a handshake allocates dies with that
  pass, or is copied into its slot.

The record layer and `TlsTcpServer` keep both rules (a record and a slot's
reuse allocate nothing). The handshakes and the QUIC connection do not yet:
TLS-3 measures about 52 KB of arena per TLS handshake, and QUIC-3 records that
a connection allocates per packet ([docs/security/tls.md](security/tls.md),
[docs/security/quic.md](security/quic.md)). `using a = arena()` (#420) is
refused around them while HKDF and HMAC store allocations of their own, and
`Arena.release` is deprecated (#428). QUIC-3 is to close with Q3 and Q4, and
TLS-3 with a handshake that keeps its state in the slot or an arena per
connection; A1's soak cannot pass before both have.

The note that the game server needs (regions, a scoped arena, or reference
counting; §8) is still to be written. The relay does not wait for it.

**Acceptance.** A soak in which 100,000 sessions connect, send and leave
through the relay, with `Arena.used()` and resident memory flat after the pools
fill.

## 5. The stack, in lanes that start in parallel

Most of a protocol stack is pure functions with published answers, and most
lanes below can be written and proved against their RFC's own test vectors
**with no socket.** A lane owns its directory and nothing else. **Needs** lists
what must be released or merged before the lane merges, not before it starts: a
lane can be written against a stub of what it needs.

**Where the code lives is the standard library** (decision S2, §6). The
protocols are `std/` modules, imported as `nish/crypto/<primitive>`,
`nish/net/tls`, `nish/net/http1`, `nish/net/http2`, `nish/net/quic`,
`nish/net/http3` and `nish/net/webtransport`. A `nish/` specifier may already
have more than one segment (LANGUAGE.md §Modules). The sockets and the loop are
N5's builtin module, `nish:net`, beside `nish:fs` and `nish:io`. The relay
itself (A1) is cs's own `services/relay`, rewritten in Nish on top of them.

| Lane | What | Proved by | Needs | State |
| --- | --- | --- | --- | --- |
| **K1** | SHA-256, SHA-384, HMAC, HKDF, constant-time compare, base64url | FIPS 180-4 and RFC 4231, RFC 5869 vectors | N1 | built |
| **K2** | ChaCha20-Poly1305, and ChaCha20 as QUIC header protection | RFC 8439 §2 vectors; RFC 9001 A.5 | N1, N6 | built |
| **K3** | AES-128 and AES-256 with GCM, bitsliced so that it runs in constant time; AES-ECB as QUIC header protection | NIST SP 800-38D vectors, Wycheproof `aes_gcm` | N1, N6 | built |
| **K4** | X25519, with 25.5-bit limbs in `i64` | RFC 7748 §5.2 and the iterated vector, Wycheproof `x25519` | N6 | built |
| **K5** | P-256 ECDSA sign and verify, ported from fiat-crypto's 32-bit output (MIT/Apache/BSD; [licensing](../.claude/licensing.md) rules apply), with RFC 6979 nonces | RFC 6979 A.2.5, Wycheproof `ecdsa_secp256r1_sha256` | N6 | built |
| **K6** | DER, PEM and X.509: parse a key and a chain; mint the self-signed ECDSA P-256 certificate, at most fourteen days; its SHA-256 for `serverCertificateHashes` | `openssl x509 -text` reads what it mints; a golden DER; Chrome accepts the hash (A1's gate) | K1, K5, N3 | built; the mint carries the extensions Chromium's quiche requires (X509-9), and Chrome accepting the hash live is S2's interop job's |
| **T1** | TLS 1.3 **server** handshake, carrier-agnostic. The key schedule, and ClientHello through Finished, with ALPN, SNI, the QUIC transport-parameters extension and HelloRetryRequest. No 0-RTT and no client authentication | RFC 8448 §3's full trace reproduced byte for byte for the key schedule and every server message | K1–K5 | built |
| **T2** | TLS records over TCP | `openssl s_client`, `curl`, Chrome; a record-boundary fuzz | T1, N5 | built, but for Chrome |
| **H1** | HTTP/1.1 server: an incremental parser, keep-alive, chunked bodies both ways, `Upgrade`; WebSocket framing (RFC 6455) | a corpus of split-at-every-byte requests, `curl`, and the Autobahn suite's server cases | N1, N2 | built against a Nish client over TCP and TLS; **`curl` and Autobahn open** (S2's interop job) |
| **H2** | HTTP/2: frames, HPACK with Huffman, the stream state machine, flow control, SETTINGS and GOAWAY, and extended CONNECT for WebSocket (RFC 8441) | RFC 7541 Appendix C for HPACK; `h2spec` for the rest; `curl --http2`, Chrome | N1, N2 | built against a Nish client; **`h2spec` and Chrome open** (S2's interop job) |
| **Q1** | QUIC packets: varints, long and short headers, Initial secrets, header protection, packet-number recovery, Retry integrity tag | RFC 9001 Appendix A reproduced byte for byte (A.2 client Initial, A.3 server Initial, A.4 Retry, A.5 ChaCha20 short header) | K1–K3 | built |
| **Q2** | QUIC connections: the handshake over T1 at three levels, transport parameters, ACK generation, connection-id management, address validation and Retry, version negotiation, stateless reset, idle timeout, key update | the quic-interop-runner's server test cases (handshake, transfer, retry, chacha20, multiplexing, keyupdate) against at least two client implementations | Q1, T1, N5 | built against aioquic; **the interop runner open** |
| **Q3** | Loss detection, PTO and NewReno with pacing (RFC 9002) | the interop runner's lossy and congested cases; the relay's own RTT-to-ack trace under `tc netem` | Q2 | built, with Appendix A and B worked by hand; **the interop runner's lossy and congested cases open** |
| **Q4** | Streams (bidirectional and unidirectional, with flow control) and DATAGRAM frames (RFC 9221); send batching through GSO | the interop runner's transfer cases; a datagram round trip at the MTU edge | Q2 | built, with a datagram at the MTU edge, a GSO flight read back through GRO, and nothing allocated per packet (QUIC-3 closed); **the interop runner's transfer cases open** |
| **R1** | HTTP/3 and QPACK, with a static table and dynamic capacity 0 | RFC 9204 static-table encodings; the interop runner's `http3` case; `curl --http3` where available | Q4, H2's header model | QPACK and HTTP/3 built; the interop runner's `http3` case and `curl --http3` open (S2's job) |
| **R2** | Extended CONNECT (RFC 9220), HTTP datagrams (RFC 9297) and **WebTransport over HTTP/3**: sessions, datagrams, unidirectional and bidirectional streams, and close. It is pinned to the draft Chrome negotiates today; that draft's SETTINGS and headers are recorded once from a `wtransport` 0.7 exchange and held as a golden | Chrome through Playwright; a `wtransport` (Rust) client against the Nish server, which is the cross-implementation test | R1, Q4 | built against a Nish client, with a `wtransport` 0.7 exchange recorded and replayed byte for byte; **Chrome through Playwright open** (S2's interop job) |
| **A1** | **The relay**: `frame` and `grant` with their existing fixtures, the session table and caps, the timeouts and stats, the hash file and certificate reload, one upstream socket per session, and GSO/GRO | the relay's `cargo test` cases ported with the same fixtures; cs's `boot-check` wire pass asserting WebTransport carried the match; `bench:offload` against the Rust relay; N9's soak | R2, K6, N3, N5 | built in nish as `examples/relay/`, with the `cargo test` cases and fixtures ported and every refusal across loopback; N9's soak flat (0 bytes a session over 100,000, with #492, #512 and #515); `boot-check`, `bench:offload` and the cs port open, 0.17.0 carrying R2 |

**What is left, in order.** A1 waits on the chain Q3 → Q4 → R1 → R2, which is
the critical path; R1's QPACK static table is a pure function and can start
beside Q3. The HTTP/1.1 and HTTP/2 servers (the rest of H1 and H2) are off
that path: S5 needs them only once the relay is live. Three items cut across
lanes: the loopback suite below, now writable since T2 and Q2 exist; S2's
interop job (the quic-interop-runner, `h2spec`, Chrome through Playwright),
which no lane has yet; and #430, which moves the TLS and QUIC key-holding
structs onto `nish:secret` so the wipes TLS-1, TLS-2 and QUIC-1, QUIC-2 and
QUIC-5 record can close.

### 5a. Landed

Each module reproduces its specification's published vectors in a
`tests/link/crypto_*` or `tests/link/net_*` program, and each has a security
record under [`docs/security/`](security/README.md) (`crypto-k1.md`,
`crypto-aead.md`, `crypto-ecc.md`, `crypto-x509.md`, `tls.md`, `quic.md`)
whose findings are what the "Left" column cites.
[`std/README.md`](../std/README.md#nishcrypto--the-primitives-under-tls-13)
lists what each module exports and what is verified, and
[its protocol-stack section](../std/README.md#nishnet--the-protocol-stack) the
`nish/net` modules.

| Lane | Pull requests | Modules | Left |
| --- | --- | --- | --- |
| **K1** | #287 (the `std/` walker nested modules needed), #288, #291, #294, #298; HKDF-Expand-Label #398; audit #375 | `nish/crypto/sha256`, `sha512` (SHA-512 and SHA-384), `hmac`, `hkdf`, `ct`, `base64url` | Wycheproof's HMAC and HKDF vectors. HMAC and HKDF wiping their own state, and taking keys as `Secret`s |
| **K2** | #332; Wycheproof (all 325 cases) and audit #372 | `nish/crypto/chacha20poly1305` (ChaCha20, Poly1305, the AEAD, RFC 9001 §5.4.4's header-protection mask) | The ChaCha20 rounds and the loops around both halves by disassembly: `ct_asm_chacha20poly1305` reads the Poly1305 block, its final reduction and the tag compare |
| **K3** | #340, with Wycheproof `aes_gcm`; audit #372 | `nish/crypto/aes` (AES-128 and AES-256, bitsliced; GCM; RFC 9001 §5.4.3's header-protection mask) | The key schedule, packing and the block loops by disassembly (`ct_asm_aes` reads one round, one GHASH multiply and the tag compare). AES-NI and PCLMUL as builtins, per S1, when a profile asks. AES-192 is out of scope |
| **K4** | #289; ladder by disassembly #339; Wycheproof and audit #373 | `nish/crypto/x25519` | The 255-step ladder loop, the inversion and the encodings remain discipline (`ct_asm_x25519` reads the field operations, the swap and one ladder step) |
| **K5** | #336; Wycheproof's DER cases through the library's own `x509DerSignatureRS` #361; audit #373 | `nish/crypto/p256` (ECDSA sign and verify, RFC 6979 nonces) | The 64-window loop, the table build, the inversions and the nonce derivation remain discipline (`ct_asm_p256` reads fiat's field and scalar arithmetic, the table read, the point operations and one window step). A 64-bit or fixed-base-table P-256, when a profile of signing asks |
| **K6** | #346; audit #376 | `nish/crypto/x509` (DER, PEM, a P-256 key from SEC1 or PKCS#8, a chain parsed, an ECDSA signature verified, the self-signed 1-to-14-day certificate minted, its SHA-256) | Chrome accepting the hash, which is A1's gate: since X509-9 ([`security/crypto-x509.md`](security/crypto-x509.md)) the minted certificate carries the critical basicConstraints and keyUsage that quiche's `CertificateView` needs before it compares a hash, and the live proof is S2's `chrome (minted certificate)` lane. It parses and does not validate: no path validation and no extensions read, which the relay's own `--cert` needs no more than |
| **T1** | #407 | `nish/net/tls` (the server state machine), `nish/net/tls/codec`, `nish/net/tls/schedule` | Groups other than x25519; NewSessionTicket, 0-RTT and client authentication (§3 keeps them out); the wipes TLS-1 records (#430) |
| **T2** | #437 | `nish/net/tls/record`, `nish/net/tls/record-server` (TLS over a byte stream, sans-IO), `nish/net/tls-tcp` (the TCP carrier: a slot pool on `nish:net`) | Chrome; a carrier idle timeout (TLS-4); `record_size_limit`; the client role (N13) |
| **H1** (parser) | #399 | `nish/net/http1` (the incremental request parser and the response writer), `nish/net/websocket` (RFC 6455 framing and the handshake), and `nish/crypto/sha1` for the accept key alone | The server on `nish:net`, and `curl` and the Autobahn suite's server cases against it |
| **H1** (server) | #468 | `nish/net/http1-server` (`Http1Connection`, sans-IO, and the slot pools `Http1Server` on plain TCP and `Http1TlsServer` on `nish/net/tls-tcp` with ALPN `http/1.1`: keep-alive and pipelining, bodies streamed both ways with back-pressure, `Upgrade` to `nish/net/websocket` on the same slot, the idle timeout); `nish/net/http1` keeps a head as spans so a warmed slot allocates nothing per request | `curl` and the Autobahn suite's server cases in S2's interop job; a deadline for a whole head (H1-1 in [`security/http1.md`](security/http1.md)); a lingering close after a refusal (H1-2) |
| **H2** (HPACK) | #406 | `nish/net/hpack` (RFC 7541 with Appendix B's Huffman code; Appendix C reproduced, with the dynamic table after every step) | Frames, the stream state machine, flow control, SETTINGS and GOAWAY, extended CONNECT (RFC 8441), and `h2spec` in S2's interop job |
| **H2** (frames) | #465 | `nish/net/http2-frame` (every RFC 9113 §6 frame, read and written), `nish/net/http2` (the connection: SETTINGS, the §5.1 stream states, flow control both ways, PING, RST_STREAM, GOAWAY, CONTINUATION, extended CONNECT), `nish/net/http2-tls` (the TLS carrier with ALPN `h2`, a slot pool), and `nish/net/http-fields` (the header model R1 shares) | `h2spec` and Chrome in S2's interop job; HPACK's allocation per header block (H2-1 in [`security/http2.md`](security/http2.md)); a SETTINGS timeout and an idle timeout, which need a clock (H2-3) |
| **R1** (QPACK) | #464 | `nish/net/qpack` (RFC 9204 with a dynamic table of capacity 0: the static table, 62-bit integers, field sections both ways, and the encoder and decoder streams' instructions accepted or refused with the RFC's error codes; Huffman from `nish/net/hpack`; Appendix B.1 reproduced, B.2 to B.5's dynamic instructions refused) | HTTP/3 itself, on Q4's streams with H2's header model; a dynamic table, if a measurement ever asks for one; the interop runner's `http3` case and `curl --http3` |
| **R1** (HTTP/3) | #470 | `nish/net/http3-frame` (RFC 9114's frames, stream types, SETTINGS and error codes, read and written in place), `nish/net/http3` (`Http3Connection` on Q4's streams: the control and QPACK streams, requests with bodies streamed both ways, trailers, GOAWAY, every connection and stream error, a 431 past the field-section cap, no push), `nish/net/http3-server` (the UDP carrier with ALPN `h3`: a slot pool behind a `QuicListener`, routing by a connection-ID index, a timer wheel, paced GSO flights) | The interop runner's `http3` case and `curl --http3` in S2's job; extended CONNECT and HTTP datagrams (R2); the QUIC handshake's memory per connection (TLS-3) and the listener's per unrouted datagram (H3-4 in [`security/http3.md`](security/http3.md)) |
| **R2** | #471 | `nish/net/webtransport` (`WebTransport` over an `Http3Connection`: sessions by extended CONNECT with `:protocol` `webtransport`, HTTP datagrams with the quarter stream ID, unidirectional (0x54) and bidirectional (0x41) streams routed to their session both ways, streams that come before their session held and bounded, CLOSE_WEBTRANSPORT_SESSION and DRAIN_WEBTRANSPORT_SESSION, every cap fixed at start-up), and in `nish/net/http3` the seam: SETTINGS_ENABLE_CONNECT_PROTOCOL, SETTINGS_H3_DATAGRAM and draft-02's and draft-07's WebTransport settings, requests held until the client's SETTINGS, WebTransport streams held and handed over | Chrome through Playwright in S2's interop job; the QUIC handshake's memory per connection (TLS-3); a session's clock and rate caps, which are the program's (WT-3 and WT-4 in [`security/webtransport.md`](security/webtransport.md)) |
| **Q1** | #404 | `nish/net/quic-packet` (varints, headers, packet numbers, Initial secrets, packet and header protection for the three suites, the key-update secret, the Retry integrity tag) | The wipes QUIC-1 records (#430). RFC 9001 prints no AES-256-GCM packet, so `net_quic_packet` checks one against Python's `cryptography` |
| **Q2** | #441 (the connection: TLS over CRYPTO at three levels, transport parameters, ACKs, connection IDs, stream data), #444 (Version Negotiation, Retry, stateless reset, the idle timeout, key update both ways) | `nish/net/quic`, `quic-frame`, `quic-conn-params`, `quic-conn-ack`, `quic-conn-cid`, `quic-listener` | Proved against aioquic, each exchange replayed byte for byte from a Nish UDP client inside `npm test`, not yet by the quic-interop-runner. Loss recovery (Q3); full streams with flow control (Q4); the AEAD limits (QUIC-6); per-packet allocation (QUIC-3) and the key-update share of the arena (QUIC-4, capped); the wipes QUIC-2 and QUIC-5 record (#430) |
| **Q3** | #466; the handshake flight's two probes and early resend (QUIC-8) | `nish/net/quic-recovery` (RFC 9002: sent-packet rings per space, the RTT estimate, loss by packet and time threshold, the probe timeout with backoff, NewReno, a pacer), used by `nish/net/quic` to send lost CRYPTO, STREAM and connection-ID frames again, and `nish/net/quic-listener`'s paced send | The interop runner's lossy and congested cases; ECN; detecting an optimistic ACK (QUIC-7); per-packet allocation, now with the fixed record of packets in flight (QUIC-3, Q4) |
| **Q4** | #469 | `nish/net/quic-stream` (stream IDs, the §3 state machines, fixed buffers per stream, flow control both ways and at both levels, the limits, RESET_STREAM and STOP_SENDING), `nish/net/quic-datagram` (RFC 9221's rings), DATAGRAM frames and `max_datagram_frame_size` in `quic-frame` and `quic-conn-params`, `quic-listener`'s paced GSO flight and GRO receive, and `nish/net/quic` reading and writing every packet in place, a reusable slot (QUIC-3 closed) | The interop runner's transfer cases; the AEAD limits (QUIC-6). The handshake's own arena (88 KB a connection) went with N9's QUIC stage, which keeps the handshake's state in the slot: a connection through a reused slot now keeps 0 bytes (QUIC-3, `net_quic_memory`), and a handshake through the HTTP/3 carrier 0 bytes too, now that the caller's P-256 signature is made in scratch (#512) and `quic-listener` reads a datagram no slot owns in place and answers into scratch (H3-1 and H3-3 closed) |
| **A1** | #488 | `examples/relay/` (not a `std/` module): `frame` and `grant` ported from cs's `frame.rs` and `grant.rs` with their fixtures, a hand-written JSON reader for the grant (N11's phase-one case), the per-peer table, `Relay` (the session flow, both caps, the rate cap, the hello and idle timeouts, STATS, CLOSE with every code, one upstream socket per session, GSO and GRO with `--offload`) on `nish/net/http3-server` and `nish/net/webtransport`, the identity (a 13-day self-signed P-256 certificate and its hash file, or `--cert`/`--key` re-read every 60 s) and main.rs's command line and environment, with a clean stop on SIGINT and SIGTERM | **NAT rebinding**: the QUIC server does not follow a peer's address change, so a client whose NAT rebinds loses its session. DATA down is at most 1,164 bytes until QUIC sends packets past 1,200; no DNS, so a grant names an address: the cs port, `boot-check`'s wire pass and `bench:offload` |
| **S2** (interop job) | #487 | No module: `.github/workflows/interop.yml` and `tests/interop/` run the quic-interop-runner (quic-go, ngtcp2), `h2spec`, `curl --http3` and `--http2`, and Chromium through Playwright over WebTransport against `tests/link/net_interop_server`, a server on every carrier from one loop whose smoke checks run in `npm test`; `h2spec` 146 of 146 | Autobahn's server cases for H1. Three `std/` defects were found here and fixed: the pacer's timer (#490), the minted certificate's extensions (#491), and a lost first flight resent one datagram per probe timeout (#514)

K1 and K4 did not wait for their **Needs** column: they export no enum or
alias, so N1 was not needed, and they are written branch-free on secrets by
masking, so N6 *verifies* them rather than being what they are written with.
The assembly check reads golden fixtures, one or more per module
(`ct_asm_k1_ct`, `ct_asm_k1_base64url`, `ct_asm_mac`, `ct_asm_x25519`,
`ct_asm_chacha20poly1305`, `ct_asm_aes`, `ct_asm_p256`), each a copy of the
module's constant-time cores that a `tests/link/` case holds to the original;
what no fixture holds is each module's discipline, stated in its header. Private
keys are `Secret`s in `p256`, `x25519` and `x509` (`nish:secret`, #418, ECC-2
and X509-7); the other modules take keys as plain arrays. K3's GHASH multiply
is adapted from BearSSL and K5's field and scalar arithmetic is ported from
fiat-crypto; both keep their notice, and their licence texts ship beside them
and are named in every presence gate of `release.yml`.

**One test suite belongs to no single lane:** a Nish server and a Nish client
over loopback, for every carrier. It is what catches two lanes that each pass
their own vectors but disagree with each other. T2 and Q2 exist, so it can be
written now; RFC 8448 over loopback from a Nish client (`net_tls_record_tcp`)
and the Nish UDP client that replays aioquic's exchanges are its first pieces.
The suite is `tests/link/net_loopback` (and its `_f64` twin): a section per
carrier — TLS over TCP, HTTP/1.1, WebSocket, HTTP/2, QUIC, HTTP/3 and
WebTransport — each a Nish server on the carrier and the lanes' own scripted
clients on real loopback sockets in one `pollWait` loop, with every server
call's `Arena.used()` flat over fifty rounds on a warm connection and the
memory a whole connection keeps pinned beside it.

## 6. Decisions for the owner

| | Question | Recommendation |
| --- | --- | --- |
| **S1** | Crypto: pure Nish, or a verified C library through FFI | **Pure Nish, and it is also the shorter road.** Three facts make it affordable. First, ChaCha20-Poly1305 is add, rotate and xor, so it is constant time and fast in portable code; the server picks the cipher suite, and every browser offers it. Second, AES-128-GCM is required only for QUIC Initial packets, whose keys come from a connection id sent in the clear, and as TLS 1.3's mandatory fallback, where a bitsliced AES is correct though slow. Third, X25519 and P-256 fit in `i64` and `u64` limbs. The C route needs [wp27](wp27-ffi.md) S3 and S4, neither built, and hands the fixpoint callees it cannot see into. AES-NI and PCLMUL become builtins later, when a profile of the relay asks for them |
| **S2** | Where the stack lives | **Decided by the owner, 2026-09-28: the standard library.** It follows [wp26](wp26-stdlib.md)'s own line: a builtin exists for a syscall, and everything the language can express is a module. So N5's sockets are the builtin module `nish:net`, and everything above them is `nish/crypto/*` and `nish/net/*`. What it buys is the property wp26 §1a measured: a `std/` module is compiled into its importer, so the attribute fixpoint sees through it, and `--gc-sections` drops what the relay does not call. What it costs is cadence and suite. The stack ships in compiler releases, so a Release PR is worth cutting as each lane cs waits on lands. Its interop suites (the QUIC interop runner, `h2spec`, Chrome) run as a CI job of their own, beside `npm test` rather than inside it, and each module keeps wp26 §5's `tests/link/` case |
| **S3** | The relay alone first, or the fold into the game server first | **The relay alone**, as a drop-in binary with the same flags and the same hash file, chosen per deployment. It carries real players while the game server is still Bun. Folding the relay into the game server is phase two's cutover, once netcode is Nish |
| **S4** | Memory for phase one | **Pools sized from the caps** (N9 above). The memory-model note is phase two's, and nothing here waits for it |
| **S5** | The HTTP the stack serves beyond the relay | **All three versions, once the relay is live (wave 4).** The same process answers `/connect` and upgrades `/play` for the Bun game server as a reverse proxy. That puts H1 and H2 under real traffic in phase one, and makes Caddy optional for game traffic |

## 7. Waves

| Wave | Compiler and runtime | The stack, in `std/` | cs | State |
| --- | --- | --- | --- | --- |
| 0 | N1, N2, N3, N5, N6 | K1–K6; H1 parser, HPACK, Q1, QPACK tables | S1, S3–S5 answered; C15 and C16 (cs note) | done but for the QPACK tables |
| 1 | a release carrying N1–N3, N5, N6, and K1–K6 as they land | T1, T2, H1 server, H2, Q2 | — | 0.16.0 carries N1–N3, N5 and N6 and K1–K6, less #398, #402 and #411; T1, T2 and Q2 are on `main`; the H1 server and the rest of H2 are open |
| 2 | — | Q3, Q4, R1; the loopback suite | — | open; the loopback suite landed (#489) |
| 3 | a release carrying R2 | R2 | A1, the relay in Nish; then **the Nish relay in staging behind a flag**, with `boot-check`'s wire pass and `bench:offload` against Rust | open |
| 4 | — | S5's reverse proxy | the Rust relay retired | open |

Because the stack is `std/`, cs can use a lane only once a release carries it,
so a release is worth cutting whenever a lane A1 depends on has landed. The
first such release, the one carrying the N items, was 0.16.0. The next one worth
cutting carries T1, T2, Q1 and Q2, H1's parser and HPACK, which are on
`main` now.

## 8. After phase one

These are the items from the first version of this note that the later phases
still owe. The cs note owns their order. Each keeps the justification it had:
a named part of cs that cannot be written without it.

| Item | For | Notes |
| --- | --- | --- |
| **N7.** `atan2`, `tan`, `hypot`, `sign`, `clz32` and `imul`; JavaScript's `-0` and NaN from `Math.round`, `min` and `max`; `f32ToBits` | the simulation, the bots, the renderer | Each zero or NaN change withdraws a documented deviation. The last bit of a transcendental stays platform noise ([wp33](wp33-round-trip.md) §3.1) |
| **N8.** Host imports on `wasm` | the client | Design note first. A `declare function` becomes a wasm import; opaque `i32` handles; `u8[]`, `f32[]` and `string` cross as a pointer and a length without a copy; `--emit-dts` types the `imports` object |
| **N9.** Programs that do not exit: host-driven state and reclaiming per-match memory | the client core (host-driven); the game server (per match) | Design note first. Weighs regions, `using m = region()`, a safe `Arena.reset`, and reference counting |
| **N10.** `sort`, `toFixed`, and JavaScript's `String(x)` for `f64`; `split` | shader text, option parsers | `std` only |
| **N11.** Typed JSON over a `std/json` tokenizer and writer | tokens, the match report, `/matches` | A1 needs a small hand-written case of this for the grant's payload, in phase one |
| **N12.** Non-blocking `spawn`, `kill` and `waitpid`; available parallelism and total memory | the master | runtime-os |
| **N13.** The client role of T1, against the web PKI | the account service: Postgres over TLS, HTTPS to Resend | Replaces the old plan's FFI route. S1 makes the C library unnecessary |
| **N14.** Discriminated unions | the protocol's message families | Optional. A class with an enum tag and nullable payloads works until then |

The in-place port of the TypeScript half rides [WP33](wp33-round-trip.md): the
`portability` class (its R1) maps the sites where a rewritten module's two
readings differ, and `--emit ts` (its R4) is the way back. The old N4, a
separate overlap flag, is withdrawn in its favour.

## 9. Not in the list, on purpose

- **`async` and `await`.** N5's loop is the server's answer, as wp24 argued; the
  browser's is N9's host-driven half.
- **Closures and inheritance.** A protocol state machine is a struct and a
  `switch`, and the stack is written that way throughout.
- **HTTP/2 WebTransport, 0-RTT and migration.** §3 says why each is out of
  phase one. None is refused, and each can come later on its own measurement.
- **A second implementation of anything the game computes.** The relay is
  first precisely because it computes nothing the game does.
