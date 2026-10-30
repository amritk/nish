# Security audit: the SHA-256 block kernel (SHA-NI and ARMv8)

Part of the repository security audit (#363). This record says what was
checked in `runtime/runtime-sha256.c`, the C kernel that runs SHA-256's block
function on the CPU's own SHA-256 instructions, and in the branch the compiler
puts in front of `std/crypto/sha256.ts`'s `sha256Compress` to reach it. It
says how it was checked, what was found, and which test pins each property.
Anchors are at #1055, the change that adds the kernel, unless a row names another commit.

## Scope

- `runtime/runtime-sha256.c`: `nish_sha256_compress` (`:161`), its guard
  (`:163`), the inlined block for x86-64 (SHA-NI with SSSE3 and SSE4.1) and
  for AArch64 (the ARMv8 Cryptography Extension's `sha256h`, `sha256h2`,
  `sha256su0` and `sha256su1`), the round-constant table (`:79`), the CPU
  questions (`nish_sha256_cpu`, `:174` CPUID, `:187` Linux `getauxval`,
  `:195` macOS `sysctlbyname`, `:203` any other AArch64 system), the resolver
  `nish_sha256_hw` (`:212`, `NISH_SHA256` read at `:217`) and the wasm32 and
  other-target stubs (`:230`, `:234`). Its contract in `runtime/nish.h`.
- The lowering: `isSha256Seam` (`src/kernels.ts:178`), which picks out
  `sha256Compress` by its module and signature, and `emitKernelArm`
  (`src/emit.ts:1737`, called at `:1690`), which emits
  `if (nish_sha256_hw() && nish_sha256_compress(h, w, src, at)) {} else <the
  Nish body>`. The kernel answers 0 when the guard fails, so the Nish body runs
  and panics with its own message.
- The link: `scripts/build.sh` names the unit among the runtime halves
  (`:218`) and adds it to a link whose IR calls `nish_sha256_hw` (`:656` to
  `:665`), so a program that never hashes links none of it.
- The tests: `tests/simd/sha256.c` and `tests/simd/sha256-calls.c`,
  `tests/ct-asm-runtime.js`'s `runtime-sha256.c` entry, the end-to-end
  programs `tests/link/sha256_hw_vectors` and `tests/link/sha256_hw_agree`, and
  the `.text*` budget in `tests/runtime-budgets.js`.

Out of scope: the hash itself, `std/crypto/sha256.ts`, and HMAC and HKDF over
it, which [crypto-k1.md](crypto-k1.md) records; the walker the kernel replaces
is that record's. The instructions' own timing (below).

## Threat model

SHA-256's input is secret whenever its caller's is: HMAC hashes its key, XORed
with the pads, as the first block of each of its two hashes, and HKDF, the TLS
1.3 key schedule and HS256 run on HMAC. So the eight state words, every
message word and every intermediate of a block are secret. The array headers
(`len`, `cap`, `data`), the offset `at` and the number of blocks are public:
they follow the message's length, which the protocols send in the clear.

The attacker can time the process, share its core or cache (a co-tenant), and
choose the inputs it hashes, but cannot read its memory while it runs. After it
runs, a later memory disclosure (a core dump, a swapped page, a read past an
array in other code) is in the model, which is what a wipe is for.

## Method

1. Read the kernel against FIPS 180-4 §6.2.2 and the instruction descriptions
   it cites (Intel's "Intel SHA Extensions", 2013; the Arm ARM, DDI 0487), and
   the guard against `sha256Compress`'s own (`std/crypto/sha256.ts:220`).
2. Ran `tests/simd/sha256.c`, which includes the unit and holds the kernel to
   a portable FIPS 180-4 block on 20,000 seeded blocks and states, the
   specification's vectors, and each refused shape (short `h` or `w`, a
   negative `at`, a block ending past the source, a source longer than
   `toI32` reads), each of which must leave the state untouched and answer 0;
   then the resolver under each pin. Natively on x86-64, and on AArch64 through
   qemu-user where binfmt is registered (with `QEMU_CPU=max`).
3. Read the `clang -O2` assembly of the unit for x86-64 at the baseline and at
   `x86-64-v3`, and for aarch64, with `tests/ct-asm-runtime.js`: the kernel's
   arguments' contents secret, the headers and `at` public, every branch, call,
   load and store address and variable-latency instruction checked. The x86-64
   kernel spills seven times; the stack model follows each spill and its
   reload. The aarch64 kernel does not spill.
4. Linked `sha256_hw_vectors` and `sha256_hw_agree` with the kernel wrapped
   by a counter (`-Wl,--wrap`), ran each with `NISH_SHA256` unset and set to
   `soft`, and compared the two stdouts with each other and with
   `expected.out`, and the call counts with what `/proc/cpuinfo` says the CPU
   has. Linked a SHA-256 module for wasm32 under `--profile wasi` and the
   freestanding `--profile wasm`, and read the IR and the link for
   `nish_sha256_` references.
5. Measured the unit's `.text*` at `-Oz` against its 512-byte budget.

## Findings

| Id | Severity | Where (before the fix) | Description | Disposition |
| --- | --- | --- | --- | --- |
| SHA256HW-1 | Low | `runtime/runtime-sha256.c:163` (before the fix: `at < 0 \|\| src->len < 64 \|\| (uint64_t)at > src->len - 64`) | The kernel's guard read the source's length as it is, where `sha256Compress`'s reads it through `toI32`, which saturates at 2^31 - 1. On a source longer than that, an `at` past 2^31 - 65 was refused by the Nish guard and run by the kernel: the two paths disagreed, which the seam's contract forbids, and a driver that handed such an `at` with a shorter backing read past it (the edge case segfaulted, exit 139). No caller in `std/` reaches it: `Sha256.update` steps `at` by 64 from 0 over a length it has already narrowed with `toI32`. | **Fixed** (#1055): the guard refuses `at > INT32_MAX - 64` as well, the Nish guard's bound for every length past 2^31 - 1. Pinned by `tests/simd/sha256.c`'s "a source past 2^31 - 1 bytes, one past the last offset toI32 of its length allows", which faulted before the fix. |
| SHA256HW-2 | Low | `runtime/runtime-sha256.c` (`nish_sha256_compress`, the inlined block) | **What the kernel cannot wipe.** On the kernel path the eight state words, the sixteen message words and every round's intermediate pass through XMM or NEON registers, and on x86-64 `clang -O2` spills seven of them to the stack. When the kernel returns they stay there until later code overwrites them, and a later memory disclosure could read them; for HMAC that is a block derived from the key. No store from C or the language reaches a register or a spill slot the compiler chose. The kernel keeps no buffer of its own and never writes `w`, the schedule the Nish path leaves in the caller's array; what it does write, the state in `h`, HMAC's hashers wipe as on the Nish path (K1-7). | Open, recorded: neither the language nor C has a way to reach it, as for AEAD-4 ([crypto-aead.md](crypto-aead.md)). |

The constant-time checker's own gap, found reading this kernel (aarch64's
SHA-256 instructions read as overwriting their destination), is CT-20 in
[ct-verification.md](ct-verification.md), fixed.

No Critical, High or Medium finding. SHA256HW-2 is open: it is recorded rather
than fixed.

## Constant time

The kernel branches only on the array headers and `at`, in its guard, and its
loads and stores are at addresses those fix: `src->data + at` for sixteen
words, `h->data` for eight, and the whole round-constant table, read in order
from its first word to its last whatever the data. Each block runs the same
instructions in the same order. The resolver's branches are on the CPU's
feature bits and `NISH_SHA256`, never on data, and its answer is cached once
per process. `tests/ct-asm-runtime.js` holds the assembly to that on x86-64 at
both CPU levels and on aarch64, and holds the unit to exporting only the kernel
and the resolver, so a second kernel cannot go unread
([ct-verification.md](ct-verification.md#the-runtimes-aes-kernels) gives the
model, which this unit shares with `runtime-aes.c`).

The lowered branch adds no secret-dependent instruction: a call to the
resolver, a compare of its answer with zero, the call to the kernel with the
same four operands the Nish function takes, a compare of that answer and the
branch, all on public values. Which body runs depends on the CPU and the pin,
not on the data, and both bodies are held to constant time (the walker by
[crypto-k1.md](crypto-k1.md) and the `ct_asm_*` fixtures).

**What it does not model.** The instructions' own timing: `sha256rnds2`,
`sha256msg1`, `sha256msg2`, `pshufb`, `pblendw` and `palignr`, and `sha256h`,
`sha256h2`, `sha256su0` and `sha256su1`, are taken as data-independent. Intel
lists the SHA extensions among the instructions whose latency does not depend
on their data, and Arm lists the SHA-256 instructions among those FEAT_DIT
makes so; the kernel does not set PSTATE.DIT, so on aarch64 that is the cores'
behaviour rather than a guarantee, and a core where it does not hold is outside
this check. A build other than `clang -O2` at the levels read (CT-16), and
what the register allocator spills, which SHA256HW-2 records.

## What a wipe cannot reach

The kernel holds secret state only in registers and the spill slots the
compiler picks; SHA256HW-2 records both. In memory it writes only the new
state into `h`, which the caller owns: HMAC's hashers wipe their state, block
and schedule on the kernel path as on the Nish path (K1-7 in
[crypto-k1.md](crypto-k1.md)), and on the kernel path the schedule is simply
never written. The resolver holds no secret.

## Properties verified

| property | pinned by |
| --- | --- |
| The kernel computes FIPS 180-4's block on every path the CPU runs, against a portable block, on 20,000 seeded blocks and the specification's vectors | `simd: ${label}: ${said}` with label `sha256 native ${process.arch}` ("sha256: 20020 cases agree across sha-ni; the resolver picks every pin" on an x86-64 with SHA-NI) |
| The ARMv8 path is run, not only compiled, on an x86-64 host with qemu-user | `simd: sha256 aarch64 through binfmt (QEMU_CPU=max), the ARMv8 SHA-256 path names armv8-sha2 as the paths it ran` |
| A CPU that has the instructions runs them | `simd: sha256 ran the ${wantSha} path, which /proc/cpuinfo says this CPU has` |
| Each refused shape, SHA256HW-1's included, leaves the state untouched and answers 0 | `tests/simd/sha256.c`'s `refuses(...)` rows, in the same `simd:` check |
| The kernel branches only on public values and loads and stores only at public addresses, on both targets and both x86-64 levels | `ct_asm: runtime-sha256.c nish_sha256_compress on ${target}: no branch on a secret, call, secret-indexed access or secret-dependent latency` |
| The unit exports nothing the reading leaves out | `ct_asm: runtime-sha256.c nish_sha256_hw on ${target}: exports exactly the kernels read here and nish_sha256_hw` |
| The kernel and the walker print the same bytes, end to end, and those are the expected ones | `sha256 kernel: ${program} prints the same bytes with NISH_SHA256 unset and with NISH_SHA256=soft, and they are its expected.out` |
| `NISH_SHA256=soft` pins the Nish path | `sha256 kernel: ${program} under NISH_SHA256=soft calls no kernel` |
| Unset, the kernel runs where the CPU has it | `sha256 kernel: ${program} with NISH_SHA256 unset calls the kernel, which /proc/cpuinfo says this CPU runs` |
| A program that never hashes links none of the unit; one that does keeps it | `simd: --profile ${profile} links hello with runtime-sha256.c to the same bytes as without it, and a program that calls the kernel runs it` |
| A wasm32 build references no kernel and runs the Nish path | `sha256 kernel: --profile wasi compiles ${program} to IR and a .wasm that reference no nish_sha256_ symbol, and it prints its expected.out`; `simd: --profile wasi links runtime-sha256.c, and nish_sha256_hw answers 0 there`; `sha256 kernel: the freestanding --profile wasm link of a SHA-256 module compiled for the host adds runtime-sha256.c once, and hashes as Node does` |
| The unit stays small | `${label}: .text* at -Oz fits the ${budget} byte budget` with label `runtime-sha256.c` (495 of 512 bytes at #1055) |
| The SHA-256 instructions keep their destination's taint, on aarch64 (CT-20) and x86-64 | `AUDIT_CORNERS` in `tests/ct-asm.js` |
