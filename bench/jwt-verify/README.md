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

See the PR that added this bench (#1185's base64url stage) for the tables.
The headline, on an Intel Xeon @ 2.10 GHz (avx2, bmi2, sha_ni, avx512f), at
the median ns a token:

MEASURED

## Tried and dropped

| idea | why dropped |
| --- | --- |
DROPPED
