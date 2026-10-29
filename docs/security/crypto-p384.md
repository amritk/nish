# Security record: P-384 ECDSA verification

The record of `nish/crypto/p384` (#480, run ledger #987): ECDSA signature
verification over NIST P-384 (secp384r1), for a digest from any hash and for
SHA-384 over a whole message. It sets down what the module refuses and why,
what it does not claim, and the test that pins each property. It is written
with the code rather than after an audit, so that the audit starts from
evidence.

Anchors are function names in `std/crypto/p384.ts` on the head that merges
this record, which branches from `2cdef4f`.

**Result.** Every Wycheproof secp384r1 ECDSA vector of the five files the
module covers answers what its file expects: 2,116 cases, 1,010 valid and
1,106 invalid, none "acceptable". The two RFC 6979 §A.2.6 SHA-384 signatures
verify. A key or signature of the wrong length, a key prefix other than 0x04,
a coordinate of p or more, a key off the curve, `r` or `s` outside [1, n) and
a sum that is the identity each answer `false`, never a panic. Every check but
five has a test that fails when that check alone is removed; the five are
each backed by another check, and the record says which (see
[Refusals](#refusals)). Nothing was found to fix or left open. Two properties
are recorded rather than changed: high `s` is accepted (P384-1) and the module
runs in variable time (P384-2), both because every input is public.

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/p384.ts` | `p384Verify`, `p384VerifySha384`, and everything they reach: the `p384Fiat*` field and scalar arithmetic ported from fiat-crypto, `p384DecodePoint`, `p384ScalarInRange`, `p384DigestScalar`, `p384Below`, `p384ReduceOnce`, `p384FieldInvert`, `p384ScalarInvert`, the complete point formulas `p384PointAdd` and `p384PointDouble`, and `p384DoubleMult` |

Out of scope: `std/crypto/sha512.ts` (which holds `sha384`) and `sha256.ts`, `ct.ts`'s
`timingSafeEqual` (all in [crypto-k1.md](crypto-k1.md)); DER, which a caller
unwraps before calling (`std/crypto/x509.ts`, [crypto-x509.md](crypto-x509.md),
does not call this module yet); and the test-only DER helper
`tests/link/crypto_wycheproof_p384/der.ts`, which converts Wycheproof's DER
signatures to `r || s` for the suite and is not shipped.

## Threat model

The attacker controls every byte of every argument: the public key, the
digest or message, and the signature, of any length and any value, including
coordinates of p or more, points off the curve, the identity's encodings, and
scalars of 0, n or more. A win is a signature accepted that the key's owner
did not make (forgery), a panic, an unbounded loop or allocation, or two
encodings of one key or one signature both accepted where the specification
allows one.

**No secret.** The module only verifies. It holds no private key and computes
on no secret intermediate: every value is a public key, a signature or a
digest someone sent. So nothing here is a `Secret` (`nish:secret`) and
nothing is wiped, and the project's rule that secret material in
`std/crypto` is a `Secret` does not apply. A signing function added later
brings that rule, and a record row, with it.

## Method

**Specifications.** SEC 1 v2 §2.3.3–2.3.4 (point encoding), §3.2.2
(public-key validation) and §4.1.4 (verification); FIPS 186-4 §6.4 and
§6.4.2; SEC 2 §2.5.1 (the curve's constants); RFC 6979 §A.2.6 (the P-384
vectors).

**The fiat-crypto port.** The field and scalar arithmetic is fiat-crypto's
32-bit word-by-word Montgomery code, `fiat-c/src/p384_32.c` and
`fiat-c/src/p384_scalar_32.c` at commit
`abe078c5149bc15bc368c27cc364fdef56470136` (MIT,
`std/crypto/LICENSE-fiat-crypto-p384`). The functions were translated by a
script, statement for statement, in the form `std/crypto/p256.ts` carries
P-256's: each `addcarryx`, `subborrowx` and `mulx` answers a packed `u64`, and
each function starts with a length guard. Ported: field `mul`, `add`, `sub`,
`nonzero`, `selectznz`, `set_one` and the helpers; scalar `mul` and `set_one`.
`square` is not ported (`mul` of a value by itself is used), nor scalar `add`.
The translation is checked by its answers, not by a statement diff: every
vector below goes through every ported function.

**The verifier.** `p384Verify` checks the signature's length, decodes and
validates the key, checks `r` and `s` are in [1, n), takes the digest's
leftmost 384 bits and subtracts n once if it is n or more, inverts `s` by
Fermat (`s^(n-2)`), computes `u1 G + u2 Q` by Shamir's trick over the
complete formulas of Renes, Costello and Batina (Algorithms 4 and 6, a = -3),
refuses the identity, and compares the affine x mod n with `r` by
`timingSafeEqual`. The complete formulas need no case for a doubling, the
identity or a point and its negation, so no input steers the sum down an
unchecked path.

**Agreement.** RFC 6979 §A.2.6's two SHA-384 signatures, and Wycheproof's
`testvectors_v1/` at `3fa63dd0344abb611f1fb1d77e119938603ea230`:

| File | Cases | Valid verified | Invalid refused (DER helper / `p384Verify`) |
| --- | ---: | ---: | ---: |
| `ecdsa_secp384r1_sha384_test.json` | 504 | 194 | 310 (235 / 75) |
| `ecdsa_secp384r1_sha384_p1363_test.json` | 280 | 193 | 87 (0 / 87) |
| `ecdsa_secp384r1_sha256_test.json` | 472 | 162 | 310 (234 / 76) |
| `ecdsa_secp384r1_sha512_test.json` | 542 | 231 | 311 (236 / 75) |
| `ecdsa_secp384r1_sha512_p1363_test.json` | 318 | 230 | 88 (0 / 88) |

A DER case the helper refuses is a malformed encoding, which never reaches the
module; the cases that reach it are the ones that test it. Not covered:
`ecdsa_secp384r1_sha3_384_test.json`, because the tree has no SHA3-384.

**Crafted keys.** A Python model of the curve made keys the vectors do not
hold: a point whose x is small enough that x + p fits in 48 bytes, a point
whose y is 1, and G with y + 1, each with a signature that verifies under the
true point, so that the refusal of the out-of-range or off-curve spelling is
the check under test and not a wrong signature.

## Refusals

Each check was removed in turn (a one-off mutation run on the change's own
head, not in the repository), the suite rebuilt and run, and the file
restored. "Caught" names the test that failed.

| Check | Where | Caught by |
| --- | --- | --- |
| signature length 96 | `p384Verify` | "a 97-byte signature is refused" |
| key length 97 | `p384DecodePoint` | "a key of 98 bytes is refused" |
| key prefix 0x04 | `p384DecodePoint` | "a compressed prefix 0x02 is refused", "a hybrid prefix 0x06 is refused" |
| x < p | `p384DecodePoint` | "and with x = p is refused" |
| y < p | `p384DecodePoint` | "and with y = 1 + p is refused" |
| on the curve | `p384DecodePoint` | "(Gx, Gy + 1), off the curve, is refused" |
| `r`, `s` < n | `p384ScalarInRange` | "(r, 1 + n) is refused" and Wycheproof cases |
| `s` < n | `p384Verify` (second call) | "(r, 1 + n) is refused" and Wycheproof cases |
| x reduced mod n | `p384Verify` | 15 Wycheproof cases |
| the identity, with `r` ≠ 0 | `p384Verify`, `p384ScalarInRange` | "r = 0 over the digest 0 is refused" and Wycheproof cases |

Five checks are each backed by another, so removing one alone changes no
answer; they are kept as defence in depth and recorded here rather than
claimed as tested on their own:

- **`r` ≠ 0 and `s` ≠ 0.** With `s` = 0, Fermat's inverse is 0, so u1 = u2 = 0
  and the sum is the identity, which is refused. The same holds for `s` = n,
  which is 0 mod n, so "s = n is refused" is backed by the identity check and
  does not pin `s` < n; "(r, 1 + n) is refused" does, since 1 + n is 1 mod n
  and (r, 1) verifies. With `r` = 0, no affine x mod n of a non-identity sum
  equals 0 for the keys tried. Removed together with the identity check,
  "r = 0 over the digest 0 is refused" fails.
- **`r` < n alone.** The final compare is against an x reduced below n, which
  no `r` of n or more equals.
- **The identity check alone.** The identity's Z is 0, its inverse is 0, so
  its x reads as 0, which no `r` in [1, n) equals.
- **The digest's reduction mod n.** Montgomery multiplication of a digest
  below 2^384 still answers the right value mod n. The reduction keeps
  fiat's stated precondition, an input below n.

## Findings and properties

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| P384-1 | None (a property, recorded) | `p384Verify` | **High `s` is accepted.** ECDSA is malleable: when (r, s) verifies, (r, n − s) does too, as FIPS 186-4 and SEC 1 have it. The module does not ask for the lower `s`. | **Accepted.** The doc says a protocol that needs one signature per message and key refuses the upper half itself. Pinned by "(r, n - s) verifies too: ECDSA is malleable". |
| P384-2 | None (a property, recorded) | `p384DoubleMult`, `p384FieldInvert`, `p384ScalarInvert` | **Variable time.** Shamir's trick branches on the bits of u1 and u2, and the inversions on the public exponents. Every input is public, so timing reveals nothing that is not already the caller's to see. | **Accepted.** No `ct_asm` fixture reads this module. A signing function would need a constant-time path and its own fixture. |
| P384-3 | None (a property, recorded) | `p384DigestScalar` | **A digest longer than 48 bytes is truncated** to its leftmost 384 bits (SEC 1 §4.1.4 step 5), and one shorter is its own value. A SHA-512 digest is therefore usable, as Wycheproof's SHA-512 files require. | **As specified.** Pinned by "a 64-byte digest is its leftmost 48 bytes", "a 1-byte digest is its own value", "an empty digest is 0, not 5", "a 48-byte digest of 5 + n is 5" and the SHA-512 files. |

P-384 has cofactor 1, so a point that satisfies the curve equation is in the
prime-order group, and no small-subgroup or invalid-curve key survives
`p384DecodePoint`.

## Tests

- "link/crypto_p384: exits with 0 and stdout matches expected.out", which runs
  `tests/link/crypto_p384/suite.ts`: the RFC 6979 vectors, the refusals above,
  the crafted keys, P384-1 and P384-3, and the five Wycheproof files.
