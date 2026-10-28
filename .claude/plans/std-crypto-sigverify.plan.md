---
name: Signature verification for web-PKI certificates in std/crypto
overview: Add verify-only RSA PKCS#1 v1.5, RSA-PSS and ECDSA P-384/SHA-384 to std/crypto, then wire them into std/crypto/x509.ts so x509VerifySignature checks RSA and P-384 issuers and a TLS 1.3 client can verify CertificateVerify. Every scheme runs Wycheproof, NIST CAVP and a live OpenSSL differential, and ships its security record and guide text.
stages:
  - id: rsa
    title: "feat(std): nish/crypto/rsa — RSA PKCS#1 v1.5 and RSA-PSS signature verification"
    goal: A verify-only RSA module for 2048-4096-bit moduli with SHA-256/384/512 that gives every Wycheproof and CAVP case its expected verdict in both number profiles
    verification: npm run check && npm run lint && node tests/run.js crypto_rsa && node tests/run.js security-scope && node tests/run.js third-party-licence && node tests/run.js release && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: rsa-bignum
        content: Write the public-input big-number layer in std/crypto/rsa.ts — u32 limbs, Montgomery multiplication, public-exponent modexp — see RSA → Arithmetic
        status: pending
      - id: rsa-key
        content: Add RsaPublicKey, rsaPublicKeyFromDer and rsaPublicKeyFromParts with the key policy — see RSA → Keys
        status: pending
      - id: rsa-pkcs1
        content: Add rsaVerifyPkcs1 and rsaVerifyPkcs1Digest by encode-and-compare against EMSA-PKCS1-v1_5 — see RSA → PKCS1 v1.5
        status: pending
      - id: rsa-pss
        content: Add rsaVerifyPss and rsaVerifyPssDigest with MGF1 — see RSA → PSS
        status: pending
      - id: rsa-vectors
        content: Convert the Wycheproof and CAVP RSA files to Nish source under tests/link/crypto_wycheproof_rsa/ and tests/link/crypto_cavp_rsa/ — see RSA → Tests
        status: pending
      - id: rsa-link
        content: Add tests/link/crypto_rsa (suite plus refusals) and its f64 twin crypto_rsa_f64 — see RSA → Tests
        status: pending
      - id: rsa-register
        content: Register nish/crypto/rsa in the module list, release gates and notices — see Shared files
        status: pending
      - id: rsa-record
        content: Write docs/security/crypto-rsa.md with the variable-time rationale and its index row — see RSA → Security record
        status: pending
      - id: rsa-docs
        content: Add the rsa row and a short section to the guide, std/README.md, LANGUAGE.md library list and llms.txt — see RSA → Docs
        status: pending
      - id: rsa-measured
        content: Measure verify/s for RSA-2048 and RSA-4096 against Node crypto.verify and add bench/crypto/rsa — see RSA → Measured
        status: pending
  - id: p384
    title: "feat(std): nish/crypto/p384 — ECDSA P-384 signature verification"
    goal: A verify-only P-384 ECDSA module that gives every Wycheproof P1363 and CAVP SigVer P-384/SHA-384 case its expected verdict in both number profiles
    verification: npm run check && npm run lint && node tests/run.js crypto_p384 && node tests/run.js security-scope && node tests/run.js third-party-licence && node tests/run.js release && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: p384-field
        content: Port fiat-crypto p384 32-bit field arithmetic (and p384 scalar if upstream ships it) into std/crypto/p384.ts — see P-384 → Arithmetic
        status: pending
      - id: p384-point
        content: Add point decoding with on-curve and range checks, complete projective addition and a double-scalar multiply — see P-384 → Points
        status: pending
      - id: p384-verify
        content: Add p384Verify and p384VerifySha384 over r||s — see P-384 → Verify
        status: pending
      - id: p384-vectors
        content: Convert ecdsa_secp384r1_sha384_p1363_test.json and the CAVP P-384/SHA-384 SigVer cases to Nish source — see P-384 → Tests
        status: pending
      - id: p384-link
        content: Add tests/link/crypto_p384 and crypto_p384_f64 — see P-384 → Tests
        status: pending
      - id: p384-register
        content: Register nish/crypto/p384 in the module list, release gates and notices — see Shared files
        status: pending
      - id: p384-record
        content: Extend docs/security/crypto-ecc.md with a P-384 scope row, findings and the variable-time rationale — see P-384 → Security record
        status: pending
      - id: p384-docs
        content: Add the p384 row to the guide, std/README.md, LANGUAGE.md library list and llms.txt — see P-384 → Docs
        status: pending
      - id: p384-measured
        content: Measure verify/s against Node crypto.verify and add bench/crypto/p384 — see P-384 → Measured
        status: pending
  - id: x509-wire
    title: "feat(std): x509VerifySignature checks RSA, RSA-PSS and P-384 issuers"
    goal: x509 parses rsaEncryption, id-RSASSA-PSS and secp384r1 keys and the matching signature AlgorithmIdentifiers, verifies certificates from RSA and P-384 issuers, and verifies TLS 1.3 CertificateVerify signatures, checked against Wycheproof, real CA chains, RFC 8448 and live OpenSSL
    verification: npm run check && npm run lint && node tests/run.js crypto_x509 && node tests/run.js sigverify && node tests/run.js crypto_p384 && node tests/run.js crypto_rsa && node tests/run.js security-scope && node tests/run.js third-party-licence && node tests/run.js net_tls_rfc8448
    todos:
      - id: x509-parse
        content: Record the key kind and signature algorithm in X509Certificate and parse the new SPKI and AlgorithmIdentifier forms — see x509 → Parsing
        status: pending
      - id: x509-der-rs
        content: Generalise x509DerSignatureRS to a scalar width so P-384 DER signatures decode with the same strictness — see x509 → DER signatures
        status: pending
      - id: x509-verify
        content: Extend x509VerifySignature to dispatch on key kind and signature algorithm with the pairing rules — see x509 → Verify
        status: pending
      - id: x509-tls
        content: Add x509VerifyTlsSignature for the RFC 8446 CertificateVerify schemes — see x509 → TLS schemes
        status: pending
      - id: x509-vectors
        content: Run the Wycheproof PSS params files and ecdsa_secp384r1_sha384_test.json (DER) through x509 — see x509 → Tests
        status: pending
      - id: x509-fixtures
        content: Add OpenSSL-made chains, real web-PKI chains and malformed-AlgorithmIdentifier fixtures in tests/link/crypto_x509_sigverify and its f64 twin — see x509 → Tests
        status: pending
      - id: x509-rfc8448
        content: Verify RFC 8448's server certificate and its rsa_pss_rsae_sha256 CertificateVerify through x509 — see x509 → Tests
        status: pending
      - id: x509-differential
        content: Add tests/differential/sigverify.js, a live OpenSSL differential wired into tests/run.js — see x509 → Live differential
        status: pending
      - id: x509-record
        content: Update docs/security/crypto-x509.md and cross-reference crypto-rsa.md and crypto-ecc.md — see x509 → Security record
        status: pending
      - id: x509-docs
        content: Rewrite the x509 rows and section in the guide and std/README.md for RSA and P-384 issuers — see x509 → Docs
        status: pending
---

# Signature verification for web-PKI certificates in std/crypto

## Context

[`std/crypto/x509.ts`](../../std/crypto/x509.ts) `x509VerifySignature(cert, issuer): boolean` (:1177) verifies only `ecdsa-with-SHA256` from a P-256 issuer. The parser records two booleans (`p256`, `ecdsaSha256`) and keeps no OIDs. There is no bignum anywhere in the repo and no `u128`/`mulHigh` (WP41 dropped it). [`p256.ts`](../../std/crypto/p256.ts) is a P-256-specific fiat-crypto port with 32-bit limbs and `u64` products. `sha512.ts` already exports `sha384`. Nothing in `std/net` verifies a peer certificate today: the TLS stack is server-only.

[#481](https://github.com/amritk/nish/issues/481) plans server-side RSA-PSS *signing* with constant-time bignums. This plan does not do signing and its bignum is variable-time by design, so it is not a base for #481's signer. What #481 can reuse is the RSA key parsing in x509 and the EMSA-PSS encoding (the encode half of verification is the same function a signer calls). The `rsa` record says this in a section of its own.

## Approach

- **Verification only.** No private-key type, no signing, no key generation is exported. Every input (key, message, signature) is public.
- **Variable-time is deliberate and recorded.** Montgomery multiplication with data-dependent loop bounds and early exits is fine when no input is secret. The records say why and where it stops being true: the code must never be reused for a private-key operation (#481 needs its own constant-time layer). The final comparison is still `timingSafeEqual`, which costs nothing.
- **Bounded work.** Modulus 2048-4096 bits and a public exponent below 2^32 cap the cost of one verification. That matters because a TLS client verifies attacker-chosen signatures.
- **Strictness comes from the specs.** PKCS#1 v1.5 is verified by encode-and-compare (RFC 8017 §8.2.2 and §9.2), which rejects every non-canonical DigestInfo by construction. PSS follows EMSA-PSS-VERIFY step by step (§9.1.2). DER is strict (definite minimal lengths, minimal positive INTEGERs). The signature length must be exactly k octets and the representative must be below n (§8.2.2 step 1, §5.2.2).
- **Three suites per scheme.** Wycheproof (pinned to commit `3fa63dd0344abb611f1fb1d77e119938603ea230`, the commit the existing files already use; take a later commit only for a file absent there, and say so in the header), NIST CAVP SigVer (FIPS 186-3), and a live OpenSSL differential. Every case of every file kept is run; a file's unsupported groups (other hashes, MGF1 hash ≠ signature hash) are skipped by group and counted in the output.
- **Wycheproof "acceptable" means reject.** Each "acceptable" case is listed by tcId in the record with the reason.
- **Both number profiles.** Every new `tests/link` case gets an `_f64` twin, as the existing crypto cases have.

## Shared files

The two module stages run at the same time and each must register its own module. Precedent: [#323](https://github.com/amritk/nish/issues/323) used the same exception. Each module stage edits **only its own module's entry or row** in these files, nothing else:

| File | What a module stage adds |
| --- | --- |
| [`src/std-modules.ts`](../../src/std-modules.ts) `stdModuleNames` | its own name (`crypto/rsa` or `crypto/p384`); then regenerate `tests/self/goldens/checked/` |
| [`.github/workflows/release.yml`](../../.github/workflows/release.yml) | its `std/crypto/<m>.ts` (and any new `LICENSE-*`) on all three presence gates |
| [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) | its vector files' rows (and the fiat p384 row) |
| [`docs/security/README.md`](../../docs/security/README.md) | its index row and the Total row |
| [`docs/guide/using-nish/standard-library.md`](../../docs/guide/using-nish/standard-library.md), [`std/README.md`](../../std/README.md), [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) library list, `llms.txt` | its module row |

Merge order `rsa` → `p384` → `x509-wire`. `p384` merges second and takes `main` with `npm run sync-main` to settle the one-line overlaps. `x509-wire` starts once both have merged, because it consumes both APIs.

## RSA

**Owns:** `std/crypto/rsa.ts`, `tests/link/crypto_rsa*/**`, `tests/link/crypto_wycheproof_rsa/**`, `tests/link/crypto_cavp_rsa/**`, `bench/crypto/rsa/**`, `docs/security/crypto-rsa.md`, plus the Shared files rows above.

### Arithmetic

Private to the module. The modulus is stored as `u32` limbs, little-endian, at most 128 limbs. Montgomery multiplication (CIOS, HAC 14.36) uses `u64` products, the shape `p256FiatMulxU32` already uses. `R² mod n` is computed once per key. The public exponent is applied by left-to-right square-and-multiply. A comment at the top of the layer says it is variable-time and public-input-only, and names #481.

### Keys

```ts
export class RsaPublicKey { /* fields module-private by convention: n limbs, bits, e */ }
export const rsaPublicKeyFromDer = (der: u8[]): RsaPublicKey | null   // PKCS#1 RSAPublicKey ::= SEQUENCE { n INTEGER, e INTEGER }, strict DER, no trailing bytes
export const rsaPublicKeyFromParts = (n: u8[], e: u8[]): RsaPublicKey | null   // big-endian, minimal (no leading zero octet)
```

The key policy, enforced by both constructors:

- n is odd, with exactly 2048-4096 significant bits.
- e is odd, with 3 ≤ e < 2^32.
- DER INTEGERs are minimal and positive.

Anything else is `null`. Write the policy in the doc comment and the record.

### PKCS1 v1.5

```ts
export const RSA_SHA256: i32 = 1, RSA_SHA384: i32 = 2, RSA_SHA512: i32 = 3
export const rsaVerifyPkcs1 = (key: RsaPublicKey, hash: i32, msg: u8[], sig: u8[]): boolean
export const rsaVerifyPkcs1Digest = (key: RsaPublicKey, hash: i32, digest: u8[], sig: u8[]): boolean
```

Steps:

1. Check that `sig.length === k` and that s < n.
2. Compute m = s^e mod n.
3. Encode EM' = `00 01 FF…FF 00 || DigestInfo(NULL params) || H`, as RFC 8017 §9.2 note 1 prints it.
4. Compare EM' with m in constant time.

The function never parses the DigestInfo.

### PSS

```ts
export const rsaVerifyPss = (key: RsaPublicKey, hash: i32, saltLen: i32, msg: u8[], sig: u8[]): boolean
export const rsaVerifyPssDigest = (key: RsaPublicKey, hash: i32, saltLen: i32, digest: u8[], sig: u8[]): boolean
```

EMSA-PSS-VERIFY (RFC 8017 §9.1.2):

- MGF1 uses the same hash as the signature.
- emBits = modBits − 1, and the leftmost bits are masked.
- The trailer must be 0xbc.
- The PS octets must be zero and followed by 0x01.
- The salt length is exact, and `saltLen` ranges over 0..emLen − hLen − 2. TLS and the CA/B BRs pass the hash length; Wycheproof's mgf1_0 and misc files exercise other values.

Export the MGF1 and EMSA-PSS-ENCODE helpers only if #481 can use them as they stand; otherwise keep them private.

### Tests

**Wycheproof files** (`testvectors_v1/`), rewritten as Nish source in `tests/link/crypto_wycheproof_rsa/`, with its own `LICENSE-wycheproof` and the header shape of `crypto_wycheproof/ecdsa_secp256r1_sha256.ts`:

- `rsa_signature_{2048,3072,4096}_{sha256,sha384,sha512}_test.json`
- `rsa_pss_2048_sha256_mgf1_0_test.json`, `rsa_pss_2048_sha256_mgf1_32_test.json`, `rsa_pss_2048_sha384_mgf1_48_test.json`, `rsa_pss_3072_sha256_mgf1_32_test.json`, `rsa_pss_4096_sha256_mgf1_32_test.json`, `rsa_pss_4096_sha384_mgf1_48_test.json`, `rsa_pss_4096_sha512_mgf1_32_test.json`, `rsa_pss_4096_sha512_mgf1_64_test.json`
- `rsa_pss_misc_test.json`: its groups with SHA-256/384/512 and a same-hash MGF1.

The `_params` files belong to `x509-wire`.

**NIST CAVP** (FIPS 186-3 SigVer): take `SigVer15_186-3.rsp` and `SigVerPSS_186-3.rsp` from the `186-3rsatestvectors.zip` on csrc.nist.gov. Use the moduli of 2048 and 3072 bits with SHA-256/384/512. Rewrite them into `tests/link/crypto_cavp_rsa/`. They are a US Government work, so record them under "Public-domain" in THIRD_PARTY_NOTICES.md per [`.claude/licensing.md`](../licensing.md) → "Public domain". If csrc.nist.gov is unreachable from the session, say so in the PR body; do not substitute other data silently.

**`tests/link/crypto_rsa`** (+ `crypto_rsa_f64`) prints one PASS line per file with its valid/invalid/skipped counts, plus refusals:

- a 2047-bit and a 4097-bit modulus;
- an even n, an even e, e = 1, and e ≥ 2^32;
- a non-minimal INTEGER, a negative INTEGER, and trailing bytes;
- a signature one octet short or long, and s = n;
- a bad trailer, a nonzero PS, and a wrong salt length.

The negative tests are mandatory.

### Security record

Create `docs/security/crypto-rsa.md` in the README's record format. Its sections:

- **Scope:** `std/crypto/rsa.ts`.
- **Threat model:** a TLS client verifying attacker-chosen keys and signatures.
- **"Why this is not constant-time":** every input is public; what a timing observer learns (nothing beyond the public inputs); the bounded cost; and why it must not back a signer (#481).
- **Findings:** each with a before/after test.
- **Properties verified:** name each `check(...)`.
- **Wycheproof "acceptable" cases:** the list.

Add its index row.

### Docs

Add the `nish/crypto/rsa` row and a short "Verifying RSA signatures" example to the crypto section of `standard-library.md` (:1574). The example must compile; follow [`docs/README.md`](../../docs/README.md#writing-a-guide-page). Then add the std/README.md row, the LANGUAGE.md library-list entry and the `llms.txt` line.

### Measured

Measure verify/s for 2048-bit PKCS#1 v1.5 and 4096-bit PSS with SHA-256, next to Node's `crypto.verify` on the same box. Take the noise band per [`.claude/testing.md`](../testing.md). Put the figures in the PR body as a `Measured:` trailer. `bench/crypto/rsa/` follows `bench/crypto/x509/`.

## P-384

**Owns:** `std/crypto/p384.ts`, `tests/link/crypto_p384*/**`, `tests/link/crypto_wycheproof/ecdsa_secp384r1_sha384_p1363.ts`, `tests/link/crypto_cavp_p384/**`, `bench/crypto/p384/**`, `docs/security/crypto-ecc.md`, plus the Shared files rows above.

### Arithmetic

Port fiat-crypto's `p384` 32-bit Montgomery field (12 `u32` limbs, `u64` products) the way `p256.ts` ported `p256`. Use the same MIT licence, the same notice and `std/crypto/LICENSE-fiat-crypto`, and name the upstream commit. For the scalar field mod n, use fiat-crypto's `p384_scalar` if upstream ships it. Otherwise write Montgomery multiplication mod n from HAC 14.36 and say so. Inversions are Fermat. Variable time is allowed (public inputs), and the record says where.

### Points

Write `p384DecodePoint(pub: u8[])`:

- The input is uncompressed only: `04 || X || Y`, 97 octets.
- X and Y must be < p, and the point must be on the curve.
- The point at infinity is refused.

Points are projective, with the complete Renes-Costello-Batina formulas for a = −3 (the formulas `p256PointAdd`/`p256PointDouble` use). Compute u1·G + u2·Q by interleaved windowed multiplication (Shamir's trick). No fixed-base table is needed for verify-only.

### Verify

```ts
export const p384Verify = (pub: u8[], digest: u8[], sig: u8[]): boolean       // sig is r || s, 96 octets
export const p384VerifySha384 = (pub: u8[], msg: u8[], sig: u8[]): boolean
```

Follow SEC 1 §4.1.4:

1. r and s must be in [1, n).
2. The digest is truncated to the leftmost 384 bits and taken mod n.
3. Compute w = s⁻¹ and R = u1·G + u2·Q. R must not be infinity.
4. Accept iff x(R) mod n = r.

High s is accepted, as SEC 1 does and as `p256Verify` does.

### Tests

- **Wycheproof:** `ecdsa_secp384r1_sha384_p1363_test.json`, rewritten into `tests/link/crypto_wycheproof/ecdsa_secp384r1_sha384_p1363.ts` with the existing directory's licence. The DER file is `x509-wire`'s, because DER decoding lives in x509.
- **CAVP:** FIPS 186-3 ECDSA `SigVer.rsp` (from `186-3ecdsatestvectors.zip`), its `[P-384,SHA-384]` section, rewritten into `tests/link/crypto_cavp_p384/`.
- **`crypto_p384` and `crypto_p384_f64`:**
  - Every case gets its verdict.
  - Refusals: a point off the curve, a coordinate ≥ p, infinity, a compressed point, r = 0, s = n, and a 95- or 97-octet signature.
  - A self-check that u1·G + u2·Q matches separate scalar multiplications and an addition.

### Security record

Add a `std/crypto/p384.ts` row to `crypto-ecc.md`'s Scope table. Add findings as ECC-6 onwards, a "P-384 is verify-only and variable-time" paragraph with the same reasoning as the RSA record, and update the index row counts.

### Docs

Add the `nish/crypto/p384` row to the guide's crypto table, std/README.md, the LANGUAGE.md library list and `llms.txt`.

### Measured

Measure verify/s next to Node's `crypto.verify` (P-384, SHA-384) and put it in a `Measured:` trailer. `bench/crypto/p384/` follows `bench/crypto/x509/`.

## x509

**Owns:** `std/crypto/x509.ts`, `tests/link/crypto_x509*/**`, `tests/link/crypto_wycheproof/ecdsa_secp384r1_sha384.ts`, `tests/link/crypto_wycheproof_rsa/rsa_pss_*_params*.ts`, `tests/differential/sigverify.js`, `tests/run.js` (the differential's wiring only), `tests/link/net_tls_rfc8448*/**`, `docs/security/crypto-x509.md`, the cross-reference lines in `docs/security/crypto-rsa.md` and `crypto-ecc.md`, the x509 rows and section of the guide and `std/README.md`, and `THIRD_PARTY_NOTICES.md` rows for its vector files. It depends on `rsa` and `p384` being merged.

### Parsing

`X509Certificate` keeps `p256` and `ecdsaSha256` with their current meaning (existing callers and tests read them). It gains a key-kind field and a signature-algorithm field (named `i32` constants), plus the parsed RSA key or P-384 point.

Key forms:

- `rsaEncryption`: parameters must be NULL (RFC 3279 §2.3.1).
- `id-RSASSA-PSS`: parameters absent, or RSASSA-PSS-params that pin the hash, MGF1 and salt (RFC 4055 §3.1). A certificate signed by a key with pinned parameters must use exactly those parameters.
- `id-ecPublicKey` with `secp384r1`.

Signature AlgorithmIdentifiers:

- `sha{256,384,512}WithRSAEncryption`: parameters NULL or absent (RFC 4055 §5 requires accepting both).
- `RSASSA-PSS`: the three byte-exact encodings the CA/B Forum Baseline Requirements §7.1.3.2.1 lists (SHA-256/32, SHA-384/48, SHA-512/64, MGF1 with the same hash, no trailerField). Compare bytes; any other encoding is refused.
- `ecdsa-with-SHA384`: parameters absent (RFC 5758 §3.2).

Unknown algorithms still parse, but verify answers `false`, as today.

### DER signatures

Add a width parameter to `x509DerSignatureRS`: 32 octets for P-256 and 48 for P-384. Keep the existing function as the 32-octet form, so callers do not change. The minimal, positive and no-trailing-bytes rules stay exactly as they are.

### Verify

`x509VerifySignature(cert, issuer)` dispatches on the issuer's key kind and the certificate's signature algorithm. The allowed pairs:

| Issuer key | Allowed signature algorithms |
| --- | --- |
| P-256 | `ecdsa-with-SHA256` |
| P-384 | `ecdsa-with-SHA384` (Mozilla Root Store Policy §5.1 pairs these) |
| `rsaEncryption` | PKCS#1 v1.5 with SHA-256/384/512, or any of the three BR PSS encodings |
| `id-RSASSA-PSS` | PSS only, matching the key's pinned parameters when present |

Every other pair answers `false`. The return type stays `boolean`.

### TLS schemes

```ts
export const x509VerifyTlsSignature = (cert: X509Certificate, scheme: i32, content: u8[], sig: u8[]): boolean
```

`content` is the bytes RFC 8446 §4.4.3 signs; the caller builds the 64×0x20 prefix, the context string and the transcript hash. Accepted schemes:

| Scheme | Key | Signature |
| --- | --- | --- |
| `0x0403` | P-256 | DER |
| `0x0503` | P-384 | DER |
| `0x0804`-`0x0806` (`rsa_pss_rsae_*`) | `rsaEncryption` | PSS, salt = hash length |
| `0x0809`-`0x080b` (`rsa_pss_pss_*`) | `id-RSASSA-PSS` | PSS, salt = hash length, within the key's pinned parameters |

`rsa_pkcs1_*` (`0x0401`/`0x0501`/`0x0601`) and every other value are refused, as RFC 8446 §4.4.3 forbids PKCS#1 v1.5 in CertificateVerify.

Reuse the existing scheme constants in `std/net/tls/codec.ts` only if importing them adds no cycle. Otherwise define them in x509 with a comment naming codec.ts.

### Tests

**`tests/link/crypto_x509_sigverify`** (+ `_f64`) covers:

- **Wycheproof.** `ecdsa_secp384r1_sha384_test.json` (DER) decoded through the generalised `x509DerSignatureRS`, so the non-canonical DER cases land in x509's decoder. The `rsa_pss_{2048_sha256_mgf1_32,3072_sha256_mgf1_32,4096_sha512_mgf1_32,4096_sha512_mgf1_64}_params_test.json` files, and `rsa_pss_misc_params_test.json`'s supported groups, through the `id-RSASSA-PSS` SPKI parser.
- **OpenSSL fixtures.** Chains generated once with `openssl` 3.x and checked in with the exact commands in the file header, each confirmed by `openssl verify -x509_strict`:
  - RSA-2048/3072/4096 issuers with PKCS#1 v1.5 SHA-256/384/512;
  - PSS from an `rsaEncryption` key and from an `id-RSASSA-PSS` key;
  - a P-384 issuer with ecdsa-with-SHA384.

  Each has a tampered-TBS and a flipped-signature-bit twin.
- **Real web-PKI chains**, public certificates fetched once, with the URL and SHA-256 fingerprint in the header:
  - ISRG Root X1 (RSA-4096, self-signed) and a current Let's Encrypt RSA intermediate it signed;
  - ISRG Root X2 (P-384, self-signed) and a current Let's Encrypt ECDSA intermediate it signed.

  `x509VerifySignature` answers `true` for each issued-by pair and `false` for each crossed pair.
- **Malformed AlgorithmIdentifiers:**
  - PSS with an explicit trailerField, salt ≠ hash length, MGF1 with a different hash, or a hash without NULL;
  - `ecdsa-with-SHA384` with NULL parameters;
  - `rsaEncryption` without NULL;
  - each disallowed key/signature pair.

  Each is refused.

**`net_tls_rfc8448`**: add checks that RFC 8448 §3's server certificate verifies against itself (it is self-signed, sha256WithRSAEncryption), and that the trace's CertificateVerify signature verifies through `x509VerifyTlsSignature(cert, 0x0804, content, sig)` over the content rebuilt from the trace's transcript hash. Do not change what the case already checks.

### Live differential

`tests/differential/sigverify.js` is modelled on `tests/differential/bcrypt.js` and invoked from `tests/run.js` the same way (`check("sigverify: …")`). On each run it:

1. Generates fresh keys with `openssl` for RSA-2048/3072/4096 and P-384.
2. Signs random messages: PKCS#1 v1.5 with SHA-256/384/512, PSS with salt = hash length, and ECDSA P-384/SHA-384.
3. Mutates a fraction of the signatures and messages.
4. Asks a Nish program and `openssl pkeyutl -verify` for a verdict on each, and fails on any disagreement.

Without `openssl` it skips, with a reason the summary counts. Keep the run under a few seconds.

### Security record

Update `crypto-x509.md`:

- Extend the scope rows to the new functions.
- Add findings as X509-10 onwards.
- Add Properties verified for the pairing table and the byte-exact PSS AlgorithmIdentifier rule.
- Record that the module still does no path validation, name constraints or hostname checks.

Add a one-line cross-reference in `crypto-rsa.md` and `crypto-ecc.md`, and update the index counts.

### Docs

The guide's crypto table row for `nish/crypto/x509` and the x509 section say which issuers verify, show `x509VerifySignature` with an RSA chain and `x509VerifyTlsSignature` in a short example, and repeat that chain building and hostname checks are the caller's. Update std/README.md's x509 row to match.

## Out of scope

- Signing, key generation and private-key parsing for RSA or P-384. These are #481's.
- Chain building, path validation, name constraints, revocation and hostname matching.
- A TLS client handshake.
- SHA-1, SHA-224, SHA-3 and SHAKE. Mismatched MGF1 hashes.
- Moduli outside 2048-4096 bits. P-521. Pairing P-384 keys with SHA-256 or P-256 keys with SHA-384.

## Verification

Each stage's `verification` line, plus `node tests/self/goldens.js --update` after any `src/` change (the module list) and a read of the goldens diff. CI's four `test` shards on the PR head are the full-suite gate (CLAUDE.md → Definition of done).
