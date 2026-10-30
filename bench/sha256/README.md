# bench/sha256

The portable SHA-256 path of `nish/crypto/sha256` in nanoseconds an operation:
the one-shot `sha256` on 64 B, 1 KiB and 1 MiB, and an HS256 JWT signed and
verified (`nish/crypto/base64url` and `hmacSha256` / `hmacSha256Verify`).
`main.ts` says what each case times; `run.mjs` builds it with
`--profile speed` and times it against a byte-identical copy, the noise band,
and any other build passed as `--binary`.

```sh
npm run build && node bench/sha256/run.mjs [--rounds N] [--binary name=<path>]
```

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
