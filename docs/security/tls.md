# Security record: TLS 1.3 — the server handshake, its records and its TCP carrier

The record of `nish/net/tls`, WP34's lane T1, and of the record layer and the
TCP carrier lane T2 put around it (`nish/net/tls/record`,
`nish/net/tls/record-server`, `nish/net/tls-tcp`): what each refuses, what it
keeps secret and how, which secrets it leaves in memory, and the test that
pins each property. It is written with the code rather than after an audit,
so that the audit of the protocol stack starts from evidence.

**Result.** Every refusal is an alert and none is a panic; the client's
Finished and the ECDHE secret are compared in constant time; RFC 8448 §3 is
reproduced byte for byte. The ECDHE secret and the copy of the ephemeral key
it is computed with are `Secret`s, wiped on every path. One Low finding is
open, as CLAUDE.md §Security requires: the secrets the handshake keeps in
`TlsServer`'s fields and hands its carrier are not wiped yet. The primitive
that will wipe them, `secureZero` (#417), is on `main`; `std/` may call it once
a release ships it.

**T2's result.** Every record the trace prints is reproduced byte for byte,
and every refusal of the record layer is an alert, never a panic. Records are
authenticated before a byte of them is used, the inner content type is found
without branching on the padding, and the record counter cannot wrap. A
connection past its handshake allocates nothing that outlives a record, and
neither does a KeyUpdate; a per-connection cap bounds how many a client may
ask for. On the carrier's path `TlsServer`'s traffic secrets, its handshake
secret and the caller's ephemeral key are wiped once the record layer has
what it needs from them, which narrows TLS-1 for TLS over TCP. T2 left two
findings open: TLS-2 (Low), the AES key schedule zeroed by ordinary stores;
and TLS-4 (Low), no timeout in the carrier. TLS-3, the memory each handshake
left, is closed. Open now are TLS-1, TLS-2 and TLS-4; TLS-5 is closed (below).

**N9's result.** A handshake keeps its state in its slot: `TlsServer`'s
buffers, transcript, secrets and HKDF scratch are made once and `restart`ed
for each connection, and its steps run in `using a = arena()` blocks over
HMAC and HKDF with caller-owned scratch. A thousand ChaCha20-Poly1305
handshakes through one slot, or accepted and closed over loopback through
`TlsTcpServer`, leave `Arena.mark()` where the first left it, and so do a
thousand RFC 8448 AES-128-GCM handshakes and a thousand AES-256-GCM ones over
loopback, the AES key schedule expanded in place by `aesKeyInto`: every
handshake after the first leaves 0 bytes, where RFC 8448's left 52,808
(`net_tls_memory`).

**TLS-5** (Low) was found in review of the resumption design: every
ChaCha20-Poly1305 seal and open left a copy of its key in ChaCha20 state that
nothing wiped. #639 closed it.

**Resumption** is designed but not built: "Resumption" below records the
threat model, the ticket-key and anti-replay decisions and the fallback and
abort table that the stages building it are tested against.

## Scope

| File | Functions |
| --- | --- |
| `std/net/tls.ts` | `TlsServer` (`restart`, `receive`, `reserveInput`, `reserveOutput`, `handleMessage`, `handleClientHello`, `chooseSuite`, `chooseAlpn`, `takeServerName`, `exchangeKeys`, `writeServerFlight`, `signatureInput`, `sign`, `handleFinished`, `sent`, `takeOutput`, `clearOutput`, `readSecret`, `writeSecret`), `tlsExchange` and its `TlsExchangeWords`, `tlsSignEcdsaP256`, `tlsEcdsaDerSignature`, `TlsP256Signer` (`sign`), and the in-place DER writers both encoders share (`tlsEcdsaDerLength`, `tlsEcdsaDerInto`, `tlsDerIntegerLength`, `tlsDerIntegerInto`) |
| `std/net/tls/codec.ts` | `tlsReadClientHello` into a `TlsClientHelloView` and its readers (`tlsRead*`, `tlsReadServerName`, `tlsReadKeyShare`, `tlsReadAlpn`, `tlsReadExtension`, `tlsMarkSeen`), `tlsParseClientHello`, the six `tlsWrite*` writers with their `tlsEncode*` wrappers, and `tlsWriteCertificateVerifyContent` / `tlsCertificateVerifyContent` |
| `std/net/tls/schedule.ts` | the key schedule (`tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExpandLabel`, `tlsExtract`, `tlsFinishedVerifyData`, `tlsTrafficKey`, `tlsTrafficIv`), its in-place forms (`tlsDeriveSecretInto`, `tlsMasterSecretInto`, `tlsFinishedVerifyDataInto`, `tlsTrafficKeysInto`) and `TlsTranscript` |
| `std/net/tls/record.ts` (T2) | `tlsRecordLength`, `TlsRecordReader`, `TlsRecordProtection` (`install`, `reserve`, `derive`, `clear`, `nonceInto`, `seal`, `open`), `tlsNextTrafficSecret` |
| `std/net/tls/record-server.ts` (T2) | `TlsRecordServer`: `receive`, `process`, `handleRecord`, `handleChangeCipherSpec`, `handleHandshake`, `handleApplicationRecord`, `handleAlert`, `handlePostHandshake`, `updateReadKeys`, `advance`, `pump`, `sendKeyUpdate`, `keyUpdate`, `read`, `write`, `close`, `sign`, `end`, `abort`, `wipeKeys` |
| `std/net/tls-tcp.ts` (T2) | `TlsTcpServer`: `accept`, `readable`, `writable`, `flush`, `read`, `write`, `sign`, `signP256`, `keyUpdate`, `close` |

Out of scope: the primitives underneath (`nish/crypto/*`, each with its own
record in this directory, the HMAC and HKDF scratch the schedule runs in
among them), `nish:net` itself (the C runtime's record), and
QUIC (Q2). The signature over CertificateVerify is the caller's: the server
hands the input out and writes back what it is given.

## Threat model

The attacker is the client, or anyone on the path before the handshake keys
exist: every byte handed to `receive` is theirs, split anywhere and sent at
any level. A win is a panic, an unbounded allocation, a handshake completed
without the server's key or with a secret the attacker can compute, a
negotiation the server did not agree to (a version, suite, group or protocol
outside its configuration), or a secret learned from timing. The caller — the
configuration, the randomness and the signature — is trusted, but its
mistakes still answer an alert rather than a panic.

Under T2 the attacker also holds the network: every record, before and after
the keys exist, is theirs to forge, cut, replay, reorder, pad or truncate, and
the TCP stream may end or reset at any byte. A win adds plaintext accepted
without authentication, a record read under the wrong key or sequence number,
memory or time a peer can make the server spend without bound, and a key or
plaintext left readable after the connection is done with it. The program
driving the carrier is trusted, as the caller of `TlsServer` is.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| TLS-1 | Low | `std/net/tls.ts` (`TlsServer`: the constructor's `ephemeralPrivate`, `handleClientHello`, `sign`, `handleFinished`, `fail`), `std/net/tls/schedule.ts` (`tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExpandLabel`, `tlsExtract`, `tlsFinishedVerifyData`, `tlsTrafficKey`, `tlsTrafficIv`) | Secret material is not wiped once the handshake is done with it. `TlsServer` holds the caller's ephemeral x25519 key as plain bytes, because a `Secret` may not be a field (NL2430); it keeps the handshake secret, both handshake traffic secrets, both application traffic secrets, the exporter secret and the expected client `verify_data`, which its carrier reads, and, once the client's Finished is accepted, the resumption master secret (RFC 8446 §7.1), which nothing reads yet since NewSessionTicket, PSK and 0-RTT are out of scope; and the schedule's functions answer the early and master secrets, the "derived" salts, both `finished_key`s and every traffic key and IV as plain `u8[]`. All of them stay in arena memory until that memory is reused, and a later memory disclosure could read them. `sign` derives the resumption master secret beside the application secrets, under the same master secret it then wipes, over the transcript through the one client Finished it will accept (RFC 8446 §4.6.1), so the master secret is never held past `sign` and the carriers' wipe of the handshake secret before that Finished arrives cannot touch it; `handleFinished` points `resumptionSecret` at it only once the Finished verifies, and `fail` wipes it with `secureZero` when the handshake fails instead. `handleFinished` wipes the handshake secret with `secureZero` and drops the server's reference to it. **What is wiped:** the copy of the ephemeral key the exchange runs on, and the ECDHE secret, are `Secret<u8[]>`s (`nish:secret`, #418) that `tlsExchange` wipes on every path, and the all-zero check and the handshake secret's extract run on the ECDHE secret only inside `expose`. The P-256 key `tlsSignEcdsaP256` signs with is the caller's `Secret`, borrowed, and `p256` wipes what it derives from it (ECC-2). **What N9 adds:** `tlsExchange` takes the ephemeral key and gives back the handshake secret as words in a `TlsExchangeWords` (an object of numbers, so that it gets an arena scope of its own, TLS-3); each word is zeroed by an ordinary store as soon as it is read, which stands because the words stay reachable from their `TlsServer`, and the handshake secret's bytes are wiped with `secureZero` once they are words. The in-place schedule wipes what it makes on the way — the master secret, the "derived" salt, both `finished_key`s — with `secureZero`, and its HKDF scratch after every step; and `restart` wipes every secret array a slot's last connection left before the next one is handed them (`net_tls_memory`: a `TlsServer` taken through RFC 8448's handshake alone, then restarted, has every array of `secrets256` zero, and one taken through an AES-256-GCM-SHA384 ClientHello and its signature holds its secrets in `secrets384` and, once restarted, has every array of it zero). | **Open.** The primitive exists on `main`: `secureZero` (#417), a store no optimiser removes, for bytes that are not a `Secret`. Under the rolling freeze `std/` may call it once a release ships it; then `TlsServer` wipes its fields when the handshake ends or fails, the schedule's callers wipe what they are handed, and a test pins that the wipes survive `-O2`. **Narrowed by T2 for TLS over TCP:** `TlsRecordServer` calls `secureZero` on `TlsServer`'s caller-supplied ephemeral key once the ServerHello is written, or when the handshake fails or the slot is closed, on the handshake secret and the client's handshake secret once the flight is signed, on the server's handshake and application secrets once its write keys are installed, and on the client's application secret once its read keys are; when the connection fails or its slot is closed it wipes everything `TlsServer` still holds, the exporter secret and the expected client `verify_data` included. It keeps its own copies of the two application secrets for KeyUpdate, overwritten in place by each update and wiped when the slot is closed or reused. What stays is the exporter secret while the connection is open, for the caller; the resumption master secret, which `TlsRecordServer`'s wipes do not cover, so it stays in the slot's array after the connection closes until `restart` wipes it for the slot's next connection (for good, in a slot that is never reused; QUIC keeps one `TlsServer` per slot and `restart`s it the same way, so the same holds there); and the schedule's intermediate answers (`net_tls_record_rfc8448` and `net_tls_record_refusals` check the wipes). Follow-up: #430, which moves the TLS and QUIC key-holding structs onto `nish:secret`. |
| TLS-2 | Low | `std/net/tls/record.ts` (`TlsRecordProtection`: `clear`, `derive`) | A direction's key, IV and AES key schedule live in its fields, since a `Secret` may not be one (NL2430). The key and IV are wiped with `secureZero` when the direction is installed again, cleared, or its slot closed (`TlsRecordServer.wipeKeys`); the schedule is `u64` words, which `secureZero` does not take, and is zeroed with ordinary stores, which stand because the schedule stays reachable for the next key. `derive` writes the key and IV straight into those fields, in the direction's own HKDF scratch, which wipes its last output block and both keyed HMAC hashers before each derivation returns (the pad blocks and digests on the way with `secureZero`, the hash words with stores that stand because the scratch stays reachable), and whatever else the derivation allocated is released by its arena block — unwiped, since a release frees without zeroing, but none of it key material once the scratch is wiped. The AES schedule is expanded by `aesKeyInto` straight into the direction's own `AesKey`; what remains is `aesKeyInto`'s working copy of it, zeroed with stores the optimiser may drop since nothing reads them again, and released by `derive`'s arena block: it is derived from the traffic secret, so a later memory disclosure could read key material from it until that memory is reused. `seal` and `open` copy the record's plaintext into arrays their scope releases, also unwiped: application data, not keys. The per-record nonce — the IV XOR a public sequence number, so as good as the IV — is wiped with `secureZero` in both, on every path after it is built. | **Open.** Follow-up: #430, which moves the TLS and QUIC key-holding structs (these keys, held in a struct across calls, among them) onto `nish:secret`. `secureZero` for a `u64[]`, or an AES key held as bytes, would close the schedule and its working copy. HKDF and HMAC now wipe their own state when run over a scratch, which closes the derivation's other temporaries. |
| TLS-3 | Medium | `std/net/tls.ts` (`TlsServer`), `std/net/tls/record.ts` (`TlsRecordProtection.derive`), `std/net/tls/record-server.ts` (`advance`, `pump`, `handlePostHandshake`, `sendKeyUpdate`), `std/net/tls-tcp.ts` (`accept`) | **What it was.** Each handshake left arena memory behind until the program reset the arena: `TlsServer` kept its messages, transcript and secrets in objects of its own, made per connection, and nothing it allocated along the way could be released, since HMAC, HKDF and `aesKey` stored allocations of their own and so no arena scope and no `using a = arena()` block was allowed around them (NL2424). Measured over RFC 8448's AES-128-GCM handshake through `TlsRecordServer`, **52,808 bytes per handshake** (about 53 MB of RSS after a thousand); a key install left another 5,248, 10,496 for an answered KeyUpdate. A client opening connections in a loop grew a long-running server without bound — denial of service on attacker input. | **Closed** (N9's TLS memory stage). `TlsServer` allocates its buffers, transcript hashers, secret arrays (one of each hash's length per secret), HKDF scratch and ClientHello view once, and `restart` hands them to the slot's next connection; `TlsTcpServer` keeps one per slot. `receive` and `sign` run in `using a = arena()` blocks over `nish/crypto/hmac`'s `HmacSha256Scratch` / `HmacSha384Scratch` and `nish/crypto/hkdf`'s `HkdfScratch`, which compute in place; the record layer derives its keys in place and expands the AES schedule into the slot's own `AesKey` with `nish/crypto/aes`'s `aesKeyInto`, in an arena block too; the x25519 exchange, whose `x25519` answers a `Secret` it allocates, runs in `tlsExchange`, which takes only an object of numbers and so gets an arena scope of its own; the ClientHello is read as windows into the input, and every message is written into the output buffers in place, which `TlsRecordServer` seals from directly. Measured (`net_tls_memory`, `net_tls_record_refusals`): after the first handshake in a slot, **0 bytes per handshake** under AES-128-GCM (RFC 8448's, 1,000 handshakes, was 52,808), ChaCha20-Poly1305 (1,000 through one slot) and AES-256-GCM-SHA384 (1,000 accepted, handshaken and closed over loopback through `TlsTcpServer`), `Arena.mark()` exactly where the first left it each time; and **0 bytes per answered KeyUpdate** (was 10,496). Three allocations remain outside the blocks, none of them per handshake in a steady state: the input buffer doubles, once per slot, up to the largest message for a ClientHello longer than 2 KB; the `serverName` string is made when a client names a host other than the last one the slot saw — so clients that alternate between names make one each handshake, as long as the name, at most 64 KiB and in practice a DNS name's 253 bytes; and over QUIC the array the client's transport parameters are copied into, which `TlsServer` keeps and refills, grows when a client's are longer than any before it (N9's QUIC stage; a QUIC connection through a reused slot keeps 0 bytes, QUIC-3). A signature made with `tlsSignEcdsaP256` leaves `p256SignSha256`'s own allocations, which stores what it makes: measured over the carrier, 9,312 bytes a connection, the whole of the 9,376 a TLS connection over `TlsTcpServer` kept accept to close (#489). `TlsTcpServer.signP256` now signs in the pool's `TlsP256Signer`, which signs with `p256SignSha256Into` in a `P256SignScratch` made once and writes the DER into one of its own arrays, one per DER length from 8 to 72 bytes (`TlsServer.sign` takes the length from the array and stores what it computes, so the signature cannot be a temporary): **0 bytes a signature** (`net_tls_memory`: 1,000 connections accepted, signed by `signP256` and closed over loopback with `Arena.mark()` where the first left it, which fails on `tlsSignEcdsaP256`; and 300 `TlsP256Signer.sign` calls over three DER lengths, each `tlsSignEcdsaP256`'s bytes and none moving the mark). Over the carrier, `net_loopback`'s TLS and HTTP/1.1 connections keep 64 bytes each from accept to close, where they kept 9,376, in each of 20 runs: the 64 is the test program's own `Secret` copy of its key. `tlsSignEcdsaP256` stays, and keeps what it kept, for a caller that signs once. **What the slot costs instead.** The state a handshake used to allocate per connection is now allocated once per slot. Measured with `Arena.used()` on a fresh chunk, a `TlsServer` is 31,192 bytes (`Arena.used()` around the constructor) where it was 1,728 (most of it the ClientHello view's two 8 KiB duplicate bitmaps, the HKDF scratch and the transcript's six hashers; 80 of it the resumption master secret's two arrays, one per hash), and a `TlsRecordProtection` is 7,368 where it was 64 (its own HKDF scratch, both key sizes and both AES schedules), two of them per slot. Measured as resident memory over a pool of 400, a `TlsTcpServer` slot is about 136 KB where it was about 86 KB: about 50 KB more per slot, fixed, against the 52,808 bytes every handshake used to add. Over QUIC, which keeps one `TlsServer` per slot and `restart`s it for each connection the slot takes (`QuicConnection`'s `tlsSlot`, QUIC-3), each slot carries the same 29 KB more. `TLS_RECORD_MAX_KEY_UPDATES` (64) stays: it no longer bounds memory but still bounds the work a client can ask a connection for, at the interoperability cost RFC 8446 §4.6.3's lack of a limit implies (a client updating on a schedule of its own is refused at its 65th); lifting it is a separate decision. |
| TLS-4 | Low | `std/net/tls-tcp.ts` (`TlsTcpServer`) | The carrier has no clock: a client may hold a slot for as long as it keeps the TCP connection open, mid-handshake or idle, and once every slot is held new connections are accepted and closed at once (`TLS_TCP_POOL_FULL`). Memory stays bounded, since the pool never grows; availability does not. | **Open, the program's to decide.** The program owns the loop and `pollWait`'s timeout, so it closes slots that have gone quiet; a carrier-level idle timeout needs a clock argument the API does not take yet. |
| TLS-5 | Low | `std/crypto/chacha20poly1305.ts` (`chacha20State`, `chacha20Poly1305Seal`, `chacha20Poly1305Open`), reached from `std/net/tls/record.ts` (`TlsRecordProtection.seal`, `open` under ChaCha20-Poly1305) and, once the ticket-seal stage lands, `std/net/tls/ticket.ts` | **What it was.** Every ChaCha20-Poly1305 seal and open copied its key's eight words into a fresh ChaCha20 state, and made a keystream block and a Poly1305 one-time key from it; none of them was zeroed before the arena released it, so a later memory disclosure could read the key from that memory until it was reused. That key was a ChaCha20-Poly1305 traffic key; under the resumption design (Resumption, below) it would also have been the ticket key. Found in review of that design, at b515c1b. Low on the README's scale, with TLS-1 and TLS-2: key material left in memory, not a forgery or a leak to the network. | **Closed** by #639 (ab9099e, the crypto-wipe stage of #430): every one-shot call wipes the ChaCha20 state, the keystream block, the Poly1305 key, `r` and the accumulator with `nish:secret`'s `wipe`, on the refusal path too, and `tests/wipes/crypto.js` pins each wipe after `-O2`. The ticket key's AEAD copies are wiped the same way, with nothing more from the resumption design. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding.

**RFC 8448 §3, byte for byte** (`tests/link/net_tls_rfc8448`, and in `f64`
mode `net_tls_rfc8448_f64`): every secret the trace prints — early, both
"derived" salts, handshake, both handshake traffic secrets, master, both
application traffic secrets, the exporter secret and the resumption master
secret, the last readable only once the client's Finished is accepted (none
before, none after a Finished with one bit flipped) and still the trace's
when the handshake secrets are wiped before that Finished, as a carrier wipes
them — and every traffic key and IV; the ServerHello, EncryptedExtensions,
Certificate, CertificateVerify and Finished the server writes; the CertificateVerify input; and acceptance
of the trace's client Finished, fed whole and a byte at a time. The trace
signs with RSA-PSS, which the stack does not have and which is randomised, so
its signature is injected through the hand-off and every byte after it is
checked. The same server answering a ClientHello that offers only
`TLS_AES_256_GCM_SHA384` is checked against an independent Python model: its
ServerHello, all four traffic secrets, its Finished, acceptance of the
model's client Finished and the resumption master secret after it, since RFC
8448 pins only the SHA-256 suite.

**A production handshake signs with P-256** (`net_tls_ecdsa`, `_f64`): under
each of the three suites a client verifies the CertificateVerify with
`p256VerifySha256` under the certificate's key, verifies the server's
Finished, and is accepted with its own.

**Every refusal is an alert** (`net_tls_ext_refusals`, and every case again
under `f64` in `net_tls_ext_f64`):

- *Malformed input is `decode_error`:* a message announcing more than
  `TLS_MAX_HANDSHAKE_MESSAGE` (64 KiB) bytes, refused from its header, and
  a call carrying more than one maximal message, refused before it is
  copied; a body cut short so that a vector runs past it; a
  session id over 32 bytes; an empty or odd-length `cipher_suites`; an empty
  `supported_versions`; a key share whose length runs past its extension;
  an empty ALPN name; an empty host name or name list; a byte after the
  extensions block; a byte after the contents of a known extension
  (`supported_versions`, `key_share`, ALPN, `server_name`); a Finished of the
  wrong length; and a window outside the parser's buffer.
- *A duplicate is `illegal_parameter`* (RFC 8446 §4.2): an extension sent
  twice, two shares for one group, two host names.
- *Out of turn is `unexpected_message`:* a message at a level the state does
  not expect, a byte after a message that ends the client's flight (RFC 8446
  §5.1), a message of the wrong type, anything while the server waits for its
  own signature, and anything after the handshake.
- *A failed negotiation:* no TLS 1.3 in `supported_versions`
  (`protocol_version`, including a hello with no extensions), or a
  `legacy_version` of SSL 3.0 or below (§D.5); any other `legacy_version`
  is not consulted, as §4.2.1 requires, and a hello saying 0x0301 or 0x0304
  there is accepted. A compression method other than null, or a
  `pre_shared_key` that is not the last extension (§4.2.11), is
  `illegal_parameter`; no common suite, no x25519 in `supported_groups`,
  or the server's signature scheme not offered (`handshake_failure`); no
  `signature_algorithms`, `supported_groups` or `key_share`, or no transport
  parameters over QUIC (`missing_extension`); no ALPN protocol in common, or
  none at all over QUIC (`no_application_protocol`, `net_tls_ext_alpn`,
  `net_tls_ext_quic`).
- *The caller's mistakes are `internal_error`:* a random or key of the wrong
  length, an empty certificate chain, a receive window outside its buffer, and
  a signature that is empty, over 65,535 bytes or handed over at the wrong
  time.
- A failed server stays failed and answers the same alert to every call.

**No weak key exchange is completed.** A low-order x25519 share, whose shared
secret is all zeros, is `illegal_parameter` before any ServerHello is written
(RFC 8446 §7.4.2, RFC 7748 §6.1); a share of the wrong length is
`illegal_parameter`. The all-zero test reads all 32 bytes with
`timingSafeEqual`, since the secret is secret, and runs inside `expose`, on a
`Secret` that is wiped on every path whichever way the test goes.

**One HelloRetryRequest, and its transcript** (`net_tls_ext_hrr`): RFC 8448
§5's `message_hash` transcript and the schedule over it, a constructed retry
whose HelloRetryRequest, ServerHello and handshake traffic secrets match an
independent Python model, a second ClientHello still without the share
(`illegal_parameter`, with no second HelloRetryRequest), and one whose suites
no longer allow the chosen suite (`illegal_parameter`).

**The client Finished is compared in constant time.** `handleFinished` checks
the length (public) and then compares all HashLen bytes with
`timingSafeEqualAt`; a single flipped bit is `decrypt_error`.

**Bounded memory.** The input buffer holds at most one message of at most
`TLS_MAX_HANDSHAKE_MESSAGE` bytes plus its header: a call that would take it
past that is refused before its bytes are copied, a message announcing more is
refused from its header, and a byte past the end of a message is refused
rather than kept.

## Properties verified: the record layer and the carrier (T2)

**RFC 8448 §3's records, byte for byte** (`tests/link/net_tls_record_rfc8448`,
and under `f64` in `net_tls_record_f64`): all nine records of the trace —
ServerHello in the clear, the server's flight as one 679-byte record, the
client's Finished, the NewSessionTicket, both sides' application data and
both `close_notify`s — sealed by `TlsRecordProtection` under the trace's keys
at the trace's sequence numbers, and each opened back by its reader; the
ClientHello record is read whatever its legacy version says (§5.1). Replayed
through `TlsRecordServer`, the trace's ClientHello record brings back the
trace's ServerHello record and, once signed, its flight record, and the
client's Finished, data and `close_notify` records open the connection, read
as the fifty bytes and end the stream. Over a socket
(`net_tls_record_tcp`, `_f64`), a Nish client sends the same records to the
carrier and gets the same ServerHello and flight records back.

**Where the stream is cut changes nothing.** The client's stream through
`TlsRecordReader` cut in two at each of its 354 inner points, fed a byte at a
time and under 64 seeded random cuttings, and the whole replay through
`TlsRecordServer` at each of those cuts, a byte at a time and under 16 random
cuttings: the same records, the same bytes sent, the same state.

**Other suites and padding, against an independent model.** ChaCha20-Poly1305
and AES-256-GCM-SHA384 records, records with 3, 7 and 13 bytes of padding and
KeyUpdate's next secret over both hashes match Python's `cryptography` and
`hmac`, and one protection carries each suite in turn
(`net_tls_record_refusals`).

**Every refusal is an alert** (`net_tls_record_refusals`, `_f64`):

- *`record_overflow`:* a header announcing a body over 2^14 + 256 bytes,
  refused from the header before the body is waited for; a cleartext record
  over 2^14 bytes; a decrypted record over 2^14 + 1.
- *`bad_record_mac`:* one flipped bit of a tag or of a ciphertext; a record
  read at the wrong sequence number; a body shorter than a tag and a type; a
  record under keys a KeyUpdate replaced; a cleartext record once the read
  keys exist. A refused record spends no sequence number, and nothing of it
  is used.
- *`unexpected_message`:* a content type nobody defined, outside or inside;
  a protected record that is nothing but padding (§5.4); application data in
  the clear, or before the client's Finished; an empty handshake record; a
  `change_cipher_spec` before the first ClientHello, after the client's
  Finished, inside a protected record, of any value but 1 or any length but
  1; a `change_cipher_spec` or an alert between the records of one handshake
  message, and application data between those of a KeyUpdate (§5.1); a
  KeyUpdate not at the end of its record; and any post-handshake message but
  KeyUpdate.
- *`decode_error`:* an alert that is not two bytes; a KeyUpdate whose length
  is not 1. *`illegal_parameter`:* a `request_update` other than 0 or 1.
- *The peer's alerts:* `close_notify` ends its stream, after which records
  are dropped (§6.1); `user_canceled` is passed over; any other description,
  one nobody defined included, ends the connection with nothing sent back.
- *Too many KeyUpdates:* the sixty-fifth KeyUpdate a connection takes from
  its client is `unexpected_message` (`TLS_RECORD_MAX_KEY_UPDATES`, TLS-3).
- *Records that carry nothing:* seventeen in a row of `change_cipher_spec`,
  empty application data, `user_canceled` or KeyUpdate (each of which costs
  two key derivations) are `unexpected_message`, Go's `maxUselessRecords`;
  application data or a handshake message starts the count again.
- *Ends:* a stream that ends without `close_notify`, or inside a record, is
  truncation and fails the connection; one whose `close_notify` is still
  waiting behind unread data is not, and the alert counts once it is read.
  After the server's own `close_notify` nothing more is sent — no KeyUpdate
  answer, no alert — and a `close_notify` that finds the output full waits
  for room rather than being dropped.
- *The caller's mistakes are `internal_error`, or a negative count:* a window
  outside an array, an output too small, content over 2^14 bytes, a padding no
  record can carry, an unknown suite or a secret of the wrong length, a
  sequence number at 2^53 − 1, an AES or ChaCha20 key that is not one, a
  signature when none is due, a P-256 key that is not one, and a `TlsServer`
  that already refused its configuration or randomness. A handshake that
  fails before its ServerHello wipes the ephemeral key it never used.

**The handshake goes on records the way RFC 8446 puts it there.** The flight
waits for the signature and goes out as one record; everything after the
ServerHello is under the handshake keys, an alert sent before the flight
included (`net_tls_record_tcp`'s signing key that is not one); keys change
only at a record boundary; a client's session id brings one compatibility
`change_cipher_spec` after the server's first handshake message, a
HelloRetryRequest included, and no second; a flight larger than the output
buffer is held back and sealed in records of at most 2^14 bytes as it drains.

**KeyUpdate, both ways and on a schedule.** The client's KeyUpdate moves the
read keys; asked for one, the server answers under its old keys and moves its
own; `keyUpdate(true)` asks the client back; and once a key has protected
`recordLimit` records the writer sends its own KeyUpdate first (tested with
the limit brought forward from 2^24 to 2).

**Bounded memory after the handshake.** The reader, the output and the
application-data buffer are allocated once per slot; a caller that reads
slowly makes the connection stop asking to be read rather than buffer more;
two hundred echoes over a socket move the arena by 0 bytes, and so does each
of the 64 KeyUpdates a connection takes, answered (`net_tls_record_refusals`).

**A handshake keeps its state in the slot** (`tests/link/net_tls_memory`,
and under `f64` in `net_tls_memory_f64`). A thousand RFC 8448 handshakes
through one `TlsRecordServer` whose `TlsServer` is `restart`ed for each:
every ServerHello and flight record is the trace's, and after the first
`Arena.mark()` does not move: 0 bytes a handshake under AES-128-GCM, where
it was 52,808. A thousand ChaCha20-Poly1305 handshakes with a
P-256 leaf through one slot, their ClientHello padded past the first input
buffer so the first one grows it: every byte the recorded one, and
`Arena.mark()` unmoved after the first. A thousand rounds in that slot of a
HelloRetryRequest, a `restart` and the same plain handshake: every plain one
the recorded bytes, so `restart` undoes `retried` and the `message_hash`
transcript, and `Arena.mark()` unmoved. A thousand connections over loopback
through `TlsTcpServer`'s pool under AES-256-GCM-SHA384 — accepted,
handshaken and closed — the same: every byte the recorded one,
`Arena.mark()` unmoved, every slot free after. The slot's AES schedules are
secret and stay in it while the connection is open; `wipeKeys` (what
`TlsTcpServer.close` calls) and `start` (a slot handed its next connection)
zero both directions', which `net_tls_memory` pins. `aesKeyInto` reproduces
FIPS 197 Appendix C and `aesKey`'s schedule word for word, refuses a key of
another length or a schedule of the wrong size, and leaves the arena unmoved
inside `using a = arena()` (`crypto_aes_into`).
The HMAC and HKDF scratch the schedule runs in reproduce RFC 4231 and RFC
5869 and leave the arena unmoved inside `using a = arena()`
(`crypto_hkdf_scratch`). `restart` with randomness of the wrong length fails
the server with `internal_error`, as the constructor does.

**No key reaches another connection.** `accept` copies the caller's ephemeral
key and server random into the slot and wipes the caller's key array, so a
program that refills one buffer of each for every connection (the loopback
test does) never has a slot's wipe reach the next connection's key, which as
an array of zeros would be a publicly known x25519 key, nor has a pending
handshake send the next connection's random. A random or key that is not 32
bytes is refused with -22 before any connection is taken, and its array left
as it was. A failed or closed connection wipes
everything `TlsServer` still held, the exporter secret included
(`net_tls_record_refusals`); a key that does not install fails the connection
rather than leave a direction in the clear, and `seal` refuses application
data in the clear.

**The carrier against the world** (the `net_tls_tcp` block of `tests/run.js`):
openssl s_client completes a handshake under each of the three suites,
including a KeyUpdate it asks to be answered, and curl GETs a page over
ALPN `http/1.1`, each with the server's own report of the suite, ALPN and
SNI it negotiated. Over loopback the pool sheds a third client for two slots,
closes clients that hang up or reset mid-handshake as a cut stream and as a
socket failure, and frees every slot.

## What is not checked here

- The caller's signature. A wrong one is the caller's bug, and the client's
  verification catches it; the server does not hold the public key's
  algorithm to check it with.
- The certificate chain. It is sent as configured; nothing here parses it.
- Constant-time properties of the primitives, which their own records cover.
  The handshake branches only on public values: lengths, types, the offered
  lists and the state. The record layer branches on record lengths, header
  types and the result of authentication, all public; the one secret-dependent
  value it computes, the length of a record's padding, is found by reading
  every byte and keeping each non-zero one by mask, with no branch or address
  depending on it; the copy of the content that follows takes as long as the
  content, whose length the caller learns anyway. No `tests/ct-asm.js`
  fixture reads that loop: it rests on review.
- The peer's `record_size_limit` (RFC 8449): the server writes records of up
  to 2^14 bytes whatever the client asks for.

## Resumption

The design of TLS 1.3 session resumption with tickets (#481), recorded before
any of it is written, so that the stages that build it are reviewed against
decisions rather than make them. Nothing in this section is verified yet: each
property names the test that is to pin it, and the stage that adds the test
moves the property into "Properties verified" and any finding into Findings.
Names of files, functions and tests are those the later stages are to use,
and RFC sections are RFC 8446's; the existing code it describes is as of commit b515c1b.

Today a `pre_shared_key` offer is checked for being the last extension
(§4.2.11) and otherwise ignored, so every connection is a full handshake;
`TlsServer` derives the resumption master secret all the same, and nothing
reads it (TLS-1).

### What the later stages add

| Stage | Files | What |
| --- | --- | --- |
| psk-wire | `std/net/tls/codec.ts`, `std/net/tls/schedule.ts` | `TlsClientHelloView` reads `pre_shared_key`'s identities and binders and `psk_key_exchange_modes`; `tlsWriteNewSessionTicket` and the ServerHello `pre_shared_key` writer; the PSK early secret, binder key, binder verify and `tlsResumptionPsk`, in place |
| ticket-seal | `std/net/tls/ticket.ts` (new, `nish/net/tls/ticket`) | `tlsTicketSeal` and `tlsTicketOpen` over ChaCha20-Poly1305 under a borrowed `Secret` key; `TlsTicketKeyInfo`, `tlsTicketKeyDraw` and `tlsTicketKeyDue`; `TlsTicketStrikes`, the strike register |
| server-resume | `std/net/tls.ts`, `std/net/tls/record-server.ts`, `std/net/tls-tcp.ts` | `TlsServer`'s ticket hand-off states and resumed path; `TlsRecordServer` sends the NewSessionTicket; `TlsTcpServer`'s per-slot calls that lend the program's keys |
| interop-resume | `tests/link/net_interop_server`, `tests/interop`, `.github/workflows/interop.yml` | curl and Chromium each resume a session against the server |

Resumption is server side and over TCP only (`TlsRecordServer`,
`TlsTcpServer`). QUIC keeps tickets off: its connections never call the
hand-off, so a QUIC ClientHello that offers a PSK gets a full handshake, as
today. There is no client-side ticket store beyond what the tests need, and no
client authentication, so a ticket never stands for a client's identity.

### Attacker and win

The attacker of "Threat model" above, with three more abilities: it records
every ClientHello, and with it every ticket a client offers, which travels in
the clear (§4.2.11); it replays any recorded ClientHello, whole or altered, to
the same process or to another that shares its ticket keys; and it may later
learn a ticket key, or the memory a ticket was opened in. A NewSessionTicket
travels under the server's application traffic keys, so a ticket the client
has not yet offered is not the attacker's unless it has broken that session.

A win adds: a resumed handshake completed without the PSK the ticket was
issued for, or with a ticket the server did not seal or no longer accepts; a
ticket accepted twice by one process; a ticket accepted under a hash, server
name or key exchange mode other than this design's; a resumed session's
traffic, or a full session's, read from a ticket key learned afterwards; a
ticket key or opened PSK left readable after the server is done with it;
memory a client can make the server spend without bound; and early data
accepted.

### Ticket keys

A ticket key is 32 random bytes held as a `Secret<u8[]>`, with a public 16-byte
key id drawn beside it. A `Secret` may not be a field (NL2430), so no class
holds one: the program keeps its keys in locals and lends them, as parameters,
to the call that needs them — the way `TlsTcpServer.signP256` borrows the
P-256 key — and the module that seals and opens tickets holds no `Secret` past
the call's return. The checker refuses a `Secret` as an argument to any file,
network or console builtin (NL2432), so a key reaches disk or the wire only by
the program `expose`ing it on purpose; this design never does, and the
interop server does not.

- **The key's record.** Beside each key the program keeps a
  `TlsTicketKeyInfo`, an object of public fields: the key id, the time the
  key was drawn, and how many tickets it has sealed. It is a class, so it may
  be a field and be kept anywhere; the key it describes may not.
- **The clock.** Every time in this design — a key's creation, a ticket's
  issue time and its chain's start, a strike entry's expiry — is
  `monotonicNanos()`, never the wall clock. Keys never leave the process, so
  no ticket outlives the process that sealed it, and a process-local clock
  serves; unlike `Date.now()`, it cannot step. A wall clock that stepped
  forward by a lifetime and back again would make live strike entries look
  expired, let them be reused, and then accept their tickets a second time.
  The clock is read outside `expose`, which reaches no clock (NL2448), and
  handed in as `now`. A monotonic clock that stops while the machine sleeps
  lengthens a ticket's server-side life by the sleep; the client still drops
  it at `ticket_lifetime` by its own clock (§4.2.11.1). The same is true of a
  key: every bound on a key below is in *awake time*, the time the machine
  ran, since `monotonicNanos()` is `CLOCK_MONOTONIC` and stops in suspend. A
  clock that counts suspend (`CLOCK_BOOTTIME`) is not exposed to Nish
  programs today; the design takes awake time rather than the wall clock,
  because a wall clock can step back and reopen replay. A program on a
  machine that sleeps for long stretches rotates on resume.
- **Lifetime, enforced.** A key seals tickets for 12 hours of awake time after
  it was drawn (its *issue window*), and opens them for one ticket lifetime
  more (2 hours), as the *previous* key. The module enforces both from the key's record,
  whatever the program does: `tlsTicketSeal` refuses a key past its issue
  window, and `tlsTicketOpen` refuses a ticket under a key past 14 hours, so
  the client gets a full handshake. A ticket sealed at the last moment of its
  key's issue window expires exactly as its key stops opening, so no ticket
  outlives its key, and a key rotated at the end of its issue window ends no
  ticket early. A rotation before that — at the seal cap, or when the program
  chooses — wipes the previous key, and with it whatever of that key's tickets
  were still within their lifetime, if the previous rotation was less than
  one lifetime before. The design accepts that: those clients get a full
  handshake and nothing else, and keeping a third key to spare them would
  add a `Secret` the turn has to shuffle for a case the cap makes rare (2^30
  tickets in under 2 hours is 150,000 a second). What the module
  cannot do is wipe the program's key: the wipe is the program's, at rotation.
  A program that never rotates keeps a key's bytes in memory, but no ticket
  under it opens after 14 hours of awake time and no client offers one after
  its 2-hour lifetime by the client's clock (§4.2.11.1), so the bound on what
  a leaked key opens holds either way: 14 hours of awake time, longer in wall
  time only by the time the machine slept.
- **Rotation.** The program holds at most two keys, current and previous, in
  locals. `tlsTicketKeyDraw(info, now): Secret<u8[]>` draws a fresh key and
  id with `crypto.getRandomValues`, moves the key into a `Secret`, fills
  `info` (new id, `now`, a count of 0) and returns the key;
  `tlsTicketKeyDue(info, now): boolean` says when the current key should be
  replaced. The turn itself is the caller's, because a function hands back at
  most one `Secret` and may not reassign a borrowed one (NL2429, NL2442,
  NL2444): `wipe(previous)` if there is one, `previous = current`, copy the
  current record into the previous one, then
  `current = tlsTicketKeyDraw(currentInfo, now)`. A program written that way
  compiles under `nish:secret` today. The interop server rotates that way.
- **A ticket under a retired or unknown key** fails to open — its key id
  names neither key — and the client gets a full handshake (§4.2.11: unknown
  PSKs SHOULD be ignored). So does every ticket after the process restarts,
  since keys never leave memory.
- **Nonces, enforced.** Each ticket is sealed under a fresh 12-byte random
  nonce. Under one key, n tickets collide with probability about n² / 2^97.
  The issue window bounds time, not the number of connections, so the count
  is kept: the key's record counts the tickets it has sealed, and
  `tlsTicketSeal` refuses a key that has sealed 2^30 (its *seal cap*, a field
  of the record with that default), which bounds a collision at 2^60 / 2^97 =
  2^-37 whatever the connection rate. `tlsTicketKeyDue` answers true at the
  cap as at the end of the window, and until the program rotates, connections
  are issued no ticket; nothing else about them changes. A repeated nonce
  would let the attacker forge a ticket; the cap is what rules it out.
- **The ticket.** Key id (16, public, authenticated as AAD) ‖ nonce (12) ‖
  ChaCha20-Poly1305 ciphertext of the state ‖ tag (16). The state is what a
  resumed handshake reads, and nothing else: the suite, the time the ticket
  was issued, its lifetime, the time of the full handshake its chain started
  from, the server name the session agreed (empty when the client sent none),
  and the resumption PSK, `HKDF-Expand-Label(resumption_master_secret,
  "resumption", ticket_nonce, Hash.length)` (§4.6.1). The ALPN protocol is not
  in it: only 0-RTT needs it to match (§4.2.10), and a resumed handshake
  negotiates ALPN as a full one does. `ticket_age_add` is not in it either:
  it is drawn fresh for every ticket, as §4.6.1 requires, and would be read
  back only to check the client's ticket age (§4.2.10, §8.3). §4.2.10 makes
  that check a MUST, and names what follows from an age outside tolerance:
  reject 0-RTT, and take no other action that assumes the ClientHello is
  fresh. This server rejects 0-RTT always and assumes no ClientHello fresh,
  so the check could change nothing, and the server does not make it; its own
  issue time, in the sealed state, is what expiry is measured from. A session
  whose server name is longer than 255 bytes is issued no ticket.
- **The AEAD.** ChaCha20-Poly1305 (`nish/crypto/chacha20poly1305`) takes its
  key as raw bytes, so it runs inside `expose` with no expanded key schedule
  left in a field, which an AES ticket key would leave (TLS-2).
- **Expiry.** A ticket opens only when the time now is no earlier than its
  issue time, no later than issue time plus lifetime, and no later than 24
  hours after the full handshake its chain started from. The sealed fields
  are not trusted for more than the server would have written: a ticket whose
  sealed lifetime is longer than the server's own (7200 s), or whose chain
  start is after its issue time, fails to open, since only a holder of the
  ticket key can seal such a ticket and this server never does. A resumed connection
  issues a ticket that carries the chain's start forward, so resumption cannot
  extend a certificate-authenticated session's keying material for ever
  (§4.6.1 RECOMMENDS a limit); a client resuming every hour pays one full
  handshake a day. A ticket whose issue time is after `now`, which a
  monotonic clock gives only to a ticket sealed under another process's
  clock, fails to open. The `ticket_lifetime` sent is 7200 seconds, under §4.6.1's
  604,800 cap.

To be pinned by `net_tls_ticket` (round trip, a flipped bit in each region,
expiry at each bound, retired and unknown key ids, the chain bound; a ticket
sealed under a live key with a lifetime over 7200 s, or a chain start after
its issue time, failing to open; a key past
its issue window refused by `tlsTicketSeal` and past 14 hours by
`tlsTicketOpen`; the seal cap, brought forward to 2 as `recordLimit` is for
KeyUpdate; `tlsTicketKeyDue` at the window's end and at the cap; and the
caller's rotation turn run three times, with a ticket under the previous key
opening until the turn after and failing to open then) and by a `tests/run.js`
wipe-count check after `opt -O2`, in the manner of `tests/wipes/crypto.js`'s
groups: its roots are the test's rotation turn (the `wipe` of
the previous key), `tlsTicketKeyDraw`, `tlsTicketOpen` and `tlsTicketSeal`
(each `secureZero` of the plaintext, on the success and the failure path), and
each wipe is shown counted on its own by deleting it and watching its root's
count drop. A wiped `Secret` cannot be read again (NL2443) and the plaintext
is a local no object keeps, so the IR is where those wipes can be seen. The
check is a group in `tests/wipes/tls.js`, the TLS area's file in the harness
#639 added.

### Anti-replay

Tickets are single-use in each process (§8.1). `TlsTicketStrikes` is a strike
register of ticket ids, each kept until its ticket expires or one server
lifetime (7200 s) after it was recorded, whichever is sooner, so no entry
outlives `now` + 7200 s at its recording whatever its ticket says. The open
check (row 3) already refuses a ticket that claims more, so the clamp is a
second bound, held by the register itself: `TlsTicketStrikes.take(id,
expiresAt, now)` records `min(expiresAt, now + 7200 s)`, whatever it is
handed. The register is an open-addressed
table made once at the capacity the program gives (65,536 ids by default; a
12-byte id and an 8-byte expiry each, so about 1.3 MB), whose expired entries
are reused, and which never grows. The program owns it and lends it to the
call that opens tickets, as it lends the keys. The id is the ticket's seal nonce, which
the AEAD authenticates, so an id comes only from a ticket this server sealed.

- **The order.** Identities are read in the client's order, and the first
  that opens, has not expired, is under the hash of the suite the server has
  already chosen (§4.2.11, §4.6.1), names the server name of this ClientHello,
  and is not in the register is selected; then its binder alone is verified
  (§4.2.11: SHOULD NOT validate multiple binders), and only once it verifies
  is its id recorded. So the register holds only ids from ClientHellos whose
  binder verified (as §8.2 requires of a recorded ClientHello's key): an
  attacker who has seen a ticket cannot spend it with a ClientHello of its own
  making, since it holds no PSK to bind one. It can spend it with the
  client's: a whole ClientHello carries the client's valid binder, so an
  on-path attacker that delivers it first, or drops the client's copy and
  replays it, gets the id recorded, and the client's own offer is passed over
  (row 6). What it wins is denial of resumption for that ticket — the client
  gets a full handshake — and no key, since finishing the handshake needs the
  client's x25519 private key. A ticket already recorded is passed over like
  one that does not open.
- **The entry's life is the server's.** A strike entry needs to outlive only
  the window in which its ticket could open again, and the server, not the
  ticket, bounds that window at one lifetime. So the sizing below, capacity
  over one server lifetime, holds for any ticket, a forged one included.
- **One call, no gap.** Opening the identities, checking the register,
  verifying the selected binder and recording its id happen in one call, the
  ticket hand-off for one ClientHello, which returns only once the id is
  recorded or no identity is selected. The ClientHello is whole by then, so
  the binder needs nothing more from the client. A carrier serves its slots
  one call at a time on one thread, so two slots offering the same ClientHello
  cannot both pass the check: the first records, and the second is row 6. A
  register is not shared between threads; a program that serves on several
  threads gives each its own register and its own keys, and is to that
  extent several processes (Per process, below).
- **Recorded is spent.** Once its binder has verified, a ticket is spent,
  whatever happens after: a client Finished that fails, a stream cut, a slot
  closed. The id is not released, because the server cannot tell a client
  that failed from an attacker that replayed a whole ClientHello it cannot
  finish, and releasing would let that attacker hold one ticket open for
  replay as often as it liked. The client loses one ticket and gets a full
  handshake next time.
- **Full fails closed.** A register with no free entry selects no ticket, and
  the client gets a full handshake. Evicting a live entry would make a ticket
  usable twice. Because a resumed connection is issued a ticket of its own,
  one full handshake starts a chain that can fill the register on its own:
  keeping it full takes resumptions at its capacity over the ticket lifetime,
  about 9.1 a second at the default, each a real connection with an x25519
  exchange on the attacker's side too, sustained for as long as the effect is
  wanted. That is the cost to an attacker without a ticket key. One that holds
  a live key (Forward secrecy and a leaked ticket key, below) seals tickets
  under PSKs of its own choosing, binds ClientHellos to them, and never
  finishes: each id is recorded once its binder verifies, so it fills the
  register at the speed it can send ClientHellos, for as long as the key
  opens tickets. A key opens tickets until the program wipes it, or until 14
  hours of awake time after its draw, whichever is first; rotating it once
  does not stop it, since it then opens as the previous key for 2 hours more.
  A program that believes a key leaked retires it at once rather than waiting
  out its window: a previous key it wipes on the spot, and a current one it
  turns twice, which wipes it and leaves two fresh keys. No entry outlives its recording by more than one server
  lifetime (above), so the register is free of the attacker's entries at most
  2 hours after the key stops opening: at most about 16 hours of awake time
  after the key was drawn, if the program never retires it. It gains no more
  than that: it can already resume, and impersonate the server to clients
  that do.
- **While the register is full**, every client resumes no session and pays a full
  handshake, as it would on a server without tickets: a cost in CPU, never a
  key, a forged ticket or a ticket accepted twice. The design accepts that
  rather than bound it per chain or per client: a per-chain allowance only
  makes the attacker start a chain with a full handshake every few seconds,
  and a per-client one needs an identity a server without client
  authentication does not have. What it adds is sight and size:
  `TlsTicketStrikes` counts the resumptions it refused for being full, which
  the program reads to alert on or to size by, and the program sizes the
  register at least to its legitimate resumption rate times the ticket
  lifetime, about 20 bytes an id.
- **Why single-use when there is no 0-RTT.** A replayed ClientHello that
  offers a ticket under `psk_dhe_ke` wins the attacker no key: completing the
  handshake needs the PSK and the private half of the client's key share, and
  without 0-RTT the ClientHello carries no application data to replay. What
  single-use buys is the rest: a recorded ClientHello resumes at most once, so
  whatever a resumption costs the server or tells the program happens once;
  reusing a ticket, which links a client's connections for anyone watching
  (§C.4: clients SHOULD NOT), buys the client nothing; and §8.1's anti-replay
  is in place now, so that a later decision on 0-RTT does not change what a
  ticket means. A replayed ticket that is passed over gets a full handshake,
  which any client can ask for anyway.
- **Per process.** The register is not shared. A fleet whose processes share
  ticket keys accepts each ticket once in each process; under this design that
  costs a handshake per process and yields no key. Sharing the register is out
  of scope, documented rather than solved.
- **Tickets issued.** One NewSessionTicket per connection, full or resumed,
  sent after the client's Finished verifies, so a client always has a fresh
  ticket for its next connection (§C.4: SHOULD issue new tickets with every
  connection). A client that opens several connections at once after a single
  one holds one ticket, and its other connections are full handshakes: a cost
  in CPU, accepted for bounded per-connection work. A client whose
  `psk_key_exchange_modes` does not list `psk_dhe_ke`, or that sent none, is
  issued no ticket (§4.2.9: SHOULD NOT send tickets incompatible with the
  advertised modes). Nor is a connection whose current key is past its issue
  window or at its seal cap, until the program rotates. The `ticket_nonce` is
  one byte, 0, unique among the one ticket a connection gets (§4.6.1).

To be pinned by `net_tls_ticket` (replay refused; the register full refusing
and counting each refusal, and taking ids again once entries expire;
`TlsTicketStrikes.take` called directly with an expiry a week away, whose
entry is free again 7200 s after `now`) and
`net_tls_resume` (each row of the fallback and abort table below, rows 17 and
18 included).

### 0-RTT

Out of scope, and off: no ticket carries an `early_data` extension, so none
permits early data (§4.6.1), and EncryptedExtensions never carries one, so the
server never accepts it (§4.2.10). The reasons: early data, unlike a
ClientHello, is application data, and a replay delivers it again. §8 requires
each server instance to accept 0-RTT for a handshake at most once and asks
deployments to share that state; a per-process register gives the minimum for
one process, and a fleet sharing ticket keys would deliver a request once per
process. Accepting it would also need the freshness check (§4.2.10, §8.3), and
with it `ticket_age_add` and the ALPN protocol in the ticket, plus trial
decryption of rejected early data, and every application above it to say
which requests are safe to replay (§8). None of that is needed for 1-RTT
resumption, which is what #481 asks for.

A ClientHello that offers `early_data` anyway is answered as if the extension
were absent, resumed or full: §4.2.10's first way, ignoring the extension.
That way skips records that fail deprotection under the handshake keys, up to
the server's configured `max_early_data_size`; this server configures none,
having advertised none on any ticket, so it skips nothing. A 0-RTT record that
follows does not open under the client's handshake keys and fails the
connection with `bad_record_mac`, as such a record does today. A client
sends early data only on a ticket that carries `early_data` (§4.2.10, §4.6.1),
and none of this server's does.

### Forward secrecy and a leaked ticket key

Resumption uses `psk_dhe_ke` only (§4.2.9): the resumed handshake runs an
x25519 exchange as a full one does, and its handshake secret is extracted
from the ECDHE secret over the early secret the PSK gave (§2.2, §7.1).
`psk_ke` alone is never selected, and a client that offers only it gets a full
handshake: under `psk_ke` every secret of the resumed session comes from the
PSK alone, so a later leak of a ticket key would open the recorded traffic of
every session resumed under it (§2.2: PSK alone loses forward secrecy for the
application data).

What a leaked ticket key exposes, until its tickets expire — at most 14 hours
of awake time after the key was drawn (The clock, above):

- the state of every ticket sealed under it that the attacker has recorded:
  the PSK, the suite, the times and the server name. Recorded means offered by
  the client in a ClientHello, since issued tickets travel encrypted;
- with an active attacker on the path, impersonation of the server to a client
  that resumes with such a ticket: the attacker intercepts the ClientHello,
  opens the ticket, and completes the handshake with the PSK and a share of
  its own. A PSK authenticates the server (§2.2), so a ticket key is worth, for
  its lifetime, what the certificate's private key is worth to a client that
  resumes. The short lifetime, the rotation and the wipe are what bound this.

What it does not expose: the traffic of any session, full or resumed, that the
attacker only recorded — a resumed session's needs the client's or the server's
x25519 private key too, and a full session's resumption master secret cannot
be recovered from the PSK derived from it (HKDF-Expand, §4.6.1, §7.1); the
certificate's private key; and tickets sealed under any other key. Since
there is no client authentication, resuming as the client gains the attacker
nothing a fresh anonymous connection would not.

### What stays in memory

As TLS-1 records for the other secrets:

- **Ticket keys** are the program's `Secret`s and are wiped by the program's
  rotation turn when retired (Rotation, above). What the AEAD makes from a
  key while it runs — the ChaCha20 state holding the key's eight words, the
  keystream and the Poly1305 key — is wiped by the primitive since #639
  (TLS-5, closed).
- **The opened state.** The function `tlsTicketOpen` hands `exposeWith` may
  not write through the argument it is given (NL2450), so it cannot decrypt
  into the caller's state. It opens the sealed bytes into fresh arrays and
  answers the plaintext — the suite, times, server name and resumption PSK —
  as a plain `u8[]`, empty when the tag fails; what the AEAD makes on the way
  is wiped by the primitive (TLS-5). Outside `expose`,
  `tlsTicketOpen` parses that array into the caller's `TlsTicketState`,
  copying the PSK into the state's own array, and wipes the plaintext with
  `secureZero` on every path, a failed parse's included. Sealing is the same
  shape the other way: the plaintext is built outside `expose` from bytes
  that are not a `Secret`, sealed by the function `exposeWith` runs, and wiped
  once sealed. Both run in a `using a = arena()` block, so what they allocate
  is released once wiped (the 0 bytes per handshake below). `TlsServer`
  keeps the opened PSK in one of its secret arrays, since a `Secret` may not be a field, and
  wipes it with `secureZero` once the early secret is extracted, on failure,
  and in `restart`.
- **The binder key and early secret** are made in place by the schedule and
  wiped as the schedule's other intermediates are; the binder is compared in
  constant time, as the client Finished is.
- **Issuing.** The resumption PSK for a NewSessionTicket is derived, sealed
  and wiped with `secureZero` before the record carrying it is sent; once its
  ticket is sealed, or at once on a connection that is issued none, the
  connection's resumption master secret is wiped too, which closes that part
  of TLS-1 for TLS over TCP.
- **Memory.** A resumed handshake through a reused slot leaves `Arena.mark()`
  where a full one leaves it: 0 bytes per handshake (TLS-3).

To be pinned by the wipe-count check under Ticket keys (the plaintext's
`secureZero` on each path of `tlsTicketOpen` and `tlsTicketSeal`, seen in the
IR, since no object keeps the plaintext for a test to read) and
`net_tls_resume` (the PSK and resumption master secret zero after the
handshake; 0 bytes per resumed handshake through a reused slot).

### Fallback and abort table

What the server does with each ClientHello that offers `pre_shared_key`, and
the rule it rests on. The checks the server makes today come first, in their
order, but for the two a resumed handshake does not need, which row 14
decides after the identities are read: `signature_algorithms` present, and
the server's signature scheme in it. A
*full handshake* is the certificate handshake the server makes today, ticket
and binder unread, with nothing recorded in the strike register. Every later
stage's tests cite this table by row.

| # | The client offers | The server | Rule |
| --- | --- | --- | --- |
| 1 | an identity that opens, unexpired, unrecorded, under the chosen suite's hash and this ClientHello's server name, with a binder that verifies, and `psk_dhe_ke` | resumes: ServerHello with `pre_shared_key` naming it and a `key_share`, then EncryptedExtensions and Finished, no Certificate or CertificateVerify; records its id | §2.2, §4.2.9, §4.2.11 |
| 2 | no identity that opens (tampered, truncated, an unknown or retired key id, a key past 14 hours) | full handshake | §4.2.11 (unknown PSKs SHOULD be ignored) |
| 3 | an identity that opens but has expired, by lifetime or by the 24-hour chain bound, is dated in the future, or carries a lifetime over the server's or a chain start after its issue time | full handshake | §4.6.1 (a server MAY treat a ticket as valid for less) |
| 4 | an identity whose suite's hash is not the chosen suite's | passed over; full handshake if none other qualifies | §4.2.11, §4.6.1 (same KDF hash) |
| 5 | an identity issued for another server name | passed over; full handshake if none other qualifies | §4.6.1 (declining every other name keeps the reported name the session's) |
| 6 | an identity already recorded | passed over; full handshake if none other qualifies | §8.1 |
| 7 | any identity, when the strike register is full | full handshake | this design (fails closed) |
| 8 | `psk_key_exchange_modes` without `psk_dhe_ke` | full handshake | §4.2.9 (MUST NOT select a mode not listed); this design |
| 9 | an identity selected as in row 1 whose binder does not verify, or is not the hash's length | `decrypt_error`, nothing recorded | §4.2.11 (MUST abort), §6.2 |
| 10 | `pre_shared_key` without `psk_key_exchange_modes` | `missing_extension` | §4.2.9 (MUST abort), §6.2 |
| 11 | `pre_shared_key` that is not the last extension | `illegal_parameter` (today's check) | §4.2.11 (MUST) |
| 12 | identities and binders of different counts | `illegal_parameter` | §4.2.11, §6.2 |
| 13 | a malformed `pre_shared_key` or `psk_key_exchange_modes` (a vector past its bounds, an identity or binder of a length the syntax forbids, an empty mode list) | `decode_error` | §4.2.9, §4.2.11, §6.2 |
| 14 | `pre_shared_key` without `signature_algorithms`, or without the server's scheme in it, when row 1 does not apply | `missing_extension`, or `handshake_failure` for the scheme, as today | §4.2.3 (MUST abort when authenticating by certificate), §9.2 |
| 15 | `psk_dhe_ke` without an x25519 share | one HelloRetryRequest, as today; identities are read in the second ClientHello, whose binders cover the first, the retry and the truncated second | §4.1.4, §4.2.11.2 |
| 16 | `early_data` | the extension is ignored and the handshake goes on by the rows above; a 0-RTT record that follows is `bad_record_mac` | §4.2.10 |
| 17 | an identity resumed as in row 1, then a client Finished that fails, a stream cut or a slot closed | the connection fails as today; the id stays recorded, and a later offer of the ticket is row 6 | §8.1; this design (recorded is spent) |
| 18 | the same ClientHello on two slots before either finishes | the first resumes as in row 1; the second is row 6 | §8.1; this design (one call, no gap) |

Rows 2 to 8 and 18 never abort for a reason of the ticket: a client the server
cannot resume gets the handshake it would have had without a ticket. Where
one of them meets row 14 — a ticket that does not open, say, in a ClientHello
without `signature_algorithms` — row 14 wins and the handshake is
`missing_extension`, as it is today without a ticket. Row 9 is the one place a ticket that
opened can fail a connection, and it tells the attacker that the identity
opened and was not recorded (§E.6). Tickets are in the clear in the
ClientHello, the attacker cannot seal one, and what it learns is whether a
ticket it saw is still unspent; the design accepts that. Over QUIC, rows 1 to
9, 17 and 18 are all a full handshake or today's handling, since its
connections never open a ticket, and rows 10 to 15 hold as over TCP, the
codec being shared. Of row 16, the first half holds over QUIC (the extension
is ignored); the second does not apply, since QUIC carries no TLS records and
its 0-RTT packets are the QUIC record's (`quic.md`), not this one's. A ClientHello with no `pre_shared_key` is handled as today.

To be pinned by `net_tls_psk_wire` (rows 10 to 13 as codec refusals, RFC
8448 §3's NewSessionTicket and §4's resumption PSK, early secret and binder
byte for byte) and `net_tls_resume` (every row, over `TlsRecordServer`).
