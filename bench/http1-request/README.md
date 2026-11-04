# The HTTP/1.1 request path

`main.ts` drives one keep-alive `Http1Connection` the way `Http1Server` does,
without sockets: it feeds a request's reads, takes each request to its end
with `next`, does what a router does (`methodIs` for GET, POST, PUT and
DELETE, `headerIndex("authorization")`), answers through `respond` with a JSON
body written by `JsonWriter`, and drains the output as `send` and `settle`
would. `run.mjs` builds it, checks every case's pinned checksum, and times the
cases in interleaved rounds.

```sh
npm run build
node bench/http1-request/run.mjs --validate          # checksums only
node bench/http1-request/run.mjs                     # x86-64, 11 rounds
node bench/http1-request/run.mjs --cpu x86-64-v3
node bench/http1-request/run.mjs --base 1d92417e     # adds a before column
```

| Case | What is fed | Answer |
| --- | --- | --- |
| `browser` | a 700-byte browser GET: Accept, Accept-Language, User-Agent, Cookie, an HS256 Bearer token | 2 JSON fields |
| `api` | a 290-byte POST with a Bearer token and a 60-byte JSON body | 2 JSON fields |
| `short` | `GET / HTTP/1.1` and `Host`, 37 bytes | 2 JSON fields |
| `pipelined` | the `api` POST and the `browser` GET in one read | both |
| `split` | the `browser` GET in two reads, cut inside its Cookie line | 2 JSON fields |
| `json1k` … `json40k` | the `short` GET | that much JSON |

The checksum folds every response's bytes in the first iteration and every
request's length, status, method, field count and body in all of them, so two
builds that parse or answer differently disagree on it. `nish-copy` is a
byte-identical copy of the build, timed as its own column: the spread between
it and `nish` is the noise band. A gain counts only when it repeats outside
the band on two separate runs.

## Where a request's instructions go

callgrind, `browser`, 10,000 iterations, per request, exclusive, on `main` at
`1d92417e` (the before) and with this directory's cut (the after):

| Function | Before | After |
| --- | ---: | ---: |
| `http1Next` (the request line, field lines, name lowercasing and token check, the end of the head) | 5,426 | 5,426 |
| `http1TakeLine` (the line scan) | 2,649 | 2,649 |
| `http1WriteResponseHead` | 1,178 | 575 |
| `http1PutText` | 501 | 41 |
| `http1HeadAppend` and its `copyBytes` | 630 | 630 |
| libc `memcpy` (the head copy, the output, the JSON body) | 339 | 339 |
| `JsonWriter` | 382 | 382 |
| `http1PutStatusLine`, `http1PutFixed` | — | 117 |
| everything else | 1,837 | 1,837 |
| **Total** | **12,942** | **11,996** |

Every case saves the same 946 instructions a request, since every response
head is the same shape: `short` 4,857 → 3,911 (−19.5%), `api` 9,328 → 8,382
(−10.1%), `browser` 12,942 → 11,996 (−7.3%).

## What the -O2 code does

Read from `--profile speed -g` builds with `callgrind_annotate --auto=yes`
and `objdump -d`.

- **`http1Next`** spends most of its 5,400 on the field lines: each name is
  lowercased and token-checked a byte at a time (the two 64-bit tchar masks,
  a shift and a test per byte), then its OWS is trimmed a byte at a time from
  each end, and at the end of the head each name is compared, in `http1EndOfHead`, with
  the five names the parser reads (`host`, `content-length`,
  `transfer-encoding`, `connection`, `upgrade`) through `http1HeadIs`, a
  length test and then a byte loop. The
  request line's target is walked a byte at a time for its query.
- **`http1TakeLine`** already jumps to the next control byte sixteen at a
  time; what is left is the per-line call, the CRLF test and the tally.
- **`http1HeadAppend`** copies the whole head once into the held head buffer
  (one `copyBytes`, a `memmove`) — about 900 instructions on `browser` with
  the copy's own setup.
- **`methodIs`** compares the method's bytes with the word each time it is
  asked; a router asking four times pays four compares.
- **`inputRoom`, `feed`, `park`, `respond`** are small: a window check, a
  `copyBytes`, a reset. None is above 1% of a request.
- **`http1WriteResponseHead`** was the largest cost a request could lose
  without touching the parser's grammar. Each constant (`HTTP/1.1 `, `Date: `,
  `Content-Length: `, `Connection: `) went through `http1PutText`, whose loop
  keeps a bounds check on every byte (`at + k < out.length` in the loop
  condition, then `cmp`/`jae` before each store) and reads each byte back out
  of the string; and each field value and the date were checked a byte at a
  time with `http1IsValueByte`. Straight-line constant stores under one
  guard do not help: the checker cannot carry `at <= out.length - k` to
  `out[at + j]`, so every store keeps its check and LLVM cannot merge them.

## The cut

- **Field text sixteen bytes at a time.** `http1BytesAreFieldText` loads
  sixteen bytes, compares them with 32, 9 and 127 in three vector compares,
  and tests the mask once; the last vector ends at the last byte and overlaps
  the one before. Under sixteen bytes it is the old byte loop.
- **One store for each constant.** The status line (`HTTP/1.1 `, three digits
  and a space, the digits put in their lanes with `replace`) and the
  `Date: `, `Content-Length: ` and `Connection: ` names are each one
  sixteen-byte `store` of a constant vector, which has one bounds check.
  The lanes past the text are written over by the head's next bytes: the store
  is taken only where `at + 16` stays inside the head `need` counted, every
  byte of which is written after. Elsewhere the old byte path runs.
- **`http1PutText` tests once.** When the text fits, which every caller makes
  sure of, the loop has no bounds check.

Tests: `tests/link/net_http1/checks.ts` (and its `_f64` twin) — the smallest
head (17 bytes) in a buffer of 17, of 16 (`HTTP1_NO_ROOM`) and in a larger one
whose bytes after the head are untouched; a head with every fixed field at an
offset, untouched either side, exactly fitting and one byte short; values of
1, 15, 16, 17, 31, 32 and 33 bytes with HTAB and obs-text written, and NUL,
LF, CR, 0x1f and DEL at the first byte, bytes 14, 15, 16 and the last
refused.

## Measured

Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores; avx2, bmi2, sha_ni and
avx512f all present. `--profile speed`, 16 rounds of 4 columns, against
`--base 1d92417e`. Median ns an iteration (min–max); "band" is `nish-copy`
against `nish`, the same bytes, so anything inside it is noise.

| Case | Run | `--cpu` | nish | base | base vs nish | band |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `api` | 1 | x86-64 | 628.3 (598.8–1026.7) | 745.1 (671.0–1121.5) | +18.6% | ±2.8% |
| `api` | 2 | x86-64 | 630.1 (593.9–1112.8) | 735.8 (674.8–1352.6) | +16.8% | ±1.3% |
| `api` | 1 | x86-64-v3 | 819.1 (730.5–1425.8) | 926.6 (780.5–2399.5) | +13.1% | ±1.7% |
| `api` | 2 | x86-64-v3 | 1023.7 (735.7–1404.3) | 936.5 (798.9–1521.5) | −8.5% | ±18.9% |
| `short` | 1 | x86-64 | 320.2 (286.5–615.2) | 402.5 (355.5–724.8) | +25.7% | ±7.1% |
| `short` | 2 | x86-64 | 357.8 (284.9–650.7) | 396.3 (361.4–488.5) | +10.8% | ±11.1% |
| `short` | 1 | x86-64-v3 | 383.0 (318.4–656.4) | 534.3 (378.1–794.6) | +39.5% | ±11.6% |
| `short` | 2 | x86-64-v3 | 349.7 (297.2–576.9) | 441.1 (374.0–767.5) | +26.1% | ±19.5% |
| `browser` | 1 | x86-64 | 967.9 (854.8–1406.9) | 974.6 (879.5–1313.2) | +0.7% | ±6.7% |
| `browser` | 2 | x86-64 | 915.3 (820.3–1098.1) | 1060.0 (886.3–1699.0) | +15.8% | ±0.6% |

Only `api` at x86-64 repeats outside the band on both runs: 16.8% to 18.6%
faster, against a band of 1.3% to 2.8%. `short` is faster on all four runs,
but on three of them the band is as wide as the gain. Elsewhere the shared
cloud host's noise (bands up to ±21%) hides a 7% to 10% instruction cut.
`browser` gains on one run and not the other, and the `json*` cases, where
the head is a small share of each request, show no change. The callgrind
count is the repeatable figure: 946 instructions fewer a request on every
case, at both `--cpu` levels.

## Candidates for the next cut

Ranked by the instructions a `browser` request would save, estimated from
the callgrind lines above. Stage http1-path-2 takes the first.

| # | Candidate | Estimate | Note |
| --- | --- | ---: | --- |
| 1 | Lowercase a field name and check it is a token sixteen bytes at a time (SWAR or `nish:simd`), instead of a byte at a time | ~1,460 | in `http1Next`; the name is short, so the tail matters |
| 2 | Hold the head without copying it whole in `http1HeadAppend` when it is already contiguous in the input | ~900 | the copy exists for H1-5; needs the input buffer kept until the response is done, a security-record change |
| 3 | Trim OWS and walk the target with a vector scan | ~600 | `http1Next` |
| 4 | Compare a name with the six the parser reads by length first and one 8- or 16-byte compare (`http1HeadIs`, `http1EndOfHead`) | ~510 | |
| 5 | Record the method once as a code when the request line is read, so `methodIs` is one compare | ~100 a call | grows with the router's calls |
| 6 | The remaining head-writer stores: CRLF as one 2-byte store, `http1PutBytes` and `http1PutDecimal` | ~200 | |
| — | `JsonWriter.i32` and `jsonWriterPutString` | ~380 | `std/json.ts`, outside this bench's files; for the copies-checks stage |

## Tried and dropped

| Idea | Measured | Why dropped |
| --- | --- | --- |
| Constant text written as straight-line `out[at + j] = c` stores under one `at <= out.length - k` guard | −883 a request, 63 fewer than the vector store | every store keeps its bounds check (see above); superseded by the sixteen-byte store |
