---
name: bcrypt single path at gcc speed
overview: The single-hash path of nish/crypto/bcrypt trails gcc's builds of the reference C by about 8% because LLVM reassociates each half-round's x ^ P[n] ^ F(y) so that P[n] sits on the critical path in 15 of 16 half-rounds. Hiding x ^ P[n] behind the existing constant-time value barrier (ctSelect with an all-ones mask, an empty asm that costs no instruction on the path) keeps it off the path. A prototype measured 60.3 ms against 66.0 ms on main, level with OpenBSD's gcc build (59.3 ms), with every hash unchanged. Nothing about the algorithm, its cost, its answers or its wipes changes; the four-lane batch is left as it is because the same barrier measured as a loss there.
stages:
  - id: single-path-barrier
    title: "perf(crypto): keep P off bcrypt's critical path in the single-hash rounds"
    goal: bcryptBody and bcryptEncrypt compute each half-round as (x ^ P[n]) behind the value barrier, then ^ F(y); the cost-10 bench puts bcryptHash level with OpenBSD's gcc build and outside the noise of main's figure, every hash and verify answer is byte-for-byte unchanged, the wipe counts are unchanged, a test fails if the barrier is removed, and the security record's Speed section is rewritten with the new figures
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js bcrypt && node tests/run.js crypto && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/self/goldens.js --update && git diff --exit-code tests/self/goldens/checked && node scripts/security-scope.mjs && node docs/check-links.mjs && node bench/crypto/bcrypt/run.mjs --rounds 9
    status: pending
    todos:
      - id: barrier
        content: In std/crypto/bcrypt.ts, write each half-round of bcryptBody and bcryptEncrypt as `r = ctSelect(0xffffffff, r ^ st[n], 0) ^ F(l)` (and the l half the same), with a comment saying why — LLVM's Reassociate and InstCombine otherwise put P[n] on the path; the barrier is the WP34 N6 empty asm and costs one off-path AND. Leave bcryptBody4 and bcryptEncrypt4 unchanged
        status: pending
      - id: shape-test
        content: Add a test in the suite's existing style that fails if the barrier goes — e.g. beside tests/wipes/crypto.js, count the `asm ""` barriers left in nish.bcryptBody after opt -O2 (expect 32, or whatever the measured figure is, stated), and show it dropping when the ctSelect is reverted to a plain XOR
        status: pending
      - id: answers
        content: Run node tests/run.js bcrypt (crypto_bcrypt, crypto_bcrypt_f64, crypto_bcrypt_batch, thread_bcrypt_task, thread_bcrypt_batch, the reject_bcrypt_* cases and the crypt_r differential) and node tests/run.js crypto (the opt -O2 wipe counts); none may change. Confirm the differential did not skip
        status: pending
      - id: measure
        content: Run node bench/crypto/bcrypt/run.mjs --rounds 9 on main and on the branch in the same session, interleaved, and record both; run the record's onpath/perhr recipe on nish.bcryptBody and record the new P-on-path count (expected 0 of 16) and the listing's sha256
        status: pending
      - id: record
        content: Rewrite docs/security/crypto-bcrypt.md "Speed" and "Why the single path trails gcc" — the new table, the half-round shape, the barrier and why it is safe (an identity on the value; no secret-dependent branch or load is added; BCRYPT-6 and BCRYPT-7 unchanged), and that the batch keeps the plain form because the barrier measured as a loss there. Keep the reproduction recipe working. Update bench/README.md's bcrypt section only if what it says stops being true
        status: pending
      - id: guide
        content: If docs/guide/using-nish/password-hashing.md's "about 50 ms" figures are no longer right, correct them; otherwise leave the guide alone (the API is unchanged)
        status: pending
      - id: goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff; commit the regenerated files with the change
        status: pending
    Owns: std/crypto/bcrypt.ts, tests/wipes/crypto.js, tests/wipes/**, tests/run.js, tests/self/goldens/checked/**, docs/security/crypto-bcrypt.md, docs/security/README.md, bench/README.md, bench/crypto/bcrypt/run.mjs, docs/guide/using-nish/password-hashing.md
---

# bcrypt single path at gcc speed

## What exists

- `std/crypto/bcrypt.ts`: the single path (`bcryptBody`, `bcryptEncrypt`,
  inlined into `bcryptExposed`) and the four-lane batch (`bcryptBody4`,
  `bcryptEncrypt4`).
- `docs/security/crypto-bcrypt.md` → "Speed" and "Why the single path trails
  gcc": the single path is 8% behind gcc's builds of the reference C, and the
  cause is pinned — LLVM 18's Reassociate and the InstCombine after it rewrite
  `x ^ (P[n] ^ F(y))` to `(P[n] ^ F(y)) ^ x` in 15 of 16 half-rounds, two
  dependent XORs after the last S-box add instead of one. The record tried
  three source forms; LLVM canonicalised all of them.
- The WP34 N6 value barrier (`src/emit-builtins.ts`, `emitValueBarrier`): an
  empty `asm "", "=r,0"`, `readnone nounwind`, reached from `std/` through
  `ctSelect` / `ctEq`, already used by `std/crypto/p256.ts`, `p384.ts` and
  `chacha20poly1305.ts`.

## What changes

Put `x ^ P[n]` behind the barrier: `ctSelect(0xffffffff, x ^ P[n], 0)` is
`(x ^ P[n]) & h` with `h` an all-ones value LLVM cannot see. That `and` is not
an `xor`, so Reassociate cannot fold `x ^ P[n]` into the chain with `F(y)`;
the half-round ends in one XOR after the last S-box add, as gcc's does. The
barrier's asm is loop-invariant and hoisted, so the round gains one `and`, off
the critical path.

Measured in the planning session (4-core Xeon @ 2.1 GHz, cost 10, user CPU,
median and spread): main 66.0 (62.1–69.4) ms; with the barrier 60.3
(59.5–66.6) ms; OpenBSD `gcc -O2` 59.3 (56.9–61.9); OpenBSD `clang -O2` 64.9
(63.3–65.5). Every program printed the same hash. The same change to
`bcryptBody4` measured 22.1 (19.2–24.4) ms against 19.8 (18.9–21.1): the
batch is throughput-bound, where an extra `and` costs and a shorter chain does
not help, so it is left as it is.

Not changed: the algorithm, the cost and the work it buys, the key schedule,
the `$2a$` countermeasure, the `Secret` boundary, any wipe, the
constant-time compare, the public API.

No `src/` change, so no rolling-freeze concern: `std/` uses a builtin the
seed already ships.

## Acceptance criteria

1. On `node bench/crypto/bcrypt/run.mjs` in one session, `bcryptHash` at cost
   10 is faster than `main`'s by a margin outside both spreads, and level with
   or ahead of OpenBSD's `gcc -O2` build.
2. Every hash and verify answer is unchanged: the KATs, the Go and OpenBSD
   vectors, the `crypt_r` differential (run, not skipped), the batch, the
   thread tests and the `f64` build all pass, and the bench prints the same
   hash from every program.
3. The disassembled `nish.bcryptBody` has P on the critical path in 0 of 16
   half-rounds by the record's `onpath` recipe.
4. The `opt -O2` wipe counts in `tests/wipes/crypto.js` are unchanged, and
   nothing reduces the work factor (the Blowfish block count per hash is the
   same).
5. A test fails when the barrier is reverted to a plain XOR.
6. `docs/security/crypto-bcrypt.md` states the new figures, why the barrier
   leaves every security property of the record as it was, and why the batch
   does not use it.
7. `crypto_bcrypt` still builds and runs under WASI.
