---
title: "HMAC-SHA-256, HMAC-SHA-384 and HMAC-SHA-512"
abbrev: nish/crypto/hmac
docname: draft-rfc4231-hmac-sha2-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-16
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

Module: std/crypto/hmac.ts (nish/crypto/hmac). HMAC ({{HMAC}})
instantiated with SHA-256, SHA-384 and SHA-512 as {{RFC4231}} defines it,
held to every RFC 4231 test vector, with its tag checks held to accept the
right tag and refuse a tampered one.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

nish/crypto/hmac exports one-shot HMAC-SHA-256, HMAC-SHA-384 and
HMAC-SHA-512 over a key and a message, each as `u8[]`, and a verify function
for each that compares a tag with the one it computes. The construction is
{{HMAC}}'s; the properties compare it with nish/crypto/sha256 and
nish/crypto/sha512, the hash functions it is built on.

The module's other exports are out of scope here. hmacSha256Secret,
hmacSha384Secret and hmacSha512Secret take the key as a `Secret<u8[]>`,
which a property cannot construct; they compute the same function as the
plain exports, and their wiping is held by nish's `nish:secret` tests.
pbkdf2HmacSha256 is PBKDF2 (RFC 8018), which uses HMAC-SHA-256 as its
PRF but is a different function, with its own vectors and none in RFC 4231. The
classes HmacSha256, HmacSha384, HmacSha512, HmacSha256Scratch,
HmacSha384Scratch and HmacKey are stateful, reusable forms of the same
functions; a property here calls only functions, so they are left to nish's
own tests.

# Interface

~~~ ts-interface
// module: nish/crypto/hmac
export const hmacSha256 = (key: u8[], data: u8[]): u8[]
export const hmacSha384 = (key: u8[], data: u8[]): u8[]
export const hmacSha512 = (key: u8[], data: u8[]): u8[]
export const hmacSha256Verify = (key: u8[], data: u8[], tag: u8[]): boolean
export const hmacSha384Verify = (key: u8[], data: u8[], tag: u8[]): boolean
export const hmacSha512Verify = (key: u8[], data: u8[], tag: u8[]): boolean
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

> HMAC-SHA-384 is the realization of the HMAC message authentication code using the SHA-384 hash function
> {{Section 1 of RFC4231}}
{: #R-HMAC-SHA384 gi="blockquote"}

> HMAC-SHA-512 is the realization of the HMAC message authentication code using the SHA-512 hash function
> {{Section 1 of RFC4231}}
{: #R-HMAC-SHA512 gi="blockquote"}

## The Construction

The tag MUST be H((K0 XOR opad) \|\| H((K0 XOR ipad) \|\| text)) as
{{HMAC}} defines it, where H is the hash function, B is its block length
(64 bytes for SHA-256, 128 for SHA-384 and SHA-512), K0 is the key padded
with zero bytes to B bytes, ipad is B bytes of 0x36 and opad is B bytes of
0x5c.
{: #R-CONSTRUCTION}

~~~ ts-property
// P-CONSTRUCTION-256 covers R-CONSTRUCTION, R-HMAC-SHA256 — HMAC-SHA-256 of a key of at most 64 bytes is the RFC 2104 construction over SHA-256
forall (key: u8[] /* 0..64 */, text: u8[] /* 0..200 */) => hmacSha256(key, text) === sha256(xor(key.concat(zeros(64 - key.length)), fill(92, 64)).concat(sha256(xor(key.concat(zeros(64 - key.length)), fill(54, 64)).concat(text))))
~~~

~~~ ts-property
// P-CONSTRUCTION-384 covers R-CONSTRUCTION, R-HMAC-SHA384 — HMAC-SHA-384 of a key of at most 128 bytes is the RFC 2104 construction over SHA-384
forall (key: u8[] /* 0..128 */, text: u8[] /* 0..300 */) => hmacSha384(key, text) === sha384(xor(key.concat(zeros(128 - key.length)), fill(92, 128)).concat(sha384(xor(key.concat(zeros(128 - key.length)), fill(54, 128)).concat(text))))
~~~

~~~ ts-property
// P-CONSTRUCTION-512 covers R-CONSTRUCTION, R-HMAC-SHA512 — HMAC-SHA-512 of a key of at most 128 bytes is the RFC 2104 construction over SHA-512
forall (key: u8[] /* 0..128 */, text: u8[] /* 0..300 */) => hmacSha512(key, text) === sha512(xor(key.concat(zeros(128 - key.length)), fill(92, 128)).concat(sha512(xor(key.concat(zeros(128 - key.length)), fill(54, 128)).concat(text))))
~~~

## Long Keys

A key longer than B bytes MUST first be hashed with H, and the B-byte block
padded from that hash used in its place, as {{HMAC}} defines it.
{: #R-LONG-KEY}

~~~ ts-property
// P-LONG-KEY-256 covers R-LONG-KEY — a key longer than 64 bytes gives the tag of its SHA-256 hash
forall (key: u8[] /* 65..300 */, text: u8[] /* 0..100 */) => hmacSha256(key, text) === hmacSha256(sha256(key), text)
~~~

~~~ ts-property
// P-LONG-KEY-384 covers R-LONG-KEY — a key longer than 128 bytes gives the tag of its SHA-384 hash
forall (key: u8[] /* 129..400 */, text: u8[] /* 0..100 */) => hmacSha384(key, text) === hmacSha384(sha384(key), text)
~~~

~~~ ts-property
// P-LONG-KEY-512 covers R-LONG-KEY — a key longer than 128 bytes gives the tag of its SHA-512 hash
forall (key: u8[] /* 129..400 */, text: u8[] /* 0..100 */) => hmacSha512(key, text) === hmacSha512(sha512(key), text)
~~~

## Tag Length

hmacSha256, hmacSha384 and hmacSha512 MUST return the whole hash output:
32, 48 and 64 bytes.
{: #R-TAG-LEN}

~~~ ts-property
// P-TAG-LEN covers R-TAG-LEN — the tags are 32, 48 and 64 bytes for any key and message
forall (key: u8[] /* 0..200 */, text: u8[] /* 0..200 */) => hmacSha256(key, text).length === 32 && hmacSha384(key, text).length === 48 && hmacSha512(key, text).length === 64
~~~

> Test with a truncation of output to 128 bits.
> {{Section 4.6 of RFC4231}}
{: #R-TRUNC gi="blockquote"}

Note: the functions return the whole tag, so test case 5 ({{Section 4.6 of
RFC4231}}: a key of 20 bytes of 0x0c, the data "Test With Truncation") is
written as a slice of it, its first 16 bytes.

~~~ ts-property
// P-TRUNC-256 covers R-TRUNC, R-HMAC-SHA256 — RFC 4231 test case 5: the first 128 bits of HMAC-SHA-256 are a3b6167473100ee06e0c796c2955552b
forall (n: i32 /* 16..16 */) => hmacSha256(fill(12, 20), utf8("Test With Truncation")).slice(0, n) === [a3 b6 16 74 73 10 0e e0 6e 0c 79 6c 29 55 55 2b]
~~~

~~~ ts-property
// P-TRUNC-384 covers R-TRUNC, R-HMAC-SHA384 — RFC 4231 test case 5: the first 128 bits of HMAC-SHA-384 are 3abf34c3503b2a23a46efc619baef897
forall (n: i32 /* 16..16 */) => hmacSha384(fill(12, 20), utf8("Test With Truncation")).slice(0, n) === [3a bf 34 c3 50 3b 2a 23 a4 6e fc 61 9b ae f8 97]
~~~

~~~ ts-property
// P-TRUNC-512 covers R-TRUNC, R-HMAC-SHA512 — RFC 4231 test case 5: the first 128 bits of HMAC-SHA-512 are 415fad6271580a531d4179bc891d87a6
forall (n: i32 /* 16..16 */) => hmacSha512(fill(12, 20), utf8("Test With Truncation")).slice(0, n) === [41 5f ad 62 71 58 0a 53 1d 41 79 bc 89 1d 87 a6]
~~~

# Verifying a Tag

## Accepting the Tag

hmacSha256Verify, hmacSha384Verify and hmacSha512Verify MUST return true
for the tag that hmacSha256, hmacSha384 and hmacSha512 compute over the same
key and message.
{: #R-VERIFY-ACCEPT}

~~~ ts-property
// P-VERIFY-ACCEPT covers R-VERIFY-ACCEPT — each verify accepts the tag its function computes
forall (key: u8[] /* 0..200 */, text: u8[] /* 0..200 */) => hmacSha256Verify(key, text, hmacSha256(key, text)) && hmacSha384Verify(key, text, hmacSha384(key, text)) && hmacSha512Verify(key, text, hmacSha512(key, text))
~~~

## Refusing a Tampered Tag

hmacSha256Verify, hmacSha384Verify and hmacSha512Verify MUST return false
for a tag that differs from that tag in any one bit.
{: #R-VERIFY-REJECT}

~~~ ts-property
// P-VERIFY-REJECT-256 covers R-VERIFY-REJECT — hmacSha256Verify refuses the tag with any one bit flipped
forall (key: u8[] /* 0..100 */, text: u8[] /* 0..100 */, bit: i32 /* 0..255 */) => !hmacSha256Verify(key, text, flipBit(hmacSha256(key, text), bit))
~~~

~~~ ts-property
// P-VERIFY-REJECT-384 covers R-VERIFY-REJECT — hmacSha384Verify refuses the tag with any one bit flipped
forall (key: u8[] /* 0..150 */, text: u8[] /* 0..100 */, bit: i32 /* 0..383 */) => !hmacSha384Verify(key, text, flipBit(hmacSha384(key, text), bit))
~~~

~~~ ts-property
// P-VERIFY-REJECT-512 covers R-VERIFY-REJECT — hmacSha512Verify refuses the tag with any one bit flipped
forall (key: u8[] /* 0..150 */, text: u8[] /* 0..100 */, bit: i32 /* 0..511 */) => !hmacSha512Verify(key, text, flipBit(hmacSha512(key, text), bit))
~~~

# Security Considerations

The verify functions MUST compare the tag in time that depends only on its
length.
{: #R-CT-COMPARE}

Untested: How the code runs, not what it returns: no functional test observes a running time. Checked in nish instead: the verify functions compare through timingSafeEqual, whose loop tests/cases/ct_asm_k1_ct.ts holds to no branch on the data at 32 and 48 bytes after clang -O2; docs/security/ct-verification.md records the verify functions themselves as resting on review (docs/security/crypto-k1.md, K1-8).

The padded key block, the hash of a key longer than B bytes and the inner
hash MUST be wiped before the functions return.
{: #R-WIPE}

Untested: Memory after return, not a return value: no functional test reads freed memory. Checked in nish instead: tests/wipes/crypto.js ("crypto_hmac crypto_hkdf: the wipes survive -O2") holds HMAC's key blocks, hashed key, inner digest and hashers to wipe's volatile stores under -O2, the same store tests/run.js "nish:secret: the wipe survives opt -O2" pins; the caller's own key array, which no wipe here reaches, is recorded in docs/security/crypto-k1.md (K1-7) and docs/security/secret.md.

# Test Vectors

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| TC1-256 | `hmacSha256(Key = 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b, Data = 4869205468657265)` | `HMAC-SHA-256 = b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7` | R-HMAC-SHA256, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.2 of RFC4231}} | RFC 4231 test case 1, HMAC-SHA-256 |
| TC1-384 | `hmacSha384(Key = 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b, Data = 4869205468657265)` | `HMAC-SHA-384 = afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6` | R-HMAC-SHA384, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.2 of RFC4231}} | RFC 4231 test case 1, HMAC-SHA-384 |
| TC1-512 | `hmacSha512(Key = 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b, Data = 4869205468657265)` | `HMAC-SHA-512 = 87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854` | R-HMAC-SHA512, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.2 of RFC4231}} | RFC 4231 test case 1, HMAC-SHA-512 |
| TC2-256 | `hmacSha256(Key = 4a656665, Data = 7768617420646f2079612077616e7420666f72206e6f7468696e673f)` | `HMAC-SHA-256 = 5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843` | R-HMAC-SHA256, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.3 of RFC4231}} | RFC 4231 test case 2, a key shorter than the tag, HMAC-SHA-256 |
| TC2-384 | `hmacSha384(Key = 4a656665, Data = 7768617420646f2079612077616e7420666f72206e6f7468696e673f)` | `HMAC-SHA-384 = af45d2e376484031617f78d2b58a6b1b9c7ef464f5a01b47e42ec3736322445e8e2240ca5e69e2c78b3239ecfab21649` | R-HMAC-SHA384, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.3 of RFC4231}} | RFC 4231 test case 2, a key shorter than the tag, HMAC-SHA-384 |
| TC2-512 | `hmacSha512(Key = 4a656665, Data = 7768617420646f2079612077616e7420666f72206e6f7468696e673f)` | `HMAC-SHA-512 = 164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737` | R-HMAC-SHA512, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.3 of RFC4231}} | RFC 4231 test case 2, a key shorter than the tag, HMAC-SHA-512 |
| TC3-256 | `hmacSha256(Key = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Data = dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd)` | `HMAC-SHA-256 = 773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe` | R-HMAC-SHA256, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.4 of RFC4231}} | RFC 4231 test case 3, 50 bytes of data, HMAC-SHA-256 |
| TC3-384 | `hmacSha384(Key = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Data = dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd)` | `HMAC-SHA-384 = 88062608d3e6ad8a0aa2ace014c8a86f0aa635d947ac9febe83ef4e55966144b2a5ab39dc13814b94e3ab6e101a34f27` | R-HMAC-SHA384, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.4 of RFC4231}} | RFC 4231 test case 3, 50 bytes of data, HMAC-SHA-384 |
| TC3-512 | `hmacSha512(Key = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Data = dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd)` | `HMAC-SHA-512 = fa73b0089d56a284efb0f0756c890be9b1b5dbdd8ee81a3655f83e33b2279d39bf3e848279a722c806b485a47e67c807b946a337bee8942674278859e13292fb` | R-HMAC-SHA512, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.4 of RFC4231}} | RFC 4231 test case 3, 50 bytes of data, HMAC-SHA-512 |
| TC4-256 | `hmacSha256(Key = 0102030405060708090a0b0c0d0e0f10111213141516171819, Data = cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd)` | `HMAC-SHA-256 = 82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b` | R-HMAC-SHA256, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.5 of RFC4231}} | RFC 4231 test case 4, HMAC-SHA-256 |
| TC4-384 | `hmacSha384(Key = 0102030405060708090a0b0c0d0e0f10111213141516171819, Data = cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd)` | `HMAC-SHA-384 = 3e8a69b7783c25851933ab6290af6ca77a9981480850009cc5577c6e1f573b4e6801dd23c4a7d679ccf8a386c674cffb` | R-HMAC-SHA384, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.5 of RFC4231}} | RFC 4231 test case 4, HMAC-SHA-384 |
| TC4-512 | `hmacSha512(Key = 0102030405060708090a0b0c0d0e0f10111213141516171819, Data = cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd)` | `HMAC-SHA-512 = b0ba465637458c6990e5a8c5f61d4af7e576d97ff94b872de76f8050361ee3dba91ca5c11aa25eb4d679275cc5788063a5f19741120c4f2de2adebeb10a298dd` | R-HMAC-SHA512, R-CONSTRUCTION, R-TAG-LEN | {{Section 4.5 of RFC4231}} | RFC 4231 test case 4, HMAC-SHA-512 |
| TC6-256 | `hmacSha256(Key = 131 × aa, Data = 54657374205573696e67204c6172676572205468616e20426c6f636b2d53697a65204b6579202d2048617368204b6579204669727374)` | `HMAC-SHA-256 = 60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54` | R-HMAC-SHA256, R-LONG-KEY, R-TAG-LEN | {{Section 4.7 of RFC4231}} | RFC 4231 test case 6, a 131-byte key, HMAC-SHA-256 |
| TC6-384 | `hmacSha384(Key = 131 × aa, Data = 54657374205573696e67204c6172676572205468616e20426c6f636b2d53697a65204b6579202d2048617368204b6579204669727374)` | `HMAC-SHA-384 = 4ece084485813e9088d2c63a041bc5b44f9ef1012a2b588f3cd11f05033ac4c60c2ef6ab4030fe8296248df163f44952` | R-HMAC-SHA384, R-LONG-KEY, R-TAG-LEN | {{Section 4.7 of RFC4231}} | RFC 4231 test case 6, a 131-byte key, HMAC-SHA-384 |
| TC6-512 | `hmacSha512(Key = 131 × aa, Data = 54657374205573696e67204c6172676572205468616e20426c6f636b2d53697a65204b6579202d2048617368204b6579204669727374)` | `HMAC-SHA-512 = 80b24263c7c1a3ebb71493c1dd7be8b49b46d1f41b4aeec1121b013783f8f3526b56d037e05f2598bd0fd2215d6a1e5295e64f73f63f0aec8b915a985d786598` | R-HMAC-SHA512, R-LONG-KEY, R-TAG-LEN | {{Section 4.7 of RFC4231}} | RFC 4231 test case 6, a 131-byte key, HMAC-SHA-512 |
| TC7-256 | `hmacSha256(Key = 131 × aa, Data = 5468697320697320612074657374207573696e672061206c6172676572207468616e20626c6f636b2d73697a65206b657920616e642061206c6172676572207468616e20626c6f636b2d73697a6520646174612e20546865206b6579206e6565647320746f20626520686173686564206265666f7265206265696e6720757365642062792074686520484d414320616c676f726974686d2e)` | `HMAC-SHA-256 = 9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2` | R-HMAC-SHA256, R-LONG-KEY, R-TAG-LEN | {{Section 4.8 of RFC4231}} | RFC 4231 test case 7, a 131-byte key and data longer than the block, HMAC-SHA-256 |
| TC7-384 | `hmacSha384(Key = 131 × aa, Data = 5468697320697320612074657374207573696e672061206c6172676572207468616e20626c6f636b2d73697a65206b657920616e642061206c6172676572207468616e20626c6f636b2d73697a6520646174612e20546865206b6579206e6565647320746f20626520686173686564206265666f7265206265696e6720757365642062792074686520484d414320616c676f726974686d2e)` | `HMAC-SHA-384 = 6617178e941f020d351e2f254e8fd32c602420feb0b8fb9adccebb82461e99c5a678cc31e799176d3860e6110c46523e` | R-HMAC-SHA384, R-LONG-KEY, R-TAG-LEN | {{Section 4.8 of RFC4231}} | RFC 4231 test case 7, a 131-byte key and data longer than the block, HMAC-SHA-384 |
| TC7-512 | `hmacSha512(Key = 131 × aa, Data = 5468697320697320612074657374207573696e672061206c6172676572207468616e20626c6f636b2d73697a65206b657920616e642061206c6172676572207468616e20626c6f636b2d73697a6520646174612e20546865206b6579206e6565647320746f20626520686173686564206265666f7265206265696e6720757365642062792074686520484d414320616c676f726974686d2e)` | `HMAC-SHA-512 = e37b6a775dc87dbaa4dfa9f96e5e3ffddebd71f8867289865df5a32d20cdc944b6022cac3c4982b10d5eeb55c3e4de15134676fb6de0446065c97440fa8c6a58` | R-HMAC-SHA512, R-LONG-KEY, R-TAG-LEN | {{Section 4.8 of RFC4231}} | RFC 4231 test case 7, a 131-byte key and data longer than the block, HMAC-SHA-512 |
