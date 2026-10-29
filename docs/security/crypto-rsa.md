# Security record: RSA and P-384 signature verification

The record of `nish/crypto/rsa`, `nish/crypto/p384` and the `nish/crypto/bignum`
arithmetic they share: RSASSA-PKCS1-v1_5 and RSASSA-PSS verification with
SHA-256, SHA-384 and SHA-512 (RFC 8017), and ECDSA verification over P-384
(SEC 1 §4.1.4). It sets down what each module accepts and refuses, the choices
a reviewer might question, what runs in variable time and why that is sound,
and the test that pins each property. It is written with the code rather than
after an audit, so that the audit starts from evidence.

Anchors are function names in `std/crypto/rsa.ts`, `std/crypto/p384.ts` and
`std/crypto/bignum.ts` on the head that merges this record.

**Result.** Every NIST CAVP and Project Wycheproof case the suites run answers
what its file expects, under the module's fixed parameters: RSA-PSS with MGF1
over the message's hash and a salt as long as the digest, and P-384 signatures
as raw `r || s`. A key, a signature or a hash id the modules do not take
answers `null` or `false`, never a panic. Everything the three modules handle
is public, so they run in variable time on purpose (RSA-1). Two bugs were found
and fixed while the code was written, before it landed: a NULL parameter with
content was taken as NULL, and an empty BIT STRING read its unused-bits byte
past the end and panicked ([Found before landing](#found-before-landing)).
Nothing is left open, and nothing is counted as fixed or open in the index.

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/rsa.ts` | `rsaParsePublicKey`, `rsaVerifyPkcs1`, `rsaVerifyPss`; the key: `RsaPublicKey`, `RsaDerCursor`, `rsaDerElement`, `rsaDerWhole`, `rsaDerPositive`, `rsaIsPkcs1Oid`, `rsaPublicKeyFrom`; the signature: `rsaHash`, `rsaOpen`, `rsaDigestInfoPrefix`, `rsaMgf1` |
| `std/crypto/p384.ts` | `p384Verify`, `p384VerifySha384`, `p384VerifySha256`; `P384Point`, `P384Curve`, `p384Curve`, `p384Prime`, `p384Order`, `p384CurveB`, `p384GeneratorX`, `p384GeneratorY`, `p384Limbs`, `p384Mul`, `p384Add`, `p384Sub`, `p384PointCopy`, `p384SetIdentity`, `p384PointAdd`, `p384PointDouble`, `p384AffinePoint`, `p384DecodePoint`, `p384Bit`, `p384TwinMult` |
| `std/crypto/bignum.ts` | `BnModulus`, `bnModulus`, `bnFromBytes`, `bnToBytes`, `bnCompare`, `bnIsZero`, `bnCopy`, `bnSubInPlace`, `bnDoubleMod`, `bnMontMul`, `bnToMont`, `bnFromMont`, `bnModAdd`, `bnModSub`, `bnReduceOnce`, `bnMontPow`, `bnMontInvertPrime` |

Out of scope: SHA-256 and SHA-384/512 (`std/crypto/sha256.ts`,
`std/crypto/sha512.ts`) and `timingSafeEqual` (`std/crypto/ct.ts`), all in
[crypto-k1.md](crypto-k1.md); the certificate around a key and the DER around
an ECDSA signature, which are `nish/crypto/x509`'s ([crypto-x509.md](crypto-x509.md));
and which keys a caller trusts.

## Threat model

The attacker sends the key, the message and the signature — a certificate
chain, a TLS `CertificateVerify` — and wins with a signature that verifies
when the key's owner did not make it, or with a key or signature that panics
the process, reads out of bounds or runs without end. Nothing secret is in
the modules: there is no signing, no decryption and no private key, so there
is nothing for a timing or cache attacker to learn (RSA-1).

## What the modules take

**RSA keys** come as a DER SubjectPublicKeyInfo. The algorithm is
rsaEncryption with NULL parameters (RFC 8017 A.1) or id-RSASSA-PSS with the
parameters absent or a SEQUENCE (RFC 4055 §3.1); any other OID, rsaEncryption
without its NULL or with anything else, and id-RSASSA-PSS with NULL are
refused. The DER is read strictly: definite, minimal lengths of at most two
bytes, positive minimal INTEGERs, a BIT STRING with no unused bits, nothing
after the last element. The modulus is 2048 to 8192 bits and odd; the
exponent is odd, at least 3 and at most 2^32.

**RSA signatures** are exactly the modulus's length and below it (RFC 8017
§8.1.2 step 1, §8.2.2 step 1); a hash id other than `RSA_SHA256`,
`RSA_SHA384` and `RSA_SHA512` answers `false`. PKCS#1 v1.5 builds the whole
expected encoding — 00 01, FF padding, 00, the DigestInfo and the digest — and
compares it with the opened signature byte for byte, so no DigestInfo is
parsed and there is no ASN.1 in the signature for a Bleichenbacher 2006-style
forgery to hide in. PSS runs every check of EMSA-PSS-VERIFY (§9.1.2) with
sLen = hLen and MGF1 over the message's hash (RSA-2).

**P-384 keys** are the 97-byte uncompressed SEC 1 encoding, the point on the
curve with both coordinates below p; **signatures** are `r || s`, 96 bytes,
each half in [1, n - 1]. The point arithmetic is the complete formulas of
Renes, Costello and Batina (Algorithms 4 and 6), so no doubling, inverse or
identity needs a case of its own, and u1 G + u2 Q is one Shamir pass. A sum
that is the identity is refused before its x-coordinate is read.

## Found before landing

Two bugs the suite caught while the code was written, before it landed. They
are described here with their tests, not counted in the index, as the module
never shipped with them.

- **A NULL holding a byte was taken as NULL.** `rsaParsePublicKey` checked the
  NULL tag of rsaEncryption's parameters and not its length, so `05 01 00`
  passed as the NULL RFC 8017 A.1 asks for. Harmless to the signature — the
  key is the same — but a lax encoding is a second spelling of one key, which
  certificate comparison by bytes trips on. Now the NULL must be `05 00`.
  Test: "rsaEncryption with a NULL holding a byte is refused".
- **An empty BIT STRING read past its end.** The unused-bits byte was read
  before the BIT STRING's length was checked, so `03 00` read one byte past
  the element and panicked on the bounds check — a crash an attacker could
  send in a certificate. Now an empty BIT STRING is refused first. Test: "an
  empty BIT STRING is refused".

## Findings

Rows RSA-1 to RSA-6 are the decisions a reviewer might question. They are
accepted, not flaws, and none is counted as fixed or open in the index.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| RSA-1 | Low if it failed | `bignum.ts`, `rsaOpen`, `p384TwinMult` | The arithmetic is variable-time: reductions subtract only when they must, `bnMontPow` skips the multiply at a zero exponent bit, `p384TwinMult` adds only where a scalar bit is set, and comparisons return early. | **Accepted.** Every value it runs on is public: the RSA modulus, exponent and signature, the P-384 key, digest and signature, and the scalars u1 and u2 computed from them. Verification holds no secret for timing to reveal. The module header of `bignum.ts` says never to hand it a private key or nonce; signing uses `nish/crypto/p256`'s fiat-crypto arithmetic, and there is no P-384 or RSA signing here. The final comparisons use `timingSafeEqual` anyway, which costs nothing. |
| RSA-2 | Low | `rsaVerifyPss`, `rsaParsePublicKey` | PSS verifies only with sLen = hLen and MGF1 over the message's hash; a signature made with another salt length or MGF hash answers `false`, and an id-RSASSA-PSS key's RSASSA-PSS-params are not read. | **Accepted.** These are the parameters TLS 1.3's `rsa_pss_*` schemes (RFC 8446 §4.2.3) and the CA/Browser Forum's Baseline Requirements fix. Reading the params would let a key declare a salt of 0, which the Web PKI does not use, and adds an ASN.1 parser the signature does not need. Wycheproof's `rsa_pss_2048_sha256_mgf1_0` and `rsa_pss_misc` cases signed under other parameters are counted as refused by design, and the one case marked invalid there because its salt is 32 rather than the file's 0 (tcId 69, "s_len changed to 32") verifies, as it must under sLen = hLen. |
| RSA-3 | Low | `rsaParsePublicKey` | A modulus below 2048 bits or above 8192, and an exponent above 2^32, are refused even when well formed. | **Accepted.** 2048 bits is the Baseline Requirements' floor; 8192 bounds the work an attacker's key can cost (each multiply of an 8192-bit verify costs about 16 times a 2048-bit one's) and the largest key Wycheproof tests. An exponent past 2^32 has no use and makes each verify slower in proportion to its length. |
| RSA-4 | Low | `p384Verify` | ECDSA signatures are malleable: when (r, s) verifies, so does (r, n - s). | **Accepted.** It is ECDSA's, and every verifier accepts both. A caller that needs one encoding per signature refuses the high `s` itself; the module header says so. Test: "SHA-384 with s replaced by n - s verifies". |
| RSA-5 | Low | `p384Verify` | A signature is raw `r || s`, not the DER ECDSA-Sig-Value X.509 and TLS carry. | **Accepted.** As `nish/crypto/p256`: unwrapping the DER is the caller's, and a strict reader keeps BER leniency out of the curve code. The test reads Wycheproof's DER file through its own strict reader (`tests/link/crypto_p384/der.ts`), which refuses the 234 malformed encodings before the module sees them. |
| RSA-6 | Low if it failed | `p384Curve`, `rsaVerifyPss` | Two refusals cannot be reached: `p384Curve` answers `null` only if `bnModulus` refused p or n, which are odd constants, and `rsaVerifyPss`'s emLen < hLen + sLen + 2 needs a modulus below 1040 bits, which `rsaParsePublicKey` never accepts. | **Holds.** Each branch answers `false` rather than panicking, so a later change to the constants or the bit limits fails safe; no test reaches them. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding. The
modules' own checks are lines of `tests/link/crypto_rsa/expected.out` and
`tests/link/crypto_p384/expected.out`, which
`link/crypto_rsa: exits with 0 and stdout matches expected.out` and
`link/crypto_p384: exits with 0 and stdout matches expected.out` compare byte
for byte; the same programs under `--number-mode f64` are
`link/crypto_rsa_f64: exits with 0 and stdout matches expected.out` and
`link/crypto_p384_f64: exits with 0 and stdout matches expected.out`.

**RSA key encoding**: "an empty input is refused", "a byte after the
SubjectPublicKeyInfo is refused", "a SubjectPublicKeyInfo one byte short is
refused", "a long-form length below 0x80 is refused", "a two-byte length
below 0x100 is refused", "an indefinite length is refused", "a three-byte
length is refused", "an AlgorithmIdentifier that runs past the key is
refused".

**RSA algorithm**: "sha256WithRSAEncryption is refused", "an OID off the
PKCS #1 arc is refused", "rsaEncryption without its NULL is refused",
"rsaEncryption with a NULL holding a byte is refused", "rsaEncryption with a
SEQUENCE for parameters is refused", "id-RSASSA-PSS without parameters is a
key", "id-RSASSA-PSS with RSASSA-PSS-params is a key", "id-RSASSA-PSS with
NULL parameters is refused".

**RSA key and limits**: "a BIT STRING with an unused bit is refused", "an
empty BIT STRING is refused", "a negative modulus is refused", "a modulus
with a needless zero byte is refused", "a zero exponent is refused", "a
2047-bit modulus is refused", "an 8192-bit modulus is a key", "an 8193-bit
modulus is refused", "an even modulus is refused", "e = 1 is refused", "e = 2
is refused", "e = 3 is a key", "e = 65536 is refused", "e = 2^32 - 1 is a
key", "e = 2^32 + 1 is refused", "a six-byte e is refused".

**RSA signatures**: "PKCS#1 v1.5 with the DigestInfo's NULL left out is
refused", "PKCS#1 v1.5 with 8 bytes after the digest is refused", "PSS
SHA-256 with no salt is refused", "PSS SHA-256 with a 20-byte salt is
refused", "PSS SHA-256 with MGF1 over SHA-1 is refused", "PSS with maskedDB's
top bit set is refused", "PSS under the 2049-bit key with the top byte 01 is
refused", "a valid PKCS#1 v1.5 SHA-256 signature does not verify as SHA-384",
"hash id 3 is refused by rsaVerifyPkcs1", "a 257-byte signature, a zero in
front, is refused by rsaVerifyPss", "s = n is refused by rsaVerifyPkcs1", "a
PSS-only key refuses a valid PKCS#1 v1.5 signature".

**RSA against the vector files**: "cavp SigVer15: every case answers what the
file expects", "cavp SigVerPSS: every case answers what the file expects",
and "wycheproof <file>: every case answers what the file expects" for the
five `rsa_signature_*` files (2048 to 8192 bits) and the six `rsa_pss_*`
files.

**P-384**: "SHA-384 verifies", "a digest of 48 FF bytes, above n verifies",
"under the key G, a digest of n - r and s = 1, which sums to the identity is
refused", "a 49-byte compressed key is refused", "prefix 02 on 97 bytes is
refused", "x = p is refused", "y = p is refused", "(Gx, Gy + 1), off the
curve, is refused", "a 95-byte signature is refused", "r = 0 is refused", "s
= 0 is refused", "r = n is refused", "s = n is refused", "r = p is refused",
"p384VerifySha384 verifies the SHA-384 signature", "and refuses the SHA-256
one", "cavp SigVer: every case answers what the file expects", "wycheproof
ecdsa_secp384r1_sha384_p1363: every case answers what the file expects",
"wycheproof ecdsa_secp384r1_sha256: every case answers what the file
expects".
