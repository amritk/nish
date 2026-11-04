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

- **148 B:** the token the server issues: a 50-byte claims body (`sub`,
  `iat`, `exp`) under `{"alg":"HS256","typ":"JWT"}`, and a 104-byte signing
  input, which `main.ts` asserts. That input is two blocks after the ipad
  midstate, so a verify takes three compressions with the outer block. A
  `role` claim does not fit in 104 B. `"role":"user"` makes the input 123 B,
  which needs a fourth compression.
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
the decoder was rewritten. Runs A and B are full runs of 12 rounds (the
hashing cases) or 16 (the decode cases). Each cell is the median ns a token.
`nish` carries that case's band in brackets, and `base` its distance from
`nish`:

| case | nish A | base A | nish B | base B | instructions nish / v3 / base |
| --- | --- | --- | --- | --- | --- |
| decode-std 148 B | 426 (±0.4%) | 701 (+64.7%) | 367 (±6.1%) | 777 (+111.6%) | 4,428 / 3,780 / 9,295 |
| decode-std 507 B | 1,166 (±0.3%) | 2,446 (+109.7%) | 1,151 (±26.2%) | 2,637 (+129.2%) | 13,595 / 11,096 / 31,050 |
| decode-server 148 B | 414 (±3.0%) | 396 (−4.2%) | 425 (±7.1%) | 404 (−4.9%) | 5,421 / 5,075 / 5,421 |
| decode-server 507 B | 1,364 (±0.6%) | 1,299 (−4.8%) | 1,420 (±22.5%) | 1,508 (+6.2%) | 17,971 / 16,676 / 17,971 |
| verify 148 B | 1,282 (±4.8%) | 1,333 (+3.9%) | 1,380 (±5.7%) | 1,411 (+2.3%) | 24,317 / 21,966 / 24,317 |
| verify 507 B | 4,667 (±17.6%) | 3,985 (−14.6%) | 3,668 (±1.7%) | 3,753 (+2.3%) | 70,504 / 63,688 / 70,504 |
| midstate 104 B | 424 (±4.4%) | 425 (+0.3%) | 473 (±4.8%) | 471 (−0.3%) | 12,910 / 10,836 / 12,910 |
| midstate 463 B | 734 (±2.7%) | 761 (+3.8%) | 709 (±3.0%) | 737 (+4.0%) | 33,394 / 27,804 / 33,394 |

Run B's bands on the 507 B decode cases were ±22–26%, too wide to settle the
std-against-server question. Run C repeated only those cases
(`--only decode-s`):

| case | nish C | base C |
| --- | --- | --- |
| decode-std 148 B | 390 (±3.3%) | 775 (+98.7%) |
| decode-std 507 B | 1,113 (±0.9%) | 2,332 (+109.4%) |
| decode-server 148 B | 401 (±7.6%) | 385 (−4.0%) |
| decode-server 507 B | 1,422 (±1.5%) | 1,424 (+0.1%) |

The hashing cases under `NISH_SHA256=soft`, the portable SHA-256 path. `nish
soft` is given against `nish`, and `v3 soft` against `nish soft`, both from
the same run:

| case | nish soft A | v3 soft A | nish soft B | v3 soft B |
| --- | --- | --- | --- | --- |
| verify 148 B | 1,840 (+43.5%) | 1,962 (+6.7%) | 2,253 (+63.3%) | 1,941 (−13.8%) |
| verify 507 B | 6,015 (+28.9%) | 5,251 (−12.7%) | 5,857 (+59.7%) | 5,650 (−3.5%) |
| midstate 104 B | 1,010 (+138.2%) | 1,041 (+3.1%) | 1,042 (+120.5%) | 906 (−13.0%) |
| midstate 463 B | 2,911 (+296.8%) | 2,358 (−19.0%) | 2,640 (+272.7%) | 2,302 (−12.8%) |

What the numbers say:

- **`base64urlDecode` takes 39–56% less time and 52–56% fewer
  instructions**, on every run and both shapes, each far outside its band.
- **Against the server's if-chain decoder, std is faster only on the long
  token.** At 507 B it is 10% (A) and 22% (C) under `decode-server`, outside
  both columns' bands. Each figure is taken against the slower of `nish` and
  `base`'s server cell, which run identical code. It counts 24% fewer
  instructions. At 148 B there is no difference: +3% (A), −14% (B) and −3% (C),
  with no sign that repeats outside the band, although std counts 18% fewer
  instructions. The likely cause is the output std allocates on each call,
  which the server's decoder does not. No column isolates that cost.
- **`verify` does not move, and should not.** `JwtVerifier` decodes with its
  own `jwtDecode`, whose instruction count is the same on both sides. `base`
  sits just outside the band on verify 507 B in run B (+2.3% against ±1.7%),
  with that same count. The band covers only byte-identical binaries, so
  this conclusion rests on the instruction count, not the timings.
- **Without SHA-NI, `verify` costs 29–63% more**, `midstate` 104 B 2.2–2.4×
  as much and `midstate` 463 B 3.7–4.0×, outside the band on both runs.
- **`--cpu x86-64-v3` takes 13–19% off the soft path only on `midstate`
  463 B**, outside the band on both runs. Elsewhere its timings change sign
  between the runs. It counts 9.7% fewer instructions on `verify` and 16–17%
  fewer on `midstate`.
- Under callgrind, the soft and SHA-NI columns count the same, so read the
  soft path's cost from the timings alone.

## Not pursued

Ideas weighed and left unbuilt, so they carry no measurement:

| idea | why not |
| --- | --- |
| A `base64urlDecodeInto(src, off, len, out)` into a caller-owned buffer in std | Only `JwtVerifier`'s `jwtDecode` would call it: `std/base64.ts` encodes only. The rule is that both would, so it stays out. |
| Removing the `sadd.with.overflow` checks on `j` in the group loop | They are two predictable branches on a public counter a group, beside 4 vectorised sextets. The cut already halves the time. |
