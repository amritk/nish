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

RFC 7677 Section 3 prints one SCRAM-SHA-256 exchange, as base64 inside
wrapped protocol messages. vector binds a printed string to a value only
whole and only beside the other values on its line, so the exchange cannot be
cited value by value. Each vector below therefore takes its expected value
from a command that `spec check --run-sources` runs: Python's hashlib for
SaltedPassword, which the exchange does not print, and a base64 decode of the
printed `p=` and `v=` for ClientProof and ServerSignature, so those two are
the RFC's own values.

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
