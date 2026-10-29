# Security record: RSA signature verification

The record of the review of `nish/crypto/rsa`, added by the stage "RSA
signature verification, PKCS#1 v1.5 and PSS" of the certificate-chain work
(#987, #480). It says what was checked, how, what was found and what became of
it, and names the test that pins each property.

**Result.** No forgery, panic, unbounded loop or non-canonical accept was
found. All 4,189 Wycheproof RSA signature cases the module covers give their
expected answer, at 2048, 3072, 4096 and 8192 bits. Every refusal rule was
removed in turn, and a test failed each time, except for four guards that
other rules make unreachable (see "Mutation check" below). Five findings are
recorded. Each is a property of the module's design, kept on purpose and
accepted, so none is counted in the README's Areas table.

Anchors here are by function name in `std/crypto/rsa.ts` as this change adds
it on base `2cdef4f`. No `file:line` anchor is used.

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/rsa.ts` | `rsaParsePublicKey` and its DER readers (`rsaDerContents`, `rsaDerLength`, `rsaDerUnsigned`, `rsaBitLength`, `rsaBytesBelow`); `rsaVerifyPkcs1v15` and `rsaVerifyPss` and everything they reach: `rsaOpen` (RSAVP1), the Montgomery arithmetic (`rsaLimbsFromBytes`, `rsaBytesFromLimbs`, `rsaMontInverse`, `rsaAtLeast`, `rsaSubInPlace`, `rsaMontMul`, `rsaDoubleMod`, `rsaMontR2`, `rsaModPow`), and the encodings (`rsaHashSize`, `rsaDigest`, `rsaDigestInfoPrefix`, `rsaSameBytes`, `rsaMgf1`); the class `RsaPublicKey` |

Out of scope: `std/crypto/sha256.ts` and `sha512.ts`, which the module calls
(the K1 stage audits them), and every caller. Nothing in the tree calls the
module yet. The `pki` stage of #987 will call it, and that stage imposes the
2048-bit floor a Web PKI needs.

## Threat model

Every input is the attacker's: the key's DER (any length, any bytes), the
signature (any length, any value, including 0, n, n + 1 and values longer than
the modulus), the message, and the hash id and salt length a caller passes
through from a certificate. Nothing is secret. The module verifies and never
signs, so it holds no private key, and a timing measurement can learn only
what the attacker already sent.

A win for the attacker is any of these:

- a signature accepted that the key's owner did not make (forgery, including
  Bleichenbacher's 2006 low-exponent forgery against a lax PKCS#1 v1.5
  parser);
- a key or signature with two encodings that both work (a non-canonical
  accept);
- a panic, an out-of-bounds read, or work or memory that grows with an input
  past what a legitimate key needs (denial of service).

**Why no `Secret`.** CLAUDE.md requires secret material in `std/crypto` to be
a `Secret` and wiped. This module has none: a public key, a signature and a
message are all public, and so is everything computed from them, including the
opened block `s^e mod n`. So it does not import `nish:secret` and does not
wipe. For the same reason it is variable time and does not use
`nish/crypto/ct` (RSA-2).

## Method

**Specifications compared against.** RFC 8017 §A.1.1 (`RSAPublicKey`), §5.2.2
(RSAVP1), §8.1.2 and §9.1.2 (RSASSA-PSS-VERIFY and EMSA-PSS-VERIFY), §8.2.2
and §9.2 with note 1 (RSASSA-PKCS1-V1_5-VERIFY, EMSA-PKCS1-v1_5 and the
DigestInfo prefixes), and §B.2.1 (MGF1). X.690 §8.1.3, §8.3 and §10.1 (DER
lengths and INTEGERs). Each step of §9.1.2 was matched to a statement of
`rsaVerifyPss`, in order: steps 3 (length), 4 (0xbc), 6 (the leftmost
`8 emLen - emBits` bits of maskedDB), 9 (clearing them in DB), 10 (the zero
octets and the 0x01), 11 to 14 (salt, M' and H').

**The closest upstream.** The module's header says the arithmetic was written
from the textbook: Montgomery multiplication in the CIOS form of Koç, Acar and
Kaliski (HAC Algorithm 14.36) and left-to-right square and multiply (HAC
14.79). The nearest well-known implementations are BearSSL's `i31` code and
Go's `crypto/rsa`. Function by function:

- `rsaMontMul` does not follow BearSSL's `br_i31_montymul`. BearSSL keeps
  31-bit words, so a sum never overflows, and runs in constant time. This
  module keeps 32-bit words, takes each product in `u64` with an extra carry
  limb, and subtracts once at the end only when the result is at least n.
  Go's `bigmod` (`montgomeryMul` in `crypto/internal/fips140/bigmod/nat.go`)
  is word-sized too, but is constant time and interleaves the reduction
  differently.
- `rsaModPow` does not follow `br_i31_modpow`, which uses a fixed window and
  constant-time selection. This is plain binary square and multiply from the
  exponent's top bit, branching on each bit.
- `rsaMontR2` is not BearSSL's either: BearSSL computes R² by repeated
  `br_i31_muladd_small`. Here R 2^s comes from doubling, and Montgomery
  squarings take it to R². The trick of doubling, then squaring, is an idea,
  not code.
- `rsaMontInverse` is the Newton iteration for -n⁻¹ mod 2^32. BearSSL's
  `br_i31_ninv31` and Go's `minusInverseModW` use the same textbook iteration.
  The code is our own and shares no statements with either.
- `rsaVerifyPkcs1v15` takes Go's approach in `VerifyPKCS1v15`: it builds the
  whole expected block and compares it. It does not take BearSSL's
  `br_rsa_pkcs1_sig_unpad`, which parses the block. The code is our own.
- `rsaVerifyPss` is RFC 8017 §9.1.2 in its own order. It shares no structure
  with Go's `emsaPSSVerify` or BearSSL's `br_rsa_pss_sig_unpad` beyond the
  RFC's steps.
- `rsaParsePublicKey` is a strict DER reader for one structure. Go reads the
  key with `cryptobyte`, and BearSSL takes n and e already decoded, so
  neither is a model for it.

No code was copied, so `std/crypto/rsa.ts` carries no notice and has no row in
`THIRD_PARTY_NOTICES.md`.

**Wycheproof.** The cases come from Project Wycheproof's `testvectors_v1/` at
`3fa63dd0344abb611f1fb1d77e119938603ea230`, the commit
`tests/link/crypto_wycheproof` already pins. They were rewritten as Nish source
under `tests/link/crypto_wycheproof_rsa/` by its `generate.mjs`, which throws
when a file's kept and left-out cases do not add up to its `numberOfTests`.
The directory carries Wycheproof's Apache-2.0 notice and `LICENSE-wycheproof`. Each case is checked against its `result`.
For an `acceptable` case, the run prints which way the module went; any other
result label is a mismatch.

| File | Cases | Valid verified | Invalid refused | Acceptable | Test |
| --- | --- | --- | --- | --- | --- |
| `rsa_signature_2048_sha256_test.json` | 259 | 9 | 249 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_2048_sha384_test.json` | 258 | 7 | 250 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_2048_sha512_test.json` | 259 | 8 | 250 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_3072_sha256_test.json` | 259 | 8 | 250 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_3072_sha384_test.json` | 259 | 7 | 251 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_3072_sha512_test.json` | 260 | 8 | 251 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_4096_sha256_test.json` | 258 | 7 | 250 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_4096_sha384_test.json` | 259 | 7 | 251 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_4096_sha512_test.json` | 259 | 7 | 251 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_8192_sha256_test.json` | 258 | 7 | 250 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_8192_sha384_test.json` | 259 | 7 | 251 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_signature_8192_sha512_test.json` | 259 | 7 | 251 | 1, refused | `crypto_wycheproof_rsa` |
| `rsa_pss_2048_sha256_mgf1_0_test.json` | 103 | 61 | 42 | 0 | `crypto_wycheproof_rsa` |
| `rsa_pss_2048_sha256_mgf1_32_test.json` | 108 | 63 | 45 | 0 | `crypto_wycheproof_rsa` |
| `rsa_pss_2048_sha384_mgf1_48_test.json` | 141 | 95 | 46 | 0 | `crypto_wycheproof_rsa` |
| `rsa_pss_3072_sha256_mgf1_32_test.json` | 108 | 63 | 45 | 0 | `crypto_wycheproof_rsa` |
| `rsa_pss_4096_sha256_mgf1_32_test.json` | 108 | 63 | 45 | 0 | `crypto_wycheproof_rsa` |
| `rsa_pss_4096_sha384_mgf1_48_test.json` | 141 | 95 | 46 | 0 | `crypto_wycheproof_rsa` |
| `rsa_pss_4096_sha512_mgf1_32_test.json` | 177 | 132 | 45 | 0 | `crypto_wycheproof_rsa` |
| `rsa_pss_4096_sha512_mgf1_64_test.json` | 179 | 132 | 47 | 0 | `crypto_wycheproof_rsa` |
| `rsa_pss_misc_test.json` (18 of 150) | 18 | 18 | 0 | 0 | `crypto_wycheproof_rsa` |

In each `rsa_signature_*` file, the acceptable case is the DigestInfo without
its NULL parameters, and the module refuses it (RSA-1). The `rsa_pss_misc`
cases kept are those whose groups hash with SHA-256, SHA-384 or SHA-512 and
use the same hash for MGF1. The 132 left out use SHA-1, SHA-224 or a
different MGF1 hash, which the module does not offer.

**Left out, and why.**

- `rsa_signature_2048_sha224`: `std` has no SHA-224.
- The `_sha512_224` and `_sha512_256` signature files, and the PSS files over
  those hashes: `std` has neither truncated SHA-512.
- The `_sha3_*` signature files, and the PSS `_shake128` / `_shake256` files:
  `std` has no SHA-3.
- `rsa_pss_2048_sha1_mgf1_20` and `rsa_pss_2048_sha256_mgf1sha1_20`: SHA-1,
  or an MGF1 hash that differs from the message hash.
- The PSS `_params` files: they test reading the PSS parameters from an
  `AlgorithmIdentifier`, which this module does not parse. The X.509 stage
  reads them.
- `rsa_pkcs1_*_sig_gen`: signature generation.
- `rsa_pkcs1_{2048,3072,4096}` and every `rsa_oaep_*` and
  `rsa_three_primes_*` file: decryption.

**Hand-made cases** (`tests/link/crypto_rsa`, 74 checks). The keys and
signatures in `tests/link/crypto_rsa/vectors.ts` were made for this test.
`tests/link/crypto_rsa/generate.py` writes the file: it draws the primes from
a fixed seed, tests them with Miller-Rabin, and signs with its own private
keys, so a run writes the same file byte for byte and the file says how each
value was made. They
cover what Wycheproof does not:

- keys of 1023, 2049 and 8193 bits, an exponent of 2^32 − 5, a modulus whose
  top byte is 0xf0 or more, and a 2049-bit key whose PSS emLen is one byte
  less than k;
- every DER refusal listed under "Properties verified";
- each PKCS#1 v1.5 tamper one by one: block type 2, a 0xfe in the padding, the
  NULL missing, the OID of another hash, trailing garbage after the digest,
  and s + n;
- each PSS rule one by one, under signatures re-signed so that only that rule
  fails: the trailer, the top bits of maskedDB, a nonzero padding octet, a
  missing 0x01, and a data block of zeros alone;
- salt lengths of −1 and 0x7ffffff0 under key A with SHA-256, and of 100
  under the 1024-bit key E with SHA-512.

**Mutation check.** A test that has never been seen to fail proves little. So
each refusal rule in `std/crypto/rsa.ts` was replaced, one at a time, by
`tests/link/crypto_rsa/mutate.py`, which edits the file, rebuilds `crypto_rsa`
and runs it, and restores the file in a `finally`. It exits nonzero unless
exactly the four guards below go uncaught. `git diff` was empty afterwards.

These 28 rules were each caught, by a failing check or by a panic in the debug
profile ("index out of range", or an `i32` overflow):

- the DER tag;
- the shortest-form rule for the one-octet (0x81) and two-octet (0x82) long
  forms, and the refusal of longer forms;
- the exponent ending the SEQUENCE, and the SEQUENCE ending the DER;
- an empty INTEGER, a negative one, and a non-minimal one;
- the bit length's lower and upper bounds, and n odd;
- the exponent's length cap, e odd, and e ≥ 3;
- the signature's length, and the signature below n;
- the zero top byte `rsaOpen` requires when emLen is k − 1;
- PKCS#1 v1.5's room check, and its whole-block comparison;
- PSS's negative salt, its huge salt, its room check, the 0xbc trailer, the
  top bits, the zero octets, the 0x01 separator, and the hash comparison.

Four guards were removed and nothing failed. **None of them can be caught**,
because another rule makes each one unreachable. They stay as defences that
state a rule where the code relies on it:

- `rsaDerContents`'s `length > end - start`. The checks that the exponent
  ends the SEQUENCE and the SEQUENCE ends the DER, and the next element's own
  bounds, refuse every length this guard refuses.
- `rsaVerifyPkcs1v15`'s `hashSize === 0`. With an unknown hash id, the
  expected block is k + 32 bytes long, and no opened block of k bytes can
  match it.
- `rsaVerifyPss`'s `hashSize === 0`. With an unknown hash id, H is empty, and
  no digest matches an empty H.
- `rsaOpen`'s `size < 0 || size > k`. PKCS#1 v1.5 passes `size = k`, and PSS
  passes `0 < emLen ≤ k`.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| RSA-1 | Low | `rsaVerifyPkcs1v15`, `rsaDigestInfoPrefix` | A DigestInfo whose AlgorithmIdentifier has no NULL parameters is refused. RFC 8017 §9.2 note 2 lets a verifier accept that form, and Wycheproof marks it `acceptable` (one case in each of the twelve `rsa_signature_*` files). A signer that leaves out the NULL fails to verify here. | **Accepted, not counted.** Comparing against the one encoding the RFC prints keeps verification a whole-block comparison, with no second accepted encoding. Certificates in the Web PKI carry the NULL. The twelve acceptable cases are printed as refused, and `crypto_rsa` pins it with "a DigestInfo without NULL parameters is refused". |
| RSA-2 | None (a property) | the whole module | Variable time. The exponentiation branches on the exponent's bits, `rsaMontMul` subtracts only when the result is at least n, and comparisons stop at the first difference. | **Accepted, not counted.** Every input is public (see "Threat model"), so timing reveals only what the attacker sent. A caller must never pass a secret value here. Nothing in the module takes one, and it neither signs nor decrypts. |
| RSA-3 | Low | `rsaParsePublicKey` | The exponent must be below 2^32, the modulus 1024 to 8192 bits, and e at least 3. RFC 8017 allows any e in [3, n − 1]. A key outside these bounds parses as `null`, even though RFC 8017 would call it valid. | **Accepted, not counted.** The bound limits one verification's cost to at most 31 squarings and 31 multiplications of an 8192-bit number, plus R², whatever key the attacker supplies. Every certificate in use has e = 65537. The 1024-bit floor still reads the legacy 1024-bit keys some old certificates carry, and refuses anything smaller, which is cheap to factor; `pki` imposes 2048, and every vendored Wycheproof key is at least 2048 bits. Pinned by "the exponent 2^32 + 1 is refused", "the exponent 2^32 - 1 reads, its leading zero dropped", "a 1023-bit modulus is refused", "an 8193-bit modulus is refused", "an 8192-bit modulus reads", "the exponent 1 is refused", "the exponent 3 reads" and "PKCS#1 v1.5 verifies under e = 2^32 - 5". |
| RSA-4 | Low | `rsaVerifyPkcs1v15`, `rsaVerifyPss` (through `sha256` / `sha384` / `sha512`) | A message longer than 2^31 − 1 bytes panics, as the one-shot hashes do (`std/crypto/sha256.ts`'s `sha256` doc). | **Accepted, not counted.** The hashes panic rather than hash a prefix, which would let one signature verify for every message sharing that prefix. A caller that may see such a message must refuse it first. No test reaches this length, and the behaviour is the hashes'. |
| RSA-5 | None (a property) | `RsaPublicKey` | The class's constructor is public and checks nothing, so a caller can build a key the parser would refuse: even, short, with a leading zero, or with a long exponent. | **Accepted, not counted; documented.** The class doc says so. The verifiers read only `n` and `e`. Their room checks refuse any n shorter than 51 bytes before it reaches the arithmetic, so a key with an empty or short n answers `false` and never indexes an empty array. Answers for any other hand-built key mean nothing, and its cost is not bounded by RSA-3. `crypto_rsa`'s 488-bit key D, built by hand, pins one case: "a modulus with room for seven FFs is refused" (61 bytes, one short of SHA-256's 62). |

## Properties verified

Each property below is pinned by a check in `tests/link/crypto_rsa/suite.ts`
(the `crypto_rsa` link test) or by the Wycheproof run. The mutation check
above shows that each check fails when its rule is removed.

**The key** (`rsaParsePublicKey`):

- Exactly one SEQUENCE of two INTEGERs, with nothing before it and nothing
  after it. A wrong outer tag, an element that is not an INTEGER, a SEQUENCE
  length one short, a byte after the SEQUENCE, and a byte inside it after e
  are refused.
- Lengths are definite and in their shortest form. 0x81 with a value below
  0x80, 0x82 with a value below 0x100, a three-octet length, and a long-form
  length octet read as a short one are refused, as are a key one byte short
  and an empty key.
- Each INTEGER is positive and minimal. An empty INTEGER, a negative one, and
  one with a superfluous leading 0x00 are refused.
- n is odd and 1024 to 8192 bits. e is odd, at least 3 and below 2^32
  (RSA-3).
- What it answers is `n` and `e` without leading zeros, and `bits`.

**The signature** (`rsaOpen`, both verifiers):

- A signature that is not exactly k bytes is refused: an empty one, one with
  a zero byte put in front, and one whose leading zero byte was dropped
  ("that signature without its zero byte is refused"). A k-byte signature that
  starts with a zero byte verifies.
- A signature whose integer is n or more is refused, including s + n of a
  valid signature, which opens to the same block (RFC 8017 §5.2.2 step 1).

**PKCS#1 v1.5** (`rsaVerifyPkcs1v15`):

- The whole block `00 01 FF … FF 00 DigestInfo` is compared, byte for byte,
  with the one built from the message. So no trailing garbage, no shortened
  padding, no other block type, no other OID, and no parameter other than
  NULL survives. Bleichenbacher's 2006 forgery against e = 3 needs a parser
  that ignores bytes after the digest; under this comparison it has nowhere
  to hide them. Wycheproof's 3,005 invalid PKCS#1 v1.5 cases are all refused.
- A modulus too short for the DigestInfo plus 11 bytes answers `false`.

**PSS** (`rsaVerifyPss`):

- emBits = bits(n) − 1 and emLen = ⌈emBits / 8⌉. When bits(n) ≡ 1 mod 8, emLen
  is k − 1. Then the opened integer's top byte must be zero, which `rsaOpen`
  checks. Pinned by key B (2049 bits): "PSS verifies under a 2049-bit key"
  and "a 2049-bit key's signature of 2^2048 plus a block is refused".
- The trailer 0xbc, the leftmost `8 emLen − emBits` bits of maskedDB, the
  zero octets before the separator, the 0x01 separator, and H' = H are each
  checked, and each has a signature that fails only that check.
- The salt length is the caller's and must match exactly. A negative salt
  length and one too large for emLen answer `false`, never a panic. The salt
  lengths −1 and 0x7ffffff0 are tested, and so is 100 (under a 1024-bit key
  with SHA-512, where 64 + 100 + 2 > 128).
- MGF1 uses the message's hash. Mismatched MGF1 hashes are not offered.

**No panic.** Every check above answers `true` or `false`. The debug profile
`crypto_rsa` runs under turns any out-of-bounds index or `i32` overflow into a
panic, so the suite would have failed on one. The Wycheproof run, under
`--profile speed --number-mode f64`, hands the verifiers signatures of every
length Wycheproof has.

## Tests

- "link/crypto_rsa: exits with 0 and stdout matches expected.out", the
  template `` `link/${name}: exits with ${wantCode} and stdout matches expected.out` ``
  with `name` = `crypto_rsa`. 74 checks.
- "link/crypto_wycheproof_rsa: exits with 0 and stdout matches
  expected.out", the same template with `name` = `crypto_wycheproof_rsa`.
  All 21 files above.
