# Security audit: `nish/crypto/rsa`

RSA signature verification, PKCS #1 v1.5 and RSA-PSS, in
`std/crypto/rsa.ts`. Part of the signature-verification work of #989; this
record is the stage's own and no other stage edits it.

## Scope

| File | What it holds |
| --- | --- |
| `std/crypto/rsa.ts` | the key policy and parsers (`RsaPublicKey`, `rsaPublicKeyFromParts`, `rsaPublicKeyFromDer`), the big-number arithmetic (`rsaMontMul`, `rsaMontRR`, `rsaPublicOp`), and the four verifiers (`rsaVerifyPkcs1`, `rsaVerifyPkcs1Digest`, `rsaVerifyPss`, `rsaVerifyPssDigest`) |

The digests are `nish/crypto/sha256` and `nish/crypto/sha512`, and the final
comparisons `timingSafeEqual` and `timingSafeEqualAt` of `nish/crypto/ct`;
all three are [crypto-k1.md](crypto-k1.md)'s and are relied on, not
re-audited, here.

## Threat model

The attacker controls every byte the module reads: the key (a peer's
certificate, a JWKS document), the message and the signature. What the
attacker wants:

- **a forgery**: a signature that verifies for a message the key's owner never
  signed, chiefly through a lenient PKCS #1 v1.5 parser (Bleichenbacher's 2006
  e = 3 forgery and its descendants: garbage after the digest, in the
  DigestInfo's parameters, or in a long-form length) or a PSS check that skips
  a step of RFC 8017 §9.1.2;
- **a key accepted that the policy refuses**: a short modulus that is cheap to
  factor, e = 1 (where every s is its own signature) or an even e, or a second
  DER spelling of the same key;
- **a panic, loop or unbounded allocation** (denial of service), or a verify
  whose cost the attacker can raise past what a 4096-bit key costs.

**Out of scope, on purpose: timing.** Nothing the module handles is secret.
The modulus, exponent, message and signature are all public, so a verify whose
time follows them leaks nothing an observer did not already have. The
arithmetic is therefore *not* constant-time: `rsaPublicOp`'s
square-and-multiply branches on e's bits (`std/crypto/rsa.ts:285`),
`rsaMontMul` subtracts n or not (`:264`), and the encoding checks return at
their first mismatch. **None of it may be reused for a private exponent.**
RSA signing (#481) needs arithmetic written constant-time from the start,
with its own vectors and record; the module comment says the same
(`std/crypto/rsa.ts:42`).

**No secret material, so no wipes.** The `Secret<T>` and `wipe` rule of
`CLAUDE.md` covers private keys and secret intermediates; this module holds
neither, so nothing in it is a `Secret` and nothing is wiped. Signing would
change that.

## Method

Line numbers are those of `std/crypto/rsa.ts` at `b7b840f`, the commit that
adds it.

- **Read** every line against RFC 8017 §5.2.2 (RSAVP1), §8.1.2 and §9.1.2
  (RSASSA-PSS-VERIFY, EMSA-PSS-VERIFY), §8.2.2 and §9.2
  (RSASSA-PKCS1-v1_5-VERIFY, EMSA-PKCS1-v1_5), §A.1.1 (RSAPublicKey), §B.2.1
  (MGF1), and ITU-T X.690 §8.1.3, §8.3 and §10.1 (DER lengths and INTEGERs).
- **PKCS #1 v1.5 builds, never parses.** `rsaVerifyPkcs1Digest` (`:367`)
  builds the whole expected `00 01 FF..FF 00 || DigestInfo || H` for the
  caller's hash and compares all k octets with the recovered encoding. Nothing
  in the recovered octets is read as a structure, so no garbage after the
  digest, no parameter but NULL, no long-form length and no short padding can
  pass. The DigestInfo prefixes (`:337`) are the three of RFC 8017 §9.2 note 1,
  octet for octet.
- **PSS, step by step.** `rsaVerifyPssDigest` (`:440`) refuses a salt length
  outside 0 to emLen − hLen − 2 before any arithmetic (§9.1.2 step 3); takes
  emLen as ⌈(modBits − 1) / 8⌉ and, when that is k − 1, requires the
  recovered first octet to be zero (§8.1.2 step 2c, the case a 2049-bit or
  4097-bit modulus would hit, and that the 2048-to-4096 policy still reaches at
  every bit length ≡ 1 mod 8); checks the 0xbc trailer (step 4) and the
  8·emLen − emBits leftmost bits of maskedDB (step 6) before it unmasks;
  clears those bits in DB (step 9); requires the padding string to be zero and
  the separator 0x01 at exactly emLen − hLen − sLen − 2 (step 10), so the salt
  length is the caller's, never worked out from the signature; and compares H
  with Hash(00·8 ‖ mHash ‖ salt) (steps 12 to 14). MGF1 runs over the
  signature's own hash; a different MGF1 hash is not offered.
- **The signature as an integer.** `rsaRecover` (`:301`) refuses a signature
  not exactly k octets long (§8.1.2 step 1, §8.2.2 step 1) and one whose
  integer is n or more (§5.2.2 step 1) before the exponentiation, so no
  signature has a second spelling s + n.
- **The key policy** (`RsaPublicKey`'s constructor, `:106`, and
  `rsaModulusOk`, `:132`): n odd, minimal and of 2048 to 4096 bits; e odd with
  3 ≤ e < 2^32. The constructor applies it itself, since Nish has no private
  constructors: a key built with `new` from a refused n or e has `valid` false
  and verifies nothing. `rsaPublicKeyFromDer` (`:593`) takes strict DER only —
  minimal lengths in the short form or one or two length octets (`rsaDerLength`, `:536`), minimal positive INTEGERs, nothing
  after e or after the SEQUENCE — so one key has one DER spelling.
- **Arithmetic.** Every offset is `i32` in either number mode, because the
  module spells its widths; lengths are compared as the `number` `.length`
  gives before any `toI32` (`:133`, `:596`), and a DER longer than 1024 octets
  is refused before any offset is formed, so no sum can wrap. The Montgomery
  product (`:235`) is CIOS over `u32` limbs with `u64` products; its
  intermediate is count + 2 limbs, and the final conditional subtraction
  leaves it below n. R² mod n (`:205`) is computed by doubling, once per key.
- **Loops and allocation.** No function recurses. Every loop is bounded by the
  modulus's limb count (at most 128), e's bit length (at most 32) or the
  input's length; a verify allocates a fixed number of arrays of at most k
  octets or k / 4 + 2 limbs. The worst case an attacker can pick is a
  4096-bit key with e = 2^32 − 1: 31 squarings and 31 multiplications, about
  twice the cost of e = 65537.
- **Vectors**, in both number modes (`tests/link/crypto_rsa` and
  `tests/link/crypto_rsa_f64`, the same suite):
  - Wycheproof `testvectors_v1/` at `3fa63dd`: all 2,330 cases of the nine
    `rsa_signature_{2048,3072,4096}_sha{256,384,512}_test.json` files, and all
    1,065 cases of the seven `rsa_pss_*_mgf1_*` files and the 18 of
    `rsa_pss_misc_test.json` whose group uses SHA-256, SHA-384 or SHA-512 for
    both the message and MGF1. Its other 132 cases use SHA-1, SHA-224 or an
    MGF1 hash that differs from the message's, which the module does not
    offer; they are counted as filtered out, and none is parsed.
  - NIST CAVP's FIPS 186-3 `SigVer15_186-3.rsp` and `SigVerPSS_186-3.rsp`:
    the 108 cases of each with a 2048- or 3072-bit modulus and SHA-256,
    SHA-384 or SHA-512, each verified or refused as the file says.
  - Hand-made cases (`tests/link/crypto_rsa/crafted.ts`): one 2048-bit key
    with a PKCS #1 v1.5 and an RSA-PSS signature, and encodings broken one
    field at a time under the same key — a DigestInfo without its NULL, block
    type 02, a padding octet that is not 0xff, octets after the digest, a PSS
    trailer of 0xbb, a nonzero octet in the PSS padding string, and a zeroed
    separator — each a correct RSA signature of a wrong encoding, so only the
    encoding check can refuse it.

## Findings

None. No line was found to accept a forgery, accept a key the policy refuses,
panic, loop or allocate past the bounds above; every Wycheproof and CAVP case
in scope gets the verdict its file expects.

Two decisions a reader could take for findings, recorded so a review need not
raise them again:

- **PKCS #1 v1.5 without the NULL is refused.** RFC 8017 §9.2 note 2 lets a
  verifier accept a DigestInfo whose AlgorithmIdentifier has no parameters,
  and Wycheproof marks those cases `acceptable` (one in each
  `rsa_signature_*` file, nine in all). Accepting them would mean a second expected
  encoding, or parsing the recovered one; the module does neither, and the
  suite counts them as "acceptable refused".
- **Timing follows the public inputs.** Argued under the threat model above;
  it is a property of a verify-only module, not an open finding, and it ends
  where signing begins (#481).

## Properties verified

The module's own checks are lines of `tests/link/crypto_rsa/expected.out`,
which `link/crypto_rsa: exits with 0 and stdout matches expected.out`
compares byte for byte; the same program under `--number-mode f64` is
`link/crypto_rsa_f64: exits with 0 and stdout matches expected.out`.

| Property | Pinned by |
| --- | --- |
| Every Wycheproof PKCS #1 v1.5 case gets its expected verdict, the nine `acceptable` ones refused | "wycheproof rsa_signature_2048_sha256: every case answers what the file expects" and its eight siblings, one per file |
| Every Wycheproof RSA-PSS case in scope gets its expected verdict | "wycheproof rsa_pss_2048_sha256_mgf1_0: every case answers what the file expects" and its six siblings; "wycheproof rsa_pss_misc: every case it can run answers what the file expects" |
| Every CAVP case kept gets its expected verdict | "cavp SigVer15: every case answers what the file expects", "cavp SigVerPSS: every case answers what the file expects" |
| The key policy: 2048 to 4096 bits, n odd and minimal, e odd with 3 ≤ e < 2^32 | "a 2047-bit modulus is refused", "a 2040-bit modulus is refused", "a 4096-bit modulus is taken", "a 4097-bit modulus is refused", "an even modulus is refused", "a modulus with a leading zero octet is refused", "an empty modulus is refused", "an empty exponent is refused", "an exponent with a leading zero octet is refused", "e = 1 is refused", "e = 2 is refused", "e = 65536 is refused", "e = 3 is taken", "e = 2^32 - 1 is taken", "e = 2^32 is refused", "e = 2^32 + 1 is refused" |
| A key built with `new` past the policy verifies nothing | "new RsaPublicKey of a 2047-bit modulus is not valid", "and verifies nothing (PKCS #1 v1.5)", "and verifies nothing (PSS)", "new RsaPublicKey with e = 65536 is not valid", "and verifies nothing", "new RsaPublicKey with e = 1 is not valid" |
| One key, one DER spelling | "a DER with an octet after the SEQUENCE is refused", "a DER one octet short is refused", "a third INTEGER inside the SEQUENCE is refused", "a SEQUENCE of n alone is refused", "a SET in place of the SEQUENCE is refused", "a BIT STRING in place of e's INTEGER is refused", "e as a non-minimal INTEGER is refused", "n as a non-minimal INTEGER is refused", "n as a negative INTEGER is refused", "e as a negative INTEGER is refused", "e as an empty INTEGER is refused", "e = 0 is refused", "a length in the long form when the short one fits is refused", "a length in more octets than it needs is refused", "an indefinite length is refused", "an empty DER is refused", "a DER longer than 1024 octets is refused", "the DER of a 2047-bit modulus is refused", "the DER of a 4096-bit modulus is taken" |
| A signature has one spelling: exactly k octets, below n | "not one octet short", "not one octet long, with a leading zero", "s = n is refused", "s = 2^2048 - 1 is refused", "s = 0 is refused", "s = 1 is refused" |
| PKCS #1 v1.5 compares the whole encoding | "a DigestInfo without its NULL is refused", "block type 02 is refused", "a padding octet other than 0xff is refused", "octets after the digest are refused", "not under SHA-384", "not under SHA-512" |
| PSS takes only the salt length the caller names, and checks every field | "not with a 31-byte salt", "not with a 33-byte salt", "not with no salt", "not with a salt length of -1", "not with a salt longer than the encoding holds", "a trailer of 0xbb is refused", "a nonzero octet in the padding string is refused", "a zeroed 0x01 separator is refused" |
| An unknown hash id or a digest of the wrong length answers `false`, never a panic | "not under an unknown hash id 0", "not under an unknown hash id 4", "not by digest under an unknown hash id", "not by a 31-byte digest", "not by a 32-byte digest named SHA-384", "not by a 33-byte digest" |
| The two schemes do not stand in for each other | "not as an RSA-PSS signature", "not as a PKCS #1 v1.5 signature" |
