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
node bench/runtime-copies/run.mjs --instructions --base-compiler build/nish-base  # pinned counts
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
| `json-strings` | A `JsonWriter` object of sixteen 24-byte string members (the mean; 17 to 29 bytes) | `nish_plain_base` in `http1-request json4k`, whose strings average 24 bytes |

Each case folds every byte it leaves behind, every iteration, into an FNV-1a
checksum: the whole destination of `small-copies`, the whole grown array of
`grow`, the whole JSON object of `json-strings`. The checksum of one iteration
is pinned in `run.mjs`, so a build that skips or misplaces work fails the pin.

## Pinned counts

Every instruction count in this README runs under the same pinned
environment, which `run.mjs --instructions` and `server.mjs --callgrind` set
themselves:

```bash
GLIBC_TUNABLES=glibc.cpu.hwcaps=-AVX_Fast_Unaligned_Load,-AVX2,-AVX512F,-AVX512VL,-ERMS,-FSRM,-SSSE3:glibc.cpu.x86_non_temporal_threshold=0x0fffffffffffffff:glibc.cpu.x86_rep_movsb_threshold=0x0fffffffffffffff:glibc.cpu.x86_rep_stosb_threshold=0x0fffffffffffffff
NISH_SIMD=base
NISH_SHA256=soft   # sha256-block and jwt-verify only
```

The tunables hold glibc to its SSE2 `memmove`, which callgrind then names
`memcpy@GLIBC_2.2.5` (in `memmove-vec-unaligned-erms.S`) for both `memcpy`
and `memmove`. Without them the count depends on the host's AVX2 and ERMS.
Builds are `--profile speed --cpu x86-64`. A count of a whole program is

```bash
valgrind --tool=cachegrind --cache-sim=no --cachegrind-out-file=out ./prog <args>
```

read from `out`'s `summary:` line. Shares and callers come from a `-g` build
of the same source (the speed build is stripped) under

```bash
valgrind --tool=callgrind --callgrind-out-file=cg ./prog <args>
callgrind_annotate --inclusive=yes cg     # inclusive shares
callgrind_annotate --tree=caller cg       # who calls memcpy@GLIBC_2.2.5
```

## Attribution

Pinned counts (above) of the nish build, after the cut, unless a row says
otherwise. "Copy share" is the program `Ir` spent inside the copy routines.
Callers come from `--tree=caller`. Sizes come from `copycount.c`, a counting
`LD_PRELOAD` shim for `memcpy` and `memmove` (see "`http1-server`" below for
how to run it); sizes do not depend on the pinning.

| Bench | Copy share of Ir | Largest callers (mean size) |
| --- | --- | --- |
| `http1-request browser 2000` | libc 3.88% | `http1HeadAppend`'s `memmove` 2.10% (73 bytes); `nish_main` 1.48%; `http1PutBytes` 0.27% (19 bytes) |
| `http1-request api 2000` | libc 2.94% | `http1HeadAppend` 1.33%; `nish_main` 1.26%; `http1PutBytes` 0.34% |
| `http1-request json4k 300` | `nish_plain_base` 2.51% (about 118 Ir a call); libc 1.35% | the JSON writer's string runs (24 bytes) |
| `sha256-block hs256 0 2000` | libc 1.66%; `nish_array_grow` 2.19% inclusive (1.21% in itself, 0.98% in its copies) | `base64urlEncode`, 21.09% inclusive |
| `jwt-verify` | under 1% | the same `base64urlEncode`, on the encode half |
| `pg-decode rows` | libc 1.15% (not pinned: #1191's branch, not on `main`) | `PgConnection.receive` (4517 bytes, already bulk); `nish_array_grow` |
| `pg-decode params` | libc 1.03% (not pinned, as above) | 12,800 copies of 1–64 bytes, through `copyBytes` and `String.fromBytes` |

Before the cut, `hs256`'s libc share was 5.35% (not pinned), most of it
`base64urlEncode`'s `join("")`: one call per one-byte part.

### `http1-server`

`bench/http1-server.ts` is the server `bench/http.mjs` drives with `wrk`.
`server.mjs` drives it without `wrk`, so it can run under callgrind or the
shim: one keep-alive connection, one request at a time, after which the server
returns from `main`. Per-request figures are a run of 4000 requests less a run
of 2000, over 2000, so start-up (about 1.24M `Ir`) cancels.

```bash
build/nish bench/http1-server.ts -o build/h1/ --link build/h1/h1 --profile speed -g
node bench/runtime-copies/server.mjs --callgrind cg.2000 build/h1/h1 plaintext 2000
node bench/runtime-copies/server.mjs --callgrind cg.4000 build/h1/h1 plaintext 4000
cc -O2 -shared -fPIC -o build/copycount.so bench/runtime-copies/copycount.c -ldl
node bench/runtime-copies/server.mjs --copycount build/copycount.so build/h1/h1 plaintext 2000
```

| Scenario | `Ir` a request | libc copy share |
| --- | ---: | ---: |
| `ping` | 6,271 | 2.15% |
| `query` | 7,629 | 2.02% |
| `body` | 10,711 | 1.91% |
| `plaintext` | 6,942 | 1.87% |
| `json` | 7,519 | 1.84% |
| `post-json` | 49,821 | 1.31% |
| `post-json-doc` | 69,053 | 2.01% |
| `deep-route` | 9,732 | 1.58% |

The copies that reach libc are small and few. A GET makes about ten a
request: five through `http1PutBytes` (12 bytes on average), two through
`http1HeadAppend` (18 to 40 bytes), and one each in `HttpHandler.drive`,
`Http1Connection.write` and `Http1Connection.feed` (the request bytes, 41 to
117). `post-json-doc` adds 50 through `JsonTokenizer.stringInto` (6 bytes on
average, almost all 8 or fewer) and 10 through `JsonDocument.writeAt` (4
bytes). The largest single copies are the 545-byte response write and the
649-byte request read of the POSTs. The JSON string scan (`nish_run_base`)
costs 1,833 `Ir` a request, 3.68% of `post-json` and 2.65% of
`post-json-doc`. No copy caller is a candidate of its own: the whole libc
share is 1.3–2.2% of a request, spread across five or more callers.

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

Pinned counts (above), base (`build/nish-base`, before the cut) against nish
(after). `runtime-copies` is `run.mjs --instructions`: one iteration, a run of
1000 less a run of 500, over 500. The others are whole runs with these
arguments.

| Program | base | nish | change |
| --- | ---: | ---: | ---: |
| `runtime-copies chars`, an iteration | 3,960 | 3,061 | **−22.7%** |
| `runtime-copies` `small-copies`, `grow`, `checked`, `json-strings` | | | 0.0% each |
| `sha256-block hs256 0 2000` | 114,440,131 | 110,216,035 | **−3.69%** |
| `sha256-block hmac 64 2000` | 39,551,209 | 39,551,113 | −0.00% |
| `jwt-verify verify 0 2000` | 49,798,339 | 49,765,603 | −0.07% |
| `jwt-verify verify 1 2000` | 143,550,546 | 143,437,362 | −0.08% |
| `http1-request browser 2000` | 24,816,468 | 24,813,306 | −0.01% |
| `http1-request api 2000` | 19,499,507 | 19,498,038 | −0.01% |
| `http1-request short 2000` | 8,039,735 | 8,039,638 | −0.00% |
| `http1-request json4k 300` | 22,578,556 | 22,578,459 | −0.00% |

`pg-decode` (#1191's branch, not pinned) moved −0.17% to −0.18% on `params`,
`pool` and `rows`. No program got more instructions.

`bench/instructions.json` (`node bench/run.mjs --instructions`, which pins the
same way) moved by about 0.000% on every program. The one exception is the
`Storage` program, +56 instructions, which is drift: `Storage` does not join
strings, and it moves by that much between runs of the same build.

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
outside the band. The other four cases do not use `join`, and their pinned
instruction counts are identical in both builds. Their wall times sometimes
strayed past a band, in either direction: `small-copies` −11.1% (run 2,
`x86-64-v3`, bands ±4.7% and ±4.2%), `checked` −6.0% (run 2, `x86-64`, bands
±1.4% and ±1.3%), `grow` +5.8% (run 2, `x86-64-v3`, base band ±5.6%) and
`json-strings` +13.3% (run 2, `x86-64-v3`, base band ±13.0%). With the same
instructions, that is code placement and machine noise, not a gain or a loss.
These wall times predate the checksum change in `main.ts`; the work timed is
the same apart from `json-strings`' longer values.

## What is left, ranked

These are estimates for the next copies-and-checks stage. Each one is a
pinned share of program `Ir` measured above, times the part of it the change
would remove; the derivation is in the row. None of them was built here.

| # | Candidate | Where the fix lives | Estimate |
| --- | --- | --- | --- |
| 1 | `base64urlEncode` writing a `u8[]` and ending in one `String.fromBytes`, instead of a `string` per character and a `join`. The function is still 21.1% of `hs256` `Ir` inclusive after the cut (16.4% in itself, the rest its runtime helpers), mostly allocating, pushing and joining the one-byte strings | `std/crypto/base64url.ts` (the crypto stage; read-only here). It must keep the encoder's constant-time rule: the character byte is stored, never used as an address | about −10 to −13% of `hs256`: the 21.1% less the 6-bit arithmetic and one store a byte that stay, taken as 40–50% of it. The encode half of `jwt-verify` gains the same per byte |
| 2 | `nish_plain_base` fused scan and copy: the JSON writer scans a string run for bytes to escape, then copies it. One pass would do both | `runtime/runtime-bytes.c` and `std/json.ts` | about −1 to −1.5% of `http1-request json4k` (2.48% today, at about 118 Ir a call) |
| 3 | `nish_array_grow` from a known final size: `hs256` grows arrays whose length is fixed by the input | the std modules that build them (`std/crypto`, `std/bytes.ts`), or a reserve hint in the emitter | at most −2.2% of `hs256`, its whole inclusive share (1.21% in itself, 0.98% in the copies it makes); one allocation stays, so less in practice. `pg-decode rows`: at most its unpinned 0.5% |
| 4 | `http1HeadAppend` building the head in place rather than `memmove`-ing it (73 bytes average) | `std/net/http1-codec.ts` (the net stage) | about −1% of `http1-request browser` and −0.7% of `api`: its `memmove` is 2.10% and 1.33%, and the bytes must still be written once, taken as half |
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
