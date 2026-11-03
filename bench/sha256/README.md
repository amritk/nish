# bench/sha256

The portable SHA-256 path of `nish/crypto/sha256` in nanoseconds an operation:
the one-shot `sha256` on 64 B, 1 KiB and 1 MiB, `hmacSha256` on 256 B (a
JWT's signing input), and an HS256 JWT signed and verified
(`nish/crypto/base64url` and `hmacSha256` / `hmacSha256Verify`).
`main.ts` says what each case times; `run.mjs` builds it with
`--profile speed` and times it against a byte-identical copy, the noise band,
and any other build passed as `--binary`. With `--c` it adds `scalar.c`, a
scalar C SHA-256 written from FIPS 180-4, built twice with `-O2 -mno-sha`:
`c-native` with `-march=native` and `c-x86-64` at the baseline a Nish build
without `--cpu` targets. Every case also reports ns per compressed block.

```sh
npm run build && node bench/sha256/run.mjs [--rounds N] [--binary name=<path>] [--c]
```

The columns inherit `NISH_SHA256`. On a CPU with SHA-NI or the Armv8 SHA-2
instructions, run under `NISH_SHA256=soft` so the Nish columns time the Nish
code, not `runtime/runtime-sha256.c`.

The inputs are the crypto twins' (`bench/crypto/lib/gen.ts`), and a run prints
the checksum of every output. What guards correctness is `run.mjs`'s pinned
`known` checksum per case, one iteration's as main's untuned build prints it:
before any timing, every column must print it, or the run stops. During
timing, two builds that print different checksums stop the run rather than
being compared.

## Last measured

The portable path tuned (rounds unrolled with each K_t an immediate, one
bounds check a block, and words 0 to 14 each one load and a byte swap) against
the same program built from the `main` it left, 12 rounds of three columns, on
a 4-core Intel Xeon @ 2.10GHz cloud session. Medians in ns/op; the band is the
copy's distance from the build.

| case | tuned | `main` | speed-up | band |
| --- | ---: | ---: | ---: | ---: |
| sha256 64 B | 778 | 880 | 1.13x | ±2.3% |
| sha256 1 KiB | 4,272 | 5,533 | 1.30x | ±2.4% |
| sha256 1 MiB | 3,778,149 | 5,170,001 | 1.37x | ±4.2% |
| HS256 sign+verify | 6,106 | 7,439 | 1.22x | ±0.2% |

HS256 gains least because a token is two short HMACs (four compressions each)
around base64url, string building and the allocations they make, which the
tuning does not touch.

## Against the C twin

`--c --rounds 12` with a `--cpu x86-64-v3` build as `--binary nish-v3`, on a
4-core Intel Xeon @ 2.80GHz (AVX-512 and BMI2, no SHA-NI, so every column is
scalar). Medians in ns per compressed block:

| case | nish | nish-v3 | c-x86-64 | c-native | band |
| --- | ---: | ---: | ---: | ---: | ---: |
| sha256 64 B | 497.3 | 448.7 | 354.8 | 290.4 | ±5.8% |
| sha256 1 KiB | 348.9 | 286.1 | 329.3 | 264.2 | ±7.6% |
| sha256 1 MiB | 342.5 | 284.1 | 325.5 | 261.7 | ±1.2% |
| hmac-sha256 256 B | 446.7 | 363.7 | 317.4 | 286.3 | ±3.5% |

At 1 MiB, where compression is all the time goes on, Nish is 3 to 6 percent
behind C at the same CPU level (`nish` against `c-x86-64`) and 0 to 9 percent
behind it at x86-64-v3 (`nish-v3` against `c-native`), across three runs; the
fastest runs differ by 3.2 to 3.8 and 0.2 to 1.4 percent. Instructions in one
compression, from clang's assembly of each:

| build | instructions | `mov` | memory operands | branches | rotates |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nish, x86-64 | 3,450 | 1,230 | 428 | 6 | 576 |
| C, x86-64 | 3,341 | 1,145 | 349 | 1 | 576 |
| Nish, x86-64-v3 | 2,864 | 634 | 384 | 6 | 576 |
| C, native | 2,792 | 548 | 321 | 0 | 576 |

Every rotate is one instruction on both sides and Nish checks bounds once a
block; the extra memory operations are mostly the 64-word schedule against
C's 16-word ring. The rest of the gap on short messages is outside the
compression: a 256 B HMAC spends about 830 ns, nearly a quarter of it, on
allocating the state, schedule, pads and digests in `hmacSha256` and `Sha256`.
The largest lever on this machine is building with `--cpu x86-64-v3`, about
17 percent on every case, by BMI2's `rorx` and three-operand forms.
