---
title: "Deterministic ECDSA on P-256 with SHA-256"
abbrev: nish/crypto/p256
docname: draft-rfc6979-p256-ecdsa-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-21
keyword:
  - vector-main-RFC6979
author:
  - name: Nish Authors
    org: nish
normative:
  RFC6979:

--- abstract

A profile of RFC 6979 for the ECDSA functions of nish/crypto/p256:
deterministic ECDSA on NIST P-256, with SHA-256 for the message and
HMAC-SHA-256 for the nonce, and the public key computed from the private key.
Every requirement quotes RFC 6979, the main source; every binding sentence of
RFC 6979 (MUST, MUST NOT, SHALL, SHALL NOT, REQUIRED) is tested or excluded
here.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

nish/crypto/p256 signs with ECDSA on P-256 (RFC 6979 Section A.2.5's curve)
and draws the nonce k by RFC 6979 Section 3.2 with HMAC-SHA-256. The private
key x is 32 big-endian octets, taken as a `Secret`; the properties see it as
bytes. The public key U = xG is the 65-octet uncompressed point, 04, then Ux
and Uy as 32 big-endian octets each. A signature is the 64 octets r, then s,
each 32 big-endian octets. `p256Sign` and `p256Verify` take the message's
hash; `p256SignSha256` and `p256VerifySha256` take the message and hash it
with SHA-256. Key generation and signing return `u8[] | null`, null for a
private key outside [1, q-1]; verification returns a boolean.

Out of scope: p256Ecdh, Diffie-Hellman on P-256 (SEC 1 Section 3.3.1), which RFC 6979 does not describe

Out of scope: p256SignSha256Into, the same signature as p256SignSha256 written into a caller's array through a P256SignScratch, held by tests/link/crypto\_p256; its message is a (msg, off, len) `/* window */` and its (out, at) an `/* out 64 */` write, but its first parameter is the class P256SignScratch, which vector 0.6.0 refuses in a ts-interface block ("`P256SignScratch` is not a ts-interface type; use u8[], string, boolean, i8, i16, i32, i64, u8, u16, u32, u64, f64, Secret<u8[]>, u16[], u32[], u64[], each optionally `| null`"), and it answers a boolean where an `/* out CAP */` write returns the end offset

Out of scope: P256SignScratch, the reusable scratch of p256SignSha256Into, a class and not a function

Out of scope: P256\_SCALAR\_SIZE, an `i32` constant a vector or property cannot call; every property draws a 32-octet private key

Out of scope: P256\_POINT\_SIZE, an `i32` constant a vector or property cannot call; P-PUB-FORM holds the 65-octet public key

Out of scope: P256\_SIGNATURE\_SIZE, an `i32` constant a vector or property cannot call; P-SIG-FORM holds the 64-octet signature

# Interface

~~~ ts-interface
// module: nish/crypto/p256
export const p256PublicKey = (priv: Secret<u8[]>): u8[] | null
export const p256Sign = (priv: Secret<u8[]>, digest: u8[]): u8[] | null
export const p256Verify = (pub: u8[], digest: u8[], sig: u8[]): boolean
export const p256SignSha256 = (priv: Secret<u8[]>, msg: u8[]): u8[] | null
export const p256VerifySha256 = (pub: u8[], msg: u8[], sig: u8[]): boolean
// module: nish/crypto/sha256
export const sha256 = (data: u8[]): u8[]
~~~

# Compatibility

> Produced signatures remain fully compatible with plain DSA and ECDSA.
> {{Section 1 of RFC6979}}
{: #R-COMPAT gi="blockquote"}

# Key Pairs

> The relevant standards prescribe that x shall not be 0; hence, x is an integer in the range [1, q-1].
> {{Section 2.2 of RFC6979}}
{: #R-PRIV-RANGE gi="blockquote"}

> For ECDSA, the public key is the curve point: U = xG
> {{Section 2.2 of RFC6979}}
{: #R-PUB gi="blockquote"}

# Bits and Integers

> if qlen < blen, then the qlen leftmost bits are kept, and subsequent bits are discarded;
> {{Section 2.3.2 of RFC6979}}
{: #R-TRUNCATE gi="blockquote"}

> otherwise, qlen-blen bits (of value zero) are added to the left of the sequence (i.e., before the input bits in the sequence order).
> {{Section 2.3.2 of RFC6979}}
{: #R-EXPAND gi="blockquote"}

> bits2int is used during signature generation and verification in standard DSA and ECDSA to transform a hash value (computed over the input message) into an integer modulo q.
> {{Section 2.3.5 of RFC6979}}
{: #R-BITS2INT gi="blockquote"}

# Signature Generation

> The message is first processed by H, yielding the value H(m), which is a sequence of bits of length hlen.
> {{Section 2.4 of RFC6979}}
{: #R-HASH gi="blockquote"}

> The pair (r, s) is the signature.
> {{Section 2.4 of RFC6979}}
{: #R-SIG-PAIR gi="blockquote"}

# Deterministic ECDSA

> Deterministic (EC)DSA is the process of generating an (EC)DSA signature over an input message m by using the standard (EC)DSA signature generation process (discussed in the previous section), except that the value k, instead of being randomly generated, is obtained through the process described in this section.
> {{Section 3 of RFC6979}}
{: #R-DETERMINISTIC gi="blockquote"}

> Here, we use HMAC with the same hash function H as the one used to process the input message prior to signature generation or verification.
> {{Section 3.1.1 of RFC6979}}
{: #R-HMAC-H gi="blockquote"}

> The entropy of that additional data SHALL be at least n bits, preferably n+64 bits or more, where n is the target security level.
> {{Section 3.6 of RFC6979}}
{: gi="blockquote"}

Untested: a variant nish does not implement: the nonce is drawn from the private key and the digest alone, with no additional secret data

# Sample Code

> The private key * MUST be set before generating the signature itself, but message * data can be input before setting the key.
> {{Section A.3 of RFC6979}}
{: gi="blockquote"}

Untested: a comment in the Java sample code, on the order of calls to its class; nish/crypto/p256 takes the private key and the message in one call

> {@link #setPrivateKey} MUST have * been called.
> {{Section A.3 of RFC6979}}
{: gi="blockquote"}

Untested: a comment on the sample code's sign(); nish/crypto/p256 takes the private key and the message in one call

> {@link #setPrivateKey} MUST * have been called.
> {{Section A.3 of RFC6979}}
{: gi="blockquote"}

Untested: a comment on the sample code's signHash(); nish/crypto/p256 takes the private key and the digest in one call

# Test Vectors

> The two input messages are the UTF-8 encoding of the strings "sample" and "test" (without the quotes), of length 48 and 32 bits, respectively.
> {{Section A.2 of RFC6979}}
{: #R-MESSAGES gi="blockquote"}

# Out of Scope

Section A.2.5 prints ten signatures under one key: the messages "sample"
and "test", each with SHA-1, SHA-224, SHA-256, SHA-384 and SHA-512. Only
the two SHA-256 signatures are vectors here. The other eight draw k with
HMAC over the same hash as the message (Section 3.1.1), and nish's nonce is
always HMAC-SHA-256 whatever the digest, so `p256Sign` cannot give them: no
export of nish/crypto/p256 signs with the nonce of SHA-1, SHA-224, SHA-384
or SHA-512. Their verification by `p256Verify` is not a vector either: its
digest argument is H(m), which Section A.2.5 does not print, and vector
0.6.0 has no Call literal for a value computed from a printed one (a
`sha384("sample")` argument), so such a row cites nothing for its digest.

For the same reason `p256Sign` has no vector of its own: its argument is
the SHA-256 of "sample" or "test", which RFC 6979 does not print. P-DIGEST
holds `p256Sign` over that digest equal to `p256SignSha256` over the
message, for every key and message, so the two SHA-256 vectors of
`p256SignSha256` fix `p256Sign`'s result on those digests. A vector 0.6.0
derived argument (`p256Sign(x = c9af…, sha256("sample"))`, an argument that
a reference function computes from a printed value) would cite it directly.

The other curves of Sections A.2.3 to A.2.17, and DSA (Sections A.2.1 and
A.2.2), are not implemented.

Three statements of RFC 6979 are not functional and hold no binding
keyword, so they are recorded here, not excluded:

- Section 3.2: the internal values V, K and k are not observable. The two
  SHA-256 vectors fix the signature, and so the nonce, for the printed key.
- Section 3.4: a k that gives r = 0 is unsuitable, and the generation loops.
  Finding a key and message that reach it is as hard as a preimage of the
  hash, so no vector or property can drive that path.
- Section 4: implementations should use defensive measures against side
  channels. Timing is not observable by a functional test; the
  constant-time disassembly check holds the P-256 arithmetic through
  tests/cases/ct\_asm\_p256.ts, recorded in docs/security/crypto-ecc.md.

Section A.2.5's public key U = (Ux, Uy) is not a vector, and so neither
are the verifications of its two SHA-256 signatures under it.
`p256PublicKey` returns the uncompressed point, the octet 04 then Ux and
Uy (SEC 1 Section 2.3.3), and RFC 6979 does not print the 04. Vector 0.6.0
binds every literal of a cited row to a whole printed value, so
`concat([04], Ux = 60fe…, Uy = 7903…)` is refused ("the 1-byte
expect.concat[0] is only part of a value printed in RFC §A.2.5"), and a row
cannot take its framing octet from a second source: a vector cites one
section. A cited row for an encoded point needs a literal a vector can mark
as framing, not printed (a `[04]` that fidelity skips when the interface
documents the encoding), or a `concat` whose parts cite separate sources.
P-PUB-FORM holds the form of every public key, and P-ROUNDTRIP and the
tamper properties hold that the public key verifies its private key's
signatures and no other's.

ECDSA is malleable: when (r, s) verifies, so does (r, q - s). RFC 6979 is
silent on it, so no clause here asks `p256Verify` to refuse the upper s.

# Properties

~~~ ts-property
// P-PUB-FORM covers R-PUB — the public key of any private key is 65 octets, 04 then Ux and Uy
forall (x: u8[] /* 32..32 */) =>
  { const pub = unwrap(p256PublicKey(x)); return pub.length === 65 && pub.slice(0, 1) === fill(4, 1); }
~~~

~~~ ts-property
// P-PRIV-RANGE covers R-PRIV-RANGE — a private key of 0 or of 2^256 - 1, past q - 1, is refused
forall (d: u8[] /* 0..64 */) =>
  p256PublicKey(zeros(32)) === null && p256PublicKey(fill(255, 32)) === null && p256Sign(zeros(32), d) === null && p256Sign(fill(255, 32), d) === null
~~~

~~~ ts-property
// P-SIG-FORM covers R-SIG-PAIR — a signature is 64 octets, r then s
forall (x: u8[] /* 32..32 */, msg: u8[] /* 0..100 */) =>
  unwrap(p256SignSha256(x, msg)).length === 64
~~~

~~~ ts-property
// P-DIGEST covers R-HASH — signing a message is signing its SHA-256 hash
forall (x: u8[] /* 32..32 */, msg: u8[] /* 0..200 */) =>
  unwrap(p256Sign(x, sha256(msg))) === unwrap(p256SignSha256(x, msg))
~~~

~~~ ts-property
// P-TRUNCATE covers R-TRUNCATE, R-BITS2INT — only the leftmost 256 bits of a longer digest count, to sign and to verify
forall (x: u8[] /* 32..32 */, d: u8[] /* 33..64 */) =>
  { const sig = unwrap(p256Sign(x, d)); return sig === unwrap(p256Sign(x, d.slice(0, 32))) && p256Verify(unwrap(p256PublicKey(x)), d.slice(0, 32), sig) === true; }
~~~

~~~ ts-property
// P-EXPAND covers R-EXPAND, R-BITS2INT — a shorter digest counts as if zero octets were added to its left
forall (x: u8[] /* 32..32 */, d: u8[] /* 0..31 */) =>
  unwrap(p256Sign(x, d)) === unwrap(p256Sign(x, concat(zeros(32 - d.length), d)))
~~~

~~~ ts-property
// P-ROUNDTRIP covers R-COMPAT — a signature verifies under the private key's public key
forall (x: u8[] /* 32..32 */, msg: u8[] /* 0..200 */) =>
  p256VerifySha256(unwrap(p256PublicKey(x)), msg, unwrap(p256SignSha256(x, msg))) === true
~~~

~~~ ts-property
// P-ROUNDTRIP-DIGEST covers R-COMPAT — a signature over a digest verifies under the private key's public key
forall (x: u8[] /* 32..32 */, d: u8[] /* 32..32 */) =>
  p256Verify(unwrap(p256PublicKey(x)), d, unwrap(p256Sign(x, d))) === true
~~~

~~~ ts-property
// P-TAMPER-SIG covers R-COMPAT — flipping any one bit of the signature makes it invalid
forall (x: u8[] /* 32..32 */, msg: u8[] /* 0..100 */, bit: i32 /* 0..511 */) =>
  { const pub = unwrap(p256PublicKey(x)); const sig = unwrap(p256SignSha256(x, msg)); return p256VerifySha256(pub, msg, flipBit(sig, bit)) === false && p256Verify(pub, sha256(msg), flipBit(sig, bit)) === false; }
~~~

~~~ ts-property
// P-TAMPER-MSG covers R-COMPAT — flipping any one bit of the message makes the signature invalid
forall (x: u8[] /* 32..32 */, msg: u8[] /* 1..100 */, bit: i32 /* 0..799 */) =>
  p256VerifySha256(unwrap(p256PublicKey(x)), flipBit(msg, bit), unwrap(p256SignSha256(x, msg))) === false
where bit < 8 * msg.length
~~~

~~~ ts-property
// P-TAMPER-DIGEST covers R-COMPAT — flipping any one bit of the digest makes the signature invalid
forall (x: u8[] /* 32..32 */, d: u8[] /* 32..32 */, bit: i32 /* 0..255 */) =>
  p256Verify(unwrap(p256PublicKey(x)), flipBit(d, bit), unwrap(p256Sign(x, d))) === false
~~~

~~~ ts-property
// P-TAMPER-KEY covers R-COMPAT — a signature does not verify under another private key's public key
forall (x: u8[] /* 32..32 */, y: u8[] /* 32..32 */, msg: u8[] /* 0..100 */) =>
  p256VerifySha256(unwrap(p256PublicKey(y)), msg, unwrap(p256SignSha256(x, msg))) === false
where x !== y
~~~

~~~ ts-property
// P-SIZES covers R-COMPAT — a public key other than 65 octets or a signature other than 64 is invalid
forall (x: u8[] /* 32..32 */, msg: u8[] /* 0..40 */, cut: i32 /* 1..32 */) =>
  { const pub = unwrap(p256PublicKey(x)); const sig = unwrap(p256SignSha256(x, msg)); return p256VerifySha256(pub.slice(0, 65 - cut), msg, sig) === false && p256VerifySha256(pub, msg, sig.slice(0, 64 - cut)) === false && p256VerifySha256(pub, msg, sig.concat(zeros(cut))) === false; }
~~~

~~~ ts-property
// P-RANGE covers R-COMPAT — a signature with r or s of 0 is invalid
forall (x: u8[] /* 32..32 */, msg: u8[] /* 0..40 */) =>
  { const pub = unwrap(p256PublicKey(x)); const sig = unwrap(p256SignSha256(x, msg)); return p256VerifySha256(pub, msg, concat(zeros(32), sig.slice(32, 64))) === false && p256VerifySha256(pub, msg, concat(sig.slice(0, 32), zeros(32))) === false; }
~~~

# Vectors

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| A.2.5-SHA256-SAMPLE | `p256SignSha256(x = c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721, "sample")` | `concat(r = efd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716, s = f7cb1c942d657c41d436c7a1b6e29f65f3e900dbb9aff4064dc4ab2f843acda8)` | R-DETERMINISTIC, R-HMAC-H, R-HASH, R-SIG-PAIR, R-MESSAGES | {{Section A.2.5 of RFC6979}} | RFC 6979 A.2.5: With SHA-256, message = "sample" |
| A.2.5-SHA256-TEST | `p256SignSha256(x = c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721, "test")` | `concat(r = f1abb023518351cd71d881567b1ea663ed3efcf6c5132b354f28d3b0b7d38367, s = 019f4113742a2b14bd25926b49c649155f267e60d3814b4c0cc84250e46f0083)` | R-DETERMINISTIC, R-HMAC-H, R-HASH, R-SIG-PAIR, R-MESSAGES | {{Section A.2.5 of RFC6979}} | RFC 6979 A.2.5: With SHA-256, message = "test" |
