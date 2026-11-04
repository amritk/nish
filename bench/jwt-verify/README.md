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

- **148 B:** a 50-byte claims body (`sub`, `iat`, `exp`) and a 104-byte
  signing input, the size the server profile names.
- **507 B:** 319 bytes of claims (`iss`, `aud`, `jti` and more) and a 463-byte
  signing input.

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

**The band** is `nish-copy` against `nish`: the same binary, so any
difference between them is noise. A change counts only outside it, and only
when it repeats on a second run.

Every column must print the case's pinned checksum.

`--instructions` counts instructions under callgrind: (a 12,000-iteration run
− a 2,000-iteration one) / 10,000.

## Last measured

Measured on an Intel Xeon @ 2.10 GHz (4 threads; avx2, bmi2, sha_ni and
avx512f all present), `--profile speed`, with `--base 1d92417`: main before
the decoder was rewritten. There were two runs, A and B. Each cell gives the
median ns a token, with the band in brackets:

| case | nish A | base A | nish B | base B | instructions nish / v3 / base |
| --- | --- | --- | --- | --- | --- |
| decode-std 148 B | 349 (±4.5%) | 662 (+89.9%) | 363 (±1.8%) | 735 (+102.3%) | 4,428 / 3,780 / 9,295 |
| decode-std 507 B | 1,101 (±8.1%) | 2,374 (+115.5%) | 1,405 (±15.2%) | 3,011 (+114.2%) | 13,595 / 11,096 / 31,050 |
| decode-server 148 B | 403 (±6.1%) | 395 | 429 (±4.6%) | 427 | 5,715 / 5,370 / 5,715 |
| decode-server 507 B | 1,442 (±2.5%) | 1,553 | 1,481 (±0.5%) | 1,447 | 18,983 / 17,689 / 18,983 |
| verify 148 B | 1,242 (±3.7%) | 1,353 | 1,329 (±0.5%) | 1,401 | 24,146 / 21,883 / 24,146 |
| verify 507 B | 3,486 (±11.3%) | 3,816 | 3,985 (±9.2%) | 4,044 | 70,333 / 63,605 / 70,333 |
| midstate 104 B | 401 (±3.4%) | 413 | | | 12,912 / 10,835 / 12,912 |
| midstate 463 B | 735 (±1.9%) | 743 | | | 33,396 / 27,803 / 33,396 |

What the numbers say:

- **`base64urlDecode` takes half the time and 52–56% fewer instructions**, on
  both runs and both shapes. It is now 13–24% under the server's if-chain
  decoder, though it still allocates its output.
- **`verify` does not move, and should not.** `JwtVerifier` decodes with its
  own `jwtDecode`, whose instruction count is the same on both sides.
- **Without SHA-NI, `verify` 148 B costs 35–56% more**, and `midstate` 104 B
  2.3× as much: `NISH_SHA256=soft`, the Xeon 8260's path. `--cpu x86-64-v3`
  takes 1–15% off the soft path.
- Under callgrind the soft and SHA-NI columns count the same, so read the
  soft path's cost from the timings alone.

## Tried and dropped

| idea | measured | why dropped |
| --- | --- | --- |
| A `base64urlDecodeInto(src, off, len, out)` into a caller-owned buffer in std | not built | Only `JwtVerifier`'s `jwtDecode` would call it: `std/base64.ts` encodes only. The rule is that both would, so it stays out. |
| Removing the `sadd.with.overflow` checks on `j` in the group loop | not built | They are two predictable branches on a public counter a group, beside 4 vectorised sextets. The cut already halves the time. |
