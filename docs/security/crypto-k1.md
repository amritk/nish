# Crypto K1: SHA-2, HMAC, HKDF, constant-time compare and base64url

The security audit's record for the first crypto stage (issue #363). It says
what was checked, how, what was found, and which test pins each answer. Base
is `main` at `882857d`.

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/sha256.ts` | `Sha256` (`update`, `copy`, `digest`), `sha256`, and the private `sha256Compress`, `sha256RoundConstant`, `sha256LoadWord`, `sha256CopyBytes` |
| `std/crypto/sha512.ts` | `Sha512Engine` (`compress`, `absorb`, `copyInto`, `finish`), `Sha512`, `Sha384`, `sha512`, `sha384` |
| `std/crypto/hmac.ts` | `HmacSha256`, `HmacSha384`, `hmacSha256`, `hmacSha384`, `hmacSha256Verify`, `hmacSha384Verify`, `hmacPadBlock` |
| `std/crypto/hkdf.ts` | `hkdfExtractSha256/384`, `hkdfExpandSha256/384`, `hkdfSalt`, `hkdfAppend` |
| `std/crypto/ct.ts` | `timingSafeEqual`, `timingSafeEqualAt` |
| `std/crypto/base64url.ts` | `base64urlEncode`, `base64urlDecode`, and the maps `base64urlRangeMask`, `base64urlCharOf`, `base64urlSextetOf` |

Callers outside this stage (`std/crypto/p256.ts`, `std/crypto/x509.ts`) were
read only to see which entry points they reach. They use `sha256()`,
`hmacSha256()`, `HmacSha256` and `timingSafeEqual`, so they get the fixes
below without an edit.

## Threat model

The attacker controls every byte and every length that reaches these
functions from outside the program: the message being hashed or MACed, a
received tag, a base64url text, an HKDF `info` or length taken from a protocol
field, and the offsets and lengths of a window when a parser computes them
from input. The attacker does not control the key, the PRK or the program's
own choice of number mode. They can measure time, but only from outside the
process. The goals considered are:

- a forgery or collision: two inputs one hash, MAC or key answers for;
- a verifier (a tag compare, the strict decoder) that accepts what it should
  refuse;
- a branch or a load address that depends on a secret;
- a panic, an unbounded loop or an unbounded allocation driven by input.

## Method

- **Read against the specifications.** FIPS 180-4 §5.1.1, §5.1.2, §5.3,
  §6.2 and §6.4 for the padding, the length field, the initial values and the
  compression functions. RFC 2104 §2 and RFC 4231 for HMAC's key handling and
  pad bytes. RFC 5869 §2.2 and §2.3 for HKDF's salt default, PRK length and
  L bound. RFC 4648 §3.5 and §5 for base64url's alphabet and canonical final
  bits. Every function in the scope was read line by line. For each length
  and offset, the question was what happens at 0, at the largest `i32`, and
  past it, in both number modes.
- **Length counters.** A reference SHA-256/384/512 was written in JavaScript
  with BigInt, with an injectable byte counter: the prefix is counted in the
  length field but never compressed. It takes its round constants and
  initial values from the std sources. It agreed with `node:crypto` on every
  message of 0 to 299 bytes for all three hashes. It then produced the
  expected digests for counters just below 2^29, 2^31, 2^32, 2^61 and 2^64
  bytes, with tails that cross each boundary inside `update`, and tails long
  enough to push the length field into a second block. Separately, a
  real 2^29-byte message (512 × 1 MiB windows) was hashed natively with
  `Sha256` and `Sha512` and matched `node:crypto` byte for byte.
- **Oversized inputs.** Each whole-buffer entry point was run natively on
  arrays and strings of 2^31 bytes and more, in both number modes. This is
  where every finding below came from.
- **Machine code.** `std/crypto/ct.ts` and `std/crypto/base64url.ts` were
  compiled with `clang -O2` for x86-64 and aarch64, and the assembly of
  `timingSafeEqual`, `timingSafeEqualAt` and `base64urlDecode` was read by
  hand: every conditional branch is on a length, a loop counter, a window
  bound, a bit position or the one final verdict. None is on a compared or
  decoded byte, and none exits the compare loop early. aarch64's `tbl` in
  the vectorised compare is a register shuffle with constant indices, not a
  load. Then two fixtures were added to the assembly check, which refuses
  every conditional branch, every call and every secret-addressed load
  (`tests/cases/ct_asm_k1_ct`, `tests/cases/ct_asm_k1_base64url`, below). Each
  has a link program that holds its copies to the module. Mutating one
  constant in a copied map failed two of that program's three checks, so a
  copy that drifts is caught.
- **Vectors.** The existing suites (`tests/link/crypto_sha256`,
  `crypto_sha512`, `crypto_hmac`, `crypto_hkdf`, `crypto_ct`,
  `crypto_base64url`, their `_f64` twins and the misuse programs) were run
  and read for what they already pin, so that the tests added here cover the
  gaps rather than repeat them.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| K1-1 | High | `std/crypto/sha256.ts:447`, `std/crypto/sha512.ts:504`, `:514`, `std/crypto/hmac.ts:138`, `:148` | Under `--number-mode f64` an array's length is exact, but `toI32` of it saturates at 2^31 − 1. The one-shot `sha256`, `sha512`, `sha384`, `hmacSha256` and `hmacSha384` handed `toI32(data.length)` to `update`, so an array longer than 2^31 − 1 bytes was hashed as its first 2^31 − 1 bytes. Every message sharing that prefix got one digest: a collision, and for the MAC a forgery, since `hmacSha256Verify` accepts the prefix's tag for the whole message. `p256VerifySha256`, `x509CertificateHash` and HMAC's long-key path reach the same code. Measured on base: `sha256` of 2^31 zero bytes equals `sha256` of 2^31 − 1 of them. | Fixed: each one-shot compares `data.length` as the `number` it is, before any `toI32`, and panics past 2^31 − 1. Tests: `crypto_sha256_long_f64`, `crypto_sha512_long_f64`, `crypto_sha384_long_f64`, `crypto_hmac_sha256_long_f64`, `crypto_hmac_sha384_long_f64` |
| K1-2 | High | `std/crypto/ct.ts:33` | `timingSafeEqual` compared `toI32(a.length)` with `toI32(b.length)`. Under `--number-mode f64` both saturate, so a 2^31-byte array and a (2^31 − 1)-byte one "had one length". Only the first 2^31 − 1 bytes were read, and the answer was `true`. Two 2^31-byte arrays differing in their last byte also compared equal. Measured on base, both cases. | Fixed: the lengths are compared as `number`s, and an array longer than 2^31 − 1 bytes answers `false`, since no `i32` index reaches its end. Test: `crypto_ct_long_f64` |
| K1-3 | Low | `std/crypto/base64url.ts:110`, `:75` | Under `--number-mode f64` `base64urlDecode` of a text longer than 2^31 − 1 bytes decoded its first 2^31 − 1 characters and, when they were valid, answered their bytes. That is a second spelling of those bytes, which the strict decoder exists to refuse. `base64urlEncode` of a longer array would stop at the same prefix. On base it cannot finish on an ordinary machine: under an 8 GB limit it ends with `nish: out of memory` (exit 1) long before answering. | Fixed: decode answers `null` and encode panics past 2^31 − 1. Tests: `crypto_base64url_long_f64` (fails on base) and `crypto_base64url_encode_long_f64`. The encode test pins the refusal: on base its stdout and exit code happen to match, because the out-of-memory panic also exits 1. |
| K1-4 | Low | `std/crypto/hkdf.ts:74`, `:108` | `hkdfExpandSha256/384` MACed `toI32(info.length)` bytes of `info`. Under `--number-mode f64` two `info`s longer than 2^31 − 1 bytes that shared their first 2^31 − 1 derived one key. | Fixed: such an `info` answers `null`, like an out-of-range L. Test: `crypto_hkdf_long_f64` |
| K1-5 | Low | `std/crypto/hkdf.ts:74`, `:108` | RFC 5869 §2.3 asks for a PRK of at least HashLen bytes. `hkdfExpand*` accepted any length, an empty PRK included, which keys HMAC with nothing a caller had to know. Misuse resistance rather than a break: every caller in the tree passes an `hkdfExtract*` result. | Fixed: a PRK shorter than 32 (SHA-256) or 48 (SHA-384) bytes answers `null`. Test: `crypto_hkdf_k1_bounds` (and `_f64`) |
| K1-6 | High | `src/emit-arrays.ts:1098` (`emitArrayLength`, through `emitNumberFromI64`); `runtime/runtime.c:1164` (`nish_array_grow`) | Under `--number-mode i32`, `a.length` is the array's `i64` length truncated to `i32`. Nothing stops an array from growing past 2^31 − 1 elements (`push` doubles the capacity without a bound). A `u8[]` of 2^32 + 5 bytes therefore has `length` 5 everywhere in the program, and every std function sees a 5-byte array. Measured on base and on this branch: `sha256` of 2^32 + 5 bytes equals `sha256` of its first 5, `hmacSha256Verify` accepts the 5-byte message's tag for the 4 GiB message, and `timingSafeEqual` of it against a 5-byte array answers `true`. std cannot see the true length in this mode, so nothing inside this stage's files can fix it. | **Fixed**, by the stages after this one. As this stage left it: needs `src/emit-arrays.ts` (the codegen stage) or `runtime/runtime.c` (the runtime stage). A fix is to refuse (panic) growth or allocation past 2^31 − 1 elements under `--number-mode i32`, or to make `.length` panic rather than truncate. Once that lands, the K1-1/K1-2 guards cover i32 mode as well. *Since fixed: the codegen stage bounded `push` and `new Array` at 2^31 − 1 elements ([codegen.md](codegen.md), K1-6 and CG-1), and the runtime stage closed the file reads, concatenation and `nish_alloc_array` ([runtime.md](runtime.md), RT-1, RT-2, RT-7). The one source left, a string `join` builds (`src/emit-arrays.ts`), was closed with CG-3 by [#427](https://github.com/amritk/nish/pull/427) and is counted under it ([codegen.md](codegen.md))* |
| K1-7 | Low | `std/crypto/hmac.ts` (`HmacSha256`, `HmacSha384`), `std/crypto/hkdf.ts` (`hkdfExpandSha256/384`) | Key material outlived the call. HMAC left both key blocks (`K XOR ipad`, `K XOR opad`), the hash of a key longer than a block and the hasher that made it, the inner digest, and both keyed hashers' chaining value, block and schedule in arena memory; a keyed midstate forges tags as well as the key does. `expand` left every T(i), including the bytes of the last one past L. A later memory disclosure could read them. Found while closing #476; nothing in this stage's original reading covered memory left behind. | **Fixed** (#476). Each is zeroed with `wipe`, a volatile `llvm.memset`, before the function returns: the key block, now one buffer rewritten between ipad and opad, once both hashers have absorbed it, the hashed key and its hasher once the key block is made, the inner digest once fed to the outer hash, both hashers when `digest` answers, and each T(i) as soon as the next replaces it and the last one at the end. `HmacSha256Scratch` and `HmacSha384Scratch` zero their hashers with `wipe` too, where ordinary stores stood, and wipe them before every `begin` starts them again, since starting one again copies only the live part of a fresh hasher and left the last message's, or a long key's, block and schedule behind. Callers holding a key as a `Secret<u8[]>` have `hmacSha256Secret`/`384`/`512`, `hkdfExtractSha256Secret`/`384`, `hkdfExpandSha256Secret`/`384` and `hkdfSha256Secret`/`384`, which read it only inside `exposeWith` and hand the PRK and the output back as `Secret`s; `hkdfSha256Secret` wipes the PRK between its two steps. Tests: `crypto_hmac` and `_f64` read both hashers back as zeros after each `digest`, and a scratch's inner block as zeros after `begin` with a long key; `tests/run.js` ("crypto_hmac crypto_hkdf: the wipes survive -O2") counts, after `opt -O2`, the volatile wipes reached along every call site from each HMAC constructor and `digest`, `hkdfExpandSha256/384`, `hkdfSha256/384Secret`, the scratch HMACs' `begin`, `finishInto` and `wipe`, `HkdfScratch.wipe`, and `hkdfExtractInto`, `hkdfExpandInto` and `hkdfExpandLabelInto`. Every wipe in both modules is reached from one of them, and the counts are exact, so deleting any one wipe, or making it an ordinary store, fails it. One wipe of each kind was deleted to show it. **Not reached**, and recorded rather than claimed: the caller's own key array on the plain entry points; an `HmacSha*` keyed and dropped without a `digest`; the PRK and output the plain `hkdfExtract*`, `hkdfExpand*` and `hkdfExpandLabel*` answer, which are the caller's (moving `std/net`'s TLS and QUIC callers onto the `Secret` entry points is #430); and the compression functions' working variables, which live in registers or spill slots no store in the language can name. |

No finding was made in the length counters, the padding, HMAC's key handling,
the digest-ends-computation rule, the window checks, HKDF's L bound, or the
constant-time shape of the compare and the maps. The properties below are what
was verified instead, each with the test that now pins it.

## Properties verified

| Property | How it holds | Pinned by |
| --- | --- | --- |
| SHA-256's bit length is right past 2^29, 2^31, 2^32 and up to 2^61 − 1 bytes, in both number modes | `total` is an `i64` and the length is `toU64(total) << 3`, so no counter is `number`-typed | `tests/link/crypto_sha2_lengths`, `crypto_sha2_lengths_f64` (6 SHA-256 cases, two with the length in a second block) |
| SHA-512 and SHA-384's 128-bit length is right past 2^29, 2^32, 2^61 and at 2^64 − 1 bytes, in both modes | `count` is a `u64`, and the length is `count >> 61` then `count << 3` | the same two programs (6 cases each) |
| Padding at the block boundaries (55/56/63/64/65 bytes; 111/112/127/128/129) | §5.1.1 / §5.1.2 | existing `crypto_sha256`, `crypto_sha512` and their `_f64` twins |
| A window with a negative offset or length, or one past the end, panics before anything is hashed, and so does one whose `off + len` would wrap an `i32` | `len > size - off` (`Sha256`) and `off > size - len` (`Sha512Engine`), with both operands non-negative first, cannot overflow | existing `crypto_sha256_window`, `crypto_sha512_window`, `crypto_hmac_sha*_window`; new `crypto_sha256_window_wrap`, `crypto_sha512_window_wrap` |
| A digest ends the computation: a second `digest`, a later `update`, or `Sha256.copy` panics; a `Sha512`/`Sha384` copy of a spent hasher is itself spent | `finished` is checked first in each | existing `crypto_sha256_digest_twice`, `_update_after_digest`, `_copy_after_digest`, `crypto_sha512_digest_twice`, `crypto_sha512_spent`, `crypto_hmac_sha*_digest_twice`, `_update_after_digest` |
| HMAC hashes a key longer than the block, and only then: 64/65 bytes for SHA-256, 128/129 for SHA-384 | `toI32(key.length) > SHA256_BLOCK` / `> SHA512_BLOCK` | existing `crypto_hmac` (RFC 4231 cases 6 and 7, and the block-boundary keys checked against Python) |
| The verifiers refuse every wrong tag: truncated, one byte longer with the right prefix, empty, one byte, the other hash's tag, and each of the 256 (SHA-256) and 384 (SHA-384) single-bit flips | `timingSafeEqual` compares lengths first and every byte after | existing `crypto_hmac`; new `crypto_hmac_k1_verify`, `crypto_hmac_k1_verify_f64` |
| HKDF-Expand refuses L < 0, L > 255 × HashLen, and the `i32` extremes; L = 0 is empty | the bound is a comparison, not a sum | existing `crypto_hkdf`; new `crypto_hkdf_k1_bounds` and `_f64` |
| `timingSafeEqualAt`'s window test cannot wrap, and stays sound on an array longer than 2^31 − 1 bytes, where its length saturates | every window it accepts ends at or below 2^31 − 1, which is inside the array | existing `crypto_ct`; new `crypto_ct_long_f64` (a window ending at 2^31 − 1) |
| The compare loops keep no branch, no call and no secret-addressed load after `clang -O2`, on x86-64 and aarch64 | an `i32` OR-accumulator, read once as `diff === 0` | `tests/cases/ct_asm_k1_ct` (`timingSafeEqual32`, `timingSafeEqual48`, `timingSafeEqualAt16`), held to the module by `tests/link/crypto_ct_k1_copies` |
| base64url's character maps keep no branch and no table load, and neither does one group of the encoder or the decoder | range masks and an arithmetic shift, no table | `tests/cases/ct_asm_k1_base64url` (`base64urlCharOf`, `base64urlSextetOf` verbatim; `base64urlEncodeGroup`, `base64urlDecodeGroup`), held to the module on every sextet, every byte and 4,000 generated groups by `tests/link/crypto_base64url_k1_copies` |

What the fixtures do not reach, and so remains discipline, verified only by
the reading above:

- the length tests and the length-driven loops of both compare functions,
  since a trip count is a branch;
- the decoder's store guard and position test;
- the encoder's `String.fromCharCode` and `push`, which copy a secret byte
  into a fresh string and so are a call. The byte is stored, never used as an
  address.

SHA-2 and HKDF have no fixture. The compression functions were read, and they
branch only on loop counters and lengths. The round constant is a `switch`
indexed by the round number.

## Doc corrections for the security-policy stage

`std/README.md` is not this stage's to edit. These corrections are for the
stage that is:

- The module table's rows for `crypto/sha256.ts`, `crypto/sha512.ts` and
  `crypto/hmac.ts` should say that the one-shot functions panic on an array
  longer than 2^31 − 1 bytes.
- The `crypto/hkdf.ts` row: `hkdfExpand*` also answer `null` for an `info`
  longer than 2^31 − 1 bytes and for a PRK shorter than HashLen.
- The `crypto/ct.ts` row: an array longer than 2^31 − 1 bytes answers `false`.
- The `crypto/base64url.ts` row: `base64urlDecode` answers `null` for a text
  longer than 2^31 − 1 bytes, and `base64urlEncode` panics on such an array.
- "Constant time by construction", first bullet: `crypto/ct.ts` and
  `crypto/base64url.ts` are no longer outside every fixture.
  `tests/cases/ct_asm_k1_ct` holds `timingSafeEqual`'s loop at 32 and 48 bytes
  and `timingSafeEqualAt`'s at a 16-byte window.
  `tests/cases/ct_asm_k1_base64url` holds the two character maps verbatim, and
  one encode group and one decode group. The length-driven loops, the
  decoder's store guard and the encoder's string building remain discipline.
- The `crypto/hmac.ts` and `crypto/hkdf.ts` rows, after #476: HMAC runs
  over SHA-512 too (`HmacSha512`, `hmacSha512`, `hmacSha512Verify`); both
  modules wipe the key blocks, hashers, inner digest and T(i) they make
  (K1-7); and each has `Secret`-keyed entry points (`hmacSha256Secret` and
  its twins, `hkdfSha256Secret`, `hkdfExtractSha256Secret`,
  `hkdfExpandSha256Secret` and their SHA-384 twins).
- Worth a sentence near the top: until K1-6 is fixed, a program built under
  `--number-mode i32` must not hand these functions an array of 2^31 bytes or
  more. `length` wraps there, and nothing in std can tell. *Since K1-6 is
  fixed (#427 closed its last source, `join`), `std/README.md` says instead
  that nothing passes 2^31 − 1.*

## Addendum: HKDF-Expand-Label

Added after this audit, for WP34's TLS 1.3 and QUIC stages (#395), and not
covered by the reading above: `hkdfExpandLabelSha256/384` and the private
`hkdfLabel` in `std/crypto/hkdf.ts`. They build RFC 8446
§7.1's `HkdfLabel` and hand it to `hkdfExpandSha256/384` as `info`, so every
property above that holds for `expand` holds for them.

Their arguments sit outside this record's threat model: a label is a literal,
a length a key or hash size, a context a transcript hash, and the secret one
the key schedule derived. So an argument out of range is a bug in the caller,
and it panics rather than answering `null` as `expand` does for a length taken
from a protocol field. Each refusal has a program that reaches it:

| Refused | Why | Pinned by |
| --- | --- | --- |
| a length above 255, or below 0 | no TLS 1.3 or QUIC output is longer than 48 bytes; `HkdfLabel.length` is unsigned | `tests/link/crypto_hkdf_expand_label_long_length`, `_negative_length` |
| a label longer than 249 bytes, or empty | `"tls13 " + label` must fit `opaque label<7..255>`; past 249 its length byte would wrap, and the bytes would no longer be one well-formed `HkdfLabel` | `_long_label`, `_empty_label` |
| a context longer than 255 bytes | `opaque context<0..255>`, the same wrap | `_long_context`, and `_long_context_f64`, where the length is compared as an `f64` |
| a secret shorter than HashLen | K1-5 above: `expand` answers `null` for it, which the label functions turn into a panic | `_short_secret`, `_short_secret_sha384` |

The answers are pinned against every HKDF-Expand-Label step RFC 8448 §3
prints and all of RFC 9001 A.1, in both number modes
(`tests/link/crypto_hkdf_expand_label`, `_f64`); the SHA-384 vectors and the
largest accepted label, context and length were checked against OpenSSL's
TLS13-KDF. The secrets they derive are plain arrays, the caller's to wipe:
every T(i) and HMAC state on the way is wiped now (K1-7), and HKDF has `Secret`
entry points, but the label functions answer plain arrays until their TLS and
QUIC callers move (#430).

## Addendum: Wycheproof and wiped state (#476)

Added after this audit: `HmacSha512`, `hmacSha512` and `hmacSha512Verify`, the
`Secret` entry points of K1-7, and Project Wycheproof's vectors for HMAC and
HKDF, carried the way K2, K3 and K5 carry theirs
(`tests/link/crypto_wycheproof/hmac.ts`, `hkdf.ts`, upstream commit `3fa63dd`).

| Suite | Cases | Run by |
| --- | --- | --- |
| HMAC-SHA-256, -384, -512 | 174 each: 66 valid, 108 with a modified tag; keys the hash's length, half of it and 65 bytes (past SHA-256's block, so hashed first there), tags full and truncated to half | `tests/link/crypto_hmac_wycheproof`, `_f64` |
| HKDF-SHA-256 | 86: 83 valid, among them 23 with an empty salt, salts up to 80 bytes (past the block, so hashed first) and the largest output, 255 × 32 bytes; 3 asking one byte more | `tests/link/crypto_hkdf_wycheproof`, `_f64` |
| HKDF-SHA-384 | 83: 80 valid, among them 22 with an empty salt and the largest output, 255 × 48 bytes; 3 asking one byte more | the same |

Every case agrees in both number modes, by every entry point it has: an HMAC
tag computed by the one-shot function, by the streaming class and under a
`Secret` key is one tag, whose leading bytes a valid case matches and a
modified one does not, and a full-length tag goes through the verifier too. An
HKDF output derived by `extract` and `expand`, by the `*Into` functions over an
`HkdfScratch`, and by `hkdfSha256Secret`/`384` is the file's, and the oversized
lengths are refused by all three.

HMAC-SHA-512 is pinned besides against RFC 4231's seven cases and the 128- and
129-byte keys either side of its block (`crypto_hmac`). With the constructors
now hashing a long key in a hasher of their own, a key longer than 2^31 − 1
bytes is refused by HMAC rather than by `sha256`, so K1-1's reasoning for the
key holds where it is checked: `crypto_hmac_sha256_long_key_f64` pins the
refusal, and `crypto_hmac_sha512_digest_twice` that a wiped, finished
`HmacSha512` still refuses a second `digest`.
