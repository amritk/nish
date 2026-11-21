---
title: "SHA-1"
abbrev: nish/crypto/sha1
docname: draft-rfc6234-sha1-00
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

A profile of RFC 6234's SHA-1 test results for sha1 in nish/crypto/sha1
(std/crypto/sha1.ts). It holds every byte-length test of Section 8.5 that
vector can state, and properties of the digest's length and of its
dependence on every byte.

--- middle

# Introduction

{::boilerplate bcp14-tagged}

nish/crypto/sha1 exports `sha1`, a one-shot digest of a byte array. RFC 6234
does not specify SHA-1 (its Section 1 points to RFC 3174), but it carries
SHA-1's code (Section 8.2.1) and its test results (Section 8.5), which
this profile cites. RFC 6234 is profiled one module at a time: a vector contract has one module under test, and vector 0.6.0 refuses a row that calls a reference function ("a vector tests nish/crypto/sha512, the module under test, so call one of its functions"). This profile tests nish/crypto/sha1; SHA-256 and SHA-384/SHA-512 are profiled by rfc6234-sha256 and rfc6234-sha512.

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
  bytes (the extra-bits tests). `sha1`
  takes a byte array, so there is no call that states them.

Out of scope: Sha1, the streaming form of sha1; a vector row and a property here call only functions, so the class is left to nish's own tests (tests/run.js)

Out of scope: SHA1\_SIZE, a constant, not a function; the properties test the digest length it names

Out of scope: SHA1\_BLOCK, a constant, not a function; it names the block size the two-block vectors cross

# Interface

~~~ ts-interface
// module: nish/crypto/sha1
export const sha1 = (data: u8[]): u8[]
~~~

# The Function

> The SHA-1 algorithm produces a 160-bit message digest for a * given data stream that can serve as a means of providing a * "fingerprint" for a message.
> {{Section 8.2.1 of RFC6234}}
{: #R-SHA1-OUT gi="blockquote"}

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
// P-LEN-1 covers R-SHA1-OUT — sha1 gives 20 bytes (160 bits) for any message
forall (m: u8[] /* 0..300 */) => sha1(m).length === 20
~~~

~~~ ts-property
// P-CHUNK covers R-SHA1-OUT — the digest depends on every byte: appending one byte changes it
forall (m: u8[] /* 0..300 */, b: u8[] /* 1..1 */) => sha1(m) !== sha1(m.concat(b))
~~~

# Test Vectors

| Id | Call | Expected | Covers | Source | Title |
|----|------|----------|--------|--------|-------|
| SHA-1-1 | `sha1("abc")` | `[a9 99 3e 36 47 06 81 6a ba 3e 25 71 78 50 c2 6c 9c d0 d8 9d]` | R-SHA1-OUT, R-DRIVER, R-ASCII | `python3 -c 'import hashlib; print(hashlib.sha1(b"abc").hexdigest())'` | RFC 6234 §8.5: SHA-1 test 1, "abc", one block |
| SHA-1-2 | `sha1("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")` | `[84 98 3e 44 1c 3b d2 6e ba ae 4a a1 f9 51 29 e5 e5 46 70 f1]` | R-SHA1-OUT, R-DRIVER, R-ASCII | `python3 -c 'import hashlib; print(hashlib.sha1(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq").hexdigest())'` | RFC 6234 §8.5: SHA-1 test 2, the two-block string |
| SHA-1-4 | `sha1("0123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567")` | `[de a3 56 a2 cd dd 90 c7 a7 ec ed c5 eb b5 63 93 4f 46 04 52]` | R-SHA1-OUT, R-DRIVER, R-ASCII | `python3 -c 'import hashlib; print(hashlib.sha1(b"0123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567012345670123456701234567").hexdigest())'` | RFC 6234 §8.5: SHA-1 test 4, 640 bytes, ten copies of a 64-byte string |
| SHA-1-6 | `sha1([5e])` | `[5e 6f 80 a3 4a 97 98 ca fc 6a 5d b9 6c c5 7b a4 c4 db 59 c2]` | R-SHA1-OUT, R-DRIVER | `python3 -c 'import hashlib; print(hashlib.sha1(bytes.fromhex("5e")).hexdigest())'` | RFC 6234 §8.5: SHA-1 test 6, one byte |
| SHA-1-8 | `sha1([9a 7d fd f1 ec ea d0 6e d6 46 aa 55 fe 75 71 46])` | `[82 ab ff 66 05 db e1 c1 7d ef 12 a3 94 fa 22 a8 2b 54 4a 35]` | R-SHA1-OUT, R-DRIVER | `python3 -c 'import hashlib; print(hashlib.sha1(bytes.fromhex("9a7dfdf1ecead06ed646aa55fe757146")).hexdigest())'` | RFC 6234 §8.5: SHA-1 test 8, 16 bytes |
| SHA-1-10 | `sha1([f7 8f 92 14 1b cd 17 0a e8 9b 4f ba 15 a1 d5 9f 3f d8 4d 22 3c 92 51 bd ac bb ae 61 d0 5e d1 15 a0 6a 7c e1 17 b7 be ea d2 44 21 de d9 c3 25 92 bd 57 ed ea e3 9c 39 fa 1f e8 94 6a 84 d0 cf 1f 7b ee ad 17 13 e2 e0 95 98 97 34 7f 67 c8 0b 04 00 c2 09 81 5d 6b 10 a6 83 83 6f d5 56 2a 56 ca b1 a2 8e 81 b6 57 66 54 63 1c f1 65 66 b8 6e 3b 33 a1 08 b0 53 07 c0 0a ff 14 a7 68 ed 73 50 60 6a 0f 85 e6 a9 1d 39 6f 5b 5c be 57 7f 9b 38 80 7c 7d 52 3d 6d 79 2f 6e bc 24 a4 ec f2 b3 a4 27 cd bb fb])` | `[cb 00 82 c8 f1 97 d2 60 99 1b a6 a4 60 e7 6e 20 2b ad 27 b3]` | R-SHA1-OUT, R-DRIVER | `python3 -c 'import hashlib; print(hashlib.sha1(bytes.fromhex("f78f92141bcd170ae89b4fba15a1d59f3fd84d223c9251bdacbbae61d05ed115a06a7ce117b7beead24421ded9c32592bd57edeae39c39fa1fe8946a84d0cf1f7beead1713e2e0959897347f67c80b0400c209815d6b10a683836fd5562a56cab1a28e81b6576654631cf16566b86e3b33a108b05307c00aff14a768ed7350606a0f85e6a91d396f5b5cbe577f9b38807c7d523d6d792f6ebc24a4ecf2b3a427cdbbfb")).hexdigest())'` | RFC 6234 §8.5: SHA-1 test 10, 163 bytes |
