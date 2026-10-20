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
the connection (#430's TLS stage, below), and since #674's secret-fields
stage every one of them is a `Secret` field, which nothing outside `expose`
reads (below). One Low finding is left open, as CLAUDE.md §Security
requires: TLS-4, the carrier's missing timeout (T2's result, below). TLS-1
is closed.

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
handshake left, is closed. TLS-5 is closed too (below).

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
`tlsFinishedVerifyData` takes its base key as one. Each secret parameter is
typed `Secret<u8[]>`, so the checker refuses a plain array there
(`reject_secret_tls_plain_key`). Each reads a key only inside
`exposeWith` and wipes, with `wipe`'s volatile store, what it derives on the
way: the zero salt and input of the early secret, the "derived" salts, the
master secret's zero input and `finished_key`; HMAC and HKDF wipe their own
key blocks (`std/crypto/hmac.ts`). The `Secret` a derivation answers is the
caller's to wipe, and the checker refuses a function that neither returns nor
wipes one it made. TLS-1 is narrowed to the secrets an open connection keeps
in fields.

**#674's secret-fields stage.** Those fields are `Secret`s now. `TlsServer`
holds the ephemeral key as a readonly `Secret<u8[]>` field that `restart`
copies the caller's key into, wiping the caller's array, and its handshake,
traffic, exporter and resumption secrets, and a resumed handshake's PSK,
early secret and binder key, in two `TlsSecretPool`s, one per hash, whose
ten secrets are readonly `Secret` fields; a bitmask, `held`,
says which are derived, where `null` pointers into the pools did. Its
`readSecret` and `writeSecret`, which answered a traffic secret as a plain
array, are gone: a carrier asks `readKnown` and `writeKnown` and reads the
secret through `expose`. `TlsRecordServer` keeps the traffic secrets for
KeyUpdate in four readonly `Secret` fields, one per direction and hash, that
KeyUpdate ratchets in place. Each holder's `wipe()` wipes every one, which
the checker proves (NL2541), and the checker refuses binding one to a local
(`reject_secret_field_tls_read`), handing it to `console.log`
(`reject_secret_field_tls_log`) or replacing it (`reject_secret_field_tls_store`).
`TlsTcpServer` no longer keeps a copy of each slot's ephemeral key. TLS-1 is
closed.

**TLS-5** (Low) was found in review of the resumption design: every
ChaCha20-Poly1305 seal and open left a copy of its key in ChaCha20 state that
nothing wiped. #639 closed it.

**Resumption** is built: `TlsServer`, `TlsRecordServer` and `TlsTcpServer`
issue a ticket after a full handshake and resume with `psk_dhe_ke`.
"Resumption" below records the threat model, the ticket-key and anti-replay
decisions, the fallback and abort table, and, under "Properties verified:
resumption", what the tests pin and where the code departs from the design.

## Scope

| File | Functions |
| --- | --- |
| `std/net/tls.ts` | `TlsServer` (`restart`, `receive`, `reserveInput`, `reserveOutput`, `handleMessage`, `handleClientHello`, `chooseSuite`, `chooseAlpn`, `takeServerName`, `exchangeKeys`, `writeServerFlight`, `signatureInput`, `sign`, `handleFinished`, `fail`, `wipeResumption`, `enableTickets`, `ticketFits`, `selectTicket`, `bindTicket`, `saltFromEarly`, `resume`, `writeResumedFlight`, `writeResumedHello`, `masterSecretStep`, `resumptionPsk`, `writeTicket`, `issue`, `sent`, `takeOutput`, `clearOutput`, `secrets`, `known`, `readKnown`, `writeKnown`, `wipeSecret`, `wipeEphemeral`, `wipe`), `TlsSecretPool` (`zero`, `wipe`), `tlsExchange` and its `TlsExchangeWords`, `tlsServerStrikeProbe`, `tlsServerTicketCapacity`, `tlsSignEcdsaP256`, `tlsEcdsaDerSignature`, `TlsP256Signer` (`sign`), and the in-place DER writers both encoders share (`tlsEcdsaDerLength`, `tlsEcdsaDerInto`, `tlsDerIntegerLength`, `tlsDerIntegerInto`) |
| `std/net/tls/codec.ts` | `tlsReadClientHello` into a `TlsClientHelloView` and its readers (`tlsRead*`, `tlsReadServerName`, `tlsReadKeyShare`, `tlsReadAlpn`, `tlsReadExtension`, `tlsMarkSeen`), `tlsParseClientHello`, the six `tlsWrite*` writers with their `tlsEncode*` wrappers, and `tlsWriteCertificateVerifyContent` / `tlsCertificateVerifyContent` |
| `std/net/tls/schedule.ts` | the key schedule (`tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExpandLabel`, `tlsExtract`, `tlsFinishedVerifyData`, `tlsTrafficKey`, `tlsTrafficIv`), its in-place forms (`tlsDeriveSecretInto`, `tlsMasterSecretInto`, `tlsFinishedVerifyDataInto`, `tlsTrafficKeysInto`) and `TlsTranscript` |
| `std/net/tls/record.ts` (T2) | `tlsRecordLength`, `TlsRecordReader`, `TlsRecordProtection` (`install`, `reserve`, `derive`, `clear`, `nonceInto`, `seal`, `open`), `tlsNextTrafficSecret` |
| `std/net/tls/record-server.ts` (T2) | `TlsRecordServer`: `receive`, `process`, `handleRecord`, `handleChangeCipherSpec`, `handleHandshake`, `handleApplicationRecord`, `handleAlert`, `handlePostHandshake`, `updateReadKeys`, `advance`, `pump`, `sendKeyUpdate`, `keyUpdate`, `read`, `write`, `close`, `sealClose`, `sign`, `resume`, `issue`, `end`, `checkTruncation`, `abort`, `fail`, `wipeKeys`, `wipe`, `wipeTraffic`, `wipeRead`, `wipeWrite` |
| `std/net/tls-tcp.ts` (T2) | `TlsTcpServer`: `accept`, `readable`, `writable`, `flush`, `read`, `write`, `sign`, `signP256`, `enableTickets`, `resume`, `issue`, `keyUpdate`, `close` |

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
| TLS-1 | Low | `std/net/tls.ts` (`TlsServer`'s fields while a connection is open, and `TlsSecretPool`); `std/net/tls/record-server.ts` (the traffic secrets `TlsRecordServer` keeps for KeyUpdate); `std/net/tls/schedule.ts` and `std/net/tls/record.ts` (the one-shot derivations, for what a `Secret` cannot reach) | *Rewritten by #674's secret-fields stage; it names functions rather than lines.* **What it was.** While a connection was open its secrets lived in plain `u8[]` fields, since a `Secret` could not be one (NL2430, lifted by `nish:secret`'s `Secret` fields): the caller's ephemeral key until the ServerHello is written, the traffic secrets each direction keeps for KeyUpdate, the exporter secret for the caller, and the resumption master secret; `readSecret` and `writeSecret` answered a traffic secret as a plain array that a carrier could keep or print, and `TlsTcpServer` kept its own copy of each slot's ephemeral key. They were wiped (#430's TLS stage), but nothing but review kept a copy from leaving them. **What it is.** Every one is a readonly `Secret<u8[]>` field, set once in its holder's constructor and read only as an argument of `expose`, `exposeWith` or a function that takes a `Secret`: `TlsServer.ephemeral`, into which `restart` copies the caller's key before it `secureZero`s the caller's array; the ten secrets of each `TlsSecretPool` (`handshake`, `clientHandshake`, `serverHandshake`, `clientApplication`, `serverApplication`, `exporter`, `resumption`, and a resumed handshake's `psk`, `early` and `binderKey`), one pool per hash, with the bitmask `held` saying which a connection has derived; and `TlsRecordServer`'s `readTraffic256`, `readTraffic384`, `writeTraffic256` and `writeTraffic384`, which an install copies the traffic secret into, KeyUpdate ratchets on a clone it writes back in place, and `readHash` and `writeHash` select. `readSecret` and `writeSecret` are gone, a carrier asking `readKnown` and `writeKnown` and installing a key from the pool's field through `expose`, and `TlsTcpServer.keys` is gone. The checker refuses binding a field to a local (NL2544, `reject_secret_field_tls_read`), handing it to `console.log` (NL2432, `reject_secret_field_tls_log`) and replacing it outside the constructor (NL2181, `reject_secret_field_tls_store`), and refuses a holder whose `wipe()` can leave one unwiped (NL2541): `TlsSecretPool.wipe`, `TlsServer.wipe` (the ephemeral key and both pools) and `TlsRecordServer.wipe` (its four traffic secrets, both directions' keys, and `TlsServer.wipe`), which `wipeKeys` calls. Each field is zeroed through `exposeWith` once the carrier has what it needs from it, at the points #430's TLS stage set: the ephemeral key once the ServerHello is written (a hello that offers a ticket waits for `resume` first, so the key is kept until the ServerHello that answers it, resumed or in full), the handshake secret and the client's handshake secret once the flight is signed, the server's handshake and application secrets once its write keys are installed, the client's application secret once its read keys are, the resumption master secret on `close` (with tickets on, once `issue` has sealed the ticket or at once when none is wanted: Properties verified: resumption), the write direction once its `close_notify` is sealed and the read direction once the client's arrives; and every way the connection fails — `fail` (after the alert is sealed), the client's own error alert, a stream cut off without `close_notify`, `abort` — and the carrier's slot close (`wipeKeys`, which `TlsTcpServer.close` calls) wipe both directions' keys, the four traffic secrets and everything `TlsServer` holds (TLS-2 says what a direction holds). `restart` and `TlsRecordServer.start` wipe what a slot's last connection left before the next is handed it. The one-shot derivations are as #430's secret-boundary stage left them: `tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExtract`, `tlsExpandLabel`, `tlsFinishedVerifyData`, `tlsTrafficKey`, `tlsTrafficIv` and `tlsNextTrafficSecret` take and answer every secret as a `Secret<u8[]>` (`reject_secret_tls_plain_key`), the in-place forms `TlsServer` uses (`tlsDeriveSecretInto`, `tlsMasterSecretInto`, `tlsFinishedVerifyDataInto`) run on a clone `expose` hands them inside an arena, which the caller `secureZero`s once the answer is copied into its field, and so does `TlsRecordServer`, installing and ratcheting a direction's keys with `TlsRecordProtection.install` and `advance` on a clone it `secureZero`s before the arena block ends. It does not use `installHeld` and `advanceHeld`: the `*Held` derivations under them cannot run inside an arena block (`std/crypto/hkdf.ts`), so every install would leave its HKDF temporaries in the arena, which `net_tls_memory`'s `Arena.mark()` checks refuse. The ECDHE secret and the exchange's copy of the ephemeral key are `Secret`s `tlsExchange` wipes on every path, and `TlsExchangeWords` is wiped whole by `exchangeKeys`. **What is left.** What any `Secret` leaves (docs/LANGUAGE.md, "Secrets"): a key's bytes in registers and stack spills while HMAC, HKDF and AEAD run on it, and a copy a caller takes out with `expose`, which is the caller's own. Beside those, std keeps one plain copy of its own: on every install and every KeyUpdate, `TlsRecordServer`'s live traffic secret exists as a plain `u8[]` clone in the arena for the span of one HKDF and install, which `tlsInstallHeld` and `tlsAdvanceHeld` `secureZero` before their arena block ends, on the failure return too. The `-O2` check pins that wipe only transitively, through `TlsRecordServer.advance` and `updateReadKeys` (690 and 30 in `tests/wipes/tls.js`; `advance` was 561 before the server-resume stage, which added 66 through two new call sites, the NewSessionTicket's `sealQueue` in `pump` (65) and `wipeResumption` (1), and 63 through callees growing, `TlsServer.wipe` from 19 to 25 and `wipeSecret` from 9 to 12, each reached seven times: counted from the `-O2` IR by substituting the old callee counts, since deleting a pool's wipe is refused by NL2541), since the two wrappers have no root of their own. The expected client Finished and the CertificateVerify input are what the wire carries and stay plain, and `TlsSecretPool.wipe` zeroes them too. **Tests.** `tls: the wipes survive opt -O2 (both directions' keys, IVs and AES schedules; the traffic, handshake, exporter and resumption secrets; the exchange's words; a resumed handshake's PSK, early secret, binder key and salt)` and `tls: the one-shot derivations' wipes survive opt -O2 (the early secret's zero salt and input, the derived salts, the master secret's zero input, finished_key)` in `tests/wipes/tls.js` count each wipe after `opt -O2`; `link/${name}: exits with ${wantCode} and stdout matches expected.out` for `net_tls_wipes` and `net_tls_wipes_f64` reads each field back as zero through `expose` after each of those ends, for `net_tls_rfc8448` `TlsServer.fail`'s and for `net_tls_memory` `restart`'s; `` ${name}: rejected with ${needles.map((n) => `"${n}"`).join(", ")} `` (in `tests/run.js`) for `reject_secret_field_tls_read`, `reject_secret_field_tls_log` and `reject_secret_field_tls_store`. | **Closed** by #674's secret-fields stage: every secret an open connection keeps is a `Secret` field its holder's `wipe()` provably reaches, and nothing outside `expose` reads it; what is left is what every `Secret` leaves. |
| TLS-2 | Low | `std/net/tls/record.ts` (`TlsRecordProtection`: `clear`, `derive`), `std/net/tls/record-server.ts` (`TlsRecordServer`: `fail`, `handleAlert`, `checkTruncation`, `abort`, `sealClose`, `wipeKeys`) | *Rewritten by #430's TLS stage; it names functions rather than lines.* **What it was.** A direction's key, IV and AES key schedule live in its fields, since per-record keys cannot be a `Secret` under today's `expose`: sealing writes the output buffer (NL2450) and the AES kernels are C (NL2448). The key and IV were wiped with `secureZero`, but the schedule is `u64` words, which `secureZero` does not take, and was zeroed with ordinary stores, and `aesKeyInto`'s working copy of it with stores the optimiser could drop since nothing read them again; and a connection that failed kept both directions' keys and traffic secrets until its slot was closed or reused. **What closes it.** `clear` wipes each schedule with `aesKeyWipe` (`nish/crypto/aes`, #639): one volatile `wipe` of the whole of `roundKeys`, the runtime kernels' powers of H after the schedule included, and one of H; the key and IV stay `secureZero`'d. `aesKeyInto` wipes its own working copies since #639 (AEAD's record). A direction is cleared when it is installed again, and `TlsRecordServer` now clears both, with both traffic secrets it keeps, at every end: once the fatal alert `fail` sends is sealed, when the client sends an error alert of its own, when the client's stream is cut off without `close_notify`, on `abort`, when the slot is closed (`wipeKeys`) or handed its next connection (`start`); and the write direction alone once the server's `close_notify` is sealed (`sealClose`), since it is the last record the server writes, while the read direction stays for what the client may still send, until the client's own `close_notify`, after which nothing is read, wipes it (`handleAlert`). `derive` writes the key and IV straight into place in the direction's own HKDF scratch, which is wiped after each derivation. `seal` and `open` copy the record's plaintext into arrays their scope releases, unwiped: application data, not keys; the per-record nonce is wiped with `secureZero` on every path. Pinned by `net_tls_wipes` and `_f64` (every array of both directions read back as zero after each end, kernel tail and H included) and by the check `tls: the wipes survive opt -O2 (both directions' keys, IVs and AES schedules; the traffic, handshake, exporter and resumption secrets; the exchange's words; a resumed handshake's PSK, early secret, binder key and salt)`, where `clear` reaches 7 volatile wipes and 3 with ordinary stores in place of `aesKeyWipe`. | **Closed** (#430's TLS stage). |
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

**The one-shot derivations hold their secrets as `Secret`s.** Each secret
parameter is typed `Secret<u8[]>`, so the checker refuses a plain array there
(`tests/cases/reject_secret_tls_plain_key`, Argument 3 of `tlsHandshakeSecret`). `net_tls_rfc8448`, `net_tls_ext_hrr` and
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
read-back or an `-O2` count fail. The check `tls: the wipes survive opt -O2 (both directions' keys, IVs and AES schedules; the traffic, handshake, exporter and resumption secrets; the exchange's words; a resumed handshake's PSK, early secret, binder key and salt)`
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
socket failure, and frees every slot. With tickets on, `net_tls_resume`'s ten
`tcp:` checks take a full handshake through one slot of a `TlsTcpServer` to a
ticket `TlsTcpServer.issue` sends, resume a second connection accepted into
the restarted slot through `TlsTcpServer.resume`, unsigned and on identity 0,
refuse the same ticket a third time as a replay, and answer `resume` and
`issue` on a slot the carrier does not hold with `TLS_RECORD_DONE`.

## Properties verified: resumption

What the psk-wire (#673), ticket-seal (#680), server-resume and interop-resume stages pin, and
where the code departs from the design under "Resumption" below, which is
kept as written.

**Tests.** Each is a link test, named by the link loop's check
`` link/${name}: exits with ${wantCode} and stdout matches expected.out ``:
`net_tls_psk_wire` and `net_tls_psk_wire_f64` (the codec's half of the
fallback table and RFC 8448's resumption values), `net_tls_ticket` and
`net_tls_ticket_f64` (the seal, the open, the keys' rotation and the strike
register), and `net_tls_resume` and `net_tls_resume_f64`, 148 checks: rows 1
to 18 of the fallback and abort table, each with a negative case, and four
offers of two identities where the first is refused (rows 4, 5 and 6 then a
ticket that resumes, and a replay then none); the PSK, early secret, binder
key, salt, opened PSK and handshake secret read back as zero after rows 1 to
9 and 17, and the resumption master secret after rows 9 and 17 and once rows
2 to 7 are issued their tickets; the ephemeral key read back as zero once
the ServerHello is written, after a resumed run (row 1) and a
ticket-offering fallback (row 2), which keeping it on every ticket-enabled
or every resumed connection fails; every ServerHello's x25519 share, resumed,
a ticket-offering fallback or resumed after a HelloRetryRequest (row 15),
equal to the server's own public key and not the zero scalar's; `issue` pinned (a second call answers false and writes
nothing, `TLS_RECORD_TICKET` drops, a lifetime of 7200, the nonce `[0]`, a
`ticket_age_add` that differs across connections, and no ticket for a server
name over 255 bytes, whose resumption master secret is zeroed); a resumed
ClientHello with a low-order x25519 share failing with the salt zeroed;
`QUIC: enableTickets leaves tickets off`; 100 rounds through one restarted
slot, 90 resumed and 10 replays that fall back to a signed full handshake,
each issued a ticket, with `Arena.mark()` unmoved after the first fallback;
and twelve `tcp:` checks through `TlsTcpServer` over loopback (the carrier
paragraph above), the resumed and the fallback ServerHello's share among
them.
`net_tls_resume_bench` is the measurement.
`net_interop_server` and `net_interop_server_f64` run the interop server's
in-process checks, the HTTP/2 port's tickets among them, over loopback:
`tickets: a first connection is a full handshake, its Finished verified, and issued a ticket`,
`its ticket resumes the next connection, the server's Finished verified, and a new ticket issued`,
`the same ticket replayed falls back to a full handshake`,
`/close on the resumed connection: 200, its body, then GOAWAY`,
`and the server closes the connection`.
Then two rotation turns, each made by `rotateTickets` in `h2.ts`, the
function `run`'s own turn calls, after the caller's `wipe` of its previous key:
`a second full handshake under the first key is issued a ticket`,
`after one rotation turn, a ticket sealed under the first key resumes under the previous one`,
`and a full handshake after it is issued a ticket sealed under the second key`,
`after the second turn, a ticket sealed under the first key falls back to a full handshake`,
`and one sealed under the second key resumes under the previous one`.
Every ticket in them comes from a full handshake and is offered once, so the
second turn's refusal is the retired key's, not the strike register's. That
the retired key is wiped is not read back at run time: a `Secret` cannot be
read after its wipe, and the turn cannot leave it unwiped, since `previous`
cannot be assigned again while it holds an unwiped `Secret` (NL2442).
The rest of `run`'s rotation wiring in `cli.ts` is checked by reading only:
the `tlsTicketKeyDue` gate, `previous = current` before `rotateTickets`, and
the order of the keys passed to `step` (current, then previous). The checks
above call `rotateTickets` directly, and in CI the server never runs long
enough, or seals enough tickets, for `run` to rotate. The `-O2` wipe-count
pin on `ticketRotationTurns` (below) covers the rotation turn in
`tests/link/net_tls_ticket`, written against `std/net/tls/ticket.ts`, not the
interop server's.
The interop job's checks against curl and Chromium are in the paragraph
below.

**The saving.** `link/net_tls_resume_bench: a resumed handshake costs the
server under 0.85x a full one` reads the medians the bench prints over 41
interleaved rounds of a full handshake, a byte-identical copy of it and a
resumed one, each on a server whose random and x25519 key are drawn fresh.
Re-measured after the stage's first review round, nine runs, eight of them:
full 416–436 µs, its copy within 1.2% of it (the noise band), resumed
256–262 µs, 0.60–0.62x; the ninth, on a loaded machine, was slower in all
three arms alike (full 712 µs, resumed 452 µs, 0.63x). `psk_dhe_ke` still does
the x25519 exchange, and leaves out the certificate and the P-256 signature.
On the wire a full handshake is 854 bytes and a resumed one 637, both sides
and the NewSessionTicket counted.

**Wipes.** The resumption roots of `tls: the wipes survive opt -O2 (both
directions' keys, IVs and AES schedules; the traffic, handshake, exporter and
resumption secrets; the exchange's words; a resumed handshake's PSK, early
secret, binder key and salt)`: `nish.TlsServer.exchangeKeys` 6,
`masterSecretStep` 9, `sign` 17, `selectTicket` 20 (the opened PSK on each
refusal, and `tlsTicketOpen` under both keys), `bindTicket` 8 (the opened
PSK once it is in the pool; the plain copies of the PSK, early secret and
binder key; the PSK's and binder key's arms of `zero`; and the early
secret's and binder key's derivations, 1 each), `saltFromEarly` 1, `writeResumedHello` 3,
`resume` 72, `resumptionPsk` 1, `writeTicket` 10 (the issued ticket's PSK and
`tlsTicketSeal`'s 8), `issue` 11, `TlsServer.wipe` 25 (one for the
ephemeral key and twelve for each of the two `TlsSecretPool`s: its ten
secrets, the expected client Finished and the CertificateVerify input),
`restart` 29 and `fail` 6. Each was shown counted by deleting it and watching
its root drop, but one: without `resume`'s arm of `zero` for the early
secret, `opt` turns a `zero` it inlined elsewhere into a `nish_wipe` call and
`resume` still reads 72, so `net_tls_resume` reads that secret back as zero
after every row instead.

**Against curl and Chromium** (interop-resume, `.github/workflows/interop.yml`).
The interop server (`tests/link/net_interop_server`) turns tickets on for its
HTTP/2 port: `run` in `cli.ts` holds the current and the previous key in
locals, rotates them as Ticket keys says (it wipes the previous key, the
current one takes its place and `rotateTickets` draws the next), and lends both to each `step` (the
current one as both until the first rotation); the
slot's turn calls `TlsTcpServer.resume` on a ticket offer and
`TlsTcpServer.issue` once the connection is open, and logs `tls: full` or
`tls: resumed` once per connection. A GET of `/close` answers `closing` and
sends GOAWAY, so the next request has to open a new connection. The curl
job's step
`curl --http2 resumes a TLS 1.3 session`
runs the pinned curl (BoringSSL, without `--ssl-sessions`) once over two
`/close` URLs, so it keeps the first connection's ticket for the second, and
checks
`curl --http2 opens a new connection for the second /close`
(`num_connects` reads `1 1`; two URLs on one connection read `1 0`) and
`the server resumed curl's second connection`
(the log's new handshake lines are exactly `tls: full` then `tls: resumed`).
The chrome job's step
`Chromium resumes a TLS 1.3 session on a second connection`,
under both its certificates, runs `tests/interop/chrome-resume.py`: it reads
the certificate from the HTTP/2 port, checks its SHA-256 against the
server's `--hash-file`, waits for the server to log that read's handshake
and close, launches Playwright's Chromium with
`--ignore-certificate-errors-spki-list` set to the base64 SHA-256 of its
SubjectPublicKeyInfo, and navigates to `/close` twice; it passes only if the
server logged `tls: full` for the first navigation, then closed that
connection (a close line after that handshake's), and logged `tls: resumed`
for the second, and a wait on the log that runs out fails naming what never
came. The
verdict is the server's log in both jobs, not the client's. **Outcome:**
Chromium 141.0.7390.37 (Playwright 1.56.0) resumes under the SPKI pin, with
the minted certificate and with one openssl makes; so does curl 8.17 with
BoringSSL, and curl 8.5 with OpenSSL run by hand.

**As built.** Where the code departs from the design below:

- **`exchangeKeys` is 6, not 7.** Both salt `secureZero`s run on every
  handshake (What stays in memory).
- **The PSK, the early secret and the binder key are `TlsSecretPool`
  `Secret` fields** (`psk`, `early`, `binderKey`), so `TlsServer.wipe`
  reaches them as it reaches the rest of the pool (twelve secrets a pool,
  counting its plain arrays). The opened ticket's `TlsTicketState.psk` is a
  plain array, `secureZero`d once it is copied in or refused.
- **Two `TlsTicketState`s,** `opened` for the ticket being resumed and
  `issuing` for the one being sealed, so issuing never overwrites what a
  resumption read.
- **A local strike probe.** `tlsServerStrikeProbe` reads the register's chain
  for the id, bounded by `longest` as `take` is (#680), in `selectTicket`
  before the binder: a replayed ticket costs no HMAC. `take` still decides,
  after the binder.
- **A full register still calls `take`,** so the refusal is counted (row 7).
- **The `ticket_nonce` is one byte,** 0; `ticket_age_add` is drawn in
  `writeTicket`, when the ticket is sealed.
- **The previous key is a required parameter** of `resume`; a program with
  one key passes it as both.
- **`signature_algorithms` is checked late only when a ticket is offered**
  (row 14); without `pre_shared_key` the order is as before.
- **`TLS_NO_IDENTITY` is -1,** the index `answerHello` is given for a full
  handshake.
- **The resumption master secret is wiped early,** as the connection opens,
  when no ticket will be issued to it (no `psk_dhe_ke` in the client's modes,
  or a server name longer than a ticket holds), and otherwise by `issue`,
  not only on `close`.
- **The NewSessionTicket is sealed in `pump()`,** the record server's
  output step, after `issue` writes it.
- **`TlsTcpServer.resume` and `issue` answer `flush`'s interest,** and
  `TLS_RECORD_DONE` for a slot the carrier does not hold.
- **The bench's figure is recorded in `tests/run.js`,** beside its check,
  not in `tests/runtime-budgets.js`: it is a ratio, not a ceiling.
- **#680's seal wipes twice** (As built under Ticket keys), and **#680's
  `take` scans only to `longest`** (As built under Anti-replay).

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
decisions rather than make them. Each property names the test that pins it.
The psk-wire, ticket-seal and server-resume stages have landed, and what their
tests pin, with every place the code departs from the design, is under
"Properties verified: resumption" below; the design text is kept as written,
so a reader can see each departure against it. Names of files, functions and
tests are those the stages use, and RFC sections are RFC 8446's; the existing code it describes is as of commit b515c1b,
and its `file:line` anchors are at 394c439. What #652 and #665 changed when
`main` was merged at 4bbb392 is described as of 4bbb392, and each sentence
that says so names it.

Before the server-resume stage a `pre_shared_key` offer was checked for
being the last extension (§4.2.11) and otherwise ignored, so every connection
was a full handshake; `TlsServer` derived the resumption master secret all
the same, nothing read it, and since #652 the record layer wiped it when the
connection closed or failed (`TlsServer.wipeResumption`; TLS-1). It still
does, for a server that never calls `enableTickets`: with tickets off, an
offer is ignored as before.

### What the later stages add

| Stage | Files | What |
| --- | --- | --- |
| psk-wire | `std/net/tls/codec.ts`, `std/net/tls/schedule.ts` | `TlsClientHelloView` reads `pre_shared_key`'s identities and binders and `psk_key_exchange_modes`; `tlsWriteNewSessionTicket` and the ServerHello `pre_shared_key` writer; the PSK early secret, binder key, binder verify, the handshake-secret salt from the PSK early secret, and `tlsResumptionPsk`, in place; a one-shot form of any of them, for tests against RFC 8448's vectors, takes and answers `Secret<u8[]>` as #665's do |
| ticket-seal | `std/net/tls/ticket.ts` (new, `nish/net/tls/ticket`) | `tlsTicketSeal` and `tlsTicketOpen` over ChaCha20-Poly1305 under a borrowed `Secret` key; `TlsTicketKeyInfo`, `tlsTicketKeyDraw` and `tlsTicketKeyDue`; `TlsTicketStrikes`, the strike register |
| server-resume | `std/net/tls.ts`, `std/net/tls/record-server.ts`, `std/net/tls-tcp.ts` | `TlsServer`'s ticket hand-off states and resumed path, `TlsExchangeWords` gaining the salt's words; `TlsRecordServer` sends the NewSessionTicket; `TlsTcpServer`'s per-slot calls that lend the program's keys |
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
key id drawn beside it. The program owns its keys, not the module: it keeps
them where it chooses and lends them, as parameters, to the call that needs
them — the way `TlsTcpServer.signP256` borrows the
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

Pinned (#680) by `net_tls_ticket` and `net_tls_ticket_f64` (round trip, a flipped bit in each region,
expiry at each bound, retired and unknown key ids, the chain bound; a ticket
sealed under a live key with a lifetime over 7200 s, or a chain start after
its issue time, failing to open; a key past
its issue window refused by `tlsTicketSeal` and past 14 hours by
`tlsTicketOpen`; the seal cap, brought forward to 2 as `recordLimit` is for
KeyUpdate; `tlsTicketKeyDue` at the window's end and at the cap; and the
caller's rotation turn run three times, with a ticket under the previous key
opening until the turn after and failing to open then) and by the wipe-count
check `tls: the wipes survive opt -O2 (a session ticket's plaintext on seal and open, the PSK of a failed open, the rotation turn's keys)`
in `tests/wipes/tls.js`. Its roots are `tlsTicketOpen`, with two `secureZero`s (of the
plaintext, and of the state's PSK array on a failed parse); `tlsTicketSeal`,
with one, of the plaintext, and a second #680 added (As built, below); and the
test's rotation turn, `ticketRotationTurns`, pinned at its total, 55. Each wipe of open and seal is shown
counted on its own by deleting it and watching its root's count drop. The
rotation turn's `wipe(previous)` needs no deletion step: the checker enforces
it, since `previous` cannot be assigned again while the `Secret` it holds is
neither wiped nor returned (NL2442), so a turn without it does not compile;
its root shows only that the wipes survive `opt -O2`. Two more, under
"What stays in memory" below, are roots #652 already counts in
`tests/wipes/tls.js` at 4bbb392 (the check named, since the server-resume stage, `tls: the wipes survive opt -O2 (both directions' keys, IVs and AES schedules; the traffic, handshake, exporter and resumption secrets; the exchange's words; a resumed handshake's PSK, early secret, binder key and salt)`), whose counts move:
`nish.TlsServer.exchangeKeys`, which counts `tlsExchange`'s wipes, now at 6
(What stays in memory), and `nish.TlsServer.sign`, whose master-secret wipe moves to a new root
beside it, the master-secret step `TlsServer.masterSecretStep`, run once the
server Finished is sent. `tlsTicketKeyDraw` is not a root: it moves the drawn array into a
`Secret` (NL2445) and has nothing of its own to wipe. The count shows that each
wipe exists and survives `opt -O2`; it matches calls, not paths, so that the
wipe is reached on every path is for review to check. Each of open and seal
wipes its plaintext once, at a point every path reaches — after the branch on the tag and on the parse, as
`chacha20Poly1305Open` wipes its state once after its branch — not once on
each path: `opt -O2` merges a wipe placed on each of two paths into one
store, and the count could then not see either go missing
(`tests/wipes/crypto.js`).

**As built (#680).** `tlsTicketSeal` wipes its plaintext twice, not once. The
function it hands `exposeWith`, `tlsTicketSealExposed`, takes the key id,
nonce and plaintext in one array, copies the plaintext out of it for
`chacha20Poly1305Seal`, and wipes that copy with `wipe` (a `secureZero` is C,
which a function run inside `expose` may not reach); `tlsTicketSeal` then
`secureZero`s the array once, after the seal and its refusals, as designed.
Both are counted: `nish.tlsTicketSeal` is pinned at 8 (the two, and
`chacha20Poly1305Seal`'s own 6) and `nish.tlsTicketOpen` at 9 (its two, and
`chacha20Poly1305Open`'s own 7), and deleting any one of the four lowers its
root's count by 1.

A wiped `Secret` cannot be read again (NL2443) and the plaintext
is a local no object keeps, so the IR is where those wipes can be seen. The
check is a group in `tests/wipes/tls.js`, the TLS area's file in the harness
#639 added, beside the two groups #652 and #665 put there (4bbb392).

### Anti-replay

Tickets are single-use in each process (§8.1). `TlsTicketStrikes` is a strike
register of ticket ids, each kept until its ticket expires or one server
lifetime (7200 s) after it was recorded, whichever is sooner, so no entry
outlives `now` + 7200 s at its recording whatever its ticket says. The open
check (row 3) already refuses a ticket that claims more, so the clamp is a
second bound, held by the register itself: `TlsTicketStrikes.take(id,
expiresAt, now)` records `min(expiresAt, now + 7200 s)`, whatever it is
handed. An entry is held through its expiry inclusive and free strictly
after it, as a ticket opens while `now` is no later than issue time plus
lifetime. `take` answers true when it recorded the id, and false when the id
is still held (row 6) or no entry is free (row 7), the second counted as a
refusal for being full. The register is an open-addressed
table made once at the capacity the program gives (65,536 ids by default; a
12-byte id and an 8-byte expiry each, so about 1.3 MB), whose expired entries
are reused, and which never grows. Before `take` reuses an expired entry
on an id's probe chain it scans the rest of the chain for a live entry of the
same id, so an expired entry ahead of it cannot let the id be recorded twice.
**As built (#680),** that scan reaches only as far as the register's
`longest`, the farthest any id has been recorded from its home slot, and
stops at the first free slot from there: no entry of any id lies past
`longest`, so the guarantee holds, and a `take` costs the longest probe so
far rather than the capacity. The server's `tlsServerStrikeProbe` reads the
same chain, to the same bound, before the binder is checked (Properties
verified: resumption). The program owns it and lends it to the
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

Pinned by `net_tls_ticket` and `net_tls_ticket_f64` (replay refused; the register full refusing
and counting each refusal, and taking ids again once entries expire;
`TlsTicketStrikes.take` called directly with an expiry a week away: a second
`take` of the same id false at `now + 7200 s`, and true one nanosecond later;
`take` false and counted on a full register; a register of a few entries in
which an id's probe chain has an expired entry ahead of the id's live entry:
`take` of that id false, and the register holding one entry for it) and by
`net_tls_resume` and `net_tls_resume_f64` (each row of the fallback and abort
table below, rows 17 and 18 included, and over `TlsTcpServer` the same ticket
offered twice: the second a full handshake, one strike live).

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

What a leaked ticket key exposes. Resumption and impersonation last until its
tickets stop opening — at most 14 hours of awake time after the key was drawn
(The clock, above). The contents of tickets already recorded stay readable to
whoever holds the key's bytes, for good, and the bytes stay in the process
until the program's rotation turn wipes them: the second turn after the draw,
about 24 hours after it for a program that rotates at the end of each issue
window, and never for one that does not rotate (Lifetime, enforced, above). In
detail:

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
  `secureZero` once, after the branch on the tag and on the parse, so the one
  wipe covers every path, a failed parse's included. On a failed parse it
  also wipes the state's PSK array before it answers, so no partial copy
  stays. Sealing is the same
  shape the other way: the plaintext is built outside `expose` from bytes
  that are not a `Secret`, sealed by the function `exposeWith` runs, and wiped
  once, after the seal and its refusals. Both run in a `using a = arena()` block, so what they allocate
  is released once wiped (the 0 bytes per handshake below).
- **The opened PSK after the hand-off.** The hand-off call wipes the
  state's PSK array with `secureZero` before it returns, whatever it answers:
  an identity resumed (row 1), passed over (rows 4 to 8), or whose binder
  failed (row 9). Only on row 1 does the PSK go on, copied into a `Secret<u8[]>`
  field of its holder (`TlsServer`, or the hash's `TlsSecretPool`), set once
  in the constructor as the traffic secrets are (TLS-1); the holder zeroes it
  through `exposeWith` once the early secret is extracted, on failure, and in
  `restart`, and its `wipe()` must reach it (NL2541). A handshake that ends full therefore holds no PSK.
- **The PSK early secret and the binder key** are `Secret<u8[]>`
  fields of the same holder, made in place by the schedule's `Held`
  functions, which wipe their own scratch. Their caller, the hand-off call,
  zeroes the binder key through `exposeWith` once the binder is compared, verified or not, and
  `TlsServer` wipes the PSK early secret once the handshake-secret salt is
  derived from it, as `TlsServer.masterSecretStep` wipes the master secret once its secrets are
  out, and on failure and in `restart`. The binder is compared in constant
  time, as the client Finished is.
- **The handshake-secret salt.** On a resumed handshake the salt the
  handshake secret is extracted under is `Derive-Secret(PSK early secret,
  "derived", "")` (§7.1): a secret of the connection, not the constant
  `TLS_DERIVED_SALT_*` a full handshake uses. It is derived in place outside
  `expose`, since Expand-Label may panic with a computed message, which a
  function run inside `expose` may not reach (NL2448). It reaches
  `tlsExchange` as words in `TlsExchangeWords` beside the ephemeral key, so
  the class stays numbers and the exchange keeps its own scope (TLS-3).
  `exchangeKeys` writes the salt's words, beside the key's
  (`std/net/tls.ts:1155-1163` at 4bbb392), and on a resumed handshake then
  wipes the derived salt's bytes with `secureZero`, before it calls
  `tlsExchange`; a full handshake's salt is the public constant, whose array
  is not wiped. The words
  need no wipe of their own: since #652 `exchangeKeys` wipes the whole of
  `TlsExchangeWords` with one `wipe`, a volatile store, after the branch on
  the exchange's alert, so a refused exchange leaves it zero too (4bbb392),
  and the salt's words are wiped with the key's by that store. `tlsExchange`
  reads the salt's words at its top, beside the key's and before any of its
  returns (an `internal_error`, or `illegal_parameter` for a low-order
  share). The extract needs the
  salt as bytes, and the function `exposeWith` runs cannot wipe its argument
  (NL2450), so `tlsExchange` rebuilds the salt array from the words at its
  top, where it reads them, and wipes it with `secureZero` once, at a point
  every path reaches: the two early refusals set their alert rather than
  return, the extract runs only when no alert is set, and the wipe follows
  it, before the one return. A wipe before each return instead is one `opt
  -O2` may merge, as under Ticket keys. `tlsExchange` needs no flag to tell
  the two handshakes apart: the caller always writes the salt's words, the
  `TLS_DERIVED_SALT_*` constant's on a full handshake and the derived salt's
  on a resumed one, so `tlsExchange` always rebuilds the array, extracts
  under it and wipes it, and its one `secureZero` is unconditional. The
  constant moves out of `tlsHandshakeFromEcdhe256` and
  `tlsHandshakeFromEcdhe384` (`std/net/tls.ts:399`, `:403` at 394c439),
  which take the salt instead; wiping a public constant's copy costs one
  store.
- **The master secret.** A resumed handshake sends no Certificate or
  CertificateVerify, so it never runs `sign`, where a full handshake derives
  the master secret and wipes it (`tlsMasterSecretInto` to `secureZero(master)`,
  `std/net/tls.ts:1338-1384` at 394c439). That step is split out of `sign`
  into one method both paths call once the server Finished is sent, the
  master-secret step `TlsServer.masterSecretStep`. Before its `using
  arena()` block opens, it points `clientApplicationSecret`,
  `serverApplicationSecret`, `exporterSecret` and `expectedClientFinished`
  at the slot's arrays, as `sign` does today (`std/net/tls.ts:1303-1307` at
  394c439), so the derivations below write into the pool's `Secret` fields
  `TlsServer.wipe` reaches, not into ones the block releases. Then, in order, as `sign` does
  today, it derives the master secret from the handshake secret; the client
  and server application traffic secrets ("c ap traffic", "s ap traffic") and
  the exporter secret ("exp master") from the master; and the expected client
  Finished from the client handshake secret. It then absorbs that Finished
  into the transcript, since the resumption master secret is taken over the
  transcript through the client Finished (§7.1), and derives the resumption
  master secret ("res master") from the master. Last, as in `sign`, it wipes
  the master with `secureZero`, on every path, and then sets
  `TLS_STATE_WAIT_FINISHED`, which the carrier's state-driven wipes of the
  handshake secrets key on. The
  handshake secret is wiped as today, by `handleFinished`, `TlsServer.wipe`
  and `restart`, which a resumed connection reaches as a full one does.
- **Issuing.** The resumption PSK for a NewSessionTicket is derived, sealed
  and wiped with `secureZero` before the record carrying it is sent; once its
  ticket is sealed, or at once on a connection that is issued none, the
  connection's resumption master secret is wiped too. A connection that
  fails or closes first — row 17, or a full handshake cut short — is wiped by
  `TlsRecordServer.wipeKeys`, which every failure and the slot close reach,
  through `TlsServer.wipe`; since #652 that wipes the resumption master secret
  (`TlsServer.wipeResumption`), and `close` wipes it at once (4bbb392).
  The PSK, the PSK early secret, the binder key and the resumption PSK are
  `Secret` fields of their holder, which `TlsServer.wipe` must reach (NL2541),
  so no path leaves one behind.
  Together that closes that part of TLS-1 for TLS over TCP.
- **Memory.** A resumed handshake through a reused slot leaves `Arena.mark()`
  where a full one leaves it, and so do a fallback's signature and `issue`'s
  ticket: 0 bytes per handshake (TLS-3).

Pinned by the wipe-count checks in `tests/wipes/tls.js`, seen in the IR since
no object keeps these arrays for a test to read: `tls: the wipes survive opt
-O2 (a session ticket's plaintext on seal and open, the PSK of a failed open,
the rotation turn's keys)` holds `tlsTicketOpen` at 9 and `tlsTicketSeal` at 8
(As built under Ticket keys), and `tls: the wipes survive opt -O2 (both
directions' keys, IVs and AES schedules; the traffic, handshake, exporter and
resumption secrets; the exchange's words; a resumed handshake's PSK, early
secret, binder key and salt)` holds `nish.TlsServer.exchangeKeys` at 6, not
the 7 the design expected (two more than its 5 at 4bbb392): its own
`secureZero` of the derived salt's bytes and the `secureZero` of
`tlsExchange`'s rebuilt salt array both run on every handshake, full or
resumed, and deleting either gives 5, so each is counted. The master-secret step
`TlsServer.masterSecretStep` is pinned at 9 and `nish.TlsServer.sign`, which
`opt` inlines it into, at 17, the master secret's `secureZero` shown counted
on its own by deleting it, as the open and seal wipes are. Each other
resumption root and its total is under Properties verified: resumption. And
by `net_tls_resume` and `net_tls_resume_f64` (the PSK, the PSK early secret, the
binder key, the salt's bytes and its words in `TlsExchangeWords`, the
handshake secret and the resumption master secret zero after a resumed
handshake, and the same arrays zero after
row 2, after row 3 (an expired ticket), after a row 4 to 8 fallback, after row
9 and after row 17 (the resumption master secret, which a fallback that
opens keeps for its own ticket, once rows 2 to 7 are issued theirs); a
resumed ClientHello whose x25519 share is low-order,
after which the salt's words in `TlsExchangeWords` and its bytes are zero; 0 bytes per resumed
handshake through a reused slot, and per replayed one that falls back to a
signed full handshake, each issued its ticket).

### Fallback and abort table

What the server does with each ClientHello that offers `pre_shared_key`, and
the rule it rests on. The checks the server makes today come first, in their
order, but for the two a resumed handshake does not need, which row 14
decides after the identities are read and a selected identity's binder
decided: `signature_algorithms` present, and
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
`missing_extension`, as it is today without a ticket. A ClientHello that meets
rows 9 and 14 gets row 9's `decrypt_error`: whether the server authenticates
by certificate, and so whether row 14 applies, is known only once the binder
is decided, and a binder that fails is an abort §4.2.11 requires. Row 9 is the one place a ticket that
opened can fail a connection, and it tells the attacker that the identity
opened and was not recorded (§E.6). Tickets are in the clear in the
ClientHello, the attacker cannot seal one, and what it learns is whether a
ticket it saw is still unspent; the design accepts that. Over QUIC, rows 1 to
9, 17 and 18 are all a full handshake or today's handling, since its
connections never open a ticket, and rows 10 to 15 hold as over TCP, the
codec being shared. Of row 16, the first half holds over QUIC (the extension
is ignored); the second does not apply, since QUIC carries no TLS records and
its 0-RTT packets are the QUIC record's (`quic.md`), not this one's. A ClientHello with no `pre_shared_key` is handled as today,
but for `psk_key_exchange_modes`: the codec reads it from every ClientHello to
decide issuance, so a malformed one is row 13's `decode_error` with or without
`pre_shared_key`.

Pinned by `net_tls_psk_wire` and `net_tls_psk_wire_f64` (rows 10 to 13 as codec refusals, and a
malformed `psk_key_exchange_modes` in a ClientHello without `pre_shared_key`
as row 13's `decode_error`; RFC
8448 §3's NewSessionTicket and §4's resumption PSK, early secret and binder
byte for byte) and by `net_tls_resume` and `net_tls_resume_f64` (every row,
over `TlsRecordServer`, each with a negative case, and the same malformed
modes with no `pre_shared_key`, end to end).
