---
name: P-256 scalar inversion off the handshake's cost
overview: Replace the Fermat k^-1 mod n in ECDSA signing (776,344 Ir, 24% of a signature) with a constant-time Bernstein–Yang safegcd, so the TLS server's handshake stops being dominated by P-256 — closing #628's criteria 2 and 3 — with the baseline, a handshake-time bench and its noise band committed before p256.ts moves.
stages:
  - id: baseline
    title: Record the handshake-time and profile baseline before the inversion changes
    goal: main holds a server-CPU-per-handshake bench with a copy noise band, a fresh callgrind profile of one handshake, and the bar, all before any p256.ts change
    verification: node bench/tls-handshake.mjs --check && npm run lint && npm run check
    todos:
      - id: handshake-bench
        content: Add bench/tls-handshake.mjs timing server CPU per TLS 1.3 handshake against net_interop_server, interleaved rounds, a byte-identical copy and --baseline REV — see Baseline
        status: pending
      - id: handshake-baseline-record
        content: Record the K5 inversion baseline in docs/wp34-hosting-cs.md — handshake CPU on main and on a22a056 with their noise bands, a callgrind profile of one handshake on main, bench/p256.mjs sign and verify — see Baseline
        status: pending
      - id: inversion-bar
        content: Write the bar in docs/wp34-hosting-cs.md before anything is built — the scalar inversion's Ir ceiling, P-256 under X25519, sign 3x outside the noise, handshake CPU down outside its band — see The bar
        status: pending
      - id: bench-readme
        content: Document the handshake bench in bench/README.md and docs/BENCHMARKS.md — see Baseline
        status: pending
  - id: scalar-inverse
    title: Constant-time safegcd for k^-1 mod n in P-256 signing
    goal: p256Sign and p256SignSha256Into invert the nonce with a fixed-iteration Bernstein–Yang divsteps inversion, read by ct_asm on x86-64, aarch64 and x86-64-v3, agreeing with Fermat bit for bit, its intermediates wiped
    verification: node tests/run.js ct_asm && node tests/run.js p256 && node tests/run.js wycheproof && node tests/run.js wipe && npm run check && npm run lint
    todos:
      - id: safegcd-port
        content: Add p256ScalarInverse to std/crypto/p256.ts — constant-time safegcd in signed-30 limbs, fixed outer and inner counts, no branch or address on the value — and switch both signing paths to it — see Scalar inverse
        status: pending
      - id: fermat-reference
        content: Keep p256ScalarInvert (Fermat) as the reference and wire an agreement test over 10,000 seeded scalars plus edges, natively and under Node wasi — see Scalar inverse
        status: pending
      - id: ct-asm-fixture
        content: Add copies of one 30-divstep block and the matrix update to tests/cases/ct_asm_p256.ts with ct-check specs, and a seeded variable-time divstep to ct_asm_refused — see Constant time
        status: pending
      - id: wipes
        content: Wipe the inversion's secret intermediates and extend the P-256 group in tests/wipes/crypto.js with exact counts — see Constant time
        status: pending
      - id: records
        content: Update docs/security/crypto-ecc.md and ct-verification.md, the p256.ts header, and THIRD_PARTY_NOTICES.md for the ported algorithm — see Records
        status: pending
  - id: result
    title: Re-measure the handshake and read the bar
    goal: docs/wp34-hosting-cs.md records the handshake re-profiled and re-timed on main with the inversion, against the baseline stage's bar, met or missed, nothing tuned
    verification: node bench/p256.mjs --check && node bench/tls-handshake.mjs --check && npm run lint
    todos:
      - id: result-profile
        content: Re-profile one handshake under callgrind on main with the new inversion and tabulate P-256 against X25519 and the inversion's own Ir — see Result
        status: pending
      - id: result-bench
        content: Run bench/tls-handshake.mjs and bench/p256.mjs against the baseline's commit and a22a056 with copies, and read every bar condition — see Result
        status: pending
---

## Context

#628 merged a fixed-base comb for `k·G` (#663). Its close-out left two criteria not met: sign is about 3x faster but not shown outside the 5.5% noise band (3.04x where the bar asks 3.07x), and P-256 is still the largest module of a handshake's server Ir, 3,208,117 against X25519's 3,147,964 ([docs/wp34-hosting-cs.md](docs/wp34-hosting-cs.md), "K5: P-256, the result"). The record's next step: `p256ScalarInvert`, `k^-1 mod n` by Fermat, is 776,344 Ir, 24.2% of a signature, and removing it alone puts P-256 under X25519.

ECDSA needs one inversion mod n per signature; it cannot be taken out of the algorithm. What can be taken out is its cost: Fermat at [std/crypto/p256.ts:3751](std/crypto/p256.ts) is 256 scalar squarings plus 169 multiplies (popcount of n − 2), about 425 Montgomery multiplies.

## Approach

| option | scalar inversion Ir (est.) | CT story | chosen |
| --- | --- | --- | --- |
| Better addition chain for n − 2 | ~545k (−30%) | unchanged discipline | no — leaves P-256 only ~5% under X25519 and sign ~3.2x, inside the noise |
| fiat-crypto's single `divstep` | ~450–600k | straight-line step, readable by ct_asm | no — one step per call is nearly as slow as Fermat |
| Blinded variable-time GCD | ~50k | a branch on a secret-derived value | **no** — breaks the "no branch, no address on a secret" rule of [docs/security/ct-verification.md](docs/security/ct-verification.md) |
| **Constant-time safegcd, signed-30 limbs, 30 divsteps a batch** (Bernstein–Yang 2019; libsecp256k1 `modinv32`, MIT) | ~30–80k | fixed counts, mask arithmetic; one batch and one update readable by ct_asm | **yes** |

The safegcd is chosen because it removes ~90% of the inversion's cost while keeping the module's constant-time rule, and — unlike today's Fermat loop, which is discipline only — its straight-line batch can be read by `tests/ct-asm.js`. It uses i32×i32→i64 products only, which wasm32 has natively (no `__multi3`, the #687 trap). The field inversion (`p256FieldInvert`, 552,948 Ir) and the verify path are left for a later run.

`baseline` and `scalar-inverse` own disjoint files and develop in parallel; `baseline` must **merge first** so the bar predates the change (#628's criterion 1 precedent). `result` starts once `scalar-inverse` merges.

## Baseline

**Owns:** `bench/tls-handshake.mjs`, `bench/README.md`, `docs/BENCHMARKS.md`, `docs/wp34-hosting-cs.md`
**Model:** lead (inherit)

- `bench/tls-handshake.mjs` (no new `.ts`, so no corpus golden moves): builds `tests/link/net_interop_server` as [bench/h3-latency.mjs](bench/h3-latency.mjs) does, plus a byte-identical copy and, with `--baseline REV`, the server built from REV in a worktree under `build/`. Each round drives N fresh TLS 1.3 handshakes (curl or `openssl s_client`/`s_time`, X25519, TLS_AES_256_GCM_SHA384 as K5 negotiated) at each target in rotating order, pinned to a CPU, and reads the server's CPU from `/proc/<pid>/stat` over enough handshakes that the 10 ms tick is under 1% of the figure. Reports server CPU µs per handshake and client-observed handshake latency, min and median over rounds, and the copy-vs-itself spread. `--check` runs a handful of handshakes against one target and exits 0, for CI-free smoke.
- New section "K5: P-256, the inversion — the baseline" in [docs/wp34-hosting-cs.md](docs/wp34-hosting-cs.md), on `main` as it is: the handshake bench against `a22a056` and against `main`, each with a copy; one handshake under callgrind by K5's method (module table, P-256's inclusive function table, `p256ScalarInvert`'s Ir); `bench/p256.mjs --self --binary <a22a056> --binary <copy> --runs 16`, twice. Machine, compiler and seed stated as K5 does.

### The bar

Written in the same section, before `scalar-inverse` merges, from the figures above:
1. The scalar inversion is under 10% of its Fermat cost in one handshake's profile (≤ 77,634 Ir).
2. P-256 is under X25519 in one handshake's server Ir, and not the largest module (#628 criterion 3).
3. `p256SignSha256`'s minimum is at least 3x faster than `a22a056`'s, outside the noise band at the minimum, in **both** samples (#628 criterion 2, with the sample rule fixed in advance); verify not slower outside the band.
4. Server CPU per handshake on main after the change is lower than this baseline's main, outside the copy's band at the minimum, in both samples. If the band measured here is wider than the change the profile projects, say so in the bar: a miss is recorded as a miss.

## Scalar inverse

**Owns:** `std/crypto/p256.ts`, `std/crypto/LICENSE-*`, `tests/cases/ct_asm_p256.*`, `tests/cases/ct_asm_refused.*`, `tests/ct-asm.js`, `tests/ct-timing.js`, `tests/link/crypto_p256_agree/**`, `tests/link/crypto_p256_inverse/**`, `tests/run.js`, `tests/wipes/crypto.js`, `docs/security/crypto-ecc.md`, `docs/security/ct-verification.md`, `THIRD_PARTY_NOTICES.md`, `std/README.md`; generated: `tests/self/goldens/**`, `tests/differential/**`
**Model:** lead (inherit)

- `p256ScalarInverse(out, a)`: `a` in the scalar Montgomery domain in, `a^-1` in it out; zero in, zero out (as Fermat). Signed-30 limbs (9 limbs for 256 bits), `delta` start 1/2, 20 batches of 30 divsteps (600 ≥ 590, the bound for 256-bit inputs in Wuille's safegcd notes), each batch a branch-free transition matrix applied to `f, g` and `d, e` mod n, then a constant-time normalisation. Every loop count is a constant; every select is fiat's conditional move or a mask, never `if` on a value. `-1/n mod 2^30` is a checked constant.
- Both signing paths switch: `p256SignScalar`'s `p256ScalarInvert(kM, kM)` ([:4931](std/crypto/p256.ts)) and the `P256SignScratch` path ([:5496](std/crypto/p256.ts)). `p256Verify`'s `w = s^-1` ([:5047](std/crypto/p256.ts)) is public data; switching it is allowed but not required.
- `p256ScalarInvert` stays, as the agreement reference (as `p256ScalarMult` is for the comb). An agreement link test (extend `crypto_p256_agree` or add `crypto_p256_inverse`): byte-identical results over ≥10,000 seeded scalars plus 0, 1, 2, n − 1, n − 2, 2^k and the all-ones patterns, natively and as the `--profile wasi` build under Node (CI's `WASI_SYSROOT=/usr`). RFC 6979 A.2.5, `crypto_p256` and Wycheproof `ecdsa_secp256r1_sha256` answer as before.

### Constant time

- `tests/cases/ct_asm_p256.ts` gains copies of one 30-divstep batch and the matrix update of `f, g` / `d, e`, with `// ct-check:` specs, read on x86-64, aarch64 and x86-64 at `x86-64-v3` (all three already in `tests/run.js`'s `readTargets`). Its `.out` keeps a vector computed through the copies. No new NL9007 in `std/` is a non-issue, but check `node tests/run.js wasi` stays green.
- `tests/cases/ct_asm_refused.ts` gains a variable-time divstep (an `if` on `g`'s low bit), added to `SEEDED` in [tests/ct-asm.js](tests/ct-asm.js) with `expect=branch`, refused on all three readings.
- Watch the records' known gaps: no divide (CT-2), `mulx` at v3 (CT-5), and that the copies match the module function (the record's mechanical comparison).
- `tests/wipes/crypto.js`'s P-256 group extends to the new intermediates (`f, g, d, e`, the matrix) with exact counts, and the wipe survives `opt -O2`.

### Records

- [docs/security/crypto-ecc.md](docs/security/crypto-ecc.md): a row for the new inversion (anchors at a commit on `main`, never a PR-branch commit — #628's lesson), ECC-2's "not reached" list updated, the constant-time paragraph saying what is read by ct_asm and what remains discipline (the 20-batch loop).
- [docs/security/ct-verification.md](docs/security/ct-verification.md): "Functions still held by discipline only" gains the new function and names what is read as copies.
- `p256.ts`'s header: the inversion paragraph.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and a `std/crypto/LICENSE-*` beside it if libsecp256k1 code is ported or adapted (MIT is allowed, [.claude/licensing.md](.claude/licensing.md)); if written from the paper alone, say so there.

## Result

**Owns:** `docs/wp34-hosting-cs.md`, `docs/BENCHMARKS.md`, `bench/README.md`
**Model:** lead (inherit)

On `main` with the new inversion: K5's callgrind profile of one handshake (three dumps), `bench/tls-handshake.mjs --baseline <baseline stage's main> --baseline a22a056 --runs ≥16` twice, `bench/p256.mjs` twice against the same builds. A "K5: P-256, the inversion — the result" section reads each bar condition met or missed with the figures; nothing tuned. Update the K5 row of §5a.

## Out of scope

- `p256FieldInvert` (the affine `Z^-1 mod p`, 552,948 Ir) — the next step after this, by the same routine with p.
- 64-bit limbs, the verify path's window, ECDH.
- Any change to RFC 6979 nonces, the public API, or `nish:secret`.

## Tests

`tests/link/crypto_p256_agree` (or a new `crypto_p256_inverse`), `tests/cases/ct_asm_p256`, `tests/cases/ct_asm_refused`, `tests/wipes/crypto.js`, `crypto_p256`, Wycheproof. Mirror #663's shape.

## Verification

Per stage, the `verification` line; before each PR, an undegraded `npm test` (read the skip count); `node tests/run.js wasi` and `performance` are `src/`-only rules, but `wasi` is run anyway because the agreement test runs under Node.
