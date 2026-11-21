---
title: "PBKDF2-HMAC-SHA-256"
abbrev: nish/crypto/hmac
docname: draft-rfc7914-pbkdf2-sha256-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-18
author:
  - name: Nish Authors
    org: nish
normative:
  RFC7914:
--- abstract

A profile of RFC 7914's PBKDF2 test vectors for pbkdf2HmacSha256 in
nish/crypto/hmac (std/crypto/hmac.ts). RFC 7914 defines scrypt; its
Section 11 prints test vectors for PBKDF2-HMAC-SHA-256, the function scrypt
is built on, and every one of them is held here.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

nish/crypto/hmac exports PBKDF2 with HMAC-SHA-256 as its pseudorandom
function, over a password held as a `Secret`, a salt, an iteration count
and a derived-key length. SCRAM-SHA-256's `Hi` is this function with a
32-byte output, which is how nish/net/postgres uses it.

RFC 7914 has no binding sentence in the sense of BCP 14 for PBKDF2, so the
profile does not claim it as its main source: there is no completeness to
check.

Section 11 prints both vectors, and vector 0.6.0 cannot cite either, so each
takes its expected value from Python's hashlib, as a command
`spec check --run-sources` runs; the bytes it prints are the ones Section 11
prints, byte for byte. Section 11 prints each value under the label
`PBKDF2-HMAC-SHA-256 (P="passwd", S="salt", c=1, dkLen=64) =`, split across
two lines. vector asks for that label on the Expected value, and its
Markdown literal grammar refuses one with a `"`, an `=` or a comma inside its
parentheses ("Expected: not a literal"). The labels `c` and `dkLen` on the
integer arguments are refused as well: vector reads them back from this
profile's own Test Vectors section, finds `c` and `dkLen` on both rows, and
refuses ("nothing pairs a printed string with one of several labelled
values"). The integers are left bare, and `spec check` warns that each has
no label to find it by.

# Interface

~~~ ts-interface
// module: nish/crypto/hmac
export const pbkdf2HmacSha256 = (password: Secret<u8[]>, salt: u8[], iterations: i32, length: i32): Secret<u8[]> | null
~~~

# The Function

> The test vectors below can be used to verify the PBKDF2-HMAC-SHA-256 [RFC2898] function.
> {{Section 11 of RFC7914}}
{: #R-PBKDF2 gi="blockquote"}

> The password and salt strings are passed as sequences of ASCII [RFC20] octets.
> {{Section 11 of RFC7914}}
{: #R-ASCII gi="blockquote"}

## A refused input {#refused-input}

PBKDF2 takes at least one round and gives at least one byte.
pbkdf2HmacSha256 MUST return null when the iteration count or the
derived-key length is less than 1.
{: #R-REFUSE}

# Laws

PBKDF2 computes its output block by block, each block from the password,
the salt, the count and the block's index alone, so a shorter key is a
prefix of a longer one under the same inputs. The vectors hold 64-byte keys;
the clause below holds the lengths around SHA-256's 32-byte block.

~~~ ts-property
// P-PREFIX covers R-PBKDF2 — dkLen bytes, a prefix of every longer key
// samples: 32
forall (pw: u8[] /* 0..24 */, salt: u8[] /* 0..24 */, n: i32 /* 1..3 */, a: i32 /* 1..40 */, b: i32 /* 0..40 */) => {
  const k = pbkdf2HmacSha256(pw, salt, n, a + b);
  return k !== null && unwrap(k).length === a + b && unwrap(pbkdf2HmacSha256(pw, salt, n, a)) === unwrap(k).slice(0, a);
}
~~~

~~~ ts-property
// P-REFUSE covers R-REFUSE — a count or a length below 1 is null
// samples: 48
forall (pw: u8[] /* 0..24 */, salt: u8[] /* 0..24 */, n: i32 /* -2..2 */, len: i32 /* -2..2 */) =>
  implies(n < 1 || len < 1, pbkdf2HmacSha256(pw, salt, n, len) === null) &&
  implies(n >= 1 && len >= 1, pbkdf2HmacSha256(pw, salt, n, len) !== null)
~~~

# Test Vectors

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| PBKDF2-1 | `pbkdf2HmacSha256("passwd", "salt", 1, 64)` | `[55 ac 04 6e 56 e3 08 9f ec 16 91 c2 25 44 b6 05 f9 41 85 21 6d de 04 65 e6 8b 9d 57 c2 0d ac bc 49 ca 9c cc f1 79 b6 45 99 16 64 b3 9d 77 ef 31 7c 71 b8 45 b1 e3 0b d5 09 11 20 41 d3 a1 97 83]` | R-PBKDF2, R-ASCII | `python3 -c 'import hashlib; print(hashlib.pbkdf2_hmac("sha256", b"passwd", b"salt", 1, 64).hex())'` | RFC 7914 §11: one iteration, a 64-byte key |
| PBKDF2-2 | `pbkdf2HmacSha256("Password", "NaCl", 80000, 64)` | `[4d dc d8 f6 0b 98 be 21 83 0c ee 5e f2 27 01 f9 64 1a 44 18 d0 4c 04 14 ae ff 08 87 6b 34 ab 56 a1 d4 25 a1 22 58 33 54 9a db 84 1b 51 c9 b3 17 6a 27 2b de bb a1 d0 78 47 8f 62 b3 97 f3 3c 8d]` | R-PBKDF2, R-ASCII | `python3 -c 'import hashlib; print(hashlib.pbkdf2_hmac("sha256", b"Password", b"NaCl", 80000, 64).hex())'` | RFC 7914 §11: 80,000 iterations, a 64-byte key |
