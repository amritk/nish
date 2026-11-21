---
title: "nish/crypto/scram — the SCRAM-SHA-256 client computation"
abbrev: nish/crypto/scram
docname: draft-scram-sha256-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-18
author:
  - name: Nish Authors
    org: nish
normative:
  RFC5802:
  RFC7677:
--- abstract

Status: proposed. Module: std/crypto/scram.ts (nish/crypto/scram). The key
derivation and proofs a SCRAM-SHA-256 client computes (RFC 5802 Section 3,
with SHA-256 as RFC 7677 Section 3 sets it): SaltedPassword from the password,
salt and iteration count, then ClientProof and ServerSignature from
SaltedPassword and the AuthMessage. nish/net/postgres authenticates with them.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

The module holds the arithmetic of SCRAM-SHA-256 and nothing of its
messages: the caller builds AuthMessage, decodes the server's base64 salt
and encodes the proof. The password reaches it as `Secret` bytes already
normalized; `Normalize`, SASLprep in RFC 5802, is the caller's, and
nish/net/postgres sends the password's UTF-8 bytes unchanged, as a
PostgreSQL server accepts.

RFC 7677 Section 3 prints one SCRAM-SHA-256 exchange, and vector 0.6.0
cannot cite any value of it, so each vector below takes its expected value
from a command that `spec check --run-sources` runs:

- S1, Python's hashlib: the exchange does not print SaltedPassword at all.
- S2 and S3, a base64 decode of the printed `p=` and `v=`, so those two are
  the RFC's own bytes. The exchange prints the proof and the signature only
  as base64 inside wrapped protocol messages, and the profile has no base64
  literal, so the printed text never equals a hex or byte-array Expected.
- S4, the refusal this profile adds in {{refused-count}}.

The iteration counts 4096 (S1) and 0 (S4) carry no label. vector 0.6.0
checks a labelled argument of a command-sourced or cross-referenced vector
against this profile's own Test Vectors section. There `i` is printed more
than once, since S2's and S3's AuthMessage holds `i=4096`, and with
"pencil" on the same rows vector refuses: "nothing pairs a printed string
with one of several labelled values". The integer is left bare, and
`spec check` warns that it has no label to find it by.

The arguments are the exchange's: the password 'pencil', the salt the server
sends as `s=W22ZaJ0SNY7soEsUEjb6gQ==` (the 16 bytes `[5b 6d 99 68 9d 12 35 8e
ec a0 4b 14 12 36 fa 81]`), the iteration count 4096, and the AuthMessage
that S2 and S3 pass: RFC 5802 Section 3 joins the client-first message
without its `n,,` header, the server-first message and the client-final
message without its proof, with a comma between each.


# Interface

~~~ ts-interface
// module: nish/crypto/scram
export const scramSha256SaltedPassword = (password: Secret<u8[]>, salt: u8[], iterations: i32): Secret<u8[]> | null
export const scramSha256ClientProof = (saltedPassword: Secret<u8[]>, authMessage: u8[]): u8[]
export const scramSha256ServerSignature = (saltedPassword: Secret<u8[]>, authMessage: u8[]): u8[]
// module: nish/crypto/hmac
export const pbkdf2HmacSha256 = (password: Secret<u8[]>, salt: u8[], iterations: i32, length: i32): Secret<u8[]> | null
export const hmacSha256 = (key: u8[], data: u8[]): u8[]
// module: nish/crypto/sha256
export const sha256 = (data: u8[]): u8[]
~~~

# The Hash

> the hash function for HMAC() and H() uses SHA-256 instead of SHA-1 [RFC6234].
> {{Section 3 of RFC7677}}
{: #R-SHA256 gi="blockquote"}

# SaltedPassword

> SaltedPassword  := Hi(Normalize(password), salt, i)
> {{Section 3 of RFC5802}}
{: #R-SALTED gi="blockquote"}

> Hi() is, essentially, PBKDF2 [RFC2898] with HMAC() as the pseudorandom function (PRF) and with dkLen == output length of HMAC() == output length of H().
> {{Section 2.2 of RFC5802}}
{: #R-HI gi="blockquote"}

## A refused count {#refused-count}

Hi takes at least one round, U1. scramSha256SaltedPassword MUST return null
when the iteration count is less than 1.
{: #R-COUNT}

# ClientProof

> ClientKey       := HMAC(SaltedPassword, "Client Key")
> StoredKey       := H(ClientKey)
> {{Section 3 of RFC5802}}
{: #R-CLIENT-KEY gi="blockquote"}

> ClientSignature := HMAC(StoredKey, AuthMessage)
> ClientProof     := ClientKey XOR ClientSignature
> {{Section 3 of RFC5802}}
{: #R-PROOF gi="blockquote"}

# ServerSignature

> ServerKey       := HMAC(SaltedPassword, "Server Key")
> ServerSignature := HMAC(ServerKey, AuthMessage)
> {{Section 3 of RFC5802}}
{: #R-SERVER-SIG gi="blockquote"}

# Laws

The ClientProof and ServerSignature of RFC 5802 Section 3 are each a fixed
composition of HMAC-SHA-256 and SHA-256 over SaltedPassword, and
SaltedPassword is PBKDF2-HMAC-SHA-256 with a 32-byte output. The clauses
below state those compositions against the reference functions of
nish/crypto/hmac and nish/crypto/sha256, for any key and AuthMessage, where
the vectors hold one exchange. The bytes `[43 6c 69 65 6e 74 20 4b 65 79]`
are "Client Key" and `[53 65 72 76 65 72 20 4b 65 79]` are "Server Key".

~~~ ts-property
// P-HI covers R-SALTED, R-HI — SaltedPassword is PBKDF2-HMAC-SHA-256 with a 32-byte key
// samples: 32
forall (pw: u8[] /* 0..24 */, salt: u8[] /* 0..24 */, n: i32 /* 1..3 */) => {
  const sp = scramSha256SaltedPassword(pw, salt, n);
  return sp !== null && unwrap(sp).length === 32 && unwrap(sp) === unwrap(pbkdf2HmacSha256(pw, salt, n, 32));
}
~~~

~~~ ts-property
// P-COUNT covers R-COUNT — a count below 1 is null
// samples: 32
forall (pw: u8[] /* 0..24 */, salt: u8[] /* 0..24 */, n: i32 /* -3..0 */) => scramSha256SaltedPassword(pw, salt, n) === null
~~~

~~~ ts-property
// P-PROOF covers R-SHA256, R-CLIENT-KEY, R-PROOF — ClientProof is ClientKey XOR HMAC(H(ClientKey), AuthMessage)
// samples: 64
forall (sp: u8[] /* 0..80 */, am: u8[] /* 0..96 */) => {
  const ck = hmacSha256(sp, [43 6c 69 65 6e 74 20 4b 65 79]);
  return scramSha256ClientProof(sp, am) === xor(ck, hmacSha256(sha256(ck), am));
}
~~~

~~~ ts-property
// P-SERVER-SIG covers R-SHA256, R-SERVER-SIG — ServerSignature is HMAC(HMAC(SaltedPassword, "Server Key"), AuthMessage)
// samples: 64
forall (sp: u8[] /* 0..80 */, am: u8[] /* 0..96 */) => scramSha256ServerSignature(sp, am) === hmacSha256(hmacSha256(sp, [53 65 72 76 65 72 20 4b 65 79]), am)
~~~

The proof is also the server's check: it recovers ClientKey as
`xor(ClientProof, ClientSignature)` and compares `H(ClientKey)` with
StoredKey. P-PROOF states the same XOR, so no separate clause states it.

# Security Considerations

SaltedPassword, ClientKey and ServerKey each let whoever holds them
authenticate as the user, so the module takes and gives SaltedPassword as a
`Secret` and wipes ClientKey, StoredKey, ClientSignature and ServerKey before
it returns. ClientProof and ServerSignature are sent in the clear and are
plain bytes. A caller compares a server's signature with
`timingSafeEqual`. The iteration count is the server's to choose: a caller
caps it, since Hi runs that many HMACs. No returned value shows the wipes, so
no vector here tests them; the module's security record does.

# Test Vectors

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| S1 | `scramSha256SaltedPassword("pencil", [5b 6d 99 68 9d 12 35 8e ec a0 4b 14 12 36 fa 81], 4096)` | `[c4 a4 95 10 32 3a b4 f9 52 ca c1 fa 99 44 19 39 e7 8e a7 4d 6b e8 1d df 70 96 e8 75 13 dc 61 5d]` | R-SHA256, R-SALTED, R-HI | `python3 -c 'import base64, hashlib; print(hashlib.pbkdf2_hmac("sha256", b"pencil", base64.b64decode("W22ZaJ0SNY7soEsUEjb6gQ=="), 4096).hex())'` | RFC 7677 §3: SaltedPassword for 'pencil' under the exchange's salt and count |
| S2 | `scramSha256ClientProof([c4 a4 95 10 32 3a b4 f9 52 ca c1 fa 99 44 19 39 e7 8e a7 4d 6b e8 1d df 70 96 e8 75 13 dc 61 5d], "n=user,r=rOprNGfwEbeRWgbNEkqO,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096,c=biws,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0")` | `[74 7c db 65 aa 56 22 4e 23 52 13 7e 52 d7 bd ca d6 a0 f7 38 df 30 78 2c aa 69 a2 cf b0 27 75 54]` | R-SHA256, R-CLIENT-KEY, R-PROOF | `python3 -c 'import base64; print(base64.b64decode("dHzbZapWIk4jUhN+Ute9ytag9zjfMHgsqmmiz7AndVQ=").hex())'` | RFC 7677 §3: the client-final message's p= |
| S3 | `scramSha256ServerSignature([c4 a4 95 10 32 3a b4 f9 52 ca c1 fa 99 44 19 39 e7 8e a7 4d 6b e8 1d df 70 96 e8 75 13 dc 61 5d], "n=user,r=rOprNGfwEbeRWgbNEkqO,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096,c=biws,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0")` | `[ea ba e2 4d 10 62 db 75 a9 45 1f f0 b6 ea 7e 98 c8 54 65 49 ff 74 1e 67 2d 32 51 b2 39 7d e4 6e]` | R-SHA256, R-SERVER-SIG | `python3 -c 'import base64; print(base64.b64decode("6rriTRBi23WpRR/wtup+mMhUZUn/dB5nLTJRsjl95G4=").hex())'` | RFC 7677 §3: the server-final message's v= |
| S4 | `scramSha256SaltedPassword("pencil", [5b 6d 99 68 9d 12 35 8e ec a0 4b 14 12 36 fa 81], 0)` | `null` | R-COUNT | {{refused-count}} | an iteration count of 0 is null |
