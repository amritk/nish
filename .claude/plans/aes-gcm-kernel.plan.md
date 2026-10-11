---
name: AES-GCM as a runtime kernel (AES-NI + PCLMULQDQ, ARMv8 AES + PMULL)
overview: Measure where the bitsliced AES sits on real TLS and QUIC traffic, then lower four private seams of std/crypto/aes.ts to a runtime kernel chosen at run time with cpuid, keeping the bitsliced Nish code as the fallback, the Node reading and the wasm path (WP38 S5, after S1's indexOfAny precedent).
stages:
  - id: measure
    title: "docs(simd): measure AES-GCM and write WP38's S5 row with its bar"
    goal: Record the baseline (MB/s and cycles/byte) and one real exchange's CPU split in WP38 as stage S5, with the bar, at a named commit, before anything is built
    verification: node bench/aes-gcm.mjs --check prints the checksum line and exits 0, and grep -n "S5" docs/wp38-simd.md shows the stage row with its bar and commit
    todos:
      - id: measure-bench
        content: Add bench/aes-gcm.ts and its driver bench/aes-gcm.mjs (seal, open, ChaCha20-Poly1305, aesHeaderMask; 16 KiB and 1,200 B) — see Stage 1
      - id: measure-noise
        content: Time the baseline against a byte-identical copy of itself in the same interleaved rounds for the noise band — see Stage 1
      - id: measure-profile
        content: Profile the interop server under curl --http2 of a 1 MB file and split its CPU time by function — see Stage 1
      - id: measure-row
        content: Write WP38 §7's S5 row and an S5 subsection with the figures, the machine, the commit and the bar — see Stage 1
  - id: seams
    title: "refactor(std): give std/crypto/aes.ts four private seams, each called from one place"
    goal: The CTR keystream, GHASH over n blocks, the key schedule and the single-block encrypt are each one private function with the contract in Kernel contract, called from exactly one place, with byte-identical output and no slower
    verification: npm run check && node tests/run.js link && node tests/run.js ct && node tests/self/goldens.js && node bench/aes-gcm.mjs --check
    todos:
      - id: seams-schedule
        content: Make aesScheduleInto(key, rounds, rk) the key-schedule seam, called once, from the one schedule entry aesKey and aesKeyInto share — see Stage 2
      - id: seams-block
        content: Make aesBlockInto(rk, rounds, src, dst) the single-block seam, called once from aesEncryptOne — see Stage 2
      - id: seams-ctr
        content: Make aesCtrInto(rk, rounds, j0, src, dst, length) the GCTR seam, called once from aesGcmCtr — see Stage 2
      - id: seams-ghash
        content: Make ghashBlocksInto(y, hHi, hLo, rk, data, length) the GHASH seam, called once from ghashUpdate — see Stage 2
      - id: seams-checks
        content: Hoist every bounds check a seam relies on into its one caller so the seam's preconditions are the Kernel contract's — see Stage 2
      - id: seams-goldens
        content: Regenerate tests/self/goldens and any AES .ll golden with the repo's tools and read the diff — see Stage 2
      - id: seams-speed
        content: Show the fallback is not slower than the S5 baseline, outside the noise band, with bench/aes-gcm.mjs — see Stage 2
  - id: runtime
    title: "feat(runtime): runtime-aes.c, AES-GCM on AES-NI/PCLMULQDQ and ARMv8 AES/PMULL"
    goal: A new runtime unit implements the Kernel contract on x86-64 and AArch64, picks its path lazily with cpuid or the AArch64 hwcaps, can be pinned off by environment, wipes what it owns, is constant time by disassembly, and agrees with a reference on a fuzzed corpus
    verification: node tests/run.js runtime && node tests/run.js simd && node tests/ct-asm.js && npm run lint
    todos:
      - id: runtime-unit
        content: Write runtime/runtime-aes.c and its prototypes in runtime/nish.h — see Stage 3
      - id: runtime-dispatch
        content: Add the lazy resolver and the NISH_AES pin, no __builtin_cpu_supports — see Stage 3
      - id: runtime-wipe
        content: Wipe every buffer the kernel owns with a store opt -O2 keeps — see Stage 3
      - id: runtime-build
        content: Wire runtime-aes.c into scripts/build.sh and every link list that names runtime-simd.c except src/ — see Stage 3
      - id: runtime-budget
        content: Give it a .text ceiling in tests/run.js with the measured size beside it, and rows in wp7 and MASTER_PLAN §2 — see Stage 3
      - id: runtime-agree
        content: Add tests/simd/aes-gcm.c, an agreement test of every path against a textbook reference on vectors and a fuzzed corpus — see Stage 3
      - id: runtime-arm64
        content: Run the agreement test in the simd-arm64 CI job and require its line to name the ARMv8 path — see Stage 3
      - id: runtime-ct
        content: Extend tests/ct-asm.js, or add a sibling, to read the kernel's -O2 assembly on x86-64 and aarch64 — see Stage 3
      - id: runtime-records
        content: Record the dispatch in docs/security/ct-verification.md and the vector-register finding in docs/security/crypto-aead.md — see Stage 3
      - id: runtime-notices
        content: Keep any adapted sequence's notice and list it in THIRD_PARTY_NOTICES.md — see Stage 3
  - id: lower
    title: "perf(runtime): AES-GCM on AES-NI and PMULL, with the bitsliced path as fallback"
    goal: The compiler lowers each seam's one call to the kernel behind a run-time branch that keeps the bitsliced walker as the fallback, never on wasm32, and the kernel and the walker agree byte for byte end to end
    verification: npm run check && npm test && node tests/run.js wasi && node tests/run.js performance && node bench/run.mjs --instructions --check && node bench/aes-gcm.mjs --check
    todos:
      - id: lower-recognise
        content: Recognise the four seams in src/kernels.ts by module and name, as isIndexOfAnyWalk does — see Stage 4
      - id: lower-emit
        content: Lower each seam's call in src/emit.ts to the kernel behind nish_aes_hw, keeping the walker called on the fallback, and skip it on wasm32 — see Stage 4
      - id: lower-runtime-decls
        content: Declare the kernel symbols in src/runtime.ts and list runtime-aes.c in src/run-cache.ts — see Stage 4
      - id: lower-secret
        content: Decide isPureRuntime for the kernel symbols in src/secret.ts, with the reason written beside it if listed — see Stage 4
      - id: lower-agree
        content: Add the end-to-end agreement checks (NIST, Wycheproof aes_gcm, RFC 9001 A.5, fuzzed corpus) run hardware and with NISH_AES forced off — see Stage 4
      - id: lower-goldens
        content: Regenerate the AES .ll goldens, tests/self/goldens and the differential registry, and show non-AES goldens unchanged — see Stage 4
      - id: lower-interop
        content: Add the kernel's files to interop.yml's paths so its TLS and QUIC lanes run on this PR — see Stage 4
      - id: lower-measure
        content: Re-run bench/aes-gcm.mjs, write the result into WP38's S5 row, and judge it against the bar — see Stage 4
      - id: lower-docs
        content: Update std/README.md's aes.ts row, WP34 K3's Left cell and the aes.ts header comment — see Stage 4
---

# AES-GCM as a runtime kernel

## Context

[`std/crypto/aes.ts`](../../std/crypto/aes.ts) is bitsliced. WP34 K3 records it as "correct though slow", and it sits on the hot path of most real connections. The TLS server takes the first suite the client lists ([`chooseSuite`](../../std/net/tls.ts)), and Chrome and curl on AES-capable machines list AES-GCM first. QUIC Initial packets are always AES-128-GCM, and QUIC header protection is AES-ECB ([`aesHeaderMask`](../../std/net/quic-packet.ts)).

The route is decided, and this plan does not reopen it. WP38 §3.3 declines target intrinsics in the language. AES-NI goes into the runtime behind a function, as WP38 rule 4 and §3.1 say, and as S1 did for byte search. The precedent is [`src/kernels.ts`](../../src/kernels.ts): `indexOfAny`'s private walker is recognised by module and name, its one call becomes `nish_str_index_of_any` in [`runtime/runtime-simd.c`](../../runtime/runtime-simd.c), which picks its path on its first call with `cpuid`, and the Nish walker stays the Node reading and the wasm path.

## Approach

- **Four seams.** Each is one private function in `aes.ts`, called from one place: the key schedule, the single-block encrypt (behind `aesHeaderMask`, `aesEncryptBlock`, H and the tag mask), GCTR over `length` bytes, and GHASH over `length` bytes. The walker bodies are today's bitsliced code.
- **A run-time branch, not a C fallback.** `indexOfAny`'s walker is emitted as an `internal` function nothing calls, because the C kernel has a scalar path of its own. Here the portable path is the bitsliced Nish code. The C kernel has none, by design: a table-free C AES would duplicate the Nish code, which is the code under review. So each seam's call is lowered to:

  ```llvm
  %hw = call i1 @nish_aes_hw()
  br i1 %hw, label %kernel, label %walker   ; walker: the original call, unchanged
  ```

  The walker stays emitted and called. `nish_aes_hw` resolves once, lazily, and its answer is fixed for the life of the process. That matters because the round-key layout depends on it (below). Stage 4 records this difference from S1 in `src/kernels.ts`'s header.
- **One `roundKeys` array, two layouts.** `AesKey.roundKeys` keeps its length, `8 * (rounds + 1)` words (88 or 120), so `aesKeyUsable`, `aesKeyInto`'s callers in [`std/net/tls/record.ts`](../../std/net/tls/record.ts) and [`std/net/quic-packet.ts`](../../std/net/quic-packet.ts), and #430's wiping of them are untouched. On the fallback it holds the bitsliced schedule, as today. On the kernel it holds the standard schedule in its first `2 * (rounds + 1)` words, and may hold precomputed powers of H after them. Both layouts fit, and every seam takes the array whole. A key is only ever made and used under one answer of `nish_aes_hw`, because that answer is fixed per process. Under Node and on wasm the bitsliced layout is the only one.
- **wasm32 never references the kernel.** The lowering is skipped when the target is wasm32, as for anything the wasi profile cannot link. `runtime-aes.c` compiles to nothing off x86-64 and AArch64.

## Kernel contract

These are the prototypes in `runtime/nish.h`, with `nish_array` as nish.h defines it. The Nish caller has already checked every precondition. The kernel does no bounds checks and reads and writes only what is listed.

| symbol | contract |
|---|---|
| `int32_t nish_aes_hw(void)` | 1 when this process runs the kernel, 0 when it runs the walker. Lazy and resolved once. `NISH_AES=soft` pins 0; unset, `hw` or any other value means the best the machine has. Reads the CPU only on the first call (x86-64: `cpuid` leaf 1 ECX bits AES and PCLMULQDQ; AArch64: `getauxval(AT_HWCAP)` `HWCAP_AES` and `HWCAP_PMULL`) |
| `void nish_aes_schedule(const nish_array *key, int32_t rounds, nish_array *rk)` | `key` is 16 or 32 bytes and `rounds` is 10 or 14 to match; `rk` holds `8 * (rounds + 1)` `u64`s. Writes the kernel layout into `rk` |
| `void nish_aes_block(const nish_array *rk, int32_t rounds, const nish_array *src, nish_array *dst)` | `src` and `dst` each hold at least 16 bytes. `dst[0..16) = E(K, src[0..16))` |
| `void nish_aes_ctr(const nish_array *rk, int32_t rounds, const nish_array *j0, const nish_array *src, nish_array *dst, int32_t length)` | `j0` is 16 bytes, and `0 <= length <= min(src.len, dst.len)`. GCTR from inc32(J0), with the counter wrapping mod 2^32. `dst` may alias `src` |
| `void nish_aes_ghash(nish_array *y, uint64_t hHi, uint64_t hLo, const nish_array *rk, const nish_array *data, int32_t length)` | `y` is 2 `u64`s, and `0 <= length <= data.len`. Absorbs `data[0..length)`, zero-padding the last block |

The Nish seam signatures mirror these, so the walker and the kernel are called with the same arguments.

## Stage 1 — measure (`measure`)

**Owns:** `bench/aes-gcm.ts`, `bench/aes-gcm.mjs`, `bench/README.md`, `docs/wp38-simd.md`

- `bench/aes-gcm.ts` times AES-128-GCM seal and open on 16 KiB and 1,200 B buffers, ChaCha20-Poly1305 seal and open on the same sizes, and `aesHeaderMask`. The input changes on every iteration (fold the counter into the IV, the plaintext's first word and the sample), and each output is folded into a checksum that is printed.
- `bench/aes-gcm.mjs` builds it natively, runs at least seven rounds, and prints the minimum and median MB/s and cycles/byte (state how cycles are derived, e.g. `perf stat` cycles, or ns × nominal GHz, and say which). It puts a byte-identical copy of the binary in the rotation to give the noise band, as `bench/simd-s0.mjs --self` does. `--check` runs one short round and checks the checksum line, for CI and for later stages.
- Profile one real exchange: build `tests/link/net_interop_server` as `.github/workflows/interop.yml` does, fetch a 1 MB file with `curl --http2`, and split the server's CPU time by function. Use `perf record` if it is available, and `valgrind --tool=callgrind` if not; say which. Name the suite curl negotiated.
- Write WP38 §7's **S5: AES-GCM as a runtime kernel** row and a subsection with the figures, the machine (CPU model, GHz), the commit they were taken at, and the bar: **AES-128-GCM seal on 16 KiB is at least 5x faster on x86-64 with AES-NI, and the fallback path is not slower than this baseline, outside the noise band.**
- **Stop rule.** If the profile shows AES is not on the real path (for example curl negotiated ChaCha20, or AES is a negligible share), the row says so, the worker comments that on the run's issue, and the PR stays docs-only. The lead then stops the run before `seams` and `runtime` start.

## Stage 2 — seams (`seams`)

**Owns:** `std/crypto/aes.ts`, `tests/cases/ct_asm_aes.*`, `tests/link/crypto_aes*/**`, `tests/self/goldens/**`, `tests/differential/**`, `tests/cases/*.ll`

- Seams named as in the Kernel contract: `aesScheduleInto`, `aesBlockInto`, `aesCtrInto`, `ghashBlocksInto`. Each is private (not exported), carries the `aes`/`ghash` prefix (wp26 §3e), and is called from exactly one place. `aesExpand`'s two callers (`aesKey`, `aesKeyInto`) go through one shared function that calls `aesScheduleInto` once. `aesEncryptOne` is the one caller of `aesBlockInto`. `aesGcmCtr` is the one caller of `aesCtrInto`, and `ghashUpdate` the one caller of `ghashBlocksInto`.
- A seam writes into arrays its caller passes and allocates nothing the caller needs back, so the C kernel never allocates. Scratch the walker needs (`q`, a batch buffer) stays inside the walker.
- Every check the walker relies on for memory safety moves to, or is duplicated in, its one caller, so the kernel's preconditions hold at the call. The walker keeps its own defensive checks.
- The doc header and the bitsliced comments are kept. Add a short note per seam that the compiler may replace its call natively (stage 4 fills in where).
- Output is byte-identical: `tests/link/crypto_aes*` and every Wycheproof case pass unchanged, natively and under Node. `ct_asm_aes`'s verbatim copy only changes if a function it copies changed; it should not.
- Regenerate `tests/self/goldens/checked.txt` and `checked-self.txt` with `node tests/self/goldens.js --update` and read the diff.
- **Speed:** run `bench/aes-gcm.mjs` against `main` and this branch in the same interleaved rounds. No figure may be slower outside the noise band. Put the table in the PR body.

## Stage 3 — runtime (`runtime`)

**Owns:** `runtime/runtime-aes.c`, `runtime/nish.h`, `scripts/build.sh`, `tests/run.js`, `tests/nish/run.ts`, `tests/ct-asm.js`, `tests/ct-asm-*.js`, `tests/simd/**`, `.github/workflows/ci.yml`, `THIRD_PARTY_NOTICES.md`, `docs/security/ct-verification.md`, `docs/security/crypto-aead.md`, `docs/wp7-runtime.md`, `docs/MASTER_PLAN.md`

- **The unit.** Write `runtime/runtime-aes.c` with the header style of `runtime-simd.c`: why it is its own unit and what each path is. Compare its own `.text*` ceiling with folding it into `runtime-simd.c` under the budget rules near `RUNTIME_SIMD_TEXT_BUDGET` in `tests/run.js`, and say which the rules favour and why. A separate unit is the expected answer, since a program that searches text should not carry AES.
  - On x86-64, compile the AES-NI and PCLMULQDQ functions with `__attribute__((target("aes,pclmul,sse4.1")))` (or the minimum set they need), so the binary stays baseline.
  - On AArch64, use `target("+crypto")` / `target("aes")` with `arm_neon.h`'s `vaeseq_u8`, `vaesmcq_u8` and `vmull_p64`.
  - GCTR does four or eight blocks per pass. GHASH is aggregated (e.g. 4 blocks with precomputed H^1..H^4 in `rk`'s tail) with one reduction per group.
  - Off x86-64 and AArch64 (wasm32 included) the file compiles to nothing that is referenced.
- **Dispatch.** Use a resolver and a stored answer, with relaxed atomics, as `nish_any_resolve` has. Use `cpuid.h` and `getauxval`, never `__builtin_cpu_supports` (wp38 §3.1: libgcc's constructor). `NISH_AES=soft` pins the fallback. Nothing runs at program start, and a program that never calls AES links none of the unit (section GC). Check that `hello` stays the size it is.
- **Wiping.** Every stack buffer and every stack copy of a round key, counter block, keystream block or GHASH state the kernel holds is zeroed before return, with a store the optimiser keeps. Read how `nish_wipe` and `nish:secret`'s wipe survive `opt -O2` ("nish:secret: the wipe survives opt -O2") and reuse that mechanism. Add a check that the wipe survives `clang -O2` in the kernel's own object.
- **Build wiring.** Add the unit to `scripts/build.sh`'s `halves` list, to `tests/run.js`'s runtime file lists (near lines 116, 7607, 13650 and 14469 at the base) and to `tests/nish/run.ts`'s link list. Leave `src/run-cache.ts` to stage 4, which owns `src/`. Keep the `--profile wasi` link working, and the kernel unreferenced there.
- **Budget.** Add `RUNTIME_AES_TEXT_BUDGET` at the next 256-byte boundary above the measured `clang -Oz -c` `.text*` sum, with the measured figure in the comment beside it, plus a row in [wp7](../../docs/wp7-runtime.md)'s budget table and MASTER_PLAN §2's table of units.
- **Agreement test.** `tests/simd/aes-gcm.c` includes the unit, as `tests/simd/index-of-any.c` does, and holds a textbook reference: a table AES and a bit-at-a-time GHASH, test-only and not constant time. It checks every path this machine has against the reference on:
  - FIPS 197 and SP 800-38D vectors;
  - RFC 9001 A.5's header-protection sample;
  - a fuzzed corpus of random keys (16 and 32 bytes), J0s (with counters near 2^32 so the wrap is exercised), and lengths 0..4,096, non-multiples of 16 included.

  It prints one line naming the paths that ran, e.g. `aes-gcm: N cases agree across aesni-pclmul;` or `... across armv8-aes-pmull;`. The `simd` section of `tests/run.js` runs it, and requires `aesni-pclmul` where `/proc/cpuinfo` has `aes` and `pclmulqdq`.
- **CI.** In `.github/workflows/ci.yml`'s `simd-arm64` job, run the agreement test and `grep -E` its line for `armv8-aes-pmull`, as the job requires the NEON line. In the x86-64 job that greps `index-of-any`, add the same requirement for `aesni-pclmul`.
- **Constant time.** `tests/ct-asm.js` reads only the Nish fixtures it names, so extend it or add `tests/ct-asm-runtime.js`. It compiles `runtime/runtime-aes.c` with `clang -O2 -S` for `x86_64-linux-gnu` and `aarch64-linux-gnu`, and refuses, in every kernel function except the resolver:
  - any conditional branch whose condition is not a loop bound on `length` or `rounds`;
  - any load or store whose address depends on key, data or H.

  `length` and `rounds` are public by the module's own discipline. Reuse ct-asm.js's taint model if it fits, and say why if not. Add a negative case under `tests/simd/`: a deliberately leaky variant (a table lookup indexed by a data byte) that the check must refuse.
- **Records.**
  - `docs/security/ct-verification.md`: the one `cpuid`/`getauxval` dispatch, which depends on neither key nor data, the `NISH_AES` pin, and what the checker does not model (microcode, frequency effects of the AES units, the resolver's first call).
  - `docs/security/crypto-aead.md`: a new finding that round keys, H powers, counter blocks and the GHASH state sit in XMM/NEON registers a wipe cannot reach, as ECC-2 and X509-7 record for scalars.

  Each record states the commit its `file:line` anchors are at. Its Tests list names each check by its exact `check(...)` string, templated names as templates. Grep each against `tests/run.js` before pushing.
- **Notices.** Anything adapted (e.g. an AES-NI key-expansion sequence from Intel's white paper, or a PCLMUL reduction from Gueron and Kounavis or a BSD-licensed library) keeps its upstream notice in the file and gets a `THIRD_PARTY_NOTICES.md` entry ([`.claude/licensing.md`](../licensing.md)). BearSSL's GHASH notice in `aes.ts` stays where it is.

## Stage 4 — lower (`lower`)

**Owns:** `src/**`, `std/crypto/aes.ts`, `std/README.md`, `tests/run.js`, `tests/link/**`, `tests/cases/**`, `tests/self/goldens/**`, `tests/differential/**`, `.github/workflows/interop.yml`, `docs/wp38-simd.md`, `docs/wp34-hosting-cs.md`, `docs/security/**`, `bench/aes-gcm.*`

- `src/kernels.ts`: `isAesSeam(program, sig)` returns which of the four seams a call is (or none), by `sourceName` and `isCryptoAesModule(program.packageName, program.source.path)`. Add that to `src/std-modules.ts`, mirroring `isTextModule`. Extend the header with S5, and with why this lowering keeps the walker called (Approach).
- `src/emit.ts`: where `isIndexOfAnyWalk` is tested, lower an AES seam's call to the `nish_aes_hw` branch: kernel call on one arm, the original call on the other, then a join. Skip the lowering when the target is wasm32 (`src/target.ts`), so wasi never references a kernel symbol. Add a check that `--profile wasi` on an AES program has no `nish_aes_` in its `.ll` or `.wasm` imports.
- `src/runtime.ts`: declare each symbol with `memory(...)` attributes that match its contract: `argmem: read` / `readwrite`, plus `inaccessiblemem: readwrite` for the resolver's store, as `nish_str_index_of_any` does, with a comment like that one's.
- `src/secret.ts`: the kernels are deterministic, have no effect but their argument writes, and are constant time by `ct-asm`'s reading. List them in `isPureRuntime` only if `expose` must reach them, with that reason written beside them. Otherwise leave them off and say why in the PR.
- `src/run-cache.ts`: add `runtime-aes.c` beside `runtime-simd.c`.
- **End-to-end agreement.** A `tests/link` program (or the existing `crypto_aes` ones) runs NIST SP 800-38D vectors, every Wycheproof `aes_gcm` case the module already runs, RFC 9001 A.5's sample, and a seeded fuzzed corpus (random keys of 16 and 32 bytes, IVs of 12 and other lengths, AADs, lengths 0..4,096 including non-multiples of 16). It prints a checksum. `tests/run.js` runs the native binary twice, with `NISH_AES` unset and with `NISH_AES=soft`, and requires byte-identical stdout, plus the Node run where the program is class A. On a host with AES-NI it also requires that the unset run took the kernel (e.g. the program prints `nish_aes_hw`'s answer through a test hook, or the check reads `/proc/cpuinfo`).
- **Goldens.**
  - Regenerate the `.ll` of programs that call AES with `UPDATE_GOLDENS=1`.
  - Show every other `.ll` golden byte-identical (`git diff --stat tests/cases` lists only AES programs).
  - Regenerate `tests/self/goldens` with `node tests/self/goldens.js --update`, and read the diff.
  - Register any new positive `tests/cases/*` with `node tests/differential/goldens.js --update` in the same commit.
  - Run `node bench/run.mjs --instructions --check` with `bench/instructions.json` unchanged.
- **Interop.** Add `src/kernels.ts`, `runtime/runtime-aes.c` and `src/emit.ts` to `.github/workflows/interop.yml`'s `pull_request.paths`, so its lanes (quic-interop-runner with quic-go and ngtcp2, h2spec, curl, Chromium's WebTransport) run on this PR and on any later change to the kernel. All lanes must be green on the final head.
- **Measure and record.** Re-run `bench/aes-gcm.mjs` hardware and `NISH_AES=soft` against S5's baseline in the same interleaved rounds, and write the result into WP38's S5 row: met or missed, with the figures. Missing the bar is recorded honestly, and the lead escalates rather than merges.
- **Docs.**
  - `std/README.md`'s aes.ts row.
  - WP34 K3's "Left" cell: AES-NI/PCLMUL done as a runtime kernel; what is left.
  - `aes.ts`'s header: the seams and where they are lowered.
  - LANGUAGE.md only if a rule a program can see changed. It should not.
- **Commit.** The squash subject is the stage title. The body is the release-note entry, with `Measured:` (MB/s before and after on 16 KiB and 1,200 B, the noise band, the machine), `Refs:` (docs/wp38-simd.md S5, docs/security/crypto-aead.md) and `Tests:` trailers. Copy the figures from WP38's row on the head being merged.

## Out of scope

Each of these is a follow-up, listed in the PR bodies:

- a `--cpu` flag (WP38 S2) and any `nish:simd` surface;
- a faster P-256 (64-bit limbs or a fixed-base table, K5's "Left" cell);
- TLS session tickets;
- AES-192;
- #430's move of TLS/QUIC key-holding structs onto `nish:secret`, beyond what the seams need.

## Tests

- Stage 2:
  - `tests/link/crypto_aes*` unchanged and green, natively and under Node;
  - `ct_asm_aes` green;
  - the bench's no-slower table.
- Stage 3:
  - `tests/simd/aes-gcm.c`'s agreement on every local path;
  - the `.text*` ceiling;
  - `hello`'s size unchanged;
  - the wipe surviving `-O2`;
  - the ct check on x86-64 and aarch64 with its negative case;
  - CI's `simd-arm64` line naming `armv8-aes-pmull`.
- Stage 4:
  - the kernel-against-walker byte equality on NIST, Wycheproof, RFC 9001 A.5 and the fuzzed corpus, run hardware and with `NISH_AES=soft`;
  - wasi's lack of a kernel reference;
  - non-AES `.ll` goldens and `bench/instructions.json` unchanged;
  - the interop lanes.

## Verification

Every `src/` stage first runs `bash scripts/fetch-seed.sh --force`. Then each stage runs `npm run check`, a bare `npm test` with its exit status and skip count read (never a piped tail), and `npm run lint`. Stages 2 and 4 also run `node tests/self/goldens.js`. Stage 4 also runs `WASI_SYSROOT=/usr node tests/run.js wasi`, reading its skip line, `node tests/run.js performance` with no new NL9007 in `src/`, and `node bench/run.mjs --instructions --check`.
