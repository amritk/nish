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
- Since WP38 S5 (at `74c2716`): `tests/ct-asm-runtime.js`, its reading of
  `runtime/runtime-aes.c`, and the negative case `tests/simd/aes-leaky.c`.
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
| CT-12 | Low | `tests/ct-timing.js:73`, `:440` | The timing harness had no positive control: every `expect=` function was left out, so a harness that timed nothing (a call the optimiser dropped, a timer that does not tick) would print "none above". | Fixed: the `expect=branch` functions are timed as the control and must differ, or the run fails with exit 2; a filtered run still times them. Measured: `naiveEqual` |t| = 162 at `--quick`, 1114–1301 at 300,000 samples. |
| CT-13 | High if real; unconfirmed | `tests/cases/ct_asm_x25519.ts:148` (`ladderStep`), `std/crypto/x25519.ts`, `tests/ct-timing.js` | `ladderStep` measured |t| = 35–42 at 300,000 samples, every run, on this machine when the driver held all seven x25519 functions — and 1.4–2.9 when it was linked alone or twice, on the same inputs and seeds, and `fieldSub` once read 11. The verdict followed the link layout of the driver, not only the function. It might have been a microarchitectural effect of out-of-domain inputs (the harness handed it unreduced 64-bit limbs and a 64-bit `swap`) that some layouts expose, or a harness artefact. | Open, not reproduced (#378). 34 runs of `ladderStep` on this VM since, in the module's domain and out of it, in the full driver and linked alone, and on the fixture the reading was taken from, read |t| = 1.46–3.22; the weekly CI run read 1.17 (x86-64) and 2.09 (aarch64). That does not establish that the 35–42 was an artefact: it was never re-run on the host that produced it, its cause is not measured, and only the x86-64 code was inventoried ([the readings](#ct-13-the-readings)). `tests/ct-timing.js` now times the fixture on the inputs the module gives each function, with controls of its own that fail the run if the narrowing erases a leak (`DOMAINS`). |
| CT-14 | Low | `tests/run.js:3418` | The check's name says "refused for a conditional branch" for every `expect=` other than `load`, so the new `call` and `latency` seeds are named as branches in the output (the assertion itself is right). | Fixed after this stage: each check is named by the `promise` `ctSpecs` gives its spec in `tests/ct-asm.js`: the kind it expects, and the `via=` callee where there is one, both from the `EXPECT_KINDS` table `ctSpecs` also reads its kinds from, so a kind it accepts always has a name. |
| CT-15 | Low | `tests/run.js:3376` | A clang without the aarch64 target turns that half of the check into counted skips; `npm test` then exits 0 with a "Note", not the DEGRADED banner, since every tool is present. CI's clang has both targets today, but nothing requires it. | Fixed after this stage: `ct_asm: clang targets <target>` is a check for each of the two targets, and fails with clang's answer when one is missing; the target's fixtures are not tried again. Shown with a `clang` that refuses `--target=aarch64*`: 9 skips and exit 0 before, one failure and exit 1 after. The wasm32 compile, which reads no branches, is still a counted skip. |
| CT-16 | Low | `tests/run.js:3369` | The checker reads `clang -O2` for the baseline CPU only. A program built with another profile or `-march` is not what was read, and the ISA extensions behind CT-5 and CT-6 never reach it. | Open, documented here. |
| CT-17 | Low | `tests/ct-asm.js:653`, `:659`, `:666`, `:859` (at `e3d4da1`) | Found reading vector code for WP38 S5 ([below](#the-runtimes-aes-kernels)). Five instructions that read their destination were read as overwriting it, so a secret in the destination came out public: `pshufb`, which the `v?pshuf` overwrite pattern took with `pshufd`; the SSE forms of `shufps` and `palignr`, in the three-operand overwrite list; `movhlps` and `movlhps`, taken as moves; and aarch64's `aese` and `aesd`, which XOR their destination with the key before SubBytes. A `pshufb` by a public mask, the byte reversal every GHASH implementation runs, laundered the block it reversed. No Nish fixture compiles to any of them. | Fixed: each is read as reading its destination; a corner each in `AUDIT_CORNERS`, which fail on the base. |

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

## CT-13: the readings

[#378](https://github.com/amritk/nish/issues/378) asked for `ladderStep` to be
timed on the inputs `std/crypto/x25519.ts` really gives it, in the full
seven-function driver and linked alone. Every reading below is max |t| over
the harness's tests at 300,000 samples a function, one run a seed, on an
`Intel(R) Xeon(R) Processor @ 2.80GHz` (`/proc/cpuinfo`), a 4-vCPU shared
cloud VM, with nothing else running. "Signed domain" is the one the harness
now holds the fixture to (below); "non-negative" is a first, narrower mask
(limbs in `[0, 2^26)` or `[0, 2^25)`) that the review of #537 found
under-stated the module's real inputs, and is kept here as a reading.

| fixture and compiler | inputs | driver | `ladderStep` max \|t\| |
| --- | --- | --- | --- |
| this one, `build/nish` at 69e5fe8 | signed domain | all seven | 1.90, 1.77, 2.24, 1.47 |
| this one, `build/nish` at 69e5fe8 | signed domain | `ladderStep` alone | 2.39, 2.12, 3.13, 2.52 |
| this one, `build/nish` at 69e5fe8 | non-negative | all seven | 1.66, 2.36, 2.33, 1.72 |
| this one, `build/nish` at 69e5fe8 | non-negative | `ladderStep` alone | 2.85, 1.74, 2.74, 1.99 |
| this one, `build/nish` at 69e5fe8 | out of domain | all seven | 2.09, 1.99, 1.46, 2.46, 2.27, 2.33, 3.22 |
| this one, `build/nish` at 69e5fe8 | out of domain | `ladderStep` alone | 2.18, 2.16, 1.56, 2.10 |
| the one CT-13 was read on (0d362c59), the 0.16.0 seed | out of domain | all seven | 2.26, 2.14, 2.36 |
| this one, plus two leaks of the fixture's own (below) | non-negative | all seven and the leaks | 2.07, 1.60 |
| this one, plus two leaks of the fixture's own (below) | out of domain | all seven and the leaks | 1.97, 2.31 |

How each row was taken. Only the "signed domain, all seven" row is a run of
the committed `tests/ct-timing.js`. Every other row was taken with a harness
that is not committed, and cannot be repeated with the one that is:

- "out of domain, all seven": three runs with `tests/ct-timing.js` as it is
  on `main` at 69e5fe8, before `DOMAINS` existed, and four with a scratch copy
  of this harness whose `DOMAINS` lookup was switched off.
- "non-negative": the first version of this change (607ca5d), whose single
  `ct_field25519` mask is no longer in the tree.
- "`ladderStep` alone", in every domain: a scratch copy of the harness that
  filtered the fixture's specs (and its `DOMAINS` entry) to `ladderStep`
  before it wrote the driver.
- the fixture CT-13 was read on: `tests/ct-timing.js` from a worktree at
  0d362c59, with `--nish` naming the 0.16.0 seed.
- the two rows with leaks: 607ca5d's harness, and the scratch copy without
  `DOMAINS`, on the fixture with the two leaks added and then reverted.

The weekly `ct-timing.yml` run of 2026-10-05 (9552a94, 1,000,000 samples,
out of domain) is the second machine: 1.17 on an `INTEL(R) XEON(R) PLATINUM
8573C` and 2.09 on the aarch64 runner. In the signed-domain runs the other six
functions read at most 3.74 (`fieldSub`, once), and `fieldSub`'s 11 did not
recur in any run.

**What this establishes.** On this VM, on today's fixture, `ladderStep` does
not differ between the classes, in its domain or out of it, in either link
layout. On the fixture CT-13 was read on, it did not differ in the one
configuration measured there: out of domain, in the full driver. On the two
CI runners it did not differ in the one reading each has: out of domain, in
the full driver, on today's fixture. `clang -O2` compiles `ladderStep` and
the field functions it calls, for x86-64, to `mov`, `lea`, `add`, `sub`,
`neg`, `and`, `xor`, `sar`, SSE moves, `paddq`, `psubq` and `imulq`, and
calls to `condSwap` and `fieldMul`: no divide and no branch,
which `tests/ct-asm.js` already pins on both targets, and none of those is
documented as taking an operand-dependent time on current x86-64 cores.

**What it does not.** The 35–42 was never re-run on the host that produced
it, so it is not shown to be an artefact. The harness has not changed since
#377, but the fixture has (#426 rewrote its arithmetic in `u64`, which moves
its code and the driver's layout), and a layout effect on that host is an
explanation, not a measurement. The aarch64 code was not inventoried; the CI
runner's 2.09 is its only reading. So CT-13 stays open at its severity, as an
unconfirmed reading that has not reproduced.

**The harness's domain.** A reading on 64-bit limbs is about a function the
module never runs, so `DOMAINS` in `tests/ct-timing.js` gives each function
the fixture times the inputs the module gives it, from the bounds
`std/crypto/x25519.ts` states: `f25519Mul` and `f25519MulA24` are handed the
sum or difference of two reduced elements, signed and below 2^27 in magnitude
(`fieldMul`, `fieldSquare`, `fieldMulA24`); the other functions are handed
reduced elements, below 2^26 in magnitude, limb 1's final carry out of limb 0
included (`f25519Carry`); and the swap bit is 0 or 1. `ct_signed_limbs` in
`tests/ct-timing/dudect.c` makes each secret limb signed with a magnitude
below the bound, after `ct_fill`, in both classes, so zero stays zero and the
class is still only in `ct_fill`'s mask. The run fails with exit 2 when a
fixture in `DOMAINS` is gone, when its entry names a function it does not
time or misses one it does, and when an entry narrows a secret its function
does not take or leaves one unnarrowed.

**The domain's own controls.** For each limb bound and scalar mask a domain
uses, the driver also times a leak written in C (`ct_first_nonzero`, which
stops at the first non-zero limb, and `ct_work_if`, which does extra work
when the scalar is non-zero) on a buffer or scalar of its own. Each must
differ like any `expect=branch` function. What they cover is the narrowing
itself: their `prepare` lines come from the same emitters as the fixture's
(`fillArray`, `fillScalar`), with the same bound or mask from `DOMAINS`, and
call the same `ct_signed_limbs`, so a narrowing that erases the secret fails
them. They do not read the fixture's own lines back; that each of those
narrows the buffer it fills holds by construction, since the emitter is given
one name for both. They are also not the run's control: CT-12's
`expect=branch` functions are still required, and a run without them fails
with exit 2 whatever the domain controls read. In the signed-domain runs they
read |t| = 4,934–25,611 (limbs) and 380–430 (scalar). With `ct_signed_limbs`
changed to erase every limb, both limb controls read about 1.7, and with the
`swap` mask set to 0 the scalar control read 1.52; both runs failed with exit
2.

Two leaks added to the fixture for the first measurement, and not kept, read
the same way through the first mask: `limbLeak`, which returns at the first
non-zero limb, read |t| = 1,297 and 2,105 narrowed and 1,383 and 656 not;
`highBitLeak`, which does 200 extra multiplies when bit 40 of limb 0 is set,
read 791 and 1,088 unnarrowed and 1.77 and 0.98 narrowed, which failed the run
with exit 2 as a control that did not differ.

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

## The runtime's AES kernels

WP38 S5 adds C to the constant-time surface: `runtime/runtime-aes.c` (anchors
below at `74c2716`), AES-GCM on AES-NI and PCLMULQDQ or on the ARMv8 AES and
PMULL instructions, which the compiler is to call in place of four functions
of `std/crypto/aes.ts`. Unlike every Nish fixture it loops over `length`, so
`tests/ct-asm.js`, which refuses every conditional branch, cannot read it.
`tests/ct-asm-runtime.js` does, on the same taint model: the `Taint` state and
the per-instruction steps are ct-asm.js's own, so a corner one learns the other
knows. It compiles the file with `clang -O2 -S -ffreestanding` for x86-64 and
aarch64 and reads each of `nish_aes_schedule` (`:288`), `nish_aes_block`
(`:323`), `nish_aes_ctr` (`:327`) and `nish_aes_ghash` (`:361`), with every
array's elements secret and, for GHASH, `hHi` and `hLo`; `rounds`, `length`
and the array headers are public. It refuses a conditional branch whose flags
or tested register a secret reaches, and, as ct-asm.js does, a load or store at
a secret address, a call, and a divide of a secret. Two things are added for
code with loops:

- **Control flow.** Each label keeps the join of every state that reaches it
  (a register secret on any edge is secret; a stack place the edges disagree
  on is unplaced), and the body is walked until no label changes, so what a
  back edge carries to a loop's head is seen there. The violations are the
  last walk's.
- **The flags per instruction.** ct-asm.js's flags only gain a secret, which
  would refuse every loop once a block had been XORed. Here `cmp`, `test`,
  `add`, `sub`, `and`, `or`, `xor`, `neg`, `adc`, `sbb`, `ptest` and
  `(u)comis` set the flags to their own taint, moves and the SSE, AES-NI and
  PCLMULQDQ instructions but `ptest` leave them, and everything else still
  only adds. On aarch64 only compares and `s`-suffixed instructions write the
  flags, all four at once.

Each kernel must also show at least one conditional branch, all public, so a
listing with the loops gone cannot pass vacuously. The model's corners for
these additions (a public loop bound; a data byte as the bound; a secret the
back edge brings to an index; a forward jump past the code that cleared a
secret; a vector instruction between a compare and its branch; a shift of a
secret before a branch; `cbz` on a secret; GHASH's H as a bound) run when the
module loads. `tests/simd/aes-leaky.c` is the negative case in real compiler
output: `nish_aes_leaky_table` indexes an S-box by a data byte and
`nish_aes_leaky_branch` stops at the first zero byte, and each must be refused
for its kind on both targets. Mutating `runtime-aes.c` itself showed the same:
a loop bound on a keystream byte in `nish_aes_ctr` was refused as a branch,
and a load from `rk` at an offset a schedule word picked as a load, on both
targets.

**The one dispatch.** `nish_aes_hw` (`:446`) is not read, and is the one
branch in the unit on anything but a loop bound: on its stored answer, then,
on the first call only, on `NISH_AES` (`getenv`, `:451`) and on the CPU's
feature bits (`nish_aes_cpu`: CPUID leaf 1's AES, PCLMULQDQ and SSSE3 bits at
`:412`, AT_HWCAP's AES and PMULL at `:423`). Neither depends on a key or data,
and the answer is fixed for the life of the process, so whether a key's
operations run the kernel or the bitsliced Nish code is a property of the
machine and its environment, not of the key. `NISH_AES=soft` pins the
bitsliced path, whose constant time is the Nish code's own (above).

**What it does not model.** The instructions' own timing: AESENC,
AESENCLAST, AESKEYGENASSIST and PCLMULQDQ, and AESE, AESMC and PMULL, are
taken as data-independent. Intel lists them among the instructions whose
latency does not depend on their data (its data operand independent timing
list), and Arm among those FEAT_DIT makes so; the kernels do not set
PSTATE.DIT, so on aarch64 that is the cores' behaviour rather than a
guarantee, and a core where it does not hold is outside this check. Microcode,
frequency effects of the AES units, and the cost of the resolver's first call,
which reads the environment and the CPU but nothing secret. A build other than
`clang -O2` for the baseline CPU (CT-16): the `speed` profile's `-O3` with LTO
and the `debug` profile's `-O0` are not what was read, and `-O0` keeps every
value on the stack. And what the register allocator spills: the stack model
follows a spill and its reload, but a spill is a copy of a secret no wipe
reaches ([crypto-aead.md](crypto-aead.md), AEAD-4).

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
| Each `runtime/runtime-aes.c` kernel, read from `clang -O2` for both targets, branches only on public values and loads and stores only at public addresses (WP38 S5) | `ct_asm: ${r.file} ${r.fn} on ${r.target}: no branch on a secret, call, secret-indexed access or secret-dependent latency` (8 checks) |
| The runtime check refuses a table lookup and a branch on data in real compiler output | `ct_asm: ${r.file} ${r.fn} on ${r.target}: refused for ${r.expect}` (4 checks, `tests/simd/aes-leaky.c`) |
| The runtime check's joins and per-instruction flags read loops as they run | `CORNERS` in `tests/ct-asm-runtime.js`, checked when the module loads |
| A destination-reading vector instruction keeps its destination's taint (CT-17) | `AUDIT_CORNERS` in `tests/ct-asm.js` |

## Doc corrections for the security-policy stage

- `std/README.md`, wherever it describes the constant-time check: it also
  refuses a divide or square root of a secret (`latency`), and the functions
  listed above under "held by discipline only" are not read by it.
- `docs/LANGUAGE.md`, "Constant time": the same addition, and that the check
  reads `clang -O2` for the baseline CPU only (CT-16).
- `tests/run.js:3418` (CT-14) and `:3376` (CT-15) want a fix by whoever owns
  the harness: name the kind each `expect=` checks, and fail rather than skip
  when clang cannot target aarch64. *Since made: see CT-14 and CT-15 above.*
