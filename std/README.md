# `std/` — the standard library

Nish modules written in Nish, for Nish programs to import. There is no magic
here and — with three exceptions, `threads.ts`, `collections.ts` and `map.ts` —
nothing the compiler knows about: a module in this directory is an ordinary Nish source file, compiled as part of
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
(`crypto_*_f64`).

Every module here was security-audited (#363); the records are in
[`docs/security/`](../docs/security/README.md), and how to report a
vulnerability is in [`SECURITY.md`](../SECURITY.md). Two limits hold across the
modules. **Lengths stop at 2^31 − 1.** No array built by `push` or `new Array`,
and no array or string the runtime makes (a file read, a concatenation, a
template), can pass 2^31 − 1 elements or bytes, and the one-shot functions
below refuse a longer input as each row says. A string built by `join` still
can, and under `--number-mode i32` its `length` is then wrong, which nothing in
`std` can tell (CG-3, open): a program built in that mode must not hand these
functions anything built from such a string. **Private keys are `Secret`s.**
`crypto/p256.ts`, `crypto/x25519.ts` and `crypto/x509.ts` take and give a
private key as a `Secret<u8[]>` from `nish:secret`, compute on it only inside
`expose`, and wipe every intermediate the key reaches before they return, with
a store the optimiser may not remove (ECC-2, X509-7, closed). The other modules
take their keys as plain arrays and do not wipe them yet.

| Module | What it is | Reproduces |
| --- | --- | --- |
| [`crypto/sha256.ts`](./crypto/sha256.ts) | `sha256(data)`, and `Sha256`, a streaming hasher: `update(buf, off, len)` over a window of a `u8[]`, `copy()` for the hash of a prefix while the original keeps going, and `digest()`, a fresh 32-byte array. `SHA256_SIZE` and `SHA256_BLOCK`. `sha256` panics on an array longer than 2^31 − 1 bytes | FIPS 180-4 §6.2 |
| [`crypto/sha512.ts`](./crypto/sha512.ts) | SHA-512 and SHA-384 on one compression function: `sha512` and `sha384`, and the streaming `Sha512` and `Sha384` with `Sha256`'s three methods; digests of 64 and 48 bytes. `SHA512_SIZE`, `SHA384_SIZE` and `SHA512_BLOCK`. The one-shot `sha512` and `sha384` panic on an array longer than 2^31 − 1 bytes | FIPS 180-4 §6.4, §6.5 |
| [`crypto/hmac.ts`](./crypto/hmac.ts) | `hmacSha256` and `hmacSha384`, the streaming `HmacSha256` and `HmacSha384` (keyed in the constructor, then `update` and `digest`), and `hmacSha256Verify` / `hmacSha384Verify`, which compare a received tag with `timingSafeEqual`. The one-shot functions panic on a message longer than 2^31 − 1 bytes | RFC 2104, RFC 4231 §4 |
| [`crypto/hkdf.ts`](./crypto/hkdf.ts) | `hkdfExtractSha256` / `hkdfExtractSha384` (an empty salt is HashLen zeros) and `hkdfExpandSha256` / `hkdfExpandSha384`, which answer `null` for a length below zero or above 255 × HashLen, for an `info` longer than 2^31 − 1 bytes, and for a PRK shorter than HashLen. `hkdfExpandLabelSha256` / `hkdfExpandLabelSha384` are TLS 1.3's HKDF-Expand-Label, which QUIC uses too; the label is given without its `"tls13 "` prefix, and a length outside 0 to 255, a label outside 1 to 249 bytes, a context past 255 bytes or a secret shorter than HashLen panics, since each is the program's choice rather than the peer's | RFC 5869 §2, Appendix A; RFC 8448 §3 and RFC 9001 A.1 for the label |
| [`crypto/ct.ts`](./crypto/ct.ts) | `timingSafeEqual(a, b)`, which reads every byte whatever it holds, and `timingSafeEqualAt(a, aOff, b, bOff, len)` over two windows, which answers `false` for a window outside its array. Two lengths that differ answer `false` at once, because a length is public, and so does an array longer than 2^31 − 1 bytes | — |
| [`crypto/base64url.ts`](./crypto/base64url.ts) | `base64urlEncode(data)` and `base64urlDecode(text)`, unpadded. Decoding is strict, so every byte string has one spelling: a `=`, a character outside the alphabet, a length of 1 mod 4 or nonzero unused low bits answer `null`, as does a text longer than 2^31 − 1 bytes; `base64urlEncode` panics on such an array | RFC 4648 §5, §10 |
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
injects an RFC trace's values and replays it byte for byte. The carriers that
put them on sockets come after.

| Module | What it is | Reproduces |
| --- | --- | --- |
| [`net/tls.ts`](./net/tls.ts) | The server side of a TLS 1.3 handshake, ClientHello through the client's Finished. `new TlsServer(config, serverRandom, x25519Private)`, then `receive(level, buf, off, len)` with what the client sent, `takeOutput(level)` for what to send, and `signatureInput()` / `sign(signature)` for the CertificateVerify hand-off (`tlsSignEcdsaP256` signs for a P-256 key, DER-encoded). A `TlsServerConfig` names the certificate chain, the signature scheme, the ALPN protocols, whether the carrier is QUIC, the server's transport parameters, and extensions to pass through in EncryptedExtensions. The suites are `TLS_AES_128_GCM_SHA256`, `TLS_CHACHA20_POLY1305_SHA256` and `TLS_AES_256_GCM_SHA384` (in the client's order), the group x25519 (one HelloRetryRequest when the client offers it without a share), and `server_name`, ALPN and `quic_transport_parameters` are read; PSKs, 0-RTT, NewSessionTicket and client authentication are not. Every refusal is the alert to send — `receive` and `sign` answer 0 or a `TLS_ALERT_*` — never a panic, and a low-order x25519 share is refused | RFC 8446 §4, §7; RFC 8448 §3 byte for byte, and §5's transcript |
| [`net/tls/codec.ts`](./net/tls/codec.ts) | The handshake messages as bytes: `tlsParseClientHello` into a `TlsClientHello` (structure checked, an alert on a malformed or duplicated field), and `tlsEncodeServerHello`, `tlsEncodeHelloRetryRequest`, `tlsEncodeEncryptedExtensions`, `tlsEncodeCertificate`, `tlsEncodeCertificateVerify`, `tlsEncodeFinished` and `tlsCertificateVerifyContent`. The wire's constants: handshake and extension types, versions, the x25519 group, the two signature schemes, and the `TLS_ALERT_*` descriptions | RFC 8446 §4, RFC 6066 §3, RFC 7301 §3.1, RFC 9001 §8.2 |
| [`net/tls/schedule.ts`](./net/tls/schedule.ts) | The key schedule over SHA-256 or SHA-384: `tlsEarlySecret`, `tlsHandshakeSecret`, `tlsMasterSecret`, `tlsDeriveSecret`, `tlsExpandLabel`, `tlsFinishedVerifyData`, and `tlsTrafficKey` / `tlsTrafficIv` for a record layer. `TlsTranscript` is the running transcript hash, with HelloRetryRequest's `message_hash` rule. The suite constants and `tlsSuiteHashLength` / `tlsSuiteKeyLength` | RFC 8446 §4.4.1, §7.1, §7.3 |

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
in — read off the path it would be `nish` from `node_modules/nish/std/` and the
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
- **Name the private helpers as though they were exported.** A function name is
  unique across the whole program whether or not it is exported, because the
  whole-program attribute analysis is keyed by symbol name — and a `std/` module
  is compiled *into* the program that imports it, so its private helpers are not
  private to the namespace. A helper called `isBlank` would stop any program that
  declares its own `isBlank` from compiling (`` Function `isBlank` is also
  defined in main.ts ``), which is why `text.ts` calls it `isTextBlankByte`. Keep
  the helpers few and their names distinctive; a module whose internals want
  `compare`, `next` or `parse` is asking for package-scoped symbols, which do not
  exist yet ([`docs/wp26-stdlib.md`](../docs/wp26-stdlib.md) §3e). Module
  constants are exempt — `NEWLINE` and `SPACE` fold at their uses, so a program
  may declare those names itself.
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
  importer in `tests/link/` is compiled by neither compiler on any run.
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
