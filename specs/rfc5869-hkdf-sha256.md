---
# Copied from vector (https://github.com/amritk/vector), specs/rfc5869-hkdf-sha256.md
# at v0.2.1, with an Out of Scope section and a Secret Forms section added.
# Copyright (c) 2026 Amrit Kahlon.
# Used under the MIT License, whose text follows.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
title: "HMAC-based Extract-and-Expand Key Derivation Function (HKDF)"
abbrev: nish/crypto/hkdf
docname: draft-rfc5869-hkdf-sha256-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-12
keyword:
  - vector-main-RFC5869
author:
  - name: Vector Authors
    org: vector
normative:
  RFC5869:
--- abstract

A profile of RFC 5869 for nish/crypto/hkdf: HKDF instantiated with
SHA-256, so HashLen is 32, and the forms of it that hold the keying
material as a `Secret`, for SHA-256 and SHA-384. Every requirement quotes RFC 5869, the main
source; every binding sentence of RFC 5869 (MUST, MUST NOT, SHALL, SHALL
NOT, REQUIRED) is tested or excluded here.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

nish/crypto/hkdf exports HKDF-Extract and HKDF-Expand for SHA-256. The
properties compare them with nish/crypto/hmac, the HMAC-SHA-256 they are
built on.

# Interface

~~~ ts-interface
// module: nish/crypto/hkdf
export const hkdfExtractSha256 = (salt: u8[], ikm: u8[]): u8[]
export const hkdfExpandSha256 = (prk: u8[], info: u8[], length: i32): u8[] | null
export const hkdfExtractSha384 = (salt: u8[], ikm: u8[]): u8[]
export const hkdfExpandSha384 = (prk: u8[], info: u8[], length: i32): u8[] | null
export const hkdfExtractSha256Secret = (salt: u8[], ikm: Secret<u8[]>): Secret<u8[]>
export const hkdfExtractSha384Secret = (salt: u8[], ikm: Secret<u8[]>): Secret<u8[]>
export const hkdfExpandSha256Secret = (prk: Secret<u8[]>, info: u8[], length: i32): Secret<u8[]> | null
export const hkdfExpandSha384Secret = (prk: Secret<u8[]>, info: u8[], length: i32): Secret<u8[]> | null
export const hkdfSha256Secret = (salt: u8[], ikm: Secret<u8[]>, info: u8[], length: i32): Secret<u8[]> | null
export const hkdfSha384Secret = (salt: u8[], ikm: Secret<u8[]>, info: u8[], length: i32): Secret<u8[]> | null
// module: nish/crypto/hmac
export const hmacSha256 = (key: u8[], data: u8[]): u8[]
export const hmacSha384 = (key: u8[], data: u8[]): u8[]
~~~

# Extract

> PRK = HMAC-Hash(salt, IKM)
> {{Section 2.2 of RFC5869}}
{: #R-EXTRACT gi="blockquote"}

~~~ ts-property
// P-EXTRACT-IS-HMAC covers R-EXTRACT — HKDF-Extract is HMAC-SHA-256 keyed by the salt
forall (salt: u8[] /* 1..150 */, ikm: u8[] /* 0..150 */) => hkdfExtractSha256(salt, ikm) === hmacSha256(salt, ikm)
~~~

> if not provided, it is set to a string of HashLen zeros.
> {{Section 2.2 of RFC5869}}
{: #R-SALT gi="blockquote"}

~~~ ts-property
// P-EMPTY-SALT covers R-SALT — an absent salt is HashLen zero octets
forall (ikm: u8[] /* 0..150 */) => hkdfExtractSha256([], ikm) === hmacSha256(zeros(32), ikm)
~~~

> PRK a pseudorandom key (of HashLen octets)
> {{Section 2.2 of RFC5869}}
{: #R-PRK-LEN gi="blockquote"}

~~~ ts-property
// P-PRK-LEN covers R-PRK-LEN — the PRK is HashLen octets
forall (salt: u8[] /* 0..150 */, ikm: u8[] /* 0..150 */) => hkdfExtractSha256(salt, ikm).length === 32
~~~

# Expand

> L length of output keying material in octets (<= 255*HashLen)
> {{Section 2.3 of RFC5869}}
{: #R-L gi="blockquote"}

Note: The RFC states the bound; refusing a longer L with null is how nish/crypto/hkdf honours it.

> info optional context and application specific information (can be a zero-length string)
> {{Section 2.3 of RFC5869}}
{: #R-INFO-EMPTY gi="blockquote"}

> OKM output keying material (of L octets)
> {{Section 2.3 of RFC5869}}
{: #R-OKM-LEN gi="blockquote"}

~~~ ts-property
// P-EXPAND-LENGTH covers R-L, R-OKM-LEN — Expand gives exactly L octets for L <= 255*HashLen and refuses a longer L
forall (prk: u8[] /* 32..64 */, info: u8[] /* 0..40 */, n: i32 /* 0..8300 */) =>
  implies(n <= 255 * 32, hkdfExpandSha256(prk, info, n) !== null && unwrap(hkdfExpandSha256(prk, info, n)).length === n) &&
  implies(n > 255 * 32, hkdfExpandSha256(prk, info, n) === null)
~~~

> OKM = first L octets of T
> {{Section 2.3 of RFC5869}}
{: #R-OKM-FIRST gi="blockquote"}

> T(0) = empty string (zero length)
> T(1) = HMAC-Hash(PRK, T(0) \| info \| 0x01)
> T(2) = HMAC-Hash(PRK, T(1) \| info \| 0x02)
> {{Section 2.3 of RFC5869}}
{: #R-T gi="blockquote"}

~~~ ts-property
// P-T1-T2 covers R-T — the first two blocks are T(1) and T(2) as §2.3 defines them
forall (prk: u8[] /* 32..64 */, info: u8[] /* 0..100 */) =>
  unwrap(hkdfExpandSha256(prk, info, 64)).slice(0, 32) === hmacSha256(prk, info.concat([01])) &&
  unwrap(hkdfExpandSha256(prk, info, 64)).slice(32, 64) === hmacSha256(prk, hmacSha256(prk, info.concat([01])).concat(info).concat([02]))
~~~

~~~ ts-property
// P-PREFIX covers R-OKM-FIRST — OKM is the first L octets of one stream T: a shorter L is a prefix of a longer one
forall (prk: u8[] /* 32..48 */, info: u8[] /* 0..32 */, n: i32 /* 0..300 */, m: i32 /* 0..300 */) => unwrap(hkdfExpandSha256(prk, info, m)).slice(0, n) === unwrap(hkdfExpandSha256(prk, info, n))
where n <= m
~~~

# Secret Forms

nish/crypto/hkdf also exports each derivation with its keying material held
as a `Secret<u8[]>`, for SHA-256 and SHA-384. What a Secret form adds is
wiping, which a functional test cannot observe and tests/wipes/crypto.js
holds; the properties here hold each to the same output as its plain twin.
RFC 5869 Appendix A has no SHA-384 test case, so SHA-384's plain forms are
held to HMAC-SHA-384 by the definitions above, with HashLen 48, and its
Secret forms to them.

~~~ ts-property
// P-EXTRACT-IS-HMAC-384 covers R-EXTRACT — HKDF-Extract over SHA-384 is HMAC-SHA-384 keyed by the salt
forall (salt: u8[] /* 1..150 */, ikm: u8[] /* 0..150 */) => hkdfExtractSha384(salt, ikm) === hmacSha384(salt, ikm)
~~~

~~~ ts-property
// P-EMPTY-SALT-384 covers R-SALT — an absent salt is HashLen zero octets, 48 for SHA-384
forall (ikm: u8[] /* 0..150 */) => hkdfExtractSha384([], ikm) === hmacSha384(zeros(48), ikm)
~~~

~~~ ts-property
// P-T1-T2-384 covers R-T — over SHA-384, the first two blocks are T(1) and T(2) as §2.3 defines them
forall (prk: u8[] /* 48..64 */, info: u8[] /* 0..100 */) =>
  unwrap(hkdfExpandSha384(prk, info, 96)).slice(0, 48) === hmacSha384(prk, info.concat([01])) &&
  unwrap(hkdfExpandSha384(prk, info, 96)).slice(48, 96) === hmacSha384(prk, hmacSha384(prk, info.concat([01])).concat(info).concat([02]))
~~~

~~~ ts-property
// P-EXPAND-LENGTH-384 covers R-L, R-OKM-LEN — over SHA-384, Expand gives exactly L octets for L <= 255*HashLen and refuses a longer L
forall (prk: u8[] /* 48..64 */, info: u8[] /* 0..40 */, n: i32 /* 0..12400 */) =>
  implies(n <= 255 * 48, hkdfExpandSha384(prk, info, n) !== null && unwrap(hkdfExpandSha384(prk, info, n)).length === n) &&
  implies(n > 255 * 48, hkdfExpandSha384(prk, info, n) === null)
~~~

~~~ ts-property
// P-SECRET-EXTRACT covers R-EXTRACT — hkdfExtractSha256Secret and hkdfExtractSha384Secret, given the IKM as a Secret, give the PRK their plain twins give
forall (salt: u8[] /* 0..150 */, ikm: u8[] /* 0..150 */) =>
  hkdfExtractSha256Secret(salt, ikm) === hkdfExtractSha256(salt, ikm) &&
  hkdfExtractSha384Secret(salt, ikm) === hkdfExtractSha384(salt, ikm)
~~~

~~~ ts-property
// P-SECRET-EXPAND-256 covers R-L, R-OKM-FIRST — hkdfExpandSha256Secret, given the PRK as a Secret, gives the OKM hkdfExpandSha256 gives and refuses the L it refuses
forall (prk: u8[] /* 32..64 */, info: u8[] /* 0..40 */, n: i32 /* 0..8300 */) =>
  implies(n <= 255 * 32, unwrap(hkdfExpandSha256Secret(prk, info, n)) === unwrap(hkdfExpandSha256(prk, info, n))) &&
  implies(n > 255 * 32, hkdfExpandSha256Secret(prk, info, n) === null)
~~~

~~~ ts-property
// P-SECRET-EXPAND-384 covers R-L, R-OKM-FIRST — hkdfExpandSha384Secret, given the PRK as a Secret, gives the OKM hkdfExpandSha384 gives and refuses the L it refuses
forall (prk: u8[] /* 48..64 */, info: u8[] /* 0..40 */, n: i32 /* 0..12400 */) =>
  implies(n <= 255 * 48, unwrap(hkdfExpandSha384Secret(prk, info, n)) === unwrap(hkdfExpandSha384(prk, info, n))) &&
  implies(n > 255 * 48, hkdfExpandSha384Secret(prk, info, n) === null)
~~~

~~~ ts-property
// P-SECRET-HKDF covers R-EXTRACT, R-OKM-FIRST — hkdfSha256Secret and hkdfSha384Secret are Expand of Extract, as their plain twins compose
forall (salt: u8[] /* 0..64 */, ikm: u8[] /* 0..64 */, info: u8[] /* 0..40 */, n: i32 /* 0..300 */) =>
  unwrap(hkdfSha256Secret(salt, ikm, info, n)) === unwrap(hkdfExpandSha256(hkdfExtractSha256(salt, ikm), info, n)) &&
  unwrap(hkdfSha384Secret(salt, ikm, info, n)) === unwrap(hkdfExpandSha384(hkdfExtractSha384(salt, ikm), info, n))
~~~

# Out of Scope

This contract tests hkdfExtractSha256 and hkdfExpandSha256, their SHA-384
twins and the six Secret forms above; every other export of nish/crypto/hkdf is declared out of scope below, with the reason it
is not tested.

Out of scope: hkdfExpandLabelSha256, TLS 1.3's HKDF-Expand-Label (RFC 8446 Section 7.1), not a construction of RFC 5869

Out of scope: hkdfExpandLabelSha384, TLS 1.3's HKDF-Expand-Label (RFC 8446 Section 7.1), not a construction of RFC 5869

Out of scope: hkdfExpandLabelSha256Secret, TLS 1.3's HKDF-Expand-Label (RFC 8446 Section 7.1), not a construction of RFC 5869

Out of scope: hkdfExpandLabelSha384Secret, TLS 1.3's HKDF-Expand-Label (RFC 8446 Section 7.1), not a construction of RFC 5869

Out of scope: hkdfExtractInto, an allocation-free variant writing into caller buffers through an HkdfScratch; its (out, at) is an `/* out hashLength */` write, but its first parameter is the class HkdfScratch, which vector 0.6.0 refuses in a ts-interface block ("`HkdfScratch` is not a ts-interface type; use u8[], string, boolean, i8, i16, i32, i64, u8, u16, u32, u64, f64, Secret<u8[]>, u16[], u32[], u64[], each optionally `| null`"), and it returns void where an `/* out CAP */` write returns the end offset

Out of scope: hkdfExpandInto, an allocation-free variant writing into caller buffers through an HkdfScratch; its first parameter is the class HkdfScratch, which vector 0.6.0 refuses in a ts-interface block ("`HkdfScratch` is not a ts-interface type; use u8[], string, boolean, i8, i16, i32, i64, u8, u16, u32, u64, f64, Secret<u8[]>, u16[], u32[], u64[], each optionally `| null`"), and its (out, at) is followed by the length and answers a boolean where an `/* out CAP */` write returns the end offset

Out of scope: hkdfExpandLabelInto, an allocation-free variant writing into caller buffers through an HkdfScratch; its context is a `/* window */`, but its first parameter is the class HkdfScratch, which vector 0.6.0 refuses in a ts-interface block ("`HkdfScratch` is not a ts-interface type; use u8[], string, boolean, i8, i16, i32, i64, u8, u16, u32, u64, f64, Secret<u8[]>, u16[], u32[], u64[], each optionally `| null`"), it returns void where an `/* out CAP */` write returns the end offset, and it is RFC 8446's Expand-Label, not a construction of RFC 5869

Out of scope: hkdfExpandLabelSha256Held, Expand-Label of a held Secret PRK, written in place into a Secret or a caller buffer; likewise RFC 8446, not RFC 5869

Out of scope: hkdfExpandLabelSha384Held, Expand-Label of a held Secret PRK, written in place into a Secret or a caller buffer; likewise RFC 8446, not RFC 5869

Out of scope: hkdfExpandLabelHeldInto, Expand-Label of a held Secret PRK, written in place into a Secret or a caller buffer; likewise RFC 8446, not RFC 5869

Out of scope: HkdfScratch, a class holding reusable buffers, not a function; the profile declares functions only

# Test Vectors

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| A.1-PRK | `hkdfExtractSha256(salt = 000102030405060708090a0b0c, IKM = 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b)` | `PRK = 077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5` | R-EXTRACT, R-PRK-LEN | {{Section A.1 of RFC5869}} | RFC 5869 A.1: HKDF-Extract gives the printed PRK |
| A.1-OKM | `hkdfExpandSha256(PRK = 077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5, info = f0f1f2f3f4f5f6f7f8f9, L = 42)` | `OKM = 3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865` | R-T, R-OKM-LEN, R-OKM-FIRST | {{Section A.1 of RFC5869}} | RFC 5869 A.1: HKDF-Expand gives the printed OKM (L = 42) |
| A.2-PRK | `hkdfExtractSha256(salt = 606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeaf, IKM = 000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f)` | `PRK = 06a6b88c5853361a06104c9ceb35b45cef760014904671014a193f40c15fc244` | R-EXTRACT, R-PRK-LEN | {{Section A.2 of RFC5869}} | RFC 5869 A.2: HKDF-Extract gives the printed PRK |
| A.2-OKM | `hkdfExpandSha256(PRK = 06a6b88c5853361a06104c9ceb35b45cef760014904671014a193f40c15fc244, info = b0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff, L = 82)` | `OKM = b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71cc30c58179ec3e87c14c01d5c1f3434f1d87` | R-T, R-OKM-LEN, R-OKM-FIRST | {{Section A.2 of RFC5869}} | RFC 5869 A.2: HKDF-Expand gives the printed OKM (L = 82) |
| A.3-PRK | `hkdfExtractSha256([], IKM = 0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b)` | `PRK = 19ef24a32c717b167f33a91d6f648bdf96596776afdb6377ac434c1c293ccb04` | R-EXTRACT, R-PRK-LEN, R-SALT | {{Section A.3 of RFC5869}} | RFC 5869 A.3: HKDF-Extract gives the printed PRK |
| A.3-OKM | `hkdfExpandSha256(PRK = 19ef24a32c717b167f33a91d6f648bdf96596776afdb6377ac434c1c293ccb04, [], L = 42)` | `OKM = 8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8` | R-T, R-OKM-LEN, R-OKM-FIRST, R-INFO-EMPTY | {{Section A.3 of RFC5869}} | RFC 5869 A.3: HKDF-Expand gives the printed OKM (L = 42) |
