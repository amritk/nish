# The handshake family

One full TLS 1.3 handshake and one QUIC v1 handshake, client and server in
one process, each followed by one application record echoed back.
[`../README.md`](../README.md) gives the program contract, the input stream
and the `family.json` schema.

## Kernels and their inputs

| Kernel | Message | One iteration | Output folded |
| --- | --- | --- | --- |
| `tls13` | `size` bytes | A fresh client and server run a full TLS 1.3 handshake: TLS_AES_128_GCM_SHA256 over X25519, an ECDSA-P256 certificate, no resumption. The client then sends the message in one application record, and the server reads it and writes it back. | the negotiated suite (2 bytes), the negotiated group (2 bytes), then the echoed message |
| `quic` | `size` bytes | A fresh client and server connection run a QUIC v1 handshake to 1-RTT under the same suite, group and certificate. The client then sends the message on its first bidirectional stream with FIN, and the server reads it and writes it back on the same stream. | the same |

So every iteration folds `13 01 00 1d` followed by the echoed message. As in
every family, iteration `i` XORs `i` into the first four message bytes, so
the echo changes on every iteration and no optimiser can hoist the exchange
out of the loop. The checksum alone does not prove a handshake ran: the folded
bytes are known in advance, and Go and quinn fold the suite and group as
constants (below). What proves it is each program's own code, which fails with
exit 1 when a handshake or the echo does not complete. The unit is op/s: one
op is one handshake plus its echo.

The family runs at one size, 32 bytes, about the size of a small request. A
handshake's cost hardly depends on it. `validateSize` is 4, the smallest legal
size: the tweak writes four bytes, and every program refuses a size below 4
with exit 2.

Every side serves and checks the same certificate and key: the P-256 leaf in
[`tests/link/net_tls_common/server.ts`](../../../tests/link/net_tls_common/server.ts).
The leaf expired on 2026-01-02 and chains to no trust anchor, so no client
validates the chain. Every client does check the CertificateVerify signature
against the leaf's key. The server sends no session tickets, except Node's
(see below). No client ever resumes a session.

## The programs

| File | Twin | tls13 | quic |
| --- | --- | --- | --- |
| `main.ts` | Nish | The server is `TlsRecordServer` from `nish/net/tls/record-server`. The client is tests/link's (below). | The server is `QuicConnection` from `nish/net/quic`. The client is tests/link's. |
| `openssl.c` | OpenSSL 3 | Two `SSL`s over `BIO_new_bio_pair`, in memory. The contexts are built once; the `SSL`s are new each iteration. | — OpenSSL 3.0 has no QUIC server; that came in 3.5. |
| `go/` | Go | `crypto/tls` over `net.Pipe`. | quic-go v0.59.0 over a pair of in-memory `net.PacketConn`s, with one `Transport` each, made once. |
| `rust/` | rustls 0.23.46, ring provider | `ClientConnection` and `ServerConnection`, with the TLS bytes moved between them through buffers. | quinn-proto 0.11.19 (sans-I/O), with the datagrams handed from one `Endpoint` to the other. The endpoints are new each iteration. |
| `node.mjs` | `node:tls` | `tls.connect` and a server `TLSSocket` over `stream.duplexPair`. | — Node has no stable QUIC. |

Every QUIC column runs in memory, with no socket, so the family needs no
loopback. This is noted under the table.

### Nish's client comes from tests/link

`std/net` has the server side of both protocols and no client. The client is
therefore the one the tests in `tests/link` drive those servers with, and it is
imported, not copied. Those imports are:

- the hello and its extensions, from `net_tls_common/client`;
- the key schedule and Finished, from `net_tls_resume/client`;
- record protection, from `net_tls_record_common`;
- the QUIC client's packets and keys, from `net_quic_conn` and `net_quic_common`.

`main.ts` adds the ordering a benchmark needs, the CertificateVerify check
against the leaf parsed out of the server's Certificate, and the echo. Nothing
is copied, so no source comment names an origin.

Those tests use fixed randoms and fixed X25519 private keys: RFC 7748 §6.1's
Alice for the client, and Bob for the server. QUIC's connection IDs come from
fixed entropy too. Every Nish handshake still computes both public shares,
both shared secrets, the signature and its check. It skips the draw from the
RNG that every twin makes, and its handshakes are byte-identical from one
iteration to the next: nothing in `std/net` caches one today, but a cache
keyed on the hello would make this column time nothing, and the checksum would
not show it.

### Per-iteration setup and teardown

The twins keep the certificate and the key parsed across iterations. Nish's
server takes its configuration from tests/link's helpers (`tcpConfig`,
`qcDefaultConfig`), which decode the leaf's hex each time they are called, so `main.ts` decodes a
few hundred bytes of hex per handshake. That is microseconds against a Nish
handshake's 2 to 3 milliseconds.

Teardown differs too. Go's `quic` calls `CloseWithError`, which sends a
CONNECTION_CLOSE that the server's goroutine processes. Rust's `quic` closes
the connection but delivers nothing more. Nish's `quic` drops both sides. No
`tls13` column sends a close_notify.

### What each twin reads back

- **OpenSSL:** the suite from `SSL_CIPHER_get_protocol_id`, and the group from
  `SSL_get_negotiated_group`.
- **rustls:** the suite from `negotiated_cipher_suite()`, and the group from
  `negotiated_key_exchange_group()`.
- **Node:** the suite from `getCipher().standardName`, and the group from
  `getEphemeralKeyInfo().name`.
- **Nish:** both from the ServerHello its client parsed.
- **Go 1.24:** the suite comes from `ConnectionState`, but there is no group
  field. Go folds X25519 because both sides offer only that group, so any other
  would have failed the handshake.
- **quinn-proto:** exposes neither value. Rust's `quic` folds the provider's
  only suite and only group, as `configs` pins them, for the same reason.

Go's default would offer X25519MLKEM768 first, so both Go sides pin
`CurvePreferences` to X25519. Node's `ciphers` option pins the TLS 1.3 suite.

### Node sends tickets

`node:tls` has no way to set the TLS 1.3 ticket count. `SSL_OP_NO_TICKET`
only switches OpenSSL to stateful tickets. Node's server therefore sends
OpenSSL's default two tickets after each handshake, which no other twin does,
and its column carries that cost. Nothing resumes from them.

## The portable columns

| Column | How | Why |
| --- | --- | --- |
| OpenSSL portable | — | No mask makes a column that proves anything (below). |
| Go purego | `-tags purego` | Turns off the assembly in `crypto/aes`, `crypto/internal/fips140/nistec` (P-256), `crypto/sha256` and the field arithmetic. What is left is generic Go. It takes about 1.8x Go's time on `tls13` and about 1.6x on `quic`. |
| Rust soft | — | ring chooses its assembly at run time and has no feature or cfg that turns it off. |
| Node | — | `node:tls` is OpenSSL's libssl with its assembly, and Node has no switch that turns it off. |

**Why OpenSSL has no portable column.** OpenSSL 3.0's P-256 (`ecp_nistz256`)
and X25519 are x86-64 assembly that never consults `OPENSSL_ia32cap`. They
dominate a handshake. AES-GCM and SHA-256 do read it, but a handshake moves
only a few kilobytes through them.

On this family's reference machine, `tls13` at 300 iterations took these
times (the minimum of 7 runs each):

| `OPENSSL_ia32cap` | ms |
| --- | --- |
| unset | 189 |
| `~0x1200020200000000:~0x60000E0090128` (every bit the runner knows) | 203 |
| `0:0` | 198 |

That is a ratio of at most 1.07. `openssl speed ecdsap256` and `openssl speed
x25519` do not move under either mask.

A column within 10% of the default proves nothing, and the runner's OpenSSL
proof needs a ratio. So `openssl.portable` is a reason string, and the family
sets no `portableProof`.
