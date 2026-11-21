---
title: "The Base64 Data Encodings: base64 and base64url"
abbrev: nish/crypto/base64url
docname: draft-rfc4648-base64-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-21
keyword:
  - vector-main-RFC4648
author:
  - name: Nish Authors
    org: nish
normative:
  RFC4648:

--- abstract

A profile of RFC 4648 for nish/crypto/base64url and nish/base64: base 64
encoding with the standard alphabet and padding (Section 4), and with the URL
and filename safe alphabet and no padding (Section 5). It quotes RFC 4648, the
main source; every binding sentence of RFC 4648 (MUST, MUST NOT, SHALL, SHALL
NOT, REQUIRED) is tested or excluded here. The base 32 and base 16 encodings
are not implemented and not profiled.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

nish/crypto/base64url exports a strict codec for each base 64 alphabet. The
standard one (`base64StdPad*`) writes padding and reads only canonical text:
a length that is a multiple of four, padding only as the last one or two
characters, and zero pad bits. The URL one (`base64url*`) writes no padding,
as the specifications that use it (JWS, JWK) state, and reads only canonical
unpadded text: no `=` anywhere, no length of 1 modulo 4, and zero pad bits.
Every decoder returns null (or -1, for `base64StdPadDecodedLength`) where it
refuses.

nish/base64 is an encoder only, with the standard alphabet and padding. Its
functions are declared after a second module line, as reference functions,
so each clause that tests one also calls a function of nish/crypto/base64url:
each is held equal to the strict encoder on every sample.

Section 10 prints test vectors for the standard alphabet only; the URL and
filename safe alphabet has none. The vector rows hold the standard encoder
and decoder to Section 10, and the properties hold the URL codec to the
standard one: the URL encoding of any bytes is their standard encoding with
`+` and `/` written as `-` and `_` and the padding dropped.

This profile leaves out the following, each for the reason given.

The base 32, base 32 hex and base 16 encodings (Sections 6 to 8): std/
implements none of them.

Line feeds, and decoders that skip characters outside the alphabet, where a
referring specification directs them (Sections 3.1 and 3.3): neither codec
has such a mode, so the exceptions those sections allow are unused.

base64StdPadDecode and base64urlDecode on text holding a character above
U+007F: a property's string alphabet holds only printable ASCII, tab, LF and
CR in vector 0.6.0. base64StdPadDecodedLength reads bytes, so it alone is
given a byte at or above 0x80, built with `fill`.

An output buffer too short for the encoding: RFC 4648 says nothing of
buffers, and the interface gives every base64StdPadEncodeInto and
base64EncodeInto call room for the whole encoding.

# Interface

~~~ ts-interface
// module: nish/crypto/base64url
export const base64urlEncode = (data: u8[]): string
export const base64urlDecode = (text: string): u8[] | null
export const base64StdPadEncode = (data: u8[]): string
export const base64StdPadEncodeInto = (data: u8[] /* window */, out: u8[] /* out 2 * data.length + 4 */): u8[]
export const base64StdPadDecodedLength = (text: u8[] /* window */): i32
export const base64StdPadDecode = (text: string): u8[] | null
// module: nish/base64
export const base64EncodedLength = (n: i32): i32
export const base64EncodeInto = (src: u8[] /* window */, dst: u8[] /* out 2 * src.length + 4 */): u8[]
export const base64Encode = (bytes: u8[]): string
~~~

# Line Feeds and Padding

> Implementations MUST NOT add line feeds to base-encoded data unless the specification referring to this document explicitly directs base encoders to add line feeds after a specific number of characters.
> {{Section 3.1 of RFC4648}}
{: #R-NO-LF gi="blockquote"}

> Implementations MUST include appropriate pad characters at the end of encoded data unless the specification referring to this document explicitly states otherwise.
> {{Section 3.2 of RFC4648}}
{: #R-PAD gi="blockquote"}

~~~ ts-property
// P-STD-LENGTH covers R-NO-LF, R-PAD — the standard encoding of n bytes is 4 * ceil(n / 3) characters
// samples: 96
forall (b: u8[] /* 0..64 */) => 3 * base64StdPadEncode(b).length === 4 * (b.length + (3 - b.length % 3) % 3)
~~~

~~~ ts-property
// P-URL-LENGTH covers R-NO-LF — the URL encoding of n bytes is ceil(4 * n / 3) characters, with no padding
// samples: 96
forall (b: u8[] /* 0..64 */) => 3 * base64urlEncode(b).length === 4 * b.length + (3 - 4 * b.length % 3) % 3
~~~

~~~ ts-property
// P-STD-PAD covers R-PAD — the standard encoding ends in as many "=" as the final group is short of three bytes
// samples: 96
forall (b: u8[] /* 1..64 */) => {
  const e = base64StdPadEncode(b);
  const p = (3 - b.length % 3) % 3;
  return utf8(e).slice(e.length - p, e.length) === utf8("==").slice(0, p) && e.charAt(e.length - p - 1) !== "=";
}
~~~

~~~ ts-property
// P-ENCODED-LENGTH covers R-NO-LF, R-PAD — base64EncodedLength(n) is the length of the standard encoding of n bytes
// samples: 96
forall (b: u8[] /* 0..64 */) => base64EncodedLength(b.length) === base64StdPadEncode(b).length
~~~

# Non-Alphabet Characters

> Implementations MUST reject the encoded data if it contains characters outside the base alphabet when interpreting base-encoded data, unless the specification referring to this document explicitly states otherwise.
> {{Section 3.3 of RFC4648}}
{: #R-REJECT gi="blockquote"}

~~~ ts-property
// P-STD-OTHER covers R-REJECT — a character outside the standard alphabet, whitespace included, anywhere, is refused
// samples: 128
forall (
  a: string /* 0..16 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" */,
  x: string /* 1..1 " \t\n\r!\"#$%&'()*,-.:;<>?@[\\]^_`{|}~" */,
  z: string /* 0..16 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" */,
) => base64StdPadDecode(a + (x + z)) === null && base64StdPadDecodedLength(utf8(a + (x + z))) === -1
where (a + (x + z)).length % 4 === 0
~~~

~~~ ts-property
// P-STD-HIGH-BYTE covers R-REJECT — a byte at or above 0x80, anywhere in the text, is refused by base64StdPadDecodedLength
// samples: 128
forall (
  a: string /* 0..16 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" */,
  x: i32 /* 128..255 */,
  z: string /* 0..16 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" */,
) => base64StdPadDecodedLength(utf8(a).concat(fill(x, 1)).concat(utf8(z))) === -1
where (a.length + z.length + 1) % 4 === 0
~~~

~~~ ts-property
// P-URL-OTHER covers R-REJECT — a character outside the URL alphabet, "+", "/", "=" and whitespace included, anywhere, is refused
// samples: 128
forall (
  a: string /* 0..16 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" */,
  x: string /* 1..1 " \t\n\r!\"#$%&'()*+,./:;<=>?@[\\]^`{|}~" */,
  z: string /* 0..16 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" */,
) => base64urlDecode(a + (x + z)) === null
where (a + (x + z)).length % 4 !== 1
~~~

# Canonical Encoding

> These pad bits MUST be set to zero by conforming encoders, which is described in the descriptions on padding below.
> {{Section 3.5 of RFC4648}}
{: #R-PAD-BITS gi="blockquote"}

> In some environments, the alteration is critical and therefore decoders MAY chose to reject an encoding if the pad bits have not been set to zero.
> {{Section 3.5 of RFC4648}}
{: #R-CANONICAL gi="blockquote"}

~~~ ts-property
// P-STD-CANONICAL covers R-PAD-BITS, R-CANONICAL — a standard text whose last character carries nonzero pad bits is refused: every text decoded re-encodes to itself
// samples: 192
forall (
  b: u8[] /* 1..32 */,
  c: string /* 1..1 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" */,
) => {
  const e = base64StdPadEncode(b);
  const p = (3 - b.length % 3) % 3;
  const t = unwrap(ascii(utf8(e).slice(0, e.length - p - 1))) + (c + unwrap(ascii(utf8(e).slice(e.length - p, e.length))));
  const d = base64StdPadDecode(t);
  return (d === null && base64StdPadDecodedLength(utf8(t)) === -1) || (base64StdPadEncode(unwrap(d)) === t && base64StdPadDecodedLength(utf8(t)) === unwrap(d).length);
}
where b.length % 3 !== 0
~~~

~~~ ts-property
// P-URL-CANONICAL covers R-PAD-BITS, R-CANONICAL — a URL text whose last character carries nonzero pad bits is refused: every text decoded re-encodes to itself
// samples: 192
forall (
  b: u8[] /* 1..32 */,
  c: string /* 1..1 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" */,
) => {
  const e = base64urlEncode(b);
  const t = unwrap(ascii(utf8(e).slice(0, e.length - 1))) + c;
  const d = base64urlDecode(t);
  return d === null || base64urlEncode(unwrap(d)) === t;
}
where b.length % 3 !== 0
~~~

# Base 64 Encoding

> The encoding process represents 24-bit groups of input bits as output strings of 4 encoded characters.
> {{Section 4 of RFC4648}}
{: #R-GROUPS gi="blockquote"}

> Each 6-bit group is used as an index into an array of 64 printable characters.
> {{Section 4 of RFC4648}}
{: #R-ALPHABET gi="blockquote"}

> Padding at the end of the data is performed using the '=' character.
> {{Section 4 of RFC4648}}
{: #R-PAD-CHAR gi="blockquote"}

> Since all base 64 input is an integral number of octets, only the following cases can arise:
> {{Section 4 of RFC4648}}
{: #R-CASES gi="blockquote"}

~~~ ts-property
// P-STD-ROUND-TRIP covers R-GROUPS, R-ALPHABET — the standard decoding of the standard encoding of b is b
// samples: 128
forall (b: u8[] /* 0..96 */) => {
  const d = base64StdPadDecode(base64StdPadEncode(b));
  return d !== null && unwrap(d) === b;
}
~~~

~~~ ts-property
// P-STD-DECODED-LENGTH covers R-GROUPS — base64StdPadDecodedLength of the standard encoding of b is the length of b
// samples: 96
forall (b: u8[] /* 0..96 */) => base64StdPadDecodedLength(utf8(base64StdPadEncode(b))) === b.length
~~~

~~~ ts-property
// P-STD-ENCODE-INTO covers R-GROUPS, R-ALPHABET, R-PAD-CHAR — base64StdPadEncodeInto writes the bytes of the standard encoding
// samples: 96
forall (b: u8[] /* 0..96 */) => base64StdPadEncodeInto(b) === utf8(base64StdPadEncode(b))
~~~

~~~ ts-property
// P-BASE64-ENCODE covers R-GROUPS, R-ALPHABET, R-PAD-CHAR — base64Encode is the standard encoding
// samples: 96
forall (b: u8[] /* 0..96 */) => base64Encode(b) === base64StdPadEncode(b)
~~~

~~~ ts-property
// P-BASE64-ENCODE-INTO covers R-GROUPS, R-ALPHABET, R-PAD-CHAR — base64EncodeInto writes the bytes of the standard encoding
// samples: 96
forall (b: u8[] /* 0..96 */) => base64EncodeInto(b) === utf8(base64StdPadEncode(b))
~~~

~~~ ts-property
// P-STD-LENGTH-1 covers R-CASES — a standard text whose length is not a multiple of four is refused
// samples: 96
forall (t: string /* 1..35 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" */) => base64StdPadDecode(t) === null && base64StdPadDecodedLength(utf8(t)) === -1
where t.length % 4 !== 0
~~~

~~~ ts-property
// P-STD-MISPLACED-PAD covers R-CASES, R-PAD-CHAR — a standard text with "=" anywhere but its last two characters, or "=" before a non-pad character, is refused
// samples: 128
forall (
  t: string /* 4..32 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" */,
  i: i32 /* 0..31 */,
) => {
  const s = unwrap(ascii(utf8(t).slice(0, i))) + ("=" + unwrap(ascii(utf8(t).slice(i + 1, t.length))));
  return base64StdPadDecode(s) === null && base64StdPadDecodedLength(utf8(s)) === -1;
}
where t.length % 4 === 0 && i <= t.length - 2
~~~

~~~ ts-property
// P-STD-THREE-PADS covers R-CASES — a standard text ending in "===" is refused
// samples: 64
forall (t: string /* 0..28 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" */, c: string /* 1..1 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" */) => {
  const s = t + (c + "===");
  return base64StdPadDecode(s) === null && base64StdPadDecodedLength(utf8(s)) === -1;
}
where t.length % 4 === 0
~~~

# Base 64 Encoding with URL and Filename Safe Alphabet

> This encoding is technically identical to the previous one, except for the 62:nd and 63:rd alphabet character, as indicated in Table 2.
> {{Section 5 of RFC4648}}
{: #R-URL gi="blockquote"}

~~~ ts-property
// P-URL-FROM-STD covers R-URL, R-PAD — the URL encoding is the standard one with "+" and "/" as "-" and "_" and the padding dropped
// samples: 192
forall (b: u8[] /* 0..48 */, i: i32 /* 0..63 */) => {
  const s = base64StdPadEncode(b);
  const u = base64urlEncode(b);
  const c = s.charAt(i);
  const d = u.charAt(i);
  return utf8(s).slice(u.length, s.length) === utf8("==").slice(0, s.length - u.length) && implies(i < u.length, (c !== "+" && c !== "/" && c !== "=" && c === d) || (c === "+" && d === "-") || (c === "/" && d === "_"));
}
~~~

~~~ ts-property
// P-URL-ROUND-TRIP covers R-URL — the URL decoding of the URL encoding of b is b
// samples: 128
forall (b: u8[] /* 0..96 */) => {
  const d = base64urlDecode(base64urlEncode(b));
  return d !== null && unwrap(d) === b;
}
~~~

~~~ ts-property
// P-URL-LENGTH-1 covers R-URL, R-CASES — a URL text of length 1 modulo 4 is refused
// samples: 96
forall (t: string /* 1..37 "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" */) => base64urlDecode(t) === null
where t.length % 4 === 1
~~~

~~~ ts-property
// P-URL-PADDED covers R-URL, R-PAD — a URL text with "=" anywhere, padding included, is refused
// samples: 96
forall (b: u8[] /* 1..32 */) => base64urlDecode(base64urlEncode(b) + "=") === null && base64urlDecode(base64urlEncode(b) + "==") === null
~~~

# Test Vectors

The URL and filename safe alphabet has no vectors in Section 10; the
properties above hold its codec to the standard one. Each row below is a
BASE64 line of Section 10, read by the standard encoder, its buffer form and
its decoder.

| Id | Call | Expected | Covers | Source | Title |
| --- | --- | --- | --- | --- | --- |
| ENC-0 | `base64StdPadEncode("")` | `""` | R-GROUPS, R-PAD | {{Section 10 of RFC4648}} | BASE64("") = "" |
| ENC-1 | `base64StdPadEncode("f")` | `"Zg=="` | R-GROUPS, R-PAD, R-PAD-BITS | {{Section 10 of RFC4648}} | BASE64("f") = "Zg==" |
| ENC-2 | `base64StdPadEncode("fo")` | `"Zm8="` | R-GROUPS, R-PAD, R-PAD-BITS | {{Section 10 of RFC4648}} | BASE64("fo") = "Zm8=" |
| ENC-3 | `base64StdPadEncode("foo")` | `"Zm9v"` | R-GROUPS, R-ALPHABET | {{Section 10 of RFC4648}} | BASE64("foo") = "Zm9v" |
| ENC-4 | `base64StdPadEncode("foob")` | `"Zm9vYg=="` | R-GROUPS, R-PAD, R-PAD-BITS | {{Section 10 of RFC4648}} | BASE64("foob") = "Zm9vYg==" |
| ENC-5 | `base64StdPadEncode("fooba")` | `"Zm9vYmE="` | R-GROUPS, R-PAD, R-PAD-BITS | {{Section 10 of RFC4648}} | BASE64("fooba") = "Zm9vYmE=" |
| ENC-6 | `base64StdPadEncode("foobar")` | `"Zm9vYmFy"` | R-GROUPS, R-ALPHABET | {{Section 10 of RFC4648}} | BASE64("foobar") = "Zm9vYmFy" |
| INTO-0 | `base64StdPadEncodeInto("")` | `""` | R-GROUPS, R-PAD | {{Section 10 of RFC4648}} | BASE64("") = "", into a buffer |
| INTO-1 | `base64StdPadEncodeInto("f")` | `"Zg=="` | R-GROUPS, R-PAD, R-PAD-BITS | {{Section 10 of RFC4648}} | BASE64("f") = "Zg==", into a buffer |
| INTO-2 | `base64StdPadEncodeInto("fo")` | `"Zm8="` | R-GROUPS, R-PAD, R-PAD-BITS | {{Section 10 of RFC4648}} | BASE64("fo") = "Zm8=", into a buffer |
| INTO-3 | `base64StdPadEncodeInto("foo")` | `"Zm9v"` | R-GROUPS, R-ALPHABET | {{Section 10 of RFC4648}} | BASE64("foo") = "Zm9v", into a buffer |
| INTO-4 | `base64StdPadEncodeInto("foob")` | `"Zm9vYg=="` | R-GROUPS, R-PAD, R-PAD-BITS | {{Section 10 of RFC4648}} | BASE64("foob") = "Zm9vYg==", into a buffer |
| INTO-5 | `base64StdPadEncodeInto("fooba")` | `"Zm9vYmE="` | R-GROUPS, R-PAD, R-PAD-BITS | {{Section 10 of RFC4648}} | BASE64("fooba") = "Zm9vYmE=", into a buffer |
| INTO-6 | `base64StdPadEncodeInto("foobar")` | `"Zm9vYmFy"` | R-GROUPS, R-ALPHABET | {{Section 10 of RFC4648}} | BASE64("foobar") = "Zm9vYmFy", into a buffer |
| DEC-0 | `base64StdPadDecode("")` | `""` | R-GROUPS, R-CASES | {{Section 10 of RFC4648}} | BASE64("") = "", decoded |
| DEC-1 | `base64StdPadDecode("Zg==")` | `"f"` | R-GROUPS, R-CASES | {{Section 10 of RFC4648}} | BASE64("f") = "Zg==", decoded |
| DEC-2 | `base64StdPadDecode("Zm8=")` | `"fo"` | R-GROUPS, R-CASES | {{Section 10 of RFC4648}} | BASE64("fo") = "Zm8=", decoded |
| DEC-3 | `base64StdPadDecode("Zm9v")` | `"foo"` | R-GROUPS, R-CASES | {{Section 10 of RFC4648}} | BASE64("foo") = "Zm9v", decoded |
| DEC-4 | `base64StdPadDecode("Zm9vYg==")` | `"foob"` | R-GROUPS, R-CASES | {{Section 10 of RFC4648}} | BASE64("foob") = "Zm9vYg==", decoded |
| DEC-5 | `base64StdPadDecode("Zm9vYmE=")` | `"fooba"` | R-GROUPS, R-CASES | {{Section 10 of RFC4648}} | BASE64("fooba") = "Zm9vYmE=", decoded |
| DEC-6 | `base64StdPadDecode("Zm9vYmFy")` | `"foobar"` | R-GROUPS, R-CASES | {{Section 10 of RFC4648}} | BASE64("foobar") = "Zm9vYmFy", decoded |
