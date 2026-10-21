# WP39: The HTTP server — a TechEmpower entry, then a general-purpose server

**Status: Part A in progress.** E1, E3, E4 and E5 are built. E1 is
`tcpListenFlags`, `SO_REUSEPORT` on a TCP listener (#733). E3 is `JsonWriter`
in `std/json.ts`. E4 is `httpDateWrite` in `std/net/http-fields.ts` and
`HttpDate` in `std/net/http1-server.ts`. E5 is `bench/techempower/`, pinned by
`tests/link/tfb_entry`, with its numbers in
[BENCHMARKS.md](BENCHMARKS.md#techempower-json-and-plaintext). E2
(`TCP_NODELAY`) is flags 2 and 3 of `tcpListenFlags` (#770). E6 to E9 and Part B are not started. The
anchors below are at `ce9d394`; §1 says where each row stands now.

[WP34](wp34-hosting-cs.md) built a network stack for one program: cs's relay.
That stack serves HTTP/1.1 with WebSocket, HTTP/2, HTTP/3 and WebTransport, and
S2's interop job (`.github/workflows/interop.yml`) runs it against real
clients:

- the quic-interop-runner, with quic-go and ngtcp2;
- `h2spec`, 146 of 146;
- `curl --http2` and `curl --http3-only`;
- Chromium over WebTransport.

What that stack lacks is the rest of what a server needs when its program is
not the relay. This note collects every such item in one place and orders it.

The order comes from one goal: an entry in the TechEmpower Framework
Benchmarks (TFB). TFB is a public, like-for-like measurement, and this
project's claims are measured. It tests cleartext HTTP/1.1 only. So Part A is
TFB's six test types, and Part B is everything else a general-purpose server
needs, across all three versions.

[LANGUAGE.md](LANGUAGE.md) stays normative. A stage that changes the language
lands its rule there in the same pull request. Each stage that adds code to
`std/net` adds or updates its area's record under
[`docs/security/`](security/README.md). WP34 §8's items N10 to N13 keep their
names here, and this note says which of them each stage takes.

## 1. Where the stack stands, for a server that is not the relay

| | Today | Proof |
| --- | --- | --- |
| Cores | **One per process.** `nish:net` is refused inside a `scope()` task or a parallel body (`reject_net_task`). `tcpListenFlags` flag 1 sets `SO_REUSEPORT` (E1, #733), so N processes can share a TCP port, but nothing in Nish starts them yet | [#478](https://github.com/amritk/nish/issues/478), `tests/link/net_tcp_reuseport_spread` |
| HTTP/1.1 | Keep-alive, chunked bodies both ways and pipelining. A burst of pipelined responses leaves in one write (`Http1Server.next`, `flush`). A warmed slot allocates nothing per request, and a slot's connection is built on the first accept into it | `tests/link/net_loopback`, `tests/link/net_http1_server`; no third-party client yet |
| HTTP/2 | Over TLS with ALPN `h2` only (`std/net/http2-tls.ts`); no cleartext h2c | `h2spec`, `curl --http2` |
| HTTP/3 and WebTransport | `Http3Server` behind a `QuicListener`; WebTransport pinned to the draft Chrome negotiates | the runner's `http3` case, `curl --http3-only`, Chromium |
| One handler for all three versions | **None.** Each carrier has its own event API, so a program that serves all three versions answers each one separately. `tests/link/net_interop_server` does exactly that (`app.ts`, `h2.ts`, `server.ts`) | — |
| JSON | A reader (`jsonField`) and a writer into a caller-owned `u8[]` (`JsonWriter`, E3), both in `std/json.ts` | `tests/link/std_json`, `tests/link/std_json_writer` |
| TechEmpower `json` and `plaintext` | `bench/techempower/` (E5): one core, one `pollWait` loop on `Http1Server`, with `Server` and a cached `Date` (`HttpDate`, E4) | `tests/link/tfb_entry`; [BENCHMARKS.md](BENCHMARKS.md#techempower-json-and-plaintext) |
| Databases | **None.** No Postgres client; the TLS client role (N13) is unbuilt | — |
| Crypto speed | ChaCha20-Poly1305 is portable and fast. AES-GCM is bitsliced (K3) and slow, yet it is what Chrome and curl list first on AES-capable machines, and the server takes the client's first suite (`chooseSuite`, `std/net/tls.ts`). No session tickets, so every connection pays a full handshake | WP34 K3, S1 |

## 2. Part A: the TechEmpower entry

TFB's test types, and what each one needs on top of the stack:

| Test | What it asks | Stages |
| --- | --- | --- |
| `json` | `{"message":"Hello, World!"}`, serialized on every request | E1–E5 |
| `plaintext` | `Hello, World!`, with 16 requests pipelined per connection | E1, E2, E4, E5 |
| `db` | one random row of `World` | E6, E7 |
| `query` | 1 to 500 random rows of `World`, the count clamped | E6, E7 |
| `update` | the same rows, each given a new `randomNumber` and written back | E6, E7 |
| `cached-query` | rows served from an in-process cache | E7 |
| `fortune` | every `Fortune` row plus one added at request time, sorted by message, rendered as escaped HTML; one row is Japanese UTF-8 | E6, E8 |

Every response carries `Server` and `Date` headers. The rules (the requirements
page of TechEmpower/FrameworkBenchmarks) forbid caching a response, and in
`json` the serialization, between requests.

### E1. More than one core: `SO_REUSEPORT` on TCP (S, runtime-net lane)

This is #478's first half. Give `tcpListen` a flag (or add a sibling that
takes one) for `SO_REUSEPORT`, as `udpBind` already has. TFB's container can
then start one process per core from a shell launcher. That is a pre-fork
model; TFB accepts it, and many entries use it.

#478's second half is WP34 N12: non-blocking `spawn`, `kill` and `waitpid`,
the available parallelism, and the total memory, so that the supervisor can
be written in Nish. It is wanted for the relay and cs's master too. TFB does
not wait for it.

**Acceptance.** #478's own: a `tests/link/` case with two listeners on one
port, and a load test that shows connections spread across processes.

### E2. `TCP_NODELAY` (S, runtime-net lane)

Nothing sets it today. Set it on every accepted socket, or take it as a flag,
whichever the measurement favours. Most TFB entries set it.

**Acceptance.** A measured `plaintext` and `json` run with and without it,
against the noise band.

### E3. A JSON writer in `std/json` (S–M, std lane; WP34 N11's first half)

`JsonWriter` writes into a caller-owned `u8[]` and allocates nothing per
call. It escapes exactly as `JSON.stringify` does; `src/strings.ts`'s
`addJsonQuoted` is the rule, re-implemented, because `std/` cannot import
from `src/`. An `f64` prints as `String(x)` does, and NaN and ±Infinity print
as `null`. Misuse — a value where a key is due, unbalanced nesting, a full
buffer — answers a defined error, never a panic. A thin `string` convenience
sits on top. N11's tokenizer and typed (de)serialization stay open.

### E4. An HTTP date (S, std lane)

`Date` takes the IMF-fixdate of RFC 9110 §5.6.7. `Date.now()` exists (WP34
N3). The formatter writes into a `u8[]`, plus a cache the loop refreshes at
most once a second, which is the shape every TFB entry uses. It lives beside
the header model in `std/net/http-fields.ts`, or in a module of its own.

### E5. The entry: `json` and `plaintext` (M)

The entry is a program, not a `std/` module: one `pollWait` loop on
`Http1Server`, and a pass scope (`using a = arena()`) around each pass so
that `Arena.used()` stays flat. It ships with:

- the TFB `Dockerfile` and `benchmark_config.json`;
- a local harness that runs `wrk`, with the pipelined `plaintext` script,
  against the container;
- the verifier's header and body checks as a `tests/link/` case, so a
  regression fails `npm test` rather than the TFB run.

**Acceptance.** The verifier's rules pass locally. Requests per second at TFB's
concurrency levels go into [BENCHMARKS.md](BENCHMARKS.md) beside a reference
entry measured on the same machine in the same interleaved rounds, with the
noise band, as CLAUDE.md's `Measured:` rules require.

**Built.** `bench/techempower/` holds the program (`main.ts`, `server.ts`),
`nish.dockerfile`, `benchmark-config.json` (upstream's `benchmark_config.json`)
and `run.sh`, unsubmitted (D1).
There is no pass arena: NL2424 refuses `using a = arena()` around a serve,
because `Http1Server` stores into the slot's parser and output, which outlive
the pass. None is needed either, since a warmed pass allocates nothing, and
`tests/link/tfb_entry` pins every server call over 200 requests to leave
`Arena.used()` where it was instead. The
reference entries are the HTTP twins (`bench/http-twins/`). The nodelay
comparison waits for E2.

**Follow-up.** Multi-core: one entry process per core on one `SO_REUSEPORT`
port, through #719's prefork supervisor (`std/net/prefork.ts`) once it lands.

### E6. A Postgres client (L, std lane)

`std/net/postgres` is sans-IO, like every other `nish/net` module: it takes
bytes and answers bytes. A carrier puts it on a socket from `tcpConnect`
(WP34 N5), inside the program's own loop, so a query never blocks the HTTP
side. It covers:

- the v3 startup message and the authentication TFB's Postgres image asks
  for: MD5 or SCRAM-SHA-256, depending on how that image is configured,
  which this stage checks first. SCRAM needs PBKDF2 on `hmacSha256Secret`.
  MD5 needs a new `nish/crypto/md5`, which, like `sha1`, is not for
  security, and its header says so;
- the extended query protocol, with prepared statements and binary or text
  results for `int4` and `text`;
- pipelining several queries before one Sync, which is what the strongest
  `query` and `update` entries do;
- a pool of connections sized at start-up (N9's discipline);
- refusing a malformed or oversized message with a defined error.

Postgres over TLS needs N13, the client role of T1. TFB's database sits on a
private network in cleartext, so this stage does not wait for N13.

**Acceptance.**
- Exchanges recorded from a real server and replayed byte for byte in
  `npm test`, as the QUIC lanes replay aioquic.
- A CI job against a Postgres service container.
- A new record, `docs/security/postgres.md`.

### E7. `db`, `query`, `update` and `cached-query` (M)

These stages are on E6. Random ids come from `Math.random`. The cache is a
`Map` filled at start-up. `update` follows TFB's rules for batching the
writes.

### E8. `fortune` (S–M)

It needs an HTML escape (the five characters TFB checks), a sort on bytes
(WP34 N10's `sort`, or a local one if N10 has not landed), and UTF-8 passed
through untouched. String comparison here is already by bytes, which is what
the test expects.

### E9. Submitting upstream

A pull request to TechEmpower/FrameworkBenchmarks is outward-facing and stays
the owner's decision (§4, D1). Until then the entry is run and measured from
this repository.

## 3. Part B: a general-purpose server, every version

None of these blocks Part A. Each one names the open finding or lane cell it
closes.

| Stage | What | Closes | Size |
| --- | --- | --- | --- |
| **G1** | Third-party interop where it is still missing: `curl` and the Autobahn suite's server cases for HTTP/1.1 and WebSocket, and Chrome over TLS on TCP for HTTP/1.1 and HTTP/2, all added to S2's job | WP34 H1 and T2 "Left"; H2's "Chrome open" | S–M |
| **G2** | Server hardening: a deadline for a whole request head ([H1-1](security/http1.md)); a lingering close after a refusal (H1-2); HPACK's allocation per header block ([H2-1](security/http2.md)); a SETTINGS timeout and an idle timeout for HTTP/2 (H2-3); an idle timeout in the TLS carrier ([TLS-4](security/tls.md)); a session clock and a rate cap for WebTransport ([WT-2](security/webtransport.md)) | those findings | M |
| **G3** | TLS resumption: NewSessionTicket and PSK resumption, without 0-RTT; `secp256r1` as a key-share group beside x25519; `record_size_limit` | WP34 T1 and T2 "Left" | M–L |
| **G4** | Crypto speed, each part gated on its own measurement: AES-GCM and AES header protection as a runtime kernel on AES-NI with PCLMULQDQ, and on AArch64's AESE with PMULL, falling back to the bitsliced Nish (a new [WP38](wp38-simd.md) stage, on S1's route through `src/kernels.ts`, under WP38 §6's constant-time rules); a faster P-256, with 64-bit limbs or a fixed-base table | WP34 K3 and K5 "Left" | M each |
| **G5** | QUIC: the runner's congestion cases; a congestion controller beyond NewReno (CUBIC, or BBR), if a measurement asks for one; ECN; the AEAD limits ([QUIC-6](security/quic.md)); detecting an optimistic ACK (QUIC-7); path MTU discovery (RFC 8899), since packets stay at 1,200 bytes today; following a peer's address change, which A1 records as its NAT-rebinding gap | WP34 Q3, Q4 and A1 "Left" | L |
| **G6** | QUIC on more than one core: E1's pre-fork shares a UDP port today, but the kernel picks a process from the peer's address, so a rebinding peer lands on another process. The process to route to is carried in the connection ID, and the packet is steered either by a `SO_ATTACH_REUSEPORT_EBPF` program or by forwarding between processes. Design note first | — | M–L |
| **G7** | One handler for all three versions: a façade over `Http1Server`, `Http2TlsServer` and `Http3Server`, so that a program answers a request once whatever version carried it. It advertises `Alt-Svc` for HTTP/3 from the HTTP/1.1 and HTTP/2 responses, and adds cleartext HTTP/2 with prior knowledge (h2c), which is what `h2load` and a proxy's upstream speak. The façade must keep "nothing allocates per request". Design note first | — | M–L |
| **G8** | HTTP/2 and HTTP/3 benchmarks: an `h2load` harness in `bench/`, numbers in [BENCHMARKS.md](BENCHMARKS.md). It runs after E1 and G4, or it measures one core and software AES | — | S–M |
| **G9** | WebTransport's draft: when Chrome moves past the draft `std/net/webtransport.ts` is pinned to, re-record the exchange and move the pin | [webtransport.md](security/webtransport.md), "The draft" | continuous |
| **G10** | The client role of TLS against the web PKI (WP34 N13), for Postgres over TLS and for outbound HTTPS | WP34 §8 | L |

## 4. Decisions for the owner

| | Question | Recommendation |
| --- | --- | --- |
| **D1** | Submit an entry to TechEmpower/FrameworkBenchmarks, and when | **After E5 and E8**, once `json`, `plaintext` and `fortune` pass the verifier and have numbers here. A submission is outward-facing and a public number, so it is the owner's call each time |
| **D2** | Where the entry lives | **`bench/techempower/` in this repository**, beside the other benchmarks, with E5's verifier checks in `npm test`, and copied into the upstream layout at submission time |
| **D3** | Pre-fork from a shell launcher for TFB, or wait for N12's supervisor | **The launcher.** It needs E1 alone. N12 is for the relay and the master, and lands on its own schedule |
| **D4** | Where the Postgres client lives | **`std/net/postgres`**, beside the other protocol modules, under WP34's decision S2: the protocols live in the standard library |

## 5. Order

1. E1, E2, E3 and E4 in parallel. Each is small and independent.
2. E5: the first numbers.
3. E6, then E7 and E8.
4. Part B in any order. G4 and G1 are the most valuable first, because every
   HTTPS and HTTP/3 figure measures software AES until G4 lands, and G1 is
   the proof a general server is owed.

## 6. Not in the list, on purpose

- **`async`/`await`.** It stays refused ([wp24](wp24-async.md)). The loop a
  program owns is the server's answer, as WP34 N5 argued.
- **A socket handed to a `scope()` task.** It needs an ownership rule for
  descriptors, and pre-fork (E1) gives the cores without one. #478 records
  it as worth a design note if it is ever wanted.
- **io_uring, `sendfile` and kernel TLS.** Each is a runtime change that
  makes sense only after a profile shows the syscalls or the copy on top.
  None is ruled out.
- **0-RTT, connection migration beyond G5's rebinding, HTTP/2 server push,
  and WebTransport over HTTP/2.** WP34 §3 gave the reason for each, and each
  can come later on its own measurement.
