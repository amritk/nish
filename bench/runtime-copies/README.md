# Copies and bounds checks

Where the stdlib benches spend their `memcpy`, `memmove` and
`nish_plain_base` calls, and their bounds checks. `main.ts` repeats each of
these patterns alone in a timed loop. A change to how the compiler or runtime
emits one then shows outside the noise band, which a whole request path would
hide. This README also records the one cut this stage shipped, `join`'s
one-byte part, and ranks what is left for the next stage.

```bash
npm run build
node bench/runtime-copies/run.mjs --validate                     # pinned checksums, no timing
node bench/runtime-copies/run.mjs --base-compiler build/nish-base # before (base) against after (nish)
node bench/runtime-copies/run.mjs --base-compiler build/nish-base --cpu x86-64-v3
node bench/runtime-copies/run.mjs --case chars --rounds 21
```

`--base-compiler` must be a copy of a compiler built before the change, placed
in `build/`, so that it reads this checkout's `std/` and `runtime/`.

The script prints the median of interleaved rounds with the min–max spread.
Each build is timed beside a byte-identical copy of itself (`nish-copy`,
`base-copy`). The copy's distance from its build is the noise band: a change
inside the band is noise.

## The cases

| Case | Pattern | Where it was found |
| --- | --- | --- |
| `chars` | Encodes 48 bytes base64url-style: one `String.fromCharCode` per output byte, pushed to a `string[]`, then `join("")` | `base64urlEncode` (`std/crypto/base64url.ts`), the largest copy caller in `sha256-block hs256` and `jwt-verify` |
| `small-copies` | `copyBytes` of 1 to 64 bytes between two arrays | `pg-decode params`: 12,800 copies of 1 to 64 bytes a run |
| `grow` | A `u8[]` grown from empty to 4096 bytes by `push` | `nish_array_grow` in `pg-decode rows` and `hs256` |
| `checked` | An indexed read-modify-write over a stride (`at = (at + 389) & 1023`) whose index the prover cannot bound | The checks that stay. It carries its one performance warning on purpose |
| `json-strings` | A `JsonWriter` object of sixteen short string members | `nish_plain_base` in `http1-request json4k` |

Each case folds every byte it produces into an FNV-1a checksum, pinned for one
iteration in `run.mjs`. A build that skips work fails the pin.

## Attribution

Measured with callgrind (`Ir`) on a build of `main` at `043f7d4d`, with
`--profile speed`, `--cpu x86-64` and `NISH_SHA256=soft`. The benches are from
their own branches: `http1-request` (#1187), `jwt-verify` (#1188) and
`pg-decode` (#1191). `sha256-block` is on `main`. "Copy share" is the program
`Ir` spent inside the copy routines. Callers and sizes come from callgrind's
call graph and a counting `LD_PRELOAD` shim.

| Bench | Copy share of Ir | Largest callers (mean size) |
| --- | --- | --- |
| `http1-request browser`, `api` | libc copies up to 2.63% | `http1HeadAppend`'s `memmove` (73 bytes); `http1PutBytes` (19 bytes) |
| `http1-request json4k` | `nish_plain_base` 2.48% (about 118 Ir a call); libc 0.85% | the JSON writer's string runs (24 bytes) |
| `pg-decode rows` | libc 1.15% | `PgConnection.receive` (4517 bytes, already bulk); `nish_array_grow` |
| `pg-decode params` | libc 1.03% | 12,800 copies of 1–64 bytes, through `copyBytes` and `String.fromBytes` |
| `sha256-block hs256` | `memcpy` 5.35%; `nish_array_grow` 1.14% | `base64urlEncode`'s `join("")`: one call per one-byte part |
| `jwt-verify` | under 1% | the same `join`, on the encode half |

**Do small fixed copies reach libc?** A copy whose length is a constant does
not. LLVM turns `llvm.memcpy` of a constant length into loads and stores, and
the separator copy of a constant `""` folds away. Small copies of a length
LLVM cannot see do reach libc. The hot case was `join`'s part copy: 640,013
calls of one byte for 10,000 iterations of `chars`, 16 Ir each in libc
alone: 25% of the case. `copyBytes` of 1–64 bytes and the
`http1` copies also reach libc, but they cost less and inlining them did not
pay (see "Tried and dropped").

## The cut: `join` stores a one-byte part

`emitJoin` (`src/emit-arrays.ts`) used to copy each part with `llvm.memcpy` of
the part's length. That length is a load, so LLVM emitted a libc call for
every part, including the one-byte strings a byte-at-a-time encoder pushes.
The copy loop now tests `len == 1` and does one `load i8` and one `store i8`
in that case. Every other length, the empty part included, is the same
`memcpy` as before. The store lands inside the total the first pass summed,
so no byte is written past the result. Nothing is read through the byte, so a
secret character is stored, never used as an address
(`docs/security/codegen.md`, "Properties verified").

### Instruction counts

Callgrind `Ir`, base (before the cut) against nish (after), `--cpu x86-64`:

| Program | base | nish | change |
| --- | ---: | ---: | ---: |
| `runtime-copies chars`, 10,000 iterations | 40,483,806 | 30,953,678 | **−23.5%** |
| `sha256-block hs256 0 2000` | 113,762,105 | 108,933,993 | **−4.24%** |
| `jwt-verify verify 0 2000` | 48,993,875 | 48,956,451 | −0.08% |
| `jwt-verify verify 1 2000` | 142,259,021 | 142,129,661 | −0.09% |
| `pg-decode params 64 200` | 19,374,998 | 19,339,698 | −0.18% |
| `pg-decode pool 64 200` | 21,022,447 | 20,987,179 | −0.17% |
| `pg-decode rows 64 200` | 20,282,152 | 20,246,898 | −0.17% |
| `http1-request browser 2000` | 26,113,568 | 26,109,900 | −0.01% |
| `http1-request api 2000` | 18,880,794 | 18,877,592 | −0.02% |
| `http1-request short 2000` | 9,924,917 | 9,924,804 | −0.00% |
| `http1-request json4k 300` | 22,820,501 | 22,820,388 | −0.00% |
| `sha256-block hmac 64 2000` | 39,413,872 | 39,413,760 | −0.00% |

No program got more instructions. The `bench/instructions.json` deltas across
its programs are in the pull request that landed this.

### Wall time

Four runs, 16 interleaved rounds of four columns each. Medians, ns per
iteration of `chars`, with the min–max spread.

CPU: Intel Xeon Processor @ 2.10GHz, 4 cores, with avx2, bmi2, avx512f and
sha_ni. Ubuntu clang 18, `--profile speed`.

| Run | `--cpu` | nish | base | base vs nish | band (nish-copy) |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | `x86-64` | 299.4 (227.1–420.7) | 381.5 (292.5–541.3) | +27.4% | ±4.7% |
| 2 | `x86-64` | 279.8 (237.3–368.4) | 380.4 (307.4–453.8) | +35.9% | ±2.2% |
| 1 | `x86-64-v3` | 283.1 (265.6–336.3) | 393.3 (335.3–497.6) | +38.9% | ±5.1% |
| 2 | `x86-64-v3` | 285.9 (216.3–398.3) | 394.3 (319.8–457.0) | +37.9% | ±0.6% |

The base build is 27–39% slower in every run, on both CPUs, and always
outside the band. The other four cases do not use `join`, and none of them
moved the same way twice. Where base strayed past a band, it did so once and
in either direction: `small-copies` −11.1% (run 2, `x86-64-v3`, bands ±4.7%
and ±4.2%), `checked` −6.0% (run 2, `x86-64`, bands ±1.4% and ±1.3%), `grow`
+5.8% (run 2, `x86-64-v3`, base band ±5.6%) and `json-strings` +13.3% (run 2,
`x86-64-v3`, base band ±13.0%). Their code did not change. That is code
placement, not a gain or a loss.

## What is left, ranked

These are estimates for the next copies-and-checks stage. Each one is a share
of program `Ir` measured above, times what the change would plausibly remove.
None of them was built here.

| # | Candidate | Where the fix lives | Estimate |
| --- | --- | --- | --- |
| 1 | `base64urlEncode` writing a `u8[]` and ending in one `String.fromBytes`, instead of a `string` per character and a `join`. The function is still 19% of `hs256` `Ir` after the cut (`base64urlEncode` 16.6% plus its runtime helpers 2.5%), mostly allocating and storing the one-byte strings | `std/crypto/base64url.ts` (the crypto stage; read-only here). It must keep the encoder's constant-time rule: the character byte is stored, never used as an address | about −10 to −13% of `hs256`, and the encode half of `jwt-verify` |
| 2 | `nish_plain_base` fused scan and copy: the JSON writer scans a string run for bytes to escape, then copies it. One pass would do both | `runtime/runtime-bytes.c` and `std/json.ts` | about −1 to −1.5% of `http1-request json4k` (2.48% today, at about 118 Ir a call) |
| 3 | `nish_array_grow` from a known final size: `hs256` grows arrays whose length is fixed by the input | the std modules that build them (`std/crypto`, `std/bytes.ts`), or a reserve hint in the emitter | up to −1.2% of `hs256`, −0.5% of `pg-decode rows` |
| 4 | `http1HeadAppend` building the head in place rather than `memmove`-ing it (73 bytes average) | `std/net/http1.ts` (the net stage) | about −1% of `http1-request browser` and `api` |
| 5 | `join`'s separator copy of one byte (`join(",")`): the same test as the cut, on the separator | `src/emit-arrays.ts` | about 16 Ir a part, only where the separator is one byte and not constant. No measured program has one hot |
| 6 | `pg-decode`'s `receive` copies | `std/net/postgres` | none: they average 4.5 KB, already at libc's bulk rate. Avoiding them needs a zero-copy read, which is a design change |

## Tried and dropped

- **Inlining small copies.** This turned `llvm.memcpy` of a non-constant
  length of 64 bytes or fewer into an inline loop in `emitCopyBytes` and the
  string builders. `Ir` moved −0.16% to −0.67% on `http1-request`, +0.5% on
  `pg-decode` and +0.23% on `hs256`. Wall time did not move outside the band
  on two runs. libc's small-copy path is already a few instructions after the
  PLT, so dropped.
- **`String.fromCharCode` from a constant table.** The 256 one-byte strings
  were made constants (`@nish.chars`), so `fromCharCode` allocated nothing.
  `chars` `Ir` fell 9.3% (40.48M to 36.73M per 10,000 iterations), and wall
  time improved 16.6% and 17.9% on `x86-64` and 32.1% and 32.9% on `x86-64-v3`,
  against bands of at most 6.7%. `hs256` `Ir` fell 1.56%. **Dropped for
  security.** The table makes the character byte a load address. In
  `base64urlEncode` that byte comes from a secret (a signature or a key), so
  the table opens a cache-timing channel. That breaks the encoder's
  constant-time rule in `docs/security/crypto-k1.md`: the byte is stored,
  never used as an address. A version that keeps the speed must not index by
  the byte. Candidate 1 above does that by writing the bytes into a `u8[]`.
