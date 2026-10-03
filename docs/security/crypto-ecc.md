# Security audit: P-256 ECDSA and X25519

The record of the security audit of `nish/crypto/p256` and `nish/crypto/x25519`
(tracking issue #363, stage "Crypto ECC"). It says what was checked, how, what
was found and what became of it, and names the test that pins each property,
so that the next audit starts from evidence rather than from trust.

**Result.** No forgery, key recovery, panic, non-canonical accept or
secret-dependent branch was found. Every applicable Wycheproof vector passes
(2,150 of them, 1,666 new), the fiat-crypto port matches upstream statement for
statement, and two independent reference implementations agree with both
modules on 5,000 more inputs. Three Low findings are recorded below: two were
fixed here, and one lies outside this stage's files and stays open.

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/p256.ts` | `p256PublicKey`, `p256Sign`, `p256Verify`, `p256SignSha256`, `p256VerifySha256`, and everything they reach: the `p256Fiat*` field and scalar arithmetic, `p256DecodePoint` / `p256EncodePoint`, `p256ScalarInRange`, `p256DigestScalar`, the RFC 6979 nonce (`p256NonceKey`, `p256SignScalar`), the inversions, the complete point formulas and the windowed `p256ScalarMult` |
| `std/crypto/x25519.ts` | `x25519`, `x25519Base`, and the field (`f25519*`), `f25519Decode` / `f25519Encode`, `f25519Invert` and `x25519Ladder` |
| `tests/cases/ct_asm_p256.ts`, `tests/cases/ct_asm_x25519.ts` | the copies the constant-time disassembly check holds, compared here with the module functions they mirror |

Out of scope: `std/crypto/sha256.ts`, `sha512.ts`, `hmac.ts` and `ct.ts`,
which these modules call (the K1 stage audits them), and `std/crypto/x509.ts`,
which calls `p256Verify` (the X.509 stage).

## Threat model

The attacker controls every byte of every argument of the verifying and
key-agreement side: `p256Verify`'s public key, digest and signature (any
length, any value), and `x25519`'s `u` (any length, any value, including
low-order points, points on the twist and u-coordinates of p or more). On the
signing side the attacker chooses the digest and sees the signature, and may
time the call; the private key is the secret. For X25519 the scalar is the
secret, and the attacker may time the call and choose `u`.

A win for the attacker is any of: a signature accepted that the key's owner
did not make (forgery), a private key or scalar learned from outputs or timing
(key recovery), a panic, an unbounded loop or allocation (denial of service),
or two encodings of one value both accepted (a non-canonical accept).

## Method

**Specifications compared against.** SEC 1 v2 §2.3.3–2.3.4 (point encoding),
§3.2.2 (public-key validation) and §4.1.3–4.1.4 (ECDSA signing and
verification); FIPS 186-4 §6.4; SEC 2 §2.4.2 (the curve's constants); RFC 6979
§2.3 and §3.2 (bits2int, bits2octets and the HMAC-DRBG nonce); RFC 7748 §5
(decoding, clamping and the ladder) and §6.1 (the all-zero check).

**Upstream diff of the fiat-crypto port.** `fiat-c/src/p256_32.c` and
`fiat-c/src/p256_scalar_32.c` were fetched at the commit
`THIRD_PARTY_NOTICES.md` names, `abe078c5149bc15bc368c27cc364fdef56470136`.
A script parsed each C function into its statement list (every `mulx`,
`addcarryx`, `subborrowx` and `cmovznz` call with its outputs and arguments,
every assignment and every store to `out1`) and did the same to the Nish
translation, undoing its three documented changes (the packed `u64` results,
the length guard, and `square`'s limbs read into locals first). Every one of
the ten ported functions — field `mul`, `square`, `add`, `sub`, `nonzero`,
`selectznz`, `set_one`, and scalar `mul`, `add`, `set_one` — matched
statement for statement: 359, 359, 33, 25, 2, 16, 8, 415, 33 and 8 statements.
Where Nish leaves out one half of a helper's result, the script checked that
fiat never reads that half. The script was also shown to catch a change: one
constant in `p256FiatMul` altered by one bit was reported at once. The four
helpers were read against upstream by hand: `subborrowx` keeps bit 32 of a
difference that wraps modulo 2^64, which is the borrow; `cmovznz` is
`ctSelect(ctEq(arg1, 0), arg2, arg3)`, which answers `arg2` for a zero `arg1`,
as fiat's does.

**The closest upstream for X25519.** `std/crypto/x25519.ts` says it was written
from RFC 7748. The nearest well-known implementations are ref10's field code
(SUPERCOP, public domain) and curve25519-donna. Both also use ten signed limbs
of alternately 26 and 25 bits. Function by function:

- `f25519Mul` does not follow ref10's `fe_mul`. It loops over a doubled copy
  and a 19-limb wide product, where ref10 writes out 100 products with the
  factors 2 and 19 folded in by hand.
- `f25519Carry` and `f25519Encode` share ref10's idea: an arithmetic-shift
  carry, and adding 19 to decide whether the value is at least p. They do not
  share its statement order, and the byte packing is a loop over an
  accumulator.
- `f25519Invert` uses the same addition chain as ref10's `fe_invert` (254
  squarings and 11 multiplications to reach p − 2). That chain is Bernstein's
  published construction, an idea rather than code, and ref10 is public domain
  in any case.
- `x25519Ladder` is RFC 7748 §5's pseudocode, step for step.

Nothing here needs a notice that it does not already carry.

**Constants.** p, n, R² mod p, R² mod n, b·R mod p, R mod p (fiat's
`set_one`), R mod n (the scalar `set_one`), both inversion exponents p − 2 and
n − 2, and G's coordinates were recomputed from SEC 2 in Python and compared
limb by limb. G was checked to be on the curve. All agree.

**Constant-time fixtures.** The copies in `tests/cases/ct_asm_p256.ts` and
`ct_asm_x25519.ts` were compared mechanically with the module functions they
mirror. The fiat functions, `p256TableMove` and `p256Copy` are identical once
the guard is dropped. `p256PointAdd` (43 steps) and `p256PointDouble` (34
steps) call the same field functions on the same operands in the same order,
once the coordinate arrays are renamed. The X25519 field functions and the
ladder step differ only in the ways the fixture's header documents. So the
disassembly check proves the shape of the code that ships.
`node tests/run.js ct_asm` passes on x86-64 and aarch64.

**Bounds of the X25519 limbs.** Signed `i64` overflow is undefined behaviour
here, so `f25519Mul`'s bound was re-derived rather than trusted. Inputs have
limbs below 2^27 in magnitude. Each output limb collects ten products, each
scaled by at most 2 × 19, so each limb is below 380 × 2^54 < 2^62.6. Every
partial sum is bounded by the same sum of absolute values. `wide[k + 10] × 19`
plus `wide[k]` stays below 362 × 2^54, and the carries `f25519Carry` then adds
are below 2^38. Every call site in the ladder was checked to pass reduced
elements, or one sum or difference of two.

**Differential testing.** Two reference implementations were written in Python
from the RFCs' own pseudocode: RFC 7748's ladder, and affine-coordinate ECDSA
with RFC 6979. Both were first checked against the Wycheproof files. A driver
program linked against the modules was then compared with them:

- X25519, 1,692 inputs: 1,500 random (scalar, u) pairs over all 256 bits of
  `u`; 15 special u-coordinates (0, 1, 2, 9, p − 1, p, p + 1, p + 9,
  2^255 − 1, 2^255 − 20, 2^255 − 18, 2^254 and both points of order 8), each
  with its top bit clear and set, 6 times each; and all-zero, all-one and small
  scalars. 0 mismatches.
- P-256, 3,379 operations. Public keys of 0, 1, 2, 3, n − 1, n, n + 1,
  2^256 − 1, (n ± 1)/2 and 40 random scalars. Signatures under 24 keys (1, 2,
  n − 2, n − 1 and 20 random) of digests of lengths 0, 1, 2, 20, 31, 32, 33,
  48 and 64, and of the digests 0, 1, n − 1, n, n + 1, 2^256 − 1 and p.
  Verification of every one of those signatures, and of its high-`s` twin, a
  one-bit flip, `r + n`, `s + n`, the digest `z + n`, a digest that puts the
  sum at infinity, and a digest that makes the final addition a doubling. And
  10 signatures built from the verification equation so that u1·G = u2·Q.
  0 mismatches. RFC 6979 signatures agreed byte for byte.

**Wycheproof.** At commit `3fa63dd0344abb611f1fb1d77e119938603ea230`, every
file that applies to these two modules is now run:

| File | Cases | Before | Test |
| --- | --- | --- | --- |
| `ecdsa_secp256r1_sha256_test.json` | 484 | run | `tests/link/crypto_p256`, `crypto_p256_f64` |
| `ecdsa_secp256r1_sha256_p1363_test.json` | 262 | **added** | the same |
| `ecdsa_secp256r1_sha512_test.json` | 554 | **added** | the same (checks the truncation of a 64-byte digest) |
| `ecdsa_secp256r1_sha512_p1363_test.json` | 332 | **added** | the same |
| `x25519_test.json` | 518 | **added** | `tests/link/crypto_x25519`, `crypto_x25519_f64` |

Every case passes in both number modes. The 254 X25519 cases marked
`acceptable` are low-order points, twist points and non-canonical
u-coordinates. They are held to the file's exact shared secret, which is RFC
7748's answer and so this module's promise. Some files do not apply: the
`ecdh_secp256r1_*` files (the module has no ECDH), the SHA-3 and SHA-224
variants (`std` has neither hash), and `x25519_asn` / `_jwk` / `_pem` (these
test key encodings, which the module does not parse).

The new ECDSA vectors are in `tests/link/crypto_wycheproof/ecdsa_secp256r1_sha256.ts`,
the file that already carried Wycheproof's notice, and the X25519 ones in
`tests/link/crypto_wycheproof/x25519.ts`, which carries the same notice. Each
has a row in `THIRD_PARTY_NOTICES.md` naming the upstream files it derives
from and their case counts (ECC-3).

**Mutation check of the tests.** A test that has never been seen to fail
proves little, so five defences were removed one at a time and the suites were
rerun.

- The digest's reduction mod n removed: caught by "the digest n signs as the
  digest 0" and "the digest n + 5 signs as the digest 5".
- `p256Verify`'s `r`/`s` range check removed: caught by Wycheproof cases in
  all four ECDSA files.
- Bit 254 no longer set by the X25519 clamp: caught by RFC 7748's vectors and
  Wycheproof.
- The explicit top-bit mask in `f25519Decode` removed: **not caught, and
  cannot be.** The decoder fills exactly 255 bits of limbs and drops whatever
  is left in its accumulator, so bit 255 is ignored with or without the mask.
  The mask is a second, redundant statement of RFC 7748 §5's rule. The
  property itself is pinned by "a u with its top bit set gives the same answer
  as with it clear".
- `p256Verify`'s check for a sum at the identity removed: **not caught, and
  cannot be.** The identity's Z inverts to 0, so its x reads as 0, and `r` has
  already been checked to be at least 1, so the comparison fails anyway. The
  check is a redundant defence that states the rule where SEC 1 does. The
  property is pinned by "a sum u1 G + u2 Q at the identity is refused".

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| ECC-1 | Low | `std/crypto/x25519.ts:481` (`x25519`'s doc) | The doc said RFC 7748 §6.1's all-zero check is made by "TLS 1.3 (WP34 T1)". No TLS module exists in the tree: T1 is planned (`docs/wp34-hosting-cs.md`), and nothing calls `x25519` today. A reader could conclude the check is made for them. | **Fixed in this change.** The doc now says nothing in the tree makes the check yet, and that a caller must refuse an all-zero answer itself, with `timingSafeEqual`. Doc only, so there is no failing-first test. The behaviour it describes is pinned by `crypto_x25519`'s "u = 0 answers all zeros, not null" and the six "low-order u … answers all zeros" checks. `std/README.md` says the same thing; see below. |
| ECC-2 | Low | `std/crypto/p256.ts` (`p256Sign`, `p256SignScalar`), `std/crypto/x25519.ts` (`x25519`) | Secret intermediates are not wiped: the private-key limbs `dM`, the nonce `v` and its Montgomery form, RFC 6979's HMAC key `k`, the table built from G, and X25519's clamped scalar copy and ladder state all stay in arena memory after the call returns. A later memory disclosure could read them. The language has no store that the optimiser is barred from removing, so a wipe written in Nish could be deleted as a dead store and would give false assurance. | **Open; the primitive exists, adoption waits for a release.** `secureZero(bytes: u8[])` (#385) is the builtin this needed: one call into `nish_wipe` in `runtime/runtime.c`, whose `volatile` stores survive `-O2` and `-flto`, as the LTO probe in `tests/runtime-test.c` shows ([LANGUAGE.md](../LANGUAGE.md#wiping-a-secret-securezero)). Under the rolling freeze `std/` may call it only once a release ships it, so both modules still return without wiping; the release after it adds the calls, with a test that the wipe survives `-O2`. |
| ECC-3 | Low (documentation) | `THIRD_PARTY_NOTICES.md` (the `tests/link/crypto_wycheproof/ecdsa_secp256r1_sha256.ts` row) | The row says the file holds "all 484 cases and the 113 group keys" of one Wycheproof file. As first written, this change put five files' cases there, ECDSA and X25519, as its header said, so the row no longer said what the file derives from (`.claude/licensing.md`, item 4). `third-party-licence` reads only the file and licence-text columns, so it could not catch this. | **Fixed in this change.** The X25519 cases moved to `tests/link/crypto_wycheproof/x25519.ts`, with the same upstream notice and a row of its own (`x25519_test.json`, 518 cases), and `crypto_x25519/wycheproof.ts` reads them from there. The ECDSA row now names its four files and their case and group-key counts. Layout and documentation only: no value of any vector changed, and `crypto_p256*` and `crypto_x25519*` answer as before. |

## Properties verified

Each property below held on the base commit and is now pinned by a test that
would fail if it stopped holding.

**P-256 verification** (`p256Verify`; `tests/link/crypto_p256/suite.ts`, run by
`crypto_p256` and, in `f64` mode, `crypto_p256_f64`):

- `r` or `s` equal to 0, to n or above n is refused (SEC 1 §4.1.4 step 1):
  "r = 0 is refused", "s = 0 is refused", "r = n is refused", "s = n is
  refused", "r = n + 1 is refused", "s = n + 1 is refused", and Wycheproof's
  range cases.
- A signature of any length other than 64 bytes is refused: "a 63-byte
  signature is refused" and "a 65-byte signature is refused".
- A public key off the curve, with a coordinate of p or more, not 65 bytes, not
  prefixed 0x04, or the identity (0x00, or 65 zero bytes) is refused (SEC 1
  §3.2.2): "a key with a flipped bit in x/y is off the curve", "the same point
  with x = 5 + p is refused", "a key with y = p is refused", "a key with prefix
  0x03 is refused", "the identity's SEC 1 encoding, 0x00, is refused", "65
  zero bytes are refused", "0x04 then (0, 0) is refused", and the 64- and
  66-byte cases. P-256 has cofactor 1, so a point on the curve is in the prime
  order group, and no invalid-curve or small-subgroup key survives the curve
  equation.
- A sum u1·G + u2·Q at the identity is refused: "a sum u1 G + u2 Q at the
  identity is refused". It is refused twice over. The explicit check is
  `p256FiatNonzero(sum.z) === 0`, and fiat's outputs are fully reduced, so a
  zero Z is exactly the all-zero limbs. And even without that check, the
  identity's x reads as 0, which no `r` in [1, n) equals (see the mutation
  check above).
- A sum that is a doubling (u1·G = u2·Q) goes through the complete formulas and
  verifies: "a signature whose u1 G equals u2 Q (the sum is a doubling)
  verifies". u1 = 0 works too: "the signature of the digest 0 verifies
  (u1 = 0)".
- The digest is taken as its leftmost 256 bits and reduced once modulo n
  (SEC 1 §4.1.4 step 5; RFC 6979 bits2int). "a 48-byte digest signs as its
  leftmost 32 bytes", "the digest n signs as the digest 0", "the digest n + 5
  signs as the digest 5", "the signature of 5 verifies under the digest n + 5",
  and all 886 cases of the two SHA-512 files.
- **High `s` is accepted, by design.** ECDSA is malleable: (r, n − s) verifies
  whenever (r, s) does. FIPS 186-4 and SEC 1 require no low-`s` rule, and this
  module adds none. "(r, n - s) of "sample" verifies as well: ECDSA is
  malleable". `p256Verify`'s doc now says so, and says that a protocol needing
  one signature per message must refuse the upper half itself.
- Verification never panics on any length of key, digest or signature. The
  length tests above give it 1-, 64- and 66-byte keys and 63- and 65-byte
  signatures, and the 594 P1363 cases hand it signatures of 2, 16, 26, 32, 40,
  66, 68 and 82 bytes as well as 64.

**P-256 keys and signing** (`p256PublicKey`, `p256Sign`; the same suite):

- A private key of 0, of n or above n, or not 32 bytes is refused by both
  functions: "p256PublicKey(0) is null", "(n)", "(n + 1)", "(2^256 - 1)", the
  31- and 33-byte cases, "p256Sign with private key 0 is null", "… n is null",
  "… n + 1 is null", "… 2^256 - 1 is null", and "p256SignSha256 with a 31-byte
  key is null" and "… 33-byte key is null".
- The nonce is RFC 6979 §3.2's for HMAC-SHA-256: A.2.5's `k` is pinned through
  `r` for "sample" and "test", and the whole signatures agree byte for byte
  ("A.2.5 SHA-256 "sample": r || s", "… "test": r || s"). The differential run
  agreed on 408 more. `h1` is bits2octets, the digest reduced mod n, which is
  why the digests n and 0 sign identically.
- The public keys of 1 and n − 1 are G and −G: "the public key of 1 is G" and
  "the public key of n - 1 is -G".

**X25519** (`x25519`, `x25519Base`; `tests/link/crypto_x25519/main.ts` and
`wycheproof.ts`, with the Wycheproof run repeated in `f64` mode by
`crypto_x25519_f64`):

- The scalar is clamped as RFC 7748 §5 says, on a copy: "the scalar is clamped
  on a copy, not in place", and every Wycheproof case, whose private keys are
  unclamped.
- The top bit of `u` is masked before anything else, and a `u` of p or more is
  taken modulo p: "a u with its top bit set gives the same answer as with it
  clear", "u = p decodes as 0 …", "u = p + 1 decodes as 1", "u = p + 9
  decodes as 9", "u = p with its top bit set still decodes as 0", and
  Wycheproof's 19 `NonCanonicalPublic` cases.
- The answer is always canonical, below p: "the answer for u = p + 1 is below
  p", "… p + 9 …", "an all-ones u … answers below p", and every Wycheproof
  shared secret compared byte for byte.
- Low-order points answer all zeros, which is returned rather than refused, as
  §6.1 leaves the check to the protocol: "u = 0 answers all zeros, not null",
  six "low-order u … answers all zeros" checks, and Wycheproof's 31
  cases flagged both `LowOrderPublic` and `ZeroSharedSecret`.
- Twist points answer RFC 7748's value: Wycheproof's 221 `Twist` cases.
- Anything but 32-byte arguments answers `null`: the seven length checks in
  `crypto_x25519` and "a 31-byte scalar answers null" in `crypto_x25519_f64`.

**Constant time** (`node tests/run.js ct_asm`): the P-256 field and scalar
arithmetic, its conditional move, the table read by a secret digit, the
complete addition and doubling and one window step, and the X25519 field
arithmetic, conditional swap and ladder step have no branch, no call the
checker cannot follow, and no load or store at a secret address, on x86-64 and
aarch64. The fixtures' copies were checked above to match the module code. The
loops around these steps, the inversions (square-and-multiply on the public
exponents p − 2 and n − 2, or X25519's fixed addition chain), the encodings
and the nonce derivation branch only on public positions. That was confirmed
by reading, and it remains discipline rather than proof, as the module headers
say. The one branch on a secret is RFC 6979's retry when a candidate nonce is
not below n. The RFC prescribes it, it happens about once in 2^32 signatures,
and it reveals only that a discarded value was large.

## Doc corrections for the security-policy stage

These lie outside this stage's files, so they are listed here rather than made:

- `std/README.md`, "Three rules hold across the modules": "TLS 1.3 (WP34 T1)
  makes it" describes a module that does not exist yet. It should say, as
  `x25519`'s doc now does, that nothing in the tree makes the all-zero check
  yet and that every caller must (ECC-1).
- `std/README.md`, the `crypto/p256.ts` row: "Reproduces" should name all four
  Wycheproof files now run (`ecdsa_secp256r1_sha256`, `_sha256_p1363`,
  `_sha512`, `_sha512_p1363`). The row could also say that `p256Verify`
  accepts high `s`, since ECDSA is malleable.
- `std/README.md`, the `crypto/x25519.ts` row: "Reproduces" should add
  Wycheproof `x25519_test`.
