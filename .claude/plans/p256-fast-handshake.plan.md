---
name: P-256 fast enough that it no longer dominates the TLS handshake
overview: Measure where one TLS 1.3 handshake's server instructions go, set a bar, then give P-256's fixed-base multiplication (k·G, all a server handshake signs with) a precomputed table — constant time on x86-64 and aarch64 by ct_asm, byte-identical to the current code on Wycheproof and a fuzzed corpus — and record the result against the bar.
stages:
  - id: measure
    title: "docs(crypto): P-256's share of a TLS 1.3 handshake, the baseline and the bar"
    goal: One handshake profiled against the interop server, P-256's share recorded, a bench for P-256 with its noise band, and a bar written before anything is built — or the stop rule invoked
    verification: node bench/p256.mjs --self --runs 3 && npm run lint && node docs/check-links.mjs && npm test
    todos:
      - id: bench-p256
        content: Add bench/p256.ts and bench/p256.mjs (public key, sign, verify; inputs change every iteration, checksum printed, --self interleaves a byte-identical copy) — see Measure
      - id: profile-handshake
        content: Profile one TLS 1.3 handshake against tests/link/net_interop_server under callgrind and attribute its Ir by module and function — see Measure
      - id: baseline-row
        content: Write the K5 baseline subsection in docs/wp34-hosting-cs.md with the profile, the bench, the noise band, the bar and the stop-rule verdict — see Measure
  - id: fixed-base
    title: "perf(crypto): P-256 multiplies the base point by a precomputed table"
    goal: p256PublicKey and p256Sign compute k·G from a precomputed constant-time table, agreeing byte for byte with the 4-bit-window reference on Wycheproof and a fuzzed corpus, natively and under Node, with ct_asm reading the new code on x86-64 and aarch64
    verification: node tests/run.js p256 && node tests/run.js ct_asm && node tests/run.js wycheproof && node tests/run.js wasi && node tests/run.js performance && npm run check && npm test
    todos:
      - id: table-generator
        content: Add scripts/gen-p256-table.mjs and the generated std/crypto/p256-table.ts, with a --check mode npm test runs — see Fixed-base table
      - id: fixed-base-mult
        content: Add p256BaseMult in std/crypto/p256.ts (64 constant-time table reads, 64 mixed additions, no doublings) and move p256PublicKey and p256Sign onto it — see Fixed-base table
      - id: reference-agree
        content: Add tests/link/crypto_p256_agree holding the new path against the reference p256ScalarMult(G, k) on Wycheproof scalars and a seeded corpus, natively and under Node — see Agreement
      - id: wycheproof-ecdh
        content: Add Wycheproof ecdh_secp256r1 to tests/link/crypto_wycheproof and run it as Agreement says — see Agreement
      - id: ct-asm-fixed-base
        content: Extend tests/cases/ct_asm_p256.ts with the table read, the mixed addition and one step of p256BaseMult, and add a leaky table read to tests/cases/ct_asm_refused.ts — see Constant time
      - id: secret-and-wipe
        content: Keep the scalar a Secret and wipe every digit, window and intermediate p256BaseMult holds — see Constant time
      - id: ecc-record
        content: Update docs/security/crypto-ecc.md, std/README.md and the p256.ts header for the new path — see Constant time
  - id: result
    title: "docs(crypto): P-256's fixed-base table against the bar"
    goal: The handshake profile and the bench re-run on main with the table, read against the baseline's noise band, and the K5 row and Left cell updated with the verdict
    verification: node bench/p256.mjs --self --runs 3 && npm run lint && node docs/check-links.mjs && npm test
    todos:
      - id: result-measure
        content: Re-run the handshake profile and bench/p256.mjs on main against the baseline commit in the same interleaved rounds — see Result
      - id: result-row
        content: Write the K5 result subsection and update the K5 row's Left cell in docs/wp34-hosting-cs.md — see Result
---

# P-256 fast enough that it no longer dominates the TLS handshake

## Context

[`std/crypto/p256.ts`](../../std/crypto/p256.ts) is fiat-crypto's 32-bit Montgomery arithmetic (eight `u32` limbs, `u64` products) under a fixed 4-bit window: `p256ScalarMult` builds sixteen multiples of the point, then runs 64 windows of four doublings, a constant-time table read and a complete addition. Every scalar multiplication goes through it — 256 doublings and ~80 additions whatever the point.

A TLS 1.3 server handshake ([`std/net/tls.ts`](../../std/net/tls.ts)) uses P-256 once: `p256SignSha256` for CertificateVerify. The key share is X25519 only (WP34 T1's Left cell), and there is no client authentication, so the server never verifies and never does ECDH. Signing multiplies only the **base point** `G`: `k·G` for the nonce (and `d·G` for `p256PublicKey`).

WP38 S5's profile ([wp38-simd.md](../../docs/wp38-simd.md#s5-aes-gcm-the-baseline)) put "P-256 and X25519" at 12.6 M Ir of a 1 MiB transfer; since S5's kernel made AES 38x faster, the handshake is a much larger share of a connection than it was. WP34 K5's Left cell names the two remedies: "A 64-bit or fixed-base-table P-256, when a profile of signing asks".

## Approach

**A fixed-base table, not 64-bit limbs.** Nish has no 64×64→128 product (`docs/LANGUAGE.md`, `runtime/nish.d.ts`), so fiat's `p256_64.c` cannot be ported without a new compiler builtin — a construct in `src/` with its golden, wasm32 lowering (a `__multi3` libcall ct_asm would refuse), Node reading and the rolling freeze. The table needs no compiler change and removes every doubling from `k·G`, which is the only multiplication a server handshake does: 64 mixed additions instead of 256 doublings and 64 additions, roughly 4–5x fewer field multiplications for `k·G`. 64-bit limbs stay in the Left cell.

**The reference stays.** `p256ScalarMult` is untouched: verification still uses it for `u2·Q`, and the agreement test holds the new `p256BaseMult(k)` to `p256ScalarMult(G, k)` byte for byte. The switch of `p256PublicKey` and `p256Sign` onto the table lands in the same PR as the agreement test that proves it, and not before.

**Sequential stages.** Every stage touching `std/` or a positive `tests/cases/*` moves `tests/self/goldens/checked.txt`, and the bar must exist before the build (requirement 1), so the three stages run one after another. Merge order: `measure` → `fixed-base` → `result`.

## Measure

**Owns:** `bench/p256.ts`, `bench/p256.mjs`, `bench/README.md`, `docs/wp34-hosting-cs.md`, `docs/BENCHMARKS.md`

- `bench/p256.ts` times `p256PublicKey`, `p256SignSha256` and `p256VerifySha256`, each alone in its process, with the scalar and message changing every iteration and every answer folded into a printed checksum. `bench/p256.mjs` mirrors [`bench/aes-gcm.mjs`](../../bench/aes-gcm.mjs): `--self` interleaves a byte-identical copy to give the noise band, `--binary` times another build in the same rounds.
- The profile: build `tests/link/net_interop_server` as [`tests/interop/server.dockerfile`](../../tests/interop/server.dockerfile) does plus `-g`, run it under `valgrind --tool=callgrind`, zero the counters once it prints its ports (minting its identity is not a handshake), and dump around **one** TLS 1.3 handshake from a client (`curl --tlsv1.3 -k` on a tiny file, or `openssl s_client -tls1_3`) — the method of WP38 S5's "One real exchange". Report the server's Ir in total, per module (`std/crypto/p256.ts`, `x25519.ts`, `sha256.ts`/`hmac.ts`/`hkdf.ts`, `std/net/tls*`, the AEAD), and P-256's top functions (`p256ScalarMult`, the field multiply and square, the inversions, RFC 6979). Native CPU time over ten handshakes from `/proc/<pid>/stat` beside it.
- The row: a `#### K5: P-256, the baseline` subsection under WP34 §5a (or a section the K5 row links to), in WP38 S5's shape — how it was measured, the commit, the machine (lscpu), the tables, the noise band.
- **The stop rule.** If P-256 is under **10%** of the handshake's server Ir, record that, say the stop rule applies, and stop: `fixed-base` and `result` are cancelled.
- **The bar, written in this PR before anything is built.** Both of: (1) `p256SignSha256`'s minimum is at least **3x** faster than this baseline's on the same machine (or after re-running the baseline beside it, as S5's bar allowed), outside the noise band; (2) P-256 is no longer the largest module in one handshake's server Ir, and is under **25%** of it. `p256VerifySha256` is not slower outside the noise band. If the measurement shows the bar should be different (for example P-256 is already under 25%), the worker writes the bar the numbers justify and says why in the PR.

## Fixed-base table

**Owns:** `std/crypto/p256.ts`, `std/crypto/p256-table.ts`, `scripts/gen-p256-table.mjs`, `std/README.md`, `docs/security/crypto-ecc.md`, `docs/guide/using-nish/standard-library.md`, `tests/link/crypto_p256/**`, `tests/link/crypto_p256_f64/**`, `tests/link/crypto_p256_agree/**`, `tests/link/crypto_wycheproof/**`, `tests/cases/ct_asm_p256.*`, `tests/cases/ct_asm_refused.*`, `tests/run.js`, `tests/ct-asm.js`, `tests/self/goldens/**`, `tests/differential/**`, `THIRD_PARTY_NOTICES.md`, `knip.json`

- **The table.** 64 sub-tables, one per 4-bit window `i`, each holding `j·16^i·G` for `j = 1..15` in affine Montgomery form as fiat's eight `u32` limbs (`x`, `y`); `j = 0` is the identity, selected the same way. 64 × 15 × 16 limbs ≈ 15,360 `u32`, ~60 KiB. Generated by `scripts/gen-p256-table.mjs` (BigInt, from SEC 2's `G` and p) into `std/crypto/p256-table.ts` with a header saying it is generated; `node scripts/gen-p256-table.mjs --check` regenerates it and fails on any byte of difference, and `tests/run.js` runs that check. If a 60 KiB literal costs the compiler or the binary something measurable (compile time, `perf_*` size ratchets), the worker records the figure and may choose a comb with fewer, larger windows instead — the decision and its numbers go in the PR body.
- **`p256BaseMult(k)`** (not exported): for each window, read the sub-table entry for digit `k_i` by scanning all sixteen entries with fiat's `cmovznz`/`selectznz` steered by `ctEq` (the existing table read's pattern), and add it into the accumulator with a **complete mixed addition** (Renes–Costello–Batina Algorithm 5, `a = -3`, `Z2 = 1`); the identity entry needs that addition to stay complete, or the read returns a projective identity and uses the full addition — the worker picks one and proves it. No doubling, no branch, no secret-indexed address.
- `p256PublicKey` and `p256Sign` call `p256BaseMult`; `p256Verify` stays on `p256ScalarMult` (it may use `p256BaseMult` for its public `u1·G` only if the agreement test covers it). `P256SignScratch` / `p256SignSha256Into` keep their allocation-free promise: the new path allocates nothing per call that the scratch did not.

## Agreement

- `tests/link/crypto_p256_agree`: for every private key in Wycheproof's `ecdsa_secp256r1_sha256` and `ecdh_secp256r1` (and the RFC 6979 A.2.5 key and nonces), and a seeded corpus of ≥ 10,000 scalars including 1, 2, 15, 16, n−1, n−2, scalars with every 4-bit digit zero or fifteen, and random ones, compute `k·G` through `p256BaseMult` and through `p256ScalarMult(G, k)` and require identical encodings; fold every output into a printed checksum held by `expected.out`. It needs both functions, so it lives where the module's own tests already reach its internals, or the module gains a test-only seam the header names — the worker's choice, stated in the PR.
- `ecdh_secp256r1`: the vectors go into `tests/link/crypto_wycheproof` beside the ECDSA file (its `LICENSE-wycheproof` already covers them; `THIRD_PARTY_NOTICES.md` updated if it lists files). Every valid case's private key's public key is checked through `p256PublicKey` (the new path) against the reference; the shared secret, `d·Q` for the peer point, goes through `p256ScalarMult` and must equal the vector's `shared` — the module exports no ECDH, so this runs through the same seam as the agreement test and adds no public API.
- Every existing P-256 check keeps its `expected.out` byte for byte: `crypto_p256`, `crypto_p256_f64`, `crypto_wycheproof`'s ECDSA cases, the `crypto_x509*` and `net_tls_*` programs that sign.
- **Under Node.** The agreement program runs under Node and prints the same stdout as native: the `--profile wasi` build under Node's WASI, and the Node TypeScript reading too if `p256.ts` is class A there. If it is not (as `aes.ts` is not, `u64`/`u32` mixing), the test's comment says so, as `crypto_aes_agree`'s does.

## Constant time

- `tests/cases/ct_asm_p256.ts` gains copies of the new table read (all sixteen entries, secret digit), the mixed addition, and one window step of `p256BaseMult`, named to `tests/ct-asm.js`'s check on x86-64 and aarch64 with the existing fixture's conventions; its `main` runs RFC 6979 A.2.5's `k·G` through them. Its `.ll` and `.out` goldens are regenerated, never edited.
- `tests/cases/ct_asm_refused.ts` gains a leaky base-table read — the entry indexed directly by the secret digit — that the check must refuse as a secret-indexed load on both targets (the negative case). Any count `tests/run.js` asserts over the fixtures moves with it.
- The scalar arrives as `Secret<u8[]>` and is read only inside `expose`; the digit array, the selected entry, the accumulator and every field intermediate `p256BaseMult` holds are `wipe`d before it returns, and `tests/run.js`'s "the wipe survives opt -O2" pattern covers them if the existing p256 wipe check does not already.
- `docs/security/crypto-ecc.md` gains a row for the new path: what ct_asm reads, what remains discipline (the 64-window loop), what a wipe cannot reach. The record states the commit its anchors are at, and every check it cites is its exact `check(...)` string, grepped against `tests/run.js`. `std/README.md` and the guide's standard-library page say what changed only if they describe P-256's speed or method.
- Commit body is the changelog entry, with `Measured:` carrying the sign figure from the bench on this head.

## Result

**Owns:** `docs/wp34-hosting-cs.md`, `docs/BENCHMARKS.md`, `bench/README.md`

- Re-run the handshake profile (same method, same client) and `bench/p256.mjs --binary <baseline build> --runs 16` on `main` with the table, in the same interleaved rounds as the baseline commit's build.
- `#### K5: P-256, the result` beside the baseline: tables, the noise band on this machine, the bar's two conditions each stated as met or missed with the figure, and verify's figure. Update the K5 row's Left cell: what is done, and what is left (64-bit limbs, the ECDH and verify paths, the 64-window loop by disassembly).
- If a bar condition is missed, record it as missed — WP38 S1's "the bar missed" is the precedent. Nothing is tuned in this stage.

## Out of scope

Other curves (X25519 included), AES, 64-bit limbs and the 64×64→128 builtin they need, an ECDH export or a P-256 TLS key share, any change to `src/`.

## Tests

Mirror [`tests/link/crypto_aes_agree`](../../tests/link/crypto_aes_agree) (seeded corpus folded into a checksum), [`tests/link/crypto_wycheproof/ecdsa_secp256r1_sha256.ts`](../../tests/link/crypto_wycheproof/ecdsa_secp256r1_sha256.ts) (vector layout), and [`tests/cases/ct_asm_p256.ts`](../../tests/cases/ct_asm_p256.ts) / [`ct_asm_refused.ts`](../../tests/cases/ct_asm_refused.ts) (fixture conventions).

## Verification

Every stage: `npm run check`, `npm run lint` (exit status, not a piped tail), and an **undegraded** `npm test` — read the skip count; only the two documented wasi skips are allowed without a sysroot. This repo has no coverage tool; the undegraded suite is the gate in its place. `fixed-base` additionally runs `node tests/run.js wasi` and `node tests/run.js performance` (CLAUDE.md), regenerates goldens with `node tests/self/goldens.js --update` and registers new cases with `node tests/differential/goldens.js --update`.
