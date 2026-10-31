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
the module answers every well-formed `$2a$`, `$2b$` and `$2y$` verify as
`crypt_r` does, NULs, 8-bit bytes and passwords past 72 bytes included (a
hash string that is not 60 characters, or has a digest character outside the
alphabet, is an `Err` here, where `crypt_r` reports a mismatch). The password is only
read inside `exposeWith`; the Blowfish state, the expanded key, the key stream,
the block and the digest are wiped by stores `opt -O2` keeps, and so are the
hash the verify rebuilds from the password and the given hash's bytes it
compares that with; the verify compares the whole 60-character hash in
constant time. Two things are not
reached, by the nature of the algorithm or of the language, and are recorded:
the secret-indexed S-box loads (BCRYPT-6) and registers and spills (BCRYPT-7).
Nothing was found to fix or left open. Where the implementations a hash
travels between answer differently, the [interoperability
table](#interoperability) is the one place that says who answers what; the
module departs from `crypt_r` on three rows of it, `$2x$`, a hash string of
the wrong length and a digest character outside the alphabet.

The batch, `bcryptHashN` and `bcryptVerifyN` for one to six passwords and
`bcryptHash4` and `bcryptVerify4` for up to four, gives each lane the single
path's answer byte for byte, so every row of that table holds for it lane by
lane. Its state is one `Secret<u32[]>`, wiped by a store `opt -O2` keeps, as
are its digests and, in the verify, each lane's rebuilt hash and given hash's
bytes; the ways it can differ from single calls (null lanes, a malformed
lane, lanes of different costs) are set down in [The
batch](#the-batch). `bcryptCalibrate`, which picks a width by timing
throwaway passwords, handles no secret of the caller's (BCRYPT-10).

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/bcrypt.ts` | `bcryptHash`, `bcryptVerify`; `bcryptHashInto`, `bcryptHashExposed`, `bcryptVerifyExposed`, `bcryptSameWiped`, `bcryptVerifyOne`, `bcryptExposed`, `bcryptKeySchedule`, `bcryptSetKey`, `bcryptInitState`, `bcryptEncrypt`, `bcryptBody`, `bcryptXorKey`, `bcryptXorSalt`, `bcryptStore`, `bcryptMagic`, `bcryptPutBlock`; `bcryptParse`, `bcryptDecodeSalt`, `bcryptSaltWords`, `bcryptSettingOf`, `bcryptEncode`, `bcryptEncodeInto`, `bcryptPut`, `bcryptCharOf`, `bcryptSextetOf`, `bcryptParseHash`; the batch: `bcryptHashN`, `bcryptVerifyN`, `bcryptHash4`, `bcryptVerify4`, `bcryptVerifyGroup`, `bcryptLoadN`, `bcryptLoadSlot`, `bcryptHashNExposed`, `bcryptVerifyNExposed`, `bcryptMaskOf`, `bcryptSlotsOf`, `bcryptInitN`, `bcryptKeyWord`, `bcryptLoadLane` (and its six `bcryptLoadLane0`–`5`), `bcryptEksN`, `bcryptBodyN`, `bcryptBody2`–`bcryptBody6`, `bcryptEncryptAt`, `bcryptXorKeyN`, `bcryptXorSaltN`, `bcryptExpandAt`, `bcryptMagicAt`, `bcryptSaltOf`, `bcryptBatchSalt`, `bcryptJoin`, `bcryptLaneString`, `bcryptLaneOk`, `bcryptJoinedOk`, `bcryptBytesOf`; the calibration: `bcryptCalibrate`, `bcryptCalibrateTime`, `bcryptCalibrateKey` |

Out of scope: `timingSafeEqual` (`std/crypto/ct.ts`, in
[crypto-k1.md](crypto-k1.md)), the `Secret` rules the checker enforces
([secret.md](secret.md)), where the salt comes from (the caller's CSPRNG), and
how a program stores hashes or rate-limits guesses.

A `std/threads` task may call `bcryptHash` and `bcryptVerify`: everything
they wipe is an array the call made itself, which a task may wipe
(`tests/link/thread_task_wipe`), and a task hashing a password its parent owns
is `tests/link/thread_bcrypt_task`. It may call the batch too
(`tests/link/thread_bcrypt_batch`, BCRYPT-9): the batch's state is a
`Secret` made with `secret(...)` from an array the call made, which a task may
wipe.

## Threat model

Two attackers. The first holds a stolen hash and wants the password: bcrypt's
cost is the defence, and a win here is a hash cheaper to test than the
reference's, or one that verifies a password it should not. The second can
call `bcryptVerify` with any hash string and password and time it, or read the
process's memory after a call returns: a win is a panic, a hash string that
reads past its bytes, a verify whose time follows how many characters matched,
or the password, or the state derived from it, left in memory.

## The reference's behaviour

The references are Solar Designer's crypt_blowfish 1.3 (the code the module
adapts) and libxcrypt's `crypt_r`, which uses crypt_blowfish. The module
answers as they do on every input in the table below but `$2x$`, a hash string
of the wrong length and a digest character outside the alphabet. How a hash is built:

| Input | What crypt_blowfish and `crypt_r` do | What the module does |
| --- | --- | --- |
| The key bytes | The password as a C string, its terminating NUL included, cycled until the 18 P words (72 bytes) are filled. | The same. |
| A password of 72 bytes or more | The first 72 bytes are used under every prefix; the terminating NUL is not reached, and the rest is ignored. | The same (BCRYPT-1). |
| An embedded NUL | The key ends at it: C reads a string to its first NUL, so `ab\0cd` is the key of `ab`. | The same (BCRYPT-2). |
| 8-bit bytes, `$2b$` and `$2y$` | Read unsigned. | The same. |
| 8-bit bytes, `$2a$` | The countermeasure: the key is also built with sign-extended bytes, as the old bug built it; if an 8-bit byte was sign-extended into a word and yet the two keys come out equal, bit 16 of P[0] is flipped, so the `$2a$` digest of such a password (`\xff\xff\xa3`) is not its `$2y$` one. It fires only for an 8-bit byte after the first byte of some key word with only 0xff bytes before it in that word, every such byte in all 18 words being so placed (`\xff\xa3345` is not: its $2a$ digest is its $2y$ one); UTF-8 never holds such a key. | The same (BCRYPT-3). |
| `$2x$` | Hashed with the bug, for old hashes. | Refused (BCRYPT-3). |
| The salt's last character | It carries 2 bits of the 128; the 4 low bits of its sextet are dropped, and the hash made is written with them cleared. | The same; a hash string with them set verifies false, as `crypt_r`'s whole-string compare does (BCRYPT-4). |
| A cost outside 04–31, a bad prefix or salt character | Refused (`*0`/`*1`). | An `Err` naming it (BCRYPT-5). |
| A hash string that is not 60 characters | A mismatch: the recomputed string differs. | An `Err` (BCRYPT-5). |
| A digest character outside the alphabet | A mismatch: the recomputed string differs. | An `Err` (BCRYPT-5). |

## Interoperability

What each implementation answers for the inputs where any two of them differ.
Every other input (a password of up to 72 bytes with no NUL, under `$2b$`, or
under `$2a$` that does not set off the countermeasure, which takes an 8-bit
byte after the first byte of a key word with only 0xff bytes before it)
hashes alike in all four. The sources: libxcrypt as packaged here, built with
its `$2a$`, `$2y$` and `$2x$` hashes (they are a build option,
`--enable-hashes`, and `tests/differential/bcrypt.js` assumes a build with
`$2a$` and `$2y$`), with crypt_blowfish 1.3's `wrapper.c`; OpenBSD's `lib/libc/crypt/bcrypt.c` 1.58 (openbsd/src
65a9769f7625, the file `bench/crypto/bcrypt/run.mjs` fetches); Go's
`golang.org/x/crypto/bcrypt` v0.58.0. Line numbers are in those files.

| Input | This module | libxcrypt, crypt_blowfish | OpenBSD `bcrypt.c` | Go `x/crypto` |
| --- | --- | --- | --- | --- |
| 8-bit bytes under `$2a$`, each one after a key word's first byte with only 0xff bytes before it in the word (`\xff\xff\xa3`; not `\xff\xa3345`, whose hashes agree in all four) | The countermeasure. | The countermeasure. | None: the `$2a$` digest is the `$2y$`/`$2b$` one, so its hash of such a password verifies false here ("and is not the $2y$ digest under $2a$"). | None, as OpenBSD. |
| An embedded NUL | The key ends at it. | The key ends at it. | The key ends at it (`strlen`, lines 118 and 125). | The whole slice and one NUL are the key (line 226), so `ab\0cd` is not `ab`: a Go hash of a password with a NUL verifies false here. |
| More than 72 bytes, hashing | The first 72. | The first 72. | The first 72 (`bcrypt_newhash` makes `$2b$`, capped at line 126). | Refused, `ErrPasswordTooLong` (line 97). Verifying reads the first 72. |
| More than 72 bytes, a `$2a$` hash | The first 72. | The first 72. | The length plus one is kept in a byte (line 118), so for n of 255 and up the key is the first `(n + 1) mod 256` bytes of the password, with no NUL (n = 300 gives 45): the first 72 bytes only when that is 72 or more. For n of 255 to 326, 511 to 582, and every such run 256 on, it is shorter, and the hash verifies false here ("OpenBSD's $2a$ hash of 300 bytes does not verify"); elsewhere it agrees ("its $2a$ hash of 400 bytes does"). | The first 72. |
| `$2y$` | Accepted, as `$2b$`. | Accepted, as `$2b$`. | Refused: any minor but `a` and `b` is (lines 116–131). | Accepted, as `$2b$`. |
| `$2x$` | Refused. | Hashed with the bug. | Refused (lines 116–131). | Accepted and hashed as `$2b$`, with no bug and no countermeasure (`decodeVersion`, line 265, takes any minor letter). |
| A bare `$2$`, no minor letter | Refused (an `Err`). | Refused. | Refused: the minor switch's default (lines 116–131); older releases accepted it. | Accepted, and hashed as every prefix is there (`decodeVersion`, line 265, reads no minor when the third character is `$`, line 274). |
| The salt's last character with its 4 low bits set | Verifies false. | Verifies false. | Verifies false: the salt is decoded and re-encoded, and the strings differ (line 222). | Verifies true: the 22 salt characters are kept as given (line 187) and the hash is rebuilt with them. |
| A hash string that is not 60 characters | An `Err`. | A mismatch. | A mismatch (`bcrypt_checkpass` compares the lengths first, line 228). | A mismatch (a longer string's extra characters stay in the digest compared). |
| A digest character outside the alphabet | An `Err`. | A mismatch. | A mismatch (`bcrypt_checkpass`, line 222, compares the recomputed string). | A mismatch (the recomputed string is compared, line 120). |

The OpenBSD hashes the checks use were made by OpenBSD's own code, built from
the files `bench/crypto/bcrypt/run.mjs` fetches into
`build/bench/bcrypt/openbsd-65a9769f7625/`, with a ten-line `vec.c` that calls
`bcrypt(p, setting)` on the password `p` of `n` bytes `abc…z` repeated and
prints the result:

```sh
O=build/bench/bcrypt/openbsd-65a9769f7625
gcc -O2 -w -include $O/shim.h -I$O $O/bcrypt.c $O/blowfish.c vec.c -o vec
./vec 300 '$2a$04$abcdefghijklmnopqrstuu'   # ...ZhbhEFpDIPOzoWgIIoxfm98VTZSo7Ny
./vec 400 '$2a$04$abcdefghijklmnopqrstuu'   # ...p5OpK2YVWOf8zhcTL0LOco4/tHSabd2
./vec 300 '$2b$04$abcdefghijklmnopqrstuu'   # ...p5OpK2YVWOf8zhcTL0LOco4/tHSabd2
```

The same program gives the 400-byte digest from n = 327 on, the first length
past the run, and refuses `$2y$` and `$2x$` settings.

## The batch

`bcryptHashN(p0, p1, p2, p3, p4, p5, salts, cost)` and `bcryptVerifyN(p0, …,
p5, hashes)` take lane 0 and up to five more passwords, each `Secret<u8[]> |
null`, with 96 bytes of salt or six hash strings. `bcryptHash4` and
`bcryptVerify4` are the same computation for up to four, with 64 bytes of salt
or four strings, and keep the signatures, errors and outputs they had. The
given lanes' Blowfish encryptions run interleaved in one loop of the width
given (`bcryptBodyN`, one of `bcryptBody2` to `bcryptBody6`, through
`bcryptEncryptAt`): the chains are independent, so the S-box loads of one
overlap the others' and a core is not left waiting on one chain's latency.
Each lane's hash is the single path's, byte for byte. The kernels other than
`bcryptBody4` are written out by `bench/crypto/bcrypt/gen-body.mjs`, whose
output is the source as committed; its width 4 is `bcryptBody4`'s text below
the doc comment, and `gen-body.mjs --check` compares all five with the module.

**One state, one wipe.** A `Secret` cannot be stored in an array or a field,
so the lanes' states cannot be several `Secret`s handed to one kernel. They
are one `Secret<u32[]>` of 6366 words (`BCRYPT_BATCH_WORDS`): slot s's
Blowfish state at 1042s, its expanded key at 6252 + 18s and its `$2a$`
safety word at 6360 + s. The given lanes take slots 0, 1, … in order
(`bcryptSlotsOf`), so a batch of w lanes runs the w-wide kernel and no slot
runs without a key. `bcryptHashN` and `bcryptVerifyGroup` make the state, set
it to π (`bcryptInitN`), load each given lane's key with one `exposeWith` of
the state per password (`bcryptLoadN`, through `bcryptLoadSlot` and
`bcryptLoadLane`), run the salted expansion, the 2^cost rounds and the magic
string on all slots in one more (`bcryptHashNExposed` or
`bcryptVerifyNExposed`, through `bcryptEksN`), and wipe it. The hash's
exposed half returns the 60-byte hashes, which are the strings `bcryptHashN`
returns and so are not wiped; the verify's compares each slot's rebuilt hash
with the given one inside the exposure, wipes both and the digests, and
returns one bit per slot.

**A key word at a time.** While `bcryptLoadLane` has the state exposed it
cannot also expose the password, so it takes the key one word at a time:
`exposeWith(password, …, bcryptKeyWord)` builds the lane's whole key schedule
in a fresh array, keeps one word, wipes the array and returns the word. The
schedule is built 18 times per lane (each in microseconds against a hash of
milliseconds), and only a `u32` leaves each call, into `bcryptLoadLane`'s
unwiped local `word` and then the state. That local is a register or a spill
slot, which no wipe reaches (BCRYPT-7).

**Null lanes.** A null lane takes no slot and is not hashed. `bcryptHashN`
gives "" for it and does not read its salt; `bcryptVerifyN` gives `false` and
does not read its hash string, so a malformed string in a null lane is no
error. One given lane runs as the single path, so a batch of one costs one
hash and not six.

**A malformed lane.** `bcryptVerifyN` and `bcryptVerify4` parse every given hash string before it
hashes anything; a malformed one in any given lane makes the whole call
`Err("bcrypt: lane k: …")`, the single path's message with the lane named. A
per-lane `Err` was the alternative; it was not chosen because a
`Result<boolean[], string>` can say only one thing, and folding the bad row into
`false` would let a corrupted stored hash read as a wrong password. A caller
whose rows come from storage it trusts sees the error as the corruption it is.

**Costs.** One kernel runs one cost. `bcryptVerifyN` groups the given lanes by
the cost their hash names: a group of two or more runs as one interleaved
computation (`bcryptVerifyGroup`), a group of one as `bcryptVerify`. Lanes of a
group may carry different prefixes; each lane's safety word is its own, so a
`$2a$` lane gets the countermeasure beside a `$2y$` one. A batch of six costs
takes the time of six single verifies.

**The comparison** is `timingSafeEqual` over each lane's whole 60 characters,
as in `bcryptVerify`; the lanes' answers do not depend on one another, and the
time of the call follows only which lanes are given and the costs, all of
which the caller chose.

## Findings

Rows BCRYPT-1 to BCRYPT-5 are the decisions a reviewer might question, each
following the reference; BCRYPT-6 and BCRYPT-7 are what a wipe and a
constant-time compare cannot reach; BCRYPT-8 to BCRYPT-10 are the batch's.
They are accepted, or a limitation of the language since lifted, not flaws,
and none is counted as fixed or open in the index.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| BCRYPT-1 | Low | `bcryptSetKey` | A password past 72 bytes hashes as its first 72, so two passwords sharing those verify each other. | **Accepted.** crypt_blowfish and `crypt_r` cut there at any length, and a hash is useful only if the reference verifies it: refusing would make a password they accept fail here, and pre-hashing it would make a hash no other implementation verifies. A program that wants long passphrases to count whole can pass an HMAC of them as the password; the guide page says so. |
| BCRYPT-2 | Low | `bcryptSetKey` | A NUL ends the key, so `ab\0cd` verifies `ab`. | **Accepted.** As BCRYPT-1: `crypt_r` takes a C string, so a hash made with the NUL kept would verify only in Go ([Interoperability](#interoperability)). Text from a form has no NUL; a program hashing raw bytes refuses one itself. |
| BCRYPT-3 | Low | `bcryptSetKey`, `bcryptParse` | `$2x$` hashes, made by the sign-extension bug, cannot be verified. | **Accepted.** Verifying them means running the bug; the systems that made them were told to rehash in 2011. `$2a$` keeps the countermeasure, so a `$2a$` hash made with the bug verifies false rather than verifying the wrong password. |
| BCRYPT-4 | Low | `bcryptDecodeSalt` | A hash whose last salt character has the dropped bits set verifies false for its own password. | **Accepted.** It is `crypt_r`'s answer: it rebuilds the string with the bits cleared and compares the whole of it. Accepting it would make a hash string that verifies here and not there. OpenBSD answers the same; Go verifies such a string true, since it keeps the salt characters as given ([Interoperability](#interoperability)). |
| BCRYPT-5 | Low if it failed | `bcryptVerify`, `bcryptParse` | A hash string of any length or bytes must not panic or read past itself. | **Holds.** The length is checked to be 60 first; every character after that is read at an index below 60 and checked against the alphabet, each refusal an `Err`. |
| BCRYPT-6 | Low | `bcryptEncrypt` | Each Blowfish round loads four S-box words at indexes taken from the secret state, so the cache lines touched follow the password. | **Accepted.** It is the algorithm: every bcrypt does it, and the expensive key setup that is bcrypt's point is made of these loads. A local attacker sharing a cache with the hashing core could in principle learn about the state; a remote one times a cost-10 hash of ~50 ms, against which the loads' variance is noise. The key schedule (`bcryptSetKey`) does not branch on a password byte's value, but the copy's trip count follows the password's length (up to 72), and the cycle position `p` of the `key[p & 0x7f]` loads restarts at its first NUL (or at 72), so which of the 128-byte key array's two cache lines each load touches follows the length up to that NUL. A local attacker who can watch those lines learns the length (to within the line split), not a byte; C implementations walk a C string the same way. The base64 that encodes the digest (`bcryptCharOf`, `bcryptSextetOf`) is branchless, since the digest is the stored hash when the password is right, and the verify's compare is constant-time. |
| BCRYPT-7 | Low | `bcryptExposed`, `bcryptHashExposed`, `bcryptKeyWord`, `bcryptLoadLane`, `bcryptHashNExposed` | Values the generated code holds in registers, and any it spills to the stack, are not wiped; nor is the caller's own copy of the password before it became a `Secret`. | **Accepted.** No store from the language reaches a register or a spill slot (as AEAD-4 for the AES kernels). Every array holding key material is wiped, and so is every array the verify makes: the hash `bcryptVerifyExposed` rebuilds and the given hash's bytes, and in the batch the digests and each lane's joined and given hash (`bcryptJoinedOk`), all through `bcryptSameWiped`, since a rebuilt hash is a crackable hash of whatever password was tried. The hash paths' 60 bytes (`bcryptHashExposed`, the batch's `all` from `bcryptHashNExposed`) are not wiped: they are the hash strings `bcryptHash`, `bcryptHashN` and `bcryptHash4` return, public by design, and the strings themselves are the caller's. The `Secret` the caller passes is the caller's to wipe, and the checker makes it do so. The batch's 19 key words per lane each pass through `bcryptLoadLane`'s `word`, an unwiped `u32` local, on their way from `bcryptKeyWord`'s wiped array into the state: a register, or a spill slot if the code generator spills it, which no wipe reaches; the same reach as a round's working values. |
| BCRYPT-8 | Low | `bcryptEksN`, `bcryptSlotsOf` | A null lane, or a lane of another cost in a verify group, ran through the four-lane kernel with π and no key, and its digest was computed and dropped. | **Superseded.** It was accepted, since nothing secret was in such a lane and its digest was wiped with the rest. Now the given lanes take consecutive slots (`bcryptSlotsOf`) and the kernel is as wide as they are, so no slot runs without a key: three lanes of a four-lane call run `bcryptBody3`. Pinned by `link/crypto_bcrypt_width`'s "hashN, width w, lanes m" lines, whose lane masks m leave gaps (lanes 33 is lanes 0 and 5, run in slots 0 and 1), each lane equal to `bcryptHash`. |
| BCRYPT-9 | Low | `bcryptHash4`, `bcryptVerify4` | The batch could not run in a `std/threads` task: a task calling `bcryptHash4` was refused, "`hashFour` writes memory its caller can see through `bcryptHash4`". | **Closed: the language limitation is lifted.** A task may now wipe a `Secret` it made with `secret(...)` from a fresh value ([`secret.md`](secret.md), [`LANGUAGE.md`](../LANGUAGE.md) NL2471), and `bcryptVerify4` no longer counts as writing the caller's `hashes`: handing a `string` element to a call writes nothing, since a string has no slot a callee can store into. Before: `tests/link/thread_bcrypt_batch_refused`, refused. After: `tests/link/thread_bcrypt_batch` runs `bcryptHash4` and `bcryptVerify4` on two tasks under `NISH_NUM_THREADS` of 1, 2 and 8, and checks the hashes against `bcryptHash`. The analysis as it stood: the batch made its state with `secret(new Array…)` and wipes it; the task rule counts that wipe as a shared write: [`threads.md`](../guide/using-nish/threads.md) and [`LANGUAGE.md`](../LANGUAGE.md) (NL2471) say a `wipe` of a `Secret` made with `secret(...)` is a write to memory the caller can see, since the rule does not follow a fresh array through `secret(…)`. The way round it costs more than it buys: a plain `u32[]` state would hold every lane's key schedule and S-boxes outside a `Secret` and outside `expose`, where the checker no longer makes each use go through `exposeWith` nor makes the function wipe it, and a zeroing loop in place of the wipe is a store `opt -O2` may drop. The language change it needs: a `Secret` made by `secret(e)` from a fresh allocation `e` that the function neither returns nor stores is the function's own scratch, as the fresh array is, so its `wipe` and its `exposeWith` writes are local writes. That is the change made. |
| BCRYPT-10 | Low | `bcryptCalibrate`, `bcryptCalibrateTime` | The width a program runs follows a clock, so it differs between machines, between runs and with the load at startup. | **Accepted.** The width changes only the speed: every width gives each lane the single path's hash byte for byte (BCRYPT-8's test, and the differential at widths 2 to 6), so a hash made at one width verifies at any other. The calibration hashes its own one-byte throwaway passwords (`bcryptCalibrateKey`), wiped like any other, and an all-zero salt; it reads no caller's secret, and its running time follows only the widths and the core. It reads the clock (`monotonicNanos`), the one function of the module that does. |

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
(`tests/differential/bcrypt.js`): 48 seeded cases of 0 to 309 bytes over every
byte value at cost 4 to 6 or 10, of which 7 hold a NUL, 31 an 8-bit byte, 11
run past 72 bytes and 3 past 255, and 1 is at cost 10. A separate one-line link
test decides the skip, so a harness that does not build fails. Each passes when the module's `$2b$` hash is `crypt_r`'s,
`crypt_r` accepts it, and the module verifies `crypt_r`'s `$2a$`, `$2b$` and
`$2y$` hashes and refuses a wrong password as `crypt_r` does. Without a C
compiler or libxcrypt it skips, saying which.

**Hashes from Go** (`golang.org/x/crypto` v0.58.0): "the Go seed hash
verifies" (the `$2a$10$` hash github.com/arjaythedev/multicore-server-challenge
seeds at c3012257f2ee), "and not under another password", "Go, cost 10", "Go,
cost 4", "Go, a passphrase". "hash at cost 10" is a `$2b$10$` known answer
from `crypt_r`. OpenBSD's tree has no libc bcrypt regress
(`regress/lib/libutil/bcrypt_pbkdf` only), so crypt_blowfish's wrapper.c table
is the published vector set.

**The 72-byte cut and the NUL** (BCRYPT-1, BCRYPT-2): "a key past 72 bytes:
the rest is ignored", "hash a 72-byte password at cost 6", "a 73rd byte changes
nothing", "200 x hash as 72", "72 x", "255 x hash as 72 under $2b$", "256 x",
"300 x", "255 x verify as 72 under $2a$", "256 x under $2a$", "300 x under
$2a$", "OpenBSD's $2a$ hash of 300 bytes does not verify", "its $2a$ hash of
400 bytes does", "and so does its $2b$ hash of 300 bytes", "ab\0cd hashes as ab: the key ends at its
first NUL", "and verifies as ab".

**8-bit bytes and the sign-extension bug** (BCRYPT-3): "$2y$ \xff\xff\xa3",
"$2b$ \xff\xff\xa3 is $2y$'s digest", "$2a$ \xff\xff\xa3 takes the
countermeasure", "and is not the $2y$ digest under $2a$", "$2a$ \xa3 (one
8-bit byte: no countermeasure needed)", "$2y$ \xa3", "$2b$ \xa3",
"$2a$ \xff\xa3345", "$2y$ \xff\xa3345", "$2a$ \xff\xa334\xff\xff\xff\xa3345",
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
Blowfish state, expanded key, key stream, block, digest, rebuilt and given
hash in bcryptVerifyExposed)` (`tests/wipes/crypto.js`) counts the volatile
wipes reached after `opt -O2` from `bcryptHashInto` and `bcryptHash` (five:
`bcryptExposed`'s, inlined) and from `bcryptVerifyExposed` and `bcryptVerify`
(seven: those five, and the rebuilt hash and the given hash's bytes, both
wiped in `bcryptSameWiped`). Turning either of those two `wipe`s into
`fill(0)` drops the verify's two to six.

**The batch** (`tests/link/crypto_bcrypt_batch`, whose lines are compared by
`link/crypto_bcrypt_batch: exits with 0 and stdout matches expected.out`):
"hash4, null lanes 0" to "hash4, null lanes 14", every null pattern with lane
0 given, each the same four strings as four `bcryptHash` calls (a null lane
""); "hash4, four lanes, round 0" to "round 5", random passwords of 0 to 80
bytes, NULs and repeats among them; "verify4: crypt_blowfish's and Go's
vectors, costs 5, 5, 4, 5" (the `\xff\xff\xa3` `$2a$` vector in lane 1, so the
countermeasure runs in a lane); "verify4 = verify, null lanes 0" to "14";
"verify4: a wrong password is false in its lane only"; "verify4 = verify,
mixed costs, round 0" to "round 2" (costs 4 and 6, `$2a$`, `$2b$` and `$2y$` in
one call); and the refusals "63 bytes of salt are refused", "cost 3 is
refused", "a malformed lane is an Err naming it", "and is not read when the
lane is null", "a batch is four hashes".

**The widths** (`tests/link/crypto_bcrypt_width`, compared by
`link/crypto_bcrypt_width: exits with 0 and stdout matches expected.out`):
"hashN, width w, lanes m, cost c" for widths 2 to 6, costs 4 to 8 and 10, and
lane masks m with gaps, each lane the string `bcryptHash` makes and a null lane
""; "hashN, lane 0 alone"; "verifyN = verify, width w, lanes m" and
"verifyN = verify, lane 5 wrong, width w" for widths 1 to 6;
"verifyN: crypt_blowfish's vector in all six lanes"; "a malformed lane k is
an Err naming it" for each of lanes 0 to 5, and "and is not read when lane k
is null"; the refusals "95 bytes of salt are refused", "cost 3 is refused",
"cost 32 is refused", "a batch is six hashes"; and "bcryptCalibrate answers 1
to 6" and, called again, "and again". `bcrypt differential: Nish and libxcrypt crypt_r agree on
random passwords and salts, both ways` runs its cases again through
`bcryptHashN` and `bcryptVerifyN` in batches of widths 6 down to 2, every lane
checked against `crypt_r` both ways.

**The batch's wipes survive `-O2`**: `crypto: the wipes survive opt -O2
(bcrypt's batch state, key words, block, digests, joined and given hashes in
bcryptVerify4Exposed)` (a name kept from the four-lane batch) counts the
volatile wipes reached from `bcryptKeyWord` (2), `bcryptEksN` (2),
`bcryptLoadN` (4), `bcryptHashNExposed` (3), `bcryptVerifyNExposed` (5),
`bcryptHashN` (13), `bcryptVerifyN` (52), `bcryptHash4` (13), `bcryptVerify4`
(52) and `bcryptCalibrateTime` (19); `tests/wipes/crypto.js` says where each
comes from. Turning the digests' `wipe` into `fill(0)` drops each of those
from `bcryptHashNExposed` on by one.

**Threads**: `link/thread_bcrypt_task: exits with 0 and stdout matches
expected.out` hashes two passwords and verifies one on three tasks, natively
and under `NISH_NUM_THREADS` of 1, 2 and 8; `link/thread_bcrypt_batch` runs
the batch's hash and verify on two tasks at the same sizes, and its hashes
match `bcryptHash`'s (BCRYPT-9).

**The half-round's shape**: ``bcrypt barrier: after opt -O3 all 16 of
bcryptBody's half-rounds end in one XOR with the barrier's `and` (16)``
counts the XORs that close a half-round after the value barrier's `and`
([The half-round's critical path](#the-half-rounds-critical-path)).

**wasm32**: the module has no I/O and no C; `crypto_bcrypt` and
`crypto_bcrypt_batch` build and run under WASI with the rest of `std/crypto`
(`node tests/run.js wasi`), each printing its `expected.out`.

## Speed

CPU milliseconds per cost-10 hash, single-threaded, on a 4-core x86-64 Xeon
whose `/proc/cpuinfo` says 2.80 GHz and whose clock measures 3.1 to 3.25 GHz
(machine C; the clock measured by timing a long chain of dependent `xor`, `add`
and `imul` instructions)
(`node bench/crypto/bcrypt/run.mjs --rounds 9`: user time of 8 hashes, median
and spread of 9 interleaved rounds; a row of w lanes is the time of 8 batches
over 8w; every row prints the same hash):

| Implementation | ms per hash |
| --- | ---: |
| Nish `bcryptHash` | 57.6 (56.4–59.0) |
| Nish `bcryptHash4`, four lanes | 23.1 (22.0–26.4) |
| Nish `bcryptHashN`, one lane | 57.4 (56.9–58.6) |
| Nish `bcryptHashN`, 2 lanes | 34.3 (32.8–37.2) |
| Nish `bcryptHashN`, 3 lanes | 27.1 (26.5–28.6) |
| Nish `bcryptHashN`, 4 lanes | 22.2 (21.9–25.2) |
| Nish `bcryptHashN`, 5 lanes | 22.4 (21.2–24.6) |
| Nish `bcryptHashN`, 6 lanes | 24.5 (22.5–27.5) |
| libxcrypt `crypt_r`, `$2b$` | 59.0 (58.0–60.1) |
| OpenBSD `bcrypt.c`, `gcc -O2` | 61.8 (61.3–64.0) |
| OpenBSD `bcrypt.c`, `clang -O2` | 69.6 (68.1–71.8) |
| tigokraft `bc_hash_n`, one lane, `gcc -O2 -march=native` | 61.3 (60.3–62.9) |
| tigokraft `bc_hash_n`, four lanes, `gcc -O2 -march=native` | 33.6 (31.1–37.0) |
| tigokraft `bc_hash_n`, one lane, `clang -O2 -march=native` | 62.0 (61.6–68.1) |
| tigokraft `bc_hash_n`, four lanes, `clang -O2 -march=native` | 24.6 (23.0–27.0) |

**The targets.** The single path, with the half-round's order pinned
([below](#the-half-rounds-critical-path)), takes 0.98 times `crypt_r`'s time,
inside the 1.2 aimed at and level with it inside the noise; it is 6% ahead of
OpenBSD's gcc build and tigokraft's one-lane gcc build, outside their spreads,
and 17% ahead of OpenBSD's clang build. The best width, four lanes, hashes
2.66 times as fast per password as `crypt_r` on one core, past the 1.5 aimed
at; five lanes are level with four, and six level inside the noise with a
median 10% higher. `bcryptHash4` and `bcryptHashN` at four lanes run the same
computation and overlap. Neither AMD nor AArch64 was measured: the best width
there is what `bcryptCalibrate` answers, which is why it measures.

**Cycles.** A cost-10 hash encrypts 2^10 × 1042 + 713 = 1,067,721 Blowfish
blocks (each of the 1 + 2 × 1024 key expansions encrypts 521, the magic string
192), so cycles per block = clock × time / 1,067,721. The bench prints 151 for
the single path at cpuinfo's 2.80 GHz; at the measured 3.2 GHz it is 173, 10.8
cycles per half-round, against the 11-cycle chain one half-round waits on
([below](#the-half-rounds-critical-path)): the single path is latency-bound.
Per lane, the widths take 103 (2), 81 (3), 67 (4), 67 (5) and 73 (6) cycles
per block, and `crypt_r` 177.

**The four-lane kernel, read.** The loop of `bcryptBody4` after `opt -O3` and
`llc`, from its `objdump`, is one round (two half-rounds) of all four lanes
in 123 instructions (124 before it was inlined into `bcryptBodyN`): 45 loads (each lane's 4 S-box words and `P` word per
half-round, 40, and 5 reloads of spilled values), 5 stores, all spills to
the stack, and one compare and backward branch, the only branch; it runs 8
times per block, not unrolled further. Checked against the suspects: no
bounds check (each S-box index is masked to 0–255 and the state's length is
checked once, before the loop) and no overflow check (the arithmetic is
`u32`, which wraps); no `Secret` or wipe work inside the loop, which calls
nothing; the lanes interleave, each lane's loads issued between the others'.
The state's slots are 1042 words, 4168 bytes, apart, not a multiple of 4096,
so the lanes' S-box words at one index fall in different L1 sets, and the
six-lane state, 25.5 KB, fits the 32 KB L1. The spills are five registers'
worth per round: 16 general-purpose registers do not hold four lanes' two
halves, base, counter and temporaries.

**Reproducing the clock and the counts.** `run.mjs` turns times into cycles
at cpuinfo's clock unless `--ghz` gives one, so the 3.2 GHz figures are
`node bench/crypto/bcrypt/run.mjs --rounds 9 --ghz 3.2`. The clock is a chain
of dependent one-cycle `add`s timed with `CLOCK_MONOTONIC`; on machine C it
printed 3.12, 3.14 and 3.23 on three runs, with a build running beside it:

```sh
cat > clock.c <<'C'
#include <stdio.h>
#include <time.h>
int main(void) {
  unsigned long x = 1, n = 1000000000;
  struct timespec a, b;
  clock_gettime(CLOCK_MONOTONIC, &a);
  for (unsigned long i = 0; i < n; i++)
    __asm__ volatile("add %0, %0\n\tadd %0, %0\n\tadd %0, %0\n\tadd %0, %0" : "+r"(x));
  clock_gettime(CLOCK_MONOTONIC, &b);
  printf("%.2f GHz\n", 4.0 * n / ((b.tv_sec - a.tv_sec) * 1e9 + (b.tv_nsec - a.tv_nsec)));
  return (int)(x & 1);
}
C
gcc -O2 clock.c -o clock && ./clock
```

The four-lane loop's counts are read from the `bcryptHash4` bench program.
`bcryptBody4` is inlined into `bcryptBodyN`, so the command lists every loop
there, from a backward branch's target to the branch. A load is an
instruction that reads memory, and a store is one that writes it:

```sh
build/nish build/bench/bcrypt/nish4.ts -o build/bench/bcrypt/nish4-g-out/ --link build/bench/bcrypt/nish4-g -g
objdump -d --no-show-raw-insn -M intel --disassemble=nish.bcryptBodyN build/bench/bcrypt/nish4-g |
  grep -P '^\s+[0-9a-f]+:\t' | awk -F'\t' '{ a = $1; sub(/^ +/, "", a); sub(/:$/, "", a); i[++n] = $2; at[a] = n }
  $2 ~ /^j/ { split($2, t, " +"); if (t[2] in at && at[t[2]] < n) { lo[++L] = at[t[2]]; hi[L] = n } }
  END { for (l = 1; l <= L; l++) { ld = st = br = 0; for (k = lo[l]; k <= hi[l]; k++) { o = i[k]; sub(/^[a-z]+ +/, "", o)
    if (o ~ /^[^,]*PTR \[/) st++; else if (o ~ /PTR \[/) ld++; if (i[k] ~ /^(j|call)/) br++ }
    print hi[l] - lo[l] + 1 " instructions, " ld " loads, " st " stores, " br " branches" } }'
```

It prints ten loops, a round loop with one branch and its block loop with
two for each width. A width-w round loop's loads are its 10w S-box and `P`
words plus its reloads. The round loops print 58, 188, 123, 154 and 90
instructions, with 20, 73, 45, 59 and 30 loads, for widths 2, 6, 4, 5 and 3.

**The bounds.** Per lane half-round: the latency floor is the 11-cycle chain
over the w lanes (about 2.8 cycles at four, 2.2 at five), the load-port bound
is 5 loads over the core's 2 load ports (2.5 cycles, 2.8 with the reloads),
and issue is 15.5 instructions at 4 a cycle (3.9 cycles). The measured 4.2
(4 and 5 lanes) and 4.6 (6) cycles sit on the issue bound: from four lanes
there are enough chains to hide the latency, and a wider kernel still issues
the same instructions per lane, so five and six gain nothing on four.

**Why the kernel is Nish and not C.** A C kernel was the alternative, and it
would be C in `runtime/` holding the secret state outside the checker's
`Secret` rules. The C to beat is the four-lane `bc_hash_n` of tigokraft:
33.6 ms per hash built by gcc and 24.6 (23.0–27.0) by clang, against 22.2
(21.9–25.2) for `bcryptHashN` at four lanes and 23.1 (22.0–26.4) for
`bcryptHash4`. The Nish is ahead of gcc's build outside both spreads and of
clang's by its median, inside the spreads; no C row beats it, so no C
prototype was built.

**Machine B**, the run that pinned the half-round's order (`--rounds 9`, before
the widths; a nominal 2.1 GHz), for comparison:

| Implementation | ms per hash |
| --- | ---: |
| Nish `bcryptHash` | 67.8 (66.5–69.0) |
| Nish `bcryptHash4`, four lanes | 24.4 (23.3–32.0) |
| libxcrypt `crypt_r`, `$2b$` | 68.8 (66.0–71.3) |
| OpenBSD `bcrypt.c`, `gcc -O2` | 69.4 (66.5–70.3) |
| OpenBSD `bcrypt.c`, `clang -O2` | 75.4 (73.0–78.5) |
| tigokraft `bc_hash_n`, one lane, `gcc -O2 -march=native` | 71.4 (70.6–73.3) |
| tigokraft `bc_hash_n`, four lanes, `gcc -O2 -march=native` | 35.4 (32.1–42.9) |
| tigokraft `bc_hash_n`, one lane, `clang -O2 -march=native` | 72.3 (70.0–75.1) |
| tigokraft `bc_hash_n`, four lanes, `clang -O2 -march=native` | 26.2 (23.1–30.2) |

The single path is level with gcc's builds and `crypt_r`, inside the noise,
and 10% ahead of OpenBSD's clang build. No bounds check is left in the round:
every S-box index is masked to 0–255 and the state's length is checked once.
Each half-round closes with one XOR after its last S-box add, as gcc's do and
clang's do not (below). Before that order was pinned, the single path
trailed gcc. Two runs of the bench, interleaved with the branch's in one
session, measured 73.1 (72.0–84.1) and 74.6 (72.1–76.9) ms on `main`
(`be8e623`). The branch measured 67.8 (66.5–69.0) and 68.9 (66.6–71.0) ms,
7.3% and 7.6% less, and gcc measured 68.5 to 69.6 ms across the four.

Four lanes run in the time of 1.4 single hashes, 2.8 times the single path's
throughput on one core. That is level with the four-lane C of the tigokraft
submission (commit `c3012257f2ee`, MIT; fetched by the bench, not copied)
built by clang, inside its noise, and 1.45 times its gcc build. The four-lane
rows spread widely on this machine (22.0 to 34.7 ms across the session's
runs), so read them as their medians' order, not their ratios. The C rows of
tigokraft are built with `-march=native`, as its build does, so they may use
any instruction this CPU has. The Nish rows (no `--cpu x86-64-v3`) and the
other C rows are built for baseline x86-64.

### The half-round's critical path

Each half-round is `x ^= P[n] ^ F(y)`, where `F(y)` is four S-box loads joined
by add, xor, add, and `y` is the half the previous half-round produced. `x` and
`P[n]` are ready long before `F(y)`, so the fast shape XORs them first, off
the path, and leaves one XOR after the last S-box add: `(x ^ P[n]) ^ F(y)`.
gcc builds that shape in all 16 half-rounds. LLVM, given the expression
plainly, builds it in the first and puts `P[n]` on the path in the other 15,
`(P[n] ^ F(y)) ^ x`: two dependent XORs after the add instead of one.
`bcryptBody` and `bcryptEncrypt` therefore write each half-round as

```ts
r = ctSelect(0xffffffff, r ^ st[n], 0) ^ F(l)
```

`ctSelect(m, a, b)` lowers to `(a & h) | (b & ~h)`, where `h` is `m` passed
through the value barrier, an empty inline `asm` LLVM cannot see through. With
`b` 0 the `or` folds away and `(x ^ P[n]) & h` is left. LLVM cannot know that
`h` is all ones, so it cannot move `P[n]` out of the `and` and into the XOR
chain: the half-round keeps the order written. The barrier takes a constant,
so LLVM hoists it out of the loop and merges the copies into one register
holding `0xffffffff`. Each half-round pays one register `and`, computed off
the path while the S-box loads are in flight.

The barrier is safe because it is an identity on the value: with an all-ones
mask, `ctSelect` gives `x ^ P[n]` in every bit, so every hash is unchanged,
and the bcrypt vectors, the `crypt_r` differential and the batch's
lane-by-lane comparisons with the single path answer as before. It adds no
branch and no load. The mask is a constant, not a secret, and the `and` is
one ALU instruction on registers, so the cache lines the round touches are
still the four S-box words BCRYPT-6 records and nothing more. The working
values stay in registers as before, which BCRYPT-7 records. Neither row
changes.

The batch kernels, `bcryptBody2` to `bcryptBody6`, keep the plain
`x ^= P[n] ^ F(y)`. Their chains are independent, so a core has other
work while one chain waits, and one extra XOR on a chain's path costs little
there. Writing the four-lane kernel's 16 half-rounds with the barrier was
measured as a loss: in two runs interleaved with the plain form in one
session, `bcryptHash4` took
27.6 (21.4–31.8) and 24.8 (21.0–34.2) ms against 24.2 (22.5–28.3) and 22.9
(22.3–31.8) ms. Both medians were slower, inside the batch's wide spread, and
nothing was gained to set against the extra `and` per half-round.

| Build | Loads | Stores | Stack spills | Bounds checks, calls, jumps | Critical path from `y` | `P` on the path |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| Nish `bcryptBody` | 5 | 0 | 0 | 0 | 7 instructions, 11 cycles | 0 of 16 |
| OpenBSD `Blowfish_encipher`, `gcc -O2` | 5 | 0 | 0 | 0 | 6 instructions, 11 cycles | 0 of 16 |
| OpenBSD `Blowfish_encipher`, `clang -O2` | 5 | 0 | 0 | 0 | 8 instructions, 12 cycles | 15 of 16 |

The first five columns count one half-round, from `perhr` in the recipe below,
which reads the 15 windows between consecutive S3 adds. The barrier's `and`
is a register operation, so it adds no load. Nish stores twice per
block (`st[i]`, `st[i + 1]`) and the C stores its halves through its pointer
arguments once per call; neither stores inside a round. The critical path is
the dependent chain from `y` to the next half-round's input, under 1 cycle
per ALU operation, 5 cycles per L1 load and eliminated register moves. Here
is one half-round from each listing, with the path marked `*`. The
instructions are in program order, several to a line; none is changed:

```text
; gcc: (x ^ P) ^ F, x ^ P computed off the path
  mov r9d,edx            mov ecx,edx           movzx ebx,dh
* shr r9d,0x10           shr ecx,0x18        * movzx r9d,r9b
  mov ecx,[rax+rcx*4]  * add ecx,[rax+r9*4+0x400]  movzx r9d,dl
* xor ecx,[rax+rbx*4+0x800]  * add ecx,[rax+r9*4+0xc00]
  xor edx,[rax+0x100c] * xor ecx,r8d
; Nish: ((x ^ P) & h) ^ F, x ^ P and the and computed off the path
  xor ecx,[rsi+0xc]      mov eax,edx           mov r10d,edx
* shr r10d,0xe           shr eax,0x18        * and r10d,0x3fc
* mov ebx,[rsi+r10*1+0x448]  * add ebx,[rsi+rax*4+0x48]  movzx eax,dl  movzx ebp,dh
* xor ebx,[rsi+rbp*4+0x848]  and ecx,r9d     * add ebx,[rsi+rax*4+0xc48]
* xor ebx,ecx
; clang: (P ^ F) ^ x
  mov r9d,r8d            shr r9d,0x18          mov eax,r8d
* shr eax,0xe          * and eax,0x3fc
* mov eax,[rdi+rax*1+0x400]  * add eax,[rdi+r9*4]  mov r9d,r8d  shr r9d,0x6  and r9d,0x3fc
* xor eax,[rdi+r9*1+0x800]   movzx r9d,r8b     * add eax,[rdi+r9*4+0xc00]
* xor eax,[rdi+0x1008] * xor eax,ecx
```

`r9d` is the hoisted barrier, set to `0xffffffff` once before the loop. The
Nish path is one instruction longer than gcc's in the same 11 cycles. It
loads the second S-box word with a `mov` and adds the first to it, where gcc
loads the first off the path and adds the second to it in one instruction.
The index computations cost the same, `shr` and `and` against `shr` and
`movzx`. The 16 half-rounds are fully unrolled and the state
base and length stay in registers. The second-lowest byte is one
`movzx …, bh` where clang's C takes a `shr` and an `and`. The C expansion
loops call `Blowfish_encipher` once per block, which Nish's inlined loop does
not.

The order is made in the IR, not in the backend. Without the barrier, in the
pre-link `-O3` pipeline, Reassociate turns the source's `x ^ (P[n] ^ F(y))`
into `(P[n] ^ x) ^ F(y)`, and a later InstCombine flips it to
`(P[n] ^ F(y)) ^ x`. In the loop it is the InstCombine after the loop
passes:

```llvm
; before that InstCombinePass
%47 = xor i32 %35, %l.addr.117   ; P[n+1] ^ l
%48 = xor i32 %47, %46           ; ^ F(r)
; after it
%47 = xor i32 %35, %46           ; P[n+1] ^ F(r)
%48 = xor i32 %47, %l.addr.117   ; ^ l
```

The unrolling is not the cause. A copy of `bcryptBody` with the 16
half-rounds written out as straight-line code, which was not committed, gave
the same hash and the same 15 of 16. `llc` keeps the tree at `-O1`, `-O2`
and `-O3`, and with `-x86-machine-combiner=false`. Three other plain forms
of the source gave the same 15 of 16: writing it as `(x ^ P[n]) ^ F(y)`,
loading `P[n]` into a `const` first, and a loop of one half-round with a
swap. LLVM canonicalizes a three-operand XOR whatever order it arrives in, so
only an operand it cannot see through holds the order, which is what the
barrier's `and` is. Nish's `opt` and `llc` are the same LLVM 18.1.3 as the
clang that built the C, and that build ends in the same 15 of 16.

`bcrypt barrier` in `tests/run.js` pins the shape. It compiles
`tests/link/crypto_bcrypt` and runs `opt -O3` on `bcrypt.ll`, then counts the
XORs in `bcryptBody` that take the barrier's `and` as an operand. There must
be 16, one per half-round. A source that drops the barrier leaves no such
`and` to count, and a compiler that stops emitting the barrier opaquely
folds the `and` away; either fails it.

To reproduce, run `npm run build` and then `node bench/crypto/bcrypt/run.mjs`
once to build the programs, then:

```sh
build/nish build/bench/bcrypt/nish.ts -o build/bench/bcrypt/nish-g-out/ --link build/bench/bcrypt/nish-g -g
dis() { objdump -d --no-show-raw-insn -M intel --disassemble="$2" "$1" | grep -P '^\s+[0-9a-f]+:\t' | cut -f2-; }
onpath() { awk -v s3="$1" '$1 == "add" && index($0, s3 "]") { split($2, a, ","); r = a[1]; n++; next }
  r != "" { if ($1 == "xor" && $2 == r ",DWORD") p++; r = "" } END { print n " S3 adds, " p + 0 " with P on the path" }'; }
perhr() { awk -v s3="$1" '{ w[++m] = $0 } $1 == "add" && index($0, s3 "]") { if (n++) { for (i = 1; i <= m; i++) { o = w[i]; sub(/^[a-z]+ +/, "", o); if (o ~ /^[^,]*PTR \[/) st++; else if (o ~ /PTR \[/) ld++; if (o ~ /\[(rsp|rbp)/) sp++; if (w[i] ~ /^(call|j)/) br++ } } m = 0 }
  END { k = n - 1; print k " half-rounds: " ld / k " loads, " st + 0 " stores, " sp + 0 " stack refs, " br + 0 " calls or jumps" }'; }
for f in "build/bench/bcrypt/nish-g nish.bcryptBody 0xc48" "build/bench/bcrypt/openbsd-gcc Blowfish_encipher 0xc00" \
  "build/bench/bcrypt/openbsd-clang Blowfish_encipher 0xc00"; do set -- $f; dis "$1" "$2" | onpath "$3"; dis "$1" "$2" | perhr "$3"; done
```

`onpath` finds each add of the last S-box word (state offset `0xc48` in Nish,
`0xc00` in OpenBSD's context) and checks whether the next instruction XORs a
state word into the same register. It relies on the add being followed
directly by that XOR. That was checked against all three listings by hand.
In clang's, each S3 add is followed by the `P` XOR on the path or, in the
first half-round, by an XOR into another register, as in all of gcc's. In
Nish's, each is followed by the half-round's one closing XOR of two
registers, directly or after the barrier's `and` of the other half. It
prints 16 S3 adds and 0, 0 and 15. `perhr` prints 15 half-rounds, 5 loads
and no stores, stack references, calls or jumps for each. With clang/LLVM
18.1.3, gcc 13.3.0 and GNU objdump 2.42 on x86-64, the three `dis` listings
have these sha256s (`dis … | sha256sum`). Branch targets keep their
`<symbol+offset>` text through `cut -f2-`, so a hash pins the link layout as
well as the toolchain:

| Listing | sha256 |
| --- | --- |
| `nish.bcryptBody` | `e5e4a901342e13f1505fa677ba6edec9315d2aae39f479cea5c9c15ea9b0fdec` |
| `Blowfish_encipher`, gcc | `5bd677c28adadcd01e97a6c9c2a17b55347bda224db42e6266a0db579aa2295d` |
| `Blowfish_encipher`, clang | `f3c2b0791101df18ec265ca65924336544990e18398d97939d953845d470b396` |

The `-g` build is needed for the symbol, because the bench's Nish binary is
built with the speed profile, which strips it. The C binaries are not
stripped. For the IR trace, set `CC` to this wrapper and rebuild:

```sh
#!/bin/bash
for a in "$@"; do [ "$a" = -c ] && exec clang "$@" -mllvm -print-changed -mllvm -filter-print-funcs=nish.bcryptBody; done
exec clang "$@"
```

The parallel `-c` steps interleave their output. Running
`opt -passes='lto-pre-link<O3>' -print-changed -filter-print-funcs=nish.bcryptBody`
on the emitted `.ll` gives the pass-by-pass trace in one stream.
