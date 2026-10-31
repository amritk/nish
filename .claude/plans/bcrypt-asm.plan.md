---
name: bcrypt's cost loop on a hand-scheduled x86-64 kernel
overview: The multicore server challenge's PR #152 (rust-epoll-WorriedArrow, MIT, a port of nick-potts's asm_gen.zig from #117) runs bcrypt's expand0 cost loop in generated x86-64 assembly — every lane's state reached from one base register with constant displacements, five lanes' halves held in registers, the S-box indices taken with BMI1/BMI2 (`rorx` + `movzx ah`, or `bextr`) — at 11 instructions per lane half-round. Our `bcryptBodyN` (std/crypto/bcrypt.ts) is LLVM's schedule of the same interleave at 15.5 instructions, and docs/security/crypto-bcrypt.md ("The bounds") shows it sitting on the 4-wide issue bound from four lanes up, so instruction count is the lever. Rebuilding today's kernel with `--cpu x86-64-v3` gains nothing (measured in this session: 4-lane 0.69–0.76 s baseline vs 0.76–0.79 s v3 for the same 32 hashes), so the code generator will not find this schedule by itself. This puts the cost loop on a runtime kernel behind the WP38 seam mechanism (src/kernels.ts), as AES, SHA-256 and CRC32 are, with the Nish kernel kept on the other arm.
stages:
  - id: bcrypt-asm-kernel
    title: "perf(runtime): bcrypt's cost loop on a hand-scheduled x86-64 kernel"
    goal: On x86-64 with BMI1 and BMI2, bcryptHashN's cost loop (and bcryptHash's, if the one-lane kernel measures faster) runs a generated assembly kernel in runtime/runtime-bcrypt.c, chosen once per process behind nish_bcrypt_hw with NISH_BCRYPT=soft pinning the Nish kernel; every hash byte for byte unchanged; the best width at least 20% less time per hash than main's best width outside both noise bands; the security record, licence notice, user docs and Speed section updated in the same PR
    verification: npm run check; npm run lint; node tests/run.js bcrypt; node tests/run.js simd; node tests/run.js third-party-licence; node tests/run.js wasi (WASI_SYSROOT=/usr); node tests/run.js performance; node scripts/security-scope.mjs; node tests/self/goldens.js --check (or --update with a read diff); an interleaved A/B of node bench/crypto/bcrypt/run.mjs --rounds 9 against main recorded in the PR body; CI's four test shards green
    status: pending
    todos:
      - id: measure-first
        content: Before any plumbing, prototype the generated kernel for widths 1 to 6 as a standalone C file linked against the bench's state layout, and time it against main's bcryptHashN at each width (interleaved, --rounds 9). Stop rule — if no width beats main's best width outside both noise bands, push the prototype and the table, open a draft PR stating the stop, and stop — see Measure first
        status: pending
      - id: generator
        content: A node generator (runtime/gen-bcrypt-x86_64.mjs) writes the kernel into runtime/runtime-bcrypt.c as file-scope assembly for ELF and Mach-O, with a --check mode a tests/run.js section runs so a hand edit is caught; both index styles generated, one chosen per process by measurement — see The kernel
        status: pending
      - id: dispatch
        content: nish_bcrypt_hw answers once per process from cpuid (BMI1 and BMI2) and NISH_BCRYPT=soft; nish.h states the kernel's contract (state pointer, width 1 to 6, the 1042-word stride); the kernel zeroes every stack slot that held a lane's half before it returns — see Dispatch and wiping
        status: pending
      - id: seam
        content: An isBcryptSeam in src/kernels.ts, lowered in src/emit.ts S5's way (branch on nish_bcrypt_hw, the kernel on one arm, the original Nish call unchanged on the other), wasm32 and non-x86-64 targets emitting the call as written; a golden .ll for the branch — see The seam
        status: pending
      - id: tests
        content: tests/simd/bcrypt.c — the kernel at every width and both styles against a plain C Blowfish expand0 on random states, and the stack-slot wipe; every existing tests/link/crypto_bcrypt* and thread_bcrypt* program run with the kernel and under NISH_BCRYPT=soft, printing the same hashes; the ct check's treatment of the unit (S-box loads are secret-indexed by bcrypt's design, as on the Nish path) recorded, not silenced — see Tests
        status: pending
      - id: record
        content: docs/security record for runtime/runtime-bcrypt.c (a new crypto-bcrypt-hw.md or a section of crypto-bcrypt.md, with its README index row) — scope, threat model, what the wipe reaches and what it cannot (caller-saved registers), findings fixed with a before/after test or recorded open; node scripts/security-scope.mjs passes — see The record
        status: pending
      - id: licence
        content: The generator follows PR #152's build.rs (itself a port of asm_gen.zig), so it is a copy under .claude/licensing.md — upstream notice in the generator and the generated file, the challenge's MIT licence text verbatim in runtime/, a THIRD_PARTY_NOTICES.md row, the release.yml presence gate, and the origin with a function-by-function comparison in the PR body
        status: pending
      - id: docs-bench
        content: bench/crypto/bcrypt/run.mjs gains kernel and NISH_BCRYPT=soft rows per width; docs/security/crypto-bcrypt.md "Speed" re-measured (table, cycles per block, the new bounds, why the kernel is now not Nish); NISH_BCRYPT in docs/LANGUAGE.md beside NISH_SHA256, docs/guide/using-nish/password-hashing.md and standard-library.md; std/crypto/bcrypt.ts header; tests/self/goldens regenerated — see Docs and bench
        status: pending
---

# bcrypt's cost loop on a hand-scheduled x86-64 kernel

One stage, one PR. The kernel, its dispatch, its seam and its record are one
change: a kernel with no seam cannot be measured through `bcryptHashN`, the
seam cannot be written before the kernel's contract exists, and a
`runtime/*.c` file must land with its security record.

## bcrypt-asm-kernel

**Owns:** `runtime/runtime-bcrypt.c`, `runtime/gen-bcrypt-x86_64.mjs`,
`runtime/LICENSE-multicore-server-challenge`, `runtime/nish.h`,
`src/kernels.ts`, `src/emit.ts` (the seam's branch only), `src/std-modules.ts`
(only if a module predicate is missing), `std/crypto/bcrypt.ts` (header comment
and calibration only — the Nish kernels stay byte-identical), `tests/simd/bcrypt.c`,
`tests/run.js`, `tests/link/crypto_bcrypt*/**`, `tests/link/thread_bcrypt*/**`,
`tests/cases/*bcrypt*` (new golden only), `tests/runtime-budgets.js` (recorded
size only), `scripts/build.sh` (only the runtime unit inclusion rule),
`.github/workflows/release.yml` (licence presence gate only),
`THIRD_PARTY_NOTICES.md`, `bench/crypto/bcrypt/**`,
`docs/security/crypto-bcrypt.md`, `docs/security/crypto-bcrypt-hw.md`,
`docs/security/README.md`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`,
`docs/guide/using-nish/password-hashing.md`,
`docs/guide/using-nish/standard-library.md`, `tests/self/goldens/checked/**`
and `tests/differential/**` (regenerated only),
`.claude/plans/bcrypt-asm.plan.md`.

### Measure first

The case for the kernel is an instruction count, not a measurement: 11
instructions per lane half-round against 15.5, on a loop
`docs/security/crypto-bcrypt.md` shows to be issue-bound at 4 and 5 lanes. That
predicts about 30% less time per hash at the best width. Prove it before any
compiler work. Write the generated kernel and a C driver that fills a width-w
state as `bcryptBodyN` sees it (w × 1042 words, the key already XORed into P),
run 2^(cost+1) expansions, and time it against main's `nishn<w>` programs from
`bench/crypto/bcrypt/run.mjs` (interleaved rounds, `--rounds 9`). Check the
digest against main's at every width.

- **Go:** some width beats main's best width outside both spreads. Record the
  table and carry on.
- **Stop:** no width does. Push the prototype and the table to the branch, and
  open a **draft** PR. Its body is the table and the reason (for example,
  register pressure at five lanes or the `bextr` uop count). Then stop. The
  lead escalates it unmerged; a negative result is a finding, not a failure.

The PR's own page quotes no bcrypt figures, and running its Rust build was not
done in planning, so this table is the first number anyone has.

### The kernel

`runtime/gen-bcrypt-x86_64.mjs` writes it. Its shape follows PR #152's
`build.rs`:

- `rdi` is the base for every lane. Lane u's P word r is at
  `[rdi + u*4168 + 4r]` and its S-box b is at `[rdi + u*4168 + 72 + 1024b + 4i]`.
- Five lanes keep their halves in `ebx/ebp`, `r8d`–`r15d`; lanes six and up
  keep them on the stack.
- Each half-round is `y ^= P[r]`, four S-box loads folded into
  `mov/add/xor/add`, then `y ^= edx`. The 16 rounds are fully unrolled, round
  by round across the lanes.
- The output block `(R ^ P[17], L)` is stored over words 2j and 2j+1, and the
  halves are swapped.

There are two index styles, as in the PR:

- **`ah`:** `rorx` + `movzx` from `ah`/`al`, plus one `bextr`.
- **`bextr`:** a shift for byte 3, `bextr` for bytes 2 and 1, and `movzx` for
  byte 0.

`bextr` with a register control is two uops on Intel from Haswell to Skylake
and one on AMD Zen. So the style is chosen once per process by timing both at
a low cost the first time `nish_bcrypt_hw` is asked. Alternatively, choose by a
rule the measure-first table justifies; write down which and why.

The generated text goes into `runtime/runtime-bcrypt.c` as file-scope `__asm__`.
Spell symbols for ELF (`.type`, `.size`, `.note.GNU-stack` non-executable) and
Mach-O (leading underscore, no `.type`). Guard it by `__x86_64__`; other
targets compile a unit with only `nish_bcrypt_hw` answering 0. `--check`
regenerates the file and fails on a difference.

Width 1 also goes through the kernel only if the measure-first table shows the
one-lane kernel faster than `bcryptBody` outside the band. The single path is
latency-bound (`docs/security/crypto-bcrypt.md`, "Cycles"), so it may not be.
If it is not, `bcryptHash` stays on the Nish kernel and the record says so.

### Dispatch and wiping

`nish_bcrypt_hw` reads cpuid leaf 7 for BMI1 and BMI2 through `cpuid.h`, not
`__builtin_cpu_supports`; `runtime-aes.c` says why. It reads `NISH_BCRYPT`
once (`soft` pins the Nish path), and from then on its answer never changes.
The kernel `nish_bcrypt_expand0(uint32_t *state, int32_t width)` checks its
width (1 to 6, or 2 to 6) and answers whether it ran. On 0 the branch falls to
the Nish call, as SHA-256's seam does. Its contract goes in `runtime/nish.h`.

Before it returns, the kernel zeroes:

- every stack slot that held a lane's half,
- the counter slot,
- `eax`, `ecx`, `edx` and `esi`.

It restores the callee-saved registers it pushed, which held the caller's
values, not secrets. The state itself is the caller's `Secret<u32[]>`, wiped by
the Nish code as today.

### The seam

`isBcryptSeam` recognises `bcryptBodyN` (and `bcryptBody` if width 1 is in)
by module and name in `std/crypto/bcrypt.ts`, as `isSha256Seam` does. The
emitter lowers it with `emitKernelArm` in the same way:

- the branch on `nish_bcrypt_hw`,
- the kernel call with the state's data pointer and the width,
- the original call unchanged on the other arm.

A wasm32 build, or any target that is not x86-64, emits the call as written
and references no `nish_bcrypt_` symbol. The whole-program facts stay the
walker's. The kernel reads and writes the state array, nothing else.

Read `CLAUDE.md`'s emit-ts rule if `src/emit-ts-*.ts` is touched (it should
not be).

### Tests

- **`tests/simd/bcrypt.c`**, with its `tests/run.js` section:
  - every width, both styles, against a plain C expand0 on random states;
  - a width outside the contract, refused;
  - the stack frame after the call, scanned for nonzero bytes in the lane
    slots (the before/after pin for the wipe).
- **Every bcrypt link program** prints the same hashes run normally and under
  `NISH_BCRYPT=soft`. Add the soft run to their section the way `NISH_SHA256`'s
  is added.
- **A golden `.ll`** for the seam's branch, with an `llvm-as` pass.
- **The constant-time check** (`ct_asm`, `docs/security/ct-verification.md`)
  must say what it does with this unit. Blowfish's S-box loads are
  secret-indexed by design, on the Nish path too. Record that as the unit's
  stated property, in the way the record already treats the Nish kernel. Do
  not exempt the unit silently.

### The record

The scope names `runtime/runtime-bcrypt.c` and the generator. It covers:

- the threat model (the same as the Nish kernel's, plus the native-code
  surface: the width check, the state length the seam guarantees, the stack
  frame);
- what the wipe reaches and what it cannot (caller-saved vector registers are
  untouched; the general-purpose scratch registers are zeroed);
- each finding with a before/after test, or recorded open.

It gets an index row in `docs/security/README.md`. `node
scripts/security-scope.mjs` must pass, and its "Not yet audited" list must not
grow.

### Docs and bench

- **`bench/crypto/bcrypt/run.mjs`** prints each width under the kernel and
  under `NISH_BCRYPT=soft`, so one run is the A/B.
- **`docs/security/crypto-bcrypt.md` "Speed"** is re-measured on the
  session's machine, with the clock stated and the old table kept as the
  previous machine's. Update "Why the kernel is Nish and not C": the
  condition it set — a C kernel that beats the Nish — is now met. Give the
  new per-lane bounds.
- **User-visible changes:** `NISH_BCRYPT` gets a rule in `docs/LANGUAGE.md`
  beside `NISH_SHA256`/`NISH_AES`, a line in
  `docs/guide/using-nish/password-hashing.md` (the kernel, and that
  `bcryptCalibrate` now measures it), and the environment-variable list in
  `standard-library.md`.
- **`std/crypto/bcrypt.ts`'s header** says which path runs where.
- **Goldens:** regenerate `tests/self/goldens/checked/` with `node
  tests/self/goldens.js --update` and read the diff.
- **Commit message:** follow `CLAUDE.md`, with a `Measured:` trailer that
  gives the A/B and its bands, `Refs:` the record, and `Tests:` the new
  sections.
