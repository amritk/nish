# jwt-verify

What an HS256 token costs to verify, and where the base64url decode inside
that goes. `main.ts` says what each kernel times. In short:

| kernel | times |
| --- | --- |
| `verify` | `JwtVerifier.verify` on a whole token: header and signature decoded, the HMAC over the signing input, the tag compared with `timingSafeEqualAt`, the claims decoded and checked |
| `midstate` | the HMAC alone over the signing input, from a precomputed key midstate (`hmacCopySha256`), as a server that keys once does it |
| `decode-server` | the three segments decoded by an if-chain sextet, one character at a time, into buffers the caller owns: the decoder a JWT server ships |
| `decode-std` | the same segments, each already a string, decoded by `nish/crypto/base64url`'s `base64urlDecode` |
| `decode-old` | the same, decoded by `./old.ts`: `base64urlDecode` as it was on main before this bench (`freeze.mjs` writes it) |

There are two token shapes:

- **167 B:** a 64-byte claims body (`sub`, `role`, `iat`, `exp`), as a server
  issues it, and a 123-byte signing input.
- **507 B:** 319 bytes of claims (`iss`, `aud`, `jti` and more) and a 463-byte
  signing input: the long case, a little over the ~300 B of claims the plan
  names.

## Running it

```
npm run build
node bench/jwt-verify/run.mjs --validate      # checksums only, no timing
node bench/jwt-verify/run.mjs --base <rev>    # a full run, with a before column
node bench/jwt-verify/run.mjs --only decode --instructions
```

Each case calibrates one iteration count to about 200 ms a run. Every column
runs that count in at least 11 interleaved rounds, and the median is reported.

The columns are:

- `nish`, the baseline `--profile speed` build;
- `nish-copy`, the same bytes run again;
- `v3`, the `--cpu x86-64-v3` build;
- `base`, `--base`'s build;
- one column per `--binary`.

A hashing case adds `nish soft` and `v3 soft`, the same builds under
`NISH_SHA256=soft`. That is the portable SHA-256 that a CPU without SHA-NI
runs, such as the Xeon Platinum 8260.

**The band** is `nish-copy` against `nish`: the same bytes, so any
difference between them is noise. It covers only byte-identical binaries. Two
builds that differ only in where their code lands can sit further apart than
the band (the `base` column does, on `verify`, with the same instruction
count), so a claim that a column did *not* move rests on its instruction
count. A change counts only outside the band, and only when it repeats on a
second run.

Every column must print the case's pinned checksum.

`--instructions` counts instructions under callgrind: (a 12,000-iteration run
− a 2,000-iteration one) / 10,000.

## Last measured

Measured on an Intel Xeon @ 2.10 GHz (4 threads; avx2, bmi2, sha_ni and
avx512f all present), `--profile speed`, with `--base 1d92417`: main before
the decoder was rewritten. There were two runs, A and B, each of 12 rounds
(the hashing cases) or 16 (the decode cases). Each cell gives the median ns a
token. `nish` carries that case's band in brackets, and `base` its distance
from `nish`:

| case | nish A | base A | nish B | base B | instructions nish / v3 / base |
| --- | --- | --- | --- | --- | --- |
| decode-std 167 B | 477 (±13.9%) | 885 (+85.5%) | 448 (±6.9%) | 825 (+84.3%) | 4,879 / 4,121 / 10,434 |
| decode-std 507 B | 1,190 (±3.2%) | 2,467 (+107.4%) | 1,191 (±7.2%) | 2,269 (+90.4%) | 13,595 / 11,096 / 31,050 |
| decode-server 167 B | 453 (±1.3%) | 466 (+2.7%) | 479 (±20.9%) | 484 (+1.0%) | 6,097 / 5,694 / 6,097 |
| decode-server 507 B | 1,659 (±10.0%) | 1,347 (−18.8%) | 1,398 (±2.1%) | 1,309 (−6.4%) | 17,970 / 16,676 / 17,970 |
| verify 167 B | 1,504 (±4.6%) | 1,473 (−2.1%) | 1,544 (±6.8%) | 1,603 (+3.8%) | 29,309 / 26,402 / 29,309 |
| verify 507 B | 3,771 (±1.8%) | 4,001 (+6.1%) | 3,913 (±17.3%) | 4,071 (+4.1%) | 70,333 / 63,605 / 70,333 |
| midstate 123 B | 517 (±1.6%) | 532 (+3.0%) | 533 (±4.9%) | 541 (+1.5%) | 16,643 / 13,980 / 16,643 |
| midstate 463 B | 730 (±3.0%) | 733 (+0.4%) | 817 (±3.3%) | 844 (+3.2%) | 33,396 / 27,803 / 33,396 |

The hashing cases under `NISH_SHA256=soft`, the portable SHA-256 path, each
against `nish` on the same run:

| case | nish soft A | v3 soft A | nish soft B | v3 soft B |
| --- | --- | --- | --- | --- |
| verify 167 B | 2,368 (+57.4%) | 2,221 (−6.2% of soft) | 2,309 (+49.6%) | 2,625 (+13.7% of soft) |
| verify 507 B | 5,577 (+47.9%) | 5,288 (−5.2% of soft) | 5,530 (+41.3%) | 6,024 (+8.9% of soft) |
| midstate 123 B | 1,343 (+159.9%) | 1,255 (−6.5% of soft) | 1,404 (+163.3%) | 1,471 (+4.8% of soft) |
| midstate 463 B | 2,499 (+242.3%) | 2,454 (−1.8% of soft) | 3,320 (+306.4%) | 2,913 (−12.3% of soft) |

What the numbers say:

- **`base64urlDecode` takes 46–52% less time and 52–56% fewer
  instructions**, on both runs and both shapes, each far outside its band.
- **Against the server's if-chain decoder, it is faster only on the long
  token.** At 507 B it is 28% (A) and 15% (B) under `decode-server`, outside
  both columns' bands on both runs. At 167 B it is +5% (A) and −7% (B), inside
  the band, although it counts 20% fewer instructions: on a short token the
  output it allocates costs what the cheaper loop saves.
- **`verify` does not move, and should not.** `JwtVerifier` decodes with its
  own `jwtDecode`, whose instruction count is the same on both sides. `base`
  sits outside the band on verify 507 B in run A (+6.1% against ±1.8%) with
  that same count: the band covers only byte-identical binaries, so this
  conclusion rests on the instruction count, not the timings.
- **Without SHA-NI, `verify` costs 41–57% more** and `midstate` 2.6–4.1× as
  much, outside the band on both runs.
- **`--cpu x86-64-v3` shows no repeatable gain on the soft path.** Its
  timings change sign between the runs; it counts 10–16% fewer instructions.
- Under callgrind the soft and SHA-NI columns count the same, so read the
  soft path's cost from the timings alone.

## Not pursued

Ideas weighed and left unbuilt, so they carry no measurement:

| idea | why not |
| --- | --- |
| A `base64urlDecodeInto(src, off, len, out)` into a caller-owned buffer in std | Only `JwtVerifier`'s `jwtDecode` would call it: `std/base64.ts` encodes only. The rule is that both would, so it stays out. |
| Removing the `sadd.with.overflow` checks on `j` in the group loop | They are two predictable branches on a public counter a group, beside 4 vectorised sextets. The cut already halves the time. |
