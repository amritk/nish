# The HTTP/1.1 request path

`main.ts` drives one keep-alive `Http1Connection` the way `Http1Server` does,
without sockets: it feeds a request's reads, takes each request to its end
with `next`, does what a router does (`methodIs` for GET, POST, PUT and
DELETE, `headerIndex("authorization")`), answers through `respond` with a JSON
body written by `JsonWriter`, and drains the output as `send` and `settle`
would. `run.mjs` builds it, checks every case's pinned checksum, and times the
cases in interleaved rounds, or counts their instructions.

```sh
npm run build
node bench/http1-request/run.mjs --validate                       # checksums only
node bench/http1-request/run.mjs                                  # x86-64, 11 rounds
node bench/http1-request/run.mjs --cpu x86-64-v3
node bench/http1-request/run.mjs --base 1d92417e                  # adds a before column
node bench/http1-request/run.mjs --instructions --base 1d92417e   # cachegrind counts
```

| Case | What is fed | Answer |
| --- | --- | --- |
| `browser` | a 756-byte browser GET: Accept, Accept-Language, User-Agent, Cookie, and a 251-byte HS256 JWT as a Bearer token | 2 JSON fields |
| `api` | a POST with a 338-byte head, a 148-byte HS256 JWT (`sub`, `iat`, `exp`) as a Bearer token, and a 61-byte JSON body | 2 JSON fields |
| `short` | `GET / HTTP/1.1` and `Host`, 37 bytes | 2 JSON fields |
| `pipelined` | the `api` POST and the `browser` GET in one read | both |
| `split` | the `browser` GET in two reads, cut inside its Cookie line | 2 JSON fields |
| `json1k` … `json40k` | the `short` GET | 1,008, 3,943, 16,193 and 40,760 bytes of JSON |

The checksum folds every response's bytes in the first iteration and every
request's length, status, method, field count and body in all of them, and
the number of reads a case is fed, so `split` and `browser` have different
checksums. Two builds that parse or answer differently disagree on it.

`nish-copy` is a byte-identical copy of the build, timed as its own column:
the spread between it and `nish` is the noise band. A time gain counts only
when it repeats outside the band on two separate runs.

`--instructions` counts with `valgrind --tool=cachegrind --cache-sim=no`, with
glibc's string functions pinned to one variant (`GLIBC_TUNABLES`) and
`NISH_SIMD=base`, as `bench/run.mjs` pins them: the `json*` cases reach a scan
that picks its width from `cpuid`. An iteration is a run of 1,000 iterations less a
run of 500, over 500, so start-up cancels; a request is that over the case's
requests (two for `pipelined`).

## Instructions a request

`node bench/http1-request/run.mjs --instructions --base 1d92417e`, and the
same with `--cpu x86-64-v3`:

| Case | x86-64 nish | x86-64 base | base vs nish | x86-64-v3 nish | x86-64-v3 base | base vs nish |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `browser` | 12,236 | 13,159 | +7.5% | 13,720 | 14,716 | +7.3% |
| `api` | 9,584 | 10,507 | +9.6% | 10,248 | 11,244 | +9.7% |
| `short` | 3,859 | 4,782 | +23.9% | 3,876 | 4,872 | +25.7% |
| `pipelined` | 10,669 | 11,593 | +8.7% | 11,741 | 12,737 | +8.5% |
| `split` | 12,574 | 13,497 | +7.3% | 14,065 | 15,061 | +7.1% |
| `json1k` | 21,710 | 22,633 | +4.3% | 21,604 | 22,600 | +4.6% |
| `json4k` | 74,517 | 75,440 | +1.2% | 74,004 | 75,000 | +1.3% |
| `json16k` | 294,518 | 295,441 | +0.3% | 292,292 | 293,288 | +0.3% |
| `json40k` | 734,866 | 735,789 | +0.1% | 729,208 | 730,204 | +0.1% |

The cut saves the same count on every case, 923 a request at x86-64 and 996
at x86-64-v3, since every response head is the same shape. With
`NISH_SIMD=base` and `GLIBC_TUNABLES` pinned, as `bench/run.mjs` pins them,
these counts are deterministic; they rank the change.

## Where a request's instructions go

callgrind on `browser`, built `--profile speed -g` at x86-64, exclusive
instructions a request (a run of 2,000 iterations less a run of 1,000, over
1,000), on `main` at `1d92417e` (the before) and with this directory's cut
(the after). A `-g` build lays code out a little differently, so its totals
sit about 1% under the `--instructions` counts above.

```sh
./build/nish bench/http1-request/main.ts -o prof/ --link prof/h1 --profile speed -g
GLIBC_TUNABLES=<as run.mjs pins it> valgrind --tool=callgrind ./prof/h1 browser 1000
GLIBC_TUNABLES=<as run.mjs pins it> valgrind --tool=callgrind ./prof/h1 browser 2000
callgrind_annotate callgrind.out.<pid>              # per function
callgrind_annotate --auto=yes callgrind.out.<pid>   # per source line
```

| Function | Before | After |
| --- | ---: | ---: |
| `http1Next` (the request line, field lines, name lowercasing and token check, the end of the head) | 5,426 | 5,426 |
| `http1TakeLine` (the line scan) | 2,649 | 2,649 |
| `nish_main` (the bench loop and what LLVM inlined into it) | 1,443 | 1,443 |
| `http1WriteResponseHead` | 1,178 | 577 |
| `http1HeadAppend` | 630 | 630 |
| libc `memcpy` (the head copy, the output, the JSON body) | 471 | 471 |
| `http1PutText` | 501 | 41 |
| `JsonWriter.i32`, `jsonWriterPutString` | 388 | 388 |
| `http1PutStatusLine`, `http1PutFixed` | — | 117 |
| `http1PutBytes`, `http1PutCrlf`, `http1PutDecimal` | 217 | 217 |
| everything else | 152 | 152 |
| **Total** | **13,055** | **12,111** |

## What the -O2 code does

Read from the per-line callgrind counts of the after build and `objdump -d`.
Line numbers are `std/net/http1-codec.ts` at this commit.

- **`http1Next`** spends most of its 5,426 on the field lines. Each name is
  copied into the held head buffer, then lowercased and token-checked there
  a byte at a time (lines 1031–1040, about 1,130 a request, plus
  `http1IsTokenByte`'s two 64-bit tchar masks, lines 697–698, about 730).
  Its OWS is trimmed a byte at a time from each end (lines 1063 and 1066,
  about 330). The request line's target is walked a byte at a time
  (lines 964–965, about 310).
- **`http1HeadIs`** (lines 745–757, about 1,060 a request, inlined into its
  callers) is a length test and a byte loop. At the end of the head
  `http1EndOfHead` compares each name with the five the parser reads
  (`host`, `content-length`, `transfer-encoding`, `connection`, `upgrade`);
  `http1ConnectionOptions` looks for `connection` again; `headerIndex` and
  `methodIs` call it for the router. The three loops over the fields cost
  about 450 more (lines 336–337, 887–888, 1102–1104).
- **`http1TakeLine`** already jumps to the next control byte sixteen at a
  time; what is left is the per-line call, the CRLF test and the tally.
- **`http1HeadAppend`** is called once a line, ten times a `browser`
  request, each a `copyBytes` (a `memmove`) into the held head: about 805 a
  request, its share of `memcpy` included, for the nine field lines (the call
  at line 1029) and about 80 for the request line.
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
  sure of, the loop has no bounds check; otherwise only the in-bounds bytes
  are written. Both answer `at + text.length`.

Tests: `tests/link/net_http1/checks.ts` (and its `_f64` twin) — the smallest
head (17 bytes) in a buffer of 17, of 16 (`HTTP1_NO_ROOM`) and in a larger one
whose bytes after the head are untouched; a head with every fixed field at an
offset, untouched either side, exactly fitting and one byte short; values of
1, 15, 16, 17, 31, 32 and 33 bytes with HTAB and obs-text written, and NUL,
LF, CR, 0x1f and DEL refused at bytes 0, 14, 15, 16, 17, 20, 25, 29 and the
last two, each place once (so the overlap of the last two vectors is
covered), and obs-text 128 written at each of those places; NUL, LF, CR, 0x1f
and DEL in the date at bytes 16, 20 and 28 refused; a five-byte date ending a
204's head, which leaves `Date: ` the byte path, written with the bytes after
it untouched and fitting a buffer exactly its size; `http1PutText`
inside, past the end and before the start of its buffer.

## Measured time

Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, a shared cloud host.
`--profile speed`, 16 rounds of 4 columns, against `--base 1d92417e`. Median
ns an iteration; "band" is `nish-copy` against `nish`, the same bytes, and
"base band" `base-copy` against `base`, so a difference inside them is noise.
The `api` and `pipelined` rows were taken again after `api` took its 148-byte
JWT; the others are from the round before, whose requests they share. `split`
and the `json*` cases have instruction counts only, no timing.

| Case | `--cpu` | Run | nish | base | base vs nish | band | base band |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| `browser` | x86-64 | 1 | 974.5 | 1139.8 | +17.0% | ±2.4% | ±11.8% |
| `browser` | x86-64 | 2 | 1036.7 | 1401.1 | +35.2% | ±3.1% | ±0.3% |
| `api` | x86-64 | 1 | 803.4 | 907.7 | +13.0% | ±3.2% | ±3.8% |
| `api` | x86-64 | 2 | 826.9 | 908.7 | +9.9% | ±3.4% | ±2.4% |
| `short` | x86-64 | 1 | 348.5 | 404.5 | +16.1% | ±4.2% | ±10.9% |
| `short` | x86-64 | 2 | 375.4 | 388.3 | +3.4% | ±4.8% | ±15.1% |
| `pipelined` | x86-64 | 1 | 1709.8 | 1869.2 | +9.3% | ±4.1% | ±2.4% |
| `pipelined` | x86-64 | 2 | 1824.8 | 2006.5 | +10.0% | ±12.5% | ±4.7% |
| `browser` | x86-64-v3 | 1 | 1407.9 | 1566.8 | +11.3% | ±3.6% | ±2.0% |
| `browser` | x86-64-v3 | 2 | 1291.1 | 1643.3 | +27.3% | ±34.2% | ±10.5% |
| `api` | x86-64-v3 | 1 | 1070.1 | 1211.0 | +13.2% | ±1.3% | ±16.1% |
| `api` | x86-64-v3 | 2 | 942.0 | 1168.7 | +24.1% | ±12.3% | ±16.1% |
| `short` | x86-64-v3 | 1 | 377.0 | 514.8 | +36.6% | ±5.3% | ±17.7% |
| `short` | x86-64-v3 | 2 | 412.2 | 543.4 | +31.8% | ±8.6% | ±5.5% |
| `pipelined` | x86-64-v3 | 1 | 2008.4 | 2287.3 | +13.9% | ±6.5% | ±2.3% |
| `pipelined` | x86-64-v3 | 2 | 2295.4 | 2339.1 | +1.9% | ±5.4% | ±2.2% |

Read from the table: three gains repeat outside both bands on both runs:
`browser` at x86-64 (+17.0%, +35.2%), `short` at x86-64-v3 (+36.6%, +31.8%)
and `api` at x86-64 (+13.0%, +9.9%, against bands of ±3.2/±3.8 and
±3.4/±2.4). With the 254-byte `api` head, the round before, `api` at
x86-64-v3 also repeated (+7.2% against ±6.7/±3.9, clearing its band by only
0.5 points, and +31.3% against ±3.3/±14.8); with the JWT it is inside its
base's ±16.1% band on both runs. The rest move by more than their bands from
run to run. Several gains are far larger than the 7% to 26% instruction cut,
so the wall clock here is partly code layout and mostly the host's noise. The
instruction counts carry the ranking; the time table says only that no case
got repeatably slower outside its bands.

## Candidates for the next cut

Ranked by what each candidate's code costs a `browser` request today, from
the per-line counts above (after build, x86-64). A cut saves part of that
cost, not all of it. The next cut takes the first.

| # | Candidate | Cost today | Where it is measured |
| --- | --- | ---: | --- |
| 1 | Lowercase a field name and check it is a token sixteen bytes at a time (SWAR or `nish:simd`), instead of a byte at a time | ~1,860 | lines 1031–1040 (~1,130) and `http1IsTokenByte`, lines 697–698 (~730, a little of it the method's check) |
| 2 | Compare a name with the five the parser reads by length first and one 8- or 16-byte compare (`http1HeadIs`, `http1EndOfHead`, `http1ConnectionOptions`) | ~1,510 | `http1HeadIs`, lines 745–757 (~1,060), and the three loops over the fields (~450); shared with `headerIndex` and `methodIs` |
| 3 | Hold the head without copying each line in `http1HeadAppend` when it is already contiguous in the input | ~885 | the field lines' call at line 1029 (~805) and the request line's (~80), `memcpy` included; the copy exists for H1-5, so this needs the input buffer kept until the response is done, a security-record change |
| 4 | Trim OWS and walk the target with a vector scan | ~640 | lines 1063 and 1066 (~330), 964–965 (~310) |
| 5 | The remaining head-writer stores: CRLF as one 2-byte store, `http1PutBytes` and `http1PutDecimal` | 217 | the function table |
| 6 | Record the method once as a code when the request line is read, so `methodIs` is one compare | 30–50 | the bench counted with its router's `methodIs` chain replaced by a constant: 30 fewer on `browser` (a GET, one call), 41 on `short`, 50 on `api` (a POST, two calls); a router testing more methods first pays more |
| — | `JsonWriter.i32` and `jsonWriterPutString` | 388 | the function table; `std/json.ts`, outside this bench's files, for the copies-checks stage |

The per-line counts behind those estimates: exclusive instructions a
`browser` request, from `callgrind_annotate --auto=yes` on the after build,
lines of `std/net/http1-codec.ts`.

| Lines | Counts | Sum | Candidate |
| --- | --- | ---: | --- |
| 1031, 1032, 1033, 1034, 1037, 1038, 1040 | 63, 226, 95, 95, 516, 86, 45 | 1,126 | 1 |
| 697, 698 | 345, 387 | 732 | 1 |
| 745, 748, 749, 750, 751, 754, 757 | 292, 320, 26, 171, 52, 92, 104 | 1,057 | 2 |
| 336–337, 887–888, 1102–1104 | 93 + 64, 92 + 63, 88 + 27 + 27 | 454 | 2 |
| 1029 | 805 | 805 | 3 |
| 1063, 1066 | 162, 171 | 333 | 4 |
| 964, 965 | 269, 43 | 312 | 4 |

## Tried and dropped

| Idea | Measured | Why dropped |
| --- | --- | --- |
| Constant text written as straight-line `out[at + j] = c` stores under one `at <= out.length - k` guard | −883 a request (callgrind, the inputs before this round), 63 fewer than the vector store | every store keeps its bounds check (see above); superseded by the sixteen-byte store |
