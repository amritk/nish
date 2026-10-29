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
| DER reading | `x509DerRead`, `x509DerReadInto`, `x509DerExpect`, `x509DerExpectInto`, `x509DerText`, `x509DerPeek`, `x509DerIntegerMinimal`, `x509DerSmallInteger`, `x509DerBitStringOctets`, `x509DerTime`, `x509DerIsAlgorithm`, `x509DerIsAlgorithmNull`, `x509DerUnsignedInto`, `x509DerSignatureRS` (exported since #361) and `x509DerSignatureRSWidth` (P-384's 48 octets), `x509DerBitStringSound`, `x509DerOidSound`, `x509DerNonNegative`, `x509DerIsTrue` |
| Algorithms | the `X509SigAlg` result, `x509SignatureAlgorithm`, `x509PssParams`, `x509DerHashAlgorithm`, `x509KeyType` (X509-13) |
| Extensions | `x509ReadExtensions` (which replaced `x509DerExtensionsSound`), `x509ExtensionArc`, `x509ReadExtension` and the readers it calls: `x509ReadSubjectAltName`, `x509GeneralNameKind`, `x509DerIa5Name`, `x509ReadBasicConstraints`, `x509ReadKeyUsage`, `x509ReadExtKeyUsage`, `x509ReadNameConstraints`, `x509ReadSubtrees`, `x509DerBoundSound`, `x509MaskContiguous`, `x509ReadSubjectKeyId`, `x509GeneralNamesSound`, `x509ReadAuthorityKeyId` (X509-10, X509-11), and the `X509_MAX_EXTENSIONS` cap (X509-14) |
| Names | `x509DerNameSound`, `x509NameEqual`, `x509NameIsPrefix` (X509-12, X509-13) |
| PEM and base64 | `pemToDer`, `derToPem`; the base64 is `base64StdPadDecode` and `base64StdPadEncode` in `std/crypto/base64url.ts` |
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
the mint. Since X509-10 that includes every extension the parser decodes: a
path validator (none is in `std/` yet; one is planned under #987) takes its answers — the CA bit, path length, key
usage, the names a leaf is for and the subtrees a CA may issue under — as the
certificate's, so a reader that answers more than the bytes say, or answers
for a second spelling of an extension, moves a trust decision. The attacker does not control the private key or the serial a caller
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
  extensions, UTCTime and GeneralizedTime), §4.2.1.1 to §4.2.1.10 and §4.2.1.12
  (the seven extensions decoded), §7.1 (Name comparison, X509-12), RFC 7468
  (PEM), RFC 5915, RFC 5208 and RFC 5958 (private keys), RFC 3279 §2.2.3
  (ECDSA-Sig-Value), RFC 4055 §2.1 and §3.1 and RFC 8017 Appendix C (RSA
  PKCS#1 v1.5 and RSASSA-PSS parameters), RFC 5480, RFC 5758 and RFC 8410 (EC
  and Ed25519 identifiers), and RFC 3629 with Unicode 15 §3.9 Table 3-7
  (well-formed UTF-8).
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
  the module as it was before this record's fixes.
- **Corpus**, `tests/link/crypto_x509_malformed`: every valid fixture of
  `tests/link/crypto_x509` — the golden, CA and leaf certificates, two of their
  signatures, the RFC 6979 A.2.5 and OpenSSL CA keys as SEC1 and PKCS#8, and
  four PEM files — cut at every length, every DER bit flipped, a random bit of
  every PEM character flipped, and 600 (DER) or 300 (PEM) random edits from a
  fixed xorshift32 seed: an octet set to a random or boundary value (`00 7f 80
  81 82 84 ff`), deleted or inserted. **25,701 inputs**, about 4.7 s and 10 MB,
  run by `npm test` (25,281 until X509-9 gave the golden certificate its 34
  octets of extensions, which the corpus now cuts and flips too). Each input
  must return without a panic and must not come back as something it should
  not be (the program's header states the four properties). Against `main`'s
  `x509.ts` before this change the same corpus also runs clean; the change
  moves its counts only where the tighter `[3]` check refuses more (the CA
  certificate, then the one fixture with extensions: 1,527 refused before, 1,547
  after; the leaf-and-CA PEM: 1,917 before, 1,918 after). X509-10 moves them
  again, only toward refusal: an edit inside the golden and CA certificates'
  basicConstraints and keyUsage, or the leaf's, that framed sound before now
  decodes as a malformed extension. Golden 1,479 refused before, 1,813 after;
  CA 1,547 and 1,947; leaf 1,368 and 1,488; the golden PEM 1,079 and 1,113; the
  leaf-and-CA PEM 1,918 and 1,963. The input counts, the signature and key
  lines, and every property, are unchanged.
- **Mutation**, for X509-10 to X509-13: each guard the change adds that
  answers `null`, `false` or `X509_SIG_UNKNOWN` was replaced by `false` in
  turn, and `crypto_x509` and `_audit` rerun; 49 of 51 fail. The two that
  survive are `x509DerIsAlgorithm`'s tag check, which predates the change and
  which the P-256 key reader relies on, and keyUsage's length check, now
  `n > 2` alone: `n < 1` was dead (an empty BIT STRING's unused-bits count is
  held to 0, so the lowest-bit check refuses it) and is removed, and `n > 2`
  keeps `1 << bit` below 32, which "a keyUsage of five octets" (bit 32 alone,
  which a wrapping shift reads as digitalSignature) now pins. Ten clause mutations (duplicate, IA5 octets, NUL, a negative
  or five-octet path length, PSS's MGF hash and OID, the `unknownCritical`
  and both `ncUnsupported` assignments) each fail a named check.
  Nineteen more, one for each clause the review of the change added (PSS's
  salt and trailer DEFAULTs, otherName and registeredID, the empty dNSName,
  a subtree's minimum, maximum and trailing bytes, the empty key
  identifiers, the issuer's GeneralNames and serial), each fail one too.
  A second sweep then neutralised each operand of every compound condition in
  the new and changed functions, one at a time (`false` under `||`, `true`
  under `&&`), and found 20 that no check failed; each now has an isolating
  check in `crypto_x509`: the extnID arc test's three clauses (`551d1301`,
  `551e13` and `2a1d13`, each holding a basicConstraints value with cA TRUE
  and read as an unknown extension with nothing decoded), an otherName
  type-id that is not an OID, an OID with an inner `0x80` octet (which must
  read), PSS parameters under another OID and an element after them,
  `x509NameIsPrefix` with bytes after the base, a directoryName with bytes
  after its Name, an x400Address and an ediPartyName (each counted in
  `sanOther`), trailing bytes after the subjectAltName, keyUsage,
  extKeyUsage, nameConstraints, subjectKeyIdentifier and
  authorityKeyIdentifier values, a two-octet BOOLEAN as the critical flag
  and as cA, a five-octet keyUsage, and `[1]`, `[2]` or `[3]` in a version
  that does not have them. Two are equivalent and stay unpinned:
  `x509DerIsTrue`'s tag test (both callers peek for a BOOLEAN first) and
  `x509NameIsPrefix`'s soundness test of the base (each base RDN must equal,
  byte for byte, an RDN of a name that is itself checked). The bounds tests
  that only keep a load in range (`k >= 0 && k < der.length`) and
  `x509DerReadInto`'s caller-contract guards are equivalent too, since the
  length check that follows refuses the same inputs.
- **wasm32 check.** Whether this module could draw randomness itself: a module
  that calls `crypto.getRandomValues` fails to compile for
  `--target wasm32-unknown-unknown` and `wasm32-wasi` (`` `crypto.getRandomValues`
  reaches the operating system, and a wasm32 build has none to reach ``), in any
  function, used or not — see X509-6, which is why the drawing lives in
  `std/crypto/x509-random.ts` instead.

## Findings

Line numbers for X509-1 to X509-9 are those of `std/crypto/x509.ts` at
`89e2857`, which moved its padded base64 into `nish/crypto/base64url`; for
X509-10 to X509-14, those of the change that decodes the extensions, as it
was merged.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| X509-1 | Low | `std/crypto/x509.ts:749` (`pemToDer`), reached from `x509ParseP256PrivateKey` | `pemToDer` decoded only the blocks whose label it was asked for. `x509ParseP256PrivateKey` asks once for `EC PRIVATE KEY` and once for `PRIVATE KEY`, so a PEM holding a good SEC1 key and a malformed `PRIVATE KEY` block read the second as absent and answered the SEC1 key, where the function promises `null` for "more than one" key and "anything malformed". | Fixed: every block is decoded whatever its label. `crypto_x509_audit`: "a SEC1 key beside a malformed PRIVATE KEY block answers null", "a PKCS#8 key beside a malformed EC PRIVATE KEY block answers null". |
| X509-2 | Low | `std/crypto/x509.ts:749` (`pemToDer`) | The documentation says blocks with other labels "must be as well formed", but their base64 was never checked: a certificate beside a block of another label holding `A!!A`, or with padding bits set, was accepted. | Fixed by the same change. `crypto_x509_audit`: "a certificate beside a block of another label that is not base64 answers null", "… with padding bits set answers null". |
| X509-3 | Low | `std/crypto/x509.ts:1245` (`x509MintSelfSigned`) | The common name was written as a UTF8String whatever its bytes; a string in the language need not be UTF-8 (`String.fromCharCode`, WTF-8 escapes), so the mint could sign a certificate whose name is not UTF-8, or holds a NUL that C code reads as the end of the name. | Fixed: `x509IsUtf8Name` refuses ill-formed UTF-8 (overlong forms, surrogates, past U+10FFFF, stray or missing continuation octets) and NUL. `crypto_x509_audit`, block X509-3, ten refusals and four multi-octet names that still mint. |
| X509-4 | Low | `std/crypto/x509.ts:1108` (`x509ParseCertificate`) | The `[1]`, `[2]` and `[3]` elements after the subject public key were read as opaque TLVs, against the module's stated DER strictness: `[3]` holding a NULL, an empty SEQUENCE or a SEQUENCE and more parsed, and a unique identifier with no contents, 8 unused bits, unused bits and no octet, or a set unused bit parsed. No forgery follows (the signature covers these bytes), but it is a certificate the module promised to refuse. | Fixed: `x509DerExtensionsSound` holds `[3]` to one non-empty SEQUENCE and `x509DerBitStringSound`, now also behind `x509DerBitStringOctets`, holds a unique identifier to a DER BIT STRING. `crypto_x509_audit`, block X509-4, nine refusals and five sound shapes that still read. `x509DerExtensionsSound` is since replaced by `x509ReadExtensions` (X509-10), which keeps the same outer check and reads each extension; the block still passes, its `[3]` with "a real extension" now a whole basicConstraints. |
| X509-5 | Low | `std/crypto/x509.ts:1006`, `:1144`, `:1175` (documentation) | `x509ParseChain` described its input as "a server's chain, leaf first" without saying it relates nothing, and `x509VerifySignature` said "names, times and extensions are the caller's policy" although the certificate exposes no extensions, so a caller *cannot* apply basicConstraints, keyUsage or critical-extension policy. A parser read as a validator. | Fixed: the three doc comments now state that nothing does RFC 5280 §6 path validation, what is not checked (order, issuance, validity against a clock, notBefore ≤ notAfter, basicConstraints, keyUsage, name constraints, critical extensions, a trust anchor) and that extensions are neither checked nor exposed. `crypto_x509_audit`, block X509-5, pins the unchecked properties so a change that starts checking one says so. **Narrowed by X509-10**: extensions are now exposed, so the comments say the module parses them and that no module in `std/` does path validation yet (planned as `nish/crypto/pki`), which leaves applying them to the caller; what is still not checked here is order, issuance, the clock, notBefore ≤ notAfter, what basicConstraints, keyUsage and name constraints mean for a chain, and a trust anchor. The block's pins are unchanged. |
| X509-6 | Low | `std/crypto/x509.ts:1227` (`x509MintSelfSigned`) | The mint takes its private key and serial from the caller, and this module cannot draw them itself: one call to `crypto.getRandomValues` anywhere in `x509.ts` makes every program that imports it refuse to compile for wasm32. A caller that passes a counter or a fixed serial gets a predictable certificate. | **Fixed** (#385): `std/crypto/x509-random.ts`, `nish/crypto/x509-random`, a native-only module that `x509.ts` does not import. `x509DrawP256Key` draws 32 octets from `crypto.getRandomValues` into a `Secret<u8[]>` and draws again until `p256PublicKey` accepts them as a scalar in [1, n), wiping each refused draw (rejection, not reduction mod n, so no key is likelier than another); `x509DrawSerial` draws twenty octets and sets the first one's top bits to `01`, so the serial is positive, non-zero and always twenty octets, with 158 random bits; `x509MintSelfSignedDrawn(priv, commonName, notBeforeMs, days)` mints with a drawn serial. The key stays the caller's to wipe, since a server signs its handshakes with it. `tests/link/crypto_x509_random`: two drawn keys differ, 65 serials have the promised shape and differ, and certificates minted with drawn keys and serials parse, carry that key and serial, verify under themselves and differ from each other. `tests/link/crypto_x509_random_wasm`: a wasm32 build importing the module is refused, and `tests/run.js` compiles its `x509-only.ts`, which imports `nish/crypto/x509` alone, for wasm32 (a call to `crypto.getRandomValues` put into `x509.ts` fails that check). The module comment's example now uses the helper. |
| X509-7 | Low | `std/crypto/x509.ts:964` (`x509ParseP256PrivateKey`) and the arena | Private-key material — the PEM text, the decoded DER, the scalar copies — is never wiped; it stays in arena memory until that memory is reused. The language has no zeroisation primitive a compiler must not elide. | **Closed in this change.** `x509ParseP256PrivateKey` answers `Secret<u8[]> \| null` from `nish:secret` (docs/LANGUAGE.md, "Secrets"), and `x509MintSelfSigned` takes one. The scalar is copied out of the DER once, after the structure is known to be sound, straight into the `Secret` that owns it; a key the public-key check refuses is wiped before `null` is answered; and every block `pemToDer` decoded, of either label and whatever the answer, is wiped before the parse returns — a volatile `llvm.memset` no optimiser removes (`tests/run.js`, "nish:secret: the wipe survives opt -O2"). **What is still not reached**: the PEM text itself, which is the caller's string, and a string in the language is immutable and cannot be zeroed; read a key with `readFileBytesSync` and keep the text short-lived. `crypto_x509`, `_audit`, `_malformed` and `_f64` answer as before through `tests/link/crypto_x509/plain.ts`, which reads the parsed key back through `expose`. |
| X509-8 | Low | `std/crypto/x509.ts:921` (`x509Pkcs8Key`), reached from `x509ParseP256PrivateKey` | A version-1 OneAsymmetricKey's outer `[1]` public key (RFC 5958 §2, `[1] IMPLICIT BIT STRING`) was stepped over unread: neither checked as a DER BIT STRING nor compared with the key's own point, although `x509ParseP256PrivateKey` promises `null` for "a stored public key that is not the key's own" and the embedded SEC1 key's `[1]` already got both checks. No wrong key could result, since the scalar is what is returned and every public key is derived from it. | Fixed: the field is read as a BIT STRING (unused-bits octet 0, then the point) through `x509DerBitStringOctets` and must equal the 65-octet uncompressed point `p256PublicKey` derives from the scalar. `crypto_x509_audit`, block X509-8: another key's point, an empty `[1]`, 8 and 1 unused bits, and a 64-octet point answer `null`; the key's own point, and no outer key, still read. |
| X509-9 | Low | `std/crypto/x509.ts:1208` (`x509MintExtensions`), `:1286` (`x509MintSelfSigned`) | The minted certificate carried no `[3] extensions`, on the reading that the W3C WebTransport text requires none. Chromium requires one: `WebTransportFingerprintProofVerifier` parses the certificate with quiche's `CertificateView::ParseSingleCertificate` before it compares the pinned hash, and that answers null when the extensions are absent (`quiche/quic/core/crypto/certificate_view.cc:395`, at quiche 62826931, the revision Chromium 141's `DEPS` pins; every extension must also be `SEQUENCE { OID, BOOLEAN OPTIONAL, OCTET STRING }`, `:413`–`:432`, and subjectAltName is read only when present, `:434`). So Chrome refused every minted certificate with CERTIFICATE_VERIFY_FAILED (alert 46), while an OpenSSL certificate with one extension worked — found by the interop job's `chrome (minted certificate)` lane (#487). Low: the mint's stated purpose, a certificate `serverCertificateHashes` accepts, failed in Chromium, but nothing was accepted that should not have been. | Fixed: the TBS ends with a constant 34-octet block, basicConstraints (critical, cA FALSE) then keyUsage (critical, digitalSignature alone). No subjectAltName, since quiche does not ask for one. Key, signature algorithm and the 14-day cap are unchanged. `crypto_x509`, `extensionsChecks`: the block octet for octet with both critical flags, the round trip through `x509ParseCertificate`, the SHA-256 over the new DER, and the certificate from before the fix still parsing; OpenSSL 3.0.13 prints both extensions and verifies it as its own trust anchor, also with `-purpose sslserver`. The new golden DER and SHA-256 are in `crypto_x509` and `_f64`. `crypto_x509/handshake.ts` presents a freshly minted certificate in a TLS 1.3 handshake through `nish/net/tls`, which a scripted client accepts under the key it reads from that certificate; the `nish/net` cases present a frozen pre-X509-9 certificate instead (`tests/link/net_tls_common/server.ts`), since aioquic's recordings carry it in their transcripts. Chrome accepting it live is the interop job's to show. |
| X509-10 | Low | `std/crypto/x509.ts:1923` (`x509ReadExtensions`) and the readers it calls, `:1525`–`:1882` | Until this change the parser read no extension, so none could be malformed and a validator had nothing to apply (X509-5). Decoding them adds the surface a validator trusts: a reader that took the first of two subjectAltNames, ignored bytes after a basicConstraints SEQUENCE, accepted a DEFAULT written out, or let a dNSName carry a NUL or an eight-bit octet would hand a validator a second spelling of the certificate's policy, or one that a C validator reads differently. | Fixed as it lands: every extension is `SEQUENCE { OID, BOOLEAN DEFAULT FALSE, OCTET STRING }` with the BOOLEAN DER's TRUE when present; an extnID repeated, by its (unique, `x509DerOidSound`) encoding, refuses the certificate (§4.2); each of the seven decoded extensions must fill its OCTET STRING exactly, with DEFAULTs omitted, INTEGERs minimal and non-negative, a path length of at most four octets, keyUsage's BIT STRING minimal (no trailing zero bits), IA5 names below 0x80 and without NUL (an rfc822Name or URI too: neither is exposed, but one with an octet of 0x80 or more refuses the certificate rather than being counted in `sanOther`, since a C validator reading the same name would see another string), a subjectAltName dNSName not empty, iPAddresses of 4 or 16 octets, an otherName a sound OID and one `[0]` value and a registeredID a sound OID, nameConstraints masks contiguous and a subtree's minimum and maximum minimal, non-negative and in order (a minimum of 0 is the DEFAULT, so written out it refuses), a key identifier not empty, and an authorityKeyIdentifier's issuer a non-empty run of GeneralNames with its serial a minimal INTEGER. An x400Address or ediPartyName is taken as one element whose contents are not read; no field this module exposes holds one. Issuer and subject must now be sound Names (`x509DerNameSound`). A nameConstraints form this module does not decode sets `ncUnsupported`, which a validator must refuse, and so does a subtree with a minimum or a maximum (RFC 5280 §4.2.1.10 says neither is used). `crypto_x509` block "x509 extension refusals", 180 checks, each refusal paired with the sound encoding beside it; `crypto_x509_audit`, block X509-10. |
| X509-11 | Low | `std/crypto/x509.ts:1923` (`x509ReadExtensions`) | RFC 5280 §4.2 obliges a validator to refuse a certificate with a critical extension it does not process. A parser that dropped unknown extensions silently would leave a validator no way to know one was there. | Fixed as it lands: an extension outside the seven decoded, critical, sets `unknownCritical`; a non-critical one is skipped. The parser does not refuse it, since whether to accept a certificate is the validator's call (a CRL distribution point, say, is critical in some private PKIs). `crypto_x509` "x509 Web PKI algorithms and keys" (the OpenSSL unknown-critical certificate and private extensions built around it); `crypto_x509_audit`, block X509-11. |
| X509-12 | Low | `std/crypto/x509.ts:1419` (`x509NameEqual`), `:1428` (`x509NameIsPrefix`) | RFC 5280 §7.1 compares Names after a stringprep of each attribute value — case folded, white space collapsed, PrintableString and UTF8String alike. This module compares their DER byte for byte. | **Open**, fails closed: a Name §7.1 would match but spelled differently answers `false`, so an issuer whose subject is re-encoded does not chain and a directoryName constraint does not match, and nothing is accepted that should not be. A CA that re-encodes its own Name is already out of profile (§4.1.2.4 asks issuers to keep the encoding). `crypto_x509_audit`, block "X509-12 and X509-13", pins the PrintableString and case mismatches. |
| X509-13 | Low | `std/crypto/x509.ts:826` (`x509SignatureAlgorithm`), `:774` (`x509PssParams`), `:1384` (`x509DerNameSound`) | Two choices that answer for more than one spelling would move trust. Algorithm parameters: RFC 4055 lets a reader accept SHA-2 with absent or NULL parameters, PSS has DEFAULTs, and an ECDSA or Ed25519 identifier with a NULL is a common mistake; DER's SET OF order within a multi-valued RDN is not checked. | Algorithms: **fixed as it lands**, held strictly — ECDSA and Ed25519 with parameters absent, PKCS#1 v1.5 with NULL, and RSASSA-PSS only with a SHA-2 hash named, MGF1 over that same hash, a salt of 0 to 127 and trailer 1, each DEFAULT left out as DER requires (a salt of 20 or a trailerField of 1 written out is a second spelling); anything else is `X509_SIG_UNKNOWN` (or `X509_KEY_UNKNOWN`), which no verifier takes. `crypto_x509` "x509 signature algorithms and key types", 46 checks, among them an element after each PSS field, a two-octet salt, hash parameters other than NULL, and a NULL with contents or a second NULL after it. SET OF order: **open**, fails closed: an unsorted RDN is a sound Name but matches only itself byte for byte, never its sorted spelling. `crypto_x509_audit`, block "X509-12 and X509-13". The index counts X509-13 open while its SET OF half is. |
| X509-14 | Medium | `std/crypto/x509.ts:179` (`X509_MAX_EXTENSIONS`), `:1938` (`x509ReadExtensions`) | The repeated-extnID check compares each extension's OID with every one before it, so its cost is quadratic in the extension count, and nothing bounded the count: a certificate of about 16 MB, the most a TLS 1.3 Certificate message carries, can hold about a million and a half empty private extensions with distinct OIDs (a repeat refuses at once), some 10¹² comparisons before the parser answers. Anything that parses a peer's certificate, before any signature is checked, could be held there. | **Fixed as it lands**: a certificate with more than 64 extensions is refused (a Web PKI certificate carries fewer than 20). With the cap the parse is linear in the certificate's length, which is why no cap on the DER's length was added: the caller bounds what it reads. `crypto_x509_audit`, block X509-14: 32 and 64 extensions read, 65 and 127 are refused. |

One finding reached Medium, X509-14, a quadratic cost fixed before it
merged. Nothing panicked, looped or allocated beyond the input's size, and no
edited input produced a signature, key or certificate that passes for the
original.

## Fuzzing

Fuzzed by `tests/fuzz/targets/x509-der.ts`, `tests/fuzz/targets/x509-pem.ts`.

| Target | What it drives | Executions |
| --- | --- | ---: |
| `x509-der` | `x509DerSignatureRS`, `x509DerSignatureRSWidth` at 48 and `x509ParseCertificate` over the input; a parsed certificate's signature at both widths and through `x509VerifySignature`, its issuer and directoryName constraints through `x509NameIsPrefix`, and its decoded extensions against their promised ranges (since X509-10) | 179,115,232 |
| `x509-pem` | `pemToDer` for a certificate, `x509ParseChain` (each certificate verified against the next) and `x509ParseP256PrivateKey`, whose key and decoded DER are wiped | 12,181,605 |

Each target ran for 31 minutes (1,861 s, one core each, four at a time) on commit `b52b765`, starting from its seed corpus in `tests/fuzz/corpus/<target>/`, with libFuzzer's `-timeout=1 -rss_limit_mb=2048`; every panic, sanitizer report, timeout and OOM counts as a finding. **None found**: no crash, timeout or OOM (a target's own contract check fails by panicking, so it counts too). The `x509-der` count predates X509-10, whose extension, algorithm and Name readers it has not run against at length; the change adds the OpenSSL RSA, RSASSA-PSS, P-384, Ed25519, unknown-critical and every-extension certificates to its seed corpus, which CI replays, and a campaign over them is still to run. The libFuzzer harness these targets build against lands with the harness stage of #888; a new finding adds a row to Findings above, with its input kept as a regression and a link check that replays it.

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
| The mint writes basicConstraints (critical, cA FALSE) and keyUsage (critical, digitalSignature), so Chromium's quiche parses it (X509-9) | `crypto_x509` "x509 mint": the extension block octet for octet, read back, hashed; "x509 mint in a TLS handshake": presented and accepted |
| The mint refuses days outside 1..14, times before 1970 or past 9999, empty, long or non-UTF-8 names, zero or over-long serials, and keys outside [1, n) | `crypto_x509` block "x509 mint", `crypto_x509_audit` block X509-3 |
| What the parsers do not check is stated, and pinned | `crypto_x509_audit` block X509-5 |
| Each extension appears once and each decoded one fills its value exactly, in DER | `crypto_x509` "x509 extension refusals", `crypto_x509_audit` block X509-10 |
| An unknown critical extension is reported, a known or non-critical one is not | `crypto_x509` "x509 Web PKI algorithms and keys", `crypto_x509_audit` block X509-11 |
| Every OpenSSL fixture reads to what `openssl x509 -text` prints for it | `crypto_x509` "x509 Web PKI algorithms and keys" and "x509 every decoded extension" |
| A signature algorithm is named only in its one strict spelling | `crypto_x509` "x509 signature algorithms and key types" |
| Names compare byte for byte | `crypto_x509` "x509 Names", `crypto_x509_audit` block "X509-12 and X509-13" |
| A P-256 certificate parses as it did before X509-10 | `crypto_x509` (every earlier check, unchanged), `crypto_x509_malformed` (input counts unchanged) |
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
  validation and no clock is consulted. Since X509-10 the v3 extensions are read
  and exposed, but what they mean for a chain is the validator's, planned as
  `nish/crypto/pki`.
- `pemToDer` refuses a file in which any block, of any label, is malformed.
- `x509MintSelfSigned` refuses a common name that is not UTF-8 or holds a NUL,
  and its key and serial must come from `crypto.getRandomValues`, which
  `crypto/x509-random.ts` draws for a native program (X509-6).
