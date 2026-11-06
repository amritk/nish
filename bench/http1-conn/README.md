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
