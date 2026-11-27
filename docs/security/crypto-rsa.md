# Security record: RSA signature verification and RSA-PSS signing

The record of the review of `nish/crypto/rsa`, added by the stage "RSA
signature verification, PKCS#1 v1.5 and PSS" of the certificate-chain work
(#987, #480). It says what was checked, how, what was found and what became of
it, and names the test that pins each property.

**Result.** No forgery, panic, unbounded loop or non-canonical accept was
found. All 4,189 Wycheproof RSA signature cases the module covers give their
expected answer, at 2048, 3072, 4096 and 8192 bits. Every refusal rule was
removed in turn, and a test failed each time, except for 23 guards that
other rules or the callers make unreachable (see "Mutation check" below). Five findings are
recorded. Each is a property of the module's design, kept on purpose and
accepted, so none is counted in the README's Areas table.

Anchors here are by function name in `std/crypto/rsa.ts` as this change adds
it on base `2cdef4f`. No `file:line` anchor is used.

**Signing** came later, with `nish/crypto/rsa-sign` in the stage "RSA-PSS
CertificateVerify under an RSA certificate on the TLS and QUIC servers"
(#2334, #481). It is reviewed in its own section, "RSA-PSS signing", below,
with its findings RSA-S1 to RSA-S6. Anchors there are by function name in
`std/crypto/rsa-sign.ts`.

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/rsa.ts` | `rsaParsePublicKey` and its DER readers (`rsaDerElement`, `rsaDerUnsigned`, `rsaBitLength`); `rsaVerifyPkcs1v15` and `rsaVerifyPss` and everything they reach: `rsaOpen` (RSAVP1), the Montgomery arithmetic (`rsaLimbsFromBytes`, `rsaBytesFromLimbs`, `rsaMontInverse`, `rsaAtLeast`, `rsaSubInPlace`, `rsaMontMul`, `rsaDoubleMod`, `rsaMontR2`, `rsaModPow`), and the encodings (`rsaHashSize`, `rsaDigest`, `rsaDigestInfoPrefix`, `rsaMgf1Xor`); the classes `RsaPublicKey` and `RsaDerSpan` |

Out of scope: `std/crypto/sha256.ts` and `sha512.ts`, which the module calls
(the K1 stage audits them), and every caller. Three call it, and each
imposes its own 2048-bit floor above this module's 1,024 (`RSA_MIN_BITS`): `std/crypto/pki.ts`
(`PKI_MIN_RSA_BITS`, a chain's signatures and the leaf's key, [its
record](crypto-pki.md)), `std/net/tls/verify.ts` (`TLS_VERIFY_MIN_RSA_BITS`, the
CertificateVerify's key) and `std/crypto/jwt.ts` (an RS key under 2048 bits
answers `null`).

| File | Functions (signing) |
| --- | --- |
| `std/crypto/rsa-sign.ts` | the whole module: `rsaParsePrivateKey` and its DER readers (`rsaSignDer`, `rsaSignInteger`, `rsaSignBits`, `rsaSignOdd`, `rsaSignKeyBytes`, `rsaSignPlace`) and its soundness trial (`rsaSignKeySound`); the accessors `rsaPrivateKeyBits`, `rsaPrivateKeyModulus` and `rsaPrivateKeyExponent` and their helpers (`rsaSignKeySize`, `rsaSignKeyBits`, `rsaSignKeyPart`, `rsaSignKeyModulus`, `rsaSignKeyExponent`); `rsaSignRaw`, `rsaSignPssSha256`, `rsaSignPssSha256Into`, `rsaSignPssSha256Salted` and `rsaSignPssSha256SaltedInto`; `RsaSignScratch` and the salt derivation (`rsaSignSaltInto`, `rsaSignExponentCopy`); EMSA-PSS-ENCODE (`rsaSignPssEncode`); the private operation `rsaSignPrivateOp` and its arithmetic (`rsaSignLimbs`, `rsaSignBytes`, `rsaSignMontInverse`, `rsaSignReduce`, `rsaSignMontMul`, `rsaSignWindowStep`, `rsaSignR2`); the class `RsaSignSpan` |
| `std/crypto/x509.ts` | `x509ParseRsaPrivateKey` and `x509Pkcs8RsaKey` only, the PEM and PKCS#8 front of `rsaParsePrivateKey`. The rest of the file is [crypto-x509.md](crypto-x509.md)'s |

The TLS signer that calls it, `TlsRsaSigner` in `std/net/tls.ts`, is
[tls.md](tls.md)'s.

## Threat model

Every input is the attacker's: the key's DER (any length, any bytes), the
signature (any length, any value, including 0, n, n + 1 and values longer than
the modulus), the message, and the hash id and salt length a caller passes
through from a certificate. Nothing is secret. `std/crypto/rsa.ts` verifies
and never signs, so it holds no private key, and a timing measurement can
learn only what the attacker already sent. Signing, in
`std/crypto/rsa-sign.ts`, has its own threat model under "RSA-PSS signing".

A win for the attacker is any of these:

- a signature accepted that the key's owner did not make (forgery, including
  Bleichenbacher's 2006 low-exponent forgery against a lax PKCS#1 v1.5
  parser);
- a key or signature with two encodings that both work (a non-canonical
  accept);
- a panic, an out-of-bounds read, or work or memory that grows with an input
  past what a legitimate key needs (denial of service).

**Why no `Secret`.** The project's rule is that secret material in `std/crypto`
is a `Secret` and is wiped. `std/crypto/rsa.ts` has none: a public key, a signature and a
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
  `rsa_three_primes_*` file: decryption. The signing tests take their keys
  and ciphertexts from `rsa_pkcs1_*` ([Method (signing)](#method-signing)).

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
`tests/link/crypto_rsa/mutate.py`, which edits the file, builds
`crypto_rsa` and `crypto_rsa_der_refusals` in the debug profile with
`--allow-panics`, runs both, and restores the file in a `finally`. A rule is
caught when either run exits nonzero. The script exits nonzero unless exactly
the rules in its `UNCAUGHT` list go uncaught and every other rule is caught.
The run on commit c288673f9 printed "29 of 52 rules caught" and "every rule
caught except those listed, each missed", and exited 0. It was rerun on
3a3c0a5ab, the branch after main's 401a85e9 was merged in, with the same
`std/crypto/rsa.ts` and `mutate.py`: it printed the same two lines and the
same 23 uncaught rules, and exited 0. It was run a third time on 1ca886e8,
the branch head, whose `std/crypto/rsa.ts` and `mutate.py` are those of
3a3c0a5ab: it printed the same two lines and the same 23 uncaught rules, and
exited 0. `git diff std/crypto/rsa.ts` was empty after each run.

These 29 rules were each caught, by a failing check or by a panic in the debug
profile ("index out of range", or "attempt to add with overflow"):

- `rsaDerElement`: the tag; the element's start (`at`) inside the DER; room
  for the 0x81 and 0x82 length octets, and the shortest-form rule for each;
  the refusal of longer forms;
- `rsaDerUnsigned`: a negative INTEGER, a lone zero byte, and a needless
  leading zero;
- `rsaParsePublicKey`: the SEQUENCE ending the DER, the exponent ending the
  SEQUENCE, the bit length's lower and upper bounds, n odd, the exponent's
  length cap, e odd, and e ≥ 3;
- `rsaModPow`: the signature below n;
- `rsaOpen`: the signature as long as n, and the zero top bytes it requires
  when emLen is under k;
- PKCS#1 v1.5's room check, and its whole-block comparison;
- PSS's huge salt, the top bits, the 0xbc trailer, the zero octets, the 0x01
  separator, and the hash comparison.

`crypto_rsa_der_refusals` catches the element-start, length-room and lone-zero
rules with DER cut short after the modulus (an exponent tag with no length, a
0x81 or 0x82 length with too few octets, an exponent of a lone zero byte).
`crypto_rsa`'s "that signature without its zero byte, as long as the block, is
refused" catches the signature-length rule, with a 2049-bit key's PSS
signature that starts with a zero byte.

These 23 guards were removed and nothing failed. **None of them can be
caught alone**: another rule or every caller makes each one unreachable, as the
run printed. They stay as defences that state a rule where the code relies
on it, and most are what lets the prover discharge an index:

- element end: every caller passes end = der.length, and an end below 2
  leaves at > end - 2 true for every at >= 0.
- fits: a span past der.length is refused after it returns: the SEQUENCE's
  by `seq end`, the modulus's by the exponent's `element at`, the exponent's
  by `e end`.
- int range: start is a span's start, at least at + 2 >= 2.
- empty int: an empty modulus reads e's tag 0x02 as its contents' first byte
  and comes back empty, refused by `empty n or e`; an empty exponent ends the
  buffer, so start >= total refuses it.
- int in der: a span ends at most at end = der.length (`fits`), and a start at
  der.length is a start at end.
- bit length cap: every array it is given is a DER INTEGER's contents, at
  most 65535 bytes under a two-octet length.
- empty n or e: `empty int` refuses an INTEGER with no contents and `lone
  zero` one of a zero byte alone, so a read INTEGER has a byte.
- pow n size: a parsed modulus is 1024 to 8192 bits, 128 to 1024 bytes (`min
  bits`, `max bits`).
- pow s len: rsaOpen passes only a signature exactly as long as n (`sig len`).
- pow e bits: a parsed exponent is odd and at least 3 (`odd e`, `e min`).
- open size: PKCS#1 v1.5 passes k, the modulus's length, and PSS emLen =
  (bits + 6) >> 3, which is 128 to k (`pss em size`).
- open short: rsaModPow answers exactly n.length bytes, and size is at most
  n.length.
- pkcs hash0: an unknown id has hashSize 0 but rsaDigest still answers a
  32-byte SHA-256 digest, so `expected` is k + 32 bytes and `pkcs compare`
  refuses it (the hash id 0 and 4 tests).
- pkcs hash max: rsaHashSize answers at most 64.
- pkcs k max: a parsed modulus is at most 1024 bytes (`max bits`).
- pss hash0: an unknown id has hashSize 0, so h is empty, and the 32-byte
  SHA-256 digest rsaDigest answers never equals it (`pss hash`; the PSS hash
  id 0 test).
- pss hash max: rsaHashSize answers at most 64.
- pss salt neg: a negative salt puts the zeros through the whole data block,
  so no 0x01 is read and `!separated` refuses it.
- pss bits: a parsed modulus is 1024 to 8192 bits (`min bits`, `max bits`).
- pss em size: emLen is (bits + 6) / 8 for 1024 to 8192 bits.
- pss room: a salt too long for the block makes the zeros' count negative, so
  no 0x01 is read and `!separated` refuses it.
- pss em len: rsaOpen answers exactly emLen bytes (`open short`, `top zeros`).
- pss separated: with a salt of 0 or more and room for it, the 0x01's index is
  inside the data block, so the loop always reaches it.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| RSA-1 | Low | `rsaVerifyPkcs1v15`, `rsaDigestInfoPrefix` | A DigestInfo whose AlgorithmIdentifier has no NULL parameters is refused. RFC 8017 §9.2 note 2 lets a verifier accept that form, and Wycheproof marks it `acceptable` (one case in each of the twelve `rsa_signature_*` files). A signer that leaves out the NULL fails to verify here. | **Accepted, not counted.** Comparing against the one encoding the RFC prints keeps verification a whole-block comparison, with no second accepted encoding. Certificates in the Web PKI carry the NULL. The twelve acceptable cases are printed as refused, and `crypto_rsa` pins it with "a DigestInfo without NULL parameters is refused". |
| RSA-2 | None (a property) | the whole module | Variable time. The exponentiation branches on the exponent's bits, `rsaMontMul` subtracts only when the result is at least n, and comparisons stop at the first difference. | **Accepted, not counted.** Every input is public (see "Threat model"), so timing reveals only what the attacker sent. A caller must never pass a secret value here. Nothing in the module takes one, and it neither signs nor decrypts. |
| RSA-3 | Low | `rsaParsePublicKey` | The exponent must be below 2^32, the modulus 1024 to 8192 bits, and e at least 3. RFC 8017 allows any e in [3, n − 1]. A key outside these bounds parses as `null`, even though RFC 8017 would call it valid. | **Accepted, not counted.** The bound limits one verification's cost to at most 31 squarings and 31 multiplications of an 8192-bit number, plus R², whatever key the attacker supplies. Every certificate in use has e = 65537. The 1024-bit floor still reads the legacy 1024-bit keys some old certificates carry, and refuses anything smaller, which is cheap to factor; `pki` imposes 2048, and every vendored Wycheproof key is at least 2048 bits. Pinned by "the exponent 2^32 + 1 is refused", "the exponent 2^32 - 1 reads, its leading zero dropped", "a 1023-bit modulus is refused", "an 8193-bit modulus is refused", "an 8192-bit modulus reads", "the exponent 1 is refused", "the exponent 3 reads" and "PKCS#1 v1.5 verifies under e = 2^32 - 5". |
| RSA-4 | Low | `rsaVerifyPkcs1v15`, `rsaVerifyPss` (through `sha256` / `sha384` / `sha512`) | A message longer than 2^31 − 1 bytes panics, as the one-shot hashes do (`std/crypto/sha256.ts`'s `sha256` doc). | **Accepted, not counted.** The hashes panic rather than hash a prefix, which would let one signature verify for every message sharing that prefix. A caller that may see such a message must refuse it first. No test reaches this length, and the behaviour is the hashes'. |
| RSA-5 | None (a property) | `RsaPublicKey` | The class's constructor is public and checks nothing, so a caller can build a key the parser would refuse: even, short, with a leading zero, or with a long exponent. | **Accepted, not counted; documented.** The class doc says so. The verifiers read only `n` and `e`. Their room checks refuse any n shorter than 51 bytes before it reaches the arithmetic, so a key with an empty or short n answers `false` and never indexes an empty array. Answers for any other hand-built key mean nothing, and its cost is not bounded by RSA-3. `crypto_rsa`'s 488-bit key D, built by hand, pins one case: "a modulus with room for seven FFs is refused" (61 bytes, one short of SHA-256's 62). |
| RSA-6 | None (a change after this audit, recorded) | `std/crypto/rsa.ts` by name: the DER reader, `rsaParsePublicKey`, `rsaBitLength`, `rsaModPow`, `rsaOpen`, `rsaVerifyPkcs1v15`, `rsaVerifyPss`, `rsaMgf1Xor` | **Every panic site the prover could not discharge is proven or refused** (WP83 S3). `node tests/run.js std-panics` counted 10 array-length, 23 index and 32 overflow sites in the file; it now counts none. The DER reader answers an `RsaDerSpan` (start and end) or `null` instead of a length, and copies an integer's bytes with `filter`. `rsaLimbsFromBytes` writes into the caller's array with a running cursor; `rsaBytesFromLimbs` and the Montgomery helpers work in fixed 1024-byte and 256-to-258-limb arrays, so their skipped-write guards are gone. `rsaBitLength` answers -1 for a length over `0x0fffffff`. `rsaModPow` answers `null` for a modulus under 1 or over 1024 bytes, a base longer than the modulus or not below it (a limb compare that replaces `rsaBytesBelow`), or an exponent with no set bit, before any arithmetic. `rsaVerifyPkcs1v15` answers `false` for a hash size outside 1 to 64 or a modulus over 1024 bytes; `rsaVerifyPss` for a modulus outside 2 to 8192 bits, an encoded message outside 1 to 1024 bytes or of the wrong length, or a block with no `0x01` separator. Both compare with `timingSafeEqual` from `nish/crypto/ct`, which replaces `rsaSameBytes`, and `rsaMgf1Xor` masks in place, replacing `rsaMgf1`. | **Recorded.** Every key `rsaParsePublicKey` accepts is within those bounds, so its answers are unchanged; only a key built by hand (RSA-5) or malformed DER reaches the new refusals, which `tests/link/crypto_rsa_der_refusals` drives. `crypto_rsa` and `crypto_wycheproof_rsa` pass unchanged. |

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

## RSA-PSS signing

`std/crypto/rsa-sign.ts` holds an RSA private key and signs with it:
RSASSA-PSS with SHA-256, MGF1-SHA-256 and a 32-byte salt (RFC 8017 §8.1.1),
which is TLS 1.3's `rsa_pss_rsae_sha256`. The TLS and QUIC servers call it
from `TlsRsaSigner` to sign CertificateVerify under an RSA certificate
([tls.md](tls.md)). The key is read from PKCS#1 `RSAPrivateKey` DER, or from
PEM, PKCS#1 or PKCS#8, through `x509ParseRsaPrivateKey`. It must be 2048 to
4096 bits.

### Threat model (signing)

Here the private exponent d is secret, and so is the key's DER. The modulus,
the public exponent, the message and the signature are public. A network
attacker chooses the message's input, since the transcript hash a server
signs covers the attacker's ClientHello. The attacker can also time the
server's answers. Three properties matter:

- **Timing.** The time a signature takes, and the memory addresses it
  reads, must not depend on d.
- **Faults.** No signature may leak d, even when the arithmetic goes
  wrong.
- **Wipes.** No copy of d may outlive the call that used it.

Out of scope:

- PKCS#1 v1.5 signing, `rsa_pss_pss_*` keys and client certificates.
- Power and electromagnetic side channels.
- An attacker who can read the process's memory.

### Method (signing)

- **Known answers.** `tests/link/crypto_rsa_sign` takes six Wycheproof keys,
  2048 to 4096 bits, from the `privateKeyPkcs8` of groups 0 and 1 of
  Wycheproof `rsa_pkcs1_{2048,3072,4096}_test.json` (`generate.mjs`).
  - Each key must load, with its bit length and its public modulus.
  - The private operation must open each of 12 Wycheproof PKCS#1 v1.5
    ciphertexts to its block. That is a raw RSA known answer, since signing
    and decryption are the same exponentiation.
  - `rsaSignPssSha256` must give 12 PSS signatures byte for byte. Each must
    also verify under `nish/crypto/rsa`'s `rsaVerifyPss`.
  - `tests/link/crypto_rsa_sign_f64` runs the same checks in f64 number mode.
- **The specification.** `test/spec/rfc8017-rsassa-pss-sha256.ts` is emitted
  from the contract `contracts/rfc8017-rsassa-pss-sha256.json`, which quotes
  RFC 8017's RSASP1, EMSA-PSS-ENCODE and private-key clauses
  (`specs/rfc8017-rsassa-pss-sha256.md`). Each of its checks names its clause:
  RSASP1 of the octets 00 to ff against OpenSSL's, 0, 1 and n - 1 as their own
  signatures, a representative of n or more refused, signatures under every
  salt length from 0 to 222 octets, one-bit tampering of message and
  signature, and one-bit changes to the key, its CRT values among them. "spec:
  test/spec/rfc8017-rsassa-pss-sha256.ts passes against std/crypto/rsa-sign.ts"
  runs it.
- **Other implementations.** `tests/link/crypto_rsa_sign_interop` holds
  signatures nish did not write (`generate.mjs` makes `vectors.ts`; the header
  there names each tool's version).
  - NIST CAVP's FIPS 186-2 `SigGenPSS_186-2.txt`: the 30 SHA-256 signatures
    under its 2048, 3072 and 4096-bit keys, each under a 20-byte salt. Its
    1024 and 1536-bit keys are kept as keys to refuse.
  - Keys OpenSSL (`genpkey`), Go's `crypto/rsa` (`interop.go`) and
    pyca/cryptography (`interop.py`) made, each written as PKCS#1 DER and
    PKCS#8 PEM by the library that made it: 2048, 2049, 2050, 2054, 3071,
    3072, 4094 and 4096 bits, with e of 3, 65537 and 2^32 − 1. OpenSSL 3.0
    makes only even sizes, so the odd ones are Go's.
  - Under each, five signatures: the derived salt over two messages, a 32-byte
    salt, the longest salt the key takes (emLen − 34 bytes), and no salt. Go
    signed the salted ones from the salt it was given, wherever it loads the
    key (it refuses e over 2^31 − 1); OpenSSL and pyca signed the empty-salt
    one. A BigInt signer in `generate.mjs` gave the same bytes for each, and
    OpenSSL, pyca and (where it loads the key) Go verified each at its salt
    length before it was written.
  - Each key must load through `rsaParsePrivateKey` and through
    `x509ParseRsaPrivateKey`, with its bit length, exponent and modulus, and
    both loads must sign every case to its bytes. Five keys must be refused
    by both: 1024, 1536, 2047 and 4097 bits, and a 2048-bit key with
    e = 2^32 + 1.
- **Interop.** `tests/link/net_tls_rsa_server`, and the `tests/run.js` checks
  around it, sign real handshakes under a 2048-bit certificate. Each is
  checked by a verifier somebody else wrote, OpenSSL's `s_client` and curl,
  and by `rsaVerifyPss`.
- **Constant time.** `tests/cases/ct_asm_rsa.ts` copies the module's inner
  functions word for word, and the check "ct_asm: ct_asm_rsa's copies match
  std/crypto/rsa-sign.ts" fails when they drift. `tests/ct-asm.js` then reads
  the machine code for x86-64, aarch64 and x86-64-v3. A control case, a
  table read at a secret index, must be refused.
- **Wipes.** The check "crypto: the wipes survive opt -O2 (rsaSignPrivateOp
  seventeen, rsaSignKeySound nine, rsaSignFullOp seven, rsaSignPrecompute four,
  RsaSignScratch.saltInto three, rsaSignPssSha256 one, rsaSignPssSha256Into
  one, rsaParsePrivateKey one, x509ParseRsaPrivateKey two)" counts the
  volatile stores left after `opt -O2`. `rsaSignKeySound`'s nine are the
  eight of `rsaSignCrtSound` and the signature `rsaSignFullOpens` wipes, both
  of which `opt` inlines into it; `rsaSignFullOp`'s seven, which that check
  and a first-form key's signature both call, are `d`, the scratch, the
  table, the entry, the power, the selection and the accumulator. It builds
  `tests/link/net_tls_rsa_server`, so it reads the signing path the TLS and
  QUIC servers run (`TlsKeySigner.sign`, `TlsRsaSigner.sign`,
  `rsaSignPssSha256Into`) and the PEM loader. Commenting out one
  `x509WipeBlocks` call drops the loader's count from two to one, and the
  check fails. The counts are exact for the LLVM the check runs under; another
  version's `opt` may inline differently and move them.

### Findings (signing)

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| RSA-S1 | None (a property) | `rsaSignPrivateOp`, `rsaSignHalf`, `rsaSignCrtSound`, `rsaSignKeySound` | CRT. The signature is two half-size exponentiations, by dP modulo p and by dQ modulo q, joined by Garner's formula (RFC 8017 §5.1.2, step 2.b), about a quarter of the work of one exponentiation by d modulo n. A fault in one half gives a signature that is right modulo one prime and wrong modulo the other, and its difference from a right one shares a factor with n (the Bellcore fault). | **Accepted, not counted.** No signature leaves unchecked: the carry out of s2 + q h must be zero, no limb past n's may be set, s must be below n, and s^e mod n must be m. One that fails is wiped and answers `null`. At load, `rsaSignCrtSound` checks, with no branch on the values, that p and q are odd, dP < p, dQ < q, qInv < p, p q = n and q qInv = 1 mod p; a trial signature of 2 must then pass the check above, and `rsaSignFullOpens` must open 2^d under e. Pinned by "rsaParsePrivateKey refuses each of 6 changes to a key's CRT values: p made even, q with bit 1 flipped, the last bit of dP, of dQ and of qInv flipped, and p and q swapped" (`crypto_rsa_sign`): with the s^e comparison removed, the dP and dQ changes load and 4 of the 6 are refused, so it fails. Also by `[P-KEY-CRT]` of `test/spec/rfc8017-rsassa-pss-sha256.ts`, 29 one-bit changes to p, q, dP, dQ or qInv. **Untested**: the carry, limb and s < n guards (with all three removed every check still passes, since the s^e comparison alone refuses each fault the tests make), and `rsaSignCrtSound`'s comparisons on their own (with them removed, the trial signature still refuses all 6 changes). Both are read from the code only. |
| RSA-S2 | None (a property) | `rsaSignHalf`, `rsaSignWindowStep`, `rsaSignMontMul`, `rsaSignReduce`, `rsaSignModAdd`, `rsaSignModSub`, `rsaSignLess`, `rsaSignMul` | No blinding. The exponents are not blinded, and neither is the message. | **Accepted, not counted.** The defence against timing is the fixed window. Every nibble of dP's and dQ's limbs, leading zeros included, gets four squarings, a read of the whole 16-entry table that keeps one entry under a mask, and one multiplication. The multiplication's final subtraction is kept or dropped by `ctSelect`. Garner's difference adds p back under a `ctEq` mask, and the comparisons of the load and of the check run every limb. Pinned by "ct_asm: ct_asm_rsa rsaSignReduce on x86-64: loops on public bounds only; no secret branch, call, secret-indexed access or secret-dependent latency". The same check runs for `rsaSignMontMulAt`, `rsaSignWindowStepAt`, `rsaSignModAdd`, `rsaSignModSub`, `rsaSignLess` and `rsaSignMul`, on x86-64, aarch64 and x86-64-v3. The control is "ct_asm: ct_asm_rsa rsaSignTableLoad on x86-64: refused for a load or store at a secret address". **Untested**: the outer loops of `rsaSignPrivateOp` and `rsaSignHalf` are not in the fixture, nor are `rsaSignR2`, `rsaSignPrecompute` and `rsaSignCrtSound`, which run on p and q once at load; and nothing reads wasm32's code. |
| RSA-S3 | None (a property) | `rsaSignPssSha256`, `RsaSignScratch.saltInto` | The salt is derived, not drawn: it is the SHA-256 of a fixed label, d's k bytes and the message hash. So the same message under the same key gives the same signature. | **Accepted, not counted.** PSS's security does not rest on the salt being random (RFC 8017 §8.1, note 4), and a verifier cannot tell the difference. The salt is unpredictable without d, and the module needs no random source. Pinned by "rsaSignPssSha256 gives each of the 12 known answers byte for byte", "each of those signatures verifies under rsaVerifyPss with SHA-256 and a 32-byte salt" and "under each of the 6 keys, rsaSignPssSha256Salted signs under an empty and a 32-byte salt, each verifying at its own length only, the same twice, and unlike the derived salt". |
| RSA-S4 | Low | `rsaParsePrivateKey`, `x509ParseRsaPrivateKey` | Key bounds and strict DER. A key is refused when it is under 2048 or over 4096 bits, uses a non-shortest length, has a non-minimal or negative INTEGER or a version other than 0, has an even modulus or public exponent, has e under 3 or at 2^32 or more, has d zero or not below n, has CRT values that do not hold together (see RSA-S1), or carries bytes after the key. A key that fails a trial signature is also refused. | **Fixed by design.** Pinned by "rsaParsePrivateKey refuses each of 9 changes to a key: empty, a byte short, a byte after, version 1, an even modulus, a negative modulus, an even public exponent, a private exponent one bit off, an outer length one long" and by the six CRT changes of RSA-S1 (`crypto_rsa_sign`). Also pinned, in `net_tls_rsa_server`: "a 1024-bit key is refused, without a panic", "a certificate is not a key", and the PKCS#1 and PKCS#8 loads of the same key. In `crypto_rsa_sign_interop`, "rsaParsePrivateKey and x509ParseRsaPrivateKey each refuse every one of the 5 keys outside 2048 to 4096 bits or with e of 2^32 or more (NIST 1024; NIST 1536; OpenSSL 2047; OpenSSL 2048, e = 4294967297; Go 4097)": with `rsaParsePrivateKey`'s `eBits > 32` removed, the e = 2^32 + 1 key loads and it fails. **Untested**: the `bits` comparisons on their own. With them removed from `rsaParsePrivateKey`, and from `rsaSignPssEncode` too, all 5 keys are still refused, by the 256 to 512-byte range of `rsaSignHalfWidth` and `rsaSignKeySound` and by `rsaSignKeyBits`, which is read from the code only. No test offers a d not below n. Nor does any test reach `x509Pkcs8RsaKey`'s refusals: an EC key in PKCS#8, a wrong algorithm OID, a missing NULL parameter, version 1 with a trailing public key, trailing bytes, or more than one PEM block. No test hands the RSA signer a P-256 `Secret` either. All of these refusals are read from the code only, and the user guide's "an EC key ... answers `null`" (`docs/guide/using-nish/tls-certificates.md`) rests on them. |
| RSA-S5 | Low | `rsaSignPrivateOp`, `rsaSignPrecompute`, `rsaSignKeySound`, `RsaSignScratch`, `rsaParsePrivateKey`, `x509ParseRsaPrivateKey` | What a wipe cannot reach. The key's DER is the caller's, and so is the PEM string, which the language cannot zero ([crypto-x509.md](crypto-x509.md), X509-7). | **Recorded.** The `Secret` holds n, d, e, p, q, dP, dQ, qInv and the four per-prime Montgomery constants. In the private operation, the limbs of p, q, dP, dQ and qInv, the four constants, the two halves, the table, the scratch and the signature's limbs are wiped (seventeen arrays); a signature that fails its check is never turned into bytes. Also wiped: the four arrays of `rsaSignPrecompute`, the eight of `rsaSignCrtSound` and the seven of `rsaSignFullOpens`, the three of the salt hasher, the exponent copy (in `rsaSignPssSha256` and in `rsaSignPssSha256Into`, the servers' path), a key that fails its trial, and the PKCS#1 and PKCS#8 blocks `x509ParseRsaPrivateKey` decoded. Each is pinned by the opt -O2 wipe check above. `TlsKeySigner.sign` and `TlsRsaSigner.sign` borrow the key and copy none of it: the exponent copy is the signing path's only one. That they copy nothing is read from the code; the check pins the wipes, not the absence of other copies. |
| RSA-S6 | None (a test gap, closed) | `rsaSignPssEncode` | A modulus whose bit length is one more than a multiple of 8, such as 2049 bits, where the encoded message is one byte shorter than the modulus, had no test: every test key was 2048, 3072 or 4096 bits. The check after signing, once untested here, is now pinned (RSA-S1). | **Closed.** Go's 2049-bit key signs all five of its cases to Go's and pyca's bytes, in `crypto_rsa_sign_interop`: "rsaSignPssSha256 gives each of the 20 derived-salt signatures byte for byte, each signed by Go where Go loads the key and verified by OpenSSL, pyca and, where it loads the key, Go" and "rsaSignPssSha256Salted gives each of the 30 signatures under a 32-byte salt, the longest salt the key takes or an empty salt byte for byte, Go signing the salted ones where it loads the key and OpenSSL and pyca the empty-salt ones". With emLen set to k, the five 2049-bit signatures differ and both fail. The other odd sizes (2050, 2054, 3071 and 4094 bits) are covered by the same checks. |

None of these is counted in the README's Areas table: RSA-S4 is fixed by
design, RSA-S6 is a closed test gap, and the others are properties or
recorded.

### Properties verified (signing)

- **Signatures verify elsewhere.** Pinned by these `tests/run.js` checks:
  - "net_tls_rsa_server: openssl s_client -tls1_3 completes under the RSA
    certificate: TLSv1.3, an AEAD suite, peer signature RSA-PSS";
  - "net_tls_rsa_server: curl --tlsv1.3 GETs the page over HTTP/1.1 under the
    RSA certificate";
  - "net_tls_rsa_server: curl --http2 --tlsv1.3 GETs the page over HTTP/2
    under the RSA certificate".

  `net_tls_rsa_server` itself verifies each CertificateVerify under the
  certificate's key, over TCP and over QUIC: "the signature verifies under the
  certificate's key, salt 32" and "HTTP/3: the handshake, its RSA-PSS
  signature verified". A flipped bit fails: "a signature with one bit flipped
  does not".
- **Byte-for-byte known answers** under six keys, 2048 to 4096 bits: see
  RSA-S3.
- **Other implementations' signatures**, byte for byte, in
  `crypto_rsa_sign_interop`: "rsaSignPssSha256Salted gives each of NIST
  CAVP's 30 FIPS 186-2 SHA-256 signatures, under its 20-byte salt, byte for
  byte", and the 50 signatures under the 10 keys OpenSSL, Go and pyca made
  (see RSA-S6). Each loads through PKCS#1 DER and PKCS#8 PEM alike: "each of
  the 10 keys OpenSSL, Go and pyca made (...) loads from the library's PKCS #1
  DER and from its PKCS #8 PEM, each load with its bit length, public
  exponent and modulus".
- **The key is the right one.** A signature under one key fails under
  another: "a signature under one 2048-bit key fails under the other". A
  private exponent one bit off is refused at load: see RSA-S4.
- **Constant time** on x86-64, aarch64 and x86-64-v3, for the functions the
  fixture holds: see RSA-S2.
- **Wipes** survive `opt -O2`: see RSA-S5.

### Tests (signing)

- "link/crypto_rsa_sign: exits with 0 and stdout matches expected.out", with
  9 checks, and "link/crypto_rsa_sign_f64: exits with 0 and stdout matches
  expected.out", with the same 9 in f64 mode.
- "link/crypto_rsa_sign_interop: exits with 0 and stdout matches
  expected.out", with 10 checks.
- "spec: test/spec/rfc8017-rsassa-pss-sha256.ts passes against
  std/crypto/rsa-sign.ts".
- "link/net_tls_rsa_server: exits with 0 and stdout matches expected.out",
  with 26 checks.
- The seven `net_tls_rsa_server:` checks in `tests/run.js`.
- The `ct_asm: ct_asm_rsa` checks, "ct_asm: ct_asm_rsa's copies match
  std/crypto/rsa-sign.ts" and "ct_asm_rsa: IR matches golden".
- "crypto: the wipes survive opt -O2 (rsaSignPrivateOp seventeen,
  rsaSignKeySound nine, rsaSignFullOp seven, rsaSignPrecompute four, RsaSignScratch.saltInto
  three, rsaSignPssSha256 one, rsaSignPssSha256Into one, rsaParsePrivateKey
  one, x509ParseRsaPrivateKey two)".
