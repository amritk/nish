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
node bench/http1-request/run.mjs --base 4dc09dcc                  # adds a before column
node bench/http1-request/run.mjs --instructions --base 4dc09dcc   # cachegrind counts
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

`node bench/http1-request/run.mjs --instructions --base 4dc09dcc`, and the
same with `--cpu x86-64-v3`. `base` is `main` with the head-writer cut
(#1187); `nish` adds this round's cut, the field names.

| Case | x86-64 nish | x86-64 base | base vs nish | x86-64-v3 nish | x86-64-v3 base | base vs nish |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `browser` | 11,455 | 12,236 | +6.8% | 12,692 | 13,720 | +8.1% |
| `api` | 9,039 | 9,584 | +6.0% | 9,536 | 10,248 | +7.5% |
| `short` | 3,872 | 3,859 | −0.3% | 3,858 | 3,876 | +0.5% |
| `pipelined` | 10,006 | 10,670 | +6.6% | 10,871 | 11,741 | +8.0% |
| `split` | 11,794 | 12,574 | +6.6% | 13,037 | 14,065 | +7.9% |
| `json1k` | 21,723 | 21,710 | −0.1% | 21,586 | 21,604 | +0.1% |
| `json4k` | 74,530 | 74,517 | −0.0% | 73,986 | 74,004 | +0.0% |
| `json16k` | 294,531 | 294,518 | −0.0% | 292,274 | 292,292 | +0.0% |
| `json40k` | 734,879 | 734,866 | −0.0% | 729,190 | 729,208 | +0.0% |

The cut scales with the field names: 781 fewer a `browser` request (nine
names) at x86-64 and 1,028 at x86-64-v3, 545 and 712 on `api`. `short` and
the `json*` cases have one name, `Host`, one vector whose set-up costs about
what four bytes of the byte loop did: 13 more at x86-64, 18 fewer at
x86-64-v3.
With `NISH_SIMD=base` and `GLIBC_TUNABLES` pinned, as `bench/run.mjs` pins
them, these counts are deterministic; they rank the change.

## Where a request's instructions go

callgrind on `browser`, built `--profile speed -g` at x86-64, exclusive
instructions a request (a run of 2,000 iterations less a run of 1,000, over
1,000), on `main` at `4dc09dcc` (the before) and with this round's cut (the
after). A `-g` build lays code out a little differently, so its totals sit
about 1% under the `--instructions` counts above.

```sh
./build/nish bench/http1-request/main.ts -o prof/ --link prof/h1 --profile speed -g
GLIBC_TUNABLES=<as run.mjs pins it> NISH_SIMD=base valgrind --tool=callgrind ./prof/h1 browser 1000
GLIBC_TUNABLES=<as run.mjs pins it> NISH_SIMD=base valgrind --tool=callgrind ./prof/h1 browser 2000
callgrind_annotate callgrind.out.<pid>              # per function
callgrind_annotate --auto=yes --show-percs=no --include=$PWD callgrind.out.<pid>   # per source line
```

`--auto=yes` prints `std/net/http1-codec.ts` twice, as `./std/...` and as
`std/...`: the second holds what LLVM inlined into `nish_main` (the bench's
`headerIndex`), so a line's count is the sum of both. A `=>` line is a
call's inclusive count and belongs to the source line above it.

| Function | Before | After |
| --- | ---: | ---: |
| `http1Next` (the request line, field lines, name lowercasing and token check, the end of the head) | 5,426 | 4,668 |
| `http1TakeLine` (the line scan) | 2,649 | 2,649 |
| `nish_main` (the bench loop and what LLVM inlined into it) | 1,443 | 1,441 |
| `http1HeadAppend` (with its `std/bytes.ts` lines) | 630 | 630 |
| `http1WriteResponseHead` | 577 | 577 |
| libc `memcpy` (the head copy, the output, the JSON body) | 471 | 471 |
| `JsonWriter.i32`, `jsonWriterPutString` | 388 | 388 |
| the head writer's small functions and everything else | 527 | 516 |
| **Total** | **12,111** | **11,340** |

## What the -O2 code does

Read from the per-line counts of the after build. Line numbers are
`std/net/http1-codec.ts` at this commit.

- **The field names** now cost about 906 a `browser` request where they cost
  about 1,860: `http1LowerName` (lines 733–767, 447), `http1NonTokenLanes`
  (lines 712–720, 351, inlined) and the call (line 1094, 108). Each of the
  nine names is one or two vectors; the per-name cost left is the loop's
  set-up, the lowest set bit of the mask and the store.
- **`http1HeadIs`** (lines 808–826, about 1,050 a request, inlined into its
  callers) is a length test and a byte loop. At the end of the head
  `http1EndOfHead` compares each name with the five the parser reads
  (`host`, `content-length`, `transfer-encoding`, `connection`, `upgrade`);
  `http1ConnectionOptions` looks for `connection` again; `headerIndex` and
  `methodIs` call it for the router. The three loops over the fields cost
  about 455 more (lines 340–341, 952–953 and 958–960, 1156–1158).
- **The field values' OWS** is trimmed a byte at a time from each end (lines
  1117 and 1120, 369, and the span stores after them, 108). The request
  line's target is walked a byte at a time (lines 1029–1030, 312).
- **`http1TakeLine`** already jumps to the next control byte sixteen at a
  time; what is left is the per-line call, the CRLF test and the tally.
- **`http1HeadAppend`** is called once a line, ten times a `browser`
  request, each a `copyBytes` (a `memmove`) into the held head: 630 a request
  of its own, and its share of the 471 in `memcpy`.

## The cut

- **Field names sixteen bytes at a time.** A kept field line is copied into
  the head as before; `http1LowerName` then loads sixteen bytes of the copy,
  finds the lanes that are not tchars with `http1NonTokenLanes` (one range
  compare for bytes outside 33–126 and five for the seventeen delimiters
  among them, the set `http1IsTokenByte` tests), and takes the name's run as
  the lowest set bit. The upper-case letters among the run's lanes are
  lowered with one `select`, and the vector is stored back whole: every other
  lane is written as it was, so the colon, the value and the head buffer's
  bytes past the line keep their bytes. The run stops at the line's end, so a
  name that fills its line is lowered only to it. Fewer than sixteen bytes
  before the head's end, the old byte loop runs. The answer, the bytes
  written and every refusal are the byte loop's: `net_http1_parse_diff`
  checks 40,307 names against it.
- The method and a trailer's names keep `http1IsTokenByte`.

Tests: `tests/link/net_http1/checks.ts` (and its `_f64` twin) — names of
15, 16, 17, 31, 32 and 33 bytes, mixed and upper case, stored lowered with
their values' case kept; `@` at every place of each, the overlap of a 17- or
33-byte name's vectors included, refused; each as a line with no colon,
refused; 0x80 in a name refused. `tests/link/net_http1_parse_diff` — 40,307 cases against the
byte-loop parser: every name length 1 to 40 in lower, upper and mixed case,
whole and a byte at a time (the
edge lengths also at every two-feed split); each of 21 bytes that end or refuse a name
(the delimiters, controls, DEL, 0x80, 0xff) at every place in it; names of
15, 16, 17, 31, 32 and 33 bytes whose line ends at every byte around the end
of the held head; and a short name read over a head a longer request left
full. Same answer, same fields.

The round before, #1187, wrote the response head with sixteen-byte stores
(923 fewer a request at x86-64, 996 at x86-64-v3); its notes are in that
pull request and in `docs/security/http1-codec.md`.

## Measured time

Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, a shared cloud host; avx2,
bmi2, sha_ni and avx512f. `--profile speed`, 16 rounds of 4 columns, against
`--base 4dc09dcc`, two runs at each `--cpu`. Median ns an iteration; "band"
is `nish-copy` against `nish`, the same bytes, and "base band" `base-copy`
against `base`, so a difference inside them is noise.

| Case | `--cpu` | Run | nish | base | base vs nish | band | base band |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| `browser` | x86-64 | 1 | 1157.3 | 1218.3 | +5.3% | ±10.2% | ±16.0% |
| `browser` | x86-64 | 2 | 922.2 | 908.1 | −1.5% | ±3.3% | ±3.3% |
| `browser` | x86-64-v3 | 1 | 1474.6 | 1462.8 | −0.8% | ±16.9% | ±9.4% |
| `browser` | x86-64-v3 | 2 | 1342.2 | 1310.4 | −2.4% | ±5.6% | ±7.9% |
| `api` | x86-64 | 1 | 814.0 | 906.2 | +11.3% | ±3.2% | ±0.8% |
| `api` | x86-64 | 2 | 800.4 | 978.0 | +22.2% | ±11.7% | ±20.5% |
| `api` | x86-64-v3 | 1 | 881.4 | 1132.9 | +28.5% | ±5.3% | ±20.7% |
| `api` | x86-64-v3 | 2 | 1059.0 | 1099.0 | +3.8% | ±19.0% | ±9.2% |
| `short` | x86-64 | 1 | 350.9 | 371.8 | +6.0% | ±47.4% | ±29.3% |
| `short` | x86-64 | 2 | 364.6 | 356.2 | −2.3% | ±4.9% | ±7.4% |
| `short` | x86-64-v3 | 1 | 343.6 | 442.7 | +28.8% | ±41.8% | ±7.6% |
| `short` | x86-64-v3 | 2 | 333.4 | 402.0 | +20.6% | ±0.2% | ±7.7% |
| `pipelined` | x86-64 | 1 | 1845.0 | 1933.5 | +4.8% | ±3.3% | ±4.6% |
| `pipelined` | x86-64 | 2 | 1568.9 | 1590.2 | +1.4% | ±1.3% | ±3.8% |
| `pipelined` | x86-64-v3 | 1 | 2098.4 | 2068.5 | −1.4% | ±1.9% | ±19.6% |
| `pipelined` | x86-64-v3 | 2 | 2370.6 | 2117.1 | −10.7% | ±8.1% | ±4.5% |
| `split` | x86-64 | 1 | 1215.0 | 1205.8 | −0.8% | ±3.2% | ±8.5% |
| `split` | x86-64 | 2 | 985.5 | 902.6 | −8.4% | ±3.2% | ±5.6% |
| `split` | x86-64-v3 | 1 | 1215.7 | 1450.8 | +19.3% | ±6.3% | ±13.1% |
| `split` | x86-64-v3 | 2 | 1276.7 | 1169.0 | −8.4% | ±8.9% | ±2.7% |

Read from the table: one gain repeats outside both bands on both runs,
`api` at x86-64 (+11.3% against ±3.2/±0.8, +22.2% against ±11.7/±20.5).
`short` at x86-64-v3 is above its base band on both runs (+28.8%, +20.6%)
but inside its own ±41.8% band on the first, and its instruction count did
not move, so it is layout. `browser`, `pipelined` and `split` do not repeat
at either `--cpu`: each lands inside its bands on one run. Two single runs
are slower outside both bands, `pipelined` at x86-64-v3 run 2 (−10.7%) and
`split` at x86-64 run 2 (−8.4%), and neither again on its other run: nothing
is repeatably slower. The `json*` cases (not in the table) run the same
instructions on both sides and move only with the host. The 6% to 8% cut
is the instruction counts'; on this host the wall clock cannot resolve it
outside `api`.

## Candidates for the next cut

Ranked by what each candidate's code costs a `browser` request today, from
the per-line counts above (after build, x86-64). A cut saves part of that
cost, not all of it. The next cut takes the first.

| # | Candidate | Cost today | Where it is measured |
| --- | --- | ---: | --- |
| 1 | Compare a name with the five the parser reads by length first and one 8- or 16-byte compare (`http1HeadIs`, `http1EndOfHead`, `http1ConnectionOptions`) | ~1,500 | `http1HeadIs`, lines 808–826 (~1,050), and the three loops over the fields (~455); shared with `headerIndex` and `methodIs` |
| 2 | Hold the head without copying each line in `http1HeadAppend` when it is already contiguous in the input | ~630 and its share of 471 | the function table; the copy exists for H1-5, so this needs the input buffer kept until the response is done, a security-record change |
| 3 | Trim OWS and walk the target with a vector scan | ~680 | lines 1117 and 1120 (~369), 1029–1030 (~312) |
| 4 | What is left of the name path: lower and check the name on the copy's way into the head, one pass, not a copy then a vector pass | ≤906 | `http1LowerName` and `http1NonTokenLanes` (lines 712–767, ~798) and the call (line 1094, ~108); most of it is the scan itself, so a fused pass saves the reload, not the compares |
| 5 | The remaining head-writer stores: CRLF as one 2-byte store, `http1PutBytes` and `http1PutDecimal` | ~217 | the function table of #1187 |
| 6 | Record the method once as a code when the request line is read, so `methodIs` is one compare | 30–50 | the bench counted with its router's `methodIs` chain replaced by a constant: 30 fewer on `browser` (a GET, one call), 41 on `short`, 50 on `api` (a POST, two calls); a router testing more methods first pays more |
| — | `JsonWriter.i32` and `jsonWriterPutString` | 388 | the function table; `std/json.ts`, outside this bench's files, for the copies-checks stage |

The per-line counts behind those estimates: exclusive instructions a
`browser` request, from `callgrind_annotate --auto=yes` on the after build,
lines of `std/net/http1-codec.ts`, both of its sections summed.

| Lines | Counts | Sum | Candidate |
| --- | --- | ---: | --- |
| 810, 813, 814, 815, 816, 819, 822 | 292, 309, 26, 171, 52, 92, 106 | 1,048 | 1 |
| 340–341, 952–953, 958–960, 1156–1158 | 93 + 64, 92 + 63 + 46 + 97 + 20, 88 + 27 + 27 | 617 | 1 (the `connection` element walk, 958–960, only partly) |
| 1117, 1120 | 207, 162 | 369 | 3 |
| 1029, 1030 | 269, 43 | 312 | 3 |
| 712–720 | 45, 54, 45, 45, 45, 45, 72 | 351 | 4 |
| 735–767 | 90, 36, 18, 81, 18, 9, 45, 63, 54, 9, 18, 6 | 447 | 4 |
| 1094 | 108 | 108 | 4 |

## Tried and dropped

| Idea | Measured | Why dropped |
| --- | --- | --- |
| Constant text written as straight-line `out[at + j] = c` stores under one `at <= out.length - k` guard | −883 a request (callgrind, the inputs before #1187), 63 fewer than the vector store | every store keeps its bounds check; superseded by the sixteen-byte store |
