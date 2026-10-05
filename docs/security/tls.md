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
what each KeyUpdate leaves is bounded by a per-connection cap. On the carrier's path `TlsServer`'s traffic secrets, its handshake
secret and the caller's ephemeral key are wiped once the record layer has
what it needs from them, which narrows TLS-1 for TLS over TCP. Three findings
are open: TLS-2 (Low), the AES key schedule; TLS-3 (Low), the AES key
schedule `aesKey` leaves in the arena per key install; and TLS-4 (Low), no
timeout in the carrier.

**N9's result.** A handshake keeps its state in its slot: `TlsServer`'s
buffers, transcript, secrets and HKDF scratch are made once and `restart`ed
for each connection, and its steps run in `using a = arena()` blocks over
HMAC and HKDF with caller-owned scratch. A thousand ChaCha20-Poly1305
handshakes through one slot, or accepted and closed over loopback through
`TlsTcpServer`, leave `Arena.mark()` where the first left it; RFC 8448's
AES-128-GCM handshake leaves 4,544 bytes where it left 52,808, and all of
them are `aesKey`'s four schedules (`net_tls_memory`).

## Scope

| File | Functions |
| --- | --- |
| `std/net/tls.ts` | `TlsServer` (`restart`, `receive`, `reserveInput`, `reserveOutput`, `handleMessage`, `handleClientHello`, `chooseSuite`, `chooseAlpn`, `takeServerName`, `exchangeKeys`, `writeServerFlight`, `signatureInput`, `sign`, `handleFinished`, `sent`, `takeOutput`, `clearOutput`, `readSecret`, `writeSecret`), `tlsExchange` and its `TlsExchangeWords`, `tlsSignEcdsaP256`, `tlsEcdsaDerSignature` |
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
| TLS-1 | Low | `std/net/tls.ts` (`TlsServer`: the constructor's `ephemeralPrivate`, `handleClientHello`, `sign`, `handleFinished`), `std/net/tls/schedule.ts` (`tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExpandLabel`, `tlsExtract`, `tlsFinishedVerifyData`, `tlsTrafficKey`, `tlsTrafficIv`) | Secret material is not wiped once the handshake is done with it. `TlsServer` holds the caller's ephemeral x25519 key as plain bytes, because a `Secret` may not be a field (NL2430); it keeps the handshake secret, both handshake traffic secrets, both application traffic secrets, the exporter secret and the expected client `verify_data`, which its carrier reads; and the schedule's functions answer the early and master secrets, the "derived" salts, both `finished_key`s and every traffic key and IV as plain `u8[]`. All of them stay in arena memory until that memory is reused, and a later memory disclosure could read them. `handleFinished` wipes the handshake secret with `secureZero` and drops the server's reference to it. **What is wiped:** the copy of the ephemeral key the exchange runs on, and the ECDHE secret, are `Secret<u8[]>`s (`nish:secret`, #418) that `tlsExchange` wipes on every path, and the all-zero check and the handshake secret's extract run on the ECDHE secret only inside `expose`. The P-256 key `tlsSignEcdsaP256` signs with is the caller's `Secret`, borrowed, and `p256` wipes what it derives from it (ECC-2). **What N9 adds:** `tlsExchange` takes the ephemeral key and gives back the handshake secret as words in a `TlsExchangeWords` (an object of numbers, so that it gets an arena scope of its own, TLS-3); each word is zeroed by an ordinary store as soon as it is read, which stands because the words stay reachable from their `TlsServer`, and the handshake secret's bytes are wiped with `secureZero` once they are words. The in-place schedule wipes what it makes on the way — the master secret, the "derived" salt, both `finished_key`s — with `secureZero`, and its HKDF scratch after every step; and `restart` wipes every secret array a slot's last connection left before the next one is handed them. | **Open.** The primitive exists on `main`: `secureZero` (#417), a store no optimiser removes, for bytes that are not a `Secret`. Under the rolling freeze `std/` may call it once a release ships it; then `TlsServer` wipes its fields when the handshake ends or fails, the schedule's callers wipe what they are handed, and a test pins that the wipes survive `-O2`. **Narrowed by T2 for TLS over TCP:** `TlsRecordServer` calls `secureZero` on `TlsServer`'s caller-supplied ephemeral key once the ServerHello is written, or when the handshake fails or the slot is closed, on the handshake secret and the client's handshake secret once the flight is signed, on the server's handshake and application secrets once its write keys are installed, and on the client's application secret once its read keys are; when the connection fails or its slot is closed it wipes everything `TlsServer` still holds, the exporter secret and the expected client `verify_data` included. It keeps its own copies of the two application secrets for KeyUpdate, overwritten in place by each update and wiped when the slot is closed or reused. What stays is the exporter secret while the connection is open, for the caller, and the schedule's intermediate answers (`net_tls_record_rfc8448` and `net_tls_record_refusals` check the wipes). Follow-up: #430, which moves the TLS and QUIC key-holding structs onto `nish:secret`. |
| TLS-2 | Low | `std/net/tls/record.ts` (`TlsRecordProtection`: `clear`, `derive`) | A direction's key, IV and AES key schedule live in its fields, since a `Secret` may not be one (NL2430). The key and IV are wiped with `secureZero` when the direction is installed again, cleared, or its slot closed (`TlsRecordServer.wipeKeys`); the schedule is `u64` words, which `secureZero` does not take, and is zeroed with ordinary stores, which stand because the schedule stays reachable for the next key. `derive` writes the key and IV straight into those fields, in the direction's own HKDF scratch, which wipes its last output block and both keyed HMAC hashers before each derivation returns (the pad blocks and digests on the way with `secureZero`, the hash words with stores that stand because the scratch stays reachable), and whatever else the derivation allocated is released by its arena block — unwiped, since a release frees without zeroing, but none of it key material once the scratch is wiped. What remains is the schedule `aesKey` answers, which `derive` copies and zeroes with stores the optimiser may drop since nothing reads them again, and which stays in the arena (TLS-3): it is derived from the traffic secret, so a later memory disclosure could read key material from it. `seal` and `open` copy the record's plaintext into arrays their scope releases, also unwiped: application data, not keys. The per-record nonce — the IV XOR a public sequence number, so as good as the IV — is wiped with `secureZero` in both, on every path after it is built. | **Open.** Follow-up: #430, which moves the TLS and QUIC key-holding structs (these keys, held in a struct across calls, among them) onto `nish:secret`. `secureZero` for a `u64[]`, or an AES key held as bytes, would close the schedule, and an `aesKey` that fills a caller's `AesKey` would leave no copy (TLS-3). HKDF and HMAC now wipe their own state when run over a scratch, which closes the derivation's other temporaries. |
| TLS-3 | Low (was Medium) | `std/net/tls/record.ts` (`TlsRecordProtection.derive`), through it `std/net/tls/record-server.ts` (`advance`, `pump`, `handlePostHandshake`, `sendKeyUpdate`) | **What it was.** Each handshake left arena memory behind until the program reset the arena: `TlsServer` kept its messages, transcript and secrets in objects of its own, made per connection, and nothing it allocated along the way could be released, since HMAC and HKDF stored allocations of their own and so no arena scope and no `using a = arena()` block was allowed around them (NL2424). Measured over RFC 8448's handshake through `TlsRecordServer`, **52,808 bytes per handshake** (about 53 MB of RSS after a thousand), and a key install left another 5,248 — a client opening connections in a loop grew a long-running server without bound. **What it is now.** `TlsServer` allocates its buffers, transcript hashers, secret arrays (one of each hash's length per secret), HKDF scratch and ClientHello view once, and `restart` hands them to the slot's next connection; `TlsTcpServer` keeps one per slot. `receive` and `sign` run in `using a = arena()` blocks over `nish/crypto/hmac`'s `HmacSha256Scratch` / `HmacSha384Scratch` and `nish/crypto/hkdf`'s `HkdfScratch`, which compute in place, so the compiler has proved that what a step allocates dies with it; the x25519 exchange, whose `x25519` answers a `Secret` it allocates, runs in `tlsExchange`, which takes only an object of numbers and so gets an arena scope of its own; the ClientHello is read as windows into the input, and every message is written into the output buffers in place, which `TlsRecordServer` seals from directly. Measured (`net_tls_memory`): a thousand ChaCha20-Poly1305 handshakes through one slot, and a thousand accepted, handshaken and closed over loopback through `TlsTcpServer`, leave `Arena.mark()` exactly where the first left them — **0 bytes per handshake**; RFC 8448's AES-128-GCM handshake leaves **4,544 bytes**, every one of them the schedules `aesKey` answers for the four key installs (4 × 1,136). **What is left.** `aesKey` (`std/crypto/aes.ts`) answers its schedule in an `AesKey` it allocates and stores into, so no scope can be put around it: each AES key install leaves 1,136 bytes (AES-128) or 1,456 (AES-256), four per handshake and one or two per KeyUpdate; ChaCha20 leaves none. So a connection still takes at most `TLS_RECORD_MAX_KEY_UPDATES` (64) KeyUpdates from its client and refuses the next with `unexpected_message` (`net_tls_record_refusals` pins the 64th answered, each at most 4 KB, and the 65th refused), which bounds what a client can make one connection derive at 64 × 2,272 bytes. **The cap is a deliberate interoperability trade-off:** RFC 8446 §4.6.3 puts no limit on how many KeyUpdates a peer sends, so a conforming long-lived client that updates on a schedule of its own — by time, say, rather than once per 2^24 records — is disconnected with `unexpected_message` at its 65th; one that updates only when §5.5 requires it reaches the cap after 2^30 records. Three smaller allocations remain outside the blocks: the input buffer doubles, once per slot, up to the largest message for a ClientHello longer than 2 KB; the `serverName` string is made when a client names a host other than the last one the slot saw — so clients that alternate between names make one each handshake, as long as the name, at most 64 KiB and in practice a DNS name's 253 bytes — and over QUIC the client's transport parameters are copied, as a QUIC connection allocates per packet anyway (QUIC-3). A signature the caller makes with `tlsSignEcdsaP256` leaves `p256SignSha256`'s own allocations (about 1.8 KB), the caller's, outside this record. | **Open, narrowed to `aesKey`.** It closes when `nish/crypto/aes` can fill an `AesKey` the caller owns, as HMAC and HKDF now can — an edit to `std/crypto/aes.ts` this change was not authorised to make; then `derive` takes its whole body into the arena block, an AES handshake leaves nothing, and the KeyUpdate cap can go. Until then a server under AES suites that runs for very long still grows by 4,544 bytes a handshake, a little over 4.5 MB a thousand connections, against the 53 MB it grew before; ChaCha20 does not grow at all. |
| TLS-4 | Low | `std/net/tls-tcp.ts` (`TlsTcpServer`) | The carrier has no clock: a client may hold a slot for as long as it keeps the TCP connection open, mid-handshake or idle, and once every slot is held new connections are accepted and closed at once (`TLS_TCP_POOL_FULL`). Memory stays bounded, since the pool never grows; availability does not. | **Open, the program's to decide.** The program owns the loop and `pollWait`'s timeout, so it closes slots that have gone quiet; a carrier-level idle timeout needs a clock argument the API does not take yet. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding.

**RFC 8448 §3, byte for byte** (`tests/link/net_tls_rfc8448`, and in `f64`
mode `net_tls_rfc8448_f64`): every secret the trace prints — early, both
"derived" salts, handshake, both handshake traffic secrets, master, both
application traffic secrets and the exporter secret — and every traffic key
and IV; the ServerHello, EncryptedExtensions, Certificate, CertificateVerify
and Finished the server writes; the CertificateVerify input; and acceptance
of the trace's client Finished, fed whole and a byte at a time. The trace
signs with RSA-PSS, which the stack does not have and which is randomised, so
its signature is injected through the hand-off and every byte after it is
checked. The same server answering a ClientHello that offers only
`TLS_AES_256_GCM_SHA384` is checked against an independent Python model: its
ServerHello, all four traffic secrets, its Finished, and acceptance of the
model's client Finished, since RFC 8448 pins only the SHA-256 suite.

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
two hundred echoes over a socket move the arena by 0 bytes. A KeyUpdate
under an AES suite leaves `aesKey`'s schedule behind, at most 4 KB each and
64 of them a connection (TLS-3).

**A handshake keeps its state in the slot** (`tests/link/net_tls_memory`,
and under `f64` in `net_tls_memory_f64`). A thousand RFC 8448 handshakes
through one `TlsRecordServer` whose `TlsServer` is `restart`ed for each:
every ServerHello and flight record is the trace's, and each handshake after
the first leaves exactly what `aesKey`'s four AES-128 schedules leave, 4,544
bytes, where it left 52,808. A thousand ChaCha20-Poly1305 handshakes with a
P-256 leaf through one slot, their ClientHello padded past the first input
buffer so the first one grows it: every byte the recorded one, and
`Arena.mark()` unmoved after the first. A thousand connections over loopback
through `TlsTcpServer`'s pool — accepted, handshaken and closed — the same:
every byte the recorded one, `Arena.mark()` unmoved, every slot free after.
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
