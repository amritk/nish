---
title: "ChaCha20 and Poly1305 for IETF Protocols"
abbrev: nish/crypto/chacha20poly1305
docname: draft-rfc8439-chacha20-poly1305-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-16
keyword:
  - vector-main-RFC8439
author:
  - name: Nish Authors
    org: nish
normative:
  RFC8439:
--- abstract

A profile of RFC 8439 for nish/crypto/chacha20poly1305: the ChaCha20
block and stream functions, Poly1305, its key generation and the
AEAD_CHACHA20_POLY1305 construction. Every requirement quotes RFC 8439, the
main source; every binding sentence of RFC 8439 (MUST, MUST NOT, SHALL, SHALL
NOT, REQUIRED) is tested or excluded here.

--- middle

{::comment}
Copied from vector (https://github.com/amritk/vector), specs/rfc8439-chacha20-poly1305.md at v0.2.1. Copyright (c) 2026 Amrit Kahlon. Used under the MIT License, whose text follows.

MIT License

Copyright (c) 2026 Amrit Kahlon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
{:/comment}

# Introduction

{::boilerplate bcp14-tagged}

nish/crypto/chacha20poly1305 exports each building block of RFC 8439 as well
as the AEAD, so the properties can state the AEAD in terms of them. Each
returns `u8[] | null`, except chacha20QuarterRound, which works on the
`u32[]` ChaCha state and returns `u32[] | null`; the properties test null
only where they say so.

Every test vector of Sections 2.1.1 to 2.8.2 and Appendix A.1 to A.5 is a
row, and each A.1 to A.4 row cites its one `Test Vector #N`. The quarter-round
rows of Sections 2.1.1 and 2.2.1 are over the `u32[]` state; fidelity holds
their state words to the RFC, but not their four word positions, which
`spec check` reports as not checked against the RFC:

- Section 2.1.1 runs the quarter round on four numbers `a`, `b`, `c` and
  `d` and prints no positions at all; 0, 1, 2 and 3 place those numbers in
  the state chacha20QuarterRound takes, and the module exports no
  quarter round on four bare words.
- Section 2.2.1 prints 2, 7, 8 and 13 only in prose and in the line
  `After applying QUARTERROUND(2, 7, 8, 13)` above the result. vector
  0.6.0 cannot cite them: a label may hold a joined group with commas only
  as an alias after `, `, so that line cannot be written as the result's
  label, and a call label pairs an integer only by the name printed before
  it (`c=1`), where these are printed bare.

# Interface

~~~ ts-interface
// module: nish/crypto/chacha20poly1305
export const chacha20QuarterRound = (state: u32[], a: i32, b: i32, c: i32, d: i32): u32[] | null
export const chacha20Block = (key: u8[], counter: u32, nonce: u8[]): u8[] | null
export const chacha20 = (key: u8[], counter: u32, nonce: u8[], data: u8[]): u8[] | null
export const poly1305 = (key: u8[], msg: u8[]): u8[] | null
export const poly1305KeyGen = (key: u8[], nonce: u8[]): u8[] | null
export const chacha20Poly1305Seal = (key: u8[], nonce: u8[], aad: u8[], plaintext: u8[]): u8[] | null
export const chacha20Poly1305Open = (key: u8[], nonce: u8[], aad: u8[], sealed: u8[]): u8[] | null
~~~

# The Quarter Round

> After running a Quarter Round on these four numbers, we get these:
> {{Section 2.1.1 of RFC8439}}
{: #R-QUARTER-ROUND gi="blockquote"}

> We will apply the QUARTERROUND(2, 7, 8, 13) operation to this state.
> {{Section 2.2.1 of RFC8439}}
{: #R-QUARTER-ROUND-STATE gi="blockquote"}

# The ChaCha20 Block Function

> The output is 64 random-looking bytes.
> {{Section 2.3 of RFC8439}}
{: #R-BLOCK gi="blockquote"}

> Words 13-15 are a nonce, which MUST not be repeated for the same key.
> {{Section 2.3 of RFC8439}}
{: gi="blockquote"}

Untested: an obligation on the caller: a pure function cannot see its other invocations

# The ChaCha20 Encryption Algorithm

> ChaCha20 successively calls the ChaCha20 block function, with the same
> key and nonce, and with successively increasing block counter parameters.
> ChaCha20 then serializes the resulting state by writing the numbers in
> little-endian order, creating a keystream block. Concatenating the
> keystream blocks from the successive blocks forms a keystream. The
> ChaCha20 function then performs an XOR of this keystream with the
> plaintext.
> {{Section 2.4 of RFC8439}}
{: #R-STREAM gi="blockquote"}

# The Poly1305 Algorithm

> Poly1305 takes a 32-byte one-time key and a message and produces a 16-byte tag.
> {{Section 2.5 of RFC8439}}
{: #R-POLY gi="blockquote"}

> The pair (r,s) should be unique, and MUST be unpredictable for each invocation (that is why it was originally obtained by encrypting a nonce), while "r" MAY be constant, but needs to be modified as follows before being used: ("r" is treated as a 16-octet little-endian number):
> {{Section 2.5 of RFC8439}}
{: gi="blockquote"}

Untested: the AEAD derives (r,s) per invocation from key and nonce (P-KEYGEN-IS-BLOCK0, P-TAG-IS-POLY1305); unpredictability is a property of the key, which no functional test observes

# Generating the Poly1305 Key Using ChaCha20

> We take the first 256 bits of the serialized state, and use those as the one- time Poly1305 key
> {{Section 2.6 of RFC8439}}
{: #R-KEYGEN gi="blockquote"}

> Any document that specifies the use of Poly1305 as a MAC algorithm for some protocol MUST specify that 256 bits are allocated for the integrity key.
> {{Section 2.6 of RFC8439}}
{: gi="blockquote"}

Untested: an obligation on protocol specifications, not on this module

> This MUST be unique per invocation with the same key, so it MUST NOT be randomly generated.
> {{Section 2.6 of RFC8439}}
{: gi="blockquote"}

Untested: nonce management is the caller's

# AEAD Construction

> First, a Poly1305 one-time key is generated from the 256-bit key and nonce using the procedure described in Section 2.6.
> {{Section 2.8 of RFC8439}}
{: #R-OTK gi="blockquote"}

> Next, the ChaCha20 encryption function is called to encrypt the plaintext, using the same key and nonce, and with the initial counter set to 1.
> {{Section 2.8 of RFC8439}}
{: #R-CTR1 gi="blockquote"}

> padding1 -- the padding is up to 15 zero bytes, and it brings the total length so far to an integral multiple of 16.
> {{Section 2.8 of RFC8439}}
{: #R-PAD gi="blockquote"}

> The length of the additional data in octets (as a 64-bit little-endian integer). \* The length of the ciphertext in octets (as a 64-bit little- endian integer).
> {{Section 2.8 of RFC8439}}
{: #R-MAC-INPUT gi="blockquote"}

> A ciphertext of the same length as the plaintext. o A 128-bit tag, which is the output of the Poly1305 function.
> {{Section 2.8 of RFC8439}}
{: #R-OUTPUT gi="blockquote"}

> The roles of ciphertext and plaintext are reversed, so the ChaCha20 encryption function is applied to the ciphertext, producing the plaintext.
> {{Section 2.8 of RFC8439}}
{: #R-DECRYPT gi="blockquote"}

> The calculated tag is bitwise compared to the received tag. The message is authenticated if and only if the tags match.
> {{Section 2.8 of RFC8439}}
{: #R-AUTH gi="blockquote"}

> K\_LEN (key length) is 32 octets.
> {{Section 2.8 of RFC8439}}
{: #R-K-LEN gi="blockquote"}

> N\_MIN = N\_MAX = 12 octets.
> {{Section 2.8 of RFC8439}}
{: #R-N-LEN gi="blockquote"}

# Security Considerations

> Additionally, any protocol using this algorithm MUST include the complete tag to minimize the opportunity for forgery.
> {{Section 4 of RFC8439}}
{: #R-FULL-TAG gi="blockquote"}

> Tag truncation MUST NOT be done.
> {{Section 4 of RFC8439}}
{: #R-NO-TRUNCATION gi="blockquote"}

> The Poly1305 key MUST be unpredictable to an attacker.
> {{Section 4 of RFC8439}}
{: gi="blockquote"}

Untested: key management is the caller's

> For this reason, with online protocols, implementation MUST use a constant-time comparison function rather than relying on optimized but insecure library functions such as the C language's memcmp().
> {{Section 4 of RFC8439}}
{: gi="blockquote"}

Untested: timing is not observable by a functional test; nish checks it on the emitted machine code (tests/cases/ct\_asm\_chacha20poly1305.ts, docs/security/crypto-aead.md)

# Out of Scope

Out of scope: chacha20HeaderMask, QUIC header protection, specified by RFC 9001, not by RFC 8439

# Properties

~~~ ts-property
// P-BLOCK-64 covers R-BLOCK — the block function outputs 64 bytes for any counter
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */, counter: i32 /* 0..2147483647 */) =>
  unwrap(chacha20Block(key, counter, nonce)).length === 64
~~~

~~~ ts-property
// P-KEYSTREAM covers R-STREAM — ChaCha20 of zeros is the blocks for counter, counter+1 serialized end to end, cut to length
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */, counter: i32 /* 0..100000 */, n: i32 /* 0..128 */) =>
  unwrap(chacha20(key, counter, nonce, zeros(n))) === unwrap(chacha20Block(key, counter, nonce)).concat(unwrap(chacha20Block(key, counter + 1, nonce))).slice(0, n)
~~~

~~~ ts-property
// P-XOR-INVOLUTION covers R-STREAM — ChaCha20 is an XOR stream: applying it twice gives the plaintext back, length kept
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */, counter: i32 /* 0..100000 */, pt: u8[] /* 0..300 */) =>
  unwrap(chacha20(key, counter, nonce, pt)).length === pt.length && unwrap(chacha20(key, counter, nonce, unwrap(chacha20(key, counter, nonce, pt)))) === pt
~~~

~~~ ts-property
// P-POLY-16 covers R-POLY — Poly1305 takes a 32-byte key and any message and gives a 16-byte tag
forall (otk: u8[] /* 32..32 */, msg: u8[] /* 0..300 */) =>
  unwrap(poly1305(otk, msg)).length === 16
~~~

~~~ ts-property
// P-KEYGEN-IS-BLOCK0 covers R-KEYGEN — the one-time key is the first 32 bytes of block 0
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */) =>
  poly1305KeyGen(key, nonce) === unwrap(chacha20Block(key, 0, nonce)).slice(0, 32)
~~~

~~~ ts-property
// P-SEAL-SHAPE covers R-OUTPUT, R-FULL-TAG — the sealed output is a ciphertext as long as the plaintext plus a 16-byte tag
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */, aad: u8[] /* 0..80 */, pt: u8[] /* 0..300 */) =>
  unwrap(chacha20Poly1305Seal(key, nonce, aad, pt)).length === pt.length + 16
~~~

~~~ ts-property
// P-CT-IS-CHACHA20 covers R-CTR1 — the ciphertext is ChaCha20 under the same key and nonce from counter 1
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */, aad: u8[] /* 0..40 */, pt: u8[] /* 0..300 */) =>
  unwrap(chacha20Poly1305Seal(key, nonce, aad, pt)).slice(0, pt.length) === unwrap(chacha20(key, 1, nonce, pt))
~~~

~~~ ts-property
// P-TAG-IS-POLY1305 covers R-OTK, R-MAC-INPUT, R-PAD — the tag is Poly1305 under the one-time key over AAD, pad, ciphertext, pad and both lengths
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */, aad: u8[] /* 0..80 */, pt: u8[] /* 0..300 */) =>
  { const sealed = unwrap(chacha20Poly1305Seal(key, nonce, aad, pt)); const ct = sealed.slice(0, pt.length); return sealed.slice(pt.length, pt.length + 16) === unwrap(poly1305(unwrap(poly1305KeyGen(key, nonce)), aad.concat(zeros((16 - aad.length % 16) % 16)).concat(ct).concat(zeros((16 - ct.length % 16) % 16)).concat(le64(aad.length)).concat(le64(pt.length)))); }
~~~

~~~ ts-property
// P-ROUNDTRIP covers R-DECRYPT — opening what was sealed gives the plaintext back
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */, aad: u8[] /* 0..80 */, pt: u8[] /* 0..300 */) =>
  chacha20Poly1305Open(key, nonce, aad, unwrap(chacha20Poly1305Seal(key, nonce, aad, pt))) === pt
~~~

~~~ ts-property
// P-TAMPER-SEALED covers R-AUTH — flipping any one bit of the ciphertext or tag is refused
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */, aad: u8[] /* 0..40 */, pt: u8[] /* 0..100 */, bit: i32 /* 0..927 */) =>
  chacha20Poly1305Open(key, nonce, aad, flipBit(unwrap(chacha20Poly1305Seal(key, nonce, aad, pt)), bit)) === null
where bit < 8 * (pt.length + 16)
~~~

~~~ ts-property
// P-TAMPER-AAD covers R-AUTH — flipping any one bit of the AAD is refused
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */, aad: u8[] /* 1..40 */, pt: u8[] /* 0..100 */, bit: i32 /* 0..319 */) =>
  chacha20Poly1305Open(key, nonce, flipBit(aad, bit), unwrap(chacha20Poly1305Seal(key, nonce, aad, pt))) === null
where bit < 8 * aad.length
~~~

~~~ ts-property
// P-NO-TRUNCATION covers R-NO-TRUNCATION, R-FULL-TAG — a sealed message missing any part of its tag is refused
forall (key: u8[] /* 32..32 */, nonce: u8[] /* 12..12 */, aad: u8[] /* 0..40 */, pt: u8[] /* 0..100 */, cut: i32 /* 1..16 */) =>
  { const sealed = unwrap(chacha20Poly1305Seal(key, nonce, aad, pt)); return chacha20Poly1305Open(key, nonce, aad, sealed.slice(0, sealed.length - cut)) === null; }
~~~

~~~ ts-property
// P-SIZES covers R-K-LEN, R-N-LEN — a key other than 32 octets or a nonce other than 12 is refused
forall (key: u8[] /* 0..40 */, nonce: u8[] /* 0..16 */) =>
  (key.length === 32 && nonce.length === 12) === (chacha20Poly1305Seal(key, nonce, [], []) !== null)
~~~

# Test Vectors

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| 2.1.1-QUARTER-ROUND | `chacha20QuarterRound([0x11111111 0x01020304 0x9b8d6f43 0x01234567], 0, 1, 2, 3)` | `[0xea2a92f4 0xcb1cf8ce 0x4581472e 0x5881c4bb]` | R-QUARTER-ROUND | {{Section 2.1.1 of RFC8439}} | RFC 8439 2.1.1: a quarter round on four numbers |
| 2.2.1-QUARTER-ROUND-STATE | `chacha20QuarterRound(Sample ChaCha State = [879531e0 c5ecf37d 516461b1 c9a62f8a 44c20ef3 3390af7f d9fc690b 2a5f714c 53372767 b00a5631 974c541a 359e9963 5c971061 3d631689 2098d9d6 91dbd320], 2, 7, 8, 13)` | `[879531e0 c5ecf37d bdb886dc c9a62f8a 44c20ef3 3390af7f d9fc690b cfacafd2 e46bea80 b00a5631 974c541a 359e9963 5c971061 ccc07c79 2098d9d6 91dbd320]` | R-QUARTER-ROUND-STATE | {{Section 2.2.1 of RFC8439}} | RFC 8439 2.2.1: QUARTERROUND(2, 7, 8, 13) on the ChaCha state |
| 2.3.2-BLOCK | `chacha20Block(Key = 000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f, Block Count = 1, Nonce = 000000090000004a00000000)` | `Serialized Block = 10f1e7e4d13b5915500fdd1fa32071c4c7d1f4c733c068030422aa9ac3d46c4ed2826446079faa0914c2d705d98b02a2b5129cd1de164eb9cbd083e8a2503c4e` | R-BLOCK | {{Section 2.3.2 of RFC8439}} | RFC 8439 2.3.2: the ChaCha20 block function's serialized block |
| 2.4.2-ENCRYPT | `chacha20(Key = 000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f, Initial Counter = 1, Nonce = 000000000000004a00000000, Plaintext Sunscreen = 4c616469657320616e642047656e746c656d656e206f662074686520636c617373206f66202739393a204966204920636f756c64206f6666657220796f75206f6e6c79206f6e652074697020666f7220746865206675747572652c2073756e73637265656e20776f756c642062652069742e)` | `Ciphertext Sunscreen = 6e2e359a2568f98041ba0728dd0d6981e97e7aec1d4360c20a27afccfd9fae0bf91b65c5524733ab8f593dabcd62b3571639d624e65152ab8f530c359f0861d807ca0dbf500d6a6156a38e088a22b65e52bc514d16ccf806818ce91ab77937365af90bbf74a35be6b40b8eedf2785e42874d` | R-STREAM | {{Section 2.4.2 of RFC8439}} | RFC 8439 2.4.2: ChaCha20 encrypts the sunscreen plaintext |
| 2.5.2-POLY1305 | `poly1305(Key Material = 85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b, Message to be Authenticated = 43727970746f6772617068696320466f72756d2052657365617263682047726f7570)` | `Tag = a8061dc1305136c6c22b8baf0c0127a9` | R-POLY | {{Section 2.5.2 of RFC8439}} | RFC 8439 2.5.2: Poly1305 tags the message |
| 2.6.2-KEYGEN | `poly1305KeyGen(Key = 808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f, Nonce = 000000000001020304050607)` | `Output bytes = 8ad5a08b905f81cc815040274ab29471a833b637e3fd0da508dbb8e2fdd1a646` | R-KEYGEN | {{Section 2.6.2 of RFC8439}} | RFC 8439 2.6.2: the Poly1305 one-time key |
| 2.8.2-SEAL | `chacha20Poly1305Seal(Key = 808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f, concat(32-bit fixed-common part = 07000000, IV = 4041424344454647), AAD = 50515253c0c1c2c3c4c5c6c7, Plaintext = 4c616469657320616e642047656e746c656d656e206f662074686520636c617373206f66202739393a204966204920636f756c64206f6666657220796f75206f6e6c79206f6e652074697020666f7220746865206675747572652c2073756e73637265656e20776f756c642062652069742e)` | `concat(Ciphertext = d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc3ff4def08e4b7a9de576d26586cec64b6116, Tag = 1ae10b594f09e26a7e902ecbd0600691)` | R-OTK, R-CTR1, R-MAC-INPUT, R-OUTPUT, R-FULL-TAG | {{Section 2.8.2 of RFC8439}} | RFC 8439 2.8.2: AEAD_CHACHA20_POLY1305 seals to the printed ciphertext and tag |
| A.5-OPEN | `chacha20Poly1305Open(The ChaCha20 Key = 1c9240a5eb55d38af333888604f6b5f0473917c1402b80099dca5cbc207075c0, The nonce = 000000000102030405060708, The AAD = f33388860000000000004e91, concat(Ciphertext = 64a0861575861af460f062c79be643bd5e805cfd345cf389f108670ac76c8cb24c6cfc18755d43eea09ee94e382d26b0bdb7b73c321b0100d4f03b7f355894cf332f830e710b97ce98c8a84abd0b948114ad176e008d33bd60f982b1ff37c8559797a06ef4f0ef61c186324e2b3506383606907b6a7c02b0f9f6157b53c867e4b9166c767b804d46a59b5216cde7a4e99040c5a40433225ee282a1b0a06c523eaf4534d7f83fa1155b0047718cbc546a0d072b04b3564eea1b422273f548271a0bb2316053fa76991955ebd63159434ecebb4e466dae5a1073a6727627097a1049e617d91d361094fa68f0ff77987130305beaba2eda04df997b714d6c6f2c29a6ad5cb4022b02709b, Received Tag = eead9d67890cbb22392336fea1851f38))` | `Plaintext = 496e7465726e65742d4472616674732061726520647261667420646f63756d656e74732076616c696420666f722061206d6178696d756d206f6620736978206d6f6e74687320616e64206d617920626520757064617465642c207265706c616365642c206f72206f62736f6c65746564206279206f7468657220646f63756d656e747320617420616e792074696d652e20497420697320696e617070726f70726961746520746f2075736520496e7465726e65742d447261667473206173207265666572656e6365206d6174657269616c206f7220746f2063697465207468656d206f74686572207468616e206173202fe2809c776f726b20696e2070726f67726573732e2fe2809d` | R-DECRYPT, R-AUTH | {{Section A.5 of RFC8439}} | RFC 8439 A.5: AEAD decryption of the Internet-Drafts message |
| A.5-KEYGEN | `poly1305KeyGen(The ChaCha20 Key = 1c9240a5eb55d38af333888604f6b5f0473917c1402b80099dca5cbc207075c0, The nonce = 000000000102030405060708)` | `Poly1305 one-time key = bdf04aa95ce4de8995b14bb6a18fecaf26478f50c054f563dbc0a21e261572aa` | R-KEYGEN | {{Section A.5 of RFC8439}} | RFC 8439 A.5: the one-time key for the decryption example |
| A.5-POLY1305 | `poly1305(Poly1305 one-time key = bdf04aa95ce4de8995b14bb6a18fecaf26478f50c054f563dbc0a21e261572aa, Poly1305 Input = f33388860000000000004e910000000064a0861575861af460f062c79be643bd5e805cfd345cf389f108670ac76c8cb24c6cfc18755d43eea09ee94e382d26b0bdb7b73c321b0100d4f03b7f355894cf332f830e710b97ce98c8a84abd0b948114ad176e008d33bd60f982b1ff37c8559797a06ef4f0ef61c186324e2b3506383606907b6a7c02b0f9f6157b53c867e4b9166c767b804d46a59b5216cde7a4e99040c5a40433225ee282a1b0a06c523eaf4534d7f83fa1155b0047718cbc546a0d072b04b3564eea1b422273f548271a0bb2316053fa76991955ebd63159434ecebb4e466dae5a1073a6727627097a1049e617d91d361094fa68f0ff77987130305beaba2eda04df997b714d6c6f2c29a6ad5cb4022b02709b000000000000000c000000000000000901000000000000)` | `Calculated Tag = eead9d67890cbb22392336fea1851f38` | R-POLY, R-MAC-INPUT | {{Section A.5 of RFC8439}} | RFC 8439 A.5: Poly1305 over the printed AEAD buffer gives the received tag |
| A.1-BLOCK-1 | `chacha20Block(Key = 0000000000000000000000000000000000000000000000000000000000000000, Block Counter = 0, Nonce = 000000000000000000000000)` | `Keystream = 76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7da41597c5157488d7724e03fb8d84a376a43b8f41518a11cc387b669b2ee6586` | R-BLOCK | {{Section A.1 of RFC8439}}, Test Vector #1 | RFC 8439 A.1 Test Vector #1: the ChaCha20 block function |
| A.1-BLOCK-2 | `chacha20Block(Key = 0000000000000000000000000000000000000000000000000000000000000000, Block Counter = 1, Nonce = 000000000000000000000000)` | `Keystream = 9f07e7be5551387a98ba977c732d080dcb0f29a048e3656912c6533e32ee7aed29b721769ce64e43d57133b074d839d531ed1f28510afb45ace10a1f4b794d6f` | R-BLOCK | {{Section A.1 of RFC8439}}, Test Vector #2 | RFC 8439 A.1 Test Vector #2: the ChaCha20 block function |
| A.1-BLOCK-3 | `chacha20Block(Key = 0000000000000000000000000000000000000000000000000000000000000001, Block Counter = 1, Nonce = 000000000000000000000000)` | `Keystream = 3aeb5224ecf849929b9d828db1ced4dd832025e8018b8160b82284f3c949aa5a8eca00bbb4a73bdad192b5c42f73f2fd4e273644c8b36125a64addeb006c13a0` | R-BLOCK | {{Section A.1 of RFC8439}}, Test Vector #3 | RFC 8439 A.1 Test Vector #3: the ChaCha20 block function |
| A.1-BLOCK-4 | `chacha20Block(Key = 00ff000000000000000000000000000000000000000000000000000000000000, Block Counter = 2, Nonce = 000000000000000000000000)` | `Keystream = 72d54dfbf12ec44b362692df94137f328fea8da73990265ec1bbbea1ae9af0ca13b25aa26cb4a648cb9b9d1be65b2c0924a66c54d545ec1b7374f4872e99f096` | R-BLOCK | {{Section A.1 of RFC8439}}, Test Vector #4 | RFC 8439 A.1 Test Vector #4: the ChaCha20 block function |
| A.1-BLOCK-5 | `chacha20Block(Key = 0000000000000000000000000000000000000000000000000000000000000000, Block Counter = 0, Nonce = 000000000000000000000002)` | `Keystream = c2c64d378cd536374ae204b9ef933fcd1a8b2288b3dfa49672ab765b54ee27c78a970e0e955c14f3a88e741b97c286f75f8fc299e8148362fa198a39531bed6d` | R-BLOCK | {{Section A.1 of RFC8439}}, Test Vector #5 | RFC 8439 A.1 Test Vector #5: the ChaCha20 block function |
| A.2-ENCRYPT-1 | `chacha20(Key = 0000000000000000000000000000000000000000000000000000000000000000, Initial Block Counter = 0, Nonce = 000000000000000000000000, Plaintext = 00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000)` | `Ciphertext = 76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7da41597c5157488d7724e03fb8d84a376a43b8f41518a11cc387b669b2ee6586` | R-STREAM | {{Section A.2 of RFC8439}}, Test Vector #1 | RFC 8439 A.2 Test Vector #1: ChaCha20 encryption |
| A.2-ENCRYPT-2 | `chacha20(Key = 0000000000000000000000000000000000000000000000000000000000000001, Initial Block Counter = 1, Nonce = 000000000000000000000002, Plaintext = 416e79207375626d697373696f6e20746f20746865204945544620696e74656e6465642062792074686520436f6e7472696275746f7220666f72207075626c69636174696f6e20617320616c6c206f722070617274206f6620616e204945544620496e7465726e65742d4472616674206f722052464320616e6420616e792073746174656d656e74206d6164652077697468696e2074686520636f6e74657874206f6620616e204945544620616374697669747920697320636f6e7369646572656420616e20224945544620436f6e747269627574696f6e222e20537563682073746174656d656e747320696e636c756465206f72616c2073746174656d656e747320696e20494554462073657373696f6e732c2061732077656c6c206173207772697474656e20616e6420656c656374726f6e696320636f6d6d756e69636174696f6e73206d61646520617420616e792074696d65206f7220706c6163652c207768696368206172652061646472657373656420746f)` | `Ciphertext = a3fbf07df3fa2fde4f376ca23e82737041605d9f4f4f57bd8cff2c1d4b7955ec2a97948bd3722915c8f3d337f7d370050e9e96d647b7c39f56e031ca5eb6250d4042e02785ececfa4b4bb5e8ead0440e20b6e8db09d881a7c6132f420e52795042bdfa7773d8a9051447b3291ce1411c680465552aa6c405b7764d5e87bea85ad00f8449ed8f72d0d662ab052691ca66424bc86d2df80ea41f43abf937d3259dc4b2d0dfb48a6c9139ddd7f76966e928e635553ba76c5c879d7b35d49eb2e62b0871cdac638939e25e8a1e0ef9d5280fa8ca328b351c3c765989cbcf3daa8b6ccc3aaf9f3979c92b3720fc88dc95ed84a1be059c6499b9fda236e7e818b04b0bc39c1e876b193bfe5569753f88128cc08aaa9b63d1a16f80ef2554d7189c411f5869ca52c5b83fa36ff216b9c1d30062bebcfd2dc5bce0911934fda79a86f6e698ced759c3ff9b6477338f3da4f9cd8514ea9982ccafb341b2384dd902f3d1ab7ac61dd29c6f21ba5b862f3730e37cfdc4fd806c22f221` | R-STREAM | {{Section A.2 of RFC8439}}, Test Vector #2 | RFC 8439 A.2 Test Vector #2: ChaCha20 encryption |
| A.2-ENCRYPT-3 | `chacha20(Key = 1c9240a5eb55d38af333888604f6b5f0473917c1402b80099dca5cbc207075c0, Initial Block Counter = 42, Nonce = 000000000000000000000002, Plaintext = 2754776173206272696c6c69672c20616e642074686520736c6974687920746f7665730a446964206779726520616e642067696d626c6520696e2074686520776162653a0a416c6c206d696d737920776572652074686520626f726f676f7665732c0a416e6420746865206d6f6d65207261746873206f757467726162652e)` | `Ciphertext = 62e6347f95ed87a45ffae7426f27a1df5fb69110044c0d73118effa95b01e5cf166d3df2d721caf9b21e5fb14c616871fd84c54f9d65b283196c7fe4f60553ebf39c6402c42234e32a356b3e764312a61a5532055716ead6962568f87d3f3f7704c6a8d1bcd1bf4d50d6154b6da731b187b58dfd728afa36757a797ac188d1` | R-STREAM | {{Section A.2 of RFC8439}}, Test Vector #3 | RFC 8439 A.2 Test Vector #3: ChaCha20 encryption |
| A.4-KEYGEN-1 | `poly1305KeyGen(The ChaCha20 Key = 0000000000000000000000000000000000000000000000000000000000000000, The nonce = 000000000000000000000000)` | `Poly1305 one-time key = 76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7` | R-KEYGEN | {{Section A.4 of RFC8439}}, Test Vector #1 | RFC 8439 A.4 Test Vector #1: the Poly1305 one-time key |
| A.4-KEYGEN-2 | `poly1305KeyGen(The ChaCha20 Key = 0000000000000000000000000000000000000000000000000000000000000001, The nonce = 000000000000000000000002)` | `Poly1305 one-time key = ecfa254f845f647473d3cb140da9e87606cb33066c447b87bc2666dde3fbb739` | R-KEYGEN | {{Section A.4 of RFC8439}}, Test Vector #2 | RFC 8439 A.4 Test Vector #2: the Poly1305 one-time key |
| A.4-KEYGEN-3 | `poly1305KeyGen(The ChaCha20 Key = 1c9240a5eb55d38af333888604f6b5f0473917c1402b80099dca5cbc207075c0, The nonce = 000000000000000000000002)` | `Poly1305 one-time key = 965e3bc6f9ec7ed9560808f4d229f94b137ff275ca9b3fcbdd59deaad23310ae` | R-KEYGEN | {{Section A.4 of RFC8439}}, Test Vector #3 | RFC 8439 A.4 Test Vector #3: the Poly1305 one-time key |
| A.3-POLY1305-1 | `poly1305(One-time Poly1305 Key = 0000000000000000000000000000000000000000000000000000000000000000, Text to MAC = 00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000)` | `Tag = 00000000000000000000000000000000` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #1 | RFC 8439 A.3 Test Vector #1: the Poly1305 tag |
| A.3-POLY1305-2 | `poly1305(One-time Poly1305 Key = 0000000000000000000000000000000036e5f6b5c5e06070f0efca96227a863e, Text to MAC = 416e79207375626d697373696f6e20746f20746865204945544620696e74656e6465642062792074686520436f6e7472696275746f7220666f72207075626c69636174696f6e20617320616c6c206f722070617274206f6620616e204945544620496e7465726e65742d4472616674206f722052464320616e6420616e792073746174656d656e74206d6164652077697468696e2074686520636f6e74657874206f6620616e204945544620616374697669747920697320636f6e7369646572656420616e20224945544620436f6e747269627574696f6e222e20537563682073746174656d656e747320696e636c756465206f72616c2073746174656d656e747320696e20494554462073657373696f6e732c2061732077656c6c206173207772697474656e20616e6420656c656374726f6e696320636f6d6d756e69636174696f6e73206d61646520617420616e792074696d65206f7220706c6163652c207768696368206172652061646472657373656420746f)` | `Tag = 36e5f6b5c5e06070f0efca96227a863e` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #2 | RFC 8439 A.3 Test Vector #2: the Poly1305 tag |
| A.3-POLY1305-3 | `poly1305(One-time Poly1305 Key = 36e5f6b5c5e06070f0efca96227a863e00000000000000000000000000000000, Text to MAC = 416e79207375626d697373696f6e20746f20746865204945544620696e74656e6465642062792074686520436f6e7472696275746f7220666f72207075626c69636174696f6e20617320616c6c206f722070617274206f6620616e204945544620496e7465726e65742d4472616674206f722052464320616e6420616e792073746174656d656e74206d6164652077697468696e2074686520636f6e74657874206f6620616e204945544620616374697669747920697320636f6e7369646572656420616e20224945544620436f6e747269627574696f6e222e20537563682073746174656d656e747320696e636c756465206f72616c2073746174656d656e747320696e20494554462073657373696f6e732c2061732077656c6c206173207772697474656e20616e6420656c656374726f6e696320636f6d6d756e69636174696f6e73206d61646520617420616e792074696d65206f7220706c6163652c207768696368206172652061646472657373656420746f)` | `Tag = f3477e7cd95417af89a6b8794c310cf0` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #3 | RFC 8439 A.3 Test Vector #3: the Poly1305 tag |
| A.3-POLY1305-4 | `poly1305(One-time Poly1305 Key = 1c9240a5eb55d38af333888604f6b5f0473917c1402b80099dca5cbc207075c0, Text to MAC = 2754776173206272696c6c69672c20616e642074686520736c6974687920746f7665730a446964206779726520616e642067696d626c6520696e2074686520776162653a0a416c6c206d696d737920776572652074686520626f726f676f7665732c0a416e6420746865206d6f6d65207261746873206f757467726162652e)` | `Tag = 4541669a7eaaee61e708dc7cbcc5eb62` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #4 | RFC 8439 A.3 Test Vector #4: the Poly1305 tag |
| A.3-POLY1305-5 | `poly1305(concat(R = 02000000000000000000000000000000, S = 00000000000000000000000000000000), data = ffffffffffffffffffffffffffffffff)` | `tag = 03000000000000000000000000000000` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #5 | RFC 8439 A.3 Test Vector #5: the Poly1305 tag |
| A.3-POLY1305-6 | `poly1305(concat(R = 02000000000000000000000000000000, S = ffffffffffffffffffffffffffffffff), data = 02000000000000000000000000000000)` | `tag = 03000000000000000000000000000000` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #6 | RFC 8439 A.3 Test Vector #6: the Poly1305 tag |
| A.3-POLY1305-7 | `poly1305(concat(R = 01000000000000000000000000000000, S = 00000000000000000000000000000000), data = fffffffffffffffffffffffffffffffff0ffffffffffffffffffffffffffffff11000000000000000000000000000000)` | `tag = 05000000000000000000000000000000` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #7 | RFC 8439 A.3 Test Vector #7: the Poly1305 tag |
| A.3-POLY1305-8 | `poly1305(concat(R = 01000000000000000000000000000000, S = 00000000000000000000000000000000), data = fffffffffffffffffffffffffffffffffbfefefefefefefefefefefefefefefe01010101010101010101010101010101)` | `tag = 00000000000000000000000000000000` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #8 | RFC 8439 A.3 Test Vector #8: the Poly1305 tag |
| A.3-POLY1305-9 | `poly1305(concat(R = 02000000000000000000000000000000, S = 00000000000000000000000000000000), data = fdffffffffffffffffffffffffffffff)` | `tag = faffffffffffffffffffffffffffffff` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #9 | RFC 8439 A.3 Test Vector #9: the Poly1305 tag |
| A.3-POLY1305-10 | `poly1305(concat(R = 01000000000000000400000000000000, S = 00000000000000000000000000000000), data = e33594d7505e43b900000000000000003394d7505e4379cd01000000000000000000000000000000000000000000000001000000000000000000000000000000)` | `tag = 14000000000000005500000000000000` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #10 | RFC 8439 A.3 Test Vector #10: the Poly1305 tag |
| A.3-POLY1305-11 | `poly1305(concat(R = 01000000000000000400000000000000, S = 00000000000000000000000000000000), data = e33594d7505e43b900000000000000003394d7505e4379cd010000000000000000000000000000000000000000000000)` | `tag = 13000000000000000000000000000000` | R-POLY | {{Section A.3 of RFC8439}}, Test Vector #11 | RFC 8439 A.3 Test Vector #11: the Poly1305 tag |
