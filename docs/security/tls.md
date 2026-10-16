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
it is computed with are `Secret`s, wiped on every path. The secrets the
handshake keeps in `TlsServer`'s fields and hands its carrier are wiped with
`secureZero` once the carrier has what it needs from them and at every end of
the connection (#430's TLS stage, below). Two Low findings are left open, as
CLAUDE.md §Security requires: TLS-1, narrowed to the secrets an open
connection keeps in fields, and TLS-4, the carrier's missing timeout
(T2's result, below).

**T2's result.** Every record the trace prints is reproduced byte for byte,
and every refusal of the record layer is an alert, never a panic. Records are
authenticated before a byte of them is used, the inner content type is found
without branching on the padding, and the record counter cannot wrap. A
connection past its handshake allocates nothing that outlives a record, and
neither does a KeyUpdate; a per-connection cap bounds how many a client may
ask for. On the carrier's path `TlsServer`'s traffic secrets, its handshake
secret and the caller's ephemeral key are wiped once the record layer has
what it needs from them, which narrows TLS-1 for TLS over TCP. TLS-2 (Low),
the AES key schedule zeroed by ordinary stores, was open after T2 and is
closed by #430's TLS stage, which wipes it with `aesKeyWipe` at every end;
TLS-4 (Low), no timeout in the carrier, is open. TLS-3, the memory each
handshake left, is closed.

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

**#430's TLS stage.** Every key a TLS connection holds is wiped when the
connection ends, by a store `opt -O2` keeps, at once on a failure and at the
slot close, in steps after a clean `close`. At every failure (after its alert
is sealed, or on the client's error alert) and at the carrier's slot close
everything is wiped: both directions' keys, IVs and AES schedules, both
traffic secrets the slot keeps for KeyUpdate, and everything `TlsServer`
holds, the resumption master secret and the exchange's words included. After
a clean `close` the resumption master secret is wiped at once and the write
direction once the server's `close_notify` is sealed; the read direction waits
for the client's `close_notify`, and the rest for `wipeKeys`, which the
carrier's slot close calls and a program driving `TlsRecordServer` itself
calls after the connection closes. A slot handed its next connection is wiped
by `restart` (`TlsServer`'s arrays) and `TlsRecordServer.start` (the keys and
traffic secrets). TLS-2 is closed, and TLS-1 is narrowed to the one-shot
answers and what an open connection needs.

**#430's secret-boundary stage.** The schedule's one-shot derivations take
every secret they are given as a `Secret<u8[]>` and answer every secret they
derive as one: `tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`,
`tlsDeriveSecret`, `tlsExtract`, `tlsExpandLabel`, `tlsTrafficKey`,
`tlsTrafficIv` and `tlsNextTrafficSecret` answer `Secret<u8[]>`, and
`tlsFinishedVerifyData` takes its base key as one. A plain `u8[]` handed to
any of them is refused by the checker. Each reads a key only inside
`exposeWith` and wipes, with `wipe`'s volatile store, what it derives on the
way: the zero salt and input of the early secret, the "derived" salts, the
master secret's zero input and `finished_key`; HMAC and HKDF wipe their own
key blocks (`std/crypto/hmac.ts`). The `Secret` a derivation answers is the
caller's to wipe, and the checker refuses a function that neither returns nor
wipes one it made. TLS-1 is narrowed to the secrets an open connection keeps
in fields.

## Scope

| File | Functions |
| --- | --- |
| `std/net/tls.ts` | `TlsServer` (`restart`, `receive`, `reserveInput`, `reserveOutput`, `handleMessage`, `handleClientHello`, `chooseSuite`, `chooseAlpn`, `takeServerName`, `exchangeKeys`, `writeServerFlight`, `signatureInput`, `sign`, `handleFinished`, `fail`, `wipeResumption`, `sent`, `takeOutput`, `clearOutput`, `readSecret`, `writeSecret`), `tlsExchange` and its `TlsExchangeWords`, `tlsSignEcdsaP256`, `tlsEcdsaDerSignature`, `TlsP256Signer` (`sign`), and the in-place DER writers both encoders share (`tlsEcdsaDerLength`, `tlsEcdsaDerInto`, `tlsDerIntegerLength`, `tlsDerIntegerInto`) |
| `std/net/tls/codec.ts` | `tlsReadClientHello` into a `TlsClientHelloView` and its readers (`tlsRead*`, `tlsReadServerName`, `tlsReadKeyShare`, `tlsReadAlpn`, `tlsReadExtension`, `tlsMarkSeen`), `tlsParseClientHello`, the six `tlsWrite*` writers with their `tlsEncode*` wrappers, and `tlsWriteCertificateVerifyContent` / `tlsCertificateVerifyContent` |
| `std/net/tls/schedule.ts` | the key schedule (`tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExpandLabel`, `tlsExtract`, `tlsFinishedVerifyData`, `tlsTrafficKey`, `tlsTrafficIv`), its in-place forms (`tlsDeriveSecretInto`, `tlsMasterSecretInto`, `tlsFinishedVerifyDataInto`, `tlsTrafficKeysInto`) and `TlsTranscript` |
| `std/net/tls/record.ts` (T2) | `tlsRecordLength`, `TlsRecordReader`, `TlsRecordProtection` (`install`, `reserve`, `derive`, `clear`, `nonceInto`, `seal`, `open`), `tlsNextTrafficSecret` |
| `std/net/tls/record-server.ts` (T2) | `TlsRecordServer`: `receive`, `process`, `handleRecord`, `handleChangeCipherSpec`, `handleHandshake`, `handleApplicationRecord`, `handleAlert`, `handlePostHandshake`, `updateReadKeys`, `advance`, `pump`, `sendKeyUpdate`, `keyUpdate`, `read`, `write`, `close`, `sealClose`, `sign`, `end`, `checkTruncation`, `abort`, `fail`, `wipeKeys`, `wipeTraffic`, `wipeRead`, `wipeWrite`, `wipeHandshake` |
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
| TLS-1 | Low | `std/net/tls.ts` (`TlsServer`'s fields while a connection is open); `std/net/tls/schedule.ts` and `std/net/tls/record.ts` (the one-shot derivations, for what a `Secret` cannot reach) | *Rewritten by #430's secret-boundary stage; it names functions rather than lines.* **What is left.** While a connection is open its secrets live in fields, since a `Secret` may not be one (NL2430): the caller's ephemeral key until the ServerHello is written, the traffic secrets each direction keeps for KeyUpdate, the exporter secret for the caller, and the resumption master secret, which nothing reads yet since NewSessionTicket, PSK and 0-RTT are out of scope. Of the one-shot derivations, what a wipe cannot reach is what any `Secret` leaves (docs/LANGUAGE.md, "Secrets"): a key's bytes in registers and stack spills while HMAC and HKDF run on it, and any copy a caller takes out of a `Secret` with `expose`, which is the caller's own. **What is wiped.** The schedule's one-shot functions — `tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExtract`, `tlsExpandLabel`, `tlsFinishedVerifyData`, `tlsTrafficKey`, `tlsTrafficIv` — and `tlsNextTrafficSecret` (`std/net/tls/record.ts`, used only by tests) take every secret as a `Secret<u8[]>` and answer every secret, key and IV as one, which the caller wipes; a plain `u8[]` passed to one is refused (`reject_secret_tls_plain_key`). Each reads its key only inside `exposeWith` and wipes the zero salt and input, the "derived" salts and `finished_key` with `wipe` before it returns; until #430's secret-boundary stage they answered all of these as plain `u8[]` that nothing wiped. `std/` never calls them: `TlsServer` and the record layer use the in-place forms (`tlsDeriveSecretInto`, `tlsMasterSecretInto`, `tlsFinishedVerifyDataInto`, `tlsTrafficKeysInto`), which wipe the master secret, the "derived" salt and both `finished_key`s with `secureZero` and their HKDF and HMAC scratch after every step. The copy of the ephemeral key the exchange runs on and the ECDHE secret are `Secret<u8[]>`s (`nish:secret`, #418) that `tlsExchange` wipes on every path, and the all-zero check and the handshake secret's extract run on the ECDHE secret only inside `expose`; the P-256 key `tlsSignEcdsaP256` signs with is the caller's `Secret`, borrowed, and `p256` wipes what it derives from it (ECC-2). `TlsExchangeWords`, which carries the ephemeral key into the exchange and the handshake secret out as words, is wiped whole by `exchangeKeys` with `wipe`, a volatile store, once the answers are unpacked, after the branch on the exchange's alert so that a refused exchange leaves it zero too (until #430 each word was zeroed by an ordinary store, and the share and public key's words not at all). `sign` derives the resumption master secret ahead, under the master secret it then wipes, over the transcript through the one client Finished it will accept (RFC 8446 §4.6.1); `handleFinished` points `resumptionSecret` at it only once that Finished verifies, and wipes the handshake secret; `TlsServer.fail` and `restart` wipe it, and `wipeResumption`, the carriers' hook (`TlsRecordServer`'s, and over QUIC `wipeAll`'s, QUIC-2), wipes its array whether or not `resumptionSecret` points at it yet. `restart` wipes every secret array a slot's last connection left before the next is handed them. Over TCP `TlsRecordServer` wipes `TlsServer`'s ephemeral key once the ServerHello is written, the handshake secret and the client's handshake secret once the flight is signed, the server's handshake and application secrets once its write keys are installed, and the client's application secret once its read keys are; it wipes the resumption master secret on `close`, the write direction once its `close_notify` is sealed and the read direction once the client's arrives; and every way the connection fails — `fail` (after the alert is sealed), the client's own error alert, a stream cut off without `close_notify`, `abort` — and the carrier's slot close (`wipeKeys`, which `TlsTcpServer.close` calls) wipe both directions' keys, both traffic secrets it keeps and everything `TlsServer` still holds, the exporter and resumption master secrets included (TLS-2 says what a direction holds). `net_tls_wipes` and `_f64` read each array back as zero after each of those ends, and the check `tls: the wipes survive opt -O2 (both directions' keys, IVs and AES schedules; the traffic, handshake, exporter and resumption secrets; the exchange's words)` in `tests/wipes/tls.js` counts each wipe after `opt -O2`, as `tls: the one-shot derivations' wipes survive opt -O2 (the early secret's zero salt and input, the derived salts, the master secret's zero input, finished_key)` counts the one-shot derivations'; `net_tls_rfc8448` checks `TlsServer.fail`'s, and `net_tls_memory` `restart`'s. | **Open, narrowed** to the secrets an open connection keeps in fields, which a `Secret` cannot hold (NL2430); the one-shot answers are closed by #430's secret-boundary stage. |
| TLS-2 | Low | `std/net/tls/record.ts` (`TlsRecordProtection`: `clear`, `derive`), `std/net/tls/record-server.ts` (`TlsRecordServer`: `fail`, `handleAlert`, `checkTruncation`, `abort`, `sealClose`, `wipeKeys`) | *Rewritten by #430's TLS stage; it names functions rather than lines.* **What it was.** A direction's key, IV and AES key schedule live in its fields, since a `Secret` may not be one (NL2430). The key and IV were wiped with `secureZero`, but the schedule is `u64` words, which `secureZero` does not take, and was zeroed with ordinary stores, and `aesKeyInto`'s working copy of it with stores the optimiser could drop since nothing read them again; and a connection that failed kept both directions' keys and traffic secrets until its slot was closed or reused. **What closes it.** `clear` wipes each schedule with `aesKeyWipe` (`nish/crypto/aes`, #639): one volatile `wipe` of the whole of `roundKeys`, the runtime kernels' powers of H after the schedule included, and one of H; the key and IV stay `secureZero`'d. `aesKeyInto` wipes its own working copies since #639 (AEAD's record). A direction is cleared when it is installed again, and `TlsRecordServer` now clears both, with both traffic secrets it keeps, at every end: once the fatal alert `fail` sends is sealed, when the client sends an error alert of its own, when the client's stream is cut off without `close_notify`, on `abort`, when the slot is closed (`wipeKeys`) or handed its next connection (`start`); and the write direction alone once the server's `close_notify` is sealed (`sealClose`), since it is the last record the server writes, while the read direction stays for what the client may still send, until the client's own `close_notify`, after which nothing is read, wipes it (`handleAlert`). `derive` writes the key and IV straight into place in the direction's own HKDF scratch, which is wiped after each derivation. `seal` and `open` copy the record's plaintext into arrays their scope releases, unwiped: application data, not keys; the per-record nonce is wiped with `secureZero` on every path. Pinned by `net_tls_wipes` and `_f64` (every array of both directions read back as zero after each end, kernel tail and H included) and by the check `tls: the wipes survive opt -O2 (both directions' keys, IVs and AES schedules; the traffic, handshake, exporter and resumption secrets; the exchange's words)`, where `clear` reaches 7 volatile wipes and 3 with ordinary stores in place of `aesKeyWipe`. | **Closed** (#430's TLS stage). |
| TLS-3 | Medium | `std/net/tls.ts` (`TlsServer`), `std/net/tls/record.ts` (`TlsRecordProtection.derive`), `std/net/tls/record-server.ts` (`advance`, `pump`, `handlePostHandshake`, `sendKeyUpdate`), `std/net/tls-tcp.ts` (`accept`) | **What it was.** Each handshake left arena memory behind until the program reset the arena: `TlsServer` kept its messages, transcript and secrets in objects of its own, made per connection, and nothing it allocated along the way could be released, since HMAC, HKDF and `aesKey` stored allocations of their own and so no arena scope and no `using a = arena()` block was allowed around them (NL2424). Measured over RFC 8448's AES-128-GCM handshake through `TlsRecordServer`, **52,808 bytes per handshake** (about 53 MB of RSS after a thousand); a key install left another 5,248, 10,496 for an answered KeyUpdate. A client opening connections in a loop grew a long-running server without bound — denial of service on attacker input. | **Closed** (N9's TLS memory stage). `TlsServer` allocates its buffers, transcript hashers, secret arrays (one of each hash's length per secret), HKDF scratch and ClientHello view once, and `restart` hands them to the slot's next connection; `TlsTcpServer` keeps one per slot. `receive` and `sign` run in `using a = arena()` blocks over `nish/crypto/hmac`'s `HmacSha256Scratch` / `HmacSha384Scratch` and `nish/crypto/hkdf`'s `HkdfScratch`, which compute in place; the record layer derives its keys in place and expands the AES schedule into the slot's own `AesKey` with `nish/crypto/aes`'s `aesKeyInto`, in an arena block too; the x25519 exchange, whose `x25519` answers a `Secret` it allocates, runs in `tlsExchange`, which takes only an object of numbers and so gets an arena scope of its own; the ClientHello is read as windows into the input, and every message is written into the output buffers in place, which `TlsRecordServer` seals from directly. Measured (`net_tls_memory`, `net_tls_record_refusals`): after the first handshake in a slot, **0 bytes per handshake** under AES-128-GCM (RFC 8448's, 1,000 handshakes, was 52,808), ChaCha20-Poly1305 (1,000 through one slot) and AES-256-GCM-SHA384 (1,000 accepted, handshaken and closed over loopback through `TlsTcpServer`), `Arena.mark()` exactly where the first left it each time; and **0 bytes per answered KeyUpdate** (was 10,496). Three allocations remain outside the blocks, none of them per handshake in a steady state: the input buffer doubles, once per slot, up to the largest message for a ClientHello longer than 2 KB; the `serverName` string is made when a client names a host other than the last one the slot saw — so clients that alternate between names make one each handshake, as long as the name, at most 64 KiB and in practice a DNS name's 253 bytes; and over QUIC the array the client's transport parameters are copied into, which `TlsServer` keeps and refills, grows when a client's are longer than any before it (N9's QUIC stage; a QUIC connection through a reused slot keeps 0 bytes, QUIC-3). A signature made with `tlsSignEcdsaP256` leaves `p256SignSha256`'s own allocations, which stores what it makes: measured over the carrier, 9,312 bytes a connection, the whole of the 9,376 a TLS connection over `TlsTcpServer` kept accept to close (#489). `TlsTcpServer.signP256` now signs in the pool's `TlsP256Signer`, which signs with `p256SignSha256Into` in a `P256SignScratch` made once and writes the DER into one of its own arrays, one per DER length from 8 to 72 bytes (`TlsServer.sign` takes the length from the array and stores what it computes, so the signature cannot be a temporary): **0 bytes a signature** (`net_tls_memory`: 1,000 connections accepted, signed by `signP256` and closed over loopback with `Arena.mark()` where the first left it, which fails on `tlsSignEcdsaP256`; and 300 `TlsP256Signer.sign` calls over three DER lengths, each `tlsSignEcdsaP256`'s bytes and none moving the mark). Over the carrier, `net_loopback`'s TLS and HTTP/1.1 connections keep 64 bytes each from accept to close, where they kept 9,376, in each of 20 runs: the 64 is the test program's own `Secret` copy of its key. `tlsSignEcdsaP256` stays, and keeps what it kept, for a caller that signs once. **What the slot costs instead.** The state a handshake used to allocate per connection is now allocated once per slot. Measured with `Arena.used()` on a fresh chunk, a `TlsServer` is 31,192 bytes (`Arena.used()` around the constructor) where it was 1,728 (most of it the ClientHello view's two 8 KiB duplicate bitmaps, the HKDF scratch and the transcript's six hashers; 80 of it the resumption master secret's two arrays, one per hash), and a `TlsRecordProtection` is 7,368 where it was 64 (its own HKDF scratch, both key sizes and both AES schedules), two of them per slot. Measured as resident memory over a pool of 400, a `TlsTcpServer` slot is about 136 KB where it was about 86 KB: about 50 KB more per slot, fixed, against the 52,808 bytes every handshake used to add. Over QUIC, which keeps one `TlsServer` per slot and `restart`s it for each connection the slot takes (`QuicConnection`'s `tlsSlot`, QUIC-3), each slot carries the same 29 KB more. `TLS_RECORD_MAX_KEY_UPDATES` (64) stays: it no longer bounds memory but still bounds the work a client can ask a connection for, at the interoperability cost RFC 8446 §4.6.3's lack of a limit implies (a client updating on a schedule of its own is refused at its 65th); lifting it is a separate decision. |
| TLS-4 | Low | `std/net/tls-tcp.ts` (`TlsTcpServer`) | The carrier has no clock: a client may hold a slot for as long as it keeps the TCP connection open, mid-handshake or idle, and once every slot is held new connections are accepted and closed at once (`TLS_TCP_POOL_FULL`). Memory stays bounded, since the pool never grows; availability does not. | **Open, the program's to decide.** The program owns the loop and `pollWait`'s timeout, so it closes slots that have gone quiet; a carrier-level idle timeout needs a clock argument the API does not take yet. |

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

**The one-shot derivations hold their secrets as `Secret`s.** A plain `u8[]`
handed to one is refused by the checker (`tests/cases/reject_secret_tls_plain_key`,
Argument 3 of `tlsHandshakeSecret`). `net_tls_rfc8448`, `net_tls_ext_hrr` and
`net_tls_ext_refusals` (in `f64` mode `net_tls_rfc8448_f64` and `net_tls_ext_f64`) reproduce every secret, key and IV
through the `Secret` forms and wipe each one they are answered. The check
`tls: the one-shot derivations' wipes survive opt -O2 (the early secret's zero salt and input, the derived salts, the master secret's zero input, finished_key)`
in `tests/wipes/tls.js` counts each derivation's own wipes after `opt -O2`.

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
as it was. A failed connection, or the carrier's slot close (`wipeKeys`),
wipes everything `TlsServer` still held, the exporter secret included
(`net_tls_record_refusals`); a key that does not install fails the connection
rather than leave a direction in the clear, and `seal` refuses application
data in the clear.

**Every key is wiped when the connection ends** (`tests/link/net_tls_wipes`,
and in `f64` mode `net_tls_wipes_f64`): a real handshake under each of the
three suites fills both directions and `TlsServer`, and then each end is
taken in turn. After `fail` on a record whose tag does not verify, whose
`bad_record_mac` the client opens under the write keys first, after the
client's own error alert, after a stream cut off without `close_notify`, and
after `abort`, every array of both
directions (both keys, the IV, every word of both AES schedules and both
words of H), both traffic secrets and every secret `TlsServer` holds read
zero. After `close` the resumption master secret reads zero at once and the
write direction once the `close_notify` is sealed, after the data it waited
behind when `output` was full, while the read direction still opens what the
client sends, until the client's own `close_notify` wipes it; the carrier's
slot close then wipes the rest, and over loopback
`TlsTcpServer.close` leaves every key of the slot zero. A program that drives
`TlsRecordServer` itself, without `TlsTcpServer`, calls `wipeKeys` after the
connection closes, as the carrier's slot close does: a clean close leaves the
exporter secret, which is the caller's to read, and the client Finished the
server expected in `TlsServer` until then. `TlsServer.restart` wipes every
secret array of both hashes, the CertificateVerify input's too, and
`TlsRecordServer.start` both directions' keys, IVs and AES schedules and both
traffic secrets, so that after the two, as a slot is handed its next
connection, all of them read zero. Before each end of an open connection (a
failure, a close, the slot close, a restart) each key, IV, round-key and H
array, both traffic secrets of the suite's hash and the resumption and
exporter secrets are read as not zero on its own, so that none of those wipes
is shown by an array that was empty; the failures before the handshake is
done check only that the slot holds something, and `TlsServer`'s handshake
arrays (its pool's secrets and scratch, the client Finished it expects) are
pinned by the `-O2` counts rather than by such a read. A handshake that fails before it is done leaves every key zero
too, whether aborted while it waits for the CertificateVerify signature or
refused with `decrypt_error` at a client Finished that does not verify; by
then the ephemeral key reads zero once the ServerHello is written, and the
handshake secret and the client's handshake secret once the flight is
signed. After a KeyUpdate the client asks to be answered, both traffic
secrets are the next generation written over the one they replace and the
next-secret scratch of both directions reads zero. The exchange's words, the
handshake secret and the ephemeral key read zero after a handshake, and so do
the client's handshake and application secrets `TlsServer` handed over; the
exchange's words read zero after an exchange refused for a low-order share.
On `ab9099e`, before the stage, 39 of these 98 checks fail; each wipe the
read-backs pin was also deleted in turn, on this stage's head, to show a
read-back or an `-O2` count fail. The check `tls: the
wipes survive opt -O2 (both directions' keys, IVs and AES schedules; the
traffic, handshake, exporter and resumption secrets; the exchange's words)`
(`tests/wipes/tls.js`) counts each of those wipes after `opt -O2`, exactly,
per root, and each was deleted in turn to show its root's count drop. Its
roots include the handshake's own wipes: the nonce `TlsRecordProtection.open`
wipes, the master secret `TlsServer.sign` wipes, the handshake secret
`handleFinished` wipes, the last connection's traffic keys
`TlsRecordServer.start` wipes, and the ephemeral key, the handshake and
client handshake secrets and the client's application secret
`TlsRecordServer.advance` wipes.

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
