---
name: SHA-256 scalar block — measure the gap to OpenSSL, close it if it is real, prove HMAC reaches SHA-NI
overview: An HS256 verify is three SHA-256 compressions, the minimum, so a cheaper JWT check on CPUs without SHA-NI has to come from `sha256Compress` in std/crypto/sha256.ts. Measure ns and cycles per 64-byte block against OpenSSL's scalar and AVX2 block functions first, speed up the Nish body only if the gap is over 20%, check that every HMAC-SHA256 caller reaches the SHA-NI kernel where the CPU has it, and decide multi-buffer on numbers.
stages:
  - id: sha256-block
    title: SHA-256 block — measure, speed up, prove the dispatch
    goal: A measured ns/block table (old Nish soft, Nish SHA-NI, OpenSSL scalar, OpenSSL AVX2, new Nish soft), a faster scalar `sha256Compress` if the gap is over 20% and the gain is over 10% and repeatable, and a demonstration that HMAC-SHA256, JWT HS256 and `hmacCopySha256` take the SHA-NI kernel by default and the Nish body under NISH_SHA256=soft
    verification: npm run check; npm run lint; node tests/run.js crypto, sha256, hmac, jwt, ct and performance filters plus wasi (WASI_SYSROOT=/usr); the block bench run twice with medians inside each other's spread; the OpenSSL differential on random lengths 0–1000 under both NISH_SHA256 settings; checked and differential goldens regenerated and read; every CI test shard green with its skip count read
    status: pending
    todos:
      - id: measure-before
        content: Bench ns and cycles per 64-byte block, before any change — Nish under NISH_SHA256=soft and by default, OpenSSL `openssl speed -evp sha256` and the block function under OPENSSL_ia32cap masks that leave scalar only and AVX2 without SHA — and record the gap; see Measure first
        status: pending
      - id: disassemble
        content: objdump the soft `sha256Compress` loop and count instructions, stack spills and reloads, rotate forms, schedule placement, bounds checks and per-block work outside the rounds; see Reading the loop
        status: pending
      - id: speed-up
        content: If the gap is over 20%, rewrite the scalar body in std/crypto/sha256.ts for the cause the disassembly names, keeping digests identical and adding no secret-dependent branch or table; if the cause is LLVM's lowering or a missing Nish construct, name the compiler change instead; see Speeding it up
        status: pending
      - id: differential
        content: Add the NIST vectors and an OpenSSL differential on random lengths 0–1000 run under NISH_SHA256=soft and by default; see Correctness
        status: pending
      - id: dispatch
        content: Build a small HMAC-SHA256 / HS256 / hmacCopySha256 program and show the SHA-NI kernel is taken by default and the Nish body under NISH_SHA256=soft, by timing and by a probe of the kernel; see The dispatch
        status: pending
      - id: multibuffer-decision
        content: State, with numbers, how many messages a server needs ready at once for 4- or 8-lane AVX2 multi-buffer to pay off; build it only if the scalar gap stays large; see Multi-buffer
        status: pending
      - id: record
        content: Update the SHA-256 security record and the benchmark note with the table, the loop counts and the dispatch result; give the Cascade Lake commands for target B; see The record
        status: pending
---

# SHA-256 scalar block

## Context

The multicore-server-challenge entry verifies an HS256 JWT on every
authenticated request. With the key's ipad and opad states absorbed once and
copied (`hmacCopySha256`), a verify of the 104-byte signing input is two inner
blocks and one outer block, the least HS256 allows. On a Xeon Platinum 8260
(Cascade Lake: AVX2, BMI2, no SHA-NI) `sha256Compress` is 5.8% of a worker's
CPU, about 500 ns (~1,500 cycles) a block. OpenSSL's
`sha256_block_data_order_avx2` is ~600–900 cycles a block, so a 1.5–2.5× gap is
likely. Even a 2× faster block saves ~3% of a worker, under 1% of the box: this
is worth doing only on a measured, repeatable gain.

**Hardware in this run.** Neither the Ryzen 9950X nor target B
(`root@104.204.68.116`) is reachable from the cloud sessions. The container's
CPU is an Intel Xeon @ 2.1 GHz with SHA-NI, AVX2, AVX-512 and BMI2. The soft
path is measured with `NISH_SHA256=soft`; OpenSSL's scalar and AVX2 paths with
`OPENSSL_ia32cap` masks (bench/crypto already proves such masks, see
`bench/crypto/run.mjs`). Cycles come from `rdtsc` against a measured TSC
frequency, or `perf stat` where the container allows it. The record carries
the exact commands for the owner to rerun on target B.

## Measure first

A block microbench: N blocks through one state, interleaved rounds, a
byte-identical copy of the Nish binary as the noise band (the bench/crypto
pattern), min, median and spread over at least 11 rounds. Columns: Nish soft,
Nish default (SHA-NI), OpenSSL scalar (`sha256_block_data_order` with SHA, AVX
and AVX2 masked off), OpenSSL AVX2 (SHA masked off), and `openssl speed -evp
sha256` at 64 bytes and 8 KiB as a cross-check. Record the gap before any
change, in the PR body's first section.

## Reading the loop

Per the prompt: are the 64 rounds unrolled; do the eight working variables stay
in registers; are rotates one `ror`/`rorx`; is the message schedule computed
ahead or inside the rounds; which bounds checks stay (the compiler's
`performance:` warnings); what per-block work runs outside the rounds (array
copies, wipes, Secret handling). Counts before and after go in the PR body.

## Speeding it up

Change only std/crypto/sha256.ts (and std/crypto/hmac.ts if per-block work is
found there). No secret-dependent branch or table lookup; the HMAC compare is
untouched. `src/` is not changed in this run: if the obstacle is LLVM's
lowering or a missing Nish construct, say exactly which compiler change would
fix it. A C kernel is not written; if one is warranted, give the numbers.

## Correctness

NIST FIPS 180-4 vectors and an OpenSSL differential over random lengths 0–1000
(and HMAC over random keys), each run under `NISH_SHA256=soft` and by default.
Existing sha256/hmac/jwt tests unchanged and passing. The `ct` checks pass.

## The dispatch

The compiler swaps `sha256Compress`'s call for the runtime kernel behind
`nish_sha256_hw` (src/kernels.ts). Show that HMAC-SHA256 (std/crypto/hmac.ts),
HS256 (std/crypto/jwt.ts) and `hmacCopySha256` all reach it: time a small
program by default and under `NISH_SHA256=soft`, and confirm from the IR or a
symbol probe that each path calls the kernel.

## Multi-buffer

Only if the scalar gap stays large. Otherwise state the break-even: how many
independent messages must be ready at once for 4 or 8 AVX2 lanes to win, against
the ~3 requests a worker sees per epoll wake.

## The record

`docs/security/crypto-sha256-hw.md` (or the record whose scope names
std/crypto/sha256.ts) gets the result; the measurement table goes with the
bench. The PR is opened only if the gain is over 10% per block and repeatable;
otherwise the PR is docs-only: the table, the loop counts and the dispatch result land in the record and the bench, and sha256.ts is unchanged (owner sign-off, 2026-11-03).

**Owns:** `std/crypto/sha256.ts`, `std/crypto/hmac.ts`, `bench/crypto/hash/**`,
`bench/sha256-block/**`, `tests/cases/*sha256*`, `tests/cases/*hmac*`,
`tests/run.js`, `tests/self/goldens/checked/**`, `tests/differential/**`,
`docs/security/crypto-sha256-hw.md`, `docs/BENCHMARKS.md`, `docs/guide/**`
