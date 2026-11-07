# Security audit: the ChaCha20 keystream kernel (AVX2 and NEON)

Part of the repository security audit (#363). This record covers
`runtime/runtime-chacha20.c`, the C kernel that computes ChaCha20's keystream
eight or four blocks at a time in vector registers. It also covers the branch
the compiler puts in front of `std/crypto/chacha20poly1305.ts`'s
`chacha20XorInto` to reach that kernel (WP38 S10,
[wp38-simd.md](https://github.com/amritk/nish/blob/main/docs/wp38-simd.md#31-a-runtime-kernels-chosen-at-run-time)). For each, it
says what was checked, how, what was found, and which test pins each property.
Anchors are at the change that adds the kernel.

## Scope

- **`runtime/runtime-chacha20.c`**:
  - the kernel `nish_chacha20_xor` (`:291`) and its guard (`:293` to `:302`);
  - the four-block minimum (`NISH_CHACHA20_MIN`, `:85`) and the volatile wipe (`:88`);
  - the one-block tail (`:110`);
  - the AVX2 eight-block and 128-bit four-block loop (`NISH_CHACHA20_LOOP`, `:178`, run at `:213`);
  - the NEON four-block loop (`:235`);
  - the CPU question (`:311` CPUID and XGETBV), and the AArch64 verdict `NISH_CHACHA20_ARM_ON` (`:326`);
  - the resolver `nish_chacha20_hw` (`:338`, which reads `NISH_CHACHA20` at `:343`);
  - the stubs for wasm32 and other targets (`:356`, `:360`).
  - Its contract in `runtime/nish.h`.
- **The lowering**:
  - `isChacha20Seam` (`src/kernels.ts:227`) picks out `chacha20XorInto` by its module and signature.
  - `emitKernelArm` (`src/emit.ts:1864`, called at `:1807`) emits `if (nish_chacha20_hw() && nish_chacha20_xor(...)) {} else <the Nish body>`.
  - When the guard fails the kernel answers 0, so the Nish body runs as it would have: it either panics or writes in its own order.
- **The link**: `scripts/build.sh` names the unit among the runtime halves (`:248`). It adds the unit only to a link whose IR calls `nish_chacha20_hw` (`:696` to `:706`), so a program that never uses ChaCha20 links none of it.
- **The tests**:
  - `tests/simd/chacha20.c` and `tests/simd/chacha20-calls.c`;
  - `tests/ct-asm-runtime.js`'s `runtime-chacha20.c` entry;
  - the end-to-end program `tests/link/chacha20_hw_agree`;
  - the wipe check and the `chacha20 kernel` section in `tests/run.js`;
  - the `.text*` budget in `tests/runtime-budgets.js`.

Out of scope:
- The AEAD itself, Poly1305, and the Nish `chacha20XorInto` that the kernel replaces. Those are [crypto-aead.md](crypto-aead.md)'s. S10 timed Poly1305 in C and found it within the noise of the Nish code, so it has no kernel.
- The vector instructions' own timing (see below).

## Threat model

These are secret:
- the key;
- the sixteen state words built from it;
- every round's working words;
- the keystream;
- the plaintext.

The ciphertext is public once it is sent. So are the array headers (`len`, `cap`, `data`), the offsets `srcAt` and `dstAt`, the length, and the counter. The protocols send the message length in the clear, and RFC 8439 §2.8 does not make the counter secret.

The attacker can:
- time the process;
- share its core or cache (a co-tenant);
- choose the plaintext it seals and the ciphertext it opens.

The attacker cannot read the process's memory while it runs. A memory disclosure after it runs is in the model (a core dump, a swapped page, a read past an array in other code), and that is what a wipe is for.

## Method

1. **Read the kernel against the RFC.** Read the kernel against RFC 8439 §2.1 to §2.4. Read the guard against `chacha20XorInto`'s own bounds and its i32 arithmetic (`std/crypto/chacha20poly1305.ts:256`). Read the counter's increment against the Nish function's u32 wrap (`docs/LANGUAGE.md`: u32 arithmetic wraps). Callers bound the counter with `chacha20CounterFits`, and the kernel adds to it with the same wrap.
2. **Ran `tests/simd/chacha20.c`.** It includes the unit and holds the kernel to a portable RFC 8439 block. It covers:
   - seeded keys, nonces, counters (including counters near 2^32, where the increment wraps) and lengths, in place and out of place;
   - the RFC's §2.4.2 vector;
   - each refused shape, each of which must leave every array untouched and answer 0;
   - the resolver under each pin.

   It ran natively on x86-64, and on AArch64 through qemu-user where binfmt is registered.
3. **Read the assembly with `tests/ct-asm-runtime.js`.** Read the `clang -O2` assembly of the unit for x86-64 at the baseline and at `x86-64-v3`, and for aarch64. The contents of the kernel's arguments are taken as secret, and the headers, offsets and length as public. Every branch, call, load and store address and variable-latency instruction was checked.
4. **Compiled the unit twice and counted the wipes' stores.** Compiled the unit at `clang -O2` for both targets, once as written and once with the wipe's `volatile` removed. Counted the zero stores each leaves in `nish_chacha20_xor`. The one as written must keep a volatile 8-byte store for every word of every buffer it wipes. The twin shows what the optimiser deletes without `volatile`.
5. **Ran `chacha20_hw_agree` with the kernel wrapped by a counter.** Linked it with `-Wl,--wrap`, then ran it with `NISH_CHACHA20` unset and set to `soft`. Compared the two stdouts with each other and with `expected.out`, and the call counts with what `/proc/cpuinfo` says the CPU has.
6. **Checked the wasm32 builds.** Linked a ChaCha20 module for wasm32 under `--profile wasi` and read its IR and link for `nish_chacha20_` references. Linked it under the freestanding `--profile wasm` and compared its keystream with Node's `chacha20` cipher.
7. **Measured the unit's size.** Measured the unit's `.text*` at `-Oz` against its 3840-byte budget.

## Findings

| Id | Severity | Where (before the fix) | Description | Disposition |
| --- | --- | --- | --- | --- |
| CHACHAHW-1 | Low | `runtime/runtime-chacha20.c:293` to `:294` (before the fix, a window was checked only against its array's length) | The Nish function sums `srcAt + i` and `dstAt + i` as i32, so on an array longer than 2^31 bytes a window ending past `INT32_MAX - 64` panics on the overflow. The kernel computed the same window in 64 bits and ran it. The two paths disagreed, which the seam's contract forbids, and the edge cases segfaulted (exit 139) in the test harness. No caller in `std/` reaches it: the AEAD passes offset 0 and a length below 2^31. | **Fixed**: the guard refuses a window ending past `INT32_MAX - 64` (`:298`), so the Nish function runs and panics as it would have. Pinned by `tests/simd/chacha20.c`'s refusal rows "a source window past INT32_MAX - 64 in an array past 2^31 bytes, where the Nish sums overflow" and "a destination window past INT32_MAX - 64 in an array past 2^31 bytes". Both faulted before the fix. |
| CHACHAHW-2 | Low | `runtime/runtime-chacha20.c` (`nish_chacha20_xor`, the inlined loops) | **What the kernel cannot wipe.** On the kernel path, the state words, every round's working words and the keystream pass through YMM, XMM or NEON registers, and `clang -O2` spills some of them to the stack on both targets. When the kernel returns, they stay there until later code overwrites them, and a later memory disclosure could read them. No store from C or the language reaches a register or a spill slot that the compiler chose. The buffers the kernel names itself are wiped (below). | Open, recorded: neither the language nor C has a way to reach it, as for AEAD-4 ([crypto-aead.md](crypto-aead.md)) and SHA256HW-2 ([crypto-sha256-hw.md](crypto-sha256-hw.md)). |

The kernel's round counter is a `decl; jne` after a secret add. The constant-time checker gave CF and the other flags one taint, so it read that `jne` as a branch on a secret. The checker now follows CF on its own, because `inc` and `dec` leave it (described in [ct-verification.md](ct-verification.md#the-runtimes-aes-kernels)). That change made the checker more precise without opening a gap: two `AUDIT_CORNERS` rows pin both sides, a `sete` that must pass and a `setb` that must be refused.

No Critical, High or Medium finding. CHACHAHW-2 is open: it is recorded rather than fixed.

## Constant time

**The kernel.** ChaCha20 is 32-bit additions, xors and rotations by constants: no table and no data-dependent branch.
- The kernel branches only in its guard and loops, on the array headers, the offsets and the length.
- Its loads and stores are at addresses those fix.
- Every block runs the same instructions in the same order.
- The rotations are shifts and ors, `vpshufb` with a constant mask, or `vrev32`, `vshl` and `vsri` on NEON. None has a latency that depends on its data.

**The resolver.** It branches only on the CPU's feature bits and `NISH_CHACHA20`, never on data, and its answer is cached once per process.

**What the reading holds.** `tests/ct-asm-runtime.js` holds the assembly to the rules above on x86-64 at both CPU levels and on aarch64. It also holds the unit to exporting only the kernel and the resolver, so a second kernel cannot go unread. [ct-verification.md](ct-verification.md#the-runtimes-aes-kernels) gives the model, which this unit shares with `runtime-aes.c`.

**The lowered branch** adds no instruction that depends on a secret. It is:
- a call to the resolver and a compare of its answer with zero;
- the call to the kernel with the six operands the Nish function takes;
- a compare of that answer, and the branch.

All of these are on public values. Which body runs depends on the CPU, the pin and the public length (the four-block minimum), never on the data. Both bodies are held to constant time: the Nish function by [crypto-aead.md](crypto-aead.md) and the `ct_asm_chacha20poly1305` fixture.

**What it does not model.** The vector instructions' own timing is taken as data-independent: AVX2's `vpaddd`, `vpxor`, `vpslld`, `vpsrld`, `vpor` and `vpshufb`, and NEON's `add`, `eor`, `shl`, `sri` and `rev32`. That is the cores' behaviour rather than a guarantee. On aarch64 the kernel does not set PSTATE.DIT. Also outside this check:
- a build other than `clang -O2` at the levels read (CT-16);
- what the register allocator spills, which CHACHAHW-2 records.

## What a wipe cannot reach

**What the kernel wipes.** On the stack, the kernel names three buffers:
- the working words `x`;
- the input block copy `in`;
- the keystream `ks`.

On NEON there are also the row vectors. Before it returns, each loop and the tail zeroes every one of these with volatile 8-byte stores, the mechanism `nish:secret`'s `wipe` and `runtime-aes.c` use. A check in `tests/run.js` holds this under `clang -O2`.

**What the caller wipes.** The kernel writes the counter word into the caller's `state` and the output into `dst`. The state is the caller's to wipe, as on the Nish path ([crypto-aead.md](crypto-aead.md)). The Nish function's own keystream array, which it wipes, is never allocated on the kernel path.

**What stays.** The registers and spill slots are CHACHAHW-2. The resolver holds no secret.

## Properties verified

| property | pinned by |
| --- | --- |
| The kernel computes RFC 8439's keystream on every path the CPU runs, against a portable block, on seeded inputs including counters that wrap past 2^32 - 1 | `simd: ${label}: ${said}` with label `chacha20 native ${process.arch}` ("chacha20: … cases agree across avx2; the resolver picks every pin" on an x86-64 with AVX2) |
| The NEON path is run, not only compiled, on an x86-64 host with qemu-user | `simd: chacha20 aarch64 through binfmt, the NEON path` |
| A CPU that has AVX2 runs it | `simd: chacha20 ran the avx2 path, which /proc/cpuinfo says this CPU has` |
| Each refused shape, CHACHAHW-1's included, leaves every array untouched and answers 0 | `tests/simd/chacha20.c`'s `refuses(...)` rows, in the same `simd:` check |
| The kernel branches only on public values and loads and stores only at public addresses, on both targets and both x86-64 levels | `ct_asm: runtime-chacha20.c nish_chacha20_xor on ${target}: no branch on a secret, call, secret-indexed access or secret-dependent latency` |
| The unit exports nothing the reading leaves out | `ct_asm: runtime-chacha20.c exports on ${target}: exports exactly the kernels read here and nish_chacha20_hw` |
| The stack buffers' wipes survive the optimiser | `runtime-chacha20.c on ${target.name}: the wipes survive clang -O2 (a volatile zero of 8 bytes for each of nish_chacha20_xor's ${want} wipes), where a twin without volatile keeps fewer zero stores` |
| The kernel and the Nish function print the same bytes, end to end, and those are the expected ones | `chacha20 kernel: ${program} prints the same bytes with NISH_CHACHA20 unset and with NISH_CHACHA20=soft, and they are its expected.out` |
| `NISH_CHACHA20=soft` pins the Nish path | `chacha20 kernel: ${program} under NISH_CHACHA20=soft calls no kernel` |
| Unset, the kernel runs where the CPU has the vectors | `chacha20 kernel: ${program} with NISH_CHACHA20 unset calls the kernel, whose vectors this CPU has` |
| A program that never uses ChaCha20 links none of the unit; one that does keeps it | `simd: --profile ${profile} links hello with runtime-chacha20.c to the same bytes as without it, and a program that calls the kernel runs it` |
| A wasm32 build references no kernel and runs the Nish path | `chacha20 kernel: --profile wasi compiles ${program} to IR and a .wasm that reference no nish_chacha20_ symbol, and it prints its expected.out`; `simd: --profile wasi links runtime-chacha20.c, and nish_chacha20_hw answers 0 there`; `chacha20 kernel: the freestanding --profile wasm link of a ChaCha20 module compiled for the host adds runtime-chacha20.c once, and its keystream is Node's` |
| The unit stays small | `${label}: .text* at -Oz fits the ${budget} byte budget` with label `runtime-chacha20.c` (3840-byte budget) |
| `dec` and `inc` leave CF's taint, and a condition that reads CF still sees it | `AUDIT_CORNERS` in `tests/ct-asm.js` (the two carry-flag rows) |
