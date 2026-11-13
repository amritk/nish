# Http1Connection's per-request cost

`main.ts` drives `Http1Connection` the way `Http1Server` does, with no
socket: each request is fed whole (a GET of about 350 bytes with an
`Authorization` header), answered with a 67-byte JSON body, the output is
consumed as if sent, and the connection is parked and released. The clock is
pinned so the `Date` header never reformats. What is timed is the
connection and the codec under it, per request.

```bash
node bench/http1-conn/run.mjs                  # 15 rounds, 96a38347 against the working tree
node bench/http1-conn/run.mjs --rounds 5 --base origin/main   # on a branch: main against the branch
node bench/http1-conn/run.mjs --connections 10000 --rounds 15 --base 98c4f9a7   # the table below
bash bench/http1-conn/misses.sh                # then: where the misses land, per function and line
```

`run.mjs` builds `main.ts` twice at `--profile speed`, once against `std/` as
`--base` has it (default: `96a38347484f`, the commit before the hot-field
layout, so the default compares against something on `main` too) and once
against the working tree's, and links a byte-identical copy of the first. The
old build is made by a copy of the compiler placed in
`build/bench/http1-conn/old-package/` beside the base's `std/`, `scripts/` and
`runtime/`, since the compiler reads `nish/<module>` from the package it sits
in: a change to `http1-codec.ts` or any other module is compared too. Every
round runs the three binaries on each shape `--shape` names (a comma list,
default all six), rotating which goes first:

- `hot`: every request on one connection, so its fields stay in cache.
- `cold`: the same requests dealt round-robin over `--connections`
  connections of one pool (default 50,000), so each request finds its
  connection out of cache, as a busy server does.
- `idle`: the same spread over an `Http1Server`-shaped pool with
  `Http1Config.idleInput` on. A class in `main.ts` repeats `Http1Server`'s
  `readable`, `next`, `flush`, `settle` and `send` with the socket taken out:
  the read copies the request into the server's scratch buffer, as `netRead`
  would, and the send takes all the output at once. Each connection parks
  after its response and lends its input and head buffers back, and the
  requests alternate between the GET and a POST of about 550 bytes with a
  small JSON body, whose body bytes go into the checksum. Each pass over the
  connections swaps which of the two a connection gets, so every
  connection serves both.
- `direct`: `idle` with the read made straight into the lent `parser.buf`
  when it has room, as a carrier could if `Http1Server` handed its socket
  read the parser's buffer, so the scratch copy and `feed` are skipped. It
  is in the bench only; `Http1Server` does not read this way.
- `idle-dram` and `direct-dram`: the same two with every connection's lines
  out of every cache level. Before each request the bench writes one byte
  per cache line over its slice of an eviction ring (`--evict`, default
  1024 MiB), so each pass over the connections sweeps the whole ring; only
  the requests are timed, between two clock reads each, and a batch is
  `--dram-requests` requests (default 20,000).

The working set, against `lscpu` on the machine below (L1d 48 KiB and L2
2 MiB a core, L3 504 MiB shared): an idle connection holds about 1 KiB, so
10,000 of them are about 10 MiB, past L2 and well inside L3. `idle` and
`direct` therefore measure L2 misses that L3 serves. The 1 GiB ring is twice
L3, so in the `-dram` shapes a connection's lines come from DRAM; cachegrind's
LL (512 MiB, 32-way) misses about 9 to 11 times per request there, against 0
in `idle`.

With the idle shape (or `--rss N`, or `--shape rss` for the memory alone) it
also reports the peak RSS one idle connection costs: each binary's `rss` mode
builds the idle pool with `idleInput`, its `rss-default` mode on the default
`Http1Config`, serves every connection one request, or `--passes` (default 4)
in turn so each has kept its response head, so each parks, and prints its
`VmHWM` from `/proc/self/status`; the table gives a row for each of the four,
over `--rss` runs (default 5), the median and min–max of the peak at
`--connections` less the peak at 0, divided by `--connections`. `getrusage`'s `ru_maxrss` cannot stand in for
it, because it keeps the peak of the image `exec` replaced too, and under
`taskset` from Node that is larger than the bench at 0 connections.

Each run executes under `taskset -c 1` when `taskset` is there (the header
says whether it was) and reports the fastest of `--batches` batches (default
5) of `--requests` requests (default 200,000). The table gives the median and the min–max over the
rounds, and the ratio of medians to `old`; `old′` against `old` is the noise
band. A checksum that differs between the binaries fails the run.

`main.ts` alone takes `hot|cold|idle|direct|rss [requests] [connections]
[batches] [evict-MiB]` and prints `shape ns requests checksum` for its fastest
batch. The checksum adds the body bytes, which of the two routes each request
matched by `methodIs` and `targetIs`, and its `Content-Type`, so a binary that
skipped the lookups would not match. The idle, direct and rss shapes add how
many input, head and output buffers the pools made, which with the lending
LIFO is one each however many connections there are; `run.mjs` fails the run
if it is not.
The rss shape prints its peak in KiB where the others print nanoseconds.

## Measured: a hot-first parser layout (2026-11-06)

`std/net/http1-codec.ts`'s `Http1Parser` puts the fields a request reads
first (its buffers, the window and scan state, the flags), makes its `spans`
before its other arrays, `Http1Connection` makes its parser before its
`HttpDate`, and `unpark` finds a lent buffer by comparing it with `noOutput`.
Against `main` at `98c4f9a7`, Intel(R) Xeon(R) Processor @ 2.30GHz, 4 cores,
pinned to core 1, `node bench/http1-conn/run.mjs --connections 10000 --rounds 15 --base 98c4f9a7`
(ns per request, median (min–max) over 15 rounds, ratio of medians to `old`):

| shape | old | old′ | new |
| --- | ---: | ---: | ---: |
| hot | 323.0 (308.1–329.9) | 324.4 (310.1–332.1) 1.004 | 320.0 (305.8–333.6) 0.990 |
| cold | 353.3 (334.5–379.9) | 356.9 (339.7–382.9) 1.010 | 341.6 (332.1–375.0) 0.967 |
| idle | 446.5 (425.9–472.9) | 439.6 (424.4–452.9) 0.984 | 441.7 (421.0–444.2) 0.989 |
| direct | 434.3 (415.2–442.4) | 435.8 (415.7–440.2) 1.004 | 434.7 (414.8–439.7) 1.001 |
| idle-dram | 672.0 (650.3–735.5) | 668.5 (632.8–701.6) 0.995 | 650.7 (620.0–677.0) 0.968 |
| direct-dram | 660.2 (643.8–715.8) | 666.5 (641.2–715.5) 1.010 | 649.1 (626.1–666.3) 0.983 |
| RSS per idle connection, bytes | 1026 (1025–1026) | 1026 (1025–1026) | 1026 (1025–1026) |

What the wall clock shows, plainly:

- **`idle`, the shape the layout was for, shows no gain outside noise**:
  `new` is 1.1% under `old` and `old′` 1.6% under it.
- **DRAM-cold, the medians move more than the noise but the ranges
  overlap**: `idle-dram` is 3.2% under `old` against `old′`'s 0.5%, and
  `direct-dram` 1.7% against 1.0% the other way. The `-dram` times include
  two clock reads per request, the same in every binary. This is a lead, not
  a settled speed-up.
- `cold` moves 3.3% against `old′`'s 1.0%, with the same overlap.
- RSS per idle connection is unchanged.

### Where the misses are

What the change does show is fewer lines touched. `bash bench/http1-conn/misses.sh`
runs Valgrind's cache simulator (cachegrind `--cache-sim=yes` for these
shapes, callgrind for the stages loop below; D1 48 KiB 12-way, LL 512 MiB
32-way) on
`-g` builds of both, each shape at 0 and N requests over 10,000 connections,
and `cg_annotate --diff`s the two so setup cancels. N is 100,000 for `idle`
and `direct` and 20,000 for the `-dram` shapes. Misses per request:

| shape | | old | new |
| --- | --- | ---: | ---: |
| idle | D1 read + write | 8.07 + 2.88 = 10.95 | 7.19 + 1.82 = 9.01 |
| idle | LL | 0 | 0 |
| idle-dram, the eviction sweep left out | LL read + write | 8.06 + 2.88 = 10.94 | 7.18 + 1.82 = 9.00 |
| idle-dram, the eviction sweep left out | D1 read + write | 59.6 + 35.4 | 59.5 + 34.3 |

`direct` and `direct-dram` miss exactly as often as `idle` and `idle-dram`.
In `idle` every miss L3 would serve is a D1 miss that LL catches. In
`idle-dram` the sweep flushes D1 and L2 before every request, so D1 counts
every line the request touches, shared or not. LL then counts the
connection's own lines, which come from DRAM, and they drop by the same 1.94
a request that D1 drops by in `idle`.

By function, `idle` D1 read / write misses per request. `idle-dram`'s LL
misses by function match these to within 0.01, except `inputRoom`, which
misses LL once fewer in both builds:

| function | old | new |
| --- | ---: | ---: |
| `Http1Connection.inputRoom` (with `buffered`, inlined) | 3.25 / 0 | 3.50 / 0 |
| `Http1Connection.feed` | 2.38 / 0.25 | 0.75 / 0 |
| `http1Next` | 2.12 / 2.26 | 2.56 / 1.76 |
| `Http1Connection.next` | 0 / 0.37 | 0 / 0.06 |
| the bench's `serve` | 0.31 / 0 | 0.31 / 0 |

By line, the counts that moved:

- **`unpark`'s length test** (`p.buf.length` on a parked slot) goes from 2.00
  read misses to 0.50, because the identity test answers it from the slot's
  line.
- **`p.method = ""`** goes from 0.62 write misses to 0.12.
- **`p.body = p.buf`** (0.25) and **`this.data = this.parser.body`** (0.37)
  write misses go to 0.
- **The request line's `http1TakeLine`** goes from 0.37 to 0.75 and
  **`buffered()`** from 0.75 to 1.00, which is the cost of what moved onto
  their lines.

The other hot spots, by line, on `new`:

- **The spans array.** Writing its data (`spans[at] = value`, 1.63 write
  and 0.25 read misses) and its header (`p.spans.length`, 1.00 read miss)
  is now the largest share.
- **The connection's first line**, read by `inputRoom`'s state test: 1.00.
- **The parser's window** (`end - start` and `buffered()`): 1.00 each.
- **`p.headHeld`**: 0.37.

The connection, the parser and its spans are each one cold object, so each
costs at least a line; what is left past that is the spans' data, which a
request writes a header at a time.

Not taken:

- **The spans inline in the parser.** It would save about one miss per
  request (the spans' array header), but `std/net/websocket.ts` reads
  `p.spans` as an `i32[]`, so it waits for a change that may touch that
  module.
- **Reading straight into `parser.buf`** (the `direct` shapes). Measured, it
  saves no misses: the copy moves from `feed` into the read, onto the same
  lines the parse reads next. It does save about 77 of 2,485 data references
  a request. On the wall clock, `direct` is 1.6% under `idle` on `new` (2.7%
  on `old`), against `old′`'s 1.6% gap on `idle`, and 0.2% under it in
  `-dram` on `new`. That is not enough to change `Http1Server`'s read path
  for every carrier, so it stays in the bench.

## Measured: library stages per request, v0.34.1 to now (2026-11-08)

The `stages` shape times one cold keep-alive request through each step of
`Http1Server`'s path, 10,000 connections, the clock read and `sendmsg`
taken out. What the library itself spends per request:

    node bench/http1-conn/run.mjs --shape stages --connections 10000 --rounds 15 --base <ref>

### x86-64, wall clock

Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores (AVX2, SSE4.2, SHA-NI),
Linux 6.18.44, builds at `--profile speed` with `nish:simd` lowered to SSE2,
pinned to core 1. Each column is the `old` column of a run against that
base; `cut` is this branch's `new` against v0.35.0. ns per request, median
(min–max) over 15 rounds:

| stage | v0.34.1 | v0.35.0 | main `17275317` | cut |
| --- | ---: | ---: | ---: | ---: |
| recv | 46.3 (44.3–49.0) | 46.9 (41.7–52.3) | 48.9 (46.1–51.1) | 48.9 (46.9–53.1) |
| parse | 308.9 (301.2–326.0) | 344.1 (320.4–360.1) | 346.3 (337.8–365.9) | 312.4 (303.4–327.2) |
| dispatch | 29.3 (18.6–30.3) | 28.2 (23.6–30.9) | 28.0 (25.5–30.8) | 29.3 (27.6–32.5) |
| respond | 96.3 (94.8–98.7) | 102.9 (96.0–110.0) | 103.8 (99.7–108.7) | 106.1 (102.8–111.3) |
| sendBody | n/a | 73.5 (35.8–94.3) | 75.9 (61.2–97.7) | 77.1 (50.4–101.5) |
| park | 16.1 (12.2–17.1) | 12.1 (10.0–13.2) | 12.1 (11.2–13.5) | 12.8 (11.5–15.2) |
| total | 554.0 (539.6–572.9)\* | 604.6 (539.7–657.3) | 617.4 (582.1–651.1) | 587.9 (553.7–640.2) |
| clock read | 27.6 | 27.3 | 27.3 | 27.2 |
| `sendmsg` (kernel) | — | 486.9 | 494.7 | 492.9 |

In the v0.35.0 run, `old′` (a second build of v0.35.0) put parse at 346.5,
1.007 of `old`; `cut` is 0.908 of it. On this machine the wall-clock ranges
of parse overlap (`cut` 303.4–327.2 against v0.35.0's 320.4–360.1), so the
x86 claim rests on the exact instruction count below, 518 fewer a request;
the ranges are apart on aarch64's. The other stages are not cut. Against
`old`, `old′` put them at 1.021 (recv), 1.002 (dispatch), 1.011 (respond),
0.988 (sendBody) and 1.026 (park), and `cut` at 1.043, 1.037, 1.031, 1.049
and 1.055: 0.02 to 0.06 above `old′`, so just outside the band one rebuild
gives. Each of `cut`'s ranges overlaps `old′`'s, and callgrind below counts
the same instructions for all of them, so this run cannot tell that from
noise.

The sendBody row times `sendBody` less a separately timed hot `sendmsg` of
the same lengths. That subtraction is noisy (`cut`'s minimum on aarch64 is
2.1 ns), so read the row's median, not its range, in both tables.

\* v0.34.1 has no `Http1Connection.sendBody`: `run.mjs` builds its bench
with `write`, which has no bare `sendmsg` to take out, so its sendBody cell
is not comparable with the others and is left out; its total still holds the
untaken-out `write`.

### x86-64, callgrind: instructions and misses per request

Valgrind gives no hardware counters here, so `bash bench/http1-conn/misses.sh`
(callgrind with its cache simulator, D1 48 KiB 12-way, LL 512 MiB 32-way,
the `stages-loop` shape at 0 and N requests diffed, so no calibration loop is
counted) stands in for them. Callgrind cannot part parse from dispatch (the
loop's three `next()` calls inline to the same lines), so their row is the
two together. `settle` counts in recv, including the `settle` that `flush`
makes, which `main.ts`'s wall-clock park span times, so callgrind's park row
drops cost the wall-clock park includes. `total` is the timed loop as a
whole: `other` is the bench's own clock reads and drain, not library work.
Valgrind's CPUID hides SHA-NI, which
touches nothing on this path. Ir / D1 read misses / D1 write misses per
request:

| stage | v0.34.1 | v0.35.0 = main | cut |
| --- | ---: | ---: | ---: |
| recv | 579 / 5.82 / 0.25 | 580 / 4.46 / 0 | 580 / 4.46 / 0 |
| next (parse + dispatch) | 4,486 / 2.12 / 1.88 | 4,488 / 2.78 / 1.22 | 3,970 / 2.78 / 1.22 |
| respond | 1,258 / 0 / 0 | 1,258 / 0 / 0 | 1,258 / 0 / 0 |
| sendBody | 468 / 0 / 0\* | 86 / 0.11 / 0 | 86 / 0.11 / 0 |
| park | 76 / 0 / 0 | 62 / 0 / 0 | 62 / 0 / 0 |
| other | 348 / 0.13 / 0 | 473 / 0.13 / 0 | 473 / 0.13 / 0 |
| total | 7,215 / 8.07 / 2.13 | 6,947 / 7.47 / 1.22 | 6,429 / 7.47 / 1.22 |

\* v0.34.1's sendBody is its `write` path, a different call.

The cut removes 518 instructions a request from the parse and moves no
miss. The simulated last level is 512 MiB, so its 0 misses here say nothing
about DRAM; only aarch64's `ll_cache_miss_rd` below is evidence for that.

Parse is ~35 ns slower on v0.35.0 than on v0.34.1 on x86, with the same
instruction count. The only difference callgrind sees in `next` is 0.66 write
misses a request turned into 0.66 read misses, and a read miss stalls the
parse where a write miss can drain from the store buffer. That is a likely
cause, not a measured one. On arm the two differ by 1%.

### aarch64, wall clock and hardware counters

GitHub's `ubuntu-24.04-arm` runner, 4 cores (the CPU model is not reported),
Linux 7.0.0-1017-azure, `nish:simd` lowered to NEON, pinned to core 1, from
the stages workflow on the runner branch. ns per request, median (min–max)
over 15 rounds. Each base column is the `old` of its run, and `cut` is the
`new` of the v0.35.0 run:

| stage | v0.34.1 | v0.35.0 | main `17275317` | cut |
| --- | ---: | ---: | ---: | ---: |
| recv | 43.7 (43.2–46.0) | 49.4 (46.5–50.3) | 50.3 (46.6–52.3) | 50.0 (48.1–52.3) |
| parse | 469.1 (468.6–469.8) | 474.3 (473.7–475.5) | 474.3 (473.4–476.2) | 314.5 (313.6–316.5) |
| dispatch | 16.8 (16.1–17.2) | 16.9 (16.0–18.1) | 17.0 (16.7–17.4) | 16.1 (15.2–18.5) |
| respond | 80.7 (80.4–81.4) | 87.1 (86.1–87.6) | 87.1 (86.2–87.6) | 90.3 (88.7–91.9) |
| sendBody | n/a | 64.9 (30.4–69.7) | 66.2 (30.5–72.2) | 70.8 (2.1–105.6) |
| park | 7.4 (7.0–7.5) | 4.7 (4.5–5.7) | 4.7 (4.6–5.7) | 4.6 (4.0–5.8) |
| total | 665.3 (663.3–667.1)\* | 696.9 (660.6–705.0) | 697.5 (663.7–707.8) | 545.8 (481.4–578.8) |
| clock read | 31.1 | 31.1 | 31.1 | 31.2 |
| `sendmsg` (kernel) | — | 674.2 | 674.7 | 669.3 |

\* As on x86: v0.34.1's sendBody is not comparable and is left out.

Parse is 0.663 of v0.35.0 here, against `old′`'s 1.001, a larger cut than on
x86. The scans it replaces were a 64-bit word trick (the line's end) and a
byte loop (the target).
Respond is 1.037 of v0.35.0 with the ranges apart (`old′` 0.996). The cuts
do not touch `respond`, so this is likely code layout; it is recorded, not
explained. An earlier arm run, before the cuts, built the same std twice and
put respond at 1.001.

`node bench/http1-conn/counters.mjs` (`perf stat`, user mode, 7 rounds),
per request, median (min–max):

| build | cycles | instructions | L1D load misses | `ll_cache_miss_rd` |
| --- | ---: | ---: | ---: | ---: |
| v0.34.1 | 3,175 (3,169–3,180) | 8,553 | 8.50 (6.33–12.45) | 0.00 |
| v0.35.0 | 3,364 (3,349–3,379) | 8,352 | 11.24 (6.27–22.18) | 0.00 |
| main | 3,361 (3,351–3,398) | 8,352 | 12.36 (4.96–15.90) | 0.00 |
| cut | 2,818 (2,813–2,855) | 6,812 | 8.57 (6.81–26.24) | 0.00 |

The cut takes 1,540 instructions and 546 cycles a request off v0.35.0 on
arm. The L1D miss ranges overlap; `ll_cache_miss_rd` is 0, so on this shape
a connection's lines do not come from DRAM.

### The cuts

Each is a `perf(net)` commit, measured by the deterministic callgrind Ir
count of the stages loop (same build flags, `-g`):

| change | Ir / request before → after |
| --- | ---: |
| `http1TakeLine` finds `\r\n` with one 16-byte compare per block | 7,051 → 6,710 (−4.8%) |
| `http1RequestLine` checks the target sixteen bytes at a time for a byte outside `!`..`~` | 6,710 → 6,534 (−2.6%) |

`misses.sh`'s count of the same trees, the timed loop's own function with no
calibration, runs 104 to 105 Ir below this whole-program one (6,947 →
6,429), and the two cuts together come to 517 by one count and 518 by the
other.

Tried and dropped, each against the tree it would have landed on:

- **The request target's tail vectorised** (an overlapping last 16-byte
  load for targets shorter than a block): +176 Ir, slower than the byte loop
  on the 1 to 15 bytes it covers.
- **A clamp on the tail loop's bound** instead of `if (i > b)`: −31 Ir,
  inside the wall clock's noise.
- **`EndOfHead` found by a `switch` on the byte after `\r\n`**: −45 Ir,
  inside the noise.

What is above 0.5 µs: no single `std/net` stage, now or on v0.35.0 (parse,
the largest, was ~344 ns on x86 and ~474 ns on arm). Parse is now ~312 ns
on x86 and ~315 ns on arm. The whole library path is ~590 ns on x86 and
~546 ns on arm. What is left in parse past the scans: the OWS trims (~220
Ir), `http1HeadIs`'s length check (92), `http1BytesAreToken` (74) and `http1MethodOverrun` (22).

### `Jwt.verify`, outside `std/net`

The issue's profile put the challenge app's `Jwt.verify` (HMAC-SHA256) at
~2.9 µs a request on x86 from a cachegrind instruction count. Timed natively
on the same x86 machine (`taskset -c 1`, a 147-byte HS256 token, 1,000,000
calls a batch, the best of 5 batches, over several runs), ns per call. The
timed code is the challenge submission's `src/jwt.ts` (not in this
repository) under a 50-line driver that issues one token, then times
`jwt.verify(tok, 0, len, now + (k & 1023))` and `jwt.sign` over the signed
part in a loop with `monotonicNanos`; it was built with
`build/nish main.ts --profile speed -g --link v` and run as
`taskset -c 1 ./v 1000000`, with `NISH_SHA256=soft` set for the third row.
`bench/jwt-verify` times std's `JwtVerifier` the same way and is the
re-runnable one in this repository:

| path | ns per call |
| --- | ---: |
| `verify`, SHA-256 on SHA-NI | 691–752 |
| `sign`, the HMAC over the 103-byte signed part | 304–329 |
| `verify`, `NISH_SHA256=soft` (the scalar kernel) | 1,211–1,242 |

So the 2.9 µs was largely Valgrind's: its CPUID hides SHA-NI, so the
cachegrind run took the scalar kernel, and an instruction count is not a
time. Natively `verify` is ~0.7 µs, still above 0.5 µs on its own. About
400 ns of it is outside the HMAC (the base64url decode and the claims'
JSON tokenizer), which is the follow-up; the HMAC is already at its minimum
of three SHA-256 compressions, the key's pads absorbed once.

### Idle RSS per connection

`--shape rss`, peak RSS per idle connection at 10,000, median (min–max) of
5 runs: v0.34.1 1,026 bytes, v0.35.0 1,036 (1,034–1,038), main 1,036, cut
1,034 (1,034–1,035). The cuts allocate nothing.

### The public API

The cuts change no exported name or signature. As a check, the challenge
server (`bench/http1-e2e/run.sh`'s `S` arm, built with this tree's
`build/nish`) ran one short loadgen round on the full seed (500,000
articles): `USERS=2000 RAMP=10 MEASURE=30 SKIP=5`, 60,006 requests, 0
errors, 30,435 ns on-CPU per request (10,063 user).
