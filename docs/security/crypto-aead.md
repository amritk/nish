# Security audit: the AEADs (ChaCha20-Poly1305 and AES-GCM)

Part of the repository security audit (#363). This record says what was
checked in `nish/crypto/chacha20poly1305` and `nish/crypto/aes`, how, what was
found, and which test now pins each property.

## Scope

- `std/crypto/chacha20poly1305.ts`: `chacha20Poly1305Seal`,
  `chacha20Poly1305Open`, `chacha20`, `chacha20Block`, `chacha20QuarterRound`,
  `poly1305`, `poly1305KeyGen`, `chacha20HeaderMask`, and the private
  `chacha20State`, `chacha20Core`, `chacha20XorInto`, `chacha20CounterFits`,
  `chacha20Poly1305Setup`, `chacha20Poly1305Tag`, `chacha20Poly1305TagMatch`,
  `poly1305Clamp`, `poly1305Block`, `poly1305Absorb` and `poly1305Finish`.
- `std/crypto/aes.ts`: `AesKey`, `aesKey`, `aesEncryptBlock`,
  `aesHeaderMask`, `aesGcmSeal`, `aesGcmOpen`, `aesGcmTagMask`,
  `ghashMultiply`, `aesBitslicedRound`, and the private key schedule, GHASH
  (`ghashUpdate`, `ghashLengths`), `aesGcmJ0`, `aesGcmCtr` and `aesGcmTag`.
- The disassembly fixtures `tests/cases/ct_asm_chacha20poly1305` and
  `tests/cases/ct_asm_aes`, and the link tests `tests/link/crypto_aes*` and
  `tests/link/crypto_chacha20poly1305*`, in both number modes.
- Since WP38 S5 (at `74c2716`): `runtime/runtime-aes.c`, the C kernels for
  AES-NI and PCLMULQDQ and for the ARMv8 AES and PMULL instructions that the
  compiler calls in place of four of `std/crypto/aes.ts`'s private
  functions, and its tests `tests/simd/aes-gcm.c` and
  `tests/ct-asm-runtime.js`. Its constant time is recorded in
  [ct-verification.md](ct-verification.md#the-runtimes-aes-kernels).
- Since the lowering (at `c29cd40`): the branch `src/emit.ts` puts in front of
  each of those four calls (`isAesSeam`, `src/kernels.ts:89`;
  `emitAesKernelArm`, `src/emit.ts:1473`), and its end-to-end test
  `tests/link/crypto_aes_agree`. On the kernel path GHASH reads H and its
  powers from `AesKey.roundKeys`, where the bitsliced path, `ghashLengths` and
  a non-12-byte IV's J0 read `AesKey.h` (`h[0]:h[1]`). `aesKey` and `aesKeyInto` write both
  from one schedule. A key edited by hand so that they disagree is outside the
  contract (AEAD-1's hand-built keys), and its output then depends on the path
  the process runs; the H = 0 guard still holds on both, because
  `ghashLengths`' last multiply by `h[0]:h[1]` = 0 makes S zero either way.

Out of scope: the constant-time helpers the modules call (`ctEq`,
`ctSelect`, `std/crypto/ct.ts`), the disassembly checker itself
(`tests/ct-asm.js`), and TLS or QUIC code built on these modules; other
stages own them.

## Threat model

A peer controls everything `Open` receives except the key: the nonce or IV
(any length), the AAD, the ciphertext and the tag, including lengths from 0 to
the largest array, a message cut short of a tag, and a tag of any value. The
peer can also choose plaintexts and AAD for `Seal` under a key it does not
know, and can time `Open`. It must not be able to learn a plaintext it did not
seal, make `Open` accept a message the key's holder did not seal, recover the
key or H, or crash the process.

The program that holds the key is trusted to pass keys it made with the
module's own constructors and never to reuse a nonce. Where the module can
cheaply refuse a misuse instead of trusting it, that is recorded as a Low
finding.

## Method

- **Read both modules against the specifications**: RFC 8439 §2.3–§2.8 for
  ChaCha20, Poly1305 and the AEAD's padding and length block; SP 800-38D §5.2.1.1
  (length limits), §6.2 (inc32), §6.4–§6.5 (GHASH and GCTR), §7.1 (J0 for a
  96-bit IV and for any other length) and §7.2 (decryption); FIPS 197 for the
  round count and key schedule. Every branch was checked for what it depends
  on, every index for what bounds it, and every counter and length for the
  width it is held in, under `--number-mode i32` and `f64`.
- **Poly1305's limb bounds**: the argument in `poly1305Block`'s comment (every
  limb below 2^26 + 2^9 on entry, products below 2^55.34, five-term sums below
  2^57.66) and `poly1305Finish`'s two carry passes and borrow-mask select were
  re-derived by hand, then exercised by Wycheproof's `EdgeCasePoly1305`,
  `EdgeCasePolyKey`, `EdgeCaseTag` and `EdgeCaseCiphertext` vectors.
- **Open's order**: in both modules the whole tag is computed over the
  received ciphertext, compared by ORing every byte's difference into one word
  and turning it into a mask with `ctEq`, and only then is an output array
  allocated and filled. On a mismatch nothing is allocated, so no
  partially decrypted buffer exists to escape.
- **Wycheproof**: every case of `chacha20_poly1305_test.json` (325: 256 valid,
  69 invalid, including nonces of 0 to 32 bytes other than 12, every
  single-bit tag flip and the Poly1305 edge cases) now runs in
  `tests/link/crypto_chacha20poly1305` and `_f64`. `aes_gcm_test.json`'s 213
  cases with a 128- or 256-bit key already ran in `tests/link/crypto_aes`; its
  remaining 103 (the 192-bit keys, which the module does not offer) now check
  that `aesKey` refuses each key. The vectors live in
  `tests/link/crypto_wycheproof_aead/`, taken at upstream commit `3fa63dd`
  with their own copy of the licence.
- **Differential run against OpenSSL** (not committed; it needs Node's
  `crypto`): 600 random AES-GCM messages (128- and 256-bit keys; IVs of 1, 7,
  8, 12, 13, 16, 17, 31, 32, 33, 64 and 100 bytes; AAD 0–70 bytes; plaintext
  0–300 bytes) and 600 random ChaCha20-Poly1305 messages, sealed by OpenSSL
  through Node, then sealed and opened by the modules. 0 of 1,200 disagreed
  under `--number-mode i32`, and 0 of 1,200 under `f64`.
- **Constant time**: `node tests/run.js ct_asm` (the disassembly check of the
  Poly1305 clamp, block and finish, both tag compares, one AES round and one
  GHASH multiply, on x86-64 and aarch64): 107 passed, 0 failed, before and
  after this change. The added `aesKeyUsable` branches on a round count and an
  array length, neither secret; the added H check is folded into the tag mask
  with `ctEq`, never branched on by itself.

## Findings

| Id | Severity | Where (base `882857d`) | Description | Disposition |
| --- | --- | --- | --- | --- |
| AEAD-1 | Low | `std/crypto/aes.ts:84` (`AesKey`), `:876` (`aesGcmOpen`) | `AesKey`'s constructor and fields are public, since the language has no private ones. A key built by hand from real round keys (`new AesKey(k.rounds, k.roundKeys)`), or one whose `h` a program sets to zero, has H = 0. Under H = 0 GHASH is zero for every input, so the tag is E(K, J0) whatever the AAD and ciphertext, and `aesGcmOpen` accepted any ciphertext and AAD carried with one valid tag: a forgery. It needs the key holder's program to build or edit the key, which a peer cannot do, hence Low. | **Fixed.** `aesGcmOpen` folds `~ctEq(key.h[0] \| key.h[1], 0)` into the tag mask, so a key with H = 0 opens nothing (a key from `aesKey` has H = 0 with probability 2^-128). Tests: `crypto_aes` and `crypto_aes_f64`, "a hand-built AesKey with H = 0 opens no forged ciphertext", "… no forged AAD", "an AesKey whose H is set to 0 opens no forgery". |
| AEAD-2 | Low | `std/crypto/aes.ts:435` (`aesEncryptBatch`), through every entry point | An `AesKey` whose `rounds` disagrees with its `roundKeys` (built or edited by hand) made every entry point index past the round keys and panic (`index out of range: 88 >= 88` for 14 rounds over AES-128's 88 words). A crash, but not on peer input. | **Fixed.** `aesKeyUsable` (10 or 14 rounds, `(rounds + 1) * 8` words) guards `aesEncryptBlock`, `aesHeaderMask`, `aesGcmSeal` and `aesGcmOpen`, which answer `null`. Tests: "seal under an AesKey with 14 rounds and 11 round keys answers null", "open under it …", "aesEncryptBlock under it …", "aesHeaderMask under it …", "an AesKey with 12 rounds, AES-192's count, answers null". |
| AEAD-3 | Low | `std/crypto/chacha20poly1305.ts:629`, `:661`; `std/crypto/aes.ts:851`, `:876` | Hardening, no defect. The AEADs' counters cannot wrap only because an array length is below 2^31: ChaCha20-Poly1305 needs at most 2^25 blocks from counter 1 against 2^32 - 1, and GCM at most 2^27 blocks against SP 800-38D's 2^32 - 2. Nothing at the counter said so, so a wider array length would have silently removed the bound. | **Fixed.** Seal and Open call `chacha20CounterFits(1, len)` and `aesGcmLengthFits(length)`, which state the bound where the counter is. They cannot refuse while array lengths are `i32`, so no test can fail on base; the boundary of `chacha20CounterFits` itself is pinned by the existing "a 65th byte at counter 2^32 - 1 would wrap the counter, and answers null". |
| AEAD-4 | Low | `runtime/runtime-aes.c:288` (`nish_aes_schedule`), `:327` (`nish_aes_ctr`), `:361` (`nish_aes_ghash`), `:130` (`nish_aes_wipe16`) (at `74c2716`) | **What the AES kernels cannot wipe.** On the kernel path the round keys, H and its powers, every counter block, every keystream block and the GHASH state pass through XMM or NEON registers, and the compiler may spill any of them to the stack. When a kernel returns they stay there until later code overwrites them, and a later memory disclosure, or a core dump, could read them. No store written in C can name a register or a spill slot, which is the position ECC-2 ([crypto-ecc.md](crypto-ecc.md)) and X509-7 ([crypto-x509.md](crypto-x509.md)) record for scalars in registers. | **Open, and recorded:** neither C nor the language can reach it. What the kernels own is wiped: the two stack buffers they declare, the keystream of a partial last block in `nish_aes_ctr` and the zero-padded last block in `nish_aes_ghash`, are zeroed before return by volatile stores (`nish_aes_wipe16`), the mechanism of `nish:secret`'s wipe. The kernels keep no other copy on purpose: round keys and H's powers are read from `rk` at each use rather than copied to locals, and the schedule is written straight into `rk`. Since the lowering (at `c29cd40`) this is the path every native AES-GCM seal and open takes on a CPU with the instructions, TLS records and QUIC packets and their header protection included, unless the process runs with `NISH_AES=soft`; before it, only a host that linked `runtime-aes.c` and called the kernels itself did. `rk` itself, H's powers in its tail included, is the caller's array, and is wiped exactly when the bitsliced schedule in it would be: TLS and QUIC do not wipe their keys yet (TLS-1 in [tls.md](tls.md), QUIC-1 in [quic.md](quic.md), #430). **What is still not reached:** the vector registers, and any spill of them; the `debug` profile's `-O0`, which keeps every intermediate on the stack; and the stack of the bitsliced path, which is `std/crypto/aes.ts`'s. Tests: `runtime-aes.c on ${target.name}: the wipes survive clang -O2 (two volatile zeros of 8 bytes in nish_aes_ctr and nish_aes_ghash), where a twin without volatile loses nish_aes_ctr's`. |

No Critical, High or Medium finding. AEAD-4 is open: it is recorded rather
than fixed, because neither the language nor C has a way to reach it.

## Properties verified

| Property | How it holds | Pinned by |
| --- | --- | --- |
| Open compares the full 16-byte tag in constant time before any plaintext is written, and allocates nothing on failure | Tag computed over the received ciphertext; `chacha20Poly1305TagMatch` / `aesGcmTagMask` OR every difference into one word for `ctEq`; the output array is made after the one branch | `ct_asm_chacha20poly1305`, `ct_asm_aes` (disassembly); `crypto_chacha20poly1305` "the fixture's tag compare refuses a flipped bit in each of the sixteen bytes"; every Wycheproof `ModifiedTag` case in both modules |
| Only a full 128-bit tag is accepted | Open reads the last 16 bytes as the tag; a truncated one shifts the split | "the tag cut to 12 bytes answers null" (ChaCha); "a tag cut to 96 bits answers null" (AES) |
| A message shorter than a tag, and the tag alone, are handled | `total < 16` answers `null`; 16 bytes open to an empty plaintext only if it is the tag of nothing | "a sealed message shorter than a tag answers null", "sixteen zero bytes are not the tag of nothing", "the tag alone opens to an empty plaintext" (ChaCha); "open of 15 bytes …", "the tag alone, with the ciphertext left out, answers null", "GCM test case 1 opens to nothing" (AES) |
| Every tail length is sealed and opened correctly | Absorb and XOR handle a partial last block | "seal then open gives the plaintext back for every length from 0 to 130" |
| Poly1305's limb arithmetic does not overflow and reduces fully | The bounds in `poly1305Block`'s and `poly1305Finish`'s comments | Wycheproof chacha20_poly1305: 325 of 325 in `crypto_chacha20poly1305` and `_f64`, the `EdgeCasePoly1305`, `EdgeCasePolyKey` and `EdgeCaseTag` cases among them; RFC 8439 A.3 #5–#11 |
| A ChaCha20 request that would wrap the 32-bit block counter is refused, not wrapped | `chacha20CounterFits`, in 64-bit arithmetic; the AEAD asks it from counter 1 | "counter 2^32 - 1 encrypts one block", "a 65th byte at counter 2^32 - 1 would wrap the counter, and answers null" |
| GCTR's counter wraps as inc32 does, keeping J0's first 96 bits, and cannot reach J0's own value | `aesGcmCtr` adds in `u32`; `aesGcmLengthFits` states SP 800-38D's 2^32 - 2 block cap | "Wycheproof: 24 of 24 cases built for a chosen J0, the 32-bit counter wrapping in several, hold" |
| A non-96-bit IV goes through GHASH (§7.1), and a 16-byte IV is not mistaken for J0 | `aesGcmJ0` hashes every length but 12, with the length block `0^64 ‖ [len(IV)]64` | GCM test cases 5, 6, 17, 18; Wycheproof's IVs of 8 to 2056 bits; "a 16-byte IV spelling J0 = IV ‖ 1 is hashed (SP 800-38D §7.1), not used as J0" |
| An empty IV and a nonce of the wrong length are refused | Length checks before any work | "seal/open with an empty IV answers null"; Wycheproof `InvalidNonceSize` (ChaCha, nonces of 0–32 bytes) and "0 size IV is not valid" (AES) |
| AES-192 keys are refused, not misused | `aesKey` accepts 16 or 32 bytes only | "aesKey refuses the key of all 103 of 103 cases with a 192-bit key" |
| A hand-built or edited `AesKey` cannot forge or crash | AEAD-1, AEAD-2 | the tests named in the findings |
| The same answers in both number modes | Every width is spelled in both modules | Each check above runs in `crypto_aes_f64` and `crypto_chacha20poly1305_f64` with identical expected output |
| Lengths cannot overflow `i32` | Seal refuses a plaintext over 2^31 - 17 bytes; Open's `total - 16` and `length + 8` stay below 2^31; GHASH and GCTR count in blocks, never forming an offset past the length | By reading; a 2 GiB input is too large for the suite |
| The AES kernels answer what FIPS 197 and SP 800-38D say, on every path a machine has, for AES-128 and AES-256 (WP38 S5) | `tests/simd/aes-gcm.c`: a table AES and a bit-at-a-time GHASH, held first to FIPS 197 C.1 and C.3, the GCM test cases 1–4 and 13–16 and RFC 9001 A.2's and A.3's header masks, then the kernels to them on every length 0 to 4,096 under both key sizes, 2,000 random lengths and keys, and 500 whole seals | `simd: ${label}: ${said.replace(/^(index-of-any\|aes-gcm): /, "") \|\| "the agreement driver"}` with the label `aes-gcm native ${process.arch}`; on AArch64 the same line (CI's `simd-arm64` job requires `armv8-aes-pmull`) |
| GCTR's counter wraps modulo 2^32 on the kernel path too, and `dst` may be `src` | J0 counters pinned at 2^32 - 1, - 2, - 3, - 4, - 5 and - 7, so the wrap falls on a four-block batch's first block, inside one, on its last and inside the second, over lengths of one block to 1,000 bytes and both key sizes; besides, J0s within 300 of 2^32 in a third of the exhaustive lengths and half the random ones; every GCTR run again in place | the same |
| A CPU with the instructions runs them | The agreement line must name the path wherever `/proc/cpuinfo` lists `aes` and `pclmulqdq` (or `pmull`) | `simd: aes-gcm ran the ${wantPath} path, which /proc/cpuinfo says this CPU has` |
| `NISH_AES=soft` pins the bitsliced path, and the answer is fixed once given | The driver resets the stored answer and asks under `soft`, unset, `hw` and an unknown value, then changes the environment and asks again | the same agreement line ("the resolver picks every pin") |
| The lowered branch gives the kernel's bytes and the walker's alike, end to end: the GCM specification's cases 1–6 and 13–18 (5, 6, 17 and 18 with 8- and 60-byte IVs, whose J0 the GHASH kernel starts and `ghashLengths`' bitsliced multiply finishes), RFC 9001 A.2's and A.3's masks, every Wycheproof case kept, and a seeded corpus of both key sizes, IVs of 1 to 64 bytes and plaintexts of 0 to 4,096 bytes; the kernels run where the CPU has them, and none under `NISH_AES=soft` (at `c29cd40`) | `tests/link/crypto_aes` and `tests/link/crypto_aes_agree`, linked with every kernel counted and run with `NISH_AES` unset and `soft` | `aes kernel: ${program} prints the same bytes with NISH_AES unset and with NISH_AES=soft, and they are its expected.out`; `aes kernel: ${program} under NISH_AES=soft calls no kernel`; `aes kernel: ${program} with NISH_AES unset calls all four kernels, which /proc/cpuinfo says this CPU runs` |
| A wasm32 build never reaches the kernels' trap stubs | The lowering is skipped for wasm32, so its IR and its link name no `nish_aes_` symbol; the native IR linked for wasm32 is the control that does. IR compiled for the host and linked freestanding with `--profile wasm` (the README's route) does call `nish_aes_hw`: `scripts/build.sh` adds `runtime-aes.c` for it, whose wasm32 build answers 0, so the walker runs and the stubs are never reached (at `5ee57f3`) | `aes kernel: --profile wasi compiles crypto_aes_agree to IR and a .wasm that reference no nish_aes_ symbol, and it prints its expected.out`; `aes kernel: the freestanding --profile wasm link of an AES module compiled for the host links, and encrypts as Node's AES-128 does`; `aes kernel: the freestanding --profile wasm link adds runtime-aes.c to no module that calls no AES, and not again when the inputs name it` |
| A program that calls no AES pays nothing for the unit; wasm32 links it and answers 0 | Section GC; the wasm32 build defines only stubs | `simd: --profile ${profile} links hello with runtime-aes.c to the same bytes as without it, and a program that calls the kernels runs them`; `simd: --profile wasi links runtime-aes.c, and nish_aes_hw answers 0 there` |

## Doc corrections for the security-policy stage

- `std/README.md`, the `crypto/aes.ts` row: "a wrong length answers `null`"
  could add "and so does an `AesKey` not made by `aesKey`", which the module's
  header now says.
- `std/README.md`, the `crypto/chacha20poly1305.ts` and `crypto/aes.ts` rows:
  both could name the Wycheproof files they now run in full
  (`chacha20_poly1305` all 325 cases; `aes_gcm` all 316, of which the 103
  AES-192 cases check that the key is refused).
