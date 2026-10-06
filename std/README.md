# `std/` — the standard library

Nish modules written in Nish, for Nish programs to import. There is no magic
here and — with four exceptions, `threads.ts`, `collections.ts`, `map.ts` and
`secret.ts` — nothing the compiler knows about: a module in this directory is an ordinary Nish source file, compiled as part of
whatever program imports it, and subject to the same rules as `examples/` or
`src/` ([`docs/LANGUAGE.md`](../docs/LANGUAGE.md) is the style guide).

| Module | What it is |
| --- | --- |
| [`testing.ts`](./testing.ts) | a test runner: a `Suite` a program drives with straight-line assertions, printing the `PASS` / `FAIL` / `SKIP` lines the repository's own harness prints, and answering the exit code |
| [`text.ts`](./text.ts) | the string operations a program would otherwise write inline: `splitLines`, `splitWhitespace`, `trim` and its halves, `contains`, `replaceAll`, and `firstDifference` over two arrays of lines |
| [`json.ts`](./json.ts) | `jsonField(object, name)`: the value of one field of one flat JSON object, which is the shape the compiler's own `--json` diagnostics have. A reader and not a parser — it answers text, answers `null` for a field that is not there, and does not validate |
| [`pair.ts`](./pair.ts) | `Pair<A, B>`: an interface with `first` and `second`, for a function that answers two values from one call. A type and nothing else — the caller writes an object literal at the return — and for returning two values rather than storing them side by side |
| [`collections.ts`](./collections.ts) | the global `Map<K, V>` and `Set<T>`: insertion-ordered tables whose buckets carry a hash fingerprint beside the entry index and whose entries keep their full hash, so every `get`, `set`, `add`, `has` and `delete` is one probe. `get` is not a method here: its `V | undefined` never crosses a call, so the compiler lowers it to `probe` and, where the key was found, `valueAt`. Nor are `keys()` and `values()`: an iterator is not a value, so a `for...of` over one is lowered to `walkOpen`, `walkNext`, `keyAt` or `valueAt`, and `walkClose`, and a count of live walks defers compaction until no loop is walking the table. A program never imports it: naming `Map` or `Set` loads it, and the compiler emits what a module uses of it into that module ([`docs/wp32-map.md`](../docs/wp32-map.md), [`docs/LANGUAGE.md`](../docs/LANGUAGE.md#map-and-set)). Its `hashKey`, `sameKey` and `storedKey` are lowered by the compiler per key type |
| [`map.ts`](./map.ts) | `reserve(m, n)` and `getOrInsert(m, k, v)` for the global `Map`. Their bodies are the meaning, and what runs under Node: `reserve` does nothing, and `getOrInsert` is a `get`, and a `set` of `v` when the key was missing. Natively the compiler lowers every call in place — `reserve` to the table's `reserveSlots`, which grows the buckets once so that `n` entries fit without a rebuild, and `getOrInsert` to one `probe` and a `valueAt` or an `insertAt` through its answer — so, like `collections.ts`, it writes no `.ll` of its own ([`docs/wp32-map.md`](../docs/wp32-map.md) §9.2, [`docs/LANGUAGE.md`](../docs/LANGUAGE.md#map-and-set)) |
| [`secret.ts`](./secret.ts) | The source behind the builtin module `nish:secret`, and imported only by that name: `Secret<T>`, `secret`, `expose`, `exposeWith` and `wipe`. The bodies are the meaning; what makes a `Secret` one is the checker's, keyed on this file ([`docs/LANGUAGE.md`](../docs/LANGUAGE.md#secrets-nishsecret)). `wipe`'s body is written by the emitter, one volatile `llvm.memset`, and like `collections.ts` the module writes no `.ll` of its own |
| [`threads.ts`](./threads.ts) | `parallelMapInto(src, dst, f)` and `parallelReduce(src, f, identity)`: a function over every element of an array, on as many threads as the length is worth. Its bodies are the sequential meaning, which is what runs under Node; the compiler recognises the two templates by module and name, lowers the one loop in each onto `nish_parallel_range`, holds the function to the rules that make that safe, and compiles an importing program with `--threads` ([`docs/LANGUAGE.md`](../docs/LANGUAGE.md#data-parallelism-nishthreads)). `tests/link/par_*` are its programs |

## `nish/crypto` — the primitives under TLS 1.3

The first lanes of [WP34](../docs/wp34-hosting-cs.md) §5: K1's hashes, MACs and
key derivation, K2's and K3's AEADs, K4's key exchange, K5's signatures and
K6's certificates, in
pure Nish (decision S1), each module imported by its own specifier. Every one
is written from its specification, with two exceptions that keep their
upstream notice: `crypto/aes.ts`'s `ghashMul32` is adapted from BearSSL, and
`crypto/p256.ts`'s field and scalar arithmetic is ported from fiat-crypto
([`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)). Each reproduces its
specification's published vectors in its `tests/link/crypto_*` programs. The
performance gate compiles every module with no diagnostics under both
`--number-mode i32` and `f64`, and the hashes, HMAC, HKDF, X25519,
ChaCha20-Poly1305, AES-GCM, P-256 and X.509 also run their vectors in `f64`
(`crypto_*_f64`). SHA-1 is here too, for one non-security use (its row says
which), and does both.

Every module here was security-audited (#363); the records are in
[`docs/security/`](../docs/security/README.md), and how to report a
vulnerability is in [`SECURITY.md`](../SECURITY.md). Two limits hold across the
modules. **Lengths stop at 2^31 − 1.** No array built by `push` or `new Array`,
no array or string the runtime makes (a file read, a concatenation, a
template) and no string built by `join` can pass 2^31 − 1 elements or bytes
(K1-6, CG-3, closed), so `length` is right in both number modes, and the
one-shot functions below refuse a longer input as each row says. **Private
keys are `Secret`s.** `crypto/p256.ts`, `crypto/x25519.ts` and
`crypto/x509.ts` take and give a private key as a `Secret<u8[]>` from
`nish:secret`, compute on it only inside `expose`, and wipe every intermediate
the key reaches before they return, with a store the optimiser may not remove
(ECC-2, X509-7, closed). The other modules
take their keys as plain arrays and do not wipe them yet.

| Module | What it is | Reproduces |
| --- | --- | --- |
| [`crypto/sha256.ts`](./crypto/sha256.ts) | `sha256(data)`, and `Sha256`, a streaming hasher: `update(buf, off, len)` over a window of a `u8[]`, `copy()` for the hash of a prefix while the original keeps going, and `digest()`, a fresh 32-byte array. `SHA256_SIZE` and `SHA256_BLOCK`. `sha256` panics on an array longer than 2^31 − 1 bytes | FIPS 180-4 §6.2 |
| [`crypto/sha512.ts`](./crypto/sha512.ts) | SHA-512 and SHA-384 on one compression function: `sha512` and `sha384`, and the streaming `Sha512` and `Sha384` with `Sha256`'s three methods; digests of 64 and 48 bytes. `SHA512_SIZE`, `SHA384_SIZE` and `SHA512_BLOCK`. The one-shot `sha512` and `sha384` panic on an array longer than 2^31 − 1 bytes | FIPS 180-4 §6.4, §6.5 |
| [`crypto/hmac.ts`](./crypto/hmac.ts) | `hmacSha256` and `hmacSha384`, the streaming `HmacSha256` and `HmacSha384` (keyed in the constructor, then `update` and `digest`), and `hmacSha256Verify` / `hmacSha384Verify`, which compare a received tag with `timingSafeEqual`. The one-shot functions panic on a message longer than 2^31 − 1 bytes | RFC 2104, RFC 4231 §4 |
| [`crypto/hkdf.ts`](./crypto/hkdf.ts) | `hkdfExtractSha256` / `hkdfExtractSha384` (an empty salt is HashLen zeros) and `hkdfExpandSha256` / `hkdfExpandSha384`, which answer `null` for a length below zero or above 255 × HashLen, for an `info` longer than 2^31 − 1 bytes, and for a PRK shorter than HashLen. `hkdfExpandLabelSha256` / `hkdfExpandLabelSha384` are TLS 1.3's HKDF-Expand-Label, which QUIC uses too; the label is given without its `"tls13 "` prefix, and a length outside 0 to 255, a label outside 1 to 249 bytes, a context past 255 bytes or a secret shorter than HashLen panics, since each is the program's choice rather than the peer's | RFC 5869 §2, Appendix A; RFC 8448 §3 and RFC 9001 A.1 for the label |
| [`crypto/ct.ts`](./crypto/ct.ts) | `timingSafeEqual(a, b)`, which reads every byte whatever it holds, and `timingSafeEqualAt(a, aOff, b, bOff, len)` over two windows, which answers `false` for a window outside its array. Two lengths that differ answer `false` at once, because a length is public, and so does an array longer than 2^31 − 1 bytes | — |
| [`crypto/base64url.ts`](./crypto/base64url.ts) | `base64urlEncode(data)` and `base64urlDecode(text)`, unpadded. Decoding is strict, so every byte string has one spelling: a `=`, a character outside the alphabet, a length of 1 mod 4 or nonzero unused low bits answer `null`, as does a text longer than 2^31 − 1 bytes; `base64urlEncode` panics on such an array | RFC 4648 §5, §10 |
| [`crypto/sha1.ts`](./crypto/sha1.ts) | `sha1(data)`, a fresh 20-byte digest, and `SHA1_SIZE` and `SHA1_BLOCK`. **Not for security**: SHA-1 is broken for collisions, and it is here only because RFC 6455 §4.2.2's `Sec-WebSocket-Accept` is defined on it (`nish/net/websocket` is its importer). One-shot only; it panics on an array longer than 2^31 − 1 bytes. It came after the #363 audit and has no record in `docs/security/` | FIPS 180-4 §6.1 |
| [`crypto/x25519.ts`](./crypto/x25519.ts) | `x25519(scalar, u)`, the shared secret as a `Secret<u8[]>`, and `x25519Base(scalar)`, the public key, each from a `Secret<u8[]>` scalar, on ten 25.5-bit limbs in `i64`. Either answers `null` unless its arguments are `X25519_SIZE` (32) bytes; the scalar is clamped on a copy, which is wiped | RFC 7748 §5.2, §6.1, Wycheproof `x25519_test` |
| [`crypto/chacha20poly1305.ts`](./crypto/chacha20poly1305.ts) | `chacha20Poly1305Seal(key, nonce, aad, plaintext)`, which answers the ciphertext followed by the 16-byte tag, and `chacha20Poly1305Open`, which checks the whole tag before it decrypts anything and answers `null` for a message that does not authenticate. Beneath them `chacha20Block`, `chacha20`, `chacha20QuarterRound`, `poly1305` and `poly1305KeyGen`, and `chacha20HeaderMask`, QUIC's 5-byte header-protection mask. Every input of the wrong length answers `null` | RFC 8439 §2, RFC 9001 §5.4.4, Wycheproof `chacha20_poly1305` (all 325 cases) |
| [`crypto/aes.ts`](./crypto/aes.ts) | AES-128 and AES-256, bitsliced four blocks at a time with the Boyar–Peralta S-box circuit, so no table is read: `aesKey(key)` expands a 16- or 32-byte key into an `AesKey`, then `aesEncryptBlock`, `aesGcmSeal` / `aesGcmOpen` (tag last, checked in full before anything is decrypted; any non-empty IV) and `aesHeaderMask`. AES-192 is out of scope, and a wrong length answers `null`, as does an `AesKey` not made by `aesKey`; one whose H is zero opens nothing | FIPS 197, SP 800-38D, RFC 9001 §5.4.3, Wycheproof `aes_gcm` (all 316 cases; the 103 AES-192 ones check that the key is refused) |
| [`crypto/p256.ts`](./crypto/p256.ts) | ECDSA over P-256 with RFC 6979's deterministic nonces: `p256PublicKey(priv)` (65-byte uncompressed SEC1) from a `Secret<u8[]>` private key, `p256Sign` / `p256Verify` over a digest and `p256SignSha256` / `p256VerifySha256` over a message; a signature is `r` and `s`, 32 big-endian bytes each, not DER (`crypto/x509.ts`'s `x509DerSignatureRS` converts one). A malformed key, a point off the curve or an `r` or `s` out of range answers `null` or `false`, never a panic. ECDSA is malleable, and `p256Verify` accepts a high `s`: when `(r, s)` verifies, so does `(r, n − s)` | RFC 6979 A.2.5, Wycheproof `ecdsa_secp256r1_sha256`, `_sha256_p1363`, `_sha512` and `_sha512_p1363` |
| [`crypto/x509.ts`](./crypto/x509.ts) | DER, PEM and X.509 over P-256: `pemToDer` / `derToPem` (RFC 7468, padded standard base64, strict labels), `x509ParseP256PrivateKey` (SEC1 or PKCS#8, answering a `Secret<u8[]>`), `x509ParseCertificate` / `x509ParseChain` into an `X509Certificate`, `x509VerifySignature` (ecdsa-with-SHA256 under an issuer's key), `x509DerSignatureRS` (a DER ECDSA-Sig-Value as the `r || s` `crypto/p256.ts` takes), `x509MintSelfSigned`, the 1-to-14-day self-signed P-256 certificate WebTransport's `serverCertificateHashes` accepts, and `x509CertificateHash`, its SHA-256. DER is read strictly — non-minimal lengths and integers, indefinite lengths and trailing bytes answer `null`. `x509ParseCertificate` and `x509ParseChain` parse and do not validate: there is no path validation, no extension is read or exposed, and no clock is consulted. `pemToDer` refuses a file in which any block, of any label, is malformed. `x509MintSelfSigned` refuses a common name that is not UTF-8 or holds a NUL, and its key and serial must come from `crypto.getRandomValues`, which the module cannot call itself without refusing wasm32 (X509-6) | X.690, RFC 5280, RFC 7468, RFC 5915, RFC 5208 / 5958; certificates checked against OpenSSL |

Three rules hold across the modules:

- **A digest ends the computation.** After `digest()` on a hasher or an HMAC, a
  further `update` or `digest` panics rather than answering a hash over the
  padding, and so does a window outside its buffer. `Sha256.copy()` on a
  digested hasher panics too; `Sha512.copy()` and `Sha384.copy()` answer a copy
  that is itself spent, so any `update` or `digest` on it panics. Either way,
  copy *before* `digest` when the computation has to go on.
- **An all-zero X25519 result is returned, not refused.** It is what a
  low-order `u` gives, and RFC 7748 §6.1 leaves the check to the protocol.
  `nish/net/tls` makes that check (below); every other caller doing a key
  exchange must refuse an all-zero answer itself, with `timingSafeEqual`
  against 32 zero bytes, since the answer is a secret.
- **Constant time by construction, and verified where the check reaches.** No
  module branches on, or indexes by, a secret: comparisons OR the differences
  into one word and test it once, the ladder swaps with a mask and always runs
  255 steps, AES reads no table, P-256's window reads all sixteen entries and
  keeps one by mask, and base64url maps characters by arithmetic on range masks
  rather than a table. Every branch is on a length, a loop counter or a bit
  position. WP34 N6 checks that the machine code kept that shape:
  `tests/ct-asm.js` disassembles golden fixtures on x86-64 and aarch64 and
  refuses a branch, a call, a secret-addressed load, or a divide or square
  root of a secret (whose latency follows its operands) in them. It reads what
  `clang -O2` emits for each target's baseline CPU, and only the functions a
  fixture names: the fixtures are copies of each module's straight-line cores,
  so the module functions themselves, and every loop, rest on review.
  [`docs/security/ct-verification.md`](../docs/security/ct-verification.md)
  lists every secret-handling function no fixture reads. What it holds, per
  module, is what that module's header says:
  - `tests/cases/ct_asm_mac` pins the two loop shapes the others are built
    from, a full tag compare and a masked table read; `crypto/hmac.ts`'s
    verifiers compare in the first shape.
  - `tests/cases/ct_asm_k1_ct`: copies of `timingSafeEqual`'s loop at 32 and
    48 bytes and `timingSafeEqualAt`'s at a 16-byte window.
  - `tests/cases/ct_asm_k1_base64url`: the two character maps verbatim, and
    one encode group and one decode group. The length-driven loops, the
    decoder's store guard and the encoder's string building remain discipline.
  - `tests/cases/ct_asm_x25519`: X25519's field multiply, square, add,
    subtract and multiply by a24, its conditional swap, and one step of the
    Montgomery ladder, the check following each call into the field functions.
    The 255-step loop that drives the ladder, the inversion and the encodings
    remain discipline.
  - `tests/cases/ct_asm_chacha20poly1305`: Poly1305's key clamp, one block,
    the final reduction with `s`, and the tag compare. The ChaCha20 rounds and
    the loops that drive both halves remain discipline.
  - `tests/cases/ct_asm_aes`: one full bitsliced round, one GHASH multiply and
    the tag compare. Packing, the key schedule and the loops over blocks
    remain discipline.
  - `tests/cases/ct_asm_p256`: fiat's field multiply, square, add and
    subtract, its scalar multiply and its conditional move; the sixteen-entry
    table read by a secret digit; the complete doubling and addition; and one
    window step of the scalar multiplication (four doublings, the table read
    and an addition), the check following each call into the field functions.
    The 64-window loop, the table build, the inversions, the encodings and
    RFC 6979's nonce derivation remain discipline.

  The SHA-2 hashes and HKDF are additions, rotations and xors that branch
  only on lengths, and are not in a fixture either; nor is `crypto/x509.ts`,
  whose one secret, a private key, is base64-decoded by range masks and
  otherwise only copied and handed to `crypto/p256.ts`.

## `nish/net` — the protocol stack

The protocol lanes of [WP34](../docs/wp34-hosting-cs.md) §5, written on
`nish/crypto` (decision S2). Each module takes bytes and answers bytes:
randomness is an argument and nothing reads a socket or a clock, so a test
injects an RFC trace's values and replays it byte for byte. The carriers put
them on sockets: `net/tls-tcp` is the first, and the one module here that
reads one, and it still takes its randomness as an argument.

| Module | What it is | Reproduces |
| --- | --- | --- |
| [`net/tls.ts`](./net/tls.ts) | The server side of a TLS 1.3 handshake, ClientHello through the client's Finished. `new TlsServer(config, serverRandom, x25519Private)`, then `receive(level, buf, off, len)` with what the client sent, `takeOutput(level)` for what to send, and `signatureInput()` / `sign(signature)` for the CertificateVerify hand-off (`tlsSignEcdsaP256` signs for a P-256 key, DER-encoded). A `TlsServerConfig` names the certificate chain, the signature scheme, the ALPN protocols, whether the carrier is QUIC, the server's transport parameters, and extensions to pass through in EncryptedExtensions. The suites are `TLS_AES_128_GCM_SHA256`, `TLS_CHACHA20_POLY1305_SHA256` and `TLS_AES_256_GCM_SHA384` (in the client's order), the group x25519 (one HelloRetryRequest when the client offers it without a share), and `server_name`, ALPN and `quic_transport_parameters` are read; PSKs, 0-RTT, NewSessionTicket and client authentication are not. Every refusal is the alert to send — `receive` and `sign` answer 0 or a `TLS_ALERT_*` — never a panic, and a low-order x25519 share is refused | RFC 8446 §4, §7; RFC 8448 §3 byte for byte, and §5's transcript |
| [`net/tls/codec.ts`](./net/tls/codec.ts) | The handshake messages as bytes: `tlsParseClientHello` into a `TlsClientHello` (structure checked, an alert on a malformed or duplicated field), and `tlsEncodeServerHello`, `tlsEncodeHelloRetryRequest`, `tlsEncodeEncryptedExtensions`, `tlsEncodeCertificate`, `tlsEncodeCertificateVerify`, `tlsEncodeFinished` and `tlsCertificateVerifyContent`. The wire's constants: handshake and extension types, versions, the x25519 group, the two signature schemes, and the `TLS_ALERT_*` descriptions | RFC 8446 §4, RFC 6066 §3, RFC 7301 §3.1, RFC 9001 §8.2 |
| [`net/tls/schedule.ts`](./net/tls/schedule.ts) | The key schedule over SHA-256 or SHA-384: `tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExpandLabel`, `tlsFinishedVerifyData`, and `tlsTrafficKey` / `tlsTrafficIv` for a record layer. `TlsTranscript` is the running transcript hash, with HelloRetryRequest's `message_hash` rule. The suite constants and `tlsSuiteHashLength` / `tlsSuiteKeyLength` | RFC 8446 §4.4.1, §7.1, §7.3 |
| [`net/tls/record.ts`](./net/tls/record.ts) | The record layer (RFC 8446 §5): `TlsRecordReader` cuts a stream into records in a buffer allocated once, refusing a header of unknown type or a body past 2^14 + 256 bytes before the body is waited for; `TlsRecordProtection` is one direction, cleartext until `install(suite, secret)`, then `seal` and `open` a record into the caller's buffer — the nonce from the sequence number, the header as additional data, the inner content type and zero padding found without branching on the padding. `tlsNextTrafficSecret` is KeyUpdate's next secret. Every refusal is the alert, negated | RFC 8448 §3's nine records byte for byte; ChaCha20-Poly1305, AES-256-GCM-SHA384 and padding against Python's `cryptography` |
| [`net/tls/record-server.ts`](./net/tls/record-server.ts) | `TlsRecordServer`: a TLS 1.3 server over a byte stream, sans-IO, wrapping a `TlsServer` in records. `receive` the client's bytes, send `output[outputStart .. outputEnd)` and `consume` what was sent, `read` and `write` application data, `sign` when asked, `keyUpdate`, `close`; `interest()` answers what it wants next as `TLS_RECORD_*` bits. It adds the compatibility `change_cipher_spec`, alerts both ways, KeyUpdate both ways and on a schedule, a limit of `TLS_RECORD_IDLE_LIMIT` (16) records in a row that carry nothing, a cap of `TLS_RECORD_MAX_KEY_UPDATES` (64) KeyUpdates from the client, and fixed buffers per connection | RFC 8448 §3 replayed at every cut of the client's stream |
| [`net/tls-tcp.ts`](./net/tls-tcp.ts) | `TlsTcpServer`: TLS 1.3 over `nish:net` TCP for a program that owns its loop — a pool of `TlsRecordServer` slots sized at start-up, `accept(serverRandom, ephemeralPrivate)` into a free one, `readable` / `writable` when the loop says so, `signP256` with a `Secret` key, and `read`, `write`, `shutdown` and `close` answering as `nish:net`'s calls do. `accept` copies the server random and the ephemeral key into the slot, wipes the caller's key array, and refuses either with -22 when it is not 32 bytes. Every call answers the slot's interest, whose low two bits are `pollModify`'s events. Native only, as `nish:net` is | openssl s_client under all three suites and curl, from `tests/run.js`; RFC 8448 §3 over loopback from a Nish client |
| [`net/quic-packet.ts`](./net/quic-packet.ts) | QUIC version 1's packets (WP34 Q1). The variable-length integer (`quicVarintPush`, `quicVarintPushSized`, `quicVarintRead`, `quicVarintLength`, `quicVarintSize`); packet-number length choice and recovery (`quicPacketNumberLength`, `quicPacketNumberDecode`); the long and short headers (`quicLongHeader`, `quicShortHeader`, and `quicParseHeader` into a `QuicHeader`, whose `end` is where the next coalesced packet starts); the Initial secrets from the client's first DCID (`quicInitialSecrets`); the packet keys from a traffic secret (`quicKeys` into a `QuicKeys`, for AES-128-GCM, AES-256-GCM and ChaCha20-Poly1305) and a key update, its secret (`quicKeyUpdateSecret`) and the next generation's keys with the header-protection key kept (`quicKeysUpdate`); packet and header protection (`quicSealPacket`, and `quicOpenPacket` or its two halves `quicRemoveHeaderProtection` and `quicDecryptPacket` into a `QuicPacket`); and, for a connection that allocates nothing per packet (WP34 Q4), `quicParseHeaderInto` (windows, no copy), `quicPutLongHeader` / `quicPutShortHeader` / `quicVarintPut` in place, `quicSealInPlace`, and `quicUnprotectHeader` / `quicDecryptPayload`, which store only numbers into the `QuicPacket`; and the Retry integrity tag (`quicRetryIntegrityTag`, `quicRetryPacket`, `quicRetryVerify`). Every parse is bounds-checked against the datagram and answers a `QUIC_ERR_*` code rather than panicking: a truncated header, a clear fixed bit, another version (with its connection IDs read, for Version Negotiation), a connection ID over 20 bytes, a Length past the datagram, a packet too short to sample, a payload that does not authenticate, and reserved bits set in one that does; keys `quicKeys` did not make are `QUIC_ERR_KEYS`, a caller's error rather than a forgery. Long headers always carry a two-byte Length, so a header's size does not move with its payload, and `quicSealPacket` refuses a header whose Length or packet number disagrees with what it seals. The builders answer `null` for an argument out of range. Its Handshake and 1-RTT keys are not wiped yet ([QUIC-1](../docs/security/quic.md)) | RFC 9000 §16, §17 and Appendix A.1–A.3; RFC 9001 §5 and Appendix A.1–A.5 (client and server Initial, Retry, ChaCha20 short header) |
| [`net/quic-frame.ts`](./net/quic-frame.ts) | QUIC version 1's frames (WP34 Q2). `quicParseFrame` reads any frame of RFC 9000 §19, 0x00 to 0x1e, into a reused `QuicFrame`, leaving a CRYPTO or STREAM frame's data in the packet (`dataStart`, `dataLength`) and answering 0 or the transport error the RFC names: FRAME_ENCODING_ERROR for a truncated field, a length past the packet, an ACK range below zero, an offset past 2^62 − 1, a stream count past 2^60, an empty NEW_TOKEN or a bad NEW_CONNECTION_ID, and PROTOCOL_VIOLATION for a frame type spelled in more bytes than it needs. The writers (`quicPushAck`, `quicPushCrypto`, `quicPushStream`, `quicPushValue`, `quicPushStreamValue`, `quicPushStreamError`, `quicPushNewConnectionId`, `quicPushPathData`, `quicPushConnectionClose`, `quicPushNewToken`, `quicPushTypeOnly`, `quicPushPadding`) answer `false` rather than write a frame that would not parse; `quicCryptoOverhead` and `quicStreamOverhead` size a frame's header before it is written. `quicFrameAllowed` is §12.4's table of which frames each packet type carries, `quicFrameAckEliciting` §13.2's rule, and `QUIC_ERROR_*` the transport error codes of §20.1. RFC 9221's DATAGRAM frames (0x30, 0x31) are read too (WP34 Q4); every writer has a `put` form (`quicPutAck`, `quicPutStream`, …, `quicPutDatagram`) that writes in place into a caller's buffer before an end and answers the offset past it, which the `push` form calls, and NEW_CONNECTION_ID's ID and token are left in the packet as windows | RFC 9000 §12.4, §19, §20; RFC 9221 §4; RFC 9001 A.2's and A.3's frames |
| [`net/quic-conn-params.ts`](./net/quic-conn-params.ts) | Transport parameters (RFC 9000 §18): a `QuicTransportParameters` that starts at every default, `quicEncodeTransportParameters` (a parameter only when it is not its default) and `quicParseTransportParameters`, which refuses with TRANSPORT_PARAMETER_ERROR, naming the parameter, a parameter that does not frame, a known one sent twice, a varint-valued one that is not exactly one varint, a server-only one from a client, and every value §18.2 bounds. Unknown parameters are skipped. RFC 9221's `max_datagram_frame_size` is read and written too (WP34 Q4) | RFC 9000 §7.4, §18; RFC 9221 §3; RFC 9001 A.2's client parameters |
| [`net/quic-conn-ack.ts`](./net/quic-conn-ack.ts) | `QuicAckRanges`: the packet numbers one space received, as at most 32 disjoint ranges, for duplicate detection (`record`, `contains`) and for the ACK frame written from them (`pushAck`, or `putAck` in place). Past 32 ranges the lowest is dropped and a floor raised over it, below which every packet number reads as already received | RFC 9000 §12.3, §13.2, §19.3 |
| [`net/quic-conn-cid.ts`](./net/quic-conn-cid.ts) | `QuicCidTable`: the connection IDs a connection issued (routed by `ownsLocal`, retired by the peer with `retireLocal`) and the ones its peer issued (`addPeer`, with Retire Prior To retiring older ones into `retirePending`, and `currentPeer` the one sent to). A reused sequence number, an ID under two sequence numbers and retiring the ID a packet was sent to are PROTOCOL_VIOLATION; more active IDs than advertised, or more owed retirements than twice that, CONNECTION_ID_LIMIT_ERROR. Its slots are fixed when it is made (WP34 Q4): an ID is copied into one, `addPeerAt` / `ownsLocalAt` / `retireLocal` read it from the packet in place, and `reset` empties the table for the next connection | RFC 9000 §5.1, §19.15, §19.16 |
| [`net/quic.ts`](./net/quic.ts) | The server side of a QUIC connection (WP34 Q2): `new QuicConnection(config, entropy)`, `receive(datagram, now)`, `signatureInput()` / `sign(signature)`, `takeDatagram(now)` until `null`, `deadline()` / `handleTimer(now)` for its timers, and `readStream()` / `writeStream(id, data, fin)` once connected; `updateKeys()`, `close(code)` and `release()`; `acceptRetry(originalDcid, retryScid)` for a connection a Retry token opened; `quicStatelessResetToken(key, cid)`. TLS 1.3 runs over CRYPTO frames at the Initial, Handshake and 1-RTT levels (`TlsServer` with `quic` set), the keys of each level come from `nish/net/quic-packet` as the secrets appear and are discarded and wiped as RFC 9001 §4.9 says, transport parameters go both ways and the client's are checked, every ack-eliciting packet is acknowledged in its space, the client gets new connection IDs once the handshake is confirmed, PATH_CHALLENGE is answered, and an ack-eliciting Initial is padded to 1200 bytes and held to three times what the unvalidated client sent. A protocol violation closes the connection with the RFC's transport error, a TLS alert with CRYPTO_ERROR; a packet that cannot be used is dropped and counted. The idle timeout is the smaller of both sides' `max_idle_timeout`, at least three probe timeouts, and closes silently; key update runs both ways, the client's followed (at most `QUIC_CONN_MAX_KEY_UPDATES`, QUIC-4) and the server's started by `updateKeys()`, with the next read keys derived in advance and the previous kept a probe timeout for reordered packets; every connection ID carries the stateless reset token the configuration's static key gives it. Loss recovery is `nish/net/quic-recovery`'s (WP34 Q3): what a lost packet carried (CRYPTO, STREAM, HANDSHAKE_DONE and the connection-ID frames) is sent again, a probe timeout sends a probe, and NewReno's window holds back everything but ACKs and probes. Streams (WP34 Q4) are `nish/net/quic-stream`'s, both ways and both kinds, through `nextStreamEvent()`, `openStream(bidirectional)`, `streamRead(id, buf, at, length)`, `streamWrite(id, buf, from, length, fin)`, `streamReset(id, code)` and `streamStopSending(id, code)`; RFC 9221's datagrams through `sendDatagram(buf, from, length)`, `readDatagram(buf, at, cap)` and `maxDatagramPayload()` when `config.maxDatagramFrameSize` offers them. Nothing is allocated per packet (QUIC-3): `receiveWindow(buf, off, len, now)` and `takeDatagramInto(out, at, now)` open and build packets in place inside an arena block, and `reset(entropy)` makes the connection a reusable slot for the next client. Not here yet: the AEAD limits of RFC 9001 §6.6 (QUIC-6) | RFC 9000 §10.1, §10.3.2; RFC 9001 §4, §5.7, §6, §8; RFC 9221; a handshake and stream echo, and an update each way, against aioquic, recorded and replayed byte for byte |
| [`net/quic-listener.ts`](./net/quic-listener.ts) | What a QUIC server answers to a datagram no connection owns (WP34 Q2, second part): `new QuicListener(config, entropy)` and `handle(datagram, address, now)`, which answers a `QuicListenerAnswer` whose `kind` is `QUIC_LISTEN_DROP`, `_ACCEPT` (make a `QuicConnection`; after a Retry, `acceptRetry` it with the answer's IDs), or a `reply` to send: `_VERSION_NEGOTIATION` for another version in a full-sized datagram, `_RETRY` with an address-validation token when `config.retry` is set, `_INVALID_TOKEN` for a Retry token that is forged, moved, expired or for another ID, and `_STATELESS_RESET` for a short header to an ID the server has no connection for. A token is 128 bits of HMAC-SHA256 under `config.retryTokenKey` over its issue time, the original DCID, the new ID and the client's address and port, good for `config.retryTokenLifetime`. A reset ends in `quicStatelessResetToken` of the packet's ID, is always shorter than the datagram it answers and never under 21 bytes, and is rate limited. Its own unpredictable bytes come from an HMAC generator seeded once by the caller. For the carrier's send loop, `quicListenerTakePaced(conn, now)` takes a connection's next datagram only when its pacer has the credit, and `quicListenerPaceTime(conn, now)` says when it will (WP34 Q3); `quicListenerTakeFlight(conn, now, buf, at, cap, flight)` writes a paced flight back to back for one GSO send, with the `UDP_SEGMENT` size in its `QuicFlight`, and `quicListenerReceiveSegments` hands a connection a GRO receive segment by segment, in place (WP34 Q4) | RFC 9002 §7.7; RFC 9000 §5.2.2, §6, §8.1, §10.3, §17.2.1, §17.2.5; Version Negotiation, Retry, a stateless reset and the idle timeout against aioquic, recorded and replayed byte for byte |
| [`net/quic-recovery.ts`](./net/quic-recovery.ts) | QUIC loss detection and congestion control (WP34 Q3), sans-IO, for the server side: `QuicRecovery` holds one `QuicSentPackets` ring per packet number space (16 packets for Initial and Handshake, 128 for Application Data, fixed when it is made); `onPacketSent(space, pn, size, now)` records an ack-eliciting packet and answers its slot, `onAck(space, ranges, count, ackDelay, now)` reads an ACK frame's ranges and lists the slots it acknowledged and showed lost (`acked`, `lost`), `deadline(amplificationBlocked)` and `onTimeout(now, amplificationBlocked)` run the time-threshold loss timer and the probe timeout with its backoff, `discardSpace` drops a space whose keys are gone, `evictOldest` frees a slot for a probe. The RTT estimate (`latestRtt`, `smoothedRtt`, `rttVar`, `minRtt`, `probeTimeout()`), loss by packet threshold 3 and time threshold 9/8, NewReno (slow start, one halving per recovery period, congestion avoidance, the 2400-byte floor, persistent congestion) and a pacer at 5/4 of the window per smoothed RTT (`pacerDelay`, `onPaced`), all in integer milliseconds and bytes | RFC 9002 §5–7, Appendices A and B, worked by hand in `net_quic_recovery` |
| [`net/quic-stream.ts`](./net/quic-stream.ts) | QUIC streams (WP34 Q4), sans-IO, which `nish/net/quic` drives: `QuicStreams` holds one `QuicStream` slot per stream that may be open at once (the client's bidirectional and unidirectional limits and the server's own), each with a fixed receive and send buffer, found by ID through a hash index. The send and receive state machines of §3 (`QUIC_SEND_*`, `QUIC_RECV_*`), reassembly into the receive buffer, flow control per stream and for the connection both ways (MAX_STREAM_DATA and MAX_DATA raised as the application reads, STREAM_DATA_BLOCKED and DATA_BLOCKED once per limit), the stream limits (MAX_STREAMS raised as the client's streams finish, STREAMS_BLOCKED at the client's), STOP_SENDING answered with RESET_STREAM, and the refusals STREAM_STATE_ERROR, STREAM_LIMIT_ERROR, FLOW_CONTROL_ERROR and FINAL_SIZE_ERROR. The application's answers are `QUIC_STREAM_OK`, `QUIC_STREAM_END` and `QUIC_STREAM_ERR_*` | RFC 9000 §2–§4, §19.4–§19.14 |
| [`net/quic-datagram.ts`](./net/quic-datagram.ts) | `QuicDatagramQueue` (WP34 Q4): a fixed ring of DATAGRAM payloads, one each way per connection, copied in (`push`) and out (`pop`, or `putFrame` as a DATAGRAM frame), refusing past a full ring and counting what it drops | RFC 9221 §5 |
| [`net/hpack.ts`](./net/hpack.ts) | HPACK, HTTP/2's header compression: `HpackEncoder` and `HpackDecoder`, one per direction of a connection, each with its `HpackTable`; and beneath them the §5.1 integer (`hpackEncodeInteger` / `hpackDecodeInteger`), the §5.2 string (`hpackEncodeString` / `hpackDecodeString`) and Appendix B's Huffman code (`HpackHuffman`, `hpackHuffmanEncode`, `hpackHuffmanDecode`, `hpackHuffmanLength`). Names and values are `u8[]`. The encoder takes the representation and the Huffman choice per field, and sends a never-indexed field as a literal even when a table holds it. The decoder answers a negative `HPACK_ERR_*` code, and stays spent, for a truncated block, an integer past 2^31 - 1, an index of zero or out of range, bad Huffman padding, EOS, a size update above the SETTINGS limit, after a field or missing when a lowered limit requires one; a header list past the caller's limit is decoded to the end, its excess dropped, and answered with `HPACK_LIST_TOO_LARGE`, which is not fatal. A window outside its buffer, a negative size or limit, and an integer prefix outside 1 to 8 bits are the program's mistakes and panic | RFC 7541 Appendix C (C.1–C.6, with the dynamic table after every step) and every code of Appendix B |
| [`net/qpack.ts`](./net/qpack.ts) | QPACK, HTTP/3's field compression, with a dynamic table of capacity 0: `QpackEncoder` and `QpackDecoder`, one per connection. The encoder writes a field section that starts `00 00` (Required Insert Count 0, Base 0) with `beginSection`, then one field line per `encodeField(out, name, off, len, value, off, len, neverIndexed, huffman)`: an Indexed Field Line when the 99-entry static table holds the field, else a literal with the name by static index when it can, each string Huffman-coded when that is shorter and `huffman` is set, and a never-indexed field always a literal with the N bit. The decoder answers a section's fields as windows into its own `bytes` (`nameStart`, `nameLength`, `valueStart`, `valueLength`, `neverIndexed`, `count`), its arrays reused from section to section. It answers QPACK_DECOMPRESSION_FAILED, and stays spent, for a truncated section, an integer past 2^62 − 1, a non-zero Required Insert Count, a negative Base, any dynamic-table reference, a static index past 98 and bad Huffman; a section past `maxFieldSectionSize` answers `QPACK_SECTION_TOO_LARGE`, which is not fatal. `receiveEncoderStream` accepts Set Dynamic Table Capacity 0 and answers QPACK_ENCODER_STREAM_ERROR for any other capacity, Insert or Duplicate; the encoder's `receiveDecoderStream` accepts Stream Cancellations, split anywhere, and answers QPACK_DECODER_STREAM_ERROR for a Section Acknowledgment or Insert Count Increment; `reason` names the rule. `qpackPushStreamCancellation` is the one instruction it may send. The Huffman code is `nish/net/hpack`'s. A window outside its buffer, a negative limit and a stream ID outside 0 to 2^62 − 1 panic | RFC 9204 Appendix B.1, every Appendix A entry by its index, B.2 to B.5's instructions refused, and a request matched byte for byte with pylsqpack's encoding |
| [`net/http1.ts`](./net/http1.ts) | `Http1Parser`, an incremental HTTP/1.1 request parser: `feed(buf, off, len)` any slice, then `next()` answers `HTTP1_NEED_MORE`, `HTTP1_HEAD` (`method`, `target`, `minor`, lowercased `names` beside `values`, `header(name)`, `contentLength` or `chunked`, `keepAlive`, `upgrade`), `HTTP1_BODY` (a window onto its buffer, de-chunked), `HTTP1_END`, or one of three final events: `HTTP1_UPGRADE` (`upgradeBytes()` and `declineUpgrade()`), `HTTP1_CLOSED` and `HTTP1_ERROR` with the `status` to answer. It refuses with 400 every request-smuggling shape — `Content-Length` with `Transfer-Encoding`, a repeated or non-digit `Content-Length`, an obs-fold, a bare LF, whitespace before a colon, a malformed chunk size or terminator — and with 413, 414, 431, 501 and 505 what those mean. The head is also kept as spans in a buffer reused from request to request (`head`, `spans`, `methodIs`, `targetIs`, `headerIndex`, `headerIs`, `upgradeIs`), so a parser with `keepText` off allocates nothing per request; `maxChunk` caps each `HTTP1_BODY`, and `restart()` readies it for the next connection. The writer is `http1ResponseHead(status, reason, names, values, bodyLength)`, which adds the framing field itself and refuses (`null`) a CR, LF or other control character anywhere a caller's string lands, and `http1Chunk` and `http1LastChunk` for a chunked body; `http1WriteResponseHead` and `http1WriteChunk` write the same bytes into a caller's buffer at an offset, answering `HTTP1_NO_ROOM` or `HTTP1_REFUSED` | RFC 9112 §2–§7 and §9.3, RFC 9110 §5, §6.2, §7.2 and §7.8; a corpus fed at every split point (`tests/link/net_http1`) |
| [`net/websocket.ts`](./net/websocket.ts) | `WsDecoder(expectMasked, maxMessage)`, the same `feed` and `next()` over WebSocket frames: `WS_MESSAGE` (fragments joined, text checked as UTF-8 fragment by fragment), `WS_PING`, `WS_PONG`, and the final `WS_CLOSE` and `WS_ERROR`, whose `closeCode` is the 1002, 1007 or 1009 to close with. `websocketFrame` encodes a frame with the mask key the caller supplies (`websocketWriteFrame` into a caller's buffer, `websocketFrameSize` its length), `reset()` readies a decoder for the next connection, `websocketClosePayload` a close frame's code and reason, and `websocketIsUtf8` checks a window. The handshake is `websocketRequestKey(parser)` over an `Http1Parser`'s head, `websocketAcceptKey`, `websocketKeyIsValid` and `websocketUpgradeResponse`, the 101 | RFC 6455 §1.3's accept key, the §5.7 example frames byte for byte, §5.5's control-frame rules, §7.4's close codes |
| [`net/http1-server.ts`](./net/http1-server.ts) | The server side of HTTP/1.1 (WP34 H1): `Http1Connection`, sans-IO, drives an `Http1Parser` — `feed`, then `next()` answers `H1_REQUEST` (the parser's head), `H1_BODY` (at most `chunkSize` bytes, either framing), `H1_END`, `H1_WRITE` (a held-back write may go again), `H1_WS_MESSAGE`, `H1_WS_CLOSE` or the final `H1_ERROR`; the program answers with `respond(status, names, values, bodyLength)`, `write` and `end`, or `acceptWebSocket(protocol)` and then `sendFrame` and `closeWebSocket`. Keep-alive and pipelining one exchange at a time, a response with a length or chunked (unframed to an HTTP/1.0 client), `Connection` and the framing decided by the server, every parser refusal answered with its status and a close, pings and closes answered on a WebSocket. Two slot pools for a program that owns its loop: `Http1Server` on plain TCP and `Http1TlsServer` on `nish/net/tls-tcp` with ALPN `http/1.1` or none (`accept`, `readable` / `writable`, `next(slot)`, `flush(slot)`, `close`, `expire(now)` for the idle timeout). Every cap is an `Http1Config` number fixed at start-up, and a warmed slot allocates nothing per request (`docs/security/http1.md`). Native only, as `nish:net` is | RFC 9112 §6, §7, §9; RFC 9110 §9.3.2, §15; RFC 6455 §4.2, §5.5. Nish clients over loopback against both carriers, requests cut at every byte, 2 MiB bodies each way, pipelining, a WebSocket echo, the arena flat over two hundred requests, and every refusal (`tests/link/net_http1_server`); `curl` against its `serve` mode |
| [`net/http-fields.ts`](./net/http-fields.ts) | The header model HTTP/2 and HTTP/3 share, version-neutral: `HttpFields` reads a decoded section with `readRequest(names, values, extendedConnect)`, `readResponse` or `readTrailers` into `method`, `scheme`, `authority`, `path`, `protocol`, `status`, the regular fields in order (`get(name)`) and `contentLength`, answering `HTTP_FIELDS_OK` or the first refusal: a name that is empty, not a token or not lowercase; a value with NUL, CR or LF or whitespace at an end; a connection-specific field (`te` but `trailers` included); a pseudo-header unknown, repeated, after a regular field, forbidden by the shape or missing; a pseudo-header value of the wrong syntax; a `host` that disagrees with `:authority`; a bad or disagreeing `content-length`. `:protocol` (RFC 8441) is read only where the caller enabled extended CONNECT. `httpFieldNameValid`, `httpFieldValueValid`, `httpFieldConnectionSpecific` and `httpFieldsCheckOutgoing` check one name, one value or a section a program sends | RFC 9110 §5, RFC 9113 §8.2–§8.5, RFC 9114 §4.2–§4.3, RFC 8441 §4; every refusal in `tests/link/net_http_fields` |
| [`net/http2-frame.ts`](./net/http2-frame.ts) | HTTP/2's frames, sans-IO and allocation-free: `http2ReadHeader` and `http2ParseFrame` read any frame of RFC 9113 §6 into a reused `Http2Frame` (its content left in the buffer as a window), answering 0 or the connection error — FRAME_SIZE_ERROR past the reader's SETTINGS_MAX_FRAME_SIZE or for a frame of the wrong length, PROTOCOL_ERROR for a frame on the wrong stream, padding as long as its frame, or a WINDOW_UPDATE of zero on the connection — with a stream error (`streamError`) for a PRIORITY of the wrong length, a self-dependency or a WINDOW_UPDATE of zero on a stream. `http2SettingCount`, `http2SettingId`, `http2SettingValue` and `http2SettingError` read and check SETTINGS. The writers, one per type (`http2WriteData` … `http2WriteContinuation`, `http2WriteSettingsAck`), write into the caller's buffer at an offset and answer -1 when a frame does not fit | Every type against frames built by hand from §4.1 and §6, both directions, and every refusal (`tests/link/net_http2_frame`) |
| [`net/http2.ts`](./net/http2.ts) | `Http2Connection`, the server side of HTTP/2, sans-IO: `feed(buf, off, len)`, then `next()` answers `H2_REQUEST` (`stream`, `fields`), `H2_DATA` (a window onto the input), `H2_TRAILERS`, `H2_RESET`, `H2_WINDOW` (a send window opened), `H2_GOAWAY` or the final `H2_ERROR`; send `output[outputStart .. outputEnd)` and `consume`. `respond`, `writeData` (as far as both windows and the output allow), `writeTrailers`, `reset`, `goaway` and `restart`. The §5.1 stream state machine, connection and stream flow control with WINDOW_UPDATE both ways, SETTINGS and the acknowledgement, PING, header blocks across CONTINUATION decoded by `HpackDecoder`, a 431 past the header-list cap, extended CONNECT behind SETTINGS_ENABLE_CONNECT_PROTOCOL, and every connection and stream error of RFC 9113 as GOAWAY or RST_STREAM. Every cap is an `Http2Config` number fixed at start-up; DATA and every control frame allocate nothing ([H2-1](../docs/security/http2.md)) | RFC 9113 §3–§8, RFC 8441; requests, streamed responses, flow control stalling and resuming and concurrent streams from a scripted client (`tests/link/net_http2`), and a negative for each error class (`tests/link/net_http2_errors`) |
| [`net/http2-tls.ts`](./net/http2-tls.ts) | `Http2TlsServer`: HTTP/2 over `nish/net/tls-tcp` for a program that owns its loop — a pool of `Http2Connection`s beside the TLS slots, sized at start-up and reused with `restart`; `accept`, `readable` / `writable`, `signP256`, `next(slot)` for the slot's next event, `flush(slot)`, `close`. A slot whose ALPN did not choose `h2` is shut down with `close_notify` (RFC 9113 §3.2). Native only, as `nish:net` is | A Nish TLS client over loopback (`tests/link/net_http2_tls`): ALPN, a GET, an echoed POST, a hundred DATA frames with the arena flat, GOAWAY, and the pool; `curl --http2` against its `serve` mode |
| [`net/http3-frame.ts`](./net/http3-frame.ts) | HTTP/3's frames and stream types, sans-IO and allocation-free: `h3ReadFrameHeader` reads a type and a length (0 until both are in the window), `h3ReadSettings` a SETTINGS payload into a reused `Http3Settings` (the three identifiers it understands, and the first eight it does not, kept for an extension), `h3ReadIdPayload` a GOAWAY, MAX_PUSH_ID or CANCEL_PUSH; `h3PutFrameHeader`, `h3PutSettings`, `h3PutIdFrame` and `h3PutVarint` write in place. `h3ReservedHttp2Frame` names HTTP/2's reserved types, `h3Greased` the `0x1f * N + 0x21` ones, and the `H3_*` constants are RFC 9114's types, settings and error codes | RFC 9114 §6.2, §7, §8.1, against frames built by hand from §7's layouts (`tests/link/net_http3_frame`) |
| [`net/http3.ts`](./net/http3.ts) | `Http3Connection`, the server side of HTTP/3 over a `QuicConnection`'s streams: `next()` answers `H3_REQUEST` (`stream`, `fields`), `H3_DATA` (a window onto `data`, at most `bodyChunk`), `H3_TRAILERS`, `H3_END`, `H3_RESET`, `H3_WRITABLE`, `H3_GOAWAY` or the final `H3_ERROR`; `respond`, `writeData` (takes what the send buffer has room for), `writeTrailers`, `reset` and `goaway` write. It opens its control stream with SETTINGS and its QPACK streams (capacity 0, through `nish/net/qpack`), checks every field section with `nish/net/http-fields`, answers a section past `maxFieldSectionSize` with a 431, and closes the connection with RFC 9114's code for each connection error. No server push. A warm connection allocates nothing per request (`docs/security/http3.md`) | RFC 9114 §4–§8 and RFC 9204 §4.2: a Nish client over QUIC, requests with bodies both ways, trailers, GOAWAY, cancellation, every error code (`tests/link/net_http3`, `net_http3_errors`) |
| [`net/http3-server.ts`](./net/http3-server.ts) | `Http3Server`: HTTP/3 over QUIC on one UDP socket for a program that owns its loop — a pool of `QuicConnection` slots with an `Http3Connection` each, sized at start-up and reused; a `QuicListener` in front; datagrams routed by a hashed index of every slot's connection IDs; `receive(now, key)`, `tick(now)`, `ready()` for the next slot with news, `flush(now)` sending paced GSO flights, `timeout(now)` from a timer wheel. A handshake that did not choose ALPN `h3` is closed with no_application_protocol (RFC 9114 §3.1); a slot done after GOAWAY is closed and freed. Native only, as `nish:net` is | A Nish client across loopback (`tests/link/net_http3_server`): requests, a paced 300 KB response, GOAWAY and the slot freed, ALPN, a full pool, the arena over connections through one slot; aioquic and `curl --http3` against its `serve` mode |

**How a carrier drives `TlsServer`.** The server speaks in handshake
*messages*, tagged by level: `TLS_LEVEL_INITIAL` (cleartext — ClientHello,
HelloRetryRequest, ServerHello), `TLS_LEVEL_HANDSHAKE` (EncryptedExtensions
through both Finished messages) and `TLS_LEVEL_APPLICATION`. A carrier hands
`receive` the bytes it got at a level, in any split, and sends what
`takeOutput(level)` answers under that level's keys: TLS over TCP (T2) in
records, QUIC (Q2) in CRYPTO frames of the matching packet number space.
`writeSecret(level)` and `readSecret(level)` answer the server's and the
client's traffic secret for the Handshake and Application levels as soon as
it is known (`null` before; the Initial level has none), `tlsTrafficKey` and
`tlsTrafficIv` turn one into a record key, and `exporterSecret` is there for
exporters. The state says what is due: `TLS_STATE_WAIT_SIGNATURE` after the
first flight is written, `TLS_STATE_WAIT_FINISHED` once it is signed,
`TLS_STATE_CONNECTED` when the client's Finished verified, and
`TLS_STATE_FAILED` with `alert` set after a refusal. Over QUIC, set `quic` in
the configuration: ALPN becomes mandatory and the transport parameters go both
ways (`clientTransportParameters` holds the client's).

**Secrets.** The ECDHE secret, and the copy of the ephemeral key it is
computed with, are `Secret`s wiped on every path, and `tlsSignEcdsaP256` takes
its key as a `Secret`. What `TlsServer` keeps in its fields — the caller's
ephemeral key bytes and the handshake, traffic and exporter secrets — is not
wiped until `secureZero` ships in a release (TLS-1 in
[`docs/security/tls.md`](../docs/security/tls.md), the record that also lists
what each refusal is and the test that pins it).
`tests/link/net_tls_*` are the module's programs, each also run under
`--number-mode f64`.

**TLS over TCP.** `nish/net/tls-tcp` is the carrier of the paragraph above
for TCP, and `nish/net/tls/record-server` is all of it but the socket, for a
test or another transport. The program is the loop: there are no callbacks,
so each call answers the slot's interest and the program re-arms the
descriptor with `pollModify(loop, tls.fd(slot), wants & 3, slot)`, signs on
`TLS_RECORD_SIGN`, reads on `TLS_RECORD_DATA` and calls `close(slot)` on
`TLS_RECORD_DONE`. A slot's buffers — about a hundred kilobytes — are
allocated once, and after its handshake a connection allocates nothing that
outlives a record; a KeyUpdate leaves its key derivation, about 10 KB when
answered, so a connection takes at most `TLS_RECORD_MAX_KEY_UPDATES` (64)
from its client, and the handshake itself leaves about 52 KB behind until the
arena is reset (TLS-3), and the carrier has no clock, so
closing quiet slots is the program's (TLS-4). On this path the record layer
wipes `TlsServer`'s traffic and handshake secrets and the ephemeral key once
it has what it needs from them, which narrows TLS-1.
`tests/link/net_tls_record_*` are its programs, and the `net_tls_tcp` block
of `tests/run.js` drives the carrier with openssl and curl.

**How a server drives `QuicConnection`.** Keep one `QuicListener` for the
server, with the same `QuicServerConfig` its connections use: two static keys
of `QUIC_CONN_STATIC_KEY_SIZE` bytes (the stateless reset key, which has to
survive a restart to be any use, and the Retry token key; both are the
caller's to keep, QUIC-5) and whether to ask for Retry. Route each datagram by
its first packet's DCID: to the connection whose `ownsConnectionId` says it
is its, and anything else to `listener.handle(datagram, address, now)`, which
answers what to send back or says to make a connection — and must see nothing
a live connection owns, or a stateless reset would end that connection.
Make the connection when it says so, with `QUIC_CONN_ENTROPY_SIZE` bytes from
`crypto.getRandomValues`: the TLS server random and x25519 key, the server's
first connection ID and the seed its later IDs are derived from all come out
of them, so a test injects fixed bytes and a recorded exchange replays byte
for byte. Neither has a clock: `now` is the caller's monotonic time in
milliseconds, and `deadline()` says when to call `handleTimer(now)` next.
Hand the connection every datagram the client sends;
when `signatureInput()` answers bytes, sign them (`tlsSignEcdsaP256`) and hand
the signature to `sign`; then send whatever `takeDatagram(now)` answers until it
answers `null`, to the address the datagram came from. `ownsConnectionId`
says whether a datagram's DCID is the connection's, which is how a server
with many routes them. Stream data comes out of `readStream()` in order per
stream, and `writeStream` queues a reply within the credit the client gave.
`state` says where it is, and `error` why it closed. The keys of each level
are wiped when the level is discarded, each key generation when an update
replaces it, and the rest by `release()` or the idle timeout; what no wipe
reaches is QUIC-2 in [`docs/security/quic.md`](../docs/security/quic.md).
`tests/link/net_quic_frame`, `net_quic_conn_parts`, `net_quic_conn`,
`net_quic_conn_replay`, `net_quic_lifecycle` and `net_quic_lifecycle_replay`
are its programs, each also run under `--number-mode f64`; the two replays
send, over loopback from a Nish UDP client, exchanges recorded against
aioquic by their `record.sh`: a handshake and echo, and Version Negotiation,
Retry, key update both ways, the idle timeout and a stateless reset.

`net/http1.ts`, `net/http1-server.ts` and `net/websocket.ts` run their checks
again under `--number-mode f64` (`net_http1_f64`, `net_http1_server_f64`,
`net_websocket_f64`). None handles a secret but through `nish/net/tls-tcp`, so
none is in the constant-time check; their record is
[`docs/security/http1.md`](../docs/security/http1.md), written with the code
rather than after an audit.

## How a program imports it

By its package specifier:

```ts
import { Suite } from "nish/testing";
```

`nish/<module>` resolves to `<module>.ts` in this directory, found beside the
compiler that is running — not relative to the importing file, so the same
specifier works at any depth and from outside this repository.

**Source is the distribution format** ([`docs/wp21-packages.md`](../docs/wp21-packages.md)
§2), so an import of a `std/` module is not a link against a built library: the
module is compiled with the program that imports it, and the whole-program
attribute pass sees through it exactly as it sees through the program's own
functions. A `std/` function is inlined, specialised or dropped on the same
terms as a local one — and a module you import but never call is dropped
whole. Measured at the `speed` and `size` profiles, both of which link with
`-flto -Wl,--gc-sections`: a program importing three `std/text` functions and
calling none is **byte-identical** to the same program without the import.
(`debug` keeps them, which is what `debug` is for.)

A `std/` module is its own package (`nish`), so its symbols are scoped and a
program may declare a function one of these modules also exports
(`tests/link/std_package_scope`, `docs/wp21-packages.md` §5a). The package is
decided by the `nish/` specifier rather than by the directory the file is found
in — read off the path it would be `nish` from `node_modules/@amritk/nish/std/` and the
root package from a checkout, and the same program would compile against an
installed compiler and be refused by a checkout of it.

A relative specifier still works and means the same thing —
`import { Suite } from "../std/testing"` — but it hard-codes the depth of the
importing file and only reaches an installed library by the path the install
put it at, so `nish/` is the form to write.

### Why this is not the second module system this file used to warn about

An earlier version of this section said a bare specifier was "deliberately not
faked", because a resolver that special-cased this directory would be a second
module system and the one WP21 is bringing has to agree with Node's. That
reasoning still holds for third-party packages, which are still refused
(`docs/wp21-packages.md` §5b). It does not hold for *this* package, for two
reasons that are only true of it:

- There is exactly one right answer. `std/` ships inside the compiler's own
  package and is versioned with it, so "the `std/` beside this binary" is not a
  guess a resolver makes — it is the only `std/` that can be correct for the
  compiler reading it. No version can be skewed against it.
- It **is** what Node and `tsc` resolve. The package is published as
  `@amritk/nish`, so a bare `nish/text` is not a package self-reference on its
  own; `runtime/nish.mjs`, the prelude a program runs under Node with
  (`node --experimental-strip-types --import ./runtime/nish.mjs`), resolves
  `nish/<module>` to `std/<module>.ts` beside itself, and the repository's
  `tsconfig.json` maps `nish/*` to `./std/*`, which is what gives `tsc` and an
  editor go-to-definition into the real source. `package.json` still declares
  `"./*": "./std/*.ts"` in `exports`, so `@amritk/nish/text` reaches the same
  file. The compiler short-circuits to that answer rather than walking
  `node_modules` to reach it.

So this is WP21's first slice rather than a detour around it: the spelling is
the one WP21 specifies, and what is still missing is resolution for specifiers
that are *not* this package.

## Writing a module here

- **Spell the widths — and then convert what the builtins hand you.** `i32`,
  `i64`, `f64`, never `number`, so the module means the same thing under
  `--number-mode f64` as it does by default (`examples/arrays.ts` says that half
  for the same reason). It is necessary and **not sufficient**: `s.length`,
  `a.length` and `s.charCodeAt(i)` answer `number`, which *is* `f64` in that
  mode, so a module that declares every width of its own and still writes
  `let end: i32 = text.length` or `while (i < text.length)` does not compile
  there at all. Read each of those through `toI32` —
  `const length: i32 = toI32(text.length)`, once per function rather than once
  per iteration — and the module means one program in both modes. The default
  mode pays nothing for it, because `toI32` on an `i32` is identity.
  `tests/link/std_text_f64` is what keeps this from being prose;
  [`docs/wp26-stdlib.md`](../docs/wp26-stdlib.md) §4 is the reasoning.
- **Name the private helpers as though they were exported.** A `std/` module
  belongs to package `nish`, so its symbols no longer collide with the
  importing program's (`tests/link/std_package_scope`), but every `std/` module
  shares that one package's flat namespace: a function name is unique across
  the package whether or not it is exported, because the whole-program
  attribute analysis is keyed by symbol name. A helper called `isBlank` in one
  module would stop another `std/` module that declares its own `isBlank` from
  compiling, which is why `text.ts` calls it `isTextBlankByte`. Keep the
  helpers few and their names distinctive
  ([`docs/wp26-stdlib.md`](../docs/wp26-stdlib.md) §3e). Module constants are
  exempt — `NEWLINE` and `SPACE` fold at their uses.
- **It is an Nish program**, so the constraints are the language's: a function is
  an arrow bound to a module-level `const`, a function is never a value, there
  is no `try` / `catch`, and there are no optional or default parameters. Those
  three are what shape an API here more than any style preference — see the
  header of `testing.ts` for what they did to that one, which was written before
  WP18 added generic functions and classes
  ([`docs/LANGUAGE.md`](../docs/LANGUAGE.md#generic-functions)) and still has
  one assertion per type ([`docs/wp26-stdlib.md`](../docs/wp26-stdlib.md) §3c).
  `pair.ts` is the first module here to export a generic type.
- **Ship it with a `tests/link/` case.** `tests/link/<name>/` is the only place a
  multi-module program is exercised end to end, and it is also what puts the
  module into the corpus the stage1 oracles read
  ([`.claude/selfhost.md`](../.claude/selfhost.md)): a `std/` module with no
  importer in `tests/link/` is compiled on no run.
  `testing.ts` has two, one per outcome — `tests/link/std_testing` (exit 0) and
  `tests/link/std_testing_fail` (exit 1, and the wording of every failure
  message) — and `text.ts` and `json.ts` have `tests/link/std_text` and
  `tests/link/std_json`, each of which uses `Suite` to check the module, the way a
  user would. `pair.ts` has five, `tests/link/std_pair_*`, one per shape of
  instantiation, each returning a `Pair` from a sibling module and pinned by its
  stdout. `tests/link/std_text_f64` is the same corpus under
  `--number-mode f64`, which is where a module that spelled its widths and forgot
  a `toI32` is caught.
- **`std/` is not on the compiler's dependency list.** Nothing in `src/`
  imports it, and nothing should: the compiler is the thing that has to
  build before the library means anything.

## Who reads the library, and what each reader proved

Two programs in this repository are written on top of `std/`, and between them
they are the reason the modules have the shape they do — a library with one
consumer is a guess.

| Program | What it does | What it uses |
| --- | --- | --- |
| [`tests/nish/run.ts`](../tests/nish/run.ts) | the golden cases and the `tests/link/` programs, compiled, assembled, linked, run and diffed | `Suite` (including `containsAll` for an `.err` file's fragments and `eqLines` for an IR golden), and all of `std/text` |
| [`tests/nish/cli.ts`](../tests/nish/cli.ts) | the command line's own contract — the streams, the exit-code bands, and one flat `--json` object per diagnostic — read by a program in the language the compiler compiles | `Suite`, `jsonField`, `splitLines` / `trim` / `contains` |

Three assertions exist because the first of those two had written them by hand:
`contains` for a fragment of a captured stream, `containsAll` for an expectation
file that holds one fragment per line, and `eqLines` for a generated text against
a golden, which reports the first differing line instead of printing both texts.
That is the rule the directory runs on — a `std/` function earns its place when a
program in this repository would otherwise write the loop, and the loop is
already written.

`std/json` is the one module admitted with a single importer, and the reason is
the *format* rather than the count: the object it reads is this project's own
published surface (`AGENTS.md`, [`docs/wp12-release.md`](../docs/wp12-release.md)),
so every Nish program that ever reads compiler output needs exactly this scan,
and the next one would copy it out of `tests/nish/cli.ts`. The module is also
where the format's one ambiguity is written down and tested —
[`docs/wp26-stdlib.md`](../docs/wp26-stdlib.md) §7 question 3 is where that
argument is recorded and where its second consumer is expected.

## What `std/testing` is not, and what closed

`std/testing` is a test *library*: it is how a compiled program checks itself.
Driving the compiler — compiling a corpus, assembling it, linking it, running it
and diffing stdout against a golden — needed three things the language did not
have, and all three have since landed as builtins:

| Was missing | Now |
| --- | --- |
| a directory listing | `readdirSync(path): string[] \| null`, sorted by bytes, because there is no `sort` for a caller to reach for |
| a child's **output** — `spawnSync` answers a status and nothing else | `spawnSyncTo(argv, stdoutPath, stderrPath)`, each stream to a file, an empty path inheriting |
| a clock | `monotonicNanos(): i64` |

So the driver exists, in the language, and it is
[`tests/nish/run.ts`](../tests/nish/run.ts): it discovers the golden cases with
`readdirSync`, compiles each one by spawning the compiler, links and runs the ones
with a `.out`, diffs the IR against the golden line by line, and reports through a
`Suite`. It passes over the whole corpus — `npm run test:nish` — and `npm test`
runs it over a handful of cases so that the three builtins are exercised together
on a real workload on every run.

It is still not a replacement for `tests/run.js`, and the difference is worth
being precise about: it covers section A, the golden cases, and none of the
pipeline checks — no interop sidecars, no layout assertions, no wasm profiles, no
packaging and no self-hosting oracles. It also skips, by name and counted, the three
sidecars it does not implement (`.env`, `.argv`, `.stdout`). What it demonstrates
is that the language can host its own harness; what `tests/run.js` does is prove
the compiler.
