# Security audit: `nish/crypto/x509`

The DER reader, the PEM codec, the private-key and certificate parsers, the
signature check and the self-signed mint in `std/crypto/x509.ts`. Part of the
repository's security audit (#363); this record is the stage's own and no
other stage edits it.

## Scope

`std/crypto/x509.ts`, every function, with most attention on the ones that read
bytes an attacker supplies:

| Surface | Functions |
| --- | --- |
| DER reading | `x509DerRead`, `x509DerExpect`, `x509DerPeek`, `x509DerIntegerMinimal`, `x509DerSmallInteger`, `x509DerBitStringOctets`, `x509DerTime`, `x509DerIsAlgorithm`, `x509DerUnsignedInto`, `x509DerSignatureRS` (exported since #361), `x509DerBitStringSound` and `x509DerExtensionsSound` (new) |
| PEM and base64 | `pemToDer`, `x509Base64Decode`, `derToPem`, `x509Base64Encode` |
| Private keys | `x509ParseP256PrivateKey`, `x509Sec1Key`, `x509Pkcs8Key` |
| Certificates | `x509ParseCertificate`, `x509ParseChain`, `x509VerifySignature`, `x509CertificateHash` |
| Minting | `x509MintSelfSigned`, `x509DerTimeAt`, `x509DerUnsignedInteger`, `x509IsUtf8Name` (new), `x509MintExtensions` (X509-9) |

`nish/crypto/p256`'s verify and public-key functions are relied on (a key of
the wrong length or off the curve, `r` or `s` of 0 or n and above, answer
`false` or `null`) but belong to another stage; the corpus below exercises them
through this module only.

## Threat model

The attacker controls every byte handed to a parser: a certificate chain file
or a peer's certificate (`x509ParseCertificate`, `x509ParseChain`,
`x509DerSignatureRS`), a PEM file that should hold one private key
(`x509ParseP256PrivateKey`, `pemToDer`), and the common name a caller passes to
the mint. The attacker does not control the private key or the serial a caller
mints with, but a caller that draws them predictably is in scope as misuse the
API must make hard. What the attacker wants: a panic, loop or unbounded
allocation (denial of service); a certificate or key accepted that the module
promises to refuse; a second DER spelling of a certificate or signature that
still verifies (so the hash a browser pins names only one of two identities);
or a signature check that passes for bytes nobody signed.

## Method

- **Read** every line of `std/crypto/x509.ts` against ITU-T X.690 §8, §10 and
  §11 (DER: definite minimal lengths, minimal INTEGERs, BIT STRING unused bits),
  RFC 5280 §4.1 and §4.2 (the certificate profile, unique identifiers,
  extensions, UTCTime and GeneralizedTime), RFC 7468 (PEM), RFC 5915, RFC 5208
  and RFC 5958 (private keys), RFC 3279 §2.2.3 (ECDSA-Sig-Value) and RFC 3629
  with Unicode 15 §3.9 Table 3-7 (well-formed UTF-8).
- **Arithmetic.** Every length and offset is `i32`, in either number mode,
  because the module spells its types. `x509DerRead` takes at most four length
  octets, refuses a first octet of 0 (non-minimal) or, with four octets, of
  `0x80` or more (past 2^31 − 1), and compares `length > limit - start` rather
  than adding, so no sum can wrap. Every other offset is an element's `start`
  or `end`, each already inside its parent.
- **Loops and allocation.** No function recurses; nesting depth is the fixed
  shape of a certificate or key, so a deeply nested input costs nothing extra.
  Every loop is bounded by the input's length or a constant (the one loop over
  years, `x509DerTimeAt`, runs only in the mint and at most 8030 times). Every
  allocation is a copy of part of the input or at most 3/4 of the PEM text.
- **Probes**, a scratch program per suspicion (below), each confirmed finding
  turned into a check in `tests/link/crypto_x509_audit` and shown failing on
  base `882857d`.
- **Corpus**, `tests/link/crypto_x509_malformed`: every valid fixture of
  `tests/link/crypto_x509` — the golden, CA and leaf certificates, two of their
  signatures, the RFC 6979 A.2.5 and OpenSSL CA keys as SEC1 and PKCS#8, and
  four PEM files — cut at every length, every DER bit flipped, a random bit of
  every PEM character flipped, and 600 (DER) or 300 (PEM) random edits from a
  fixed xorshift32 seed: an octet set to a random or boundary value (`00 7f 80
  81 82 84 ff`), deleted or inserted. **25,701 inputs**, about 4.7 s and 10 MB,
  run by `npm test` (25,281 until X509-9 gave the golden certificate its 34
  octets of extensions, which the corpus now cuts and flips too). Each input must return without a panic and must not come
  back as something it should not be (the program's header states the four
  properties). Against `main`'s `x509.ts` before this change the same corpus
  also runs clean; the change moves its counts only where the tighter `[3]`
  check refuses more (the CA certificate, the one fixture with extensions:
  1,527 refused before, 1,547 after; the leaf-and-CA PEM: 1,917 before, 1,918
  after).
- **wasm32 check.** Whether this module could draw randomness itself: a module
  that calls `crypto.getRandomValues` fails to compile for
  `--target wasm32-unknown-unknown` and `wasm32-wasi` (`` `crypto.getRandomValues`
  reaches the operating system, and a wasm32 build has none to reach ``), in any
  function, used or not — see X509-6.

## Findings

Line numbers are those of `std/crypto/x509.ts` at commit 78ba8d8, the commit
that fixes X509-8; nothing after it in this pull request touches that file.
X509-9 came later, from the interop job, and its line numbers are those of the
commit that fixes it.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| X509-1 | Low | `std/crypto/x509.ts:827` (`pemToDer`), reached from `x509ParseP256PrivateKey` | `pemToDer` decoded only the blocks whose label it was asked for. `x509ParseP256PrivateKey` asks once for `EC PRIVATE KEY` and once for `PRIVATE KEY`, so a PEM holding a good SEC1 key and a malformed `PRIVATE KEY` block read the second as absent and answered the SEC1 key, where the function promises `null` for "more than one" key and "anything malformed". | Fixed: every block is decoded whatever its label. `crypto_x509_audit`: "a SEC1 key beside a malformed PRIVATE KEY block answers null", "a PKCS#8 key beside a malformed EC PRIVATE KEY block answers null". |
| X509-2 | Low | `std/crypto/x509.ts:827` (`pemToDer`) | The documentation says blocks with other labels "must be as well formed", but their base64 was never checked: a certificate beside a block of another label holding `A!!A`, or with padding bits set, was accepted. | Fixed by the same change. `crypto_x509_audit`: "a certificate beside a block of another label that is not base64 answers null", "… with padding bits set answers null". |
| X509-3 | Low | `std/crypto/x509.ts:1274` (`x509MintSelfSigned`) | The common name was written as a UTF8String whatever its bytes; a string in the language need not be UTF-8 (`String.fromCharCode`, WTF-8 escapes), so the mint could sign a certificate whose name is not UTF-8, or holds a NUL that C code reads as the end of the name. | Fixed: `x509IsUtf8Name` refuses ill-formed UTF-8 (overlong forms, surrogates, past U+10FFFF, stray or missing continuation octets) and NUL. `crypto_x509_audit`, block X509-3, ten refusals and four multi-octet names that still mint. |
| X509-4 | Low | `std/crypto/x509.ts:1163` (`x509ParseCertificate`) | The `[1]`, `[2]` and `[3]` elements after the subject public key were read as opaque TLVs, against the module's stated DER strictness: `[3]` holding a NULL, an empty SEQUENCE or a SEQUENCE and more parsed, and a unique identifier with no contents, 8 unused bits, unused bits and no octet, or a set unused bit parsed. No forgery follows (the signature covers these bytes), but it is a certificate the module promised to refuse. | Fixed: `x509DerExtensionsSound` holds `[3]` to one non-empty SEQUENCE and `x509DerBitStringSound`, now also behind `x509DerBitStringOctets`, holds a unique identifier to a DER BIT STRING. `crypto_x509_audit`, block X509-4, nine refusals and five sound shapes that still read. |
| X509-5 | Low | `std/crypto/x509.ts:1049`, `:1193`, `:1222` (documentation) | `x509ParseChain` described its input as "a server's chain, leaf first" without saying it relates nothing, and `x509VerifySignature` said "names, times and extensions are the caller's policy" although the certificate exposes no extensions, so a caller *cannot* apply basicConstraints, keyUsage or critical-extension policy. A parser read as a validator. | Fixed: the three doc comments now state that nothing does RFC 5280 §6 path validation, what is not checked (order, issuance, validity against a clock, notBefore ≤ notAfter, basicConstraints, keyUsage, name constraints, critical extensions, a trust anchor) and that extensions are neither checked nor exposed. `crypto_x509_audit`, block X509-5, pins the unchecked properties so a change that starts checking one says so. |
| X509-6 | Low | `std/crypto/x509.ts:1256` (`x509MintSelfSigned`) | The mint takes its private key and serial from the caller, and this module cannot draw them itself: one call to `crypto.getRandomValues` anywhere in `x509.ts` makes every program that imports it refuse to compile for wasm32. A caller that passes a counter or a fixed serial gets a predictable certificate. | Partly fixed: the module comment's example now draws the key and the serial from `crypto.getRandomValues`, and says why the module does not. **Open**: a helper that draws both (for example `std/crypto/x509-random.ts`, imported only by native programs) is outside this stage's files. |
| X509-7 | Low | `std/crypto/x509.ts:1022` (`x509ParseP256PrivateKey`) and the arena | Private-key material — the PEM text, the decoded DER, the scalar copies — is never wiped; it stays in arena memory until that memory is reused. The language has no zeroisation primitive a compiler must not elide. | **Closed in this change.** `x509ParseP256PrivateKey` answers `Secret<u8[]> \| null` from `nish:secret` (docs/LANGUAGE.md, "Secrets"), and `x509MintSelfSigned` takes one. The scalar is copied out of the DER once, after the structure is known to be sound, straight into the `Secret` that owns it; a key the public-key check refuses is wiped before `null` is answered; and every block `pemToDer` decoded, of either label and whatever the answer, is wiped before the parse returns — a volatile `llvm.memset` no optimiser removes (`tests/run.js`, "nish:secret: the wipe survives opt -O2"). **What is still not reached**: the PEM text itself, which is the caller's string, and a string in the language is immutable and cannot be zeroed; read a key with `readFileBytesSync` and keep the text short-lived. `crypto_x509`, `_audit`, `_malformed` and `_f64` answer as before through `tests/link/crypto_x509/plain.ts`, which reads the parsed key back through `expose`. |
| X509-8 | Low | `std/crypto/x509.ts:988` (`x509Pkcs8Key`), reached from `x509ParseP256PrivateKey` | A version-1 OneAsymmetricKey's outer `[1]` public key (RFC 5958 §2, `[1] IMPLICIT BIT STRING`) was stepped over unread: neither checked as a DER BIT STRING nor compared with the key's own point, although `x509ParseP256PrivateKey` promises `null` for "a stored public key that is not the key's own" and the embedded SEC1 key's `[1]` already got both checks. No wrong key could result, since the scalar is what is returned and every public key is derived from it. | Fixed: the field is read as a BIT STRING (unused-bits octet 0, then the point) through `x509DerBitStringOctets` and must equal the 65-octet uncompressed point `p256PublicKey` derives from the scalar. `crypto_x509_audit`, block X509-8: another key's point, an empty `[1]`, 8 and 1 unused bits, and a 64-octet point answer `null`; the key's own point, and no outer key, still read. |
| X509-9 | Low | `std/crypto/x509.ts:1319` (`x509MintExtensions`), `:1338` (`x509MintSelfSigned`) | The minted certificate carried no `[3] extensions`, on the reading that the W3C WebTransport text requires none. Chromium requires one: `WebTransportFingerprintProofVerifier` parses the certificate with quiche's `CertificateView::ParseSingleCertificate` before it compares the pinned hash, and that answers null when the extensions are absent (`quiche/quic/core/crypto/certificate_view.cc:395`, at quiche 62826931, the revision Chromium 141's `DEPS` pins; every extension must also be `SEQUENCE { OID, BOOLEAN OPTIONAL, OCTET STRING }`, `:413`–`:432`, and subjectAltName is read only when present, `:434`). So Chrome refused every minted certificate with CERTIFICATE_VERIFY_FAILED (alert 46), while an OpenSSL certificate with one extension worked — found by the interop job's `chrome (minted certificate)` lane (#487). Low: the mint's stated purpose, a certificate `serverCertificateHashes` accepts, failed in Chromium, but nothing was accepted that should not have been. | Fixed: the TBS ends with a constant 34-octet block, basicConstraints (critical, cA FALSE) then keyUsage (critical, digitalSignature alone). No subjectAltName, since quiche does not ask for one. Key, signature algorithm and the 14-day cap are unchanged. `crypto_x509`, `extensionsChecks`: the block octet for octet with both critical flags, the round trip through `x509ParseCertificate`, the SHA-256 over the new DER, and the certificate from before the fix still parsing; OpenSSL 3.0.13 prints both extensions and verifies it as its own trust anchor, also with `-purpose sslserver`. The new golden DER and SHA-256 are in `crypto_x509` and `_f64`. Chrome accepting it live is the interop job's to show. |

No finding reached Medium or above: nothing panicked, looped or allocated
beyond the input's size, and no edited input produced a signature, key or
certificate that passes for the original.

## Properties verified

| Property | Pinned by |
| --- | --- |
| No malformed certificate, key, signature or PEM input panics, among 25,701 derived from every valid fixture | `tests/link/crypto_x509_malformed` (the process reaches its summary) |
| Every truncated certificate, key and signature DER is refused | `crypto_x509_malformed`: every "DER" line (truncations are counted among the refused) and `crypto_x509` "a truncated DER is refused" |
| No edit to a certificate's framing, algorithm or signature encoding leaves one that reads back with the original TBS and verifies under the original issuer | `crypto_x509_malformed`: "golden / CA / leaf certificate DER" |
| DER spells each ECDSA `r || s` one way: no edited ECDSA-Sig-Value decodes to the original's | `crypto_x509_malformed`: "golden / leaf signature DER" |
| No edit to a private key yields a different key; the one that yields the same is PKCS#8 version 0 → 1, which RFC 5958 allows | `crypto_x509_malformed`: the four "key DER" lines |
| A cut PEM file answers `null` or the blocks before the cut, byte for byte (cutting only the final line feed keeps the whole file) | `crypto_x509_malformed`: the four "PEM" lines |
| Lengths: indefinite, non-minimal, long form below 128 and past 2^31 − 1 are refused | `crypto_x509`: "an indefinite length …", "a length with a leading zero octet …", "a long-form length below 128 …", "a four-octet length past 2^31 - 1 …" |
| INTEGERs are minimal; BIT STRINGs of keys and signatures have no unused bits | `crypto_x509`: "a serial with a redundant zero octet …", "a signature with unused bits …" |
| The TBS algorithm must equal the outer one; only v1, v2, v3 with their permitted trailing fields | `crypto_x509`: "a TBS algorithm unlike the outer one …", "an explicit version v1 …", "extensions in a v1 certificate …" |
| Times must be a real date in RFC 5280's forms | `crypto_x509`: "month 13 is refused", the leap-day, 2049/2050 and 9999 round trips |
| PEM is RFC 7468's strict form, base64 canonical | `crypto_x509` block "x509 pem", `crypto_x509_audit` block X509-1, X509-2 |
| Private keys: P-256 only, scalar in [1, n), stored public key the key's own, one key only | `crypto_x509` block "x509 keys", `crypto_x509_audit` block X509-1 |
| The mint writes basicConstraints (critical, cA FALSE) and keyUsage (critical, digitalSignature), so Chromium's quiche parses it (X509-9) | `crypto_x509` "x509 mint": the extension block octet for octet, read back, hashed |
| The mint refuses days outside 1..14, times before 1970 or past 9999, empty, long or non-UTF-8 names, zero or over-long serials, and keys outside [1, n) | `crypto_x509` block "x509 mint", `crypto_x509_audit` block X509-3 |
| What the parsers do not check is stated, and pinned | `crypto_x509_audit` block X509-5 |
| Answers do not move under `--number-mode f64` | `crypto_x509_f64` |

What was checked and is deliberately left as it is: `x509ParseCertificate`
accepts a GeneralizedTime before 2050, which RFC 5280 §4.1.2.5 asks issuers not
to write but which is a different certificate (and hash), not a second spelling
of the same one; and a negative or zero serial, which §4.1.2.2 asks verifiers to
handle gracefully. Both were documented already.

## Doc corrections for the security-policy stage

`std/README.md`'s `crypto/x509.ts` row should say, in the words of the module
comment it summarises:

- `x509ParseCertificate` and `x509ParseChain` parse and do not validate: no path
  validation, no extension is read or exposed, and no clock is consulted.
- `pemToDer` refuses a file in which any block, of any label, is malformed.
- `x509MintSelfSigned` refuses a common name that is not UTF-8 or holds a NUL,
  and its key and serial must come from `crypto.getRandomValues` (X509-6).
