# Security record: bcrypt

The record of `nish/crypto/bcrypt` (#873): bcrypt password hashing, `$2b$`
out and `$2a$`, `$2b$`, `$2y$` in. It sets down what the reference
implementations do with each kind of key before the module was written, the
choices the module makes where they differ, what the module wipes and what no
wipe reaches, and the test that pins each property. It is written with the
code rather than after an audit, so that the audit starts from evidence.

Anchors are function names in `std/crypto/bcrypt.ts` on the head that merges
this record.

**Result.** For every password, salt and cost tried, the module makes the hash
libxcrypt's `crypt_r` makes, `crypt_r` accepts the hash the module makes, and
the module answers every `$2a$`, `$2b$` and `$2y$` verify as `crypt_r` does,
NULs, 8-bit bytes and passwords past 72 bytes included. The password is only
read inside `exposeWith`; the Blowfish state, the expanded key, the key stream,
the block and the digest are wiped by stores `opt -O2` keeps; the verify
compares the whole 60-character hash in constant time. Two things are not
reached, by the nature of the algorithm or of the language, and are recorded:
the secret-indexed S-box loads (BCRYPT-6) and registers and spills (BCRYPT-7).
Nothing was found to fix or left open.

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/bcrypt.ts` | `bcryptHash`, `bcryptVerify`; `bcryptRun`, `bcryptExposed`, `bcryptSetKey`, `bcryptInitState`, `bcryptEncrypt`, `bcryptBody`, `bcryptXorKey`, `bcryptXorSalt`, `bcryptStore`, `bcryptMagic`; `bcryptParse`, `bcryptDecodeSalt`, `bcryptSaltWords`, `bcryptSettingOf`, `bcryptEncode`, `bcryptPut`, `bcryptCharOf`, `bcryptSextetOf` |

Out of scope: `timingSafeEqual` (`std/crypto/ct.ts`, in
[crypto-k1.md](crypto-k1.md)), the `Secret` rules the checker enforces
([secret.md](secret.md)), where the salt comes from (the caller's CSPRNG), and
how a program stores hashes or rate-limits guesses.

## Threat model

Two attackers. The first holds a stolen hash and wants the password: bcrypt's
cost is the defence, and a win here is a hash cheaper to test than the
reference's, or one that verifies a password it should not. The second can
call `bcryptVerify` with any hash string and password and time it, or read the
process's memory after a call returns: a win is a panic, a hash string that
reads past its bytes, a verify whose time follows how many characters matched,
or the password, or the state derived from it, left in memory.

## The reference's behaviour

The references are OpenBSD's `bcrypt.c`, Solar Designer's crypt_blowfish 1.3
(the code the module adapts) and libxcrypt's `crypt_r`, which uses
crypt_blowfish. They agree on every row but the last two, where OpenBSD differs
and the module follows crypt_blowfish and libxcrypt.

| Input | What the references do | What the module does |
| --- | --- | --- |
| The key bytes | The password as a C string, its terminating NUL included, cycled until the 18 P words (72 bytes) are filled. | The same. |
| A password of 72 bytes or more | The first 72 bytes are used; the terminating NUL is not reached, and the rest is ignored. | The same (BCRYPT-1). |
| An embedded NUL | The key ends at it: C reads a string to its first NUL, so `ab\0cd` is the key of `ab`. | The same (BCRYPT-2). |
| 8-bit bytes, `$2b$` and `$2y$` | Read unsigned. | The same. |
| 8-bit bytes, `$2a$` | crypt_blowfish's countermeasure: if building the key with sign-extended bytes, as the old bug did, gives a different key, bit 16 of P[0] is flipped, so no hash the bug made verifies. | The same (BCRYPT-3). |
| `$2x$` | crypt_blowfish and libxcrypt reproduce the bug, for old hashes; OpenBSD refuses it. | Refused (BCRYPT-3). |
| The salt's last character | It carries 4 bits of the 128; the 2 low bits of its sextet are dropped, and the hash made is written with them cleared. | The same; a hash string with them set verifies false, as `crypt_r`'s whole-string compare does (BCRYPT-4). |
| A cost outside 04–31, a bad prefix or character | Refused (`*0`/`*1` from `crypt_r`, -1 from OpenBSD). | An `Err` naming it (BCRYPT-5). |
| `$2b$` with a password over 255 bytes | OpenBSD's old `$2a$` wrapped the length in a `u8`; `$2b$` was made to mark the fix. | Not reachable: no length is stored. |

## Findings

Rows BCRYPT-1 to BCRYPT-5 are the decisions a reviewer might question, each
following the reference; BCRYPT-6 and BCRYPT-7 are what a wipe and a
constant-time compare cannot reach. They are accepted, not findings, and none
is counted as fixed or open in the index.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| BCRYPT-1 | Low | `bcryptSetKey` | A password past 72 bytes hashes as its first 72, so two passwords sharing those verify each other. | **Accepted.** Every C implementation cuts there, and a hash is useful only if the reference verifies it: refusing would make a password a C server accepts fail here, and pre-hashing it would make a hash no other implementation verifies. A program that wants long passphrases to count whole can pass an HMAC of them as the password; the guide page says so. |
| BCRYPT-2 | Low | `bcryptSetKey` | A NUL ends the key, so `ab\0cd` verifies `ab`. | **Accepted.** As BCRYPT-1: `crypt_r` takes a C string, so a hash made with the NUL kept would verify nowhere else. Text from a form has no NUL; a program hashing raw bytes refuses one itself. |
| BCRYPT-3 | Low | `bcryptSetKey`, `bcryptParse` | `$2x$` hashes, made by the sign-extension bug, cannot be verified. | **Accepted.** Verifying them means running the bug; the systems that made them were told to rehash in 2011. `$2a$` keeps the countermeasure, so a `$2a$` hash made with the bug verifies false rather than verifying the wrong password. |
| BCRYPT-4 | Low | `bcryptDecodeSalt` | A hash whose last salt character has the dropped bits set verifies false for its own password. | **Accepted.** It is `crypt_r`'s answer: it rebuilds the string with the bits cleared and compares the whole of it. Accepting it would make a hash string that verifies here and not there. |
| BCRYPT-5 | Low if it failed | `bcryptVerify`, `bcryptParse` | A hash string of any length or bytes must not panic or read past itself. | **Holds.** The length is checked to be 60 first; every character after that is read at an index below 60 and checked against the alphabet, each refusal an `Err`. |
| BCRYPT-6 | Low | `bcryptEncrypt` | Each Blowfish round loads four S-box words at indexes taken from the secret state, so the cache lines touched follow the password. | **Accepted.** It is the algorithm: every bcrypt does it, and the expensive key setup that is bcrypt's point is made of these loads. A local attacker sharing a cache with the hashing core could in principle learn about the state; a remote one times a cost-10 hash of ~50 ms, against which the loads' variance is noise. The key schedule (`bcryptSetKey`) does not branch on a password byte, and the verify's compare is constant-time. |
| BCRYPT-7 | Low | `bcryptExposed` | Values the generated code holds in registers, and any it spills to the stack, are not wiped; nor is the caller's own copy of the password before it became a `Secret`. | **Accepted.** No store from the language reaches a register or a spill slot (as AEAD-4 for the AES kernels). Every array the hash allocates is wiped; the `Secret` the caller passes is the caller's to wipe, and the checker makes it do so. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding. The
module's own checks are lines of `tests/link/crypto_bcrypt/expected.out`,
which `link/crypto_bcrypt: exits with 0 and stdout matches expected.out`
compares byte for byte; the same program under `--number-mode f64` is
`link/crypto_bcrypt_f64: exits with 0 and stdout matches expected.out`.

**The reference's answers** (crypt_blowfish's `wrapper.c` and libxcrypt's
vectors): "U*U", "U*U*", "U*U*U", "the empty password", "72 bytes of \xaa,
then more", "\xaa\x55 36 times", "\x55\xaa\xff 24 times", "hash U*U at cost
4", "hash U* at cost 4", "hash U*V at cost 4", "hash the empty password at
cost 5", "hash ab".

**Against `crypt_r`, both ways, on random inputs**: `bcrypt differential: Nish
and libxcrypt crypt_r agree on random passwords and salts, both ways`
(`tests/differential/bcrypt.js`): 48 seeded cases of 0 to 80 bytes over every
byte value at cost 4 to 6, of which 16 hold a NUL, 35 an 8-bit byte and 12 run
past 72 bytes. Each passes when the module's `$2b$` hash is `crypt_r`'s,
`crypt_r` accepts it, and the module verifies `crypt_r`'s `$2a$`, `$2b$` and
`$2y$` hashes and refuses a wrong password as `crypt_r` does. Without a C
compiler or libxcrypt it skips, saying which.

**The 72-byte cut and the NUL** (BCRYPT-1, BCRYPT-2): "a key past 72 bytes:
the rest is ignored", "hash a 72-byte password at cost 6", "a 73rd byte changes
nothing", "200 x hash as 72", "72 x", "ab\0cd hashes as ab: the key ends at its
first NUL", "and verifies as ab".

**8-bit bytes and the sign-extension bug** (BCRYPT-3): "$2y$ \xff\xff\xa3",
"$2b$ \xff\xff\xa3 is $2y$'s digest", "$2a$ \xff\xff\xa3 takes the
countermeasure", "and is not the $2y$ digest under $2a$", "$2a$ \xa3 (one
8-bit byte: no countermeasure needed)", "$2a$ \xff\xa334\xff\xff\xff\xa3345",
"$2y$ \xff\xa334\xff\xff\xff\xa3345", "$2a$ \xa3ab", "$2y$ \xa3ab", "hash
\xa3", "hash \xff\xa334\xff\xff\xff\xa3345", "$2x$ \xa3 is refused", "$2x$
\xd1\x91 is refused".

**The salt's last character** (BCRYPT-4): "the canonical last salt character
verifies", "one with dropped bits set does not, as with crypt_r".

**Verify and refusals** (BCRYPT-5): "a hash verifies under its own password",
"and not under another", "nor under the empty password", "cost 3 is refused",
"cost 32 is refused", "a 15-byte salt is refused", "a 17-byte salt is
refused", "a 59-character hash is refused", "a 61-character hash is refused",
"the empty string is refused", "$2c$ is refused", "$3b$ is refused", "a cost
that is not two digits is refused", "cost 03 is refused", "cost 32 in a hash
is refused", "a salt character outside bcrypt base64 is refused", "a digest
character outside bcrypt base64 is refused".

**The `Secret` boundary**: a plain `u8[]` password does not compile
(`reject_bcrypt_plain_password: rejected with "Argument 1 of
\`nish.bcryptHash\`: expected Secret<u8[]>, got u8[]"`), nor does a program
that leaves the `Secret` it passed unwiped
(`reject_bcrypt_password_not_wiped: rejected with "that this exit leaves
neither wiped nor returned"`), nor one that drops a verify's answer
(`reject_bcrypt_result_dropped: rejected with "\`Result<boolean, string>\`
must be handled, not discarded"`).

**The wipes survive `-O2`**: `crypto: the wipes survive opt -O2 (bcrypt's
Blowfish state, expanded key, key stream, block and digest in bcryptExposed)`
(`tests/wipes/crypto.js`) counts six volatile wipes reached from
`bcryptExposed`, `bcryptHash` and `bcryptVerify` after `opt -O2`. Turning the
state's `wipe` into `fill(0)` drops each count to five.

**wasm32**: the module has no I/O and no C; `crypto_bcrypt` builds and runs
under WASI with the rest of `std/crypto` (`node tests/run.js wasi`).

## Speed

CPU milliseconds per cost-10 hash, single-threaded, on the x86-64 box the
module was written on (`bench/crypto/bcrypt/run.mjs`: user time of 8 hashes,
median and spread of 5 interleaved rounds; all four print the same hash):

| Implementation | ms per hash |
| --- | ---: |
| Nish (`nish/crypto/bcrypt`) | 52.1 (51.9–52.4) |
| libxcrypt `crypt_r`, `$2b$` | 48.4 (47.5–48.6) |
| OpenBSD `bcrypt.c`, `gcc -O2` | 48.4 (47.9–48.4) |
| OpenBSD `bcrypt.c`, `clang -O2` | 53.9 (53.5–54.1) |

Nish is 8% behind gcc's builds and level with clang's: Cachegrind counts
fewer instructions for Nish (2.30 G against libxcrypt's 2.54 G per run), no
bounds check is left in the round (every S-box index is masked to 0–255 and
the state's length is checked once), and the gap is LLVM's scheduling of the
round against gcc's, which the clang build of the same C shows.
