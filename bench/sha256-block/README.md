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
node bench/sha256-block/run.mjs --compiler build/seed/bin/nish --variant locals+maj+nested --variant v3
```

The compiler reads the `std/` beside its own binary, so `--compiler
build/seed/bin/nish` times the seed's bundled `std/crypto/sha256.ts`, not the
tree's. They are the same file until a release changes it.

| File | What it is |
| --- | --- |
| `main.ts` | Runs `main <kernel> <size> <iterations>` under `bench/crypto/README.md`'s contract. The kernels are `block` (`sha256` of a `size`-byte message), `hmac` (`hmacSha256` under a 32-byte key), `hs256` (`jwtSignString` then `JwtVerifier.verifyString`) and `pbkdf2` (`pbkdf2HmacSha256` with `size` iterations, 32 bytes out). |
| `openssl.c` | `block` and `hmac` against libcrypto, built with `clang -O2`. Its `hmac` is the one-shot `HMAC(EVP_sha256(), …)`, which fetches the digest and keys a context on every call. |
| `variants.mjs` | The rewrites of `sha256Compress` that "Trying to close the gap" times, as edits to `sha256.ts` that refuse a file of another shape. |
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

Three runs on the container's CPU: Intel(R) Xeon(R) Processor @ 2.10GHz, 4
cores, `sha_ni avx2 avx512`, TSC 2.100 GHz, OpenSSL 3.0.13. Runs 1 and 2 are
12 interleaved rounds; run 3 is 26, pinned with `taskset -c 3`. The figures
are median ns a block (min, spread), and cyc is median TSC cycles a block. The
16 KiB message is 257 blocks.

| block 16 KiB | run 1 ns | run 1 cyc | run 2 ns | run 2 cyc | run 3 ns | run 3 cyc |
| --- | --- | --- | --- | --- | --- | --- |
| nish soft | 212.4 (185.7, 20.7%) | 446 | 218.2 (197.7, 39.6%) | 458 | 208.3 (198.6, 20.7%) | 437 |
| nish soft, byte copy | 207.5 (189.2, 13.7%) | 436 | 216.7 (196.2, 27.1%) | 455 | 209.2 (202.7, 24.0%) | 439 |
| nish (sha-ni) | 46.9 (40.2, 62.5%) | 98 | 49.1 (43.7, 45.0%) | 103 | 49.1 (45.7, 33.3%) | 103 |
| openssl scalar | 174.0 (145.3, 25.3%) | 365 | 182.1 (164.3, 24.7%) | 382 | 182.9 (175.0, 32.2%) | 384 |
| openssl avx2 | 147.8 (139.1, 17.1%) | 310 | 151.2 (139.8, 18.3%) | 317 | 149.3 (141.9, 21.3%) | 314 |
| openssl (sha-ni) | 41.7 (39.3, 10.0%) | 88 | 42.0 (41.4, 5.5%) | 88 | 41.5 (38.9, 24.3%) | 87 |

The byte-for-byte copy's median lands 2.3%, 0.7% and 0.4% from the soft
column's, which is the noise band. The Nish body is 22.1%, 19.8% and 13.9%
slower than OpenSSL's scalar body (212.4 / 174.0, 218.2 / 182.1 and
208.3 / 182.9): the 20% bar for a rewrite was met on one run of three. It is
40% to 44% slower than OpenSSL's AVX2 body. The SHA-NI kernel is 12% to 18%
behind OpenSSL's SHA-NI body.

`openssl speed -evp sha256`, which `run.mjs` runs under the same masks, agrees
with the bench's OpenSSL columns. In run 3, ns a block (one 1 s run each;
a 64 B message is two blocks, 8 KiB is 129):

| Mask | 64 B | 8 KiB | bench, 64 B | bench, 16 KiB |
| --- | --- | --- | --- | --- |
| openssl scalar | 226.9 | 182.0 | 206.6 | 182.9 |
| openssl avx2 | 203.2 | 151.8 | 184.8 | 149.3 |
| openssl (sha-ni) | 84.7 | 43.1 | 75.1 | 41.5 |

The rows below are ns an operation, as medians from runs 1, 2 and 3:

| Case | nish soft | nish (sha-ni) | openssl scalar | openssl avx2 | openssl (sha-ni) |
| --- | --- | --- | --- | --- | --- |
| block 64 B (2 blocks), ns a block | 342.6 / 347.0 / 335.4 | 203.3 / 202.1 / 199.1 | 214.1 / 211.9 / 206.6 | 188.2 / 188.6 / 184.8 | 75.9 / 76.3 / 75.1 |
| hmac-sha256 64 B, a message | 1700 / 1762 / 1648 | 963 / 941 / 925 | 2144 / 2155 / 2178 | 1962 / 1972 / 1985 | 1363 / 1346 / 1378 |
| hs256 sign+verify | 4800 / 5017 / 4842 | 4130 / 3961 / 3931 | — | — | — |
| pbkdf2, 1000 iterations | 516080 / 545258 / 523228 | 223693 / 230667 / 220338 | — | — | — |

HMAC, HS256 and PBKDF2 all run faster under the default than under
`NISH_SHA256=soft`. So the SHA-NI kernel is taken through `hmacSha256`,
through the JWT key's HMAC, and through `hmacCopySha256`. The short-message
rows cost more per block than the 16 KiB row, and the extra is per-message
work outside the compression. With SHA-NI on a 64 B message, Nish takes 199
to 203 ns a block and OpenSSL takes 75 to 76.

The HMAC row is a cost a message, not a block, and its OpenSSL side is not
the same work as Nish's: `HMAC(EVP_sha256(), …)` fetches the digest and
builds a keyed context on each call, where `hmacSha256` keys a hasher with no
lookup. Read it as what each library's one-shot costs, not as a block
function compared.

## Trying to close the gap

Each variant below is `std/crypto/sha256.ts` with only `sha256Compress`'s body
or its Σ and σ helpers changed. `variants.mjs` makes each one from the file
the compiler reads, and `run.mjs --variant <part>+<part>` builds and times it
beside the base. Every variant prints the base's checksums.

| Variant | What changed |
| --- | --- |
| base | `main` at 96a38347 |
| locals | the schedule in 16 rolling locals instead of `w[]` |
| maj | Maj as `y ^ (xy & yz)`, carrying `x ^ y` into the next round |
| nested | Σ0 and Σ1 as three nested rotates (`rotr(rotr(rotr(e, 14) ^ e, 5) ^ e, 6)`) |
| snested | σ0 and σ1 as two nested rotates |
| v3 | built with `--cpu x86-64-v3` (`rorx`) |

`run.mjs` counts each build's `sha256Compress` the way this does by hand:

```bash
clang -O3 [-march=x86-64-v3] -c build/bench/sha256-block/variant-<spec>/ir/sha256.ll -o sha256.o
objdump -d --no-show-raw-insn --disassemble=nish.sha256Compress sha256.o
```

Instructions are the disassembled lines. A stack store has `(%rsp)` in its
last operand and a stack load has it in another. A register move is a `mov`,
`movl` or `movq` from one register to another.

| Variant | Instructions | Stack stores | Stack loads | Register moves |
| --- | --- | --- | --- | --- |
| base | 3450 | 129 | 138 | 905 |
| locals | 3360 | 130 | 122 | 898 |
| maj | 3414 | 157 | 175 | 870 |
| nested | 3189 | 125 | 130 | 656 |
| locals + maj + nested | 3023 | 147 | 131 | 601 |
| locals + maj + nested + snested | 2884 | 128 | 106 | 497 |
| v3 | 2864 | 122 | 115 | 339 |
| v3 + locals + maj + nested | 2623 | 129 | 112 | 249 |

The base body is fully unrolled, with K as immediates: 10.8 KB of code, 576
`rol` (no `ror`, no `rorx` at the baseline), 96 `shr`, 15 `bswap`, 64 stores
of the schedule to the heap and a 0xf8-byte frame. Its only bounds checks are
the guard's six branches at entry; no round has one.

Times are median ns a block on the 16 KiB message, `NISH_SHA256=soft`, pinned
to one core with `taskset -c 3`. Runs A and B are 21 interleaved rounds of
1500 iterations, from builds made by hand; run C is `run.mjs --rounds 15
--variant …` (26 rounds, 3511 iterations, the copy's band ±0.4%), whose
whole output is reproduced by the commands under "Rerunning on target B":

| Variant | run A | run B | run C | C against base |
| --- | --- | --- | --- | --- |
| base | 209.9 | 208.5 | 208.3 | — |
| base, byte copy | 209.9 | 209.3 | 209.2 | +0.4% |
| locals | — | — | 204.6 | -1.8% |
| maj | — | — | 207.3 | -0.5% |
| nested | — | — | 196.2 | -5.8% |
| locals + maj + nested | 190.1 | 191.7 | 189.2 | -9.2% |
| locals + maj + nested + snested | 192.1 | 189.8 | 193.8 | -6.9% |
| v3 | — | 190.7 | 191.2 | -8.2% |
| v3 + locals + maj + nested | — | 195.1 | 196.2 | -5.8% |

Spreads were 12% to 84%. The best variant is 8% to 9.5% faster on the median
in every run, under the 10% bar and inside the spread, and the build flag
alone gives as much. On the 64 B message every variant is within 2% of the
base. So `sha256Compress` is unchanged.

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
| sha | FIPS 180-4's five vectors, the padding edges (55, 56, 63, 64, 65, 119, 120, 127, 128, 129 B), 200 seeded lengths 0..1000 | 17319 | 0 |
| hmac | `hmacSha256` over the same edges under a 32 B key, keys of 63, 64, 65 and 128 B, then 200 seeded keys 0..200 B and messages 0..1000 B | 2732 | 0 |
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

Prerequisites: clang, the libcrypto headers (`libssl-dev`), the `openssl`
CLI, and a seed whose compiler has the SHA-NI kernel and reads
`NISH_SHA256` (0.33.0 or later; `fetch-seed.sh` takes the last release).

```bash
set -o pipefail
git checkout main && npm ci
bash scripts/fetch-seed.sh --force
grep -o 'sha_ni\|avx2\|bmi2' /proc/cpuinfo | sort -u   # Cascade Lake has no sha_ni
node bench/sha256-block/run.mjs --compiler build/seed/bin/nish --rounds 15 \
  --variant locals+maj+nested --variant locals+maj+nested+snested --variant v3 \
  | tee sha256-block-B.txt
```

`--compiler build/seed/bin/nish` times the seed's bundled `std/`, so a
`sha256.ts` change on `main` that has not been released is not in it.

Cascade Lake has no SHA extension, so its default column takes the Nish body.
The `nish (sha-ni)` and `openssl (sha-ni)` columns then time the same bodies
as `nish-soft` and `openssl avx2`. On target B, read:

- whether the gap is real there: `nish-soft` against `openssl scalar` and
  `openssl avx2` on the 16 KiB row, with the `openssl speed` table as a check
  on the OpenSSL columns;
- whether a rewrite clears the bar: each `variant` row's "vs soft" on the
  16 KiB row, against 10% and against the band the copy row gives.
