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

With the idle shape (or `--rss N`) it also reports the peak RSS one idle
connection costs: each binary's `rss` mode builds the idle pool, serves one
request on every connection so each parks, and prints its `VmHWM` from
`/proc/self/status`; the table gives, over `--rss` runs (default 5), the
median and min–max of the peak at `--connections` less the peak at 0,
divided by `--connections`. `getrusage`'s `ru_maxrss` cannot stand in for
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
runs cachegrind (`--cache-sim=yes`, D1 48 KiB 12-way, LL 512 MiB 32-way) on
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
