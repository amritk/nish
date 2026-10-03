# Security audit: the constant-time checks

Part of the repository security audit (#363). The other crypto stages lean on
two tools to say their code is constant time: `tests/ct-asm.js`, which reads
the machine code `clang -O2` writes for x86-64 and aarch64, and
`tests/ct-timing.js`, which times the same functions. A check that has never
been shown to fail proves nothing, so this record says what each one claims,
whether it was shown to catch each thing it claims, what it missed, and which
test now pins each property.

## Scope

- `tests/ct-asm.js`: `ctSpecs` (the `// ct-check:` lines), `functionBody`, the
  `Taint` model (registers, flags, the stack byte by byte, followed calls),
  `stepX86` and `stepArm`, `ctViolations`, and the corner lists that run when
  the module loads.
- `tests/cases/ct_asm_refused`: the functions written to fail.
- `tests/ct-timing.js` and `tests/ct-timing/dudect.c` / `dudect.h`: the driver
  it generates, the classes, the t-tests, the threshold and the exit codes.
- Read, not changed (outside this stage): the `ct_asm` block of
  `tests/run.js` (lines 3346–3530 at the base), `.github/workflows/ci.yml` and
  `.github/workflows/ct-timing.yml`, and every other `tests/cases/ct_asm_*`
  fixture, each owned by its module's stage.

## Threat model

The attacker is the one every constant-time claim is about: they choose
public inputs, observe the running time of a secret-handling function (over
the network or from a neighbouring process sharing caches and predictors) and
want the secret. The function leaks if its control flow, the addresses it
touches, or the latency of an instruction it runs depends on a secret.

The adversary *of this stage* is the checker's own blind spot: an instruction
sequence a secret-dependent function compiles to that the checker reads as
clean. A false alarm costs a fixture author an afternoon; a false negative is
a pass nobody earned, so the model is held to err towards refusing.

## Method

- **Read `tests/ct-asm.js` line by line against what it claims** in its
  header: no conditional branch, no call it cannot follow (and so no jump out
  of the function), no load or store at a secret address. For each step table
  (`X86_*`, `ARM_*`) the question was which instructions it would read as
  something they are not — a prefix as a mnemonic, a write as a read, a load
  as an arithmetic op — and each suspicion was written as a hand-built
  snippet and run through `ctViolations` on the base checker. Every one that
  passed there is a finding below; each is now an `AUDIT_CORNERS` row.
- **Compiled real seeds.** Each rule got a Nish function written to break it,
  compiled with `build/nish-test` and `clang -O2 -S` for both triples, and
  the listing read by hand to confirm the seed compiles to the violation and
  only by that route (for example, that `leakyRow` stays a separate function
  on both targets, so the leak in `callsLeak` is found only by following the
  call).
- **Ran the base checker on the new fixture** to show what it missed, and the
  branch's checker on every existing fixture to show no fixture regressed.
- **Read the timing harness** against the dudect paper (Reparaz, Balasch,
  Verbauwhede, DATE 2017) and its reference implementation's cropping and
  second-order schedule; ran `node tests/ct-timing.js --quick` and
  `--samples 300000` on this machine (Intel Xeon @ 2.80 GHz, a VM), with
  repeated seeds and with hand-rebuilt drivers to separate a function's own
  timing from the harness's.
- **Read CI**: `ci.yml` runs `npm test` on `ubuntu-latest` with Debian's
  `clang-18`, which carries both targets (`clang -print-targets`), so both
  architectures' assembly is read on every pull request — cross-compiled on
  the x86-64 runner, not on aarch64 hardware. `ct-timing.yml` runs the timing
  harness weekly on `ubuntu-latest` and `ubuntu-24.04-arm`.

## Findings

| id | severity | file:line | description | disposition |
| --- | --- | --- | --- | --- |
| CT-1 | Low | `tests/cases/ct_asm_refused.ts`, `tests/run.js:3528` | The fixture written to fail seeded two rules (a branch, a secret-indexed load). A store at a secret address, a call to code the checker does not read, a tail call out of the function, and a leak inside a followed call had never been shown refused in real compiler output, and the suite's coverage check asked only for `branch` and `load`. | Fixed: eight seeds, each checked on both targets; `SEEDED` (`tests/ct-asm.js:1314`) fails the suite at load if one is deleted or its `expect=` loosened. |
| CT-2 | Low | `tests/ct-asm.js:655`, `:838` | No rule for an instruction whose latency follows its operands: `a / (secret \| 1)` compiles to a bare `divl` / `udiv` and passed. Integer divide latency is data-dependent on the processors both targets cover (the KyberSlash class). No current fixture divides a secret. | Fixed: new `latency` kind for `div`/`idiv`, `udiv`/`sdiv` and floating divide and square root of a secret; seed `secretDivide`; corners. |
| CT-3 | Low | `tests/ct-asm.js:661` | An x86 prefix on the instruction's line hid it: `notrack jmpq *%rax` (what `-fcf-protection` gives a jump table) read as a data move and passed; `lock xaddl` likewise. | Fixed: prefixes are stripped and the instruction behind read; corners `notrack jmpq`, `lock xaddl`. |
| CT-4 | Low | `tests/ct-asm.js:730` | `xchg`, `xadd` and `cmpxchg` with memory write their register with what memory held; the model kept the register's own taint, so a secret read this way came out public. | Fixed: refused as `unmodelled`; corner. |
| CT-5 | Low | `tests/ct-asm.js:735` | `mulx` multiplies by `%rdx`, which it does not name, and writes both registers it does; the model read neither, so a secret multiplier gave a public product. BMI2 is not in the baseline target, so CI never sees it. | Fixed: modelled; two corners. |
| CT-6 | Low | `tests/ct-asm.js:647`, `:663` | AVX-512 merge masking (`{%k1}` without `{z}`) and instructions that read their destination (`vpternlog`, `vpermt2`/`vpermi2`, `vpdp*`, `vpmadd52*`, `vpsh[lr]dv`) were read as overwriting it, dropping its taint. Not in the baseline target. | Fixed: read as merges; two corners. |
| CT-7 | Low | `tests/ct-asm.js:828`, `:830` | aarch64 pointer-authenticated calls and jumps (`blraa`, `blraaz`, `braa`, …) were not calls; `blraaz x8` passed. Emitted under `-mbranch-protection`. | Fixed; corners. |
| CT-8 | Low | `tests/ct-asm.js:826` | aarch64 `bc.<cond>` (FEAT_HBC) is a conditional branch and passed. | Fixed; corner. |
| CT-9 | Low | `tests/ct-asm.js:832`, `:925` | aarch64 acquire and exclusive loads (`ldaxr`, `ldapr`) were not loads, so the register took its address's taint and a secret element came out public; atomics and exclusive stores (`ldadd`, `swp`, `cas`, `stxr`) were read as arithmetic. | Fixed: the plain ones are loads; any other memory instruction but a prefetch is `unmodelled`; corners. |
| CT-10 | Low | `tests/ct-asm.js:835` | aarch64 `fccmpe` was not a compare: it was read as writing its first operand and left the flags clean, so a `csetm` after a secret float compare was public. | Fixed; corner. |
| CT-11 | Low | `tests/ct-asm.js:142` | A `ct-check` whose `secret=contents` names a function with no array argument taints nothing and passes whatever the function does. | Fixed: refused as a spec problem, checked at load. |
| CT-12 | Low | `tests/ct-timing.js:69`, `:291` | The timing harness had no positive control: every `expect=` function was left out, so a harness that timed nothing (a call the optimiser dropped, a timer that does not tick) would print "none above". | Fixed: the `expect=branch` functions are timed as the control and must differ, or the run fails with exit 2; a filtered run still times them. Measured: `naiveEqual` |t| = 162 at `--quick`, 1114–1301 at 300,000 samples. |
| CT-13 | High if real; unconfirmed | `tests/cases/ct_asm_x25519.ts:148` (`ladderStep`), `std/crypto/x25519.ts`, `tests/ct-timing.js` | `ladderStep` measures |t| = 35–42 at 300,000 samples, every run, on this machine when the driver holds all seven x25519 functions — and 1.4–2.9 when it is linked alone or twice, on the same inputs and seeds, and `fieldSub` once read 11. The verdict follows the link layout of the driver, not only the function. It may be a microarchitectural effect of out-of-domain inputs (the harness hands it unreduced 64-bit limbs and a 64-bit `swap`) that some layouts expose, or a harness artefact; it is not established either way. | Open: for the x25519 stage to decide with the module's real input domain; this stage does not own the fixture and does not widen its scope. The weekly run on CI hardware is the other reading. Tracked in [#378](https://github.com/amritk/nish/issues/378). |
| CT-14 | Low | `tests/run.js:3418` | The check's name says "refused for a conditional branch" for every `expect=` other than `load`, so the new `call` and `latency` seeds are named as branches in the output (the assertion itself is right). | Fixed after this stage: each check is named by the `promise` `ctSpecs` gives its spec in `tests/ct-asm.js`: the kind it expects, and the `via=` callee where there is one, both from the `EXPECT_KINDS` table `ctSpecs` also reads its kinds from, so a kind it accepts always has a name. |
| CT-15 | Low | `tests/run.js:3376` | A clang without the aarch64 target turns that half of the check into counted skips; `npm test` then exits 0 with a "Note", not the DEGRADED banner, since every tool is present. CI's clang has both targets today, but nothing requires it. | Fixed after this stage: `ct_asm: clang targets <target>` is a check for each of the two targets, and fails with clang's answer when one is missing; the target's fixtures are not tried again. Shown with a `clang` that refuses `--target=aarch64*`: 9 skips and exit 0 before, one failure and exit 1 after. The wasm32 compile, which reads no branches, is still a counted skip. |
| CT-16 | Low | `tests/run.js:3369` | The checker reads `clang -O2` for the baseline CPU only. A program built with another profile or `-march` is not what was read, and the ISA extensions behind CT-5 and CT-6 never reach it. | Open, documented here. |

No fixture failed the stricter checker: every function in every
`tests/cases/ct_asm_*` passes on both targets after CT-2 to CT-11, so none of
those gaps was hiding a leak in code checked today.

## Seeded violations

`tests/cases/ct_asm_refused` now holds one function for each rule, and
`tests/run.js` checks each on x86-64 and on aarch64 (16 checks):

| function | rule | expected kind | what it compiles to |
| --- | --- | --- | --- |
| `naiveEqual` | conditional branch | `branch` | the early-exit loop's `jne` / `b.ne` |
| `indexedLookup` | load at a secret address | `load` | `movl (%rax,%rsi,4), %eax` / `ldr w0, [x8, w9, uxtw #2]` |
| `indexedStore` | store at a secret address | `load` (the kind covers both) | `movl $1, (%rax,%rsi,4)` / `str w10, [x8, w9, uxtw #2]` |
| `unreadCall` | call to code not read | `call` | `callq nish_arena_mark`, `nish_str_from_u64` / `bl` |
| `secretText` | tail call out of the function | `call` | `jmp nish_str_from_u64@PLT` / `b nish_str_from_u64` |
| `callsLeak` | leak inside a followed call | `load` via `leakyRow` | four `callq leakyRow` / `bl leakyRow` |
| `tailLeak` | leak inside a followed tail call | `load` via `leakyRow` | `jmp leakyRow@PLT` / `b leakyRow` |
| `secretDivide` | variable-latency instruction | `latency` | `divl %esi` / `udiv w0, w0, w8` |

`via=leakyRow` is new: a violation found outside the named callee is reported
as `load outside leakyRow`, so if LLVM ever inlines `leakyRow` the two checks
fail instead of passing without following anything.

`escape` (a stack address stored off the stack) and `unmodelled` have no seed,
because no Nish source reliably compiles to either; they are held by the
hand-written corners in `tests/ct-asm.js` (`STACK_CORNERS`, `AUDIT_CORNERS`).

## Checked arithmetic and the fixtures

Signed `+ - *` became a checked panic after this record was written
(`docs/LANGUAGE.md`, "Semantics decisions"), and the check is a conditional
branch, on a secret when the operands are secret. So the constant-time code
does its arithmetic where nothing is checked: secret sums and products in
`u32` or `u64`, which wrap by definition and have the bits the old signed
arithmetic had wherever it did not overflow — `base64urlRangeMask` and
`x509RangeMask`, the character maps beside them, and x25519's limbs through
`f25519Add64`, `f25519Sub64` and `f25519Mul64`, whose bounds the module
already proves in its comments — and the public offsets of the loads and
stores the fixtures read (`at + k`) in `u32` too, so that a fixture compiled
with `--unchecked-indexing` has no check left to branch on. Every fixture's
copy changed with its module, and each still passes its link test against the
module. A check the compiler proves away — a loop counter, a masked value —
is no branch at all, and the fixtures rely on that too.

## Functions still held by discipline only

The assembly check reads a function only if a fixture names it, and it
refuses every branch, so a function with a loop — even one whose trip count
is public — can never pass it. The fixtures are therefore *copies* of each
module's straight-line cores (each kept honest by its `.out` or link test
against the module's own vectors); the module functions themselves are not
read. What follows is every secret-handling function in `std/crypto` that no
fixture reads, as a copy or otherwise. Their constant time rests on review.

- **`std/crypto/ct.ts`**: `timingSafeEqual`, `timingSafeEqualAt`, whose
  loops run for a length. (`ct_asm_k1_ct` reads copies of their cores:
  `timingSafeEqual`'s loop unrolled at 32 and 48 bytes, and
  `timingSafeEqualAt`'s at a 16-byte window.)
- **`std/crypto/base64url.ts`**: `base64urlEncode`, `base64urlDecode`: their
  length-driven loops, the decoder's store guard and the encoder's string
  building. (`ct_asm_k1_base64url` reads `base64urlCharOf` and
  `base64urlSextetOf` verbatim, and one encode group and one decode group, as
  copies.)
- **`std/crypto/hmac.ts`**: `hmacPadBlock`, `hmacSha256`, `hmacSha384`,
  `hmacSha256Verify`, `hmacSha384Verify`.
- **`std/crypto/hkdf.ts`**: `hkdfSalt`, `hkdfAppend`, `hkdfExtractSha256`,
  `hkdfExtractSha384`, `hkdfExpandSha256`, `hkdfExpandSha384`.
- **`std/crypto/sha256.ts`**: `sha256Compress`, `sha256LoadWord`,
  `sha256CopyBytes`, `sha256` (secret whenever they hash a key, as in HMAC).
- **`std/crypto/sha512.ts`**: `loadWord`, `storeWord`, the round helpers,
  `sha512`, `sha384`.
- **`std/crypto/x25519.ts`**: `f25519Invert`, `f25519SquareTimes`,
  `f25519Decode`, `f25519Encode`, `x25519Ladder` (its 255-step loop),
  `x25519`, `x25519Base`. (`f25519Mul`, `f25519Square`, `f25519Add`,
  `f25519Sub`, `f25519MulA24`, `f25519Swap` and one ladder step are read as
  copies in `ct_asm_x25519`.)
- **`std/crypto/chacha20poly1305.ts`**: `chacha20QuarterRound`, `chacha20Core`,
  `chacha20State`, `chacha20Block`, `chacha20`, `chacha20XorInto`,
  `chacha20HeaderMask`, `poly1305Absorb`, `poly1305`, `poly1305KeyGen`,
  `chacha20Poly1305Tag`, `chacha20Poly1305Seal`, `chacha20Poly1305Open`.
  (`poly1305Clamp`, `poly1305Block`, `poly1305Finish` and
  `chacha20Poly1305TagMatch` are read as copies.)
- **`std/crypto/aes.ts`**: the key schedule (`aesExpand`, `aesSubWord`,
  `aesKey`), `aesEncryptBatch`, `aesEncryptOne`, `aesEncryptBlock`,
  `aesHeaderMask`, `ghashUpdate`, `aesGcmCtr`, `aesGcmTag`, `aesGcmSeal`,
  `aesGcmOpen`. (`aesBitslicedRound` with the helpers it inlines,
  `ghashMultiply` and `aesGcmTagMask` are read as copies.)
- **`std/crypto/p256.ts`**: `p256FiatNonzero`, `p256FiatSelectznz`,
  `p256FiatScalarAdd`, `p256FieldInvert`, `p256ScalarInvert`,
  `p256ScalarMult`, `p256LimbsFromBytes`, `p256LimbsToBytes`,
  `p256SubBorrow`, `p256Below`, `p256ReduceOnce`, `p256AffineX`,
  `p256EncodePoint`, `p256DigestScalar`, `p256NonceKey`, `p256SignScalar`,
  `p256PublicKey`, `p256Sign`, `p256SignSha256`. (The field and scalar
  multiplies, add, subtract and conditional move, the point doubling and
  addition, the table move and select, and one window step are read as copies
  or reshaped copies.) `p256Verify` handles only public data.

`std/crypto/x509.ts` handles public data and is not constant-time code.

## Properties verified

| property | pinned by |
| --- | --- |
| Every rule the assembly check enforces refuses a real violation, on both targets | `ct_asm: ct_asm_refused <fn> on x86-64 / aarch64` (16 checks in `npm test`) |
| No seed can be deleted, or its `expect=`/`via=` loosened, silently | `SEEDED` in `tests/ct-asm.js`, checked when the module loads |
| A followed call's leak is found inside the callee, not in inlined code | `via=leakyRow` on `callsLeak` and `tailLeak`; `CALL_CORNERS` `leakVia` / `leakElsewhere` |
| A chain of calls deeper than `CALL_DEPTH` is refused, not followed for ever | `CALL_CORNERS` `deep` |
| Each gap in CT-2 to CT-10 is refused, and the shapes beside it still pass | `AUDIT_CORNERS` (19 rows), checked when the module loads |
| A spec that makes nothing secret is refused | `seedMisses` in `tests/ct-asm.js` |
| No existing fixture leaks by the stricter rules | every `ct_asm: … no branch, call, secret-indexed access or secret-dependent latency` check |
| Each refusal check is named for the kind it expects (CT-14) | `EXPECT_KINDS` and each spec's `promise` in `tests/ct-asm.js` |
| Both targets are read, or the run fails (CT-15) | `ct_asm: clang targets x86-64 / aarch64` |
| The timing harness can see a leak it is shown | the control in `tests/ct-timing.js`; a quiet control is exit 2 |

## Doc corrections for the security-policy stage

- `std/README.md`, wherever it describes the constant-time check: it also
  refuses a divide or square root of a secret (`latency`), and the functions
  listed above under "held by discipline only" are not read by it.
- `docs/LANGUAGE.md`, "Constant time": the same addition, and that the check
  reads `clang -O2` for the baseline CPU only (CT-16).
- `tests/run.js:3418` (CT-14) and `:3376` (CT-15) want a fix by whoever owns
  the harness: name the kind each `expect=` checks, and fail rather than skip
  when clang cannot target aarch64. *Since made: see CT-14 and CT-15 above.*
