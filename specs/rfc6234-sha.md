---
title: "SHA-384 and SHA-512"
abbrev: nish/crypto/sha512
docname: draft-rfc6234-sha-00
category: info
ipr: trust200902
submissiontype: independent
v: 3
date: 2026-11-21
author:
  - name: Nish Authors
    org: nish
normative:
  RFC6234:
keyword:
  - vector-main-RFC6234
--- abstract

A profile of RFC 6234's SHA-384 and SHA-512 test results for sha384 and
sha512 in nish/crypto/sha512 (std/crypto/sha512.ts). It holds every
byte-length test of Section 8.5 that vector can state, and digest-length
properties that also cover sha1 and sha256.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

nish/crypto/sha512 exports `sha512` and `sha384`, one-shot digests of a byte
array. A vector contract has one module under test: a vector row may call
only that module's functions, and vector 0.6.0 refuses a row that calls a
reference function ("a vector tests nish/crypto/sha512, the module under
test, so call one of its functions"). This profile tests nish/crypto/sha512.
nish/crypto/sha1 and nish/crypto/sha256 are declared as reference modules,
so the digest-length property checks `sha1` and `sha256` as well, but their
Section 8.5 results need a contract of their own each.

Section 8.5 prints its test inputs as C macros, some of them concatenations
of string literals, and its results as uppercase hexadecimal split across C
string literals, so vector cannot find a result's bytes in the RFC's text
("the 64-byte expect is not printed in rfc6234 §8.5"). Each vector therefore
takes its expected value from Python's hashlib, as a command
`spec check --run-sources` runs. The inputs are the bytes the driver's
macros spell, and each digest hashlib prints is the one Section 8.5 prints,
byte for byte; both were checked against the RFC's text before they were
written here.

Not every Section 8.5 test is held:

- Test 3 hashes "a" a million times. vector 0.6.0 refuses the literal `1000000 × 61`
   ("Call: a repeated run expands to at most 65536 bytes"),
  and an Iterate row feeds each result back into the next call, so it
  cannot state a million-byte input. The row is left out rather than marked
  slow: it cannot be written at all.
- Tests 5, 7 and 9 hash messages whose length is not a whole number of
  bytes (the extra-bits tests). `sha384` and `sha512` take a byte array,
  so there is no call that states them.
- SHA-224 has no export in nish's standard library.

Out of scope: Sha512, the streaming form of sha512; a vector row and a property here call only functions, so the classes are left to nish's own tests (tests/run.js)

Out of scope: Sha384, the streaming form of sha384; a vector row and a property here call only functions, so the classes are left to nish's own tests (tests/run.js)

Out of scope: SHA512\_SIZE, a constant, not a function; the properties test the digest length it names

Out of scope: SHA384\_SIZE, a constant, not a function; the properties test the digest length it names

Out of scope: SHA512\_BLOCK, a constant, not a function; it names the block size the two-block vectors cross

# Interface

~~~ ts-interface
// module: nish/crypto/sha512
export const sha512 = (data: u8[]): u8[]
export const sha384 = (data: u8[]): u8[]
// module: nish/crypto/sha256
export const sha256 = (data: u8[]): u8[]
// module: nish/crypto/sha1
export const sha1 = (data: u8[]): u8[]
~~~

# The Functions

> When a message of any length < 2^64 bits (for SHA-224 and SHA-256) or < 2^128 bits (for SHA-384 and SHA-512) is input to one of these algorithms, the result is an output called a message digest.
> {{Section 1 of RFC6234}}
{: #R-DIGEST gi="blockquote"}

> For SHA-512, this is the concatenation of all of H(N)0, H(N)1, through H(N)7.
> {{Section 6.4 of RFC6234}}
{: #R-SHA512-OUT gi="blockquote"}

> For SHA-384, this is the concatenation of H(N)0, H(N)1, through H(N)5.
> {{Section 6.4 of RFC6234}}
{: #R-SHA384-OUT gi="blockquote"}

> For SHA-384, the initial hash value, H(0), consists of the following eight 64-bit words, in hex.
> {{Section 6.3 of RFC6234}}
{: #R-SHA384-IV gi="blockquote"}

> For SHA-256, this is the concatenation of all of H(N)0, H(N)1, through H(N)7.
> {{Section 6.2 of RFC6234}}
{: #R-SHA256-OUT gi="blockquote"}

# The Test Driver

> The following code is a main program test driver to exercise the code in sha1.c, sha224-256.c, sha384-512.c, hmac.c, and hkdf.c.
> {{Section 8.5 of RFC6234}}
{: #R-DRIVER gi="blockquote"}

> Note that the tests assume that character values are as in [US-ASCII] and a run time check warns if the code appears to have been compiled with some other character system.
> {{Section 8.5 of RFC6234}}
{: #R-ASCII gi="blockquote"}

# The Code's Licence

> IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
> {{Section 8.1.1 of RFC6234}}
{: gi="blockquote"}

Untested: a term of the licence on the RFC's C code, which nish does not copy; no behaviour of a hash function can satisfy or violate it

# Properties

~~~ ts-property
// P-LEN-512 covers R-DIGEST, R-SHA512-OUT — sha512 gives 64 bytes for any message
forall (m: u8[] /* 0..300 */) => sha512(m).length === 64
~~~

~~~ ts-property
// P-LEN-384 covers R-DIGEST, R-SHA384-OUT — sha384 gives 48 bytes for any message
forall (m: u8[] /* 0..300 */) => sha384(m).length === 48
~~~

~~~ ts-property
// P-LEN-ALL covers R-DIGEST, R-SHA384-OUT, R-SHA256-OUT — on one message sha384, sha256 and sha1 give 48, 32 and 20 bytes
forall (m: u8[] /* 0..300 */) =>
  sha384(m).length === 48 && sha256(m).length === 32 && sha1(m).length === 20
~~~

~~~ ts-property
// P-384-IV covers R-SHA384-IV — SHA-384 starts from its own initial hash value, so it is not SHA-512 cut to 48 bytes
forall (m: u8[] /* 0..300 */) => sha384(m) !== sha512(m).slice(0, 48)
~~~

~~~ ts-property
// P-CHUNK covers R-DIGEST — the digest depends on every byte: appending one byte changes it
forall (m: u8[] /* 0..300 */, b: u8[] /* 1..1 */) => sha512(m) !== sha512(m.concat(b))
~~~

# Test Vectors

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| SHA-384-1 | `sha384("abc")` | `[cb 00 75 3f 45 a3 5e 8b b5 a0 3d 69 9a c6 50 07 27 2c 32 ab 0e de d1 63 1a 8b 60 5a 43 ff 5b ed 80 86 07 2b a1 e7 cc 23 58 ba ec a1 34 c8 25 a7]` | R-SHA384-OUT, R-DRIVER, R-ASCII | `python3 -c 'import hashlib; print(hashlib.sha384(b"abc").hexdigest())'` | RFC 6234 §8.5: SHA-384 test 1, "abc", one block |
| SHA-384-2 | `sha384("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu")` | `[09 33 0c 33 f7 11 47 e8 3d 19 2f c7 82 cd 1b 47 53 11 1b 17 3b 3b 05 d2 2f a0 80 86 e3 b0 f7 12 fc c7 c7 1a 55 7e 2d b9 66 c3 e9 fa 91 74 60 39]` | R-SHA384-OUT, R-DRIVER, R-ASCII | `python3 -c 'import hashlib; print(hashlib.sha384(b"abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu").hexdigest())'` | RFC 6234 §8.5: SHA-384 test 2, the two-block string |
| SHA-384-4 | `sha384("0123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567")` | `[2f c6 4a 4f 50 0d db 68 28 f6 a3 43 0b 8d d7 2a 36 8e b7 f3 a8 32 2a 70 bc 84 27 5b 9c 0b 3a b0 0d 27 a5 cc 3c 2d 22 4a a6 b6 1a 0d 79 fb 45 96]` | R-SHA384-OUT, R-DRIVER, R-ASCII | `python3 -c 'import hashlib; print(hashlib.sha384(b"0123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567").hexdigest())'` | RFC 6234 §8.5: SHA-384 test 4, 640 bytes, ten copies of a 64-byte string |
| SHA-384-6 | `sha384([b9])` | `[bc 80 89 a1 90 07 c0 b1 41 95 f4 ec c7 40 94 fe c6 4f 01 f9 09 29 28 2c 2f b3 92 88 15 78 20 8a d4 66 82 8b 1c 6c 28 3d 27 22 cf 0a d1 ab 69 38]` | R-SHA384-OUT, R-DRIVER | `python3 -c 'import hashlib; print(hashlib.sha384(bytes.fromhex("b9")).hexdigest())'` | RFC 6234 §8.5: SHA-384 test 6, one byte |
| SHA-384-8 | `sha384([a4 1c 49 77 79 c0 37 5f f1 0a 7f 4e 08 59 17 39])` | `[c9 a6 84 43 a0 05 81 22 56 b8 ec 76 b0 05 16 f0 db b7 4f ab 26 d6 65 91 3f 19 4b 6f fb 0e 91 ea 99 67 56 6b 58 10 9c bc 67 5c c2 08 e4 c8 23 f7]` | R-SHA384-OUT, R-DRIVER | `python3 -c 'import hashlib; print(hashlib.sha384(bytes.fromhex("a41c497779c0375ff10a7f4e08591739")).hexdigest())'` | RFC 6234 §8.5: SHA-384 test 8, 16 bytes |
| SHA-384-10 | `sha384([39 96 69 e2 8f 6b 9c 6d bc bb 69 12 ec 10 ff cf 74 79 03 49 b7 dc 8f be 4a 8e 7b 3b 56 21 db 0f 3e 7d c8 7f 82 32 64 bb e4 0d 18 11 c9 ea 20 61 e1 c8 4a d1 0a 23 fa c1 72 7e 72 02 fc 3f 50 42 e6 bf 58 cb a8 a2 74 6e 1f 64 f9 b9 ea 35 2c 71 15 07 05 3c f4 e5 33 9d 52 86 5f 25 cc 22 b5 e8 77 84 a1 2f c9 61 d6 6c b6 e8 95 73 19 9a 2c e6 56 5c bd f1 3d ca 40 38 32 cf cb 0e 8b 72 11 e8 3a f3 2a 11 ac 17 92 9f f1 c0 73 a5 1c c0 27 aa ed ef f8 5a ad 7c 2b 7c 5a 80 3e 24 04 d9 6d 2a 77 35 7b da 1a 6d ae ed 17 15 1c b9 bc 51 25 a4 22 e9 41 de 0c a0 fc 50 11 c2 3e cf fe fd d0 96 76 71 1c f3 db 0a 34 40 72 0e 16 15 c1 f2 2f bc 3c 72 1d e5 21 e1 b9 9b a1 bd 55 77 40 86 42 14 7e d0 96])` | `[4f 44 0d b1 e6 ed d2 89 9f a3 35 f0 95 15 aa 02 5e e1 77 a7 9f 4b 4a af 38 e4 2b 5c 4d e6 60 f5 de 8f b2 a5 b2 fb d2 a3 cb ff d2 0c ff 12 88 c0]` | R-SHA384-OUT, R-DRIVER | `python3 -c 'import hashlib; print(hashlib.sha384(bytes.fromhex("399669e28f6b9c6dbcbb6912ec10ffcf74790349b7dc8fbe4a8e7b3b5621db0f3e7dc87f823264bbe40d1811c9ea2061e1c84ad10a23fac1727e7202fc3f5042e6bf58cba8a2746e1f64f9b9ea352c711507053cf4e5339d52865f25cc22b5e87784a12fc961d66cb6e89573199a2ce6565cbdf13dca403832cfcb0e8b7211e83af32a11ac17929ff1c073a51cc027aaedeff85aad7c2b7c5a803e2404d96d2a77357bda1a6daeed17151cb9bc5125a422e941de0ca0fc5011c23ecffefdd09676711cf3db0a3440720e1615c1f22fbc3c721de521e1b99ba1bd5577408642147ed096")).hexdigest())'` | RFC 6234 §8.5: SHA-384 test 10, 227 bytes |
| SHA-512-1 | `sha512("abc")` | `[dd af 35 a1 93 61 7a ba cc 41 73 49 ae 20 41 31 12 e6 fa 4e 89 a9 7e a2 0a 9e ee e6 4b 55 d3 9a 21 92 99 2a 27 4f c1 a8 36 ba 3c 23 a3 fe eb bd 45 4d 44 23 64 3c e8 0e 2a 9a c9 4f a5 4c a4 9f]` | R-SHA512-OUT, R-DRIVER, R-ASCII | `python3 -c 'import hashlib; print(hashlib.sha512(b"abc").hexdigest())'` | RFC 6234 §8.5: SHA-512 test 1, "abc", one block |
| SHA-512-2 | `sha512("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu")` | `[8e 95 9b 75 da e3 13 da 8c f4 f7 28 14 fc 14 3f 8f 77 79 c6 eb 9f 7f a1 72 99 ae ad b6 88 90 18 50 1d 28 9e 49 00 f7 e4 33 1b 99 de c4 b5 43 3a c7 d3 29 ee b6 dd 26 54 5e 96 e5 5b 87 4b e9 09]` | R-SHA512-OUT, R-DRIVER, R-ASCII | `python3 -c 'import hashlib; print(hashlib.sha512(b"abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu").hexdigest())'` | RFC 6234 §8.5: SHA-512 test 2, the two-block string |
| SHA-512-4 | `sha512("0123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567")` | `[89 d0 5b a6 32 c6 99 c3 12 31 de d4 ff c1 27 d5 a8 94 da d4 12 c0 e0 24 db 87 2d 1a bd 2b a8 14 1a 0f 85 07 2a 9b e1 e2 aa 04 cf 33 c7 65 cb 51 08 13 a3 9c d5 a8 4c 4a ca a6 4d 3f 3f b7 ba e9]` | R-SHA512-OUT, R-DRIVER, R-ASCII | `python3 -c 'import hashlib; print(hashlib.sha512(b"0123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567").hexdigest())'` | RFC 6234 §8.5: SHA-512 test 4, 640 bytes, ten copies of a 64-byte string |
| SHA-512-6 | `sha512([d0])` | `[99 92 20 29 38 e8 82 e7 3e 20 f6 b6 9e 68 a0 a7 14 90 90 42 3d 93 c8 1b ab 3f 21 67 8d 4a ce ee e5 0e 4e 8c af ad a4 c8 5a 54 ea 83 06 82 6c 4a d6 e7 4c ec e9 63 1b fa 8a 54 9b 4a b3 fb ba 15]` | R-SHA512-OUT, R-DRIVER | `python3 -c 'import hashlib; print(hashlib.sha512(bytes.fromhex("d0")).hexdigest())'` | RFC 6234 §8.5: SHA-512 test 6, one byte |
| SHA-512-8 | `sha512([8d 4e 3c 0e 38 89 19 14 91 81 6e 9d 98 bf f0 a0])` | `[cb 0b 67 a4 b8 71 2c d7 3c 9a ab c0 b1 99 e9 26 9b 20 84 4a fb 75 ac bd d1 c1 53 c9 82 89 24 c3 dd ed aa fe 66 9c 5f dd 0b c6 6f 63 0f 67 73 98 82 13 eb 1b 16 f5 17 ad 0d e4 b2 f0 c9 5c 90 f8]` | R-SHA512-OUT, R-DRIVER | `python3 -c 'import hashlib; print(hashlib.sha512(bytes.fromhex("8d4e3c0e3889191491816e9d98bff0a0")).hexdigest())'` | RFC 6234 §8.5: SHA-512 test 8, 16 bytes |
| SHA-512-10 | `sha512([a5 5f 20 c4 11 aa d1 32 80 7a 50 2d 65 82 4e 31 a2 30 54 32 aa 3d 06 d3 e2 82 a8 d8 4e 0d e1 de 69 74 bf 49 54 69 fc 7f 33 8f 80 54 d5 8c 26 c4 93 60 c3 e8 7a f5 65 23 ac f6 d8 9d 03 e5 6f f2 f8 68 00 2b c3 e4 31 ed c4 4d f2 f0 22 3d 4b b3 b2 43 58 6e 1a 7d 92 49 36 69 4f cb ba f8 8d 95 19 e4 eb 50 a6 44 f8 e4 f9 5e b0 ea 95 bc 44 65 c8 82 1a ac d2 fe 15 ab 49 81 16 4b bb 6d c3 2f 96 90 87 a1 45 b0 d9 cc 9c 67 c2 2b 76 32 99 41 9c c4 12 8b e9 a0 77 b3 ac e6 34 06 4e 6d 99 28 35 13 dc 06 e7 51 5d 0d 73 13 2e 9a 0d c6 d3 b1 f8 b2 46 f1 a9 8a 3f c7 29 41 b1 e3 bb 20 98 e8 bf 16 f2 68 d6 4f 0b 0f 47 07 fe 1e a1 a1 79 1b a2 f3 c0 c7 58 e5 f5 51 86 3a 96 c9 49 ad 47 d7 fb 40 d2])` | `[c6 65 be fb 36 da 18 9d 78 82 2d 10 52 8c bf 3b 12 b3 ee f7 26 03 99 09 c1 a1 6a 27 0d 48 71 93 77 96 6b 95 7a 87 8e 72 05 84 77 9a 62 82 5c 18 da 26 41 5e 49 a7 17 6a 89 4e 75 10 fd 14 51 f5]` | R-SHA512-OUT, R-DRIVER | `python3 -c 'import hashlib; print(hashlib.sha512(bytes.fromhex("a55f20c411aad132807a502d65824e31a2305432aa3d06d3e282a8d84e0de1de6974bf495469fc7f338f8054d58c26c49360c3e87af56523acf6d89d03e56ff2f868002bc3e431edc44df2f0223d4bb3b243586e1a7d924936694fcbbaf88d9519e4eb50a644f8e4f95eb0ea95bc4465c8821aacd2fe15ab4981164bbb6dc32f969087a145b0d9cc9c67c22b763299419cc4128be9a077b3ace634064e6d99283513dc06e7515d0d73132e9a0dc6d3b1f8b246f1a98a3fc72941b1e3bb2098e8bf16f268d64f0b0f4707fe1ea1a1791ba2f3c0c758e5f551863a96c949ad47d7fb40d2")).hexdigest())'` | RFC 6234 §8.5: SHA-512 test 10, 227 bytes |
