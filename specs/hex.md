# Spec 0001: `nish/hex` — hexadecimal encoding and decoding

Status: proposed · Module: `std/hex.ts` (`nish/hex`)

The key words MUST, MUST NOT, SHOULD and MAY are to be interpreted as in
BCP 14 (RFC 2119, RFC 8174) when, and only when, they appear in all capitals.

## 1. Introduction

Nish has no public hex codec, and 37 test programs define their own. This spec
adds one, for tests, test vectors and configuration that carries keys in hex.

## 2. Interface

    export const hexEncode = (bytes: u8[]): string
    export const hexDecode = (text: string): u8[] | null

## 3. Encoding

### 3.1. Length

hexEncode MUST return exactly two characters per input byte.

### 3.2. Digits

Each byte MUST be written high nibble first, using the digits 0-9 and a-f.
hexEncode MUST NOT emit uppercase digits, separators or a prefix.

## 4. Decoding

### 4.1. Accepted input

hexDecode MUST accept the digits 0-9, a-f and A-F, in any mix of case.

### 4.2. Rejected input

hexDecode MUST return null when the text has an odd length or contains any
other character, including whitespace and a "0x" prefix.

### 4.3. Empty input

hexDecode of the empty string MUST return an empty array, not null.

### 4.4. Round trip

For all bytes b, hexDecode(hexEncode(b)) MUST equal b.

## 5. Security Considerations

Test vectors and configuration decoded by this module are often key material.
hexDecode MUST NOT index a table by the value of a digit, so that its running
time depends only on the length of its input.

## 6. Test Vectors

| Id  | Call                         | Expected       | Source |
|-----|------------------------------|----------------|--------|
| V1  | hexDecode("")                | (empty)        | RFC 4648 §10 |
| V2  | hexDecode("66")              | "f"            | RFC 4648 §10 |
| V3  | hexDecode("666F6F")          | "foo"          | RFC 4648 §10 |
| V4  | hexDecode("666F6F626172")    | "foobar"       | RFC 4648 §10 |
| V5  | hexEncode([00 0f f0 ff])     | "000ff0ff"     | `python3 -c 'print(bytes([0,15,240,255]).hex())'` |
| V6  | hexDecode("aBcD")            | [ab cd]        | `python3 -c 'print(bytes.fromhex("aBcD").hex())'` |
| V7  | hexDecode("abc")             | null           | §4.2 (odd length) |
| V8  | hexDecode("0x00")            | null           | §4.2 (prefix) |
| V9  | hexDecode("ab cd")           | null           | §4.2 (whitespace) |
| V10 | hexEncode(bytes 00 to ff)    | "000102…feff"  | `python3 -c 'print(bytes(range(256)).hex())'` |
| V11 | hexDecode("00" to "FF", uppercase, joined) | bytes 00 to ff | `python3 -c 'print(bytes.fromhex(bytes(range(256)).hex().upper()).hex())'` |
