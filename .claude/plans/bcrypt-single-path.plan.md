---
name: bcrypt single-hash path — show the IR, name the cause, close or explain the gap
overview: Issue 953 item 2. Compare Nish's bcryptEncrypt against clang and gcc builds of OpenBSD's Blowfish_encipher at the IR and assembly level, decide whether the 7–8% cost-10 gap is the LLVM backend, Nish codegen or the std source shape, fix it in std/ if it can be, and record the evidence in docs/security/crypto-bcrypt.md (Speed).
stages:
  - id: investigate-and-fix
    title: perf(crypto) or docs(crypto) — the bcrypt single-hash gap, with the IR shown
    goal: One PR that names the cause of the single-path gap with IR and assembly evidence and either closes it in std/ or names the exact codegen change.
    verification: npm run check && npm run lint && node tests/run.js bcrypt && node tests/run.js wipes && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js && node bench/crypto/bcrypt/run.mjs
    todos:
      - id: fetch-openbsd
        content: Fetch OpenBSD lib/libc/crypt/bcrypt.c and blowfish.c into the scratchpad and build Blowfish_encipher with clang -O2 and gcc -O2 — see Method
      - id: compare-ir-asm
        content: Dump opt -O2 IR and llc x86-64 asm of bcryptEncrypt and clang/gcc asm of Blowfish_encipher, and count per round loads, stores, bounds checks, spills, state-pointer and P[] reloads, surviving allocas and round counter, critical-path chain — see Method
      - id: verdict
        content: Decide (a) LLVM vs GCC, (b) Nish codegen, or (c) std source shape, from the counts — see Verdict
      - id: std-fix
        content: If (b) or (c) is fixable in std, reshape bcryptEncrypt and the expansion loops in std/crypto/bcrypt.ts keeping the literal guards that leave S-box loads unchecked; if it needs src/, write the codegen change instead — see Fix
      - id: measure
        content: Re-measure with node bench/crypto/bcrypt/run.mjs against a byte-identical copy of the old code for the noise band and write Measured lines — see Measuring
      - id: record
        content: Update docs/security/crypto-bcrypt.md Speed with IR excerpts or a reproducible command plus sha256, the verdict, and the speedup or named codegen change — see Record
      - id: pr
        content: Regenerate goldens, run the definition-of-done checks, open the PR titled perf(crypto) or docs(crypto) with Part of 953 — see PR
---

# bcrypt single-hash path

## investigate-and-fix

**Owns:** `std/crypto/bcrypt.ts`, `docs/security/crypto-bcrypt.md`, `tests/self/goldens/checked/**` (generated), `tests/wipes/crypto.js` (only if a reshaped intermediate needs its wipe pin moved), `bench/crypto/bcrypt/**` (only if the bench needs an old-code variant for the noise band)

Out of scope: `src/`, `std/net`, the 4-way path (`bcryptHash4` and its lanes), issue 953 item 1 (verify's wipes) and item 3 (the bench's precondition message).

### Method

Read first: `CLAUDE.md`, `.claude/orientation.md`, `.claude/testing.md` (the `Measured:` trailer rules), `docs/security/crypto-bcrypt.md` (Speed), `docs/IR_COOKBOOK.md`, `std/crypto/bcrypt.ts` (bcryptEncrypt and the expansion loops), `bench/crypto/bcrypt/run.mjs`.

Fetch OpenBSD's `lib/libc/crypt/bcrypt.c` and `lib/libc/crypt/blowfish.c` into the scratchpad (not the repo; licensing per `.claude/licensing.md` if any is copied in, which it should not be).

Produce, per round of the Feistel loop, for three builds — Nish (`opt -O2` IR and `llc` x86-64 asm of `bcryptEncrypt`), clang -O2 (IR and asm of `Blowfish_encipher`), gcc -O2 (asm of `Blowfish_encipher`):

- loads and stores, split into S-box, P[], and state/pointer traffic
- bounds checks (any branch to a panic) left in the round
- spills and reloads to the stack
- whether the state pointer or P[] words are reloaded where C keeps them in registers
- whether the round counter or any alloca'd local survives mem2reg
- the critical-path dependency chain (instructions from R to the next round's L)

Also check the expansion loops (`expandState` / `expand0State` equivalents), since at cost 10 they call the encipher ~1M times and their per-call overhead counts.

### Verdict

Exactly one of: (a) LLVM versus GCC — the clang build of the C shows the same gap and Nish's round matches clang's; (b) something Nish's codegen adds — extra loads, checks, spills or surviving allocas that clang on equivalent C does not have; (c) the std source shape — the std code asks for work the C does not (loop shape, P[] re-reads, L/R through memory). Say which, with the counts.

### Fix

Only for (b) or (c): fix in `std/` — loop shape, unrolling the 16 rounds, keeping L and R in locals, hoisting P[] loads. Keep the literal guards that keep the S-box loads unchecked. If the fix needs `src/`, do not change `src/`: write the exact codegen change (which emitter, what IR it should produce) in the PR body and the record.

Every hash stays byte-identical.

### Measuring

`node bench/crypto/bcrypt/run.mjs`, against a byte-identical copy of the old code built the same way, to establish the noise band (`.claude/testing.md` → "A `Measured:` trailer"). Report `Measured:` lines with figures and noise band. A delta inside the noise band is reported as no change.

### Record

`docs/security/crypto-bcrypt.md` → Speed: the IR excerpts (or a reproducible command plus the sha256 of its output), the verdict letter with its evidence, and either the speedup or the named codegen change. Replace the unsupported "LLVM's scheduling" claim with what was found.

### PR

`npm run check`, `npm run lint` (bare, read the exit status), `node tests/run.js bcrypt`, `node tests/run.js wipes`, `WASI_SYSROOT=/usr node tests/run.js wasi` (read the skip line), goldens regenerated with `node tests/self/goldens.js --update`. The full suite is CI's four shards, each read for its skip count. Title `perf(crypto): …` if it speeds up, `docs(crypto): …` if it only explains. Body: `Part of #953`, the IR evidence, the verdict, the `Measured:` lines, the exact LLVM IR of any TypeScript the PR adds to tests.

## Acceptance criteria

1. The record's Speed section shows IR or assembly for Nish's round and for clang's and gcc's `Blowfish_encipher` (excerpts, or a reproducible command plus sha256), with per-round counts of loads, stores, bounds checks, spills and the critical path.
2. The record states one verdict, (a), (b) or (c), and the evidence supports it; the "LLVM scheduling" claim no longer stands unsupported.
3. If (b) or (c): either the single-hash path is measurably faster than a byte-identical copy of the old code, outside its noise band, with `Measured:` lines in the commit; or the exact required `src/` codegen change is named in the record and the PR body.
4. Every bcrypt hash is byte-identical: `node tests/run.js bcrypt`, `wipes` and `wasi` green.
5. No change under `src/`, `std/net`, or the 4-way path.
6. CI's four test shards are green on the merged head with no new skips, goldens regenerated, `npm run check` and `npm run lint` clean.
