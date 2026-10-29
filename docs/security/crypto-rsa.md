# Security record: RSA signature verification

The record of `nish/crypto/rsa`, RSASSA-PKCS1-v1_5 and RSASSA-PSS verification
(RFC 8017 §8.1.2 and §8.2.2), which the TLS 1.3 client of #480 uses to check a
server's `CertificateVerify` and a certificate's signature (tracking issue
#993, stage "pubkey-verify"). It landed with the module, in the same change, as
CLAUDE.md's definition of done asks. Function names are at the module's first
commit; no `file:line` anchor is used, so none can drift.

**Result.** No forgery, panic, unbounded cost or non-canonical accept was
found. Every Wycheproof vector of the seven files run answers what its file
expects (1,313 cases), and 21 hand-built refusals pass, each aimed at a known
way RSA verifiers have failed. Three properties are recorded below as
decisions rather than defects; none is open.

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/rsa.ts` | `rsaParsePublicKey` and the DER reader it runs (`rsaDerExpect`, `rsaDerPositive`); `rsaVerifyPkcs1v15`, `rsaVerifyPss` and what they reach (`rsaPublicOp`, `rsaHash`, `rsaHashSize`, `rsaDigestInfoPrefix`, `rsaMgf1`); the Montgomery arithmetic `RsaMont` and `rsaMontNew`, and the limb helpers `rsaLimbsFromBytes`, `rsaLimbsToBytes`, `rsaLimbsBelow`, `rsaLimbsIsZero`, which `nish/crypto/p384` uses too (its record is [crypto-ecc.md](crypto-ecc.md), ECC-6) |

Out of scope: `std/crypto/sha256.ts`, `sha512.ts` and `ct.ts`, which this module
calls (the K1 record, [crypto-k1.md](crypto-k1.md)), and the X.509 and TLS code
that will call it, which their own stages record.

## Threat model

The module holds no private key, signs nothing and decrypts nothing. Every
argument is public, and the attacker controls all of it: the DER key (any
length, any bytes), the hash selector, the message and the signature. A win for
the attacker is a signature accepted that the key's holder did not make, a
panic, a verification whose cost the attacker can push past what an 8192-bit
key and a 32-bit exponent cost, or a key or signature accepted in more than one
encoding. Timing is not in the model: nothing secret enters, so the arithmetic
branches and takes variable time by design (RSA-1).

## Method

**Specifications compared against.** RFC 8017 §5.2.2 (RSAVP1), §8.1.2 and
§9.1.2 (PSS verification and EMSA-PSS-VERIFY), §8.2.2 and §9.2 (PKCS#1 v1.5
and EMSA-PKCS1-v1_5, with the DigestInfo prefixes of its note 1), §B.2.1
(MGF1) and §A.1.1 (`RSAPublicKey`); X.690 §8.3 and §10 for DER's integers;
NIST SP 800-131A for the 2048-bit floor; RFC 8446 §4.2.3 for PSS with a salt
the length of the hash.

**Known attacks, each checked against the code.**

- *Bleichenbacher's 2006 e = 3 forgery and its descendants (BERserk, the
  garbage-after-DigestInfo family).* They need a verifier that parses the
  recovered block. `rsaVerifyPkcs1v15` parses nothing: it builds the one block
  a signer would produce and compares all `key.size` bytes with
  `timingSafeEqual`. Pinned by the bytes-after, missing-NULL, wrong-OID,
  short-padding, non-FF padding and block-type-2 cases below, and by
  Wycheproof's.
- *A signature of n or more, or of the wrong length.* `rsaPublicOp` refuses
  both before any arithmetic (§5.2.2 step 1, §8.2.2 step 1).
- *A weak or costly key.* `rsaParsePublicKey` refuses a modulus under 2048 or
  over 8192 bits, an even modulus, an exponent that is even, under 3 or of
  2^32 or more, and any DER that is not minimal or has bytes after the
  sequence. A key at both ceilings costs 64 multiplications of 256 limbs.
- *PSS with another salt length.* The salt is held to the hash's length, so a
  signature made with any other length is refused, whether its own encoding is
  valid or not.

**Agreement.** Wycheproof's `rsa_signature_2048_sha256`, `_3072_sha384`,
`_4096_sha512`, `rsa_pss_2048_sha256_mgf1_32`, `_3072_sha256_mgf1_32`,
`_2048_sha384_mgf1_48` and `_4096_sha512_mgf1_64`, copied with their licence
(`tests/link/crypto_rsa_wycheproof/`, listed in `THIRD_PARTY_NOTICES.md`):
1,313 cases, every valid one verified and every invalid one refused, natively
and under `--number-mode f64`. Each PKCS#1 v1.5 file has one "acceptable"
case, tcId 8, a signature whose DigestInfo leaves out the NULL; the module
refuses all three, as it builds the NULL (RSA-2). The hand-built cases in
`tests/link/crypto_rsa_digestinfo/` were made from a 2048-bit and a 1024-bit
key by a generator outside the repository, raising the encoded block to the
private exponent directly so that malformed blocks could be signed.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| RSA-1 | None (a decision, recorded) | `RsaMont`, `rsaPublicOp` | The arithmetic is variable time: `pow` branches on exponent bits, `mul` on the final subtraction, and the limb helpers on lengths. | Every value is public (the threat model), so there is nothing for timing to leak. The module's doc says so, and so does `nish/crypto/p384`'s, which reuses `RsaMont`. Neither may be reached from code that holds a secret; a private-key RSA would need arithmetic of its own. |
| RSA-2 | None (a decision, recorded) | `rsaVerifyPkcs1v15` | A DigestInfo without the NULL parameters is refused, though RFC 8017 §9.2 note 2 says some verifiers accept it and Wycheproof marks it "acceptable". | Accepting it would mean a second expected block or a parser, the thing the design avoids. EMSA-PKCS1-v1_5 as §9.2 defines it writes the NULL, so a conforming signer never leaves it out. Pinned by "a DigestInfo without the NULL parameters is refused" and by the three Wycheproof acceptable cases (tcId 8 of each PKCS#1 v1.5 file), which the suite counts as refused. |
| RSA-3 | None (a decision, recorded) | `rsaVerifyPss` | Only a salt as long as the hash verifies. A PSS signature with another salt length, which RFC 8017 allows, is refused. | RFC 8446 §4.2.3 requires exactly this for TLS 1.3, and the fixed interface says so. Pinned by "a PSS signature with no salt is refused, as sLen is hLen" and "a PSS signature with a 64-byte salt is refused". A caller needing other salt lengths gets a new function, not a looser one. |

## Properties verified

Each is pinned by a test that fails if it stops holding.

- A valid PKCS#1 v1.5 or PSS signature verifies, for SHA-256, SHA-384 and
  SHA-512, at 2048, 3072 and 4096 bits: Wycheproof's valid cases.
- PKCS#1 v1.5 refuses bytes after the DigestInfo, a DigestInfo without NULL,
  one naming another hash, padding under eight bytes, a padding byte other
  than `ff`, block type 2, a digest of another message, the wrong hash
  selector, a signature one byte short and a signature equal to n.
- The two schemes do not cross: each signature is refused when checked as the
  other.
- A key under 2048 bits, with a trailing byte, an even exponent or an even
  modulus is refused by `rsaParsePublicKey`, which answers `null`, never a
  panic.

**Tests:**
"link/crypto_rsa_wycheproof: exits with 0 and stdout matches expected.out",
"link/crypto_rsa_wycheproof_f64: exits with 0 and stdout matches expected.out",
"link/crypto_rsa_digestinfo: exits with 0 and stdout matches expected.out".
The last prints each case by name in its `expected.out`, the strings quoted
above among them.
