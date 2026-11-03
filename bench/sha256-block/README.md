# SHA-256's block function

`run.mjs` times one SHA-256 compression in ns and TSC cycles. It compares:

- Nish's own body (`NISH_SHA256=soft`);
- the SHA-NI kernel the compiler puts in front of it (the default);
- OpenSSL's `sha256_block_data_order`, with `OPENSSL_ia32cap` picking its
  scalar, AVX2 and SHA-NI bodies.

It then times HMAC-SHA256, HS256 sign+verify and PBKDF2 under both
`NISH_SHA256` settings. Those last three show by timing that the seam is
taken through `std/crypto/hmac.ts`. `tests/run.js`'s "sha256 kernel" section
proves the same thing by counting calls.

```bash
node bench/sha256-block/run.mjs --compiler build/seed/bin/nish        # 11+ interleaved rounds
node bench/sha256-block/run.mjs --binary old=<path to an older build of main.ts>
```

| File | What it is |
| --- | --- |
| `main.ts` | Runs `main <kernel> <size> <iterations>` under `bench/crypto/README.md`'s contract. The kernels are `block` (`sha256` of a `size`-byte message), `hmac` (`hmacSha256` under a 32-byte key), `hs256` (`jwtSignString` then `JwtVerifier.verifyString`) and `pbkdf2` (`pbkdf2HmacSha256` with `size` iterations, 32 bytes out). |
| `openssl.c` | `block` and `hmac` against libcrypto, built with `clang -O2`. |
| `tsc.c` | The TSC's rate: rdtsc around a 500 ms `CLOCK_MONOTONIC` wait, best of five. |

## The OpenSSL masks

OpenSSL 3.0 picks `sha256_block_data_order`'s body from `OPENSSL_ia32cap`:

| Column | Mask | What it clears |
| --- | --- | --- |
| `openssl scalar` | `~0x1000020000000000:~0x20000120` | AVX and SSSE3; AVX2, BMI2 and SHA. This leaves the integer body. |
| `openssl avx2` | `~0x0:~0x20000000` | SHA only. This leaves the AVX2 + BMI2 body (`rorx`). |
| `openssl (sha-ni)` | unset | Nothing. |

An empty `OPENSSL_ia32cap=` is not the same as an unset one: it clears every
capability word, so it times the generic C body. The runner deletes the
variable for the unset column.

## Before (std/crypto/sha256.ts at main 96a38347)

Two runs on the container's CPU: Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores,
`sha_ni avx2 avx512`, TSC 2.100 GHz, OpenSSL 3.0.13. Each run is 12
interleaved rounds. The figures are median ns a block (min, spread), and cyc
is median TSC cycles a block. The 16 KiB message is 257 blocks.

| block 16 KiB | run 1 ns | run 1 cyc | run 2 ns | run 2 cyc |
| --- | --- | --- | --- | --- |
| nish soft | 212.4 (185.7, 20.7%) | 446 | 218.2 (197.7, 39.6%) | 458 |
| nish soft, byte copy | 207.5 (189.2, 13.7%) | 436 | 216.7 (196.2, 27.1%) | 455 |
| nish (sha-ni) | 46.9 (40.2, 62.5%) | 98 | 49.1 (43.7, 45.0%) | 103 |
| openssl scalar | 174.0 (145.3, 25.3%) | 365 | 182.1 (164.3, 24.7%) | 382 |
| openssl avx2 | 147.8 (139.1, 17.1%) | 310 | 151.2 (139.8, 18.3%) | 317 |
| openssl (sha-ni) | 41.7 (39.3, 10.0%) | 88 | 42.0 (41.4, 5.5%) | 88 |

The byte-for-byte copy's median lands 2.3% and 0.7% from the soft column's,
which is the noise band. In both runs the Nish body is 20% to 22% slower than
OpenSSL's scalar body (212.4 / 174.0 and 218.2 / 182.1). It is 44% slower
than OpenSSL's AVX2 body. The SHA-NI kernel is 12% to 17% behind OpenSSL's
SHA-NI body.

The rows below are ns an operation, as medians from runs 1 and 2:

| Case | nish soft | nish (sha-ni) | openssl scalar | openssl avx2 | openssl (sha-ni) |
| --- | --- | --- | --- | --- | --- |
| block 64 B (2 blocks), ns a block | 342.6 / 347.0 | 203.3 / 202.1 | 214.1 / 211.9 | 188.2 / 188.6 | 75.9 / 76.3 |
| hmac-sha256 64 B | 1700 / 1762 | 963 / 941 | 2144 / 2155 | 1962 / 1972 | 1363 / 1346 |
| hs256 sign+verify | 4800 / 5017 | 4130 / 3961 | — | — | — |
| pbkdf2, 1000 iterations | 516080 / 545258 | 223693 / 230667 | — | — | — |

HMAC, HS256 and PBKDF2 all run faster under the default than under
`NISH_SHA256=soft`. So the SHA-NI kernel is taken through `hmacSha256`,
through the JWT key's HMAC, and through `hmacCopySha256`. The short-message
rows cost more per block than the 16 KiB row, and the extra is per-message
work outside the compression. With SHA-NI on a 64 B message, Nish takes 203 ns
a block and OpenSSL takes 76.

## Trying to close the gap

The gap to OpenSSL's scalar body is 20% to 22%, which is over the 20% bar for
a rewrite. Each variant below is `std/crypto/sha256.ts` with only
`sha256Compress`'s body changed, built by `build/nish` (which reads the tree's
`std/`; the seed reads its own copy). Every variant prints the known checksum
`34b8b4e9`.

| Variant | What changed |
| --- | --- |
| base | `main` at 96a38347 |
| locals | the schedule in 16 rolling locals instead of `w[]` |
| maj | Maj as `B ^ (ab & bc)`, carrying `a ^ b` into the next round |
| nested | Σ0 and Σ1 as three nested rotates (`rotr(rotr(rotr(e, 14) ^ e, 5) ^ e, 6)`) |
| snested | σ0 and σ1 the same way |
| v3 | the base or a variant built with `--cpu x86-64-v3` (`rorx`) |

`objdump -d` of `sha256Compress` in each build. Stores and loads count
`rsp`-relative operands, and moves count register-to-register `mov`s.

| Variant | Instructions | Stack stores | Stack loads | Register moves |
| --- | --- | --- | --- | --- |
| base | 3450 | 92 | 138 | 905 |
| locals | 3357 | 93 | 122 | 895 |
| maj | 3414 | 120 | 175 | 870 |
| nested | 3189 | 86 | 130 | 656 |
| locals + maj | 3278 | 111 | 136 | 848 |
| locals + nested | 3093 | 89 | 109 | 644 |
| locals + maj + nested | 3023 | 109 | 131 | 601 |
| locals + nested + snested | 2972 | 82 | 91 | 548 |
| locals + maj + nested + snested | 2884 | 92 | 106 | 497 |
| v3 base | 2864 | 83 | 115 | 339 |
| v3 locals + maj + nested | 2623 | 86 | 112 | 249 |

The base body is fully unrolled, with K as immediates: 10.8 KB of code, 576
`rol` (no `ror`, no `rorx` at the baseline), 96 `shr`, 15 `bswap`, 64 stores
of the schedule to the heap and a 0xf8-byte frame. Its only bounds checks are
the guard's six branches at entry; no round has one.

Times are ns a block on the 16 KiB message, `NISH_SHA256=soft`, 1500
iterations a run, 21 interleaved rounds, pinned to one core with `taskset -c 3`:

| Variant | run 1 | run 2 | run 3 |
| --- | --- | --- | --- |
| base | 209.9 | 208.5 | 207.7 |
| base, byte copy | 209.9 | 209.3 | 207.0 |
| locals + nested | 199.0 | 194.3 | — |
| locals + maj + nested | 190.1 | 191.7 | 190.8 |
| locals + nested + snested | 197.7 | 194.8 | — |
| locals + maj + nested + snested | 192.1 | 189.8 | — |
| v3 base | — | — | 190.7 |
| v3 locals + maj + nested | — | — | 195.1 |

Spreads were 23% to 84%. The best variant is 8% to 9.5% faster on the median,
under the 10% bar and inside the spread, and the build flag alone gives as
much. So `sha256Compress` is unchanged.

What would move it is a compiler change, not a source one: module-level
constant arrays. With a `u32[]` K table, rounds 16 to 63 could be a loop and
the body would shrink from 10.8 KB toward the size of the µop cache. Today
`const K: u32[] = [...]` at module level is refused ("Module constant must be
a number, boolean, or string, not u32[]"), and `w` cannot carry the table,
because HMAC wipes the schedule.

## The dispatch, counted

`tests/run.js`'s "sha256 kernel" section builds a differential program with
`nish_sha256_compress` wrapped by a counter (`-Wl,--wrap`). It runs each mode
under both settings, and Node's crypto must print the same lines. The counts
on this CPU:

| Mode | What it runs | `NISH_SHA256` unset | `NISH_SHA256=soft` |
| --- | --- | --- | --- |
| sha | FIPS 180-4's five vectors, 200 seeded lengths 0..1000 | 17319 | 0 |
| hmac | `hmacSha256`, 200 seeded keys 0..200 B, messages 0..1000 B | 2680 | 0 |
| hs256 | 50 `jwtSignString` + `verifyString` under an HS256 key | 974 | 0 |
| pbkdf2 | 10 `pbkdf2HmacSha256` runs (`hmacCopySha256` per U_j) | 8774 | 0 |

## Multibuffer

A 4- or 8-lane AVX2 body hashes one block of each of 4 or 8 messages at
once. It pays only when that many messages are ready together. A server sees
about 3 requests per epoll wake, so an 8-lane body would run at most 3 lanes
full. On this CPU the default path is already the SHA-NI kernel at 47 ns a
block, against OpenSSL's one-lane AVX2 body at 148. An 8-lane body would have
to finish 8 blocks in 376 ns to match SHA-NI, with all 8 lanes full. It is
not built. It is worth measuring only on a CPU without SHA-NI (target B).

## Rerunning on target B (Cascade Lake)

```bash
git checkout feature/sha256-scalar/sha256-block && npm ci
bash scripts/fetch-seed.sh --force
grep -o 'sha_ni\|avx2\|bmi2' /proc/cpuinfo | sort -u   # Cascade Lake has no sha_ni
node bench/sha256-block/run.mjs --compiler build/seed/bin/nish --rounds 15 | tee sha256-block-B.txt
```

Cascade Lake has no SHA extension, so its default column takes the Nish body.
The `nish (sha-ni)` and `openssl (sha-ni)` columns then time the same bodies
as `nish-soft` and `openssl avx2`. On target B, the gap to read is
`nish-soft` against `openssl scalar` and `openssl avx2`.
