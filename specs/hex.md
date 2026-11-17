---
title: "Spec 0001: nish/hex — hexadecimal encoding and decoding"
abbrev: nish/hex
docname: draft-hex-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-16
author:
  - name: Nish Authors
    org: nish
normative:
  RFC4648:
--- abstract

Status: proposed. Module: std/hex.ts (nish/hex). A hexadecimal codec for
nish: hexEncode writes lowercase hex, and hexDecode reads hex in any case and
refuses everything else with null.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

Nish has no public hex codec, and 37 test programs define their own. This spec
adds one, for tests, test vectors and configuration that carries keys in hex.

# Interface

~~~ ts-interface
// module: nish/hex
export const hexEncode = (bytes: u8[]): string
export const hexDecode = (text: string): u8[] | null
~~~

A string is the bytes of its UTF-8 encoding, and every length and character in
this spec is counted in those bytes: a non-ASCII character is two to four
bytes, none of which is a hex digit.

# Encoding

## Length

hexEncode MUST return exactly two characters per input byte.
{: #R-ENC-LEN}

~~~ ts-property
// P-ENC-LEN covers R-ENC-LEN — two characters per byte
// samples: 96
forall (b: u8[] /* 0..64 */) => hexEncode(b).length === 2 * b.length
~~~

## Digits

Each byte MUST be written high nibble first, using the digits 0-9 and a-f.
{: #R-ENC-DIGITS}

hexEncode MUST NOT emit uppercase digits, separators or a prefix.
{: #R-ENC-ONLY}

~~~ ts-property
// P-ENC-LOWER covers R-ENC-ONLY — the encoding has no uppercase digit
// samples: 96
forall (b: u8[] /* 0..64 */) => {
  const e = hexEncode(b);
  return e === e.toLowerCase();
}
~~~

~~~ ts-property
// P-ROUND-TRIP covers R-ROUND-TRIP, R-ENC-ONLY — hexDecode(hexEncode(b)) is b
// samples: 96
forall (b: u8[] /* 0..64 */) => {
  const d = hexDecode(hexEncode(b));
  return d !== null && unwrap(d) === b;
}
~~~

# Decoding

## Accepted input

hexDecode MUST accept the digits 0-9, a-f and A-F, in any mix of case.
{: #R-DEC-ACCEPT}

~~~ ts-property
// P-CANONICAL covers R-ENC-DIGITS, R-DEC-ACCEPT — lowercase hex of even length re-encodes to itself
// samples: 96
forall (t: string /* 0..32 hexdigit */) => {
  const d = hexDecode(t);
  return d !== null && hexEncode(unwrap(d)) === t;
}
where t.length % 2 === 0
~~~

~~~ ts-property
// P-ANY-CASE covers R-DEC-ACCEPT — any mix of case decodes as its lowercase does
// samples: 96
forall (t: string /* 0..32 hexdigit HEXDIGIT */) => {
  const d = hexDecode(t);
  return d !== null && hexEncode(unwrap(d)) === t.toLowerCase();
}
where t.length % 2 === 0
~~~

## Rejected input {#rejected-input}

hexDecode MUST return null when the text has an odd length or contains any
other character, including whitespace and a "0x" prefix.
{: #R-DEC-REJECT}

~~~ ts-property
// P-ODD covers R-DEC-REJECT — an odd length is null
// samples: 96
forall (t: string /* 1..33 hexdigit HEXDIGIT */) => hexDecode(t) === null
where t.length % 2 === 1
~~~

~~~ ts-property
// P-OTHER covers R-DEC-REJECT — any other printable character or whitespace, anywhere, is null
// samples: 96
forall (
  a: string /* 0..16 hexdigit HEXDIGIT */,
  x: string /* 1..1 " \t\n\r!\"#$%&'()*+,-./:;<=>?@GHIJKLMNOPQRSTUVWXYZ[\\]^_`ghijklmnopqrstuvwxyz{|}~" */,
  z: string /* 0..16 hexdigit HEXDIGIT */,
) => hexDecode(a + (x + z)) === null
where (a + (x + z)).length % 2 === 0
~~~

~~~ ts-property
// P-OTHER-EDGE covers R-DEC-REJECT — the characters next to each digit range are null
// samples: 96
forall (
  a: string /* 0..16 hexdigit HEXDIGIT */,
  x: string /* 1..1 "/:@G`g" */,
  z: string /* 0..16 hexdigit HEXDIGIT */,
) => hexDecode(a + (x + z)) === null
where (a + (x + z)).length % 2 === 0
~~~

~~~ ts-property
// P-CONTROL covers R-DEC-REJECT — a control byte or DEL, anywhere in an even-length text, is null
// samples: 96
forall (
  a: string /* 0..16 hexdigit HEXDIGIT */,
  i: i32 /* 0..127 */,
  z: string /* 0..16 hexdigit HEXDIGIT */,
) => hexDecode(a + (unwrap(ascii(le64(i).slice(0, 1))) + z)) === null
where (i < 32 || i === 127) && (a.length + z.length) % 2 === 1
~~~

~~~ ts-property
// P-PREFIX covers R-DEC-REJECT — a "0x" prefix is null
// samples: 96
forall (t: string /* 0..32 hexdigit HEXDIGIT */) => hexDecode("0x" + t) === null
where t.length % 2 === 0
~~~

## Empty input

hexDecode of the empty string MUST return an empty array, not null.
{: #R-DEC-EMPTY}

## Round trip

For all bytes b, hexDecode(hexEncode(b)) MUST equal b.
{: #R-ROUND-TRIP}

## Size

This spec does not cover an input whose text would be longer than a string can
be, 2^31 - 1 bytes: hexEncode panics on 2^30 bytes or more, and hexDecode
answers null for a text of 2^31 - 1 bytes or more.

# Security Considerations

Test vectors and configuration this module reads and writes are often key
material.

hexEncode and hexDecode MUST NOT branch on, or index memory by, the value of a
byte of their input, so that their running time depends only on its length.

Untested: How the code runs, not what it returns: no functional test observes a branch, an address or a running time. Checked in nish instead: tests/cases/ct_asm_hex.ts holds the per-byte code (the digit of a nibble, a digit's validity and value, one byte encoded, one pair decoded) to no branch, no call and no secret-addressed access after clang -O2 on x86-64 and aarch64, and tests/link/std_hex_ct_copies holds those copies to the module. The loops themselves branch on their counter, which that check refuses outright, so their -O3 listings were read by hand.

# Test Vectors

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| V1 | `hexDecode("")` | `""` | R-DEC-EMPTY | {{Section 10 of RFC4648}} | RFC 4648 §10: BASE16("") is "", which decodes to the empty array |
| V2 | `hexDecode("66")` | `"f"` | R-DEC-ACCEPT | {{Section 10 of RFC4648}} | RFC 4648 §10: "66" decodes to "f" |
| V3 | `hexDecode("666F6F")` | `"foo"` | R-DEC-ACCEPT | {{Section 10 of RFC4648}} | RFC 4648 §10: uppercase "666F6F" decodes to "foo" |
| V4 | `hexDecode("666F6F626172")` | `"foobar"` | R-DEC-ACCEPT | {{Section 10 of RFC4648}} | RFC 4648 §10: uppercase "666F6F626172" decodes to "foobar" |
| V5 | `hexEncode([00 0f f0 ff])` | `"000ff0ff"` | R-ENC-LEN, R-ENC-DIGITS, R-ENC-ONLY | `python3 -c 'print(bytes([0,15,240,255]).hex())'` | each nibble boundary, high nibble first, lowercase |
| V6 | `hexDecode("aBcD")` | `[ab cd]` | R-DEC-ACCEPT | `python3 -c 'print(bytes.fromhex("aBcD").hex())'` | a mix of case decodes |
| V7 | `hexDecode("abc")` | `null` | R-DEC-REJECT | {{rejected-input}} | an odd length is null |
| V8 | `hexDecode("0x00")` | `null` | R-DEC-REJECT | {{rejected-input}} | a "0x" prefix is null |
| V9 | `hexDecode("0a 0b 0c")` | `null` | R-DEC-REJECT | {{rejected-input}} | whitespace between the digits is null |
| V10 | `hexEncode([00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 20 21 22 23 24 25 26 27 28 29 2a 2b 2c 2d 2e 2f 30 31 32 33 34 35 36 37 38 39 3a 3b 3c 3d 3e 3f 40 41 42 43 44 45 46 47 48 49 4a 4b 4c 4d 4e 4f 50 51 52 53 54 55 56 57 58 59 5a 5b 5c 5d 5e 5f 60 61 62 63 64 65 66 67 68 69 6a 6b 6c 6d 6e 6f 70 71 72 73 74 75 76 77 78 79 7a 7b 7c 7d 7e 7f 80 81 82 83 84 85 86 87 88 89 8a 8b 8c 8d 8e 8f 90 91 92 93 94 95 96 97 98 99 9a 9b 9c 9d 9e 9f a0 a1 a2 a3 a4 a5 a6 a7 a8 a9 aa ab ac ad ae af b0 b1 b2 b3 b4 b5 b6 b7 b8 b9 ba bb bc bd be bf c0 c1 c2 c3 c4 c5 c6 c7 c8 c9 ca cb cc cd ce cf d0 d1 d2 d3 d4 d5 d6 d7 d8 d9 da db dc dd de df e0 e1 e2 e3 e4 e5 e6 e7 e8 e9 ea eb ec ed ee ef f0 f1 f2 f3 f4 f5 f6 f7 f8 f9 fa fb fc fd fe ff])` | `"000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"` | R-ENC-LEN, R-ENC-DIGITS, R-ENC-ONLY | `python3 -c 'print(bytes(range(256)).hex())'` | every byte value encodes to its two lowercase digits |
| V11 | `hexDecode("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9FA0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBFC0C1C2C3C4C5C6C7C8C9CACBCCCDCECFD0D1D2D3D4D5D6D7D8D9DADBDCDDDEDFE0E1E2E3E4E5E6E7E8E9EAEBECEDEEEFF0F1F2F3F4F5F6F7F8F9FAFBFCFDFEFF")` | `[00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 20 21 22 23 24 25 26 27 28 29 2a 2b 2c 2d 2e 2f 30 31 32 33 34 35 36 37 38 39 3a 3b 3c 3d 3e 3f 40 41 42 43 44 45 46 47 48 49 4a 4b 4c 4d 4e 4f 50 51 52 53 54 55 56 57 58 59 5a 5b 5c 5d 5e 5f 60 61 62 63 64 65 66 67 68 69 6a 6b 6c 6d 6e 6f 70 71 72 73 74 75 76 77 78 79 7a 7b 7c 7d 7e 7f 80 81 82 83 84 85 86 87 88 89 8a 8b 8c 8d 8e 8f 90 91 92 93 94 95 96 97 98 99 9a 9b 9c 9d 9e 9f a0 a1 a2 a3 a4 a5 a6 a7 a8 a9 aa ab ac ad ae af b0 b1 b2 b3 b4 b5 b6 b7 b8 b9 ba bb bc bd be bf c0 c1 c2 c3 c4 c5 c6 c7 c8 c9 ca cb cc cd ce cf d0 d1 d2 d3 d4 d5 d6 d7 d8 d9 da db dc dd de df e0 e1 e2 e3 e4 e5 e6 e7 e8 e9 ea eb ec ed ee ef f0 f1 f2 f3 f4 f5 f6 f7 f8 f9 fa fb fc fd fe ff]` | R-DEC-ACCEPT | `python3 -c 'print(bytes.fromhex(bytes(range(256)).hex().upper()).hex())'` | every byte value, in uppercase, decodes back |
