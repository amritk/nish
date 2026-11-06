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
node bench/http1-conn/run.mjs --shape idle --connections 10000 --rounds 15 --base origin/main
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
default all three), rotating which goes first:

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
  small JSON body, whose body bytes go into the checksum.

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

`main.ts` alone takes `hot|cold|idle|rss [requests] [connections] [batches]`
and prints `shape ns requests checksum` for its fastest batch; the idle and
rss shapes add how many input, head and output buffers the pools made, which
with the lending LIFO stays at one each however many connections there are.
The rss shape prints its peak in KiB where the others print nanoseconds.

## Measured: a hot-first parser layout (2026-11-06)

`std/net/http1-codec.ts`'s `Http1Parser` puts the fields a request reads
first (its buffers, the window and scan state, the flags), makes its `spans`
before its other arrays, `Http1Connection` makes its parser before its
`HttpDate`, and `unpark` finds a lent buffer by comparing it with `noOutput`.
Against `main` at `98c4f9a7`, Intel(R) Xeon(R) Processor @ 2.10GHz, pinned to
core 1, `node bench/http1-conn/run.mjs --shape idle,hot,cold --connections 10000 --rounds 15 --base origin/main`:

| shape | old | old′ | new |
| --- | ---: | ---: | ---: |
| hot | 460.4 (458.3–476.7) | 460.0 (458.1–481.0) 0.999 | 455.3 (452.0–493.3) 0.989 |
| cold | 460.6 (457.3–496.7) | 460.5 (457.2–474.2) 1.000 | 453.9 (451.6–508.2) 0.985 |
| idle | 577.5 (574.4–588.0) | 576.8 (572.6–592.9) 0.999 | 574.7 (569.0–594.4) 0.995 |
| RSS per idle connection, bytes | 1026 (1025–1026) | 1025 (1025–1026) | 1026 (1025–1026) |

The medians move by more than the `old′` gap; the min–max ranges overlap.
Cachegrind counts the cause: D1 misses per idle request go from 10.95 to
9.00 (reorder and spans first 10.06, the identity `unpark` 9.32, the parser
before the date 9.00). To count them, build `main.ts` with `-g` at
`--profile speed` and run `valgrind --tool=cachegrind --cache-sim=yes` on
`idle 0 10000 1` and `idle 100000 10000 1`; the difference over 100,000 is
one request.

Not taken:

- **The spans inline in the parser.** About one miss per request (the spans'
  array header), but `std/net/websocket.ts` reads `p.spans` as an `i32[]`,
  so it waits for a change that may touch that module.
- **Reading straight into `parser.buf`.** The scratch-to-buffer copy is one
  `memcpy` of the request onto lines the parse reads next. Skipping it would
  change `Http1Server`'s read path for every carrier, a larger change than
  this layout; its share of the misses was not measured apart, so it is left
  for a stage that measures it.
