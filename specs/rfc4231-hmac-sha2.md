---
title: "HMAC-SHA-256, HMAC-SHA-384 and HMAC-SHA-512"
abbrev: nish/crypto/hmac
docname: draft-rfc4231-hmac-sha2-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-16
keyword:
  - vector-main-RFC4231
author:
  - name: Nish Authors
    org: nish
normative:
  HMAC:
    title: "HMAC: Keyed-Hashing for Message Authentication"
    author:
      - ins: H. Krawczyk
        name: H. Krawczyk
      - ins: M. Bellare
        name: M. Bellare
      - ins: R. Canetti
        name: R. Canetti
    date: 1997-02
    target: https://www.rfc-editor.org/info/rfc2104
    seriesinfo:
      RFC: 2104
      DOI: 10.17487/RFC2104
  RFC4231:
--- abstract

A profile of RFC 4231 for nish/crypto/hmac (std/crypto/hmac.ts): HMAC
({{HMAC}}) instantiated with SHA-256, SHA-384 and SHA-512. Every requirement
quotes RFC 4231, the main source, and every RFC 4231 test vector for those
three hash functions is held here.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

nish/crypto/hmac exports one-shot HMAC-SHA-256, HMAC-SHA-384 and
HMAC-SHA-512 over a key and a message, each as `u8[]`. The construction is
{{HMAC}}'s; the properties compare it with nish/crypto/sha256 and
nish/crypto/sha512, the hash functions it is built on. RFC 4231 also
defines HMAC-SHA-224, which nish/crypto/hmac does not export.

RFC 4231 has no binding sentence in the sense of BCP 14, so there is nothing
to exclude. The wiping of secret intermediates lies outside what a
functional test can observe and is held by nish's own tests instead. The
key blocks, hashed key, inner digest and hashers are wiped before return,
held under -O2 by tests/wipes/crypto.js ("crypto_hmac crypto_hkdf: the wipes
survive -O2"); the caller's own key array is recorded in
docs/security/crypto-k1.md (K1-7) and docs/security/secret.md.

The module's other exports are out of scope here, each for the reason
given.

Out of scope: hmacSha256Verify, an API RFC 4231 does not specify, since it defines the tag and not how one is checked; held by tests/link/crypto_hmac and tests/link/crypto_hmac_k1_verify, and the compare is timingSafeEqual, whose loop tests/cases/ct_asm_k1_ct.ts holds to no branch on the data after clang -O2 (docs/security/ct-verification.md, and docs/security/crypto-k1.md K1-8)

Out of scope: hmacSha384Verify, an API RFC 4231 does not specify, since it defines the tag and not how one is checked; held by tests/link/crypto_hmac and tests/link/crypto_hmac_k1_verify, and the compare is timingSafeEqual, whose loop tests/cases/ct_asm_k1_ct.ts holds to no branch on the data after clang -O2 (docs/security/ct-verification.md, and docs/security/crypto-k1.md K1-8)

Out of scope: hmacSha512Verify, an API RFC 4231 does not specify, since it defines the tag and not how one is checked; held by tests/link/crypto_hmac and tests/link/crypto_hmac_k1_verify, and the compare is timingSafeEqual, whose loop tests/cases/ct_asm_k1_ct.ts holds to no branch on the data after clang -O2 (docs/security/ct-verification.md, and docs/security/crypto-k1.md K1-8)

Out of scope: hmacKeyedVerify, the same check as hmacSha256Verify over an absorbed HmacKey and a window of a buffer, held by tests/link/crypto_jwt ("HmacKey: hmacKeyedVerify accepts the tag it made"); its message is a (data, off, len) `/* window */`, but its first parameter is the class HmacKey, which vector 0.6.0 refuses in a ts-interface block ("`HmacKey` is not a ts-interface type; use u8[], string, boolean, i8, i16, i32, i64, u8, u16, u32, u64, f64, Secret<u8[]>, u16[], u32[], u64[], each optionally `| null`"), and its tag is a (tag, tagAt) pair read in place, which neither a window nor an `/* out CAP */` write declares

Out of scope: pbkdf2HmacSha256, PBKDF2 (RFC 8018), which uses HMAC-SHA-256 as its PRF but is a different function, with its own vectors and none in RFC 4231

Out of scope: HmacSha256, a stateful, reusable form of the same functions; a property here calls only functions, so it is left to nish's own tests (tests/link/crypto_hmac*)

Out of scope: HmacSha384, a stateful, reusable form of the same functions; a property here calls only functions, so it is left to nish's own tests (tests/link/crypto_hmac*)

Out of scope: HmacSha512, a stateful, reusable form of the same functions; a property here calls only functions, so it is left to nish's own tests (tests/link/crypto_hmac*)

Out of scope: HmacSha256Scratch, a stateful, reusable form of the same functions; a property here calls only functions, so it is left to nish's own tests (tests/link/crypto_hmac*)

Out of scope: HmacSha384Scratch, a stateful, reusable form of the same functions; a property here calls only functions, so it is left to nish's own tests (tests/link/crypto_hmac*)

Out of scope: HmacKey, a stateful, reusable form of the same functions; a property here calls only functions, so it is left to nish's own tests (tests/link/crypto_hmac*)

Out of scope: hmacKeyedInto, writes the tag of an absorbed HmacKey into a caller's array at an offset, a buffer interface RFC 4231 does not describe, held by tests/link/crypto_jwt; its message is a `/* window */` and its (out, at) an `/* out CAP */` write, but its first parameter is the class HmacKey, which vector 0.6.0 refuses in a ts-interface block (as for hmacKeyedVerify), and it returns void where an `/* out CAP */` write returns the end offset

Out of scope: hmacCopySha256, copies a hasher's state into another, a helper for the stateful classes that computes no HMAC

Out of scope: hmacCopySha384, copies a hasher's state into another, a helper for the stateful classes that computes no HMAC

Out of scope: HMAC_SHA256, a constant that names a hash for HmacKey, not a function

Out of scope: HMAC_SHA384, a constant that names a hash for HmacKey, not a function

Out of scope: HMAC_SHA512, a constant that names a hash for HmacKey, not a function

# Interface

~~~ ts-interface
// module: nish/crypto/hmac
export const hmacSha256 = (key: u8[], data: u8[]): u8[]
export const hmacSha384 = (key: u8[], data: u8[]): u8[]
export const hmacSha512 = (key: u8[], data: u8[]): u8[]
export const hmacSha256Secret = (key: Secret<u8[]>, data: u8[]): u8[]
export const hmacSha384Secret = (key: Secret<u8[]>, data: u8[]): u8[]
export const hmacSha512Secret = (key: Secret<u8[]>, data: u8[]): u8[]
// module: nish/crypto/sha256
export const sha256 = (data: u8[]): u8[]
// module: nish/crypto/sha512
export const sha384 = (data: u8[]): u8[]
export const sha512 = (data: u8[]): u8[]
~~~

# The Functions

> HMAC-SHA-256 is the realization of the HMAC message authentication code using the SHA-256 hash function
> {{Section 1 of RFC4231}}
{: #R-HMAC-SHA256 gi="blockquote"}

Note: the properties below hold hmacSha256 to the HMAC construction of
{{HMAC}} over nish/crypto/sha256 (block length 64 bytes, ipad 0x36, opad
0x5c, a key longer than the block hashed first) and to a 32-byte tag.

~~~ ts-property
// P-CONSTRUCTION-256 covers R-HMAC-SHA256 — HMAC-SHA-256 of a key of at most 64 bytes is the RFC 2104 construction over SHA-256
forall (key: u8[] /* 0..64 */, text: u8[] /* 0..200 */) => hmacSha256(key, text) === sha256(xor(key.concat(zeros(64 - key.length)), fill(92, 64)).concat(sha256(xor(key.concat(zeros(64 - key.length)), fill(54, 64)).concat(text))))
~~~

~~~ ts-property
// P-LONG-KEY-256 covers R-HMAC-SHA256 — a key longer than 64 bytes gives the tag of its SHA-256 hash
forall (key: u8[] /* 65..300 */, text: u8[] /* 0..100 */) => hmacSha256(key, text) === hmacSha256(sha256(key), text)
~~~

~~~ ts-property
// P-SECRET-256 covers R-HMAC-SHA256 — hmacSha256Secret, given the key as a Secret, gives the tag hmacSha256 gives
forall (key: u8[] /* 0..300 */, text: u8[] /* 0..200 */) => hmacSha256Secret(key, text) === hmacSha256(key, text)
~~~

> HMAC-SHA-384 is the realization of the HMAC message authentication code using the SHA-384 hash function
> {{Section 1 of RFC4231}}
{: #R-HMAC-SHA384 gi="blockquote"}

Note: as for SHA-256, with SHA-384, a block length of 128 bytes and a
48-byte tag.

~~~ ts-property
// P-CONSTRUCTION-384 covers R-HMAC-SHA384 — HMAC-SHA-384 of a key of at most 128 bytes is the RFC 2104 construction over SHA-384
forall (key: u8[] /* 0..128 */, text: u8[] /* 0..300 */) => hmacSha384(key, text) === sha384(xor(key.concat(zeros(128 - key.length)), fill(92, 128)).concat(sha384(xor(key.concat(zeros(128 - key.length)), fill(54, 128)).concat(text))))
~~~

~~~ ts-property
// P-LONG-KEY-384 covers R-HMAC-SHA384 — a key longer than 128 bytes gives the tag of its SHA-384 hash
forall (key: u8[] /* 129..400 */, text: u8[] /* 0..100 */) => hmacSha384(key, text) === hmacSha384(sha384(key), text)
~~~

~~~ ts-property
// P-SECRET-384 covers R-HMAC-SHA384 — hmacSha384Secret, given the key as a Secret, gives the tag hmacSha384 gives
forall (key: u8[] /* 0..400 */, text: u8[] /* 0..200 */) => hmacSha384Secret(key, text) === hmacSha384(key, text)
~~~

> HMAC-SHA-512 is the realization of the HMAC message authentication code using the SHA-512 hash function
> {{Section 1 of RFC4231}}
{: #R-HMAC-SHA512 gi="blockquote"}

Note: as for SHA-256, with SHA-512, a block length of 128 bytes and a
64-byte tag.

~~~ ts-property
// P-CONSTRUCTION-512 covers R-HMAC-SHA512 — HMAC-SHA-512 of a key of at most 128 bytes is the RFC 2104 construction over SHA-512
forall (key: u8[] /* 0..128 */, text: u8[] /* 0..300 */) => hmacSha512(key, text) === sha512(xor(key.concat(zeros(128 - key.length)), fill(92, 128)).concat(sha512(xor(key.concat(zeros(128 - key.length)), fill(54, 128)).concat(text))))
~~~

~~~ ts-property
// P-LONG-KEY-512 covers R-HMAC-SHA512 — a key longer than 128 bytes gives the tag of its SHA-512 hash
forall (key: u8[] /* 129..400 */, text: u8[] /* 0..100 */) => hmacSha512(key, text) === hmacSha512(sha512(key), text)
~~~

~~~ ts-property
// P-SECRET-512 covers R-HMAC-SHA512 — hmacSha512Secret, given the key as a Secret, gives the tag hmacSha512 gives
forall (key: u8[] /* 0..400 */, text: u8[] /* 0..200 */) => hmacSha512Secret(key, text) === hmacSha512(key, text)
~~~

~~~ ts-property
// P-TAG-LEN covers R-HMAC-SHA256, R-HMAC-SHA384, R-HMAC-SHA512 — the tags are 32, 48 and 64 bytes, the hash output, for any key and message
forall (key: u8[] /* 0..200 */, text: u8[] /* 0..200 */) => hmacSha256(key, text).length === 32 && hmacSha384(key, text).length === 48 && hmacSha512(key, text).length === 64
~~~

# The Test Cases

> Test with a key shorter than the length of the HMAC output.
> {{Section 4.3 of RFC4231}}
{: #R-SHORT-KEY gi="blockquote"}

> Test with a combined length of key and data that is larger than 64 bytes (= block-size of SHA-224 and SHA-256).
> {{Section 4.4 of RFC4231}}
{: #R-KEY-DATA-64 gi="blockquote"}

> Test with a combined length of key and data that is larger than 64 bytes (= block-size of SHA-224 and SHA-256).
> {{Section 4.5 of RFC4231}}
{: #R-KEY-DATA-64-TC4 gi="blockquote"}

Note: Sections 4.4 and 4.5 describe test cases 3 and 4 in the same
sentence; each is quoted under its own section.

> Test with a truncation of output to 128 bits.
> {{Section 4.6 of RFC4231}}
{: #R-TRUNC gi="blockquote"}

Test case 5 is three vector rows, TC5-256, TC5-384 and TC5-512. Section 4.6
prints each tag truncated to 128 bits, so each row has a `Truncate:`
paragraph after the vector table, and the test compares the first 16 bytes
of the whole tag that the function returns.

> Test with a key larger than 128 bytes (= block-size of SHA-384 and SHA-512).
> {{Section 4.7 of RFC4231}}
{: #R-KEY-128 gi="blockquote"}

> Test with a key and data that is larger than 128 bytes (= block-size of SHA-384 and SHA-512).
> {{Section 4.8 of RFC4231}}
{: #R-KEY-DATA-128 gi="blockquote"}

# Test Vectors

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| TC1-256 | `hmacSha256(Key = 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b, Data = 4869205468657265)` | `HMAC-SHA-256 = b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7` | R-HMAC-SHA256 | {{Section 4.2 of RFC4231}} | RFC 4231 test case 1, HMAC-SHA-256 |
| TC1-384 | `hmacSha384(Key = 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b, Data = 4869205468657265)` | `HMAC-SHA-384 = afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6` | R-HMAC-SHA384 | {{Section 4.2 of RFC4231}} | RFC 4231 test case 1, HMAC-SHA-384 |
| TC1-512 | `hmacSha512(Key = 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b, Data = 4869205468657265)` | `HMAC-SHA-512 = 87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854` | R-HMAC-SHA512 | {{Section 4.2 of RFC4231}} | RFC 4231 test case 1, HMAC-SHA-512 |
| TC2-256 | `hmacSha256(Key = 4a656665, Data = 7768617420646f2079612077616e7420666f72206e6f7468696e673f)` | `HMAC-SHA-256 = 5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843` | R-HMAC-SHA256, R-SHORT-KEY | {{Section 4.3 of RFC4231}} | RFC 4231 test case 2, a key shorter than the tag, HMAC-SHA-256 |
| TC2-384 | `hmacSha384(Key = 4a656665, Data = 7768617420646f2079612077616e7420666f72206e6f7468696e673f)` | `HMAC-SHA-384 = af45d2e376484031617f78d2b58a6b1b9c7ef464f5a01b47e42ec3736322445e8e2240ca5e69e2c78b3239ecfab21649` | R-HMAC-SHA384, R-SHORT-KEY | {{Section 4.3 of RFC4231}} | RFC 4231 test case 2, a key shorter than the tag, HMAC-SHA-384 |
| TC2-512 | `hmacSha512(Key = 4a656665, Data = 7768617420646f2079612077616e7420666f72206e6f7468696e673f)` | `HMAC-SHA-512 = 164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737` | R-HMAC-SHA512, R-SHORT-KEY | {{Section 4.3 of RFC4231}} | RFC 4231 test case 2, a key shorter than the tag, HMAC-SHA-512 |
| TC3-256 | `hmacSha256(Key = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Data = dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd)` | `HMAC-SHA-256 = 773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe` | R-HMAC-SHA256, R-KEY-DATA-64 | {{Section 4.4 of RFC4231}} | RFC 4231 test case 3, 50 bytes of data, HMAC-SHA-256 |
| TC3-384 | `hmacSha384(Key = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Data = dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd)` | `HMAC-SHA-384 = 88062608d3e6ad8a0aa2ace014c8a86f0aa635d947ac9febe83ef4e55966144b2a5ab39dc13814b94e3ab6e101a34f27` | R-HMAC-SHA384, R-KEY-DATA-64 | {{Section 4.4 of RFC4231}} | RFC 4231 test case 3, 50 bytes of data, HMAC-SHA-384 |
| TC3-512 | `hmacSha512(Key = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Data = dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd)` | `HMAC-SHA-512 = fa73b0089d56a284efb0f0756c890be9b1b5dbdd8ee81a3655f83e33b2279d39bf3e848279a722c806b485a47e67c807b946a337bee8942674278859e13292fb` | R-HMAC-SHA512, R-KEY-DATA-64 | {{Section 4.4 of RFC4231}} | RFC 4231 test case 3, 50 bytes of data, HMAC-SHA-512 |
| TC4-256 | `hmacSha256(Key = 0102030405060708090a0b0c0d0e0f10111213141516171819, Data = cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd)` | `HMAC-SHA-256 = 82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b` | R-HMAC-SHA256, R-KEY-DATA-64-TC4 | {{Section 4.5 of RFC4231}} | RFC 4231 test case 4, HMAC-SHA-256 |
| TC4-384 | `hmacSha384(Key = 0102030405060708090a0b0c0d0e0f10111213141516171819, Data = cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd)` | `HMAC-SHA-384 = 3e8a69b7783c25851933ab6290af6ca77a9981480850009cc5577c6e1f573b4e6801dd23c4a7d679ccf8a386c674cffb` | R-HMAC-SHA384, R-KEY-DATA-64-TC4 | {{Section 4.5 of RFC4231}} | RFC 4231 test case 4, HMAC-SHA-384 |
| TC4-512 | `hmacSha512(Key = 0102030405060708090a0b0c0d0e0f10111213141516171819, Data = cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd)` | `HMAC-SHA-512 = b0ba465637458c6990e5a8c5f61d4af7e576d97ff94b872de76f8050361ee3dba91ca5c11aa25eb4d679275cc5788063a5f19741120c4f2de2adebeb10a298dd` | R-HMAC-SHA512, R-KEY-DATA-64-TC4 | {{Section 4.5 of RFC4231}} | RFC 4231 test case 4, HMAC-SHA-512 |
| TC5-256 | `hmacSha256(Key = 0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c, Data = 546573742057697468205472756e636174696f6e)` | `HMAC-SHA-256 = a3b6167473100ee06e0c796c2955552b` | R-HMAC-SHA256, R-TRUNC | {{Section 4.6 of RFC4231}} | RFC 4231 test case 5, HMAC-SHA-256 truncated to 128 bits |
| TC5-384 | `hmacSha384(Key = 0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c, Data = 546573742057697468205472756e636174696f6e)` | `HMAC-SHA-384 = 3abf34c3503b2a23a46efc619baef897` | R-HMAC-SHA384, R-TRUNC | {{Section 4.6 of RFC4231}} | RFC 4231 test case 5, HMAC-SHA-384 truncated to 128 bits |
| TC5-512 | `hmacSha512(Key = 0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c, Data = 546573742057697468205472756e636174696f6e)` | `HMAC-SHA-512 = 415fad6271580a531d4179bc891d87a6` | R-HMAC-SHA512, R-TRUNC | {{Section 4.6 of RFC4231}} | RFC 4231 test case 5, HMAC-SHA-512 truncated to 128 bits |
| TC6-256 | `hmacSha256(Key = 131 × aa, Data = 54657374205573696e67204c6172676572205468616e20426c6f636b2d53697a65204b6579202d2048617368204b6579204669727374)` | `HMAC-SHA-256 = 60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54` | R-HMAC-SHA256, R-KEY-128 | {{Section 4.7 of RFC4231}} | RFC 4231 test case 6, a 131-byte key, HMAC-SHA-256 |
| TC6-384 | `hmacSha384(Key = 131 × aa, Data = 54657374205573696e67204c6172676572205468616e20426c6f636b2d53697a65204b6579202d2048617368204b6579204669727374)` | `HMAC-SHA-384 = 4ece084485813e9088d2c63a041bc5b44f9ef1012a2b588f3cd11f05033ac4c60c2ef6ab4030fe8296248df163f44952` | R-HMAC-SHA384, R-KEY-128 | {{Section 4.7 of RFC4231}} | RFC 4231 test case 6, a 131-byte key, HMAC-SHA-384 |
| TC6-512 | `hmacSha512(Key = 131 × aa, Data = 54657374205573696e67204c6172676572205468616e20426c6f636b2d53697a65204b6579202d2048617368204b6579204669727374)` | `HMAC-SHA-512 = 80b24263c7c1a3ebb71493c1dd7be8b49b46d1f41b4aeec1121b013783f8f3526b56d037e05f2598bd0fd2215d6a1e5295e64f73f63f0aec8b915a985d786598` | R-HMAC-SHA512, R-KEY-128 | {{Section 4.7 of RFC4231}} | RFC 4231 test case 6, a 131-byte key, HMAC-SHA-512 |
| TC7-256 | `hmacSha256(Key = 131 × aa, Data = 5468697320697320612074657374207573696e672061206c6172676572207468616e20626c6f636b2d73697a65206b657920616e642061206c6172676572207468616e20626c6f636b2d73697a6520646174612e20546865206b6579206e6565647320746f20626520686173686564206265666f7265206265696e6720757365642062792074686520484d414320616c676f726974686d2e)` | `HMAC-SHA-256 = 9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2` | R-HMAC-SHA256, R-KEY-DATA-128 | {{Section 4.8 of RFC4231}} | RFC 4231 test case 7, a 131-byte key and data longer than the block, HMAC-SHA-256 |
| TC7-384 | `hmacSha384(Key = 131 × aa, Data = 5468697320697320612074657374207573696e672061206c6172676572207468616e20626c6f636b2d73697a65206b657920616e642061206c6172676572207468616e20626c6f636b2d73697a6520646174612e20546865206b6579206e6565647320746f20626520686173686564206265666f7265206265696e6720757365642062792074686520484d414320616c676f726974686d2e)` | `HMAC-SHA-384 = 6617178e941f020d351e2f254e8fd32c602420feb0b8fb9adccebb82461e99c5a678cc31e799176d3860e6110c46523e` | R-HMAC-SHA384, R-KEY-DATA-128 | {{Section 4.8 of RFC4231}} | RFC 4231 test case 7, a 131-byte key and data longer than the block, HMAC-SHA-384 |
| TC7-512 | `hmacSha512(Key = 131 × aa, Data = 5468697320697320612074657374207573696e672061206c6172676572207468616e20626c6f636b2d73697a65206b657920616e642061206c6172676572207468616e20626c6f636b2d73697a6520646174612e20546865206b6579206e6565647320746f20626520686173686564206265666f7265206265696e6720757365642062792074686520484d414320616c676f726974686d2e)` | `HMAC-SHA-512 = e37b6a775dc87dbaa4dfa9f96e5e3ffddebd71f8867289865df5a32d20cdc944b6022cac3c4982b10d5eeb55c3e4de15134676fb6de0446065c97440fa8c6a58` | R-HMAC-SHA512, R-KEY-DATA-128 | {{Section 4.8 of RFC4231}} | RFC 4231 test case 7, a 131-byte key and data longer than the block, HMAC-SHA-512 |

Truncate: TC5-256 to 128 bits

Truncate: TC5-384 to 128 bits

Truncate: TC5-512 to 128 bits
