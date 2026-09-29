# WP34: Hosting cs — the network stack first

**Proposed. Lanes K1 and K4 of §5 have landed (§5a); nothing else here is
built.** This note covers the compiler's half of a
plan whose other half lives in the program being ported,
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

Every item follows the MASTER_PLAN §5 sizes: S is under a day of agent work, M
is one to two days, L is several. Each item also:

- ships with the construct checklist of [ARCHITECTURE.md](ARCHITECTURE.md);
- lands **in a release before anything above it may use it**. The Release PR
  stays a human's merge.

Items in the checker lane (N1) do not overlap each other.

### N1. Exported enums and type aliases (S–M, checker lane)

A protocol stack is enums crossing module boundaries: frame types, error codes,
stream states and settings identifiers. Today an enum or an alias cannot be
exported (LANGUAGE.md §Enums, §Type aliases).

**Acceptance.** An exported enum is used in a second module as a field type, a
parameter type, a `switch` discriminant and a `Map` key. An exported alias is
used the same way for a class, an array and a `T | null`. The rules that stay
keep their negative tests: no string enum, no `const enum`, no default export.

**State.** The enum half is done: an exported enum is imported and used as all
four (`tests/link/enum_export_uses`), and LANGUAGE.md §Enums has the rule. The
load order it needed — every module's enums and aliases declared, and its
imported enums bound, before any signature — covers aliases too, so what is
left of N1 is binding an exported alias and resolving its right-hand side in
the module that wrote it.

### N2. Byte plumbing (S–M, builtins lane)

A packet is parsed and forwarded through `u8[]`, and the language has no bulk
operation on one. N2 adds three:

- **`dst.set(src, offset)`**, with `TypedArray.prototype.set`'s meaning. It
  lowers to `memmove` when source and destination alias, and to `memcpy` when
  the checker proves they do not.
- **`fill`**.
- **`readFileBytesSync(path): u8[] | null`**, because a DER key is binary.

A window into a buffer is spelled `(buf, off, len)` by convention, not by a new
view type. A view would be a second array layout that every array path in the
emitter has to handle, which is a much larger change than the plumbing needs.

**Acceptance.** Each builtin is tested against Node on overlapping and
non-overlapping ranges. `set` is WP33 class A: identical in both readings.

### N3. A wall clock, entropy, file times and signals (S, runtime-os lane)

Each piece is required by something the relay does today:

- **`Date.now(): f64`.** A certificate's validity and a grant's expiry are wall
  time.
- **`crypto.getRandomValues(bytes: u8[])`**, backed by `getrandom`. It supplies
  handshake randoms, connection ids and stateless-reset tokens.
- **`statMtimeSync(path): f64`.** It is how the relay notices a renewed
  certificate.
- **A way to learn that `SIGTERM` or `SIGINT` arrived.** The loop has to be
  able to wake on it, so it is a file descriptor for N5's loop (`signalfd` on
  Linux), not a handler, which would need a function value.

`runtime-os.c` holds 1,190 of its 1,280 bytes (MASTER_PLAN §2). Measure these
four before deciding where they go. If they do not fit, the precedent is the
split that created `runtime-os.c`, not a higher ceiling.

### N5. Sockets and the loop a program owns (L, runtime lane)

[wp24](wp24-async.md) §2 found nothing in either runtime to wait for, and named
"a real server" as the trigger for revisiting. This is one. Its refusal of
`async` stands anyway. A server that owns its loop and blocks in `epoll` until
the next deadline or the next readable socket needs no colour in the language.
That loop is exactly what tokio runs underneath the relay today.

The primitives form a builtin module, `nish:net`, beside `nish:fs` and
`nish:io`, with a handle as an `i32` descriptor:

- **UDP.** `bind` (dual-stack IPv6), `sendTo`, and `recvFrom` into a caller's
  `u8[]` at an offset. `UDP_SEGMENT` on send and `UDP_GRO` on receive, with the
  segment size handed back. ECN bits are read and written, because QUIC's
  congestion controller can use them. `SO_REUSEPORT`.
- **TCP.** `listen`, `accept`, `read` and `write` at an offset, `shutdown` and
  `close`, all non-blocking.
- **The loop.** `epoll` create, add, modify and wait with a millisecond
  timeout, plus N3's signal descriptor.

These go in a new `runtime-net.c` with its own measured ceiling, following the
`runtime-os.c` precedent. `wasm` is out of scope, because a browser reaches the
network through the host.

**Acceptance.**

- A UDP echo and a TCP echo written in Nish, driven from Node in `tests/`.
- A two-socket loop that wakes on whichever socket is readable first.
- GSO and GRO observed from the Nish side: one `send` leaves as many
  datagrams, and one `recv` returns several, with the segment size.

### N6. Constant time (S–M, builtins lane)

Crypto code must not branch or index on a secret, and LLVM promises nothing
about that. A `select` it can see through may become a branch. N6 adds
`ctSelect(mask, a, b)` and `ctEq(a, b)` over `u32` and `u64`, lowered behind an
optimisation barrier. It also adds a test that compiles the primitives of §5 and
refuses a conditional branch or a secret-indexed load in their `.s` output:

- a disassembly check in CI, which is cheap;
- plus a dudect-style timing run on the MAC comparison and the field
  arithmetic, which is slow and so runs weekly.

Wide multiplication is not needed. §5's K4 and K5 are written in limbs whose
products fit in `i64` and `u64`.

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

| Lane | What | Proved by | Needs |
| --- | --- | --- | --- |
| **K1** | SHA-256, SHA-384, HMAC, HKDF, constant-time compare, base64url | FIPS 180-4 and RFC 4231, RFC 5869 vectors | N1 |
| **K2** | ChaCha20-Poly1305, and ChaCha20 as QUIC header protection | RFC 8439 §2 vectors; RFC 9001 A.5 | N1, N6 |
| **K3** | AES-128 and AES-256 with GCM, bitsliced so that it runs in constant time; AES-ECB as QUIC header protection | NIST SP 800-38D vectors, Wycheproof `aes_gcm` | N1, N6 |
| **K4** | X25519, with 25.5-bit limbs in `i64` | RFC 7748 §5.2 and the iterated vector, Wycheproof `x25519` | N6 |
| **K5** | P-256 ECDSA sign and verify, ported from fiat-crypto's 32-bit output (MIT/Apache/BSD; [licensing](../.claude/licensing.md) rules apply), with RFC 6979 nonces | RFC 6979 A.2.5, Wycheproof `ecdsa_secp256r1_sha256` | N6 |
| **K6** | DER, PEM and X.509: parse a key and a chain; mint the self-signed ECDSA P-256 certificate, at most fourteen days; its SHA-256 for `serverCertificateHashes` | `openssl x509 -text` reads what it mints; a golden DER; Chrome accepts the hash (A1's gate) | K1, K5, N3 |
| **T1** | TLS 1.3 **server** handshake, carrier-agnostic. The key schedule, and ClientHello through Finished, with ALPN, SNI, the QUIC transport-parameters extension and HelloRetryRequest. No 0-RTT and no client authentication | RFC 8448 §3's full trace reproduced byte for byte for the key schedule and every server message | K1–K5 |
| **T2** | TLS records over TCP | `openssl s_client`, `curl`, Chrome; a record-boundary fuzz | T1, N5 |
| **H1** | HTTP/1.1 server: an incremental parser, keep-alive, chunked bodies both ways, `Upgrade`; WebSocket framing (RFC 6455) | a corpus of split-at-every-byte requests, `curl`, and the Autobahn suite's server cases | N1, N2 |
| **H2** | HTTP/2: frames, HPACK with Huffman, the stream state machine, flow control, SETTINGS and GOAWAY, and extended CONNECT for WebSocket (RFC 8441) | RFC 7541 Appendix C for HPACK; `h2spec` for the rest; `curl --http2`, Chrome | N1, N2 |
| **Q1** | QUIC packets: varints, long and short headers, Initial secrets, header protection, packet-number recovery, Retry integrity tag | RFC 9001 Appendix A reproduced byte for byte (A.2 client Initial, A.3 server Initial, A.4 Retry, A.5 ChaCha20 short header) | K1–K3 |
| **Q2** | QUIC connections: the handshake over T1 at three levels, transport parameters, ACK generation, connection-id management, address validation and Retry, version negotiation, stateless reset, idle timeout, key update | the quic-interop-runner's server test cases (handshake, transfer, retry, chacha20, multiplexing, keyupdate) against at least two client implementations | Q1, T1, N5 |
| **Q3** | Loss detection, PTO and NewReno with pacing (RFC 9002) | the interop runner's lossy and congested cases; the relay's own RTT-to-ack trace under `tc netem` | Q2 |
| **Q4** | Streams (bidirectional and unidirectional, with flow control) and DATAGRAM frames (RFC 9221); send batching through GSO | the interop runner's transfer cases; a datagram round trip at the MTU edge | Q2 |
| **R1** | HTTP/3 and QPACK, with a static table and dynamic capacity 0 | RFC 9204 static-table encodings; the interop runner's `http3` case; `curl --http3` where available | Q4, H2's header model |
| **R2** | Extended CONNECT (RFC 9220), HTTP datagrams (RFC 9297) and **WebTransport over HTTP/3**: sessions, datagrams, unidirectional and bidirectional streams, and close. It is pinned to the draft Chrome negotiates today; that draft's SETTINGS and headers are recorded once from a `wtransport` 0.7 exchange and held as a golden | Chrome through Playwright; a `wtransport` (Rust) client against the Nish server, which is the cross-implementation test | R1, Q4 |
| **A1** | **The relay**: `frame` and `grant` with their existing fixtures, the session table and caps, the timeouts and stats, the hash file and certificate reload, one upstream socket per session, and GSO/GRO | the relay's `cargo test` cases ported with the same fixtures; cs's `boot-check` wire pass asserting WebTransport carried the match; `bench:offload` against the Rust relay; N9's soak | R2, K6, N3, N5 |

The first wave is eleven lanes, all runnable at once: N1, N2, N3, N5 and N6 in
the compiler, and K1–K6 in the stack. H1's parser, H2's HPACK, Q1 and R1's
QPACK tables can start in the same wave, because each is a pure function with
published answers. Only T2, the servers of H1 and H2, Q2 and its successors,
and A1 need a socket.

### 5a. Landed

| Lane | Pull requests | Modules | What is left |
| --- | --- | --- | --- |
| **K1** | #287 (the `std/` walker nested modules needed), #288, #291, #294, #298 | `nish/crypto/sha256`, `nish/crypto/sha512` (SHA-512 and SHA-384), `nish/crypto/hmac`, `nish/crypto/hkdf`, `nish/crypto/ct`, `nish/crypto/base64url` | Wycheproof's HMAC and HKDF vectors, a third-party file with its own notice. N6's disassembly check over every K1 module, and its weekly timing run over the MAC comparison |
| **K4** | #289 | `nish/crypto/x25519` | Wycheproof `x25519`, as for K1. N6's disassembly check over the field arithmetic and the ladder, and its weekly timing run |

Each module reproduces its specification's published vectors in a
`tests/link/crypto_*` program: FIPS 180-4 and the NIST examples, RFC 4231,
RFC 5869 Appendix A, RFC 4648 §10, and RFC 7748 §5.2 (the iterated vector to
1,000) and §6.1. Neither lane waited for its **Needs** column. The modules
export functions, classes and constants and no enum or alias, so N1 was not
needed, and they are written branch-free on secrets by masking, so N6 is what
will *verify* them rather than what they are written with. Until N6 lands that
property is the modules' discipline, stated in each header, and not a checked
fact. [`std/README.md`](../std/README.md#nishcrypto--the-primitives-under-tls-13)
lists what each module exports and the rules they share.

**One test suite belongs to no single lane:** a Nish server and a Nish client
over loopback, for every carrier. It is what catches two lanes that each pass
their own vectors but disagree with each other. It is written in wave 2, when
T2 and Q2 exist.

## 6. Decisions for the owner

| | Question | Recommendation |
| --- | --- | --- |
| **S1** | Crypto: pure Nish, or a verified C library through FFI | **Pure Nish, and it is also the shorter road.** Three facts make it affordable. First, ChaCha20-Poly1305 is add, rotate and xor, so it is constant time and fast in portable code; the server picks the cipher suite, and every browser offers it. Second, AES-128-GCM is required only for QUIC Initial packets, whose keys come from a connection id sent in the clear, and as TLS 1.3's mandatory fallback, where a bitsliced AES is correct though slow. Third, X25519 and P-256 fit in `i64` and `u64` limbs. The C route needs [wp27](wp27-ffi.md) S3 and S4, neither built, and hands the fixpoint callees it cannot see into. AES-NI and PCLMUL become builtins later, when a profile of the relay asks for them |
| **S2** | Where the stack lives | **Decided by the owner, 2026-09-28: the standard library.** It follows [wp26](wp26-stdlib.md)'s own line: a builtin exists for a syscall, and everything the language can express is a module. So N5's sockets are the builtin module `nish:net`, and everything above them is `nish/crypto/*` and `nish/net/*`. What it buys is the property wp26 §1a measured: a `std/` module is compiled into its importer, so the attribute fixpoint sees through it, and `--gc-sections` drops what the relay does not call. What it costs is cadence and suite. The stack ships in compiler releases, so a Release PR is worth cutting as each lane cs waits on lands. Its interop suites (the QUIC interop runner, `h2spec`, Chrome) run as a CI job of their own, beside `npm test` rather than inside it, and each module keeps wp26 §5's `tests/link/` case |
| **S3** | The relay alone first, or the fold into the game server first | **The relay alone**, as a drop-in binary with the same flags and the same hash file, chosen per deployment. It carries real players while the game server is still Bun. Folding the relay into the game server is phase two's cutover, once netcode is Nish |
| **S4** | Memory for phase one | **Pools sized from the caps** (N9 above). The memory-model note is phase two's, and nothing here waits for it |
| **S5** | The HTTP the stack serves beyond the relay | **All three versions, once the relay is live (wave 4).** The same process answers `/connect` and upgrades `/play` for the Bun game server as a reverse proxy. That puts H1 and H2 under real traffic in phase one, and makes Caddy optional for game traffic |

## 7. Waves

| Wave | Compiler and runtime | The stack, in `std/` | cs |
| --- | --- | --- | --- |
| 0 | N1, N2, N3, N5, N6 | K1–K6; H1 parser, HPACK, Q1, QPACK tables | S1, S3–S5 answered; C15 and C16 (cs note) |
| 1 | a release carrying N1–N6, and K1–K6 as they land | T1, T2, H1 server, H2, Q2 | — |
| 2 | — | Q3, Q4, R1; the loopback suite | — |
| 3 | a release carrying R2 | R2 | A1, the relay in Nish; then **the Nish relay in staging behind a flag**, with `boot-check`'s wire pass and `bench:offload` against Rust |
| 4 | — | S5's reverse proxy | the Rust relay retired |

The first release worth cutting is the one carrying N1–N6: the stack's lanes
past the pure ones wait on it. Because the stack is `std/`, cs can use each
lane only once a release carries it, so a release is worth cutting whenever a
lane A1 depends on has landed.

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
