---
name: bcrypt lanes by measurement
overview: A single bcrypt hash is one serial dependency chain (each half-round's S-box indices come from the previous half-round), so its floor is latency, about 11 cycles per half-round, 176 per Blowfish block, ~188 M cycles per cost-10 hash — not the 35-45 cycles per block of a throughput figure. On this repo's Xeon the single path is already level with crypt_r after PR #1083 (67.8 vs 68.8 ms) and the four-lane batch is 2.8x crypt_r per hash. The run documents that with measured cycles per block, then adds what is missing — interleaved widths 1 to 6 behind bcryptHashN / bcryptVerifyN and a bcryptCalibrate that times them — in portable Nish, since Nish's four-lane path already equals clang's four-lane C. bcryptHash, bcryptVerify, bcryptHash4, bcryptVerify4 and the single path's rounds (PR #1083's) are untouched.
stages:
  - id: width-n
    title: "perf(crypto): bcrypt at any width from one to six lanes, and a calibrate that picks it"
    goal: the security record states where a cost-10 hash's cycles go (cycles per Blowfish block, the latency floor, each suspect checked), bcryptHashN / bcryptVerifyN hash and verify one to six passwords interleaved with every lane equal to bcryptHash byte for byte, bcryptCalibrate returns the fastest per-hash width measured at a low cost, and the bench reports single, widths 1 to 6 and crypt_r on one machine
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js bcrypt && node tests/run.js crypto && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js --update && git diff --exit-code tests/self/goldens/checked && node scripts/security-scope.mjs && node docs/check-links.mjs && node bench/crypto/bcrypt/run.mjs --rounds 9
    status: pending
    todos:
      - id: wait-1083
        content: PR amritk/nish#1083 (another session's run, issue #1082) rewrites bcryptBody, bcryptEncrypt, tests/run.js's bcrypt section and the record's Speed section. Do not touch bcryptBody or bcryptEncrypt at all. Build on main now; when #1083 merges, merge main, regenerate goldens and re-measure. Do not open this PR for merge before #1083 has merged or closed
        status: pending
      - id: findings
        content: Measure before changing anything. Read the opt -O3 IR and the disassembly (perf annotate where perf works; objdump otherwise) of nish.bcryptBody and nish.bcryptBody4 and check each suspect from the requirements — bounds checks on S-box loads, overflow checks on u32 adds, state reloaded per round, Secret/exposeWith or wipe work inside the loop, rounds not unrolled or halves spilled, the four-lane states' cache-set placement and whether lanes really interleave per round. Give cycles per Blowfish block for the single path (measured clock x time / 1,067,721 blocks, the clock measured as the record's existing recipe does) and for the batch per lane, and state the latency floor and the load-port bound that limits width. Write it into docs/security/crypto-bcrypt.md (Speed)
        status: pending
      - id: decide-kernel
        content: Record in the same section why the kernel is portable Nish and not a runtime C unit, with the numbers (the bench's tigokraft four-lane C rows against bcryptHash4). If a measured C prototype at some width beats the Nish one outside both spreads, stop and say so in the PR body as a draft rather than adding runtime C in this stage
        status: pending
      - id: width-n
        content: In std/crypto/bcrypt.ts add exported bcryptHashN and bcryptVerifyN taking one to six passwords (shape following bcryptHash4 / bcryptVerify4 and what the checker allows for Secret; a width argument or the passwords' count picks the lane count), each lane's state one flat P[18]+S[4][256] block, the half-rounds of all lanes interleaved round by round, the zero-salt ExpandKey specialised as today. Errors as bcryptHash4's, a malformed hash in any lane an Err naming the lane before anything is hashed, the final compare timingSafeEqual, every buffer written wiped inside expose as today. bcryptHash4 and bcryptVerify4 keep their signatures, errors and outputs
        status: pending
      - id: calibrate
        content: Add exported bcryptCalibrate that times widths 1 to 6 at cost 4 (a few ms in all) on throwaway keys and salts and returns the width with the least time per hash; it keeps nothing between calls. Document that it measures and does not guess
        status: pending
      - id: tests
        content: Tests in the suite's existing style (tests/link/*, tests/run.js, reject cases) — every lane of every width 2 to 6 equals bcryptHash for random passwords and salts at costs 4 to 8 and a few at 10; the crypt_r differential extended to the width-N path (and confirmed not skipped); a malformed hash in each lane position is an Err naming it; the opt -O2 wipe counts in tests/wipes/crypto.js extended to the new roots so removing any state, key or expanded-key wipe fails a test; bcryptCalibrate returns 1 to 6; the WASI run builds and runs the new path. Every existing vector (OpenBSD, Openwall, $2a$/$2b$/$2y$, 72-byte truncation, empty password, 0x80+ bytes, the interoperability table) still passes unchanged
        status: pending
      - id: bench
        content: In bench/crypto/bcrypt/run.mjs report, at cost 10 on one machine in one session, ms per hash for bcryptHash, each width 1 to 6, bcryptHash4 and crypt_r ($2b$), and cycles per Blowfish block for the single path. Record the table in the record and the targets (single within 1.2x of crypt_r; best width at least 1.5x faster per hash than crypt_r) as met or not with the numbers. Say which machines were not measured (AMD, AArch64) rather than estimating them
        status: pending
      - id: docs
        content: Update docs/guide/using-nish/password-hashing.md for bcryptHashN, bcryptVerifyN and bcryptCalibrate (when to call calibrate, at startup, once), and the record's API and security rows for the new entries (BCRYPT-8 / BCRYPT-9 style rows for the wider batch). Update bench/README.md's bcrypt section if what it says stops being true
        status: pending
      - id: goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff; register any new positive tests/cases with node tests/differential/goldens.js --update
        status: pending
---

# bcrypt lanes by measurement

## What exists

- `std/crypto/bcrypt.ts`: the single path (`bcryptBody`, `bcryptEncrypt`) and
  the four-lane batch (`bcryptBody4`, `bcryptEncrypt4`, `bcryptEks4`,
  `bcryptHash4`, `bcryptVerify4`).
- `docs/security/crypto-bcrypt.md` → Speed: no bounds check is left in the
  round, the 16 half-rounds are unrolled, base and length stay in registers;
  the single path's only gap to gcc was P on the critical path in 15 of 16
  half-rounds, which PR amritk/nish#1083 (another session, open) closes.
- `bench/crypto/bcrypt/run.mjs`: Nish against `crypt_r`, OpenBSD's C (gcc and
  clang) and tigokraft's one- and four-lane C.

## What the requirements' reference points get wrong

A cost-10 hash is 17,083,536 half-rounds in one dependency chain. Each costs
about 11 cycles of latency (index, S-box load, add, xor, load, add, xor), so
the single hash floor is ~188 M cycles: 33 ms at 5.7 GHz, which is the Ryzen's
35.2 ms. 35-45 cycles per block is reachable only per lane with several
independent chains in flight, which is what lanes are. On this repo's Xeon
(#1083's figures) the single path is 67.8 ms against `crypt_r`'s 68.8 ms, and
`bcryptHash4` 24.4 ms per hash, 2.8x `crypt_r`. Both stated targets are
already met there; what is missing is the width choice.

## What changes

Widths 1 to 6 behind `bcryptHashN` / `bcryptVerifyN`, and `bcryptCalibrate`
to pick one per CPU by timing. Portable Nish only: Nish's four lanes already
match clang's four-lane C, so a runtime C kernel and a `NISH_BCRYPT=soft`
override add an attack surface and a security record for no measured gain.

## Stage width-n

**Owns:** `std/crypto/bcrypt.ts`, `tests/link/crypto_bcrypt*/**`,
`tests/link/thread_bcrypt*/**`, `tests/cases/*bcrypt*`, `tests/run.js`,
`tests/wipes/**`, `tests/self/goldens/checked/**`,
`tests/differential/goldens*`, `tests/differential/bcrypt.js`,
`tests/differential/emit-ts-known.txt`, `docs/security/crypto-bcrypt.md`,
`docs/security/README.md`, `bench/README.md`, `bench/crypto/bcrypt/**`,
`docs/guide/using-nish/password-hashing.md`

Depends on: amritk/nish#1083 merging (merge order, not start).
